// Forex weekend gap study (research/edge/fx-weekend-gap): the gap over the weekend in New York time, no look-ahead, stop
// first and the target, the forex costs (spread + commission + reopen slippage), and the written report against result.json.
// Offline, on hand-made candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, PAIRS, pipOf, costPx, nyTime, nyParts, shut, weeks, nyDays, atrAt, simTrade, ruleG, ruleH, holm, normP } from '../research/edge/fx-weekend-gap/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const T = (s) => Date.parse(s + 'Z') / 1000;
function flat(a, b, px = 1.1) { const out = []; for (let t = a; t < b; t += 300) if (!shut(nyParts(t))) out.push({ time: t, open: px, high: px + 0.0005, low: px - 0.0005, close: px }); return out; }

test('pairs, pips and New York times are as pre-registered', () => {
  assert.deepEqual(PAIRS, ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'eurjpy']);
  assert.equal(pipOf('usdjpy'), 0.01); assert.equal(pipOf('eurjpy'), 0.01); assert.equal(pipOf('eurusd'), 0.0001);
  assert.equal(nyTime(2025, 10, 31, 17), T('2025-10-31T21:00:00'));
  assert.equal(nyTime(2025, 11, 2, 17), T('2025-11-02T22:00:00'));
  assert.equal(K.DEC_FROM, T('2020-01-01T00:00:00')); assert.deepEqual(K.REP, [T('2016-01-01T00:00:00'), T('2020-01-01T00:00:00')]);
});

test('the gap spans the weekend: Friday\'s last close, the reopen after Sunday 17:00 New York, stray prints ignored', () => {
  const M5 = flat(T('2025-09-20T00:00:00'), T('2025-11-04T00:00:00'));
  M5.push({ time: T('2025-11-02T21:00:00'), open: 1.05, high: 1.05, low: 1.05, close: 1.05 }); M5.sort((a, b) => a.time - b.time);
  const w = weeks(M5).find((x) => x.fri === '2025-10-31');
  assert.ok(!w.skip, w.skip);
  assert.equal(M5[w.iF].time, T('2025-10-31T20:55:00'));
  assert.equal(M5[w.iR].time, T('2025-11-02T22:00:00'));
  assert.equal(w.noon, T('2025-11-03T17:00:00'));
  assert.equal(w.gap, 0);
});

test('no look-ahead: the gap and ATR do not change when every candle after the reopen changes', () => {
  const M5 = flat(T('2024-01-01T00:00:00'), T('2024-02-14T00:00:00'));
  const iF = M5.findIndex((x) => x.time === T('2024-02-09T21:55:00')), iR = M5.findIndex((x) => x.time === T('2024-02-11T22:00:00'));
  M5[iF].close = 1.0995; M5[iR].open = 1.1004;
  const base = weeks(M5).find((x) => x.fri === '2024-02-09');
  assert.ok(Math.abs(base.gap - 0.0009) < 1e-12); assert.ok(Math.abs(base.atr - 0.001) < 1e-9);
  const M2 = M5.map((x, i) => (i > iR ? { ...x, open: x.open + 0.05, high: x.high + 0.08, low: x.low - 0.08, close: x.close - 0.05 } : x));
  const w2 = weeks(M2).find((x) => x.fri === '2024-02-09');
  assert.deepEqual([w2.fc, w2.ro, w2.gap, w2.atr], [base.fc, base.ro, base.gap, base.atr]);
  assert.ok(Math.abs(atrAt(nyDays(M2), Date.UTC(2024, 1, 9) / 86400000) - base.atr) < 1e-12);
});

test('simTrade: stop first, a gap through the stop at the open, the target, the time exit', () => {
  const c = (t, o, h, l, cl) => ({ time: t, open: o, high: h, low: l, close: cl });
  let B = [c(0, 100, 100, 100, 100), c(300, 100, 104, 99, 101), c(600, 101, 106, 94, 100)];
  assert.deepEqual(simTrade(B, 0, 1, 100, 5, 105, 95, 99999), { exitT: 600, exitPx: 95, exit: 'stop', R: -1 });
  B = [c(0, 100, 100, 100, 100), c(300, 107, 108, 106, 107)];
  const g = simTrade(B, 0, -1, 100, 5, 95, 105, 99999); assert.equal(g.exit, 'stop (gap)'); assert.ok(Math.abs(g.R + 1.4) < 1e-12);
  B = [c(0, 100, 100, 100, 100), c(300, 100, 105.5, 99, 104)];
  assert.equal(simTrade(B, 0, 1, 100, 5, 105, 95, 99999).exit, 'target');
  B = [c(0, 100, 100, 100, 100), c(300, 100, 101, 99, 101), c(600, 101, 102, 100, 102), c(900, 102, 200, 0, 102)];
  assert.deepEqual(simTrade(B, 0, 1, 100, 5, 105, 95, 900), { exitT: 900, exitPx: 102, exit: 'time', R: 0.4 });
});

