// tests/fade-limit-entry.test.mjs - the fade on a resting limit: pre-registration, result.json and RESULT.md agree, the verdict
// follows the bar, the baseline gate held, the fill rule on hand-made candles (through by a tick, gap at the open, the fill
// candle can only stop), the two order variants, and no look-ahead (later prices never move a fill or a result). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { limitTrade, orderOf, cellName, NCELL, XS, N_CANDLES, tickOf, passOf } from '../research/edge/fade-limit-entry/run.mjs';

const DIR = new URL('../research/edge/fade-limit-entry/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });

test('pre-registration fixes X, N, the fill rule, the variants, the costs and the bar', () => {
  for (const w of ['X in {0.1, 0.25, 0.5}', 'N = 4 M15 candles', 'one tick', 'only the stop can be hit', 'Variant A', 'Variant B',
    'FULL round trip', '0.5 x COSTS', 'Holm', '200 fills', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Control'])
    assert.ok(pre.includes(w), w);
  assert.deepEqual(XS, [0.1, 0.25, 0.5]); assert.equal(N_CANDLES, 4); assert.equal(NCELL, 12);
  assert.equal(new Set(Array.from({ length: NCELL }, (_, i) => cellName(i).name)).size, 12);
});

test('result.json: baseline gate held, verdict follows the bar, RESULT.md says the same', () => {
  assert.equal(R.gateOk, true);
  for (const g of R.gate) assert.ok(g.ok, g.rule);
  assert.equal(R.cells.length, 12);
  const recomputed = R.cells.filter((c) => passOf({ d: { n: c.disc.n, net: c.disc.net }, c: { n: c.conf.n, net: c.conf.net, tNet: c.conf.tNet } }, c.holm));
  assert.deepEqual(recomputed.map((c) => c.cell), R.passed);
  assert.equal(R.verdict, R.passed.length ? 'PASS' : 'FAIL');
  assert.equal(R.verdict, 'FAIL');
  for (const c of R.cells) { assert.ok(c.conf.net < 0 && c.disc.net < 0, c.cell); assert.ok(c.conf.gross <= 0, c.cell); assert.ok(c.conf.n >= 200 && c.disc.n >= 200); }
  assert.ok(md.includes(`**Verdict: ${R.verdict}. ${R.headline}.**`));
  const r1 = R.market.find((m) => m.rule === 'R1'), r2 = R.market.find((m) => m.rule === 'R2');
  assert.equal(r1.conf.n, 201769); assert.equal(r2.conf.n, 54443);
  assert.ok(Math.abs(r1.conf.gross - 0.042) < 0.002 && Math.abs(r2.conf.gross - 0.193) < 0.002);
  const best = R.cells.find((c) => c.cell === R.best);
  assert.ok(md.includes(`${best.cell}, made -${Math.abs(best.conf.net).toFixed(3)}R`));
});

test('fill rule: a sell limit fills only when price trades through it by a tick; a gap fills at the open', () => {
  const tick = tickOf('eurusd'), L = 1.1, stop = 1.101, target = 1.098;
  // high exactly at L: no fill
  let M = [bar(0, 1.0995, 1.1, 1.0994, 1.0996)];
  assert.equal(limitTrade(M, -1, L, stop, target, 0, 3600, 86400, tick).status, 'nofill');
  // high one tick through: fill at L
  M = [bar(0, 1.0995, 1.1 + tick, 1.0994, 1.0996), bar(300, 1.0996, 1.0997, 1.0979, 1.098)];
  let r = limitTrade(M, -1, L, stop, target, 0, 3600, 86400, tick);
  assert.equal(r.fill, L); assert.equal(r.reason, 'target'); assert.ok(Math.abs(r.R - 2) < 1e-9);
  // a gap open above L fills at the open; R is in units of the planned risk |L - stop|
  M = [bar(0, 1.1005, 1.1006, 1.1004, 1.1005), bar(300, 1.1, 1.1, 1.0979, 1.098)];
  r = limitTrade(M, -1, L, stop, target, 0, 3600, 86400, tick);
  assert.equal(r.fill, 1.1005); assert.ok(Math.abs(r.risk - 0.001) < 1e-12); assert.ok(Math.abs(r.R - (1.1005 - 1.098) / 0.001) < 1e-9);
  // expiry: a candle starting at or after the expiry cannot fill
  M = [bar(0, 1.0995, 1.0996, 1.099, 1.0995), bar(3600, 1.0995, 1.1005, 1.099, 1.1)];
  assert.equal(limitTrade(M, -1, L, stop, target, 0, 3600, 86400, tick).status, 'nofill');
  // a buy limit mirrors it
  M = [bar(0, 1.1005, 1.1006, 1.1 - tick, 1.1003), bar(300, 1.1003, 1.1021, 1.1002, 1.102)];
  r = limitTrade(M, 1, L, 1.099, 1.102, 0, 3600, 86400, tick); assert.equal(r.fill, L); assert.equal(r.reason, 'target');
});

test('the fill candle can only stop the trade; then stop before target in one candle; then the time limit', () => {
  const tick = 0.00001, L = 1.1, stop = 1.101, target = 1.098;
  // fill candle reaches the target but not the stop: no exit on it
  let M = [bar(0, 1.0995, 1.1002, 1.0975, 1.099), bar(300, 1.099, 1.0995, 1.0985, 1.0992)];
  assert.equal(limitTrade(M, -1, L, stop, target, 0, 3600, 86400, tick).status, 'open');
  // fill candle reaches the stop: stopped at -1R
  M = [bar(0, 1.0995, 1.1012, 1.0994, 1.1)];
  let r = limitTrade(M, -1, L, stop, target, 0, 3600, 86400, tick); assert.equal(r.reason, 'stop'); assert.ok(Math.abs(r.R + 1) < 1e-9);
  // a later candle holding both: stop
  M = [bar(0, 1.0995, 1.1002, 1.0994, 1.1), bar(300, 1.1, 1.1015, 1.0975, 1.099)];
  r = limitTrade(M, -1, L, stop, target, 0, 3600, 86400, tick); assert.equal(r.reason, 'stop');
  // time exit at the close of the first candle closing at or after fill + cap
  M = [bar(0, 1.0995, 1.1002, 1.0994, 1.1), bar(300, 1.1, 1.1003, 1.0995, 1.0996)];
  r = limitTrade(M, -1, L, stop, target, 0, 3600, 600, tick); assert.equal(r.reason, 'time'); assert.ok(Math.abs(r.R - 0.4) < 1e-9);
});

test('orders: variant A keeps the distances, variant B the prices (no order past the stop)', () => {
  const sg = { s: -1, ref: 100, A: 2, risk: 2.2, k0: 2, stop: 102.3, target: 95.6 };
  const a = orderOf(sg, 0.25, 'A', 0.3); assert.equal(a.L, 100.5); assert.ok(Math.abs(a.stop - 102.7) < 1e-9 && Math.abs(a.target - 96.1) < 1e-9);
  const b = orderOf(sg, 0.25, 'B', 0.3); assert.equal(b.L, 100.5); assert.equal(b.stop, 102.3); assert.equal(b.target, 95.6);
  assert.equal(orderOf({ ...sg, stop: 100.6 }, 0.5, 'B', 0.3), null); // L 101 at or beyond the stop
  assert.equal(orderOf({ ...sg, stop: 100.7 }, 0.25, 'B', 0.3), null); // risk 0.2 under the cost
  const buy = orderOf({ ...sg, s: 1, stop: 97.7, target: 104.4 }, 0.1, 'A', 0.3); assert.ok(Math.abs(buy.L - 99.8) < 1e-9 && buy.stop < buy.L && buy.target > buy.L);
});

test('no look-ahead: prices after the fill never move the fill, prices after the exit never move the result', () => {
  const rnd = K.rng(11); let p = 100; const M = [];
  for (let i = 0; i < 3000; i++) { const o = p, c = o + (rnd() - 0.5) * 0.4; M.push(bar(i * 300, o, Math.max(o, c) + rnd() * 0.15, Math.min(o, c) - rnd() * 0.15, c)); p = c; }
  let checked = 0;
  for (let k = 0; k < 2000; k += 7) {
    const t0 = M[k].t, s = k % 2 ? 1 : -1, L = M[k].o - s * 0.2, stop = L - s * 0.5, target = L + s * 1;
    const full = limitTrade(M, s, L, stop, target, t0, t0 + 3600, 86400, 0.01);
    if (full.status !== 'done') continue; checked++;
    const cutFill = limitTrade(M.slice(0, full.fi + 1), s, L, stop, target, t0, t0 + 3600, 86400, 0.01);
    assert.equal(M.slice(0, full.fi + 1).length, full.fi + 1);
    if (cutFill.status === 'done') assert.equal(cutFill.fill, full.fill); else assert.equal(cutFill.status, 'open');
    // change every price after the exit candle: same result
    const exitIdx = M.findIndex((b, i) => i >= full.fi && (full.reason === 'stop' || full.reason === 'target' || full.reason === 'time') && limitTrade(M.slice(0, i + 1), s, L, stop, target, t0, t0 + 3600, 86400, 0.01).status === 'done');
    const M2 = M.map((b, i) => (i > exitIdx ? { ...b, o: b.o + 50, h: b.h + 50, l: b.l + 50, c: b.c + 50 } : b));
    const again = limitTrade(M2, s, L, stop, target, t0, t0 + 3600, 86400, 0.01);
    assert.equal(again.R, full.R); assert.equal(again.fi, full.fi);
  }
  assert.ok(checked > 50, 'checked ' + checked);
});
