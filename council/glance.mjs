// Council · The veteran at a glance (9 Nov 2026, owner: "be the best of all time veteran, more visual, simpler").
//   summary(v)          one plain sentence for the week, a bias meter for gold (supportive / neutral / against, with
//                       confidence), the one event that matters most with its time, and the two levels to watch.
//   snapshot(v)         the compact copy of a briefing kept in macro/veteran-briefings.json (one per week, the latest of it).
//   briefDiff(prev, cur, calls)   what changed since last week's briefing: bias, price, insights, levels, hypotheses (with how
//                       last week's came out, from the calls ledger).
// Everything is read from what the veteran already computed (veteran.json); deterministic, no fetches, public data only.
// The bias is the veteran's own 20-session probability for gold (his month "closes above today" call, after calibration)
// against its 10-year base rate: no new model, no new rule.
import { nearestLevel } from './briefing.mjs';
import { usHolidays } from './datacheck.mjs';
import { EVENTS } from './events.mjs';
import { cmeYear } from '../ict/calendar.mjs';

export const LEAN_PTS = 0.03;   // the bias reads supportive / against only 3+ points away from the base rate
export const KEEP_WEEKS = 26;
const DAY = 86400;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dShort = (iso) => { const d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00Z' : iso); return Number.isFinite(d.getTime()) ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` : String(iso); };
const tShort = (iso) => { const d = new Date(iso); return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`; };
const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
const pc = (v) => `${Math.round(v * 100)}%`;
const sgp = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;

export function biasOf(v) {
  const m = v && v.outlook && v.outlook.month, c = m && m.list.find((x) => x.asset === 'gold' && x.kind === 'closeAbove');
  let p = null, base = null, by = null, src = null, level = null, from = null;
  if (c && Number.isFinite(c.p)) { p = c.p; base = Number.isFinite(c.baseP) ? c.baseP : v.base ? v.base.upRate : null; by = c.by; src = 'month call';
    level = Number.isFinite(c.level) ? c.level : null; from = (v.outlook.anchor && v.outlook.anchor.asOf) || m.asOf || null; }
  else if (v && v.ledger && v.ledger.lastProbability != null) { p = v.ledger.lastProbability; base = v.base ? v.base.upRate : null; src = 'ledger'; }
  if (p == null) return null;
  const tilt = base == null ? 0 : p - base, lean = tilt >= LEAN_PTS ? 'supportive' : tilt <= -LEAN_PTS ? 'against' : 'neutral';
  const vd = (v && v.verdict) || {}, steps = ['low', 'medium', 'high'];
  let ci = vd.bias === 'BUY' ? (vd.conviction === 'High' ? 2 : vd.conviction === 'Medium' ? 1 : 0) : 0; if (vd.eventWithin72h && ci > 0) ci--;
  const ch = (v && v.channels) || [], up = ch.filter((x) => x.lean > 0).length, dn = ch.filter((x) => x.lean < 0).length, none = ch.filter((x) => x.lean == null).length;
  return { lean, p: +p.toFixed(2), base: base == null ? null : +base.toFixed(2), tilt: +tilt.toFixed(3), by, src, ...(level != null ? { level, from } : {}), confidence: steps[ci],
    meter: Math.max(-1, Math.min(1, tilt / 0.15)),   // -1 .. +1 for the gauge: ±15 points from base fills it
    channels: { up, down: dn, flat: ch.length - up - dn - none, unobserved: none, total: ch.length },
    why: vd.bias === 'BUY' ? `The tested Gold Macro Score is on (${vd.conviction || 'low'} conviction)${vd.eventWithin72h ? '; one step lower into the event' : ''}.`
      : 'The tested Gold Macro Score shows no edge, so the odds stay near the base rate.' };
}
export function eventOf(v) {
  const i = v && v.briefing && v.briefing.insights && v.briefing.insights.find((x) => x.k === 'event' && x.event);
  if (i) return { ...i.event, when: tShort(i.event.at) };
  const e = v && v.verdict && v.verdict.eventWithin72h; return e ? { title: e.title, at: e.at, consensus: e.consensus ?? null, when: tShort(e.at) } : null;
}
// ---- how fresh the levels are, and what price has done since the close (11 Nov, display only) ---------------------------------
// Every level is computed from complete daily candles. closeAge counts the weekday sessions that have fully ended (UTC days)
// since the last close on file, skipping the days the market is shut all day (datacheck.mjs usHolidays, the calendar the data
// check and the digest use): 0 = the latest close there can be; 1 or more = stale, said in words.
const dayT = (iso) => Date.parse(iso + 'T00:00:00Z') / 1000, isoD = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export function closeAge(asOf, now) {
  if (!/^\d{4}-\d\d-\d\d$/.test(String(asOf || '')) || !Number.isFinite(now)) return null;
  let n = 0;
  for (let t = dayT(asOf) + DAY; t + DAY <= now; t += DAY) { const d = isoD(t), w = new Date(t * 1000).getUTCDay(); if (w >= 1 && w <= 5 && usHolidays(+d.slice(0, 4)).get(d) !== 'closed') n++; }
  return { asOf, sessions: n, stale: n >= 1, text: n >= 1 ? `Stale: last close ${asOf}, ${n} trading day${n === 1 ? '' : 's'} ago` : `as of ${asOf} close` };
}
// the strategist's latest price for an asset (forecast.json assets.<k>.last at fc.at): used only when it comes from the same feed
// as the daily candles (OANDA), so a fallback feed's price basis never "breaks" a level
export function markOf(fc, k = 'gold') {
  const a = fc && fc.assets && fc.assets[k], at = fc && fc.at, src = fc && fc.sources && fc.sources[`bars:${k}`];
  if (!a || !Number.isFinite(a.last) || !(a.last > 0) || !Number.isFinite(Date.parse(at || '')) || (src != null && !/^OANDA ok/.test(src))) return null;
  return { px: a.last, at };
}
// Stamps a level block (briefing.levels.gold / .dxy) for the desk: `fresh` (closeAge), `mark` (the latest price, only when it is
// later than the close the levels come from) and `crossed: true` on each level price has traded through since that close.
// Nothing here is read by a hypothesis, a call or their scoring: the list's prices, sides and distances stay as computed.
export function markLevels(lv, { now, mark = null } = {}) {
  if (!lv || !Array.isArray(lv.list)) return lv;
  lv.fresh = closeAge(lv.asOf, now);
  const ok = mark && Number.isFinite(mark.px) && /^\d{4}-\d\d-\d\d$/.test(String(lv.asOf || '')) && Date.parse(mark.at) / 1000 >= dayT(lv.asOf) + DAY && mark.px !== lv.px;
  lv.mark = ok ? { px: mark.px, at: mark.at, dist: +((mark.px / lv.px - 1) * 100).toFixed(2) } : null;
  for (const l of lv.list) { const x = ok && (mark.px > lv.px ? l.price > lv.px && l.price <= mark.px : l.price < lv.px && l.price >= mark.px); if (x) l.crossed = true; else delete l.crossed; }
  return lv;
}
// The two levels to watch. Without a later price: the nearest structural level each side of the close (as before). With one:
// the nearest each side of that price, so a level already traded through is never offered as the level "above" when price is
// above it; `broken` names the level that WAS the one to watch on that side at the close, when price has crossed it.
export function watchLevels(v) {
  const g = v && v.briefing && v.briefing.levels && v.briefing.levels.gold; if (!g) return null;
  const m = g.mark && Number.isFinite(g.mark.px) ? g.mark.px : null;
  const out = (l) => (l ? { price: l.price, label: l.label, dist: l.dist, ...(m != null ? { distNow: +((l.price / m - 1) * 100).toFixed(2) } : {}), ...(l.crossed ? { crossed: true } : {}) } : null);
  const was = m == null ? null : nearestLevel(g, m > g.px ? 'above' : 'below');
  // price run past every level on file (19 Nov 2026: gold 3.7% under the close, nothing below it): the next $50 round number
  // beyond the price, said so, as the desk's "Your read" does; display only, never added to the list a hypothesis reads
  const made = (side) => (m == null ? null : { price: side === 'below' ? Math.floor((m - 0.01) / 50) * 50 : Math.ceil((m + 0.01) / 50) * 50,
    label: `Round number (price is ${side === 'below' ? 'under' : 'over'} every level he tracks)`, made: true });
  const pick = (side) => { const l = nearestLevel(g, side, 0.4, m); if (l) return out(l); const r = made(side); return r ? { ...r, dist: +((r.price / g.px - 1) * 100).toFixed(2), distNow: +((r.price / m - 1) * 100).toFixed(2) } : null; };
  return { px: g.px, asOf: g.asOf, above: pick('above'), below: pick('below'),
    fresh: g.fresh || null, mark: g.mark || null, broken: was && was.crossed ? { price: was.price, label: was.label, side: m > g.px ? 'above' : 'below' } : null };
}
// ---- what the week holds that the 72-hour event window does not (20 Nov 2026, display only) ------------------------------------
// The next top-tier US release on the council's own schedule (council/events.mjs: CPI, payrolls, PCE, the Fed), within `days`.
export function nextScheduled(now, days = 8) {
  const e = EVENTS.filter((x) => x.tier === 1 && x.country === 'USD' && x.t > now && x.t <= now + days * DAY).sort((a, b) => a.t - b.t)[0];
  return e ? { title: e.title.replace(/\s*\(.*\)$/, ''), country: e.country, at: new Date(e.t * 1000).toISOString(), when: tShort(new Date(e.t * 1000).toISOString()), src: 'schedule' } : null;
}
// US market holidays and early closes from `from` to `to` (YYYY-MM-DD, inclusive), from the CME calendar the ICT desk uses.
// `closes` says what the day means for a dated call: spot gold and the currencies print a daily close on a US holiday that only
// shortens the CME session (Thanksgiving), so it counts as a session; on a full closure (Good Friday, Christmas, New Year) there
// is no normal session and a call due that day is scored on the last close on file by then (outlook.mjs resolveCall): OANDA
// prints a thin stub candle on 25 Dec and 1 Jan, none on Good Friday.
export function holidaysBetween(from, to) {
  const out = []; if (!/^\d{4}-\d\d-\d\d$/.test(String(from || '')) || !/^\d{4}-\d\d-\d\d$/.test(String(to || ''))) return out;
  for (let t = dayT(from); t <= dayT(to); t += DAY) { const d = isoD(t), w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const Y = cmeYear(+d.slice(0, 4)), full = Y.full.get(d), early = Y.early.get(d); if (!full && !early) continue;
    const name = full || early.name, stocksShut = !!full || !/eve|after thanksgiving/i.test(name);
    out.push({ day: d, dow: WD[w], name, kind: full ? 'closed' : stocksShut ? 'holiday' : 'early', session: !full,
      text: full ? `${name} (${WD[w]} ${dShort(d)}): markets closed, no normal session; a call due that day is scored on the last close on file by then (the day's stub candle when the feed prints one, as it does at Christmas and New Year; else the close before)`
        : stocksShut ? `${name} (${WD[w]} ${dShort(d)}): US stocks closed, gold and currencies trade a short, thin session that still counts as a daily close`
          : `${name} (${WD[w]} ${dShort(d)}): US markets close early; a thin session that still counts as a daily close` }); }
  return out;
}
// The summary's parts must agree with each other before the sentence is shown (20 Nov 2026). Each check names what a reader
// would act on wrongly: a level on the wrong side of the price, a lean that contradicts its own numbers, a call read as if it
// started from today's price, a macro sell. A failed check withholds the sentence (the parts stay for the desk).
export function consistency(s, v) {
  const issues = [], L = s.levels, B = s.bias, ref = L && (L.mark && Number.isFinite(L.mark.px) ? L.mark.px : L.px);
  if (L && Number.isFinite(ref)) {
    if (L.above && !(L.above.price > ref)) issues.push(`the level above (${usd(L.above.price)}) is not above the price (${usd(ref)})`);
    if (L.below && !(L.below.price < ref)) issues.push(`the level below (${usd(L.below.price)}) is not below the price (${usd(ref)})`);
  }
  // (the stored tilt is rounded to 3 places: half a point of slack at the band's edge)
  if (B && B.base != null) { const e = 0.0006, bad = B.lean === 'supportive' ? B.tilt < LEAN_PTS - e : B.lean === 'against' ? B.tilt > -LEAN_PTS + e : Math.abs(B.tilt) > LEAN_PTS + e; if (bad) issues.push(`the lean (${B.lean}) does not match its odds (${pc(B.p)} against a base of ${pc(B.base)})`); }
  if (B && B.level != null && Number.isFinite(ref) && Math.abs(ref / B.level - 1) >= FAR && !/closing above/.test(s.sentence)) issues.push('the odds are quoted without the level they were set from, and the price has moved away from it');
  if (B && B.by && v && v.at && B.by < String(v.at).slice(0, 10)) issues.push(`the month call's date (${B.by}) has passed`);
  if (v && v.verdict && /SELL/i.test(String(v.verdict.bias))) issues.push('a macro sell on gold: the veteran never issues one');
  if (s.event && /No major release/.test(s.sentence)) issues.push('the sentence says no release while an event is named');
  return { ok: !issues.length, issues };
}
export const FAR = 0.02;   // from 2% between the price and a call's starting close, the sentence names the level and the gap
export function summary(v) {
  if (!v) return null;
  const bias = biasOf(v), event = eventOf(v), levels = watchLevels(v), parts = [], now = Date.parse(v.at || '') / 1000;
  const ref = levels && (levels.mark && Number.isFinite(levels.mark.px) ? levels.mark.px : levels.px);
  // the odds belong to a level: "higher" means above the close the call was issued from, not above today's price
  const gap = bias && bias.level != null && Number.isFinite(ref) ? ref / bias.level - 1 : null, far = gap != null && Math.abs(gap) >= FAR;
  if (bias) { bias.gapPct = gap == null ? null : +(gap * 100).toFixed(1);
    const lean = bias.lean === 'supportive' ? 'the macro leans supportive for gold' : bias.lean === 'against' ? 'the macro leans against gold' : 'no macro edge for gold, neutral';
    parts.push(far ? `${lean} (${bias.from ? `at the ${dShort(bias.from)} close ` : ''}he put ${pc(bias.p)} on gold closing above ${usd(bias.level)}${bias.by ? ` on ${dShort(bias.by)}` : ''}, base ${bias.base == null ? 'n/a' : pc(bias.base)}; gold is now ${Math.abs(bias.gapPct).toFixed(1)}% ${gap < 0 ? 'below' : 'above'} that level, so read the lean, not the odds)`
      : `${lean} (${pc(bias.p)} chance it is higher${bias.by ? ` by ${dShort(bias.by)}` : ''}, base ${bias.base == null ? 'n/a' : pc(bias.base)})`); }
  let s = `This week: ${parts[0] || 'no read yet'}.`;
  const next = event || !Number.isFinite(now) ? null : nextScheduled(now);
  s += event ? ` ${event.country ? event.country + ' ' : ''}${event.title} (${event.when}) is the event that matters most.`
    : next ? ` No major release in the next 72 hours; next on the schedule: US ${next.title} (${next.when}).` : ' No major release is scheduled this week.';
  if (levels && (levels.above || levels.below)) {
    // the levels come from daily closes: say which close, say so when it is old, and never call a level price has already
    // crossed a level "above" or "below" without saying it broke
    const f = levels.fresh, close = f ? `${dShort(f.asOf)} close` : 'last close', br = levels.broken;
    const tag = (l) => (!l.crossed ? '' : br && br.price === l.price ? ' (that level, broken since the close)' : ' (broken since the close)');
    if (br) s += ` Gold has traded ${br.side === 'below' ? 'below' : 'above'} ${usd(br.price)} (${br.label.toLowerCase()}) since the ${close} and is near ${usd(levels.mark.px)}.`;
    s += ` Watch ${[levels.above && `${usd(levels.above.price)} above${tag(levels.above)}`, levels.below && `${usd(levels.below.price)} below${tag(levels.below)}`].filter(Boolean).join(' and ')}`;
    s += f && f.stale ? `. Levels are stale: last close ${dShort(f.asOf)}, ${f.sessions} trading day${f.sessions === 1 ? '' : 's'} ago.` : f ? `. Levels as of the ${close}.` : '.';
  }
  // US holidays and early closes of the next seven days (thin sessions; which of them count as a daily close for the calls)
  const hol = Number.isFinite(now) ? holidaysBetween(isoD(now), isoD(now + 7 * DAY)) : [];
  if (hol.length) s += ` Holiday trading ahead: ${hol.map((h) => (h.kind === 'early' ? `early close ${h.dow} ${dShort(h.day)}` : `${h.name.replace(/ Day$/, '')} ${h.dow} ${dShort(h.day)}${h.kind === 'closed' ? ' (markets closed)' : ' (US stocks closed, gold thin)'}`)).join(', ')}.`;
  const out = { sentence: s, bias, event, ...(next ? { next } : {}), levels, ...(hol.length ? { holidays: hol } : {}),
    calibration: v.calibration ? { status: v.calibration.status, line: v.calibration.line, k: v.calibration.k } : null, publicOnly: true };
  const check = consistency(out, v); out.check = check;
  if (!check.ok) { out.withheld = s; out.sentence = `Summary withheld this run: its parts disagree (${check.issues.join('; ')}). The levels and odds below are shown as computed.`; }
  return out;
}

