// Daily owner digest (8 Nov 2026, owner: "I get too many separate alerts"): ONE phone message a day after the US close
// (from 21:15 UTC, Monday to Friday, not on a CME full-closure holiday) and a Sunday-evening preview before the open (from
// 21:15 UTC on Sunday, covering the past 7 days). Run by the council loop every round; outside the window, or once today's
// digest went out, it does nothing.
//
// What it says (about 13 lines, plain words):
//   1. today's closed paper trades, gross R and after costs: Meridian live (trades.json Rnet, council/fills.mjs) and the ICT
//      desk's A-setups (ict/trades.json; costs = the CME micro round trip of research/portfolio.mjs), plus the cTrader demo
//      account's balance and day P&L (ctrader/account.json, the day's start balance from ctrader/mirror.json)
//   2. open positions and their floating R (prices from snapshot.json and ict/snapshot.json)
//   3. the macro regime and the next day's event playbook headline (macro/forecast.json)
//   4. what waits on the owner: Coach proposals (coach.json), data-feed problems (health.json), robustness verdict changes
//      (research/robustness.json, against the last digest), and a live system the edge-decay monitor calls 'decaying'
//      (coach.json decay, council/decay.mjs; one line, only when there is one), and a live system whose forward record left
//      the band the untouched-data study gives it (coach.json expect, council/expect.mjs; one line, only when there is one)
//   5. edge scoreboard movers: streams whose verdict changed since the last digest (the scoreboard's own pure functions,
//      script#ms-sb-js of market-structure.html, run here without a page)
//   6. Sundays only: one line of the book-weights paper comparison (coach.json book, council/book.mjs): live vs proposed R
//   7. research: on the day a study lands (council-data research/ledger.json, council/research-ledger.mjs) one line
//      "New study: <name> — <headline>"; the Sunday preview carries a "Research this week" block (count by verdict, up to three)
//
// Sent through alerts.mjs sendAlerts (ntfy + Telegram, the same env as the other alerts). Deduplicated per UTC day in
// council-data digest.json, so a restart never sends twice; when every channel fails nothing is marked and the next round tries
// again. COUNCIL_ALERTS=off sends nothing and marks nothing.
//
// digest.json is also the council's SHARED VERDICT RECORD (8 Nov, the week report compared verdicts with whatever that browser
// had last seen): every round, in or out of the window, recordVerdicts() writes the robustness verdicts (research/robustness.json
// claims, `robust`) and the edge-decay statuses (coach.json decay, `decay`) it sees now and logs every change in `changes`
// ({ at, kind: 'robust' | 'decay', id, name, from, to }, the last 200), so the page's "This week" pane shows the changes of any
// week from one record. The Trader calls the same function when it rebuilds the decay monitor (every 6 hours), so a reading
// never waits on the digest. File: { at, since, sent: { day, at, kind, title }, sb, robust, decay, changes, last, error? }.
//
//   node council/digest.mjs <council-data dir> [--dry] [--force]
//     --dry    print the digest that would go out now; send nothing, write nothing
//     --force  build and send now, outside the window and even if today's went out (manual test)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { sendAlerts, when, NTFY_DEFAULT, SITE, alertable, actionable, proposalLine } from './alerts.mjs';
import { usHolidays } from './datacheck.mjs';
import { expectLine } from './expect.mjs';
import { forwardLine } from './forward.mjs';
import { researchLines } from './research-ledger.mjs';
import { writeAtomic } from './jsonio.mjs';
import { openRisk } from './fills.mjs';

export const COUNCIL_URL = SITE + 'market-structure.html#council';
export const CFG = {
  at: 21 * 60 + 15,   // UTC minute of the day from which the digest may go out (about an hour after the 16:00 New York close)
  maxLines: 15,       // body lines at most
  maxLinesPreview: 18,   // the Sunday preview may carry the "Research this week" block
  macroStaleH: 12,    // a forecast older than this is labelled with its date
  dataStaleH: 3,      // a data check older than this counts as a problem
  acctStaleH: 2,      // a cTrader account file older than this shows its time
};
// ICT micro-futures round trip in index points (1 tick spread + fees + 1 tick slip each way): research/portfolio.mjs ICT_COST_PTS
export const ICT_COST_PTS = { nq: 1.37, es: 1.0, ym: 5.5, rty: 0.55, gc: 0.42 };

