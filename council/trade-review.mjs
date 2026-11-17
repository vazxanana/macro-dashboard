// Council · Trade review (17 Nov 2026, owner: "Check as well the edges and add an AI to check the actual trades and help the
// edge bots to trade better"). An AFTER-THE-FACT check of the trades the council really took, system by system:
//   part 1, the edge check: per stream (system x book: live, shadow, research paper) over the last 7 / 30 days and the whole
//           forward record on file: n, win rate, R before and after costs, t; where the R goes (exits by type, stops hit soon
//           after the fill, MFE given back, trades that reached +1R and closed at a loss, losses whose target was reached after
//           the stop); the cost share; slippage of the demo copies; session / hour / side / market splits; the reasons the
//           owner and the Analyst wrote on the losses. Patterns become FLAGS, and every flag carries n and t (absolute rule 4);
//           a split comparison also carries its p and whether it survives Holm over every split test in the file.
//   part 2, the rule-based review: a plain-language reading per stream and PROPOSALS ("skip session Y", "change exit Z"), each
//           with its evidence (n, t, in-sample warning) and the pre-registered study that would confirm it (2020 → now, net of
//           costs, in sample vs out of sample). The optional language-model review (api/trade-review.js, api/_trade-review.js)
//           reads this file; without a key this rule-based review is the whole answer.
// PROPOSALS ONLY (absolute rule 3): nothing here changes config.json, a rule, a size, a stop or a filter, and no council member
// reads the file to decide anything. ICT is a separate edge (Fred's): its files are not read and an ICT record is never counted.
// Paper and demo only. The patterns are found by looking at these same trades: in sample by construction, never an edge.
//
// Reads council-data: trades.json, research.json, coach.json (decay / expect / forward), config.json (owner shadows),
// ctrader/mirror*.json (through mirror-accounts.json), reviews/analyst.json, reviews/losses.json.
// Writes council-data research/trade-review.json (only when its content changed). Run: node council/trade-review.mjs <dir> [--dry]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe } from './decay.mjs';
import { merNet } from './digest.mjs';
import { ownStream } from './fills.mjs';
import { writeAtomic } from './jsonio.mjs';

export const TR = {
  V: 1,
  WINDOWS: [['d7', 7], ['d30', 30], ['all', null]],
  FLAG_N: 10,        // a split bucket (and the rest it is compared with) needs this many closed trades before it is judged
  FLAG_T: 2,         // |t| a pattern needs to be flagged
  STREAM_N: 10,      // a whole stream is called losing / positive only from this many closed trades
  STRONG_N: 30,      // a proposal goes to the week pane's "Decisions waiting" only with this many trades, |t| >= 2 and Holm passed
  FAST_S: 1800,      // a stop within 30 minutes of the fill is a "fast stop"
  COST_MIN: 0.1,     // costs are flagged as the reason a stream loses when they take this many R a trade
  KEEP_TRADES: 12,   // the latest closed trades kept per stream in the file (for the page and the language-model review)
};
const DONE = new Set(['win', 'loss', 'be']);
const SESSIONS = ['asia', 'london', 'overlap', 'newyork', 'late'];
export const SESSION_NAME = { asia: 'Asia (22:00-07:00 UTC)', london: 'London (07:00-12:00 UTC)', overlap: 'London / New York overlap (12:00-16:00 UTC)', newyork: 'New York (16:00-21:00 UTC)', late: 'late New York (21:00-22:00 UTC)' };
const MKT = { xau: 'gold', xag: 'silver', eurusd: 'EUR/USD', gbpusd: 'GBP/USD', audusd: 'AUD/USD', usdcad: 'USD/CAD', usdchf: 'USD/CHF', usdjpy: 'USD/JPY', btc: 'BTC', eth: 'ETH', sol: 'SOL', xrp: 'XRP', nq: 'NQ', nas100: 'NAS100' };
export const mName = (m) => MKT[m] || String(m || '?').toUpperCase();
// the engine setups share names on the records ("Retrace" is three of them): the review names each one apart
export const SETUP_NAME = { scalp: 'Scalp', intraday: 'Intraday', swing: 'Swing', position: 'Position', rscalp: 'Retrace scalp', rintra: 'Retrace intraday', rswing: 'Retrace swing', m30m1: 'M30 → M1 scalp' };
const nameOf = (x, s) => SETUP_NAME[s.k] || (s.variant ? `${x.name || s.k} · ${s.variant}` : x.name || s.k);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
export const fR = (v) => (Number.isFinite(v) ? `${v > 0.004 ? '+' : v < -0.004 ? '−' : ''}${Math.abs(v).toFixed(2)}R` : '—');
const fT = (t) => (Number.isFinite(t) ? `t ${t >= 0 ? '' : '−'}${Math.abs(t).toFixed(2)}` : 't —');
const arr = (v) => (Array.isArray(v) ? v : []);
// the council's session clock (trader.mjs / backtest.mjs / analyst.mjs sessionOf), applied to the fill time
export const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
export const hourBlock = (t) => { const h = Math.floor(new Date(t * 1000).getUTCHours() / 4) * 4; return `${String(h).padStart(2, '0')}-${String(h + 4).padStart(2, '0')}`; };

