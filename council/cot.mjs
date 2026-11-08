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
// Returns start at the first daily close after the Friday release (report date + 3 days), so nothing is known early.
// A signal counts as an edge only with 15+ cases, a hit rate 8+ points above that market's base rate and t >= 2.
// Paper only: information for the desk; it changes no rule, size or trade.
// Usage: node council/cot.mjs [dataDir]
import fs from 'node:fs';
import path from 'node:path';

const DAY = 86400;
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
const find = (r, res) => { for (const re of res) { const k = Object.keys(r).find((x) => re.test(x)); if (k != null && r[k] !== '' && isFinite(+r[k])) return +r[k]; } return null; };
export function parseRow(r, ds) {
  const t = Date.parse(String(r.report_date_as_yyyy_mm_dd || '').slice(0, 10) + 'T00:00:00Z') / 1000; if (!isFinite(t)) return null;
  const who = ds === 'dis' ? 'm_money' : 'lev_money';
  const L = find(r, [new RegExp(`^${who}_positions_long(_all)?$`)]), S = find(r, [new RegExp(`^${who}_positions_short(_all)?$`)]);
  if (L == null || S == null) return null;
  return { t, code: String(r.cftc_contract_market_code || '').trim(), long: L, short: S, net: L - S,
    tL: find(r, [new RegExp(`^traders_${who}_long(_all)?$`)]), tS: find(r, [new RegExp(`^traders_${who}_short(_all)?$`)]),
    oi: find(r, [/^open_interest_all$/, /^open_interest$/]) };
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
// per-week features with no look-ahead: the percentile uses the prior 156 weeks, the flow z the prior 52 weekly changes
export function features(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], prev = rows[i - 1], p4 = rows[i - 4], hist = rows.slice(Math.max(0, i - 156), i).map((x) => x.net);
    const chgs = []; for (let j = Math.max(1, i - 52); j < i; j++) chgs.push(rows[j].net - rows[j - 1].net);
    const chg1 = prev ? r.net - prev.net : null, s = sd(chgs);
    out.push({ ...r, chg1, chg4: p4 ? r.net - p4.net : null, pct: hist.length >= 52 ? pctile(hist, r.net) : null, z: chg1 != null && s ? +(chg1 / s).toFixed(2) : null,
      tLchg: prev && r.tL != null && prev.tL != null ? r.tL - prev.tL : null, tSchg: prev && r.tS != null && prev.tS != null ? r.tS - prev.tS : null,
      oiChg: prev && r.oi != null && prev.oi != null ? r.oi - prev.oi : null });
  }
  return out;
}
// the signal a week's features give, in the market's own direction (+1 up, −1 down, 0 none)
export const sigExtreme = (f) => (f.pct == null ? 0 : f.pct >= 90 ? -1 : f.pct <= 10 ? 1 : 0);
export const sigFlow = (f) => (f.z == null ? 0 : f.z >= 1.5 ? 1 : f.z <= -1.5 ? -1 : 0);

// forward return of the quoted pair from the first close after the release, h trading days on, in the futures' direction
function fwd(px, t, h, sign) {
  const t0 = t + 3 * DAY; let i = px.findIndex((o) => o.t > t0); if (i < 0 || i + h >= px.length) return null;
  return sign * (px[i + h].v / px[i].v - 1);
}
export function evaluate(feats, px, sign, { from = Date.parse('2020-01-01T00:00:00Z') / 1000 } = {}) {
  const res = {};
  for (const [name, fn] of [['extreme', sigExtreme], ['flow', sigFlow]]) {
    for (const h of [5, 20]) {
      const all = [], hits = [];
      for (const f of feats) { if (f.t < from) continue; const r = fwd(px, f.t, h, sign); if (r == null) continue; all.push(r); const s = fn(f); if (s) hits.push(s * r); }
      if (!all.length) continue;
      const base = all.filter((r) => r > 0).length / all.length, n = hits.length;
      const win = n ? hits.filter((r) => r > 0).length / n : null, avg = n ? hits.reduce((a, b) => a + b, 0) / n : null, s = sd(hits);
      // base for a two-sided signal: half the time it bets up, half down; the fair comparison is 50% and the mean drift is small
      const t = n > 2 && s ? avg / (s / Math.sqrt(n)) : null;
      const edge = n >= 15 && win != null && win >= Math.max(base, 1 - base) + 0.08 && t != null && t >= 2;
      res[`${name}${h}`] = { n, win: win == null ? null : +win.toFixed(3), avg: avg == null ? null : +(avg * 100).toFixed(2), t: t == null ? null : +t.toFixed(2), base: +base.toFixed(3), edge };
    }
  }
  return res;
}

export function build(rowsByCode, pxByKey) {
  const markets = [];
  for (const m of MARKETS) {
    const rows = rowsByCode[m.code] || []; if (rows.length < 10) { markets.push({ k: m.k, name: m.name, missing: true }); continue; }
    const F = features(rows), cur = F[F.length - 1], px = pxByKey[m.px] || [];
    const tests = px.length ? evaluate(F, px, m.sign) : null;
    const sigs = [];
    const e = sigExtreme(cur), fl = sigFlow(cur);
    if (e) sigs.push({ kind: 'extreme', dir: e, text: e < 0 ? `Speculators crowded long (${cur.pct}th percentile of 3 years): contrarian lean down` : `Speculators crowded short (${cur.pct}th percentile): contrarian lean up`, tested: tests && tests.extreme20 });
    if (fl) sigs.push({ kind: 'flow', dir: fl, text: `${fl > 0 ? 'Big buying' : 'Big selling'} by speculators this week (${cur.z > 0 ? '+' : ''}${cur.z} standard deviations): follow`, tested: tests && tests.flow5 });
    markets.push({ k: m.k, name: m.name, who: m.ds === 'dis' ? 'managed money' : 'leveraged funds', asOf: new Date(cur.t * 1000).toISOString().slice(0, 10),
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
    if (Object.keys(f.rows).length) { rows = f.rows; fs.writeFileSync(raw, JSON.stringify({ at: new Date(now).toISOString(), src, rows })); }
  }
  if (!rows) { log('cot: no data', src); return null; }
  const px = {}; for (const m of MARKETS) { try { const j = JSON.parse(fs.readFileSync(path.join(dir, 'research', 'daily', m.px + '.json'), 'utf8')); px[m.px] = j.rows.filter((r) => r && r[4] > 0).map((r) => ({ t: r[0], v: +r[4] })); } catch (e) {} }
  const out = { v: 1, at: new Date(now).toISOString(), paperOnly: true, src, markets: build(rows, px),
    method: 'Speculators = leveraged funds (financial futures, TFF report) or managed money (metals, Disaggregated report). Positions as of Tuesday, published Friday. Tests: council daily prices since 2020, returns from the first close after the release; "extreme" is contrarian at the 90th/10th percentile of the prior 3 years, "flow" follows a weekly change of 1.5+ standard deviations. An edge needs 15+ cases, a hit rate 8+ points above the base rate and t >= 2.' };
  fs.writeFileSync(path.join(M, 'cot.json'), JSON.stringify(out));
  log(`cot: ${out.markets.filter((m) => !m.missing).length}/${MARKETS.length} markets`, JSON.stringify(src));
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) run({ dir: process.argv[2] || 'data' }).catch((e) => { console.error(e); process.exit(1); });
