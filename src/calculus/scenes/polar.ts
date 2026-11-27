// Scene: polar curves, area as thin sectors ½r²dθ, and parametric tangent slopes.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Mode = 'cardioid' | 'rose' | 'circle' | 'param';
type PolarSpec = { r: (t: number) => number; max: number; view: { x0: number; x1: number; y0: number; y1: number }; a: number; b: number; label: string };
const TAU = Math.PI * 2;
const POLAR: Record<Exclude<Mode, 'param'>, PolarSpec> = {
  cardioid: { r: t => 1 + Math.cos(t), max: TAU, view: { x0: -1.1, x1: 2.3, y0: -1.55, y1: 1.55 }, a: 0, b: TAU, label: 'r = 1 + cos θ' },
  rose: { r: t => Math.cos(3 * t), max: Math.PI, view: { x0: -1.15, x1: 1.25, y0: -1.15, y1: 1.15 }, a: 0, b: Math.PI, label: 'r = cos 3θ' },
  circle: { r: t => Math.sin(t), max: Math.PI, view: { x0: -.8, x1: .8, y0: -.2, y1: 1.18 }, a: Math.PI / 3, b: 2 * Math.PI / 3, label: 'r = sin θ' },
};
const PVIEW = { x0: -1.5, x1: 25, y0: -7.6, y1: 9.6 };
// Example: x = 2t² + 1, y = t³/3 − t.
const px = (t: number) => 2 * t * t + 1, py = (t: number) => t ** 3 / 3 - t;
const dxdt = (t: number) => 4 * t, dydt = (t: number) => t * t - 1;

