# portfolio-v3

Portfolio of Ahsan Jahangir Mir, data & product engineer.
Live at https://ahsanjahangirmir.github.io/portfolio-v3/

Astro, GSAP and Lenis, with a canvas particle hero. No framework runtime beyond Astro's client router.

## Run
```
npm install
npx astro dev --background      # http://localhost:4321/portfolio-v3/
npx astro dev status | logs | stop
```

## Edit content
Everything a visitor reads about the work lives in `src/data/site.ts`: identity, contact links
(email, Calendly, GitHub, LinkedIn), and the project list. Each project has a live URL, status label,
platform, summary and a cover image in `src/assets/work/`. `featured: true` puts a project in the
large tiles; the rest go in the index.

To refresh a cover, screenshot the live site at 1440×900 (2× DPR), save it as WebP in
`src/assets/work/<slug>.webp`, and rebuild. Astro generates the responsive sizes.

## Build and deploy
```
npm run build      # static output in dist/
```
Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`.
The site is served from the `/portfolio-v3` base path (set in `astro.config.mjs`). Internal links
go through the `href()` helper in `src/data/site.ts` so they stay correct under that base.

## Design
See `DESIGN.md` for the concept, palette, type and motion rules.
`public/og.png` is the 1200×630 share card. Rebuild it when the hero line or project list changes.
