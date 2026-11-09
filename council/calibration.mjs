// Council · The veteran's self-calibration (9 Nov 2026, owner: "be the best of all time veteran"). Event-playbook release-day
// calls (council/playbook.mjs, src 'event playbook') are scored here too, against their all-weekdays base rate.
//
// The veteran keeps three scored records of his own: the dated calls (macro/veteran-calls.json: week / month calls, COT calls,
// the briefing's hypotheses) and the weekly 20-day forecast ledger (macro/veteran-ledger.json). This module reads them and does
// two things, both deterministic and from his own record only:
//   1. Reliability: every scored call by its stated probability, in 10-point bins, against how often it came true (with a 95%
//      Wilson interval per bin), plus Brier against each call's own base rate.
//   2. One automatic, pre-registered adjustment. Each call has a base rate (the reference-class frequency before any tilt or
//      analog information: `baseP`). The adjustment scales every future probability's distance from its base rate by one
//      factor k:  p' = base + k · (p − base).  k < 1 shrinks toward the base rates (he has been overconfident), k > 1 widens
//      (underconfident). k is the least-squares (Brier-optimal) slope of outcome − base on p − base over his scored calls,
//      pulled toward 1 by a prior worth PRIOR (≈ 30 calls ten points from base), and clamped to K_BOUNDS.
//      Pre-registered gate: k stays exactly 1 until at least MIN_SCORED calls are scored AND they fall due in at least
//      MIN_WEEKS different weeks (calls due the same week share one outcome, so they are not independent).
// What it cannot do: it only scales departures from the base rates. If the base rates themselves miss (all calls too high or
// too low), the reliability chart and `inTheLarge` show it, but k does not fix it. It changes no rule, size or trade; it only
// changes the probability printed on future calls (each keeps its raw value as `pRaw`).
// No look-ahead: a call counts only once it is resolved, and resolution needs the closes after its date (outlook.mjs
// resolveCall), all at or before `now`.
export const MIN_SCORED = 30;          // pre-registered threshold: scored calls before any adjustment
export const MIN_WEEKS = 4;            // ... spread over at least this many due weeks
export const PRIOR = 0.3;              // prior weight toward k = 1, in units of Σ(p − base)²
export const K_BOUNDS = [0.25, 1.5];   // never fully flatten, never more than 1.5× wider
export const BINS = 10;
const r = (v, d = 3) => (v == null || !Number.isFinite(+v) ? null : +(+v).toFixed(d));
const DAY = 86400;
// the Saturday-based week of a YYYY-MM-DD date (same convention as veteran.mjs weekKey)
const weekOf = (iso) => { const t = Date.parse(String(iso).slice(0, 10) + 'T00:00:00Z') / 1000; if (!Number.isFinite(t)) return null; const wd = new Date(t * 1000).getUTCDay(); return new Date((t - ((wd + 1) % 7) * DAY) * 1000).toISOString().slice(0, 10); };

// The base rate a call carries: recorded `baseP`; the hypotheses' all-weeks frequency; else unknown (null).
export function baseOf(c) {
  if (c == null) return null;
  if (Number.isFinite(c.baseP)) return c.baseP;
  if (c.base && Number.isFinite(c.base.all)) return c.base.all;
  return null;
}
// One flat list of scored calls: { p (as stated), pRaw (before any calibration), base, y (0/1), src, due }
export function records({ calls = [], ledger = [] } = {}) {
  const out = [];
  for (const c of calls || []) {
    if (c == null || typeof c.hit !== 'boolean' || !Number.isFinite(c.p)) continue;
    out.push({ p: c.p, pRaw: Number.isFinite(c.pRaw) ? c.pRaw : c.p, base: baseOf(c), y: c.hit ? 1 : 0, src: c.src === 'veteran hypothesis' ? 'hypothesis' : c.src === 'event playbook' ? 'event' : /^COT/.test(c.src || '') ? 'cot' : 'call', due: c.by });
  }
  const issued = new Map((ledger || []).filter((x) => x && x.record_type === 'issued').map((x) => [x.forecast_id, x]));
  for (const x of ledger || []) {
    if (!x || x.record_type !== 'resolved' || !x.resolution) continue; const i = issued.get(x.forecast_id); if (!i) continue;
    const p = i.forecast && i.forecast.distribution && i.forecast.distribution.event_probability; if (!Number.isFinite(p)) continue;
    const b = i.forecast.base_rate && i.forecast.base_rate.probability;
    out.push({ p, pRaw: p, base: Number.isFinite(b) ? b : null, y: x.resolution.outcome ? 1 : 0, src: 'ledger', due: String(x.resolution.resolved_at_utc || '').slice(0, 10) });
  }
  return out;
}
// 95% Wilson score interval for k successes in n
export function wilson(k, n, z = 1.96) {
  if (!n) return [null, null];
  const ph = k / n, d = 1 + z * z / n, c = (ph + z * z / (2 * n)) / d, h = (z / d) * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n));
  return [r(Math.max(0, c - h)), r(Math.min(1, c + h))];
}
// Reliability bins by stated probability: 0-10%, 10-20%, ..., 90-100% (a 100% call lands in the top bin)
export function reliability(R, bins = BINS) {
  const B = Array.from({ length: bins }, (_, i) => ({ lo: i / bins, hi: (i + 1) / bins, n: 0, k: 0, sp: 0 }));
  for (const x of R || []) { const i = Math.min(bins - 1, Math.max(0, Math.floor(x.p * bins))); B[i].n++; B[i].k += x.y; B[i].sp += x.p; }
  return B.map((b) => ({ lo: r(b.lo, 2), hi: r(b.hi, 2), n: b.n, stated: b.n ? r(b.sp / b.n) : null, came: b.n ? r(b.k / b.n) : null, ci: wilson(b.k, b.n) }));
}
// The shrink factor. Fit on the RAW probabilities (before any earlier adjustment), so k always describes the raw model.
export function fitShrink(R, { prior = PRIOR, bounds = K_BOUNDS } = {}) {
  let sxx = 0, sxy = 0, m = 0;
  for (const x of R || []) { if (x.base == null) continue; const d = x.pRaw - x.base; if (Math.abs(d) < 1e-9) continue; sxx += d * d; sxy += d * (x.y - x.base); m++; }
  const k = (sxy + prior) / (sxx + prior);
  return { k: r(Math.min(bounds[1], Math.max(bounds[0], k))), kUnclamped: r(k), informative: m, sxx: r(sxx, 4), sxy: r(sxy, 4) };
}
// p' = base + k (p − base), clamped to the call's own band. Monotonic (non-decreasing) in p for k >= 0; base stays base.
export function adjust(p, base, k, band = [0.05, 0.95]) {
  if (!Number.isFinite(p)) return p;
  const q = base == null || !Number.isFinite(base) || !Number.isFinite(k) ? p : base + k * (p - base);
  return +Math.min(band[1], Math.max(band[0], q)).toFixed(2);
}
const brierOf = (R, f) => (R.length ? r(R.reduce((a, x) => a + (f(x) - x.y) ** 2, 0) / R.length, 4) : null);

