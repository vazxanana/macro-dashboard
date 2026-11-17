// The language-model adapter's streaming path (17 Nov 2026, ChronosTrade's coach "needs to be faster"): server-sent events of the
// 'messages' format parsed (text deltas handed over, thinking deltas ignored, usage from message_start / message_delta), the same
// budget reservation and ledger correction as complete(), refusals, the output cap, and a stream that breaks off in the middle.
// Offline: a fake provider, a memory store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const LLM = require('../api/_academy-llm.js'), ST = require('../api/_academy-store.js');
const ENV = { ACADEMY_LLM_KEY: 'k-secret', ACADEMY_LLM_URL: 'https://llm.invalid/v1/messages', ACADEMY_LLM_MODEL: 'm-test', ACADEMY_LLM_FORMAT: 'messages',
  ACADEMY_LLM_USD_PER_MTOK_IN: '4', ACADEMY_LLM_USD_PER_MTOK_OUT: '20', ACADEMY_LLM_DAILY_USD: '1' };
const ev = (type, o) => `event: ${type}\ndata: ${JSON.stringify({ type, ...o })}\n\n`;
const START = ev('message_start', { message: { model: 'm-test', usage: { input_tokens: 900, cache_read_input_tokens: 300, output_tokens: 1 } } });
const THINK = ev('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } }) + ev('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: 'secret reasoning' } }) + ev('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'sig' } }) + ev('content_block_stop', { index: 0 });
const TEXT = (parts) => ev('content_block_start', { index: 1, content_block: { type: 'text', text: '' } }) + parts.map((t) => ev('content_block_delta', { index: 1, delta: { type: 'text_delta', text: t } })).join('') + ev('content_block_stop', { index: 1 });
const END = (stop = 'end_turn', out = 120) => ev('message_delta', { delta: { stop_reason: stop }, usage: { output_tokens: out } }) + ev('message_stop', {});
// a body as a web ReadableStream, cut into arbitrary chunks (an event may be split across two)
function body(text, { cut = 37, failAt = null, abortAt = null } = {}) {
  const enc = new TextEncoder(); let i = 0;
  return new ReadableStream({ pull(c) {
    if (failAt != null && i >= failAt) return c.error(new Error('socket hang up'));
    if (abortAt != null && i >= abortAt) return c.error(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    if (i >= text.length) return c.close(); c.enqueue(enc.encode(text.slice(i, i + cut))); i += cut; } });
}
function fake(text, o = {}) { const F = { bodies: [] }; F.fn = async (url, init) => { F.bodies.push(JSON.parse(init.body)); return o.status ? { ok: false, status: o.status, headers: { get: () => null }, json: async () => ({ type: 'error', error: { type: 'invalid_request_error', message: o.msg || 'bad field' } }) } : { ok: true, status: 200, headers: { get: () => null }, body: body(text, o) }; }; return F; }
const day = (st) => st.peek('cost.json').days[Object.keys(st.peek('cost.json').days)[0]];

test('the SSE parser: text deltas in order across split chunks, thinking ignored, usage and stop reason read', async () => {
  const F = fake(START + THINK + TEXT(['Your stop ', 'sits 1.2 ATR ', 'under the level.']) + END()), st = ST.memoryStore(), got = [];
  const r = await LLM.stream({ system: 'sys', prompt: 'p', cap: 'feature', maxTokens: 600, cacheSystem: true }, { env: ENV, store: st, fetch: F.fn }, (t) => got.push(t));
  assert.equal(r.text, 'Your stop sits 1.2 ATR under the level.'); assert.deepEqual(got, ['Your stop ', 'sits 1.2 ATR ', 'under the level.']);
  assert.ok(!got.join('').includes('secret'), 'thinking never reaches the caller'); assert.equal(r.stop, 'end'); assert.equal(r.model, 'm-test');
  assert.equal(r.usage.tokensIn, 1200); assert.equal(r.usage.cacheRead, 300); assert.equal(r.usage.tokensOut, 120); assert.equal(r.usage.estimated, false);
  assert.ok(r.ms && r.ms.first >= 0 && r.ms.total >= r.ms.first);
  // the request: stream on, the system text one cacheable block, the cap as asked
  const b = F.bodies[0]; assert.equal(b.stream, true); assert.equal(b.max_tokens, 600); assert.deepEqual(b.system, [{ type: 'text', text: 'sys', cache_control: { type: 'ephemeral' } }]);
  // the ledger: the reservation corrected to the reported usage (900 at 4, 300 read at 4, 120 out at 20 per million)
  assert.equal(day(st).usd, +((900 * 4 + 300 * 4 + 120 * 20) / 1e6).toFixed(6)); assert.equal(day(st).requests, 1);
  // cached: the same question again is answered from the cache, handed over in one piece, not billed
  const got2 = []; const r2 = await LLM.stream({ system: 'sys', prompt: 'p', cap: 'feature', maxTokens: 600 }, { env: ENV, store: st, fetch: F.fn }, (t) => got2.push(t));
  assert.equal(r2.cached, true); assert.deepEqual(got2, [r.text]); assert.equal(F.bodies.length, 1);
  // the parser alone: a split event is kept for the next chunk
  const sp = LLM._t.sseSplit('event: a\ndata: {"x":1}\n\nevent: b\ndata: {"y"'); assert.equal(sp.events.length, 1); assert.equal(sp.rest, 'event: b\ndata: {"y"');
  // ACADEMY_LLM_BODY can never switch streaming on for a complete() call
  const F3 = { n: 0 }, f3 = async (u, init) => { F3.b = JSON.parse(init.body); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ content: [{ type: 'text', text: 'x' }], stop_reason: 'end_turn' }) }; };
  await LLM.complete({ prompt: 'q', maxTokens: 50 }, { env: { ...ENV, ACADEMY_LLM_BODY: '{"stream":true}' }, store: ST.memoryStore(), fetch: f3 }); assert.equal(F3.b.stream, undefined);
});

