// How long ago each post went out, worked out at view time so the committed page never goes stale; the exact time,
// in the reader's own zone, on hover.
const ago = time => {
  const then = new Date(time.dateTime), now = new Date(), mins = Math.floor((now - then) / 6e4), days = Math.floor(mins / 1440);
  const months = (now.getFullYear() - then.getFullYear()) * 12 + now.getMonth() - then.getMonth() - (now.getDate() < then.getDate() ? 1 : 0);
  const n = (k, unit) => `${k} ${unit}${k === 1 ? '' : 's'} ago`;
  time.title = then.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
  time.textContent = mins < 1 ? 'just now' : mins < 60 ? n(mins, 'minute') : mins < 1440 ? n(Math.floor(mins / 60), 'hour')
    : days < 2 ? 'yesterday' : days < 7 ? n(days, 'day') : months < 1 ? n(Math.floor(days / 7), 'week')
    : months < 12 ? n(months, 'month') : n(Math.floor(months / 12), 'year');
};

const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// play, quietly when the browser refuses it
const start = media => media.play().catch(() => {});

// An art post's piece and its timelapse. It plays once in the frame and settles on the finished piece; the scrub bar
// under it seeks (click or drag, the arrows), the time under the pointer; the button plays it again. Without motion it
// opens on the finished piece.
function art(process) {
  const frame = document.querySelector('.frame'), video = frame.querySelector('video'), play = process.querySelector('.process-play');
  const scrub = process.querySelector('.scrub'), tip = scrub.querySelector('.scrub-tip'), time = process.querySelector('.process-time');
  const length = () => video.duration || 0;
  const paint = t => {
    if (!length()) return;
    scrub.style.setProperty('--p', `${(100 * t) / length()}%`);
    scrub.setAttribute('aria-valuenow', Math.round(t));
    scrub.setAttribute('aria-valuetext', time.textContent = clock(t));
  };
  const finish = done => frame.classList.toggle('finished', done);
  const seek = t => {
    video.currentTime = t = Math.min(length(), Math.max(0, t));
    finish(t >= length() - 0.1);
    paint(t);
  };
  video.addEventListener('loadedmetadata', () => scrub.setAttribute('aria-valuemax', Math.round(length())));
  video.addEventListener('timeupdate', () => paint(video.currentTime));
  video.addEventListener('play', () => { finish(false); process.classList.add('playing'); play.ariaLabel = 'Pause'; });
  video.addEventListener('pause', () => { process.classList.remove('playing'); play.ariaLabel = 'Play'; });
  video.addEventListener('ended', () => { finish(true); paint(length()); scrub.classList.remove('pointing'); });
  play.addEventListener('click', () => {
    if (!video.paused) return video.pause();
    if (video.ended || frame.classList.contains('finished')) video.currentTime = 0;
    start(video);
  });

  // the time under the pointer shows only while it's over the bar (or dragging it)
  const at = e => {
    const box = scrub.getBoundingClientRect(), x = Math.min(box.width, Math.max(0, e.clientX - box.left));
    scrub.style.setProperty('--at', `${x}px`);
    tip.textContent = clock((x / box.width) * length());
    return (x / box.width) * length();
  };
  scrub.addEventListener('pointerenter', e => e.pointerType === 'mouse' && scrub.classList.add('pointing'));
  scrub.addEventListener('pointerleave', () => scrub.classList.remove('pointing'));
  scrub.addEventListener('pointerdown', e => { scrub.setPointerCapture(e.pointerId); video.pause(); seek(at(e)); });
  scrub.addEventListener('pointermove', e => { const t = at(e); if (scrub.hasPointerCapture(e.pointerId)) seek(t); });
  scrub.addEventListener('keydown', e => {
    const to = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    video.pause();
    seek(video.currentTime + to);
  });

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.addEventListener('loadedmetadata', () => seek(length()), { once: true });
  } else start(video);
}

