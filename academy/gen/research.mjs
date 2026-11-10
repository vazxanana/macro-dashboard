// MeridianX Academy: the research engine. Studies of the seven edges on the committed train data, written as notebook entries.
//
//   node academy/gen/research.mjs            # writes academy/data/research.json (deterministic, a second or two)
//
// Reads only committed files: ml/data/matrix.json.gz (one row a candidate: the label columns and the 95 feature values),
// academy/data/eval.json (the decision policy against taking every setup) and academy/data/meta.json. No candles, no
// network, no secrets, no paid service. Paper research only: nothing here places an order or changes a rule.
//
// WHAT COUNTS AS A TRADE HERE: train pool, not flagged (rule.clockShift, rule.pre2020), filled (an order whose reason is
// missed / expired / cancelled is not a trade). Net R is after costs (the netR label).
//
// THE EXAM POOL IS NEVER READ. loadTrain() looks at an exam row's edge and pool tag, counts it and moves on: no outcome
// column and no feature of that row is touched. The test scrambles every exam outcome and gets the same bytes back.
//
// NO LOOK-AHEAD IN A CONDITION. A bucket is a list of lesson conditions on feature keys, all known at the signal time.
// Membership is decided by MXA.lessons.matches, the same function the decision engine uses, so a drafted lesson fires on
// exactly the trades its study counted. Outcome columns are only ever averaged, never used to choose a row.
//
// =====================================================================================================================
// PRE-REGISTRATION. Everything from here to the line "END OF PRE-REGISTRATION" was written BEFORE any condition result was
// computed: the families, the buckets, the split, the minimum sample, the correction and the pass rule. The only numbers
// known beforehand were the published baselines of eval.json and the feature value counts (no outcomes). Nothing below was
// tuned after a run. If a constant here is ever changed after a run, add a line to AMENDMENTS saying what and why.
// =====================================================================================================================
export const RECIPE = 'research-1';
export const SPLIT = 0.7;            // discovery = the first 70 % of an edge's trades in signal-time order (by count); confirmation = the rest
export const MIN_N = 20;             // at least this many trades inside AND outside the bucket, in the discovery part AND in the confirmation part
export const T_PASS = 2;             // |Welch t| a part must reach
export const FDR = 0.10;             // Benjamini-Hochberg false discovery rate across ALL discovery tests of the run
export const TERCILE = 1 / 3;        // numeric keys: the lowest and the highest third, cut on the discovery part only
export const UNFAMILIAR_N = 20;      // regime study: fewer trades than this in a regime = "unfamiliar"
export const MIN_COMMON_DAYS = 20;   // book study: a correlation needs this many days on which both edges closed a trade
export const AMENDMENTS = [];        // changes to anything in this block after a run: [{ date, what, why }]

// One bucket = one condition = one test. A categorical key gives one bucket per listed value, a yes / no key one bucket
// (the other side is the same test), a numeric key two buckets (lowest third, highest third). Rows where the key is
// unknown (null) are left out of that study altogether.
const cat = (f, values, say) => ({ f, type: 'cat', values, say });
const flag = (f, v, say) => ({ f, type: 'flag', v, say });
const num = (f, name) => ({ f, type: 'num', name });
const atLeast = (f, v, say) => ({ f, type: 'min', v, say });
export const FAMILIES = [
  { id: 'regime', title: 'Market regime', keys: [
    cat('regime', ['trending', 'ranging', 'breakout', 'reversal', 'high-vol', 'low-vol'], (v) => `the regime is ${v}`),
    cat('regimeHtf', ['trending', 'ranging', 'breakout', 'reversal', 'high-vol', 'low-vol'], (v) => `the regime one timeframe up is ${v}`),
    num('effRatio', 'the efficiency ratio') ] },
  { id: 'bias', title: 'Higher-timeframe bias and structure agreement', keys: [
    cat('biasAlign', ['with', 'against', 'neutral'], (v) => (v === 'neutral' ? 'the higher-timeframe bias is neutral' : `the trade is ${v} the higher-timeframe bias`)),
    cat('ltfAlign', ['with', 'against', 'neutral'], (v) => (v === 'neutral' ? 'the lower-timeframe structure is neutral' : `the trade is ${v} the lower-timeframe structure`)),
    flag('htfLtfConflict', true, 'the higher and lower timeframes disagree') ] },
  { id: 'time', title: 'Session and day of week', keys: [
    cat('session', ['asia', 'london', 'overlap', 'newyork', 'late'], (v) => `the session is ${v}`),
    cat('dow', ['mon', 'tue', 'wed', 'thu', 'fri'], (v) => `the day is ${{ mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' }[v]}`) ] },
  { id: 'volatility', title: 'Volatility', keys: [
    num('atrPctile', 'the volatility rank'),
    flag('volAbnormal', true, 'volatility is abnormal (ATR at least twice its 100-bar median)') ] },
  { id: 'geometry', title: 'Stop size, reward to risk and side', keys: [
    num('stopAtr', 'the stop size in ATR'),
    num('rr', 'the reward to risk'),
    num('entryOffset', 'the entry offset from the last close in ATR'),
    flag('side', 'buy', 'the trade is a buy') ] },
  { id: 'event', title: 'Scheduled releases', keys: [
    flag('eventNear', true, 'a high-impact release is near') ] },
  { id: 'location', title: 'Location and resting levels', keys: [
    cat('locFor', ['good', 'poor', 'mid'], (v) => `the entry location is ${v}`),
    num('distSR', 'the distance to the nearest support or resistance in ATR'),
    atLeast('oppLiq', 1, 'a resting level sits between the entry and the target') ] },
  { id: 'trigger', title: 'Trigger quality', keys: [
    cat('confirm', ['strong', 'weak', 'against'], (v) => `the trigger bar confirmation is ${v}`),
    cat('sweepFor', ['with', 'against', 'none'], (v) => (v === 'none' ? 'there is no recent sweep' : `a recent sweep is ${v} the trade`)),
    cat('dispFor', ['with', 'against', 'none'], (v) => (v === 'none' ? 'there is no recent displacement' : `a recent displacement is ${v} the trade`)),
    cat('momFor', ['with', 'against', 'flat'], (v) => (v === 'flat' ? 'momentum is flat' : `momentum is ${v} the trade`)) ] },
];
export const PASS_RULE = [
  `An edge runs condition studies only if its confirmation part holds at least ${2 * MIN_N} trades; a smaller edge gets one entry saying so and no test.`,
  `A condition is tested only when the bucket and the rest each hold at least ${MIN_N} trades in the discovery part and in the confirmation part. Otherwise: inconclusive, too few trades, and it is not counted as a test.`,
  'The measure is net R a trade inside the bucket minus outside it, with a two-sided Welch t, in each part.',
  `Discovery passes at |t| >= ${T_PASS}. A condition that does not pass discovery is inconclusive.`,
  'A condition that passes discovery is: rejected when the confirmation difference has the opposite sign; in-sample when the sign holds but the confirmation |t| is under ' + T_PASS + `; out-of-sample when the sign holds and the confirmation |t| is at least ${T_PASS}.`,
  `validated = out-of-sample AND the discovery p-value survives Benjamini-Hochberg at ${FDR * 100} % across every discovery test of the run.`,
  'Baseline, regime, book and policy studies are descriptions of the train pool. They carry the label in-sample and are never called an edge.',
];
export const LESSON_RULE = [
  'A draft lesson is written only for a condition that reached out-of-sample or validated.',
  'Bucket worse than the rest: the draft says WAIT when the condition holds. Bucket better than the rest: the draft says TAKE.',
  'Every draft is inactive, carries its evidence (n, net R a trade and t in both parts) and its study id, and says so when the bucket still made money (a WAIT then gives up profit) or still lost money (better than the rest is not good).',
  'Research proposes. The mentor decides.',
];
// ================================================ END OF PRE-REGISTRATION ================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { EDGES } from '../edges.mjs';

