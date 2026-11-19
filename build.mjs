#!/usr/bin/env node
// Writes randy.gg: the home, site/index.html (the link page's header, centred, then every post as the live card, the
// first row peeking above the fold as the cue to scroll, and at their foot the type bar filtering them), a page for each art post
// and each post with words of its own, and the sitemap.
// A card goes to the post where it lives (Steam, YouTube), or to its page here (art, words, or a track's player).
// No dependencies; the output is committed, so GitHub Pages runs no build. Run `node build.mjs`.
//
// content/posts/YYYY-MM-DD-slug.md  front matter only: title, published (when it went live, to the second, with its zone;
//                                   the name's date is its UTC day), type (one of TYPES), thumbnail, and either a link out or
//                                   a file hosted here (art: the original image, a PNG, and optionally its timelapse;
//                                   music: the track, a FLAC, with no thumbnail: its cover is made from its logo, a game's
//                                   own or else the RANDY wordmark, and its waveform from NAME.peaks.json beside it, by
//                                   tools/encode.sh; its link preview is NAME.cover.jpg beside it, by tools/cover.mjs)
//                                   A body under the front matter is his words (see markdown below for what it can hold):
//                                   an art post's writeup, or else a page at /posts/NAME/ with its link the official post,
//                                   linked at its foot. game and buy (its store page) put "Buy GAME on Steam" up top.
// content/media/                    the posts' media, copied to site/assets/media/ (waveforms stay: they're baked in)
//
// Everything else in site/ is hand-kept.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'site');
const BIO = 'me like to make stuff';
// The type bar after All, in order. Every type shows, an empty one with a quiet note.
const TYPES = ['Game', 'Art', 'Video', 'Music'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SOCIALS = [
  { icon: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@randyprime' },
  { icon: 'steam', label: 'Steam', href: 'https://store.steampowered.com/developer/randygg' },
  { icon: 'x', label: 'X', href: 'https://x.com/primalrandy' },
];
// the hero's one call to action, under the links: the game he's making now
const HERO_BUY = { game: 'Terrafactor', href: 'https://store.steampowered.com/app/3433610/Terrafactor/' };

const fail = msg => { console.error(`build: ${msg}`); process.exit(1); };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');

// a post's media file, from its path relative to the post: where it's served and where it is on disk
const mediaFile = (f, rel, what) => {
  const inMedia = path.relative(path.join(CONTENT, 'media'), path.resolve(CONTENT, 'posts', rel));
  if (inMedia.startsWith('..') || !fs.existsSync(path.join(CONTENT, 'media', inMedia))) fail(`posts/${f}: ${what} is not in content/media/`);
  return { src: `/assets/media/${inMedia.split(path.sep).join('/')}`, disk: path.join(CONTENT, 'media', inMedia) };
};

const uncovered = []; // tracks still without a link preview: the build writes the site, then fails on them
function load() {
  const dir = path.join(CONTENT, 'posts');
  const posts = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const m = f.match(/^(\d{4})-(\d\d)-(\d\d)-.+\.md$/);
    if (!m) fail(`posts/${f}: name it YYYY-MM-DD-slug.md`);
    const data = {};
    const text = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n?/g, '\n');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    const body = fm ? text.slice(fm[0].length).trim() : '';
    for (const line of fm ? fm[1].split('\n') : []) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) data[kv[1]] = kv[2].trim();
    }
    const isTrack = data.type === 'music' && data.file;
    for (const key of ['title', 'type', ...(isTrack ? [] : ['thumbnail'])]) if (!data[key]) fail(`posts/${f} needs a ${key}`);
    if (!data.link === !data.file) fail(`posts/${f} needs a link or a file, not both`);
    const isArt = data.type === 'art' && data.file;
    if (body && !data.link && !isArt) fail(`posts/${f}: a post with words needs the link to its official post`);
    if (!data.game !== !data.buy) fail(`posts/${f}: game and buy go together`);
    const published = new Date(data.published);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/.test(data.published || '') || isNaN(published)) fail(`posts/${f}: published is when it went live, like 2026-11-16T16:21:35Z`);
    if (published.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}`) fail(`posts/${f}: its name's date is ${published.toISOString().slice(0, 10)}, published's UTC day`);
    if (!TYPES.some(t => t.toLowerCase() === data.type)) fail(`posts/${f}: type is one of ${TYPES.join(', ').toLowerCase()}`);
    const media = key => mediaFile(f, data[key], key);
    const file = data.file && media('file');
    const peaks = isTrack && file.disk.replace(/\.[^.]+$/, '.peaks.json');
    if (peaks && !fs.existsSync(peaks)) fail(`posts/${f}: no waveform; run tools/encode.sh ${data.file} ${path.basename(peaks)} (paths from content/media)`);
    const cover = isTrack && file.disk.replace(/\.[^.]+$/, '.cover.jpg');
    if (cover && !fs.existsSync(cover)) uncovered.push(`posts/${f}: no link preview; with this build served, run tools/cover.mjs <its page's url> content/media/${path.relative(path.join(CONTENT, 'media'), cover)}`);
    const timelapse = isArt && data.timelapse && media('timelapse'), size = isArt && imageSize(file.disk);
    return {
      ...data, slug: f.slice(0, -3), body, page: (body || isArt || isTrack) && `/posts/${f.slice(11, -3)}/`, published,
      src: data.thumbnail && media('thumbnail').src, file, size,
      timelapse: timelapse && timelapse.src,
      track: isTrack && { cover: `/assets/media/${path.relative(path.join(CONTENT, 'media'), cover).split(path.sep).join('/')}`, seconds: flacSeconds(file.disk), peaks: JSON.parse(fs.readFileSync(peaks, 'utf8')), logo: data.logo && media('logo').src },
    };
  });
  if (!posts.length) fail('no posts');
  return posts.sort((a, b) => b.published - a.published);
}

