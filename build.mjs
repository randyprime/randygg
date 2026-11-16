#!/usr/bin/env node
// Writes randy.gg: the home, site/index.html (the link page's header, centred, then the type bar and every post as the
// live card, filterable by type; the first row peeking above the fold is the cue to scroll), a page for each post with
// words of its own, and the sitemap.
// A card goes to the post where it lives (Steam, YouTube), to its page here when it has words, or, for a piece hosted
// here, opens it in the viewer.
// No dependencies; the output is committed, so GitHub Pages runs no build. Run `node build.mjs`.
//
// content/posts/YYYY-MM-DD-slug.md  front matter only: title, type (one of TYPES), thumbnail, and either a link out or
//                                   a file hosted here (art: the original image, a PNG, a timelapse beside it; music: the track,
//                                   a FLAC, with no thumbnail: its cover is made from its logo, a game's own or else the
//                                   RANDY wordmark, and its waveform from NAME.peaks.json beside it, by tools/encode.sh)
//                                   A body under the front matter makes the post a page at /posts/NAME/, its link the
//                                   official post, linked at its foot (see markdown below for what the body can hold);
//                                   game and buy (its store page) put "Buy GAME on Steam" up top.
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

const fail = msg => { console.error(`build: ${msg}`); process.exit(1); };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');

// a post's media file, from its path relative to the post: where it's served and where it is on disk
const mediaFile = (f, rel, what) => {
  const inMedia = path.relative(path.join(CONTENT, 'media'), path.resolve(CONTENT, 'posts', rel));
  if (inMedia.startsWith('..') || !fs.existsSync(path.join(CONTENT, 'media', inMedia))) fail(`posts/${f}: ${what} is not in content/media/`);
  return { src: `/assets/media/${inMedia.split(path.sep).join('/')}`, disk: path.join(CONTENT, 'media', inMedia) };
};

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
    if (body && !data.link) fail(`posts/${f}: a post with words needs the link to its official post`);
    if (!data.game !== !data.buy) fail(`posts/${f}: game and buy go together`);
    if (!TYPES.some(t => t.toLowerCase() === data.type)) fail(`posts/${f}: type is one of ${TYPES.join(', ').toLowerCase()}`);
    const media = key => mediaFile(f, data[key], key);
    const file = data.file && media('file');
    const peaks = isTrack && file.disk.replace(/\.[^.]+$/, '.peaks.json');
    if (peaks && !fs.existsSync(peaks)) fail(`posts/${f}: no waveform; run tools/encode.sh ${data.file} ${path.basename(peaks)} (paths from content/media)`);
    return {
      ...data, slug: f.slice(0, -3), body, page: body && `/posts/${f.slice(11, -3)}/`, date: `${m[1]}-${m[2]}-${m[3]}`, longDate: `${+m[3]} ${MONTHS[m[2] - 1]} ${m[1]}`,
      src: data.thumbnail && media('thumbnail').src, file, timelapse: data.timelapse && media('timelapse').src,
      size: file && !isTrack && pngSize(file.disk),
      track: isTrack && { seconds: flacSeconds(file.disk), peaks: JSON.parse(fs.readFileSync(peaks, 'utf8')), logo: data.logo && media('logo').src },
    };
  });
  if (!posts.length) fail('no posts');
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

const icon = name => `<svg aria-hidden="true"><use href="/assets/icons.svg#${name}"/></svg>`;
const ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';
const WORDMARK = fs.readFileSync(path.join(OUT, 'assets', 'randy.svg'), 'utf8').match(/ d="([^"]+)"/)[1];

