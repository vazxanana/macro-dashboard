// Stats for run.mjs output (NAS100 + SPX cash). Net R = size x (R - cost in R). Two drift adjustments:
//   adj   = net - size x mean net of the random-entry control, same market / year / side (as ict-universe)
//   adjRg = net - size x mean net of the control, same market / year / side / D1-200MA regime (stricter: removes trend-state drift)
// Writes result.json and prints the tables for RESULT.md.
//   node research/edge/ict-index-longonly/analyze.mjs <nas100.json> <spx.json> [result.json]
import fs from 'node:fs';

const [A, B] = [process.argv[2], process.argv[3]], OUT = process.argv[4] || 'research/edge/ict-index-longonly/result.json';
const T = [];
for (const f of [A, B]) { const J = JSON.parse(fs.readFileSync(f, 'utf8')); for (const r of J.trades) { const t = Object.fromEntries(J.cols.map((c, i) => [c, r[i]])); t.market = J.market; T.push(t); } }
for (const t of T) { const d = new Date(t.close * 1000); t.year = d.getUTCFullYear(); t.month = t.year * 100 + d.getUTCMonth() + 1; t.gross = t.size * t.Rraw; t.net = t.size * (t.Rraw - t.costR); t.ctrl = t.stream.startsWith('ctrl'); }
T.sort((a, b) => a.close - b.close);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const ctrlMean = (keyf) => { const g = new Map(); for (const t of T) if (t.ctrl) { const k = keyf(t), v = g.get(k) || [0, 0]; v[0] += t.net; v[1]++; g.set(k, v); } return new Map([...g].map(([k, v]) => [k, v[0] / v[1]])); };
const kY = (t) => `${t.market}|${t.year}|${t.side}`, kYR = (t) => `${t.market}|${t.year}|${t.side}|${t.ma200}`;
const CY = ctrlMean(kY), CYR = ctrlMean(kYR);
for (const t of T) { t.adj = t.net - t.size * (CY.get(kY(t)) ?? 0); t.adjRg = t.net - t.size * (CYR.get(kYR(t)) ?? CY.get(kY(t)) ?? 0); }

