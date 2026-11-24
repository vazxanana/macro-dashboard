// Charts in a trading-terminal look (24 Nov 2026, owner: "on 1 minute and small timeframes he doesn't show the candles",
// "make the interface look more TradingView"): every chart opens at a readable candle width, never every candle squeezed in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
test('one look and one default view for every chart on Charts', () => {
  assert.match(html, /const tvView = \(chart, n\) =>/);
  assert.match(html, /Math\.max\(50, Math\.min\(220, Math\.round\(w \/ 8\)\)\)/, 'about 8 px a candle, 50 to 220 candles in view');
  assert.match(html, /tvView\(chart, P\.bars\.length\)/, 'the six panes');
  assert.match(html, /else tvView\(SP\.chart, SP\.bars\.length\)/, 'the free chart (any timeframe, seconds too)');
  assert.match(html, /requestAnimationFrame\(\(\) => tvView\(C\.chart, C\.bars\.length\)\)/, 'markets side by side');
  assert.doesNotMatch(html, /SP\.chart\.timeScale\(\)\.fitContent\(\)/, 'the free chart never squeezes its 500 candles into the width');
  assert.match(html, /p\.chart\.applyOptions\(tvLook\(t, G\.theme\)\)/);
  assert.match(html, /SP\.chart\.applyOptions\(tvLook\(t, G\.theme\)\)/);
  assert.match(html, /C\.chart\.applyOptions\(tvLook\(t, G\.theme\)\)/);
  assert.match(html, /kineticScroll: \{ mouse: true, touch: true \}/);
});
test('green / red candles are one tap in Style; the owner\'s light-theme default stays', () => {
  assert.match(html, /id="ms-sty-tv"[^>]*>Green \/ red candles</);
  assert.match(html, /\$\('ms-sty-tv'\)\.addEventListener\('click', \(\) => \{ CUS = Object\.assign\(\{\}, CUS, \{ up: UPC, dn: DNC \}\)/);
});
