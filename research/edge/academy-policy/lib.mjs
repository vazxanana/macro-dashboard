// Academy policy investigation: the pure parts (PREREGISTRATION.md is the contract; nothing here may drift from it).
//
// No file access, no network, no clock. Everything is a function of the outcome-free decision records the walk writes
// (decisions.json) and, where a statistic is asked for, of the net R values handed in by the caller.
//
//   split        discovery = the earliest 60 % of an edge's usable train setups by count, validation = the rest (by time)
//   candidates   C0 (policy-1.0, the incumbent) and C1 to C5, each a pure function of one decision record
//   statistics   Welch t with its degrees of freedom and p, Holm, maximum drawdown in exit order
//   acceptance   the rule of section 7, applied mechanically
import { tTwoSided, maxDrawdown } from '../../../academy/gen/research.mjs';

// ---- constants of the pre-registration -------------------------------------------------------------------------
export const SPLIT = 0.6;
export const MIN_SIDE = 20;          // trades needed in the take-set AND in the wait-set (and on each side of a vote)
export const T_LINE = 2;
export const ALPHA_ONE = 0.0228;     // one-sided normal tail at t = 2 (acceptance)
export const ALPHA_TWO = 0.0455;     // two-sided (the harm check on the incumbent)
export const AUDIT_T = 1;            // C4: a wrong-signed vote is dropped at |t| >= 1
export const HARD_GATES = ['data', 'geometry', 'rr', 'risk', 'lesson-conflict'];
export const JUDGEMENT_GATES = ['event', 'volatility', 'unfamiliar', 'conflict'];
export const EDGE_IDS = ['replica', 'mosha-bo', 'gtrend', 'gtl', 'geg', 'gmp', 'nq-open'];
// the cut times written into the pre-registration (unix seconds, UTC), computed from the candidate files alone
export const CUTS = { replica: 1748863740, 'mosha-bo': 1694416740, gtrend: 1729209840, gtl: 1716825840, geg: 1723853040, gmp: 1693401300, 'nq-open': 1717162620 };
export const PARTS = { replica: [195, 130], 'mosha-bo': [19, 14], gtrend: [10, 8], gtl: [99, 67], geg: [67, 46], gmp: [307, 206], 'nq-open': [206, 138] };

export const CANDIDATES = [
  { id: 'C1', name: 'defer to the edge', what: 'TAKE every setup unless a non-overridable gate fires (missing data, no valid stop, reward to risk after costs under 1, the risk engine, conflicting lessons).' },
  { id: 'C2', name: 'gates only', what: 'TAKE unless any gate fires (the non-overridable ones and event, volatility, unfamiliar, conflict). No evidence scoring.' },
  { id: 'C3', name: 'edge-logic table (a priori)', what: 'policy-1.0 with contradiction votes removed where the vote is the edge\'s own design. replica: location, volatility and the high-vol regime no longer count against a trade, volatility gate at 4. gmp: displacement, oppLiq, volatility and the high-vol regime no longer count against a trade, volatility gate at 4. Other edges unchanged.' },
  { id: 'C4', name: 'discovery sign audit', what: 'policy-1.0 with every vote and judgement gate dropped that is wrong-signed on that edge\'s discovery trades with |t| >= 1 and at least 20 trades on each side. Fitted on discovery, then frozen.' },
  { id: 'C5', name: 'confidence threshold', what: 'TAKE only where policy-1.0 takes and its confidence is medium or high.' },
];
// C3, fixed before the run. dropCon: contradiction factors that no longer count; highVolOk: a high-vol regime is no longer
// a bad regime; volGate: the volatility gate fires at this multiple of the median instead of 2.
export const C3_TABLE = {
  replica: { dropCon: ['location', 'volatility'], highVolOk: true, volGate: 4 },
  gmp: { dropCon: ['displacement', 'oppLiq', 'volatility'], highVolOk: true, volGate: 4 },
};

// ---- small numerics --------------------------------------------------------------------------------------------
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
export const rd = (x, d = 3) => (fin(x) ? +x.toFixed(d) + 0 : null);
const r2 = (x) => Math.round(x * 100) / 100;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const variance = (a, m) => a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1);

