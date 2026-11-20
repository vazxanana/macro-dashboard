// Hard-to-find macro data (20 Nov 2026, owner: "Hard to find information will play a big role here, try to get it").
// Keyless public sources, each checked from a GitHub runner before this was written (scripts/macro-probe.mjs, probe runs of
// 20 Nov 2026), read once a macro round and written to council-data macro/hard-data.json:
//  - the Cleveland Fed's inflation nowcast (CPI, core CPI, PCE, core PCE, month on month) for the months not yet released:
//    a model's estimate of the next prints, published daily (clevelandfed.org nowcast_month.json);
//  - the Atlanta Fed's GDPNow for the current quarter (FRED series GDPNOW);
//  - the market-implied odds of the next Fed decision from two prediction markets (Kalshi's KXFEDDECISION event, Polymarket's
//    "Fed decision in <month>" event): what traders are paying, not a forecast of ours;
//  - the Fed's own calendar of speeches, testimony and releases (federalreserve.gov/json/calendar.json).
// A source that fails keeps its last good copy (with its own `at`); nothing here is a rule, a call or a trade.
import fs from 'node:fs';
import path from 'node:path';
import { EVENTS } from './events.mjs';

const UA = { 'user-agent': 'Mozilla/5.0 (macro desk; public data)', accept: '*/*' };
export const SRC = {
  nowcast: 'https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json?sc_lang=en',
  gdpnow: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDPNOW',
  fedcal: 'https://www.federalreserve.gov/json/calendar.json',
  kalshi: (ev) => `https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=${ev}`,
  poly: (q) => `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(q)}`,
};
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const num = (x) => { const v = parseFloat(x); return Number.isFinite(v) ? v : null; };
const r2 = (x) => x == null ? null : Math.round(x * 100) / 100;

// Cleveland Fed nowcast: an array of charts, one per target month (`chart.subcaption` 'YYYY-MM', `chart._comment` the update
// time); each dataset a series (CPI / Core CPI / PCE / Core PCE Inflation, and their "Actual" prints); the last non-empty value of a
// series is its latest nowcast. Returned: the last `keep` target months, newest last.
const SERIES = { 'CPI Inflation': 'cpi', 'Core CPI Inflation': 'coreCpi', 'PCE Inflation': 'pce', 'Core PCE Inflation': 'corePce' };
export function parseNowcast(J, keep = 3) {
  if (!Array.isArray(J)) return null;
  const months = [];
  for (const c of J.slice(-keep)) {
    const m = c && c.chart && /^\d{4}-\d{2}$/.test(c.chart.subcaption || '') ? c.chart.subcaption : null; if (!m) continue;
    const row = { month: m, asOf: String(c.chart._comment || '').slice(0, 10) || null, now: {}, actual: {} };
    for (const d of c.dataset || []) {
      const name = String(d.seriesname || ''), act = /^Actual /.test(name), k = SERIES[name.replace(/^Actual /, '')]; if (!k) continue;
      const vals = (d.data || []).map((x) => num(x && x.value)).filter((v) => v != null);
      if (vals.length) (act ? row.actual : row.now)[k] = r2(vals[vals.length - 1]);
    }
    months.push(row);
  }
  return months.length ? { months } : null;
}

// FRED GDPNOW: the latest row is the current quarter's nowcast (annualized %).
export function parseGdpNow(csv) {
  const rows = String(csv || '').trim().split(/\r?\n/).slice(1).map((l) => l.split(',')).filter((r) => r.length === 2 && num(r[1]) != null);
  if (!rows.length) return null;
  const [d, v] = rows[rows.length - 1], q = Math.floor((+d.slice(5, 7) - 1) / 3) + 1;
  return { quarter: `${d.slice(0, 4)} Q${q}`, value: r2(num(v)), prev: rows.length > 1 ? r2(num(rows[rows.length - 2][1])) : null };
}

