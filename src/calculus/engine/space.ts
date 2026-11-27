// Space3D: a lazily-loaded three.js stage for the multivariable scenes.
// Math coordinates (z up). Renders on demand, recolors on theme change, rotates by drag
// (horizontal-only on touch so the page still scrolls), never captures the wheel.
// Usage (inside an async scene mount):
//   const sp = await createSpace(scene, { radius: 9 });
//   const { THREE } = sp;
//   sp.axes(3);
//   const surf = sp.surface((x, y) => Math.sin(x) * Math.cos(y), [-3, 3], [-3, 3]);
//   sp.invalidate();
import type * as ThreeNS from 'three';
import type { ColorKey, Scene } from './stage';

type THREE = typeof ThreeNS;
export type Vec = [number, number, number];

export interface Space {
  THREE: THREE;
  renderer: ThreeNS.WebGLRenderer;
  camera: ThreeNS.PerspectiveCamera;
  scene3: ThreeNS.Scene;
  /** Add your objects here. */
  world: ThreeNS.Group;
  /** Camera orbit state; tween these then invalidate(). theta = azimuth (rad), phi = polar angle from +z (rad). */
  orbit: { theta: number; phi: number; radius: number; target: ThreeNS.Vector3 };
  /** Keep rendering every frame (autoplay). */
  animate: boolean;
  /** Slow idle spin in rad/s (0 = off). Stops while dragging, and always off under reduced motion. */
  spin: number;
  invalidate(): void;
  /** A material whose color follows a theme key. kind: 'mesh' (lit), 'basic' (unlit), 'line', 'points'. */
  material<K extends 'mesh' | 'basic' | 'line' | 'points'>(key: ColorKey, kind?: K, extra?: Record<string, unknown>): K extends 'line' ? ThreeNS.LineBasicMaterial : K extends 'points' ? ThreeNS.PointsMaterial : K extends 'basic' ? ThreeNS.MeshBasicMaterial : ThreeNS.MeshStandardMaterial;
  color(key: ColorKey): ThreeNS.Color;
  /** x, y, z axes as thin lines with labels. */
  axes(length?: number | Vec, opts?: { labels?: boolean; negative?: boolean }): ThreeNS.Group;
  /** Solid arrow (shaft + cone). Call set() to move it. */
  arrow(from: Vec, to: Vec, key?: ColorKey, opts?: { radius?: number; head?: number }): { group: ThreeNS.Group; set(from: Vec, to: Vec): void };
  /** Thick polyline (tube). Call set() with new points to update. */
  tube(points: Vec[], key?: ColorKey, radius?: number): { mesh: ThreeNS.Mesh; set(points: Vec[]): void };
  /** Thin 1px polyline. */
  line(points: Vec[], key?: ColorKey, opts?: { opacity?: number; dashed?: boolean }): { line: ThreeNS.Line; set(points: Vec[]): void };
  /** Graph z = f(x, y) with 3Blue1Brown-style checker shading. update(f) recomputes heights. */
  surface(f: (x: number, y: number) => number, xr: [number, number], yr: [number, number], opts?: { res?: number; key?: ColorKey; key2?: ColorKey; opacity?: number; checker?: number }): { mesh: ThreeNS.Mesh; update(f: (x: number, y: number) => number): void };
  /** Parametric surface (u, v) -> point. */
  paramSurface(p: (u: number, v: number) => Vec, ur: [number, number], vr: [number, number], opts?: { res?: number | [number, number]; key?: ColorKey; key2?: ColorKey; opacity?: number; checker?: number }): { mesh: ThreeNS.Mesh; update(p: (u: number, v: number) => Vec): void };
  sphere(at: Vec, r?: number, key?: ColorKey): ThreeNS.Mesh;
  /** HTML label pinned to a 3D point (crisp text, theme colors). */
  label(text: string, at: Vec, key?: ColorKey, opts?: { className?: string; math?: boolean }): { el: HTMLElement; set(at: Vec, text?: string): void; remove(): void };
  /** Project a world point to stage CSS px. */
  project(at: Vec): [number, number, boolean];
  onRender(fn: () => void): void;
}

