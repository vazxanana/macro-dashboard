// Week ahead (20 Nov 2026, owner: "focus on improving the macro and fundamental so next week we can smash the markets").
// One plan for the coming trading week, day by day, from what the council already has: the economic calendar the strategist read
// (macro/cache.json `cal`, Forex Factory; next week's file appears over the weekend), the council's own release schedule
// (council/events.mjs, so the big US releases are known before that file is out), the Red folder study's record of how gold
// reacted to each kind of release (macro/redfolder.json), US market holidays and early closes (ict/calendar.mjs), the calendar
// rules the council has TESTED (each with its own study's verdict and headline, research-ledger.mjs `studyRow`, and the latest
// forward reading where one runs), and the frame: the Gold Macro Score, the regime, the veteran's levels and calls, and the
// readings of the owner's rule book that are on now (veteran.json `research`).
// Display only: it fetches nothing, forecasts nothing new, and no rule, size, call or trade reads it. A study that FAILED is
// listed as tested and failed, so it is not chased; a PASS is never called an edge here (its own headline says what it is).
import fs from 'node:fs';
import path from 'node:path';
import { EVENTS } from './events.mjs';
import { cmeYear, nyParts } from '../ict/calendar.mjs';
import { isGotobi } from './gotobi-calendar.mjs';
import { readStudy, studyRow, EDGE_DIR } from './research-ledger.mjs';
import { moves, bigOddsMove, auctionText } from './hard-data.mjs';

const DAY = 86400;
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ymdOf = (t) => nyParts(t).ymd;
const addD = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * DAY * 1000).toISOString().slice(0, 10);
const dowOf = (ymd) => new Date(ymd + 'T12:00:00Z').getUTCDay();
const weekday = (ymd) => { const w = dowOf(ymd); return w >= 1 && w <= 5; };

// The week the plan covers: Monday to Friday of the coming week from Friday on (New York date: Friday and the weekend prepare
// the next week), else the rest of this week (today to Friday).
export function weekOf(now) {
  const p = nyParts(now), w = dowOf(p.ymd);
  const next = w === 6 || w === 0 || w === 5;
  const from = next ? addD(p.ymd, w === 6 ? 2 : w === 0 ? 1 : 3) : p.ymd;
  const to = addD(from, 5 - dowOf(from));
  return { from, to, next };
}

// NYSE full holidays (the gold-pre-holiday study's set): CME's full holidays plus the named holidays CME only shortens.
const NOT_NYSE = /eve|after thanksgiving/i;
export function nyseHoliday(ymd) {
  const Y = cmeYear(+ymd.slice(0, 4));
  if (Y.full.has(ymd)) return Y.full.get(ymd);
  const e = Y.early.get(ymd); return e && !NOT_NYSE.test(e.name) ? e.name : null;
}
export function marketNote(ymd) {
  const Y = cmeYear(+ymd.slice(0, 4)), h = nyseHoliday(ymd);
  if (h) return { kind: 'holiday', text: `${h}: US stock markets are closed; CME futures (gold, indices) trade a short session and halt early. Thin trading: moves can be jumpy and fade.` };
  const e = Y.early.get(ymd);
  if (e) return { kind: 'early', text: `${e.name}: US markets close early (stocks 13:00 New York, CME gold and indices about ${Math.floor(e.published / 60)}:${String(e.published % 60).padStart(2, '0')}). Thin trading.` };
  return null;
}
const tradingDay = (ymd) => weekday(ymd) && !nyseHoliday(ymd);
const prevTrading = (ymd) => { let d = addD(ymd, -1); while (!tradingDay(d)) d = addD(d, -1); return d; };
const nextTrading = (ymd) => { let d = addD(ymd, 1); while (!tradingDay(d)) d = addD(d, 1); return d; };

// Release title -> Red folder type (US releases only).
export function typeOf(title, country) {
  if (country && country !== 'USD') return null;
  const s = String(title || '');
  if (/\bPPI\b|Producer Price/i.test(s)) return 'PPI';
  if (/\bPCE\b|Personal Income|Core PCE/i.test(s)) return 'PCE';
  if (/\bCPI\b|Consumer Price/i.test(s)) return 'CPI';
  if (/Non-?Farm|\bNFP\b|Employment Situation/i.test(s)) return 'NFP';
  if (/FOMC|Federal Funds Rate/i.test(s)) return 'FOMC';
  if (/Retail Sales/i.test(s)) return 'RETAIL';
  if (/ISM Manufacturing/i.test(s)) return 'ISM';
  if (/\bGDP\b/i.test(s)) return 'GDP';
  return null;
}

