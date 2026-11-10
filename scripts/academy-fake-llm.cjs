// A FAKE language-model provider, for the local dev server (node scripts/academy-dev.mjs --fake-llm) and the tests only.
// It is not a language model and reads nothing with any understanding. It answers by one fixed rule, written here, so the
// analyst route and the page can be exercised end to end without a key, a network call or a cent.
//
// It can only be reached as an injected dependency of the API handler ({ env, fetch, provider }): the deployed function is
// called without dependencies, so no environment variable and no query string can switch it on. Every answer it gives is
// labelled with the provider name 'fake-test', and the page shows a "FAKE PROVIDER" banner whenever it sees that name.
//
// The rule (answerFor): follow the deterministic engine's answer, unless a matching mentor lesson says otherwise (WAIT / refuse
// -> WAIT; take -> the setup's own row; flip -> the other side; a level rule -> the row that uses it). An open position asked
// about is held, or its stop tightened when the engine's own advice says so. Tests pass `reply` to make it answer anything
// else, including garbage.
'use strict';

const PROVIDER = 'fake-test';
// the settings that switch the adapter on for the fake: they name no real endpoint and hold no secret
const ENV = { ACADEMY_LLM_KEY: 'fake-test-key-not-a-secret', ACADEMY_LLM_URL: 'https://fake-test.invalid/v1/answer', ACADEMY_LLM_MODEL: 'fake-test', ACADEMY_LLM_USD_PER_MTOK_IN: '1', ACADEMY_LLM_USD_PER_MTOK_OUT: '5', ACADEMY_LLM_DAILY_USD: '0.5', ACADEMY_LLM_MAX_CALLS_DAY: '40', ACADEMY_LLM_RETRIES: '0' };
const NOTE = 'FAKE PROVIDER: this is a test answer made by a fixed rule, not by a language model.';
const FACTOR = { ltfStructure: 'ltfBias', location: 'entryLoc', confirmation: 'confirm', stop: 'stopAtr', volatility: 'volState', dxy: 'dxyTrend', event: 'eventNear' };   // the engine's evidence names -> feature keys
const tokens = (s) => Math.ceil(String(s == null ? '' : s).length / 4);

// the facts document out of an analyst prompt (null for any other prompt)
function factsOf(prompt) { const m = /<facts>\n([\s\S]*?)\n<\/facts>/.exec(String(prompt || '')); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return null; } }
// { system, prompt } out of a request body in either wire format
function readBody(body) {
  const b = body || {}, msgs = Array.isArray(b.messages) ? b.messages : [], user = msgs.filter((m) => m && m.role === 'user').pop(), sys = msgs.find((m) => m && (m.role === 'system' || m.role === 'developer'));
  return { format: typeof b.system === 'string' ? 'messages' : 'chat', system: typeof b.system === 'string' ? b.system : sys ? sys.content : '', prompt: user ? String(user.content) : '', maxTokens: b.max_tokens || b.max_completion_tokens || null, schema: !!(b.output_config && b.output_config.format) || !!b.response_format };
}

