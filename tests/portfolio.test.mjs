// node --test tests/portfolio.test.mjs — research/portfolio.mjs (combined Meridian + ICT book: sizing, correlation, drawdowns, Monte Carlo)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normIct, normMeridianBacktest, normMeridianLive, applyScheme, dailyPnl, equityOf, drawdowns, metrics, corr, dailyR,
  indexPairs, exposure, monteCarlo, scaleFor, priceCorr, runStudy, ICT_COST_PTS, dayOf,
} from '../research/portfolio.mjs';

const T0 = Date.parse('2026-01-05T00:00:00Z') / 1000, H = 3600, D = 86400;
const tr = (o) => ({ sys: 'ict', mkt: 'nq', side: 1, size: 1, tier: 'A+', r0: 100, ...o });

test('loaders: ICT uses the per-unit R net of the micro round trip; Meridian keeps one rule and nets the cost', () => {
  const replay = { trades: [
    { id: 'a', market: 'nq', side: 'buy', opened: T0, closed: T0 + H, R: 3, Rraw: 2, size: 1.5, r0: 137, aset: true, aplus: true },
    { id: 'b', market: 'es', side: 'sell', opened: T0, closed: T0 + H, R: -1, size: 1, r0: 20, aset: true, aplus: false },
    { id: 'c', market: 'es', side: 'sell', opened: T0, closed: T0 + H, R: 1, size: 1, r0: 20, aset: false },
    { id: 'd', market: 'es', side: 'sell', opened: T0, closed: null, R: null, size: 1, r0: 20, aset: true }] };
  const I = normIct(replay);
  assert.equal(I.length, 2, 'only closed A-setups');
  assert.ok(Math.abs(I[0].R - (2 - ICT_COST_PTS.nq / 137)) < 1e-9); assert.equal(I[0].size, 1.5); assert.equal(I[0].tier, 'A+');
  assert.equal(I[1].side, -1); assert.equal(I[1].tier, 'A');
  assert.equal(normIct(replay, { aOnly: false }).length, 3);
  const cols = ['market', 'setup', 'side', 'opened', 'filled', 'rr', 'd1', 'struct', 'session', 'R_none', 'R_be1', 'R_be15', 'R_tp2', 'mfe', 'cost', 'fill', 'cf', 'choch', 'm15c', 'm15c1', 'status'];
  const row = (m, k, d1, ses, R, cost, st = 'closed') => [m, k, 'buy', T0, T0 + 60, 2, d1, 'n/a', ses, R, R, R, R, 1, cost, 1, 'bo', 'no', 'no', 'no', st];
  const bt = { tradeCols: cols, trades: [row('xau', 'scalp', 'against', 'london', 2, 0.05), row('xau', 'scalp', 'with', 'london', 2, 0.05), row('xau', 'scalp', 'against', 'asia', 2, 0.05),
    row('btc', 'scalp', 'against', 'london', 2, 2), row('eurusd', 'scalp@mkt', 'against', 'london', 2, 0.1), row('eurusd', 'scalp', 'against', 'newyork', -1, 0.1, 'open')] };
  const M = normMeridianBacktest(bt);
  assert.equal(M.length, 1); assert.equal(M[0].R, 1.95); assert.ok(Math.abs(M[0].r0 - 6) < 1e-9, 'gold r0 = 0.3 / cost'); assert.equal(M[0].close, T0 + 60 + 4500);
  assert.equal(normMeridianBacktest(bt, { markets: null }).length, 2, 'crypto only with markets: null');
  const L = normMeridianLive([{ id: 'x', market: 'xau', shadow: false, status: 'win', R: 2, size: 2, opened: T0, filled: T0 + 5, closed: T0 + H, side: 'buy', entry: 10, stop: 9 },
    { id: 'y', market: 'xau', shadow: true, status: 'win', R: 2, opened: T0, closed: T0 + H }, { id: 'z', market: 'xau', shadow: false, status: 'open', R: null, opened: T0 }]);
  assert.equal(L.length, 1); assert.equal(L[0].R, 1); assert.equal(L[0].open, T0 + 5);
});

