// Checks a staged or served copy of the home headlessly: scrolled to the bottom with nothing opened, no viewer or
// player shows; each one opens and shuts again. Exits 1 on a failure.
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
const shown = page => page.$$eval('.viewer', views => views.filter(v => v.getClientRects().length).map(v => v.id));
try {
  for (const viewport of [{ width: 1350, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', e => failures.push(`${viewport.width}: page error: ${e.message}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    for (const id of await shown(page)) failures.push(`${viewport.width}: ${id} shows while shut`);
    for (const id of await page.$$eval('.viewer', views => views.map(v => v.id))) {
      await page.click(`.gallery [popovertarget="${id}"]`);
      if (!(await shown(page)).includes(id)) failures.push(`${viewport.width}: ${id} doesn't open`);
      await page.keyboard.press('Escape');
      if ((await shown(page)).length) failures.push(`${viewport.width}: ${id} doesn't shut`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures.length ? failures.join('\n') : 'check: ok');
process.exit(failures.length ? 1 : 0);
