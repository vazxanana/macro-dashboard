// Edge research · gotobi-replicate: the gotobi study's T2 (sell USD/JPY at the 09:55 Tokyo fix on gotobi days, buy back at
// 15:00 Tokyo) run unchanged on data it was never fitted to. R1: GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY, 2010-now, pooled. R2:
// USD/JPY before 2010. The rule is frozen.mjs, a byte-for-byte copy of research/edge/gotobi/run.mjs (branch gotobi, 5f341e069);
// nothing of it is re-implemented here (PREREGISTRATION.md).
//   node research/edge/gotobi-replicate/run.mjs <candleDir> <gotobiCandleDir>
//   (<candleDir>: what fetch.mjs wrote; <gotobiCandleDir>: the gotobi study's usdjpy-5m.json.gz, for the gate and R2's lookback)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- what differs from the original: the market list (and R2's years) ----------------------------------------------------
export const LEG = 'fade';                                        // the original's T2 leg
export const ORIGINAL = { test: 'T2', pair: 'usdjpy', leg: 'fade' };
export const CROSSES = { gbpjpy: 'GBP/JPY', audjpy: 'AUD/JPY', cadjpy: 'CAD/JPY', chfjpy: 'CHF/JPY' };
// costs per cross: the frozen formula unchanged (0.3 pip spread assumed for every cross, 0.5 pip slippage a side, USD 22.5
// per million a side = 22.5e-6 x the cross's price); the trade function charges F.costPx
export const COSTS = Object.fromEntries(Object.keys(CROSSES).map((k) => [k, { spreadPips: F.SPREAD_PIPS, slipPipsASide: F.SLIP_PIPS, commissionASide: F.COMMISSION, pip: F.PIP, spreadMeasured: false }]));
export const R1_WINDOW = ['2010-01-01', null], R2_WINDOW = [null, '2009-12-31'];
export const R1_MIN_TRADES = 400, R2_T_BAR = 1.5, T_BAR = F.T_BAR, SEEDS = F.SEEDS, P_RANK = F.P_RANK;

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);
const inWin = (d, [a, b]) => (a == null || d >= a) && (b == null || d <= b);

// every Tokyo business day in [from, to], each run through the frozen trade; the same loop as the frozen runPair
export function runLeg(bars, from, to) {
  const ix = F.index(bars), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, LEG, d)); return moves.get(d); };
  const G = F.gotobiSet(+from.slice(0, 4) - 1, +to.slice(0, 4)), all = new Map(), noData = { gotobi: 0, other: 0 }, days = [];
  for (let d = from; d <= to; d = F.addD(d, 1)) {
    if (!F.isTokyoBusinessDay(d)) continue;
    days.push(d);
    const t = F.trade(ix, LEG, d, F.stopDist(moveOf, d));
    if (t) all.set(d, t); else noData[G.has(d) ? 'gotobi' : 'other']++;
  }
  const got = [...all.values()].filter((t) => G.has(t.day)), pool = [...all.values()].filter((t) => !G.has(t.day));
  return { G, days, got, pool, noData, gotobiDays: days.filter((d) => G.has(d)).length };
}

// the original's summary, plus the 2 x cost figure
export function summ(trades) {
  const s = F.summary(trades);
  if (!s.n) return s;
  const x2 = trades.map((t) => t.R - 2 * t.costR), m = new Map();
  for (const t of trades) { const k = t.day.slice(0, 7); m.set(k, (m.get(k) || 0) + t.R - 2 * t.costR); }
  const v = [...m.values()], mu = mean(v), sd = Math.sqrt(v.reduce((a, q) => a + (q - mu) ** 2, 0) / (v.length - 1));
  return { ...s, netR2x: r4(mean(x2)), t2x: v.length >= 3 ? Math.round(mu / (sd / Math.sqrt(v.length)) * 100) / 100 : null };
}
// the original's placebo: per seed, F.draw the same number of non-gotobi days from each market's pool; pooled net R a trade
export function placebo(parts) {
  const vals = [];
  for (let s = 1; s <= SEEDS; s++) {
    const nets = [];
    for (const p of parts) for (const t of F.draw(p.pool, p.n, s)) nets.push(t.net);
    vals.push(mean(nets));
  }
  const sorted = [...vals].sort((a, b) => a - b);
  return { seeds: SEEDS, rank: P_RANK, p95: r4(sorted[P_RANK - 1]), median: r4(median(vals)), values: vals.map(r4) };
}
const byYear = (trades) => {
  const y = {}; for (const t of trades) (y[t.day.slice(0, 4)] ||= []).push(t);
  return Object.fromEntries(Object.entries(y).map(([k, a]) => { const s = F.summary(a); return [k, { n: s.n, netR: s.netR, totalR: s.totalR }]; }));
};

