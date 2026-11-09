// Council · COT positioning desk (8 Nov 2026, owner: "COT report could help us as well, like the number of people trading a
// certain pair, and what's the difference from one week to another, a small fundamental edge we can use").
//
// Reads the CFTC Commitments of Traders for the council's markets every macro round (cached: the report is weekly) and
// writes macro/cot.json: per market the speculators' net position, its week-on-week and 4-week change, the number of
// speculative traders long and short and how that changed, open interest, and where the net sits in its 3-year range.
// Financial futures (currencies, indices) use the Traders in Financial Futures report: speculators = leveraged funds.
// Metals use the Disaggregated report: speculators = managed money.
//
// Then it measures, on the council's own daily prices since 2020, whether two pre-specified COT signals had an edge:
//   * extreme   (contrarian): net at or above the 90th percentile of the prior 3 years = crowded long → expect down;
//                             at or below the 10th = crowded short → expect up.
//   * flow      (follow): the week's change in net is 1.5+ standard deviations of the prior year's weekly changes →
//                         funds are moving hard; expect the price to follow over the next 1 and 4 weeks.
// Returns start at the first daily candle that opens after report date + 6 days (the Monday after): holiday weeks publish on Monday
// instead of Friday, so starting earlier could use prices from before the report was public (9 Nov audit). Conservative by design.
// A signal counts as an edge only with 15+ cases, a hit rate 8+ points above that market's base rate and t >= 2, where t allows for
// overlapping windows (weekly signals, 20-day returns: neighbours share up to 15 of their 20 days; 9 Nov data audit).
// Data audit (9 Nov, against council-data macro/cot-raw.json, 409 weeks x 11 markets, no duplicate or missing week):
//   * the daily files carry OANDA's Sunday-evening stub (~400 since 2019), which counted as a trading day: "5 days" was ~4 and
//     "20" ~17; weekend candles are now dropped (`weekdays`).
//   * reports with as-of dates in the 2025 shutdown backlog (`LATE`) were published weeks late, not 6 days after: shown on the desk
//     but never tested (that was look-ahead).
//   * a report is public from the first Monday strictly after its as-of date (`knownAt`: Tuesday +6 = RELEASE_LAG; the holiday-week
//     Monday as-of dates 2020-12-21, 2023-07-03, 2025-11-10 get +7, so every week enters at the same Tuesday close).
//   * 20-day returns of weekly signals overlap, which inflated t (CHF and GBP "extreme" read t 3.2-3.4, edge true); `overlapT`.
//   * "extreme" is tested only with a full 3-year history behind the percentile (2020-21 used 1-2 years).
//   * a value of null / blank / '.' parsed as 0; a change across a missing week counted as one week's flow; a failed half of a
//     fetch dropped that report's markets from the cache for 12 hours.
// Per market `edge` = the pre-registered study (research/edge/cot-positioning): "tested" only for a cell that passed in and out of
// sample, "none" when tested and nothing passed; a signal's `tested.edge` also needs the study's matching cell.
// Paper only: information for the desk; it changes no rule, size or trade.
// Usage: node council/cot.mjs [dataDir]
import fs from 'node:fs';
import path from 'node:path';