function stats(a, f = 'net') {
  const r = a.map((x) => x[f]), n = r.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  const R = r.reduce((s, x) => s + x, 0), m = R / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +R.toFixed(1), maxDD: +dd.toFixed(1), streak: ws, t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
// block bootstrap of the mean: calendar-month blocks resampled with replacement, 5000 reps, 95% percentile CI
function boot(a, f = 'adj', reps = 5000) {
  if (a.length < 10) return null;
  const by = new Map(); for (const t of a) { const v = by.get(t.month) || []; v.push(t[f]); by.set(t.month, v); }
  const blocks = [...by.values()], nb = blocks.length; let seed = 4242; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ms = []; for (let r = 0; r < reps; r++) { let s = 0, n = 0; for (let i = 0; i < nb; i++) { const b = blocks[Math.floor(rnd() * nb)]; for (const x of b) s += x; n += b.length; } ms.push(s / n); }
  ms.sort((x, y) => x - y); return { lo: +ms[Math.floor(0.025 * reps)].toFixed(3), hi: +ms[Math.floor(0.975 * reps)].toFixed(3), pPos: +(ms.filter((x) => x > 0).length / reps).toFixed(3), months: nb };
}
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const MK = ['nas100', 'spx'], MKS = [...MK, 'both'];
const sel = (mk, stream, extra = () => true) => T.filter((t) => (mk === 'both' || t.market === mk) && t.stream === stream && extra(t));
const IS = (t) => t.year < 2024, OOS = (t) => t.year >= 2024;
const f2 = (x) => (x == null ? '-' : (x >= 0 ? '+' : '') + x.toFixed(2));
const line = (s) => `${s.n} | ${s.wr == null ? '-' : (100 * s.wr).toFixed(0) + '%'} | ${f2(s.exp)} | ${s.R.toFixed(1)} | ${s.maxDD.toFixed(1)} | ${s.streak} | ${s.t ?? '-'}`;
const R = { streams: {}, bear: {}, regime: {}, years: {}, boot: {} };

// ---- overall per stream ----
console.log('## streams: IS (2018-23) || OOS (2024-26)  n | wr | exp | R | DD | streak | t || adj exp/t | adjRg exp/t');
for (const mk of MKS) for (const st of ['goldbuy', 'goldsell', 'index', 'ctrlbuy', 'ctrlsell']) {
  const a = sel(mk, st), o = { is: stats(a.filter(IS)), oos: stats(a.filter(OOS)), isAdj: stats(a.filter(IS), 'adj'), oosAdj: stats(a.filter(OOS), 'adj'), isAdjRg: stats(a.filter(IS), 'adjRg'), oosAdjRg: stats(a.filter(OOS), 'adjRg'), isGross: stats(a.filter(IS), 'gross'), oosGross: stats(a.filter(OOS), 'gross') };
  R.streams[`${mk}|${st}`] = o;
  console.log(`${mk} ${st} | ${line(o.is)} || ${line(o.oos)} || IS adj ${f2(o.isAdj.exp)}/${o.isAdj.t} OOS adj ${f2(o.oosAdj.exp)}/${o.oosAdj.t} || IS adjRg ${f2(o.isAdjRg.exp)}/${o.isAdjRg.t} OOS adjRg ${f2(o.oosAdjRg.exp)}/${o.oosAdjRg.t}`);
}
// index rule split by side
console.log('\n## index rule by side (net exp IS | OOS ; adj OOS)');
for (const mk of MKS) for (const s of [1, -1]) { const a = sel(mk, 'index', (t) => t.side === s); const k = `${mk}|index${s > 0 ? 'buy' : 'sell'}`;
  R.streams[k] = { is: stats(a.filter(IS)), oos: stats(a.filter(OOS)), isAdj: stats(a.filter(IS), 'adj'), oosAdj: stats(a.filter(OOS), 'adj') };
  console.log(`${k} | IS ${line(R.streams[k].is)} | OOS ${line(R.streams[k].oos)} | adj IS ${f2(R.streams[k].isAdj.exp)} OOS ${f2(R.streams[k].oosAdj.exp)}`); }

// ---- (1) bear / correction windows ----
const W = [['2018 Q4', '2018-10-01', '2019-01-01'], ['Feb-Mar 2020', '2020-02-01', '2020-04-01'], ['2022', '2022-01-01', '2023-01-01'], ['Aug 2024', '2024-08-01', '2024-09-01'], ['Apr 2025', '2025-04-01', '2025-05-01']].map(([n, a, b]) => [n, Date.parse(a) / 1000, Date.parse(b) / 1000]);
const inW = (w) => (t) => t.close >= w[1] && t.close < w[2], inAnyW = (t) => W.some((w) => inW(w)(t));
console.log('\n## bear windows: stream net exp (n) vs random control same side same window; edge = stream exp - control exp');
for (const mk of MKS) {
  R.bear[mk] = {};
  for (const w of [...W, ['ALL windows', 0, 0]]) {
    const f = w[0] === 'ALL windows' ? inAnyW : inW(w), row = {};
    for (const st of ['goldbuy', 'goldsell', 'index', 'ctrlbuy', 'ctrlsell']) row[st] = stats(sel(mk, st, f));
    // window-matched adjustment: each trade minus the control mean of its own window, market and side
    const wadj = (st) => { const a = sel(mk, st, f).map((t) => { const ww = W.find((x) => inW(x)(t)); const c = T.filter((x) => x.ctrl && x.market === t.market && x.side === t.side && inW(ww)(x)); return { ...t, wadj: t.net - t.size * mean(c.map((x) => x.net)) }; }); return { s: stats(a, 'wadj'), b: boot(a, 'wadj', 2000) }; };
    const gb = wadj('goldbuy'), gs = wadj('goldsell'), ix = wadj('index');
    row.goldbuyEdge = gb.s; row.goldsellEdge = gs.s; row.indexEdge = ix.s; row.goldbuyEdgeCI = gb.b;
    R.bear[mk][w[0]] = row;
    console.log(`${mk} ${w[0]} | goldbuy ${f2(row.goldbuy.exp)} (${row.goldbuy.n}, ${row.goldbuy.R}R) ctrlbuy ${f2(row.ctrlbuy.exp)} (${row.ctrlbuy.n}) edge ${f2(gb.s.exp)} t ${gb.s.t} | goldsell ${f2(row.goldsell.exp)} (${row.goldsell.n}, ${row.goldsell.R}R) ctrlsell ${f2(row.ctrlsell.exp)} edge ${f2(gs.s.exp)} t ${gs.s.t} | index ${f2(row.index.exp)} (${row.index.n}, ${row.index.R}R) edge ${f2(ix.s.exp)}${gb.b ? ` | goldbuy edge CI ${gb.b.lo}..${gb.b.hi}` : ''}`);
  }
}

// ---- (2) regime split (past-only) ----
console.log('\n## regime split: net exp (n) | adj exp | adjRg exp  — IS / OOS');
for (const mk of MKS) for (const st of ['goldbuy', 'goldsell', 'index', 'ctrlbuy', 'ctrlsell']) for (const [rn, rf] of [['ma200', 'ma200'], ['r20', 'r20']]) for (const v of [1, -1]) {
  const a = sel(mk, st, (t) => t[rf] === v), k = `${mk}|${st}|${rn}${v > 0 ? 'up' : 'down'}`;
  const o = { is: stats(a.filter(IS)), oos: stats(a.filter(OOS)), all: stats(a), isAdj: stats(a.filter(IS), 'adj'), oosAdj: stats(a.filter(OOS), 'adj'), allAdj: stats(a, 'adj'), allAdjRg: stats(a, 'adjRg'), oosAdjRg: stats(a.filter(OOS), 'adjRg') };
  R.regime[k] = o;
  console.log(`${k} | IS ${f2(o.is.exp)} (${o.is.n}) OOS ${f2(o.oos.exp)} (${o.oos.n}) all ${f2(o.all.exp)} t ${o.all.t} | adj all ${f2(o.allAdj.exp)} t ${o.allAdj.t} OOS ${f2(o.oosAdj.exp)} | adjRg all ${f2(o.allAdjRg.exp)} t ${o.allAdjRg.t}`);
}

// ---- (5) per year with drift adjustment ----
console.log('\n## per year: net R | net exp | adj exp | adjRg exp');
for (const mk of MKS) for (const st of ['goldbuy', 'goldsell', 'index', 'ctrlbuy', 'ctrlsell']) {
  const y = {}; for (const yr of YEARS) { const a = sel(mk, st, (t) => t.year === yr); y[yr] = { n: a.length, R: stats(a).R, exp: stats(a).exp, adj: stats(a, 'adj').exp, adjRg: stats(a, 'adjRg').exp }; }
  R.years[`${mk}|${st}`] = y;
  console.log(`${mk} ${st} R   | ${YEARS.map((yr) => y[yr].R.toFixed(1)).join(' | ')}`);
  console.log(`${mk} ${st} exp | ${YEARS.map((yr) => f2(y[yr].exp)).join(' | ')}`);
  if (!st.startsWith('ctrl')) { console.log(`${mk} ${st} adj | ${YEARS.map((yr) => f2(y[yr].adj)).join(' | ')}`); console.log(`${mk} ${st} adjRg | ${YEARS.map((yr) => f2(y[yr].adjRg)).join(' | ')}`); }
}
// ---- bootstrap CIs ----
console.log('\n## block bootstrap (month blocks) 95% CI of mean');
for (const mk of MKS) for (const st of ['goldbuy', 'goldsell', 'index']) for (const [pn, pf] of [['IS', IS], ['OOS', OOS], ['all', () => true]]) for (const f of ['net', 'adj', 'adjRg']) {
  const a = sel(mk, st, pf), b = boot(a, f), k = `${mk}|${st}|${pn}|${f}`; R.boot[k] = { exp: stats(a, f).exp, ...b };
  console.log(`${k} | exp ${f2(stats(a, f).exp)} | CI ${b ? `${b.lo} .. ${b.hi}  P(>0) ${b.pPos}` : '-'}`);
}
// ---- regime-gated variants (rules a trader could use; past-only) ----
const VAR = {
  'goldbuy | ma200 up': (t) => t.stream === 'goldbuy' && t.ma200 === 1,
  'goldbuy | r20 up': (t) => t.stream === 'goldbuy' && t.r20 === 1,
  'goldbuy | ma200 down': (t) => t.stream === 'goldbuy' && t.ma200 === -1,
  'goldbuy | r20 down': (t) => t.stream === 'goldbuy' && t.r20 === -1,
  'goldbuy ma200 up + goldsell ma200 down': (t) => (t.stream === 'goldbuy' && t.ma200 === 1) || (t.stream === 'goldsell' && t.ma200 === -1),
  'goldbuy + goldsell (both sides, no gate)': (t) => t.stream === 'goldbuy' || t.stream === 'goldsell',
};
console.log('\n## regime-gated variants: IS || OOS (net) | adj OOS | adjRg OOS | OOS CI adjRg | years+');
R.variants = {};
for (const mk of MKS) for (const [vn, vf] of Object.entries(VAR)) {
  const a = T.filter((t) => (mk === 'both' || t.market === mk) && vf(t)), yrs = YEARS.filter((y) => stats(a.filter((t) => t.year === y)).R > 0).length;
  const o = { is: stats(a.filter(IS)), oos: stats(a.filter(OOS)), oosAdj: stats(a.filter(OOS), 'adj'), oosAdjRg: stats(a.filter(OOS), 'adjRg'), isAdjRg: stats(a.filter(IS), 'adjRg'), ci: boot(a.filter(OOS), 'adjRg'), posYears: `${yrs}/9`, years: Object.fromEntries(YEARS.map((y) => [y, stats(a.filter((t) => t.year === y)).R])) };
  R.variants[`${mk}|${vn}`] = o;
  console.log(`${mk} ${vn} | ${line(o.is)} || ${line(o.oos)} | adj ${f2(o.oosAdj.exp)} | adjRg IS ${f2(o.isAdjRg.exp)} OOS ${f2(o.oosAdjRg.exp)} | CI ${o.ci ? o.ci.lo + '..' + o.ci.hi : '-'} | ${o.posYears} | yrs ${YEARS.map((y) => o.years[y].toFixed(1)).join(' ')}`);
}
fs.writeFileSync(OUT + '.raw.json', JSON.stringify(R));
// ---- result.json in the preamble's shape (pooled NAS100 + SPX; per-market cells too) ----
const pick = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t });
const yrsOf = (a) => Object.fromEntries(YEARS.map((y) => [y, stats(a.filter((t) => t.year === y)).R]));
const CAND = {
  'gold rule buys (as ict-universe)': (t) => t.stream === 'goldbuy',
  'gold rule buys | 20-day return < 0': (t) => t.stream === 'goldbuy' && t.r20 === -1,
  'gold rule buys | close < D1 200MA': (t) => t.stream === 'goldbuy' && t.ma200 === -1,
  'gold rule buys | 20-day return > 0': (t) => t.stream === 'goldbuy' && t.r20 === 1,
  'gold rule buys | close > D1 200MA': (t) => t.stream === 'goldbuy' && t.ma200 === 1,
  'mirror: gold rule sells': (t) => t.stream === 'goldsell',
  'gold rule both sides': (t) => t.stream === 'goldbuy' || t.stream === 'goldsell',
  'buys > 200MA + sells < 200MA': (t) => (t.stream === 'goldbuy' && t.ma200 === 1) || (t.stream === 'goldsell' && t.ma200 === -1),
};
const baseA = (mk) => sel(mk, 'index');
const result = {
  topic: 'ict-index-longonly',
  system: 'ICT desk H1 iFVG on NAS100/SPX cash (= NQ/ES), ict/tracker.mjs signals + isASetup/sizeOf, ict/replay.mjs simulate; HistData M1 2018-01..2026-10',
  baseline: { rule: 'current index A-rule (against daily bias, grade >= 7, stop 0.3-0.75x ATR + tight A+, DOL sizing, BE +1.5R), both directions, NAS100+SPX pooled',
    is: pick(stats(baseA('both').filter(IS))), oos: pick(stats(baseA('both').filter(OOS))), years: yrsOf(baseA('both')),
    driftAdj: { is: pick(stats(baseA('both').filter(IS), 'adj')), oos: pick(stats(baseA('both').filter(OOS), 'adj')) } },
  candidates: [],
  bearWindows: Object.fromEntries(MKS.map((mk) => [mk, Object.fromEntries(Object.entries(R.bear[mk]).map(([w, r]) => [w, { goldbuy: pick(r.goldbuy), ctrlbuy: pick(r.ctrlbuy), goldbuyEdge: pick(r.goldbuyEdge), goldsell: pick(r.goldsell), ctrlsell: pick(r.ctrlsell), goldsellEdge: pick(r.goldsellEdge), index: pick(r.index), indexEdge: pick(r.indexEdge) }]))])),
  bootstrap: R.boot,
  variantsTried: 26,
  notes: 'IS 2018-2023, OOS 2024-2026-10. net = size x (R - (0.02% of price + 0.25)/risk). adj = net minus random-entry control (same market/year/side); adjRg also matches the D1 200MA regime. Bootstrap = calendar-month blocks, 5000 reps. Regime features use only the last completed D1 candle. The index A-rule was designed on 2023-26 cash data, so its OOS is not clean; 2018-23 is. Variants: 3 rule streams + 2 controls; 2 regime gates x 2 states x 3 streams (12); 4 gated combos; 5 bear windows; 2 markets.',
};
for (const mk of MKS) for (const [rule, f] of Object.entries(CAND)) {
  const a = T.filter((t) => (mk === 'both' || t.market === mk) && f(t)), is = a.filter(IS), oos = a.filter(OOS), yr = yrsOf(a), pos = YEARS.filter((y) => yr[y] > 0).length;
  const oosAdj = stats(oos, 'adjRg'), ci = boot(oos, 'adjRg'), base = stats(baseA(mk).filter(OOS));
  const gate = oos.length >= 100 && stats(oos).exp > 0 && stats(oos).exp > base.exp && [2024, 2025, 2026].filter((y) => yr[y] > 0).length >= 2;
  const verdict = gate && stats(is).exp > 0 && pos >= 6 && ci && ci.lo > 0 ? 'PASS' : gate ? 'INCONCLUSIVE (preamble gate only)' : 'FAIL';
  result.candidates.push({ rule: `${mk === 'both' ? 'NAS100+SPX' : mk}: ${rule}`, is: pick(stats(is)), oos: pick(stats(oos)), isGross: pick(stats(is, 'gross')), oosGross: pick(stats(oos, 'gross')),
    driftAdj: { is: pick(stats(is, 'adjRg')), oos: pick(oosAdj), oosCI: ci }, years: yr, posYears: `${pos}/9`, verdict });
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log('\nverdicts'); for (const c of result.candidates) console.log(c.rule, '|', c.verdict, '| OOS', c.oos.n, c.oos.exp, '| adj', c.driftAdj.oos.exp, c.driftAdj.oosCI ? `${c.driftAdj.oosCI.lo}..${c.driftAdj.oosCI.hi}` : '', c.posYears);
console.log('\nwrote', OUT + '.raw.json', OUT);
