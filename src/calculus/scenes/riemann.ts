// Scene 07: area from thin rectangles. Σ(2i/n − (i/n)²)(1/n) → ∫₀¹ 2x − x² dx = 2/3,
// and ∫₂⁶ dx/x = ln 3 with M₈, T₈, S₈. Left/right/midpoint/trapezoid/Simpson, n from 1 to 200.
import { Plot2D } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Fn = { f: (x: number) => number; a: number; b: number; exact: number; exactText: string; view: [number, number, number, number]; name: string };
const FNS: Record<string, Fn> = {
  par: { f: x => 2 * x - x * x, a: 0, b: 1, exact: 2 / 3, exactText: '2/3', view: [-.12, 1.12, -.12, 1.18], name: 'y = 2x − x²' },
  inv: { f: x => 1 / x, a: 2, b: 6, exact: Math.log(3), exactText: 'ln 3', view: [1.4, 6.5, -.06, .62], name: 'y = 1/x' },
};
type Method = 'left' | 'right' | 'mid' | 'trap' | 'simp';
/** Small errors in scientific notation, with true minus signs. */
const sci = (v: number) => (Math.abs(v) < 1e-13 ? '0' : Math.abs(v) >= 1e-3 ? fmt(v, 5) : v.toExponential(2).replace(/-/g, '−'));

