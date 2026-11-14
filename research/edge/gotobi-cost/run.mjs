// Edge research · gotobi-cost: cost accounting for the gotobi study's T2 fade (sell at 00:55 UTC on gotobi days, buy back at
// 06:00 UTC) on USD/JPY 2016-now and on GBP/AUD/CAD/CHF-JPY pooled 2010-now. The rule is frozen.mjs, a byte-for-byte copy of
// research/edge/gotobi/run.mjs (branch gotobi, 5f341e069). Costs never change a trade's path, so each trade is computed once
// with the frozen `trade` and its net R is recomputed for any round-trip cost x (spread + 2 x slippage, pips) with the
// commission kept at USD 22.5 per million a side. No rule is tested (PREREGISTRATION.md).
//   node research/edge/gotobi-cost/run.mjs <gotobiCandleDir> <replicateCandleDir>
//   (writes trades.json, result.json and RESULT.md here; `node run.mjs --from-trades` rebuilds the report from trades.json)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LEG = 'fade';
export const CROSSES = { gbpjpy: 'GBP/JPY', audjpy: 'AUD/JPY', cadjpy: 'CAD/JPY', chfjpy: 'CHF/JPY' };
export const X_ORIG = F.SPREAD_PIPS + 2 * F.SLIP_PIPS;          // 1.3 pips: the frozen costPx without its commission
export const GRID = [0, 0.5, 1, 1.3, 2, 2.6, 3, 4];
export const LO = -5, HI = 20, TOL = 0.001, T_TARGET = 2;

// ---- costs ---------------------------------------------------------------------------------------------------------------
export const commPx = (entry) => 2 * F.COMMISSION * entry;                       // USD 22.5 per million a side, in yen
export const costAt = (x, entry) => x * F.PIP + commPx(entry);                   // x = spread + 2 x slippage, pips
export const netAt = (t, x) => t.R - costAt(x, t.entry) / t.D;
// twice the original cost in R, as #878 / #889 reported it (spread, slippage and commission all doubled)
export const net2x = (t) => t.R - 2 * F.costPx(t.entry) / t.D;

// the candidate costs; `measured` says whether the figure was measured at 00:55 / 06:00 UTC on that pair
export const SOURCES = {
  orig: 'gotobi study assumption (PR #878): 0.3 pip spread + 0.5 pip slippage a side',
  fusion: 'Fusion Markets help centre average spreads (undated, all-day averages, account type not stated); web search 14 Nov 2026, page not opened',
  bc: 'BrokerChooser, Fusion Markets Zero account CHF/JPY spread; web search 14 Nov 2026, page not opened',
};
export const PUBLISHED = { usdjpy: 0.08, gbpjpy: 0.49, audjpy: 0.29, cadjpy: 0.49, chfjpy: 1.39 };
export const CANDIDATES = [
  { id: 'C1', name: 'Original assumption: 0.3 spread + 2 x 0.5 slippage', x: () => X_ORIG, src: 'orig', measured: false },
  { id: 'C2a', name: 'Published average spread, no slippage', x: (k) => PUBLISHED[k], src: 'fusion', measured: false },
  { id: 'C2b', name: 'Published average spread + 2 x 0.5 slippage', x: (k) => PUBLISHED[k] + 2 * F.SLIP_PIPS, src: 'fusion', measured: false },
];
export const CHF_ALT = { id: 'C3', name: 'CHF/JPY 0.8 pip published spread, no slippage / + 2 x 0.5 slippage', xs: [0.8, 1.8], src: 'bc', measured: false };

// ---- trades (the frozen rule, unchanged) ----------------------------------------------------------------------------------
const slim = (t) => ({ day: t.day, entry: t.entry, D: t.D, R: t.R, how: t.how });
// every Tokyo business day in [from, to] through the frozen trade; gotobi days only (gotobi-replicate's runLeg loop)
export function gotobiTrades(bars, from, to) {
  const ix = F.index(bars), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, LEG, d)); return moves.get(d); };
  const G = F.gotobiSet(+from.slice(0, 4) - 1, +to.slice(0, 4)), out = [];
  for (let d = from; d <= to; d = F.addD(d, 1)) {
    if (!F.isTokyoBusinessDay(d) || !G.has(d)) continue;
    const t = F.trade(ix, LEG, d, F.stopDist(moveOf, d));
    if (t) out.push(t);
  }
  return out;
}
// USD/JPY exactly as the frozen study runs it (runPair from the replication window's start), gotobi days
export function usdjpyTrades(bars, lastDay) {
  const { G, all } = F.runPair(bars, LEG, lastDay);
  return [...all.values()].filter((t) => G.has(t.day));
}

