import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from '../../context/AppContext';
import {
  Box,
  Circle,
  Hexagon,
  Triangle,
  Loader,
  RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type MeshShape = 'cube' | 'sphere' | 'torus' | 'dodecahedron' | 'icosahedron' | 'cone';

function AnimatedMesh({ shape, wireframe, color, scale, speed }: {
  shape: MeshShape;
  wireframe: boolean;
  color: string;
  scale: number;
  speed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * speed * 0.5;
      meshRef.current.rotation.x += delta * speed * 0.2;
    }
  });

  const geometry = useMemo(() => {
    switch (shape) {
      case 'cube': return <boxGeometry args={[1.5, 1.5, 1.5]} />;
      case 'sphere': return <sphereGeometry args={[1, 64, 64]} />;
      case 'torus': return <torusKnotGeometry args={[0.8, 0.25, 128, 32]} />;
      case 'dodecahedron': return <dodecahedronGeometry args={[1.2]} />;
      case 'icosahedron': return <icosahedronGeometry args={[1.2, 0]} />;
      case 'cone': return <coneGeometry args={[1, 2, 64]} />;
      default: return <boxGeometry args={[1.5, 1.5, 1.5]} />;
    }
  }, [shape]);

  return (
    <mesh ref={meshRef} scale={scale}>
      {geometry}
      <meshStandardMaterial
        color={color}
        wireframe={wireframe}
        roughness={0.3}
        metalness={0.6}
        envMapIntensity={1}
      />
    </mesh>
  );
}

function Scene({ shape, wireframe, color, scale, speed, showGrid, darkMode }: {
  shape: MeshShape;
  wireframe: boolean;
  color: string;
  scale: number;
  speed: number;
  showGrid: boolean;
  darkMode: boolean;
}) {
  return (
    <>
      <ambientLight intensity={darkMode ? 0.4 : 0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#818cf8" />
      <AnimatedMesh shape={shape} wireframe={wireframe} color={color} scale={scale} speed={speed} />
      {showGrid && <Grid args={[20, 20]} cellSize={1} cellThickness={0.5} cellColor="#6366f133" sectionSize={5} sectionThickness={1} sectionColor="#6366f166" fadeDistance={25} fadeStrength={1} infiniteGrid />}
      <Environment preset="city" />
      <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
    </>
  );
}

export default function MeshViewer() {
  const { showToast } = useApp();
  const [shape, setShape] = useState<MeshShape>('torus');
  const [wireframe, setWireframe] = useState(false);
  const [color, setColor] = useState('#6366f1');
  const [scale, setScale] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const shapes: { id: MeshShape; label: string; icon: LucideIcon }[] = [
    { id: 'cube', label: 'Cube', icon: Box },
    { id: 'sphere', label: 'Sphere', icon: Circle },
    { id: 'torus', label: 'Torus Knot', icon: Hexagon },
    { id: 'dodecahedron', label: 'Dodecahedron', icon: Hexagon },
    { id: 'icosahedron', label: 'Icosahedron', icon: Triangle },
    { id: 'cone', label: 'Cone', icon: Triangle },
  ];

  return (
    <div className="flex h-full">
      {/* 3D Viewport */}
      <div className="flex-1 relative bg-gradient-to-br from-surface-900 to-surface-800">
        <Suspense fallback={
          <div className="h-full flex items-center justify-center text-slate-400">
            <Loader className="animate-spin mr-2" size={20} />
            Loading 3D engine...
          </div>
        }>
          <Canvas camera={{ position: [3, 3, 5], fov: 45 }} shadows>
            <Scene
              shape={shape}
              wireframe={wireframe}
              color={color}
              scale={scale}
              speed={speed}
              showGrid={showGrid}
              darkMode={darkMode}
            />
          </Canvas>
        </Suspense>

        {/* Viewport overlay info */}
        <div className="absolute top-4 left-4 bg-surface-800/80 backdrop-blur-sm border border-surface-600 rounded-lg px-3 py-2 text-xs text-slate-300">
          <div className="font-mono">Shape: <span className="text-accent-light">{shape}</span></div>
          <div className="font-mono">Scale: {scale.toFixed(2)}x</div>
          <div className="font-mono">Speed: {speed.toFixed(1)}x</div>
        </div>
      </div>

      {/* Properties Panel */}
      <div className="w-72 bg-surface-800 border-l border-surface-600 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-surface-600">
          <h2 className="text-sm font-semibold text-white mb-1">3D Mesh Lab</h2>
          <p className="text-xs text-slate-400">Procedural geometry viewer & editor</p>
        </div>

        <div className="p-4 space-y-6">
          {/* Shape selector */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Primitive</label>
            <div className="grid grid-cols-3 gap-2">
              {shapes.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setShape(s.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                      shape === s.id
                        ? 'bg-accent/20 border-accent text-accent-light'
                        : 'bg-surface-700 border-surface-600 text-slate-400 hover:text-white hover:border-surface-500'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-[10px]">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Material Color</label>
            <div className="flex gap-2 flex-wrap">
              {['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#ffffff', '#1e293b'].map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="mt-2 w-full h-8 rounded cursor-pointer bg-surface-700 border border-surface-600"
            />
          </div>

          {/* Scale */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Scale</label>
              <span className="text-xs text-slate-300">{scale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={3}
              step={0.1}
              value={scale}
              onChange={e => setScale(parseFloat(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          {/* Rotation Speed */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Rotation Speed</label>
              <span className="text-xs text-slate-300">{speed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <Toggle label="Wireframe" checked={wireframe} onChange={setWireframe} />
            <Toggle label="Show Grid" checked={showGrid} onChange={setShowGrid} />
            <Toggle label="Dark Environment" checked={darkMode} onChange={setDarkMode} />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-surface-600 space-y-2">
            <button
              onClick={() => {
                setShape('torus');
                setWireframe(false);
                setColor('#6366f1');
                setScale(1);
                setSpeed(1);
                setShowGrid(true);
                showToast('Mesh settings reset');
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs text-slate-300 transition-colors border border-surface-600"
            >
              <RotateCcw size={14} />
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs text-slate-300 group-hover:text-white transition-colors">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full relative transition-colors ${
          checked ? 'bg-accent' : 'bg-surface-600'
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-5' : ''
        }`} />
      </button>
    </label>
  );
}
