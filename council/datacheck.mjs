// Data-quality monitor for the candle feeds the trading bots read (reliability, 7 Nov 2026). Paper only; changes nothing the
// bots do: it reads each feed the way the bot does, checks the candles, writes council-data health.json and sends ONE phone
// alert (ntfy / Telegram through alerts.mjs) when a feed goes bad, then a reminder at most every 12 h and an all-clear.
//   node council/datacheck.mjs <council-data dir>      (run from council.yml every 2nd round; never exits non-zero)
//
// Feeds (5-minute candles, the timeframe trades are managed on):
//   oanda  — the site's OANDA proxy https://meridianx.dev/md/bars (MD_BASE): spot gold and the five forex pairs the Trader reads
//   kraken — api.kraken.com OHLC: the four crypto markets the Trader trades (it never trades Kraken gold/forex unless OANDA fails)
//   cnbc   — ts-api.cnbc.com: the ICT desk's futures (ict/tracker.mjs MARKETS, first CNBC symbol; halt-hour bars dropped as the tracker does)
// Checks per market: unreachable / too few candles, stale (open-market minutes since the last candle), gaps (missing open-market
// time between candles), zero / negative / non-numeric prices, broken candles (high under low, open/close outside the range),
// out-of-order times, and jumps (a candle's true range more than JUMP_ATR times the mean true range of the 50 before it; CFG.jumpAtr).
// Market hours: crypto 24/7; gold, forex and CME futures close Fri 17:00 – Sun 18:00 New York and halt 17:00-18:00 New York
// daily; CME US holidays (and Christmas / New Year for forex) count as closed. Closed time never counts as stale or as a gap.
// Council data files (9 Nov): in a council-data checkout it also runs council/datahealth.mjs over every file the site and the council
// read (freshness per file and cadence, parse errors, sanity bands, cross-file checks) → the pseudo-feed `feeds.files` (the Data chip
// lists it, the same alert path pages its bad files as "Council data problem") and `brief` (one-glance status for the desk / digest).
import fs from 'node:fs';
import path from 'node:path';
import { sendAlerts, when, NTFY_DEFAULT, SITE } from './alerts.mjs';
import { cleanBars } from './clean.mjs';
import { writeAtomic } from './jsonio.mjs';
import { MARKETS as ICT_MARKETS } from '../ict/tracker.mjs';
import { cmeShut } from '../ict/calendar.mjs';

export const CFG = {
  step: 300,                                   // 5-minute candles
  staleMin: { oanda: 15, kraken: 15, cnbc: 30 },   // CNBC futures are ~10 min delayed
  gapWarnMin: 20, gapBadMin: 60,               // missing open-market time between two candles
  // jump = true range > 25x the mean true range of the prior 50 (floor 2 bp of price). Calibrated 7 Nov on 17 days of OANDA 5m
  // candles: real news peaks at 9-12x, the AUD jobs report (15 Oct 00:30Z) at 21.7x; the Trader's own cleaner clips at 50x the median.
  jumpAtr: 25, atrN: 50, atrFloorBps: 2,
  window: 72,                                  // gaps and jumps: the last 72 candles (6 h of trading); prices: everything fetched
  minBars: 60,
  confirm: 2,                                  // a market must be bad on 2 checks in a row before it alerts (one failed request is not an outage)
  remindH: 12, minGapMin: 30,                  // reminder while the same markets stay bad; at most one new-problem alert per 30 min
};
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
export const FEEDS = {
  oanda: { label: 'OANDA spot (md/bars)', markets: { xau: { sym: 'xau', hours: 'metal', label: 'XAU/USD' }, eurusd: { sym: 'eurusd', hours: 'fx', label: 'EUR/USD' },
    gbpusd: { sym: 'gbpusd', hours: 'fx', label: 'GBP/USD' }, audusd: { sym: 'audusd', hours: 'fx', label: 'AUD/USD' }, usdcad: { sym: 'usdcad', hours: 'fx', label: 'USD/CAD' },
    usdchf: { sym: 'usdchf', hours: 'fx', label: 'USD/CHF' } } },
  kraken: { label: 'Kraken', markets: { btc: { sym: 'XBTUSD', hours: 'crypto', label: 'BTC/USD' }, eth: { sym: 'ETHUSD', hours: 'crypto', label: 'ETH/USD' },
    sol: { sym: 'SOLUSD', hours: 'crypto', label: 'SOL/USD' }, xrp: { sym: 'XRPUSD', hours: 'crypto', label: 'XRP/USD' } } },
  cnbc: { label: 'CNBC futures (ICT desk)', markets: Object.fromEntries(Object.entries(ICT_MARKETS).map(([k, M]) => [k, { sym: M.cnbc[0], alt: M.cnbc.slice(1), hours: 'cme', label: M.short }])) },
};

