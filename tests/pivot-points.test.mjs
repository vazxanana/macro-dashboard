// pivot-points study: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARKETS, K, pivots, sessionKey, sessions, plans, runSession, book, tradesOf, rng, holm, monthT, report, toCols, shift } from '../research/edge/pivot-points/run.mjs';

const DIR = new URL('../research/edge/pivot-points/', import.meta.url);
const U = (s) => Date.parse(s) / 1000;
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('pivot formulas', () => {
  const lv = pivots(110, 100, 105);
  assert.ok(close(lv.P, 105) && close(lv.R1, 110) && close(lv.S1, 100) && close(lv.R2, 115) && close(lv.S2, 95));
  const d = shift(lv, 2); assert.ok(close(d.P, 107) && close(d.R2, 117) && close(d.R1 - d.P, lv.R1 - lv.P));
});

test('session keys: the 17:00 New York day and the local cash sessions, daylight time handled', () => {
  const fx = MARKETS.eurusd;
  // summer (EDT, UTC-4): 17:00 New York = 21:00 UTC
  assert.equal(sessionKey(fx, U('2024-07-10T20:55:00Z')) + 1, sessionKey(fx, U('2024-07-10T21:00:00Z')));
  // winter (EST, UTC-5): 17:00 New York = 22:00 UTC; the Sunday reopen belongs to Monday's day
  assert.equal(sessionKey(fx, U('2024-01-14T22:00:00Z')), sessionKey(fx, U('2024-01-15T12:00:00Z')));
  const us = MARKETS.spx500;
  assert.equal(sessionKey(us, U('2024-07-10T13:25:00Z')), null);
  assert.notEqual(sessionKey(us, U('2024-07-10T13:30:00Z')), null);   // 09:30 EDT
  assert.equal(sessionKey(us, U('2024-01-10T14:25:00Z')), null);
  assert.notEqual(sessionKey(us, U('2024-01-10T14:30:00Z')), null);   // 09:30 EST
  assert.equal(sessionKey(us, U('2024-01-10T21:00:00Z')), null);      // 16:00 EST, closed
  const de = MARKETS.de40;
  assert.notEqual(sessionKey(de, U('2024-07-10T07:00:00Z')), null);   // 09:00 CEST
  assert.equal(sessionKey(de, U('2024-07-10T15:30:00Z')), null);      // 17:30 CEST
  const uk = MARKETS.uk100;
  assert.notEqual(sessionKey(uk, U('2024-01-10T08:00:00Z')), null);   // 08:00 GMT
  assert.equal(sessionKey(uk, U('2024-01-10T07:55:00Z')), null);
});

