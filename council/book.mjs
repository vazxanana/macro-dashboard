// Council · Book weights, paper comparison (8 Nov 2026). PAPER ONLY, NO LIVE CHANGE: nothing here changes a rule, a size, a
// filter, a trade or a mirror setting. The owner has not decided on the portfolio-v2 proposal (research/edge/portfolio-v2):
//   - equal risk per DISTINCT idea (the ICT desk counted once, Gold trend N20 + N5 as one bet),
//   - one cap of about 40% of the book's risk on the gold family,
//   - the book sized on the clean-half numbers (2009-17 Sharpe about 0.3), not on the 2018-26 ones.
// So that the owner can watch it instead of deciding blind, this module computes, from the forward paper records on
// council-data, the daily R of
//   (a) the live book as traded: every closed live position at its recorded R after costs (1R risked per position), and
//   (b) the proposed book: the SAME trades, each multiplied by its idea's proposed risk multiplier. The multipliers come from
//       the weights above, renormalised to the live book's total risk budget (one unit per live stream), so the two books risk
//       the same total and differ only in how it is spread. No trade is added or removed, no R is recomputed.
// with running totals, drawdown, the realised Sharpe of each and the correlation between the two.
//
// Records: trades.json live trades (never shadows) + the NQ open-run paper (research.json; alerts.mjs `alertable`, the same
// definition as the daily digest), after costs (`Rnet`, digest.mjs merNet); the ICT desk's A-setups from ict/trades.json
// (forward) with ict/replay.json filling the days the forward tracker has no record of (replay copies of forward signals are
// dropped by id), after the CME micro round trip (digest.mjs ictNet). Window: closes from BK.from, the day the legacy scalp
// engine was retired, so the live book is the set of systems in IDEAS. Trades of a setup not in IDEAS (an old engine position
// closing out) stay in both books at their live size (`other`), so nothing is dropped.
// Written by the Trader to coach.json `book` every 6 hours; the Council research pane shows it; the Sunday digest adds one line.
import { merNet, ictNet } from './digest.mjs';
import { alertable } from './alerts.mjs';

export const BK = {
  from: '2026-11-04',     // first UTC close day in the window: the legacy scalp engine was retired on 4 Nov 2026 (config.history)
  goldCap: 0.4,           // at most this share of the book's risk on the gold family (portfolio-v2 proposal, point 3)
  sharpeClean: 0.3,       // the clean-half (2009-17) Sharpe the proposal says to size on (point 4)
  ddRange: [9, 21],       // clean-half drawdown range of the books per 1R of book budget (RESULT.md, point 4)
  minDaysSharpe: 20,      // no realised Sharpe under this many trading days
  maxDays: 400,           // the daily series kept in coach.json
};
// The distinct ideas of the live book (one row per idea; ks = the setups that form it, one live stream each). gold: the gold
// family under the cap. Gold trend N20 + N5 are one idea (monthly correlation 0.95, RESULT.md). The gold replica trades gold
// too but the study measured its gold correlation at 0.07 and keeps it outside the family. Crypto trend is shadow (7 Nov):
// not a live idea. Keep in step with council/decay.mjs SYSTEMS and the page's SYS_K.
// 11 Nov 2026 (owner, supported-book): only Gold trend, Gold daily engulf and the ICT A-setups take live trades from that day; the
// other ideas keep their rows from the trades they took live before it and stop growing (their new trades are shadows, which this
// comparison never reads). The list stays the proposal's own set of ideas: it is a paper comparison the owner has not decided on.
export const IDEAS = [
  { id: 'replica', name: 'Gold replica', desk: 'Meridian', ks: ['replica'] },
  { id: 'mosha-bo', name: 'Mosha BO', desk: 'Meridian', ks: ['mosha-bo'], gold: true },
  { id: 'gtrend', name: 'Gold trend (N20 + N5)', desk: 'Meridian', ks: ['gtrend', 'gtrend5'], gold: true },
  { id: 'gtl', name: 'Gold H4 trendline', desk: 'Meridian', ks: ['gtl'], gold: true },
  { id: 'geg', name: 'Gold daily engulf', desk: 'Meridian', ks: ['geg'], gold: true },
  { id: 'gmp', name: 'Gold momentum pullback', desk: 'Meridian', ks: ['gmp'], gold: true },
  { id: 'nq-open', name: 'NQ New York open run', desk: 'Meridian', ks: ['nq-open'], src: 'research' },
  { id: 'ict-a', name: 'ICT A-setups', desk: 'ICT', ks: ['ict-a'] },
];
export const LABEL = 'paper comparison, no live change';

const DONE = new Set(['win', 'loss', 'be']);
const r2 = (v) => Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
const r3 = (v) => Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closedOk = (x) => x && DONE.has(x.status) && Number.isFinite(+x.R) && Number.isFinite(+(x.closed || x.exitAt));

