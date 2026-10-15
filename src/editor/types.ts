// ============================================
// Frame Lab — Core Editor Types
// ============================================

export type MeshShape = 'cube' | 'sphere' | 'torus' | 'plane' | 'dodecahedron' | 'icosahedron' | 'cone' | 'model';

export const MESH_PRIMITIVES: MeshShape[] = ['cube', 'sphere', 'torus', 'plane', 'dodecahedron', 'icosahedron', 'cone'];

export type LayerType = 'video' | 'audio' | 'image' | 'text' | 'shape' | 'mesh3d' | 'effect' | 'path' | 'comp';

export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold' | 'bezier';

export type ToolMode = 'pointer' | 'pen' | 'text' | 'shape';

export type EffectType = 'blur' | 'brightness' | 'contrast' | 'saturate' | 'grayscale' | 'opacity';

export interface LayerEffect {
  id: string;
  type: EffectType;
  amount: number; // blur: px; others: 0–200 where 100 = unchanged (opacity/grayscale 0–100)
}

export const EFFECT_DEFS: Record<EffectType, {
  label: string;
  min: number;
  max: number;
  step: number;
  defaultAmount: number;
  unit: string;
}> = {
  blur: { label: 'Blur', min: 0, max: 40, step: 0.5, defaultAmount: 8, unit: 'px' },
  brightness: { label: 'Brightness', min: 0, max: 200, step: 1, defaultAmount: 100, unit: '%' },
  contrast: { label: 'Contrast', min: 0, max: 200, step: 1, defaultAmount: 100, unit: '%' },
  saturate: { label: 'Saturation', min: 0, max: 200, step: 1, defaultAmount: 100, unit: '%' },
  grayscale: { label: 'Grayscale', min: 0, max: 100, step: 1, defaultAmount: 100, unit: '%' },
  opacity: { label: 'Transparency', min: 0, max: 100, step: 1, defaultAmount: 60, unit: '%' },
};

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
  id?: string;
  time: number;       // seconds
  value: T;
  easing: Easing;
  /** Outgoing / incoming cubic-bezier in unit time (X) and eased progress (Y). */
  bx1?: number;
  by1?: number;
  bx2?: number;
  by2?: number;
}

export interface AnimatedProperty {
  keyframes: Keyframe[];
  /** Stopwatch on — keys are shown and interpolated even if only one exists. */
  enabled?: boolean;
}

export function newKeyframeId(): string {
  return `kf-${Math.random().toString(36).slice(2, 10)}`;
}

export function hydrateAnimatedProperty(prop: AnimatedProperty): AnimatedProperty {
  // Saved projects can carry a value or time that is a string or missing (an
  // input box once wrote strings; older saves lack fields). Coerce to finite
  // numbers so nothing downstream calls a number method on a string.
  const keyframes = (prop.keyframes || [])
    .map(k => ({ ...k, id: k.id || newKeyframeId(), time: toNum(k.time, 0), value: toNum(k.value, 0) }))
    .filter(k => Number.isFinite(k.time));
  return {
    enabled: prop.enabled ?? keyframes.length > 1,
    keyframes,
  };
}

/** A finite number, or the fallback. */
export function toNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export interface Transform {
  x: AnimatedProperty;         // pixels from center
  y: AnimatedProperty;
  scaleX: AnimatedProperty;    // 1.0 = 100%
  scaleY: AnimatedProperty;
  rotation: AnimatedProperty;  // degrees
  opacity: AnimatedProperty;   // 0-1
  anchorX: AnimatedProperty;   // pixels from layer center
  anchorY: AnimatedProperty;
}

export function makeAnimatedProperty(initialValue: number): AnimatedProperty {
  return {
    enabled: false,
    keyframes: [{ id: newKeyframeId(), time: 0, value: initialValue, easing: 'linear' }],
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
    anchorX: makeAnimatedProperty(0),
    anchorY: makeAnimatedProperty(0),
  };
}

const KF_EPS = 1 / 120;

export function hasKeyframeAt(prop: AnimatedProperty, time: number, eps = KF_EPS): boolean {
  return prop.keyframes.some(k => Math.abs(k.time - time) < eps);
}

