import { useEditor } from '../EditorContext';
import {
  evalProp, hasKeyframeAt, easingAt, COMP_PRESETS, findClip,
} from '../types';
import type { Transform, TextStyle, Easing, LayerEffect, EffectType } from '../types';
import {
  Type, Image, Video, Music, Box, Shapes, Sparkles, Trash2,
  ChevronDown, ChevronRight, Link, Unlink, Diamond, Settings,
} from 'lucide-react';
import { useState } from 'react';

const EASINGS: Easing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'hold'];

export default function PropertiesPanel() {
  const {
    state, setTransformValues, updateClipProperty, deleteClip, showToast,
    toggleKeyframe, setKeyframeEasing, updateComposition, setCompositionDuration,
    setAutoKey,
  } = useEditor();
  const { selectedClipId, autoKey } = state;

  const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
  const clip = selectedClipId ? findClip(comp, selectedClipId) : null;

  const [transformOpen, setTransformOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);
  const [lockScale, setLockScale] = useState(true);

  if (!clip) {
    return (
      <div className="h-full bg-surface-800 border-l border-surface-600 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-surface-600 flex items-center gap-2">
          <Settings size={12} className="text-accent-light" />
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Composition</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">Name</label>
            <input
              value={comp.name}
              onChange={e => updateComposition({ name: e.target.value })}
              className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">Preset</label>
            <div className="grid grid-cols-2 gap-1">
              {COMP_PRESETS.map(p => (
                <button
                  key={p.name}
                  onClick={() => updateComposition({ width: p.width, height: p.height, fps: p.fps })}
                  className={`px-2 py-1 rounded text-[10px] border ${comp.width === p.width && comp.height === p.height ? 'bg-accent/20 border-accent text-accent-light' : 'bg-surface-700 border-surface-600 text-slate-400 hover:text-white'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">Width</label>
              <input type="number" value={comp.width} onChange={e => updateComposition({ width: parseInt(e.target.value) || 1920 })} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">Height</label>
              <input type="number" value={comp.height} onChange={e => updateComposition({ height: parseInt(e.target.value) || 1080 })} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">FPS</label>
              <input type="number" value={comp.fps} onChange={e => updateComposition({ fps: Math.max(1, parseInt(e.target.value) || 30) })} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">Duration (s)</label>
              <input type="number" value={comp.duration} onChange={e => setCompositionDuration(parseFloat(e.target.value) || 1)} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">Background</label>
            <input
              type="color"
              value={comp.backgroundColor || '#0a0a0f'}
              onChange={e => updateComposition({ backgroundColor: e.target.value })}
              className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer"
            />
          </div>
          <p className="text-[10px] text-slate-500 pt-4">Select a clip on the timeline to edit layer properties. Double-click a clip to show keyframes.</p>
        </div>
      </div>
    );
  }

  const t = Math.max(0, state.currentTime - clip.start);
  const x = evalProp(clip.transform.x, t);
  const y = evalProp(clip.transform.y, t);
  const scaleX = evalProp(clip.transform.scaleX, t);
  const scaleY = evalProp(clip.transform.scaleY, t);
  const rotation = evalProp(clip.transform.rotation, t);
  const opacity = evalProp(clip.transform.opacity, t);
  const anchorX = clip.transform.anchorX ? evalProp(clip.transform.anchorX, t) : 0;
  const anchorY = clip.transform.anchorY ? evalProp(clip.transform.anchorY, t) : 0;

  const updateValue = (key: keyof Transform, value: number) => {
    if (lockScale && (key === 'scaleX' || key === 'scaleY')) {
      setTransformValues(clip.id, { scaleX: value, scaleY: value });
      return;
    }
    setTransformValues(clip.id, { [key]: value });
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

  const shapeWidth = Math.round(100 * scaleX);
  const shapeHeight = Math.round(100 * scaleY);
  const effects = clip.effects ?? [];

  const addEffect = (type: EffectType) => {
    const next: LayerEffect[] = [...effects, {
      id: `fx-${Date.now()}`,
      type,
      amount: type === 'blur' ? 8 : 100,
    }];
    updateClipProperty(clip.id, 'effects', next);
  };

  const updateEffect = (id: string, amount: number) => {
    updateClipProperty(clip.id, 'effects', effects.map(e => e.id === id ? { ...e, amount } : e));
  };

  const removeEffect = (id: string) => {
    updateClipProperty(clip.id, 'effects', effects.filter(e => e.id !== id));
  };

  return (
    <div className="h-full bg-surface-800 border-l border-surface-600 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-surface-600">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-accent-light">{iconForType()}</span>
          <h2 className="text-xs font-semibold text-white truncate">{clip.name}</h2>
        </div>
        <p className="text-[10px] text-slate-500">{clip.type.toUpperCase()} · {clip.duration.toFixed(2)}s</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-slate-500">Auto-key</span>
          <button
            onClick={() => setAutoKey(!autoKey)}
            className={`w-6 h-3.5 rounded-full relative transition-colors ${autoKey ? 'bg-accent' : 'bg-surface-600'}`}
            title="Record keyframes when values change"
          >
            <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${autoKey ? 'translate-x-2.5' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
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
              <PropRow label="Position X" value={x} min={-2000} max={2000} step={1} onChange={v => updateValue('x', v)} keyed={hasKeyframeAt(clip.transform.x, t)} onKeyframe={() => toggleKeyframe(clip.id, 'x')} easing={easingAt(clip.transform.x, t)} onEasing={e => setKeyframeEasing(clip.id, 'x', e)} />
              <PropRow label="Position Y" value={y} min={-2000} max={2000} step={1} onChange={v => updateValue('y', v)} keyed={hasKeyframeAt(clip.transform.y, t)} onKeyframe={() => toggleKeyframe(clip.id, 'y')} easing={easingAt(clip.transform.y, t)} onEasing={e => setKeyframeEasing(clip.id, 'y', e)} />
              <PropRow label="Anchor X" value={anchorX} min={-500} max={500} step={1} onChange={v => updateValue('anchorX', v)} keyed={!!clip.transform.anchorX && hasKeyframeAt(clip.transform.anchorX, t)} onKeyframe={() => toggleKeyframe(clip.id, 'anchorX')} />
              <PropRow label="Anchor Y" value={anchorY} min={-500} max={500} step={1} onChange={v => updateValue('anchorY', v)} keyed={!!clip.transform.anchorY && hasKeyframeAt(clip.transform.anchorY, t)} onKeyframe={() => toggleKeyframe(clip.id, 'anchorY')} />

              <div className="flex items-center gap-2">
                <label className="text-[10px] text-slate-400 w-16 shrink-0">Scale X</label>
                <input type="range" min={0} max={5} step={0.01} value={scaleX} onChange={e => updateValue('scaleX', parseFloat(e.target.value))} className="flex-1 accent-accent h-4" />
                <input type="number" value={Number(scaleX.toFixed(3))} onChange={e => updateValue('scaleX', parseFloat(e.target.value) || 0)} className="w-14 px-1 py-0.5 rounded bg-surface-700 border border-surface-600 text-[10px] text-white focus:border-accent outline-none text-right" step={0.01} />
                <KfButton active={hasKeyframeAt(clip.transform.scaleX, t)} onClick={() => toggleKeyframe(clip.id, 'scaleX')} />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] text-slate-400 w-16 shrink-0">Scale Y</label>
                <input type="range" min={0} max={5} step={0.01} value={scaleY} onChange={e => updateValue('scaleY', parseFloat(e.target.value))} className="flex-1 accent-accent h-4" />
                <input type="number" value={Number(scaleY.toFixed(3))} onChange={e => updateValue('scaleY', parseFloat(e.target.value) || 0)} className="w-14 px-1 py-0.5 rounded bg-surface-700 border border-surface-600 text-[10px] text-white focus:border-accent outline-none text-right" step={0.01} />
                <button
                  onClick={() => setLockScale(!lockScale)}
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${lockScale ? 'bg-accent/30 text-accent-light' : 'bg-surface-600 text-slate-500 hover:text-slate-300'}`}
                  title={lockScale ? 'Scale proportions locked' : 'Scale proportions unlocked'}
                >
                  {lockScale ? <Link size={10} /> : <Unlink size={10} />}
                </button>
              </div>

              <PropRow label="Rotation" value={rotation} min={-360} max={360} step={1} onChange={v => updateValue('rotation', v)} keyed={hasKeyframeAt(clip.transform.rotation, t)} onKeyframe={() => toggleKeyframe(clip.id, 'rotation')} easing={easingAt(clip.transform.rotation, t)} onEasing={e => setKeyframeEasing(clip.id, 'rotation', e)} />
              <PropRow label="Opacity" value={opacity} min={0} max={1} step={0.01} onChange={v => updateValue('opacity', v)} keyed={hasKeyframeAt(clip.transform.opacity, t)} onKeyframe={() => toggleKeyframe(clip.id, 'opacity')} easing={easingAt(clip.transform.opacity, t)} onEasing={e => setKeyframeEasing(clip.id, 'opacity', e)} />

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

        {clip.type === 'text' && clip.textStyle && (
          <div className="border-b border-surface-700">
            <button onClick={() => setStyleOpen(!styleOpen)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:text-white">
              <span>Text Style</span>
              {styleOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {styleOpen && (
              <div className="px-3 pb-3 space-y-2">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Content</label>
                  <input value={clip.textContent || ''} onChange={e => updateClipProperty(clip.id, 'textContent', e.target.value)} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Font Size</label>
                    <input type="number" value={clip.textStyle.fontSize} onChange={e => { const style: TextStyle = { ...clip.textStyle!, fontSize: parseInt(e.target.value) || 48 }; updateClipProperty(clip.id, 'textStyle', style); }} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Color</label>
                    <input type="color" value={clip.textStyle.color} onChange={e => { const style: TextStyle = { ...clip.textStyle!, color: e.target.value }; updateClipProperty(clip.id, 'textStyle', style); }} className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Align</label>
                  <div className="flex gap-1 bg-surface-700 rounded p-0.5">
                    {(['left', 'center', 'right'] as const).map(a => (
                      <button key={a} onClick={() => { const style: TextStyle = { ...clip.textStyle!, align: a }; updateClipProperty(clip.id, 'textStyle', style); }} className={`flex-1 py-0.5 text-[10px] rounded capitalize ${clip.textStyle!.align === a ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}>{a}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={clip.textStyle.bold} onChange={e => { const style: TextStyle = { ...clip.textStyle!, bold: e.target.checked }; updateClipProperty(clip.id, 'textStyle', style); }} className="accent-accent" />
                    Bold
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={clip.textStyle.italic} onChange={e => { const style: TextStyle = { ...clip.textStyle!, italic: e.target.checked }; updateClipProperty(clip.id, 'textStyle', style); }} className="accent-accent" />
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
                    <button key={s} onClick={() => updateClipProperty(clip.id, 'shapeType', s)} className={`flex-1 py-0.5 text-[10px] rounded capitalize ${clip.shapeType === s ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Color</label>
                  <input type="color" value={clip.shapeColor || '#6366f1'} onChange={e => updateClipProperty(clip.id, 'shapeColor', e.target.value)} className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Stroke</label>
                  <input type="number" value={clip.shapeStroke || 0} onChange={e => updateClipProperty(clip.id, 'shapeStroke', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
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
                    <button key={s} onClick={() => updateClipProperty(clip.id, 'meshShape', s)} className={`px-2 py-0.5 text-[10px] rounded capitalize ${clip.meshShape === s ? 'bg-accent text-white' : 'bg-surface-700 text-slate-400 hover:text-white'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 mb-1 block">Color</label>
                <input type="color" value={clip.meshColor || '#6366f1'} onChange={e => updateClipProperty(clip.id, 'meshColor', e.target.value)} className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer" />
              </div>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                <input type="checkbox" checked={clip.meshWireframe || false} onChange={e => updateClipProperty(clip.id, 'meshWireframe', e.target.checked)} className="accent-accent" />
                Wireframe
              </label>
            </div>
          </div>
        )}

        {clip.type !== 'path' && (
          <div className="border-b border-surface-700">
            <div className="px-3 py-2 text-xs font-medium text-slate-300">Parent & Path</div>
            <div className="px-3 pb-3 space-y-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Parent Layer</label>
                <select
                  value={clip.parentId || ''}
                  onChange={e => updateClipProperty(clip.id, 'parentId', e.target.value || undefined)}
                  className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                >
                  <option value="">None</option>
                  {comp.tracks.flatMap(tr => tr.clips)
                    .filter(c => c.id !== clip.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Follow Path</label>
                <select
                  value={clip.motionPathClipId || ''}
                  onChange={e => updateClipProperty(clip.id, 'motionPathClipId', e.target.value || undefined)}
                  className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                >
                  <option value="">None</option>
                  {comp.tracks.flatMap(tr => tr.clips)
                    .filter(c => c.type === 'path' && c.pathData && c.pathData.points.length >= 2)
                    .map(pathClip => (
                      <option key={pathClip.id} value={pathClip.id}>{pathClip.name}</option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {clip.type === 'path' && clip.pathData && (
          <div className="border-b border-surface-700">
            <div className="px-3 py-2 text-xs font-medium text-slate-300">Path</div>
            <div className="px-3 pb-3 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Stroke</label>
                  <input type="color" value={clip.pathStrokeColor || '#6366f1'} onChange={e => updateClipProperty(clip.id, 'pathStrokeColor', e.target.value)} className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Fill</label>
                  <input type="color" value={clip.pathFillColor === 'transparent' ? '#000000' : (clip.pathFillColor || '#000000')} onChange={e => updateClipProperty(clip.id, 'pathFillColor', e.target.value)} className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Stroke Width</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0.5} max={20} step={0.5} value={clip.pathStrokeWidth || 3} onChange={e => updateClipProperty(clip.id, 'pathStrokeWidth', parseFloat(e.target.value))} className="flex-1 accent-accent h-4" />
                  <span className="text-[10px] text-slate-300 w-8 text-right">{clip.pathStrokeWidth || 3}px</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => updateClipProperty(clip.id, 'pathData', { ...clip.pathData!, closed: !clip.pathData!.closed })} className="flex-1 px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 text-[10px] text-slate-300 border border-surface-600 transition-colors">
                  {clip.pathData.closed ? 'Open Path' : 'Close Path'}
                </button>
                <button onClick={() => { updateClipProperty(clip.id, 'pathData', { points: [], closed: false }); showToast('Path cleared'); }} className="flex-1 px-2 py-1 rounded bg-surface-700 hover:bg-red-500/20 text-[10px] text-slate-300 hover:text-red-400 border border-surface-600 transition-colors">
                  Clear Path
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="border-b border-surface-700">
          <div className="px-3 py-2 text-xs font-medium text-slate-300">Effects</div>
          <div className="px-3 pb-3 space-y-2">
            {effects.map(fx => (
              <div key={fx.id} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-16 capitalize shrink-0">{fx.type}</span>
                <input
                  type="range"
                  min={0}
                  max={fx.type === 'blur' ? 40 : 200}
                  step={1}
                  value={fx.amount}
                  onChange={e => updateEffect(fx.id, parseFloat(e.target.value))}
                  className="flex-1 accent-accent h-4"
                />
                <span className="text-[10px] text-slate-400 w-8 text-right">{fx.amount}</span>
                <button onClick={() => removeEffect(fx.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={10} /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1">
              {(['blur', 'brightness', 'contrast', 'saturate'] as EffectType[]).map(type => (
                <button key={type} onClick={() => addEffect(type)} className="px-2 py-0.5 rounded bg-surface-700 hover:bg-surface-600 text-[10px] text-slate-400 capitalize">
                  + {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3">
          <button
            onClick={() => { deleteClip(clip.id); showToast('Clip deleted'); }}
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

function KfButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-4 h-4 flex items-center justify-center ${active ? 'text-accent-light' : 'text-slate-600 hover:text-slate-300'}`}
      title={active ? 'Remove keyframe' : 'Add keyframe'}
    >
      <Diamond size={10} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

function PropRow({ label, value, min, max, step, onChange, onKeyframe, keyed, easing, onEasing }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onKeyframe: () => void;
  keyed?: boolean;
  easing?: Easing;
  onEasing?: (e: Easing) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-slate-400 w-16 shrink-0">{label}</label>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="flex-1 accent-accent h-4" />
        <input type="number" value={Number(value.toFixed(3))} onChange={e => onChange(parseFloat(e.target.value) || 0)} className="w-14 px-1 py-0.5 rounded bg-surface-700 border border-surface-600 text-[10px] text-white focus:border-accent outline-none text-right" step={step} />
        <KfButton active={!!keyed} onClick={onKeyframe} />
      </div>
      {keyed && onEasing && easing && (
        <div className="pl-16">
          <select
            value={easing}
            onChange={e => onEasing(e.target.value as Easing)}
            className="w-full px-1 py-0.5 rounded bg-surface-700 border border-surface-600 text-[9px] text-slate-300 outline-none"
          >
            {EASINGS.map(es => <option key={es} value={es}>{es}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
