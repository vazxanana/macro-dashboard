// Hard-to-find macro data (20 Nov 2026, owner: "Hard to find information will play a big role here, try to get it").
// Keyless public sources, each checked from a GitHub runner before this was written (scripts/macro-probe.mjs, probe runs of
// 20 Nov 2026), read once a macro round and written to council-data macro/hard-data.json:
//  - the Cleveland Fed's inflation nowcast (CPI, core CPI, PCE, core PCE, month on month) for the months not yet released:
//    a model's estimate of the next prints, published daily (clevelandfed.org nowcast_month.json);
//  - the Atlanta Fed's GDPNow for the current quarter (FRED series GDPNOW);
//  - the market-implied odds of the next Fed decision from two prediction markets (Kalshi's KXFEDDECISION event, Polymarket's
//    "Fed decision in <month>" event): what traders are paying, not a forecast of ours;
//  - the Fed's own calendar of speeches, testimony and releases (federalreserve.gov/json/calendar.json);
//  - the US Treasury's announced note and bond auctions (TreasuryDirect TA_WS, 20 Nov 2026; the Fiscal Data upcoming-auctions
//    file, stale from a runner on 20 Nov, only as the last fallback).
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
  auctions: [
    'https://www.treasurydirect.gov/TA_WS/securities/announced?format=json',
    'https://www.treasurydirect.gov/TA_WS/securities/upcoming?format=json',
    'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/upcoming_auctions?sort=-auction_date&page[size]=100',
  ],
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