// a synthetic US-index file: `days` cash sessions of 78 candles, each a flat line at `px(d, k)` with a range of 0.1
function usFile(days, px) {
  const rows = []; let d0 = U('2024-01-08T14:30:00Z');   // Monday 09:30 EST
  for (let d = 0, n = 0; n < days; d++) {
    const t0 = d0 + d * 86400, wd = new Date(t0 * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    for (let k = 0; k < 78; k++) { const p = px(n, k); rows.push([t0 + k * 300, p.o ?? p.c, p.h ?? p.c + 0.05, p.l ?? p.c - 0.05, p.c]); }
    n++;
  }
  return toCols(rows);
}

test('levels and ATR come only from earlier sessions (changing the traded session and later changes nothing)', () => {
  const base = (n, k) => ({ c: 100 + (n % 3) + k * 0.01 });
  const A = usFile(30, base), B = usFile(30, (n, k) => (n >= 20 ? { c: 500 + k } : base(n, k)));
  const pa = plans(sessions(MARKETS.spx500, A)), pb = plans(sessions(MARKETS.spx500, B));
  assert.equal(sessions(MARKETS.spx500, A).length, 30);
  const ia = pa.findIndex((p) => p.s.key === pa.find((q) => q.s.a >= 19 * 78).s.key);
  for (let i = 0; i <= ia; i++) { assert.deepEqual(pa[i].lv, pb[i].lv); assert.equal(pa[i].atr, pb[i].atr); }
});

test('a session under 80 % of its candles is not valid', () => {
  const rows = []; const t0 = U('2024-01-08T14:30:00Z'); for (let k = 0; k < 60; k++) rows.push([t0 + k * 300, 1, 1.1, 0.9, 1]);
  assert.equal(sessions(MARKETS.spx500, toCols(rows)).length, 0);
  rows.length = 0; for (let k = 0; k < 63; k++) rows.push([t0 + k * 300, 1, 1.1, 0.9, 1]);
  assert.equal(sessions(MARKETS.spx500, toCols(rows)).length, 1);
});

// hand-made session: candles as [o, h, l, c]
const sess = (cs) => { const rows = cs.map((x, i) => [1000 + i * 300, ...x]); return { B: toCols(rows), s: { a: 0, b: rows.length } }; };
const LV = pivots(110, 100, 105);   // P 105, R1 110, S1 100, R2 115, S2 95

test('T1 fades the first touch of R1 to P; on the fill candle only the stop counts', () => {
  const { B, s } = sess([[106, 107, 105.5, 106.5], [107, 110.2, 106.8, 109], [109, 109.2, 104.9, 105.2]]);
  const t = runSession('T1', B, s, LV, 4);   // stop 110 + 1 = 111
  assert.equal(t.length, 1); assert.equal(t[0].side, -1); assert.equal(t[0].entry, 110); assert.equal(t[0].exit, 'target'); assert.equal(t[0].exitPx, 105);
  // the fill candle reaches the stop: stopped there, whatever else it did
  const x = sess([[106, 107, 105.5, 106.5], [107, 111.5, 104, 106]]);
  const y = runSession('T1', x.B, x.s, LV, 4); assert.equal(y[0].exit, 'stop'); assert.equal(y[0].exitPx, 111);
  // a session opening beyond R1 voids the level; S1 still works
  const z = sess([[111, 112, 110.5, 111], [111, 111, 99.9, 100.5], [100.5, 105.5, 100.4, 105.2]]);
  const w = runSession('T1', z.B, z.s, LV, 4); assert.equal(w.length, 1); assert.equal(w[0].side, 1); assert.equal(w[0].exit, 'target');
  // no target or stop: flat at the last close
  const q = sess([[106, 110, 106, 109], [109, 109.5, 108, 108]]);
  const r = runSession('T1', q.B, q.s, LV, 4); assert.equal(r[0].exit, 'time'); assert.equal(r[0].exitPx, 108);
  const b = book('spx500', 'T1', r[0]); assert.ok(close(b.gross, 2 / 1)); assert.ok(close(b.net, 2 - 0.0004 * 110));
});

test('T2 follows the first close beyond R1 at the next open, stop 0.1 ATR back past the level, target R2', () => {
  const { B, s } = sess([[108, 109, 107, 108.5], [108.5, 110.6, 108.4, 110.5], [110.6, 113, 110.5, 112.8], [112.8, 115.3, 112.7, 115]]);
  const t = runSession('T2', B, s, LV, 10);   // stop 110 - 1 = 109
  assert.equal(t.length, 1); assert.equal(t[0].entry, 110.6); assert.equal(t[0].stop, 109); assert.equal(t[0].exit, 'target'); assert.equal(t[0].exitPx, 115);
  // a close beyond on the last candle: no trade; the level is spent once
  const x = sess([[108, 109, 107, 108.5], [108.5, 110.6, 108.4, 110.5]]); assert.equal(runSession('T2', x.B, x.s, LV, 10).length, 0);
  const y = sess([[108, 109, 107, 108.5], [108.5, 110.6, 108.4, 110.5], [110.6, 110.7, 108.8, 109], [109, 110.8, 108.9, 110.7], [110.7, 111, 110, 110.5]]);
  const z = runSession('T2', y.B, y.s, LV, 10); assert.equal(z.length, 1); assert.equal(z[0].exit, 'stop');
});

test('placebo shift keeps the ladder geometry and the rng is seeded', () => {
  const a = rng(7), b = rng(7); for (let i = 0; i < 5; i++) assert.equal(a(), b());
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  const mt = monthT([{ at: U('2024-01-05T00:00:00Z'), net: 1 }, { at: U('2024-02-05T00:00:00Z'), net: 3 }], U('2024-01-01T00:00:00Z'), U('2024-03-01T00:00:00Z'));
  assert.equal(mt.months, 2); assert.ok(close(mt.t, 2 / (Math.SQRT2 / Math.SQRT2)));
  const { B } = sess([[106, 107, 105.5, 106.5]]);
  assert.deepEqual(tradesOf('spx500', B, 'T1', [], rng(1)), []);
});

test('the report is the result file, and the verdict line names the reason in under 220 characters', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(R));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.includes(R.verdict) && R.verdict.length < 220);
  assert.equal(Object.keys(R.tests).length, 8);
  const T1 = R.tests['T1 all'];
  assert.equal(R.verdict.startsWith(T1.verdict), true);
  assert.equal(T1.verdict === 'PASS', Object.values(T1.checks).every(Boolean));
  assert.equal(T1.checks['OOS month t >= 2'], T1.oos.t >= 2);
  assert.equal(T1.placebo.means.length, K.SEEDS);
  assert.deepEqual(R.markets, Object.keys(MARKETS));
  assert.ok(!R.markets.includes('xau'));
  for (const id of Object.keys(R.tests)) assert.ok(md.includes(`| ${id} | ${R.tests[id].verdict} |`));
});