const MXA = createRequire(import.meta.url)('../../assets/academy-core.js');
const SELF = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(SELF), '../..');
export const FILES = { matrix: path.join(ROOT, 'ml/data/matrix.json.gz'), evalFile: path.join(ROOT, 'academy/data/eval.json'), meta: path.join(ROOT, 'academy/data/meta.json'), out: path.join(ROOT, 'academy/data/research.json') };
export const VALIDATION = ['hypothesis', 'in-sample', 'out-of-sample', 'validated', 'rejected', 'inconclusive'];   // the values notebook.add takes
const COMMAND = 'node academy/gen/research.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const rd = (x, d = 3) => (fin(x) ? +x.toFixed(d) + 0 : null);
const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => sum(a) / a.length;
const variance = (a, m) => a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1);
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const sgn = (x) => (x > 0 ? '+' : '') + x;
const byTime = (a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---- statistics ---------------------------------------------------------------------------------------------------------
// ln Gamma (Lanczos) and the regularised incomplete beta function (continued fraction), for the Student t distribution
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf(a, b, x) {
  const TINY = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < TINY) d = TINY; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}
function ibeta(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
// two-sided p of a Student t with df degrees of freedom: P(|T| >= |t|)
export function tTwoSided(t, df) { return fin(t) && fin(df) && df > 0 ? ibeta(df / 2, 0.5, df / (df + t * t)) : null; }

// n, mean, total, one-sample t against zero and the win rate (unrounded; null where it cannot be computed)
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, avg: null, total: 0, t: null, win: null };
  const total = sum(a), avg = total / n, v = n > 1 ? variance(a, avg) : 0;
  return { n, avg, total, t: n > 1 && v > 0 ? avg / Math.sqrt(v / n) : null, win: a.filter((x) => x > 0).length / n };
}
const statOut = (s) => ({ n: s.n, avg: rd(s.avg), total: rd(s.total, 2), t: rd(s.t, 2), win: rd(s.win) });   // the rounding eval.json uses
// Welch's t for mean(a) - mean(b), its degrees of freedom and the two-sided p
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: a.length && b.length ? mean(a) - mean(b) : null, t: null, df: null, p: null };
  const ma = mean(a), mb = mean(b), va = variance(a, ma) / a.length, vb = variance(b, mb) / b.length, se = Math.sqrt(va + vb);
  if (!(se > 0)) return { diff: ma - mb, t: null, df: null, p: null };
  const t = (ma - mb) / se, df = (va + vb) * (va + vb) / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
  return { diff: ma - mb, t, df, p: tTwoSided(t, df) };
}
// Benjamini-Hochberg step-up at rate q: pass[i] for every p-value, the adjusted p-values and how many passed
export function benjaminiHochberg(p, q) {
  const m = p.length, order = p.map((_, i) => i).sort((i, j) => p[i] - p[j] || i - j), pass = new Array(m).fill(false), adjusted = new Array(m).fill(null);
  let k = 0; for (let i = 0; i < m; i++) if (p[order[i]] <= (i + 1) / m * q) k = i + 1;
  for (let i = 0; i < k; i++) pass[order[i]] = true;
  let prev = 1; for (let i = m - 1; i >= 0; i--) { prev = Math.min(prev, p[order[i]] * m / (i + 1)); adjusted[order[i]] = prev; }
  return { m, k, pass, adjusted, threshold: k ? k / m * q : 0 };
}
export const profitFactor = (a) => { const up = sum(a.filter((x) => x > 0)), dn = -sum(a.filter((x) => x < 0)); return dn > 0 ? up / dn : null; };
// the deepest fall from a running high of the cumulative sum (the curve starts at zero)
export function maxDrawdown(a) { let eq = 0, peak = 0, dd = 0; for (const x of a) { eq += x; if (eq > peak) peak = eq; if (peak - eq > dd) dd = peak - eq; } return dd; }
export function pearson(x, y) {
  const n = x.length; if (n < 3) return { n, r: null, t: null };
  const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my); }
  if (!(sxx > 0 && syy > 0)) return { n, r: null, t: null };
  const r = sxy / Math.sqrt(sxx * syy); return { n, r, t: Math.abs(r) < 1 ? r * Math.sqrt((n - 2) / (1 - r * r)) : null };
}