// ─── weights ───
// Equal risk per idea, then the gold family capped at `cap` of the book and the rest renormalised over the other ideas.
// { w: { id: share }, capped, goldShare (after the cap), goldIdeas, n }. All-gold books cannot be capped (noted, equal weights).
export function weights(ideas = IDEAS, cap = BK.goldCap) {
  const n = ideas.length, gold = ideas.filter((i) => i.gold), rest = ideas.filter((i) => !i.gold);
  if (!n) return { w: {}, capped: false, goldShare: 0, goldIdeas: [], n: 0 };
  const w = Object.fromEntries(ideas.map((i) => [i.id, 1 / n]));
  let capped = false, note = '';
  if (gold.length && rest.length && gold.length / n > cap + 1e-9) {
    capped = true;
    for (const i of gold) w[i.id] = cap / gold.length;
    for (const i of rest) w[i.id] = (1 - cap) / rest.length;
  } else if (gold.length === n) note = 'every idea is in the gold family: the cap cannot apply';
  const s = Object.values(w).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(w)) w[k] = w[k] / s;
  return { w, capped, goldShare: gold.reduce((a, i) => a + w[i.id], 0), goldIdeas: gold.map((i) => i.id), n, ...(note ? { note } : {}) };
}
// Risk multipliers per idea: the proposed share × the live book's budget (one unit of risk per live stream = Σ ks), so the
// proposed book risks the same total as the live one. { m: { id }, M (live budget in R), N (ideas), ...weights }
export function multipliers(ideas = IDEAS, cap = BK.goldCap) {
  const W = weights(ideas, cap), M = ideas.reduce((a, i) => a + (i.ks || []).length, 0);
  return { ...W, M, N: ideas.length, m: Object.fromEntries(ideas.map((i) => [i.id, W.w[i.id] * M])) };
}

// ─── the trades ───
// Every closed trade of the window, once: { id, idea, k, desk, t (close, unix s), R (after costs), raw (recorded R), src }.
// D: { trades, research, ictTrades, ictReplay }. The input arrays and records are never changed.
export function collect(D, { from = BK.from, ideas = IDEAS } = {}) {
  const t0 = Date.parse(from + 'T00:00:00Z') / 1000, byK = new Map();
  for (const i of ideas) for (const k of i.ks || []) byK.set(k, i.id);
  const out = [];
  const mer = alertable(Array.isArray(D.trades) ? D.trades : [], Array.isArray(D.research) ? D.research : []);
  for (const x of mer) {
    if (!closedOk(x)) continue; const t = +(x.closed || x.exitAt); if (t < t0) continue;
    out.push({ id: String(x.id), idea: byK.get(x.k) || 'other', k: x.k, desk: 'Meridian', t, R: +merNet(x), raw: +x.R, src: 'live' });
  }
  const fwd = (Array.isArray(D.ictTrades) ? D.ictTrades : []).filter((x) => x && x.aset), seen = new Set(fwd.map((x) => String(x.id)));
  for (const x of fwd) { if (!closedOk(x)) continue; const t = +(x.closed || x.exitAt); if (t < t0) continue;
    out.push({ id: String(x.id), idea: byK.get('ict-a') || 'other', k: 'ict-a', desk: 'ICT', t, R: +ictNet(x), raw: +x.R, src: 'live' }); }
  const rp = (D.ictReplay && Array.isArray(D.ictReplay.trades) ? D.ictReplay.trades : []).filter((x) => x && x.aset && x.valid !== false && !x.shadow);
  for (const x of rp) { if (!closedOk(x) || seen.has(String(x.id).replace(/-r$/, ''))) continue; const t = +(x.closed || x.exitAt); if (t < t0) continue;
    out.push({ id: String(x.id), idea: byK.get('ict-a') || 'other', k: 'ict-a', desk: 'ICT', t, R: +ictNet(x), raw: +x.R, src: 'replay' }); }
  return out.filter((p) => Number.isFinite(p.R)).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
}

// ─── statistics ───
export function describe(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: 0, sd: 0, sum: 0 };
  const sum = xs.reduce((s, x) => s + x, 0), mean = sum / n, sd = n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, sum };
}
export function drawdown(xs) {
  let eq = 0, pk = 0, max = 0;
  for (const x of xs) { eq += x; if (eq > pk) pk = eq; if (pk - eq > max) max = pk - eq; }
  return { cur: pk - eq, max };
}
export function correlation(a, b) {
  const n = Math.min(a.length, b.length); if (n < 3) return null;
  const A = describe(a.slice(0, n)), B = describe(b.slice(0, n)); if (!(A.sd > 0 && B.sd > 0)) return null;
  let s = 0; for (let i = 0; i < n; i++) s += (a[i] - A.mean) * (b[i] - B.mean);
  return s / ((n - 1) * A.sd * B.sd);
}
// annualised from daily R on trading days (252 a year); null under BK.minDaysSharpe days
export const sharpe = (xs) => { const d = describe(xs); return d.n >= BK.minDaysSharpe && d.sd > 0 ? d.mean / d.sd * Math.sqrt(252) : null; };

