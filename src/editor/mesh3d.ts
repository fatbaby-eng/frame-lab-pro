import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { evalProp } from './types';
import type { Asset, Clip } from './types';

const SIZE = 512;
export const MESH_SPRITE = 320;
export const MESH_READY_EVENT = 'framelab-3d-ready';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let primitive: THREE.Mesh | null = null;
let modelRoot: THREE.Group | null = null;
let hemi: THREE.HemisphereLight | null = null;
let keyLight: THREE.DirectionalLight | null = null;
let fillLight: THREE.DirectionalLight | null = null;
let rimLight: THREE.DirectionalLight | null = null;

let currentShape = '';
let currentSegments = -1;

const texCache = new Map<string, THREE.Texture>();
const modelCache = new Map<string, THREE.Group>();
const modelPending = new Set<string>();

function notifyReady() {
  window.dispatchEvent(new Event(MESH_READY_EVENT));
}

function hexToInt(hex: string): number {
  const n = (hex || '#6366f1').replace('#', '');
  const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  return parseInt(full.slice(0, 6), 16) || 0x6366f1;
}

function ensure() {
  if (renderer && scene && camera) return;

  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  hemi = new THREE.HemisphereLight(0xffffff, 0x1e1b4b, 0.85);
  scene.add(hemi);
  keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
  scene.add(keyLight);
  fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.45);
  scene.add(fillLight);
  rimLight = new THREE.DirectionalLight(0xffffff, 0.55);
  rimLight.position.set(0, 1.2, -2.4);
  scene.add(rimLight);
}

function geometryFor(shape: string, segments: number): THREE.BufferGeometry {
  const s = Math.max(3, Math.min(64, Math.round(segments)));
  switch (shape) {
    case 'sphere': return new THREE.SphereGeometry(0.92, s, Math.max(8, Math.round(s * 0.66)));
    case 'torus': return new THREE.TorusGeometry(0.72, 0.28, Math.max(8, Math.round(s * 0.5)), s);
    case 'cone': return new THREE.ConeGeometry(0.85, 1.5, s);
    case 'plane': return new THREE.PlaneGeometry(1.6, 1.6, s, s);
    case 'dodecahedron': return new THREE.DodecahedronGeometry(0.95, s > 24 ? 1 : 0);
    case 'icosahedron': return new THREE.IcosahedronGeometry(0.95, s > 24 ? 1 : 0);
    default: return new THREE.BoxGeometry(1.25, 1.25, 1.25, Math.max(1, Math.round(s / 8)), Math.max(1, Math.round(s / 8)), Math.max(1, Math.round(s / 8)));
  }
}

function setLightRig(clip: Clip) {
  if (!hemi || !keyLight || !fillLight || !rimLight) return;
  const amb = clip.meshLightAmbient ?? 0.85;
  const key = clip.meshLightKey ?? 1.15;
  const fill = clip.meshLightFill ?? 0.45;
  const az = ((clip.meshLightAzimuth ?? 35) * Math.PI) / 180;
  const el = ((clip.meshLightElevation ?? 40) * Math.PI) / 180;
  const dist = 3.4;
  const x = Math.cos(el) * Math.sin(az) * dist;
  const y = Math.sin(el) * dist;
  const z = Math.cos(el) * Math.cos(az) * dist;

  hemi.intensity = amb;
  hemi.color.set(hexToInt(clip.meshLightAmbientColor || '#ffffff'));
  keyLight.intensity = key;
  keyLight.color.set(hexToInt(clip.meshLightKeyColor || '#ffffff'));
  keyLight.position.set(x, y, z);
  fillLight.intensity = fill;
  fillLight.position.set(-x * 0.8, y * 0.2, z * 0.4);
  rimLight.intensity = key * 0.45;
}

function textureFor(url: string): THREE.Texture {
  const hit = texCache.get(url);
  if (hit) return hit;
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    tex.image = img;
    tex.needsUpdate = true;
    notifyReady();
  };
  img.src = url;
  texCache.set(url, tex);
  return tex;
}

