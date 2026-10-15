# Frame Lab

Mr. Todd's motion tool. Layers on a timeline, keyframes with real easing and
a curve editor, per-layer effects, text and shapes, audio with waveforms,
nested compositions, and a little 3D. Renders to video or GIF in the
browser; a project saves as one `.flab.json` file. Nothing uploads.

Live at https://toddboswell.com/framelab/ (mirror:
https://fatbaby-eng.github.io/frame-lab-pro/).

## Develop

```bash
npm install
npm run dev          # Vite dev server
npm run build        # GitHub Pages build, base /frame-lab-pro/ -> dist/
npm run build:site   # toddboswell.com build, base /framelab/ -> dist-site/ (beacon injected)
```

React 19, TypeScript, Tailwind 4, Three.js via react-three-fiber.

## Start screen and Help

`public/bench-splash.js` is the first-open screen and Help panel shared
with the other tools on toddboswell.com; `src/splash/` wires it in and
holds the templates. Vector Studio can hand a drawing over with Send to
Frame Lab (same origin via `localStorage['framelab-handoff']`, otherwise
`postMessage`).

## License

GNU Affero General Public License v3 — see `LICENSE` and `NOTICE`. Free to
use, change and share, including at work. If you ship or host a modified
version, publish your changes under the same license and keep the author
credit intact (the copyright line, the NOTICE file, and the "Made by Todd
Boswell" line in the About panel). Rename your fork if you like; don't
remove the name.

