// Charts app (26 Nov 2026, owner: "make an app just for the charts, try to have easy to move touch smooth on phones as well").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chartsPage } from '../scripts/charts-app.mjs';
const PAGE = fs.readFileSync('market-structure.html', 'utf8');
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

test('the build makes the charts page from the Desk page: its own mark, title and manifest', () => {
  const html = '<!DOCTYPE html><html lang="en" data-theme="dark"><head><link rel="manifest" href="/app.webmanifest"><title>Aureum Desk</title><meta name="apple-mobile-web-app-title" content="Aureum Desk"></head><body></body></html>';
  const out = chartsPage(html);
  assert.match(out, /<html lang="en" data-theme="dark" data-app="charts">/); assert.match(out, /<link rel="manifest" href="\/charts\.webmanifest">/);
  assert.match(out, /<title>Aureum Charts<\/title>/); assert.match(out, /apple-mobile-web-app-title" content="Charts"/);
  assert.throws(() => chartsPage('<html><head></head></html>'), /expected 4/);
  const sh = fs.readFileSync('scripts/build.sh', 'utf8');
  assert.ok(sh.indexOf('node scripts/pwa.mjs out') < sh.indexOf('node scripts/charts-app.mjs out') && sh.indexOf('node scripts/charts-app.mjs out') < sh.indexOf('node scripts/stamp-assets.mjs out'));
  assert.match(sh, /charts\.webmanifest/);
  if (fs.existsSync('out/charts.html')) { const b = fs.readFileSync('out/charts.html', 'utf8'); assert.match(b, /<html[^>]* data-app="charts">/); assert.match(b, /href="\/charts\.webmanifest"/); }
});

test('an app of its own: manifest, route, a way in from the Desk', () => {
  const m = J('charts.webmanifest'), main = J('app.webmanifest'), v = J('vercel.json');
  assert.equal(m.id, '/charts'); assert.equal(m.start_url, '/charts'); assert.equal(m.display, 'standalone'); assert.notEqual(m.id, main.id);
  for (const i of m.icons) assert.ok(fs.existsSync('.' + i.src), i.src);
  assert.ok(v.rewrites.some((r) => r.source === '/charts' && r.destination === '/charts.html'));
  assert.ok(v.headers.some((h) => h.source === '/charts.webmanifest' && h.headers.some((x) => x.value === 'application/manifest+json')));
  assert.ok(main.shortcuts.some((s) => s.url === '/charts'));
  assert.match(PAGE, /id="ms-me-charts" href="\/charts">Charts app<\/a>/);
});

test('in the app Charts is the only view and the site chrome steps aside; display only', () => {
  assert.match(PAGE, /h = PUB \|\| document\.documentElement\.dataset\.app === 'charts' \? 'charts' :/);
  assert.match(PAGE, /R\.home === 'macro' && E\.macro && !location\.hash && document\.documentElement\.dataset\.app !== 'charts'/, 'no landing redirect out of the app');
  const css = /<style id="ms-app-css">([\s\S]*?)<\/style>/.exec(PAGE)[1];
  assert.match(css, /html\[data-app="charts"\]:not\(\[data-chnav="1"\]\) :is\(header\.top, nav\.btab, #ps-sw\) \{ display: none !important; \}/);
  assert.match(css, /html\[data-app="charts"\]:not\(\[data-role="public"\]\) #ms-fit-menu \{ display: inline-flex; \}/, 'the Menu button brings the site back');
  assert.match(css, /html\[data-app="charts"\], html\[data-app="charts"\] body \{ overscroll-behavior: none; \}/);
  // every rule of the block is the app's, a touch screen's on Charts, or the short landscape toolbar
  for (const sel of css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{[^{}]*\})/g).map((x) => x.trim()).filter((x) => !x.startsWith('@'))) assert.match(sel, /^html\[data-(app|view)="charts"\]/, sel);
});

test('touch: a chart that fills the view takes the touch itself; the six-chart view keeps the page scrolling', () => {
  const css = /<style id="ms-app-css">([\s\S]*?)<\/style>/.exec(PAGE)[1];
  const touch = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(css)[1];
  assert.match(touch, /\.ms-grid4:not\(\[data-view="all"\]\) \.ms-chart, html\[data-view="charts"\] #v-charts \.mm-chart \{ touch-action: none; \}/);
  assert.match(touch, /-webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;/);
  assert.match(touch, /overscroll-behavior-y: none;/);
  assert.match(PAGE, /kineticScroll: \{ mouse: true, touch: true \}, handleScale: \{[^}]*\}, mouseWheel: true, pinch: true \}/);
});
