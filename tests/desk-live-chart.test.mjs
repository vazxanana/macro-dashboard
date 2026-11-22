// node --test tests/desk-live-chart.test.mjs: the live chart on the four edge desks (assets/desk-live.js, 22 Nov 2026, owner: "live
// chart with markups on each edge ... like we done in Charts but on the edge page for each edge"). Offline: the page wiring,
// the asset's pure helpers, and that it is display only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url), L = require('../assets/desk-live.js');
const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the page loads the asset after the desks\' card code, and every desk view has a grid to host it', () => {
  const page = rd('market-structure.html'), a = page.indexOf('<script src="/assets/desk-trades.js" defer></script>'), b = page.indexOf('<script src="/assets/desk-live.js" defer></script>');
  assert.ok(a > 0 && b > a, 'desk-live.js loads with defer after desk-trades.js');
  for (const k of ['mosha', 'lit', 'eg', 'msnr']) {
    const i = page.indexOf('id="v-' + k + '"'), j = page.indexOf('</section>', i); assert.ok(i > 0);
    assert.ok(page.slice(i, j).includes('class="mo-grid"'), k + ' has a .mo-grid');
  }
  // the borrowed replay slot of desk-trades.js stays as it was: the live chart makes its own host
  assert.equal(page.split('<div class="mo-wide" data-dk="chart"></div>').length - 1, 3);
  assert.equal(Object.keys(L.DESKS).join(), 'mosha,lit,eg,msnr');
  assert.deepEqual(Object.values(L.DESKS).map((d) => d.file), ['mosha/desk.json', 'lit/desk.json', 'eg/desk.json', 'msnr/desk.json']);
});

test('the asset parses, runs in Node without a page, and is display only', () => {
  const src = rd('assets/desk-live.js');
  assert.doesNotThrow(() => new vm.Script(src));
  for (const re of [/\.stop\s*=[^=]/, /localStorage|sessionStorage|indexedDB/, /method:\s*['"](POST|PUT|DELETE)/i, /\b(placeOrder|NEW_ORDER|ctrader|msPaper)\b/i, /api\/(?!me)/])
    assert.ok(!re.test(src), 'not in desk-live.js: ' + re);
  assert.match(src, /\/md\/bars\?sym=/); assert.match(src, /msData/); assert.match(src, /withDetail/);
  assert.match(src, /msMoshaReplayDialog/);
  assert.ok(!/data-dk="chart"/.test(src), 'does not take the borrowed replay slot');
  // the teacher does not see it on the Mosha desk (as Open now); the simple phone view keeps it open (it is not a .card)
  assert.match(src, /html\[data-mosha="teach"\]:not\(\[data-role="owner"\]\) #v-mosha \.dl-card \{ display: none; \}/);
  assert.ok(!/className = '(?:[^']*\s)?card[\s']/.test(src)); assert.match(src, /className = 'dl-card mo-wide'/);
});

test('timeframes and polling', () => {
  assert.deepEqual(L.TFS.map((t) => t[1]), ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']);
  for (const [tf, , sec] of L.TFS) { assert.ok(L.POLL[tf] > 0); assert.ok(L.POLL[tf] * 1000 >= 3000); assert.ok(sec > 0); }
  assert.ok(L.POLL['1m'] < L.POLL['1d']);
  // the /md/bars timeframe keys the asset asks for all exist in the candle service
  const bars = rd('api/bars.js'); for (const [tf] of L.TFS) assert.ok(bars.includes("'" + tf + "': ['"), tf);
});

test('time to bar index: inside a candle in proportion, past the last by whole steps, before the first negative', () => {
  const T = [0, 60, 120, 300];   // a gap after 120
  assert.equal(L.logicalOf(T, 60, 0), 0); assert.equal(L.logicalOf(T, 60, 30), 0.5); assert.equal(L.logicalOf(T, 60, 90), 1.5);
  assert.equal(L.logicalOf(T, 60, 200), 3);   // inside the gap: the end of candle 2
  assert.equal(L.logicalOf(T, 60, 420), 5); assert.equal(L.logicalOf(T, 60, -60), -1); assert.equal(L.logicalOf([], 60, 5), null);
  assert.equal(L.barAt(T, 70), 60); assert.equal(L.barAt(T, 999), 300); assert.equal(L.barAt(T, -1), null);
});

test('the trades a chart shows: every open one of the market, then the latest closed ones the candles reach', () => {
  const rec = (id, market, t, R, endT) => ({ id, market, t, entry: 1, stop: 0.9, target: 1.2, R, endT });
  const rs = [rec('a', 'xau', 100, null, null), rec('b', 'xau', 50, 1, 80), rec('c', 'xau', 10, -1, 20), rec('d', 'eurusd', 60, null, null), rec('e', 'xau', 300, 1, 310), { id: 'f', market: 'xau', t: 70, R: 1, endT: 90 }];
  const p = L.pick(rs, 'xau', 40, 200, 10);
  assert.deepEqual(p.map((r) => r.id), ['a', 'b']);   // c ended before the candles, e starts after them, d another market, f has no levels
  assert.deepEqual(L.pick(rs.concat([rec('g', 'xau', 60, 1, 70), rec('h', 'xau', 70, -1, 75)]), 'xau', 40, 200, 2).map((r) => r.id), ['a', 'h', 'g']);
  assert.deepEqual(L.marketsOf(rs, ['xau', 'xag', 'eurusd']), ['xau', 'eurusd']);
  assert.deepEqual(L.marketsOf([{ id: 1 }]), ['xau']);
});

test('a refreshed read joins the candles held', () => {
  const b = (t, c) => ({ time: t, open: c, high: c, low: c, close: c });
  const m = L.mergeBars([b(0, 1), b(60, 2)], [b(60, 3), b(120, 4)]);
  assert.deepEqual(m.map((x) => [x.time, x.close]), [[0, 1], [60, 3], [120, 4]]);
  assert.deepEqual(L.mergeBars([], [b(0, 1)]).length, 1);
});

test('mark colours by kind, as the trade chart', () => {
  assert.equal(L.hueKey('M1 buy EG that failed (EF)'), 'ef'); assert.equal(L.hueKey('M5 EG zone · entry'), 'entry'); assert.equal(L.hueKey('M15 CF (QM)'), 'cf');
  assert.equal(L.hueKey('Order block', 'vr'), 'vr'); assert.equal(L.hueKey('Daily EF zone'), 'ef'); assert.equal(L.hueKey('Daily V level'), 'd1'); assert.equal(L.hueKey('H4 barrier'), 'h4');
  assert.equal(L.hueKey('Accumulation'), 'other');
  const rp = rd('assets/mosha-replay.js'); for (const k of ['ef', 'entry', 'cf', 'vr', 'd1', 'h4', 'h1', 'm15', 'm5']) assert.ok(rp.includes(k + ": ['" + L.HUES[k][0] + "', '" + L.HUES[k][1] + "']"), 'same hue as the replay: ' + k);
});
