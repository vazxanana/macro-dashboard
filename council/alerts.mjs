// Phone alerts for the council Trader (paper only): which events alert, the message text, and the ntfy / Telegram sends.
// Split out of trader.mjs (7 Nov) so the formatting can be tested on real trades (council/alerts-test.mjs) without a network.
import { FUT, ticket, closeTicket } from './futures.mjs';

export const DASH = 'https://vazxanana.github.io/macro-dashboard/market-structure.html#council';
export const NTFY_DEFAULT = 'mosha-council-d200fdc484';
const tvUrl = (fut, code) => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(fut.ex + ':' + code)}`;
const fmt = (v, d) => (+v).toFixed(d != null ? d : 2), fR = (v) => `${v > 0 ? '+' : ''}${(+v).toFixed(2)}R`;

// the trades that may alert: live trades (never shadows) and the NQ open-run paper trades, except the variants the live
// rule skips (session '...-x', e.g. 'nyflip-x': recorded only to measure a filter, so they must not send a futures ticket)
export const alertable = (trades, research) => trades.filter((x) => !x.shadow)
  .concat(research.filter((x) => x.k === 'nq-open' && !/-x$/.test(x.session || '')));

// "Sat 7 Nov 17:23 UTC · London 17:23 · New York 12:23"
const hm = (tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const HM_LDN = hm('Europe/London'), HM_NY = hm('America/New_York'), HM_UTC = hm('UTC');
const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
export function when(t) { const d = new Date(t * 1000); return `${DAY.format(d)} ${HM_UTC.format(d)} UTC · London ${HM_LDN.format(d)} · New York ${HM_NY.format(d)}`; }

// systems with no fixed take-profit (2R mark then a trail, trend legs, pyramid adds whose t1 is a far placeholder)
const noTarget = (x) => x.tp1 != null || x.k === 'trend' || /^gtrend/.test(x.k || '') || (x.rr != null && x.rr >= 99);
// the council's own levels in the market's decimals, with the reward:risk to a fixed target
export function levels(x) {
  const d = x.dec, risk = Math.abs(x.entry - x.stop);
  const tgt = x.k === 'trend' ? 'exit on a daily close under the channel midpoint' : x.tp1 != null ? `2R mark ${fmt(x.tp1, d)}, then trailing` : noTarget(x) ? 'no fixed target' : `target ${fmt(x.t1, d)}`;
  const rr = !noTarget(x) && x.t1 != null && risk > 0 ? ` · R:R 1:${(Math.abs(x.t1 - x.entry) / risk).toFixed(2)}` : '';
  return `Entry ${fmt(x.entry, d)} · stop ${fmt(x.stop, d)} · ${tgt}${rr}${x.size && x.size !== 1 ? ` · ${x.size}× size` : ''}`;
}

// The events for this round. Each sets a flag on the trade (ntfyP / ntfyX / ntfyO / ntfyC) that is saved with it, so it
// is sent once; and only recent events are sent (15 min; 6 h for the close / cancel of a futures ticket the owner may be
// holding), so a restart or an outage never floods the phone with old trades. A bad trade record never stops the others.
export function alertEvents(list, now, futOpt = {}) {
  const ev = [], errors = [], at = when(now);
  for (const x of list) {
    try {
      const nm = `${x.label} ${x.k === 'nq-open' ? x.name + ' (paper)' : x.name}`, fut = FUT[x.market], side = String(x.side || '').toUpperCase();
      const lv = `Council levels${x.market === 'xau' ? ' (spot)' : ''}: ${levels(x)}`, held = x.futT ? 6 * 3600 : 900;
      const up = x.side === 'sell' ? 'chart_with_downwards_trend' : 'chart_with_upwards_trend';
      // a resting limit order: send the limit ticket when it is placed, and a cancel when it ends unfilled (expired, or
      // the target was reached first: 'missed')
      if (fut && !x.ntfyP && x.status === 'pending' && x.opened >= now - 900) { const tk = ticket(x, now, futOpt); x.ntfyP = 1;
        if (tk) { x.futT = { code: tk.c.code, n: tk.n }; ev.push({ title: `${side} LIMIT ${nm}`, msg: `${tk.text}\n${lv}\n${at}`, tags: 'hourglass', click: tk.url }); } }
      if (fut && x.futT && !x.ntfyX && (x.status === 'expired' || x.status === 'missed') && x.closed >= now - held) { x.ntfyX = 1;
        ev.push({ title: `Cancel ${x.futT.code} limit · ${nm}`, msg: `The council's limit order ${x.status === 'missed' ? 'was not filled before the target was reached' : 'expired unfilled'}: cancel your ${x.side} limit on ${x.futT.code}.\n${at}`, tags: 'no_entry_sign', click: tvUrl(fut, x.futT.code) }); }
      if (!x.ntfyO && x.status === 'open' && x.filled >= now - 900) { x.ntfyO = 1;
        if (fut) { const tk = x.futT ? null : ticket(x, now, futOpt);
          if (tk) { x.futT = { code: tk.c.code, n: tk.n }; ev.push({ title: `${side} ${tk.n} ${tk.c.code} · ${nm}`, msg: `${tk.text}\n${lv}\n${at}`, tags: up, click: tk.url }); continue; }
          if (x.futT) { ev.push({ title: `Limit filled · ${nm}`, msg: `Your ${x.side} limit on ${x.futT.code} should be filled (${x.futT.n} contract${x.futT.n === 1 ? '' : 's'}). If it is not, skip it: don't chase.\n${lv}\n${at}`, tags: 'white_check_mark', click: tvUrl(fut, x.futT.code) }); continue; } }
        ev.push({ title: `${side} ${nm}`, msg: `${levels(x)}\n${at}`, tags: up }); }
      if (!x.ntfyC && x.R != null && x.closed && x.closed >= now - held && ['win', 'loss', 'be'].includes(x.status)) { x.ntfyC = 1; const ct = fut && x.futT ? closeTicket(x, now, x.futT) : null;
        ev.push({ title: `${x.status === 'win' ? 'Win' : x.status === 'loss' ? 'Loss' : 'Break-even'} ${fR(x.R)} · ${nm}`, msg: `${ct ? ct.text + ' (if your stop / target has not already done it)\n' : ''}${side} from ${fmt(x.entry, x.dec)}${x.exit ? ` · ${x.exit}` : ''}\n${at}`, tags: x.R > 0 ? 'white_check_mark' : x.R < 0 ? 'x' : 'heavy_minus_sign', click: ct ? ct.url : null }); }
    } catch (err) { errors.push(`${x && x.id}: ${err.message || err}`); }
  }
  return { ev, errors };
}

