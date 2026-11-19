// research/edge/yield-fx-weekly: signal sign, no look-ahead, the stop, costs, and the report against result.json. Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bondWeeks, trade, stream, PAIRS, P, tradingCost, finR, bars } from '../research/edge/yield-fx-weekly/run.mjs';

const DIR = new URL('../research/edge/yield-fx-weekly/', import.meta.url);
const D = 86400;
const MON = Date.UTC(2020, 0, 6) / 1000;   // a Monday
// weekday candles only, flat price p except where f(i) says otherwise
function series(nWeeks, f) {
  const out = []; let i = 0;
  for (let w = 0; w < nWeeks; w++) for (let d = 0; d < 5; d++) {
    const t = MON + (w * 7 + d) * D, c = f(i, t); out.push({ time: t, open: c, high: c + 0.1, low: c - 0.1, close: c }); i++;
  }
  return out;
}
// a bond whose weekly returns alternate +-0.1 % and whose last week does `last`
function bond(last) {
  let px = 100; const B = series(60, (i) => { if (i % 5 === 0 && i > 0) px *= (Math.floor(i / 5) % 2 ? 1.001 : 0.999); return px; });
  const n = B.length; for (let k = n - 4; k < n; k++) B[k] = { ...B[k], close: B[n - 6].close * (1 + last), open: B[n - 6].close * (1 + last) };
  return B;
}

test('sign convention: the bond price falls = yields up = buy USD; rises = sell USD', () => {
  const up = bondWeeks(bond(-0.01)).at(-1), dn = bondWeeks(bond(+0.01)).at(-1), flat = bondWeeks(bond(0.0000001)).at(-1);
  assert.equal(new Date(up.t * 1000).getUTCDay(), 5);
  assert.ok(up.sd > 0);
  assert.equal(up.dir, 1, 'bond down -> yields up -> buy USD');
  assert.equal(dn.dir, -1, 'bond up -> yields down -> sell USD');
  assert.equal(flat.dir, 0, 'inside 0.5 sd -> flat');
  // buying USD: long USD/JPY and USD/CHF, SHORT EUR/USD
  assert.equal(PAIRS.T1.usdSide, 1); assert.equal(PAIRS.T2.usdSide, 1); assert.equal(PAIRS.T3.usdSide, -1);
});

test('no look-ahead: the signal reads nothing after its Friday, its own return is not in its threshold', () => {
  const B = bond(-0.01), W = bondWeeks(B), last = W.at(-1);
  const B2 = B.concat(series(2, () => 5).map((b) => ({ ...b, time: b.time + 60 * 7 * D })));
  const W2 = bondWeeks(B2), same = W2.find((w) => w.t === last.t);
  assert.deepEqual(same, last);
  // a huge return in the current week does not change its own sd
  const big = bondWeeks(bond(-0.5)).at(-1);
  assert.equal(big.sd, last.sd);
  // the entry is the NEXT candle's open, never the signal candle
  const X = series(7, (i) => 100 + i * 0.01), i = 24;
  const tr = trade(X, i, 1, PAIRS.T2);
  assert.equal(tr.entryT, X[i + 1].time); assert.equal(tr.entry, X[i + 1].open);
  assert.equal(tr.exitT, X[i + P.hold].time);
  // changing a candle after the exit changes nothing
  const Y = X.map((b) => ({ ...b })); Y[i + P.hold + 1].close = 999;
  assert.deepEqual(trade(Y, i, 1, PAIRS.T2), tr);
});

test('the stop: 2 x ATR(20), every trade has one on the losing side, a gap fills at the open', () => {
  const X = series(6, () => 100), i = 24;
  const tr = trade(X, i, 1, PAIRS.T2);
  assert.ok(Math.abs(tr.dist - 2 * 0.2) < 1e-12); assert.ok(tr.stop < tr.entry);
  assert.ok(trade(X, i, -1, PAIRS.T2).stop > tr.entry);
  const G = X.map((b) => ({ ...b })); G[i + 2] = { ...G[i + 2], open: 99, high: 99.1, low: 98.9, close: 99 };
  const g = trade(G, i, 1, PAIRS.T2);
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 99); assert.ok(g.R < -1);
  const S = X.map((b) => ({ ...b })); S[i + 3] = { ...S[i + 3], low: 99.5 };
  const s = trade(S, i, 1, PAIRS.T2);
  assert.equal(s.how, 'stop'); assert.ok(Math.abs(s.R + 1) < 1e-9);
  assert.equal(trade(X, 10, 1, PAIRS.T2), null, 'fewer than 20 candles: no ATR, no trade');
});

test('costs: raw-spread model and financing signs', () => {
  assert.ok(Math.abs(tradingCost(PAIRS.T3, 1.1) - (0.6e-4 + 4.5e-5 * 1.1)) < 1e-15);
  assert.ok(Math.abs(tradingCost(PAIRS.T1, 150, 2) - 2 * (0.006 + 4.5e-5 * 150)) < 1e-12);
  assert.ok(finR(PAIRS.T3, -1, 6, 0.01) > 0, 'short EUR/USD is credited');
  assert.ok(finR(PAIRS.T3, 1, 6, 0.01) < 0);
  assert.equal(finR(PAIRS.T3, -1, 6, 0.01, '2x'), 0, '2x drops credits');
  assert.equal(finR(PAIRS.T2, -1, 6, 0.01, '2x'), 2 * finR(PAIRS.T2, -1, 6, 0.01));
  // a Monday-Friday time exit holds Mon, Tue, Wed (x3), Thu rollovers
  const X = series(6, () => 100); assert.equal(trade(X, 24, 1, PAIRS.T2).nights, 6);
  // weekend fold: a Sunday candle becomes the Monday open
  const F = bars([[MON - D, 1, 2, 0.5, 1.5, 0], [MON, 1.6, 1.8, 1.4, 1.7, 0]]);
  assert.equal(F.length, 1); assert.equal(F[0].open, 1); assert.equal(F[0].low, 0.5);
  // one position at a time
  const X8 = series(8, () => 100);
  const T = stream(X8, [{ t: X8[24].time, usd: 1 }, { t: X8[25].time, usd: 1 }, { t: X8[29].time, usd: 1 }], PAIRS.T2);
  assert.equal(T.length, 2);
});

test('report agrees with result.json, verdict first, no pass claimed', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.match(md.split('\n')[0], /^\*\*Verdict:\*\* FAIL/);
  assert.equal(R.passCount, 0);
  assert.match(R.verdict, /^FAIL, 0 of 3/);
  for (const [k, o] of Object.entries(R.tests)) {
    assert.equal(o.pass, false);
    for (const w of ['decisive', 'replication']) {
      const s = o.windows[w], f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
      const row = `| ${k} | ${w} | ${s.n} | ${f(s.grossAvg)} | ${f(s.avg)} | ${s.t.toFixed(2)} |`;
      assert.ok(md.includes(row), `RESULT.md row ${row}`);
    }
    assert.ok(md.includes(`| ${k} | ${f3(o.windows.decisive.avg)} | ${f3(o.placebo.median)} | ${f3(o.placebo.p95)} |`), `placebo row ${k}`);
  }
  const fs0 = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(fs0, /Written and committed \*\*alone, before any price was read\*\*/);
});
function f3(x) { return (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3); }
