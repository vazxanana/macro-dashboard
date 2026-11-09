// The Edge lab's one-file summary (9 Nov 2026, performance pass): /edge-lab.html used to download every study's full
// result.json on each load and again every two minutes (about 7 MB decoded, 57 requests). `slimStudy` keeps exactly the
// fields the page reads (system, variantsTried, verdict, best, baseline, years, notes and per candidate rule / verdict /
// IS and OOS stats / years, plus a sampled equity curve where the study lists its trades); research/edge/build.mjs writes them for every study into <out>/research/edge/lab.json.
// The full result.json files are still published for "Open raw" and anything else that reads them.
const STAT = ['exp', 'R', 'n', 'wr', 'maxDD', 't'];
const VKEYS = ['verdict', 'primary', 'label', 'status', 'decision'];
const pick = (o, keys) => { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; };
const obj = (o) => o && typeof o === 'object' && !Array.isArray(o);

function stat(s) { return obj(s) ? pick(s, STAT) : undefined; }
function years(y) {
  if (!y || typeof y !== 'object') return undefined;
  const one = (s) => (typeof s === 'number' || typeof s === 'string') ? s : obj(s) ? pick(s, ['year', 'y', ...STAT]) : null;
  if (Array.isArray(y)) return y.map(one).filter((s) => s != null);
  const r = {}; for (const k of Object.keys(y)) { const s = one(y[k]); if (s != null) r[k] = s; } return r;
}
function verdict(v) { return obj(v) ? pick(v, VKEYS) : v; }
function side(b) {
  if (!obj(b)) return undefined;
  const r = {}; if (b.is) r.is = stat(b.is); if (b.oos) r.oos = stat(b.oos); if (b.years) r.years = years(b.years); return r;
}
export function slimCandidate(c) {
  if (!obj(c)) return c;
  const r = {}; if (c.rule != null) r.rule = c.rule; if (c.verdict !== undefined) r.verdict = verdict(c.verdict);
  if (c.is) r.is = stat(c.is); if (c.oos) r.oos = stat(c.oos); if (c.years) r.years = years(c.years); return r;
}
function baseline(bl) {
  if (!obj(bl)) return undefined;
  if (bl.is || bl.oos) return side(bl);
  const r = {}; for (const k of Object.keys(bl)) { const v = bl[k]; if (obj(v) && (v.is || v.oos)) r[k] = side(v); } return r;
}
// Equity curve (9 Nov 2026 design pass): only when the study publishes its own per-trade list (a top-level `trades` array of
// objects with a numeric R, in time order). Cumulative R is sampled to at most EQ_POINTS points (always keeping the last);
// the max drawdown and the low are taken from the full series, so a sampled curve cannot hide them. No list, no curve.
export const EQ_POINTS = 48;
const r2 = (v) => Math.round(v * 100) / 100;
const when = (t) => { const v = t.d ?? t.date ?? t.exit ?? t.entry ?? t.at; return typeof v === 'string' ? v.slice(0, 10) : undefined; };
export function equityOf(trades) {
  if (!Array.isArray(trades) || trades.length < 10) return undefined;
  const rs = trades.map((t) => (obj(t) && typeof t.R === 'number' && isFinite(t.R) ? t.R : null));
  if (rs.some((v) => v === null)) return undefined;
  let cum = 0, peak = 0, dd = 0, lo = 0; const curve = rs.map((v) => { cum += v; if (cum > peak) peak = cum; if (peak - cum > dd) dd = peak - cum; if (cum < lo) lo = cum; return cum; });
  const n = curve.length, k = Math.min(EQ_POINTS, n), pts = [];
  for (let i = 0; i < k; i++) pts.push(r2(curve[Math.round((i + 1) * n / k) - 1]));
  const r = { n, total: r2(cum), maxDD: r2(dd), low: r2(lo), pts };
  const a = when(trades[0]), z = when(trades[n - 1]); if (a) r.from = a; if (z) r.to = z;
  return r;
}
export function slimStudy(d) {
  if (!obj(d)) return {};
  const r = {};
  if (d.system != null) r.system = d.system;
  if (d.variantsTried != null) r.variantsTried = d.variantsTried;
  if (d.verdict !== undefined) r.verdict = verdict(d.verdict);
  if (Array.isArray(d.candidates)) r.candidates = d.candidates.map(slimCandidate);
  if (d.best != null) r.best = obj(d.best) ? slimCandidate(d.best) : d.best;
  if (d.baseline) r.baseline = baseline(d.baseline);
  if (d.years) r.years = years(d.years);
  if (d.notes) r.notes = d.notes;
  const eq = equityOf(d.trades); if (eq) r.equity = eq;
  return r;
}
