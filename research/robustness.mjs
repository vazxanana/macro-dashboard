// Robustness audit of every edge claim in use or under test (Meridian council + ICT desk). Paper research only: it reads
// trade lists and writes a report; it never changes a rule, a config or a tracker.
//
//   node research/robustness.mjs <council-data dir> [--out <dir>] [--iters 5000] [--seed 7]
//
// <council-data dir> is a checkout (or a copy) of the council-data branch. Files it reads, each optional:
//   ict/replay.json                 ICT desk replay: A-setups, the nofri / h1opp variants, the dip-buy shadow, all signals
//   research/replay-2w.json         the council's own replays of its live systems (replica, gold trend, NQ open run, ...)
//   backtest.json                   the nightly 30-day engine replay (Scalp live rule, Swing ADX tag, Coach input)
//   research/backtest-150d-*.json   150-day engine replays (Scalp live rule, Coach promotion walk-forward)
//   config.json                     live filters and the rule-change history (Coach toggles)
//   research/log.md                 research log (counts result lines for the multiple-testing N)
// It also reads the 2018-2026 trade lists of the earlier rebuild audit in this repo (research/edge/robustness/out/*.json).
// Writes <out>/robustness.json and <out>/robustness.md (default <out> = this folder).
//
// For every claim: walk-forward (first 60% of trades in time order = in-sample, last 40% = out-of-sample), a bootstrap 95% CI
// of R per trade, costs x1.5 and x2, Monte Carlo max drawdown (95th percentile over reshuffled trade orders), and a
// multiple-testing adjustment (Bonferroni and deflated Sharpe) with N = the variants tried in that claim's research family.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { passesLive, promoteDemote } from '../council/proposals.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────── statistics ───────────────────────────
// mulberry32: small seeded generator so every run with the same data gives the same numbers
export function rng(seed = 7) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// standard normal CDF (Abramowitz-Stegun 26.2.17, |error| < 7.5e-8)
export function normCdf(x) {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  const k = 1 / (1 + 0.2316419 * Math.abs(x)), d = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const p = d * k * (0.319381530 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}
// inverse standard normal CDF (Acklam's rational approximation, relative error < 1.2e-9)
export function normInv(p) {
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const lo = 0.02425, hi = 1 - lo;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > hi) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
export function quantile(sorted, q) { if (!sorted.length) return null; const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }
// largest peak-to-trough fall of the cumulative R curve, as a positive number of R
export function maxDrawdown(R) { let eq = 0, pk = 0, dd = 0; for (const r of R) { eq += r; if (eq > pk) pk = eq; if (pk - eq > dd) dd = pk - eq; } return dd; }
export function describe(R) {
  const n = R.length; if (!n) return { n: 0, mean: null, sd: null, t: null, wr: null, sum: 0, skew: null, kurt: null, maxDD: 0 };
  const sum = R.reduce((s, r) => s + r, 0), mean = sum / n;
  let m2 = 0, m3 = 0, m4 = 0, w = 0; for (const r of R) { const d = r - mean; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; if (r > 0) w++; }
  const sd = n > 1 ? Math.sqrt(m2 / (n - 1)) : 0, pm2 = m2 / n;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null, wr: w / n, sum, skew: pm2 > 0 ? (m3 / n) / pm2 ** 1.5 : 0, kurt: pm2 > 0 ? (m4 / n) / (pm2 * pm2) : 3, maxDD: maxDrawdown(R) };
}
// walk-forward split: the first `frac` of the trades in time order are in-sample, the rest out-of-sample
export function walkForward(R, frac = 0.6) { const k = Math.floor(R.length * frac); return { is: describe(R.slice(0, k)), oos: describe(R.slice(k)) }; }
// i.i.d. bootstrap of the mean: percentile CI and the share of resampled means at or below 0
export function bootstrapCI(R, { iters = 5000, seed = 7, alpha = 0.05 } = {}) {
  const n = R.length; if (n < 2) return { lo: null, hi: null, pLE0: null };
  const rand = rng(seed), means = new Float64Array(iters); let le0 = 0;
  for (let i = 0; i < iters; i++) { let s = 0; for (let j = 0; j < n; j++) s += R[(rand() * n) | 0]; means[i] = s / n; if (means[i] <= 0) le0++; }
  const s = Array.from(means).sort((a, b) => a - b);
  return { lo: quantile(s, alpha / 2), hi: quantile(s, 1 - alpha / 2), pLE0: le0 / iters };
}
// Monte Carlo drawdown: reshuffle the trade order; the 95th percentile of the max drawdown is what a bad ordering of the same trades costs
export function mcDrawdown(R, { iters = 5000, seed = 7, q = 0.95 } = {}) {
  const n = R.length; if (!n) return { dd50: null, dd95: null, ddActual: 0 };
  const rand = rng(seed), a = R.slice(), dds = new Float64Array(iters);
  for (let i = 0; i < iters; i++) { for (let j = n - 1; j > 0; j--) { const k = (rand() * (j + 1)) | 0; const x = a[j]; a[j] = a[k]; a[k] = x; } dds[i] = maxDrawdown(a); }
  const s = Array.from(dds).sort((x, y) => x - y);
  return { dd50: quantile(s, 0.5), dd95: quantile(s, q), ddActual: maxDrawdown(R) };
}
// R per trade when costs are scaled: net = gross - k x cost (cost in R per trade)
export function costSensitivity(trades, ks = [0, 1, 1.5, 2]) {
  return Object.fromEntries(ks.map((k) => { const d = describe(trades.map((x) => x.gross - k * x.cost)); return ['x' + k, { mean: d.mean, t: d.t, sum: d.sum }]; }));
}
// Bonferroni: one-sided p of the t-stat (normal approximation), times N; tReq is the t a single claim needs to pass at 5% after N tries
export function bonferroni(t, N) { const p = t == null ? 1 : 1 - normCdf(t); return { p, pAdj: Math.min(1, p * N), tReq: normInv(1 - 0.05 / Math.max(1, N)) }; }
// Deflated Sharpe ratio (Bailey & Lopez de Prado 2014) on per-trade returns: the probability that the true per-trade Sharpe beats the
// best Sharpe that N zero-edge tries of the same length would show by luck, corrected for skew and fat tails.
export function deflatedSharpe({ n, mean, sd, skew = 0, kurt = 3 }, N) {
  if (!n || n < 3 || !sd) return { sr: null, sr0: null, dsr: null };
  const sr = mean / sd, g = 0.5772156649;
  const sr0 = N > 1 ? Math.sqrt(1 / (n - 1)) * ((1 - g) * normInv(1 - 1 / N) + g * normInv(1 - 1 / (N * Math.E))) : 0;
  const den = Math.sqrt(Math.max(1e-9, 1 - skew * sr + (kurt - 1) / 4 * sr * sr));
  return { sr, sr0, dsr: normCdf((sr - sr0) * Math.sqrt(n - 1) / den) };
}

