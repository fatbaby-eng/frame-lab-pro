// Help ▾ in the top bar. Keyboard shortcuts open the editor's own modal (it
// is generated from the live shortcut table, so it never goes stale); Tips
// and About use the shared bench help panel; Start screen reopens the
// first-run screen.
import { useEffect, useRef, useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { isStandalone, siteHome } from '../site';

interface Props {
  onShortcuts: () => void;
}

const TIPS = [
  'Shift-click layers on the canvas or the timeline to select several at once. Drag, nudge with Shift+arrows, or align them as a group; animated layers get a keyframe at the playhead when they move.',
  'Every layer gets its own track. Twirl a track (U) to see its properties and keyframes.',
  'Set the work area with B and N, then loop it with the repeat button to tune one move.',
  'Drag media, audio, or a GLB/GLTF/OBJ model onto the Assets panel. 3D layers stay inside the layer bounds.',
  'Nested compositions: add a comp as a layer to reuse a whole animation, then double-click to edit it inside.',
  'The Curve editor lives on any animated property. Ease in and out beat linear almost every time.',
  'Autosave keeps the latest project in this browser. Save writes a .flab.json you can move between machines; imported media has to be re-linked after a reload.',
  'Export renders to video or GIF from the work area. Shorter and smaller finishes sooner.',
];

export default function HelpMenu({ onShortcuts }: Props) {
  const [open, setOpen] = useState(false);
  // The top bar scrolls sideways, which makes the browser clip anything that
  // hangs below it. The menu is placed against the viewport instead, from
  // where the button is when it opens.
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      setPos({ top: Math.round(r.bottom + 6), right: Math.max(8, Math.round(window.innerWidth - r.right)) });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // The button moves if the window resizes or the bar scrolls; close rather than float adrift.
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const bench = (section: 'tips' | 'about') => {
    setOpen(false);
    const api = window.BenchSplash;
    if (!api || !api.help) return;
    api.help({
      name: 'Frame Lab',
      eyebrow: "Mr. Todd's",
      tagline: 'Layers on a timeline. Keyframes, easing, audio, a little 3D.',
      vibe: 'darkroom',
      section,
      tips: TIPS,
      about: ['Built with React, Three.js and the browser’s own media pipeline. Projects are plain JSON.'],
      onStartScreen: () => window.dispatchEvent(new Event('framelab:start')),
    });
  };

  const item = 'w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-700 hover:text-white';

  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        onClick={toggle}
        className="flex items-center gap-1 text-slate-500 hover:text-white text-xs"
        title="Help"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <HelpCircle size={14} />
        <span>Help</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div role="menu" style={{ position: 'fixed', top: pos.top, right: pos.right }} className="w-56 bg-surface-800 border border-surface-600 rounded-md shadow-xl py-1 z-50">
          <button role="menuitem" className={item} onClick={() => { setOpen(false); onShortcuts(); }}>Keyboard shortcuts <span className="float-right text-slate-500">?</span></button>
          <button role="menuitem" className={item} onClick={() => bench('tips')}>Tips…</button>
          <div className="my-1 h-px bg-surface-600" />
          <button role="menuitem" className={item} onClick={() => { setOpen(false); window.dispatchEvent(new Event('framelab:start')); }}>Start screen…</button>
          <button role="menuitem" className={item} onClick={() => bench('about')}>About Frame Lab</button>
          {isStandalone() && (
            <>
              <div className="my-1 h-px bg-surface-600" />
              <a role="menuitem" className={`${item} block`} href={siteHome()}>Back to toddboswell.com</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