const DAY = 86400;
export const RELEASE_LAG = 6;   // days from the Tuesday report date to the latest normal publication (holiday Monday)
// Reports the CFTC published late: the 1 Oct - 12 Nov 2025 shutdown stopped the COT and the backlog came out on a catch-up
// schedule. The window is deliberately wide (inclusive as-of dates); these weeks are shown but never enter a test.
export const LATE = [{ from: '2025-09-30', to: '2026-01-27', why: 'US government shutdown backlog: published on a catch-up schedule, not the Friday after' }];
const isoD = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const isLate = (t) => { const d = isoD(t); return LATE.some((w) => d >= w.from && d <= w.to); };
// 00:00 UTC of the first Monday strictly after the as-of date: Tuesday +6 (= RELEASE_LAG), holiday-week Monday +7, Wednesday +5
export function knownAt(t) { const dow = new Date(t * 1000).getUTCDay(); return t + (((8 - dow) % 7) || 7) * DAY; }
// weekday candles only: OANDA's Sunday-evening stub (and any Saturday row) is not a trading day
export const weekdays = (px) => (px || []).filter((o) => { const d = new Date(o.t * 1000).getUTCDay(); return d !== 0 && d !== 6 && o.v > 0 && isFinite(o.v); });
const FROM = '2019-01-01';   // 3-year lookback ahead of the 2020+ test window
export const MARKETS = [
  { k: 'gold', name: 'Gold', code: '088691', ds: 'dis', px: 'xau', sign: 1 },
  { k: 'silver', name: 'Silver', code: '084691', ds: 'dis', px: 'xag', sign: 1 },
  { k: 'eur', name: 'EUR/USD', code: '099741', ds: 'tff', px: 'eurusd', sign: 1 },
  { k: 'gbp', name: 'GBP/USD', code: '096742', ds: 'tff', px: 'gbpusd', sign: 1 },
  { k: 'jpy', name: 'USD/JPY', code: '097741', ds: 'tff', px: 'usdjpy', sign: -1 },
  { k: 'aud', name: 'AUD/USD', code: '232741', ds: 'tff', px: 'audusd', sign: 1 },
  { k: 'nzd', name: 'NZD/USD', code: '112741', ds: 'tff', px: 'nzdusd', sign: 1 },
  { k: 'cad', name: 'USD/CAD', code: '090741', ds: 'tff', px: 'usdcad', sign: -1 },
  { k: 'chf', name: 'USD/CHF', code: '092741', ds: 'tff', px: 'usdchf', sign: -1 },
  { k: 'nq', name: 'Nasdaq 100', code: '209742', ds: 'tff', px: 'nas100', sign: 1 },
  { k: 'es', name: 'S&P 500', code: '13874A', ds: 'tff', px: 'spx500', sign: 1 },
];
const URL_ = { tff: 'https://publicreporting.cftc.gov/resource/gpe5-46if.json', dis: 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json' };

// field names differ between the reports (and have changed over the years): match by pattern, first hit wins
// a value counts only when it is a real number: null, blank, '.' (CFTC's "too few traders") and NaN stay null (+null and +'' are 0)
export const num = (v) => (v == null || (typeof v === 'string' && !v.trim()) || typeof v === 'boolean' ? null : isFinite(+v) ? +v : null);
const find = (r, res) => { for (const re of res) { const k = Object.keys(r).find((x) => re.test(x)); const v = k != null ? num(r[k]) : null; if (v != null) return v; } return null; };
const sum2 = (a, b) => (a == null || b == null ? null : a + b);
export function parseRow(r, ds) {
  const t = Date.parse(String(r.report_date_as_yyyy_mm_dd || '').slice(0, 10) + 'T00:00:00Z') / 1000; if (!isFinite(t)) return null;
  const who = ds === 'dis' ? 'm_money' : 'lev_money';
  const L = find(r, [new RegExp(`^${who}_positions_long(_all)?$`)]), S = find(r, [new RegExp(`^${who}_positions_short(_all)?$`)]);
  if (L == null || S == null) return null;
  // commercials (the other side): TFF dealer / intermediary; Disaggregated producer / merchant plus swap dealers ("swap__positions_short_all")
  const cL = ds === 'dis' ? sum2(find(r, [/^prod_merc_positions_long(_all)?$/]), find(r, [/^swap_+positions_long(_all)?$/])) : find(r, [/^dealer_positions_long(_all)?$/]);
  const cS = ds === 'dis' ? sum2(find(r, [/^prod_merc_positions_short(_all)?$/]), find(r, [/^swap_+positions_short(_all)?$/])) : find(r, [/^dealer_positions_short(_all)?$/]);
  return { t, code: String(r.cftc_contract_market_code || '').trim(), long: L, short: S, net: L - S,
    tL: find(r, [new RegExp(`^traders_${who}_long(_all)?$`)]), tS: find(r, [new RegExp(`^traders_${who}_short(_all)?$`)]),
    oi: find(r, [/^open_interest_all$/, /^open_interest$/]), ...(cL != null && cS != null ? { cL, cS } : {}) };
}

export async function fetchAll(fetchImpl = fetch) {
  const out = {}, src = {};
  for (const ds of ['tff', 'dis']) {
    const codes = MARKETS.filter((m) => m.ds === ds).map((m) => `'${m.code}'`).join(',');
    const q = `${URL_[ds]}?$where=${encodeURIComponent(`cftc_contract_market_code in(${codes}) AND report_date_as_yyyy_mm_dd >= '${FROM}'`)}&$order=${encodeURIComponent('report_date_as_yyyy_mm_dd ASC')}&$limit=20000`;
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 30000);
      const r = await fetchImpl(q, { signal: ctl.signal, headers: { 'User-Agent': 'meridian-council/1.0' } }); clearTimeout(to);
      const j = r.ok ? await r.json() : null; if (!Array.isArray(j)) { src[ds] = `failed (HTTP ${r.status})`; continue; }
      let ok = 0; for (const row of j) { const p = parseRow(row, ds); if (!p) continue; ok++; (out[p.code] = out[p.code] || []).push(p); }
      src[ds] = ok ? `ok (${ok} rows)` : `parsed 0 of ${j.length} rows; keys: ${j[0] ? Object.keys(j[0]).filter((k) => /money|trader|open_int/.test(k)).join(',') : 'none'}`;
    } catch (e) { src[ds] = `failed (${e.name === 'AbortError' ? 'timeout' : e.message})`; }
  }
  for (const k of Object.keys(out)) { const by = new Map(); for (const r of out[k]) { const o = by.get(r.t); if (!o || (r.oi || 0) > (o.oi || 0)) by.set(r.t, r); } out[k] = [...by.values()].sort((a, b) => a.t - b.t); }
  return { rows: out, src };
}

