// Gold Macro Score (8 Nov 2026, owner: implement the macro-agent-demo skill's directional engine in the Macro member).
// Four drivers pre-specified from the skill's sources (not data-mined), weekly at the Friday close, each z-scored on an
// expanding window (52 weeks minimum, no look-ahead), clipped to ±3 and averaged:
//   1. fall in the 10y real yield over 4 weeks (FRED DFII10)       2. fall in DXY over 4 weeks (log change)
//   3. fall in the 2Y yield over 13 weeks (FRED DGS2)              4. steepening of 10y–2y over 13 weeks (DGS10 − DGS2 = T10Y2Y)
// The skill measured it on ~1,000 weekly observations 2007–2026 (next 4-week gold return): rank IC +0.15 (Newey-West t 2.8),
// positive in 2007-14 / 2015-21 / 2022-26; score > +0.25 → +2.2% over the next 4 weeks, up 69% of the time; ≤ +0.25 → no
// edge; a NEGATIVE score does not predict falls (even < −0.75: +0.2%, up 51%), so the score never gives a SELL. Mapping:
// > +0.5 BUY (High), +0.25..+0.5 BUY (Medium), else AUCTION. Long-or-flat on the score: Sharpe 0.73 vs 0.54 buy-and-hold.
// Here it is a READING for the Macro desk, the brief and the Analyst report: paper only, nothing trades or sizes on it.
// Port of the skill's pandas code: d = concat(series).sort_index().ffill(); w = d.resample('W-FRI').last().loc['2006-06':];
// raw = {-ry.diff(4), -log(dxy).diff(4), -y2.diff(13), cv.diff(13)}; z = ((raw - raw.expanding(52).mean()) / raw.expanding(52).std()).clip(-3, 3);
// score = z.mean(axis=1, skipna=False). The DXY is the ICE formula on the council's own OANDA daily candles (council-data
// research/daily/*.json, since 2002) because the sandbox has no Yahoo; its 4-week log change is the same quantity.
const DAY = 86400;
export const FROM = '2006-06-01', MIN_OBS = 52, CLIP = 3;
export const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// the Friday (00:00 UTC) that labels the week holding t: pandas W-FRI bins run Saturday .. Friday
export const weekEnd = (t) => { const d = Math.floor(t / DAY) * DAY, wd = new Date(d * 1000).getUTCDay(); return d + ((5 - wd + 7) % 7) * DAY; };

// ICE DXY on the five pairs the council has (SEK via EUR: 11.2 / EUR/USD; it cancels in changes). daily: { eurusd: [{t, v}], ... }
export function dxyDaily(daily) {
  const m = {}; for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) for (const b of daily[k] || []) (m[b.t] = m[b.t] || {})[k] = b.v;
  return Object.entries(m).filter(([, r]) => Object.keys(r).length === 5).map(([t, r]) => ({ t: +t, v:
    50.14348112 * Math.pow(r.eurusd, -0.576) * Math.pow(r.usdjpy, 0.136) * Math.pow(r.gbpusd, -0.119) * Math.pow(r.usdcad, 0.091) * Math.pow(11.2 / r.eurusd, 0.042) * Math.pow(r.usdchf, 0.036) }))
    .sort((a, b) => a.t - b.t);
}
// council-data research/daily/<key>.json ({ rows: [[t, o, h, l, c, v]] }) → [{ t, v: close }]
export const dailyRows = (j) => (j && Array.isArray(j.rows) ? j.rows.filter((r) => r && r[4] > 0).map((r) => ({ t: Math.floor(r[0] / DAY) * DAY, v: +r[4] })) : []);

