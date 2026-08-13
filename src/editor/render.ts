import {
  evalTransform, drawPath, getPathPosition, getPathTangent, findClip,
} from './types';
import type { Clip, Composition, Project, Asset, WorldTransform, LayerEffect } from './types';

export interface RenderOptions {
  showGrid?: boolean;
  showSafeZones?: boolean;
  selectedClipId?: string | null;
}

/**
 * Render a single frame of the composition at a given time.
 * Used for both preview and export.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  time: number,
  comp: Composition,
  project: Project,
  assetCache: Map<string, HTMLImageElement | HTMLVideoElement>,
  options: RenderOptions = {}
) {
  const { showGrid = false, showSafeZones = false, selectedClipId = null } = options;
  const cw = comp.width;
  const ch = comp.height;

  ctx.fillStyle = comp.backgroundColor || '#0a0a0f';
  ctx.fillRect(0, 0, cw, ch);

  if (showGrid) {
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < cw; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
    }
    for (let y = 0; y < ch; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, ch); ctx.stroke();
    }
    ctx.strokeStyle = '#6366f122';
    ctx.beginPath(); ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2); ctx.stroke();
  }

  if (showSafeZones) {
    ctx.strokeStyle = '#ffffff10';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const safeMargin = 0.05;
    ctx.strokeRect(cw * safeMargin, ch * safeMargin, cw * (1 - safeMargin * 2), ch * (1 - safeMargin * 2));
    ctx.setLineDash([]);
  }

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

  if (selectedClipId) {
    const selected = visibleClips.find(v => v.clip.id === selectedClipId);
    if (selected) {
      drawSelection(ctx, selected.clip, time, cw, ch, comp);
    }
  }
}

export function resolveClipTransform(
  clip: Clip,
  currentTime: number,
  cw: number,
  ch: number,
  comp: Composition,
  visited: Set<string> = new Set()
): WorldTransform {
  const t = currentTime - clip.start;
  const local = evalTransform(clip.transform, t);

  if (clip.motionPathClipId) {
    const pathClip = findClip(comp, clip.motionPathClipId);
    if (pathClip?.type === 'path' && pathClip.pathData && pathClip.pathData.points.length >= 2) {
      const progress = Math.max(0, Math.min(t / clip.duration, 1));
      const pos = getPathPosition(pathClip.pathData, progress);
      const tangent = getPathTangent(pathClip.pathData, progress);
      if (pos) {
        local.x = pos.x - cw / 2;
        local.y = pos.y - ch / 2;
      }
      if (tangent !== null) {
        local.rotation += tangent;
      }
    }
  }

  if (clip.parentId && !visited.has(clip.id)) {
    visited.add(clip.id);
    const parent = findClip(comp, clip.parentId);
    if (parent) {
      const p = resolveClipTransform(parent, currentTime, cw, ch, comp, visited);
      const rad = (p.rotation * Math.PI) / 180;
      const rx = local.x * Math.cos(rad) - local.y * Math.sin(rad);
      const ry = local.x * Math.sin(rad) + local.y * Math.cos(rad);
      return {
        x: p.x + rx * p.scaleX,
        y: p.y + ry * p.scaleY,
        scaleX: local.scaleX * p.scaleX,
        scaleY: local.scaleY * p.scaleY,
        rotation: local.rotation + p.rotation,
        opacity: local.opacity * p.opacity,
        anchorX: local.anchorX,
        anchorY: local.anchorY,
      };
    }
  }

  return local;
}

export function clipHitRadius(clip: Clip, getAsset: (id: string) => Asset | undefined): number {
  switch (clip.type) {
    case 'text':
      return Math.max((clip.textContent?.length || 5) * (clip.textStyle?.fontSize || 48) * 0.28, 36);
    case 'shape':
      return 55;
    case 'mesh3d':
      return 50;
    case 'audio':
      return 70;
    case 'path':
      return 40;
    case 'video':
    case 'image': {
      const asset = clip.assetId ? getAsset(clip.assetId) : null;
      return Math.max(asset?.width || 400, asset?.height || 300) / 2;
    }
    default:
      return 50;
  }
}

function applyEffects(ctx: CanvasRenderingContext2D, effects?: LayerEffect[]) {
  if (!effects?.length) {
    ctx.filter = 'none';
    return;
  }
  const parts: string[] = [];
  for (const e of effects) {
    switch (e.type) {
      case 'blur': parts.push(`blur(${Math.max(0, e.amount)}px)`); break;
      case 'brightness': parts.push(`brightness(${e.amount / 100})`); break;
      case 'contrast': parts.push(`contrast(${e.amount / 100})`); break;
      case 'saturate': parts.push(`saturate(${e.amount / 100})`); break;
    }
  }
  ctx.filter = parts.join(' ') || 'none';
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
  const xf = resolveClipTransform(clip, currentTime, cw, ch, comp);

  ctx.save();
  ctx.globalAlpha = xf.opacity;
  applyEffects(ctx, clip.effects);
  ctx.translate(cw / 2 + xf.x, ch / 2 + xf.y);
  ctx.rotate((xf.rotation * Math.PI) / 180);
  ctx.scale(xf.scaleX, xf.scaleY);
  ctx.translate(-xf.anchorX, -xf.anchorY);

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
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = strokeWidth;
      switch (clip.shapeType) {
        case 'rect':
          ctx.fillRect(-size / 2, -size / 2, size, size);
          if (strokeWidth > 0) ctx.strokeRect(-size / 2, -size / 2, size, size);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          ctx.fill();
          if (strokeWidth > 0) ctx.stroke();
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -size / 2);
          ctx.lineTo(size / 2, size / 2);
          ctx.lineTo(-size / 2, size / 2);
          ctx.closePath();
          ctx.fill();
          if (strokeWidth > 0) ctx.stroke();
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
          if (strokeWidth > 0) ctx.stroke();
          break;
        }
      }
      break;
    }
    case 'mesh3d': {
      drawMeshPlaceholder(ctx, clip.meshShape || 'cube', clip.meshColor || '#6366f1', !!clip.meshWireframe);
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
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = xf.opacity;
      applyEffects(ctx, clip.effects);
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

function drawSelection(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  time: number,
  cw: number,
  ch: number,
  comp: Composition
) {
  const xf = resolveClipTransform(clip, time, cw, ch, comp);
  const cx = cw / 2 + xf.x;
  const cy = ch / 2 + xf.y;
  const size = 110 * Math.max(xf.scaleX, xf.scaleY);
  ctx.save();
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
  ctx.setLineDash([]);
  ctx.fillStyle = '#818cf8';
  const hs = 5;
  for (const [hx, hy] of [
    [cx - size / 2, cy - size / 2],
    [cx + size / 2, cy - size / 2],
    [cx - size / 2, cy + size / 2],
    [cx + size / 2, cy + size / 2],
  ] as const) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }
  ctx.restore();
}

function drawMeshPlaceholder(
  ctx: CanvasRenderingContext2D,
  shape: string,
  color: string,
  wireframe: boolean
) {
  ctx.fillStyle = color;
  ctx.strokeStyle = wireframe ? '#ffffffcc' : '#ffffff66';
  ctx.lineWidth = 1.5;
  const s = 70;

  if (shape === 'sphere') {
    ctx.beginPath();
    ctx.ellipse(0, 0, s / 2, s / 2, 0, 0, Math.PI * 2);
    if (!wireframe) ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, s / 2, s / 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (shape === 'cone') {
    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.lineTo(s / 2, s / 2);
    ctx.lineTo(-s / 2, s / 2);
    ctx.closePath();
    if (!wireframe) ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, s / 2, s / 2, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (shape === 'torus') {
    ctx.beginPath();
    ctx.ellipse(0, 0, s / 2, s / 3, 0, 0, Math.PI * 2);
    if (!wireframe) ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, s / 4, s / 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  const dx = 28;
  const dy = 16;
  ctx.beginPath();
  ctx.moveTo(0, -s / 2);
  ctx.lineTo(dx, -s / 2 + dy);
  ctx.lineTo(dx, s / 2 - dy);
  ctx.lineTo(0, s / 2);
  ctx.lineTo(-dx, s / 2 - dy);
  ctx.lineTo(-dx, -s / 2 + dy);
  ctx.closePath();
  if (!wireframe) ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -s / 2); ctx.lineTo(0, s / 2);
  ctx.moveTo(0, -s / 2); ctx.lineTo(dx, -s / 2 + dy);
  ctx.moveTo(0, -s / 2); ctx.lineTo(-dx, -s / 2 + dy);
  ctx.stroke();
}