// A track's page, its player. It plays on arrival, or where the browser holds sound back (a cold visit) waits on its
// play button. The X and Esc leave: back to the home when it came from there, else to it. The waveform is the
// scrubber: click or drag to seek, the time under the pointer. Space plays and pauses, the left and right arrows seek,
// up and down set the volume, which is kept for the session.
function player(view) {
  const audio = view.querySelector('audio'), play = view.querySelector('.play'), now = view.querySelector('.now');
  const wave = view.querySelector('.wave'), tip = view.querySelector('.wave-tip');
  const mute = view.querySelector('.mute'), volume = view.querySelector('.range');
  const length = +wave.getAttribute('aria-valuemax');
  const paint = t => {
    wave.style.setProperty('--p', `${(100 * t) / length}%`);
    wave.setAttribute('aria-valuenow', Math.round(t));
    wave.setAttribute('aria-valuetext', clock(t));
    now.textContent = clock(t);
  };
  const seek = t => { audio.currentTime = Math.min(length, Math.max(0, t)); paint(audio.currentTime); };
  const toggle = () => (audio.paused ? start(audio) : audio.pause());
  const nudge = v => { audio.muted = false; audio.volume = Math.min(1, Math.max(0, Math.round((audio.volume + v) * 10) / 10)); };

  const leave = () => {
    const from = document.referrer && new URL(document.referrer);
    if (from && from.origin === location.origin && from.pathname === '/' && history.length > 1) history.back();
    else location.assign('/');
  };
  view.querySelector('.close').addEventListener('click', e => { e.preventDefault(); leave(); });
  play.addEventListener('click', toggle);
  audio.addEventListener('play', () => { view.classList.add('playing'); play.ariaLabel = 'Pause'; });
  audio.addEventListener('pause', () => { view.classList.remove('playing'); play.ariaLabel = 'Play'; });
  audio.addEventListener('timeupdate', () => paint(audio.currentTime));

  const at = e => {
    const box = wave.getBoundingClientRect(), x = Math.min(box.width, Math.max(0, e.clientX - box.left));
    wave.style.setProperty('--at', `${x}px`);
    tip.textContent = clock((x / box.width) * length);
    return (x / box.width) * length;
  };
  wave.addEventListener('pointerdown', e => { wave.setPointerCapture(e.pointerId); seek(at(e)); });
  wave.addEventListener('pointermove', e => { const t = at(e); if (wave.hasPointerCapture(e.pointerId)) seek(t); });

  document.addEventListener('keydown', e => {
    if (e.target === volume && e.key.startsWith('Arrow')) return; // the slider takes its own arrows
    const act = { Escape: leave, ' ': toggle, ArrowLeft: () => seek(audio.currentTime - 5), ArrowRight: () => seek(audio.currentTime + 5),
      ArrowUp: () => nudge(0.1), ArrowDown: () => nudge(-0.1) }[e.key];
    if (!act) return;
    e.preventDefault();
    act();
  });

  const sound = () => {
    view.classList.toggle('muted', audio.muted || audio.volume === 0);
    mute.ariaLabel = audio.muted ? 'Unmute' : 'Mute';
    volume.value = audio.muted ? 0 : audio.volume;
    volume.style.setProperty('--p', `${100 * volume.value}%`);
    sessionStorage.setItem('volume', JSON.stringify([audio.volume, audio.muted]));
  };
  [audio.volume, audio.muted] = JSON.parse(sessionStorage.getItem('volume') || '[1, false]');
  audio.addEventListener('volumechange', sound);
  mute.addEventListener('click', () => { audio.muted = !audio.muted; if (!audio.muted && !audio.volume) audio.volume = 1; });
  volume.addEventListener('input', () => { audio.volume = +volume.value; audio.muted = false; });
  sound();
  audio.play().catch(() => play.focus({ focusVisible: false }));
}

