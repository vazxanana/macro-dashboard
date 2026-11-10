// node --test tests/academy-connector.test.mjs — the Academy's assistant connector (api/academy-mcp.js, api/_academy-connector.js,
// the queue path of api/academy.js `analyse`). Owner, 10 Nov 2026: the analyst's second opinion comes from the owner's own
// assistant, with no provider key and no bill.
//
// Offline and free. No provider is called anywhere: with no key set, "Ask the analyst" queues the question; this file plays the
// assistant by calling the connector's tools the way an assistant app does (JSON-RPC over POST) with answers written here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handle, _t: API } = require('../api/academy.js');
const MCP = require('../api/academy-mcp.js');
const CN = require('../api/_academy-connector.js');
const ST = require('../api/_academy-store.js');
const AN = require('../api/_academy-analyst.js');
const FAKE = require('../scripts/academy-fake-llm.cjs');
const MXR = require('../assets/academy-replay.js');
const MXA = require('../assets/academy-core.js');
const MXAC = require('../assets/academy-ui.js');
const { EDGES } = await import('../academy/edges.mjs');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const json = (f) => JSON.parse(src(f));

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const MAN = json('tests/fixtures/academy/manifest.json'), EDGE = EDGES.find((e) => e.id === MAN.edge), COST = 0.15;
const SERIES = Object.fromEntries(MXAC.TFS.map((tf) => [tf, json(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`).bars.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }))]));
const CANDS = json(`academy/data/cand-${EDGE.id}.json`).filter((c) => c.t >= MAN.from && c.t < MAN.to), TRAIN = CANDS.filter((c) => c.pool !== 'exam'), EXAM = CANDS.filter((c) => c.pool === 'exam');
const DATA = API.fileData(ROOT), OWNER = { u: 'owner' };
const snapOf = (c) => MXR.snapshot({ edge: EDGE.id, market: EDGE.market, t: c.t, cand: c, series: MXAC.snapshotSeries(EDGE, SERIES), dataVersion: 'OANDA (recorded) XAU_USD' });
function point(c, o = {}) {
  const snap = snapOf(c), f = MXA.features(snap), th0 = MXA.thesis.start(snap), risk = o.risk || { allowed: true, blocks: [], riskPct: 0.25 };
  const d = MXA.decide(snap, { lessons: [], thesis: th0, history: [], risk, edgeDef: { version: EDGE.version, cost: COST } });
  return { c, snap, f, d, thesis: MXA.thesis.update(th0, snap, d), hash: MXR.hash(snap), digest: AN.digest(snap, { [EDGE.signalTf]: 30, other: 15 }) };
}
const POINTS = TRAIN.map((c) => point(c));
const TAKEN = POINTS.find((p) => p.d.action !== 'WAIT' && !p.d.gates.length), GATED = POINTS.find((p) => p.d.gates.some((g) => g.hard)), OTHER = POINTS.find((p) => p !== TAKEN && p !== GATED);
assert.ok(TAKEN && GATED && OTHER && EXAM.length >= 1);

// the server has a session secret and NO provider key: the connector is the analyst's only way
const ENV = { SESSION_SECRET: 'a-test-secret-of-32-characters!!' }, KEY = CN.keyOf(ENV);
const NO_GUARD = { wait: () => 0, failed: () => {}, tooMany: (res, s) => res.status(429).json({ error: `wait ${s}` }) };
function mk(o = {}) {
  const store = o.store || ST.memoryStore(); let clock = Date.UTC(2026, 10, 10, 12); const fetched = [];
  const env = o.env === undefined ? ENV : o.env;
  const deps = { env, store, who: async () => OWNER, sameOrigin: () => true, data: DATA, now: () => (clock += 1000), fetch: async (u) => { fetched.push(String(u)); throw new Error('no network in this test'); }, sleep: async () => {}, host: 'meridianx.dev' };
  return { store, deps, env, fetched, mcp: { env, store, data: DATA, now: deps.now, guard: o.guard || NO_GUARD } };
}
async function call(ctx, method, payload) {
  const out = { headers: {} }, res = { setHeader: (k, v) => { out.headers[k] = v; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } };
  await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, ctx.deps);
  return out;
}
const get = (ctx, q) => call(ctx, 'GET', q), post = (ctx, b) => call(ctx, 'POST', b);
async function engineAttempt(ctx, p, mode = p.c.pool === 'exam' ? 'exam' : 'train') {
  const r = await post(ctx, { action: 'attempt', attempt: { candidateId: p.c.id, edge: EDGE.id, mode, decision: p.d, lessonsAvailable: [], snapshotHash: p.hash }, features: p.f });
  assert.equal(r.code, 200, JSON.stringify(r.body)); return r.body.attempt.id;
}
const body = (p, attemptId, more = {}) => ({ action: 'analyse', edge: EDGE.id, candidateId: p.c.id, attemptId, snapshot: { t: p.snap.t, hash: p.hash, bars: p.digest.bars, dataVersion: p.snap.dataVersion }, features: p.f, deterministic: p.d, thesis: p.thesis, cost: COST, ...more });
// the assistant app: one JSON-RPC message to the connector
async function rpc(ctx, msg, o = {}) {
  const out = { headers: {} }, res = { setHeader: (k, v) => { out.headers[k] = v; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; }, end() { return out; } };
  await MCP.handle({ method: o.method || 'POST', headers: o.headers || {}, query: { key: o.key === undefined ? CN.keyOf(ctx.env) : o.key }, body: msg }, res, ctx.mcp);
  return out;
}
const tool = async (ctx, name, args = {}) => { const r = await rpc(ctx, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }); assert.equal(r.code, 200, JSON.stringify(r.body)); return r.body.result; };
const factsOf = (question) => JSON.parse(/<facts>\n([\s\S]*?)\n<\/facts>/.exec(question)[1]);
const goodAnswer = (question, o = {}) => ({ ...FAKE.answerFor(factsOf(question)), ...o });
const audit = async (ctx) => (await get(ctx, { get: 'audit', month: '2026-11' })).body.rows;

// ============================================================================================================================
test('the key: derived from the session secret, shown to the owner only, switched off or changed from the environment', async () => {
  assert.match(KEY, /^[0-9a-f]{40}$/); assert.equal(CN.keyOf(ENV), KEY, 'the same key every time');
  assert.equal(CN.keyOf({}), null, 'no session secret: no key'); assert.equal(CN.keyOk({}, ''), false); assert.equal(CN.keyOk({}, KEY), false);
  assert.equal(CN.keyOk(ENV, KEY), true); assert.equal(CN.keyOk(ENV, KEY.slice(0, 39) + (KEY[39] === '0' ? '1' : '0')), false); assert.equal(CN.keyOk(ENV, KEY + 'a'), false); assert.equal(CN.keyOk(ENV, undefined), false);
  assert.notEqual(CN.keyOf({ ...ENV, ACADEMY_CONNECTOR_SALT: 'x' }), KEY, 'a salt changes the key: the old address stops working');
  assert.equal(CN.keyOf({ ...ENV, ACADEMY_CONNECTOR: 'off' }), null); assert.match(CN.unavailable({ ...ENV, ACADEMY_CONNECTOR: 'off' }), /switched off/); assert.match(CN.unavailable({}), /no session secret/);
  assert.notEqual(CN.keyOf({ CRON_SECRET: 'another-secret-value-1234567890' }), null, 'the fallback secret of the session module works too');
  const own = CN.keyOf({ ACADEMY_CONNECTOR_SECRET: 'a-connector-secret-of-its-own-01' }); assert.match(own, /^[0-9a-f]{40}$/); assert.notEqual(own, KEY); assert.equal(CN.keyOf({ ...ENV, ACADEMY_CONNECTOR_SECRET: 'a-connector-secret-of-its-own-01' }), own, 'its own secret wins over the session\'s');
  assert.equal(CN.keyOf({ ...ENV, ACADEMY_CONNECTOR_SECRET: 'short' }), KEY, 'a short one is ignored');
  // the owner's session reads the address; every route of the Academy API is owner-only (tests/academy-security.test.mjs)
  const ctx = mk(), c = (await get(ctx, { get: 'connector' })).body;
  assert.deepEqual(c, { available: true, url: `https://meridianx.dev/api/academy-mcp/${KEY}`, pending: 0 });
  const offCtx = mk({ env: {} }); assert.deepEqual((await get(offCtx, { get: 'connector' })).body, { available: false, reason: 'the server has no session secret yet, so the connector has no key' });
  // the key is not the session secret and does not reveal it
  assert.ok(!KEY.includes('a-test-secret')); assert.ok(!src('api/academy-mcp.js').includes('SESSION_SECRET'));
});

test('no key, no connector: the analyst stays off and nothing is queued (as before)', async () => {
  const ctx = mk({ env: {} }), id = await engineAttempt(ctx, TAKEN), r = await post(ctx, body(TAKEN, id));
  assert.deepEqual(r.body, { ok: true, available: false, reason: 'no language-model key configured' }); assert.equal(ctx.store.peek('analyst/queue.json'), undefined);
  const off = mk({ env: { ...ENV, ACADEMY_CONNECTOR: 'off' } }), id2 = await engineAttempt(off, TAKEN);
  assert.equal((await post(off, body(TAKEN, id2))).body.available, false); assert.equal((await get(off, { get: 'cost' })).body.connector.on, false);
});

test('asking on the page queues the question: no provider call, no cost, one row per question, the cost read says what waits', async () => {
  const ctx = mk(), id = await engineAttempt(ctx, TAKEN);
  assert.deepEqual((await get(ctx, { get: 'cost' })).body.connector, { on: true, pending: 0, max: API.QUEUE_MAX, oldest: null });
  const dry = (await post(ctx, body(TAKEN, id, { dryRun: true }))).body; assert.equal(dry.available, true); assert.equal(dry.provider, 'connector'); assert.deepEqual(dry.estimate, { tokensIn: 0, maxTokensOut: 0, usd: 0 }); assert.equal(ctx.store.peek('analyst/queue.json'), undefined, 'a dry run queues nothing');
  const r = (await post(ctx, body(TAKEN, id))).body;
  assert.equal(r.available, true); assert.equal(r.queued, true); assert.equal(r.provider, 'connector'); assert.equal(r.decision, null); assert.equal(r.attempt, null); assert.equal(r.costUsd, 0);
  assert.equal(r.queue.position, 1); assert.equal(r.queue.pending, 1); assert.equal(r.queue.fresh, true);
  assert.deepEqual(ctx.fetched, [], 'nothing was fetched: no provider exists'); assert.equal(ctx.store.peek('cost.json'), undefined, 'the ledger is untouched');
  assert.equal(ctx.store.peek(`analyst/attempts/${EDGE.id}.json`), undefined, 'a queued question is not an answer');
  // the same question again is the same row
  const again = (await post(ctx, body(TAKEN, id))).body; assert.equal(again.queue.id, r.queue.id); assert.equal(again.queue.fresh, false); assert.equal(ctx.store.peek('analyst/queue.json').rows.length, 1);
  const c = (await get(ctx, { get: 'cost' })).body.connector; assert.equal(c.pending, 1); assert.equal(typeof c.oldest, 'string');
  assert.match((await audit(ctx))[0].summary, /question queued for the owner's assistant \(the connector\); no provider call, no cost/);
  // the engine answers first, as with a provider
  const noAttempt = await post(ctx, body(OTHER, 'at_missing0000000'));
  assert.equal(noAttempt.code, 409, JSON.stringify(noAttempt.body)); assert.match(noAttempt.body.error, /decide first/);
});

test('the queue never holds a result or a later bar: the question is the request the server built and checked', async () => {
  const ctx = mk(), id = await engineAttempt(ctx, TAKEN); await post(ctx, body(TAKEN, id));
  const row = ctx.store.peek('analyst/queue.json').rows[0], text = JSON.stringify(row);
  const out = json(`academy/data/out-${EDGE.id}.json`), oc = (Array.isArray(out) ? out : Object.values(out)).find((o) => o.id === TAKEN.c.id);
  assert.ok(oc && typeof oc.netR === 'number');
  // (the setup's own rule text has an `exit` line: how the edge exits by rule, not how this trade ended)
  for (const k of ['R', 'netR', 'exitT', 'mfeR', 'maeR', 'outcome', 'result', 'reason', 'unitR', 'fillT']) assert.ok(!new RegExp(`"${k}"\\s*:`).test(row.prompt), `the question names no "${k}" field`);
  assert.deepEqual(AN._t.outcomeKeys({ cand: factsOf(row.prompt).setup || {} }, '', [], 0).filter((k) => !/\.(rule|factsFromTheEdge)\.exit$/.test(k)), [], 'and the checker of the request finds none');
  assert.ok(!text.includes(String(oc.exitT)), 'the exit time of the trade is nowhere in the row');
  const facts = factsOf(row.prompt), lastBar = Math.max(...Object.values(facts.closedBars || facts.bars || {}).flatMap((rows) => (Array.isArray(rows) ? rows.map((b) => (Array.isArray(b) ? b[0] : b.time)) : [])).filter(Number.isFinite), 0);
  assert.ok(lastBar <= TAKEN.c.t, 'no bar after the decision time');
  // a payload carrying an outcome is refused before anything is queued
  const id2 = await engineAttempt(ctx, OTHER), bad = await post(ctx, { ...body(OTHER, id2), deterministic: { ...OTHER.d, netR: 1.5 } });
  assert.equal(bad.code, 400, JSON.stringify(bad.body)); assert.equal(ctx.store.peek('analyst/queue.json').rows.length, 1);
});

test('the connector: wrong key 401, key off 401, GET 405, foreign origin 403; initialize, ping, the four tools', async () => {
  const ctx = mk();
  for (const key of ['', 'nope', KEY.replace(/^./, (c) => (c === '0' ? '1' : '0')), null]) { const r = await rpc(ctx, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { key }); assert.equal(r.code, 401, String(key)); assert.equal(r.body.error.code, -32001); }
  let failed = 0; const counting = mk({ guard: { ...NO_GUARD, failed: () => { failed++; } } }); await rpc(counting, { jsonrpc: '2.0', id: 1, method: 'ping' }, { key: 'wrong' }); assert.equal(failed, 1, 'a wrong key counts against the shared guess limit');
  const blocked = mk({ guard: { ...NO_GUARD, wait: () => 30 } }); assert.equal((await rpc(blocked, { jsonrpc: '2.0', id: 1, method: 'ping' })).code, 429);
  const off = mk({ env: { ...ENV, ACADEMY_CONNECTOR: 'off' } }); assert.equal((await rpc(off, { jsonrpc: '2.0', id: 1, method: 'ping' }, { key: KEY })).code, 401, 'switched off: the old key opens nothing');
  assert.equal((await rpc(ctx, null, { method: 'GET' })).code, 405); assert.equal((await rpc(ctx, null, { method: 'DELETE' })).code, 405);
  assert.equal((await rpc(ctx, { jsonrpc: '2.0', id: 1, method: 'ping' }, { headers: { origin: 'https://evil.example' } })).code, 403);
  assert.equal((await rpc(ctx, null, { method: 'OPTIONS', headers: { origin: 'https://claude.ai' }, key: '' })).code, 204);
  const init = (await rpc(ctx, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })).body.result;
  assert.equal(init.protocolVersion, '2025-06-18'); assert.equal(init.serverInfo.name, 'meridianx-academy'); assert.match(init.instructions, /never shown a result/); assert.match(init.instructions, /Nothing here places an order/);
  assert.equal((await rpc(ctx, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).body.result.protocolVersion, MCP._t.VERSIONS[0]);
  assert.deepEqual((await rpc(ctx, { jsonrpc: '2.0', id: 7, method: 'ping' })).body, { jsonrpc: '2.0', id: 7, result: {} });
  assert.equal((await rpc(ctx, { jsonrpc: '2.0', method: 'notifications/initialized' })).code, 202);
  const tools = (await rpc(ctx, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).body.result.tools;
  assert.deepEqual(tools.map((t) => t.name), ['academy_guide', 'academy_pending', 'academy_question', 'academy_answer']);
  for (const t of tools) { assert.equal(t.inputSchema.additionalProperties, false); assert.equal(t.annotations.destructiveHint, false); assert.equal(t.annotations.readOnlyHint, t.name !== 'academy_answer'); }
  assert.equal((await rpc(ctx, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ict_apply_change', arguments: {} } })).body.error.code, -32602, 'no other tool exists here');
  assert.equal((await rpc(ctx, { jsonrpc: '2.0', id: 3, method: 'resources/list' })).body.error.code, -32601);
  const g = (await tool(ctx, 'academy_guide')).structuredContent; assert.equal(g.answerShape, AN.SHAPE); assert.ok(g.workflow.length >= 5); assert.ok(g.rules.some((r) => /Never a probability/.test(r)));
  assert.deepEqual((await tool(ctx, 'academy_pending')).structuredContent.questions, []);
});

test('the whole loop: queued on the page, read and answered through the connector, checked, stored apart, shown on the page', async () => {
  const ctx = mk(), id = await engineAttempt(ctx, TAKEN), q = (await post(ctx, body(TAKEN, id))).body.queue;
  const pend = (await tool(ctx, 'academy_pending')).structuredContent; assert.equal(pend.pending, 1);
  assert.deepEqual(pend.questions[0], { id: q.id, position: 1, askedAt: q.at, edge: EDGE.id, market: TAKEN.c.market, side: TAKEN.c.side, ask: 'setup', kind: 'training setup', tries: 0, lastRefusal: null });
  const one = (await tool(ctx, 'academy_question', { id: q.id })).structuredContent;
  assert.equal(one.rules, AN.SYSTEM, 'the same rules a provider would get'); assert.match(one.question, /<facts>/); assert.equal(one.triesLeft, API.QUEUE_TRIES);
  const ans = goodAnswer(one.question), sent = (await tool(ctx, 'academy_answer', { id: q.id, answer: ans, by: 'owner assistant' })).structuredContent;
  assert.equal(sent.stored, true); assert.equal(sent.action, ans.action); assert.equal(sent.attempt.n, 1); assert.equal(sent.attempt.mode, 'train');
  // stored in the analyst's own files, labelled, free; the queue is empty; the engine's files are untouched by it
  const rows = ctx.store.peek(`analyst/attempts/${EDGE.id}.json`).rows; assert.equal(rows.length, 1);
  assert.equal(rows[0].engine, 'language-model'); assert.equal(rows[0].llm.provider, 'connector'); assert.equal(rows[0].llm.model, 'owner assistant'); assert.equal(rows[0].llm.costUsd, 0); assert.equal(rows[0].engineAttemptId, id);
  assert.deepEqual(ctx.store.peek('analyst/queue.json').rows, []); assert.equal(ctx.store.peek(`attempts/${EDGE.id}.json`).rows.length, 1, 'the engine has its one attempt and no more');
  assert.equal(ctx.store.peek('cost.json'), undefined, 'no ledger entry: nothing was billed'); assert.deepEqual(ctx.fetched, []);
  assert.match((await audit(ctx))[0].summary, new RegExp(`analyst ${ans.action}.*connector, through the connector, no provider call, no cost`));
  // the page asks again ("Check for the answer"): the stored answer comes back, nothing is queued again
  const back = (await post(ctx, body(TAKEN, id))).body;
  assert.equal(back.queued, undefined); assert.equal(back.provider, 'connector'); assert.equal(back.decision.action, ans.action); assert.equal(back.attempt.id, rows[0].id); assert.equal(back.attempt.stored, false); assert.equal(back.cached, true);
  assert.deepEqual(ctx.store.peek('analyst/queue.json').rows, []);
  // answered: the question is gone for the connector too
  const gone = await tool(ctx, 'academy_question', { id: q.id }); assert.equal(gone.isError, true); assert.match(gone.content[0].text, /no such question/);
  const twice = await tool(ctx, 'academy_answer', { id: q.id, answer: ans }); assert.equal(twice.isError, true);
  // the mentor can correct it like any analyst answer
  const cor = await post(ctx, { action: 'correct', engine: 'language-model', edge: EDGE.id, correction: { attemptId: rows[0].id, verdict: 'approve' } }); assert.equal(cor.code, 200, JSON.stringify(cor.body));
});

test('a refused answer stores nothing and can be sent again; after the last try the question leaves the queue and the page says why', async () => {
  const ctx = mk(), id = await engineAttempt(ctx, TAKEN), q = (await post(ctx, body(TAKEN, id))).body.queue, one = (await tool(ctx, 'academy_question', { id: q.id })).structuredContent, good = goodAnswer(one.question);
  const side = TAKEN.c.side === 'buy' ? 'BUY' : 'SELL';
  const cases = [
    ['a probability', { ...good, probability: 0.7 }, /probab|key/i],
    ['a trade without a stop', { ...good, action: side, entry: TAKEN.c.entry, stop: null, target: TAKEN.c.target }, /stop/i],
    ['not JSON', 'I would buy here, it looks strong.', /JSON/i],
  ];
  let left = API.QUEUE_TRIES;
  for (const [what, a, re] of cases.slice(0, API.QUEUE_TRIES - 1)) {
    const r = await tool(ctx, 'academy_answer', { id: q.id, answer: a }); left--;
    assert.equal(r.isError, true, what); const o = JSON.parse(r.content[0].text); assert.equal(o.stored, false); assert.match(o.refusals.join(' '), re, what); assert.equal(o.triesLeft, left);
    assert.equal(ctx.store.peek(`analyst/attempts/${EDGE.id}.json`), undefined, `${what}: nothing stored as an answer`);
    assert.equal(ctx.store.peek('analyst/queue.json').rows[0].tries, API.QUEUE_TRIES - left);
    // the page checking in between still sees the question waiting, with the last refusal named
    const mid = (await post(ctx, body(TAKEN, id))).body; assert.equal(mid.queued, true); assert.equal(mid.queue.tries, API.QUEUE_TRIES - left); assert.match(mid.queue.lastRefusal, re);
  }
  assert.equal((await tool(ctx, 'academy_pending')).structuredContent.questions[0].tries, API.QUEUE_TRIES - 1);
  // a good answer after refusals is stored
  const ok = (await tool(ctx, 'academy_answer', { id: q.id, answer: JSON.stringify(good) })).structuredContent; assert.equal(ok.stored, true); assert.deepEqual(ctx.store.peek('analyst/queue.json').rows, []);
  // every try refused: the question leaves the queue, the page shows the refusal and can queue it again
  const c2 = mk(), id2 = await engineAttempt(c2, TAKEN), q2 = (await post(c2, body(TAKEN, id2))).body.queue;
  for (let i = 0; i < API.QUEUE_TRIES; i++) { const r = JSON.parse((await tool(c2, 'academy_answer', { id: q2.id, answer: cases[2][1] })).content[0].text); assert.equal(r.triesLeft, API.QUEUE_TRIES - 1 - i); }
  assert.deepEqual(c2.store.peek('analyst/queue.json').rows, []);
  const shown = (await post(c2, body(TAKEN, id2))).body; assert.equal(shown.queued, undefined); assert.equal(shown.decision, null); assert.match(shown.refusals.join(' '), /JSON/i); assert.equal(shown.provider, 'connector');
  const requeued = (await post(c2, body(TAKEN, id2, { retry: true }))).body; assert.equal(requeued.queued, true); assert.equal(requeued.queue.fresh, true); assert.equal(requeued.queue.tries, 0);
  assert.equal((await post(c2, body(TAKEN, id2))).body.queued, true, 'the refused answer is forgotten once the question is queued again');
  assert.equal(c2.store.peek(`analyst/attempts/${EDGE.id}.json`), undefined);
});

test('the engine\'s hard gates and the risk engine hold through the connector: a trade wanted through a gate is stored as WAIT', async () => {
  const ctx = mk(), id = await engineAttempt(ctx, GATED), q = (await post(ctx, body(GATED, id))).body.queue, one = (await tool(ctx, 'academy_question', { id: q.id })).structuredContent;
  const side = GATED.c.side === 'buy' ? 'BUY' : 'SELL', want = goodAnswer(one.question, { action: side, entry: GATED.c.entry, stop: GATED.c.stop, target: GATED.c.target, waitReasons: [] });
  const r = await tool(ctx, 'academy_answer', { id: q.id, answer: want }), o = r.structuredContent || JSON.parse(r.content[0].text);
  if (o.stored) { assert.equal(o.action, 'WAIT'); assert.equal(o.forced, true); assert.equal(o.wanted, side); assert.ok(o.heldBy.length >= 1); assert.equal(ctx.store.peek(`analyst/attempts/${EDGE.id}.json`).rows[0].decision.action, 'WAIT'); }
  else assert.ok(o.refusals.length >= 1, 'or the checks refuse it outright: either way no trade is stored');
  // the risk engine says no: the same
  const blockedPoint = point(TAKEN.c, { risk: { allowed: false, blocks: ['daily loss limit reached'], riskPct: 0.25 } }), c2 = mk(), id2 = await engineAttempt(c2, blockedPoint), q2 = (await post(c2, body(blockedPoint, id2))).body.queue;
  const two = (await tool(c2, 'academy_question', { id: q2.id })).structuredContent, s2 = TAKEN.c.side === 'buy' ? 'BUY' : 'SELL';
  const r2 = await tool(c2, 'academy_answer', { id: q2.id, answer: goodAnswer(two.question, { action: s2, entry: TAKEN.c.entry, stop: TAKEN.c.stop, target: TAKEN.c.target, waitReasons: [] }) }), o2 = r2.structuredContent || JSON.parse(r2.content[0].text);
  const stored = c2.store.peek(`analyst/attempts/${EDGE.id}.json`);
  assert.ok(!stored || stored.rows.every((a) => a.decision.action === 'WAIT'), 'no BUY or SELL is stored through a risk block'); assert.ok(o2.stored === false || o2.action === 'WAIT');
});

test('an unseen (test) setup is decided once through the connector; the queue has a size limit; a store failure answers plainly', async () => {
  const ep = point(EXAM[0]), ctx = mk(), id = await engineAttempt(ctx, ep, 'exam'), q = (await post(ctx, body(ep, id))).body.queue;
  assert.equal((await tool(ctx, 'academy_pending')).structuredContent.questions[0].kind, 'unseen setup (decided once)');
  const one = (await tool(ctx, 'academy_question', { id: q.id })).structuredContent, a = (await tool(ctx, 'academy_answer', { id: q.id, answer: goodAnswer(one.question) })).structuredContent;
  assert.equal(a.stored, true); assert.equal(a.attempt.mode, 'exam');
  const again = await post(ctx, body(ep, id, { thesis: { ...ep.thesis, text: 'another thesis' } })); assert.ok(again.code === 409 || again.body.queued !== true, 'a second, different question on a decided test setup is not queued');
  // the limit
  const full = mk(), seed = { v: 1, rows: Array.from({ length: API.QUEUE_MAX }, (_, i) => ({ id: `aq_seed${String(i).padStart(4, '0')}`, k: `k${i}`, at: '2026-11-10T00:00:00.000Z', edge: EDGE.id, candidateId: 'x', ask: 'setup', prompt: 'p', context: {}, tries: 0 })) };
  await full.store.put('analyst/queue.json', seed); const idf = await engineAttempt(full, TAKEN), over = await post(full, body(TAKEN, idf));
  assert.equal(over.code, 409); assert.match(over.body.error, new RegExp(`${API.QUEUE_MAX} questions already wait`));
  // the store fails while an answer is being stored: said plainly, nothing half written, the question still waits
  const c3 = mk(), id3 = await engineAttempt(c3, TAKEN), q3 = (await post(c3, body(TAKEN, id3))).body.queue, one3 = (await tool(c3, 'academy_question', { id: q3.id })).structuredContent;
  const real = c3.store.backend.write; c3.store.backend.write = async () => { throw new Error('blob write 500 (token vercel_blob_rw_XXXX)'); };
  const fail = await tool(c3, 'academy_answer', { id: q3.id, answer: goodAnswer(one3.question) }); assert.equal(fail.isError, true); assert.equal(fail.content[0].text, 'the Academy store is unavailable: nothing was saved, try again');
  c3.store.backend.write = real; assert.equal(c3.store.peek('analyst/queue.json').rows.length, 1); assert.equal(c3.store.peek(`analyst/attempts/${EDGE.id}.json`), undefined);
  assert.equal((await tool(c3, 'academy_answer', { id: q3.id, answer: goodAnswer(one3.question) })).structuredContent.stored, true);
});

test('with a provider key set the connector path is not used: the paid path is unchanged', async () => {
  const fake = FAKE.make({}), ctx = mk({ env: { ...ENV, ACADEMY_LLM_KEY: 'sk-test', ACADEMY_LLM_URL: 'https://llm.invalid/v1/answer', ACADEMY_LLM_MODEL: '<model id>' } }); ctx.deps.fetch = fake.fetch;
  const id = await engineAttempt(ctx, TAKEN), r = (await post(ctx, body(TAKEN, id))).body;
  assert.equal(r.queued, undefined); assert.ok(r.decision, JSON.stringify(r).slice(0, 300)); assert.notEqual(r.provider, 'connector'); assert.equal(fake.calls.length, 1); assert.equal(ctx.store.peek('analyst/queue.json'), undefined);
  assert.equal((await get(ctx, { get: 'cost' })).body.connector, undefined);
});

test('isolation and wiring: the connector imports the Academy only, names no order path, and is routed and bundled', () => {
  const mcp = src('api/academy-mcp.js'), cn = src('api/_academy-connector.js');
  assert.deepEqual([...mcp.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]), ['./_academy-connector.js', './academy.js', './_academy-analyst.js', './_guard.js']);
  assert.deepEqual([...cn.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]), ['node:crypto', './_session.js']);
  for (const [name, text] of [['api/academy-mcp.js', mcp], ['api/_academy-connector.js', cn]]) {
    assert.ok(!/council\/|ctrader|mirror\.mjs|NEW_ORDER|placeOrder|sendOrder|trades\.json|GH_TOKEN|GH_MCP_TOKEN|BLOB_READ_WRITE_TOKEN/.test(text), `${name} names no trading, broker, repository or storage-token path`);
    assert.ok(!/\bfetch\s*\(|https?:\/\/(?!\$\{)/.test(text.replace(/\/\/.*$/gm, '').replace(/\/\^https[^,\]]+/g, '')), `${name} makes no request of its own`);
  }
  assert.ok(!/console\.log\([^)]*\b(key|given)\b/.test(mcp), 'the key is never logged');
  const v = json('vercel.json');
  assert.ok(v.rewrites.some((r) => r.source === '/api/academy-mcp/:key' && r.destination === '/api/academy-mcp?key=:key'));
  assert.equal(v.functions['api/academy-mcp.js'].includeFiles, v.functions['api/academy.js'].includeFiles, 'the connector function ships the same Academy files');
  assert.ok(Object.keys(API.GET).includes('connector')); assert.ok(src('api/academy.js').slice(0, 4000).includes('connector'));
});
