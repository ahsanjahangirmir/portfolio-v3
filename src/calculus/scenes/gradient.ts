// Scene: the gradient on a contour map. ∇f is perpendicular to level curves, D_u f = ∇f · u,
// gradient ascent climbs to a peak, the second-derivative test labels critical points
// (example: f = 4x² + y² + 2x²y − 1), and Lagrange multipliers find where ∇f ∥ ∇g.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type F = (x: number, y: number) => number;
type Land = { f: F; x: [number, number]; y: [number, number]; P: [number, number]; name: string };
const G = (x: number, y: number, cx: number, cy: number, s: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s);
const LANDS: Record<string, Land> = {
  hills: {
    f: (x, y) => 2.1 * G(x, y, 1.25, .45, 1.1) + 1.5 * G(x, y, -1.35, -.55, .95) - 1.2 * G(x, y, -.9, 1.55, .7) - .9 * G(x, y, 1.6, -1.6, .8),
    x: [-3.2, 3.2], y: [-2.4, 2.4], P: [-.2, -1.25], name: 'f(x, y): two hills, a pit, a dip',
  },
  saddle: { f: (x, y) => 4 * x * x + y * y + 2 * x * x * y - 1, x: [-3, 3], y: [-3.4, 1.6], P: [.9, .7], name: 'f = 4x² + y² + 2x²y − 1' },
  lagrange: { f: (x, y) => x * y, x: [-2.6, 2.6], y: [-2.3, 2.3], P: [Math.SQRT2 * Math.cos(-.5), Math.sqrt(3) * Math.sin(-.5)], name: 'f = xy on 3x² + 2y² = 6' },
};
// Constraint for the Lagrange mode: g = 3x² + 2y² = 6, an ellipse with semi-axes √2 and √3.
const EA = Math.SQRT2, EB = Math.sqrt(3);