// US Treasury auctions with an auction date in [from, to] ('YYYY-MM-DD'): notes, bonds, TIPS and FRNs (labelled), and the
// 52-week bill; other bills are left out (many a week, little macro weight). Tolerant of two shapes: TreasuryDirect's array of
// { securityType, securityTerm, auctionDate '2026-11-24T00:00:00', offeringAmount, cusip, tips, floatingRate, reopening } and
// Fiscal Data's { data: [{ security_type, security_term, auction_date, offering_amt, cusip, reopening }] }. Amount in billions.
const pick = (o, ks) => { for (const k of ks) if (o[k] != null && o[k] !== '') return o[k]; return null; };
const yes = (x) => x === true || /^(yes|y|true)$/i.test(String(x == null ? '' : x).trim());
export function parseAuctions(J, from, to) {
  const rows = Array.isArray(J) ? J : J && Array.isArray(J.data) ? J.data : J && Array.isArray(J.securities) ? J.securities : [];
  const out = [], seen = new Set();
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const dRaw = String(pick(r, ['auctionDate', 'auction_date', 'AuctionDate']) || '');
    let day = (/^(\d{4}-\d{2}-\d{2})/.exec(dRaw) || [])[1] || null;
    if (!day) { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(dRaw); if (m) day = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
    if (!day || !(day >= from && day <= to)) continue;
    const st = String(pick(r, ['securityType', 'security_type']) || '').trim(), kind = String(r.type || '');
    const term = String(pick(r, ['securityTerm', 'security_term']) || '').trim().slice(0, 30);
    const tips = yes(r.tips) || /TIPS/i.test(st + ' ' + kind), frn = yes(r.floatingRate) || /FRN|floating/i.test(st + ' ' + kind);
    let type = /bond/i.test(st) ? 'Bond' : /note/i.test(st) ? 'Note' : /bill/i.test(st) ? 'Bill' : tips ? 'TIPS' : frn ? 'FRN' : null;
    if (!type || !term) continue;
    if (type === 'Bill' && !/52-week|1-year|364-day/i.test(term)) continue;
    if (type !== 'Bill' && tips) type = 'TIPS';
    else if (type !== 'Bill' && frn) type = 'FRN';
    const v = num(pick(r, ['offeringAmount', 'offering_amt', 'offeringAmt']));
    const amount = v == null || v <= 0 ? null : r2(v >= 1e8 ? v / 1e9 : v >= 1000 ? v / 1000 : v);
    const cusip = String(pick(r, ['cusip', 'CUSIP']) || '').trim().slice(0, 12) || null, key = `${day}|${term}|${type}`;
    if (seen.has(key)) continue; seen.add(key);
    const a = { day, term, type, amount, reopening: yes(r.reopening) };
    if (cusip) a.cusip = cusip;
    out.push(a);
  }
  const ord = (x) => { const m = /(\d+)-(Year|Week)/i.exec(x.term); return m ? +m[1] * (/week/i.test(m[2]) ? 1 / 52 : 1) : 99; };
  return out.sort((a, b) => a.day.localeCompare(b.day) || ord(a) - ord(b));
}
// One plain text for an auction: "US Treasury 7-Year Note auction, $44 billion".
export function auctionText(a) {
  const amt = Number.isFinite(a.amount) ? `, $${Number.isInteger(a.amount) ? a.amount : a.amount.toFixed(1).replace(/\.0$/, '')} billion` : '';
  return `US Treasury ${a.term} ${a.type} auction${a.reopening ? ' (reopening)' : ''}${amt}`;
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

// History (20 Nov 2026, owner: see how expectations MOVED during the week). Each run adds one compact reading to `hist`, carried
// from the previous file: at most one entry per UTC hour (a second run in the same hour merges into it), the last `HIST_DAYS`
// days. Only a part read fresh this run is recorded (a failed source's kept copy is never written in again as if new):
//  odds    = { meeting, top: Kalshi's three leading outcomes [{ label, p }] },
//  nowcast = [{ month, corePce, pce, coreCpi, cpi }] for each nowcast month still waiting for at least one print (a series already
//            printed is null), so the release of the coming week (October's PCE after October's CPI is out) keeps its record,
//  gdpnow  = { quarter, value } (a value is compared only within its quarter).
export const HIST_DAYS = 14;
const NC = ['corePce', 'pce', 'coreCpi', 'cpi'];
export function histEntry(out) {
  const ok = (k) => out && out.sources && out.sources[k] === 'ok' && out[k];
  const e = { at: out.at };
  if (ok('odds') && Array.isArray(out.odds.kalshi) && out.odds.kalshi.length) {
    e.odds = { meeting: out.odds.meeting, top: out.odds.kalshi.slice(0, 3).map((m) => ({ label: m.label, p: m.p })) };
  }
  if (ok('nowcast') && Array.isArray(out.nowcast.months)) {
    const ms = [];
    for (const m of out.nowcast.months) {
      const row = { month: m.month }; let any = false;
      for (const k of NC) { const printed = m.actual && m.actual[k] != null, v = m.now && m.now[k]; row[k] = !printed && Number.isFinite(v) ? v : null; if (row[k] != null) any = true; }
      if (any) ms.push(row);
    }
    if (ms.length) e.nowcast = ms;
  }
  if (ok('gdpnow') && Number.isFinite(out.gdpnow.value)) e.gdpnow = { quarter: out.gdpnow.quarter, value: out.gdpnow.value };
  return e.odds || e.nowcast || e.gdpnow ? e : null;
}
const secOf = (at) => Math.floor(Date.parse(at) / 1000);
export function addHist(prev, entry, now) {
  const cut = now - HIST_DAYS * 86400;
  const h = (Array.isArray(prev) ? prev : []).filter((x) => x && typeof x.at === 'string' && Number.isFinite(secOf(x.at)) && secOf(x.at) >= cut && secOf(x.at) <= now)
    .map((x) => ({ ...x })).sort((a, b) => secOf(a.at) - secOf(b.at));
  if (entry) {
    const hour = Math.floor(secOf(entry.at) / 3600), last = h[h.length - 1];
    if (last && Math.floor(secOf(last.at) / 3600) === hour) h[h.length - 1] = { ...last, ...entry };
    else h.push(entry);
  }
  return h;
}

// What moved: the newest reading (at most 6 hours old) against the one nearest a day ago (20 to 30 hours back) and a week ago (6 to
// 8 days back). One plain line per item, only when the newest reading and at least one earlier one exist; nothing otherwise. A
// change in what a model or the traders say, never a signal of ours.
const NCNAME = { corePce: 'core PCE', pce: 'PCE', coreCpi: 'core CPI', cpi: 'CPI' };
export function outcomeWords(label) {
  const s = String(label || '');
  const n = /(\d+)\s*bps?/i.exec(s), up = /hike|increase|raise/i.test(s), dn = /cut|decrease|lower/i.test(s);
  if (n && (up || dn)) return `a ${n[1]} bp ${up ? 'hike' : 'cut'}`;
  if (/maintain|no change|hold|unchanged/i.test(s)) return 'no change';
  return s;
}
function refs(hist, now, has) {
  const H = (Array.isArray(hist) ? hist : []).filter((x) => x && has(x)).map((x) => ({ x, t: secOf(x.at) })).filter((y) => Number.isFinite(y.t) && y.t <= now);
  const cur = H.filter((y) => y.t >= now - 6 * 3600).sort((a, b) => b.t - a.t)[0];
  if (!cur) return null;
  const near = (lo, hi, target) => H.filter((y) => y.t >= now - hi && y.t <= now - lo && y.t < cur.t).sort((a, b) => Math.abs(a.t - target) - Math.abs(b.t - target))[0];
  const d = near(20 * 3600, 30 * 3600, now - 86400), w = near(6 * 86400, 8 * 86400, now - 7 * 86400);
  return { cur: cur.x, day: d ? d.x : null, week: w ? w.x : null };
}
const dayWord = (ymd) => { const d = new Date(ymd + 'T12:00:00Z'); return Number.isFinite(d.getTime()) ? `${d.getUTCDate()} ${MONTH[d.getUTCMonth()].slice(0, 3)}` : ymd; };
const pctP = (p) => `${Math.round(p * 100)}%`;
const pctNc = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2) + '%';
function said(cur, day, week, f) {
  const parts = [`${f(cur)} now`];
  if (day != null) parts.push(`${f(day)} a day ago`);
  if (week != null) parts.push(`${f(week)} a week ago`);
  return parts.length > 1 ? parts.join(', ') : null;
}
const dif = (a, b) => b == null ? null : r2(a - b);
// [{ kind: 'odds' | 'nowcast' | 'gdpnow', text, day, week }] (day / week = the change, null when that reading is missing).
export function moves(hd, now) {
  const hist = hd && hd.hist, out = [];
  const R = refs(hist, now, (x) => x.odds && Array.isArray(x.odds.top) && x.odds.top.length);
  if (R) {
    const lead = R.cur.odds.top[0];
    const pick = (x) => { if (!x || x.odds.meeting !== R.cur.odds.meeting) return null; const m = x.odds.top.find((y) => y.label === lead.label); return m ? m.p : null; };
    const d = pick(R.day), w = pick(R.week), s = said(lead.p, d, w, pctP);
    if (s) out.push({ kind: 'odds', label: lead.label, day: dif(lead.p, d), week: dif(lead.p, w),
      text: `Kalshi odds of ${outcomeWords(lead.label)} at the ${dayWord(R.cur.odds.meeting)} Fed meeting: ${s}. What traders pay, not a forecast of ours.` });
  }
  const N = refs(hist, now, (x) => Array.isArray(x.nowcast) && x.nowcast.length);
  if (N) {
    for (const m of N.cur.nowcast) {
      for (const k of NC) {
        if (m[k] == null) continue;
        const pick = (x) => { const y = x && x.nowcast.find((z) => z.month === m.month); return y && y[k] != null ? y[k] : null; };
        const d = pick(N.day), w = pick(N.week), s = said(m[k], d, w, pctNc);
        if (s) out.push({ kind: 'nowcast', month: m.month, series: k, day: dif(m[k], d), week: dif(m[k], w),
          text: `Cleveland Fed ${NCNAME[k]} nowcast for ${MONTH[+m.month.slice(5) - 1]}: ${s} (a model's estimate, month on month).` });
      }
    }
  }
  const G = refs(hist, now, (x) => x.gdpnow && Number.isFinite(x.gdpnow.value));
  if (G) {
    const q = G.cur.gdpnow.quarter, v = G.cur.gdpnow.value, pick = (x) => x && x.gdpnow.quarter === q ? x.gdpnow.value : null;
    const d = pick(G.day), w = pick(G.week), s = said(v, d, w, (x) => `${x}%`);
    if (s) out.push({ kind: 'gdpnow', day: dif(v, d), week: dif(v, w), text: `Atlanta Fed GDPNow for ${q}: ${s} (annualized).` });
  }
  return out;
}
// The biggest one-week move of any of Kalshi's leading outcomes for the same meeting, when it is `min` (5 points) or more; else null.
export function bigOddsMove(hd, now, min = 0.05) {
  const R = refs(hd && hd.hist, now, (x) => x.odds && Array.isArray(x.odds.top) && x.odds.top.length);
  if (!R || !R.week || R.week.odds.meeting !== R.cur.odds.meeting) return null;
  let best = null;
  for (const m of R.cur.odds.top) {
    const o = R.week.odds.top.find((y) => y.label === m.label); if (!o) continue;
    const d = m.p - o.p; if (!best || Math.abs(d) > Math.abs(best.d)) best = { label: m.label, from: o.p, to: m.p, d };
  }
  if (!best || Math.abs(best.d) < min - 1e-9) return null;
  return { ...best, d: r2(best.d), text: `Over the week the Kalshi odds of ${outcomeWords(best.label)} at the ${dayWord(R.cur.odds.meeting)} Fed meeting moved from ${pctP(best.from)} to ${pctP(best.to)}: what traders pay, not a forecast of ours.` };
}