// ---- the data -----------------------------------------------------------------------------------------------------------
// Train-pool rows only. An exam row is counted by its edge and pool tag and then skipped: nothing else of it is read.
export function loadTrain(matrixFile = FILES.matrix) {
  const m = JSON.parse(zlib.gunzipSync(fs.readFileSync(matrixFile)).toString('utf8')), L = Object.fromEntries(m.labelKeys.map((k, i) => [k, i])), F = m.labelKeys.length, keys = m.featureKeys;
  const counts = {}, orders = [], h = crypto.createHash('sha256');
  for (const e of EDGES) counts[e.id] = { candidates: 0, exam: 0, flaggedTrain: 0, orders: 0, unfilled: 0, trades: 0 };
  for (const r of m.rows) {
    const c = counts[r[L.edge]]; if (!c) throw new Error('matrix: unknown edge ' + r[L.edge]);
    c.candidates++;
    if (r[L.pool] !== 'train') { c.exam++; continue; }                       // the exam pool: the mentor's test set
    if (r[L.clockShift] || r[L.pre2020]) { c.flaggedTrain++; continue; }
    const filled = r[L.filled] === true, f = {}; for (let i = 0; i < keys.length; i++) f[keys[i]] = r[F][i];
    if (filled && !(fin(r[L.netR]) && fin(r[L.exitT]))) throw new Error('matrix: a filled trade without a result: ' + r[L.id]);
    c.orders++; if (filled) c.trades++; else c.unfilled++;
    orders.push({ id: r[L.id], edge: r[L.edge], t: r[L.t], filled, netR: filled ? r[L.netR] : null, exitT: filled ? r[L.exitT] : null, f });
    h.update(JSON.stringify(r) + '\n');
  }
  return { version: m.version, dataVersion: m.dataVersion, policy: m.policy, generated: m.generated, featureKeys: keys, counts, orders, rowsHash: h.digest('hex').slice(0, 12) };
}

// ---- 1. baselines -------------------------------------------------------------------------------------------------------
// `orders` = every train order that is not flagged (filled or not), in time order. The period cut follows eval.json: the
// point 70 % of the way from the first order to the last, by time.
export function baseline(orders) {
  const tr = orders.filter((o) => o.filled), R = (a) => a.map((o) => o.netR);
  const t0 = orders.length ? orders[0].t : null, t1 = orders.length ? orders[orders.length - 1].t : null, cut = orders.length ? Math.round(t0 + 0.7 * (t1 - t0)) : null;
  const byExit = tr.slice().sort((a, b) => a.exitT - b.exitT || (a.id < b.id ? -1 : 1)), years = {};
  for (const o of tr) (years[new Date(o.t * 1000).getUTCFullYear()] ||= []).push(o.netR);
  return { from: t0, to: t1, orders: orders.length, unfilled: orders.length - tr.length, ...statOut(stat(R(tr))), profitFactor: rd(profitFactor(R(tr)), 2), maxDrawdownR: rd(maxDrawdown(R(byExit)), 2),
    byYear: Object.keys(years).sort().map((y) => ({ year: +y, ...statOut(stat(years[y])) })),
    split: { cut, first70: statOut(stat(R(tr.filter((o) => o.t <= cut)))), last30: statOut(stat(R(tr.filter((o) => o.t > cut)))) } };
}

// ---- 2. condition studies -----------------------------------------------------------------------------------------------
// The buckets of one edge. Numeric cuts come from the DISCOVERY trades only: the value at the top of the lowest third and
// the value at the bottom of the highest third (both are values that occurred, so the lesson condition is exact).
export function bucketsFor(discovery) {
  const out = [];
  for (const fam of FAMILIES) for (const k of fam.keys) {
    if (k.type === 'cat') for (const v of k.values) out.push({ family: fam.id, f: k.f, label: String(v), when: [{ f: k.f, op: 'eq', v }], text: k.say(v) });
    else if (k.type === 'flag') out.push({ family: fam.id, f: k.f, label: String(k.v), when: [{ f: k.f, op: 'eq', v: k.v }], text: k.say });
    else if (k.type === 'min') out.push({ family: fam.id, f: k.f, label: k.v + 'plus', when: [{ f: k.f, op: 'gte', v: k.v }], text: k.say });
    else {
      const v = discovery.map((o) => o.f[k.f]).filter(fin).sort((a, b) => a - b), n = v.length, c = Math.ceil(n * TERCILE), lo = n >= 3 ? v[c - 1] : null, hi = n >= 3 ? v[n - c] : null;
      out.push({ family: fam.id, f: k.f, label: 'low', cut: lo, when: lo === null ? null : [{ f: k.f, op: 'lte', v: lo }], text: `${k.name} is in the lowest third${lo === null ? '' : ` (${k.f} <= ${lo})`}` });
      out.push({ family: fam.id, f: k.f, label: 'high', cut: hi, when: hi === null ? null : [{ f: k.f, op: 'gte', v: hi }], text: `${k.name} is in the highest third${hi === null ? '' : ` (${k.f} >= ${hi})`}` });
    }
  }
  return out;
}
export const BUCKETS_PER_EDGE = bucketsFor([]).length;
const known = (o, f) => o.f[f] !== null && o.f[f] !== undefined;
// one part of one study: the trades inside the bucket against the rest (rows with an unknown key are in neither)
export function partOf(trades, b) {
  const use = trades.filter((o) => known(o, b.f)), ins = [], outs = [];
  for (const o of use) (b.when && MXA.lessons.matches({ when: b.when }, o.f) ? ins : outs).push(o.netR);
  const w = welch(ins, outs);
  return { from: trades.length ? trades[0].t : null, to: trades.length ? trades[trades.length - 1].t : null, unknown: trades.length - use.length, nIn: ins.length, nOut: outs.length, rIn: ins.length ? mean(ins) : null, rOut: outs.length ? mean(outs) : null, ...w };
}
const partOut = (p) => ({ from: p.from === null ? null : day(p.from), to: p.to === null ? null : day(p.to), nIn: p.nIn, nOut: p.nOut, rIn: rd(p.rIn), rOut: rd(p.rOut), diff: rd(p.diff), t: rd(p.t, 2), df: rd(p.df, 1), p: rd(p.p, 5) });
export const splitOf = (trades) => { const nD = Math.floor(SPLIT * trades.length); return { discovery: trades.slice(0, nD), confirmation: trades.slice(nD) }; };
export const eligible = (trades) => splitOf(trades).confirmation.length >= 2 * MIN_N;
// The pass rule. `d` and `c` are the two parts, `fdrPass` whether the discovery p survived the correction.
export function classify(d, c, fdrPass) {
  if (!d || !c || Math.min(d.nIn, d.nOut, c.nIn, c.nOut) < MIN_N || d.t === null || c.t === null) return { validation: 'inconclusive', reason: 'too few trades' };
  if (Math.abs(d.t) < T_PASS) return { validation: 'inconclusive', reason: 'no difference in discovery' };
  if (!(c.diff * d.diff > 0)) return { validation: 'rejected', reason: 'the sign flipped in confirmation' };
  if (Math.abs(c.t) < T_PASS) return { validation: 'in-sample', reason: 'passes discovery only' };
  return fdrPass ? { validation: 'validated', reason: 'confirmed, and it survived the correction' } : { validation: 'out-of-sample', reason: 'confirmed, but it did not survive the correction' };
}

