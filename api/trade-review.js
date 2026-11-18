// The trade reviewer endpoint (17 Nov 2026; the logic is api/_trade-review.js and council/trade-review.mjs, which explain it).
//   GET /api/trade-review?job=review   cron (Authorization: Bearer CRON_SECRET; on Cloudflare chained after the 10-minute job):
//                                      when council-data research/trade-review.json has a new reading and the last language-model
//                                      review is at least MIN_GAP_S old, ask the model once for its review of that file. Writes
//                                      only this feature's own store files.
//   GET /api/trade-review              owner or reviewer session -> { enabled, reason, cost, ai } (ai = the latest checked review,
//                                      or null). The rule-based review is in the council-data file itself (the page reads it).
// Store: the private Blob store, folder trade-review/ (trade-review-preview/ off production): latest.json, state.json, and the
// language-model adapter's own cost.json + llm-cache.json there (never the Academy's or the edge analyst's).
// Environment:
//   the model: ACADEMY_LLM_KEY / _URL / _MODEL / _FORMAT and the rest of the adapter's settings (docs/academy/LLM.md, section 3)
//   TRADE_REVIEW_LLM_DAILY_USD (default 0.50), TRADE_REVIEW_LLM_MONTHLY_USD (5), TRADE_REVIEW_LLM_HARD_USD (25),
//   TRADE_REVIEW_LLM_MAX_CALLS_DAY (2): this feature's own budgets; TRADE_REVIEW_LLM_MAX_TOKENS (8000) the output cap; TRADE_REVIEW=off or TRADE_REVIEW_LLM_STOP=1 stops every call.
// Proposals only: nothing here changes a rule, a size, a stop, a filter, a trade or config.json. ICT is never read.
'use strict';
const S = require('./_session.js');
const LLM = require('./_academy-llm.js');
const ST = require('./_academy-store.js');
const R = require('./_trade-review.js');
const G = require('./_guard.js');

const LATEST = 'latest.json', STATE = 'state.json', FILE = 'research/trade-review.json';
const MIN_GAP_S = 12 * 3600, MAX_OUT = 8000;   // at most one model review every 12 hours, whatever the council writes in between
const rootOf = (env) => (env.VERCEL_ENV && env.VERCEL_ENV !== 'production' ? 'trade-review-preview/' : 'trade-review/');
const TAILS = new Map();   // one lock map per function instance (the store's rule)
const storeOf = (env, io = {}) => ST.make(ST.blobBackend(env, { ...io, root: rootOf(env) }), TAILS);
const off = (env) => /^off$/i.test(String(env.TRADE_REVIEW || ''));
function llmEnv(env) {
  return { ...env, ACADEMY_LLM_DAILY_USD: env.TRADE_REVIEW_LLM_DAILY_USD || '0.5', ACADEMY_LLM_MONTHLY_USD: env.TRADE_REVIEW_LLM_MONTHLY_USD || '5', ACADEMY_LLM_HARD_USD: env.TRADE_REVIEW_LLM_HARD_USD || '25',
    ACADEMY_LLM_MAX_CALLS_DAY: env.TRADE_REVIEW_LLM_MAX_CALLS_DAY || '2', ACADEMY_LLM_STOP: /^(1|true|yes|on)$/i.test(String(env.TRADE_REVIEW_LLM_STOP || '')) || off(env) ? '1' : '' };
}
async function cdata(d, p) {
  const r = await (d.readFile || require('./data.js').readFile)(p, d.env, d.fetch || fetch);
  if (r.status === 404) return null; if (!r.ok) throw new Error(`council-data ${p}: ${r.status}`);
  return JSON.parse(r.buf.toString('utf8'));
}

async function review(d) {
  const env = d.env, store = d.store, now = Math.floor((d.now ? d.now() : Date.now()) / 1000);
  const C = LLM.config(llmEnv(env)), why = LLM.unavailable(C);
  if (why) return { off: why };
  if (off(env)) return { off: 'switched off (TRADE_REVIEW=off)' };
  const file = await cdata(d, FILE);
  if (!file || !Array.isArray(file.systems)) return { skipped: 'no trade review file yet' };
  const state = (await store.get(STATE, null)) || {};
  const mark = file.hash || file.at;   // the content's hash (council/trade-review.mjs): a re-stamped, unchanged reading is not asked again
  if (state.mark === mark) return { skipped: 'already reviewed', at: file.at };
  if (state.lastCall && now - state.lastCall < MIN_GAP_S) return { skipped: 'too soon', next: new Date((state.lastCall + MIN_GAP_S) * 1000).toISOString() };
  const q = R.buildRequest(file);
  // 17 Nov 2026: cap raised from 3000 (reasoning counts as output); a cut answer is billed and stored as refused
  const ans = LLM.cutAtCap(await (d.complete || LLM.complete)({ system: q.system, prompt: q.prompt, cap: 'feature', maxTokens: LLM.featureCap(env.TRADE_REVIEW_LLM_MAX_TOKENS, MAX_OUT), long: true }, { env: llmEnv(env), store, now: d.now }), 'TRADE_REVIEW_LLM_MAX_TOKENS');
  // a call that may have been paid for but gave nothing usable is stored as refused, so the same reading is not paid for twice;
  // a refused (unbilled) call or a budget skip is tried again at the next run
  const billed = !!(ans && ans.available && ans.error && (ans.usage || ans.costEstimated || ans.costUsd > 0));
  if (!billed && (!ans || !ans.available || ans.skipped || ans.error)) return { skipped: ans && (ans.skipped ? `budget: ${ans.scope || ans.skipped}` : ans.error || ans.reason) };
  const p = billed ? { ok: false, why: [String(ans.error).slice(0, 120)] } : R.parseAnswer(ans.text, file);
  const doc = { v: 1, reviewAt: file.at, at: new Date(now * 1000).toISOString(), provider: ans.provider || null, model: ans.model || null, costUsd: ans.costUsd || 0,
    ...(p.ok ? { answer: p.answer } : { refused: p.why }) };
  await store.put(LATEST, doc);
  await store.put(STATE, { mark, reviewAt: file.at, lastCall: now });
  return { reviewed: file.at, ok: !!p.ok, streams: p.ok ? p.answer.streams.length : 0 };
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || storeOf(env), q = req.query || {}, dd = { ...d, env, store };
  try {
    if (q.job === 'review') {
      if (!G.bearerOk(req.headers && req.headers.authorization, env.CRON_SECRET)) return res.status(401).json({ error: 'unauthorised' });
      return res.status(200).json(await review(dd));
    }
    const acct = await (d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 })))(req);
    if (!acct) return res.status(401).json({ error: 'sign in first' });
    if (acct.u !== 'owner' && acct.role !== 'reviewer') return res.status(403).json({ error: 'not for this account' });
    const [doc, cost] = await Promise.all([store.get(LATEST, null), LLM.status({ env: llmEnv(env), store })]);
    return res.status(200).json({ enabled: cost.enabled && !off(env), reason: cost.reason || (off(env) ? 'switched off (TRADE_REVIEW=off)' : null),
      cost: { today: cost.today.usd, month: cost.month.usd, total: cost.total.usd, budgets: cost.budgets }, ai: doc });
  } catch (e) { return res.status(e && e.status === 503 ? 503 : 500).json({ error: 'trade reviewer unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.review = review;
module.exports.llmEnv = llmEnv;
module.exports.storeOf = storeOf;
module.exports.MIN_GAP_S = MIN_GAP_S;
module.exports.MAX_OUT = MAX_OUT;
