import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditor } from '../EditorContext';
import { evalProp, makeTransform, findClip } from '../types';
import type { Clip } from '../types';
import {
  renderFrame, resolveClipTransform, getSelectionBox, pointInSelection,
} from '../render';
import type { SelectionBox } from '../render';
import { mediaCacheMap } from '../mediaCache';
import {
  Maximize2, Grid3X3, ZoomIn, ZoomOut, Scan,
} from 'lucide-react';
import PathEditor from './PathEditor';

type HandleId = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate';

const DRAG_THRESHOLD = 4;

export default function Preview() {
  const {
    state, selectClip, addClip, updateClipProperty, setToolMode,
    setTransformValues, setShowGrid,
  } = useEditor();
  const { currentTime, isPlaying, project, toolMode, selectedClipId, showGrid } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const comp = project.compositions.find(c => c.id === project.activeCompositionId)!;
  const [previewScale, setPreviewScale] = useState(0.35);
  const userZoomed = useRef(false);

  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const [hoverHandle, setHoverHandle] = useState<HandleId | null>(null);

  const dragRef = useRef<{
    clipId: string;
    mode: HandleId;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origSX: number;
    origSY: number;
    origRot: number;
    centerX: number;
    centerY: number;
    startDist: number;
    started: boolean;
  } | null>(null);

  const assetCache = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());

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
    userZoomed.current = false;
    setPreviewScale(Math.max(0.08, Math.min(sx, sy, 2)));
  }, [comp.width, comp.height]);

  useEffect(() => {
    fitToView();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!userZoomed.current) fitToView();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToView]);

  const bumpZoom = (delta: number) => {
    userZoomed.current = true;
    setPreviewScale(s => Math.max(0.08, Math.min(2, s + delta)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = comp.width;
    canvas.height = comp.height;

    assetCache.current = mediaCacheMap(project.assets);

    if (!isPlaying) {
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
    }

    renderFrame(ctx, currentTime, comp, project, assetCache.current, {
      showGrid,
      showSafeZones: true,
      selectedClipId: toolMode === 'pen' ? null : selectedClipId,
    });
  }, [currentTime, isPlaying, comp, project, showGrid, selectedClipId, toolMode]);

  const canvasToComp = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const selectionFor = useCallback((clip: Clip): SelectionBox => {
    return getSelectionBox(clip, currentTime, comp.width, comp.height, comp, getAsset);
  }, [currentTime, comp, getAsset]);

  const handleAt = useCallback((px: number, py: number, clip: Clip): HandleId | null => {
    if (clip.type === 'path' || clip.type === 'audio') {
      const box = selectionFor(clip);
      return pointInSelection(px, py, box) ? 'move' : null;
    }
    const box = selectionFor(clip);
    const thresh = 10 / previewScale;
    if (Math.hypot(px - box.rotateHandle.x, py - box.rotateHandle.y) <= thresh) return 'rotate';
    for (const c of box.corners) {
      if (Math.hypot(px - c.x, py - c.y) <= thresh) return c.id;
    }
    if (pointInSelection(px, py, box)) return 'move';
    return null;
  }, [selectionFor, previewScale]);

  const hitTest = useCallback((clickX: number, clickY: number): Clip | null => {
    const t = currentTime;
    const visible: Clip[] = [];
    const anySolo = comp.tracks.some(tr => tr.solo);
    for (const track of comp.tracks) {
      if (!track.visible || track.locked) continue;
      if (anySolo && !track.solo) continue;
      for (const clip of track.clips) {
        if (t >= clip.start && t < clip.start + clip.duration) visible.push(clip);
      }
    }
    for (let i = visible.length - 1; i >= 0; i--) {
      const clip = visible[i];
      if (handleAt(clickX, clickY, clip)) return clip;
    }
    return null;
  }, [currentTime, comp, handleAt]);

  const startEditText = (clip: Clip) => {
    setEditingClipId(clip.id);
    setEditValue(clip.textContent || '');
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolMode === 'pen') return;
    const { x: clickX, y: clickY } = canvasToComp(e);

    if (toolMode === 'text') {
      const centerRelativeX = clickX - comp.width / 2;
      const centerRelativeY = clickY - comp.height / 2;
      const transform = makeTransform(centerRelativeX, centerRelativeY);
      const clipId = addClip(undefined, 'text', currentTime, 5, undefined, transform);
      selectClip(clipId);
      setEditingClipId(clipId);
      setEditValue('Frame Lab');
      setToolMode('pointer');
      return;
    }

    if (toolMode === 'shape') {
      const centerRelativeX = clickX - comp.width / 2;
      const centerRelativeY = clickY - comp.height / 2;
      const transform = makeTransform(centerRelativeX, centerRelativeY);
      const clipId = addClip(undefined, 'shape', currentTime, 5, undefined, transform);
      selectClip(clipId);
      setToolMode('pointer');
      return;
    }

    if (selectedClipId) {
      const selected = findClip(comp, selectedClipId);
      if (selected) {
        const handle = handleAt(clickX, clickY, selected);
        if (handle) {
          const t = currentTime - selected.start;
          const box = selectionFor(selected);
          dragRef.current = {
            clipId: selected.id,
            mode: handle,
            startX: clickX,
            startY: clickY,
            origX: evalProp(selected.transform.x, t),
            origY: evalProp(selected.transform.y, t),
            origSX: evalProp(selected.transform.scaleX, t),
            origSY: evalProp(selected.transform.scaleY, t),
            origRot: evalProp(selected.transform.rotation, t),
            centerX: box.cx,
            centerY: box.cy,
            startDist: Math.max(8, Math.hypot(clickX - box.cx, clickY - box.cy)),
            started: false,
          };
          return;
        }
      }
    }

    const hit = hitTest(clickX, clickY);
    if (hit) {
      selectClip(hit.id);
      const t = currentTime - hit.start;
      const box = selectionFor(hit);
      dragRef.current = {
        clipId: hit.id,
        mode: 'move',
        startX: clickX,
        startY: clickY,
        origX: evalProp(hit.transform.x, t),
        origY: evalProp(hit.transform.y, t),
        origSX: evalProp(hit.transform.scaleX, t),
        origSY: evalProp(hit.transform.scaleY, t),
        origRot: evalProp(hit.transform.rotation, t),
        centerX: box.cx,
        centerY: box.cy,
        startDist: Math.max(8, Math.hypot(clickX - box.cx, clickY - box.cy)),
        started: false,
      };
    } else {
      selectClip(null);
    }
  }, [toolMode, canvasToComp, comp, currentTime, addClip, selectClip, setToolMode, hitTest, selectedClipId, handleAt, selectionFor]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolMode !== 'pointer') return;
    const { x, y } = canvasToComp(e);
    const hit = hitTest(x, y);
    if (hit?.type === 'text') {
      selectClip(hit.id);
      startEditText(hit);
    }
  }, [toolMode, canvasToComp, hitTest, selectClip]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { x, y } = canvasToComp(e);
      const drag = dragRef.current;
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      if (!drag.started) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        drag.started = true;
      }

      if (drag.mode === 'move') {
        let mx = dx;
        let my = dy;
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) my = 0;
          else mx = 0;
        }
        setTransformValues(drag.clipId, {
          x: drag.origX + mx,
          y: drag.origY + my,
        });
        return;
      }

      if (drag.mode === 'rotate') {
        const a0 = Math.atan2(drag.startY - drag.centerY, drag.startX - drag.centerX);
        const a1 = Math.atan2(y - drag.centerY, x - drag.centerX);
        let deg = drag.origRot + ((a1 - a0) * 180) / Math.PI;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        setTransformValues(drag.clipId, { rotation: deg });
        return;
      }

      const dist = Math.max(8, Math.hypot(x - drag.centerX, y - drag.centerY));
      let factor = dist / drag.startDist;
      if (e.altKey) factor = 1 + (factor - 1) * 0.5;
      let sx = Math.max(0.02, drag.origSX * factor);
      let sy = Math.max(0.02, drag.origSY * factor);
      if (e.shiftKey) {
        const u = (sx / drag.origSX + sy / drag.origSY) / 2;
        sx = drag.origSX * u;
        sy = drag.origSY * u;
      }
      setTransformValues(drag.clipId, { scaleX: sx, scaleY: sy });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [canvasToComp, setTransformValues]);

  const onCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolMode !== 'pointer' || dragRef.current) return;
    if (!selectedClipId) {
      setHoverHandle(null);
      return;
    }
    const clip = findClip(comp, selectedClipId);
    if (!clip) {
      setHoverHandle(null);
      return;
    }
    const { x, y } = canvasToComp(e);
    setHoverHandle(handleAt(x, y, clip));
  };

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

  const cursor = (() => {
    if (toolMode === 'text' || toolMode === 'shape' || toolMode === 'pen') return 'crosshair';
    if (hoverHandle === 'rotate') return 'grab';
    if (hoverHandle === 'nw' || hoverHandle === 'se') return 'nwse-resize';
    if (hoverHandle === 'ne' || hoverHandle === 'sw') return 'nesw-resize';
    if (hoverHandle === 'move') return 'move';
    return 'default';
  })();

  return (
    <div className="flex flex-col h-full bg-surface-900 relative" ref={containerRef}>
      <div className="h-8 bg-surface-800 border-b border-surface-600 flex items-center px-3 gap-2 shrink-0">
        <span className="text-[10px] text-slate-500 font-mono">{comp.width}×{comp.height}</span>
        <div className="w-px h-4 bg-surface-600" />
        <button onClick={() => bumpZoom(-0.08)} className="text-slate-400 hover:text-white" title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] text-slate-500 w-10 text-center">{Math.round(previewScale * 100)}%</span>
        <button onClick={() => bumpZoom(0.08)} className="text-slate-400 hover:text-white" title="Zoom in">
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
            onDoubleClick={handleDoubleClick}
            onMouseMove={onCanvasMove}
            onMouseLeave={() => setHoverHandle(null)}
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
