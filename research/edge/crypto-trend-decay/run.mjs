// Crypto trend v3 decay study: replay the live rule unchanged on BTC, ETH, SOL, XRP with Kraken fees (council/fills.mjs costOf),
// year by year since 2017; the 2024-26 window and its two halves; one pre-registered decay explanation fitted on the early data
// and checked on the late data; a cross-check on Kraken's own daily candles. Paper research only; nothing live changes.
// Usage (from the repo root, after `git fetch origin council-data`): node research/edge/crypto-trend-decay/run.mjs
// Writes research/edge/crypto-trend-decay/result.json and prints the tables.
import fs from 'node:fs';
import path from 'node:path';
import { COINS, loadBinance, loadKraken, replayV3, stats, yearOf, ts, day, sma } from './lib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);

// ── Pre-registration (written before the split below was computed; nothing here was tuned afterwards) ──
export const PREREG = {
  windows: { early: 'signals before 2024-01-01', late: 'signals 2024-01-01 to the end of the data (2026-10-31)',
    lateHalves: ['2024-01-01 to 2025-05-31', '2025-06-01 to 2026-10-31'] },
  hypothesis: 'Regime: the v3 edge exists only when Bitcoin is in a long-term uptrend, i.e. BTC/USDT daily close above its 200-day simple moving average on the signal day (same rule for all four coins). The 2024-26 fade is breakouts taken while BTC was below its 200-day average.',
  fixed: 'SMA length 200 and the BTC close on the signal day are fixed in advance: no other length, coin or threshold is tried.',
  fit: 'Early data (signals before 2024): in-regime R/trade > 0 and at least +0.5R a trade better than out-of-regime.',
  validate: 'Late data (signals 2024-01-01 on): in-regime R/trade > 0 with t >= 1.5 and at least +0.5R a trade better than out-of-regime.',
  verdict: {
    alive: '2024-26 net R/trade > 0 with t >= 2 and both halves > 0',
    regimeDependent: 'not alive, and the hypothesis passes both the fit and the validation',
    decayed: 'neither of the above',
  },
};

const LATE = ts('2024-01-01'), MIDL = ts('2025-06-01');
const coins = Object.keys(COINS), bin = {}, all = [];
for (const c of coins) { bin[c] = loadBinance(c); all.push(...replayV3(bin[c], c)); }
const closed = all.filter((x) => !x.open), openNow = all.filter((x) => x.open);
const dataEnd = Math.min(...coins.map((c) => bin[c].at(-1).time));

// BTC regime on each signal day
const B = bin.btc, bIdx = new Map(B.map((b, i) => [b.time, i]));
for (const x of all) { const i = bIdx.get(x.sig); const s = i != null ? sma(B, i, 200) : null; x.btcUp = s == null ? null : B[i].close > s; }

const brief = (s) => s.n ? `n ${String(s.n).padStart(3)}  R/trade ${(s.exp >= 0 ? '+' : '') + s.exp.toFixed(3)}  t ${s.t == null ? '  -  ' : s.t.toFixed(2).padStart(5)}  total ${s.R.toFixed(1).padStart(6)}R  maxDD ${s.maxDD.toFixed(1)}R  win ${(s.wr * 100).toFixed(0)}%` : 'n   0';
const units = (a) => a.flatMap((x) => x.units.map((u) => ({ ...u, exitT: x.exitT })));
const block = (a) => ({ net: stats(a), gross: stats(a, 'gross'), cost: +(a.reduce((s, x) => s + x.cost, 0) / Math.max(1, a.length)).toFixed(3), x2: stats(a.map((x) => ({ ...x, R: x.gross - 2 * x.cost }))), units: stats(units(a)) });

const R = { system: 'Meridian · crypto trend v3 (BTC, ETH, SOL, XRP; 55/100-day breakouts + add), Binance daily, Kraken fees', verdict: null, prereg: PREREG, data: {}, years: {}, yearsDetail: {}, coinsByYear: {}, windows: {}, decay: {}, kraken: {}, open: [], variants: {} };
for (const c of coins) R.data[c] = { source: `Binance spot daily ${COINS[c].bin} (council-data research/candles/crypto1d)`, from: day(bin[c][0].time), to: day(bin[c].at(-1).time), candles: bin[c].length };

