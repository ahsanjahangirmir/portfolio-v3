# Data & product engineering portfolio

Local Astro portfolio. No GitHub repository or deployment was created.

## Run
npm install
npm run dev -- --background

Manage with npx astro dev status, npx astro dev logs, and npx astro dev stop.

## Production
npm run build
npm run preview -- --host 127.0.0.1 --port 4400

The static output is in dist/. Publish that directory to any static host when ready.

## Replace before publishing
- src/data/site.ts: local canonical URL and all three illustrative project narratives. Identity and email are configured for Ahsan Jahangir Mir.
- src/layouts/Base.astro: remaining presentation copy.
- astro.config.mjs and public/robots.txt: production domain.
- src/pages/index.astro: biography and practice statement.
- public/og.png: regenerate after real content is in place.

All projects are visibly identified as concept studies. Artwork is original procedural geometry, not product screenshots or real datasets.
See DESIGN.md for the concept and visual system.

## Theme and motion
Final palette: very deep navy (#060f1e) and mint (#9be8cb), with dark mode as the default. The header toggle selects a complementary light variant. That choice persists across reloads and navigation. Temporary palette-review controls have been removed; earlier review preferences are ignored. Colors live in src/styles/theme.css.

Reduced motion disables scrolling interpolation, introductions, pointer drift, and view transitions. Preference changes are applied immediately. Particle geometry fits the full canvas in both connected and dispersed states.
