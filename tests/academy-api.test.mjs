// node --test tests/academy-api.test.mjs — MeridianX Academy API (api/academy.js), its store (api/_academy-store.js) and the
// optional language-model adapter (api/_academy-llm.js). Offline: an in-memory store, a fake session, a fake fetch. No real call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handle } = require('../api/academy.js');
const ST = require('../api/_academy-store.js');
const LLM = require('../api/_academy-llm.js');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const OWNER = { u: 'owner' }, FRED = { u: 'fred', role: 'reviewer' };
const T0 = 1700000000;
// generated files as the Edges module writes them: candidates (no outcome fields) and outcomes keyed by candidate id.
// The first candidate carries a stray outcome field on purpose: the API must never let it out.
const CANDS = [
  { id: 'replica:1', edge: 'replica', market: 'xau', t: T0, side: 'buy', entry: 2000, stop: 1995, target: 2010, tf: '15m', rule: { tag: 'sweep' }, edgeVersion: 'ev1', pool: 'train', R: 2, netR: 1.9 },
  { id: 'replica:2', edge: 'replica', market: 'xau', t: T0 + 3600, side: 'sell', entry: 2010, stop: 2015, target: 2000, tf: '15m', rule: {}, edgeVersion: 'ev1', pool: 'train' },
  { id: 'replica:x1', edge: 'replica', market: 'xau', t: T0 + 7200, side: 'buy', entry: 2020, stop: 2015, target: 2030, tf: '15m', rule: {}, edgeVersion: 'ev1', pool: 'exam' },
  { id: 'replica:x2', edge: 'replica', market: 'xau', t: T0 + 10800, side: 'sell', entry: 2030, stop: 2035, target: 2020, tf: '15m', rule: {}, edgeVersion: 'ev1', pool: 'exam' },
  { id: 'replica:x3', edge: 'replica', market: 'xau', t: T0 + 14400, side: 'buy', entry: 2040, stop: 2035, target: 2050, tf: '15m', rule: {}, edgeVersion: 'ev1', pool: 'exam' },
];
const OUTS = { 'replica:1': { id: 'replica:1', R: -1, netR: -1.05, exitT: T0 + 900, exit: 1995, reason: 'stop', mfeR: 0.4, maeR: 1 }, 'replica:2': { id: 'replica:2', R: 2, netR: 1.9, exitT: T0 + 5000, exit: 2000, reason: 'target', mfeR: 2, maeR: 0.2 },
  'replica:x1': { id: 'replica:x1', R: -1, netR: -1.05, exitT: T0 + 8000, exit: 2015, reason: 'stop', mfeR: 0.1, maeR: 1 }, 'replica:x2': { id: 'replica:x2', R: 2, netR: 1.9, exitT: T0 + 12000, exit: 2020, reason: 'target', mfeR: 2, maeR: 0.3 } };
const DATA = { edges: async () => [{ id: 'replica', name: 'Gold replica', market: 'xau' }, { id: 'gtrend', name: 'Gold trend', market: 'xau' }], candidates: async (e) => (e === 'replica' ? CANDS : null), outcomes: async (e) => (e === 'replica' ? { outcomes: OUTS } : null) };

function mk(extra = {}) {
  const store = ST.memoryStore(); let clock = Date.UTC(2026, 10, 10, 12);
  return { store, deps: { env: {}, store, who: async () => OWNER, sameOrigin: () => true, data: DATA, now: () => (clock += 1000), ...extra } };
}
async function call(ctx, method, payload, extra = {}) {
  const out = { headers: {} }, res = { setHeader: (k, v) => { out.headers[k] = v; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } };
  await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, { ...ctx.deps, ...extra });
  return out;
}
const get = (ctx, q, extra) => call(ctx, 'GET', q, extra), post = (ctx, b, extra) => call(ctx, 'POST', b, extra);
const decision = (o = {}) => ({ id: 'client-made-id', edge: 'replica', market: 'xau', t: T0, action: 'BUY', entry: 2000, stop: 1995, target: 2010, candidateId: 'replica:1', thesis: 'Sweep of the Asia low, then displacement up.',
  supporting: [{ factor: 'sweep', text: 'took the low', weight: 2 }], contradicting: [{ factor: 'htfBias', text: 'daily is down', weight: 1 }], waitReasons: [], invalidation: ['a close under 1995'],
  risk: { rr: 2, stopAtr: 1.1, riskPct: 0.25, allowed: true, blocks: [] }, similar: { n: 12, winRate: 0.5, avgR: 0.3, note: 'before t only' }, lessonsApplied: [], confidence: 'medium', uncertainty: ['news in 40 min'],
  modelVersion: null, policyVersion: 'p1', edgeVersion: 'ev1', dataVersion: 'd1', featuresHash: 'abc', ...o });
const attempt = (o = {}, dec = {}) => ({ action: 'attempt', attempt: { candidateId: 'replica:1', edge: 'replica', mode: 'train', decision: decision(dec), lessonsAvailable: [], snapshotHash: 'h1', ...o }, features: { htfBias: 'down', rr: 2, sweep: true } });
const auditRows = async (ctx) => (await get(ctx, { get: 'audit', month: '2026-11' })).body.rows;

test('auth: no session 401, a member 403, a cross-origin POST 403, the owner reads; GET and POST only; never cached', async () => {
  const c = mk();
  for (const [who, code] of [[null, 401], [FRED, 403]]) {
    assert.equal((await get(c, { get: 'edges' }, { who: async () => who })).code, code);
    assert.equal((await post(c, attempt(), { who: async () => who })).code, code);
  }
  assert.equal((await post(c, attempt(), { sameOrigin: () => false })).code, 403);
  // the real same-origin check: a browser posting from another site
  const out = {}, res = { setHeader() {}, status(x) { out.code = x; return res; }, json(b) { out.body = b; return out; } };
  await handle({ method: 'POST', headers: { origin: 'https://evil.example', host: 'meridianx.dev' }, body: attempt() }, res, { ...c.deps, sameOrigin: undefined });
  assert.equal(out.code, 403);
  assert.deepEqual(c.store.keys(), [], 'nothing was written by a refused request');
  const g = await get(c, { get: 'edges' }); assert.equal(g.code, 200); assert.equal(g.body.edges[0].id, 'replica'); assert.equal(g.headers['Cache-Control'], 'private, no-store');
  assert.equal((await call(c, 'PUT', {})).code, 405); assert.equal((await call(c, 'DELETE', {})).code, 405);
  assert.equal((await get(c, { get: 'edges' }, { who: async () => null })).headers['Cache-Control'], 'private, no-store');
  // without the registry the answer is a clear 503, not an empty list
  const no = await get(c, { get: 'edges' }, { data: { ...DATA, edges: async () => null } }); assert.equal(no.code, 503); assert.match(no.body.error, /edges not generated yet/);
  // without storage: 503
  assert.equal((await get(c, { get: 'lessons' }, { store: undefined, env: {} })).code, 503);
});

