// Scene: a space curve traced by a moving point, with velocity, acceleration, arc length,
// the T-N-B frame and the osculating circle (example: r(t) = ⟨t, t², 2t³/3⟩ has κ(1) = 2/9).
import type * as T3 from 'three';
import { createSpace, type Vec } from '../engine/space';
import { fmt, type Scene } from '../engine/stage';

type Curve = { r: (t: number) => Vec; t0: number; t1: number; start: number; cam: { radius: number; target: Vec; phi: number }; label: string };
const K = .55;
const CURVES: Record<string, Curve> = {
  helix: { r: t => [1.4 * Math.cos(t), 1.4 * Math.sin(t), .3 * t], t0: 0, t1: 4 * Math.PI, start: 2.2, cam: { radius: 11.5, target: [0, 0, 1.8], phi: 1.2 }, label: 'r(t) = ⟨1.4 cos t, 1.4 sin t, 0.3t⟩' },
  knot: { r: t => [K * (Math.sin(t / 2) + 2 * Math.sin(t)), K * (Math.cos(t / 2) - 2 * Math.cos(t)), -1.5 * K * Math.sin(1.5 * t)], t0: 0, t1: 4 * Math.PI, start: 1.4, cam: { radius: 10.5, target: [0, 0, 0], phi: 1 }, label: 'a trefoil knot' },
  cubic: { r: t => [t, t * t, 2 * t ** 3 / 3], t0: -1, t1: 1, start: 1, cam: { radius: 8, target: [.2, .6, .2], phi: 1.15 }, label: 'r(t) = ⟨t, t², 2t³/3⟩' },
};

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec): Vec => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 0]; };

