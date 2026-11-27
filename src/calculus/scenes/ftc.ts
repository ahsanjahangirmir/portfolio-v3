// Scene 08: the fundamental theorem. Top: f with the signed area from a to x (blue above, rose below).
// Bottom: the accumulation function A(x) = ∫ₐˣ f(t) dt, whose tangent slope at x equals f(x).
// Part II: any antiderivative F = A + C gives the same F(b) − F(a). Examples: ∫₋₂¹ (3x+4) dx = 15/2,
// and ∫₀^π sin t dt = 2.
import { Plot2D, num } from '../engine/plot';
import { fmt, type Scene } from '../engine/stage';

type Fn = {
  f: (t: number) => number; F: (x: number) => number; a: number; b: number; xmax: number;
  x: [number, number]; y: [number, number]; ay: [number, number]; ay2: [number, number];
  name: string; Fname: string; exact: string;
};
const FNS: Record<string, Fn> = {
  lin: { f: t => 3 * t + 4, F: x => 1.5 * x * x + 4 * x, a: -2, b: 1, xmax: 1.4, x: [-2.7, 1.6], y: [-3.2, 9.5], ay: [-1.9, 9.5], ay2: [-5.6, 9.6], name: 'f(t) = 3t + 4', Fname: 'F(x) = 3x²/2 + 4x + C', exact: '15/2' },
  sin: { f: Math.sin, F: x => -Math.cos(x), a: 0, b: Math.PI, xmax: 2 * Math.PI, x: [-.5, 6.75], y: [-1.5, 1.6], ay: [-.7, 2.6], ay2: [-4.6, 4.6], name: 'f(t) = sin t', Fname: 'F(x) = −cos x + C', exact: '2' },
};