// n, mean, total, sd, one-sample t against zero, share of winners
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, avg: null, total: 0, sd: null, t: null, win: null };
  const m = mean(a), v = n > 1 ? variance(a, m) : 0;
  return { n, avg: rd(m), total: rd(m * n, 2), sd: n > 1 ? rd(Math.sqrt(v)) : null, t: n > 1 && v > 0 ? rd(m / Math.sqrt(v / n), 2) : null, win: rd(a.filter((x) => x > 0).length / n) };
}
// Welch's t for mean(a) - mean(b): the difference, t, Welch-Satterthwaite df, one-sided p (a > b) and two-sided p.
// Unrounded t and p are kept (tRaw, pOne, pTwo) so a correction does not work on rounded figures.
export function welch(a, b) {
  const none = { diff: a.length && b.length ? rd(mean(a) - mean(b)) : null, t: null, df: null, tRaw: null, pOne: null, pTwo: null };
  if (a.length < 2 || b.length < 2) return none;
  const ma = mean(a), mb = mean(b), va = variance(a, ma) / a.length, vb = variance(b, mb) / b.length, se = Math.sqrt(va + vb);
  if (!(se > 0)) return none;
  const t = (ma - mb) / se, df = (va + vb) * (va + vb) / (va * va / (a.length - 1) + vb * vb / (b.length - 1)), p2 = tTwoSided(t, df);
  return { diff: rd(ma - mb), t: rd(t, 2), df: rd(df, 1), tRaw: t, pOne: t >= 0 ? p2 / 2 : 1 - p2 / 2, pTwo: p2 };
}
// Holm's step-down adjustment. Input: p values (any order). Output: adjusted p in the same order.
export function holm(ps) {
  const m = ps.length, order = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0] || x[1] - y[1]), out = new Array(m); let run = 0;
  order.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); out[i] = run; });
  return out;
}
// Spearman's rank correlation (average ranks for ties) and its t with n - 2 degrees of freedom
export function spearman(x, y) {
  const n = x.length; if (n < 3) return { rho: null, t: null, n };
  const rank = (a) => { const o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = avg; i = j + 1; } return r; };
  const rx = rank(x), ry = rank(y), mx = mean(rx), my = mean(ry); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  if (!(sxx > 0 && syy > 0)) return { rho: null, t: null, n };
  const rho = sxy / Math.sqrt(sxx * syy);
  return { rho: rd(rho), t: Math.abs(rho) < 1 ? rd(rho * Math.sqrt((n - 2) / (1 - rho * rho)), 2) : null, n };
}
// Maximum drawdown in R of closed trades: exit order (ties by id), equity from zero, largest fall from a running peak.
export const byExit = (trades) => trades.slice().sort((a, b) => a.exitT - b.exitT || (a.id < b.id ? -1 : 1));
export const maxDD = (trades) => rd(maxDrawdown(byExit(trades).map((x) => x.netR)), 2);
// the statistics of one set of trades [{ id, exitT, netR }]
export const setStat = (trades) => ({ ...stat(trades.map((x) => x.netR)), maxDD: trades.length ? maxDD(trades) : null });

// ---- the split -------------------------------------------------------------------------------------------------
// setups: usable train setups of one edge [{ id, t }]. Returns { k, cut, discovery, validation } (arrays of the same objects).
export function splitOf(setups) {
  const s = setups.slice().sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)), k = Math.floor(SPLIT * s.length), cut = s[k].t;
  return { k, cut, discovery: s.filter((x) => x.t < cut), validation: s.filter((x) => x.t >= cut) };
}
export const partOf = (edge, t) => (t < CUTS[edge] ? 'discovery' : 'validation');

