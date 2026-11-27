// Scene 05: zoom in until it's a line. f(x) = √(1−x), a = −3, L(x) = 2 − (x+3)/4,
// f(−4) ≈ 9/4. The error f − L shrinks like h². Second mode: Newton's method, x³ − x² − 1, x₁ = 1.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).split('').map(d => SUB[+d]).join('');

export default function mount(s: Scene) {
  const plot = new Plot2D(s, { x: [-7, 1], y: [-.6, 4.6], aspect: 'equal', pad: 8 });

  // Linear approximation.
  const A = -3, FA = 2, M = -1 / 4;
  const f = (x: number) => (x <= 1 ? Math.sqrt(1 - x) : NaN);
  const L = (x: number) => FA + M * (x - A);
  // Newton.
  const g = (x: number) => x ** 3 - x * x - 1, dg = (x: number) => 3 * x * x - 2 * x;
  let root = 1.5;
  for (let i = 0; i < 60; i++) root -= g(root) / dg(root);

  const st = { mode: 'zoom', z: 0, hf: -.25, probe: 0, draw: 0, fade: 1, x1: 1, shown: 0, table: 1 };
  let iters: number[] = [];
  const recompute = () => {
    iters = [st.x1];
    for (let i = 0; i < 7; i++) {
      const x = iters[i], d = dg(x);
      if (!Number.isFinite(x) || Math.abs(d) < 1e-9) break;
      iters.push(x - g(x) / d);
    }
  };
  recompute();

  const out = { win: s.readout('win'), err: s.readout('err'), ratio: s.readout('ratio'), xn: s.readout('xn'), fxn: s.readout('fxn') };
  const zoomOut = s.root.querySelector('output[data-for="zoom"]');
  const w = () => 4 * 10 ** -st.z;
  const h = () => st.hf * w();

  function sync() {
    if (st.mode === 'zoom') {
      const W = w(), hh = h(), e = L(A + hh) - f(A + hh);
      plot.view = { x0: A - W, x1: A + W, y0: FA - W * .65, y1: FA + W * .65 };
      out.win(`±${fmt(W, 4)}`);
      out.err(st.probe > .5 ? e.toPrecision(3).replace('-', '−') : '—');
      out.ratio(st.probe > .5 ? fmt(e / (hh * hh), 5) : '—');
      if (zoomOut) zoomOut.textContent = `×${fmt(10 ** st.z, 0)}`;
    } else {
      plot.view = { x0: .25, x1: 2.45, y0: -1.9, y1: 4 };
      const k = Math.min(Math.floor(st.shown + 1e-6), iters.length - 1);
      out.xn(`x${sub(k + 1)} = ${fmt(iters[k], 6)}`);
      out.fxn(fmt(g(iters[k]), 6));
    }
    plot.invalidate();
  }

  const groups = [...s.root.querySelectorAll<HTMLElement>('[data-mode]')];
  let playing: gsap.core.Timeline | null = null;
  const stop = () => { playing?.kill(); playing = null; plot.animate = false; playBtn?.setAttribute('aria-pressed', 'false'); };
  function setMode(m: string) {
    stop();
    st.mode = m;
    groups.forEach(el => { el.style.display = el.dataset.mode === m ? 'contents' : 'none'; });
    plot.opts.aspect = m === 'zoom' ? 'equal' : 'fill';
    st.fade = 0;
    s.tween(st, { fade: 1, duration: .5, onUpdate: sync });
    sync();
  }
  const mode = s.segmented('mode', setMode);
  const zoom = s.slider('zoom', v => { st.z = v; sync(); });

  const step = (dur = .9) => {
    const target = Math.floor(st.shown + 1e-6) + 1;
    if (target > iters.length - 1) return null;
    return s.tween(st, { shown: target, duration: dur, ease: 'power2.inOut', onUpdate: sync });
  };
  s.action('step', () => { stop(); if (st.shown % 1 > 1e-6) st.shown = Math.ceil(st.shown); step(); });
  const playBtn = s.action('play', () => {
    if (playing) { stop(); return; }
    if (s.reduced) { st.shown = Math.min(5, iters.length - 1); sync(); return; }
    if (st.shown >= iters.length - 1.001) st.shown = 0;
    st.shown = Math.floor(st.shown);
    playBtn?.setAttribute('aria-pressed', 'true');
    const tl = s.timeline({ onComplete: stop });
    const left = Math.min(5, iters.length - 1) - st.shown;
    for (let i = 0; i < left; i++) tl.to(st, { shown: st.shown + i + 1, duration: .9, ease: 'power2.inOut', onUpdate: sync }, i * 1.15);
    playing = tl;
  });
  s.action('reset', () => { stop(); st.x1 = 1; recompute(); s.tween(st, { shown: 0, duration: .4, onUpdate: sync }); });

  plot.handle({ // probe point on the curve
    get: () => (st.mode === 'zoom' && st.probe > .5 ? [A + h(), f(A + h())] : [NaN, NaN]),
    set: x => { let hf = (x - A) / w(); hf = num.clamp(hf, -.92, .92); if (Math.abs(hf) < .04) hf = hf < 0 ? -.04 : .04; st.hf = hf; sync(); },
  });
  plot.handle({ // Newton starting point on the x-axis
    get: () => (st.mode === 'newton' ? [st.x1, 0] : [NaN, NaN]),
    set: x => { stop(); st.x1 = num.clamp(x, .3, 2.4); st.shown = 0; recompute(); sync(); },
  });

  plot.render = p => {
    p.ctx.globalAlpha = st.fade;
    if (st.mode === 'zoom') drawZoom(p); else drawNewton(p);
  };

  function drawZoom(p: Plot2D) {
    const x = A + h(), fx = f(x), lx = L(x);
    p.slopeLine(A, FA, M, { color: 'c2', width: 2.4, alpha: Math.min(1, st.draw * 2) });
    p.fn(f, { color: 'c1', width: 3, progress: st.draw });
    if (st.draw < .98) return;
    const W = w();
    // Curve labels at the right edge of the window.
    const xl = A + W * .62;
    p.text('f(x) = √(1−x)', xl, f(xl), { color: 'c1', size: 14, offset: [0, 18], align: 'center' });
    p.text('L(x)', A - W * .7, L(A - W * .7), { color: 'c2', size: 15, offset: [0, -16], align: 'center', font: 'serif' });
    if (st.probe > .01) {
      p.vline(x, { alpha: .6 * st.probe });
      p.line(x, fx, x, lx, { color: 'c4', width: 4, alpha: st.probe });
      p.point(x, fx, { color: 'c1', r: 6, ring: true, halo: true, alpha: st.probe });
      p.point(x, lx, { color: 'c2', r: 4.5, alpha: st.probe });
      p.text('error', x, (fx + lx) / 2, { color: 'c4', size: 13, offset: [10, 0], alpha: st.probe });
      p.line(A, FA - W * .45, x, FA - W * .45, { color: 'muted', width: 1.2, alpha: st.probe });
      p.text('h', (A + x) / 2, FA - W * .45, { color: 'muted', font: 'serif', size: 16, offset: [0, 12], align: 'center', alpha: st.probe });
      // The numbers.
      const hh = h(), e = lx - fx;
      const rows: [string, string, string][] = [
        ['a + h', fmt(x, 6), 'ink'], ['f(a + h)', fmt(fx, 7), 'c1'], ['L(a + h)', fmt(lx, 7), 'c2'],
        ['error', e.toPrecision(4).replace('-', '−'), 'c4'], ['error / h²', fmt(e / (hh * hh), 5), 'c4'],
      ];
      p.panelPx(14, 14, 214, 22 + rows.length * 19, { alpha: .92 * st.probe });
      rows.forEach(([k, v, c], i) => {
        p.textPx(k, 24, 30 + i * 19, { font: 'mono', size: 12, color: 'muted', alpha: st.probe });
        p.textPx(v, 120, 30 + i * 19, { font: 'mono', size: 12, color: c, alpha: st.probe });
      });
    }
    p.point(A, FA, { color: 'c2', r: 5.5 });
    p.text('(−3, 2)', A, FA, { color: 'ink', size: 12, font: 'mono', offset: [10, -14] });
  }

  function drawNewton(p: Plot2D) {
    p.fn(g, { color: 'c1', width: 3 });
    p.point(root, 0, { color: 'c1', r: 4, alpha: .8 });
    p.text('f(x) = x³ − x² − 1', 1.95, g(1.95), { color: 'c1', size: 14, offset: [-12, 0], align: 'right' });
    const done = Math.floor(st.shown + 1e-6), t = st.shown - done;
    for (let i = 0; i <= Math.min(done, iters.length - 1); i++) {
      const x = iters[i];
      const fade = i < done ? .45 : 1;
      p.line(x, 0, x, g(x), { color: 'muted', width: 1.2, dash: [3, 4], alpha: fade });
      p.point(x, g(x), { color: 'c2', r: 4.5, alpha: fade });
      p.point(x, 0, { color: 'c3', r: i === done ? 6 : 4.5, ring: i === done, alpha: i === done ? 1 : .7 });
      if (i >= done - 1 && (i === 0 || Math.abs(iters[i] - iters[i - 1]) > .04)) {
        p.text(`x${sub(i + 1)}`, x, 0, { color: 'c3', size: 14, offset: [-7, -13], align: 'right' });
      }
      if (i < done && i + 1 < iters.length) p.line(x, g(x), iters[i + 1], 0, { color: 'c2', width: 1.6, alpha: .45 });
    }
    // The step in progress: tangent at x_n slides down to the axis, then up to the curve.
    if (t > 1e-3 && done + 1 < iters.length) {
      const x = iters[done], y = g(x), X = iters[done + 1];
      p.slopeLine(x, y, dg(x), { color: 'c2', width: 1.4, alpha: .35 });
      const a = Math.min(1, t / .55);
      p.line(x, y, x + (X - x) * a, y * (1 - a), { color: 'c2', width: 2.6 });
      if (t > .55) {
        const b = (t - .55) / .45;
        p.line(X, 0, X, g(X) * b, { color: 'muted', width: 1.2, dash: [3, 4] });
        p.point(X, 0, { color: 'c3', r: 5.5 });
      }
    } else if (done < iters.length - 1) {
      const x = iters[done];
      p.slopeLine(x, g(x), dg(x), { color: 'c2', width: 1.4, alpha: .35 });
    }
    // Table of iterates.
    const n = Math.min(done + 1, iters.length);
    p.panelPx(14, 14, 210, 26 + n * 19);
    p.textPx('n', 24, 30, { font: 'mono', size: 12, color: 'muted' });
    p.textPx('xₙ', 56, 30, { font: 'mono', size: 12, color: 'muted' });
    p.textPx('f(xₙ)', 146, 30, { font: 'mono', size: 12, color: 'muted' });
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      p.textPx(String(i + 1), 24, 49 + i * 19, { font: 'mono', size: 12, color: last ? 'c3' : 'ink' });
      p.textPx(iters[i].toFixed(6), 56, 49 + i * 19, { font: 'mono', size: 12, color: last ? 'c3' : 'ink' });
      p.textPx(fmt(g(iters[i]), 4), 146, 49 + i * 19, { font: 'mono', size: 12, color: last ? 'c2' : 'muted' });
    }
  }

  const to = (vars: gsap.TweenVars) => s.tween(st, { overwrite: 'auto', duration: .8, ...vars, onUpdate: sync });
  s.onBeat(i => {
    if (i <= 3 && mode.get() !== 'zoom') mode.set('zoom');
    if (i === 0) { to({ probe: 0, hf: -.25 }); zoom.set(0, .8); }
    if (i === 1) { to({ probe: 1, hf: -.25 }); zoom.set(0, .8); }
    if (i === 2) { to({ probe: 1, hf: -.25 }); zoom.set(2.3, 3.2); }
    if (i === 3) { to({ probe: 1, hf: -.5 }); zoom.set(1, 1); }
    if (i === 4) {
      if (mode.get() !== 'newton') mode.set('newton');
      st.x1 = 1; recompute(); st.shown = 0; sync();
      if (s.reduced) { st.shown = 2; sync(); }
      else s.tween({}, { duration: .6, onComplete: () => { if (st.mode === 'newton' && st.shown === 0) { step(); s.tween({}, { duration: 1.2, onComplete: () => { if (st.mode === 'newton' && st.shown === 1) step(); } }); } } });
    }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.2, ease: 'power2.inOut', onUpdate: sync });
  });
  st.draw = s.reduced ? 1 : 0;
  setMode('zoom');
  st.fade = 1;
}