test('daily P&L books on the close day; equity compounds; drawdown, worst month and worst day', () => {
  const S = [tr({ open: T0, close: T0 + H, R: 2, risk: 0.01 }), tr({ open: T0 + D, close: T0 + D + H, R: -1, risk: 0.01 }), tr({ open: T0 + 2 * D, close: T0 + 2 * D + H, R: -1, risk: 0.01 }),
    tr({ open: T0 + 40 * D, close: T0 + 40 * D + H, R: 3, risk: 0.01 })];
  const daily = dailyPnl(S, dayOf(T0), dayOf(T0 + 45 * D));
  assert.equal(daily.length, 46); assert.equal(daily[0].p, 0.02); assert.equal(daily[1].p, -0.01);
  const eq = equityOf(daily); assert.ok(Math.abs(eq[0].e - 1.02) < 1e-12); assert.ok(Math.abs(eq[2].e - 1.02 * 0.99 * 0.99) < 1e-12);
  const dd = drawdowns(eq); assert.equal(dd.length, 1); assert.ok(Math.abs(dd[0].depth - (1 - 0.99 * 0.99)) < 1e-12); assert.equal(dd[0].peak, dayOf(T0)); assert.equal(dd[0].recovered, dayOf(T0 + 40 * D));
  const m = metrics(daily);
  assert.ok(Math.abs(m.maxDD - (1 - 0.9801)) < 1e-12); assert.equal(m.worstDay, -0.01); assert.equal(m.daysBelow2, 0);
  assert.equal(m.worstMonthAt, '2026-01'); assert.ok(m.retDD > 0);
});

test('fixed, size field and grade tier sizing', () => {
  const B = [tr({ open: T0, close: T0 + H, R: 1, size: 1.5, tier: 'A+' }), tr({ open: T0 + D, close: T0 + D + H, R: 1, size: 0.5, tier: 'A' }), tr({ sys: 'mer', mkt: 'xau', open: T0 + 2 * D, close: T0 + 2 * D + H, R: 1, size: 1 })];
  assert.deepEqual(applyScheme(B, { base: 0.005 }).map((t) => t.risk), [0.005, 0.005, 0.005]);
  assert.deepEqual(applyScheme(B, { base: 0.005, sizeBy: 'size' }).map((t) => +t.risk.toFixed(6)), [0.0075, 0.0025, 0.005]);
  assert.deepEqual(applyScheme(B, { base: 0.005, sizeBy: 'tier', aSize: 0.5 }).map((t) => +t.risk.toFixed(6)), [0.005, 0.0025, 0.005]);
  assert.deepEqual(applyScheme(B, { base: 0.005, sysMult: { mer: 0.1 } }).map((t) => +t.risk.toFixed(6)), [0.005, 0.005, 0.0005]);
});

test('index cap blocks the (N+1)-th same-direction index position; opposite side and gold are not counted; split shrinks it', () => {
  const B = [tr({ id: 1, mkt: 'nq', open: T0, close: T0 + 10 * H, R: -1 }), tr({ id: 2, mkt: 'es', open: T0 + H, close: T0 + 9 * H, R: -1 }),
    tr({ id: 3, mkt: 'ym', open: T0 + 2 * H, close: T0 + 9 * H, R: -1 }), tr({ id: 4, mkt: 'rty', side: -1, open: T0 + 2 * H, close: T0 + 9 * H, R: 1 }),
    tr({ id: 5, mkt: 'gc', open: T0 + 3 * H, close: T0 + 9 * H, R: 1 }), tr({ id: 6, mkt: 'es', open: T0 + 11 * H, close: T0 + 12 * H, R: 1 })];
  const c1 = applyScheme(B, { base: 0.01, cap: 1 });
  assert.deepEqual(c1.map((t) => t.skip), [false, true, true, false, false, false]);
  const c2 = applyScheme(B, { base: 0.01, cap: 2 });
  assert.deepEqual(c2.map((t) => t.skip), [false, false, true, false, false, false]);
  const sp = applyScheme(B, { base: 0.01, split: true });
  assert.deepEqual(sp.map((t) => +t.risk.toFixed(6)), [0.01, 0.005, +(0.01 / 3).toFixed(6), 0.01, 0.01, 0.01]);
});