// The Fed's calendar: speeches, testimony, the FOMC, minutes and the Beige Book in [from, to] (New York dates 'YYYY-MM-DD').
const KEEP = /^(Speeches|Testimony|FOMC|Beige)$/;
const unesc = (s) => String(s || '').replace(/&quot;/g, '"').replace(/&#8217;/g, '’').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
export function parseFedCal(J, from, to) {
  const ev = J && Array.isArray(J.events) ? J.events : [];
  const out = [];
  for (const e of ev) {
    if (!KEEP.test(e.type || '') || !/^\d{4}-\d{2}$/.test(e.month || '')) continue;
    for (const dd of String(e.days || '').split(/[,\s]+/).filter(Boolean)) {
      const day = `${e.month}-${String(+dd).padStart(2, '0')}`; if (!(day >= from && day <= to)) continue;
      out.push({ day, time: unesc(e.time).slice(0, 20) || null, type: e.type, title: unesc(e.title).slice(0, 120), topic: unesc(e.description).slice(0, 140) || null });
    }
  }
  const t = (x) => { const m = /(\d{1,2}):(\d{2})\s*([ap])/i.exec(x.time || ''); return m ? ((+m[1] % 12) + (/p/i.test(m[3]) ? 12 : 0)) * 60 + +m[2] : 0; };
  return out.sort((a, b) => a.day.localeCompare(b.day) || t(a) - t(b));
}

// The next FOMC decision from the council's schedule (council/events.mjs).
export function nextFomc(now) {
  const e = EVENTS.filter((x) => x.type === 'FOMC' && x.t > now).sort((a, b) => a.t - b.t)[0];
  if (!e) return null;
  const d = new Date(e.t * 1000);
  return { t: e.t, at: e.at, day: d.toISOString().slice(0, 10), kalshi: `KXFEDDECISION-${String(d.getUTCFullYear()).slice(2)}${MON[d.getUTCMonth()]}`,
    poly: `fed decision in ${MONTH[d.getUTCMonth()].toLowerCase()} ${d.getUTCFullYear()}` };
}
// Kalshi: one binary market per outcome; the price is the middle of the bid and ask when both stand, else the last trade.
export function parseKalshi(J) {
  const ms = J && Array.isArray(J.markets) ? J.markets : [];
  const out = ms.map((m) => {
    const bid = num(m.yes_bid_dollars), ask = num(m.yes_ask_dollars), last = num(m.last_price_dollars);
    const p = bid != null && ask != null && ask > 0 && ask >= bid ? (bid + ask) / 2 : last;
    return { label: String(m.yes_sub_title || m.subtitle || m.ticker || '').slice(0, 40), p: p == null ? null : r2(p), oi: num(m.open_interest_fp) };
  }).filter((m) => m.label && m.p != null);
  return out.length ? out.sort((a, b) => b.p - a.p) : null;
}
// Polymarket: the search's event whose end date is within three days after the meeting; each market's first outcome price.
export function parsePoly(J, meetingT) {
  const evs = J && Array.isArray(J.events) ? J.events : [];
  const e = evs.find((x) => /fed decision/i.test(x.title || '') && Math.abs(Date.parse(x.endDate) / 1000 - meetingT) < 3 * 86400);
  if (!e) return null;
  const out = (e.markets || []).map((m) => { let pr = m.outcomePrices; try { if (typeof pr === 'string') pr = JSON.parse(pr); } catch (x) { pr = null; }
    return { label: String(m.groupItemTitle || m.question || '').slice(0, 40), p: Array.isArray(pr) ? r2(num(pr[0])) : null }; }).filter((m) => m.label && m.p != null);
  return out.length ? { title: String(e.title || '').slice(0, 80), markets: out.sort((a, b) => b.p - a.p) } : null;
}

// One plain sentence on the Fed odds: the leading outcome on each market.
export function oddsLine(o) {
  if (!o) return null;
  const top = (l) => l && l[0] ? `${l[0].label} ${Math.round(l[0].p * 100)}%` : null;
  const k = top(o.kalshi), p = top(o.polymarket && o.polymarket.markets);
  if (!k && !p) return null;
  const d = new Date(o.meeting + 'T12:00:00Z'), when = Number.isFinite(d.getTime()) ? `${d.getUTCDate()} ${MONTH[d.getUTCMonth()].slice(0, 3)}` : o.meeting;
  return `Prediction markets on the ${when} Fed decision: ${[k && `Kalshi ${k}`, p && `Polymarket ${p}`].filter(Boolean).join(', ')}. What traders pay, not a forecast of ours.`;
}

async function getText(fetchFn, url, ms = 30000) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms);
  try { const r = await fetchFn(url, { headers: UA, signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); } finally { clearTimeout(to); }
}