// when a post went live: script.js shows how long ago, with the exact time in the reader's own zone on hover; the
// page as built says the UTC day
const when = (p, cls = '') => {
  const d = p.published, utc = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `<time${cls} datetime="${d.toISOString().replace('.000', '')}" title="${utc}, ${d.toISOString().slice(11, 16)} UTC">${utc}</time>`;
};
const icon = name => `<svg aria-hidden="true"><use href="/assets/icons.svg#${name}"/></svg>`;
const ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';
const WORDMARK = fs.readFileSync(path.join(OUT, 'assets', 'randy.svg'), 'utf8').match(/ d="([^"]+)"/)[1];

// The live card, a post per card: its image, then one bar with where it came from (Steam, YouTube, or its type when it's
// hosted here), its title and how long ago it went out, an arrow.
const source = p => p.file ? icon(p.type) : /steampowered|steamcommunity/.test(p.link) ? icon('steam') : /youtube\.com|youtu\.be/.test(p.link) ? icon('youtube') : '';
const card = (p, lazy) => {
  const image = p.track ? `<span class="capsule-image cover" style="${sky(p.slug)}">${logo(p, 'cover-logo')}</span>`
    : `<img class="capsule-image" src="${attr(p.src)}" alt=""${lazy ? ' loading="lazy"' : ''}>`;
  return `<a class="capsule-link" href="${attr(p.page || p.link)}">
          ${image}
          <span class="capsule-cta">${source(p)}<span class="cta-text"><span>${esc(p.title)}</span>${when(p, ' class="when"')}</span>${ARROW}</span>
        </a>`;
};

// A track's cover, its card's and its player's alike: its logo over a night sky dawning, seeded from its slug so each
// track has its own and keeps it through a retitle. These are the sky's numbers; style.css paints it.
const seeded = text => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 2 ** 32;
  };
};
const sky = slug => {
  const r = seeded(slug), night = 200 + r() * 60, dawn = 8 + r() * 40, depth = night + (r() < 0.5 ? -1 : 1) * (35 + r() * 40);
  const n = v => Math.round(v);
  return `--night:${n(night)};--dawn:${n(dawn)};--depth:${n((depth + 360) % 360)};--sun:${n(32 + r() * 36)}%`;
};
const logo = (p, cls) => p.track.logo ? `<img class="${cls}" src="${attr(p.track.logo)}" alt="">`
  : `<svg class="${cls}" viewBox="0 0 2542.126 509.882" aria-hidden="true"><path fill="url(#sheen)" d="${WORDMARK}"/></svg>`;

