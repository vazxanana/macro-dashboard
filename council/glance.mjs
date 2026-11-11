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
  let p = null, base = null, by = null, src = null;
  if (c && Number.isFinite(c.p)) { p = c.p; base = Number.isFinite(c.baseP) ? c.baseP : v.base ? v.base.upRate : null; by = c.by; src = 'month call'; }
  else if (v && v.ledger && v.ledger.lastProbability != null) { p = v.ledger.lastProbability; base = v.base ? v.base.upRate : null; src = 'ledger'; }
  if (p == null) return null;
  const tilt = base == null ? 0 : p - base, lean = tilt >= LEAN_PTS ? 'supportive' : tilt <= -LEAN_PTS ? 'against' : 'neutral';
  const vd = (v && v.verdict) || {}, steps = ['low', 'medium', 'high'];
  let ci = vd.bias === 'BUY' ? (vd.conviction === 'High' ? 2 : vd.conviction === 'Medium' ? 1 : 0) : 0; if (vd.eventWithin72h && ci > 0) ci--;
  const ch = (v && v.channels) || [], up = ch.filter((x) => x.lean > 0).length, dn = ch.filter((x) => x.lean < 0).length, none = ch.filter((x) => x.lean == null).length;
  return { lean, p: +p.toFixed(2), base: base == null ? null : +base.toFixed(2), tilt: +tilt.toFixed(3), by, src, confidence: steps[ci],
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
  return { px: g.px, asOf: g.asOf, above: out(nearestLevel(g, 'above', 0.4, m)), below: out(nearestLevel(g, 'below', 0.4, m)),
    fresh: g.fresh || null, mark: g.mark || null, broken: was && was.crossed ? { price: was.price, label: was.label, side: m > g.px ? 'above' : 'below' } : null };
}
export function summary(v) {
  if (!v) return null;
  const bias = biasOf(v), event = eventOf(v), levels = watchLevels(v), parts = [];
  if (bias) parts.push(`${bias.lean === 'supportive' ? 'the macro leans supportive for gold' : bias.lean === 'against' ? 'the macro leans against gold' : 'no macro edge for gold, neutral'} (${pc(bias.p)} chance it is higher${bias.by ? ` by ${dShort(bias.by)}` : ''}, base ${bias.base == null ? 'n/a' : pc(bias.base)})`);
  let s = `This week: ${parts[0] || 'no read yet'}.`;
  s += event ? ` ${event.country ? event.country + ' ' : ''}${event.title} (${event.when}) is the event that matters most.` : ' No major release is scheduled this week.';
  if (levels && (levels.above || levels.below)) {
    // the levels come from daily closes: say which close, say so when it is old, and never call a level price has already
    // crossed a level "above" or "below" without saying it broke
    const f = levels.fresh, close = f ? `${dShort(f.asOf)} close` : 'last close', br = levels.broken;
    const tag = (l) => (!l.crossed ? '' : br && br.price === l.price ? ' (that level, broken since the close)' : ' (broken since the close)');
    if (br) s += ` Gold has traded ${br.side === 'below' ? 'below' : 'above'} ${usd(br.price)} (${br.label.toLowerCase()}) since the ${close} and is near ${usd(levels.mark.px)}.`;
    s += ` Watch ${[levels.above && `${usd(levels.above.price)} above${tag(levels.above)}`, levels.below && `${usd(levels.below.price)} below${tag(levels.below)}`].filter(Boolean).join(' and ')}`;
    s += f && f.stale ? `. Levels are stale: last close ${dShort(f.asOf)}, ${f.sessions} trading day${f.sessions === 1 ? '' : 's'} ago.` : f ? ` (levels as of the ${close}).` : '.';
  }
  return { sentence: s, bias, event, levels, calibration: v.calibration ? { status: v.calibration.status, line: v.calibration.line, k: v.calibration.k } : null, publicOnly: true };
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
