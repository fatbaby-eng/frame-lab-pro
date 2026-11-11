// Swap the file behind an asset (a re-recorded vocal, a new cut of a video,
// a revised image) while every clip that uses it keeps its place, timing,
// keyframes and effects.
import type { Asset } from './types';
import { analyzeAudioAsset } from './audioEngine';

const ACCEPT: Partial<Record<Asset['type'], string>> = {
  audio: 'audio/*',
  video: 'video/*',
  image: 'image/*',
};

export function canReplace(asset: Asset | undefined): asset is Asset {
  return !!asset && asset.type in ACCEPT;
}

/** Read what the editor needs to know about a new file for this asset. */
export async function probeReplacement(asset: Asset, file: File): Promise<Partial<Asset>> {
  const url = URL.createObjectURL(file);
  const patch: Partial<Asset> = { url, name: file.name };
  if (asset.type === 'audio') {
    const info = await analyzeAudioAsset({ ...asset, url });
    if (!info) {
      URL.revokeObjectURL(url);
      throw new Error('That file could not be read as audio');
    }
    patch.duration = info.duration;
    patch.peaks = info.peaks;
  } else if (asset.type === 'video') {
    await new Promise<void>((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        patch.duration = v.duration;
        patch.width = v.videoWidth;
        patch.height = v.videoHeight;
        resolve();
      };
      v.onerror = () => reject(new Error('That file could not be read as video'));
      v.src = url;
    });
  } else if (asset.type === 'image') {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        patch.width = img.naturalWidth;
        patch.height = img.naturalHeight;
        resolve();
      };
      img.onerror = () => reject(new Error('That file could not be read as an image'));
      img.src = url;
    });
  }
  return patch;
}

/** Ask for a file, then hand the asset patch to `apply`. */
export function pickReplacement(
  asset: Asset,
  apply: (patch: Partial<Asset>) => void,
  toast: (msg: string) => void,
) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT[asset.type] ?? '';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    void probeReplacement(asset, file)
      .then(patch => {
        apply(patch);
        toast(`Replaced with ${file.name}`);
      })
      .catch((e: Error) => toast(e.message || 'Could not use that file'));
  };
  input.click();
}
