// ICT A-setups × Macro strategist regime (7 Nov 2026). Pre-registration: preregistration.md (written before any split).
// For each closed A-setup in council-data ict/replay.json, the regime of the trade's UTC day as council/macro.mjs computes it
// (features + drivers, unchanged; data before the day only), then R split by VIX level, VIX curve, Dollar Smile side and
// credit stress, and the two pre-registered filters tested against the Coach's bar with a multiple-testing correction.
// Paper research only: reads data, changes no rule.
//
// Usage: node research/edge/ict-macro/analyse.mjs <replay.json> <macro/cache.json> [outDir=research/edge/ict-macro]
// Data: macro.mjs gather() (FRED fredgraph.csv → Cboe → US Treasury → the cache file; prices from meridianx.dev/md/bars).
// On GitHub Actions FRED answers and the cache is not needed; in a sandbox that blocks FRED the cache is what the
// Macro strategist itself fetched from FRED on Actions.
import fs from 'node:fs';
import path from 'node:path';
import { gather, features, drivers, LAG, iso } from '../../../council/macro.mjs';

const [replayPath, cachePath, outDir = 'research/edge/ict-macro'] = process.argv.slice(2);
if (!replayPath || !cachePath) { console.error('usage: analyse.mjs <replay.json> <macro/cache.json> [outDir]'); process.exit(2); }
const DAY = 86400;
const r3 = (x) => (x == null || !isFinite(x) ? null : +(+x).toFixed(3));

// ─── statistics ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function betacf(a, b, x) {
  let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d); let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-300 ? 1e-300 : c; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-300 ? 1e-300 : c; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}
function lgamma(z) { const g = 7, C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1; let x = C[0]; for (let i = 1; i < g + 2; i++) x += C[i] / (z + i); const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// P(T <= t) for Student t with df degrees of freedom
export const tCdf = (t, df) => { const x = df / (df + t * t), p = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? 1 - p : p; };

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function stats(rs) {
  const n = rs.length; if (!n) return { n: 0 };
  const m = mean(rs), sd = n > 1 ? Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0, t = sd > 0 ? m / (sd / Math.sqrt(n)) : 0;
  return { n, R: r3(rs.reduce((s, x) => s + x, 0)), exp: r3(m), wr: r3(rs.filter((x) => x > 0).length / n), t: r3(t), pLow: n > 1 && sd > 0 ? r3(tCdf(t, n - 1)) : null };
}
function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a), mb = mean(b), va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (a.length - 1), vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (b.length - 1);
  const se = Math.sqrt(va / a.length + vb / b.length); if (!(se > 0)) return null;
  const t = (ma - mb) / se, df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  return { diff: r3(ma - mb), t: r3(t), p2: r3(2 * Math.min(tCdf(t, df), 1 - tCdf(t, df))) };
}
// a group of trades: stats, both halves by close time (split by count, as ictVariantVerdicts does), Welch vs the rest
function cell(rows, rest) {
  const s = rows.slice().sort((x, y) => x.closed - y.closed), h = s.length >> 1;
  return { ...stats(s.map((x) => x.R)), h1: stats(s.slice(0, h).map((x) => x.R)), h2: stats(s.slice(h).map((x) => x.R)),
    from: s.length ? iso(s[0].signalAt) : null, to: s.length ? iso(s[s.length - 1].signalAt) : null, vsRest: welch(rows.map((x) => x.R), rest.map((x) => x.R)) };
}
// Holm step-down adjusted p-values
function holm(ps) {
  const idx = ps.map((p, i) => [p ?? 1, i]).sort((a, b) => a[0] - b[0]), m = ps.length, out = new Array(m); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); out[i] = r3(run); });
  return out;
}

// ─── data ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const replay = JSON.parse(fs.readFileSync(replayPath, 'utf8'));
const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
const A = replay.trades.filter((t) => t.aset && t.closed && Number.isFinite(+t.R)).map((t) => ({ ...t, R: +t.R }));
LAG.VIXCLS = LAG.VXVCLS = +(process.env.VIX_LAG || 1);   // pre-registered: 1 (env VIX_LAG=2 = macro.mjs default, a sensitivity check): VIX / VIX3M as of the prior day's close (Cboe posts it the same evening)
const now = Math.floor(Date.now() / 1000);
const { data, src } = await gather(globalThis.fetch, now, cache);
const cover = Object.fromEntries(Object.entries(data.fred).map(([k, a]) => [k, a.length ? `${iso(a[0].t)} → ${iso(a[a.length - 1].t)} (${a.length})` : 'none']));
const barCover = Object.fromEntries(Object.entries(data.bars).map(([k, a]) => [k, a.length ? `${iso(a[0].time)} → ${iso(a[a.length - 1].time)} (${a.length})` : 'none']));