export default async function mount(s: Scene) {
  const sp = await createSpace(s, { radius: 11.5, theta: -.75, phi: 1.2, target: [0, 0, 1.8] });
  let key = 'helix';
  let C = CURVES.helix;
  const st = { t: C.start, draw: s.reduced ? 1 : 0, motion: 0, frame: 0, circle: 0, trace: 0 };

  const h = 1e-3;
  const d1 = (t: number) => { const a = C.r(t - h), b = C.r(t + h); return [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h), (b[2] - a[2]) / (2 * h)] as Vec; };
  const d2 = (t: number) => { const a = C.r(t - h), b = C.r(t), c = C.r(t + h); return [(a[0] - 2 * b[0] + c[0]) / (h * h), (a[1] - 2 * b[1] + c[1]) / (h * h), (a[2] - 2 * b[2] + c[2]) / (h * h)] as Vec; };
  const speed = (t: number) => len(d1(t));
  // Signed arc length from t = 0 (composite Simpson on |r'|).
  const arc = (t: number) => {
    const n = 200, a = 0, b = t, w = (b - a) / n;
    if (Math.abs(w) < 1e-12) return 0;
    let sum = speed(a) + speed(b);
    for (let i = 1; i < n; i++) sum += speed(a + i * w) * (i % 2 ? 4 : 2);
    return sum * w / 3;
  };

  sp.axes([2.2, 2.2, 2.2]);
  const ghost = sp.tube([], 'c1', .022);
  const ghostMat = ghost.mesh.material as T3.MeshStandardMaterial;
  ghostMat.transparent = true; ghostMat.opacity = .38; ghostMat.depthWrite = false;
  const traced = sp.tube([], 'c1', .045);
  const dot = sp.sphere([0, 0, 0], .08, 'ink');
  const zero = sp.sphere([0, 0, 0], .06, 'muted');
  const vA = sp.arrow([0, 0, 0], [1, 0, 0], 'c2', { radius: .035, head: .22 });
  const aA = sp.arrow([0, 0, 0], [1, 0, 0], 'c5', { radius: .035, head: .22 });
  const tA = sp.arrow([0, 0, 0], [1, 0, 0], 'c2', { radius: .035, head: .2 });
  const nA = sp.arrow([0, 0, 0], [1, 0, 0], 'c4', { radius: .035, head: .2 });
  const bA = sp.arrow([0, 0, 0], [1, 0, 0], 'c3', { radius: .035, head: .2 });
  const circle = sp.line([], 'c5', { opacity: .95 });
  const center = sp.sphere([0, 0, 0], .05, 'c5');
  const radius = sp.line([], 'c5', { dashed: true, opacity: .8 });
  const lab = {
    v: sp.label('v', [0, 0, 0], 'c2'), a: sp.label('a', [0, 0, 0], 'c5'),
    T: sp.label('T', [0, 0, 0], 'c2'), N: sp.label('N', [0, 0, 0], 'c4'), B: sp.label('B', [0, 0, 0], 'c3'),
    R: sp.label('1/κ', [0, 0, 0], 'c5'), O: sp.label('t = 0', [0, 0, 0], 'muted'),
  };
  const show = (l: { el: HTMLElement }, on: boolean) => { l.el.style.visibility = on ? '' : 'hidden'; };
  const out = { speed: s.readout('speed'), s: s.readout('s'), k: s.readout('k') };
  const eq = s.root.querySelector<HTMLElement>('[data-curve-eq]');

  const samples = (a: number, b: number, n: number) => {
    const pts: Vec[] = [];
    for (let i = 0; i <= n; i++) pts.push(C.r(a + (b - a) * i / n));
    return pts;
  };

  function rebuildGhost() {
    const end = C.t0 + (C.t1 - C.t0) * st.draw;
    ghost.set(st.draw > .01 ? samples(C.t0, end, Math.max(8, Math.round(360 * st.draw))) : []);
    zero.position.set(...C.r(0));
    lab.O.set(add(C.r(0), [0, 0, -.32]));
  }

  function update() {
    const t = st.t, p = C.r(t);
    const v = d1(t), a = d2(t);
    const sp1 = len(v), vxa = cross(v, a);
    const kappa = len(vxa) / sp1 ** 3;
    const T = unit(v), B = unit(vxa), N = cross(B, T);
    const on = st.draw > .98;
    dot.position.set(...p); dot.visible = on;

    // Arc length piece from t = 0 to t.
    traced.mesh.visible = on && st.trace > .02 && Math.abs(t) > 1e-3;
    if (traced.mesh.visible) traced.set(samples(0, t * st.trace, Math.max(6, Math.round(Math.abs(t * st.trace) / (C.t1 - C.t0) * 300))));
    zero.visible = on && st.trace > .5;
    show(lab.O, on && st.trace > .5 && Math.abs(t) > .25);

    const m = on ? st.motion : 0;
    vA.group.visible = m > .02; aA.group.visible = m > .02 && len(a) > 1e-3;
    if (m > .02) { vA.set(p, add(p, mul(v, m))); aA.set(p, add(p, mul(a, m))); }
    lab.v.set(add(p, mul(v, m * 1.08 + .05))); lab.a.set(add(p, mul(a, m * 1.08 + .05)));
    show(lab.v, m > .5); show(lab.a, m > .5 && len(a) > .2);

    const f = on ? st.frame : 0;
    tA.group.visible = f > .02; nA.group.visible = bA.group.visible = f > .02 && kappa > 1e-6;
    const L = .95 * f;
    if (f > .02) { tA.set(p, add(p, mul(T, L))); nA.set(p, add(p, mul(N, L))); bA.set(p, add(p, mul(B, L))); }
    lab.T.set(add(p, mul(T, L + .2))); lab.N.set(add(p, mul(N, L + .2))); lab.B.set(add(p, mul(B, L + .2)));
    show(lab.T, f > .5); show(lab.N, f > .5 && kappa > 1e-6); show(lab.B, f > .5 && kappa > 1e-6);

    // Osculating circle: center p + N/κ, radius 1/κ, in the plane of T and N.
    const c = on ? st.circle : 0;
    const R = 1 / kappa;
    const okCircle = c > .02 && kappa > 1e-4;
    circle.line.visible = radius.line.visible = center.visible = okCircle;
    show(lab.R, okCircle && c > .5);
    if (okCircle) {
      const ctr = add(p, mul(N, R));
      const pts: Vec[] = [];
      const n = 120, sweep = Math.PI * 2 * c;
      for (let i = 0; i <= n; i++) {
        const ph = -sweep / 2 + sweep * i / n;
        pts.push(add(ctr, add(mul(N, -R * Math.cos(ph)), mul(T, R * Math.sin(ph)))));
      }
      circle.set(pts);
      radius.set([p, ctr]);
      center.position.set(...ctr);
      lab.R.set(add(add(p, mul(N, R * .5)), mul(T, -.22)));
    }

    out.speed(fmt(sp1, 3));
    out.s(fmt(arc(t), 3));
    out.k(`${fmt(kappa, 3)}  (1/κ = ${fmt(R, 2)})`);
    if (eq) eq.textContent = `${C.label}   t = ${fmt(t, 2)}`;
    sp.invalidate();
  }

  const slider = s.slider('t', v => { st.t = v; update(); });
  const setRange = () => { slider.el.min = String(C.t0); slider.el.max = String(C.t1); slider.el.step = String((C.t1 - C.t0) / 1000); };

  // Play: run t forward along the curve, wrapping around.
  let playing = false;
  const playBtn = s.action('play', () => setPlaying(!playing));
  function setPlaying(on: boolean) {
    playing = on && !s.reduced;
    playBtn?.setAttribute('aria-pressed', String(playing));
    sp.animate = playing;
  }
  s.frame((_, dt) => {
    if (!playing) return;
    let t = st.t + dt * (C.t1 - C.t0) / 9;
    if (t > C.t1) t = C.t0;
    slider.set(t);
  });
  s.cleanup(() => setPlaying(false));

  function setCurve(k: string, animate = true) {
    key = k; C = CURVES[k];
    setRange();
    s.tween(sp.orbit, { radius: C.cam.radius, phi: C.cam.phi, duration: animate ? 1 : 0, overwrite: 'auto', ease: 'power2.inOut', onUpdate: sp.invalidate });
    s.tween(sp.orbit.target, { x: C.cam.target[0], y: C.cam.target[1], z: C.cam.target[2], duration: animate ? 1 : 0, overwrite: 'auto', ease: 'power2.inOut', onUpdate: sp.invalidate });
    if (animate && !s.reduced) {
      st.draw = 0;
      s.tween(st, { draw: 1, duration: 1.1, overwrite: 'auto', ease: 'power2.inOut', onUpdate: () => { rebuildGhost(); update(); } });
    } else { st.draw = 1; rebuildGhost(); }
    slider.set(C.start);
    if (seg.get() !== k) seg.set(k);
  }
  const seg = s.segmented('curve', k => { if (k !== key) setCurve(k); });

  const VIEWS: Record<string, { motion: number; frame: number; circle: number }> = {
    motion: { motion: 1, frame: 0, circle: 0 },
    frame: { motion: 0, frame: 1, circle: 0 },
    circle: { motion: 0, frame: 1, circle: 1 },
  };
  const applyView = (v: string) => s.tween(st, { ...VIEWS[v], duration: .7, overwrite: 'auto', ease: 'power2.inOut', onUpdate: update });
  const view = s.segmented('show', applyView);
  const setView = (v: string) => { if (view.get() !== v) view.set(v); else applyView(v); };
  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .8, overwrite: 'auto', ease: 'power2.inOut', ...vars, onUpdate: update });

  setRange();
  slider.set(st.t);
  rebuildGhost();
  update();

  let beat = -1;
  s.onBeat(i => {
    beat = i;
    if (i !== 4 && i !== 1) setPlaying(false);
    if (i === 0) { if (key !== 'helix') setCurve('helix'); to({ motion: 0, frame: 0, circle: 0, trace: 0 }); }
    if (i === 1) { if (key !== 'helix') setCurve('helix'); setView('motion'); to({ trace: 0 }); }
    if (i === 2) { if (key !== 'cubic') setCurve('cubic'); to({ motion: 0, frame: 0, circle: 0, trace: 1 }); slider.set(1, 1.2); }
    if (i === 3) { if (key !== 'cubic') setCurve('cubic'); setView('circle'); to({ trace: 0 }); slider.set(0, .6); s.timeline().call(() => { if (beat === 3) slider.set(1, 2.4); }, [], .9); }
    if (i === 4) { if (key !== 'knot') setCurve('knot'); setView('frame'); to({ trace: 0 }); if (!s.reduced) setPlaying(true); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; rebuildGhost(); update(); return; }
    st.draw = 0;
    s.tween(st, { draw: 1, duration: 1.6, overwrite: 'auto', ease: 'power2.inOut', onUpdate: () => { rebuildGhost(); update(); } });
  });
}
