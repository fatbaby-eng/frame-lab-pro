import { evalProp, drawPath, getPathPosition, getPathTangent } from './types';
import type { Clip, Composition, Project, Asset } from './types';

export interface RenderOptions {
  showGrid?: boolean;
  showSafeZones?: boolean;
}

/**
 * Render a single frame of the composition at a given time.
 * This is a standalone renderer used for both preview and export.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  time: number,
  comp: Composition,
  project: Project,
  assetCache: Map<string, HTMLImageElement | HTMLVideoElement>,
  options: RenderOptions = {}
) {
  const { showGrid = false, showSafeZones = false } = options;
  const cw = comp.width;
  const ch = comp.height;

  // Clear
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, cw, ch);

  // Draw grid
  if (showGrid) {
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < cw; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
    }
    for (let y = 0; y < ch; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
    }
    ctx.strokeStyle = '#6366f122';
    ctx.beginPath(); ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2); ctx.stroke();
  }

  // Safe zones
  if (showSafeZones) {
    ctx.strokeStyle = '#ffffff10';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const safeMargin = 0.05;
    ctx.strokeRect(cw * safeMargin, ch * safeMargin, cw * (1 - safeMargin * 2), ch * (1 - safeMargin * 2));
    ctx.setLineDash([]);
  }

  // Collect visible clips
  const visibleClips: { clip: Clip; trackIndex: number }[] = [];
  for (let ti = comp.tracks.length - 1; ti >= 0; ti--) {
    const track = comp.tracks[ti];
    if (!track.visible) continue;
    for (const clip of track.clips) {
      if (time >= clip.start && time < clip.start + clip.duration) {
        visibleClips.push({ clip, trackIndex: ti });
      }
    }
  }
  visibleClips.sort((a, b) => b.trackIndex - a.trackIndex);

  const getAsset = (id: string): Asset | undefined => project.assets.find(a => a.id === id);

  for (const { clip } of visibleClips) {
    renderClip(ctx, clip, time, cw, ch, comp, assetCache, getAsset);
  }
}

function renderClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  currentTime: number,
  cw: number,
  ch: number,
  comp: Composition,
  assetCache: Map<string, HTMLImageElement | HTMLVideoElement>,
  getAsset: (id: string) => Asset | undefined
) {
  const t = currentTime - clip.start;

  let x = evalProp(clip.transform.x, t);
  let y = evalProp(clip.transform.y, t);
  const scaleX = evalProp(clip.transform.scaleX, t);
  const scaleY = evalProp(clip.transform.scaleY, t);
  let rotation = evalProp(clip.transform.rotation, t);
  const opacity = evalProp(clip.transform.opacity, t);

  // Motion path override
  if (clip.motionPathClipId) {
    const pathClip = comp.tracks.flatMap(tr => tr.clips).find(c => c.id === clip.motionPathClipId && c.type === 'path');
    if (pathClip?.pathData && pathClip.pathData.points.length >= 2) {
      const progress = Math.max(0, Math.min(t / clip.duration, 1));
      const pos = getPathPosition(pathClip.pathData, progress);
      const tangent = getPathTangent(pathClip.pathData, progress);
      if (pos) {
        x = pos.x - cw / 2;
        y = pos.y - ch / 2;
      }
      if (tangent !== null) {
        rotation += tangent;
      }
    }
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(cw / 2 + x, ch / 2 + y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scaleX, scaleY);

  switch (clip.type) {
    case 'video': {
      if (clip.assetId) {
        const video = assetCache.get(clip.assetId) as HTMLVideoElement | undefined;
        if (video && video.readyState >= 2) {
          const asset = getAsset(clip.assetId);
          const w = asset?.width || video.videoWidth || cw;
          const h = asset?.height || video.videoHeight || ch;
          ctx.drawImage(video, -w / 2, -h / 2, w, h);
        }
      }
      break;
    }
    case 'image': {
      if (clip.assetId) {
        const img = assetCache.get(clip.assetId) as HTMLImageElement | undefined;
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
      if (clip.meshWireframe) {
        ctx.strokeStyle = '#ffffffaa';
        ctx.beginPath();
        ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2);
        ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2);
        ctx.stroke();
      }
      break;
    }
    case 'audio': {
      const barCount = 20;
      const barW = 6;
      const gap = 3;
      const totalW = barCount * (barW + gap);
      ctx.fillStyle = '#22c55e88';
      for (let i = 0; i < barCount; i++) {
        const h = 10 + Math.sin(currentTime * 10 + i * 0.5) * 20;
        const bx = -totalW / 2 + i * (barW + gap);
        ctx.fillRect(bx, -h / 2, barW, h);
      }
      break;
    }
    case 'path': {
      if (clip.pathData && clip.pathData.points.length >= 2) {
        ctx.strokeStyle = clip.pathStrokeColor || '#6366f1';
        ctx.lineWidth = clip.pathStrokeWidth || 3;
        ctx.fillStyle = clip.pathFillColor || 'transparent';
        drawPath(ctx, clip.pathData);
        if (clip.pathFillColor && clip.pathFillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}
