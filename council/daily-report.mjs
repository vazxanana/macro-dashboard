// The two daily reports (19 Nov 2026, owner: "daily reports every 6:30 am, everyone will get notification of the daily report
// (those who got macro activated): 2 reports, one regarding the world economy, what's the news and what we are expecting
// worldwide, and the other regarding the markets").
//   node council/daily-report.mjs <council-data dir> [--force]
// From 06:00 London time the first council round of the day builds both reports from what the council already wrote (the
// strategist's forecast.json and calendar cache, the veteran's veteran.json, cot.json, snapshot.json); it fetches nothing.
// macro/daily-report.json keeps the last 14 days. The Worker's 10-minute cron posts the notice at 06:30 London to accounts with
// the macro permission (api/notify.js `daily`). Deterministic text, no language model; never a trade, rule or system name;
// no third-party licensed data (the London Strategic Edge key is the owner's alone). Leans and odds are labelled as such.
import fs from 'node:fs';
import path from 'node:path';
import { writeAtomic } from './jsonio.mjs';
import { typeOf, nowcastFor, releasesOf } from './week-ahead.mjs';
import { moves, auctionText } from './hard-data.mjs';
import { nyParts } from '../ict/calendar.mjs';
const nyDay = (t) => nyParts(t).ymd;

export const TZ = 'Europe/London', BUILD_FROM = 6, PUBLISH = { h: 6, m: 30 }, KEEP = 14;
const COUNTRY = { USD: 'United States', EUR: 'Euro area', GBP: 'United Kingdom', JPY: 'Japan', CNY: 'China', AUD: 'Australia', NZD: 'New Zealand', CAD: 'Canada', CHF: 'Switzerland', ALL: 'Global' };
const MARKETS = [['gold', 'Gold'], ['eurusd', 'EUR/USD'], ['usdjpy', 'USD/JPY'], ['nq', 'Nasdaq 100'], ['es', 'S&P 500']];
const COT_NAME = { gold: 'gold', silver: 'silver', eur: 'the euro', gbp: 'sterling', jpy: 'the yen', aud: 'the Australian dollar', nzd: 'the New Zealand dollar', cad: 'the Canadian dollar', chf: 'the Swiss franc', nq: 'Nasdaq futures', es: 'S&P futures' };