// Sends the events (at most 8 a round) to Telegram (plain text: no parse_mode, so nothing needs escaping) and to ntfy.
// ntfy gets JSON, not headers: header values go out as Latin-1 (a '·' arrived as a broken byte) and a character above
// U+00FF made fetch throw, losing the alert. Failures are returned, never thrown.
export async function sendAlerts(ev, { topic, tgTok, tgChat, fetchFn = fetch } = {}) {
  const errors = {};
  if (tgTok && tgChat) for (const e of ev.slice(0, 8)) {
    try { const r = await fetchFn(`https://api.telegram.org/bot${tgTok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ chat_id: tgChat, text: `${e.title}\n${e.msg}\n${e.click || DASH}`, disable_web_page_preview: true }) });
      if (!r.ok) errors.telegram = `HTTP ${r.status}`; }
    catch (err) { errors.telegram = String(err.message || err).replaceAll(String(tgTok), '***'); }
  }
  if (topic) for (const e of ev.slice(0, 8)) {
    if (!e.tags) continue;   // the Telegram-only 'connected' note
    try { const r = await fetchFn('https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ topic, title: e.title, message: e.msg, tags: e.tags.split(','), click: e.click || DASH, ...(e.click ? { actions: [{ action: 'view', label: 'Dashboard', url: DASH }] } : {}) }) });
      if (!r.ok) errors.ntfy = `HTTP ${r.status}`; }
    catch (err) { errors.ntfy = String(err.message || err); }
  }
  return errors;
}

// Coach proposal digest (7 Nov): ONE phone message when the set of Coach proposals (council/proposals.mjs, coach.json
// `proposals`) changes, and a reminder at most once a day while it stays the same and is not empty. Suggestions only:
// nothing is applied, the owner OKs them on the site. The last digest sent is kept in coach.json `proposalsSent`
// ({ key, at, items }), so a restart never resends. A stability line counts only when it is flagged (a losing half).
export const SITE = 'https://meridianx.dev/';
const fRm = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(+v).toFixed(2)}R`, cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
export const actionable = (p) => !!p && !!p.setup && (['skipMarket', 'skipSession', 'promote', 'promoteIf', 'demote', 'dataSource', 'ictFilter'].includes(p.kind) || (p.kind === 'stability' && !!p.flag));
const halvesTxt = (p) => p.h1 && p.h2 ? `halves ${fRm(p.h1.exp)} / ${fRm(p.h2.exp)}` : '';
export function proposalLine(p) {
  const S = cap(p.setup), over = `${fRm(p.exp)} over ${p.n} replay trades`;
  if (p.kind === 'stability') return `${S} edge unstable — ${halvesTxt(p)}`;
  if (p.kind === 'dataSource') return `${cap(p.label)} — live ${fRm(p.liveR / p.n)} vs spot ${fRm(p.spotR / p.n)} a trade over ${p.n} trades`;
  if (p.kind === 'skipMarket' || p.kind === 'skipSession') return `${p.label} for ${S} — ${over}`;
  if (p.kind === 'ictFilter') return `${p.label} — the ${p.n} dropped trades made ${fRm(p.exp)} each (t ${p.t}) · ${halvesTxt(p)}`;
  return `${p.label || p.kind + ' ' + p.setup} — ${over}${p.h1 && p.h2 ? ' · ' + halvesTxt(p) : ''}`;
}
export function proposalsKey(proposals) {
  return (Array.isArray(proposals) ? proposals : []).filter(actionable).map((p) => `${p.setup}:${p.kind}:${p.value}`).sort().join('|');
}
// The digest to send now ({ ev, mark }), or null. `sent` is coach.json proposalsSent; `now` is unix seconds. Save `mark`
// as proposalsSent once the send went out.
export function proposalDigest(proposals, sent, now, { remindEvery = 86400 } = {}) {
  const P = (Array.isArray(proposals) ? proposals : []).filter(actionable), key = proposalsKey(P), items = P.map(proposalLine);
  const prev = sent && typeof sent === 'object' && typeof sent.key === 'string' ? sent : null, last = prev ? Date.parse(prev.at) / 1000 : NaN;
  if (prev && prev.key === key && (!key || (isFinite(last) && now - last < remindEvery))) return null;   // same set: a daily reminder only
  if (!key && !prev) return null;                                                                       // nothing suggested, nothing sent before
  const mark = { key, at: new Date(now * 1000).toISOString(), items };
  if (!key) return { mark, ev: { title: 'Coach suggestions withdrawn', msg: `The Coach no longer suggests: ${(prev.items || []).join('; ') || prev.key}.\nNothing to OK on the site.\n${when(now)}`, tags: 'heavy_minus_sign', click: SITE } };
  const again = !!prev && prev.key === key;
  return { mark, ev: { title: `Coach suggests (needs your OK on the site)${again ? ' · reminder' : ''}`,
    msg: `${items.map((s) => '• ' + s).join('\n')}\nOpen meridianx.dev → Council → Systems. Nothing changes until you OK it (paper only).\n${when(now)}`, tags: 'bulb', click: SITE } };
}

// Edge-decay change alert (8 Nov, council/decay.mjs): one message when the set of LIVE systems the monitor marks 'decaying'
// changes (a system turns decaying, or all of them recover), marked in coach.json decaySent so a restart never resends. The
// daily digest keeps naming a decaying system; this is the same-round ping. Status only: nothing here changes a rule.
export function decayKey(decay) {
  return ((decay && Array.isArray(decay.systems)) ? decay.systems : []).filter((s) => s.live && s.status === 'decaying').map((s) => s.id).sort().join('|');
}
export function decayDigest(decay, sent, now) {
  if (!decay || !Array.isArray(decay.systems)) return null;
  const key = decayKey(decay), prev = sent && typeof sent === 'object' && typeof sent.key === 'string' ? sent : null;
  if (prev ? prev.key === key : !key) return null;   // no change (and nothing to say on the first run while all is healthy)
  const D = decay.systems.filter((s) => s.live && s.status === 'decaying'), W = decay.systems.filter((s) => s.live && s.status === 'watch');
  const mark = { key, at: new Date(now * 1000).toISOString(), items: D.map((s) => s.name) };
  const line = (s) => `• ${s.name}: ${(s.why || []).slice(0, 2).join('; ') || 'past its limit'}`;
  if (!D.length) return { mark, ev: { title: 'Edge decay cleared', msg: `Back to healthy: ${(prev.items || []).join(', ') || prev.key}.\nNothing changed; status only.\n${when(now)}`, tags: 'white_check_mark', click: SITE } };
  const fresh = D.filter((s) => !(prev && (prev.items || []).includes(s.name)));
  return { mark, ev: { title: `Edge decay: ${(fresh.length ? fresh : D).map((s) => s.name).join(', ')}`,
    msg: `${D.map(line).join('\n')}${W.length ? `\nOn watch: ${W.map((s) => s.name).join(', ')}` : ''}\nStatus only: no rule changed, your call (Council → Research on the site).\n${when(now)}`, tags: 'chart_with_downwards_trend', click: SITE } };
}
