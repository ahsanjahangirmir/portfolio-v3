// The story: three acts and a coda. Scene components look up their number and title here.
export type SceneMeta = { id: string; title: string; short: string };
export type Act = { id: string; numeral: 'I' | 'II' | 'III' | 'Coda'; name: string; course: string; lede: string; sub: string; scenes: SceneMeta[] };

export const acts: Act[] = [
  {
    id: 'act-1', numeral: 'I', name: 'Change', course: 'Calculus I',
    lede: 'How fast is something changing right now, at a single instant? Answering that takes a limit, and the answer is the derivative.',
    sub: 'Limits, derivatives and their rules, what derivatives say about shape, and the integral that undoes them.',
    scenes: [
      { id: 'secant', title: 'From secant to tangent', short: 'Secant to tangent' },
      { id: 'limit', title: 'What a limit promises', short: 'Limits' },
      { id: 'derivative', title: 'The derivative is a function too', short: 'Derivative function' },
      { id: 'rules', title: 'Product and chain rules, seen', short: 'Product and chain' },
      { id: 'linear', title: 'Zoom in until it’s a line', short: 'Local linearity' },
      { id: 'shape', title: 'What f′ and f″ say about shape', short: 'Shape and optimization' },
      { id: 'riemann', title: 'Area from thin rectangles', short: 'Riemann sums' },
      { id: 'ftc', title: 'The fundamental theorem', short: 'Fundamental theorem' },
    ],
  },
  {
    id: 'act-2', numeral: 'II', name: 'Accumulation', course: 'Calculus II',
    lede: 'Add up infinitely many tiny pieces and you get areas, volumes, lengths, and sums that go on forever but still come out finite.',
    sub: 'Applications of integration, improper integrals, differential equations, polar curves, series and Taylor polynomials.',
    scenes: [
      { id: 'solids', title: 'Spinning area into volume', short: 'Solids of revolution' },
      { id: 'arclength', title: 'The length of a curve', short: 'Arc length' },
      { id: 'improper', title: 'Finite area, infinite reach', short: 'Improper integrals' },
      { id: 'slopefield', title: 'Equations that describe change', short: 'Differential equations' },
      { id: 'polar', title: 'Curves in polar coordinates', short: 'Polar and parametric' },
      { id: 'series', title: 'Adding infinitely many things', short: 'Series' },
      { id: 'taylor', title: 'Polynomials that impersonate functions', short: 'Taylor series' },
    ],
  },
  {
    id: 'act-3', numeral: 'III', name: 'Space', course: 'Multivariable Calculus',
    lede: 'Add more dimensions and the same ideas still work. Slopes become gradients, areas become volumes, and the theorems that tie them together turn out to be one theorem.',
    sub: 'Vectors, space curves, partial derivatives, gradients, multiple integrals and vector calculus.',
    scenes: [
      { id: 'vectors', title: 'Vectors, dot and cross', short: 'Vectors' },
      { id: 'curves', title: 'Curves through space', short: 'Space curves' },
      { id: 'surface', title: 'Surfaces and partial derivatives', short: 'Partial derivatives' },
      { id: 'gradient', title: 'The gradient points uphill', short: 'Gradient' },
      { id: 'multiple', title: 'Integrals over regions', short: 'Multiple integrals' },
      { id: 'fields', title: 'Vector fields and the big theorems', short: 'Vector calculus' },
    ],
  },
];

export const coda: SceneMeta = { id: 'meaning', title: 'The meaning of it all', short: 'The meaning of it all' };

export const allScenes = [...acts.flatMap((a, ai) => a.scenes.map(s => ({ ...s, act: a.numeral }))), { ...coda, act: 'Coda' as const }]
  .map((s, i) => ({ ...s, n: i + 1 }));

export const sceneMeta = (id: string) => {
  const s = allScenes.find(x => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};
