// research/edge/gold-macd: the indicators, crosses, stops and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ema, sma, macd, crosses, atr, simulate, rOf, holm, signals, P, TESTS } from '../research/edge/gold-macd/run.mjs';

const dir = new URL('../research/edge/gold-macd/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const mk = (closes) => closes.map((c, i) => ({ time: day(i), open: c, high: c + 1, low: c - 1, close: c }));

test('EMA is seeded with the mean of its first n values; SMA is a plain mean', () => {
  const e = ema([1, 2, 3, 4, 5], 3);
  assert.deepEqual(e.slice(0, 2), [null, null]);
  assert.equal(e[2], 2);
  assert.equal(e[3], 2 + 0.5 * (4 - 2));
  assert.deepEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
});

test('crosses read only days i-1 and i, and the MACD line is EMA12 - EMA26', () => {
  assert.deepEqual(crosses([1, 2, 3, 2], [2, 2, 2, 2.5]), [0, 0, 1, -1]);
  const c = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 5);
  const m = macd(c), f = ema(c, 12), s = ema(c, 26);
  assert.ok(Math.abs(m.line[40] - (f[40] - s[40])) < 1e-12);
  // no look-ahead: changing every close after day k leaves every cross up to k unchanged
  const k = 45, a = signals(mk(c), 'macd'), c2 = c.map((x, i) => (i > k ? x * 3 : x)), b = signals(mk(c2), 'macd');
  assert.deepEqual(a.slice(0, k + 1), b.slice(0, k + 1));
});

test('a cross on day i fills at day i+1 open, every trade carries a stop on the losing side, stops fill at the gap open', () => {
  const p = { ...P, warm: 0 };
  const bars = mk(Array.from({ length: 40 }, () => 100));
  const sig = new Array(40).fill(0); sig[20] = 1; sig[30] = -1;
  const t = simulate(bars, sig, TESTS.T2, p);
  assert.equal(t.length, 1);
  assert.equal(t[0].entryI, 21); assert.equal(t[0].exitI, 31); assert.equal(t[0].why, 'cross');
  assert.ok(t[0].stop < t[0].entry && t[0].dist === 2 * atr(bars)[20]);
  // gap through the stop: filled at the open, worse than the stop
  const b2 = mk(Array.from({ length: 40 }, () => 100)); b2[25] = { ...b2[25], open: 90, low: 89, high: 91, close: 90 };
  const s2 = simulate(b2, sig, TESTS.T2, p);
  assert.equal(s2[0].why, 'stop'); assert.equal(s2[0].exit, 90);
  // stop-and-reverse: a short opens at the same open as the long closes; after a stop, flat until the next cross
  const s3 = simulate(bars, sig, TESTS.T1, p);
  assert.equal(s3.length, 2); assert.equal(s3[1].side, -1); assert.equal(s3[1].entryI, 31); assert.ok(s3[1].stop > s3[1].entry);
  for (const x of [...t, ...s2, ...s3]) assert.ok(x.dist > 0 && (x.stop - x.entry) * x.side < 0);
});

test('costs: $0.60 a round trip and financing on longs only, doubled at 2x', () => {
  const t = { side: 1, entry: 2000, exit: 2040, dist: 20, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), r2 = rOf(t, 2);
  assert.equal(r.gross, 2); assert.equal(r.cost, 0.03); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.fin - 7 * 0.000148 * 2000 / 20) < 1e-12);
  assert.ok(Math.abs(r2.fin - 2 * r.fin) < 1e-12 && Math.abs(r2.cost - 0.06) < 1e-12);
  assert.equal(rOf({ ...t, side: -1 }).fin, 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false);
  assert.match(md, /\*\*Verdict: FAIL, 0 of 3: [^*]+\*\*/);
  assert.ok(md.match(/\*\*Verdict:[^*]*\*\*/)[0].length < 220);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = R.tests[id];
    assert.equal(x.pass, false);
    for (const w of ['IS', 'OOS']) {
      assert.ok(md.includes(`| ${x[w].n} |`), `${id} ${w} n`);
      assert.ok(md.includes(f(x[w].net)), `${id} ${w} net`);
      assert.ok(md.includes(x[w].t.toFixed(2)), `${id} ${w} t`);
    }
    assert.ok(md.includes(`(${x.placebo.beaten}; `) || md.includes(`(${x.placebo.beaten}; placebo`), `${id} placebo`);
  }
  assert.equal(R.tests.T3.descriptive, true);
  assert.ok(md.includes(`Holm p ${R.tests.T2.holmP.toFixed(2)}`));
});
