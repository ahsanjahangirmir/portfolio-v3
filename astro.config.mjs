import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({site:'http://127.0.0.1:4400', integrations:[sitemap()],prefetch:true});
