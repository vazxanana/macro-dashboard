// gold-rsi-divergence: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rsi, atr, isPivot, signals, sim, stream, buildH4, dropSunday, monthT, holm, headline, report, P } from '../research/edge/gold-rsi-divergence/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'gold-rsi-divergence');
const H4 = 14400, T0 = Date.UTC(2020, 0, 6) / 1000;
// candles from a list of closes: open = previous close, high / low 0.5 around the body
const mk = (cl) => cl.map((c, i) => { const o = i ? cl[i - 1] : c; return { t: T0 + i * H4, o, h: Math.max(o, c) + 0.5, l: Math.min(o, c) - 0.5, c }; });
// a strong rally to a first high (bar ~40), a pullback, then a slower rise to a slightly higher high (weak RSI), then a fall
function divergencePath() {
  const cl = []; let p = 1000;
  for (let i = 0; i < 20; i++) cl.push(p += 0.1 * ((i % 2) ? 1 : -1));
  for (let i = 0; i < 20; i++) cl.push(p += 4);            // fast rally: RSI high
  for (let i = 0; i < 8; i++) cl.push(p -= 5);             // pullback
  for (let i = 0; i < 18; i++) cl.push(p += 2.5);          // slower rise to a slightly higher high (weaker RSI)
  for (let i = 0; i < 40; i++) cl.push(p -= 3);            // fall
  return mk(cl);
}

test('indicators: RSI 100 on a straight rise, ATR the true range, nothing before the warm-up', () => {
  const B = mk(Array.from({ length: 30 }, (_, i) => 100 + i));
  const R = rsi(B), A = atr(B);
  assert.equal(R[13], null); assert.equal(R[14], 100); assert.equal(R[29], 100);
  assert.equal(A[13], null); assert.ok(Math.abs(A[20] - 2) < 1e-9);
});

test('pivot: strict on the left, equal allowed on the right, needs 3 bars each side', () => {
  const B = mk([1, 2, 3, 10, 3, 2, 1, 0]); B[4].h = B[3].h;
  assert.equal(isPivot(B, 3, true), true);
  B[2].h = B[3].h; assert.equal(isPivot(B, 3, true), false);
  assert.equal(isPivot(B, 6, true), false);
});

test('a bearish divergence is found at its confirmation bar, and later candles never change it', () => {
  const B = divergencePath(), R = rsi(B), A = atr(B);
  const sell = signals(B, R, A).filter((s) => s.side === -1);
  assert.ok(sell.length >= 1, 'a sell signal');
  const s = sell[0];
  assert.equal(s.c, s.j + P.PIV);
  assert.ok(B[s.j].h > B[s.k].h && R[s.j] < R[s.k] && R[s.k] >= P.RSI_HI);
  assert.ok(s.j - s.k >= P.MIN_BACK && s.j - s.k <= P.MAX_BACK);
  // no look-ahead: rewrite every candle after the confirmation bar, the signal stays
  const B2 = B.map((b, i) => (i > s.c ? { ...b, o: 5000, h: 5001, l: 4999, c: 5000 } : b));
  const sell2 = signals(B2, rsi(B2), atr(B2)).filter((x) => x.side === -1 && x.c === s.c);
  assert.equal(sell2.length, 1); assert.equal(sell2[0].j, s.j); assert.equal(sell2[0].k, s.k);
  // the trade: sell at the next open, stop 0.25 ATR over the pivot, target 2R, the fall reaches the target
  const r = sim(B, A, s, H4);
  assert.equal(r.side, -1); assert.equal(r.E, B[s.c + 1].o);
  assert.ok(Math.abs(r.stop - (B[s.j].h + P.BUF * A[s.c])) < 1e-9);
  assert.equal(r.why, 'target'); assert.ok(Math.abs(r.gross - 2) < 1e-9);
  assert.equal(r.nights, 0); assert.ok(Math.abs(r.net - (2 - P.COST / r.r0)) < 1e-9);
});

test('exits: stop first when one bar holds both, a gapped stop fills at the open, buys pay financing', () => {
  const B = mk(Array.from({ length: 40 }, () => 100)), A = B.map(() => 1);
  B[11] = { ...B[11], h: 110, l: 90 };  // entry bar 11 holds both stop and target
  let r = sim(B, A, { c: 10, side: 1, dist: 2 }, H4);
  assert.equal(r.why, 'stop'); assert.ok(Math.abs(r.gross + 1) < 1e-9);
  const C = mk(Array.from({ length: 40 }, () => 100)); C[12] = { ...C[12], o: 95, h: 95.5, l: 94, c: 95 };
  r = sim(C, A, { c: 10, side: 1, dist: 2 }, H4);
  assert.equal(r.why, 'stop'); assert.equal(r.px, 95); assert.ok(r.gross < -1);
  r = sim(mk(Array.from({ length: 60 }, () => 100)), A.concat(A), { c: 10, side: 1, dist: 2 }, H4);
  assert.equal(r.why, 'time'); assert.ok(r.nights > 0 && r.fin > 0 && r.net < r.gross - P.COST / r.r0);
  const sh = sim(mk(Array.from({ length: 60 }, () => 100)), A.concat(A), { c: 10, side: -1, dist: 2 }, H4);
  assert.equal(sh.fin, 0);
});

test('one position at a time, H4 buckets, Sunday stub dropped', () => {
  const B = mk(Array.from({ length: 80 }, () => 100)), A = B.map(() => 1);
  const { trades, funnel } = stream(B, A, [{ c: 5, side: 1, dist: 2 }, { c: 10, side: 1, dist: 2 }, { c: 40, side: -1, dist: 2 }], H4);
  assert.equal(trades.length, 2); assert.equal(funnel.busy, 1);
  const sun = Date.UTC(2020, 0, 5, 22) / 1000, mon = Date.UTC(2020, 0, 6, 0) / 1000;
  const rows = dropSunday([[sun, 1, 2, 0, 1], [mon, 1, 3, 1, 2], [mon + 3600, 2, 4, 2, 3], [mon + 4 * 3600, 3, 3, 3, 3]]);
  assert.equal(rows.length, 3);
  const h4 = buildH4(rows); assert.equal(h4.length, 2); assert.deepEqual(h4[0], { t: mon, o: 1, h: 4, l: 1, c: 3 });
});

test('statistics helpers', () => {
  const t = monthT([{ te: T0, net: 1 }, { te: T0 + 40 * 86400, net: 2 }, { te: T0 + 80 * 86400, net: 3 }]);
  assert.equal(t.months, 3); assert.ok(t.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report and result.json agree', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(res.headline, headline(res));
  assert.ok(res.headline.length < 220);
  assert.equal(md, report(res, res.built));
  assert.ok(md.includes(res.headline));
  assert.equal(res.verdict, res.tests.T1.pass ? 'PASS' : 'FAIL');
  for (const k of ['T1', 'T2', 'T3']) {
    const x = res.tests[k];
    assert.equal(x.placebo.seeds, 40);
    assert.equal(x.pass, Object.values(x.checks).every(Boolean));
    assert.equal(x.is.n + x.oos.n, x.trades.length);
  }
  assert.match(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8'), /pushed alone/);
});