test('validation: unknown action or enum, a trade without a stop, non-finite numbers, bad or oversized bodies are refused and nothing is written', async () => {
  const c = mk();
  assert.equal((await post(c, { action: 'nope' })).code, 400);
  assert.equal((await post(c, { action: 'constructor' })).code, 400);
  assert.equal((await post(c, {})).code, 400);
  assert.equal((await get(c, { get: 'nope' })).code, 400);
  assert.equal((await get(c, {})).code, 400);
  assert.equal((await post(c, [1, 2])).code, 400, 'the body must be an object');
  assert.equal((await post(c, '{not json')).code, 400);
  assert.equal((await post(c, attempt({ mode: 'practice' }))).code, 400, 'bad mode');
  assert.equal((await post(c, attempt({ edge: 'unknown-edge' }))).code, 400);
  assert.equal((await post(c, attempt({ candidateId: '../../etc' }))).code, 400);
  assert.equal((await post(c, attempt({}, { action: 'HOLD' }))).code, 400, 'bad action');
  assert.equal((await post(c, attempt({}, { confidence: '87%' }))).code, 400, 'confidence is a word');
  const noStop = await post(c, attempt({}, { stop: null })); assert.equal(noStop.code, 400); assert.match(noStop.body.error, /every trade has a stop/);
  assert.match((await post(c, attempt({}, { stop: 2004 }))).body.error, /wrong side/);
  assert.match((await post(c, attempt({}, { target: 1990 }))).body.error, /target is on the wrong side/);
  assert.equal((await post(c, attempt({}, { entry: '2000' }))).code, 400, 'numbers are numbers');
  assert.equal((await post(c, JSON.stringify(attempt()).replace('"entry":2000', '"entry":1e999'))).code, 400, 'Infinity is refused');
  assert.equal((await post(c, attempt({}, { t: undefined }))).code, 400, 'the decision time is required');
  assert.equal((await post(c, { ...attempt(), features: { 'bad key!': 1 } })).code, 400);
  assert.equal((await post(c, { ...attempt(), features: { nested: { a: 1 } } })).code, 400);
  const big = await post(c, { action: 'session.save', session: { edge: 'replica', state: { blob: 'x'.repeat(260 * 1024) } } }); assert.equal(big.code, 413);
  assert.equal((await call(c, 'POST', '{"action":"seen"}', {})).code, 400);
  const out = {}, res = { setHeader() {}, status(x) { out.code = x; return res; }, json(b) { out.body = b; return out; } };
  await handle({ method: 'POST', headers: { 'content-length': String(300 * 1024) }, body: attempt() }, res, c.deps); assert.equal(out.code, 413);
  assert.equal((await post(c, { action: 'correct', edge: 'replica', correction: { attemptId: 'at_x', verdict: 'maybe' } })).code, 400);
  assert.equal((await post(c, { action: 'correct', edge: 'replica', correction: { attemptId: 'at_x', verdict: 'change' } })).code, 400, 'a change names the action');
  assert.equal((await post(c, { action: 'correct', edge: 'replica', correction: { attemptId: 'at_x', verdict: 'reject', reasons: ['bad-vibes'] } })).code, 400);
  assert.equal((await post(c, { action: 'lesson.save', lesson: { edge: 'replica', title: 'x', when: [{ f: 'rr', op: 'approx', v: 2 }] } })).code, 400);
  assert.equal((await post(c, { action: 'lesson.save', lesson: { edge: 'replica', title: 'x', when: [{ f: 'rr', op: 'between', v: [3, 1] }] } })).code, 400);
  assert.equal((await post(c, { action: 'lesson.save', lesson: { edge: 'replica', title: 'x', then: { action: 'DOUBLE' } } })).code, 400);
  assert.equal((await post(c, { action: 'lesson.save', lesson: { edge: 'replica' } })).code, 400, 'a lesson has a title');
  assert.equal((await post(c, { action: 'seen', edge: 'replica', ids: [], mode: 'train' })).code, 400);
  assert.equal((await post(c, { action: 'lesson.stats', id: 'ls_x', inc: { wins: 1 } })).code, 400);
  assert.equal((await post(c, { action: 'lesson.stats', id: 'ls_x', inc: { applied: -1 } })).code, 400);
  assert.equal((await get(c, { get: 'audit', month: 'last' })).code, 400);
  assert.equal((await get(c, { get: 'candidates', edge: 'replica', pool: 'all' })).code, 400);
  assert.deepEqual(c.store.keys(), [], 'no refused request wrote anything');
  // text is capped and control characters are stripped; unknown fields are dropped; the id is made on the server
  const ok = await post(c, attempt({}, { thesis: `bad\u0000 \u0007text ${'y'.repeat(9000)}`, secret: 'dropped', outcome: { R: 3 } }));
  assert.equal(ok.code, 200); const d = ok.body.attempt.decision;
  assert.equal(d.thesis.length, 6000); assert.ok(!/[\u0000-\u0008]/.test(d.thesis)); assert.equal(d.secret, undefined); assert.equal(d.outcome, undefined);
  assert.notEqual(d.id, 'client-made-id'); assert.match(d.id, /^dc_[a-z0-9]+$/); assert.match(ok.body.attempt.id, /^at_[a-z0-9]+$/);
});

test('the learning loop: attempt, correction, lesson, second attempt (n = 2); both attempts come back; the dataset keeps the mentor label apart from the outcome', async () => {
  const c = mk();
  const a1 = await post(c, attempt()); assert.equal(a1.code, 200); assert.equal(a1.body.n, 1); assert.equal(a1.body.attempt.n, 1); assert.equal(a1.body.attempt.mode, 'train');
  const cor = await post(c, { action: 'correct', edge: 'replica', correction: { attemptId: a1.body.attempt.id, verdict: 'reject', action: 'WAIT', bias: 'down', reasons: ['htf-bias', 'htf-bias', 'early'], text: 'Daily is down: wait for the H1 break first.', errorClass: 'against-htf',
    annotations: [{ kind: 'structure', t: T0 - 3600, price: 2004, note: 'H1 lower high' }] } });
  assert.equal(cor.code, 200); assert.equal(cor.body.correction.attemptId, a1.body.attempt.id); assert.deepEqual(cor.body.correction.reasons, ['htf-bias', 'early']); assert.equal(cor.body.correction.candidateId, 'replica:1');
  assert.equal(cor.body.correction.was.action, 'BUY'); assert.equal(cor.body.datasetUpdated, true);
  assert.equal((await post(c, { action: 'correct', edge: 'replica', correction: { attemptId: 'at_missing', verdict: 'approve' } })).code, 404);
  assert.equal((await post(c, { action: 'correct', edge: 'replica', correction: { attemptId: a1.body.attempt.id, verdict: 'change', action: 'SELL', entry: 2000, stop: 1990 } })).code, 400, 'the mentor\'s trade needs its stop on the right side too');
  const les = await post(c, { action: 'lesson.save', lesson: { edge: 'replica', title: 'No longs against a falling daily', text: 'Wait for the H1 structure break.', when: [{ f: 'htfBias', op: 'eq', v: 'down' }, { f: 'rr', op: 'lte', v: 2.5 }],
    then: { action: 'WAIT', adjust: {}, note: 'needs the H1 break' }, source: { attemptId: a1.body.attempt.id, correctionId: cor.body.correction.id, candidateId: 'replica:1' } } });
  assert.equal(les.code, 200); const L1 = les.body.lesson; assert.equal(L1.version, 1); assert.equal(L1.active, true); assert.equal(L1.supersedes, null); assert.deepEqual(L1.stats, { applied: 0, replayPass: 0, replayFail: 0, examN: 0, examAgree: 0, examNetWith: 0, examNetWithout: 0 });
  const a2 = await post(c, attempt({ mode: 'replay-same', lessonsAvailable: [L1.id] }, { action: 'WAIT', entry: null, stop: null, target: null, lessonsApplied: [{ id: L1.id, version: 1, effect: 'WAIT' }] }));
  assert.equal(a2.code, 200); assert.equal(a2.body.n, 2); assert.equal(a2.body.attempt.n, 2);
  const list = await get(c, { get: 'attempts', edge: 'replica', cand: 'replica:1' });
  assert.deepEqual(list.body.attempts.map((x) => [x.n, x.mode, x.decision.action]), [[1, 'train', 'BUY'], [2, 'replay-same', 'WAIT']]);
  assert.ok(list.body.attempts[0].id < list.body.attempts[1].id, 'ids sort by time');
  assert.equal((await get(c, { get: 'attempts', edge: 'replica', cand: 'replica:2' })).body.attempts.length, 0);
  // Layer B rows: one per attempt; the mentor label sits in its own field, the outcome label in another
  const ds = c.store.peek('dataset/replica.json').rows; assert.equal(ds.length, 2);
  assert.deepEqual(Object.keys(ds[0]).sort(), ['at', 'candidateId', 'datasetVersion', 'decision', 'edge', 'edgeVersion', 'features', 'id', 'mentor', 'mode', 'modelVersion', 'n', 'outcome', 'snapshotHash', 't']);
  assert.equal(ds[0].mentor.action, 'WAIT'); assert.equal(ds[0].mentor.verdict, 'reject'); assert.equal(ds[0].outcome, null, 'the correction never writes the outcome label'); assert.equal(ds[1].mentor, null);
  assert.deepEqual(ds[0].features, { htfBias: 'down', rr: 2, sweep: true }); assert.equal(ds[0].snapshotHash, 'h1'); assert.equal(ds[0].edgeVersion, 'ev1'); assert.equal(ds[0].t, T0);
  const dsGet = await get(c, { get: 'dataset', edge: 'replica' }); assert.equal(dsGet.body.rows[0].mentor.action, 'WAIT'); assert.equal(dsGet.body.rows[0].outcome.netR, -1.05);
  // progress and mistakes are computed from what is stored
  const p = (await get(c, { get: 'progress', edge: 'replica' })).body;
  assert.deepEqual(p.counts, { attempts: 2, corrections: 1, lessons: 1, lessonsActive: 1, seen: 1, exams: 0, datasetRows: 2 });
  assert.deepEqual([p.replaySame.n, p.replaySame.graded, p.replaySame.pass, p.replaySame.passRate], [1, 1, 1, 1]); assert.equal(p.byWeek.length, 1); assert.equal(p.byWeek[0].week, '2026-W46'); assert.equal(p.byWeek[0].attempts, 2);
  const m = (await get(c, { get: 'mistakes', edge: 'replica' })).body; assert.deepEqual(m.byClass, { 'against-htf': 1 }); assert.deepEqual(m.byReason, { 'htf-bias': 1, early: 1 }); assert.equal(m.n, 1);
});

