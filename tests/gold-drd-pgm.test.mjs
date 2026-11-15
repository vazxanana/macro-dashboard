// node --test tests/gold-drd-pgm.test.mjs: the gold playbook's daily rejection long and its two cuts on platinum and palladium
// (research/edge/gold-drd-pgm, pre-registered 15 Nov 2026). Offline: checks the runner's pieces and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARKETS, BUF, monthT, pOf } from '../research/edge/gold-drd-pgm/run.mjs';

const dir = new URL('../research/edge/gold-drd-pgm/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const report = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const prereg = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');

test('costs and buffer are the pre-registered ones', () => {
  assert.equal(MARKETS.xpt.cost, 0.003); assert.equal(MARKETS.xpd.cost, 0.002); assert.equal(BUF, 0.0001);
  assert.match(prereg, /platinum 0\.30 % of the entry price/); assert.match(prereg, /palladium 0\.20 %/); assert.match(prereg, /0\.01 % of the signal day's low/);
});

test('month-sum t counts each calendar month once and leaves empty months out', () => {
  const day = (s) => Date.parse(s) / 864e5;
  const T = [{ d: day('2020-01-03'), net: 1 }, { d: day('2020-01-20'), net: 1 }, { d: day('2020-03-05'), net: 1 }, { d: day('2020-04-05'), net: 3 }];
  const m = monthT(T); assert.equal(m.months, 3);   // Jan sums to 2, Mar 1, Apr 3: mean 2, sd 1, t = 2 / (1 / sqrt 3)
  assert.equal(m.t, +(2 / (1 / Math.sqrt(3))).toFixed(2));
  assert.ok(Math.abs(pOf(1.645) - 0.05) < 0.001);
});

test('the verdict and every test follow the pre-registered bar', () => {
  assert.equal(res.verdict, 'FAIL');
  assert.deepEqual(Object.keys(res.tests), ['T2-xpt', 'T3-xpt', 'T2-xpd', 'T3-xpd']);
  for (const [key, t] of Object.entries(res.tests)) {
    const [k, sym] = key.split('-'), r = res.markets[sym].rows[k];
    const want = r.all.avg > 0 && t.pHolm < 0.05 && r.a.pf > 1 && r.b.pf > 1 && r.cost2.avg > 0 && r.exBest.avg > 0;
    assert.equal(t.pass, want, key); assert.equal(t.monthT, r.monthly.t, key);
  }
});

test('the report quotes result.json', () => {
  for (const [key, t] of Object.entries(res.tests)) {
    const [k, sym] = key.split('-'), r = res.markets[sym].rows[k];
    const sg = (v, d) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(d);
    const row = report.split('\n').find((l) => l.startsWith('| ' + key)); assert.ok(row, key);
    for (const want of [String(r.all.n), sg(r.all.avg, 3), r.all.pf.toFixed(2), `${sg(r.monthly.t, 2)} (${r.monthly.months})`, t.pHolm.toFixed(2), `${r.a.pf.toFixed(2)} / ${r.b.pf.toFixed(2)}`, sg(r.cost2.avg, 3), `${sg(r.exBest.avg, 3)} (${r.exBest.year})`]) assert.ok(row.includes(want), `${key}: ${want} in "${row}"`);
  }
  const x = res.markets.xpd.rows.T1;
  assert.ok(report.includes(`+${x.all.avg.toFixed(3)}R, PF ${x.all.pf.toFixed(2)}, month-sum t +${x.monthly.t.toFixed(2)}`));
  assert.match(report, /Verdict: FAIL, 0 of 4/);
});
