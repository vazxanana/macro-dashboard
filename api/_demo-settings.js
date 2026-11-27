// The owner's demo-account settings (27 Nov 2026, owner: "In my profile make me available to manage the demo account settings
// risk, assign strategies etc"). Pure: no network, no storage. Used by api/demo-settings.js (the Profile card's endpoint) and by
// the council (council/owner-config.mjs), so the page, the server and the council read the same rules.
//
// The stored file (council-data owner/demo-settings.json) is the owner's choices only:
//   { v: 1, at, books: { <book>: { account?, risk?, on? } }, jobs: { <job>: { account?, risk?, on?, ujRisk? } } }
// A field left out keeps what the council has today (ctrader-accounts.json, config.json, the mirror's LIMITS.risk).
//   book  = one strategy the demo mirror copies (council/ctrader-mirror.mjs BOOKS); account = the demo account it is copied to,
//           risk = share of the balance a trade, on = false: no NEW copy of it opens (copies already open run to their own exits
//           with their stops, and the account still manages them)
//   job   = a demo program that trades a rule by itself (the breakouts, gotobi, the Nasdaq leads, the DOM zone jobs)
// Demo only: none of this reaches the live account (council/live.mjs and the jobs' --live mode never read it), and the mirror
// and the jobs still refuse any account whose isLive is true. Every trade keeps its stop: nothing here can remove or move one.
'use strict';

// the mirror's books, in the order the Profile lists them; riskKey = the LIMITS.risk entry the mirror sizes them with (the
// shadow, LIT and replica streams are sized like the council's own trades), risk = today's value (a test compares with LIMITS.risk)
const BOOKS = {
  council: { label: 'Council live systems', riskKey: 'council', risk: 0.0002 },
  replica: { label: 'Gold replica', riskKey: 'council', risk: 0.0002 },
  shadow: { label: 'Shadow streams (paper)', riskKey: 'council', risk: 0.0002 },
  lit: { label: 'LIT (paper shadow)', riskKey: 'council', risk: 0.0002 },
  ict: { label: 'ICT A-setups', riskKey: 'ict', risk: 0.002 },
  ictnq: { label: 'ICT on the Nasdaq (3 setups)', riskKey: 'ictnq', risk: 0.01 },
  mosha6: { label: 'Mosha 6R barrier', riskKey: 'mosha6', risk: 0.0025 },
  eqx: { label: 'Equinox (Break fade, Big-candle fade, FVG return, Gold breakout)', riskKey: 'eqx', risk: 0.01 },
  bfade: { label: 'Big-candle fade', riskKey: 'bfade', risk: 0.05 },
  boxfade: { label: 'Box fade', riskKey: 'boxfade', risk: 0.02 },
  fvgm: { label: 'FVG return (gold, silver)', riskKey: 'fvgm', risk: 0.01 },
  egd1: { label: 'D1 engulf zone (Nasdaq, EUR/USD, silver)', riskKey: 'egd1', risk: 0.01 },
  litr: { label: 'LIT rule (AUD/USD, USD/CAD)', riskKey: 'litr', risk: 0.01 },
};
// the demo jobs: risk = today's default, max = the most the job itself allows (it clamps to it anyway)
const JOBS = {
  vb: { label: 'Gold and USD/JPY breakouts (Lyriac)', risk: 0.0025, max: 0.01 },
  gotobi: { label: 'Gotobi fade (USD/JPY)', risk: 0.0025, max: 0.01 },
  nq: { label: 'Nasdaq leads l1, l5 and the gold 8-swing break', risk: 0.01, max: 0.01, uj: { label: 'USD/JPY morning breakout', risk: 0.02, max: 0.02 } },
  dom: { label: 'H1 dominant zone (eight markets)', risk: 0.005, max: 0.01 },
  dom4: { label: 'Gold DOM 4R', risk: 0.0025, max: 0.01 },
};
const RISK_MIN = 0.0005, BOOK_MIN = 0.0001, BOOK_MAX = 0.05;   // a job 0.05 % at least (the jobs' own floor), a book 0.01 % (the council's own trades risk 0.02 %), 5 % at most (the Big-candle fade's own figure)
// a demo account: its cTrader account id (5-12 digits), '*' and the last digits of its login (the jobs' and the mirror's
// pickAccount: the ONE demo account on the token whose login ends so), or '' = the base account (CTRADER_ACCOUNT_ID)
const ACCOUNT_RE = /^(\d{5,12}|\*\d{2,8})$/;

