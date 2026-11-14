// Edge research · index-vol-breakout: gold-vol-breakout's T1 rule, unchanged, on OANDA NAS100 and SPX500 mid M5 (buy stop at
// the UTC open + 0.5 × the previous day's range, sell stop at the open − 0.5 × that range, stop back at the open, out at 21:00
// UTC), as fixed in PREREGISTRATION.md. The rule's functions are imported from ./original.mjs, a byte-for-byte copy of
// research/edge/gold-vol-breakout/run.mjs (branch gold-vol-breakout, not on main; sha256 checked below and in the test). Only the
// market, the cost (points a round trip) and the financing key (index, nr7-breakout's formula) change: net R is recomputed from
// each trade's own R, 1R, side, entry and nights. Pure pieces are exported for tests/index-vol-breakout.test.mjs.
//   node research/edge/index-vol-breakout/run.mjs <dir>   (<dir>/nas100-5m.json.gz and spx500-5m.json.gz, OANDA mid M5 rows
//                                                          [t,o,h,l,c], out of git; writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, placeboTrade, monthT, normP, holm, rng, quantile, summary } from './original.mjs';

export const ORIGINAL_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
// round trip in index points (research/edge/nr7-breakout RESULT.md "Costs": NAS100 3 points, SPX500 1 point)
export const MARKETS = {
  nas100: { name: 'NAS100 (Nasdaq 100 CFD)', cost: 3, file: 'nas100-5m.json.gz' },
  spx500: { name: 'SPX500 (S&P 500 CFD)', cost: 1, file: 'spx500-5m.json.gz' },
};
// nr7-breakout financing: longs (DGS2 + 2.5 %) / 365 a night, shorts max(0, 2.5 % − DGS2) / 365; DGS2 assumed 5 % (upper bound)
export const FIN_IDX = { dgs2: 0.05, spread: 0.025 };
export const finRate = (side) => (side > 0 ? FIN_IDX.dgs2 + FIN_IDX.spread : Math.max(0, FIN_IDX.spread - FIN_IDX.dgs2)) / 365;
export const T1 = { name: 'k 0.5, both sides', k: 0.5, sides: 'both' };
export const WINDOWS = { IS: ['2016-01-01', '2020-12-31'], OOS: ['2021-01-01', '2026-12-31'], ALL: ['2016-01-01', '2026-12-31'] };
export const SEEDS = 40, PLACEBO = { from: 1 * 3600, to: 18 * 3600 };
const DAY = 86400;
const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// the index cost on one trade from original.mjs (its gold financing is replaced; R, r, side, entry, nights are the rule's own)
export function recost(x, cost) {
  const fin = x.nights * finRate(x.side) * x.entry / x.r;
  return { ...x, finR: fin, net: x.R - cost / x.r - fin, net2: x.R - 2 * cost / x.r - 2 * fin };
}
export function tradeDays(days, end) {
  const out = [], skips = {};
  for (const d of days) {
    if (!inW(d.day, [WINDOWS.ALL[0], end])) continue;
    const s = daySkip(d); if (s) { skips[s] = (skips[s] || 0) + 1; continue; }
    out.push(d);
  }
  return { out, skips };
}
export function runMarket(days, cost, end = WINDOWS.ALL[1]) {
  const { out, skips } = tradeDays(days, end), tr = [];
  for (const d of out) {
    const x = vbTrade(d.bars, { k: T1.k, sides: T1.sides, prevRange: d.prevRange, cost });
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1; else tr.push({ day: d.day, ...recost(x, cost) });
  }
  return { tr, skips, days: out.length };
}
// placebo, as gold-vol-breakout's, on every tradable day 2016 → now of one market
export function placebo(days, cost, end = WINDOWS.ALL[1], seeds = SEEDS) {
  const pool = tradeDays(days, end).out, grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
      const x = placeboTrade(d.bars, { startT, side, dist: T1.k * d.prevRange, cost }); if (x) tr.push(recost(x, cost));
    }
    res.push(r3(mean(tr.map((x) => x.net))));
  }
  return res;
}
export function decide(res, pl) {
  const ks = Object.keys(MARKETS), ps = ks.map((k) => normP(res[k].ALL.t)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const a = res[k].ALL, beaten = pl[k].filter((v) => a.netR > v).length;
    const checks = { isPos: res[k].IS.netR > 0, oosPos: res[k].OOS.netR > 0, t2: a.t >= 2, holm: adj[i] < 0.05, cost2x: a.net2R > 0,
      placebo: beaten >= 38, n30: res[k].IS.n >= 30 && res[k].OOS.n >= 30 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}
export function outcome(dec) {
  const n = Object.values(dec).filter((x) => x.pass).length;
  return n === 2 ? 'generalises' : n === 1 ? 'partial' : 'not general';
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
const failed = (d) => Object.entries(d.checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
export function verdictLine(res, dec) {
  const n = Object.values(dec).filter((x) => x.pass).length, o = outcome(dec);
  const one = (k, s) => `${s} ${sg(res[k].ALL.netR)}R net (n ${res[k].ALL.n}, t ${s2(res[k].ALL.t)}; gross ${sg(res[k].ALL.grossR)}R, t ${s2(res[k].ALL.grossT)})`;
  const head = n === 2 ? 'PASS, 2 of 2' : `FAIL, ${n} of 2`;
  return `${head}, ${o === 'generalises' ? 'the effect generalises' : o === 'partial' ? 'partial only' : 'not a general effect'}: gold's T1 breakout 2016 → now on ${one('nas100', 'NAS100')}, ${one('spx500', 'SPX500')}`;
}
export function report(R) {
  const L = [], M = R.markets, yn = (b) => (b ? 'yes' : 'no'), rows = [['nas100', 'NAS100'], ['spx500', 'SPX500'], ['pooled', 'Pooled']];
  L.push('# Index CFDs: gold\'s intraday volatility breakout, unchanged (UTC open ± 0.5 × the previous day\'s range)', '');
  L.push('Paper research only. A robustness check of `gold-vol-breakout` (branch `gold-vol-breakout`) on two markets the rule was not found on; not a rule for any live book, never a gate, exit, entry or size of the live gold book (owner decision 44), and not part of the ICT edge. Nothing live changed, no proposal. The rule, markets, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The rule\'s functions are imported from `original.mjs`, a byte-for-byte copy of that study\'s `run.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Results', '');
  L.push('| Market | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Stops / time | Max DD R | Median stop (points) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, nm] of rows) for (const w of ['IS', 'OOS', 'ALL']) {
    const x = M[k][w];
    L.push(`| ${nm} | ${w === 'IS' ? '2016-2020' : w === 'OOS' ? `2021 → ${R.dataEnd}` : `2016 → ${R.dataEnd}`} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.t2x)} | ${x.stops} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (2016 → now per market, Holm over the two markets)', '');
  L.push('| Market | p | Holm p | 2016-20 > 0 | 2021 → now > 0 | t ≥ 2 | Holm < 0.05 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 each window | pass |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, nm] of rows.slice(0, 2)) { const d = R.decision[k], c = d.checks; L.push(`| ${nm} | ${d.p} | ${d.pHolm} | ${yn(c.isPos)} | ${yn(c.oosPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.cost2x)} | ${d.placeboBeaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `Outcome: **${R.outcome}** (pre-registered: "generalises" only when both markets pass).`, '');
  L.push('## Placebo (2016 → now, 40 seeds)', '', 'Every day the rule could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day\'s range away, out at 21:00 UTC or the stop, the same costs.', '');
  L.push('| Market | Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |', '|---|---|---|---|---|');
  for (const [k, nm] of rows.slice(0, 2)) { const p = R.placebo[k]; L.push(`| ${nm} | ${sg(M[k].ALL.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} |`); }
  L.push('', '## Sides and skipped days', '');
  for (const [k, nm] of rows.slice(0, 2)) L.push(`- ${nm}, 2016 → now: buys n ${M[k].ALL.buys.n} ${sg(M[k].ALL.buys.netR)}R, sells n ${M[k].ALL.sells.n} ${sg(M[k].ALL.sells.netR)}R; financing ${sg(M[k].ALL.finR)}R a trade; days without a trade: ${Object.entries(M[k].skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  L.push('', '## By year (net R a trade, n)', '');
  const ys = [...new Set(rows.flatMap(([k]) => Object.keys(M[k].ALL.byYear)))].sort();
  L.push('| Year | NAS100 | SPX500 | Pooled |', '|---|---|---|---|');
  for (const y of ys) L.push(`| ${y} | ` + rows.map(([k]) => { const b = M[k].ALL.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push('- Correction: the pre-registration gave the files\' last candle as 2026-11-13 21:55 UTC; it is 2026-11-12 23:55 UTC (a reading slip of the timestamp; the rule, markets, windows and tests do not depend on it). SPX500 has more thin days (fewer than 200 candles) than NAS100, most in 2017, where its file has gaps; they are skipped by the pre-registered rule.');
  L.push(`- Halt: ${R.halt}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: ${R.costs}`);
  L.push('- To repeat: `node research/edge/index-vol-breakout/run.mjs <dir>` with `<dir>/nas100-5m.json.gz` and `<dir>/spx500-5m.json.gz` (OANDA mid M5 from the candle proxy, rows `[t, o, h, l, c]`, kept out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const osha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (osha !== ORIGINAL_SHA) throw new Error('original.mjs is not the gold-vol-breakout run.mjs');
  const res = {}, pl = {}, spans = {}; let dataEnd = null;
  for (const [k, m] of Object.entries(MARKETS)) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, m.file)))); rows.sort((a, b) => a[0] - b[0]);
    const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, end = ymdOf(lastFull - DAY);
    dataEnd = dataEnd && dataEnd < end ? dataEnd : end;
    const days = buildDays(rows.filter((r) => r[0] < lastFull));
    spans[k] = { rows: rows.length, from: new Date(rows[0][0] * 1000).toISOString(), to: new Date(rows.at(-1)[0] * 1000).toISOString(), weekdays: days.length };
    const { tr, skips, days: nd } = runMarket(days, m.cost, end);
    res[k] = { name: m.name, cost: m.cost, eligibleDays: nd, skips, tr };
    pl[k] = placebo(days, m.cost, end);
  }
  const pooled = Object.keys(MARKETS).flatMap((k) => res[k].tr);
  const markets = {};
  for (const [k, x] of [...Object.entries(res).map(([k, v]) => [k, v.tr]), ['pooled', pooled]]) {
    markets[k] = { ...(res[k] ? { name: res[k].name, cost: res[k].cost, eligibleDays: res[k].eligibleDays, skips: res[k].skips } : { name: 'NAS100 + SPX500' }),
      IS: summary(x.filter((t) => inW(t.day, WINDOWS.IS))), OOS: summary(x.filter((t) => inW(t.day, WINDOWS.OOS))), ALL: summary(x) };
  }
  const dec = decide(markets, pl), out = outcome(dec);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const one = (k) => { const m = markets[k]; return `${k === 'nas100' ? 'NAS100' : 'SPX500'} 2016 → now ${sg(m.ALL.netR)}R net (n ${m.ALL.n}, month t ${s2(m.ALL.t)}, Holm p ${dec[k].pHolm}; gross ${sg(m.ALL.grossR)}R, gross t ${s2(m.ALL.grossT)}; 2016-20 ${sg(m.IS.netR)}R, 2021 → now ${sg(m.OOS.netR)}R; at 2x costs ${sg(m.ALL.net2R)}R; ${dec[k].placeboBeaten} of 40 placebos beaten; ${dec[k].pass ? 'passes' : `failed: ${failed(dec[k])}`})`; };
  const p = markets.pooled;
  const grossSign = (m) => (m.ALL.grossR > 0 ? 'positive' : 'negative');
  const reading = `${one('nas100')}. ${one('spx500')}. Pooled (descriptive, not a test): ${sg(p.ALL.netR)}R net (n ${p.ALL.n}, month t ${s2(p.ALL.t)}; gross ${sg(p.ALL.grossR)}R, t ${s2(p.ALL.grossT)}). `
    + `Costs take ${sg(markets.nas100.ALL.costR).replace('+', '')}R a trade on NAS100 and ${sg(markets.spx500.ALL.costR).replace('+', '')}R on SPX500 (2016-20 ${sg(markets.nas100.IS.costR).replace('+', '')}R / ${sg(markets.spx500.IS.costR).replace('+', '')}R, when the index levels were lower and a fixed point cost was a larger share of 1R; gold's out-of-sample cost was about 0.05R). `
    + `Before costs the breakout is ${grossSign(markets.nas100)} on NAS100 (gross month t ${s2(markets.nas100.ALL.grossT)}) and ${grossSign(markets.spx500)} on SPX500 (gross t ${s2(markets.spx500.ALL.grossT)}), smaller than on gold (+0.121R a trade gross 2021 → now); `
    + `${markets.nas100.ALL.grossR > 0 && markets.nas100.ALL.netR <= 0 ? 'as on silver, gross and net split: the lean survives on paper before costs and not after. ' : ''}`
    + (out === 'generalises' ? 'Both markets pass every pre-registered check: the breakout effect is not specific to gold. Paper research only; nothing live changes and no proposal is written.'
      : out === 'partial' ? 'One market passes and one does not: not a general effect by the pre-registered bar; the passing market is a hypothesis for its own pre-registration on other data, not an edge. Nothing live changes and no proposal is written.'
        : 'Neither market passes: the same rule does not carry from gold to the US index CFDs, so on this evidence the gold result (with its 2007-15 replication) is a gold-specific effect, not a general intraday volatility-breakout effect. Not an edge on indices; nothing live changes and no proposal is written.');
  const result = { study: 'index-vol-breakout', built: '2026-11-14', preregistration: 'research/edge/index-vol-breakout/PREREGISTRATION.md', planSha256: sha,
    original: { file: 'research/edge/index-vol-breakout/original.mjs', copyOf: 'research/edge/gold-vol-breakout/run.mjs (branch gold-vol-breakout)', sha256: osha },
    claim: 'gold-vol-breakout\'s T1 (a move of 0.5 × the previous day\'s range away from the UTC open continues to 21:00 UTC) also holds on US index CFDs',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the close of the last candle starting before 21:00 UTC; unchanged from gold-vol-breakout T1',
    halt: 'OANDA\'s US index CFDs halt 21:00-22:00 UTC (US daylight time) or 22:00-23:00 UTC and from Friday 21:00 / 22:00 UTC to the Sunday reopen; 00:00 UTC is always inside the session and the 00:00-20:55 UTC trading day never contains the halt; D1 = the UTC calendar day of M5 candles (the halt hour has none), Sunday\'s reopen stub folded into Monday with foldWeekend; US early-close days exit at the last candle on file before 21:00; days under 200 candles or without a 00:00-00:55 candle are skipped (gold-vol-breakout\'s skips)',
    data: `OANDA mid M5 through the keyless candle proxy: ${Object.entries(spans).map(([k, s]) => `${k} ${s.rows} rows ${s.from.slice(0, 16)} → ${s.to.slice(0, 16)} (${s.weekdays} weekdays built)`).join('; ')}; trading days 2016-01-01 → ${dataEnd}`,
    costs: 'round trip NAS100 3 points, SPX500 1 point (research/edge/nr7-breakout RESULT.md "Costs"), 2x reported; financing per 22:00 UTC rollover (`nights`) by nr7-breakout\'s index formula, longs (DGS2 + 2.5 %) / 365, shorts max(0, 2.5 % − DGS2) / 365, DGS2 assumed 5 % (an upper bound): no trade crosses the rollover, so 0 on every trade',
    dataEnd, windows: { IS: WINDOWS.IS, OOS: [WINDOWS.OOS[0], dataEnd], ALL: [WINDOWS.ALL[0], dataEnd] }, verdict: verdictLine(markets, dec), outcome: out, decision: dec, markets,
    placebo: Object.fromEntries(Object.keys(MARKETS).map((k) => [k, { seeds: SEEDS, start: '01:00-18:00 UTC', means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])),
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict, result.verdict.length);
  for (const k of ['nas100', 'spx500', 'pooled']) for (const w of ['IS', 'OOS', 'ALL']) { const x = markets[k][w]; console.log(k, w, x.n, 'net', x.netR, 't', x.t, 'gross', x.grossR, 'gt', x.grossT, '2x', x.net2R, 'cost', x.costR, 'fin', x.finR); }
  console.log(JSON.stringify(dec), JSON.stringify(Object.fromEntries(Object.entries(pl).map(([k, v]) => [k, [Math.min(...v), Math.max(...v)]]))));
}