// ─── regime per trade ───────────────────────────────────────────────────────────────────────────────────────────────────
const memo = new Map();
const regimeOf = (D) => {
  if (memo.has(D)) return memo.get(D);
  const f = features(data, D), { smile } = drivers(f);
  const g = { day: iso(D), vix: f.vix, vixTs: f.vixTs, hyChg: f.hy && f.hy.chg != null ? r3(f.hy.chg) : null, hy: f.hy ? f.hy.level : null, smile: smile ? smile.phase : null,
    dxy5d: r3(f.dm), ryChg: f.ry ? r3(f.ry.chg) : null, sofrBps: f.sofrBps, swapBn: f.swapBn };
  g.ok = g.vix != null && g.vixTs != null && g.hyChg != null && g.smile != null;
  memo.set(D, g); return g;
};
for (const t of A) t.rg = regimeOf(Math.floor(t.signalAt / DAY) * DAY);
const OK = A.filter((t) => t.rg.ok), NO = A.filter((t) => !t.rg.ok);

// ─── splits and hypotheses ──────────────────────────────────────────────────────────────────────────────────────────────
const SPLITS = [
  ['VIX level', [['VIX ≥ 22', (g) => g.vix >= 22], ['VIX < 22', (g) => g.vix < 22]]],
  ['VIX curve', [['inverted (VIX/VIX3M > 1)', (g) => g.vixTs > 1], ['normal (≤ 1)', (g) => g.vixTs <= 1]]],
  ['Dollar Smile side', ['left', 'right', 'trough', 'mid'].map((p) => [p, (g) => g.smile === p])],
  ['Credit stress', [['HY widened ≥ 8bp in 5d', (g) => g.hyChg >= 0.08], ['HY not widening', (g) => g.hyChg < 0.08]]],
];
const HYP = [
  ['H1', 'drop A-setups when VIX ≥ 22 or VIX/VIX3M > 1', (g) => g.vix >= 22 || g.vixTs > 1],
  ['H2', 'drop A-setups when HY OAS widened ≥ +0.08 in 5 days', (g) => g.hyChg >= 0.08],
];
const cells = [];
for (const [split, defs] of SPLITS) for (const [name, fn] of defs) cells.push({ split, name, ...cell(OK.filter((t) => fn(t.rg)), OK.filter((t) => !fn(t.rg))) });
const hyps = HYP.map(([id, rule, fn]) => {
  const drop = OK.filter((t) => fn(t.rg)), keep = OK.filter((t) => !fn(t.rg)), d = cell(drop, keep);
  const bar = d.n >= 30 && d.t <= -2 && d.h1.exp < 0 && d.h2.exp < 0, bonf = d.pLow != null && d.pLow <= 0.025;
  return { id, rule, dropped: d, kept: stats(keep.map((x) => x.R)), coachBar: bar, bonferroni: bonf, pass: bar && bonf };
});
const adj = holm([...cells.map((c) => c.pLow), ...hyps.map((h) => h.dropped.pLow)]);
cells.forEach((c, i) => (c.pHolm = adj[i])); hyps.forEach((h, i) => (h.dropped.pHolm = adj[cells.length + i]));
const adjW = holm(cells.map((c) => (c.vsRest ? c.vsRest.p2 : 1)));
cells.forEach((c, i) => c.vsRest && (c.vsRest.pHolm = adjW[i]));
const pass = hyps.filter((h) => h.pass).map((h) => h.id);
// Exploratory, chosen AFTER seeing the smile cells (not pre-registered, not counted, cannot become a filter here): the two
// dollar-bid sides of the smile (left + right) against the rest, overall and per market. A lead for a future pre-registered test.
const bid = (g) => g.smile === 'left' || g.smile === 'right';
const exploratory = { rule: 'Dollar Smile left or right (dollar bid) vs mid or trough', postHoc: true,
  all: cell(OK.filter((t) => bid(t.rg)), OK.filter((t) => !bid(t.rg))), rest: stats(OK.filter((t) => !bid(t.rg)).map((t) => t.R)),
  byMarket: Object.fromEntries([...new Set(OK.map((t) => t.market))].sort().map((m) => { const a = OK.filter((t) => t.market === m);
    return [m, { bid: stats(a.filter((t) => bid(t.rg)).map((t) => t.R)), rest: stats(a.filter((t) => !bid(t.rg)).map((t) => t.R)) }]; })) };