test('a refusal, the output cap and a provider error before the stream', async () => {
  let st = ST.memoryStore();
  let r = await LLM.stream({ prompt: 'p', cap: 'feature', maxTokens: 300 }, { env: ENV, store: st, fetch: fake(START + END('refusal', 3)).fn });
  assert.equal(r.text, undefined); assert.match(r.error, /declined/); assert.equal(r.stop, 'refusal'); assert.ok(r.costUsd > 0, 'billed as reported');
  st = ST.memoryStore();
  r = await LLM.stream({ prompt: 'p', cap: 'feature', maxTokens: 300 }, { env: ENV, store: st, fetch: fake(START + TEXT(['{"summ']) + END('max_tokens', 300)).fn });
  assert.equal(r.stop, 'length'); assert.equal(st.peek('llm-cache.json'), undefined, 'an answer cut at the cap is never cached');
  assert.match(LLM.cutAtCap(r, 'CHRONOS_LLM_MAX_TOKENS').error, /CHRONOS_LLM_MAX_TOKENS/);
  st = ST.memoryStore();
  r = await LLM.stream({ prompt: 'p', cap: 'feature', maxTokens: 300 }, { env: ENV, store: st, fetch: fake('', { status: 400, msg: 'output_config.effort: unknown value' }).fn });
  assert.equal(r.status, 400); assert.match(r.detail, /effort/); assert.equal(day(st).usd, 0, 'refused before the stream: not billed, the reservation given back'); assert.equal(day(st).requests, 0);
});

test('a stream that breaks off or times out in the middle keeps its reservation as billed and is never an answer', async () => {
  for (const o of [{ failAt: 200 }, { abortAt: 200 }]) {
    const st = ST.memoryStore(), got = [];
    const r = await LLM.stream({ prompt: 'p', cap: 'feature', maxTokens: 400 }, { env: ENV, store: st, fetch: fake(START + TEXT(['First words. ', 'More words that never end']) + END(), { cut: 20, ...o }).fn }, (t) => got.push(t));
    assert.equal(r.text, undefined); assert.ok(r.error); assert.equal(r.costEstimated, true); assert.equal(typeof r.partial, 'string');
    assert.equal(day(st).unconfirmed, 1); assert.ok(day(st).usd > 0, 'the estimate stays in the ledger'); assert.equal(st.peek('llm-cache.json'), undefined);
    if (o.abortAt) assert.match(r.error, /timed out/); else assert.match(r.error, /broke off/);
  }
  // an `error` event in the middle (an overloaded provider)
  const st = ST.memoryStore();
  const r = await LLM.stream({ prompt: 'p', cap: 'feature', maxTokens: 400 }, { env: ENV, store: st, fetch: fake(START + TEXT(['Half ']) + ev('error', { error: { type: 'overloaded_error', message: 'Overloaded' } })).fn });
  assert.equal(r.errorType, 'overloaded_error'); assert.equal(r.partial, 'Half '); assert.equal(day(st).unconfirmed, 1);
  // the key never appears in what is returned
  assert.ok(!JSON.stringify(r).includes('k-secret'));
});

test('the chat format has no stream here: one ordinary call, the whole text handed over once', async () => {
  const st = ST.memoryStore(), got = [], f = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: 'All at once.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 3 } }) });
  const r = await LLM.stream({ prompt: 'p', maxTokens: 100 }, { env: { ...ENV, ACADEMY_LLM_FORMAT: 'chat' }, store: st, fetch: f }, (t) => got.push(t));
  assert.equal(r.text, 'All at once.'); assert.deepEqual(got, ['All at once.']); assert.ok(r.ms.total >= 0);
  assert.deepEqual(await LLM.stream({ prompt: 'p' }, { env: {}, store: st }), { available: false, reason: 'no language-model key configured' });
});