// The releases of the week: the calendar's high-impact events (all currencies) and the US medium ones of the Red folder types,
// then the council's own schedule for what the calendar does not hold yet (tier 1 and 2), each placed on its New York day.
export function releasesOf(cal, from, to) {
  const out = [], seen = [];
  const inWeek = (t) => { const d = ymdOf(t); return d >= from && d <= to ? d : null; };
  for (const e of Array.isArray(cal) ? cal : []) {
    const t = +e.at; if (!Number.isFinite(t)) continue;
    const day = inWeek(t); if (!day) continue;
    const type = typeOf(e.title, e.country), hi = /high/i.test(e.impact || '');
    if (!hi && !(type && /medium/i.test(e.impact || ''))) continue;
    out.push({ day, t, title: String(e.title || '').slice(0, 80), country: e.country, impact: hi ? 'high' : 'medium', type,
      exp: e.forecast || null, prev: e.previous || null, src: 'calendar' });
    seen.push({ t, type, title: e.title });
  }
  for (const e of EVENTS) {
    const day = inWeek(e.t); if (!day || (e.tier !== 1 && e.tier !== 2 && e.tier !== 'cb')) continue;
    const type = typeOf(e.title, e.country);
    const dup = seen.some((s) => Math.abs(s.t - e.t) <= 3600 && (type ? s.type === type : String(s.title).toLowerCase().includes(e.type.toLowerCase().slice(0, 4))));
    if (dup) continue;
    out.push({ day, t: e.t, title: e.title, country: e.country, impact: e.tier === 1 || e.tier === 'cb' ? 'high' : 'medium', type,
      exp: null, prev: null, src: 'schedule' });
  }
  return out.sort((a, b) => a.t - b.t || (a.impact === 'high' ? -1 : 1));
}

// The calendar rules the council has tested: when each one applies, and what its study found (its own words).
export const RULES = [
  { topic: 'gold-pre-holiday', forward: 'gold-pre-holiday', when: (d) => tradingDay(d) && !!nyseHoliday(nextDay(d)) && 'the last trading day before a US market holiday',
    what: 'Long gold from the 17:00 New York open to that day\'s close, stop 1 ATR.' },
  { topic: 'post-holiday-metals', when: (d) => tradingDay(d) && !!nyseHoliday(prevWeekday(d)) && 'the first trading day after a US market holiday',
    what: 'Shorting gold and silver the day after a US holiday was tested.' },
  { topic: 'gotobi', when: (d) => weekday(d) && isGotobi(d) && 'a gotobi day (a Tokyo settlement day: the 5th, 10th, 15th, 20th, 25th or 30th)',
    what: 'Sell USD/JPY at 00:55 UTC, buy back at 06:00 UTC (the demo account runs it).' },
  { topic: 'turnaround-tuesday-forward', forward: 'turnaround-tuesday', when: (d) => dowOf(d) === 2 && tradingDay(d) && 'a Tuesday',
    what: 'Only if the Nasdaq 100 fell more than 1% on Monday: buy Monday\'s close, out at Tuesday\'s close or the stop.' },
  { topic: 'gold-turn-of-month', when: (d) => turnOfMonth(d) && 'the last two and first three trading days of a month',
    what: 'Long gold from two trading days before the month ends to three after.' },
];
const nextDay = (d) => { let x = addD(d, 1); while (!weekday(x)) x = addD(x, 1); return x; };
const prevWeekday = (d) => { let x = addD(d, -1); while (!weekday(x)) x = addD(x, -1); return x; };
export function turnOfMonth(d) {
  if (!tradingDay(d)) return false;
  const m = d.slice(0, 7), nextFirst = addD(`${m}-01`, 40).slice(0, 7) + '-01';
  const last = prevTrading(nextFirst), last2 = prevTrading(last);
  let f1 = `${m}-01`; while (!tradingDay(f1)) f1 = addD(f1, 1);
  const f2 = nextTrading(f1), f3 = nextTrading(f2);
  return [last2, last, f1, f2, f3].includes(d);
}

