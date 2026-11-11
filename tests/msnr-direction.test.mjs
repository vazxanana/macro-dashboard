// MSNR direction call study (research/edge/msnr-direction): each element of the call on small hand-made candle series, the
// no-look-ahead property, the statistics, and the committed result against the pre-registered bar and the written report.
// Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, LADDERS, dayKey, weekKey, group, calls, dailyCalls, plainT, neweyWestT, normP, lagOf, cell, holm, verdictOf } from '../research/edge/msnr-direction/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/msnr-direction/PREREGISTRATION.md'), RUN = rd('../research/edge/msnr-direction/run.mjs');
const bars = (rows) => rows.map((r, i) => ({ time: i, open: r[0], high: r[1], low: r[2], close: r[3] }));
const four = (t) => Math.floor(t / 4);          // four working candles to one higher-timeframe candle
const flip = (rows) => rows.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);

// One clean buy switch. Higher-timeframe candles 0 and 1: a falling candle, then a rising one closing above its high (an
// engulfing zone 95.7 to 100.3); candle 2 rises again and closes above candle 1's high (a dominant zone 96 to 102).
// Working candles: a swing high 106.5 (candle 9), a swing low 103.2 (11), a lower swing high 105.5 (13), a close below
// 103.2 (14: the structure is down), the first tap of the dominant zone (16) and of the engulfing zone (17), a small swing
// high 102.5 made AFTER the taps (19: internal), a close above it (22) and the close above 105.5 (23: the switch).
const ROWS = [
  [100, 100.3, 98.7, 99], [99, 99.2, 97.8, 98], [98, 98.2, 96.8, 97], [97, 97.2, 95.7, 96],
  [96, 97.7, 95.9, 97.5], [97.5, 99.2, 97.3, 99], [99, 100.7, 98.8, 100.5], [100.5, 102.3, 100.3, 102],
  [102, 104.3, 101.8, 104], [104, 106.5, 103.8, 106], [106, 106.2, 104.3, 104.5], [104.5, 104.8, 103.2, 103.5],
  [103.5, 105.3, 103.4, 105], [105, 105.5, 104.6, 105.2], [105.2, 105.3, 102.9, 103], [103, 103.2, 102.4, 102.6],
  [102.6, 102.8, 101.2, 101.5], [101.5, 101.7, 99.8, 100.2], [100.2, 102.2, 100, 102], [102, 102.5, 101, 101.2],
  [101.2, 101.9, 101, 101.7], [101.7, 102.3, 101.5, 102.2], [102.2, 103.6, 102, 103.4], [103.4, 106.2, 103.2, 106],
];
const edit = (ch) => ROWS.map((r, i) => ch[i] || r);

test('the constants and the test grid are the pre-registered ones', () => {
  assert.deepEqual([P.K, P.ZONE_AGE, P.WAIT], [2, 60, 10]);
  for (const s of ['`K = 2`', '`ZONE_AGE = 60`', '`WAIT = 10`', '1 Jan 2007 to 31 Dec 2019', '1 Jan 2020 to 31 Oct 2026', '`h = 1, 5, 20`', '`max(5, 2 x (h - 1))`', '`t >= 2.0`', '`2 ladders x 3 horizons = 6`']) assert.ok(PRE.includes(s), s);
  assert.deepEqual(P.A, ['2007-01-01', '2019-12-31']); assert.deepEqual(P.B, ['2020-01-01', '2026-10-31']); assert.deepEqual(P.HORIZONS, [1, 5, 20]);
  assert.deepEqual(Object.keys(LADDERS), ['L1', 'L2']); assert.deepEqual([1, 5, 20].map(lagOf), [5, 8, 38]);
});

test('the owner\'s private skill text is not in the repository files of this study', () => {
  for (const s of [PRE, RUN, rd('../research/edge/msnr-direction/RESULT.md')]) for (const w of ['L3XUS', 'Prem,', 'L3-SYSTEM', 'Sama']) assert.ok(!s.includes(w), w);
});

