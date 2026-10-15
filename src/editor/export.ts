import { forEachClipAtTime, renderFrame } from './render';
import type { Composition, Project } from './types';
import { createExportAudioTrack } from './audioEngine';

export type ExportFormat = 'webm' | 'gif';

export interface ExportSettings {
  format: ExportFormat;
  quality: 'low' | 'medium' | 'high';
  startTime?: number;
  endTime?: number;
  signal?: AbortSignal;
}

export interface ExportProgress {
  frame: number;
  totalFrames: number;
  time: number;
  status: 'idle' | 'rendering' | 'encoding' | 'done' | 'error';
  error?: string;
}

const QUALITY_BITRATES = {
  low: 2_000_000,
  medium: 5_000_000,
  high: 10_000_000,
};

const WEBM_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Export cancelled', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Export cancelled', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function requestCanvasFrame(track: MediaStreamTrack) {
  const capture = track as MediaStreamTrack & { requestFrame?: () => void };
  capture.requestFrame?.();
}

function pickWebmMime(): string {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot record video. Try GIF export instead.');
  }
  const mime = WEBM_MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type));
  if (!mime) {
    throw new Error('WebM is not supported in this browser. Export as GIF instead.');
  }
  return mime;
}

function makeRecorder(stream: MediaStream, bitrate: number, mimeType: string): MediaRecorder {
  try {
    return new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrate,
      audioBitsPerSecond: 128_000,
    });
  } catch {
    return new MediaRecorder(stream, { mimeType });
  }
}

function mountExportCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    canvas.remove();
    throw new Error('Could not create an export canvas.');
  }
  return { canvas, ctx };
}

async function loadGifshotCreate() {
  const mod = await import('gifshot') as {
    createGIF?: (options: Record<string, unknown>, cb: (obj: { error?: boolean; errorMsg?: string; image?: string }) => void) => void;
    default?: {
      createGIF?: (options: Record<string, unknown>, cb: (obj: { error?: boolean; errorMsg?: string; image?: string }) => void) => void;
    };
  };
  const create = mod.createGIF ?? mod.default?.createGIF;
  if (!create) throw new Error('GIF encoder failed to load.');
  return create;
}

/**
 * Export the composition to WebM video using MediaRecorder.
 * Draws one canvas frame at a time and pushes it into the recorder.
 */
export async function exportToWebM(
  comp: Composition,
  project: Project,
  assetCache: Map<string, HTMLImageElement | HTMLVideoElement>,
  settings: ExportSettings,
  onProgress: (p: ExportProgress) => void,
): Promise<Blob> {
  throwIfAborted(settings.signal);
  const startTime = settings.startTime ?? 0;
  const endTime = Math.max(startTime + 1 / Math.max(comp.fps, 1), settings.endTime ?? comp.duration);
  const fps = Math.max(1, comp.fps);
  const totalFrames = Math.max(1, Math.ceil((endTime - startTime) * fps));
  const bitrate = QUALITY_BITRATES[settings.quality];
  const mimeType = pickWebmMime();

  const { canvas, ctx } = mountExportCanvas(comp.width, comp.height);
  const audioMix = await createExportAudioTrack(comp, project, startTime, endTime);
  const probeCanvas = document.createElement('canvas');
  probeCanvas.width = 2;
  probeCanvas.height = 2;
  const probeTrack = probeCanvas.captureStream(0).getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const manualFrames = typeof probeTrack?.requestFrame === 'function';
  probeTrack?.stop();
  const canvasStream = canvas.captureStream(manualFrames ? 0 : fps);
  const videoTrack = canvasStream.getVideoTracks()[0];
  if (!videoTrack) {
    canvas.remove();
    throw new Error('Could not capture the export canvas.');
  }

  const stream = new MediaStream([
    videoTrack,
    ...(audioMix ? [audioMix.track] : []),
  ]);
  const mediaRecorder = makeRecorder(stream, bitrate, mimeType);
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  try {
    const stopped = new Promise<void>((resolve, reject) => {
      mediaRecorder.onstop = () => resolve();
      mediaRecorder.onerror = () => reject(new Error('Video recording failed.'));
    });

    mediaRecorder.start(100);
    if (mediaRecorder.state !== 'recording') {
      throw new Error('Could not start the video recorder.');
    }

    await seekVideoAssets(startTime, comp, project, assetCache);
    renderFrame(ctx, startTime, comp, project, assetCache);
    requestCanvasFrame(videoTrack);
    await sleep(80, settings.signal);
    audioMix?.start();

    // MediaRecorder stamps frames by the wall clock, so the frames have to be
    // handed over in real time: pushing 150 frames in 400 ms makes a
    // 400 ms clip with most of the frames dropped (or no file at all).
    const t0 = performance.now();

    for (let frame = 0; frame < totalFrames; frame++) {
      throwIfAborted(settings.signal);
      const wait = t0 + (frame / fps) * 1000 - performance.now();
      if (wait > 1) await sleep(wait, settings.signal);
      else if (frame % 8 === 0) await sleep(0, settings.signal);

      const time = startTime + frame / fps;
      await seekVideoAssets(time, comp, project, assetCache);
      renderFrame(ctx, time, comp, project, assetCache);
      requestCanvasFrame(videoTrack);
      onProgress({ frame: frame + 1, totalFrames, time, status: 'rendering' });
    }

    onProgress({ frame: totalFrames, totalFrames, time: endTime, status: 'encoding' });
    await sleep(Math.max(120, 2000 / fps), settings.signal);
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.requestData();
      mediaRecorder.stop();
    }
    await stopped;

    const blob = new Blob(chunks, { type: mimeType.startsWith('video/webm') ? 'video/webm' : mimeType });
    if (blob.size < 64) {
      throw new Error('Export produced an empty file. Try GIF, or use a shorter work area.');
    }
    return blob;
  } finally {
    if (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused') {
      try { mediaRecorder.stop(); } catch { /* already stopping */ }
    }
    audioMix?.stop();
    stream.getTracks().forEach(track => track.stop());
    canvas.remove();
  }
}

