import { renderFrame } from './render';
import type { Composition, Project } from './types';
import { createExportAudioTrack } from './audioEngine';

export type ExportFormat = 'webm' | 'gif';

export interface ExportSettings {
  format: ExportFormat;
  quality: 'low' | 'medium' | 'high';
  startTime?: number;
  endTime?: number;
}

export interface ExportProgress {
  frame: number;
  totalFrames: number;
  time: number;
  status: 'idle' | 'rendering' | 'encoding' | 'done' | 'error';
  error?: string;
}

const QUALITY_BITRATES = {
  low: 2_000_000,    // 2 Mbps
  medium: 5_000_000, // 5 Mbps
  high: 10_000_000,  // 10 Mbps
};

/**
 * Export the composition to WebM video using MediaRecorder.
 * Renders frame-by-frame and captures via canvas.captureStream().
 */
export async function exportToWebM(
  comp: Composition,
  project: Project,
  assetCache: Map<string, HTMLImageElement | HTMLVideoElement>,
  settings: ExportSettings,
  onProgress: (p: ExportProgress) => void,
): Promise<Blob> {
  const startTime = settings.startTime ?? 0;
  const endTime = settings.endTime ?? comp.duration;
  const fps = comp.fps;
  const totalFrames = Math.ceil((endTime - startTime) * fps);
  const frameInterval = 1000 / fps;

  // Create export canvas
  const canvas = document.createElement('canvas');
  canvas.width = comp.width;
  canvas.height = comp.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const canvasStream = canvas.captureStream(fps);
  const audioTrack = await createExportAudioTrack(comp, project, startTime, endTime);
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioTrack ? [audioTrack] : []),
  ]);
  const bitrate = QUALITY_BITRATES[settings.quality];
  const options: MediaRecorderOptions = {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: bitrate,
  };

  // Fallback to vp8 if vp9 not supported
  if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
    options.mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }
  }

  const mediaRecorder = new MediaRecorder(stream, options);
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
    mediaRecorder.onerror = (e) => {
      reject(new Error(`MediaRecorder error: ${e}`));
    };

    mediaRecorder.start();

    let frame = 0;

    const renderNext = () => {
      if (frame >= totalFrames) {
        onProgress({ frame: totalFrames, totalFrames, time: endTime, status: 'encoding' });
        mediaRecorder.stop();
        return;
      }

      const time = startTime + frame / fps;

      void (async () => {
        await seekVideoAssets(time, comp, assetCache);
        renderFrame(ctx, time, comp, project, assetCache);
        onProgress({
          frame,
          totalFrames,
          time,
          status: 'rendering',
        });
        frame++;
        setTimeout(renderNext, frameInterval);
      })();
    };

    // Small delay to let MediaRecorder initialize
    setTimeout(renderNext, 100);
  });
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
  const startTime = settings.startTime ?? 0;
  const endTime = settings.endTime ?? comp.duration;
  const fps = Math.min(comp.fps, 15);
  const totalFrames = Math.ceil((endTime - startTime) * fps);

  const canvas = document.createElement('canvas');
  canvas.width = comp.width;
  canvas.height = comp.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const maxDim = 540;
  const outScale = Math.min(1, maxDim / Math.max(comp.width, comp.height));
  const gifW = Math.max(1, Math.round(comp.width * outScale));
  const gifH = Math.max(1, Math.round(comp.height * outScale));
  const out = document.createElement('canvas');
  out.width = gifW;
  out.height = gifH;
  const outCtx = out.getContext('2d', { alpha: false })!;

  const images: string[] = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = startTime + frame / fps;

    await seekVideoAssets(time, comp, assetCache);
    renderFrame(ctx, time, comp, project, assetCache);
    outCtx.drawImage(canvas, 0, 0, gifW, gifH);

    images.push(out.toDataURL('image/jpeg', 0.85));

    onProgress({
      frame,
      totalFrames,
      time,
      status: 'rendering',
    });

    // Yield to main thread every few frames
    if (frame % 5 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  onProgress({ frame: totalFrames, totalFrames, time: endTime, status: 'encoding' });

  const gifshot = await import('gifshot');

  return new Promise((resolve, reject) => {
    gifshot.default.createGIF({
      gifWidth: gifW,
      gifHeight: gifH,
      images,
      interval: 1 / fps,
      numFrames: totalFrames,
      frameDuration: 1,
      fontWeight: 'normal',
      fontSize: '16px',
      fontFamily: 'sans-serif',
      fontColor: '#ffffff',
      textAlign: 'center',
      textBaseline: 'bottom',
      sampleInterval: 10,
      numWorkers: 2,
    }, (obj: { error?: boolean; errorCode?: string; errorMsg?: string; image?: string }) => {
      if (obj.error) {
        reject(new Error(obj.errorMsg || 'GIF export failed'));
        return;
      }
      // Convert base64 data URL to blob
      fetch(obj.image!)
        .then(res => res.blob())
        .then(blob => resolve(blob))
        .catch(reject);
    });
  });
}

/** Seek all video assets to their correct time for a given composition time. */
async function seekVideoAssets(
  time: number,
  comp: Composition,
  assetCache: Map<string, HTMLImageElement | HTMLVideoElement>
) {
  const waits: Promise<void>[] = [];
  for (const track of comp.tracks) {
    if (!track.visible) continue;
    for (const clip of track.clips) {
      if (clip.type !== 'video' || !clip.assetId) continue;
      if (time < clip.start || time >= clip.start + clip.duration) continue;

      const video = assetCache.get(clip.assetId) as HTMLVideoElement | undefined;
      if (!video) continue;

      const clipTime = time - clip.start + clip.sourceStart;
      if (Math.abs(video.currentTime - clipTime) <= 0.05) continue;
      waits.push(new Promise(resolve => {
        const done = () => {
          video.removeEventListener('seeked', done);
          resolve();
        };
        video.addEventListener('seeked', done);
        video.currentTime = clipTime;
        window.setTimeout(done, 120);
      }));
    }
  }
  if (waits.length) await Promise.all(waits);
}

/** Trigger a file download. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
