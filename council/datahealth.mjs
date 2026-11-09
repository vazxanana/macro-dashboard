// Council data files health (reliability, 9 Nov 2026): is every file the site and the council read on council-data fresh, well
// formed and plausible? Pure checks on a reader + an injected clock; council/datacheck.mjs runs them every data check (council
// loop) and stores the result in health.json as the pseudo-feed `feeds.files` (so the admin Data chip, the week pane, the digest
// and datacheck's own deduplicated phone alert pick it up with no page change) plus a one-glance `brief`. Status only: it changes
// no rule, trade or file the bots read.
//   node council/datahealth.mjs <council-data dir> [--json]      prints the report (nothing is written)
//
// Per file: freshness against its own cadence (wall clock for the 24/7 loop, open CME minutes for the ICT desk, US business days
// for FRED / reviews, the CFTC release week for COT, the digest's 21:15 UTC send days, the macro log's target days), parse errors,
// missing required files, sanity bands for key values (prices, yields, VIX, P(up), scores) and cross-file consistency (spot gold
// vs the GC future, the Trader vs its MT5 signal file, the Coach vs the latest replay, the veteran vs the strategist).
// Severities: 'bad' (pages through datacheck's alert after 2 checks in a row, unless `quiet`: the watchdog already pages that one),
// 'warn' (shown on the desk, no page), 'note' (listed only; a standing known gap that would otherwise nag every day).
import fs from 'node:fs';
import path from 'node:path';
import { openSecs, usHolidays } from './datacheck.mjs';

const DAY = 86400, H = 60;   // minutes per hour
// plausible price bands (scale errors, a PAXG / feed mix-up, a zero); wide on purpose: they catch broken data, not big moves
export const PX = {
  xau: [1000, 12000], gold: [1000, 12000], gc: [1000, 12000], btc: [5000, 600000], eth: [100, 40000], sol: [3, 3000], xrp: [0.05, 50],
  eurusd: [0.8, 1.6], gbpusd: [0.9, 1.9], audusd: [0.45, 1.05], usdcad: [1.1, 1.7], usdchf: [0.6, 1.2], usdjpy: [80, 250],
  nq: [8000, 60000], es: [2000, 15000], ym: [15000, 120000], rty: [800, 7000],
};
// macro levels the desk shows (percent / index points)
export const LV = { vix: [8, 90], vixTermRatio: [0.6, 1.6], realYield: [-4, 6], us2y: [-1, 12], eu2y: [-2, 10], curve10y3m: [-6, 6], dxyProxy: [70, 140],
  pUp: [0.35, 0.65], score: [-1, 1], goldScore: [-5, 5] };
// FRED cadence (keep in step with council/macro.mjs LAG / MAX_AGE): daily series in US business days, the rest in calendar days
export const FRED_DAILY = ['DFII10', 'DGS2', 'DGS10', 'T10YIE', 'T10Y3M', 'BAMLH0A0HYM2', 'VIXCLS', 'VXVCLS', 'RRPONTSYD', 'SOFR', 'EFFR', 'ecb:2y'];
export const FRED_CORE = ['DFII10', 'DGS2', 'DGS10'];   // the master driver and the Gold Macro Score inputs: these page when stale
export const FRED_DAYS = { DTWEXBGS: 21, WALCL: 14, WTREGEN: 14, SWPT: 14, BSCICP03DEM665S: 120 };
export const FRED_BIZ = { warn: 4, bad: 8 };

