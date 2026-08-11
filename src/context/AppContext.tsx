import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { DroppedFile } from '../hooks/useDragAndDrop';

export type TabId = 'mesh' | 'audio' | 'gif' | 'plugins';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  author?: string;
  entry?: string;
}

export interface AppState {
  activeTab: TabId;
  plugins: Plugin[];
  toast: string | null;
  projectName: string;
  pendingDrop: DroppedFile[] | null;
}

interface AppContextType {
  state: AppState;
  setActiveTab: (tab: TabId) => void;
  addPlugin: (plugin: Plugin) => void;
  removePlugin: (id: string) => void;
  togglePlugin: (id: string) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  setProjectName: (name: string) => void;
  setPendingDrop: (files: DroppedFile[] | null) => void;
}

const defaultPlugins: Plugin[] = [
  { id: 'noise-gen', name: 'Noise Generator', version: '1.0.0', description: 'Generate procedural noise textures and displacement maps.', enabled: true, author: 'Frame Lab' },
  { id: 'spectrum-analyzer', name: 'Spectrum Analyzer', version: '1.0.0', description: 'Real-time FFT spectrum visualization for audio tracks.', enabled: true, author: 'Frame Lab' },
  { id: 'batch-export', name: 'Batch Exporter', version: '1.0.0', description: 'Export multiple formats in parallel with custom presets.', enabled: false, author: 'Frame Lab' },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    activeTab: 'mesh',
    plugins: defaultPlugins,
    toast: null,
    projectName: 'Untitled Project',
    pendingDrop: null,
  });

  const setActiveTab = useCallback((tab: TabId) => {
    setState(s => ({ ...s, activeTab: tab }));
  }, []);

  const addPlugin = useCallback((plugin: Plugin) => {
    setState(s => ({ ...s, plugins: [...s.plugins, plugin] }));
  }, []);

  const removePlugin = useCallback((id: string) => {
    setState(s => ({ ...s, plugins: s.plugins.filter(p => p.id !== id) }));
  }, []);

  const togglePlugin = useCallback((id: string) => {
    setState(s => ({
      ...s,
      plugins: s.plugins.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p),
    }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setState(s => ({ ...s, toast: msg }));
    setTimeout(() => setState(s => ({ ...s, toast: null })), 3000);
  }, []);

  const clearToast = useCallback(() => {
    setState(s => ({ ...s, toast: null }));
  }, []);

  const setProjectName = useCallback((name: string) => {
    setState(s => ({ ...s, projectName: name }));
  }, []);

  const setPendingDrop = useCallback((files: DroppedFile[] | null) => {
    setState(s => ({ ...s, pendingDrop: files }));
  }, []);

  return (
    <AppContext.Provider value={{ state, setActiveTab, addPlugin, removePlugin, togglePlugin, showToast, clearToast, setProjectName, setPendingDrop }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
