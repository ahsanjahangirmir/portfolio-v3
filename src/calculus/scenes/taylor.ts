// Scene: Taylor polynomials, their error, and the radius of convergence.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Key = 'sin' | 'exp' | 'ln' | 'geom';
type Spec = {
  f: (x: number) => number;
  /** k-th Taylor coefficient about c, f^(k)(c)/k!. */
  coef: (k: number, c: number) => number;
  /** Interval of convergence about c: [lo, hi] with endpoint inclusion, or null when R = ∞. */
  interval: (c: number) => { lo: number; hi: number; loIn: boolean; hiIn: boolean } | null;
  singular?: number;
  view: { x0: number; x1: number; y0: number; y1: number };
  c: [number, number, number]; probe: number;
};
const fact = (() => { const t = [1]; for (let i = 1; i <= 21; i++) t[i] = t[i - 1] * i; return t; })();
const SPECS: Record<Key, Spec> = {
  sin: {
    f: Math.sin, coef: (k, c) => Math.sin(c + k * Math.PI / 2) / fact[k], interval: () => null,
    view: { x0: -7.6, x1: 7.6, y0: -2.7, y1: 2.7 }, c: [-6, 6, 0], probe: 3.6,
  },
  exp: {
    f: Math.exp, coef: (k, c) => Math.exp(c) / fact[k], interval: () => null,
    view: { x0: -4.6, x1: 3.3, y0: -1.6, y1: 9 }, c: [-3, 2, 0], probe: 2.4,
  },
  ln: {
    f: x => x > -1 ? Math.log(1 + x) : NaN,
    coef: (k, c) => k === 0 ? Math.log(1 + c) : (k % 2 ? 1 : -1) / (k * (1 + c) ** k),
    interval: c => ({ lo: -1, hi: 2 * c + 1, loIn: false, hiIn: true }), singular: -1,
    view: { x0: -1.9, x1: 4.3, y0: -3.2, y1: 2.6 }, c: [-.6, 1.5, 0], probe: 1.6,
  },
  geom: {
    f: x => 1 / (1 - x), coef: (k, c) => 1 / (1 - c) ** (k + 1),
    interval: c => ({ lo: 2 * c - 1, hi: 1, loIn: false, hiIn: false }), singular: 1,
    view: { x0: -3.3, x1: 2.3, y0: -2.6, y1: 6 }, c: [-2, .6, 0], probe: -1.5,
  },
};

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const sup = (n: number) => n === 1 ? '' : String(n).split('').map(c => SUP[c]).join('');
const sub = (n: number) => String(n).split('').map(c => SUB[c]).join('');

/** Small exact fraction p/q for a coefficient, if there is one. */
function frac(v: number): [number, number] | null {
  const a = Math.abs(v);
  let h0 = 0, h1 = 1, k0 = 1, k1 = 0, x = a;
  for (let i = 0; i < 20; i++) {
    const t = Math.floor(x);
    [h0, h1] = [h1, t * h1 + h0]; [k0, k1] = [k1, t * k1 + k0];
    if (k1 > 1e7) return null;
    if (Math.abs(a - h1 / k1) < 1e-10 * Math.max(1, a)) return h1 <= 9999 ? [h1, k1] : null;
    if (x - t < 1e-12) break;
    x = 1 / (x - t);
  }
  return null;
}