// ---- the notebook entry -------------------------------------------------------------------------------------------------
const LIMITS = { condition: 'One sample per edge and one cut in time, not a walk-forward. HistData candles. No exam data. Many buckets overlap. Descriptive unless validated.',
  describe: 'Train pool only: each edge misses its exam months (about 30 %) and the clock-shifted weeks. HistData candles. One sample per edge. Descriptive, not a tested edge.' };
function entry(o, ctx) {
  const e = { id: o.id, kind: o.kind, edge: o.edge, title: o.title, hypothesis: o.hypothesis, dataset: o.dataset, sampleSize: o.sampleSize, method: o.method, results: o.results, table: o.table,
    limitations: o.limitations, validation: o.validation, reproducibility: `${COMMAND}; matrix ${ctx.matrix}, eval ${ctx.evalVersion}, ${ctx.dataVersion}, rows ${ctx.rows}; code ${ctx.code}`, tags: o.tags };
  if (!VALIDATION.includes(e.validation)) throw new Error(`${e.id}: bad validation ${e.validation}`);
  return e;
}
const span = (a) => (a.length ? `${day(a[0].t)} to ${day(a[a.length - 1].t)}` : 'no trades');
const partSay = (name, p) => `${name}: ${p.nIn} trades in the bucket at ${sgn(rd(p.rIn))} R against ${p.nOut} outside at ${sgn(rd(p.rOut))} R (difference ${sgn(rd(p.diff))} R, t ${rd(p.t, 2)}).`;

// ---- 6. draft lessons ---------------------------------------------------------------------------------------------------
export function draftLesson(study, edge, at) {
  const T = study.table, d = T.discovery, c = T.confirmation, worse = d.diff < 0, action = worse ? 'WAIT' : 'TAKE';
  const caution = worse ? (d.rIn > 0 && c.rIn > 0 ? ' Caution: these trades still made money in both parts, so waiting on them gives up profit.' : '')
    : (d.rIn <= 0 || c.rIn <= 0 ? ' Caution: these trades lost money in one part. Better than the rest is not the same as good.' : '');
  const text = `Research draft, not active. On ${edge.name}, when ${T.text}, net R a trade was ${worse ? 'lower' : 'higher'} than on the other trades. `
    + `Discovery: n ${d.nIn} at ${sgn(d.rIn)} R against n ${d.nOut} at ${sgn(d.rOut)} R, t ${d.t}. Confirmation: n ${c.nIn} at ${sgn(c.rIn)} R against n ${c.nOut} at ${sgn(c.rOut)} R, t ${c.t}. `
    + `Status: ${study.validation}${study.validation === 'validated' ? '' : ` (it did not survive the correction for ${T.testsInRun} tests)`}. Train pool only: the exam pool has not seen this.${caution}`;
  const L = { id: 'R-' + sha(study.id).slice(0, 10), edge: edge.id, version: 1, active: false, title: `Research draft · ${edge.id}: ${action} when ${T.text}`.slice(0, 160), text, createdAt: at, updatedAt: at,
    when: T.when, then: { action, adjust: {}, note: `Research study ${study.id}: ${study.validation}.` },
    source: { kind: 'research', studyId: study.id, attemptId: null, correctionId: null, candidateId: null, sessionId: null }, supersedes: null,
    stats: { applied: 0, replayPass: 0, replayFail: 0, examN: 0, examAgree: 0, examNetWith: 0, examNetWithout: 0 },
    evidence: { studyId: study.id, validation: study.validation, discovery: d, confirmation: c, q: T.q, fdrPass: T.fdrPass, testsInRun: T.testsInRun } };
  const err = MXA.lessons.validate(L); if (err.length) throw new Error(`${L.id}: the draft lesson is not valid: ${err.join('; ')}`);
  return L;
}

