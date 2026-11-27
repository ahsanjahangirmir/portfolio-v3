// Scene runtime: every interactive figure on /calculus is a module whose default export receives a Scene.
// The runtime owns theme colors, visibility gating, the shared GSAP ticker, narration beats and cleanup,
// so scene code only describes what to draw and how controls change it.
import gsap from 'gsap';

export type ColorKey = 'ground' | 'ink' | 'muted' | 'line' | 'panel' | 'accent' | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'grid';
export type Palette = Record<ColorKey, string>;
const KEYS: ColorKey[] = ['ground', 'ink', 'muted', 'line', 'panel', 'accent', 'c1', 'c2', 'c3', 'c4', 'c5', 'grid'];

export function readPalette(el: Element = document.documentElement): Palette {
  const style = getComputedStyle(el);
  const out = {} as Palette;
  for (const k of KEYS) out[k] = style.getPropertyValue(k === 'ground' || k === 'ink' || k === 'muted' || k === 'line' || k === 'panel' || k === 'accent' ? `--${k}` : `--calc-${k}`).trim() || '#888';
  return out;
}

/** Convert any CSS color the palette holds into rgba() with a given alpha. */
export function alpha(color: string, a: number): string {
  if (color.startsWith('#')) {
    let h = color.slice(1);
    if (h.length === 3) h = [...h].map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) { const [r, g, b] = m[1].split(/[ ,/]+/); return `rgba(${r},${g},${b},${a})`; }
  return color;
}

export type FrameFn = (time: number, dt: number) => void;

export interface Scene {
  /** The <section data-scene> element. */
  root: HTMLElement;
  /** The figure's drawing area (.scene-stage). Canvases go in here. */
  stage: HTMLElement;
  /** prefers-reduced-motion. When true: no autoplay, tweens jump, frame loops still run only while something is being dragged. */
  reduced: boolean;
  /** Current theme colors (object identity is stable; values update on theme change). */
  colors: Palette;
  visible: boolean;
  onTheme(fn: () => void): void;
  /** Runs every animation frame while the scene is on screen. Return nothing. */
  frame(fn: FrameFn): void;
  /** Called with the index of the narration beat ([data-beat] paragraphs) that reaches mid-screen, and on stepper clicks. */
  onBeat(fn: (index: number, el: HTMLElement) => void): void;
  /** Runs once, the first time the scene is visible (the establishing animation). Skipped work should still set final state. */
  onEnter(fn: () => void): void;
  cleanup(fn: () => void): void;
  /** GSAP tween bound to this scene's lifetime. Jumps to the end under reduced motion. */
  tween(target: object, vars: gsap.TweenVars): gsap.core.Tween;
  timeline(vars?: gsap.TimelineVars): gsap.core.Timeline;
  /** Range input [data-control=name]: calls fn on input; returns get/set. set() can animate. */
  slider(name: string, fn: (value: number) => void): { get(): number; set(value: number, animate?: boolean | number): void; el: HTMLInputElement };
  /** Segmented buttons [data-seg=name] button[data-value]: calls fn(value) on change. */
  segmented(name: string, fn: (value: string) => void): { get(): string; set(value: string): void };
  /** Button [data-action=name]. */
  action(name: string, fn: () => void): HTMLButtonElement | null;
  /** Live text in <output data-readout=name>. */
  readout(name: string): (text: string) => void;
}

export type SceneMount = (scene: Scene) => void | Promise<void>;

const fmtCache = new Map<number, Intl.NumberFormat>();
/** Format a number for readouts with a true minus sign. */
export function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '−∞' : '—';
  let f = fmtCache.get(digits);
  if (!f) { f = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }); fmtCache.set(digits, f); }
  const s = f.format(Math.abs(value) < 10 ** -(digits + 1) ? 0 : value);
  return s.replace('-', '−');
}

