// Scene: improper integrals. 1/x against 1/x² out to infinity, and 1/x against 1/√x down to 0.
// Top panel: the curves and the shaded areas. Bottom panel: the area so far against log10 of the cutoff,
// which is how b = 10⁶ (or t = 10⁻⁶) fits on screen.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n: number) => String(n).split('').map(c => SUP[c] ?? c).join('');
const LN10 = Math.log(10);

type Mode = 'inf' | 'zero';
const MODES = {
  inf: {
    a: (x: number) => 1 / x, b: (x: number) => 1 / (x * x),
    areaA: (u: number) => u * LN10, // ln b
    areaB: (u: number) => 1 - 10 ** -u, // 1 − 1/b
    limitB: 1,
    view: { x0: -.25, x1: 8.6, y0: -.16, y1: 1.5 },
    labelA: '1/x', labelB: '1/x²', accA: 'ln b', accB: '1 − 1/b',
  },
  zero: {
    a: (x: number) => 1 / x, b: (x: number) => 1 / Math.sqrt(x),
    areaA: (u: number) => u * LN10, // −ln t
    areaB: (u: number) => 2 * (1 - 10 ** (-u / 2)), // 2(1 − √t)
    limitB: 2,
    view: { x0: -.1, x1: 1.3, y0: -.6, y1: 8 },
    labelA: '1/x', labelB: '1/√x', accA: '−ln t', accB: '2(1 − √t)',
  },
};

