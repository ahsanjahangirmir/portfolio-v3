// Practice progress, kept in this browser only. One record per recipe: which tabs were solved.
const KEY = 'calculus-progress-v1';
export type RecipeProgress = { solved: string[]; tried?: boolean };
type Store = Record<string, RecipeProgress>;

let cache: Store | null = null;
const listeners = new Set<() => void>();

function load(): Store {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') ?? {}; } catch { cache = {}; }
  return cache!;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  listeners.forEach(fn => fn());
}

export const progress = {
  get: (id: string): RecipeProgress => load()[id] ?? { solved: [] },
  state(id: string): 'none' | 'tried' | 'solved' {
    const p = load()[id];
    if (!p) return 'none';
    return p.solved.some(s => s !== 'example') ? 'solved' : p.tried || p.solved.length ? 'tried' : 'none';
  },
  markSolved(id: string, tab: string) {
    const s = load();
    const p = s[id] ?? { solved: [] };
    if (!p.solved.includes(tab)) p.solved.push(tab);
    s[id] = p; save();
  },
  markTried(id: string) {
    const s = load();
    const p = s[id] ?? { solved: [] };
    if (p.tried) return;
    p.tried = true; s[id] = p; save();
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); },
};

window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) { cache = null; listeners.forEach(fn => fn()); } });
