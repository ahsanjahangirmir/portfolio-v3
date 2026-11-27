// Scene: infinite series as limits of partial sums.
// Top panel: the terms (tiles, bars, or a ping-pong zigzag). Bottom panel: S_n against n with the limit.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Mode = 'geo' | 'harm' | 'basel' | 'alt' | 'ratio';
type Spec = {
  a: (k: number) => number; limit: number; limitLabel: string;
  sy: [number, number]; verdict: string; test: string; reason: string;
  /** Integral-test comparison curve for the bars. */
  curve?: (x: number) => number; curveLabel?: string;
};
const MODES: Record<Mode, Spec> = {
  geo: {
    a: k => .5 ** k, limit: 1, limitLabel: '1', sy: [-.08, 1.18], verdict: 'Converges',
    test: 'Geometric series, r = 1/2', reason: '|r| < 1, so the sum is a/(1 − r) = 1',
  },
  harm: {
    a: k => 1 / k, limit: Infinity, limitLabel: '∞', sy: [-.3, 5.9], verdict: 'Diverges',
    test: 'p-test, p = 1', reason: 'p ≤ 1. Terms → 0, but Sₙ > ln(n + 1) → ∞',
    curve: x => 1 / x, curveLabel: 'y = 1/x',
  },
  basel: {
    a: k => 1 / (k * k), limit: Math.PI ** 2 / 6, limitLabel: 'π²/6', sy: [-.1, 1.95], verdict: 'Converges',
    test: 'p-test, p = 2', reason: 'p > 1, so it converges (to π²/6)',
    curve: x => 1 / (x * x), curveLabel: 'y = 1/x²',
  },
  alt: {
    a: k => (k % 2 ? 1 : -1) / k, limit: Math.LN2, limitLabel: 'ln 2', sy: [-.08, 1.15], verdict: 'Converges',
    test: 'Alternating series (ping-pong) test', reason: '1/n decreases to 0. |Sₙ − S| ≤ next term',
  },
  ratio: {
    a: k => k * k / (-2) ** k, limit: -2 / 27, limitLabel: '−2/27', sy: [-1.05, .75], verdict: 'Converges',
    test: 'Ratio test', reason: '|aₙ₊₁/aₙ| = (n+1)²/(2n²) → 1/2 < 1',
  },
};