test('no peeking: the outcome is refused before an attempt and returned after; candidates never carry outcome fields', async () => {
  const c = mk();
  const before = await get(c, { get: 'outcome', id: 'replica:1', edge: 'replica' }); assert.equal(before.code, 403); assert.match(before.body.error, /decide first/);
  assert.equal((await get(c, { get: 'outcome', id: 'replica:1' })).code, 403, 'also without the edge');
  // marking a candidate as shown is not a decision
  await post(c, { action: 'seen', edge: 'replica', ids: ['replica:1'], mode: 'train' });
  assert.equal((await get(c, { get: 'outcome', id: 'replica:1', edge: 'replica' })).code, 403);
  const cands = (await get(c, { get: 'candidates', edge: 'replica' })).body;
  assert.equal(cands.pool, 'train'); assert.deepEqual(cands.candidates.map((x) => x.id), ['replica:1', 'replica:2']);
  for (const x of cands.candidates) for (const k of ['R', 'netR', 'exit', 'exitT', 'reason', 'mfeR', 'maeR']) assert.equal(x[k], undefined, `candidate leaks ${k}`);
  assert.equal(cands.seen['replica:1'].attempts, 0);
  await post(c, attempt());
  const after = await get(c, { get: 'outcome', id: 'replica:1', edge: 'replica' }); assert.equal(after.code, 200);
  assert.deepEqual(after.body.outcome, OUTS['replica:1']);
  assert.equal((await get(c, { get: 'outcome', id: 'replica:1' })).body.outcome.reason, 'stop', 'the edge is found from the stored attempt');
  assert.equal((await get(c, { get: 'outcome', id: 'replica:2', edge: 'replica' })).code, 403, 'one decision opens one outcome');
  assert.equal((await get(c, { get: 'candidates', edge: 'gtrend' })).code, 503, 'not generated yet is said plainly');
  assert.deepEqual((await get(c, { get: 'candidates', edge: 'replica', from: String(T0 + 1), limit: '1' })).body.candidates.map((x) => x.id), ['replica:2']);
});

test('the exam pool: only setups never seen; exam candidates cannot be trained on; one test result per candidate, graded against the outcome', async () => {
  const c = mk();
  const ids = async () => (await get(c, { get: 'candidates', edge: 'replica', pool: 'exam' })).body.candidates.map((x) => x.id);
  assert.deepEqual(await ids(), ['replica:x1', 'replica:x2', 'replica:x3']);
  assert.equal((await post(c, attempt({ candidateId: 'replica:x1', mode: 'train' }))).code, 400, 'an exam candidate is never a training example');
  assert.equal((await post(c, attempt({ candidateId: 'replica:1', mode: 'exam' }))).code, 400, 'a test needs an exam candidate');
  assert.equal((await post(c, { action: 'seen', edge: 'replica', ids: ['replica:x1'], mode: 'replay-same' })).code, 400);
  assert.equal((await post(c, { action: 'seen', edge: 'replica', id: 'replica:x1', mode: 'exam' })).body.marked, 1);
  assert.deepEqual(await ids(), ['replica:x2', 'replica:x3'], 'shown once = out of the pool');
  const lite = (action, e, s, t) => ({ action, entry: e, stop: s, target: t });
  // x1 (a loser): the lessons said WAIT, the plain policy took it. x2 (a winner): both took it.
  const r1 = await post(c, { action: 'exam.result', result: { edge: 'replica', candidateId: 'replica:x1', lessonIds: ['ls_a'], withLessons: lite('WAIT', null, null, null), withoutLessons: lite('BUY', 2020, 2015, 2030) } });
  assert.equal(r1.code, 200); assert.equal(r1.body.result.side, 'buy'); assert.equal(r1.body.result.outcome, undefined, 'the stored result holds no outcome');
  assert.equal((await post(c, { action: 'exam.result', result: { edge: 'replica', candidateId: 'replica:x1', lessonIds: [], withLessons: lite('WAIT'), withoutLessons: lite('WAIT') } })).code, 409, 'one result per candidate');
  assert.equal((await post(c, { action: 'exam.result', result: { edge: 'replica', candidateId: 'replica:1', lessonIds: [], withLessons: lite('WAIT'), withoutLessons: lite('WAIT') } })).code, 400, 'not an exam candidate');
  assert.equal((await post(c, { action: 'exam.result', result: { edge: 'replica', candidateId: 'replica:x2', lessonIds: [], withLessons: lite('SELL', 2030, 2035, 2020), withoutLessons: lite('SELL', 2030, 2031, 2020) } })).code, 200);
  assert.equal((await post(c, { action: 'exam.result', result: { edge: 'replica', candidateId: 'replica:x3', lessonIds: [], withLessons: lite('BUY', 2040, 2045, 2050), withoutLessons: lite('WAIT') } })).code, 400, 'a test decision needs a valid stop as well');
  assert.deepEqual(await ids(), ['replica:x3']);
  const a = await post(c, attempt({ candidateId: 'replica:x2', mode: 'exam' }, { action: 'SELL', entry: 2030, stop: 2035, target: 2020, t: T0 + 10800 })); assert.equal(a.code, 200); assert.equal(a.body.n, 1);
  assert.equal((await post(c, attempt({ candidateId: 'replica:x2', mode: 'exam' }, { action: 'SELL', entry: 2030, stop: 2035, target: 2020 }))).code, 409, 'a test is decided once');
  const ex = (await get(c, { get: 'exams', edge: 'replica' })).body; assert.equal(ex.exams.length, 2);
  const x1 = ex.exams.find((e) => e.candidateId === 'replica:x1'); assert.equal(x1.rWith, 0); assert.equal(x1.rWithout, -1.05); assert.equal(x1.outcome.reason, 'stop');
  const p = (await get(c, { get: 'progress', edge: 'replica' })).body.exam;
  assert.deepEqual([p.n, p.graded, p.agree], [2, 2, 1]);
  assert.deepEqual(p.withLessons, { taken: 1, wins: 1, netR: 1.9, avgR: 1.9 }); assert.deepEqual(p.withoutLessons, { taken: 2, wins: 1, netR: 0.85, avgR: 0.425 }); assert.equal(p.deltaNetR, 1.05);
});

