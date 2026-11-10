// node --test tests/academy-prove.test.mjs — Replay and Prove.
// The claim: a mentor correction changes later decisions through the saved lesson and through nothing else.
// Offline. Every test drives the REAL modules (MXR / MXA / MXK, the page's pure helpers) and the REAL API handler on a file
// store in a temp folder (ACADEMY_STORE_DIR), on the recorded real candles of tests/fixtures/academy/ and the real
// candidates, outcomes and past cases of academy/data/. Nothing is mocked: a "world" below is one fresh load of every
// module and every candle file, so two worlds share no object in memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url), ROOT = path.join(path.dirname(HERE), '..');
const require = createRequire(import.meta.url);
const { EDGES } = await import('../academy/edges.mjs');
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MAN = json('tests/fixtures/academy/manifest.json'), EDGE = EDGES.find((e) => e.id === MAN.edge), CAL = json('academy/data/calendar.json');
const ALL = json(`academy/data/cand-${MAN.edge}.json`), BY = Object.fromEntries(ALL.map((c) => [c.id, c]));
const inWindow = (c) => c.t >= MAN.from && c.t < MAN.to && !(c.rule && (c.rule.clockShift || c.rule.pre2020));
const TRAIN = ALL.filter((c) => inWindow(c) && c.pool !== 'exam').sort((a, b) => a.t - b.t), EXAM = ALL.filter((c) => inWindow(c) && c.pool === 'exam').sort((a, b) => a.t - b.t);
// the setups the tests stand on (real candidates of the recorded window; what the engine says about each is asserted below)
const A = BY['gmp-1715094900s'];    // 7 May 2024 15:15, overlap session: the engine SELLs
const B = BY['gmp-1715883900b'];    // 16 May 2024 18:25, New York session: the engine BUYs
const W1 = BY['gmp-1715159400s'];   // 8 May 2024 09:10, London session: the engine WAITs with no gate (too little evidence)
const VOL = BY['gmp-1715694000b'];  // 14 May 2024 13:40: the engine WAITs behind the volatility gate

