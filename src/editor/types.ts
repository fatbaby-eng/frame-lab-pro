// ============================================
// Frame Lab — Core Editor Types
// ============================================

export type LayerType = 'video' | 'audio' | 'image' | 'text' | 'shape' | 'mesh3d' | 'effect' | 'path';

export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';

export type ToolMode = 'pointer' | 'pen';

export interface PathPoint {
  x: number;
  y: number;
  cpInX: number;   // incoming control point offset
  cpInY: number;
  cpOutX: number;  // outgoing control point offset
  cpOutY: number;
}

export interface PathData {
  points: PathPoint[];
  closed: boolean;
}

export interface Keyframe<T = number> {
  time: number;       // seconds
  value: T;
  easing: Easing;
}

export interface AnimatedProperty {
  keyframes: Keyframe[];
}

export interface Transform {
  x: AnimatedProperty;         // pixels from center
  y: AnimatedProperty;
  scaleX: AnimatedProperty;    // 1.0 = 100%
  scaleY: AnimatedProperty;
  rotation: AnimatedProperty;  // degrees
  opacity: AnimatedProperty;   // 0-1
}

export function makeAnimatedProperty(initialValue: number): AnimatedProperty {
  return {
    keyframes: [{ time: 0, value: initialValue, easing: 'linear' }],
  };
}

export function makeTransform(
  x = 0,
  y = 0,
  scale = 1,
  rotation = 0,
  opacity = 1
): Transform {
  return {
    x: makeAnimatedProperty(x),
    y: makeAnimatedProperty(y),
    scaleX: makeAnimatedProperty(scale),
    scaleY: makeAnimatedProperty(scale),
    rotation: makeAnimatedProperty(rotation),
    opacity: makeAnimatedProperty(opacity),
  };
}

// Evaluate an animated property at a given time
export function evalProp(prop: AnimatedProperty, time: number): number {
  const kf = prop.keyframes;
  if (kf.length === 0) return 0;
  if (kf.length === 1) return kf[0].value;

  // Find surrounding keyframes
  let before = kf[0];
  let after = kf[kf.length - 1];

  for (let i = 0; i < kf.length - 1; i++) {
    if (time >= kf[i].time && time <= kf[i + 1].time) {
      before = kf[i];
      after = kf[i + 1];
      break;
    }
  }

  if (time <= before.time) return before.value;
  if (time >= after.time) return after.value;

  // Interpolate
  const t = (time - before.time) / (after.time - before.time);
  const eased = applyEasing(t, after.easing);
  return before.value + (after.value - before.value) * eased;
}

