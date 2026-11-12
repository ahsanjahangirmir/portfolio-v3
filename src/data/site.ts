import type { ImageMetadata } from 'astro';
import midas from '../assets/work/midas.webp';
import synopt from '../assets/work/synopt.webp';
import taperlark from '../assets/work/taperlark.webp';
import circle from '../assets/work/circle.webp';
import type_ from '../assets/work/type.webp';
import quran from '../assets/work/quran.webp';
import clumsy from '../assets/work/clumsy.webp';
import tenfour from '../assets/work/tenfour.webp';

// Single source for identity, links and work. Facts come from each product's live site and repo.
export const site = {
  name: 'Ahsan Jahangir Mir', initials: 'ajm', role: 'Data & product engineer',
  email: 'ahsanjahangirmir@gmail.com',
  url: 'https://ahsanjahangirmir.github.io/portfolio-v3/',
  description: 'Ahsan Jahangir Mir is a data and product engineer. Native Mac and iPhone apps, browser tools and the data underneath them: Midas, Synopt, Taperlark, Circle and more.',
  links: {
    github: 'https://github.com/ahsanjahangirmir',
    linkedin: 'https://www.linkedin.com/in/ahsanjahangirmir/',
    calendly: 'https://calendly.com/ahsanjahangirmir/30min',
  },
};

/** Prefix an internal path with the deploy base (GitHub Pages serves the site from /portfolio-v3/). */
export const href = (path = '/') => import.meta.env.BASE_URL.replace(/\/$/, '') + path;

export type Project = {
  slug: string; title: string; url: string; domain: string;
  category: string; platform: string; status: string;
  summary: string; detail: string; stack: string[];
  image: ImageMetadata; alt: string; featured?: boolean;
};

export const projects: Project[] = [
  {
    slug: 'midas', title: 'Midas', url: 'https://exploremidas.vercel.app/', domain: 'exploremidas.vercel.app',
    category: 'Personal finance', platform: 'iPhone and Mac', status: 'In development', featured: true,
    summary: 'A private ledger for every rupee.',
    detail: 'Accounts, bills, budgets and goals in one ledger that lives on your devices. Devices pair by QR code, Face ID locks it, and Time Machine rewinds the dashboard to any past date.',
    stack: ['Swift', 'On-device database', 'Offline first'],
    image: midas, alt: 'Midas product page: the headline “Every rupee, accounted for.” beside a large brushed-metal M on black.',
  },
  {
    slug: 'synopt', title: 'Synopt', url: 'https://synopt.dev/', domain: 'synopt.dev',
    category: 'AI tooling analytics', platform: 'macOS agent and web', status: 'Early access', featured: true,
    summary: 'How your team really uses AI coding tools.',
    detail: 'Who adopted Claude Code, Codex CLI or Cursor, what it costs, and whether a secret slipped into a prompt. An open-source macOS agent reads local telemetry; the dashboard runs hosted or self-hosted.',
    stack: ['Apache-2.0 agent', 'Self-hostable', 'On-device secret scan'],
    image: synopt, alt: 'Synopt product page: the headline “See how your team really uses Claude Code, Codex CLI and Cursor” beside a sample usage dashboard.',
  },
  {
    slug: 'taperlark', title: 'Taperlark', url: 'https://taperlark.com/', domain: 'taperlark.com',
    category: 'Mac software studio', platform: 'macOS', status: 'On sale',
    summary: 'Four native Mac apps: fan curves, per-app volume, camera preview and App Store screenshots.',
    detail: 'CoolCurve, Submix, Preen and TrueFrame, sold as one-time licenses.',
    stack: ['Native macOS', 'Menu bar apps'],
    image: taperlark, alt: 'Taperlark catalog page: the headline “Mac apps for fans, audio, camera and screenshots” in heavy white type on black.',
  },
  {
    slug: 'circle', title: 'Circle', url: 'https://circle-grader.vercel.app/', domain: 'circle-grader.vercel.app',
    category: 'Education', platform: 'Web', status: 'Live, free',
    summary: 'Bubble sheets marked in the browser. Handwritten names read by a small neural network; scans never leave the computer.',
    detail: 'Aligns photographed sheets, scores every bubble and returns a spreadsheet.',
    stack: ['TypeScript', 'Computer vision'],
    image: circle, alt: 'Circle product page: the headline “Bubble sheets, marked.” beside a scanned answer sheet with graded bubbles.',
  },
  {
    slug: 'type', title: 'Type', url: 'https://type-product-page.vercel.app/', domain: 'type-product-page.vercel.app',
    category: 'Writing', platform: 'macOS', status: 'Open source',
    summary: 'A calm Markdown writing app for macOS 26. Pages are plain files; the editor never shows the syntax.',
    detail: 'Built natively in SwiftUI and AppKit.',
    stack: ['SwiftUI', 'AppKit'],
    image: type_, alt: 'Type product page: the serif headline “Room to write.” above floating windows of the writing app.',
  },
  {
    slug: 'quran', title: 'Quran', url: 'https://read-the-quran.vercel.app/', domain: 'read-the-quran.vercel.app',
    category: 'Reading and reflection', platform: 'iPhone, iPad and Mac', status: 'In development',
    summary: 'Read, listen and keep notes. Uthmani and IndoPak scripts, Hadith, and sync between nearby devices without an account.',
    detail: 'All 114 surahs bundled for offline reading.',
    stack: ['Swift', 'Peer-to-peer sync'],
    image: quran, alt: 'Quran app page: the headline “Your daily return to Quran” beside three phone screens showing Arabic text.',
  },
  {
    slug: 'clumsy', title: 'cLUMSy', url: 'https://clumsyapp.vercel.app/', domain: 'clumsyapp.vercel.app',
    category: 'Student tool', platform: 'macOS and Windows', status: 'Shipped',
    summary: 'Pulls every LUMS course file onto your desktop, sorted by course, and finds what was uploaded since.',
    detail: 'An independent desktop app for LUMS students.',
    stack: ['Desktop app'],
    image: clumsy, alt: 'cLUMSy product page: the headline “Your semester. Already sorted.” beside a teal app icon and a list of course files.',
  },
  {
    slug: 'tenfour', title: 'TenFour', url: 'https://tenfour-inky.vercel.app/', domain: 'tenfour-inky.vercel.app',
    category: 'Trucking compliance', platform: 'Web', status: 'Live',
    summary: 'Trip planning for truck drivers. Shows whether a trip is legal under Hours of Service, where the stops fall, and fills in the DOT logs.',
    detail: 'React and Django, with routing and log sheets rendered as SVG.',
    stack: ['React', 'Django', 'Leaflet'],
    image: tenfour, alt: 'TenFour product page: the headline “Know your trip is legal before you turn the key.” beside a route card on dark teal.',
  },
];

export const capabilities = [
  ['Data systems', 'On-device databases, sync between devices, telemetry pipelines, analytics'],
  ['Product engineering', 'Native macOS and iOS apps in Swift, web apps, APIs, desktop tools'],
  ['Connecting the two', 'Usage analytics in Synopt, in-browser computer vision in Circle, an offline-first ledger in Midas'],
];