// ---- a world: every Academy module loaded afresh, every candle file read afresh ---------------------------------------------
const ACADEMY_FILE = /[\\/](assets[\\/]academy-[a-z]+\.js|api[\\/]_?academy[a-z-]*\.js)$/;
function world() {
  for (const k of Object.keys(require.cache)) if (ACADEMY_FILE.test(k)) delete require.cache[k];
  const MXAC = require('../assets/academy-ui.js'), MXR = require('../assets/academy-replay.js'), MXA = require('../assets/academy-core.js'), MXK = require('../assets/academy-risk.js'), MXAT = require('../assets/academy-tabs.js'), api = require('../api/academy.js');
  const SERIES = Object.fromEntries(MXAC.TFS.map((tf) => [tf, json(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`).bars.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }))]));
  // the page's snapOf: the edge's context timeframes, 300 closed bars each, the release calendar cut at t
  const snapOf = (c, series = SERIES) => { const o = { edge: EDGE.id, market: EDGE.market, t: c.t, cand: c, series: MXAC.snapshotSeries(EDGE, series), dataVersion: 'OANDA (recorded) XAU_USD' }, cut = MXAC.calendarCut(CAL, c.t); if (cut.events) o.events = cut.events; if (cut.schedule) o.schedule = cut.schedule; return MXR.snapshot(o); };
  return { MXAC, MXR, MXA, MXK, MXAT, handle: api.handle, _t: api._t, SERIES, snapOf };
}
// The API as the dev server mounts it: the real handler, an owner session, a file store in `dir`. No store object is passed in:
// every request builds its own from the directory, so nothing but the files carries over from one call to the next.
let CLOCK = Date.UTC(2026, 10, 10, 12) + (process.env.ACADEMY_PROVE_CHILD ? 86400e3 : 0);
function mkApi(Wd, dir) {
  const deps = { env: { ACADEMY_STORE_DIR: dir }, who: async () => ({ u: 'owner' }), sameOrigin: () => true, now: () => (CLOCK += 1000), data: Wd._t.fileData(ROOT) };
  const raw = async (method, payload) => { const out = {}, res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } }; await Wd.handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, deps); return out; };
  const ok = async (method, payload) => { const r = await raw(method, payload); assert.equal(r.code, 200, `${method} ${JSON.stringify(payload).slice(0, 90)} → ${r.code} ${JSON.stringify(r.body)}`); return r.body; };
  return { get: (q) => ok('GET', q), post: (b) => ok('POST', b), raw, dir };
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'academy-prove-'));
const attemptBody = (c, mode, d, lessons, hash, f) => ({ action: 'attempt', attempt: { candidateId: c.id, edge: EDGE.id, mode, decision: d, sessionId: null, lessonsAvailable: lessons.map((l) => l.id), snapshotHash: hash }, features: f });
const inForce = async (api) => (await api.get({ get: 'lessons', edge: EDGE.id, active: '1' })).lessons;
const lite = (d) => ({ action: d.action, entry: d.entry, stop: d.stop, target: d.target, confidence: d.confidence });
const answer = (d) => ({ action: d.action, entry: d.entry, stop: d.stop, target: d.target });
// A decision made from candles: a new snapshot, a new thesis, a new paper account, the past cases from the API. The only
// thing a caller can vary is the list of lessons.
async function decideFresh(Wd, api, cand, lessons, o = {}) {
  const snap = o.snap || Wd.snapOf(cand), f = Wd.MXA.features(snap), hash = Wd.MXR.hash(snap), c = snap.cand;
  const acct = Wd.MXK.roll(Wd.MXK.account(100000, { t: MAN.from }), snap.t), risk = o.risk || Wd.MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.stop, target: c.target, t: snap.t }, acct, { riskPct: 0.25 });
  const history = o.history || (await api.get({ get: 'history', edge: EDGE.id, cand: cand.id })).rows;
  const decision = Wd.MXA.decide(snap, { lessons, thesis: Wd.MXA.thesis.start(snap), history, risk, edgeDef: { version: EDGE.version, cost: EDGE.costPerRoundTrip } });
  return { snap, f, hash, decision, risk };
}
// the first sitting on a setup, the mentor's verdict, and the lesson saved from it (the conditions the mentor keeps: `keep`)
async function teach(Wd, api, cand, o) {
  const first = await decideFresh(Wd, api, cand, o.lessons || []), a1 = await api.post(attemptBody(cand, 'train', first.decision, o.lessons || [], first.hash, first.f));
  const form = { choice: o.choice, reasons: o.reasons, text: o.text || 'Mentor says so.', ...(Wd.MXAC.isTake(o.choice) ? Wd.MXAC.mentorLevelsOf(cand, o.choice) : {}) };
  const c = Wd.MXAC.buildCorrection(form, a1.attempt.id); assert.deepEqual(Wd.MXAC.correctionProblems(c, first.decision), []);
  const k = (await api.post({ action: 'correct', edge: EDGE.id, correction: { ...c, errorClass: Wd.MXA.classifyError(first.decision, c, null) } })).correction;
  if (o.choice === 'approve') return { cand, first, a1, k, lesson: null };
  const draft = Wd.MXA.lessons.fromCorrection(first.decision, k, first.f); draft.when = draft.when.filter((w) => o.keep.includes(w.f)); assert.deepEqual(Wd.MXA.lessons.validate(draft), [], 'the lesson the mentor saves is a valid one');
  const lesson = (await api.post({ action: 'lesson.save', lesson: { edge: draft.edge, title: draft.title, text: draft.text, when: draft.when, then: draft.then, source: draft.source, active: true } })).lesson;
  return { cand, first, a1, k, lesson };
}
// a same-trade replay as the page runs it: the lessons in force read from the API, a fresh decision from candles, stored
async function replay(Wd, api, cand) {
  const lessons = await inForce(api), r = await decideFresh(Wd, api, cand, lessons), a = await api.post(attemptBody(cand, 'replay-same', r.decision, lessons, r.hash, r.f));
  return { ...r, lessons, row: a.attempt, n: a.n };
}
const saveLesson = async (api, l) => (await api.post({ action: 'lesson.save', lesson: { title: 'test lesson', text: '', source: {}, active: true, ...l, then: { adjust: {}, note: '', ...l.then } } })).lesson;
const OVERLAP_WAIT = { choice: 'WAIT', reasons: ['session'], keep: ['session'], text: 'Not in this session.' };

// ---- the child: a separate process that knows only the store directory and a setup id ----------------------------------------
// (test 3 starts this file again with ACADEMY_PROVE_CHILD set; the process prints one decision and exits before any test)
if (process.env.ACADEMY_PROVE_CHILD) {
  const Wd = world(), api = mkApi(Wd, process.env.ACADEMY_STORE_DIR), cand = BY[process.env.ACADEMY_PROVE_CHILD], lessons = await inForce(api), r = await decideFresh(Wd, api, cand, lessons);
  process.stdout.write(JSON.stringify({ pid: process.pid, hash: r.hash, id: r.decision.id, answer: answer(r.decision), lessons: lessons.map((l) => l.id), applied: r.decision.lessonsApplied }));
  process.exit(0);
}

const W = world();

test('the recorded window holds the setups these proofs stand on, and the engine answers them as stated', async () => {
  const api = mkApi(W, tmp());
  for (const [c, want, pool] of [[A, 'SELL', 'train'], [B, 'BUY', 'train'], [W1, 'WAIT', 'train'], [VOL, 'WAIT', 'train']]) { assert.ok(c && inWindow(c) && (c.pool === 'exam' ? 'exam' : 'train') === pool, c && c.id); assert.equal((await decideFresh(W, api, c, [])).decision.action, want, c.id); }
  assert.deepEqual((await decideFresh(W, api, W1, [])).decision.gates, [], 'W1 waits on thin evidence, not behind a gate'); assert.deepEqual((await decideFresh(W, api, VOL, [])).decision.gates.map((g) => g.code), ['volatility']);
  assert.ok(EXAM.length >= 3 && TRAIN.length >= 8, `${TRAIN.length} train, ${EXAM.length} exam`);
});

// ---- 1 ---------------------------------------------------------------------------------------------------------------------
test('1. same-trade replay: after the correction and its lesson the same decision point gives the corrected answer; the snapshot hash is identical; attempt numbers go up; the first attempt is never rewritten', async () => {
  const api = mkApi(W, tmp()), s = await teach(W, api, A, OVERLAP_WAIT), file = path.join(api.dir, 'attempts', `${EDGE.id}.json`);
  assert.equal(s.first.decision.action, 'SELL'); assert.equal(s.k.action, 'WAIT'); assert.equal(s.lesson.then.action, 'WAIT'); assert.deepEqual(s.lesson.when, [{ f: 'session', op: 'eq', v: 'overlap' }]);
  const firstOnDisk = JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')).rows[0]);
  const r2 = await replay(W, api, A), r3 = await replay(W, api, A);
  assert.equal(r2.decision.action, 'WAIT', 'the corrected answer'); assert.equal(W.MXA.compare(s.first.decision, r2.decision, s.k).verdict, 'learned');
  assert.equal(r2.hash, s.first.hash, 'the same decision point'); assert.equal(r3.hash, s.first.hash); assert.notEqual(r2.snap, s.first.snap, 'a snapshot built again, not the object of the first sitting');
  assert.deepEqual([s.a1.n, r2.n, r3.n], [1, 2, 3], 'attempt numbers increase');
  const rows = (await api.get({ get: 'attempts', edge: EDGE.id, cand: A.id })).attempts;
  assert.deepEqual(rows.map((a) => [a.n, a.mode, a.decision.action, a.snapshotHash === s.first.hash]), [[1, 'train', 'SELL', true], [2, 'replay-same', 'WAIT', true], [3, 'replay-same', 'WAIT', true]]);
  assert.ok(rows[0].at < rows[1].at && rows[1].at < rows[2].at); assert.equal(new Set(rows.map((a) => a.id)).size, 3);
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')).rows[0]), firstOnDisk, 'the stored first attempt is byte for byte what it was');
  assert.deepEqual(rows[0], s.a1.attempt, 'and reads back as it was returned when stored');
  // a correction, a lesson, the lesson counters: none of them touches a stored attempt either
  await api.post({ action: 'lesson.stats', id: s.lesson.id, inc: { applied: 1, replayPass: 1 } }); await api.post({ action: 'lesson.deactivate', id: s.lesson.id, active: false, reason: 'test' });
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')).rows[0]), firstOnDisk);
});

// ---- 2 ---------------------------------------------------------------------------------------------------------------------
test('2. fresh decision generation: the second answer is computed from candles, not read back: lesson off gives the FIRST answer, lesson on the corrected one, another lesson something else', async () => {
  const api = mkApi(W, tmp()), s = await teach(W, api, A, OVERLAP_WAIT), on = await replay(W, api, A);
  assert.equal(on.decision.action, 'WAIT');
  await api.post({ action: 'lesson.deactivate', id: s.lesson.id, active: false, reason: 'control' });
  const off = await replay(W, api, A);
  assert.deepEqual(off.lessons, []); assert.deepEqual(answer(off.decision), answer(s.first.decision), 'with the lesson off: the first answer, level for level'); assert.equal(off.decision.id, s.first.decision.id, 'and the same decision id (a hash of the whole answer)');
  await api.post({ action: 'lesson.deactivate', id: s.lesson.id, active: true });
  assert.equal((await replay(W, api, A)).decision.action, 'WAIT', 'on again: the corrected answer');
  // a different lesson: the same candles now give a third answer, which no stored attempt ever held
  await api.post({ action: 'lesson.deactivate', id: s.lesson.id, active: false, reason: 'control' });
  const other = await saveLesson(api, { edge: EDGE.id, title: 'Take two R in the overlap', when: [{ f: 'session', op: 'eq', v: 'overlap' }], then: { action: null, adjust: { target: { ref: 'entry', k: 2, unit: 'r' } } } });
  const third = await replay(W, api, A), risk = Math.abs(A.entry - A.stop);
  assert.equal(third.decision.action, 'SELL'); assert.ok(Math.abs(third.decision.target - (A.entry - 2 * risk)) < 0.011, `target ${third.decision.target}`); assert.notEqual(third.decision.target, s.first.decision.target);
  assert.deepEqual(third.decision.lessonsApplied.map((l) => [l.id, l.applied]), [[other.id, true]]);
  const stored = (await api.get({ get: 'attempts', edge: EDGE.id, cand: A.id })).attempts; assert.ok(!stored.slice(0, -1).some((a) => a.decision.target === third.decision.target), 'no earlier stored attempt held that answer: it was not read back');
  // poison every stored attempt: a fresh decision does not move, because no stored attempt feeds it
  const file = path.join(api.dir, 'attempts', `${EDGE.id}.json`), good = fs.readFileSync(file, 'utf8'), bad = JSON.parse(good);
  for (const a of bad.rows) { a.decision.action = 'BUY'; a.decision.entry = 1; a.decision.stop = 0.5; a.decision.target = 9; } fs.writeFileSync(file, JSON.stringify(bad));
  const still = await decideFresh(W, api, A, await inForce(api)); assert.deepEqual(answer(still.decision), answer(third.decision), 'stored attempts say BUY at 1; the fresh decision still comes from the candles');
  fs.writeFileSync(file, good);
  // the page: the replay builds its snapshot and decides before it reads or writes anything
  const ui = src('assets/academy-ui.js'), a0 = ui.indexOf('async function replaySame('), body = ui.slice(a0, ui.indexOf('\n  }\n', a0));
  assert.ok(body.indexOf('snapOf(') >= 0 && body.indexOf('decideOn(snap') > body.indexOf('snapOf(') && body.indexOf('api.post(') > body.indexOf('decideOn(snap'), 'snapshot, then decision, then the store'); assert.ok(!/api\.get\(/.test(body), 'replaySame reads no stored attempt');
  assert.match(body, /if \(hash !== want\) throw new Error/, 'and refuses a replay on another decision point'); assert.match(body, /thesis: MXA\.thesis\.start\(snap\)/, 'a fresh thesis');
  // the control the page shows: the same replay with every lesson off. Same as the first answer → the lesson is the only cause.
  const cmp = W.MXA.compare(s.first.decision, on.decision, s.k), withControl = W.MXAC.proveWithControl(cmp, s.first.decision, off.decision, s.k);
  assert.equal(withControl.verdict, 'learned'); assert.deepEqual([withControl.control.action, withControl.control.sameAsFirst, withControl.control.matchesCorrection], ['SELL', true, false]); assert.match(withControl.control.text, /^Control: the same replay with every lesson switched off gives SELL, the first answer\. Whatever changed came from the lessons in force and from nothing else\.$/);
  // if the answer changes with no lesson at all (the first sitting ran on another thesis), the lesson gets no credit for it
  const noCredit = W.MXAC.proveWithControl(cmp, s.first.decision, { ...off.decision, action: 'WAIT' }, s.k);
  assert.equal(noCredit.verdict, 'partly'); assert.equal(noCredit.control.sameAsFirst, false); assert.match(noCredit.note, /every lesson switched off gives that answer too/); assert.match(noCredit.control.text, /not the first answer/);
  assert.match(body, /proveWithControl\(MXA\.compare\(cur\.first\.decision, d, cur\.correction\), cur\.first\.decision, control, cur\.correction\)/); assert.match(body, /const control = decideOn\(snap, \{ setup: st, account: cur\.acctAt, lessons: \[\]/);
});

// ---- 3 ---------------------------------------------------------------------------------------------------------------------
test('3. temporary-context reset: nothing but stored state carries over: a new world on the same store gives the corrected answer, a separate process too, an EMPTY store gives the original answer', async () => {
  const dir = tmp(), api = mkApi(W, dir), s = await teach(W, api, A, OVERLAP_WAIT);
  // (a) a second world: every module required again, every candle file read again, a new handler context on the same directory
  const W2 = world(), api2 = mkApi(W2, dir);
  for (const k of ['MXA', 'MXR', 'MXK', 'MXAC', 'handle', 'SERIES']) assert.notEqual(W2[k], W[k], `${k} is a different object in the second world`);
  assert.notEqual(W2.SERIES['5m'][0], W.SERIES['5m'][0], 'not even one candle object is shared');
  const lessons2 = await inForce(api2), r2 = await decideFresh(W2, api2, A, lessons2);
  assert.equal(lessons2.length, 1); assert.notEqual(lessons2[0], s.lesson, 'the lesson was read back through GET lessons, not handed over'); assert.deepEqual(lessons2[0], s.lesson, 'and it is the stored one');
  assert.equal(r2.hash, s.first.hash, 'the newly loaded snapshot is the same decision point'); assert.equal(r2.decision.action, 'WAIT'); assert.deepEqual(r2.decision.lessonsApplied.map((l) => [l.id, l.applied]), [[s.lesson.id, true]]);
  assert.equal(W2.MXA.compare(s.first.decision, r2.decision, s.k).verdict, 'learned');
  // (b) another process: it is told the store directory and the setup id, nothing else
  const env = { ...process.env, ACADEMY_PROVE_CHILD: A.id, ACADEMY_STORE_DIR: dir }; delete env.NODE_TEST_CONTEXT;
  const run = (e) => { const p = spawnSync(process.execPath, [HERE], { env: e, encoding: 'utf8', timeout: 60000 }); assert.equal(p.status, 0, p.stderr); return JSON.parse(p.stdout); };
  const child = run(env);
  assert.notEqual(child.pid, process.pid); assert.equal(child.hash, s.first.hash); assert.deepEqual(child.lessons, [s.lesson.id]); assert.equal(child.answer.action, 'WAIT', 'the corrected answer, from the files alone');
  assert.deepEqual(child.applied.map((l) => [l.id, l.applied]), [[s.lesson.id, true]]); assert.equal(child.id, r2.decision.id, 'two contexts that share nothing give the identical decision');
  // (c) an empty store: the same process, the same candles, no lesson on file → the original answer
  const empty = run({ ...env, ACADEMY_STORE_DIR: tmp() });
  assert.deepEqual(empty.lessons, []); assert.equal(empty.hash, s.first.hash); assert.deepEqual(empty.answer, answer(s.first.decision), 'the original answer'); assert.equal(empty.id, s.first.decision.id);
  const W3 = world(), r3 = await decideFresh(W3, mkApi(W3, tmp()), A, await inForce(mkApi(W3, tmp()))); assert.deepEqual(answer(r3.decision), answer(s.first.decision), 'and in this process, on an empty store');
  // no thesis is reused: the decision does not depend on which thesis object is passed when both start at this snapshot
  assert.notEqual(W2.MXA.thesis.start(r2.snap), W2.MXA.thesis.start(r2.snap)); assert.deepEqual(W2.MXA.thesis.start(r2.snap), W.MXA.thesis.start(s.first.snap));
});

// ---- 4 ---------------------------------------------------------------------------------------------------------------------
test('4. relevant lesson retrieval: only lessons whose conditions match the features are retrieved; another edge, a non-matching session and an inactive version are not; the global lesson is', async () => {
  const api = mkApi(W, tmp()), first = await decideFresh(W, api, A, []), f = first.f;
  assert.equal(f.session, 'overlap'); assert.equal(f.biasAlign, 'with'); assert.equal(f.regime, 'ranging');
  const when = [{ f: 'session', op: 'eq', v: 'overlap' }], wait = { action: 'WAIT' };
  const mine = await saveLesson(api, { edge: EDGE.id, title: 'mine', when, then: wait });
  const otherEdge = await saveLesson(api, { edge: 'nq-open', title: 'another edge, same conditions', when, then: wait });
  const otherSession = await saveLesson(api, { edge: EDGE.id, title: 'asia only', when: [{ f: 'session', op: 'eq', v: 'asia' }], then: wait });
  const half = await saveLesson(api, { edge: EDGE.id, title: 'one condition holds, one does not', when: [...when, { f: 'regime', op: 'eq', v: 'trending' }], then: wait });
  const draft = await saveLesson(api, { edge: EDGE.id, title: 'saved switched off', when, then: wait, active: false });
  const off = await saveLesson(api, { edge: EDGE.id, title: 'switched off later', when, then: wait }); await api.post({ action: 'lesson.deactivate', id: off.id, active: false, reason: 'test' });
  const v1 = await saveLesson(api, { edge: EDGE.id, title: 'old version', when, then: wait }), v2 = (await api.post({ action: 'lesson.revise', id: v1.id, patch: { title: 'new version', when: [...when, { f: 'biasAlign', op: 'eq', v: 'with' }] } })).lesson;
  const global = await saveLesson(api, { edge: '*', title: 'every edge', when: [{ f: 'biasAlign', op: 'eq', v: 'with' }], then: wait });
  const missing = await saveLesson(api, { edge: EDGE.id, title: 'a feature this snapshot does not have', when: [{ f: 'dxyConflict', op: 'eq', v: true }], then: wait }); assert.equal(f.dxyConflict, null);
  const every = (await api.get({ get: 'lessons' })).lessons; assert.equal(every.length, 10, 'both versions of the revised lesson are kept');
  // the core, given EVERY stored lesson of every edge: only the three that are in force, of this edge or global, and match
  const got = W.MXA.lessons.retrieve(every, f, EDGE.id); assert.deepEqual(got.conflicts, []);
  assert.deepEqual(got.matched.map((l) => l.id).sort(), [mine.id, v2.id, global.id].sort());
  for (const [l, why] of [[otherEdge, 'another edge'], [otherSession, 'a session that is not this one'], [half, 'one condition fails'], [draft, 'saved inactive'], [off, 'switched off'], [v1, 'a replaced version'], [missing, 'a condition on a feature the snapshot does not have']]) assert.ok(!got.matched.some((x) => x.id === l.id), why);
  assert.equal(got.matched[0].id, v2.id, 'the most specific lesson (two conditions) ranks first');
  // the API narrows the same way for the page (edge + global, active only), and the decision names exactly those
  const forPage = await inForce(api); assert.ok(!forPage.some((l) => l.edge === 'nq-open' || !l.active)); assert.ok(forPage.some((l) => l.id === global.id));
  const d = (await decideFresh(W, api, A, forPage)).decision;
  assert.deepEqual(d.lessonsApplied.map((l) => l.id).sort(), [mine.id, v2.id, global.id].sort()); assert.equal(d.action, 'WAIT');
  // on a setup of another session none of the session lessons is retrieved; the global one still is
  const onB = await decideFresh(W, api, B, forPage); assert.equal(onB.f.session, 'newyork'); assert.deepEqual(onB.decision.lessonsApplied.map((l) => l.id), [global.id]);
  // and the same lessons asked for another edge: only the other edge's own and the global one
  assert.deepEqual(W.MXA.lessons.retrieve(every, f, 'nq-open').matched.map((l) => l.id).sort(), [otherEdge.id, global.id].sort());
});

// ---- 5 ---------------------------------------------------------------------------------------------------------------------
test('5. correct application: the applied lesson is named in the decision with its effect; a lesson that matched but could not change the answer is recorded as not applied, and why', async () => {
  const api = mkApi(W, tmp()), s = await teach(W, api, A, OVERLAP_WAIT), r = await replay(W, api, A), la = r.decision.lessonsApplied;
  assert.deepEqual(la.map((l) => ({ id: l.id, version: l.version, applied: l.applied, effect: l.effect, title: l.title, correctionId: l.correctionId })), [{ id: s.lesson.id, version: 1, applied: true, effect: 'WAIT: changed SELL to WAIT', title: s.lesson.title, correctionId: s.k.id }]);
  assert.match(r.decision.waitReasons[0], new RegExp('^lesson "' + s.lesson.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"'), 'the first reason to wait names the lesson'); assert.match(r.decision.thesis, /^WAIT on the sell candidate/);
  assert.deepEqual(r.row.decision.lessonsApplied.map((l) => [l.id, l.applied, l.effect]), [[s.lesson.id, true, 'WAIT: changed SELL to WAIT']], 'and the stored attempt keeps the name, the effect and that it was applied');
  // a TAKE lesson that matches a setup held behind the volatility gate, without naming volatility: matched, NOT applied, and it says why
  await api.post({ action: 'lesson.deactivate', id: s.lesson.id, active: false, reason: 'next part' });
  const take = await saveLesson(api, { edge: EDGE.id, title: 'Take it in the overlap', when: [{ f: 'session', op: 'eq', v: 'overlap' }], then: { action: 'TAKE' } });
  await api.post(attemptBody(VOL, 'train', (await decideFresh(W, api, VOL, [])).decision, [], W.MXR.hash(W.snapOf(VOL)), null));
  const v = await replay(W, api, VOL);
  assert.equal(v.decision.action, 'WAIT'); assert.deepEqual(v.decision.lessonsApplied.map((l) => [l.id, l.applied, l.effect]), [[take.id, false, 'TAKE not applied: blocked by volatility (the lesson does not name that condition)']]);
  assert.equal(v.row.decision.lessonsApplied[0].applied, false, 'stored as not applied'); assert.equal(W.MXA.compare(v.decision, v.decision, { verdict: 'change', action: 'BUY' }).lessonApplied, false, 'and never counted as applied');
  // the mentor may pass that gate, but only by naming it
  const named = await saveLesson(api, { edge: EDGE.id, title: 'Take it even in high volatility', when: [{ f: 'volState', op: 'eq', v: 'high' }, { f: 'session', op: 'eq', v: 'overlap' }], then: { action: 'TAKE' } });
  const v2 = (await decideFresh(W, api, VOL, await inForce(api))).decision;
  assert.equal(v2.action, 'BUY'); assert.ok(v2.lessonsApplied.find((l) => l.id === named.id).applied); assert.ok(v2.gates.every((g) => g.code === 'volatility' && g.hard === false && g.overriddenBy === named.id));
});

test('5b. a lesson can never override the gates that are not the mentor\'s to pass: a data gap, no stop, reward to risk below 1 after costs, a risk block', async () => {
  const api = mkApi(W, tmp());
  // "take it" lessons that match everything about setup A, and name every overridable gate too
  await saveLesson(api, { edge: EDGE.id, title: 'take sells', when: [{ f: 'side', op: 'eq', v: 'sell' }], then: { action: 'TAKE' } });
  await saveLesson(api, { edge: '*', title: 'take in the overlap whatever the volatility', when: [{ f: 'session', op: 'eq', v: 'overlap' }, { f: 'volState', op: 'in', v: ['low', 'normal', 'high'] }], then: { action: 'TAKE' } });
  const lessons = await inForce(api), base = await decideFresh(W, api, A, lessons), history = (await api.get({ get: 'history', edge: EDGE.id, cand: A.id })).rows;
  assert.equal(base.decision.action, 'SELL', 'with nothing in the way the lessons do take the trade'); assert.equal(base.decision.lessonsApplied.length, 2);
  const gateCodes = (d) => d.gates.filter((g) => g.hard).map((g) => g.code);
  // a data gap: the 5m series the edge is judged on is missing
  const noM5 = { ...W.SERIES }; delete noM5['5m'];
  const gap = (await decideFresh(W, api, A, lessons, { snap: W.snapOf(A, noM5), history })).decision;
  assert.equal(gap.action, 'WAIT'); assert.ok(gateCodes(gap).includes('data'), gateCodes(gap).join()); assert.match(gap.waitReasons.join(' '), /missing data: 5m/); assert.ok(gap.lessonsApplied.length >= 1 && gap.lessonsApplied.every((l) => l.applied === false && /not applied: blocked/.test(l.effect)), JSON.stringify(gap.lessonsApplied)); assert.match(gap.lessonsApplied[0].effect, /^TAKE not applied: blocked by data/);
  // no stop: never a trade without a stop
  const noStop = (await decideFresh(W, api, A, lessons, { snap: W.snapOf({ ...A, stop: null }), history, risk: { allowed: true, blocks: [] } })).decision;
  assert.equal(noStop.action, 'WAIT'); assert.deepEqual(gateCodes(noStop), ['geometry']); assert.ok(noStop.lessonsApplied.every((l) => l.applied === false)); assert.match(noStop.waitReasons.join(' '), /never a trade without a stop/);
  // a stop on the wrong side is no stop either
  const wrong = (await decideFresh(W, api, A, lessons, { snap: W.snapOf({ ...A, stop: A.entry - 5 }), history, risk: { allowed: true, blocks: [] } })).decision;
  assert.equal(wrong.action, 'WAIT'); assert.ok(gateCodes(wrong).includes('geometry'));
  // reward to risk below 1 after costs
  const thin = (await decideFresh(W, api, A, lessons, { snap: W.snapOf({ ...A, target: A.entry - Math.abs(A.entry - A.stop) * 0.5 }), history })).decision;
  assert.equal(thin.action, 'WAIT'); assert.deepEqual(gateCodes(thin), ['rr']); assert.ok(thin.risk.rrNet < 1); assert.match(thin.waitReasons[0], /reward to risk after costs is 0\.\d+, below 1/);
  // the risk engine says no
  const blocked = (await decideFresh(W, api, A, lessons, { history, risk: { allowed: false, blocks: ['daily loss limit reached'], riskPct: 0.25 } })).decision;
  assert.equal(blocked.action, 'WAIT'); assert.deepEqual(gateCodes(blocked), ['risk']); assert.match(blocked.waitReasons[0], /^risk engine: daily loss limit reached/);
  // and a FLIP lesson is held by the same gates
  await saveLesson(api, { edge: EDGE.id, title: 'flip sells', when: [{ f: 'side', op: 'eq', v: 'sell' }, { f: 'regime', op: 'eq', v: 'ranging' }, { f: 'biasAlign', op: 'eq', v: 'with' }], then: { action: 'FLIP' } });
  for (const off of (await inForce(api)).filter((l) => l.then.action === 'TAKE')) await api.post({ action: 'lesson.deactivate', id: off.id, active: false, reason: 'flip part' });
  const flip = await inForce(api); assert.equal((await decideFresh(W, api, A, flip, { history })).decision.action, 'BUY', 'with nothing in the way the lesson flips the trade');
  assert.equal((await decideFresh(W, api, A, flip, { history, risk: { allowed: false, blocks: ['max positions'], riskPct: 0.25 } })).decision.action, 'WAIT'); assert.equal((await decideFresh(W, api, A, flip, { snap: W.snapOf(A, noM5), history })).decision.action, 'WAIT');
});

// When the final reward-to-risk gate or the risk engine forces WAIT after the lessons were recorded, a TAKE / FLIP lesson did
// not decide anything: decide() records it as `applied: false` ("… not applied: blocked by rr / risk"), so MXA.compare() and
// the lesson's "applied" counter do not count it, and the thesis does not say "on the mentor's lesson".
test('5c. a TAKE lesson overruled by the reward-to-risk gate or by the risk engine is recorded as NOT applied', async () => {
  const api = mkApi(W, tmp()); await saveLesson(api, { edge: EDGE.id, title: 'take sells', when: [{ f: 'side', op: 'eq', v: 'sell' }], then: { action: 'TAKE' } });
  const lessons = await inForce(api), history = [];
  const thin = (await decideFresh(W, api, A, lessons, { snap: W.snapOf({ ...A, target: A.entry - Math.abs(A.entry - A.stop) * 0.5 }), history })).decision;
  const blocked = (await decideFresh(W, api, A, lessons, { history, risk: { allowed: false, blocks: ['daily loss limit reached'], riskPct: 0.25 } })).decision;
  for (const d of [thin, blocked]) { assert.equal(d.action, 'WAIT'); assert.deepEqual(d.lessonsApplied.map((l) => l.applied), [false], `recorded as "${d.lessonsApplied[0].effect}"`); assert.match(d.lessonsApplied[0].effect, /not applied/); }
});

// ---- 6 ---------------------------------------------------------------------------------------------------------------------
test('6. unseen situations: the lesson is tried on exam-pool setups it was not made from; both answers are stored; an exam setup refuses training, a same-trade replay, a second decision and a correction; the lesson\'s own setup can never be in its unseen evidence', async () => {
  const api = mkApi(W, tmp()), s = await teach(W, api, A, OVERLAP_WAIT), lessons = await inForce(api);
  const pool = (await api.get({ get: 'candidates', edge: EDGE.id, pool: 'exam', limit: 5000, from: String(MAN.from), to: String(MAN.to) })).candidates;
  assert.deepEqual(pool.map((c) => c.id), EXAM.map((c) => c.id)); assert.ok(pool.every((c) => c.pool === 'exam' && c.id !== s.lesson.source.candidateId), 'the unseen list never holds the lesson\'s own setup');
  assert.ok(pool.every((c) => !('netR' in c) && !('R' in c) && !('exitT' in c)), 'and no outcome field');
  let changed = 0;
  for (const x of pool) {
    const c = BY[x.id]; assert.equal((await api.raw('GET', { get: 'outcome', id: c.id, edge: EDGE.id })).code, 403, 'no result before the decision is stored');
    const without = await decideFresh(W, api, c, []), withL = await decideFresh(W, api, c, lessons);
    const att = await api.post(attemptBody(c, 'exam', withL.decision, lessons, withL.hash, withL.f));
    const res = (await api.post({ action: 'exam.result', result: { edge: EDGE.id, candidateId: c.id, lessonIds: withL.decision.lessonsApplied.map((l) => l.id), withLessons: lite(withL.decision), withoutLessons: lite(without.decision), attemptId: att.attempt.id } })).result;
    assert.deepEqual([res.withLessons.action, res.withoutLessons.action], [withL.decision.action, without.decision.action], 'both answers are stored'); if (!W.MXAC.sameAnswer(res.withLessons, res.withoutLessons)) changed++;
    // decided once: no training, no same-trade replay, no second test, no second result, no correction, no lesson from it
    for (const mode of ['train', 'replay-same']) { const r = await api.raw('POST', attemptBody(c, mode, withL.decision, lessons, withL.hash, withL.f)); assert.equal(r.code, 400, mode); assert.match(r.body.error, /an exam candidate is only for tests/); }
    assert.equal((await api.raw('POST', attemptBody(c, 'exam', withL.decision, lessons, withL.hash, withL.f))).code, 409, 'a second decision');
    assert.equal((await api.raw('POST', { action: 'exam.result', result: { edge: EDGE.id, candidateId: c.id, lessonIds: [], withLessons: lite(withL.decision), withoutLessons: lite(without.decision) } })).code, 409, 'a second result');
    assert.equal((await api.raw('POST', { action: 'seen', edge: EDGE.id, id: c.id, mode: 'train' })).code, 400);
    const cor = await api.raw('POST', { action: 'correct', edge: EDGE.id, correction: { attemptId: att.attempt.id, verdict: 'change', action: 'WAIT', reasons: ['session'], text: 'x' } }); assert.equal(cor.code, 409, 'an exam decision is never corrected'); assert.match(cor.body.error, /decided once and is never corrected/);
    const ls = await api.raw('POST', { action: 'lesson.save', lesson: { edge: EDGE.id, title: 'from an exam setup', when: [{ f: 'session', op: 'eq', v: 'overlap' }], then: { action: 'WAIT' }, source: { candidateId: c.id } } }); assert.equal(ls.code, 400, 'no lesson may name an exam setup as its source'); assert.match(ls.body.error, /exam-pool setup is only for tests/);
    assert.equal((await api.raw('POST', { action: 'lesson.save', lesson: { edge: '*', title: 'global, from an exam setup', when: [{ f: 'session', op: 'eq', v: 'overlap' }], then: { action: 'WAIT' }, source: { candidateId: c.id } } })).code, 400);
  }
  assert.ok(changed >= 1, 'in this window the lesson changes at least one unseen answer');
  // the stored evidence: one row a setup, both answers, graded apart; the lesson's own setup is in none of them and cannot be added
  const ex = (await api.get({ get: 'exams', edge: EDGE.id })).exams;
  assert.equal(ex.length, pool.length); assert.ok(ex.every((r) => r.withLessons && r.withoutLessons && Number.isFinite(r.rWith) && Number.isFinite(r.rWithout))); assert.ok(!ex.some((r) => r.candidateId === s.lesson.source.candidateId));
  assert.ok(ex.filter((r) => r.lessonIds.includes(s.lesson.id)).length >= 1, 'the lesson matched unseen setups');
  for (const body of [attemptBody(A, 'exam', s.first.decision, lessons, s.first.hash, s.first.f), { action: 'exam.result', result: { edge: EDGE.id, candidateId: A.id, lessonIds: [s.lesson.id], withLessons: { action: 'WAIT' }, withoutLessons: lite(s.first.decision) } }]) { const r = await api.raw('POST', body); assert.equal(r.code, 400); assert.match(r.body.error, /needs an exam-pool candidate/); }
  assert.equal((await api.get({ get: 'exams', edge: EDGE.id })).exams.length, pool.length, 'nothing was added for the lesson\'s own setup');
  assert.equal((await api.get({ get: 'candidates', edge: EDGE.id, pool: 'exam', limit: 5000, from: String(MAN.from), to: String(MAN.to) })).candidates.length, 0, 'every exam setup is used once and never offered again');
  assert.equal((await api.get({ get: 'lessons', edge: EDGE.id })).lessons.length, 1, 'no lesson was made from an exam setup');
  // the page: no mentor controls on an exam setup, and a lesson's new-setup counters are fed from GET exams rows only
  const ui = src('assets/academy-ui.js'); assert.match(ui, /if \(S\.setup\.mode !== 'exam'\) renderMentor\(\)/); assert.match(ui, /let ej = await api\.get\(\{ get: 'exams', edge: edge\.id \}\);\n\s*if \(ids\.length\) \{ await examLessonStats\(edge\.id, ids, ej\.exams\)/);
});

// ---- 7 ---------------------------------------------------------------------------------------------------------------------
test('7. conflicting lessons: two matching lessons that ask for opposite actions give WAIT with the conflict named and both listed; switching one off, or narrowing one, settles it; a more specific lesson alone does not', async () => {
  const api = mkApi(W, tmp()), s = await teach(W, api, A, OVERLAP_WAIT), wait = s.lesson;
  const take = await saveLesson(api, { edge: EDGE.id, title: 'With the bias: take it', when: [{ f: 'biasAlign', op: 'eq', v: 'with' }], then: { action: 'TAKE' } });
  let d = (await replay(W, api, A)).decision;
  assert.equal(d.action, 'WAIT'); assert.deepEqual(d.gates.map((g) => [g.code, g.hard, g.overridable]), [['lesson-conflict', true, false]]);
  assert.match(d.waitReasons[0], /^conflicting lessons: \S+ vs \S+ \((TAKE against WAIT|WAIT against TAKE)\): the mentor has to settle which one holds here$/); assert.ok(d.waitReasons[0].includes(wait.id) && d.waitReasons[0].includes(take.id), 'both lessons are named');
  assert.deepEqual(d.lessonsApplied.map((l) => l.id).sort(), [wait.id, take.id].sort()); assert.ok(d.lessonsApplied.every((l) => l.applied === false && /^not applied: conflicts with lesson /.test(l.effect)), 'both are listed, neither is applied');
  assert.equal(d.confidence, 'low'); assert.ok(d.uncertainty.some((u) => /conflicting lessons/.test(u)));
  // this WAIT is not the lesson at work: the comparison says so
  const cmp = W.MXA.compare(s.first.decision, d, s.k); assert.equal(cmp.lessonApplied, false); assert.equal(cmp.verdict, 'partly'); assert.match(cmp.note, /no new lesson was applied/);
  // a third, more specific lesson on one side does not settle it silently: still WAIT, the conflict still named
  const specific = await saveLesson(api, { edge: EDGE.id, title: 'Ranging overlap with the bias: take it', when: [{ f: 'biasAlign', op: 'eq', v: 'with' }, { f: 'regime', op: 'eq', v: 'ranging' }, { f: 'session', op: 'eq', v: 'overlap' }], then: { action: 'TAKE' } });
  d = (await replay(W, api, A)).decision; assert.equal(d.action, 'WAIT'); assert.ok(d.gates.length >= 2 && d.gates.every((g) => g.code === 'lesson-conflict')); assert.ok(d.lessonsApplied.length === 3 && d.lessonsApplied.every((l) => l.applied === false));
  await api.post({ action: 'lesson.deactivate', id: specific.id, active: false, reason: 'back to two' });
  // settle it by switching the WAIT lesson off: the TAKE lesson holds (the engine was taking the trade anyway)
  await api.post({ action: 'lesson.deactivate', id: wait.id, active: false, reason: 'the mentor settles the conflict' });
  d = (await replay(W, api, A)).decision; assert.equal(d.action, 'SELL'); assert.deepEqual(d.gates, []); assert.deepEqual(d.lessonsApplied.map((l) => [l.id, l.applied]), [[take.id, true]]);
  // or the other way: the WAIT lesson back on, the TAKE lesson off
  await api.post({ action: 'lesson.deactivate', id: wait.id, active: true }); await api.post({ action: 'lesson.deactivate', id: take.id, active: false, reason: 'the mentor settles the conflict' });
  d = (await replay(W, api, A)).decision; assert.equal(d.action, 'WAIT'); assert.deepEqual(d.lessonsApplied.map((l) => [l.id, l.applied, l.effect]), [[wait.id, true, 'WAIT: changed SELL to WAIT']]); assert.deepEqual(d.gates, []);
  // or by making one lesson more specific, so that it no longer speaks about this setup: revise TAKE to "only in New York"
  await api.post({ action: 'lesson.deactivate', id: take.id, active: true });
  assert.equal((await replay(W, api, A)).decision.gates[0].code, 'lesson-conflict', 'both on again: the conflict is back');
  const narrowed = (await api.post({ action: 'lesson.revise', id: take.id, patch: { when: [{ f: 'biasAlign', op: 'eq', v: 'with' }, { f: 'session', op: 'eq', v: 'newyork' }] } })).lesson;
  d = (await replay(W, api, A)).decision; assert.equal(d.action, 'WAIT'); assert.deepEqual(d.gates, []); assert.deepEqual(d.lessonsApplied.map((l) => [l.id, l.applied]), [[wait.id, true]]);
  const onB = (await decideFresh(W, api, B, await inForce(api))).decision; assert.deepEqual(onB.lessonsApplied.map((l) => l.id), [narrowed.id], 'and the narrowed lesson still speaks where it should');
  // WAIT against SKIP is not a conflict (both stay out)
  await saveLesson(api, { edge: EDGE.id, title: 'Refuse the overlap', when: [{ f: 'session', op: 'eq', v: 'overlap' }, { f: 'side', op: 'eq', v: 'sell' }], then: { action: 'SKIP' } });
  d = (await replay(W, api, A)).decision; assert.equal(d.action, 'WAIT'); assert.deepEqual(d.gates, []); assert.equal(d.refused, true);
});

// ---- 8 ---------------------------------------------------------------------------------------------------------------------
test('8. deactivation: switching the lesson off restores the original answer on a fresh replay, on again restores the corrected one; a revised version supersedes the old one and the old one never fires again', async () => {
  const api = mkApi(W, tmp()), s = await teach(W, api, A, OVERLAP_WAIT);
  assert.equal((await replay(W, api, A)).decision.action, 'WAIT');
  const off = (await api.post({ action: 'lesson.deactivate', id: s.lesson.id, active: false, reason: 'Switched off by the mentor' })).lesson; assert.equal(off.active, false); assert.equal(off.deactivatedWhy, 'Switched off by the mentor');
  const r = await replay(W, api, A); assert.deepEqual(answer(r.decision), answer(s.first.decision), 'off: the original answer'); assert.deepEqual(r.decision.lessonsApplied, []); assert.equal(r.decision.id, s.first.decision.id);
  // even handed the switched-off lesson directly, the core does not fire it
  assert.equal((await decideFresh(W, api, A, [off])).decision.action, 'SELL');
  await api.post({ action: 'lesson.deactivate', id: s.lesson.id, active: true });
  assert.equal((await replay(W, api, A)).decision.action, 'WAIT', 'on again: the corrected answer');
  // revise: a new version with a new id; the old one is kept, switched off, and can never be switched back on
  const rev = await api.post({ action: 'lesson.revise', id: s.lesson.id, patch: { title: 'Overlap, ranging only', when: [{ f: 'session', op: 'eq', v: 'overlap' }, { f: 'regime', op: 'eq', v: 'ranging' }] } }), v2 = rev.lesson;
  assert.equal(v2.version, 2); assert.notEqual(v2.id, s.lesson.id); assert.equal(v2.supersedes, s.lesson.id); assert.equal(v2.root, s.lesson.id); assert.deepEqual([rev.previous.active, rev.previous.supersededBy], [false, v2.id]); assert.deepEqual(v2.stats, { applied: 0, replayPass: 0, replayFail: 0, examN: 0, examAgree: 0, examNetWith: 0, examNetWithout: 0 }, 'the new version starts its own record');
  const all = (await api.get({ get: 'lessons', edge: EDGE.id })).lessons; assert.equal(all.length, 2); assert.deepEqual((await inForce(api)).map((l) => l.id), [v2.id]);
  const d2 = (await replay(W, api, A)).decision; assert.equal(d2.action, 'WAIT'); assert.deepEqual(d2.lessonsApplied.map((l) => [l.id, l.version, l.applied]), [[v2.id, 2, true]], 'the new version is the one that fires');
  const back = await api.raw('POST', { action: 'lesson.deactivate', id: s.lesson.id, active: true }); assert.equal(back.code, 409); assert.match(back.body.error, /a replaced version cannot be switched back on/);
  assert.equal((await api.raw('POST', { action: 'lesson.revise', id: s.lesson.id, patch: { title: 'again' } })).code, 409, 'and it cannot be revised behind the new one\'s back');
  // given BOTH versions (the whole history), only the new one is retrieved
  assert.deepEqual(W.MXA.lessons.retrieve(all, s.first.f, EDGE.id).matched.map((l) => l.id), [v2.id]);
  // where the two versions differ, the old one's condition no longer decides: a trending overlap setup is left alone by v2
  const trending = { ...s.first.f, regime: 'trending' }; assert.equal(W.MXA.lessons.matches(s.lesson, trending), true, 'version 1 would have matched'); assert.deepEqual(W.MXA.lessons.retrieve(all, trending, EDGE.id).matched, [], 'but it never fires again');
  // switching the NEW version off does not bring the old one back: the original answer returns
  await api.post({ action: 'lesson.deactivate', id: v2.id, active: false, reason: 'test' });
  const all2 = (await api.get({ get: 'lessons', edge: EDGE.id })).lessons; assert.deepEqual(W.MXA.lessons.retrieve(all2, s.first.f, EDGE.id).matched, []); assert.deepEqual(await inForce(api), []);
  assert.deepEqual(answer((await replay(W, api, A)).decision), answer(s.first.decision));
  // every step is in the audit trail
  const audit = (await api.get({ get: 'audit' })).rows.map((x) => x.action); for (const a of ['lesson.save', 'lesson.deactivate', 'lesson.revise', 'attempt', 'correct']) assert.ok(audit.includes(a), a);
});

// ---- 9 ---------------------------------------------------------------------------------------------------------------------
// what the Lessons tab's "Check earlier corrections" does (assets/academy-tabs.js runCheck), step for step, on the real API
async function checkEarlier(Wd, api) {
  const [C, At] = [await api.get({ get: 'corrections', edge: EDGE.id, limit: 2000 }), await api.get({ get: 'attempts', edge: EDGE.id, limit: 2000 })], lessons = await inForce(api);
  const times = Object.fromEntries(TRAIN.map((c) => [c.id, c.t])), plan = Wd.MXAT.regressionTargets({ corrections: C.corrections, attempts: At.attempts, times }), rows = [];
  for (const tg of plan.targets) {
    const c = BY[tg.candidateId], r = await decideFresh(Wd, api, c, lessons); assert.equal(r.hash, tg.hash, 'the same decision point as the one first judged');
    const a = await api.post(attemptBody(c, 'replay-same', r.decision, lessons, r.hash, r.f));
    rows.push({ candidateId: c.id, t: c.t, attemptN: a.n, mode: a.attempt.mode, ...Wd.MXAT.regressionVerdict(tg, r.decision, lessons) });
  }
  return { rows, skipped: plan.skipped, sum: Wd.MXAT.regressionSummary(rows), by: Object.fromEntries(rows.map((x) => [x.candidateId, x])) };
}
test('9. regression after new lessons: a later lesson that flips an earlier correction back is found by "Check earlier corrections", which names the setup and the lesson that changed it', async () => {
  const api = mkApi(W, tmp());
  // lesson 1 fixes setup W1: the engine waits, the mentor says SELL
  const one = await teach(W, api, W1, { choice: 'SELL', reasons: ['session', 'wrong-structure'], keep: ['session', 'regime'], text: 'London range: this is the trade.' });
  assert.equal(one.first.decision.action, 'WAIT'); assert.equal(one.lesson.then.action, 'TAKE'); assert.deepEqual(one.lesson.when.map((w) => [w.f, w.v]), [['session', 'london'], ['regime', 'ranging']]);
  const proved = await replay(W, api, W1); assert.equal(proved.decision.action, 'SELL'); assert.equal(W.MXA.compare(one.first.decision, proved.decision, one.k).verdict, 'learned');
  // the mentor also approves the engine's SELL on setup A
  const ok = await teach(W, api, A, { choice: 'approve', reasons: [], lessons: await inForce(api) }); assert.equal(ok.k.verdict, 'approve'); assert.equal(ok.first.decision.action, 'SELL');
  let chk = await checkEarlier(W, api);
  assert.deepEqual(chk.sum, { n: 2, holds: 2, broken: 0, neverHeld: 0, notReplayed: 0 }, 'before the second lesson both earlier answers hold'); assert.match(chk.by[W1.id].text, /^Still holds: a fresh replay gives SELL, the answer you asked for\.$/); assert.match(chk.by[A.id].text, /the answer you approved/);
  assert.ok(chk.rows.every((x) => x.mode === 'replay-same'), 'each check is stored as a same-trade replay');
  // lesson 2 is made on setup B (the engine buys, the mentor says WAIT) with a condition that is also true on W1 and on A
  const two = await teach(W, api, B, { choice: 'WAIT', reasons: ['htf-bias'], keep: ['biasAlign'], text: 'Do not chase with the bias.', lessons: await inForce(api) });
  assert.deepEqual(two.lesson.when, [{ f: 'biasAlign', op: 'eq', v: 'with' }]); assert.equal((await replay(W, api, B)).decision.action, 'WAIT', 'lesson 2 does its own job on B');
  chk = await checkEarlier(W, api);
  assert.deepEqual(chk.sum, { n: 3, holds: 1, broken: 2, neverHeld: 0, notReplayed: 0 }); assert.equal(chk.by[B.id].status, 'holds');
  const w1 = chk.by[W1.id];   // lesson 1 says TAKE, lesson 2 says WAIT: the conflict holds the decision at WAIT, the original answer
  assert.deepEqual([w1.status, w1.want, w1.got], ['broken', 'SELL', 'WAIT']); assert.deepEqual(w1.changedBy.map((x) => x.id), [two.lesson.id], 'the lesson that changed it is named, and only that one');
  assert.match(w1.text, /^No longer holds: you asked for SELL, and a fresh replay now gives WAIT\. Changed by: "WAIT · gmp: htf-bias", it was not in force when this answer last held \(now: not applied: conflicts with lesson "TAKE · gmp: session, wrong-structure"\)\.$/);
  const a = chk.by[A.id];     // the approved SELL on A is now a WAIT
  assert.deepEqual([a.status, a.want, a.got], ['broken', 'SELL', 'WAIT']); assert.deepEqual(a.changedBy.map((x) => x.id), [two.lesson.id]); assert.match(a.text, /you approved SELL, and a fresh replay now gives WAIT\. Changed by: .*now: WAIT: changed SELL to WAIT/);
  // the mentor narrows lesson 2 to where it was learned; the check then finds every earlier answer intact
  await api.post({ action: 'lesson.revise', id: two.lesson.id, patch: { when: [{ f: 'biasAlign', op: 'eq', v: 'with' }, { f: 'session', op: 'eq', v: 'newyork' }] } });
  chk = await checkEarlier(W, api); assert.deepEqual(chk.sum, { n: 3, holds: 3, broken: 0, neverHeld: 0, notReplayed: 0 }, 'after the fix nothing is broken');
  // switching lesson 1 off breaks its own correction, and the check says which lesson is gone
  await api.post({ action: 'lesson.deactivate', id: one.lesson.id, active: false, reason: 'test' });
  chk = await checkEarlier(W, api); assert.equal(chk.by[W1.id].status, 'broken'); assert.deepEqual(chk.by[W1.id].changedBy, [{ id: one.lesson.id, title: one.lesson.title, why: 'it gave this answer before and is no longer in force (switched off or replaced)' }]);
  // every check added one same-trade replay a setup and never rewrote an earlier attempt
  const rows = (await api.get({ get: 'attempts', edge: EDGE.id, cand: W1.id })).attempts; assert.deepEqual(rows.map((x) => x.n), rows.map((_, i) => i + 1)); assert.deepEqual(rows[0], one.a1.attempt); assert.ok(rows.slice(1).every((x) => x.mode === 'replay-same' && x.snapshotHash === one.first.hash));
});

test('9b. the regression check as pure functions: which setups are checked, which are left out and why, and the three verdicts', () => {
  const T = W.MXAT, at = (n) => new Date(Date.UTC(2026, 10, 10, 12, n)).toISOString();
  const dec = (action, la = []) => ({ action, side: 'sell', entry: 100, stop: 104, target: 90, lessonsApplied: la });
  const att = (id, cand, n, mode, action, o = {}) => ({ id, candidateId: cand, n, mode, at: at(o.min == null ? n : o.min), decision: dec(action, o.la), lessonsAvailable: o.avail || [], snapshotHash: 'h-' + cand });
  const cor = (id, cand, attemptId, verdict, action, min) => ({ id, candidateId: cand, attemptId, verdict, action: action || null, at: at(min), was: { action: 'SELL' }, reasons: [] });
  const attempts = [att('a1', 'x', 1, 'train', 'SELL'), att('a2', 'x', 2, 'replay-same', 'WAIT', { min: 5, la: [{ id: 'L1', version: 1, applied: true, effect: 'WAIT: changed SELL to WAIT' }], avail: ['L1'] }),
    att('b1', 'y', 1, 'train', 'SELL'), att('c1', 'z', 1, 'exam', 'SELL'), att('d1', 'gone', 1, 'train', 'SELL'), att('e1', 'never', 1, 'train', 'SELL')];
  const corrections = [cor('k1', 'x', 'a1', 'change', 'WAIT', 2), cor('k2', 'y', 'b1', 'approve', null, 2), cor('k3', 'z', 'c1', 'change', 'WAIT', 2), cor('k4', 'gone', 'd1', 'change', 'WAIT', 2), cor('k5', 'lost', 'zz', 'change', 'WAIT', 2), cor('k6', 'never', 'e1', 'reject', null, 2)];
  const plan = T.regressionTargets({ corrections, attempts, times: { x: 30, y: 10, z: 20, never: 40 } });
  assert.deepEqual(plan.targets.map((t) => [t.candidateId, t.kind, t.want, t.hash, t.heldAt && t.heldAt.id]), [['y', 'approved', 'SELL', 'h-y', 'b1'], ['x', 'corrected', 'WAIT', 'h-x', 'a2'], ['never', 'corrected', 'WAIT', 'h-never', null]], 'oldest setup first; an approval held on the attempt it was given on');
  assert.deepEqual(plan.skipped.map((s) => [s.candidateId, s.why]).sort(), [['gone', 'this setup is not in the list this server can replay'], ['lost', 'the attempt it was given on is not among the latest attempts read'], ['z', 'it is a test or a blind setup, never replayed']]);
  const [ty, tx, tn] = plan.targets, L1 = { id: 'L1', title: 'lesson one' }, L2 = { id: 'L2', title: 'lesson two' };
  assert.deepEqual(T.regressionVerdict(tx, dec('WAIT', [{ id: 'L1', applied: true }]), [L1]), { status: 'holds', want: 'WAIT', got: 'WAIT', changedBy: [], text: 'Still holds: a fresh replay gives WAIT, the answer you asked for.' });
  const broken = T.regressionVerdict(tx, dec('SELL', [{ id: 'L1', applied: false, effect: 'not applied: conflicts with lesson L2' }, { id: 'L2', applied: false, effect: 'not applied: conflicts with lesson L1' }]), [L1, L2]);
  assert.equal(broken.status, 'broken'); assert.deepEqual(broken.changedBy, [{ id: 'L2', title: 'lesson two', why: 'it was not in force when this answer last held (now: not applied: conflicts with lesson "lesson one")' }], 'the other lesson is named by its title, not its id');
  const gone = T.regressionVerdict(tx, dec('SELL'), []); assert.deepEqual(gone.changedBy.map((x) => [x.id, x.why]), [['L1', 'it gave this answer before and is no longer in force (switched off or replaced)']]);
  assert.match(T.regressionVerdict(tx, dec('SELL', [{ id: 'L1', applied: false, effect: 'x' }]), [L1]).text, /No lesson differs from the replay on which it last held, so the cause is elsewhere/, 'no lesson is blamed without a reason');
  assert.equal(T.regressionVerdict(ty, dec('SELL'), []).status, 'holds'); assert.deepEqual(T.regressionVerdict(ty, dec('WAIT', [{ id: 'L2', applied: true, effect: 'WAIT: changed SELL to WAIT' }]), [L2]).changedBy.map((x) => x.id), ['L2']);
  const nv = T.regressionVerdict(tn, dec('SELL'), []); assert.equal(nv.status, 'never-held'); assert.match(nv.text, /^Never held: you asked for WAIT and no stored replay has given it; a fresh replay gives SELL\./);
  assert.deepEqual(T.regressionSummary([{ status: 'holds' }, { status: 'broken' }, { status: 'never-held' }, { status: 'not-replayed' }, { status: 'holds' }]), { n: 5, holds: 2, broken: 1, neverHeld: 1, notReplayed: 1 });
  assert.deepEqual(T.regressionTargets(null), { targets: [], skipped: [] }); assert.deepEqual(T.regressionSummary(null), { n: 0, holds: 0, broken: 0, neverHeld: 0, notReplayed: 0 });
  // the page's action: paced through the shared API wrapper, with a progress line, each answer stored as a same-trade replay
  const tabs = src('assets/academy-tabs.js'), a0 = tabs.indexOf('async function runCheck('), body = tabs.slice(a0, tabs.indexOf('\n  }\n', a0));
  assert.match(tabs, /id: 'ls-check-run'/); assert.match(body, /Setup \$\{i \+ 1\} of \$\{plan\.targets\.length\}/, 'a progress line, setup by setup'); assert.match(body, /K\.attemptBody\(c, edge, 'replay-same', d, lessons, hash/);
  assert.ok(!/fetch\(/.test(body) && (body.match(/api\.(get|post)\(/g) || []).length >= 3, 'every call goes through the paced wrapper'); assert.match(body, /if \(tg\.hash && hash !== tg\.hash\) throw new Error/, 'another decision point is never stored as this one');
  assert.match(body, /thesis: MXA\.thesis\.start\(snap\)/); assert.ok(!/outcome/.test(body), 'the check reads no result');
});

// ---- 10 --------------------------------------------------------------------------------------------------------------------
test('10. recall, generalisation and expectancy are three records and are never merged; a memorised setup is never independent evidence, in the API or on the page', async () => {
  const api = mkApi(W, tmp()), T = W.MXAT, s = await teach(W, api, A, OVERLAP_WAIT);
  // recall: two same-trade replays of A, the second one approved by the mentor (a verdict on a remembered answer)
  await replay(W, api, A); const r3 = await replay(W, api, A);
  await api.post({ action: 'correct', edge: EDGE.id, correction: { attemptId: r3.row.id, verdict: 'approve', reasons: [], text: '' } });
  // first sight: the engine's BUY on B, approved
  await teach(W, api, B, { choice: 'approve', reasons: [], lessons: await inForce(api) });
  const before = await api.get({ get: 'progress', edge: EDGE.id });
  assert.deepEqual([before.replaySame.n, before.replaySame.graded, before.replaySame.pass, before.exam.n], [2, 2, 2, 0], 'replays are recall and nothing else: no test exists yet');
  // generalisation and expectancy: the exam setups of the window, with and without the lesson
  const lessons = await inForce(api);
  for (const c of EXAM) { const wo = await decideFresh(W, api, c, []), wl = await decideFresh(W, api, c, lessons), att = await api.post(attemptBody(c, 'exam', wl.decision, lessons, wl.hash, wl.f)); await api.post({ action: 'exam.result', result: { edge: EDGE.id, candidateId: c.id, lessonIds: wl.decision.lessonsApplied.map((l) => l.id), withLessons: lite(wl.decision), withoutLessons: lite(wo.decision), attemptId: att.attempt.id } }); }
  const P = await api.get({ get: 'progress', edge: EDGE.id }), X = await api.get({ get: 'exams', edge: EDGE.id }), At = (await api.get({ get: 'attempts', edge: EDGE.id, limit: 2000 })).attempts, C = (await api.get({ get: 'corrections', edge: EDGE.id })).corrections;
  assert.deepEqual(P.replaySame, { ...before.replaySame }, 'tests did not move the recall record'); assert.deepEqual(P.byMode, { train: 2, 'replay-same': 2, exam: EXAM.length, blind: 0 });
  assert.deepEqual([P.exam.n, P.exam.graded], [EXAM.length, EXAM.length]); assert.match(P.note, /A same-trade replay pass shows the lesson is recalled, not that it generalises\. Only tests on new setups count/);
  // expectancy = net R on the unseen setups, with and without, recomputed here from the outcome file
  const outs = json(`academy/data/out-${EDGE.id}.json`), r3d = (v) => Math.round(v * 1000) / 1000, sum = (key) => r3d(X.exams.reduce((t, r) => t + (r[key].action === 'WAIT' ? 0 : outs[r.candidateId].netR), 0));
  assert.equal(P.exam.withLessons.netR, sum('withLessons')); assert.equal(P.exam.withoutLessons.netR, sum('withoutLessons')); assert.equal(P.exam.deltaNetR, r3d(sum('withLessons') - sum('withoutLessons')));
  assert.ok(X.exams.every((r) => EXAM.some((c) => c.id === r.candidateId)) && !X.exams.some((r) => r.candidateId === A.id || r.candidateId === B.id), 'no trained setup is in the unseen record');
  // the page: three separate blocks of numbers, each with its n, and "too few to judge" under 20
  const rv = T.recallVsNew(P);
  assert.deepEqual(Object.keys(rv), ['recall', 'fresh']); assert.deepEqual(rv.recall, { n: 2, graded: 2, pass: 2, fail: 0, rate: 1, tooFew: true }); assert.deepEqual([rv.fresh.n, rv.fresh.graded, rv.fresh.netWith, rv.fresh.netWithout, rv.fresh.tooFew], [EXAM.length, EXAM.length, sum('withLessons'), sum('withoutLessons'), true]);
  assert.ok(!Object.values(rv.fresh).includes(rv.recall.n + rv.fresh.n) && !('total' in rv) && !('all' in rv), 'no field adds the two');
  assert.equal(T.rateText(rv.recall.pass, rv.recall.graded), '2 of 2 (too few to judge)'); assert.match(T.fewText(rv.fresh.graded, 'graded setup'), /^Too few to judge: 3 graded setups, and 20 is the least this page reads anything into\.$/); assert.equal(T.rateText(15, 20), '15 of 20 (75 %)');
  const ex = W.MXAC.examSummary(X.exams); assert.equal(ex.tooFew, true); assert.equal(ex.n, EXAM.length); assert.equal(ex.netWith, sum('withLessons'));
  // agreement with the mentor: only verdicts on FIRST decisions; the approval of the same-trade replay is recall and counted apart
  const ag = T.agreementByWeek(C, At);
  assert.equal(C.length, 3); assert.deepEqual([ag.n, ag.approve, ag.recallN, ag.recallApprove, ag.unknownN, ag.tooFew], [2, 1, 1, 1, 0, true], 'one correction and one approval on first sight; the approved replay is not agreement');
  assert.equal(T.agreementByWeek(C).n, 3, 'without the attempts the helper cannot tell (the page always passes them)'); assert.equal(T.agreementByWeek(C, []).unknownN, 3);
  // a lesson's record: recall and new setups apart; on new setups net R with and without it and the count it actually changed
  for (const r of X.exams.filter((x) => x.lessonIds.includes(s.lesson.id))) await api.post({ action: 'lesson.stats', id: s.lesson.id, inc: { examN: 1, ...(W.MXAC.sameAnswer(r.withLessons, r.withoutLessons) ? { examAgree: 1 } : {}), ...(r.rWith ? { examNetWith: r.rWith } : {}), ...(r.rWithout ? { examNetWithout: r.rWithout } : {}) } });
  await api.post({ action: 'lesson.stats', id: s.lesson.id, inc: { applied: 2, replayPass: 2 } });
  const L = (await inForce(api))[0], rec = T.lessonRecord(L), matched = X.exams.filter((x) => x.lessonIds.includes(s.lesson.id)), flips = matched.filter((r) => !W.MXAC.sameAnswer(r.withLessons, r.withoutLessons)).length;
  assert.ok(matched.length >= 1 && flips >= 1); assert.deepEqual(rec.recall, { n: 2, pass: 2, fail: 0 }); assert.deepEqual([rec.fresh.n, rec.fresh.changed, rec.fresh.agree, rec.fresh.tooFew], [matched.length, flips, matched.length - flips, true]);
  assert.equal(rec.recallText, 'Recall on the same trade: passed 2, failed 0 (n = 2).');
  assert.equal(rec.freshText, `New setups it matched: n = ${matched.length}; the answer changed on ${flips} and stayed the same on ${matched.length - flips}; net ${W.MXAC.fmtR(L.stats.examNetWith)} with lessons against ${W.MXAC.fmtR(L.stats.examNetWithout)} without. Too few to judge.`);
  assert.ok(!/passed|replay/i.test(rec.freshText) && !/New setups|net /.test(rec.recallText), 'neither sentence borrows from the other record');
  // memorised setups, API: a trained setup cannot become a test, an exam setup is never offered twice, and a blind answer the
  // engine gives on a setup it had already decided is flagged as recall
  assert.equal((await api.raw('POST', attemptBody(A, 'exam', s.first.decision, lessons, s.first.hash, s.first.f))).code, 400); assert.equal((await api.get({ get: 'candidates', edge: EDGE.id, pool: 'exam', from: String(MAN.from), to: String(MAN.to) })).candidates.length, 0);
  const blind = async (c) => { const r = await decideFresh(W, api, c, lessons); await api.post(attemptBody(c, 'blind', r.decision, lessons, r.hash, r.f)); return api.post({ action: 'blind.submit', blind: { edge: EDGE.id, candidateId: c.id, action: 'WAIT', text: 'blind' } }); };
  await blind(A); await blind(W1);
  const bl = (await api.get({ get: 'blind', edge: EDGE.id })).blind, byC = Object.fromEntries(bl.map((r) => [r.candidateId, r]));
  assert.equal(byC[A.id].recall, true, 'A was trained on: the engine\'s blind answer there is memory'); assert.equal(byC[W1.id].recall, false);
  // memorised setups, page: the blind table scores only the setup the engine had not seen
  const tb = T.blindTable(bl); assert.deepEqual([tb.n, tb.recalled, tb.withEngine, tb.graded], [2, 1, 1, 1]); assert.equal(T.blindTable([byC[A.id]]).graded, 0); assert.equal(T.blindTable([byC[A.id]]).engineR, 0);
  // the Progress and Lessons tabs draw exactly these helpers, in separate blocks, and say that the records are not added
  const tabs = src('assets/academy-tabs.js');
  assert.match(tabs, /const ag = agreementByWeek\(cors, atts\)/); assert.match(tabs, /id: 'pg-recall' \}, el\('h3', \{ text: 'Same-trade replays \(recall\)' \}\)/); assert.match(tabs, /id: 'pg-fresh' \}, el\('h3', \{ text: 'New setups \(tests\)' \}\)/);
  assert.match(tabs, /These two records are never added together\. Only new setups say whether a lesson generalises\./); assert.match(tabs, /\['Recall', rec\.recallText\], \['New setups', rec\.freshText\]/);
  assert.match(tabs, /recall and \$\{ag\.recallN === 1 \? 'is' : 'are'\} not counted here/); assert.match(tabs, /a remembered answer is not evidence/);
  const ui = src('assets/academy-ui.js'); assert.match(ui, /These numbers are separate from same-trade replays\./); assert.match(ui, /Passing the same trade shows recall, not generalisation\./);
});