const DONE = new Set(['win', 'loss', 'be']);
const r2 = (v) => Math.round(v * 100) / 100;
const fR = (v) => v == null || !Number.isFinite(+v) ? '–' : `${v > 0.004 ? '+' : v < -0.004 ? '−' : ''}${Math.abs(+v).toFixed(2)}R`;
const money = (v, sign = true) => `${sign ? (v > 0.004 ? '+' : v < -0.004 ? '−' : '') : v < 0 ? '−' : ''}$${Math.abs(+v).toFixed(2)}`;
const trim = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const DAYF = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const HMF = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayLabel = (t) => DAYF.format(new Date(t * 1000));
const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const secs = (s) => { const v = Date.parse(s); return Number.isFinite(v) ? v / 1000 : NaN; };

// ─── when ───
// The digest slot at unix time `now`: { day, kind: 'daily' | 'preview' } or null (Saturday, a CME full-closure holiday, or
// before 21:15 UTC). The window runs to the end of the UTC day, so a loop that was down at 21:15 still sends later that evening.
export function slot(now) {
  const d = new Date(now * 1000), wd = d.getUTCDay(), day = isoDay(now);
  if (d.getUTCHours() * 60 + d.getUTCMinutes() < CFG.at || wd === 6) return null;
  if (wd === 0) return { day, kind: 'preview' };
  if (usHolidays(d.getUTCFullYear()).get(day) === 'closed') return null;
  return { day, kind: 'daily' };
}

// ─── 1. results ───
const closedAt = (x) => x.closed || x.exitAt || null;
// Meridian after costs: the Trader's Rnet; older records without it: R − costR × size; none recorded: the raw R
export const merNet = (x) => Number.isFinite(x.Rnet) ? x.Rnet : Number.isFinite(x.costR) ? x.R - x.costR * (x.size || 1) : x.R;
// ICT after costs: R (already × size) less the micro round trip in R of the signal's initial risk
// 12 Nov 2026 (moved-stop audit): the OPENING risk (fills.mjs openRisk). An NQ open-run record has no r0 and its runner trails
// the stop: |entry - stop| after a move put "floating" in the trailed unit (a stop past the entry gave a huge figure); 0 = unknown
const r0Of = (x) => openRisk(x) || 0;
export const ictNet = (x) => { if (Number.isFinite(x.Rnet)) return x.Rnet; const r0 = r0Of(x), c = ICT_COST_PTS[x.market] || 0;
  return r0 > 0 ? x.R - c / r0 * (x.size || 1) : x.R; };
// closed trades with a close in (from, to]: { n, w, l, R, net }
export function tally(list, from, to, net) {
  const o = { n: 0, w: 0, l: 0, R: 0, net: 0 };
  for (const x of Array.isArray(list) ? list : []) {
    if (!x || !DONE.has(x.status) || !Number.isFinite(+x.R)) continue;
    const t = closedAt(x); if (!(t > from && t <= to)) continue;
    o.n++; if (x.R > 0) o.w++; else if (x.R < 0) o.l++; o.R += +x.R; o.net += +net(x);
  }
  o.R = r2(o.R); o.net = r2(o.net); return o;
}
const tallyTxt = (s) => s.n ? `${fR(s.R)} / ${fR(s.net)} (${s.n}: ${s.w}W ${s.l}L)` : 'no closed trades';
const meridianList = (D) => alertable(Array.isArray(D.trades) ? D.trades : [], Array.isArray(D.research) ? D.research : []);
const ictList = (D) => Array.isArray(D.ictTrades) ? D.ictTrades : [];

