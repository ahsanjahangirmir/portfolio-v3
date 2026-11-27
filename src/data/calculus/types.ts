// Shapes for the recipe library. Text fields are prose with inline math in $...$ and display math in $$...$$ (KaTeX).

export type Course = 'calc1' | 'calc2' | 'calc3';

/** How a learner's typed answer is checked. Expressions use the syntax in src/calculus/engine/expr.ts. */
export type Check =
  /** A single number, e.g. 12, -7/3, sqrt(2)/2, pi/4. */
  | { kind: 'number'; value: string; tol?: number }
  /** A formula in the listed variables, compared at random points. Constants of integration are allowed to differ when `upToConstant` is true. */
  | { kind: 'expr'; value: string; vars: string[]; upToConstant?: boolean }
  /** Several numbers in any order (roots, critical points). Typed comma-separated. */
  | { kind: 'set'; values: string[]; tol?: number }
  /** An ordered tuple, e.g. a vector <1,-2,3> or a point (2,5). Typed comma-separated, brackets optional. */
  | { kind: 'tuple'; values: string[]; tol?: number }
  /** A word answer from a fixed list (e.g. "converges", "diverges"). */
  | { kind: 'choice'; value: string; options: string[] };

export type Step = {
  /** The recipe's generic instruction for this step. */
  do: string;
  /** The same step carried out on this problem. */
  work: string;
};

export type Worked = {
  problem: string;
  steps: Step[];
  /** Final answer as displayed. */
  answer: string;
  /** Present when the answer can be checked automatically. */
  check?: Check;
};

export type Recipe = {
  /** Stable id: course + section + problem number, e.g. "c1-2.1.1". */
  id: string;
  course: Course;
  /** Section key used for ordering, e.g. "2.1", "15.4a". Never shown on the page. */
  section: string;
  /** Topic the recipe is grouped under, e.g. "The Chain Rule". */
  topic: string;
  /** Short, plain-text name for the list (no math). */
  title: string;
  /** The generic "Problem Type" statement. */
  type: string;
  /** The worked example. */
  example: Worked;
  /** New problems of the same type, solved with the same steps. */
  practice: Worked[];
  /** Id of the interactive scene that shows the idea, when one exists. */
  scene?: string;
};

export type RecipeFile = { recipes: Recipe[] };
