// ChronosTrade's AI coach endpoint (17 Nov 2026; the request and the answer check are api/_chronos-coach.js).
//   GET  /api/chronos-coach   a signed-in member -> { enabled, reason, perDay, leftToday, cost }
//   POST /api/chronos-coach   a signed-in member, same origin; body { kind: 'trade' | 'session', lang?, … } (see the pure module)
//        -> { state: 'ok', answer, provider, model, cached } | { state: 'off' | 'budget' | 'limit' | 'refused' | 'error', message }
// Paper only: a language model's reading of a backtest replay. It places, changes or refuses no order and moves no stop.
// Store: the private Blob store, folder chronos-coach/ (chronos-coach-preview/ off production): answers.json, and the language-model
// adapter's own cost.json + llm-cache.json there (never the Academy's, the edge analyst's or the trade reviewer's).
// Environment:
//   the model: ACADEMY_LLM_KEY / _URL / _MODEL / _FORMAT and the rest of the adapter's settings (docs/academy/LLM.md, section 3)
//   CHRONOS_LLM_DAILY_USD (default 0.50), CHRONOS_LLM_MONTHLY_USD (5), CHRONOS_LLM_HARD_USD (25), CHRONOS_LLM_MAX_CALLS_DAY (30):
//   this feature's own budgets; CHRONOS_LLM_MAX_TOKENS (4000) the output cap of one call; CHRONOS_COACH_PER_DAY (20) the calls a
//   day one account may make (in memory, per instance); CHRONOS_COACH=off or CHRONOS_LLM_STOP=1 stops every call.
'use strict';
const crypto = require('node:crypto');
const S = require('./_session.js');
const LLM = require('./_academy-llm.js');
const ST = require('./_academy-store.js');
const M = require('./_chronos-coach.js');