test('calendar: Sunday\'s candles belong to Monday, a week is Monday to Friday', () => {
  const t = (s) => Date.parse(s) / 1000, d = (k) => new Date(k * 1000).toISOString().slice(0, 10);
  assert.equal(d(dayKey(t('2026-09-27T20:00:00Z'))), '2026-09-28');      // Sunday evening
  assert.equal(d(dayKey(t('2026-09-28T04:00:00Z'))), '2026-09-28'); assert.equal(d(dayKey(t('2026-09-25T20:00:00Z'))), '2026-09-25');
  assert.equal(d(weekKey(t('2026-09-27T20:00:00Z'))), '2026-09-28'); assert.equal(d(weekKey(t('2026-10-02T20:00:00Z'))), '2026-09-28'); assert.equal(d(weekKey(t('2026-10-04T20:00:00Z'))), '2026-10-05');
  const g = group([{ time: t('2026-09-27T20:00:00Z'), open: 1, high: 3, low: 0.5, close: 2 }, { time: t('2026-09-28T00:00:00Z'), open: 2, high: 5, low: 1.5, close: 4 }, { time: t('2026-09-29T00:00:00Z'), open: 4, high: 4.5, low: 3, close: 3.5 }], dayKey);
  assert.equal(g.length, 2); assert.deepEqual([g[0].open, g[0].high, g[0].low, g[0].close, g[0].last], [1, 5, 0.5, 4, t('2026-09-28T00:00:00Z')]);
});

test('key levels one timeframe above: engulfing, dominant, swing and failed-engulfing zones, each known only at its close', () => {
  const r = calls(bars(ROWS), four), z = (kind, s) => r.zoneLog.filter((x) => x.kind === kind && x.s === s);
  assert.deepEqual(z('eg', 1)[0], { s: 1, kind: 'eg', bottom: 95.7, top: 100.3, born: 2 });      // known when candle 1 has closed
  assert.deepEqual(z('dom', 1)[0], { s: 1, kind: 'dom', bottom: 96, top: 102, born: 3 });        // the first candle's body
  // a second candle that does not close beyond the first's high is no dominant zone
  const soft = edit({ 8: [102, 102.2, 101.8, 102.1], 9: [102.1, 102.25, 101.9, 102.1], 10: [102.1, 102.2, 101.9, 102.1], 11: [102.1, 102.6, 102, 102.2] });
  assert.equal(calls(bars(soft), four).zoneLog.filter((x) => x.kind === 'dom' && x.born === 3).length, 0);
  // swing zone: a higher-timeframe low with two higher lows each side, from its low to the bottom of its body, known two candles later
  const H = [[10, 11, 9, 9.5], [9.5, 10, 8, 8.4], [8.4, 9, 6, 7], [7, 9.5, 6.8, 9], [9, 10.5, 8.8, 10], [10, 10.4, 9.6, 10.2]];
  const s = calls(bars(H), (t) => t).zoneLog.find((x) => x.kind === 'swing' && x.s === 1);
  assert.deepEqual(s, { s: 1, kind: 'swing', bottom: 6, top: 7, born: 5 });
  // failed engulfing: a bearish engulfing zone closed above becomes a support zone at the same prices, from that close
  const F = [[10, 12, 9.8, 11.5], [11.5, 12.5, 9, 9.5], [9.5, 10, 9.2, 9.8], [9.8, 13.2, 9.7, 13], [13, 13.1, 12.8, 12.9]];
  const f = calls(bars(F), (t) => t).zoneLog;
  assert.deepEqual(f.find((x) => x.kind === 'eg' && x.s === -1), { s: -1, kind: 'eg', bottom: 9.8, top: 12.5, born: 2 });
  assert.deepEqual(f.find((x) => x.kind === 'ef'), { s: 1, kind: 'ef', bottom: 9.8, top: 12.5, born: 4 });
});

test('the switch: structure down, first tap of a key level, the level frozen at the tap, and only its break sets the call', () => {
  const r = calls(bars(ROWS), four);
  assert.deepEqual([...r.structure.slice(13, 16)], [0, -1, -1]);                 // candle 14 closes below the swing low 103.2
  const taps = r.events.filter((e) => e.type === 'tap');
  assert.deepEqual(taps.map((e) => [e.i, e.kind, e.s, e.level]), [[16, 'dom', 1, 105.5], [17, 'eg', 1, 105.5]]);
  assert.equal(r.structure[22], 1); assert.equal(r.call[22], 0);                 // the internal high broke: a breakout, but no switch
  assert.equal(r.call[23], 1); assert.ok([...r.call.slice(0, 23)].every((x) => x === 0));
  assert.deepEqual(r.events.filter((e) => e.type === 'switch').map((e) => [e.i, e.s, e.level]), [[23, 1, 105.5]]);
});

