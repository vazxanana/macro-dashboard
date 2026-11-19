// Weekly crypto momentum study: no look-ahead in the signal, vol sizing, the stop, Holm, and RESULT.md against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, weekSignal, sideOf, weightOf, ewmaVol, simWeek, book, holm, atr } from '../research/edge/crypto-weekly-mom/run.mjs';

const T0 = Date.UTC(2024, 0, 1) / 1000;   // a Monday
const mk = (n, f) => Array.from({ length: n }, (_, i) => { const c = f(i); return { time: T0 + i * 86400, open: c, high: c * 1.01, low: c * 0.99, close: c }; });

test('pre-registered numbers', () => {
  assert.equal(P.volTarget, 0.4); assert.equal(P.cap, 2); assert.equal(P.span, 30); assert.equal(P.atrK, 3); assert.equal(P.atrN, 14);
  assert.equal(P.cost, 0.0004); assert.equal(P.fin.btc.long, 0.15); assert.equal(P.seeds, 40);
});

test('the weekly signal uses only Sunday and the previous Sunday closes (no look-ahead)', () => {
  const D = mk(40, (i) => 100 + i);
  const iMon = 21;   // Monday
  assert.equal(new Date(D[iMon].time * 1000).getUTCDay(), 1);
  const s = weekSignal(D, iMon);
  assert.ok(Math.abs(s - (D[20].close / D[13].close - 1)) < 1e-12);
  const E = D.map((b) => ({ ...b })); for (let k = iMon; k < E.length; k++) { E[k].close = 1; E[k].open = 1; E[k].high = 1; E[k].low = 1; }
  assert.equal(weekSignal(E, iMon), s, 'changing the Monday candle and later never changes the signal');
  assert.equal(sideOf(0.01, 'V1'), 1); assert.equal(sideOf(-0.01, 'V1'), 0); assert.equal(sideOf(-0.01, 'V2'), -1); assert.equal(sideOf(0, 'V2'), 0);
});

test('vol sizing: 40 % target, capped at 2; EWMA reads only closed candles', () => {
  assert.equal(weightOf(0.8), 0.5); assert.equal(weightOf(0.1), 2); assert.equal(weightOf(0), 0);
  const D = mk(80, (i) => 100 * (1 + 0.02 * Math.sin(i)));
  const v = ewmaVol(D), E = D.map((b, i) => (i > 50 ? { ...b, close: b.close * 3 } : b));
  assert.equal(ewmaVol(E)[50], v[50]); assert.equal(v[29], null); assert.ok(v[30] > 0);
});

test('every position has a stop 3 ATR away and exits there, at the open when gapped', () => {
  const D = mk(40, () => 100);
  const a = atr(D, 20); assert.ok(a > 0);
  const L = simWeek(D, 21, 1, 3 * a); assert.ok(L.stop < L.entry); assert.equal(L.stopped, false); assert.equal(L.nights, 7);
  const S = simWeek(D, 21, -1, 3 * a); assert.ok(S.stop > S.entry);
  const G = D.map((b) => ({ ...b })); G[23] = { ...G[23], open: 90, high: 91, low: 89, close: 90 };
  const g = simWeek(G, 21, 1, 2); assert.equal(g.stopped, true); assert.equal(g.exit, 90); assert.equal(g.nights, 2);
  const H = D.map((b) => ({ ...b })); H[22] = { ...H[22], low: 97 };
  const h = simWeek(H, 21, 1, 2); assert.equal(h.exit, 98); assert.equal(h.nights, 1);
});

test('the book charges costs and financing on held weeks only', () => {
  const up = mk(140, (i) => 100 * 1.003 ** i);
  const W = book({ btc: up }, 'V1');
  assert.ok(W.length > 5);
  for (const w of W) { const x = w.coins.btc; if (x.side) assert.ok(w.ret < w.gross && w.fin > 0 && w.cost > 0); else assert.equal(w.ret, 0); }
});

test('Holm', () => { assert.deepEqual(holm([0.2206, 0.305]).map((x) => +x.toFixed(4)), [0.4412, 0.4412]); assert.deepEqual(holm([0.01, 0.5]), [0.02, 0.5]); });

test('RESULT.md says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/crypto-weekly-mom/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/crypto-weekly-mom/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL, 0 of 2\.\*\*/);
  const pct = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' %';
  for (const v of ['V1', 'V2']) {
    const d = r.variants[v].decisive, pl = r.variants[v].placebo;
    assert.equal(r.tests[v].pass, false);
    assert.ok(md.includes(`| ${pct(d.ann)} | ${(d.vol * 100).toFixed(1)} % | ${d.sharpe.toFixed(3)} | ${d.monthT.toFixed(2)} | ${(d.maxDD * 100).toFixed(1)} % | ${r.tests[v].pHolm.toFixed(3)} | ${pl.beats} of 40 |`), v);
  }
  const b = r.bh.decisive;
  assert.ok(md.includes(`| ${pct(b.ann)} | ${(b.vol * 100).toFixed(1)} % | ${b.sharpe.toFixed(3)} | ${b.monthT.toFixed(2)} |`));
  assert.equal(r.variants.V1.decisive.weeks, 251); assert.ok(md.includes('251 full weeks'));
  assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-crypto-weekly.md', import.meta.url)), 'no proposal on a FAIL');
});
