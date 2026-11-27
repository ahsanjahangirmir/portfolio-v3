// Scene 06: what f′ and f″ say about shape. Three modes:
//  Shape: a cubic you reshape by dragging its two critical points (starts as 5 − 3x² + x³),
//         with sign charts for f′ (rising/falling) and f″ (concave up/down) and the inflection point.
//  MVT: x³ + x − 1 on [0, 2]: the tangent at c = 2/√3 is parallel to the secant (slope 5).
//  Optimize: fence 5000 ft² split into 3 pens: f(x) = 4x + 10000/x is least at x = 50.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Mode = 'shape' | 'mvt' | 'opt';

export default function mount(s: Scene) {
  const mk = (css: string) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:0;right:0;${css}`;
    s.stage.appendChild(d); s.cleanup(() => d.remove());
    return d;
  };
  const picHost = mk('top:0;height:40%;border-bottom:1px solid var(--line);display:none');
  const mainHost = mk('top:0;bottom:0');
  const plot = new Plot2D(s, { host: mainHost, x: [-1.6, 3.6], y: [-3.4, 8], labels: ['x', 'y'], pad: 8 });
  const pic = new Plot2D(s, { host: picHost, x: [-45, 265], y: [-34, 136], aspect: 'equal', axes: false, grid: false, pad: 8 });

  const st = {
    mode: 'shape' as Mode, fade: 1, draw: 0,
    p: 0, fp: 5, q: 2, fq: 1, inc: 0, crit: 0, conc: 0,
    a: 0, b: 2, side: 50, minOn: 0,
  };

  // Shape cubic: f′ = k(x − p)(x − q), pinned so f(p) = fp, f(q) = fq.
  const P = (x: number) => x ** 3 / 3 - (st.p + st.q) * x * x / 2 + st.p * st.q * x;
  const k = () => -6 * (st.fq - st.fp) / (st.q - st.p) ** 3;
  const C = () => st.fp - k() * P(st.p);
  const f = (x: number) => k() * P(x) + C();
  const d1 = (x: number) => k() * (x - st.p) * (x - st.q);
  const d2 = (x: number) => k() * (2 * x - st.p - st.q);
  // MVT cubic.
  const m = (x: number) => x ** 3 + x - 1;
  // Fence.
  const AREA = 5000;
  const fence = (x: number) => 4 * x + 2 * AREA / x;
  const dfence = (x: number) => 4 - 2 * AREA / (x * x);

  const out = {
    crit: s.readout('crit'), infl: s.readout('infl'),
    slope: s.readout('slope'), c: s.readout('c'),
    total: s.readout('total'), dtotal: s.readout('dtotal'),
  };

  const cs = () => {
    const sl = (m(st.b) - m(st.a)) / (st.b - st.a);
    const r = Math.sqrt(Math.max(0, (sl - 1) / 3));
    return { sl, cs: [-r, r].filter((c, i, arr) => c > st.a && c < st.b && arr.indexOf(c) === i) };
  };

  function sync() {
    if (st.mode === 'shape') {
      const kind = k() > 0 ? ['max', 'min'] : ['min', 'max'];
      out.crit(`${kind[0]} (${fmt(st.p, 2)}, ${fmt(st.fp, 2)}), ${kind[1]} (${fmt(st.q, 2)}, ${fmt(st.fq, 2)})`);
      const xi = (st.p + st.q) / 2;
      out.infl(`(${fmt(xi, 2)}, ${fmt(f(xi), 2)})`);
    } else if (st.mode === 'mvt') {
      const r = cs();
      out.slope(fmt(r.sl, 4)); out.c(r.cs.length ? r.cs.map(c => fmt(c, 4)).join(', ') : '—');
    } else {
      out.total(`${fmt(fence(st.side), 1)} ft`); out.dtotal(fmt(dfence(st.side), 3));
    }
    plot.invalidate(); pic.invalidate();
  }

  const groups = [...s.root.querySelectorAll<HTMLElement>('[data-mode]')];
  function setMode(md: Mode) {
    st.mode = md;
    groups.forEach(el => { el.style.display = el.dataset.mode === md ? 'contents' : 'none'; });
    picHost.style.display = md === 'opt' ? '' : 'none';
    mainHost.style.top = md === 'opt' ? '40%' : '0';
    plot.view = md === 'shape' ? { x0: -1.6, x1: 3.6, y0: -3.4, y1: 8 }
      : md === 'mvt' ? { x0: -1.5, x1: 2.6, y0: -4.5, y1: 10.5 }
      : { x0: -14, x1: 136, y0: -60, y1: 1150 };
    plot.opts.labels = md === 'opt' ? undefined : ['x', 'y'];
    st.fade = 0;
    s.tween(st, { fade: 1, duration: .5, onUpdate: sync });
    sync();
  }
  const mode = s.segmented('mode', v => setMode(v as Mode));
  const side = s.slider('side', v => { st.side = v; sync(); });
  s.action('shapeReset', () => s.tween(st, { p: 0, fp: 5, q: 2, fq: 1, duration: .8, ease: 'power2.inOut', onUpdate: sync }));

  // Shape handles: the two critical points.
  plot.handle({
    get: () => (st.mode === 'shape' ? [st.p, st.fp] : [NaN, NaN]),
    set: (x, y) => { st.p = num.clamp(x, -1.3, st.q - .5); st.fp = num.clamp(y, -2.5, 7.3); if (Math.abs(st.fp - st.fq) < .3) st.fp = st.fq + (st.fp >= st.fq ? .3 : -.3); sync(); },
  });
  plot.handle({
    get: () => (st.mode === 'shape' ? [st.q, st.fq] : [NaN, NaN]),
    set: (x, y) => { st.q = num.clamp(x, st.p + .5, 3.3); st.fq = num.clamp(y, -2.5, 7.3); if (Math.abs(st.fp - st.fq) < .3) st.fq = st.fp + (st.fq >= st.fp ? .3 : -.3); sync(); },
  });
  // MVT handles.
  plot.handle({ get: () => (st.mode === 'mvt' ? [st.a, m(st.a)] : [NaN, NaN]), set: x => { st.a = num.clamp(x, -1.3, st.b - .2); sync(); } });
  plot.handle({ get: () => (st.mode === 'mvt' ? [st.b, m(st.b)] : [NaN, NaN]), set: x => { st.b = num.clamp(x, st.a + .2, 2.2); sync(); } });
  // Optimization handles: on the graph and on the pen's corner.
  plot.handle({ get: () => (st.mode === 'opt' ? [st.side, fence(st.side)] : [NaN, NaN]), set: x => side.set(Math.round(num.clamp(x, 20, 125))) });
  pic.handle({ get: () => (st.mode === 'opt' ? [AREA / st.side, st.side] : [NaN, NaN]), set: (_x, y) => side.set(Math.round(num.clamp(y, 20, 125))) });

  plot.render = p => {
    p.ctx.globalAlpha = st.fade;
    if (st.mode === 'shape') drawShape(p);
    else if (st.mode === 'mvt') drawMvt(p);
    else drawOpt(p);
  };
  pic.render = p => { if (st.mode === 'opt') { p.ctx.globalAlpha = st.fade; drawPen(p); } };

  /** Colored runs along screen x where sign(fn) is constant. */
  function runs(p: Plot2D, fn: (x: number) => number) {
    const res: { a: number; b: number; sign: number }[] = [];
    for (let px = 0; px <= p.width; px += 2) {
      const [x] = p.toWorld(px, 0), sg = Math.sign(fn(x)) || 1;
      const last = res[res.length - 1];
      if (last && last.sign === sg) last.b = px + 2; else res.push({ a: px, b: px + 2, sign: sg });
    }
    return res;
  }

  function drawShape(p: Plot2D) {
    const H = p.height, rowH = 18, row1 = H - 50, row2 = H - 26;
    // Background tint: f′ sign, or f″ sign once concavity is on.
    const tint = st.conc > .5 ? d2 : d1, tintA = st.conc > .5 ? st.conc : st.inc;
    if (tintA > .01) for (const r of runs(p, tint)) {
      p.ctx.fillStyle = p.color(st.conc > .5 ? (r.sign > 0 ? 'c3' : 'c5') : (r.sign > 0 ? 'c1' : 'c4'), .06 * tintA);
      p.ctx.fillRect(r.a, 0, r.b - r.a, row1 - 8);
    }
    const xi = (st.p + st.q) / 2;
    if (st.conc > .01) p.slopeLine(xi, f(xi), d1(xi), { color: 'c5', width: 1.4, alpha: .5 * st.conc, dash: [6, 5] });
    p.fn(f, { color: 'c1', width: 3, progress: st.draw });
    if (st.draw < .98) return;
    // Sign charts.
    const chart = (y: number, fn: (x: number) => number, pos: string, neg: string, cp: 'c1' | 'c3', cn: 'c4' | 'c5', name: string, a: number) => {
      if (a < .01) return;
      p.panelPx(0, y - rowH / 2 - 3, p.width, rowH + 6, { alpha: .9 * a, border: false });
      for (const r of runs(p, fn)) {
        p.ctx.fillStyle = p.color(r.sign > 0 ? cp : cn, .5 * a);
        const x0 = Math.max(r.a, 30), x1 = Math.min(r.b, p.width);
        if (x1 <= x0) continue;
        p.ctx.fillRect(x0, y - rowH / 2, x1 - x0, rowH);
        if (x1 - x0 > 110) p.textPx(r.sign > 0 ? pos : neg, (x0 + x1) / 2, y, { size: 12, align: 'center', alpha: a, halo: false });
      }
      p.textPx(name, 8, y, { size: 13, font: 'serif', color: 'ink', alpha: a });
    };
    chart(row1, d1, '+  rising', '−  falling', 'c1', 'c4', 'f′', st.inc);
    chart(row2, d2, '+  concave up ∪', '−  concave down ∩', 'c3', 'c5', 'f″', st.conc);
    if (st.crit > .01) {
      const kinds = k() > 0 ? ['local max', 'local min'] : ['local min', 'local max'];
      for (const [x, y, label, up] of [[st.p, st.fp, kinds[0], k() > 0], [st.q, st.fq, kinds[1], k() < 0]] as const) {
        p.slopeLine(x, y, 0, { color: 'c2', width: 1.4, alpha: .6 * st.crit, span: .45 });
        p.line(x, y, x, p.toWorld(0, row1 - 10)[1], { color: 'c2', width: 1, dash: [3, 4], alpha: .6 * st.crit });
        p.text(`${label} (${fmt(x, 2)}, ${fmt(y, 2)})`, x, y, { color: 'c2', size: 13, offset: [0, up ? -20 : 22], align: 'center', alpha: st.crit });
      }
    }
    if (st.conc > .01) {
      p.point(xi, f(xi), { color: 'c5', r: 5.5, alpha: st.conc });
      p.text(`inflection (${fmt(xi, 2)}, ${fmt(f(xi), 2)})`, xi, f(xi), { color: 'c5', size: 13, offset: [10, k() > 0 ? 14 : -14], alpha: st.conc });
    }
    p.point(st.p, st.fp, { color: 'c2', r: 6.5, ring: true, halo: true });
    p.point(st.q, st.fq, { color: 'c2', r: 6.5, ring: true, halo: true });
  }

  function drawMvt(p: Plot2D) {
    const { sl, cs: c } = cs();
    const fa = m(st.a), fb = m(st.b);
    p.fn(m, { color: 'c1', width: 3 });
    p.slopeLine(st.a, fa, sl, { color: 'c3', width: 1.2, alpha: .35 });
    p.line(st.a, fa, st.b, fb, { color: 'c3', width: 2.6 });
    for (const x of c) {
      p.slopeLine(x, m(x), sl, { color: 'c2', width: 2.4 });
      p.line(x, 0, x, m(x), { color: 'muted', width: 1, dash: [3, 4] });
      p.point(x, m(x), { color: 'c2', r: 5.5 });
      p.text('c', x, 0, { color: 'c2', font: 'serif', size: 17, offset: [0, m(x) > 0 ? 14 : -14], align: 'center' });
    }
    for (const [x, y, n] of [[st.a, fa, 'a'], [st.b, fb, 'b']] as const) {
      p.line(x, 0, x, y, { color: 'c3', width: 1, dash: [3, 4] });
      p.point(x, y, { color: 'c3', r: 6.5, ring: true, halo: true });
      p.text(n, x, 0, { color: 'c3', font: 'serif', size: 17, offset: [0, y > 0 ? 14 : -14], align: 'center' });
    }
    p.textPx('f(x) = x³ + x − 1', 16, p.height - 46, { color: 'c1', size: 14 });
    p.textPx(`secant slope ${fmt(sl, 3)}  =  f′(c)`, 16, p.height - 24, { color: 'c3', size: 13, font: 'mono' });
  }

  function drawOpt(p: Plot2D) {
    const x = st.side, y = fence(x), sl = dfence(x);
    p.fn(fence, { color: 'c1', width: 3, from: 12 });
    if (st.minOn > .01) {
      p.line(50, 0, 50, 400, { color: 'c2', width: 1, dash: [3, 4], alpha: st.minOn });
      p.point(50, 400, { color: 'c2', r: 5, alpha: st.minOn });
      p.text('f′(50) = 0: minimum 400 ft', 50, 400, { color: 'c2', size: 13, offset: [0, 22], align: 'center', alpha: st.minOn });
    }
    p.slopeLine(x, y, sl, { color: 'c2', width: 2, alpha: .8, span: 22 });
    p.point(x, y, { color: 'c1', r: 6.5, ring: true, halo: true });
    p.textPx('fence length f(x) = 4x + 10000/x', 16, 22, { color: 'c1', size: 14 });
    p.textPx(`slope f′(x) = ${fmt(sl, 3)}`, 16, 42, { color: 'c2', size: 13, font: 'mono' });
    p.text('x (ft)', p.ex1, 0, { color: 'muted', size: 12, align: 'right', offset: [-6, -12] });
  }

  function drawPen(p: Plot2D) {
    const x = st.side, y = AREA / x;
    p.rect(0, 0, y, x, { color: 'c3', alpha: .14 });
    const fenceStyle = { color: 'c2', width: 3 } as const;
    p.line(0, 0, y, 0, fenceStyle); p.line(0, x, y, x, fenceStyle);
    for (let i = 0; i <= 3; i++) p.line(y * i / 3, 0, y * i / 3, x, fenceStyle);
    p.text('5000 ft²', y / 2, x / 2, { color: 'c3', size: 13, align: 'center' });
    p.text(`x = ${fmt(x, 0)}`, 0, x / 2, { color: 'ink', size: 13, offset: [-8, 0], align: 'right', font: 'mono' });
    p.text(`y = ${fmt(y, 1)}`, y / 2, 0, { color: 'ink', size: 13, offset: [0, 13], align: 'center', font: 'mono' });
    p.point(y, x, { color: 'c2', r: 6, ring: true, halo: true });
    p.textPx(`fence 2y + 4x = ${fmt(fence(x), 1)} ft`, p.width - 14, p.height - 16, { color: 'c2', size: 13, align: 'right' });
  }

  const to = (vars: gsap.TweenVars, d = .8) => s.tween(st, { overwrite: 'auto', duration: d, ease: 'power2.inOut', ...vars, onUpdate: sync });
  const dz = { p: 0, fp: 5, q: 2, fq: 1 };
  s.onBeat(i => {
    const want: Mode = i <= 3 ? 'shape' : i === 4 ? 'mvt' : 'opt';
    if (mode.get() !== want) mode.set(want);
    if (i === 0) to({ ...dz, inc: 1, crit: 0, conc: 0 });
    if (i === 1) to({ ...dz, inc: 1, crit: 1, conc: 0 });
    if (i === 2) to({ ...dz, inc: 1, crit: 1, conc: 1 });
    if (i === 3) to({ p: -.6, fp: 1.5, q: 2.4, fq: 6.2, inc: 1, crit: 1, conc: 1 }, 1.4);
    if (i === 4) {
      st.a = 0; st.b = 2; sync();
      if (!s.reduced) to({ b: 1.4 }, .8).then(() => to({ b: 2 }, 1));
    }
    if (i === 5) { st.minOn = 0; side.set(120); side.set(50, 2.4); s.tween(st, { minOn: 1, duration: .6, delay: 2.2, onUpdate: sync }); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.2, ease: 'power2.inOut', onUpdate: sync });
  });
  st.draw = s.reduced ? 1 : 0;
  setMode('shape');
  st.fade = 1;
}
