// cTrader Open API: demo-only, READ-ONLY account check (7 Nov 2026).
//
//   POST /api/ctrader { ownerPw }      -> { ok, account: { id, broker, isLive:false, balance, currency digits }, positions, orders, token }
//   (or header x-diag-key: <CTRADER_DIAG_KEY> — a preview-only key so the connection can be checked on a preview deploy)
//
// Safety rules, enforced in code, not by convention:
//   * DEMO ONLY: the host is hard-coded to the cTrader DEMO endpoint, CTRADER_ENV must be "demo", and the account must
//     report isLive:false in the account list BEFORE we authenticate to it. Anything else stops the request.
//   * READ ONLY: only the message types in READ_ONLY can be sent. Order/position/amend/cancel messages are not in the
//     list, so this file cannot place, modify or cancel anything.
//   * SECRETS stay server-side: values come from Vercel env vars (Development/Preview only) and are never returned,
//     logged or written in plain text. A rotated token pair is stored encrypted (AES-256-GCM, key derived from the
//     client secret) in private Vercel Blob, never overwriting the env vars.
const crypto = require('node:crypto');

const DEMO_HOST = 'wss://demo.ctraderapi.com:5036';          // JSON over WebSocket, demo environment only
const PT = {                                                  // ProtoOAPayloadType (OpenApiMessages.proto)
  APP_AUTH_REQ: 2100, APP_AUTH_RES: 2101,
  ACCOUNT_AUTH_REQ: 2102, ACCOUNT_AUTH_RES: 2103,
  TRADER_REQ: 2121, TRADER_RES: 2122,
  RECONCILE_REQ: 2124, RECONCILE_RES: 2125,
  OA_ERROR_RES: 2142,
  ACCOUNTS_BY_TOKEN_REQ: 2149, ACCOUNTS_BY_TOKEN_RES: 2150,
  REFRESH_TOKEN_REQ: 2173, REFRESH_TOKEN_RES: 2174,
  ERROR_RES: 50, HEARTBEAT: 51,
};
const READ_ONLY = new Set([PT.APP_AUTH_REQ, PT.ACCOUNTS_BY_TOKEN_REQ, PT.ACCOUNT_AUTH_REQ, PT.TRADER_REQ, PT.RECONCILE_REQ, PT.REFRESH_TOKEN_REQ, PT.HEARTBEAT]);
const OWNER_HASH = '49c5624f2625ed8b42b6e1bf2819a3a41ddb9743aeca36ea34ea7eb96c252ca8';
const NEED = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_REFRESH_TOKEN', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'];
const TOKEN_PREFIX = 'ctrader/tokens-';

// ---- secret handling -------------------------------------------------------------------------------------------
const secrets = () => NEED.map((k) => process.env[k]).filter((v) => v && v.length >= 6);
function scrub(s) { let t = String(s == null ? '' : s); for (const v of secrets()) t = t.split(v).join('[redacted]'); return t.slice(0, 300); }
function keyFor(env) { return crypto.createHash('sha256').update(`${env.CTRADER_CLIENT_SECRET}|meridian-ctrader-tokens-v1`).digest(); }
function seal(obj, env) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyFor(env), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
}
function open(text, env) {
  const o = JSON.parse(text), d = crypto.createDecipheriv('aes-256-gcm', keyFor(env), Buffer.from(o.iv, 'base64'));
  d.setAuthTag(Buffer.from(o.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(o.data, 'base64')), d.final()]).toString('utf8'));
}

