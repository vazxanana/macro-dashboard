// Council · The veteran's briefing (9 Nov 2026, owner: "improve our veteran: he needs to give us key insights and near-inside
// information, and he needs to make hypotheses with some base from what happened in the past, levels of the price, and what
// he knows").
//
// "Near-inside information" here means reading PUBLIC data early and carefully: CFTC positioning, funding and stress gauges,
// central-bank wording and the calendar, expectations captured before releases, real yields and the dollar. Nothing here is,
// or uses, non-public information. Four parts, all deterministic, computed from data the council already has (no fetches):
//   1. Key insights: 3-6 ranked items for the week, each with the evidence (number, as-of date, source), why it matters for
//      gold (and the dollar / majors where the data supports it) and what would change the view.
//   2. Historical analogs: the past weeks whose macro fingerprint (real-yield and 2Y 4-week changes, DXY 4-week change, gold's
//      4-week move, gold vs its 10-week average, distance to the 52-week high, place in the 13-week range, equity volatility)
//      is closest to now, and what gold (and the DXY) did over the next 5 and 20 sessions. Features use data up to each analog
//      date only; outcomes start at the first close after the analog Friday, when that Friday's Treasury data were public.
//      Descriptive: this is not a tested edge.
//   3. Price levels: the levels that matter now for gold and the DXY, each with why.
//   4. Hypotheses: 2-3 explicit, dated, testable statements combining 1-3. Each probability is the analog frequency shrunk
//      toward the frequency over all weeks (plus half the council tilt for gold), clamped; each is recorded in the calls
//      ledger (council/outlook.mjs callsLedger) and scored like the other calls.
// Paper only: changes no rule, size or trade.
import { isoDay } from './macroscore.mjs';
import { addSessions } from './outlook.mjs';