console.log('Crypto trend v3, live rule unchanged, Binance daily, Kraken fees via costOf (positions = first unit + add, R on the first unit risk)\n');
console.log('Year (by signal) — closed positions, net of costs');
const yrs = [...new Set(closed.map((x) => yearOf(x.t)))].sort();
for (const y of yrs) { const a = closed.filter((x) => yearOf(x.t) === y); R.yearsDetail[y] = block(a); R.years[y] = R.yearsDetail[y].net; console.log(String(y), brief(R.years[y]), ` | gross ${R.yearsDetail[y].gross.exp.toFixed(3)} cost ${R.yearsDetail[y].cost.toFixed(3)}R`);
  R.coinsByYear[y] = Object.fromEntries(coins.map((c) => [c, stats(a.filter((x) => x.coin === c))])); }

const W = {
  all: (x) => true,
  early: (x) => x.t < LATE,
  '2017-21': (x) => yearOf(x.t) <= 2021,
  '2022-23': (x) => yearOf(x.t) >= 2022 && yearOf(x.t) <= 2023,
  '2024-26': (x) => x.t >= LATE,
  '2024-26 H1 (2024-01-01..2025-05-31)': (x) => x.t >= LATE && x.t < MIDL,
  '2024-26 H2 (2025-06-01..2026-10-31)': (x) => x.t >= MIDL,
  '2023-26 (council replay window)': (x) => yearOf(x.t) >= 2023,
};
console.log('\nWindows');
for (const [k, f] of Object.entries(W)) { const a = closed.filter(f); R.windows[k] = { ...block(a), byCoin: Object.fromEntries(coins.map((c) => [c, stats(a.filter((x) => x.coin === c))])), bySlot: { 55: stats(a.filter((x) => x.slot === 55)), 100: stats(a.filter((x) => x.slot === 100)) } };
  console.log(k.padEnd(38), brief(R.windows[k].net)); }
console.log('\n2024-26 by coin'); for (const c of coins) console.log(' ', c, brief(R.windows['2024-26'].byCoin[c]));
console.log('2024-26 H2 by coin'); for (const c of coins) console.log(' ', c, brief(R.windows['2024-26 H2 (2025-06-01..2026-10-31)'].byCoin[c]));
console.log('2024-26 units (first unit and add counted separately):', brief(R.windows['2024-26'].units), '| at 2x costs:', brief(R.windows['2024-26'].x2));

// ── the pre-registered decay explanation ──
const split = (a) => ({ in: stats(a.filter((x) => x.btcUp === true)), out: stats(a.filter((x) => x.btcUp === false)), unknown: a.filter((x) => x.btcUp == null).length });
const E = split(closed.filter(W.early)), L = split(closed.filter(W['2024-26'])), LH = [split(closed.filter(W['2024-26 H1 (2024-01-01..2025-05-31)'])), split(closed.filter(W['2024-26 H2 (2025-06-01..2026-10-31)']))];
const diff = (s) => s.in.n && s.out.n ? +(s.in.exp - s.out.exp).toFixed(3) : null;
const fitOk = E.in.n > 0 && E.in.exp > 0 && diff(E) != null && diff(E) >= 0.5;
const valOk = L.in.n > 0 && L.in.exp > 0 && (L.in.t ?? 0) >= 1.5 && diff(L) != null && diff(L) >= 0.5;
R.decay = { early: { ...E, diff: diff(E), pass: fitOk }, late: { ...L, diff: diff(L), pass: valOk }, lateHalves: LH.map((s) => ({ ...s, diff: diff(s) })), pass: fitOk && valOk,
  byYear: Object.fromEntries(yrs.map((y) => [y, split(closed.filter((x) => yearOf(x.t) === y))])) };
console.log('\nDecay test — BTC above its 200-day SMA on the signal day (in) vs below (out)');
console.log(' early  in ', brief(E.in), '\n early  out', brief(E.out), ` | diff ${diff(E)} → fit ${fitOk ? 'PASS' : 'FAIL'} (unknown: ${E.unknown}, before BTC had 200 days)`);
console.log(' late   in ', brief(L.in), '\n late   out', brief(L.out), ` | diff ${diff(L)} → validation ${valOk ? 'PASS' : 'FAIL'}`);
LH.forEach((s, k) => console.log(` late H${k + 1} in `, brief(s.in), '\n late H' + (k + 1) + ' out', brief(s.out)));
for (const y of yrs) { const s = R.decay.byYear[y]; console.log(`  ${y} in ${s.in.n} ${s.in.exp ?? '-'}  out ${s.out.n} ${s.out.exp ?? '-'}`); }