// ─────────────────────────── verdict ───────────────────────────
export const BAR = { minN: 30, oosT: 2, bonfP: 0.05 };
// robust     : out-of-sample positive with t >= 2, bootstrap CI above 0, still positive at 2x costs, passes Bonferroni for N tries,
//              and, when the rule was chosen on part of this record (fitFrom), positive on 30+ trades from before that date
// fragile   : positive overall and positive out-of-sample or CI above 0, but fails at least one of the robust tests
// not proven : fewer than 30 trades, or no positive evidence (including claims that lose)
export function verdict(a) {
  const why = [];
  if (!a.n || a.n < BAR.minN) return { verdict: 'not proven', why: [`only ${a.n || 0} trades (needs ${BAR.minN}+)`] };
  const oosOk = a.oos.mean > 0 && a.oos.t != null && a.oos.t >= BAR.oosT, ciOk = a.boot.lo != null && a.boot.lo > 0;
  const c2 = a.cost && a.cost.x2 ? a.cost.x2.mean : null, costOk = c2 == null || c2 > 0, mtOk = a.mt.bonf.pAdj < BAR.bonfP;
  if (!oosOk) why.push(a.oos.mean > 0 ? `out-of-sample t ${fx(a.oos.t, 2)} < ${BAR.oosT}` : `out-of-sample ${fR(a.oos.mean)} a trade`);
  if (!ciOk) why.push(a.boot.hi != null && a.boot.hi < 0 ? `CI entirely below 0 (${fR(a.boot.lo)} to ${fR(a.boot.hi)})` : `CI includes 0 (${fR(a.boot.lo)} to ${fR(a.boot.hi)})`);
  if (!costOk) why.push(`${fR(c2)} a trade at 2x costs`);
  if (!mtOk) why.push(`fails Bonferroni for N=${a.mt.N} (needs t ${fx(a.mt.bonf.tReq, 2)}, has ${fx(a.t, 2)})`);
  const u = a.untouched, untouchedOk = !a.fitFrom || (u && u.n >= BAR.minN && u.mean > 0);
  if (!untouchedOk) why.push(!u || u.n < BAR.minN ? `no untouched sample: the rule was chosen on data from ${a.fitFrom} on (${u ? u.n : 0} trades before)`
    : `untouched period before ${a.fitFrom}: ${fR(u.mean)} a trade over ${u.n}`);
  if (oosOk && ciOk && costOk && mtOk && untouchedOk) return { verdict: 'robust', why: ['passes every test'] };
  if (a.mean > 0 && (a.oos.mean > 0 || ciOk)) return { verdict: 'fragile', why };
  return { verdict: 'not proven', why };
}

// full audit of one trade list: [{ t, gross, cost }] (R per trade; cost in R; net = gross - cost)
// fitFrom (YYYY-MM-DD): the rule was chosen on data from this date on; trades before it are the untouched sample
export function audit(trades, { N = 1, iters = 5000, seed = 7, frac = 0.6, fitFrom = null } = {}) {
  const T = trades.filter((x) => Number.isFinite(x.gross) && Number.isFinite(x.cost)).sort((a, b) => a.t - b.t);
  const R = T.map((x) => x.gross - x.cost), d = describe(R), wf = walkForward(R, frac);
  const a = { ...d, from: T.length ? iso(T[0].t) : null, to: T.length ? iso(T[T.length - 1].t) : null, is: wf.is, oos: wf.oos,
    boot: bootstrapCI(R, { iters, seed }), cost: costSensitivity(T), mc: mcDrawdown(R, { iters, seed }),
    mt: { N, bonf: bonferroni(d.t, N), ...deflatedSharpe(d, N) } };
  if (fitFrom) { const ft = Date.parse(fitFrom) / 1000, u = describe(T.filter((x) => x.t < ft).map((x) => x.gross - x.cost)); Object.assign(a, { fitFrom, untouched: { n: u.n, mean: u.mean, t: u.t } }); }
  // warnings that do not change the verdict
  a.warn = [];
  if (d.n >= BAR.minN && wf.is.mean > 0 && wf.oos.n && wf.oos.mean < wf.is.mean / 3) a.warn.push(`decay: in-sample ${fR(wf.is.mean)} vs out-of-sample ${fR(wf.oos.mean)} a trade`);
  if (d.n >= BAR.minN && d.mean > 0 && a.mc.dd95 != null && a.mc.ddActual > a.mc.dd95) a.warn.push(`the real drawdown (${fx(a.mc.ddActual, 1)}R) is worse than 95% of reshuffles: losses cluster`);
  return { ...a, ...verdict(a) };
}

