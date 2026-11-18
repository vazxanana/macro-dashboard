// node --test tests/aureum-mark.test.mjs — the Aureum Desk mark (docs/design/aureum-theme.md, section 2): one drawing in
// assets/aureum-mark.svg, the same letter in assets/aureum-mark.css, icons and the link-preview card drawn from it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const png = (f) => { const b = fs.readFileSync(path.join(ROOT, f)); assert.equal(b.toString('latin1', 1, 4), 'PNG', f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('the SVG mark: silver rounded square, the spec gradient, the A as a path (no font)', () => {
  const s = read('assets/aureum-mark.svg');
  assert.match(s, /viewBox="0 0 512 512"/);
  const stops = [...s.matchAll(/stop offset="([^"]+)" stop-color="(#[0-9A-Fa-f]{6})"/g)].map((m) => [Number(m[1]), m[2].toUpperCase()]);
  assert.deepEqual(stops, [[0, '#F4F5F7'], [0.55, '#B9BEC6'], [1, '#8A9099']]);
  assert.match(s, /x1="0" y1="0" x2="512" y2="512"/, '135deg from the top-left corner');
  const rx = Number(s.match(/id="aureum-tile"[^>]*rx="([\d.]+)"/)[1]);
  assert.ok(Math.abs(rx / 512 - 8 / 28) < 0.001, '8 px radius on 28 px');
  assert.match(s, /id="aureum-a" fill="#16181B" fill-rule="evenodd" d="M/);
  assert.doesNotMatch(s, /<text\b|font-family|<image\b|href=/, 'self-contained, no font');
});

test('the CSS mark draws the same letter and gradient as the SVG', () => {
  const svg = read('assets/aureum-mark.svg'), css = read('assets/aureum-mark.css');
  const d = svg.match(/id="aureum-a"[^>]*\bd="([^"]+)"/)[1];
  assert.equal((css.match(new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 2, 'mask and -webkit-mask');
  assert.match(css, /linear-gradient\(135deg, #F4F5F7 0%, #B9BEC6 55%, #8A9099 100%\)/);
  assert.match(css, /background: #16181B/);
});

test('icons and the card exist at their sizes; the app colour is the graphite --au-bg', () => {
  for (const [f, w, h] of [['icons/icon-192.png', 192, 192], ['icons/icon-512.png', 512, 512], ['icons/maskable-192.png', 192, 192],
    ['icons/maskable-512.png', 512, 512], ['icons/apple-touch-icon.png', 180, 180], ['icons/favicon-32.png', 32, 32],
    ['icons/badge-96.png', 96, 96], ['icon-192.png', 192, 192], ['icon-512.png', 512, 512], ['icons/og-card.png', 1200, 630], ['icons/email-logo.png', 585, 96]]) {
    assert.deepEqual(png(f), [w, h], f);
  }
  const m = JSON.parse(read('app.webmanifest'));
  assert.equal(m.theme_color, '#121315'); assert.equal(m.background_color, '#121315');
  assert.match(read('scripts/pwa.mjs'), /<meta name="theme-color" content="#121315">/);
  assert.match(read('docs/design/aureum-theme.md'), /`--au-bg` \| `#121315`/);
  const mk = read('scripts/make-icons.mjs');
  assert.match(mk, /assets', 'aureum-mark\.svg'/, 'the icons are drawn from the SVG');
  assert.match(mk, /const BG = '#121315'/);
});