const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// a FLAC's length, off its STREAMINFO: total samples over the sample rate
const flacSeconds = disk => {
  const b = fs.readFileSync(disk).subarray(0, 42);
  if (b.toString('latin1', 0, 4) !== 'fLaC') fail(`${disk}: a track is a FLAC`);
  return ((b[21] & 0x0f) * 2 ** 32 + b.readUInt32BE(22)) / ((b[18] << 12) | (b[19] << 4) | (b[20] >> 4));
};
// a PNG's size, off its header
const imageSize = disk => {
  const b = fs.readFileSync(disk).subarray(0, 24);
  if (b.readUInt32BE(12) !== 0x49484452) fail(`${disk}: hosted art and a post's images are PNGs`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const download = p => {
  const ext = path.extname(p.file.disk).slice(1);
  const mb = (fs.statSync(p.file.disk).size / 1e6).toFixed(1);
  return `<a class="download" href="${attr(p.file.src)}" download="${p.slug.slice(11)}.${ext}">${icon('download')}${ext.toUpperCase()} · ${mb} MB</a>`;
};
// A track's page is its player: the whole screen its cover, the logo, and under it the waveform that is the scrubber
// (the bars are its loudness, drawn here; script.js lights what has played), then the time, play, volume and the FLAC.
// The X goes home; it, Esc, Space, the arrows and playing on arrival are script.js's.
function trackPage(p) {
  const { seconds, peaks } = p.track;
  const bars = peaks.map((v, i) => { const h = Math.max(3, v ** 0.6 * 100); return `M${i * 5} ${((100 - h) / 2).toFixed(1)}h3v${h.toFixed(1)}h-3z`; }).join('');
  return `${head({ title: `${p.title} – randy`, url: p.page, image: p.track.cover, alt: p.title, type: 'music.song' })}
<body>
<main class="player cover" aria-label="${attr(p.title)}" style="${sky(p.slug)}">
    <a class="close" href="/" aria-label="Close">${icon('close')}</a>
    <div class="player-body">
      ${logo(p, 'player-logo')}
      <p class="player-title">${esc(p.title)}</p>
      <div class="wave" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="${seconds.toFixed(2)}" aria-valuenow="0" aria-valuetext="0:00">
        <svg viewBox="0 0 ${peaks.length * 5 - 2} 100" preserveAspectRatio="none" aria-hidden="true"><defs><path id="wave-${p.slug}" d="${bars}"/></defs><use class="wave-base" href="#wave-${p.slug}"/><use class="wave-lit" href="#wave-${p.slug}"/></svg>
        <span class="wave-tip" aria-hidden="true"></span>
      </div>
      <div class="player-times"><span class="now">0:00</span><span>${clock(seconds)}</span></div>
      <div class="player-controls">
        <span class="volume"><button class="mute" type="button" aria-label="Mute">${icon('volume')}${icon('volume-off')}</button><input class="range" type="range" min="0" max="1" step="any" value="1" aria-label="Volume"></span>
        <button class="play" type="button" aria-label="Play">${icon('play')}${icon('pause')}</button>
        ${download(p)}
      </div>
    </div>
    <audio src="${attr(p.file.src)}" preload="metadata"></audio>
</main>
</body>
</html>
`;
}

// All and the types, each filtering the gallery. Pure CSS: each type's link holds its anchor (a span, so the browser
// doesn't ring a focused link, pinned to the gallery's top with All's #posts, so a pick from the foot brings up the posts
// from their start), and :target marks the type on and filters the grid (the per-type rules are written into the page
// from TYPES).
const typeBar = `<nav class="type-bar" aria-label="Post types">
        <a href="#posts">All</a>${TYPES.map(t => `<a href="#${t.toLowerCase()}"><span id="${t.toLowerCase()}"></span>${t}</a>`).join('')}
      </nav>`;
const typeRules = TYPES.map(t => t.toLowerCase()).map(t => `.gallery:has(#${t}:target) .gallery-grid > :not([data-type="${t}"]) { display: none; }
.gallery:has(#${t}:target) .gallery-grid > [data-type="${t}"] { display: flex; }`).join('\n');

const ORIGIN = 'https://randy.gg';
const head = ({ title, description, url, image, alt, type, extra = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0d0f12">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${attr(description)}">\n` : ''}<link rel="canonical" href="${ORIGIN}${url}">
<link rel="manifest" href="/site.webmanifest">
<link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<meta property="og:title" content="${attr(title)}">
${description ? `<meta property="og:description" content="${attr(description)}">\n` : ''}<meta property="og:image" content="${ORIGIN}${image}">
<meta property="og:image:alt" content="${attr(alt)}">
<meta property="og:type" content="${type}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/style.css">${extra}
<script src="/assets/script.js" defer></script>
</head>`;
const wordmark = id => `<svg viewBox="0 0 2542.126 509.882" role="img" aria-label="randy"><linearGradient id="${id}"><stop offset="0.2" stop-color="#f5f6f7"/><stop offset="0.82" stop-color="#c6d0d8"/></linearGradient><path fill="url(#${id})" d="${WORDMARK}"/></svg>`;

function page(posts) {
  const socials = SOCIALS.map(s => `      <li><a class="social-link" href="${s.href}" aria-label="${s.label}" title="${s.label}">${icon(s.icon)}</a></li>`);
  return `${head({ title: 'randy', description: BIO, url: '/', image: '/profile-picture.webp', alt: 'randy', type: 'website', extra: `
<style>
${typeRules}
</style>` })}
<body>
<main>
  <div class="landing">
    <header class="hero">
      <img src="/profile-picture.webp" alt="randy lifting his sunglasses" width="500" height="500" draggable="false" class="profile-photo">
      <h1 class="wordmark">${wordmark('sheen')}</h1>
      <p class="bio">${esc(BIO)}</p>
    </header>
    <ul class="social-links" aria-label="Find randy online">
${socials.join('\n')}
    </ul>
    ${buy(HERO_BUY.game, HERO_BUY.href, 'buy hero-buy')}
  </div>
  <section class="gallery" id="posts" aria-label="Posts">
    <ul class="gallery-grid">
${posts.map(p => `      <li data-type="${p.type}">${card(p, true)}</li>`).join('\n')}
${TYPES.map(t => t.toLowerCase()).filter(t => !posts.some(p => p.type === t)).map(t => `      <li class="empty" data-type="${t}">Nothing here yet</li>`).join('\n')}
    </ul>
    <footer class="gallery-foot">
      ${typeBar}
      <a class="to-top" href="#top">Back to top</a>
    </footer>
  </section>
</main>
</body>
</html>
`;
}

// A post's words, in the little markdown his posts use: blocks split by blank lines (paragraphs, ## headings, - lists,
// an image alone), and inside them links, images, **bold**, *italic*, and footnotes. A footnote ([^name] in the text,
// its own "[^name]: words" block anywhere) becomes a margin note beside the line that cites it, after Crafting
// Interpreters (script.js places it; on a narrow screen it sits after its block).
function markdown(p) {
  const where = `posts/${p.slug}.md`, notes = new Map(), used = new Set(), blocks = [];
  for (const chunk of p.body.split(/\n\s*\n/)) {
    const note = chunk.match(/^\[\^([^\]]+)\]:\s*([\s\S]*)$/);
    if (note) notes.set(note[1], note[2]); else blocks.push(chunk.trim());
  }
  const inline = (text, pending) => {
    const held = [], hold = html => `\u0000${held.push(html) - 1}\u0000`;
    let t = text.replace(/\[\^([^\]]+)\]/g, (_, name) => {
      if (!pending || !notes.has(name)) fail(`${where}: [^${name}] has no note`);
      used.add(name);
      pending.push(name);
      return hold(`<span class="anchor" data-aside="${attr(name)}"></span>`);
    });
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, rel) => {
      const img = mediaFile(p.slug + '.md', rel, `image ${rel}`), size = imageSize(img.disk);
      return hold(`<img src="${attr(img.src)}" alt="${attr(alt)}" width="${size[0]}" height="${size[1]}" loading="lazy">`);
    });
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => hold(`<a href="${attr(href)}">${inline(label)}</a>`));
    t = esc(t).replace(/\*\*(\S[\s\S]*?)\*\*/g, '<strong>$1</strong>').replace(/\*(\S[\s\S]*?)\*/g, '<em>$1</em>');
    return t.replace(/\u0000(\d+)\u0000/g, (_, k) => held[k]);
  };
  const html = blocks.map(b => {
    const pending = [];
    const h = b.match(/^(#{2,3}) (.*)$/);
    const out = h ? `<h${h[1].length}>${inline(h[2], pending)}</h${h[1].length}>`
      : b.startsWith('- ') ? `<ul>\n${b.split(/\n(?=- )/).map(li => `<li>${inline(li.slice(2), pending)}</li>`).join('\n')}\n</ul>`
      : /^!\[[^\]]*\]\([^)]+\)$/.test(b) ? `<p class="media">${inline(b)}</p>`
      : `<p>${inline(b, pending)}</p>`;
    return [out, ...pending.map(name => `<aside data-for="${attr(name)}"><p>${inline(notes.get(name))}</p></aside>`)].join('\n');
  }).join('\n');
  for (const name of notes.keys()) if (!used.has(name)) fail(`${where}: note [^${name}] is never cited`);
  return html;
}

