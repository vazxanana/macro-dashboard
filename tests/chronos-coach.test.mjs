// ChronosTrade's AI coach (17 Nov 2026): api/_chronos-coach.js (the request, every field checked; the answer check),
// api/chronos-coach.js (session, same origin, rate limit, budgets, refused answers stored once) and the page wiring. Offline:
// a fake model, a memory store, a fake clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../api/_chronos-coach.js'), H = require('../api/chronos-coach.js'), ST = require('../api/_academy-store.js'), LLM = require('../api/_academy-llm.js');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ENV = { BLOB_READ_WRITE_TOKEN: 'x', ACADEMY_LLM_KEY: 'k-test', ACADEMY_LLM_URL: 'https://llm.invalid/v1/messages', ACADEMY_LLM_MODEL: 'm-test', ACADEMY_LLM_FORMAT: 'messages',
  ACADEMY_LLM_USD_PER_MTOK_IN: '4', ACADEMY_LLM_USD_PER_MTOK_OUT: '20' };
const NOW = Date.UTC(2026, 10, 17, 12), SEC = 900, T0 = 1794000000;   // T0: the entry candle's start
const bars = (from, n) => Array.from({ length: n }, (_, i) => [from + i * SEC, 4000 + i, 4002 + i, 3998 + i, 4001 + i]);
const OK = JSON.stringify({ summary: 'A sell against the H1 uptrend, stopped out.', points: [{ kind: 'risk', text: 'It sold 0.4 ATR under yesterday\'s high.' }, { kind: 'habit', text: 'Under 20 trades: too few to judge.' }], question: 'What did you see on H1?' });
function res() { const o = { code: 0, body: null, h: {} }; return Object.assign(o, { setHeader: (k, v) => { o.h[k] = v; }, status: (c) => { o.code = c; return o; }, json: (b) => { o.body = b; return o; } }); }
const closedTrade = (o = {}) => ({ kind: 'trade', market: 'xau', tf: SEC, dec: 2, moment: T0 + 40 * SEC,
  trade: { side: 'sell', entry: 4010, stop0: 4015, target: 4000, openedAt: T0, closedAt: T0 + 10 * SEC, exit: 4015, R: -1, net: -500, reason: 'stop', ctx: { side: 'sell', session: 'London', stopAtr: 1.2, trend: { htf: 'up', htfName: 'H1' }, evil: { a: { b: { c: { d: 1 } } } } }, sentence: 'Selling in London.', flags: [{ text: 'Opened 4 min after a loss' }], tags: ['bo'], mistakes: ['FOMO'], note: 'x'.repeat(2000) },
  before: bars(T0 - 300 * SEC, 300), after: bars(T0, 60), ...o });
const req = (body, o = {}) => ({ method: 'POST', headers: { host: 'aureumdesk.co.uk', ...(o.headers || {}) }, body, query: {} });
const who = (u = 'luxus') => async () => ({ u, name: u, role: 'viewer' });
function fakeComplete(text = OK, extra = {}) { const C = { calls: 0, reqs: [] }; C.fn = async (q) => { C.calls++; C.reqs.push(q); return { available: true, text, stop: 'end', provider: 'fake', costUsd: 0.01, usage: { tokensIn: 10, tokensOut: 10 }, ...extra }; }; return C; }
const d0 = (o = {}) => ({ env: ENV, store: ST.memoryStore(), who: who(), now: () => NOW, ...o });

