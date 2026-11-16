// Checks a staged or served copy of the site headlessly: the home scrolled to the bottom with nothing opened shows no
// popover (the track player), and each one opens and shuts again; every post page a card leads to loads clean, and an
// art post's filmstrip scrubs its timelapse. Exits 1 on a failure.
// Usage: xvfb-run -a nice -n 10 node tools/check.mjs <home url>
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.env.HOME, 'clyde/tools/clyde-playwright/package.json'));
const { chromium } = require('playwright-core');
const exe = process.env.CLYDE_PLAYWRIGHT_EXECUTABLE_PATH
  || path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell');
const url = process.argv[2];
if (!url) { console.error('usage: check.mjs <home url>'); process.exit(2); }

const browser = await chromium.launch({ executablePath: exe, args: ['--mute-audio'] });
const failures = [];
const shown = page => page.$$eval('[popover]', views => views.filter(v => v.getClientRects().length).map(v => v.id));
try {
  for (const viewport of [{ width: 1350, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', e => failures.push(`${viewport.width}: page error: ${e.message}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    for (const id of await shown(page)) failures.push(`${viewport.width}: ${id} shows while shut`);
    for (const id of await page.$$eval('[popover]', views => views.map(v => v.id))) {
      await page.click(`.gallery [popovertarget="${id}"]`);
      if (!(await shown(page)).includes(id)) failures.push(`${viewport.width}: ${id} doesn't open`);
      await page.keyboard.press('Escape');
      if ((await shown(page)).length) failures.push(`${viewport.width}: ${id} doesn't shut`);
    }
    for (const href of await page.$$eval('.gallery a[href^="/posts/"]', as => as.map(a => a.getAttribute('href')))) {
      await page.goto(new URL(href, url).href, { waitUntil: 'networkidle' });
      if (!(await page.$('.process'))) continue;
      const box = await page.$eval('.strip', e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.mouse.click(...box);
      const t = await page.$eval('.frame video', v => v.currentTime / v.duration);
      if (Math.abs(t - 0.5) > 0.05) failures.push(`${viewport.width}: ${href} filmstrip seeks to ${t.toFixed(2)}, not halfway`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures.length ? failures.join('\n') : 'check: ok');
process.exit(failures.length ? 1 : 0);
