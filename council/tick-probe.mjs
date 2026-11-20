// Tick probe (20 Nov 2026): what the DEMO broker's own bid / ask history can tell the research, read once by hand.
//   node council/tick-probe.mjs <dataDir> [SYMBOL ...]   (workflow tick-probe.yml, dispatch only) -> <dataDir>/research/probe/ticks-<SYMBOL>.json
//
// Why: the open research questions are cost questions (research/proposals/2026-11-14-gold-vol-breakout.md: "what a round trip
// really costs at 00:00-07:00 UTC"; the owner's news register, research/macro-veteran/references/news-trading-strategy-
// register-v2-2026-11-19.md, step 1: "collect executable demo bid / ask around CPI and payrolls"). The broker keeps past ticks
// of both sides; reading them answers in one run what a forward log would take months to collect, as far back as they go.
// Three parts, one file per symbol:
//   depth     ticks of each side in a 2-minute window (Wednesday 14:00 UTC) at 1, 7, 30, 90, 180, 365, 730 and 1095 days back:
//             how far the history reaches.
//   hours     the quoted spread (ask - bid at every tick of either side) in the first 2 minutes of every UTC hour of the last
//             HOUR_DAYS weekdays: median, 90th percentile and max per hour, and per weekday-hour sample.
//   events    every US CPI, payrolls and FOMC statement of council/events.mjs (HISTORY + EVENTS) that is inside the depth: the last
//             bid and ask at or before each mark from T-10 to T+65 minutes (one a minute, and T+5 s, T+15 s, T+30 s), and the
//             widest spread of each minute. Raw executable prices, so a later pre-registered study can trade them bid / ask.
// READ ONLY and DEMO only, like council/ctrader-symbols.mjs: api/ctrader-link.js's read session (its READ_ONLY allowlist has no
// trading message), CTRADER_ENV=demo, an account that reports isLive:false. Nothing is traded, sized or alerted; no account
// number, login or token is written. Historical tick requests are spaced (at most 4 a second). It writes research data only:
// no council member reads it.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { unseal, scrubber, normName } from './ctrader-mirror.mjs';
import { HISTORY, EVENTS } from './events.mjs';
import { decodeTicks } from './ctrader-symbols.mjs';
import { isGotobi } from './gotobi-calendar.mjs';
const require = createRequire(import.meta.url);
const { _t } = require('../api/ctrader-link.js');