export async function createSpace(scene: Scene, opts: { radius?: number; theta?: number; phi?: number; target?: Vec; fov?: number; spin?: number; host?: HTMLElement } = {}): Promise<Space> {
  const THREE = await import('three');
  const host = opts.host ?? scene.stage;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'space-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.touchAction = 'pan-y';
  host.appendChild(renderer.domElement);
  const labels = document.createElement('div');
  labels.className = 'space-labels';
  labels.setAttribute('aria-hidden', 'true');
  host.appendChild(labels);

  const scene3 = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, .05, 400);
  camera.up.set(0, 0, 1);
  const world = new THREE.Group();
  scene3.add(world);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.6);
  hemi.position.set(0, 0, 1);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(5, -6, 9);
  const fill = new THREE.DirectionalLight(0xffffff, .5);
  fill.position.set(-6, 4, -3);
  scene3.add(hemi, key, fill);

  const orbit = { theta: opts.theta ?? -0.9, phi: opts.phi ?? 1.1, radius: opts.radius ?? 10, target: new THREE.Vector3(...(opts.target ?? [0, 0, 0])) };
  const tracked: { key: ColorKey; mat: ThreeNS.Material & { color: ThreeNS.Color } }[] = [];
  const renderFns: (() => void)[] = [];
  const labelList: { el: HTMLElement; at: ThreeNS.Vector3 }[] = [];
  let dirty = true, width = 0, height = 0;

  const colorOf = (k: ColorKey) => new THREE.Color((scene.colors as Record<string, string>)[k] ?? '#888');

  const sp: Space = {
    THREE, renderer, camera, scene3, world, orbit,
    animate: false,
    spin: scene.reduced ? 0 : (opts.spin ?? 0),
    invalidate: () => { dirty = true; },
    color: colorOf,
    material(k, kind = 'mesh' as never, extra = {}) {
      let mat: ThreeNS.Material & { color: ThreeNS.Color };
      if (kind === 'line') mat = new THREE.LineBasicMaterial({ color: colorOf(k), transparent: true, ...extra });
      else if (kind === 'points') mat = new THREE.PointsMaterial({ color: colorOf(k), size: .06, transparent: true, ...extra });
      else if (kind === 'basic') mat = new THREE.MeshBasicMaterial({ color: colorOf(k), transparent: true, ...extra });
      else mat = new THREE.MeshStandardMaterial({ color: colorOf(k), roughness: .55, metalness: .05, ...extra });
      tracked.push({ key: k, mat });
      return mat as never;
    },
    axes(length = 3, o = {}) {
      const L: Vec = Array.isArray(length) ? length : [length, length, length];
      const g = new THREE.Group();
      const mat = sp.material('muted', 'line', { opacity: .7 });
      const neg = o.negative !== false;
      const pts = [
        new THREE.Vector3(neg ? -L[0] : 0, 0, 0), new THREE.Vector3(L[0], 0, 0),
        new THREE.Vector3(0, neg ? -L[1] : 0, 0), new THREE.Vector3(0, L[1], 0),
        new THREE.Vector3(0, 0, neg ? -L[2] : 0), new THREE.Vector3(0, 0, L[2]),
      ];
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat));
      world.add(g);
      if (o.labels !== false) {
        sp.label('x', [L[0] * 1.08, 0, 0], 'muted', { className: 'is-axis' });
        sp.label('y', [0, L[1] * 1.08, 0], 'muted', { className: 'is-axis' });
        sp.label('z', [0, 0, L[2] * 1.08], 'muted', { className: 'is-axis' });
      }
      return g;
    },
    arrow(from, to, k = 'c1', o = {}) {
      const group = new THREE.Group();
      const r = o.radius ?? .035, head = o.head ?? .22;
      const mat = sp.material(k, 'mesh');
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), mat);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 3.2, 1, 20), mat);
      group.add(shaft, cone);
      world.add(group);
      const up = new THREE.Vector3(0, 1, 0);
      const set = (a: Vec, b: Vec) => {
        const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
        const dir = B.clone().sub(A); const len = dir.length();
        group.visible = len > 1e-4;
        if (!group.visible) return;
        const h = Math.min(head, len * .45);
        dir.normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
        shaft.scale.set(1, len - h, 1);
        shaft.position.copy(A).addScaledVector(dir, (len - h) / 2);
        shaft.quaternion.copy(q);
        cone.scale.set(1, h, 1);
        cone.position.copy(A).addScaledVector(dir, len - h / 2);
        cone.quaternion.copy(q);
        dirty = true;
      };
      set(from, to);
      return { group, set };
    },
    tube(points, k = 'c1', radius = .04) {
      const mat = sp.material(k, 'mesh');
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      world.add(mesh);
      const set = (p: Vec[]) => {
        mesh.geometry.dispose();
        if (p.length < 2) { mesh.geometry = new THREE.BufferGeometry(); return; }
        const curve = new THREE.CatmullRomCurve3(p.map(v => new THREE.Vector3(...v)), false, 'centripetal');
        mesh.geometry = new THREE.TubeGeometry(curve, Math.min(600, p.length * 2), radius, 10, false);
        dirty = true;
      };
      set(points);
      return { mesh, set };
    },
    line(points, k = 'c1', o = {}) {
      const mat = o.dashed
        ? (() => { const m = new THREE.LineDashedMaterial({ color: colorOf(k), dashSize: .12, gapSize: .1, transparent: true, opacity: o.opacity ?? 1 }); tracked.push({ key: k, mat: m }); return m; })()
        : sp.material(k, 'line', { opacity: o.opacity ?? 1 });
      const line = new THREE.Line(new THREE.BufferGeometry(), mat);
      world.add(line);
      const set = (p: Vec[]) => {
        line.geometry.dispose();
        line.geometry = new THREE.BufferGeometry().setFromPoints(p.map(v => new THREE.Vector3(...v)));
        if (o.dashed) line.computeLineDistances();
        dirty = true;
      };
      set(points);
      return { line, set };
    },
    surface(f, xr, yr, o = {}) {
      const inner = sp.paramSurface((u, v) => [u, v, f(u, v)], xr, yr, o);
      return { mesh: inner.mesh, update: g => inner.update((u, v) => [u, v, g(u, v)]) };
    },
    paramSurface(p, ur, vr, o = {}) {
      const [nu, nv] = Array.isArray(o.res) ? o.res : [o.res ?? 48, o.res ?? 48];
      const checker = o.checker ?? 8;
      // Non-indexed so each quad gets one flat checker color while normals stay smooth.
      const count = nu * nv * 6;
      const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .6, metalness: 0, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, depthWrite: (o.opacity ?? 1) >= 1 });
      const mesh = new THREE.Mesh(geo, mat);
      world.add(mesh);
      const k1 = o.key ?? 'c3', k2 = o.key2 ?? o.key ?? 'c3';
      const paint = () => {
        const a = colorOf(k1), b = colorOf(k2).clone().lerp(new THREE.Color(scene.colors.ground), .28);
        let i = 0;
        for (let iu = 0; iu < nu; iu++) for (let iv = 0; iv < nv; iv++) {
          const c = (Math.floor(iu / (nu / checker)) + Math.floor(iv / (nv / checker))) % 2 ? a : b;
          for (let k = 0; k < 6; k++) { col[i++] = c.r; col[i++] = c.g; col[i++] = c.b; }
        }
        geo.attributes.color.needsUpdate = true;
      };
      const update = (pf: (u: number, v: number) => Vec) => {
        const grid: Vec[] = [];
        for (let iu = 0; iu <= nu; iu++) for (let iv = 0; iv <= nv; iv++) grid.push(pf(ur[0] + (ur[1] - ur[0]) * iu / nu, vr[0] + (vr[1] - vr[0]) * iv / nv));
        const at = (iu: number, iv: number) => grid[iu * (nv + 1) + iv];
        let i = 0;
        const put = (v: Vec) => { pos[i++] = v[0]; pos[i++] = v[1]; pos[i++] = Number.isFinite(v[2]) ? v[2] : 0; };
        for (let iu = 0; iu < nu; iu++) for (let iv = 0; iv < nv; iv++) {
          const a = at(iu, iv), b = at(iu + 1, iv), c = at(iu + 1, iv + 1), d = at(iu, iv + 1);
          put(a); put(b); put(c); put(a); put(c); put(d);
        }
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        dirty = true;
      };
      update(p); paint();
      scene.onTheme(paint);
      return { mesh, update };
    },
    sphere(at, r = .08, k = 'c2') {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), sp.material(k, 'mesh'));
      m.position.set(...at);
      world.add(m);
      return m;
    },
    label(text, at, k = 'ink', o = {}) {
      const el = document.createElement('span');
      el.className = 'space-label' + (o.className ? ' ' + o.className : '');
      el.textContent = text;
      el.style.setProperty('--label', `var(--calc-${k}, var(--${k}))`);
      labels.appendChild(el);
      const item = { el, at: new THREE.Vector3(...at) };
      labelList.push(item);
      dirty = true;
      return {
        el,
        set(p, t) { item.at.set(...p); if (t !== undefined) el.textContent = t; dirty = true; },
        remove() { el.remove(); labelList.splice(labelList.indexOf(item), 1); },
      };
    },
    project(at) {
      const v = new THREE.Vector3(...at).project(camera);
      return [(v.x + 1) / 2 * width, (1 - v.y) / 2 * height, v.z < 1];
    },
    onRender: fn => { renderFns.push(fn); },
  };

  const resize = () => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    width = r.width; height = r.height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Drag to orbit with inertia.
  let dragging = false, lx = 0, ly = 0, vt = 0, vp = 0, touch = false;
  const el = renderer.domElement;
  const down = (e: PointerEvent) => {
    dragging = true; touch = e.pointerType === 'touch'; lx = e.clientX; ly = e.clientY; vt = vp = 0;
    if (!touch) el.setPointerCapture(e.pointerId);
    host.classList.add('is-dragging');
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    vt = -dx * .008; vp = touch ? 0 : -dy * .008;
    orbit.theta += vt; orbit.phi = Math.min(Math.PI - .08, Math.max(.08, orbit.phi + vp));
    dirty = true;
  };
  const up = () => { dragging = false; host.classList.remove('is-dragging'); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);

  const place = () => {
    const { theta, phi, radius, target } = orbit;
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.cos(theta),
      target.y + radius * Math.sin(phi) * Math.sin(theta),
      target.z + radius * Math.cos(phi),
    );
    camera.lookAt(target);
  };

  scene.frame((_, dt) => {
    if (!dragging && (Math.abs(vt) > 1e-4 || Math.abs(vp) > 1e-4)) {
      orbit.theta += vt; orbit.phi = Math.min(Math.PI - .08, Math.max(.08, orbit.phi + vp));
      vt *= .9; vp *= .9; dirty = true;
    }
    if (sp.spin && !dragging) { orbit.theta += sp.spin * dt; dirty = true; }
    if (!dirty && !sp.animate) return;
    dirty = false;
    place();
    renderFns.forEach(fn => fn());
    renderer.render(scene3, camera);
    for (const l of labelList) {
      const v = l.at.clone().project(camera);
      const hidden = v.z > 1;
      l.el.style.opacity = hidden ? '0' : '';
      l.el.style.transform = `translate(${(v.x + 1) / 2 * width}px, ${(1 - v.y) / 2 * height}px) translate(-50%, -50%)`;
    }
  });

  scene.onTheme(() => { tracked.forEach(t => t.mat.color.copy(colorOf(t.key))); dirty = true; });
  scene.cleanup(() => {
    ro.disconnect();
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('lostpointercapture', up);
    scene3.traverse(o => {
      const m = o as ThreeNS.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach(x => x.dispose());
    });
    renderer.dispose();
    renderer.forceContextLoss();
    el.remove(); labels.remove();
  });
  return sp;
}