export default function mount(s: Scene) {
  let mode: Mode = 'cardioid';
  let spec: PolarSpec = POLAR.cardioid;
  const plot = new Plot2D(s, { x: [spec.view.x0, spec.view.x1], y: [spec.view.y0, spec.view.y1], aspect: 'equal', grid: false, axes: false, pad: 8 });
  const st = { a: 0, b: 0, n: 12, sectors: 0, draw: 1, t: 1.6, tan: 0, ray: 1 };
  const N = () => Math.max(1, Math.round(st.n));

  const out = { sum: s.readout('sum'), integral: s.readout('integral'), dx: s.readout('dx'), dy: s.readout('dy'), slope: s.readout('slope') };
  const ctl = (name: string) => s.root.querySelector<HTMLElement>(`[data-control="${name}"], [data-readout="${name}"]`)?.closest<HTMLElement>('.ctl');
  const polarCtl = ['a', 'b', 'n', 'sum', 'integral'].map(ctl);
  const paramCtl = ['t', 'dx', 'dy', 'slope'].map(ctl);
  const traceBtn = s.root.querySelector<HTMLElement>('[data-action="trace"]');
  const eqs = [...s.root.querySelectorAll<HTMLElement>('[data-eq]')];
  const angleOut = (name: string) => s.root.querySelector(`output[data-for="${name}"]`);

  // Angles shown as multiples of π.
  const piFmt = (v: number) => `${fmt(v / Math.PI, 2)}π`;

  function sync() {
    if (mode === 'param') {
      const t = st.t, dx = dxdt(t), dy = dydt(t);
      out.dx(fmt(dx, 3)); out.dy(fmt(dy, 3));
      out.slope(Math.abs(dx) < 1e-3 ? 'vertical' : fmt(dy / dx, 4));
    } else {
      const n = N(), d = (st.b - st.a) / n;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += .5 * spec.r(st.a + (i + .5) * d) ** 2 * d;
      out.sum(st.sectors > .5 ? fmt(sum, 5) : '—');
      out.integral(fmt(num.integrate(t => .5 * spec.r(t) ** 2, st.a, st.b, 600), 5));
      const ao = angleOut('a'), bo = angleOut('b');
      if (ao) ao.textContent = piFmt(st.a);
      if (bo) bo.textContent = piFmt(st.b);
    }
    plot.invalidate();
  }

  const sa = s.slider('a', v => { st.a = Math.min(v, st.b); sync(); });
  const sb = s.slider('b', v => { st.b = Math.max(v, st.a); sync(); });
  const sn = s.slider('n', v => { st.n = v; sync(); });
  const stt = s.slider('t', v => { st.t = v; sync(); });

  // Polar handle: the moving point at θ = β. Dragging picks the angle whose curve point is nearest the pointer.
  plot.handle({
    get: () => mode === 'param' ? [px(st.t), py(st.t)] : [spec.r(st.b) * Math.cos(st.b), spec.r(st.b) * Math.sin(st.b)],
    set: (x, y) => {
      if (mode === 'param') {
        let best = st.t, bd = Infinity;
        for (let i = 0; i <= 600; i++) { const t = -3 + 6 * i / 600, d = Math.hypot(px(t) - x, (py(t) - y) * 1.4); if (d < bd) { bd = d; best = t; } }
        stt.set(best);
        return;
      }
      const phi = Math.atan2(y, x);
      let best = st.b, bd = Infinity;
      for (let k = -2; k <= 3; k++) {
        const th = phi + k * Math.PI;
        if (th < st.a || th > spec.max) continue;
        const r = spec.r(th), d = Math.hypot(r * Math.cos(th) - x, r * Math.sin(th) - y);
        if (d < bd) { bd = d; best = th; }
      }
      sb.set(best);
    },
  });

  function polarGrid(g: Plot2D) {
    const ctx = g.ctx;
    const [ox, oy] = g.toScreen(0, 0);
    ctx.strokeStyle = g.color('grid'); ctx.lineWidth = 1;
    ctx.beginPath();
    const R = Math.max(Math.abs(g.ex0), Math.abs(g.ex1), Math.abs(g.ey0), Math.abs(g.ey1)) * 1.5;
    for (let r = .5; r < R; r += .5) { ctx.moveTo(ox + r / g.unitX, oy); ctx.arc(ox, oy, r / g.unitX, 0, TAU); }
    for (let k = 0; k < 12; k++) { const th = k * Math.PI / 6; ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(th) * R / g.unitX, oy - Math.sin(th) * R / g.unitX); }
    ctx.stroke();
    ctx.strokeStyle = g.color('muted', .45);
    ctx.beginPath(); ctx.moveTo(0, oy + .5); ctx.lineTo(g.width, oy + .5); ctx.moveTo(ox + .5, 0); ctx.lineTo(ox + .5, g.height); ctx.stroke();
    for (const r of [.5, 1, 1.5, 2]) { const [tx, ty] = g.toScreen(r, 0); if (tx < g.width - 10) g.textPx(String(r), tx + 3, ty + 10, { font: 'mono', size: 11, color: 'muted', halo: false }); }
  }

  plot.render = g => {
    if (mode === 'param') return renderParam(g);
    polarGrid(g);
    const f = spec.r, a = st.a, b = st.b;
    const P = (t: number): [number, number] => [f(t) * Math.cos(t), f(t) * Math.sin(t)];
    // Sectors.
    if (st.sectors > .01 && b > a) {
      const n = N(), d = (b - a) / n;
      for (let i = 0; i < n; i++) {
        const t0 = a + i * d, r = f(t0 + d / 2), pts: [number, number][] = [[0, 0]];
        for (let j = 0; j <= 6; j++) { const t = t0 + d * j / 6; pts.push([r * Math.cos(t), r * Math.sin(t)]); }
        g.poly(pts, { color: 'c3', alpha: .26 * st.sectors, stroke: n <= 48 ? 'c3' : undefined, strokeAlpha: .55 * st.sectors, strokeWidth: 1 });
      }
    }
    g.param(t => P(t)[0], t => P(t)[1], 0, spec.max, { color: 'c1', width: 1.6, alpha: .25 });
    if (b > a) g.param(t => P(t)[0], t => P(t)[1], a, a + (b - a) * st.draw, { color: 'c1', width: 3.2 });
    // α edge and the moving ray at β.
    const [ax, ay] = P(a);
    if (a > 1e-3 && st.ray > .01) g.line(0, 0, Math.cos(a) * 3, Math.sin(a) * 3, { color: 'muted', width: 1, dash: [4, 5], alpha: .7 });
    if (st.ray > .01) {
      const [bx, by] = P(b);
      g.line(0, 0, Math.cos(b) * 3, Math.sin(b) * 3, { color: 'muted', width: 1, dash: [4, 5], alpha: .7 * st.ray });
      g.line(0, 0, bx, by, { color: 'c2', width: 2.6, alpha: st.ray });
      // Angle arc.
      const ra = 26 * g.unitX;
      g.param(t => ra * Math.cos(t), t => ra * Math.sin(t), 0, b % TAU || (b > 0 ? TAU : 0), { color: 'c2', width: 1.5, alpha: .8 * st.ray, samples: 80 });
      g.text('θ', ra * 1.6 * Math.cos(b / 2 % TAU), ra * 1.6 * Math.sin(b / 2 % TAU), { color: 'c2', font: 'serif', size: 15, align: 'center', alpha: st.ray });
      const rv = f(b);
      g.text('r', bx / 2, by / 2, { color: 'c2', font: 'serif', size: 17, offset: [-Math.sin(b) * 12 * Math.sign(rv || 1), -Math.cos(b) * 12 * Math.sign(rv || 1)], align: 'center', alpha: st.ray });
      g.point(bx, by, { color: 'c2', r: 6, ring: true, halo: true });
      if (rv < -1e-3) g.text('r < 0', bx, by, { color: 'c4', size: 13, font: 'mono', offset: [12, -14], alpha: st.ray });
    }
    if (a > 1e-3) g.point(ax, ay, { color: 'c1', r: 4 });
  };

  function renderParam(g: Plot2D) {
    const t = st.t, x = px(t), y = py(t), dx = dxdt(t), dy = dydt(t);
    g.param(px, py, -3, -3 + 6 * st.draw, { color: 'c1', width: 3 });
    if (Math.abs(t + 3) > .6) g.text('t = −3', px(-3), py(-3), { color: 'muted', size: 12, font: 'mono', offset: [-8, 12], align: 'right' });
    if (Math.abs(t - 3) > .6) g.text('t = 3', px(3), py(3), { color: 'muted', size: 12, font: 'mono', offset: [-8, -12], align: 'right' });
    if (st.tan > .01) {
      if (Math.abs(dx) < 1e-3) g.vline(x, { color: 'c2', width: 2.2, dash: [], alpha: st.tan });
      else g.slopeLine(x, y, dy / dx, { color: 'c2', width: 2.2, alpha: st.tan });
      // Velocity components: run dx/dt, rise dy/dt (scaled).
      const k = .3;
      g.arrow(x, y, x + dx * k, y, { color: 'c3', width: 2.2, alpha: st.tan });
      g.arrow(x + dx * k, y, x + dx * k, y + dy * k, { color: 'c5', width: 2.2, alpha: st.tan });
      if (Math.abs(dx * k) > 1) g.text('dx/dt', x + dx * k / 2, y, { color: 'c3', size: 13, font: 'mono', align: 'center', offset: [0, dy >= 0 ? 14 : -14], alpha: st.tan });
      if (Math.abs(dy * k) > 1) {
        const right = dx >= 0 && g.toScreen(x + dx * k, 0)[0] < g.width - 60;
        g.text('dy/dt', x + dx * k, y + dy * k / 2, { color: 'c5', size: 13, font: 'mono', offset: [right ? 10 : -10, 0], align: right ? 'left' : 'right', alpha: st.tan });
      }
    }
    g.point(x, y, { color: 'c2', r: 6, ring: true, halo: true });
    g.text(`(${fmt(x, 2)}, ${fmt(y, 2)})`, x, y, { color: 'ink', size: 13, font: 'mono', offset: [-12, -16], align: 'right' });
  }

  function setMode(v: Mode, animate = true) {
    mode = v;
    eqs.forEach(el => { el.hidden = el.dataset.eq !== v; });
    const isP = v === 'param';
    polarCtl.forEach(el => { if (el) el.style.display = isP ? 'none' : ''; });
    paramCtl.forEach(el => { if (el) el.style.display = isP ? '' : 'none'; });
    if (traceBtn) traceBtn.style.display = isP ? 'none' : '';
    plot.opts.grid = plot.opts.axes = isP;
    plot.opts.aspect = isP ? 'fill' : 'equal';
    if (isP) { Object.assign(plot.view, PVIEW); st.tan = 1; }
    else {
      spec = POLAR[v];
      Object.assign(plot.view, spec.view);
      for (const sl of [sa, sb]) sl.el.max = String(spec.max);
      st.a = spec.a; st.b = spec.b;
      sa.set(st.a); sb.set(st.b);
    }
    if (animate && !s.reduced) { st.draw = 0; s.tween(st, { draw: 1, duration: 1.1, ease: 'power2.inOut', onUpdate: sync }); }
    sync();
  }
  const seg = s.segmented('mode', v => setMode(v as Mode));

  s.action('trace', () => {
    if (mode === 'param') return;
    const from = st.a;
    sb.set(from);
    sb.set(spec.max, s.reduced ? false : 3);
  });

  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .8, ...vars, onUpdate: sync });
  const ensure = (v: Mode) => { if (seg.get() !== v) seg.set(v); };
  sn.set(st.n); stt.set(st.t);
  setMode('cardioid', false);
  s.onBeat(i => {
    if (i === 0) { ensure('cardioid'); to({ sectors: 0, ray: 1 }); sb.set(0); sb.set(TAU, 3.2); }
    if (i === 1) { ensure('cardioid'); sb.set(TAU, .6); sn.set(12); to({ sectors: 1, ray: .4 }); sn.set(96, 3); }
    if (i === 2) { ensure('circle'); to({ sectors: 1, ray: 1 }); sn.set(24); }
    if (i === 3) { ensure('rose'); to({ sectors: 1, ray: 1 }); sn.set(60); sb.set(0); sb.set(Math.PI, 3.2); }
    if (i === 4) { ensure('param'); to({ tan: 1 }); stt.set(-2); stt.set(3, 2.4); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    st.draw = 1;
  });
}
