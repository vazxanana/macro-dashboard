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