// Several daily series on one calendar (the union of their dates, each forward-filled), then the last value of each
// Saturday..Friday week from `from`: { weeks: [fridayT], cols: { name: [v | null] } }
export function weeklyFrame(series, from = FROM) {
  const names = Object.keys(series), days = new Set();
  for (const n of names) for (const o of series[n]) if (Number.isFinite(o.v)) days.add(Math.floor(o.t / DAY) * DAY);
  const D = [...days].sort((a, b) => a - b); if (!D.length) return { weeks: [], cols: Object.fromEntries(names.map((n) => [n, []])) };
  const fromT = Date.parse(from + 'T00:00:00Z') / 1000, cols = Object.fromEntries(names.map((n) => [n, []])), weeks = [];
  const idx = Object.fromEntries(names.map((n) => [n, 0])), last = Object.fromEntries(names.map((n) => [n, null]));
  const S = Object.fromEntries(names.map((n) => [n, series[n].filter((o) => Number.isFinite(o.v)).map((o) => ({ t: Math.floor(o.t / DAY) * DAY, v: o.v })).sort((a, b) => a.t - b.t)]));
  let w = null;
  for (const d of D) {
    for (const n of names) { const s = S[n]; while (idx[n] < s.length && s[idx[n]].t <= d) last[n] = s[idx[n]++].v; }   // ffill
    const we = weekEnd(d);
    if (we !== w) { w = we; if (we >= fromT) { weeks.push(we); for (const n of names) cols[n].push(last[n]); } }
    else if (we >= fromT) for (const n of names) cols[n][cols[n].length - 1] = last[n];   // the week's last value
  }
  return { weeks, cols };
}
const diffN = (a, n, f = (x, y) => x - y) => a.map((v, i) => (i >= n && v != null && a[i - n] != null ? f(v, a[i - n]) : null));
// expanding z-score with a minimum of `min` observations (pandas expanding(min).mean()/std(), sample std), clipped
export function expandingZ(raw, min = MIN_OBS, clip = CLIP) {
  const out = []; let n = 0, s = 0, s2 = 0;
  for (const v of raw) {
    if (v == null || !Number.isFinite(v)) { out.push(null); continue; }
    n++; s += v; s2 += v * v;
    if (n < min) { out.push(null); continue; }
    const mean = s / n, varS = (s2 - n * mean * mean) / (n - 1), sd = varS > 0 ? Math.sqrt(varS) : 0;
    out.push(sd > 0 ? Math.max(-clip, Math.min(clip, (v - mean) / sd)) : null);
  }
  return out;
}
export function cardOf(score) {
  if (score == null || !Number.isFinite(score)) return { bias: null, conviction: null, label: 'n/a' };
  if (score > 0.5) return { bias: 'BUY', conviction: 'High', label: 'BUY · High' };
  if (score > 0.25) return { bias: 'BUY', conviction: 'Medium', label: 'BUY · Medium' };
  return { bias: 'AUCTION', conviction: null, label: 'AUCTION (no macro edge)' };
}
const r2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : +(+x).toFixed(d));
// daily: { ry (DFII10), y2 (DGS2), y10 (DGS10), dxy } as [{ t, v }]; gold (optional, daily closes) for the 10-week tiebreaker
export function goldMacroScore({ ry, y2, y10, dxy, gold = null }, { from = FROM, minObs = MIN_OBS, asOf = Infinity } = {}) {
  const cut = (s) => (s || []).filter((o) => o.t <= asOf);
  const F = weeklyFrame({ ry: cut(ry), y2: cut(y2), y10: cut(y10), dxy: cut(dxy) }, from), W = F.weeks, C = F.cols;
  if (!W.length) return { ok: false, why: 'no data', score: null, ...cardOf(null) };
  const cv = C.y10.map((v, i) => (v != null && C.y2[i] != null ? v - C.y2[i] : null));
  const raw = { ry4w: diffN(C.ry, 4).map((v) => (v == null ? null : -v)), dxy4w: diffN(C.dxy, 4, (a, b) => -(Math.log(a) - Math.log(b))), y2_13w: diffN(C.y2, 13).map((v) => (v == null ? null : -v)), curve13w: diffN(cv, 13) };
  const z = Object.fromEntries(Object.entries(raw).map(([k, a]) => [k, expandingZ(a, minObs)]));
  const keys = Object.keys(raw), score = W.map((_, i) => (keys.every((k) => z[k][i] != null) ? keys.reduce((s, k) => s + z[k][i], 0) / keys.length : null));
  let last = score.length - 1; while (last >= 0 && score[last] == null) last--;
  if (last < 0) { const have = Object.fromEntries(keys.map((k) => [k, z[k].filter((v) => v != null).length])); return { ok: false, why: `fewer than ${minObs} weeks of history for a driver`, have, score: null, weeks: W.length, ...cardOf(null) }; }
  const path = []; for (let i = Math.max(0, last - 5); i <= last; i++) path.push(r2(score[i]));
  // optional tiebreaker from the skill: score > +0.25 and gold above its 10-week average won 70% vs 68% without it
  let trend = null; if (gold && gold.length) { const G = weeklyFrame({ g: cut(gold) }, from).cols.g, j = G.length - 1; if (j >= 9 && G.slice(j - 9, j + 1).every((v) => v != null)) { const m = G.slice(j - 9, j + 1).reduce((s, v) => s + v, 0) / 10; trend = { above10w: G[j] > m, last: r2(G[j]), avg10w: r2(m) }; } }
  const partial = W[last] > (asOf === Infinity ? Math.floor(Date.now() / 1000) : asOf);
  return { ok: true, asOf: isoDay(W[last]), partial, score: r2(score[last]), z: Object.fromEntries(keys.map((k) => [k, r2(z[k][last])])), raw: Object.fromEntries(keys.map((k) => [k, r2(raw[k][last], 4)])),
    path, weeks: last + 1, trend, ...cardOf(score[last]),
    rule: 'direction only, long-or-flat: > +0.5 BUY High, +0.25..+0.5 BUY Medium, else AUCTION; a negative score is not a sell (skill test 2007-26: no short edge). Paper reading; nothing trades on it.' };
}
// one line for the brief / the Analyst report
export function scoreLine(s) {
  if (!s || !s.ok) return `Gold Macro Score: n/a${s && s.why ? ` (${s.why})` : ''}.`;
  const sg = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);
  return `Gold Macro Score ${sg(s.score)} → ${s.label} (real yield 4w z ${sg(s.z.ry4w)}, DXY 4w z ${sg(s.z.dxy4w)}, 2Y 13w z ${sg(s.z.y2_13w)}, curve 13w z ${sg(s.z.curve13w)}; 6-week path ${s.path.map(sg).join(' → ')}; week to ${s.asOf}${s.partial ? ', not closed' : ''}${s.trend ? `; gold ${s.trend.above10w ? 'above' : 'below'} its 10-week average` : ''}). Direction only, never a sell; paper reading.`;
}
