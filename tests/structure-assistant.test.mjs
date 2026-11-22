// The structure assistant (22 Nov 2026): api/_structure-assistant.js (the facts checked and capped, the answer checked: no
// figure outside the facts, no trade instruction, no stops, no certainty, no forecast stated as fact), api/structure-assistant.js
// (session, same origin, per-account limit, budgets, refused answers stored once, the off state) and the page and Worker wiring.
// Offline: a fake model, a memory store, a fake clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../api/_structure-assistant.js'), H = require('../api/structure-assistant.js'), ST = require('../api/_academy-store.js'), LLM = require('../api/_academy-llm.js');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ENV = { BLOB_READ_WRITE_TOKEN: 'x', ACADEMY_LLM_KEY: 'k-test', ACADEMY_LLM_URL: 'https://llm.invalid/v1/messages', ACADEMY_LLM_MODEL: 'm-test', ACADEMY_LLM_FORMAT: 'messages',
  ACADEMY_LLM_USD_PER_MTOK_IN: '4', ACADEMY_LLM_USD_PER_MTOK_OUT: '20' };
const NOW = Date.UTC(2026, 10, 22, 12), AT = NOW / 1000 - 30;
const brk = (dir, level, ago, structure = false) => ({ dir, level, t: AT - ago * 3600, structure });
const facts = (o = {}) => ({ at: AT, dec: 2, price: 4012.4, priceT: AT - 60,
  tfs: [
    { tf: '1d', trend: 1, closedThrough: AT - 3600, last: brk(1, 3950.5, 200), protected: { level: 3880.25, t: AT - 900000 }, extreme: { level: 4080.9, t: AT - 86400, fixed: true }, breaks: [brk(-1, 3800, 900), brk(1, 3950.5, 200, true)], internal: [brk(1, 4001.1, 30)] },
    { tf: '4h', trend: -1, last: brk(-1, 4040.2, 20, true), protected: { level: 4080.9, t: AT - 86400 }, breaks: Array.from({ length: 12 }, (_, i) => brk(i % 2 ? 1 : -1, 4000 + i, 200 - i)), internal: [],
      internalLeg: { dir: -1, from: 4066.3, to: 4005.7, p50: 4036, reached: false } },
    { tf: '1h', trend: -1, last: brk(-1, 4020.6, 5), breaks: [brk(-1, 4020.6, 5)] },
    { tf: '1w', trend: 1 },                                   // not a timeframe the assistant reads
    { tf: '15m', trend: 1, last: brk(1, 4010.4, 1), breaks: [brk(1, 4010.4, 1), { dir: 1, level: 4011, t: AT + 3600 }] },   // a break after the reading is dropped
  ],
  cycle: [{ parent: '1d', child: '4h', dir: 1, phase: 'pullback', p50: 3965.45, origin: 3950.5, ext: 4080.9, choch: { level: 4040.2, t: AT - 72000 }, stage: '2 Pullback ▼ · 50% at 3,965.45', path: [{ to: 3965.45, kind: 'retrace' }, { to: 4080.9, kind: 'with' }, { to: 1, kind: 'with' }] },
    { parent: '4h', child: '1h', dir: -1, phase: 'move', ext: 4005.7, origin: 4040.2 }, { parent: 'x', child: '1h', phase: 'move' }],
  alignment: { up: 2, down: 2, n: 4 }, ...o });
const body = (o = {}) => ({ market: 'xau', label: 'XAU/USD', tf: '4h', facts: facts(), ...o });
const ANS = (o = {}) => JSON.stringify({ summary: 'D1 is up and is pulling back: H4 made a ChoCh down at 4,040.20, so the daily move is in its pullback toward its 50% at 3,965.45.',
  timeframes: [{ tf: 'D1', direction: 'up', why: 'The last D1 break was up at 3,950.50.' }, { tf: 'H4', direction: 'down', why: 'H4 broke down at 4,040.20.' }],
  cycle: 'The D1 move is pulling back; the path points to the 50% at 3,965.45, then back with the move to 4,080.90.', watch: [{ level: 4080.9, what: 'A daily close above it would end the pullback reading.' }],
  question: 'Do you read the H4 ChoCh the same way?', ...o });
function res() { const o = { code: 0, body: null, h: {}, chunks: [] }; return Object.assign(o, { setHeader: (k, v) => { o.h[k] = v; }, status: (c) => { o.code = c; return o; }, json: (b) => { o.body = b; return o; }, write: (s) => { o.chunks.push(s); }, end: () => { o.ended = true; } }); }
const req = (b, o = {}) => ({ method: 'POST', headers: { host: 'aureumdesk.co.uk', ...(o.headers || {}) }, body: b, query: {} });
const who = (u = 'luxus') => async () => ({ u, name: u, role: 'viewer' });
function fakeComplete(text = ANS(), extra = {}) { const C = { calls: 0, reqs: [] }; C.fn = async (q) => { C.calls++; C.reqs.push(q); return { available: true, text, stop: 'end', provider: 'fake', costUsd: 0.01, usage: { tokensIn: 10, tokensOut: 10 }, ...extra }; }; return C; }
const d0 = (o = {}) => ({ env: ENV, store: ST.memoryStore(), who: who(), now: () => NOW, ...o });

