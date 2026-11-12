import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';

export type Theme = 'light' | 'dark';
// Separate the final appearance from choices made in the temporary palette review.
const storageKey = 'portfolio-navy-theme';
function resolved(): Theme {
  try {
    const value=localStorage.getItem(storageKey);
    if(value==='light'||value==='dark')return value;
  } catch {}
  return 'dark';
}
export function applyTheme(theme: Theme, target: Document = document) {
  target.documentElement.dataset.theme=theme;
  target.documentElement.style.colorScheme=theme;
  target.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#060f1e':'#eff5f3');
  const toggle=target.querySelector<HTMLButtonElement>('.theme-toggle');
  toggle?.setAttribute('aria-pressed',String(theme==='dark'));
  toggle?.setAttribute('title',theme==='dark'?'Switch to light theme':'Switch to dark theme');
  if(target===document)document.dispatchEvent(new CustomEvent('portfolio:theme'));
}
export function toggleTheme() {
  const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
  try { localStorage.setItem(storageKey,theme); } catch {}
  applyTheme(theme);
}
document.addEventListener('astro:before-swap',event=>{
  applyTheme((document.documentElement.dataset.theme as Theme)||resolved(),(event as TransitionBeforeSwapEvent).newDocument);
});
document.addEventListener('astro:page-load',()=>applyTheme(resolved()));
window.addEventListener('storage',event=>{
  if(event.key===storageKey||event.key===null)applyTheme(resolved());
});