// ─── market hours (New York wall clock) ───
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function ny(t) { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { y: +o.year, d: `${o.year}-${o.month}-${o.day}`, wd: WD[o.weekday], m: (+o.hour % 24) * 60 + +o.minute }; }
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const nthWd = (y, m, wd, n) => { if (n > 0) { const f = new Date(Date.UTC(y, m, 1)).getUTCDay(); return iso(y, m, 1 + ((wd - f + 7) % 7) + 7 * (n - 1)); }
  const last = new Date(Date.UTC(y, m + 1, 0)), l = last.getUTCDay(); return iso(y, m, last.getUTCDate() - ((l - wd + 7) % 7)); };
const observed = (y, m, d) => { const w = new Date(Date.UTC(y, m, d)).getUTCDay(); return iso(y, m, d + (w === 6 ? -1 : w === 0 ? 1 : 0)); };
function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
  h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, mo - 1, da); }
const HOL = new Map();
// CME US holidays: 'closed' all day, or 'early' (no trading after 13:00 New York)
export function usHolidays(y) {
  if (HOL.has(y)) return HOL.get(y);
  const h = new Map([[observed(y, 0, 1), 'closed'], [nthWd(y, 0, 1, 3), 'early'], [nthWd(y, 1, 1, 3), 'early'], [new Date(easter(y) - 2 * 86400e3).toISOString().slice(0, 10), 'closed'],
    [nthWd(y, 4, 1, -1), 'early'], [observed(y, 5, 19), 'early'], [observed(y, 6, 4), 'early'], [nthWd(y, 8, 1, 1), 'early'], [nthWd(y, 10, 4, 4), 'early'],
    [iso(y, 10, +nthWd(y, 10, 4, 4).slice(8) + 1), 'early'], [iso(y, 11, 24), 'early'], [observed(y, 11, 25), 'closed']]);
  HOL.set(y, h); return h;
}
// is the market trading at unix time t? hours: 'crypto' | 'fx' | 'metal' | 'cme'
export function sessionOpen(hours, t) {
  if (hours === 'crypto') return true;
  const p = ny(t);
  if (p.wd === 6 || (p.wd === 5 && p.m >= 1020) || (p.wd === 0 && p.m < 1080) || (p.m >= 1020 && p.m < 1080)) return false;
  const md = p.d.slice(5);
  if (hours === 'fx') return !(md === '12-25' || md === '01-01' || ((md === '12-24' || md === '12-31') && p.m >= 780));
  if (hours === 'cme') return !cmeShut(t);   // the ICT desk's own CME calendar (eve of a full holiday, 3 July, 31 Dec 2021 open): one source of truth
  const hol = usHolidays(p.y).get(p.d);
  return !(hol === 'closed' || (hol === 'early' && p.m >= 780));
}
// seconds of open market in [a, b), sampled each minute
export function openSecs(hours, a, b) {
  if (!(b > a)) return 0;
  if (hours === 'crypto') return b - a;
  let s = 0; for (let t = a; t < b; t += 60) if (sessionOpen(hours, t + Math.min(30, (b - t) / 2))) s += Math.min(60, b - t);
  return s;
}

