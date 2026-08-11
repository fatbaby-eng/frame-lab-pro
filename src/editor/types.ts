// ============================================
// Frame Lab Pro — Core Editor Types
// ============================================

export type LayerType = 'video' | 'audio' | 'image' | 'text' | 'shape' | 'mesh3d' | 'effect';

export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';

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
    textContent: type === 'text' ? 'Frame Lab Pro' : undefined,
    textStyle: type === 'text' ? defaultTextStyle() : undefined,
    shapeType: type === 'shape' ? 'rect' : undefined,
    shapeColor: type === 'shape' ? '#6366f1' : undefined,
    shapeStroke: type === 'shape' ? 0 : undefined,
    meshShape: type === 'mesh3d' ? 'torus' : undefined,
    meshColor: type === 'mesh3d' ? '#6366f1' : undefined,
    meshWireframe: type === 'mesh3d' ? false : undefined,
  };
}
