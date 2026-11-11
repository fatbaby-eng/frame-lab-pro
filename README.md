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

## Opening a project by link

`/framelab/?project=demos/song/song.flab.json` opens that project straight
into the editor, skipping the start screen. The path is relative to the page,
and media paths inside the project are relative to the project file, so a
demo folder can sit anywhere next to Frame Lab. A linked project is not
autosaved, so it never replaces a visitor's own work; Save downloads a copy.

## Shapes, reveal and replacing media

- Shape layers have Width, Height and Stroke as their own animatable
  properties, with fill (or none), stroke colour and round joins. Growing a
  shape by its size keeps the outline's weight; layer scale still scales
  everything. Types: rect, ellipse, triangle, star, sparkle, and Custom (any
  SVG path, fitted to the size).
- Reveal is a linear wipe on any visual layer: Reveal 0–100 %, Angle and
  Feather, all keyframeable.
- Replace (the arrows on an asset, or Media › Replace on a clip) swaps the
  file behind an asset. Every clip using it keeps its place, keyframes and
  effects; a clip that played the whole old file plays the whole new one.

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