test('request: facts whitelisted and capped; nothing after the reading; levels and times rounded', () => {
  const q = M.buildRequest(body(), NOW / 1000), F = q.facts;
  assert.deepEqual(F.tfs.map((t) => t.tf), ['1d', '4h', '1h', '15m'], 'only D1 / H4 / H1 / M15 / M5, top-down');
  assert.equal(F.tfs[1].breaks.length, M.LIM.breaks); assert.equal(F.tfs[3].breaks.length, 1, 'a break after the reading is dropped');
  assert.equal(F.cycle.length, 2, 'an unknown timeframe in the cycle is dropped'); assert.equal(F.cycle[0].path.length, 2);
  assert.match(q.prompt, /50% of the move 3965\.45/); assert.match(q.prompt, /The person is looking at the H4 chart/);
  assert.match(q.system, /Never give a trade instruction/); assert.match(q.system, /not a tested edge/); assert.match(q.system, /top-down|Top-down/i);
  assert.ok(q.levels.includes(4080.9) && q.levels.includes(4036));
  assert.ok(q.prompt.length + q.system.length < LLM.PROMPT_MAX_LONG);
  const long = M.buildRequest(body({ question: 'y'.repeat(900), facts: facts({ cycle: [{ ...facts().cycle[0], stage: 's'.repeat(900) }] }) }), NOW / 1000);
  assert.equal(long.question.length, M.LIM.question); assert.equal(long.facts.cycle[0].stage.length, M.LIM.str);
  for (const [b, why] of [[{ market: 'x y!' }, /market/], [{ tf: '2h' }, /tf/], [{ facts: null }, /facts/], [{ facts: facts({ at: AT + 86400 }) }, /moment/], [{ facts: facts({ tfs: [{ tf: '1w' }] }) }, /no timeframe/]])
    assert.throws(() => M.buildRequest(body(b), NOW / 1000), why);
  const nan = M.buildRequest(body({ facts: facts({ price: 'NaN', tfs: [{ tf: '4h', trend: -1, last: { dir: -1, level: Infinity, t: AT }, protected: { level: -5 } }] }) }), NOW / 1000);
  assert.equal(nan.facts.price, null); assert.equal(nan.facts.tfs[0].last, undefined); assert.equal(nan.facts.tfs[0].protected, undefined);
});