test('request: fields are checked and capped; never a candle after the entry moment in "before"', () => {
  const q = M.buildRequest(closedTrade()), p = q.payload;
  assert.equal(p.trade.status, 'closed'); assert.equal(p.trade.R, -1); assert.equal(p.trade.openingStop, 4015);
  assert.equal(p.candles.closedBeforeEntry.length, M.LIM.before); assert.ok(p.candles.closedBeforeEntry.every((b) => b[0] + SEC <= T0));
  assert.ok(p.candles.entryToExit.every((b) => b[0] >= T0 && b[0] + SEC <= T0 + 11 * SEC), 'entry to exit only');
  assert.equal(p.trade.note.length, M.LIM.note); assert.equal(JSON.stringify(p.trade.context).includes('"d"'), false, 'nested objects are cut at a fixed depth');
  assert.ok(q.prompt.length + q.system.length < LLM.PROMPT_MAX_LONG);
  for (const [bad, why] of [[{ trade: { ...closedTrade().trade, side: 'long' } }, /side/], [{ trade: { ...closedTrade().trade, stop0: 4005 } }, /losing side/], [{ trade: { ...closedTrade().trade, stop0: 'NaN' } }, /opening stop/], [{ tf: 77 }, /timeframe/], [{ kind: 'x' }, /kind/]])
    assert.throws(() => M.buildRequest({ ...closedTrade(), ...bad }), why);
  assert.throws(() => M.buildRequest({ kind: 'session', splits: { n: 0 }, trades: [] }), /no closed trades/);
});

