// Scene 01: secant slopes converge to the tangent slope (P(2, 8) on y = x^3).
import type gsap from 'gsap';
import { Plot2D } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

export default function mount(s: Scene) {
  const f = (x: number) => x ** 3;
  const df = (x: number) => 3 * x * x;
  const plot = new Plot2D(s, { x: [-.3, 3.6], y: [-6, 40], labels: ['x', 'y'], pad: 8 });
  // Room for the table at top-left: start x a little further left on narrow figures.
  // logH drives the gap h = 10^logH through the slider (log scale makes the last digits reachable).
  const st = { a: 2, logH: 0, draw: 0, secant: 0, tangent: 0, tri: 0, table: 0 };
  const h = () => 10 ** st.logH;
  const out = { secant: s.readout('secant'), tangent: s.readout('tangent') };
  const slider = s.slider('h', v => { st.logH = v; sync(); });
  const hOut = s.root.querySelector('output[data-for="h"]');

  function sync() {
    const a = st.a, q = a + h();
    const m = (f(q) - f(a)) / (q - a);
    out.secant(fmt(m, 6));
    out.tangent(st.tangent > .5 ? fmt(df(a), 4) : '?');
    if (hOut) hOut.textContent = fmt(h(), 4);
    plot.invalidate();
  }

  plot.handle({
    get: () => [st.a, f(st.a)],
    set: x => { st.a = Math.max(.2, Math.min(3.1, x)); sync(); },
  });
  plot.handle({
    get: () => [st.a + h(), f(st.a + h())],
    set: x => { const gap = Math.max(1e-3, Math.min(1.78, x - st.a)); slider.set(Math.log10(gap)); },
    radius: 14,
  });

  plot.render = g => {
    const a = st.a, fa = f(a), q = a + h(), fq = f(q);
    const m = (fq - fa) / (q - a);
    g.fn(f, { color: 'c1', width: 3, progress: st.draw });
    if (st.draw < .98) return;
    // Rise/run triangle.
    if (st.tri > .01) {
      g.line(a, fa, q, fa, { color: 'muted', width: 1.5, dash: [5, 5], alpha: st.tri });
      g.line(q, fa, q, fq, { color: 'muted', width: 1.5, dash: [5, 5], alpha: st.tri });
      if (h() > .25) {
        g.text('h', (a + q) / 2, fa, { color: 'c3', font: 'serif', offset: [0, 14], align: 'center', alpha: st.tri, size: 17 });
        const flip = g.toScreen(q, 0)[0] > g.width - 120;
        g.text('f(a+h) − f(a)', q, (fa + fq) / 2, { color: 'muted', offset: [flip ? -10 : 10, 0], align: flip ? 'right' : 'left', alpha: st.tri, size: 13 });
      }
    }
    if (st.secant > .01) g.slopeLine(a, fa, m, { color: 'c3', width: 2.2, alpha: st.secant });
    if (st.tangent > .01) g.slopeLine(a, fa, df(a), { color: 'c2', width: 2.6, alpha: st.tangent });
    g.point(a, fa, { color: 'c1', r: 6, ring: true, halo: true });
    g.text('P', a, fa, { offset: [-12, -16], color: 'ink', weight: 600, size: 15 });
    if (st.secant > .01) {
      g.point(q, fq, { color: 'c3', r: 6, ring: true });
      if (h() > .08) g.text('Q', q, fq, { offset: [12, -14], color: 'ink', weight: 600, size: 15 });
    }
    // The h table, top-left.
    if (st.table > .01) {
      const rows: [string, number][] = [['1', 1], ['0.1', .1], ['0.01', .01], ['0.001', .001]];
      const x0 = 30, y0 = 34;
      g.panelPx(16, 16, 176, 122, { alpha: .9 * st.table });
      g.textPx('h', x0, y0, { font: 'mono', size: 12, color: 'muted', alpha: st.table });
      g.textPx('secant slope', x0 + 64, y0, { font: 'mono', size: 12, color: 'muted', alpha: st.table });
      rows.forEach(([label, hv], i) => {
        const near = Math.abs(Math.log10(h()) - Math.log10(hv)) < .5;
        const slope = (f(st.a + hv) - f(st.a)) / hv;
        g.textPx(label, x0, y0 + 22 * (i + 1), { font: 'mono', size: 13, color: near ? 'c3' : 'ink', alpha: st.table * (near ? 1 : .75) });
        g.textPx(fmt(slope, 6), x0 + 64, y0 + 22 * (i + 1), { font: 'mono', size: 13, color: near ? 'c3' : 'ink', alpha: st.table * (near ? 1 : .75) });
      });
    }
  };

  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .7, ...vars, onUpdate: sync });
  s.onBeat(i => {
    if (i === 0) { to({ secant: 0, tangent: 0, tri: 0, table: 0 }); slider.set(0, .6); }
    if (i === 1) { to({ secant: 1, tri: 1, tangent: 0, table: 0, a: 2 }); slider.set(0, .6); }
    if (i === 2) { to({ secant: 1, tri: .6, tangent: 0, table: 1, a: 2 }); slider.set(-3, 2.6); }
    if (i === 3) { to({ secant: 1, tri: 0, tangent: 1, table: 1, a: 2 }); if (st.logH > -2) slider.set(-3, 1.2); }
    if (i === 4) { to({ secant: .5, tri: 0, tangent: 1, table: 0 }); slider.set(-.6, .8); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.4, ease: 'power2.inOut', onUpdate: sync });
  });
  st.draw = s.reduced ? 1 : 0;
  sync();
}
