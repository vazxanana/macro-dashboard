// The language-model adapter with a model that always reasons before it answers (17 Nov 2026): reasoning counts as output, the
// reasoning text is not returned (a thinking block with an empty text), only text blocks are the answer; an answer cut at the
// output cap is never taken or cached; the feature callers' caps; the effort set through ACADEMY_LLM_BODY. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const LLM = require('../api/_academy-llm.js'), ST = require('../api/_academy-store.js');
const ENV = { ACADEMY_LLM_KEY: 'k-test-123', ACADEMY_LLM_URL: 'https://llm.invalid/v1/messages', ACADEMY_LLM_MODEL: 'm-test', ACADEMY_LLM_FORMAT: 'messages',
  ACADEMY_LLM_USD_PER_MTOK_IN: '4', ACADEMY_LLM_USD_PER_MTOK_OUT: '20', ACADEMY_LLM_DAILY_USD: '5', ACADEMY_LLM_MONTHLY_USD: '50' };
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

function provider(reply) {
  const P = { bodies: [], headers: [] };
  P.fetch = async (url, o) => { P.bodies.push(JSON.parse(o.body)); P.headers.push(o.headers); const j = typeof reply === 'function' ? reply(P.bodies.length) : reply;
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => j }; };
  return P;
}
const thinkingThenText = (text, stop = 'end_turn') => ({ model: 'm-test', stop_reason: stop, content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text }],
  usage: { input_tokens: 1200, output_tokens: 1500 } });

test('reasoning model: the empty thinking block is skipped, the text block is the answer, reasoning is billed as output', async () => {
  const P = provider(thinkingThenText('{"ok":true}')), store = ST.memoryStore();
  const r = await LLM.complete({ system: 's', prompt: 'p', cap: 'feature', maxTokens: 4000 }, { env: ENV, store, fetch: P.fetch, now: () => Date.UTC(2026, 10, 17) });
  assert.equal(r.text, '{"ok":true}'); assert.equal(r.stop, 'end'); assert.equal(r.usage.tokensOut, 1500);
  assert.equal(r.costUsd, Math.round((1200 * 4 + 1500 * 20)) / 1e6);
  assert.equal(P.bodies[0].max_tokens, 4000, 'a feature caller gets the cap it asks for');
  assert.equal(P.headers[0]['x-api-key'], 'k-test-123'); assert.ok(P.headers[0]['anthropic-version']);
  assert.equal(LLM._t.parse({ content: [{ type: 'thinking', thinking: '' }], stop_reason: 'end_turn' }).text, '', 'reasoning alone is no answer');
});

test('an answer cut at the output cap is not taken and not cached; the caller sees an error naming its variable', async () => {
  const P = provider(thinkingThenText('{"verdict":"TA', 'max_tokens')), store = ST.memoryStore(), d = { env: ENV, store, fetch: P.fetch, now: () => Date.UTC(2026, 10, 17) };
  const r = await LLM.complete({ system: 's', prompt: 'p', cap: 'feature', maxTokens: 900 }, d);
  assert.equal(r.stop, 'length');
  assert.equal(store.peek('llm-cache.json'), undefined, 'a cut answer is never cached');
  const c = LLM.cutAtCap(r, 'EDGE_LLM_MAX_TOKENS');
  assert.equal(c.text, undefined); assert.match(c.error, /cut off at the output cap \(EDGE_LLM_MAX_TOKENS\)/); assert.ok(c.usage && c.costUsd > 0, 'it was billed');
  await LLM.complete({ system: 's', prompt: 'p', cap: 'feature', maxTokens: 900 }, d); assert.equal(P.bodies.length, 2, 'asked again, not answered from a cache');
  // only text, no thinking left: the adapter itself reports it
  const P2 = provider({ content: [{ type: 'thinking', thinking: '' }], stop_reason: 'max_tokens', usage: { input_tokens: 10, output_tokens: 900 } });
  const r2 = await LLM.complete({ system: 's', prompt: 'q', cap: 'feature', maxTokens: 900 }, { ...d, store: ST.memoryStore(), fetch: P2.fetch });
  assert.match(r2.error, /cut off at the output cap/); assert.equal(LLM.cutAtCap(r2, 'X'), r2, 'an error stays as it is');
  assert.equal(LLM.cutAtCap({ text: 'a', stop: 'end' }, 'X').text, 'a');
});