// The whole calibration state, from the scored record as of now.
export function calibration({ calls = [], ledger = [] } = {}) {
  const R = records({ calls, ledger }), n = R.length, weeks = new Set(R.map((x) => weekOf(x.due)).filter(Boolean)).size;
  const withBase = R.filter((x) => x.base != null), fit = fitShrink(R), ready = n >= MIN_SCORED && weeks >= MIN_WEEKS;
  const k = ready ? fit.k : 1;
  const bySrc = {}; for (const x of R) { const b = bySrc[x.src] || (bySrc[x.src] = { n: 0, hit: 0, p: 0 }); b.n++; b.hit += x.y; b.p += x.p; }
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  const state = ready ? (k < 0.95 ? 'shrinking' : k > 1.05 ? 'widening' : 'calibrated') : 'waiting';
  const pctS = (v) => `${Math.round(v * 100)}%`;
  return {
    status: ready ? 'active' : 'waiting', state, k, n, weeks, need: { scored: MIN_SCORED, weeks: MIN_WEEKS },
    fit, bins: reliability(R),
    inTheLarge: n ? { stated: r(mean(R.map((x) => x.p))), came: r(mean(R.map((x) => x.y))) } : null,
    brier: brierOf(R, (x) => x.p), brierBase: withBase.length ? brierOf(withBase, (x) => x.base) : null, nBase: withBase.length,
    brierAdjusted: ready && withBase.length ? brierOf(withBase, (x) => adjust(x.pRaw, x.base, k, [0, 1])) : null,
    bySource: Object.fromEntries(Object.entries(bySrc).map(([s, b]) => [s, { n: b.n, hit: r(b.hit / b.n, 2), stated: r(b.p / b.n, 2) }])),
    line: !ready ? `Not enough scored calls yet: ${n} of ${MIN_SCORED}${weeks < MIN_WEEKS ? `, over ${weeks} of ${MIN_WEEKS} weeks` : ''}. Probabilities are used as computed until then.`
      : state === 'shrinking' ? `Overconfident so far: future probabilities are pulled toward their base rates (k = ${k}, each call's distance from its base rate × ${k}).`
      : state === 'widening' ? `Underconfident so far: future probabilities are moved further from their base rates (k = ${k}).`
      : `Calibrated so far (k = ${k}): probabilities are used as computed.`,
    method: `Each scored call (dated calls, COT calls, hypotheses, the weekly ledger forecast) is binned by its stated probability against how often it came true. One factor k scales every future call's distance from its own base rate: k is the Brier-optimal slope over the scored record, pulled toward 1 by a prior (${PRIOR}), clamped ${K_BOUNDS[0]}-${K_BOUNDS[1]}; it stays 1 until ${MIN_SCORED} calls are scored over ${MIN_WEEKS}+ weeks (pre-registered). In-sample Brier before / after is shown for transparency, not as proof. k cannot fix base rates that are themselves off: compare stated vs came true overall.${n ? ` So far: stated ${pctS(mean(R.map((x) => x.p)))} on average, came true ${pctS(mean(R.map((x) => x.y)))}.` : ''}`,
  };
}
// Apply the calibration to a list of calls in place of their p; the raw value is kept as pRaw.
export function applyCalls(list, cal, band) {
  if (!Array.isArray(list)) return list;
  for (const c of list) { if (!c || !Number.isFinite(c.p)) continue; const raw = Number.isFinite(c.pRaw) ? c.pRaw : c.p, b = baseOf(c);
    c.pRaw = raw; if (cal && cal.status === 'active' && b != null) c.p = adjust(raw, b, cal.k, band || [0.05, 0.95]); }
  return list;
}
