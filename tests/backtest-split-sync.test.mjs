// node --test tests/backtest-split-sync.test.mjs — ChronosTrade's split charts move together and share drawings (17 Nov 2026,
// owner: "on charts all should be synced moving same time and when I draw in one should show on the others"): the time ⇄ index
// mapping of a chart, the view range carried between timeframes, the echo guard, the magnet candle of a pane (closed by the
// moment), and the page wiring (the toggle, a pane's overlay and gestures, display only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const BT = createRequire(import.meta.url)('../assets/backtest-engine.js');
const page = readFileSync(new URL('../backtest.html', import.meta.url), 'utf8');

// a 15m chart with a weekend gap (Friday 20:45 → Sunday 22:00) and a 1m chart over the same hours
const T0 = 1767960000;   // a Friday, 12:00 UTC
const mk = (t0, sec, n) => Array.from({ length: n }, (_, i) => ({ time: t0 + i * sec, open: 1, high: 2, low: 0.5, close: 1.5 }));
const fri = mk(T0, 900, 36), sun = mk(T0 + 2 * 86400 + 10 * 3600, 900, 20), M15 = fri.concat(sun);   // Fri 12:00-20:45, Sun 22:00-
const M1 = mk(T0, 60, 540).concat(mk(T0 + 2 * 86400 + 10 * 3600, 60, 300));

test('a candle\'s start sits at its index, a time inside it in proportion, a weekend at the next candle; outside the candles one index a step', () => {
  const n = M15.length;
  assert.equal(BT.tfLogical(M15, n, 900, M15[5].time), 5);
  assert.equal(BT.tfLogical(M15, n, 900, M15[5].time + 450), 5.5);
  assert.equal(BT.tfLogical(M15, n, 900, M15[35].time + 3600 * 5), 36, 'Saturday maps to the Sunday open');
  assert.equal(BT.tfLogical(M15, n, 900, T0 - 1800), -2, 'before the first candle');
  assert.equal(BT.tfLogical(M15, n, 900, M15[n - 1].time + 2700), n - 1 + 3, 'past the last candle');
  assert.equal(BT.tfLogical([], 0, 900, T0), null);
  // the inverse, and round trips both ways on candle times and inside candles
  for (const lg of [-3, -0.5, 0, 4.25, 35.5, 36, 47.75, n - 1, n + 2.5]) assert.ok(Math.abs(BT.tfLogical(M15, n, 900, BT.tfTimeAt(M15, n, 900, lg)) - lg) < 1e-9, 'round trip ' + lg);
  for (const b of M15) assert.equal(BT.tfTimeAt(M15, n, 900, BT.tfLogical(M15, n, 900, b.time)), b.time);
});

test('a view range carried to another timeframe covers the same time window, both ways, weekend included', () => {
  const a = { bars: M15, n: M15.length, sec: 900 }, b = { bars: M1, n: M1.length, sec: 60 }, h4 = { bars: mk(T0 - 12 * 3600, 14400, 6).concat(mk(T0 + 2 * 86400 + 8 * 3600, 14400, 3)), sec: 14400 }; h4.n = h4.bars.length;
  const r = { from: 10, to: 30 }, q = BT.syncRange(a, b, r);
  assert.equal(BT.tfTimeAt(M1, M1.length, 60, q.from), BT.tfTimeAt(M15, M15.length, 900, 10));
  assert.equal(BT.tfTimeAt(M1, M1.length, 60, q.to), BT.tfTimeAt(M15, M15.length, 900, 30));
  assert.equal(q.from, 150); assert.equal(q.to, 450);   // 15 one-minute candles a 15m candle
  const back = BT.syncRange(b, a, q); assert.ok(Math.abs(back.from - 10) < 1e-9 && Math.abs(back.to - 30) < 1e-9, 'and back');
  // across the weekend: the window ends on Sunday on both
  const w = BT.syncRange(a, b, { from: 30, to: 45 }); assert.equal(BT.tfTimeAt(M1, M1.length, 60, w.to), M15[45].time);
  // a higher timeframe: inside its candle in proportion; a right margin past the last candle stays a margin
  const hq = BT.syncRange(a, h4, { from: 0, to: M15.length - 1 + 8 }); assert.ok(hq.to > h4.n - 1, 'the empty space after the last candle is kept');
  assert.equal(BT.syncRange(a, b, null), null); assert.equal(BT.syncRange(a, { bars: [], n: 0, sec: 60 }, r), null);
});

