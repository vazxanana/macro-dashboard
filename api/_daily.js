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

// ---- the summary (written by the language model from the report's facts; shown as "Summary", owner 20 Nov 2026: "it needs to act
// like a person writes it") ----
const SYSTEM = 'You are the senior analyst of a small macro desk writing the morning note your colleagues read at 06:30 London before the open. '
  + 'Write like a person, not a machine: first person plural ("we"), short direct sentences, plain words, no filler, no hedging boilerplate, no headings, '
  + 'never mention AI, a model, a report, data files or "the facts". '
  + 'Use ONLY the facts you are given: every number you write must appear in them, written the same way. '
  + 'Give odds only as the facts give them, with their usual rate. '
  + 'Never tell anyone to buy, sell, enter, exit or size a trade; never mention stops; never call anything a proven or tested edge, certain or guaranteed; never state a forecast as fact. '
  + 'Answer with JSON only: {"headline": "one sentence under 110 characters: the one thing that matters today", '
  + '"points": ["3 to 5 bullet points, each one short sentence under 150 characters, the most important first"], '
  + '"world": "the world economy in 2 to 4 sentences, under 600 characters", "markets": "the markets in 2 to 4 sentences, under 600 characters"}';
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
  // optional (older stored summaries have neither): one headline, 3-5 bullet points
  if (typeof j.headline === 'string' && one(j.headline, 160).length >= 12) out.headline = one(j.headline, 160);
  if (Array.isArray(j.points)) { const pts = j.points.filter((x) => typeof x === 'string').map((x) => one(x, 200)).filter((x) => x.length >= 12).slice(0, 5); if (pts.length >= 2) out.points = pts; }
  const texts = [['world', out.world], ['markets', out.markets], ['headline', out.headline || ''], ...(out.points || []).map((x, i) => ['point ' + (i + 1), x])];
  for (const [k, v] of texts) { if (BANNED.test(v) || /\b(AI|language model|the report)\b/.test(v)) return { ok: false, why: `${k}: advice, stops, a claim of certainty or talk of itself` }; }
  const have = new Set(((briefRequest(rep).prompt.match(NUM)) || []).map(norm));
  for (const [k, v] of texts) for (const n of v.match(NUM) || []) { const x = norm(n); if (!have.has(x) && !(+x <= 10 && Number.isInteger(+x))) return { ok: false, why: `${k}: the figure ${n} is not in the report` }; }
  return { ok: true, brief: out };
}

