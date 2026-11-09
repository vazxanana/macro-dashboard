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

export const LEAN_PTS = 0.03;   // the bias reads supportive / against only 3+ points away from the base rate
export const KEEP_WEEKS = 26;
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
export function watchLevels(v) {
  const g = v && v.briefing && v.briefing.levels && v.briefing.levels.gold; if (!g) return null;
  const pick = (side) => { const l = nearestLevel(g, side); return l ? { price: l.price, label: l.label, dist: l.dist } : null; };
  return { px: g.px, asOf: g.asOf, above: pick('above'), below: pick('below') };
}
export function summary(v) {
  if (!v) return null;
  const bias = biasOf(v), event = eventOf(v), levels = watchLevels(v), parts = [];
  if (bias) parts.push(`${bias.lean === 'supportive' ? 'the macro leans supportive for gold' : bias.lean === 'against' ? 'the macro leans against gold' : 'no macro edge for gold, neutral'} (${pc(bias.p)} chance it is higher${bias.by ? ` by ${dShort(bias.by)}` : ''}, base ${bias.base == null ? 'n/a' : pc(bias.base)})`);
  let s = `This week: ${parts[0] || 'no read yet'}.`;
  s += event ? ` ${event.country ? event.country + ' ' : ''}${event.title} (${event.when}) is the event that matters most.` : ' No major release is scheduled this week.';
  if (levels && (levels.above || levels.below)) s += ` Watch ${[levels.above && `${usd(levels.above.price)} above`, levels.below && `${usd(levels.below.price)} below`].filter(Boolean).join(' and ')}.`;
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