// ---- token store (private Blob; newest wins; older copies removed) --------------------------------------------
function blobStore(token) {
  if (!token) return null;
  const { put, list, del } = require('@vercel/blob');
  return {
    async latest() {
      const { blobs } = await list({ prefix: TOKEN_PREFIX, token });
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      if (!blobs.length) return null;
      const r = await fetch(blobs[0].url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      return r.ok ? { text: await r.text(), all: blobs } : null;
    },
    async save(text, old = []) {
      await put(`${TOKEN_PREFIX}${Date.now()}.json`, text, { access: 'private', addRandomSuffix: true, contentType: 'application/json', token });
      if (old.length) await del(old.map((b) => b.url), { token }).catch(() => {});
    },
  };
}

// ---- Open API session (JSON over WebSocket) --------------------------------------------------------------------
function session(WS, url = DEMO_HOST) {
  if (url !== DEMO_HOST) throw new Error('refusing a non-demo host');
  const ws = new WS(url), waiting = new Map();
  let n = 0, beat, closed = false;
  const opened = new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('could not reach the cTrader demo server')); });
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (e) { return; }
    if (m.payloadType === PT.HEARTBEAT) return;
    const w = waiting.get(m.clientMsgId); if (!w) return;
    waiting.delete(m.clientMsgId); clearTimeout(w.t);
    if (m.payloadType === PT.OA_ERROR_RES || m.payloadType === PT.ERROR_RES) {
      const p = m.payload || {}; const e = new Error(scrub(`${p.errorCode || 'ERROR'}: ${p.description || ''}`)); e.code = p.errorCode; w.fail(e);
    } else if (w.expect && m.payloadType !== w.expect) w.fail(new Error(`unexpected reply ${m.payloadType}`));
    else w.ok(m.payload || {});
  };
  ws.onclose = () => { clearInterval(beat); for (const w of waiting.values()) { clearTimeout(w.t); w.fail(new Error('connection closed')); } waiting.clear(); };
  async function send(payloadType, payload, expect) {
    if (!READ_ONLY.has(payloadType)) throw new Error(`blocked: message ${payloadType} is not read-only`);
    if (closed) throw new Error('session closed');
    await opened;
    const clientMsgId = `m${++n}`;
    return new Promise((ok, fail) => {
      const t = setTimeout(() => { waiting.delete(clientMsgId); fail(new Error(`timeout waiting for ${expect}`)); }, 8000);
      waiting.set(clientMsgId, { ok, fail, t, expect });
      ws.send(JSON.stringify({ clientMsgId, payloadType, payload }));
    });
  }
  opened.then(() => { if (closed) return; beat = setInterval(() => { try { ws.send(JSON.stringify({ payloadType: PT.HEARTBEAT, payload: {} })); } catch (e) {} }, 10000); }).catch(() => {});
  return { send, close: () => { closed = true; clearInterval(beat); try { ws.close(); } catch (e) {} } };
}

// account numbers are shown only partly (last 3 digits), so the owner can tell which one to use without listing them in full
const mask = (v) => (v == null ? null : '…' + String(v).slice(-3));
const listing = (a) => ({ accountId: mask(a.ctidTraderAccountId), login: mask(a.traderLogin), demo: a.isLive === false, broker: a.brokerTitleShort || null });