// a claim known only from a research summary (no trade list in council-data): normal approximations from n / mean / t of the
// two periods the study reported. No Monte Carlo (needs the trades); DSR assumes normal returns.
export function auditSummary({ is, oos, costPerTrade = null }, { N = 1 } = {}) {
  const sdOf = (p) => p.t ? Math.abs(p.mean * Math.sqrt(p.n) / p.t) : null;
  const s1 = sdOf(is), s2 = sdOf(oos), n = is.n + oos.n, mean = (is.n * is.mean + oos.n * oos.mean) / n;
  const sd = s1 != null && s2 != null ? Math.sqrt(((is.n - 1) * s1 * s1 + (oos.n - 1) * s2 * s2 + is.n * (is.mean - mean) ** 2 + oos.n * (oos.mean - mean) ** 2) / (n - 1)) : null;
  const t = sd ? mean / (sd / Math.sqrt(n)) : null, se = sd ? sd / Math.sqrt(n) : null;
  const ci = se ? { lo: mean - 1.96 * se, hi: mean + 1.96 * se, pLE0: normCdf(-mean / se), approx: true } : { lo: null, hi: null, pLE0: null };
  const at = (k) => costPerTrade == null ? null : { mean: mean - (k - 1) * costPerTrade, t: null, sum: null };
  const a = { n, mean, sd, t, wr: null, sum: n * mean, skew: 0, kurt: 3, maxDD: null, from: null, to: null,
    is: { ...is, sd: s1 }, oos: { ...oos, sd: s2 }, boot: ci, cost: { x0: at(0), x1: { mean, t, sum: n * mean }, 'x1.5': at(1.5), x2: at(2) },
    mc: { dd50: null, dd95: null, ddActual: null }, mt: { N, bonf: bonferroni(t, N), ...deflatedSharpe({ n, mean, sd, skew: 0, kurt: 3 }, N) }, summaryOnly: true };
  return { ...a, ...verdict(a) };
}