function rgb(color: string): [number, number, number] {
  const c = document.createElement('canvas').getContext('2d')!;
  c.fillStyle = '#000'; c.fillStyle = color;
  const s = c.fillStyle as string;
  if (s.startsWith('#')) { const n = parseInt(s.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = s.match(/[\d.]+/g) ?? ['128', '128', '128'];
  return [+m[0], +m[1], +m[2]];
}

/** Marching squares: segments (x1,y1,x2,y2,...) of the level set {v = L} on a grid. */
function contour(vals: Float32Array, nx: number, ny: number, x0: number, y0: number, dx: number, dy: number, L: number, out: number[]) {
  const at = (i: number, j: number) => vals[j * (nx + 1) + i];
  const pts: number[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = at(i, j) - L, b = at(i + 1, j) - L, c = at(i + 1, j + 1) - L, d = at(i, j + 1) - L;
    if ((a > 0) === (b > 0) && (b > 0) === (c > 0) && (c > 0) === (d > 0)) continue;
    pts.length = 0;
    const X = x0 + i * dx, Y = y0 + j * dy;
    if ((a > 0) !== (b > 0)) pts.push(X + dx * a / (a - b), Y);
    if ((b > 0) !== (c > 0)) pts.push(X + dx, Y + dy * b / (b - c));
    if ((d > 0) !== (c > 0)) pts.push(X + dx * d / (d - c), Y + dy);
    if ((a > 0) !== (d > 0)) pts.push(X, Y + dy * a / (a - d));
    if (pts.length === 4) out.push(pts[0], pts[1], pts[2], pts[3]);
    else if (pts.length === 8) {
      const mid = (a + b + c + d) / 4;
      if ((mid > 0) === (a > 0)) out.push(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
      else out.push(pts[0], pts[1], pts[6], pts[7], pts[2], pts[3], pts[4], pts[5]);
    }
  }
}

export default function mount(s: Scene) {
  let mode = 'hills';
  let land = LANDS.hills;
  let f: F = land.f;
  const plot = new Plot2D(s, { x: land.x, y: land.y, aspect: 'equal', pad: 6, labels: ['x', 'y'] });
  const st = {
    px: land.P[0], py: land.P[1], phi: 30, map: s.reduced ? 1 : 0, grad: 0, dial: 0, crit: 0, lag: 0, ball: 0,
  };
  const h = 1e-4;
  const grad = (x: number, y: number): [number, number] => [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
  const hess = (x: number, y: number) => {
    const e = 1e-3;
    const fxx = (f(x + e, y) - 2 * f(x, y) + f(x - e, y)) / (e * e);
    const fyy = (f(x, y + e) - 2 * f(x, y) + f(x, y - e)) / (e * e);
    const fxy = (f(x + e, y + e) - f(x + e, y - e) - f(x - e, y + e) + f(x - e, y - e)) / (4 * e * e);
    return { fxx, fyy, fxy };
  };

  // ---- Cached contour map (recomputed when the view, size, function or theme changes) ----
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d')!;
  let cacheKey = '';
  let lines = new Float32Array(0);
  let levels: number[] = [];
  let arrowScale = 1;
  const NX = 140, NY = 110;
  const grid = new Float32Array((NX + 1) * (NY + 1));
  let gx0 = 0, gy0 = 0, gdx = 1, gdy = 1;
  let W0 = [0, 1, 0, 1];

  function rebuild(g: Plot2D) {
    const key = [mode, g.ex0, g.ex1, g.ey0, g.ey1, g.width, g.height, s.colors.c1, s.colors.c3].join('|');
    if (key === cacheKey) return;
    cacheKey = key;
    // World extents of the whole canvas (the plot pads its view by a few px).
    const [wx0, wy1] = g.toWorld(0, 0), [wx1, wy0] = g.toWorld(g.width, g.height);
    W0 = [wx0, wx1, wy0, wy1];
    gx0 = wx0; gy0 = wy0; gdx = (wx1 - wx0) / NX; gdy = (wy1 - wy0) / NY;
    const vals: number[] = [];
    let gmax: number[] = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const v = f(gx0 + i * gdx, gy0 + j * gdy);
      grid[j * (NX + 1) + i] = v; vals.push(v);
      if ((i % 7 === 0) && (j % 7 === 0)) { const [a, b] = grad(gx0 + i * gdx, gy0 + j * gdy); gmax.push(Math.hypot(a, b)); }
    }
    vals.sort((a, b) => a - b);
    gmax = gmax.sort((a, b) => a - b);
    arrowScale = 1.25 / (gmax[Math.floor(gmax.length * .8)] || 1);
    const lo = vals[Math.floor(vals.length * .02)], hi = vals[Math.floor(vals.length * .98)];
    const n = 14, step = (hi - lo) / n;
    levels = Array.from({ length: n + 1 }, (_, k) => lo + k * step);
    // Level lines.
    const segs: number[] = [];
    for (const L of levels) contour(grid, NX, NY, gx0, gy0, gdx, gdy, L, segs);
    lines = new Float32Array(segs);
    // Filled bands at half resolution.
    const W = Math.max(2, Math.round(g.width / 2)), H = Math.max(2, Math.round(g.height / 2));
    off.width = W; off.height = H;
    const img = offCtx.createImageData(W, H);
    const cLo = rgb(s.colors.c3), cHi = rgb(s.colors.c1);
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const x = wx0 + (wx1 - wx0) * (px + .5) / W, y = wy1 - (wy1 - wy0) * (py + .5) / H;
      const k = Math.max(0, Math.min(n, Math.floor((f(x, y) - lo) / step)));
      const t = k / n, o = (py * W + px) * 4;
      img.data[o] = cLo[0] + (cHi[0] - cLo[0]) * t;
      img.data[o + 1] = cLo[1] + (cHi[1] - cLo[1]) * t;
      img.data[o + 2] = cLo[2] + (cHi[2] - cLo[2]) * t;
      img.data[o + 3] = 255 * (.07 + .3 * t);
    }
    offCtx.putImageData(img, 0, 0);
    findCritical(g);
  }

  // ---- Critical points by Newton's method from a grid of seeds, classified by D = fxx fyy − fxy² ----
  let crits: { x: number; y: number; kind: 'max' | 'min' | 'saddle' | '?'; D: number; fxx: number }[] = [];
  function findCritical(g: Plot2D) {
    crits = [];
    if (mode === 'lagrange') return;
    for (let a = 0; a <= 12; a++) for (let b = 0; b <= 9; b++) {
      let x = g.ex0 + (g.ex1 - g.ex0) * (a + .5) / 13, y = g.ey0 + (g.ey1 - g.ey0) * (b + .5) / 10;
      for (let k = 0; k < 40; k++) {
        const [gx, gy] = grad(x, y), { fxx, fyy, fxy } = hess(x, y);
        const det = fxx * fyy - fxy * fxy;
        if (Math.abs(det) < 1e-10) break;
        const sx = (fyy * gx - fxy * gy) / det, sy = (fxx * gy - fxy * gx) / det;
        x -= sx; y -= sy;
        if (Math.hypot(sx, sy) < 1e-10 || !Number.isFinite(x)) break;
      }
      const [gx, gy] = grad(x, y);
      if (!Number.isFinite(x) || Math.hypot(gx, gy) > 1e-5) continue;
      if (x < g.ex0 + .1 || x > g.ex1 - .1 || y < g.ey0 + .1 || y > g.ey1 - .1) continue;
      if (crits.some(c => Math.hypot(c.x - x, c.y - y) < .05)) continue;
      const { fxx, fyy, fxy } = hess(x, y), D = fxx * fyy - fxy * fxy;
      crits.push({ x, y, D, fxx, kind: Math.abs(D) < 1e-6 ? '?' : D < 0 ? 'saddle' : fxx < 0 ? 'max' : 'min' });
    }
  }

  // ---- Gradient ascent ----
  const trail: number[] = [];
  const ball = { x: 0, y: 0, running: false };
  const climbBtn = s.action('climb', () => startClimb());
  function stepClimb(dt: number) {
    const [gx, gy] = grad(ball.x, ball.y);
    const m = Math.hypot(gx, gy);
    if (m * arrowScale < .006 || ball.x < plot.ex0 || ball.x > plot.ex1 || ball.y < plot.ey0 || ball.y > plot.ey1) return false;
    // Gradient flow dx/dt = ∇f, with a speed cap so steep spots do not jump.
    // The ball moves with the drawn arrow as its velocity (capped on steep ground).
    const k = arrowScale * Math.min(1, 2.2 / (m * arrowScale));
    ball.x += gx * k * dt; ball.y += gy * k * dt;
    trail.push(ball.x, ball.y);
    if (trail.length > 4000) trail.splice(0, 2);
    return true;
  }
  function startClimb() {
    if (mode === 'lagrange') { startSlide(); return; }
    trail.length = 0;
    ball.x = st.px; ball.y = st.py; trail.push(ball.x, ball.y);
    st.ball = 1;
    if (s.reduced) { for (let i = 0; i < 6000 && stepClimb(.01); i++); ball.running = false; plot.invalidate(); readouts(); return; }
    ball.running = true; plot.animate = true;
    climbBtn?.setAttribute('aria-pressed', 'true');
  }
  function stopClimb() { ball.running = false; slide.running = false; plot.animate = false; climbBtn?.setAttribute('aria-pressed', 'false'); }
  // Lagrange: slide P along the ellipse in the direction that raises f (projected gradient).
  const slide = { running: false, th: 0 };
  function startSlide() {
    slide.th = Math.atan2(st.py / EB, st.px / EA);
    if (s.reduced) { for (let i = 0; i < 4000 && slideStep(.01); i++); plot.invalidate(); readouts(); return; }
    slide.running = true; plot.animate = true; climbBtn?.setAttribute('aria-pressed', 'true');
  }
  function slideStep(dt: number) {
    const th = slide.th;
    const tx = -EA * Math.sin(th), ty = EB * Math.cos(th);
    const [gx, gy] = grad(EA * Math.cos(th), EB * Math.sin(th));
    const rate = gx * tx + gy * ty;
    if (Math.abs(rate) < 1e-4) return false;
    slide.th += Math.sign(rate) * Math.min(Math.abs(rate), 1.6) * dt;
    st.px = EA * Math.cos(slide.th); st.py = EB * Math.sin(slide.th);
    return true;
  }
  s.frame((_, dt) => {
    if (ball.running) {
      let moving = true;
      for (let i = 0; i < 4 && moving; i++) moving = stepClimb(dt / 4);
      if (!moving) stopClimb();
      readouts();
    }
    if (slide.running) {
      let moving = true;
      for (let i = 0; i < 4 && moving; i++) moving = slideStep(dt / 4);
      if (!moving) stopClimb();
      readouts();
    }
  });
  s.cleanup(stopClimb);

  // ---- Readouts ----
  const out = { f: s.readout('f'), g: s.readout('g'), d: s.readout('d') };
  const labelD = s.root.querySelector<HTMLElement>('[data-readout="d"]')?.previousElementSibling;
  function readouts() {
    const [gx, gy] = grad(st.px, st.py);
    out.f(fmt(f(st.px, st.py), 3));
    out.g(fmt(Math.hypot(gx, gy), 3));
    if (mode === 'lagrange') {
      if (labelD) labelD.textContent = 'Angle ∇f to ∇g';
      const gg = [6 * st.px, 4 * st.py];
      const c = Math.abs(gx * gg[1] - gy * gg[0]) / (Math.hypot(gx, gy) * Math.hypot(gg[0], gg[1]) || 1);
      const dotp = gx * gg[0] + gy * gg[1];
      let ang = Math.asin(Math.min(1, c)) * 180 / Math.PI;
      if (dotp < 0) ang = 180 - ang;
      out.d(`${fmt(ang, 1)}°`);
    } else {
      if (labelD) labelD.textContent = 'Dᵤf';
      const u = [Math.cos(st.phi * Math.PI / 180), Math.sin(st.phi * Math.PI / 180)];
      out.d(fmt(gx * u[0] + gy * u[1], 3));
    }
  }

  // ---- Handles ----
  const OFF: [number, number] = [1e9, 1e9];
  plot.handle({
    get: () => [st.px, st.py],
    set: (x, y) => {
      if (mode === 'lagrange') { const th = Math.atan2(y / EB, x / EA); st.px = EA * Math.cos(th); st.py = EB * Math.sin(th); }
      else { st.px = num.clamp(x, plot.ex0 + .05, plot.ex1 - .05); st.py = num.clamp(y, plot.ey0 + .05, plot.ey1 - .05); }
      stopClimb(); readouts();
    },
    radius: 18,
  });
  const DIAL = 1;
  plot.handle({
    get: () => (st.dial > .5 && mode !== 'lagrange' ? [st.px + DIAL * Math.cos(st.phi * Math.PI / 180), st.py + DIAL * Math.sin(st.phi * Math.PI / 180)] : OFF),
    set: (x, y) => { let a = Math.atan2(y - st.py, x - st.px) * 180 / Math.PI; if (a < 0) a += 360; dirSlider.set(a); },
    radius: 14,
  });
  const dirSlider = s.slider('dir', v => { st.phi = v; readouts(); plot.invalidate(); });

  // ---- Drawing ----
  const levelThrough: number[] = [];
  plot.render = g => {
    rebuild(g);
    const ctx = g.ctx;
    const m = st.map;
    if (m > .01) {
      const [ax, ay] = g.toScreen(W0[0], W0[3]), [bx, by] = g.toScreen(W0[1], W0[2]);
      ctx.globalAlpha = m;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, ax, ay, bx - ax, by - ay);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      for (let i = 0; i < lines.length; i += 4) {
        const [x1, y1] = g.toScreen(lines[i], lines[i + 1]), [x2, y2] = g.toScreen(lines[i + 2], lines[i + 3]);
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      }
      ctx.strokeStyle = g.color('ink', .2 * m); ctx.lineWidth = 1; ctx.stroke();
    }
    if (m < .98) return;

    // Lagrange: constraint ellipse and the marked optima.
    if (st.lag > .01) {
      g.param(t => EA * Math.cos(t), t => EB * Math.sin(t), 0, Math.PI * 2, { color: 'c4', width: 2.6, alpha: st.lag, samples: 200 });
      g.text('g = 6', EA * Math.cos(2.4), EB * Math.sin(2.4), { color: 'c4', offset: [-12, -14], align: 'right', size: 14, alpha: st.lag });
      const r = Math.sqrt(1.5);
      [[1, r], [-1, -r]].forEach(([x, y]) => { g.point(x, y, { color: 'c1', r: 4.5, alpha: st.lag }); });
      g.text('max', 1, r, { color: 'c1', offset: [10, -12], size: 13, alpha: st.lag });
      g.text('max', -1, -r, { color: 'c1', offset: [-10, 14], align: 'right', size: 13, alpha: st.lag });
    }

    // Critical points with their second-derivative verdicts.
    if (st.crit > .01) {
      for (const c of crits) {
        const col = c.kind === 'max' ? 'c1' : c.kind === 'min' ? 'c3' : 'c5';
        if (c.kind === 'saddle') {
          const [sx, sy] = g.toScreen(c.x, c.y);
          ctx.beginPath(); ctx.moveTo(sx - 6, sy - 6); ctx.lineTo(sx + 6, sy + 6); ctx.moveTo(sx + 6, sy - 6); ctx.lineTo(sx - 6, sy + 6);
          ctx.strokeStyle = g.color(col, st.crit); ctx.lineWidth = 2.5; ctx.stroke();
        } else g.point(c.x, c.y, { color: col, r: 5.5, ring: c.kind === 'min', alpha: st.crit });
        g.text(c.kind, c.x, c.y, { color: col, offset: [9, -13], size: 13, weight: 600, alpha: st.crit });
      }
    }

    // Level curve through P.
    const fp = f(st.px, st.py);
    levelThrough.length = 0;
    contour(grid, NX, NY, gx0, gy0, gdx, gdy, fp, levelThrough);
    if (st.grad > .01 || st.lag > .01) {
      ctx.beginPath();
      for (let i = 0; i < levelThrough.length; i += 4) {
        const [x1, y1] = g.toScreen(levelThrough[i], levelThrough[i + 1]), [x2, y2] = g.toScreen(levelThrough[i + 2], levelThrough[i + 3]);
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      }
      ctx.strokeStyle = g.color('ink', .75 * Math.max(st.grad, st.lag)); ctx.lineWidth = 1.8; ctx.setLineDash([]); ctx.stroke();
    }

    // Gradient ascent trail and ball.
    if (st.ball > .01 && trail.length > 2) {
      ctx.beginPath();
      for (let i = 0; i < trail.length; i += 2) { const [x, y] = g.toScreen(trail[i], trail[i + 1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.strokeStyle = g.color('c2', .9 * st.ball); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
      g.point(ball.x, ball.y, { color: 'c2', r: 7, halo: true, alpha: st.ball });
    }

    const [gx, gy] = grad(st.px, st.py);
    const S = arrowScale;
    const gl = st.grad;
    // Direction dial: unit vector u, and the shadow of ∇f on it, D_u f = ∇f · u.
    if (st.dial > .01 && mode !== 'lagrange') {
      const a = st.phi * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
      g.circle(st.px, st.py, DIAL, { color: 'muted', width: 1, dash: [3, 5], alpha: .7 * st.dial });
      const d = gx * ux + gy * uy;
      g.line(st.px, st.py, st.px + ux * d * S, st.py + uy * d * S, { color: 'c5', width: 7, alpha: .45 * st.dial, cap: 'butt' });
      g.line(st.px + gx * S, st.py + gy * S, st.px + ux * d * S, st.py + uy * d * S, { color: 'muted', width: 1.2, dash: [4, 4], alpha: st.dial });
      g.arrow(st.px, st.py, st.px + ux * DIAL, st.py + uy * DIAL, { color: 'c5', width: 2.2, alpha: st.dial });
      g.point(st.px + ux * DIAL, st.py + uy * DIAL, { color: 'c5', r: 5, ring: true, alpha: st.dial });
      g.text('u', st.px + ux * DIAL, st.py + uy * DIAL, { color: 'c5', font: 'serif', size: 17, offset: [ux * 16, -uy * 16], align: 'center' });
    }
    // Lagrange: ∇g at P, rose.
    if (st.lag > .01) {
      const gg: [number, number] = [6 * st.px, 4 * st.py];
      const sg = .11;
      g.arrow(st.px, st.py, st.px + gg[0] * sg * st.lag, st.py + gg[1] * sg * st.lag, { color: 'c4', width: 2.6 });
      g.text('∇g', st.px + gg[0] * sg, st.py + gg[1] * sg, { color: 'c4', offset: [12, 30], size: 15, weight: 600 });
    }
    if (gl > .01) {
      // Tangent to the level curve, and ∇f perpendicular to it.
      const m2 = Math.hypot(gx, gy) || 1, tx = -gy / m2, ty = gx / m2;
      if (mode !== 'lagrange') g.line(st.px - tx * .7, st.py - ty * .7, st.px + tx * .7, st.py + ty * .7, { color: 'ink', width: 1.2, dash: [5, 4], alpha: .7 * gl });
      if (m2 > 1e-3) {
        const q = .16, nx = gx / m2, ny = gy / m2;
        g.poly([[st.px + tx * q, st.py + ty * q], [st.px + tx * q + nx * q, st.py + ty * q + ny * q], [st.px + nx * q, st.py + ny * q]], { fill: false, close: false, stroke: 'ink', strokeAlpha: .7 * gl, strokeWidth: 1.2 });
      }
      g.arrow(st.px, st.py, st.px + gx * S * gl, st.py + gy * S * gl, { color: 'c2', width: 3, head: 12 });
      g.text('∇f', st.px + gx * S, st.py + gy * S, { color: 'c2', offset: [gx >= 0 ? 12 : -12, -12], align: gx >= 0 ? 'left' : 'right', size: 16, weight: 600 });
    }
    g.point(st.px, st.py, { color: 'ink', r: 6, ring: true, halo: true });
    g.text('P', st.px, st.py, { offset: [-12, 14], weight: 600, size: 15, align: 'right' });
    // Function name, bottom-left.
    g.textPx(land.name, 14, g.height - 16, { color: 'muted', font: 'mono', size: 12 });
  };

  // ---- Modes ----
  function setMode(m: string) {
    if (m === mode) return;
    stopClimb();
    mode = m; land = LANDS[m]; f = land.f;
    trail.length = 0; st.ball = 0;
    st.px = land.P[0]; st.py = land.P[1];
    st.map = 0; cacheKey = '';
    st.lag = 0;
    s.tween(st, { map: 1, lag: m === 'lagrange' ? 1 : 0, duration: .9, overwrite: 'auto', ease: 'power2.inOut', onUpdate: () => plot.invalidate() });
    Object.assign(plot.view, { x0: land.x[0], x1: land.x[1], y0: land.y[0], y1: land.y[1] });
    if (seg.get() !== m) seg.set(m);
    readouts(); plot.invalidate();
  }
  const seg = s.segmented('land', setMode);

  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .8, overwrite: 'auto', ease: 'power2.inOut', ...vars, onUpdate: () => { readouts(); plot.invalidate(); } });
  const moveP = (x: number, y: number, d = 1) => to({ px: x, py: y, duration: d });

  readouts();
  let beat = -1;
  s.onBeat(i => {
    beat = i;
    if (i !== 3) { stopClimb(); st.ball = 0; }
    if (i <= 3 && mode !== 'hills') setMode('hills');
    if (i === 0) to({ grad: 0, dial: 0, crit: 0 });
    if (i === 1) { to({ grad: 1, dial: 0, crit: 0 }); moveP(-.2, -1.25); }
    if (i === 2) {
      to({ grad: 1, dial: 1, crit: 0 });
      const [gx, gy] = grad(st.px, st.py);
      const best = (Math.atan2(gy, gx) * 180 / Math.PI + 360) % 360;
      dirSlider.set(Math.min(359, (best + 140) % 360), .4);
      s.timeline().call(() => { if (beat === 2) dirSlider.set(best, 2.2); }, [], .7);
    }
    if (i === 3) { to({ grad: 1, dial: 0, crit: 0 }); if (!ball.running) s.timeline().call(() => { if (beat === 3 && !ball.running) startClimb(); }, [], .6); }
    if (i === 4) { if (mode !== 'saddle') setMode('saddle'); to({ grad: 1, dial: 0, crit: 1 }); }
    if (i === 5) { if (mode !== 'lagrange') setMode('lagrange'); to({ grad: 1, dial: 0, crit: 0 }); s.timeline().call(() => { if (beat === 5 && !slide.running) startClimb(); }, [], 1.2); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.map = 1; plot.invalidate(); return; }
    s.tween(st, { map: 1, duration: 1.4, overwrite: 'auto', ease: 'power2.inOut', onUpdate: () => plot.invalidate() });
  });
  dirSlider.set(st.phi);
}
