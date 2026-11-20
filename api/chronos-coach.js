// ChronosTrade's AI coach endpoint (17 Nov 2026; the request and the answer check are api/_chronos-coach.js).
//   GET  /api/chronos-coach   a signed-in member -> { enabled, reason, perDay, leftToday, livePerDay, liveLeftToday, liveGapS, lastMs, cost }
//   POST /api/chronos-coach   a signed-in member, same origin; body { kind: 'trade' | 'session' | 'live' | 'debrief', lang?, stream?, … } (the pure module)
//        -> { state: 'ok', answer | text, provider, model, cached, ms } | { state: 'off' | 'budget' | 'limit' | 'busy' | 'wait' | 'refused' | 'error', message }
//        With stream: true and a question that reaches the model, the answer is sent as server-sent events (text/event-stream):
//        data: {"t":"start"}, then data: {"t":"text","d":"<piece>"} as the provider writes it, then data: {"t":"done", …the result
//        above}. The pieces are shown at once; the result in "done" is the CHECKED one (a live comment that fails the checks is
//        "refused" and the page withdraws what it showed). Every early answer (off, limit, a stored answer, a bad request) is JSON.
// Paper only: a language model's reading of a backtest replay. It places, changes or refuses no order and moves no stop.
// Store: the private Blob store, folder chronos-coach/ (chronos-coach-preview/ off production): answers.json (trade / session),
// live.json (live comments), and the language-model adapter's own cost.json + llm-cache.json there (never the Academy's, the
// edge analyst's or the trade reviewer's). Each of the two files keeps `lastMs` (time to the first text and in all, of the last
// call that reached the model), shown by GET.
// Environment:
//   the model: ACADEMY_LLM_KEY / _URL / _FORMAT and the rest of the adapter's settings (docs/academy/LLM.md, section 3)
//   CHRONOS_LLM_MODEL          optional: the provider's model id for the coach only (else ACADEMY_LLM_MODEL)
//   CHRONOS_LLM_BODY           optional JSON of extra body fields for the coach only (else ACADEMY_LLM_BODY). On the 'messages'
//                              format the coach sends output_config.effort 'low' unless one of the two names an effort.
//   CHRONOS_LLM_USD_PER_MTOK_IN / _OUT (+ _CACHE_READ / _CACHE_WRITE)   the coach's prices when its model differs
//   CHRONOS_LLM_DAILY_USD (default 0.50), CHRONOS_LLM_MONTHLY_USD (5), CHRONOS_LLM_HARD_USD (25), CHRONOS_LLM_MAX_CALLS_DAY (100):
//   this feature's own budgets; CHRONOS_LLM_MAX_TOKENS (4000) the output cap of a trade / session question,
//   CHRONOS_LIVE_MAX_TOKENS (1500) of a live comment; CHRONOS_COACH_PER_DAY (20) trade / session questions a day one account may
//   ask, CHRONOS_LIVE_PER_DAY (150) live comments a day (both in memory, per instance; the USD budgets above stay the hard stop);
//   CHRONOS_DEBRIEF_PER_DAY (5) end-of-session debriefs a day one account may ask (its own counter, `debrief|<account>`);
//   a live comment: one at a time per account and at most one every CHRONOS_LIVE_GAP_S (8) seconds; CHRONOS_COACH=off or CHRONOS_LLM_STOP=1 stops every call.
'use strict';
const crypto = require('node:crypto');
const S = require('./_session.js');
const LLM = require('./_academy-llm.js');
const ST = require('./_academy-store.js');
const M = require('./_chronos-coach.js');