// ---- the email (20 Nov 2026, owner: "more professional … with highlights and bullet points … Summary, not AI summary") ----
const SITE = 'https://aureumdesk.co.uk/', LOGO = SITE + 'icons/email-logo.png', F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const NOTE = 'You get this because the Macro desk is on for your account. Paper trading only: odds come with their usual rate; nothing here is a tested edge or advice.';
const LINES = 4;   // lines a detail section shows in the email; the rest is on the Macro desk
const INK = '#16181b', INK2 = '#454b55', INK3 = '#6b717b', LINE = '#e3e6ea', WELL = '#f4f6f8', UP = '#067a64', DN = '#c8243f';
const secOf = (r, re) => ((r && r.sections) || []).find((s) => re.test(s.h));
// "At a glance": the markets' prices, their normal day and today's odds, read from "Where markets stand" (+ the VIX)
function glance(rep) {
  const out = [], s = secOf(rep.markets, /^Where markets stand/);
  for (const l of (s && s.lines) || []) {
    const m = /^(.+?) ([\d,]+(?:\.\d+)?): (\d+)% chance of closing the day higher \(usual (\d+)%\); a normal day ±([\d.]+)%(?:.*?moving ([\d.]+)x its usual)?/.exec(l);
    if (m) out.push({ name: m[1], px: m[2], p: +m[3], base: +m[4], move: m[5], fast: m[6] || null });
  }
  const v = secOf(rep.markets, /^Risk and rates/), vl = v && (v.lines || []).find((l) => /^VIX /.test(l)), vm = vl && /^VIX ([\d.]+)(?: \(([^)]+)\))?/.exec(vl);
  if (vm) out.push({ name: 'VIX', px: vm[1], note: vm[2] || '' });
  return out.slice(0, 6);
}
// today's calendar: "07:00 · United Kingdom · Retail Sales m/m · expected 0.0%, previous -0.4%"
function agenda(rep) {
  const s = secOf(rep.world, /^Today/);
  return ((s && s.lines) || []).map((l) => { const p = l.split(' · '); return /^\d\d:\d\d$/.test(p[0]) ? { at: p[0], where: p[1] || '', what: p[2] || '', more: p.slice(3).join(' · ') } : null; }).filter(Boolean).slice(0, 8);
}
function emailOf(rep, brief, o = {}) {
  const day = dayLabel(rep), link = SITE + 'macro-desk#s-daily', test = o.test ? 'Test · ' : '';
  const subject = `${test}Morning note · ${day}`;
  const G = glance(rep), A = agenda(rep);
  const lean = (g) => (g.p == null ? '' : g.p > g.base ? 'leans up' : g.p < g.base ? 'leans down' : 'no lean');
  // ---- plain text ----
  const sec = (r) => (r.sections || []).map((s) => `${s.h}\n${(s.lines || []).map((l) => '  • ' + l).join('\n')}`).join('\n\n');
  const sumT = brief ? `SUMMARY\n${brief.headline ? brief.headline + '\n' : ''}${(brief.points || [brief.world, brief.markets]).map((x) => '  • ' + x).join('\n')}\n\n` : '';
  const glT = G.length ? `AT A GLANCE\n${G.map((g) => `  • ${g.name} ${g.px}${g.move ? ` · normal day ±${g.move}% · ${g.p}% up (usual ${g.base}%)` : g.note ? ` (${g.note})` : ''}`).join('\n')}\n\n` : '';
  const agT = A.length ? `ON THE CALENDAR TODAY (London)\n${A.map((e) => `  • ${e.at}  ${e.where}: ${e.what}${e.more ? ' (' + e.more + ')' : ''}`).join('\n')}\n\n` : '';
  const text = `${subject}\n\n${sumT}${glT}${agT}WORLD ECONOMY\n${rep.world.lead}\n\n${sec(rep.world)}\n\nMARKETS\n${rep.markets.lead}\n\n${sec(rep.markets)}\n\nThe full notes on the Macro desk: ${link}\n\nThe Aureum Desk\n\n${NOTE}`;
  // ---- HTML (tables and inline styles only: mail apps) ----
  const label = (t, st = '') => `<p style="margin:0 0 10px;font:700 11px/1.4 ${F};color:${INK3};letter-spacing:.08em;text-transform:uppercase;${st}">${esc(t)}</p>`;
  const bullets = (xs, st = '') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${xs.map((x) => `<tr><td valign="top" width="18" style="padding:0 0 9px;font:700 15px/1.55 ${F};color:${INK}">&bull;</td><td style="padding:0 0 9px;font:15px/1.55 ${F};color:${INK};${st}">${esc(x)}</td></tr>`).join('')}</table>`;
  const summary = brief ? `<tr><td style="padding:0 0 26px">${label('Summary')}`
    + (brief.headline ? `<p style="margin:0 0 14px;font:600 18px/1.45 ${F};color:${INK}">${esc(brief.headline)}</p>` : '')
    + (brief.points ? bullets(brief.points) : `<p style="margin:0 0 10px;font:15px/1.6 ${F};color:${INK}">${esc(brief.world)}</p><p style="margin:0;font:15px/1.6 ${F};color:${INK}">${esc(brief.markets)}</p>`)
    + `</td></tr>` : '';
  const tile = (g) => `<td width="33%" valign="top" style="padding:4px"><div style="background:${WELL};border-radius:10px;padding:12px 12px 11px">`
    + `<div style="font:600 12px/1.3 ${F};color:${INK3}">${esc(g.name)}</div>`
    + `<div style="margin:4px 0 3px;font:700 18px/1.2 ${F};color:${INK}">${esc(g.px)}</div>`
    + (g.move ? `<div style="font:12px/1.4 ${F};color:${INK2}">±${esc(g.move)}% normal day</div><div style="font:600 12px/1.4 ${F};color:${g.p > g.base ? UP : g.p < g.base ? DN : INK3}">${g.p}% up · ${esc(lean(g))}</div>`
      : `<div style="font:600 12px/1.4 ${F};color:${/stress|elevated|high/i.test(g.note) ? DN : INK2}">${esc(g.note || ' ')}</div>`)
    + `</div></td>`;
  const rows = []; for (let i = 0; i < G.length; i += 3) rows.push(`<tr>${G.slice(i, i + 3).map(tile).join('')}${'<td width="33%"></td>'.repeat(Math.max(0, 3 - G.slice(i, i + 3).length))}</tr>`);
  const glH = G.length ? `<tr><td style="padding:0 0 24px">${label('At a glance')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -4px">${rows.join('')}</table>`
    + `<p style="margin:8px 0 0;font:12px/1.5 ${F};color:${INK3}">"% up" is the chance of a higher close today; "leans" compares it with the usual rate.</p></td></tr>` : '';
  const agH = A.length ? `<tr><td style="padding:0 0 26px">${label('On the calendar today · London time')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">`
    + A.map((e) => `<tr><td valign="top" width="62" style="padding:0 0 10px"><span style="display:inline-block;padding:3px 8px;border-radius:6px;background:${INK};font:700 12px/1.4 ${F};color:#ffffff">${esc(e.at)}</span></td>`
      + `<td style="padding:1px 0 10px;font:14px/1.5 ${F};color:${INK}"><b>${esc(e.what)}</b> <span style="color:${INK3}">· ${esc(e.where)}</span>${e.more ? `<br><span style="font-size:13px;color:${INK2}">${esc(e.more)}</span>` : ''}</td></tr>`).join('')
    + `</table></td></tr>` : '';
  const skip = (s) => /^Today/.test(s.h) || /^Where markets stand/.test(s.h);   // shown above already
  const part = (r) => `<tr><td style="padding:22px 0 0;border-top:1px solid ${LINE}">`
    + `<h2 style="margin:0 0 6px;font:700 17px/1.3 ${F};color:${INK}">${esc(r.title)}</h2>`
    + `<p style="margin:0 0 14px;font:15px/1.55 ${F};color:${INK2}">${esc(r.lead)}</p>`
    + (r.sections || []).filter((s) => !skip(s)).map((s) => `<p style="margin:14px 0 6px;font:600 14px/1.4 ${F};color:${INK}">${esc(s.h)}</p>${bullets((s.lines || []).slice(0, LINES), `font-size:14px;color:${INK2}`)}${(s.lines || []).length > LINES ? `<p style="margin:0 0 4px 18px;font:13px/1.5 ${F}"><a href="${link}" style="color:${INK3}">${(s.lines.length - LINES)} more on the Macro desk</a></p>` : ''}`).join('')
    + `</td></tr>`;
  const html = `<!doctype html><html><head><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#eef0f3">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc((brief && brief.headline) || rep.markets.lead)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3"><tr><td align="center" style="padding:28px 10px 36px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">`
    + `<tr><td align="center" style="padding:0 4px 20px"><a href="${SITE}"><img src="${LOGO}" width="195" height="32" alt="Aureum Desk" style="display:block;border:0;width:195px;height:32px;font:700 15px/32px ${F};color:${INK}"></a></td></tr>`
    + `<tr><td style="background:#ffffff;border:1px solid ${LINE};border-top:3px solid ${INK};border-radius:14px;padding:28px 28px 26px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">`
    + `<tr><td style="padding:0 0 22px">${label(test + 'Morning note', 'margin-bottom:6px')}<h1 style="margin:0;font:700 24px/1.25 ${F};color:${INK}">${esc(day)}</h1>`
    + `<p style="margin:6px 0 0;font:14px/1.4 ${F};color:${INK3}">06:30 London · world economy and markets</p></td></tr>`
    + summary + glH + agH + part(rep.world) + part(rep.markets)
    + `<tr><td style="padding:24px 0 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${INK}"><a href="${link}" style="display:inline-block;padding:14px 24px;font:600 15px/1 ${F};color:#ffffff;text-decoration:none;border-radius:10px">Open the Macro desk&nbsp;&nbsp;&rarr;</a></td></tr></table>`
    + `<p style="margin:22px 0 0;font:15px/1.5 ${F};color:${INK}">Have a good session,<br><b>The Aureum Desk</b></p></td></tr>`
    + `</table></td></tr><tr><td style="padding:16px 8px 0;font:12px/1.6 ${F};color:#8a9099">${esc(NOTE)}</td></tr>`
    + `<tr><td align="center" style="padding:14px 4px 0;font:12px/1.6 ${F};color:#8a9099"><a href="${SITE}" style="color:#8a9099;text-decoration:none">Aureum Desk</a> &middot; aureumdesk.co.uk</td></tr>`
    + `</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

module.exports = { recipients, briefRequest, parseBrief, emailOf, glance, agenda, MAX_TO, SYSTEM, mail };