// ---- what changed since last week ---------------------------------------------------------------------------------------
const STRUCT = new Set(['week', 'month', 'sma', 'swing', 'range']);
const lvKey = (l) => `${l.kind}:${String(l.label).replace(/\s*\(?\d{4}-\d\d-\d\d\)?/g, '').replace(/^(January|February|March|April|May|June|July|August|September|October|November|December) /, 'Month ').trim()}`;
export function snapshot(v, week) {
  const b = (v && v.briefing) || {}, g = b.levels && b.levels.gold, s = v && v.summary;
  return { week, at: v && v.at, px: g ? g.px : null, dxy: b.levels && b.levels.dxy ? b.levels.dxy.px : null,
    bias: s && s.bias ? { lean: s.bias.lean, p: s.bias.p, base: s.bias.base } : null,
    insights: (b.insights || []).map((i) => ({ k: i.k, rank: i.rank, lean: i.lean || 0, title: i.title })),
    levels: g ? g.list.filter((l) => STRUCT.has(l.kind)).map((l) => ({ key: lvKey(l), label: l.label, price: l.price })) : [],
    hypotheses: (b.hypotheses || []).map((h) => ({ id: h.id, slot: h.slot, claim: h.claim, p: h.p, by: h.by })) };
}
// keep one snapshot per week (the latest run of that week), oldest first, the last KEEP_WEEKS weeks
export function archiveWeek(hist, snap) {
  const H = (Array.isArray(hist) ? hist : []).filter((x) => x && x.week !== snap.week).concat([snap]).sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0));
  return H.slice(-KEEP_WEEKS);
}
export const previousOf = (hist, week) => (Array.isArray(hist) ? hist : []).filter((x) => x && x.week < week).at(-1) || null;
const LEANW = (l) => (l > 0 ? 'supports gold' : l < 0 ? 'weighs on gold' : 'no lean');
export function briefDiff(prev, cur, calls = []) {
  if (!prev) return { since: null, items: [], first: true, line: 'First briefing on the record: next week this shows what changed.' };
  const items = [], add = (area, text, dir = 0) => items.push({ area, text, dir });
  if (prev.bias && cur.bias) {
    if (prev.bias.lean !== cur.bias.lean) add('bias', `Bias ${prev.bias.lean} → ${cur.bias.lean} (${pc(prev.bias.p)} → ${pc(cur.bias.p)} chance gold is higher in 20 sessions)`, cur.bias.p > prev.bias.p ? 1 : -1);
    else if (Math.abs(cur.bias.p - prev.bias.p) >= 0.02) add('bias', `Bias still ${cur.bias.lean}; the odds moved ${pc(prev.bias.p)} → ${pc(cur.bias.p)}`, cur.bias.p > prev.bias.p ? 1 : -1);
    else add('bias', `Bias unchanged: ${cur.bias.lean} (${pc(cur.bias.p)})`, 0);
  }
  if (prev.px && cur.px) { const d = (cur.px / prev.px - 1) * 100; add('price', `Gold ${usd(prev.px)} → ${usd(cur.px)} (${sgp(d)})`, d > 0.05 ? 1 : d < -0.05 ? -1 : 0); }
  const pi = new Map(prev.insights.map((i) => [i.k, i])), ci = new Map(cur.insights.map((i) => [i.k, i]));
  for (const i of cur.insights) { const o = pi.get(i.k);
    if (!o) add('insight', `New: ${i.title}`, i.lean);
    else if (o.lean !== i.lean) add('insight', `${i.title}: now ${LEANW(i.lean)} (was ${LEANW(o.lean)})`, i.lean - o.lean > 0 ? 1 : -1);
    else if (o.rank - i.rank >= 2) add('insight', `Moved up to #${i.rank} (from #${o.rank}): ${i.title}`, 0); }
  for (const o of prev.insights) if (!ci.has(o.k)) add('insight', `Dropped: ${o.title}`, 0);
  const pl = new Map(prev.levels.map((l) => [l.key, l]));
  for (const l of cur.levels) { const o = pl.get(l.key); if (!o) continue; const d = (l.price / o.price - 1) * 100;
    if (Math.abs(d) >= 0.1) add('level', `${l.label.replace(/\s*\d{4}-\d\d-\d\d/, '')} ${usd(o.price)} → ${usd(l.price)} (${sgp(d)})`, d > 0 ? 1 : -1); }
  const byId = new Map((calls || []).map((r) => [r.id, r]));
  for (const h of prev.hypotheses) { const r = byId.get(h.id), hit = r ? r.hit : null;
    add('hypothesis', `Last week's ${h.slot} (${pc(h.p)}): ${hit === true ? 'came true' : hit === false ? 'did not happen' : `pending, due ${h.by}`} · ${h.claim}`, hit === true ? 1 : hit === false ? -1 : 0); }
  for (const h of cur.hypotheses) add('hypothesis', `New ${h.slot} (${pc(h.p)}): ${h.claim}`, 0);
  return { since: prev.at, sinceWeek: prev.week, items, first: false, line: `${items.filter((x) => x.area !== 'hypothesis').length} changes since the briefing of ${String(prev.at || prev.week).slice(0, 10)}.` };
}