test('a breakout with no key level tapped changes nothing; nor does a late break, a dead zone, or a tap while the structure is not down', () => {
  const b = bars(ROWS);
  const none = calls(b, four, { ZONE_AGE: 1 });                                  // every zone is gone before price comes back
  assert.equal(none.structure[23], 1); assert.ok([...none.call].every((x) => x === 0)); assert.equal(none.events.length, 0);
  assert.ok([...calls(b, four, { WAIT: 0 }).call].every((x) => x === 0));       // the break comes one higher-timeframe candle after the tap
  // a higher-timeframe close below both zones before the break: the taps are void
  const dead = calls(bars(edit({ 19: [102, 102.5, 94.8, 95], 20: [95, 101.9, 94.9, 101.7] })), four);
  assert.ok([...dead.call].every((x) => x === 0));
  // candle 14 holds above the swing low, so the structure only turns down ON the candle that taps the first zone: that tap
  // gives nothing (the structure is read at the candle's open); the next zone's tap, one candle later, does
  const late = calls(bars(edit({ 14: [105.2, 105.3, 103.3, 103.4], 15: [103.4, 103.5, 103.25, 103.3] })), four);
  assert.deepEqual(late.events.filter((e) => e.type === 'tap').map((e) => [e.i, e.kind]), [[17, 'eg']]); assert.equal(late.call[23], 1);
});

test('the sell side is the mirror image', () => {
  const up = calls(bars(ROWS), four), dn = calls(bars(flip(ROWS)), four);
  assert.deepEqual([...dn.call], [...up.call].map((x) => -x || 0)); assert.deepEqual([...dn.structure], [...up.structure].map((x) => -x || 0));
});

// a deterministic random walk with structure on two scales
function walk(n, seed = 7) {
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out = []; let p = 1000, t = Date.parse('2019-01-07T00:00:00Z') / 1000;
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay(), hr = new Date(t * 1000).getUTCHours();
    if (!(w === 6 || (w === 0 && hr < 20) || (w === 5 && hr > 20))) { const o = p, c = p * (1 + (rnd() - 0.5) * 0.012 + Math.sin(out.length / 90) * 0.0008), h = Math.max(o, c) * (1 + rnd() * 0.003), l = Math.min(o, c) * (1 - rnd() * 0.003); out.push({ time: t, open: o, high: h, low: l, close: c }); p = c; }
    t += 14400; }
  return out;
}

test('no look-ahead: the call at t is the same on the candles up to t, and whatever comes after t', () => {
  const W = walk(2400), full = calls(W, dayKey);
  assert.ok(full.events.filter((e) => e.type === 'switch').length >= 6, 'the walk switches both ways');
  assert.ok([...full.call].includes(1) && [...full.call].includes(-1));
  for (const cut of [300, 777, 1203, 1900, 2399]) {
    const part = calls(W.slice(0, cut), dayKey);
    assert.deepEqual([...part.call], [...full.call.slice(0, cut)]); assert.deepEqual([...part.structure], [...full.structure.slice(0, cut)]);
    const bent = W.map((b, i) => (i < cut ? b : { time: b.time, open: b.open * 3, high: b.high * 5, low: b.low / 4, close: b.close / 2 })), alt = calls(bent, dayKey);
    assert.deepEqual([...alt.call.slice(0, cut)], [...full.call.slice(0, cut)]);
  }
  // the daily series of both ladders: cutting the file at the end of a day leaves every earlier day's call unchanged
  const D = dailyCalls(W), k = 1500, endOfDay = W.findIndex((b, i) => i >= k && dayKey(W[i + 1].time) !== dayKey(b.time)), E = dailyCalls(W.slice(0, endOfDay + 1));
  for (const L of ['L1', 'L2']) assert.deepEqual([...E[L].call], [...D[L].call.slice(0, E.days.length)]);
  assert.equal(E.days.at(-1).close, W[endOfDay].close);
});

