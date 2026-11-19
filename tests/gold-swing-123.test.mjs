// gold-swing-123: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, swings, isSwingHigh, isSwingLow, signal, trade, runTest, holm, verdictLine, READING } from '../research/edge/gold-swing-123/run.mjs';

const DIR = new URL('../research/edge/gold-swing-123/', import.meta.url);
const MON = Date.UTC(2024, 0, 1) / 1000; // a Monday
// candles from a list of closes: weekdays only, open 30 % of the way from the previous close, high / low 0.5 beyond the body
function make(closes) {
  const bars = []; let prev = closes[0], d = 0;
  for (const c of closes) {
    while ([0, 6].includes(new Date((MON + d * 86400) * 1000).getUTCDay())) d++;
    const o = prev + 0.3 * (c - prev);
    bars.push({ time: MON + d * 86400, open: o, high: Math.max(o, c) + 0.5, low: Math.min(o, c) - 0.5, close: c }); prev = c; d++;
  }
  return bars;
}
// a 1-2-3 bottom: fall to A (100), rally to B (~110), dip to C (104, a higher low), then break above B
const UP = [120, 116, 112, 108, 104, 100, 103, 106, 109, 110, 108, 106, 104, 105, 107, 109, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125];

test('swings: strictly beyond two days on each side, known two days later', () => {
  const bars = make(UP);
  assert.equal(isSwingLow(bars, 5), true); // A
  assert.equal(isSwingHigh(bars, 9), true); // B
  assert.equal(isSwingLow(bars, 12), true); // C
  assert.equal(isSwingLow(bars, 4), false);
  assert.equal(isSwingHigh(bars, bars.length - 1), false); // needs two days after
  const flat = make([100, 100, 100, 100, 100, 100]);
  assert.equal(isSwingHigh(flat, 2), false); // ties are not swings
});

test('signal: higher low, first close above point 2, stop under point 3, no look-ahead; the mirror short', () => {
  const bars = make(UP), sw = swings(bars);
  // B.high = 110.5; day 16 closes 112, the first close above it (day 15 closes 109)
  assert.equal(signal(bars, sw, 15, 1), null);
  const s = signal(bars, sw, 16, 1);
  assert.ok(s); assert.equal(s.a, 5); assert.equal(s.b, 9); assert.equal(s.c, 12);
  assert.equal(s.stop, bars[12].low - P.BUF);
  assert.equal(signal(bars, sw, 17, 1), null); // not the first close above B any more
  // changing every price after day 16 does not change the signal at day 16
  const ch = bars.map((b, i) => (i > 16 ? { ...b, open: b.open / 3, high: b.high / 3, low: b.low / 3, close: b.close / 3 } : b));
  assert.deepEqual(signal(ch, swings(ch), 16, 1), s);
  // C must be known: two days after it. On day 13 the dip low (day 12) is not yet a swing
  assert.equal(signal(bars, sw, 13, 1), null);
  // a lower low at C is no 1-2-3
  const ll = UP.slice(); ll[12] = 98; ll[11] = 101; ll[13] = 101;
  const bl = make(ll);
  assert.equal(signal(bl, swings(bl), 16, 1), null);
  // the mirror: negate the path
  const dn = make(UP.map((x) => 300 - x)), sd = signal(dn, swings(dn), 16, -1);
  assert.ok(sd); assert.equal(sd.stop, dn[12].high + P.BUF);
  assert.equal(signal(dn, swings(dn), 16, 1), null);
});

test('trade: next open, stop on the losing side, 10-day time exit, costs and financing; gaps fill at the open', () => {
  const PRE = Array.from({ length: 20 }, (_, i) => 160 - 2 * i); // 20 days of history for ATR(20); the pattern starts at index 20
  const bars = make([...PRE, ...UP]), sw = swings(bars), s = signal(bars, sw, 36, 1);
  assert.ok(s); assert.equal(s.c, 32);
  const t = trade(bars, 36, 1, s.stop);
  assert.equal(t.entry, bars[37].open); assert.ok(t.stop < t.entry);
  assert.equal(t.how, 'time'); assert.equal(t.xi, 37 + P.HOLD - 1); assert.equal(t.exit, bars[46].close);
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(t.finR > 0 && Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const sh = trade(bars, 36, -1, bars[37].open + 5);
  assert.ok(sh.stop > sh.entry); assert.equal(sh.finR, 0);
  const g = bars.map((b) => ({ ...b })); g[39].open = 90; g[39].low = 89;
  const tg = trade(g, 36, 1, s.stop);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 90); assert.equal(tg.xi, 39);
  assert.equal(trade(bars, 45, 1, 100), null); // no room for ten days
  assert.deepEqual(trade(bars, 36, 1, bars[37].open + 1), { skip: 'wrong-side' });
  assert.deepEqual(trade(bars, 36, 1, bars[37].open - 0.01), { skip: 'near' }); // under 0.5 x ATR(20)
});

test('one position at a time; Holm', () => {
  // repeat the 1-2-3 path: trades never overlap
  const path = []; for (let k = 0; k < 6; k++) path.push(...UP.map((x) => x + k * 30));
  const bars = make(path), sw = swings(bars);
  const { trades } = runTest(bars, sw, TESTS[0]);
  assert.ok(trades.length >= 2);
  for (let i = 1; i < trades.length; i++) assert.ok(trades[i].t >= trades[i - 1].xi);
  const h = holm([0.01, 0.04, 0.5]);
  assert.deepEqual(h.map((x) => Math.round(x * 1000) / 1000), [0.03, 0.08, 0.5]);
});

test('the report and the reading match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, r.tests[0].pass ? 'PASS' : 'FAIL');
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.headline, verdictLine(r));
  assert.ok(r.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${r.headline}.**`));
  const [T1, T2, T3] = r.tests;
  const read = READING.join('\n');
  const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  for (const [t, w] of [[T1, 'oos'], [T1, 'is'], [T2, 'oos'], [T2, 'is'], [T3, 'oos'], [T3, 'is']]) {
    assert.ok(read.includes(`${sg(t[w].netR)}R a trade net`) || read.includes(`${sg(t[w].netR)}R`), `${t.id} ${w} netR`);
    assert.ok(read.includes(`n ${t[w].trades}, `), `${t.id} ${w} n`);
    assert.ok(read.includes(`t ${t[w].monthNetT.toFixed(2)}`), `${t.id} ${w} t`);
  }
  assert.ok(read.includes(`above 28 of 40`) && T1.placebo.below === 28);
  assert.ok(read.includes(`above only 19 of 40`) && T2.placebo.below === 19);
  assert.ok(read.includes(`median t of ${T2.placebo.p50.toFixed(2)}`));
  assert.ok(read.includes(`$${T1.is.medianStop.toFixed(2)} in sample and $${T1.oos.medianStop.toFixed(2)}`));
  assert.ok(read.includes(`+${r.drift.oos.netR.toFixed(3)}R a trade net out of sample (n ${r.drift.oos.trades}, month t ${r.drift.oos.monthNetT.toFixed(2)})`));
  assert.ok(T1.oos.medianStop >= 10 && T1.is.medianStop >= 10);
  for (const t of r.tests) assert.ok(t.trades.every((x) => x.stop$ > 0));
  assert.equal(r.preregCommit, 'beb8ab81a');
});