export const DEPTH_DAYS = [1, 7, 30, 90, 180, 365, 730, 1095];
export const HOUR_DAYS = 60, HOUR_WIN = 120;          // seconds read at the top of each hour
export const EV_FROM = -600, EV_TO = 3900;           // T-10 min .. T+65 min
export const EV_TYPES = ['CPI', 'NFP', 'FOMC'];
export const MAX_PAGES = 40, GAP_MS = 260;
// gotobi (20 Nov 2026, research/edge/gotobi-exec): the bid and ask at 00:55:00 and 06:00:00 UTC of every gotobi day inside the
// history (council/gotobi-calendar.mjs, the demo job's calendar), with the median quoted spread in +-GOTOBI_HALF seconds
export const GOTOBI_MARKS = [55 * 60, 6 * 3600], GOTOBI_HALF = 60;
export const PARTS = ['depth', 'hours', 'events', 'gotobi', 'marks', 'fills'];
// marks (20 Nov 2026, research/edge/fx-weekend-gap-exec): the bid, ask and spread at given moments, read from a JSON file
// { SYMBOL: [unix sec, ...] } named by PROBE_MARKS (a path in the repository); at most MARKS_MAX a symbol
export const MARKS_HALF = 60, MARKS_MAX = 600;
// how far before a mark the quote may be looked for: PROBE_MARKS_BACK seconds (60 to 3600, default 60), for a mark that falls
// in a daily break (gold's 21:00 UTC exit on US summer-time days, research/edge/gold-vol-breakout-exec)
export const marksBack = (env) => { const v = Math.round(+(env && env.PROBE_MARKS_BACK) || 0); return v > MARKS_HALF ? Math.min(3600, v) : MARKS_HALF; };
// fills (20 Nov 2026, research/edge/gold-vol-breakout-exec): for each query [id, t0, t1, level, dir] of the PROBE_MARKS file's
// "fills" object { SYMBOL: [...] }, the first broker tick in [t0, t1] (unix sec) where ask >= level (dir > 0) or bid <= level
// (dir < 0): [id, tickMs, bid, ask], or [id, null] when none; windows of at most FILLS_SPAN seconds, at most FILLS_MAX a symbol
export const FILLS_SPAN = 1800, FILLS_MAX = 4000;
export function firstCross(qp, level, dir) { for (const q of qp) if (dir > 0 ? q[2] >= level : q[1] <= level) return q; return null; }
// "USDJPY:depth,gotobi" -> { name, parts }; a bare name reads depth, hours and events
export function parseName(arg) { const [name, p] = String(arg).split(':'); const parts = p ? p.split(',').filter((x) => PARTS.includes(x)) : ['depth', 'hours', 'events']; if (!parts.includes('depth')) parts.unshift('depth'); return { name, parts }; }
// the gotobi days (UTC dates) from `from` (unix sec) to now whose 06:00 mark has passed, oldest first
export function gotobiDays(from, nowSec) {
  const o = []; for (let d = Math.floor(from / 86400) * 86400; d + GOTOBI_MARKS[1] + GOTOBI_HALF < nowSec; d += 86400) { const ymd = new Date(d * 1000).toISOString().slice(0, 10); if (isGotobi(ymd)) o.push({ day: ymd, t: d }); }
  return o;
}

const med = (a) => { const v = a.slice().sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
const pct = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null; };
const r6 = (x) => (x == null ? null : +(+x).toPrecision(6));