// ─── statistics ───
// regularised incomplete beta (Numerical Recipes continued fraction): the Student t tail for small samples
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function lgamma(x) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// two-sided p of a t with df degrees of freedom (df < 1 or not finite: 1)
export function pOfT(t, df) { if (!Number.isFinite(t)) return 1; const v = Number.isFinite(df) && df >= 1 ? df : 1; return Math.min(1, Math.max(0, ibeta(v / 2, 0.5, v / (v + t * t)))); }
export function welch(a, b) {
  const A = describe(a), B = describe(b);
  if (A.n < 2 || B.n < 2) return { diff: A.mean - B.mean, t: 0, df: 1 };
  const va = A.sd ** 2 / A.n, vb = B.sd ** 2 / B.n, se = Math.sqrt(va + vb);
  const df = se > 0 ? (va + vb) ** 2 / ((va ** 2) / (A.n - 1) + (vb ** 2) / (B.n - 1)) : 1;
  return { diff: A.mean - B.mean, t: se > 0 ? (A.mean - B.mean) / se : 0, df };
}
// Holm step-down over a list of p values: true where the test survives at alpha
export function holm(ps, alpha = 0.05) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), ok = new Array(ps.length).fill(false);
  for (let k = 0; k < idx.length; k++) { if (idx[k][0] <= alpha / (idx.length - k)) ok[idx[k][1]] = true; else break; }
  return ok;
}

// ─── one closed trade, as the review reads it ───
export function exitType(x) {
  if (x.exitKind === 'target') return 'target';
  if (x.exitKind === 'time' || /^\d+(\.\d+)? h$/.test(String(x.exit || ''))) return 'time';
  if (x.exit === 'trailing stop' || (x.exitKind === 'stop' && x.trailMoved)) return 'trail';
  if (x.status === 'be' || (x.exitKind === 'stop' && x.beMoved)) return 'breakeven';
  if (x.exitKind === 'stop') return 'stop';
  if (x.status === 'loss') return 'stop';
  if (x.status === 'win' && Number.isFinite(x.rr) && Math.abs((x.R || 0) - x.rr) <= 0.02) return 'target';
  return x.status === 'win' ? 'other win' : 'other';
}
export function norm(x) {
  const e = Number.isFinite(x.filled) ? x.filled : x.opened, t = Number.isFinite(x.closed) ? x.closed : x.checked;
  const net = merNet(x), costKnown = Number.isFinite(x.Rnet) || Number.isFinite(x.costR);
  const ses = (x.feat && SESSIONS.includes(x.feat.session)) ? x.feat.session : SESSIONS.includes(x.session) ? x.session : Number.isFinite(e) ? sessionOf(e) : null;
  return {
    id: x.id, market: x.market, side: x.side, e, t, R: x.R, net, cost: costKnown ? +(x.R - net).toFixed(4) : 0, costKnown,
    exit: exitType(x), mfe: Number.isFinite(x.mfe) ? x.mfe : null, mae: Number.isFinite(x.mae) ? x.mae : null,
    session: ses, hours: Number.isFinite(e) ? hourBlock(e) : null, held: Number.isFinite(e) && Number.isFinite(t) ? t - e : null,
    targetAfterStop: x.status === 'loss' && !!(x.pm && x.pm.after && x.pm.after.hitT1),
  };
}

