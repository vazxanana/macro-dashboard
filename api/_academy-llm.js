// MeridianX Academy: the OPTIONAL language-model adapter (module, not an endpoint). OFF by default: without env ACADEMY_LLM_KEY
// nothing here ever touches the network and every caller is told "not available" (never a made-up answer).
//
// It is commentary only (a plain-English explanation for the mentor). It is never in the decision path and never changes a
// certified statistic: decisions, lessons, grading and risk are deterministic code (docs/academy/ARCHITECTURE.md, section 3).
//
// Everything about the provider comes from the environment; no vendor or model name is written in the repo:
//   ACADEMY_LLM_KEY            the key; unset = the adapter is off
//   ACADEMY_LLM_URL            the HTTPS endpoint the request is POSTed to
//   ACADEMY_LLM_MODEL          the model name sent in the request body
//   ACADEMY_LLM_FORMAT         'chat' (default: { model, messages: [system, user], max_tokens }) or 'messages' ({ model, system, messages: [user], max_tokens })
//   ACADEMY_LLM_AUTH_HEADER    header that carries the key (default Authorization, sent as "Bearer <key>"; any other header gets the bare key)
//   ACADEMY_LLM_HEADERS        optional JSON object of extra request headers
//   ACADEMY_LLM_DAILY_USD      daily budget (default 0.50)      ACADEMY_LLM_MONTHLY_USD   monthly budget (default 5)
//   ACADEMY_LLM_HARD_USD       lifetime hard stop (default 25)  ACADEMY_LLM_STOP=1        kill switch: no call at all
//   ACADEMY_LLM_USD_PER_MTOK_IN / _OUT   price per million tokens (defaults 10 / 50: high on purpose, so the ledger over-counts
//                              until the owner sets the provider's real prices)
//   ACADEMY_LLM_MAX_TOKENS     output cap per call (default 700)
//
// Before every call: tokens are estimated (characters / 4), the cost ledger in the store (cost.json: per-day and per-month spend
// and request counts) is checked against the budgets, and the estimated cost is RESERVED in the ledger in the same locked step
// (two calls cannot both squeeze under the limit). Answers are cached by a hash of the prompt (llm-cache.json, capped) and
// identical requests in flight share one call. After the call the reservation is corrected to the usage the provider reports,
// or kept as the estimate when it reports none. Out of budget -> { skipped: 'budget' }, no call.
'use strict';
const crypto = require('node:crypto');

const CACHE_KEY = 'llm-cache.json', COST_KEY = 'cost.json', CACHE_MAX = 200, PROMPT_MAX = 24000, TEXT_MAX = 20000, TIMEOUT_MS = 20000;
const INFLIGHT = new Map();   // prompt hash -> the promise of the one call in flight
const pos = (v, d) => { const x = Number(v); return v != null && v !== '' && Number.isFinite(x) && x >= 0 ? x : d; };
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const estimateTokens = (s) => Math.ceil(String(s == null ? '' : s).length / 4);