// London wall clock for a unix time (s): { day 'YYYY-MM-DD', h, m, wd 0-6 }
export function london(t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, h: +p.hour, m: +p.minute, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
// the unix time of HH:MM London on a London day
export function londonAt(day, h, m) {
  const guess = Date.parse(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`) / 1000;
  for (const off of [0, -3600, 3600]) { const L = london(guess + off); if (L.day === day && L.h === h && L.m === m) return guess + off; }
  return guess;
}
const hm = (t) => { const L = london(t); return `${String(L.h).padStart(2, '0')}:${String(L.m).padStart(2, '0')}`; };
const dayName = (t) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(t * 1000));
const pc = (x, d = 1) => (x == null || !Number.isFinite(x) ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d) + '%');
const num = (x, d = 2) => (x == null || !Number.isFinite(+x) ? 'n/a' : (+x).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pts = (p) => Math.round(p * 100);
const clean = (s, n = 220) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const sent = (s, n = 400) => { const t = clean(s, n).replace(/[.\s]+$/, ''); return t ? t[0].toUpperCase() + t.slice(1) + '.' : ''; };
const ord = (n) => { const v = n % 100; return n + (v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); };

// one calendar row as a line: "13:30 · United States · Retail Sales m/m · expected 0.3%, previous 0.1%"
export function calLine(e) {
  const bits = [e.forecast ? `expected ${clean(e.forecast, 20)}` : null, e.previous ? `previous ${clean(e.previous, 20)}` : null, e.actual ? `actual ${clean(e.actual, 20)}` : null].filter(Boolean);
  return `${hm(e.at)} · ${COUNTRY[e.country] || clean(e.country, 12)} · ${clean(e.title, 80)}${bits.length ? ' · ' + bits.join(', ') : ''}`;
}
const important = (e) => e && (e.impact === 'High' || e.impact === 'Medium') && !/^(Bank Holiday|.*Holiday)$/i.test(e.title || '');

export function worldReport({ fc, vet, cal, now, hd = null }) {
  const L = london(now), today = L.day, from = now - 30 * 3600, endToday = londonAt(today, 23, 59);
  const R = (fc && fc.regime) || {}, S = (vet && vet.summary) || {}, shock = vet && vet.shock;
  const lines = { picture: [], happened: [], today: [], week: [], expect: [] };
  if (R.label) lines.picture.push(`Regime: ${clean(R.label)}.`);
  if (R.smileDetail) lines.picture.push(sent(R.smileDetail));
  if (shock && shock.shock) lines.picture.push(sent(`Cross-asset read: ${clean(shock.shock)}`) + (shock.goldTest ? ' ' + sent(shock.goldTest) : ''));
  const facts = [R.vix != null ? `VIX ${num(R.vix, 1)}` : null, R.realYield ? `US 10-year real yield ${num(R.realYield.level)}%` : null, R.us2y != null ? `US 2-year ${num(R.us2y)}%` : null,
    R.eu2y != null ? `euro-area 2-year ${num(R.eu2y)}%` : null, R.dxyProxy != null ? `dollar index about ${num(R.dxyProxy)}${R.dxy5d != null ? ` (${pc(R.dxy5d, 2)} on 5 days)` : ''}` : null].filter(Boolean);
  if (facts.length) lines.picture.push(facts.join(' · ') + '.');
  // what happened: central-bank wire and releases with a print in the last 30 hours
  const news = ((fc && fc.news) || []).filter((n) => n && Date.parse(n.at) / 1000 >= from && Date.parse(n.at) / 1000 <= now).sort((a, b) => (b.policy - a.policy) || (Date.parse(b.at) - Date.parse(a.at))).slice(0, 6);
  for (const n of news) lines.happened.push(`${clean(n.src, 10)}${n.policy ? ' (policy)' : ''}: ${clean(n.title, 160)}`);
  for (const e of cal.filter((e) => e.at >= from && e.at <= now && e.actual && important(e)).slice(0, 8)) lines.happened.push(calLine(e));
  for (const r of ((vet && vet.releases) || []).filter((r) => r.firstPrint != null && Date.parse(r.scheduledUtc) / 1000 >= from && Date.parse(r.scheduledUtc) / 1000 <= now).slice(0, 4))
    lines.happened.push(`${clean(r.event, 80)}: printed ${clean(r.firstPrint, 20)} against an expected ${clean(r.consensus, 20)}${r.trusted ? '' : ' (the timing checks did not all pass: no surprise is scored)'}.`);
  if (!lines.happened.length) lines.happened.push('No high- or medium-impact release printed and no central-bank statement came out in the last 30 hours.');
  // today and the rest of the week, worldwide
  const todays = cal.filter((e) => e.at > now - 3 * 3600 && e.at <= endToday && important(e)).sort((a, b) => a.at - b.at);
  for (const e of todays.slice(0, 14)) lines.today.push((e.impact === 'High' ? 'High · ' : '') + calLine(e));
  // hard-to-find data (council/hard-data.mjs): the Cleveland Fed nowcast beside today's US CPI / PCE, the Fed's own calendar of the day
  for (const e of todays) {
    if (e.country !== 'USD') continue;
    const ty = typeOf(e.title, e.country), nc = ty ? nowcastFor(hd, { type: ty, t: e.at }) : null;
    if (nc && !lines.today.some((l) => l.startsWith('Before the print'))) lines.today.push(`Before the print: ${nc.text}.`);
  }
  for (const f of (((hd && hd.fed) || {}).events || []).filter((x) => x && x.day === today).slice(0, 4))
    lines.today.push(`Fed: ${clean(f.title, 100)}${f.time ? ` · ${clean(f.time, 20)} New York` : ''}${f.topic ? ` · ${clean(f.topic, 100)}` : ''}`);
  // the US Treasury's note and bond auctions of the New York day (hard-data.mjs `auctions`): supply the bond market has to absorb
  for (const a of ((((hd && hd.auctions) || {}).list) || []).filter((x) => x && x.day === today && x.type !== 'Bill').slice(0, 4))
    lines.today.push(`${auctionText(a)}${a.type === 'Note' || a.type === 'Bond' ? ' (results about 13:00 New York)' : ''}.`);   // FRN and TIPS auctions close at other times
  if (!todays.length) lines.today.push(L.wd === 0 || L.wd === 6 ? 'Weekend: no scheduled release. Markets reopen Sunday evening (22:00 UTC for gold and currencies).' : 'No high- or medium-impact release is scheduled today.');
  const later = cal.filter((e) => e.at > endToday && e.at <= endToday + 6 * 86400 && e.impact === 'High').sort((a, b) => a.at - b.at);
  for (const e of later.slice(0, 10)) lines.week.push(`${dayName(e.at)} ${calLine(e)}`);
  // next week's calendar file appears over the weekend: until then the big US releases come from the council's own schedule
  let sched = [];
  try { sched = releasesOf(cal, nyDay(endToday + 1), nyDay(endToday + 6 * 86400)).filter((r) => r.src === 'schedule' && r.impact === 'high' && r.t > endToday); } catch (e) { sched = []; }
  for (const r of sched.slice(0, 6)) lines.week.push(`${dayName(r.t)} ${hm(r.t)} · ${COUNTRY[r.country] || clean(r.country, 12)} · ${clean(r.title, 80)} (from the council's release schedule; no consensus yet)`);
  if (!later.length && !sched.length) lines.week.push('No high-impact release is on the calendar for the next six days.');
  // what we expect
  if (S.sentence) lines.expect.push(clean(S.sentence, 400));
  const gs = fc && fc.goldScore; if (gs && gs.ok && Number.isFinite(gs.score)) lines.expect.push(`Gold Macro Score ${gs.score > 0 ? '+' : ''}${gs.score.toFixed(2)}: ${gs.score > 0.25 ? 'leans to gold rising over the next four weeks (the score\'s tested side)' : 'no macro edge for gold (the score only ever points up, above +0.25)'}.`);
  if (hd && hd.odds && hd.odds.line) lines.expect.push(clean(hd.odds.line, 300));
  if (hd && hd.gdpnow && Number.isFinite(hd.gdpnow.value)) lines.expect.push(`Atlanta Fed GDPNow for ${clean(hd.gdpnow.quarter, 12)}: ${hd.gdpnow.value}% a year, a model's running estimate of growth.`);
  // how those readings moved over the day and the week (hard-data.mjs hist): a change in what a model or traders say, never a signal
  // never let the history stop the report; nowcast moves only for a month with a release in the next week; no line when nothing moved
  try {
    const soon = new Set(cal.filter((e) => e.country === 'USD' && e.at > now && e.at <= now + 7 * 86400 && typeOf(e.title, e.country)).map((e) => { const d = new Date(e.at * 1000); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); }));
    const mv = moves(hd, now).filter((m) => (m.day || m.week) && (m.kind !== 'nowcast' || soon.has(m.month)));
    for (const m of mv.slice(0, 4)) lines.expect.push(clean(m.text, 300));
  } catch (e) { /* context only */ }
  for (const it of (((vet && vet.research) || {}).items || []).slice(0, 6)) if (it && it.text && !/^No |off:|no regime/i.test(it.text)) lines.expect.push(clean(it.text, 220));
  const sections = [['The picture', lines.picture], ['What happened (last 30 hours)', lines.happened], [`Today, ${dayName(now)} (London time)`, lines.today], ['Later this week', lines.week], ['What we expect', lines.expect]]
    .filter(([, l]) => l.length).map(([h, l]) => ({ h, lines: l }));
  const top = todays.find((e) => e.impact === 'High') || todays[0];
  const lead = `${R.label ? clean(R.label).split(' · ')[0] + '. ' : ''}${top ? `Today: ${COUNTRY[top.country] || top.country} ${clean(top.title, 60)} at ${hm(top.at)} London.` : 'No major release today.'}`;
  return { title: 'World economy', lead, sections };
}

export function marketsReport({ fc, vet, cot, snap, now }) {
  const A = (fc && fc.assets) || {}, R = (fc && fc.regime) || {}, rows = [], moves = [];
  for (const [k, name] of MARKETS) { const a = A[k]; if (!a || !Number.isFinite(a.last)) continue;
    const base = a.fit && Number.isFinite(a.fit.base) ? a.fit.base : null, tilt = Number.isFinite(a.pUp) && base != null ? a.pUp - base : null;
    const lean = Number.isFinite(a.pUp) ? `${pts(a.pUp)}% chance of closing the day higher${base != null ? ` (usual ${pts(base)}%)` : ''}` : null;
    const range = Number.isFinite(a.expMovePct) ? `a normal day ±${a.expMovePct.toFixed(2)}% (${num(a.last * (1 - a.expMovePct / 100), k === 'eurusd' ? 4 : k === 'usdjpy' ? 2 : 1)} to ${num(a.last * (1 + a.expMovePct / 100), k === 'eurusd' ? 4 : k === 'usdjpy' ? 2 : 1)})` : null;
    const vol = Number.isFinite(a.volRatio) && a.volRatio >= 1.3 ? `moving ${a.volRatio.toFixed(1)}x its usual` : null;
    rows.push(`${name} ${num(a.last, k === 'eurusd' ? 4 : k === 'usdjpy' ? 2 : 1)}: ${[lean, range, vol].filter(Boolean).join('; ')}.`);
    if (tilt != null) moves.push([name, tilt]); }
  const risk = [];
  if (R.vix != null) risk.push(`VIX ${num(R.vix, 1)}${R.vix >= 30 ? ' (fear)' : R.vix >= 20 ? ' (elevated)' : ' (calm)'}${R.vixTermRatio != null ? `, its curve ${R.vixTermRatio > 1 ? 'inverted (stress)' : 'normal'}` : ''}.`);
  if (R.realYield) risk.push(`US 10-year real yield ${num(R.realYield.level)}% (${R.realYield.chg > 0 ? '+' : ''}${num(R.realYield.chg)} on the week).`);
  if (R.curve10y3m != null) risk.push(`US curve 10-year minus 3-month ${num(R.curve10y3m)} points${R.curve10y3m < 0 ? ' (inverted)' : ''}.`);
  if (R.broadUsd20dPct != null) risk.push(`Broad dollar ${pc(R.broadUsd20dPct, 2)} over 20 days.`);
  const lv = ((vet && vet.summary) || {}).levels, levels = [];
  if (lv) { if (lv.mark) levels.push(`Gold now about $${num(lv.mark.px, 0)}.`);
    if (lv.above) levels.push(`Above: $${num(lv.above.price, 0)} (${clean(lv.above.label, 40)})${lv.above.crossed ? ', traded through since the close' : ''}.`);
    if (lv.below) levels.push(`Below: $${num(lv.below.price, 0)} (${clean(lv.below.label, 40)}).`);
    if (lv.broken) levels.push(`Broken since the last close: $${num(lv.broken.price, 0)} (${clean(lv.broken.label, 40)}).`);
    if (lv.fresh && lv.fresh.text) levels.push(`Levels ${clean(lv.fresh.text, 60)}.`); }
  const wk = vet && vet.outlook && vet.outlook.week, calls = [];
  if (wk && Array.isArray(wk.list)) for (const c of wk.list.filter((c) => !/stretch/.test(c.claim)).slice(0, 4)) calls.push(`${clean(c.claim, 140).replace(/ \(today's close\)/, ` (the ${wk.from || ''} close it was issued from)`.replace('the  close', 'its starting close'))}: ${pts(c.p)}% (usual ${pts(c.baseP)}%).`);
  const from = wk && Number(String(wk.from || '').replace(/[^0-9.]/g, '')), gNow = A.gold && A.gold.last;
  if (calls.length && from > 0 && gNow > 0 && Math.abs(gNow / from - 1) >= 0.02) calls.push(`These were set from the ${wk.from} close; gold has moved ${pc((gNow / from - 1) * 100)} since, so read them against today's price.`);
  const pos = [];
  for (const m of ((cot && cot.markets) || [])) { if (!Number.isFinite(m.pct)) continue;
    if (m.pct >= 90 || m.pct <= 10) pos.push(`Speculators in ${COT_NAME[m.k] || m.name} are at the ${m.pct >= 90 ? 'top' : 'bottom'} of their 3-year range (${ord(m.pct)} percentile, as of ${m.asOf}).`); }
  if (!pos.length && cot && cot.markets && cot.markets.length) pos.push(`No market's speculative positioning is at a 3-year extreme (CFTC, as of ${cot.markets[0].asOf}).`);
  if (pos.length && cot && cot.study) pos.push(`Positioning alone failed its test here (${clean(cot.study.verdict, 10)}): context, not a signal.`);
  const fx = [], sm = (snap && snap.markets) || {};
  for (const k of ['gbpusd', 'audusd', 'usdcad', 'usdchf']) { const m = sm[k]; if (m && Number.isFinite(m.price)) fx.push(`${clean(m.label, 12)} ${num(m.price, m.dec || 4)}`); }
  if (fx.length) rows.push(`Other majors: ${fx.join(' · ')}.`);
  const sections = [['Where markets stand', rows], ['Risk and rates', risk], ['Gold: levels to watch', levels], ['This week\'s odds (gold)', calls], ['Positioning (CFTC)', pos]]
    .filter(([, l]) => l.length).map(([h, l]) => ({ h, lines: l }));
  moves.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const g = A.gold, lead = g && Number.isFinite(g.last) ? `Gold ${num(g.last, 0)}${Number.isFinite(g.expMovePct) ? `, a normal day ±${g.expMovePct.toFixed(1)}%` : ''}.${R.vix != null ? ` VIX ${num(R.vix, 1)}.` : ''}${moves[0] && Math.abs(moves[0][1]) >= 0.03 ? ` Strongest macro lean: ${moves[0][0]} ${moves[0][1] > 0 ? 'up' : 'down'}.` : ' No market has a strong macro lean.'}` : 'Market data were not available for this report.';
  return { title: 'Markets', lead, sections };
}

export const NOTE = 'Built from public data the desk already reads (central banks, the economic calendar, FRED, CFTC, prices). Leans and odds come with their usual rate; none is a tested edge, a forecast as fact or advice.';
export function buildReports({ fc, vet, cache, cot, snap, now, hd = null }) {
  const L = london(now), raw = cache && cache.cal, cal = (Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw).flat() : []).filter((e) => e && Number.isFinite(e.at));
  const seen = new Set(), C = cal.filter((e) => { const k = e.at + '|' + e.country + '|' + e.title; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.at - b.at);
  return { day: L.day, tz: TZ, publishAt: new Date(londonAt(L.day, PUBLISH.h, PUBLISH.m) * 1000).toISOString(), builtAt: new Date(now * 1000).toISOString(),
    dataAt: { strategist: (fc && fc.at) || null, veteran: (vet && vet.at) || null, cot: (cot && cot.at) || null }, note: NOTE,
    world: worldReport({ fc, vet, cal: C, now, hd }), markets: marketsReport({ fc, vet, cot, snap, now }) };
}
// whether this round should build: once per London day from 06:00; a day's report built before 06:00 (the very first file is built
// at once, whatever the hour, so there is something to read and test) is built again from 06:00 with that morning's data
export function due(file, now, force = false) {
  const L = london(now), reps = (file && file.reports) || [];
  if (force) return true;
  if (!reps.length) return true;
  if (L.h < BUILD_FROM) return false;
  const r = reps.find((x) => x.day === L.day); if (!r) return true;
  const b = london(Date.parse(r.builtAt) / 1000); return b.day === L.day && b.h < BUILD_FROM;
}
export function merge(file, rep) { return { v: 1, at: rep.builtAt, label: 'Daily reports: world economy and markets, 06:30 London', reports: [rep, ...((file && file.reports) || []).filter((r) => r.day !== rep.day)].slice(0, KEEP) }; }

async function main(dir, force) {
  const read = (p) => { try { return JSON.parse(fs.readFileSync(path.join(dir, p), 'utf8')); } catch (e) { return null; } };
  const now = Math.floor(Date.now() / 1000), file = read('macro/daily-report.json');
  if (fs.existsSync(path.join(dir, 'macro/daily-report.json')) && !file) { console.log('daily-report.json does not parse: left alone'); return; }
  if (!due(file, now, force)) { console.log('daily report: not due'); return; }
  const fc = read('macro/forecast.json'); if (!fc) { console.log('daily report: no forecast.json yet'); return; }
  const rep = buildReports({ fc, vet: read('macro/veteran.json'), cache: read('macro/cache.json'), cot: read('macro/cot.json'), snap: read('snapshot.json'), now, hd: read('macro/hard-data.json') });
  writeAtomic(path.join(dir, 'macro/daily-report.json'), JSON.stringify(merge(file, rep), null, 1) + '\n');
  console.log(`daily report ${rep.day}: world ${rep.world.sections.length} sections, markets ${rep.markets.sections.length}, publish ${rep.publishAt}`);
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) await main(process.argv[2] || 'data', process.argv.includes('--force'));