test('lessons: a revision is a new version and the old one is kept; switching off; counters; newest first', async () => {
  const c = mk();
  const v1 = (await post(c, { action: 'lesson.save', lesson: { edge: '*', title: 'First', text: 'one', when: [{ f: 'session', op: 'in', v: ['asia', 'london'] }], then: { action: 'SKIP' } } })).body.lesson;
  const rev = await post(c, { action: 'lesson.revise', id: v1.id, patch: { title: 'First, sharper', when: [{ f: 'session', op: 'eq', v: 'asia' }, { f: 'atrPct', op: 'between', v: [0.2, 0.6] }] } });
  assert.equal(rev.code, 200); const v2 = rev.body.lesson;
  assert.equal(v2.version, 2); assert.equal(v2.supersedes, v1.id); assert.notEqual(v2.id, v1.id); assert.equal(v2.root, v1.id); assert.equal(v2.active, true); assert.equal(v2.text, 'one', 'unchanged fields carry over'); assert.equal(v2.title, 'First, sharper');
  assert.equal(rev.body.previous.id, v1.id); assert.equal(rev.body.previous.active, false); assert.equal(rev.body.previous.supersededBy, v2.id);
  const all = (await get(c, { get: 'lessons' })).body.lessons;
  assert.deepEqual(all.map((l) => [l.id, l.version, l.active]), [[v2.id, 2, true], [v1.id, 1, false]], 'both versions, newest first');
  assert.equal(all[1].title, 'First', 'version 1 is kept as it was');
  assert.equal((await post(c, { action: 'lesson.revise', id: v1.id, patch: { title: 'again' } })).code, 409, 'only the newest version is revised');
  assert.equal((await post(c, { action: 'lesson.revise', id: 'ls_none', patch: { title: 'x' } })).code, 404);
  assert.equal((await post(c, { action: 'lesson.revise', id: v2.id, patch: {} })).code, 400);
  const st = await post(c, { action: 'lesson.stats', id: v2.id, inc: { applied: 2, replayPass: 1, examN: 1, examNetWith: 1.9, examNetWithout: -1.05 } });
  assert.deepEqual(st.body.stats, { applied: 2, replayPass: 1, replayFail: 0, examN: 1, examAgree: 0, examNetWith: 1.9, examNetWithout: -1.05 });
  assert.equal((await post(c, { action: 'lesson.stats', id: v2.id, inc: { applied: 1 } })).body.stats.applied, 3);
  const off = await post(c, { action: 'lesson.deactivate', id: v2.id, reason: 'did not hold on new setups' }); assert.equal(off.body.lesson.active, false); assert.equal(off.body.lesson.deactivatedWhy, 'did not hold on new setups');
  assert.deepEqual((await get(c, { get: 'lessons', edge: 'replica', active: '1' })).body.lessons, []);
  assert.equal((await get(c, { get: 'lessons', edge: 'replica' })).body.lessons.length, 2, 'a lesson for every edge (*) is listed under each edge');
  assert.equal((await post(c, { action: 'lesson.deactivate', id: v1.id, active: true })).code, 409, 'a replaced version stays off');
  assert.equal((await post(c, { action: 'lesson.deactivate', id: v2.id, active: true })).body.lesson.active, true);
});

test('replay sessions: created, loaded, updated, listed', async () => {
  const c = mk();
  const s1 = await post(c, { action: 'session.save', session: { edge: 'replica', title: 'Monday gold', kind: 'replay', t: T0, candidateId: 'replica:1', state: { clock: { t: T0, speed: 5 }, queue: ['replica:1', 'replica:2'], thesis: { bias: 'up', text: 'bad\u0001char' } } } });
  assert.equal(s1.code, 200); const id = s1.body.session.id; assert.match(id, /^se_[a-z0-9]+$/); assert.equal(s1.body.session.rev, 1); assert.equal(s1.body.session.state.thesis.text, 'badchar');
  const got = await get(c, { get: 'session', id }); assert.equal(got.code, 200); assert.deepEqual(got.body.session.state.queue, ['replica:1', 'replica:2']); assert.equal(got.body.session.status, 'open');
  const s2 = await post(c, { action: 'session.save', session: { id, edge: 'replica', title: 'Monday gold', status: 'done', t: T0 + 3600, state: { clock: { t: T0 + 3600, speed: 1 }, queue: [] } } });
  assert.equal(s2.body.session.rev, 2); assert.equal(s2.body.session.createdAt, s1.body.session.createdAt); assert.notEqual(s2.body.session.updatedAt, s1.body.session.updatedAt);
  await post(c, { action: 'session.save', session: { edge: 'gtrend', title: 'Second' } });
  const idx = (await get(c, { get: 'sessions' })).body.sessions; assert.deepEqual(idx.map((x) => x.title), ['Second', 'Monday gold']); assert.equal(idx[1].status, 'done'); assert.equal(idx[1].state, undefined, 'the index holds no state');
  assert.equal((await get(c, { get: 'session', id })).body.session.state.clock.speed, 1);
  assert.equal((await post(c, { action: 'session.save', session: { id: 'se_doesnotexist1', edge: 'replica' } })).code, 404);
  assert.equal((await post(c, { action: 'session.save', session: { id: '../x', edge: 'replica' } })).code, 400);
  assert.equal((await get(c, { get: 'session', id: 'se_doesnotexist1' })).code, 404);
  assert.equal((await post(c, { action: 'session.save', session: { edge: 'replica', status: 'archived' } })).code, 400);
});

test('blind arena: the engine answer stays hidden until the mentor has answered; the mentor answers once', async () => {
  const c = mk();
  const a = await post(c, attempt({ candidateId: 'replica:2', mode: 'blind' }, { action: 'SELL', entry: 2010, stop: 2015, target: 2000, t: T0 + 3600 }));
  assert.equal(a.code, 200); assert.equal(a.body.attempt.decision, null); assert.equal(a.body.attempt.hidden, true);
  assert.ok(!JSON.stringify(a.body).includes('Sweep of the Asia low'), 'the thesis is not in the answer either');
  const hid = (await get(c, { get: 'attempts', edge: 'replica', cand: 'replica:2' })).body.attempts[0]; assert.equal(hid.decision, null); assert.equal(hid.hidden, true);
  assert.equal((await get(c, { get: 'attempts', edge: 'replica' })).body.attempts[0].decision, null);
  assert.equal((await get(c, { get: 'outcome', id: 'replica:2', edge: 'replica' })).code, 403, 'no outcome before the mentor answers');
  assert.equal((await get(c, { get: 'dataset', edge: 'replica' })).body.rows.length, 0, 'nor through the dataset');
  assert.equal((await post(c, { action: 'correct', edge: 'replica', correction: { attemptId: a.body.attempt.id, verdict: 'approve' } })).code, 409);
  assert.equal((await post(c, { action: 'blind.submit', blind: { edge: 'replica', candidateId: 'replica:2', action: 'SELL', entry: 2010, stop: 2005 } })).code, 400, 'the mentor\'s stop is checked too');
  assert.equal((await post(c, { action: 'blind.submit', blind: { edge: 'replica', candidateId: 'replica:2', action: 'MANAGE' } })).code, 400);
  const sub = await post(c, { action: 'blind.submit', blind: { edge: 'replica', candidateId: 'replica:2', action: 'WAIT', bias: 'down', text: 'Too late in the move.' } });
  assert.equal(sub.code, 200); assert.equal(sub.body.blind.mentor.action, 'WAIT'); assert.equal(sub.body.engine.action, 'SELL'); assert.equal(sub.body.engine.stop, 2015); assert.equal(sub.body.blind.agree, false); assert.equal(sub.body.engineAttemptId, a.body.attempt.id);
  assert.equal(c.store.peek('blind.json').rows[0].engine, undefined, 'the stored mentor answer does not hold the engine answer');
  assert.equal((await get(c, { get: 'attempts', edge: 'replica', cand: 'replica:2' })).body.attempts[0].decision.action, 'SELL', 'shown after the submit');
  assert.equal((await get(c, { get: 'outcome', id: 'replica:2', edge: 'replica' })).code, 200);
  assert.equal((await post(c, { action: 'blind.submit', blind: { edge: 'replica', candidateId: 'replica:2', action: 'SELL', entry: 2010, stop: 2015 } })).code, 409, 'no second answer after seeing the engine');
  // an answer with no engine decision stored yet: stored, engine null
  const lone = await post(c, { action: 'blind.submit', blind: { edge: 'replica', candidateId: 'replica:1', action: 'BUY', entry: 2000, stop: 1995, target: 2010 } }); assert.equal(lone.body.engine, null); assert.equal(lone.body.blind.agree, null);
});