// ---- the run ------------------------------------------------------------------------------------------------------------
export function build({ matrixFile = FILES.matrix, evalFile = FILES.evalFile, metaFile = FILES.meta } = {}) {
  const data = loadTrain(matrixFile), ev = JSON.parse(fs.readFileSync(evalFile, 'utf8')), meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  if (ev.dataVersion !== data.dataVersion) throw new Error(`eval.json (${ev.dataVersion}) and the matrix (${data.dataVersion}) are from different candle versions`);
  const code = sha(fs.readFileSync(SELF, 'utf8')).slice(0, 12);
  const ctx = { matrix: data.version, evalVersion: ev.version, dataVersion: data.dataVersion, rows: data.rowsHash, code };
  const at = Date.parse(meta.generated + 'T00:00:00Z') / 1000;
  const ordersOf = {}, tradesOf = {}; for (const e of EDGES) { ordersOf[e.id] = data.orders.filter((o) => o.edge === e.id).sort((a, b) => a.t - b.t); tradesOf[e.id] = ordersOf[e.id].filter((o) => o.filled).sort(byTime); }
  const allOrders = data.orders.slice().sort(byTime), allTrades = allOrders.filter((o) => o.filled), studies = [];

  // 1. baselines, checked against eval.json
  const same = (mine, theirs, what) => { for (const k of ['n', 'avg', 'total', 't', 'win']) if (mine[k] !== theirs[k]) throw new Error(`${what}: ${k} is ${mine[k]} here and ${theirs[k]} in eval.json`); };
  const baseEntry = (id, name, edgeId, orders, evBlock, c) => {
    const b = baseline(orders); same(b, evBlock.mechanical, id); same(b.split.first70, evBlock.split.first70.mechanical, id + ' first 70 %'); same(b.split.last30, evBlock.split.last30.mechanical, id + ' last 30 %');
    if (b.split.cut !== evBlock.split.cut) throw new Error(`${id}: the period cut differs from eval.json`);
    const yrs = b.byYear.filter((y) => y.total > 0).length;
    studies.push(entry({ id, kind: 'baseline', edge: edgeId, title: `${name}: baseline, every setup taken`, hypothesis: `${name} makes money after costs when every setup is taken.`,
      dataset: `Train pool, not flagged, filled trades: ${b.n} trades, ${span(orders)}. Left out: ${c.exam} exam setups (never read), ${c.flaggedTrain} flagged, ${b.unfilled} orders that never filled.`, sampleSize: b.n,
      method: 'Net R a trade after costs, one-sample t against zero, profit factor, worst drawdown in exit order, by year, and the first 70 % of the period against the last 30 % by time. Checked against eval.json.',
      results: `${b.n} trades, ${rd(b.win * 100, 1)} % won, ${sgn(b.avg)} R a trade, total ${sgn(b.total)} R, t ${b.t}, profit factor ${b.profitFactor}, worst drawdown ${b.maxDrawdownR} R. ${yrs} of ${b.byYear.length} years positive. First 70 %: n ${b.split.first70.n}, ${sgn(b.split.first70.avg)} R. Last 30 %: n ${b.split.last30.n}, ${sgn(b.split.last30.avg)} R.`,
      table: b, limitations: LIMITS.describe + (b.n < 30 ? ' Under 30 trades: the t says little.' : ''), validation: 'in-sample', tags: ['research', 'baseline'] }, ctx));
    return b;
  };
  const sumC = (k) => sum(EDGES.map((e) => data.counts[e.id][k])), base = {};
  for (const e of EDGES) base[e.id] = baseEntry(`base:${e.id}`, e.name, e.id, ordersOf[e.id], ev.edges[e.id], data.counts[e.id]);
  base.book = baseEntry('base:book', 'The book of seven', null, allOrders, ev.overall, { exam: sumC('exam'), flaggedTrain: sumC('flaggedTrain') });

  // 2. condition studies: compute every part first, then correct across all discovery tests, then classify
  const work = [];
  for (const e of EDGES) {
    const tr = tradesOf[e.id], sp = splitOf(tr);
    for (const b of bucketsFor(sp.discovery)) { const d = partOf(sp.discovery, b), c = partOf(sp.confirmation, b); work.push({ e, b, d, c, n: tr.length, tested: Math.min(d.nIn, d.nOut, c.nIn, c.nOut) >= MIN_N && d.t !== null && c.t !== null }); }
  }
  const tested = work.filter((w) => w.tested), bh = benjaminiHochberg(tested.map((w) => w.d.p), FDR);
  tested.forEach((w, i) => { w.q = bh.adjusted[i]; w.fdrPass = bh.pass[i]; });
  // what chance alone would produce: every test passing discovery with probability P(|T| >= 2), then confirmation with P(T >= 2)
  const chanceD = sum(tested.map((w) => tTwoSided(T_PASS, w.d.df))), chanceC = sum(tested.map((w) => tTwoSided(T_PASS, w.d.df) * tTwoSided(T_PASS, w.c.df) / 2));
  const condCount = Object.fromEntries(VALIDATION.map((v) => [v, 0])), lessons = [];
  for (const e of EDGES) {
    const tr = tradesOf[e.id], sp = splitOf(tr), mine = work.filter((w) => w.e === e), few = mine.filter((w) => !w.tested);
    const parts = `Discovery = the first ${sp.discovery.length} by signal time${sp.discovery.length ? ` (to ${day(sp.discovery[sp.discovery.length - 1].t)})` : ''}, confirmation = the last ${sp.confirmation.length}.`;
    for (const w of mine.filter((x) => x.tested)) {
      const { b, d, c } = w, k = classify(d, c, w.fdrPass), id = `cond:${e.id}:${b.f}:${b.label}`;
      condCount[k.validation]++;
      const study = entry({ id, kind: 'condition', edge: e.id, title: `${e.name}: ${b.text}`.slice(0, 160), hypothesis: `Net R a trade of ${e.name} differs when ${b.text}.`,
        dataset: `Train pool, not flagged, filled trades of ${e.id}: ${w.n}, ${span(tr)}. ${parts} Key unknown and left out: ${d.unknown + c.unknown}.`, sampleSize: d.nIn + d.nOut + c.nIn + c.nOut,
        method: `Net R a trade in the bucket minus the rest, Welch t, in each part. Pre-registered: ${MIN_N} trades a side a part, discovery |t| >= ${T_PASS}, Benjamini-Hochberg at ${FDR * 100} % over all discovery tests of the run.`,
        results: `${partSay('Discovery', d)} ${partSay('Confirmation', c)} Verdict: ${k.validation}, ${k.reason}. Adjusted p ${rd(w.q, 4)} over ${bh.m} tests.`,
        table: { family: b.family, key: b.f, bucket: b.label, text: b.text, when: b.when, tested: true, discovery: partOut(d), confirmation: partOut(c), q: rd(w.q, 5), fdrPass: w.fdrPass, testsInRun: bh.m, reason: k.reason },
        limitations: LIMITS.condition, validation: k.validation, tags: [...new Set(['research', 'condition', b.family, b.f])] }, ctx);
      studies.push(study);
      if (k.validation === 'out-of-sample' || k.validation === 'validated') lessons.push(draftLesson(study, e, at));
    }
    if (!few.length) continue;
    // the conditions of this edge that could not be tested: one entry, every bucket listed with its counts (no averages: they would be noise)
    condCount.inconclusive += few.length;
    const none = few.length === mine.length;
    studies.push(entry({ id: `cond:${e.id}:untested`, kind: 'condition', edge: e.id, title: `${e.name}: ${few.length} conditions with too few trades to test`, hypothesis: `Net R a trade of ${e.name} differs in one of these ${few.length} pre-registered buckets.`,
      dataset: `Train pool, not flagged, filled trades of ${e.id}: ${tr.length}, ${span(tr)}. ${parts}`, sampleSize: tr.length,
      method: `A condition is tested only when the bucket and the rest each hold ${MIN_N} trades in the discovery part and in the confirmation part. These did not, so no test was run and none is counted.`,
      results: `Inconclusive: too few trades. ${few.length} of ${mine.length} conditions are untested for this edge.` + (none ? ` The confirmation part has ${sp.confirmation.length} trades and a test needs at least ${2 * MIN_N}, so no condition can be tested here.` : ''),
      table: { tested: false, covers: few.length, of: mine.length, needs: MIN_N, discovery: sp.discovery.length, confirmation: sp.confirmation.length, reason: 'too few trades', columns: ['key', 'bucket', 'discovery in', 'discovery out', 'confirmation in', 'confirmation out'],
        rows: few.map((w) => [w.b.f, w.b.label, w.d.nIn, w.d.nOut, w.c.nIn, w.c.nOut]) },
      limitations: LIMITS.condition, validation: 'inconclusive', tags: ['research', 'condition', 'too-few-trades'] }, ctx));
  }

  // 3. regime study: the whole train sample of each edge by regime and by volatility band (a description, no split)
  const REGIMES = ['trending', 'ranging', 'breakout', 'reversal', 'high-vol', 'low-vol', 'event'], VOLS = ['low', 'normal', 'high'];
  for (const e of EDGES) {
    const tr = tradesOf[e.id], row = (key, v) => { const s = statOut(stat(tr.filter((o) => o.f[key] === v).map((o) => o.netR))); return { value: v, ...s, familiar: s.n >= UNFAMILIAR_N }; };
    const regime = REGIMES.map((v) => row('regime', v)), vol = VOLS.map((v) => row('volState', v));
    const say = (rows) => rows.filter((r) => r.familiar).map((r) => `${r.value} n ${r.n}, ${sgn(r.avg)} R, t ${r.t}`).join('; ') || 'none';
    const unf = (rows) => rows.filter((r) => !r.familiar).map((r) => `${r.value} (${r.n})`).join(', ') || 'none';
    studies.push(entry({ id: `regime:${e.id}`, kind: 'regime', edge: e.id, title: `${e.name}: results by regime and volatility band`, hypothesis: `${e.name} does not earn the same in every regime and volatility band.`,
      dataset: `Train pool, not flagged, filled trades of ${e.id}: ${tr.length}, ${span(tr)}. The event regime exists only from 2022, where the release calendar begins.`, sampleSize: tr.length,
      method: `Net R a trade and one-sample t against zero in each regime and each volatility band. Fewer than ${UNFAMILIAR_N} trades in a regime = unfamiliar. No split in time and no correction: a description.`,
      results: `Familiar regimes: ${say(regime)}. Unfamiliar: ${unf(regime)}. Volatility bands: ${say(vol)}. Unfamiliar: ${unf(vol)}.`,
      table: { regime, volState: vol, unfamiliarBelow: UNFAMILIAR_N }, limitations: LIMITS.describe + ' Ten looks an edge: a single t near 2 is weak.', validation: 'in-sample', tags: ['research', 'regime', 'volatility'] }, ctx));
  }

  // 4. book study: daily net R booked on the UTC day of the exit, every trade one unit of risk
  const daily = {}, active = {};
  for (const e of EDGES) { daily[e.id] = new Map(); for (const o of tradesOf[e.id]) { const k = Math.floor(o.exitT / 86400); daily[e.id].set(k, (daily[e.id].get(k) || 0) + o.netR); for (let x = Math.floor(o.t / 86400); x <= k; x++) { if (!active[x]) active[x] = new Set(); active[x].add(e.id); } } }
  const pairs = [];
  for (let i = 0; i < EDGES.length; i++) for (let j = i + 1; j < EDGES.length; j++) {
    const a = daily[EDGES[i].id], b = daily[EDGES[j].id], x = [], y = []; for (const [k, v] of [...a].sort((p, q) => p[0] - q[0])) if (b.has(k)) { x.push(v); y.push(b.get(k)); }
    const enough = x.length >= MIN_COMMON_DAYS, r = enough ? pearson(x, y) : { r: null, t: null };
    pairs.push({ a: EDGES[i].id, b: EDGES[j].id, commonDays: x.length, r: rd(r.r), t: rd(r.t, 2), note: enough ? null : 'too few common days' });
  }
  const bookDay = new Map(), closers = new Map();
  for (const e of EDGES) for (const [k, v] of daily[e.id]) { bookDay.set(k, (bookDay.get(k) || 0) + v); closers.set(k, (closers.get(k) || 0) + 1); }
  const series = [...bookDay].sort((p, q) => p[0] - q[0]), bookDD = maxDrawdown(series.map((p) => p[1])), worst = series.reduce((m, p) => (p[1] < m[1] ? p : m), series[0]);
  const actDays = Object.keys(active), multiAct = actDays.filter((k) => active[k].size > 1).length, multiClose = [...closers.values()].filter((n) => n > 1).length;
  const ownDD = EDGES.map((e) => ({ edge: e.id, maxDrawdownR: base[e.id].maxDrawdownR })), measured = pairs.filter((p) => p.r !== null), strongest = measured.slice().sort((p, q) => Math.abs(q.r) - Math.abs(p.r) || (p.a + p.b < q.a + q.b ? -1 : 1))[0] || null;
  studies.push(entry({ id: 'book:seven', kind: 'book', edge: null, title: 'The book of seven: overlap, correlation and drawdown', hypothesis: 'The seven edges do not all win and lose on the same days, so the book falls less than its parts added together.',
    dataset: `Train pool, not flagged, filled trades of all seven edges: ${allTrades.length}, ${span(allTrades)}. ${series.length} days with a closed trade.`, sampleSize: allTrades.length,
    method: `Each trade is one unit of risk. Net R is booked on the UTC day of the exit. A pair's correlation uses only the days on which both edges closed a trade and needs ${MIN_COMMON_DAYS} of them. A trade is active from its signal day to its exit day.`,
    results: `More than one edge had a trade active on ${rd(100 * multiAct / actDays.length, 1)} % of ${actDays.length} active days, and more than one closed a trade on ${rd(100 * multiClose / series.length, 1)} % of ${series.length} closing days. `
      + `${measured.length} of ${pairs.length} pairs have enough common days${strongest ? `; the largest correlation is ${strongest.a} with ${strongest.b}, r ${sgn(strongest.r)} on ${strongest.commonDays} days (t ${strongest.t})` : ''}. `
      + `Worst drawdown of the book ${rd(bookDD, 2)} R on daily closes against ${rd(sum(ownDD.map((d) => d.maxDrawdownR)), 2)} R for the seven edges' own worst drawdowns added together.`,
    table: { days: { active: actDays.length, moreThanOneActive: multiAct, shareActive: rd(multiAct / actDays.length), closing: series.length, moreThanOneClosing: multiClose, shareClosing: rd(multiClose / series.length) }, pairs,
      book: { trades: allTrades.length, totalR: rd(sum(series.map((p) => p[1])), 2), maxDrawdownR: rd(bookDD, 2), maxDrawdownByTradeR: base.book.maxDrawdownR, worstDay: { day: day(worst[0] * 86400), netR: rd(worst[1], 2) }, edgesOwn: ownDD } },
    limitations: LIMITS.describe + ' Each edge misses different months, so this is not the live book and its drawdown is understated. Correlations on common days only rest on few days.', validation: 'in-sample', tags: ['research', 'book', 'correlation', 'drawdown'] }, ctx));

  // 5. policy study: eval.json joined, plus what the trades behind each wait reason made
  const PROXY = [['event', 'gate', 'eventNear', 'eq', true], ['volatility', 'gate', 'volAbnormal', 'eq', true], ['conflict', 'gate', 'htfLtfConflict', 'eq', true], ['oppLiq', 'factor', 'oppLiq', 'gte', 1], ['htfBias', 'factor', 'biasAlign', 'eq', 'against'],
    ['momentum', 'factor', 'momFor', 'eq', 'against'], ['confirmation', 'factor', 'confirm', 'eq', 'against'], ['displacement', 'factor', 'dispFor', 'eq', 'against']];
  const evCount = (name, type) => { const l = type === 'gate' ? ev.overall.waits.gates.find((g) => g.code === name) : ev.overall.waits.topContradiction.find((g) => g.factor === name); return l ? l.n : 0; };
  const reasons = PROXY.map(([reason, type, f, op, v]) => { const s = statOut(stat(allTrades.filter((o) => MXA.lessons.matches({ when: [{ f, op, v }] }, o.f)).map((o) => o.netR))); return { reason, type, policyWaits: evCount(reason, type), feature: `${f} ${op} ${v}`, trades: s.n, share: rd(s.n / allTrades.length), avg: s.avg, total: s.total, t: s.t }; });
  const byTotal = reasons.slice().sort((a, b) => b.total - a.total), top = byTotal[0], bottom = byTotal[byTotal.length - 1];
  const sayReason = (r) => `${r.reason} (n ${r.trades}, total ${sgn(r.total)} R${r.share > 0.9 ? ', but that is nearly every trade, so it says little' : ''})`;
  const polRow = (id, b) => ({ edge: id, every: b.mechanical, take: { n: b.take.n, avg: b.take.avg, total: b.take.total }, wait: { n: b.wait.n, avg: b.wait.avg, total: b.wait.total }, takeMinusWait: b.diff.takeMinusWait, t: b.diff.t, verdict: b.verdict });
  const polEdges = EDGES.map((e) => polRow(e.id, ev.edges[e.id])), o = ev.overall, mostSkipped = polEdges.slice().sort((a, b) => b.wait.total - a.wait.total)[0];
  studies.push(entry({ id: 'policy:eval', kind: 'policy', edge: null, title: 'The decision policy against taking every setup', hypothesis: 'The trades the policy takes earn more net R a trade than the trades it waits on.',
    dataset: `eval.json ${ev.version} (policy ${ev.policy}, no lessons, no model): ${o.mechanical.n} train trades of the seven edges. Feature rows from the matrix for the same trades.`, sampleSize: o.mechanical.n,
    method: 'TAKE against WAIT is read from eval.json (Welch t). eval.json stores how often each wait reason fired, not what those trades made, so the reason table shows every train trade that carries the feature behind the reason, waited on or not: a proxy.',
    results: `The policy took ${o.take.n} trades at ${sgn(o.take.avg)} R and waited on ${o.wait.n} at ${sgn(o.wait.avg)} R: difference ${sgn(o.diff.takeMinusWait)} R, t ${o.diff.t}, ${o.verdict}. The waits skipped ${sgn(o.wait.total)} R in total, most on ${mostSkipped.edge} (${sgn(mostSkipped.wait.total)} R, n ${mostSkipped.wait.n}). `
      + `By the feature behind each reason, the most profit sits behind ${byTotal.slice(0, 2).map(sayReason).join(' and ')}, and the ${bottom.total < 0 ? 'most loss' : 'least profit'} behind ${sayReason(bottom)}.${byTotal.every((r) => r.total > 0) ? ' No reason marks a group of trades that lost money.' : ''}`,
    table: { policy: ev.policy, evalVersion: ev.version, overall: polRow('all', o), edges: polEdges, waits: { n: o.waits.n, gateOnly: o.waits.gateOnly, evidenceOnly: o.waits.evidenceOnly, both: o.waits.both }, reasons,
      note: 'reasons: policyWaits = how often the policy named the reason (eval.json: orders for a gate, the strongest contradicting factor otherwise); trades, share, avg, total, t = all train trades carrying the feature (a proxy, not the policy\'s own waits). The event gate is exact: it fires on every setup with eventNear. The volatility and conflict gates are looser than the feature (the threshold and the conflict rule differ by edge). The unfamiliar-regime gate has no single feature and is not listed.' },
    limitations: LIMITS.describe + ' The reason table is a proxy: exact net R by wait reason needs the policy walk to store it.', validation: 'in-sample', tags: ['research', 'policy'] }, ctx));

  // ---- the file ----
  const byValidation = Object.fromEntries(VALIDATION.map((v) => [v, studies.filter((s) => s.validation === v).length]));
  const passD = tested.filter((w) => Math.abs(w.d.t) >= T_PASS).length, registered = EDGES.length * BUCKETS_PER_EDGE;
  const counts = { studies: studies.length, tests: bh.m, byValidation,
    conditions: { registered, tested: bh.m, tooFewTrades: registered - bh.m, edgesTested: EDGES.filter((e) => tested.some((w) => w.e === e)).map((e) => e.id), edgesTooSmall: EDGES.filter((e) => !tested.some((w) => w.e === e)).map((e) => e.id), byValidation: condCount, passedDiscovery: passD, survivedCorrection: bh.k },
    expectedByChance: { passDiscovery: rd(chanceD, 1), outOfSample: rd(chanceC, 2), note: `With no real effect anywhere, about ${rd(chanceD, 1)} of the ${bh.m} tests would pass discovery (|t| >= ${T_PASS}) and about ${rd(chanceC, 2)} would also confirm with the same sign. The tests overlap, so these are rough.` } };
  const nQual = lessons.length;
  const summary = [`${bh.m} of ${registered} pre-registered conditions had enough trades to test. ${passD} passed discovery; chance alone gives about ${rd(chanceD, 1)}.`,
    `${condCount.validated} validated, ${condCount['out-of-sample']} out-of-sample, ${condCount['in-sample']} in-sample only, ${condCount.rejected} rejected, ${condCount.inconclusive} inconclusive.`,
    condCount.validated ? 'A validated condition is still one sample on train data. The exam pool has not seen it.' : 'Nothing is validated. No condition here may be called an edge.'];
  const out = { version: sha(JSON.stringify([RECIPE, code, ctx])).slice(0, 12), generated: meta.generated, recipe: RECIPE,
    dataVersions: { matrix: data.version, eval: ev.version, candles: data.dataVersion, policy: ev.policy, core: MXA.VERSION, rows: data.rowsHash, code },
    what: 'Studies of the seven edges on the train pool: filled trades that are not flagged, net R after costs. The exam pool is never read. Research proposes; the mentor decides.',
    preregistration: { statement: 'Families, buckets, split, minimum sample, correction and pass rule were fixed in the code before any condition result was computed. Nothing was tuned after a run.', amendments: AMENDMENTS,
      families: FAMILIES.map((f) => ({ id: f.id, title: f.title, keys: f.keys.map((k) => k.f) })),
      buckets: { perEdge: BUCKETS_PER_EDGE, rule: 'One bucket a listed value of a categorical key, one for a yes / no key, two for a numeric key (the lowest and the highest third, cut on the discovery part only). Rows where the key is unknown are left out.',
        keys: FAMILIES.flatMap((f) => f.keys.map((k) => ({ key: k.f, family: f.id, type: k.type, buckets: k.type === 'cat' ? k.values : k.type === 'num' ? ['low', 'high'] : k.type === 'min' ? [`>= ${k.v}`] : [String(k.v)] }))) },
      split: { discovery: SPLIT, by: 'the first 70 % of an edge\'s trades in signal-time order, by count; confirmation is the rest', baseline: 'baselines use the period cut of eval.json: 70 % of the way from the first order to the last, by time' },
      minN: MIN_N, tPass: T_PASS, fdr: FDR, passRule: PASS_RULE, lessonRule: LESSON_RULE, unfamiliarBelow: UNFAMILIAR_N, minCommonDays: MIN_COMMON_DAYS },
    pool: { trades: allTrades.length, perEdge: Object.fromEntries(EDGES.map((e) => [e.id, data.counts[e.id]])), note: 'exam = setups of the exam pool, counted and never read; flaggedTrain = clock-shifted weeks and setups before 2020; unfilled = orders that never filled.' },
    counts, summary,
    proposedLessonsNote: nQual ? `${nQual} draft lesson${nQual === 1 ? '' : 's'}, all inactive. Each is one sample on train data: test it on the exam pool before switching it on.` : 'No draft lessons: no condition reached out-of-sample or validated.' };
  return { out, studies, lessons };
}

// The file text: the head pretty-printed, then one study a line and one draft lesson a line.
export function render({ out, studies, lessons }) {
  const head = JSON.stringify(out, null, 1), line = (a) => (a.length ? '[\n' + a.map((x) => JSON.stringify(x)).join(',\n') + '\n]' : '[]');
  return head.slice(0, head.lastIndexOf('\n}')) + ',\n "studies": ' + line(studies) + ',\n "proposedLessons": ' + line(lessons) + '\n}\n';
}
export const generate = (opts) => render(build(opts));

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const b = build(), text = render(b), c = b.out.counts;
  fs.writeFileSync(FILES.out, text);
  console.error(`research.json: ${b.studies.length} studies, ${c.tests} tests, ${(text.length / 1024).toFixed(0)} KB`);
  for (const s of b.out.summary) console.error(s);
  console.error(b.out.proposedLessonsNote);
}
