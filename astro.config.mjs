import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
// Served from GitHub Pages as a project site: https://ahsanjahangirmir.github.io/portfolio-v3/
export default defineConfig({site:'https://ahsanjahangirmir.github.io', base:'/portfolio-v3', trailingSlash:'ignore', integrations:[sitemap()], prefetch:true});
