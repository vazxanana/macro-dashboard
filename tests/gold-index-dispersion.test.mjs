// research/edge/gold-index-dispersion: dispersion, events, the trade on hand-made candles, no look-ahead, and the report
// against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { returnsOf, dispersion, eventFlags, trade, oneAtATime, baseline, monthT, holm, COST, LOOK, INDICES } from '../research/edge/gold-index-dispersion/run.mjs';

const dir = new URL('../research/edge/gold-index-dispersion/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');

// hand-made weekday candles from 2024-01-01
function bars(n, f) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000;
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w < 6) out.push(f(out.length, t)); t += 86400; } return out; }

test('dispersion: sample sd across markets, at least 10 markets, gaps over 5 days ignored', () => {
  const g = bars(3, (i, t) => ({ time: t, open: 1, high: 1, low: 1, close: 1 }));
  const mk = (k) => returnsOf(bars(3, (i, t) => ({ time: t, open: 1, high: 1, low: 1, close: Math.exp(i * k) })));
  const rets = Array.from({ length: 10 }, (_, k) => mk(k * 0.01));
  const d = dispersion(g, rets);
  assert.equal(d[0], null);                                  // no previous candle -> no return
  const v = Array.from({ length: 10 }, (_, k) => k * 0.01), mu = v.reduce((a, b) => a + b) / 10;
  assert.ok(Math.abs(d[1] - Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / 9)) < 1e-12);
  assert.equal(dispersion(g, rets.slice(0, 9))[1], null);    // 9 markets: no reading
  const gap = returnsOf([{ time: 0, close: 1 }, { time: 6 * 86400, close: 2 }]);
  assert.equal(gap.size, 0);
  assert.equal(INDICES.length, 13);
});

test('events: above the 90th point of the 250 earlier readings, and later readings never change an earlier flag', () => {
  const disp = Array.from({ length: 400 }, (_, i) => (i * 7919 % 251) / 251);
  disp[300] = 5; disp[301] = null;
  const f = eventFlags(disp);
  assert.equal(f.slice(0, LOOK).some(Boolean), false);
  assert.equal(f[300], true); assert.equal(f[301], false);
  const later = disp.map((v, i) => i > 320 ? 99 : v), g = eventFlags(later);
  assert.deepEqual(g.slice(0, 321), f.slice(0, 321));
});

test('trade: R, stop, costs, financing, one at a time, baseline by year', () => {
  const b = bars(40, (i, t) => ({ time: t, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i }));   // ATR 2, risk 4
  const L = trade(b, 25, 5);
  assert.equal(L.risk, 4); assert.equal(L.R, 5 / 4); assert.ok(L.fin > 0);
  assert.ok(Math.abs(L.net - (L.R - COST / 4 - L.fin)) < 1e-12);
  const d = bars(40, (i, t) => ({ time: t, open: 100, high: 101, low: i === 27 ? 90 : 99, close: 100 }));
  const S = trade(d, 25, 5); assert.equal(S.how, 'stop'); assert.equal(S.R, -1);
  assert.deepEqual(oneAtATime(b, [21, 23, 26, 27], 5).map((x) => x.i), [21, 27]);
  const base = baseline(b, 1); assert.ok(base.has('2024'));
});

test('no look-ahead: candles after the exit do not move a trade', () => {
  const f = (i, t) => ({ time: t, open: 100 + Math.sin(i), high: 102 + Math.sin(i), low: 98 + Math.sin(i), close: 100 + Math.cos(i) });
  const a = bars(60, f), b = a.map((x, i) => i > 30 ? { ...x, open: 999, high: 1999, low: 1, close: 500 } : x);
  assert.deepEqual(trade(a, 25, 5), trade(b, 25, 5));
});

test('statistics: month sums and Holm', () => {
  const T = [{ a: '2020-01-02', ex: 1 }, { a: '2020-01-09', ex: 1 }, { a: '2020-02-03', ex: 1 }, { a: '2020-03-03', ex: 3 }];
  const m = monthT(T, 'ex'); assert.equal(m.months, 3); assert.ok(m.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report matches result.json, verdict line, market set as pre-registered', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []);
  const line = MD.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.ok(line.length < 220, line);
  const T1 = R.tests.T1;
  assert.ok(line.includes(T1.oos.excess.toFixed(3)) && line.includes(`n ${T1.oos.n}`) && line.includes(T1.oos.tExcess.toFixed(2)));
  const sign = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) { const r = R.tests[k];
    for (const w of ['oos', 'is']) { const x = r[w];
      assert.ok(MD.includes(`| ${x.n} | ${sign(x.excess)} | ${x.tExcess.toFixed(2)} | ${sign(x.net)} | ${x.tNet.toFixed(2)} | ${sign(x.gross)} | ${x.tGross.toFixed(2)} |`), `${k} ${w}`); }
    assert.ok(MD.includes(`| ${r.placebo.beaten} |`), `${k} placebo`);
    assert.equal(r.pass, false);
    assert.ok(r.is.n >= 100 && r.oos.n >= 100, `${k} n`); }
  for (const k of R.data.markets) assert.ok(PRE.includes(k), k);
});
