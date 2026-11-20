// The daily reports' delivery pieces (19 Nov 2026, owner: "add the 6:30 email too"; "use AI to do the daily brief").
// Pure: no network, no store. Used by api/daily.js.
//   recipients(users, ownerEmail)  → the addresses of the owner and every stored member with an email and the macro permission
//   briefRequest(rep) / parseBrief(text, rep)  → the language model's short morning summary, written from the report's own facts
//   emailOf(rep, brief, o)  → { subject, text, html } of the morning email
const U = require('./users.js');

const MAX_TO = 60;
const one = (s, n = 400) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mail = (v) => { const e = String(v == null ? '' : v).trim().toLowerCase(); return e.length <= 254 && U.EMAIL_RE.test(e) ? e : null; };

// macro is on for the owner and for every member unless their record says perms.macro === false (the role defaults give it to all)
function recipients(users, ownerEmail) {
  const out = [], seen = new Set(), add = (e) => { const m = mail(e); if (m && !seen.has(m) && out.length < MAX_TO) { seen.add(m); out.push(m); } };
  add(ownerEmail);
  for (const R of Object.values(users || {})) { if (!R || R.disabled || !R.email) continue; if (R.perms && R.perms.macro === false) continue; add(R.email); }
  return out;
}

const dayLabel = (rep) => new Date(Date.parse(rep.publishAt)).toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' });
const facts = (r) => [r.title + ': ' + r.lead, ...(r.sections || []).flatMap((s) => [s.h + ':', ...(s.lines || []).map((l) => '- ' + l)])].join('\n');

// ---- the language model's summary ----
const SYSTEM = 'You write the two short morning summaries of a paper-trading macro desk, one about the world economy and one about the markets. '
  + 'Use ONLY the facts you are given: every number you write must appear in them, written the same way. Plain English, calm, for a trader before the open. '
  + 'Say what matters today and why, in 3 to 5 sentences each, under 700 characters each. Give odds only as the facts give them, with their usual rate. '
  + 'Never tell anyone to buy, sell, enter, exit or size a trade; never mention stops; never call anything a proven or tested edge, certain or guaranteed; never state a forecast as fact. '
  + 'Answer with JSON only: {"world": "...", "markets": "..."}';
function briefRequest(rep) {
  return { system: SYSTEM, prompt: `Report for ${dayLabel(rep)} (London).\n\n=== WORLD ECONOMY ===\n${facts(rep.world)}\n\n=== MARKETS ===\n${facts(rep.markets)}` };
}
const NUM = /\d[\d,]*(?:\.\d+)?/g, norm = (x) => x.replace(/,/g, '').replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
const BANNED = /\b(you should|we recommend|i recommend|consider (buying|selling)|go (long|short)|buy now|sell now|stop[- ]?loss|\bstops? (at|below|above|beyond)|guarantee|guaranteed|proven|tested edge|risk[- ]free|certain to|will (rise|fall|rally|drop|climb|decline|go up|go down|break))/i;
// { ok, brief: { world, markets } } or { ok: false, why }
function parseBrief(text, rep) {
  let j = null; const t = String(text || ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
  try { j = JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t); } catch (e) { return { ok: false, why: 'not JSON' }; }
  if (!j || typeof j.world !== 'string' || typeof j.markets !== 'string') return { ok: false, why: 'world and markets are required' };
  const out = { world: one(j.world, 900), markets: one(j.markets, 900) };
  if (out.world.length < 40 || out.markets.length < 40) return { ok: false, why: 'too short' };
  for (const k of ['world', 'markets']) { if (BANNED.test(out[k])) return { ok: false, why: `${k}: advice, stops or a claim of certainty` }; }
  const have = new Set(((briefRequest(rep).prompt.match(NUM)) || []).map(norm));
  for (const k of ['world', 'markets']) for (const n of out[k].match(NUM) || []) { const v = norm(n); if (!have.has(v) && !(+v <= 10 && Number.isInteger(+v))) return { ok: false, why: `${k}: the figure ${n} is not in the report` }; }
  return { ok: true, brief: out };
}

