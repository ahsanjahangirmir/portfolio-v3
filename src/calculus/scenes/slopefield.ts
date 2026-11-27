// Scene: slope fields, solution curves (RK4) and Euler's method.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Pt = [number, number];
type Mode = 'growth' | 'cooling' | 'logistic' | 'separable' | 'linear';
type Spec = {
  F: (x: number, y: number) => number;
  view: { x0: number; x1: number; y0: number; y1: number };
  ic: Pt; xEnd: number; axes: [string, string];
  /** Optional landmarks on the default solution, from the worked example. */
  marks?: { x: number; label: string }[];
  family: Pt[]; equilibria?: number[];
  /** x must stay above this (the separable field is undefined at x = 0). */
  xMin?: number;
  digits: number;
};

const K_GROW = Math.log(16) / 3; // 50·e^{kt}, P(3) = 800
const K_COOL = Math.log(2 / 3) / 25; // T(25) = 10 in a 20° room, T(0) = 5
const MODES: Record<Mode, Spec> = {
  growth: {
    F: (_, y) => K_GROW * y, view: { x0: -.35, x1: 5.2, y0: -300, y1: 3600 }, ic: [0, 50], xEnd: 4, axes: ['t', 'P'],
    marks: [{ x: 3, label: 'P(3) = 800' }, { x: 4, label: 'P(4) ≈ 2016' }], family: [[0, 200], [0, 500], [0, -100]], digits: 1,
  },
  cooling: {
    F: (_, y) => K_COOL * (y - 20), view: { x0: -6, x1: 126, y0: -2, y1: 33 }, ic: [0, 5], xEnd: 50, axes: ['t', 'T'],
    marks: [{ x: 25, label: 'T(25) = 10' }, { x: 50, label: 'T(50) = 13⅓' }], family: [[0, 0], [0, 12], [0, 30], [0, 26], [40, 1]], equilibria: [20], digits: 3,
  },
  logistic: {
    F: (_, y) => .9 * y * (1 - y / 10), view: { x0: -.5, x1: 10.5, y0: -1.6, y1: 13.2 }, ic: [0, .5], xEnd: 8, axes: ['t', 'P'],
    family: [[0, 2], [0, 5], [0, 12.5], [2, .1], [0, -.3]], equilibria: [0, 10], digits: 3,
  },
  separable: {
    F: (x, y) => y * y / (x * x * x), view: { x0: -.15, x1: 4.3, y0: -1.6, y1: 3.3 }, ic: [1, 1], xEnd: 4, axes: ['x', 'y'],
    marks: [{ x: 1, label: '(1, 1)' }], family: [[1, -1], [2, .5], [1, 2.5]], xMin: .08, digits: 4,
  },
  linear: {
    F: (x, y) => x - y, view: { x0: -3, x1: 4, y0: -2.6, y1: 4.2 }, ic: [0, 2], xEnd: 3.5, axes: ['x', 'y'],
    family: [[-2, 3], [-2, -2], [0, -1], [-1, 0]], digits: 4,
  },
};