// the merged quote path: at every tick of either side, [ms, bid, ask] once both sides are known (each side's last price at or
// before that moment), oldest first
export function quotePath(bids, asks) {
  const ev = [...bids.map((x) => [x[0], 0, x[1]]), ...asks.map((x) => [x[0], 1, x[1]])].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let b = null, a = null; const o = [];
  for (const [t, k, p] of ev) { if (k === 0) b = p; else a = p; if (b != null && a != null) o.push([t, b, a]); }
  return o;
}
// spreads (ask - bid, negatives dropped) of a quote path
export const spreadsOf = (qp) => qp.map((q) => q[2] - q[1]).filter((s) => s >= 0);
// the last bid and ask at or before each mark (unix sec), from a quote path; null where no quote yet
export function marksAt(qp, marks) {
  const o = []; let i = 0, last = null;
  for (const m of marks) { while (i < qp.length && qp[i][0] <= m * 1000) last = qp[i++]; o.push(last ? [r6(last[1]), r6(last[2])] : null); }
  return o;
}
// the widest spread inside each [m, m + width) window
export function widest(qp, starts, width = 60) {
  return starts.map((s) => { const v = qp.filter((q) => q[0] >= s * 1000 && q[0] < (s + width) * 1000).map((q) => q[2] - q[1]).filter((x) => x >= 0); return v.length ? r6(Math.max(...v)) : null; });
}
// the event marks: T+5 s, T+15 s, T+30 s and every whole minute from EV_FROM to EV_TO
export function eventMarks(t) { const o = []; for (let s = EV_FROM; s <= EV_TO; s += 60) o.push(t + s); return [...o, t + 5, t + 15, t + 30].sort((a, b) => a - b); }
// the probe's dates: 14:00 UTC on the Wednesday at or before each depth day
export function depthTimes(nowSec) {
  return DEPTH_DAYS.map((d) => { let t = Math.floor((nowSec - d * 86400) / 86400) * 86400; while (new Date(t * 1000).getUTCDay() !== 3) t -= 86400; return { days: d, t: t + 14 * 3600 }; });
}
// the hour marks of the last `days` weekdays that have ended, oldest first
export function hourMarks(nowSec, days = HOUR_DAYS) {
  const o = [], day0 = Math.floor(nowSec / 86400) * 86400;
  for (let d = days; d >= 1; d--) { const day = day0 - d * 86400, w = new Date(day * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    for (let h = 0; h < 24; h++) { const t = day + h * 3600; if (t + HOUR_WIN <= nowSec) o.push(t); } }
  return o;
}
// the events to read: US CPI, payrolls and FOMC statements from `from` (unix sec) to now, oldest first
export function eventList(from, nowSec, list = [...HISTORY, ...EVENTS]) {
  const seen = new Set();
  return list.filter((e) => EV_TYPES.includes(e.type) && e.t >= from && e.t + EV_TO < nowSec && !seen.has(e.type + e.t) && seen.add(e.type + e.t))
    .sort((a, b) => a.t - b.t).map((e) => ({ type: e.type, t: e.t, at: new Date(e.t * 1000).toISOString() }));
}
// summary of the hour profile: per UTC hour, the median / 90th percentile / max of the per-window median spreads, n windows,
// and the same median / 90th percentile as a share of the window's mid price (frac, frac90)
export function hourProfile(rows) {
  const by = Array.from({ length: 24 }, () => []);
  for (const r of rows) if (r.median != null) by[new Date(r.t * 1000).getUTCHours()].push(r);
  return by.map((v, h) => { const f = v.filter((r) => r.mid > 0).map((r) => r.median / r.mid);
    return { hour: h, n: v.length, median: r6(med(v.map((r) => r.median))), p90: r6(pct(v.map((r) => r.median), 0.9)), max: r6(v.length ? Math.max(...v.map((r) => r.max)) : null),
      frac: f.length ? r6(med(f)) : null, frac90: f.length ? r6(pct(f, 0.9)) : null }; });
}

// every tick of one side between from and to (ms): the broker answers in pages (newest first, hasMore while older ticks remain);
// the next page ends just before the oldest tick of the last one
export async function readSide(send, ctid, symbolId, type, fromMs, toMs, sleep) {
  let to = toMs, all = [], pages = 0;
  for (;;) {
    await sleep(GAP_MS);
    const r = await send({ ctidTraderAccountId: ctid, symbolId, type, fromTimestamp: fromMs, toTimestamp: to });
    const ticks = decodeTicks(r && r.tickData); pages++;
    all = ticks.concat(all);
    if (!(r && r.hasMore) || !ticks.length || pages >= MAX_PAGES) return { ticks: all.filter((x, i, a) => i === 0 || x[0] !== a[i - 1][0] || x[1] !== a[i - 1][1]).sort((a, b) => a[0] - b[0]), partial: !!(r && r.hasMore) };
    to = ticks[0][0] - 1;
  }
}

export async function probe({ env, tokens = null, names = ['XAUUSD'], marks = {}, WS = globalThis.WebSocket, now = Date.now(), lib = _t, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} }) {
  const need = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'];
  if (need.some((k) => !String(env[k] || '').trim())) return { error: 'cTrader settings missing' };
  if (String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') return { error: 'refused: CTRADER_ENV is not demo' };
  const env2 = { ...env, CTRADER_CLIENT_ID: String(env.CTRADER_CLIENT_ID).trim(), CTRADER_CLIENT_SECRET: String(env.CTRADER_CLIENT_SECRET).trim() };
  let accessToken = String(env.CTRADER_ACCESS_TOKEN).trim();
  try { const t = tokens && unseal(tokens, env); if (t && t.accessToken) accessToken = t.accessToken; } catch (e) {}
  const id = String(env.CTRADER_ACCOUNT_ID).trim(), accounts = await lib.readAccounts(WS, accessToken, env2);
  const acc = accounts.find((a) => a.id === id) || accounts.find((a) => a.login === id);
  if (!acc) return { error: 'account not found for this token' };
  if (acc.live) return { error: 'refused: not a demo account' };
  const P = lib.PT, s = lib.session(WS, lib.HOSTS.demo), ctid = Number(acc.id), nowSec = Math.floor(now / 1000), out = {};
  try {
    await s.send(P.APP_AUTH_REQ, { clientId: env2.CTRADER_CLIENT_ID, clientSecret: env2.CTRADER_CLIENT_SECRET });
    await s.send(P.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: ctid, accessToken });
    const list = await s.send(P.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid });
    const light = new Map((list.symbol || []).filter((x) => x.enabled !== false).map((x) => [normName(x.symbolName), x]));
    const send = (q) => s.send(P.GET_TICKDATA_REQ, q);
    for (const arg of names) {
      const { name, parts } = parseName(arg);
      const L = light.get(normName(name)); if (!L) { out[name] = { error: 'not listed by the broker' }; continue; }
      const sid = Number(L.symbolId), errors = [];
      const window = async (fromS, toS) => {
        try { const b = await readSide(send, ctid, sid, 1, fromS * 1000, toS * 1000, sleep), a = await readSide(send, ctid, sid, 2, fromS * 1000, toS * 1000, sleep);
          return { qp: quotePath(b.ticks, a.ticks), nb: b.ticks.length, na: a.ticks.length, partial: b.partial || a.partial }; }
        catch (e) { errors.push(String((e && e.message) || e).slice(0, 160)); return null; }
      };
      // depth
      const depth = [];
      for (const d of depthTimes(nowSec)) { const w = await window(d.t, d.t + 120); depth.push({ days: d.days, at: new Date(d.t * 1000).toISOString(), bids: w ? w.nb : null, asks: w ? w.na : null }); }
      const reach = depth.filter((d) => d.bids > 0 && d.asks > 0).reduce((m, d) => Math.max(m, d.days), 0);
      log(`${name}: history reaches about ${reach} days back`);
      // hours (inside the reach only)
      const hours = [];
      if (parts.includes('hours')) for (const t of hourMarks(nowSec, Math.min(HOUR_DAYS, reach || 1))) {
        const w = await window(t, t + HOUR_WIN); if (!w) continue;
        const sp = spreadsOf(w.qp), mid = w.qp.length ? med(w.qp.map((q) => (q[1] + q[2]) / 2)) : null;
        hours.push({ t, n: sp.length, median: sp.length ? r6(med(sp)) : null, max: sp.length ? r6(Math.max(...sp)) : null, mid: r6(mid) });
      }
      log(`${name}: ${hours.length} hour windows`);
      // events (inside the reach only)
      const events = [];
      if (parts.includes('events')) for (const e of eventList(reach ? nowSec - reach * 86400 : nowSec, nowSec)) {
        const w = await window(e.t + EV_FROM, e.t + EV_TO); if (!w) continue;
        const marks = eventMarks(e.t), mins = []; for (let s0 = EV_FROM; s0 < EV_TO; s0 += 60) mins.push(e.t + s0);
        events.push({ ...e, ticks: w.qp.length, partial: w.partial || undefined, marks: marks.map((m) => m - e.t), quotes: marksAt(w.qp, marks), widest: widest(w.qp, mins) });
      }
      log(`${name}: ${events.length} events`);
      const gotobi = [];
      if (parts.includes('gotobi')) for (const g of gotobiDays(reach ? nowSec - reach * 86400 : nowSec, nowSec)) {
        const row = { day: g.day };
        for (const m of GOTOBI_MARKS) { const t = g.t + m, w = await window(t - GOTOBI_HALF, t + GOTOBI_HALF); if (!w) continue;
          const before = w.qp.filter((q) => q[0] <= t * 1000), last = before[before.length - 1], sp = spreadsOf(w.qp);
          row[m === GOTOBI_MARKS[0] ? 'entry' : 'exit'] = { bid: last ? r6(last[1]) : null, ask: last ? r6(last[2]) : null, ageS: last ? Math.round(t - last[0] / 1000) : null, spread: sp.length ? r6(med(sp)) : null, n: sp.length }; }
        gotobi.push(row);
      }
      if (parts.includes('gotobi')) log(`${name}: ${gotobi.length} gotobi days`);
      const quotes = [];
      if (parts.includes('marks')) for (const t of (Array.isArray(marks[name]) ? marks[name] : []).filter((x) => Number.isFinite(x) && x + MARKS_HALF < nowSec).slice(0, MARKS_MAX)) {
        const w = await window(t - marksBack(process.env), t + MARKS_HALF); if (!w) continue;
        const before = w.qp.filter((q) => q[0] <= t * 1000), last = before[before.length - 1], sp = spreadsOf(w.qp);
        quotes.push([t, last ? r6(last[1]) : null, last ? r6(last[2]) : null, last ? Math.round(t - last[0] / 1000) : null, sp.length ? r6(med(sp)) : null]);
      }
      if (parts.includes('marks')) log(`${name}: ${quotes.length} marks`);
      const fills = [], FQ = (marks && marks.fills && Array.isArray(marks.fills[name])) ? marks.fills[name] : [];
      if (parts.includes('fills')) for (const [id, t0, t1, level, dir] of FQ.filter((q) => Array.isArray(q) && q[2] > q[1] && q[2] - q[1] <= FILLS_SPAN && q[2] < nowSec).slice(0, FILLS_MAX)) {
        const w = await window(t0, t1); if (!w) continue;
        const c = firstCross(w.qp.filter((q) => q[0] >= t0 * 1000), +level, +dir);
        fills.push(c ? [id, c[0], r6(c[1]), r6(c[2])] : [id, null]);
      }
      if (parts.includes('fills')) log(`${name}: ${fills.length} fill queries`);
      out[name] = { symbolId: sid, digits: L.digits ?? null, parts, reachDays: reach, depth, hourProfile: hourProfile(hours), hours, events, ...(parts.includes('gotobi') ? { gotobi } : {}), ...(parts.includes('marks') ? { marks: quotes } : {}), ...(parts.includes('fills') ? { fills } : {}), errors };
    }
  } finally { s.close(); }
  return { at: new Date(now).toISOString(), source: 'council/tick-probe.mjs', broker: acc.broker || null, symbols: out };
}