export default function mount(s: Scene) {
  const mk = (top: string, height: string) => {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:0;right:0;top:${top};height:${height}`;
    s.stage.appendChild(el);
    s.cleanup(() => el.remove());
    return el;
  };
  const hostTop = mk('0', '56%'), hostBot = mk('56%', '44%');
  const rule = document.createElement('div');
  rule.style.cssText = 'position:absolute;left:0;right:0;top:56%;height:1px;background:var(--line)';
  s.stage.appendChild(rule); s.cleanup(() => rule.remove());

  const top = new Plot2D(s, { x: [-.25, 8.6], y: [-.16, 1.5], host: hostTop, pad: 8, labels: ['x', ''] });
  const bot = new Plot2D(s, { x: [-.35, 6.4], y: [-1.6, 15.5], host: hostBot, pad: 8, ticks: false });

  let mode: Mode = 'inf';
  const st = { u: 0, draw: 0, acc: 0, emA: 1, emB: 1, decade: 0, morph: 1 };
  const M = () => MODES[mode];
  // Cutoff in x: b = 10^u (type I) or t = 10^−u (type II).
  const cut = () => mode === 'inf' ? 10 ** st.u : 10 ** -st.u;

  const out = { a: s.readout('a'), b: s.readout('b') };
  const labA = s.root.querySelector<HTMLElement>('[data-label-a]');
  const labB = s.root.querySelector<HTMLElement>('[data-label-b]');
  const uOut = s.root.querySelector('output[data-for="u"]');
  const uLabel = s.root.querySelector<HTMLElement>('[data-control="u"]')?.closest('.ctl')?.querySelector('.ctl-label');
  const slider = s.slider('u', v => { st.u = v; sync(); });

  const sci = (v: number) => {
    if (v >= .001 && v < 1e4) return fmt(v, v < .01 ? 4 : v < 1 ? 3 : v < 10 ? 2 : 0);
    if (v >= 1e4) return fmt(v, 0);
    const e = Math.floor(Math.log10(v)), m = v / 10 ** e;
    return `${m.toFixed(1)}×10${sup(e)}`;
  };

  function sync() {
    const m = M();
    out.a(fmt(m.areaA(st.u), 4));
    out.b(fmt(m.areaB(st.u), 6));
    if (uOut) uOut.textContent = sci(cut());
    top.invalidate(); bot.invalidate();
  }

  // Direct manipulation: drag the cutoff in the top panel (near range), or along the bottom plot (any range).
  top.handle({
    get: () => [num.clamp(cut(), top.ex0, top.ex1), 0],
    set: x => {
      if (mode === 'inf') slider.set(num.clamp(Math.log10(Math.max(1, x)), 0, 6));
      else slider.set(num.clamp(-Math.log10(Math.max(1e-6, Math.min(1, x))), 0, 6));
    },
  });
  bot.handle({
    get: () => [st.u, M().areaA(st.u)],
    set: x => slider.set(num.clamp(x, 0, 6)),
  });

  top.render = g => {
    const m = M(), c = cut();
    const lo = mode === 'inf' ? 1 : Math.max(c, 1e-6), hi = mode === 'inf' ? Math.min(c, g.ex1 + .5) : 1;
    // Areas: the larger one underneath.
    if (st.draw > .98 && hi > lo) {
      // Blue: under the smaller curve. Amber: the extra area under the larger one.
      g.area(m.a, lo, hi, { bottom: m.b, color: 'c2', alpha: .2 * st.emA, samples: 400 });
      g.area(m.b, lo, hi, { color: 'c3', alpha: .3 * st.emB, samples: 400 });
    }
    const from = mode === 'inf' ? .45 : .004;
    g.fn(m.a, { from, color: 'c2', width: 2.6, alpha: .35 + .65 * st.emA, progress: st.draw });
    g.fn(m.b, { from, color: 'c3', width: 2.6, alpha: .35 + .65 * st.emB, progress: st.draw });
    if (st.draw < .98) return;
    // Curve labels.
    if (mode === 'inf') {
      g.text('y = 1/x', 2.6, 1 / 2.6, { color: 'c2', font: 'serif', size: 15, offset: [6, -14] });
      g.text('y = 1/x²', 2.2, 1 / 4.84, { color: 'c3', font: 'serif', size: 15, offset: [8, 14] });
      g.vline(1, { alpha: .6 });
    } else {
      g.text('y = 1/x', .16, 1 / .16, { color: 'c2', font: 'serif', size: 15, offset: [10, -4] });
      g.text('y = 1/√x', .35, 1 / Math.sqrt(.35), { color: 'c3', font: 'serif', size: 15, offset: [0, 18], align: 'center' });
      g.vline(1, { alpha: .6 });
    }
    // Cutoff marker; off-screen cutoffs get an arrow at the edge.
    const off = mode === 'inf' && c > g.ex1;
    const px = off ? g.ex1 - g.unitX * 22 : c;
    if (off) {
      g.arrow(g.ex1 - g.unitX * 120, .62, g.ex1 - g.unitX * 18, .62, { color: 'ink', width: 1.6 });
      g.text(`b = ${sci(c)}`, g.ex1 - g.unitX * 18, .62, { color: 'ink', size: 13, font: 'mono', align: 'right', offset: [0, -14] });
    } else {
      g.vline(c, { color: 'ink', alpha: .5 });
      g.point(px, 0, { color: 'ink', r: 6, ring: true, halo: true });
      g.text(mode === 'inf' ? 'b' : 't', px, 0, { color: 'ink', weight: 600, size: 15, offset: [mode === 'inf' ? 12 : 10, -14] });
    }
    g.textPx('THE CURVES', g.toScreen(0, 0)[0] + 12, 18, { font: 'mono', size: 11, color: 'muted' });
  };

  bot.render = g => {
    if (st.acc < .01) return;
    const m = M(), al = st.acc;
    g.ctx.globalAlpha = al;
    // Custom ticks: powers of ten along the bottom, plain numbers on the left.
    for (let k = 0; k <= 6; k++) {
      const [px] = g.toScreen(k, 0);
      const lab = mode === 'inf' ? (k === 0 ? '1' : k === 1 ? '10' : `10${sup(k)}`) : (k === 0 ? '1' : `10${sup(-k)}`);
      g.textPx(lab, px, g.height - 14, { font: 'mono', size: 11, color: 'muted', align: 'center', halo: false });
    }
    for (const y of [5, 10, 15]) { const [, py] = g.toScreen(0, y); if (py > 22) g.textPx(String(y), 8, py, { font: 'mono', size: 11, color: 'muted', halo: false }); }
    if (g.width > 520) g.textPx(mode === 'inf' ? 'b →' : 't →', g.width - 12, g.height - 14, { font: 'mono', size: 11, color: 'muted', align: 'right', halo: false });

    g.hline(m.limitB, { color: 'c3', alpha: .8, dash: [6, 6] });
    // Decade staircase on the divergent line: each ×10 adds ln 10.
    if (st.decade > .01) {
      for (let k = 0; k < 6; k++) {
        const y0 = k * LN10, y1 = (k + 1) * LN10;
        g.line(k, y0, k + 1, y0, { color: 'c2', width: 1.2, dash: [3, 4], alpha: st.decade * .8 });
        g.line(k + 1, y0, k + 1, y1, { color: 'c2', width: 1.2, dash: [3, 4], alpha: st.decade * .8 });
      }
      g.text('+ ln 10 ≈ 2.303 per factor of 10', 3.5, 3 * LN10, { color: 'c2', size: 12, font: 'mono', offset: [14, 10], alpha: st.decade });
    }
    g.fn(m.areaA, { from: 0, to: 6, color: 'c2', width: 1.4, alpha: .3 });
    g.fn(m.areaB, { from: 0, to: 6, color: 'c3', width: 1.4, alpha: .3 });
    g.fn(m.areaA, { from: 0, to: st.u, color: 'c2', width: 3, alpha: .35 + .65 * st.emA });
    g.fn(m.areaB, { from: 0, to: st.u, color: 'c3', width: 3, alpha: .35 + .65 * st.emB });
    g.point(st.u, m.areaB(st.u), { color: 'c3', r: 5 });
    g.point(st.u, m.areaA(st.u), { color: 'c2', r: 6, ring: true, halo: true });
    g.text(m.accA, 5.4, m.areaA(5.4), { color: 'c2', font: 'serif', size: 15, offset: [-10, -10], align: 'right' });
    g.text(m.accB, 5.4, m.limitB, { color: 'c3', font: 'serif', size: 15, offset: [0, -14], align: 'center' });
    g.textPx('AREA SO FAR', g.toScreen(0, 0)[0] + 12, 16, { font: 'mono', size: 11, color: 'muted' });
    g.ctx.globalAlpha = 1;
  };

  function setMode(v: Mode, animate = true) {
    mode = v;
    const m = M();
    const lim = v === 'inf' ? '₁ᵇ' : 'ₜ¹';
    if (labA) labA.textContent = `∫${lim} ${m.labelA} dx`;
    if (labB) labB.textContent = `∫${lim} ${m.labelB} dx`;
    if (uLabel) uLabel.textContent = v === 'inf' ? 'Upper limit b' : 'Lower limit t';
    Object.assign(top.view, m.view);
    if (animate) { st.draw = 0; s.tween(st, { draw: 1, duration: .9, ease: 'power2.inOut', onUpdate: sync }); }
    sync();
  }
  const seg = s.segmented('mode', v => setMode(v as Mode));

  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .8, ...vars, onUpdate: sync });
  const ensure = (v: Mode) => { if (mode !== v) seg.set(v); };
  setMode('inf', false);
  st.draw = s.reduced ? 1 : 0;
  sync();
  s.onBeat(i => {
    if (i === 0) { ensure('inf'); to({ acc: 0, emA: 1, emB: 1, decade: 0 }); slider.set(.35, .8); }
    if (i === 1) { ensure('inf'); to({ acc: 1, emA: 1, emB: 1, decade: 0 }); slider.set(2, 2.4); }
    if (i === 2) { ensure('inf'); to({ acc: 1, emA: .25, emB: 1, decade: 0 }); slider.set(6, 2.4); }
    if (i === 3) { ensure('inf'); to({ acc: 1, emA: 1, emB: .25, decade: 1 }); slider.set(6, 1.2); }
    if (i === 4) { ensure('zero'); to({ acc: 1, emA: 1, emB: 1, decade: 0 }); slider.set(0); slider.set(6, 2.8); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.3, ease: 'power2.inOut', onUpdate: sync });
  });
}
