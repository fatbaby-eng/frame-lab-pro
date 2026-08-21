import * as THREE from 'three';
import { evalProp } from './types';
import type { Clip } from './types';

const SIZE = 512;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let mesh: THREE.Mesh | null = null;
let currentShape = '';
let currentColor = '';
let currentWire = false;

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
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 0.15, 3.4);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x1e1b4b, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(2.2, 2.4, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa5b4fc, 0.45);
  fill.position.set(-2.5, 0.4, 1.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(0, 1.2, -2.4);
  scene.add(rim);
}

function geometryFor(shape: string): THREE.BufferGeometry {
  switch (shape) {
    case 'sphere': return new THREE.SphereGeometry(0.92, 48, 32);
    case 'torus': return new THREE.TorusGeometry(0.72, 0.28, 24, 64);
    case 'cone': return new THREE.ConeGeometry(0.85, 1.5, 40);
    case 'dodecahedron': return new THREE.DodecahedronGeometry(0.95);
    case 'icosahedron': return new THREE.IcosahedronGeometry(0.95);
    default: return new THREE.BoxGeometry(1.25, 1.25, 1.25);
  }
}

function hexToInt(hex: string): number {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  return parseInt(full.slice(0, 6), 16) || 0x6366f1;
}

function syncMesh(shape: string, color: string, wireframe: boolean) {
  if (!scene) return;
  if (mesh && currentShape === shape && currentColor === color && currentWire === wireframe) return;

  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
    else mat.dispose();
    mesh = null;
  }

  const material = new THREE.MeshStandardMaterial({
    color: hexToInt(color),
    metalness: 0.38,
    roughness: 0.32,
    wireframe,
    envMapIntensity: 1,
  });
  mesh = new THREE.Mesh(geometryFor(shape), material);
  scene.add(mesh);
  currentShape = shape;
  currentColor = color;
  currentWire = wireframe;
}

/** Render the clip's mesh into a WebGL canvas for compositing. */
export function renderMeshLayer(clip: Clip, clipTime: number): HTMLCanvasElement | null {
  try {
    ensure();
    if (!renderer || !scene || !camera) return null;
    syncMesh(clip.meshShape || 'cube', clip.meshColor || '#6366f1', !!clip.meshWireframe);
    if (!mesh) return null;

    const rx = ((clip.meshRotX ? evalProp(clip.meshRotX, clipTime) : 18) * Math.PI) / 180;
    const ry = ((clip.meshRotY ? evalProp(clip.meshRotY, clipTime) : 0) * Math.PI) / 180;
    const rz = ((clip.meshRotZ ? evalProp(clip.meshRotZ, clipTime) : 0) * Math.PI) / 180;
    mesh.rotation.set(rx, ry, rz);

    renderer.render(scene, camera);
    return renderer.domElement;
  } catch {
    return null;
  }
}

export const MESH_SPRITE = 320;