// ── variants, for context only (not a proposal: nothing below is a rule change) ──
for (const [k, o] of Object.entries({ noAdd: { add: 0 }, slot55only: { slots: [55] }, slot100only: { slots: [100] } })) {
  const a = coins.flatMap((c) => replayV3(bin[c], c, o)).filter((x) => !x.open);
  R.variants[k] = { early: stats(a.filter(W.early)), late: stats(a.filter(W['2024-26'])), lateH1: stats(a.filter(W['2024-26 H1 (2024-01-01..2025-05-31)'])), lateH2: stats(a.filter(W['2024-26 H2 (2025-06-01..2026-10-31)'])) };
}
console.log('\nVariants (context only): no add / 55-day slot only / 100-day slot only, late window');
for (const [k, v] of Object.entries(R.variants)) console.log(' ', k.padEnd(12), brief(v.late), '| H2', brief(v.lateH2));

// ── cross-check on Kraken's own daily candles (the Trader's feed; 720 candles: signals from about Mar 2025 once 100+21 days exist) ──
const kr = coins.flatMap((c) => { const D = loadKraken(c); R.kraken[c] = { from: day(D[0].time), to: day(D.at(-1).time), candles: D.length }; return replayV3(D, c); });
const krFrom = ts(R.kraken.btc.from) + 121 * 86400;
const bSame = closed.filter((x) => x.t >= krFrom);
R.kraken.check = { from: day(krFrom), krakenClosed: stats(kr.filter((x) => !x.open && x.t >= krFrom)), binanceSameWindow: stats(bSame),
  krakenOpen: kr.filter((x) => x.open).map((x) => ({ coin: x.coin, slot: x.slot, entered: day(x.t), entry: x.entry, markR: +x.R.toFixed(2) })) };
console.log(`\nKraken cross-check, signals from ${R.kraken.check.from}:`, '\n  Kraken ', brief(R.kraken.check.krakenClosed), '\n  Binance', brief(R.kraken.check.binanceSameWindow));

R.open = openNow.map((x) => ({ coin: x.coin, slot: x.slot, entered: day(x.t), entry: x.entry, markR: +x.R.toFixed(2), add: x.add }));
console.log('\nOpen at the end of the data (marked at the last close, not in the stats):', JSON.stringify(R.open));

// ── is the flat recent half just bad luck? Block bootstrap by signal month (signals of one month across coins and slots move
// together): draw as many months as the recent half has, from the months with trades before it, and see how often the mean
// R a trade is as bad as the recent half's. Seeded, so the number is reproducible.
const H2f = W['2024-26 H2 (2025-06-01..2026-10-31)'], mon = (x) => day(x.t).slice(0, 7);
const preM = {}; for (const x of closed.filter((x) => x.t < MIDL)) (preM[mon(x)] = preM[mon(x)] || []).push(x.R);
const months = Object.values(preM), h2M = new Set(closed.filter(H2f).map(mon)).size, h2Exp = stats(closed.filter(H2f)).exp;
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const h2Max = Math.max(...closed.filter(H2f).map((x) => x.R));
let hit = 0, none = 0; const NB = 20000;
for (let k = 0; k < NB; k++) { let s = 0, n = 0, mx = -Infinity; for (let j = 0; j < h2M; j++) { const m = months[Math.floor(rnd() * months.length)]; for (const v of m) { s += v; n++; mx = Math.max(mx, v); } } if (s / n <= h2Exp) hit++; if (mx <= h2Max) none++; }
const big = closed.filter((x) => x.t < MIDL), bigShare = big.filter((x) => x.R >= 2).length / big.length;
R.luck = { method: 'block bootstrap by signal month, 20,000 draws, seed 7', recentMonths: h2M, poolMonths: months.length, recentExp: h2Exp,
  pAsBad: +(hit / NB).toFixed(4), pBestNoBetter: +(none / NB).toFixed(4), shareOver2RBefore: +bigShare.toFixed(3), recentMaxR: +Math.max(...closed.filter(H2f).map((x) => x.R)).toFixed(2) };
console.log(`\nLuck check: ${h2M} signal months since Jun 2025, drawn from ${months.length} earlier months: P(mean <= ${h2Exp}) = ${R.luck.pAsBad}; P(best position <= ${R.luck.recentMaxR}R) = ${R.luck.pBestNoBetter} (before: ${(bigShare * 100).toFixed(0)}% of positions made >= 2R; since Jun 2025 the best made ${R.luck.recentMaxR}R)`);

