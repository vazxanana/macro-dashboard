// Draws the installable-app icons, the favicon PNGs and the link-preview card from the Aureum Desk mark
// (assets/aureum-mark.svg: a brushed-silver rounded square with a bold "A"; docs/design/aureum-theme.md, section 2).
// Run by hand when the mark changes, then commit the PNGs (the build only copies them):
//   NODE_PATH=$(npm root -g) node scripts/make-icons.mjs
// Needs Playwright (a dev tool, not a site dependency). Background = the graphite theme's dark --au-bg, #121315.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BG = '#121315';
const dir = path.join(ROOT, 'icons');
fs.mkdirSync(dir, { recursive: true });

// The mark's own parts, read from the SVG so the icons can never drift from it.
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'aureum-mark.svg'), 'utf8');
const pick = (re, what) => { const m = SRC.match(re); if (!m) throw new Error('aureum-mark.svg: no ' + what); return m[1]; };
const DEFS = pick(/(<defs>[\s\S]*?<\/defs>)/, 'defs');
const RX = Number(pick(/id="aureum-tile"[^>]*\brx="([\d.]+)"/, 'tile radius'));
const A = pick(/id="aureum-a"[^>]*\bd="([^"]+)"/, 'letter path');

// The mark (512 units) placed at x, y with side s.
const mark = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 512})"><rect width="512" height="512" rx="${RX}" fill="url(#aureum-silver)"/><path fill="#16181B" fill-rule="evenodd" d="${A}"/></g>`;
const icon = (size, frac, bg) => {
  const s = size * frac, o = (size - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${DEFS}${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}${mark(o, o, s)}</svg>`;
};
// Notification badge (Android status bar): only the alpha channel counts, so a white tile with the A cut out.
const badge = (size) => {
  const s = size * 0.86, o = (size - s) / 2, k = s / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><mask id="m"><rect width="${size}" height="${size}" fill="#fff"/><path transform="translate(${o} ${o}) scale(${k})" fill="#000" fill-rule="evenodd" d="${A}"/></mask><rect x="${o}" y="${o}" width="${s}" height="${s}" rx="${RX * k}" fill="#fff" mask="url(#m)"/></svg>`;
};

// Maskable icons keep the whole tile inside the 40 % safe circle: a square of side 0.56 reaches 0.396 at its corners
// (its rounded corners even less). The root icons are the old gold-terminal manifest's "any maskable" pair, so they follow it.
const ICONS = [
  // purpose "any": the tile on a transparent square (desktop docks / taskbars, shortcuts, notification icon)
  ['icons/icon-192.png', 192, icon(192, 0.88)],
  ['icons/icon-512.png', 512, icon(512, 0.88)],
  // purpose "maskable": full-bleed graphite, the tile inside the safe zone (Android crops to circle / squircle)
  ['icons/maskable-192.png', 192, icon(192, 0.56, BG)],
  ['icons/maskable-512.png', 512, icon(512, 0.56, BG)],
  // iOS home screen: opaque (iOS fills transparency with black), it rounds the corners itself
  ['icons/apple-touch-icon.png', 180, icon(180, 0.62, BG)],
  ['icons/favicon-32.png', 32, icon(32, 1)],
  ['icons/badge-96.png', 96, badge(96)],
  // the old gold-terminal manifest (manifest.json, "any maskable") and gold-trading.html's icon links
  ['icon-192.png', 192, icon(192, 0.56, BG)],
  ['icon-512.png', 512, icon(512, 0.56, BG)],
];

// Link-preview card, 1200 x 630: flat graphite, the mark and the wordmark as the spec draws it, one plain line.
// Inter is the vendored font of the site (assets/fonts, SIL OFL), so the card does not depend on installed fonts.
const font = path.join(ROOT, 'assets', 'fonts', 'inter-latin-c9407645.woff2');
const CARD = `<!doctype html><html><head><style>
@font-face { font-family: InterCard; src: url("data:font/woff2;base64,${fs.readFileSync(font).toString('base64')}") format("woff2"); font-weight: 100 900; }
html, body { margin: 0; width: 1200px; height: 630px; background: ${BG}; }
body { display: grid; place-items: center; font-family: InterCard, sans-serif; color: #ECEDEF; }
.c { display: flex; flex-direction: column; align-items: center; gap: 30px; }
.wm { display: flex; align-items: center; gap: 30px; }
.wm svg { width: 132px; height: 132px; display: block; }
.t { display: flex; align-items: baseline; gap: 26px; }
.au { font-size: 76px; font-weight: 700; letter-spacing: .14em; margin-right: -.14em; }
.dk { font-size: 76px; font-weight: 500; letter-spacing: .22em; color: #B4B8BF; margin-right: -.22em; }
.line { font-size: 30px; font-weight: 400; color: #8E939B; letter-spacing: .01em; }
.rule { width: 72px; height: 2px; background: #9DB4D3; border-radius: 2px; }
</style></head><body><div class="c">
<div class="wm">${SRC.replace(/<\?xml[^>]*>/, '')}<div class="t"><span class="au">AUREUM</span><span class="dk">DESK</span></div></div>
<div class="rule"></div><div class="line">A paper-trading desk</div></div></body></html>`;

const b = await chromium.launch();
const page = await b.newPage({ deviceScaleFactor: 1 });
for (const [name, s, markup] of ICONS) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.locator('svg').screenshot({ path: path.join(ROOT, name), omitBackground: true });
  console.log(name);
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(CARD, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
if (!(await page.evaluate(() => document.fonts.check('700 76px InterCard')))) throw new Error('card: Inter did not load');
await page.screenshot({ path: path.join(dir, 'og-card.png') });
console.log('icons/og-card.png');
await b.close();