test('audit: every successful write appends { at, who, action, ids, summary }; refused requests append nothing', async () => {
  const c = mk();
  const a = await post(c, attempt());
  const cor = await post(c, { action: 'correct', edge: 'replica', correction: { attemptId: a.body.attempt.id, verdict: 'approve' } });
  const les = await post(c, { action: 'lesson.save', lesson: { edge: 'replica', title: 'L' } });
  const rev = await post(c, { action: 'lesson.revise', id: les.body.lesson.id, patch: { title: 'L2' } });
  await post(c, { action: 'lesson.stats', id: rev.body.lesson.id, inc: { applied: 1 } });
  await post(c, { action: 'lesson.deactivate', id: rev.body.lesson.id });
  await post(c, { action: 'session.save', session: { edge: 'replica', title: 'S' } });
  await post(c, { action: 'seen', edge: 'replica', ids: ['replica:2'], mode: 'train' });
  await post(c, { action: 'exam.result', result: { edge: 'replica', candidateId: 'replica:x1', lessonIds: [], withLessons: { action: 'WAIT' }, withoutLessons: { action: 'WAIT' } } });
  await post(c, { action: 'blind.submit', blind: { edge: 'replica', candidateId: 'replica:2', action: 'WAIT' } });
  await post(c, { action: 'notebook.add', note: { title: 'N', hypothesis: 'h', dataset: 'd', method: 'm', validation: 'hypothesis' } });
  const reg = await post(c, { action: 'model.register', model: { name: 'scorer', version: '1' } });
  await post(c, { action: 'model.promote', id: reg.body.model.id, confirm: true });
  await post(c, { action: 'model.rollback', confirm: true });
  // refused ones
  await post(c, { action: 'nope' }); await post(c, attempt({ mode: 'x' })); await post(c, { action: 'lesson.revise', id: 'ls_none', patch: { title: 'x' } }); await post(c, { action: 'model.promote', id: reg.body.model.id });
  const rows = await auditRows(c);
  assert.deepEqual(rows.map((r) => r.action).reverse(), ['attempt', 'correct', 'lesson.save', 'lesson.revise', 'lesson.stats', 'lesson.deactivate', 'session.save', 'seen', 'exam.result', 'blind.submit', 'notebook.add', 'model.register', 'model.promote', 'model.rollback']);
  for (const r of rows) { assert.deepEqual(Object.keys(r), ['at', 'who', 'action', 'ids', 'summary']); assert.equal(r.who, 'owner'); assert.match(r.at, /^2026-11-10T/); assert.ok(Array.isArray(r.ids)); assert.ok(r.summary.length > 0); }
  const first = rows[rows.length - 1]; assert.ok(first.ids.includes(a.body.attempt.id) && first.ids.includes('replica:1')); assert.ok(rows[rows.length - 2].ids.includes(cor.body.correction.id));
  assert.deepEqual((await get(c, { get: 'audit', month: '2026-10' })).body.rows, [], 'one file per month');
  assert.ok(c.store.keys().includes('audit/2026-11.json'));
});

test('a failed store read answers 5xx and writes nothing', async () => {
  const c = mk(); await post(c, attempt());
  const before = JSON.stringify([...c.store.raw]), realRead = c.store.backend.read, realWrite = c.store.backend.write; let writes = 0;
  c.store.backend.write = async (k, v) => { writes++; return realWrite(k, v); };
  for (const broken of ['seen/replica.json', 'dataset/replica.json', 'audit/2026-11.json']) {   // whichever file fails, even the last one read
    c.store.backend.read = async (k) => { if (k === broken) throw new Error('blob read 500'); return realRead(k); };
    const r = await post(c, attempt({ mode: 'replay-same' })); assert.equal(r.code, 503, broken); assert.match(r.body.error, /nothing was saved/);
  }
  c.store.backend.read = async (k) => { if (k === 'lessons.json') throw new Error('blob read 500'); return realRead(k); };
  assert.equal((await post(c, { action: 'lesson.save', lesson: { edge: 'replica', title: 'L' } })).code, 503);
  assert.equal((await get(c, { get: 'lessons' })).code, 503, 'a failed read is never an empty list');
  assert.equal(writes, 0); assert.equal(JSON.stringify([...c.store.raw]), before, 'the store is byte for byte what it was');
  // a file that is not a row file is corrupt, not empty
  c.store.backend.read = realRead; c.store.raw.set('lessons.json', JSON.stringify({ oops: true }));
  assert.equal((await post(c, { action: 'lesson.save', lesson: { edge: 'replica', title: 'L' } })).code, 503); assert.equal(c.store.raw.get('lessons.json'), JSON.stringify({ oops: true }));
  // a failed write is a 5xx too
  c.store.raw.delete('lessons.json'); c.store.backend.write = async () => { throw new Error('blob put 500'); };
  assert.equal((await post(c, { action: 'lesson.save', lesson: { edge: 'replica', title: 'L' } })).code, 503);
});

