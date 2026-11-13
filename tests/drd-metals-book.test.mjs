// The weekly-bull daily rejection long as one book on gold and silver: one-at-a-time selection, monthly sums, the exit walk,
// and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { oneAtATime, monthly, monthsOf, exitOf, ddClosed, pOf, COSTS, WIN } from '../research/edge/drd-metals-book/run.mjs';

const H = 3600, T0 = Date.UTC(2010, 0, 4) / 1000;
const tr = (m, entryH, closeH, net = 1) => ({ m, entryT: T0 + entryH * H, closeT: T0 + closeH * H, net });

test('pre-registered numbers: costs and windows', () => {
  assert.deepEqual(COSTS, { xau: 0.35, xag: 0.03 });
  assert.deepEqual(WIN.A, ['2006-01-01', '2022-10-31']); assert.equal(monthsOf(...WIN.A1).length, 101); assert.equal(monthsOf(...WIN.A2).length, 101);
});

test('one position at a time: an overlapping signal is skipped, gold wins a tie, a close at the entry time frees the book', () => {
  const C = [tr('xag', 0, 10), tr('xau', 0, 30), tr('xag', 5, 8), tr('xau', 30, 40), tr('xag', 39, 50), tr('xag', 41, 45)];
  const B = oneAtATime(C);
  assert.deepEqual(B.map((x) => [x.m, (x.entryT - T0) / H]), [['xau', 0], ['xau', 30], ['xag', 41]]);
  // order of the input does not matter
  assert.deepEqual(oneAtATime([...C].reverse()), B);
  // no two taken trades overlap
  for (let i = 1; i < B.length; i++) assert.ok(B[i].entryT >= B[i - 1].closeT);
});

test('monthly sums count empty months as zero and give the plain t', () => {
  const T = [{ entryT: Date.UTC(2010, 0, 5) / 1000, net: 2 }, { entryT: Date.UTC(2010, 0, 20) / 1000, net: 1 }, { entryT: Date.UTC(2010, 2, 3) / 1000, net: -1 }];
  const r = monthly(T, '2010-01-01', '2010-04-30');
  assert.equal(r.months, 4); assert.equal(r.active, 2);
  const v = [3, 0, -1, 0], a = 0.5, sd = Math.sqrt(v.reduce((p, q) => p + (q - a) ** 2, 0) / 3);
  assert.equal(r.t, +(a / (sd / 2)).toFixed(2));
  assert.ok(Math.abs(pOf(1.6449) - 0.05) < 1e-4);
});

test('the exit walk takes the stop first in a candle that holds both, and the drawdown follows the close order', () => {
  const day = Date.UTC(2010, 0, 5, 12) / 1000;
  const h1 = [{ time: day, open: 100, high: 101, low: 99.5, close: 100.5 }, { time: day + H, open: 100.5, high: 110, low: 98, close: 105 }];
  const x = exitOf(h1, 0, 1e9, 99, 106);
  assert.equal(x.k, 1); assert.equal(x.exit, 99);
  assert.equal(ddClosed([{ closeT: 3, net: -2 }, { closeT: 1, net: 1 }, { closeT: 2, net: -1 }]), -3);
});

test('the report says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/drd-metals-book/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/drd-metals-book/RESULT.md', import.meta.url), 'utf8');
  const pass = Object.values(r.tests).filter((x) => x.pass).length;
  assert.equal(r.verdict, pass ? 'PASS' : 'FAIL');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}, ${pass} of 3\\.\\*\\*`));
  for (const k of ['T1', 'T2', 'T3']) {
    const s = r.streams[k], a = s.A, sg = (v) => (v >= 0 ? '+' : '') + v;
    const row = `| ${a.n} | ${sg(a.avg.toFixed(3))} | ${a.pf.toFixed(2)} | ${a.dd}R | ${s.monthlyA.t.toFixed(2)} | ${r.tests[k].pHolm.toFixed(4)} | ${s.A1.pf.toFixed(2)} | ${s.A2.pf.toFixed(2)} | ${sg(s.B.total)}R (n ${s.B.n}) | ${r.tests[k].pass ? 'yes' : 'no'} |`;
    assert.ok(md.includes(row), `${k}: ${row}`);
  }
  assert.ok(/nothing live changed/i.test(md));
});
