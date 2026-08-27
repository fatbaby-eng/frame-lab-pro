import {
  evalTransform, drawPath, getPathPosition, getPathTangent, findClip, nestedCompTime,
  hydrateTextStyle,
} from './types';
import type { Clip, Composition, Project, Asset, WorldTransform, LayerEffect, CompAlign, TextStyle } from './types';
import { renderMeshLayer, MESH_SPRITE } from './mesh3d';

export interface RenderOptions {
  showGrid?: boolean;
  showSafeZones?: boolean;
  selectedClipId?: string | null;
  /** Skip drawing this clip's pixels (preview inline edit overlay). */
  hideClipId?: string | null;
  /** Skip overlays when drawing a nested composition. */
  nested?: boolean;
  visitedCompIds?: Set<string>;
}

const nestedCanvasCache = new Map<string, HTMLCanvasElement>();

function canvasForNested(clipId: string, width: number, height: number): HTMLCanvasElement {
  let canvas = nestedCanvasCache.get(clipId);
  if (!canvas) {
    canvas = document.createElement('canvas');
    nestedCanvasCache.set(clipId, canvas);
  }
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return canvas;
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
  const { showGrid = false, showSafeZones = false, selectedClipId = null, hideClipId = null, nested = false } = options;
  const visited = new Set(options.visitedCompIds);
  if (visited.has(comp.id)) return;
  visited.add(comp.id);

  const cw = comp.width;
  const ch = comp.height;

  ctx.fillStyle = comp.backgroundColor || '#0a0a0f';
  ctx.fillRect(0, 0, cw, ch);

  if (!nested && showGrid) {
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

  if (!nested && showSafeZones) {
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
    renderClip(ctx, clip, time, cw, ch, comp, project, assetCache, getAsset, visited, hideClipId);
  }

  if (!nested && selectedClipId) {
    const selected = visibleClips.find(v => v.clip.id === selectedClipId);
    if (selected) {
      drawSelection(ctx, selected.clip, time, cw, ch, comp, getAsset, project);
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

export interface TextLine {
  text: string;
  width: number;
  lastInPara: boolean;
}

export interface TextLayout {
  lines: TextLine[];
  width: number;
  height: number;
  style: TextStyle;
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

export function applyTextFont(ctx: CanvasRenderingContext2D, style: TextStyle) {
  ctx.font = `${style.bold ? 'bold ' : ''}${style.italic ? 'italic ' : ''}${style.fontSize}px ${style.fontFamily}`;
  try {
    ctx.letterSpacing = `${style.letterSpacing}px`;
  } catch {
    /* older canvas */
  }
}

function measureLine(ctx: CanvasRenderingContext2D, text: string, style: TextStyle): number {
  applyTextFont(ctx, style);
  const base = ctx.measureText(text).width;
  if (style.letterSpacing && !('letterSpacing' in ctx)) {
    return base + Math.max(0, text.length - 1) * style.letterSpacing;
  }
  return base;
}

export function layoutText(content: string, rawStyle?: Partial<TextStyle> | null): TextLayout {
  const style = hydrateTextStyle(rawStyle);
  const ctx = measureCtx();
  const lineH = style.fontSize * style.lineHeight;
  const paras = (content || '').split('\n');
  const lines: TextLine[] = [];
  const wrapW = style.boxWidth > 0 ? style.boxWidth : Infinity;

  const pushLine = (text: string, lastInPara: boolean) => {
    const width = ctx ? measureLine(ctx, text, style) : text.length * style.fontSize * 0.56;
    lines.push({ text, width, lastInPara });
  };

  for (let pi = 0; pi < paras.length; pi++) {
    const raw = style.allCaps ? paras[pi].toUpperCase() : paras[pi];
    if (!raw) {
      pushLine('', true);
      continue;
    }
    if (!Number.isFinite(wrapW)) {
      pushLine(raw, true);
      continue;
    }
    const words = raw.split(/(\s+)/);
    let current = '';
    for (const part of words) {
      const trial = current + part;
      const w = ctx ? measureLine(ctx, trial, style) : trial.length * style.fontSize * 0.56;
      if (w > wrapW && current.trim()) {
        pushLine(current.replace(/\s+$/, ''), false);
        current = part.replace(/^\s+/, '');
      } else {
        current = trial;
      }
    }
    pushLine(current.replace(/\s+$/, ''), true);
  }

  if (lines.length === 0) pushLine('', true);

  const contentW = Math.max(...lines.map(l => l.width), style.fontSize * 0.5);
  const width = style.boxWidth > 0 ? style.boxWidth : contentW;
  const paraBreaks = Math.max(0, paras.length - 1);
  const height = Math.max(lines.length, 1) * lineH + paraBreaks * style.paragraphGap;
  return { lines, width, height, style };
}

function lineX(align: TextStyle['align'], boxWidth: number, lineWidth: number): number {
  if (align === 'left' || align === 'justify') return -boxWidth / 2;
  if (align === 'right') return boxWidth / 2 - lineWidth;
  return -lineWidth / 2;
}

function drawTextBlock(ctx: CanvasRenderingContext2D, content: string, rawStyle?: Partial<TextStyle> | null) {
  const layout = layoutText(content, rawStyle);
  const { lines, width, height, style } = layout;
  const lineH = style.fontSize * style.lineHeight;
  applyTextFont(ctx, style);
  ctx.fillStyle = style.color;
  ctx.strokeStyle = style.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let startY = -height / 2;
  if (style.valign === 'top') startY = 0;
  else if (style.valign === 'bottom') startY = -height;

  let y = startY;
  let paraIndex = 0;
  const paraCount = (content || '').split('\n').length;

  for (const line of lines) {
    const justify = style.align === 'justify' && !line.lastInPara && line.text.trim() && style.boxWidth > 0;
    if (justify) {
      const words = line.text.trim().split(/\s+/);
      const total = words.reduce((s, w) => s + measureLine(ctx, w, style), 0);
      const gap = words.length > 1 ? (width - total) / (words.length - 1) : 0;
      let x = -width / 2;
      for (const word of words) {
        ctx.fillText(word, x, y);
        x += measureLine(ctx, word, style) + gap;
      }
    } else {
      const x = lineX(style.align, width, line.width);
      ctx.fillText(line.text, x, y);
    }
    if (style.underline && line.text) {
      const x0 = style.align === 'justify' ? -width / 2 : lineX(style.align, width, line.width);
      const w = style.align === 'justify' && !line.lastInPara ? width : line.width;
      ctx.beginPath();
      ctx.lineWidth = Math.max(1, style.fontSize * 0.06);
      ctx.moveTo(x0, y + style.fontSize * 0.92);
      ctx.lineTo(x0 + w, y + style.fontSize * 0.92);
      ctx.stroke();
    }
    y += lineH;
    if (line.lastInPara) {
      paraIndex += 1;
      if (paraIndex < paraCount) y += style.paragraphGap;
    }
  }
}

export function textBlockOffset(style: TextStyle, height: number): { ox: number; oy: number } {
  if (style.valign === 'top') return { ox: 0, oy: height / 2 };
  if (style.valign === 'bottom') return { ox: 0, oy: -height / 2 };
  return { ox: 0, oy: 0 };
}

export function clipLocalSize(
  clip: Clip,
  getAsset?: (id: string) => Asset | undefined,
  project?: Project,
): { w: number; h: number } {
  switch (clip.type) {
    case 'text': {
      const layout = layoutText(clip.textContent || '', clip.textStyle);
      return { w: layout.width, h: layout.height };
    }
    case 'shape':
      return { w: 100, h: 100 };
    case 'mesh3d':
      return { w: MESH_SPRITE, h: MESH_SPRITE };
    case 'comp': {
      const inner = clip.compositionId && project
        ? project.compositions.find(c => c.id === clip.compositionId)
        : undefined;
      return { w: inner?.width || 400, h: inner?.height || 300 };
    }
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
  getAsset?: (id: string) => Asset | undefined,
  project?: Project,
): SelectionBox {
  const xf = resolveClipTransform(clip, time, cw, ch, comp);
  const { w: lw, h: lh } = clipLocalSize(clip, getAsset, project);
  const w = Math.max(24, lw * Math.abs(xf.scaleX));
  const h = Math.max(24, lh * Math.abs(xf.scaleY));
  let cx = cw / 2 + xf.x;
  let cy = ch / 2 + xf.y;
  if (clip.type === 'text') {
    const off = textBlockOffset(hydrateTextStyle(clip.textStyle), h);
    const rad0 = (xf.rotation * Math.PI) / 180;
    cx += off.ox * Math.cos(rad0) - off.oy * Math.sin(rad0);
    cy += off.ox * Math.sin(rad0) + off.oy * Math.cos(rad0);
  }
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

export function clipHitRadius(
  clip: Clip,
  getAsset: (id: string) => Asset | undefined,
  project?: Project,
): number {
  const { w, h } = clipLocalSize(clip, getAsset, project);
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
      case 'grayscale': parts.push(`grayscale(${e.amount / 100})`); break;
      case 'opacity': parts.push(`opacity(${1 - Math.max(0, Math.min(100, e.amount)) / 100})`); break;
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
  project: Project,
  assetCache: Map<string, HTMLImageElement | HTMLVideoElement>,
  getAsset: (id: string) => Asset | undefined,
  visitedComps: Set<string>,
  hideClipId?: string | null,
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
      if (hideClipId && clip.id === hideClipId) break;
      if (clip.textContent != null && clip.textStyle) {
        drawTextBlock(ctx, clip.textContent, clip.textStyle);
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
      const sprite = renderMeshLayer(clip, currentTime - clip.start, getAsset);
      if (sprite) {
        ctx.drawImage(sprite, -MESH_SPRITE / 2, -MESH_SPRITE / 2, MESH_SPRITE, MESH_SPRITE);
      }
      break;
    }
    case 'comp': {
      const inner = clip.compositionId
        ? project.compositions.find(c => c.id === clip.compositionId)
        : undefined;
      if (inner && !visitedComps.has(inner.id)) {
        const off = canvasForNested(clip.id, inner.width, inner.height);
        const offCtx = off.getContext('2d');
        if (offCtx) {
          const innerTime = nestedCompTime(clip, currentTime);
          renderFrame(offCtx, innerTime, inner, project, assetCache, {
            nested: true,
            visitedCompIds: visitedComps,
          });
          ctx.drawImage(off, -inner.width / 2, -inner.height / 2, inner.width, inner.height);
        }
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
  getAsset?: (id: string) => Asset | undefined,
  project?: Project,
) {
  if (clip.type === 'path' || clip.type === 'audio') return;
  const box = getSelectionBox(clip, time, cw, ch, comp, getAsset, project);
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

export function forEachClipAtTime(
  comp: Composition,
  time: number,
  project: Project,
  visit: (clip: Clip, hostTime: number, host: Composition) => void,
  ancestors: Set<string> = new Set(),
) {
  if (ancestors.has(comp.id)) return;
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(comp.id);
  const anySolo = comp.tracks.some(t => t.solo);
  for (const track of comp.tracks) {
    if (!track.visible) continue;
    if (anySolo && !track.solo) continue;
    for (const clip of track.clips) {
      if (time < clip.start || time >= clip.start + clip.duration) continue;
      visit(clip, time, comp);
      if (clip.type === 'comp' && clip.compositionId) {
        const inner = project.compositions.find(c => c.id === clip.compositionId);
        if (inner) {
          forEachClipAtTime(inner, nestedCompTime(clip, time), project, visit, nextAncestors);
        }
      }
    }
  }
}

/** Local x/y that place the layer's visual box against the composition. */
export function alignedLocalPosition(
  clip: Clip,
  time: number,
  comp: Composition,
  align: CompAlign,
  getAsset?: (id: string) => Asset | undefined,
  project?: Project,
): { x: number; y: number } {
  const cw = comp.width;
  const ch = comp.height;
  const xf = resolveClipTransform(clip, time, cw, ch, comp);
  const { w: lw, h: lh } = clipLocalSize(clip, getAsset, project);
  const w = Math.max(1, lw * Math.abs(xf.scaleX));
  const h = Math.max(1, lh * Math.abs(xf.scaleY));
  let cx = cw / 2 + xf.x;
  let cy = ch / 2 + xf.y;
  if (clip.type === 'text') {
    const off = textBlockOffset(hydrateTextStyle(clip.textStyle), h);
    const rad0 = (xf.rotation * Math.PI) / 180;
    cx += off.ox * Math.cos(rad0) - off.oy * Math.sin(rad0);
    cy += off.ox * Math.sin(rad0) + off.oy * Math.cos(rad0);
  }

  const hw = w / 2;
  const hh = h / 2;
  const rad = (xf.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pts = [
    [-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh],
  ].map(([x, y]) => ({
    x: cx + x * cos - y * sin,
    y: cy + x * sin + y * cos,
  }));
  const minX = Math.min(pts[0].x, pts[1].x, pts[2].x, pts[3].x);
  const maxX = Math.max(pts[0].x, pts[1].x, pts[2].x, pts[3].x);
  const minY = Math.min(pts[0].y, pts[1].y, pts[2].y, pts[3].y);
  const maxY = Math.max(pts[0].y, pts[1].y, pts[2].y, pts[3].y);

  let deltaX = 0;
  let deltaY = 0;
  switch (align) {
    case 'left':
      deltaX = -minX;
      break;
    case 'hcenter':
      deltaX = cw / 2 - (minX + maxX) / 2;
      break;
    case 'right':
      deltaX = cw - maxX;
      break;
    case 'top':
      deltaY = -minY;
      break;
    case 'vcenter':
      deltaY = ch / 2 - (minY + maxY) / 2;
      break;
    case 'bottom':
      deltaY = ch - maxY;
      break;
  }

  const clipTime = Math.max(0, time - clip.start);
  const local = evalTransform(clip.transform, clipTime);

  if (!clip.parentId) {
    return { x: local.x + deltaX, y: local.y + deltaY };
  }

  const parent = findClip(comp, clip.parentId);
  if (!parent) {
    return { x: local.x + deltaX, y: local.y + deltaY };
  }

  const worldX = xf.x + deltaX;
  const worldY = xf.y + deltaY;
  const p = resolveClipTransform(parent, time, cw, ch, comp);
  const sx = p.scaleX === 0 ? 1 : p.scaleX;
  const sy = p.scaleY === 0 ? 1 : p.scaleY;
  const rx = (worldX - p.x) / sx;
  const ry = (worldY - p.y) / sy;
  const prad = (p.rotation * Math.PI) / 180;
  return {
    x: rx * Math.cos(prad) + ry * Math.sin(prad),
    y: -rx * Math.sin(prad) + ry * Math.cos(prad),
  };
}

