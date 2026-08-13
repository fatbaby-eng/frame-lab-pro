import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditor } from '../EditorContext';
import { evalProp, makeTransform, findClip } from '../types';
import type { Clip } from '../types';
import { renderFrame, resolveClipTransform, clipHitRadius } from '../render';
import {
  Maximize2, Grid3X3, ZoomIn, ZoomOut, Scan,
} from 'lucide-react';
import PathEditor from './PathEditor';

export default function Preview() {
  const {
    state, selectClip, addClip, updateClipProperty, setToolMode,
    setTransformValues, setShowGrid,
  } = useEditor();
  const { currentTime, project, toolMode, selectedClipId, showGrid } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const comp = project.compositions.find(c => c.id === project.activeCompositionId)!;
  const [previewScale, setPreviewScale] = useState(0.35);

  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const dragRef = useRef<{
    clipId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const assetCache = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());

  useEffect(() => {
    project.assets.forEach(asset => {
      if (assetCache.current.has(asset.id)) return;
      if (asset.type === 'video') {
        const video = document.createElement('video');
        video.src = asset.url;
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        assetCache.current.set(asset.id, video);
      } else if (asset.type === 'image') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = asset.url;
        assetCache.current.set(asset.id, img);
      }
    });
  }, [project.assets]);

  const getAsset = useCallback((id: string) => {
    return project.assets.find(a => a.id === id);
  }, [project.assets]);

  useEffect(() => {
    if (editingClipId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingClipId]);

  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pad = 48;
    const sx = (el.clientWidth - pad) / comp.width;
    const sy = (el.clientHeight - pad) / comp.height;
    setPreviewScale(Math.max(0.08, Math.min(sx, sy, 2)));
  }, [comp.width, comp.height]);

  useEffect(() => {
    fitToView();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitToView());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = comp.width;
    canvas.height = comp.height;

    for (const track of comp.tracks) {
      if (!track.visible) continue;
      for (const clip of track.clips) {
        if (clip.type !== 'video' || !clip.assetId) continue;
        if (currentTime < clip.start || currentTime >= clip.start + clip.duration) continue;
        const video = assetCache.current.get(clip.assetId) as HTMLVideoElement | undefined;
        if (!video) continue;
        const sourceTime = clip.sourceStart + (currentTime - clip.start);
        if (Math.abs(video.currentTime - sourceTime) > 0.04) {
          video.currentTime = sourceTime;
        }
      }
    }

    renderFrame(ctx, currentTime, comp, project, assetCache.current, {
      showGrid,
      showSafeZones: true,
      selectedClipId: toolMode === 'pen' ? null : selectedClipId,
    });
  }, [currentTime, comp, project, showGrid, selectedClipId, toolMode]);

  const canvasToComp = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const hitTest = useCallback((clickX: number, clickY: number): Clip | null => {
    const t = currentTime;
    const cw = comp.width;
    const ch = comp.height;
    const visible: Clip[] = [];
    for (let ti = 0; ti < comp.tracks.length; ti++) {
      const track = comp.tracks[ti];
      if (!track.visible || track.locked) continue;
      for (const clip of track.clips) {
        if (t >= clip.start && t < clip.start + clip.duration) visible.push(clip);
      }
    }
    for (let i = visible.length - 1; i >= 0; i--) {
      const clip = visible[i];
      const xf = resolveClipTransform(clip, t, cw, ch, comp);
      const cx = cw / 2 + xf.x;
      const cy = ch / 2 + xf.y;
      const radius = clipHitRadius(clip, getAsset) * Math.max(xf.scaleX, xf.scaleY);
      const dist = Math.hypot(clickX - cx, clickY - cy);
      if (dist <= radius) return clip;
    }
    return null;
  }, [currentTime, comp, getAsset]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolMode === 'pen') return;
    const { x: clickX, y: clickY } = canvasToComp(e);

    if (toolMode === 'text') {
      const centerRelativeX = clickX - comp.width / 2;
      const centerRelativeY = clickY - comp.height / 2;
      const textTrack = comp.tracks.find(t => t.type === 'text' && !t.locked)
        ?? comp.tracks.find(t => t.type === 'text');
      if (!textTrack) return;
      const transform = makeTransform(centerRelativeX, centerRelativeY);
      const clipId = addClip(textTrack.id, 'text', currentTime, 5, undefined, transform);
      selectClip(clipId);
      setEditingClipId(clipId);
      setEditValue('Frame Lab');
      setToolMode('pointer');
      return;
    }

    if (toolMode === 'shape') {
      const centerRelativeX = clickX - comp.width / 2;
      const centerRelativeY = clickY - comp.height / 2;
      const shapeTrack = comp.tracks.find(t => t.type === 'shape' && !t.locked)
        ?? comp.tracks.find(t => t.type === 'shape');
      if (!shapeTrack) return;
      const transform = makeTransform(centerRelativeX, centerRelativeY);
      const clipId = addClip(shapeTrack.id, 'shape', currentTime, 5, undefined, transform);
      selectClip(clipId);
      setToolMode('pointer');
      return;
    }

    const hit = hitTest(clickX, clickY);
    if (hit) {
      selectClip(hit.id);
      const t = currentTime - hit.start;
      dragRef.current = {
        clipId: hit.id,
        startX: clickX,
        startY: clickY,
        origX: evalProp(hit.transform.x, t),
        origY: evalProp(hit.transform.y, t),
      };
    } else {
      selectClip(null);
    }
  }, [toolMode, canvasToComp, comp, currentTime, addClip, selectClip, setToolMode, hitTest]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { x, y } = canvasToComp(e);
      const dx = x - dragRef.current.startX;
      const dy = y - dragRef.current.startY;
      setTransformValues(dragRef.current.clipId, {
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [canvasToComp, setTransformValues]);

  const getEditInputPosition = useCallback(() => {
    if (!editingClipId || !canvasRef.current) return null;
    const clip = findClip(comp, editingClipId);
    if (!clip) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const xf = resolveClipTransform(clip, currentTime, comp.width, comp.height, comp);
    const canvasX = comp.width / 2 + xf.x;
    const canvasY = comp.height / 2 + xf.y;
    const screenX = rect.left + canvasX * (rect.width / comp.width);
    const screenY = rect.top + canvasY * (rect.height / comp.height);
    const fontSize = (clip.textStyle?.fontSize || 48) * (rect.width / comp.width);
    return { left: screenX, top: screenY, fontSize };
  }, [editingClipId, comp, currentTime]);

  const editPos = getEditInputPosition();

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditValue(val);
    if (editingClipId) updateClipProperty(editingClipId, 'textContent', val);
  };

  const finishEditing = () => {
    setEditingClipId(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') finishEditing();
  };

  const cursor =
    toolMode === 'text' || toolMode === 'shape' || toolMode === 'pen' ? 'crosshair'
    : 'default';

  return (
    <div className="flex flex-col h-full bg-surface-900 relative" ref={containerRef}>
      <div className="h-8 bg-surface-800 border-b border-surface-600 flex items-center px-3 gap-2 shrink-0">
        <span className="text-[10px] text-slate-500 font-mono">{comp.width}×{comp.height}</span>
        <div className="w-px h-4 bg-surface-600" />
        <button onClick={() => setPreviewScale(s => Math.max(0.08, s - 0.08))} className="text-slate-400 hover:text-white" title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] text-slate-500 w-10 text-center">{Math.round(previewScale * 100)}%</span>
        <button onClick={() => setPreviewScale(s => Math.min(2, s + 0.08))} className="text-slate-400 hover:text-white" title="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button onClick={fitToView} className="text-slate-400 hover:text-white" title="Fit composition">
          <Scan size={13} />
        </button>
        <div className="w-px h-4 bg-surface-600" />
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`text-xs px-1.5 py-0.5 rounded ${showGrid ? 'bg-accent/20 text-accent-light' : 'text-slate-500'}`}
          title="Toggle grid"
        >
          <Grid3X3 size={12} />
        </button>
        <div className="ml-auto" />
        <button
          onClick={() => { containerRef.current?.requestFullscreen?.(); }}
          className="text-slate-400 hover:text-white"
          title="Fullscreen"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        <div
          ref={stageRef}
          className="relative shrink-0"
          style={{
            width: comp.width * previewScale,
            height: comp.height * previewScale,
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            style={{
              width: '100%',
              height: '100%',
              imageRendering: 'auto',
              cursor,
            }}
            className="rounded-lg border border-surface-600 shadow-2xl block"
          />
          <PathEditor compWidth={comp.width} compHeight={comp.height} />
        </div>
      </div>

      {editingClipId && editPos && (
        <input
          ref={editInputRef}
          type="text"
          value={editValue}
          onChange={handleEditChange}
          onBlur={finishEditing}
          onKeyDown={handleEditKeyDown}
          className="fixed z-50 bg-transparent text-white outline-none border-none px-0 py-0 whitespace-nowrap"
          style={{
            left: editPos.left,
            top: editPos.top,
            fontSize: `${editPos.fontSize}px`,
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1,
            transform: 'translate(-50%, -50%)',
            minWidth: '20px',
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
          }}
          spellCheck={false}
        />
      )}
    </div>
  );
}
