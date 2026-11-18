// Workers AI through the Worker's `ai` binding (18 Nov 2026): the wrapped fetch answers the adapter's chat request in the
// chat-completions shape, and every other request goes to the real fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { answer, installAiFetch, useAi, AI_HOST } from '../cloudflare/src/ai-binding.mjs';

test('the binding answers in the chat-completions shape', async () => {
  const calls = [];
  const ai = { run: async (model, inp) => { calls.push([model, inp]); return { response: 'Hello.', usage: { prompt_tokens: 12, completion_tokens: 3 } }; } };
  const r = await answer(JSON.stringify({ model: '@cf/x', max_tokens: 50, messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }] }), ai);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.choices[0].message.content, 'Hello.');
  assert.equal(j.choices[0].finish_reason, 'stop');
  assert.deepEqual(j.usage, { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 });
  assert.equal(calls[0][0], '@cf/x');
  assert.equal(calls[0][1].max_tokens, 50);
  assert.equal(calls[0][1].messages.length, 2);
});

test('cut at the cap reads as length; no binding is a 503; a bad body a 400', async () => {
  const ai = { run: async () => ({ response: 'x', usage: { prompt_tokens: 1, completion_tokens: 50 } }) };
  assert.equal((await (await answer(JSON.stringify({ model: 'm', max_tokens: 50, messages: [] }), ai)).json()).choices[0].finish_reason, 'length');
  assert.equal((await answer('{}', null)).status, 503);
  assert.equal((await answer('nope', ai)).status, 400);
});

test('only the workers-ai host is answered by the binding', async () => {
  const seen = [];
  const target = { fetch: async (u) => { seen.push(String(u)); return new Response('real'); } };
  installAiFetch(target);
  useAi({ run: async () => ({ response: 'from binding', usage: {} }) });
  const a = await target.fetch(`https://${AI_HOST}/v1/chat/completions`, { method: 'POST', body: JSON.stringify({ model: 'm', messages: [] }) });
  assert.equal((await a.json()).choices[0].message.content, 'from binding');
  assert.equal(await (await target.fetch('https://example.com/x')).text(), 'real');
  assert.deepEqual(seen, ['https://example.com/x']);
  useAi(null);
});