// ─── time helpers ───
export const ts = (v) => { if (v == null || v === '') return null; if (typeof v === 'string' && /^\d{9,}$/.test(v)) v = +v; const t = typeof v === 'number' ? v * (v < 1e11 ? 1 : 1e-3) : Date.parse(v) / 1000; return Number.isFinite(t) ? t : null; };
export const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const dayT = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
export const ago = (m) => m >= 2 * DAY / 60 ? `${(m / 1440).toFixed(1)} days` : m >= 120 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`;
const WDN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayName = (d) => { const x = new Date(dayT(d) * 1000); return `${WDN[x.getUTCDay()]} ${x.getUTCDate()} ${x.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`; };
// US bond-market days off besides weekends: every CME US holiday (closed or early) plus Columbus and Veterans Day (FRED's H.15
// rates skip them too). A day too generous here only delays a warning by a day.
const BOND = new Map();
function bondHoliday(d) {
  const y = +d.slice(0, 4);
  if (!BOND.has(y)) { const s = new Set(usHolidays(y).keys()), oct1 = new Date(Date.UTC(y, 9, 1)).getUTCDay();
    s.add(isoDay(Date.UTC(y, 9, 1 + ((1 - oct1 + 7) % 7) + 7) / 1000)); const v = new Date(Date.UTC(y, 10, 11)).getUTCDay();
    s.add(isoDay(Date.UTC(y, 10, 11 + (v === 6 ? -1 : v === 0 ? 1 : 0)) / 1000)); BOND.set(y, s); }
  return BOND.get(y).has(d);
}
export const bizDay = (d) => { const w = new Date(dayT(d) * 1000).getUTCDay(); return w >= 1 && w <= 5 && !bondHoliday(d); };
// US business days after day a, up to and including day b (YYYY-MM-DD)
export function bizDays(a, b) { let n = 0; for (let t = dayT(a) + DAY, e = dayT(b); t <= e; t += DAY) if (bizDay(isoDay(t))) n++; return n; }

// The UTC day whose digest should have gone out by `now` (council/digest.mjs: 21:15 UTC Mon-Fri unless CME is fully closed, and the
// Sunday "Week ahead" preview). Returns { day, due } (due = unix s) or null.
export function digestDue(now) {
  for (let k = 0; k < 9; k++) {
    const day = isoDay(now - k * DAY), due = dayT(day) + 21 * 3600 + 15 * 60, w = new Date(due * 1000).getUTCDay();
    if (due > now || w === 6) continue;
    if (w >= 1 && w <= 5 && usHolidays(+day.slice(0, 4)).get(day) === 'closed') continue;
    return { day, due };
  }
  return null;
}
// The latest target day the macro log must already hold (council/macro.mjs updateHistory: written from 21:00 UTC the evening
// before, never once the day has started): the most recent weekday that has started.
export function historyDue(now) { for (let k = 0; k < 7; k++) { const d = isoDay(now - k * DAY), w = new Date(dayT(d) * 1000).getUTCDay(); if (w >= 1 && w <= 5) return d; } return null; }

// ─── the inventory ───
// Each entry: file (or dir + match for a family), label, who writes it and how often (`every`, shown in the message), `need`
// (missing = bad), `type` json | text, `at(j, text)` → last update (any time format), `clock` 'wall' | 'cme', `warn` / `bad` minutes
// (null = never), `quiet` (the watchdog pages its staleness), and `check(j, c)` for content: c.add(kind, sev, detail).
const L = (lo, hi) => [lo, hi];
export const FILES = [
  // the council loop (council.yml every ~11 min round + a Trader quick pass every minute; or the VPS live runner)
  { file: 'snapshot.json', label: 'Trader snapshot', every: '1-11 min (council loop)', need: true, at: (j) => j.at, warn: 20, bad: 30, quiet: true, check: snapshotCheck },
  { file: 'state.json', label: 'Trader state', every: '1-11 min', need: true, at: (j) => j.lastRun, warn: 20, bad: 30, quiet: true, check: stateCheck },
  { file: 'trades.json', label: 'Trade records', every: 'each Trader pass', need: true, check: tradesCheck },
  { file: 'config.json', label: 'Rules (config)', every: 'on a rule change', need: true, check: configCheck },
  { file: 'research.json', label: 'Research streams', every: 'each Trader pass', need: true, check: (j, c) => { if (!Array.isArray(j)) c.add('parse', 'bad', 'not a list'); } },
  { file: 'mt5/signals.csv', label: 'MT5 / cTrader signal file', type: 'text', every: 'each Trader pass', need: true, at: (j, t) => (String(t).match(/generated (\d{9,})/) || [])[1], warn: 20, bad: 30, quiet: true, check: csvCheck },
  { file: 'analysis/latest.md', label: 'Analyst brief + live blocks', type: 'text', every: 'each Trader pass', need: true, check: markersCheck },
  { file: 'ctrader/account.json', label: 'cTrader demo account', every: '1 min (between rounds)', at: (j) => j.at, warn: 20, bad: 45 },
  { file: 'ctrader/accounts.json', label: 'cTrader demo accounts', every: '1 min', at: (j) => j.at, warn: 20, bad: 45 },
  { dir: 'ctrader', match: /^mirror(-\d+)?\.json$/, label: 'cTrader mirror', every: 'each Trader pass', at: (j) => j.state && j.state.lastRun, warn: 20, bad: 45, check: mirrorCheck },
  { file: 'ctrader/symbols.json', label: 'cTrader symbol specs', every: 'each round', at: (j) => j.at, warn: 45, bad: 180, check: symbolsCheck },
  { file: 'ict/snapshot.json', label: 'ICT desk snapshot', every: 'every 3rd round (~35 min)', need: true, at: (j) => j.at, clock: 'cme', warn: 45, bad: 90, quiet: true, check: ictCheck },
  { file: 'ict/shadow.json', label: 'ICT shadow book', every: 'every 3rd round', at: (j) => j.at, clock: 'cme', warn: 45, bad: 90, quiet: true },
  { file: 'ict/trades.json', label: 'ICT trades', every: 'every 3rd round', need: true, check: (j, c) => { if (!Array.isArray(j)) c.add('parse', 'bad', 'not a list'); } },
  { file: 'ict/bars.json', label: 'ICT desk candles', every: 'every 3rd round', check: ictBarsCheck },
  { file: 'macro/forecast.json', label: 'Macro forecast', every: 'every 6th round (~70 min)', need: true, at: (j) => j.at, warn: 150, bad: 240, check: forecastCheck },
  { file: 'macro/veteran.json', label: 'Macro veteran', every: 'every 6th round', at: (j) => j.at, warn: 150, bad: 240, check: veteranCheck },
  { file: 'macro/cot.json', label: 'COT positioning', every: 'every 6th round (CFTC weekly, Friday)', at: (j) => j.at, warn: 150, bad: 240, check: cotCheck },
  { file: 'macro/history.json', label: 'Macro forecast log', every: 'one entry per weekday, from 21:00 UTC the evening before', check: historyCheck },
  { file: 'macro/events.json', label: 'Macro release log', every: 'each macro run', check: listCheck },
  { file: 'macro/cache.json', label: 'Macro source cache', every: 'each macro run', check: (j, c) => { if (!j || typeof j !== 'object' || !j.fred) c.add('parse', 'warn', 'no FRED cache inside'); } },
  { file: 'coach.json', label: 'Coach (daily review + 6-hourly decay)', every: 'daily; decay every 6 h', need: true, at: (j) => j.at, warn: 26 * H, bad: 30 * H, check: coachCheck },
  { file: 'digest.json', label: 'Daily owner digest', every: '21:15 UTC Mon-Fri + Sunday preview', check: digestCheck },
  { file: 'watchdog.json', label: 'Loop watchdog', every: 'GitHub cron :11/:41 + each loop hand-over', at: (j) => j.at, warn: 3 * H, bad: 12 * H,
    why: 'while it is down nobody is alerted if the council loop stops' },
  { file: 'health.json', label: 'Data check', every: 'every 2nd round (~23 min)', at: (j) => j.at, warn: 60, bad: 90, quiet: true },
  { file: 'backtest.json', label: 'Daily replay', every: 'daily 03:17 UTC (backtest.yml)', need: true, at: (j) => j.at, warn: 30 * H, bad: 54 * H },
  { file: 'research/fidelity.json', label: 'Replay fidelity check', every: 'daily (backtest.yml)', at: (j) => j.at, warn: 54 * H, bad: null },
  { file: 'research/spotcheck.json', label: 'Feed spot-check', every: 'daily (backtest.yml)', at: (j) => j.at, warn: 54 * H, bad: null },
  { file: 'research/robustness.json', label: 'Robustness verdicts', every: 'daily (backtest.yml / robustness.yml)', at: (j) => j.at, warn: 3 * 24 * H, bad: null },
  { file: 'research/ledger.json', label: 'Research ledger', every: 'when a study lands', check: (j, c) => { if (!j || !Array.isArray(j.rows)) c.add('parse', 'warn', 'no rows'); } },
  { file: 'research/replay-2w.json', label: 'System replays', every: 'by hand (replay.yml)', need: true },
  { file: 'research/shadow-replay.json', label: 'Shadow replay', every: 'by hand' },
  { file: 'ict/replay.json', label: 'ICT replay', every: 'weekly, Sunday 06:41 UTC', at: (j) => j.at, warn: 8 * 24 * H, bad: 15 * 24 * H },
  { file: 'lit/replay.json', label: 'LIT replay', every: 'at most every 20 h (council loop)', at: (j) => j.at, warn: 30 * H, bad: 72 * H },
  { file: 'research/daily/_index.json', label: 'Daily candle cache', every: 'weekly, Saturday 03:17 UTC', at: (j) => j.updated, warn: 8 * 24 * H, bad: 15 * 24 * H, check: dailyIndexCheck },
  { file: 'reviews/latest.md', label: 'Coach AI review', type: 'text', every: 'daily (scheduled session)', need: true, check: reviewsCheck },
  { file: 'reviews/losses.json', label: 'Owner loss reviews', every: 'when the owner writes one', check: reviewList },
  { file: 'reviews/analyst.json', label: 'Loss post-mortems', every: 'after each closed losing trade', check: reviewList },
];

// ─── content checks ───
function band(c, what, v, [lo, hi], sev = 'bad') {
  if (v == null) return;
  if (typeof v !== 'number' || !Number.isFinite(v)) c.add('range', sev, `${what} is not a number (${String(v).slice(0, 20)})`);
  else if (v < lo || v > hi) c.add('range', sev, `${what} ${v} is outside the plausible ${lo}–${hi}`);
}
const pct = (a, b) => Math.abs(a / b - 1) * 100;
function snapshotCheck(j, c) {
  const M = j.markets || {};
  if (!Object.keys(M).length) c.add('parse', 'bad', 'no markets');
  for (const [k, m] of Object.entries(M)) if (PX[k]) band(c, `${m.label || k} price`, m.price, PX[k]);
  const spot = M.xau && M.xau.price, sAt = ts(j.at);
  for (const [k, src] of Object.entries(j.feed || {})) if ((k === 'xau' || /^(eur|gbp|aud)usd$|^usd(cad|chf)$/.test(k)) && src !== 'OANDA')
    c.add('source', 'warn', `${(M[k] && M[k].label) || k} read from ${src}, not OANDA (proxy fallback)`);
  if (j.nqYahoo && /throttl|fail|error|HTTP/i.test(j.nqYahoo)) c.add('source', 'note', `NQ backup: ${j.nqYahoo} (NQ reads ${j.nqSrc || 'its primary'})`);
  const errs = Object.keys(j.errors || {}); if (errs.length) c.add('source', 'note', `Trader errors this round: ${errs.join(', ').slice(0, 120)}`);
  // spot gold vs the ICT desk's GC future (contango ~0.3-1 %): both prices from the last hour only
  const ict = c.get('ict/snapshot.json'), gc = ict && ict.markets && ict.markets.gc, gAt = gc ? ts(gc.at) : null;
  if (spot > 0 && gc && gc.price > 0 && sAt && gAt && Math.abs(sAt - gAt) < 3600) {
    const d = pct(gc.price, spot); if (d > 2.5) c.add('mismatch', d > 5 ? 'bad' : 'warn', `spot gold ${spot} vs the GC future ${gc.price}: ${d.toFixed(1)}% apart (normally under 1%)`);
  }
  const nq = ict && ict.markets && ict.markets.nq, nAt = nq ? ts(nq.at) : null, nl = j.nqLast;
  if (nl && nl.price > 0 && nq && nq.price > 0 && nAt && Math.abs(ts(nl.at) - nAt) < 3600) {
    band(c, 'NQ price', nl.price, PX.nq); const d = pct(nl.price, nq.price);
    if (d > 2) c.add('mismatch', 'warn', `Trader NQ ${nl.price} vs the ICT desk's ${nq.price}: ${d.toFixed(1)}% apart`);
  }
  const fc = c.get('macro/forecast.json'), fg = fc && fc.assets && fc.assets.gold && fc.assets.gold.last;
  if (spot > 0 && fg > 0 && pct(spot, fg) > 10) c.add('mismatch', 'warn', `spot gold ${spot} vs the macro desk's last close ${fg}: ${pct(spot, fg).toFixed(1)}% apart`);
}
function stateCheck(j, c) {
  const s = c.get('snapshot.json'), a = s && ts(s.at), b = ts(j.lastRun);
  if (a && b && Math.abs(a - b) > 15 * 60) c.add('mismatch', 'warn', `last run ${isoDay(b)} ${new Date(b * 1000).toISOString().slice(11, 16)} UTC differs from the snapshot by ${ago(Math.abs(a - b) / 60)}`);
}
function tradesCheck(j, c) {
  if (!Array.isArray(j)) return c.add('parse', 'bad', 'not a list');
  const ids = new Set(), s = c.get('snapshot.json'), M = (s && s.markets) || {}; let dup = 0;
  for (const x of j) { if (!x || !x.id) continue; if (ids.has(x.id)) dup++; ids.add(x.id); }
  if (dup) c.add('parse', 'bad', `${dup} trade id${dup > 1 ? 's' : ''} recorded twice`);
  const broken = { live: [], shadow: [] };
  for (const x of j) {
    if (!x || (x.status !== 'open' && x.status !== 'pending')) continue;
    const why = !(x.entry > 0 && x.stop > 0) ? 'no entry / stop' : x.side === 'buy' && !(x.stop < x.entry) ? 'buy stop not under the entry' : x.side === 'sell' && !(x.stop > x.entry) ? 'sell stop not over the entry'
      : M[x.market] && M[x.market].price > 0 && pct(x.entry, M[x.market].price) > 30 ? `entry ${x.entry} is ${pct(x.entry, M[x.market].price).toFixed(0)}% from the price ${M[x.market].price}` : null;
    if (why) broken[x.shadow ? 'shadow' : 'live'].push(`${x.id}: ${why}`);
  }
  if (broken.live.length) c.add('range', 'bad', `${broken.live.length} live open trade${broken.live.length > 1 ? 's' : ''} with impossible levels (${broken.live.slice(0, 2).join('; ')})`);
  if (broken.shadow.length) c.add('range', 'warn', `${broken.shadow.length} shadow trade${broken.shadow.length > 1 ? 's' : ''} with impossible levels (${broken.shadow.slice(0, 2).join('; ')})`);
}
function configCheck(j, c) {
  for (const k of ['buf', 'minRR', 'minRisk']) if (!(typeof j[k] === 'number' && j[k] > 0)) c.add('range', 'bad', `${k} is ${JSON.stringify(j[k])} (the Trader needs a positive number)`);
  if (!Array.isArray(j.history)) c.add('parse', 'warn', 'no change history');
  const bt = c.get('backtest.json'), a = bt && ts(bt.at), b = ts(j.btAt);
  if (a && b && a - b > 6 * 3600) c.add('mismatch', 'warn', `the Coach last read the daily replay of ${isoDay(b)}; the newest is ${isoDay(a)}`);
}
function csvCheck(t, c) {
  const rows = String(t).split('\n').filter((l) => l && !l.startsWith('#')), n = rows.length ? rows[0].split(',').length : 0;
  if (!rows.length || !/^id,market,/.test(rows[0])) return c.add('parse', 'bad', 'no column header');
  const off = rows.slice(1).filter((r) => r.split(',').length !== n).length; if (off) c.add('parse', 'bad', `${off} row${off > 1 ? 's' : ''} with the wrong number of columns`);
  const s = c.get('snapshot.json'), a = s && ts(s.at), g = ts(+((String(t).match(/generated (\d{9,})/) || [])[1]));
  if (a && g && a - g > 15 * 60) c.add('mismatch', 'bad', `${ago((a - g) / 60)} behind the Trader: MT5 / cTrader bridges get old signals`);
}
function markersCheck(t, c) {
  const st = [...String(t).matchAll(/<!-- ([a-z0-9-]+):start -->/g)].map((m) => m[1]), en = new Set([...String(t).matchAll(/<!-- ([a-z0-9-]+):end -->/g)].map((m) => m[1]));
  const lone = st.filter((k) => !en.has(k)); if (lone.length) c.add('parse', 'warn', `block${lone.length > 1 ? 's' : ''} without an end marker: ${lone.join(', ')}`);
}
function mirrorCheck(j, c) {
  const s = j.state || {}; if (s.status && !/^ok/.test(String(s.status))) c.add('source', 'warn', `status: ${String(s.status).slice(0, 100)}`);
  if (s.paused && Object.keys(s.paused).length) c.add('source', 'note', `paused: ${Object.keys(s.paused).join(', ')}`);
}
function symbolsCheck(j, c) {
  if (Array.isArray(j.errors) && j.errors.length) c.add('source', 'warn', `broker errors: ${JSON.stringify(j.errors).slice(0, 100)}`);
  const miss = Object.keys(j.missing || {}); if (miss.length) c.add('source', 'note', `not offered by the broker: ${miss.map((k) => `${k} (${[].concat(j.missing[k]).join('/')})`).join(', ')}`);
}
function ictCheck(j, c) {
  for (const [k, m] of Object.entries(j.markets || {})) {
    if (PX[k]) band(c, `${m.short || k} price`, m.price, PX[k]);
    const t = ts(m.at); if (t && openSecs('cme', t + 300, c.now) > 60 * 60) c.add('stale', 'warn', `${m.short || k} last candle ${ago(openSecs('cme', t + 300, c.now) / 60)} of open market ago (${m.src || ''})`);
  }
  const errs = Object.keys(j.errors || {}); if (errs.length) c.add('source', 'note', `desk errors: ${errs.join(', ').slice(0, 120)}`);
}
function ictBarsCheck(j, c) {
  const empty = Object.entries(j || {}).filter(([, v]) => !(v && Array.isArray(v.m5) && v.m5.length)).map(([k]) => k);
  if (empty.length) c.add('source', 'warn', `no 5-minute candles for ${empty.join(', ')}`);
}
function reviewList(j, c) { if (!j || !j.reviews || typeof j.reviews !== 'object') c.add('parse', 'warn', 'no reviews inside'); }
function listCheck(j, c) { if (!Array.isArray(j)) c.add('parse', 'warn', 'not a list'); }
// FRED / ECB / calendar / bars / RSS / COT status lines the strategist writes in forecast.sources ("ok, last 2026-11-05", "failed (HTTP 404)")
export function sourceIssues(sources, now) {
  const out = [], today = isoDay(now), w = new Date(now * 1000).getUTCDay(), lateWeek = w === 0 || w >= 5 || (w === 4 && new Date(now * 1000).getUTCHours() >= 12);
  for (const [k, v] of Object.entries(sources || {})) {
    const s = String(v), ok = /^ok\b|OANDA ok/.test(s), last = (s.match(/last (\d{4}-\d\d-\d\d)/) || [])[1], id = k.replace(/^fred:/, '');
    if (k.startsWith('fred:') || k === 'ecb:2y') {
      if (!ok) { out.push(['source', FRED_CORE.includes(id) ? 'bad' : 'warn', `${k} ${s}`]); continue; }
      if (!last) continue;
      if (FRED_DAILY.includes(id) || k === 'ecb:2y') { const n = bizDays(last, today);
        if (n > FRED_BIZ.warn) out.push(['input', n > FRED_BIZ.bad && FRED_CORE.includes(id) ? 'bad' : 'warn', `${k} last value ${last}, ${n} business days old (normally ≤ 3)`]); }
      else if (FRED_DAYS[id]) { const d = Math.floor((now - dayT(last)) / DAY);
        if (d > FRED_DAYS[id]) out.push(['input', 'warn', `${k} last value ${last} (${d} days old; over ${FRED_DAYS[id]} the strategist drops it as "no data")`]); }
    } else if (k === 'calendar:thisweek' && !ok) out.push(['source', 'warn', `this week's calendar ${s} (the last good copy is used)`]);
    else if (k === 'calendar:nextweek' && !ok) { if (lateWeek) out.push(['source', 'warn', `next week's calendar ${s}: the 1-5 day playbook misses Monday's releases`]); }
    else if (k.startsWith('bars:') && !ok) out.push(['source', 'warn', `${k} ${s}`]);
    else if (k === 'cot' && !ok) out.push(['source', 'warn', `COT ${s}`]);
    else if (k.startsWith('rss:') && !ok) out.push(['source', 'note', `${k} ${s}`]);
  }
  return out;
}
function forecastCheck(j, c) {
  const A = j.assets || {};
  if (!Object.keys(A).length) c.add('parse', 'bad', 'no assets');
  for (const [k, a] of Object.entries(A)) {
    band(c, `${a.label || k} P(up)`, a.pUp, LV.pUp); band(c, `${a.label || k} score`, a.score, LV.score);
    if (PX[k]) band(c, `${a.label || k} last price`, a.last, PX[k]);
  }
  const r = j.regime || {};
  band(c, 'VIX', r.vix, LV.vix); band(c, 'VIX / VIX3M', r.vixTermRatio, LV.vixTermRatio); band(c, '10Y real yield', r.realYield && r.realYield.level, LV.realYield);
  band(c, 'US 2Y yield', r.us2y, LV.us2y); band(c, 'EA 2Y yield', r.eu2y, LV.eu2y); band(c, '10Y-3M curve', r.curve10y3m, LV.curve10y3m); band(c, 'DXY', r.dxyProxy, LV.dxyProxy);
  const g = j.goldScore;
  if (g && g.ok) {
    band(c, 'Gold Macro Score', g.score, LV.goldScore);
    const t = ts(g.asOf); if (t && (t < c.now - 21 * DAY || t > c.now + 7 * DAY)) c.add('mismatch', 'warn', `Gold Macro Score week ${g.asOf} is not the current week`);
    if (Array.isArray(g.stale) && g.stale.length) c.add('stale', 'warn', `Gold Macro Score inputs stale: ${g.stale.map((x) => `${x.name} last ${x.last}`).join(', ')}`);
  } else if (g && !g.ok) c.add('source', 'warn', `Gold Macro Score withheld${g.why ? ': ' + g.why : ''}`);
  for (const [k, sev, d] of sourceIssues(j.sources, c.now)) c.add(k, sev, d);
}
function veteranCheck(j, c) {
  const f = c.get('macro/forecast.json'), a = f && ts(f.at), b = ts(j.strategistAt);
  if (a && b && a - b > 3 * 3600) c.add('mismatch', 'warn', `argues with the strategist's view of ${ago((a - b) / 60)} before the latest`);
}
// COT: Tuesday positions released Friday 15:30 New York (a holiday pushes it to Monday)
export function cotIssues(j, now) {
  const out = [], ms = Array.isArray(j.markets) ? j.markets : Object.values(j.markets || {});
  if (!ms.length) return [['parse', 'warn', 'no markets']];
  const days = [...new Set(ms.map((m) => m.asOf).filter(Boolean))].sort(), last = days.at(-1);
  if (!last) return [['parse', 'warn', 'no report dates']];
  const age = Math.floor((now - dayT(last)) / DAY);
  if (age > 10) out.push(['stale', age > 24 ? 'bad' : 'warn', `newest CFTC report is for ${last} (${age} days ago; normally 3-10)`]);
  if (days.length > 1) out.push(['mismatch', 'warn', `markets on different report weeks: ${days.join(', ')}`]);
  const off = ms.filter((m) => [m.long, m.short, m.net].every(Number.isFinite) && Math.abs(m.long - m.short - m.net) > 1).map((m) => m.k || m.name);
  if (off.length) out.push(['mismatch', 'warn', `net ≠ long − short for ${off.join(', ')}`]);
  return out;
}
function cotCheck(j, c) { for (const [k, sev, d] of cotIssues(j, c.now)) c.add(k, sev, d); }
function historyCheck(j, c) {
  if (!Array.isArray(j)) return c.add('parse', 'bad', 'not a list (append-only log)');
  const due = historyDue(c.now), last = j.map((h) => h && h.target).filter(Boolean).sort().at(-1);
  if (due && (!last || last < due)) c.add('schedule', 'warn', `no forecast logged for ${dayName(due)} (newest ${last || 'none'}): the live track record misses that day`);
  const open = j.filter((h) => h && h.y == null && !h.void && h.target && bizDays(h.target, isoDay(c.now)) > 3);
  if (open.length) c.add('schedule', 'warn', `${open.length} logged forecast${open.length > 1 ? 's' : ''} not resolved after 3 business days (oldest ${open.map((h) => h.target).sort()[0]})`);
}
function coachCheck(j, c) {
  const d = j.decay && ts(j.decay.at); if (j.decay && d && c.now - d > 13 * 3600) c.add('stale', 'bad', `edge-decay monitor not rebuilt for ${ago((c.now - d) / 60)} (every 6 h)`);
  else if (j.decay && d && c.now - d > 7 * 3600) c.add('stale', 'warn', `edge-decay monitor ${ago((c.now - d) / 60)} old (every 6 h)`);
}
function digestCheck(j, c) {
  const due = digestDue(c.now), sent = j.sent && j.sent.day;
  if (due && (!sent || sent < due.day) && c.now - due.due > 90 * 60) c.add('schedule', 'bad', `the ${new Date(dayT(due.day) * 1000).getUTCDay() === 0 ? 'Sunday preview' : 'daily digest'} for ${dayName(due.day)} was not sent (due 21:15 UTC; last sent ${sent || 'never'})`);
}
function dailyIndexCheck(j, c) {
  const S = Object.entries(j.symbols || {}), err = S.filter(([, v]) => v.status !== 'ok').map(([k]) => k);
  if (!S.length) c.add('parse', 'warn', 'no symbols');
  if (err.length) c.add('source', 'warn', `${err.length} market${err.length > 1 ? 's' : ''} failed: ${err.join(', ')}`);
  const up = ts(j.updated) || c.now, dead = S.filter(([, v]) => v.status === 'ok' && v.last && up - v.last > 30 * DAY).map(([k, v]) => `${k} (last ${isoDay(v.last)})`);
  if (dead.length) c.add('stale', 'note', `no new candles from OANDA: ${dead.join(', ')}`);
  const xau = S.find(([k]) => k === 'xau'); if (xau && xau[1].last && bizDays(isoDay(xau[1].last), isoDay(up)) > 3) c.add('stale', 'warn', `gold's newest daily candle ${isoDay(xau[1].last)} lags the cache run`);
}
function reviewsCheck(t, c) {
  const days = (c.list('reviews') || []).map((f) => (f.match(/^(\d{4}-\d\d-\d\d)\.md$/) || [])[1]).filter(Boolean).sort(), last = days.at(-1);
  if (last && bizDays(last, isoDay(c.now)) > 3) c.add('stale', 'warn', `newest daily review ${last} (${bizDays(last, isoDay(c.now))} business days ago)`);
  const briefs = (c.list('analysis') || []).map((f) => (f.match(/^(\d{4}-\d\d-\d\d)\.md$/) || [])[1]).filter(Boolean).sort(), b = briefs.at(-1);
  if (b && c.now - dayT(b) > 8 * DAY) c.add('stale', 'warn', `newest weekly Analyst brief analysis/${b}.md is ${Math.floor((c.now - dayT(b)) / DAY)} days old (Mondays)`);
}