// the cTrader demo account: balance and the day's P&L (equity − the mirror's start balance of the UTC day); for the Sunday
// preview, or when the mirror has no start balance for today, closed P&L in the window from the account history + floating
export function ctraderLine(acc, mirror, now, from, kind) {
  if (!acc || !Number.isFinite(+acc.balance)) return 'cTrader demo: no account data yet.';
  const day = mirror && mirror.state && mirror.state.day, eq = Number.isFinite(+acc.equity) ? +acc.equity : +acc.balance;
  let pnl;
  if (kind === 'daily' && day && day.date === isoDay(now) && Number.isFinite(+day.startBalance)) pnl = eq - +day.startBalance;
  else pnl = (Array.isArray(acc.history) ? acc.history : []).filter((h) => { const t = secs(h.closedAt); return t > from && t <= now; })
    .reduce((s, h) => s + (+h.net || 0), 0) + (+acc.floating || 0);
  const open = Array.isArray(acc.open) ? acc.open.length : 0, age = now - secs(acc.at);
  return `cTrader demo: balance ${money(+acc.balance, false)}, ${kind === 'preview' ? 'week' : 'day'} ${money(pnl)}, `
    + (open ? `${open} open (${money(+acc.floating || 0)} floating)` : 'none open') + (age > CFG.acctStaleH * 3600 ? ` (as of ${dayLabel(secs(acc.at))} ${HMF.format(new Date(acc.at))} UTC)` : '');
}

// ─── 2. open positions ───
// floating R = direction × (price − entry) / initial risk × size; null when no price is known
export function openPositions(D) {
  const cp = (mk) => { const a = D.snapshot && D.snapshot.markets && D.snapshot.markets[mk], b = D.ictSnap && D.ictSnap.markets && D.ictSnap.markets[mk];
    return a && +a.price > 0 ? +a.price : b && +b.price > 0 ? +b.price : null; };
  const out = [], add = (x, desk, px) => {
    const r0 = r0Of(x), dir = x.side === 'sell' ? -1 : 1, R = px > 0 && r0 > 0 ? r2(dir * (px - x.entry) / r0 * (x.size || 1)) : null;
    out.push({ desk, name: desk === 'ICT' ? `${x.short || String(x.market).toUpperCase()} ${x.side}` : `${x.label || String(x.market).toUpperCase()} ${x.side}`,
      tag: desk === 'ICT' ? (x.aset ? 'ICT A' : 'ICT') : x.name || x.k, R });
  };
  for (const x of meridianList(D)) if (x && x.status === 'open') add(x, 'Meridian', cp(x.market));
  for (const x of ictList(D)) if (x && x.status === 'open') add(x, 'ICT', D.ictSnap && D.ictSnap.markets && D.ictSnap.markets[x.market] ? +D.ictSnap.markets[x.market].price : null);
  return out;
}
export function openLine(pos) {
  if (!pos.length) return 'Open: none.';
  const known = pos.filter((p) => p.R != null), tot = r2(known.reduce((s, p) => s + p.R, 0));
  const by = pos.slice().sort((a, b) => Math.abs(b.R || 0) - Math.abs(a.R || 0)), shown = by.slice(0, 3);
  return `Open: ${pos.length}, floating ${fR(tot)}: ` + shown.map((p) => `${p.name} ${fR(p.R)} (${p.tag})`).join(', ') + (pos.length > 3 ? ` +${pos.length - 3} more` : '');
}

