// Build-time KaTeX. \cA..\cE color a term with the scene palette (mint, amber, blue, rose, lilac),
// so formulas share colors with the curves they describe.
import katex from 'katex';

export const macros = {
  '\\cA': '\\htmlClass{k1}{#1}',
  '\\cB': '\\htmlClass{k2}{#1}',
  '\\cC': '\\htmlClass{k3}{#1}',
  '\\cD': '\\htmlClass{k4}{#1}',
  '\\cE': '\\htmlClass{k5}{#1}',
  '\\dd': '\\mathrm{d}',
};
export const katexOptions = { throwOnError: true, trust: true, strict: 'ignore' as const, macros };

export const tex = (src: string, display = false) => katex.renderToString(src, { ...katexOptions, displayMode: display, macros: { ...macros } });

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render prose containing $inline$ and $$display$$ math to HTML. */
export function prose(text: string) {
  return text.split(/(\$\$[\s\S]+?\$\$|(?<!\\)\$[^$]+?(?<!\\)\$)/g).map(part => {
    if (part.startsWith('$$')) return tex(part.slice(2, -2), true);
    if (part.startsWith('$') && part.endsWith('$') && part.length > 1) return tex(part.slice(1, -1));
    return escape(part.replace(/\\\$/g, '$'));
  }).join('');
}
