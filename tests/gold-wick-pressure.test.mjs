// The wick-pressure study on gold: WP, the past-only thresholds, the trade with its stop, costs, Holm, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, atrAt, wpAt, pct, signals, trade, ruleTrades, holm, monthT } from '../research/edge/gold-wick-pressure/run.mjs';

const T0 = Date.UTC(2018, 0, 1) / 1000;
const bar = (i, o, h, l, c) => ({ time: T0 + i * 86400, open: o, high: h, low: l, close: c });

test('WP: lower wicks push it up, upper wicks down, over 10 x ATR14', () => {
  const lw = [...Array(20)].map((_, i) => bar(i, 100, 101, 97, 100)); // lower wick 3, upper 1, TR 4
  assert.equal(atrAt(lw, 19), 4);
  assert.equal(wpAt(lw, 19), (10 * 2) / (10 * 4));
  const uw = [...Array(20)].map((_, i) => bar(i, 100, 103, 99, 100));
  assert.equal(wpAt(uw, 19), (10 * -2) / (10 * 4));
  assert.equal(wpAt(lw, 13), null);
});

test('signals read only the day and the 250 days before it', () => {
  const b = [...Array(400)].map((_, i) => { const x = 100 + Math.sin(i / 7) * 5; return bar(i, x, x + 1 + (i % 3), x - 1 - (i % 5) * 0.4, x + 0.2); });
  const s = signals(b);
  assert.ok(s.length > 0 && s.every((x) => x.i >= P.look));
  const cut = 330, b2 = b.map((x, i) => i > cut ? { ...x, low: x.low - 50, high: x.high + 80 } : x);
  assert.deepEqual(signals(b2).filter((x) => x.i <= cut), s.filter((x) => x.i <= cut));
  assert.equal(pct([1, 2, 3, 4, 5], 0.8), 4.2);
});

test('every trade has a stop on the losing side; a gap exits at the open; buys pay financing, sells none', () => {
  const b = [bar(0, 100, 101, 99, 100), bar(1, 100, 101, 99, 100), bar(2, 100, 101, 99, 100), bar(3, 100, 101, 99, 100), bar(4, 100, 101, 99, 100), bar(5, 100, 101, 99, 100)];
  const buy = trade(b, 1, 'buy', 2), sell = trade(b, 1, 'sell', 2);
  assert.ok(buy.stop < buy.entry && sell.stop > sell.entry);
  assert.equal(buy.how, 'time'); assert.equal(sell.how, 'time');
  assert.ok(buy.nights > 0 && buy.cost > P.cost / buy.risk); assert.equal(sell.cost, P.cost / sell.risk);
  const g = b.map((x) => ({ ...x })); g[3] = bar(3, 90, 91, 89, 90);
  const gx = trade(g, 1, 'buy', 2); assert.equal(gx.how, 'gap'); assert.equal(gx.exitPx, 90); assert.equal(gx.x, 3);
  const s = b.map((x) => ({ ...x })); s[2] = bar(2, 100, 101, 96, 100);
  const sx = trade(s, 1, 'buy', 2); assert.equal(sx.how, 'stop'); assert.equal(sx.exitPx, 97); assert.equal(sx.gross, -1);
});

test('one position at a time; Holm; month sums count empty months', () => {
  const b = [...Array(30)].map((_, i) => bar(i, 100, 101, 99, 100));
  const tr = ruleTrades(b, [{ i: 15, side: 'buy' }, { i: 16, side: 'sell' }, { i: 20, side: 'buy' }]);
  assert.deepEqual(tr.map((x) => x.e), [16, 21]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.equal(monthT([], 'oos', () => 0).months, 118);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-wick-pressure/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-wick-pressure/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\*\*/);
  for (const t of r.tests) assert.match(md, new RegExp(`\\| ${t.id} \\| ${t.what} \\| ${t.t} \\| ${t.p} \\| ${t.holm} \\|`));
  for (const [w, label] of [['is', '2007-16'], ['oos', '2017-26']]) {
    const s = r.S.T1[w];
    assert.match(md, new RegExp(`\\| ${label} \\| ${s.n} \\| ${s.gross.toFixed(3)} \\| ${s.net.toFixed(3)} \\| ${s.excess.toFixed(3)} \\| ${s.totalNet}R \\|`));
    assert.match(md, new RegExp(`\\$${s.medianStop.toFixed(2)}`));
  }
  assert.match(md, new RegExp(`${r.placebo.atLeastActual} of 40 shuffles`));
  assert.match(md, new RegExp(`largest ${r.placebo.max}`));
  assert.ok(!(r.tests[0].t >= 2), 'T1 did not pass');
  assert.ok(!/now live|live change/i.test(md.replace(/nothing live changed/gi, '')), 'no live change claimed');
});