export function r1(cross, lastDay) {
  const per = {}, parts = [], pooled = [];
  for (const [k, name] of Object.entries(CROSSES)) {
    const run = runLeg(cross[k], R1_WINDOW[0], lastDay);
    const got = run.got, pool = run.pool;
    parts.push({ pool, n: got.length }); pooled.push(...got);
    const pl = placebo([{ pool, n: got.length }]);
    per[k] = {
      pair: name, costs: COSTS[k], gotobiDays: run.gotobiDays, noData: run.noData,
      all: summ(got), h2016: summ(got.filter((t) => t.day >= '2016-01-01')), h2010: summ(got.filter((t) => t.day < '2016-01-01')),
      placebo: { ...pl, beats: pl.values.filter((v) => F.summary(got).netR > v).length },
      everyOtherDay: F.summary(pool), byYear: byYear(got), afterVerdict: { corrWithUsdjpyT2: corrWithUsdjpy(got, GATE_TRADES) },
    };
  }
  const all = summ(pooled), pl = placebo(parts), pos = Object.values(per).filter((c) => c.all.netR > 0).length;
  const checks = {
    pooledNetPositive: all.netR > 0, pooledMonthT: all.t != null && all.t >= T_BAR,
    crossesPositive: pos >= 3, placebo: all.netR > pl.p95,
  };
  return {
    window: [R1_WINDOW[0], lastDay], crosses: per,
    pooled: { all, h2016: summ(pooled.filter((t) => t.day >= '2016-01-01')), h2010: summ(pooled.filter((t) => t.day < '2016-01-01')), byYear: byYear(pooled), positiveCrosses: pos, pOneSided: all.t == null ? 1 : r4(1 - F.normCdf(all.t)) },
    placebo: { ...pl, beats: pl.values.filter((v) => all.netR > v).length },
    checks, pass: Object.values(checks).every(Boolean), enoughTrades: all.n >= R1_MIN_TRADES,
  };
}

export function r2(bars) {
  const first = new Date(bars[0][0] * 1000).toISOString().slice(0, 10);
  const run = runLeg(bars, first, R2_WINDOW[1]);
  const s = summ(run.got), pl = placebo([{ pool: run.pool, n: run.got.length }]);
  const checks = { netPositive: s.netR > 0, monthT: s.t != null && s.t >= R2_T_BAR };
  return {
    pair: 'USD/JPY', window: [run.got.length ? run.got[0].day : first, R2_WINDOW[1]], firstCandle: first,
    gotobiDays: run.gotobiDays, noData: run.noData, all: s, byYear: byYear(run.got),
    placebo: { ...pl, beats: pl.values.filter((v) => s.netR > v).length }, everyOtherDay: F.summary(run.pool),
    checks, pass: Object.values(checks).every(Boolean),
  };
}

let GATE_TRADES = [];
// read after the verdict: how closely each cross's gotobi-day net R moves with USD/JPY's own T2 trade on the same day
export function corrWithUsdjpy(crossTrades, ujTrades) {
  const u = new Map(ujTrades.map((t) => [t.day, t.net])), x = [], y = [];
  for (const t of crossTrades) if (u.has(t.day)) { x.push(t.net); y.push(u.get(t.day)); }
  const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return { days: x.length, r: Math.round(sxy / Math.sqrt(sxx * syy) * 100) / 100 };
}
// the gate: the frozen file's own T2 on the gotobi study's USD/JPY file must give the original's figures
export function gate(usdjpy, lastDay) {
  const { G, all } = F.runPair(usdjpy, LEG, lastDay);
  const got = [...all.values()].filter((t) => G.has(t.day));
  GATE_TRADES = got;
  return { decisive: summ(got.filter((t) => t.day >= F.DECISIVE[0])), replication: summ(got.filter((t) => t.day >= F.REPLICATION[0] && t.day <= F.REPLICATION[1])) };
}

export function verdictOf(R1, R2) {
  if (!R1.enoughTrades) return `INCONCLUSIVE (R1 has ${R1.pooled.all.n} trades, under ${R1_MIN_TRADES}; R2 ${R2.pass ? 'passes' : 'fails'})`;
  return R1.pass ? 'REPLICATES' : 'DOES NOT REPLICATE';
}

