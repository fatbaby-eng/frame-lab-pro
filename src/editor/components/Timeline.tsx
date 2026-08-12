import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useEditor } from '../EditorContext';
import type { Clip, Track } from '../types';
import {
  Eye, EyeOff, Lock, Unlock, Volume2, VolumeX,
  Plus, Trash2,
} from 'lucide-react';

const HEADER_WIDTH = 160;

export default function Timeline() {
  const {
    state, togglePlay, seek, selectClip, selectTrack,
    toggleTrackVisibility, toggleTrackLock, toggleTrackMute,
    addTrack, deleteTrack, moveClip, resizeClip, setZoom, setSnapEnabled,
  } = useEditor();
  const { currentTime, zoom, isPlaying, selectedClipId, selectedTrackId, snapEnabled } = state;

  const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
  const timelineWidth = comp.duration * zoom;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'move' | 'resize-left' | 'resize-right' | 'playhead' | null>(null);
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOrigStart, setDragOrigStart] = useState(0);
  const [dragOrigDuration, setDragOrigDuration] = useState(0);

  const pxToTime = useCallback((px: number) => px / zoom, [zoom]);
  const timeToPx = useCallback((t: number) => t * zoom, [zoom]);

  const rulerMarks = useMemo(() => {
    const marks: { time: number; label: string; major: boolean }[] = [];
    const step = zoom > 80 ? 1 : zoom > 40 ? 2 : zoom > 20 ? 5 : 10;
    for (let t = 0; t <= comp.duration + step; t += step) {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      marks.push({
        time: t,
        label: zoom > 60 ? `${m}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`,
        major: t % (step * 5) === 0,
      });
    }
    return marks;
  }, [comp.duration, zoom]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft - HEADER_WIDTH;
    if (x < 0) return;
    seek(pxToTime(x));
  }, [seek, pxToTime]);

  const onClipMouseDown = useCallback((e: React.MouseEvent, clip: Clip, track: Track, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    if (track.locked) return;
    setDragMode(mode);
    setDragClipId(clip.id);
    setDragStartX(e.clientX);
    setDragOrigStart(clip.start);
    setDragOrigDuration(clip.duration);
    selectClip(clip.id);
    setIsDragging(true);
  }, [selectClip]);

  const onPlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDragMode('playhead');
    setDragStartX(e.clientX);
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragMode === 'playhead') {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + containerRef.current.scrollLeft - HEADER_WIDTH;
        const time = Math.max(0, Math.min(pxToTime(x), comp.duration));
        seek(time);
        return;
      }

      if (!dragClipId || !dragMode) return;
      const deltaPx = e.clientX - dragStartX;
      const deltaTime = pxToTime(deltaPx);

      const clip = comp.tracks.flatMap(t => t.clips).find(c => c.id === dragClipId);
      if (!clip) return;

      if (dragMode === 'move') {
        let newStart = dragOrigStart + deltaTime;
        if (snapEnabled) newStart = Math.round(newStart * 10) / 10;
        moveClip(dragClipId, Math.max(0, newStart));
      } else if (dragMode === 'resize-left') {
        let newStart = dragOrigStart + deltaTime;
        let newDuration = dragOrigDuration - deltaTime;
        if (snapEnabled) {
          newStart = Math.round(newStart * 10) / 10;
          newDuration = Math.round(newDuration * 10) / 10;
        }
        if (newDuration >= 0.1) resizeClip(dragClipId, Math.max(0, newStart), newDuration);
      } else if (dragMode === 'resize-right') {
        let newDuration = dragOrigDuration + deltaTime;
        if (snapEnabled) newDuration = Math.round(newDuration * 10) / 10;
        if (newDuration >= 0.1) resizeClip(dragClipId, clip.start, newDuration);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragMode(null);
      setDragClipId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragMode, dragClipId, dragStartX, dragOrigStart, dragOrigDuration, pxToTime, snapEnabled, moveClip, resizeClip, comp, seek]);

  const clipColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-blue-500/40 border-blue-400';
      case 'audio': return 'bg-emerald-500/40 border-emerald-400';
      case 'image': return 'bg-purple-500/40 border-purple-400';
      case 'text': return 'bg-amber-500/40 border-amber-400';
      case 'shape': return 'bg-rose-500/40 border-rose-400';
      case 'path': return 'bg-pink-500/40 border-pink-400';
      case 'mesh3d': return 'bg-cyan-500/40 border-cyan-400';
      case 'effect': return 'bg-orange-500/40 border-orange-400';
      default: return 'bg-slate-500/40 border-slate-400';
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const playheadLeft = timeToPx(currentTime);

  return (
    <div className="flex flex-col h-full bg-surface-900 border-t border-surface-600 select-none">
      {/* Toolbar */}
      <div className="h-9 bg-surface-800 border-b border-surface-600 flex items-center px-2 gap-2 shrink-0">
        <button onClick={togglePlay} className="w-7 h-7 rounded bg-accent/20 hover:bg-accent/40 text-accent-light flex items-center justify-center">
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10" rx="1"/><rect x="7" y="1" width="3" height="10" rx="1"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="2,1 11,6 2,11"/></svg>
          )}
        </button>
        <div className="text-xs font-mono text-slate-300 w-20 text-center">
          {formatTime(currentTime)} / {formatTime(comp.duration)}
        </div>
        <div className="w-px h-5 bg-surface-600 mx-1" />
        <button onClick={() => zoom > 10 && setZoom(zoom - 10)} className="text-slate-400 hover:text-white text-xs px-1">-</button>
        <span className="text-[10px] text-slate-500 w-10 text-center">{Math.round(zoom)}px/s</span>
        <button onClick={() => zoom < 400 && setZoom(zoom + 10)} className="text-slate-400 hover:text-white text-xs px-1">+</button>
        <div className="w-px h-5 bg-surface-600 mx-1" />
        <button
          onClick={() => addTrack('video')}
          className="text-[10px] px-2 py-0.5 rounded bg-surface-700 hover:bg-surface-600 text-slate-300 border border-surface-600 flex items-center gap-1"
        >
          <Plus size={10} /> Track
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

      {/* Timeline area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track headers */}
        <div className="w-40 bg-surface-800 border-r border-surface-600 flex flex-col shrink-0 overflow-hidden">
          <div className="h-8 border-b border-surface-600 shrink-0" />
          <div className="flex-1 overflow-y-auto">
            {comp.tracks.map(track => (
              <div
                key={track.id}
                className={`h-12 border-b border-surface-700 flex items-center px-2 gap-1.5 ${selectedTrackId === track.id ? 'bg-accent/10' : ''}`}
                onClick={() => selectTrack(track.id)}
              >
                <button onClick={(e) => { e.stopPropagation(); toggleTrackVisibility(track.id); }} className={`w-5 h-5 rounded flex items-center justify-center ${track.visible ? 'text-slate-300 hover:text-white' : 'text-slate-600'}`}>
                  {track.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); toggleTrackLock(track.id); }} className={`w-5 h-5 rounded flex items-center justify-center ${track.locked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}>
                  {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                {track.type === 'audio' && (
                  <button onClick={(e) => { e.stopPropagation(); toggleTrackMute(track.id); }} className={`w-5 h-5 rounded flex items-center justify-center ${track.muted ? 'text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}>
                    {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                )}
                <span className="text-[10px] text-slate-300 truncate flex-1 ml-0.5">{track.name}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }} className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tracks + Ruler */}
        <div ref={containerRef} className="flex-1 overflow-auto relative" onClick={handleTimelineClick}>
          {/* Ruler */}
          <div className="h-8 border-b border-surface-600 relative bg-surface-800 shrink-0" style={{ width: Math.max(timelineWidth + 200, 800) }}>
            {rulerMarks.map(mark => (
              <div key={mark.time} className="absolute top-0 flex flex-col items-center" style={{ left: timeToPx(mark.time) }}>
                <div className={`w-px ${mark.major ? 'h-3 bg-slate-400' : 'h-1.5 bg-slate-600'}`} />
                <span className="text-[9px] text-slate-500 mt-0.5">{mark.label}</span>
              </div>
            ))}
          </div>

          {/* Tracks */}
          <div className="relative" style={{ width: Math.max(timelineWidth + 200, 800) }}>
            {comp.tracks.map(track => (
              <div key={track.id} className="h-12 border-b border-surface-700 relative">
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent ' + (zoom - 1) + 'px, #6366f1 ' + zoom + 'px)' }} />
                {track.clips.map(clip => {
                  const left = timeToPx(clip.start);
                  const width = Math.max(timeToPx(clip.duration), 4);
                  const isSelected = selectedClipId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      className={`absolute top-1 h-10 rounded-md border ${clipColor(clip.type)} ${isSelected ? 'ring-2 ring-white/50 z-10' : ''} ${track.locked ? 'cursor-not-allowed' : 'cursor-move'} overflow-hidden`}
                      style={{ left, width }}
                      onMouseDown={(e) => onClipMouseDown(e, clip, track, 'move')}
                      onClick={(e) => { e.stopPropagation(); selectClip(clip.id); }}
                    >
                      {!track.locked && (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/20 z-20" onMouseDown={(e) => onClipMouseDown(e, clip, track, 'resize-left')} />
                          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/20 z-20" onMouseDown={(e) => onClipMouseDown(e, clip, track, 'resize-right')} />
                        </>
                      )}
                      <div className="px-2 py-1 pointer-events-none">
                        <div className="text-[10px] font-medium text-white truncate">{clip.name}</div>
                        <div className="text-[9px] text-white/60">{formatTime(clip.duration)}</div>
                      </div>
                      {isSelected && <div className="absolute inset-0 border-2 border-white/30 rounded-md pointer-events-none" />}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Playhead — draggable */}
            <div
              className="absolute top-0 bottom-0 z-30 flex flex-col items-center"
              style={{ left: playheadLeft, transform: 'translateX(-50%)', width: 16, cursor: 'ew-resize' }}
              onMouseDown={onPlayheadMouseDown}
            >
              {/* Visible line */}
              <div className="w-px h-full bg-red-500" />
              {/* Triangle handle */}
              <div className="absolute -top-0.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500" />
              {/* Wider invisible grab area */}
              <div className="absolute top-0 bottom-0 w-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
