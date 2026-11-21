// desk-exits: the exit rules of the pre-registration on hand-made candles, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exitR, firstAt, compare, CAP_S } from '../research/edge/desk-exits/run.mjs';

const T0 = 1_780_000_200;
const bar = (i, o, h, l, c) => ({ time: T0 + i * 300, open: o, high: h, low: l, close: c });
const buy = { side: 1, t: T0 + 60, entry: 100, stop: 99 };

test('fixed targets: 1R, 2R, 3R, stop first in one candle, the fill candle only stops', () => {
  const bars = [bar(0, 100, 105, 99.5, 100), bar(1, 100, 101.2, 99.6, 101), bar(2, 101, 102.1, 100.5, 102), bar(3, 102, 103.5, 101.5, 103)];
  assert.deepEqual(exitR(buy, bars, 'X1'), { R: 1, how: 'target', end: bars[1].time }, 'the fill candle\'s high of 105 is not a target');
  assert.equal(exitR(buy, bars, 'X2').R, 2); assert.equal(exitR(buy, bars, 'X3').R, 3);
  const both = [bar(0, 100, 100.2, 99.8, 100), bar(1, 100, 101.5, 98.5, 100)];
  assert.deepEqual(exitR(buy, both, 'X1'), { R: -1, how: 'stop', end: both[1].time }, 'stop and target in one candle: the stop');
  const gap = [bar(0, 100, 100.2, 99.8, 100), bar(1, 98.5, 99, 98, 98.6)];
  assert.equal(exitR(buy, gap, 'X1').R, -1.5, 'a candle that opens beyond the stop exits at its open');
  const fillStop = [bar(0, 100, 100.2, 98.9, 99.5)];
  assert.equal(exitR(buy, fillStop, 'X3').R, -1, 'the fill candle can stop the trade');
});

test('trailing stop: 1R behind the best price from +1R, never back; a sell mirrors it', () => {
  const bars = [bar(0, 100, 100.1, 99.9, 100), bar(1, 100, 101, 99.8, 100.9), bar(2, 100.9, 103, 100.5, 102.8), bar(3, 102.8, 102.9, 101.9, 102)];
  assert.deepEqual(exitR(buy, bars, 'XT'), { R: 2, how: 'trail', end: bars[3].time }, 'best 103, stop 102');
  const be = [bar(0, 100, 100.1, 99.9, 100), bar(1, 100, 101, 99.8, 100.9), bar(2, 100.9, 100.95, 99.95, 100)];
  assert.equal(exitR(buy, be, 'XT').R, 0, 'from +1R the stop sits at the entry');
  const sell = { side: -1, t: T0 + 60, entry: 100, stop: 101 };
  const sb = [bar(0, 100, 100.1, 99.9, 100), bar(1, 100, 100.2, 98, 98.2), bar(2, 98.2, 99.1, 98.1, 99)];
  assert.deepEqual(exitR(sell, sb, 'XT'), { R: 1, how: 'trail', end: sb[2].time });
});

test('a trade still running after 5 days exits at that close; candles that end leave it out', () => {
  const n = CAP_S / 300 + 3, bars = Array.from({ length: n }, (_, i) => bar(i, 100, 100.4, 99.6, 100.2));
  assert.deepEqual(exitR(buy, bars, 'X3').how, 'time');
  assert.equal(exitR(buy, bars.slice(0, 10), 'X3'), null);
  assert.equal(firstAt(bars, T0 - 10), -1);
  assert.equal(firstAt(bars, T0 + 299), 0);
});

test('compare: Holm over every comparison and the pre-registered bar', () => {
  const rows = [];
  for (let m = 0; m < 12; m++) for (let k = 0; k < 20; k++) rows.push({ kind: 'eg-1h', t: Date.UTC(2026, m, 2 + k) / 1000, booked: -0.2 + (k % 3) * 0.01, costR: 0.05,
    ex: { X1: { R: 0.5 + (k % 4) * 0.01, how: 'target' }, X2: { R: -0.2, how: 'stop' }, X3: { R: -0.2 + (k % 3) * 0.01, how: 'stop' }, XT: { R: -0.6 + (k % 5) * 0.02, how: 'trail' } } });
  const { groups, tests } = compare(rows);
  assert.equal(tests.length, 4);
  assert.equal(groups['eg-1h'].exits.X1.vsBooked.verdict, 'better');
  assert.equal(groups['eg-1h'].exits.XT.vsBooked.verdict, 'worse');
  assert.equal(groups['eg-1h'].exits.X2.vsBooked.verdict, 'no better');
});

test('the report says what result.json says', () => {
  const url = new URL('../research/edge/desk-exits/result.json', import.meta.url);
  if (!fs.existsSync(url)) return;
  const r = JSON.parse(fs.readFileSync(url, 'utf8')), md = fs.readFileSync(new URL('../research/edge/desk-exits/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\.\\*\\*`));
  assert.equal(r.tests.length, Object.keys(r.groups).length * 4);
  for (const t of r.tests) assert.ok(['better', 'worse', 'no better'].includes(t.verdict));
});