// ─── the streams: one per system and book ───
// book: 'live' (not a shadow; the NQ open run's paper trades as council/alerts.mjs `alertable` counts them), 'shadow', or 'research'
// (research.json's forward paper streams that are not the NQ open run's live rule: the replica's research trades, the variants).
export function streamKey(x, src) {
  const k = String(x.k || '?');
  if (/^ict/i.test(k) || /^ict[:-]/i.test(String(x.id || ''))) return null;   // ICT: Fred's separate edge, never mixed in
  if (src === 'research') {
    const id = k === 'nq-open' && x.session ? `nq-open:${x.session}` : k;
    const live = k === 'nq-open' && !x.shadow && !/-x$/.test(x.session || '') && x.session === 'nyflip';
    return { id, k, book: live ? 'live' : x.shadow ? 'shadow' : 'research', variant: k === 'nq-open' ? x.session || null : null };
  }
  return { id: k, k, book: x.shadow ? 'shadow' : 'live', variant: null };
}
export function closed(x) { return !!x && DONE.has(x.status) && !x.void && !x.replay && Number.isFinite(x.R); }
export function streams(trades, research) {
  const M = new Map();
  for (const [src, list] of [['trades', arr(trades)], ['research', arr(research)]]) for (const x of list) {
    if (!closed(x)) continue;
    const s = streamKey(x, src); if (!s) continue;
    const key = `${s.id}|${s.book}`;
    if (!M.has(key)) M.set(key, { key, ...s, src, name: nameOf(x, s), rows: [], raw: [] });
    const S = M.get(key); S.rows.push(norm(x)); S.raw.push(x); S.name = nameOf(x, s);
  }
  for (const S of M.values()) { const o = S.rows.map((r, i) => [r, S.raw[i]]).sort((a, b) => (a[0].t || 0) - (b[0].t || 0)); S.rows = o.map((p) => p[0]); S.raw = o.map((p) => p[1]); }
  return [...M.values()];
}

// ─── part 1: the numbers ───
export function stats(rows) {
  const n = rows.length, g = describe(rows.map((r) => r.R)), nt = describe(rows.map((r) => r.net));
  const wins = rows.filter((r) => r.R > 0).length, losses = rows.filter((r) => r.R < 0).length, known = rows.filter((r) => r.costKnown);
  const costSum = known.reduce((s, r) => s + r.cost, 0), grossWins = rows.reduce((s, r) => s + Math.max(0, r.R), 0);
  return {
    n, wins, losses, flat: n - wins - losses, winRate: n ? r3(wins / n) : null,
    gross: { sum: r2(g.sum), mean: r3(g.mean), t: r2(g.t) }, net: { sum: r2(nt.sum), mean: r3(nt.mean), t: r2(nt.t) },
    cost: { known: known.length, sum: r2(costSum), perTrade: known.length ? r3(costSum / known.length) : null, shareOfGrossWins: grossWins > 0 && known.length ? r3(costSum / grossWins) : null },
  };
}
export function whereR(rows) {
  const ex = {};
  for (const r of rows) { const e = (ex[r.exit] = ex[r.exit] || { n: 0, net: 0 }); e.n++; e.net += r.net; }
  for (const e of Object.values(ex)) e.net = r2(e.net);
  const losses = rows.filter((r) => r.R < 0), fast = losses.filter((r) => r.held != null && r.held <= TR.FAST_S);
  const withMfe = rows.filter((r) => r.mfe != null), reached = withMfe.filter((r) => r.mfe >= 1), lost = reached.filter((r) => r.R < 0);
  // giveback = how much of the best open profit was not kept (R per unit); counterfactual "close at +1R when +1R is reached"
  // (approximate: the MFE is read on candle extremes and the +1R close is assumed exact, before costs): paired difference
  const give = describe(reached.map((r) => r.mfe - r.R));
  const lock = describe(withMfe.map((r) => (r.mfe >= 1 ? 1 : r.R) - r.R));
  const tas = losses.filter((r) => r.targetAfterStop);
  return {
    exits: ex,
    fastStops: { n: fast.length, ofLosses: losses.length, share: losses.length ? r3(fast.length / losses.length) : null, net: r2(fast.reduce((s, r) => s + r.net, 0)), within: '30 minutes of the fill' },
    reached1R: { withMfe: withMfe.length, n: reached.length, closedAtLoss: lost.length, lossNet: r2(lost.reduce((s, r) => s + r.net, 0)) },
    giveback: { n: give.n, mean: r3(give.mean), note: 'best open R minus the R closed, on trades that reached +1R (candle extremes)' },
    lock1R: { n: lock.n, mean: r3(lock.mean), t: r2(lock.t), note: 'if every trade had closed at +1R once it reached +1R: the paired change in R a trade, before costs; an approximation from the recorded MFE' },
    targetAfterStop: { n: tas.length, ofLosses: losses.length, note: 'losses whose target was reached after the stop (post-mortem)' },
  };
}
// split by one field: per value n / net mean / t, and the value against the rest (Welch)
export function split(rows, field) {
  const vals = [...new Set(rows.map((r) => r[field]).filter((v) => v != null))].sort();
  return vals.map((v) => {
    const a = rows.filter((r) => r[field] === v).map((r) => r.net), b = rows.filter((r) => r[field] !== v && r[field] != null).map((r) => r.net), A = describe(a), w = welch(a, b);
    const judged = a.length >= TR.FLAG_N && b.length >= TR.FLAG_N;
    return { v, n: A.n, mean: r3(A.mean), sum: r2(A.sum), t: r2(A.t), rest: { n: b.length, mean: r3(describe(b).mean) }, vsRest: judged ? { diff: r3(w.diff), t: r2(w.t), df: r2(w.df), p: r3(pOfT(w.t, w.df)) } : null };
  });
}
export function slippage(ids, mirrors) {
  const xs = [];
  for (const m of arr(mirrors)) { const map = (m && m.state && m.state.map) || {}; for (const id of ids) { const c = map[id]; if (c && Number.isFinite(c.slipR)) xs.push(c.slipR); } }
  const d = describe(xs);
  return { n: d.n, mean: r3(d.mean), t: r2(d.t), worse: xs.filter((s) => s > 0).length, note: 'fill minus the council entry in R, positive = worse' };
}
// the owner's tags first, else the Analyst's post-mortem tags, on this stream's losses
export function reviewTags(raw, analyst, losses) {
  const A = (analyst && analyst.reviews) || {}, O = (losses && losses.reviews) || {}, out = {};
  let n = 0;
  for (const x of raw) { if (!(x.R < 0)) continue; const rv = (O[x.id] && arr(O[x.id].tags).length ? O[x.id] : A[x.id]); if (!rv) continue; n++; for (const t of arr(rv.tags)) out[t] = (out[t] || 0) + 1; }
  return { reviewed: n, tags: out };
}