// ─────────────────────────── helpers ───────────────────────────
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const fx = (v, d = 3) => v == null || !Number.isFinite(v) ? '–' : v.toFixed(d);
const fR = (v, d = 3) => v == null || !Number.isFinite(v) ? '–' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
const readJSON = (dir, rel) => { const p = path.join(dir, rel); if (!fs.existsSync(p)) return null; try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const rowsOf = (b) => !b || !Array.isArray(b.trades) || !Array.isArray(b.tradeCols) ? [] : b.trades.map((r) => Object.fromEntries(b.tradeCols.map((c, i) => [c, r[i]])))
  .filter((x) => x.fill !== 0 && x.status !== 'open' && x.status !== 'unfilled' && !String(x.setup).includes('@') && x.R_none != null && Number.isFinite(x.R_none))
  .map((x) => ({ ...x, t: x.opened, gross: x.R_none, cost: Number.isFinite(x.cost) ? x.cost : 0, R: x.R_none - (Number.isFinite(x.cost) ? x.cost : 0) }));

// ICT micro-futures round trip in points (research/edge/costs/costs.mjs futCost): 1 tick spread + $1.24 commission/fees +
// 1 tick slippage on the entry + 1 tick on the exit. The replay books R before costs.
export const FUT = { NQ: { tick: 0.25, usdPerPt: 2 }, ES: { tick: 0.25, usdPerPt: 5 }, YM: { tick: 1, usdPerPt: 0.5 }, RTY: { tick: 0.1, usdPerPt: 5 }, GC: { tick: 0.1, usdPerPt: 10 } };
export const ictCostPts = (short) => { const F = FUT[String(short || '').toUpperCase()]; return F ? 3 * F.tick + 1.24 / F.usdPerPt : 0; };
export function ictTrade(x) {
  const size = x.size || 1, r0 = x.r0 || Math.abs(x.entry - (x.stop0 ?? x.stop)), cost = r0 > 0 ? ictCostPts(x.short || x.market) / r0 * size : 0;
  return { t: x.signalAt || x.opened, gross: +x.R, cost, id: x.id };
}
const ictClosed = (L) => (L || []).filter((x) => x && x.closed && x.R != null && Number.isFinite(+x.R) && x.status !== 'void');

// council replays (research/replay-2w.json) book R after costs; the cost is put back from the replay's own cost per trade
// (gold 0.30, NQ 0.5 point, crypto 0.8% of the entry) over the initial risk. Approximate for trades with an add.
const CRYPTO = new Set(['btc', 'eth', 'sol', 'xrp']);
export function replayTrade(x) {
  const r0 = Math.abs(x.entry - (x.stop0 ?? x.stop)), pts = x.market === 'xau' ? 0.30 : x.market === 'nq' ? 0.5 : CRYPTO.has(x.market) ? 0.008 * x.entry : 0;
  const cost = r0 > 0 ? pts / r0 * (x.size || 1) : 0;
  return { t: x.opened, gross: +x.R + cost, cost };
}

// 2018-2026 rebuild lists: R is net; gross is per unit before costs. For trades with an add (gold trend, crypto, Mosha) R holds two
// units while gross holds one, so the cost is taken as two units' median cost. Net always equals the list's R.
export function rebuildTrades(L) {
  const c = L.map((x) => (Number.isFinite(x.gross) ? x.gross : x.R) - x.R).filter((v) => v >= 0).sort((a, b) => a - b), med = quantile(c, 0.5) || 0;
  return L.map((x) => { const d = (Number.isFinite(x.gross) ? x.gross : x.R) - x.R, cost = d >= 0 ? d : 2 * med; return { t: x.t, gross: x.R + cost, cost }; });
}

// The date from which data was used to choose each rule (research notes, config history): trades before it are untouched.
// ICT index A rule: fitted on 2023-26 cash indices (ict-filters caveat); gold A rule: 2019-26; dip-buy: chosen after looking at
// 2018-26 (ict-index-longonly); council gold rules judged on 2023 on (gold trend legs: 2019 on); NQ open run: 2023-26;
// crypto trend v1: 2022-26; Mosha: 2019-26; Scalp live rule: the 30-day replay of 8 Oct - 7 Nov 2026.
export const FIT = { 'ict-nq': '2023-01-01', 'ict-gc': '2019-01-01', dip: '2018-01-01', replica: '2023-01-01', gtrend: '2019-01-01', gtrend5: '2019-01-01',
  'nq-open': '2023-01-01', trend: '2022-01-01', gtl: '2023-01-01', geg: '2023-01-01', gmp: '2023-01-01', 'mosha-bo': '2019-01-01', scalp: '2026-10-08' };

// ─────────────────────────── multiple testing: variants tried per research family ───────────────────────────
// Counted from the research notes (research/edge/*/RESULT.md) and the PR history; see robustness.md for the sources.
export const TRIALS = {
  ict: { N: 363, how: 'ict-filters 64 + ict-exits 96 + ict-universe 60 + ict-index-longonly 26 + confluence 102 + 15 ICT skill rule sections adopted after testing (§14-§32)' },
  nofri: { N: 64, how: 'ict-filters: 31 filters x 2 populations + 2 greedy combinations' },
  h1opp: { N: 102, how: 'confluence: 6 ICT features x 8 Meridian books + 6 Meridian-context features x 8 ICT books + 6' },
  dip: { N: 86, how: 'ict-universe 60 cells (where the gold buy rule on indices was found) + ict-index-longonly 26' },
  council: { N: 424, how: 'research/log.md lines that report an R result (recounted each run when the log is present)' },
  scalp: { N: 1112, how: 'scalp-filters 826 + timing 243 + scalp-exits 23 + costs 20' },
  swingAdx: { N: 722, how: 'regime: 178 gates per system x 3 systems + context run + 12 neighbour checks' },
  coach: { N: 32, how: 'coach-learning: 16 Coach policies x 2 streams (the forward record itself is out-of-sample)' },
};

// ─────────────────────────── claims ───────────────────────────
export function buildClaims(dir, { iters = 5000, seed = 7, repoOut = path.join(HERE, 'edge', 'robustness', 'out') } = {}) {
  const claims = [], sources = {};
  const log = fs.existsSync(path.join(dir, 'research/log.md')) ? fs.readFileSync(path.join(dir, 'research/log.md'), 'utf8') : null;
  const trials = JSON.parse(JSON.stringify(TRIALS));
  if (log) { const n = log.split('\n').filter((l) => /[+−-]\d+(\.\d+)?R\b/.test(l)).length; if (n > 0) trials.council.N = Math.max(trials.council.N, n); }
  const add = (c, trades, fam) => { const N = trials[fam].N; claims.push({ ...c, family: fam, ...audit(trades, { N, iters, seed, fitFrom: c.fitFrom || null }) }); };
  const addSummary = (c, s, fam) => claims.push({ ...c, family: fam, ...auditSummary(s, { N: trials[fam].N }) });

  // ICT desk replay
  const ir = readJSON(dir, 'ict/replay.json');
  if (ir) {
    sources['ict/replay.json'] = { at: ir.at, from: ir.from };
    const A = ictClosed(ir.trades).filter((x) => x.aset);
    add({ id: 'ict-a', system: 'ICT', status: 'live (paper desk + cTrader demo mirror)', name: 'ICT A-setups (desk replay)', claim: `desk replay since ${ir.from}: ${fR(ir.totalsA && ir.totalsA.R / ir.totalsA.n)}R a trade over ${ir.totalsA ? ir.totalsA.n : A.length} (before costs)`, source: 'ict/replay.json trades (aset)', fitFrom: FIT['ict-nq'] }, A.map(ictTrade), 'ict');
    for (const [v, nm] of [['nofri', 'no Friday'], ['h1opp', 'H1 structure opposed']]) {
      const L = ictClosed((ir.shadowByVariant || {})[v]); if (!L.length) continue;
      const keep = new Set(L.map((x) => String(x.id).replace(`-${v}`, ''))), dropped = A.filter((x) => !keep.has(x.id)).map(ictTrade);
      const tot = (ir.totalsByVariant || {})[v];
      add({ id: 'ict-' + v, system: 'ICT', status: 'shadow (paper variant)', name: `ICT A-setups, ${nm} variant`, claim: tot ? `${fR(tot.R / tot.n)}R a trade over ${tot.n} (before costs)` : '', source: `ict/replay.json shadowByVariant.${v}`, fitFrom: FIT['ict-nq'],
        dropped: (() => { const d = describe(dropped.map((x) => x.gross - x.cost)); return { n: d.n, mean: d.mean, t: d.t }; })() }, L.map(ictTrade), v);
    }
    const dip = ictClosed(ir.shadow).filter((x) => x.variant === 'dip');
    if (dip.length) add({ id: 'ict-dip', system: 'ICT', status: 'shadow (paper, NQ/ES)', name: 'ICT dip-buy NQ/ES', claim: ir.totalsDip ? `${fR(ir.totalsDip.R / ir.totalsDip.n)}R a trade over ${ir.totalsDip.n} (before costs)` : '', source: 'ict/replay.json shadow (variant dip)', fitFrom: FIT.dip }, dip.map(ictTrade), 'dip');
    const all = ictClosed(ir.trades);
    add({ id: 'ict-all', system: 'ICT', status: 'reference (every graded signal)', name: 'ICT all graded signals', claim: 'reference: what the A filter is selected from', source: 'ict/replay.json trades', fitFrom: FIT['ict-nq'] }, all.map(ictTrade), 'ict');
  }
  // ICT 2018-2026 rebuild (earlier audit, repo files: the desk's own signals()/simulate() on HistData)
  const ib = readJSON(repoOut, 'ict.json');
  if (ib) for (const [m, nm] of [['nq', 'NQ'], ['gc', 'GC']]) {
    const L = ((ib[m] || {}).trades || []).filter((x) => x.a);
    if (L.length) add({ id: `ict-a-${m}-2018`, system: 'ICT', status: 'long-history check of the live A rule', name: `ICT A-setups ${nm}, 2018-26 rebuild`, claim: 'same rule on 8 years of HistData (earlier rebuild audit)', source: `research/edge/robustness/out/ict.json ${m}`, fitFrom: FIT['ict-' + m] }, rebuildTrades(L), 'ict');
  }

  // council systems: the council's own replays (claim source) and the 2018-2026 rebuilds
  const rp = readJSON(dir, 'research/replay-2w.json');
  // status from the live config, so an owner move to shadow shows here without editing this list (7 Nov: crypto trend)
  const cfgNow = readJSON(dir, 'config.json') || {};
  const cryptoSt = cfgNow.cryptoTrendShadow ? 'shadow (owner, 7 Nov: no edge since Jun 2025, #508)' : 'live (paper)';
  const SYS = [
    ['replica', 'Gold replica', 'live (paper)', (x) => true, null],
    ['gtrend', 'Gold trend N20', 'live (paper)', (x) => true, ['gtrend.json', 'trades.gtrend20']],
    ['gtrend5', 'Gold trend fast N5', 'live (paper)', (x) => true, ['gtrend.json', 'trades.gtrend5']],
    ['nq-open', 'NQ New York open run', 'live (paper)', (x) => x.session === 'nyflip', ['nq.json', 'trades']],
    ['trend', 'Crypto trend v3', cryptoSt, (x) => true, ['crypto.json', 'trades']],
    ['gtl', 'Gold H4 trendline', 'live (paper)', (x) => true, ['gtl.json', 'trades']],
    ['geg', 'Gold daily engulf', 'live (paper)', (x) => true, ['geg.json', 'trades']],
    ['gmp', 'Gold momentum pullback', 'shadow (test system)', (x) => true, ['gmp.json', 'trades']],
    ['mosha-bo', 'Mosha BO', 'live (paper)', null, ['mosha.json', 'trades']],
  ];
  if (rp) sources['research/replay-2w.json'] = { from: rp.from, to: rp.to };
  for (const [k, nm, st, keep, reb] of SYS) {
    if (rp && keep) {
      const L = (rp.trades || []).filter((x) => x.k === k && keep(x) && ['win', 'loss', 'be'].includes(x.status) && Number.isFinite(+x.R));
      if (L.length) add({ id: k, system: 'Meridian', status: st, name: `${nm} (council replay)`, claim: `council replay ${rp.from} to ${rp.to}, costs included`, source: `research/replay-2w.json k=${k}`, fitFrom: FIT[k] }, L.map(replayTrade), 'council');
    }
    if (reb) {
      const j = readJSON(repoOut, reb[0]); const L = j ? reb[1].split('.').reduce((o, p) => o && o[p], j) : null;
      if (Array.isArray(L) && L.length) add({ id: `${k}-2018`, system: 'Meridian', status: st, name: `${nm}, 2018-26 rebuild`, claim: 'same rule rebuilt on 8 years of HistData (earlier rebuild audit)', source: `research/edge/robustness/out/${reb[0]}`, fitFrom: FIT[k] },
        rebuildTrades(L), 'council');
    }
  }

  // engine setups: Scalp live rule, Swing ADX band, Coach promotions, Coach toggles
  const cfg = readJSON(dir, 'config.json') || {}, F = cfg.filters || {};
  const bt = readJSON(dir, 'backtest.json');
  if (bt) {
    sources['backtest.json'] = { at: bt.at, from: bt.from, to: bt.to, days: bt.days };
    const rows = rowsOf(bt);
    const scalp = rows.filter((x) => x.setup === 'scalp' && passesLive(x, F.scalp));
    add({ id: 'scalp-30d', system: 'Meridian', status: 'shadow (back from live paper 7 Nov)', name: 'Scalp live rule, 30-day replay', claim: 'owner rule 7 Nov: +0.329R a trade over 500 in a 30-day replay (before crypto exchange fees)', source: 'backtest.json (scalp, live filters)', fitFrom: FIT.scalp }, scalp, 'scalp');
    add({ id: 'scalp-30d-fx', system: 'Meridian', status: 'shadow', name: 'Scalp live rule, 30-day replay, gold + forex', claim: 'the same without crypto (Kraken fees cost crypto scalps about 2R a trade)', source: 'backtest.json (scalp, live filters, no crypto)', fitFrom: FIT.scalp }, scalp.filter((x) => !CRYPTO.has(x.market)), 'scalp');
    const sw = rows.filter((x) => x.setup === 'swing' && passesLive(x, F.swing) && x.adxBand === true);
    claims.push({ id: 'swing-adx-fwd', system: 'Meridian', status: 'shadow (paper sleeve)', name: 'Swing D1 ADX band, forward tags', claim: 'tags since #468; adopt only after 50+ forward trades at +0.10R or better', source: 'backtest.json swing rows with adxBand', family: 'swingAdx',
      ...(sw.length ? audit(sw, { N: trials.swingAdx.N, iters, seed }) : { n: 0, verdict: 'not proven', why: [bt.tradeCols && bt.tradeCols.includes('adxBand') ? 'no tagged in-band Swing trade yet' : 'backtest.json has no ADX tags yet (the nightly replay adds them from #468 on)'] }) });
  }
  for (const f of ['research/backtest-150d.json', 'research/backtest-150d-clean.json']) {
    const b = readJSON(dir, f); if (!b) continue;
    sources[f] = { at: b.at, from: b.from, to: b.to, days: b.days };
    add({ id: 'scalp-' + path.basename(f, '.json').replace('backtest-', ''), system: 'Meridian', status: 'shadow', name: `Scalp live rule, ${path.basename(f, '.json').replace('backtest-', '')} replay`, claim: 'same rule on the 150-day engine replay', source: `${f} (scalp, live filters)`, fitFrom: FIT.scalp }, rowsOf(b).filter((x) => x.setup === 'scalp' && passesLive(x, F.scalp)), 'scalp');
  }
  addSummary({ id: 'scalp-histdata', system: 'Meridian', status: 'shadow', name: 'Scalp live rule, 2018-26 HistData', claim: 'research/edge/regime baseline (IS 2018-23 / OOS 2024-26 split of that study)', source: 'research/edge/regime/RESULT.md (summary only)' },
    { is: { n: 9551, mean: -0.187, t: -10.9 }, oos: { n: 4532, mean: -0.229, t: -9.0 }, costPerTrade: 0.133 }, 'scalp');
  addSummary({ id: 'swing-adx', system: 'Meridian', status: 'shadow (paper sleeve)', name: 'Swing D1 ADX band 19.4-29.2', claim: 'OOS 2024-26 +0.290R a trade over 67 (t 1.46); +0.277 at 1.5x cost', source: 'research/edge/regime/proposal.md (summary only)' },
    { is: { n: 211, mean: 0.113, t: 1.05 }, oos: { n: 67, mean: 0.290, t: 1.46 }, costPerTrade: (0.290 - 0.277) / 0.5 }, 'swingAdx');

  // Coach promotions: walk the 150-day replay forward; every 7 days the Coach's promote / promoteIf rule (council/proposals.mjs)
  // looks at the trailing 30 days; the trades of what it would promote in the NEXT 7 days are its out-of-sample record.
  const pb = readJSON(dir, 'research/backtest-150d-clean.json') || readJSON(dir, 'research/backtest-150d.json');
  if (pb) {
    const wf = coachPromotionWF(rowsOf(pb), cfg);
    claims.push({ id: 'coach-promote', system: 'Meridian', status: 'Coach rule (proposals to the owner)', name: 'Coach promotions, forward record', claim: 'promote: n>=100, +0.10R, both halves positive in the 30-day replay', source: 'research/backtest-150d-clean.json, walk-forward 30-day look-back / 7-day hold',
      family: 'coach', picks: wf.picks.length, selMean: wf.selMean, ...(wf.trades.length ? audit(wf.trades, { N: trials.coach.N, iters, seed }) : { n: 0, verdict: 'not proven', why: ['the rule never promoted anything in this window'] }) });
  }
  const toggles = coachToggles(cfg.history || []);
  if (toggles.n) claims.push({ id: 'coach-toggles', system: 'Meridian', status: 'Coach rule changes (applied automatically)', name: 'Coach-stats session / D1 / stop toggles', claim: `${toggles.n} automatic rule changes`, source: 'config.json history (coach-stats, coach-backtest)', family: 'coach',
    n: toggles.n, toggles, verdict: 'not proven', why: [`median evidence ${toggles.medianN} trades; ${toggles.underThirty} of ${toggles.withN} cite fewer than 30`, `${toggles.flipped} topics changed 2+ times (${toggles.maxFlips} at most)`] });

  return { claims, sources, trials };
}

export function coachPromotionWF(rows, cfg, { win = 30, step = 7 } = {}) {
  const D = 86400, R = rows.slice().sort((a, b) => a.opened - b.opened), F = cfg.filters || {}, config = { ...cfg, focusSetups: [] };
  if (!R.length) return { picks: [], trades: [], selMean: null };
  const t0 = R[0].opened, t1 = R[R.length - 1].opened, picks = [], seen = new Set(), trades = []; let selSum = 0, selN = 0;
  const mean = (a) => a.length ? a.reduce((s, x) => s + x.R, 0) / a.length : 0;
  for (let s = t0 + win * D; s < t1; s += step * D) {
    const W = R.filter((x) => x.opened >= s - win * D && x.opened < s), mid = s - win * D / 2;
    const halves = (A) => { const a = A.filter((x) => x.opened < mid), z = A.filter((x) => x.opened >= mid); return { h1: { n: a.length, exp: +mean(a).toFixed(2) }, h2: { n: z.length, exp: +mean(z).toFixed(2) } }; };
    for (const p of promoteDemote(W, config, halves, iso(s)).filter((p) => p.kind === 'promote' || p.kind === 'promoteIf')) {
      const [field, v] = p.kind === 'promoteIf' ? p.value.split(':') : [null, null];
      const fwd = R.filter((x) => x.opened >= s && x.opened < s + step * D && x.setup === p.setup && passesLive(x, F[p.setup]) && (!field || String(x[field]) === v));
      picks.push({ at: iso(s), setup: p.setup, kind: p.kind, value: p.value, selN: p.n, selExp: p.exp, fwdN: fwd.length, fwdExp: fwd.length ? +mean(fwd).toFixed(3) : null });
      selSum += p.exp * p.n; selN += p.n;
      for (const x of fwd) { const key = `${x.market}|${x.setup}|${x.side}|${x.opened}`; if (!seen.has(key)) { seen.add(key); trades.push(x); } }
    }
  }
  return { picks, trades, selMean: selN ? selSum / selN : null };
}

export function coachToggles(history) {
  const H = history.filter((e) => e && (e.by === 'coach-stats' || e.by === 'coach-backtest'));
  const topic = (c) => { const s = String(c || '').toLowerCase(), setup = (s.match(/^([a-z0-9]+):/) || [])[1] || 'all';
    const what = (s.match(/asia|overlap|london|new ?york|late|d1|stop|reward|break-even|pause|structure/) || ['other'])[0]; return `${setup}|${what}`; };
  const by = {}; for (const e of H) { const k = topic(e.change); by[k] = (by[k] || 0) + 1; }
  const ns = H.map((e) => +((String(e.why || '').match(/over (\d+)/) || [])[1])).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const flips = Object.values(by).filter((n) => n >= 2);
  return { n: H.length, withN: ns.length, medianN: ns.length ? quantile(ns, 0.5) : null, underThirty: ns.filter((n) => n < 30).length, topics: Object.keys(by).length, flipped: flips.length, maxFlips: flips.length ? Math.max(...flips) : 0 };
}

// ─────────────────────────── report ───────────────────────────
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'number' ? +v.toFixed(4) : v));
export function toMarkdown({ at, claims, sources, trials }) {
  const L = [];
  const row = (c) => {
    if (c.id === 'coach-toggles') return `| ${c.name} | ${c.status} | ${c.n} changes | – | – | – | – | – | – | – | **${c.verdict}** |`;
    if (!c.n) return `| ${c.name} | ${c.status} | 0 | – | – | – | – | – | – | – | **${c.verdict}** |`;
    const un = !c.fitFrom ? '–' : c.untouched && c.untouched.n ? `${fR(c.untouched.mean)} (n ${c.untouched.n}, before ${c.fitFrom.slice(0, 4)})` : `none (fit ${c.fitFrom.slice(0, 4)}+)`;
    const oos = `${fR(c.oos.mean)} (t ${fx(c.oos.t, 2)}, n ${c.oos.n})`, ci = `${fR(c.boot.lo)} to ${fR(c.boot.hi)}${c.boot.approx ? '*' : ''}`;
    const cost = `${fR(c.cost['x1.5'] && c.cost['x1.5'].mean)} / ${fR(c.cost.x2 && c.cost.x2.mean)}`;
    const mt = `N ${c.mt.N}: p ${c.mt.bonf.pAdj < 0.001 ? '<0.001' : fx(c.mt.bonf.pAdj, 3)}, DSR ${fx(c.mt.dsr, 2)}`;
    return `| ${c.name} | ${c.status} | ${c.n} | ${fR(c.mean)} (t ${fx(c.t, 2)}) | ${oos} | ${un} | ${ci} | ${cost} | ${c.mc.dd95 == null ? '–' : fx(c.mc.dd95, 1) + 'R'} | ${mt} | **${c.verdict}** |`;
  };
  L.push('# Robustness audit: which edges hold up?', '');
  L.push(`Generated ${at} by \`node research/robustness.mjs <council-data>\`. Paper research only: no trading rule, config or tracker was changed. The owner decides on every flag below.`, '');
  // live rules not robust: the council's own replay row, or the rebuild row when the council has no replay of that rule
  const live = claims.filter((c) => /^live/.test(c.status) && c.verdict !== 'robust' && (!/-2018$/.test(c.id) || !claims.some((x) => x.id === c.id.replace(/-2018$/, ''))));
  const counts = claims.reduce((o, c) => (o[c.verdict] = (o[c.verdict] || 0) + 1, o), {});
  L.push('## Short answer', '');
  L.push(`- ${claims.length} claims audited: ${counts.robust || 0} robust, ${counts.fragile || 0} fragile, ${counts['not proven'] || 0} not proven.`);
  if (live.length) { L.push('- **LIVE rules that are not robust. Flagged for the owner; nothing was changed:**'); for (const c of live) L.push(`  - ${c.name}: **${c.verdict}**, ${fR(c.mean)}R a trade over ${c.n}. ${c.why.join('; ')}.`); }
  for (const c of claims.filter((c) => c.verdict === 'robust')) {
    const sib = /-2018$/.test(c.id) ? claims.find((x) => x.id === c.id.replace(/-2018$/, '')) : null;
    const sibNote = sib && sib.oos && sib.oos.n ? ` The council's own replay of the same rule (${sib.from} to ${sib.to}) is **${sib.verdict}**: out-of-sample ${fR(sib.oos.mean)} a trade (t ${fx(sib.oos.t, 2)}, n ${sib.oos.n}), so check whether the edge still holds now.` : '';
    L.push(`- Robust: ${c.name}, ${fR(c.mean)}R a trade over ${c.n}${c.warn && c.warn.length ? ` (note: ${c.warn.join('; ')})` : ''}.${sibNote}`);
  }
  const sh = claims.filter((c) => /^shadow/.test(c.status) && c.mean > 0 && c.verdict !== 'robust');
  if (sh.length) L.push(`- Shadow candidates with a positive record that is not yet robust (keep on paper): ${sh.map((c) => `${c.name} ${fR(c.mean)}R over ${c.n} (${c.verdict})`).join('; ')}.`);
  const neg = claims.filter((c) => c.n >= BAR.minN && c.mean != null && c.mean <= 0);
  if (neg.length) L.push(`- No edge (zero or negative after costs): ${neg.map((c) => `${c.name} ${fR(c.mean)}R over ${c.n}`).join('; ')}.`);
  L.push('');
  for (const [sys, title] of [['ICT', 'ICT desk'], ['Meridian', 'Meridian council']]) {
    L.push(`## ${title}`, '');
    L.push('| Claim | Status | n | Net R/trade (t) | Out-of-sample last 40% | Untouched (before the rule was fitted) | Bootstrap 95% CI | Costs ×1.5 / ×2 | MC max DD 95% | Multiple testing (Bonferroni p, DSR) | Verdict |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const c of claims.filter((c) => c.system === sys)) L.push(row(c));
    L.push('');
  }
  L.push('`*` normal approximation from a research summary (no trade list in council-data); its IS/OOS columns are that study\'s own split, not 60/40.', '');
  L.push('## Why each verdict', '');
  for (const c of claims) {
    let extra = '';
    if (c.dropped) extra = ` The A-setups it drops: ${c.dropped.n} trades at ${fR(c.dropped.mean)}R (t ${fx(c.dropped.t, 2)}).`;
    if (c.id === 'coach-promote' && c.n) extra = ` ${c.picks} promotions in the walk; the 30-day windows that triggered them showed ${fR(c.selMean)}R a trade, the next 7 days gave ${fR(c.mean)}R.`;
    if (c.id === 'coach-toggles') extra = ` ${c.toggles.topics} topics, ${c.toggles.flipped} of them changed more than once.`;
    const warn = c.warn && c.warn.length ? ` Note: ${c.warn.join('; ')}.` : '';
    L.push(`- **${c.name}** (${c.status}; claim: ${c.claim || '–'}; source: \`${c.source}\`): **${c.verdict}**. ${c.why.join('; ')}.${extra}${warn}`);
  }
  L.push('', '## Method', '');
  L.push('- **Trades.** Closed trades in time order. R per trade is net of costs; costs are in R per trade, so ×1.5 and ×2 scale them (ICT: micro futures, 1 tick spread + $1.24 + 1 tick slip each way, research/edge/costs; engine replays: their own `cost` column; council replays: the cost they booked, put back and rescaled).');
  L.push('- **Walk-forward.** The first 60% of the trades are in-sample, the last 40% out-of-sample. These rules are fixed (nothing is refitted), so the split asks whether the later part of the record still holds the edge.');
  L.push('- **Untouched sample.** When a rule was chosen on part of the record (date in `FIT`), the 60/40 split can put the fitting period in the "out-of-sample" part. The trades before that date are the only untouched ones; *robust* needs 30+ of them and a positive mean there.');
  L.push('- **Bootstrap.** 5,000 i.i.d. resamples of the trades; percentile 95% CI of the mean. Trades on correlated markets (NQ/ES) on the same day make the CI too narrow, so treat a CI just above 0 as weaker than it looks.');
  L.push('- **Monte Carlo drawdown.** 5,000 reshuffles of the trade order; the 95th percentile of the max peak-to-trough fall in R.');
  L.push('- **Multiple testing.** Bonferroni: one-sided p of the full-sample t times N. Deflated Sharpe: the probability the per-trade Sharpe beats the best of N zero-edge tries (skew and kurtosis corrected). N per family:');
  for (const [k, v] of Object.entries(trials)) L.push(`  - \`${k}\`: N = ${v.N} (${v.how})`);
  L.push(`- **Verdict.** *robust*: out-of-sample positive with t ≥ ${BAR.oosT}, bootstrap CI above 0, still positive at 2× costs, Bonferroni p < ${BAR.bonfP}, and positive on the untouched sample when there is a fit date. *fragile*: positive overall and positive out-of-sample or CI above 0, but fails one or more of those. *not proven*: under ${BAR.minN} trades or no positive evidence (claims that lose are here too).`);
  L.push('- **Coach promotions.** The Coach\'s promote / promoteIf rule (`council/proposals.mjs`) runs every 7 days on the trailing 30 days of the 150-day engine replay with today\'s filters; the trades of what it would promote over the next 7 days form its out-of-sample record. The 150-day replays used a 0.7 ATR minimum stop, the live Coach 1.1.');
  L.push('', '## Data', '');
  for (const [f, s] of Object.entries(sources)) L.push(`- \`${f}\`: ${Object.entries(s).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  L.push('- `research/edge/robustness/out/*.json` (this repo): 2018-2026 trade lists of the earlier rebuild audit (#435).', '');
  return L.join('\n');
}

export function run(dir, outDir, opt = {}) {
  const at = opt.at || new Date().toISOString();
  const r = buildClaims(dir, opt);
  const doc = round({ at, bar: BAR, ...r });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'robustness.json'), JSON.stringify(doc, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, 'robustness.md'), toMarkdown(doc) + '\n');
  return doc;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const dir = a.find((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--'))) || process.env.COUNCIL_DATA;
  if (!dir) { console.error('usage: node research/robustness.mjs <council-data dir> [--out dir] [--iters 5000] [--seed 7]'); process.exit(2); }
  const doc = run(dir, opt('--out', HERE), { iters: +opt('--iters', 5000), seed: +opt('--seed', 7) });
  for (const c of doc.claims) console.log(c.verdict.padEnd(11), String(c.n).padStart(6), c.mean == null ? '' : (c.mean >= 0 ? '+' : '') + c.mean.toFixed(3), ' ', c.name);
}
