// Start-screen templates. Each builds a fresh Composition through the same
// factories the editor uses, so a template is never out of step with the
// clip shape. Keep these small: a head start, not a finished piece.
import {
  createEmptyComposition, createNewClip, defaultTextStyle, hydrateAnimatedProperty, makeAnimatedProperty,
  type Composition,
} from '../editor/types';

export interface StartTemplate {
  name: string;
  meta: string;
  thumb: string;          // a BenchSplash thumb key
  build: () => Composition;
}

function fadeIn(from = 0, to = 1, at = 0, over = 0.6) {
  return hydrateAnimatedProperty({
    keyframes: [
      { time: at, value: from, easing: 'ease-out' },
      { time: at + over, value: to, easing: 'linear' },
    ],
  });
}

function track(comp: Composition, type: string) {
  const t = comp.tracks.find(x => x.type === type);
  if (!t) throw new Error(`no ${type} track`);
  return t;
}

export const START_TEMPLATES: StartTemplate[] = [
  {
    name: 'Title card',
    meta: '1080p · 5 s · fade up',
    thumb: 'text',
    build: () => {
      const comp = createEmptyComposition({ name: 'Title card', duration: 5 });
      const text = track(comp, 'text');
      const title = createNewClip(text.id, 'text', 0, 5);
      title.name = 'Title';
      title.textContent = 'TITLE';
      title.textStyle = { ...defaultTextStyle(), fontSize: 120, bold: true, letterSpacing: 6, boxWidth: 1400 };
      // Visible at frame one so the template reads on arrival; the settle is
      // the motion, not a fade from nothing.
      title.transform.scaleX = hydrateAnimatedProperty({ keyframes: [{ time: 0, value: 0.92, easing: 'ease-out' }, { time: 0.9, value: 1, easing: 'linear' }] });
      title.transform.scaleY = hydrateAnimatedProperty({ keyframes: [{ time: 0, value: 0.92, easing: 'ease-out' }, { time: 0.9, value: 1, easing: 'linear' }] });
      title.transform.y = hydrateAnimatedProperty({ keyframes: [{ time: 0, value: 24, easing: 'ease-out' }, { time: 0.9, value: 0, easing: 'linear' }] });
      text.clips.push(title);
      const sub = createNewClip(text.id, 'text', 0.6, 4.4);
      sub.name = 'Subtitle';
      sub.textContent = 'a line underneath';
      sub.textStyle = { ...defaultTextStyle(), fontSize: 40, color: '#b8b3a8', boxWidth: 1400 };
      sub.transform.y = makeAnimatedProperty(110);
      sub.transform.opacity = fadeIn(0, 1, 0.6, 0.8);
      text.clips.push(sub);
      return comp;
    },
  },
  {
    name: 'Lower third',
    meta: '1080p · 8 s · slides in',
    thumb: 'lower',
    build: () => {
      const comp = createEmptyComposition({ name: 'Lower third', duration: 8 });
      comp.backgroundColor = '#101010';
      const shapes = track(comp, 'shape');
      const bar = createNewClip(shapes.id, 'shape', 0, 8);
      bar.name = 'Bar';
      bar.shapeType = 'rect';
      bar.shapeColor = '#c4a35a';
      bar.transform.x = hydrateAnimatedProperty({ keyframes: [{ time: 0, value: -1400, easing: 'ease-out' }, { time: 0.6, value: -420, easing: 'linear' }, { time: 7.2, value: -420, easing: 'ease-in' }, { time: 7.8, value: -1400, easing: 'linear' }] });
      bar.transform.y = makeAnimatedProperty(360);
      bar.transform.scaleX = makeAnimatedProperty(2.6);
      bar.transform.scaleY = makeAnimatedProperty(0.45);
      shapes.clips.push(bar);
      const text = track(comp, 'text');
      const name = createNewClip(text.id, 'text', 0.4, 7.2);
      name.name = 'Name';
      name.textContent = 'Name Here';
      name.textStyle = { ...defaultTextStyle(), fontSize: 56, bold: true, align: 'left', color: '#0a0a0a', boxWidth: 900 };
      name.transform.x = makeAnimatedProperty(-420);
      name.transform.y = makeAnimatedProperty(338);
      name.transform.opacity = fadeIn(0, 1, 0.6, 0.4);
      text.clips.push(name);
      const role = createNewClip(text.id, 'text', 0.6, 7.0);
      role.name = 'Role';
      role.textContent = 'what they do';
      role.textStyle = { ...defaultTextStyle(), fontSize: 30, align: 'left', color: '#3d2b1f', boxWidth: 900 };
      role.transform.x = makeAnimatedProperty(-420);
      role.transform.y = makeAnimatedProperty(392);
      role.transform.opacity = fadeIn(0, 1, 0.8, 0.4);
      text.clips.push(role);
      return comp;
    },
  },
  {
    name: 'Logo sting',
    meta: 'Square · 3 s · pop + settle',
    thumb: 'circle',
    build: () => {
      const comp = createEmptyComposition({ name: 'Logo sting', width: 1080, height: 1080, duration: 3 });
      const shapes = track(comp, 'shape');
      const disc = createNewClip(shapes.id, 'shape', 0, 3);
      disc.name = 'Disc';
      disc.shapeType = 'circle';
      disc.shapeColor = '#c4a35a';
      disc.transform.scaleX = hydrateAnimatedProperty({ keyframes: [{ time: 0, value: 0, easing: 'ease-out' }, { time: 0.5, value: 1.15, easing: 'ease-in-out' }, { time: 0.8, value: 1, easing: 'linear' }] });
      disc.transform.scaleY = hydrateAnimatedProperty({ keyframes: [{ time: 0, value: 0, easing: 'ease-out' }, { time: 0.5, value: 1.15, easing: 'ease-in-out' }, { time: 0.8, value: 1, easing: 'linear' }] });
      shapes.clips.push(disc);
      const text = track(comp, 'text');
      const mark = createNewClip(text.id, 'text', 0.5, 2.5);
      mark.name = 'Mark';
      mark.textContent = 'LOGO';
      mark.textStyle = { ...defaultTextStyle(), fontSize: 140, bold: true, color: '#0a0a0a', letterSpacing: 8, boxWidth: 900 };
      mark.transform.opacity = fadeIn(0, 1, 0.5, 0.4);
      text.clips.push(mark);
      return comp;
    },
  },
  {
    name: 'Loop',
    meta: 'Portrait · 4 s · seamless drift',
    thumb: 'loop',
    build: () => {
      const comp = createEmptyComposition({ name: 'Loop', width: 1080, height: 1920, duration: 4 });
      comp.backgroundColor = '#0f0518';
      const shapes = track(comp, 'shape');
      const colors = ['#ff00a0', '#c4a35a', '#6366f1'];
      colors.forEach((color, i) => {
        const orb = createNewClip(shapes.id, 'shape', 0, 4);
        orb.name = `Orb ${i + 1}`;
        orb.shapeType = 'circle';
        orb.shapeColor = color;
        orb.transform.scaleX = makeAnimatedProperty(0.9 - i * 0.2);
        orb.transform.scaleY = makeAnimatedProperty(0.9 - i * 0.2);
        orb.transform.opacity = makeAnimatedProperty(0.7);
        orb.transform.x = makeAnimatedProperty((i - 1) * 220);
        // Start and end on the same value so the loop closes cleanly.
        orb.transform.y = hydrateAnimatedProperty({ keyframes: [
          { time: 0, value: -300 + i * 300, easing: 'ease-in-out' },
          { time: 2, value: -300 + i * 300 + 240, easing: 'ease-in-out' },
          { time: 4, value: -300 + i * 300, easing: 'linear' },
        ] });
        shapes.clips.push(orb);
      });
      return comp;
    },
  },
];
