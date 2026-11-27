// Build-time index of the recipe library. Only titles and ids reach the page HTML;
// full recipes load on demand in the browser from the per-course JSON chunks.
import type { Course, Recipe, RecipeFile } from './types';

const files = import.meta.glob<RecipeFile>('./recipes/*.json', { eager: true, import: 'default' });

export type RecipeEntry = Pick<Recipe, 'id' | 'course' | 'section' | 'topic' | 'title' | 'scene'> & { file: string };

const sectionOrder = (h: string) => {
  if (h === 'Last') return 1e6;
  const m = h.match(/^(\d+)\.(\d+)([a-z]?)$/);
  return m ? Number(m[1]) * 1000 + Number(m[2]) * 10 + (m[3] ? m[3].charCodeAt(0) - 96 : 0) : 9e5;
};

export const recipes: RecipeEntry[] = Object.entries(files)
  .flatMap(([path, data]) => (data.recipes ?? []).map(r => ({
    id: r.id, course: r.course, section: r.section, topic: r.topic, title: r.title, scene: r.scene,
    file: path.replace('./recipes/', '').replace('.json', ''),
  })))
  .sort((a, b) => a.course.localeCompare(b.course) || sectionOrder(a.section) - sectionOrder(b.section));

export const courses: { id: Course; name: string; short: string }[] = [
  { id: 'calc1', name: 'Calculus I', short: 'Calc I' },
  { id: 'calc2', name: 'Calculus II', short: 'Calc II' },
  { id: 'calc3', name: 'Multivariable Calculus', short: 'Multivariable' },
];

export const recipesForScene = (scene: string) => recipes.filter(r => r.scene === scene);

/** Recipes grouped into topics per course, in teaching order. */
export function topics(course: Course) {
  const map = new Map<string, { key: string; title: string; items: RecipeEntry[] }>();
  for (const r of recipes.filter(r => r.course === course)) {
    if (!map.has(r.section)) map.set(r.section, { key: r.section, title: r.topic, items: [] });
    map.get(r.section)!.items.push(r);
  }
  return [...map.values()];
}