test('statistics: Newey-West, the excess over the base rate, Holm, and the verdict bar', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.ok(Math.abs(neweyWestT(a, 0) - plainT(a) * Math.sqrt(8 / 7)) < 1e-9);          // lag 0 = the plain t, up to n vs n - 1
  const pos = Array.from({ length: 200 }, (_, i) => (Math.floor(i / 10) % 2 ? 1 : -1) + 0.3); // runs of ten: positive autocorrelation
  assert.ok(neweyWestT(pos, 8) < neweyWestT(pos, 0));
  assert.ok(Math.abs(normP(0) - 0.5) < 1e-6 && Math.abs(normP(1.96) - 0.025) < 1e-3 && normP(-2) > 0.97);
  // a market that only rises 1% a day: a call that is always "buy" has no excess at all, and its hit rate equals its base
  const days = Array.from({ length: 60 }, (_, i) => ({ time: i * 86400, close: 100 * 1.01 ** i }));
  const c = cell(days, new Int8Array(60).fill(1), 5, 0, 59 * 86400);
  assert.equal(c.days, 55); assert.equal(c.n, 55); assert.ok(Math.abs(c.excessPct) < 1e-9); assert.equal(c.hit, 100); assert.equal(c.hitBase, 100);
  // a call that knows the next day: up on even days, down on odd ones
  const zig = Array.from({ length: 41 }, (_, i) => ({ time: i * 86400, close: 100 + (i % 2) })), s = Int8Array.from(zig, (_, i) => (i % 2 ? -1 : 1));
  const k = cell(zig, s, 1, 0, 40 * 86400);
  assert.equal(k.n, 40); assert.equal(k.hit, 100); assert.equal(k.hitBase, 50); assert.ok(k.excessPct > 0.9);
  // returns that end outside the window are dropped, and days with no call are not counted
  s[0] = 0; assert.equal(cell(zig, s, 1, 0, 20 * 86400).days, 20); assert.equal(cell(zig, s, 1, 0, 20 * 86400).n, 19);
  assert.deepEqual(holm([['a', 0.01], ['b', 0.04], ['c', 0.03]]), { a: 0.03, c: 0.06, b: 0.06 });
  const T = (tb, ea, ph) => ({ a: { excessPct: ea }, b: { t: tb }, pHolm: ph });
  assert.equal(verdictOf({ x: T(2.5, 0.1, 0.03), y: T(0.5, 0.1, 0.9) }), 'PASS');
  assert.equal(verdictOf({ x: T(2.5, 0.1, 0.08), y: T(0.5, 0.1, 0.9) }), 'INCONCLUSIVE');
  assert.equal(verdictOf({ x: T(2.5, -0.1, 0.03), y: T(1.9, 0.1, 0.2) }), 'FAIL');     // the sign must agree in the other window
});

test('the committed result: six tests, the pre-registered bar applied to them, and the report says the same', () => {
  const R = JSON.parse(rd('../research/edge/msnr-direction/result.json')), MD = rd('../research/edge/msnr-direction/RESULT.md');
  assert.equal(R.topic, 'msnr-direction'); assert.deepEqual(Object.keys(R.tests), ['L1-h1', 'L1-h5', 'L1-h20', 'L2-h1', 'L2-h5', 'L2-h20']);
  assert.equal(R.variantsTried, 6); assert.deepEqual(R.params.A, P.A); assert.deepEqual(R.params.B, P.B);
  const copy = JSON.parse(JSON.stringify(R.tests)), v = verdictOf(copy);
  assert.ok(R.verdict.startsWith(v + ':')); for (const k of Object.keys(copy)) assert.equal(copy[k].pass, R.tests[k].pass);
  assert.deepEqual(holm(Object.keys(R.tests).map((k) => [k, R.tests[k].b.p])), Object.fromEntries(Object.keys(R.tests).map((k) => [k, R.tests[k].pHolm])));
  assert.ok(new RegExp(`^\\*\\*Verdict: ${v}\\b`, 'm').test(MD), 'RESULT.md opens with the same verdict');
  const sg = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`;
  for (const k of Object.keys(R.tests)) for (const w of ['a', 'b']) { const c = R.tests[k][w];
    assert.ok(c.n > 500 && c.nBuy + c.nSell === c.n);
    const row = MD.split('\n').find((l) => l.startsWith(`| ${k} | ${w === 'a' ? '2007-19' : '2020-26'} |`)); assert.ok(row, `${k} ${w} row`);
    for (const cellText of [c.n.toLocaleString('en-US'), sg(c.excessPct) + '%', sg(c.t), c.hit.toFixed(1) + '%', c.hitBase.toFixed(1) + '%']) assert.ok(row.includes(cellText), `${k} ${w}: ${cellText} in "${row}"`); }
  assert.equal(R.candidates.length, 6); assert.ok(R.candidates.every((c) => !c.is && !c.oos));   // nothing here is a trade: no R statistics for the lab
});