test('the store: missing reads as the fallback, a failed Blob read throws, same options as the other private files, a queue per key, caps roll into archives', async () => {
  // Blob backend with a fake client
  const puts = [], files = new Map(), blob = { list: async ({ prefix }) => ({ blobs: [...files.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ pathname: k, url: `https://blob.example/${k}` })) }), put: async (p, body, opts) => { puts.push({ p, opts }); files.set(p, body); } };
  let ok = true; const fetchFn = async (url, o) => { assert.equal(o.headers.Authorization, 'Bearer tok'); assert.equal(o.cache, 'no-store'); return { ok, status: ok ? 200 : 500, json: async () => JSON.parse(files.get(url.replace('https://blob.example/', ''))) }; };
  const B = ST.blobStore({ BLOB_READ_WRITE_TOKEN: 'tok' }, { blob, fetch: fetchFn, recent: new Map(), tails: new Map() });
  assert.deepEqual(await B.get('lessons.json', { rows: [] }), { rows: [] }, 'missing = the fallback');
  await B.put('lessons.json', { v: 1, rows: [1] });
  assert.equal(puts[0].p, 'academy/lessons.json'); assert.deepEqual({ access: puts[0].opts.access, addRandomSuffix: puts[0].opts.addRandomSuffix, allowOverwrite: puts[0].opts.allowOverwrite, contentType: puts[0].opts.contentType, token: puts[0].opts.token }, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token: 'tok' });
  const B2 = ST.blobStore({ BLOB_READ_WRITE_TOKEN: 'tok' }, { blob, fetch: fetchFn, recent: new Map(), tails: new Map() });   // another instance: reads through fetch
  assert.deepEqual(await B2.get('lessons.json', null), { v: 1, rows: [1] });
  ok = false; await assert.rejects(() => B2.get('lessons.json', { rows: [] }), /academy store/); await assert.rejects(() => B2.update('lessons.json', { rows: [] }, () => ({ rows: [] })));
  assert.equal(puts.length, 1, 'no write after a failed read');
  assert.throws(() => ST.checkKey('../users/list.json')); assert.throws(() => ST.checkKey('lessons')); await assert.rejects(async () => B.get('a/../b.json'));
  // the per-key queue: twenty read-modify-writes at once on a slow backend lose nothing
  const M = ST.memoryStore(), slowRead = M.backend.read; M.backend.read = async (k) => { await new Promise((r) => setTimeout(r, 2)); return slowRead(k); };
  await Promise.all(Array.from({ length: 20 }, () => M.update('cost.json', { n: 0 }, (v) => ({ n: v.n + 1 }))));
  assert.equal((await M.get('cost.json')).n, 20);
  // two multi-file steps that share files in opposite order do not deadlock and do not interleave
  const both = (a, b) => M.tx({ x: [a, { n: 0 }], y: [b, { n: 0 }] }, ({ x, y }) => ({ write: { x: { n: x.n + 1 }, y: { n: y.n + 1 } } }));
  await Promise.all([both('seen/a.json', 'seen/b.json'), both('seen/b.json', 'seen/a.json'), both('seen/a.json', 'seen/b.json')]);
  assert.deepEqual([(await M.get('seen/a.json')).n, (await M.get('seen/b.json')).n], [3, 3]);
  // caps: the oldest rows move to an archive file, none are dropped
  const C = ST.memoryStore(); for (let i = 0; i < 25; i++) await C.append('audit/2026-11.json', [{ i }], 10);
  const main = C.peek('audit/2026-11.json'); assert.ok(main.rows.length <= 10); assert.ok(main.archives >= 1);
  assert.ok(C.keys().includes('audit/2026-11-archive-1.json'));
  assert.deepEqual((await C.rows('audit/2026-11.json', true)).map((r) => r.i), Array.from({ length: 25 }, (_, i) => i), 'every row is still there, in order');
  assert.deepEqual((await C.rows('audit/2026-11.json')).map((r) => r.i), main.rows.map((r) => r.i));
  // a folder of files: the same API, missing = fallback, a broken file throws
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-store-')), F = ST.fileStore(dir);
  try {
    assert.equal(await F.get('notebook.json', null), null); await F.update('sessions/se_abc12345.json', null, () => ({ id: 'se_abc12345' }));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'sessions', 'se_abc12345.json'), 'utf8')), { id: 'se_abc12345' });
    fs.writeFileSync(path.join(dir, 'notebook.json'), '{broken'); await assert.rejects(() => F.get('notebook.json', { rows: [] }), /academy store/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the API survives the caps: attempts past the cap are archived, n keeps counting and the outcome stays open', async () => {
  const { CAPS } = require('../api/academy.js')._t, saved = CAPS.attempts; CAPS.attempts = 4;
  try {
    const c = mk(); for (let i = 0; i < 7; i++) assert.equal((await post(c, attempt({ mode: i ? 'replay-same' : 'train' }))).body.n, i + 1);
    assert.ok(c.store.keys().includes('attempts/replica-archive-1.json'));
    assert.deepEqual((await get(c, { get: 'attempts', edge: 'replica', cand: 'replica:1' })).body.attempts.map((a) => a.n), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal((await get(c, { get: 'outcome', id: 'replica:1', edge: 'replica' })).code, 200);
    assert.equal((await get(c, { get: 'progress', edge: 'replica' })).body.counts.attempts, 7);
  } finally { CAPS.attempts = saved; }
});

test('research notebook and model registry: records are checked; promotion is an explicit owner action and can be rolled back', async () => {
  const c = mk();
  assert.equal((await post(c, { action: 'notebook.add', note: { title: 'T', hypothesis: 'h', dataset: 'd', method: 'm', validation: 'proven' } })).code, 400);
  assert.equal((await post(c, { action: 'notebook.add', note: { title: 'T', hypothesis: 'h', dataset: 'd', method: 'm', validation: 'validated' } })).code, 400, 'a validated result states its n');
  assert.equal((await post(c, { action: 'notebook.add', note: { title: 'T', dataset: 'd', method: 'm', validation: 'hypothesis' } })).code, 400);
  const n = await post(c, { action: 'notebook.add', note: { title: 'Sweep then displacement', hypothesis: 'Longs after an Asia-low sweep beat the base rate.', dataset: 'replica candidates 2020 to 2026, train pool', sampleSize: 212, method: 'net R by tag, in sample vs out of sample', results: 'IS +0.21R, OOS +0.08R', limitations: 'one market; HistData candles', validation: 'out-of-sample', reproducibility: 'academy/gen run id 7', edge: 'replica', tags: ['sweep', 'sweep'] } });
  assert.equal(n.code, 200); assert.equal(n.body.note.sampleSize, 212); assert.deepEqual(n.body.note.tags, ['sweep']);
  assert.equal((await get(c, { get: 'notebook' })).body.notes[0].id, n.body.note.id);
  assert.equal((await post(c, { action: 'model.register', model: { name: 'scorer', version: '1', status: 'champion' } })).code, 400, 'nothing registers as champion');
  const base = (await post(c, { action: 'model.register', model: { name: 'no-model policy', version: '1', status: 'baseline' } })).body.model;
  const m1 = (await post(c, { action: 'model.register', model: { name: 'scorer', version: '1', kind: 'gradient-boosting', edge: 'replica', metrics: { aucOos: 0.57, n: 400 }, datasetVersion: 'layer-b-1', trainedOn: { from: '2020-01', to: '2024-12', n: 400 } } })).body.model;
  const m2 = (await post(c, { action: 'model.register', model: { name: 'scorer', version: '2', metrics: { aucOos: 0.6 } } })).body.model;
  assert.equal(m1.status, 'challenger'); assert.equal(base.status, 'baseline'); assert.equal((await get(c, { get: 'models' })).body.championId, null, 'registering promotes nothing');
  assert.equal((await post(c, { action: 'model.register', model: { name: 'scorer', version: '2' } })).code, 409);
  assert.equal((await post(c, { action: 'model.register', model: { name: 'scorer', version: '3', metrics: { auc: 1e999 } } })).code, 400);
  assert.equal((await post(c, { action: 'model.promote', id: m1.id })).code, 400, 'confirm: true is required');
  assert.equal((await post(c, { action: 'model.promote', id: base.id, confirm: true })).code, 400);
  assert.equal((await post(c, { action: 'model.promote', id: m1.id, confirm: true, reason: 'OOS holds' })).body.championId, m1.id);
  const p2 = await post(c, { action: 'model.promote', id: m2.id, confirm: true }); assert.equal(p2.body.previousChampionId, m1.id);
  let reg = (await get(c, { get: 'models' })).body; assert.equal(reg.championId, m2.id); assert.deepEqual(reg.models.map((m) => m.status), ['baseline', 'challenger', 'champion']);
  assert.equal((await post(c, { action: 'model.promote', id: m2.id, confirm: true })).code, 409);
  assert.equal((await post(c, { action: 'model.rollback' })).code, 400);
  assert.equal((await post(c, { action: 'model.rollback', confirm: true })).body.championId, m1.id);
  reg = (await get(c, { get: 'models' })).body; assert.deepEqual(reg.models.map((m) => m.status), ['baseline', 'champion', 'challenger']); assert.equal(reg.history[0].action, 'rollback');
  assert.equal((await post(c, { action: 'model.rollback', confirm: true })).body.championId, null);
  assert.equal((await post(c, { action: 'model.rollback', confirm: true })).code, 409, 'nothing left to roll back');
});