function applyMap(
  mat: THREE.MeshStandardMaterial,
  clip: Clip,
  getAsset?: (id: string) => Asset | undefined,
  opts?: { preserveExisting?: boolean },
) {
  const mapId = clip.meshMapAssetId;
  const asset = mapId && getAsset ? getAsset(mapId) : undefined;
  if (asset?.url) {
    const tex = textureFor(asset.url);
    tex.repeat.set(clip.meshMapRepeatU ?? 1, clip.meshMapRepeatV ?? 1);
    tex.offset.set(clip.meshMapOffsetU ?? 0, clip.meshMapOffsetV ?? 0);
    tex.rotation = ((clip.meshMapRotation ?? 0) * Math.PI) / 180;
    tex.center.set(0.5, 0.5);
    mat.map = tex;
  } else if (!opts?.preserveExisting) {
    mat.map = null;
  }
}

function applyStandard(mat: THREE.MeshStandardMaterial, clip: Clip, getAsset?: (id: string) => Asset | undefined) {
  mat.color.set(hexToInt(clip.meshColor || '#6366f1'));
  mat.wireframe = !!clip.meshWireframe;
  mat.metalness = clip.meshMetalness ?? 0.38;
  mat.roughness = clip.meshRoughness ?? 0.32;
  mat.side = clip.meshShape === 'plane' ? THREE.DoubleSide : THREE.FrontSide;
  applyMap(mat, clip, getAsset);
  mat.needsUpdate = true;
}

function syncPrimitive(shape: string, segments: number) {
  if (!scene) return;
  if (primitive && currentShape === shape && currentSegments === segments) return;
  if (primitive) {
    scene.remove(primitive);
    primitive.geometry.dispose();
    const mat = primitive.material;
    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
    else mat.dispose();
    primitive = null;
  }
  const material = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    metalness: 0.38,
    roughness: 0.32,
  });
  primitive = new THREE.Mesh(geometryFor(shape, segments), material);
  scene.add(primitive);
  currentShape = shape;
  currentSegments = segments;
}

function normalizeModel(root: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.add(root);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  group.scale.multiplyScalar(2 / maxDim);
  const centered = new THREE.Box3().setFromObject(group);
  const center = centered.getCenter(new THREE.Vector3());
  group.position.sub(center);
  return group;
}

async function loadModel(asset: Asset): Promise<THREE.Group> {
  const name = asset.name.toLowerCase();
  if (name.endsWith('.obj')) {
    const text = await fetch(asset.url).then(r => r.text());
    const parsed = new OBJLoader().parse(text);
    return normalizeModel(parsed);
  }
  const gltf = await new GLTFLoader().loadAsync(asset.url);
  return normalizeModel(gltf.scene.clone(true));
}

function requestModel(asset: Asset): THREE.Group | null {
  const cached = modelCache.get(asset.id);
  if (cached) return cached;
  if (modelPending.has(asset.id)) return null;
  modelPending.add(asset.id);
  void loadModel(asset)
    .then(group => {
      modelCache.set(asset.id, group);
      modelPending.delete(asset.id);
      notifyReady();
    })
    .catch(() => {
      modelPending.delete(asset.id);
    });
  return null;
}

function showModel(group: THREE.Group) {
  if (!scene) return;
  if (modelRoot === group) return;
  if (modelRoot) scene.remove(modelRoot);
  modelRoot = group;
  scene.add(modelRoot);
}

function hideModel() {
  if (modelRoot && scene) {
    scene.remove(modelRoot);
    modelRoot = null;
  }
}

