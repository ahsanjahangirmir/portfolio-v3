// Scene: solids of revolution by disks, washers and shells, and surface area.
// A flat region in the x–y plane (drawn as the x–z plane, z up) is swept around an axis by an angle
// slider; one representative slice (disk, washer, shell, or skin band) spins with it.
import type * as T from 'three';
import { createSpace, type Vec } from '../engine/space';
import { num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Mode = 'disk' | 'washer' | 'shell';
type Spec = {
  a: number; b: number;
  outer: (x: number) => number; inner: (x: number) => number;
  /** Revolve about the x-axis (disk, washer) or the y-axis (shell). */
  axis: 'x' | 'y';
  /** Cross-section area (disk, washer) or shell area 2πx·h, as a function of x. */
  A: (x: number) => number;
  exact: number; exactLabel: string;
  /** Integrand for the area of the curved outer surface */
  skin: (x: number) => number;
  camera: { target: Vec; radius: number };
  label: string;
};
const PI = Math.PI, TAU = 2 * PI;
const inv2 = (x: number) => 1 / (x * x);
const SPECS: Record<Mode, Spec> = {
  disk: {
    a: 1, b: 2, outer: inv2, inner: () => 0, axis: 'x',
    A: x => PI * inv2(x) ** 2, exact: 7 * PI / 24, exactLabel: '7π/24',
    skin: x => TAU * inv2(x) * Math.sqrt(1 + 4 / x ** 6),
    camera: { target: [1.45, 0, .1], radius: 6.4 }, label: 'y = 1/x²',
  },
  washer: {
    a: 0, b: 1, outer: x => Math.sqrt(x), inner: x => x * x, axis: 'x',
    A: x => PI * (x - x ** 4), exact: 3 * PI / 10, exactLabel: '3π/10',
    skin: x => TAU * Math.sqrt(x + .25), // 2π√x·√(1 + 1/(4x))
    camera: { target: [.5, 0, .1], radius: 5.6 }, label: 'y = √x',
  },
  shell: {
    a: 1, b: 2, outer: inv2, inner: () => 0, axis: 'y',
    A: x => TAU * x * inv2(x), exact: TAU * Math.LN2, exactLabel: '2π ln 2',
    skin: x => TAU * x * Math.sqrt(1 + 4 / x ** 6),
    camera: { target: [0, 0, .35], radius: 9 }, label: 'y = 1/x²',
  },
};

export default async function mount(s: Scene) {
  const sp = await createSpace(s, { radius: 6.4, theta: -PI / 2, phi: PI / 2, target: [1.45, 0, .1], fov: 34 });
  const { THREE } = sp;
  let mode: Mode = 'disk';
  let spec = SPECS.disk;
  const st = { sweep: 0, x: 1.5, slice: 0, band: 0, grow: s.reduced ? 1 : 0 };
  const D = .07; // drawn slice thickness

  // ---------- Static pieces ----------
  sp.axes([2.7, 2.3, 1.6], { labels: false });
  sp.label('x', [2.9, 0, 0], 'muted', { className: 'is-axis' });
  sp.label('y', [0, 0, 1.75], 'muted', { className: 'is-axis' });
  const axisLine = sp.line([], 'c5', { dashed: true, opacity: .9 });
  const axisLabel = sp.label('axis of rotation', [0, 0, 0], 'c5');
  const curveLabel = sp.label('', [0, 0, 0], 'c1');

  // Revolve a point (x, r) of the region by angle φ.
  const P = (x: number, r: number, phi: number): Vec => spec.axis === 'x'
    ? [x, -r * Math.sin(phi), r * Math.cos(phi)]
    : [x * Math.cos(phi), x * Math.sin(phi), r];

  // Solid surfaces (u, v ∈ [0, 1]); rebuilt when the sweep or mode changes.
  const RES: [number, number] = [36, 56];
  const surfOpts = { res: RES, key: 'c3' as const, checker: 10 };
  const surfaces = {
    outer: sp.paramSurface(() => [0, 0, 0], [0, 1], [0, 1], surfOpts),
    inner: sp.paramSurface(() => [0, 0, 0], [0, 1], [0, 1], { ...surfOpts, key: 'c5', checker: 10 }),
    capA: sp.paramSurface(() => [0, 0, 0], [0, 1], [0, 1], { res: [8, 56], key: 'c3', checker: 10 }),
    capB: sp.paramSurface(() => [0, 0, 0], [0, 1], [0, 1], { res: [8, 56], key: 'c3', checker: 10 }),
  };
  const solidMats = Object.values(surfaces).map(o => o.mesh.material as T.MeshStandardMaterial);

  function buildSolid() {
    const { a, b, outer, inner } = spec, sw = Math.max(1e-4, st.sweep);
    const lerp = (u: number) => a + (b - a) * u;
    const vis = st.sweep > .005;
    if (spec.axis === 'x') {
      // Outer skin, inner skin (washer), end caps (disk).
      surfaces.outer.update((u, v) => P(lerp(u), outer(lerp(u)) * st.grow, v * sw));
      const hasInner = mode === 'washer';
      surfaces.inner.mesh.visible = vis && hasInner;
      if (hasInner) surfaces.inner.update((u, v) => P(lerp(u), inner(lerp(u)) * st.grow, v * sw));
      surfaces.capA.mesh.visible = surfaces.capB.mesh.visible = vis && mode === 'disk';
      if (mode === 'disk') {
        surfaces.capA.update((u, v) => P(a, u * outer(a) * st.grow, v * sw));
        surfaces.capB.update((u, v) => P(b, u * outer(b) * st.grow, v * sw));
      }
    } else {
      // Shell solid: top surface, inner and outer walls, floor.
      surfaces.outer.update((u, v) => P(lerp(u), outer(lerp(u)) * st.grow, v * sw));
      surfaces.inner.update((u, v) => P(lerp(u), 0, v * sw));
      surfaces.capA.update((u, v) => P(a, u * outer(a) * st.grow, v * sw));
      surfaces.capB.update((u, v) => P(b, u * outer(b) * st.grow, v * sw));
      surfaces.inner.mesh.visible = surfaces.capA.mesh.visible = surfaces.capB.mesh.visible = vis;
    }
    surfaces.outer.mesh.visible = vis;
  }

  // Flat region (and its copy at the far edge of the sweep).
  const regionMat = sp.material('c3', 'basic', { opacity: .42, side: THREE.DoubleSide, depthWrite: false });
  const regionGeo = new THREE.BufferGeometry();
  const region0 = new THREE.Mesh(regionGeo, regionMat), regionS = new THREE.Mesh(regionGeo, regionMat);
  const regionGroup = new THREE.Group(); regionGroup.add(regionS);
  sp.world.add(region0, regionGroup);
  const topCurve = sp.tube([], 'c1', .018), lowCurve = sp.tube([], 'c5', .018);

  function buildRegion() {
    const { a, b, outer, inner } = spec, n = 80, pos: number[] = [];
    const at = (x: number, r: number) => spec.axis === 'x' ? [x, 0, r] : [x, 0, r];
    for (let i = 0; i < n; i++) {
      const x0 = a + (b - a) * i / n, x1 = a + (b - a) * (i + 1) / n;
      const p = [at(x0, inner(x0)), at(x1, inner(x1)), at(x1, outer(x1) * st.grow), at(x0, outer(x0) * st.grow)];
      [p[0], p[1], p[2], p[0], p[2], p[3]].forEach(v => pos.push(...v));
    }
    regionGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    regionGeo.computeBoundingSphere();
    const pts = (g: (x: number) => number, k = 1): Vec[] => Array.from({ length: 81 }, (_, i) => { const x = a + (b - a) * i / 80; return [x, 0, g(x) * k]; });
    topCurve.set(pts(outer, st.grow));
    lowCurve.set(mode === 'washer' ? pts(inner) : []);
    lowCurve.mesh.visible = mode === 'washer';
  }

  // Representative slice: a lathe of a thin rectangle (or of a short piece of curve for the skin band).
  const sliceMat = sp.material('c2', 'mesh', { side: THREE.DoubleSide });
  const slice = new THREE.Mesh(new THREE.BufferGeometry(), sliceMat);
  const stripMat = sp.material('c2', 'basic', { opacity: .95, side: THREE.DoubleSide });
  const strip = new THREE.Mesh(new THREE.BufferGeometry(), stripMat);
  sp.world.add(slice, strip);

  function buildSlice() {
    const x = st.x, { outer, inner } = spec, band = st.band > .5;
    const show = st.slice > .01;
    slice.visible = strip.visible = show;
    if (!show) return;
    const R = outer(x) * st.grow, r = inner(x), lo = x - D / 2, hi = x + D / 2;
    let prof: [number, number][];
    if (spec.axis === 'x') {
      if (band) { const e = .012; prof = [[outer(lo) + e, lo], [outer(hi) + e, hi]]; }
      else prof = [[r * 1.0, lo], [R * 1.03, lo], [R * 1.03, hi], [r, hi], [r, lo]];
    } else prof = [[lo, 0], [hi, 0], [hi, R * 1.02], [lo, R * 1.02], [lo, 0]];
    const sw = st.sweep, segs = Math.max(3, Math.round(72 * sw / TAU));
    slice.geometry.dispose();
    if (sw > .01) {
      // Lathe revolves around +Y starting at +Z (axis x) or +X (axis y, via phiStart).
      slice.geometry = new THREE.LatheGeometry(prof.map(([px, py]) => new THREE.Vector2(Math.max(px, 1e-4), py)), segs, spec.axis === 'x' ? 0 : PI / 2, sw);
      slice.visible = true;
    } else { slice.geometry = new THREE.BufferGeometry(); slice.visible = false; }
    if (spec.axis === 'x') slice.rotation.set(0, 0, -PI / 2); else slice.rotation.set(PI / 2, 0, 0);
    // The flat strip the slice comes from.
    const quad = band
      ? [[lo, -.004, outer(lo) - .01], [hi, -.004, outer(hi) - .01], [hi, -.004, outer(hi) + .02], [lo, -.004, outer(lo) + .02]]
      : [[lo, -.004, r], [hi, -.004, r], [hi, -.004, R], [lo, -.004, R]];
    const q = [quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]].flat();
    strip.geometry.dispose();
    strip.geometry = new THREE.BufferGeometry();
    strip.geometry.setAttribute('position', new THREE.Float32BufferAttribute(q, 3));
  }

  // Readouts.
  const out = { area: s.readout('area'), volume: s.readout('volume'), skin: s.readout('skin') };
  const areaLabel = s.root.querySelector<HTMLElement>('[data-area-label]');

  function update(rebuild = true) {
    if (rebuild) { buildSolid(); buildRegion(); }
    buildSlice();
    regionGroup.rotation.set(spec.axis === 'x' ? st.sweep : 0, 0, spec.axis === 'y' ? st.sweep : 0);
    regionS.visible = st.sweep > .01 && st.sweep < TAU - .01;
    // See-through solid while a slice is shown.
    const op = 1 - .6 * st.slice;
    for (const m of solidMats) {
      const tr = op < .99;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = op; m.depthWrite = !tr;
    }
    const V = num.integrate(spec.A, spec.a, spec.b, 400);
    out.area(fmt(spec.A(st.x), 4));
    out.volume(`${fmt(V, 5)} = ${spec.exactLabel}`);
    out.skin(fmt(num.integrate(spec.skin, spec.a, spec.b, 400), 4));
    sp.invalidate();
  }

  function setMode(v: Mode) {
    mode = v; spec = SPECS[v];
    sx.el.min = String(spec.a + D / 2); sx.el.max = String(spec.b - D / 2);
    st.x = num.clamp(st.x, spec.a + D / 2, spec.b - D / 2);
    sx.set(st.x);
    if (areaLabel) areaLabel.textContent = v === 'disk' ? 'π r²' : v === 'washer' ? 'π(R² − r²)' : '2π x h';
    curveLabel.set(v === 'washer' ? [.62, 0, Math.sqrt(.62) + .2] : v === 'disk' ? [1.25, 0, inv2(1.25) + .22] : [1.35, 0, inv2(1.35) + .25], spec.label);
    if (spec.axis === 'x') { axisLine.set([[-.4, 0, 0], [2.6, 0, 0]]); axisLabel.set([spec.b + .45, 0, -.18]); }
    else { axisLine.set([[0, 0, -.3], [0, 0, 1.55]]); axisLabel.set([0, 0, -.45]); }
    update();
  }

  const ss = s.slider('sweep', v => { st.sweep = v; update(); });
  const sx = s.slider('x', v => { st.x = v; update(false); });
  const seg = s.segmented('mode', v => {
    setMode(v as Mode);
    flyTo(1.05);
    if (!s.reduced) { ss.set(0); ss.set(TAU, 1.8); }
  });

  // Camera moves.
  function flyTo(duration = 1, front = false) {
    const c = spec.camera;
    s.tween(sp.orbit, { radius: c.radius, theta: front ? -PI / 2 : -1.1, phi: front ? PI / 2 : 1.12, duration, ease: 'power2.inOut', onUpdate: sp.invalidate });
    s.tween(sp.orbit.target, { x: c.target[0], y: c.target[1], z: c.target[2], duration, ease: 'power2.inOut', onUpdate: sp.invalidate });
  }

  const anim = (vars: gsap.TweenVars) => s.tween(st, { duration: .8, ...vars, onUpdate: () => update() });
  const ensure = (v: Mode) => { if (seg.get() !== v) seg.set(v); };
  setMode('disk');
  ss.set(0);

  s.onBeat(i => {
    if (i === 0) { ensure('disk'); anim({ slice: 0, band: 0 }); ss.set(0, .8); flyTo(1, true); }
    if (i === 1) { ensure('disk'); anim({ slice: 0, band: 0 }); flyTo(1.4); ss.set(0); ss.set(TAU, 2.6); }
    if (i === 2) { ensure('disk'); flyTo(1.2); anim({ slice: 1, band: 0 }); if (st.sweep < 1) ss.set(TAU, 1.2); sx.set(1.12); sx.set(1.8, 2.6); }
    if (i === 3) { ensure('disk'); flyTo(1.2); anim({ slice: 1 }); st.band = 1; update(); sx.set(1.3, 1); if (st.sweep < 1) ss.set(TAU, 1.2); }
    if (i === 4) { st.band = 0; ensure('washer'); anim({ slice: 1 }); sx.set(.5, 1.4); }
    if (i === 5) { st.band = 0; ensure('shell'); anim({ slice: 1 }); sx.set(1.4, 1.4); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.grow = 1; update(); return; }
    s.tween(st, { grow: 1, duration: 1.2, ease: 'power3.out', onUpdate: () => update() });
  });
}