const DAY = 86400;
export const PUBLIC_ONLY = 'Near-inside information here means reading public data early and carefully: CFTC positioning, funding and stress gauges, central-bank wording and the release calendar, expectations captured before each release, real yields and the dollar. Nothing on this page is, or uses, non-public information.';
export const SHRINK = 10;          // pseudo-cases of the all-weeks frequency mixed into each analog frequency
export const P_CLAMP = [0.1, 0.9]; // a hypothesis probability never leaves this band
const r2 = (v, d = 2) => (v == null || !Number.isFinite(+v) ? null : +(+v).toFixed(d));
const sg = (v, d = 1, u = '') => (v == null ? 'n/a' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}${u}`);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdev = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const quant = (a, p) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
// last index with s[i].t <= t (s sorted by t), or -1
export function idxAt(s, t) { let lo = 0, hi = (s || []).length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
// merge a long weekly series with a recent daily one (daily wins on the same date)
export function mergeSeries(...lists) { const m = new Map(); for (const l of lists) for (const o of l || []) if (Number.isFinite(o.t) && Number.isFinite(o.v)) m.set(o.t, o.v); return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v })); }
const trim = (s, now) => (s || []).filter((o) => o.t <= now);

// ---- 2. the fingerprint and the analog finder -----------------------------------------------------------------------------
export const FEATURES = [
  { k: 'ry4w', label: '10Y real yield, 4-week change', unit: ' bp', d: 0 },
  { k: 'y2_4w', label: '2Y yield, 4-week change', unit: ' bp', d: 0 },
  { k: 'dxy4w', label: 'DXY, 4-week change', unit: '%', d: 2 },
  { k: 'gold4w', label: 'Gold, 4-week change', unit: '%', d: 1 },
  { k: 'vs10w', label: 'Gold vs its 10-week average', unit: '%', d: 1 },
  { k: 'offHigh', label: 'Gold vs its 52-week closing high', unit: '%', d: 1 },
  { k: 'pos13w', label: 'Gold in its 13-week range (0 = low, 100 = high)', unit: '', d: 0 },
  { k: 'eqVol', label: 'S&P 500 20-day realized volatility (VIX stand-in: VIX history is not kept)', unit: '%', d: 0 },
];
// The fingerprint at time `at` from data with t <= at only. D = { gold, dxy, spx, ry, y2 }: sorted [{ t, v }]; ry / y2 in percent.
export function featuresAt(D, at) {
  const g = D.gold || [], i = idxAt(g, at); if (i < 259 || at - g[i].t > 4 * DAY) return null;
  const x = D.dxy || [], j = idxAt(x, at); if (j < 20 || at - x[j].t > 4 * DAY) return null;
  const ry = D.ry || [], y2 = D.y2 || [], a = idxAt(ry, at), a4 = idxAt(ry, at - 28 * DAY), b = idxAt(y2, at), b4 = idxAt(y2, at - 28 * DAY);
  if (a < 0 || a4 < 0 || b < 0 || b4 < 0 || at - ry[a].t > 8 * DAY || at - y2[b].t > 8 * DAY || ry[a].t - ry[a4].t < 21 * DAY) return null;
  const s = D.spx || [], k = idxAt(s, at); if (k < 21 || at - s[k].t > 5 * DAY) return null;
  const px = g[i].v, w50 = g.slice(i - 49, i + 1), w260 = g.slice(i - 259, i + 1), w65 = g.slice(i - 64, i + 1);
  const hi13 = Math.max(...w65.map((o) => o.v)), lo13 = Math.min(...w65.map((o) => o.v));
  const lr = []; for (let n = k - 19; n <= k; n++) lr.push(Math.log(s[n].v / s[n - 1].v));
  return { t: g[i].t,
    ry4w: Math.round((ry[a].v - ry[a4].v) * 100), y2_4w: Math.round((y2[b].v - y2[b4].v) * 100),
    dxy4w: r2((x[j].v / x[j - 20].v - 1) * 100, 3), gold4w: r2((px / g[i - 20].v - 1) * 100, 3),
    vs10w: r2((px / mean(w50.map((o) => o.v)) - 1) * 100, 3), offHigh: r2((px / Math.max(...w260.map((o) => o.v)) - 1) * 100, 3),
    pos13w: hi13 > lo13 ? Math.round((px - lo13) / (hi13 - lo13) * 100) : 50, eqVol: r2(sdev(lr) * Math.sqrt(252) * 100, 2) };
}
// one row per Friday (00:00 UTC, the day stamp of Friday's candle) from `from` to `to`
export function weeklyFrame(D, from, to) {
  const out = []; let t = Math.floor(from / DAY) * DAY; while (new Date(t * 1000).getUTCDay() !== 5) t += DAY;
  for (; t <= to; t += 7 * DAY) { const f = featuresAt(D, t); if (f) out.push({ at: t, date: isoDay(t), f }); }
  return out;
}
// the path of closes after an entry index: r[j-1] = close[e + j] / close[e] - 1, j = 1..h
const pathFrom = (s, e, h) => { if (e < 0 || e + h >= s.length) return null; const r = []; for (let j = 1; j <= h; j++) r.push(s[e + j].v / s[e].v - 1); return r; };
const statsOf = (vals) => (vals.length ? { n: vals.length, median: r2(quant(vals, 0.5) * 100), q25: r2(quant(vals, 0.25) * 100), q75: r2(quant(vals, 0.75) * 100), min: r2(Math.min(...vals) * 100), max: r2(Math.max(...vals) * 100), up: r2(vals.filter((v) => v > 0).length / vals.length) } : { n: 0 });
// The analog finder. Every series is cut at `now` first, so nothing after now can enter the features, the scaling, the choice
// or the outcomes. Candidates are Fridays whose 20-session outcome is complete by now and that lie at least `excludeWeeks`
// before now (the current episode is not its own analog); picks are at least `sepWeeks` apart so one episode cannot fill the list.
export function findAnalogs(Din, now, { k = 20, sepWeeks = 6, excludeWeeks = 13, h = 20, from = null } = {}) {
  const D = Object.fromEntries(Object.entries(Din || {}).map(([key, s]) => [key, trim(s, now)]));
  const q = featuresAt(D, now); if (!q) return null;
  const g = D.gold, x = D.dxy, start = from != null ? from : (g[0] ? g[0].t : now);
  const cands = [];
  for (const row of weeklyFrame(D, start, now - excludeWeeks * 7 * DAY)) {
    const e = idxAt(g, row.at) + 1, p = pathFrom(g, e, h); if (!p) continue;   // entry: the first close after the analog Friday
    const ex = idxAt(x, row.at) + 1, px = pathFrom(x, ex, h);
    cands.push({ ...row, entry: { t: g[e].t, v: g[e].v }, path: p, dpath: px });
  }
  if (cands.length < 30) return null;
  const scale = {}; for (const F of FEATURES) { const vals = cands.map((c) => c.f[F.k]); scale[F.k] = { mean: mean(vals), sd: sdev(vals) || 1 }; }
  const z = (f, key) => Math.max(-3, Math.min(3, (f[key] - scale[key].mean) / scale[key].sd));
  for (const c of cands) c.dist = Math.sqrt(mean(FEATURES.map((F) => (z(c.f, F.k) - z(q, F.k)) ** 2)));
  const sorted = cands.slice().sort((a, b) => a.dist - b.dist || a.at - b.at), picks = [];
  for (const c of sorted) { if (picks.length >= k) break; if (picks.every((p) => Math.abs(p.at - c.at) >= sepWeeks * 7 * DAY)) picks.push(c); }
  const out5 = (c) => c.path[4], out20 = (c) => c.path[h - 1];
  const sum = (L) => ({ gold5: statsOf(L.map(out5)), gold20: statsOf(L.map(out20)), dxy5: statsOf(L.filter((c) => c.dpath).map((c) => c.dpath[4])), dxy20: statsOf(L.filter((c) => c.dpath).map((c) => c.dpath[h - 1])) });
  const recent = picks.filter((c) => c.at >= Date.parse('2020-01-01T00:00:00Z') / 1000);
  return {
    asOf: isoDay(q.t), now: q, scale: Object.fromEntries(Object.entries(scale).map(([key, s]) => [key, { mean: r2(s.mean, 3), sd: r2(s.sd, 3) }])),
    zNow: Object.fromEntries(FEATURES.map((F) => [F.k, r2(z(q, F.k))])),
    top: picks.map((c) => ({ date: c.date, sim: Math.round(100 / (1 + c.dist)), dist: r2(c.dist, 3), f: c.f, entry: c.entry.v,
      gold5: r2(out5(c) * 100), gold20: r2(out20(c) * 100), max20: r2(Math.max(...c.path) * 100), min20: r2(Math.min(...c.path) * 100),
      dxy5: c.dpath ? r2(c.dpath[4] * 100) : null, dxy20: c.dpath ? r2(c.dpath[h - 1] * 100) : null,
      // the gold path itself (% from the entry close, sessions 1..h) for the desk's small multiples; descriptive, not a tested edge
      path: c.path.map((x) => r2(x * 100)) })),
    stats: sum(picks), base: sum(cands), since: cands[0].date, candidates: cands.length,
    recent: { n: recent.length, gold20: statsOf(recent.map(out20)) },
    // the paths stay off the JSON (large); hypotheses read them
    _paths: picks.map((c) => ({ g: c.path, d: c.dpath })), _all: cands.map((c) => ({ g: c.path, d: c.dpath })),
  };
}
export const stripPrivate = (a) => (a ? Object.fromEntries(Object.entries(a).filter(([key]) => !key.startsWith('_'))) : null);

// ---- 3. price levels ----------------------------------------------------------------------------------------------------
const wkMonday = (t) => { const d = Math.floor(t / DAY) * DAY; return d - ((new Date(d * 1000).getUTCDay() + 6) % 7) * DAY; };
// bars: [{ t, o, h, l, c }] (day stamps), sorted. Highs / lows from the bars; for a series with closes only pass h = l = c.
export function levelsFor({ bars, now, step, dp = 0, name = 'Gold', unit = '$', extra = [], closesOnly = false }) {
  const B = trim(bars, now); if (B.length < 60) return null; const cl = closesOnly ? ' (closing)' : '';
  const last = B[B.length - 1], px = last.c, L = [];
  const add = (price, label, kind, why) => { if (price == null || !Number.isFinite(price)) return; L.push({ price: +price.toFixed(dp + 1), label, kind, why }); };
  // the last complete Mon-Fri week: the week holding `now` when now is a weekend, else the one before
  const nd = new Date(now * 1000).getUTCDay(), w0 = nd === 0 || nd === 6 ? wkMonday(now) : wkMonday(now) - 7 * DAY;
  const wk = B.filter((b) => b.t >= w0 && b.t < w0 + 5 * DAY);
  if (wk.length) { const hi = Math.max(...wk.map((b) => b.h)), lo = Math.min(...wk.map((b) => b.l)), span = `${isoDay(w0)}..${isoDay(w0 + 4 * DAY)}`;
    add(hi, `Last week's high${cl}`, 'week', `The first test for buyers this week (${span}): a daily close above it turns last week's range into a breakout.`);
    add(lo, `Last week's low${cl}`, 'week', `The first support (${span}): a daily close below it says sellers took last week's range.`); }
  const nm = new Date(now * 1000), m0 = Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth() - 1, 1) / 1000, m1 = Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth(), 1) / 1000, mo = B.filter((b) => b.t >= m0 && b.t < m1);
  if (mo.length) { const mn = new Date(m0 * 1000).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    add(Math.max(...mo.map((b) => b.h)), `${mn} high${cl}`, 'month', 'Last month\'s extreme: the monthly range desks use to judge whether the month opened in balance or in trend.');
    add(Math.min(...mo.map((b) => b.l)), `${mn} low${cl}`, 'month', 'Last month\'s extreme: below it the monthly structure turns lower.'); }
  const sma = (n) => (B.length >= n ? mean(B.slice(-n).map((b) => b.c)) : null);
  add(sma(20), '20-day average', 'sma', 'The short-term trend line most desks watch; pullbacks in a trend tend to be judged against it.');
  add(sma(50), '50-day average (= the 10-week average)', 'sma', 'The Gold Macro Score\'s trend tiebreaker: above it the tested score\'s BUY won 70% vs 68% overall; a weekly close across it changes the tiebreaker.');
  add(sma(200), '200-day average', 'sma', 'The long-term trend: a close through it is a regime-level event for trend followers.');
  // swing points: a bar whose high (low) is the extreme of the 3 bars each side, within the last 90 sessions
  const R = B.slice(-93), sw = { hi: [], lo: [] };
  for (let i = 3; i < R.length - 3; i++) { const w = R.slice(i - 3, i + 4); if (R[i].h === Math.max(...w.map((b) => b.h))) sw.hi.push(R[i]); if (R[i].l === Math.min(...w.map((b) => b.l))) sw.lo.push(R[i]); }
  const upH = sw.hi.filter((b) => b.h > px).sort((a, b) => a.h - b.h)[0], dnL = sw.lo.filter((b) => b.l < px).sort((a, b) => b.l - a.l)[0];
  if (upH) add(upH.h, `Swing high ${isoDay(upH.t)}`, 'swing', 'The nearest swing high above: resting buy stops of shorts sit just above it, so a break can run.');
  if (dnL) add(dnL.l, `Swing low ${isoDay(dnL.t)}`, 'swing', 'The nearest swing low below: resting sell stops sit just under it; a break there can run lower.');
  const q = B.slice(-65); add(Math.max(...q.map((b) => b.h)), `13-week high${cl}`, 'range', 'The top of the quarter\'s range (the analogs\' 13-week range feature uses it).'); add(Math.min(...q.map((b) => b.l)), `13-week low${cl}`, 'range', 'The bottom of the quarter\'s range.');
  const r0 = Math.floor(px / step) * step, r1 = r0 + step;
  add(r0 === px ? r0 - step : r0, 'Round number', 'round', 'Option strikes and resting orders cluster at round numbers; price often pauses there.');
  add(r1, 'Round number', 'round', 'Option strikes and resting orders cluster at round numbers; price often pauses there.');
  for (const e of extra) add(e.price, e.label, e.kind, e.why);
  const list = L.map((l) => ({ ...l, dist: r2((l.price / px - 1) * 100), side: l.price >= px ? 'above' : 'below' })).sort((a, b) => b.price - a.price);
  // confluence: other levels within 0.25% of each one
  for (const l of list) l.near = list.filter((o) => o !== l && Math.abs(o.price / l.price - 1) <= 0.0025).length;
  return { name, px, asOf: isoDay(last.t), unit, dp, list };
}
// the nearest level beyond `minPct` on a side, from the structural kinds (not the derived ranges or projections)
const STRUCT = new Set(['week', 'month', 'sma', 'swing', 'range', 'round']);
// `ref` (display only, council/glance.mjs): measure from another price than the close, e.g. the latest price; the hypotheses
// never pass it, so they are always built from the close
export function nearestLevel(lv, side, minPct = 0.4, ref = null) {
  const d = (l) => (ref == null ? l.dist : (l.price / ref - 1) * 100);
  const c = (lv && lv.list || []).filter((l) => STRUCT.has(l.kind) && (side === 'above' ? d(l) >= minPct : d(l) <= -minPct));
  return c.sort((a, b) => Math.abs(d(a)) - Math.abs(d(b)))[0] || null;
}

// ---- 4. hypotheses ------------------------------------------------------------------------------------------------------
// frequencies on paths (relative returns from the entry close): which comes first, the target or the guard
export const raceHit = (path, h, rT, rG, dir) => { for (let j = 0; j < Math.min(h, path.length); j++) { const v = path[j]; if (dir > 0 ? v <= -rG : v >= rG) return false; if (dir > 0 ? v >= rT : v <= -rT) return true; } return false; };
export const stayHit = (path, h, rLo, rHi) => path.slice(0, h).every((v) => v >= rLo && v <= rHi);
const freqOf = (P, f) => { const ok = P.filter(Boolean); return ok.length ? { k: ok.filter(f).length, n: ok.length } : { k: 0, n: 0 }; };
export function blend(a, b, m = SHRINK) {
  const p0 = b.n ? b.k / b.n : 0.5, p = (a.k + m * p0) / (a.n + m);
  return { p: +Math.min(P_CLAMP[1], Math.max(P_CLAMP[0], p)).toFixed(2), analog: a.n ? r2(a.k / a.n) : null, k: a.k, n: a.n, all: r2(p0), allN: b.n };
}
export function hypotheses({ an, gl, dl, now, week, tilt = 0, insights = [] }) {
  if (!an || !gl) return [];
  const out = [], px = gl.px, fmt = (v) => `$${Math.round(v).toLocaleString('en-US')}`, lastT = Date.parse(gl.asOf + 'T00:00:00Z') / 1000, by5 = addSessions(lastT, 5), by20 = addSessions(lastT, 20);
  const G = an._paths.map((p) => p.g), GA = an._all.map((p) => p.g), watch = (insights[0] && insights[0].change) || '';
  // H1: the race for the week, in the direction the analogs favour
  const upT = nearestLevel(gl, 'above'), upG = nearestLevel(gl, 'below'), races = [];
  if (upT && upG) {
    const rT = upT.dist / 100, rG = -upG.dist / 100;
    const u = blend(freqOf(G, (p) => raceHit(p, 5, rT, rG, 1)), freqOf(GA, (p) => raceHit(p, 5, rT, rG, 1))), d = blend(freqOf(G, (p) => raceHit(p, 5, rG, rT, -1)), freqOf(GA, (p) => raceHit(p, 5, rG, rT, -1)));
    races.push({ dir: 1, b: u, T: upT, Gd: upG }, { dir: -1, b: d, T: upG, Gd: upT });
  }
  if (races.length) {
    const lean = (r) => r.b.p - r.b.all;   // how far the analogs move the all-weeks frequency
    const r = lean(races[0]) >= lean(races[1]) ? races[0] : races[1], p = +Math.min(P_CLAMP[1], Math.max(P_CLAMP[0], r.b.p + r.dir * tilt / 2)).toFixed(2);
    const up = r.dir > 0;
    out.push({ id: `hyp:${week}:H1`, slot: 'H1', horizon: 'week', asset: 'gold', kind: up ? 'firstTouchUp' : 'firstTouchDown', level: +r.T.price.toPrecision(8), guard: +r.Gd.price.toPrecision(8), by: by5, p,
      claim: `If gold ${up ? 'holds above' : 'stays below'} ${fmt(r.Gd.price)} (${r.Gd.label.toLowerCase()}), it closes at or ${up ? 'above' : 'below'} ${fmt(r.T.price)} (${r.T.label.toLowerCase()}) by ${by5} before any close ${up ? 'below' : 'above'} ${fmt(r.Gd.price)}`,
      base: r.b, invalid: `a daily close ${up ? 'below' : 'above'} ${fmt(r.Gd.price)} before the target${watch ? `; and watch: ${watch}` : ''}`,
      why: `Of ${r.b.n} analogs, ${r.b.k} (${Math.round((r.b.analog || 0) * 100)}%) made this move first within 5 sessions vs ${Math.round(r.b.all * 100)}% of all ${r.b.allN} weeks since ${an.since}; the analogs ${r.b.analog > r.b.all ? 'favour' : 'do not favour'} this side${tilt ? `, council tilt ${sg(tilt * 50, 0, ' pts')} applied` : ''}.` });
  }
  // H2: the range for the week: every close stays inside last week's range (or the nearest levels when price sits outside it)
  const wHi = gl.list.find((l) => l.kind === 'week' && /high/.test(l.label)), wLo = gl.list.find((l) => l.kind === 'week' && /low/.test(l.label));
  let lo = wLo, hi = wHi; if (!lo || !hi || px >= hi.price || px <= lo.price) { lo = nearestLevel(gl, 'below', 0.8); hi = nearestLevel(gl, 'above', 0.8); }
  if (lo && hi) {
    const rLo = lo.price / px - 1, rHi = hi.price / px - 1, b = blend(freqOf(G, (p) => stayHit(p, 5, rLo, rHi)), freqOf(GA, (p) => stayHit(p, 5, rLo, rHi)));
    out.push({ id: `hyp:${week}:H2`, slot: 'H2', horizon: 'week', asset: 'gold', kind: 'stayInside', lo: +lo.price.toPrecision(8), hi: +hi.price.toPrecision(8), by: by5, p: b.p,
      claim: `Gold's daily closes stay between ${fmt(lo.price)} (${lo.label.toLowerCase()}) and ${fmt(hi.price)} (${hi.label.toLowerCase()}) every day through ${by5}`,
      base: b, invalid: `any daily close outside ${fmt(lo.price)}-${fmt(hi.price)}`,
      why: `${b.k} of ${b.n} analogs stayed inside the same distances for 5 sessions vs ${Math.round(b.all * 100)}% of all weeks: ${b.p >= 0.5 ? 'a contained week is the more likely path' : 'a break of the range is the more likely path'}.` });
  }
  // H3: the dollar over the month, from the analogs' DXY outcomes
  if (dl) {
    const D = an._paths.map((p) => p.d), DA = an._all.map((p) => p.d), b = blend(freqOf(D, (p) => p[19] > 0), freqOf(DA, (p) => p[19] > 0)), up = b.p >= 0.5, P = up ? b.p : +(1 - b.p).toFixed(2);
    const byD = addSessions(Date.parse(dl.asOf + 'T00:00:00Z') / 1000, 20);
    out.push({ id: `hyp:${week}:H3`, slot: 'H3', horizon: 'month', asset: 'dxy', kind: up ? 'pairUp' : 'pairDown', level: +dl.px.toPrecision(8), by: byD, p: P,
      claim: `DXY closes ${byD} ${up ? 'above' : 'below'} ${dl.px.toFixed(2)} (the latest close)`,
      base: { ...b, p: P, analog: b.analog == null ? null : r2(up ? b.analog : 1 - b.analog), all: r2(up ? b.all : 1 - b.all), k: up ? b.k : b.n - b.k },
      invalid: `DXY ${up ? 'below' : 'above'} ${(dl.px * (up ? 0.985 : 1.015)).toFixed(2)} (${up ? '−' : '+'}1.5%) on a close`,
      why: `${up ? b.k : b.n - b.k} of ${b.n} analogs saw the DXY ${up ? 'higher' : 'lower'} 20 sessions on vs ${Math.round((up ? b.all : 1 - b.all) * 100)}% of all weeks. Gold usually moves the other way, except in stress (both bid).` });
  }
  return out.map((x) => ({ ...x, src: 'veteran hypothesis', claimType: 'prospective prediction' }));
}