const fmt = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const yn = (b) => (b ? 'yes' : 'no');
export function report(o) {
  const L = [], R1 = o.r1, R2 = o.r2, P = R1.pooled.all;
  L.push('# Gotobi replication: the fade after the 09:55 Tokyo fix on four other yen crosses, and on USD/JPY before 2010', '');
  const why = R1.pass ? 'All four R1 conditions hold' : `R1 fails on ${Object.entries(R1.checks).filter(([, v]) => !v).map(([k]) => ({ pooledNetPositive: 'pooled net R > 0', pooledMonthT: 'pooled month t >= 2', crossesPositive: '3 of 4 crosses positive', placebo: 'the placebo' })[k]).join(', ')}`;
  L.push(`**Verdict: ${o.verdict}.** ${why}: pooled GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY ${R1.window[0]} to ${R1.window[1]}, n ${P.n}, ${fmt(P.netR)}R a trade net, month t ${fmt(P.t, 2)}, ${R1.pooled.positiveCrosses} of 4 crosses positive, placebo 95th percentile ${fmt(R1.placebo.p95)}R. R2 (USD/JPY ${R2.window[0]} to ${R2.window[1]}, supporting only): n ${R2.all.n}, ${fmt(R2.all.netR)}R, month t ${fmt(R2.all.t, 2)}, ${R2.pass ? 'passes' : 'fails'} its bar (net R > 0 and t >= 1.5). The rule is the gotobi study's T2, frozen byte for byte (frozen.mjs); pre-registered in PREREGISTRATION.md (first commit of the branch). Paper research only; nothing live changed.`, '');
  L.push('## Results', '');
  L.push('| Market | Window | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Months | Win % | Stopped % | Median stop (pips) | Net R at 2 x cost | Month t at 2 x cost |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (name, w, s) => L.push(`| ${name} | ${w} | ${s.n} | ${fmt(s.netR)} | ${fmt(s.grossR)} | ${s.costR.toFixed(3)} | ${fmt(s.totalR, 1)} | ${fmt(s.t, 2)} | ${s.months} | ${(s.win * 100).toFixed(1)} | ${(s.stopShare * 100).toFixed(1)} | ${s.stopPips} | ${fmt(s.netR2x)} | ${fmt(s.t2x, 2)} |`);
  for (const c of Object.values(R1.crosses)) row(c.pair, '2010-now', c.all);
  row('**R1 pooled**', '2010-now', P);
  row('R1 pooled', '2016-now', R1.pooled.h2016);
  row('R1 pooled', '2010-15', R1.pooled.h2010);
  row('**R2 USD/JPY**', `${R2.window[0].slice(0, 7)} to 2009`, R2.all);
  row('Original T2 USD/JPY (gate)', '2016-now', o.gate.decisive);
  row('Original T2 USD/JPY (gate)', '2010-15', o.gate.replication);
  L.push('', '## The pre-registered conditions', '');
  L.push('| R1 condition | Value | Holds |', '|---|---|---|');
  L.push(`| Pooled net R a trade > 0 | ${fmt(P.netR)} | ${yn(R1.checks.pooledNetPositive)} |`);
  L.push(`| Pooled month t >= 2 | ${fmt(P.t, 2)} | ${yn(R1.checks.pooledMonthT)} |`);
  L.push(`| At least 3 of 4 crosses positive | ${R1.pooled.positiveCrosses} of 4 | ${yn(R1.checks.crossesPositive)} |`);
  L.push(`| Above the placebo's 95th percentile (38th of 40) | ${fmt(R1.placebo.p95)} (above ${R1.placebo.beats} of 40) | ${yn(R1.checks.placebo)} |`);
  L.push(`| R2: net R > 0 and month t >= 1.5 | ${fmt(R2.all.netR)}, t ${fmt(R2.all.t, 2)} | ${yn(R2.pass)} |`);
  L.push('', '## Placebo and every other day', '');
  L.push('Each seed draws, from each market\'s non-gotobi Tokyo business days of the same window, as many days as that market has gotobi trades and runs the identical leg (the original\'s design). "Every other day" is the leg on all of them.', '');
  L.push('| Market | Placebo median net R | Placebo 95th pct | Beats | Every non-gotobi day: n | net R | month t |', '|---|---|---|---|---|---|---|');
  for (const c of Object.values(R1.crosses)) L.push(`| ${c.pair} | ${fmt(c.placebo.median)} | ${fmt(c.placebo.p95)} | ${c.placebo.beats} of 40 | ${c.everyOtherDay.n} | ${fmt(c.everyOtherDay.netR)} | ${fmt(c.everyOtherDay.t, 2)} |`);
  L.push(`| R1 pooled | ${fmt(R1.placebo.median)} | ${fmt(R1.placebo.p95)} | ${R1.placebo.beats} of 40 | | | |`);
  L.push(`| R2 USD/JPY | ${fmt(R2.placebo.median)} | ${fmt(R2.placebo.p95)} | ${R2.placebo.beats} of 40 | ${R2.everyOtherDay.n} | ${fmt(R2.everyOtherDay.netR)} | ${fmt(R2.everyOtherDay.t, 2)} |`);
  L.push('', '## By year (net R total, gotobi trades)', '');
  const ys = [...new Set([...Object.keys(R1.pooled.byYear)])].sort();
  L.push(`| Market | ${ys.join(' | ')} |`, `|---|${ys.map(() => '---').join('|')}|`);
  for (const c of Object.values(R1.crosses)) L.push(`| ${c.pair} | ${ys.map((y) => (c.byYear[y] ? fmt(c.byYear[y].totalR, 1) : '')).join(' | ')} |`);
  L.push(`| Pooled | ${ys.map((y) => (R1.pooled.byYear[y] ? fmt(R1.pooled.byYear[y].totalR, 1) : '')).join(' | ')} |`);
  const y2 = Object.keys(R2.byYear).sort();
  L.push('', `R2 USD/JPY by year: ${y2.map((y) => `${y} ${fmt(R2.byYear[y].totalR, 1)}R (n ${R2.byYear[y].n})`).join(', ')}.`);
  L.push('', '## Notes', '');
  for (const n of o.notes) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

function NOTES(o) {
  const n = [], R1 = o.r1;
  if (!R1.pooled) return n;
  n.push(`Data: OANDA mid M5 through the /md/bars proxy, only candles starting 00:00-06:55 UTC kept. Crosses from ${Object.entries(o.data.first).filter(([k]) => k !== 'usdjpyPre').map(([k, v]) => `${CROSSES[k]} ${v}`).join(', ')}; USD/JPY before 2009-11 from ${o.data.first.usdjpyPre}, joined to the gotobi study's file for the lookback; through ${o.data.lastDay}. Gotobi days lost to missing candles: ${Object.values(R1.crosses).map((c) => `${c.pair} ${c.noData.gotobi} of ${c.gotobiDays}`).join(', ')}, USD/JPY R2 ${o.r2.noData.gotobi} of ${o.r2.gotobiDays}.`);
  n.push(`Gate: the frozen file's own loop on the gotobi study's USD/JPY file gives T2 2016-now n ${o.gate.decisive.n}, ${fmt(o.gate.decisive.netR, 4)}R, month t ${fmt(o.gate.decisive.t, 2)} and 2010-15 n ${o.gate.replication.n}, ${fmt(o.gate.replication.netR, 4)}R, t ${fmt(o.gate.replication.t, 2)} (the original's RESULT.md: n 771, +0.148R, t 2.74; +0.131R, t 2.45).`);
  n.push('Costs: the frozen formula on every cross (0.3 pip spread + 2 x 0.5 pip slippage + 2 x USD 22.5 per million). The 0.3 pip spread on the four crosses is ASSUMED, not measured; crosses usually quote wider on a raw-spread account, so the 2 x cost columns are the more cautious reading. They are reported, not a condition.');
  const P = R1.pooled.all;
  n.push(`Costs decide it: before costs the pooled fade makes ${fmt(P.grossR)}R a trade, the assumed cost takes ${P.costR.toFixed(3)}R, and at twice the cost the pooled figure is ${fmt(P.netR2x)}R (month t ${fmt(P.t2x, 2)}); per cross at 2 x cost: ${Object.values(R1.crosses).map((c) => `${c.pair} ${fmt(c.all.netR2x)}`).join(', ')}. The 0.3 pip cross spread is not measured, so whether the crosses keep a net edge at a real broker's cross spreads is open.`);
  n.push(`Read after the verdict, not part of it: the crosses are not independent evidence of USD/JPY's flow. Correlation of a gotobi day's net R with USD/JPY's own T2 trade the same day (2010-now): ${Object.values(R1.crosses).map((c) => `${c.pair} ${c.afterVerdict.corrWithUsdjpyT2.r} (${c.afterVerdict.corrWithUsdjpyT2.days} days)`).join(', ')}. What replicates is the yen leg on the same days, as the hypothesis said; it is not four more markets' worth of independent days. Pooled halves: 2016-now ${fmt(R1.pooled.h2016.netR)}R (n ${R1.pooled.h2016.n}, t ${fmt(R1.pooled.h2016.t, 2)}), 2010-15 ${fmt(R1.pooled.h2010.netR)}R (n ${R1.pooled.h2010.n}, t ${fmt(R1.pooled.h2010.t, 2)}).`);
  n.push(`R2 caveat, read after the verdict: on USD/JPY 2005-09 the same fade on every NON-gotobi day also made ${fmt(o.r2.everyOtherDay.netR)}R a trade (n ${o.r2.everyOtherDay.n}, month t ${fmt(o.r2.everyOtherDay.t, 2)}; the yen rose through 2007-09), so part of R2's ${fmt(o.r2.all.netR)}R is the yen's trend of those years; the gotobi days still beat all 40 placebo draws (95th percentile ${fmt(o.r2.placebo.p95)}R).`);
  n.push('The month t is on calendar-month sums of net R (pooled: the four crosses\' trades of a month summed); the trades of a gotobi day on four yen crosses are strongly correlated (one yen flow), so the pooled n overstates the independent evidence; the month sums carry that correlation.');
  return n;
}

async function main() {
  const [dir, gdir] = process.argv.slice(2);
  if (!dir || !gdir) throw new Error('usage: node run.mjs <candleDir> <gotobiCandleDir>');
  const rd = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  const cross = {}; for (const k of Object.keys(CROSSES)) cross[k] = rd(path.join(dir, `${k}-5m.json.gz`));
  const uj = rd(path.join(gdir, 'usdjpy-5m.json.gz')), pre = rd(path.join(dir, 'usdjpy-pre.json.gz'));
  const lastT = Math.min(...Object.values(cross).map((b) => b.at(-1)[0]), uj.at(-1)[0]);
  const lastDay = F.addD(new Date(lastT * 1000).toISOString().slice(0, 10), -1);
  const ujLast = F.addD(new Date(uj.at(-1)[0] * 1000).toISOString().slice(0, 10), -1);
  const cut = Date.parse('2010-03-01T00:00:00Z') / 1000;
  const r2bars = [...pre.filter((b) => b[0] < uj[0][0]), ...uj.filter((b) => b[0] < cut)];
  const o = {
    study: 'gotobi-replicate', built: '2026-11-14', original: { branch: 'gotobi', commit: '5f341e069', file: 'research/edge/gotobi/run.mjs', test: ORIGINAL },
    rule: 'The gotobi study\'s T2, frozen: on gotobi days (5, 10, 15, 20, 25 and the last Tokyo business day, rolled back), sell at 00:55 UTC (09:55 Tokyo), buy back at 06:00 UTC (15:00 Tokyo); stop 1.5 x the 20-business-day median of the same window\'s absolute move; net of 0.3 pip spread, USD 22.5 per million a side and 0.5 pip slippage a side.',
    data: { source: 'OANDA mid M5 through the /md/bars proxy, candles starting 00:00-06:55 UTC', first: { ...Object.fromEntries(Object.entries(cross).map(([k, b]) => [k, new Date(b[0][0] * 1000).toISOString().slice(0, 10)])), usdjpyPre: new Date(pre[0][0] * 1000).toISOString().slice(0, 10) }, lastDay },
    bar: { r1: { pooledNetR: '> 0', pooledMonthT: T_BAR, crossesPositive: '>= 3 of 4', placebo: { seeds: SEEDS, rank: P_RANK }, minTrades: R1_MIN_TRADES }, r2: { netR: '> 0', monthT: R2_T_BAR } },
    gate: gate(uj, ujLast), r1: r1(cross, lastDay), r2: r2(r2bars),
  };
  o.verdict = verdictOf(o.r1, o.r2);
  o.notes = NOTES(o);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(o, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(o));
  console.log(o.verdict, JSON.stringify(o.r1.pooled.all), JSON.stringify(o.r1.checks), 'p95', o.r1.placebo.p95);
  for (const c of Object.values(o.r1.crosses)) console.log(c.pair, JSON.stringify(c.all));
  console.log('R2', JSON.stringify(o.r2.all), o.r2.pass, 'gate', JSON.stringify(o.gate));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
