// The live account (27 Nov 2026, owner: "Ima set up the live account now, risk 0.5 per trade -15% daily stop"; rules: "All" =
// the Nasdaq leads l1 and l5, the USD/JPY morning breakout, the gold and USD/JPY breakouts of the day, the gold 8-swing break).
// THE ONE EXCEPTION TO ABSOLUTE RULE 2, made by the owner on 27 Nov 2026 and written in CLAUDE.md and docs/owner-decisions.md.
// Everything else stays demo: the mirror, the ICT copies, gotobi, DOM, the Equinox and Mosha books never reach this file.
// Three locks, each alone stops it:
//   1. config.json `live = { on: true, account: '*<last digits of the live login>', risk, dayStop }` (off by default);
//   2. the environment's CTRADER_LIVE = 'on' (a repository variable / secret the owner sets);
//   3. the token's account list holds exactly ONE account whose isLive is true and whose login ends in those digits.
// Risk: `risk` of the balance a trade (0.005 = 0.5 %, at most 1 %); daily stop: no NEW order once the balance is `dayStop` (0.15 =
// 15 %) under the UTC day's first balance seen (live/day.json); open positions keep their own stops and exits. Every order has a stop.
import fs from 'node:fs';
import path from 'node:path';
import { PT, liveSession, unseal } from './ctrader-mirror.mjs';

// goldRisk (owner, 27 Nov 2026: "on gold change risk to 3 %", live account): the gold rules (gold breakout, gold 8-swing break)
// risk their own share, at most maxGold 3 %; every other rule keeps `risk` (at most 1 %)
export const LIVE = { risk: 0.005, maxRisk: 0.01, dayStop: 0.15, maxGold: 0.03 };
export function liveConfig(cfg) {
  const L = (cfg && cfg.live) || {}, m = /^\*(\d{3,})$/.exec(String(L.account || '').trim());
  if (L.on !== true) return { off: 'live is off in config.json' };
  if (!m) return { off: 'config.json live.account must be "*" and the last digits of the live login' };
  const risk = Math.min(LIVE.maxRisk, Math.max(0.0005, +L.risk || LIVE.risk)), dayStop = Math.min(0.5, Math.max(0.01, +L.dayStop || LIVE.dayStop));
  const goldRisk = L.goldRisk == null ? risk : Math.min(LIVE.maxGold, Math.max(0.0005, +L.goldRisk || risk));
  return { account: '*' + m[1], tail: m[1], risk, dayStop, goldRisk };
}
export const liveEnvOk = (env) => String(env.CTRADER_LIVE || '').trim().toLowerCase() === 'on' && ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET'].every((k) => env[k]) && !!(env.CTRADER_LIVE_ACCESS_TOKEN || env.CTRADER_ACCESS_TOKEN);
// the one live account whose login ends in `tail`; null when none or several (never a demo account)
export function pickLive(list, tail) { const L = (list || []).filter((a) => a.isLive === true && String(a.traderLogin).endsWith(String(tail))); return L.length === 1 ? L[0] : null; }
export async function liveConnect({ env, dir, account, WS, scrub }) {
  const m = /^\*(\d{3,})$/.exec(String(account || '').trim()); if (!m) throw Object.assign(new Error('no live account named'), { final: true });
  if (!liveEnvOk(env)) throw Object.assign(new Error('CTRADER_LIVE is not on'), { final: true });
  let tok = { accessToken: env.CTRADER_LIVE_ACCESS_TOKEN || env.CTRADER_ACCESS_TOKEN };
  if (!env.CTRADER_LIVE_ACCESS_TOKEN) try { const tf = path.join(dir, 'ctrader', 'tokens.json'); if (fs.existsSync(tf)) { const t = unseal(JSON.parse(fs.readFileSync(tf, 'utf8')), env); if (t && t.accessToken) { scrub.add(t.accessToken, t.refreshToken); tok = t; } } } catch (e) {}
  const s = liveSession(WS, scrub);
  try {
    await s.send(PT.APP_AUTH_REQ, { clientId: env.CTRADER_CLIENT_ID, clientSecret: env.CTRADER_CLIENT_SECRET }, PT.APP_AUTH_RES);
    const list = await s.send(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken: tok.accessToken }, PT.ACCOUNTS_BY_TOKEN_RES), acc = pickLive(list.ctidTraderAccount, m[1]);
    if (!acc) throw Object.assign(new Error(`no single live account with a login ending ${m[1]} on this token`), { final: true });
    const ctid = Number(acc.ctidTraderAccountId);
    await s.send(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: ctid, accessToken: tok.accessToken }, PT.ACCOUNT_AUTH_RES);
    return { s, ctid };
  } catch (e) { s.close(); throw e; }
}
// the daily stop: the UTC day's first balance seen is its start; a balance `dayStop` under it allows no new order that day
export function dayGate(dir, balance, now, dayStop) {
  const f = path.join(dir, 'live', 'day.json'), day = new Date(now * 1000).toISOString().slice(0, 10);
  let J = {}; try { J = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {}
  if (!(balance > 0)) return { ok: false, why: 'the balance could not be read' };
  if (J.day !== day || !(J.start > 0)) { J = { day, start: balance }; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(J)); }
  const loss = (J.start - balance) / J.start;
  return loss >= dayStop ? { ok: false, why: `daily stop: the balance is ${(loss * 100).toFixed(1)} % under the day's start (${J.start})`, start: J.start, loss } : { ok: true, start: J.start, loss };
}
// what each job reads in its mode: demo = as before, live = this file's lock, account, risk, records and labels
export function modeOf(mode, cfg, env, demo) {
  if (mode !== 'live') return { live: false, ...demo };
  const L = liveConfig(cfg);
  return { live: true, off: L.off || (!liveEnvOk(env) ? 'CTRADER_LIVE is not on' : null), account: L.account, risk: L.risk, maxRisk: LIVE.maxRisk, dayStop: L.dayStop, goldRisk: L.goldRisk, maxGold: LIVE.maxGold,
    file: path.join(demo.dir, 'live', demo.name + '.json'), label: (x) => 'lv-' + x, connect: liveConnect };
}