export default function mount(s: Scene) {
  const mk = (top: string, height: string) => {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:0;right:0;top:${top};height:${height}`;
    s.stage.appendChild(el); s.cleanup(() => el.remove());
    return el;
  };
  const hostTop = mk('0', '52%'), hostBot = mk('52%', '48%');
  const rule = document.createElement('div');
  rule.style.cssText = 'position:absolute;left:0;right:0;top:52%;height:1px;background:var(--line)';
  s.stage.appendChild(rule); s.cleanup(() => rule.remove());

  let mode: Mode = 'geo';
  let spec = MODES.geo;
  const top = new Plot2D(s, { x: [-.1, 1.1], y: [-.1, 1.1], host: hostTop, pad: 10, aspect: 'equal', grid: false, axes: false });
  const bot = new Plot2D(s, { x: [-.6, 10.8], y: spec.sy, host: hostBot, pad: 8 });
  const st = { n: 1, show: 0, xMax: 10.8 };
  const N = () => Math.max(1, Math.round(st.n));
  const cardH = () => bot.width < 520 ? 30 : 48;
  const S = (n: number) => { let t = 0; for (let k = 1; k <= n; k++) t += spec.a(k); return t; };

  const out = { sn: s.readout('sn'), limit: s.readout('limit'), verdict: s.readout('verdict') };
  const slider = s.slider('n', v => { st.n = v; sync(); });

  /** Leave headroom above the data for the verdict card. Returns true if the view changed. */
  function headroom() {
    const [lo, hi] = spec.sy, h = Math.max(1, bot.height - 16), q = Math.min(.45, (cardH() + 12) / h);
    const y1 = (hi - q * lo) / (1 - q), changed = Math.abs(bot.view.y1 - y1) > 1e-9 || bot.view.y0 !== lo;
    bot.view.y0 = lo; bot.view.y1 = y1;
    return changed;
  }

  function sync() {
    const n = N();
    out.sn(fmt(S(n), 6));
    out.limit(Number.isFinite(spec.limit) ? `${spec.limitLabel} ≈ ${fmt(spec.limit, 6)}` : '∞ (diverges)');
    out.verdict(spec.verdict);
    // Bottom view follows n so early terms stay readable.
    const target = Math.max(10.8, n * 1.08 + 1);
    st.xMax = target;
    bot.view.x1 = st.xMax; bot.view.x0 = -st.xMax * .055;
    headroom();
    top.invalidate(); bot.invalidate();
  }

  bot.handle({ get: () => [N(), S(N())], set: x => slider.set(num.clamp(Math.round(x), 1, 100)) });

  // ---------- Top panel ----------
  const BARS = 20;
  function topView() {
    if (mode === 'geo') { Object.assign(top.view, { x0: -.08, x1: 1.08, y0: -.08, y1: 1.1 }); top.opts.aspect = 'equal'; top.opts.axes = top.opts.grid = false; }
    else if (mode === 'alt') { Object.assign(top.view, { x0: .38, x1: 1.12, y0: -BARS - 1.2, y1: 1.4 }); top.opts.aspect = 'fill'; top.opts.axes = false; top.opts.grid = false; }
    else if (mode === 'ratio') { Object.assign(top.view, { x0: -.6, x1: BARS + 1.6, y0: -1.35, y1: 1.35 }); top.opts.aspect = 'fill'; top.opts.axes = top.opts.grid = true; }
    else { Object.assign(top.view, { x0: -.6, x1: BARS + 1.6, y0: -.12, y1: 1.22 }); top.opts.aspect = 'fill'; top.opts.axes = top.opts.grid = true; }
  }

  top.render = g => {
    const n = N(), al = st.show;
    if (al < .01) return;
    g.ctx.globalAlpha = al;
    if (mode === 'geo') {
      g.rect(0, 0, 1, 1, { color: 'c3', alpha: 0, stroke: 'muted', strokeAlpha: .7 });
      let x0 = 0, x1 = 1, y0 = 0, y1 = 1;
      for (let k = 1; k <= Math.min(n, 24); k++) {
        let tile: [number, number, number, number];
        if (k % 2) { const xm = (x0 + x1) / 2; tile = [x0, y0, xm - x0, y1 - y0]; x0 = xm; }
        else { const ym = (y0 + y1) / 2; tile = [x0, ym, x1 - x0, y1 - ym]; y1 = ym; }
        const last = k === n;
        g.rect(...tile, { color: last ? 'c2' : 'c3', alpha: last ? .55 : k % 2 ? .42 : .26, stroke: 'ground', strokeWidth: 1.5 });
        const [w] = [tile[2] / g.unitX];
        if (k <= 6 && w > 34) g.text(k === 1 ? '1/2' : `1/${2 ** k}`, tile[0] + tile[2] / 2, tile[1] + tile[3] / 2, { color: 'ink', size: k < 4 ? 15 : 12, font: 'mono', align: 'center' });
      }
    } else if (mode === 'alt') {
      g.vline(spec.limit, { color: 'c3', alpha: .9, dash: [6, 6] });
      g.text('ln 2', spec.limit, 1, { color: 'c3', size: 13, font: 'mono', align: 'center', offset: [0, -4] });
      for (const v of [.5, 1]) { g.vline(v, { alpha: .35 }); g.text(String(v), v, 1, { color: 'muted', size: 11, font: 'mono', align: 'center', offset: [0, -4] }); }
      const m = Math.min(n, BARS);
      let prev = 0;
      const pts: [number, number][] = [[0, 0]];
      for (let k = 1; k <= m; k++) { prev += spec.a(k); pts.push([prev, -k]); }
      // Ping-pong: each step jumps across the limit, by less each time.
      for (let k = 1; k < pts.length; k++) {
        const [xa, ya] = k === 1 ? [pts[1][0], 0] : pts[k - 1], [xb, yb] = pts[k];
        if (k > 1) g.line(xa, ya, xb, yb, { color: k === m ? 'c2' : 'c3', width: 2, alpha: .85 });
        g.point(xb, yb, { color: 'c1', r: k === m ? 5 : 3.2 });
      }
      g.text(`S${sub(m)}`, pts[m][0], pts[m][1], { color: 'ink', size: 13, font: 'mono', offset: [pts[m][0] > spec.limit ? 10 : -10, 0], align: pts[m][0] > spec.limit ? 'left' : 'right' });
      if (n > BARS) g.textPx(`… and ${n - BARS} more steps`, g.width / 2, g.height - 12, { color: 'muted', size: 12, font: 'mono', align: 'center' });
    } else {
      if (spec.curve) g.fn(spec.curve, { from: 1, color: 'c1', width: 2.2 });
      const m = Math.min(n, BARS);
      for (let k = 1; k <= m; k++) {
        const v = spec.a(k), last = k === n;
        g.rect(k, 0, 1, v, { color: last ? 'c2' : v >= 0 ? 'c3' : 'c4', alpha: last ? .6 : .4, stroke: 'ground', strokeWidth: 1 });
      }
      if (spec.curveLabel) g.text(spec.curveLabel, 2.2, spec.curve!(2.2), { color: 'c1', font: 'serif', size: 15, offset: [8, -12] });
      if (mode === 'ratio' && n < BARS) {
        const r = Math.abs(spec.a(n + 1) / spec.a(n));
        g.text(`|a${sub(n + 1)}/a${sub(n)}| = ${fmt(r, 3)}`, BARS * .62, 1.05, { color: 'c2', size: 13, font: 'mono' });
      }
      if (n > BARS) g.textPx(`+ ${n - BARS} more terms →`, g.width - 14, g.height * .42, { color: 'muted', size: 12, font: 'mono', align: 'right' });
    }
    g.textPx('THE TERMS', top.opts.axes ? g.toScreen(0, 0)[0] + 12 : 16, 18, { font: 'mono', size: 11, color: 'muted' });
    g.ctx.globalAlpha = 1;
  };

  // ---------- Bottom panel ----------
  bot.render = g => {
    if (headroom()) { bot.invalidate(); return; }
    const n = N(), al = st.show;
    if (al < .01) return;
    g.ctx.globalAlpha = al;
    if (Number.isFinite(spec.limit)) {
      g.hline(spec.limit, { color: 'c3', dash: [6, 6], width: 1.5 });
      g.text(spec.limitLabel, g.ex1, spec.limit, { color: 'c3', size: 13, font: 'mono', align: 'right', offset: [-10, spec.limit > (g.ey0 + g.ey1) / 2 ? 14 : -12] });
    }
    if (mode === 'harm') {
      g.fn(x => Math.log(x + 1), { from: 0, color: 'c2', width: 1.5, dash: [5, 5], alpha: .9 });
      g.text('ln(n + 1)', g.ex1 * .7, Math.log(g.ex1 * .7 + 1), { color: 'c2', size: 13, font: 'mono', offset: [0, 16], align: 'center' });
    }
    const pts: [number, number][] = [];
    let t = 0;
    for (let k = 1; k <= n; k++) { t += spec.a(k); pts.push([k, t]); }
    g.poly(pts, { fill: false, stroke: 'c1', strokeWidth: 1.5, strokeAlpha: .6 });
    const r = n > 40 ? 2 : 3.2;
    pts.forEach(([x, y]) => g.point(x, y, { color: 'c1', r }));
    const [lx, ly] = pts[n - 1];
    g.point(lx, ly, { color: 'c1', r: 6, ring: true, halo: true });
    g.text(`S${sub(n)} = ${fmt(ly, 4)}`, lx, ly, { color: 'ink', size: 13, font: 'mono', offset: [-12, ly > (g.ey0 + g.ey1) / 2 ? 18 : -16], align: lx > g.ex1 * .6 ? 'right' : 'left' });
    // Verdict card.
    const x = 12, y = 10, compact = g.width < 520;
    g.panelPx(x, y, compact ? g.width - 24 : 340, cardH(), { alpha: .9 });
    g.textPx(`${spec.verdict}: ${spec.test}`, x + 12, y + 15, { color: spec.verdict === 'Converges' ? 'c3' : 'c4', size: 13, weight: 600 });
    if (!compact) g.textPx(spec.reason, x + 12, y + 34, { color: 'muted', size: 12, font: 'mono' });
    g.ctx.globalAlpha = 1;
  };

  function setMode(v: Mode) {
    mode = v; spec = MODES[v];
    topView();
    sync();
  }
  const seg = s.segmented('mode', v => {
    setMode(v as Mode);
    if (!s.reduced) { st.show = 0; s.tween(st, { show: 1, duration: .5, onUpdate: sync }); }
  });

  const ensure = (v: Mode) => { if (seg.get() !== v) seg.set(v); };
  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .6, ...vars, onUpdate: sync });
  setMode('geo');
  s.onBeat(i => {
    to({ show: 1 });
    if (i === 0) { ensure('geo'); slider.set(1); slider.set(10, 3); }
    if (i === 1) { ensure('geo'); slider.set(30, 1.4); }
    if (i === 2) { ensure('harm'); slider.set(1); slider.set(100, 3.4); }
    if (i === 3) { ensure('basel'); slider.set(1); slider.set(100, 3); }
    if (i === 4) { ensure('alt'); slider.set(1); slider.set(20, 3); }
    if (i === 5) { ensure('ratio'); slider.set(1); slider.set(20, 3); }
  });
  s.onEnter(() => { if (s.reduced) { st.show = 1; sync(); } });
}

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
function sub(n: number) { return String(n).split('').map(c => SUB[c]).join(''); }