const ANSWERS = 'answers.json', LIVE = 'live.json', KEEP = 300, LIVE_KEEP = 200, MAX_OUT = 4000, LIVE_OUT = 1500, PER_DAY = 20, LIVE_PER_DAY = 150, LIVE_GAP_S = 8, BODY_MAX = 300000, DEBRIEF_PER_DAY = 5;
const rootOf = (env) => (env.VERCEL_ENV && env.VERCEL_ENV !== 'production' ? 'chronos-coach-preview/' : 'chronos-coach/');
const TAILS = new Map();   // one lock map per function instance (the store's rule)
const storeOf = (env, io = {}) => ST.make(ST.blobBackend(env, { ...io, root: rootOf(env) }), TAILS);
const off = (env) => /^off$/i.test(String(env.CHRONOS_COACH || ''));
const jsonObj = (v) => { try { const j = v ? JSON.parse(v) : null; return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch (e) { return null; } };
// the coach's own body fields: CHRONOS_LLM_BODY, else ACADEMY_LLM_BODY; a low reasoning effort unless one of them names an effort
// (only for the 'messages' format, whose providers document output_config; a provider that refuses it answers in words)
function coachBody(env) {
  const b = jsonObj(env.CHRONOS_LLM_BODY) || jsonObj(env.ACADEMY_LLM_BODY) || {};
  if (env.ACADEMY_LLM_FORMAT !== 'messages') return b;
  const oc = b.output_config && typeof b.output_config === 'object' && !Array.isArray(b.output_config) ? b.output_config : {};
  return 'effort' in oc ? b : { ...b, output_config: { ...oc, effort: 'low' } };
}
function llmEnv(env) {
  const out = { ...env, ACADEMY_LLM_DAILY_USD: env.CHRONOS_LLM_DAILY_USD || '0.5', ACADEMY_LLM_MONTHLY_USD: env.CHRONOS_LLM_MONTHLY_USD || '5', ACADEMY_LLM_HARD_USD: env.CHRONOS_LLM_HARD_USD || '25',
    ACADEMY_LLM_MAX_CALLS_DAY: env.CHRONOS_LLM_MAX_CALLS_DAY || '100', ACADEMY_LLM_STOP: /^(1|true|yes|on)$/i.test(String(env.CHRONOS_LLM_STOP || '')) || off(env) ? '1' : '',
    ACADEMY_LLM_BODY: JSON.stringify(coachBody(env)) };
  if (String(env.CHRONOS_LLM_MODEL || '').trim()) out.ACADEMY_LLM_MODEL = String(env.CHRONOS_LLM_MODEL).trim();
  if (env.CHRONOS_LLM_USD_PER_MTOK_IN) { out.ACADEMY_LLM_USD_PER_MTOK_IN = env.CHRONOS_LLM_USD_PER_MTOK_IN; delete out.ACADEMY_LLM_USD_PER_MTOK_CACHE_READ; delete out.ACADEMY_LLM_USD_PER_MTOK_CACHE_WRITE; }
  if (env.CHRONOS_LLM_USD_PER_MTOK_OUT) out.ACADEMY_LLM_USD_PER_MTOK_OUT = env.CHRONOS_LLM_USD_PER_MTOK_OUT;
  if (env.CHRONOS_LLM_USD_PER_MTOK_CACHE_READ) out.ACADEMY_LLM_USD_PER_MTOK_CACHE_READ = env.CHRONOS_LLM_USD_PER_MTOK_CACHE_READ;
  if (env.CHRONOS_LLM_USD_PER_MTOK_CACHE_WRITE) out.ACADEMY_LLM_USD_PER_MTOK_CACHE_WRITE = env.CHRONOS_LLM_USD_PER_MTOK_CACHE_WRITE;
  return out;
}
const intEnv = (v, d, max) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 && String(v == null ? '' : v) !== '' ? Math.min(max, x) : d; };
const perDay = (env) => intEnv(env.CHRONOS_COACH_PER_DAY, PER_DAY, 200);
const livePerDay = (env) => intEnv(env.CHRONOS_LIVE_PER_DAY, LIVE_PER_DAY, 500);
const liveGap = (env) => intEnv(env.CHRONOS_LIVE_GAP_S, LIVE_GAP_S, 600);
const debriefPerDay = (env) => intEnv(env.CHRONOS_DEBRIEF_PER_DAY, DEBRIEF_PER_DAY, 50);
// calls per account and UTC day, in memory (a new instance starts at 0; the adapter's own daily budget and call cap still hold).
// Live comments have their own counter (`live|<account>`), their own gap and one in flight per account.
const CALLS = new Map(), LIVE_AT = new Map(), LIVE_BUSY = new Set();
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
function used(u, ms) { return CALLS.get(`${u}|${dayOf(ms)}`) || 0; }
function count(u, ms) { const k = `${u}|${dayOf(ms)}`; CALLS.set(k, (CALLS.get(k) || 0) + 1); if (CALLS.size > 2000) for (const key of CALLS.keys()) { if (!key.endsWith(dayOf(ms))) CALLS.delete(key); } }