// A post's own page: its title in the sky, its game to buy sitting on the horizon, then his words on the land, and at
// their foot the official post.
const site = url => /steampowered|steamcommunity/.test(url) ? ['steam', 'Steam'] : /youtube\.com|youtu\.be/.test(url) ? ['youtube', 'YouTube'] : null;
const buy = (game, href, cls = 'buy') => {
  const store = site(href);
  return `<a class="${cls}" href="${attr(href)}">${store ? icon(store[0]) : ''}Buy ${esc(game)}${store ? ` on ${store[1]}` : ''}${ARROW}</a>`;
};
function postPage(p) {
  const where = site(p.link);
  return `${head({ title: `${p.title} – randy`, url: p.page, image: p.src, alt: p.title, type: 'article' })}
<body>
<header class="read-sky">
  <a class="read-home" href="/">${wordmark('sheen')}</a>
  <h1>${esc(p.title)}</h1>
  <p class="byline">${when(p)}</p>
</header>
<main class="read">
  ${p.buy ? buy(p.game, p.buy) : '<span class="buy-none"></span>'}
  <article class="post">
${markdown(p)}
  </article>
  <a class="official" href="${attr(p.link)}">Read the official post${where ? ` on ${where[1]}` : ''}${ARROW}</a>
</main>
<footer class="foot"><a href="/">randy.gg</a><a href="mailto:contact@randy.gg">contact@randy.gg</a></footer>
</body>
</html>
`;
}

