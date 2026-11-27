// Scene: vector fields with flowing particles; circulation and flux around a draggable loop; curl as a paddle
// wheel and divergence as a pulse; Green's theorem as cancelling cells; path independence for a gradient field.
// Example fields: F = ⟨sin x + y², x + cos³y⟩ (curl 1 − 2y) and the gradient F = ∇(x² sin y − y³).
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type V2 = [number, number];
type Field = { F: (x: number, y: number) => V2; name: string; pot?: (x: number, y: number) => number };
const FIELDS: Record<string, Field> = {
  swirl: { F: (x, y) => [-y, x], name: 'F = ⟨−y, x⟩' },
  source: { F: (x, y) => [x, y], name: 'F = ⟨x, y⟩' },
  grad: { F: (x, y) => [2 * x * Math.sin(y), x * x * Math.cos(y) - 3 * y * y], name: 'F = ∇(x² sin y − y³)', pot: (x, y) => x * x * Math.sin(y) - y ** 3 },
  mixed: { F: (x, y) => [Math.sin(x) + y * y, x + Math.cos(y) ** 3], name: 'F = ⟨sin x + y², x + cos³y⟩' },
};
const NP = 280;

export default function mount(s: Scene) {
  let key = 'swirl';
  let F = FIELDS.swirl.F;
  const plot = new Plot2D(s, { x: [-3.2, 3.2], y: [-2.3, 2.7], aspect: 'equal', pad: 4, labels: ['x', 'y'] });
  const st = {
    show: s.reduced ? 1 : 0, loop: 0, cx: -.6, cy: -.5, R: 1.1, wheel: 0, wx: .9, wy: -1, cells: 0, k: 2, paths: 0,
    ax: 1, ay: 0, bx: 0, by: 2, qx: 1.9, qy: 1.9,
  };
  const h = 1e-4;
  const curl = (x: number, y: number) => (F(x + h, y)[1] - F(x - h, y)[1]) / (2 * h) - (F(x, y + h)[0] - F(x, y - h)[0]) / (2 * h);
  const div = (x: number, y: number) => (F(x + h, y)[0] - F(x - h, y)[0]) / (2 * h) + (F(x, y + h)[1] - F(x, y - h)[1]) / (2 * h);

  // ---- Line integrals ----
  /** ∫ F · dr along the circle (cx, cy, R) from angle t0 to t1, trapezoid rule with n samples (exact for the closed loop, smooth periodic). */
  const arcWork = (cx: number, cy: number, R: number, t0: number, t1: number, n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const t = t0 + (t1 - t0) * (i + .5) / n;
      const [P, Q] = F(cx + R * Math.cos(t), cy + R * Math.sin(t));
      sum += (P * -Math.sin(t) + Q * Math.cos(t)) * R;
    }
    return sum * (t1 - t0) / n;
  };
  const segWork = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n;
      const [P, Q] = F(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      sum += P * (x1 - x0) + Q * (y1 - y0);
    }
    return sum / n;
  };
  const circulation = () => arcWork(st.cx, st.cy, st.R, 0, Math.PI * 2, 400);
  const flux = () => {
    let sum = 0; const n = 400;
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n * Math.PI * 2;
      const [P, Q] = F(st.cx + st.R * Math.cos(t), st.cy + st.R * Math.sin(t));
      sum += (P * Math.cos(t) + Q * Math.sin(t)) * st.R;
    }
    return sum * Math.PI * 2 / n;
  };
  const curlIntegral = () => {
    let sum = 0; const nr = 40, nt = 64;
    for (let i = 0; i < nr; i++) for (let j = 0; j < nt; j++) {
      const r = (i + .5) / nr * st.R, t = (j + .5) / nt * Math.PI * 2;
      sum += curl(st.cx + r * Math.cos(t), st.cy + r * Math.sin(t)) * r;
    }
    return sum * (st.R / nr) * (Math.PI * 2 / nt);
  };
  // Polar cells: ring i, sector j. Each edge's integral is computed once, so a shared edge enters two cells with opposite signs.
  type Cell = { i: number; j: number; circ: number };
  let cells: Cell[] = [];
  let cellSum = 0, cellBoundary = 0;
  function computeCells() {
    const nr = Math.max(1, Math.round(st.k)), nt = 4 * nr, EDGE = 24;
    const dr = st.R / nr, dt = Math.PI * 2 / nt;
    const arc = (i: number, j: number) => arcWork(st.cx, st.cy, i * dr, j * dt, (j + 1) * dt, EDGE); // ccw arc at radius i·dr over sector j
    const ray = (i: number, j: number) => { // outward radial edge from radius i·dr to (i+1)·dr at angle j·dt
      const t = j * dt;
      return segWork(st.cx + i * dr * Math.cos(t), st.cy + i * dr * Math.sin(t), st.cx + (i + 1) * dr * Math.cos(t), st.cy + (i + 1) * dr * Math.sin(t), EDGE);
    };
    const arcs: number[][] = [], rays: number[][] = [];
    for (let i = 0; i <= nr; i++) { arcs[i] = []; for (let j = 0; j < nt; j++) arcs[i][j] = i === 0 ? 0 : arc(i, j); }
    for (let i = 0; i < nr; i++) { rays[i] = []; for (let j = 0; j < nt; j++) rays[i][j] = ray(i, j); }
    cells = []; cellSum = 0; cellBoundary = 0;
    for (let i = 0; i < nr; i++) for (let j = 0; j < nt; j++) {
      // Counterclockwise: out along ray j, ccw along outer arc, back in along ray j+1, cw along inner arc.
      const c = rays[i][j] + arcs[i + 1][j] - rays[i][(j + 1) % nt] - arcs[i][j];
      cells.push({ i, j, circ: c });
      cellSum += c;
    }
    for (let j = 0; j < nt; j++) cellBoundary += arcs[nr][j];
  }
  // Paths for the conservative beat: segment A→B, and a quadratic Bézier A→Q→B.
  const bez = (t: number): V2 => {
    const u = 1 - t;
    return [u * u * st.ax + 2 * u * t * st.qx + t * t * st.bx, u * u * st.ay + 2 * u * t * st.qy + t * t * st.by];
  };
  const bezWork = () => {
    let sum = 0; const n = 600;
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, [x, y] = bez(t);
      const dx = 2 * (1 - t) * (st.qx - st.ax) + 2 * t * (st.bx - st.qx), dy = 2 * (1 - t) * (st.qy - st.ay) + 2 * t * (st.by - st.qy);
      const [P, Q] = F(x, y);
      sum += P * dx + Q * dy;
    }
    return sum / n;
  };

  // ---- Field scale (arrow length and particle speed follow |F| relative to a typical size) ----
  let typical = 1;
  function measure() {
    const mags: number[] = [];
    for (let i = 0; i <= 20; i++) for (let j = 0; j <= 16; j++) {
      const [P, Q] = F(-3.2 + 6.4 * i / 20, -2.3 + 5 * j / 16);
      mags.push(Math.hypot(P, Q));
    }
    mags.sort((a, b) => a - b);
    typical = mags[Math.floor(mags.length * .8)] || 1;
  }
  measure();

  // ---- Particles ----
  const px = new Float32Array(NP), py = new Float32Array(NP), life = new Float32Array(NP), vx = new Float32Array(NP), vy = new Float32Array(NP);
  const spawn = (i: number, any = false) => {
    px[i] = num.lerp(plot.ex0, plot.ex1, Math.random()); py[i] = num.lerp(plot.ey0, plot.ey1, Math.random());
    life[i] = any ? Math.random() * 4 : 2.5 + Math.random() * 2.5;
  };
  for (let i = 0; i < NP; i++) spawn(i, true);
  let flowing = !s.reduced;
  const flowBtn = s.action('flow', () => setFlow(!flowing));
  const setFlow = (on: boolean) => { flowing = on && !s.reduced; flowBtn?.setAttribute('aria-pressed', String(flowing)); syncAnimate(); };
  const syncAnimate = () => { plot.animate = !s.reduced && (flowing || st.wheel > .5); };
  let wheelAngle = 0, pulse = 0;

  s.frame((_, dt) => {
    if (!plot.animate) return;
    const spd = .9 / typical;
    if (flowing) for (let i = 0; i < NP; i++) {
      // Midpoint (RK2) step along the field.
      const [a, b] = F(px[i], py[i]);
      const [c, d] = F(px[i] + a * spd * dt / 2, py[i] + b * spd * dt / 2);
      let ux = c * spd, uy = d * spd;
      const m = Math.hypot(ux, uy);
      if (m > 2.4) { ux *= 2.4 / m; uy *= 2.4 / m; }
      vx[i] = ux; vy[i] = uy;
      px[i] += ux * dt; py[i] += uy * dt; life[i] -= dt;
      if (life[i] <= 0 || px[i] < plot.ex0 - .2 || px[i] > plot.ex1 + .2 || py[i] < plot.ey0 - .2 || py[i] > plot.ey1 + .2) spawn(i);
    }
    if (st.wheel > .5) {
      wheelAngle += curl(st.wx, st.wy) / 2 * dt;
      pulse += div(st.wx, st.wy) * .35 * dt;
    }
  });
  s.cleanup(() => { plot.animate = false; });

  // ---- Readouts ----
  const out = { circ: s.readout('circ'), flux: s.readout('flux'), curl: s.readout('curl'), div: s.readout('div') };
  function readouts() {
    const loopOn = st.loop > .5, wheelOn = st.wheel > .5;
    out.circ(loopOn ? fmt(circulation(), 3) : '—');
    out.flux(loopOn ? fmt(flux(), 3) : '—');
    out.curl(wheelOn ? fmt(curl(st.wx, st.wy), 3) : '—');
    out.div(wheelOn ? fmt(div(st.wx, st.wy), 3) : '—');
    if (st.cells > .01) computeCells();
  }

  // ---- Handles ----
  const OFF: V2 = [1e9, 1e9];
  const clampX = (x: number) => num.clamp(x, plot.ex0 + .1, plot.ex1 - .1), clampY = (y: number) => num.clamp(y, plot.ey0 + .1, plot.ey1 - .1);
  plot.handle({ get: () => (st.loop > .5 && st.paths < .5 ? [st.cx, st.cy] : OFF), set: (x, y) => { st.cx = clampX(x); st.cy = clampY(y); readouts(); }, radius: 18 });
  plot.handle({ get: () => (st.wheel > .5 ? [st.wx, st.wy] : OFF), set: (x, y) => { st.wx = clampX(x); st.wy = clampY(y); readouts(); }, radius: 22 });
  plot.handle({ get: () => (st.paths > .5 ? [st.ax, st.ay] : OFF), set: (x, y) => { st.ax = clampX(x); st.ay = clampY(y); } });
  plot.handle({ get: () => (st.paths > .5 ? [st.bx, st.by] : OFF), set: (x, y) => { st.bx = clampX(x); st.by = clampY(y); } });
  plot.handle({ get: () => (st.paths > .5 ? [st.qx, st.qy] : OFF), set: (x, y) => { st.qx = clampX(x); st.qy = clampY(y); } });
  const rSlider = s.slider('radius', v => { st.R = v; readouts(); plot.invalidate(); });
  const kSlider = s.slider('cells', v => { st.k = v; readouts(); plot.invalidate(); });

  // ---- Drawing ----
  plot.render = g => {
    const ctx = g.ctx, a = st.show;
    // Arrow grid.
    const spacing = Math.max(.32, 34 * g.unitX);
    const maxLen = spacing * .82;
    ctx.beginPath();
    const heads: number[] = [];
    for (let x = Math.ceil(g.ex0 / spacing) * spacing; x <= g.ex1; x += spacing) for (let y = Math.ceil(g.ey0 / spacing) * spacing; y <= g.ey1; y += spacing) {
      const [P, Q] = F(x, y), m = Math.hypot(P, Q);
      if (m < 1e-9) continue;
      const L = maxLen * Math.min(1, m / typical) * a, ux = P / m, uy = Q / m;
      if (L < spacing * .08) continue;
      const [x0, y0] = g.toScreen(x - ux * L / 2, y - uy * L / 2), [x1, y1] = g.toScreen(x + ux * L / 2, y + uy * L / 2);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      heads.push(x1, y1, Math.atan2(y1 - y0, x1 - x0), Math.min(6, Math.hypot(x1 - x0, y1 - y0) * .4));
    }
    ctx.strokeStyle = g.color('ink', .38); ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < heads.length; i += 4) {
      const x = heads[i], y = heads[i + 1], t = heads[i + 2], hd = heads[i + 3];
      ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(t - .5) * hd, y - Math.sin(t - .5) * hd); ctx.lineTo(x - Math.cos(t + .5) * hd, y - Math.sin(t + .5) * hd); ctx.closePath();
    }
    ctx.fillStyle = g.color('ink', .38); ctx.fill();

    // Particles as short streaks.
    if (!s.reduced) {
      ctx.beginPath();
      for (let i = 0; i < NP; i++) {
        const [x1, y1] = g.toScreen(px[i], py[i]), [x0, y0] = g.toScreen(px[i] - vx[i] * .16, py[i] - vy[i] * .16);
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      }
      ctx.strokeStyle = g.color('c3', .85 * a); ctx.lineWidth = 2.2; ctx.stroke();
    }

    // Green's cells.
    const cl = st.cells;
    if (cl > .01 && cells.length) {
      const nr = Math.max(1, Math.round(st.k)), nt = 4 * nr, dr = st.R / nr, dt = Math.PI * 2 / nt;
      const big = Math.max(...cells.map(c => Math.abs(c.circ))) || 1;
      for (const c of cells) {
        const r0 = c.i * dr, r1 = (c.i + 1) * dr, t0 = c.j * dt, t1 = (c.j + 1) * dt;
        const pts: V2[] = [];
        for (let q = 0; q <= 8; q++) { const t = t0 + (t1 - t0) * q / 8; pts.push([st.cx + r1 * Math.cos(t), st.cy + r1 * Math.sin(t)]); }
        for (let q = 8; q >= 0; q--) { const t = t0 + (t1 - t0) * q / 8; pts.push([st.cx + r0 * Math.cos(t), st.cy + r0 * Math.sin(t)]); }
        const col = c.circ >= 0 ? 'c2' : 'c4';
        g.poly(pts, { color: col, alpha: cl * (.08 + .32 * Math.abs(c.circ) / big), stroke: 'ink', strokeAlpha: .35 * cl, strokeWidth: 1 });
        // A small turning arrow: counterclockwise for positive circulation.
        const rm = (r0 + r1) / 2 || dr / 2, tm = (t0 + t1) / 2;
        const [mx, my] = g.toScreen(st.cx + (c.i ? rm : dr * .45) * Math.cos(tm), st.cy + (c.i ? rm : dr * .45) * Math.sin(tm));
        const rad = Math.min(9, dr / g.unitX * .22), ccw = c.circ >= 0;
        if (c.i > 0 && rad > 3.5 && Math.abs(c.circ) > big * .04) {
          const end = ccw ? -1.5 * Math.PI : 1.5 * Math.PI;
          ctx.beginPath(); ctx.arc(mx, my, rad, 0, end, ccw);
          ctx.strokeStyle = g.color(col, cl); ctx.lineWidth = 1.5; ctx.stroke();
          const ex = mx + rad * Math.cos(end), ey = my + rad * Math.sin(end);
          const tx = ccw ? Math.sin(end) : -Math.sin(end), ty = ccw ? -Math.cos(end) : Math.cos(end);
          ctx.beginPath(); ctx.moveTo(ex + tx * 4, ey + ty * 4); ctx.lineTo(ex - tx * 2 - ty * 3.5, ey - ty * 2 + tx * 3.5); ctx.lineTo(ex - tx * 2 + ty * 3.5, ey - ty * 2 - tx * 3.5);
          ctx.fillStyle = g.color(col, cl); ctx.fill();
        }
      }
    }

    // The loop, oriented counterclockwise.
    const lp = st.loop;
    if (lp > .01) {
      g.param(t => st.cx + st.R * Math.cos(t), t => st.cy + st.R * Math.sin(t), 0, Math.PI * 2 * lp, { color: 'c1', width: 2.8, samples: 160 });
      for (let q = 0; q < 4; q++) {
        const t = (q + .5) * Math.PI / 2;
        if (t > Math.PI * 2 * lp) continue;
        const x = st.cx + st.R * Math.cos(t), y = st.cy + st.R * Math.sin(t);
        g.arrow(x + Math.sin(t) * .12, y - Math.cos(t) * .12, x, y, { color: 'c1', head: 11 });
      }
      if (lp > .9 && st.paths < .5) { g.point(st.cx, st.cy, { color: 'c1', r: 5, ring: true }); g.text('C', st.cx + st.R * .72, st.cy + st.R * .72, { color: 'c1', font: 'serif', size: 17, offset: [8, -8] }); }
    }

    // Paddle wheel (curl) and pulse (divergence).
    const wl = st.wheel;
    if (wl > .01) {
      const [cx, cy] = g.toScreen(st.wx, st.wy);
      const dv = div(st.wx, st.wy);
      for (let q = 0; q < 3; q++) {
        let ph = (pulse + q / 3) % 1; if (ph < 0) ph += 1;
        const r = 10 + ph * 34;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = g.color('c3', wl * Math.min(1, Math.abs(dv) / 1.5) * (1 - ph) * .9); ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-wheelAngle);
      ctx.beginPath();
      for (let q = 0; q < 4; q++) { const t = q * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t) * 20, Math.sin(t) * 20); }
      ctx.strokeStyle = g.color('c2', wl); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
      for (let q = 0; q < 4; q++) { const t = q * Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(t) * 20, Math.sin(t) * 20, 3.4, 0, Math.PI * 2); ctx.fillStyle = g.color('c2', wl); ctx.fill(); }
      ctx.restore();
      g.point(st.wx, st.wy, { color: 'c2', r: 4.5, ring: true });
      if (s.reduced) {
        // No spinning under reduced motion: a static arrow shows the turning direction instead.
        const c = curl(st.wx, st.wy);
        if (Math.abs(c) > .05) { const dir = c > 0; ctx.beginPath(); ctx.arc(cx, cy, 28, dir ? 0 : Math.PI, dir ? -Math.PI : 0, dir); ctx.strokeStyle = g.color('c2', wl); ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }

    // Conservative beat: two paths from A to B.
    const pa = st.paths;
    if (pa > .01) {
      g.line(st.ax, st.ay, st.bx, st.by, { color: 'c1', width: 3, alpha: pa });
      g.param(t => bez(t)[0], t => bez(t)[1], 0, 1, { color: 'c5', width: 3, alpha: pa, samples: 120 });
      g.line(st.ax, st.ay, st.qx, st.qy, { color: 'c5', width: 1, dash: [3, 4], alpha: .45 * pa });
      g.line(st.qx, st.qy, st.bx, st.by, { color: 'c5', width: 1, dash: [3, 4], alpha: .45 * pa });
      g.point(st.ax, st.ay, { color: 'ink', r: 6, ring: true, halo: true });
      g.point(st.bx, st.by, { color: 'ink', r: 6, ring: true, halo: true });
      g.point(st.qx, st.qy, { color: 'c5', r: 5, ring: true });
      g.text('A', st.ax, st.ay, { offset: [10, 14], weight: 600, size: 15 });
      g.text('B', st.bx, st.by, { offset: [-12, -12], weight: 600, size: 15, align: 'right' });
    }

    // Panels: Green's bookkeeping or the two works.
    const W = Math.min(268, g.width - 24);
    // On narrow stages the beat buttons cover the top edge: the cells panel drops below them,
    // and the paths panel (whose endpoints sit high) moves to the bottom, above the field name.
    const narrow = g.width < 600;
    let Y = narrow ? 60 : 12;
    if (cl > .5) {
      const n = cells.length;
      g.panelPx(12, Y, W, 78, { alpha: .9 });
      g.textPx(`Σ over ${n} cells`, 24, Y + 18, { size: 13, color: 'c2', font: 'mono' });
      g.textPx(fmt(cellSum, 4), W, Y + 18, { size: 13, align: 'right', font: 'mono' });
      g.textPx('∮ boundary C', 24, Y + 39, { size: 13, color: 'c1', font: 'mono' });
      g.textPx(fmt(cellBoundary, 4), W, Y + 39, { size: 13, align: 'right', font: 'mono' });
      g.textPx('∬ curl F dA', 24, Y + 60, { size: 13, color: 'muted', font: 'mono' });
      g.textPx(fmt(curlIntegral(), 4), W, Y + 60, { size: 13, align: 'right', font: 'mono' });
    } else if (pa > .5) {
      const w1 = segWork(st.ax, st.ay, st.bx, st.by, 600), w2 = bezWork();
      const pot = FIELDS[key].pot;
      if (narrow) Y = g.height - 116;
      g.panelPx(12, Y, W, pot ? 78 : 57, { alpha: .9 });
      g.textPx('W straight', 24, Y + 18, { size: 13, color: 'c1', font: 'mono' });
      g.textPx(fmt(w1, 4), W, Y + 18, { size: 13, align: 'right', font: 'mono' });
      g.textPx('W curved', 24, Y + 39, { size: 13, color: 'c5', font: 'mono' });
      g.textPx(fmt(w2, 4), W, Y + 39, { size: 13, align: 'right', font: 'mono' });
      if (pot) {
        g.textPx('f(B) − f(A)', 24, Y + 60, { size: 13, color: 'muted', font: 'mono' });
        g.textPx(fmt(pot(st.bx, st.by) - pot(st.ax, st.ay), 4), W, Y + 60, { size: 13, align: 'right', font: 'mono' });
      }
    }
    g.textPx(FIELDS[key].name, 12, g.height - 14, { color: 'muted', font: 'mono', size: 12 });
  };

  // ---- Field switching ----
  function setField(k: string) {
    if (k === key) return;
    key = k; F = FIELDS[k].F;
    measure();
    for (let i = 0; i < NP; i++) spawn(i, true);
    if (!s.reduced) { st.show = 0; s.tween(st, { show: 1, duration: .6, overwrite: 'auto', ease: 'power2.out', onUpdate: () => plot.invalidate() }); }
    if (seg.get() !== k) seg.set(k);
    readouts(); plot.invalidate();
  }
  const seg = s.segmented('field', setField);

  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .9, overwrite: 'auto', ease: 'power2.inOut', ...vars, onUpdate: () => { syncAnimate(); readouts(); plot.invalidate(); } });
  readouts();
  setFlow(flowing);

  let beat = -1;
  s.onBeat(i => {
    beat = i;
    if (i === 0) { setField('swirl'); to({ loop: 0, wheel: 0, cells: 0, paths: 0 }); }
    if (i === 1) { setField('swirl'); to({ loop: 1, wheel: 0, cells: 0, paths: 0, cx: -.6, cy: -.5 }); }
    if (i === 2) { setField('mixed'); to({ loop: 1, wheel: 1, cells: 0, paths: 0, wx: .6, wy: -1.2 }); s.timeline().call(() => { if (beat === 2) to({ wy: 2, duration: 4, ease: 'power1.inOut' }); }, [], 1.2); }
    if (i === 3) { setField('mixed'); to({ loop: 1, wheel: 0, cells: 1, paths: 0, cx: -.6, cy: -.5 }); kSlider.set(1, .4); s.timeline().call(() => { if (beat === 3) kSlider.set(4, 2.4); }, [], 1); }
    if (i === 4) { setField('grad'); to({ loop: 0, wheel: 0, cells: 0, paths: 1, ax: 1, ay: 0, bx: 0, by: 2, qx: 2.2, qy: 2.2 }); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.show = 1; plot.invalidate(); return; }
    st.show = 0;
    s.tween(st, { show: 1, duration: 1.2, overwrite: 'auto', ease: 'power2.inOut', onUpdate: () => plot.invalidate() });
  });
  rSlider.set(st.R); kSlider.set(st.k);
}
