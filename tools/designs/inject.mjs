// Preview-only: puts the design directions' switcher into a staged copy of the page (tools/preview.sh calls it), so the
// real site never carries it. Bottom-right buttons, one per direction in designs.css; the pick rides the query (?d=3),
// leaving the hash to the type filters. Once he picks, fold that direction into style.css and delete tools/designs/.
// Usage: node tools/designs/inject.mjs <stage dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const stage = process.argv[2];
const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, 'designs.css'), 'utf8');
const count = Math.max(...[...css.matchAll(/\[data-design="(\d+)"\]/g)].map(m => +m[1]));
fs.copyFileSync(path.join(here, 'designs.css'), path.join(stage, 'assets', 'designs.css'));

const file = path.join(stage, 'index.html');
const buttons = Array.from({ length: count }, (_, i) => `<button type="button" data-d="${i + 1}">${i + 1}</button>`).join('');
const html = fs.readFileSync(file, 'utf8')
  .replace('</head>', `<link rel="stylesheet" href="/assets/designs.css">
<script>document.documentElement.dataset.design = new URLSearchParams(location.search).get('d') || '1';</script>
</head>`)
  .replace('</body>', `<nav class="design-switch" aria-label="Design">${buttons}</nav>
<script>
for (const b of document.querySelectorAll('.design-switch button')) b.addEventListener('click', () => {
  document.documentElement.dataset.design = b.dataset.d;
  const url = new URL(location); url.searchParams.set('d', b.dataset.d); history.replaceState(null, '', url);
});
</script>
</body>`);
fs.writeFileSync(file, html);
console.log(`designs: ${count} directions, switcher in ${file}`);