const pctile = (arr, v) => (arr.length ? Math.round(arr.filter((x) => x <= v).length / arr.length * 100) : null);
const sd = (a) => { if (a.length < 2) return null; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
// per-week features with no look-ahead: the percentile uses the prior 156 weeks (shown from 52; `pctWeeks` says how many), the
// 1-year percentile the prior 52, the flow z the prior 52 weekly changes. Rows more than GAP apart are not consecutive weeks: the
// change across them is left out (a missed report would otherwise read as one week's flow).
const GAP = 10 * DAY, FULL = 156;
export function features(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], prev = i > 0 && r.t - rows[i - 1].t <= GAP ? rows[i - 1] : null, p4 = i >= 4 && r.t - rows[i - 4].t <= 31 * DAY ? rows[i - 4] : null;
    const hist = rows.slice(Math.max(0, i - 156), i).map((x) => x.net), h1 = hist.slice(-52);
    const chgs = []; for (let j = Math.max(1, i - 52); j < i; j++) if (rows[j].t - rows[j - 1].t <= GAP) chgs.push(rows[j].net - rows[j - 1].net);
    const chg1 = prev ? r.net - prev.net : null, s = chgs.length >= 2 ? sd(chgs) : null;
    const comm = r.cL != null && r.cS != null ? r.cL - r.cS : null, ch = comm == null ? [] : rows.slice(Math.max(0, i - 156), i).filter((x) => x.cL != null && x.cS != null).map((x) => x.cL - x.cS);
    out.push({ ...r, chg1, chg4: p4 ? r.net - p4.net : null, pct: hist.length >= 52 ? pctile(hist, r.net) : null, pctWeeks: hist.length,
      pct1y: h1.length >= 52 ? pctile(h1, r.net) : null, z: chg1 != null && s ? +(chg1 / s).toFixed(2) : null, zWeeks: chgs.length,
      comm, cpct: comm != null && ch.length >= 52 ? pctile(ch, comm) : null, late: isLate(r.t),
      tLchg: prev && r.tL != null && prev.tL != null ? r.tL - prev.tL : null, tSchg: prev && r.tS != null && prev.tS != null ? r.tS - prev.tS : null,
      oiChg: prev && r.oi != null && prev.oi != null ? r.oi - prev.oi : null });
  }
  return out;
}
// the signal a week's features give, in the market's own direction (+1 up, −1 down, 0 none)
export const sigExtreme = (f) => (f.pct == null ? 0 : f.pct >= 90 ? -1 : f.pct <= 10 ? 1 : 0);
export const sigFlow = (f) => (f.z == null ? 0 : f.z >= 1.5 ? 1 : f.z <= -1.5 ? -1 : 0);