// ---- the email ----
const SITE = 'https://aureumdesk.co.uk/', LOGO = SITE + 'icons/email-logo.png', F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const NOTE = 'You get this because the Macro desk is on for your account. Paper trading only: leans and odds come with their usual rate; nothing here is a tested edge or advice.';
function emailOf(rep, brief, o = {}) {
  const day = dayLabel(rep), link = SITE + 'macro-desk#s-daily', test = o.test ? 'Test · ' : '';
  const subject = `${test}Daily reports · ${day}`;
  const sec = (r) => (r.sections || []).map((s) => `${s.h}\n${(s.lines || []).map((l) => '  - ' + l).join('\n')}`).join('\n\n');
  const ai = brief ? `AI SUMMARY (a language model's reading of the facts below; every figure is checked against the report)\nWorld economy: ${brief.world}\nMarkets: ${brief.markets}\n\n` : '';
  const text = `${subject}\n\n${ai}WORLD ECONOMY\n${rep.world.lead}\n\n${sec(rep.world)}\n\nMARKETS\n${rep.markets.lead}\n\n${sec(rep.markets)}\n\nOpen the Macro desk: ${link}\n\n${NOTE}`;
  const p = (t, st = '') => `<p style="margin:0 0 10px;font:14px/1.6 ${F};color:#454b55;${st}">${esc(t)}</p>`;
  const part = (r) => `<h2 style="margin:24px 0 6px;font:700 18px/1.3 ${F};color:#16181b">${esc(r.title)}</h2>${p(r.lead, 'color:#16181b;font-weight:600;')}`
    + (r.sections || []).map((s) => `<h3 style="margin:14px 0 4px;font:600 14px/1.4 ${F};color:#16181b">${esc(s.h)}</h3><ul style="margin:0 0 6px;padding-left:18px">${(s.lines || []).map((l) => `<li style="margin:0 0 4px;font:14px/1.55 ${F};color:#454b55">${esc(l)}</li>`).join('')}</ul>`).join('');
  const aiBox = brief ? `<div style="margin:0 0 8px;padding:14px 16px;background:#f3f5f8;border-left:3px solid #2f5e9e;border-radius:8px">`
    + `<p style="margin:0 0 8px;font:600 12px/1.4 ${F};color:#2f5e9e;letter-spacing:.04em;text-transform:uppercase">AI summary</p>`
    + p('World economy: ' + brief.world) + p('Markets: ' + brief.markets)
    + `<p style="margin:0;font:12px/1.5 ${F};color:#6b717b">A language model's reading of the facts below; every figure in it is checked against the report.</p></div>` : '';
  const html = `<!doctype html><html><head><meta name="color-scheme" content="light"></head><body style="margin:0;padding:0;background:#eef0f3">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(rep.world.lead)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3"><tr><td align="center" style="padding:32px 12px 36px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">`
    + `<tr><td align="center" style="padding:0 4px 22px"><a href="${SITE}"><img src="${LOGO}" width="195" height="32" alt="Aureum Desk" style="display:block;border:0;width:195px;height:32px;font:700 15px/32px ${F};color:#16181b"></a></td></tr>`
    + `<tr><td style="background:#ffffff;border:1px solid #e3e6ea;border-top:3px solid #16181b;border-radius:14px;padding:30px 32px 26px">`
    + `<h1 style="margin:0 0 18px;font:700 22px/1.3 ${F};color:#16181b">${esc(test + 'Daily reports')}<br><span style="font-weight:500;color:#6b717b;font-size:15px">${esc(day)} · 06:30 London</span></h1>`
    + aiBox + part(rep.world) + part(rep.markets)
    + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td style="border-radius:10px;background:#16181b"><a href="${link}" style="display:inline-block;padding:14px 26px;font:600 15px/1 ${F};color:#ffffff;text-decoration:none;border-radius:10px">Open the Macro desk&nbsp;&nbsp;&rarr;</a></td></tr></table>`
    + `</td></tr><tr><td style="padding:16px 8px 0;font:12px/1.6 ${F};color:#8a9099">${esc(NOTE)}</td></tr>`
    + `<tr><td align="center" style="padding:14px 4px 0;font:12px/1.6 ${F};color:#8a9099"><a href="${SITE}" style="color:#8a9099;text-decoration:none">Aureum Desk</a> &middot; aureumdesk.co.uk</td></tr>`
    + `</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

module.exports = { recipients, briefRequest, parseBrief, emailOf, MAX_TO, SYSTEM, mail };
