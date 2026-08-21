import { useMemo, useRef, useState } from 'react';
import { useEditor } from '../EditorContext';
import {
  evalProp, findClip, isAnimated, keyframeBezier, TRANSFORM_PROP_KEYS,
} from '../types';
import type { AnimatedProperty, Transform } from '../types';

const COLORS: Partial<Record<keyof Transform, string>> = {
  x: '#38bdf8',
  y: '#a78bfa',
  scaleX: '#34d399',
  scaleY: '#4ade80',
  rotation: '#fb7185',
  opacity: '#fbbf24',
  anchorX: '#94a3b8',
  anchorY: '#64748b',
};

const LABELS: Partial<Record<keyof Transform, string>> = {
  x: 'X', y: 'Y', scaleX: 'Scale X', scaleY: 'Scale Y',
  rotation: 'Rot', opacity: 'Opac', anchorX: 'Anc X', anchorY: 'Anc Y',
};

type DragKind = 'key' | 'out' | 'in';

export default function CurveEditor({ width }: { width: number }) {
  const {
    state, patchKeyframe, selectKeyframe, seek, toggleKeyframe,
  } = useEditor();
  const { selectedClipId, selectedKeyframe, currentTime, zoom, project } = state;
  const comp = project.compositions.find(c => c.id === project.activeCompositionId)!;
  const clip = selectedClipId ? findClip(comp, selectedClipId) : null;

  const [solo, setSolo] = useState<keyof Transform | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    key: keyof Transform;
    time: number;
    kind: DragKind;
    value: number;
  } | null>(null);

  const channels = useMemo(() => {
    if (!clip) return [];
    return TRANSFORM_PROP_KEYS
      .filter(k => isAnimated(clip.transform[k]) || selectedKeyframe?.key === k)
      .filter(k => !solo || solo === k);
  }, [clip, selectedKeyframe, solo]);

  const valueRange = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    if (!clip) return { min: 0, max: 1 };
    for (const key of channels.length ? channels : TRANSFORM_PROP_KEYS) {
      for (const kf of clip.transform[key]?.keyframes ?? []) {
        min = Math.min(min, kf.value);
        max = Math.max(max, kf.value);
      }
    }
    if (!Number.isFinite(min)) { min = 0; max = 1; }
    if (Math.abs(max - min) < 0.001) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.18;
    return { min: min - pad, max: max + pad };
  }, [clip, channels]);

  const H = 168;
  const padL = 0;
  const padR = 8;
  const padT = 10;
  const padB = 18;
  const innerH = H - padT - padB;

  const xOf = (compTime: number) => padL + compTime * zoom;
  const yOf = (v: number) => padT + (1 - (v - valueRange.min) / (valueRange.max - valueRange.min)) * innerH;
  const timeOf = (px: number) => (px - padL) / zoom;
  const valueOf = (py: number) => {
    const t = 1 - (py - padT) / innerH;
    return valueRange.min + t * (valueRange.max - valueRange.min);
  };

  const sampleCurve = (prop: AnimatedProperty, t0: number, t1: number, steps = 48) => {
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const time = t0 + (t1 - t0) * u;
      const v = evalProp(prop, time);
      pts.push(`${xOf((clip?.start ?? 0) + time)},${yOf(v)}`);
    }
    return pts.join(' ');
  };

  const onPointer = (e: React.PointerEvent<SVGSVGElement>, down: boolean) => {
    if (!clip || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = (svgRef.current.viewBox.baseVal.width || width) / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * (H / rect.height);

    if (down) {
      const hit = hitTest(px, py);
      if (hit) {
        dragRef.current = hit;
        selectKeyframe({ clipId: clip.id, key: hit.key, time: hit.time });
        seek(clip.start + hit.time);
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const prop = clip.transform[drag.key];
    const kf = prop.keyframes.find(k => Math.abs(k.time - drag.time) < 0.001);
    if (!kf) return;

    if (drag.kind === 'key') {
      const nextTime = Math.max(0, Math.min(clip.duration, timeOf(px) - clip.start));
      const nextVal = valueOf(py);
      patchKeyframe(clip.id, drag.key, drag.time, { time: nextTime, value: nextVal });
      drag.time = nextTime;
      selectKeyframe({ clipId: clip.id, key: drag.key, time: nextTime });
      seek(clip.start + nextTime);
      return;
    }

    const idx = prop.keyframes.findIndex(k => Math.abs(k.time - drag.time) < 0.001);
    const next = prop.keyframes[idx + 1];
    if (!next) return;
    const dur = next.time - kf.time;
    const dVal = next.value - kf.value;
    if (Math.abs(dur) < 1e-6) return;
    const [bx1, by1, bx2, by2] = keyframeBezier(kf);
    const ux = (timeOf(px) - clip.start - kf.time) / dur;
    const uy = dVal === 0 ? 0.5 : (valueOf(py) - kf.value) / dVal;
    if (drag.kind === 'out') {
      patchKeyframe(clip.id, drag.key, drag.time, {
        easing: 'bezier',
        bx1: Math.max(0, Math.min(1, ux)),
        by1: uy,
        bx2, by2,
      });
    } else {
      patchKeyframe(clip.id, drag.key, drag.time, {
        easing: 'bezier',
        bx1, by1,
        bx2: Math.max(0, Math.min(1, ux)),
        by2: uy,
      });
    }
  };

  const hitTest = (px: number, py: number) => {
    if (!clip) return null;
    const thresh = 8;
    for (const key of channels) {
      const kfs = clip.transform[key].keyframes;
      for (let i = 0; i < kfs.length; i++) {
        const kf = kfs[i];
        const next = kfs[i + 1];
        const kx = xOf(clip.start + kf.time);
        const ky = yOf(kf.value);
        if (Math.hypot(px - kx, py - ky) <= thresh) {
          return { key, time: kf.time, kind: 'key' as const, value: kf.value };
        }
        if (next && kf.easing !== 'hold') {
          const [bx1, by1, bx2, by2] = keyframeBezier(kf);
          const dur = next.time - kf.time;
          const dVal = next.value - kf.value;
          const ox = xOf(clip.start + kf.time + dur * bx1);
          const oy = yOf(kf.value + dVal * by1);
          const ix = xOf(clip.start + kf.time + dur * bx2);
          const iy = yOf(kf.value + dVal * by2);
          if (Math.hypot(px - ox, py - oy) <= thresh) {
            return { key, time: kf.time, kind: 'out' as const, value: kf.value };
          }
          if (Math.hypot(px - ix, py - iy) <= thresh) {
            return { key, time: kf.time, kind: 'in' as const, value: kf.value };
          }
        }
      }
    }
    return null;
  };

  const addKeyAt = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!clip || !svgRef.current || dragRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) * ((width) / rect.width);
    const compTime = timeOf(px);
    if (compTime < clip.start || compTime > clip.start + clip.duration) return;
    const key = solo ?? selectedKeyframe?.key ?? channels[0] ?? 'x';
    toggleKeyframe(clip.id, key, compTime);
    seek(compTime);
  };

  if (!clip) {
    return (
      <div className="h-[168px] flex items-center justify-center text-[10px] text-slate-500 border-b border-surface-700">
        Select a clip with keyframes to edit curves
      </div>
    );
  }

  const viewW = Math.max(width + padL + padR, 400);

  return (
    <div className="border-b border-surface-700 bg-[#0c0c14] relative">
      <div className="absolute left-1 top-1 z-10 flex flex-col gap-0.5">
        {TRANSFORM_PROP_KEYS.filter(k => isAnimated(clip.transform[k])).map(k => (
          <button
            key={k}
            onClick={() => setSolo(s => s === k ? null : k)}
            className={`text-[8px] px-1 rounded text-left ${solo === k ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            style={{ color: solo === k || !solo ? COLORS[k] : undefined }}
          >
            {LABELS[k]}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={H}
        viewBox={`0 0 ${viewW} ${H}`}
        preserveAspectRatio="none"
        className="block cursor-crosshair"
        onPointerDown={e => onPointer(e, true)}
        onPointerMove={e => onPointer(e, false)}
        onPointerUp={() => { dragRef.current = null; }}
        onDoubleClick={addKeyAt}
      >
        <rect x={0} y={0} width={viewW} height={H} fill="#0c0c14" />
        {[0.25, 0.5, 0.75].map(p => (
          <line
            key={p}
            x1={padL} x2={viewW}
            y1={padT + innerH * p} y2={padT + innerH * p}
            stroke="#1e293b" strokeWidth={1}
          />
        ))}
        <text x={4} y={padT + 8} fill="#64748b" fontSize={8}>{valueRange.max.toFixed(1)}</text>
        <text x={4} y={padT + innerH} fill="#64748b" fontSize={8}>{valueRange.min.toFixed(1)}</text>

        <line
          x1={xOf(currentTime)} x2={xOf(currentTime)}
          y1={padT} y2={padT + innerH}
          stroke="#ef4444" strokeWidth={1}
        />

        {channels.map(key => {
          const prop = clip.transform[key];
          const color = COLORS[key] || '#818cf8';
          const kfs = prop.keyframes;
          return (
            <g key={key}>
              {kfs.length >= 2 && (
                <polyline
                  points={sampleCurve(prop, kfs[0].time, kfs[kfs.length - 1].time, 80)}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.6}
                />
              )}
              {kfs.map((kf, i) => {
                const next = kfs[i + 1];
                const selected = selectedKeyframe?.clipId === clip.id
                  && selectedKeyframe.key === key
                  && Math.abs(selectedKeyframe.time - kf.time) < 0.01;
                const kx = xOf(clip.start + kf.time);
                const ky = yOf(kf.value);
                let handles = null;
                if (next && kf.easing !== 'hold' && (selected || solo === key)) {
                  const [bx1, by1, bx2, by2] = keyframeBezier(kf);
                  const dur = next.time - kf.time;
                  const dVal = next.value - kf.value;
                  const ox = xOf(clip.start + kf.time + dur * bx1);
                  const oy = yOf(kf.value + dVal * by1);
                  const ix = xOf(clip.start + kf.time + dur * bx2);
                  const iy = yOf(kf.value + dVal * by2);
                  handles = (
                    <g>
                      <line x1={kx} y1={ky} x2={ox} y2={oy} stroke={color} strokeOpacity={0.45} />
                      <line x1={xOf(clip.start + next.time)} y1={yOf(next.value)} x2={ix} y2={iy} stroke={color} strokeOpacity={0.45} />
                      <circle cx={ox} cy={oy} r={3.5} fill="#0c0c14" stroke={color} strokeWidth={1.4} />
                      <circle cx={ix} cy={iy} r={3.5} fill="#0c0c14" stroke={color} strokeWidth={1.4} />
                    </g>
                  );
                }
                return (
                  <g key={`${key}-${i}`}>
                    {handles}
                    <rect
                      x={kx - 4} y={ky - 4} width={8} height={8}
                      transform={`rotate(45 ${kx} ${ky})`}
                      fill={selected ? '#fff' : color}
                      stroke={selected ? color : 'none'}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
