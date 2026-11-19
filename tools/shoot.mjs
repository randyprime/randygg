// Screenshots pages headlessly: node tools/shoot.mjs <outdir> <name>=<url>[|<selector to scroll to>[|<selectors to click, comma-separated>]] ...
// Each page is shot at desktop (1440) and phone (390, 3x) widths, full page.
// Run it under `xvfb-run -a nice -n 10` so nothing touches a real display.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(path.join(process.env.HOME, 'clyde/tools/clyde-playwright/package.json'));
const { chromium } = require('playwright-core');
const exe = process.env.CLYDE_PLAYWRIGHT_EXECUTABLE_PATH
  || path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell');

const [outdir, ...pairs] = process.argv.slice(2);
if (!outdir || !pairs.length) { console.error('usage: shoot.mjs <outdir> <name>=<url> ...'); process.exit(2); }
fs.mkdirSync(outdir, { recursive: true });

const sizes = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const only = (process.env.SIZES || 'desktop,phone').split(',');
const full = process.env.FULL !== '0';

const browser = await chromium.launch({ executablePath: exe, args: ['--mute-audio'] });
try {
  for (const size of only) {
    const ctx = await browser.newContext(sizes[size]);
    for (const pair of pairs) {
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      const [url, selector, clicks] = pair.slice(i + 1).split('|');
      const page = await ctx.newPage();
      page.on('pageerror', e => console.error(`[${name}] page error: ${e.message}`));
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); // a playing timelapse may never idle
      await page.evaluate(() => document.fonts.ready);
      if (selector) await page.evaluate(sel => {
        const el = document.querySelector(sel);
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120);
      }, selector);
      for (const click of clicks ? clicks.split(',') : []) { await page.click(click); await page.waitForTimeout(1200); }
      await page.waitForTimeout(400);
      const file = path.join(outdir, `${name}-${size}.png`);
      await page.screenshot({ path: file, fullPage: full });
      console.log(file);
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