// ─── the checks ───
const tr = (b, p) => Math.max(b.high - b.low, p ? Math.abs(b.high - p.close) : 0, p ? Math.abs(b.low - p.close) : 0);
const utc = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
const r2 = (v) => Math.round(v * 100) / 100;
// One market's candles (oldest first, {time, open, high, low, close}) → { status, issues, ... }. Status: 'ok', 'closed' (market
// shut and nothing wrong), 'warn' (a short gap) or 'bad'.
export function checkBars(bars, { hours, now, staleMin = 15, step = CFG.step } = {}) {
  const issues = [], add = (kind, sev, detail, at) => issues.push({ kind, sev, detail, ...(at ? { at: utc(at) } : {}) });
  if (!Array.isArray(bars) || bars.length < CFG.minBars) { add('error', 'bad', `only ${Array.isArray(bars) ? bars.length : 0} candles`); return finish(issues, { n: Array.isArray(bars) ? bars.length : 0 }, hours, now); }
  let badPx = 0, broken = 0, order = 0, firstPx = null, firstBroken = null, firstOrder = null;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], px = [b.open, b.high, b.low, b.close];
    if (!px.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)) { badPx++; firstPx = firstPx || b; continue; }
    if (b.high < b.low || b.high < Math.max(b.open, b.close) || b.low > Math.min(b.open, b.close)) { broken++; firstBroken = firstBroken || b; }
    if (i && !(b.time > bars[i - 1].time)) { order++; firstOrder = firstOrder || b; }
  }
  if (badPx) add('price', 'bad', `${badPx} candle${badPx > 1 ? 's' : ''} with a zero, negative or missing price`, firstPx.time);
  if (broken) add('candle', 'bad', `${broken} broken candle${broken > 1 ? 's' : ''} (high under low or open/close outside the range)`, firstBroken.time);
  if (order) add('order', 'bad', `${order} candle time${order > 1 ? 's' : ''} out of order or repeated`, firstOrder.time);
  const B = bars.filter((b) => [b.open, b.high, b.low, b.close].every((v) => Number.isFinite(v) && v > 0)), last = B.at(-1);
  // stale: open-market minutes since the last candle ended
  const staleS = last ? openSecs(hours, last.time + step, now) : Infinity;
  if (staleS > staleMin * 60) add('stale', 'bad', `no new candle for ${Math.round(staleS / 60)} open-market minutes (last ${last ? utc(last.time) : 'none'})`);
  // gaps and jumps in the recent window
  let maxJump = 0, gaps = 0, worstGap = 0, worstGapAt = null;
  const from = Math.max(1, B.length - CFG.window);
  for (let i = from; i < B.length; i++) {
    const b = B[i], p = B[i - 1], wall = b.time - p.time;
    if (wall > step) { const miss = openSecs(hours, p.time + step, b.time) / 60;
      if (miss >= CFG.gapWarnMin) { gaps++; if (miss > worstGap) { worstGap = miss; worstGapAt = p.time + step; } } }
    if (wall > 3 * step) continue;   // a reopen or a hole: the move across it is not a candle jump
    let s = 0, n = 0; for (let k = Math.max(1, i - CFG.atrN); k < i; k++) { if (B[k].time - B[k - 1].time > 3 * step) continue; s += tr(B[k], B[k - 1]); n++; }
    if (n < 14) continue;
    const atr = Math.max(s / n, p.close * CFG.atrFloorBps / 1e4), x = tr(b, p) / atr;
    if (x > maxJump) maxJump = x;
    if (x > CFG.jumpAtr) add('jump', 'bad', `candle ${r2(x)}x the average range (${p.close} → ${b.open}/${b.high}/${b.low}/${b.close})`, b.time);
  }
  if (gaps) add('gap', worstGap >= CFG.gapBadMin ? 'bad' : 'warn', `${gaps} gap${gaps > 1 ? 's' : ''} in the last ${CFG.window} candles, longest ${Math.round(worstGap)} open-market minutes`, worstGapAt);
  // prints the Trader's bad-print cleaner would clip (information only: the Trader already removes them)
  let clipped = 0; try { clipped = cleanBars(B.map((b) => ({ ...b }))); } catch (e) { /* info only */ }
  return finish(issues, { n: bars.length, last: last ? new Date(last.time * 1000).toISOString() : null, staleMin: Number.isFinite(staleS) ? Math.round(staleS / 60) : null, maxJump: r2(maxJump), clipped }, hours, now);
}
function finish(issues, info, hours, now) {
  const status = issues.some((x) => x.sev === 'bad') ? 'bad' : issues.length ? 'warn' : sessionOpen(hours, now) ? 'ok' : 'closed';
  return { status, ...info, issues };
}