function applyEasing(t: number, easing: Easing): number {
  switch (easing) {
    case 'linear': return t;
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - (1 - t) * (1 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'hold': return 0;
    default: return t;
  }
}

export interface Asset {
  id: string;
  name: string;
  type: LayerType;
  url: string;          // blob URL or data URL
  duration?: number;    // for video/audio
  width?: number;       // for images/video
  height?: number;
  thumbnail?: string;
}

export interface Clip {
  id: string;
  assetId: string | null;  // null for generated layers (text, shape, effect)
  name: string;
  type: LayerType;
  trackId: string;
  start: number;       // start time on timeline (seconds)
  duration: number;    // clip duration (seconds)
  sourceStart: number; // offset into source media (seconds)
  transform: Transform;
  // Layer-specific properties
  textContent?: string;
  textStyle?: TextStyle;
  shapeType?: 'rect' | 'circle' | 'triangle' | 'star';
  shapeColor?: string;
  shapeStroke?: number;
  effectParams?: Record<string, number>;
  // 3D mesh
  meshShape?: 'cube' | 'sphere' | 'torus' | 'dodecahedron' | 'icosahedron' | 'cone';
  meshColor?: string;
  meshWireframe?: boolean;
  // Path
  pathData?: PathData;
  pathStrokeWidth?: number;
  pathStrokeColor?: string;
  pathFillColor?: string;
  // Motion path (this clip follows another clip's path)
  motionPathClipId?: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
}

export function defaultTextStyle(): TextStyle {
  return {
    fontFamily: 'Inter, sans-serif',
    fontSize: 48,
    color: '#ffffff',
    align: 'center',
    bold: false,
    italic: false,
  };
}

export interface Track {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  muted: boolean;
  clips: Clip[];
  // For audio/video tracks: volume
  volume: number;
}

export interface Composition {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;    // total composition duration
  tracks: Track[];
}

export interface Project {
  id: string;
  name: string;
  compositions: Composition[];
  activeCompositionId: string;
  assets: Asset[];
}

export function createDefaultComposition(): Composition {
  return {
    id: `comp-${Date.now()}`,
    name: 'Composition 1',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 30,
    tracks: [
      createTrack('video', 'Video 1', 0),
      createTrack('video', 'Video 2', 1),
      createTrack('text', 'Text', 2),
      createTrack('shape', 'Shapes', 3),
      createTrack('audio', 'Audio 1', 4),
      createTrack('path', 'Paths', 5),
    ],
  };
}

function createTrack(type: LayerType, name: string, index: number): Track {
  return {
    id: `track-${Date.now()}-${index}`,
    name,
    type,
    visible: true,
    locked: false,
    muted: false,
    clips: [],
    volume: 1,
  };
}

export function createNewClip(
  trackId: string,
  type: LayerType,
  start: number,
  duration: number,
  assetId?: string
): Clip {
  const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    assetId: assetId ?? null,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${id.slice(-4)}`,
    type,
    trackId,
    start,
    duration,
    sourceStart: 0,
    transform: makeTransform(),
    textContent: type === 'text' ? 'Frame Lab' : undefined,
    textStyle: type === 'text' ? defaultTextStyle() : undefined,
    shapeType: type === 'shape' ? 'rect' : undefined,
    shapeColor: type === 'shape' ? '#6366f1' : undefined,
    shapeStroke: type === 'shape' ? 0 : undefined,
    meshShape: type === 'mesh3d' ? 'torus' : undefined,
    meshColor: type === 'mesh3d' ? '#6366f1' : undefined,
    meshWireframe: type === 'mesh3d' ? false : undefined,
    pathData: type === 'path' ? { points: [], closed: false } : undefined,
    pathStrokeWidth: type === 'path' ? 3 : undefined,
    pathStrokeColor: type === 'path' ? '#6366f1' : undefined,
    pathFillColor: type === 'path' ? 'transparent' : undefined,
  };
}

// ============================================
// Path Utilities
// ============================================

export function drawPath(ctx: CanvasRenderingContext2D, path: PathData, offsetX = 0, offsetY = 0) {
  const pts = path.points;
  if (pts.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(pts[0].x + offsetX, pts[0].y + offsetY);

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    ctx.bezierCurveTo(
      prev.x + prev.cpOutX + offsetX,
      prev.y + prev.cpOutY + offsetY,
      curr.x + curr.cpInX + offsetX,
      curr.y + curr.cpInY + offsetY,
      curr.x + offsetX,
      curr.y + offsetY
    );
  }

  if (path.closed && pts.length > 2) {
    const last = pts[pts.length - 1];
    const first = pts[0];
    ctx.bezierCurveTo(
      last.x + last.cpOutX + offsetX,
      last.y + last.cpOutY + offsetY,
      first.x + first.cpInX + offsetX,
      first.y + first.cpInY + offsetY,
      first.x + offsetX,
      first.y + offsetY
    );
    ctx.closePath();
  }
}

// Sample a path into small segments for arc-length parameterization
function samplePath(path: PathData, segments = 200): { x: number; y: number; dist: number }[] {
  const pts = path.points;
  if (pts.length < 2) return [];

  const samples: { x: number; y: number; dist: number }[] = [];
  let totalDist = 0;

  const addPoint = (x: number, y: number) => {
    if (samples.length > 0) {
      const last = samples[samples.length - 1];
      totalDist += Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2);
    }
    samples.push({ x, y, dist: totalDist });
  };

  // For each segment between points, sample bezier curve
  const numSegments = path.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < numSegments; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const steps = Math.max(1, Math.floor(segments / numSegments));

    for (let s = 0; s <= steps; s++) {
      if (s === 0 && i > 0) continue; // avoid duplicate points
      const t = s / steps;
      const mt = 1 - t;
      const x = mt ** 3 * curr.x + 3 * mt ** 2 * t * (curr.x + curr.cpOutX) + 3 * mt * t ** 2 * (next.x + next.cpInX) + t ** 3 * next.x;
      const y = mt ** 3 * curr.y + 3 * mt ** 2 * t * (curr.y + curr.cpOutY) + 3 * mt * t ** 2 * (next.y + next.cpInY) + t ** 3 * next.y;
      addPoint(x, y);
    }
  }

  return samples;
}

// Get position on path at progress 0-1 using arc-length parameterization
export function getPathPosition(path: PathData, progress: number): { x: number; y: number } | null {
  const samples = samplePath(path);
  if (samples.length === 0) return null;

  const targetDist = progress * samples[samples.length - 1].dist;
  // Binary search for the segment
  let lo = 0, hi = samples.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (samples[mid].dist < targetDist) lo = mid + 1;
    else hi = mid;
  }

  const idx = Math.max(1, lo);
  const a = samples[idx - 1];
  const b = samples[idx];
  const segLen = b.dist - a.dist;
  const t = segLen > 0 ? (targetDist - a.dist) / segLen : 0;

  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

// Get tangent angle (in degrees) at a given progress for auto-rotation
export function getPathTangent(path: PathData, progress: number): number | null {
  const samples = samplePath(path);
  if (samples.length < 2) return null;

  const targetDist = progress * samples[samples.length - 1].dist;
  let lo = 0, hi = samples.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (samples[mid].dist < targetDist) lo = mid + 1;
    else hi = mid;
  }

  const idx = Math.min(lo, samples.length - 2);
  const a = samples[idx];
  const b = samples[idx + 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Auto-smooth control points for a new point
export function smoothControlPoints(points: PathPoint[], index: number) {
  if (points.length < 2 || index < 0 || index >= points.length) return;
  const pt = points[index];
  const prev = points[index - 1];
  const next = points[index + 1];

  if (prev && next) {
    // Smooth: cpOut points toward next, cpIn points toward prev
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const smoothLen = len * 0.2;
    if (len > 0) {
      pt.cpOutX = (dx / len) * smoothLen;
      pt.cpOutY = (dy / len) * smoothLen;
      pt.cpInX = -(dx / len) * smoothLen;
      pt.cpInY = -(dy / len) * smoothLen;
    }
  } else if (prev) {
    // Only previous: mirror previous cpOut
    pt.cpInX = -prev.cpOutX;
    pt.cpInY = -prev.cpOutY;
    pt.cpOutX = prev.cpOutX;
    pt.cpOutY = prev.cpOutY;
  }
}

// Create a new path point with smooth handles
export function createPathPoint(x: number, y: number, prevPoint?: PathPoint): PathPoint {
  const pt: PathPoint = { x, y, cpInX: 0, cpInY: 0, cpOutX: 0, cpOutY: 0 };
  if (prevPoint) {
    const dx = x - prevPoint.x;
    const dy = y - prevPoint.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const handleLen = len * 0.3;
    if (len > 0) {
      pt.cpInX = -(dx / len) * handleLen;
      pt.cpInY = -(dy / len) * handleLen;
      pt.cpOutX = (dx / len) * handleLen;
      pt.cpOutY = (dy / len) * handleLen;
    }
  }
  return pt;
}
