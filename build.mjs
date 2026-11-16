#!/usr/bin/env node
// Writes randy.gg's one page, site/index.html: the link page, one screen on landing, with his newest post in the card's
// place, a type bar under it down to the gallery, and below the fold every post as that card, filterable by type.
// A card goes to the post where it lives (Steam, YouTube).
// No dependencies; the output is committed, so GitHub Pages runs no build. Run `node build.mjs`.
//
// content/posts/YYYY-MM-DD-slug.md  front matter only: title, type (one of TYPES), link, thumbnail (in content/media/)
// content/media/                    the thumbnails, copied to site/assets/media/
//
// Everything else in site/ is hand-kept.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'site');
const BIO = 'I’m spending every waking minute of my life figuring out how to design banger games.';
// The type bar after All, in order. Every type shows, an empty one with a quiet note.
const TYPES = ['Game', 'Art', 'Video', 'Music'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SOCIALS = [
  { icon: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@randyprime' },
  { icon: 'steam', label: 'Steam', href: 'https://store.steampowered.com/developer/randygg' },
  { icon: 'x', label: 'X', href: 'https://x.com/primalrandy' },
];

const fail = msg => { console.error(`build: ${msg}`); process.exit(1); };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');

function load() {
  const dir = path.join(CONTENT, 'posts');
  const posts = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const m = f.match(/^(\d{4})-(\d\d)-(\d\d)-.+\.md$/);
    if (!m) fail(`posts/${f}: name it YYYY-MM-DD-slug.md`);
    const data = {};
    const fm = fs.readFileSync(path.join(dir, f), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    for (const line of fm ? fm[1].split(/\r?\n/) : []) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) data[kv[1]] = kv[2].trim();
    }
    for (const key of ['title', 'type', 'link', 'thumbnail']) if (!data[key]) fail(`posts/${f} needs a ${key}`);
    if (!TYPES.some(t => t.toLowerCase() === data.type)) fail(`posts/${f}: type is one of ${TYPES.join(', ').toLowerCase()}`);
    const media = path.relative(path.join(CONTENT, 'media'), path.resolve(dir, data.thumbnail));
    if (media.startsWith('..') || !fs.existsSync(path.join(CONTENT, 'media', media))) fail(`posts/${f}: thumbnail is not in content/media/`);
    return { ...data, date: `${m[1]}-${m[2]}-${m[3]}`, longDate: `${+m[3]} ${MONTHS[m[2] - 1]} ${m[1]}`, src: `/assets/media/${media.split(path.sep).join('/')}` };
  });
  if (!posts.length) fail('no posts, so the card would be empty');
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

const icon = name => `<svg aria-hidden="true"><use href="/assets/icons.svg#${name}"/></svg>`;
const ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';
const WORDMARK = fs.readFileSync(path.join(OUT, 'assets', 'randy.svg'), 'utf8').match(/ d="([^"]+)"/)[1];

// The live card, a post per card: its image, then one bar with where it lives (Steam, YouTube), its title and when it
// went out, an arrow. script.js turns the date into how long ago, at view time so the committed page never goes stale.
const source = link => /steampowered|steamcommunity/.test(link) ? icon('steam') : /youtube\.com|youtu\.be/.test(link) ? icon('youtube') : '';
const card = (p, lazy) => `<a class="capsule-link" href="${attr(p.link)}">
          <img class="capsule-image" src="${attr(p.src)}" alt=""${lazy ? ' loading="lazy"' : ''}>
          <span class="capsule-cta">${source(p.link)}<span class="cta-text"><span>${esc(p.title)}</span><time class="when" datetime="${p.date}" title="${p.longDate}">${p.longDate}</time></span>${ARROW}</span>
        </a>`;

// All and the types, each a link down to the gallery filtered to it. Pure CSS: the gallery's own bar holds the anchors
// (spans, so the browser doesn't ring a focused link), and :target marks the type on and filters the grid (the per-type rules are written into the page from TYPES).
const typeBar = (anchors, pad) => `<nav class="type-bar" aria-label="Post types">
${pad}  <a href="#posts">All</a>${TYPES.map(t => `<a href="#${t.toLowerCase()}">${anchors ? `<span id="${t.toLowerCase()}"></span>` : ''}${t}</a>`).join('')}
${pad}</nav>`;
const typeRules = TYPES.map(t => t.toLowerCase()).map(t => `.gallery:has(#${t}:target) .gallery-grid > :not([data-type="${t}"]) { display: none; }
.gallery:has(#${t}:target) .gallery-grid > [data-type="${t}"] { display: flex; }`).join('\n');

// One key thing on the screen: the newest post. The type bar stays small under it, the way down to the gallery.
function page(posts) {
  const socials = SOCIALS.map(s => `        <li><a class="social-link" href="${s.href}" aria-label="${s.label}" title="${s.label}">${icon(s.icon)}</a></li>`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0d0f12">
<title>randy</title>
<meta name="description" content="${attr(BIO)}">
<link rel="canonical" href="https://randy.gg/">
<link rel="manifest" href="/site.webmanifest">
<link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<meta property="og:title" content="randy">
<meta property="og:description" content="${attr(BIO)}">
<meta property="og:image" content="https://randy.gg/profile-picture.webp">
<meta property="og:image:alt" content="randy">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/style.css">
<style>
${typeRules}
</style>
<script src="/assets/script.js" defer></script>
</head>
<body>
<main>
  <div class="landing">
    <div class="home-layout">
      <div class="profile-panel">
        <header class="hero">
          <img src="/profile-picture.webp" alt="randy lifting his sunglasses" width="500" height="500" draggable="false" class="profile-photo">
          <h1 class="wordmark"><svg viewBox="0 0 2542.126 509.882" role="img" aria-label="randy"><linearGradient id="sheen"><stop offset="0.2" stop-color="#f5f6f7"/><stop offset="0.82" stop-color="#c6d0d8"/></linearGradient><path fill="url(#sheen)" d="${WORDMARK}"/></svg></h1>
          <p class="bio">${esc(BIO)}</p>
        </header>
        <ul class="social-links" aria-label="Find randy online">
${socials.join('\n')}
        </ul>
      </div>
      <div class="latest">
        ${card(posts[0])}
        ${typeBar(false, '        ')}
      </div>
    </div>
  </div>
  <section class="gallery" id="posts" aria-label="Posts">
    ${typeBar(true, '    ')}
    <ul class="gallery-grid">
${posts.map(p => `      <li data-type="${p.type}">${card(p, true)}</li>`).join('\n')}
${TYPES.map(t => t.toLowerCase()).filter(t => !posts.some(p => p.type === t)).map(t => `      <li class="empty" data-type="${t}">Nothing here yet</li>`).join('\n')}
    </ul>
    <a class="to-top" href="#top">Back to top</a>
  </section>
</main>
</body>
</html>
`;
}

const posts = load();
fs.writeFileSync(path.join(OUT, 'index.html'), page(posts));
fs.rmSync(path.join(OUT, 'assets', 'media'), { recursive: true, force: true });
fs.cpSync(path.join(CONTENT, 'media'), path.join(OUT, 'assets', 'media'), { recursive: true });
console.log(`build: ${posts.length} posts -> site/index.html`);