test('the echo guard: the range just set comes back as the same numbers within the window; a later or different one is the person moving it', () => {
  const exp = { from: 10, to: 30, at: 1000 };
  assert.equal(BT.syncEcho(exp, { from: 10.001, to: 29.999 }, 1100), true);
  assert.equal(BT.syncEcho(exp, { from: 12, to: 32 }, 1100), false);
  assert.equal(BT.syncEcho(exp, { from: 10, to: 30 }, 1600), false, 'too late: a person moved it back');
  assert.equal(BT.syncEcho(null, { from: 10, to: 30 }, 1100), false);
});

test('the magnet on a pane reads only candles closed by the replay moment, on that pane\'s own timeframe', () => {
  const h1 = mk(T0, 3600, 5), T = T0 + 4 * 3600 + 1800;   // the last 1h candle is still forming at T
  assert.equal(BT.closedBarAt(h1, 5, 3600, T0 + 3600 + 100, T).time, T0 + 3600);
  assert.equal(BT.closedBarAt(h1, 5, 3600, T0 + 4 * 3600 + 60, T), null, 'the forming candle is not a magnet');
  assert.equal(BT.closedBarAt(h1, 5, 3600, T0 - 10, T), null);
  assert.equal(BT.closedBarAt(h1, 5, 3600, T0 + 5 * 3600 + 10, T + 9e9), null, 'no candle there');
});