if (process.argv[1] && process.argv[1].endsWith('tick-probe.mjs')) {
  const dir = process.argv[2] || 'data', names = process.argv.slice(3).length ? process.argv.slice(3) : ['XAUUSD'];
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'ctrader', f), 'utf8')); } catch (e) { return null; } };
  const scrub = scrubber(process.env), tokens = rd('tokens.json');
  try { const t = tokens && unseal(tokens, process.env); if (t) scrub.add(t.accessToken, t.refreshToken); } catch (e) {}
  try {
    let marks = {}; if (process.env.PROBE_MARKS) { try { marks = JSON.parse(fs.readFileSync(process.env.PROBE_MARKS, 'utf8')); } catch (e) { console.log('tick probe: marks file unreadable'); } }
    const r = await probe({ env: process.env, tokens, names, marks, log: (l) => console.log(scrub(l)) });
    if (r.error) { console.log(`tick probe: ${scrub(r.error)}`); process.exit(1); }
    const OD = path.join(dir, 'research', 'probe'); fs.mkdirSync(OD, { recursive: true });
    for (const [n, v] of Object.entries(r.symbols)) {
      if (v.errors) v.errors = v.errors.map(scrub);
      fs.writeFileSync(path.join(OD, `ticks-${n}${/^[a-z0-9-]{1,20}$/.test(process.env.PROBE_TAG || '') ? '-' + process.env.PROBE_TAG : ''}.json`), JSON.stringify({ at: r.at, source: r.source, broker: r.broker, symbol: n, ...v }));
      console.log(`tick probe ${n}: reach ${v.reachDays ?? '?'} days, ${(v.hours || []).length} hours, ${(v.events || []).length} events${v.errors && v.errors.length ? `, ${v.errors.length} errors` : ''}`);
    }
  } catch (e) { console.log(`tick probe failed: ${scrub(e.message || e)}`); process.exit(1); }
}
