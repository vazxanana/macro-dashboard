// Each user's own cTrader account in their profile (owner, 7 Nov 2026: "in the profile should be able to see the cTrader
// account: live P&L, open trades, history, linked to each account; they will have their own").
// VIEW ONLY: the link asks cTrader for the read-only "accounts" scope, and this file only ever sends read messages
// (READ_ONLY below). Demo and live accounts may be linked (owner's choice, 7 Nov).
//
//   POST /api/ctrader-link { action: 'session', user, pw }   -> { session }      proves the password once; session lasts 30 days
//   POST /api/ctrader-link { action: 'start', session }      -> { url } + cookie  where to send the browser to grant access
//   GET  /api/ctrader-link?code=…                            <- cTrader's redirect: swaps the code for tokens, stores them, back to the page
//   POST /api/ctrader-link { action: 'summary', session, account?, days? } -> accounts, balance, equity, open trades, history
//   POST /api/ctrader-link { action: 'unlink', session }     -> removes the stored tokens
//
// Env (Vercel, server only, never sent to the browser): CTRADER_CLIENT_ID, CTRADER_CLIENT_SECRET, CTRADER_LINK_KEY (any long
// random string: signs sessions and encrypts the stored tokens), BLOB_READ_WRITE_TOKEN; optional CTRADER_REDIRECT_URI (default
// https://<host>/api/ctrader-link; it must be listed under the cTrader app's redirect URIs).
// Tokens are stored encrypted (AES-256-GCM) in the private Blob store at ctlink/<user>/…json. Secrets are never logged.
// Security review (7 Nov): a session (and the link cookie) carries a fingerprint of the user's password hash and is checked
// against the current user list on every request, so removing a user, changing a password or re-using a user key ends it at
// once; the user list fails closed (a Blob error never lets a disabled built-in user back in); the key "owner" is reserved;
// every token in play is scrubbed from errors.
const crypto = require('node:crypto');

const ACC = require('./_accounts');
const G = require('./_guard');
const OWNER_HASH = ACC.OWNER_HASH;
const HOSTS = { demo: 'wss://demo.ctraderapi.com:5036', live: 'wss://live.ctraderapi.com:5036' };
const PT = { APP_AUTH_REQ: 2100, APP_AUTH_RES: 2101, ACCOUNT_AUTH_REQ: 2102, ACCOUNT_AUTH_RES: 2103, ASSET_LIST_REQ: 2112, ASSET_LIST_RES: 2113,
  SYMBOLS_LIST_REQ: 2114, SYMBOLS_LIST_RES: 2115, SYMBOL_BY_ID_REQ: 2116, SYMBOL_BY_ID_RES: 2117, SYMBOLS_FOR_CONVERSION_REQ: 2118,
  SYMBOLS_FOR_CONVERSION_RES: 2119, TRADER_REQ: 2121, TRADER_RES: 2122, RECONCILE_REQ: 2124, RECONCILE_RES: 2125, DEAL_LIST_REQ: 2133,
  DEAL_LIST_RES: 2134, ORDER_ERROR_EVENT: 2132, EXPECTED_MARGIN_REQ: 2139, EXPECTED_MARGIN_RES: 2140, OA_ERROR_RES: 2142, GET_TICKDATA_REQ: 2145,
  GET_TICKDATA_RES: 2146, ACCOUNTS_BY_TOKEN_REQ: 2149, ACCOUNTS_BY_TOKEN_RES: 2150, GET_DYNAMIC_LEVERAGE_REQ: 2177, GET_DYNAMIC_LEVERAGE_RES: 2178,
  UNREALIZED_PNL_REQ: 2187, UNREALIZED_PNL_RES: 2188, ERROR_RES: 50, HEARTBEAT: 51 };
// the only messages this file may send: authentication and reads. No order, amend, cancel or close message is in here.
// The symbol-spec dump (council/ctrader-symbols.mjs, 7 Nov) also reads the conversion chain, past ticks (bid / ask), the margin a
// volume would need and the leverage tiers: questions to the broker, none of them places, changes or closes anything.
const READ_ONLY = new Set([PT.APP_AUTH_REQ, PT.ACCOUNT_AUTH_REQ, PT.ASSET_LIST_REQ, PT.SYMBOLS_LIST_REQ, PT.SYMBOL_BY_ID_REQ, PT.TRADER_REQ,
  PT.RECONCILE_REQ, PT.DEAL_LIST_REQ, PT.ACCOUNTS_BY_TOKEN_REQ, PT.UNREALIZED_PNL_REQ, PT.HEARTBEAT,
  PT.SYMBOLS_FOR_CONVERSION_REQ, PT.EXPECTED_MARGIN_REQ, PT.GET_TICKDATA_REQ, PT.GET_DYNAMIC_LEVERAGE_REQ]);