test('page wiring: the sync toggle (on by default, remembered), a pane overlay and its gestures, and display only', () => {
  assert.match(page, /<button type="button" data-xsync aria-pressed="true"[^>]*>.*Sync charts<\/button>/);
  assert.match(page, /localStorage\.getItem\('btLab:splitSync'\) !== '0'/);
  assert.match(page, /localStorage\.setItem\('btLab:splitSync', XSYNC \? '1' : '0'\)/);
  const blk = page.slice(page.indexOf('// ---- split charts move together and share drawings'), page.indexOf('  xpLayout();\n'));
  assert.ok(blk.length > 3000);
  assert.match(blk, /BT\.syncRange\(sv, tv, r\)/); assert.match(blk, /BT\.syncEcho\(c\.exp, r, now\)/); assert.match(blk, /BT\.closedBarAt\(/);
  assert.match(blk, /drawShapes\(x, c, W, PH, false\)/, 'a pane draws the same drawings');
  assert.match(blk, /useCx\(c\) && dStart\(e\.clientX, e\.clientY\)/, 'a press on a pane starts a drawing gesture there');
  // one list of drawings: a pane's gesture goes through the same dStart / dMove / dEnd into S.draw, never a second list
  assert.ok(!/S\.draw\.push|S\.draw\s*=[^=]/.test(blk), 'no second list of drawings');
  // view only: no order call, no stop move, no account
  assert.ok(!/\b(place|instant|startDraft|closePartial|BT\.close|BT\.place|fixPos|fixOrd)\(/.test(blk), 'no order call');
  assert.ok(!/\.stop\s*=[^=]/.test(blk) && !/S\.acct/.test(blk), 'no stop move, no account access');
  // a pane's own redraw is locked out of the sync and takes the first chart's window again
  assert.match(page, /function xpDraw\(P, force\) \{ if \(P\.loading\) return; const c = cur\(\); if \(P\.dc\) P\.dc\.lock = performance\.now\(\) \+ 80;/);
  assert.match(page, /xsFrom\(MCX, P\.dc\); \}/);
  // the shared drawing code works on the chart the gesture is on
  assert.match(page, /const geo = \(d, c\) => \{ c = cxOf\(c\);/);
  assert.match(page, /function drawShapes\(x, c, W, PH, main\)/);
});

test('playing with split charts (19 Nov 2026): every committed candle reaches the panes on their cheap path, and their forming candle grows with the first chart, about 12 times a second, display only', () => {
  assert.match(page, /function render\(light\) \{ drawChart\(\); if \(light\) \{ overlay\(\); nowTxt\(\); xpStep\(\);/);
  const blk = page.slice(page.indexOf('function xpStep()'), page.indexOf('function xpLive(') + 1200);
  assert.match(blk, /xpDraw\(P, false\)/, 'never a full rebuild while playing');
  assert.match(blk, /if \(nw - XL < 80\) return;/);
  assert.doesNotMatch(blk, /P\.data\.push|P\.data\[[^\]]+\] =/, 'the live candle is never stored in the pane data');
  assert.match(page, /series\.update\(\{ time: b\.time, open: b\.open, high: hi, low: lo, close: price \}\); xpLive\(/);
});

test('a lower pane forms its candles like a live market while the replay plays (19 Nov 2026), display only', () => {
  const blk = page.slice(page.indexOf('  const xpLower = '), page.indexOf('function xpLive(', page.indexOf('  const xpLower = ')) + 900);
  assert.ok(blk.length > 500);
  assert.match(blk, /const tn = t \+ Math\.max\(0, Math\.min\(1, p\)\) \* B/, 'only the part of the slot the first chart has drawn');
  assert.match(blk, /if \(sec < B\) \{ if \(p != null && !S\.part\) xpLower\(P, sec, t, B, p\); continue; \}/);
  assert.doesNotMatch(blk, /P\.data\.push|P\.data\[[^\]]+\] =|S\.acct|BT\.advance|\.stop\s*=/, 'never stored, never an order or a stop');
  assert.match(page, /if \(!data && P\.liveT != null && sec < B\)/, 'a pause, Undo or a jump draws the pane from its data again');
  assert.match(page, /xpLive\(b\.time, b\.open, hi, lo, price, p\);/);
});

test('the forming candle follows the session\'s real finer candles on every chart (19 Nov 2026), display only', () => {
  const blk = page.slice(page.indexOf('  // real ticks (19 Nov 2026'), page.indexOf('  function drawForming(b, p)') + 900);
  assert.ok(blk.length > 1500);
  assert.match(blk, /x <= B \/ 4 && left \* B \/ x <= XMAX/, 'the finest finer timeframe that fits the cap');
  assert.match(blk, /if \(!RTK\.bars\.length \|\| !RTK\.g \|\| RTK\.from > t0 \|\| RTK\.to < t1\) return null;/, 'a candle the finer data does not cover keeps the simple path');
  assert.doesNotMatch(blk, /S\.acct|BT\.advance|\.stop\s*=|localStorage/, 'display only');
  assert.match(page, /RAF = requestAnimationFrame\(frame\); tkLoad\(\);/);
  assert.match(page, /const R = RTK\.g && RTK\.g < sec \? tkAgg\(b\.time, b\.time \+ sec, tn\) : null;/, 'lower panes take the same ticks');
  // tkAgg on hand-made finer candles
  const src = /const tkPath = [\s\S]*?return o; \}/.exec(blk)[0].replace(/RTK/g, 'K');
  const ubT = (arr, t) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].time <= t) lo = m + 1; else hi = m; } return lo; };
  const f = new Function('K', 'ubT', `${src}; return tkAgg;`);
  const K = { g: 60, from: 0, to: 300, bars: [{ time: 0, open: 10, high: 12, low: 9, close: 11 }, { time: 60, open: 11, high: 15, low: 11, close: 14 }, { time: 120, open: 14, high: 14, low: 8, close: 9 }] };
  const agg = f(K, ubT);
  assert.deepEqual(agg(0, 180, 180), { time: 0, open: 10, high: 15, low: 8, close: 9 }, 'every finer candle closed');
  assert.deepEqual(agg(0, 180, 60), { time: 0, open: 10, high: 12, low: 9, close: 11 });
  const mid = agg(0, 180, 90); assert.equal(mid.open, 10); assert.ok(mid.high <= 15 && mid.close > 11, 'the second candle half way up');
  assert.equal(agg(0, 400, 90), null, 'not covered');
});
