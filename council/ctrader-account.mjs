// The owner's cTrader DEMO accounts for the profile view, with no per-user link needed (owner, 7 Nov: "there should be an
// easier way for the cTrader link"). The council loop already holds working demo tokens (the mirror's), so each round this
// reads every account the mirror trades on (balance, equity, floating P&L, open trades, pending orders, 30-day history) and
// writes data/ctrader/account.json (the base account, as before) plus data/ctrader/accounts.json (all of them, each labelled
// with the book it trades: council, ICT, shadows, LIT, replica; owner, 8 Nov: "on the profile it shows all the accounts
// labeled with the edge and the pnl and active trades and history"). READ ONLY: it reuses api/ctrader-link.js's read
// session, whose allowlist has no trading message. Demo only, like the mirror: CTRADER_ENV=demo and each account must report
// isLive:false. Login numbers are not published.
//   node council/ctrader-account.mjs <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { unseal, scrubber, accountsFor, BOOKS } from './ctrader-mirror.mjs';
const require = createRequire(import.meta.url);
const { _t } = require('../api/ctrader-link.js');

export const BOOK_LABEL = { council: 'Council', ict: 'ICT', shadow: 'Shadows', lit: 'LIT', replica: 'Replica' };
export const labelOf = (books) => (books || []).map((b) => BOOK_LABEL[b] || b).join(' + ');
const mask = (s) => (s ? '…' + String(s).slice(-3) : null);

// one snapshot per account the mirror trades on (accountsFor: council/ctrader-accounts.json, config.json, env), the base
// account first; an account the token cannot see or a live one gets an error entry and no data
export async function accountSnapshots({ env, tokens = null, cfg = null, WS = globalThis.WebSocket, now = Date.now(), lib = _t }) {
  const need = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'];
  if (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on' || need.some((k) => !String(env[k] || '').trim()) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') return null;
  let accessToken = String(env.CTRADER_ACCESS_TOKEN).trim();
  try { const t = tokens && unseal(tokens, env); if (t && t.accessToken) accessToken = t.accessToken; } catch (e) {}
  const accounts = await lib.readAccounts(WS, accessToken, env);
  const env2 = { ...env, CTRADER_CLIENT_ID: String(env.CTRADER_CLIENT_ID).trim(), CTRADER_CLIENT_SECRET: String(env.CTRADER_CLIENT_SECRET).trim() };
  const base = String(env.CTRADER_ACCOUNT_ID).trim(), { groups } = accountsFor(env, cfg);
  const order = [...groups].sort((a, b) => (a.account === base ? -1 : b.account === base ? 1 : BOOKS.indexOf(a.books[0]) - BOOKS.indexOf(b.books[0])));
  const out = [];
  for (const g of order) {
    const head = { books: g.books, label: labelOf(g.books), base: g.account === base, at: new Date(now).toISOString() };
    const acc = accounts.find((a) => a.id === g.account) || accounts.find((a) => a.login === g.account);
    if (!acc) { out.push({ ...head, error: 'account not found for this token' }); continue; }
    if (acc.live) { out.push({ ...head, error: 'refused: not a demo account' }); continue; }
    try {
      const d = await lib.readAccount(env2, WS, accessToken, acc, { days: 30, now });
      out.push({ ...d, ...head, at: d.at || head.at, source: 'council', account: { ...d.account, id: mask(d.account.id), login: mask(d.account.login) }, accounts: undefined });
    } catch (e) { out.push({ ...head, error: String(e && e.message || e).slice(0, 160) }); }
  }
  return out;
}

// the base account alone (the shape ctrader/account.json has had since 7 Nov)
export async function accountSnapshot(opts) {
  const all = await accountSnapshots(opts);
  if (!all) return null;
  const b = all.find((a) => a.base) || all[0];
  return b || { error: 'account not found for this token', at: new Date(opts.now || Date.now()).toISOString() };
}

if (process.argv[1] && process.argv[1].endsWith('ctrader-account.mjs')) {
  const D = process.argv[2] || 'data', CD = path.join(D, 'ctrader');
  let tokens = null; try { tokens = JSON.parse(fs.readFileSync(path.join(CD, 'tokens.json'), 'utf8')); } catch (e) {}
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(D, 'config.json'), 'utf8')); } catch (e) {}
  let accFile = {}; try { accFile = JSON.parse(fs.readFileSync(new URL('./ctrader-accounts.json', import.meta.url), 'utf8')); } catch (e) {}
  const scrub = scrubber(process.env);
  try {
    const all = await accountSnapshots({ env: process.env, tokens, cfg: { mirrorAccounts: { ...(accFile.mirrorAccounts || {}), ...(cfg.mirrorAccounts || {}) } } });
    if (!all) process.exit(0);
    fs.mkdirSync(CD, { recursive: true });
    const snap = all.find((a) => a.base) || all[0];
    // write only when something changed (balance, positions, orders, history): the loop checks every minute between rounds and
    // must not commit a new file just because the timestamp moved
    const sig1 = (o) => JSON.stringify({ ...(o || {}), at: undefined, open: (o && o.open || []).map((p) => ({ ...p, pnl: p.pnl == null ? null : Math.round(p.pnl) })), floating: o && o.floating == null ? null : Math.round(o.floating), equity: o && o.equity == null ? null : Math.round(o.equity) });
    const sig = (o) => (Array.isArray(o) ? o.map(sig1).join('|') : sig1(o));
    let prev = null; try { prev = JSON.parse(fs.readFileSync(path.join(CD, 'accounts.json'), 'utf8')).accounts; } catch (e) {}
    if (prev && sig(prev) === sig(all)) { console.log('cTrader account: no change'); process.exit(0); }
    fs.writeFileSync(path.join(CD, 'account.json'), JSON.stringify(snap, null, 1));
    fs.writeFileSync(path.join(CD, 'accounts.json'), JSON.stringify({ at: new Date().toISOString(), accounts: all }, null, 1));
    console.log(`cTrader accounts: ${all.map((a) => `${a.label}: ${a.error || `balance ${a.balance} · ${a.open.length} open · ${a.history.length} closed in 30 days`}`).join(' | ')}`);
  } catch (e) { console.log(`cTrader account failed: ${scrub(e.message || e)}`); }
}