// The live card, a post per card: its image, then one bar with where it came from (Steam, YouTube, or its type when it's
// hosted here), its title and when it went out, an arrow. script.js turns the date into how long ago, at view time so the
// committed page never goes stale. A hosted piece's card is a button that opens its viewer.
const source = p => p.file ? icon(p.type) : /steampowered|steamcommunity/.test(p.link) ? icon('steam') : /youtube\.com|youtu\.be/.test(p.link) ? icon('youtube') : '';
const card = (p, lazy) => {
  const [open, close] = p.file ? [`<button class="capsule-link" type="button" popovertarget="view-${p.slug}">`, '</button>'] : [`<a class="capsule-link" href="${attr(p.page || p.link)}">`, '</a>'];
  const image = p.track ? `<span class="capsule-image cover" style="${sky(p.slug)}">${logo(p, 'cover-logo')}</span>`
    : `<img class="capsule-image" src="${attr(p.src)}" alt=""${lazy ? ' loading="lazy"' : ''}>`;
  return `${open}
          ${image}
          <span class="capsule-cta">${source(p)}<span class="cta-text"><span>${esc(p.title)}</span><time class="when" datetime="${p.date}" title="${p.longDate}">${p.longDate}</time></span>${ARROW}</span>
        ${close}`;
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

// A hosted piece, fullscreen on dark (a popover: Esc or a click outside closes it): its timelapse, playing from the
// start (script.js), or the image when it has none; under it one bar with the title and the original to download.
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// a FLAC's length, off its STREAMINFO: total samples over the sample rate
const flacSeconds = disk => {
  const b = fs.readFileSync(disk).subarray(0, 42);
  if (b.toString('latin1', 0, 4) !== 'fLaC') fail(`${disk}: a track is a FLAC`);
  return ((b[21] & 0x0f) * 2 ** 32 + b.readUInt32BE(22)) / ((b[18] << 12) | (b[19] << 4) | (b[20] >> 4));
};
// a PNG's size, off its header, for the viewer's frame before anything loads
const pngSize = disk => {
  const b = fs.readFileSync(disk).subarray(0, 24);
  if (b.readUInt32BE(12) !== 0x49484452) fail(`${disk}: hosted art is a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const download = p => {
  const ext = path.extname(p.file.disk).slice(1);
  const mb = (fs.statSync(p.file.disk).size / 1e6).toFixed(1);
  return `<a class="download" href="${attr(p.file.src)}" download="${slugify(p.title)}.${ext}">${icon('download')}${ext.toUpperCase()} · ${mb} MB</a>`;
};
function viewer(p) {
  return `  <div class="viewer" id="view-${p.slug}" popover role="dialog" aria-label="${attr(p.title)}">
    <div class="stage">
      ${p.timelapse ? `<video src="${attr(p.timelapse)}" poster="${attr(p.src)}" width="${p.size[0]}" height="${p.size[1]}" muted playsinline controls preload="none" aria-label="${attr(p.title)}, timelapse"></video>`
        : `<img src="${attr(p.src)}" width="${p.size[0]}" height="${p.size[1]}" alt="${attr(p.title)}" loading="lazy">`}
    </div>
    <div class="viewer-bar">
      ${icon(p.type)}<span class="viewer-title">${esc(p.title)}</span>
      ${download(p)}
    </div>
  </div>`;
}

// A track's player: the whole screen its cover, the logo, and under it the waveform that is the scrubber (the bars are
// its loudness, drawn here; script.js lights what has played), then the time, play, volume and the FLAC. It opens
// playing; the X, Esc, Space, and the arrows are script.js's and the popover's.
function player(p) {
  const { seconds, peaks } = p.track;
  const bars = peaks.map((v, i) => { const h = Math.max(3, v ** 0.6 * 100); return `M${i * 5} ${((100 - h) / 2).toFixed(1)}h3v${h.toFixed(1)}h-3z`; }).join('');
  return `  <div class="viewer player cover" id="view-${p.slug}" popover role="dialog" aria-label="${attr(p.title)}" style="${sky(p.slug)}">
    <button class="close" type="button" popovertarget="view-${p.slug}" popovertargetaction="hide" aria-label="Close">${icon('close')}</button>
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
    <audio src="${attr(p.file.src)}" preload="none"></audio>
  </div>`;
}

// All and the types, each filtering the gallery. Pure CSS: each type's link holds its anchor (a span, so the browser
// doesn't ring a focused link, pinned to the page's top so a click doesn't scroll), and :target marks the type on and
// filters the grid (the per-type rules are written into the page from TYPES).
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
  </div>
  <section class="gallery" id="posts" aria-label="Posts">
    ${typeBar}
    <ul class="gallery-grid">
${posts.map(p => `      <li data-type="${p.type}">${card(p, true)}</li>`).join('\n')}
${TYPES.map(t => t.toLowerCase()).filter(t => !posts.some(p => p.type === t)).map(t => `      <li class="empty" data-type="${t}">Nothing here yet</li>`).join('\n')}
    </ul>
    <a class="to-top" href="#top">Back to top</a>
  </section>
${posts.filter(p => p.file).map(p => (p.track ? player : viewer)(p)).join('\n')}
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
      const img = mediaFile(p.slug + '.md', rel, `image ${rel}`), size = img.disk.endsWith('.png') ? pngSize(img.disk) : null;
      return hold(`<img src="${attr(img.src)}" alt="${attr(alt)}"${size ? ` width="${size[0]}" height="${size[1]}"` : ''} loading="lazy">`);
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
function postPage(p) {
  const store = p.buy && site(p.buy), where = site(p.link);
  return `${head({ title: `${p.title} – randy`, url: p.page, image: p.src, alt: p.title, type: 'article' })}
<body>
<header class="read-sky">
  <a class="read-home" href="/">${wordmark('sheen')}</a>
  <h1>${esc(p.title)}</h1>
  <p class="byline"><time datetime="${p.date}">${p.longDate}</time></p>
</header>
<main class="read">
  ${p.buy ? `<a class="buy" href="${attr(p.buy)}">${store ? icon(store[0]) : ''}Buy ${esc(p.game)}${store ? ` on ${store[1]}` : ''}${ARROW}</a>` : '<span class="buy-none"></span>'}
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

const posts = load();
fs.writeFileSync(path.join(OUT, 'index.html'), page(posts));
fs.rmSync(path.join(OUT, 'posts'), { recursive: true, force: true });
for (const p of posts.filter(p => p.page)) {
  fs.mkdirSync(path.join(OUT, p.page), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.page, 'index.html'), postPage(p));
}
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', ...posts.filter(p => p.page).map(p => p.page)].map(u => `<url><loc>${ORIGIN}${u}</loc></url>`).join('')}</urlset>
`);
fs.rmSync(path.join(OUT, 'assets', 'media'), { recursive: true, force: true });
fs.cpSync(path.join(CONTENT, 'media'), path.join(OUT, 'assets', 'media'), { recursive: true, filter: f => !f.endsWith('.peaks.json') });
console.log(`build: ${posts.length} posts -> site/index.html, ${posts.filter(p => p.page).length} with a page`);
