// A small math expression parser for checking typed answers.
// Grammar: + - * / ^ (right assoc), unary minus, implicit multiplication ("12x", "2(x+1)", "x y", "2pi"),
// functions sin cos tan sec csc cot asin acos atan arcsin arccos arctan sinh cosh tanh exp ln log sqrt abs,
// constants pi, e, and any single-letter or listed variable. "**" is accepted as "^".

export type Env = Record<string, number>;
type Node = (env: Env) => number;

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, ln: Math.log, log: Math.log, sqrt: Math.sqrt, abs: Math.abs,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, π: Math.PI };

type Tok = { t: 'num' | 'id' | 'op' | '(' | ')' | ','; v: string };

function tokenize(src: string, vars: string[]): Tok[] {
  const s = src.replace(/\*\*/g, '^').replace(/[·×]/g, '*').replace(/−/g, '-').replace(/√/g, 'sqrt');
  const out: Tok[] = [];
  const names = [...Object.keys(FUNCS), ...Object.keys(CONSTS), ...vars].sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i))!;
      // Do not swallow a following "e" constant as an exponent unless digits follow.
      out.push({ t: 'num', v: m[0] }); i += m[0].length; continue;
    }
    if (/[a-zA-Zπ_]/.test(c)) {
      const rest = s.slice(i);
      const name = names.find(n => rest.startsWith(n));
      if (name) { out.push({ t: 'id', v: name }); i += name.length; continue; }
      out.push({ t: 'id', v: c }); i++; continue;
    }
    if ('+-*/^'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(' || c === '[' || c === '{') { out.push({ t: '(', v: '(' }); i++; continue; }
    if (c === ')' || c === ']' || c === '}') { out.push({ t: ')', v: ')' }); i++; continue; }
    if (c === ',') { out.push({ t: ',', v: ',' }); i++; continue; }
    throw new Error(`Unexpected "${c}"`);
  }
  return out;
}

export function parse(src: string, vars: string[] = []): Node {
  const toks = tokenize(src, vars);
  let p = 0;
  const peek = () => toks[p];
  const eat = (t?: string, v?: string) => {
    const k = toks[p];
    if (!k || (t && k.t !== t) || (v && k.v !== v)) throw new Error('Unexpected end of expression');
    p++; return k;
  };
  const startsAtom = (k?: Tok) => !!k && (k.t === 'num' || k.t === 'id' || k.t === '(');

  function expr(): Node {
    let left = term();
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = eat().v, a = left, b = term();
      left = op === '+' ? env => a(env) + b(env) : env => a(env) - b(env);
    }
    return left;
  }
  function term(): Node {
    let left = unary();
    for (;;) {
      const k = peek();
      if (k?.t === 'op' && (k.v === '*' || k.v === '/')) {
        eat(); const a = left, b = unary();
        left = k.v === '*' ? env => a(env) * b(env) : env => a(env) / b(env);
      } else if (startsAtom(k)) {
        const a = left, b = power();
        left = env => a(env) * b(env);
      } else return left;
    }
  }
  function unary(): Node {
    if (peek()?.t === 'op' && peek().v === '-') { eat(); const a = unary(); return env => -a(env); }
    if (peek()?.t === 'op' && peek().v === '+') { eat(); return unary(); }
    return power();
  }
  function power(): Node {
    const base = atom();
    if (peek()?.t === 'op' && peek().v === '^') {
      eat(); const ex = unary();
      return env => Math.pow(base(env), ex(env));
    }
    return base;
  }
  function atom(): Node {
    const k = eat();
    if (k.t === 'num') { const v = parseFloat(k.v); return () => v; }
    if (k.t === '(') { const a = expr(); eat(')'); return a; }
    if (k.t === 'id') {
      const f = FUNCS[k.v];
      if (f) {
        // sin^2 x  →  (sin x)^2
        let exponent: Node | undefined;
        if (peek()?.t === 'op' && peek().v === '^') { eat(); exponent = atom(); }
        const arg = peek()?.t === '(' ? atom() : power();
        return exponent ? env => Math.pow(f(arg(env)), exponent!(env)) : env => f(arg(env));
      }
      if (k.v in CONSTS && !vars.includes(k.v)) { const v = CONSTS[k.v]; return () => v; }
      const name = k.v;
      return env => {
        if (!(name in env)) throw new Error(`Unknown symbol "${name}"`);
        return env[name];
      };
    }
    throw new Error('Unexpected symbol');
  }
  const node = expr();
  if (p < toks.length) throw new Error('Could not read the whole expression');
  return node;
}

export const evaluate = (src: string, env: Env = {}) => parse(src, Object.keys(env))(env);

/** Split "a, b, c" into parts, ignoring commas inside brackets, and strip outer brackets/angle brackets. */
export function splitList(src: string): string[] {
  let s = src.trim();
  // Unwrap "<1, 2>", "(1, 2)", "{1, 2}" only when the first bracket closes at the very end.
  const pairs: Record<string, string> = { '<': '>', '⟨': '⟩', '(': ')', '[': ']', '{': '}' };
  const close = pairs[s[0]];
  if (close && s.endsWith(close)) {
    let d = 0, end = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === s[0] && (s[0] !== close)) d++;
      else if (s[i] === close) { d--; if (d === 0) { end = i; break; } }
    }
    if (end === s.length - 1) s = s.slice(1, -1).trim();
  }
  const parts: string[] = []; let depth = 0, cur = '';
  for (const c of s) {
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map(x => x.trim()).filter(Boolean);
}

/** Remove a leading "y =", "f'(x) =", "x =" etc. so learners can type full equations. */
export const stripLhs = (src: string) => {
  const i = src.lastIndexOf('=');
  return i >= 0 ? src.slice(i + 1) : src;
};

const close = (a: number, b: number, tol: number) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

import type { Check } from '../../data/calculus/types';

export type Verdict = { ok: boolean; message?: string };

export function checkAnswer(check: Check, input: string): Verdict {
  const raw = input.trim();
  if (!raw) return { ok: false, message: 'Type an answer first.' };
  try {
    switch (check.kind) {
      case 'number': {
        const got = evaluate(stripLhs(raw)), want = evaluate(check.value);
        return { ok: close(got, want, check.tol ?? 1e-4) };
      }
      case 'choice': {
        // An exact option wins; otherwise accept a prefix only when it points at a single option.
        const v = raw.toLowerCase(), options = check.options.map(o => o.toLowerCase());
        const exact = options.find(o => o === v);
        const picked = exact ?? (v.length >= 2 ? options.filter(o => o.startsWith(v)) : []).at(0);
        const ambiguous = !exact && options.filter(o => o.startsWith(v)).length > 1;
        if (!picked || ambiguous) return { ok: false, message: `Answer with one of: ${check.options.join(', ')}.` };
        return { ok: picked === check.value.toLowerCase() };
      }
      case 'set':
      case 'tuple': {
        const got = splitList(stripLhs(raw)).map(x => evaluate(x));
        const want = check.values.map(x => evaluate(x));
        if (got.length !== want.length) return { ok: false, message: `Expected ${want.length} value${want.length === 1 ? '' : 's'}.` };
        const tol = check.tol ?? 1e-4;
        if (check.kind === 'tuple') return { ok: want.every((w, i) => close(got[i], w, tol)) };
        const left = [...got];
        return { ok: want.every(w => { const i = left.findIndex(g => close(g, w, tol)); if (i < 0) return false; left.splice(i, 1); return true; }) };
      }
      case 'expr': {
        const vars = check.vars;
        // "+ C" is welcome on antiderivatives; it is absorbed by the constant offset below.
        const symbols = check.upToConstant ? [...vars, 'C'] : vars;
        const got = parse(stripLhs(raw), symbols), want = parse(check.value, symbols);
        let compared = 0, offset: number | undefined;
        for (let k = 0; k < 40 && compared < 8; k++) {
          const env: Env = { C: 0 };
          vars.forEach((v, j) => { env[v] = 0.37 + ((k * 7 + j * 3) % 11) * 0.29 + k * 0.013; });
          const g = got(env), w = want(env);
          if (!Number.isFinite(g) || !Number.isFinite(w)) continue;
          if (check.upToConstant) {
            if (offset === undefined) offset = g - w;
            if (!close(g - offset, w, 1e-5)) return { ok: false };
          } else if (!close(g, w, 1e-5)) return { ok: false };
          compared++;
        }
        return compared ? { ok: true } : { ok: false, message: 'Could not evaluate that expression.' };
      }
    }
  } catch (error) {
    return { ok: false, message: `I couldn't read that: ${(error as Error).message}.` };
  }
}
