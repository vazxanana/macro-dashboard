// vb-close-confirm: the study's figures and its entry rule (offline, no candles).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { confirmAt, walkFrom, diffStats } from '../research/edge/vb-close-confirm/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-close-confirm/result.json', import.meta.url), 'utf8'));
const md = fs.readFileSync(new URL('../research/edge/vb-close-confirm/RESULT.md', import.meta.url), 'utf8');

test('result: gate held, FAIL 0 of 4, verdict line first in RESULT.md', () => {
  assert.equal(R.gate.ok, true);
  assert.equal(R.pass, false);
  assert.equal(R.tests.length, 4);
  assert.equal(R.tests.filter((t) => t.improves).length, 0);
  assert.ok(R.verdict.startsWith('FAIL: 0 of 4'));
  assert.ok(md.split('\n')[2].includes(R.verdict));
  assert.equal(R.markets.xau.late.cell.V0.n, 2250);
  assert.equal(R.markets.usdjpy.late.cell.V0.n, 2275);
  for (const t of R.tests) assert.ok(t.dE < 0 && t.dL < 0);
  assert.ok(!/\bedge\b/i.test(R.verdict));
});

const D0 = 1_700_000_000 - (1_700_000_000 % 86400);
const bar = (m, o, h, l, c) => ({ t: D0 + m * 60, o, h, l, c });
function day() { // 5m candles 00:00-20:55; trigger 101 touched at 00:10, first M15 close above it is the 00:15-00:30 bucket
  const b = [];
  for (let m = 0; m < 21 * 60; m += 5) b.push(bar(m, 100, 100.5, 99.5, 100));
  b[2] = bar(10, 100, 101.2, 99.9, 100.8);   // touch, closes back under
  b[5] = bar(25, 100.8, 101.5, 100.6, 101.3); // last candle of 00:15-00:30: close 101.3 > 101
  return b;
}

test('confirmAt: first M15 close beyond the trigger, at that close, from the touch candle on', () => {
  const b = day(), c = confirmAt(b, 2, 1, 101, 900, D0);
  assert.deepEqual(c, { entry: 101.3, last: 5, t: D0 + 1800 });
  assert.equal(confirmAt(b, 2, 1, 101, 3600, D0), null);                // every H1 close is 100, under the trigger: no entry
});

test('no look-ahead: candles after the confirming one never change the entry', () => {
  const a = day(), c1 = confirmAt(a, 2, 1, 101, 900, D0);
  const b = day(); for (let k = 6; k < b.length; k++) b[k] = { ...b[k], o: 50, h: 300, l: 10, c: 200 };
  assert.deepEqual(confirmAt(b, 2, 1, 101, 900, D0), c1);
});

test('a candle ending at 21:00 UTC is no entry; the walk exits on the stop', () => {
  const b = []; for (let m = 0; m < 21 * 60; m += 5) b.push(bar(m, 100, 100.5, 99.5, 100));
  b[b.length - 1] = bar(20 * 60 + 55, 100, 102, 100, 102);
  assert.equal(confirmAt(b, 0, 1, 101, 900, D0), null);
  const w = walkFrom([bar(0, 101, 101.5, 99, 100)], 0, 1, 99.5);
  assert.deepEqual(w, { exit: 99.5, how: 'stop', t: D0 });
});

test('diffStats: a day without a confirming close counts 0R', () => {
  const rows = [{ day: '2020-01-02', m: { V0: { net: 1, R: 1 }, V1: null } }, { day: '2020-02-03', m: { V0: { net: -1, R: -1 }, V1: { net: 0.5, R: 0.5 } } }];
  const s = diffStats(rows, 'V1');
  assert.equal(s.meanD, 0.25); assert.equal(s.filled, 1);
});