function bad(msg) { const e = new Error(msg); e.status = 400; return e; }
function riskOf(v, max, what, min = RISK_MIN) {
  const n = +v; if (!Number.isFinite(n)) throw bad(`${what}: the risk is not a number`);
  if (n < min || n > max) throw bad(`${what}: the risk must be between ${min * 100} % and ${+(max * 100).toFixed(2)} % of the balance a trade`);
  return +n.toFixed(5);
}
function accountOf(v, what) {
  const s = String(v == null ? '' : v).trim(); if (s === '') return '';
  if (!ACCOUNT_RE.test(s)) throw bad(`${what}: an account is its cTrader account number, or * and the last digits of its login`);
  return s;
}
// the owner's input -> the stored shape (only known keys, every value checked); throws a 400 with a sentence on bad input
function clean(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('settings must be an object');
  const out = { v: 1, books: {}, jobs: {} }, B = input.books || {}, J = input.jobs || {};
  if (typeof B !== 'object' || Array.isArray(B) || typeof J !== 'object' || Array.isArray(J)) throw bad('settings must be an object');
  for (const k of Object.keys(B)) {
    if (!Object.prototype.hasOwnProperty.call(BOOKS, k)) throw bad(`unknown strategy: ${String(k).slice(0, 40)}`);
    const x = B[k] || {}, o = {}, name = BOOKS[k].label;
    if (x.account !== undefined) o.account = accountOf(x.account, name);
    if (x.risk !== undefined && x.risk !== null && x.risk !== '') o.risk = riskOf(x.risk, BOOK_MAX, name, BOOK_MIN);
    if (x.on !== undefined) { if (typeof x.on !== 'boolean') throw bad(`${name}: on must be true or false`); o.on = x.on; }
    if (Object.keys(o).length) out.books[k] = o;
  }
  // books that share a risk entry (council, replica, shadow, LIT) must agree on it, since the mirror sizes them as one
  const byKey = {}; for (const [k, o] of Object.entries(out.books)) if (o.risk != null) { const rk = BOOKS[k].riskKey; if (byKey[rk] != null && byKey[rk] !== o.risk) throw bad(`${BOOKS[k].label}: it is sized with the council's trades, so its risk must equal theirs`); byKey[rk] = o.risk; }
  for (const k of Object.keys(J)) {
    if (!Object.prototype.hasOwnProperty.call(JOBS, k)) throw bad(`unknown demo job: ${String(k).slice(0, 40)}`);
    const x = J[k] || {}, o = {}, D = JOBS[k];
    if (x.account !== undefined) o.account = accountOf(x.account, D.label);
    if (x.risk !== undefined && x.risk !== null && x.risk !== '') o.risk = riskOf(x.risk, D.max, D.label);
    if (x.ujRisk !== undefined && x.ujRisk !== null && x.ujRisk !== '') { if (!D.uj) throw bad(`${D.label}: no USD/JPY rule`); o.ujRisk = riskOf(x.ujRisk, D.uj.max, D.uj.label); }
    if (x.on !== undefined) { if (typeof x.on !== 'boolean') throw bad(`${D.label}: on must be true or false`); o.on = x.on; }
    if (Object.keys(o).length) out.jobs[k] = o;
  }
  return out;
}
// config.json with the owner's settings on top, for the council. Only the keys below change; `live` and every other key are
// left exactly as they are. accFile = council/ctrader-accounts.json (its mirrorAccounts and drain). Returns a NEW object:
//   mirrorAccounts  the book -> account map (the file's, config.json's, then the owner's)
//   drain           an account a book moved away from keeps a round (opens nothing, manages its copies until none is left)
//   mirrorRisk      { <LIMITS.risk key>: risk } the mirror applies before its rounds
//   mirrorOff       books that open nothing new
//   vb, gotobi, nq, dom, dom4   the owner's fields over config.json's
function apply(cfg, settings, accFile) {
  const c = { ...(cfg || {}) }, s = settings && typeof settings === 'object' ? settings : {}, F = accFile || {};
  const before = { ...(F.mirrorAccounts || {}), ...(c.mirrorAccounts || {}) }, map = { ...before }, B = s.books || {};
  for (const [k, o] of Object.entries(B)) if (BOOKS[k] && o && o.account !== undefined && (o.account === '' || ACCOUNT_RE.test(String(o.account)))) map[k] = String(o.account);
  c.mirrorAccounts = map;
  const now = new Set(Object.values(map).filter(Boolean)), drain = new Set((Array.isArray(F.drain) ? F.drain : []).concat(Array.isArray(c.drain) ? c.drain : []).map(String));
  for (const a of Object.values(before)) if (a && !now.has(String(a))) drain.add(String(a));
  c.drain = [...drain].filter((a) => !now.has(a));
  const risk = {}; for (const [k, o] of Object.entries(B)) if (BOOKS[k] && o && Number.isFinite(+o.risk) && +o.risk >= BOOK_MIN && +o.risk <= BOOK_MAX) risk[BOOKS[k].riskKey] = +o.risk;
  c.mirrorRisk = risk;
  c.mirrorOff = Object.entries(B).filter(([k, o]) => BOOKS[k] && o && o.on === false).map(([k]) => k);
  for (const [k, o] of Object.entries(s.jobs || {})) {
    if (!JOBS[k] || !o || typeof o !== 'object') continue;
    const j = { ...(c[k] && typeof c[k] === 'object' ? c[k] : {}) };
    if (typeof o.on === 'boolean') j.on = o.on;
    if (o.account !== undefined && (o.account === '' || ACCOUNT_RE.test(String(o.account)))) { if (o.account === '') delete j.account; else j.account = String(o.account); }
    if (Number.isFinite(+o.risk) && o.risk !== '' && o.risk != null) j.risk = Math.min(JOBS[k].max, Math.max(RISK_MIN, +o.risk));
    if (JOBS[k].uj && Number.isFinite(+o.ujRisk) && o.ujRisk !== '' && o.ujRisk != null) j.ujRisk = Math.min(JOBS[k].uj.max, Math.max(RISK_MIN, +o.ujRisk));
    c[k] = j;
  }
  return c;
}

module.exports = { BOOKS, JOBS, RISK_MIN, BOOK_MIN, BOOK_MAX, ACCOUNT_RE, clean, apply, PATH: 'owner/demo-settings.json' };
