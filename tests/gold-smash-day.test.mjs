// gold-smash-day: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { smash, enrich, simulate, runRule, runBase, holm, monthT, WIN, RT } from '../research/edge/gold-smash-day/run.mjs';

const dir = new URL('../research/edge/gold-smash-day/', import.meta.url);
const D = 86400, T0 = Date.UTC(2020, 0, 6) / 1000;
// 25 flat days (range 10, ATR 10.x), then the hand-made days
function mk(extra) {
  const base = [];
  for (let k = 0; k < 25; k++) base.push({ open: 100, high: 105, low: 95, close: 100 });
  return enrich([...base, ...extra].map((x, k) => ({ t: T0 + k * D, ...x })));
}

test('setup: a close below the previous low is a long setup, above the previous high a short one', () => {
  const ds = mk([{ open: 100, high: 101, low: 90, close: 92 }, { open: 100, high: 112, low: 99, close: 110 }]);
  assert.equal(smash(ds, 25), 1);
  assert.equal(smash(ds, 26), -1);
  assert.equal(smash(ds, 24), 0);
});

test('long trade: buy-stop above the smash high, stop under its low, out at the third close', () => {
  const ds = mk([{ open: 100, high: 101, low: 90, close: 92 }, { open: 95, high: 103, low: 94, close: 102 },
    { open: 102, high: 104, low: 100, close: 103 }, { open: 103, high: 106, low: 102, close: 105 }]);
  const tr = simulate(ds, 25, 1);
  assert.equal(tr.entry, 101.1);
  assert.equal(+tr.stop.toFixed(2), 89.7);
  assert.equal(tr.how, 'time');
  assert.equal(tr.exit, 105);
  assert.ok(Math.abs(tr.cost - RT / tr.risk) < 1e-12);
  assert.ok(tr.fin > 0 && tr.net < tr.gross);
});

test('no fill when the next day never reaches the trigger; entry-day stop counts as stopped', () => {
  const a = mk([{ open: 100, high: 101, low: 90, close: 92 }, { open: 92, high: 100, low: 91, close: 95 },
    { open: 95, high: 96, low: 94, close: 95 }, { open: 95, high: 96, low: 94, close: 95 }]);
  assert.equal(simulate(a, 25, 1), null);
  const b = mk([{ open: 100, high: 101, low: 90, close: 92 }, { open: 95, high: 102, low: 89, close: 95 },
    { open: 95, high: 96, low: 94, close: 95 }, { open: 95, high: 96, low: 94, close: 95 }]);
  const tr = simulate(b, 25, 1);
  assert.equal(tr.how, 'stop1');
  assert.ok(Math.abs(tr.gross + 1) < 1e-9);
});

test('no look-ahead: changing days after the setup day never changes the setup, and later days never change a trade', () => {
  const days = [{ open: 100, high: 101, low: 90, close: 92 }, { open: 95, high: 103, low: 94, close: 102 },
    { open: 102, high: 104, low: 100, close: 103 }, { open: 103, high: 106, low: 102, close: 105 }];
  const a = mk([...days, { open: 105, high: 106, low: 104, close: 105 }]);
  const b = mk([...days, { open: 50, high: 200, low: 10, close: 150 }]);
  assert.deepEqual(simulate(a, 25, 1), simulate(b, 25, 1));
  const c = mk([days[0], { open: 1, high: 1, low: 1, close: 1 }]);
  assert.equal(smash(c, 25), 1);
});

test('rule is one position at a time; baseline takes every filled day', () => {
  const ds = mk([{ open: 100, high: 101, low: 90, close: 92 }, { open: 95, high: 103, low: 94, close: 91 },
    { open: 91, high: 104, low: 90, close: 89 }, { open: 89, high: 106, low: 88, close: 105 }, { open: 105, high: 106, low: 104, close: 105 }]);
  const R = runRule(ds, 1);
  for (let k = 1; k < R.length; k++) assert.ok(R[k].i >= R[k - 1].exitDay);
  assert.ok(runBase(ds, 1).length >= R.length);
});

test('helpers: Holm and month-sum t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const T = [{ exitT: Date.UTC(2017, 0, 10) / 1000, net: 1 }, { exitT: Date.UTC(2017, 1, 10) / 1000, net: 2 }];
  assert.equal(monthT(T, ['2017-01-01', '2017-03-31'], 'net').months, 3);
});

test('the report agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.deepEqual(r.windows, WIN);
  assert.equal(r.verdict, 'FAIL');
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.length < 230 && line.includes('FAIL'));
  const t1 = r.tests.T1;
  assert.ok(line.includes(t1.oos.mean.toFixed(3)) && line.includes(`n ${t1.oos.n}`) && line.includes(t1.oos.t.toFixed(2)) && line.includes(t1.is.mean.toFixed(3)));
  for (const k of ['T1', 'T2', 'T3']) { const x = r.tests[k];
    assert.equal(x.pass, false);
    assert.ok(md.includes(`| ${x.oos.n} |`) && md.includes(x.oos.mean.toFixed(3)) && md.includes(`${x.placebo.beaten} of 40`)); }
  for (const [k, b] of Object.entries(r.baseline)) assert.ok(md.includes(b.net.toFixed(3).replace(/^0/, '+0').replace(/^-0/, '-0')), k);
});
