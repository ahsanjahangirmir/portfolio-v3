// Validates src/data/calculus/recipes/*.json: schema, unique ids, KaTeX-parsable math, parsable answer checks.
// Usage: node scripts/validate-recipes.mjs [file ...]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { parse, checkAnswer } from '../src/calculus/engine/expr.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/data/calculus/recipes');
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter(f => f.endsWith('.json')).map(f => join(dir, f));
const SCENES = new Set(JSON.parse(readFileSync(join(root, 'src/data/calculus/scene-ids.json'), 'utf8')));
let errors = 0, count = 0;
const ids = new Set();
const err = (where, msg) => { errors++; console.log(`✗ ${where}: ${msg}`); };

function mathSegments(text) {
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|(?<!\\)\$([^$]+?)(?<!\\)\$/g;
  let m;
  while ((m = re.exec(text))) out.push({ tex: m[1] ?? m[2], display: !!m[1] });
  const stripped = text.replace(re, '');
  if (/(?<!\\)\$/.test(stripped)) out.push({ unbalanced: true });
  return out;
}
function checkText(where, text) {
  if (typeof text !== 'string' || !text.trim()) return err(where, 'missing text');
  for (const seg of mathSegments(text)) {
    if (seg.unbalanced) { err(where, 'unbalanced $'); continue; }
    try { katex.renderToString(seg.tex, { displayMode: seg.display, throwOnError: true, trust: true, strict: 'ignore' }); }
    catch (e) { err(where, `KaTeX: ${e.message.split('\n')[0]} in "${seg.tex}"`); }
  }
}
function checkWorked(where, w) {
  checkText(where + '.problem', w.problem);
  if (!Array.isArray(w.steps) || !w.steps.length) err(where, 'no steps');
  else w.steps.forEach((s, i) => { checkText(`${where}.steps[${i}].do`, s.do); checkText(`${where}.steps[${i}].work`, s.work); });
  checkText(where + '.answer', w.answer);
  if (w.check) {
    const c = w.check;
    try {
      if (c.kind === 'number') parse(c.value)({});
      else if (c.kind === 'expr') { if (!Array.isArray(c.vars) || !c.vars.length) throw new Error('expr needs vars'); const r = checkAnswer(c, c.value); if (!r.ok) throw new Error('expr does not match itself: ' + (r.message ?? '')); }
      else if (c.kind === 'set' || c.kind === 'tuple') c.values.forEach(v => parse(v)({}));
      else if (c.kind === 'choice') { if (!c.options?.includes(c.value)) throw new Error('choice value not in options'); }
      else throw new Error('unknown kind ' + c.kind);
    } catch (e) { err(where + '.check', e.message); }
  }
}
for (const file of files) {
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { err(file, 'invalid JSON: ' + e.message); continue; }
  for (const [i, r] of (data.recipes ?? []).entries()) {
    const where = r.id ?? `${file}#${i}`;
    count++;
    if (!/^c[123]-[0-9A-Za-z.]+$/.test(r.id ?? '')) err(where, 'bad id');
    if (ids.has(r.id)) err(where, 'duplicate id'); ids.add(r.id);
    if (!['calc1', 'calc2', 'calc3'].includes(r.course)) err(where, 'bad course');
    for (const k of ['section', 'topic', 'title']) if (typeof r[k] !== 'string' || !r[k]) err(where, 'missing ' + k);
    if (/\$/.test(r.title ?? '')) err(where, 'title must be plain text');
    if (r.scene && !SCENES.has(r.scene)) err(where, 'unknown scene ' + r.scene);
    checkText(where + '.type', r.type);
    if (!r.example) err(where, 'missing example'); else checkWorked(where + '.example', r.example);
    if (!Array.isArray(r.practice) || r.practice.length < 2) err(where, 'needs at least 2 practice problems');
    else r.practice.forEach((p, j) => { checkWorked(`${where}.practice[${j}]`, p); if (!p.check) err(`${where}.practice[${j}]`, 'practice needs a check (use choice/number/expr/set/tuple)'); });
  }
}
console.log(`${count} recipes, ${errors} problem${errors === 1 ? '' : 's'}`);
process.exit(errors ? 1 : 0);