// The study's own verdict and headline (cached per run), and the forward record's latest reading when one runs.
export function ruleRecord(topic, dataDir, edgeDir = EDGE_DIR, forward = null) {
  let row = null; try { row = studyRow(readStudy(edgeDir, topic)); } catch (e) {}
  let fwd = null;
  if (forward && dataDir) {
    try { const j = JSON.parse(fs.readFileSync(path.join(dataDir, 'research', 'forward', forward + '.json'), 'utf8'));
      fwd = { reading: j.reading || null, verdict: j.verdict || null, n: Number.isFinite(j.n) ? j.n : null, dataEnd: j.dataEnd || null }; } catch (e) {}
  }
  return row ? { verdict: row.verdict, headline: row.headline, link: 'edge-lab.html#' + topic, forward: fwd } : null;
}

const pct = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2) + '%';
// What the Red folder record says for one release type, in one or two plain lines.
export function recordOf(rf, type) {
  const s = rf && rf.study && rf.study[type]; if (!s || !s.stats || !s.stats.n) return null;
  const st = s.stats, lines = [`Gold moved a median ±${st.absMed}% on the day of the last ${st.n} (since ${String(st.from).slice(0, 4)}), up ${Math.round(st.upShare * 100)}% of the time.`];
  if (st.above && st.below && st.above.n >= 10 && st.below.n >= 10) lines.push(`Above the consensus gold averaged ${pct(st.above.gold)} (n ${st.above.n}); below it ${pct(st.below.gold)} (n ${st.below.n}).`);
  else if (st.rose && st.fell && st.rose.n >= 10 && st.fell.n >= 10) lines.push(`Higher than the release before: gold averaged ${pct(st.rose.gold)} (n ${st.rose.n}); lower: ${pct(st.fell.gold)} (n ${st.fell.n}).`);
  return { name: s.name, n: st.n, absMed: st.absMed, upShare: st.upShare, lines, prep: (s.prep || []).filter((l) => /know the side|chase/i.test(l)).slice(0, 1) };
}

// How big a day to expect (20 Nov 2026, owner: plan and size the week): a normal day's gold range = the strategist's expected
// move (fc.assets.gold.expMovePct, ± %) of its last price, in $; on a day with a US release of a Red folder type, the median
// absolute gold day move on past releases of that type (n >= RANGE_MIN_N; the biggest of the day's types). Descriptive: a
// range for planning, never a forecast of direction.
export const RANGE_MIN_N = 8;
const medOf = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
function absMedOf(s) {
  const st = s && s.stats;
  if (st && Number.isFinite(st.absMed) && Number.isFinite(st.n)) return { pct: st.absMed, n: st.n };
  const g = ((s && s.rows) || []).map((r) => r.goldDay).filter(Number.isFinite).map(Math.abs);
  return g.length ? { pct: Math.round(medOf(g) * 100) / 100, n: g.length } : null;
}
export function dayRange(fc, day, rf) {
  const G = fc && fc.assets && fc.assets.gold, p = G ? Number(G.expMovePct) : NaN, px = G ? Number(G.last) : NaN;
  if (!Number.isFinite(p) || !(p > 0)) return null;
  const usd = (x) => (Number.isFinite(px) && px > 0 ? x / 100 * px : null);
  const say = (pc, us, n) => us != null ? `±$${Math.round(us).toLocaleString('en-US')} (±${pc.toFixed(1)}%${n ? `, n ${n}` : ''})` : `±${pc.toFixed(1)}%${n ? ` (n ${n})` : ''}`;
  const out = { normalPct: p, normalUsd: usd(p) }, parts = [`A typical day\'s move is about ${say(p, out.normalUsd)}, close to close.`];
  let best = null;
  for (const r of (day && day.releases) || []) {
    if (!r.type || r.country !== 'USD') continue;
    const s = rf && rf.study && rf.study[r.type], m = absMedOf(s);
    if (m && m.n >= RANGE_MIN_N && Number.isFinite(m.pct) && (!best || m.pct > best.pct)) best = { ...m, type: r.type, name: (s && s.name) || r.type };
  }
  if (best) {
    Object.assign(out, { eventPct: best.pct, eventUsd: usd(best.pct), type: best.type, n: best.n });
    // past release days are measured in their own years' volatility: when they sit under today's normal day, say so
    // (20 Nov 2026: core PCE days ±0.5% against a ±1.4% normal day now) instead of implying the release is the smaller risk
    parts.push(`On past ${best.name} days the median move was ${say(best.pct, out.eventUsd, best.n)}${best.pct < p ? ', measured over other years and as a median, so it is not comparable one for one: plan on the typical move' : ''}.`);
  }
  const mk = day && day.market;
  if (mk && mk.kind === 'holiday') parts.push('US markets closed: thin trading, moves can be jumpy and fade.');
  else if (mk && mk.kind === 'early') parts.push('Early close: thin trading later in the day.');
  parts.push('A size for planning, not a forecast of direction.');
  out.text = parts.join(' ');
  return out;
}

