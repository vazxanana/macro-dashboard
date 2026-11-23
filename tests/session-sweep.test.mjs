// node --test tests/session-sweep.test.mjs - the Asia range sweep study (research/edge/session-sweep), offline, on hand-made
// and seeded candles: the hand-drawn setup is found, no look-ahead (later candles cut or changed), every trade has its stop
// on the losing side, and result.json says what RESULT.md says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../research/edge/session-sweep/run.mjs';
import * as K from '../research/edge/_lib/edgekit.mjs';

const D = S.dayOf(Date.UTC(2024, 0, 9, 12) / 1000); // Tuesday 9 Jan 2024 (New York winter)
const mk = (t, o, c, w = 0.05, h, l) => ({ t, o, h: h ?? Math.max(o, c) + w, l: l ?? Math.min(o, c) - w, c, e: t + 300 });

// A day by hand: Asia range 98.0-102.0, London: a swing low, a lower... a QM sell after a sweep of the Asia high, then a fall.
function handDay() {
  const out = []; let p = 101;
  const push = (t, c, h, l) => { out.push(mk(t, p, c, 0.05, h, l)); p = c; };
  // warm-up: two days of a gentle sine inside 100.5-101.5
  for (let t = S.utcOf(D - 3, 0); t < S.utcOf(D - 1, 20 * 60); t += 300) push(t, 101 + 0.5 * Math.sin(t / 3000));
  let k = 0;
  for (let t = S.utcOf(D - 1, 20 * 60); t < S.utcOf(D, 0); t += 300, k++) {
    if (k === 10) push(t, 101.2, 102.0, null); else if (k === 30) push(t, 100.8, null, 98.0); else push(t, k % 2 ? 100.6 : 101.4);
  }
  for (let t = S.utcOf(D, 0); t < S.utcOf(D, 120); t += 300) push(t, 101.0);
  const path = [101.0, 101.0, 101.0, 100.7, 101.0, 101.2, 101.4, 101.7, 101.5, 101.3, 101.1, 101.4, 101.8, 102.3, 102.6, 102.2, 101.8, 101.4, 101.0];
  let t = S.utcOf(D, 120);
  for (const c of path) { push(t, c); t += 300; }
  for (; t < S.utcOf(D, 16 * 60) + 300; t += 300) push(t, Math.max(97.5, p - 0.15));
  return out;
}

test('the hand-drawn sweep and QM are found, and the trade goes to the other side of the range', () => {
  const B = handDay();
  const asia = S.asiaRange(B, D);
  assert.equal(asia.ok, true); assert.equal(asia.hi, 102.0); assert.equal(asia.lo, 98.0);
  const r = S.dayTrade(B, D, 0.01);
  assert.ok(r.trade, JSON.stringify(r.tries));
  assert.equal(r.trade.win, 'london'); assert.equal(r.trade.side, -1);
  assert.equal(r.trade.target, 98.0);
  assert.ok(r.trade.stop > r.trade.entry, 'a sell has its stop above the entry');
  assert.ok(Math.abs(r.trade.stop - (102.65 + 0.01)) < 1e-9, 'stop = sweep extreme + one cost');
  assert.equal(r.trade.sim.reason, 'target');
});

function cutAndChange(B, t) { return B.map((b) => (b.t < t ? b : { ...b, o: b.o + 7, h: b.h + 9, l: b.l - 9, c: b.c - 6 })); }

test('no look-ahead: the signal does not move when every candle from the entry on is changed or cut', () => {
  const B = handDay();
  const base = S.dayTrade(B, D, 0.01).trade.sig;
  const A = cutAndChange(B, base.t);
  const asia = S.asiaRange(A, D);
  const a = S.windowSignal(A, K.qms(A, 3), D, S.P.london, asia).sig;
  assert.deepEqual(a, base);
  const C = B.filter((b) => b.e <= base.t);
  const c = S.windowSignal(C, K.qms(C, 3), D, S.P.london, S.asiaRange(C, D)).sig;
  assert.deepEqual(c, base);
});

// Seeded walks over many weekdays with session-like volatility: every signal is unchanged by later candles and every
// trade has its stop on the losing side.
function walkDays(nDays, seed) {
  const r = K.rng(seed); const out = []; let p = 100;
  const t0 = S.utcOf(D - 3, 0), t1 = S.utcOf(D + nDays, 17 * 60);
  for (let t = t0; t < t1; t += 300) {
    const wd = new Date(S.dayOf(t) * 86400e3).getUTCDay(); if (wd === 6 || (wd === 0 && S.minOf(t) < 18 * 60)) continue;
    const m = S.minOf(t); const v = m >= 1200 ? 0.3 : (m >= 120 && m < 300) || (m >= 540 && m < 660) ? 0.2 : 0.08;
    const o = p, c = o + (100 - o) * 0.03 + (r() - 0.5) * 2 * v; out.push(mk(t, o, c, 0, Math.max(o, c) + r() * v, Math.min(o, c) - r() * v)); p = c;
  }
  return out;
}

test('seeded walks: signals are not moved by later candles, stops are on the losing side', () => {
  let found = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const B = walkDays(160, seed);
    for (let d = D; d < D + 160; d++) {
      const wd = new Date(d * 86400e3).getUTCDay(); if (wd === 0 || wd === 6) continue;
      const a0 = S.utcOf(d, 0) - 72 * 3600, a1 = S.utcOf(d, 16 * 60) + 300;
      const slice = B.filter((b) => b.t >= a0 && b.t < a1);
      const r = S.dayTrade(slice, d, 0.02);
      if (!r.trade) continue;
      found++;
      const x = r.trade;
      assert.ok(x.side * (x.entry - x.stop) > 0, 'stop on the losing side');
      assert.ok(x.side * (x.target - x.entry) >= x.side * (x.entry - x.stop), 'target at least 1R');
      const win = x.win === 'london' ? S.P.london : S.P.ny;
      const A = cutAndChange(slice, x.sig.t);
      assert.deepEqual(S.windowSignal(A, K.qms(A, 3), d, win, S.asiaRange(A, d)).sig, x.sig);
      assert.ok(x.sim.exitT <= a1, 'out by the 16:00 candle close');
    }
  }
  assert.ok(found >= 3, 'the walks give trades: ' + found);
});

test('result.json says what RESULT.md says, and every stored trade has its stop on the losing side', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/session-sweep/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/session-sweep/RESULT.md', import.meta.url), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.match(md.split('\n').slice(0, 6).join('\n'), new RegExp('\\*\\*' + R.verdict + '\\*\\*'));
  const o = R.tests.P.net.OOS;
  assert.ok(md.includes(String(o.n)), 'OOS n in the report');
  assert.ok(md.includes(o.meanR.toFixed(3).replace('-', '−')) || md.includes(o.meanR.toFixed(3)), 'OOS mean in the report');
  assert.ok(md.includes(o.tMonth.toFixed(2).replace('-', '−')) || md.includes(o.tMonth.toFixed(2)), 'OOS month t in the report');
  const T = JSON.parse(fs.readFileSync(new URL('../research/edge/session-sweep/trades.json', import.meta.url)));
  assert.equal(T.length, R.tests.P.net.all.n);
  for (const x of T) assert.ok(x.side * (x.entry - x.stop) > 0, 'stop on the losing side: ' + x.date);
});