// ─── flags: patterns, each with n and t ───
const stat = (o) => ({ n: o.n, mean: o.mean, t: o.t, ...(o.p != null ? { p: o.p } : {}), ...(o.rest ? { rest: o.rest } : {}) });
export function flagsOf(S, all, sp, wr) {
  const F = [], who = S.id, book = S.book;
  const add = (kind, field, value, ev, text, extra = {}) => F.push({ id: `${who}|${book}|${kind}${value != null ? ':' + value : ''}`, stream: S.key, system: who, book, kind, field: field || null, value: value == null ? null : value, ...stat(ev), text, ...extra });
  const basis = all.cost.known ? 'after costs' : 'before costs (no cost on record)';
  if (all.n >= TR.STREAM_N && all.net.t <= -TR.FLAG_T) add('losing', null, null, { n: all.n, mean: all.net.mean, t: all.net.t }, `${all.n} closed trades at ${fR(all.net.mean)} a trade ${basis} (${fT(all.net.t)}): it loses.`);
  if (all.n >= TR.STREAM_N && all.net.t >= TR.FLAG_T) add('positive', null, null, { n: all.n, mean: all.net.mean, t: all.net.t }, `${all.n} closed trades at ${fR(all.net.mean)} a trade ${basis} (${fT(all.net.t)}): positive so far, a forward record, not a proven edge.`);
  if (all.n >= 20 && all.gross.mean > 0 && all.net.mean < 0 && all.cost.perTrade >= TR.COST_MIN)
    add('costs', null, null, { n: all.n, mean: all.net.mean, t: all.net.t }, `Before costs ${fR(all.gross.mean)} a trade (${fT(all.gross.t)}), after costs ${fR(all.net.mean)} (${fT(all.net.t)}): costs of ${fR(all.cost.perTrade)} a trade turn it negative.`, { gross: { mean: all.gross.mean, t: all.gross.t }, costPerTrade: all.cost.perTrade });
  for (const [field, label] of [['session', (v) => `the ${SESSION_NAME[v] || v} session`], ['hours', (v) => `${v} UTC`], ['side', (v) => `${v}s`], ['market', (v) => mName(v)]]) {
    for (const b of sp[field] || []) {
      if (!b.vsRest || Math.abs(b.vsRest.t) < TR.FLAG_T) continue;
      const bad = b.vsRest.t < 0;
      add(bad ? `weak-${field}` : `strong-${field}`, field, b.v, { n: b.n, mean: b.mean, t: b.vsRest.t, p: b.vsRest.p, rest: b.rest },
        `${label(b.v)}: ${b.n} trades at ${fR(b.mean)} a trade against ${fR(b.rest.mean)} for the other ${b.rest.n} (difference ${fR(b.vsRest.diff)}, ${fT(b.vsRest.t)}).`, { split: true, own: { t: b.t } });
    }
  }
  if (wr.lock1R.n >= TR.STREAM_N && Math.abs(wr.lock1R.t) >= TR.FLAG_T && wr.lock1R.mean > 0)
    add('exit-lock1R', 'exit', null, { n: wr.lock1R.n, mean: wr.lock1R.mean, t: wr.lock1R.t }, `Closing at +1R once a trade reached +1R would have added ${fR(wr.lock1R.mean)} a trade over ${wr.lock1R.n} trades (${fT(wr.lock1R.t)}; approximate, from the recorded MFE): the exit gives back profit.`, { split: true, p: r3(pOfT(wr.lock1R.t, wr.lock1R.n - 1)) });
  if (wr.lock1R.n >= TR.STREAM_N && wr.lock1R.t <= -TR.FLAG_T)
    add('exit-runs', 'exit', null, { n: wr.lock1R.n, mean: wr.lock1R.mean, t: wr.lock1R.t }, `Letting trades run past +1R paid: a +1R close would have cost ${fR(-wr.lock1R.mean)} a trade over ${wr.lock1R.n} trades (${fT(wr.lock1R.t)}).`, { split: true, p: r3(pOfT(wr.lock1R.t, wr.lock1R.n - 1)) });
  return F;
}

