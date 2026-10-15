import { evalProp, nestedCompTime } from './types';
import type { Asset, Clip, Composition, Project, Track } from './types';
import { getMediaElement } from './mediaCache';

const PEAK_COUNT = 180;
const decodeCache = new Map<string, AudioBuffer>();
let decodeCtx: AudioContext | null = null;

function audioContext(): AudioContext {
  if (!decodeCtx || decodeCtx.state === 'closed') {
    decodeCtx = new AudioContext();
  }
  return decodeCtx;
}

export function clipIsAudible(clip: Clip, track: Track, time: number, anySolo: boolean): boolean {
  if (time < clip.start || time >= clip.start + clip.duration) return false;
  if (track.muted) return false;
  if (anySolo && !track.solo) return false;
  if (clip.type !== 'audio' && clip.type !== 'video') return false;
  return !!clip.assetId;
}

export function clipGain(clip: Clip, track: Track, time: number): number {
  const t = Math.max(0, time - clip.start);
  const opacity = evalProp(clip.transform.opacity, t);
  return Math.max(0, Math.min(1, track.volume * opacity));
}

/** Keep HTMLMediaElements in sync with the transport. */
export function syncTransportAudio(
  comp: Composition,
  project: Project,
  time: number,
  playing: boolean
) {
  const active = new Set<string>();
  syncCompAudio(comp, project, time, playing, active, new Set());

  for (const asset of project.assets) {
    if (active.has(asset.id)) continue;
    if (asset.type !== 'audio' && asset.type !== 'video') continue;
    const el = getMediaElement(asset);
    if (el instanceof HTMLMediaElement && !el.paused && !playing) el.pause();
  }
}

function syncCompAudio(
  comp: Composition,
  project: Project,
  time: number,
  playing: boolean,
  active: Set<string>,
  ancestors: Set<string>,
) {
  if (ancestors.has(comp.id)) return;
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(comp.id);
  const anySolo = comp.tracks.some(t => t.solo);

  for (const track of comp.tracks) {
    for (const clip of track.clips) {
      if (clip.type === 'comp' && clip.compositionId) {
        if (time < clip.start || time >= clip.start + clip.duration) continue;
        const inner = project.compositions.find(c => c.id === clip.compositionId);
        if (inner) {
          syncCompAudio(inner, project, nestedCompTime(clip, time), playing, active, nextAncestors);
        }
        continue;
      }
      if (!clip.assetId) continue;
      const asset = project.assets.find(a => a.id === clip.assetId);
      if (!asset || (asset.type !== 'audio' && asset.type !== 'video')) continue;

      const el = getMediaElement(asset);
      if (!(el instanceof HTMLMediaElement)) continue;

      const audible = clipIsAudible(clip, track, time, anySolo);
      const sourceTime = clip.sourceStart + Math.max(0, time - clip.start);
      const gain = audible ? clipGain(clip, track, time) : 0;

      el.volume = gain;
      el.muted = gain <= 0.001;

      if (!audible || !playing) {
        if (!el.paused) el.pause();
        if (!playing && Math.abs(el.currentTime - sourceTime) > 0.05 && Number.isFinite(sourceTime)) {
          try { el.currentTime = sourceTime; } catch { /* seek before metadata */ }
        }
        continue;
      }

      active.add(asset.id);
      if (Math.abs(el.currentTime - sourceTime) > 0.18 && Number.isFinite(sourceTime)) {
        try { el.currentTime = sourceTime; } catch { /* ignore */ }
      }
      if (el.paused) {
        void el.play().catch(() => { /* autoplay lock — next user gesture */ });
      }
    }
  }
}

export function stopTransportAudio(project: Project) {
  for (const asset of project.assets) {
    if (asset.type !== 'audio' && asset.type !== 'video') continue;
    const el = getMediaElement(asset);
    if (el instanceof HTMLMediaElement) el.pause();
  }
}

