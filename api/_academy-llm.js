// MeridianX Academy: the OPTIONAL language-model adapter (module, not an endpoint). OFF by default: without env ACADEMY_LLM_KEY
// nothing here ever touches the network and every caller is told "not available" (never a made-up answer).
//
// Two callers: the commentary route (`explain`) and the analyst route (`analyse`, api/_academy-analyst.js builds and checks
// its request and answer). Neither changes a statistic of the deterministic engine: the analyst's answers are stored apart
// and labelled (docs/academy/LLM.md). No model name is written in the repo: the model id comes from the environment only.
//
//   ACADEMY_LLM_KEY            the key; unset = the adapter is off
//   ACADEMY_LLM_URL            the HTTPS endpoint the request is POSTed to
//   ACADEMY_LLM_MODEL          the model id sent in the request body
//   ACADEMY_LLM_FORMAT         the wire format:
//                                'chat' (default)  { model, messages: [system, user], max_tokens }, key as "Authorization: Bearer <key>",
//                                                  answer in choices[0].message.content, usage.prompt_tokens / completion_tokens
//                                'messages'        { model, max_tokens, system, messages: [user] }, key in "x-api-key", an API version
//                                                  header, answer in content[] text blocks, usage.input_tokens / output_tokens
//   ACADEMY_LLM_AUTH_HEADER    header that carries the key (default by format; "Authorization" is sent as "Bearer <key>", any other bare)
//   ACADEMY_LLM_API_VERSION    'messages' only: the value of the API version header (default API_VERSION below)
//   ACADEMY_LLM_HEADERS        optional JSON object of extra request headers
//   ACADEMY_LLM_BODY           optional JSON object of extra request body fields the provider documents (it can never replace the
//                              model, the messages, the system text or the output cap, and can never switch streaming on)
//   ACADEMY_LLM_MAX_TOKENS_FIELD  'chat' only: 'max_tokens' (default) or 'max_completion_tokens' (providers that dropped the first)
//   ACADEMY_LLM_SYSTEM_ROLE    'chat' only: 'system' (default) or 'developer'
//   ACADEMY_LLM_JSON_SCHEMA=1  also send the caller's answer schema in the format's own structured-output field (off by default)
//   ACADEMY_LLM_PROVIDER       a label shown beside every answer (default: the endpoint's host name)
//   ACADEMY_LLM_DAILY_USD      daily budget (default 0.50)      ACADEMY_LLM_MONTHLY_USD   monthly budget (default 5)
//   ACADEMY_LLM_HARD_USD       lifetime hard stop (default 25)  ACADEMY_LLM_STOP=1        kill switch: no call at all
//   ACADEMY_LLM_MAX_CALLS_DAY  provider calls a day, all routes together (default 20)
//   ACADEMY_LLM_USD_PER_MTOK_IN / _OUT   price per million tokens (defaults 10 / 50: high on purpose, so the ledger over-counts
//                              until the owner sets the provider's real prices)
//   ACADEMY_LLM_USD_PER_MTOK_CACHE_READ / _CACHE_WRITE   price of input tokens the provider reports as read from / written to
//                              its prompt cache (defaults: the input price / twice the input price)
//   ACADEMY_LLM_MAX_TOKENS     output cap per commentary call (default 700)
//   ACADEMY_LLM_ANALYST_MAX_TOKENS   output cap per analyst call (default 4000; a model that reasons before answering spends
//                              output tokens on that too)
//   ACADEMY_LLM_TIMEOUT_MS     time allowed for one call, retries included (default 45000)
//   ACADEMY_LLM_RETRIES        retries after a 408 / 429 / 5xx / 529 answer or a failed connection (default 1, at most 3)
//
// Before every call: tokens are estimated (characters / 4), the cost ledger in the store (cost.json: per-day and per-month spend
// and request counts) is checked against the budgets and the daily call cap, and the estimated cost is RESERVED in the ledger in
// the same locked step (two calls cannot both squeeze under the limit). Answers are cached by a hash of the prompt
// (llm-cache.json, capped) and identical requests in flight share one call. After the call the reservation is corrected to the
// usage the provider reports (never a price per model in this file: prices come from the environment), or kept as the estimate
// when it reports none. A call the provider refused (an HTTP error) is not billed and gives its reservation back. A call that
// timed out may have been billed: its estimate stays in the ledger. Out of budget -> { skipped: 'budget' }, no call.
// The key is sent in one request header and nowhere else: it is cut out of every error text before it is returned.
'use strict';
const crypto = require('node:crypto');