export function setKeyframe(
  prop: AnimatedProperty,
  time: number,
  value: number,
  easing: Easing = 'ease-in-out'
): AnimatedProperty {
  const keyframes = prop.keyframes.map(k => ({ ...k, id: k.id || newKeyframeId() }));
  const idx = keyframes.findIndex(k => Math.abs(k.time - time) < KF_EPS);
  const [bx1, by1, bx2, by2] = easingToBezier(easing);
  if (idx >= 0) {
    keyframes[idx] = { ...keyframes[idx], value, easing, bx1, by1, bx2, by2 };
  } else {
    keyframes.push({ id: newKeyframeId(), time: Math.max(0, time), value, easing, bx1, by1, bx2, by2 });
    keyframes.sort((a, b) => a.time - b.time);
  }
  return { keyframes, enabled: true };
}

export function moveKeyframe(prop: AnimatedProperty, fromTime: number, toTime: number): AnimatedProperty {
  const idx = prop.keyframes.findIndex(k => Math.abs(k.time - fromTime) < KF_EPS);
  if (idx < 0) return prop;
  const nextTime = Math.max(0, toTime);
  const moving = { ...prop.keyframes[idx], time: nextTime };
  const rest = prop.keyframes.filter((k, i) => i !== idx && Math.abs(k.time - nextTime) >= KF_EPS);
  rest.push(moving);
  rest.sort((a, b) => a.time - b.time);
  return { keyframes: rest, enabled: prop.enabled ?? rest.length > 1 };
}

export function removeKeyframe(prop: AnimatedProperty, time: number): AnimatedProperty {
  const keyframes = prop.keyframes.filter(k => Math.abs(k.time - time) >= KF_EPS);
  if (keyframes.length === 0) {
    const nearest = prop.keyframes.reduce((a, b) =>
      Math.abs(a.time - time) < Math.abs(b.time - time) ? a : b
    );
    return { keyframes: [{ ...nearest, time: 0, id: nearest.id || newKeyframeId() }], enabled: false };
  }
  return { keyframes, enabled: prop.enabled ?? keyframes.length > 1 };
}

export function easingAt(prop: AnimatedProperty, time: number): Easing {
  const kf = prop.keyframes.find(k => Math.abs(k.time - time) < KF_EPS);
  if (kf) return kf.easing;
  for (let i = prop.keyframes.length - 1; i >= 0; i--) {
    if (prop.keyframes[i].time <= time) return prop.keyframes[i].easing;
  }
  return prop.keyframes[0]?.easing ?? 'linear';
}

// Evaluate an animated property at a given time
export function evalProp(prop: AnimatedProperty, time: number): number {
  const kf = prop?.keyframes ?? [];
  if (kf.length === 0) return 0;
  if (kf.length === 1) return toNum(kf[0].value, 0);

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

  // Interpolate using the outgoing curve on the earlier key
  const t = (time - before.time) / (after.time - before.time);
  if (before.easing === 'hold') return before.value;
  const [x1, y1, x2, y2] = keyframeBezier(before);
  const eased = cubicBezierY(t, x1, y1, x2, y2);
  return before.value + (after.value - before.value) * eased;
}

export function parseHexColor(hex: string): number {
  const n = (hex || '#000000').replace('#', '');
  const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  return parseInt(full.slice(0, 6), 16) || 0;
}