export async function decodeAudioAsset(asset: Asset): Promise<AudioBuffer | null> {
  if (decodeCache.has(asset.id)) return decodeCache.get(asset.id)!;
  if (!asset.url) return null;
  try {
    const ctx = audioContext();
    const res = await fetch(asset.url);
    const raw = await res.arrayBuffer();
    const buffer = await ctx.decodeAudioData(raw.slice(0));
    decodeCache.set(asset.id, buffer);
    return buffer;
  } catch {
    return null;
  }
}

export function peaksFromBuffer(buffer: AudioBuffer, count = PEAK_COUNT): number[] {
  const channel = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(channel.length / count));
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    let max = 0;
    const start = i * block;
    const end = Math.min(channel.length, start + block);
    for (let s = start; s < end; s++) {
      const v = Math.abs(channel[s]);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  return peaks;
}

export async function analyzeAudioAsset(asset: Asset): Promise<{ duration: number; peaks: number[] } | null> {
  const buffer = await decodeAudioAsset(asset);
  if (!buffer) return null;
  return { duration: buffer.duration, peaks: peaksFromBuffer(buffer) };
}

export interface ExportAudioMix {
  track: MediaStreamTrack;
  start: () => void;
  stop: () => void;
}

/** Mix audible clips into a MediaStream track for WebM export. */
export async function createExportAudioTrack(
  comp: Composition,
  project: Project,
  startTime: number,
  endTime: number
): Promise<ExportAudioMix | null> {
  const jobs: { clip: Clip; track: Track; rootStart: number; rootEnd: number }[] = [];

  const collect = (
    host: Composition,
    mapToRoot: (t: number) => number,
    ancestors: Set<string>,
  ) => {
    if (ancestors.has(host.id)) return;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(host.id);
    const anySolo = host.tracks.some(t => t.solo);
    for (const track of host.tracks) {
      for (const clip of track.clips) {
        const rootStart = mapToRoot(clip.start);
        const rootEnd = mapToRoot(clip.start + clip.duration);
        if (rootEnd <= startTime || rootStart >= endTime) continue;
        if (clip.type === 'comp' && clip.compositionId) {
          if (track.muted || (anySolo && !track.solo)) continue;
          const inner = project.compositions.find(c => c.id === clip.compositionId);
          if (inner) {
            collect(inner, t => mapToRoot(clip.start + (t - clip.sourceStart)), nextAncestors);
          }
          continue;
        }
        if (!clip.assetId) continue;
        if (clip.type !== 'audio' && clip.type !== 'video') continue;
        if (track.muted || (anySolo && !track.solo)) continue;
        jobs.push({ clip, track, rootStart, rootEnd });
      }
    }
  };
  collect(comp, t => t, new Set());

  const resolved: { clip: Clip; track: Track; buffer: AudioBuffer; rootStart: number; rootEnd: number }[] = [];
  for (const job of jobs) {
    if (!job.clip.assetId) continue;
    const asset = project.assets.find(a => a.id === job.clip.assetId);
    if (!asset) continue;
    const buffer = await decodeAudioAsset(asset);
    if (!buffer) continue;
    resolved.push({ ...job, buffer });
  }

  if (!resolved.length) return null;

  const ctx = audioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const dest = ctx.createMediaStreamDestination();
  const sources: AudioBufferSourceNode[] = [];

  const start = () => {
    const t0 = ctx.currentTime + 0.08;
    for (const { clip, track, buffer, rootStart, rootEnd } of resolved) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const level = clipGain(clip, track, clip.start);
      gain.gain.value = level;
      source.connect(gain);
      gain.connect(dest);

      const clipStart = Math.max(rootStart, startTime);
      const clipEnd = Math.min(rootEnd, endTime);
      const when = t0 + (clipStart - startTime);
      const offset = clip.sourceStart + (clipStart - rootStart);
      const dur = Math.max(0.01, clipEnd - clipStart);
      try {
        source.start(when, Math.max(0, offset), dur);
        sources.push(source);
      } catch {
        // invalid offset
      }
    }
  };

  const stop = () => {
    for (const source of sources) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    dest.stream.getTracks().forEach(t => t.stop());
  };

  const track = dest.stream.getAudioTracks()[0];
  if (!track) return null;
  return { track, start, stop };
}
