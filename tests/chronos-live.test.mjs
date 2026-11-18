// ChronosTrade's coach, faster and live (17 Nov 2026, owner: "he needs to be faster, plus I want him to be live while I backtest"):
// the endpoint's streamed answers (server-sent events, also through the Cloudflare Worker's adapter), the live comment (no candle,
// position or trade after the replay moment; one in flight, one per 20 s, its own daily count; a comment that breaks the rules is
// withdrawn and stored refused), the coach's own model / body / price settings, and the live panel's page block (display only).
// Offline: a fake provider, a memory store, a fake clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { run as workerRun } from '../cloudflare/src/adapter.mjs';

const require = createRequire(import.meta.url);
const M = require('../api/_chronos-coach.js'), H = require('../api/chronos-coach.js'), ST = require('../api/_academy-store.js'), LLM = require('../api/_academy-llm.js');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ENV = { BLOB_READ_WRITE_TOKEN: 'x', ACADEMY_LLM_KEY: 'k-test', ACADEMY_LLM_URL: 'https://llm.invalid/v1/messages', ACADEMY_LLM_MODEL: 'm-base', ACADEMY_LLM_FORMAT: 'messages',
  ACADEMY_LLM_USD_PER_MTOK_IN: '4', ACADEMY_LLM_USD_PER_MTOK_OUT: '20' };
const NOW = Date.UTC(2026, 10, 17, 12), SEC = 900, T0 = 1794000000, MOMENT = T0 + 20 * SEC;
const bars = (from, n) => Array.from({ length: n }, (_, i) => [from + i * SEC, 4000 + i, 4002 + i, 3998 + i, 4001 + i]);
const OK = JSON.stringify({ summary: 'A sell against the H1 uptrend.', points: [{ kind: 'risk', text: 'It sold 0.4 ATR under yesterday\'s high.' }], question: '' });
const liveBody = (o = {}) => ({ kind: 'live', trigger: 'open', market: 'xau', tf: SEC, dec: 2, moment: MOMENT, bars: bars(T0 - 100 * SEC, 200),
  positions: [{ side: 'sell', entry: 4010, stop0: 4015, stop: 4015, target: 4000, openedAt: T0 + 18 * SEC, floatR: 0.3, sentence: 'Selling in London.' }, { side: 'buy', entry: 4000, stop0: 3990, openedAt: MOMENT + 3600 }],
  drafts: [{ side: 'buy', entry: 3990, stop: 3985, target: 4000, sentence: 'Buying at your level.' }], drawings: { n: 1, near: { kind: 'line', price: 4012, dAtr: 0.4, pos: 'below' } },
  trades: [{ R: -1, side: 'buy', sentence: 'Buying in Asia.', closedAt: T0 }, { R: 9, side: 'buy', sentence: 'a later trade', closedAt: MOMENT + 7200 }], closedN: 3, lead: 'Too few to judge.',
  event: { side: 'sell', sentence: 'Selling in London.', flags: ['Opened 4 min after a loss'] }, ...o });
const closedTrade = () => ({ kind: 'trade', market: 'xau', tf: SEC, dec: 2, moment: T0 + 40 * SEC,
  trade: { side: 'sell', entry: 4010, stop0: 4015, target: 4000, openedAt: T0, closedAt: T0 + 10 * SEC, exit: 4015, R: -1, net: -500, reason: 'stop', sentence: 'Selling in London.' }, before: bars(T0 - 300 * SEC, 300), after: bars(T0, 60) });
const req = (body, o = {}) => ({ method: 'POST', headers: { host: 'aureumdesk.co.uk', ...(o.headers || {}) }, body, query: {} });
const who = (u = 'owner') => async () => ({ u, name: u, role: 'owner' });
// a response that records json() and the streamed writes
function res() { const o = { code: 200, body: null, h: {}, chunks: [], ended: false }; return Object.assign(o, { setHeader: (k, v) => { o.h[k.toLowerCase()] = v; }, status: (c) => { o.code = c; return o; }, json: (b) => { o.body = b; o.ended = true; return o; },
  write: (c) => { o.chunks.push(String(c)); return true; }, end: () => { o.ended = true; return o; }, get statusCode() { return o.code; }, set statusCode(v) { o.code = v; } }); }
