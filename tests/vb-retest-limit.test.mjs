// vb-retest-limit: the retest-limit entry on hand-made candles, and RESULT.md pinned to result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { retestTrade, walk, judge } from '../research/edge/vb-retest-limit/run.mjs';

const DIR = new URL('../research/edge/vb-retest-limit/', import.meta.url);
const bar = (t, o, h, l, c) => ({ t, o, h, l, c });
// open 100, prevRange 10: up 105, dn 95; V0 a buy filled in candle 1
const v0 = { side: 1, open: 100, up: 105, dn: 95, fillT: 300 };

test('V1 fills only on a later touch, at the level, stop at the open', () => {
  const bars = [bar(0, 100, 101, 99, 100), bar(300, 100, 106, 100.5, 106), bar(600, 106, 107, 104.8, 106), bar(900, 106, 110, 106, 109)];
  const x = retestTrade(bars, v0, 10, 'V1');
  assert.equal(x.entry, 105); assert.equal(x.stop, 100); assert.equal(x.fillT, 600);
  assert.ok(x.entry > x.stop); assert.equal(x.how, 'time'); assert.equal(x.R, (109 - 105) / 5);
});
test('the touch candle itself never fills the limit; no retest = no trade', () => {
  const bars = [bar(0, 100, 101, 99, 100), bar(300, 100, 106, 104, 106), bar(600, 106, 108, 105.5, 107)];
  assert.equal(retestTrade(bars, v0, 10, 'V1').nofill, true);
});
test('V2 rests 0.1 x prevRange deeper; a gap below the limit fills at the open', () => {
  const bars = [bar(0, 100, 101, 99, 100), bar(300, 100, 106, 104, 106), bar(600, 103, 104, 102, 103.5)];
  const x = retestTrade(bars, v0, 10, 'V2');
  assert.equal(x.entry, 103); assert.equal(x.r, 3);
});
test('a candle opening at or beyond the stop cancels the order; a fill candle reaching the stop is stopped there', () => {
  assert.equal(retestTrade([bar(0, 100, 101, 99, 100), bar(300, 100, 106, 104, 106), bar(600, 99, 100, 98, 99)], v0, 10, 'V1').cancel, 'gap');
  const x = retestTrade([bar(0, 100, 101, 99, 100), bar(300, 100, 106, 104, 106), bar(600, 106, 106, 99, 99.5)], v0, 10, 'V1');
  assert.equal(x.how, 'stop'); assert.equal(x.R, -1);
});
test('sells mirror buys', () => {
  const s0 = { side: -1, open: 100, up: 105, dn: 95, fillT: 300 };
  const x = retestTrade([bar(0, 100, 101, 99, 100), bar(300, 100, 100, 94, 94), bar(600, 94, 95.2, 93, 93), bar(900, 93, 93, 90, 91)], s0, 10, 'V1');
  assert.equal(x.entry, 95); assert.ok(x.stop > x.entry); assert.equal(x.R, (95 - 91) / 5);
  assert.equal(walk([bar(0, 96, 101, 95, 99)], 0, -1, 100).how, 'stop');
});
test('judge: Holm over four, both halves required', () => {
  const rows = []; for (let y = 2010; y <= 2019; y++) for (let m = 1; m <= 12; m++) for (let k = 0; k < 6; k++) {
    const day = `${y}-${String(m).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
    rows.push({ day, V0: { R: 0, net: 0 }, V1: { R: k % 2 ? 0.3 : 0.1, net: 0 }, V2: { R: k % 2 ? 0.1 : -0.1, net: 0 } });
  }
  const j = judge({ xau: rows, usdjpy: rows });
  assert.equal(j.tests.length, 4); assert.equal(j.verdict, 'PASS');
  assert.ok(j.tests.filter((x) => x.variant === 'V1').every((x) => x.pass));
});
test('RESULT.md is pinned to result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.equal(md.split('\n')[2], `**Verdict: ${R.headline}.**`);
  assert.ok(R.headline.startsWith(R.verdict + '.'));
  assert.equal(R.judged.verdict, R.verdict);
  for (const x of R.judged.tests) assert.ok(md.includes(`| ${x.test} ${x.variant} | ${x.market} | ${x.n} |`));
  assert.ok(Object.values(R.gate).every((g) => g.ok));
});