function config(env = process.env) {
  let extra = {}; try { const j = env.ACADEMY_LLM_HEADERS ? JSON.parse(env.ACADEMY_LLM_HEADERS) : {}; if (j && typeof j === 'object' && !Array.isArray(j)) extra = j; } catch (e) { extra = {}; }
  const key = String(env.ACADEMY_LLM_KEY || '').trim(), url = String(env.ACADEMY_LLM_URL || '').trim(), model = String(env.ACADEMY_LLM_MODEL || '').trim();
  return { key, url, model, enabled: !!(key && /^https:\/\//i.test(url) && model), format: env.ACADEMY_LLM_FORMAT === 'messages' ? 'messages' : 'chat',
    authHeader: String(env.ACADEMY_LLM_AUTH_HEADER || 'Authorization').trim() || 'Authorization', extra,
    daily: pos(env.ACADEMY_LLM_DAILY_USD, 0.5), monthly: pos(env.ACADEMY_LLM_MONTHLY_USD, 5), hard: pos(env.ACADEMY_LLM_HARD_USD, 25), stop: /^(1|true|yes|on)$/i.test(String(env.ACADEMY_LLM_STOP || '')),
    inPrice: pos(env.ACADEMY_LLM_USD_PER_MTOK_IN, 10), outPrice: pos(env.ACADEMY_LLM_USD_PER_MTOK_OUT, 50), maxOut: Math.max(16, Math.min(4000, Math.round(pos(env.ACADEMY_LLM_MAX_TOKENS, 700)))) };
}
// why the adapter cannot answer, or null when it is switched on
function unavailable(C) {
  if (!C.key) return 'no language-model key configured';
  if (!C.url || !C.model) return 'the language-model endpoint or model name is not configured';
  if (!/^https:\/\//i.test(C.url)) return 'the language-model endpoint must be an https address';
  return null;
}

// ---- the cost ledger ----------------------------------------------------------------------------------------------------
const bucket = () => ({ usd: 0, requests: 0, tokensIn: 0, tokensOut: 0, cacheHits: 0, skipped: 0, errors: 0 });
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
// which budget (if any) a call of this estimated cost would break
function over(L, C, now, est) {
  const day = dayOf(now), d = L.days[day] || bucket(), m = L.months[day.slice(0, 7)] || bucket();
  if (C.stop || L.total.usd + est > C.hard + 1e-12) return 'hard-stop';
  if (d.usd + est > C.daily + 1e-12) return 'day';
  if (m.usd + est > C.monthly + 1e-12) return 'month';
  return null;
}
// the ledger and budgets as the page shows them (GET ?get=cost)
async function status(d = {}) {
  const env = d.env || process.env, C = config(env), now = d.now ? d.now() : Date.now(), L = ledgerOf(await d.store.get(COST_KEY, emptyLedger())), day = dayOf(now), mon = day.slice(0, 7);
  const today = { ...bucket(), ...(L.days[day] || {}) }, month = { ...bucket(), ...(L.months[mon] || {}) };
  return { enabled: !unavailable(C), reason: unavailable(C), budgets: { dailyUsd: C.daily, monthlyUsd: C.monthly, hardUsd: C.hard, stop: C.stop }, prices: { usdPerMTokIn: C.inPrice, usdPerMTokOut: C.outPrice, maxTokens: C.maxOut },
    today, month, total: L.total, remaining: { dayUsd: Math.max(0, r6(C.daily - today.usd)), monthUsd: Math.max(0, r6(C.monthly - month.usd)), hardUsd: Math.max(0, r6(C.hard - L.total.usd)) },
    days: L.days, months: L.months, updatedAt: L.updatedAt };
}

// ---- the call -------------------------------------------------------------------------------------------------------------
function request(C, system, prompt, maxOut) {
  const headers = { 'Content-Type': 'application/json', ...C.extra };
  headers[C.authHeader] = /^authorization$/i.test(C.authHeader) ? `Bearer ${C.key}` : C.key;
  const body = C.format === 'messages' ? { model: C.model, max_tokens: maxOut, ...(system ? { system } : {}), messages: [{ role: 'user', content: prompt }] }
    : { model: C.model, max_tokens: maxOut, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }] };
  return { headers, body: JSON.stringify(body) };
}
// the answer text and token usage out of either common response shape
function parse(j) {
  let text = '';
  if (j && Array.isArray(j.choices) && j.choices[0]) { const m = j.choices[0].message; text = m && typeof m.content === 'string' ? m.content : Array.isArray(m && m.content) ? m.content.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('') : typeof j.choices[0].text === 'string' ? j.choices[0].text : ''; }
  else if (j && Array.isArray(j.content)) text = j.content.map((p) => (p && p.type === 'text' && typeof p.text === 'string' ? p.text : '')).join('');
  else if (j && typeof j.output_text === 'string') text = j.output_text;
  const u = (j && j.usage) || {}, tin = Number(u.input_tokens != null ? u.input_tokens : u.prompt_tokens), tout = Number(u.output_tokens != null ? u.output_tokens : u.completion_tokens);
  return { text: String(text || '').trim().slice(0, TEXT_MAX), tokensIn: Number.isFinite(tin) && tin >= 0 ? tin : null, tokensOut: Number.isFinite(tout) && tout >= 0 ? tout : null };
}