// ── how much rests on a few runs: R a trade without each window's best 5% of positions (same cut in every window) ──
const trim = (a) => { const s = a.slice().sort((x, y) => y.R - x.R), k = Math.round(s.length * 0.05); return { dropped: k, ...stats(s.slice(k)), best: s.slice(0, k).map((x) => `${x.coin} ${x.slot}d ${day(x.t)} ${x.R.toFixed(1)}R`) }; };
R.trimmed = Object.fromEntries(['early', '2017-21', '2022-23', '2024-26', '2024-26 H1 (2024-01-01..2025-05-31)', '2024-26 H2 (2025-06-01..2026-10-31)'].map((k) => [k, trim(closed.filter(W[k]))]));
console.log('\nWithout the best 5% of positions:'); for (const [k, v] of Object.entries(R.trimmed)) console.log(' ', k.padEnd(38), brief(v), '| dropped', v.best.join(', '));

// ── verdict ──
// 1. the pre-registered rule, applied mechanically
const w = R.windows['2024-26'].net, h1 = R.windows['2024-26 H1 (2024-01-01..2025-05-31)'].net, h2 = R.windows['2024-26 H2 (2025-06-01..2026-10-31)'].net;
const alive = w.exp > 0 && (w.t ?? 0) >= 2 && h1.exp > 0 && h2.exp > 0;
R.verdictPrereg = alive ? 'still alive' : R.decay.pass ? 'regime-dependent' : 'decayed';
// 2. does the explanation actually account for the fade? Its own prediction: in-regime trades keep the edge in the recent half.
//    (Added after the split was seen, because the late window's pass came entirely from H1, where no trade was out of regime.)
const h2in = R.decay.lateHalves[1].in;
R.explains = { h2InRegime: h2in, h1OutOfRegime: R.decay.lateHalves[0].out.n, holds: h2in.n > 0 && h2in.exp > 0 && (h2in.t ?? 0) >= 1 };
R.verdict = alive ? 'still alive' : R.decay.pass && R.explains.holds ? 'regime-dependent' : 'decayed';
console.log(`Pre-registered rule: ${R.verdictPrereg}. Recent half, BTC above its 200-day: ${brief(h2in)} → the regime explains the fade: ${R.explains.holds}`);
R.dataEnd = day(dataEnd);
R.trades = closed.concat(openNow).map((x) => ({ coin: x.coin, slot: x.slot, sig: day(x.sig), entry: day(x.t), exit: day(x.exitT), entryPx: +x.entry.toPrecision(6), exitPx: +x.exitPx.toPrecision(6),
  r0pct: +(x.r0pct * 100).toFixed(2), exitKind: x.exitKind, add: x.add, gross: +x.gross.toFixed(3), cost: +x.cost.toFixed(3), R: +x.R.toFixed(3), btcUp: x.btcUp }));
console.log('\nVerdict:', R.verdict);
// fields the edge lab page (edge-lab.html) reads: baseline is/oos, candidates, notes
R.baseline = { is: R.windows.early.net, oos: R.windows['2024-26'].net };
R.candidates = [{ rule: 'Pre-registered: only when BTC > its 200-day SMA', verdict: R.explains.holds ? 'PASS' : 'FAIL (fits 2018/2022, not the 2025-26 fade)', is: R.decay.early.in, oos: R.decay.late.in, recentHalf: R.decay.lateHalves[1].in }];
R.variantsTried = 1;
R.notes = [`Verdict ${R.verdict}: 2024-26 ${brief(w)}; first half ${brief(h1)}; second half (Jun 2025 - Oct 2026) ${brief(h2)}.`,
  `Kraken candles from ${R.kraken.check.from}: ${brief(R.kraken.check.krakenClosed)}. Fees cost ${R.windows['2024-26'].cost}R a position (5 ATR stop, ~23% of price).`,
  `2024-26 without its best 5% (the XRP Nov 2024 run): ${R.trimmed['2024-26'].exp}R a position; before 2024 the same cut leaves ${R.trimmed.early.exp}R.`,
  `Pre-registered rule reads ${R.verdictPrereg}, but in the recent half BTC-uptrend breakouts made ${h2in.exp}R (n ${h2in.n}): the regime does not explain the fade. Bootstrap: ~${Math.round(R.luck.pAsBad * 100)}% chance of a half this bad under the old behaviour.`];
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