const money = (x) => '$' + Math.round(x).toLocaleString('en-US');
// "A normal day now" for every market the strategist covers (forecast.json `assets`): the expected daily move in the market's
// own unit, so the owner can size across markets. A range for planning, never a direction. Pure.
const NORMAL = [
  { k: 'gold', name: 'Gold', unit: '$', per: 1 }, { k: 'eurusd', name: 'EUR/USD', unit: 'pips', per: 0.0001 },
  { k: 'usdjpy', name: 'USD/JPY', unit: 'pips', per: 0.01 }, { k: 'nq', name: 'NQ', unit: 'points', per: 1 }, { k: 'es', name: 'ES', unit: 'points', per: 1 }];
export function normalDays(fc) {
  const A = fc && fc.assets, out = [];
  if (!A || typeof A !== 'object') return out;
  for (const m of NORMAL) {
    const a = A[m.k]; if (!a || a.expMovePct == null || a.last == null) continue;
    const pct = Number(a.expMovePct), px = Number(a.last);
    if (!Number.isFinite(pct) || !Number.isFinite(px) || !(pct > 0) || !(px > 0)) continue;
    const move = Math.round(pct / 100 * px / m.per), ratio = a.volRatio != null && Number.isFinite(Number(a.volRatio)) ? Number(a.volRatio) : null;
    const n = move.toLocaleString('en-US'), size = m.unit === '$' ? `±$${n}` : `±${n} ${m.unit}`;
    const tail = ratio == null ? '' : ratio >= 1.3 ? `, ${ratio.toFixed(1)}x its usual` : ratio <= 0.75 ? ', quieter than usual' : '';
    out.push({ k: m.k, name: m.name, pct, move, unit: m.unit, ratio, text: `${m.name}: about ${size} (±${pct.toFixed(1)}%)${tail}` });
  }
  return out;
}

// The frame of the week: one place for the numbers the desk already shows elsewhere.
export function frameOf(fc, v) {
  const g = fc && fc.goldScore, r = fc && fc.regime, sum = v && v.summary, out = { lines: [] };
  if (g && Number.isFinite(g.score)) {
    out.score = { score: g.score, label: g.label || g.bias || null, asOf: g.asOf || null };
    out.lines.push(`Gold Macro Score ${g.score > 0 ? '+' : ''}${g.score}: ${g.label || g.bias}. ${g.score > 0.25 ? 'The tested score leans to buying gold.' : 'The tested score gives no buy lean; a negative score is not a sell (no short edge was found).'}`);
  }
  if (r && r.label) { out.regime = r.label; out.lines.push(`Regime: ${r.label}${Number.isFinite(r.vix) ? `; VIX ${r.vix}` : ''}.`); }
  const L = sum && sum.levels;
  if (L && Number.isFinite(L.px)) {
    out.levels = { px: L.px, asOf: L.asOf || null, above: L.above || null, below: L.below || null };
    const a = L.above, b = L.below;
    // the levels are picked either side of the latest PRICE (glance.mjs `mark`), not the close: say the price they are read from
    const mk = L.mark && Number.isFinite(L.mark.px) ? L.mark.px : null, lab = (x) => String(x.label || '').replace(/\s*\(price is (under|over) every level he tracks\)/i, '').replace(/^Round number$/i, 'a round number');
    const made = (x) => x && x.made ? ': the price is past every level he tracks' : '';
    out.lines.push(`Gold ${mk != null ? `near ${money(mk)} now` : `near ${money(L.px)}`}${L.asOf ? ` (${mk != null ? `${money(L.px)} at` : 'as of'} the ${L.asOf} close)` : ''}${a ? `; above, ${money(a.price)} (${lab(a)}${a.crossed ? ', broken since the close' : ''}${made(a)})` : ''}${b ? `${a ? ';' : ';'} below, ${money(b.price)} (${lab(b)}${b.crossed ? ', broken since the close' : ''}${made(b)})` : ''}.`);
  }
  if (sum && sum.bias && Number.isFinite(sum.bias.p)) {
    const B = sum.bias; out.bias = { lean: B.lean, p: B.p, base: B.base, by: B.by, confidence: B.confidence || null };
    out.lines.push(`The veteran's month call: ${Math.round(B.p * 100)}% that gold is higher by ${B.by} against a base rate of ${Math.round(B.base * 100)}% (${B.lean === 'against' ? 'leans against gold' : B.lean === 'supportive' ? 'leans for gold' : 'neutral'}, confidence ${B.confidence || 'n/a'}).`);
  }
  const rs = v && v.research && Array.isArray(v.research.items) ? v.research.items : [];
  out.rulebook = rs.filter((i) => Array.isArray(i.readings) && i.readings.some((x) => x.on)).slice(0, 5).map((i) => ({ k: i.k, text: i.text, caveat: i.caveat || null }));
  return out;
}