// ---- statistics at a cost --------------------------------------------------------------------------------------------------
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const r = (v, d) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
// trades: [{ day, entry, D, R, k? }]; xOf(trade) -> x in pips
export function statsAt(trades, xOf) {
  const net = trades.map((t) => netAt(t, xOf(t)));
  const mt = F.monthT(trades.map((t, i) => ({ day: t.day, net: net[i] })));
  return { n: trades.length, netR: mean(net), t: mt.t, months: mt.months, totalR: net.reduce((s, v) => s + v, 0) };
}
export const tAt = (trades, x) => statsAt(trades, () => x).t;
// x at which net R a trade = 0 (exact: linear in x)
export function breakEvenNet(trades) {
  return (mean(trades.map((t) => t.R)) - mean(trades.map((t) => commPx(t.entry) / t.D))) / mean(trades.map((t) => F.PIP / t.D));
}
// month t on a 0.1-pip grid over [LO, HI]: decreasing?
export function tGrid(trades, step = 0.1) {
  const g = []; for (let i = 0; LO + i * step <= HI + 1e-9; i++) { const x = Math.round((LO + i * step) * 10) / 10; g.push([x, tAt(trades, x)]); }
  return { grid: g, decreasing: g.every(([, t], i) => i === 0 || t < g[i - 1][1]) };
}
// x at which month t = 2, by bisection (null when t is under 2 at LO or over 2 at HI)
export function breakEvenT(trades, target = T_TARGET) {
  let a = LO, b = HI;
  if (tAt(trades, a) < target || tAt(trades, b) > target) return null;
  while (b - a > TOL / 4) { const m = (a + b) / 2; if (tAt(trades, m) >= target) a = m; else b = m; }
  return (a + b) / 2;
}
const allIn = (trades, x) => x + commPx(median(trades.map((t) => t.entry))) / F.PIP;

export function streamReport(trades, xOf) {
  const g = tGrid(trades), x0 = breakEvenNet(trades), x2 = g.decreasing ? breakEvenT(trades) : null;
  const atOrig = statsAt(trades, () => X_ORIG);
  const fmtS = (s) => ({ n: s.n, netR: r(s.netR, 4), t: r(s.t, 2), months: s.months, totalR: r(s.totalR, 1) });
  const x2t = trades.map(net2x), m2 = F.monthT(trades.map((t, i) => ({ day: t.day, net: x2t[i] })));
  return {
    n: trades.length, grossR: r(mean(trades.map((t) => t.R)), 4), medianStopPips: r(median(trades.map((t) => t.D)) / F.PIP, 1),
    medianEntry: r(median(trades.map((t) => t.entry)), 3), commissionPips: r(commPx(median(trades.map((t) => t.entry))) / F.PIP, 3),
    atOriginal: fmtS(atOrig),
    breakEven: { netZero: r(x0, 3), monthT2: r(x2, 3), netZeroAllIn: r(allIn(trades, x0), 3), monthT2AllIn: x2 == null ? null : r(allIn(trades, x2), 3), tDecreasing: g.decreasing },
    twiceOriginal: { netR: r(mean(x2t), 4), t: r(m2.t, 2) },
    grid: GRID.map((x) => ({ x, ...fmtS(statsAt(trades, () => x)) })),
    candidates: CANDIDATES.map((c) => ({ id: c.id, name: c.name, measured: c.measured, src: c.src, ...fmtS(statsAt(trades, (t) => c.x(t.k || 'usdjpy'))) })),
  };
}

export function study(T) {
  const uj = T.usdjpy.map((t) => ({ ...t, k: 'usdjpy' }));
  const ujDec = uj.filter((t) => t.day >= F.DECISIVE[0]), ujRep = uj.filter((t) => t.day >= F.REPLICATION[0] && t.day <= F.REPLICATION[1]);
  const pooled = Object.keys(CROSSES).flatMap((k) => T[k].map((t) => ({ ...t, k })));
  const per = Object.fromEntries(Object.entries(CROSSES).map(([k, name]) => {
    const tr = T[k].map((t) => ({ ...t, k })), s = streamReport(tr);
    if (k === 'chfjpy') s.chfAlt = CHF_ALT.xs.map((x) => ({ id: CHF_ALT.id, x, ...(({ n, netR, t }) => ({ n, netR: r(netR, 4), t: r(t, 2) }))(statsAt(tr, () => x)) }));
    return [k, { pair: name, ...s }];
  }));
  return { usdjpy2016: streamReport(ujDec), usdjpy2010: streamReport(ujRep), pooled: streamReport(pooled), crosses: per };
}

