// Scene: vectors, the dot product as a shadow, the cross product as a perpendicular area,
// and the plane through three points (example: P(1,1,1), Q(2,0,1), R(2,1,0) gives x + y + z = 3).
import type * as T from 'three';
import { createSpace, type Vec } from '../engine/space';
import { fmt, type Scene } from '../engine/stage';

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec): Vec => { const l = len(a); return l > 1e-9 ? mul(a, 1 / l) : [0, 0, 0]; };
const vec = (a: Vec, d = 2) => `⟨${a.map(c => fmt(c, d)).join(', ')}⟩`;

// u is fixed per mode; v comes from the sliders.
const U_FREE: Vec = [1.6, .8, 0];
const P: Vec = [1, 1, 1];
const U_PLANE: Vec = [1, -1, 0];   // PQ = Q − P
const V_PLANE: Vec = [1, 0, -1];   // PR = R − P
const V_FREE: Vec = [.4, 1.8, 1];

export default async function mount(s: Scene) {
  const sp = await createSpace(s, { radius: 10, theta: -1.2, phi: 1.2, target: [.7, .5, .55] });
  const { THREE } = sp;
  let mode = 'dot';
  const st = {
    u: [...U_FREE] as Vec, o: [0, 0, 0] as Vec, v: [...V_FREE] as Vec,
    grow: s.reduced ? 1 : 0, proj: 0, para: 0, cross: 0, plane: 0, show: 1,
  };

  sp.axes(2.6);
  const arrowU = sp.arrow([0, 0, 0], [1, 0, 0], 'c1', { radius: .045, head: .28 });
  const arrowV = sp.arrow([0, 0, 0], [0, 1, 0], 'c5', { radius: .045, head: .28 });
  const arrowP = sp.arrow([0, 0, 0], [1, 0, 0], 'c2', { radius: .075, head: .3 });
  const arrowX = sp.arrow([0, 0, 0], [0, 0, 1], 'c2', { radius: .05, head: .3 });
  const drop = sp.line([], 'muted', { dashed: true, opacity: .9 });
  const corner = sp.line([], 'muted', { opacity: .9 });
  const arc = sp.line([], 'ink', { opacity: .85 });

  // Parallelogram spanned by u and v (blue), and the plane patch with its grid.
  const quad = (key: 'c3', opacity: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
    const mesh = new THREE.Mesh(geo, sp.material(key, 'basic', { opacity, side: THREE.DoubleSide, depthWrite: false }));
    sp.world.add(mesh);
    return { mesh, set(c: Vec[]) {
      const pos = geo.attributes.position as T.BufferAttribute;
      [c[0], c[1], c[2], c[0], c[2], c[3]].forEach((p, i) => pos.setXYZ(i, ...p));
      pos.needsUpdate = true; geo.computeBoundingSphere();
    } };
  };
  const para = quad('c3', .32);
  const paraEdge = sp.line([], 'c3', { opacity: .95 });
  const planeQuad = quad('c3', .2);
  const gridMat = sp.material('c3', 'line', { opacity: .4 });
  const grid = new THREE.LineSegments(new THREE.BufferGeometry(), gridMat);
  sp.world.add(grid);
  const dots = [sp.sphere(P, .08, 'ink'), sp.sphere(P, .08, 'ink'), sp.sphere(P, .08, 'ink')];

  const lab = {
    u: sp.label('u', [0, 0, 0], 'c1'), v: sp.label('v', [0, 0, 0], 'c5'),
    proj: sp.label('proj', [0, 0, 0], 'c2'), x: sp.label('u × v', [0, 0, 0], 'c2'),
    th: sp.label('θ', [0, 0, 0], 'ink'), area: sp.label('area', [0, 0, 0], 'c3'),
    P: sp.label('P', [0, 0, 0], 'ink'), Q: sp.label('Q', [0, 0, 0], 'ink'), R: sp.label('R', [0, 0, 0], 'ink'),
  };
  lab.th.el.style.fontFamily = "'Times New Roman', serif";
  lab.th.el.style.fontStyle = 'italic';

  const out = { r1: s.readout('r1'), r2: s.readout('r2') };
  const name1 = s.root.querySelector<HTMLElement>('[data-readout="r1"]')?.previousElementSibling;
  const name2 = s.root.querySelector<HTMLElement>('[data-readout="r2"]')?.previousElementSibling;
  const eq = s.root.querySelector<HTMLElement>('[data-vec-eq]');
  const show = (l: { el: HTMLElement }, on: boolean | number) => { l.el.style.visibility = on ? '' : 'hidden'; };

  function update() {
    const g = st.grow, o = st.o;
    const u = mul(st.u, g), v = mul(st.v, g);
    const tipU = add(o, u), tipV = add(o, v);
    arrowU.set(o, tipU); arrowV.set(o, tipV);
    const lu = len(st.u), lv = len(st.v);
    const uv = dot(st.u, st.v);
    const cosT = lu && lv ? Math.max(-1, Math.min(1, uv / (lu * lv))) : 1;
    const theta = Math.acos(cosT);
    const nU = unit(st.u), nV = unit(st.v);
    lab.u.set(add(tipU, add(mul(nU, .32), [0, 0, .12])));
    lab.v.set(add(tipV, add(mul(nV, .32), [0, 0, .12])));

    // Dot: amber shadow of v on u, dashed drop, right-angle mark, angle arc.
    const pr = st.proj * g;
    const projV = mul(st.u, uv / (lu * lu || 1));
    const foot = add(o, projV);
    arrowP.group.visible = pr > .02 && len(projV) > .02;
    if (arrowP.group.visible) arrowP.set(o, add(o, mul(projV, pr)));
    drop.line.visible = corner.line.visible = pr > .02;
    drop.set(pr > .02 ? [tipV, add(tipV, mul(sub(foot, tipV), pr))] : []);
    const w = unit(sub(st.v, projV)), m = .16, sg = uv >= 0 ? -1 : 1;
    corner.set(pr > .9 && len(sub(st.v, projV)) > .3 && len(projV) > .3 ? [add(foot, mul(nU, sg * m)), add(add(foot, mul(nU, sg * m)), mul(w, m)), add(foot, mul(w, m))] : []);
    const arcPts: Vec[] = [];
    const showArc = (st.proj > .02 || st.para > .02) && Math.sin(theta) > .02;
    if (showArc) {
      const r = .5, n = 28, sinT = Math.sin(theta);
      for (let i = 0; i <= n * Math.max(st.proj, st.para); i++) {
        const t = i / n;
        const d = add(mul(nU, Math.sin((1 - t) * theta) / sinT), mul(nV, Math.sin(t * theta) / sinT));
        arcPts.push(add(o, mul(d, r)));
      }
    }
    arc.set(arcPts.length > 1 ? arcPts : []);
    arc.line.visible = arcPts.length > 1;
    const mid = add(nU, nV);
    lab.th.set(add(o, mul(unit(len(mid) > 1e-6 ? mid : nU), .78)));
    show(lab.th, showArc);
    show(lab.proj, pr > .5 && len(projV) > .4);
    lab.proj.set(add(add(o, mul(projV, .55)), [0, 0, -.28]));

    // Cross: parallelogram + perpendicular arrow (true length).
    const c = cross(st.u, st.v);
    const pa = st.para * g;
    para.mesh.visible = paraEdge.line.visible = pa > .02;
    const qa: Vec[] = [o, add(o, mul(st.u, g)), add(o, add(mul(st.u, g), mul(st.v, pa * g))), add(o, mul(st.v, pa * g))];
    para.set(qa);
    paraEdge.set(pa > .02 ? [...qa, qa[0]] : []);
    lab.area.set(add(o, add(mul(st.u, .5), mul(st.v, .5 * pa))));
    show(lab.area, pa > .6 && len(c) > .5 && st.plane < .5);
    arrowX.group.visible = st.cross > .02 && len(c) > .02;
    const tipX = add(o, mul(c, st.cross * g));
    if (arrowX.group.visible) arrowX.set(o, tipX);
    lab.x.set(add(tipX, add(mul(unit(c), .35), [0, 0, .05])), st.plane > .5 ? 'n = u × v' : 'u × v');
    show(lab.x, st.cross > .5 && len(c) > .1);

    // Plane through P with normal n = u × v (only meaningful when P is the anchor).
    const pl = st.plane;
    const showPlane = pl > .02 && len(c) > 1e-3;
    planeQuad.mesh.visible = grid.visible = showPlane;
    dots.forEach(d => { d.visible = pl > .5; });
    [lab.P, lab.Q, lab.R].forEach(l => show(l, pl > .5));
    if (showPlane) {
      const e1 = nU, e2 = unit(cross(unit(c), e1));
      const ctr = add(o, mul(add(st.u, st.v), 1 / 3));
      const H = 1.7 * pl;
      const at = (a: number, b: number) => add(ctr, add(mul(e1, a), mul(e2, b)));
      planeQuad.set([at(-H, -H), at(H, -H), at(H, H), at(-H, H)]);
      const segs: T.Vector3[] = [];
      for (let i = 0; i <= 6; i++) {
        const k = -H + 2 * H * i / 6;
        segs.push(new THREE.Vector3(...at(k, -H)), new THREE.Vector3(...at(k, H)), new THREE.Vector3(...at(-H, k)), new THREE.Vector3(...at(H, k)));
      }
      grid.geometry.dispose();
      grid.geometry = new THREE.BufferGeometry().setFromPoints(segs);
      gridMat.opacity = .45 * pl;
      dots[0].position.set(...o); dots[1].position.set(...tipU); dots[2].position.set(...tipV);
      lab.P.set(add(o, [-.2, -.2, -.28])); lab.Q.set(add(tipU, [.22, -.1, -.26])); lab.R.set(add(tipV, [.24, .1, -.24]));
    }
    lab.u.set(add(tipU, add(mul(nU, .32), [0, 0, .12])), pl > .5 ? 'u = PQ' : 'u');
    lab.v.set(add(tipV, add(mul(nV, .32), [0, 0, .12])), pl > .5 ? 'v = PR' : 'v');

    // Readouts and the live equation overlay.
    const deg = theta * 180 / Math.PI;
    if (mode === 'dot') {
      if (name1) name1.textContent = 'u · v'; if (name2) name2.textContent = 'θ';
      out.r1(fmt(uv, 2)); out.r2(`${fmt(deg, 1)}°`);
      if (eq) eq.innerHTML = `<span class="k-c1">u</span> · <span class="k-c5">v</span> = <b class="k-c2">${fmt(uv, 2)}</b> = ${fmt(lu, 2)} × ${fmt(lv, 2)} × cos ${fmt(deg, 1)}°`;
    } else if (mode === 'cross') {
      if (name1) name1.textContent = 'u × v'; if (name2) name2.textContent = '|u × v|';
      out.r1(vec(c)); out.r2(fmt(len(c), 3));
      if (eq) eq.innerHTML = `|<span class="k-c2">u × v</span>| = <b class="k-c3">${fmt(len(c), 2)}</b> = ${fmt(lu, 2)} × ${fmt(lv, 2)} × sin ${fmt(deg, 1)}°`;
    } else {
      const d = dot(c, P);
      const terms = ['x', 'y', 'z'].map((x, i) => [c[i], x] as const).filter(([k]) => Math.abs(k) > 5e-3);
      const lhs = terms.map(([k, x], i) => {
        const a = Math.abs(k), sgn = k < 0 ? (i ? ' − ' : '−') : (i ? ' + ' : '');
        return `${sgn}${Math.abs(a - 1) < 5e-3 ? '' : fmt(a, 2)}${x}`;
      }).join('') || '0';
      if (name1) name1.textContent = 'n'; if (name2) name2.textContent = 'Plane';
      out.r1(vec(c)); out.r2(`${lhs} = ${fmt(d, 2)}`);
      if (eq) eq.innerHTML = `<span class="k-c2">n</span> · (X − P) = 0 &nbsp;→&nbsp; ${lhs} = ${fmt(d, 2)}`;
    }
    sp.invalidate();
  }

  const sl = [0, 1, 2].map(i => s.slider(`v${i + 1}`, x => { st.v[i] = x; update(); }));
  const setV = (v: Vec, t: number | false = .9) => sl.forEach((h, i) => h.set(v[i], t));

  const TARGETS: Record<string, { proj: number; para: number; cross: number; plane: number }> = {
    dot: { proj: 1, para: 0, cross: 0, plane: 0 },
    cross: { proj: 0, para: 1, cross: 1, plane: 0 },
    plane: { proj: 0, para: 0, cross: 1, plane: 1 },
  };
  function goMode(m: string, opts: { proj?: number } = {}) {
    const was = mode;
    mode = m;
    const into = m === 'plane', from = was === 'plane';
    const t = { ...TARGETS[m], ...opts };
    swing?.kill(); swing = null;
    s.tween(st, { ...t, duration: .9, overwrite: 'auto', ease: 'power2.inOut', onUpdate: update });
    if (into !== from) {
      const u0 = [...st.u] as Vec, o0 = [...st.o] as Vec;
      const u1 = into ? U_PLANE : U_FREE, o1: Vec = into ? P : [0, 0, 0];
      const k = { t: 0 };
      s.tween(k, { t: 1, duration: 1, overwrite: 'auto', ease: 'power2.inOut', onUpdate: () => {
        st.u = u0.map((x, i) => x + (u1[i] - x) * k.t) as Vec;
        st.o = o0.map((x, i) => x + (o1[i] - x) * k.t) as Vec;
        update();
      } });
      setV(into ? V_PLANE : V_FREE, 1);
      s.tween(sp.orbit, { theta: into ? .05 : -1.2, phi: into ? 1.05 : 1.2, duration: 1.2, overwrite: 'auto', ease: 'power2.inOut', onUpdate: sp.invalidate });
      s.tween(sp.orbit.target, { x: into ? 1.2 : .7, y: into ? .6 : .5, z: into ? .8 : .55, duration: 1.2, overwrite: 'auto', ease: 'power2.inOut', onUpdate: sp.invalidate });
    }
    if (seg.get() !== m) seg.set(m);
    update();
  }
  let swing: gsap.core.Tween | null = null;
  const seg = s.segmented('mode', m => { if (m !== mode) goMode(m); });

  // Swing v around in the xy-plane so it passes through u: the cross product flips (right-hand rule).
  function swingV() {
    const start = Math.atan2(st.v[1], st.v[0]);
    const r = 1.7, z0 = st.v[2];
    const k = { a: 0 };
    swing?.kill();
    // End a quarter turn clockwise past u, so the cross product has flipped to point down.
    const uAng = Math.atan2(st.u[1], st.u[0]);
    let end = uAng - Math.PI / 2;
    while (end > start) end -= Math.PI * 2;
    if (start - end < Math.PI * .6) end -= Math.PI * 2;
    swing = s.tween(k, { a: 1, duration: s.reduced ? 0 : 4, overwrite: 'auto', ease: 'power1.inOut', onUpdate: () => {
      const ang = start + (end - start) * k.a;
      const blend = Math.min(1, k.a * 6);
      const v: Vec = [
        st.v[0] + (r * Math.cos(ang) - st.v[0]) * blend,
        st.v[1] + (r * Math.sin(ang) - st.v[1]) * blend,
        z0 + (0 - z0) * blend,
      ];
      setV(v, false);
    } });
  }
  s.action('swing', () => { if (mode === 'plane') goMode('cross'); swingV(); });

  s.onEnter(() => {
    if (s.reduced) { st.grow = 1; update(); return; }
    s.tween(st, { grow: 1, duration: 1.2, overwrite: 'auto', ease: 'power3.out', onUpdate: update });
  });
  sl.forEach((h, i) => h.set(st.v[i]));
  update();
  s.onBeat(i => {
    if (i === 0) { goMode('dot', { proj: 0 }); setV(V_FREE); }
    if (i === 1) { goMode('dot'); setV([1.4, 1.6, 1.4], 1.2); }
    if (i === 2) { goMode('cross'); setV(V_FREE); }
    if (i === 3) { goMode('cross'); swingV(); }
    if (i === 4) { goMode('plane'); }
  });
}