// Speculative positioning (macro/cot.json, council/cot.mjs), 20 Nov 2026: one plain line per market only when it is notable,
// crowded (3-year percentile >= 90 or <= 10) or a big week (the week's change 1.5+ standard deviations of the prior year's weekly
// changes, the COT desk's own "flow" cut). The yen futures are yen against the dollar, so their long is a bet USD/JPY falls.
// The pre-registered COT study failed overall: a market without a passing cell is "positioning, not a tested signal".
export const COT_KEYS = [['gold', 'Gold'], ['silver', 'Silver'], ['eur', 'EUR/USD'], ['jpy', 'USD/JPY'], ['nq', 'Nasdaq 100'], ['es', 'S&P 500']];
const fmtN = (x) => (x < 0 ? '−' : '') + Math.abs(Math.round(x)).toLocaleString('en-US');
const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
export function positioningOf(cot) {
  const M = cot && Array.isArray(cot.markets) ? cot.markets : []; const out = [];
  for (const [k, name] of COT_KEYS) {
    const m = M.find((x) => x && x.k === k); if (!m || m.missing || !Number.isFinite(m.net)) continue;
    const pct = Number.isFinite(m.pct) ? m.pct : null, z = Number.isFinite(m.z) ? m.z : null;
    const crowd = pct == null ? null : pct >= 90 ? 'long' : pct <= 10 ? 'short' : null, big = z != null && Math.abs(z) >= 1.5;
    if (!crowd && !big) continue;
    const yen = k === 'jpy', fut = yen ? ' yen futures' : '', who = m.who ? m.who.charAt(0).toUpperCase() + m.who.slice(1) : 'Speculators';
    const parts = [];
    // a net LONG at the bottom of its range is not a crowded short (20 Nov 2026: silver net +3,615 at the 4th percentile)
    if (crowd) parts.push(crowd === 'short' && m.net > 0 ? `the least long in 3 years${fut} (${ord(pct)} percentile, still net long)`
      : crowd === 'long' && m.net < 0 ? `the least short in 3 years${fut} (${ord(pct)} percentile, still net short)`
      : `crowded ${crowd}${fut} (${ord(pct)} percentile of 3 years)`);
    if (big) parts.push(`${z > 0 ? 'big buying' : 'big selling'}${yen ? ' of yen' : ''} this week (${Number.isFinite(m.chg1) ? `${m.chg1 >= 0 ? '+' : '−'}${Math.abs(Math.round(m.chg1)).toLocaleString('en-US')} contracts, ` : ''}${z > 0 ? '+' : '−'}${Math.abs(z)} standard deviations)`);
    let text = `${name}: ${who} ${parts.join(', ')}; net ${fmtN(m.net)} contracts${m.asOf ? `, as of the ${m.asOf} report` : ''}${m.late ? ' (published late)' : ''}.`;
    if (yen) text += ` The yen futures are yen against the dollar: a long there is a bet that USD/JPY falls${crowd ? `, so crowded ${crowd} yen means crowded ${crowd === 'long' ? 'short' : 'long'} USD/JPY` : ''}.`;
    text += m.edgeStatus === 'tested' ? ` The pre-registered COT test passed one cell here (${String(m.edgeText || '').replace(/^edge: tested \(|\)$/g, '')}): a single cell, not a proven edge.`
      : ' Positioning, not a tested signal: the pre-registered COT test found no edge.';
    out.push({ market: k, name, pct, z, crowded: crowd, net: m.net, asOf: m.asOf || null, tested: m.edgeStatus === 'tested', text });
  }
  return out;
}

// The calls for the week, only when the recorded ones fall due inside it (they are re-issued once a week).
function callsOf(v, from, to) {
  const w = v && v.outlook && v.outlook.week; if (!w || !Array.isArray(w.list)) return { list: [], note: null };
  if (!(w.by >= from && w.by <= addD(to, 2))) return { list: [], note: 'The veteran issues the week\'s dated calls with his first run of the week; they appear here once issued.' };
  return { list: w.list.filter((c) => !/stretch/i.test(c.claim)).slice(0, 4).map((c) => ({ claim: c.claim, p: c.p, base: c.baseP })), note: null };
}