const vixs = OK.map((t) => t.rg.vix).sort((a, b) => a - b);
// edge-lab shape: "is" / "oos" here are the first and second half of the period (split at the median close of the trades with a
// regime), not a fitted / unseen split; candidates = the trades each filter KEEPS
const cut = OK.map((t) => t.closed).sort((a, b) => a - b)[OK.length >> 1];
const io = (rows) => ({ is: stats(rows.filter((t) => t.closed < cut).map((t) => t.R)), oos: stats(rows.filter((t) => t.closed >= cut).map((t) => t.R)) });
const candidates = HYP.map(([id, rule, fn], i) => ({ rule: `${id}: ${rule}`, verdict: hyps[i].pass ? 'pass' : 'fail', ...io(OK.filter((t) => !fn(t.rg))) }));
const res = {
  topic: 'ict-macro',
  system: 'ICT desk A-setups (council-data ict/replay.json, H1 iFVG reversal) × council/macro.mjs regime on the trade\'s prior close',
  replayAt: replay.at, from: replay.from,
  baseline: { A: io(OK) }, halfSplit: OK.length ? iso(cut) : null, candidates, variantsTried: cells.length + HYP.length,
  totals: { all: stats(A.map((t) => t.R)), withRegime: stats(OK.map((t) => t.R)), noRegime: { ...stats(NO.map((t) => t.R)), from: NO.length ? iso(Math.min(...NO.map((t) => t.signalAt))) : null, to: NO.length ? iso(Math.max(...NO.map((t) => t.signalAt))) : null } },
  vixRange: OK.length ? { min: vixs[0], median: vixs[vixs.length >> 1], max: vixs[vixs.length - 1] } : null,
  cells, hypotheses: hyps, exploratory, testsCounted: cells.length + hyps.length, verdict: pass.length ? 'pass' : 'fail', passed: pass,
  sources: src, fredCoverage: cover, barCoverage: barCover,
  notes: ['Regime day = UTC day of signalAt; candles before it; FRED with macro.mjs LAG except VIX/VIX3M at 1 day (prior close).',
    'Halves = each group sorted by close time, split by count (as ictVariantVerdicts). t = mean R / SE; pLow = one-sided P(mean ≥ 0 gives this t); pHolm over all cells + hypotheses.'],
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(res, null, 1));
fs.writeFileSync(path.join(outDir, 'trades.json'), JSON.stringify(A.map((t) => ({ id: t.id, market: t.market, side: t.side, signalAt: new Date(t.signalAt * 1000).toISOString(), R: t.R, ...t.rg })), null, 0).replace(/\},\{/g, '},\n{'));

const f = (s) => (s && s.n ? `n ${s.n}, ${s.exp >= 0 ? '+' : ''}${s.exp}R, t ${s.t}` : 'n 0');
console.log(`A-setups ${f(res.totals.all)} | with regime ${f(res.totals.withRegime)} | no regime data ${f(res.totals.noRegime)} (${res.totals.noRegime.from} → ${res.totals.noRegime.to})`);
console.log('VIX on trade days', res.vixRange);
for (const c of cells) console.log(`${c.split.padEnd(18)} ${c.name.padEnd(26)} ${f(c).padEnd(30)} halves ${c.h1.exp ?? '-'} / ${c.h2.exp ?? '-'}  p ${c.pLow} holm ${c.pHolm}  vs rest ${c.vsRest ? c.vsRest.diff + ' (t ' + c.vsRest.t + ', holm ' + c.vsRest.pHolm + ')' : '-'}`);
for (const h of hyps) console.log(`${h.id} ${h.rule}: dropped ${f(h.dropped)} halves ${h.dropped.h1.exp} / ${h.dropped.h2.exp} p ${h.dropped.pLow} holm ${h.dropped.pHolm}; kept ${f(h.kept)} → ${h.pass ? 'PASS' : 'fail'}`);
const e = exploratory.all; console.log(`exploratory (post hoc) smile left+right: ${f(e)} halves ${e.h1.exp} / ${e.h2.exp} vs rest ${f(exploratory.rest)} (Welch t ${e.vsRest.t})`);
for (const [m, v] of Object.entries(exploratory.byMarket)) console.log(`  ${m}: bid ${f(v.bid)} | rest ${f(v.rest)}`);
console.log('verdict', res.verdict);