// index of the entry candle: the first weekday candle that opens after the report became public (its close is the entry price)
export function entryIdx(px, t) { const t0 = knownAt(t); let lo = 0, hi = px.length; while (lo < hi) { const m = (lo + hi) >> 1; if (px[m].t > t0) hi = m; else lo = m + 1; } return lo < px.length ? lo : -1; }
// forward return of the quoted pair over h weekday closes from the entry, in the futures' direction (px: weekday candles)
function fwd(px, t, h, sign) { const i = entryIdx(px, t); if (i < 0 || i + h >= px.length) return null; return { r: sign * (px[i + h].v / px[i].v - 1), i }; }
// t of a mean whose observations overlap: cases i and j (entry candles k_i, k_j) share max(0, 1 - |k_i - k_j| / h) of their window,
// so their covariance counts with that weight (Bartlett kernel on the weekday calendar; the plain mean / (sd / sqrt(n)) when no
// windows overlap). xs and ks in time order.
export function overlapT(xs, ks, h) {
  const n = xs.length; if (n < 3) return null;
  const m = xs.reduce((a, b) => a + b, 0) / n, d = xs.map((x) => x - m); let v = 0;
  for (let i = 0; i < n; i++) { v += d[i] * d[i]; for (let j = i + 1; j < n && ks[j] - ks[i] < h; j++) v += 2 * (1 - (ks[j] - ks[i]) / h) * d[i] * d[j]; }
  v /= n * (n - 1); return v > 0 ? m / Math.sqrt(v) : null;
}
export function evaluate(feats, pxIn, sign, { from = Date.parse('2020-01-01T00:00:00Z') / 1000 } = {}) {
  const res = {}, px = weekdays(pxIn);
  // an "extreme" counts in the test only with a full 3-year history behind its percentile (the desk shows it from 1 year; in
  // 2020-21 the "3-year" percentile was a 1-2 year one), the same rule as the pre-registered study
  const full = (f) => f.pctWeeks == null || f.pctWeeks >= FULL;
  for (const [name, fn] of [['extreme', (f) => (full(f) ? sigExtreme(f) : 0)], ['flow', sigFlow]]) {
    for (const h of [5, 20]) {
      const all = [], hits = [], ks = [];
      for (const f of feats) { if (f.t < from || f.late) continue; const o = fwd(px, f.t, h, sign); if (o == null) continue; all.push(o.r); const s = fn(f); if (s) { hits.push(s * o.r); ks.push(o.i); } }
      if (!all.length) continue;
      const base = all.filter((r) => r > 0).length / all.length, n = hits.length;
      const win = n ? hits.filter((r) => r > 0).length / n : null, avg = n ? hits.reduce((a, b) => a + b, 0) / n : null;
      // base for a two-sided signal: half the time it bets up, half down; the fair comparison is 50% and the mean drift is small
      const t = overlapT(hits, ks, h);
      const edge = n >= 15 && win != null && win >= Math.max(base, 1 - base) + 0.08 && t != null && t >= 2;
      res[`${name}${h}`] = { n, win: win == null ? null : +win.toFixed(3), avg: avg == null ? null : +(avg * 100).toFixed(2), t: t == null ? null : +t.toFixed(2), base: +base.toFixed(3), edge };
    }
  }
  return res;
}