// One sentence a day: what matters most that day, in plain words.
function dayLine(d) {
  const hi = d.releases.filter((r) => r.impact === 'high');
  const us = hi.filter((r) => r.country === 'USD');
  const parts = [];
  if (d.market && d.market.kind === 'holiday') parts.push('US markets closed');
  else if (d.market && d.market.kind === 'early') parts.push('early close');
  if (us.length) parts.push(us.map((r) => r.title.replace(/\s*\(.*\)$/, '')).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3).join(', '));
  else if (hi.length) parts.push(hi.slice(0, 2).map((r) => `${r.country} ${r.title}`).join(', '));
  if ((d.auctions || []).some((a) => a.type !== 'Bill')) parts.push(`Treasury ${d.auctions.filter((a) => a.type !== 'Bill').map((a) => `${a.term}${a.type === 'TIPS' ? ' TIPS' : a.type === 'FRN' ? ' FRN' : ''}`).join(', ')} auction`);
  if (!parts.length) parts.push('no major release scheduled');
  return parts.join(' · ');
}

// The Cleveland Fed nowcast for a CPI / PCE release: the reference month is the month before the release month (an October PCE
// prints in late November). Only a nowcast without an actual print for that month is shown.
const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function nowcastFor(hd, r) {
  const N = hd && hd.nowcast && Array.isArray(hd.nowcast.months) ? hd.nowcast.months : null;
  if (!N || (r.type !== 'PCE' && r.type !== 'CPI')) return null;
  const d = new Date(r.t * 1000), ref = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const m = N.find((x) => x.month === ref); if (!m) return null;
  const [h, c] = r.type === 'PCE' ? ['pce', 'corePce'] : ['cpi', 'coreCpi'];
  if (m.actual && (m.actual[h] != null || m.actual[c] != null)) return null;
  if (m.now[h] == null && m.now[c] == null) return null;
  const f = (x) => x == null ? 'n/a' : (x > 0 ? '+' : '') + x.toFixed(2) + '%';
  return { month: ref, core: m.now[c] ?? null, head: m.now[h] ?? null, asOf: m.asOf || null,
    text: `the Cleveland Fed nowcast for ${MN[+ref.slice(5) - 1]} is core ${f(m.now[c])}, headline ${f(m.now[h])} month on month${m.asOf ? ` (as of ${m.asOf})` : ''}, a model's estimate, not the consensus` };
}

// The nowcast beside the consensus (20 Nov 2026): for a CPI / PCE release with both a calendar consensus and a nowcast, which way
// the model leans against what the calendar expects, and what the Red folder record says gold did on past prints above / below
// the consensus (left out under MIN_PREP releases on either side). A model's estimate against a calendar consensus: no forecast,
// no call, no rule reads it.
export const IN_LINE = 0.05, MIN_PREP = 6;
// The pre-registered look-back (research/edge/nowcast-vs-consensus, 20 Nov 2026, INCONCLUSIVE): on the 36 CPI releases of 2022-24,
// did the core print land on the side the nowcast leaned to? Shown on the core CPI row only (the study's primary measure).
// A constant so the bundle needs no file; tests/nowcast-vs-consensus.test.mjs compares it with the study's result.json.
export const PREP_STUDY = { study: 'nowcast-vs-consensus', verdict: 'INCONCLUSIVE', hits: 8, n: 13, p: 0.58,
  text: "In 2022-24 the nowcast's side matched the print on 8 of 13 judged core CPI releases (two-sided binomial p 0.58): too few judged releases to say." };
