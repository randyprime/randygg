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

document.addEventListener('DOMContentLoaded', () => {
  for (const time of document.querySelectorAll('time.when')) time.textContent = ago(time.dateTime);
});
