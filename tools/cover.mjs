// Renders a track's link preview (its og:image) off its own page: the cover, logo and waveform at 1200x630, without the
// controls. Point it at a served build of the track's page; build.mjs names the output.
// Usage: xvfb-run -a nice -n 10 node tools/cover.mjs <track page url> <content/media/music/NAME.cover.jpg>
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.env.HOME, 'clyde/tools/clyde-playwright/package.json'));
const { chromium } = require('playwright-core');
const exe = process.env.CLYDE_PLAYWRIGHT_EXECUTABLE_PATH
  || path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell');
const [url, out] = process.argv.slice(2);
if (!url || !out?.endsWith('.cover.jpg')) { console.error('usage: cover.mjs <track page url> <content/media/music/NAME.cover.jpg>'); process.exit(2); }

const browser = await chromium.launch({ executablePath: exe, args: ['--mute-audio', '--autoplay-policy=user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.close, .player-times, .player-controls { visibility: hidden; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
  console.log(out);
} finally {
  await browser.close();
}
