// ICT A-setup book: the four pre-registered book-level rules and the measures (PREREGISTRATION.md). Pure, no imports.
// A trade: { id, market, side: 'buy'|'sell', t (entry, unix s), closed (exit, unix s), R (net, as sized), grade? }.
export const INDEX = ['nq', 'es', 'ym', 'rty'];
export const ORDER = ['nq', 'es', 'ym', 'rty', 'gc'];
export const P = { lossStop: -2, maxOpen: 2, volDays: 60, wMin: 1 / 3, wMax: 3, draws: 2000, seed: 20261113, alpha: 0.10, pMin: 0.9 };
const GR = { 'A+': 5, A: 4, B: 3, C: 2, D: 1, F: 0 };

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
// New York trading day, 17:00 to 17:00 New York: the NY date of t + 7 h
export const nyDay = (t) => fmt.format(new Date((t + 7 * 3600) * 1000));

export function entryOrder(trades) {
  return [...trades].sort((a, b) => a.t - b.t || (GR[b.grade] ?? 0) - (GR[a.grade] ?? 0) || ORDER.indexOf(a.market) - ORDER.indexOf(b.market));
}
const openAt = (taken, t) => taken.filter((x) => x.t <= t && x.closed > t);

// generic overlay: walk in entry order, keep a trade unless `skip(trade, taken)` says so
function overlay(trades, skip) {
  const taken = [], skipped = [];
  for (const tr of entryOrder(trades)) (skip(tr, taken) ? skipped : taken).push(tr);
  return { taken, skipped };
}
export const r1Cluster = (trades) => overlay(trades, (tr, taken) => INDEX.includes(tr.market) && openAt(taken, tr.t).some((x) => INDEX.includes(x.market) && x.side === tr.side));
export const r2DayStop = (trades, stop = P.lossStop) => overlay(trades, (tr, taken) => {
  const d = nyDay(tr.t); let s = 0;
  for (const x of taken) if (x.closed <= tr.t && nyDay(x.closed) === d) s += x.R;
  return s <= stop + 1e-9;
});
export const r3OpenCap = (trades, cap = P.maxOpen) => overlay(trades, (tr, taken) => openAt(taken, tr.t).length >= cap);

// weekday NY trading days from `from` to `to` (unix s), as keys in order
export function tradingDays(from, to) {
  const out = [], seen = new Set();
  for (let t = from; t <= to; t += 3600 * 6) { const d = nyDay(t), wd = new Date(d + 'T12:00:00Z').getUTCDay(); if (wd >= 1 && wd <= 5 && !seen.has(d)) { seen.add(d); out.push(d); } }
  return out;
}
const sd = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
// R4: each trade's R x the inverse-volatility weight of its market at entry. days = tradingDays(window start, end)
export function r4InvVol(trades, days, markets = ORDER, o = P) {
  const pos = new Map(days.map((d, i) => [d, i])), ser = Object.fromEntries(markets.map((m) => [m, new Array(days.length).fill(0)]));
  for (const x of trades) { const i = pos.get(nyDay(x.closed)); if (i != null && ser[x.market]) ser[x.market][i] += x.R; }
  const weightAt = (m, t) => {
    const i = pos.get(nyDay(t)); if (i == null || i < o.volDays) return 1;
    const sig = Object.fromEntries(markets.map((k) => [k, sd(ser[k].slice(i - o.volDays, i))]));
    if (!(sig[m] > 0)) return 1;
    const live = markets.filter((k) => sig[k] > 0), mean = live.reduce((s, k) => s + 1 / sig[k], 0) / live.length;
    return Math.min(o.wMax, Math.max(o.wMin, (1 / sig[m]) / mean));
  };
  const taken = entryOrder(trades).map((x) => { const w = weightAt(x.market, x.t); return { ...x, w: +w.toFixed(4), R: x.R * w }; });
  return { taken, skipped: [] };
}

