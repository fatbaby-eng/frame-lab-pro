import { useEditor } from '../EditorContext';
import {
  evalProp, evalColorProp, hasKeyframeAt, easingAt, COMP_PRESETS, findClip, isAnimated, wouldCreateParentCycle,
  EFFECT_DEFS, MESH_PRIMITIVES, MESH_PROP_DEFS, wouldCreateCompCycle,
  ensureAnimProp, parseHexColor, hydrateTextStyle, TEXT_FONTS,
} from '../types';
import type { Transform, TextStyle, TextAlign, TextVAlign, Easing, LayerEffect, EffectType, MeshShape, MeshPropDef } from '../types';
import {
  Type, Image, Video, Music, Box, Shapes, Sparkles, Trash2,
  ChevronDown, ChevronRight, Link, Unlink, Diamond, Settings, Timer, Layers, Copy,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalSpaceBetween, Bold, Italic, Underline, CaseSensitive,
} from 'lucide-react';
import { useState, useRef, type KeyboardEvent } from 'react';
import AlignBar from './AlignBar';

const EASINGS: Easing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'hold', 'bezier'];

function stopKeys(e: KeyboardEvent) {
  e.stopPropagation();
}

function CompositionNameField({
  id,
  name,
  onRename,
}: {
  id: string;
  name: string;
  onRename: (name: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[10px] text-slate-500 mb-1 block">Name</label>
      <input
        id={id}
        type="text"
        value={name}
        autoComplete="off"
        spellCheck={false}
        onChange={e => onRename(e.target.value)}
        onKeyDown={stopKeys}
        onBlur={e => {
          const next = e.target.value.trim();
          if (!next) onRename('Untitled');
        }}
        className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
      />
    </div>
  );
}

export default function PropertiesPanel() {
  const {
    state, setTransformValues, updateClipProperty, deleteClip, showToast,
    toggleKeyframe, toggleAnimated, setKeyframeEasing, updateComposition, setCompositionDuration,
    setAutoKey, setTrackVolume, setActiveComposition, duplicateComposition, renameComposition,
    alignClipToComp,
  } = useEditor();
  const { selectedClipId, autoKey } = state;

  const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
  const clip = selectedClipId ? findClip(comp, selectedClipId) : null;

  const [transformOpen, setTransformOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);
  const [effectsOpen, setEffectsOpen] = useState(true);
  const [lockScale, setLockScale] = useState(true);

  if (!clip) {
    return (
      <div className="h-full bg-surface-800 border-l border-surface-600 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-surface-600 flex items-center gap-2">
          <Settings size={12} className="text-accent-light" />
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Composition</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <CompositionNameField
            id="active-comp-name"
            name={comp.name}
            onRename={next => renameComposition(comp.id, next)}
          />
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
          <button
            type="button"
            onClick={() => {
              const id = duplicateComposition(comp.id);
              if (id) showToast('Duplicated composition');
            }}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-surface-700 hover:bg-surface-600 text-[10px] text-slate-300 border border-surface-600"
          >
            <Copy size={11} />
            Duplicate composition
          </button>
          <p className="text-[10px] text-slate-500 pt-2">Select a clip on the timeline to edit layer properties. Nested compositions keep their own layers and properties. Double-click a nested layer to open it.</p>
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
      case 'comp': return <Layers size={14} />;
      default: return <Sparkles size={14} />;
    }
  };

  const shapeWidth = Math.round(100 * scaleX);
  const shapeHeight = Math.round(100 * scaleY);
  const effects = clip.effects ?? [];
  const nestedSource = clip.type === 'comp'
    ? state.project.compositions.find(c => c.id === clip.compositionId)
    : undefined;

  const addEffect = (type: EffectType) => {
    if (effects.some(e => e.type === type)) return;
    const def = EFFECT_DEFS[type];
    const next: LayerEffect[] = [...effects, {
      id: `fx-${Date.now()}`,
      type,
      amount: def.defaultAmount,
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
          <span className="text-accent-light shrink-0">{iconForType()}</span>
          <input
            type="text"
            value={clip.name}
            autoComplete="off"
            spellCheck={false}
            onChange={e => updateClipProperty(clip.id, 'name', e.target.value)}
            onKeyDown={stopKeys}
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none border-b border-transparent focus:border-accent"
            title="Rename layer"
          />
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
            <div className="px-3 pb-3 space-y-2.5 min-w-0">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Align to page</label>
                <AlignBar onAlign={align => alignClipToComp(clip.id, align)} />
              </div>
              <PropRow label="Position X" value={x} min={-2000} max={2000} step={1} onChange={v => updateValue('x', v)} keyed={hasKeyframeAt(clip.transform.x, t)} animated={isAnimated(clip.transform.x)} onKeyframe={() => toggleKeyframe(clip.id, 'x')} onToggleAnimated={() => toggleAnimated(clip.id, 'x')} easing={easingAt(clip.transform.x, t)} onEasing={e => setKeyframeEasing(clip.id, 'x', e)} />
              <PropRow label="Position Y" value={y} min={-2000} max={2000} step={1} onChange={v => updateValue('y', v)} keyed={hasKeyframeAt(clip.transform.y, t)} animated={isAnimated(clip.transform.y)} onKeyframe={() => toggleKeyframe(clip.id, 'y')} onToggleAnimated={() => toggleAnimated(clip.id, 'y')} easing={easingAt(clip.transform.y, t)} onEasing={e => setKeyframeEasing(clip.id, 'y', e)} />
              <PropRow label="Anchor X" value={anchorX} min={-500} max={500} step={1} onChange={v => updateValue('anchorX', v)} keyed={!!clip.transform.anchorX && hasKeyframeAt(clip.transform.anchorX, t)} animated={isAnimated(clip.transform.anchorX)} onKeyframe={() => toggleKeyframe(clip.id, 'anchorX')} onToggleAnimated={() => toggleAnimated(clip.id, 'anchorX')} />
              <PropRow label="Anchor Y" value={anchorY} min={-500} max={500} step={1} onChange={v => updateValue('anchorY', v)} keyed={!!clip.transform.anchorY && hasKeyframeAt(clip.transform.anchorY, t)} animated={isAnimated(clip.transform.anchorY)} onKeyframe={() => toggleKeyframe(clip.id, 'anchorY')} onToggleAnimated={() => toggleAnimated(clip.id, 'anchorY')} />

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Scale</span>
                <button
                  onClick={() => setLockScale(!lockScale)}
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${lockScale ? 'bg-accent/30 text-accent-light' : 'bg-surface-600 text-slate-500 hover:text-slate-300'}`}
                  title={lockScale ? 'Scale proportions locked' : 'Scale proportions unlocked'}
                >
                  {lockScale ? <Link size={10} /> : <Unlink size={10} />}
                </button>
              </div>
              <PropRow label="Scale X" value={scaleX} min={0} max={5} step={0.01} onChange={v => updateValue('scaleX', v)} keyed={hasKeyframeAt(clip.transform.scaleX, t)} animated={isAnimated(clip.transform.scaleX)} onKeyframe={() => toggleKeyframe(clip.id, 'scaleX')} onToggleAnimated={() => toggleAnimated(clip.id, 'scaleX')} easing={easingAt(clip.transform.scaleX, t)} onEasing={e => setKeyframeEasing(clip.id, 'scaleX', e)} />
              <PropRow label="Scale Y" value={scaleY} min={0} max={5} step={0.01} onChange={v => updateValue('scaleY', v)} keyed={hasKeyframeAt(clip.transform.scaleY, t)} animated={isAnimated(clip.transform.scaleY)} onKeyframe={() => toggleKeyframe(clip.id, 'scaleY')} onToggleAnimated={() => toggleAnimated(clip.id, 'scaleY')} easing={easingAt(clip.transform.scaleY, t)} onEasing={e => setKeyframeEasing(clip.id, 'scaleY', e)} />

              <PropRow label="Rotation" value={rotation} min={-360} max={360} step={1} onChange={v => updateValue('rotation', v)} keyed={hasKeyframeAt(clip.transform.rotation, t)} animated={isAnimated(clip.transform.rotation)} onKeyframe={() => toggleKeyframe(clip.id, 'rotation')} onToggleAnimated={() => toggleAnimated(clip.id, 'rotation')} easing={easingAt(clip.transform.rotation, t)} onEasing={e => setKeyframeEasing(clip.id, 'rotation', e)} />
              <PropRow label="Opacity" value={opacity} min={0} max={1} step={0.01} onChange={v => updateValue('opacity', v)} keyed={hasKeyframeAt(clip.transform.opacity, t)} animated={isAnimated(clip.transform.opacity)} onKeyframe={() => toggleKeyframe(clip.id, 'opacity')} onToggleAnimated={() => toggleAnimated(clip.id, 'opacity')} easing={easingAt(clip.transform.opacity, t)} onEasing={e => setKeyframeEasing(clip.id, 'opacity', e)} />

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

        {clip.type === 'text' && clip.textStyle && (() => {
          const ts = hydrateTextStyle(clip.textStyle);
          const patchStyle = (partial: Partial<TextStyle>) => {
            updateClipProperty(clip.id, 'textStyle', { ...ts, ...partial });
          };
          const hAligns: { id: TextAlign; Icon: typeof Bold; title: string }[] = [
            { id: 'left', Icon: AlignVerticalJustifyStart, title: 'Align left' },
            { id: 'center', Icon: AlignVerticalJustifyCenter, title: 'Align center' },
            { id: 'right', Icon: AlignVerticalJustifyEnd, title: 'Align right' },
            { id: 'justify', Icon: AlignHorizontalSpaceBetween, title: 'Justify' },
          ];
          const vAligns: { id: TextVAlign; label: string }[] = [
            { id: 'top', label: 'Top' },
            { id: 'middle', label: 'Middle' },
            { id: 'bottom', label: 'Bottom' },
          ];
          return (
          <div className="border-b border-surface-700">
            <button onClick={() => setStyleOpen(!styleOpen)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:text-white">
              <span>Text Style</span>
              {styleOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {styleOpen && (
              <div className="px-3 pb-3 space-y-2">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Content</label>
                  <textarea
                    value={clip.textContent || ''}
                    rows={4}
                    onChange={e => updateClipProperty(clip.id, 'textContent', e.target.value)}
                    onKeyDown={stopKeys}
                    className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none resize-y min-h-[4.5rem]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Font</label>
                  <select
                    value={ts.fontFamily}
                    onChange={e => patchStyle({ fontFamily: e.target.value })}
                    className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                  >
                    {!TEXT_FONTS.some(f => f.value === ts.fontFamily) && (
                      <option value={ts.fontFamily}>{ts.fontFamily}</option>
                    )}
                    {TEXT_FONTS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Size</label>
                    <input type="number" value={ts.fontSize} onChange={e => patchStyle({ fontSize: parseInt(e.target.value) || 48 })} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Color</label>
                    <input type="color" value={ts.color} onChange={e => patchStyle({ color: e.target.value })} className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Paragraph align</label>
                  <div className="flex gap-1 bg-surface-700 rounded p-0.5">
                    {hAligns.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        title={a.title}
                        onClick={() => patchStyle({ align: a.id })}
                        className={`flex-1 py-1 rounded flex items-center justify-center ${ts.align === a.id ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        <a.Icon size={12} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Vertical align</label>
                  <div className="flex gap-1 bg-surface-700 rounded p-0.5">
                    {vAligns.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => patchStyle({ valign: a.id })}
                        className={`flex-1 py-0.5 text-[10px] rounded capitalize ${ts.valign === a.id ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={ts.bold} onChange={e => patchStyle({ bold: e.target.checked })} className="accent-accent" />
                    <Bold size={10} /> Bold
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={ts.italic} onChange={e => patchStyle({ italic: e.target.checked })} className="accent-accent" />
                    <Italic size={10} /> Italic
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={ts.underline} onChange={e => patchStyle({ underline: e.target.checked })} className="accent-accent" />
                    <Underline size={10} /> Underline
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={ts.allCaps} onChange={e => patchStyle({ allCaps: e.target.checked })} className="accent-accent" />
                    <CaseSensitive size={10} /> All caps
                  </label>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Line height</label>
                    <input type="number" min={0.5} max={4} step={0.05} value={ts.lineHeight} onChange={e => patchStyle({ lineHeight: parseFloat(e.target.value) || 1.2 })} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Letter spacing</label>
                    <input type="number" min={-20} max={80} step={0.5} value={ts.letterSpacing} onChange={e => patchStyle({ letterSpacing: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Paragraph gap</label>
                    <input type="number" min={0} max={200} step={1} value={ts.paragraphGap} onChange={e => patchStyle({ paragraphGap: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 mb-1 block">Box width</label>
                    <input type="number" min={0} max={4000} step={10} value={ts.boxWidth} onChange={e => patchStyle({ boxWidth: Math.max(0, parseInt(e.target.value) || 0) })} className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none" title="0 = no wrapping" />
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ts.boxWidth > 0}
                    onChange={e => patchStyle({ boxWidth: e.target.checked ? (ts.boxWidth > 0 ? ts.boxWidth : 800) : 0 })}
                    className="accent-accent"
                  />
                  Wrap to box
                </label>
              </div>
            )}
          </div>
          );
        })()}

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

        {clip.type === 'comp' && (
          <div className="border-b border-surface-700">
            <div className="px-3 py-2 text-xs font-medium text-slate-300">Nested Composition</div>
            <div className="px-3 pb-3 space-y-2">
              {nestedSource && (
                <CompositionNameField
                  id="nested-comp-name"
                  name={nestedSource.name}
                  onRename={next => renameComposition(nestedSource.id, next)}
                />
              )}
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Source</label>
                <select
                  value={clip.compositionId || ''}
                  onChange={e => {
                    const nextId = e.target.value;
                    if (!nextId) return;
                    if (wouldCreateCompCycle(state.project, comp.id, nextId)) {
                      showToast('That would create a nest loop');
                      return;
                    }
                    const nested = state.project.compositions.find(c => c.id === nextId);
                    updateClipProperty(clip.id, 'compositionId', nextId);
                    if (nested) updateClipProperty(clip.id, 'name', nested.name);
                  }}
                  className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                >
                  {state.project.compositions
                    .filter(c => !wouldCreateCompCycle(state.project, comp.id, c.id) || c.id === clip.compositionId)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>
              {(() => {
                const nested = state.project.compositions.find(c => c.id === clip.compositionId);
                if (!nested) return <p className="text-[9px] text-slate-500">Pick a composition to nest.</p>;
                return (
                  <p className="text-[9px] text-slate-500">{nested.width}×{nested.height} · {nested.duration.toFixed(1)}s · {nested.tracks.reduce((n, t) => n + t.clips.length, 0)} layers</p>
                );
              })()}
              <button
                type="button"
                disabled={!clip.compositionId}
                onClick={() => {
                  if (clip.compositionId) setActiveComposition(clip.compositionId);
                }}
                className="w-full px-2 py-1.5 rounded bg-accent/20 hover:bg-accent text-accent-light hover:text-white text-[10px] disabled:opacity-40"
              >
                Open composition
              </button>
            </div>
          </div>
        )}

        {clip.type === 'mesh3d' && (
          <div className="border-b border-surface-700">
            <div className="px-3 py-2 text-xs font-medium text-slate-300">3D Object</div>
            <div className="px-3 pb-3 space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Structure</label>
                <div className="flex flex-wrap gap-1">
                  {MESH_PRIMITIVES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateClipProperty(clip.id, 'meshShape', s as MeshShape)}
                      className={`px-2 py-0.5 text-[10px] rounded capitalize ${clip.meshShape === s ? 'bg-accent text-white' : 'bg-surface-700 text-slate-400 hover:text-white'}`}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateClipProperty(clip.id, 'meshShape', 'model')}
                    className={`px-2 py-0.5 text-[10px] rounded ${clip.meshShape === 'model' ? 'bg-accent text-white' : 'bg-surface-700 text-slate-400 hover:text-white'}`}
                  >
                    Model
                  </button>
                </div>
              </div>

              {clip.meshShape === 'model' && (
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Imported model</label>
                  <select
                    value={clip.assetId || ''}
                    onChange={e => updateClipProperty(clip.id, 'assetId', e.target.value || null)}
                    className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                  >
                    <option value="">None — import a GLB, GLTF, or OBJ</option>
                    {state.project.assets.filter(a => a.type === 'mesh3d').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {clip.meshShape !== 'model' && (
                <MeshAnimRow clipId={clip.id} clipTime={t} def={MESH_PROP_DEFS.find(d => d.key === 'meshSegments')!} />
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <MeshColorRow clipId={clip.id} clipTime={t} def={MESH_PROP_DEFS.find(d => d.key === 'meshColor')!} />
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer pb-1">
                  <input type="checkbox" checked={clip.meshWireframe || false} onChange={e => updateClipProperty(clip.id, 'meshWireframe', e.target.checked)} className="accent-accent" />
                  Wireframe
                </label>
              </div>

              <MeshAnimRow clipId={clip.id} clipTime={t} def={MESH_PROP_DEFS.find(d => d.key === 'meshMetalness')!} />
              <MeshAnimRow clipId={clip.id} clipTime={t} def={MESH_PROP_DEFS.find(d => d.key === 'meshRoughness')!} />
              {MESH_PROP_DEFS.filter(d => d.key === 'meshRotX' || d.key === 'meshRotY' || d.key === 'meshRotZ').map(def => (
                <MeshAnimRow key={def.key} clipId={clip.id} clipTime={t} def={def} />
              ))}

              <div className="pt-1 border-t border-surface-700/60">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 block">Texture mapping</label>
                <select
                  value={clip.meshMapAssetId || ''}
                  onChange={e => updateClipProperty(clip.id, 'meshMapAssetId', e.target.value || undefined)}
                  className="w-full px-2 py-1 rounded bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none mb-2"
                >
                  <option value="">None (solid color)</option>
                  {state.project.assets.filter(a => a.type === 'image').map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-500 mb-2">Import an image, then map it onto this object. Use Plane for a photo card.</p>
                {MESH_PROP_DEFS.filter(d => d.group === 'texture').map(def => (
                  <MeshAnimRow key={def.key} clipId={clip.id} clipTime={t} def={def} />
                ))}
              </div>

              <div className="pt-1 border-t border-surface-700/60">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 block">Lighting</label>
                <div className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <MeshColorRow clipId={clip.id} clipTime={t} def={MESH_PROP_DEFS.find(d => d.key === 'meshLightAmbientColor')!} />
                  </div>
                  <div className="flex-1">
                    <MeshColorRow clipId={clip.id} clipTime={t} def={MESH_PROP_DEFS.find(d => d.key === 'meshLightKeyColor')!} />
                  </div>
                </div>
                {MESH_PROP_DEFS.filter(d => d.group === 'light' && !d.color).map(def => (
                  <MeshAnimRow key={def.key} clipId={clip.id} clipTime={t} def={def} />
                ))}
              </div>
            </div>
          </div>
        )}

        {clip.type === 'audio' && (
          <div className="border-b border-surface-700">
            <div className="px-3 py-2 text-xs font-medium text-slate-300">Audio</div>
            <div className="px-3 pb-3 space-y-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Track volume</label>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={comp.tracks.find(tr => tr.id === clip.trackId)?.volume ?? 1}
                  onChange={e => setTrackVolume(clip.trackId, parseFloat(e.target.value))}
                  className="w-full accent-accent h-4"
                />
              </div>
              <p className="text-[9px] text-slate-500">Clip level uses Opacity. Mute and Solo on the track header still apply.</p>
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
                    .filter(c => !wouldCreateParentCycle(comp, clip.id, c.id))
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
          <button
            onClick={() => setEffectsOpen(!effectsOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-accent-light" />
              Effects
            </span>
            {effectsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {effectsOpen && (
            <div className="px-3 pb-3 space-y-2">
              <p className="text-[10px] text-slate-500">Applies to this layer only. Works on text, shapes, 3D, images, video, and paths.</p>
              {effects.map(fx => {
                const def = EFFECT_DEFS[fx.type];
                return (
                  <div key={fx.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-300 w-[4.5rem] shrink-0 truncate">{def.label}</span>
                      <input
                        type="range"
                        min={def.min}
                        max={def.max}
                        step={def.step}
                        value={fx.amount}
                        onChange={e => updateEffect(fx.id, parseFloat(e.target.value))}
                        className="flex-1 accent-accent h-4"
                      />
                      <span className="text-[10px] text-slate-400 w-10 text-right tabular-nums">
                        {fx.amount}{def.unit}
                      </span>
                      <button type="button" onClick={() => removeEffect(fx.id)} className="text-slate-600 hover:text-red-400" title="Remove effect">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-1 pt-1">
                {(Object.keys(EFFECT_DEFS) as EffectType[]).map(type => {
                  const used = effects.some(e => e.type === type);
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={used}
                      onClick={() => addEffect(type)}
                      className="px-2 py-0.5 rounded bg-surface-700 hover:bg-surface-600 text-[10px] text-slate-300 disabled:opacity-30 disabled:hover:bg-surface-700"
                    >
                      + {EFFECT_DEFS[type].label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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

function MeshAnimRow({ clipId, clipTime, def }: { clipId: string; clipTime: number; def: MeshPropDef }) {
  const { state, setAnimValue, toggleKeyframe, toggleAnimated, setKeyframeEasing } = useEditor();
  const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
  const clip = findClip(comp, clipId);
  if (!clip) return null;
  const prop = ensureAnimProp(clip, def.key);
  const value = evalProp(prop, clipTime);
  return (
    <PropRow
      label={def.label}
      value={value}
      min={def.min}
      max={def.max}
      step={def.step}
      onChange={v => setAnimValue(clipId, def.key, v)}
      keyed={hasKeyframeAt(prop, clipTime)}
      animated={isAnimated(prop)}
      onKeyframe={() => toggleKeyframe(clipId, def.key)}
      onToggleAnimated={() => toggleAnimated(clipId, def.key)}
      easing={easingAt(prop, clipTime)}
      onEasing={e => setKeyframeEasing(clipId, def.key, e)}
    />
  );
}

function MeshColorRow({ clipId, clipTime, def }: { clipId: string; clipTime: number; def: MeshPropDef }) {
  const { state, setAnimValue, toggleKeyframe, toggleAnimated, setKeyframeEasing } = useEditor();
  const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
  const clip = findClip(comp, clipId);
  if (!clip) return null;
  const prop = ensureAnimProp(clip, def.key);
  const hex = evalColorProp(prop, clipTime);
  const keyed = hasKeyframeAt(prop, clipTime);
  const animated = isAnimated(prop);
  const easing = easingAt(prop, clipTime);
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-1 min-w-0">
        <button
          onClick={() => toggleAnimated(clipId, def.key)}
          className={`w-4 h-4 shrink-0 flex items-center justify-center ${animated ? 'text-accent-light' : 'text-slate-600 hover:text-slate-300'}`}
          title={animated ? 'Disable animation' : 'Enable animation'}
        >
          <Timer size={10} />
        </button>
        <label className="text-[10px] text-slate-400 min-w-0 flex-1 truncate">{def.label}</label>
        <KfButton active={keyed} onClick={() => toggleKeyframe(clipId, def.key)} />
      </div>
      <input
        type="color"
        value={hex}
        onChange={e => setAnimValue(clipId, def.key, parseHexColor(e.target.value))}
        className="w-full h-7 rounded bg-surface-700 border border-surface-600 cursor-pointer"
      />
      {keyed && (
        <select
          value={easing}
          onChange={e => setKeyframeEasing(clipId, def.key, e.target.value as Easing)}
          className="w-full px-1 py-0.5 rounded bg-surface-700 border border-surface-600 text-[9px] text-slate-300 outline-none"
        >
          {EASINGS.map(es => <option key={es} value={es}>{es}</option>)}
        </select>
      )}
    </div>
  );
}

function KfButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-5 h-5 shrink-0 flex items-center justify-center ${active ? 'text-accent-light' : 'text-slate-600 hover:text-slate-300'}`}
      title={active ? 'Remove keyframe' : 'Add keyframe'}
    >
      <Diamond size={10} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

function PropRow({ label, value, min, max, step, onChange, onKeyframe, onToggleAnimated, keyed, animated, easing, onEasing }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onKeyframe: () => void;
  onToggleAnimated?: () => void;
  keyed?: boolean;
  animated?: boolean;
  easing?: Easing;
  onEasing?: (e: Easing) => void;
}) {
  const scrub = useRef<{ x: number; value: number } | null>(null);
  // A saved project once handed this a string; never call a number method
  // on the raw prop.
  const safeValue = Number.isFinite(value) ? value : 0;

  const onScrubDown = (e: React.MouseEvent) => {
    e.preventDefault();
    scrub.current = { x: e.clientX, value: safeValue };
    const move = (ev: MouseEvent) => {
      if (!scrub.current) return;
      const dx = ev.clientX - scrub.current.x;
      const next = scrub.current.value + dx * step * (ev.shiftKey ? 10 : 1);
      onChange(Math.max(min, Math.min(max, next)));
    };
    const up = () => {
      scrub.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-1 min-w-0">
        {onToggleAnimated && (
          <button
            onClick={onToggleAnimated}
            className={`w-4 h-4 shrink-0 flex items-center justify-center ${animated ? 'text-accent-light' : 'text-slate-600 hover:text-slate-300'}`}
            title={animated ? 'Disable animation' : 'Enable animation'}
          >
            <Timer size={10} />
          </button>
        )}
        <label
          className="text-[10px] text-slate-400 w-[3.6rem] shrink-0 truncate cursor-ew-resize"
          onMouseDown={onScrubDown}
          title="Drag to scrub"
        >
          {label}
        </label>
        <input
          type="number"
          value={Number(safeValue.toFixed(step < 1 ? 3 : 1))}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="min-w-0 flex-1 px-1.5 py-0.5 rounded bg-surface-700 border border-surface-600 text-[10px] text-white focus:border-accent outline-none text-right"
          step={step}
        />
        <KfButton active={!!keyed} onClick={onKeyframe} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent h-3.5"
      />
      {keyed && onEasing && easing && (
        <select
          value={easing}
          onChange={e => onEasing(e.target.value as Easing)}
          className="w-full px-1 py-0.5 rounded bg-surface-700 border border-surface-600 text-[9px] text-slate-300 outline-none"
        >
          {EASINGS.map(es => <option key={es} value={es}>{es}</option>)}
        </select>
      )}
    </div>
  );
}
