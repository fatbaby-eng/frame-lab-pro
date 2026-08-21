import { evalProp } from './types';
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
  const anySolo = comp.tracks.some(t => t.solo);
  const active = new Set<string>();

  for (const track of comp.tracks) {
    for (const clip of track.clips) {
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

  for (const asset of project.assets) {
    if (active.has(asset.id)) continue;
    if (asset.type !== 'audio' && asset.type !== 'video') continue;
    const el = getMediaElement(asset);
    if (el instanceof HTMLMediaElement && !el.paused && !playing) el.pause();
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

/** Mix audible clips into a MediaStream track for WebM export. */
export async function createExportAudioTrack(
  comp: Composition,
  project: Project,
  startTime: number,
  endTime: number
): Promise<MediaStreamTrack | null> {
  const anySolo = comp.tracks.some(t => t.solo);
  const jobs: { clip: Clip; track: Track; buffer: AudioBuffer }[] = [];

  for (const track of comp.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId) continue;
      if (clip.type !== 'audio' && clip.type !== 'video') continue;
      if (track.muted || (anySolo && !track.solo)) continue;
      if (clip.start + clip.duration <= startTime || clip.start >= endTime) continue;
      const asset = project.assets.find(a => a.id === clip.assetId);
      if (!asset) continue;
      const buffer = await decodeAudioAsset(asset);
      if (!buffer) continue;
      jobs.push({ clip, track, buffer });
    }
  }

  if (!jobs.length) return null;

  const ctx = audioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const dest = ctx.createMediaStreamDestination();
  const t0 = ctx.currentTime + 0.05;

  for (const { clip, track, buffer } of jobs) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const level = clipGain(clip, track, clip.start);
    gain.gain.value = level;
    source.connect(gain);
    gain.connect(dest);

    const clipStart = Math.max(clip.start, startTime);
    const clipEnd = Math.min(clip.start + clip.duration, endTime);
    const when = t0 + (clipStart - startTime);
    const offset = clip.sourceStart + (clipStart - clip.start);
    const dur = Math.max(0.01, clipEnd - clipStart);
    try {
      source.start(when, Math.max(0, offset), dur);
    } catch {
      // invalid offset
    }
  }

  return dest.stream.getAudioTracks()[0] ?? null;
}
