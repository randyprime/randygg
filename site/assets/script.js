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
// play, quietly when a quick shut cuts it off (the browser rejects that play)
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

// A track's player, the whole screen. It plays on open (the card's click is the gesture that allows sound) and stops on
// close (the X, or Esc). The waveform is the scrubber: click or drag to seek, the time under the pointer. Space plays and
// pauses, the left and right arrows seek, up and down set the volume, which is kept for the session.
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

  view.addEventListener('toggle', e => (e.newState === 'open' ? start(audio) : audio.pause()));
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

  view.addEventListener('keydown', e => {
    if (e.target === volume && e.key.startsWith('Arrow')) return; // the slider takes its own arrows
    const act = { ' ': toggle, ArrowLeft: () => seek(audio.currentTime - 5), ArrowRight: () => seek(audio.currentTime + 5),
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