/**
 * Export to GIF using gifshot.
 * Captures frames as images then encodes to GIF.
 */
export async function exportToGIF(
  comp: Composition,
  project: Project,
  assetCache: Map<string, HTMLImageElement | HTMLVideoElement>,
  settings: ExportSettings,
  onProgress: (p: ExportProgress) => void,
): Promise<Blob> {
  throwIfAborted(settings.signal);
  const startTime = settings.startTime ?? 0;
  const endTime = Math.max(startTime + 1 / 15, settings.endTime ?? comp.duration);
  const fps = Math.min(Math.max(comp.fps, 1), 12);
  const totalFrames = Math.max(1, Math.ceil((endTime - startTime) * fps));

  const { canvas, ctx } = mountExportCanvas(comp.width, comp.height);
  const maxDim = 480;
  const outScale = Math.min(1, maxDim / Math.max(comp.width, comp.height));
  const gifW = Math.max(1, Math.round(comp.width * outScale));
  const gifH = Math.max(1, Math.round(comp.height * outScale));
  const out = document.createElement('canvas');
  out.width = gifW;
  out.height = gifH;
  const outCtx = out.getContext('2d', { alpha: false });
  if (!outCtx) {
    canvas.remove();
    throw new Error('Could not create a GIF canvas.');
  }

  const images: string[] = [];
  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      throwIfAborted(settings.signal);
      const time = startTime + frame / fps;
      await seekVideoAssets(time, comp, project, assetCache);
      renderFrame(ctx, time, comp, project, assetCache);
      outCtx.drawImage(canvas, 0, 0, gifW, gifH);
      images.push(out.toDataURL('image/jpeg', 0.82));
      onProgress({ frame: frame + 1, totalFrames, time, status: 'rendering' });
      if (frame % 4 === 0) await sleep(0, settings.signal);
    }

    onProgress({ frame: totalFrames, totalFrames, time: endTime, status: 'encoding' });
    const createGIF = await loadGifshotCreate();

    return await new Promise<Blob>((resolve, reject) => {
      const onAbort = () => reject(new DOMException('Export cancelled', 'AbortError'));
      settings.signal?.addEventListener('abort', onAbort, { once: true });
      createGIF({
        gifWidth: gifW,
        gifHeight: gifH,
        images,
        interval: 1 / fps,
        numFrames: images.length,
        frameDuration: 1,
        sampleInterval: 12,
        numWorkers: 2,
        progressCallback: (captureProgress: number) => {
          onProgress({
            frame: totalFrames,
            totalFrames,
            time: endTime,
            status: 'encoding',
            error: undefined,
          });
          void captureProgress;
        },
      }, obj => {
        settings.signal?.removeEventListener('abort', onAbort);
        if (obj.error || !obj.image) {
          reject(new Error(obj.errorMsg || 'GIF export failed'));
          return;
        }
        fetch(obj.image)
          .then(res => res.blob())
          .then(blob => {
            if (blob.size < 32) throw new Error('GIF export produced an empty file.');
            resolve(blob);
          })
          .catch(reject);
      });
    });
  } finally {
    canvas.remove();
  }
}

/** Seek all video assets to their correct time for a given composition time. */
async function seekVideoAssets(
  time: number,
  comp: Composition,
  project: Project,
  assetCache: Map<string, HTMLImageElement | HTMLVideoElement>
) {
  const waits: Promise<void>[] = [];
  forEachClipAtTime(comp, time, project, (clip, hostTime) => {
    if (clip.type !== 'video' || !clip.assetId) return;
    const video = assetCache.get(clip.assetId) as HTMLVideoElement | undefined;
    if (!video) return;
    const clipTime = Math.max(0, hostTime - clip.start + clip.sourceStart);
    if (Math.abs(video.currentTime - clipTime) <= 0.04) return;
    waits.push(new Promise(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('seeked', done);
        resolve();
      };
      video.addEventListener('seeked', done);
      try {
        video.currentTime = clipTime;
      } catch {
        done();
        return;
      }
      window.setTimeout(done, 160);
    }));
  });
  if (waits.length) await Promise.all(waits);
}

/** Trigger a file download. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
