import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lastKnown, readings, outcome, tests as run, TESTS, LAG } from '../research/edge/fred-gauges/run.mjs';

const DAY = 86400, T0 = Date.parse('2006-06-02T00:00:00Z') / 1000;
const ser = (n, step, f) => Array.from({ length: n }, (_, i) => ({ t: T0 + i * step * DAY, d: '', v: f(i) }));

test('fred-gauges: a value is used only once its publication lag has passed', () => {
  const S = [{ t: 100 * DAY, v: 1 }, { t: 107 * DAY, v: 2 }];
  assert.equal(lastKnown(S, 112 * DAY, 6), 0);
  assert.equal(lastKnown(S, 113 * DAY, 6), 1);
  assert.equal(lastKnown(S, 105 * DAY, 6), -1);
});

test('fred-gauges: signals follow the pre-registered definitions and never read later values', () => {
  const F = { WALCL: ser(400, 7, (i) => 1e6 + i * 1000), WDTGAL: ser(400, 7, () => 1e5), RRPONTSYD: [], NFCI: ser(400, 7, (i) => -i * 0.01), ICSA: ser(400, 7, (i) => (i > 300 ? 300000 : 200000)), DFII10: ser(2800, 1, (i) => 1 + i * 0.02), BAA10Y: ser(2800, 1, (i) => 2 + i * 0.001) };
  const end = T0 + 2700 * DAY, R = readings(F, end), ok = R.filter((r) => r.L != null);
  assert.ok(ok.length > 300);
  assert.ok(ok.every((r) => r.L === true && r.F === false && r.D === true));
  assert.ok(R.some((r) => r.C === true) && R.some((r) => r.C === false));
  const cut = T0 + 1500 * DAY, F2 = Object.fromEntries(Object.entries(F).map(([k, S]) => [k, S.map((o) => (o.t > cut ? { ...o, v: o.v * 9 + 5 } : o))]));
  const R2 = readings(F2, end), pick = (X) => X.filter((r) => r.t <= cut).map((r) => [r.L, r.F, r.C, r.D]);
  assert.deepEqual(pick(R2), pick(R));
  assert.equal(Object.keys(LAG).length, 7);
});

test('fred-gauges: outcome is 20 sessions on, and a pass needs t, Holm and both halves', () => {
  const px = Array.from({ length: 60 }, (_, i) => ({ t: T0 + i * DAY, v: 100 * Math.exp(0.01 * i) }));
  assert.ok(Math.abs(outcome(px, T0 + 3 * DAY) - 0.2) < 1e-6);
  assert.equal(outcome(px, T0 + 45 * DAY), null);
  assert.equal(TESTS.length, 7);
  assert.equal(typeof run, 'function');
});

test('fred-gauges: the report is the result file, and it is a FAIL', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../research/edge/fred-gauges/result.json', import.meta.url), 'utf8')), md = fs.readFileSync(new URL('../research/edge/fred-gauges/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(j.verdict));
  assert.equal(j.tests.length, 7);
  assert.equal(j.tests.filter((t) => t.pass).length, 0);
  assert.match(j.verdict, /^FAIL, 0 of 7/);
  for (const t of j.tests) assert.ok(t.pass === (Math.sign(t.all.t) === t.want && Math.abs(t.all.t) >= 2 && t.holm < 0.05 && Math.sign(t.first.slope) === t.want && Math.sign(t.second.slope) === t.want));
});