export function packedToHex(n: number): string {
  return `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
}

function packedToRgb(n: number): [number, number, number] {
  const v = n >>> 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToPacked(r: number, g: number, b: number): number {
  return ((Math.round(r) & 255) << 16) | ((Math.round(g) & 255) << 8) | (Math.round(b) & 255);
}

function easeBetween(before: Keyframe, after: Keyframe, time: number): number {
  if (time <= before.time) return 0;
  if (time >= after.time || after.time <= before.time) return 1;
  const t = (time - before.time) / (after.time - before.time);
  if (before.easing === 'hold') return 0;
  const [x1, y1, x2, y2] = keyframeBezier(before);
  return cubicBezierY(t, x1, y1, x2, y2);
}

/** Interpolate packed RGB keyframes per-channel so color ramps stay in gamut. */
export function evalColorProp(prop: AnimatedProperty, time: number): string {
  const kf = prop.keyframes;
  if (kf.length === 0) return '#000000';
  if (kf.length === 1) return packedToHex(kf[0].value);

  let before = kf[0];
  let after = kf[kf.length - 1];
  for (let i = 0; i < kf.length - 1; i++) {
    if (time >= kf[i].time && time <= kf[i + 1].time) {
      before = kf[i];
      after = kf[i + 1];
      break;
    }
  }
  if (time <= before.time) return packedToHex(before.value);
  if (time >= after.time) return packedToHex(after.value);
  const e = easeBetween(before, after, time);
  const [r0, g0, b0] = packedToRgb(before.value);
  const [r1, g1, b1] = packedToRgb(after.value);
  return packedToHex(rgbToPacked(r0 + (r1 - r0) * e, g0 + (g1 - g0) * e, b0 + (b1 - b0) * e));
}

export function easingToBezier(easing: Easing): [number, number, number, number] {
  switch (easing) {
    case 'linear': return [0, 0, 1, 1];
    case 'ease-in': return [0.42, 0, 1, 1];
    case 'ease-out': return [0, 0, 0.58, 1];
    case 'ease-in-out': return [0.42, 0, 0.58, 1];
    case 'bezier': return [0.42, 0, 0.58, 1];
    case 'hold': return [0, 0, 0, 0];
    default: return [0, 0, 1, 1];
  }
}

export function keyframeBezier(kf: Keyframe): [number, number, number, number] {
  if (kf.easing === 'bezier' || kf.bx1 != null || kf.bx2 != null) {
    return [
      kf.bx1 ?? 0.42,
      kf.by1 ?? 0,
      kf.bx2 ?? 0.58,
      kf.by2 ?? 1,
    ];
  }
  return easingToBezier(kf.easing);
}

export function applyBezierToKeyframe(kf: Keyframe, easing: Easing): Keyframe {
  const [bx1, by1, bx2, by2] = easingToBezier(easing);
  return { ...kf, easing, bx1, by1, bx2, by2 };
}

/** Solve cubic-bezier Y for a given time T in 0–1 (CSS-style). */
export function cubicBezierY(t: number, x1: number, y1: number, x2: number, y2: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  let s = clamped;
  for (let i = 0; i < 10; i++) {
    const x = bezierCoord(s, x1, x2) - clamped;
    const dx = bezierDeriv(s, x1, x2);
    if (Math.abs(x) < 1e-6) break;
    if (Math.abs(dx) < 1e-6) break;
    s = Math.max(0, Math.min(1, s - x / dx));
  }
  return bezierCoord(s, y1, y2);
}

function bezierCoord(s: number, p1: number, p2: number): number {
  const mt = 1 - s;
  return 3 * mt * mt * s * p1 + 3 * mt * s * s * p2 + s * s * s;
}

function bezierDeriv(s: number, p1: number, p2: number): number {
  const mt = 1 - s;
  return 3 * mt * mt * p1 + 6 * mt * s * (p2 - p1) + 3 * s * s * (1 - p2);
}

export interface WorldTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  anchorX: number;
  anchorY: number;
}

export function evalTransform(transform: Transform, time: number): WorldTransform {
  return {
    x: evalProp(transform.x, time),
    y: evalProp(transform.y, time),
    scaleX: evalProp(transform.scaleX, time),
    scaleY: evalProp(transform.scaleY, time),
    rotation: evalProp(transform.rotation, time),
    opacity: evalProp(transform.opacity, time),
    anchorX: transform.anchorX ? evalProp(transform.anchorX, time) : 0,
    anchorY: transform.anchorY ? evalProp(transform.anchorY, time) : 0,
  };
}

export function findClip(comp: Composition, clipId: string): Clip | undefined {
  for (const track of comp.tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (clip) return clip;
  }
  return undefined;
}

/** True if parenting `clipId` to `parentId` would create a cycle. */
export function wouldCreateParentCycle(comp: Composition, clipId: string, parentId: string): boolean {
  if (clipId === parentId) return true;
  let cur: string | undefined = parentId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (cur === clipId) return true;
    seen.add(cur);
    cur = findClip(comp, cur)?.parentId;
  }
  return false;
}

export const COMP_PRESETS = [
  { name: 'Landscape 1080p', width: 1920, height: 1080, fps: 30 },
  { name: 'Landscape 720p', width: 1280, height: 720, fps: 30 },
  { name: 'Square 1080', width: 1080, height: 1080, fps: 30 },
  { name: 'Portrait 1080', width: 1080, height: 1920, fps: 30 },
] as const;

export interface Asset {
  id: string;
  name: string;
  type: LayerType;
  url: string;          // blob URL or data URL
  duration?: number;    // for video/audio
  width?: number;       // for images/video
  height?: number;
  thumbnail?: string;
  /** Normalized 0–1 peak samples for timeline waveforms. */
  peaks?: number[];
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
  meshShape?: MeshShape;
  meshColor?: AnimatedProperty;
  meshWireframe?: boolean;
  meshRotX?: AnimatedProperty;
  meshRotY?: AnimatedProperty;
  meshRotZ?: AnimatedProperty;
  meshSegments?: AnimatedProperty;
  meshMetalness?: AnimatedProperty;
  meshRoughness?: AnimatedProperty;
  meshMapAssetId?: string;
  meshMapRepeatU?: AnimatedProperty;
  meshMapRepeatV?: AnimatedProperty;
  meshMapOffsetU?: AnimatedProperty;
  meshMapOffsetV?: AnimatedProperty;
  meshMapRotation?: AnimatedProperty;
  meshLightAmbient?: AnimatedProperty;
  meshLightAmbientColor?: AnimatedProperty;
  meshLightKey?: AnimatedProperty;
  meshLightKeyColor?: AnimatedProperty;
  meshLightAzimuth?: AnimatedProperty;
  meshLightElevation?: AnimatedProperty;
  meshLightFill?: AnimatedProperty;
  // Path
  pathData?: PathData;
  pathStrokeWidth?: number;
  pathStrokeColor?: string;
  pathFillColor?: string;
  // Motion path (this clip follows another clip's path)
  motionPathClipId?: string;
  // Parenting — child's transform is relative to parent
  parentId?: string;
  // Raster effects applied at render time
  effects?: LayerEffect[];
  /** Nested composition id when type === 'comp'. */
  compositionId?: string;
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type TextVAlign = 'top' | 'middle' | 'bottom';
export type CompAlign = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  align: TextAlign;
  valign: TextVAlign;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  allCaps: boolean;
  letterSpacing: number;
  lineHeight: number;
  paragraphGap: number;
  /** Wrap width in px. 0 = no wrapping (newlines still break). */
  boxWidth: number;
}

export const TEXT_FONTS: { label: string; value: string }[] = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Trebuchet', value: '"Trebuchet MS", sans-serif' },
];

export function defaultTextStyle(): TextStyle {
  return {
    fontFamily: 'Inter, sans-serif',
    fontSize: 48,
    color: '#ffffff',
    align: 'center',
    valign: 'middle',
    bold: false,
    italic: false,
    underline: false,
    allCaps: false,
    letterSpacing: 0,
    lineHeight: 1.2,
    paragraphGap: 0,
    boxWidth: 0,
  };
}

export function hydrateTextStyle(style?: Partial<TextStyle> | null): TextStyle {
  return { ...defaultTextStyle(), ...style };
}

export interface Track {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  muted: boolean;
  solo: boolean;
  clips: Clip[];
  volume: number;
}

export const TRANSFORM_PROP_KEYS: (keyof Transform)[] = [
  'x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity', 'anchorX', 'anchorY',
];

export type MeshAnimKey =
  | 'meshRotX' | 'meshRotY' | 'meshRotZ'
  | 'meshSegments' | 'meshMetalness' | 'meshRoughness' | 'meshColor'
  | 'meshMapRepeatU' | 'meshMapRepeatV' | 'meshMapOffsetU' | 'meshMapOffsetV' | 'meshMapRotation'
  | 'meshLightAmbient' | 'meshLightKey' | 'meshLightFill'
  | 'meshLightAzimuth' | 'meshLightElevation'
  | 'meshLightAmbientColor' | 'meshLightKeyColor';

export type AnimKey = keyof Transform | MeshAnimKey;

export interface MeshPropDef {
  key: MeshAnimKey;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  group: 'object' | 'texture' | 'light';
  color?: boolean;
}

export const MESH_PROP_DEFS: MeshPropDef[] = [
  { key: 'meshRotX', label: 'Rotate X', min: -360, max: 360, step: 1, defaultValue: 18, group: 'object' },
  { key: 'meshRotY', label: 'Rotate Y', min: -360, max: 360, step: 1, defaultValue: 0, group: 'object' },
  { key: 'meshRotZ', label: 'Rotate Z', min: -360, max: 360, step: 1, defaultValue: 0, group: 'object' },
  { key: 'meshSegments', label: 'Segments', min: 3, max: 64, step: 1, defaultValue: 32, group: 'object' },
  { key: 'meshMetalness', label: 'Metalness', min: 0, max: 1, step: 0.01, defaultValue: 0.38, group: 'object' },
  { key: 'meshRoughness', label: 'Roughness', min: 0, max: 1, step: 0.01, defaultValue: 0.32, group: 'object' },
  { key: 'meshColor', label: 'Color', min: 0, max: 0xffffff, step: 1, defaultValue: 0x6366f1, group: 'object', color: true },
  { key: 'meshMapRepeatU', label: 'Repeat U', min: 0.1, max: 8, step: 0.1, defaultValue: 1, group: 'texture' },
  { key: 'meshMapRepeatV', label: 'Repeat V', min: 0.1, max: 8, step: 0.1, defaultValue: 1, group: 'texture' },
  { key: 'meshMapOffsetU', label: 'Offset U', min: -1, max: 1, step: 0.01, defaultValue: 0, group: 'texture' },
  { key: 'meshMapOffsetV', label: 'Offset V', min: -1, max: 1, step: 0.01, defaultValue: 0, group: 'texture' },
  { key: 'meshMapRotation', label: 'Map rot', min: -180, max: 180, step: 1, defaultValue: 0, group: 'texture' },
  { key: 'meshLightAmbient', label: 'Ambient', min: 0, max: 2, step: 0.05, defaultValue: 0.85, group: 'light' },
  { key: 'meshLightKey', label: 'Key', min: 0, max: 3, step: 0.05, defaultValue: 1.15, group: 'light' },
  { key: 'meshLightFill', label: 'Fill', min: 0, max: 2, step: 0.05, defaultValue: 0.45, group: 'light' },
  { key: 'meshLightAzimuth', label: 'Azimuth', min: 0, max: 360, step: 1, defaultValue: 35, group: 'light' },
  { key: 'meshLightElevation', label: 'Elevation', min: -90, max: 90, step: 1, defaultValue: 40, group: 'light' },
  { key: 'meshLightAmbientColor', label: 'Amb color', min: 0, max: 0xffffff, step: 1, defaultValue: 0xffffff, group: 'light', color: true },
  { key: 'meshLightKeyColor', label: 'Key color', min: 0, max: 0xffffff, step: 1, defaultValue: 0xffffff, group: 'light', color: true },
];

export const MESH_PROP_KEYS: MeshAnimKey[] = MESH_PROP_DEFS.map(d => d.key);
export const MESH_PROP_BY_KEY: Record<MeshAnimKey, MeshPropDef> = Object.fromEntries(
  MESH_PROP_DEFS.map(d => [d.key, d])
) as Record<MeshAnimKey, MeshPropDef>;

export function isTransformKey(key: string): key is keyof Transform {
  return (TRANSFORM_PROP_KEYS as string[]).includes(key);
}

export function isMeshAnimKey(key: string): key is MeshAnimKey {
  return (MESH_PROP_KEYS as string[]).includes(key);
}

export function isMeshColorKey(key: AnimKey): boolean {
  return isMeshAnimKey(key) && !!MESH_PROP_BY_KEY[key].color;
}

export function getAnimProp(clip: Clip, key: AnimKey): AnimatedProperty | undefined {
  if (isTransformKey(key)) return clip.transform[key];
  const value = clip[key];
  return value && typeof value === 'object' && 'keyframes' in value ? value : undefined;
}

export function withAnimProp(clip: Clip, key: AnimKey, prop: AnimatedProperty): Clip {
  if (isTransformKey(key)) {
    return { ...clip, transform: { ...clip.transform, [key]: prop } };
  }
  return { ...clip, [key]: prop };
}

export function coerceAnimated(raw: unknown, fallback: number, asColor = false): AnimatedProperty {
  if (raw && typeof raw === 'object' && Array.isArray((raw as AnimatedProperty).keyframes)) {
    return hydrateAnimatedProperty(raw as AnimatedProperty);
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return makeAnimatedProperty(raw);
  if (asColor && typeof raw === 'string') return makeAnimatedProperty(parseHexColor(raw));
  return makeAnimatedProperty(fallback);
}

export function ensureMeshAnimProps(clip: Clip): Clip {
  if (clip.type !== 'mesh3d') return clip;
  let next = clip;
  for (const def of MESH_PROP_DEFS) {
    next = { ...next, [def.key]: coerceAnimated(clip[def.key], def.defaultValue, !!def.color) };
  }
  return next;
}

export function ensureAnimProp(clip: Clip, key: AnimKey): AnimatedProperty {
  const existing = getAnimProp(clip, key);
  if (existing?.keyframes.length) return existing;
  if (isMeshAnimKey(key)) return makeAnimatedProperty(MESH_PROP_BY_KEY[key].defaultValue);
  return makeAnimatedProperty(0);
}

export function evalMeshNumber(clip: Clip, key: MeshAnimKey, time: number): number {
  const def = MESH_PROP_BY_KEY[key];
  const value = evalProp(ensureAnimProp(clip, key), time);
  if (key === 'meshSegments') return Math.max(def.min, Math.min(def.max, Math.round(value)));
  return value;
}

export function evalMeshColor(clip: Clip, key: MeshAnimKey, time: number, fallback: string): string {
  const prop = getAnimProp(clip, key);
  if (!prop) return fallback;
  return evalColorProp(prop, time);
}

export function clipAnimKeys(clip: Clip): AnimKey[] {
  const keys: AnimKey[] = [...TRANSFORM_PROP_KEYS];
  if (clip.type === 'mesh3d') keys.push(...MESH_PROP_KEYS);
  return keys;
}

export function isAnimated(prop: AnimatedProperty | undefined): boolean {
  return !!prop && (prop.keyframes.length > 1 || !!prop.enabled);
}

export function snapToTimes(time: number, targets: number[], threshold: number): number {
  let best = time;
  let bestDist = threshold;
  for (const target of targets) {
    if (target == null || Number.isNaN(target)) continue;
    const d = Math.abs(time - target);
    if (d < bestDist) {
      bestDist = d;
      best = target;
    }
  }
  return best;
}

export function collectSnapTimes(comp: Composition, playhead: number, excludeClipId?: string): number[] {
  const times = [0, comp.duration, playhead, comp.workAreaStart ?? 0, comp.workAreaEnd ?? comp.duration];
  for (const track of comp.tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      times.push(clip.start, clip.start + clip.duration);
    }
  }
  return times;
}

export interface Composition {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;    // total composition duration
  backgroundColor: string;
  workAreaStart: number;
  workAreaEnd: number;
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
  const tracks = [
    createTrack('video', 'Video 1', 0),
    createTrack('video', 'Video 2', 1),
    createTrack('text', 'Text', 2),
    createTrack('shape', 'Shapes', 3),
    createTrack('mesh3d', '3D', 4),
    createTrack('audio', 'Audio 1', 5),
    createTrack('path', 'Paths', 6),
  ];

  const textClip = createNewClip(tracks[2].id, 'text', 0, 10);
  textClip.name = 'Title';
  textClip.textContent = 'FRAME LAB';
  textClip.textStyle = {
    ...defaultTextStyle(),
    fontSize: 96,
    bold: true,
    color: '#ffffff',
  };
  textClip.transform.opacity = hydrateAnimatedProperty({
    keyframes: [
      { time: 0, value: 0, easing: 'ease-out' },
      { time: 0.8, value: 1, easing: 'linear' },
    ],
  });
  textClip.transform.scaleX = hydrateAnimatedProperty({
    keyframes: [
      { time: 0, value: 0.85, easing: 'ease-out' },
      { time: 0.8, value: 1, easing: 'linear' },
    ],
  });
  textClip.transform.scaleY = hydrateAnimatedProperty({
    keyframes: [
      { time: 0, value: 0.85, easing: 'ease-out' },
      { time: 0.8, value: 1, easing: 'linear' },
    ],
  });
  tracks[2].clips.push(textClip);

  const shapeClip = createNewClip(tracks[3].id, 'shape', 0, 10);
  shapeClip.name = 'Accent';
  shapeClip.shapeType = 'circle';
  shapeClip.shapeColor = '#6366f1';
  shapeClip.transform.y = makeAnimatedProperty(180);
  shapeClip.transform.scaleX = makeAnimatedProperty(0.7);
  shapeClip.transform.scaleY = makeAnimatedProperty(0.7);
  shapeClip.transform.x = hydrateAnimatedProperty({
    keyframes: [
      { time: 0, value: -420, easing: 'ease-in-out' },
      { time: 5, value: 420, easing: 'ease-in-out' },
      { time: 10, value: -420, easing: 'ease-in-out' },
    ],
  });
  tracks[3].clips.push(shapeClip);

  const meshClip = createNewClip(tracks[4].id, 'mesh3d', 0, 10);
  meshClip.name = 'Orb';
  meshClip.meshShape = 'torus';
  meshClip.meshColor = makeAnimatedProperty(parseHexColor('#818cf8'));
  meshClip.transform.y = makeAnimatedProperty(-40);
  meshClip.transform.scaleX = makeAnimatedProperty(2.2);
  meshClip.transform.scaleY = makeAnimatedProperty(2.2);
  meshClip.meshRotX = makeAnimatedProperty(22);
  meshClip.meshRotY = hydrateAnimatedProperty({
    keyframes: [
      { time: 0, value: 0, easing: 'linear', bx1: 0, by1: 0, bx2: 1, by2: 1 },
      { time: 10, value: 360, easing: 'linear', bx1: 0, by1: 0, bx2: 1, by2: 1 },
    ],
  });
  tracks[4].clips.push(meshClip);

  return {
    id: `comp-${Date.now()}`,
    name: 'Composition 1',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 10,
    backgroundColor: '#0a0a0f',
    workAreaStart: 0,
    workAreaEnd: 10,
    tracks,
  };
}

function createTrack(type: LayerType, name: string, index: number): Track {
  return {
    id: `track-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    type,
    visible: true,
    locked: false,
    muted: false,
    solo: false,
    clips: [],
    volume: 1,
  };
}