// The night sky's stars, one small canvas per sky: tiny dots, a few sizes and brightnesses, the same every load (a
// fixed seed), thinning out before the dawn so none sit in the warm band, a rare one twinkling. They sit on a celestial
// sphere turning about a pole above the page, seen through a wide lens tipped below it, so each traces a long gentle
// arc like a star-trail exposure, the same dots-per-pixel on any screen. Drawn at most 30 times a second and only
// while the sky is on screen (the browser stops it in a hidden tab); with reduced motion they hold still.
const STARS = (() => {
  let a = 0x9e3779b9;
  const r = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32; };
  const tilt = (65 * Math.PI) / 180, reach = Math.cos((100 * Math.PI) / 180), lens = 1600, stars = [];
  for (let i = Math.round((2 * Math.PI * (1 - reach) * lens ** 2) / 1500); i--;) {
    const z = 1 - r() * (1 - reach), angle = r() * 2 * Math.PI, d = Math.sqrt(1 - z * z), glow = r();
    stars.push({ x: d * Math.cos(angle), y: d * Math.sin(angle), z, size: 0.45 + r() ** 3 * 0.95, glow: 0.3 + glow ** 2 * 0.7,
      hue: r() < 0.25 ? '205 70% 88%' : r() < 0.1 ? '35 80% 88%' : '0 0% 100%', twinkle: r() < 0.04 ? r() * 6.3 : null });
  }
  return { up: Math.sin(tilt), out: Math.cos(tilt), lens, stars };
})();
function stars(sky) {
  const canvas = Object.assign(document.createElement('canvas'), { className: 'stars', ariaHidden: true });
  sky.prepend(canvas);
  const g = canvas.getContext('2d'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const turn = (2 * Math.PI) / 3600e3, fade = 0.6, { up, out } = STARS;
  let w = 0, h = 0, shown = false, last = -Infinity;
  const draw = now => {
    const spin = still ? 0 : now * turn, c = Math.cos(spin), s = Math.sin(spin), cx = w / 2, cy = h / 2;
    const f = Math.max(w / 2, h * 0.9), count = STARS.stars.length * Math.min(1, (f / STARS.lens) ** 2);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      const star = STARS.stars[i], u = star.x * c - star.y * s, v = star.x * s + star.y * c, depth = star.z * out - v * up;
      if (depth <= 0.05) continue;
      const x = cx + (f * u) / depth, y = cy - (f * (star.z * up + v * out)) / depth, low = y / (h * fade);
      if (x < -2 || x > w + 2 || y < -2 || low >= 1) continue;
      let alpha = star.glow * (1 - low) ** 1.2;
      if (star.twinkle !== null && !still) alpha *= 0.7 + 0.3 * Math.sin(now / 900 + star.twinkle);
      g.fillStyle = `hsl(${star.hue} / ${alpha.toFixed(3)})`;
      g.beginPath();
      g.arc(x, y, star.size, 0, 2 * Math.PI);
      g.fill();
    }
  };
  const frame = now => {
    if (!shown || still) return;
    if (now - last >= 33) { last = now; draw(now); }
    requestAnimationFrame(frame);
  };
  new ResizeObserver(() => {
    const dpr = Math.min(2, devicePixelRatio);
    [w, h] = [sky.clientWidth, sky.clientHeight];
    [canvas.width, canvas.height] = [Math.round(w * dpr), Math.round(h * dpr)];
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }).observe(sky);
  new IntersectionObserver(([e]) => { const was = shown; shown = e.isIntersecting; if (shown && !was) requestAnimationFrame(frame); }).observe(sky);
}

// A post's margin notes, after Crafting Interpreters' script.js: each <aside data-for="x"> moves level with its
// <span class="anchor" data-aside="x">, and one that would overlap the note above it slides down instead. Where the
// margin doesn't fit (style.css's breakpoint) the notes stay after their block.
function placeAsides(post) {
  const inline = getComputedStyle(post.querySelector('aside')).position !== 'absolute';
  const base = post.getBoundingClientRect().top;
  let floor = -Infinity;
  for (const aside of post.querySelectorAll('aside[data-for]')) {
    aside.style.top = '';
    if (inline) continue;
    const anchor = post.querySelector(`.anchor[data-aside="${CSS.escape(aside.dataset.for)}"]`);
    const top = Math.max(anchor.getBoundingClientRect().top - base - 4, floor);
    aside.style.top = `${top}px`;
    floor = top + aside.offsetHeight + 16;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  for (const sky of document.querySelectorAll('.landing, .read-sky, .art-sky, .player')) stars(sky);
  for (const time of document.querySelectorAll('time[datetime]')) ago(time);
  for (const view of document.querySelectorAll('.player')) player(view);
  const process = document.querySelector('.process');
  if (process) art(process);
  const post = document.querySelector('.post');
  if (post?.querySelector('aside')) {
    const place = () => placeAsides(post);
    addEventListener('resize', place);
    for (const img of post.querySelectorAll('img')) img.addEventListener('load', place);
    document.fonts.ready.then(place);
    place();
  }
});
