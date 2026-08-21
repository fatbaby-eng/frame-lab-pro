import { useState, useRef, useCallback, useEffect } from 'react';
import type { Composition, Project } from '../types';
import { exportToWebM, exportToGIF, downloadBlob } from '../export';
import { mediaCacheMap } from '../mediaCache';
import type { ExportFormat, ExportSettings, ExportProgress } from '../export';
import { X, Film, Image as ImageIcon, Download, Loader2 } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  comp: Composition;
  project: Project;
}

export default function ExportDialog({ open, onClose, comp, project }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('webm');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [useWorkArea, setUseWorkArea] = useState(true);
  const [progress, setProgress] = useState<ExportProgress>({ frame: 0, totalFrames: 0, time: 0, status: 'idle' });
  const [blob, setBlob] = useState<Blob | null>(null);
  const abortRef = useRef(false);
  const assetCache = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (!open) return;
    assetCache.current = mediaCacheMap(project.assets);
  }, [open, project.assets]);

  const rangeStart = useWorkArea ? (comp.workAreaStart ?? 0) : 0;
  const rangeEnd = useWorkArea ? (comp.workAreaEnd ?? comp.duration) : comp.duration;
  const exportFps = format === 'gif' ? Math.min(comp.fps, 15) : comp.fps;
  const totalFrames = Math.max(1, Math.ceil((rangeEnd - rangeStart) * exportFps));
  const gifScale = Math.min(1, 540 / Math.max(comp.width, comp.height));
  const outW = format === 'gif' ? Math.round(comp.width * gifScale) : comp.width;
  const outH = format === 'gif' ? Math.round(comp.height * gifScale) : comp.height;

  const handleExport = useCallback(async () => {
    abortRef.current = false;
    setBlob(null);
    setProgress({ frame: 0, totalFrames, time: rangeStart, status: 'rendering' });

    const settings: ExportSettings = {
      format,
      quality,
      startTime: rangeStart,
      endTime: rangeEnd,
    };

    try {
      let result: Blob;
      if (format === 'webm') {
        result = await exportToWebM(comp, project, assetCache.current, settings, (p) => {
          if (!abortRef.current) setProgress(p);
        });
      } else {
        result = await exportToGIF(comp, project, assetCache.current, settings, (p) => {
          if (!abortRef.current) setProgress(p);
        });
      }

      if (!abortRef.current) {
        setBlob(result);
        setProgress(p => ({ ...p, status: 'done' }));
      }
    } catch (err) {
      if (!abortRef.current) {
        setProgress({
          frame: 0, totalFrames: 0, time: 0,
          status: 'error',
          error: err instanceof Error ? err.message : 'Export failed',
        });
      }
    }
  }, [format, quality, comp, project, totalFrames, rangeStart, rangeEnd]);

  const handleDownload = useCallback(() => {
    if (!blob) return;
    const ext = format === 'webm' ? 'webm' : 'gif';
    const filename = `${comp.name.replace(/\s+/g, '_')}_${comp.width}x${comp.height}.${ext}`;
    downloadBlob(blob, filename);
  }, [blob, format, comp.name, comp.width, comp.height]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    setProgress({ frame: 0, totalFrames: 0, time: 0, status: 'idle' });
    setBlob(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const isRendering = progress.status === 'rendering' || progress.status === 'encoding';
  const pct = progress.totalFrames > 0
    ? Math.round((progress.frame / progress.totalFrames) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600">
          <h2 className="text-sm font-semibold text-white">Export</h2>
          <button onClick={handleCancel} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Format */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block">Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('webm')}
                disabled={isRendering}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${format === 'webm' ? 'bg-accent/20 border-accent text-accent-light' : 'bg-surface-700 border-surface-600 text-slate-300 hover:border-slate-500'}`}
              >
                <Film size={14} />
                WebM Video
              </button>
              <button
                onClick={() => setFormat('gif')}
                disabled={isRendering}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${format === 'gif' ? 'bg-accent/20 border-accent text-accent-light' : 'bg-surface-700 border-surface-600 text-slate-300 hover:border-slate-500'}`}
              >
                <ImageIcon size={14} />
                GIF
              </button>
            </div>
          </div>

          {/* Quality */}
          {format === 'webm' && (
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block">Quality</label>
              <div className="flex gap-1 bg-surface-700 rounded p-0.5">
                {(['low', 'medium', 'high'] as const).map(q => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    disabled={isRendering}
                    className={`flex-1 py-1 text-[10px] rounded capitalize transition-colors ${quality === q ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center justify-between text-[10px] text-slate-400 cursor-pointer">
            <span>Export work area only</span>
            <button
              type="button"
              onClick={() => setUseWorkArea(v => !v)}
              disabled={isRendering}
              className={`w-6 h-3.5 rounded-full relative transition-colors ${useWorkArea ? 'bg-accent' : 'bg-surface-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${useWorkArea ? 'translate-x-2.5' : ''}`} />
            </button>
          </label>

          {/* Info */}
          <div className="bg-surface-700/50 rounded-lg px-3 py-2 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">Resolution</span>
              <span className="text-slate-300">{outW}×{outH}{format === 'gif' && gifScale < 1 ? ' (GIF)' : ''}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">Frame Rate</span>
              <span className="text-slate-300">{exportFps} fps</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">Duration</span>
              <span className="text-slate-300">{(rangeEnd - rangeStart).toFixed(1)}s</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">Total Frames</span>
              <span className="text-slate-300">{totalFrames}</span>
            </div>
          </div>

          {/* Progress */}
          {isRendering && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">{progress.status === 'encoding' ? 'Encoding…' : 'Rendering frames…'}</span>
                <span className="text-slate-300">{pct}%</span>
              </div>
              <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 text-center">
                Frame {progress.frame} / {progress.totalFrames}
              </div>
            </div>
          )}

          {progress.status === 'error' && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {progress.error}
            </div>
          )}

          {progress.status === 'done' && blob && (
            <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <span>Export complete — {format === 'webm' ? 'WebM' : 'GIF'} ready</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-surface-600">
          {progress.status === 'done' && blob ? (
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-dark text-white text-xs font-medium transition-colors"
            >
              <Download size={14} />
              Download
            </button>
          ) : isRendering ? (
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-slate-300 text-xs font-medium transition-colors border border-surface-600"
            >
              <Loader2 size={14} className="animate-spin" />
              Cancel
            </button>
          ) : (
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-dark text-white text-xs font-medium transition-colors"
            >
              <Film size={14} />
              Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