test('parseAnswer: the shape, and every figure and watch level from the facts', () => {
  const q = M.buildRequest(body(), NOW / 1000);
  const p = M.parseAnswer('```json\n' + ANS() + '\n```', q); assert.equal(p.ok, true, JSON.stringify(p.why)); assert.equal(p.answer.timeframes.length, 2); assert.equal(p.answer.watch[0].level, 4080.9);
  const no = (o, re) => { const r = M.parseAnswer(ANS(o), q); assert.equal(r.ok, false, JSON.stringify(o)); if (re) assert.match(r.why.join(' | '), re); };
  no({ summary: 'D1 is up; the next target sits at 4,150.00 above the high.' }, /4,150\.00 is not in the facts/);
  no({ watch: [{ level: 4111, what: 'A close above it would matter.' }] }, /not one of the facts' levels/);
  no({ timeframes: [{ tf: 'W1', direction: 'up', why: 'Weekly is up.' }] }, /W1 is not in the facts/);
  no({ timeframes: [{ tf: 'D1', direction: 'bullish', why: 'x is up.' }] }, /direction/);
  no({ summary: 'D1 is up and H4 pulled back: you should buy the pullback at 3,965.45 now.' }, /trade instruction/);
  no({ cycle: 'Keep your stop under 3,950.50 while the pullback runs its course.' }, /stops/);
  no({ summary: 'This is a proven pattern: the D1 trend up wins from the 50% at 3,965.45.' }, /certainty|tested edge/);
  no({ cycle: 'The D1 pullback is under way and price will fall to 3,965.45 next.' }, /forecast stated as fact/);
  assert.equal(M.parseAnswer(ANS({ cycle: 'If H4 closes back above 4,040.20, price will likely resume up toward 4,080.90.' }), q).ok, true, 'a conditional is fine');
  assert.equal(M.parseAnswer(ANS({ summary: 'H4 and M15 disagree; the 50% of the D1 move is 3,965.45 and 2 of 4 timeframes point up.' }), q).ok, true, 'timeframe names, the 50% and small counts are not levels');
  assert.equal(M.parseAnswer('no json', q).ok, false);
  assert.equal(M.parseAnswer(ANS({ watch: Array(5).fill({ level: 4080.9, what: 'A close above it.' }) }), q).ok, false);
  // a number in the person's question is not a fact
  const q2 = M.buildRequest(body({ question: 'What happens at 4200?' }), NOW / 1000);
  assert.equal(M.parseAnswer(ANS({ summary: 'D1 is up; 4200 is not one of the levels of this reading at all.' }), q2).ok, false);
});

test('endpoint: off without a key or when switched off; session required; foreign Origin refused; GET says enabled', async () => {
  let r = res(); await H.handle(req(body(), { headers: { origin: 'https://evil.example' } }), r, d0()); assert.equal(r.code, 403);
  r = res(); await H.handle(req(body()), r, d0({ who: async () => null })); assert.equal(r.code, 401);
  const C = fakeComplete();
  r = res(); await H.handle(req(body()), r, d0({ env: { BLOB_READ_WRITE_TOKEN: 'x' }, complete: C.fn })); assert.equal(r.body.state, 'off'); assert.equal(C.calls, 0);
  r = res(); await H.handle(req(body()), r, d0({ env: { ...ENV, STRUCT_ASSISTANT: 'off' }, complete: C.fn })); assert.equal(r.body.state, 'off'); assert.equal(C.calls, 0);
  r = res(); await H.handle(req(body()), r, d0({ env: { ...ENV, STRUCT_LLM_STOP: '1' }, complete: C.fn })); assert.equal(r.body.state, 'off'); assert.equal(C.calls, 0);
  r = res(); await H.handle({ method: 'GET', headers: {}, query: {} }, r, d0({ env: { BLOB_READ_WRITE_TOKEN: 'x' } })); assert.equal(r.code, 200); assert.equal(r.body.enabled, false); assert.ok(r.body.reason);
  r = res(); await H.handle({ method: 'GET', headers: {}, query: {} }, r, d0({ env: { ...ENV, STRUCT_ASSISTANT: 'off' } })); assert.equal(r.body.enabled, false); assert.match(r.body.reason, /STRUCT_ASSISTANT/);
  r = res(); await H.handle({ method: 'GET', headers: {}, query: {} }, r, d0()); assert.equal(r.body.enabled, true); assert.equal(r.body.perDay, H.PER_DAY);
  r = res(); await H.handle({ method: 'PUT', headers: {}, query: {} }, r, d0()); assert.equal(r.code, 405);
  r = res(); await H.handle(req(body({ tf: 'x' })), r, d0({ complete: C.fn })); assert.equal(r.code, 400); assert.equal(C.calls, 0, 'a bad body is refused before any call');
  r = res(); await H.handle(req('x'.repeat(200000)), r, d0({ complete: C.fn })); assert.equal(r.code, 413);
});

test('keys and budgets: own key, else the Academy key, else the provider key; own budgets and model', () => {
  const e = H.llmEnv({ ANTHROPIC_API_KEY: 'p' });
  assert.equal(e.ACADEMY_LLM_KEY, 'p'); assert.equal(e.ACADEMY_LLM_FORMAT, 'messages'); assert.match(e.ACADEMY_LLM_URL, /^https:\/\//);
  assert.equal(H.llmEnv({ ACADEMY_LLM_KEY: 'a', ANTHROPIC_API_KEY: 'p' }).ACADEMY_LLM_KEY, 'a');
  assert.equal(H.llmEnv({ STRUCT_LLM_KEY: 's', ACADEMY_LLM_KEY: 'a' }).ACADEMY_LLM_KEY, 's');
  const b = H.llmEnv({ ...ENV, STRUCT_LLM_MODEL: 'own' });
  assert.equal(b.ACADEMY_LLM_MODEL, 'own'); assert.equal(b.ACADEMY_LLM_DAILY_USD, '0.5'); assert.equal(b.ACADEMY_LLM_MONTHLY_USD, '5'); assert.equal(b.ACADEMY_LLM_HARD_USD, '25'); assert.equal(b.ACADEMY_LLM_MAX_CALLS_DAY, '60');
  assert.equal(H.llmEnv(ENV).ACADEMY_LLM_MODEL, 'm-test');
});

test('endpoint: one call stored; the same question from the store; per-account daily limit; budget skip not stored', async () => {
  H._calls.clear(); const C = fakeComplete(), d = d0({ complete: C.fn });
  let r = res(); await H.handle(req(body()), r, d);
  assert.equal(r.body.state, 'ok', JSON.stringify(r.body)); assert.equal(C.calls, 1); assert.equal(C.reqs[0].cap, 'feature'); assert.equal(C.reqs[0].maxTokens, H.MAX_OUT); assert.ok(C.reqs[0].schema);
  r = res(); await H.handle(req(body()), r, d); assert.equal(r.body.cached, true); assert.equal(C.calls, 1, 'never paid twice');
  H._calls.clear(); const C2 = fakeComplete(), d2 = d0({ complete: C2.fn, env: { ...ENV, STRUCT_ASSISTANT_PER_DAY: '2' } });
  for (const q of ['a?', 'b?']) { r = res(); await H.handle(req(body({ question: q })), r, d2); assert.equal(r.body.state, 'ok'); }
  r = res(); await H.handle(req(body({ question: 'c?' })), r, d2); assert.equal(r.body.state, 'limit'); assert.equal(C2.calls, 2);
  r = res(); await H.handle(req(body({ question: 'c?' })), r, { ...d2, who: who('fred') }); assert.equal(r.body.state, 'ok', 'another account has its own count');
  r = res(); await H.handle(req(body({ question: 'c?' })), r, { ...d2, now: () => NOW + 86400e3, facts: undefined }); assert.equal(r.code, 400, 'facts from yesterday are refused on a later day');
  H._calls.clear(); const st = ST.memoryStore();
  r = res(); await H.handle(req(body()), r, d0({ store: st, complete: async () => ({ available: true, skipped: 'budget', scope: 'day' }) })); assert.equal(r.body.state, 'budget'); assert.equal(st.peek('answers.json'), undefined);
  r = res(); await H.handle(req(body()), r, d0({ store: st, complete: async () => ({ available: true, error: 'failed', status: 500 }) })); assert.equal(r.body.state, 'error'); assert.equal(st.peek('answers.json'), undefined);
});

test('endpoint: a billed answer that fails the checks is stored as refused once; streaming sends the checked result last', async () => {
  H._calls.clear(); const st = ST.memoryStore(), C = fakeComplete(ANS({ summary: 'Price will fall from here to 3,965.45, the D1 50% of the move.' }));
  let r = res(); await H.handle(req(body()), r, d0({ store: st, complete: C.fn })); assert.equal(r.body.state, 'refused'); assert.match(r.body.why.join(' '), /forecast/);
  r = res(); await H.handle(req(body()), r, d0({ store: st, complete: C.fn })); assert.equal(r.body.state, 'refused'); assert.equal(C.calls, 1);
  H._calls.clear(); const S = async (q, io, on) => { on('{"summary":"D1'); on(' is up"'); return { available: true, text: ANS(), stop: 'end', provider: 'fake', costUsd: 0.01, usage: {} }; };
  r = res(); await H.handle(req({ ...body(), stream: true }), r, d0({ stream: S }));
  assert.match(r.h['Content-Type'], /event-stream/); assert.ok(r.ended);
  const ev = r.chunks.map((c) => JSON.parse(c.replace(/^data: /, '')));
  assert.equal(ev[0].t, 'start'); assert.equal(ev[1].t, 'text'); assert.equal(ev[ev.length - 1].t, 'done'); assert.equal(ev[ev.length - 1].state, 'ok');
});

test('wiring: Worker route, vercel functions, the page (members only, closed candles, display only)', () => {
  const w = src('cloudflare/src/worker.mjs'); assert.match(w, /import structureAssistant from '\.\.\/\.\.\/api\/structure-assistant\.js'/); assert.match(w, /'structure-assistant': structureAssistant/);
  assert.ok(JSON.parse(src('vercel.json')).functions['api/structure-assistant.js']);
  const p = src('market-structure.html'), js = p.slice(p.indexOf('<script id="ms-sa-js">'), p.indexOf('</script>', p.indexOf('<script id="ms-sa-js">')));
  assert.ok(js.length > 1000);
  assert.match(js, /dataset\.role === 'public'\) return/); assert.match(p, /html\[data-role="public"\] :is\(#ms-sa-btn, #ms-sa\) \{ display: none !important; \}/);
  assert.match(js, /AI reading, not advice, not a tested edge/); assert.match(js, /The assistant is off\./); assert.match(js, /The facts sent/); assert.match(js, /Read this market/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|innerHTML\s*=\s*[^'"]*\ba\.|\.stop\s*=|placeOrder|msPaper/, 'display only, nothing kept, answers drawn as text');
  const fb = p.slice(p.indexOf('window.msStructFacts = function'), p.indexOf('window.msStructFacts = function') + 3000);
  assert.match(fb, /A\.n/, 'closed candles only: the slice the panes analysed'); assert.match(fb, /- TZ/, 'times in UTC'); assert.match(fb, /cycleNow\(\)/); assert.match(fb, /msStage\(/); assert.match(fb, /msPath\(/); assert.match(fb, /msInternalLeg\(/);
  assert.match(p, /@media \(max-width: 640px\) \{\s*#ms-sa-btn \.sa-bl/, 'a bottom sheet on a phone');
});