test('volatility targeting uses only past days and scales risk to target / daily RMS', () => {
  const B = []; for (let i = 0; i < 12; i++) B.push(tr({ open: T0 + i * D, close: T0 + i * D + H, R: i % 2 ? 2 : -2 }));
  B.push(tr({ open: T0 + 12 * D, close: T0 + 12 * D + H, R: 5 }));
  const v = applyScheme(B, { vol: { target: 0.005, minDays: 10, warm: 0.001, max: 0.01 } });
  assert.equal(v[5].risk, 0.001, 'warm-up before 10 past days');
  assert.ok(Math.abs(v[12].risk - 0.005 / 2) < 1e-12, 'daily RMS 2R -> 0.25% per R');
});

test('fractional Kelly: zero for a losing stream, capped for a strong one, probe size before enough history', () => {
  const B = [];
  for (let i = 0; i < 30; i++) B.push(tr({ mkt: 'es', open: T0 + i * D, close: T0 + i * D + H, R: i % 3 === 0 ? -1 : 2 }));
  for (let i = 0; i < 30; i++) B.push(tr({ sys: 'mer', mkt: 'eurusd', open: T0 + i * D + 2 * H, close: T0 + i * D + 3 * H, R: i % 4 === 0 ? 1 : -1 }));
  const k = applyScheme(B, { kelly: { frac: 0.25, cap: 0.005, minN: 20, probe: 0.001 } });
  const es = k.filter((t) => t.mkt === 'es'), fx = k.filter((t) => t.mkt === 'eurusd');
  assert.equal(es[3].risk, 0.001); assert.equal(es[25].risk, 0.005, 'quarter Kelly of a +1R/trade stream is far above the cap');
  assert.equal(fx[25].risk, 0, 'negative expectancy -> no risk');
});

test('mirror-as-coded lots: risk = stop x $ per point at 0.01 lot / balance', () => {
  const k = applyScheme([tr({ mkt: 'gc', r0: 35, open: T0, close: T0 + H, R: 1 }), tr({ sys: 'mer', mkt: 'eurusd', r0: 0.001, open: T0, close: T0 + H, R: 1 })], { lots: { balance: 1000, lots: 0.01 } });
  assert.ok(Math.abs(k[0].risk - 0.035) < 1e-12); assert.ok(Math.abs(k[1].risk - 0.001) < 1e-12);
});