// An art post's page: the piece stands in the sky in its frame, its timelapse playing there once and settling on the
// finished piece; on the horizon sits a quiet scrub bar for it (script.js); then the title, the original to download,
// and his writeup on the land.
function artPage(p) {
  const t = p.timelapse, still = `<img class="still" src="${attr(p.src)}" alt="${attr(p.title)}" width="${p.size[0]}" height="${p.size[1]}">`;
  return `${head({ title: `${p.title} – randy`, url: p.page, image: p.src, alt: p.title, type: 'article' })}
<body class="art" style="--ar: ${p.size[0]} / ${p.size[1]}">
<header class="art-sky">
  <a class="read-home" href="/">${wordmark('sheen')}</a>
  <figure class="frame${t ? '' : ' finished'}">
    ${t ? `<video src="${attr(t)}" muted playsinline preload="auto" aria-label="${attr(p.title)}, timelapse"></video>
    ${still}` : still}
  </figure>
</header>
<main class="read">
  ${t ? `<div class="process">
    <button class="process-play" type="button" aria-label="Play">${icon('play')}${icon('pause')}</button>
    <div class="scrub" role="slider" tabindex="0" aria-label="Timelapse" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"><span class="scrub-tip" aria-hidden="true"></span></div>
    <span class="process-time">0:00</span>
  </div>` : '<span class="buy-none"></span>'}
  <header class="art-title">
    <h1>${esc(p.title)}</h1>
    <p class="byline">${when(p)}${download(p)}</p>
  </header>
  ${p.body ? `<article class="post">
${markdown(p)}
  </article>` : ''}
</main>
<footer class="foot"><a href="/">randy.gg</a><a href="mailto:contact@randy.gg">contact@randy.gg</a></footer>
</body>
</html>
`;
}

const posts = load();
fs.writeFileSync(path.join(OUT, 'index.html'), page(posts));
fs.rmSync(path.join(OUT, 'posts'), { recursive: true, force: true });
for (const p of posts.filter(p => p.page)) {
  fs.mkdirSync(path.join(OUT, p.page), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.page, 'index.html'), (p.track ? trackPage : p.type === 'art' ? artPage : postPage)(p));
}
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', ...posts.filter(p => p.page).map(p => p.page)].map(u => `<url><loc>${ORIGIN}${u}</loc></url>`).join('')}</urlset>
`);
fs.rmSync(path.join(OUT, 'assets', 'media'), { recursive: true, force: true });
fs.cpSync(path.join(CONTENT, 'media'), path.join(OUT, 'assets', 'media'), { recursive: true, filter: f => !f.endsWith('.peaks.json') });
console.log(`build: ${posts.length} posts -> site/index.html, ${posts.filter(p => p.page).length} with a page`);
if (uncovered.length) fail(uncovered.join('\n'));
