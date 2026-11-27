// Recipe library behavior: search and filters over the static index, and on-demand recipe panels.
// A panel shows the problem type, a tabbed worked example and two practice problems. Each recipe's
// steps sit on a rail: the instruction is always visible, and its working is revealed one step at a time.
import type { Recipe, RecipeFile, Worked } from '../data/calculus/types';
import { checkAnswer } from './engine/expr';
import { progress } from './progress';

const files = import.meta.glob<RecipeFile>('../data/calculus/recipes/*.json', { import: 'default' });
const fileCache = new Map<string, Promise<RecipeFile>>();
const loadFile = (name: string) => {
  if (!fileCache.has(name)) fileCache.set(name, files[`../data/calculus/recipes/${name}.json`]());
  return fileCache.get(name)!;
};
let proseFn: ((s: string) => string) | undefined;
const loadTex = () => import('./tex').then(m => { proseFn = m.prose; });
const prose = (s: string) => {
  try { return proseFn!(s); } catch { return s.replace(/</g, '&lt;'); }
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const ARROW = '<span class="arrow" aria-hidden="true">→</span>';
const EASE = 'cubic-bezier(.16,1,.3,1)';
const HELP: Record<string, string> = {
  number: 'A number or exact value: <code>7/3</code>, <code>sqrt(2)/2</code>, <code>pi/4</code>, <code>e^2</code>.',
  expr: 'A formula: <code>3x^2 - 2</code>, <code>2x e^(x^2)</code>, <code>sin(3t)/t</code>. “y =” and “+ C” are fine.',
  set: 'All the values, comma-separated, in any order: <code>-2, 3</code>.',
  tuple: 'The components in order, comma-separated: <code>&lt;1, -2, 3&gt;</code> or <code>1, -2, 3</code>.',
};
const STATE_LABEL = { none: 'Not started', tried: 'In progress', solved: 'Solved' } as const;
type Tab = { key: string; label: string; worked: Worked; practice: boolean };

export function mountLibrary(root: HTMLElement, reduced: boolean) {
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget | null | undefined, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    el?.addEventListener(type, fn as EventListener);
    cleanups.push(() => el?.removeEventListener(type, fn as EventListener));
  };
  const items = [...root.querySelectorAll<HTMLLIElement>('li[data-recipe]')];
  const search = root.querySelector<HTMLInputElement>('[data-library-search]');
  const unsolved = root.querySelector<HTMLInputElement>('[data-library-unsolved]');
  const courseGroup = root.querySelector<HTMLElement>('[data-library-course]');
  const chip = root.querySelector<HTMLButtonElement>('[data-library-scene-chip]');
  const empty = root.querySelector<HTMLElement>('[data-library-empty]');
  const count = root.querySelector<HTMLElement>('[data-library-count]');
  const solvedStat = root.querySelector<HTMLElement>('[data-stat="solved"]');
  const filter = { q: '', course: 'all', scene: null as string | null, unsolved: false };

  // ---------- Filters ----------
  const apply = () => {
    const words = filter.q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const li of items) {
      const hay = li.dataset.search ?? '';
      const ok = words.every(w => hay.includes(w))
        && (filter.course === 'all' || li.dataset.recipe!.startsWith(filter.course.replace('calc', 'c') + '-'))
        && (!filter.scene || li.dataset.sceneId === filter.scene)
        && (!filter.unsolved || progress.state(li.dataset.recipe!) !== 'solved');
      li.classList.toggle('is-filtered-out', !ok);
      if (ok) shown++;
    }
    root.querySelectorAll<HTMLElement>('[data-topic]').forEach(h => h.classList.toggle('is-filtered-out', !h.querySelector('li:not(.is-filtered-out)')));
    root.querySelectorAll<HTMLElement>('[data-course]').forEach(c => c.classList.toggle('is-filtered-out', !c.querySelector('li:not(.is-filtered-out)')));
    if (empty) empty.hidden = shown > 0;
    if (count) count.textContent = shown === items.length ? `${items.length} RECIPES` : `${shown} OF ${items.length}`;
  };
  const paintStates = () => {
    let solved = 0;
    for (const li of items) {
      const state = progress.state(li.dataset.recipe!);
      if (state === 'solved') solved++;
      const dot = li.querySelector<HTMLElement>('.recipe-state')!;
      if (dot.dataset.state !== state) {
        if (state === 'solved' && !reduced && li.classList.contains('is-open')) dot.classList.add('is-pop');
        dot.dataset.state = state;
        dot.querySelector('[data-state-label]')!.textContent = STATE_LABEL[state];
      }
    }
    if (solvedStat) solvedStat.textContent = String(solved);
  };
  paintStates();
  cleanups.push(progress.subscribe(() => { paintStates(); if (filter.unsolved) apply(); }) as () => void);
  on(root, 'animationend', e => (e.target as Element).classList?.remove('is-pop', 'is-shake'));

  on(search, 'input', () => { filter.q = search!.value; apply(); });
  on(unsolved, 'change', () => { filter.unsolved = unsolved!.checked; apply(); });
  const setCourse = (value: string) => {
    filter.course = value;
    courseGroup?.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.getAttribute('data-value') === value)));
  };
  courseGroup?.querySelectorAll<HTMLButtonElement>('button').forEach(b => on(b, 'click', () => { setCourse(b.dataset.value!); apply(); }));
  const setScene = (id: string | null) => {
    filter.scene = id;
    chip?.classList.toggle('is-on', !!id);
    if (chip && id) chip.querySelector('b')!.textContent = document.getElementById(`${id}-title`)?.textContent ?? id;
    if (id) setCourse('all');
    apply();
  };
  on(chip, 'click', () => setScene(null));
  on(root.querySelector('[data-library-reset]'), 'click', () => {
    if (search) search.value = '';
    if (unsolved) unsolved.checked = false;
    filter.q = ''; filter.unsolved = false;
    setCourse('all'); setScene(null); search?.focus();
  });
  // "/" jumps to the search box while the library is on screen.
  on(document, 'keydown', e => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]')) return;
    const r = root.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    e.preventDefault(); search?.focus();
  });

  // ---------- Opening and closing panels ----------
  const animateHeight = (el: HTMLElement, from: number, to: number, done?: () => void) => {
    if (reduced) { done?.(); return; }
    el.style.overflow = 'clip';
    const a = el.animate([{ height: `${from}px`, opacity: from ? 1 : 0 }, { height: `${to}px`, opacity: to ? 1 : 0 }], { duration: 420, easing: EASE });
    a.onfinish = a.oncancel = () => { el.style.overflow = ''; done?.(); };
  };
  const open = async (li: HTMLLIElement, toggle: HTMLButtonElement, panel: HTMLElement) => {
    toggle.setAttribute('aria-expanded', 'true');
    li.classList.add('is-open');
    if (!panel.dataset.ready) {
      li.classList.add('is-loading');
      const [file] = await Promise.all([loadFile(li.dataset.file!), proseFn ? null : loadTex()]);
      li.classList.remove('is-loading');
      if (toggle.getAttribute('aria-expanded') !== 'true') return; // closed while loading
      const recipe = file.recipes.find(r => r.id === li.dataset.recipe);
      if (!recipe) { panel.textContent = 'Recipe not found.'; panel.hidden = false; return; }
      panel.hidden = false;
      renderRecipe(panel, recipe);
      panel.dataset.ready = '1';
    }
    panel.hidden = false;
    animateHeight(panel, 0, panel.scrollHeight);
  };
  const close = (li: HTMLLIElement, toggle: HTMLButtonElement, panel: HTMLElement) => {
    toggle.setAttribute('aria-expanded', 'false');
    li.classList.remove('is-open');
    animateHeight(panel, panel.offsetHeight, 0, () => { if (toggle.getAttribute('aria-expanded') === 'false') panel.hidden = true; });
  };
  for (const li of items) {
    const toggle = li.querySelector<HTMLButtonElement>('.recipe-toggle')!;
    const panel = li.querySelector<HTMLElement>('.recipe-panel')!;
    on(toggle, 'click', () => (toggle.getAttribute('aria-expanded') === 'true' ? close : open)(li, toggle, panel));
  }

  // ---------- One recipe ----------
  function renderRecipe(panel: HTMLElement, r: Recipe) {
    const tabs: Tab[] = [
      { key: 'example', label: 'Example', worked: r.example, practice: false },
      ...r.practice.map((p, i) => ({ key: `p${i + 1}`, label: `Practice ${i + 1}`, worked: p, practice: true })),
    ];
    const scene = r.scene ? document.getElementById(r.scene) : null;
    const sceneLink = scene ? `<a class="recipe-scene-link" href="#${r.scene}"><span class="meta">SCENE ${scene.dataset.n ?? ''}</span><span class="label">See it move: ${esc(document.getElementById(`${r.scene}-title`)?.textContent ?? '')}</span><span class="arrow" aria-hidden="true">↑</span></a>` : '';
    const solvedKeys = progress.get(r.id).solved;
    panel.innerHTML = `
      <div class="recipe-inner">
        <div class="recipe-method"><span class="meta">THE PROBLEM TYPE</span><div>${prose(r.type)}</div></div>
        <div class="recipe-tabs" role="tablist" aria-label="${esc(r.title)}">
          ${tabs.map((t, i) => `<button type="button" role="tab" id="${r.id}-tab-${t.key}" aria-controls="${r.id}-pane" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tab="${t.key}">${t.label}<span class="tick${solvedKeys.includes(t.key) ? ' is-on' : ''}" aria-hidden="true">${CHECK_ICON}</span>${t.practice ? `<span class="sr-only" data-tab-state>${solvedKeys.includes(t.key) ? ', solved' : ''}</span>` : ''}</button>`).join('')}
          <span class="tab-ink" aria-hidden="true"></span>
        </div>
        <div class="recipe-pane" id="${r.id}-pane" role="tabpanel"></div>
        ${sceneLink}
      </div>`;
    const pane = panel.querySelector<HTMLElement>('.recipe-pane')!;
    const tabButtons = [...panel.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    const ink = panel.querySelector<HTMLElement>('.tab-ink')!;
    let current = 'example';
    const syncInk = () => {
      const b = tabButtons.find(x => x.dataset.tab === current);
      if (!b || !b.offsetWidth) return;
      ink.style.translate = `${b.offsetLeft}px 0`;
      ink.style.width = `${b.offsetWidth}px`;
    };
    const select = (key: string, focus = false) => {
      const prevHeight = pane.offsetHeight;
      current = key;
      tabButtons.forEach(b => { const sel = b.dataset.tab === key; b.setAttribute('aria-selected', String(sel)); b.tabIndex = sel ? 0 : -1; if (sel && focus) b.focus(); });
      pane.setAttribute('aria-labelledby', `${r.id}-tab-${key}`);
      syncInk();
      const t = tabs.find(x => x.key === key)!;
      const after = tabs[tabs.indexOf(t) + 1];
      renderWorked(pane, r, t, after ? () => select(after.key, true) : null, () => {
        const b = tabButtons.find(x => x.dataset.tab === key);
        const tick = b?.querySelector('.tick');
        if (tick && !tick.classList.contains('is-on')) { tick.classList.add('is-on'); if (!reduced) tick.classList.add('is-pop'); }
        const label = b?.querySelector('[data-tab-state]');
        if (label) label.textContent = ', solved';
      });
      // Ease between tabs of different heights instead of letting the page jump.
      if (prevHeight && !reduced) {
        const h = pane.offsetHeight;
        if (Math.abs(h - prevHeight) > 2) animateHeight(pane, prevHeight, h);
        pane.animate([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: 320, easing: EASE });
      }
    };
    tabButtons.forEach((b, i) => {
      b.addEventListener('click', () => { if (b.dataset.tab !== current) select(b.dataset.tab!); });
      b.addEventListener('keydown', e => {
        if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); select(tabButtons[e.key === 'Home' ? 0 : tabButtons.length - 1].dataset.tab!, true); return; }
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        select(tabButtons[(i + d + tabButtons.length) % tabButtons.length].dataset.tab!, true);
      });
    });
    select('example');
    const ro = new ResizeObserver(syncInk);
    ro.observe(panel.querySelector('.recipe-tabs')!);
    cleanups.push(() => ro.disconnect());
  }

  function renderWorked(pane: HTMLElement, r: Recipe, tab: Tab, goNext: (() => void) | null, onSolved: () => void) {
    const { worked: w, practice, key } = tab;
    const n = w.steps.length;
    const check = w.check;
    let revealed = 0, isSolved = progress.get(r.id).solved.includes(key);
    pane.classList.toggle('is-solved', isSolved);
    pane.innerHTML = `
      <div class="recipe-problem"><span class="meta">${practice ? `PRACTICE ${key.slice(1)} · YOUR TURN` : 'WORKED EXAMPLE'}</span><div>${prose(w.problem)}</div></div>
      ${practice ? answerForm(r.id + key, check) : ''}
      <div class="recipe-steps-head">
        <span class="meta">${practice ? 'STUCK? THE SAME STEPS, ONE AT A TIME' : 'THE RECIPE, STEP BY STEP'}</span>
        <span class="meta recipe-step-count"></span>
      </div>
      <ol class="recipe-steps">
        ${w.steps.map((s, i) => `
          <li class="recipe-step" data-state="locked">
            <button type="button" class="step-dot" aria-label="Show the working for step ${i + 1}"><span>${i + 1}</span>${CHECK_ICON}</button>
            <div class="step-body">
              <div class="step-do">${prose(s.do)}</div>
              <div class="step-work" hidden><div class="work-inner">${prose(s.work)}</div></div>
            </div>
          </li>`).join('')}
      </ol>
      <div class="recipe-answer" hidden><span class="meta">ANSWER</span><div>${prose(w.answer)}</div></div>
      <div class="recipe-actions">
        <button type="button" class="pill is-primary" data-next></button>
        <button type="button" class="pill" data-all>${practice ? 'Show the full solution' : 'Show every step'}</button>
      </div>`;
    const steps = [...pane.querySelectorAll<HTMLLIElement>('.recipe-step')];
    const answer = pane.querySelector<HTMLElement>('.recipe-answer')!;
    const next = pane.querySelector<HTMLButtonElement>('[data-next]')!;
    const all = pane.querySelector<HTMLButtonElement>('[data-all]')!;
    const counter = pane.querySelector<HTMLElement>('.recipe-step-count')!;

    // The primary button always offers the most useful next move.
    const paintActions = () => {
      const done = revealed >= n;
      all.hidden = done;
      if ((done || (practice && isSolved)) && goNext) {
        next.innerHTML = `${practice ? 'Next practice problem' : 'Try practice 1'} ${ARROW}`;
        next.disabled = false;
      } else if (done) {
        next.textContent = isSolved || !practice ? 'All steps shown' : 'Solution shown';
        next.disabled = true;
      } else {
        next.disabled = false;
        next.textContent = practice ? (revealed ? 'Show the next step' : 'Show a hint') : `Next step (${revealed + 1} of ${n})`;
      }
    };
    const reveal = (upTo: number, animate = true) => {
      const from = revealed;
      revealed = Math.max(revealed, Math.min(n, upTo));
      steps.forEach((li, i) => {
        li.dataset.state = i < revealed ? 'shown' : i === revealed ? 'next' : 'locked';
        const dot = li.querySelector<HTMLButtonElement>('.step-dot')!;
        dot.disabled = i < revealed;
        const work = li.querySelector<HTMLElement>('.step-work')!;
        if (i < revealed && work.hidden) {
          work.hidden = false;
          if (animate && !reduced) {
            work.animate([{ height: '0px', opacity: 0 }, { height: `${work.scrollHeight}px`, opacity: 1 }], { duration: 460, delay: (i - from) * 90, easing: EASE, fill: 'backwards' });
          }
        }
      });
      if (revealed >= n && answer.hidden) {
        answer.hidden = false;
        if (animate && !reduced) answer.animate([{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 480, delay: (n - from) * 90, easing: EASE, fill: 'backwards' });
      }
      counter.textContent = revealed ? `${revealed} OF ${n} SHOWN` : `${n} STEPS`;
      paintActions();
      if (practice && revealed > from) progress.markTried(r.id);
    };
    next.addEventListener('click', () => {
      if ((revealed >= n || (practice && isSolved)) && goNext) goNext();
      else reveal(revealed + 1);
    });
    all.addEventListener('click', () => reveal(n));
    steps.forEach((li, i) => li.querySelector('.step-dot')!.addEventListener('click', () => reveal(i + 1)));
    reveal(practice ? 0 : 1, false);
    if (!practice) return;

    const form = pane.querySelector<HTMLFormElement>('form');
    const input = form?.querySelector('input');
    const verdict = pane.querySelector<HTMLElement>('.answer-verdict')!;
    const setVerdict = (ok: boolean, text: string) => {
      verdict.dataset.ok = String(ok);
      verdict.innerHTML = `${ok ? CHECK_ICON : CROSS_ICON}<span>${text}</span>`;
      if (!reduced) verdict.animate([{ opacity: 0, translate: '0 -4px' }, { opacity: 1, translate: '0 0' }], { duration: 260, easing: 'ease-out' });
    };
    const solved = () => {
      isSolved = true;
      progress.markSolved(r.id, key);
      onSolved();
      pane.classList.add('is-solved');
      setVerdict(true, `Correct.${revealed < n ? ' Compare your work with the steps below.' : ''}`);
      paintActions();
    };
    const wrong = (msg?: string) => {
      progress.markTried(r.id);
      setVerdict(false, `${msg ?? 'Not quite.'}${revealed < n ? ' A hint below shows the next step.' : ''}`);
      const target = input ?? pane.querySelector<HTMLElement>('.answer-form');
      if (target && !reduced) { target.classList.remove('is-shake'); void target.offsetWidth; target.classList.add('is-shake'); }
    };
    if (check?.kind === 'choice') {
      pane.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b => b.addEventListener('click', () => {
        pane.querySelectorAll('[data-choice]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        if (b.dataset.choice === check.value) solved(); else wrong();
      }));
    } else if (form && check && input) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const v = checkAnswer(check, input.value);
        if (v.ok) solved(); else wrong(v.message);
      });
      // Typing a new attempt clears the old "not quite".
      input.addEventListener('input', () => { if (verdict.dataset.ok === 'false') { verdict.dataset.ok = ''; verdict.innerHTML = ''; } });
    }
    if (isSolved) {
      verdict.dataset.ok = 'true';
      verdict.innerHTML = `${CHECK_ICON}<span>You solved this one before.</span>`;
    }
  }

  function answerForm(id: string, check: Worked['check']) {
    if (!check) return '<div class="answer-verdict" aria-live="polite"></div>';
    if (check.kind === 'choice') {
      return `<div class="answer-form is-choice" role="group" aria-label="Your answer"><span class="meta">YOUR ANSWER</span><div class="choices">${check.options.map(o => `<button type="button" class="pill" data-choice="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join('')}</div></div><div class="answer-verdict" aria-live="polite"></div>`;
    }
    const safe = id.replace(/[^a-z0-9]/gi, '-');
    const placeholder = check.kind === 'expr' ? 'e.g. 3x^2 - 2' : check.kind === 'number' ? 'e.g. 7/3' : 'e.g. 1, -2, 3';
    return `<form class="answer-form" novalidate>
        <label for="ans-${safe}" class="meta">YOUR ANSWER</label>
        <div class="answer-row">
          <input id="ans-${safe}" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${placeholder}" aria-describedby="help-${safe}"/>
          <button class="pill is-primary" type="submit">Check</button>
        </div>
        <p class="answer-help" id="help-${safe}">${HELP[check.kind] ?? ''}</p>
      </form>
      <div class="answer-verdict" aria-live="polite"></div>`;
  }

  apply();
  return {
    filterScene: (id: string | null) => setScene(id),
    dispose: () => cleanups.forEach(fn => fn()),
  };
}
