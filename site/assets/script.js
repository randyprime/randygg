// How long ago each post went out, worked out at view time so the committed page never goes stale. The date stays
// in the markup as the fallback and the hover title.
const ago = iso => {
  const [y, m, d] = iso.split('-').map(Number), now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 864e5);
  const months = (now.getFullYear() - y) * 12 + now.getMonth() + 1 - m - (now.getDate() < d ? 1 : 0);
  const n = (k, unit) => `${k} ${unit}${k === 1 ? '' : 's'} ago`;
  return days < 1 ? 'today' : days < 2 ? 'yesterday' : days < 7 ? n(days, 'day') : months < 1 ? n(Math.floor(days / 7), 'week')
    : months < 12 ? n(months, 'month') : n(Math.floor(months / 12), 'year');
};

const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// A hosted piece's viewer. Opening and closing are the popover's own (Esc, a click outside); this plays what it opens
// on (a piece's timelapse from the start, a track from where it was), flips a piece between its timelapse and the still,
// and runs a track's player, its volume kept for the session. Closing stops both and resets a piece to its timelapse.
function viewer(view) {
  const stage = view.querySelector('.stage'), video = view.querySelector('video'), audio = view.querySelector('audio');
  const mark = which => {
    stage.dataset.view = which;
    for (const b of view.querySelectorAll('.views button')) b.setAttribute('aria-pressed', b.dataset.view === which);
  };
  const show = which => {
    mark(which);
    if (which === 'timelapse') { video.currentTime = 0; video.play(); } else video.pause();
  };
  for (const b of view.querySelectorAll('.views button')) b.addEventListener('click', () => show(b.dataset.view));
  view.addEventListener('toggle', e => {
    if (e.newState === 'open') { if (video) show('timelapse'); audio?.play(); return; }
    if (video) { video.pause(); mark('timelapse'); }
    audio?.pause();
  });
  if (!audio) return;
  const play = view.querySelector('.play'), scrub = view.querySelector('.scrub'), now = view.querySelector('.now');
  const mute = view.querySelector('.mute'), volume = view.querySelector('.volume .scrub');
  const fill = (range, v) => range.style.setProperty('--p', `${(100 * v) / range.max}%`);
  const paint = t => { scrub.value = t; fill(scrub, t); now.textContent = clock(t); };
  play.addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
  audio.addEventListener('play', () => { view.classList.add('playing'); play.ariaLabel = 'Pause'; });
  audio.addEventListener('pause', () => { view.classList.remove('playing'); play.ariaLabel = 'Play'; });
  audio.addEventListener('timeupdate', () => paint(audio.currentTime));
  scrub.addEventListener('input', () => { audio.currentTime = +scrub.value; paint(+scrub.value); });
  const sound = () => {
    view.classList.toggle('muted', audio.muted || audio.volume === 0);
    mute.ariaLabel = audio.muted ? 'Unmute' : 'Mute';
    volume.value = audio.muted ? 0 : audio.volume;
    fill(volume, volume.value);
    sessionStorage.setItem('volume', JSON.stringify([audio.volume, audio.muted]));
  };
  [audio.volume, audio.muted] = JSON.parse(sessionStorage.getItem('volume') || '[1, false]');
  audio.addEventListener('volumechange', sound);
  mute.addEventListener('click', () => { audio.muted = !audio.muted; if (!audio.muted && !audio.volume) audio.volume = 1; });
  volume.addEventListener('input', () => { audio.volume = +volume.value; audio.muted = false; });
  sound();
}

document.addEventListener('DOMContentLoaded', () => {
  for (const time of document.querySelectorAll('time.when')) time.textContent = ago(time.dateTime);
  for (const view of document.querySelectorAll('.viewer')) viewer(view);
});