const ANSWERS = 'answers.json', KEEP = 300, MAX_OUT = 4000, PER_DAY = 20, BODY_MAX = 300000;
const rootOf = (env) => (env.VERCEL_ENV && env.VERCEL_ENV !== 'production' ? 'chronos-coach-preview/' : 'chronos-coach/');
const TAILS = new Map();   // one lock map per function instance (the store's rule)
const storeOf = (env, io = {}) => ST.make(ST.blobBackend(env, { ...io, root: rootOf(env) }), TAILS);
const off = (env) => /^off$/i.test(String(env.CHRONOS_COACH || ''));
function llmEnv(env) {
  return { ...env, ACADEMY_LLM_DAILY_USD: env.CHRONOS_LLM_DAILY_USD || '0.5', ACADEMY_LLM_MONTHLY_USD: env.CHRONOS_LLM_MONTHLY_USD || '5', ACADEMY_LLM_HARD_USD: env.CHRONOS_LLM_HARD_USD || '25',
    ACADEMY_LLM_MAX_CALLS_DAY: env.CHRONOS_LLM_MAX_CALLS_DAY || '30', ACADEMY_LLM_STOP: /^(1|true|yes|on)$/i.test(String(env.CHRONOS_LLM_STOP || '')) || off(env) ? '1' : '' };
}
const perDay = (env) => { const x = Math.round(Number(env.CHRONOS_COACH_PER_DAY)); return Number.isFinite(x) && x >= 0 && String(env.CHRONOS_COACH_PER_DAY || '') !== '' ? Math.min(200, x) : PER_DAY; };
// calls per account and UTC day, in memory (a new instance starts at 0; the adapter's own daily budget and call cap still hold)
const CALLS = new Map();
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
function used(u, ms) { return CALLS.get(`${u}|${dayOf(ms)}`) || 0; }
function count(u, ms) { const k = `${u}|${dayOf(ms)}`; CALLS.set(k, (CALLS.get(k) || 0) + 1); if (CALLS.size > 2000) for (const key of CALLS.keys()) { if (!key.endsWith(dayOf(ms))) CALLS.delete(key); } }

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || storeOf(env), nowMs = d.now ? d.now() : Date.now();
  try {
    const acct = await (d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 })))(req);
    if (!acct) return res.status(401).json({ error: 'sign in first' });
    const lim = perDay(env), C = LLM.config(llmEnv(env)), why = LLM.unavailable(C) || (off(env) ? 'switched off (CHRONOS_COACH=off)' : null);
    if (req.method === 'GET') {
      const cost = await LLM.status({ env: llmEnv(env), store, now: () => nowMs });
      return res.status(200).json({ enabled: !why && !C.stop, reason: why || (C.stop ? 'stopped (CHRONOS_LLM_STOP)' : null), perDay: lim, leftToday: Math.max(0, lim - used(acct.u, nowMs)),
        cost: { today: cost.today.usd, month: cost.month.usd, total: cost.total.usd, budgets: cost.budgets, callsLeftToday: cost.calls.leftToday } });
    }
    let b = req.body;
    if (typeof b === 'string') { if (b.length > BODY_MAX) return res.status(413).json({ error: 'too much data' }); try { b = JSON.parse(b || '{}'); } catch (e) { return res.status(400).json({ error: 'bad JSON' }); } }
    else if (b && JSON.stringify(b).length > BODY_MAX) return res.status(413).json({ error: 'too much data' });
    let q; try { q = M.buildRequest(b); } catch (e) { return res.status(e.status || 400).json({ error: String(e.message || 'bad request').slice(0, 120) }); }
    if (why) return res.status(200).json({ state: 'off', message: why });
    // a question already answered (or already refused after a billed call) is answered from the store: never paid for twice
    const h = crypto.createHash('sha256').update(JSON.stringify([acct.u, q.system, q.prompt])).digest('hex').slice(0, 40);
    const doc = await store.get(ANSWERS, { v: 1, rows: [] }), old = (doc.rows || []).find((r) => r && r.h === h);
    if (old) return res.status(200).json(old.answer ? { state: 'ok', answer: old.answer, provider: old.provider, model: old.model, cached: true } : { state: 'refused', message: 'The coach\'s answer to this question did not pass the checks, and it is not asked again.', why: old.refused || [] });
    if (used(acct.u, nowMs) >= lim) return res.status(200).json({ state: 'limit', message: `You have asked the coach ${lim} times today: ask again tomorrow (UTC).` });
    count(acct.u, nowMs);
    const ans = LLM.cutAtCap(await (d.complete || LLM.complete)({ system: q.system, prompt: q.prompt, cap: 'feature', maxTokens: LLM.featureCap(env.CHRONOS_LLM_MAX_TOKENS, MAX_OUT), long: true, schema: q.schema, schemaName: 'coach_answer' },
      { env: llmEnv(env), store, now: d.now, fetch: d.fetch }), 'CHRONOS_LLM_MAX_TOKENS');
    if (!ans || !ans.available) return res.status(200).json({ state: 'off', message: (ans && ans.reason) || 'the coach is off' });
    if (ans.skipped === 'budget') return res.status(200).json({ state: 'budget', message: `The coach's ${ans.scope === 'day' || ans.scope === 'calls' ? 'daily' : ans.scope === 'month' ? 'monthly' : 'total'} budget is used up.` });
    if (ans.skipped) return res.status(200).json({ state: 'error', message: ans.skipped === 'too-long' ? 'Too much to send in one question.' : 'Nothing to ask.' });
    const billed = !!(ans.error && (ans.usage || ans.costEstimated || ans.costUsd > 0));
    if (ans.error && !billed) return res.status(200).json({ state: 'error', message: 'The coach could not be reached. Try again in a minute.' });
    const p = billed ? { ok: false, why: [String(ans.error).slice(0, 160)] } : M.parseAnswer(ans.text);
    const row = { h, u: acct.u, kind: q.kind, at: new Date(nowMs).toISOString(), provider: ans.provider || null, model: ans.model || null, costUsd: ans.costUsd || 0, ...(p.ok ? { answer: p.answer } : { refused: p.why }) };
    await store.update(ANSWERS, { v: 1, rows: [] }, (D) => ({ v: 1, rows: (Array.isArray(D && D.rows) ? D.rows : []).filter((r) => r && r.h !== h).concat(row).slice(-KEEP) }));
    return res.status(200).json(p.ok ? { state: 'ok', answer: p.answer, provider: row.provider, model: row.model, cached: !!ans.cached } : { state: 'refused', message: 'The coach\'s answer did not pass the checks, so it is not shown. It is not asked again.', why: p.why });
  } catch (e) { return res.status(e && e.status === 503 ? 503 : 500).json({ error: 'the coach is unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.llmEnv = llmEnv;
module.exports.storeOf = storeOf;
module.exports.MAX_OUT = MAX_OUT;
module.exports.PER_DAY = PER_DAY;
module.exports._calls = CALLS;
