// The first-open screen. Rendering is done by the shared bench-splash.js
// (public/bench-splash.js, loaded from index.html); this component only
// supplies the doors and listens for the editor asking to reopen it.
import { useEffect, useRef } from 'react';
import { useEditor } from '../editor/EditorContext';
import { createEmptyComposition, COMP_PRESETS, type Composition, type Project } from '../editor/types';
import { START_TEMPLATES } from './templates';
import { renderFrame } from '../editor/render';

interface BenchSplashConfig {
  key: string;
  name: string;
  eyebrow?: string;
  tagline?: string;
  vibe?: string;
  force?: boolean;
  templates?: { name: string; meta?: string; thumb?: string; run: () => void }[];
  sizes?: { label: string; immediate?: boolean; run: () => void }[];
  primary?: { label: string; run: () => void };
  open?: { hint?: string; formats?: string; browse: () => void; files?: (files: FileList) => void };
  recent?: { name: string; meta?: string; run: () => void }[];
  onClose?: (reason: string) => void;
}
interface BenchHelpConfig {
  name: string;
  eyebrow?: string;
  tagline?: string;
  vibe?: string;
  section?: 'shortcuts' | 'tips' | 'about';
  shortcuts?: { scope?: string; keys: string; label: string }[];
  tips?: string[];
  about?: string[];
  links?: { label: string; href: string }[];
  version?: string;
  onStartScreen?: () => void;
}
interface BenchSplashApi {
  open: (cfg: BenchSplashConfig) => { close: () => void } | null;
  help: (cfg: BenchHelpConfig) => { close: () => void };
  lift?: () => void;
  kewpie: string;
}
declare global {
  interface Window { BenchSplash?: BenchSplashApi }
}
interface Handoff {
  type?: string;
  from?: string;
  name?: string;
  svg?: string;
  width?: number;
  height?: number;
  at?: number;
}

// Render one frame of a template composition, small, for its card.
function thumbFor(comp: Composition): string | null {
  try {
    const W = 320, H = Math.round(W * comp.height / comp.width);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.scale(W / comp.width, H / comp.height);
    const project: Project = { id: 'thumb', name: 'thumb', compositions: [comp], activeCompositionId: comp.id, assets: [] };
    // A moment in, so the reveals have landed and the frame reads.
    renderFrame(ctx, Math.min(1.2, comp.duration / 2), comp, project, new Map());
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

export default function StartScreen() {
  const editor = useEditor();
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const handleRef = useRef<{ close: () => void } | null>(null);

  useEffect(() => {
    const open = (force: boolean) => {
      const api = window.BenchSplash;
      if (!api) return;
      if (handleRef.current) handleRef.current.close();
      const ed = editorRef.current;

      const pickFile = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.flab.json';
        input.onchange = () => {
          const f = input.files?.[0];
          if (f) void editorRef.current.loadProjectFile(f).then(() => editorRef.current.showToast('Project loaded')).catch(() => editorRef.current.showToast('Could not load project file'));
        };
        input.click();
      };

      const recent = ed.hasAutosave()
        ? [{ name: ed.state.project.name || 'Untitled Project', meta: 'Autosaved in this browser', run: () => { /* already loaded */ } }]
        : [];

      handleRef.current = api.open({
        key: 'frame-lab',
        name: 'Frame Lab',
        eyebrow: "Mr. Todd's",
        tagline: 'Layers on a timeline. Keyframes, easing, audio, a little 3D.',
        vibe: 'darkroom',
        force,
        templates: START_TEMPLATES.map(t => ({
          name: t.name, meta: t.meta, thumb: thumbFor(t.build()) || t.thumb,
          run: () => { editorRef.current.newProjectWith(t.build(), t.name); editorRef.current.showToast(`${t.name} — yours to change`); },
        })),
        sizes: [
          ...COMP_PRESETS.map(p => ({
            label: `${p.name.replace('Landscape ', '')} · ${p.fps} fps`,
            run: () => editorRef.current.newProjectWith(createEmptyComposition({ name: p.name, width: p.width, height: p.height, fps: p.fps })),
          })),
        ],
        primary: { label: 'New composition', run: () => editorRef.current.newProjectWith(createEmptyComposition()) },
        open: {
          hint: 'Drop a project here',
          formats: '.flab.json',
          browse: pickFile,
          files: files => {
            const f = files[0];
            if (f) void editorRef.current.loadProjectFile(f).then(() => editorRef.current.showToast('Project loaded')).catch(() => editorRef.current.showToast('Could not load project file'));
          },
        },
        recent,
        onClose: () => { handleRef.current = null; },
      });
    };

    // ---- Handoff from Vector Studio ----
    // Same origin: the SVG waits in localStorage. Cross origin (GitHub
    // mirror): we announce ourselves to the opener and it posts the SVG.
    const takeHandoff = (h: Handoff) => {
      if (!h || typeof h.svg !== 'string' || !/<svg[\s>]/i.test(h.svg)) return false;
      if (h.at && Date.now() - h.at > 10 * 60 * 1000) return false;
      const ed = editorRef.current;
      // A drawing sent over lands in whatever the visitor was working on. With
      // nothing in progress, it gets a clean composition instead of the demo.
      let comp = ed.getActiveComposition();
      if (!ed.hasAutosave()) {
        comp = createEmptyComposition({ name: h.name || 'Vector Studio' });
        ed.newProjectWith(comp, h.name || 'Vector Studio');
      }
      const svg = h.svg;
      const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const name = (h.name || 'Vector Studio').replace(/\.svg$/i, '') + '.svg';
      ed.addAsset({ id, name, type: 'image', url, width: h.width || comp.width, height: h.height || comp.height });
      const video = comp.tracks.find(t => t.type === 'video');
      ed.addClip(video ? video.id : null, 'image', 0, comp.duration, id);
      ed.showToast('Brought in from Vector Studio');
      if (handleRef.current) { handleRef.current.close(); handleRef.current = null; }
      return true;
    };
    let took = false;
    try {
      const raw = localStorage.getItem('framelab-handoff');
      if (raw) {
        localStorage.removeItem('framelab-handoff');
        took = takeHandoff(JSON.parse(raw) as Handoff);
      }
    } catch { /* ignore a bad payload */ }
    const onMsg = (e: MessageEvent) => {
      const d = e.data as Handoff | undefined;
      if (d && d.type === 'framelab-handoff' && !took) { took = takeHandoff(d); }
    };
    window.addEventListener('message', onMsg);
    if (window.opener && new URLSearchParams(location.search).has('handoff')) {
      try { window.opener.postMessage({ type: 'framelab-ready' }, '*'); } catch { /* opener gone */ }
    }

    if (!took) open(false);
    // A handoff skips the start screen, so nothing else lifts the boot veil;
    // without this the page sits blank until the 4 s fallback timer.
    else if (window.BenchSplash && window.BenchSplash.lift) window.BenchSplash.lift();
    else document.documentElement.classList.remove('bench-veil');
    const onStart = () => open(true);
    window.addEventListener('framelab:start', onStart);
    return () => {
      window.removeEventListener('framelab:start', onStart);
      window.removeEventListener('message', onMsg);
      if (handleRef.current) handleRef.current.close();
    };
  }, []);

  return null;
}
