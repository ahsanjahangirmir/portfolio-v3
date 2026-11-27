// Scene 02: what a limit promises. Three modes:
//  ε–δ: f(x) = (x²+5x+4)/(x²+3x−4) has a hole at x = −4, limit 3/5. Pick ε, get the largest δ.
//  Squeeze: √(x³+x²)·sin(π/x) trapped between ±√(x³+x²); and cos x ≤ sin x / x ≤ 1.
//  IVT: x³ − 2x − 1 on [1, 2]; halve the interval; a jump breaks the guarantee.
import { Plot2D, num, type View } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Mode = 'eps' | 'squeeze' | 'ivt';

export default function mount(s: Scene) {
  const plot = new Plot2D(s, { x: [-9.6, -.35], y: [-.35, 1.25], labels: ['x', 'y'], pad: 8 });

  // ε–δ function and its hole.
  const A = -4, L = 3 / 5;
  const f = (x: number) => (x * x + 5 * x + 4) / (x * x + 3 * x - 4);
  // f = 1 + 2/(x−1) away from the hole; it is decreasing, so the band edges are hit at closed-form points.
  const leftExit = (e: number) => 1 + 2 / (L + e - 1); // where f = L + ε (left of a)
  const rightExit = (e: number) => 1 + 2 / (L - e - 1); // where f = L − ε (right of a)

  // Squeeze functions.
  const env = (x: number) => Math.sqrt(Math.max(0, x ** 3 + x * x));
  const wig = (x: number) => (x < -1 || x === 0 ? NaN : env(x) * Math.sin(Math.PI / x));
  const sinc = (x: number) => (x === 0 ? NaN : Math.sin(x) / x);

  // IVT function, with an optional jump of size J at x = 1.5.
  const JX = 1.5, JMAX = 2.5;
  const g0 = (x: number) => x ** 3 - 2 * x - 1;

  const st = {
    mode: 'eps' as Mode, fade: 1, draw: 0,
    eps: .25, epsOn: 0, deltaOn: 0, probe: 0, probeD: 4,
    z: 0, sq: 'wiggle',
    a: 1, b: 2, N: 0, J: 0, ivtOn: 1,
  };
  const g = (x: number) => g0(x) + (x >= JX ? st.J : 0);

  const out = { delta: s.readout('delta'), bound: s.readout('bound'), c: s.readout('c'), fab: s.readout('fab') };
  const zoomOut = s.root.querySelector('output[data-for="zoom"]');

  const views: Record<Mode, () => View> = {
    eps: () => ({ x0: -9.6, x1: -.35, y0: -.35, y1: 1.25 }),
    squeeze: () => {
      if (st.sq === 'wiggle') {
        const w = 10 ** -st.z, h = 1.25 * env(w) + .02 * w;
        return { x0: -w, x1: w, y0: -h, y1: h };
      }
      const w = 1.5 * 10 ** -st.z, gap = 1 - Math.cos(w);
      return { x0: -w, x1: w, y0: 1 - gap * 1.35 - .05 * w, y1: 1 + gap * .55 + .05 * w };
    },
    ivt: () => ({ x0: -.25, x1: 2.35, y0: -3, y1: 4.6 }),
  };

  const delta = () => Math.min(A - leftExit(st.eps), rightExit(st.eps) - A);

  /** Crossings of g = N on [a, b], skipping the jump. */
  function crossings(): number[] {
    const res: number[] = [];
    const lo = Math.min(st.a, st.b), hi = Math.max(st.a, st.b), n = 400;
    let px = lo, pv = g(lo) - st.N;
    for (let i = 1; i <= n; i++) {
      const x = lo + (hi - lo) * i / n, v = g(x) - st.N;
      const straddlesJump = st.J > 1e-6 && px < JX && x >= JX;
      if (pv === 0) res.push(px);
      else if (pv * v < 0 && !straddlesJump) {
        let l = px, r = x;
        for (let k = 0; k < 50; k++) { const m = (l + r) / 2; if ((g(m) - st.N) * (g(l) - st.N) <= 0) r = m; else l = m; }
        res.push((l + r) / 2);
      }
      px = x; pv = v;
    }
    return res;
  }

  function sync() {
    plot.view = views[st.mode]();
    if (st.mode === 'eps') out.delta(fmt(delta(), 4));
    if (st.mode === 'squeeze') {
      const w = (st.sq === 'wiggle' ? 1 : 1.5) * 10 ** -st.z;
      out.bound(st.sq === 'wiggle' ? `±${fmt(env(w), 6)}` : `${fmt(Math.cos(w), 6)} to 1`);
      if (zoomOut) zoomOut.textContent = `×${fmt(10 ** st.z, 0)}`;
    }
    if (st.mode === 'ivt') {
      const fa = g(st.a), fb = g(st.b);
      out.fab(`${fmt(fa, 3)}, ${fmt(fb, 3)}`);
      const cs = crossings();
      const promised = (fa - st.N) * (fb - st.N) < 0 && st.J < 1e-6;
      out.c(cs.length ? cs.map(c => fmt(c, 4)).join(', ') : promised ? '—' : 'none');
    }
    plot.invalidate();
  }

  // Controls.
  const groups = [...s.root.querySelectorAll<HTMLElement>('[data-mode]')];
  function setMode(m: Mode) {
    st.mode = m;
    groups.forEach(el => { el.style.display = el.dataset.mode === m ? 'contents' : 'none'; });
    plot.opts.labels = ['x', 'y'];
    st.fade = 0;
    s.tween(st, { fade: 1, duration: .5, onUpdate: () => plot.invalidate() });
    sync();
  }
  const mode = s.segmented('mode', v => setMode(v as Mode));
  const sq = s.segmented('sq', v => { st.sq = v; zoom.set(0); sync(); });
  const jump = s.segmented('jump', v => { s.tween(st, { J: v === 'jump' ? JMAX : 0, duration: .8, ease: 'power2.inOut', onUpdate: sync }); });
  const eps = s.slider('eps', v => { st.eps = v; sync(); });
  const zoom = s.slider('zoom', v => { st.z = v; sync(); });
  const level = s.slider('N', v => { st.N = v; sync(); });
  s.action('halve', () => {
    const fa = g(st.a) - st.N, m = (st.a + st.b) / 2, fm = g(m) - st.N;
    if (fa * (g(st.b) - st.N) > 0) return;
    const to = fa * fm <= 0 ? { b: m } : { a: m };
    s.tween(st, { ...to, duration: .6, ease: 'power2.inOut', onUpdate: sync });
  });
  s.action('ivtReset', () => { s.tween(st, { a: 1, b: 2, duration: .6, ease: 'power2.inOut', onUpdate: sync }); level.set(0, .6); });

  // Handles.
  plot.handle({ // ε band edge
    get: () => (st.mode === 'eps' && st.epsOn > .5 ? [-7.2, L + st.eps] : [NaN, NaN]),
    set: (_x, y) => eps.set(num.clamp(Math.abs(y - L), .02, .35)),
  });
  plot.handle({
    get: () => (st.mode === 'ivt' ? [st.a, g(st.a)] : [NaN, NaN]),
    set: x => { st.a = num.clamp(x, -.15, st.b - .02); sync(); },
  });
  plot.handle({
    get: () => (st.mode === 'ivt' ? [st.b, g(st.b)] : [NaN, NaN]),
    set: x => { st.b = num.clamp(x, st.a + .02, 2.25); sync(); },
  });
  plot.handle({
    get: () => (st.mode === 'ivt' ? [-.1, st.N] : [NaN, NaN]),
    set: (_x, y) => level.set(num.clamp(y, -2.5, 3.5)),
  });

  plot.render = p => {
    p.ctx.globalAlpha = st.fade;
    if (st.mode === 'eps') drawEps(p);
    else if (st.mode === 'squeeze') drawSqueeze(p);
    else drawIvt(p);
  };

  function drawEps(p: Plot2D) {
    const e = st.eps, d = delta();
    const xl = leftExit(e), xr = rightExit(e);
    if (st.epsOn > .01) {
      p.rect(p.ex0, L - e, p.ex1 - p.ex0, 2 * e, { color: 'c2', alpha: .13 * st.epsOn });
      p.hline(L + e, { color: 'c2', alpha: st.epsOn, dash: [6, 5], width: 1.4 });
      p.hline(L - e, { color: 'c2', alpha: st.epsOn, dash: [6, 5], width: 1.4 });
    }
    if (st.deltaOn > .01) {
      p.rect(A - d, p.ey0, 2 * d, p.ey1 - p.ey0, { color: 'c3', alpha: .13 * st.deltaOn });
      p.vline(A - d, { color: 'c3', alpha: st.deltaOn, dash: [6, 5], width: 1.4 });
      p.vline(A + d, { color: 'c3', alpha: st.deltaOn, dash: [6, 5], width: 1.4 });
    }
    // Guides to the hole.
    p.line(A, p.ey0, A, L, { color: 'muted', width: 1, dash: [3, 4], alpha: .8 });
    p.line(p.ex0, L, A, L, { color: 'muted', width: 1, dash: [3, 4], alpha: .8 });
    p.fn(f, { color: 'c1', width: 2.6, alpha: 1 - .55 * st.deltaOn, progress: st.draw });
    if (st.deltaOn > .01) p.fn(f, { color: 'c1', width: 4.2, from: A - d, to: A + d, alpha: st.deltaOn });
    p.point(A, L, { color: 'c1', r: 5.5, ring: true });
    p.text('x = −4', A, p.ey0, { color: 'muted', offset: [6, -12], size: 12, font: 'mono' });
    p.text('L = 3/5', -1.6, L, { color: 'ink', offset: [0, -12], size: 13, font: 'mono', align: 'center' });

    if (st.epsOn > .01) {
      // ε brace on the left, the drag handle on the band edge.
      const bx = -7.2;
      p.arrow(bx, L, bx, L + e, { color: 'c2', width: 1.6, head: 7, alpha: st.epsOn });
      p.arrow(bx, L, bx, L - e, { color: 'c2', width: 1.6, head: 7, alpha: st.epsOn });
      p.text('ε', bx, L + e / 2, { color: 'c2', font: 'serif', size: 18, offset: [10, 0], alpha: st.epsOn });
      p.point(bx, L + e, { color: 'c2', r: 6, ring: true, halo: true, alpha: st.epsOn });
    }
    if (st.deltaOn > .01) {
      const yb = p.ey0 + (p.ey1 - p.ey0) * .1;
      p.arrow(A, yb, A + d, yb, { color: 'c3', width: 1.6, head: 7, alpha: st.deltaOn });
      p.arrow(A, yb, A - d, yb, { color: 'c3', width: 1.6, head: 7, alpha: st.deltaOn });
      p.text('δ', A + d / 2, yb, { color: 'c3', font: 'serif', size: 18, offset: [0, -12], align: 'center', alpha: st.deltaOn });
      // The side that decides δ: where the curve leaves the band first.
      const right = xr - A < A - xl;
      const ex = right ? xr : xl, ey = right ? L - e : L + e;
      p.point(ex, ey, { color: 'c2', r: 4.5, alpha: st.deltaOn });
      const nearEdge = p.toScreen(ex, ey)[0] > p.width - 130;
      p.text('leaves the band first', ex, ey, { color: 'c2', size: 12, offset: right && !nearEdge ? [8, 14] : [-8, right ? 16 : -14], align: right && !nearEdge ? 'left' : 'right', alpha: st.deltaOn });
    }
    if (st.probe > .01) {
      const dd = st.probeD;
      for (const sgn of [-1, 1]) {
        const x = A + sgn * dd, y = f(x);
        p.point(x, y, { color: 'c2', r: 5, alpha: st.probe });
        p.text(`f(${fmt(x, 3)}) = ${fmt(y, 4)}`, x, y, { color: 'ink', size: 12, font: 'mono', offset: sgn < 0 ? [-10, -16] : [10, 18], align: sgn < 0 ? 'right' : 'left', alpha: st.probe });
      }
    }
  }

  function drawSqueeze(p: Plot2D) {
    if (st.sq === 'wiggle') {
      p.area(env, Math.max(-1, p.ex0), p.ex1, { color: 'c3', alpha: .1, bottom: x => -env(x), samples: 300 });
      p.fn(env, { color: 'c3', width: 2, from: -1 });
      p.fn(x => -env(x), { color: 'c3', width: 2, from: -1 });
      p.fn(wig, { color: 'c1', width: 1.6, samples: 4000 });
      p.point(0, 0, { color: 'c2', r: 5.5, ring: true, halo: true });
      const xr = p.ex1 - (p.ex1 - p.ex0) * .03;
      p.text('√(x³+x²)', xr, env(xr), { color: 'c3', size: 13, align: 'right', offset: [0, -14] });
      p.text('−√(x³+x²)', xr, -env(xr), { color: 'c3', size: 13, align: 'right', offset: [0, 14] });
      p.textPx('√(x³+x²) · sin(π/x)', 18, 26, { color: 'c1', size: 14 });
    } else {
      const lo = p.ex0, hi = p.ex1;
      p.area(() => 1, lo, hi, { color: 'c3', alpha: .1, bottom: Math.cos, samples: 200 });
      p.hline(1, { color: 'c3', width: 2, dash: [] });
      p.fn(Math.cos, { color: 'c3', width: 2 });
      p.fn(sinc, { color: 'c1', width: 2.6 });
      p.point(0, 1, { color: 'c2', r: 5.5, ring: true, halo: true });
      const xr = hi - (hi - lo) * .04;
      p.text('1', xr, 1, { color: 'c3', size: 14, align: 'right', offset: [0, -12] });
      p.text('cos x', xr, Math.cos(xr), { color: 'c3', size: 13, align: 'right', offset: [0, 14] });
      const xm = lo + (hi - lo) * .2;
      p.text('sin x / x', xm, sinc(xm), { color: 'c1', size: 14, offset: [0, -14], align: 'center' });
    }
  }

  function drawIvt(p: Plot2D) {
    const a = st.a, b = st.b, fa = g(a), fb = g(b), N = st.N;
    p.rect(a, p.ey0, b - a, p.ey1 - p.ey0, { color: 'c3', alpha: .08 });
    p.hline(N, { color: 'c2', width: 1.8, dash: [], alpha: .9 });
    p.text('y = N', -.1, N, { color: 'c2', size: 13, offset: [12, -13] });
    p.point(-.1, N, { color: 'c2', r: 5.5, ring: true });
    // The curve: two pieces when there is a jump.
    if (st.J > 1e-4) {
      p.fn(g0, { color: 'c1', width: 2.8, to: JX - 1e-9, progress: 1 });
      p.fn(x => g0(x) + st.J, { color: 'c1', width: 2.8, from: JX });
      p.point(JX, g0(JX), { color: 'c1', r: 4.5, ring: true });
      p.point(JX, g0(JX) + st.J, { color: 'c1', r: 4.5 });
    } else p.fn(g0, { color: 'c1', width: 2.8, progress: st.draw });
    for (const [x, y, name] of [[a, fa, 'a'], [b, fb, 'b']] as const) {
      p.line(x, 0, x, y, { color: 'c3', width: 1.2, dash: [4, 4] });
      p.point(x, y, { color: 'c3', r: 6, ring: true, halo: true });
      p.text(name, x, 0, { color: 'c3', font: 'serif', size: 17, offset: [0, y > 0 ? 14 : -14], align: 'center' });
      p.text(`f(${name}) = ${fmt(y, 3)}`, x, y, { color: 'ink', size: 12, font: 'mono', offset: [name === 'a' ? -10 : 10, y > N ? -16 : 16], align: name === 'a' ? 'right' : 'left' });
    }
    const cs = crossings();
    const opposite = (fa - N) * (fb - N) < 0;
    for (const c of cs) {
      p.line(c, 0, c, N, { color: 'c2', width: 1.2, dash: [2, 4] });
      p.point(c, N, { color: 'c2', r: 5.5 });
    }
    if (cs.length) p.text('c', cs[0], N, { color: 'c2', font: 'serif', size: 17, offset: [-10, -14], align: 'center' });
    const msg = opposite
      ? (cs.length ? 'f(a) and f(b) straddle N, so f crosses N' : 'they straddle N, but the jump skips it: no c')
      : 'f(a), f(b) on the same side: no promise';
    p.textPx(msg, 18, p.height - 22, { color: opposite && !cs.length ? 'c4' : 'muted', size: 13 });
  }

  const to = (vars: gsap.TweenVars) => s.tween(st, { overwrite: 'auto', duration: .8, ...vars, onUpdate: sync });
  let probeTween: gsap.core.Tween | null = null;
  s.onBeat(i => {
    probeTween?.kill();
    if (i <= 2 && mode.get() !== 'eps') mode.set('eps');
    if (i === 0) {
      to({ epsOn: 0, deltaOn: 0, probe: 1 });
      st.probeD = 4;
      probeTween = s.tween(st, { probeD: .1, duration: 3.2, delay: .4, ease: 'power2.inOut', onUpdate: sync });
    }
    if (i === 1) { to({ epsOn: 1, deltaOn: 0, probe: 0 }); eps.set(.25, .8); }
    if (i === 2) {
      to({ epsOn: 1, deltaOn: 1, probe: 0 });
      eps.set(.25, .4);
      s.tween({}, { duration: .9, onComplete: () => { if (st.mode === 'eps') eps.set(.04, 2.6); } });
    }
    if (i === 3) { mode.set('squeeze'); sq.set('wiggle'); zoom.set(0); zoom.set(1.2, 3); }
    if (i === 4) { mode.set('squeeze'); sq.set('sinc'); zoom.set(0); zoom.set(1.5, 3); }
    if (i === 5) {
      mode.set('ivt'); jump.set('cont'); st.J = 0; st.a = 1; st.b = 2; level.set(0); sync();
    }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.3, ease: 'power2.inOut', onUpdate: sync });
  });
  st.draw = s.reduced ? 1 : 0;
  setMode('eps');
  st.fade = 1;
}
