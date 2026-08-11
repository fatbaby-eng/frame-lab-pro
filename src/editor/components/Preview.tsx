import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditor } from '../EditorContext';
import { evalProp } from '../types';
import type { Clip, Asset } from '../types';
import {
  Maximize2, Grid3X3, ZoomIn, ZoomOut,
} from 'lucide-react';

export default function Preview() {
  const { state, selectClip } = useEditor();
  const { currentTime, project } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const comp = project.compositions.find(c => c.id === project.activeCompositionId)!;
  const [previewScale, setPreviewScale] = useState(0.5);
  const [showGridOverlay, setShowGridOverlay] = useState(true);

  // Asset cache
  const assetCache = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());

  // Load assets into cache
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

  // Find asset by ID
  const getAsset = useCallback((id: string): Asset | undefined => {
    return project.assets.find(a => a.id === id);
  }, [project.assets]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to composition size
    canvas.width = comp.width;
    canvas.height = comp.height;

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid if enabled
    if (showGridOverlay) {
      ctx.strokeStyle = '#1e1e2e';
      ctx.lineWidth = 1;
      const gridSize = 50;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      // Center crosshair
      ctx.strokeStyle = '#6366f122';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
    }

    // Safe zones
    ctx.strokeStyle = '#ffffff10';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const safeMargin = 0.05;
    ctx.strokeRect(
      canvas.width * safeMargin,
      canvas.height * safeMargin,
      canvas.width * (1 - safeMargin * 2),
      canvas.height * (1 - safeMargin * 2)
    );
    ctx.setLineDash([]);

    // Render clips from bottom to top (tracks are ordered bottom-up)
    // We iterate in reverse so top tracks render last
    const visibleClips: { clip: Clip; trackIndex: number }[] = [];

    for (let ti = comp.tracks.length - 1; ti >= 0; ti--) {
      const track = comp.tracks[ti];
      if (!track.visible) continue;

      for (const clip of track.clips) {
        if (currentTime >= clip.start && currentTime < clip.start + clip.duration) {
          visibleClips.push({ clip, trackIndex: ti });
        }
      }
    }

    // Sort by track index so lower tracks render first
    visibleClips.sort((a, b) => b.trackIndex - a.trackIndex);

    for (const { clip } of visibleClips) {
      renderClip(ctx, clip, canvas.width, canvas.height);
    }

    // Timecode overlay
    ctx.fillStyle = '#ffffffaa';
    ctx.font = '14px monospace';
    const m = Math.floor(currentTime / 60);
    const s = Math.floor(currentTime % 60);
    const f = Math.floor((currentTime % 1) * comp.fps);
    ctx.fillText(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`, 12, canvas.height - 12);

    // Resolution overlay
    ctx.fillStyle = '#ffffff55';
    ctx.font = '11px monospace';
    ctx.fillText(`${comp.width}×${comp.height} @ ${comp.fps}fps`, 12, 22);
  }, [currentTime, comp, showGridOverlay, project.assets]);

  function renderClip(ctx: CanvasRenderingContext2D, clip: Clip, cw: number, ch: number) {
    const t = currentTime - clip.start;

    // Evaluate animated properties
    const x = evalProp(clip.transform.x, t);
    const y = evalProp(clip.transform.y, t);
    const scaleX = evalProp(clip.transform.scaleX, t);
    const scaleY = evalProp(clip.transform.scaleY, t);
    const rotation = evalProp(clip.transform.rotation, t);
    const opacity = evalProp(clip.transform.opacity, t);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cw / 2 + x, ch / 2 + y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);

    switch (clip.type) {
      case 'video': {
        if (clip.assetId) {
          const video = assetCache.current.get(clip.assetId) as HTMLVideoElement | undefined;
          if (video && video.readyState >= 2) {
            const asset = getAsset(clip.assetId);
            const sourceTime = clip.sourceStart + t;
            if (video.currentTime !== sourceTime && sourceTime < (asset?.duration || Infinity)) {
              video.currentTime = sourceTime;
            }
            const w = asset?.width || video.videoWidth || cw;
            const h = asset?.height || video.videoHeight || ch;
            ctx.drawImage(video, -w / 2, -h / 2, w, h);
          }
        }
        break;
      }
      case 'image': {
        if (clip.assetId) {
          const img = assetCache.current.get(clip.assetId) as HTMLImageElement | undefined;
          if (img && img.complete) {
            const asset = getAsset(clip.assetId);
            const w = asset?.width || img.naturalWidth || 400;
            const h = asset?.height || img.naturalHeight || 300;
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
          }
        }
        break;
      }
      case 'text': {
        if (clip.textContent && clip.textStyle) {
          const style = clip.textStyle;
          ctx.font = `${style.bold ? 'bold ' : ''}${style.italic ? 'italic ' : ''}${style.fontSize}px ${style.fontFamily}`;
          ctx.fillStyle = style.color;
          ctx.textAlign = style.align;
          ctx.textBaseline = 'middle';
          ctx.fillText(clip.textContent, 0, 0);
        }
        break;
      }
      case 'shape': {
        const shapeColor = clip.shapeColor || '#6366f1';
        const strokeWidth = clip.shapeStroke || 0;
        const size = 100;

        ctx.fillStyle = shapeColor;
        ctx.strokeStyle = shapeColor;
        ctx.lineWidth = strokeWidth;

        switch (clip.shapeType) {
          case 'rect':
            ctx.fillRect(-size / 2, -size / 2, size, size);
            break;
          case 'circle':
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'triangle':
            ctx.beginPath();
            ctx.moveTo(0, -size / 2);
            ctx.lineTo(size / 2, size / 2);
            ctx.lineTo(-size / 2, size / 2);
            ctx.closePath();
            ctx.fill();
            break;
          case 'star': {
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
              const r = i % 2 === 0 ? size / 2 : size / 4;
              const angle = (i * Math.PI) / 5 - Math.PI / 2;
              if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
              else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
        }
        if (strokeWidth > 0) ctx.stroke();
        break;
      }
      case 'mesh3d': {
        // Draw a placeholder shape for 3D mesh layers
        ctx.fillStyle = clip.meshColor || '#6366f1';
        ctx.strokeStyle = '#ffffff66';
        ctx.lineWidth = 2;
        const s = 80;
        ctx.beginPath();
        ctx.moveTo(-s / 2, -s / 2);
        ctx.lineTo(s / 2, -s / 2);
        ctx.lineTo(s / 2, s / 2);
        ctx.lineTo(-s / 2, s / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Wireframe overlay
        if (clip.meshWireframe) {
          ctx.strokeStyle = '#ffffffaa';
          ctx.beginPath();
          ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2);
          ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('3D: ' + (clip.meshShape || 'mesh'), 0, s / 2 + 16);
        break;
      }
      case 'audio': {
        // Draw audio visualization bar
        const barCount = 20;
        const barW = 6;
        const gap = 3;
        const totalW = barCount * (barW + gap);
        ctx.fillStyle = '#22c55e88';
        for (let i = 0; i < barCount; i++) {
          const h = 10 + Math.sin(currentTime * 10 + i * 0.5) * 20 + Math.random() * 10;
          const bx = -totalW / 2 + i * (barW + gap);
          ctx.fillRect(bx, -h / 2, barW, h);
        }
        ctx.fillStyle = '#22c55e';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AUDIO', 0, 30);
        break;
      }
    }

    ctx.restore();
  }

  // Click-to-select on canvas
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const t = currentTime;
    const cw = canvas.width;
    const ch = canvas.height;

    // Find visible clips at current time, topmost first
    const visibleClips: Clip[] = [];
    for (let ti = comp.tracks.length - 1; ti >= 0; ti--) {
      const track = comp.tracks[ti];
      if (!track.visible) continue;
      for (const clip of track.clips) {
        if (t >= clip.start && t < clip.start + clip.duration) {
          visibleClips.push(clip);
        }
      }
    }

    for (const clip of visibleClips) {
      const clipT = t - clip.start;
      const cx = cw / 2 + evalProp(clip.transform.x, clipT);
      const cy = ch / 2 + evalProp(clip.transform.y, clipT);
      const sx = evalProp(clip.transform.scaleX, clipT);
      const sy = evalProp(clip.transform.scaleY, clipT);

      // Approximate hit radius based on clip type
      let radius = 50;
      switch (clip.type) {
        case 'text':
          radius = Math.max((clip.textContent?.length || 5) * (clip.textStyle?.fontSize || 48) * 0.3, 30);
          break;
        case 'shape':
          radius = 50;
          break;
        case 'mesh3d':
          radius = 40;
          break;
        case 'audio':
          radius = 70;
          break;
        case 'video':
        case 'image': {
          const asset = clip.assetId ? getAsset(clip.assetId) : null;
          radius = Math.max(asset?.width || 400, asset?.height || 300) / 2;
          break;
        }
      }
      radius *= Math.max(sx, sy);

      const dist = Math.sqrt((clickX - cx) ** 2 + (clickY - cy) ** 2);
      if (dist <= radius) {
        selectClip(clip.id);
        return;
      }
    }

    // Clicked empty space — deselect
    selectClip(null);
  }, [currentTime, comp, selectClip, getAsset]);

  return (
    <div className="flex flex-col h-full bg-surface-900 relative" ref={containerRef}>
      {/* Toolbar */}
      <div className="h-8 bg-surface-800 border-b border-surface-600 flex items-center px-3 gap-2 shrink-0">
        <span className="text-[10px] text-slate-500 font-mono">{comp.width}×{comp.height}</span>
        <div className="w-px h-4 bg-surface-600" />
        <button
          onClick={() => setPreviewScale(s => Math.max(0.1, s - 0.1))}
          className="text-slate-400 hover:text-white"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] text-slate-500 w-10 text-center">{Math.round(previewScale * 100)}%</span>
        <button
          onClick={() => setPreviewScale(s => Math.min(2, s + 0.1))}
          className="text-slate-400 hover:text-white"
        >
          <ZoomIn size={14} />
        </button>
        <div className="w-px h-4 bg-surface-600" />
        <button
          onClick={() => setShowGridOverlay(!showGridOverlay)}
          className={`text-xs px-1.5 py-0.5 rounded ${showGridOverlay ? 'bg-accent/20 text-accent-light' : 'text-slate-500'}`}
        >
          <Grid3X3 size={12} />
        </button>
        <div className="ml-auto" />
        <button
          onClick={() => {
            if (containerRef.current?.requestFullscreen) {
              containerRef.current.requestFullscreen();
            }
          }}
          className="text-slate-400 hover:text-white"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Canvas container */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: comp.width * previewScale,
            height: comp.height * previewScale,
            imageRendering: 'auto',
          }}
          className="rounded-lg border border-surface-600 shadow-2xl"
        />
      </div>
    </div>
  );
}