const LAYER_LABELS: Record<LayerType, string> = {
  video: 'Video',
  audio: 'Audio',
  image: 'Image',
  text: 'Text',
  shape: 'Shape',
  mesh3d: '3D',
  effect: 'Effect',
  path: 'Path',
  comp: 'Comp',
};

export function nestedCompTime(clip: Clip, parentTime: number): number {
  return clip.sourceStart + Math.max(0, parentTime - clip.start);
}

/** True if placing `nestedCompId` inside `hostCompId` would loop. */
export function wouldCreateCompCycle(project: Project, hostCompId: string, nestedCompId: string): boolean {
  if (!nestedCompId || hostCompId === nestedCompId) return true;
  const stack = new Set<string>();
  const walk = (id: string): boolean => {
    if (id === hostCompId) return true;
    if (stack.has(id)) return false;
    stack.add(id);
    const nested = project.compositions.find(c => c.id === id);
    if (!nested) return false;
    for (const track of nested.tracks) {
      for (const clip of track.clips) {
        if (clip.type === 'comp' && clip.compositionId && walk(clip.compositionId)) return true;
      }
    }
    stack.delete(id);
    return false;
  };
  return walk(nestedCompId);
}

export function compositionIsReferenced(project: Project, compositionId: string): boolean {
  return project.compositions.some(c =>
    c.tracks.some(t => t.clips.some(cl => cl.type === 'comp' && cl.compositionId === compositionId))
  );
}