async function getText(fetchFn, url, ms = 30000) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms);
  try { const r = await fetchFn(url, { headers: UA, signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); } finally { clearTimeout(to); }
}

// Fetch everything; a failed part keeps `prev`'s copy of it. `now` in unix seconds.
export async function collect({ now = Math.floor(Date.now() / 1000), fetchFn = fetch, prev = null, log = () => {} } = {}) {
  const P = prev || {}, out = { v: 1, at: new Date(now * 1000).toISOString().replace(/\.\d+Z$/, 'Z'), sources: {},
    label: 'Hard-to-find public data: the Cleveland Fed inflation nowcast, the Atlanta Fed GDPNow, prediction-market odds of the next Fed decision, the Fed\'s own calendar and the US Treasury\'s note and bond auctions. Context, not a forecast of ours; paper only.' };
  const part = async (k, fn) => { try { out[k] = await fn(); if (out[k] == null) throw new Error('nothing parsed'); out.sources[k] = 'ok'; }
    catch (e) { out[k] = P[k] || null; out.sources[k] = 'failed: ' + String(e && e.message || e).slice(0, 80) + (P[k] ? ' (last good copy kept)' : ''); log(`hard data ${k}: ${out.sources[k]}`); } };
  await part('nowcast', async () => { const n = parseNowcast(JSON.parse(await getText(fetchFn, SRC.nowcast, 60000))); return n && { ...n, at: out.at }; });
  await part('gdpnow', async () => { const g = parseGdpNow(await getText(fetchFn, SRC.gdpnow)); return g && { ...g, at: out.at }; });
  const from = new Date((now - 2 * 86400) * 1000).toISOString().slice(0, 10), to = new Date((now + 14 * 86400) * 1000).toISOString().slice(0, 10);
  await part('fed', async () => { const t = await getText(fetchFn, SRC.fedcal); return { at: out.at, events: parseFedCal(JSON.parse(t.replace(/^﻿/, '')), from, to) }; });
  await part('auctions', async () => {
    const af = new Date((now - 86400) * 1000).toISOString().slice(0, 10), why = [];
    // each address in order; the first that holds auctions in the window is used (an empty answer falls through to the next)
    for (const u of SRC.auctions) {
      const host = new URL(u).host;
      try { const list = parseAuctions(JSON.parse((await getText(fetchFn, u)).replace(/^\uFEFF/, '')), af, to); if (list.length) return { at: out.at, src: host, list }; why.push(host + ' none in the window'); }
      catch (e) { why.push(host + ' ' + String(e && e.message || e).slice(0, 30)); }
    }
    throw new Error(why.join('; '));
  });
  const M = nextFomc(now);
  await part('odds', async () => {
    if (!M) return null;
    const o = { at: out.at, meeting: M.day, kalshi: null, polymarket: null };
    try { o.kalshi = parseKalshi(JSON.parse(await getText(fetchFn, SRC.kalshi(M.kalshi)))); } catch (e) { log('kalshi: ' + e.message); }
    try { o.polymarket = parsePoly(JSON.parse(await getText(fetchFn, SRC.poly(M.poly))), M.t); } catch (e) { log('polymarket: ' + e.message); }
    if (!o.kalshi && !o.polymarket) return null;
    o.line = oddsLine(o); return o;
  });
  out.hist = addHist(P.hist, histEntry(out), now);
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
