// Scene 03: the derivative is a function too. f on top, f′ underneath, sharing the x-axis.
// As the point sweeps, the slope of the tangent on top is recorded as a height below.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Fn = {
  f: (x: number) => number; d1: (x: number) => number; d2: (x: number) => number;
  x: [number, number]; y: [number, number]; dy: [number, number];
  names: [string, string, string]; v: string; from?: number; corner?: boolean;
};

const FNS: Record<string, Fn> = {
  cubic: { f: x => x ** 3 - 3 * x, d1: x => 3 * x * x - 3, d2: x => 6 * x, x: [-2.4, 2.4], y: [-3.4, 3.4], dy: [-4.2, 9], names: ['f(x) = x³ − 3x', 'f′(x) = 3x² − 3', 'f″(x) = 6x'], v: 'x' },
  sin: { f: Math.sin, d1: Math.cos, d2: x => -Math.sin(x), x: [-6.6, 6.6], y: [-1.8, 1.8], dy: [-1.8, 1.8], names: ['f(x) = sin x', 'f′(x) = cos x', 'f″(x) = −sin x'], v: 'x' },
  exp: { f: Math.exp, d1: Math.exp, d2: Math.exp, x: [-3, 2.2], y: [-1, 9], dy: [-1, 9], names: ['f(x) = eˣ', 'f′(x) = eˣ', 'f″(x) = eˣ'], v: 'x' },
  abs: { f: Math.abs, d1: x => (x === 0 ? NaN : Math.sign(x)), d2: x => (x === 0 ? NaN : 0), x: [-3, 3], y: [-1, 3.4], dy: [-1.9, 1.9], names: ['f(x) = |x|', 'f′(x) = ±1', 'f″(x) = 0'], v: 'x', corner: true },
  motion: { f: t => t ** 4 - 2 * t * t + 1, d1: t => 4 * t ** 3 - 4 * t, d2: t => 12 * t * t - 4, x: [-.42, 1.65], y: [-.6, 2.8], dy: [-5, 10.5], names: ['position s(t) = t⁴ − 2t² + 1', 'velocity v(t) = 4t³ − 4t', 'acceleration a(t) = 12t² − 4'], v: 't', from: 0 },
};

