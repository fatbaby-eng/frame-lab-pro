// The toddboswell.com copy carries the site's analytics beacon; the GitHub
// Pages copy does not (there is no ../beacon.js there).
import { readFileSync, writeFileSync } from 'node:fs';
const p = new URL('../dist-site/index.html', import.meta.url);
let html = readFileSync(p, 'utf8');
if (!html.includes('beacon.js')) html = html.replace('</body>', '<script src="../beacon.js" defer></script>\n</body>');
writeFileSync(p, html);
console.log('dist-site: beacon tag present');