// ─── part 2: the rule-based review and its proposals ───
export const TEST_BASE = {
  data: '2020-01-01 → now',
  split: 'in sample 2020-2023, out of sample 2024 → now',
  costs: 'net of the council cost model (council/fills.mjs: spread, slippage, commission, overnight financing on gold buys)',
  bar: 'out of sample: n ≥ 100, mean R a trade > 0 after costs in both halves, t ≥ 2 on calendar-month sums after Holm over every test named in the pre-registration',
  how: 'PREREGISTRATION.md pushed first in research/edge/<topic>/, then run.mjs, RESULT.md, result.json; the owner approves any live change',
};
const IN_SAMPLE = 'In sample: found by looking at these same trades, so it proves nothing until a pre-registered test on other data confirms it.';
export function proposalOf(f, S) {
  const sys = `${S.name}${S.book === 'live' ? '' : ` (${S.book})`}`;
  const P = (action, change, question) => ({ id: `p:${f.id}`, flag: f.id, system: S.id, book: S.book, name: S.name, action, change, why: f.text,
    evidence: { n: f.n, mean: f.mean, t: f.t, ...(f.p != null ? { p: f.p } : {}), ...(f.rest ? { rest: f.rest } : {}), holm: f.holm != null ? f.holm : null, inSample: true, warning: IN_SAMPLE },
    test: { question, ...TEST_BASE }, strong: false });
  switch (f.kind) {
    case 'weak-session': return P('skip session', `Skip the ${SESSION_NAME[f.value] || f.value} session for ${sys}`, `Does ${S.name} make more after costs without trades filled in the ${f.value} session (UTC clock of council/trader.mjs) than with them?`);
    case 'weak-hours': return P('skip hours', `Skip entries between ${f.value} UTC for ${sys}`, `Do ${S.name}'s entries between ${f.value} UTC lose after costs against its other hours?`);
    case 'weak-side': return P('one side only', `Take only ${f.value === 'buy' ? 'sells' : 'buys'} in ${sys}`, `Do ${S.name}'s ${f.value}s lose after costs against its ${f.value === 'buy' ? 'sells' : 'buys'}?`);
    case 'weak-market': return P('skip market', `Skip ${mName(f.value)} in ${sys}`, `Does ${S.name} lose on ${mName(f.value)} after costs while it does not on its other markets?`);
    case 'exit-lock1R': return P('change exit', `Change the exit of ${sys}: take profit (or move the stop to break-even) at +1R`, `Does ${S.name} make more after costs with a +1R take-profit / break-even step than with its current exit, on the same entries?`);
    case 'costs': return P('cut costs', `Cut the cost per trade of ${sys} (limit entries instead of market, fewer and larger trades, a wider minimum stop)`, `Does ${S.name} stay positive after costs with a minimum stop of N x its cost (N fixed in the pre-registration)?`);
    case 'losing': return S.book === 'live'
      ? P('move to shadow', `Move ${S.name} to a paper shadow until a pre-registered test says otherwise`, `Is ${S.name}'s rule positive after costs out of sample, or does its forward loss match its history?`)
      : P('keep off live', `Keep ${sys} off the live book; consider no longer recording it`, `Is ${S.name}'s rule positive after costs out of sample at all?`);
    default: return null;   // strong-* splits and 'positive' are reported, not turned into changes
  }
}
function readStream(S, W, wr, sp, slip, tags, flags) {
  const a = W.all, good = [], bad = [];
  const basis = a.cost.known ? 'after costs' : 'before costs (none on record)';
  if (a.net.mean > 0) good.push(`${basis} ${fR(a.net.sum)} on ${a.n} trades (${fR(a.net.mean)} a trade, ${fT(a.net.t)})`);
  else bad.push(`${basis} ${fR(a.net.sum)} on ${a.n} trades (${fR(a.net.mean)} a trade, ${fT(a.net.t)})`);
  const ex = Object.entries(wr.exits).sort((x, y) => x[1].net - y[1].net);
  for (const [k, e] of ex) if (e.net > 0.5) good.push(`${k} exits ${fR(e.net)} on ${e.n}`);
  for (const [k, e] of ex) if (e.net < -0.5) bad.push(`${k} exits ${fR(e.net)} on ${e.n}`);
  if (a.cost.known && a.cost.sum > 0.5) bad.push(`costs ${fR(-a.cost.sum)} (${fR(a.cost.perTrade)} a trade${a.cost.shareOfGrossWins != null ? `, ${Math.round(a.cost.shareOfGrossWins * 100)}% of the gross wins` : ''})`);
  if (wr.fastStops.n >= 3) bad.push(`${wr.fastStops.n} of ${wr.fastStops.ofLosses} losses stopped within 30 minutes of the fill (${fR(wr.fastStops.net)})`);
  if (wr.reached1R.closedAtLoss >= 2) bad.push(`${wr.reached1R.closedAtLoss} of ${wr.reached1R.n} trades that reached +1R closed at a loss (${fR(wr.reached1R.lossNet)})`);
  if (wr.targetAfterStop.n >= 3) bad.push(`${wr.targetAfterStop.n} losses saw the target reached after the stop`);
  if (slip.n >= 5) (slip.mean > 0.02 ? bad : good).push(`demo copies filled ${fR(Math.abs(slip.mean)).replace(/^[+−]/, '')} a trade ${slip.mean > 0 ? 'worse' : 'better'} than paper (n ${slip.n}, ${fT(slip.t)})`);
  const tg = Object.entries(tags.tags).sort((x, y) => y[1] - x[1]).slice(0, 3);
  if (tg.length) bad.push(`loss reasons written: ${tg.map(([k, v]) => `${k} ${v}`).join(', ')} (of ${tags.reviewed} reviewed)`);
  for (const f of flags) if (f.kind.startsWith('strong-')) good.push(f.text.replace(/\.$/, ''));
  const after = a.cost.known ? `${fR(a.net.sum)} after (${fT(a.net.t)})` : `no cost on record (${fT(a.net.t)} before costs)`;
  const head = `${S.name} (${S.book}${S.retired ? ', no longer trades live' : S.stopped ? ', no longer recorded since the shadow cut of 12 Nov' : ''}): ${a.n} closed, ${a.winRate != null ? Math.round(a.winRate * 100) : '—'}% won, ${fR(a.gross.sum)} before costs, ${after}; last 30 days ${fR(W.d30.net.sum)} on ${W.d30.n}, last 7 days ${fR(W.d7.net.sum)} on ${W.d7.n}.`;
  return { head, working: good, losing: bad };
}