// ---- 1. key insights ------------------------------------------------------------------------------------------------------
export const ordinal = (n) => { if (n == null) return 'n/a'; const m = n % 100, t = n % 10; return `${n}${m >= 11 && m <= 13 ? 'th' : t === 1 ? 'st' : t === 2 ? 'nd' : t === 3 ? 'rd' : 'th'}`; };
const lastOf = (s, now) => { const i = idxAt(s || [], now); return i < 0 ? null : s[i]; };
const chgOver = (s, now, days) => { const a = lastOf(s, now), b = a && lastOf(s, a.t - days * DAY); return a && b ? a.v - b.v : null; };
export function insights({ S = {}, fc, cot, expectations = [], an, gl, now }) {
  const out = [], z = (k) => (an && an.zNow ? an.zNow[k] : null), when = (iso) => String(iso).slice(0, 16).replace('T', ' ') + ' UTC';
  const add = (o) => out.push({ lean: 0, fx: null, ...o });
  // the week's scheduled release (red-folder playbook), expectation captured before it
  const evs = ((fc && fc.playbook) || []).filter((e) => { const t = Date.parse(e.at) / 1000; return t >= now && t <= now + 7 * DAY; });
  const big = evs.find((e) => /\b(CPI|Non-?Farm|NFP|FOMC|Federal Funds|PCE|Employment Change)\b/i.test(e.title)) || evs[0];
  if (big) {
    const t = Date.parse(big.at) / 1000, days = (t - now) / DAY, rec = (expectations || []).find((r) => r.scheduledUtc && Date.parse(r.scheduledUtc) / 1000 === t && r.event === big.title);
    const sc = Object.fromEntries((big.scenarios || []).map((s) => [s.name, s.moves || {}])), others = evs.filter((e) => e !== big).map((e) => e.title);
    add({ k: 'event', score: 3.2 - days / 4, event: { title: big.title, country: big.country || null, at: new Date(t * 1000).toISOString(), consensus: big.consensus ?? null, previous: big.previous ?? null, goldMovePct: big.expMovePct && big.expMovePct.gold != null ? big.expMovePct.gold : null },
      title: `${big.country || ''} ${big.title} on ${new Date(t * 1000).toUTCString().slice(0, 11)} is the week's pivot`.trim(),
      evidence: [{ text: `${big.title} at ${when(big.at)}: consensus ${big.consensus ?? 'n/a'}, previous ${big.previous ?? 'n/a'}`, asOf: rec ? rec.expectation.capturedAtUtc.slice(0, 16).replace('T', ' ') + ' UTC (captured before the release)' : 'not captured yet', source: 'economic calendar (Forex Factory feed via the strategist); veteran-expectations.json' },
        ...(big.expMovePct && big.expMovePct.gold != null ? [{ text: `typical gold day move ${big.expMovePct.gold}% (${(big.expBasis && big.expBasis.gold) || 'strategist'})`, asOf: isoDay(now), source: 'macro/forecast.json playbook' }] : []),
        ...(others.length ? [{ text: `also this week: ${others.join(', ')}`, asOf: isoDay(now), source: 'calendar' }] : [])],
      why: `Hot (above ${big.consensus ?? 'consensus'}) → gold ${sc.hot ? sc.hot.gold : 'down'}; cool → gold ${sc.cool ? sc.cool.gold : 'up'}. The path runs through real yields and the dollar: a hot print helps gold only if real yields do not reprice higher.`,
      fx: sc.hot ? `Hot → EUR/USD ${sc.hot.eurusd} (DXY ${sc.hot.eurusd === 'down' ? 'up' : 'down'}), USD/JPY ${sc.hot.usdjpy}; cool the reverse.` : null,
      change: `the print against the captured ${big.consensus ?? 'expectation'} and${/CPI/.test(big.title) ? ' the release-day 10Y TIPS move against the 6.11 bp typical CPI day (2022-24 study)' : ' the reaction of real yields and the dollar in the first hours'}` });
  }
  // real yields
  const ry = lastOf(S.DFII10, now), ry4 = chgOver(S.DFII10, now, 28);
  if (ry && ry4 != null) { const bp = Math.round(ry4 * 100);
    add({ k: 'real', score: Math.max(0.3, Math.abs(z('ry4w') ?? bp / 15)), lean: bp <= -10 ? 1 : bp >= 10 ? -1 : 0,
      title: `Real yields ${bp <= -10 ? 'fell' : bp >= 10 ? 'rose' : 'flat'} ${Math.abs(bp)} bp in 4 weeks (10Y TIPS ${ry.v.toFixed(2)}%)`,
      evidence: [{ text: `10Y TIPS ${ry.v.toFixed(2)}%, ${sg(bp, 0, ' bp')} over 4 weeks${z('ry4w') != null ? ` (z ${sg(z('ry4w'), 1)} vs every week since ${an.since})` : ''}`, asOf: isoDay(ry.t), source: 'FRED DFII10 (US Treasury real par curve)' }],
      why: 'Real yields are gold\'s opportunity cost: a falling 4-week change is the strongest single input of the tested Gold Macro Score (2007-26). A high level caps the upside; the change sets the near-term lean.',
      fx: 'Falling US real yields usually weigh on the dollar (EUR/USD up, USD/JPY down) unless risk-off demand for dollars dominates.',
      change: `10Y TIPS back above ${(ry.v + 0.15).toFixed(2)}% (+15 bp)` }); }
  // the dollar
  const dx = lastOf(S.dxy, now), dx4 = dx && lastOf(S.dxy, dx.t - 28 * DAY);
  if (dx && dx4) { const pc = (dx.v / dx4.v - 1) * 100;
    add({ k: 'usd', score: Math.max(0.3, Math.abs(z('dxy4w') ?? pc)), lean: pc <= -1 ? 1 : pc >= 1 ? -1 : 0,
      title: `Dollar ${pc >= 0.5 ? 'firmer' : pc <= -0.5 ? 'weaker' : 'flat'} over 4 weeks (DXY ${dx.v.toFixed(2)}, ${sg(pc, 2, '%')})`,
      evidence: [{ text: `DXY ${dx.v.toFixed(2)}, ${sg(pc, 2, '%')} over 4 weeks${z('dxy4w') != null ? ` (z ${sg(z('dxy4w'), 1)})` : ''}`, asOf: isoDay(dx.t), source: 'ICE DXY formula on the council\'s OANDA daily FX closes' }],
      why: 'Gold is priced in dollars: a weaker DXY lifts it mechanically and through foreign demand. EUR is 57.6% of the DXY, so EUR/USD is its mirror.',
      fx: `DXY ${pc >= 0 ? 'up' : 'down'} 4 weeks means EUR/USD ${pc >= 0 ? 'down' : 'up'}, the majors against the USD ${pc >= 0 ? 'softer' : 'firmer'}.`,
      change: `DXY through ${(dx.v * (pc >= 0 ? 0.985 : 1.015)).toFixed(2)} (${pc >= 0 ? '−' : '+'}1.5%) would turn the dollar channel` }); }
  // funding and stress gauges
  const vix = lastOf(S.VIXCLS, now), vx3 = lastOf(S.VXVCLS, now), hy = lastOf(S.BAMLH0A0HYM2, now), hy1 = chgOver(S.BAMLH0A0HYM2, now, 7), sofr = lastOf(S.SOFR, now), effr = lastOf(S.EFFR, now);
  if (vix) { const ts = vx3 && vx3.t === vix.t && vx3.v > 0 ? vix.v / vx3.v : null, fund = sofr && effr && sofr.t === effr.t ? Math.round((sofr.v - effr.v) * 100) : null, hyBp = hy1 == null ? null : Math.round(hy1 * 100);
    const sc = fund != null && fund >= 15 ? 2.6 : ts != null && ts > 1 ? 2.2 : vix.v >= 25 ? 1.8 : hyBp != null && hyBp >= 15 ? 1.6 : 0.4;
    const stress = sc >= 1.6, ev = [{ text: `VIX ${vix.v.toFixed(1)}${ts != null ? `, VIX/VIX3M ${ts.toFixed(2)} (${ts > 1 ? 'inverted' : 'normal'})` : ''}`, asOf: isoDay(vix.t), source: 'Cboe via FRED VIXCLS / VXVCLS' }];
    if (hy) ev.push({ text: `HY OAS ${hy.v.toFixed(2)}%${hyBp != null ? `, ${sg(hyBp, 0, ' bp')} on the week` : ''}`, asOf: isoDay(hy.t), source: 'FRED BAMLH0A0HYM2 (ICE BofA)' });
    if (fund != null) ev.push({ text: `SOFR − EFFR ${fund} bp`, asOf: isoDay(sofr.t), source: 'NY Fed SOFR / EFFR via FRED' });
    add({ k: 'stress', score: sc, title: stress ? `Stress gauges are lit (VIX ${vix.v.toFixed(0)}${ts != null && ts > 1 ? ', curve inverted' : ''}), funding ${fund != null && fund >= 15 ? 'tight' : 'still calm'}` : `Stress gauges calm (VIX ${vix.v.toFixed(0)})`,
      evidence: ev, why: stress ? 'In stress gold is often sold first for cash (margin calls), then bought as a haven: expect wider swings both ways, not a direction. Calm funding (SOFR − EFFR small) means a dash for cash is less likely.' : 'No stress premium: gold trades on rates and the dollar.',
      fx: fc && fc.regime && fc.regime.smile === 'left' ? 'Dollar Smile left side: the USD tends to be bid in stress, so gold and the DXY can rise together.' : null,
      change: stress ? 'VIX/VIX3M back below 1 ends the stress read; SOFR − EFFR above 15 bp would make it a funding squeeze (gold sold for cash)' : 'VIX above 25 or an inverted VIX curve' }); }
  // positioning (CFTC COT), with the majors' signals that passed the desk's test
  const gm = cot && cot.markets && cot.markets.find((m) => m.k === 'gold' && !m.missing);
  if (gm) { const edges = cot.markets.filter((m) => !m.missing).flatMap((m) => (m.signals || []).filter((s) => s.tested && s.tested.edge).map((s) => ({ m, s })));
    const crowd = gm.pct == null ? 'not ranked yet' : gm.pct >= 80 ? 'crowded long' : gm.pct <= 20 ? 'light' : 'middle of its range';
    const pub = isoDay(Date.parse(gm.asOf + 'T00:00:00Z') / 1000 + 3 * DAY);
    add({ k: 'pos', score: Math.max(0, Math.abs((gm.pct ?? 50) - 50) - 25) / 12.5 + Math.abs(gm.z || 0) / 2 + edges.length * 0.6 + 0.2,
      title: `Speculators' gold length is ${crowd} (${ordinal(gm.pct)} percentile of 3 years)${edges.length ? `; ${edges.length} tested COT signal${edges.length === 1 ? '' : 's'} on the majors` : ''}`,
      evidence: [{ text: `managed money net ${Math.round(gm.net / 1000)}k, ${sg(gm.chg1 / 1000, 1, 'k')} on the week, ${sg(gm.chg4 / 1000, 1, 'k')} over 4 weeks${gm.z != null ? ` (${sg(gm.z, 2)} sd)` : ''}`, asOf: `${gm.asOf} (positions; published about ${pub})`, source: 'CFTC Disaggregated COT' },
        ...edges.map(({ m, s }) => ({ text: `${m.name}: ${s.text} (tested ${s.tested.n} times since 2020, right ${Math.round(s.tested.win * 100)}%)`, asOf: m.asOf, source: 'CFTC TFF COT; council/cot.mjs test' }))],
      why: gm.pct != null && gm.pct >= 80 ? 'Crowded longs make gold fragile to a hawkish surprise: forced selling amplifies the drop.' : gm.pct != null && gm.pct <= 20 ? 'Light positioning leaves room for funds to buy back; a dovish surprise can travel further.' : 'Positioning is not stretched either way: it neither amplifies nor cushions a surprise. COT sizes and times; it never sets direction (no 4-week edge in the 2007-26 test).',
      fx: edges.length ? edges.map(({ m, s }) => `${m.name} ${s.pairDir > 0 ? 'up' : 'down'} (COT ${s.kind})`).join('; ') : null,
      change: 'the next COT (Friday) moving net length into the top or bottom 20% of its 3-year range' }); }
  // the policy path: the 2Y and the central-bank wire (headlines only; the council does not grade tone)
  const y2 = lastOf(S.DGS2, now), y24 = chgOver(S.DGS2, now, 28), pol = ((fc && fc.news) || []).filter((n) => n.policy && Date.parse(n.at) / 1000 >= now - 7 * DAY)[0];
  if (y2 && y24 != null) { const bp = Math.round(y24 * 100);
    add({ k: 'policy', score: Math.abs(z('y2_4w') ?? bp / 15) * 0.8 + (pol ? 0.3 : 0), lean: bp <= -15 ? 1 : bp >= 15 ? -1 : 0,
      title: `Policy path: the 2Y ${bp <= -5 ? 'fell' : bp >= 5 ? 'rose' : 'held'} ${Math.abs(bp)} bp in 4 weeks (${y2.v.toFixed(2)}%)`,
      evidence: [{ text: `2Y Treasury ${y2.v.toFixed(2)}%, ${sg(bp, 0, ' bp')} over 4 weeks`, asOf: isoDay(y2.t), source: 'FRED DGS2 (US Treasury par curve)' },
        ...(pol ? [{ text: `${pol.src}: ${pol.title}`, asOf: String(pol.at).slice(0, 10), source: `${pol.src} press feed (read the wording yourself; the council does not grade tone)` }] : [])],
      why: 'The 2Y is the market\'s read of the policy path: cuts being priced (a falling 2Y) support gold; a priced cut is not a dovish surprise, the change is the signal.',
      fx: 'A falling US 2Y against a steady EA 2Y narrows the rate gap: EUR/USD support.', change: `the 2Y ${bp <= 0 ? 'back up' : 'down'} 15 bp` }); }
  // where price sits (trend tiebreaker) and the tested score
  const gs = fc && fc.goldScore, gc = gl && gl.px, a10 = gl && gl.list.find((l) => /50-day/.test(l.label));
  if (gc && a10) { const d = (gc / a10.price - 1) * 100;
    add({ k: 'price', score: Math.abs(z('vs10w') ?? d / 3) * 0.7 + (gs && gs.ok && gs.score > 0.25 ? 1 : 0), lean: d > 0 ? 1 : -1,
      title: `Gold ${d >= 0 ? 'above' : 'below'} its 10-week average (${sg(d, 1, '%')})${gs && gs.ok ? `; Gold Macro Score ${sg(gs.score, 2)} (${gs.bias})` : ''}`,
      evidence: [{ text: `gold ${gc.toFixed(2)} vs 10-week average ${a10.price.toFixed(0)}${an ? `; ${sg(an.now.offHigh, 1, '%')} from the 52-week closing high` : ''}`, asOf: gl.asOf, source: 'council daily gold candles (OANDA)' },
        ...(gs && gs.ok ? [{ text: `Gold Macro Score ${sg(gs.score, 2)} → ${gs.label}`, asOf: gs.asOf, source: 'council/macroscore.mjs (tested 2007-26, 4-week horizon)' }] : [])],
      why: gs && gs.ok && gs.score > 0.25 ? 'The tested score is on: the only directional engine with a 20-year record (> +0.25 up 69% over 4 weeks).' : 'The tested score shows no edge (auction): price location is a tiebreaker, never the direction.',
      change: `a weekly close ${d >= 0 ? 'below' : 'above'} the 10-week average ${a10.price.toFixed(0)}${gs && gs.ok ? ', or the score crossing +0.25' : ''}` }); }
  // what similar set-ups did next
  if (an && an.stats.gold20.n >= 10) { const s = an.stats.gold20, b = an.base.gold20, diff = s.up - b.up;
    add({ k: 'analogs', score: 0.8 + Math.abs(diff) * 6, lean: diff >= 0.1 ? 1 : diff <= -0.1 ? -1 : 0,
      title: `The ${s.n} closest past set-ups: gold ${s.up >= 0.5 ? 'higher' : 'lower'} 20 sessions on in ${Math.round(s.up * 100)}% (all weeks ${Math.round(b.up * 100)}%)`,
      evidence: [{ text: `20-session median ${sg(s.median, 2, '%')} (middle half ${sg(s.q25, 1, '%')} to ${sg(s.q75, 1, '%')}); 5-session median ${sg(an.stats.gold5.median, 2, '%')}, up ${Math.round(an.stats.gold5.up * 100)}%`, asOf: an.asOf, source: `council daily candles + FRED weekly history, analogs since ${an.since}` }],
      why: 'What gold did after the most similar macro fingerprints. Descriptive, not a tested edge: a difference of under 10 points from all weeks is noise at this sample size.',
      change: 'a week that moves the fingerprint (real yields, the dollar or gold\'s place in its range) changes the analog set' }); }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 6).map((o, i) => ({ rank: i + 1, ...o, score: r2(o.score) }));
}

