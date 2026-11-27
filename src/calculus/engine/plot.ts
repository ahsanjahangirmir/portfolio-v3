// Plot2D: a theme-aware 2D canvas in world coordinates, drawn on demand.
// Usage inside a scene module:
//   const plot = new Plot2D(scene, { x: [-1, 4], y: [-1, 9] });
//   plot.render = g => { g.fn(x => x * x, { color: 'c1' }); g.point(2, 4, { color: 'c2' }); };
//   slider.on change → plot.invalidate();
import type { ColorKey, Scene } from './stage';
import { alpha } from './stage';

export type Color = ColorKey | (string & {});
export type View = { x0: number; x1: number; y0: number; y1: number };
export type StrokeOpts = { color?: Color; width?: number; dash?: number[]; alpha?: number; cap?: CanvasLineCap };
export type FillOpts = { color?: Color; alpha?: number; stroke?: Color; strokeWidth?: number; strokeAlpha?: number };
export type TextOpts = {
  color?: Color; size?: number; align?: CanvasTextAlign; baseline?: CanvasTextBaseline;
  font?: 'sans' | 'mono' | 'serif'; weight?: number; offset?: [number, number]; alpha?: number;
  /** Draw a ground-colored halo behind text so it reads over curves. */
  halo?: boolean;
};
export type PlotOpts = {
  x: [number, number]; y: [number, number];
  /** 'equal' keeps one unit the same length on both axes by growing the y (or x) range around its center. */
  aspect?: 'fill' | 'equal';
  axes?: boolean; grid?: boolean; ticks?: boolean;
  /** Axis names drawn at the positive ends. */
  labels?: [string, string];
  host?: HTMLElement;
  /** Inner padding in CSS px. */
  pad?: number;
};
export type Handle = {
  get(): [number, number];
  set(x: number, y: number): void;
  /** Hit radius in CSS px. */
  radius?: number;
  onStart?(): void; onEnd?(): void;
};

const FONTS = { sans: 'Instrument, Arial, sans-serif', mono: "'Courier New', ui-monospace, monospace", serif: "'Times New Roman', serif" };