const sha = ACC.sha, same = ACC.same;
const b64u = (b) => Buffer.from(b).toString('base64url');
const keyOf = (env, use) => crypto.createHash('sha256').update(`${use}|${env.CTRADER_LINK_KEY}`).digest();
function sign(env, obj) { const body = b64u(JSON.stringify(obj)); return `${body}.${b64u(crypto.createHmac('sha256', keyOf(env, 'sign')).update(body).digest())}`; }
function verify(env, tok, now = Date.now()) {
  const [body, mac] = String(tok || '').split('.'); if (!body || !mac) return null;
  const want = b64u(crypto.createHmac('sha256', keyOf(env, 'sign')).update(body).digest());
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  let o; try { o = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  return o && o.exp > now ? o : null;
}
function seal(env, obj) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyOf(env, 'seal'), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { v: 1, iv: b64u(iv), tag: b64u(c.getAuthTag()), data: b64u(data) };
}
function unseal(env, box) {
  const d = crypto.createDecipheriv('aes-256-gcm', keyOf(env, 'seal'), Buffer.from(box.iv, 'base64url'));
  d.setAuthTag(Buffer.from(box.tag, 'base64url'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64url')), d.final()]).toString('utf8'));
}

// --- who is asking: the owner, a built-in member (api/_accounts.js) or one added on the Users page (Blob); fails closed ---
const builtInUsers = ACC.builtInUsers, userList = ACC.userList;
const KEY_RE = /^[a-z0-9-]{1,24}$/;
async function identify(deps, user, pw) {
  if (!pw || String(pw).length > 200) return null;
  const h = sha(pw);
  if (same(h, OWNER_HASH)) return { u: 'owner', name: 'Owner', h };
  const key = String(user || '').toLowerCase(); if (!KEY_RE.test(key) || key === 'owner') return null;
  const R = (await userList(deps))[key];
  if (R && same(R.hash, h)) return { u: key, name: R.name || key, h };
  return null;
}
// a short keyed fingerprint of the password hash: ties a session to the password it was made with (the hash itself stays out)
const fpOf = (env, h) => crypto.createHmac('sha256', keyOf(env, 'fp')).update(String(h)).digest('base64url').slice(0, 22);
// the session's user as the user list stands now: null when removed, disabled, or the password changed since
async function current(env, deps, ses) {
  if (!ses || typeof ses.u !== 'string' || typeof ses.f !== 'string') return null;
  const ok = (h) => { const want = fpOf(env, h); return want.length === ses.f.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(ses.f)); };
  if (ses.u === 'owner') return ok(OWNER_HASH) ? ses.u : null;
  if (!KEY_RE.test(ses.u)) return null;
  const R = (await userList(deps))[ses.u];
  return R && /^[0-9a-f]{64}$/.test(String(R.hash)) && ok(R.hash) ? ses.u : null;
}

// --- token storage (private Blob, one record per user) ---
function store(env) {
  const { put, list, del } = require('@vercel/blob'), token = env.BLOB_READ_WRITE_TOKEN;
  const files = async (u) => { const { blobs } = await list({ prefix: `ctlink/${u}/`, token }); return blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)); };
  return {
    async get(u) { const b = (await files(u))[0]; if (!b) return null; const r = await fetch(b.url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(`store ${r.status}`); return unseal(env, await r.json()); },
    async set(u, rec) { const old = await files(u); await put(`ctlink/${u}/${Date.now()}.json`, JSON.stringify(seal(env, rec)), { access: 'private', addRandomSuffix: true, contentType: 'application/json', token }); if (old.length) await del(old.map((x) => x.url), { token }).catch(() => {}); },
    async del(u) { const old = await files(u); if (old.length) await del(old.map((x) => x.url), { token }); },
  };
}
const blobUsers = (env, host, io) => ACC.blobUsers(env, io);   // the stored user list (api/_accounts.js); host is no longer used

