// research/edge/gold-grain-shock: the trigger, the trade and the stop on hand-made candles, no look-ahead, report vs result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { basketMoves, zScores, trade, signals, taken, monthT, holm, P, verdictLine, report, TESTS, FX } from '../research/edge/gold-grain-shock/run.mjs';

const DIR = new URL('../research/edge/gold-grain-shock/', import.meta.url);
const DAY = 86400, T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
const mk = (closes) => closes.map((c, i) => ({ time: T0 + i * DAY, open: c, high: c + 1, low: c - 1, close: c }));

test('basket move needs all three grains and z uses only earlier days', () => {
  const a = mk([10, 10.1, 10.0, 10.2]), b = mk([20, 20, 20.2, 20.2]), c = mk([5, 5.05, 5, 5]);
  const m = basketMoves([a, b, c.slice(0, 3)]);
  assert.equal(m.length, 2); // day 3 has no third grain
  assert.ok(Math.abs(m[0].move - (Math.log(10.1 / 10) + 0 + Math.log(5.05 / 5)) / 3) < 1e-12);
  // z of a day does not change when later days change
  const base = Array.from({ length: 80 }, (_, i) => ({ time: T0 + i * DAY, move: Math.sin(i) / 100 }));
  const z1 = zScores(base), alt = base.map((x, i) => (i > 70 ? { ...x, move: 9 } : x)), z2 = zScores(alt);
  assert.equal(z1.get(base[70].time), z2.get(base[70].time));
  assert.equal(zScores(base).has(base[59].time), false);
});

test('trade enters at the next open, has a stop on the losing side, and stops first', () => {
  const bars = mk(Array.from({ length: 30 }, () => 100)); // ATR(20) = 2 -> r0 4
  bars[21] = { ...bars[21], open: 101, high: 103, low: 99, close: 102 };
  const t = trade(bars, 20, 'buy', 5);
  assert.equal(t.entry, 101); assert.equal(t.r0, 4); assert.equal(t.kind, 'close');
  bars[23] = { ...bars[23], low: 96.5, high: 120 }; // touches the stop 97 and a high far above: stop first
  const s = trade(bars, 20, 'buy', 5);
  assert.equal(s.kind, 'stop'); assert.equal(s.exit, 97); assert.ok(s.netR < -1);
  bars[22] = { ...bars[22], open: 90 }; // an open beyond the stop fills at the open
  const g = trade(bars, 20, 'buy', 5);
  assert.equal(g.kind, 'gap'); assert.equal(g.exit, 90);
  const sell = trade(mk(Array.from({ length: 30 }, () => 100)), 20, 'sell', 1);
  assert.equal(sell.finR, 0); assert.ok(sell.r0 > 0);
  assert.equal(trade(bars, 28, 'buy', 5), null);
});

test('one position at a time and shock / ordinary split, both directions', () => {
  const bars = mk(Array.from({ length: 60 }, (_, i) => 100 + i * 0.1));
  const z = new Map(bars.map((b, i) => [b.time, i === 25 || i === 27 || i === 40 ? 3 : 0]));
  const { stress, ordinary } = signals(bars, z);
  assert.deepEqual(stress, [25, 27, 40]);
  assert.ok(!ordinary.includes(25) && ordinary.includes(26));
  const tk = taken(bars, stress, 'buy', 5);
  assert.equal(tk.skipped, 1); assert.deepEqual(tk.rows.map((r) => r.i), [25, 40]);
  const zd = new Map(bars.map((b, i) => [b.time, i === 30 ? -2 : i === 31 ? 2 : i === 32 ? -1.4 : 0]));
  const dn = signals(bars, zd, -1);
  assert.deepEqual(dn.stress, [30]);
  assert.ok(dn.ordinary.includes(31) && dn.ordinary.includes(32));
  assert.deepEqual(signals(bars, zd, 1).stress, [31]);
});

test('the tests are the pre-registered three', () => {
  assert.deepEqual(Object.values(TESTS).map((t) => [t.side, t.hold, t.dir]), [['buy', 5, 1], ['buy', 20, 1], ['sell', 5, -1]]);
  assert.deepEqual(FX, ['wheat', 'corn', 'soybn']);
});

test('month t and Holm', () => {
  const rows = [{ entryYmd: '2020-01-02', x: 1 }, { entryYmd: '2020-01-09', x: 1 }, { entryYmd: '2020-02-03', x: 1 }, { entryYmd: '2020-03-03', x: 3 }];
  const m = monthT(rows, 'x'); assert.equal(m.months, 3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.equal(P.Z, 1.5); assert.equal(P.COST, 0.6);
});

test('report and result.json agree', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(R));
  assert.ok(md.includes(`**Verdict: ${verdictLine(R)}.**`));
  assert.ok(R.headline.length < 220);
  assert.equal(R.verdict, R.bar.T1.pass ? 'PASS' : 'FAIL');
  for (const k of ['T1', 'T2', 'T3']) {
    const x = R.tests[k].oos;
    assert.equal(R.bar[k].tOos, x.t >= 2 && x.holmP < 0.05);
    assert.ok(R.placebo[k].seedT.length === 40);
  }
  assert.ok(R.data.count.is.up >= 100 && R.data.count.oos.up >= 100 && R.data.count.is.down >= 100 && R.data.count.oos.down >= 100);
  assert.ok(R.trades.every((t) => t.entry <= '2026-10-31' && t.entry > t.signal));
});
