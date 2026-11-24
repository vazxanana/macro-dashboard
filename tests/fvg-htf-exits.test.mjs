// tests/fvg-htf-exits.test.mjs - FVG return on H4 / D1 with 2R / 3R / time exits: pre-registration, the verdict follows the
// bar, RESULT.md agrees with result.json, the gate, the cut test, and the time exit on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { manage } from '../research/edge/dom-trade-through/run.mjs';
import { TESTS, SLOT, EXITS, CAP } from '../research/edge/fvg-htf-exits/run.mjs';

const DIR = new URL('../research/edge/fvg-htf-exits/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the six tests, windows, costs and bar', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['T1 H4 large 2R', 'T6 D1 large time', 'H4 5 days', 'D1 20 days', '2005-01-01', '2014-12-31', '2026-10-31', 'Holm', 'Welch t >= 2', 'ASSUMED', 'AFTER costs'])
    assert.ok(p.includes(w), w);
  assert.equal(TESTS.length, 6);
  assert.deepEqual(CAP, { '4h': 5 * 86400, '1d': 20 * 86400 });
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.tests.length, 6);
  for (const t of R.tests) {
    const ok = t.disc.n >= 200 && t.conf.n >= 200 && t.disc.meanNet > 0 && t.conf.meanNet > 0 && t.conf.tNet >= 2 && t.holm < 0.05 && t.vsControlNet.c >= 2;
    assert.equal(t.pass, ok, t.id);
  }
  assert.ok(R.gate.ok, 'gate');
  assert.deepEqual(R.gate.n, [13897, 16891]);
  assert.equal(R.verdict, R.tests.some((t) => t.pass) ? 'PASS' : 'FAIL');
  assert.equal(R.verdict, 'FAIL');
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
});

test('the cut test found no look-ahead', () => {
  assert.equal(R.cut.length, 10);
  for (const c of R.cut) { assert.equal(c.missing, 0); assert.equal(c.extra, 0); assert.ok(c.n > 0); }
});

test('RESULT.md: verdict line first, every test figure from result.json', () => {
  assert.ok(md.split('\n')[2].startsWith(`**Verdict: ${R.verdict}. ${R.headline}`));
  for (const t of R.tests) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${t.id} `)); assert.ok(row, t.id);
    for (const v of [t.disc.meanNet, t.conf.mean, t.conf.meanNet]) assert.ok(row.includes(f3(v)), `${t.id} ${v}`);
    assert.ok(row.includes(t.conf.tNet.toFixed(2)), t.id);
  }
});

test('time exit: no target, out at the stop or the close of the time limit', () => {
  assert.equal(SLOT[EXITS.indexOf('time')], 8);
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  // a buy at 100, stop 99: runs to +5R without a target, then the time limit (600 s) closes it
  const up = [bar(0, 100, 100.5, 99.8, 100.4), bar(300, 100.4, 105, 100.3, 104.8), bar(600, 104.8, 104.9, 103.9, 104)];
  const r = manage(up, 1, 0, 100, 99, 600, true);
  assert.ok(Math.abs(r.R[8] - 4.8) < 1e-9); // closed at 104.8, the close of the candle that ends the time limit
  assert.equal(r.R[1], 2);                  // the 2R target would have filled
  const dn = [bar(0, 100, 100.2, 99.5, 99.6), bar(300, 99.6, 99.7, 98.5, 98.8), bar(600, 98.8, 99, 98.6, 98.9)];
  assert.equal(manage(dn, 1, 0, 100, 99, 600, true).R[8], -1);
});