export default function mount(s: Scene) {
  const mk = (css: string) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:0;right:0;${css}`;
    s.stage.appendChild(d); s.cleanup(() => d.remove());
    return d;
  };
  const topHost = mk('top:0;height:55%');
  const botHost = mk('top:55%;bottom:0;border-top:1px solid var(--line)');
  const top = new Plot2D(s, { host: topHost, x: [-2.4, 2.4], y: [-3.4, 3.4], labels: ['x', 'y'], pad: 6 });
  const bot = new Plot2D(s, { host: botHost, x: [-2.4, 2.4], y: [-4.2, 9], labels: ['x', ''], pad: 6 });

  const st = { key: 'cubic', x0: -1.6, lo: -1.6, hi: -1.6, draw: 0, tan: 1, trace: 0, ghost: 0, marks: 0, f2: 0, fade: 1 };
  let F = FNS.cubic;
  let range: [number, number] = [-2.3, 2.3];
  const out = { slope: s.readout('slope'), second: s.readout('second') };
  const xs = s.slider('x', v => { st.x0 = v; sync(); });
  const xOut = s.root.querySelector('output[data-for="x"]');

  const atCorner = () => !!F.corner && Math.abs(st.x0) < .015;

  function sync() {
    st.lo = Math.min(st.lo, st.x0); st.hi = Math.max(st.hi, st.x0);
    top.view = { x0: F.x[0], x1: F.x[1], y0: F.y[0], y1: F.y[1] };
    bot.view = { x0: F.x[0], x1: F.x[1], y0: F.dy[0], y1: F.dy[1] };
    top.opts.labels = [F.v, F.v === 't' ? 's' : 'y'];
    bot.opts.labels = [F.v, ''];
    out.slope(atCorner() ? 'undefined' : fmt(F.d1(st.x0), 3));
    out.second(atCorner() ? 'undefined' : fmt(F.d2(st.x0), 3));
    if (xOut) xOut.textContent = `${F.v} = ${fmt(st.x0, 2)}`;
    top.invalidate(); bot.invalidate();
  }

  function setFn(key: string, x0?: number) {
    st.key = key; F = FNS[key];
    const lo = F.from ?? F.x[0] + .1, hi = F.x[1] - .1;
    range = [lo, hi];
    if (xs.el) { xs.el.min = String(lo); xs.el.max = String(hi); }
    const start = x0 ?? num.clamp(st.x0, lo, hi);
    st.lo = st.hi = start;
    xs.set(start);
    st.fade = 0;
    s.tween(st, { fade: 1, duration: .45, onUpdate: sync });
  }
  const fn = s.segmented('fn', v => setFn(v));

  const f2Btn = s.action('f2', () => {
    const on = st.f2 < .5;
    f2Btn?.setAttribute('aria-pressed', String(on));
    s.tween(st, { f2: on ? 1 : 0, duration: .5, onUpdate: sync });
  });
  f2Btn?.setAttribute('aria-pressed', 'false');
  const sweep = () => {
    const [lo, hi] = range;
    st.trace = 1;
    xs.set(lo); st.lo = st.hi = lo;
    xs.set(hi, s.reduced ? false : 3.4);
  };
  s.action('sweep', sweep);

  top.handle({
    get: () => [st.x0, F.f(st.x0)],
    set: x => xs.set(num.clamp(x, range[0], range[1])),
    onStart: () => { st.trace = 1; },
  });

  /** Zeros of f′ in the view (sign changes on a grid), for the flat-tangent marks. */
  function flats(): number[] {
    const r: number[] = [], [a, b] = [F.from ?? F.x[0], F.x[1]], n = 300;
    let px = a, pv = F.d1(a);
    for (let i = 1; i <= n; i++) {
      const x = a + (b - a) * i / n, v = F.d1(x);
      if (Number.isFinite(v) && Number.isFinite(pv) && pv * v <= 0 && pv !== v) {
        let l = px, h = x;
        for (let k = 0; k < 40; k++) { const m = (l + h) / 2; if (F.d1(l) * F.d1(m) <= 0) h = m; else l = m; }
        const z = (l + h) / 2;
        if (!r.length || Math.abs(r[r.length - 1] - z) > 1e-6) r.push(z);
      }
      px = x; pv = v;
    }
    return r;
  }

  top.render = p => {
    p.ctx.globalAlpha = st.fade;
    const x0 = st.x0, y0 = F.f(x0), m = F.d1(x0);
    p.vline(x0, { alpha: .5 });
    p.fn(F.f, { color: 'c1', width: 3, progress: st.draw, from: F.from });
    if (st.draw < .98) return;
    if (st.marks > .01) for (const z of flats()) {
      p.slopeLine(z, F.f(z), 0, { color: 'c2', width: 1.2, alpha: .45 * st.marks, span: (p.ex1 - p.ex0) * .07 });
      p.point(z, F.f(z), { color: 'c2', r: 4, alpha: st.marks });
    }
    if (F.v === 't') {
      // The particle rides the s-axis; its velocity arrow is the slope.
      const px = -.28;
      p.line(px, p.ey0, px, p.ey1, { color: 'line', width: 1.5 });
      p.line(px, y0, x0, y0, { color: 'muted', width: 1, dash: [3, 4] });
      const scale = .09;
      p.arrow(px, y0, px, y0 + m * scale, { color: 'c2', width: 2.4, head: 9 });
      p.point(px, y0, { color: 'c1', r: 6.5 });
    }
    if (atCorner()) {
      p.line(0, 0, -1.2, 1.2, { color: 'c4', width: 2, dash: [6, 5] });
      p.line(0, 0, 1.2, 1.2, { color: 'c4', width: 2, dash: [6, 5] });
      p.text('slope −1 from the left, +1 from the right', 0, 0, { color: 'c4', size: 13, offset: [0, -36], align: 'center' });
    } else if (st.tan > .01 && Number.isFinite(m)) {
      p.slopeLine(x0, y0, m, { color: 'c2', width: 2.4, alpha: st.tan });
      // Slope triangle with a run of one unit in screen-friendly size.
      const run = (p.ex1 - p.ex0) * .1;
      p.line(x0, y0, x0 + run, y0, { color: 'muted', width: 1.2, dash: [4, 4], alpha: st.tan });
      p.line(x0 + run, y0, x0 + run, y0 + m * run, { color: 'c2', width: 3, alpha: st.tan });
    }
    p.point(x0, y0, { color: 'c1', r: 6, ring: true, halo: true });
    p.textPx(F.names[0], 16, p.height - 40, { color: 'c1', size: 14 });
    if (!atCorner() && Number.isFinite(m)) p.textPx(`slope ${fmt(m, 2)}`, 16, p.height - 20, { color: 'c2', size: 13, font: 'mono' });
  };

  bot.render = p => {
    p.ctx.globalAlpha = st.fade;
    const x0 = st.x0, m = F.d1(x0);
    p.vline(x0, { alpha: .5 });
    const pieces: [number, number][] = F.corner ? [[F.x[0], -1e-9], [1e-9, F.x[1]]] : [[F.from ?? F.x[0], F.x[1]]];
    if (st.ghost > .01) for (const [a, b] of pieces) p.fn(F.d1, { color: 'c2', width: 1.6, alpha: .3 * st.ghost, from: a, to: b });
    if (st.f2 > .01) for (const [a, b] of pieces) p.fn(F.d2, { color: 'c5', width: 2.2, alpha: st.f2, from: a, to: b });
    if (st.trace > .01) for (const [a, b] of pieces) {
      const lo = Math.max(a, st.lo), hi = Math.min(b, st.hi);
      if (hi > lo) p.fn(F.d1, { color: 'c2', width: 3, from: lo, to: hi, alpha: st.trace });
    }
    if (F.corner && st.lo < 0 && st.hi > 0) { p.point(0, -1, { color: 'c2', r: 4.5, ring: true }); p.point(0, 1, { color: 'c2', r: 4.5, ring: true }); }
    if (st.marks > .01) for (const z of flats()) p.point(z, 0, { color: 'c2', r: 4.5, alpha: st.marks, halo: true });
    if (!atCorner() && Number.isFinite(m)) {
      p.line(x0, 0, x0, m, { color: 'c2', width: 3 });
      p.point(x0, m, { color: 'c2', r: 5.5 });
    }
    if (st.f2 > .01 && !atCorner()) p.point(x0, F.d2(x0), { color: 'c5', r: 4.5, alpha: st.f2 });
    p.textPx(F.names[1], 16, 20, { color: 'c2', size: 14 });
    if (st.f2 > .01) p.textPx(F.names[2], 16, 40, { color: 'c5', size: 14, alpha: st.f2 });
  };

  const to = (vars: gsap.TweenVars) => s.tween(st, { overwrite: 'auto', duration: .7, ...vars, onUpdate: sync });
  const show = (key: string, x0: number) => { if (fn.get() !== key) { fn.set(key); } setFn(key, x0); };
  s.onBeat(i => {
    if (i === 0) { show('cubic', -1.6); to({ trace: 0, ghost: 0, marks: 0, f2: 0 }); }
    if (i === 1) { show('cubic', -2.3); to({ trace: 1, ghost: 0, marks: 0, f2: 0 }); xs.set(2.3, s.reduced ? false : 3.6); }
    if (i === 2) { if (st.key !== 'cubic') show('cubic', 1); st.lo = Math.min(st.lo, -2.3); st.hi = Math.max(st.hi, 2.3); to({ trace: 1, ghost: 1, marks: 1, f2: 0 }); xs.set(1, .9); }
    if (i === 3) { show('sin', -6.5); to({ trace: 1, ghost: 0, marks: 0, f2: 0 }); xs.set(6.5, s.reduced ? false : 4); }
    if (i === 4) { show('abs', -2.6); to({ trace: 1, ghost: 0, marks: 0, f2: 0 }); xs.set(0, s.reduced ? false : 2); }
    if (i === 5) { show('motion', 0); to({ trace: 1, ghost: 0, marks: 0, f2: 1 }); xs.set(1.55, s.reduced ? false : 3.6); }
    f2Btn?.setAttribute('aria-pressed', String(i === 5));
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.2, ease: 'power2.inOut', onUpdate: sync });
  });
  st.draw = s.reduced ? 1 : 0;
  setFn('cubic', -1.6);
  st.fade = 1;
}