export function createEmptyComposition(opts?: {
  name?: string;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
}): Composition {
  const tracks = [
    createTrack('video', 'Video 1', 0),
    createTrack('video', 'Video 2', 1),
    createTrack('text', 'Text', 2),
    createTrack('shape', 'Shapes', 3),
    createTrack('mesh3d', '3D', 4),
    createTrack('audio', 'Audio 1', 5),
    createTrack('path', 'Paths', 6),
  ];
  const duration = opts?.duration ?? 10;
  return {
    id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: opts?.name ?? 'Composition',
    width: opts?.width ?? 1920,
    height: opts?.height ?? 1080,
    fps: opts?.fps ?? 30,
    duration,
    backgroundColor: '#0a0a0f',
    workAreaStart: 0,
    workAreaEnd: duration,
    tracks,
  };
}

export function nextClipName(comp: Composition, type: LayerType, assetName?: string): string {
  if (assetName) return assetName.replace(/\.[^.]+$/, '');
  const label = LAYER_LABELS[type] ?? type;
  const n = comp.tracks.reduce((count, t) => count + t.clips.filter(c => c.type === type).length, 0) + 1;
  return `${label} ${n}`;
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
    textStyle: type === 'text' ? { ...defaultTextStyle(), boxWidth: 800 } : undefined,
    shapeType: type === 'shape' ? 'rect' : undefined,
    shapeColor: type === 'shape' ? '#6366f1' : undefined,
    shapeStroke: type === 'shape' ? 0 : undefined,
    meshShape: type === 'mesh3d' ? 'torus' : undefined,
    meshWireframe: type === 'mesh3d' ? false : undefined,
    meshRotX: type === 'mesh3d' ? makeAnimatedProperty(18) : undefined,
    meshRotY: type === 'mesh3d' ? makeAnimatedProperty(0) : undefined,
    meshRotZ: type === 'mesh3d' ? makeAnimatedProperty(0) : undefined,
    meshSegments: type === 'mesh3d' ? makeAnimatedProperty(32) : undefined,
    meshMetalness: type === 'mesh3d' ? makeAnimatedProperty(0.38) : undefined,
    meshRoughness: type === 'mesh3d' ? makeAnimatedProperty(0.32) : undefined,
    meshColor: type === 'mesh3d' ? makeAnimatedProperty(parseHexColor('#6366f1')) : undefined,
    meshMapRepeatU: type === 'mesh3d' ? makeAnimatedProperty(1) : undefined,
    meshMapRepeatV: type === 'mesh3d' ? makeAnimatedProperty(1) : undefined,
    meshMapOffsetU: type === 'mesh3d' ? makeAnimatedProperty(0) : undefined,
    meshMapOffsetV: type === 'mesh3d' ? makeAnimatedProperty(0) : undefined,
    meshMapRotation: type === 'mesh3d' ? makeAnimatedProperty(0) : undefined,
    meshLightAmbient: type === 'mesh3d' ? makeAnimatedProperty(0.85) : undefined,
    meshLightKey: type === 'mesh3d' ? makeAnimatedProperty(1.15) : undefined,
    meshLightAzimuth: type === 'mesh3d' ? makeAnimatedProperty(35) : undefined,
    meshLightElevation: type === 'mesh3d' ? makeAnimatedProperty(40) : undefined,
    meshLightFill: type === 'mesh3d' ? makeAnimatedProperty(0.45) : undefined,
    meshLightAmbientColor: type === 'mesh3d' ? makeAnimatedProperty(parseHexColor('#ffffff')) : undefined,
    meshLightKeyColor: type === 'mesh3d' ? makeAnimatedProperty(parseHexColor('#ffffff')) : undefined,
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