// --- cTrader OAuth (HTTP) ---
async function tokenCall(env, params, fetchFn = fetch) {
  const q = new URLSearchParams({ ...params, client_id: env.CTRADER_CLIENT_ID, client_secret: env.CTRADER_CLIENT_SECRET });
  const r = await fetchFn(`https://openapi.ctrader.com/apps/token?${q}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.accessToken) throw new Error(`cTrader token ${r.status}${j.errorCode ? ` ${j.errorCode}` : ''}`);
  return { accessToken: j.accessToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn || 2592000) * 1000 };
}
async function freshTokens(env, deps, u) {
  const rec = await deps.store.get(u); if (!rec || !rec.accessToken) return null;
  if (rec.exp && rec.exp - Date.now() < 3 * 86400e3 && rec.refreshToken) {   // refresh a few days early; keep the old pair if it fails
    try { const t = await tokenCall(env, { grant_type: 'refresh_token', refresh_token: rec.refreshToken }, deps.fetch); Object.assign(rec, t); await deps.store.set(u, rec); } catch (e) {}
  }
  return rec;
}

// --- cTrader Open API (JSON over WebSocket), read-only ---
function session(WS, url) {
  if (!Object.values(HOSTS).includes(url)) throw new Error('unknown cTrader host');
  const ws = new WS(url), waiting = new Map(); let n = 0, closed = false;
  const opened = new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('could not reach cTrader')); });
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (e) { return; }
    const w = m.clientMsgId && waiting.get(m.clientMsgId); if (!w) return;
    waiting.delete(m.clientMsgId); clearTimeout(w.t);
    const p = m.payload || {};
    if ([PT.OA_ERROR_RES, PT.ERROR_RES, PT.ORDER_ERROR_EVENT].includes(m.payloadType)) w.fail(new Error(`${p.errorCode || 'ERROR'}${p.description ? `: ${String(p.description).slice(0, 120)}` : ''}`));
    else w.ok(p);
  };
  async function send(payloadType, payload) {
    if (!READ_ONLY.has(payloadType)) throw new Error(`blocked: message ${payloadType} is not a read`);
    if (closed) throw new Error('session closed');
    await opened;
    const clientMsgId = `r${++n}`;
    return new Promise((ok, fail) => {
      const w = { ok, fail, t: setTimeout(() => { waiting.delete(clientMsgId); fail(new Error('cTrader did not answer in time')); }, 10000) };
      waiting.set(clientMsgId, w); ws.send(JSON.stringify({ clientMsgId, payloadType, payload }));
    });
  }
  return { send, close: () => { closed = true; for (const w of waiting.values()) clearTimeout(w.t); try { ws.close(); } catch (e) {} } };
}
const money = (v, d) => (v == null ? null : +(+v / 10 ** d).toFixed(d));
const sideOf = (s) => (s === 2 || s === 'SELL' ? 'sell' : 'buy');

async function readAccounts(WS, accessToken, env) {   // cTrader answers the account list only after the app has authenticated
  const s = session(WS, HOSTS.demo);
  try {
    await s.send(PT.APP_AUTH_REQ, { clientId: String(env.CTRADER_CLIENT_ID).trim(), clientSecret: String(env.CTRADER_CLIENT_SECRET).trim() });
    const list = await s.send(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken });
    return (list.ctidTraderAccount || []).map((a) => ({ id: String(a.ctidTraderAccountId), login: a.traderLogin != null ? String(a.traderLogin) : null, live: a.isLive === true, broker: a.brokerTitleShort || a.brokerName || null }));
  } finally { s.close(); }
}

// everything the profile shows for one account
async function readAccount(env, WS, accessToken, acc, { days = 30, now = Date.now() } = {}) {
  const s = session(WS, acc.live ? HOSTS.live : HOSTS.demo), ctid = Number(acc.id);
  try {
    await s.send(PT.APP_AUTH_REQ, { clientId: env.CTRADER_CLIENT_ID, clientSecret: env.CTRADER_CLIENT_SECRET });
    await s.send(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: ctid, accessToken });
    const trader = (await s.send(PT.TRADER_REQ, { ctidTraderAccountId: ctid })).trader || {};
    const md = Number.isFinite(+trader.moneyDigits) ? +trader.moneyDigits : 2;
    const [rc, names, assets] = await Promise.all([
      s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }),
      s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }),
      s.send(PT.ASSET_LIST_REQ, { ctidTraderAccountId: ctid }).catch(() => ({})),
    ]);
    const nameOf = new Map((names.symbol || []).map((x) => [String(x.symbolId), x.symbolName]));
    const ccy = ((assets.asset || []).find((a) => String(a.assetId) === String(trader.depositAssetId)) || {}).name || null;
    // closed trades: the deal list allows one week per request
    const deals = [], from = now - Math.min(Math.max(+days || 30, 1), 90) * 86400e3;
    for (let to = now; to > from && deals.length < 1000; to -= 7 * 86400e3) {
      const r = await s.send(PT.DEAL_LIST_REQ, { ctidTraderAccountId: ctid, fromTimestamp: Math.max(from, to - 7 * 86400e3), toTimestamp: to, maxRows: 500 });
      deals.push(...(r.deal || []));
    }
    let pnl = {}; try { const u = await s.send(PT.UNREALIZED_PNL_REQ, { ctidTraderAccountId: ctid }); const d = Number.isFinite(+u.moneyDigits) ? +u.moneyDigits : md;
      for (const x of u.positionUnrealizedPnL || []) pnl[String(x.positionId)] = { gross: money(x.grossUnrealizedPnL, d), net: money(x.netUnrealizedPnL, d) }; } catch (e) { pnl = null; }
    const ids = [...new Set([...(rc.position || []).map((p) => p.tradeData && p.tradeData.symbolId), ...deals.map((d) => d.symbolId)].filter((x) => x != null).map(Number))];
    const lotOf = new Map(); if (ids.length) { const r = await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: ids }).catch(() => ({})); for (const x of r.symbol || []) lotOf.set(String(x.symbolId), { lot: +x.lotSize || null, digits: +x.digits }); }
    const lots = (vol, sid) => { const l = lotOf.get(String(sid)); return l && l.lot ? +(+vol / l.lot).toFixed(2) : null; };
    const open = (rc.position || []).map((p) => { const t = p.tradeData || {}, id = String(p.positionId), u = pnl && pnl[id];
      return { id, symbol: nameOf.get(String(t.symbolId)) || String(t.symbolId), side: sideOf(t.tradeSide), lots: lots(t.volume, t.symbolId), units: t.volume != null ? +t.volume / 100 : null,
        entry: p.price != null ? +p.price : null, sl: p.stopLoss ?? null, tp: p.takeProfit ?? null, openedAt: t.openTimestamp ? new Date(+t.openTimestamp).toISOString() : null,
        swap: money(p.swap, Number.isFinite(+p.moneyDigits) ? +p.moneyDigits : md), commission: money(p.commission, Number.isFinite(+p.moneyDigits) ? +p.moneyDigits : md),
        pnl: u ? u.net : null, pnlGross: u ? u.gross : null, label: t.label || null }; });
    const orders = (rc.order || []).map((o) => { const t = o.tradeData || {}; return { id: String(o.orderId), symbol: nameOf.get(String(t.symbolId)) || String(t.symbolId), side: sideOf(t.tradeSide),
      type: o.orderType, lots: lots(t.volume, t.symbolId), price: o.limitPrice ?? o.stopPrice ?? null, sl: o.stopLoss ?? null, tp: o.takeProfit ?? null }; });
    const history = deals.filter((d) => d.closePositionDetail).map((d) => { const c = d.closePositionDetail, cd = Number.isFinite(+c.moneyDigits) ? +c.moneyDigits : md;
      const gross = money(c.grossProfit, cd), swap = money(c.swap, cd) || 0, comm = money(c.commission, cd) || 0;
      return { id: String(d.dealId), positionId: String(d.positionId), symbol: nameOf.get(String(d.symbolId)) || String(d.symbolId), side: sideOf(d.tradeSide) === 'buy' ? 'sell' : 'buy',   // a closing deal is the opposite side
        lots: lots(c.closedVolume != null ? c.closedVolume : d.filledVolume, d.symbolId), entry: c.entryPrice != null ? +c.entryPrice : null, exit: d.executionPrice != null ? +d.executionPrice : null,
        closedAt: new Date(+(d.executionTimestamp || d.createTimestamp)).toISOString(), gross, swap, commission: comm, net: gross == null ? null : +(gross + swap + comm).toFixed(cd) }; })
      .sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1));
    const balance = money(trader.balance, md), floating = pnl ? +open.reduce((a, p) => a + (p.pnl || 0), 0).toFixed(md) : null;
    return { account: { ...acc, currency: ccy, leverage: trader.leverageInCents ? trader.leverageInCents / 100 : null }, balance, floating, equity: floating == null || balance == null ? null : +(balance + floating).toFixed(md),
      open, orders, history, days: Math.round((now - from) / 86400e3), at: new Date(now).toISOString() };
  } finally { s.close(); }
}

function redirectUri(env, req) { return env.CTRADER_REDIRECT_URI || `https://${req.headers.host}/api/ctrader-link`; }
const COOKIE = 'ct_link';
function cookieOf(req) { const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`)); return m ? decodeURIComponent(m[1]) : null; }

async function handle(req, res, { env = process.env, WS = globalThis.WebSocket, deps: d = {} } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  const ready = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_LINK_KEY', 'BLOB_READ_WRITE_TOKEN'].every((k) => String(env[k] || '').trim());
  if (!ready) return res.status(503).json({ error: 'cTrader linking is not set up on the server yet' });
  const deps = { store: d.store || store(env), blobUsers: d.blobUsers || (() => blobUsers(env)), fetch: d.fetch || fetch, builtIns: d.builtIns };
  const page = (q) => `/market-structure.html?${q}#ctrader`;
  // every secret in play is scrubbed from errors: the app's own and, once read, the user's cTrader tokens and the grant code
  const secrets = [env.CTRADER_CLIENT_SECRET, env.CTRADER_CLIENT_ID, env.CTRADER_LINK_KEY, env.BLOB_READ_WRITE_TOKEN];
  try {
    if (req.method === 'GET') {   // cTrader sends the browser back here with ?code=… (or ?error=…)
      const q = req.query || {}, st = verify(env, cookieOf(req));
      res.setHeader('Set-Cookie', `${COOKIE}=; Path=/api/ctrader-link; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
      if (!st || st.k !== 'link' || !(await current(env, deps, st))) return res.redirect(302, page('ct=expired'));
      if (!q.code) return res.redirect(302, page('ct=denied'));
      const code = String(q.code).slice(0, 400); secrets.push(code);
      const t = await tokenCall(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri(env, req) }, deps.fetch);
      secrets.push(t.accessToken, t.refreshToken);
      await deps.store.set(st.u, { ...t, linkedAt: new Date().toISOString() });
      console.log(`[ctrader-link] linked for ${st.u}`);
      return res.redirect(302, page('ct=linked'));
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') || {} : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (b.action === 'session') {
      const secs = G.wait(req); if (secs) return G.tooMany(res, secs);   // password guessing (api/_guard.js)
      const who = await identify(deps, b.user, b.pw); if (!who) { G.failed(req); return res.status(403).json({ error: 'Password not accepted' }); }
      return res.status(200).json({ session: sign(env, { k: 'sess', u: who.u, f: fpOf(env, who.h), exp: Date.now() + 30 * 86400e3 }), user: who.u });
    }
    const ses = verify(env, b.session);
    if (!ses || ses.k !== 'sess' || !(await current(env, deps, ses))) return res.status(401).json({ error: 'Please confirm your password again' });
    if (b.action === 'start') {
      res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(sign(env, { k: 'link', u: ses.u, f: ses.f, exp: Date.now() + 15 * 60e3 }))}; Path=/api/ctrader-link; Max-Age=900; HttpOnly; Secure; SameSite=Lax`);
      const q = new URLSearchParams({ client_id: env.CTRADER_CLIENT_ID, redirect_uri: redirectUri(env, req), scope: 'accounts', product: 'web' });
      return res.status(200).json({ url: `https://id.ctrader.com/my/settings/openapi/grantingaccess/?${q}` });
    }
    if (b.action === 'unlink') { await deps.store.del(ses.u); return res.status(200).json({ linked: false }); }
    if (b.action === 'summary') {
      const rec = await freshTokens(env, deps, ses.u); if (!rec) return res.status(200).json({ linked: false });
      secrets.push(rec.accessToken, rec.refreshToken);
      if (!WS) return res.status(500).json({ error: 'WebSocket is not available on this server' });
      const accounts = await readAccounts(WS, rec.accessToken, env);
      if (!accounts.length) return res.status(200).json({ linked: true, accounts: [], error: 'No cTrader accounts were shared with this link' });
      const acc = accounts.find((a) => a.id === String(b.account || '')) || accounts.find((a) => a.live) || accounts[0];
      const data = await readAccount(env, WS, rec.accessToken, acc, { days: b.days });
      return res.status(200).json({ linked: true, linkedAt: rec.linkedAt || null, accounts, ...data });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e) {
    let msg = String((e && e.message) || e);
    for (const v of secrets) if (v && String(v).length >= 4) msg = msg.split(String(v)).join('***');
    console.error(`[ctrader-link] ${msg}`);
    return req.method === 'GET' ? res.redirect(302, page('ct=failed')) : res.status(e && e.status === 503 ? 503 : 502).json({ error: msg });
  }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports._t = { sign, verify, seal, unseal, builtInUsers, identify, current, blobUsers, same, fpOf, readAccount, readAccounts, session, READ_ONLY, PT, HOSTS };