export default function mount(s: Scene) {
  const mk = (css: string) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:0;right:0;${css}`;
    s.stage.appendChild(d); s.cleanup(() => d.remove());
    return d;
  };
  const top = new Plot2D(s, { host: mk('top:0;height:52%'), x: [-2.7, 1.6], y: [-3.2, 9.5], labels: ['t', 'y'], pad: 6 });
  const bot = new Plot2D(s, { host: mk('top:52%;bottom:0;border-top:1px solid var(--line)'), x: [-2.7, 1.6], y: [-1.9, 9.5], labels: ['x', ''], pad: 6 });

  const st = { key: 'lin', part: 'one', x: -2, hi: -2, C: 0, showA: 0, tan: 0, fam: 0, fade: 1, draw: 0 };
  let F = FNS.lin;
  const A = (x: number) => F.F(x) - F.F(F.a);

  const out = {
    A: s.readout('A'), dA: s.readout('dA'), fx: s.readout('fx'),
    Fa: s.readout('Fa'), Fb: s.readout('Fb'), diff: s.readout('diff'),
  };

  function sync() {
    st.hi = Math.max(st.hi, st.x);
    top.view = { x0: F.x[0], x1: F.x[1], y0: F.y[0], y1: F.y[1] };
    const ay = st.part === 'two' ? F.ay2 : F.ay;
    bot.view = { x0: F.x[0], x1: F.x[1], y0: ay[0], y1: ay[1] };
    out.A(fmt(A(st.x), 4));
    out.dA(fmt(num.deriv(A, st.x), 4));
    out.fx(fmt(F.f(st.x), 4));
    const Fa = F.F(F.a) + st.C, Fb = F.F(F.b) + st.C;
    out.Fa(fmt(Fa, 4)); out.Fb(fmt(Fb, 4)); out.diff(`${fmt(Fb - Fa, 4)} = ${F.exact}`);
    top.invalidate(); bot.invalidate();
  }

  const groups = [...s.root.querySelectorAll<HTMLElement>('[data-mode]')];
  const xs = s.slider('x', v => { st.x = v; sync(); });
  const cs = s.slider('C', v => { st.C = v; sync(); });
  const xOut = s.root.querySelector('output[data-for="x"]');
  function setFn(key: string) {
    st.key = key; F = FNS[key];
    if (xs.el) { xs.el.min = String(F.a); xs.el.max = String(F.xmax); }
    st.hi = F.a;
    xs.set(st.part === 'two' ? F.b : F.a);
    st.fade = 0;
    s.tween(st, { fade: 1, duration: .45, onUpdate: sync });
  }
  function setPart(p: string) {
    st.part = p;
    groups.forEach(el => { el.style.display = el.dataset.mode === p ? 'contents' : 'none'; });
    s.tween(st, { overwrite: 'auto', fam: p === 'two' ? 1 : 0, duration: .6, onUpdate: sync });
    if (p === 'two') { st.hi = F.xmax; xs.set(F.b); }
    sync();
  }
  const fnSeg = s.segmented('fn', setFn);
  const part = s.segmented('part', setPart);

  const sweep = (from: number, to: number, dur: number) => {
    st.hi = from; xs.set(from);
    xs.set(to, s.reduced ? false : dur);
  };
  s.action('sweep', () => sweep(F.a, F.xmax, 3.2));

  top.handle({ get: () => [st.x, F.f(st.x)], set: x => xs.set(num.clamp(x, F.a, F.xmax)) });
  bot.handle({ get: () => (st.fam < .5 ? [st.x, A(st.x)] : [NaN, NaN]), set: x => xs.set(num.clamp(x, F.a, F.xmax)) });
  bot.handle({ // Part II: drag F up and down to change C.
    get: () => (st.fam > .5 ? [F.b, F.F(F.b) + st.C] : [NaN, NaN]),
    set: (_x, y) => cs.set(num.clamp(y - F.F(F.b), -3, 3)),
  });

  top.render = p => {
    p.ctx.globalAlpha = st.fade;
    const { f, a } = F, x = st.x;
    const two = st.fam > .5;
    const hiX = two ? F.b : x;
    if (hiX > a) {
      p.area(t => Math.max(0, f(t)), a, hiX, { color: 'c3', alpha: .42, samples: 160 });
      p.area(t => Math.min(0, f(t)), a, hiX, { color: 'c4', alpha: .5, samples: 160 });
    }
    p.vline(a, { alpha: .7 });
    p.text('a', a, 0, { color: 'muted', font: 'serif', size: 16, offset: [-8, 14], align: 'right' });
    p.fn(f, { color: 'c1', width: 3, progress: st.draw });
    if (st.draw < .98) return;
    if (two) {
      p.vline(F.b, { alpha: .7 });
      p.text('b', F.b, 0, { color: 'muted', font: 'serif', size: 16, offset: [8, 14] });
      p.textPx(`signed area = ${F.exact}`, 16, p.height - 20, { color: 'c3', size: 13, font: 'mono' });
    } else {
      p.line(x, 0, x, f(x), { color: 'c2', width: 3.5 });
      p.point(x, f(x), { color: 'c1', r: 6, ring: true, halo: true });
      p.text('x', x, 0, { color: 'c2', font: 'serif', size: 16, offset: [8, f(x) >= 0 ? 14 : -14] });
      p.textPx(`area from a to x = A(x) = ${fmt(A(x), 3)}`, 16, p.height - 20, { color: 'c3', size: 13, font: 'mono' });
    }
    p.textPx(F.name, 16, p.height - 40, { color: 'c1', size: 14 });
  };

  bot.render = p => {
    p.ctx.globalAlpha = st.fade;
    const x = st.x, a = F.a;
    if (st.fam > .01) {
      for (let c = -3; c <= 3; c++) p.fn(t => F.F(t) + c, { color: 'c5', width: 1.2, alpha: .22 * st.fam });
      const Fc = (t: number) => F.F(t) + st.C;
      p.fn(Fc, { color: 'c5', width: 2.8, alpha: st.fam });
      const ya = Fc(a), yb = Fc(F.b);
      p.line(a, ya, F.b, ya, { color: 'muted', width: 1, dash: [3, 4], alpha: st.fam });
      p.line(F.b, ya, F.b, yb, { color: 'c2', width: 3.5, alpha: st.fam });
      p.point(a, ya, { color: 'c5', r: 5, alpha: st.fam });
      p.point(F.b, yb, { color: 'c5', r: 6.5, ring: true, halo: true, alpha: st.fam });
      p.text(`F(b) − F(a) = ${F.exact}`, F.b, (ya + yb) / 2, { color: 'c2', size: 13, offset: [-10, 0], align: 'right', alpha: st.fam });
      p.textPx(F.Fname, 16, 20, { color: 'c5', size: 14, alpha: st.fam });
      if (st.fam > .99) return;
    }
    const k = 1 - st.fam;
    if (st.showA > .01) {
      p.fn(A, { color: 'c3', width: 1.4, alpha: .25 * st.showA * k, from: a });
      if (st.hi > a) p.fn(A, { color: 'c3', width: 3, from: a, to: st.hi, alpha: st.showA * k });
      if (st.tan > .01) {
        const m = F.f(x), run = (p.ex1 - p.ex0) * .09;
        p.slopeLine(x, A(x), m, { color: 'c2', width: 2.2, alpha: st.tan * k, span: (p.ex1 - p.ex0) * .25 });
        p.line(x, A(x), x + run, A(x), { color: 'muted', width: 1.2, dash: [4, 4], alpha: st.tan * k });
        p.line(x + run, A(x), x + run, A(x) + m * run, { color: 'c2', width: 3, alpha: st.tan * k });
        p.textPx(`slope of A at x = ${fmt(num.deriv(A, x), 3)} = f(x)`, 16, 40, { color: 'c2', size: 13, font: 'mono', alpha: st.tan * k });
      }
      p.point(x, A(x), { color: 'c3', r: 6, ring: true, halo: true, alpha: st.showA * k });
      p.textPx('A(x) = ∫ₐˣ f(t) dt', 16, 20, { color: 'c3', size: 14, alpha: st.showA * k });
    }
    if (xOut) xOut.textContent = fmt(x, 2);
  };

  const to = (vars: gsap.TweenVars) => s.tween(st, { overwrite: 'auto', duration: .8, ...vars, onUpdate: sync });
  const show = (key: string, p: string) => {
    if (fnSeg.get() !== key) fnSeg.set(key);
    if (part.get() !== p) part.set(p);
  };
  s.onBeat(i => {
    if (i === 0) { show('lin', 'one'); to({ showA: 0, tan: 0 }); sweep(-2, 1, 3); }
    if (i === 1) { show('lin', 'one'); to({ showA: 1, tan: 0 }); sweep(-2, 1.3, 3.2); }
    if (i === 2) { show('lin', 'one'); st.hi = F.xmax; to({ showA: 1, tan: 1 }); xs.set(-.6, 1.2); }
    if (i === 3) { show('lin', 'two'); cs.set(-3); cs.set(2, s.reduced ? false : 2.6); }
    if (i === 4) { show('sin', 'one'); cs.set(0); to({ showA: 1, tan: 1 }); sweep(0, 2 * Math.PI, 4); }
  });

  s.onEnter(() => {
    if (s.reduced) { st.draw = 1; sync(); return; }
    s.tween(st, { draw: 1, duration: 1.2, ease: 'power2.inOut', onUpdate: sync });
  });
  st.draw = s.reduced ? 1 : 0;
  setFn('lin');
  setPart('one');
  st.fade = 1;
}