test('an OPEN trade: no exit, no result, and no candle after the replay moment reaches the prompt', () => {
  const moment = T0 + 20 * SEC, b = closedTrade({ moment, after: bars(T0, 200) });
  delete b.trade.closedAt; delete b.trade.exit; b.trade.R = 5; b.trade.net = 9;
  const q = M.buildRequest(b), p = q.payload;
  assert.equal(p.trade.status, 'open'); assert.equal(p.trade.R, undefined); assert.equal(p.trade.exit, undefined); assert.equal(p.trade.net, undefined);
  const after = p.candles.sinceEntryClosedByNow; assert.equal(after.length, 20); assert.ok(after.every((x) => x[0] + SEC <= moment));
  const times = [...q.prompt.matchAll(/\[(\d{10}),/g)].map((m) => +m[1]); assert.ok(times.length > 60); assert.ok(times.every((t) => t + SEC <= moment), 'the prompt carries no future candle');
  // a closedAt after the moment does not make it closed
  const q2 = M.buildRequest({ ...b, trade: { ...b.trade, closedAt: moment + 3600, exit: 1, R: 3 } }); assert.equal(q2.payload.trade.status, 'open'); assert.equal(q2.payload.trade.R, undefined);
  assert.match(q.system, /never.*remov|removing a stop/i); assert.match(q.system, /fewer than 20 trades/); assert.match(q.system, /tested edge/);
  assert.match(M.buildRequest({ ...b, lang: 'fr' }).system, /French/);
});

test('session request: splits and the last 40 trades, no candles', () => {
  const trades = Array.from({ length: 60 }, (_, i) => ({ R: i % 2 ? 1 : -1, side: 'buy', sentence: 'Buying in London.', mistakes: [] }));
  const q = M.buildRequest({ kind: 'session', splits: { n: 60, noCtx: 2, lead: 'Your largest difference…', features: [{ name: 'Session', groups: [{ label: 'London', n: 30, winRate: 0.5, meanR: 0.1, t: 0.4, judge: 'your record, not a tested edge' }] }] }, trades, before: bars(T0, 50) });
  assert.equal(q.payload.session.lastTrades.length, 40); assert.equal(q.payload.candles, undefined); assert.doesNotMatch(q.prompt, /\[\d{10},/);
});

test('parseAnswer: the shape, kinds, and no stop advice or promised edge', () => {
  const p = M.parseAnswer('```json\n' + OK + '\n```'); assert.equal(p.ok, true); assert.equal(p.answer.points.length, 2); assert.equal(p.answer.question, 'What did you see on H1?');
  assert.equal(M.parseAnswer('no json').ok, false);
  assert.equal(M.parseAnswer(JSON.stringify({ summary: 's', points: [] })).ok, false);
  assert.equal(M.parseAnswer(JSON.stringify({ summary: 's', points: [{ kind: 'verdict', text: 'x' }] })).ok, false);
  assert.equal(M.parseAnswer(JSON.stringify({ summary: 's', points: Array(7).fill({ kind: 'idea', text: 'x' }) })).ok, false);
  assert.equal(M.parseAnswer(JSON.stringify({ summary: 's', points: [{ kind: 'idea', text: 'Widen your stop to 2 ATR.' }] })).ok, false);
  assert.equal(M.parseAnswer(JSON.stringify({ summary: 's', points: [{ kind: 'idea', text: 'Try it without a stop.' }] })).ok, false);
  assert.equal(M.parseAnswer(JSON.stringify({ summary: 'This is a proven edge.', points: [{ kind: 'good', text: 'x' }] })).ok, false);
  assert.equal(M.parseAnswer(JSON.stringify({ summary: 's', points: [{ kind: 'risk', text: 'Never widen your stop after entry; keep it.' }] })).ok, true, 'advice to keep the stop is fine');
  assert.equal(M.parseAnswer(JSON.stringify({ summary: 'Your record, not a tested edge.', points: [{ kind: 'habit', text: 'x' }] })).ok, true);
});

test('endpoint: off without a key; session required; foreign Origin refused; GET says enabled', async () => {
  let r = res(); await H.handle(req(closedTrade(), { headers: { origin: 'https://evil.example' } }), r, d0()); assert.equal(r.code, 403);
  r = res(); await H.handle(req(closedTrade()), r, d0({ who: async () => null })); assert.equal(r.code, 401);
  const C = fakeComplete();
  r = res(); await H.handle(req(closedTrade()), r, d0({ env: { BLOB_READ_WRITE_TOKEN: 'x' }, complete: C.fn })); assert.equal(r.body.state, 'off'); assert.equal(C.calls, 0);
  r = res(); await H.handle(req(closedTrade()), r, d0({ env: { ...ENV, CHRONOS_COACH: 'off' }, complete: C.fn })); assert.equal(r.body.state, 'off'); assert.equal(C.calls, 0);
  r = res(); await H.handle({ method: 'GET', headers: {}, query: {} }, r, d0({ env: { BLOB_READ_WRITE_TOKEN: 'x' } })); assert.equal(r.code, 200); assert.equal(r.body.enabled, false); assert.match(r.body.reason, /no language-model key/);
  r = res(); await H.handle({ method: 'GET', headers: {}, query: {} }, r, d0()); assert.equal(r.body.enabled, true); assert.equal(r.body.perDay, H.PER_DAY);
  r = res(); await H.handle({ method: 'GET', headers: {}, query: {} }, r, d0({ who: async () => null })); assert.equal(r.code, 401);
  r = res(); await H.handle({ method: 'PUT', headers: {}, query: {} }, r, d0()); assert.equal(r.code, 405);
  r = res(); await H.handle(req({ ...closedTrade(), trade: { ...closedTrade().trade, stop0: 4000 } }), r, d0({ complete: C.fn })); assert.equal(r.code, 400); assert.equal(C.calls, 0, 'a bad body is refused before any call');
  r = res(); await H.handle(req('x'.repeat(400000)), r, d0({ complete: C.fn })); assert.equal(r.code, 413);
});

test('endpoint: one call, the answer stored; the same question answered from the store; the feature cap is sent', async () => {
  H._calls.clear(); const C = fakeComplete(), d = d0({ complete: C.fn });
  let r = res(); await H.handle(req(closedTrade()), r, d);
  assert.equal(r.body.state, 'ok'); assert.equal(r.body.answer.points[0].kind, 'risk'); assert.equal(C.calls, 1);
  assert.equal(C.reqs[0].cap, 'feature'); assert.equal(C.reqs[0].maxTokens, H.MAX_OUT); assert.equal(H.MAX_OUT, 4000);
  r = res(); await H.handle(req(closedTrade()), r, d); assert.equal(r.body.state, 'ok'); assert.equal(r.body.cached, true); assert.equal(C.calls, 1);
  assert.equal(d.store.peek('answers.json').rows.length, 1);
});

test('endpoint: per-account daily limit; a budget skip is not stored; an unbilled error is not stored', async () => {
  H._calls.clear(); const C = fakeComplete(), d = d0({ complete: C.fn, env: { ...ENV, CHRONOS_COACH_PER_DAY: '2' } });
  for (let i = 0; i < 2; i++) { const r = res(); await H.handle(req(closedTrade({ market: "m" + i })), r, d); assert.equal(r.body.state, 'ok'); }
  let r = res(); await H.handle(req(closedTrade({ market: "m9" })), r, d); assert.equal(r.body.state, 'limit'); assert.equal(C.calls, 2);
  r = res(); await H.handle(req(closedTrade({ market: "m9" })), r, { ...d, who: who('fred') }); assert.equal(r.body.state, 'ok', 'another account has its own count');
  r = res(); await H.handle(req(closedTrade({ market: "m9" })), r, { ...d, now: () => NOW + 86400e3 }); assert.equal(r.body.state, 'ok', 'a new UTC day');
  H._calls.clear(); const st = ST.memoryStore();
  r = res(); await H.handle(req(closedTrade()), r, d0({ store: st, complete: async () => ({ available: true, skipped: 'budget', scope: 'day' }) })); assert.equal(r.body.state, 'budget'); assert.match(r.body.message, /daily budget/); assert.equal(st.peek('answers.json'), undefined);
  r = res(); await H.handle(req(closedTrade()), r, d0({ store: st, complete: async () => ({ available: true, error: 'the language-model call failed', status: 500 }) })); assert.equal(r.body.state, 'error'); assert.equal(st.peek('answers.json'), undefined);
});

test('endpoint: a billed answer that fails the checks (or is cut at the cap) is stored as refused once and never asked again', async () => {
  H._calls.clear(); const st = ST.memoryStore(), C = fakeComplete(JSON.stringify({ summary: 's', points: [{ kind: 'idea', text: 'Widen your stop.' }] }));
  let r = res(); await H.handle(req(closedTrade()), r, d0({ store: st, complete: C.fn })); assert.equal(r.body.state, 'refused'); assert.equal(C.calls, 1);
  r = res(); await H.handle(req(closedTrade()), r, d0({ store: st, complete: C.fn })); assert.equal(r.body.state, 'refused'); assert.equal(C.calls, 1, 'not paid for twice');
  const C2 = fakeComplete('{"summ', { stop: 'length' }), st2 = ST.memoryStore();
  r = res(); await H.handle(req(closedTrade()), r, d0({ store: st2, complete: C2.fn })); assert.equal(r.body.state, 'refused'); assert.match(st2.peek('answers.json').rows[0].refused[0], /CHRONOS_LLM_MAX_TOKENS/);
});

test('endpoint: through the real adapter with a fake provider (reasoning block, then the text)', async () => {
  H._calls.clear(); const bodies = [];
  const fetch = async (url, o) => { bodies.push(JSON.parse(o.body)); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ model: 'm-test', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: OK }], usage: { input_tokens: 3000, output_tokens: 900 } }) }; };
  const r = res(); await H.handle(req(closedTrade()), r, d0({ fetch, env: { ...ENV, CHRONOS_LLM_DAILY_USD: '1' } }));
  assert.equal(r.body.state, 'ok'); assert.equal(bodies.length, 1); assert.equal(bodies[0].max_tokens, 4000);
  assert.equal(H.llmEnv({ CHRONOS_LLM_STOP: '1' }).ACADEMY_LLM_STOP, '1'); assert.equal(H.llmEnv({}).ACADEMY_LLM_MAX_CALLS_DAY, '100'); assert.equal(H.llmEnv({}).ACADEMY_LLM_DAILY_USD, '0.5');
});