export default function mount(s: Scene) {
  let mode: Mode = 'growth';
  let spec = MODES[mode];
  const plot = new Plot2D(s, { x: [spec.view.x0, spec.view.x1], y: [spec.view.y0, spec.view.y1], labels: [spec.axes[0], ''], pad: 8 });
  const st = { field: 0, main: 0, euler: 0, marks: 0, x0: spec.ic[0], y0: spec.ic[1], steps: 4 };
  const dropped: { pts: Pt[]; start: number; prog: number }[] = [];
  let mainPts: Pt[] = [], mainStart = 0;

  const out = { euler: s.readout('euler'), exact: s.readout('exact'), err: s.readout('err') };
  const atOut = s.readout('at');
  const hOut = s.root.querySelector('output[data-for="steps"]');
  const eqs = [...s.root.querySelectorAll<HTMLElement>('[data-eq]')];

  // One RK4 step.
  const rk4 = (x: number, y: number, h: number) => {
    const F = spec.F;
    const k1 = F(x, y), k2 = F(x + h / 2, y + h / 2 * k1), k3 = F(x + h / 2, y + h / 2 * k2), k4 = F(x + h, y + h * k3);
    return y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
  };
  /** Solution through (x0, y0), traced both ways until it leaves the view. Returns points sorted by x and the index of (x0, y0). */
  function trace(x0: number, y0: number): { pts: Pt[]; start: number } {
    const v = spec.view, span = v.x1 - v.x0, h = span / 500, ySpan = v.y1 - v.y0;
    const run = (dir: number) => {
      const pts: Pt[] = [];
      let x = x0, y = y0;
      for (let i = 0; i < 1200; i++) {
        const nx = x + dir * h;
        if (nx < v.x0 - h || nx > v.x1 + h || (spec.xMin !== undefined && nx < spec.xMin)) break;
        const ny = rk4(x, y, dir * h);
        if (!Number.isFinite(ny) || ny < v.y0 - ySpan || ny > v.y1 + ySpan) break;
        x = nx; y = ny; pts.push([x, y]);
      }
      return pts;
    };
    const back = run(-1).reverse();
    return { pts: [...back, [x0, y0], ...run(1)], start: back.length };
  }
  /** Accurate value at xEnd (RK4 with fine steps). */
  function trueAt(x0: number, y0: number, x1: number) {
    const n = 800, h = (x1 - x0) / n;
    let y = y0;
    for (let i = 0; i < n; i++) y = rk4(x0 + i * h, y, h);
    return y;
  }
  function eulerPts(): Pt[] {
    const n = Math.max(1, Math.round(st.steps)), h = (spec.xEnd - st.x0) / n;
    const pts: Pt[] = [[st.x0, st.y0]];
    let x = st.x0, y = st.y0;
    for (let i = 0; i < n; i++) { y += h * spec.F(x, y); x += h; pts.push([x, y]); }
    return pts;
  }

  function sync(retrace = false) {
    if (retrace) { const t = trace(st.x0, st.y0); mainPts = t.pts; mainStart = t.start; }
    const n = Math.max(1, Math.round(st.steps)), h = (spec.xEnd - st.x0) / n;
    const e = eulerPts().at(-1)![1], tr = trueAt(st.x0, st.y0, spec.xEnd);
    out.euler(st.euler > .5 ? fmt(e, spec.digits) : '—');
    out.exact(fmt(tr, spec.digits));
    out.err(st.euler > .5 ? fmt(Math.abs(e - tr), spec.digits) : '—');
    if (hOut) hOut.textContent = `h = ${fmt(h, h < 1 ? 3 : 1)}`;
    atOut(`${spec.axes[0]} = ${fmt(spec.xEnd, 1)}`);
    plot.invalidate();
  }

  let handleDrag = false;
  plot.handle({
    get: () => [st.x0, st.y0],
    set: (x, y) => {
      const v = spec.view, span = v.x1 - v.x0;
      st.x0 = num.clamp(x, Math.max(v.x0, spec.xMin ?? -Infinity), spec.xEnd - span * .08);
      st.y0 = num.clamp(y, v.y0, v.y1);
      sync(true);
    },
    onStart: () => { handleDrag = true; },
  });

  // Tap (not drag, not scroll) to drop an initial condition.
  let down: { x: number; y: number; t: number; px: number; py: number } | null = null;
  plot.onPointer((x, y, kind, e) => {
    if (kind === 'down') { down = handleDrag ? null : { x, y, t: performance.now(), px: e.clientX, py: e.clientY }; }
    if (kind === 'up') {
      if (down && !handleDrag && performance.now() - down.t < 500 && Math.hypot(e.clientX - down.px, e.clientY - down.py) < 8) drop(down.x, down.y);
      down = null; handleDrag = false;
    }
  });
  function drop(x: number, y: number, delay = 0) {
    if (spec.xMin !== undefined && x < spec.xMin) return;
    const t = trace(x, y);
    const c = { ...t, prog: s.reduced ? 1 : 0 };
    dropped.push(c);
    if (dropped.length > 10) dropped.shift();
    s.tween(c, { prog: 1, duration: 1.1, delay, ease: 'power2.out', onUpdate: () => plot.invalidate() });
    plot.invalidate();
  }

  const drawCurve = (g: Plot2D, pts: Pt[], start: number, prog: number, color: 'c1' | 'c3', width: number, alpha = 1) => {
    if (prog <= 0 || pts.length < 2) return;
    // Grow outward from the initial point in both directions.
    const lo = Math.max(0, Math.floor(start - start * prog)), hi = Math.min(pts.length, Math.ceil(start + (pts.length - start) * prog) + 1);
    g.poly(pts.slice(lo, hi), { fill: false, stroke: color, strokeWidth: width, strokeAlpha: alpha });
  };

  plot.render = g => {
    const ctx = g.ctx, v = spec.view;
    // Slope field: short segments on a screen-space grid.
    if (st.field > .01) {
      const gap = g.width < 500 ? 30 : 36, len = gap * .62 * st.field;
      ctx.beginPath();
      for (let py = gap / 2; py < g.height; py += gap) for (let px = gap / 2; px < g.width; px += gap) {
        const [x, y] = g.toWorld(px, py);
        if (spec.xMin !== undefined && x < spec.xMin) continue;
        const m = spec.F(x, y);
        if (!Number.isFinite(m)) continue;
        let dx = 1 / g.unitX, dy = -m / g.unitY;
        const L = Math.hypot(dx, dy); dx /= L; dy /= L;
        ctx.moveTo(px - dx * len / 2, py - dy * len / 2);
        ctx.lineTo(px + dx * len / 2, py + dy * len / 2);
      }
      ctx.strokeStyle = g.color('muted', .6); ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.stroke();
    }
    for (const yEq of spec.equilibria ?? []) {
      if (st.field < .5) break;
      g.hline(yEq, { color: 'c5', alpha: .8, dash: [7, 6], width: 1.5 });
      g.text(`${spec.axes[1]} = ${yEq}`, v.x1, yEq, { color: 'c5', size: 12, font: 'mono', align: 'right', offset: [-28, -12] });
    }
    for (const c of dropped) drawCurve(g, c.pts, c.start, c.prog, 'c3', 2, .85);
    // End line for Euler comparison.
    if (st.euler > .01) {
      g.vline(spec.xEnd, { alpha: .6 * st.euler });
      const pts = eulerPts();
      g.poly(pts, { fill: false, stroke: 'c2', strokeWidth: 2.4, strokeAlpha: st.euler });
      if (pts.length < 50) pts.forEach(([x, y]) => g.point(x, y, { color: 'c2', r: 3.5, alpha: st.euler }));
    }
    drawCurve(g, mainPts, mainStart, st.main, 'c1', 3.2);
    if (st.marks > .01 && st.main > .98) {
      for (const mk of spec.marks ?? []) {
        if (mk.x < st.x0 && mode !== 'separable') continue;
        const y = trueAt(st.x0, st.y0, mk.x);
        const isDefault = Math.abs(st.x0 - spec.ic[0]) < 1e-9 && Math.abs(st.y0 - spec.ic[1]) < 1e-9;
        if (!isDefault) continue;
        g.point(mk.x, y, { color: 'c1', r: 4.5, alpha: st.marks });
        g.text(mk.label, mk.x, y, { color: 'ink', size: 13, font: 'mono', offset: [10, 16], align: 'left', alpha: st.marks });
      }
    }
    g.point(st.x0, st.y0, { color: 'c1', r: 6, ring: true, halo: true });
  };

  function setMode(v: Mode) {
    mode = v; spec = MODES[v];
    dropped.length = 0;
    Object.assign(plot.view, spec.view);
    plot.opts.labels = [spec.axes[0], ''];
    st.x0 = spec.ic[0]; st.y0 = spec.ic[1];
    eqs.forEach(el => { el.hidden = el.dataset.eq !== v; });
    sync(true);
  }
  const seg = s.segmented('mode', v => {
    setMode(v as Mode);
    if (!s.reduced) { st.field = 0; st.main = 0; s.tween(st, { field: 1, duration: .7, onUpdate: () => plot.invalidate() }); s.tween(st, { main: 1, duration: 1, delay: .3, onUpdate: () => plot.invalidate() }); }
    else { st.field = 1; st.main = 1; }
  });
  const slider = s.slider('steps', v => { st.steps = v; sync(); });
  s.action('clear', () => { dropped.length = 0; plot.invalidate(); });

  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .8, ...vars, onUpdate: () => sync() });
  const ensure = (v: Mode) => { if (mode !== v) { seg.set(v); return true; } return false; };
  const family = (delay = .5) => spec.family.forEach((p, i) => drop(p[0], p[1], delay + i * .18));
  slider.set(st.steps);
  setMode('growth');
  s.onBeat(i => {
    if (i === 0) { ensure('growth'); to({ field: 1, main: 0, euler: 0, marks: 0 }); }
    if (i === 1) { ensure('growth'); to({ field: 1, euler: 0 }); to({ main: 1, duration: 1.4, ease: 'power2.inOut' }); to({ marks: 1, delay: 1.2 }); }
    if (i === 2) { ensure('growth'); to({ field: 1, main: 1, euler: 1, marks: 0 }); slider.set(1); slider.set(80, 3.2); }
    if (i === 3) { ensure('cooling'); to({ euler: 0, marks: 1 }); if (!dropped.length) family(); }
    if (i === 4) { ensure('logistic'); to({ euler: 0, marks: 0 }); if (!dropped.length) family(); }
    if (i === 5) { ensure('separable'); to({ euler: 1, marks: 1 }); slider.set(8, .6); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.field = 1; sync(); return; }
    s.tween(st, { field: 1, duration: 1.2, ease: 'power2.out', onUpdate: () => plot.invalidate() });
  });
}