// ---- one decision record (written by walk.mjs; NO outcome in it) ---------------------------------------------------
// { id, t, edge, action, side, sup: [[factor, weight]], con: [[factor, weight]], gates: [code], support, contradiction,
//   margin, needMargin, needSupport, confidence, similarN, regime, volRatio }
export const OUTCOME_KEYS = ['R', 'netR', 'exitT', 'exit', 'reason', 'mfeR', 'maeR', 'unitR', 'add', 'fillT', 'win', 'filled', 'outcome', 'result', 'pnl'];
export function digestOf(edge, cand, d, f) {
  const pair = (a) => a.map((i) => [i.factor, i.weight]);
  return { id: cand.id, t: cand.t, edge, action: d.action, side: d.side || null, sup: pair(d.supporting), con: pair(d.contradicting), gates: d.gates.map((g) => g.code),
    support: d.evidence.support, contradiction: d.evidence.contradiction, margin: d.evidence.margin, needMargin: d.evidence.needMargin, needSupport: d.evidence.needSupport,
    confidence: d.confidence, similarN: d.similar ? d.similar.n : 0, regime: f.regime === undefined ? null : f.regime, volRatio: fin(f.volRatio) ? rd(f.volRatio, 4) : null };
}
// every vote of a record as keys: 'sup:<factor>', 'con:<factor>', 'gate:<code>' (judgement gates only)
export function votesOf(r) {
  return [...new Set([...r.sup.map((x) => 'sup:' + x[0]), ...r.con.map((x) => 'con:' + x[0]), ...r.gates.filter((g) => JUDGEMENT_GATES.includes(g)).map((g) => 'gate:' + g)])];
}
const total = (pairs, skip) => r2(pairs.reduce((s, x) => (skip && skip(x[0]) ? s : s + x[1]), 0));
// the evidence rule of policy-1.0 on (possibly reduced) votes and gates
function evidenceRule(r, { dropSup = [], dropCon = [], gates = r.gates }) {
  const S = total(r.sup, (f) => dropSup.includes(f)), C = total(r.con, (f) => dropCon.includes(f)), margin = r2(S - C);
  return { S, C, margin, take: margin >= r.needMargin && S >= r.needSupport && gates.length === 0 };
}
// TAKE or WAIT of one policy on one record. `ctx.drops` (C4 only) = { <edge>: [vote keys] } fixed on discovery.
export function actionOf(policy, r, ctx = {}) {
  const T = (yes) => (yes ? 'TAKE' : 'WAIT');
  if (policy === 'C0') return T(evidenceRule(r, {}).take);
  if (policy === 'C1') return T(!r.gates.some((g) => HARD_GATES.includes(g)));
  if (policy === 'C2') return T(r.gates.length === 0);
  if (policy === 'C3') {
    const c = C3_TABLE[r.edge]; if (!c) return actionOf('C0', r);
    const dropCon = c.dropCon.concat(c.highVolOk && r.regime === 'high-vol' ? ['regime'] : []);
    const gates = r.gates.filter((g) => g !== 'volatility' || (fin(r.volRatio) && r.volRatio >= c.volGate));
    return T(evidenceRule(r, { dropCon, gates }).take);
  }
  if (policy === 'C4') {
    const d = (ctx.drops && ctx.drops[r.edge]) || []; if (!d.length) return actionOf('C0', r);
    const of = (p) => d.filter((k) => k.startsWith(p + ':')).map((k) => k.slice(p.length + 1));
    return T(evidenceRule(r, { dropSup: of('sup'), dropCon: of('con'), gates: r.gates.filter((g) => !(JUDGEMENT_GATES.includes(g) && of('gate').includes(g))) }).take);   // a non-overridable gate is never dropped
  }
  if (policy === 'C5') return T(actionOf('C0', r) === 'TAKE' && (r.confidence === 'medium' || r.confidence === 'high'));
  throw new Error('unknown policy ' + policy);
}

// ---- the factor audit ------------------------------------------------------------------------------------------
// rows: trades of one edge and one part [{ rec, netR }]. One line per vote: n with / without, net R of each, difference,
// Welch t, wrong-signed or not. A vote under MIN_SIDE trades on either side gets counts only.
export function auditVotes(rows) {
  const keys = [...new Set(rows.flatMap((x) => votesOf(x.rec)))].sort(), out = [];
  for (const key of keys) {
    const inn = rows.filter((x) => votesOf(x.rec).includes(key)).map((x) => x.netR), outn = rows.filter((x) => !votesOf(x.rec).includes(key)).map((x) => x.netR);
    const enough = inn.length >= MIN_SIDE && outn.length >= MIN_SIDE, w = enough ? welch(inn, outn) : null, kind = key.startsWith('sup:') ? 'support' : key.startsWith('con:') ? 'contradiction' : 'gate';
    const wrong = w && fin(w.tRaw) ? (kind === 'support' ? w.tRaw < 0 : w.tRaw > 0) : null;
    out.push({ vote: key, kind, nWith: inn.length, nWithout: outn.length, share: rd(inn.length / rows.length), rWith: enough ? rd(mean(inn)) : null, rWithout: enough ? rd(mean(outn)) : null,
      diff: w ? w.diff : null, t: w ? w.t : null, wrongSigned: wrong, drop: !!(wrong && Math.abs(w.tRaw) >= AUDIT_T) });
  }
  return out;
}

