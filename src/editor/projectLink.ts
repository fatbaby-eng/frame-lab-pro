// Opening a project by link: toddboswell.com/framelab/?project=demos/song/song.flab.json
import type { Project } from './types';

/** `?project=<url>` — a project file to open, given relative to this page. */
export function linkedProjectUrl(): string | null {
  if (typeof location === 'undefined') return null;
  const raw = new URLSearchParams(location.search).get('project');
  if (!raw) return null;
  try {
    const url = new URL(raw, location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Media paths in a linked project are relative to the project file, so a demo folder can live anywhere. */
export function resolveAssetUrls(project: Project, base: string): Project {
  for (const asset of project.assets || []) {
    const url = asset.url || '';
    if (!url || /^(data|blob):/i.test(url)) continue;
    try { asset.url = new URL(url, base).href; } catch { /* leave as written */ }
  }
  return project;
}