// ─── the whole review ───
export function build(D, { now = Math.floor(Date.now() / 1000) } = {}) {
  const coach = D.coach || {}, decay = arr(coach.decay && coach.decay.systems), expect = arr(coach.expect && coach.expect.systems);
  const ownerSh = (D.config && D.config.ownerShadow) || {}, focus = D.config && Array.isArray(D.config.focusSetups) ? D.config.focusSetups : null, cut = D.config && D.config.shadowCut;
  const out = [];
  for (const S of streams(D.trades, D.research)) {
    // an engine setup's live record after it left the live setups (config.focusSetups; the legacy engine was retired 4 Nov 2026):
    // its record is reported, but nothing is proposed for a rule that no longer trades live
    S.retired = S.book === 'live' && !!SETUP_NAME[S.k] && !!focus && !focus.includes(S.k);
    // a shadow stream the owner's shadow cut (12 Nov 2026, config.shadowCut) no longer records: reported, nothing proposed
    S.stopped = S.book === 'shadow' && !!cut && arr(cut.setups).includes(S.k) && !arr(cut.keep).includes(S.k);
    const W = {};
    for (const [k, days] of TR.WINDOWS) W[k] = stats(days ? S.rows.filter((r) => r.t >= now - days * 86400) : S.rows);
    const wr = whereR(S.rows), sp = { session: split(S.rows, 'session'), hours: split(S.rows, 'hours'), side: split(S.rows, 'side'), market: split(S.rows, 'market'), exit: Object.entries(wr.exits).map(([v, e]) => ({ v, n: e.n, sum: e.net })) };
    if (new Set(S.rows.map((r) => r.market)).size < 2) sp.market = [];
    const slip = slippage(S.raw.map((x) => x.id), D.mirrors), tags = reviewTags(S.raw, D.analyst, D.losses);
    const flags = flagsOf(S, W.all, sp, wr);
    const dc = decay.find((s) => s && (s.k === S.k || s.id === S.k) && (!s.session || s.session === S.variant)), xp = expect.find((s) => s && s.id === (dc && dc.id));
    out.push({ S, W, wr, sp, slip, tags, flags,
      decay: dc ? { status: dc.status, few: !!dc.few, why: arr(dc.why)[0] || null, ref: dc.ref } : null,
      expect: xp && xp.perTrade ? { perTrade: xp.perTrade, src: xp.honest && xp.honest.src } : null,
      ownerShadow: !!ownerSh[S.k] || !!ownerSh[S.id], recent: S.raw.slice(-TR.KEEP_TRADES).map((x, i) => { const r = S.rows[S.rows.length - Math.min(TR.KEEP_TRADES, S.rows.length) + i]; return { id: x.id, market: x.market, side: x.side, e: r.e, t: r.t, R: r2(r.R), net: r2(r.net), exit: r.exit, mfe: r.mfe, session: r.session }; }) });
  }
  // Holm over every split comparison of the file (sessions, hours, sides, markets, the exit counterfactual)
  const F = out.flatMap((o) => o.flags), splitF = F.filter((f) => f.split && f.p != null), ok = holm(splitF.map((f) => f.p));
  splitF.forEach((f, i) => { f.holm = ok[i]; });
  const tests = out.reduce((s, o) => s + ['session', 'hours', 'side', 'market'].reduce((q, k) => q + o.sp[k].filter((b) => b.vsRest).length, 0) + (o.wr.lock1R.n >= TR.STREAM_N ? 1 : 0), 0);
  const proposals = [], seen = new Set();
  for (const o of out) for (const f of o.flags) {
    const p = o.S.retired || o.S.stopped ? null : proposalOf(f, o.S); if (!p) continue;
    const same = `${o.S.key}|${f.n}|${f.mean}|${f.t}`;   // one subset of trades, two names (Asia session = 00-04 UTC): proposed once
    if (seen.has(same)) continue; seen.add(same);
    p.evidence.holm = f.holm != null ? f.holm : null;
    p.strong = f.n >= TR.STRONG_N && Math.abs(f.t) >= TR.FLAG_T && (f.split ? f.holm === true : true);
    proposals.push(p);
  }
  proposals.sort((a, b) => (b.strong - a.strong) || (a.book === 'live' ? -1 : 0) - (b.book === 'live' ? -1 : 0) || Math.abs(b.evidence.t) - Math.abs(a.evidence.t));
  const systems = out.map((o) => ({
    key: o.S.key, id: o.S.id, k: o.S.k, name: o.S.name, book: o.S.book, src: o.S.src, variant: o.S.variant, ownerShadow: o.ownerShadow, retired: !!o.S.retired, stopped: !!o.S.stopped,
    windows: o.W, whereR: o.wr, splits: o.sp, slippage: o.slip, reviews: o.tags, decay: o.decay, expect: o.expect,
    flags: o.flags.map((f) => f.id), review: readStream(o.S, o.W, o.wr, o.sp, o.slip, o.tags, o.flags), recent: o.recent,
  })).sort((a, b) => (a.book === 'live' ? 0 : a.book === 'shadow' ? 1 : 2) - (b.book === 'live' ? 0 : b.book === 'shadow' ? 1 : 2) || b.windows.all.n - a.windows.all.n);
  const live = systems.filter((s) => s.book === 'live'), tot = (L, w) => ({ n: L.reduce((s, x) => s + x.windows[w].n, 0), net: r2(L.reduce((s, x) => s + x.windows[w].net.sum, 0)), gross: r2(L.reduce((s, x) => s + x.windows[w].gross.sum, 0)) });
  return {
    v: TR.V, at: new Date(now * 1000).toISOString(),
    rule: 'proposals only: nothing here changes a rule, a size, a stop, a filter or config.json; the owner decides (absolute rule 3). ICT is a separate edge and is not read.',
    inSample: IN_SAMPLE, windows: Object.fromEntries(TR.WINDOWS.map(([k, d]) => [k, d ? `last ${d} days` : 'the whole forward record on file'])),
    thresholds: { flagN: TR.FLAG_N, flagT: TR.FLAG_T, streamN: TR.STREAM_N, strongN: TR.STRONG_N, fastStopS: TR.FAST_S, splitTests: tests, holmAlpha: 0.05 },
    totals: { live: { d7: tot(live, 'd7'), d30: tot(live, 'd30'), all: tot(live, 'all') }, shadow: { d30: tot(systems.filter((s) => s.book === 'shadow'), 'd30'), all: tot(systems.filter((s) => s.book === 'shadow'), 'all') } },
    systems, flags: F, proposals, test: TEST_BASE,
  };
}

