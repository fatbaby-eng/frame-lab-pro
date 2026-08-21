import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useEditor } from '../EditorContext';
import type { Clip, LayerType, Track, Transform } from '../types';
import { hasKeyframeAt, isAnimated, snapToTimes, collectSnapTimes, findClip } from '../types';
import CurveEditor from './CurveEditor';
import {
  Eye, EyeOff, Lock, Unlock, Volume2, VolumeX,
  Plus, Minus, Trash2, ChevronDown, ChevronRight, ChevronLeft, Repeat, Diamond, Timer, Spline,
} from 'lucide-react';

const HEADER_WIDTH = 286;
const TRACK_H = 36;
const PROP_H = 22;
const RULER_H = 32;

const TRANSFORM_KEYS: { key: keyof Transform; label: string }[] = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'scaleX', label: 'Scale X' },
  { key: 'scaleY', label: 'Scale Y' },
  { key: 'rotation', label: 'Rot' },
  { key: 'opacity', label: 'Opac' },
];

type DragMode = 'move' | 'resize-left' | 'resize-right' | 'playhead' | 'keyframe' | 'work-in' | 'work-out' | 'reorder' | null;

export default function Timeline() {
  const {
    state, togglePlay, seek, selectClip, selectTrack, selectKeyframe,
    toggleTrackVisibility, toggleTrackLock, toggleTrackMute, toggleTrackSolo,
    addTrack, deleteTrack, moveClip, resizeClip, setZoom, setSnapEnabled,
    setLoop, toggleKeyframe, toggleKeyframes, patchTransform, toggleAnimated, toggleExpanded,
    duplicateClip, setWorkArea, reorderTracks,
  } = useEditor();
  const {
    currentTime, zoom, isPlaying, selectedClipId, selectedTrackId,
    snapEnabled, loop, expandedClipId, selectedKeyframe,
  } = state;

  const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
  const timelineWidth = comp.duration * zoom;

  const containerRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOrigStart, setDragOrigStart] = useState(0);
  const [dragOrigDuration, setDragOrigDuration] = useState(0);
  const [dragOrigTrackId, setDragOrigTrackId] = useState<string | null>(null);
  const [reorderFrom, setReorderFrom] = useState<number | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const justDraggedRef = useRef(false);

  const pxToTime = useCallback((px: number) => px / zoom, [zoom]);
  const timeToPx = useCallback((t: number) => t * zoom, [zoom]);
  const snapThreshold = 10 / zoom;

  const snapTime = useCallback((t: number, excludeClipId?: string) => {
    if (!snapEnabled) return Math.max(0, t);
    const targets = collectSnapTimes(comp, currentTime, excludeClipId);
    return Math.max(0, snapToTimes(t, targets, snapThreshold));
  }, [snapEnabled, comp, currentTime, snapThreshold]);

  const rulerMarks = useMemo(() => {
    const marks: { time: number; label: string; major: boolean }[] = [];
    const step = zoom > 80 ? 1 : zoom > 40 ? 2 : zoom > 20 ? 5 : 10;
    for (let t = 0; t <= comp.duration + step; t += step) {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      marks.push({
        time: t,
        label: `${m}:${s.toString().padStart(2, '0')}`,
        major: t % (step * 5) === 0,
      });
    }
    return marks;
  }, [comp.duration, zoom]);

  const trackHeight = useCallback((track: Track) => {
    const expanded = track.clips.some(c => c.id === expandedClipId);
    return TRACK_H + (expanded ? TRANSFORM_KEYS.length * PROP_H : 0);
  }, [expandedClipId]);

  const trackAtClientY = useCallback((clientY: number) => {
    const header = headerScrollRef.current;
    if (!header) return null;
    const rect = header.getBoundingClientRect();
    let y = clientY - rect.top + header.scrollTop;
    for (const track of comp.tracks) {
      const h = trackHeight(track);
      if (y >= 0 && y < h) return track;
      y -= h;
    }
    return comp.tracks[comp.tracks.length - 1] ?? null;
  }, [comp.tracks, trackHeight]);

  useEffect(() => {
    const tracksEl = containerRef.current;
    const headerEl = headerScrollRef.current;
    if (!tracksEl || !headerEl) return;
    const syncTracks = () => { tracksEl.scrollTop = headerEl.scrollTop; };
    const syncHeader = () => { headerEl.scrollTop = tracksEl.scrollTop; };
    headerEl.addEventListener('scroll', syncTracks);
    tracksEl.addEventListener('scroll', syncHeader);
    return () => {
      headerEl.removeEventListener('scroll', syncTracks);
      tracksEl.removeEventListener('scroll', syncHeader);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isPlaying) return;
    const x = timeToPx(currentTime);
    if (x < el.scrollLeft + 48 || x > el.scrollLeft + el.clientWidth - 48) {
      el.scrollLeft = Math.max(0, x - el.clientWidth * 0.35);
    }
  }, [currentTime, isPlaying, timeToPx]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left + el.scrollLeft;
        const timeUnder = pxToTime(x);
        const next = Math.max(10, Math.min(400, zoom + (e.deltaY > 0 ? -12 : 12)));
        setZoom(next);
        requestAnimationFrame(() => {
          el.scrollLeft = Math.max(0, timeUnder * next - (e.clientX - rect.left));
        });
        return;
      }
      if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, pxToTime, setZoom]);

  const timeFromEvent = useCallback((e: { clientX: number }) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    return pxToTime(x);
  }, [pxToTime]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (isDragging || justDraggedRef.current) return;
    if ((e.target as HTMLElement).closest('[data-kf-marker]')) return;
    seek(Math.max(0, Math.min(timeFromEvent(e), comp.duration)));
  }, [seek, timeFromEvent, comp.duration, isDragging]);

  const applyKfDrag = useCallback((
    clipId: string,
    snapshot: Partial<Transform>,
    originTime: number,
    nextTime: number,
  ) => {
    const patch: Partial<Transform> = {};
    for (const key of Object.keys(snapshot) as (keyof Transform)[]) {
      const prop = snapshot[key];
      if (!prop) continue;
      patch[key] = {
        enabled: true,
        keyframes: prop.keyframes
          .map(kf => {
            const sameId = kf.id && snapshot[key]!.keyframes.some(s => s.id === kf.id && Math.abs(s.time - originTime) < 1 / 60);
            const sameTime = Math.abs(kf.time - originTime) < 1 / 60;
            return (sameId || sameTime) ? { ...kf, time: nextTime } : kf;
          })
          .sort((a, b) => a.time - b.time),
      };
    }
    patchTransform(clipId, patch);
  }, [patchTransform]);

  const onClipMouseDown = useCallback((e: React.MouseEvent, clip: Clip, track: Track, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    if (track.locked) return;
    if (mode === 'move' && (e.target as HTMLElement).closest('[data-kf-marker]')) return;
    let targetId = clip.id;
    let origStart = clip.start;
    if (e.altKey && mode === 'move') {
      const copyId = duplicateClip(clip.id);
      if (copyId) {
        targetId = copyId;
        origStart = clip.start + 0.2;
      }
    }
    setDragMode(mode);
    setDragClipId(targetId);
    setDragStartX(e.clientX);
    setDragOrigStart(origStart);
    setDragOrigDuration(clip.duration);
    setDragOrigTrackId(clip.trackId);
    selectClip(targetId);
    setIsDragging(true);
  }, [selectClip, duplicateClip, timeFromEvent]);

  const onPlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDragMode('playhead');
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragMode === 'playhead') {
        seek(Math.max(0, Math.min(timeFromEvent(e), comp.duration)));
        return;
      }

      if (dragMode === 'work-in') {
        const t = snapTime(timeFromEvent(e));
        setWorkArea(Math.min(t, (comp.workAreaEnd ?? comp.duration) - 0.1), comp.workAreaEnd ?? comp.duration);
        return;
      }
      if (dragMode === 'work-out') {
        const t = snapTime(timeFromEvent(e));
        setWorkArea(comp.workAreaStart ?? 0, Math.max(t, (comp.workAreaStart ?? 0) + 0.1));
        return;
      }

      if (dragMode === 'reorder' && reorderFrom != null) {
        const over = trackAtClientY(e.clientY);
        if (!over) return;
        const to = comp.tracks.findIndex(t => t.id === over.id);
        if (to >= 0 && to !== reorderFrom) {
          reorderTracks(reorderFrom, to);
          setReorderFrom(to);
        }
        return;
      }

      if (!dragClipId || !dragMode) return;
      const deltaTime = pxToTime(e.clientX - dragStartX);
      const clip = comp.tracks.flatMap(t => t.clips).find(c => c.id === dragClipId);
      if (!clip) return;

      if (dragMode === 'move') {
        let newStart = snapTime(dragOrigStart + deltaTime, dragClipId);
        const over = trackAtClientY(e.clientY);
        const nextTrack = over && !over.locked ? over.id : dragOrigTrackId ?? clip.trackId;
        moveClip(dragClipId, Math.max(0, newStart), nextTrack);
      } else if (dragMode === 'resize-left') {
        let newStart = snapTime(dragOrigStart + deltaTime, dragClipId);
        const end = dragOrigStart + dragOrigDuration;
        if (newStart > end - 0.1) newStart = end - 0.1;
        resizeClip(dragClipId, Math.max(0, newStart), end - Math.max(0, newStart));
      } else if (dragMode === 'resize-right') {
        const end = snapTime(dragOrigStart + dragOrigDuration + deltaTime, dragClipId);
        const newDuration = end - clip.start;
        if (newDuration >= 0.1) resizeClip(dragClipId, clip.start, newDuration);
      }
    };

    const handleMouseUp = () => {
      if (dragMode && dragMode !== 'playhead') {
        justDraggedRef.current = true;
        window.setTimeout(() => { justDraggedRef.current = false; }, 0);
      }
      setIsDragging(false);
      setDragMode(null);
      setDragClipId(null);
      setReorderFrom(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragMode, dragClipId, dragStartX, dragOrigStart, dragOrigDuration, dragOrigTrackId, reorderFrom, pxToTime, timeFromEvent, snapTime, moveClip, resizeClip, setWorkArea, reorderTracks, trackAtClientY, comp, seek]);

  const clipColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-blue-500/40 border-blue-400';
      case 'audio': return 'bg-emerald-500/40 border-emerald-400';
      case 'image': return 'bg-purple-500/40 border-purple-400';
      case 'text': return 'bg-amber-500/40 border-amber-400';
      case 'shape': return 'bg-rose-500/40 border-rose-400';
      case 'path': return 'bg-pink-500/40 border-pink-400';
      case 'mesh3d': return 'bg-cyan-500/40 border-cyan-400';
      default: return 'bg-slate-500/40 border-slate-400';
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const f = Math.floor((t % 1) * comp.fps);
    return `${m}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  const playheadLeft = timeToPx(currentTime);
  const workStart = timeToPx(comp.workAreaStart ?? 0);
  const workEnd = timeToPx(comp.workAreaEnd ?? comp.duration);

  return (
    <div className="flex flex-col h-full bg-surface-900 border-t border-surface-600 select-none">
      <div className="h-9 bg-surface-800 border-b border-surface-600 flex items-center px-2 gap-2 shrink-0">
        <button onClick={togglePlay} className="w-7 h-7 rounded bg-accent/20 hover:bg-accent/40 text-accent-light flex items-center justify-center">
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10" rx="1"/><rect x="7" y="1" width="3" height="10" rx="1"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="2,1 11,6 2,11"/></svg>
          )}
        </button>
        <div className="text-xs font-mono text-slate-300 w-24 text-center">{formatTime(currentTime)}</div>
        <div className="w-px h-5 bg-surface-600 mx-1" />
        <button onClick={() => zoom > 10 && setZoom(zoom - 10)} className="text-slate-400 hover:text-white text-xs px-1">-</button>
        <span className="text-[10px] text-slate-500 w-10 text-center">{Math.round(zoom)}px/s</span>
        <button onClick={() => zoom < 400 && setZoom(zoom + 10)} className="text-slate-400 hover:text-white text-xs px-1">+</button>
        <div className="w-px h-5 bg-surface-600 mx-1" />
        <div className="relative">
          <button
            onClick={() => setAddMenuOpen(v => !v)}
            className="text-[10px] px-2 py-0.5 rounded bg-surface-700 hover:bg-surface-600 text-slate-300 border border-surface-600 flex items-center gap-1"
          >
            <Plus size={10} /> Track
          </button>
          {addMenuOpen && (
            <div className="absolute left-0 top-full mt-1 z-30 bg-surface-800 border border-surface-600 rounded-md shadow-xl py-1 min-w-[7rem]">
              {([
                ['video', 'Video'],
                ['audio', 'Audio'],
                ['text', 'Text'],
                ['shape', 'Shape'],
                ['path', 'Path'],
                ['mesh3d', '3D'],
              ] as [LayerType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => { addTrack(type); setAddMenuOpen(false); }}
                  className="w-full text-left px-2.5 py-1 text-[10px] text-slate-300 hover:bg-surface-700 hover:text-white"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowGraph(v => !v)}
          className={`w-7 h-7 rounded flex items-center justify-center ${showGraph ? 'text-accent-light bg-accent/20' : 'text-slate-500 hover:text-white'}`}
          title="Curve editor"
        >
          <Spline size={13} />
        </button>
        <button
          onClick={() => setLoop(!loop)}
          className={`w-7 h-7 rounded flex items-center justify-center ${loop ? 'text-accent-light bg-accent/20' : 'text-slate-500 hover:text-white'}`}
          title="Loop work area"
        >
          <Repeat size={12} />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-slate-500">Snap</span>
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`w-6 h-3.5 rounded-full relative transition-colors ${snapEnabled ? 'bg-accent' : 'bg-surface-600'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${snapEnabled ? 'translate-x-2.5' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="bg-surface-800 border-r border-surface-600 flex flex-col shrink-0 overflow-hidden" style={{ width: HEADER_WIDTH }}>
          {showGraph && (
            <div className="shrink-0 border-b border-surface-700 bg-[#0c0c14] px-2 py-1.5" style={{ height: 168 }}>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Graph</div>
              <div className="text-[10px] text-slate-400 mt-1 truncate">
                {selectedClipId ? (findClip(comp, selectedClipId)?.name ?? 'Clip') : 'No clip'}
              </div>
              <p className="text-[9px] text-slate-600 mt-2">Drag keys and handles. Double-click to add a key.</p>
            </div>
          )}
          <div className="border-b border-surface-600 shrink-0" style={{ height: RULER_H }} />
          <div ref={headerScrollRef} className="flex-1 overflow-y-auto">
            {comp.tracks.map((track, trackIndex) => {
              const expanded = track.clips.some(c => c.id === expandedClipId);
              const expandedClip = track.clips.find(c => c.id === expandedClipId);
              const layerClip = track.clips.find(c => currentTime >= c.start && currentTime < c.start + c.duration)
                ?? track.clips.find(c => c.id === selectedClipId)
                ?? track.clips[0]
                ?? null;
              return (
                <div key={track.id} style={{ height: trackHeight(track) }} className="border-b border-surface-700">
                  <div
                    className={`h-9 flex items-center px-1.5 gap-0.5 group cursor-grab ${selectedTrackId === track.id ? 'bg-accent/10' : ''}`}
                    onClick={() => selectTrack(track.id)}
                    onMouseDown={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      const startY = e.clientY;
                      const from = trackIndex;
                      const move = (ev: MouseEvent) => {
                        if (Math.abs(ev.clientY - startY) < 6) return;
                        window.removeEventListener('mousemove', move);
                        window.removeEventListener('mouseup', up);
                        setDragMode('reorder');
                        setReorderFrom(from);
                        setIsDragging(true);
                      };
                      const up = () => {
                        window.removeEventListener('mousemove', move);
                        window.removeEventListener('mouseup', up);
                      };
                      window.addEventListener('mousemove', move);
                      window.addEventListener('mouseup', up);
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const clip = track.clips.find(c => c.id === selectedClipId) ?? track.clips[0];
                        if (clip) toggleExpanded(clip.id);
                      }}
                      className="w-4 h-4 text-slate-500 hover:text-white"
                      title="Twirl down (U)"
                    >
                      {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleTrackVisibility(track.id); }} className={`w-4 h-4 rounded flex items-center justify-center ${track.visible ? 'text-slate-300' : 'text-slate-600'}`} title="Visibility">
                      {track.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleTrackSolo(track.id); }} className={`w-4 h-4 rounded text-[9px] font-bold ${track.solo ? 'text-amber-300' : 'text-slate-600 hover:text-slate-300'}`} title="Solo">S</button>
                    <button onClick={(e) => { e.stopPropagation(); toggleTrackLock(track.id); }} className={`w-4 h-4 rounded flex items-center justify-center ${track.locked ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'}`} title="Lock">
                      {track.locked ? <Lock size={11} /> : <Unlock size={11} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleTrackMute(track.id); }} className={`w-4 h-4 rounded flex items-center justify-center ${track.muted ? 'text-slate-600' : 'text-slate-500 hover:text-slate-300'}`} title="Mute">
                      {track.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                    </button>
                    <span className="text-[10px] text-slate-300 truncate min-w-0 flex-1" title={layerClip?.name ?? track.name}>
                      {layerClip?.name ?? track.name}
                    </span>
                    {layerClip && (
                      <KeyframeNav
                        keyed={TRANSFORM_KEYS.some(row => hasKeyframeAt(layerClip.transform[row.key], Math.max(0, currentTime - layerClip.start)))}
                        hasPrev={allClipKeyTimes(layerClip).some(t => t < currentTime - 0.001)}
                        hasNext={allClipKeyTimes(layerClip).some(t => t > currentTime + 0.001)}
                        onPrev={() => {
                          const prev = [...allClipKeyTimes(layerClip)].reverse().find(t => t < currentTime - 0.001);
                          if (prev != null) seek(prev);
                        }}
                        onNext={() => {
                          const next = allClipKeyTimes(layerClip).find(t => t > currentTime + 0.001);
                          if (next != null) seek(next);
                        }}
                        onAdd={() => {
                          selectClip(layerClip.id);
                          const clipTime = Math.max(0, currentTime - layerClip.start);
                          const animated = TRANSFORM_KEYS.filter(row => isAnimated(layerClip.transform[row.key]));
                          const targets = animated.length ? animated.map(r => r.key) : (['x', 'y'] as (keyof Transform)[]);
                          const toAdd = targets.filter(k => !hasKeyframeAt(layerClip.transform[k], clipTime));
                          if (toAdd.length) {
                            toggleKeyframes(layerClip.id, toAdd, currentTime);
                            selectKeyframe({ clipId: layerClip.id, key: toAdd[0], time: clipTime });
                          }
                        }}
                        onRemove={() => {
                          selectClip(layerClip.id);
                          const clipTime = Math.max(0, currentTime - layerClip.start);
                          const toRemove = TRANSFORM_KEYS
                            .map(r => r.key)
                            .filter(k => hasKeyframeAt(layerClip.transform[k], clipTime));
                          if (toRemove.length) toggleKeyframes(layerClip.id, toRemove, currentTime);
                        }}
                      />
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }} className="w-4 h-4 rounded flex items-center justify-center text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                      <Trash2 size={10} />
                    </button>
                  </div>
                  {expanded && expandedClip && TRANSFORM_KEYS.map(row => {
                    const prop = expandedClip.transform[row.key];
                    const clipTime = Math.max(0, currentTime - expandedClip.start);
                    const keyed = prop ? hasKeyframeAt(prop, clipTime) : false;
                    const animated = isAnimated(prop);
                    const times = prop?.keyframes.map(k => k.time) ?? [];
                    const prev = [...times].reverse().find(tm => tm < clipTime - 0.001);
                    const next = times.find(tm => tm > clipTime + 0.001);
                    return (
                      <div key={row.key} className="h-[22px] flex items-center px-1 gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleAnimated(expandedClip.id, row.key); }}
                          className={`w-3.5 h-3.5 shrink-0 flex items-center justify-center ${animated ? 'text-accent-light' : 'text-slate-600 hover:text-slate-300'}`}
                          title={animated ? 'Stopwatch off' : 'Stopwatch on'}
                        >
                          <Timer size={9} />
                        </button>
                        <KeyframeNav
                          keyed={keyed}
                          hasPrev={prev != null}
                          hasNext={next != null}
                          onPrev={() => { if (prev != null) seek(expandedClip.start + prev); }}
                          onNext={() => { if (next != null) seek(expandedClip.start + next); }}
                          onAdd={() => {
                            if (!keyed) toggleKeyframe(expandedClip.id, row.key);
                          }}
                          onRemove={() => {
                            if (keyed) toggleKeyframe(expandedClip.id, row.key);
                          }}
                        />
                        <span className="text-[9px] text-slate-400 truncate flex-1">{row.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div ref={containerRef} data-timeline-tracks className="flex-1 overflow-auto relative" onClick={handleTimelineClick}>
          <div className="relative" style={{ width: Math.max(timelineWidth + 200, 800), minHeight: '100%' }}>
            {showGraph && (
              <div className="sticky top-0 z-[21] bg-[#0c0c14]" style={{ width: Math.max(timelineWidth + 200, 800) }}>
                <CurveEditor width={Math.max(timelineWidth + 200, 800)} />
              </div>
            )}
            <div className="sticky z-20 border-b border-surface-600 relative bg-surface-800" style={{ height: RULER_H, top: showGraph ? 168 : 0 }}>
              {rulerMarks.map(mark => (
                <div key={mark.time} className="absolute top-0 flex flex-col items-center" style={{ left: timeToPx(mark.time) }}>
                  <div className={`w-px ${mark.major ? 'h-3 bg-slate-400' : 'h-1.5 bg-slate-600'}`} />
                  <span className="text-[9px] text-slate-500 mt-0.5">{mark.label}</span>
                </div>
              ))}
              <div
                className="absolute top-0 h-2 bg-accent/50 cursor-ew-resize z-10"
                style={{ left: workStart, width: Math.max(4, workEnd - workStart) }}
                title="Work area"
              />
              <div
                className="absolute top-0 w-1.5 h-3 bg-accent cursor-ew-resize z-20"
                style={{ left: workStart }}
                onMouseDown={(e) => { e.stopPropagation(); setDragMode('work-in'); setIsDragging(true); }}
              />
              <div
                className="absolute top-0 w-1.5 h-3 bg-accent cursor-ew-resize z-20"
                style={{ left: workEnd }}
                onMouseDown={(e) => { e.stopPropagation(); setDragMode('work-out'); setIsDragging(true); }}
              />
            </div>

            <div className="absolute pointer-events-none z-[5]" style={{ top: RULER_H, bottom: 0, left: 0, width: workStart, background: 'rgba(0,0,0,0.3)' }} />
            <div className="absolute pointer-events-none z-[5]" style={{ top: RULER_H, bottom: 0, left: workEnd, right: 0, background: 'rgba(0,0,0,0.3)' }} />

            {comp.tracks.map(track => {
              const expanded = track.clips.some(c => c.id === expandedClipId);
              const expandedClip = track.clips.find(c => c.id === expandedClipId);
              return (
                <div key={track.id} className="border-b border-surface-700 relative" style={{ height: trackHeight(track) }}>
                  {track.clips.map(clip => {
                    const left = timeToPx(clip.start);
                    const width = Math.max(timeToPx(clip.duration), 4);
                    const isSelected = selectedClipId === clip.id;
                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-1 h-7 rounded-md border ${clipColor(clip.type)} ${isSelected ? 'ring-2 ring-white/50 z-10' : ''} ${track.locked ? 'cursor-not-allowed' : 'cursor-ew-resize'} overflow-hidden`}
                        style={{ left, width }}
                        onMouseDown={(e) => onClipMouseDown(e, clip, track, 'move')}
                        onClick={(e) => { e.stopPropagation(); selectClip(clip.id); }}
                        onDoubleClick={(e) => { e.stopPropagation(); toggleExpanded(clip.id); }}
                      >
                        {!track.locked && (
                          <>
                            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/20 z-20" onMouseDown={(e) => onClipMouseDown(e, clip, track, 'resize-left')} />
                            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/20 z-20" onMouseDown={(e) => onClipMouseDown(e, clip, track, 'resize-right')} />
                          </>
                        )}
                        {clip.type === 'audio' && (
                          <Waveform
                            peaks={state.project.assets.find(a => a.id === clip.assetId)?.peaks}
                            width={width}
                          />
                        )}
                        <div className="px-2 py-0.5 pointer-events-none flex items-center gap-1 relative z-[1]">
                          <div className="text-[10px] font-medium text-white truncate">{clip.name}</div>
                        </div>
                      </div>
                    );
                  })}
                  {!expanded && track.clips.flatMap(clip =>
                    clusteredKeyTimes(clip).map(group => {
                      const isSel = selectedKeyframe?.clipId === clip.id && Math.abs(selectedKeyframe.time - group.time) < 0.01;
                      return (
                        <KeyframeMarker
                          key={group.id}
                          markerId={group.id}
                          time={group.time}
                          clipStart={clip.start}
                          clipDuration={clip.duration}
                          zoom={zoom}
                          selected={isSel}
                          top={8}
                          getCompTime={timeFromEvent}
                          getSnapshot={() => {
                            const snapshot: Partial<Transform> = {};
                            for (const key of group.keys) {
                              snapshot[key] = {
                                enabled: true,
                                keyframes: clip.transform[key].keyframes.map(kf => ({ ...kf })),
                              };
                            }
                            return snapshot;
                          }}
                          onSelect={() => {
                            selectClip(clip.id);
                            selectKeyframe({ clipId: clip.id, key: group.keys[0], time: group.time });
                          }}
                          onDrag={(next, snapshot, originTime) => {
                            justDraggedRef.current = true;
                            applyKfDrag(clip.id, snapshot, originTime, next);
                            selectKeyframe({ clipId: clip.id, key: group.keys[0], time: next });
                          }}
                          onDragEnd={() => {
                            window.setTimeout(() => { justDraggedRef.current = false; }, 0);
                          }}
                        />
                      );
                    })
                  )}

                  {expanded && expandedClip && TRANSFORM_KEYS.map((row, i) => (
                    <div
                      key={row.key}
                      className="absolute left-0 right-0 border-t border-surface-700/60"
                      style={{ top: TRACK_H + i * PROP_H, height: PROP_H }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        const at = Math.max(0, Math.min(expandedClip.duration, timeFromEvent(e) - expandedClip.start));
                        const compTime = expandedClip.start + at;
                        seek(compTime);
                        toggleKeyframe(expandedClip.id, row.key, compTime);
                      }}
                    >
                      {isAnimated(expandedClip.transform[row.key]) && expandedClip.transform[row.key].keyframes.map((kf) => {
                        const isSel = selectedKeyframe?.clipId === expandedClip.id && selectedKeyframe.key === row.key && Math.abs(selectedKeyframe.time - kf.time) < 0.01;
                        const markerId = kf.id ?? `${expandedClip.id}-${row.key}-${kf.time}`;
                        return (
                          <KeyframeMarker
                            key={markerId}
                            markerId={markerId}
                            time={kf.time}
                            clipStart={expandedClip.start}
                            clipDuration={expandedClip.duration}
                            zoom={zoom}
                            selected={isSel}
                            top={3}
                            getCompTime={timeFromEvent}
                            getSnapshot={() => ({
                              [row.key]: {
                                enabled: true,
                                keyframes: expandedClip.transform[row.key].keyframes.map(k => ({ ...k })),
                              },
                            })}
                            onSelect={() => {
                              selectClip(expandedClip.id);
                              selectKeyframe({ clipId: expandedClip.id, key: row.key, time: kf.time });
                            }}
                            onDrag={(next, snapshot, originTime) => {
                              justDraggedRef.current = true;
                              applyKfDrag(expandedClip.id, snapshot, originTime, next);
                              selectKeyframe({ clipId: expandedClip.id, key: row.key, time: next });
                            }}
                            onDragEnd={() => {
                              window.setTimeout(() => { justDraggedRef.current = false; }, 0);
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}

            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: playheadLeft, transform: 'translateX(-50%)', width: 16 }}
            >
              <div className="w-px h-full bg-red-500 mx-auto" />
              <div
                className="absolute left-1/2 -translate-x-1/2 w-4 h-8 pointer-events-auto cursor-ew-resize"
                style={{ top: showGraph ? 168 : 0 }}
                onMouseDown={onPlayheadMouseDown}
              >
                <div className="w-0 h-0 mx-auto border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function allClipKeyTimes(clip: Clip): number[] {
  const times = new Set<number>();
  for (const row of TRANSFORM_KEYS) {
    if (!isAnimated(clip.transform[row.key])) continue;
    for (const kf of clip.transform[row.key].keyframes) {
      times.add(clip.start + kf.time);
    }
  }
  return [...times].sort((a, b) => a - b);
}

function KeyframeNav({
  keyed, hasPrev, hasNext, onPrev, onNext, onAdd, onRemove,
}: {
  keyed: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const btn = 'w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center shrink-0" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
      <button type="button" disabled={!hasPrev} onClick={e => { e.stopPropagation(); onPrev(); }} className={btn} title="Jump to previous keyframe">
        <ChevronLeft size={11} />
      </button>
      <button type="button" disabled={!keyed} onClick={e => { e.stopPropagation(); onRemove(); }} className={`${btn} ${keyed ? 'text-rose-300 hover:text-rose-200' : ''}`} title="Remove keyframe at playhead">
        <Minus size={10} />
      </button>
      <span className={`w-4 h-4 flex items-center justify-center ${keyed ? 'text-white' : 'text-slate-500'}`} title={keyed ? 'Keyframe at playhead' : 'No keyframe at playhead'}>
        <Diamond size={10} fill={keyed ? 'currentColor' : 'none'} />
      </span>
      <button type="button" disabled={keyed} onClick={e => { e.stopPropagation(); onAdd(); }} className={`${btn} ${!keyed ? 'text-emerald-300 hover:text-emerald-200' : ''}`} title="Add keyframe at playhead">
        <Plus size={10} />
      </button>
      <button type="button" disabled={!hasNext} onClick={e => { e.stopPropagation(); onNext(); }} className={btn} title="Jump to next keyframe">
        <ChevronRight size={11} />
      </button>
    </div>
  );
}

function clusteredKeyTimes(clip: Clip): { time: number; keys: (keyof Transform)[]; id: string }[] {
  const buckets: { time: number; keys: (keyof Transform)[]; ids: string[] }[] = [];
  for (const row of TRANSFORM_KEYS) {
    const prop = clip.transform[row.key];
    if (!isAnimated(prop)) continue;
    for (const kf of prop.keyframes) {
      const existing = buckets.find(b => Math.abs(b.time - kf.time) < 1 / 60);
      const sid = kf.id || `${clip.id}-${row.key}-${kf.time}`;
      if (existing) {
        if (!existing.keys.includes(row.key)) existing.keys.push(row.key);
        if (!existing.ids.includes(sid)) existing.ids.push(sid);
      } else {
        buckets.push({ time: kf.time, keys: [row.key], ids: [sid] });
      }
    }
  }
  return buckets.map(b => ({ time: b.time, keys: b.keys, id: b.ids.slice().sort().join('_') }));
}

function KeyframeMarker({
  markerId,
  time,
  clipStart,
  clipDuration,
  zoom,
  selected,
  top,
  getCompTime,
  getSnapshot,
  onSelect,
  onDrag,
  onDragEnd,
}: {
  markerId: string;
  time: number;
  clipStart: number;
  clipDuration: number;
  zoom: number;
  selected: boolean;
  top: number;
  getCompTime: (e: { clientX: number }) => number;
  getSnapshot: () => Partial<Transform>;
  onSelect: () => void;
  onDrag: (next: number, snapshot: Partial<Transform>, originTime: number) => void;
  onDragEnd: () => void;
}) {
  const [live, setLive] = useState<number | null>(null);
  const display = live ?? time;

  return (
    <div
      data-kf-marker={markerId}
      className="absolute z-50 flex items-center justify-center touch-none select-none cursor-ew-resize"
      style={{
        left: (clipStart + display) * zoom,
        top,
        width: 20,
        height: 20,
        marginLeft: -10,
      }}
      title="Drag keyframe"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onSelect();
        const snapshot = getSnapshot();
        const originTime = time;
        let dragged = false;
        const startX = e.clientX;

        const move = (ev: PointerEvent) => {
          ev.preventDefault();
          if (!dragged && Math.abs(ev.clientX - startX) < 3) return;
          dragged = true;
          const next = Math.max(0, Math.min(clipDuration, getCompTime(ev) - clipStart));
          setLive(next);
          onDrag(next, snapshot, originTime);
        };
        const up = () => {
          window.removeEventListener('pointermove', move, true);
          window.removeEventListener('pointerup', up, true);
          window.removeEventListener('pointercancel', up, true);
          setLive(null);
          onDragEnd();
        };
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', up, true);
      }}
    >
      <div
        className={`w-3.5 h-3.5 rotate-45 border shadow-sm pointer-events-none ${selected || live != null ? 'bg-white border-accent' : 'bg-accent-light border-white/60'}`}
      />
    </div>
  );
}

function Waveform({ peaks, width }: { peaks?: number[]; width: number }) {
  if (!peaks?.length) return null;
  const h = 28;
  const mid = h / 2;
  const step = width / peaks.length;
  const d = peaks.map((p, i) => {
    const x = i * step;
    const amp = Math.max(1, p * (mid - 2));
    return `M${x.toFixed(1)},${(mid - amp).toFixed(1)} L${x.toFixed(1)},${(mid + amp).toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-70" viewBox={`0 0 ${width} ${h}`} preserveAspectRatio="none">
      <path d={d} stroke="#6ee7b7" strokeWidth={1.2} fill="none" />
    </svg>
  );
}
