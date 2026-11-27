// Coda: one question (add up over a shape), five shapes, one theorem
// (inside ↔ boundary). The figure crossfades between interval, curve, region, surface and solid.
import type gsap from 'gsap';
import { Plot2D } from '../engine/plot';
import type { Scene } from '../engine/stage';

type P = [number, number];
const TAU = Math.PI * 2;
const NAMES = ['two endpoints', 'two endpoints', 'a closed curve', 'a closed curve', 'a closed surface'];
const THEOREMS = ['Fundamental theorem', 'Line-integral theorem', 'Green’s theorem', 'Stokes’ theorem', 'Divergence theorem'];

export default function mount(s: Scene) {
  const plot = new Plot2D(s, { x: [-4.4, 4.4], y: [-2.9, 2.9], aspect: 'equal', axes: false, grid: false });
  const st = { k: 0, glow: 0, inside: 1, t: 0, appear: s.reduced ? 1 : 0 };
  const shapeSeg = s.segmented('shape', v => go(Number(v)));
  const boundary = s.readout('boundary');
  let playing = false;
  const playBtn = s.action('play', () => togglePlay());

  const curve = (t: number): P => [-3 + 6 * t, 0.9 * Math.sin(t * 5.2 - .6) * (0.4 + t * .6) - .2];
  const blob = (a: number, r = 1): P => {
    const rr = 2 * r * (1 + .16 * Math.sin(3 * a + .5) + .08 * Math.cos(5 * a));
    return [Math.cos(a) * rr * 1.25, Math.sin(a) * rr * .92];
  };

  function drawShape(i: number, alpha: number, time: number) {
    if (alpha < .01) return;
    const g = plot;
    const pulse = .55 + .45 * Math.sin(time * 3);
    const bw = 3 + st.glow * 2.5 * pulse;
    const ba = Math.min(1, .55 + st.glow * .45);
    const tick = (x: number, y: number, dx: number, dy: number, color: 'c1' | 'c2', len = .32) => {
      const n = Math.hypot(dx, dy) || 1;
      g.arrow(x, y, x + dx / n * len, y + dy / n * len, { color, width: 1.6, head: 7, alpha });
    };
    if (i === 0) {
      g.line(-3, 0, 3, 0, { color: 'c3', width: 6, alpha });
      for (let k = 0; k < 9; k++) { const x = -2.6 + k * .65; tick(x, .45, .4, .22 * Math.cos(k), 'c1'); }
      g.point(-3, 0, { color: 'c2', r: 7 + st.glow * 3 * pulse, alpha: alpha * ba });
      g.point(3, 0, { color: 'c2', r: 7 + st.glow * 3 * pulse, alpha: alpha * ba });
      g.text('a', -3, 0, { offset: [0, 24], align: 'center', font: 'serif', size: 18, color: 'c2', alpha });
      g.text('b', 3, 0, { offset: [0, 24], align: 'center', font: 'serif', size: 18, color: 'c2', alpha });
      g.text('−', -3, 0, { offset: [0, -24], align: 'center', size: 18, color: 'c2', alpha: alpha * st.glow });
      g.text('+', 3, 0, { offset: [0, -24], align: 'center', size: 18, color: 'c2', alpha: alpha * st.glow });
    }
    if (i === 1) {
      g.param(t => curve(t)[0], t => curve(t)[1], 0, 1, { color: 'c3', width: 5, alpha });
      for (let k = 1; k < 10; k++) {
        const t = k / 10, [x, y] = curve(t), [x2, y2] = curve(t + 1e-3);
        const nx = -(y2 - y), ny = x2 - x, n = Math.hypot(nx, ny);
        tick(x + nx / n * .38, y + ny / n * .38, x2 - x, y2 - y, 'c1');
      }
      const A = curve(0), B = curve(1);
      g.point(A[0], A[1], { color: 'c2', r: 7 + st.glow * 3 * pulse, alpha: alpha * ba });
      g.point(B[0], B[1], { color: 'c2', r: 7 + st.glow * 3 * pulse, alpha: alpha * ba });
      g.text('A', A[0], A[1], { offset: [-16, 0], align: 'right', size: 16, weight: 600, color: 'c2', alpha });
      g.text('B', B[0], B[1], { offset: [16, 0], size: 16, weight: 600, color: 'c2', alpha });
    }
    if (i === 2) {
      const pts: P[] = Array.from({ length: 121 }, (_, k) => blob(k / 120 * TAU));
      g.poly(pts, { color: 'c3', alpha: .22 * alpha });
      g.poly(pts, { fill: false, stroke: 'c2', strokeWidth: bw, strokeAlpha: alpha * ba });
      swirls(alpha, time, [[-1.3, .55], [0, .75], [1.3, .55], [-1.4, -.65], [0, -.45], [1.4, -.65]]);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + .3, [x, y] = blob(a), [x2, y2] = blob(a + .01); tick(x, y, x2 - x, y2 - y, 'c2', .42); }
    }
    if (i === 3) {
      // A dome seen from the side: cap over an elliptical rim.
      const rimY = -1.1, rx = 2.6, ry = .7, h = 2.5;
      const top: P[] = Array.from({ length: 81 }, (_, k) => { const a = Math.PI * k / 80; return [-Math.cos(a) * rx, rimY + Math.sin(a) * h]; });
      const front: P[] = Array.from({ length: 81 }, (_, k) => { const a = Math.PI * k / 80; return [Math.cos(a) * rx, rimY - Math.sin(a) * ry]; });
      g.poly([...top, ...front], { color: 'c3', alpha: .24 * alpha });
      for (let m = 1; m < 5; m++) { // meridians and parallels for the curved look
        const lat = m / 5;
        g.param(a => Math.cos(a) * rx * Math.sqrt(1 - lat * lat), a => rimY + lat * h - Math.sin(a) * ry * Math.sqrt(1 - lat * lat), 0, Math.PI, { color: 'c3', width: 1, alpha: .45 * alpha });
      }
      swirls(alpha, time, [[-1.25, rimY + 1.55], [0, rimY + 1.95], [1.25, rimY + 1.55], [-.62, rimY + .75], [.62, rimY + .75]]);
      g.param(a => Math.cos(a) * rx, a => rimY - Math.sin(a) * ry, 0, TAU, { color: 'c2', width: bw, alpha: alpha * ba });
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + .6; tick(Math.cos(a) * rx, rimY - Math.sin(a) * ry, -Math.sin(a), -Math.cos(a) * ry / rx, 'c2', .42); }
    }
    if (i === 4) {
      const R = 2.2;
      g.circle(0, 0, R, { fill: true, color: 'c3', alpha: .2 * alpha, stroke: 'c2', strokeAlpha: alpha * ba, width: bw });
      g.param(a => Math.cos(a) * R, a => Math.sin(a) * R * .28, 0, Math.PI, { color: 'c3', width: 1.2, alpha: .5 * alpha, dash: [4, 5] });
      g.param(a => Math.cos(a) * R, a => -Math.sin(a) * R * .28, 0, Math.PI, { color: 'c3', width: 1.2, alpha: .7 * alpha });
      // Sources inside (divergence) and flux arrows out through the boundary.
      for (let k = 0; k < 7; k++) {
        const a = k * 2.399, r = R * .62 * Math.sqrt((k + .5) / 7), x = Math.cos(a) * r, y = Math.sin(a) * r;
        const breathe = .14 + .1 * (s.reduced ? 1 : .5 + .5 * Math.sin(time * 2.4 + k));
        g.circle(x, y, breathe, { fill: true, color: 'c1', alpha: .5 * alpha * st.inside, stroke: 'c1', strokeAlpha: alpha * st.inside, width: 1 });
      }
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + .2; tick(Math.cos(a) * R, Math.sin(a) * R, Math.cos(a), Math.sin(a), 'c2', .55); }
    }
    g.textPx(THEOREMS[i], g.width / 2, g.height - 26, { align: 'center', size: 13, font: 'mono', color: st.glow > .5 ? 'c2' : 'muted', alpha: alpha * (.4 + .6 * st.glow) });
  }

  // Little circulation cells: what Green and Stokes add up inside.
  function swirls(alpha: number, time: number, centers: P[]) {
    const spin = s.reduced ? 0 : time * 1.6;
    for (const [cx, cy] of centers) {
      const r = .24;
      plot.param(a => cx + Math.cos(a + spin) * r, a => cy + Math.sin(a + spin) * r * .8, 0, TAU * .78, { color: 'c1', width: 1.6, alpha: alpha * st.inside * .9, samples: 40 });
      const a = spin + TAU * .78;
      const hx = cx + Math.cos(a) * r, hy = cy + Math.sin(a) * r * .8;
      plot.arrow(hx, hy, hx - Math.sin(a) * .07, hy + Math.cos(a) * .056, { color: 'c1', head: 6, alpha: alpha * st.inside * .9 });
    }
  }

  let time = 0;
  plot.render = () => {
    const i = Math.floor(st.k), f = st.k - i;
    plot.ctx.globalAlpha = st.appear;
    drawShape(i, 1 - f, time);
    if (f > 0) drawShape(Math.min(4, i + 1), f, time);
    plot.ctx.globalAlpha = 1;
  };
  s.frame((t) => { time = t; if (!s.reduced) plot.invalidate(); });

  function go(i: number, duration = .9) {
    boundary(NAMES[i]);
    setPressed(i);
    s.tween(st, { k: i, duration, ease: 'power2.inOut', overwrite: 'auto', onUpdate: () => plot.invalidate() });
  }
  function setPressed(i: number) {
    s.root.querySelectorAll<HTMLButtonElement>('[data-seg="shape"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === String(i))));
  }
  let playTl: gsap.core.Timeline | undefined;
  function togglePlay(force?: boolean) {
    playing = force ?? !playing;
    playBtn?.setAttribute('aria-pressed', String(playing));
    playTl?.kill();
    if (!playing) return;
    if (s.reduced) { go(4, 0); playing = false; playBtn?.setAttribute('aria-pressed', 'false'); return; }
    playTl = s.timeline({ repeat: -1 });
    for (let k = 0; k < 5; k++) playTl.call(() => go(k), [], k * 2.2);
    playTl.call(() => {}, [], 11);
  }
  s.cleanup(() => playTl?.kill());

  s.onBeat(i => {
    if (i < 5) { togglePlay(false); s.tween(st, { glow: 0, duration: .5, onUpdate: () => plot.invalidate() }); go(i); }
    else { s.tween(st, { glow: 1, duration: .8, onUpdate: () => plot.invalidate() }); togglePlay(!s.reduced); }
  });
  s.onEnter(() => s.tween(st, { appear: 1, duration: 1, onUpdate: () => plot.invalidate() }));
  boundary(NAMES[0]);
}
