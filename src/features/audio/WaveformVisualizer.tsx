import { useRef, useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Play,
  Pause,
  Upload,
  Volume2,
  VolumeX,
  Activity,
} from 'lucide-react';

export default function WaveformVisualizer() {
  const { state, showToast, setPendingDrop } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [volume, setVolume] = useState(0.7);
  const [mode, setMode] = useState<'waveform' | 'spectrum'>('waveform');
  const [color, setColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(2);
  const [smoothing, setSmoothing] = useState(0.8);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Handle dropped files from global drag-and-drop
  useEffect(() => {
    if (!state.pendingDrop) return;
    const audioFiles = state.pendingDrop.filter(f => f.type === 'audio');
    if (audioFiles.length > 0) {
      const file = audioFiles[0].file;
      loadAudioFile(file);
    }
    setPendingDrop(null);
  }, [state.pendingDrop, setPendingDrop]);

  const loadAudioFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setFileName(file.name);

    const audio = audioRef.current;
    if (!audio) return;

    audio.src = url;
    audio.load();

    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = smoothing;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    analyserRef.current = analyser;
    showToast(`Loaded: ${file.name}`);

    // Start drawing
    if (animRef.current) cancelAnimationFrame(animRef.current);
    drawWaveform();
  };

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      if (mode === 'waveform') {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.beginPath();

        const sliceWidth = w / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }

        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Draw center line
        ctx.strokeStyle = color + '33';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      } else {
        // Spectrum mode
        analyser.getByteFrequencyData(dataArray);
        const barCount = 128;
        const barWidth = (w / barCount) - 1;

        for (let i = 0; i < barCount; i++) {
          const barHeight = (dataArray[i] / 255) * h * 0.9;
          const x = i * (barWidth + 1);
          const y = h - barHeight;

          const gradient = ctx.createLinearGradient(0, h, 0, y);
          gradient.addColorStop(0, color + '00');
          gradient.addColorStop(1, color);
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, barWidth, barHeight);

          // Top cap
          ctx.fillStyle = color;
          ctx.fillRect(x, y, barWidth, 2);
        }
      }
    };

    draw();
  }, [mode, color, lineWidth]);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
    };
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadAudioFile(file);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) {
      showToast('Please upload an audio file first');
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-full">
      {/* Canvas Area */}
      <div className="flex-1 flex flex-col bg-surface-900">
        <div className="flex-1 relative p-4">
          <canvas
            ref={canvasRef}
            width={1200}
            height={500}
            className="w-full h-full rounded-xl border border-surface-600 bg-surface-800"
          />
          {!fileName && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <Activity size={48} className="mb-3 opacity-30" />
              <p className="text-sm">Upload or drop an audio file to visualize</p>
            </div>
          )}
        </div>

        {/* Transport controls */}
        <div className="h-16 bg-surface-800 border-t border-surface-600 flex items-center px-6 gap-4">
          <button
            onClick={togglePlay}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-accent/20 text-accent-light'
                : 'bg-accent text-white hover:bg-accent-dark'
            }`}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>{formatTime(currentTime)}</span>
              <span>{fileName || 'No file loaded'}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {volume === 0 ? <VolumeX size={16} className="text-slate-400" /> : <Volume2 size={16} className="text-slate-400" />}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-20 accent-accent"
            />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-64 bg-surface-800 border-l border-surface-600 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-surface-600">
          <h2 className="text-sm font-semibold text-white mb-1">Audio Lab</h2>
          <p className="text-xs text-slate-400">Waveform & spectrum analyzer</p>
        </div>

        <div className="p-4 space-y-5">
          {/* File upload */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Source</label>
            <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg bg-surface-700 hover:bg-surface-600 border border-surface-600 border-dashed text-xs text-slate-300 cursor-pointer transition-colors">
              <Upload size={14} />
              {fileName ? 'Change File' : 'Upload Audio'}
              <input type="file" accept="audio/*" onChange={handleFile} className="hidden" />
            </label>
            {fileName && (
              <p className="mt-1.5 text-[10px] text-slate-500 truncate">{fileName}</p>
            )}
          </div>

          {/* Mode */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Visualization Mode</label>
            <div className="flex gap-1 bg-surface-700 rounded-lg p-1">
              <button
                onClick={() => setMode('waveform')}
                className={`flex-1 py-1.5 text-[10px] rounded-md transition-all ${
                  mode === 'waveform' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Waveform
              </button>
              <button
                onClick={() => setMode('spectrum')}
                className={`flex-1 py-1.5 text-[10px] rounded-md transition-all ${
                  mode === 'spectrum' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Spectrum
              </button>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Wave Color</label>
            <div className="flex gap-2 flex-wrap">
              {['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#ffffff'].map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Line width */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Line Width</label>
              <span className="text-xs text-slate-300">{lineWidth}px</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={lineWidth}
              onChange={e => setLineWidth(parseInt(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          {/* Smoothing */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Smoothing</label>
              <span className="text-xs text-slate-300">{smoothing.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.95}
              step={0.05}
              value={smoothing}
              onChange={e => setSmoothing(parseFloat(e.target.value))}
              className="w-full accent-accent"
            />
          </div>
        </div>
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
