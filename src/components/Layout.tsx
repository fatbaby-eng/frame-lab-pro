import { useRef, useCallback } from 'react';
import { useApp, type TabId } from '../context/AppContext';
import { cn } from '../lib/utils';
import { lazy } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { DroppedFile } from '../hooks/useDragAndDrop';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import DropZone from './DropZone';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import {
  Box,
  AudioWaveform,
  Film,
  Puzzle,
  FolderOpen,
  Save,
  Settings,
  Info,
} from 'lucide-react';

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'mesh', label: '3D Mesh', icon: Box },
  { id: 'audio', label: 'Audio', icon: AudioWaveform },
  { id: 'gif', label: 'GIF Export', icon: Film },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
];

const MeshWorkspace = lazy(() => import('../features/three/MeshViewer'));
const AudioWorkspace = lazy(() => import('../features/audio/WaveformVisualizer'));
const GifWorkspace = lazy(() => import('../features/export/GifExporter'));
const PluginsWorkspace = lazy(() => import('../features/plugins/PluginManager'));

export default function Layout() {
  const { state, setActiveTab, showToast, setProjectName, setPendingDrop } = useApp();
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Determine accepted file types based on active tab
  const acceptedTypes: DroppedFile['type'][] | undefined = (() => {
    switch (state.activeTab) {
      case 'audio': return ['audio'];
      case 'gif': return ['image'];
      case 'plugins': return ['json'];
      case 'mesh': return ['image', 'model'];
      default: return undefined;
    }
  })();

  const handleDrop = useCallback((files: DroppedFile[]) => {
    if (files.length === 0) {
      showToast('No supported files detected');
      return;
    }

    // Route drops based on active tab
    switch (state.activeTab) {
      case 'audio':
        if (files.some(f => f.type === 'audio')) {
          setPendingDrop(files);
          showToast(`Dropped ${files.length} audio file(s)`);
        } else {
          showToast('Switch to the Audio tab to drop audio files');
        }
        break;
      case 'gif':
        if (files.some(f => f.type === 'image')) {
          setPendingDrop(files);
          showToast(`Dropped ${files.length} image(s) for GIF frames`);
        } else {
          showToast('Switch to the GIF tab to drop images');
        }
        break;
      case 'plugins':
        if (files.some(f => f.type === 'json')) {
          setPendingDrop(files);
          showToast(`Dropped ${files.length} plugin file(s)`);
        } else {
          showToast('Switch to the Plugins tab to drop JSON files');
        }
        break;
      case 'mesh':
        showToast('3D model drag-and-drop requires additional loaders — try the Audio, GIF, or Plugins tabs!');
        break;
      default:
        showToast(`Dropped ${files.length} file(s)`);
    }
  }, [state.activeTab, showToast, setPendingDrop]);

  const { isDragging } = useDragAndDrop(workspaceRef, handleDrop, { acceptedTypes });

  // Keyboard shortcuts
  const shortcuts = [
    { key: '1', label: 'Open 3D Mesh tab', scope: 'Navigation', action: () => setActiveTab('mesh') },
    { key: '2', label: 'Open Audio tab', scope: 'Navigation', action: () => setActiveTab('audio') },
    { key: '3', label: 'Open GIF Export tab', scope: 'Navigation', action: () => setActiveTab('gif') },
    { key: '4', label: 'Open Plugins tab', scope: 'Navigation', action: () => setActiveTab('plugins') },
    { key: 'ctrl+s', label: 'Save project', scope: 'File', action: () => showToast('Project saved successfully') },
    { key: 'ctrl+o', label: 'Open project', scope: 'File', action: () => showToast('Project loaded') },
    { key: 'ctrl+n', label: 'New project name', scope: 'File', action: () => {
      const name = prompt('Enter project name:', state.projectName);
      if (name) setProjectName(name);
    } },
    { key: 'escape', label: 'Close modals / stop animation', scope: 'General', action: () => {
      setPendingDrop(null);
    } },
  ];

  const { showHelp, setShowHelp } = useKeyboardShortcuts(shortcuts, [state.activeTab, state.projectName]);

  return (
    <div className="flex h-screen w-screen bg-surface-900 text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 bg-surface-800 border-r border-surface-600 flex flex-col items-center py-4 gap-2 shrink-0">
        <div className="mb-4 w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-accent/30">
          FL
        </div>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = state.activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 relative group',
                active
                  ? 'bg-accent text-white shadow-md shadow-accent/25'
                  : 'text-slate-400 hover:text-white hover:bg-surface-700'
              )}
            >
              <Icon size={20} />
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
              )}
              <span className="absolute left-14 bg-surface-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-surface-500">
                {tab.label}
              </span>
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => setShowHelp(true)}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-surface-700 transition-all"
          title="Keyboard Shortcuts (?)"
        >
          <span className="text-xs font-bold">?</span>
        </button>
        <button
          onClick={() => showToast('Settings panel coming soon')}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-surface-700 transition-all"
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0" ref={workspaceRef}>
        {/* Toolbar */}
        <header className="h-14 bg-surface-800 border-b border-surface-600 flex items-center px-4 gap-3 shrink-0">
          <h1 className="font-semibold text-sm tracking-wide text-slate-300 mr-auto">
            {state.projectName}
          </h1>
          <button
            onClick={() => showToast('Project loaded')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs font-medium transition-colors border border-surface-500"
          >
            <FolderOpen size={14} />
            Open
          </button>
          <button
            onClick={() => showToast('Project saved successfully')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-dark text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={() => showToast('Frame Lab Pro v2.0.0 — Built with React, Three.js, and Web Audio API')}
            className="w-8 h-8 rounded-lg hover:bg-surface-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            title="About"
          >
            <Info size={16} />
          </button>
        </header>

        {/* Workspace */}
        <main className="flex-1 overflow-hidden relative">
          <DropZone isDragging={isDragging} acceptedTypes={acceptedTypes} />
          <TabPanel tabId="mesh" activeTab={state.activeTab}>
            <MeshWorkspace />
          </TabPanel>
          <TabPanel tabId="audio" activeTab={state.activeTab}>
            <AudioWorkspace />
          </TabPanel>
          <TabPanel tabId="gif" activeTab={state.activeTab}>
            <GifWorkspace />
          </TabPanel>
          <TabPanel tabId="plugins" activeTab={state.activeTab}>
            <PluginsWorkspace />
          </TabPanel>
        </main>

        {/* Toast */}
        {state.toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-surface-700 text-white px-4 py-2 rounded-lg shadow-xl border border-surface-500 text-sm animate-in fade-in slide-in-from-bottom-4 z-50">
            {state.toast}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showHelp && (
        <KeyboardShortcutsModal shortcuts={shortcuts} onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}

function TabPanel({ tabId, activeTab, children }: { tabId: TabId; activeTab: TabId; children: React.ReactNode }) {
  if (tabId !== activeTab) return null;
  return (
    <div className="h-full w-full animate-in fade-in duration-300">
      {children}
    </div>
  );
}
