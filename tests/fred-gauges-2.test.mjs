import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readings, TESTS, LAG } from '../research/edge/fred-gauges-2/run.mjs';
import { flags, flagFor, judge, TESTS as VT } from '../research/edge/vb-fred-regime/run.mjs';
import { trendFor, withTrend } from '../research/edge/vb-rate-side/run.mjs';

const DAY = 86400, T0 = Date.parse('2006-06-02T00:00:00Z') / 1000, iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const ser = (n, step, f) => Array.from({ length: n }, (_, i) => ({ t: T0 + i * step * DAY, d: iso(T0 + i * step * DAY), v: f(i) }));

test('fred-gauges-2: signals follow their definitions and never read later values', () => {
  const F = { USEPUINDXD: ser(2800, 1, (i) => 100 + (i % 400 > 380 ? 300 : 0)), T10YIE: ser(2800, 1, (i) => 2 + i * 0.01), STLFSI4: ser(400, 7, (i) => (i > 200 ? i * 0.01 : -1)), T10Y3M: ser(2800, 1, (i) => (i < 900 ? -0.5 : -0.5 + (i - 900) * 0.01)) };
  const end = T0 + 2700 * DAY, R = readings(F, end);
  assert.ok(R.filter((r) => r.B != null).every((r) => r.B === true));
  assert.ok(R.some((r) => r.U === true) && R.some((r) => r.U === false));
  assert.ok(R.some((r) => r.S === true) && R.some((r) => r.S === false));
  assert.ok(R.some((r) => r.Y === true) && R.some((r) => r.Y === false));
  const cut = T0 + 1400 * DAY, F2 = Object.fromEntries(Object.entries(F).map(([k, S]) => [k, S.map((o) => (o.t > cut ? { ...o, v: o.v * 7 - 3 } : o))]));
  const pick = (X) => X.filter((r) => r.t <= cut).map((r) => [r.U, r.B, r.S, r.Y]);
  assert.deepEqual(pick(readings(F2, end)), pick(R));
  assert.equal(TESTS.length, 5); assert.equal(Object.keys(LAG).length, 4);
});

test('vb-fred-regime: a trading day reads only values dated before it', () => {
  const S = ser(400, 1, (i) => (i % 2 ? 10 : 20)), fl = flags(S, 'aboveMean20');
  assert.equal(fl[19], null);
  assert.equal(fl[21], false); assert.equal(fl[22], true);
  assert.equal(flagFor(S, fl, S[22].d), fl[21]);
  assert.equal(flagFor(S, fl, S[0].d), null);
  const up = ser(400, 1, (i) => i * i), f2 = flags(up, 'absChg5AboveMedian252');
  assert.equal(f2[256], null); assert.equal(f2[300], true);
  assert.equal(flags(up, 'mean5AboveMedian252')[300], true);
  assert.equal(VT.length, 5);
});

test('vb-fred-regime: judge splits on and off by window', () => {
  const rows = []; for (let m = 1; m <= 12; m++) for (let d = 1; d <= 20; d++) for (const y of [2012, 2018]) rows.push({ day: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, on: d % 2 === 0, R: 1, net: d % 2 === 0 ? 0.5 + (d % 4) * 0.01 : 0.1 + (d % 3) * 0.01 });
  const j = judge(rows, {});
  assert.equal(j.conf.on.n, 120); assert.equal(j.disc.off.n, 120);
  assert.ok(j.conf.diff > 0.3 && j.conf.welch > 2 && j.conf.monthT > 2);
});

test('both reports are their result files, and both are FAIL', () => {
  for (const k of ['fred-gauges-2', 'vb-fred-regime']) {
    const j = JSON.parse(fs.readFileSync(new URL(`../research/edge/${k}/result.json`, import.meta.url), 'utf8')), md = fs.readFileSync(new URL(`../research/edge/${k}/RESULT.md`, import.meta.url), 'utf8');
    assert.ok(md.includes(j.verdict), k);
    assert.equal(j.tests.length, 5);
    assert.match(j.verdict, /^FAIL, 0 of 5/);
    assert.equal(j.tests.filter((t) => t.pass).length, 0);
  }
  const g = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-fred-regime/result.json', import.meta.url), 'utf8')).gate;
  assert.ok(g.xau.ok && g.usdjpy.ok);
});

test('vb-rate-side: the trend reads values before the day, and WITH is the side the rate supports', () => {
  const S = ser(60, 1, (i) => i);
  assert.equal(trendFor(S, S[20].d), null);
  assert.equal(trendFor(S, S[30].d), 20);
  assert.equal(withTrend(1, 0.2, 1), true); assert.equal(withTrend(-1, 0.2, 1), false);
  assert.equal(withTrend(1, 0.2, -1), false); assert.equal(withTrend(-1, 0.2, -1), true);
  assert.equal(withTrend(1, 0, 1), null);
  const j = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-rate-side/result.json', import.meta.url), 'utf8')), md = fs.readFileSync(new URL('../research/edge/vb-rate-side/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(j.verdict)); assert.match(j.verdict, /^FAIL, 0 of 2/); assert.ok(j.gate.xau.ok && j.gate.usdjpy.ok);
});