// ─── 3. macro ───
export function macroLines(fc, now) {
  if (!fc || !fc.regime) return ['Macro: no forecast yet.'];
  const at = secs(fc.at), old = !(now - at <= CFG.macroStaleH * 3600);
  const L = [`Macro: ${trim(fc.regime.label || fc.regime.smile || 'no regime label', 110)}${old && Number.isFinite(at) ? ` (as of ${dayLabel(at)})` : ''}`];
  const tgt = typeof fc.target === 'string' ? fc.target : null, tl = tgt ? DAYF.format(new Date(tgt + 'T12:00:00Z')) : 'Next day';
  const pb = Array.isArray(fc.playbook) ? fc.playbook : [], on = pb.filter((e) => tgt && String(e.at).slice(0, 10) === tgt);
  if (on.length) {
    const e = on[0], m = e.expMovePct || {}, mv = [['gold', 'gold'], ['nq', 'NQ']].filter(([k]) => Number.isFinite(+m[k])).map(([k, n]) => `${n} ±${(+m[k]).toFixed(1)}%`);
    const cp = [e.consensus ? `cons ${e.consensus}` : '', e.previous ? `prev ${e.previous}` : ''].filter(Boolean).join(', ');
    L.push(`${tl}: ${trim(`${e.country || ''} ${e.title}`, 50)} ${String(e.at).slice(11, 16)} UTC${cp ? ` (${cp})` : ''}${mv.length ? ', ' + mv.join(', ') : ''}${on.length > 1 ? ` · +${on.length - 1} more` : ''}`);
  } else {
    const te = fc.targetEvent && typeof fc.targetEvent === 'object' ? fc.targetEvent.title : fc.targetEvent;
    const next = pb.find((e) => String(e.at).slice(0, 10) > (tgt || ''));
    L.push(te ? `${tl}: event day (${trim(te, 60)}), expect bigger moves.`
      : `${tl}: no high-impact event on the calendar${next ? `; next ${DAYF.format(new Date(next.at))} ${trim(`${next.country || ''} ${next.title}`, 40)}` : ''}.`);
  }
  return L;
}

// ─── 4 + 5. what changed, what waits ───
export const VERDICT = { edge: 'Edge', promising: 'Promising', unclear: 'Unclear', losing: 'Losing', few: 'Too few' };
const SRC = [[/-sysreplay$/, 'replay'], [/-replay$/, '30-day replay'], [/-live$/, 'live'], [/-shadow$/, 'shadow']];
const rowName = (r) => { const s = SRC.find(([re]) => re.test(r.id)); return s ? `${r.name} (${s[1]})` : r.name; };
export const verdictMap = (rows) => Object.fromEntries((rows || []).filter((r) => r && r.id && r.v).map((r) => [r.id, r.v]));
// streams whose scoreboard verdict differs from the last digest's (new streams are not movers)
export function movers(rows, prev) {
  if (!prev || typeof prev !== 'object') return [];
  return (rows || []).filter((r) => r && r.id && r.v && prev[r.id] && prev[r.id] !== r.v).map((r) => ({ id: r.id, name: rowName(r), from: prev[r.id], to: r.v }));
}
export const robustMap = (J) => Object.fromEntries((J && Array.isArray(J.claims) ? J.claims : []).filter((c) => c && c.id && c.verdict).map((c) => [c.id, c.verdict]));
export function robustChanges(J, prev) {
  if (!prev || typeof prev !== 'object') return [];
  return (J && Array.isArray(J.claims) ? J.claims : []).filter((c) => c && c.id && c.verdict && prev[c.id] && prev[c.id] !== c.verdict)
    .map((c) => ({ id: c.id, name: c.name || c.id, from: prev[c.id], to: c.verdict }));
}

