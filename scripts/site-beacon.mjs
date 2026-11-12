// Two things only the toddboswell.com copy carries; the GitHub Pages copy
// has neither file, so neither tag belongs in index.html itself.
//  - ../beacon.js: the site's analytics beacon.
//  - ./demos/samples.js: the site's sample projects for the start screen
//    (sets window.FrameLabSamples; see src/splash/StartScreen.tsx). The
//    demos/ folder lives in the site, not in this build, so copying
//    dist-site over framelab/ never touches it.
import { readFileSync, writeFileSync } from 'node:fs';
const p = new URL('../dist-site/index.html', import.meta.url);
let html = readFileSync(p, 'utf8');
if (!html.includes('beacon.js')) html = html.replace('</body>', '<script src="../beacon.js" defer></script>\n</body>');
if (!html.includes('demos/samples.js')) {
  const splash = '<script src="./bench-splash.js"></script>';
  if (!html.includes(splash)) throw new Error('site build: bench-splash tag not found in dist-site/index.html');
  html = html.replace(splash, '<script src="./demos/samples.js"></script>\n    ' + splash);
}
writeFileSync(p, html);
console.log('dist-site: beacon and samples tags present');