// ---- the acceptance rule (section 7) -----------------------------------------------------------------------------
// One candidate on one scope. take / wait / mech: trades of the validation part [{ id, exitT, netR, adj }]; `pooled`
// uses adj (net R with the edge's discovery mean taken out) for the test and the mean condition, raw net R for drawdown.
export function testOf({ take, wait, pooled = false }) {
  const v = (a) => a.map((x) => (pooled ? x.adj : x.netR)), mech = take.concat(wait), testable = take.length >= MIN_SIDE && wait.length >= MIN_SIDE;
  const w = welch(v(take), v(wait)), ms = setStat(mech), ts = setStat(take), ws = setStat(wait), raw = welch(take.map((x) => x.netR), wait.map((x) => x.netR));
  const takeAvg = take.length ? mean(v(take)) : null, mechAvg = mech.length ? mean(v(mech)) : null;
  return { testable, on: pooled ? 'net R with each edge\'s discovery mean taken out' : 'net R', mechanical: ms, take: ts, wait: ws,
    takeShare: mech.length ? rd(take.length / mech.length) : null, diff: w.diff, t: w.t, df: w.df, pOne: w.pOne, pTwo: w.pTwo,
    diffNetR: raw.diff, tNetR: raw.t,   // the same difference on plain net R (equal to diff / t except on the pooled scope); shown, never tested
    takeAvgTested: rd(takeAvg), mechAvgTested: rd(mechAvg), aboveMechanical: fin(takeAvg) && fin(mechAvg) ? takeAvg > mechAvg : null,
    drawdownNotWorse: ts.maxDD !== null && ms.maxDD !== null ? ts.maxDD <= ms.maxDD : null };
}
// verdict of one tested scope once its Holm-adjusted p is known
export function verdictOf(x, pAdj) {
  if (!x.testable) return 'inconclusive: too few trades';
  if (!(x.diff > 0) || !x.aboveMechanical || !x.drawdownNotWorse) return 'rejected';
  return x.t >= T_LINE && pAdj <= ALPHA_ONE ? 'accepted' : 'inconclusive';
}
// a candidate's own verdict from its scopes [{ changedSetups, verdict }] (changedSetups = decisions that differ from C0 there).
// Section 7.6: accepted if any scope is; rejected if every tested scope is rejected, or nothing could be tested AND it
// changes no decision; otherwise inconclusive (so a candidate that changes decisions but cannot be tested is inconclusive).
export function candidateVerdict(scopes) {
  const tested = scopes.filter((s) => s.verdict === 'accepted' || s.verdict === 'rejected' || s.verdict === 'inconclusive');
  if (tested.some((s) => s.verdict === 'accepted')) return 'accepted';
  if (!tested.length) return scopes.some((s) => s.changedSetups > 0) ? 'inconclusive' : 'rejected';
  return tested.every((s) => s.verdict === 'rejected') ? 'rejected' : 'inconclusive';
}
// minimum detectable take-minus-wait difference at a t line: tLine x SD x sqrt(1 / nTake + 1 / nWait)
export const mde = (sd, nTake, nWait, tLine = T_LINE) => (fin(sd) && nTake > 0 && nWait > 0 ? rd(tLine * sd * Math.sqrt(1 / nTake + 1 / nWait), 2) : null);
// the t a one-sided p needs at large samples (normal): used for the "after Holm" power line. Bisection on erfc.
export function zOfP(p) {
  const tail = (z) => 0.5 * erfc(z / Math.SQRT2); let lo = 0, hi = 10;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (tail(mid) > p) lo = mid; else hi = mid; }
  return rd((lo + hi) / 2, 2);
}
function erfc(x) {   // Abramowitz-Stegun 7.1.26, good to 1.5e-7: enough for a power note
  const z = Math.abs(x), t = 1 / (1 + 0.3275911 * z), y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
  return x >= 0 ? y : 2 - y;
}
