// Scene 18: partial derivatives as slopes of slices, and the tangent plane they span.
import type gsap from 'gsap';
import type * as T from 'three';
import { createSpace, type Vec } from '../engine/space';
import { fmt, type Scene } from '../engine/stage';

const SURFACES: Record<string, (x: number, y: number) => number> = {
  waves: (x, y) => Math.sin(x) * Math.cos(y * .9) * 1.1,
  hill: (x, y) => 2.2 * Math.exp(-(x * x + y * y) / 4) - .6,
  saddle: (x, y) => (x * x - y * y) / 4,
};
const R = 3;

export default async function mount(s: Scene) {
  const sp = await createSpace(s, { radius: 15, theta: -1.05, phi: 1.08, target: [0, 0, -.2], spin: .06 });
  const { THREE } = sp;
  let f = SURFACES.waves;
  const st = { a: .9, b: -.6, grow: s.reduced ? 1 : 0, sx: 0, sy: 0, plane: 0 };
  const g = (x: number, y: number) => f(x, y) * st.grow;
  const e = 1e-4;
  const fx = (x: number, y: number) => (g(x + e, y) - g(x - e, y)) / (2 * e);
  const fy = (x: number, y: number) => (g(x, y + e) - g(x, y - e)) / (2 * e);

  sp.axes([R + .6, R + .6, 2.2]);
  const surf = sp.surface(g, [-R, R], [-R, R], { res: 64, key: 'c3', checker: 12, opacity: .94 });

  // Slice planes (translucent walls) and traces.
  const wallMat = (key: 'c2' | 'c4') => sp.material(key, 'basic', { opacity: .05, side: THREE.DoubleSide, depthWrite: false });
  const wallX = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 4.4), wallMat('c2'));
  wallX.rotation.x = Math.PI / 2; // spans x and z, sits at y = b
  const wallY = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 4.4), wallMat('c4'));
  wallY.rotation.set(Math.PI / 2, Math.PI / 2, 0); // spans y and z, sits at x = a
  sp.world.add(wallX, wallY);
  const traceX = sp.tube([], 'c2', .03);
  const traceY = sp.tube([], 'c4', .03);
  const arrowX = sp.arrow([0, 0, 0], [1, 0, 0], 'c2', { radius: .03 });
  const arrowY = sp.arrow([0, 0, 0], [0, 1, 0], 'c4', { radius: .03 });
  const dot = sp.sphere([0, 0, 0], .11, 'ink');

  // Tangent plane: a square patch centered on P.
  const planeGeo = new THREE.BufferGeometry();
  planeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
  const plane = new THREE.Mesh(planeGeo, sp.material('c1', 'basic', { opacity: .38, side: THREE.DoubleSide, depthWrite: false }));
  const planeEdge = new THREE.LineLoop(new THREE.BufferGeometry(), sp.material('c1', 'line', { opacity: .9 }));
  sp.world.add(plane, planeEdge);
  const labelP = sp.label('P', [0, 0, 0], 'ink');

  const out = { fx: s.readout('fx'), fy: s.readout('fy') };

  function update(rebuildSurface = false) {
    if (rebuildSurface) surf.update(g);
    const { a, b } = st, z0 = g(a, b), sx = fx(a, b), sy = fy(a, b);
    wallX.position.set(0, b, 0); wallY.position.set(a, 0, 0);
    (wallX.material as T.MeshBasicMaterial).opacity = .06 * st.sx;
    (wallY.material as T.MeshBasicMaterial).opacity = .06 * st.sy;
    const n = 90;
    const tx: Vec[] = [], ty: Vec[] = [];
    for (let i = 0; i <= n; i++) { const t = -R + 2 * R * i / n; tx.push([t, b, g(t, b) + .012]); ty.push([a, t, g(a, t) + .012]); }
    traceX.set(st.sx > .02 ? tx : []); traceY.set(st.sy > .02 ? ty : []);
    traceX.mesh.visible = st.sx > .02; traceY.mesh.visible = st.sy > .02;
    const L = 1.5;
    const ux = new THREE.Vector3(1, 0, sx).normalize().multiplyScalar(L * st.sx);
    const uy = new THREE.Vector3(0, 1, sy).normalize().multiplyScalar(L * st.sy);
    arrowX.set([a, b, z0], [a + ux.x, b + ux.y, z0 + ux.z]);
    arrowY.set([a, b, z0], [a + uy.x, b + uy.y, z0 + uy.z]);
    dot.position.set(a, b, z0);
    labelP.set([a - .25, b - .25, z0 + .35]);
    // Plane corners.
    const k = 1.25 * st.plane;
    const corner = (dx: number, dy: number): Vec => [a + dx, b + dy, z0 + sx * dx + sy * dy];
    const c = [corner(-k, -k), corner(k, -k), corner(k, k), corner(-k, k)];
    const pos = planeGeo.attributes.position as T.BufferAttribute;
    [c[0], c[1], c[2], c[0], c[2], c[3]].forEach((v, i) => pos.setXYZ(i, ...v));
    pos.needsUpdate = true; planeGeo.computeBoundingSphere();
    planeEdge.geometry.dispose();
    planeEdge.geometry = new THREE.BufferGeometry().setFromPoints(c.map(v => new THREE.Vector3(...v)));
    plane.visible = planeEdge.visible = st.plane > .02;
    out.fx(fmt(sx, 3)); out.fy(fmt(sy, 3));
    sp.invalidate();
  }

  const sa = s.slider('a', v => { st.a = v; update(); });
  const sb = s.slider('b', v => { st.b = v; update(); });
  s.segmented('surface', v => {
    const from = f, to = SURFACES[v];
    const m = { t: 0 };
    s.tween(m, { t: 1, duration: .9, ease: 'power2.inOut', onUpdate: () => { f = (x, y) => from(x, y) + (to(x, y) - from(x, y)) * m.t; update(true); }, onComplete: () => { f = to; update(true); } });
  });

  const anim = (vars: gsap.TweenVars) => s.tween(st, { duration: .9, ...vars, onUpdate: () => update(vars.grow !== undefined) });
  s.onBeat(i => {
    if (i === 0) anim({ sx: 0, sy: 0, plane: 0 });
    if (i === 1) anim({ sx: 1, sy: 0, plane: 0 });
    if (i === 2) anim({ sx: .6, sy: 1, plane: 0 });
    if (i === 3) anim({ sx: 1, sy: 1, plane: 1 });
    if (i === 4) { anim({ sx: 1, sy: 1, plane: 1 }); }
  });
  s.onEnter(() => { if (!s.reduced) anim({ grow: 1, duration: 1.8, ease: 'power3.out' }); });
  sa.set(st.a); sb.set(st.b);
  update(true);
}