// ---- the optional language-model adapter ---------------------------------------------------------------------------------
const LENV = { ACADEMY_LLM_KEY: 'k-test', ACADEMY_LLM_URL: 'https://llm.invalid/v1/complete', ACADEMY_LLM_MODEL: 'test-model', ACADEMY_LLM_USD_PER_MTOK_IN: '10', ACADEMY_LLM_USD_PER_MTOK_OUT: '50', ACADEMY_LLM_MAX_TOKENS: '200' };
function fakeLlm(reply = { choices: [{ message: { content: 'Because the daily was falling.' } }], usage: { prompt_tokens: 100, completion_tokens: 20 } }, o = {}) {
  const calls = []; const f = async (url, init) => { calls.push({ url, init }); if (o.delay) await new Promise((r) => setTimeout(r, o.delay)); if (o.throws) throw new Error('network'); return { ok: o.status ? o.status < 300 : true, status: o.status || 200, json: async () => reply }; };
  return { f, calls };
}
const NOW = Date.UTC(2026, 10, 10, 9);

test('explain without a key: says it is not available, calls nothing, writes nothing', async () => {
  const c = mk(); let fetched = 0;
  const r = await post(c, { action: 'explain', question: 'Why did it buy?', context: { action: 'BUY' } }, { fetch: async () => { fetched++; throw new Error('must not be called'); } });
  assert.equal(r.code, 200); assert.equal(r.body.available, false); assert.equal(r.body.reason, 'no language-model key configured'); assert.equal(r.body.text, undefined, 'never a made-up answer');
  assert.equal(fetched, 0); assert.deepEqual(c.store.keys(), []);
  assert.deepEqual(await LLM.complete({ prompt: 'x' }, { env: {}, store: c.store }), { available: false, reason: 'no language-model key configured' });
  // a key without an endpoint or a model name is still off: nothing about the provider is written in the code
  assert.equal((await LLM.complete({ prompt: 'x' }, { env: { ACADEMY_LLM_KEY: 'k' }, store: c.store })).available, false);
  assert.equal((await LLM.complete({ prompt: 'x' }, { env: { ...LENV, ACADEMY_LLM_URL: 'http://plain.invalid/x' }, store: c.store })).available, false);
  assert.ok(!/https?:\/\/[a-z0-9-]+\.[a-z]/i.test(src('api/_academy-llm.js')), 'no endpoint is hard-coded');
  const cost = (await get(c, { get: 'cost' })).body; assert.equal(cost.enabled, false); assert.deepEqual(cost.budgets, { dailyUsd: 0.5, monthlyUsd: 5, hardUsd: 25, stop: false }); assert.equal(cost.total.usd, 0);
  assert.equal((await post(c, { action: 'explain' })).code, 400, 'a question is required');
});

test('the adapter: usage is charged to the ledger, identical prompts are cached and shared in flight, the key goes only in the header', async () => {
  const store = ST.memoryStore(), L = fakeLlm(undefined, { delay: 5 }), d = { env: LENV, store, fetch: L.f, now: () => NOW };
  const [a, b] = await Promise.all([LLM.complete({ system: 's', prompt: 'Why WAIT?' }, d), LLM.complete({ system: 's', prompt: 'Why WAIT?' }, d)]);
  assert.equal(L.calls.length, 1, 'two identical requests in flight share one call');
  assert.equal(a.text, 'Because the daily was falling.'); assert.equal(b.text, a.text); assert.ok(a.deduped || b.deduped);
  assert.equal(a.costUsd, 0.002, '100 in x $10/M + 20 out x $50/M'); assert.deepEqual(a.usage, { tokensIn: 100, tokensOut: 20, estimated: false });
  const again = await LLM.complete({ system: 's', prompt: 'Why WAIT?' }, d); assert.equal(again.cached, true); assert.equal(again.costUsd, 0); assert.equal(L.calls.length, 1, 'the cache answers: still one call');
  await LLM.complete({ system: 's', prompt: 'A different question' }, d); assert.equal(L.calls.length, 2);
  const led = store.peek('cost.json'), day = led.days['2026-11-10'];
  assert.equal(day.requests, 2); assert.equal(day.usd, 0.004); assert.equal(day.tokensIn, 200); assert.equal(day.tokensOut, 40); assert.equal(day.cacheHits, 1); assert.equal(led.months['2026-11'].usd, 0.004); assert.equal(led.total.usd, 0.004);
  const init = L.calls[0].init, body = JSON.parse(init.body);
  assert.equal(L.calls[0].url, LENV.ACADEMY_LLM_URL); assert.equal(init.method, 'POST'); assert.equal(init.headers.Authorization, 'Bearer k-test'); assert.equal(body.model, 'test-model'); assert.equal(body.max_tokens, 200);
  assert.deepEqual(body.messages, [{ role: 'system', content: 's' }, { role: 'user', content: 'Why WAIT?' }]); assert.ok(!init.body.includes('k-test'));
  assert.ok(!JSON.stringify([...store.raw]).includes('k-test'), 'the key is never stored');
  // the other wire format, a custom key header, and no usage in the answer: the estimate (characters / 4) is charged
  const L2 = fakeLlm({ content: [{ type: 'text', text: 'x'.repeat(80) }] }), s2 = ST.memoryStore();
  const r2 = await LLM.complete({ system: 'sys!', prompt: 'p'.repeat(400) }, { env: { ...LENV, ACADEMY_LLM_FORMAT: 'messages', ACADEMY_LLM_AUTH_HEADER: 'x-key', ACADEMY_LLM_HEADERS: '{"x-extra":"1"}' }, store: s2, fetch: L2.f, now: () => NOW });
  const b2 = JSON.parse(L2.calls[0].init.body); assert.equal(b2.system, 'sys!'); assert.deepEqual(b2.messages, [{ role: 'user', content: 'p'.repeat(400) }]); assert.equal(L2.calls[0].init.headers['x-key'], 'k-test'); assert.equal(L2.calls[0].init.headers['x-extra'], '1'); assert.equal(L2.calls[0].init.headers.Authorization, undefined);
  assert.deepEqual(r2.usage, { tokensIn: 101, tokensOut: 20, estimated: true }); assert.equal(r2.costUsd, 0.00201); assert.equal(s2.peek('cost.json').total.usd, 0.00201);
  assert.equal(LLM.estimateTokens('abcdefgh'), 2); assert.equal(LLM.estimateTokens('abcde'), 2);
});