// ─── the shared verdict record (digest.json robust / decay / changes) ───
export const MAX_CHANGES = 200;
// coach.json decay (council/decay.mjs) → { system id: 'healthy' | 'watch' | 'decaying' } (a system with too few trades reads healthy)
export const decayMap = (decay) => Object.fromEntries((decay && Array.isArray(decay.systems) ? decay.systems : []).filter((s) => s && s.id && s.status).map((s) => [s.id, s.status]));
// the names behind the ids, per kind (a claim and a system can share an id), for the change log: a claim or system that is
// later dropped keeps its name
const nameMap = (L) => Object.fromEntries((Array.isArray(L) ? L : []).filter((x) => x && x.id && x.name).map((x) => [x.id, x.name]));
export const verdictNames = (J, decay) => ({ robust: nameMap(J && J.claims), decay: nameMap(decay && decay.systems) });
// verdicts that differ between two { id: verdict } maps (an id that is new or gone is not a change)
export function diffMap(prev, next) {
  if (!prev || !next || typeof prev !== 'object' || typeof next !== 'object') return [];
  return Object.keys(next).filter((id) => prev[id] && next[id] && prev[id] !== next[id]).map((id) => ({ id, from: prev[id], to: next[id] }));
}
// prev (digest.json as read) + the verdicts seen now → { state (the file to write), changes (logged now), dirty (anything new) }.
// A missing file (map null) keeps the old baseline; the first record of a kind logs nothing (nothing to compare with).
// names: { robust: { id: name }, decay: { id: name } } (verdictNames)
export function snapshot(prev, { robust = null, decay = null, now, names = {} } = {}) {
  const P = prev && typeof prev === 'object' ? prev : {}, at = new Date(now * 1000).toISOString();
  const state = { ...P }, log = Array.isArray(P.changes) ? P.changes.slice() : [], changes = [];
  let dirty = !Array.isArray(P.changes) || !P.since;
  for (const [kind, map] of [['robust', robust], ['decay', decay]]) {
    if (!map || typeof map !== 'object') continue;
    for (const c of diffMap(P[kind], map)) changes.push({ at, kind, id: c.id, name: (names[kind] || {})[c.id] || c.id, from: c.from, to: c.to });
    if (JSON.stringify(P[kind] || null) !== JSON.stringify(map)) { state[kind] = map; dirty = true; }
  }
  if (changes.length) log.push(...changes);
  state.changes = log.length > MAX_CHANGES ? log.slice(-MAX_CHANGES) : log;
  if (!state.since) state.since = at;
  if (dirty) state.at = at;
  return { state, changes, dirty };
}
// changes of one kind logged after `since` (default: the last digest went out), one entry per id: first from → last to;
// a verdict that went away and came back in between is not a change
export function changesSince(prev, kind, since) {
  const at = since || (prev && prev.sent && prev.sent.at) || '', by = new Map();
  for (const c of (prev && Array.isArray(prev.changes) ? prev.changes : []).filter((c) => c && c.kind === kind && c.id && (!at || c.at > at))) {
    const q = by.get(c.id); if (q) q.to = c.to; else by.set(c.id, { id: c.id, name: c.name || c.id, from: c.from, to: c.to });
  }
  return [...by.values()].filter((c) => c.from !== c.to);
}
// Record what the files say now into <dir>/digest.json: robust = research/robustness.json, decay = coach.json `decay` (either may
// be null: nothing read, baseline kept). Writes only when something is new. Returns snapshot()'s result; never throws.
export function recordVerdicts(dir, { robust = null, decay = null, now = Math.floor(Date.now() / 1000), prev } = {}) {
  const file = path.join(dir, 'digest.json');
  if (prev === undefined) { try { prev = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { prev = {}; } }
  const S = snapshot(prev, { robust: robust ? robustMap(robust) : null, decay: decay ? decayMap(decay) : null, now, names: verdictNames(robust, decay) });
  if (S.dirty) { try { fs.mkdirSync(dir, { recursive: true }); writeAtomic(file, JSON.stringify(S.state, null, 1) + '\n'); } catch (e) { S.error = String((e && e.message) || e); } }
  return S;
}
// Edge-decay monitor (coach.json decay, council/decay.mjs): one line naming the LIVE systems whose status is 'decaying', or null.
// Shadow systems (crypto trend since 7 Nov) are left out: the owner already moved them off live.
export function decayLine(decay) {
  const S = (decay && Array.isArray(decay.systems) ? decay.systems : []).filter((s) => s && s.live && s.status === 'decaying');
  if (!S.length) return null;
  const one = (s) => `${s.name} (${[s.roll && s.roll.n ? `last ${s.roll.n} ${fR(s.roll.exp)} a trade` : '', s.cusRef ? `CUSUM ${s.cusRef.s}/${s.cusRef.h}` : '',
    s.dd ? `DD ${(+s.dd.cur).toFixed(1)}R of ${(+s.dd.limit).toFixed(0)}R` : ''].filter(Boolean).join(', ')})`;
  return `Edge decay: ${trim(S.slice(0, 2).map(one).join('; '), 150)}${S.length > 2 ? ` +${S.length - 2} more` : ''}. Status only, no rule changed: your call.`;
}
// Book weights paper comparison (coach.json book, council/book.mjs): one line for the Sunday preview, or null without a record.
// Labelled as a paper comparison with no live change, so it is never read as a result of something that trades.
export function bookLine(book) {
  if (!book || !(book.nTrades > 0) || !book.live || !book.proposed) return null;
  const since = book.from ? DAYF.format(new Date(book.from + 'T12:00:00Z')).replace(/^\w+ /, '') : '';
  return `Book weights (paper comparison, no live change): live ${fR(book.live.R)} vs proposed ${fR(book.proposed.R)}${since ? ` since ${since}` : ''} (${book.nTrades} trades)`
    + ` · max DD ${(+book.live.dd || 0).toFixed(1)} / ${(+book.proposed.dd || 0).toFixed(1)}R` + (Number.isFinite(+book.corr) ? ` · corr ${(+book.corr).toFixed(2)}` : '') + '.';
}
export function waiting(D, now, prev) {
  const out = [], P = (D.coach && Array.isArray(D.coach.proposals) ? D.coach.proposals : []).filter(actionable);
  if (P.length) out.push(`Coach: ${P.length} proposal${P.length > 1 ? 's' : ''} to OK: ${trim(P.slice(0, 2).map((p) => p.label || proposalLine(p)).join('; '), 90)}${P.length > 2 ? ` +${P.length - 2} more` : ''}`);
  const H = D.health, hAt = H ? secs(H.at) : NaN;
  if (!H) out.push('Data feeds: no data check yet.');
  else if (H.status === 'bad' || H.status === 'warn') out.push(`Data feeds ${H.status === 'bad' ? 'bad' : 'shaky'}: ${trim(H.summary, 90)}`);
  else if (!(now - hAt <= CFG.dataStaleH * 3600)) out.push(`Data feeds: last check ${Number.isFinite(hAt) ? `${dayLabel(hAt)} ${HMF.format(new Date(hAt * 1000))} UTC` : 'unknown'}.`);
  // verdict changes since the last digest: from the shared record's log (prev.changes); a record without one (older file) is diffed
  const rc = prev && Array.isArray(prev.changes) ? changesSince(prev, 'robust') : robustChanges(D.robust, prev && prev.robust);
  if (rc.length) out.push(`Robustness: ${trim(rc.slice(0, 2).map((c) => `${c.name} ${c.from} → ${c.to}`).join('; '), 100)}${rc.length > 2 ? ` +${rc.length - 2} more` : ''}`);
  const dl = decayLine(D.coach && D.coach.decay);
  if (dl) out.push(dl);
  // What to expect (coach.json expect, council/expect.mjs): a live system whose forward record left the band the untouched-data study gives it
  const el = expectLine(D.coach && D.coach.expect);
  if (el) out.push(el);
  // Forward tracker (coach.json forward, council/forward.mjs): one line, only when a stop line of the proposed protocol is crossed
  // or an execution check fails; never otherwise
  const fl = forwardLine(D.coach && D.coach.forward);
  if (fl) out.push(fl);
  return out;
}

// ─── the message ───
// D: the council-data files (see readData); prev: digest.json; sbRows: the scoreboard rows (null when they could not be built)
export function buildDigest(D, { now, kind = 'daily', prev = {}, sbRows = null } = {}) {
  const from = now - (kind === 'preview' ? 7 : 1) * 86400;
  const mer = tally(meridianList(D), from, now, merNet);
  const ictAll = ictList(D), ictA = tally(ictAll.filter((x) => x && x.aset), from, now, ictNet), ictEvery = tally(ictAll, from, now, ictNet);
  const L = [`${kind === 'preview' ? 'Past 7 days' : 'Today'}, closed paper trades (gross / after costs):`,
    `Meridian ${tallyTxt(mer)}`,
    `ICT desk A-setups ${tallyTxt(ictA)}${ictEvery.n > ictA.n ? ` · all signals ${fR(ictEvery.R)} (${ictEvery.n})` : ''}`,
    ctraderLine(D.account, D.mirror, now, from, kind),
    openLine(openPositions(D)),
    ...macroLines(D.forecast, now)];
  const W = waiting(D, now, prev);
  if (W.length) L.push('Waiting on you:', ...W.map((s) => '• ' + s)); else L.push('Nothing waiting on you.');
  if (sbRows) {
    const mv = movers(sbRows, prev && prev.sb);
    L.push(!(prev && prev.sb) ? 'Scoreboard: verdicts recorded; movers show from the next digest.'
      : mv.length ? `Scoreboard movers: ${trim(mv.slice(0, 3).map((m) => `${m.name} ${VERDICT[m.from] || m.from} → ${VERDICT[m.to] || m.to}`).join('; '), 140)}${mv.length > 3 ? ` +${mv.length - 3} more` : ''}`
        : 'Scoreboard: no verdict changes.');
  } else L.push('Scoreboard: could not be built this time.');
  if (kind === 'preview') { const bl = bookLine(D.coach && D.coach.book); if (bl) L.push(bl); }   // Sundays only: the book-weights paper comparison
  L.push(...researchLines(D.ledger, now, kind));   // nothing on a day without a new study
  L.push(when(now));
  const max = kind === 'preview' ? CFG.maxLinesPreview : CFG.maxLines;
  const lines = L.length > max ? L.slice(0, max - 1).concat(L.at(-1)) : L;
  const title = `${kind === 'preview' ? 'Week ahead' : 'Daily digest'} · ${dayLabel(now)}: Meridian ${fR(mer.net)} · ICT ${fR(ictA.net)} net`;
  return { title, msg: lines.join('\n'), lines, state: { sb: sbRows ? verdictMap(sbRows) : (prev && prev.sb) || null, robust: D.robust ? robustMap(D.robust) : (prev && prev.robust) || null } };
}

// ─── I/O ───
export function readData(dir) {
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
  return { rd, trades: rd('trades.json'), research: rd('research.json'), ictTrades: rd('ict/trades.json'), snapshot: rd('snapshot.json'), ictSnap: rd('ict/snapshot.json'),
    account: rd('ctrader/account.json'), mirror: rd('ctrader/mirror.json'), forecast: rd('macro/forecast.json'), coach: rd('coach.json'), health: rd('health.json'),
    robust: rd('research/robustness.json'), ledger: rd('research/ledger.json'), state: rd('state.json') };
}
// The edge scoreboard's own pure functions (market-structure.html, script#ms-sb-js), as the scoreboard test runs them
export function loadScoreboard(file = new URL('../market-structure.html', import.meta.url)) {
  const m = fs.readFileSync(file, 'utf8').match(/<script id="ms-sb-js">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('scoreboard script not found');
  const W = {}; vm.runInNewContext(m[1], { window: W }); return W.MS_SB;
}
export function scoreboardRows(D, now, SB = loadScoreboard()) {
  const rd = D.rd || (() => null);
  return SB.build({ trades: D.trades, config: rd('config.json'), coach: D.coach, backtest: rd('backtest.json'), replay: rd('research/replay-2w.json'), snapshot: rd('snapshot.json'), mirror: D.mirror,
    ictReplay: rd('ict/replay.json'), ictTrades: D.ictTrades, ictShadow: rd('ict/shadow.json'), robust: D.robust, macro: D.forecast, now });
}

// One round: { skipped, recorded } or { sent | dry, title, msg, errors }. `scoreboard(D, now)` returns the rows (injectable for tests).
// Every round first records the verdicts it sees (recordVerdicts, the shared record; not on --dry), then sends when in the window.
export async function main(dir, { env = process.env, fetchFn = fetch, now = Math.floor(Date.now() / 1000), dry = false, force = false, scoreboard = scoreboardRows } = {}) {
  const file = path.join(dir, 'digest.json'), rdj = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
  let prev = rdj('digest.json') || {}, recorded = 0;
  if (!dry) { const S = recordVerdicts(dir, { robust: rdj('research/robustness.json'), decay: (rdj('coach.json') || {}).decay, now, prev }); prev = S.state; recorded = S.changes.length; }
  const s = force ? { day: isoDay(now), kind: new Date(now * 1000).getUTCDay() === 0 ? 'preview' : 'daily' } : slot(now);
  if (!s) return { skipped: 'outside the digest window', recorded };
  if (!force && prev.sent && prev.sent.day === s.day) return { skipped: `already sent for ${s.day}`, recorded };
  if (!dry && env.COUNCIL_ALERTS === 'off') return { skipped: 'COUNCIL_ALERTS=off', recorded };
  const D = readData(dir);
  let rows = null, sbError = null;
  try { rows = scoreboard(D, now); if (!Array.isArray(rows)) rows = null; } catch (e) { sbError = String((e && e.message) || e); }
  const d = buildDigest(D, { now, kind: s.kind, prev, sbRows: rows });
  if (dry) return { dry: true, title: d.title, msg: d.msg, lines: d.lines.length, sbError, recorded };
  const topic = env.NTFY_TOPIC || NTFY_DEFAULT, tgTok = env.TELEGRAM_BOT_TOKEN || null, tgChat = env.TELEGRAM_CHAT_ID || (D.state || {}).tgChat || null;
  const tried = 1 + (tgTok && tgChat ? 1 : 0);
  const errors = await sendAlerts([{ title: d.title, msg: d.msg, tags: 'clipboard', click: COUNCIL_URL }], { topic, tgTok, tgChat, fetchFn });
  const failed = Object.keys(errors).length >= tried, at = new Date(now * 1000).toISOString();
  // every channel failed: keep the old mark (and the old verdict baselines) so the next round tries again; the shared record
  // (robust, decay, changes, since) stays in the file either way
  const out = failed ? { ...prev, error: { at, ...errors } }
    : { ...prev, at, sent: { day: s.day, at, kind: s.kind, title: d.title }, sb: d.state.sb, robust: d.state.robust, last: { title: d.title, msg: d.msg }, error: Object.keys(errors).length ? { at, ...errors } : undefined };
  if (out.error === undefined) delete out.error;
  fs.mkdirSync(dir, { recursive: true });
  writeAtomic(file, JSON.stringify(out, null, 1) + '\n');
  return { sent: !failed, title: d.title, msg: d.msg, errors, sbError, recorded };
}

if (process.argv[1] && process.argv[1].endsWith('digest.mjs')) {
  const args = process.argv.slice(2), dir = args.find((a) => !a.startsWith('--')) || 'data';
  main(dir, { dry: args.includes('--dry'), force: args.includes('--force') }).then((r) => {
    if (r.skipped) { console.log(`Digest: ${r.skipped}${r.recorded ? ` (${r.recorded} verdict change${r.recorded > 1 ? 's' : ''} recorded)` : ''}`); return; }
    console.log(`Digest ${r.dry ? '(dry run)' : r.sent ? 'sent' : 'NOT sent'}: ${r.title}\n${r.msg}`);
    if (r.errors && Object.keys(r.errors).length) console.log('  send errors:', JSON.stringify(r.errors));
    if (r.sbError) console.log('  scoreboard:', r.sbError);
  }).catch((e) => { console.log('Digest failed:', (e && e.message) || e); });   // never fails the round
}
