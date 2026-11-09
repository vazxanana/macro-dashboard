// Draws the installable-app icons in icons/ from the desk's coin logo (the gold radial-gradient coin with the light ring that
// every page uses as its favicon). Run by hand when the logo changes, then commit the PNGs (the Vercel build only copies them):
//   NODE_PATH=$(npm root -g) node scripts/make-icons.mjs
// Needs Playwright (a dev tool, not a site dependency). Background colour = the desk's dark --bg token.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const BG = '#08090c';
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'icons');
fs.mkdirSync(dir, { recursive: true });

// The favicon: a 32 px viewBox, coin r 14, ring r 10.5 stroke 1 white at 35%. Scaled to any size and coin radius.
const coin = (s, r) => `<defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fbe7a6"/><stop offset=".55" stop-color="#e3b341"/><stop offset="1" stop-color="#8a6312"/></radialGradient></defs>`
  + `<circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="url(#g)"/>`
  + `<circle cx="${s / 2}" cy="${s / 2}" r="${r * 0.75}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="${r / 14}"/>`;
const svg = (s, inner, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${bg ? `<rect width="${s}" height="${s}" fill="${bg}"/>` : ''}${inner}</svg>`;
// Notification badge (Android status bar): only the alpha channel counts, so a white coin with the ring cut out.
const badge = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><mask id="m"><rect width="${s}" height="${s}" fill="#fff"/><circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.33}" fill="none" stroke="#000" stroke-width="${s * 0.045}"/></mask><circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.44}" fill="#fff" mask="url(#m)"/></svg>`;

const ICONS = [
  // purpose "any": the coin on a transparent square (desktop docks / taskbars, Android when no maskable fits)
  ['icon-192.png', 192, svg(192, coin(192, 192 * 0.44))],
  ['icon-512.png', 512, svg(512, coin(512, 512 * 0.44))],
  // purpose "maskable": full-bleed background, coin inside the 40% safe-zone circle (Android crops to circle / squircle)
  ['maskable-192.png', 192, svg(192, coin(192, 192 * 0.3), BG)],
  ['maskable-512.png', 512, svg(512, coin(512, 512 * 0.3), BG)],
  // iOS home screen: opaque (iOS fills transparency with black), it rounds the corners itself
  ['apple-touch-icon.png', 180, svg(180, coin(180, 180 * 0.34), BG)],
  ['favicon-32.png', 32, svg(32, coin(32, 14))],
  ['badge-96.png', 96, badge(96)],
];

const b = await chromium.launch();
const page = await b.newPage({ deviceScaleFactor: 1 });
for (const [name, s, markup] of ICONS) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.locator('svg').screenshot({ path: path.join(dir, name), omitBackground: true });
  console.log('icons/' + name);
}
await b.close();