// ---- the whole briefing ---------------------------------------------------------------------------------------------------
// inp: { S (series map: DFII10, DGS2, VIXCLS, VXVCLS, BAMLH0A0HYM2, SOFR, EFFR, dxy), weekly ({ DFII10, DGS2 } long weekly
// history), gold (closes), goldBars (OHLC), dxy (closes), spx (closes), fc, cot, expectations, outlook, now, week, tilt }
export function briefing(inp) {
  const { S = {}, weekly = {}, gold = [], goldBars = [], dxy = [], spx = [], fc, cot, expectations, outlook: ol, now, week, tilt = 0 } = inp;
  const D = { gold, dxy, spx, ry: mergeSeries(weekly.DFII10, S.DFII10), y2: mergeSeries(weekly.DGS2, S.DGS2) };
  let an = null; try { an = findAnalogs(D, now); } catch (e) { an = null; }
  const extraG = [], extraD = [];
  for (const [h, part] of [['week', ol && ol.week], ['month', ol && ol.month]]) { const r = part && part.list.find((c) => c.kind === 'range' && c.asset === 'gold');
    if (r) { extraG.push({ price: r.lo, label: `${h === 'week' ? 'Week' : 'Month'} call: 60% range low (${r.by})`, kind: 'range60', why: `The veteran's ${h} call: the middle 60% of past ${h === 'week' ? '5' : '20'}-session outcomes ends above this.` }, { price: r.hi, label: `${h === 'week' ? 'Week' : 'Month'} call: 60% range high (${r.by})`, kind: 'range60', why: `The veteran's ${h} call: the middle 60% of past ${h === 'week' ? '5' : '20'}-session outcomes ends below this.` }); } }
  const gpx = (trim(gold, now).at(-1) || {}).v, dpx = (trim(dxy, now).at(-1) || {}).v;
  if (an && gpx) for (const [key, nm] of [['gold5', '5 sessions'], ['gold20', '20 sessions']]) { const s = an.stats[key]; if (s.n) extraG.push({ price: gpx * (1 + s.median / 100), label: `Analogs' median after ${nm}`, kind: 'analog', why: `Where the median of the ${s.n} closest analogs would take gold in ${nm} (${sg(s.median, 2, '%')}); descriptive.` }); }
  if (an && dpx) { const s = an.stats.dxy20; if (s.n) extraD.push({ price: dpx * (1 + s.median / 100), label: 'Analogs\' median after 20 sessions', kind: 'analog', why: `The ${s.n} analogs' median DXY move (${sg(s.median, 2, '%')}).` }); }
  const gl = levelsFor({ bars: goldBars, now, step: 100, dp: 0, name: 'Gold', unit: '$', extra: extraG });
  const dl = levelsFor({ bars: trim(dxy, now).map((o) => ({ t: o.t, o: o.v, h: o.v, l: o.v, c: o.v })), now, step: 1, dp: 2, name: 'DXY', unit: '', extra: extraD, closesOnly: true });
  const ins = insights({ S, fc, cot, expectations, an, gl, now });
  const hyps = hypotheses({ an, gl, dl, now, week, tilt, insights: ins });
  return {
    at: new Date(now * 1000).toISOString(), publicOnly: PUBLIC_ONLY, insights: ins, hypotheses: hyps, levels: { gold: gl, dxy: dl },
    analogs: an ? { ...stripPrivate(an), features: FEATURES, k: an.top.length,
      note: `Descriptive, not a tested edge. Weekly fingerprints since ${an.since} (longer than the 2020+ window the owner's rule asks of trading backtests; ${an.recent.n} of the ${an.top.length} analogs are 2020 or later). Each analog's features use data up to its own Friday; outcomes start at the first close after it (when that Friday's Treasury data were public). Analogs are at least 6 weeks apart and at least 13 weeks before now. Similarity = 1 / (1 + RMS distance of the z-scored features).` } : null,
    method: `Insights are ranked by how unusual each reading is against its own history (z-scores of the 4-week changes), how close the scheduled release is, and how stretched positioning is. Hypothesis probabilities are the analogs' frequency of the same move, shrunk toward the frequency over all weeks (${SHRINK} pseudo-cases), plus half the council tilt for gold, clamped ${P_CLAMP[0] * 100}-${P_CLAMP[1] * 100}%. Every hypothesis is recorded once a week in the calls ledger and scored on its date.`,
  };
}
export function briefingLines(b) {
  if (!b) return [];
  const out = b.insights.slice(0, 3).map((i) => `${i.rank}. ${i.title}`);
  for (const h of b.hypotheses) out.push(`${h.slot} (${Math.round(h.p * 100)}%): ${h.claim}`);
  return out;
}