// ─── running the checks ───
// reader: { text(rel) → string | null, list(relDir) → [names] }
export function fsReader(root) {
  return { text: (f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { return null; } },
    list: (d) => { try { return fs.readdirSync(path.join(root, d)); } catch (e) { return []; } } };
}
// Freshness of one file: { ageMin, sev, detail } or null when it has no timestamp rule
export function freshness(spec, t, now) {
  if (!spec.warn && !spec.bad) return null;
  if (t == null) return { ageMin: null, sev: 'warn', detail: 'no update time inside' };
  const cme = spec.clock === 'cme', m = (cme ? openSecs('cme', t, now) : Math.max(0, now - t)) / 60, unit = cme ? ' of open market' : '';
  const sev = spec.bad != null && m > spec.bad ? 'bad' : spec.warn != null && m > spec.warn ? 'warn' : null;
  return { ageMin: Math.round(m), sev, detail: sev ? `not updated for ${ago(m)}${unit} (expected ${spec.every}; ${sev === 'bad' ? 'alert' : 'flag'} after ${ago(sev === 'bad' ? spec.bad : spec.warn)})${spec.why ? ': ' + spec.why : ''}` : null };
}
// All files → { at, status, counts, files: { rel: { label, status, ageMin?, every, issues[] } } }. opts.skip: files not to check
// (datacheck skips health.json, which it is writing).
export function checkFiles(reader, now, { skip = [] } = {}) {
  const cache = new Map(), get = (f) => { if (!cache.has(f)) { const t = reader.text(f); let j = null; try { j = t == null ? null : JSON.parse(t); } catch (e) { j = null; } cache.set(f, j); } return cache.get(f); };
  const files = {}, specs = [];
  for (const s of FILES) {
    if (s.dir) for (const n of (reader.list(s.dir) || []).filter((n) => s.match.test(n)).sort()) specs.push({ ...s, file: `${s.dir}/${n}`, label: `${s.label} ${n.replace(/^mirror-?|\.json$/g, '') || 'main'}` });
    else if (!skip.includes(s.file)) specs.push(s);
  }
  for (const s of specs) {
    const issues = [], add = (kind, sev, detail) => issues.push({ kind, sev, detail });
    const raw = reader.text(s.file), rec = { label: s.label, status: 'ok', every: s.every, issues };
    if (raw == null) { if (s.need) add('missing', 'bad', 'file missing on council-data'); else continue; }
    else {
      let j = raw;
      if (s.type !== 'text') { try { j = JSON.parse(raw); } catch (e) { add('parse', 'bad', `does not parse: ${String(e.message).slice(0, 80)}`); j = undefined; } }
      if (j !== undefined) {
        const f = freshness(s, s.at ? ts(s.at(j, raw)) : null, now);
        if (f) { rec.ageMin = f.ageMin; if (f.sev) issues.push({ kind: 'stale', sev: f.sev, detail: f.detail, ...(s.quiet ? { quiet: true } : {}) }); }
        if (s.check) try { s.check(j, { add, get, now, list: reader.list }); } catch (e) { add('parse', 'warn', `check failed: ${String(e.message).slice(0, 80)}`); }
      }
    }
    rec.status = issues.some((x) => x.sev === 'bad') ? 'bad' : issues.some((x) => x.sev === 'warn') ? 'warn' : 'ok';
    files[s.file] = rec;
  }
  const counts = { ok: 0, warn: 0, bad: 0 }; for (const r of Object.values(files)) counts[r.status]++;
  return { at: new Date(now * 1000).toISOString(), status: counts.bad ? 'bad' : counts.warn ? 'warn' : 'ok', counts, files };
}
// health.json shape: a feed whose "markets" are the files (the Data chip lists bad / warn ones, datacheck's alert reads it)
export function asFeed(r) {
  return { label: 'Council data files', status: r.status, markets: Object.fromEntries(Object.entries(r.files).map(([f, x]) => [f, { label: `${x.label} (${f})`, status: x.status,
    ...(x.ageMin != null ? { ageMin: x.ageMin } : {}), issues: x.issues }])) };
}
// One-glance summary across every feed (candles and files) for the desk / digest: { status, line, bad: [], warn: [], notes }
export function brief(feeds) {
  const bad = [], warn = []; let notes = 0;
  for (const [f, F] of Object.entries(feeds || {})) for (const m of Object.values(F.markets || {})) for (const x of m.issues || []) {
    if (x.sev === 'note') { notes++; continue; }
    (x.sev === 'bad' ? bad : warn).push(`${f === 'files' ? '' : F.label + ' '}${m.label}: ${x.detail}`);
  }
  const status = bad.length ? 'bad' : warn.length ? 'warn' : 'ok';
  const line = status === 'ok' ? 'All data fresh and in range' : `${bad.length ? `${bad.length} problem${bad.length > 1 ? 's' : ''}` : ''}${bad.length && warn.length ? ', ' : ''}${warn.length ? `${warn.length} warning${warn.length > 1 ? 's' : ''}` : ''}: ${(bad[0] || warn[0]).slice(0, 140)}`;
  return { status, line, bad: bad.slice(0, 10), warn: warn.slice(0, 10), notes };
}

if (process.argv[1] && process.argv[1].endsWith('datahealth.mjs')) {
  const dir = process.argv[2] || 'data', r = checkFiles(fsReader(dir), Math.floor(Date.now() / 1000));
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else {
    console.log(`Council data files ${r.status}: ${r.counts.ok} ok, ${r.counts.warn} warn, ${r.counts.bad} bad`);
    for (const [f, x] of Object.entries(r.files)) console.log(`  ${x.status.padEnd(4)} ${f.padEnd(34)} ${x.ageMin != null ? ago(x.ageMin).padStart(9) : ''.padStart(9)}  ${x.issues.map((i) => `[${i.sev}${i.quiet ? ', watchdog pages' : ''}] ${i.detail}`).join(' | ')}`);
  }
}