function frameObject(obj: THREE.Object3D) {
  if (!camera) return;
  obj.updateMatrixWorld(true);
  const sphere = new THREE.Sphere();
  new THREE.Box3().setFromObject(obj).getBoundingSphere(sphere);
  const radius = Math.max(sphere.radius, 0.5);
  const fov = (camera.fov * Math.PI) / 180;
  const dist = (radius * 1.22) / Math.tan(fov / 2);
  camera.position.set(sphere.center.x, sphere.center.y, sphere.center.z + dist);
  camera.lookAt(sphere.center);
  camera.near = Math.max(0.05, dist / 40);
  camera.far = dist * 8;
  camera.updateProjectionMatrix();
}

function toStandard(mat: THREE.Material): THREE.Material {
  if (mat instanceof THREE.MeshStandardMaterial) return mat;
  if (
    mat instanceof THREE.MeshBasicMaterial
    || mat instanceof THREE.MeshPhongMaterial
    || mat instanceof THREE.MeshLambertMaterial
  ) {
    const std = new THREE.MeshStandardMaterial();
    std.color.copy(mat.color);
    if (mat.map) std.map = mat.map;
    std.transparent = mat.transparent;
    std.opacity = mat.opacity;
    mat.dispose();
    return std;
  }
  return mat;
}

function tintModel(root: THREE.Object3D, clip: Clip, getAsset?: (id: string) => Asset | undefined) {
  root.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const src = Array.isArray(child.material) ? child.material : [child.material];
    const next = src.map(m => toStandard(m));
    child.material = Array.isArray(child.material) ? next : next[0];
    for (const mat of next) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) {
        if ('wireframe' in mat) (mat as THREE.MeshBasicMaterial).wireframe = !!clip.meshWireframe;
        continue;
      }
      mat.wireframe = !!clip.meshWireframe;
      mat.color.set(hexToInt(clip.meshColor || '#ffffff'));
      mat.metalness = clip.meshMetalness ?? 0.38;
      mat.roughness = clip.meshRoughness ?? 0.32;
      applyMap(mat, clip, getAsset, { preserveExisting: true });
      mat.needsUpdate = true;
    }
  });
}

/** Render the clip's mesh into a WebGL canvas for compositing. */
export function renderMeshLayer(
  clip: Clip,
  clipTime: number,
  getAsset?: (id: string) => Asset | undefined,
): HTMLCanvasElement | null {
  try {
    ensure();
    if (!renderer || !scene || !camera) return null;
    setLightRig(clip);

    const rx = ((clip.meshRotX ? evalProp(clip.meshRotX, clipTime) : 18) * Math.PI) / 180;
    const ry = ((clip.meshRotY ? evalProp(clip.meshRotY, clipTime) : 0) * Math.PI) / 180;
    const rz = ((clip.meshRotZ ? evalProp(clip.meshRotZ, clipTime) : 0) * Math.PI) / 180;

    const modelAsset = clip.meshShape === 'model' && clip.assetId && getAsset
      ? getAsset(clip.assetId)
      : undefined;

    if (modelAsset?.url) {
      const group = requestModel(modelAsset);
      if (primitive) primitive.visible = false;
      if (group) {
        showModel(group);
        group.rotation.set(rx, ry, rz);
        tintModel(group, clip, getAsset);
        frameObject(group);
      } else {
        hideModel();
        const segs = clip.meshSegments ?? 32;
        syncPrimitive('cube', segs);
        if (primitive) {
          primitive.visible = true;
          applyStandard(primitive.material as THREE.MeshStandardMaterial, clip, getAsset);
          primitive.rotation.set(rx, ry, rz);
          frameObject(primitive);
        }
      }
    } else {
      hideModel();
      const shape = clip.meshShape && clip.meshShape !== 'model' ? clip.meshShape : 'cube';
      const segs = clip.meshSegments ?? 32;
      syncPrimitive(shape, segs);
      if (!primitive) return null;
      primitive.visible = true;
      applyStandard(primitive.material as THREE.MeshStandardMaterial, clip, getAsset);
      primitive.rotation.set(rx, ry, rz);
      frameObject(primitive);
    }

    renderer.render(scene, camera);
    return renderer.domElement;
  } catch {
    return null;
  }
}
