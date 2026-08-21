import type { Asset } from './types';

const cache = new Map<string, HTMLImageElement | HTMLVideoElement | HTMLAudioElement>();

export function getMediaElement(asset: Asset): HTMLImageElement | HTMLVideoElement | HTMLAudioElement {
  const existing = cache.get(asset.id);
  if (existing) {
    if (existing.src !== asset.url && asset.url) existing.src = asset.url;
    return existing;
  }

  if (asset.type === 'video') {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.playsInline = true;
    video.src = asset.url;
    cache.set(asset.id, video);
    return video;
  }

  if (asset.type === 'audio') {
    const audio = document.createElement('audio');
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.src = asset.url;
    cache.set(asset.id, audio);
    return audio;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = asset.url;
  cache.set(asset.id, img);
  return img;
}

export function mediaCacheMap(assets: Asset[]): Map<string, HTMLImageElement | HTMLVideoElement> {
  const map = new Map<string, HTMLImageElement | HTMLVideoElement>();
  for (const asset of assets) {
    if (asset.type === 'audio') continue;
    const el = getMediaElement(asset);
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) {
      map.set(asset.id, el);
    }
  }
  return map;
}

export function evictMedia(assetId: string) {
  const el = cache.get(assetId);
  if (el && 'pause' in el) el.pause();
  cache.delete(assetId);
}
