// The desks' readings after the marking audit, and the methods' own conditions (research/edge/desk-rigor). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as R from '../research/edge/desk-rigor/run.mjs';

const rd = (p) => fs.readFileSync(new URL('../research/edge/desk-rigor/' + p, import.meta.url), 'utf8');
const res = JSON.parse(rd('result.json')), md = rd('RESULT.md'), pre = rd('PREREGISTRATION.md'), src = rd('run.mjs');

test('the pre-registration fixes thirteen tests, the windows and the bar, and nothing of 2026 is in a window', () => {
  for (const id of [...Object.keys(R.READINGS), ...Object.keys(R.CONDITIONS)]) assert.ok(pre.includes(`**${id}**`), id);
  assert.equal(Object.keys(R.READINGS).length + Object.keys(R.CONDITIONS).length, 13); assert.match(pre, /Holm over all thirteen tests/);
  assert.equal(new Date(R.IS[0] * 1000).toISOString().slice(0, 10), '2020-01-01'); assert.equal(new Date(R.OOS[1] * 1000).toISOString().slice(0, 10), '2026-01-01');
  assert.match(pre, /Nothing from 1 January 2026 on is in either window/); assert.deepEqual(R.MARKETS, ['xau', 'eurusd', 'gbpusd']);
  assert.ok(Math.abs(R.cost('xau', 4000) - 0.2) < 1e-9); assert.ok(Math.abs(R.cost('eurusd', 1.1) - (0.000045 * 1.1 + 0.00005)) < 1e-12);
});

test('the runner imports the desks\' own code and varies nothing', () => {
  for (const m of ['mosha-desk.mjs', 'edge-desks.mjs', 'eg-methods.mjs', 'assets/mosha-sop.js']) assert.ok(src.includes(m), m);
  assert.match(src, /SOP\.sopTrades\(B, F, \{ from, market: mk \}\)/); assert.match(src, /SOP\.barrierTrades\(B, F, \{ from, market: mk \}\)/);
  assert.match(src, /methodTrades\(B, \{ from, market: mk \}\)/); assert.match(src, /against: true/);
});

test('statistics: month sums, the monthly difference and the one-sided p', () => {
  const t = (s) => Date.parse(s) / 1000, rows = [{ t: t('2024-01-05'), net: 1 }, { t: t('2024-01-20'), net: 1 }, { t: t('2024-02-03'), net: -1 }, { t: t('2024-03-03'), net: 3 }];
  const s = R.stats(rows); assert.deepEqual([s.n, s.total, s.months, s.mean], [4, 4, 3, 1]); assert.ok(Math.abs(s.tMonth - (4 / 3) / Math.sqrt((((2 - 4 / 3) ** 2 + (-1 - 4 / 3) ** 2 + (3 - 4 / 3) ** 2) / 2) / 3)) < 0.01);
  const d = R.monthDiff([{ t: t('2024-01-05'), net: 2 }, { t: t('2024-02-05'), net: 1 }, { t: t('2024-04-05'), net: 9 }], [{ t: t('2024-01-06'), net: 1 }, { t: t('2024-02-06'), net: -2 }, { t: t('2024-03-06'), net: 5 }]);
  assert.deepEqual([d.months, d.diff], [2, 2], 'only months where both sides traded');
  assert.ok(Math.abs(R.pOne(1.96) - 0.025) < 0.001); assert.ok(R.pOne(-1) > 0.8); assert.equal(R.pOne(null), 1);
});

test('the result: every test has its checks and verdict, Holm runs over all thirteen, and the report says what the json says', () => {
  const ids = Object.keys(res.tests); assert.equal(ids.length, 13);
  for (const id of ids) { const t = res.tests[id]; assert.ok(/^(PASS|FAIL)/.test(t.verdict), id); assert.ok(t.holm >= t.p - 1e-9 && t.holm <= 1);
    if (t.verdict === 'PASS') assert.ok(Object.values(t.checks).every(Boolean)); else assert.ok(!Object.values(t.checks).every(Boolean));
    if (t.kind === 'reading') { assert.ok(md.includes(`| ${id} | ${t.what} | ${t.is.net.n} |`), 'row ' + id); if (t.oos.net.n) assert.ok(t.oos.net.mean <= t.oos.gross.mean, 'costs only take'); }
    else assert.ok(md.includes(`| ${id} | ${t.what} | ${t.oos.preferred.n} |`), 'row ' + id); }
  const passed = ids.filter((id) => res.tests[id].verdict === 'PASS');
  assert.equal(res.verdict, passed.length ? `${passed.length} of 13 pass (${passed.join(', ')})` : 'FAIL (0 of 13)'); assert.ok(md.includes(`**Verdict: ${res.verdict}.**`));
  assert.match(res.system, /net of costs/);
});