test('budgets: the adapter refuses when the day is spent, when the month is spent and on the hard stop; a failed call gives its reservation back', async () => {
  const spent = (day, month, total) => ST.memoryStore({ 'cost.json': { v: 1, days: { '2026-11-10': { usd: day, requests: 9 } }, months: { '2026-11': { usd: month, requests: 99 } }, total: { usd: total, requests: 999 } } });
  for (const [store, env, scope] of [[spent(0.5, 0.5, 0.5), LENV, 'day'], [spent(0.1, 5, 5), LENV, 'month'], [spent(0, 0, 25), LENV, 'hard-stop'], [spent(0, 0, 0), { ...LENV, ACADEMY_LLM_STOP: '1' }, 'hard-stop'],
    [spent(0.03, 0.03, 0.03), { ...LENV, ACADEMY_LLM_DAILY_USD: '0.03' }, 'day']]) {
    const L = fakeLlm(), r = await LLM.complete({ prompt: 'Why?' }, { env, store, fetch: L.f, now: () => NOW });
    assert.equal(r.skipped, 'budget', scope); assert.equal(r.scope, scope); assert.equal(r.text, undefined); assert.equal(L.calls.length, 0, 'no call when the budget is spent');
    assert.equal(store.peek('cost.json').days['2026-11-10'].skipped, 1);
  }
  // the estimate is reserved before the call: a prompt that would cross the line is refused although the ledger is still under it
  const near = spent(0.495, 0.495, 0.495), L = fakeLlm(); assert.equal((await LLM.complete({ prompt: 'Why?' }, { env: LENV, store: near, fetch: L.f, now: () => NOW })).skipped, 'budget'); assert.equal(L.calls.length, 0);
  // a new day starts a new daily budget (the month still counts)
  const L3 = fakeLlm(); assert.equal((await LLM.complete({ prompt: 'Why?' }, { env: LENV, store: spent(0.5, 0.5, 0.5), fetch: L3.f, now: () => NOW + 86400e3 })).text, 'Because the daily was falling.');
  // failures: nothing is charged, an error is counted, nothing is cached
  for (const o of [{ status: 500 }, { throws: true }]) {
    const s = ST.memoryStore(), F = fakeLlm(undefined, o), r = await LLM.complete({ prompt: 'Why?' }, { env: LENV, store: s, fetch: F.f, now: () => NOW });
    assert.equal(r.error, 'the language-model call failed'); assert.equal(r.text, undefined); const t = s.peek('cost.json').total; assert.equal(t.usd, 0); assert.equal(t.requests, 0); assert.equal(t.errors, 1); assert.equal(s.peek('llm-cache.json'), undefined);
  }
  assert.equal((await LLM.complete({ prompt: 'x'.repeat(30000) }, { env: LENV, store: ST.memoryStore(), fetch: fakeLlm().f })).skipped, 'too-long', 'a long prompt is refused, not cut');
  // the cache is capped
  const s = ST.memoryStore({ 'llm-cache.json': { v: 1, rows: Array.from({ length: 200 }, (_, i) => ({ h: `h${i}`, text: 't' })) } });
  await LLM.complete({ prompt: 'new' }, { env: { ...LENV, ACADEMY_LLM_DAILY_USD: '100', ACADEMY_LLM_MONTHLY_USD: '100' }, store: s, fetch: fakeLlm().f, now: () => NOW });
  const rows = s.peek('llm-cache.json').rows; assert.equal(rows.length, 200); assert.equal(rows[0].h, 'h1'); assert.equal(rows[199].text, 'Because the daily was falling.');
});

test('explain with a key (fake provider): the answer, its cost in the ledger and an audit row; out of budget is said, not faked', async () => {
  const L = fakeLlm(), c = mk({ env: LENV, fetch: L.f });
  const r = await post(c, { action: 'explain', question: 'Why did the apprentice wait here?', context: { decision: { action: 'WAIT', waitReasons: ['daily is down'] } } });
  assert.equal(r.code, 200); assert.equal(r.body.available, true); assert.equal(r.body.text, 'Because the daily was falling.'); assert.equal(r.body.cached, false); assert.equal(r.body.costUsd, 0.002);
  const sent = JSON.parse(L.calls[0].init.body); assert.match(sent.messages[1].content, /Why did the apprentice wait here\?[\s\S]*"waitReasons":\["daily is down"\]/); assert.match(sent.messages[0].content, /Never invent/);
  const r2 = await post(c, { action: 'explain', question: 'Why did the apprentice wait here?', context: { decision: { action: 'WAIT', waitReasons: ['daily is down'] } } }); assert.equal(r2.body.cached, true); assert.equal(L.calls.length, 1);
  const cost = (await get(c, { get: 'cost' })).body; assert.equal(cost.enabled, true); assert.equal(cost.today.usd, 0.002); assert.equal(cost.today.requests, 1); assert.equal(cost.remaining.dayUsd, 0.498);
  const au = await auditRows(c); assert.deepEqual(au.map((x) => x.action), ['explain', 'explain']); assert.match(au[1].summary, /cost \$0\.0020/); assert.match(au[0].summary, /cache/);
  const broke = mk({ env: { ...LENV, ACADEMY_LLM_DAILY_USD: '0' }, fetch: L.f }), r3 = await post(broke, { action: 'explain', question: 'Why?' });
  assert.equal(r3.code, 200); assert.equal(r3.body.skipped, 'budget'); assert.equal(r3.body.text, undefined); assert.equal(L.calls.length, 1);
});

test('isolation: the Academy API and risk engine hold no reference to the council, the demo mirror or any order-placing code', () => {
  const banned = /council\/|council-data|ctrader|mt5\/|tradovate|oanda|placeOrder|sendOrder|submitOrder|createOrder|newOrder|order_send|OrderSend|ProtoOA|\/api\/bridge|tv-webhook/i;
  for (const f of ['assets/academy-risk.js', 'api/academy.js', 'api/_academy-store.js', 'api/_academy-llm.js']) { const m = src(f).match(banned); assert.equal(m, null, `${f} mentions ${m && m[0]}`); }
  // what each file loads: the API its own modules and the session check; the risk engine only the replay lab's rule sets
  const reqs = (f) => [...src(f).matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(reqs('api/academy.js'), ['./_academy-llm.js', './_academy-store.js', './_session.js', 'node:crypto', 'node:fs', 'node:path', 'node:url']);
  assert.deepEqual(reqs('assets/academy-risk.js'), ['./backtest-engine.js']);
  assert.deepEqual(reqs('api/_academy-llm.js'), ['node:crypto']);
  assert.deepEqual(reqs('api/_academy-store.js'), ['@vercel/blob', 'node:fs', 'node:path']);
  for (const f of ['assets/academy-risk.js', 'api/academy.js', 'api/_academy-store.js', 'api/_academy-llm.js']) assert.ok(!/\bimport\s*\(\s*['"]|^\s*import\s/m.test(src(f)), `${f}: no static or literal dynamic import`);
  // vercel.json: the function ships the generated data and /academy is routed like the other pages
  const v = JSON.parse(src('vercel.json'));
  assert.deepEqual(v.functions['api/academy.js'], { maxDuration: 30, includeFiles: 'academy/data/**' });
  assert.ok(v.rewrites.some((r) => r.source === '/academy' && r.destination === '/academy.html'));
});

test('the generated files are read from academy/data (edges.json fallback, cand-<edge>.json, out-<edge>.json)', async () => {
  const { fileData } = require('../api/academy.js')._t, root = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-data-'));
  try {
    const D = fileData(root); assert.equal(await D.edges(), null); assert.equal(await D.candidates('replica'), null);
    fs.mkdirSync(path.join(root, 'academy', 'data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'academy', 'data', 'edges.json'), JSON.stringify({ edges: [{ id: 'replica', name: 'Gold replica' }] }));
    fs.writeFileSync(path.join(root, 'academy', 'data', 'cand-replica.json'), JSON.stringify({ candidates: CANDS }));
    fs.writeFileSync(path.join(root, 'academy', 'data', 'out-replica.json'), JSON.stringify(OUTS));
    const c = mk({ data: D });
    assert.deepEqual((await get(c, { get: 'edges' })).body.edges, [{ id: 'replica', name: 'Gold replica' }]);
    assert.equal((await get(c, { get: 'candidates', edge: 'replica', pool: 'exam' })).body.count, 3);
    assert.equal((await post(c, attempt({ edge: 'gtrend' }))).code, 400, 'the registry decides which edges exist');
    await post(c, attempt()); assert.equal((await get(c, { get: 'outcome', id: 'replica:1' })).body.outcome.netR, -1.05);
    // the registry module wins when it is there
    fs.writeFileSync(path.join(root, 'academy', 'edges.mjs'), 'export const EDGES = [{ id: "replica", name: "From the module" }, { id: "gtl", name: "H4 trendline" }];\n');
    assert.deepEqual((await get(mk({ data: fileData(root) }), { get: 'edges' })).body.edges.map((e) => e.id), ['replica', 'gtl']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