const events = (r) => r.chunks.join('').split('\n\n').filter(Boolean).map((x) => JSON.parse(x.replace(/^data: /, '')));
function fakeStream(text, extra = {}) { const C = { calls: 0, reqs: [] }; C.fn = async (q, io, onText) => { C.calls++; C.reqs.push(q); const parts = String(text).match(/.{1,12}/gs) || []; for (const p of parts) if (onText) onText(p); return { available: true, text, stop: 'end', provider: 'fake', costUsd: 0.002, usage: { tokensIn: 10, tokensOut: 10 }, ms: { first: 900, total: 2400 }, ...extra }; }; return C; }
const d0 = (o = {}) => ({ env: ENV, store: ST.memoryStore(), who: who(), now: () => NOW, ...o });
const reset = () => { H._calls.clear(); H._live.at.clear(); H._live.busy.clear(); };

test('live request: nothing after the replay moment reaches the prompt; stops checked; the system text', () => {
  const q = M.buildRequest(liveBody()), p = q.payload;
  assert.equal(q.kind, 'live'); assert.equal(q.schema, null); assert.equal(p.candles.closedByNow.length, M.LIM.live);
  assert.ok(p.candles.closedByNow.every((b) => b[0] + SEC <= MOMENT), 'only candles that closed by the moment');
  const times = [...q.prompt.matchAll(/\[(\d{10}),/g)].map((m) => +m[1]); assert.ok(times.length >= 60); assert.ok(times.every((t) => t + SEC <= MOMENT));
  assert.equal(p.live.openPositions.length, 1, 'a position opened after the moment is dropped'); assert.equal(p.live.openPositions[0].openingStop, 4015);
  assert.equal(p.live.lastTrades.length, 1, 'a trade closed after the moment is dropped'); assert.doesNotMatch(q.prompt, /a later trade/);
  assert.equal(p.live.event.kind, 'open'); assert.equal(p.live.drafts.length, 1);
  assert.throws(() => M.buildRequest(liveBody({ positions: [{ side: 'buy', entry: 4000, stop0: 4005, openedAt: T0 }] })), /losing side/);
  assert.throws(() => M.buildRequest(liveBody({ trigger: 'x' })), /trigger/); assert.throws(() => M.buildRequest(liveBody({ bars: bars(MOMENT, 10) })), /no closed candles/);
  assert.equal(M.buildRequest(liveBody({ drafts: [{ side: 'buy', entry: 4000, stop: 4001 }] })).payload.live.drafts.length, 0, 'a draft without a losing-side stop is left out');
  for (const re of [/2 to 4 short sentences/, /at most one question/, /fewer than 20 closed trades/, /Never suggest removing a stop, widening a stop/, /tested edge/, /Never say what the next candle or the price will do as a fact/]) assert.match(q.system, re);
  assert.match(M.buildRequest(liveBody({ trigger: 'ask' })).prompt, /What do you see\?/); assert.equal(M.buildRequest(liveBody({ trigger: 'ask' })).payload.live.event, null);
  // the trade question is smaller: 60 candles before the entry, at most 120 after
  const t = M.buildRequest(closedTrade()).payload; assert.equal(t.candles.closedBeforeEntry.length, 60); assert.equal(M.LIM.after, 120);
});

test('parseLive: plain text passes; stop advice, an edge claim or a forecast stated as fact is refused', () => {
  assert.equal(M.parseLive('You sold 0.4 ATR under your drawn level with a 1.2 ATR stop. Keep the stop where it is. What made you sell here?').ok, true);
  assert.equal(M.parseLive('If it closes back above 4,012 the picture would change.').ok, true);
  for (const bad of ['Widen your stop to 2 ATR.', 'Move your stop further away from the entry.', 'This is a proven edge.', 'Price will fall to 3,990 next.', '']) assert.equal(M.parseLive(bad).ok, false, bad);
  assert.ok(M.parseLive('x'.repeat(5000)).text.length <= M.LIM.liveText);
});

test('streamed answers: event-stream with start, the pieces, then the checked result; latency kept and shown by GET', async () => {
  reset(); const C = fakeStream(OK), d = d0({ stream: C.fn });
  let r = res(); await H.handle(req({ ...closedTrade(), stream: true }), r, d);
  assert.match(r.h['content-type'], /text\/event-stream/); const ev = events(r);
  assert.equal(ev[0].t, 'start'); assert.ok(ev.filter((e) => e.t === 'text').length > 3); assert.equal(ev.filter((e) => e.t === 'text').map((e) => e.d).join(''), OK);
  const done = ev[ev.length - 1]; assert.equal(done.t, 'done'); assert.equal(done.state, 'ok'); assert.equal(done.answer.points[0].kind, 'risk'); assert.deepEqual(done.ms, { first: 900, total: 2400 });
  assert.equal(C.reqs[0].cacheSystem, true, 'the system text is marked cacheable');
  r = res(); await H.handle({ method: 'GET', headers: {}, query: {} }, r, d); assert.equal(r.body.lastMs.first, 900); assert.equal(r.body.lastMs.kind, 'trade'); assert.equal(r.body.livePerDay, H.LIVE_PER_DAY); assert.equal(r.body.liveGapS, 8); assert.equal(H.LIVE_PER_DAY, 150);
  // the same question again: JSON from the store, no call
  r = res(); await H.handle(req({ ...closedTrade(), stream: true }), r, d); assert.equal(r.body.state, 'ok'); assert.equal(r.body.cached, true); assert.equal(C.calls, 1);
  // without stream: true the old JSON answer
  reset(); r = res(); await H.handle(req(closedTrade()), r, d0({ complete: fakeStream(OK).fn })); assert.equal(r.body.state, 'ok'); assert.equal(r.chunks.length, 0);
});

test('live comment: streamed text; a comment that breaks the rules is withdrawn and stored refused; never asked again', async () => {
  reset(); const st = ST.memoryStore(), C = fakeStream('You sold under your drawn level. Widen your stop to give it room.');
  let r = res(); await H.handle(req({ ...liveBody(), stream: true }), r, d0({ store: st, stream: C.fn }));
  let done = events(r).pop(); assert.equal(done.state, 'refused'); assert.equal(done.withdrawn, true); assert.equal(done.message, 'Withdrawn: the answer broke the coach\'s rules.');
  assert.equal(st.peek('live.json').rows[0].refused[0], 'stop advice the coach may not give'); assert.equal(st.peek('answers.json'), undefined, 'live comments have their own file');
  r = res(); await H.handle(req({ ...liveBody(), stream: true }), r, d0({ store: st, stream: C.fn, now: () => NOW + 60e3 })); assert.equal(r.body.state, 'refused'); assert.equal(C.calls, 1);
  reset(); const C2 = fakeStream('You sold 0.4 ATR under your level with a 1.2 ATR stop. With 3 trades the sample is too small to judge.');
  r = res(); await H.handle(req({ ...liveBody({ trigger: 'close' }), stream: true }), r, d0({ store: st, stream: C2.fn })); done = events(r).pop(); assert.equal(done.state, 'ok'); assert.match(done.text, /too small/);
  assert.equal(C2.reqs[0].maxTokens, H.LIVE_OUT); assert.equal(C2.reqs[0].schema, undefined, 'plain text, not the JSON card');
});

test('live limits: one in flight, one per 8 s, its own daily count; trade questions keep theirs', async () => {
  reset(); let release; const slow = { calls: 0 }; slow.fn = async (q, io, onText) => { slow.calls++; onText('Looking. '); await new Promise((r) => { release = r; }); return { available: true, text: 'Looking at your level.', stop: 'end', costUsd: 0.001, usage: {}, ms: { first: 5, total: 10 } }; };
  let t = NOW; const d = d0({ stream: slow.fn, now: () => t, env: { ...ENV, CHRONOS_LIVE_PER_DAY: '2', CHRONOS_COACH_PER_DAY: '1' } });
  const r1 = res(), p1 = H.handle(req({ ...liveBody(), stream: true }), r1, d);
  await new Promise((r) => setImmediate(r));
  let r = res(); await H.handle(req({ ...liveBody({ trigger: 'ask' }), stream: true }), r, d); assert.equal(r.body.state, 'busy'); release(); await p1; assert.equal(events(r1).pop().state, 'ok');
  r = res(); await H.handle(req({ ...liveBody({ trigger: 'ask' }), stream: true }), r, d); assert.equal(r.body.state, 'wait'); assert.equal(r.body.retryInS, 8);
  t += 9e3; const p2 = H.handle(req({ ...liveBody({ trigger: 'ask' }), stream: true }), (r = res()), d); await new Promise((x) => setImmediate(x)); release(); await p2; assert.equal(events(r).pop().state, 'ok');
  t += 9e3; r = res(); await H.handle(req({ ...liveBody({ trigger: 'close' }), stream: true }), r, d); assert.equal(r.body.state, 'limit'); assert.match(r.body.message, /^Coach resting: 2 comments today/);
  assert.equal(slow.calls, 2);
  // the trade question still has its own count (1 here) and is not held by the live gap
  r = res(); await H.handle(req(closedTrade()), r, { ...d, complete: async () => ({ available: true, text: OK, stop: 'end', costUsd: 0.01, usage: {} }) }); assert.equal(r.body.state, 'ok');
  // a bad live body is refused before any call or count
  reset(); r = res(); await H.handle(req(liveBody({ positions: [{ side: 'sell', entry: 4000, stop0: 3990, openedAt: T0 }] })), r, d); assert.equal(r.code, 400); assert.equal(H._calls.size, 0);
});

test("the coach's own settings: model, body, effort low by default, prices; a provider that refuses the request is said in words", async () => {
  let e = H.llmEnv({ ...ENV }); assert.deepEqual(JSON.parse(e.ACADEMY_LLM_BODY), { output_config: { effort: 'low' } }); assert.equal(e.ACADEMY_LLM_MODEL, 'm-base');
  e = H.llmEnv({ ...ENV, CHRONOS_LLM_MODEL: 'm-fast', CHRONOS_LLM_BODY: '{"output_config":{"effort":"medium"},"temperature":0}', CHRONOS_LLM_USD_PER_MTOK_IN: '1', CHRONOS_LLM_USD_PER_MTOK_OUT: '5', ACADEMY_LLM_USD_PER_MTOK_CACHE_READ: '9' });
  assert.equal(e.ACADEMY_LLM_MODEL, 'm-fast'); assert.deepEqual(JSON.parse(e.ACADEMY_LLM_BODY), { output_config: { effort: 'medium' }, temperature: 0 });
  const C = LLM.config(e); assert.equal(C.inPrice, 1); assert.equal(C.outPrice, 5); assert.equal(C.cacheReadPrice, 1, 'the cache price follows the coach\'s own input price');
  assert.deepEqual(JSON.parse(H.llmEnv({ ...ENV, ACADEMY_LLM_BODY: '{"output_config":{"effort":"high"}}' }).ACADEMY_LLM_BODY), { output_config: { effort: 'high' } }, 'the shared body\'s effort is kept');
  assert.deepEqual(JSON.parse(H.llmEnv({ ...ENV, ACADEMY_LLM_FORMAT: 'chat' }).ACADEMY_LLM_BODY), {}, 'the chat format gets no output_config');
  assert.equal(H.llmEnv({ ...ENV }).ACADEMY_LLM_MAX_CALLS_DAY, '100');
  // through the real adapter: the body reaches the provider with the coach's model and effort
  reset(); const bodies = [], enc = new TextEncoder();
  const fetch = async (u, init) => { bodies.push(JSON.parse(init.body)); const sse = `data: ${JSON.stringify({ type: 'message_start', message: { model: 'm-fast', usage: { input_tokens: 50 } } })}\n\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: OK } })}\n\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 80 } })}\n\n`;
    return { ok: true, status: 200, headers: { get: () => null }, body: new ReadableStream({ start(c) { c.enqueue(enc.encode(sse)); c.close(); } }) }; };
  let r = res(); await H.handle(req({ ...closedTrade(), stream: true }), r, d0({ fetch, env: { ...ENV, CHRONOS_LLM_MODEL: 'm-fast', CHRONOS_LLM_DAILY_USD: '1' } }));
  assert.equal(events(r).pop().state, 'ok'); assert.equal(bodies[0].model, 'm-fast'); assert.equal(bodies[0].stream, true); assert.deepEqual(bodies[0].output_config, { effort: 'low' }); assert.equal(bodies[0].system[0].cache_control.type, 'ephemeral');
  // the provider refuses the body: the reason in words, nothing stored, not billed
  reset(); const st = ST.memoryStore(), f400 = async () => ({ ok: false, status: 400, headers: { get: () => null }, json: async () => ({ type: 'error', error: { type: 'invalid_request_error', message: 'output_config.effort is not supported by this model' } }) });
  r = res(); await H.handle(req({ ...closedTrade(), stream: true }), r, d0({ store: st, fetch: f400, env: { ...ENV, CHRONOS_LLM_DAILY_USD: '1' } }));
  const done = events(r).pop(); assert.equal(done.state, 'error'); assert.match(done.message, /refused the request \(400 invalid_request_error\): output_config\.effort is not supported/); assert.match(done.message, /CHRONOS_LLM_BODY/);
  assert.equal(st.peek('answers.json'), undefined);
});

test('the Cloudflare Worker adapter passes the stream through: the first event arrives before the answer ends', async () => {
  reset(); let release; const gate = new Promise((r) => { release = r; });
  const slow = async (q, io, onText) => { onText('{"summary":"First'); await gate; onText(OK.slice(18)); return { available: true, text: OK, stop: 'end', costUsd: 0.001, usage: {}, ms: { first: 3, total: 9 } }; };
  const handler = (rq, rs) => H.handle(rq, rs, d0({ stream: slow }));
  const request = new Request('https://aureumdesk.co.uk/api/chronos-coach', { method: 'POST', headers: { 'content-type': 'application/json', host: 'aureumdesk.co.uk' }, body: JSON.stringify({ ...closedTrade(), stream: true }) });
  const resp = await workerRun(handler, request, new URL(request.url));
  assert.match(resp.headers.get('content-type'), /text\/event-stream/);
  const rd = resp.body.getReader(), dec = new TextDecoder(); let seen = '';
  while (!seen.includes('"t":"text"')) { const { value, done } = await rd.read(); if (done) break; seen += dec.decode(value); }
  assert.match(seen, /"t":"start"/); assert.doesNotMatch(seen, /"t":"done"/, 'the answer is still being written'); release();
  for (;;) { const { value, done } = await rd.read(); if (done) break; seen += dec.decode(value); }
  assert.match(seen, /"t":"done","state":"ok"/);
});

test('the live panel on the page: its own block, display only, the toggle the one storage key, 12 px, 44 px on touch', () => {
  const page = src('backtest.html'), a = page.indexOf('// ---- Live coach (17 Nov 2026'), z = page.indexOf('// ---- end Live coach'); assert.ok(a > 0 && z > a);
  const blk = page.slice(a, z);
  assert.doesNotMatch(blk, /\.stop\s*=[^=]/); assert.doesNotMatch(blk, /BT\.(place|close|closePartial|cancel|advance|onBar|coachStop)\(|\binstant\(|startDraft\(|endDraft\(|fixPos|fixOrd|S\.acct\s*=|save\(\)/);
  const keys = [...blk.matchAll(/(localStorage|sessionStorage)\.(setItem|removeItem|getItem)\(\s*([^,)]+)/g)].map((m) => m[3].trim());
  assert.ok(keys.length >= 2); assert.ok(keys.every((k) => k === "'btLab:liveCoach'" || k === 'LC_KEY'), keys.join()); assert.match(blk, /LC_KEY = 'btLab:liveCoach'/); assert.doesNotMatch(blk, /indexedDB/);
  assert.match(blk, /Withdrawn: the answer broke the coach\\?'s rules\./); assert.match(blk, /What do you see\?/); assert.match(blk, /BT\.coachSentence|coachSay\(/); assert.match(blk, /BT\.coachFlags\(/); assert.match(blk, /BT\.coachDraw\(/);
  assert.match(blk, /aiPost\(lcBody\(/); assert.ok(page.includes('JSON.stringify({ ...body, stream: true })'), 'the page asks for a streamed answer'); assert.match(blk, /\$\('play'\)\.click\(\)/, 'the pause option uses the play control');
  // never a candle after the replay moment from the page either
  assert.match(blk, /mom\(\)/); assert.match(blk, /b\.time \+ sec > T/);
  const css = page.slice(page.indexOf('/* Live coach (17 Nov 2026)'), page.indexOf('/* end Live coach */')); assert.ok(css.length > 100);
  for (const m of css.matchAll(/font-size:\s*([\d.]+)px|font:\s*\d+\s+([\d.]+)px/g)) assert.ok(+(m[1] || m[2]) >= 12, m[0]);
  assert.match(css, /@media \(pointer: coarse\)/); assert.doesNotMatch(css, /data-phone|\.ps-/);
  const ps = page.slice(page.indexOf('@media (max-width: 640px) {', page.indexOf('.ps-only, .ps-sw { display: none; }'))); const psb = ps.slice(0, ps.indexOf('</style>'));
  assert.match(psb, /html\[data-phone="simple"\] \.lc/, 'the phone strip lives in the simple view block');
});

test('live market events (BT.liveEvents): levels, stop / target, swing, session, big candle, floating R, a waiting order; closed candles only', () => {
  const BT = require('../assets/backtest-engine.js'), S0 = 1794000000, sec = 900, B = [];
  let px = 4000; for (let i = 0; i < 80; i++) { const o = px; px += i % 9 < 5 ? 0.6 : -0.5; B.push({ time: S0 + i * sec, open: o, high: Math.max(o, px) + 0.2, low: Math.min(o, px) - 0.2, close: px }); }
  const big = B[79]; big.high += 12; big.close += 6;
  const st = {}; assert.deepEqual(BT.liveEvents(B, sec, S0 + 70 * sec, st, {}), [], 'the first look only sets the moment');
  const lvl = B[78].close + 1, pos = { id: 7, side: 'buy', entry: B[76].close, r0: 2, stop: B[76].close - 2, target: big.close + 0.2, openedAt: B[76].time };
  // the moment inside candle 79: candle 79 has not closed, so nothing of it is read
  const mid = BT.liveEvents(B, sec, S0 + 79 * sec + 300, { T: S0 + 78 * sec }, { draw: [{ type: 'h', price: lvl }], positions: [pos] });
  assert.ok(mid.every((e) => e.t <= S0 + 79 * sec), 'no event from a candle that has not closed'); assert.ok(!mid.some((e) => e.k === 'big'));
  const ev = BT.liveEvents(B, sec, S0 + 80 * sec, st, { draw: [{ type: 'h', price: lvl }, { type: 'r', t1: S0, p1: lvl + 50, t2: S0 + sec, p2: lvl + 60 }], positions: [pos], draft: { key: 'k', since: S0 + 70 * sec } });
  const k = ev.map((e) => e.k);
  for (const want of ['level', 'big', 'target', 'r', 'draft']) assert.ok(k.includes(want), want + ' in ' + k.join());
  const cross = ev.find((e) => e.k === 'level' && e.imp === 3); assert.ok(cross); assert.match(cross.text, /Closed above your drawn line/); assert.equal(cross.t, S0 + 80 * sec, 'at the close of the candle that crossed');
  assert.ok(ev.some((e) => e.k === 'level' && e.imp === 2 && /^Touched your drawn line/.test(e.text)), 'a touch without a close through');
  assert.ok(ev.every((e) => e.t <= S0 + 80 * sec && e.text && e.imp >= 1 && e.imp <= 3));
  assert.deepEqual(BT.liveEvents(B, sec, S0 + 80 * sec, st, { draw: [{ type: 'h', price: lvl }], positions: [pos] }), [], 'each event once');
  // near the stop: a position whose stop sits 0.2R under the last close; said once until price moves 0.5R away
  const p2 = { id: 9, side: 'buy', entry: big.close + 1, r0: 2, stop: big.close - 0.4, target: null, openedAt: B[70].time }, s2 = { T: S0 + 79 * sec };
  const e2 = BT.liveEvents(B, sec, S0 + 80 * sec, s2, { positions: [p2] }); assert.ok(e2.some((e) => e.k === 'stop' && e.imp === 3), JSON.stringify(e2));
  assert.ok(!e2.some((e) => /widen|move your stop/i.test(e.text)), 'a note, never stop advice');
});

test('the live event trigger: a known kind, at or before the moment, at most 10 candles old; it reaches the prompt as a market event', () => {
  const ok = M.buildRequest(liveBody({ trigger: 'event', event: { kind: 'level', text: 'Closed above your drawn line at 4,012.', at: MOMENT - 2 * SEC } }));
  assert.equal(ok.payload.live.event.kind, 'market event'); assert.match(ok.prompt, /Something just happened on the chart/); assert.match(ok.prompt, /Closed above your drawn line/);
  assert.throws(() => M.buildRequest(liveBody({ trigger: 'event', event: { kind: 'level', text: 'x', at: MOMENT - 11 * SEC } })), /stale event/);
  assert.throws(() => M.buildRequest(liveBody({ trigger: 'event', event: { kind: 'level', text: 'x', at: MOMENT + SEC } })), /stale event/);
  assert.throws(() => M.buildRequest(liveBody({ trigger: 'event', event: { kind: 'prophecy', text: 'x', at: MOMENT } })), /known kind/);
});

test('live budget: the adapter\'s USD budget is the hard stop and the page says "Coach resting"', async () => {
  reset(); const r = res(); await H.handle(req({ ...liveBody(), stream: true }), r, d0({ stream: async () => ({ available: true, skipped: 'budget', scope: 'day' }) }));
  const done = events(r).pop(); assert.equal(done.state, 'budget'); assert.equal(done.message, 'Coach resting: daily budget reached.'); assert.equal(typeof done.liveLeft, 'number');
  const page = src('backtest.html'); assert.match(page, /Coach resting: \$\{j\.scope === 'month'/); assert.match(page, /AI comments left today/);
  // the panel: a 150 ms fade for a new note, the watching dot pulses three times at most, no infinite animation
  const css = page.slice(page.indexOf('/* Live coach (17 Nov 2026)'), page.indexOf('/* end Live coach */'));
  assert.match(css, /animation: lc-in \.15s/); assert.match(css, /lc-pulse 1s ease-in-out 3/); assert.doesNotMatch(css, /infinite/);
});
