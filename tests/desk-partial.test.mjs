// desk-partial: half at +1R, the rest trailed (PT) or sent to 3R (P3), on hand-made candles; the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { partialR } from '../research/edge/desk-partial/run.mjs';

const T0 = 1_780_000_200;
const bar = (i, o, h, l, c) => ({ time: T0 + i * 300, open: o, high: h, low: l, close: c });
const buy = { side: 1, t: T0 + 60, entry: 100, stop: 99 };

test('before +1R the whole position has the opening stop; a candle with both +1R and the stop is a full loss', () => {
  const lose = [bar(0, 100, 100.2, 99.8, 100), bar(1, 100, 100.5, 98.9, 99)];
  assert.equal(partialR(buy, lose, 'PT').R, -1);
  const both = [bar(0, 100, 100.2, 99.8, 100), bar(1, 100, 101.2, 98.9, 100)];
  assert.equal(partialR(buy, both, 'P3').R, -1, 'the stop is taken before a target in one candle');
  const fill = [bar(0, 100, 102, 99.9, 101.5), bar(1, 101.5, 101.6, 98.9, 99)];
  assert.equal(partialR(buy, fill, 'PT').R, -1, 'the fill candle\'s high is not +1R');
});

test('half at +1R, then the rest at the entry: +0.5R; the rest to 3R: +2R', () => {
  const be = [bar(0, 100, 100.2, 99.8, 100), bar(1, 100, 101.1, 99.9, 101), bar(2, 101, 101.05, 99.9, 100)];
  assert.deepEqual(partialR(buy, be, 'P3'), { R: 0.5, how: 'rest stopped', end: be[2].time });
  assert.ok(Math.abs(partialR(buy, be, 'PT').R - 0.55) < 1e-9, 'PT: best 101.1, the rest trailed to 100.1: +0.1R on that half');
  const run = [bar(0, 100, 100.2, 99.8, 100), bar(1, 100, 101.1, 99.9, 101), bar(2, 101, 103.2, 100.9, 103)];
  assert.deepEqual(partialR(buy, run, 'P3'), { R: 2, how: 'target', end: run[2].time });
});

test('half then trail: the rest trails 1R behind the best price; a sell mirrors it', () => {
  const bars = [bar(0, 100, 100.2, 99.8, 100), bar(1, 100, 101.1, 99.9, 101), bar(2, 101, 104, 100.9, 103.8), bar(3, 103.8, 103.9, 102.8, 103)];
  assert.equal(partialR(buy, bars, 'PT').R, 0.5 + 0.5 * 3, 'best 104, the rest stopped at 103: +3R on that half');
  const sell = { side: -1, t: T0 + 60, entry: 100, stop: 101 };
  const sb = [bar(0, 100, 100.2, 99.8, 100), bar(1, 100, 100.1, 97.5, 97.8), bar(2, 97.8, 98.6, 97.7, 98.4)];
  assert.equal(partialR(sell, sb, 'PT').R, 0.5 + 0.5 * 1.5, 'best 97.5, the rest stopped at 98.5: +1.5R on that half');
});

test('the report says what result.json says', () => {
  const url = new URL('../research/edge/desk-partial/result.json', import.meta.url);
  if (!fs.existsSync(url)) return;
  const r = JSON.parse(fs.readFileSync(url, 'utf8')), md = fs.readFileSync(new URL('../research/edge/desk-partial/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\.\\*\\*`));
  assert.equal(r.verdict, r.stageB.tests.some((t) => t.verdict === 'PASS') ? 'PASS' : 'FAIL');
  for (const t of r.stageB.tests) assert.equal(t.verdict === 'PASS', t.better && t.profitable);
});