// ---- measures ----
export function maxDD(trades) {
  let run = 0, hi = 0, dd = 0;
  for (const x of [...trades].sort((a, b) => a.closed - b.closed)) { run += x.R; hi = Math.max(hi, run); dd = Math.max(dd, hi - run); }
  return dd;
}
const first = (t) => { const d = new Date(t * 1000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); };
const month = (t) => new Date(t * 1000).toISOString().slice(0, 7);
// months from the first month of `from` to the last close
export function monthlySharpe(trades, from) {
  if (!trades.length) return null;
  const last = Math.max(...trades.map((x) => x.closed)), sums = new Map();
  for (let d = first(from); month(d / 1000) <= month(last); d.setUTCMonth(d.getUTCMonth() + 1)) sums.set(month(d / 1000), 0);
  for (const x of trades) sums.set(month(x.closed), (sums.get(month(x.closed)) || 0) + x.R);
  const v = [...sums.values()]; if (v.length < 2) return null; const s = sd(v);
  return s > 0 ? (v.reduce((a, b) => a + b, 0) / v.length) / s * Math.sqrt(12) : null;
}
export function measure(trades, from) {
  const n = trades.length, R = trades.reduce((s, x) => s + x.R, 0), dd = maxDD(trades), wins = trades.filter((x) => x.R > 0).length;
  const m = n ? R / n : null, t = n > 1 ? m / (sd(trades.map((x) => x.R)) / Math.sqrt(n)) : null;
  return { n, R: +R.toFixed(2), exp: m == null ? null : +m.toFixed(3), wr: n ? +(wins / n).toFixed(3) : null, maxDD: +dd.toFixed(2), rdd: dd > 0 ? +(R / dd).toFixed(3) : null, sharpe: (() => { const s = monthlySharpe(trades, from); return s == null ? null : +s.toFixed(3); })(), t: t == null || !isFinite(t) ? null : +t.toFixed(2) };
}

// seeded RNG
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rdd = (seq) => { let run = 0, hi = 0, dd = 0; for (const r of seq) { run += r; hi = Math.max(hi, run); dd = Math.max(dd, hi - run); } return dd > 0 ? run / dd : (run > 0 ? Infinity : 0); };
// paired monthly block bootstrap of return / drawdown: share of draws where `rule` beats `base`. months = list of month keys
export function bootstrap(base, rule, months, draws = P.draws, seed = P.seed) {
  const blk = (tr) => { const m = new Map(months.map((k) => [k, []])); for (const x of [...tr].sort((a, b) => a.closed - b.closed)) { const k = month(x.t); if (m.has(k)) m.get(k).push(x.R); } return months.map((k) => m.get(k)); };
  const B = blk(base), Q = blk(rule), rnd = mulberry32(seed); let better = 0;
  for (let d = 0; d < draws; d++) {
    const sb = [], sq = [];
    for (let i = 0; i < months.length; i++) { const j = Math.floor(rnd() * months.length); sb.push(...B[j]); sq.push(...Q[j]); }
    if (rdd(sq) > rdd(sb)) better++;
  }
  return better / draws;
}
export const monthsBetween = (from, to) => { const out = []; for (let d = first(from); d.getTime() / 1000 < to; d.setUTCMonth(d.getUTCMonth() + 1)) out.push(month(d / 1000)); return out; };

// Holm step-down adjusted p-values, input order
export function holm(ps) {
  const idx = ps.map((p, i) => [p == null ? 1 : p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = +run.toFixed(4); });
  return out;
}

// the pre-registered bar, given the as-is and rule measures and the bootstrap
export function judge(base, rule, pBetter, holmP, o = P) {
  const checks = {
    isRddBetter: rule.is.rdd != null && base.is.rdd != null && rule.is.rdd > base.is.rdd,
    oosRddBetter: rule.oos.rdd != null && base.oos.rdd != null && rule.oos.rdd > base.oos.rdd,
    oosSharpeNotLower: rule.oos.sharpe != null && base.oos.sharpe != null && rule.oos.sharpe >= base.oos.sharpe,
    bootstrap: pBetter >= o.pMin,
    holm: holmP <= o.alpha,
  };
  return { checks, verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL' };
}