export default function mount(s: Scene) {
  let key: Key = 'sin';
  let spec = SPECS.sin;
  const plot = new Plot2D(s, { x: [spec.view.x0, spec.view.x1], y: [spec.view.y0, spec.view.y1], labels: ['x', 'y'], pad: 8 });
  const st = { n: 0, c: 0, xp: spec.probe, draw: 0, err: 0, band: 1 };
  const N = () => num.clamp(Math.round(st.n), 0, 20);
  const coefs = new Float64Array(21);
  const refresh = () => { for (let k = 0; k <= 20; k++) coefs[k] = spec.coef(k, st.c); };
  const T = (x: number) => { const n = N(), u = x - st.c; let y = 0; for (let k = n; k >= 0; k--) y = y * u + coefs[k]; return y; };

  const out = { t: s.readout('t'), f: s.readout('f'), err: s.readout('err'), radius: s.readout('radius'), poly: s.readout('poly') };

  function termsText() {
    const n = N(), c = st.c;
    const base = Math.abs(c) < 1e-9 ? 'x' : c > 0 ? `(x − ${fmt(c, 2)})` : `(x + ${fmt(-c, 2)})`;
    const parts: string[] = [];
    let shown = 0, hidden = 0;
    for (let k = 0; k <= n; k++) {
      const a = coefs[k];
      if (Math.abs(a) < 1e-12) continue;
      if (shown >= (plot.width < 500 ? 3 : 6)) { hidden++; continue; }
      const neg = a < 0, fr = frac(a);
      let body: string;
      const pw = k === 0 ? '' : base + sup(k);
      if (k === 0) body = fr && fr[1] === 1 ? String(fr[0]) : fmt(Math.abs(a), 4);
      else if (fr) body = fr[1] === 1 ? (fr[0] === 1 ? pw : `${fr[0]}${pw}`) : (fr[0] === 1 ? `${pw}/${fr[1]}` : `${fr[0]}${pw}/${fr[1]}`);
      else body = `${fmt(Math.abs(a), 4)}${pw}`;
      parts.push((parts.length ? (neg ? ' − ' : ' + ') : (neg ? '−' : '')) + body);
      shown++;
    }
    return `T${sub(n)}(x) = ${parts.join('') || '0'}${hidden ? ` + ⋯ (${hidden} more)` : ''}`;
  }

  function sync() {
    refresh();
    const fx = spec.f(st.xp), tx = T(st.xp);
    out.t(fmt(tx, 5)); out.f(Number.isFinite(fx) ? fmt(fx, 5) : 'undefined');
    out.err(Number.isFinite(fx) ? fmt(Math.abs(fx - tx), 5) : '—');
    const iv = spec.interval(st.c);
    out.radius(iv ? fmt((iv.hi - iv.lo) / 2, 3) : '∞');
    out.poly(termsText());
    plot.invalidate();
  }

  const sn = s.slider('n', v => { st.n = v; sync(); });
  const sc = s.slider('c', v => { st.c = v; sync(); });
  const sx = s.slider('x', v => { st.xp = v; sync(); });

  plot.handle({ get: () => [st.c, spec.f(st.c)], set: x => sc.set(num.clamp(x, spec.c[0], spec.c[1])) });
  plot.handle({ get: () => [st.xp, 0], set: x => sx.set(num.clamp(x, spec.view.x0, spec.view.x1)), radius: 14 });

  plot.render = g => {
    const v = spec.view, iv = spec.interval(st.c);
    // Interval of convergence.
    if (iv && st.band > .01) {
      const lo = Math.max(iv.lo, g.ex0), hi = Math.min(iv.hi, g.ex1);
      g.rect(lo, g.ey0, hi - lo, g.ey1 - g.ey0, { color: 'c3', alpha: .07 * st.band });
      g.line(iv.lo, 0, iv.hi, 0, { color: 'c3', width: 5, alpha: .75 * st.band, cap: 'butt' });
      g.point(iv.lo, 0, { color: 'c3', r: 5.5, ring: !iv.loIn, alpha: st.band });
      g.point(iv.hi, 0, { color: 'c3', r: 5.5, ring: !iv.hiIn, alpha: st.band });
      g.text(`R = ${fmt((iv.hi - iv.lo) / 2, 2)}`, (iv.lo + iv.hi) / 2, 0, { color: 'c3', size: 13, font: 'mono', align: 'center', offset: [0, 18], alpha: st.band });
    }
    if (spec.singular !== undefined) g.vline(spec.singular, { color: 'c4', alpha: .7 });
    // Error band between f and T_n.
    if (st.draw > .98 && st.err > .01) {
      const sgl = spec.singular, e = 1e-3;
      const spans: [number, number][] = sgl === undefined ? [[g.ex0, g.ex1]] : key === 'ln' ? [[sgl + e, g.ex1]] : [[g.ex0, sgl - e], [sgl + e, g.ex1]];
      for (const [a, b] of spans) g.area(spec.f, a, b, { bottom: T, color: 'c4', alpha: .22 * st.err, samples: 500 });
    }
    g.fn(spec.f, { color: 'c1', width: 3, progress: st.draw });
    if (st.draw < .98) return;
    g.fn(T, { color: 'c2', width: 2.6 });
    // Probe: the error at one x.
    const fx = spec.f(st.xp), tx = T(st.xp);
    if (Number.isFinite(fx)) g.line(st.xp, fx, st.xp, num.clamp(tx, g.ey0 - 1, g.ey1 + 1), { color: 'c4', width: 2.6 });
    g.point(st.xp, 0, { color: 'c4', r: 5.5, ring: true });
    if (Number.isFinite(fx)) g.point(st.xp, fx, { color: 'c1', r: 3.5 });
    // Center.
    g.point(st.c, spec.f(st.c), { color: 'c2', r: 6.5, ring: true, halo: true });
    g.text('c', st.c, spec.f(st.c), { color: 'ink', weight: 600, size: 15, offset: [10, 16] });
    // Curve labels at the right edge.
    const lx = v.x1 - (v.x1 - v.x0) * .1;
    const fl = spec.f(lx);
    if (Number.isFinite(fl) && fl < g.ey1 && fl > g.ey0) g.text('f', lx, fl, { color: 'c1', font: 'serif', size: 17, offset: [0, -14] });
    const tl = T(lx * .9 + st.c * .1);
    if (tl < g.ey1 && tl > g.ey0) g.text(`T${sub(N())}`, lx * .9 + st.c * .1, tl, { color: 'c2', font: 'serif', size: 16, offset: [0, 16] });
  };

  function setKey(k: Key, animate = true) {
    key = k; spec = SPECS[k];
    Object.assign(plot.view, spec.view);
    sc.el.min = String(spec.c[0]); sc.el.max = String(spec.c[1]);
    sx.el.min = String(spec.view.x0); sx.el.max = String(spec.view.x1);
    sc.set(spec.c[2]); sx.set(spec.probe);
    if (animate && !s.reduced) { st.draw = 0; s.tween(st, { draw: 1, duration: .9, ease: 'power2.inOut', onUpdate: sync }); }
    sync();
  }
  const seg = s.segmented('fn', v => setKey(v as Key));

  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .8, ...vars, onUpdate: sync });
  const ensure = (k: Key) => { if (seg.get() !== k) seg.set(k); };
  let pending: gsap.core.Timeline | null = null;
  setKey('sin', false);
  sn.set(0);
  st.draw = s.reduced ? 1 : 0;
  sync();
  s.onBeat(i => {
    pending?.kill(); pending = null;
    if (i === 0) { ensure('sin'); to({ err: 0 }); sc.set(0, .6); sn.set(0); if (!s.reduced) pending = s.timeline().call(() => sn.set(1, .8), [], 1.2); else sn.set(1); }
    if (i === 1) { ensure('sin'); to({ err: 0 }); sc.set(0, .6); sn.set(1); sn.set(9, 3.2); }
    if (i === 2) { ensure('sin'); to({ err: 1 }); sn.set(5, .8); sx.set(3.6, .8); }
    if (i === 3) { ensure('ln'); to({ err: 1 }); sc.set(0, .5); sn.set(1); sn.set(20, 3.4); }
    if (i === 4) { ensure('ln'); to({ err: 1 }); sn.set(12, .6); sc.set(1.5, 2); }
    if (i === 5) { ensure('exp'); to({ err: 1 }); sn.set(1); sn.set(20, 3); }
  });
  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.3, ease: 'power2.inOut', onUpdate: sync });
  });
}