// complete({ system, prompt, maxTokens }, { env, store, fetch, now }) ->
//   { available: false, reason }                                     the adapter is off (no key / endpoint): no call, no ledger write
//   { available: true, skipped: 'budget', scope: 'day'|'month'|'hard-stop' }   out of budget: no call
//   { available: true, skipped: 'too-long' | 'empty' }               nothing sent
//   { available: true, error, status? }                              the call failed (the reservation is given back)
//   { available: true, text, cached, deduped?, usage: { tokensIn, tokensOut, estimated }, costUsd }
async function complete(req, d = {}) {
  const env = d.env || process.env, C = config(env), why = unavailable(C);
  if (why) return { available: false, reason: why };
  const store = d.store; if (!store) throw new Error('the adapter needs the store for its cost ledger');
  const system = String((req && req.system) || ''), prompt = String((req && req.prompt) || '').trim();
  if (!prompt) return { available: true, skipped: 'empty' };
  if (system.length + prompt.length > PROMPT_MAX) return { available: true, skipped: 'too-long', limitChars: PROMPT_MAX };
  const maxOut = Math.max(16, Math.min(C.maxOut, Math.round(pos(req && req.maxTokens, C.maxOut))));
  const h = crypto.createHash('sha256').update(JSON.stringify([C.url, C.model, C.format, system, prompt, maxOut])).digest('hex').slice(0, 40);
  if (INFLIGHT.has(h)) return INFLIGHT.get(h).then((r) => (r && r.text != null ? { ...r, deduped: true } : r));
  const p = run(C, { system, prompt, maxOut, h }, d).finally(() => INFLIGHT.delete(h));
  INFLIGHT.set(h, p); return p;
}
async function run(C, q, d) {
  const store = d.store, F = d.fetch || fetch, clock = d.now || Date.now;
  const cache = await store.get(CACHE_KEY, { v: 1, rows: [] }), hit = cache && Array.isArray(cache.rows) ? cache.rows.find((r) => r && r.h === q.h) : null;
  if (hit) { await store.update(COST_KEY, emptyLedger(), (L) => bump(ledgerOf(L), clock(), { cacheHits: 1 })); return { available: true, text: hit.text, cached: true, usage: hit.usage || null, costUsd: 0 }; }
  const estIn = estimateTokens(q.system) + estimateTokens(q.prompt), est = r6((estIn * C.inPrice + q.maxOut * C.outPrice) / 1e6);
  let scope = null;
  await store.update(COST_KEY, emptyLedger(), (raw) => { const L = ledgerOf(raw), now = clock(); scope = over(L, C, now, est); return scope ? bump(L, now, { skipped: 1 }) : bump(L, now, { usd: est, requests: 1 }); });
  if (scope) return { available: true, skipped: 'budget', scope, estimateUsd: est };
  const giveBack = (extra) => store.update(COST_KEY, emptyLedger(), (L) => bump(ledgerOf(L), clock(), { usd: -est, requests: -1, errors: 1, ...extra }));
  let j;
  try {
    const rq = request(C, q.system, q.prompt, q.maxOut), r = await F(C.url, { method: 'POST', headers: rq.headers, body: rq.body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r || !r.ok) { await giveBack(); return { available: true, error: 'the language-model call failed', status: (r && r.status) || 0 }; }
    j = await r.json();
  } catch (e) { await giveBack(); return { available: true, error: 'the language-model call failed', status: 0 }; }
  const out = parse(j);
  // the call was made: charge what the provider reports, or the estimate when it reports nothing
  const tokensIn = out.tokensIn != null ? out.tokensIn : estIn, tokensOut = out.tokensOut != null ? out.tokensOut : estimateTokens(out.text), estimated = out.tokensIn == null || out.tokensOut == null;
  const cost = r6((tokensIn * C.inPrice + tokensOut * C.outPrice) / 1e6);
  await store.update(COST_KEY, emptyLedger(), (L) => bump(ledgerOf(L), clock(), { usd: cost - est, tokensIn, tokensOut, ...(out.text ? {} : { errors: 1 }) }));
  if (!out.text) return { available: true, error: 'the language model returned no text', status: 200, costUsd: cost };
  const usage = { tokensIn, tokensOut, estimated };
  await store.update(CACHE_KEY, { v: 1, rows: [] }, (c) => { const rows = (c && Array.isArray(c.rows) ? c.rows : []).filter((r) => r && r.h !== q.h).concat({ h: q.h, at: new Date(clock()).toISOString(), text: out.text, usage }); return { v: 1, rows: rows.slice(-CACHE_MAX) }; });
  return { available: true, text: out.text, cached: false, usage, costUsd: cost };
}

module.exports = { config, unavailable, estimateTokens, complete, status, emptyLedger, COST_KEY, CACHE_KEY, _inflight: INFLIGHT, _t: { parse, request, over, bump, ledgerOf } };
