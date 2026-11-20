// Phone audit 2 (20 Nov 2026): what a 390 px phone could not reach, found by opening every menu and dialog in a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const desk = read('market-structure.html'), draw = read('assets/ms-draw.js'), bt = read('backtest.html'), guide = read('assets/ms-charts-guide.js');

test('the Desk\'s drawing style bar wraps inside the screen (Lock, Clone and Delete were 230 px past a phone\'s edge)', () => {
  assert.match(desk, /\.ms-dsel \{ flex-wrap: wrap; max-width: calc\(100vw - 16px\); box-sizing: border-box; \}/);
  // placed above the shape by its own height, so a wrapped bar does not sit on the drawing's handles
  assert.match(draw, /- Math\.max\(48, \(el\.offsetHeight \|\| 40\) \+ 8\) : 80;/);
  // and still clamped sideways by its (now limited) width
  assert.match(draw, /lx = Math\.max\(8, Math\.min\(innerWidth - bw - 8, lx\)\)/);
});

test('ChronosTrade full screen on a phone: the trade dock is a bottom sheet and never covers the replay bar', () => {
  const i = bt.indexOf('/* A phone in full screen (20 Nov 2026)');
  assert.ok(i > 0, 'the phone full-screen block is there');
  const block = bt.slice(i, bt.indexOf('body.fs #toasts', i));
  assert.match(block, /@media \(max-width: 640px\) \{/);
  assert.match(block, /body\.fs #tradecard \{ left: 8px !important; right: 8px; top: auto !important; bottom: calc\(8px \+ env\(safe-area-inset-bottom, 0px\)\); width: auto; max-height: min\(46vh, 46dvh\);/);
  assert.match(block, /body\.fs #tradecard > \.qb, body\.fs #tradecard > \.qdef \{ order: -1; \}/, 'Sell / Buy first in the sheet');
  assert.match(block, /body\.fs:has\(#tb\.more-open, #tb details\[open\]\) #tradecard \{ visibility: hidden; \}/, 'More (and with it the way out of full screen) is never under the dock');
  // the wide-screen dock is unchanged
  assert.match(bt, /body\.fs #tradecard \{ position: fixed; z-index: 45; width: 320px; max-height: calc\(100vh - 32px\);/);
  // the phone block is not inside the simple view's block (Full gets it too) and names no phone attribute
  assert.doesNotMatch(block, /data-phone|\.ps-/);
});

test('the trade dialog on touch: 44 px buttons, no 11 px labels', () => {
  assert.match(desk, /@media \(pointer: coarse\) \{ \.tv-h \.tv-ba button \{ min-height: 44px; \} \.tv-tk \.tk-b button, \.tv-tk \.tk-b a \{ height: 44px; \} \}/);
  const k = desk.indexOf('.tv-tk .tk-h, .tv-nb .nb-k { font-size: 12px; }');
  assert.ok(k > desk.indexOf('.tv-tk .tk-h { font-size: 11px;') && k > desk.indexOf('.tv-nb .nb-k { font-size: 11px;'), 'the 12 px rule comes after both 11 px ones');
});

test('the charts guide\'s close button is 44 px wide on touch', () => {
  assert.match(guide, /@media \(pointer: coarse\) \{[^}]*\.chg-x[^}]*\{ min-height: 44px; \} \.chg-x \{ min-width: 44px; \} \}/);
});
