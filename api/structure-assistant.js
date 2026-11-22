// The structure assistant's endpoint (22 Nov 2026; the request and the answer check are api/_structure-assistant.js).
//   GET  /api/structure-assistant   a signed-in member -> { enabled, reason, perDay, leftToday, cost }
//   POST /api/structure-assistant   a signed-in member, same origin; body { market, label?, tf?, question?, facts, stream? }
//        -> { state: 'ok', answer, provider, model, cached, ms } | { state: 'off' | 'budget' | 'limit' | 'refused' | 'error', message }
//        With stream: true and a question that reaches the model the answer is sent as server-sent events (text/event-stream):
//        data: {"t":"start"}, data: {"t":"text","d":"<piece>"} as the provider writes it, then data: {"t":"done", …the result
//        above}. The result in "done" is the CHECKED one: an answer that fails the checks is "refused" and the page withdraws
//        what it showed. Every early answer (off, limit, a stored answer, a bad request) is JSON.
// Display only: a language model's reading of the structure the Desk's charts already compute. It places, changes or refuses no
// order, moves no stop, and no council member reads it.
// Store: the private Blob store, folder structure-assistant/ (structure-assistant-preview/ off production): answers.json, and the
// adapter's own cost.json + llm-cache.json there (never another feature's). A question already answered (or refused after a
// billed call) is answered from the store: never paid for twice.
// Environment (the daily brief's pattern, api/daily.js):
//   key STRUCT_LLM_KEY, else ACADEMY_LLM_KEY, else ANTHROPIC_API_KEY / CLAUDE_API_KEY (which bring the provider's messages
//   address and format when none is set); STRUCT_LLM_URL / _FORMAT else the Academy's; model STRUCT_LLM_MODEL else ACADEMY_LLM_MODEL
//   STRUCT_LLM_DAILY_USD (default 0.5), STRUCT_LLM_MONTHLY_USD (5), STRUCT_LLM_HARD_USD (25), STRUCT_LLM_MAX_CALLS_DAY (60): this
//   feature's own budgets; STRUCT_LLM_MAX_TOKENS (3000) the output cap; STRUCT_ASSISTANT_PER_DAY (20) questions a day one account
//   may ask (in memory, per instance; the USD budgets stay the hard stop); STRUCT_ASSISTANT=off or STRUCT_LLM_STOP=1 stops it.
'use strict';
const crypto = require('node:crypto');
const S = require('./_session.js');
const LLM = require('./_academy-llm.js');
const ST = require('./_academy-store.js');
const M = require('./_structure-assistant.js');

