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
  assert.equal(Object.keys(L.DESKS).join(), 'mosha,lit,eg,msnr,lyriac,fade,bigfade,roundfade,boxfade,fvg,goldvb,jpyvb,nq1,dom');   // the last eight: the Equinox page (23 Nov 2026)
  assert.deepEqual(Object.values(L.DESKS).map((d) => d.file), ['mosha', 'lit', 'eg', 'msnr', 'lyriac', 'fade', 'bigfade', 'roundfade', 'boxfade', 'fvg', 'goldvb', 'jpyvb', 'nq1', 'dom'].map((k) => k + '/desk.json'));
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

// ─── the H4 engulf map on the Engulfing and Mosha desks' live chart (23 Nov 2026, a gold example of 20-23 Nov) ───
test('the H4 engulf map: the page copy of the engulf zones equals the desks\' own (zones and turnBack), on seeded candles', async () => {
  const G = await import('../council/eg-methods.mjs'), SOP = require('../assets/mosha-sop.js');
  assert.equal(L.EG_SPAN, G.EG_SPAN); assert.equal(L.EG_LIFE, G.EGM.life['4h']);
  for (const seed of [7, 11]) { let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const m5 = []; let p = 4000, drift = 0; for (let i = 0; i < 40 * 288; i++) { const t = 1790553600 + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
      if (i % 72 === 0) drift = (rnd() - 0.5) * 0.8; const o = p, c = o + drift + (rnd() - 0.5) * 3.2, h = Math.max(o, c) + rnd() * 1.6, l = Math.min(o, c) - rnd() * 1.6; m5.push({ time: t, open: o, high: h, low: l, close: c }); p = c; }
    for (const [tf, sec] of [['4h', 14400], ['1h', 3600], ['15m', 900]]) { const C = []; for (const b of m5) { const t = b.time - (b.time % sec), q = C[C.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else C.push({ ...b, time: t }); }
      const life = G.EGM.life[tf], a = L.egZones(C, sec, life), b = G.turnBack(C, G.zones(C, tf), sec), pick = (z) => [z.dir, z.top, z.bot, z.base, z.at, z.touch, z.fail, z.end, z.n, z.back == null ? null : z.back];
      assert.ok(a.length > 10, tf + ': ' + a.length); assert.deepEqual(a.map(pick), b.map(pick), 'seed ' + seed + ' ' + tf + ': the page copy equals council/eg-methods.mjs'); } }
  assert.ok(SOP.SEC['4h'] === 14400);
});

test('the H4 engulf map on the gold candles of 23 Nov 2026: the failed sell zone is a buy barrier, the next sell EG zone above stands; closed candles only', () => {
  const F = JSON.parse(rd('tests/fixtures/xau-ef-barrier-2026-11-23.json')), rows = (a) => a.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const m5 = rows(F['5m']), H = rows(F['4h']); for (const b of m5.filter((x) => x.time >= 1795392000)) { const t = b.time - (b.time % 14400), q = H[H.length - 1]; if (q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else H.push({ ...b, time: t }); }
  const at = (now) => L.h4Map(H, now), has = (m, label, bot, top) => m.some((z) => z.label === label && Math.abs(z.bot - bot) < 1e-9 && Math.abs(z.top - top) < 1e-9);
  const after = at(1795406400 + 3600);   // 23 Nov 05:00 UTC: the 00:00 H4 candle closed above the zone at 04:00
  assert.ok(has(after, 'H4 EF (failed sell → buy barrier)', 3566.86, 3595.29), JSON.stringify(after));
  assert.ok(has(after, 'H4 sell EG zone', 3719.835, 3744.545));
  assert.ok(after.every((z) => (z.kind === 'ef' ? /^H4 EF \(failed (buy|sell) → (buy|sell) barrier\)$/ : /^H4 (buy|sell) EG zone$/).test(z.label) && z.top > z.bot));
  assert.equal(L.hueKey('H4 EF (failed sell → buy barrier)'), 'ef'); assert.equal(L.hueKey('H4 sell EG zone'), 'h4');
  // an hour before that close the same zone is still a sell EG zone, never an EF: the map reads only candles closed by its moment
  const before = at(1795406400 - 3600); assert.ok(has(before, 'H4 sell EG zone', 3566.86, 3595.29) && !has(before, 'H4 EF (failed sell → buy barrier)', 3566.86, 3595.29));
  assert.deepEqual(before, L.h4Map(H.filter((b) => b.time + 14400 <= 1795406400 - 3600), 1795406400 - 3600), 'the same map from the candles cut at that moment');
  assert.ok(after.filter((z) => z.bot > H.filter((b) => b.time + 14400 <= 1795410000).at(-1).close).length <= 3, 'at most three above the price');
});

test('the H4 map: on the Engulfing and Mosha desks only, a toggle on the card, display only and nothing kept', () => {
  assert.deepEqual(Object.keys(L.DESKS).filter((k) => L.DESKS[k].h4), ['mosha', 'eg']);
  const src = rd('assets/desk-live.js');
  assert.match(src, /data-dl-h4 aria-pressed="true"/); assert.match(src, /'&tf=4h&n=' \+ H4_N/); assert.match(src, /display only: the choice is not kept/);
  assert.ok(!/localStorage|sessionStorage/.test(src));
});
