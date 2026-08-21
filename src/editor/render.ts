import {
  evalTransform, drawPath, getPathPosition, getPathTangent, findClip,
} from './types';
import type { Clip, Composition, Project, Asset, WorldTransform, LayerEffect } from './types';
import { renderMeshLayer, MESH_SPRITE } from './mesh3d';

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
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
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

  const anySolo = comp.tracks.some(t => t.solo);
  const visibleClips: { clip: Clip; trackIndex: number }[] = [];
  for (let ti = comp.tracks.length - 1; ti >= 0; ti--) {
    const track = comp.tracks[ti];
    if (!track.visible) continue;
    if (anySolo && !track.solo) continue;
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
      drawSelection(ctx, selected.clip, time, cw, ch, comp, getAsset);
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

export function clipLocalSize(clip: Clip, getAsset?: (id: string) => Asset | undefined): { w: number; h: number } {
  switch (clip.type) {
    case 'text': {
      const fs = clip.textStyle?.fontSize || 48;
      const len = Math.max(clip.textContent?.length || 1, 1);
      return { w: Math.max(len * fs * 0.56, fs), h: fs * 1.25 };
    }
    case 'shape':
      return { w: 100, h: 100 };
    case 'mesh3d':
      return { w: MESH_SPRITE, h: MESH_SPRITE };
    case 'video':
    case 'image': {
      const asset = clip.assetId && getAsset ? getAsset(clip.assetId) : null;
      return { w: asset?.width || 400, h: asset?.height || 300 };
    }
    default:
      return { w: 80, h: 80 };
  }
}

export interface SelectionBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
  corners: { id: 'nw' | 'ne' | 'sw' | 'se'; x: number; y: number }[];
  rotateHandle: { x: number; y: number };
}

export function getSelectionBox(
  clip: Clip,
  time: number,
  cw: number,
  ch: number,
  comp: Composition,
  getAsset?: (id: string) => Asset | undefined
): SelectionBox {
  const xf = resolveClipTransform(clip, time, cw, ch, comp);
  const { w: lw, h: lh } = clipLocalSize(clip, getAsset);
  const w = Math.max(24, lw * Math.abs(xf.scaleX));
  const h = Math.max(24, lh * Math.abs(xf.scaleY));
  const cx = cw / 2 + xf.x;
  const cy = ch / 2 + xf.y;
  const rad = (xf.rotation * Math.PI) / 180;
  const rot = (x: number, y: number) => ({
    x: cx + x * Math.cos(rad) - y * Math.sin(rad),
    y: cy + x * Math.sin(rad) + y * Math.cos(rad),
  });
  const hw = w / 2;
  const hh = h / 2;
  return {
    cx, cy, w, h, rotation: xf.rotation,
    corners: [
      { id: 'nw', ...rot(-hw, -hh) },
      { id: 'ne', ...rot(hw, -hh) },
      { id: 'sw', ...rot(-hw, hh) },
      { id: 'se', ...rot(hw, hh) },
    ],
    rotateHandle: rot(0, -hh - 28),
  };
}

export function pointInSelection(px: number, py: number, box: SelectionBox): boolean {
  const rad = (-box.rotation * Math.PI) / 180;
  const dx = px - box.cx;
  const dy = py - box.cy;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(lx) <= box.w / 2 && Math.abs(ly) <= box.h / 2;
}

export function clipHitRadius(clip: Clip, getAsset: (id: string) => Asset | undefined): number {
  const { w, h } = clipLocalSize(clip, getAsset);
  return Math.hypot(w, h) / 2;
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
      const sprite = renderMeshLayer(clip, currentTime - clip.start);
      if (sprite) {
        ctx.drawImage(sprite, -MESH_SPRITE / 2, -MESH_SPRITE / 2, MESH_SPRITE, MESH_SPRITE);
      }
      break;
    }
    case 'audio':
      break;
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
  comp: Composition,
  getAsset?: (id: string) => Asset | undefined
) {
  if (clip.type === 'path' || clip.type === 'audio') return;
  const box = getSelectionBox(clip, time, cw, ch, comp, getAsset);
  ctx.save();
  ctx.translate(box.cx, box.cy);
  ctx.rotate((box.rotation * Math.PI) / 180);
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(-box.w / 2, -box.h / 2, box.w, box.h);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, -box.h / 2);
  ctx.lineTo(0, -box.h / 2 - 28);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1.5;
  for (const c of box.corners) {
    ctx.beginPath();
    ctx.rect(c.x - 4, c.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(box.rotateHandle.x, box.rotateHandle.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

