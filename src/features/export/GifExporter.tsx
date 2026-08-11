import { useRef, useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Film,
  Play,
  Square,
  Download,
  Trash2,
  Layers,
} from 'lucide-react';
import gifshot from 'gifshot';

interface FrameData {
  id: string;
  image: string;
  delay: number;
}

export default function GifExporter() {
  const { state, showToast, setPendingDrop } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const [frames, setFrames] = useState<FrameData[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [gifWidth, setGifWidth] = useState(480);
  const [gifHeight, setGifHeight] = useState(270);
  const [frameDelay, setFrameDelay] = useState(200);
  const [bgColor, setBgColor] = useState('#0a0a0f');
  const [shape, setShape] = useState<'circle' | 'square' | 'triangle'>('circle');
  const [animating, setAnimating] = useState(false);

  // Handle dropped image files from global drag-and-drop
  useEffect(() => {
    if (!state.pendingDrop) return;
    const imageFiles = state.pendingDrop.filter(f => f.type === 'image');
    if (imageFiles.length > 0) {
      Promise.all(
        imageFiles.map(df => {
          return new Promise<FrameData>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                image: e.target?.result as string,
                delay: frameDelay,
              });
            };
            reader.readAsDataURL(df.file);
          });
        })
      ).then(newFrames => {
        setFrames(prev => [...prev, ...newFrames]);
        showToast(`Added ${newFrames.length} image(s) as frames`);
      });
    }
    setPendingDrop(null);
  }, [state.pendingDrop, setPendingDrop, frameDelay, showToast]);

  // Animated preview on canvas
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      t += 0.03;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 40 + Math.sin(t) * 20;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t);

      ctx.fillStyle = '#6366f1';
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 3;

      if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (shape === 'square') {
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(radius, radius);
        ctx.lineTo(-radius, radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // Orbiting particles
      for (let i = 0; i < 5; i++) {
        const angle = t + (i * Math.PI * 2) / 5;
        const px = cx + Math.cos(angle) * (radius + 30);
        const py = cy + Math.sin(angle) * (radius + 30);
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ec4899';
        ctx.fill();
      }
    };

    draw();
  }, [bgColor, shape]);

  useEffect(() => {
    if (animating) {
      drawPreview();
    } else {
      // Static draw
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#6366f1';
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, 40, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [animating, drawPreview, bgColor]);

  const captureFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const newFrame: FrameData = {
      id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      image: dataUrl,
      delay: frameDelay,
    };
    setFrames(prev => [...prev, newFrame]);
    showToast(`Captured frame ${frames.length + 1}`);
  };

  const deleteFrame = (id: string) => {
    setFrames(prev => prev.filter(f => f.id !== id));
  };

  const clearFrames = () => {
    setFrames([]);
    setPreviewUrl('');
    showToast('All frames cleared');
  };

  const exportGif = () => {
    if (frames.length < 2) {
      showToast('Need at least 2 frames to create a GIF');
      return;
    }

    showToast('Generating GIF...');

    const images = frames.map(f => f.image);

    gifshot.createGIF(
      {
        images,
        gifWidth,
        gifHeight,
        interval: frameDelay / 1000,
        numWorkers: 2,
        progressCallback: (progress: number) => {
          console.log('GIF progress:', progress);
        },
      },
      (result) => {
        if (result.error) {
          showToast(`GIF Error: ${result.errorMsg || 'Unknown'}`);
          return;
        }
        if (result.image) {
          setPreviewUrl(result.image);
          showToast('GIF generated successfully');
        }
      }
    );
  };

  const downloadGif = () => {
    if (!previewUrl) {
      showToast('Generate a GIF first');
      return;
    }
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `frame-lab-export-${Date.now()}.gif`;
    a.click();
    showToast('GIF downloaded');
  };

  return (
    <div className="flex h-full">
      {/* Main workspace */}
      <div className="flex-1 flex flex-col bg-surface-900">
        {/* Canvas preview */}
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={480}
              height={270}
              className="rounded-xl border-2 border-surface-600 shadow-2xl"
              style={{ maxWidth: '100%', maxHeight: '60vh' }}
            />
            {animating && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-md animate-pulse">
                <span className="w-1.5 h-1.5 bg-white rounded-full" />
                LIVE
              </div>
            )}
          </div>
        </div>

        {/* Timeline / Frames */}
        <div className="h-40 bg-surface-800 border-t border-surface-600 flex flex-col">
          <div className="px-4 py-2 border-b border-surface-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-slate-400" />
              <span className="text-xs font-medium text-slate-300">Timeline — {frames.length} frames</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={captureFrame}
                className="px-2.5 py-1 rounded-md bg-accent hover:bg-accent-dark text-white text-[10px] font-medium transition-colors"
              >
                Capture Frame
              </button>
              <button
                onClick={clearFrames}
                disabled={frames.length === 0}
                className="px-2.5 py-1 rounded-md bg-surface-700 hover:bg-red-500/20 hover:text-red-400 text-slate-400 text-[10px] font-medium transition-colors disabled:opacity-30"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-x-auto p-3 flex gap-2">
            {frames.length === 0 && (
              <div className="w-full flex items-center justify-center text-slate-500 text-xs">
                No frames captured yet. Start the animation, click "Capture Frame", or drop images here to build your GIF.
              </div>
            )}
            {frames.map((frame, idx) => (
              <div key={frame.id} className="shrink-0 w-20 flex flex-col gap-1 group">
                <div className="relative w-20 h-12 rounded-lg overflow-hidden border border-surface-600 bg-surface-700">
                  <img src={frame.image} alt={`Frame ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => deleteFrame(frame.id)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px]"
                  >
                    ×
                  </button>
                </div>
                <span className="text-[9px] text-slate-500 text-center">{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      <div className="w-72 bg-surface-800 border-l border-surface-600 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-surface-600">
          <h2 className="text-sm font-semibold text-white mb-1">GIF Studio</h2>
          <p className="text-xs text-slate-400">Frame capture & GIF export — drop images to add frames</p>
        </div>

        <div className="p-4 space-y-5">
          {/* Playback controls */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Preview</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAnimating(true)}
                disabled={animating}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent hover:bg-accent-dark disabled:bg-surface-700 text-white text-xs font-medium transition-colors"
              >
                <Play size={14} />
                Start
              </button>
              <button
                onClick={() => setAnimating(false)}
                disabled={!animating}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-700 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30 text-slate-300 text-xs font-medium transition-colors"
              >
                <Square size={14} />
                Stop
              </button>
            </div>
          </div>

          {/* Shape */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Shape</label>
            <div className="flex gap-1 bg-surface-700 rounded-lg p-1">
              {(['circle', 'square', 'triangle'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setShape(s)}
                  className={`flex-1 py-1.5 text-[10px] rounded-md capitalize transition-all ${
                    shape === s ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Background</label>
            <div className="flex gap-2 flex-wrap">
              {['#0a0a0f', '#1a1a24', '#0f172a', '#000000', '#ffffff', '#ef4444', '#22c55e', '#6366f1'].map(c => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    bgColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Dimensions</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-[10px] text-slate-500 mb-1">Width</div>
                <input
                  type="number"
                  value={gifWidth}
                  onChange={e => setGifWidth(parseInt(e.target.value) || 480)}
                  className="w-full px-2 py-1.5 rounded-md bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-slate-500 mb-1">Height</div>
                <input
                  type="number"
                  value={gifHeight}
                  onChange={e => setGifHeight(parseInt(e.target.value) || 270)}
                  className="w-full px-2 py-1.5 rounded-md bg-surface-700 border border-surface-600 text-xs text-white focus:border-accent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Frame delay */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Frame Delay</label>
              <span className="text-xs text-slate-300">{frameDelay}ms</span>
            </div>
            <input
              type="range"
              min={50}
              max={1000}
              step={50}
              value={frameDelay}
              onChange={e => setFrameDelay(parseInt(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          {/* Export Actions */}
          <div className="pt-4 border-t border-surface-600 space-y-2">
            <button
              onClick={exportGif}
              disabled={frames.length < 2}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent hover:bg-accent-dark disabled:bg-surface-700 disabled:text-slate-500 text-white text-xs font-medium transition-colors"
            >
              <Film size={14} />
              Generate GIF
            </button>
            <button
              onClick={downloadGif}
              disabled={!previewUrl}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-surface-700 hover:bg-surface-600 disabled:opacity-30 text-slate-300 text-xs font-medium transition-colors border border-surface-600"
            >
              <Download size={14} />
              Download GIF
            </button>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="pt-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Result Preview</label>
              <img src={previewUrl} alt="GIF Preview" className="w-full rounded-lg border border-surface-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
