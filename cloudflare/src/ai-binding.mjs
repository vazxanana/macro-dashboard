// Workers AI through the Worker's own `ai` binding (18 Nov 2026, owner: use Cloudflare's AI; the API token was refused, 401).
// The language-model adapter (api/_academy-llm.js, 'chat' format) posts to ACADEMY_LLM_URL with fetch. When that URL is on the
// host AI_HOST, the request never leaves the Worker: this wrapped fetch answers it with env.AI.run(model, { messages,
// max_tokens }) and returns the chat-completions shape the adapter reads (choices[0].message.content, finish_reason, usage
// prompt_tokens / completion_tokens). No token is needed; ACADEMY_LLM_KEY may hold any text. `.invalid` never resolves, so a
// request that somehow escapes this wrapper fails instead of reaching anyone. Nothing in api/ imports this file.
export const AI_HOST = 'workers-ai.invalid';
export const SMALL_CAP = 1500;
const OURS = Symbol.for('aureum.ai.fetch');
let BINDING = null;
export const useAi = (b) => { BINDING = b && typeof b.run === 'function' ? b : null; };

const urlOf = (input) => {
  const s = typeof input === 'string' ? input : input instanceof URL ? input.href : input && typeof input.url === 'string' ? input.url : null;
  if (!s || !s.includes(AI_HOST)) return null;
  try { const u = new URL(s); return u.hostname === AI_HOST ? u : null; } catch (e) { return null; }
};
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export async function answer(body, ai = BINDING) {
  if (!ai) return json(503, { error: { type: 'no_binding', message: 'the Worker has no AI binding' } });
  let b; try { b = JSON.parse(body || '{}'); } catch (e) { return json(400, { error: { type: 'bad_json', message: 'request body is not JSON' } }); }
  const model = String(b.model || '').trim(), messages = Array.isArray(b.messages) ? b.messages : null;
  if (!model || !messages) return json(400, { error: { type: 'bad_request', message: 'model and messages are required' } });
  const max = Number(b.max_tokens || b.max_completion_tokens) || 1024;
  let out, cap = max;
  for (let i = 0; ; i++) {
    try { out = await ai.run(model, { messages, max_tokens: cap }); break; }
    catch (e) {
      const m = String((e && e.message) || e).slice(0, 300);
      // a model with a small context window refuses a large output cap: one retry at a smaller cap
      if (i === 0 && cap > SMALL_CAP && /token|context|length|too (long|large)/i.test(m)) { cap = SMALL_CAP; continue; }
      return json(/not found|no such model|invalid model/i.test(m) ? 404 : 502, { error: { type: 'workers_ai', message: m } });
    }
  }
  const r = out && out.response;
  const text = typeof r === 'string' ? r : r != null ? JSON.stringify(r) : (out && out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content) || '';
  const u = (out && out.usage) || {};
  const tin = Number(u.prompt_tokens) || 0, tout = Number(u.completion_tokens) || 0;
  const finish = tout && tout >= cap ? 'length' : 'stop';
  return json(200, { id: 'workers-ai', model, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: finish }], usage: { prompt_tokens: tin, completion_tokens: tout, total_tokens: tin + tout } });
}

export function installAiFetch(target = globalThis) {
  const orig = target.fetch;
  if (typeof orig !== 'function' || orig[OURS]) return orig;
  const f = async function fetch(input, init) {
    if (!urlOf(input)) return orig.call(target, input, init);
    const body = init && init.body != null ? String(init.body) : input && typeof input.text === 'function' ? await input.text() : '';
    return answer(body);
  };
  f[OURS] = true;
  target.fetch = f;
  return f;
}
