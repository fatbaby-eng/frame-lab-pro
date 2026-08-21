import { useRef, useMemo, useState, useEffect } from 'react';
import { stopTransportAudio, syncTransportAudio } from './audioEngine';
import { useEditor } from './EditorContext';
import Timeline from './components/Timeline';
import Preview from './components/Preview';
import PropertiesPanel from './components/PropertiesPanel';
import AssetPanel from './components/AssetPanel';
import ExportDialog from './components/ExportDialog';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal';
import { useKeyboardShortcuts, type Shortcut } from '../hooks/useKeyboardShortcuts';
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Save, FolderOpen, Film, MousePointer2, PenTool, Type, Square,
  Undo2, Redo2, FilePlus, Repeat, HelpCircle,
} from 'lucide-react';

export default function EditorLayout() {
  const {
    state, togglePlay, goToStart, goToEnd, stepFrame, seek, setProjectName, showToast,
    setToolMode, undo, redo, deleteClip, duplicateClip, splitClip, copyClip,
    pasteClip, nudgeClip, saveProjectFile, loadProjectFile, newProject, setLoop,
    jumpKeyframe, trimClipEdge, toggleExpanded, removeKeyframeAt, setWorkArea,
  } = useEditor();
  const { currentTime, isPlaying, project, toolMode, selectedClipId, canUndo, canRedo, loop, selectedKeyframe } = state;
  const [timelineH, setTimelineH] = useState(280);
  const [exportOpen, setExportOpen] = useState(false);
  const [tcEdit, setTcEdit] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const comp = project.compositions.find(c => c.id === project.activeCompositionId)!;

  useEffect(() => {
    syncTransportAudio(comp, project, currentTime, isPlaying);
  }, [comp, project, currentTime, isPlaying]);

  useEffect(() => () => { stopTransportAudio(project); }, [project]);

  const shortcuts: Shortcut[] = useMemo(() => [
    { key: 'space', label: 'Play / Pause', scope: 'Playback', action: togglePlay },
    { key: 'home', label: 'Go to start', scope: 'Playback', action: goToStart },
    { key: 'end', label: 'Go to end', scope: 'Playback', action: goToEnd },
    { key: 'arrowleft', label: 'Previous frame', scope: 'Playback', action: () => stepFrame(-1) },
    { key: 'arrowright', label: 'Next frame', scope: 'Playback', action: () => stepFrame(1) },
    { key: 'v', label: 'Pointer tool', scope: 'Tools', action: () => setToolMode('pointer') },
    { key: 'p', label: 'Pen tool', scope: 'Tools', action: () => setToolMode('pen') },
    { key: 't', label: 'Text tool', scope: 'Tools', action: () => setToolMode('text') },
    { key: 'g', label: 'Shape tool', scope: 'Tools', action: () => setToolMode('shape') },
    { key: 'delete', label: 'Delete keyframe or clip', scope: 'Edit', action: () => {
      if (selectedKeyframe) removeKeyframeAt(selectedKeyframe.clipId, selectedKeyframe.key, selectedKeyframe.time);
      else if (selectedClipId) deleteClip(selectedClipId);
    } },
    { key: 'backspace', label: 'Delete keyframe or clip', scope: 'Edit', action: () => {
      if (selectedKeyframe) removeKeyframeAt(selectedKeyframe.clipId, selectedKeyframe.key, selectedKeyframe.time);
      else if (selectedClipId) deleteClip(selectedClipId);
    } },
    { key: 'j', label: 'Previous keyframe', scope: 'Playback', action: () => jumpKeyframe(-1) },
    { key: 'k', label: 'Next keyframe', scope: 'Playback', action: () => jumpKeyframe(1) },
    { key: 'u', label: 'Twirl selected layer', scope: 'Timeline', action: () => toggleExpanded() },
    { key: 's', label: 'Split clip at playhead', scope: 'Edit', action: () => { if (selectedClipId) splitClip(selectedClipId); } },
    { key: '[', label: 'Trim in to playhead', scope: 'Edit', action: () => { if (selectedClipId) trimClipEdge(selectedClipId, 'in'); } },
    { key: ']', label: 'Trim out to playhead', scope: 'Edit', action: () => { if (selectedClipId) trimClipEdge(selectedClipId, 'out'); } },
    { key: 'b', label: 'Set work area start', scope: 'Timeline', action: () => setWorkArea(currentTime, comp.workAreaEnd ?? comp.duration) },
    { key: 'n', label: 'Set work area end', scope: 'Timeline', action: () => setWorkArea(comp.workAreaStart ?? 0, currentTime) },
    { key: 'i', label: 'Go to work area start', scope: 'Playback', action: () => goToStart() },
    { key: 'o', label: 'Go to work area end', scope: 'Playback', action: () => goToEnd() },
    { key: 'pageup', label: 'Jump back 1s', scope: 'Playback', action: () => stepFrame(-comp.fps) },
    { key: 'pagedown', label: 'Jump forward 1s', scope: 'Playback', action: () => stepFrame(comp.fps) },
    { key: 'ctrl+z', label: 'Undo', scope: 'Edit', action: undo },
    { key: 'ctrl+y', label: 'Redo', scope: 'Edit', action: redo },
    { key: 'ctrl+shift+z', label: 'Redo', scope: 'Edit', action: redo },
    { key: 'ctrl+d', label: 'Duplicate clip', scope: 'Edit', action: () => { if (selectedClipId) duplicateClip(selectedClipId); } },
    { key: 'ctrl+shift+d', label: 'Split clip at playhead', scope: 'Edit', action: () => { if (selectedClipId) splitClip(selectedClipId); } },
    { key: 'ctrl+c', label: 'Copy clip', scope: 'Edit', action: () => { if (selectedClipId) copyClip(selectedClipId); } },
    { key: 'ctrl+v', label: 'Paste clip', scope: 'Edit', action: pasteClip },
    { key: 'ctrl+s', label: 'Save project', scope: 'Project', action: () => { void saveProjectFile().then(() => showToast('Project saved')); } },
    { key: 'shift+arrowleft', label: 'Nudge left', scope: 'Edit', action: () => { if (selectedClipId) nudgeClip(selectedClipId, -10, 0); } },
    { key: 'shift+arrowright', label: 'Nudge right', scope: 'Edit', action: () => { if (selectedClipId) nudgeClip(selectedClipId, 10, 0); } },
    { key: 'shift+arrowup', label: 'Nudge up', scope: 'Edit', action: () => { if (selectedClipId) nudgeClip(selectedClipId, 0, -10); } },
    { key: 'shift+arrowdown', label: 'Nudge down', scope: 'Edit', action: () => { if (selectedClipId) nudgeClip(selectedClipId, 0, 10); } },
  ], [
    togglePlay, goToStart, goToEnd, stepFrame, setToolMode, selectedClipId,
    selectedKeyframe, deleteClip, removeKeyframeAt, undo, redo, duplicateClip,
    splitClip, copyClip, pasteClip, saveProjectFile, showToast, nudgeClip,
    jumpKeyframe, toggleExpanded, trimClipEdge, setWorkArea, currentTime, comp,
  ]);

  const { showHelp, setShowHelp } = useKeyboardShortcuts(shortcuts);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const f = Math.floor((t % 1) * comp.fps);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  const handleOpen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadProjectFile(file);
      showToast('Project loaded');
    } catch {
      showToast('Could not load project file');
    }
    e.target.value = '';
  };

  const handleNew = () => {
    if (confirm('Start a new project? Unsaved changes will be lost.')) {
      newProject();
      showToast('New project');
    }
  };

  return (
    <div className="h-screen w-screen bg-surface-900 text-slate-200 flex flex-col overflow-hidden relative">
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

        <button onClick={handleNew} className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-700 text-xs text-slate-300" title="New project">
          <FilePlus size={13} />
        </button>
        <button
          onClick={() => { void saveProjectFile().then(() => showToast('Project saved')); }}
          className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-700 text-xs text-slate-300"
        >
          <Save size={13} />
          Save
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-700 text-xs text-slate-300">
          <FolderOpen size={13} />
          Open
        </button>
        <input ref={fileInputRef} type="file" accept=".json,.flab.json" className="hidden" onChange={e => { void handleOpen(e); }} />

        <button onClick={undo} disabled={!canUndo} className="shrink-0 w-7 h-7 rounded hover:bg-surface-700 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30" title="Undo (Ctrl+Z)">
          <Undo2 size={13} />
        </button>
        <button onClick={redo} disabled={!canRedo} className="shrink-0 w-7 h-7 rounded hover:bg-surface-700 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30" title="Redo (Ctrl+Y)">
          <Redo2 size={13} />
        </button>

        <div className="w-px h-5 bg-surface-600 shrink-0" />

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
        <button
          onClick={() => setToolMode('text')}
          className={`shrink-0 w-7 h-7 rounded flex items-center justify-center transition-colors ${toolMode === 'text' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white hover:bg-surface-700'}`}
          title="Text tool (T)"
        >
          <Type size={14} />
        </button>
        <button
          onClick={() => setToolMode('shape')}
          className={`shrink-0 w-7 h-7 rounded flex items-center justify-center transition-colors ${toolMode === 'shape' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white hover:bg-surface-700'}`}
          title="Shape tool (G)"
        >
          <Square size={14} />
        </button>

        <div className="w-px h-5 bg-surface-600 shrink-0" />

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
          <button
            onClick={() => setLoop(!loop)}
            className={`w-7 h-7 rounded flex items-center justify-center ${loop ? 'text-accent-light bg-accent/20' : 'text-slate-500 hover:text-white hover:bg-surface-700'}`}
            title="Loop"
          >
            <Repeat size={13} />
          </button>
        </div>

        <div className="shrink-0 px-2 py-0.5 rounded bg-surface-700 border border-surface-600 flex items-center gap-1">
          <input
            value={tcEdit ?? formatTime(currentTime)}
            onFocus={() => setTcEdit(formatTime(currentTime))}
            onChange={e => setTcEdit(e.target.value)}
            onBlur={() => {
              const parsed = parseTimecode(tcEdit ?? '', comp.fps);
              if (parsed != null) seek(Math.max(0, Math.min(parsed, comp.duration)));
              setTcEdit(null);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setTcEdit(null);
            }}
            className="w-[4.6rem] bg-transparent text-xs font-mono text-accent-light outline-none text-right"
            title="Jump to timecode (mm:ss:ff)"
            spellCheck={false}
          />
          <span className="text-xs font-mono text-slate-500"> / {formatTime(comp.duration)}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button onClick={() => setShowHelp(true)} className="text-slate-500 hover:text-white" title="Shortcuts (?)">
            <HelpCircle size={14} />
          </button>
          <span className="text-[10px] text-slate-500">{comp.width}×{comp.height} @ {comp.fps}fps</span>
          <button onClick={() => setExportOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-dark text-white text-xs font-medium transition-colors">
            <Film size={13} />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 shrink-0">
          <AssetPanel />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <Preview />
          </div>
          <div
            className="h-1.5 shrink-0 cursor-row-resize bg-surface-700 hover:bg-accent/50"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startH = timelineH;
              const move = (ev: MouseEvent) => {
                setTimelineH(Math.max(180, Math.min(520, startH - (ev.clientY - startY))));
              };
              const up = () => {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
              };
              window.addEventListener('mousemove', move);
              window.addEventListener('mouseup', up);
            }}
            title="Drag to resize timeline"
          />
          <div className="shrink-0" style={{ height: timelineH }}>
            <Timeline />
          </div>
        </div>

        <div className="w-80 min-w-0 shrink-0 overflow-hidden">
          <PropertiesPanel />
        </div>
      </div>

      {state.toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-700 text-white px-4 py-2 rounded-lg shadow-xl border border-surface-500 text-sm z-50">
          {state.toast}
        </div>
      )}

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} comp={comp} project={project} />

      {showHelp && (
        <KeyboardShortcutsModal shortcuts={shortcuts} onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}

function parseTimecode(str: string, fps: number): number | null {
  const parts = str.trim().split(/[:;]/);
  if (parts.length === 1) {
    const n = parseFloat(parts[0]);
    return Number.isFinite(n) ? n : null;
  }
  if (parts.length === 2) {
    const s = parseInt(parts[0], 10);
    const f = parseInt(parts[1], 10);
    if ([s, f].some(Number.isNaN)) return null;
    return s + f / fps;
  }
  if (parts.length === 3) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    const f = parseInt(parts[2], 10);
    if ([m, s, f].some(Number.isNaN)) return null;
    return m * 60 + s + f / fps;
  }
  return null;
}
