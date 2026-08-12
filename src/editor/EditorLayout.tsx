import { useEditor } from './EditorContext';
import Timeline from './components/Timeline';
import Preview from './components/Preview';
import PropertiesPanel from './components/PropertiesPanel';
import AssetPanel from './components/AssetPanel';
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Save, FolderOpen, Film, MousePointer2, PenTool,
} from 'lucide-react';

export default function EditorLayout() {
  const { state, togglePlay, goToStart, goToEnd, stepFrame, setProjectName, showToast, setToolMode } = useEditor();
  const { currentTime, isPlaying, project, toolMode } = state;

  const comp = project.compositions.find(c => c.id === project.activeCompositionId)!;

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const f = Math.floor((t % 1) * comp.fps);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen w-screen bg-surface-900 text-slate-200 flex flex-col overflow-hidden">
      {/* Top Menu Bar */}
      <div className="h-10 bg-surface-800 border-b border-surface-600 flex items-center px-3 gap-2 shrink-0 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 mr-4 shrink-0">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-white font-bold text-sm">
            FL
          </div>
          <input
            value={project.name}
            onChange={e => setProjectName(e.target.value)}
            className="bg-transparent text-sm font-medium text-slate-300 hover:text-white focus:text-white outline-none border-b border-transparent focus:border-accent px-1 min-w-[80px] w-full max-w-[160px] truncate"
          />
        </div>

        <div className="w-px h-5 bg-surface-600 shrink-0" />

        <button onClick={() => showToast('Project saved')} className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-700 text-xs text-slate-300">
          <Save size={13} />
          Save
        </button>
        <button onClick={() => showToast('Project loaded')} className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-700 text-xs text-slate-300">
          <FolderOpen size={13} />
          Open
        </button>

        <div className="w-px h-5 bg-surface-600 shrink-0" />

        {/* Tool Mode Toggle */}
        <button
          onClick={() => setToolMode('pointer')}
          className={`shrink-0 w-7 h-7 rounded flex items-center justify-center transition-colors ${toolMode === 'pointer' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white hover:bg-surface-700'}`}
          title="Pointer tool (V)"
        >
          <MousePointer2 size={14} />
        </button>
        <button
          onClick={() => setToolMode('pen')}
          className={`shrink-0 w-7 h-7 rounded flex items-center justify-center transition-colors ${toolMode === 'pen' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white hover:bg-surface-700'}`}
          title="Pen tool (P)"
        >
          <PenTool size={14} />
        </button>

        <div className="w-px h-5 bg-surface-600 shrink-0" />

        {/* Playback Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={goToStart} className="w-7 h-7 rounded hover:bg-surface-700 flex items-center justify-center text-slate-400 hover:text-white" title="Go to start">
            <SkipBack size={14} />
          </button>
          <button onClick={() => stepFrame(-1)} className="w-7 h-7 rounded hover:bg-surface-700 flex items-center justify-center text-slate-400 hover:text-white" title="Previous frame">
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-lg bg-accent hover:bg-accent-dark text-white flex items-center justify-center transition-colors"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={() => stepFrame(1)} className="w-7 h-7 rounded hover:bg-surface-700 flex items-center justify-center text-slate-400 hover:text-white" title="Next frame">
            <ChevronRight size={14} />
          </button>
          <button onClick={goToEnd} className="w-7 h-7 rounded hover:bg-surface-700 flex items-center justify-center text-slate-400 hover:text-white" title="Go to end">
            <SkipForward size={14} />
          </button>
        </div>

        <div className="shrink-0 px-3 py-1 rounded bg-surface-700 border border-surface-600">
          <span className="text-xs font-mono text-accent-light">{formatTime(currentTime)}</span>
          <span className="text-xs font-mono text-slate-500"> / {formatTime(comp.duration)}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500">{comp.width}×{comp.height} @ {comp.fps}fps</span>
          <button onClick={() => showToast('Export coming soon')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-dark text-white text-xs font-medium transition-colors">
            <Film size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Asset Panel */}
        <div className="w-56 shrink-0">
          <AssetPanel />
        </div>

        {/* Center: Preview + Timeline */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Preview */}
          <div className="flex-1 min-h-0">
            <Preview />
          </div>

          {/* Timeline */}
          <div className="h-64 shrink-0">
            <Timeline />
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-64 shrink-0">
          <PropertiesPanel />
        </div>
      </div>

      {/* Toast */}
      {state.toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-700 text-white px-4 py-2 rounded-lg shadow-xl border border-surface-500 text-sm z-50 animate-in fade-in slide-in-from-bottom-4">
          {state.toast}
        </div>
      )}
    </div>
  );
}