// the pre-registered study's per-market reading (research/edge/cot-positioning/result.json `desk`), as the desk shows it
export function edgeOf(study, k) {
  if (!study || !study.desk) return { status: 'untested', text: 'edge: untested (no pre-registered study read)' };
  const d = study.desk[k], topic = study.topic || 'cot-positioning';
  if (!d) return { status: 'untested', study: topic, text: 'edge: untested (not in the pre-registered study)' };
  const passed = Array.isArray(d.passed) ? d.passed : [];
  return { status: passed.length ? 'tested' : 'none', study: topic, verdict: (study.verdict && study.verdict.verdict) || null, window: study.window || null, passed, ic: d.ic || null,
    text: passed.length ? `edge: tested (${passed.map((p) => p.label).join('; ')})` : `edge: none (pre-registered test${study.window ? ` ${study.window}` : ''}: nothing passed in and out of sample)` };
}
let STUDY;
export function loadStudy() {
  if (STUDY !== undefined) return STUDY;
  try { STUDY = JSON.parse(fs.readFileSync(new URL('../research/edge/cot-positioning/result.json', import.meta.url), 'utf8')); } catch (e) { STUDY = null; }
  return STUDY;
}

export function build(rowsByCode, pxByKey, { study = null } = {}) {
  const markets = [];
  for (const m of MARKETS) {
    const rows = rowsByCode[m.code] || []; if (rows.length < 10) { markets.push({ k: m.k, name: m.name, missing: true }); continue; }
    const F = features(rows), cur = F[F.length - 1], px = pxByKey[m.px] || [];
    const tests = px.length ? evaluate(F, px, m.sign) : null;
    // the desk's whole-sample test is in sample; with the pre-registered study read, a signal is an edge only when the study's
    // matching cell for this market (extreme ↔ H4, flow ↔ H3; 5 days ↔ 1w, 20 ↔ 4w) also passed in and out of sample
    if (tests && study && study.desk) {
      const passed = new Set(((study.desk[m.k] || {}).passed || []).map((p) => p.id));
      for (const [key, x] of Object.entries(tests)) { const cell = `${key.startsWith('extreme') ? 'H4' : 'H3'}-${key.endsWith('20') ? '4w' : '1w'}`;
        x.deskRule = x.edge; x.study = passed.has(cell) ? `passed ${cell}` : `not confirmed (${cell})`; x.edge = x.edge && passed.has(cell); }
    }
    const sigs = [];
    const e = sigExtreme(cur), fl = sigFlow(cur);
    // directions are said in the quoted pair's terms: for USD/JPY, USD/CAD, USD/CHF the futures are the other currency (9 Nov fix)
    const fut = m.sign < 0 ? m.name.slice(4) : null, pairWay = (d) => `${m.name} ${d * m.sign > 0 ? 'up' : 'down'}`;
    if (e) sigs.push({ kind: 'extreme', dir: e, pairDir: e * m.sign, text: `Speculators crowded ${e < 0 ? 'long' : 'short'}${fut ? ` ${fut}` : ''} (${cur.pct}th percentile of 3 years): contrarian lean ${pairWay(e)}`, tested: tests && tests.extreme20 });
    if (fl) sigs.push({ kind: 'flow', dir: fl, pairDir: fl * m.sign, text: `${fl > 0 ? 'Big buying' : 'Big selling'}${fut ? ` of ${fut}` : ''} by speculators this week (${cur.z > 0 ? '+' : ''}${cur.z} standard deviations): follow, ${pairWay(fl)}`, tested: tests && tests.flow5 });
    const edge = edgeOf(study, m.k);
    markets.push({ k: m.k, name: m.name, who: m.ds === 'dis' ? 'managed money' : 'leveraged funds', asOf: isoD(cur.t), knownAt: isoD(knownAt(cur.t)), ...(cur.late ? { late: true } : {}),
      pct1y: cur.pct1y, pctWeeks: cur.pctWeeks, comm: cur.comm, cpct: cur.cpct, edge, edgeStatus: edge.status, edgeText: edge.text,
      net: cur.net, long: cur.long, short: cur.short, chg1: cur.chg1, chg4: cur.chg4, pct: cur.pct, z: cur.z, tL: cur.tL, tS: cur.tS, tLchg: cur.tLchg, tSchg: cur.tSchg, oi: cur.oi, oiChg: cur.oiChg,
      longShare: cur.long + cur.short ? Math.round(cur.long / (cur.long + cur.short) * 100) : null, quote: m.sign < 0 ? `futures are ${m.name.slice(4)} vs USD, so a long is a bet ${m.name} falls` : null,
      hist: F.slice(-26).map((f) => [new Date(f.t * 1000).toISOString().slice(0, 10), f.net]), signals: sigs, tests });
  }
  return markets;
}