function niceStep(span: number, target: number) {
  const raw = span / target, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

export class Plot2D {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Requested world window. Tween its fields and call invalidate() (or set animate) to zoom/pan. */
  view: View;
  width = 0; height = 0;
  render: (g: Plot2D) => void = () => {};
  /** Keep redrawing every frame (e.g. during an autoplay). */
  animate = false;
  opts: PlotOpts;
  private dirty = true;
  private handles: Handle[] = [];
  private dragging: Handle | null = null;
  private pointerFns: ((x: number, y: number, kind: 'move' | 'down' | 'up' | 'leave', e: PointerEvent) => void)[] = [];
  private ratio = 1;
  // Effective transform (after aspect fitting).
  private sx = 1; private sy = 1; private ox = 0; private oy = 0;
  ex0 = 0; ex1 = 1; ey0 = 0; ey1 = 1;

  constructor(readonly scene: Scene, opts: PlotOpts) {
    this.opts = { axes: true, grid: true, ticks: true, aspect: 'fill', pad: 0, ...opts };
    this.view = { x0: opts.x[0], x1: opts.x[1], y0: opts.y[0], y1: opts.y[1] };
    const host = opts.host ?? scene.stage;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'plot-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.canvas);
    this.resize();
    scene.frame(() => { if (this.dirty || this.animate) { this.dirty = false; this.draw(); } });
    scene.onTheme(() => this.invalidate());
    // Fonts may arrive after first paint.
    document.fonts?.ready.then(() => this.invalidate());

    const pos = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const down = (e: PointerEvent) => {
      const [px, py] = pos(e);
      const hit = this.hitHandle(px, py, e.pointerType === 'touch' ? 26 : 0);
      if (hit) {
        this.dragging = hit; hit.onStart?.();
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.classList.add('is-dragging');
        e.preventDefault();
      }
      const [wx, wy] = this.toWorld(px, py);
      this.pointerFns.forEach(fn => fn(wx, wy, 'down', e));
    };
    const move = (e: PointerEvent) => {
      const [px, py] = pos(e);
      const [wx, wy] = this.toWorld(px, py);
      if (this.dragging) { this.dragging.set(wx, wy); this.invalidate(); }
      else this.canvas.style.cursor = this.hitHandle(px, py) ? 'grab' : '';
      this.pointerFns.forEach(fn => fn(wx, wy, 'move', e));
    };
    const up = (e: PointerEvent) => {
      if (this.dragging) { this.dragging.onEnd?.(); this.dragging = null; this.canvas.classList.remove('is-dragging'); }
      const [px, py] = pos(e);
      const [wx, wy] = this.toWorld(px, py);
      this.pointerFns.forEach(fn => fn(wx, wy, 'up', e));
    };
    const leave = (e: PointerEvent) => { if (!this.dragging) this.pointerFns.forEach(fn => fn(NaN, NaN, 'leave', e)); };
    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('pointerleave', leave);
    scene.cleanup(() => {
      ro.disconnect();
      this.canvas.removeEventListener('pointerdown', down);
      this.canvas.removeEventListener('pointermove', move);
      this.canvas.removeEventListener('pointerup', up);
      this.canvas.removeEventListener('pointercancel', up);
      this.canvas.removeEventListener('pointerleave', leave);
      this.canvas.remove();
    });
  }

  invalidate() { this.dirty = true; }

  /** Register a draggable point. Draw it yourself in render(); the plot handles hit-testing and dragging. */
  handle(h: Handle) {
    this.handles.push(h);
    // Touch: let the page scroll unless the finger starts on a handle.
    this.canvas.style.touchAction = 'pan-y';
    return h;
  }
  onPointer(fn: (x: number, y: number, kind: 'move' | 'down' | 'up' | 'leave', e: PointerEvent) => void) { this.pointerFns.push(fn); }

  private hitHandle(px: number, py: number, extra = 0) {
    let best: Handle | null = null, bestD = Infinity;
    for (const h of this.handles) {
      const [x, y] = h.get();
      const [hx, hy] = this.toScreen(x, y);
      const d = Math.hypot(hx - px, hy - py);
      if (d < (h.radius ?? 16) + extra && d < bestD) { best = h; bestD = d; }
    }
    return best;
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.ratio = Math.min(devicePixelRatio || 1, 2);
    this.width = r.width; this.height = r.height;
    this.canvas.width = Math.round(r.width * this.ratio);
    this.canvas.height = Math.round(r.height * this.ratio);
    this.draw();
  }

  private fit() {
    const { x0, x1, y0, y1 } = this.view;
    const pad = this.opts.pad ?? 0;
    const w = this.width - pad * 2, h = this.height - pad * 2;
    let ex0 = x0, ex1 = x1, ey0 = y0, ey1 = y1;
    if (this.opts.aspect === 'equal') {
      const ppu = Math.min(w / (x1 - x0), h / (y1 - y0));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      ex0 = cx - w / ppu / 2; ex1 = cx + w / ppu / 2;
      ey0 = cy - h / ppu / 2; ey1 = cy + h / ppu / 2;
    }
    this.ex0 = ex0; this.ex1 = ex1; this.ey0 = ey0; this.ey1 = ey1;
    this.sx = w / (ex1 - ex0); this.sy = h / (ey1 - ey0);
    this.ox = pad - ex0 * this.sx; this.oy = pad + ey1 * this.sy;
  }

  toScreen(x: number, y: number): [number, number] { return [this.ox + x * this.sx, this.oy - y * this.sy]; }
  toWorld(px: number, py: number): [number, number] { return [(px - this.ox) / this.sx, (this.oy - py) / this.sy]; }
  /** World units per CSS pixel along x. */
  get unitX() { return 1 / this.sx; }
  get unitY() { return 1 / this.sy; }

  color(c: Color = 'ink', a = 1) {
    const base = (this.scene.colors as Record<string, string>)[c] ?? c;
    return a >= 1 ? base : alpha(base, a);
  }

  draw() {
    if (!this.width || !this.height) return;
    const g = this.ctx;
    g.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    g.clearRect(0, 0, this.width, this.height);
    this.fit();
    if (this.opts.grid || this.opts.axes) this.drawAxes();
    g.save();
    this.render(this);
    g.restore();
  }

  private drawAxes() {
    const g = this.ctx;
    const { ex0, ex1, ey0, ey1 } = this;
    const stepX = niceStep(ex1 - ex0, Math.max(4, this.width / 90));
    const stepY = niceStep(ey1 - ey0, Math.max(3, this.height / 80));
    g.lineWidth = 1;
    if (this.opts.grid) {
      g.strokeStyle = this.color('grid');
      g.beginPath();
      for (let x = Math.ceil(ex0 / stepX) * stepX; x <= ex1; x += stepX) { const [px] = this.toScreen(x, 0); g.moveTo(Math.round(px) + .5, 0); g.lineTo(Math.round(px) + .5, this.height); }
      for (let y = Math.ceil(ey0 / stepY) * stepY; y <= ey1; y += stepY) { const [, py] = this.toScreen(0, y); g.moveTo(0, Math.round(py) + .5); g.lineTo(this.width, Math.round(py) + .5); }
      g.stroke();
    }
    if (!this.opts.axes) return;
    const [ax, ay] = this.toScreen(0, 0);
    g.strokeStyle = this.color('muted', .55);
    g.beginPath();
    if (ey0 <= 0 && ey1 >= 0) { g.moveTo(0, Math.round(ay) + .5); g.lineTo(this.width, Math.round(ay) + .5); }
    if (ex0 <= 0 && ex1 >= 0) { g.moveTo(Math.round(ax) + .5, 0); g.lineTo(Math.round(ax) + .5, this.height); }
    g.stroke();
    if (this.opts.ticks) {
      g.fillStyle = this.color('muted');
      g.font = `11px ${FONTS.mono}`;
      const yAxisVisible = ey0 <= 0 && ey1 >= 0;
      const xAxisVisible = ex0 <= 0 && ex1 >= 0;
      const labelY = yAxisVisible ? Math.min(Math.max(ay + 6, 4), this.height - 16) : this.height - 16;
      const labelX = xAxisVisible ? Math.min(Math.max(ax - 6, 30), this.width - 4) : 30;
      g.textAlign = 'center'; g.textBaseline = 'top';
      const fmtTick = (v: number, step: number) => {
        const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
        return (Math.abs(v) < step / 1e6 ? 0 : v).toFixed(d).replace('-', '−');
      };
      for (let x = Math.ceil(ex0 / stepX) * stepX; x <= ex1; x += stepX) {
        if (Math.abs(x) < stepX / 1e6) continue;
        const [px] = this.toScreen(x, 0);
        if (px < 12 || px > this.width - 12) continue;
        g.fillText(fmtTick(x, stepX), px, labelY);
      }
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (let y = Math.ceil(ey0 / stepY) * stepY; y <= ey1; y += stepY) {
        if (Math.abs(y) < stepY / 1e6) continue;
        const [, py] = this.toScreen(0, y);
        if (py < 10 || py > this.height - 10) continue;
        g.fillText(fmtTick(y, stepY), labelX, py);
      }
    }
    if (this.opts.labels) {
      g.fillStyle = this.color('muted');
      g.font = `italic 15px ${FONTS.serif}`;
      if (ey0 <= 0 && ey1 >= 0) { g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(this.opts.labels[0], this.width - 8, ay - 6); }
      if (ex0 <= 0 && ex1 >= 0) { g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(this.opts.labels[1], ax + 8, 8); }
    }
  }

  // ---------- Painter (world coordinates) ----------

  private stroke(o: StrokeOpts = {}) {
    const g = this.ctx;
    g.strokeStyle = this.color(o.color ?? 'c1', o.alpha ?? 1);
    g.lineWidth = o.width ?? 2.5;
    g.lineCap = o.cap ?? 'round'; g.lineJoin = 'round';
    g.setLineDash(o.dash ?? []);
    g.stroke();
    g.setLineDash([]);
  }

  /** Graph y = f(x) over [from, to] (defaults to the visible range). Breaks at jumps and non-finite values. Progress 0..1 draws part of the curve (for write-on animation). */
  fn(f: (x: number) => number, o: StrokeOpts & { from?: number; to?: number; samples?: number; progress?: number } = {}) {
    const g = this.ctx;
    const a = Math.max(o.from ?? this.ex0, this.ex0), bFull = Math.min(o.to ?? this.ex1, this.ex1);
    const b = a + (bFull - a) * (o.progress ?? 1);
    const n = o.samples ?? Math.ceil(this.width * 1.5);
    g.beginPath();
    let pen = false, prevY = 0;
    const limit = (this.ey1 - this.ey0) * 4;
    for (let i = 0; i <= n; i++) {
      const x = a + (b - a) * i / n;
      const y = f(x);
      if (!Number.isFinite(y) || Math.abs(y) > 1e6) { pen = false; continue; }
      const [px, py] = this.toScreen(x, Math.max(this.ey0 - limit, Math.min(this.ey1 + limit, y)));
      if (pen && Math.abs(y - prevY) > limit) pen = false;
      if (pen) g.lineTo(px, py); else g.moveTo(px, py);
      pen = true; prevY = y;
    }
    this.stroke(o);
  }

  /** Parametric curve (x(t), y(t)). */
  param(fx: (t: number) => number, fy: (t: number) => number, t0: number, t1: number, o: StrokeOpts & { samples?: number } = {}) {
    const g = this.ctx, n = o.samples ?? 600;
    g.beginPath();
    let pen = false;
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n, x = fx(t), y = fy(t);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { pen = false; continue; }
      const [px, py] = this.toScreen(x, y);
      if (pen) g.lineTo(px, py); else g.moveTo(px, py);
      pen = true;
    }
    this.stroke(o);
  }

  line(x1: number, y1: number, x2: number, y2: number, o: StrokeOpts = {}) {
    const g = this.ctx;
    const [a, b] = this.toScreen(x1, y1), [c, d] = this.toScreen(x2, y2);
    g.beginPath(); g.moveTo(a, b); g.lineTo(c, d);
    this.stroke({ width: 2, ...o });
  }

  /** Line through (x0, y0) with slope m, across the whole view. */
  slopeLine(x0: number, y0: number, m: number, o: StrokeOpts & { span?: number } = {}) {
    const span = o.span ?? (this.ex1 - this.ex0) * 2;
    this.line(x0 - span, y0 - m * span, x0 + span, y0 + m * span, o);
  }

  vline(x: number, o: StrokeOpts = {}) { this.line(x, this.ey0 - 1, x, this.ey1 + 1, { width: 1, color: 'muted', dash: [4, 5], ...o }); }
  hline(y: number, o: StrokeOpts = {}) { this.line(this.ex0 - 1, y, this.ex1 + 1, y, { width: 1, color: 'muted', dash: [4, 5], ...o }); }

  poly(points: [number, number][], o: FillOpts & StrokeOpts & { close?: boolean; fill?: boolean } = {}) {
    const g = this.ctx;
    g.beginPath();
    points.forEach(([x, y], i) => { const [px, py] = this.toScreen(x, y); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    if (o.close !== false && o.fill !== false) g.closePath();
    if (o.fill !== false) { g.fillStyle = this.color(o.color ?? 'c1', o.alpha ?? .2); g.fill(); }
    if (o.stroke) { g.strokeStyle = this.color(o.stroke, o.strokeAlpha ?? 1); g.lineWidth = o.strokeWidth ?? 1.5; g.lineJoin = 'round'; g.stroke(); }
  }

  /** Fill between y = top(x) and y = bottom(x) (default the x-axis) on [a, b]. */
  area(top: (x: number) => number, a: number, b: number, o: FillOpts & { bottom?: (x: number) => number; samples?: number } = {}) {
    if (b < a) [a, b] = [b, a];
    const n = o.samples ?? 200, pts: [number, number][] = [];
    const bottom = o.bottom ?? (() => 0);
    for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; pts.push([x, top(x)]); }
    for (let i = n; i >= 0; i--) { const x = a + (b - a) * i / n; pts.push([x, bottom(x)]); }
    this.poly(pts.map(([x, y]) => [x, Number.isFinite(y) ? Math.max(this.ey0 - 10, Math.min(this.ey1 + 10, y)) : 0]), o);
  }

  rect(x: number, y: number, w: number, h: number, o: FillOpts = {}) {
    this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o);
  }

  /** Circle with world-space radius. */
  circle(cx: number, cy: number, r: number, o: FillOpts & StrokeOpts & { fill?: boolean } = {}) {
    const g = this.ctx;
    const [px, py] = this.toScreen(cx, cy);
    g.beginPath(); g.ellipse(px, py, Math.abs(r * this.sx), Math.abs(r * this.sy), 0, 0, Math.PI * 2);
    if (o.fill) { g.fillStyle = this.color(o.color ?? 'c1', o.alpha ?? .2); g.fill(); }
    if (o.stroke || !o.fill) { g.strokeStyle = this.color(o.stroke ?? o.color ?? 'c1', o.strokeAlpha ?? 1); g.lineWidth = o.width ?? 2; g.setLineDash(o.dash ?? []); g.stroke(); g.setLineDash([]); }
  }

  /** A dot with a screen-space radius. ring draws a hollow handle-style dot. */
  point(x: number, y: number, o: { color?: Color; r?: number; ring?: boolean; alpha?: number; halo?: boolean } = {}) {
    const g = this.ctx;
    const [px, py] = this.toScreen(x, y);
    const r = o.r ?? 5;
    if (o.halo) { g.beginPath(); g.arc(px, py, r + 7, 0, Math.PI * 2); g.fillStyle = this.color(o.color ?? 'c1', .16); g.fill(); }
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2);
    if (o.ring) { g.fillStyle = this.color('ground'); g.fill(); g.lineWidth = 2; g.strokeStyle = this.color(o.color ?? 'c1', o.alpha ?? 1); g.stroke(); }
    else { g.fillStyle = this.color(o.color ?? 'c1', o.alpha ?? 1); g.fill(); }
  }

  /** Arrow from (x1,y1) to (x2,y2) with a screen-space head. */
  arrow(x1: number, y1: number, x2: number, y2: number, o: StrokeOpts & { head?: number } = {}) {
    const g = this.ctx;
    const [a, b] = this.toScreen(x1, y1), [c, d] = this.toScreen(x2, y2);
    const len = Math.hypot(c - a, d - b);
    if (len < .5) return;
    const head = Math.min(o.head ?? 10, len * .45), ang = Math.atan2(d - b, c - a);
    const bx = c - Math.cos(ang) * head * .8, by = d - Math.sin(ang) * head * .8;
    g.beginPath(); g.moveTo(a, b); g.lineTo(bx, by);
    this.stroke({ width: 2, ...o });
    g.beginPath();
    g.moveTo(c, d);
    g.lineTo(c - Math.cos(ang - .42) * head, d - Math.sin(ang - .42) * head);
    g.lineTo(c - Math.cos(ang + .42) * head, d - Math.sin(ang + .42) * head);
    g.closePath();
    g.fillStyle = this.color(o.color ?? 'c1', o.alpha ?? 1); g.fill();
  }

  /** Text at a world position. offset is in CSS px. */
  text(str: string, x: number, y: number, o: TextOpts = {}) {
    const g = this.ctx;
    const [px0, py0] = this.toScreen(x, y);
    this.textPx(str, px0 + (o.offset?.[0] ?? 0), py0 + (o.offset?.[1] ?? 0), o);
  }

  /** A ground-colored card at a screen position (CSS px), to sit legends and tables on. */
  panelPx(px: number, py: number, w: number, h: number, o: { alpha?: number; border?: boolean } = {}) {
    const g = this.ctx;
    g.fillStyle = this.color('ground', o.alpha ?? .86);
    g.fillRect(px, py, w, h);
    if (o.border !== false) { g.strokeStyle = this.color('line'); g.lineWidth = 1; g.strokeRect(Math.round(px) + .5, Math.round(py) + .5, Math.round(w), Math.round(h)); }
  }

  /** Text at a screen position (CSS px), for legends and corner readouts. */
  textPx(str: string, px: number, py: number, o: TextOpts = {}) {
    const g = this.ctx;
    const size = o.size ?? 14;
    const face = FONTS[o.font ?? 'sans'];
    g.font = `${o.font === 'serif' ? 'italic ' : ''}${o.weight ?? 500} ${size}px ${face}`;
    g.textAlign = o.align ?? 'left'; g.textBaseline = o.baseline ?? 'middle';
    if (o.halo !== false) {
      g.lineWidth = 4; g.strokeStyle = this.color('ground', .9 * (o.alpha ?? 1)); g.lineJoin = 'round';
      g.strokeText(str, px, py);
    }
    g.fillStyle = this.color(o.color ?? 'ink', o.alpha ?? 1);
    g.fillText(str, px, py);
  }
}

/** Numerical helpers shared by scenes. */
export const num = {
  deriv: (f: (x: number) => number, x: number, h = 1e-4) => (f(x + h) - f(x - h)) / (2 * h),
  deriv2: (f: (x: number) => number, x: number, h = 1e-3) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h),
  integrate(f: (x: number) => number, a: number, b: number, n = 400) {
    // Composite Simpson.
    if (n % 2) n++;
    const h = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return s * h / 3;
  },
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  clamp: (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)),
};
