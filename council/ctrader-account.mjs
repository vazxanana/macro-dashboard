// The owner's cTrader DEMO account for the profile view, with no per-user link needed (owner, 7 Nov: "there should be an
// easier way for the cTrader link"). The council loop already holds working demo tokens (the mirror's), so each round this
// reads the account (balance, equity, floating P&L, open trades, pending orders, 30-day history) and writes
// data/ctrader/account.json. READ ONLY: it reuses api/ctrader-link.js's read session, whose allowlist has no trading message.
// Demo only, like the mirror: CTRADER_ENV=demo and the account must report isLive:false. Login numbers are not published.
//   node council/ctrader-account.mjs <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { unseal, scrubber } from './ctrader-mirror.mjs';
const require = createRequire(import.meta.url);
const { _t } = require('../api/ctrader-link.js');

export async function accountSnapshot({ env, tokens = null, WS = globalThis.WebSocket, now = Date.now(), lib = _t }) {
  const need = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'];
  if (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on' || need.some((k) => !String(env[k] || '').trim()) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') return null;
  let accessToken = String(env.CTRADER_ACCESS_TOKEN).trim();
  try { const t = tokens && unseal(tokens, env); if (t && t.accessToken) accessToken = t.accessToken; } catch (e) {}
  const id = String(env.CTRADER_ACCOUNT_ID).trim(), accounts = await lib.readAccounts(WS, accessToken, env);
  const acc = accounts.find((a) => a.id === id) || accounts.find((a) => a.login === id);
  if (!acc) return { error: 'account not found for this token', at: new Date(now).toISOString() };
  if (acc.live) return { error: 'refused: not a demo account', at: new Date(now).toISOString() };
  const env2 = { ...env, CTRADER_CLIENT_ID: String(env.CTRADER_CLIENT_ID).trim(), CTRADER_CLIENT_SECRET: String(env.CTRADER_CLIENT_SECRET).trim() };
  const d = await lib.readAccount(env2, WS, accessToken, acc, { days: 30, now });
  const mask = (s) => (s ? '…' + String(s).slice(-3) : null);
  return { ...d, source: 'council', account: { ...d.account, id: mask(d.account.id), login: mask(d.account.login) }, accounts: undefined };
}

if (process.argv[1] && process.argv[1].endsWith('ctrader-account.mjs')) {
  const CD = path.join(process.argv[2] || 'data', 'ctrader');
  let tokens = null; try { tokens = JSON.parse(fs.readFileSync(path.join(CD, 'tokens.json'), 'utf8')); } catch (e) {}
  const scrub = scrubber(process.env);
  try {
    const snap = await accountSnapshot({ env: process.env, tokens });
    if (!snap) process.exit(0);
    fs.mkdirSync(CD, { recursive: true });
    fs.writeFileSync(path.join(CD, 'account.json'), JSON.stringify(snap, null, 1));
    console.log(`cTrader account: ${snap.error || `balance ${snap.balance} · ${snap.open.length} open · ${snap.history.length} closed in 30 days`}`);
  } catch (e) { console.log(`cTrader account failed: ${scrub(e.message || e)}`); }
}
