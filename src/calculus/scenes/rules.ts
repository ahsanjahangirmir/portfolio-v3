// Scene 04: the product rule as a growing rectangle (x⁴eˣ) and the chain rule as
// three number lines x → u = tan x → y = sin u (sin(tan x)), where a nudge is stretched twice.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

export default function mount(s: Scene) {
  const plot = new Plot2D(s, { x: [-.7, 3.9], y: [-.6, 4.8], aspect: 'equal', pad: 10 });

  // Product: width f(x) = x⁴, height g(x) = eˣ.
  const f = (x: number) => x ** 4, df = (x: number) => 4 * x ** 3;
  const g = Math.exp;
  // Chain: u = tan x, y = sin u.
  const inner = Math.tan, outer = Math.sin;
  const LX = 2.15, LU = 1.08, LY = 0; // heights of the three number lines

  const st = { mode: 'product', x: 1, cx: .55, dx: 0, fade: 1, draw: 0, maps: 0 };
  const out = {
    strips: s.readout('strips'), corner: s.readout('corner'), share: s.readout('share'),
    gp: s.readout('gp'), fp: s.readout('fp'), dydx: s.readout('dydx'),
  };

  function sync() {
    if (st.mode === 'product') {
      const F = f(st.x), G = g(st.x), dF = f(st.x + st.dx) - F, dG = g(st.x + st.dx) - G;
      const strips = G * dF + F * dG, corner = dF * dG;
      out.strips(fmt(strips, 5)); out.corner(fmt(corner, 6));
      out.share(st.dx > 0 ? `${fmt(100 * corner / (strips + corner), 2)}%` : '—');
    } else {
      const x = st.cx, u = inner(x);
      const gp = 1 / Math.cos(x) ** 2, fp = Math.cos(u);
      out.gp(fmt(gp, 4)); out.fp(fmt(fp, 4));
      const ratio = st.dx > 0 ? (outer(inner(x + st.dx)) - outer(u)) / st.dx : fp * gp;
      out.dydx(`${fmt(ratio, 4)} → ${fmt(fp * gp, 4)}`);
    }
    plot.invalidate();
  }

  const groups = [...s.root.querySelectorAll<HTMLElement>('[data-mode]')];
  function setMode(m: string) {
    st.mode = m;
    groups.forEach(el => { el.style.display = el.dataset.mode === m ? 'contents' : 'none'; });
    plot.view = m === 'product' ? { x0: -.7, x1: 3.9, y0: -.6, y1: 4.8 } : { x0: -1.75, x1: 2.85, y0: -.75, y1: 2.75 };
    plot.opts.grid = m === 'product'; plot.opts.axes = m === 'product'; plot.opts.ticks = m === 'product';
    plot.opts.aspect = m === 'product' ? 'equal' : 'fill';
    st.fade = 0;
    s.tween(st, { fade: 1, duration: .5, onUpdate: sync });
    sync();
  }
  const mode = s.segmented('mode', setMode);
  const dxs = s.slider('dx', v => {
    st.dx = v;
    if (st.mode === 'chain') st.cx = Math.min(st.cx, 1.2 - v);
    sync();
  });

  // Product handles: the rectangle corner sets x, the outer corner sets dx.
  plot.handle({
    get: () => (st.mode === 'product' ? [f(st.x), g(st.x)] : [NaN, NaN]),
    set: px => { st.x = num.clamp(Math.max(px, 0) ** .25, .6, 1.1); sync(); },
  });
  plot.handle({
    get: () => (st.mode === 'product' && st.dx > .02 ? [f(st.x + st.dx), g(st.x + st.dx)] : [NaN, NaN]),
    set: px => dxs.set(num.clamp(Math.max(px, 0) ** .25 - st.x, 0, .25)),
    radius: 14,
  });
  // Chain handle: the point x on the top line.
  plot.handle({
    get: () => (st.mode === 'chain' ? [st.cx, LX] : [NaN, NaN]),
    set: px => { st.cx = num.clamp(px, -1, 1.2 - st.dx); sync(); },
  });

  plot.render = p => {
    p.ctx.globalAlpha = st.fade;
    if (st.mode === 'product') drawProduct(p); else drawChain(p);
  };

  function drawProduct(p: Plot2D) {
    const x = st.x, F = f(x), G = g(x), F1 = f(x + st.dx), G1 = g(x + st.dx);
    const dF = F1 - F, dG = G1 - G, k = st.draw;
    p.rect(0, 0, F * k, G * k, { color: 'ink', alpha: .07 });
    if (st.dx > 0) {
      p.rect(F, 0, dF, G, { color: 'c1', alpha: .38, stroke: 'c1', strokeWidth: 1, strokeAlpha: .8 });
      p.rect(0, G, F, dG, { color: 'c3', alpha: .38, stroke: 'c3', strokeWidth: 1, strokeAlpha: .8 });
      p.rect(F, G, dF, dG, { color: 'c4', alpha: .7, stroke: 'c4', strokeWidth: 1 });
    }
    p.line(0, 0, F * k, 0, { color: 'c1', width: 4 });
    p.line(0, 0, 0, G * k, { color: 'c3', width: 4 });
    if (k < .98) return;
    p.text('f(x) = x⁴', F / 2, 0, { color: 'c1', size: 14, offset: [0, -16], align: 'center' });
    p.text('g(x) = eˣ', 0, G * .82, { color: 'c3', size: 14, offset: [10, 0] });
    p.text('area f · g', F / 2, G / 2, { color: 'ink', size: 15, align: 'center' });
    const ppx = 1 / p.unitX;
    if (st.dx > 0) {
      if (dF * ppx > 16) {
        p.line(F, 0, F1, 0, { color: 'c1', width: 4, alpha: .55 });
        p.text('df', F + dF / 2, 0, { color: 'c1', size: 15, offset: [0, -16], align: 'center', font: 'serif' });
        p.text('g · df', F + dF / 2, G / 2, { color: 'ink', size: 13, align: 'center', offset: [0, 0] });
      }
      if (dG * ppx > 16) {
        p.line(0, G, 0, G1, { color: 'c3', width: 4, alpha: .55 });
        p.text('dg', 0, G + dG / 2, { color: 'c3', size: 15, offset: [10, 0], font: 'serif' });
        p.text('f · dg', F / 2, G + dG / 2, { color: 'ink', size: 13, align: 'center' });
      }
      p.text('df · dg', F1, G1, { color: 'c4', size: 13, offset: [8, -10] });
      p.point(F1, G1, { color: 'c4', r: 5.5, ring: true });
    }
    p.point(F, G, { color: 'ink', r: 6, ring: true, halo: true });
    // Difference quotient vs the product rule.
    const dq = st.dx > 0 ? (F1 * G1 - F * G) / st.dx : NaN;
    const exact = df(x) * G + F * G;
    p.panelPx(14, 14, 236, 50, { alpha: .9 });
    p.textPx(`x = ${fmt(x, 3)}   dx = ${fmt(st.dx, 3)}`, 24, 30, { font: 'mono', size: 12, color: 'muted' });
    p.textPx(`Δ(fg)/dx = ${st.dx > 0 ? fmt(dq, 4) : '—'}`, 24, 49, { font: 'mono', size: 12, color: 'ink' });
    p.textPx(`→ ${fmt(exact, 4)}`, 176, 49, { font: 'mono', size: 12, color: 'c2' });
  }

  function numberLine(p: Plot2D, y: number, name: string) {
    p.line(p.ex0 + .05, y, p.ex1 - .05, y, { color: 'muted', width: 1.4 });
    for (let t = -1.5; t <= 2.5 + 1e-9; t += .5) {
      const major = Math.abs(t - Math.round(t)) < 1e-9;
      const [, py] = p.toScreen(0, y);
      const [px] = p.toScreen(t, 0);
      p.ctx.strokeStyle = p.color('muted', .8); p.ctx.lineWidth = 1;
      p.ctx.beginPath(); p.ctx.moveTo(px, py - (major ? 6 : 3)); p.ctx.lineTo(px, py + (major ? 6 : 3)); p.ctx.stroke();
      if (major) p.textPx(fmt(t, 0), px, py + 16, { color: 'muted', size: 11, font: 'mono', align: 'center' });
    }
    p.text(name, p.ex0, y, { color: 'ink', size: 14, offset: [8, -14] });
  }

  function drawChain(p: Plot2D) {
    numberLine(p, LX, 'x');
    numberLine(p, LU, 'u = tan x');
    numberLine(p, LY, 'y = sin u');
    // Mapping threads: where each x lands.
    if (st.maps > .01) {
      for (let x = -1; x <= 1.2001; x += .05) {
        const u = inner(x), y = outer(u);
        if (u > p.ex1) continue;
        p.line(x, LX, u, LU, { color: 'muted', width: 1, alpha: .28 * st.maps });
        p.line(u, LU, y, LY, { color: 'muted', width: 1, alpha: .28 * st.maps });
      }
    }
    const x0 = st.cx, x1 = st.cx + st.dx, u0 = inner(x0), u1 = inner(x1), y0 = outer(u0), y1 = outer(u1);
    if (st.dx > 0) {
      p.poly([[x0, LX], [x1, LX], [u1, LU], [u0, LU]], { color: 'c2', alpha: .2 });
      p.poly([[u0, LU], [u1, LU], [y1, LY], [y0, LY]], { color: 'c2', alpha: .2 });
      p.line(x0, LX, x1, LX, { color: 'c2', width: 5 });
      p.line(u0, LU, u1, LU, { color: 'c2', width: 5 });
      p.line(y0, LY, y1, LY, { color: 'c2', width: 5 });
      const gp = 1 / Math.cos(x0) ** 2, fp = Math.cos(u0);
      p.text('dx', (x0 + x1) / 2, LX, { color: 'c2', font: 'serif', size: 16, offset: [0, -16], align: 'center' });
      p.text(`du ≈ ${fmt(gp, 2)} · dx`, Math.max(u0, u1), LU, { color: 'c2', size: 13, offset: [12, -13] });
      p.text(`dy ≈ ${fmt(fp, 2)} · du`, Math.max(y0, y1), LY, { color: 'c2', size: 13, offset: [12, -13] });
    }
    p.point(u0, LU, { color: 'c3', r: 5 });
    p.point(y0, LY, { color: 'c5', r: 5 });
    p.point(x0, LX, { color: 'c1', r: 6.5, ring: true, halo: true });
  }

  const to = (vars: gsap.TweenVars) => s.tween(st, { overwrite: 'auto', duration: .8, ...vars, onUpdate: sync });
  s.onBeat(i => {
    if (i <= 2 && mode.get() !== 'product') mode.set('product');
    if (i >= 3 && mode.get() !== 'chain') mode.set('chain');
    if (i === 0) { to({ x: 1 }); dxs.set(0, .6); }
    if (i === 1) { to({ x: 1 }); dxs.set(.2, 1.2); }
    if (i === 2) { dxs.set(.2, .3); s.tween({}, { duration: .5, onComplete: () => { if (st.mode === 'product') dxs.set(.01, 2.6); } }); }
    if (i === 3) { to({ maps: 1, cx: .55 }); dxs.set(.25, .8); }
    if (i === 4) { to({ maps: .5, cx: .55 }); dxs.set(.04, 2); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.1, ease: 'power2.inOut', onUpdate: sync });
  });
  st.draw = s.reduced ? 1 : 0;
  setMode('product');
  st.fade = 1;
}