export function parseExp(x) {
  if (x == null) return null;
  const m = String(x).replace(/−/g, '-').match(/^\s*([+-]?\d+(?:\.\d+)?)\s*%?\s*$/);
  return m ? +m[1] : null;
}
export function prepFor(r, nc, record) {
  if (!r || !nc) return null;
  // the nowcast is a month-on-month price change: only beside an m/m CPI / PCE price row (never income, spending, q/q, y/y)
  if (!(/m\/m/i.test(r.title || '') && /\b(CPI|PCE)\b|price index/i.test(r.title || '')) || /income|spending|y\/y|q\/q|year/i.test(r.title || '')) return null;
  const cons = parseExp(r.exp); if (cons == null) return null;
  const core = /\bcore\b/i.test(r.title || '');
  const fig = core ? nc.core : nc.head; if (fig == null || !Number.isFinite(fig)) return null;
  const gap = Math.round((fig - cons) * 100) / 100;
  const side = Math.abs(fig - cons) < IN_LINE - 1e-9 ? 'in line' : fig > cons ? 'above' : 'below';
  const kind = (core ? 'core ' : '') + (r.type || 'release');
  const sg = (x) => (x > 0 ? '+' : '') + x.toFixed(2) + '%';
  const lead = side === 'in line' ? `The nowcast (${sg(fig)}) is in line with the ${r.exp} consensus (within ${IN_LINE} points).`
    : `The nowcast (${sg(fig)}) sits ${side} the ${r.exp} consensus by ${Math.abs(gap).toFixed(2)} points.`;
  const st = record && (record.stats || record), A = st && st.above, B = st && st.below;
  // the Red folder study sorts its above / below days by the CORE figure's surprise: shown on the core row only
  const hist = core && A && B && A.n >= MIN_PREP && B.n >= MIN_PREP && Number.isFinite(A.gold) && Number.isFinite(B.gold)
    ? ` On past ${kind} releases that printed above consensus gold averaged ${sg(A.gold)} on the day (n ${A.n}); below, ${sg(B.gold)} (n ${B.n}).` : '';
  const study = core && r.type === 'CPI' ? PREP_STUDY : null;
  const text = lead + hist + (study ? ' ' + study.text : '') + ' A model\'s estimate, not a forecast; a calendar consensus, not a survey; descriptive, not a tested edge.';
  const short = side === 'in line' ? `nowcast ${sg(fig)} in line with the ${r.exp} consensus` : `nowcast ${sg(fig)} ${side} the ${r.exp} consensus`;
  return { core, nowcast: fig, consensus: cons, gap, side, record: hist ? { above: { n: A.n, gold: A.gold }, below: { n: B.n, gold: B.gold } } : null,
    study: study ? { study: study.study, verdict: study.verdict, hits: study.hits, n: study.n, p: study.p } : null, text, short };
}