// ---- report --------------------------------------------------------------------------------------------------------------
const fmt = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const pp = (v, d = 2) => (v == null ? 'n/a' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
export function report(o) {
  const L = [], S = o.streams, U = S.usdjpy2016, P = S.pooled;
  const surv = (s) => s.candidates.filter((c) => c.id !== 'C1').map((c) => `${c.id} ${c.t >= T_TARGET ? 'keeps' : 'loses'} t >= 2 (${fmt(c.netR)}R, t ${fmt(c.t, 2)})`).join(', ');
  L.push('# Gotobi cost: what the fade after the 09:55 Tokyo fix costs, and where it breaks even', '');
  L.push(`**Verdict: ${o.verdict}.** The gotobi T2 fade breaks even at **${pp(U.breakEven.netZero)} pips** a round trip (spread + 2 x slippage, commission on top) on USD/JPY 2016-now and loses month t >= 2 above **${pp(U.breakEven.monthT2)} pips**; the four crosses pooled 2010-now break even at **${pp(P.breakEven.netZero)}** and lose t >= 2 above **${pp(P.breakEven.monthT2)}**. The study assumed 1.30. **Neither the spread nor the slippage at 00:55 and 06:00 UTC could be measured for any yen pair** (below); the only spreads found are a broker's published all-day averages, not measured here. On those: USD/JPY ${surv(U)}; crosses pooled ${surv(P)}. So the result survives the published averages only as far as they hold at those two minutes, which nobody has checked. Pre-registered in PREREGISTRATION.md (first commit of the branch); the rule is frozen.mjs, byte for byte. Paper research only; nothing live changed.`, '');
  L.push('## What could be measured', '');
  for (const m of o.measured) L.push(`- **${m.what}**: ${m.status}. ${m.detail}`);
  L.push('', '## Gate: the frozen rule at the original cost', '');
  L.push('| Stream | n | Net R a trade | Month t | Expected (RESULT.md of the PR) |', '|---|---|---|---|---|');
  L.push(`| USD/JPY 2016-now | ${U.atOriginal.n} | ${fmt(U.atOriginal.netR, 4)} | ${fmt(U.atOriginal.t, 2)} | n 771, +0.148, t 2.74 (#878) |`);
  L.push(`| Crosses pooled 2010-now | ${P.atOriginal.n} | ${fmt(P.atOriginal.netR, 4)} | ${fmt(P.atOriginal.t, 2)} | n 4784, +0.099, t 2.75 (#889) |`);
  L.push(`| USD/JPY 2016-now at 2 x the original cost | | ${fmt(U.twiceOriginal.netR, 4)} | ${fmt(U.twiceOriginal.t, 2)} | +0.035, t 0.65 (#878) |`);
  L.push(`| Crosses pooled at 2 x the original cost | | ${fmt(P.twiceOriginal.netR, 4)} | ${fmt(P.twiceOriginal.t, 2)} | +0.005, t 0.15 (#889) |`);
  L.push('', '## Break-even', '');
  L.push('x = spread + 2 x slippage, pips a round trip; the commission (USD 22.5 per million a side) comes on top. "All-in" adds the commission at the stream\'s median entry price.', '');
  L.push('| Stream | n | Gross R a trade | Median stop (pips) | Commission (pips, median price) | x at net 0 | all-in | x at month t = 2 | all-in | t falls with x |', '|---|---|---|---|---|---|---|---|---|---|');
  const be = (name, s) => L.push(`| ${name} | ${s.n} | ${fmt(s.grossR)} | ${s.medianStopPips} | ${pp(s.commissionPips)} | ${pp(s.breakEven.netZero)} | ${pp(s.breakEven.netZeroAllIn)} | ${pp(s.breakEven.monthT2)} | ${pp(s.breakEven.monthT2AllIn)} | ${s.breakEven.tDecreasing ? 'yes' : 'no'} |`);
  be('**USD/JPY 2016-now**', U); be('**Crosses pooled 2010-now**', P); be('USD/JPY 2010-15', S.usdjpy2010);
  for (const c of Object.values(S.crosses)) be(`${c.pair} 2010-now`, c);
  L.push('', '## At each candidate cost', '');
  L.push('| Candidate | Source | Measured at 00:55 / 06:00 UTC? | USD/JPY 2016-now: x | net R | month t | Crosses pooled: net R | month t |', '|---|---|---|---|---|---|---|---|');
  for (const [i, c] of U.candidates.entries()) {
    const p = P.candidates[i], xs = c.id === 'C1' ? '1.30' : c.id === 'C2a' ? pp(PUBLISHED.usdjpy) : pp(PUBLISHED.usdjpy + 1);
    L.push(`| ${c.id} ${c.name} | ${o.sources[c.src]} | no | ${xs} | ${fmt(c.netR)} | ${fmt(c.t, 2)} | ${fmt(p.netR)} | ${fmt(p.t, 2)} |`);
  }
  L.push(`| C4 twice the original cost (in R) | #878 / #889 | no | 2 x 1.30 + 2 x commission | ${fmt(U.twiceOriginal.netR)} | ${fmt(U.twiceOriginal.t, 2)} | ${fmt(P.twiceOriginal.netR)} | ${fmt(P.twiceOriginal.t, 2)} |`);
  L.push('', `Published spreads used for C2 (pips): ${Object.entries(PUBLISHED).map(([k, v]) => `${k.toUpperCase().replace('JPY', '/JPY')} ${v}`).join(', ')}. In the pooled stream each cross takes its own figure.`, '');
  L.push('### Each cross', '');
  L.push('| Cross | n | x at net 0 | x at t = 2 | C1 net R / t | C2a net R / t | C2b net R / t |', '|---|---|---|---|---|---|---|');
  for (const [k, c] of Object.entries(S.crosses)) { const q = (id) => { const z = c.candidates.find((y) => y.id === id); return `${fmt(z.netR)} / ${fmt(z.t, 2)}`; }; L.push(`| ${c.pair} (published ${PUBLISHED[k]}) | ${c.n} | ${pp(c.breakEven.netZero)} | ${pp(c.breakEven.monthT2)} | ${q('C1')} | ${q('C2a')} | ${q('C2b')} |`); }
  const ca = S.crosses.chfjpy.chfAlt;
  L.push('', `C3, CHF/JPY at the other published 0.8 pip spread (${o.sources.bc}): ${ca.map((z) => `x ${pp(z.x, 1)}: ${fmt(z.netR)}R, t ${fmt(z.t, 2)}`).join('; ')}.`, '');
  L.push('## The grid', '');
  L.push(`| x (pips) | ${GRID.map(String).join(' | ')} |`, `|---|${GRID.map(() => '---').join('|')}|`);
  for (const [name, s] of [['USD/JPY 2016-now net R', U], ['USD/JPY 2016-now month t', U], ['Crosses pooled net R', P], ['Crosses pooled month t', P]])
    L.push(`| ${name} | ${s.grid.map((g) => (name.endsWith(' t') ? fmt(g.t, 2) : fmt(g.netR))).join(' | ')} |`);
  L.push('', '## Notes', '');
  for (const n of o.notes) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

export const MEASURED = [
  { what: 'Commission', status: 'measured for the broker\'s forex symbols, assumed for yen pairs', detail: 'council-data ctrader/symbols.json gives commissionRT 0.000045 (USD 22.5 per million a side, commissionType 1) on EUR/USD, GBP/USD, AUD/USD, USD/CAD and USD/CHF; no yen pair is on the demo account, so the same forex rate is assumed for them.' },
  { what: 'OANDA bid / ask history', status: 'not reachable', detail: 'api/bars.js asks OANDA for mid candles only (price "M") and the proxy serves nothing else; api/ was not changed. api/stream.js does carry live bid / ask, but today (14 Nov 2026) is a Saturday, markets shut, so no read at 00:55 or 06:00 UTC was possible.' },
  { what: 'Broker spread log', status: 'no yen pair', detail: 'ctrader/symbols.json has never held a yen pair (git log -S on council-data finds none). Context only: on 13 Nov 2026, itself a gotobi day (the 15th rolled back), the five USD majors were quoted at 0.0 to 0.1 pip at the reads of 00:31, 00:43, 00:56, 01:08 and 05:31-06:25 UTC (a raw-spread account; one day, majors, not yen).' },
  { what: 'Demo fills (slippage)', status: 'no yen pair', detail: 'no ctrader/mirror*.json holds a yen-pair copy, and none of today\'s files holds a forex major fill either (the earlier majors measure, median 0 pip from the council price, is in CLAUDE.md "Forex spreads", all hours, majors only).' },
  { what: 'Published spreads', status: 'not measured here', detail: 'the broker\'s own help centre lists average spreads of 0.08 (USD/JPY), 0.49 (GBP/JPY), 0.29 (AUD/JPY), 0.49 (CAD/JPY), 1.39 (CHF/JPY) pips, undated and over the whole day; a broker comparison site gives 0.8 for CHF/JPY. Figures from a web search on 14 Nov 2026 (pages not opened). Asian-morning and pre-London spreads on the crosses may differ from an all-day average.' },
];

function notes(o) {
  const U = o.streams.usdjpy2016, P = o.streams.pooled;
  return [
    'Costs never change a trade\'s path in the frozen rule (the stop and the exit are price-based), so every figure here is the same set of trades re-costed; n does not move with x.',
    `The gross edge is ${fmt(U.grossR)}R a trade on USD/JPY 2016-now with a median stop of ${U.medianStopPips} pips, so each pip a round trip costs about ${(1 / U.medianStopPips).toFixed(3)}R at the median (the mean of 1 / D is what counts: shorter stops pay more in R).`,
    `The commission alone is about ${pp(U.commissionPips)} pips a round trip on USD/JPY at the median price of ${U.medianEntry} (and ${pp(P.commissionPips)} on the crosses pooled), which is why the x at net 0 is below the gross-edge-in-pips.`,
    'How to measure the missing figure: read bid / ask of USD/JPY and the four crosses at 00:55 and 06:00 UTC on real gotobi mornings (the price stream already carries both sides; a demo account with the yen pairs would add the broker\'s own quote and fills). Not done here; it needs weekdays and a writer that does not exist yet.',
    'This study tests nothing: the gotobi verdict (PASS, T2) and the replication (REPLICATES) stand as written; this only says how much cost room they have.',
  ];
}

async function main() {
  const args = process.argv.slice(2);
  let T, data;
  if (args[0] === '--from-trades') {
    const j = JSON.parse(fs.readFileSync(path.join(HERE, 'trades.json'), 'utf8'));
    data = j.data; T = Object.fromEntries(Object.entries(j.trades).map(([k, rows]) => [k, rows.map(([day, entry, D, R]) => ({ day, entry, D, R }))]));
  } else {
    const [gdir, rdir] = args;
    if (!gdir || !rdir) throw new Error('usage: node run.mjs <gotobiCandleDir> <replicateCandleDir> | --from-trades');
    const rd = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
    const uj = rd(path.join(gdir, 'usdjpy-5m.json.gz')), cross = {};
    for (const k of Object.keys(CROSSES)) cross[k] = rd(path.join(rdir, `${k}-5m.json.gz`));
    const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
    const ujLast = F.addD(day(uj.at(-1)[0]), -1);
    const lastDay = F.addD(day(Math.min(...Object.values(cross).map((b) => b.at(-1)[0]), uj.at(-1)[0])), -1);
    T = { usdjpy: usdjpyTrades(uj, ujLast).map(slim) };
    for (const k of Object.keys(CROSSES)) T[k] = gotobiTrades(cross[k], '2010-01-01', lastDay).map(slim);
    data = { source: 'OANDA mid M5 through the /md/bars proxy (the gotobi and gotobi-replicate candle files)', usdjpyLastDay: ujLast, crossesLastDay: lastDay };
    const rows = Object.fromEntries(Object.entries(T).map(([k, a]) => [k, a.map((t) => [t.day, t.entry, t.D, t.R])]));
    fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify({ note: 'the frozen T2 fade on gotobi days, one row per trade: [Tokyo day, entry, stop distance D, gross R]; costs are applied by run.mjs', data, trades: rows }) + '\n');
  }
  const o = {
    study: 'gotobi-cost', built: '2026-11-14', kind: 'cost accounting, no rule tested',
    original: { branch: 'gotobi', commit: '5f341e069', file: 'research/edge/gotobi/run.mjs', test: 'T2', pr: 878, replication: 889 },
    verdict: 'inconclusive on cost (cost accounting only, no rule tested)',
    data, costModel: { x: 'spread + 2 x slippage, pips a round trip', commissionPerMillionASide: F.COMMISSION * 1e6, pip: F.PIP, original: X_ORIG },
    sources: SOURCES, published: PUBLISHED, measured: MEASURED, streams: study(T),
  };
  o.notes = notes(o);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(o, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(o));
  for (const [k, s] of Object.entries(o.streams)) if (s.breakEven) console.log(k, s.n, JSON.stringify(s.atOriginal), JSON.stringify(s.breakEven), JSON.stringify(s.twiceOriginal));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
