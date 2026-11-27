// Scene: arc length as the limit of inscribed polygons (y = ln(cos x), 0 ≤ x ≤ π/3).
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

export default function mount(s: Scene) {
  const f = (x: number) => Math.log(Math.cos(x));
  const a = 0;
  const exact = (b: number) => Math.log(1 / Math.cos(b) + Math.tan(b)); // ∫ sec x dx from 0 to b
  const base = { x0: -.1, x1: 1.3, y0: -1.1, y1: .22 };
  const plot = new Plot2D(s, { x: [base.x0, base.x1], y: [base.y0, base.y1], aspect: 'equal', labels: ['x', 'y'], pad: 8 });

  // n is fractional while tweening; the polygon uses round(n).
  const st = { b: Math.PI / 3, n: 1, draw: 0, poly: 0, zoom: 0, seg: 4, table: 0, legs: 0 };
  const N = () => Math.max(1, Math.round(st.n));
  const out = { poly: s.readout('poly'), exact: s.readout('exact') };
  const slider = s.slider('n', v => { st.n = v; sync(); });

  const polyLength = (n: number, b = st.b) => {
    let L = 0, px = a, py = f(a);
    for (let i = 1; i <= n; i++) { const x = a + (b - a) * i / n, y = f(x); L += Math.hypot(x - px, y - py); px = x; py = y; }
    return L;
  };

  function zoomView() {
    const n = N(), k = Math.min(st.seg, n - 1);
    const x0 = a + (st.b - a) * k / n, x1 = a + (st.b - a) * (k + 1) / n;
    const y0 = f(x0), y1 = f(x1);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * .85;
    return { x0: cx - half, x1: cx + half, y0: cy - half, y1: cy + half };
  }

  function sync() {
    const z = zoomView(), t = st.zoom;
    plot.view.x0 = num.lerp(base.x0, z.x0, t); plot.view.x1 = num.lerp(base.x1, z.x1, t);
    plot.view.y0 = num.lerp(base.y0, z.y0, t); plot.view.y1 = num.lerp(base.y1, z.y1, t);
    out.poly(st.poly > .5 ? fmt(polyLength(N()), 5) : '—');
    out.exact(fmt(exact(st.b), 5));
    plot.invalidate();
  }

  plot.handle({
    get: () => [st.b, f(st.b)],
    set: x => { st.b = num.clamp(x, .3, 1.2); sync(); },
  });

  plot.render = g => {
    const b = st.b, n = N();
    // Faint continuation, then the measured arc.
    g.fn(f, { from: -.08, to: 1.25, color: 'c1', width: 1.5, alpha: .22 * st.draw });
    g.fn(f, { from: a, to: b, color: 'c1', width: 3.2, progress: st.draw });
    if (st.draw < .98) return;
    if (st.zoom < .3) g.text('y = ln(cos x)', .62, f(.62), { color: 'c1', offset: [16, -18], size: 15, font: 'serif' });

    if (st.poly > .01) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; pts.push([x, f(x)]); }
      g.poly(pts, { fill: false, stroke: 'c2', strokeWidth: 2.2, strokeAlpha: st.poly });
      if (n <= 24 && st.zoom < .5) pts.forEach(([x, y]) => g.point(x, y, { color: 'c2', r: 3.2, alpha: st.poly }));
    }

    // Zoomed segment: dx, dy and the hypotenuse ds.
    if (st.legs > .01) {
      const k = Math.min(st.seg, n - 1);
      const x0 = a + (b - a) * k / n, x1 = a + (b - a) * (k + 1) / n, y0 = f(x0), y1 = f(x1);
      const al = st.legs;
      g.line(x0, y0, x1, y0, { color: 'c3', width: 2.4, alpha: al });
      g.line(x1, y0, x1, y1, { color: 'c5', width: 2.4, alpha: al });
      g.line(x0, y0, x1, y1, { color: 'c2', width: 4, alpha: al });
      g.text('dx', (x0 + x1) / 2, y0, { color: 'c3', font: 'serif', size: 20, offset: [0, -14], align: 'center', alpha: al });
      g.text('dy', x1, (y0 + y1) / 2, { color: 'c5', font: 'serif', size: 20, offset: [12, 0], align: 'left', alpha: al });
      g.text('ds', (x0 + x1) / 2, (y0 + y1) / 2, { color: 'c2', font: 'serif', size: 20, offset: [-14, 14], align: 'right', alpha: al });
      g.point(x0, y0, { color: 'c2', r: 5, alpha: al });
      g.point(x1, y1, { color: 'c2', r: 5, alpha: al });
    }

    g.point(a, f(a), { color: 'c1', r: 5 });
    if (st.zoom < .5) {
      g.point(b, f(b), { color: 'c1', r: 6, ring: true, halo: true });
      g.text('b', b, f(b), { offset: [12, 14], color: 'ink', weight: 600, size: 15 });
    }

    // Table of polygon lengths (bottom-left, where the curve never goes).
    if (st.table > .01 && st.zoom < .5) {
      const rows = [1, 2, 4, 8, 16, 32, 64];
      const h = 20, w = 172, top = g.height - 24 - h * (rows.length + 1);
      const al = st.table * (1 - st.zoom * 2);
      g.panelPx(14, top - 6, w, h * (rows.length + 1) + 12, { alpha: .9 * al });
      g.textPx('n', 28, top + h / 2, { font: 'mono', size: 12, color: 'muted', alpha: al });
      g.textPx('polygon length', 64, top + h / 2, { font: 'mono', size: 12, color: 'muted', alpha: al });
      rows.forEach((r, i) => {
        const near = Math.abs(Math.log2(n) - Math.log2(r)) < .5;
        const y = top + h * (i + 1.5);
        const o = { font: 'mono' as const, size: 13, color: near ? 'c2' : 'ink', alpha: al * (near ? 1 : .7) };
        g.textPx(String(r), 28, y, o);
        g.textPx(polyLength(r).toFixed(5), 64, y, o);
      });
    }
  };

  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .8, ...vars, onUpdate: sync });
  st.draw = s.reduced ? 1 : 0;
  sync();
  s.onBeat(i => {
    if (i === 0) { to({ poly: 0, zoom: 0, legs: 0, table: 0 }); slider.set(1, .4); }
    if (i === 1) { to({ poly: 1, zoom: 0, legs: 0, table: 0, b: Math.PI / 3 }); slider.set(1); if (!s.reduced) slider.set(4, 1.6); else slider.set(4); }
    if (i === 2) { to({ poly: 1, zoom: 0, legs: 0, table: 1, b: Math.PI / 3 }); slider.set(64, 2.6); }
    if (i === 3) {
      slider.set(6, .6);
      st.seg = 4;
      to({ poly: 1, table: 0, b: Math.PI / 3, duration: .6 });
      to({ zoom: 1, delay: .5, duration: 1.2, ease: 'power2.inOut' });
      to({ legs: 1, delay: 1.4, duration: .6 });
    }
    if (i === 4) { to({ zoom: 0, legs: 0, table: 1, poly: 1, duration: 1, ease: 'power2.inOut' }); slider.set(64, 1.2); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.3, ease: 'power2.inOut', onUpdate: sync });
  });
}
