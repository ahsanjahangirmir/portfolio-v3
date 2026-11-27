// Scene: a double integral as a sum of columns. Rectangle: ∫₁⁴∫₀² (x + √y) dx dy = 46/3.
// Polar: the "ice cream cone" between z = r and z = √(2 − r²), built from wedges whose floor
// area is r Δr Δθ. Its volume is 4π(√2 − 1)/3 ≈ 1.735.
import type * as T from 'three';
import { createSpace, type Vec } from '../engine/space';
import { fmt, type Scene } from '../engine/stage';

const f = (x: number, y: number) => x + Math.sqrt(y);
const EXACT_RECT = 46 / 3;
const top = (r: number) => Math.sqrt(2 - r * r);
const bot = (r: number) => r;
const EXACT_POLAR = 4 * Math.PI * (Math.SQRT2 - 1) / 3;
const MAXN = 30;

export default async function mount(s: Scene) {
  const sp = await createSpace(s, { radius: 13, theta: -1.0, phi: 1.12, target: [1, 2.5, 1.2] });
  const { THREE } = sp;
  let mode = 'rect';
  const st = { n: 4, grow: s.reduced ? 1 : 0, cols: 0, slice: 0, sy: 1, wedge: 0, surf: 1 };

  const axes = sp.axes([2.6, 4.6, 3.6], { negative: false });

  // ---- Rectangle: surface, floor, instanced columns, a sweeping slice ----
  const surf = sp.surface((x, y) => f(x, y), [0, 2], [1, 4], { res: 40, key: 'c1', checker: 8, opacity: .5 });
  const floor = sp.line([[0, 1, 0], [2, 1, 0], [2, 4, 0], [0, 4, 0], [0, 1, 0]], 'ink', { opacity: .7 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0, .5);
  const colMat = sp.material('c3', 'mesh', { roughness: .5, transparent: true, opacity: .92 });
  const cols = new THREE.InstancedMesh(box, colMat, MAXN * MAXN);
  cols.frustumCulled = false;
  sp.world.add(cols);
  const sliceGeo = new THREE.BufferGeometry();
  sliceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
  const slice = new THREE.Mesh(sliceGeo, sp.material('c2', 'basic', { opacity: .55, side: THREE.DoubleSide, depthWrite: false }));
  sp.world.add(slice);
  const sliceEdge = sp.line([], 'c2');
  const sliceLabel = sp.label('A(y)', [0, 0, 0], 'c2');

  // ---- Polar: sphere cap, cone, wedge columns ----
  const cap = sp.paramSurface((r, t) => [r * Math.cos(t), r * Math.sin(t), top(r)], [0, 1], [0, Math.PI * 2], { res: [16, 48], key: 'c1', checker: 8, opacity: .4 });
  const cone = sp.paramSurface((r, t) => [r * Math.cos(t), r * Math.sin(t), bot(r)], [0, 1], [0, Math.PI * 2], { res: [16, 48], key: 'c5', checker: 8, opacity: .35 });
  const disk = sp.line(Array.from({ length: 97 }, (_, i) => [Math.cos(i / 96 * Math.PI * 2), Math.sin(i / 96 * Math.PI * 2), 0] as Vec), 'ink', { opacity: .7 });
  const wedgeMat = sp.material('c3', 'mesh', { roughness: .5, side: THREE.DoubleSide, transparent: true, opacity: .92 });
  const wedges = new THREE.Mesh(new THREE.BufferGeometry(), wedgeMat);
  sp.world.add(wedges);
  const oneMat = sp.material('c2', 'mesh', { roughness: .5, side: THREE.DoubleSide });
  const one = new THREE.Mesh(new THREE.BufferGeometry(), oneMat);
  sp.world.add(one);
  const one2 = sp.line([], 'c2');
  const polarGrid = new THREE.LineSegments(new THREE.BufferGeometry(), sp.material('muted', 'line', { opacity: .55 }));
  sp.world.add(polarGrid);
  let gridN = 0;
  let wedgeTheta = 0;
  const labDr = sp.label('Δr', [0, 0, 0], 'c2'), labDt = sp.label('r Δθ', [0, 0, 0], 'c2');

  const out = { sum: s.readout('sum'), exact: s.readout('exact'), nor: s.readout('nor') };
  const norCtl = s.root.querySelector<HTMLElement>('[data-readout="nor"]')?.closest<HTMLElement>('.ctl');
  const sumLabel = s.root.querySelector<HTMLElement>('[data-readout="sum"]')?.previousElementSibling;
  const show = (l: { el: HTMLElement }, on: boolean) => { l.el.style.visibility = on ? '' : 'hidden'; };

  /** Push the triangles of an annular-sector prism (r0..r1, t0..t1, z from zb to zt) into arr. */
  function wedge(arr: number[], r0: number, r1: number, t0: number, t1: number, zb: number, zt: number, k: number) {
    const P = (r: number, t: number, z: number) => [r * Math.cos(t), r * Math.sin(t), z];
    const quad = (a: number[], b: number[], c: number[], d: number[]) => arr.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < k; i++) {
      const ta = t0 + (t1 - t0) * i / k, tb = t0 + (t1 - t0) * (i + 1) / k;
      quad(P(r0, ta, zt), P(r1, ta, zt), P(r1, tb, zt), P(r0, tb, zt)); // top
      quad(P(r0, ta, zb), P(r0, tb, zb), P(r1, tb, zb), P(r1, ta, zb)); // bottom
      quad(P(r1, ta, zb), P(r1, tb, zb), P(r1, tb, zt), P(r1, ta, zt)); // outer
      if (r0 > 0) quad(P(r0, ta, zb), P(r0, ta, zt), P(r0, tb, zt), P(r0, tb, zb)); // inner
    }
    quad(P(r0, t0, zb), P(r1, t0, zb), P(r1, t0, zt), P(r0, t0, zt));
    quad(P(r0, t1, zb), P(r0, t1, zt), P(r1, t1, zt), P(r1, t1, zb));
  }

  const m4 = new THREE.Matrix4();
  let lastPolarKey = '';
  function update() {
    const n = Math.max(1, Math.round(st.n));
    const g = st.grow, c = st.cols * g;
    const rect = mode === 'rect';
    surf.mesh.visible = floor.line.visible = rect;
    polarGrid.visible = !rect;
    cap.mesh.visible = cone.mesh.visible = disk.line.visible = !rect;
    (surf.mesh.material as T.MeshStandardMaterial).opacity = .5 * g * st.surf;
    (cap.mesh.material as T.MeshStandardMaterial).opacity = .4 * g * st.surf;
    (cone.mesh.material as T.MeshStandardMaterial).opacity = .35 * g * st.surf;

    let sum = 0, noR = 0;
    if (rect) {
      // Height from the front-left corner (x_{i-1}, y_{j-1}) of each cell: f grows in x and y, so every column sits under the surface.
      const dx = 2 / n, dy = 3 / n, gap = n > 1 ? .92 : .97;
      let k = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = i * dx, y = 1 + j * dy, hgt = f(x, y);
        sum += hgt * dx * dy;
        m4.makeScale(dx * gap, dy * gap, Math.max(1e-4, hgt * c));
        m4.setPosition(x + dx / 2, y + dy / 2, 0);
        cols.setMatrixAt(k++, m4);
      }
      cols.count = k;
      cols.instanceMatrix.needsUpdate = true;
      cols.visible = c > .01;
      wedges.visible = one.visible = one2.line.visible = false;
      show(labDr, false); show(labDt, false);
      // Slice at y = sy: the cross-section under z = x + √y has area A(y) = 2 + 2√y.
      const sl = st.slice * g;
      slice.visible = sliceEdge.line.visible = sl > .02;
      show(sliceLabel, sl > .5);
      if (sl > .02) {
        const y = st.sy, q = Math.sqrt(y);
        const pts: Vec[] = [[0, y, 0], [2, y, 0], [2, y, (2 + q) * sl], [0, y, q * sl]];
        const pos = sliceGeo.attributes.position as T.BufferAttribute;
        [pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]].forEach((p, i) => pos.setXYZ(i, ...p));
        pos.needsUpdate = true; sliceGeo.computeBoundingSphere();
        sliceEdge.set([...pts, pts[0]]);
        sliceLabel.set([2.35, y, (2 + q) * .6], `A(${fmt(y, 2)}) = ${fmt(2 + 2 * q, 3)}`);
      }
      out.exact(`46/3 = ${fmt(EXACT_RECT, 3)}`);
      if (sumLabel) sumLabel.textContent = `Sum of ${n * n} columns`;
      if (norCtl) norCtl.style.display = 'none';
    } else {
      cols.visible = false;
      slice.visible = sliceEdge.line.visible = false; show(sliceLabel, false);
      const m = 4 * n, dr = 1 / n, dt = Math.PI * 2 / m;
      for (let i = 0; i < n; i++) {
        const r = (i + .5) * dr, hgt = top(r) - bot(r);
        sum += hgt * r * dr * dt * m;
        noR += hgt * dr * dt * m;
      }
      const key = `${n}|${c.toFixed(3)}`;
      if (key !== lastPolarKey) {
        lastPolarKey = key;
        const arr: number[] = [];
        const k = Math.max(1, Math.ceil(24 / m));
        for (let i = 0; i < n; i++) {
          const r0 = i * dr, r1 = (i + 1) * dr, rm = (i + .5) * dr, zb = bot(rm), zt = zb + (top(rm) - zb) * c;
          for (let j = 0; j < m; j++) wedge(arr, r0 + dr * .03, r1 - dr * .03, j * dt + dt * .04, (j + 1) * dt - dt * .04, zb, Math.max(zb + 1e-3, zt), k);
        }
        wedges.geometry.dispose();
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        geo.computeVertexNormals();
        wedges.geometry = geo;
      }
      wedges.visible = c > .01;
      if (gridN !== n) {
        gridN = n;
        const seg: T.Vector3[] = [];
        for (let i = 1; i <= n; i++) for (let q = 0; q < 96; q++) {
          const a = q / 96 * Math.PI * 2, b = (q + 1) / 96 * Math.PI * 2, r = i * dr;
          seg.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0), new THREE.Vector3(r * Math.cos(b), r * Math.sin(b), 0));
        }
        for (let j = 0; j < m; j++) seg.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(j * dt), Math.sin(j * dt), 0));
        polarGrid.geometry.dispose();
        polarGrid.geometry = new THREE.BufferGeometry().setFromPoints(seg);
      }
      // One highlighted wedge in the outer ring, with its floor sides labelled.
      const w = st.wedge * g;
      one.visible = one2.line.visible = w > .02;
      show(labDr, w > .5); show(labDt, w > .5);
      if (w > .02) {
        const i = n - 1 - Math.floor(n / 3), j = Math.floor((((wedgeTheta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / dt);
        const r0 = i * dr, r1 = (i + 1) * dr, rm = (i + .5) * dr, t0 = j * dt, t1 = (j + 1) * dt, zb = bot(rm), zt = top(rm);
        const arr: number[] = [];
        wedge(arr, r0, r1, t0, t1, zb - .002, zb + (zt - zb) * Math.max(.02, w), Math.max(2, Math.ceil(24 / m)));
        one.geometry.dispose();
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        geo.computeVertexNormals();
        one.geometry = geo;
        // Its footprint on the floor: sides Δr and r Δθ.
        const fp: Vec[] = [];
        for (let q = 0; q <= 12; q++) { const t = t0 + (t1 - t0) * q / 12; fp.push([r1 * Math.cos(t), r1 * Math.sin(t), 0]); }
        for (let q = 12; q >= 0; q--) { const t = t0 + (t1 - t0) * q / 12; fp.push([r0 * Math.cos(t), r0 * Math.sin(t), 0]); }
        fp.push(fp[0]);
        one2.set(fp);
        const tm = (t0 + t1) / 2;
        labDr.set([(rm) * Math.cos(t0) + .14 * Math.sin(t0), rm * Math.sin(t0) - .14 * Math.cos(t0), -.05]);
        labDt.set([(r1 + .2) * Math.cos(tm), (r1 + .2) * Math.sin(tm), -.05]);
      }
      out.exact(`4π(√2−1)/3 = ${fmt(EXACT_POLAR, 3)}`);
      out.nor(fmt(noR, 4));
      if (sumLabel) sumLabel.textContent = `Sum of ${n * m} wedges`;
      if (norCtl) norCtl.style.display = '';
    }
    out.sum(fmt(sum, 4));
    sp.invalidate();
  }

  const slider = s.slider('n', v => { st.n = v; update(); });

  function setMode(m: string) {
    if (m === mode) return;
    mode = m;
    const rect = m === 'rect';
    s.tween(sp.orbit, { radius: rect ? 13 : 6.4, phi: rect ? 1.12 : 1.05, duration: 1.1, overwrite: 'auto', ease: 'power2.inOut', onUpdate: sp.invalidate });
    s.tween(sp.orbit.target, { x: rect ? 1 : 0, y: rect ? 2.5 : 0, z: rect ? 1.2 : .65, duration: 1.1, overwrite: 'auto', ease: 'power2.inOut', onUpdate: sp.invalidate });
    axes.scale.setScalar(rect ? 1 : .55);
    axes.visible = true;
    st.cols = 0;
    lastPolarKey = '';
    if (seg.get() !== m) seg.set(m);
    update();
  }
  const seg = s.segmented('region', m => { if (m === mode) return; setMode(m); syncAxes(); to({ cols: 1, slice: 0, wedge: 0, surf: 1 }); });

  // Axis labels are fixed in world space; keep them for the rectangle, hide them for the small polar view.
  const axisLabels = [...s.stage.querySelectorAll<HTMLElement>('.space-label.is-axis')];
  const syncAxes = () => axisLabels.forEach(l => { l.style.visibility = mode === 'rect' ? '' : 'hidden'; });

  const to = (vars: gsap.TweenVars) => s.tween(st, { duration: .9, overwrite: 'auto', ease: 'power2.inOut', ...vars, onUpdate: update });
  slider.set(st.n);
  update();

  let sweep: gsap.core.Tween | null = null;
  let beat = -1;
  s.onBeat(i => {
    beat = i;
    sweep?.kill(); sweep = null;
    if (i <= 3 && mode !== 'rect') setMode('rect');
    if (i >= 4 && mode !== 'polar') setMode('polar');
    syncAxes();
    if (i === 0) { to({ cols: 0, slice: 0, wedge: 0, surf: 1 }); }
    if (i === 1) { to({ cols: 1, slice: 0, wedge: 0, surf: 1 }); slider.set(2, .6); }
    if (i === 2) { to({ cols: 1, slice: 0, wedge: 0, surf: .6 }); slider.set(2, .3); s.timeline().call(() => { if (beat === 2) slider.set(MAXN, 3.2); }, [], .5); }
    if (i === 3) {
      to({ cols: 0, slice: 1, wedge: 0, surf: 1 });
      st.sy = 1;
      sweep = s.tween(st, { sy: 4, duration: 4, overwrite: 'auto', ease: 'power1.inOut', yoyo: true, repeat: s.reduced ? 0 : 1, onUpdate: update });
    }
    if (i === 4) { to({ cols: 1, slice: 0, wedge: 0, surf: 1 }); slider.set(6, .6); s.tween(sp.orbit, { phi: 1.05, duration: 1, overwrite: 'auto', ease: 'power2.inOut', onUpdate: sp.invalidate }); }
    if (i === 5) {
      wedgeTheta = sp.orbit.theta;
      to({ cols: 0, slice: 0, wedge: 1, surf: .35 }); slider.set(6, .6);
      s.tween(sp.orbit, { phi: .8, duration: 1.1, overwrite: 'auto', ease: 'power2.inOut', onUpdate: sp.invalidate });
    }
  });

  s.onEnter(() => {
    if (s.reduced) { st.grow = 1; update(); return; }
    s.tween(st, { grow: 1, duration: 1.4, overwrite: 'auto', ease: 'power3.out', onUpdate: update });
  });
}