test('wiring: both hosts, the page block is display only, the cards say what they are', () => {
  assert.match(src('cloudflare/src/worker.mjs'), /'chronos-coach': chronosCoach/);
  assert.ok(JSON.parse(src('vercel.json')).functions['api/chronos-coach.js']);
  const page = src('backtest.html'), a = page.indexOf('// ---- AI coach (17 Nov 2026)'), z = page.indexOf('// ---- end AI coach'); assert.ok(a > 0 && z > a);
  const blk = page.slice(a, z);
  assert.doesNotMatch(blk, /\.stop\s*=[^=]/); assert.doesNotMatch(blk, /BT\.(place|close|closePartial|cancel|advance|onBar)\(|\binstant\(|startDraft\(|fixPos|fixOrd|S\.acct\s*=/);
  assert.doesNotMatch(blk, /localStorage|sessionStorage|indexedDB/);
  assert.match(blk, /AI coach · a language model's reading, not a tested edge/); assert.match(blk, /The AI coach is off/); assert.match(blk, /Ask the coach/);
  assert.match(page, /<div class="aic" id="ai-tr" hidden><\/div>/); assert.match(page, /<div class="aic" id="ai-ss" hidden><\/div>/);
  assert.match(page, /aiTradeShow\(\); \$\('mistd'\)\.showModal\(\)/);
  // 12 px or more in its style rules; 44 px on touch; nothing of it in the simple phone view's block
  const css = page.slice(page.indexOf('/* AI coach (17 Nov 2026)'), page.indexOf('.mist-grid { display: grid;'));
  for (const m of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(+m[1] >= 12, m[0]);
  assert.match(css, /@media \(pointer: coarse\) \{ \.aic \.ai-go \{ min-height: 44px; \} \}/);
  const ps = page.slice(page.indexOf('@media (max-width: 640px) {', page.indexOf('.ps-only, .ps-sw { display: none; }')));
  assert.doesNotMatch(ps.slice(0, ps.indexOf('</style>')), /\.ai[-c]/);
});

// ---- coach for results (17 Nov 2026): the session question over all saved sessions, and the end-of-session debrief
const DEB_OK = JSON.stringify({ summary: 'Exits by hand cost the most.', leaks: [{ text: 'Exited early: 14 trades, holding to the opening target or stop would have made +3.10R instead of -3.30R.' }, { text: 'Stops moved away: 6 trades, -6.00R.' }], focus: 'Hold each trade to its target or its stop.', drill: 'Replay 20 London opens and close nothing by hand.' });
const debriefBody = (o = {}) => ({ kind: 'debrief', scope: 'all', debrief: { n: 40, R: -3.2, wins: 15, plan: { maxTrades: 3, maxLossR: 2, maxLosses: 3, focus: 'x'.repeat(500) },
  adherence: { days: 6, kept: 4, past: 3 }, leaks: Array.from({ length: 20 }, () => ({ name: 'Exited early (by hand, under 1R)', n: 14, sumR: 2.1, meanR: 0.15, lost: 6.4, judge: 'too few to judge', held: { n: 12, R: 3.1, actual: -3.3, open: 1 }, evil: '<script>' })),
  headline: 'Your biggest leak: exited early…', be: { reached: 9, lostAfter: 3, gain: 3 }, capture: { n: 15, ratio: 0.42 }, best: { R: 2.4, side: 'buy', label: 'XAU 15m', sentence: 'Buying in London.' }, worst: { R: -1.2, side: 'sell' },
  grades: [{ grade: 'A', n: 10, meanR: 0.4 }, { grade: 'Z', n: 3, meanR: 9 }], ...o }, trades: Array.from({ length: 70 }, (_, i) => ({ R: i % 2 ? 1 : -1, side: 'buy', sentence: 'Buying.', mistakes: ['Exited early'] })), candles: bars(T0, 300) });

test('session request, scope all: labelled trades and a sessions count; scope session as before', () => {
  const trades = Array.from({ length: 5 }, () => ({ R: 1, side: 'buy', sentence: 'Buying.', market: 'EURUSD 15m' }));
  const split = { n: 5, noCtx: 0, lead: '', features: [] };
  const a = M.buildRequest({ kind: 'session', scope: 'all', sessions: 99999, splits: split, trades }).payload.session;
  assert.equal(a.sessions, 1000); assert.match(a.scope, /^all saved replay sessions/); assert.equal(a.lastTrades[0].market, 'EURUSD 15m');
  const s = M.buildRequest({ kind: 'session', splits: split, trades }).payload.session;
  assert.equal(s.scope, 'this replay session'); assert.equal(s.sessions, undefined); assert.equal(s.lastTrades[0].market, undefined);
});

test('debrief request: every field capped and re-read; no candles; unknown grades dropped; 400 without trades', () => {
  const q = M.buildRequest(debriefBody()), d = q.payload.debrief;
  assert.equal(q.kind, 'debrief'); assert.equal(q.schema, M.DEBRIEF_SCHEMA); assert.match(q.system, /ONE focus rule/); assert.match(q.system, /Never suggest removing a stop, widening a stop/);
  assert.equal(d.leaks.length, M.LIM.leaks); assert.equal(d.leaks[0].evil, undefined); assert.deepEqual(d.leaks[0].heldToOpeningTargetOrStop, { measured: 12, heldR: 3.1, actualR: -3.3, stillOpen: 1 });
  assert.equal(d.plan.focusRule.length, 200); assert.equal(d.lastTrades.length, 40); assert.deepEqual(d.grades.map((g) => g.grade), ['A']);
  assert.equal(q.payload.candles, undefined); assert.doesNotMatch(q.prompt, /\[\d{10},/); assert.equal(d.scope, 'all saved replay sessions');
  assert.throws(() => M.buildRequest(debriefBody({ n: 0 })), /no closed trades/); assert.throws(() => M.buildRequest({ kind: 'debrief' }), /no debrief/);
  assert.match(M.debriefSystem('fr'), /Answer in French/);
});

test('parseDebrief: the shape; no stop advice, no proven edge or guarantee; a "never widen" sentence is fine', () => {
  assert.deepEqual(M.parseDebrief(DEB_OK).answer.focus, 'Hold each trade to its target or its stop.');
  const bad = (o) => M.parseDebrief(JSON.stringify({ ...JSON.parse(DEB_OK), ...o }));
  assert.deepEqual(bad({ focus: 'Widen your stop to 2 ATR.' }).why, ['stop advice the coach may not give']);
  assert.deepEqual(bad({ drill: 'Trade without a stop for a day.' }).why, ['stop advice the coach may not give']);
  assert.deepEqual(bad({ summary: 'This is a proven edge.' }).why, ['a claim the coach may not make']);
  assert.equal(bad({ focus: 'Never widen your stop.' }).ok, true);
  assert.deepEqual(bad({ leaks: [] }).why, ['1 to 3 leaks']); assert.deepEqual(bad({ leaks: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }] }).why, ['1 to 3 leaks']);
  assert.deepEqual(bad({ drill: '' }).why, ['no drill']); assert.equal(M.parseDebrief('not json').ok, false);
});

test('endpoint, debrief: answered and stored; its own daily count; asked again from the store; a rule-breaking answer refused once', async () => {
  H._calls.clear(); const C = fakeComplete(DEB_OK), d = d0({ complete: C.fn, env: { ...ENV, CHRONOS_DEBRIEF_PER_DAY: '2' } });
  let r = res(); await H.handle(req(debriefBody()), r, d);
  assert.equal(r.body.state, 'ok'); assert.equal(r.body.answer.drill, 'Replay 20 London opens and close nothing by hand.'); assert.equal(C.reqs[0].schemaName, 'coach_debrief');
  r = res(); await H.handle(req(debriefBody()), r, d); assert.equal(r.body.cached, true); assert.equal(C.calls, 1);
  r = res(); await H.handle(req(debriefBody({ R: -1 })), r, d); assert.equal(r.body.state, 'ok');
  r = res(); await H.handle(req(debriefBody({ R: -2 })), r, d); assert.equal(r.body.state, 'limit'); assert.match(r.body.message, /2 debriefs today/);
  r = res(); await H.handle(req(closedTrade()), r, d); assert.notEqual(r.body.state, 'limit', 'trade questions keep their own count'); assert.equal(C.calls, 3);
  r = res(); await H.handle({ method: 'GET', headers: { host: 'aureumdesk.co.uk' }, query: {} }, r, d); assert.equal(r.body.debriefPerDay, 2); assert.equal(r.body.debriefLeftToday, 0);
  H._calls.clear(); const B = fakeComplete(JSON.stringify({ ...JSON.parse(DEB_OK), focus: 'Move your stop further away when in doubt.' })), d2 = d0({ complete: B.fn });
  r = res(); await H.handle(req(debriefBody()), r, d2); assert.equal(r.body.state, 'refused');
  r = res(); await H.handle(req(debriefBody()), r, d2); assert.equal(r.body.state, 'refused'); assert.equal(B.calls, 1, 'never asked again');
});