test('costs: 0.3 pip + 1 pip slippage a side + 22.5 per million a side; stress 2 pips a side', () => {
  assert.ok(Math.abs(costPx('eurusd', 1.1) - (0.0001 * 2.3 + 45e-6 * 1.1)) < 1e-15);
  assert.ok(Math.abs(costPx('usdjpy', 150, K.SLIP2_PIPS) - (0.01 * 4.3 + 45e-6 * 150)) < 1e-12);
});

test('Rule G fades toward Friday\'s close with a stop on the other side; costs and no rollover; Rule H waits an hour', () => {
  const M5 = flat(T('2024-01-01T00:00:00'), T('2024-02-14T00:00:00'));
  const iF = M5.findIndex((x) => x.time === T('2024-02-09T21:55:00')), iR = M5.findIndex((x) => x.time === T('2024-02-11T22:00:00'));
  M5[iF].close = 1.1;
  for (let i = iR; i < M5.length; i++) M5[i] = { ...M5[i], open: 1.1012, high: 1.1013, low: 1.1011, close: 1.1012 };  // gap up 12 pips (1.2 ATR), never filled
  const w = weeks(M5).find((x) => x.fri === '2024-02-09');
  const g = ruleG('eurusd', M5, w);
  assert.equal(g.side, -1); assert.equal(g.entry, 1.1012); assert.equal(g.target, 1.1); assert.ok(Math.abs(g.stop - 1.1024) < 1e-12);
  assert.ok(g.side > 0 ? g.stop < g.entry : g.stop > g.entry);                // every trade has its stop, on the losing side
  assert.equal(g.exit, 'time'); assert.equal(g.nights, 0);
  assert.ok(Math.abs(g.net - (g.R - costPx('eurusd', 1.1012) / 0.0012)) < 1e-4);
  assert.ok(g.net2 < g.net);
  assert.equal(ruleH('eurusd', M5, w).filled, T('2024-02-11T23:00:00'));
  const M2 = M5.slice(); M2[iR] = { ...M2[iR], close: 1.0999, low: 1.0998 };
  assert.deepEqual(ruleG('eurusd', M2, weeks(M2).find((x) => x.fri === '2024-02-09')), { skip: 'filled' });
});

test('Holm over two rules at the one-sided level of t = 2', () => {
  assert.ok(Math.abs(normP(2) - K.ALPHA) < 1e-4);
  assert.deepEqual(holm([normP(2.14), normP(-0.16)]), [false, false]);
  assert.deepEqual(holm([normP(2.4), normP(2.05)]), [true, true]);
});

test('RESULT.md says what result.json says', () => {
  const R = JSON.parse(rd('../research/edge/fx-weekend-gap/result.json')), md = rd('../research/edge/fx-weekend-gap/RESULT.md');
  assert.match(md.split('\n').find((l) => /Verdict/.test(l)), new RegExp(R.verdict.split(' ')[0]));
  assert.equal(R.verdict, R.pass ? 'PASS' : 'FAIL'); assert.equal(R.verdict, 'FAIL');
  const f = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
  for (const k of ['G', 'H']) for (const w of ['dec', 'rep']) { const s = R.rules[k][w];
    assert.ok(md.includes(`| ${k} | ${w === 'dec' ? '2020 to now' : '2016-19'} | ${s.n} | ${(s.win * 100).toFixed(0)} % | ${f(s.gross)} | ${f(s.net)} | ${f(s.net2)} | ${s.t.toFixed(2)} | ${s.tMonth.toFixed(2)} |`), `${k} ${w} row`); }
  for (const k of ['G', 'H']) for (const p of R.pairs) { const b = R.rules[k].byPair[p];
    assert.ok(md.includes(`| ${p} | ${b.dec.n} | ${f(b.dec.net)} | ${b.dec.t.toFixed(2)} | ${b.rep.n} | ${f(b.rep.net)} | ${b.rep.t.toFixed(2)} |`), `${k} ${p}`); }
  assert.ok(md.includes(`p of ${R.rules.G.p}`) || md.includes(`p ${R.rules.G.p}`));
  assert.ok(md.includes(f(R.placebo.dec.p95)) && md.includes(f(R.placebo.dec.median)));
  for (const w of ['rep', 'dec']) for (const b of R.fill.pooled[w]) if (b.all.n) assert.ok(md.includes(`${b.all.filled} of ${b.all.n}`), b.bin);
  assert.ok(md.includes(`${R.posthoc.G.weeks} weekends`) && md.includes(R.posthoc.G.tWeek.toFixed(2)));
  for (const [k, c] of Object.entries(R.rules.G.checks)) assert.equal(c, k !== 'holm', k);    // G misses on Holm alone
});