// a provider that refused the request itself (a 4xx other than a rate limit: an unknown model id, a body field it does not take)
// is said in words, so a wrong CHRONOS_LLM_MODEL or CHRONOS_LLM_BODY can be put right
// 20 Nov 2026 review: the provider's own words and the variable names are for the owner, who can act on them; any other member
// gets the plain sentence (every signed-in account may ask the coach, and a provider's refusal can name the model or the account).
function errText(ans, owner) {
  if (!owner) return ans.partial != null ? 'The answer broke off. Try again in a minute.' : 'The coach could not be reached. Try again in a minute.';
  if (ans.status === 401 || ans.status === 403) return `The provider did not accept the key (${ans.status}). Check ACADEMY_LLM_KEY (a token with access to the model) and the account in ACADEMY_LLM_URL.`;
  if (ans.status >= 400 && ans.status < 500 && ans.status !== 408 && ans.status !== 429) return `The provider refused the request (${ans.status}${ans.errorType ? ` ${ans.errorType}` : ''})${ans.detail ? `: ${ans.detail}` : ''}. Check CHRONOS_LLM_MODEL and CHRONOS_LLM_BODY.`;
  return ans.partial != null ? 'The answer broke off. Try again in a minute.' : 'The coach could not be reached. Try again in a minute.';
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
    const lim = perDay(env), dLim = debriefPerDay(env), lLim = livePerDay(env), gap = liveGap(env), C = LLM.config(llmEnv(env)), why = LLM.unavailable(C) || (off(env) ? 'switched off (CHRONOS_COACH=off)' : null);
    if (req.method === 'GET') {
      const [cost, a, l] = await Promise.all([LLM.status({ env: llmEnv(env), store, now: () => nowMs }), store.get(ANSWERS, { v: 1, rows: [] }), store.get(LIVE, { v: 1, rows: [] })]);
      const lastMs = [a && a.lastMs, l && l.lastMs].filter(Boolean).sort((x, y) => String(y.at).localeCompare(String(x.at)))[0] || null;
      return res.status(200).json({ enabled: !why && !C.stop, reason: why || (C.stop ? 'stopped (CHRONOS_LLM_STOP)' : null), perDay: lim, leftToday: Math.max(0, lim - used(acct.u, nowMs)), debriefPerDay: dLim, debriefLeftToday: Math.max(0, dLim - used(`debrief|${acct.u}`, nowMs)),
        livePerDay: lLim, liveLeftToday: Math.max(0, lLim - used(`live|${acct.u}`, nowMs)), liveGapS: gap, lastMs,
        cost: { today: cost.today.usd, month: cost.month.usd, total: cost.total.usd, budgets: cost.budgets, callsLeftToday: cost.calls.leftToday } });
    }
    let b = req.body;
    if (typeof b === 'string') { if (b.length > BODY_MAX) return res.status(413).json({ error: 'too much data' }); try { b = JSON.parse(b || '{}'); } catch (e) { return res.status(400).json({ error: 'bad JSON' }); } }
    else if (b && JSON.stringify(b).length > BODY_MAX) return res.status(413).json({ error: 'too much data' });
    let q; try { q = M.buildRequest(b); } catch (e) { return res.status(e.status || 400).json({ error: String(e.message || 'bad request').slice(0, 120) }); }
    if (why) return res.status(200).json({ state: 'off', message: why });
    const live = q.kind === 'live', deb = q.kind === 'debrief', file = live ? LIVE : ANSWERS, who = live ? `live|${acct.u}` : deb ? `debrief|${acct.u}` : acct.u;
    // a question already answered (or already refused after a billed call) is answered from the store: never paid for twice
    const h = crypto.createHash('sha256').update(JSON.stringify([acct.u, q.system, q.prompt])).digest('hex').slice(0, 40);
    const doc = await store.get(file, { v: 1, rows: [] }), old = (doc.rows || []).find((r) => r && r.h === h);
    if (old) {
      if (old.answer || old.text) return res.status(200).json({ state: 'ok', ...(live ? { text: old.text } : { answer: old.answer }), provider: old.provider, model: old.model, cached: true });
      return res.status(200).json({ state: 'refused', ...(live ? { withdrawn: true, message: 'Withdrawn: the answer broke the coach\'s rules.' } : { message: 'The coach\'s answer to this question did not pass the checks, and it is not asked again.' }), why: old.refused || [] });
    }
    if (used(who, nowMs) >= (live ? lLim : deb ? dLim : lim)) return res.status(200).json({ state: 'limit', message: live ? `Coach resting: ${lLim} comments today. The free notes go on; comments come back tomorrow (UTC).` : deb ? `${dLim} debriefs today: the free debrief stays; ask again tomorrow (UTC).` : `You have asked the coach ${lim} times today: ask again tomorrow (UTC).` });
    if (live) {
      if (LIVE_BUSY.has(acct.u)) return res.status(200).json({ state: 'busy', message: 'The coach is still answering the last comment.' });
      const last = LIVE_AT.get(acct.u) || 0, wait = Math.ceil((last + gap * 1000 - nowMs) / 1000);
      if (wait > 0) return res.status(200).json({ state: 'wait', retryInS: wait, message: `One comment every ${gap} s: next in ${wait} s.` });
      LIVE_BUSY.add(acct.u); LIVE_AT.set(acct.u, nowMs); if (LIVE_AT.size > 2000) LIVE_AT.clear();
    }
    count(who, nowMs);
    try {
      const want = !!(b && b.stream === true), maxTokens = live ? LLM.featureCap(env.CHRONOS_LIVE_MAX_TOKENS, LIVE_OUT) : LLM.featureCap(env.CHRONOS_LLM_MAX_TOKENS, MAX_OUT);
      const capVar = live ? 'CHRONOS_LIVE_MAX_TOKENS' : 'CHRONOS_LLM_MAX_TOKENS';
      const ask = { system: q.system, prompt: q.prompt, cap: 'feature', maxTokens, long: true, cacheSystem: true, ...(q.schema ? { schema: q.schema, schemaName: deb ? 'coach_debrief' : 'coach_answer' } : {}) };
      const io = { env: llmEnv(env), store, now: d.now, fetch: d.fetch };
      const send = (o) => { try { res.write(`data: ${JSON.stringify(o)}\n\n`); } catch (e) { /* the page went away; the call still ends and is stored */ } };
      const t0 = clock();
      let ans;
      if (want) {
        streaming = true; res.statusCode = 200; res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('X-Accel-Buffering', 'no');
        send({ t: 'start', kind: q.kind });   // the first bytes leave now: the page knows the coach is answering
        ans = await (d.stream || LLM.stream)(ask, io, (piece) => send({ t: 'text', d: piece }));
      } else ans = await (d.complete || LLM.complete)(ask, io);
      ans = LLM.cutAtCap(ans, capVar);
      const ms = ans && ans.ms ? ans.ms : { first: null, total: clock() - t0 };
      const out = await finish(ans, { q, live, h, acct, file, store, nowMs, ms });
      if (live) out.liveLeft = Math.max(0, lLim - used(who, nowMs));
      if (streaming) { send({ t: 'done', ...out }); return res.end(); }
      return res.status(200).json(out);
    } finally { if (live) LIVE_BUSY.delete(acct.u); }
  } catch (e) {
    if (streaming) { try { res.write(`data: ${JSON.stringify({ t: 'done', state: 'error', message: 'The coach is unavailable.' })}\n\n`); } catch (er) { /* gone */ } return res.end(); }
    return res.status(e && e.status === 503 ? 503 : 500).json({ error: 'the coach is unavailable' });
  }
}
// the answer of one call -> the page's result; billed answers (passed or refused) are stored with the call's latency
async function finish(ans, { q, live, h, acct, file, store, nowMs, ms }) {
  if (!ans || !ans.available) return { state: 'off', message: (ans && ans.reason) || 'the coach is off' };
  if (ans.skipped === 'budget') { const w = ans.scope === 'day' || ans.scope === 'calls' ? 'daily' : ans.scope === 'month' ? 'monthly' : 'total'; return { state: 'budget', scope: ans.scope, message: live ? `Coach resting: ${w} budget reached.` : `The coach's ${w} budget is used up.` }; }
  if (ans.skipped) return { state: 'error', message: ans.skipped === 'too-long' ? 'Too much to send in one question.' : 'Nothing to ask.' };
  const billed = !!(ans.error && (ans.usage || ans.costEstimated || ans.costUsd > 0));
  if (ans.error && !billed) return { state: 'error', message: errText(ans, acct.u === 'owner'), ms };
  if (ans.error && ans.partial != null && !ans.cut) {   // broke off in the middle: may be billed, not an answer; asked again it is a new call
    return { state: 'error', withdrawn: live, message: errText(ans, acct.u === 'owner'), ms };
  }
  const p = billed ? { ok: false, why: [String(ans.error).slice(0, 160)] } : live ? M.parseLive(ans.text) : q.kind === 'debrief' ? M.parseDebrief(ans.text) : M.parseAnswer(ans.text);
  const lastMs = { first: ms.first, total: ms.total, kind: q.kind, at: new Date(nowMs).toISOString(), cached: !!ans.cached };
  const row = { h, u: acct.u, kind: q.kind, ...(live ? { trigger: q.trigger } : {}), at: new Date(nowMs).toISOString(), provider: ans.provider || null, model: ans.model || null, costUsd: ans.costUsd || 0, ms: { first: ms.first, total: ms.total },
    ...(p.ok ? (live ? { text: p.text } : { answer: p.answer }) : { refused: p.why }) };
  await store.update(file, { v: 1, rows: [] }, (D) => ({ v: 1, rows: (Array.isArray(D && D.rows) ? D.rows : []).filter((r) => r && r.h !== h).concat(row).slice(-(live ? LIVE_KEEP : KEEP)), lastMs }));
  if (p.ok) return { state: 'ok', ...(live ? { text: p.text } : { answer: p.answer }), provider: row.provider, model: row.model, cached: !!ans.cached, ms };
  return live ? { state: 'refused', withdrawn: true, message: 'Withdrawn: the answer broke the coach\'s rules.', why: p.why, ms }
    : { state: 'refused', message: 'The coach\'s answer did not pass the checks, so it is not shown. It is not asked again.', why: p.why, ms };
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.llmEnv = llmEnv;
module.exports.coachBody = coachBody;
module.exports.storeOf = storeOf;
module.exports.MAX_OUT = MAX_OUT;
module.exports.LIVE_OUT = LIVE_OUT;
module.exports.PER_DAY = PER_DAY;
module.exports.DEBRIEF_PER_DAY = DEBRIEF_PER_DAY;
module.exports.LIVE_PER_DAY = LIVE_PER_DAY;
module.exports._calls = CALLS;
module.exports._live = { at: LIVE_AT, busy: LIVE_BUSY };
