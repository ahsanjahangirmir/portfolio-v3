// Client runtime for /calculus: mounts scenes lazily as they approach, drives narration beats,
// reading progress and the contents' practice markers, and loads the recipe library on demand.
import { createScene, type SceneMount } from './engine/stage';
import { progress } from './progress';

const loaders = import.meta.glob<{ default: SceneMount }>('./scenes/*.ts');
const loaderFor = (id: string) => loaders[`./scenes/${id}.ts`];

let dispose: (() => void) | undefined;
const motion = matchMedia('(prefers-reduced-motion: reduce)');

function onPage() {
  dispose?.();
  dispose = undefined;
  const page = document.querySelector<HTMLElement>('.calc-page');
  if (!page) return;
  const reduced = motion.matches;
  const cleanups: (() => void)[] = [];
  const mobile = matchMedia('(max-width: 860px)').matches;
  page.classList.add('js-beats');

  type Controller = ReturnType<typeof createScene>;
  const controllers = new Map<HTMLElement, Controller>();
  const pendingBeat = new Map<HTMLElement, number>();
  const visible = new Set<HTMLElement>();

  // 1) Mount each scene shortly before it scrolls into view.
  const mount = async (root: HTMLElement) => {
    const id = root.dataset.scene!;
    const loader = loaderFor(id);
    if (!loader || controllers.has(root)) return;
    const controller = createScene(root, reduced);
    controllers.set(root, controller);
    const early = pendingBeat.get(root);
    if (early !== undefined) controller.setBeat(early); // recorded now, played by ready()
    try {
      const mod = await loader();
      if (!controllers.has(root)) return; // page left while loading
      await mod.default(controller.scene);
      root.classList.add('is-mounted');
      controller.setVisible(visible.has(root));
      controller.ready();
    } catch (error) {
      console.error(`Scene "${id}" failed`, error);
      root.querySelector('.scene-loading')!.textContent = 'This figure could not load.';
    }
  };
  const near = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { near.unobserve(e.target); mount(e.target as HTMLElement); }
  }, { rootMargin: '120% 0px' });
  const roots = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
  roots.forEach(r => near.observe(r));
  // Visibility is judged on the figure itself (it is sticky), then mapped back to its scene root.
  const seenTargets = new Map<Element, HTMLElement>();
  roots.forEach(r => seenTargets.set(r.querySelector('.scene-viewport, .calc-hero-art') ?? r, r));
  const seen2 = new IntersectionObserver(entries => {
    for (const e of entries) {
      const root = seenTargets.get(e.target)!;
      if (e.isIntersecting) visible.add(root); else visible.delete(root);
      controllers.get(root)?.setVisible(e.isIntersecting);
    }
  });
  seenTargets.forEach((_, target) => seen2.observe(target));
  cleanups.push(() => { near.disconnect(); seen2.disconnect(); controllers.forEach(c => c.dispose()); controllers.clear(); });

  // 2) Narration beats: the paragraph crossing the reading line drives its figure.
  const line = mobile ? '-72% 0px -24% 0px' : '-46% 0px -50% 0px';
  const beatOwner = new Map<Element, { root: HTMLElement; index: number }>();
  const beatObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const owner = beatOwner.get(e.target)!;
      pendingBeat.set(owner.root, owner.index);
      controllers.get(owner.root)?.setBeat(owner.index);
    }
  }, { rootMargin: line });
  for (const root of roots) {
    const beats = [...root.querySelectorAll<HTMLElement>('[data-beat]')];
    const dots = root.querySelector<HTMLElement>('.beat-dots');
    beats.forEach((b, index) => {
      beatOwner.set(b, { root, index });
      beatObserver.observe(b);
      if (!dots || beats.length < 2) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(index + 1);
      button.setAttribute('aria-label', `Step ${index + 1}${b.dataset.beat ? ': ' + b.dataset.beat : ''}`);
      button.setAttribute('aria-current', 'false');
      button.addEventListener('click', () => {
        // Bring the paragraph to the reading line, then play the beat.
        const rect = b.getBoundingClientRect();
        const targetLine = innerHeight * (mobile ? .74 : .48);
        window.scrollTo({ top: scrollY + rect.top - targetLine + 4, behavior: 'instant' as ScrollBehavior });
        pendingBeat.set(root, index);
        controllers.get(root)?.setBeat(index);
      });
      dots.appendChild(button);
    });
  }
  cleanups.push(() => beatObserver.disconnect());

  // 3) Reading progress.
  const bar = document.querySelector<HTMLElement>('.calc-progress');
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.scale = `${max > 0 ? Math.min(1, scrollY / max) : 0} 1`;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  cleanups.push(() => { removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); });

  // 4) Contents markers follow practice progress.
  const paint = () => {
    document.querySelectorAll<HTMLElement>('[data-recipes]').forEach(el => {
      const ids = el.dataset.recipes!.split(' ').filter(Boolean);
      const solved = ids.filter(id => progress.state(id) === 'solved').length;
      el.dataset.state = !ids.length || !solved ? 'none' : solved === ids.length ? 'all' : 'some';
    });
    document.querySelectorAll<HTMLElement>('[data-act-progress]').forEach(el => {
      const ids = el.dataset.actProgress!.split(' ').filter(Boolean);
      const solved = ids.filter(id => progress.state(id) === 'solved').length;
      el.style.setProperty('--p', String(ids.length ? solved / ids.length : 0));
      el.setAttribute('aria-label', `${solved} of ${ids.length} recipes practiced`);
    });
  };
  paint();
  cleanups.push(progress.subscribe(paint) as () => void);

  // 5) Recipe library, loaded when it nears the viewport or a practice link is used.
  const library = document.querySelector<HTMLElement>('#library');
  let libraryApi: { filterScene(id: string | null): void; dispose(): void } | undefined;
  let libraryLoading: Promise<void> | undefined;
  const loadLibrary = () => libraryLoading ??= import('./library').then(m => {
    if (!document.contains(library)) return;
    libraryApi = m.mountLibrary(library!, reduced);
  });
  if (library) {
    const libNear = new IntersectionObserver(([e]) => { if (e.isIntersecting) { libNear.disconnect(); loadLibrary(); } }, { rootMargin: '150% 0px' });
    libNear.observe(library);
    cleanups.push(() => libNear.disconnect());
  }
  const practiceClick = (e: Event) => {
    const link = (e.target as Element).closest<HTMLAnchorElement>('[data-practice]');
    if (!link) return;
    loadLibrary()?.then(() => libraryApi?.filterScene(link.dataset.practice!));
  };
  document.addEventListener('click', practiceClick);
  cleanups.push(() => { document.removeEventListener('click', practiceClick); libraryApi?.dispose(); });

  // 6) Sections far from the viewport skip layout (content-visibility: auto) and use estimated
  // heights. Render each once while the browser is idle so it remembers the real height; anchors
  // and the scrollbar are then accurate long before the reader gets there.
  const pending = [...document.querySelectorAll<HTMLElement>('.calc-page .scene, .library-course')];
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200)) as number;
  let idleId = 0, cancelled = false;
  const measured = new ResizeObserver(entries => {
    for (const e of entries) { (e.target as HTMLElement).style.contentVisibility = ''; measured.unobserve(e.target); }
    if (!cancelled) idleId = idle(measureNext);
  });
  const measureNext = () => {
    const el = pending.shift();
    if (!el || cancelled) return;
    el.style.contentVisibility = 'visible';
    measured.observe(el);
  };
  // Start once the reader engages (or after a long quiet spell) so the first load stays light.
  const wake = ['scroll', 'pointerdown', 'keydown', 'touchstart'] as const;
  let started = false;
  const start = () => {
    if (started || cancelled) return;
    started = true;
    wake.forEach(t => removeEventListener(t, start));
    clearTimeout(begin);
    idleId = idle(measureNext);
  };
  wake.forEach(t => addEventListener(t, start, { passive: true, once: true }));
  const begin = setTimeout(start, 9000);
  cleanups.push(() => { cancelled = true; clearTimeout(begin); wake.forEach(t => removeEventListener(t, start)); cancelIdleCallback?.(idleId); measured.disconnect(); });

  dispose = () => cleanups.forEach(fn => fn());
}

document.addEventListener('astro:page-load', onPage);
document.addEventListener('astro:before-swap', () => { dispose?.(); dispose = undefined; });
motion.addEventListener('change', onPage);
