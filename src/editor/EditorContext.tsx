import {
  createContext, useContext, useState, useCallback, useRef,
  type ReactNode, useEffect,
} from 'react';
import type {
  Project, Composition, Track, Clip, Asset, Transform, LayerType, ToolMode,
  AnimatedProperty, Easing,
} from './types';
import {
  createDefaultComposition, createNewClip, setKeyframe, removeKeyframe,
  hasKeyframeAt, findClip, evalProp,
} from './types';

const AUTOSAVE_KEY = 'framelab-autosave-v2';

export interface EditorState {
  project: Project;
  currentTime: number;
  isPlaying: boolean;
  zoom: number;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  snapEnabled: boolean;
  showGrid: boolean;
  toast: string | null;
  toolMode: ToolMode;
  autoKey: boolean;
  loop: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

interface EditorContextType {
  state: EditorState;
  // Playback
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  stepFrame: (direction: number) => void;
  goToStart: () => void;
  goToEnd: () => void;
  setLoop: (v: boolean) => void;
  // Timeline
  setZoom: (zoom: number) => void;
  setSnapEnabled: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setWorkArea: (start: number, end: number) => void;
  // Selection
  selectClip: (id: string | null) => void;
  selectTrack: (id: string | null) => void;
  // Tool mode
  setToolMode: (mode: ToolMode) => void;
  setAutoKey: (v: boolean) => void;
  // Clip operations
  addClip: (trackId: string, type: LayerType, start: number, duration: number, assetId?: string, transform?: Transform, patch?: Partial<Clip>) => string;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, newStart: number, newTrackId?: string) => void;
  resizeClip: (clipId: string, newStart: number, newDuration: number) => void;
  updateClipTransform: (clipId: string, transform: Transform) => void;
  updateClipProperty: (clipId: string, key: string, value: unknown) => void;
  setTransformValue: (clipId: string, key: keyof Transform, value: number, easing?: Easing) => void;
  setTransformValues: (clipId: string, values: Partial<Record<keyof Transform, number>>, easing?: Easing) => void;
  toggleKeyframe: (clipId: string, key: keyof Transform) => void;
  setKeyframeEasing: (clipId: string, key: keyof Transform, easing: Easing) => void;
  duplicateClip: (clipId: string) => string | null;
  splitClip: (clipId: string, atTime?: number) => void;
  copyClip: (clipId: string) => void;
  pasteClip: () => void;
  nudgeClip: (clipId: string, dx: number, dy: number) => void;
  // Track operations
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  addTrack: (type: LayerType, name?: string) => void;
  deleteTrack: (trackId: string) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;
  // Assets
  addAsset: (asset: Asset) => void;
  updateAsset: (assetId: string, patch: Partial<Asset>) => void;
  deleteAsset: (assetId: string) => void;
  // Project
  setProjectName: (name: string) => void;
  setCompositionDuration: (duration: number) => void;
  updateComposition: (patch: Partial<Composition>) => void;
  newProject: () => void;
  saveProjectFile: () => Promise<void>;
  loadProjectFile: (file: File) => Promise<void>;
  // History
  undo: () => void;
  redo: () => void;
  // Composition
  getActiveComposition: () => Composition;
  // Toast
  showToast: (msg: string) => void;
  clearToast: () => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

function cloneProject(p: Project): Project {
  return JSON.parse(JSON.stringify(p)) as Project;
}

function createDefaultProject(): Project {
  const comp = createDefaultComposition();
  return {
    id: `project-${Date.now()}`,
    name: 'Untitled Project',
    compositions: [comp],
    activeCompositionId: comp.id,
    assets: [],
  };
}

function loadAutosave(): Project | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Project;
    if (!parsed?.compositions?.length) return null;
    // Drop blob: assets — they don't survive reload
    parsed.assets = (parsed.assets || []).filter(a => a.url && !a.url.startsWith('blob:'));
    for (const comp of parsed.compositions) {
      if (!comp.backgroundColor) comp.backgroundColor = '#0a0a0f';
      if (comp.workAreaStart == null) comp.workAreaStart = 0;
      if (comp.workAreaEnd == null) comp.workAreaEnd = comp.duration;
      for (const track of comp.tracks) {
        for (const clip of track.clips) {
          if (!clip.transform.anchorX) clip.transform.anchorX = { keyframes: [{ time: 0, value: 0, easing: 'linear' }] };
          if (!clip.transform.anchorY) clip.transform.anchorY = { keyframes: [{ time: 0, value: 0, easing: 'linear' }] };
        }
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState>(() => ({
    project: loadAutosave() ?? createDefaultProject(),
    currentTime: 0,
    isPlaying: false,
    zoom: 60,
    selectedClipId: null,
    selectedTrackId: null,
    snapEnabled: true,
    showGrid: true,
    toast: null,
    toolMode: 'pointer',
    autoKey: true,
    loop: true,
    canUndo: false,
    canRedo: false,
  }));

  const playRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const historyRef = useRef<Project[]>([]);
  const futureRef = useRef<Project[]>([]);
  const lastMutateRef = useRef({ t: 0, kind: '' });
  const clipboardRef = useRef<Clip | null>(null);
  const toastTimerRef = useRef<number>(0);

  const pushHistory = useCallback((project: Project, kind: string) => {
    const now = Date.now();
    if (kind === lastMutateRef.current.kind && now - lastMutateRef.current.t < 450) {
      lastMutateRef.current.t = now;
      return;
    }
    historyRef.current.push(cloneProject(project));
    if (historyRef.current.length > 80) historyRef.current.shift();
    futureRef.current = [];
    lastMutateRef.current = { t: now, kind };
  }, []);

  const mutate = useCallback((kind: string, updater: (s: EditorState) => EditorState) => {
    setState(s => {
      pushHistory(s.project, kind);
      const next = updater(s);
      return {
        ...next,
        canUndo: historyRef.current.length > 0,
        canRedo: futureRef.current.length > 0,
      };
    });
  }, [pushHistory]);

  // Playback loop
  useEffect(() => {
    if (!state.isPlaying) {
      if (playRef.current) cancelAnimationFrame(playRef.current);
      return;
    }

    const loop = (ts: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = ts;
      const delta = (ts - lastFrameRef.current) / 1000;
      lastFrameRef.current = ts;

      setState(s => {
        const comp = getComp(s);
        const end = Math.min(comp.workAreaEnd ?? comp.duration, comp.duration);
        const start = comp.workAreaStart ?? 0;
        let newTime = s.currentTime + delta;
        if (newTime >= end) {
          if (s.loop) {
            return { ...s, currentTime: start };
          }
          return { ...s, currentTime: end, isPlaying: false };
        }
        return { ...s, currentTime: newTime };
      });

      playRef.current = requestAnimationFrame(loop);
    };

    lastFrameRef.current = 0;
    playRef.current = requestAnimationFrame(loop);

    return () => {
      if (playRef.current) cancelAnimationFrame(playRef.current);
    };
  }, [state.isPlaying, state.loop]);

  // Autosave
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const serializable = cloneProject(state.project);
        serializable.assets = serializable.assets.filter(a => !a.url.startsWith('blob:'));
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializable));
      } catch {
        // quota — ignore
      }
    }, 800);
    return () => clearTimeout(id);
  }, [state.project]);

  const getActiveComposition = useCallback(() => {
    return getComp(state);
  }, [state]);

  const play = useCallback(() => {
    setState(s => {
      const c = getComp(s);
      const end = c.workAreaEnd ?? c.duration;
      if (s.currentTime >= end) {
        return { ...s, currentTime: c.workAreaStart ?? 0, isPlaying: true };
      }
      return { ...s, isPlaying: true };
    });
  }, []);

  const pause = useCallback(() => {
    setState(s => ({ ...s, isPlaying: false }));
  }, []);

  const togglePlay = useCallback(() => {
    setState(s => {
      const c = getComp(s);
      const end = c.workAreaEnd ?? c.duration;
      if (s.isPlaying) return { ...s, isPlaying: false };
      if (s.currentTime >= end) return { ...s, currentTime: c.workAreaStart ?? 0, isPlaying: true };
      return { ...s, isPlaying: true };
    });
  }, []);

  const seek = useCallback((time: number) => {
    setState(s => {
      const c = getComp(s);
      const clamped = Math.max(0, Math.min(time, c.duration));
      return { ...s, currentTime: clamped, isPlaying: false };
    });
  }, []);

  const stepFrame = useCallback((direction: number) => {
    setState(s => {
      const c = getComp(s);
      const frameTime = 1 / c.fps;
      const newTime = Math.max(0, Math.min(s.currentTime + direction * frameTime, c.duration));
      return { ...s, currentTime: newTime, isPlaying: false };
    });
  }, []);

  const goToStart = useCallback(() => {
    setState(s => ({ ...s, currentTime: getComp(s).workAreaStart ?? 0, isPlaying: false }));
  }, []);
  const goToEnd = useCallback(() => {
    setState(s => {
      const c = getComp(s);
      return { ...s, currentTime: c.workAreaEnd ?? c.duration, isPlaying: false };
    });
  }, []);

  const setLoop = useCallback((v: boolean) => {
    setState(s => ({ ...s, loop: v }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState(s => ({ ...s, zoom: Math.max(10, Math.min(400, zoom)) }));
  }, []);

  const setSnapEnabled = useCallback((v: boolean) => {
    setState(s => ({ ...s, snapEnabled: v }));
  }, []);

  const setShowGrid = useCallback((v: boolean) => {
    setState(s => ({ ...s, showGrid: v }));
  }, []);

  const setWorkArea = useCallback((start: number, end: number) => {
    mutate('workarea', s => updateComp(s, comp => ({
      ...comp,
      workAreaStart: Math.max(0, Math.min(start, end)),
      workAreaEnd: Math.min(comp.duration, Math.max(start, end)),
    })));
  }, [mutate]);

  const selectClip = useCallback((id: string | null) => {
    setState(s => ({ ...s, selectedClipId: id }));
  }, []);

  const selectTrack = useCallback((id: string | null) => {
    setState(s => ({ ...s, selectedTrackId: id, selectedClipId: null }));
  }, []);

  const setToolMode = useCallback((mode: ToolMode) => {
    setState(s => ({ ...s, toolMode: mode }));
  }, []);

  const setAutoKey = useCallback((v: boolean) => {
    setState(s => ({ ...s, autoKey: v }));
  }, []);

  const addClip = useCallback((trackId: string, type: LayerType, start: number, duration: number, assetId?: string, transform?: Transform, patch?: Partial<Clip>): string => {
    const clip = createNewClip(trackId, type, start, duration, assetId);
    if (transform) {
      clip.transform = {
        ...transform,
        anchorX: transform.anchorX ?? clip.transform.anchorX,
        anchorY: transform.anchorY ?? clip.transform.anchorY,
      };
    }
    if (patch) Object.assign(clip, patch);
    mutate('addClip', s => {
      const next = updateComp(s, comp => ({
        ...comp,
        tracks: comp.tracks.map(t =>
          t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
        ),
      }));
      return { ...next, selectedClipId: clip.id };
    });
    return clip.id;
  }, [mutate]);

  const deleteClip = useCallback((clipId: string) => {
    mutate('deleteClip', s => {
      const next = updateComp(s, comp => ({
        ...comp,
        tracks: comp.tracks.map(t => ({
          ...t,
          clips: t.clips.filter(c => c.id !== clipId),
        })),
      }));
      return { ...next, selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId };
    });
  }, [mutate]);

  const moveClip = useCallback((clipId: string, newStart: number, newTrackId?: string) => {
    mutate('moveClip', s => {
      const c = getComp(s);
      let sourceTrack: Track | undefined;
      let clip: Clip | undefined;

      for (const t of c.tracks) {
        const found = t.clips.find(cl => cl.id === clipId);
        if (found) { sourceTrack = t; clip = found; break; }
      }
      if (!clip) return s;

      const targetId = newTrackId ?? clip.trackId;

      if (targetId === clip.trackId) {
        return updateComp(s, comp => ({
          ...comp,
          tracks: comp.tracks.map(t =>
            t.id === targetId
              ? { ...t, clips: t.clips.map(cl => cl.id === clipId ? { ...cl, start: newStart } : cl) }
              : t
          ),
        }));
      }

      return updateComp(s, comp => ({
        ...comp,
        tracks: comp.tracks.map(t => {
          if (t.id === sourceTrack!.id) {
            return { ...t, clips: t.clips.filter(cl => cl.id !== clipId) };
          }
          if (t.id === targetId) {
            return { ...t, clips: [...t.clips, { ...clip!, trackId: targetId, start: newStart }] };
          }
          return t;
        }),
      }));
    });
  }, [mutate]);

  const resizeClip = useCallback((clipId: string, newStart: number, newDuration: number) => {
    mutate('resizeClip', s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id === clipId ? { ...c, start: newStart, duration: Math.max(0.1, newDuration) } : c
        ),
      })),
    })));
  }, [mutate]);

  const updateClipTransform = useCallback((clipId: string, transform: Transform) => {
    mutate('transform', s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id === clipId ? { ...c, transform } : c
        ),
      })),
    })));
  }, [mutate]);

  const updateClipProperty = useCallback((clipId: string, key: string, value: unknown) => {
    mutate('clipProp', s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id === clipId ? { ...c, [key]: value } : c
        ),
      })),
    })));
  }, [mutate]);

  const applyTransformValues = (
    s: EditorState,
    clipId: string,
    values: Partial<Record<keyof Transform, number>>,
    easing: Easing
  ): EditorState => {
    const comp = getComp(s);
    const clip = findClip(comp, clipId);
    if (!clip) return s;
    const clipTime = Math.max(0, s.currentTime - clip.start);
    let newTransform: Transform = { ...clip.transform };
    for (const [key, value] of Object.entries(values) as [keyof Transform, number][]) {
      if (value === undefined) continue;
      const prop: AnimatedProperty = clip.transform[key] ?? { keyframes: [{ time: 0, value, easing: 'linear' }] };
      if (s.autoKey || prop.keyframes.length > 1) {
        newTransform = { ...newTransform, [key]: setKeyframe(prop, clipTime, value, easing) };
      } else {
        newTransform = { ...newTransform, [key]: { keyframes: [{ ...prop.keyframes[0], value }] } };
      }
    }
    return updateComp(s, c => ({
      ...c,
      tracks: c.tracks.map(t => ({
        ...t,
        clips: t.clips.map(cl => cl.id === clipId ? { ...cl, transform: newTransform } : cl),
      })),
    }));
  };

  const setTransformValue = useCallback((clipId: string, key: keyof Transform, value: number, easing: Easing = 'ease-in-out') => {
    mutate('transform', s => applyTransformValues(s, clipId, { [key]: value }, easing));
  }, [mutate]);

  const setTransformValues = useCallback((clipId: string, values: Partial<Record<keyof Transform, number>>, easing: Easing = 'ease-in-out') => {
    mutate('transform', s => applyTransformValues(s, clipId, values, easing));
  }, [mutate]);

  const toggleKeyframe = useCallback((clipId: string, key: keyof Transform) => {
    mutate('keyframe', s => {
      const comp = getComp(s);
      const clip = findClip(comp, clipId);
      if (!clip) return s;
      const clipTime = Math.max(0, s.currentTime - clip.start);
      const prop = clip.transform[key];
      if (!prop) return s;
      const nextProp = hasKeyframeAt(prop, clipTime)
        ? removeKeyframe(prop, clipTime)
        : setKeyframe(prop, clipTime, evalProp(prop, clipTime));
      const newTransform: Transform = { ...clip.transform, [key]: nextProp };
      return updateComp(s, c => ({
        ...c,
        tracks: c.tracks.map(t => ({
          ...t,
          clips: t.clips.map(cl => cl.id === clipId ? { ...cl, transform: newTransform } : cl),
        })),
      }));
    });
  }, [mutate]);

  const setKeyframeEasing = useCallback((clipId: string, key: keyof Transform, easing: Easing) => {
    mutate('easing', s => {
      const comp = getComp(s);
      const clip = findClip(comp, clipId);
      if (!clip) return s;
      const clipTime = Math.max(0, s.currentTime - clip.start);
      const prop = clip.transform[key];
      if (!prop) return s;
      const keyframes = prop.keyframes.map(k =>
        Math.abs(k.time - clipTime) < 1 / 120 ? { ...k, easing } : k
      );
      const newTransform: Transform = { ...clip.transform, [key]: { keyframes } };
      return updateComp(s, c => ({
        ...c,
        tracks: c.tracks.map(t => ({
          ...t,
          clips: t.clips.map(cl => cl.id === clipId ? { ...cl, transform: newTransform } : cl),
        })),
      }));
    });
  }, [mutate]);

  const duplicateClip = useCallback((clipId: string): string | null => {
    let newId: string | null = null;
    mutate('duplicate', s => {
      const comp = getComp(s);
      const clip = findClip(comp, clipId);
      if (!clip) return s;
      const copy: Clip = {
        ...JSON.parse(JSON.stringify(clip)) as Clip,
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${clip.name} copy`,
        start: clip.start + 0.2,
      };
      newId = copy.id;
      return {
        ...updateComp(s, c => ({
          ...c,
          tracks: c.tracks.map(t =>
            t.id === clip.trackId ? { ...t, clips: [...t.clips, copy] } : t
          ),
        })),
        selectedClipId: copy.id,
      };
    });
    return newId;
  }, [mutate]);

  const splitClip = useCallback((clipId: string, atTime?: number) => {
    mutate('split', s => {
      const comp = getComp(s);
      const clip = findClip(comp, clipId);
      if (!clip) return s;
      const t = atTime ?? s.currentTime;
      if (t <= clip.start + 0.05 || t >= clip.start + clip.duration - 0.05) return s;
      const leftDur = t - clip.start;
      const right: Clip = {
        ...JSON.parse(JSON.stringify(clip)),
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${clip.name} B`,
        start: t,
        duration: clip.duration - leftDur,
        sourceStart: clip.sourceStart + leftDur,
      };
      return updateComp(s, c => ({
        ...c,
        tracks: c.tracks.map(tr => ({
          ...tr,
          clips: tr.clips.flatMap(cl => {
            if (cl.id !== clipId) return [cl];
            return [{ ...cl, duration: leftDur, name: `${cl.name} A` }, right];
          }),
        })),
      }));
    });
  }, [mutate]);

  const copyClip = useCallback((clipId: string) => {
    setState(s => {
      const clip = findClip(getComp(s), clipId);
      if (clip) clipboardRef.current = JSON.parse(JSON.stringify(clip));
      return s;
    });
  }, []);

  const pasteClip = useCallback(() => {
    const src = clipboardRef.current;
    if (!src) return;
    mutate('paste', s => {
      const comp = getComp(s);
      const track = comp.tracks.find(t => t.id === (s.selectedTrackId || src.trackId))
        ?? comp.tracks.find(t => t.type === src.type)
        ?? comp.tracks[0];
      if (!track) return s;
      const copy: Clip = {
        ...JSON.parse(JSON.stringify(src)),
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        trackId: track.id,
        start: s.currentTime,
        name: `${src.name} copy`,
      };
      return {
        ...updateComp(s, c => ({
          ...c,
          tracks: c.tracks.map(t =>
            t.id === track.id ? { ...t, clips: [...t.clips, copy] } : t
          ),
        })),
        selectedClipId: copy.id,
      };
    });
  }, [mutate]);

  const nudgeClip = useCallback((clipId: string, dx: number, dy: number) => {
    mutate('nudge', s => {
      const clip = findClip(getComp(s), clipId);
      if (!clip) return s;
      const clipTime = Math.max(0, s.currentTime - clip.start);
      const x = evalProp(clip.transform.x, clipTime) + dx;
      const y = evalProp(clip.transform.y, clipTime) + dy;
      const nextX = s.autoKey || clip.transform.x.keyframes.length > 1
        ? setKeyframe(clip.transform.x, clipTime, x)
        : { keyframes: [{ ...clip.transform.x.keyframes[0], value: x }] };
      const nextY = s.autoKey || clip.transform.y.keyframes.length > 1
        ? setKeyframe(clip.transform.y, clipTime, y)
        : { keyframes: [{ ...clip.transform.y.keyframes[0], value: y }] };
      const newTransform = { ...clip.transform, x: nextX, y: nextY };
      return updateComp(s, c => ({
        ...c,
        tracks: c.tracks.map(t => ({
          ...t,
          clips: t.clips.map(cl => cl.id === clipId ? { ...cl, transform: newTransform } : cl),
        })),
      }));
    });
  }, [mutate]);

  const toggleTrackVisibility = useCallback((trackId: string) => {
    mutate('trackVis', s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t =>
        t.id === trackId ? { ...t, visible: !t.visible } : t
      ),
    })));
  }, [mutate]);

  const toggleTrackLock = useCallback((trackId: string) => {
    mutate('trackLock', s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t =>
        t.id === trackId ? { ...t, locked: !t.locked } : t
      ),
    })));
  }, [mutate]);

  const toggleTrackMute = useCallback((trackId: string) => {
    mutate('trackMute', s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    })));
  }, [mutate]);

  const addTrack = useCallback((type: LayerType, name?: string) => {
    mutate('addTrack', s => {
      const c = getComp(s);
      const trackName = name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${c.tracks.filter(t => t.type === type).length + 1}`;
      const newTrack: Track = {
        id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: trackName,
        type,
        visible: true,
        locked: false,
        muted: false,
        clips: [],
        volume: 1,
      };
      return updateComp(s, comp => ({
        ...comp,
        tracks: [...comp.tracks, newTrack],
      }));
    });
  }, [mutate]);

  const deleteTrack = useCallback((trackId: string) => {
    mutate('deleteTrack', s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.filter(t => t.id !== trackId),
    })));
  }, [mutate]);

  const reorderTracks = useCallback((fromIndex: number, toIndex: number) => {
    mutate('reorder', s => updateComp(s, comp => {
      const tracks = [...comp.tracks];
      const [moved] = tracks.splice(fromIndex, 1);
      tracks.splice(toIndex, 0, moved);
      return { ...comp, tracks };
    }));
  }, [mutate]);

  const addAsset = useCallback((asset: Asset) => {
    mutate('addAsset', s => ({
      ...s,
      project: { ...s.project, assets: [...s.project.assets, asset] },
    }));
  }, [mutate]);

  const updateAsset = useCallback((assetId: string, patch: Partial<Asset>) => {
    setState(s => ({
      ...s,
      project: {
        ...s.project,
        assets: s.project.assets.map(a => a.id === assetId ? { ...a, ...patch } : a),
      },
    }));
  }, []);

  const deleteAsset = useCallback((assetId: string) => {
    mutate('deleteAsset', s => ({
      ...s,
      project: { ...s.project, assets: s.project.assets.filter(a => a.id !== assetId) },
    }));
  }, [mutate]);

  const setProjectName = useCallback((name: string) => {
    setState(s => ({
      ...s,
      project: { ...s.project, name },
    }));
  }, []);

  const setCompositionDuration = useCallback((duration: number) => {
    mutate('compDur', s => updateComp(s, comp => ({
      ...comp,
      duration: Math.max(1, duration),
      workAreaEnd: Math.min(comp.workAreaEnd ?? duration, Math.max(1, duration)),
    })));
  }, [mutate]);

  const updateComposition = useCallback((patch: Partial<Composition>) => {
    mutate('comp', s => updateComp(s, comp => ({ ...comp, ...patch })));
  }, [mutate]);

  const newProject = useCallback(() => {
    historyRef.current = [];
    futureRef.current = [];
    localStorage.removeItem(AUTOSAVE_KEY);
    setState(s => ({
      ...s,
      project: createDefaultProject(),
      currentTime: 0,
      isPlaying: false,
      selectedClipId: null,
      selectedTrackId: null,
      canUndo: false,
      canRedo: false,
    }));
  }, []);

  const saveProjectFile = useCallback(async () => {
    const project = cloneProject(state.project);
    for (const asset of project.assets) {
      if (asset.type === 'image' && asset.url.startsWith('blob:')) {
        try {
          const blob = await fetch(asset.url).then(r => r.blob());
          asset.url = await blobToDataUrl(blob);
        } catch {
          asset.url = '';
        }
      } else if (asset.url.startsWith('blob:')) {
        asset.url = '';
      }
    }
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.flab.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.project]);

  const loadProjectFile = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as Project;
    if (!parsed?.compositions?.length) throw new Error('Invalid project file');
    historyRef.current = [];
    futureRef.current = [];
    setState(s => ({
      ...s,
      project: parsed,
      currentTime: 0,
      isPlaying: false,
      selectedClipId: null,
      canUndo: false,
      canRedo: false,
    }));
  }, []);

  const undo = useCallback(() => {
    setState(s => {
      const prev = historyRef.current.pop();
      if (!prev) return s;
      futureRef.current.push(cloneProject(s.project));
      return {
        ...s,
        project: prev,
        canUndo: historyRef.current.length > 0,
        canRedo: true,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(s => {
      const next = futureRef.current.pop();
      if (!next) return s;
      historyRef.current.push(cloneProject(s.project));
      return {
        ...s,
        project: next,
        canUndo: true,
        canRedo: futureRef.current.length > 0,
      };
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setState(s => ({ ...s, toast: msg }));
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setState(s => ({ ...s, toast: null }));
    }, 2500);
  }, []);

  const clearToast = useCallback(() => {
    setState(s => ({ ...s, toast: null }));
  }, []);

  const value: EditorContextType = {
    state,
    play, pause, togglePlay, seek, stepFrame, goToStart, goToEnd, setLoop,
    setZoom, setSnapEnabled, setShowGrid, setWorkArea,
    selectClip, selectTrack,
    setToolMode, setAutoKey,
    addClip, deleteClip, moveClip, resizeClip, updateClipTransform, updateClipProperty,
    setTransformValue, setTransformValues, toggleKeyframe, setKeyframeEasing,
    duplicateClip, splitClip, copyClip, pasteClip, nudgeClip,
    toggleTrackVisibility, toggleTrackLock, toggleTrackMute, addTrack, deleteTrack, reorderTracks,
    addAsset, updateAsset, deleteAsset,
    setProjectName, setCompositionDuration, updateComposition,
    newProject, saveProjectFile, loadProjectFile,
    undo, redo,
    getActiveComposition,
    showToast, clearToast,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}

function getComp(state: EditorState): Composition {
  return state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
}

function updateComp(state: EditorState, updater: (c: Composition) => Composition): EditorState {
  const compId = state.project.activeCompositionId;
  return {
    ...state,
    project: {
      ...state.project,
      compositions: state.project.compositions.map(c =>
        c.id === compId ? updater(c) : c
      ),
    },
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
