// Checks a staged or served copy of the site headlessly: every post page a card leads to loads clean; an art post's
// scrub bar seeks its timelapse; a track's page, visited cold (sound held back), waits on its play button with its own
// title and link preview, and its X goes home; reached from its card, Esc goes back there. Its clock and zone are pinned (an hour after the newest post, in Da Nang)
// so each card's how-long-ago is checked against the post's published time. Exits 1 on a failure.
// Usage: xvfb-run -a nice -n 10 node tools/check.mjs <home url>
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.env.HOME, 'clyde/tools/clyde-playwright/package.json'));
const { chromium } = require('playwright-core');
const exe = process.env.CLYDE_PLAYWRIGHT_EXECUTABLE_PATH
  || path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell');
const url = process.argv[2];
const zone = 'Asia/Ho_Chi_Minh';
if (!url) { console.error('usage: check.mjs <home url>'); process.exit(2); }

const browser = await chromium.launch({ executablePath: exe, args: ['--mute-audio', '--autoplay-policy=user-gesture-required'] });
const failures = [];
try {
  for (const viewport of [{ width: 1350, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, timezoneId: zone });
    page.on('pageerror', e => failures.push(`${viewport.width}: page error: ${e.message}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    const newest = await page.$eval('time.when', t => t.dateTime);
    await page.clock.setFixedTime(Date.parse(newest) + 3600e3);
    await page.reload({ waitUntil: 'networkidle' });
    const when = await page.$eval('time.when', t => [t.textContent, t.title]);
    if (when[0] !== '1 hour ago' || when[1].includes('UTC')) failures.push(`${viewport.width}: the newest card, an hour old in ${zone}, says "${when[0]}" (${when[1]})`);
    const home = new URL(url).pathname;
    const track = await page.$eval('.gallery a[href^="/posts/"]:has(.cover)', a => a.getAttribute('href')).catch(() => null);
    if (track) {
      const before = await page.evaluate(() => history.length);
      await page.click(`.gallery a[href="${track}"]`);
      await page.waitForSelector('.player');
      await page.keyboard.press('Escape');
      await page.waitForURL(u => u.pathname === home);
      if (await page.evaluate(() => history.length) !== before + 1) failures.push(`${viewport.width}: Esc on ${track} from its card doesn't go back`);
    }
    for (const href of await page.$$eval('.gallery a[href^="/posts/"]', as => as.map(a => a.getAttribute('href')))) {
      // a long timelapse keeps fetching as it plays, so the network may never idle
      await page.goto(new URL(href, url).href, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      if (await page.$('.player')) {
        const [title, name, image, paused, ready] = await page.evaluate(() => [document.title, document.querySelector('.player').ariaLabel,
          document.querySelector('meta[property="og:image"]').content, document.querySelector('audio').paused, document.activeElement.matches('.play')]);
        if (!title.startsWith(name)) failures.push(`${viewport.width}: ${href} is titled "${title}"`);
        if ((await page.request.get(new URL(new URL(image).pathname, url).href)).status() !== 200) failures.push(`${viewport.width}: ${href}'s link preview ${image} is missing`);
        if (!paused || !ready) failures.push(`${viewport.width}: ${href} visited cold doesn't wait on its play button`);
        await page.click('.close');
        await page.waitForURL(u => u.pathname === home).catch(() => failures.push(`${viewport.width}: ${href}'s X doesn't go home`));
        continue;
      }
      if (!(await page.$('.process'))) continue;
      await page.waitForFunction(() => document.querySelector('.frame video').readyState >= 1);
      const box = await page.$eval('.scrub', e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.mouse.click(...box);
      const t = await page.$eval('.frame video', v => v.currentTime / v.duration);
      if (Math.abs(t - 0.5) > 0.05) failures.push(`${viewport.width}: ${href} scrub bar seeks to ${t.toFixed(2)}, not halfway`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures.length ? failures.join('\n') : 'check: ok');
process.exit(failures.length ? 1 : 0);