function answerFor(facts) {
  const F = facts || {}, eng = F.engineAnswer || {}, allowed = F.allowed || {}, trades = Array.isArray(allowed.trades) ? allowed.trades : [], feats = F.features || {};
  const matching = ((F.lessons_quotedData || {}).matching || []).filter((l) => !l.inConflict), th = F.thesis_quotedData || {};
  const item = (x) => { const k = FACTOR[x.factor] || x.factor; return (Object.prototype.hasOwnProperty.call(feats, k) && feats[k] !== null) || k === 'similar' || k === 'thesis' ? { factor: k, text: String(x.text || '').slice(0, 300) } : null; };
  const out = { action: 'WAIT', entry: null, stop: null, target: null, thesis: { bias: ['up', 'down', 'neutral'].indexOf(th.bias) >= 0 ? th.bias : 'neutral', text: `${NOTE} It keeps the running thesis and follows the engine unless a matching lesson says otherwise.` },
    supporting: (eng.evidenceFor || []).map(item).filter(Boolean).slice(0, 6), contradicting: (eng.evidenceAgainst || []).map(item).filter(Boolean).slice(0, 6),
    uncertainty: [NOTE].concat((eng.uncertainty || []).slice(0, 2)), waitReasons: [], invalidation: [], lessonsUsed: [], confidence: ['low', 'medium', 'high'].indexOf(eng.confidence) >= 0 ? eng.confidence : 'low', manage: null };
  if ((allowed.actions || []).indexOf('MANAGE') >= 0 && F.openPosition) {
    const tighter = eng.manage && eng.manage.advice === 'tighten' ? (allowed.manageStops || [])[0] : null;
    out.action = 'MANAGE'; out.manage = tighter ? { advice: 'tighten-stop', stop: tighter.stop } : { advice: 'hold', stop: null };
    return out;
  }
  const own = F.setup ? (F.setup.side === 'buy' ? 'BUY' : 'SELL') : null, use = (l, how) => { if (!out.lessonsUsed.some((x) => x.id === l.id)) out.lessonsUsed.push({ id: l.id, how }); };
  const take = (row) => { if (!row) return false; out.action = row.action; out.entry = row.entry; out.stop = row.stop; out.target = row.target; out.invalidation = [`price at the stop ${row.stop}`]; for (const id of row.usesLessons || []) { const l = matching.find((x) => x.id === id); if (l) use(l, 'its level rule or its flip set this row'); } return true; };
  const leader = matching.find((l) => ['WAIT', 'SKIP', 'TAKE', 'FLIP'].indexOf(l.then) >= 0);
  let want = eng.action === 'BUY' || eng.action === 'SELL' ? eng.action : 'WAIT';
  if (leader) { use(leader, `the lesson says ${leader.then}`); want = leader.then === 'TAKE' ? own : leader.then === 'FLIP' ? (own === 'BUY' ? 'SELL' : 'BUY') : 'WAIT'; }
  if (want !== 'WAIT') {
    const rows = trades.filter((r) => r.action === want), flipId = leader && leader.then === 'FLIP' ? leader.id : null;
    if (!take(rows.find((r) => (r.usesLessons || []).some((id) => id !== flipId)) || rows[0])) want = 'WAIT';   // a row set by a lesson's level rule first, else the setup's own
  }
  if (want === 'WAIT') { out.action = 'WAIT'; out.waitReasons = leader ? [`the mentor's lesson ${leader.id} says ${leader.then}`] : (eng.waitReasons || []).slice(0, 2); if (!out.waitReasons.length) out.waitReasons = ['the engine waited and no matching lesson says otherwise']; }
  return out;
}

// make({ reply, responses, usage, delay }) -> { fetch, calls, provider, env }
//   reply(facts, request)   what to answer instead of the rule: a string is sent as it is (garbage included), an object as JSON
//   responses               a queue of { status, body?, headers?, throws? } answered before anything else (errors, retries)
//   usage: false            report no token usage (the adapter then charges its estimate)
function make(opts) {
  const o = opts || {}, calls = [], queue = (o.responses || []).slice();
  const res = (status, body, headers) => ({ ok: status >= 200 && status < 300, status, headers: { get: (n) => { const h = headers || {}, k = Object.keys(h).find((x) => x.toLowerCase() === String(n).toLowerCase()); return k ? String(h[k]) : null; } }, json: async () => body });
  async function fetch(url, init) {
    const body = JSON.parse((init && init.body) || '{}'), rq = readBody(body); calls.push({ url, init, body, request: rq });
    if (o.delay) await new Promise((r) => setTimeout(r, o.delay));
    if (queue.length) { const q = queue.shift(); if (q.throws) throw Object.assign(new Error('fake network failure'), q.name ? { name: q.name } : {}); if (q.status && q.status !== 200) return res(q.status, q.body || { type: 'error', error: { type: 'overloaded_error', message: 'fake provider error' } }, q.headers); if (q.body) return res(200, q.body, q.headers); }
    const facts = factsOf(rq.prompt); let text;
    if (o.reply) { const r = o.reply(facts, rq); text = typeof r === 'string' ? r : JSON.stringify(r); }
    else text = facts ? JSON.stringify(answerFor(facts)) : `${NOTE} Nothing was read with understanding.`;
    const tin = tokens(rq.system) + tokens(rq.prompt), tout = tokens(text);
    if (rq.format === 'messages') return res(200, { id: 'msg_fake', type: 'message', role: 'assistant', model: PROVIDER, content: [{ type: 'text', text }], stop_reason: 'end_turn', ...(o.usage === false ? {} : { usage: { input_tokens: tin, output_tokens: tout } }) });
    return res(200, { id: 'chatcmpl-fake', object: 'chat.completion', model: PROVIDER, choices: [{ index: 0, message: { role: 'assistant', content: text, refusal: null }, finish_reason: 'stop' }], ...(o.usage === false ? {} : { usage: { prompt_tokens: tin, completion_tokens: tout, total_tokens: tin + tout } }) });
  }
  return { fetch, calls, provider: PROVIDER, env: { ...ENV } };
}

module.exports = { PROVIDER, ENV, NOTE, make, answerFor, factsOf, readBody };
