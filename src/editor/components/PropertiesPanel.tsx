import { useEditor } from '../EditorContext';
import { evalProp } from '../types';
import type { Transform, TextStyle } from '../types';
import {
  Type, Image, Video, Music, Box, Shapes, Sparkles, Trash2, Plus,
  ChevronDown, ChevronRight, Link, Link2,
} from 'lucide-react';
import { useState } from 'react';

export default function PropertiesPanel() {
  const { state, updateClipTransform, updateClipProperty, deleteClip, showToast } = useEditor();
  const { selectedClipId } = state;

  const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
  const clip = selectedClipId
    ? comp.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId)
    : null;

  const [transformOpen, setTransformOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);
  const [lockScale, setLockScale] = useState(true);

  if (!clip) {
    return (
      <div className="h-full bg-surface-800 border-l border-surface-600 flex flex-col">
        <div className="p-3 border-b border-surface-600">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Properties</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6">
          <Sparkles size={32} className="mb-3 opacity-20" />
          <p className="text-xs text-center">Select a clip on the timeline to edit its properties</p>
        </div>
      </div>
    );
  }

  const t = state.currentTime - clip.start;

  // Get current values at playhead
  const x = evalProp(clip.transform.x, t);
  const y = evalProp(clip.transform.y, t);
  const scaleX = evalProp(clip.transform.scaleX, t);
  const scaleY = evalProp(clip.transform.scaleY, t);
  const rotation = evalProp(clip.transform.rotation, t);
  const opacity = evalProp(clip.transform.opacity, t);

  const updateValue = (key: keyof Transform, value: number) => {
    const newTransform: Transform = {
      ...clip!.transform,
      [key]: {
        keyframes: [{ time: 0, value, easing: 'linear' }],
      },
    };

    // If lock is enabled, sync scaleX and scaleY
    if (lockScale) {
      if (key === 'scaleX') {
        newTransform.scaleY = { keyframes: [{ time: 0, value, easing: 'linear' }] };
      } else if (key === 'scaleY') {
        newTransform.scaleX = { keyframes: [{ time: 0, value, easing: 'linear' }] };
      }
    }

    updateClipTransform(clip!.id, newTransform);
  };

  const addKeyframe = (_key: keyof Transform) => {
    showToast('Keyframe at current time');
  };

  const iconForType = () => {
    switch (clip.type) {
      case 'text': return <Type size={14} />;
      case 'image': return <Image size={14} />;
      case 'video': return <Video size={14} />;
      case 'audio': return <Music size={14} />;
      case 'mesh3d': return <Box size={14} />;
      case 'shape': return <Shapes size={14} />;
      default: return <Sparkles size={14} />;
    }
  };

  // Pixel dimensions for shapes (base size = 100)
  const shapeWidth = Math.round(100 * scaleX);
  const shapeHeight = Math.round(100 * scaleY);

  return (
    <div className="h-full bg-surface-800 border-l border-surface-600 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-surface-600">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-accent-light">{iconForType()}</span>
          <h2 className="text-xs font-semibold text-white truncate">{clip.name}</h2>
        </div>
        <p className="text-[10px] text-slate-500">{clip.type.toUpperCase()} · {clip.duration.toFixed(2)}s</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Transform */}
        <div className="border-b border-surface-700">
          <button
            onClick={() => setTransformOpen(!transformOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:text-white"
          >
            <span>Transform</span>
            {transformOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {transformOpen && (
            <div className="px-3 pb-3 space-y-2">
              <PropRow label="Position X" value={x} min={-2000} max={2000} step={1} onChange={v => updateValue('x', v)} onKeyframe={() => addKeyframe('x')} />
              <PropRow label="Position Y" value={y} min={-2000} max={2000} step={1} onChange={v => updateValue('y', v)} onKeyframe={() => addKeyframe('y')} />

              {/* Scale with lock toggle */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-slate-400 w-16 shrink-0">Scale X</label>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.01}
                  value={scaleX}
                  onChange={e => updateValue('scaleX', parseFloat(e.target.value))}
                  className="flex-1 accent-accent h-4"
                />
                <input
                  type="number"
                  value={Number(scaleX.toFixed(3))}
                  onChange={e => updateValue('scaleX', parseFloat(e.target.value) || 0)}
                  className="w-14 px-1 py-0.5 rounded bg-surface-700 border border-surface-600 text-[10px] text-white focus:border-accent outline-none text-right"
                  step={0.01}
                />
                <button
                  onClick={() => addKeyframe('scaleX')}
                  className="w-4 h-4 rounded-full bg-surface-600 hover:bg-accent text-[8px] text-slate-400 hover:text-white flex items-center justify-center"
                  title="Add keyframe"
                >
                  <Plus size={8} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] text-slate-400 w-16 shrink-0">Scale Y</label>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.01}
                  value={scaleY}
                  onChange={e => updateValue('scaleY', parseFloat(e.target.value))}
                  className="flex-1 accent-accent h-4"
                />
                <input
                  type="number"
                  value={Number(scaleY.toFixed(3))}
                  onChange={e => updateValue('scaleY', parseFloat(e.target.value) || 0)}
                  className="w-14 px-1 py-0.5 rounded bg-surface-700 border border-surface-600 text-[10px] text-white focus:border-accent outline-none text-right"
                  step={0.01}
                />
                <button
                  onClick={() => setLockScale(!lockScale)}
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${lockScale ? 'bg-accent/30 text-accent-light' : 'bg-surface-600 text-slate-500 hover:text-slate-300'}`}
                  title={lockScale ? 'Scale proportions locked' : 'Scale proportions unlocked'}
                >
                  {lockScale ? <Link size={10} /> : <Link2 size={10} />}
                </button>
              </div>

              <PropRow label="Rotation" value={rotation} min={-360} max={360} step={1} onChange={v => updateValue('rotation', v)} onKeyframe={() => addKeyframe('rotation')} />
              <PropRow label="Opacity" value={opacity} min={0} max={1} step={0.01} onChange={v => updateValue('opacity', v)} onKeyframe={() => addKeyframe('opacity')} />

              {/* Pixel dimensions for shapes */}
              {clip.type === 'shape' && (
                <div className="flex items-center gap-2 pt-1 border-t border-surface-700/50">
                  <label className="text-[10px] text-slate-500 w-16 shrink-0">Size</label>
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 bg-surface-700/50 rounded px-2 py-1 text-center">
                      <span className="text-[9px] text-slate-500">W</span>
                      <span className="text-[10px] text-slate-300 ml-1 font-mono">{shapeWidth}px</span>
                    </div>
                    <div className="flex-1 bg-surface-700/50 rounded px-2 py-1 text-center">
                      <span className="text-[9px] text-slate-500">H</span>
                      <span className="text-[10px] text-slate-300 ml-1 font-mono">{shapeHeight}px</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Layer-specific properties */}
        {clip.type === 'text' && clip.textStyle && (
          <div className="border-b border-surface-700">
            <button
              onClick={() => setStyleOpen(!styleOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              <span>Text Style</span>
              {styleOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {styleOpen && (
              <div className="px-3 pb-3 space-y-2">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Content</label>
                  <input
                    value={clip.textContent || ''}
                    onChange={e => updateClipProperty(clip.id, 'textContent', e.target.value)}
                    className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Font Size</label>
                    <input
                      type="number"
                      value={clip.textStyle.fontSize}
                      onChange={e => {
                        const style: TextStyle = { ...clip.textStyle!, fontSize: parseInt(e.target.value) || 48 };
                        updateClipProperty(clip.id, 'textStyle', style);
                      }}
                      className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Color</label>
                    <input
                      type="color"
                      value={clip.textStyle.color}
                      onChange={e => {
                        const style: TextStyle = { ...clip.textStyle!, color: e.target.value };
                        updateClipProperty(clip.id, 'textStyle', style);
                      }}
                      className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Align</label>
                  <div className="flex gap-1 bg-surface-700 rounded p-0.5">
                    {(['left', 'center', 'right'] as const).map(a => (
                      <button
                        key={a}
                        onClick={() => {
                          const style: TextStyle = { ...clip.textStyle!, align: a };
                          updateClipProperty(clip.id, 'textStyle', style);
                        }}
                        className={`flex-1 py-0.5 text-[10px] rounded capitalize ${clip.textStyle!.align === a ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clip.textStyle.bold}
                      onChange={e => {
                        const style: TextStyle = { ...clip.textStyle!, bold: e.target.checked };
                        updateClipProperty(clip.id, 'textStyle', style);
                      }}
                      className="accent-accent"
                    />
                    Bold
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clip.textStyle.italic}
                      onChange={e => {
                        const style: TextStyle = { ...clip.textStyle!, italic: e.target.checked };
                        updateClipProperty(clip.id, 'textStyle', style);
                      }}
                      className="accent-accent"
                    />
                    Italic
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {clip.type === 'shape' && (
          <div className="border-b border-surface-700">
            <div className="px-3 py-2 text-xs font-medium text-slate-300">Shape</div>
            <div className="px-3 pb-3 space-y-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Shape Type</label>
                <div className="flex gap-1 bg-surface-700 rounded p-0.5">
                  {(['rect', 'circle', 'triangle', 'star'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => updateClipProperty(clip.id, 'shapeType', s)}
                      className={`flex-1 py-0.5 text-[10px] rounded capitalize ${clip.shapeType === s ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Color</label>
                  <input
                    type="color"
                    value={clip.shapeColor || '#6366f1'}
                    onChange={e => updateClipProperty(clip.id, 'shapeColor', e.target.value)}
                    className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Stroke</label>
                  <input
                    type="number"
                    value={clip.shapeStroke || 0}
                    onChange={e => updateClipProperty(clip.id, 'shapeStroke', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {clip.type === 'mesh3d' && (
          <div className="border-b border-surface-700">
            <div className="px-3 py-2 text-xs font-medium text-slate-300">3D Mesh</div>
            <div className="px-3 pb-3 space-y-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Primitive</label>
                <div className="flex flex-wrap gap-1">
                  {(['cube', 'sphere', 'torus', 'dodecahedron', 'icosahedron', 'cone'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => updateClipProperty(clip.id, 'meshShape', s)}
                      className={`px-2 py-0.5 text-[10px] rounded capitalize ${clip.meshShape === s ? 'bg-accent text-white' : 'bg-surface-700 text-slate-400 hover:text-white'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Color</label>
                  <input
                    type="color"
                    value={clip.meshColor || '#6366f1'}
                    onChange={e => updateClipProperty(clip.id, 'meshColor', e.target.value)}
                    className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer"
                  />
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clip.meshWireframe || false}
                  onChange={e => updateClipProperty(clip.id, 'meshWireframe', e.target.checked)}
                  className="accent-accent"
                />
                Wireframe
              </label>
            </div>
          </div>
        )}

        {/* Path properties */}
        {clip.type === 'path' && clip.pathData && (
          <div className="border-b border-surface-700">
            <div className="px-3 py-2 text-xs font-medium text-slate-300">Path</div>
            <div className="px-3 pb-3 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Stroke</label>
                  <input
                    type="color"
                    value={clip.pathStrokeColor || '#6366f1'}
                    onChange={e => updateClipProperty(clip.id, 'pathStrokeColor', e.target.value)}
                    className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Fill</label>
                  <input
                    type="color"
                    value={clip.pathFillColor === 'transparent' ? '#000000' : (clip.pathFillColor || '#000000')}
                    onChange={e => updateClipProperty(clip.id, 'pathFillColor', e.target.value)}
                    className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Stroke Width</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.5}
                    max={20}
                    step={0.5}
                    value={clip.pathStrokeWidth || 3}
                    onChange={e => updateClipProperty(clip.id, 'pathStrokeWidth', parseFloat(e.target.value))}
                    className="flex-1 accent-accent h-4"
                  />
                  <span className="text-[10px] text-slate-300 w-8 text-right">{clip.pathStrokeWidth || 3}px</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => updateClipProperty(clip.id, 'pathData', { ...clip.pathData!, closed: !clip.pathData!.closed })}
                  className="flex-1 px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 text-[10px] text-slate-300 border border-surface-600 transition-colors"
                >
                  {clip.pathData.closed ? 'Open Path' : 'Close Path'}
                </button>
                <button
                  onClick={() => {
                    updateClipProperty(clip.id, 'pathData', { points: [], closed: false });
                    showToast('Path cleared');
                  }}
                  className="flex-1 px-2 py-1 rounded bg-surface-700 hover:bg-red-500/20 text-[10px] text-slate-300 hover:text-red-400 border border-surface-600 transition-colors"
                >
                  Clear Path
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-3">
          <button
            onClick={() => {
              deleteClip(clip.id);
              showToast('Clip deleted');
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors border border-red-500/20"
          >
            <Trash2 size={12} />
            Delete Clip
          </button>
        </div>
      </div>
    </div>
  );
}

function PropRow({ label, value, min, max, step, onChange, onKeyframe }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onKeyframe: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-slate-400 w-16 shrink-0">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-accent h-4"
      />
      <input
        type="number"
        value={Number(value.toFixed(3))}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-14 px-1 py-0.5 rounded bg-surface-700 border border-surface-600 text-[10px] text-white focus:border-accent outline-none text-right"
        step={step}
      />
      <button
        onClick={onKeyframe}
        className="w-4 h-4 rounded-full bg-surface-600 hover:bg-accent text-[8px] text-slate-400 hover:text-white flex items-center justify-center"
        title="Add keyframe"
      >
        <Plus size={8} />
      </button>
    </div>
  );
}
