// research/edge/mosha-barrier-6r: the desk's barrier entries at 1R / 3R / 6R on gold 2010-2019 (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { group, keyOf, monthT, holm, judge, placebo, stats, COST } from '../research/edge/mosha-barrier-6r/run.mjs';

const DIR = new URL('../research/edge/mosha-barrier-6r/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, DIR), 'utf8');

test('mosha-barrier-6r: the pre-registration names the three tests, the halves, Holm and the placebo', () => {
  const p = read('PREREGISTRATION.md');
  for (const w of ['T1', 'T2', 'T3', '2010-2014', '2015-2019', 'Holm', 'side flipped', 'BEFORE costs', 'month-sum t']) assert.ok(p.includes(w), w);
});

test('mosha-barrier-6r: buckets drop a forming last one; keys and statistics', () => {
  const M5 = Array.from({ length: 30 }, (_, i) => ({ time: 3600 * 10 + i * 300, open: i, high: i + 1, low: i - 1, close: i + 0.5 }));
  const H1 = group(M5, 3600);
  assert.equal(H1.length, 2);   // 30 candles = 2.5 hours: the half hour is dropped
  assert.deepEqual([H1[0].open, H1[0].high, H1[0].low, H1[0].close], [0, 12, -1, 11.5]);
  assert.equal(keyOf({ side: 1, t: 5, entry: 1.5, stop: 1 }), keyOf({ side: 1, t: 5, entry: 1.5000000000001, stop: 1 }));
  const rows = [{ t: 0, R: 1 }, { t: 40 * 86400, R: 2 }, { t: 80 * 86400, R: 3 }];
  assert.equal(monthT(rows, 'R').months, 3);
  assert.equal(stats(rows).mean, 2);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('mosha-barrier-6r: the placebo flips the side and mirrors stop and target', () => {
  const bars = [{ time: 0, open: 100, high: 100.5, low: 99.5, close: 100 }, { time: 60, open: 100, high: 100.4, low: 93.5, close: 94 }];
  const r = { side: 1, entry: 100, stop: 99, target: 106, t: 0, mkt: true };
  const p = placebo(r, { '1m': bars, '5m': [] });
  assert.equal(p.status, 'target');    // a sell from 100, stop 101, target 94
  assert.equal(p.R, 6);
});

test('mosha-barrier-6r: judge pairs 6R with 1R by entry and applies the halves', () => {
  const rows = [];
  for (let y = 2010; y < 2020; y++) for (let m = 0; m < 12; m++) for (let k = 0; k < 3; k++) {
    const t = Date.UTC(y, m, 3 + k) / 1000, key = 's' + t;
    rows.push({ rr: 6, key, t, r0: 3, R: k === 0 ? 6 : -1, Rp: -1, withDir: true, h: '1h' });
    rows.push({ rr: 1, key, t, r0: 3, R: k === 2 ? -1 : 1, Rp: -1 });
    rows.push({ rr: 3, key, t, r0: 3, R: k === 0 ? 3 : -1, Rp: 1 });
  }
  const J = judge(rows);
  assert.equal(J.pairs.length, 360);
  assert.equal(J.tests.T1.gross.all.mean, +(4 / 3).toFixed(4));
  assert.equal(J.tests.T1.net.all.mean, +(4 / 3 - COST / 3).toFixed(4));
  assert.ok(J.tests.T3.placeboFlag);   // its placebo beats it
});

test('mosha-barrier-6r: RESULT.md line 3 matches result.json', () => {
  const R = JSON.parse(read('result.json')), line = read('RESULT.md').split('\n')[2];
  assert.equal(line, `**Verdict: ${R.verdict}. ${R.headline}.**`);
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  for (const id of ['T1', 'T2', 'T3']) { assert.ok(R.tests[id]); assert.equal(typeof R.tests[id].holm, 'number'); }
  assert.equal(R.cost, 0.3);
});