const ANSWERS = 'answers.json', KEEP = 300, MAX_OUT = 3000, PER_DAY = 20, BODY_MAX = 120000;
const PROVIDER_KEYS = ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'], PROVIDER_URL = 'https://api.anthropic.com/v1/messages';
const rootOf = (env) => (env.VERCEL_ENV && env.VERCEL_ENV !== 'production' ? 'structure-assistant-preview/' : 'structure-assistant/');
const TAILS = new Map();   // one lock map per function instance (the store's rule)
const storeOf = (env, io = {}) => ST.make(ST.blobBackend(env, { ...io, root: rootOf(env) }), TAILS);
const off = (env) => /^off$/i.test(String(env.STRUCT_ASSISTANT || ''));
const stopped = (env) => /^(1|true|yes|on)$/i.test(String(env.STRUCT_LLM_STOP || ''));
function llmEnv(env) {
  const own = env.STRUCT_LLM_KEY || env.ACADEMY_LLM_KEY, alt = PROVIDER_KEYS.map((k) => env[k]).find(Boolean), key = own || alt || '';
  const url = env.STRUCT_LLM_URL || env.ACADEMY_LLM_URL || (!own && alt ? PROVIDER_URL : '');
  const format = env.STRUCT_LLM_FORMAT || env.ACADEMY_LLM_FORMAT || (!own && alt ? 'messages' : '');
  const out = { ...env, ACADEMY_LLM_KEY: key, ACADEMY_LLM_URL: url, ACADEMY_LLM_FORMAT: format,
    ACADEMY_LLM_DAILY_USD: env.STRUCT_LLM_DAILY_USD || '0.5', ACADEMY_LLM_MONTHLY_USD: env.STRUCT_LLM_MONTHLY_USD || '5',
    ACADEMY_LLM_HARD_USD: env.STRUCT_LLM_HARD_USD || '25', ACADEMY_LLM_MAX_CALLS_DAY: env.STRUCT_LLM_MAX_CALLS_DAY || '60',
    ACADEMY_LLM_STOP: off(env) || stopped(env) ? '1' : '' };
  const model = String(env.STRUCT_LLM_MODEL || env.ACADEMY_LLM_MODEL || '').trim(); if (model) out.ACADEMY_LLM_MODEL = model;
  return out;
}
const perDay = (env) => { const x = Math.round(Number(env.STRUCT_ASSISTANT_PER_DAY)); return String(env.STRUCT_ASSISTANT_PER_DAY == null ? '' : env.STRUCT_ASSISTANT_PER_DAY) !== '' && Number.isFinite(x) && x >= 0 ? Math.min(200, x) : PER_DAY; };
const CALLS = new Map();
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const used = (u, ms) => CALLS.get(`${u}|${dayOf(ms)}`) || 0;
function count(u, ms) { const k = `${u}|${dayOf(ms)}`; CALLS.set(k, (CALLS.get(k) || 0) + 1); if (CALLS.size > 2000) for (const key of CALLS.keys()) { if (!key.endsWith(dayOf(ms))) CALLS.delete(key); } }
// the provider's own words go to the owner only (the 20 Nov 2026 review's rule for the coach)
function errText(ans, owner) {
  const plain = ans.partial != null ? 'The answer broke off. Try again in a minute.' : 'The assistant could not be reached. Try again in a minute.';
  if (!owner) return plain;
  if (ans.status === 401 || ans.status === 403) return `The provider did not accept the key (${ans.status}). Check STRUCT_LLM_KEY / ACADEMY_LLM_KEY.`;
  if (ans.status >= 400 && ans.status < 500 && ans.status !== 408 && ans.status !== 429) return `The provider refused the request (${ans.status}${ans.errorType ? ` ${ans.errorType}` : ''})${ans.detail ? `: ${ans.detail}` : ''}. Check STRUCT_LLM_MODEL.`;
  return plain;
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || storeOf(env), clock = d.now || Date.now, nowMs = clock();
  let streaming = false;
  try {
    const acct = await (d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 })))(req);
    if (!acct) return res.status(401).json({ error: 'sign in first' });
    const lim = perDay(env), C = LLM.config(llmEnv(env)), why = off(env) ? 'switched off (STRUCT_ASSISTANT=off)' : LLM.unavailable(C) || (C.stop ? 'stopped (STRUCT_LLM_STOP)' : null);
    if (req.method === 'GET') {
      const cost = await LLM.status({ env: llmEnv(env), store, now: () => nowMs });
      return res.status(200).json({ enabled: !why, reason: why, perDay: lim, leftToday: Math.max(0, lim - used(acct.u, nowMs)),
        cost: { today: cost.today.usd, month: cost.month.usd, total: cost.total.usd, budgets: cost.budgets, callsLeftToday: cost.calls.leftToday } });
    }
    let b = req.body;
    if (typeof b === 'string') { if (b.length > BODY_MAX) return res.status(413).json({ error: 'too much data' }); try { b = JSON.parse(b || '{}'); } catch (e) { return res.status(400).json({ error: 'bad JSON' }); } }
    else if (b && JSON.stringify(b).length > BODY_MAX) return res.status(413).json({ error: 'too much data' });
    let q; try { q = M.buildRequest(b, nowMs / 1000); } catch (e) { return res.status(e.status || 400).json({ error: String(e.message || 'bad request').slice(0, 120) }); }
    if (why) return res.status(200).json({ state: 'off', message: why });
    const h = crypto.createHash('sha256').update(JSON.stringify([acct.u, q.system, q.prompt])).digest('hex').slice(0, 40);
    const doc = await store.get(ANSWERS, { v: 1, rows: [] }), old = (doc.rows || []).find((r) => r && r.h === h);
    if (old) {
      if (old.answer) return res.status(200).json({ state: 'ok', answer: old.answer, provider: old.provider, model: old.model, cached: true });
      return res.status(200).json({ state: 'refused', message: 'The answer to this question did not pass the checks, and it is not asked again.', why: old.refused || [] });
    }
    if (used(acct.u, nowMs) >= lim) return res.status(200).json({ state: 'limit', message: `You have asked ${lim} times today: ask again tomorrow (UTC).` });
    count(acct.u, nowMs);
    const ask = { system: q.system, prompt: q.prompt, cap: 'feature', maxTokens: LLM.featureCap(env.STRUCT_LLM_MAX_TOKENS, MAX_OUT), long: true, cacheSystem: true, schema: q.schema, schemaName: 'structure_reading' };
    const io = { env: llmEnv(env), store, now: d.now, fetch: d.fetch };
    const send = (o) => { try { res.write(`data: ${JSON.stringify(o)}\n\n`); } catch (e) { /* the page went away; the call still ends and is stored */ } };
    const t0 = clock();
    let ans;
    if (b && b.stream === true) {
      streaming = true; res.statusCode = 200; res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('X-Accel-Buffering', 'no');
      send({ t: 'start' });
      ans = await (d.stream || LLM.stream)(ask, io, (piece) => send({ t: 'text', d: piece }));
    } else ans = await (d.complete || LLM.complete)(ask, io);
    ans = LLM.cutAtCap(ans, 'STRUCT_LLM_MAX_TOKENS');
    const ms = ans && ans.ms ? ans.ms : { first: null, total: clock() - t0 };
    const out = await finish(ans, { q, h, acct, store, nowMs, ms });
    if (streaming) { send({ t: 'done', ...out }); return res.end(); }
    return res.status(200).json(out);
  } catch (e) {
    if (streaming) { try { res.write(`data: ${JSON.stringify({ t: 'done', state: 'error', message: 'The assistant is unavailable.' })}\n\n`); } catch (er) { /* gone */ } return res.end(); }
    return res.status(e && e.status === 503 ? 503 : 500).json({ error: 'the assistant is unavailable' });
  }
}
async function finish(ans, { q, h, acct, store, nowMs, ms }) {
  if (!ans || !ans.available) return { state: 'off', message: (ans && ans.reason) || 'the assistant is off' };
  if (ans.skipped === 'budget') { const w = ans.scope === 'day' || ans.scope === 'calls' ? 'daily' : ans.scope === 'month' ? 'monthly' : 'total'; return { state: 'budget', scope: ans.scope, message: `The assistant's ${w} budget is used up.` }; }
  if (ans.skipped) return { state: 'error', message: ans.skipped === 'too-long' ? 'Too much to send in one question.' : 'Nothing to ask.' };
  const billed = !!(ans.error && (ans.usage || ans.costEstimated || ans.costUsd > 0));
  if (ans.error && !billed) return { state: 'error', message: errText(ans, acct.u === 'owner'), ms };
  if (ans.error && ans.partial != null && !ans.cut) return { state: 'error', message: errText(ans, acct.u === 'owner'), ms };
  const p = billed ? { ok: false, why: [String(ans.error).slice(0, 160)] } : M.parseAnswer(ans.text, q);
  const row = { h, u: acct.u, market: q.market, at: new Date(nowMs).toISOString(), provider: ans.provider || null, model: ans.model || null, costUsd: ans.costUsd || 0, ms: { first: ms.first, total: ms.total },
    ...(p.ok ? { answer: p.answer } : { refused: p.why }) };
  await store.update(ANSWERS, { v: 1, rows: [] }, (D) => ({ v: 1, rows: (Array.isArray(D && D.rows) ? D.rows : []).filter((r) => r && r.h !== h).concat(row).slice(-KEEP) }));
  if (p.ok) return { state: 'ok', answer: p.answer, provider: row.provider, model: row.model, cached: !!ans.cached, ms };
  return { state: 'refused', message: 'The answer did not pass the checks, so it is not shown. It is not asked again.', why: p.why, ms };
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.llmEnv = llmEnv;
module.exports.storeOf = storeOf;
module.exports.MAX_OUT = MAX_OUT;
module.exports.PER_DAY = PER_DAY;
module.exports._calls = CALLS;