export async function run({ dir = 'data', fetchImpl = fetch, now = Date.now(), log = console.log } = {}) {
  const M = path.join(dir, 'macro'), raw = path.join(M, 'cot-raw.json'); fs.mkdirSync(M, { recursive: true });
  let cache = null; try { cache = JSON.parse(fs.readFileSync(raw, 'utf8')); } catch (e) {}
  let rows = cache && cache.rows, src = cache && cache.src || {};
  if (!cache || now - Date.parse(cache.at) > 12 * 3600e3) {
    const f = await fetchAll(fetchImpl); src = f.src;
    if (Object.keys(f.rows).length) {
      // one report failing (say the Disaggregated) used to replace the cache with the other report's markets alone, so gold and
      // silver vanished for 12 hours; a market the fetch did not return keeps its cached rows, and the cache stays due for a retry
      const got = new Set(Object.keys(f.rows)), want = MARKETS.map((m) => m.code), kept = want.filter((c) => !got.has(c) && rows && rows[c]);
      rows = { ...(rows || {}), ...f.rows };
      if (kept.length) src = { ...src, cached: `kept the cached rows for ${kept.join(', ')}` };
      const full = want.every((c) => got.has(c));
      fs.writeFileSync(raw, JSON.stringify({ at: full ? new Date(now).toISOString() : (cache && cache.at) || new Date(0).toISOString(), src, rows }));
    }
  }
  if (!rows) { log('cot: no data', src); return null; }
  const px = {}; for (const m of MARKETS) { try { const j = JSON.parse(fs.readFileSync(path.join(dir, 'research', 'daily', m.px + '.json'), 'utf8')); px[m.px] = weekdays(j.rows.filter((r) => r && num(r[4]) > 0).map((r) => ({ t: r[0], v: +r[4] }))); } catch (e) {} }
  const study = loadStudy();
  const out = { v: 1, at: new Date(now).toISOString(), paperOnly: true, src, markets: build(rows, px, { study }),
    study: study ? { topic: study.topic, verdict: study.verdict && study.verdict.verdict, headline: study.verdict && study.verdict.headline, window: study.window, link: '/edge-lab.html#cot-positioning' } : null,
    method: 'Speculators = leveraged funds (financial futures, TFF report) or managed money (metals, Disaggregated report). Positions as of Tuesday, published Friday (Monday in holiday weeks). Tests: council daily prices since 2020 (weekdays), returns from the first close after the first Monday after the report date; weeks the CFTC published late after the 2025 shutdown are not tested. "extreme" is contrarian at the 90th/10th percentile of the prior 3 years (tested only once 3 full years are behind it), "flow" follows a weekly change of 1.5+ standard deviations. An edge needs 15+ cases, a hit rate 8+ points above the base rate and t >= 2 with overlapping 20-day windows allowed for. "edge" per market is the pre-registered study (research/edge/cot-positioning): tested in sample and confirmed out of sample, or none.' };
  fs.writeFileSync(path.join(M, 'cot.json'), JSON.stringify(out));
  log(`cot: ${out.markets.filter((m) => !m.missing).length}/${MARKETS.length} markets`, JSON.stringify(src));
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) run({ dir: process.argv[2] || 'data' }).catch((e) => { console.error(e); process.exit(1); });