const CACHE_KEY = 'llm-cache.json', COST_KEY = 'cost.json', CACHE_MAX = 200, PROMPT_MAX = 24000, PROMPT_MAX_LONG = 80000, TEXT_MAX = 20000;
const API_VERSION = '2026-10-21', VERSION_HEADER = 'anthropic-version';   // the 'messages' wire format needs a version header on every request
const RETRY_STATUS = [408, 429, 500, 502, 503, 504, 529], RETRY_WAIT_MS = 400, RETRY_AFTER_MAX_S = 8;
const RESERVED_BODY = ['model', 'messages', 'system', 'stream', 'max_tokens', 'max_completion_tokens', 'n'];
const FAKE_PROVIDER = 'fake-test';   // reserved: only a dependency injected by the local dev server or a test may carry this label
const INFLIGHT = new Map();   // prompt hash -> the promise of the one call in flight
const pos = (v, d) => { const x = Number(v); return v != null && v !== '' && Number.isFinite(x) && x >= 0 ? x : d; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const on = (v) => /^(1|true|yes|on)$/i.test(String(v || ''));
const estimateTokens = (s) => Math.ceil(String(s == null ? '' : s).length / 4);

function config(env = process.env) {
  const json = (v) => { try { const j = v ? JSON.parse(v) : {}; return isObj(j) ? j : {}; } catch (e) { return {}; } };
  const key = String(env.ACADEMY_LLM_KEY || '').trim(), url = String(env.ACADEMY_LLM_URL || '').trim(), model = String(env.ACADEMY_LLM_MODEL || '').trim();
  const format = env.ACADEMY_LLM_FORMAT === 'messages' ? 'messages' : 'chat', inPrice = pos(env.ACADEMY_LLM_USD_PER_MTOK_IN, 10);
  let host = ''; try { host = new URL(url).hostname; } catch (e) { host = ''; }
  const label = String(env.ACADEMY_LLM_PROVIDER || '').replace(/[^\w .:/-]/g, '').trim().slice(0, 60);
  return { key, url, model, enabled: !!(key && /^https:\/\//i.test(url) && model), format,
    authHeader: String(env.ACADEMY_LLM_AUTH_HEADER || (format === 'messages' ? 'x-api-key' : 'Authorization')).trim() || 'Authorization', extra: json(env.ACADEMY_LLM_HEADERS), body: json(env.ACADEMY_LLM_BODY),
    apiVersion: format === 'messages' ? String(env.ACADEMY_LLM_API_VERSION || API_VERSION).trim() : '',
    tokensField: format === 'chat' && env.ACADEMY_LLM_MAX_TOKENS_FIELD === 'max_completion_tokens' ? 'max_completion_tokens' : 'max_tokens',
    systemRole: format === 'chat' && env.ACADEMY_LLM_SYSTEM_ROLE === 'developer' ? 'developer' : 'system', jsonSchema: on(env.ACADEMY_LLM_JSON_SCHEMA),
    provider: label && label !== FAKE_PROVIDER ? label : host && host !== FAKE_PROVIDER ? host : 'provider not named',
    daily: pos(env.ACADEMY_LLM_DAILY_USD, 0.5), monthly: pos(env.ACADEMY_LLM_MONTHLY_USD, 5), hard: pos(env.ACADEMY_LLM_HARD_USD, 25), stop: on(env.ACADEMY_LLM_STOP),
    maxCallsDay: Math.round(pos(env.ACADEMY_LLM_MAX_CALLS_DAY, 20)),
    inPrice, outPrice: pos(env.ACADEMY_LLM_USD_PER_MTOK_OUT, 50), cacheReadPrice: pos(env.ACADEMY_LLM_USD_PER_MTOK_CACHE_READ, inPrice), cacheWritePrice: pos(env.ACADEMY_LLM_USD_PER_MTOK_CACHE_WRITE, inPrice * 2),
    maxOut: clamp(pos(env.ACADEMY_LLM_MAX_TOKENS, 700), 16, 4000), analystMaxOut: clamp(pos(env.ACADEMY_LLM_ANALYST_MAX_TOKENS, 4000), 256, 16000),
    timeoutMs: clamp(pos(env.ACADEMY_LLM_TIMEOUT_MS, 45000), 2000, 55000), retries: clamp(pos(env.ACADEMY_LLM_RETRIES, 1), 0, 3) };
}
// why the adapter cannot answer, or null when it is switched on
function unavailable(C) {
  if (!C.key) return 'no language-model key configured';
  if (!C.url || !C.model) return 'the language-model endpoint or model name is not configured';
  if (!/^https:\/\//i.test(C.url)) return 'the language-model endpoint must be an https address';
  return null;
}
// the label shown beside an answer: the injected one (the local fake), else the configured one
const providerOf = (C, d) => (d && typeof d.provider === 'string' && d.provider ? d.provider : C.provider);

// ---- the cost ledger ----------------------------------------------------------------------------------------------------
const bucket = () => ({ usd: 0, requests: 0, tokensIn: 0, tokensOut: 0, cacheHits: 0, skipped: 0, errors: 0, retries: 0, unconfirmed: 0 });
const emptyLedger = () => ({ v: 1, days: {}, months: {}, total: bucket(), updatedAt: null });
function ledgerOf(L) { const o = L && typeof L === 'object' && !Array.isArray(L) ? L : emptyLedger(); o.days = o.days || {}; o.months = o.months || {}; o.total = { ...bucket(), ...(o.total || {}) }; return o; }
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
// add to today's, this month's and the lifetime bucket
function bump(L, now, d) {
  const day = dayOf(now), mon = day.slice(0, 7);
  for (const b of [(L.days[day] = { ...bucket(), ...(L.days[day] || {}) }), (L.months[mon] = { ...bucket(), ...(L.months[mon] || {}) }), L.total])
    for (const k of Object.keys(d)) b[k] = k === 'usd' ? Math.max(0, r6((b[k] || 0) + d[k])) : Math.max(0, (b[k] || 0) + d[k]);
  L.updatedAt = new Date(now).toISOString(); return L;
}
// which limit (if any) a call of this estimated cost would break: the kill switch and the lifetime stop, the day, the month, the calls a day
function over(L, C, now, est) {
  const day = dayOf(now), d = L.days[day] || bucket(), m = L.months[day.slice(0, 7)] || bucket();
  if (C.stop || L.total.usd + est > C.hard + 1e-12) return 'hard-stop';
  if (d.usd + est > C.daily + 1e-12) return 'day';
  if (m.usd + est > C.monthly + 1e-12) return 'month';
  if (C.maxCallsDay != null && (d.requests || 0) + 1 > C.maxCallsDay) return 'calls';
  return null;
}
// the estimated cost of one call before it is made: the prompt at the input price, the whole output cap at the output price
function estimate(C, system, prompt, maxOut) { const tokensIn = estimateTokens(system) + estimateTokens(prompt); return { tokensIn, maxTokensOut: maxOut, usd: r6((tokensIn * C.inPrice + maxOut * C.outPrice) / 1e6) }; }
// the ledger and budgets as the page shows them (GET ?get=cost)
async function status(d = {}) {
  const env = d.env || process.env, C = config(env), now = d.now ? d.now() : Date.now(), L = ledgerOf(await d.store.get(COST_KEY, emptyLedger())), day = dayOf(now), mon = day.slice(0, 7);
  const today = { ...bucket(), ...(L.days[day] || {}) }, month = { ...bucket(), ...(L.months[mon] || {}) }, off = unavailable(C);
  return { enabled: !off, reason: off, provider: off ? null : providerOf(C, d), fake: !off && providerOf(C, d) === FAKE_PROVIDER, format: off ? null : C.format,
    budgets: { dailyUsd: C.daily, monthlyUsd: C.monthly, hardUsd: C.hard, stop: C.stop }, calls: { maxPerDay: C.maxCallsDay, today: today.requests || 0, leftToday: Math.max(0, C.maxCallsDay - (today.requests || 0)) },
    prices: { usdPerMTokIn: C.inPrice, usdPerMTokOut: C.outPrice, usdPerMTokCacheRead: C.cacheReadPrice, usdPerMTokCacheWrite: C.cacheWritePrice, maxTokens: C.maxOut, analystMaxTokens: C.analystMaxOut },
    today, month, total: L.total, remaining: { dayUsd: Math.max(0, r6(C.daily - today.usd)), monthUsd: Math.max(0, r6(C.monthly - month.usd)), hardUsd: Math.max(0, r6(C.hard - L.total.usd)) },
    days: L.days, months: L.months, updatedAt: L.updatedAt };
}

// ---- the request and the answer, per wire format ---------------------------------------------------------------------------
// q = { system, prompt, maxOut, schema?, schemaName? }
function request(C, q, legacyPrompt, legacyMaxOut) {
  if (typeof q === 'string' || q == null) q = { system: q || '', prompt: legacyPrompt, maxOut: legacyMaxOut };   // request(C, system, prompt, maxOut): the older call shape
  const headers = { 'Content-Type': 'application/json', ...C.extra };
  headers[C.authHeader] = /^authorization$/i.test(C.authHeader) ? `Bearer ${C.key}` : C.key;
  if (C.apiVersion && !Object.keys(headers).some((h) => h.toLowerCase() === VERSION_HEADER)) headers[VERSION_HEADER] = C.apiVersion;
  const more = { ...(C.body || {}) }; for (const k of RESERVED_BODY) delete more[k];
  let body;
  if (C.format === 'messages') {
    body = { ...more, model: C.model, max_tokens: q.maxOut, ...(q.system ? { system: q.system } : {}), messages: [{ role: 'user', content: q.prompt }] };
    if (q.schema && C.jsonSchema) body.output_config = { ...(isObj(more.output_config) ? more.output_config : {}), format: { type: 'json_schema', schema: q.schema } };
  } else {
    body = { ...more, model: C.model, [C.tokensField || 'max_tokens']: q.maxOut, messages: [...(q.system ? [{ role: C.systemRole || 'system', content: q.system }] : []), { role: 'user', content: q.prompt }] };
    if (q.schema && C.jsonSchema) body.response_format = { type: 'json_schema', json_schema: { name: q.schemaName || 'answer', strict: true, schema: q.schema } };
  }
  return { headers, body: JSON.stringify(body) };
}
// The answer text, why the model stopped and the token usage, out of either response shape.
//   stop: 'end' (a finished answer) | 'length' (cut off at the output cap) | 'refusal' (the provider or the model declined) | 'other' | null (not said)
//   tokensIn counts every input token billed; cacheRead / cacheWrite are the parts of it the provider prices differently.
function parse(j) {
  let text = '', raw = null, refusal = null;
  if (j && Array.isArray(j.choices) && j.choices[0]) {
    const c = j.choices[0], m = c.message || {}; raw = c.finish_reason == null ? null : String(c.finish_reason);
    text = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('') : typeof c.text === 'string' ? c.text : '';
    if (typeof m.refusal === 'string' && m.refusal) refusal = m.refusal;
  } else if (j && Array.isArray(j.content)) {
    text = j.content.map((p) => (p && p.type === 'text' && typeof p.text === 'string' ? p.text : '')).join(''); raw = j.stop_reason == null ? null : String(j.stop_reason);
    if (raw === 'refusal') refusal = (j.stop_details && (j.stop_details.explanation || j.stop_details.category)) || 'refusal';
  } else if (j && typeof j.output_text === 'string') text = j.output_text;
  const u = (j && j.usage) || {}, n = (v) => { const x = Number(v); return v != null && Number.isFinite(x) && x >= 0 ? x : null; };
  let tin = null, cacheRead = 0, cacheWrite = 0;
  if (u.input_tokens != null) { cacheRead = n(u.cache_read_input_tokens) || 0; cacheWrite = n(u.cache_creation_input_tokens) || 0; const base = n(u.input_tokens); tin = base == null ? null : base + cacheRead + cacheWrite; }   // reported beside input_tokens, not inside it
  else if (u.prompt_tokens != null) { tin = n(u.prompt_tokens); cacheRead = Math.min(tin || 0, n(u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0); }   // reported inside prompt_tokens
  const tout = n(u.output_tokens != null ? u.output_tokens : u.completion_tokens);   // reasoning tokens are part of both counts
  const stop = refusal ? 'refusal' : raw == null ? null : ['end_turn', 'stop', 'stop_sequence'].includes(raw) ? 'end' : ['max_tokens', 'length', 'model_context_window_exceeded'].includes(raw) ? 'length' : ['refusal', 'content_filter'].includes(raw) ? 'refusal' : 'other';
  return { text: String(text || '').trim().slice(0, TEXT_MAX), tokensIn: tin, tokensOut: tout, cacheRead, cacheWrite, stop, stopRaw: raw, refusal: refusal ? String(refusal).slice(0, 300) : null, model: j && typeof j.model === 'string' ? j.model.slice(0, 120) : null };
}
const costOf = (C, u) => r6(((u.tokensIn - u.cacheRead - u.cacheWrite) * C.inPrice + u.cacheRead * C.cacheReadPrice + u.cacheWrite * C.cacheWritePrice + u.tokensOut * C.outPrice) / 1e6);
// an error body in either shape: { error: { type, message, code } } (also { type: 'error', error: {…} }) -> { type, message }
function errorOf(j) { const e = j && isObj(j.error) ? j.error : null; return e ? { type: typeof e.type === 'string' ? e.type : typeof e.code === 'string' ? e.code : null, message: typeof e.message === 'string' ? e.message : null } : { type: null, message: j && typeof j.error === 'string' ? j.error : null }; }
const header = (r, name) => { try { return r && r.headers && typeof r.headers.get === 'function' ? r.headers.get(name) : null; } catch (e) { return null; } };

// One call with a bounded retry. A 408 / 429 / 5xx / 529 answer or a failed connection is tried again (C.retries times, inside
// the one time limit), waiting for Retry-After when the provider names a short one. A retry reserves nothing more: the first
// reservation stands for the whole call. -> { ok, j, attempts } | { ok: false, status, type, message, retryAfterS, billed, timeout, attempts }
async function send(C, rq, d) {
  const F = d.fetch || fetch, sleep = d.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))), t0 = Date.now(), left = () => C.timeoutMs - (Date.now() - t0);
  let last = { ok: false, status: 0, type: null, message: null, retryAfterS: null, billed: false, timeout: false }, attempts = 0;
  for (let n = 0; n <= C.retries; n++) {
    if (left() < 500) break;
    attempts++;
    let r;
    try { r = await F(C.url, { method: 'POST', headers: rq.headers, body: rq.body, signal: AbortSignal.timeout(Math.max(500, left())) }); }
    catch (e) {
      const timeout = !!e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      last = { ok: false, status: 0, type: timeout ? 'timeout' : 'network', message: null, retryAfterS: null, billed: timeout, timeout };   // a request that timed out was sent: it may be billed
      if (timeout) break;
      if (n < C.retries) await sleep(Math.min(RETRY_WAIT_MS * 2 ** n, Math.max(0, left() - 500)));
      continue;
    }
    if (r && r.ok) { try { return { ok: true, j: await r.json(), attempts, requestId: header(r, 'request-id') || header(r, 'x-request-id') }; } catch (e) { return { ok: false, status: r.status || 200, type: 'unreadable', message: null, retryAfterS: null, billed: true, timeout: false, attempts }; } }
    let j = null; try { j = r && typeof r.json === 'function' ? await r.json() : null; } catch (e) { j = null; }
    const err = errorOf(j), status = (r && r.status) || 0, ra = parseFloat(header(r, 'retry-after'));
    last = { ok: false, status, type: err.type, message: err.message, retryAfterS: Number.isFinite(ra) && ra >= 0 ? ra : null, billed: false, timeout: false, requestId: header(r, 'request-id') || header(r, 'x-request-id') || (j && typeof j.request_id === 'string' ? j.request_id : null) };
    if (!RETRY_STATUS.includes(status) || n >= C.retries) break;
    if (last.retryAfterS != null && last.retryAfterS > RETRY_AFTER_MAX_S) break;   // a long wait is the owner's call, not a silent one
    const wait = last.retryAfterS != null ? last.retryAfterS * 1000 : RETRY_WAIT_MS * 2 ** n;
    if (wait > left() - 500) break;
    await sleep(wait);
  }
  return { ...last, attempts };
}

// complete({ system, prompt, maxTokens, cap?: 'analyst', long?, schema?, schemaName?, fresh? }, { env, store, fetch, now, sleep, provider }) ->
//   { available: false, reason }                                     the adapter is off (no key / endpoint): no call, no ledger write
//   { available: true, skipped: 'budget', scope: 'day'|'month'|'hard-stop'|'calls' }   over a limit: no call
//   { available: true, skipped: 'too-long' | 'empty' }               nothing sent
//   { available: true, error, status?, errorType?, detail?, retryAfterS?, attempts }   the call failed (not billed: the reservation is given back;
//                                                                    timed out or unreadable: the estimate stays, costUsd says so)
//   { available: true, text, stop, cached, deduped?, usage: { tokensIn, tokensOut, estimated }, costUsd, provider, model }
//   fresh: true skips the answer cache (a new call is made and billed).
async function complete(req, d = {}) {
  const env = d.env || process.env, C = config(env), why = unavailable(C);
  if (why) return { available: false, reason: why };
  const store = d.store; if (!store) throw new Error('the adapter needs the store for its cost ledger');
  const system = String((req && req.system) || ''), prompt = String((req && req.prompt) || '').trim();
  if (!prompt) return { available: true, skipped: 'empty' };
  const limit = req && req.long ? PROMPT_MAX_LONG : PROMPT_MAX;
  if (system.length + prompt.length > limit) return { available: true, skipped: 'too-long', limitChars: limit };
  const top = req && req.cap === 'analyst' ? C.analystMaxOut : C.maxOut, maxOut = Math.max(16, Math.min(top, Math.round(pos(req && req.maxTokens, top))));
  const schema = req && isObj(req.schema) ? req.schema : null;
  const h = crypto.createHash('sha256').update(JSON.stringify([C.url, C.model, C.format, system, prompt, maxOut, schema && C.jsonSchema ? 1 : 0])).digest('hex').slice(0, 40);
  if (INFLIGHT.has(h)) return INFLIGHT.get(h).then((r) => (r && r.text != null ? { ...r, deduped: true } : r));
  const p = run(C, { system, prompt, maxOut, h, schema, schemaName: req && req.schemaName, fresh: !!(req && req.fresh) }, d).finally(() => INFLIGHT.delete(h));
  INFLIGHT.set(h, p); return p;
}
async function run(C, q, d) {
  const store = d.store, clock = d.now || Date.now, provider = providerOf(C, d);
  const clean = (s) => (s == null ? null : String(s).split(C.key).join('[key removed]').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300));
  if (!q.fresh) {
    const cache = await store.get(CACHE_KEY, { v: 1, rows: [] }), hit = cache && Array.isArray(cache.rows) ? cache.rows.find((r) => r && r.h === q.h) : null;
    if (hit) { await store.update(COST_KEY, emptyLedger(), (L) => bump(ledgerOf(L), clock(), { cacheHits: 1 })); return { available: true, text: hit.text, stop: hit.stop || null, cached: true, usage: hit.usage || null, costUsd: 0, provider: hit.provider || provider, model: hit.model || null }; }
  }
  const E = estimate(C, q.system, q.prompt, q.maxOut), estIn = E.tokensIn, est = E.usd;
  let scope = null;
  await store.update(COST_KEY, emptyLedger(), (raw) => { const L = ledgerOf(raw), now = clock(); scope = over(L, C, now, est); return scope ? bump(L, now, { skipped: 1 }) : bump(L, now, { usd: est, requests: 1 }); });
  if (scope) return { available: true, skipped: 'budget', scope, estimateUsd: est };
  const out0 = await send(C, request(C, q), d);
  if (!out0.ok) {
    const more = { ...(out0.attempts > 1 ? { retries: out0.attempts - 1 } : {}) };
    const base = { available: true, status: out0.status, ...(out0.type ? { errorType: clean(out0.type) } : {}), ...(out0.message ? { detail: clean(out0.message) } : {}), ...(out0.retryAfterS != null ? { retryAfterS: out0.retryAfterS } : {}), ...(out0.requestId ? { requestId: clean(out0.requestId) } : {}), attempts: out0.attempts, provider };   // requestId: the provider's own id of the failed request, for its support
    if (out0.billed) {   // sent, and its cost is not known: the estimate stays in the ledger rather than under-counting
      await store.update(COST_KEY, emptyLedger(), (L) => bump(ledgerOf(L), clock(), { errors: 1, unconfirmed: 1, ...more }));
      return { ...base, error: out0.timeout ? 'the language-model call timed out' : 'the language model returned an answer that could not be read', costUsd: est, costEstimated: true };
    }
    await store.update(COST_KEY, emptyLedger(), (L) => bump(ledgerOf(L), clock(), { usd: -est, requests: -1, errors: 1, ...more }));
    return { ...base, error: 'the language-model call failed' };
  }
  const out = parse(out0.j);
  // the call was made: charge what the provider reports, or the estimate when it reports nothing
  const tokensIn = out.tokensIn != null ? out.tokensIn : estIn, tokensOut = out.tokensOut != null ? out.tokensOut : estimateTokens(out.text), estimated = out.tokensIn == null || out.tokensOut == null;
  const cost = costOf(C, { tokensIn, tokensOut, cacheRead: out.tokensIn != null ? out.cacheRead : 0, cacheWrite: out.tokensIn != null ? out.cacheWrite : 0 });
  await store.update(COST_KEY, emptyLedger(), (L) => bump(ledgerOf(L), clock(), { usd: cost - est, tokensIn, tokensOut, ...(out.text ? {} : { errors: 1 }), ...(out0.attempts > 1 ? { retries: out0.attempts - 1 } : {}) }));
  const usage = { tokensIn, tokensOut, estimated, ...(out.cacheRead ? { cacheRead: out.cacheRead } : {}), ...(out.cacheWrite ? { cacheWrite: out.cacheWrite } : {}) };
  if (!out.text) return { available: true, error: out.stop === 'refusal' ? 'the provider declined to answer' : out.stop === 'length' ? 'the answer was cut off at the output cap before any text' : 'the language model returned no text', status: 200, stop: out.stop, ...(out.refusal ? { detail: clean(out.refusal) } : {}), usage, costUsd: cost, provider, model: out.model };
  await store.update(CACHE_KEY, { v: 1, rows: [] }, (c) => { const rows = (c && Array.isArray(c.rows) ? c.rows : []).filter((r) => r && r.h !== q.h).concat({ h: q.h, at: new Date(clock()).toISOString(), text: out.text, usage, stop: out.stop, provider, model: out.model }); return { v: 1, rows: rows.slice(-CACHE_MAX) }; });
  return { available: true, text: out.text, stop: out.stop, cached: false, usage, costUsd: cost, provider, model: out.model, ...(out0.attempts > 1 ? { attempts: out0.attempts } : {}) };
}

module.exports = { config, unavailable, providerOf, estimateTokens, estimate, complete, status, emptyLedger, COST_KEY, CACHE_KEY, API_VERSION, VERSION_HEADER, FAKE_PROVIDER, PROMPT_MAX, PROMPT_MAX_LONG, _inflight: INFLIGHT, _t: { parse, request, over, bump, ledgerOf, send, errorOf, costOf } };