// The plan: { at, from, to, next, days: [...], frame, calls, lines, note }.
export function build({ now, cal, rf, fc, v, hd = null, cot = null, dataDir = null, edgeDir = EDGE_DIR }) {
  const W = weekOf(now), days = [], recs = new Map();
  const rec = (rule) => { if (!recs.has(rule.topic)) recs.set(rule.topic, ruleRecord(rule.topic, dataDir, edgeDir, rule.forward)); return recs.get(rule.topic); };
  const rel = releasesOf(cal, W.from, W.to);
  for (let d = W.from; d <= W.to; d = addD(d, 1)) {
    if (!weekday(d)) continue;
    const releases = rel.filter((r) => r.day === d).map((r) => ({ ...r, record: r.type ? recordOf(rf, r.type) : null, nowcast: nowcastFor(hd, r) })).map((r) => ({ ...r, prep: prepFor(r, r.nowcast, r.type && rf && rf.study ? rf.study[r.type] : null) }));
    const rules = [];
    for (const R of RULES) { const why = R.when(d); if (!why) continue; const rr = rec(R); if (rr) rules.push({ topic: R.topic, when: why, what: R.what, ...rr }); }
    const fed = hd && hd.fed && Array.isArray(hd.fed.events) ? hd.fed.events.filter((e) => e.day === d).slice(0, 6) : [];
    // 20 Nov 2026: the US Treasury's announced auctions of that day (hard-data.mjs `auctions`), as plain text
    const auctions = hd && hd.auctions && Array.isArray(hd.auctions.list) ? hd.auctions.list.filter((a) => a.day === d).slice(0, 6).map((a) => ({ ...a, text: auctionText(a) })) : [];
    const day = { day: d, dow: DOW[dowOf(d)], market: marketNote(d), releases, rules, fed, auctions };
    day.line = dayLine(day); day.range = dayRange(fc, day, rf); days.push(day);
  }
  const frame = frameOf(fc, v), calls = callsOf(v, W.from, W.to);
  frame.normalDays = normalDays(fc);
  if (hd && hd.odds && hd.odds.line) { frame.odds = { meeting: hd.odds.meeting, kalshi: (hd.odds.kalshi || []).slice(0, 3), polymarket: hd.odds.polymarket ? hd.odds.polymarket.markets.slice(0, 3) : [], at: hd.odds.at }; }
  if (hd && hd.gdpnow && Number.isFinite(hd.gdpnow.value)) frame.lines.push(`Atlanta Fed GDPNow for ${hd.gdpnow.quarter}: ${hd.gdpnow.value}% annualized${Number.isFinite(hd.gdpnow.prev) ? ` (the quarter before: ${hd.gdpnow.prev}%)` : ''}.`);
  // How the expectations moved (macro/hard-data.json `hist`): a day and a week back, only where both readings exist.
  const mv = hd ? moves(hd, now) : [];
  // only what moved (an unchanged "92% now, 92% a day ago" is noise), four lines at most
  if (mv.length) { frame.moves = mv; for (const m of mv.filter((x) => x.day || x.week).slice(0, 4)) frame.lines.push(m.text); }
  frame.positioning = positioningOf(cot).map((p) => ({ market: p.market, text: p.text }));
  for (const p of frame.positioning) frame.lines.push(p.text);
  const usHi = days.flatMap((d) => d.releases.filter((r) => r.impact === 'high' && r.country === 'USD').map((r) => ({ ...r, dow: d.dow })));
  const busiest = days.slice().sort((a, b) => b.releases.filter((r) => r.impact === 'high').length - a.releases.filter((r) => r.impact === 'high').length)[0];
  const lines = [];
  const closed = days.filter((d) => d.market && d.market.kind === 'holiday'), early = days.filter((d) => d.market && d.market.kind === 'early');
  if (closed.length || early.length) lines.push(`A short week: ${[...closed.map((d) => `US markets closed ${d.dow}`), ...early.map((d) => `early close ${d.dow}`)].join(', ')}. Expect thin trading around ${closed.length ? 'the holiday' : 'the early close'}.`);
  if (frame.odds) lines.push(hd.odds.line);
  const big = hd ? bigOddsMove(hd, now) : null;
  if (big) lines.push(big.text);
  const nc = days.flatMap((d) => d.releases.filter((r) => r.nowcast).map((r) => `${r.title.replace(/\s*\(.*\)$/, '')} (${d.dow}): ${r.nowcast.text}`));
  if (nc.length) lines.push(`Before the print: ${nc.join('; ')}.`);
  for (const d of days) for (const r of d.releases) if (r.prep) lines.push(`Before ${d.dow}'s ${r.title.replace(/\s*\(.*\)$/, '')}: ${r.prep.short}${r.prep.record ? `; past prints above it: gold ${pct(r.prep.record.above.gold)} (n ${r.prep.record.above.n}), below: ${pct(r.prep.record.below.gold)} (n ${r.prep.record.below.n})` : ''}. A model's estimate, descriptive only.`);
  if (usHi.length) lines.push(`The US data that move gold most: ${usHi.map((r) => `${r.title.replace(/\s*\(.*\)$/, '')} (${r.dow})`).filter((x, i, a) => a.indexOf(x) === i).join(', ')}.`);
  else lines.push('No top-tier US release is scheduled on the files read so far.');
  if (busiest && busiest.releases.some((r) => r.impact === 'high') && usHi.length > 1) lines.push(`${busiest.dow} is the busiest day: plan around it, and know which side a surprise favours before the print, not after.`);
  const tested = days.filter((d) => d.rules.some((r) => r.verdict === 'pass')).map((d) => `${d.dow}: ${d.rules.filter((r) => r.verdict === 'pass').map((r) => String(r.when).replace(/\s*\(.*\)$/, '')).join(' and ')}`);
  if (tested.length) lines.push(`Calendar rules the desk has tested that passed their bar: ${tested.join('; ')}. Paper only, each with its own forward record: not proven.`);
  const failed = days.filter((d) => d.rules.some((r) => r.verdict === 'fail')).map((d) => d.dow);
  if (failed.length) lines.push(`Rules tested and failed also fall on ${failed.join(', ')}: listed there so they are not chased.`);
  const calNote = (W.next && !rel.some((r) => r.src === 'calendar')) ? 'Next week\'s economic calendar is not published yet (it usually appears over the weekend): the big US releases come from the council\'s own schedule, without consensus figures for now.' : null;
  return { v: 1, at: new Date(now * 1000).toISOString().replace(/\.\d+Z$/, 'Z'), from: W.from, to: W.to, next: W.next,
    label: 'Week ahead: a plan from the calendar, the Red folder record, the tested calendar rules and the desk\'s levels. Not advice, not a forecast; paper only.',
    lines, days, frame, calls, calNote };
}
