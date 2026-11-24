// equinox-cost-ratio: the four other Equinox fade / gap rules split by cost against risk (offline: reads the committed files)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rows, stat, keep, passOf, pOne, KEEP, RULES } from '../research/edge/equinox-cost-ratio/run.mjs';

const D = 'research/edge/equinox-cost-ratio/', J = JSON.parse(fs.readFileSync(D + 'result.json', 'utf8')), MD = fs.readFileSync(D + 'RESULT.md', 'utf8'), PRE = fs.readFileSync(D + 'PREREGISTRATION.md', 'utf8');
const T = (y, m = 0) => Date.UTC(y, m, 5) / 1000;

test('the pre-registration: four rules, one threshold, the tracker\'s own adapters', () => {
  assert.equal(KEEP, 0.10); assert.deepEqual(RULES.map((r) => r[0]), ['fade', 'roundfade', 'boxfade', 'fvg']);
  for (const w of ['fadeTrades', 'roundTrades', 'boxTrades', 'fvgTrades', 'at most **10 %**', 'Holm over the four rules', 'at least 300 kept trades']) assert.ok(PRE.includes(w), w);
});
test('rows, stat and the pass bar on hand-made records', () => {
  const recs = [{ t: T(2010), entry: 1.1, stop: 1.099, R: 2, status: 'target' }, { t: T(2020), entry: 1.1, stop: 1.0999, R: -1, status: 'stopped' }, { t: T(2020, 1), entry: 1.1, stop: 1.09, R: null, status: 'open' }, { t: T(2003), entry: 1.1, stop: 1.09, R: 1, status: 'target' }];
  const R = rows(recs, 'eurusd'); assert.equal(R.length, 2, 'open and out-of-window records are left out');
  assert.ok(Math.abs(R[0][2] - 0.06) < 1e-9 && R[0][1] === 0 && R[1][1] === 1 && R[1][2] > 0.5);
  assert.equal(keep(R, 0.1).length, 1); assert.equal(stat(keep(R, 0.1), 0).net, 1.94); assert.equal(stat(keep(R, 0.1), 0, 2).net, 1.88);
  const ok = { n: 300, net: 0.1, tNet: 2 }; assert.equal(passOf(ok, ok, ok, 0.04), true); assert.equal(passOf(ok, ok, ok, 0.06), false); assert.equal(passOf(ok, { ...ok, net: -0.01 }, ok, 0.01), false);
  assert.ok(pOne(3, 100) < 0.01 && pOne(-3, 100) > 0.99);
});
test('the result: 0 of 4 pass, and the report says what the file says', () => {
  assert.match(J.verdict, /^FAIL\. 0 of 4/); assert.equal(J.rules.length, 4);
  for (const x of J.rules) { assert.equal(x.pass, false); assert.equal(passOf(x.kept.d, x.kept.c, x.kept.c2x, x.holm), false); assert.ok(x.kept.c.net <= 0, x.name); assert.ok(x.kept.c.net > x.all.c.net, 'the kept trades lose less than all'); assert.ok(MD.includes(String(x.kept.c.n))); }
  assert.ok(MD.includes(J.verdict));
});
