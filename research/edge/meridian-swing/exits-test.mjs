// node --test research/edge/meridian-swing/exits-test.mjs : the swing exit variants on hand-made candles
import test from 'node:test';
import assert from 'node:assert/strict';
import { manage, newVariants, h1Pivots } from './exits.mjs';
const mk = (side, extra = {}) => { const tr = { side, entry: 100, stop: side === 'buy' ? 99 : 101, t1: side === 'buy' ? 102 : 98, t2: side === 'buy' ? 104 : 96, r0: 1, filled: 0, ...extra }; tr.v = newVariants(tr); return tr; };
const R = (tr) => Object.fromEntries(tr.v.map((v) => [v.n, v.R]));
const bar = (time, low, high, close) => ({ time, low, high, close: close ?? (low + high) / 2 });

test('straight loss: every variant -1R', () => {
  const tr = mk('buy'); manage(tr, bar(300, 98.5, 100.2), null);
  assert.deepEqual(R(tr), { none: -1, be1: -1, part: -1, tp2: -1, trail: -1, trailT1: -1 });
});
test('+1R then back to the stop: be1 0, part +0.5, none -1', () => {
  const tr = mk('buy'); manage(tr, bar(300, 99.8, 101.1), null); manage(tr, bar(600, 98.9, 100.5), null);
  const r = R(tr); assert.equal(r.none, -1); assert.equal(r.be1, 0); assert.equal(r.part, 0.5); assert.equal(r.tp2, -1);
});
test('target 1 then target 2 (sell): none 2R, part 1.5R, tp2 4R', () => {
  const tr = mk('sell'); manage(tr, bar(300, 97.9, 100.4), null);
  let r = R(tr); assert.equal(r.none, 2); assert.equal(r.be1, 2); assert.equal(r.part, 1.5, 'the half comes off at +1R inside the target candle');
  manage(tr, bar(600, 95.9, 98.5), null); r = R(tr);
  assert.equal(r.tp2, 4);
});
test('stop is checked before target inside one candle', () => {
  const tr = mk('buy'); manage(tr, bar(300, 98.9, 102.1), null);
  assert.equal(R(tr).none, -1);
});
test('trail: from +1R the stop follows the last confirmed H1 swing low at each H1 close', () => {
  const H1 = [100, 101, 99.5, 101, 102, 103].map((low, i) => ({ time: i * 3600, open: low, high: low + 1, low, close: low + 0.5 }));
  const piv = h1Pivots(H1);
  assert.deepEqual(piv(false, 6 * 3600).p, 99.5);
  const tr = mk('buy', { entry: 100, stop: 98, t1: 104, t2: 106, r0: 2 });
  manage(tr, bar(6 * 3600 - 300, 101, 102.2, 102), piv, 0);   // +1.1R, closes at the H1 close: armed, stop -> 99.5
  const v = tr.v.find((x) => x.n === 'trail'); assert.equal(v.stop, 99.5);
  manage(tr, bar(6 * 3600, 99.4, 101), piv, 0);
  assert.equal(v.R, -0.25); assert.equal(tr.v.find((x) => x.n === 'none').R, null);
});