export default function mount(s: Scene) {
  const plot = new Plot2D(s, { x: [-.12, 1.12], y: [-.12, 1.18], labels: ['x', 'y'], pad: 8 });
  const st = { key: 'par', method: 'right' as Method, n: 4, fill: 0, draw: 0, shade: 1, err: 1, table: 0 };
  let F = FNS.par;

  const N = () => {
    const n = Math.max(1, Math.round(st.n));
    return st.method === 'simp' && n % 2 ? n + 1 : n;
  };
  function estimate(method: Method, n: number): number {
    const { f, a, b } = F, h = (b - a) / n;
    let sum = 0;
    if (method === 'simp') {
      if (n % 2) n++;
      const hh = (b - a) / n;
      sum = f(a) + f(b);
      for (let i = 1; i < n; i++) sum += f(a + i * hh) * (i % 2 ? 4 : 2);
      return sum * hh / 3;
    }
    for (let i = 0; i < n; i++) {
      const x0 = a + i * h, x1 = x0 + h;
      sum += method === 'left' ? f(x0) : method === 'right' ? f(x1) : method === 'mid' ? f((x0 + x1) / 2) : (f(x0) + f(x1)) / 2;
    }
    return sum * h;
  }

  const out = { est: s.readout('est'), exact: s.readout('exact'), err: s.readout('err') };
  const nOut = s.root.querySelector('output[data-for="n"]');
  function sync() {
    const n = N(), e = estimate(st.method, n);
    out.est(fmt(e, 7)); out.exact(`${F.exactText} = ${fmt(F.exact, 7)}`);
    const er = e - F.exact;
    out.err(sci(er));
    if (nOut) nOut.textContent = st.method === 'simp' && Math.round(st.n) % 2 ? `${n} (even)` : String(n);
    plot.invalidate();
  }

  const ns = s.slider('n', v => { st.n = v; sync(); });
  const method = s.segmented('method', v => { st.method = v as Method; sync(); });
  const fnSeg = s.segmented('fn', v => {
    st.key = v; F = FNS[v];
    const [x0, x1, y0, y1] = F.view;
    plot.view = { x0, x1, y0, y1 };
    sync();
  });

  let playing: gsap.core.Timeline | null = null;
  const playBtn = s.action('play', () => {
    if (playing) { stop(); return; }
    if (s.reduced) { ns.set(128); return; }
    playBtn?.setAttribute('aria-pressed', 'true');
    ns.set(1);
    const tl = s.timeline({ onComplete: stop });
    const proxy = { n: 1 };
    for (let k = 1; k <= 7; k++) tl.to(proxy, { n: 2 ** k, duration: .25, ease: 'none', onUpdate: () => ns.set(Math.round(proxy.n)) }, k * .9);
    playing = tl;
  });
  const stop = () => { playing?.kill(); playing = null; playBtn?.setAttribute('aria-pressed', 'false'); };
  s.action('double', () => { stop(); const n = Math.round(st.n); ns.set(n >= 200 ? 1 : Math.min(200, n * 2)); });

  // Drag the top of the first rectangle to set n by its width.
  plot.handle({
    get: () => { const h = (F.b - F.a) / N(); return [F.a + h, 0]; },
    set: x => { const w = Math.max(1e-6, x - F.a); ns.set(Math.round(Math.min(200, Math.max(1, (F.b - F.a) / w)))); },
    radius: 14,
  });

  plot.render = p => {
    const { f, a, b } = F, n = N(), h = (b - a) / n;
    const k = st.fill;
    // Exact area, faint.
    p.area(f, a, b, { color: 'c3', alpha: .1 * st.shade });
    const thin = n > 60;
    const strokeA = thin ? .25 : .9;
    const showErr = st.err > .01 && n <= 100;
    const count = Math.ceil(n * k);
    if (st.method === 'simp') {
      for (let i = 0; i < n && i < count; i += 2) {
        const x0 = a + i * h, x1 = x0 + h, x2 = x1 + h, y0 = f(x0), y1 = f(x1), y2 = f(x2);
        // Parabola through the three points (Lagrange form).
        const q = (x: number) => y0 * (x - x1) * (x - x2) / ((x0 - x1) * (x0 - x2)) + y1 * (x - x0) * (x - x2) / ((x1 - x0) * (x1 - x2)) + y2 * (x - x0) * (x - x1) / ((x2 - x0) * (x2 - x1));
        p.area(q, x0, x2, { color: 'c3', alpha: .38, stroke: 'c3', strokeWidth: 1, strokeAlpha: strokeA * .7, samples: 24 });
        if (showErr) p.area(f, x0, x2, { bottom: q, color: 'c4', alpha: .7 * st.err, samples: 24 });
        if (!thin) p.point(x1, y1, { color: 'c2', r: 3 });
      }
    } else {
      for (let i = 0; i < n && i < count; i++) {
        const x0 = a + i * h, x1 = x0 + h;
        if (st.method === 'trap') {
          p.poly([[x0, 0], [x0, f(x0)], [x1, f(x1)], [x1, 0]], { color: 'c3', alpha: .38, stroke: 'c3', strokeWidth: 1, strokeAlpha: strokeA });
          if (showErr) p.area(f, x0, x1, { bottom: x => f(x0) + (f(x1) - f(x0)) * (x - x0) / h, color: 'c4', alpha: .7 * st.err, samples: 16 });
        } else {
          const xs = st.method === 'left' ? x0 : st.method === 'right' ? x1 : (x0 + x1) / 2, y = f(xs);
          p.rect(x0, 0, h, y, { color: 'c3', alpha: .38, stroke: 'c3', strokeWidth: 1, strokeAlpha: strokeA });
          if (showErr) p.area(f, x0, x1, { bottom: () => y, color: 'c4', alpha: .7 * st.err, samples: 16 });
          if (!thin) p.point(xs, y, { color: 'c2', r: 3.2 });
        }
      }
    }
    p.fn(f, { color: 'c1', width: 3, progress: st.draw, from: F.view[0] + .02 });
    p.vline(a, { alpha: .6 }); p.vline(b, { alpha: .6 });
    // Handle: the right edge of the first strip.
    p.point(a + h, 0, { color: 'c2', r: 5.5, ring: true, halo: true });
    p.textPx(F.name, p.width - 16, p.height - 22, { color: 'c1', size: 14, align: 'right' });

    // Error table: what doubling n does to the error.
    if (st.table > .01) {
      const rows = [4, 8, 16, 32, 64];
      const errs = rows.map(r => estimate(st.method, r) - F.exact);
      const x0 = 26, y0 = 32, A = st.table;
      p.panelPx(14, 14, 206, 32 + rows.length * 19, { alpha: .92 * A });
      p.textPx('n', x0, y0, { font: 'mono', size: 12, color: 'muted', alpha: A });
      p.textPx('error', x0 + 34, y0, { font: 'mono', size: 12, color: 'muted', alpha: A });
      p.textPx('ratio', x0 + 136, y0, { font: 'mono', size: 12, color: 'muted', alpha: A });
      rows.forEach((r, i) => {
        const near = N() === r;
        const y = y0 + 19 * (i + 1);
        const e = errs[i];
        p.textPx(String(r), x0, y, { font: 'mono', size: 12, color: near ? 'c2' : 'ink', alpha: A });
        p.textPx(sci(e), x0 + 34, y, { font: 'mono', size: 12, color: near ? 'c4' : 'ink', alpha: A });
        if (i && Math.abs(errs[i]) > 1e-15) p.textPx(fmt(errs[i - 1] / errs[i], 2), x0 + 136, y, { font: 'mono', size: 12, color: 'muted', alpha: A });
      });
    }
  };

  const to = (vars: gsap.TweenVars) => s.tween(st, { overwrite: 'auto', duration: .8, ...vars, onUpdate: sync });
  const setFn = (key: string) => { if (fnSeg.get() !== key) fnSeg.set(key); };
  const setMethod = (m: Method) => { if (method.get() !== m) method.set(m); };
  s.onBeat(i => {
    stop();
    if (i === 0) { setFn('par'); setMethod('right'); ns.set(4); to({ fill: 0, shade: 1, err: 0, table: 0 }); }
    if (i === 1) { setFn('par'); setMethod('right'); ns.set(4); st.fill = 0; to({ fill: 1, shade: .6, err: 1, table: 0, duration: 1.2, ease: 'power2.inOut' }); }
    if (i === 2) { setFn('par'); setMethod('right'); to({ fill: 1, err: 1, table: 1 }); ns.set(4); ns.set(64, s.reduced ? false : 3); }
    if (i === 3) { setFn('inv'); setMethod('mid'); to({ fill: 1, err: 1, table: 1 }); ns.set(8); }
    if (i === 4) { setFn('inv'); setMethod('simp'); to({ fill: 1, err: 1, table: 1 }); ns.set(8); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.2, ease: 'power2.inOut', onUpdate: sync });
  });
  st.draw = s.reduced ? 1 : 0;
  st.fill = 1;
  sync();
}