// ─── file side ───
const readJSON = (dir, f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
export function readData(dir) {
  const acc = readJSON(dir, 'ctrader/mirror-accounts.json'), files = new Set(['mirror.json']);
  for (const g of arr(acc && acc.groups)) if (g && g.file && !arr(g.books).some((b) => /ict/i.test(b))) files.add(g.file); else if (g && g.file) files.delete(g.file);
  return {
    trades: readJSON(dir, 'trades.json') || [], research: readJSON(dir, 'research.json') || [], coach: readJSON(dir, 'coach.json'), config: readJSON(dir, 'config.json'),
    mirrors: [...files].map((f) => readJSON(dir, `ctrader/${f}`)).filter(Boolean), analyst: readJSON(dir, 'reviews/analyst.json'), losses: readJSON(dir, 'reviews/losses.json'),
  };
}
export const OUT = 'research/trade-review.json';
export const REFRESH_S = 6 * 3600;   // an unchanged reading is still re-stamped every 6 hours, so a stale file means a stopped member
export const hashOf = (J) => crypto.createHash('sha256').update(JSON.stringify({ ...J, at: 0, hash: 0 })).digest('hex').slice(0, 16);
export function main(dir, { now = Math.floor(Date.now() / 1000), dry = false } = {}) {
  const D = readData(dir), J = build(D, { now }), file = path.join(dir, OUT);
  J.hash = hashOf(J);   // the content without its time: the language-model review asks again only when this changes
  const prev = readJSON(dir, OUT), prevAt = prev && Date.parse(prev.at) / 1000;
  const same = prev && prev.hash === J.hash && Number.isFinite(prevAt) && now - prevAt < REFRESH_S;
  if (!dry && !same) writeAtomic(file, JSON.stringify(J, null, 1) + '\n');
  return { written: !dry && !same, systems: J.systems.length, flags: J.flags.length, proposals: J.proposals.length, strong: J.proposals.filter((p) => p.strong).length, J };
}
// a few lines for the log (and for the owner's report)
export function summaryLines(J) {
  const L = [`Trade review ${J.at}: ${J.systems.length} streams, ${J.flags.length} flags, ${J.proposals.length} proposals (${J.proposals.filter((p) => p.strong).length} strong).`];
  for (const s of J.systems.filter((x) => x.windows.all.n >= 5)) L.push(`- ${s.review.head}`);
  return L;
}

if (process.argv[1] && process.argv[1].endsWith('trade-review.mjs')) {
  const args = process.argv.slice(2), dir = args.find((a) => !a.startsWith('--')) || 'data';
  try { const r = main(dir, { dry: args.includes('--dry') }); console.log(summaryLines(r.J).join('\n')); console.log(r.written ? `wrote ${OUT}` : 'nothing written'); }
  catch (e) { console.error('trade review failed:', e && e.stack || e); process.exitCode = 0; }
}