// ---- the read-only check ---------------------------------------------------------------------------------------
const TOKEN_ERR = /ACCESS_TOKEN|INVALID_TOKEN|TOKEN_EXPIRED|CH_ACCESS_TOKEN_INVALID|NOT_AUTHORIZED|UNAUTHORIZED/i;
async function check(env, { WS = globalThis.WebSocket, store = null } = {}) {
  const missing = NEED.filter((k) => !env[k]);
  if (missing.length) return { ok: false, status: 503, error: 'cTrader is not configured in this environment', missing };
  if (String(env.CTRADER_ENV).toLowerCase() !== 'demo') return { ok: false, status: 403, error: 'CTRADER_ENV must be "demo"; live is not allowed' };
  if (!WS) return { ok: false, status: 500, error: 'WebSocket is not available in this runtime' };
  const accountId = Number(env.CTRADER_ACCOUNT_ID);
  if (!Number.isSafeInteger(accountId) || accountId <= 0) return { ok: false, status: 500, error: 'CTRADER_ACCOUNT_ID is not a number' };

  // newest rotated tokens (if any) win over the env copies
  let tok = { accessToken: env.CTRADER_ACCESS_TOKEN, refreshToken: env.CTRADER_REFRESH_TOKEN }, tokenSource = 'env', stored = null;
  if (store) { try { stored = await store.latest(); if (stored) { const t = open(stored.text, env); if (t.accessToken && t.refreshToken) { tok = t; tokenSource = 'rotated'; } } } catch (e) { stored = null; } }

  const s = session(WS);
  try {
    await s.send(PT.APP_AUTH_REQ, { clientId: env.CTRADER_CLIENT_ID, clientSecret: env.CTRADER_CLIENT_SECRET }, PT.APP_AUTH_RES);
    let list, refreshed = false;
    try { list = await s.send(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken: tok.accessToken }, PT.ACCOUNTS_BY_TOKEN_RES); }
    catch (e) {
      if (!TOKEN_ERR.test(String(e.code || e.message))) throw e;
      const r = await s.send(PT.REFRESH_TOKEN_REQ, { refreshToken: tok.refreshToken }, PT.REFRESH_TOKEN_RES);
      if (!r.accessToken || !r.refreshToken) throw new Error('token refresh returned no tokens');
      tok = { accessToken: r.accessToken, refreshToken: r.refreshToken, rotatedAt: new Date().toISOString(), expiresIn: r.expiresIn || null };
      if (!store) throw new Error('access token expired and there is no server-side store to keep the rotated tokens (BLOB_READ_WRITE_TOKEN missing)');
      await store.save(seal(tok, env), stored ? stored.all : []);
      refreshed = true; tokenSource = 'rotated';
      list = await s.send(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken: tok.accessToken }, PT.ACCOUNTS_BY_TOKEN_RES);
    }
    // CTRADER_ACCOUNT_ID may hold the Open API account id (ctidTraderAccountId) or the login number shown in cTrader (traderLogin)
    const all = list.ctidTraderAccount || [];
    const acc = all.find((a) => Number(a.ctidTraderAccountId) === accountId) || all.find((a) => Number(a.traderLogin) === accountId);
    if (!acc) return { ok: false, status: 404, error: 'CTRADER_ACCOUNT_ID matches neither the account id nor the login of any account this token can see', accounts: all.map(listing) };
    if (acc.isLive !== false) return { ok: false, status: 403, error: 'account is not a demo account (isLive is not false): stopped before connecting to it' };
    const ctid = Number(acc.ctidTraderAccountId), matchedBy = ctid === accountId ? 'accountId' : 'login';

    await s.send(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: ctid, accessToken: tok.accessToken }, PT.ACCOUNT_AUTH_RES);
    const tr = (await s.send(PT.TRADER_REQ, { ctidTraderAccountId: ctid }, PT.TRADER_RES)).trader || {};
    const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES);
    const digits = Number.isFinite(+tr.moneyDigits) ? +tr.moneyDigits : 2;
    return {
      ok: true, status: 200, host: 'demo', readOnly: true,
      account: { id: ctid, matchedBy, login: acc.traderLogin || null, broker: acc.brokerTitleShort || tr.brokerName || null, isLive: false,
        balance: tr.balance != null ? Number(tr.balance) / 10 ** digits : null, depositAssetId: tr.depositAssetId || null },
      positions: (rc.position || []).length, orders: (rc.order || []).length,
      token: { source: tokenSource, refreshed },
    };
  } finally { s.close(); }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  let b = {}; if (req.method === 'POST') { try { b = typeof req.body === 'string' ? (JSON.parse(req.body || '{}') || {}) : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'bad JSON' }); } }
  const owner = b.ownerPw && crypto.createHash('sha256').update(String(b.ownerPw)).digest('hex') === OWNER_HASH;
  const dk = process.env.CTRADER_DIAG_KEY, given = String(req.headers['x-diag-key'] || '');
  const diag = !!dk && process.env.VERCEL_ENV !== 'production' && given.length === dk.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(dk));
  if (!owner && !diag) return res.status(403).json({ error: 'owner only' });
  try {
    const out = await check(process.env, { store: blobStore(process.env.BLOB_READ_WRITE_TOKEN) });
    const { status, ...body } = out; return res.status(status).json(body);
  } catch (e) { return res.status(502).json({ ok: false, error: scrub(e.message || e) }); }
};
module.exports._test = { check, seal, open, scrub, PT, READ_ONLY, DEMO_HOST, session };