// Fetch everything; a failed part keeps `prev`'s copy of it. `now` in unix seconds.
export async function collect({ now = Math.floor(Date.now() / 1000), fetchFn = fetch, prev = null, log = () => {} } = {}) {
  const P = prev || {}, out = { v: 1, at: new Date(now * 1000).toISOString().replace(/\.\d+Z$/, 'Z'), sources: {},
    label: 'Hard-to-find public data: the Cleveland Fed inflation nowcast, the Atlanta Fed GDPNow, prediction-market odds of the next Fed decision and the Fed\'s own calendar. Context, not a forecast of ours; paper only.' };
  const part = async (k, fn) => { try { out[k] = await fn(); if (out[k] == null) throw new Error('nothing parsed'); out.sources[k] = 'ok'; }
    catch (e) { out[k] = P[k] || null; out.sources[k] = 'failed: ' + String(e && e.message || e).slice(0, 80) + (P[k] ? ' (last good copy kept)' : ''); log(`hard data ${k}: ${out.sources[k]}`); } };
  await part('nowcast', async () => { const n = parseNowcast(JSON.parse(await getText(fetchFn, SRC.nowcast, 60000))); return n && { ...n, at: out.at }; });
  await part('gdpnow', async () => { const g = parseGdpNow(await getText(fetchFn, SRC.gdpnow)); return g && { ...g, at: out.at }; });
  const from = new Date((now - 2 * 86400) * 1000).toISOString().slice(0, 10), to = new Date((now + 14 * 86400) * 1000).toISOString().slice(0, 10);
  await part('fed', async () => { const t = await getText(fetchFn, SRC.fedcal); return { at: out.at, events: parseFedCal(JSON.parse(t.replace(/^﻿/, '')), from, to) }; });
  const M = nextFomc(now);
  await part('odds', async () => {
    if (!M) return null;
    const o = { at: out.at, meeting: M.day, kalshi: null, polymarket: null };
    try { o.kalshi = parseKalshi(JSON.parse(await getText(fetchFn, SRC.kalshi(M.kalshi)))); } catch (e) { log('kalshi: ' + e.message); }
    try { o.polymarket = parsePoly(JSON.parse(await getText(fetchFn, SRC.poly(M.poly))), M.t); } catch (e) { log('polymarket: ' + e.message); }
    if (!o.kalshi && !o.polymarket) return null;
    o.line = oddsLine(o); return o;
  });
  return out;
}

export async function main(dir = 'data') {
  const M = path.join(dir, 'macro'); fs.mkdirSync(M, { recursive: true });
  const f = path.join(M, 'hard-data.json'); let prev = null; try { prev = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {}
  const out = await collect({ prev, log: console.log });
  const tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(out, null, 1)); fs.renameSync(tmp, f);
  console.log('Hard data:', Object.entries(out.sources).map(([k, v]) => `${k} ${v}`).join(' · '));
  if (out.odds && out.odds.line) console.log(out.odds.line);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2] || 'data').catch((e) => { console.error('hard data failed:', e && e.message); process.exitCode = 0; });