test('caps: feature caps up to the ceiling, the analyst and commentary caps unchanged', async () => {
  const P = provider(thinkingThenText('x')), store = ST.memoryStore(), d = { env: ENV, store, fetch: P.fetch, now: () => Date.UTC(2026, 10, 17) };
  await LLM.complete({ prompt: 'a', cap: 'feature', maxTokens: 99999 }, d); assert.equal(P.bodies[0].max_tokens, LLM.OUT_CEILING);
  await LLM.complete({ prompt: 'b', cap: 'analyst', maxTokens: 9000 }, d); assert.equal(P.bodies[1].max_tokens, 4000, 'analyst: ACADEMY_LLM_ANALYST_MAX_TOKENS');
  await LLM.complete({ prompt: 'c', maxTokens: 3000 }, d); assert.equal(P.bodies[2].max_tokens, 700, 'commentary: ACADEMY_LLM_MAX_TOKENS');
  assert.equal(LLM.featureCap(undefined, 4000), 4000); assert.equal(LLM.featureCap('100', 4000), 256); assert.equal(LLM.featureCap('50000', 4000), LLM.OUT_CEILING); assert.equal(LLM.featureCap('6000', 4000), 6000);
});

test('ACADEMY_LLM_BODY carries the reasoning effort, merged with the adapter\'s own output format', () => {
  const C = LLM.config({ ...ENV, ACADEMY_LLM_BODY: '{"output_config":{"effort":"low"},"model":"other","max_tokens":5}', ACADEMY_LLM_JSON_SCHEMA: '1' });
  const b = JSON.parse(LLM._t.request(C, { system: 's', prompt: 'p', maxOut: 4000, schema: { type: 'object' } }).body);
  assert.deepEqual(b.output_config, { effort: 'low', format: { type: 'json_schema', schema: { type: 'object' } } });
  assert.equal(b.model, 'm-test', 'the body can never replace the model'); assert.equal(b.max_tokens, 4000, 'or the cap');
  const b2 = JSON.parse(LLM._t.request(LLM.config({ ...ENV, ACADEMY_LLM_BODY: '{"output_config":{"effort":"low"}}' }), { system: 's', prompt: 'p', maxOut: 4000 }).body);
  assert.deepEqual(b2.output_config, { effort: 'low' }, 'without a schema the effort is sent alone');
});

test('the edge analyst and the trade reviewer ask with their raised caps and treat a cut answer as billed', () => {
  const ea = src('api/edge-analyst.js'), tr = src('api/trade-review.js');
  assert.match(ea, /cap: 'feature', maxTokens: LLM\.featureCap\(env\.EDGE_LLM_MAX_TOKENS, MAX_OUT\)/); assert.match(ea, /MAX_OUT = 4000/); assert.match(ea, /cutAtCap\(/);
  assert.match(tr, /cap: 'feature', maxTokens: LLM\.featureCap\(env\.TRADE_REVIEW_LLM_MAX_TOKENS, MAX_OUT\)/); assert.match(tr, /MAX_OUT = 8000/); assert.match(tr, /cutAtCap\(/);
  assert.doesNotMatch(ea + tr, /maxTokens: (900|3000)\b/);
});

test('the edge analyst stores a cut answer as refused, once (billed)', async () => {
  const H = require('../api/edge-analyst.js');
  assert.equal(H.MAX_OUT, 4000);
  const out = LLM.cutAtCap({ available: true, text: '{"verd', stop: 'length', usage: { tokensIn: 1, tokensOut: 4000 }, costUsd: 0.08 }, 'EDGE_LLM_MAX_TOKENS');
  const billed = !!(out && out.available && out.error && (out.usage || out.costEstimated || out.costUsd > 0));
  assert.equal(billed, true, 'the scan stores it as refused and never asks again');
});
