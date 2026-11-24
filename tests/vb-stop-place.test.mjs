// vb-stop-place: the stop places of the volatility breakout, the rule's management, no look-ahead in the ATR, and the
// published figures against result.json. Offline and fast (no candles read).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { stopOf, manage, atrIndex, cell, decide } from '../research/edge/vb-stop-place/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-stop-place/result.json', import.meta.url), 'utf8'));
const md = fs.readFileSync(new URL('../research/edge/vb-stop-place/RESULT.md', import.meta.url), 'utf8');

test('stop places sit on the losing side where the plan puts them', () => {
  const buy = { side: 1, open: 100, up: 105, dn: 95, entry: 105.2 }, sell = { side: -1, open: 100, up: 105, dn: 95, entry: 94.9 };
  assert.equal(stopOf('O', buy), 100); assert.equal(stopOf('A', buy), 102.5); assert.equal(stopOf('C', buy), 95);
  assert.equal(stopOf('B', buy, 2), 103.2); assert.equal(stopOf('B', buy, null), null);
  assert.equal(stopOf('A', sell), 97.5); assert.equal(stopOf('C', sell), 105); assert.equal(stopOf('B', sell, 1), 95.9);
  for (const v of ['O', 'A', 'B', 'C']) { assert.ok(stopOf(v, buy, 2) < buy.entry); assert.ok(stopOf(v, sell, 1) > sell.entry); }
});

test('management: worst case on the fill candle, a gap exits at the open, else the last close', () => {
  const b = (t, o, h, l, c) => ({ t, o, h, l, c });
  assert.deepEqual(manage([b(0, 10, 11, 8.9, 10.5)], 0, 1, 10.5, 9), { exit: 9, how: 'stop', t: 0 });
  assert.deepEqual(manage([b(0, 10, 11, 9.5, 10.5), b(300, 8.5, 9, 8, 8.8)], 0, 1, 10.5, 9), { exit: 8.5, how: 'stop', t: 300 });
  assert.deepEqual(manage([b(0, 10, 11, 9.5, 10.5), b(300, 10.5, 12, 10, 11.5)], 0, 1, 10.5, 9), { exit: 11.5, how: 'time', t: 600 });
});

test('ATR uses only H1 candles that ended by the fill: later prices change nothing', () => {
  const mk = (n, f) => Array.from({ length: n }, (_, i) => { const p = 100 + Math.sin(i / 7) * 3 + f(i); return { t: i * 300, o: p, h: p + 0.5 + (i % 5) * 0.1, l: p - 0.4, c: p + 0.1 }; });
  const a = mk(12 * 40, () => 0), cut = 12 * 30 * 300;
  const b = a.map((x) => (x.t >= cut ? { ...x, h: x.h + 50, l: x.l - 50 } : x));
  assert.equal(atrIndex(a)(cut), atrIndex(b)(cut));
  assert.notEqual(atrIndex(a)(cut + 3600), atrIndex(b)(cut + 3600));
  assert.equal(atrIndex(a)(14 * 3600), null);
});

test('cell and decide follow the plan', () => {
  const c = cell([{ day: '2020-01-02', R: 1, finR: 0, net: 0.9, net2: 0.8, how: 'time', r: 2, rO: 1 }, { day: '2020-02-03', R: -1, finR: 0, net: -1.1, net2: -1.2, how: 'stop', r: 2, rO: 1 }]);
  assert.equal(c.n, 2); assert.equal(c.netR, -0.1); assert.equal(c.sameSize, -0.2);
  const E = { diff: { A: { meanD: 0.01 } }, cell: { A: { netR: 0.1, n: 300 } } }, L = { diff: { A: { meanD: 0.02, monthT: 2.5 } }, cell: { A: { netR: 0.1, n: 300, t: 2.1 } } };
  assert.deepEqual(decide(E, L, 'A'), { c1: true, c2: true, c3: true, c4: true });
});

test('result.json: gates held, the verdict and the figures quoted', () => {
  const plan = crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/vb-stop-place/PREREGISTRATION.md', import.meta.url))).digest('hex');
  assert.equal(R.planSha256, plan);
  assert.ok(R.gate.okXau && R.gate.okJpy); assert.equal(R.gate.same, R.gate.of);
  assert.equal(R.gate.xau.POOLED.got[0], 3713); assert.equal(R.gate.usdjpy.early.got[0], 2089);
  assert.equal(R.pass, false); assert.equal(R.tests.length, 6); assert.ok(R.tests.every((t) => !t.improves));
  assert.ok(md.startsWith('# ') && md.includes('**Verdict: FAIL: 0 of 6'));
  const x = R.markets.xau, j = R.markets.usdjpy;
  assert.equal(x.late.cell.O.netR, 0.098); assert.equal(x.late.cell.O.n, 2250); assert.equal(j.late.cell.O.netR, 0.055);
  assert.equal(x.late.diff.B.monthT, -4.65); assert.equal(j.late.diff.C.monthT, -1.4);
  for (const m of [x, j]) for (const v of ['A', 'B']) assert.ok(m.late.cell[v].costR > m.late.cell.O.costR);   // tighter stop, more cost in R
});