// ─── the two books, day by day ───
// points from collect(); m: multipliers per idea (an idea without one, e.g. 'other', keeps its live size 1).
// Returns { days: [{ d, n, live, prop, cumLive, cumProp }], live: { R, dd, ddCur, sharpe, worstDay, bestDay }, proposed, corr }
export function daily(points, m) {
  const by = new Map();
  for (const p of points) { const d = isoDay(p.t), mult = Number.isFinite(m[p.idea]) ? m[p.idea] : 1, o = by.get(d) || { d, n: 0, live: 0, prop: 0 };
    o.n++; o.live += p.R; o.prop += mult * p.R; by.set(d, o); }
  const days = [...by.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
  let cl = 0, cp = 0;
  for (const o of days) { cl += o.live; cp += o.prop; o.live = r3(o.live); o.prop = r3(o.prop); o.cumLive = r3(cl); o.cumProp = r3(cp); }
  const L = days.map((o) => o.live), P = days.map((o) => o.prop);
  const side = (xs) => { const d = describe(xs), dd = drawdown(xs); return { R: r2(d.sum), dd: r2(dd.max), ddCur: r2(dd.cur), sharpe: r2(sharpe(xs)), worstDay: xs.length ? r2(Math.min(...xs)) : null, bestDay: xs.length ? r2(Math.max(...xs)) : null }; };
  return { days, live: side(L), proposed: side(P), corr: r2(correlation(L, P)) };
}

// ─── coach.json `book` ───
export function buildBook(D, { now = Math.floor(Date.now() / 1000), from = BK.from, ideas = IDEAS, cap = BK.goldCap } = {}) {
  const at = new Date(now * 1000).toISOString(), X = multipliers(ideas, cap), pts = collect(D, { from, ideas }), S = daily(pts, X.m);
  const byIdea = ideas.map((i) => { const P = pts.filter((p) => p.idea === i.id);
    return { id: i.id, name: i.name, desk: i.desk, gold: !!i.gold, streams: (i.ks || []).length, n: P.length, w: r3(X.w[i.id]), m: r2(X.m[i.id]),
      live: r2(P.reduce((a, p) => a + p.R, 0)), prop: r2(P.reduce((a, p) => a + X.m[i.id] * p.R, 0)) }; });
  const other = pts.filter((p) => p.idea === 'other');
  if (other.length) byIdea.push({ id: 'other', name: 'Other (retired setups closing out)', desk: 'Meridian', gold: false, streams: 0, n: other.length, w: null, m: 1,
    live: r2(other.reduce((a, p) => a + p.R, 0)), prop: r2(other.reduce((a, p) => a + p.R, 0)) });
  const ict = pts.filter((p) => p.desk === 'ICT');
  return {
    at, v: 1, label: LABEL, from, to: S.days.length ? S.days[S.days.length - 1].d : null,
    rule: 'Paper comparison only. The live book is traded as it is; the proposed weights are applied to the same closed trades after the fact. Nothing here changes a rule, a size, a filter or a trade: the owner decides.',
    budget: { M: X.M, N: X.N, goldCap: cap, capped: X.capped, goldShare: r3(X.goldShare), goldIdeas: X.goldIdeas, ...(X.note ? { note: X.note } : {}) },
    sizing: { basis: 'clean half 2009-17 (research/edge/portfolio-v2)', sharpe: BK.sharpeClean, ddRange: BK.ddRange.map((v) => r2(v * X.M)),
      note: `Expect the clean-half numbers, not the 2018-26 ones: a Sharpe of about ${BK.sharpeClean} a year and drawdowns of about ${r2(BK.ddRange[0] * X.M)}-${r2(BK.ddRange[1] * X.M)}R at this book's budget of ${X.M}R (${BK.ddRange[0]}-${BK.ddRange[1]}R per 1R of budget).` },
    cost: 'after costs: trades.json Rnet; ICT the CME micro round trip (digest.mjs merNet / ictNet)',
    nTrades: pts.length, nDays: S.days.length, ictReplay: ict.filter((p) => p.src === 'replay').length, ictForward: ict.filter((p) => p.src === 'live').length,
    live: S.live, proposed: S.proposed, diff: r2((S.proposed.R || 0) - (S.live.R || 0)), corr: S.corr,
    byIdea, days: S.days.slice(-BK.maxDays),
  };
}
