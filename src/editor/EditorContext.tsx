import {
  createContext, useContext, useState, useCallback, useRef,
  type ReactNode, useEffect,
} from 'react';
import type {
  Project, Composition, Track, Clip, Asset, Transform, LayerType, ToolMode,
} from './types';
import {
  createDefaultComposition, createNewClip,
} from './types';

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
  // Timeline
  setZoom: (zoom: number) => void;
  setSnapEnabled: (v: boolean) => void;
  // Selection
  selectClip: (id: string | null) => void;
  selectTrack: (id: string | null) => void;
  // Tool mode
  setToolMode: (mode: ToolMode) => void;
  // Clip operations
  addClip: (trackId: string, type: LayerType, start: number, duration: number, assetId?: string) => string;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, newStart: number, newTrackId?: string) => void;
  resizeClip: (clipId: string, newStart: number, newDuration: number) => void;
  updateClipTransform: (clipId: string, transform: Transform) => void;
  updateClipProperty: (clipId: string, key: string, value: unknown) => void;
  // Track operations
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  addTrack: (type: LayerType, name?: string) => void;
  deleteTrack: (trackId: string) => void;
  // Assets
  addAsset: (asset: Asset) => void;
  deleteAsset: (assetId: string) => void;
  // Project
  setProjectName: (name: string) => void;
  setCompositionDuration: (duration: number) => void;
  // Composition
  getActiveComposition: () => Composition;
  // Toast
  showToast: (msg: string) => void;
  clearToast: () => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

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

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState>(() => ({
    project: createDefaultProject(),
    currentTime: 0,
    isPlaying: false,
    zoom: 40,
    selectedClipId: null,
    selectedTrackId: null,
    snapEnabled: true,
    showGrid: true,
    toast: null,
    toolMode: 'pointer',
  }));

  const playRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

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
        const newTime = Math.min(s.currentTime + delta, comp.duration);
        if (newTime >= comp.duration) {
          return { ...s, currentTime: comp.duration, isPlaying: false };
        }
        return { ...s, currentTime: newTime };
      });

      if (state.isPlaying) {
        playRef.current = requestAnimationFrame(loop);
      }
    };

    lastFrameRef.current = 0;
    playRef.current = requestAnimationFrame(loop);

    return () => {
      if (playRef.current) cancelAnimationFrame(playRef.current);
    };
  }, [state.isPlaying]);

  const getActiveComposition = useCallback(() => {
    return getComp(state);
  }, [state.project]);

  // Playback controls
  const play = useCallback(() => {
    setState(s => {
      const c = getComp(s);
      if (s.currentTime >= c.duration) {
        return { ...s, currentTime: 0, isPlaying: true };
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
      if (s.isPlaying) return { ...s, isPlaying: false };
      if (s.currentTime >= c.duration) return { ...s, currentTime: 0, isPlaying: true };
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

  const goToStart = useCallback(() => seek(0), [seek]);
  const goToEnd = useCallback(() => {
    setState(s => ({ ...s, currentTime: getComp(s).duration, isPlaying: false }));
  }, []);

  // Timeline
  const setZoom = useCallback((zoom: number) => {
    setState(s => ({ ...s, zoom: Math.max(10, Math.min(400, zoom)) }));
  }, []);

  const setSnapEnabled = useCallback((v: boolean) => {
    setState(s => ({ ...s, snapEnabled: v }));
  }, []);

  // Selection
  const selectClip = useCallback((id: string | null) => {
    setState(s => ({ ...s, selectedClipId: id }));
  }, []);

  const selectTrack = useCallback((id: string | null) => {
    setState(s => ({ ...s, selectedTrackId: id, selectedClipId: null }));
  }, []);

  // Tool mode
  const setToolMode = useCallback((mode: ToolMode) => {
    setState(s => ({ ...s, toolMode: mode }));
  }, []);

  // Clip operations
  const addClip = useCallback((trackId: string, type: LayerType, start: number, duration: number, assetId?: string): string => {
    const clip = createNewClip(trackId, type, start, duration, assetId);
    setState(s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
      ),
    })));
    return clip.id;
  }, []);

  const deleteClip = useCallback((clipId: string) => {
    setState(s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t => ({
        ...t,
        clips: t.clips.filter(c => c.id !== clipId),
      })),
    })));
  }, []);

  const moveClip = useCallback((clipId: string, newStart: number, newTrackId?: string) => {
    setState(s => {
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
        // Same track, just move
        return updateComp(s, comp => ({
          ...comp,
          tracks: comp.tracks.map(t =>
            t.id === targetId
              ? { ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, start: newStart } : c) }
              : t
          ),
        }));
      }

      // Move to different track
      return updateComp(s, comp => ({
        ...comp,
        tracks: comp.tracks.map(t => {
          if (t.id === sourceTrack!.id) {
            return { ...t, clips: t.clips.filter(c => c.id !== clipId) };
          }
          if (t.id === targetId) {
            return { ...t, clips: [...t.clips, { ...clip!, trackId: targetId, start: newStart }] };
          }
          return t;
        }),
      }));
    });
  }, []);

  const resizeClip = useCallback((clipId: string, newStart: number, newDuration: number) => {
    setState(s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id === clipId ? { ...c, start: newStart, duration: Math.max(0.1, newDuration) } : c
        ),
      })),
    })));
  }, []);

  const updateClipTransform = useCallback((clipId: string, transform: Transform) => {
    setState(s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id === clipId ? { ...c, transform } : c
        ),
      })),
    })));
  }, []);

  const updateClipProperty = useCallback((clipId: string, key: string, value: unknown) => {
    setState(s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id === clipId ? { ...c, [key]: value } : c
        ),
      })),
    })));
  }, []);

  // Track operations
  const toggleTrackVisibility = useCallback((trackId: string) => {
    setState(s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t =>
        t.id === trackId ? { ...t, visible: !t.visible } : t
      ),
    })));
  }, []);

  const toggleTrackLock = useCallback((trackId: string) => {
    setState(s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t =>
        t.id === trackId ? { ...t, locked: !t.locked } : t
      ),
    })));
  }, []);

  const toggleTrackMute = useCallback((trackId: string) => {
    setState(s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.map(t =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    })));
  }, []);

  const addTrack = useCallback((type: LayerType, name?: string) => {
    setState(s => {
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
  }, []);

  const deleteTrack = useCallback((trackId: string) => {
    setState(s => updateComp(s, comp => ({
      ...comp,
      tracks: comp.tracks.filter(t => t.id !== trackId),
    })));
  }, []);

  // Assets
  const addAsset = useCallback((asset: Asset) => {
    setState(s => ({
      ...s,
      project: { ...s.project, assets: [...s.project.assets, asset] },
    }));
  }, []);

  const deleteAsset = useCallback((assetId: string) => {
    setState(s => ({
      ...s,
      project: { ...s.project, assets: s.project.assets.filter(a => a.id !== assetId) },
    }));
  }, []);

  // Project
  const setProjectName = useCallback((name: string) => {
    setState(s => ({
      ...s,
      project: { ...s.project, name },
    }));
  }, []);

  const setCompositionDuration = useCallback((duration: number) => {
    setState(s => updateComp(s, comp => ({ ...comp, duration: Math.max(1, duration) })));
  }, []);

  // Toast
  const showToast = useCallback((msg: string) => {
    setState(s => ({ ...s, toast: msg }));
    setTimeout(() => setState(s => ({ ...s, toast: null })), 2500);
  }, []);

  const clearToast = useCallback(() => {
    setState(s => ({ ...s, toast: null }));
  }, []);

  const value: EditorContextType = {
    state,
    play, pause, togglePlay, seek, stepFrame, goToStart, goToEnd,
    setZoom, setSnapEnabled,
    selectClip, selectTrack,
    setToolMode,
    addClip, deleteClip, moveClip, resizeClip, updateClipTransform, updateClipProperty,
    toggleTrackVisibility, toggleTrackLock, toggleTrackMute, addTrack, deleteTrack,
    addAsset, deleteAsset,
    setProjectName, setCompositionDuration,
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

// Helpers
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