test('correlation helpers', () => {
  assert.ok(Math.abs(corr([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12); assert.ok(Math.abs(corr([1, 2, 3, 4], [4, 3, 2, 1]) + 1) < 1e-12); assert.equal(corr([1, 1, 1], [1, 2, 3]), null);
  const B = [tr({ mkt: 'nq', open: T0, close: T0 + H, R: 1 }), tr({ mkt: 'es', open: T0, close: T0 + H, R: 2 }), tr({ mkt: 'nq', open: T0 + D, close: T0 + D + H, R: -1 })];
  const r = dailyR(B, dayOf(T0), dayOf(T0 + 2 * D), (t) => t.mkt);
  assert.deepEqual(r.series.nq, [1, -1, 0]); assert.deepEqual(r.series.es, [2, 0, 0]);
  const P = indexPairs([tr({ mkt: 'nq', open: T0, close: T0 + 5 * H, R: -1 }), tr({ mkt: 'es', open: T0 + H, close: T0 + 4 * H, R: -1 }), tr({ mkt: 'ym', side: -1, open: T0 + H, close: T0 + 4 * H, R: 1 }),
    tr({ mkt: 'es', open: T0 + 10 * H, close: T0 + 11 * H, R: 1 })]);
  assert.equal(P.pairs, 1); assert.equal(P.pLossGivenLoss, 1); assert.equal(P.within1h, 1);
  const pc = priceCorr({ a: { d1: [[T0, 0, 0, 0, 100], [T0 + D, 0, 0, 0, 101], [T0 + 2 * D, 0, 0, 0, 100], [T0 + 3 * D, 0, 0, 0, 102]] },
    b: { d1: [[T0, 0, 0, 0, 50], [T0 + D, 0, 0, 0, 50.5], [T0 + 2 * D, 0, 0, 0, 50], [T0 + 3 * D, 0, 0, 0, 51]] } });
  assert.equal(pc.matrix.a.b, 1);
});

test('exposure counts open positions, arrivals at the open-position limit and same-direction index clusters', () => {
  const B = [tr({ mkt: 'nq', open: T0, close: T0 + 10 * H, R: -1 }), tr({ mkt: 'es', open: T0 + H, close: T0 + 10 * H, R: -1 }), tr({ mkt: 'ym', open: T0 + 2 * H, close: T0 + 10 * H, R: -1 }),
    tr({ sys: 'mer', mkt: 'xau', open: T0 + 3 * H, close: T0 + 4 * H, R: 2 })];
  const e = exposure(B, { max: 3, minCluster: 3 });
  assert.equal(e.peak, 4); assert.equal(e.arrivalsAtMax, 1); assert.equal(e.arrivalsAtMaxR, 2);
  assert.equal(e.clusters.length, 1); assert.equal(e.clusters[0].peak, 3); assert.equal(e.clusters[0].trades, 3); assert.equal(e.clusters[0].R, -3);
  const two = exposure(B.concat([tr({ mkt: 'rty', open: T0 + 4 * H, close: T0 + 11 * H, R: 4 })]), { minCluster: 3 });
  assert.equal(two.clusters.length, 1, 'overlapping groups merge'); assert.equal(two.clusters[0].trades, 4); assert.equal(two.clusters[0].R, 1); assert.equal(two.clusters[0].peak, 4);
});

test('Monte Carlo is reproducible, monotone in size, and scaleFor hits the target', () => {
  const s = []; for (let i = 0; i < 200; i++) s.push(i % 3 === 0 ? -0.01 : i % 3 === 1 ? 0.008 : 0.004);
  const a = monteCarlo({ x: s }, { paths: 500, seed: 3 }), b = monteCarlo({ x: s }, { paths: 500, seed: 3 });
  assert.deepEqual(a, b);
  const small = monteCarlo({ x: s }, { paths: 500, scale: 0.2 }), big = monteCarlo({ x: s }, { paths: 500, scale: 3 });
  assert.ok(small.ddP95 < big.ddP95); assert.ok(small.pDD <= big.pDD);
  const k = scaleFor({ x: s }, { paths: 400, target: 0.05 });
  assert.ok(k > 0 && k < 4); assert.ok(monteCarlo({ x: s }, { paths: 400, seed: 11, scale: k }).pDD <= 0.05);
  const flat = monteCarlo({ x: new Array(50).fill(0) }, { paths: 50 }); assert.equal(flat.pDD, 0); assert.equal(flat.ddP95, 0);
});

test('runStudy end to end on a small synthetic book', () => {
  const trades = []; let t = Date.parse('2026-09-01T00:00:00Z') / 1000;
  const mk = ['nq', 'es', 'ym', 'rty', 'gc'];
  for (let i = 0; i < 120; i++) { t += 9 * H; const m = mk[i % 5]; trades.push({ id: `${m}-${i}`, market: m, side: i % 7 < 4 ? 'buy' : 'sell', opened: t, closed: t + 20 * H, R: i % 3 === 0 ? 2.5 : -1, size: m === 'gc' ? 1 : (i % 2 ? 1.5 : 0.5), r0: m === 'gc' ? 30 : 100, aset: true, aplus: i % 4 !== 0 }); }
  const cols = ['market', 'setup', 'side', 'opened', 'filled', 'rr', 'd1', 'struct', 'session', 'R_none', 'R_be1', 'R_be15', 'R_tp2', 'mfe', 'cost', 'fill', 'cf', 'choch', 'm15c', 'm15c1', 'status'];
  const rows = []; let u = Date.parse('2026-10-08T00:00:00Z') / 1000;
  for (let i = 0; i < 150; i++) { u += 4 * H; rows.push([['xau', 'eurusd', 'usdchf'][i % 3], 'scalp', 'buy', u, u, 2, 'against', 'n/a', 'london', i % 3 === 0 ? 2 : -1, 0, 0, 0, 1, 0.1, 1, 'bo', 'no', 'no', 'no', 'closed']); }
  const res = runStudy({ replay: { trades }, backtest: { from: '2026-10-08T00:00:00Z', tradeCols: cols, trades: rows }, live: [] }, { paths: 200, scalePaths: 100 });
  assert.equal(res.inputs.ictA.n, 120); assert.equal(res.inputs.meridianSleeve.n, 150);
  assert.ok(res.curve.length > 60); assert.ok(res.schemes.length >= 10);
  for (const s of res.schemes) { assert.ok(s.hist.maxDD >= 0); assert.ok(s.mc.pDD10 >= 0 && s.mc.pDD10 <= 1); }
  assert.ok(res.recommended.asReplayed.mc.pDD10 >= 0); assert.ok(res.drawdowns.length >= 1);
});