// ─── fetching (each returns candles or throws) ───
const num = (b) => ({ time: Math.round(+b.time), open: +b.open, high: +b.high, low: +b.low, close: +b.close });
async function getJSON(fetchFn, url, opt = {}) {
  const r = await fetchFn(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(opt.timeout || 15000) });
  let j = null; try { j = await r.json(); } catch (e) { /* not JSON */ }
  if (!r.ok) throw new Error(`HTTP ${r.status}${j && j.error ? ': ' + String(j.error).slice(0, 80) : ''}`);
  if (j == null) throw new Error('not JSON');
  return j;
}
export async function fetchOanda(sym, { fetchFn = fetch, base = process.env.MD_BASE || 'https://meridianx.dev/md/', now } = {}) {
  const j = await getJSON(fetchFn, `${base}bars?sym=${sym}&tf=5m&n=300&r=${Math.floor(now / 60)}`);
  if (j.src !== 'OANDA') throw new Error(`answered from ${j.src || 'an unknown source'}, not OANDA`);
  if (!Array.isArray(j.bars)) throw new Error('no candles in the answer');
  return j.bars.map(num);
}
export async function fetchKraken(pair, { fetchFn = fetch } = {}) {
  const j = await getJSON(fetchFn, `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=5`);
  if (j.error && j.error.length) throw new Error(String(j.error[0]));
  const key = j.result && Object.keys(j.result).find((k) => k !== 'last');
  if (!key || !Array.isArray(j.result[key])) throw new Error('no candles in the answer');
  return j.result[key].map((k) => num({ time: k[0], open: k[1], high: k[2], low: k[3], close: k[4] }));
}
const etH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
const etStamp = (t) => { const p = ny(t), hh = String(Math.floor(p.m / 60)).padStart(2, '0'), mm = String(p.m % 60).padStart(2, '0'); return `${p.d.replaceAll('-', '')}${hh}${mm}00`; };
export async function fetchCnbc(sym, { fetchFn = fetch, now } = {}) {
  const from = Math.floor((now - 4 * 86400) / 3600) * 3600;   // on the hour, as the tracker asks (CNBC anchors bars at the request's start)
  const j = await getJSON(fetchFn, `https://ts-api.cnbc.com/harmony/app/bars/${encodeURIComponent(sym)}/5M/${etStamp(from)}/${etStamp(now + 300)}/adjusted/EST5EDT.json`, { timeout: 30000 });
  const pb = j && j.barData && j.barData.priceBars;
  if (!Array.isArray(pb) || !pb.length) throw new Error(String((j && j.statusMessage) || 'no candles in the answer'));
  // the tracker drops prints in the 17:00-18:00 New York halt (settlement ticks); so does this check. Prices are NOT filtered here.
  return pb.map((b) => num({ time: +b.tradeTimeinMills / 1000, open: b.open, high: b.high, low: b.low, close: b.close }))
    .filter((b) => !Number.isFinite(b.time) || +etH.format(new Date(b.time * 1000)) % 24 !== 17);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// every feed and market → the health record (no alerting here)
export async function runChecks({ fetchFn = fetch, now = Math.floor(Date.now() / 1000), base, pause = 300 } = {}) {
  const feeds = {};
  const one = async (feed, k, M) => {
    const opt = { hours: M.hours, now, staleMin: CFG.staleMin[feed] };
    let lastErr = null;
    for (const sym of [M.sym].concat(M.alt || [])) {
      try {
        const bars = feed === 'oanda' ? await fetchOanda(sym, { fetchFn, base, now }) : feed === 'kraken' ? await fetchKraken(sym, { fetchFn }) : await fetchCnbc(sym, { fetchFn, now });
        return { label: M.label, sym, ...checkBars(bars, opt) };
      } catch (e) { lastErr = String((e && e.message) || e).slice(0, 160); }
    }
    return { label: M.label, sym: M.sym, status: 'bad', n: 0, issues: [{ kind: 'error', sev: 'bad', detail: `unreachable: ${lastErr}` }] };
  };
  // feeds in parallel, markets of one feed one after another (Kraken's public API rate-limits bursts)
  await Promise.all(Object.entries(FEEDS).map(async ([feed, F]) => {
    const markets = {};
    for (const [k, M] of Object.entries(F.markets)) { markets[k] = await one(feed, k, M); if (pause) await sleep(pause); }
    const st = Object.values(markets).map((m) => m.status);
    feeds[feed] = { label: F.label, status: st.includes('bad') ? 'bad' : st.includes('warn') ? 'warn' : st.every((s) => s === 'closed') ? 'closed' : 'ok', markets };
  }));
  const ordered = Object.fromEntries(Object.keys(FEEDS).map((k) => [k, feeds[k]]));
  const st = Object.values(ordered).map((f) => f.status);
  return { at: new Date(now * 1000).toISOString(), status: st.includes('bad') ? 'bad' : st.includes('warn') ? 'warn' : 'ok', feeds: ordered, summary: summarize(ordered) };
}
// what pages: every bad market; an issue marked `quiet` (a council data file whose staleness the watchdog already pages) does not
export function badList(feeds) {
  const out = [];
  for (const [f, F] of Object.entries(feeds || {})) for (const [k, m] of Object.entries(F.markets || {})) {
    const bad = (m.issues || []).filter((x) => x.sev === 'bad' && !x.quiet);
    if (m.status === 'bad' && (bad.length || !(m.issues || []).length)) out.push({ id: `${f}:${k}`, text: `${F.label} ${m.label}: ${bad.map((x) => x.detail).join('; ')}` });
  }
  return out;
}
export function summarize(feeds) {
  const parts = [];
  for (const F of Object.values(feeds)) { const ms = Object.values(F.markets), bad = ms.filter((m) => m.status === 'bad'), warn = ms.filter((m) => m.status === 'warn');
    if (bad.length || warn.length) parts.push(`${F.label}: ${bad.concat(warn).map((m) => `${m.label} ${[...new Set(m.issues.map((x) => x.kind))].join('/')}`).join(', ')}`); }
  return parts.length ? parts.join(' · ') : 'All feeds clean';
}

// ─── alerting, deduplicated ───
// prev = the previous health.json `alert` ({ streak: {id: n}, sent: {key, at, items} }). Returns { ev | null, alert } where
// alert is the state to save once the send went out (or straight away when ev is null).
export function alertDecision(health, prev, now) {
  const p = prev && typeof prev === 'object' ? prev : {}, pst = p.streak || {}, bad = badList(health.feeds), streak = {};
  for (const b of bad) streak[b.id] = (pst[b.id] || 0) + 1;
  const conf = bad.filter((b) => streak[b.id] >= CFG.confirm), key = conf.map((b) => b.id).sort().join('|');
  const sent = p.sent && typeof p.sent.key === 'string' ? p.sent : { key: '', at: null }, last = sent.at ? Date.parse(sent.at) / 1000 : -Infinity;
  const sentIds = new Set(sent.key ? sent.key.split('|') : []), fresh = conf.filter((b) => !sentIds.has(b.id));
  const mark = (k, items) => ({ key: k, at: new Date(now * 1000).toISOString(), items });
  const state = { streak, sent };
  if (conf.length && fresh.length && (!sent.key || now - last >= CFG.minGapMin * 60)) {
    // candle feeds keep their wording; council data files (council/datahealth.mjs, ids files:<path>) say so
    const nf = conf.filter((b) => b.id.startsWith('files:')).length, n = conf.length, s = n > 1 ? 's' : '';
    const title = !nf ? `Data feed problem: ${n} market${s}` : nf === n ? `Council data problem: ${n} file${s}` : `Data problem: ${n} items`;
    const tail = nf === n ? 'Details: Council page → Data chip (health.json).' : 'Check those candles before trusting new signals on them.';
    return { alert: { streak, sent: mark(key, conf.map((b) => b.text)) }, ev: { title,
      msg: `${conf.map((b) => '• ' + b.text).join('\n')}\n${tail}\n${when(now)}`, tags: 'warning', click: SITE } };
  }
  if (conf.length && !fresh.length && now - last >= CFG.remindH * 3600) {
    return { alert: { streak, sent: mark(key, conf.map((b) => b.text)) }, ev: { title: 'Data feed problem continues', msg: `${conf.map((b) => '• ' + b.text).join('\n')}\n${when(now)}`, tags: 'warning', click: SITE } };
  }
  if (!bad.length && sent.key) {
    return { alert: { streak, sent: mark('', []) }, ev: { title: 'Data feeds back to normal', msg: `Clean again: ${(sent.items || []).map((s) => s.split(':')[0]).join(', ') || sent.key}.\n${when(now)}`, tags: 'white_check_mark', click: SITE } };
  }
  return { alert: state, ev: null };
}

export async function main(dir, { env = process.env, fetchFn = fetch, now = Math.floor(Date.now() / 1000), pause, files = true } = {}) {
  const file = path.join(dir, 'health.json'), rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
  const prev = rd('health.json');
  const health = await runChecks({ fetchFn, now, pause });
  // the council data files (council/datahealth.mjs, 9 Nov): only in a council-data checkout; a bug there never stops the candle check
  if (files && fs.existsSync(path.join(dir, 'snapshot.json'))) {
    try {
      const { checkFiles, fsReader, asFeed } = await import('./datahealth.mjs');
      health.feeds.files = asFeed(checkFiles(fsReader(dir), now, { skip: ['health.json'] }));
      const st = Object.values(health.feeds).map((f) => f.status);
      health.status = st.includes('bad') ? 'bad' : st.includes('warn') ? 'warn' : 'ok'; health.summary = summarize(health.feeds);
    } catch (e) { health.filesError = String((e && e.message) || e).slice(0, 160); }
  }
  try { health.brief = (await import('./datahealth.mjs')).brief(health.feeds); } catch (e) { /* summary only */ }
  const d = alertDecision(health, prev && prev.alert, now);
  health.alert = d.alert;
  if (d.ev) {
    const quiet = env.COUNCIL_ALERTS === 'off', topic = quiet ? null : env.NTFY_TOPIC || NTFY_DEFAULT, tgTok = quiet ? null : env.TELEGRAM_BOT_TOKEN || null;
    const tgChat = env.TELEGRAM_CHAT_ID || (rd('state.json') || {}).tgChat || null, tried = (topic ? 1 : 0) + (tgTok && tgChat ? 1 : 0);
    const errors = tried ? await sendAlerts([d.ev], { topic, tgTok, tgChat, fetchFn }) : {};
    // nothing went out (every channel failed): keep the old mark so the next check tries again
    if (tried && Object.keys(errors).length >= tried) { health.alert = { streak: d.alert.streak, sent: (prev && prev.alert && prev.alert.sent) || { key: '', at: null } }; health.alertError = errors; }
    else if (tried) health.lastAlert = { at: health.at, title: d.ev.title };
  }
  if (!health.lastAlert && prev && prev.lastAlert) health.lastAlert = prev.lastAlert;
  health.cfg = { staleMin: CFG.staleMin, jumpAtr: CFG.jumpAtr, gapWarnMin: CFG.gapWarnMin, gapBadMin: CFG.gapBadMin, window: CFG.window, confirm: CFG.confirm };
  fs.mkdirSync(dir, { recursive: true });
  writeAtomic(file, JSON.stringify(health, null, 1));
  return health;
}

if (process.argv[1] && process.argv[1].endsWith('datacheck.mjs')) {
  main(process.argv[2] || 'data').then((h) => {
    console.log(`Data check ${h.status}: ${h.summary}${h.brief ? `\n  ${h.brief.line}` : ''}`);
    for (const [f, F] of Object.entries(h.feeds)) console.log(`  ${f}: ${F.status} — ${Object.entries(F.markets).filter(([, m]) => f !== 'files' || m.status !== 'ok').map(([k, m]) => `${k} ${m.status}${m.staleMin ? ` (${m.staleMin}m)` : ''}${m.maxJump ? ` j${m.maxJump}` : ''}`).join(', ')}`);
    if (h.alertError) console.log('  alert not sent:', JSON.stringify(h.alertError));
  }).catch((e) => { console.log('Data check failed:', (e && e.message) || e); });   // never fails the round
}