export function createScene(root: HTMLElement, reduced: boolean): { scene: Scene; setVisible(v: boolean): void; dispose(): void; setBeat(i: number): void; ready(): void } {
  const stage = root.querySelector<HTMLElement>('.scene-stage') ?? root;
  const colors = readPalette();
  const themeFns: (() => void)[] = [];
  const frameFns: FrameFn[] = [];
  const beatFns: ((i: number, el: HTMLElement) => void)[] = [];
  const enterFns: (() => void)[] = [];
  const cleanups: (() => void)[] = [];
  const ctx = gsap.context(() => {}, root);
  // Beats and visibility can arrive while the scene module is still loading. They are recorded,
  // and replayed by ready() once mount has finished, so setup code never overwrites a beat.
  let entered = false, isReady = false, beatIndex = -1, last = 0;
  const beats = [...root.querySelectorAll<HTMLElement>('[data-beat]')];

  const tick = (time: number) => {
    if (!scene.visible || document.hidden) { last = time; return; }
    const dt = Math.min(.1, time - (last || time)); last = time;
    for (const fn of frameFns) fn(time, dt);
  };
  gsap.ticker.add(tick);

  const onThemeChange = () => { Object.assign(colors, readPalette()); themeFns.forEach(fn => fn()); };
  document.addEventListener('portfolio:theme', onThemeChange);

  const scene: Scene = {
    root, stage, reduced, colors, visible: false,
    onTheme: fn => { themeFns.push(fn); },
    frame: fn => { frameFns.push(fn); },
    onBeat: fn => { beatFns.push(fn); if (isReady && beatIndex >= 0) fn(beatIndex, beats[beatIndex]); },
    onEnter: fn => { if (entered && isReady) fn(); else enterFns.push(fn); },
    cleanup: fn => { cleanups.push(fn); },
    tween: (target, vars) => {
      let tween!: gsap.core.Tween;
      ctx.add(() => { tween = gsap.to(target, { ease: 'power3.out', overwrite: 'auto', ...vars, ...(reduced ? { duration: 0, delay: 0 } : {}) }); });
      return tween;
    },
    timeline: vars => {
      let tl!: gsap.core.Timeline;
      ctx.add(() => { tl = gsap.timeline({ defaults: { ease: 'power3.out' }, ...vars }); if (reduced) tl.timeScale(1000); });
      return tl;
    },
    slider: (name, fn) => {
      const el = root.querySelector<HTMLInputElement>(`input[data-control="${name}"]`)!;
      const out = root.querySelector<HTMLOutputElement>(`output[data-for="${name}"]`);
      const digits = Number(el?.dataset.digits ?? 2);
      const show = (v: number) => {
        if (out) out.textContent = (el.dataset.prefix ?? '') + fmt(v, digits) + (el.dataset.unit ?? '');
        el.style.setProperty('--fill', String((v - Number(el.min)) / (Number(el.max) - Number(el.min))));
      };
      const proxy = { v: Number(el?.value ?? 0) };
      const handler = () => { proxy.v = Number(el.value); gsap.killTweensOf(proxy); show(proxy.v); fn(proxy.v); };
      el?.addEventListener('input', handler);
      cleanups.push(() => el?.removeEventListener('input', handler));
      if (el) show(proxy.v);
      return {
        el,
        get: () => proxy.v,
        set(value, animate) {
          const apply = () => { el.value = String(proxy.v); show(proxy.v); fn(proxy.v); };
          if (animate && !reduced) {
            ctx.add(() => gsap.to(proxy, { v: value, duration: typeof animate === 'number' ? animate : 1.2, ease: 'power2.inOut', overwrite: true, onUpdate: apply }));
          } else { gsap.killTweensOf(proxy); proxy.v = value; apply(); }
        },
      };
    },
    segmented: (name, fn) => {
      const group = root.querySelector<HTMLElement>(`[data-seg="${name}"]`);
      const buttons = [...(group?.querySelectorAll<HTMLButtonElement>('button[data-value]') ?? [])];
      let current = buttons.find(b => b.getAttribute('aria-pressed') === 'true')?.dataset.value ?? buttons[0]?.dataset.value ?? '';
      const set = (value: string, notify = true) => {
        current = value;
        buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
        if (notify) fn(value);
      };
      const click = (e: Event) => { const v = (e.currentTarget as HTMLButtonElement).dataset.value!; if (v !== current) set(v); };
      buttons.forEach(b => b.addEventListener('click', click));
      cleanups.push(() => buttons.forEach(b => b.removeEventListener('click', click)));
      set(current, false);
      return { get: () => current, set: v => set(v) };
    },
    action: (name, fn) => {
      const el = root.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);
      el?.addEventListener('click', fn);
      cleanups.push(() => el?.removeEventListener('click', fn));
      return el;
    },
    readout: name => {
      const el = root.querySelector<HTMLElement>(`[data-readout="${name}"]`);
      let prev = '';
      return (text: string) => { if (el && text !== prev) { el.textContent = text; prev = text; } };
    },
  };

  const setBeat = (i: number) => {
    if (i === beatIndex || i < 0 || i >= beats.length) return;
    beatIndex = i;
    beats.forEach((b, j) => b.classList.toggle('is-active', j === i));
    root.querySelectorAll<HTMLButtonElement>('.beat-dots button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    if (isReady) beatFns.forEach(fn => fn(i, beats[i]));
  };
  const enter = () => { if (!entered && isReady && scene.visible) { entered = true; enterFns.splice(0).forEach(fn => fn()); } };

  return {
    scene,
    setBeat,
    setVisible(v) {
      scene.visible = v;
      enter();
    },
    ready() {
      isReady = true;
      enter();
      if (beatIndex < 0) setBeat(0); else beatFns.forEach(fn => fn(beatIndex, beats[beatIndex]));
    },
    dispose() {
      gsap.ticker.remove(tick);
      document.removeEventListener('portfolio:theme', onThemeChange);
      cleanups.forEach(fn => { try { fn(); } catch {} });
      ctx.revert();
    },
  };
}
