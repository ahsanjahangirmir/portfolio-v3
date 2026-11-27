// Hero: a field of points that resolves into a surface z = f(x, y), morphs between three classic
// surfaces, shows the two partial-derivative tangents under the pointer, and spins when dragged. Echoes the portfolio's
// particle sphere: signal becomes structure.
import { alpha, type Scene } from '../engine/stage';

const N = 45; // 45 x 45 = 2,025 points
const SURFACES: { f: (x: number, y: number) => number; tex: string }[] = [
  { f: (x, y) => Math.sin(x) * Math.cos(y) * .9, tex: 'z = \\sin x \\cos y' },
  { f: (x, y) => (x * x - y * y) / 6, tex: 'z = (x^2 - y^2)/6' },
  { f: (x, y) => { const r = Math.hypot(x, y) + 1e-6; return 2.2 * Math.sin(r * 1.6) / (r * 1.6) - .4; }, tex: 'z = \\sin r / r' },
];

export default function mount(s: Scene) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.touchAction = 'pan-y'; // horizontal drags spin the surface, vertical ones scroll
  s.stage.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const caption = s.root.querySelector<HTMLElement>('[data-hero-formula]');
  const formulas = [...(caption?.querySelectorAll<HTMLElement>('[data-i]') ?? [])];
  let w = 0, h = 0, ratio = 1;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height; ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
    if (s.reduced) draw(0);
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  s.cleanup(() => { ro.disconnect(); canvas.remove(); });

  const L = 3.1, COUNT = N * N;
  // Fixed grid and scatter positions. Per-frame buffers are typed arrays, so the 60 fps loop allocates nothing.
  const GX = new Float32Array(COUNT), GY = new Float32Array(COUNT), SX = new Float32Array(COUNT), SY = new Float32Array(COUNT), SZ = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    GX[i] = -L + 2 * L * (i % N) / (N - 1); GY[i] = -L + 2 * L * Math.floor(i / N) / (N - 1);
    SX[i] = Math.sin(i * 12.9898) * 3.2; SY[i] = Math.cos(i * 78.233) * 3.2; SZ[i] = Math.sin(i * 37.719) * 2.2;
  }
  const PX = new Float32Array(COUNT), PY = new Float32Array(COUNT), PD = new Float32Array(COUNT), PP = new Float32Array(COUNT), PZ = new Float32Array(COUNT);
  const sprite = document.createElement('canvas');
  let spriteFor = '';
  const st = { resolve: s.reduced ? 1 : 0, morph: 0, presence: 0 };
  // Pointer: hover shows partial-derivative tangents; dragging spins the surface and lets it coast.
  let mx = 0, my = 0, hover = false, dragging = false, angle = -.75, spinVel = 0, lastX = 0, lastT = 0;
  let index = 0;
  const showFormula = (i: number) => formulas.forEach((el, j) => el.classList.toggle('is-on', j === i));
  showFormula(0);

  const heightAt = (x: number, y: number) => {
    const a = SURFACES[index].f(x, y), b = SURFACES[(index + 1) % SURFACES.length].f(x, y);
    const t = st.morph * st.morph * (3 - 2 * st.morph);
    return a + (b - a) * t;
  };

  // Rotate about z, then look down from an elevation of ~32 degrees with mild perspective.
  const EL = .56, CE = Math.cos(EL), SE = Math.sin(EL), D = 14;
  let scale = 1, c = 1, sn = 0;
  const pt = { X: 0, Y: 0, p: 1, away: 0 };
  function project(x: number, y: number, z: number) {
    const rx = x * c - y * sn, ry = x * sn + y * c;
    const up = z * CE + ry * SE;          // screen-up component
    const away = ry * CE - z * SE;        // distance into the screen
    const persp = D / (D + away);
    pt.X = w / 2 + rx * scale * persp; pt.Y = h / 2 + h * .02 - up * scale * persp; pt.p = persp; pt.away = away;
    return pt;
  }

  let lastFrame = 0;
  function draw(t: number) {
    if (!w || !h) return;
    const dt = Math.min(.05, lastFrame ? t - lastFrame : 0); lastFrame = t;
    // Ease hover presence and coast the drag spin without creating tweens per pointer event.
    st.presence += ((hover || dragging ? 1 : 0) - st.presence) * Math.min(1, dt * 7);
    if (!dragging) { angle += spinVel * dt; spinVel *= Math.pow(.04, dt); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ang = angle + (s.reduced ? 0 : t * .05);
    c = Math.cos(ang); sn = Math.sin(ang);
    scale = Math.min(w, h * 1.2) / 9.6;
    const col = s.colors, k = st.resolve, dot = Math.min(w, h) / 560;
    for (let i = 0; i < COUNT; i++) {
      const z = heightAt(GX[i], GY[i]);
      const q = project(GX[i] * k + SX[i] * (1 - k), GY[i] * k + SY[i] * (1 - k), z * k + SZ[i] * (1 - k));
      PX[i] = q.X; PY[i] = q.Y; PD[i] = -q.away; PP[i] = q.p; PZ[i] = z;
    }
    // Each dot is a stamp of one pre-rendered sprite. Image draws batch into a few GPU operations,
    // where 2,025 separate arcs would be tessellated one by one (slow on software-rendered GPUs).
    if (spriteFor !== col.c1 + ratio) {
      spriteFor = col.c1 + ratio;
      const R = Math.ceil(4 * ratio);
      sprite.width = sprite.height = R * 2;
      const sg = sprite.getContext('2d')!;
      sg.clearRect(0, 0, R * 2, R * 2);
      sg.fillStyle = col.c1; sg.beginPath(); sg.arc(R, R, R - .5, 0, Math.PI * 2); sg.fill();
    }
    let lastAlpha = -1;
    for (let i = 0; i < COUNT; i++) {
      const shade = .25 + .6 * Math.max(0, Math.min(1, (PZ[i] + 1.1) / 2.2));
      const a = Math.round(16 * shade * (.55 + .45 * (1 - (PD[i] + L) / (2 * L)))) / 16;
      if (a !== lastAlpha) { ctx.globalAlpha = a; lastAlpha = a; }
      const r = Math.max(.6, 1.35 * PP[i] * dot);
      ctx.drawImage(sprite, PX[i] - r, PY[i] - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    // Partial-derivative tangents at the pointer's point on the surface.
    if (st.presence > .01 && st.resolve > .9) {
      // Snap to the surface point drawn nearest the pointer (front-most wins ties).
      let best = Infinity, focus = 0;
      for (let i = 0; i < COUNT; i++) {
        const d = (PX[i] - mx) ** 2 + (PY[i] - my) ** 2;
        if (d < best - 1e-6 || (Math.abs(d - best) <= 1e-6 && PD[i] > PD[focus])) { best = d; focus = i; } // nearer the viewer wins ties
      }
      const x0 = GX[focus], y0 = GY[focus], z0 = heightAt(x0, y0), e = 1e-3;
      const fx = (heightAt(x0 + e, y0) - heightAt(x0 - e, y0)) / (2 * e);
      const fy = (heightAt(x0, y0 + e) - heightAt(x0, y0 - e)) / (2 * e);
      const seg = (dx: number, dy: number, dz: number, color: string) => {
        const a = project(x0 - dx, y0 - dy, z0 - dz), ax = a.X, ay = a.Y;
        const b = project(x0 + dx, y0 + dy, z0 + dz);
        ctx.strokeStyle = alpha(color, st.presence); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.X, b.Y); ctx.stroke();
      };
      const len = .9;
      seg(len, 0, fx * len, col.c2);
      seg(0, len, fy * len, col.c3);
      const p = project(x0, y0, z0);
      ctx.fillStyle = col.ground; ctx.strokeStyle = alpha(col.ink, st.presence); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.X, p.Y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  s.frame(t => draw(t));
  s.onTheme(() => { if (s.reduced) draw(0); });

  if (!s.reduced) {
    s.onEnter(() => s.tween(st, { resolve: 1, duration: 2.2, ease: 'power3.out', delay: .2 }));
    // Morph to the next surface every few seconds.
    const cycle = () => {
      const tl = s.timeline({ delay: 4.5, onComplete: () => { index = (index + 1) % SURFACES.length; st.morph = 0; cycle(); } });
      tl.to(st, { morph: 1, duration: 2.2, ease: 'none', onStart: () => showFormula((index + 1) % SURFACES.length) });
    };
    cycle();
  }
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
  const move = (e: PointerEvent) => {
    if (e.pointerType === 'touch' && !dragging) return;
    local(e);
    hover = e.pointerType !== 'touch';
    if (dragging) {
      const now = performance.now(), dx = e.clientX - lastX;
      angle -= dx * .008;
      if (now > lastT) spinVel = spinVel * .6 + (-dx * .008 / ((now - lastT) / 1000)) * .4;
      lastX = e.clientX; lastT = now;
      if (s.reduced) draw(0);
    }
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // A held drag on the canvas would otherwise start a text selection across the hero.
    e.preventDefault();
    dragging = true; spinVel = 0; lastX = e.clientX; lastT = performance.now();
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-dragging');
    local(e);
  };
  const up = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false; canvas.classList.remove('is-dragging');
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (s.reduced) spinVel = 0;
  };
  const leave = () => { hover = false; };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', leave);
  s.cleanup(() => {
    canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('pointerleave', leave);
  });
  resize();
}
