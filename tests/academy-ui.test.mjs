// node --test tests/academy-ui.test.mjs — the Academy page (academy.html, assets/academy-ui.js, scripts/academy-dev.mjs).
// Offline. The page's pure helpers, the page's static promises, the recorded candle fixtures (real OANDA candles, see
// tests/fixtures/academy/manifest.json) and the whole learning loop run the way the page runs it: the real modules
// (MXR / MXA / MXK), the real API handler on an in-memory store, real candidates and outcomes. The browser side of the same
// loop is scripts/audit/academy.cjs (Playwright).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const MXAC = require('../assets/academy-ui.js');
const MXR = require('../assets/academy-replay.js');
const MXA = require('../assets/academy-core.js');
const MXK = require('../assets/academy-risk.js');
const { handle, _t } = require('../api/academy.js');
const ST = require('../api/_academy-store.js');
const { EDGES } = await import('../academy/edges.mjs');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const json = (f) => JSON.parse(src(f));
const DAY = 86400;

// ---- the recorded window: real candles, real candidates -------------------------------------------------------------------
const MAN = json('tests/fixtures/academy/manifest.json');
const SERIES = Object.fromEntries(MXAC.TFS.map((tf) => [tf, json(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`).bars.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }))]));
const EDGE = EDGES.find((e) => e.id === MAN.edge);
const usable = (c) => c.t >= MAN.from && c.t < MAN.to && !(c.rule && (c.rule.clockShift || c.rule.pre2020));
const CANDS = json(`academy/data/cand-${MAN.edge}.json`).filter(usable).sort((a, b) => a.t - b.t);
const TRAIN = CANDS.filter((c) => c.pool !== 'exam'), EXAM = CANDS.filter((c) => c.pool === 'exam');
const SETUP = { edge: EDGE, riskPct: 0.25, cost: EDGE.costPerRoundTrip, balance: 100000 };
const CAL = json('academy/data/calendar.json');
// the page's snapOf: the edge's context timeframes, 300 closed bars each, the release calendar cut at t, no dollar index
function snapOf(c, t = c.t) {
  const o = { edge: EDGE.id, market: EDGE.market, t, cand: c, series: MXAC.snapshotSeries(EDGE, SERIES), dataVersion: 'OANDA (recorded) XAU_USD' }, cut = MXAC.calendarCut(CAL, t);
  if (cut.events) o.events = cut.events; if (cut.schedule) o.schedule = cut.schedule;
  return MXR.snapshot(o);
}
function decideOn(snap, lessons, thesis, history = []) {   // the page's decideOn: the risk engine first, then the policy
  const c = snap.cand, acct = MXK.roll(MXK.account(SETUP.balance, { t: MAN.from }), snap.t);
  const risk = MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.stop, target: c.target, t: snap.t }, acct, { riskPct: SETUP.riskPct });
  return { risk, decision: MXA.decide(snap, { lessons, thesis: thesis || MXA.thesis.start(snap), history, risk, edgeDef: { version: EDGE.version, cost: SETUP.cost } }) };
}
// the API as the dev server mounts it: the real handler, an owner session, the generated files narrowed to the window
function mkApi() {
  const store = ST.memoryStore(), base = _t.fileData(new URL('..', import.meta.url).pathname); let clock = Date.UTC(2026, 10, 10, 12);
  const deps = { env: {}, store, who: async () => ({ u: 'owner' }), sameOrigin: () => true, now: () => (clock += 1000), data: base };
  const listed = { ...deps, data: { ...base, candidates: async (e) => (await base.candidates(e)).filter((c) => c.t >= MAN.from && c.t < MAN.to) } };   // only the LIST of setups is narrowed; past cases keep the whole history
  const call = async (method, payload) => { const out = {}, res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } }; await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, method === 'GET' && payload.get === 'candidates' ? listed : deps); return out; };
  const ok = async (method, payload) => { const r = await call(method, payload); assert.equal(r.code, 200, `${method} ${JSON.stringify(payload).slice(0, 80)} → ${r.code} ${JSON.stringify(r.body)}`); return r.body; };
  return { get: (q) => ok('GET', q), post: (b) => ok('POST', b), raw: call };
}
const attemptBody = (c, mode, d, lessons, hash, f) => ({ action: 'attempt', attempt: { candidateId: c.id, edge: EDGE.id, mode, decision: d, sessionId: null, lessonsAvailable: lessons.map((l) => l.id), snapshotHash: hash }, features: f });

// ---- pure helpers -----------------------------------------------------------------------------------------------------------
test('lookback: every timeframe reaches back far enough for its 300 closed bars, on real candles', () => {
  for (const tf of MXAC.TFS) assert.ok(MXAC.lookbackSec(tf) >= 300 * MXR.TF[tf] * 1.4 + 2 * DAY, tf);
  assert.equal(MXAC.lookbackSec('5m'), 389700);
  // the fixtures were recorded with exactly this lookback: the earliest and the latest setup of the window both get 300 bars
  for (const c of [CANDS[0], CANDS[CANDS.length - 1]]) { const s = snapOf(c); for (const tf of MXAC.TFS) assert.equal(s.bars[tf].length, 300, `${c.id} ${tf}`); }
});

test('default range: the last 60 days of the candidates, never before the first one; the end is exclusive', () => {
  assert.equal(MXAC.defaultRange([], 60), null);
  const t = Date.UTC(2026, 3, 27, 10, 39) / 1000, far = [{ t: t - 400 * DAY }, { t: t - 10 * DAY }, { t }];
  assert.deepEqual(MXAC.defaultRange(far, 60), { from: MXAC.dayStart(t - 60 * DAY), to: MXAC.dayStart(t) + DAY });
  const near = [{ t: t - 3 * DAY }, { t }];
  assert.equal(MXAC.defaultRange(near, 60).from, MXAC.dayStart(t - 3 * DAY), 'a short list starts on its first setup, not 60 empty days earlier');
  assert.equal(MXAC.isoDay(MXAC.dayToSec('2024-05-02')), '2024-05-02'); assert.equal(MXAC.dayToSec('02/05/2024'), null);
  const r = MXAC.defaultRange(TRAIN, 60); assert.equal(MXAC.isoDay(r.from), '2024-05-02'); assert.equal(MXAC.isoDay(r.to - DAY), '2024-05-17');
});

test('the clock reaches a setup: the first one not yet handled between the last reposition and now', () => {
  const cs = [{ id: 'a', t: 100 }, { id: 'b', t: 200 }, { id: 'c', t: 200 }, { id: 'd', t: 300 }], done = new Set();
  assert.equal(MXAC.dueCandidate(cs, 0, 99, done), null);
  assert.equal(MXAC.dueCandidate(cs, 0, 100, done).id, 'a', 'a setup exactly at the tick is due');
  done.add('a'); assert.equal(MXAC.dueCandidate(cs, 0, 150, done), null);
  assert.equal(MXAC.dueCandidate(cs, 0, 1000, done).id, 'b', 'a big step never jumps over the earliest setup');
  done.add('b'); assert.equal(MXAC.dueCandidate(cs, 0, 200, done).id, 'c', 'two setups at the same time are taken one after the other');
  assert.equal(MXAC.dueCandidate(cs, 250, 1000, new Set()).id, 'd', 'setups before a jump target are not fired afterwards');
});

test('chart timeframe, difficulty, costs', () => {
  const tf = Object.fromEntries(EDGES.map((e) => [e.id, MXAC.chartTfOf(e)]));
  assert.deepEqual(tf, { replica: '5m', 'mosha-bo': '15m', gtrend: '1d', gtl: '4h', geg: '1d', gmp: '5m', 'nq-open': '5m' }, 'nq-open fires on 1m: the page loads and charts 5m');
  assert.deepEqual(['5m', '15m', '1h', '4h', '1d'].map(MXAC.htfFor), ['1h', '1h', '4h', '1d', '1d']);
  assert.ok(MXAC.difficultyAllows('expert', 'expert') && MXAC.difficultyAllows('advanced', 'beginner') && !MXAC.difficultyAllows('beginner', 'intermediate') && !MXAC.difficultyAllows('advanced', 'expert'));
  assert.equal(MXAC.costTotal({ spread: 0.15, commission: 0.05, slippage: 0.1 }), 0.3); assert.equal(MXAC.costTotal({ spread: -1, commission: null }), 0);
  const o = { R: -1, netR: -1.0144, reason: 'stop' };
  assert.equal(MXAC.netRAt(o, 0.15, 0.15), -1.0144, 'the study\'s own cost: its net R');
  assert.equal(MXAC.netRAt(o, 0.15, 0.30), -1.0288, 'twice the cost: twice the charge');
  assert.equal(MXAC.netRAt(o, 0.15, 0), -1, 'no cost: the gross R');
  assert.equal(MXAC.netRAt({ netR: 0.5 }, 0.15, 0.3), 0.5, 'without a gross R nothing is rescaled');
  assert.ok(MXAC.unfilled({ reason: 'missed' }) && MXAC.unfilled({ reason: 'expired' }) && MXAC.unfilled({ reason: 'cancelled' }) && !MXAC.unfilled({ reason: 'stop' }) && !MXAC.unfilled(null));
});

test('a lesson reads in plain English and a typed value becomes the contract\'s value', () => {
  const L = { when: [{ f: 'biasAlign', op: 'eq', v: 'against' }, { f: 'session', op: 'eq', v: 'asia' }], then: { action: 'WAIT', adjust: {} } };
  assert.equal(MXAC.lessonText(L), 'When: higher-timeframe bias against the trade AND session = asia → Then: WAIT');
  assert.equal(MXAC.condText({ f: 'rr', op: 'between', v: [1.5, 2.5] }), 'reward to risk between 1.5 and 2.5');
  assert.equal(MXAC.condText({ f: 'oppLiq', op: 'gte', v: 1 }), 'levels in the way at least 1');
  assert.equal(MXAC.condText({ f: 'regime', op: 'in', v: ['ranging', 'reversal'] }), 'regime is one of ranging, reversal');
  assert.equal(MXAC.condText({ f: 'eventNear', op: 'eq', v: true }), 'high-impact event near = yes');
  assert.equal(MXAC.lessonText({ when: [], then: {} }), 'When: no condition yet → Then: nothing yet');
  assert.match(MXAC.lessonText({ when: [{ f: 'confirm', op: 'eq', v: 'strong' }], then: { action: 'TAKE', adjust: { stop: { ref: 'sweepLevel', k: -0.2, unit: 'atr', text: 'stop = 0.2 ATR behind the swept level' } } } }), /Then: TAKE the edge's trade; stop = 0\.2 ATR behind the swept level$/);
  assert.deepEqual(MXAC.parseValue('eq', ' asia '), { ok: true, v: 'asia' }); assert.deepEqual(MXAC.parseValue('eq', 'yes'), { ok: true, v: true }); assert.deepEqual(MXAC.parseValue('eq', '2'), { ok: true, v: 2 });
  assert.deepEqual(MXAC.parseValue('in', 'asia, london'), { ok: true, v: ['asia', 'london'] }); assert.deepEqual(MXAC.parseValue('between', '1.5 .. 2.5'), { ok: true, v: [1.5, 2.5] }); assert.deepEqual(MXAC.parseValue('between', '1 to 3'), { ok: true, v: [1, 3] });
  for (const [op, raw] of [['eq', ''], ['gte', 'high'], ['between', '3 .. 1'], ['between', '2'], ['in', ' , ']]) assert.equal(MXAC.parseValue(op, raw).ok, false, `${op} "${raw}"`);
  for (const c of [{ op: 'between', v: [1, 2] }, { op: 'in', v: ['a', 'b'] }, { op: 'eq', v: 'x' }, { op: 'gte', v: 3 }]) assert.deepEqual(MXAC.parseValue(c.op, MXAC.valueToInput(c)).v, c.v, 'a value survives the round trip through its text box');
});

test('the mentor\'s form: what is sent, and what cannot be saved', () => {
  const d = { action: 'SELL', entry: 2299.34, stop: 2306.32, target: 2229.54 };
  const wait = MXAC.buildCorrection({ choice: 'WAIT', entry: 1, stop: 2, target: 3, reasons: ['session'], text: ' too early ', bias: 'neutral', annotations: [{ kind: 'liquidity', t: 5, price: 2300 }] }, 'at_1');
  assert.deepEqual(wait, { attemptId: 'at_1', verdict: 'change', action: 'WAIT', entry: null, stop: null, target: null, bias: 'neutral', edge: null, reasons: ['session'], text: 'too early', annotations: [{ kind: 'liquidity', t: 5, price: 2300, t2: null, price2: null, note: '' }] });
  assert.deepEqual(MXAC.correctionProblems(wait, d), []);
  assert.deepEqual([MXAC.buildCorrection({ choice: 'approve' }, 'a').verdict, MXAC.buildCorrection({ choice: 'reject' }, 'a').action], ['approve', null]);
  assert.deepEqual(MXAC.correctionProblems(MXAC.buildCorrection({ choice: 'approve' }, 'a'), d), [], 'an approval needs no reason');
  assert.match(MXAC.correctionProblems(MXAC.buildCorrection({ choice: 'reject' }, 'a'), d).join(' '), /Say why/);
  assert.match(MXAC.correctionProblems(MXAC.buildCorrection({ choice: 'WAIT', text: 'x' }, 'a'), { action: 'WAIT' }).join(' '), /already said WAIT/);
  const sell = (o) => MXAC.buildCorrection({ choice: 'SELL', entry: 2299.34, stop: 2306.32, target: 2229.54, text: 'x', ...o }, 'a');
  assert.match(MXAC.correctionProblems(sell(), d).join(' '), /engine's own answer/);
  assert.deepEqual(MXAC.correctionProblems(sell({ stop: 2310 }), d), [], 'the same action with another stop is a real correction');
  assert.match(MXAC.correctionProblems(sell({ stop: 2290 }), d).join(' '), /stop must be above the entry/);
  assert.match(MXAC.correctionProblems(sell({ target: 2400 }), d).join(' '), /target must be below the entry/);
  assert.match(MXAC.correctionProblems(sell({ stop: null }), d).join(' '), /every trade has a stop/);
  assert.match(MXAC.correctionProblems({}, d).join(' '), /Choose Approve/);
});

test('new-setup numbers: matched, changed, net R with and without, and "too few" under 20 graded', () => {
  const row = (wl, wo, rW, rWo, ids = [], out = { reason: 'stop' }) => ({ withLessons: wl, withoutLessons: wo, rWith: rW, rWithout: rWo, lessonIds: ids, outcome: out });
  const W = { action: 'WAIT' }, S = { action: 'SELL', entry: 10, stop: 11, target: 5 };
  const s = MXAC.examSummary([row(W, S, 0, -1.0144, ['ls_1']), row(S, S, 0.5, 0.5), row(W, W, 0, 0, ['ls_1']), row({ action: 'BUY', entry: 10, stop: 9, target: 12 }, S, null, 0.25, ['ls_2']), row(S, S, 0, 0, [], { reason: 'expired' })]);
  assert.deepEqual(s, { n: 5, matched: 3, changed: 2, graded: 4, netWith: 0.5, netWithout: -0.514, neverFilled: 1, tooFew: true });
  assert.equal(MXAC.examSummary(Array.from({ length: 20 }, () => row(W, W, 0, 0))).tooFew, false);
  assert.deepEqual(MXAC.examSummary(null), { n: 0, matched: 0, changed: 0, graded: 0, netWith: 0, netWithout: 0, neverFilled: 0, tooFew: true });
  assert.ok(!MXAC.sameAnswer(S, { ...S, stop: 12 }), 'the same action on another stop is a changed answer');
});

test('candle errors are said in words the owner can act on', () => {
  assert.match(MXAC.candleError({ code: 'NO_SOURCE' }), /^The server has no candle source configured/);
  assert.match(MXAC.candleError({ code: 'NETWORK' }), /could not be reached/); assert.match(MXAC.candleError({ code: 'UPSTREAM' }), /Try again/);
  assert.match(MXAC.candleError(new Error('boom')), /could not be loaded: boom/);
});

test('registerTab: the hook for the sections built next', () => {
  assert.throws(() => MXAC.registerTab('progress', {}), /render/); assert.throws(() => MXAC.registerTab('Bad Id', { render() {} }), /short id/);
  assert.doesNotThrow(() => MXAC.registerTab('progress', { title: 'Progress', render() {} }));
  assert.deepEqual(MXAC.TABS.map((t) => t[0]), ['train', 'session', 'blind', 'progress', 'lessons', 'research', 'models', 'costs', 'audit']);
});

// ---- the API wrapper: the site's firewall allows 30 requests a minute on /api --------------------------------------------------
const fakeNet = (answers, calls = []) => async (url, init) => { calls.push({ url, method: (init && init.method) || 'GET', body: init && init.body }); const a = answers.length > 1 ? answers.shift() : answers[0]; return { status: a.status, ok: a.status >= 200 && a.status < 300, headers: { get: (k) => (k === 'Retry-After' && a.ra != null ? a.ra : null) }, json: async () => a.body || { error: 'limited' } }; };
test('the API wrapper waits out a 429 (Retry-After, else 5 s doubling) and sends the same write again: nothing is dropped', async () => {
  const calls = [], sleeps = [], waits = [];
  const api = MXAC.makeApi({ fetch: fakeNet([{ status: 429, ra: '2' }, { status: 429 }, { status: 429 }, { status: 200, body: { ok: true, n: 1 } }], calls), sleep: async (ms) => { sleeps.push(ms); }, now: () => 0, perMinute: 0, onWait: (k, sec) => waits.push([k, sec]) });
  assert.deepEqual(await api.post({ action: 'attempt', x: 1 }), { ok: true, n: 1 });
  assert.equal(calls.length, 4); assert.ok(calls.every((c) => c.method === 'POST' && c.body === '{"action":"attempt","x":1}' && c.url === '/api/academy'), 'the same write, four times');
  assert.deepEqual(sleeps, [2000, 5000, 10000]); assert.deepEqual(waits, [['limit', 2], [null, 0], ['limit', 5], [null, 0], ['limit', 10], [null, 0]], 'a calm wait is announced and cleared, never an error');
  assert.deepEqual(api.stats, { calls: 4, paced: 0, retries: 3 });
  // still limited after the last try: the call fails with the status, so the caller can say so (reported, not lost)
  const c2 = [], s2 = [], api2 = MXAC.makeApi({ fetch: fakeNet([{ status: 429 }], c2), sleep: async (ms) => { s2.push(ms); }, now: () => 0, perMinute: 0 });
  await assert.rejects(() => api2.post({ action: 'correct' }), (e) => e.status === 429 && /still limiting requests after 4 tries/.test(e.message));
  assert.equal(c2.length, MXAC.TRIES); assert.deepEqual(s2, [5000, 10000, 20000]);
  // other failures are not retried and keep the server's words
  const c3 = [], api3 = MXAC.makeApi({ fetch: fakeNet([{ status: 403, body: { error: 'decide first' } }], c3), sleep: async () => {}, perMinute: 0 });
  await assert.rejects(() => api3.get({ get: 'outcome', id: 'x' }), (e) => e.status === 403 && e.message === 'decide first'); assert.equal(c3.length, 1); assert.equal(c3[0].url, '/api/academy?get=outcome&id=x');
  await assert.rejects(() => MXAC.makeApi({ fetch: async () => { throw new Error('offline'); }, perMinute: 0 }).get({ get: 'edges' }), (e) => e.status === 0 && /could not be reached/.test(e.message));
});
test('the API wrapper paces itself: never more than 24 calls in any minute, in order; writes go one at a time', async () => {
  assert.equal(MXAC.PACE, 24);
  let T = 0; const at = [], waits = [];
  const api = MXAC.makeApi({ fetch: async (url) => { at.push([T, url]); return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({}) }; }, sleep: async (ms) => { T += ms; }, now: () => T, perMinute: MXAC.PACE, onWait: (k) => { if (k) waits.push(k); } });
  await Promise.all(Array.from({ length: 60 }, (_, i) => api.get({ get: 'attempts', i })));
  assert.equal(at.length, 60); assert.deepEqual(at.map((x) => +new URL(x[1], 'http://x').searchParams.get('i')), Array.from({ length: 60 }, (_, i) => i), 'in the order asked');
  for (let i = 0; i < at.length; i++) assert.ok(at.filter((x) => x[0] > at[i][0] - 60000 && x[0] <= at[i][0]).length <= 24, `call ${i}: more than 24 in a minute`);
  assert.ok(at[23][0] === 0 && at[24][0] >= 60000 && at[48][0] >= 120000, 'the first 24 go at once, the next wait for the window'); assert.ok(waits.length >= 2 && waits.every((k) => k === 'pace')); assert.ok(api.stats.paced >= 2);
  // POSTs are serial even when the network answers out of order
  const order = [], slow = MXAC.makeApi({ perMinute: 0, fetch: async (url, init) => { const b = JSON.parse(init.body); order.push('start ' + b.n); await new Promise((r) => setTimeout(r, b.n === 1 ? 20 : 1)); order.push('end ' + b.n); return { status: 200, ok: true, headers: { get: () => null }, json: async () => b }; } });
  await Promise.all([slow.post({ n: 1 }), slow.post({ n: 2 }), slow.post({ n: 3 })]); assert.deepEqual(order, ['start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3']);
});
test('past cases read once for a run are cut per decision exactly as the API cuts them for one setup', async () => {
  const api = mkApi(), all = await api.get({ get: 'history', edge: EDGE.id, before: String(MAN.to) });   // the page sends it as a query string
  assert.ok(all.rows.length > 100);
  for (const c of [TRAIN[0], TRAIN[TRAIN.length - 1], EXAM[0]]) { const one = await api.get({ get: 'history', edge: EDGE.id, cand: c.id }); assert.deepEqual(MXAC.historyAt(all.rows, c.t), one.rows, c.id); assert.ok(MXAC.historyAt(all.rows, c.t).every((r) => r.t < c.t && r.exitT < c.t)); }
  assert.ok(all.rows.every((r) => Object.keys(r).sort().join() === 'exitT,features,netR,t'), 'no id and no price in a past case');
  assert.deepEqual(MXAC.historyAt(null, 5), []); assert.deepEqual(MXAC.historyAt([{ t: 1, exitT: 9 }, { t: 1, exitT: 3 }], 5), [{ t: 1, exitT: 3 }]);
  const c = { side: 'sell', entry: 100, stop: 104, target: 90 };
  assert.deepEqual(MXAC.mentorLevelsOf(c, 'SELL'), { entry: 100, stop: 104, target: 90 }); assert.deepEqual(MXAC.mentorLevelsOf(c, 'BUY'), { entry: 100, stop: 96, target: 110 }, 'the other side mirrors the levels'); assert.deepEqual(MXAC.mentorLevelsOf(c, 'WAIT'), { entry: null, stop: null, target: null });
});
test('a replay run reads its lists once: one stored attempt is the only call of a train decision', () => {
  const ui = src('assets/academy-ui.js'), body = (name) => { const a = ui.indexOf(`async function ${name}(`); return ui.slice(a, ui.indexOf('\n  }\n', a)); };
  assert.equal((body('openPoint').match(/api\.(get|post)\(/g) || []).length, 1, 'openPoint: the attempt, nothing else (the session is saved once, in saveSession)');
  assert.deepEqual(body('examOne').match(/api\.(get|post)\(/g), ['api.post(', 'api.post('], 'a test on a new setup: the attempt and the result');
  assert.ok(!/get: 'history', edge: [^}]*cand:/.test(ui), 'no per-setup history read');
  assert.match(ui, /historyFor\(st\.edge\.id, st\.to\)/); assert.match(ui, /lessonsFor\(st\.edge\.id, true\)/);
});

// ---- the page's static promises ---------------------------------------------------------------------------------------------
test('academy.html: owner card, the nine sections, the scripts in order, built by the build script', () => {
  const html = src('academy.html'), ui = src('assets/academy-ui.js');
  assert.match(html, /<title>MeridianX Academy<\/title>/); assert.match(html, /<h1>MeridianX Academy<\/h1>/);
  assert.match(html, /The Academy is for the desk owner\. Sign in on the desk\./);
  for (const [id] of MXAC.TABS) assert.match(html, new RegExp(`<section id="ac-${id}" role="tabpanel"`), id);
  for (const id of ['session', 'blind', 'progress', 'lessons', 'research', 'models', 'costs', 'audit']) assert.match(html, new RegExp(`<section id="ac-${id}"[^>]*hidden></section>`), `${id} ships empty in the page: assets/academy-tabs.js fills it from stored data`);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['/assets/lightweight-charts-4.1.3.js', '/assets/backtest-engine.js', '/assets/academy-replay.js', '/assets/academy-core.js', '/assets/academy-risk.js', '/assets/mx-nav.js', '/assets/academy-ui.js', '/assets/academy-tabs.js', '/assets/academy-analyst.js']);
  assert.ok(!/\son[a-z]+="/.test(html), 'no inline event handlers');
  assert.ok(!/Coming in the next build step|\(next step\)/.test(ui + src('assets/academy-tabs.js') + html), 'no placeholder is left: a section works or says honestly what is missing');
  assert.match(ui, /if \(!me \|\| me\.u !== 'owner'\) \{ \$\('ac-gate'\)\.hidden = false; return; \}/, 'anyone but the owner gets the card and the page stops there');
  assert.match(ui, /Passing the same trade shows recall, not generalisation\./);
  assert.match(src('scripts/build.sh'), /^cp .*\bacademy\.html\b.* out\/$/m);
  assert.ok(json('vercel.json').rewrites.some((r) => r.source === '/academy' && r.destination === '/academy.html'));
  assert.equal(src('out/academy.html').includes('MeridianX Academy'), true, 'out/ carries the page');
});

test('the page talks to the Academy API and the candle proxy only: no broker, no order, no other service', () => {
  const ui = src('assets/academy-ui.js');
  const urls = [...ui.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(urls, ['url, init'], 'one fetch call, inside the api helper');
  assert.deepEqual([...new Set([...ui.matchAll(/'(\/(?:api|md|cdata)\/[a-z-]+)[?']/g)].map((m) => m[1]))].sort(), ['/api/academy']);
  assert.ok(!/ctrader|\/api\/bridge|tradovate|websocket|new WebSocket|sessionStorage|indexedDB/i.test(ui), 'no broker code, no socket, no browser storage of results');
  // Browser storage (11 Nov 2026, round 2): until then the page used none at all. It now keeps two DISPLAY preferences of the
  // device (the edge used last, which parts of the decision card are open) and nothing else: one reader and one writer, both
  // refusing any key outside the list, and no caller passes them a decision, a result, a lesson or an API answer.
  // (11 Nov 2026: a third helper, prefDel, because the site's phone-view key means "simple" by being absent.)
  assert.equal((ui.match(/localStorage/g) || []).length, 3, 'localStorage is touched in prefGet, prefSet and prefDel only');
  // 11 Nov 2026, the phone's simple view: the list grew by exactly one key, `ms-phone`, the display preference the Desk, the
  // Macro desk and ChronosTrade share ("full", or no key for the simple view).
  assert.match(ui, /const PREFS = \['mxacEdge', 'mxacFold', 'ms-phone'\];/);
  assert.match(ui, /function prefDel\(k\) \{ if \(PREFS\.indexOf\(k\) < 0\) return; try \{ root\.localStorage\.removeItem\(k\); \}/);
  assert.deepEqual([...ui.matchAll(/prefDel\(([^;]*?)\);/g)].map((m) => m[1]).filter((x) => x !== 'k'), ["'ms-phone'"], 'the one removal: the phone view going back to simple');
  assert.match(ui, /function prefGet\(k\) \{ if \(PREFS\.indexOf\(k\) < 0\) return null; try \{ return root\.localStorage\.getItem\(k\); \}/);
  assert.match(ui, /function prefSet\(k, v\) \{ if \(PREFS\.indexOf\(k\) < 0\) return; try \{ root\.localStorage\.setItem\(k, String\(v\)\.slice\(0, 400\)\); \}/);
  assert.deepEqual([...ui.matchAll(/prefSet\(([^;]*?)\);/g)].map((m) => m[1]).filter((x) => !/^k, v$/.test(x)).sort(), ["'ms-phone', 'full'", "'mxacEdge', String(id)", "'mxacFold', JSON.stringify(v)"], 'the three writes: an edge id, the open flags of the card, and the fixed word "full" for the phone view');
  for (const f of ['assets/academy-tabs.js', 'assets/academy-analyst.js']) assert.ok(!/localStorage|sessionStorage/.test(src(f)), f + ' keeps nothing in the browser');
  // POSTs are queued: the store has no compare-and-swap
  assert.match(ui, /const p = chain\.then\(run, run\); chain = p\.catch\(\(\) => \{\}\); return p;/);
});

test('rule 6: no model names in the Academy page files', () => {
  for (const f of ['academy.html', 'assets/academy.css', 'assets/academy-ui.js', 'assets/academy-tabs.js', 'tests/academy-tabs.test.mjs', 'scripts/academy-dev.mjs', 'scripts/audit/academy.cjs', 'tests/academy-ui.test.mjs', 'tests/fixtures/academy/manifest.json'])
    assert.ok(!new RegExp(['clau' + 'de', 'anthro' + 'pic', 'open' + 'ai', 'gp' + 't-', 'gem' + 'ini', 'son' + 'net', 'op' + 'us\\b', 'hai' + 'ku'].join('|'), 'i').test(src(f)), f);
});

test('academy.css: 12 px text at least, no endless animation, touch height from the shared token', () => {
  const css = src('assets/academy.css');
  for (const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, `font size ${m[1]}px`);
  assert.ok(!/infinite/.test(css)); assert.ok(!/@keyframes/.test(css));
  assert.match(css, /input, select, textarea \{[^}]*min-height: var\(--tap\)/);
  assert.match(css, /@media \(max-width: 1080px\) \{ \.ac-grid \{ grid-template-columns: minmax\(0, 1fr\); \} \}/, 'one column on narrow screens (the chart column comes first in the markup)');
  const html = src('academy.html'); assert.ok(html.indexOf('class="ac-chart-col"') < html.indexOf('class="ac-side"'));
});

// ---- the fixtures: real candles, small, complete ------------------------------------------------------------------------------
test('fixtures: real recorded candles for one window, well formed, and several train and exam setups inside it', () => {
  assert.equal(MAN.edge, 'gmp'); assert.match(MAN.source, /meridianx\.dev\/md\/bars/); assert.ok(TRAIN.length >= 3 && EXAM.length >= 3, `${TRAIN.length} train, ${EXAM.length} exam`);
  assert.deepEqual(MAN.candidates, { train: TRAIN.length, exam: EXAM.length });
  let bytes = 0;
  for (const tf of MXAC.TFS) {
    const f = json(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`), bars = SERIES[tf], sec = MXR.TF[tf]; bytes += src(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`).length;
    assert.equal(f.src, 'OANDA'); assert.equal(f.inst, 'XAU_USD'); assert.equal(bars.length, MAN.tfs[tf].n);
    assert.equal(f.from, MAN.from - MXAC.lookbackSec(tf), `${tf}: only the window and its lookback`); assert.equal(f.to, MAN.to);
    for (let i = 0; i < bars.length; i++) { const b = bars[i]; assert.ok(MXR.cleanBar(b), `${tf}[${i}] is a well-formed bar`); assert.ok(b.time % sec === 0 && b.time >= f.from && b.time < f.to); if (i) assert.ok(b.time > bars[i - 1].time); }
    assert.ok(new Set(bars.map((b) => b.close)).size > bars.length / 4, `${tf}: prices move like a market, not a generator`);
  }
  assert.ok(bytes < 450 * 1024, `fixtures stay small (${bytes} bytes)`);
  // a 4h bar rebuilt from the 5m candles is the recorded 4h bar: the files are one consistent feed
  const agg = MXR.aggregate(SERIES['5m'], '5m', '4h', MAN.to), ref = new Map(SERIES['4h'].map((b) => [b.time, b])); let same = 0;
  for (const b of agg.slice(2)) { const r = ref.get(b.time); if (r && Math.abs(r.high - b.high) < 0.5 && Math.abs(r.low - b.low) < 0.5) same++; }
  assert.ok(same >= agg.length - 4, `${same} of ${agg.length} 4h bars agree`);
});

// ---- the loop, as the page runs it ----------------------------------------------------------------------------------------------
test('no look-ahead: a snapshot at a setup holds only closed bars, and a candidate reaches it only at its own time', () => {
  for (const c of CANDS) {
    const s = snapOf(c); assert.ok(MXAC.snapshotClean(s)); MXR.guard(s); MXA.assertNoFuture(s);
    for (const tf of MXAC.TFS) { const last = s.bars[tf][s.bars[tf].length - 1]; assert.ok(last.time + MXR.TF[tf] <= c.t, `${c.id} ${tf}`); }
    assert.ok(!Object.keys(s.cand).some((k) => ['R', 'netR', 'exitT', 'exit', 'mfeR', 'maeR'].includes(k)));
    assert.throws(() => snapOf(c, c.t - 60), (e) => e.code === 'LOOKAHEAD', 'one minute early the candidate is refused');
    for (const e of s.events || []) assert.ok(e.t <= c.t && e.t > c.t - 7 * DAY); for (const e of s.schedule || []) { assert.ok(e.t > c.t && e.t <= c.t + 72 * 3600); assert.deepEqual(Object.keys(e).sort(), ['impact', 't', 'title']); }
  }
  const dirty = snapOf(CANDS[0]); dirty.bars['5m'].push({ time: CANDS[0].t, open: 1, high: 1, low: 1, close: 1 }); assert.equal(MXAC.snapshotClean(dirty), false);
  // the chart's forming bar is display only: the snapshot builder never lets one in
  const c = TRAIN[0], forming = MXR.formingAt(SERIES['5m'], '1h', c.t, '5m'); assert.equal(forming.forming, true);
  assert.throws(() => MXR.guard({ v: 1, t: c.t, bars: { '1h': [forming] } }), (e) => e.code === 'LOOKAHEAD');
  assert.ok(!snapOf(c).bars['1h'].some((b) => b.time === forming.time), 'the bar still forming at t is not in the snapshot');
});

test('the learning loop on real data: decide, store, correct, save the lesson, replay the same trade → learned; then new setups', async () => {
  const api = mkApi();
  // 1. the first train setup the engine takes
  let cand = null, snap = null, first = null;
  const hist = async (c) => { const h = await api.get({ get: 'history', edge: EDGE.id, cand: c.id }); assert.equal(h.available, true); assert.ok(h.rows.every((r) => r.t < c.t && r.exitT < c.t), 'past cases had finished before the setup'); return h.rows; };
  const seenGates = [];
  for (const c of TRAIN) { const s = snapOf(c), r = decideOn(s, [], null, await hist(c)); seenGates.push(...r.decision.gates.map((g) => g.code)); if (r.decision.action !== 'WAIT') { cand = c; snap = s; first = r; break; } }
  assert.ok(seenGates.includes('event'), 'the calendar reaches the decision: the setup hours before payrolls waits on event risk');
  assert.ok(first.decision.similar.n >= 20 && Number.isFinite(first.decision.similar.winRate), `similar past cases come from the history route (n = ${first.decision.similar.n})`);
  assert.ok(cand, 'the recorded window holds a train setup the engine takes'); assert.equal(first.risk.allowed, true); assert.ok(first.risk.size > 0 && Math.abs(first.risk.riskCash - 250) < 1, 'sized at 0.25 % of 100,000');
  const f = MXA.features(snap), hash = MXR.hash(snap);
  const a1 = await api.post(attemptBody(cand, 'train', first.decision, [], hash, f));
  assert.equal(a1.n, 1); assert.equal(a1.attempt.decision.action, first.decision.action); assert.equal(a1.attempt.snapshotHash, hash);
  // 2. the mentor: WAIT, missing confirmation
  const c = MXAC.buildCorrection({ choice: 'WAIT', reasons: ['session', 'wrong-structure'], text: 'Not in this session.', bias: 'neutral', annotations: [{ kind: 'liquidity', t: cand.t, price: cand.entry }, { kind: 'supply-demand', t: cand.t - 3600, price: cand.entry, t2: cand.t, price2: cand.stop }] }, a1.attempt.id);
  assert.deepEqual(MXAC.correctionProblems(c, first.decision), []);
  const errorClass = MXA.classifyError(first.decision, c, null); assert.ok(MXA.ERROR_CLASSES.includes(errorClass));
  const k = (await api.post({ action: 'correct', edge: EDGE.id, correction: { ...c, errorClass } })).correction;
  assert.equal(k.action, 'WAIT'); assert.equal(k.annotations.length, 2); assert.equal(k.errorClass, errorClass);
  // 3. the draft, edited the way the mentor would: one condition removed, validated, saved
  const draft = MXA.lessons.fromCorrection(first.decision, k, f);
  assert.equal(draft.then.action, 'WAIT'); assert.ok(draft.when.length >= 2 && draft.when[0].f === 'session'); assert.match(MXAC.lessonText(draft), /^When: session = \w+ AND .+ → Then: WAIT$/);
  draft.when = draft.when.filter((w) => w.f === 'session'); assert.deepEqual(MXA.lessons.validate(draft), []);
  assert.ok(MXA.lessons.validate({ ...draft, when: [] }).length > 0, 'a lesson without a condition is refused');
  const saved = (await api.post({ action: 'lesson.save', lesson: { edge: draft.edge, title: draft.title, text: draft.text, when: draft.when, then: draft.then, source: draft.source, active: true } })).lesson;
  assert.equal(saved.version, 1); assert.equal(saved.source.correctionId, k.id); assert.equal(saved.source.attemptId, a1.attempt.id);
  // 4. replay the same trade: the same snapshot, the lessons from the server, a fresh thesis
  const lessons = (await api.get({ get: 'lessons', edge: EDGE.id, active: '1' })).lessons; assert.equal(lessons.length, 1);
  const again = snapOf(cand); assert.equal(MXR.hash(again), a1.attempt.snapshotHash, 'the same decision point');
  const second = decideOn(again, lessons, MXA.thesis.start(again), await hist(cand));
  assert.equal(second.decision.action, 'WAIT'); assert.notEqual(second.decision.action, first.decision.action);
  assert.equal(second.decision.lessonsApplied.length, 1); assert.equal(second.decision.lessonsApplied[0].id, saved.id); assert.equal(second.decision.lessonsApplied[0].applied, true);
  const cmp = MXA.compare(first.decision, second.decision, k);
  assert.equal(cmp.verdict, 'learned'); assert.equal(cmp.lessonApplied, true); assert.deepEqual(cmp.lessonIds, [saved.id]); assert.ok(cmp.changed.some((x) => x.field === 'action'));
  const a2 = await api.post(attemptBody(cand, 'replay-same', second.decision, lessons, MXR.hash(again), MXA.features(again)));
  assert.equal(a2.n, 2);
  await api.post({ action: 'lesson.stats', id: saved.id, inc: { applied: 1, replayPass: 1 } });
  const stored = (await api.get({ get: 'attempts', edge: EDGE.id, cand: cand.id })).attempts;
  assert.deepEqual(stored.map((a) => [a.n, a.mode, a.decision.action]), [[1, 'train', first.decision.action], [2, 'replay-same', 'WAIT']]);
  // the page's work-around after a reload: the stored decisions still give the same verdict
  assert.equal(MXA.compare(MXAC.restoreApplied(stored[0].decision), MXAC.restoreApplied(stored[1].decision), k).verdict, 'learned');
  // the paper trade may only be read now that the attempt is stored
  const out = (await api.get({ get: 'outcome', id: cand.id, edge: EDGE.id })).outcome; assert.ok(Number.isFinite(out.netR) && out.exitT > cand.t);
  let acct = MXK.open(MXK.roll(MXK.account(100000, { t: MAN.from }), cand.t), { id: cand.id, market: cand.market, side: cand.side, units: first.risk.size, entry: cand.entry, stop: cand.stop, target: cand.target, t: cand.t });
  assert.equal(acct.positions.length, 1);
  acct = MXK.apply(acct, { id: cand.id, netR: MXAC.netRAt(out, EDGE.costPerRoundTrip, SETUP.cost), riskCash: first.risk.riskCash, exitT: out.exitT });
  assert.equal(acct.positions.length, 0); assert.ok(Math.abs(acct.balance - (100000 + out.netR * first.risk.riskCash)) < 0.02);

  // 5. new setups: unseen exam candidates, without and with the lesson; the outcome is refused until the attempt is stored
  const pool = (await api.get({ get: 'candidates', edge: EDGE.id, pool: 'exam', limit: 5000 })).candidates; assert.equal(pool.length, EXAM.length);
  assert.equal((await api.raw('GET', { get: 'outcome', id: pool[0].id, edge: EDGE.id })).code, 403, 'no peeking before the decision');
  const lite = (d) => ({ action: d.action, entry: d.entry, stop: d.stop, target: d.target, confidence: d.confidence });
  for (const x of pool) {
    const s = snapOf(x), h = await hist(x), without = decideOn(s, [], null, h).decision, withL = decideOn(s, lessons, null, h).decision;
    const att = await api.post(attemptBody(x, 'exam', withL, lessons, MXR.hash(s), MXA.features(s)));
    await api.post({ action: 'exam.result', result: { edge: EDGE.id, candidateId: x.id, lessonIds: withL.lessonsApplied.map((l) => l.id), withLessons: lite(withL), withoutLessons: lite(without), attemptId: att.attempt.id } });
    assert.equal((await api.raw('POST', attemptBody(x, 'train', withL, lessons, MXR.hash(s), MXA.features(s)))).code, 400, 'an exam setup is never a training setup');
  }
  const ex = await api.get({ get: 'exams', edge: EDGE.id }), sum = MXAC.examSummary(ex.exams);
  assert.equal(sum.n, EXAM.length); assert.equal(sum.graded, EXAM.length); assert.equal(sum.tooFew, true, 'a handful of setups is too few to judge');
  assert.ok(sum.matched >= 1 && sum.changed >= 1, `the lesson matches and changes unseen setups in this window (${sum.matched} matched, ${sum.changed} changed)`);
  assert.equal(sum.netWith, Math.round(ex.exams.reduce((s, r) => s + r.rWith, 0) * 1000) / 1000);
  assert.equal((await api.get({ get: 'candidates', edge: EDGE.id, pool: 'exam', limit: 5000 })).candidates.length, 0, 'every exam setup is used once');
  // a replay position round-trips through the session store
  const replay = MXR.session.save({ edge: EDGE.id, market: EDGE.market, tf: '5m', t: cand.t, from: MAN.from, to: MAN.to, speed: 100, balance: acct.balance, risk: { riskPct: 0.25 }, costs: { spread: 0.15, commission: 0, slippage: 0 }, difficulty: 'expert', mode: 'train', openDecisions: [a1.attempt.id], savedAt: '2026-11-10T12:00:00Z' });
  const se = (await api.post({ action: 'session.save', session: { edge: EDGE.id, title: 'test', kind: 'replay', status: 'paused', candidateId: cand.id, t: cand.t, state: { replay, account: acct, done: [cand.id] } } })).session;
  const back = (await api.get({ get: 'session', id: se.id })).session; assert.deepEqual(MXR.session.restore(back.state.replay), replay); assert.equal(back.state.account.balance, acct.balance);
});

// ---- bugs found in other modules while building the page (the page works around both) --------------------------------------------
// api/academy.js decisionOf() keeps only { id, version, effect } of decision.lessonsApplied, so a STORED decision no longer
// says whether a lesson was applied. MXA.compare() reads `applied !== false`, so on stored attempts a lesson that matched but
// was NOT applied counts as applied. Work-around on the page: MXAC.restoreApplied() reads it back from the effect text.
test('a stored decision keeps lessonsApplied[].applied, so compare() on stored attempts does not over-count (fixed in api/academy.js)', async () => {
  const api = mkApi(), c = TRAIN[0], s = snapOf(c), d = { ...decideOn(s, []).decision, action: 'WAIT' };
  const notApplied = { ...d, action: 'WAIT', lessonsApplied: [{ id: 'ls_x1', version: 1, effect: 'TAKE not applied: blocked by rr (a lesson cannot override it)', applied: false, correctionId: 'co_1', title: 'x' }] };
  await api.post(attemptBody(c, 'train', { ...d, action: 'WAIT' }, [], MXR.hash(s), null)); await api.post(attemptBody(c, 'replay-same', notApplied, [], MXR.hash(s), null));
  const [A, B] = (await api.get({ get: 'attempts', edge: EDGE.id, cand: c.id })).attempts;
  assert.equal(MXA.compare({ ...d, action: 'WAIT' }, notApplied, { verdict: 'change', action: 'SELL' }).lessonApplied, false, 'in memory the comparison is right');
  assert.equal(MXA.compare(MXAC.restoreApplied(A.decision), MXAC.restoreApplied(B.decision), { verdict: 'change', action: 'SELL' }).lessonApplied, false, 'and with the page\'s work-around');
  assert.equal(B.decision.lessonsApplied[0].applied, false, 'the stored decision should still say the lesson was not applied');
  assert.equal(MXA.compare(A, B, { verdict: 'change', action: 'SELL' }).lessonApplied, false);
});
test('the work-around: restoreApplied reads "applied" back from the engine\'s effect text', () => {
  const r = MXAC.restoreApplied({ lessonsApplied: [{ id: 'a', effect: 'WAIT: changed SELL to WAIT' }, { id: 'b', effect: 'TAKE not applied: blocked by rr (a lesson cannot override it)' }, { id: 'c', effect: 'matched, nothing to change' },
    { id: 'd', effect: 'WAIT: agrees with lesson a; stop rule not applied: the decision is WAIT' }, { id: 'e', effect: 'stop rule rejected: it would put the stop or target on the wrong side of the entry' }, { id: 'f', effect: 'whatever', applied: false }] });
  assert.deepEqual(r.lessonsApplied.map((l) => l.applied), [true, false, false, true, false, false]);
  assert.equal(MXAC.restoreApplied(null), null); assert.deepEqual(MXAC.restoreApplied({ action: 'WAIT' }), { action: 'WAIT' });
});
// assets/academy-core.js evidenceOf() writes the thesis start as raw epoch seconds into text the mentor reads
// ("In line with the running thesis (bias down since 1714608000)."). The page shows it as a date; the stored text keeps the number.
test('evidence text gives the thesis start as a UTC date, never raw epoch seconds (fixed in assets/academy-core.js)', () => {
  const c = TRAIN.find((x) => decideOn(snapOf(x), []).decision.action !== 'WAIT'), d = decideOn(snapOf(c), []).decision;
  const texts = d.supporting.concat(d.contradicting).map((x) => x.text).filter((t) => /running thesis/.test(t));
  assert.ok(texts.length > 0); for (const t of texts) assert.doesNotMatch(t, /since \d{9,}/, t);
});
test('the work-around: the page shows that time as a UTC date', () => {
  assert.equal(MXAC.humanize('In line with the running thesis (bias down since 1714608000).'), 'In line with the running thesis (bias down since 2024-05-02 00:00 UTC).');
  assert.equal(MXAC.humanize('a wick through the swing level 2286.185 7 bars ago'), 'a wick through the swing level 2286.185 7 bars ago'); assert.equal(MXAC.humanize(null), '');
});

// ---- "What if": alternatives on the candles after a stored decision --------------------------------------------------------------
test('what if: allowed only once the attempt is stored (a test: its result too; the blind arena: the mentor\'s answer too)', () => {
  const base = { edge: EDGE, cand: TRAIN[0] };
  assert.equal(MXAC.whatIfAllowed(base), false, 'no attempt, no card'); assert.equal(MXAC.whatIfAllowed({ ...base, attemptId: 'at_1' }), true); assert.equal(MXAC.whatIfAllowed({ ...base, attemptId: 'at_1', mode: 'replay-same' }), true);
  assert.equal(MXAC.whatIfAllowed({ ...base, attemptId: 'at_1', mode: 'exam' }), false, 'a test: not before both answers are stored'); assert.equal(MXAC.whatIfAllowed({ ...base, attemptId: 'at_1', mode: 'exam', resultId: 'ex_1' }), true);
  assert.equal(MXAC.whatIfAllowed({ ...base, attemptId: 'at_1', mode: 'blind' }), false, 'blind: not before the mentor has answered'); assert.equal(MXAC.whatIfAllowed({ ...base, attemptId: 'at_1', mode: 'blind', blindId: 'bl_1' }), true);
  assert.equal(MXAC.whatIfAllowed(null), false); assert.equal(MXAC.whatIfAllowed({ attemptId: 'at_1', edge: EDGE, cand: {} }), false);
  // in the page: the card draws nothing before that, the later candles are loaded only inside the button's click, and no snapshot is made there
  const ui = src('assets/academy-ui.js'), a = ui.indexOf('function whatIfCard('), card = ui.slice(a, ui.indexOf('\n  }\n', a));
  assert.match(card, /clear\(box\); if \(!whatIfAllowed\(o\)\) \{ box\.hidden = true; return null; \}/, 'not allowed: no card and no button at all');
  assert.ok(card.indexOf('MXR.load(') > card.indexOf('onclick: async () => {'), 'the candles after the decision are asked for only on the click');
  assert.ok(!/snapOf\(|MXR\.snapshot\(|lastSnapshot|MXA\.decide\(|api\.post\(/.test(card), 'the card builds no snapshot, makes no decision and stores nothing');
  assert.match(ui, /if \(!cur \|\| cur\.closed \|\| !cur\.first \|\| !cur\.first\.row\) \{ box\.hidden = true; clear\(box\); return; \}/, 'the Train card needs the stored attempt row');
  const tabs = src('assets/academy-tabs.js'); assert.ok(tabs.indexOf('K.whatIfCard(') > tabs.indexOf("action: 'blind.submit'") && (tabs.match(/K\.whatIfCard\(/g) || []).length === 1, 'the blind arena offers it only in the view shown after blind.submit');
});
test('what if: the candles read start at the decision and run for the edge\'s maximum hold, else a cap', () => {
  const t = Date.UTC(2024, 4, 2, 14, 30) / 1000, by = Object.fromEntries(EDGES.map((e) => [e.id, MXAC.whatIfWindow(e, t)]));
  assert.deepEqual(Object.fromEntries(EDGES.map((e) => [e.id, [by[e.id].tf, by[e.id].bars]])), { replica: ['5m', 577], 'mosha-bo': ['15m', 385], gtrend: ['1d', 96], gtl: ['4h', 25], geg: ['1d', 31], gmp: ['5m', 97], 'nq-open': ['5m', 96] });
  assert.equal(by.gmp.from, t, 'a decision on a candle boundary: that candle is the first'); assert.equal(by.gmp.to, t + 97 * 300); assert.match(by.gmp.why, /maximum hold \(8 hours\)/); assert.match(by.gtrend.why, /a cap of 96 candles/); assert.match(by.geg.why, /720 hours, the life of its resting order included/);
  assert.equal(MXAC.whatIfWindow(EDGE, t + 120).from, t + 300, 'a decision inside a candle: the next candle is the first (the one it sits in is not read)');
  const day = Date.UTC(2024, 4, 2) / 1000; assert.equal(MXAC.whatIfWindow(EDGES.find((e) => e.id === 'geg'), day + 240).from, day, 'a daily signal stamped 00:04 reads that day\'s candle'); assert.equal(MXAC.whatIfWindow(EDGES.find((e) => e.id === 'geg'), day + 7200).from, day + 86400);
  for (const e of EDGES) assert.ok(by[e.id].from >= t && by[e.id].to > by[e.id].from && by[e.id].bars <= 2000, e.id);
});
test('what if: the rows are the setup, the engine and the mentor where they differ, then fixed variants from the setup\'s own risk', () => {
  const c = { id: 'x', t: 1, side: 'sell', entry: 100, stop: 104, target: 90 }, keys = (o) => MXAC.whatIfAlternatives(o).map((a) => a.key);
  const VAR = ['stop-half', 'stop-wide', 'target-1r', 'target-2r', 'target-3r', 'late'];
  assert.deepEqual(keys({ cand: c }), ['setup', ...VAR]);
  assert.deepEqual(keys({ cand: c, engine: { action: 'SELL', entry: 100, stop: 104, target: 90 } }), ['setup', ...VAR], 'the engine took the setup as proposed: no second row');
  assert.deepEqual(keys({ cand: c, engine: { action: 'WAIT', entry: 100, stop: 104, target: 90 }, mentor: { action: 'WAIT' } }), ['setup', 'engine', ...VAR], 'one WAIT row is enough');
  const all = MXAC.whatIfAlternatives({ cand: c, engine: { action: 'SELL', entry: 100, stop: 103, target: 90 }, mentor: { action: 'BUY', entry: 100, stop: 96, target: 110 } }), by = Object.fromEntries(all.map((a) => [a.key, a]));
  assert.deepEqual(all.map((a) => a.key), ['setup', 'engine', 'mentor', ...VAR]); assert.equal(by.engine.label, 'The engine\'s answer: SELL on other levels'); assert.equal(by.mentor.label, 'Your correction: BUY, the other side'); assert.equal(by.mentor.side, 'buy');
  assert.deepEqual([by['stop-half'].stop, by['stop-wide'].stop, by['target-1r'].target, by['target-2r'].target, by['target-3r'].target], [102, 106, 96, 92, 88], 'a sell: stops above, targets below, in units of the setup\'s own risk');
  assert.deepEqual([by.late.entry, by.late.type, by.late.afterBars, by.late.stop], [null, 'market', 1, 104]); assert.ok(all.every((a) => a.wait || a.afterBars === (a.key === 'late' ? 1 : 0)));
  const buy = Object.fromEntries(MXAC.whatIfAlternatives({ cand: { side: 'buy', entry: 2300, stop: 2295, target: null } }).map((a) => [a.key, a]));
  assert.deepEqual([buy['stop-half'].stop, buy['stop-wide'].stop, buy['target-2r'].target, buy.setup.target], [2297.5, 2292.5, 2310, null]);
  assert.deepEqual(MXAC.whatIfAlternatives({ cand: { side: 'buy', entry: 100, stop: 101 } }), [], 'a setup without a stop on the losing side builds nothing'); assert.deepEqual(MXAC.whatIfAlternatives({}), []); assert.deepEqual(MXAC.whatIfAlternatives({ cand: c, mentor: { action: 'SELL', entry: 100 } }).map((a) => a.key), ['setup', ...VAR], 'a correction without a stop is not a row');
  assert.equal(MXAC.whatIfAlternatives({ cand: c, mentor: { action: 'SELL', entry: 101, stop: 105, target: 91 }, mentorLabel: 'Your answer' })[1].label, 'Your answer: SELL on other levels');
});
test('what if: the simulation is conservative, charges the run\'s costs, and a WAIT is 0R; the later candles never touch a snapshot', () => {
  const bar = (i, o, h, l, c) => ({ time: 1000 + i * 300, open: o, high: h, low: l, close: c }), c = { id: 'x', t: 1000, side: 'buy', entry: 100, stop: 98, target: 104 };
  // one candle touches both the stop and the target: the stop is taken
  let rows = MXAC.whatIfRun(MXAC.whatIfAlternatives({ cand: c, engine: { action: 'WAIT' } }), [bar(0, 100, 105, 97, 101)], { spread: 0, commission: 0, slippage: 0 }), by = Object.fromEntries(rows.map((r) => [r.key, r.result]));
  assert.deepEqual([by.setup.filled, by.setup.reason, by.setup.netR], [true, 'stop', -1]); assert.deepEqual(by.engine, { filled: false, R: 0, netR: 0, exitT: null, reason: 'wait', mfeR: 0, maeR: 0, entryT: null, fill: null }); assert.equal(by.late.reason, 'no-fill', 'one candle later there is no candle left');
  assert.equal(rows.length, 8); assert.ok(rows.every((r) => r.result && typeof r.result.reason === 'string'));
  // a clean run to the target, with costs: 0.2 a round trip on a risk of 2 is 0.1R
  rows = MXAC.whatIfRun(MXAC.whatIfAlternatives({ cand: c }), [bar(0, 100, 101, 98.9, 100.8), bar(1, 100.8, 102.5, 100.5, 102.2), bar(2, 102.2, 106.5, 102, 106)], { spread: 0, commission: 0.2, slippage: 0 }); by = Object.fromEntries(rows.map((r) => [r.key, r.result]));
  assert.deepEqual([by.setup.reason, by.setup.R, by.setup.netR, by.setup.exitT], ['target', 2, 1.9, 1600]); assert.deepEqual([by['target-1r'].reason, by['target-1r'].R, by['target-1r'].exitT], ['target', 1, 1300]); assert.deepEqual([by['target-3r'].reason, by['target-3r'].R], ['target', 3]);
  assert.equal(by['stop-half'].reason, 'stop', 'half the stop distance (99) was hit on the first candle (low 98.9), the full stop (98) was not'); assert.equal(by['stop-wide'].reason, 'target'); assert.ok(by['stop-wide'].R < 2, 'a wider stop makes the same target fewer R');
  assert.deepEqual([by.late.filled, by.late.fill, by.late.reason], [true, 100.8, 'target']); assert.ok(by.setup.mfeR >= 2 && by.setup.maeR <= 0);
  assert.equal(MXAC.whatIfRun(MXAC.whatIfAlternatives({ cand: c }), [bar(0, 100, 101, 99.5, 100.8)], {})[0].result.reason, 'open', 'neither level reached: still open at the last candle read');
  // on the recorded candles: a real setup, its later candles on the signal timeframe; the snapshot of that setup is the same before and after
  const cand = TRAIN[0], before = MXR.hash(snapOf(cand)), w = MXAC.whatIfWindow(EDGE, cand.t), later = SERIES[w.tf].filter((b) => b.time >= w.from && b.time < w.to);
  assert.ok(later.length > 50 && later.every((b) => b.time >= cand.t), `${later.length} candles, all after the decision`);
  const real = MXAC.whatIfRun(MXAC.whatIfAlternatives({ cand, engine: { action: 'WAIT' } }), later, { spread: EDGE.costPerRoundTrip, commission: 0, slippage: 0 });
  assert.equal(real.length, 8); for (const r of real) { assert.ok(Number.isFinite(r.result.netR), r.key); if (r.result.filled) { assert.ok(r.result.exitT >= w.from && r.result.maeR <= 0 && r.result.mfeR >= 0, r.key); assert.ok(r.result.netR < r.result.R, 'costs are charged'); } }
  const again = snapOf(cand); assert.equal(MXR.hash(again), before); assert.ok(MXAC.snapshotClean(again)); assert.ok(!again.bars[w.tf].some((b) => later.includes(b)), 'no later candle is in the snapshot');
});
test('what if: the simulated setup is compared with the stored result, and a difference is said, not hidden', () => {
  const row = (o) => ({ key: 'setup', result: { filled: true, R: 1, netR: 0.95, reason: 'target', ...o } });
  assert.match(MXAC.whatIfNote(row(), { R: 1, netR: 0.9, reason: 'target' }), /^The first row agrees with the stored result of this setup within 0\.15R: simulated \+0\.95R, exit by target; stored \+0\.90R after costs, exit by target\.$/);
  const diff = MXAC.whatIfNote(row({ netR: -1.02, reason: 'stop' }), { R: 2.4, netR: 2.3, reason: 'trail' });
  assert.match(diff, /^The first row does NOT match the stored result of this setup: simulated -1\.02R, exit by stop; stored \+2\.30R after costs, exit by trail \(a difference of -3\.32R\)\./); assert.match(diff, /the candles differ/); assert.match(diff, /pyramid adds/); assert.match(diff, /study's research candles/);
  assert.match(MXAC.whatIfNote(row({ filled: false, reason: 'no-fill', netR: 0 }), { R: 0, netR: 0, reason: 'expired' }), /^The first row agrees with the stored result: the order did not fill in either \(stored: expired\)\.$/);
  assert.match(MXAC.whatIfNote(row(), { R: 0, netR: 0, reason: 'missed' }), /does NOT match.*stored: the order never filled \(missed\)/); assert.match(MXAC.whatIfNote(row({ filled: false, reason: 'no-fill' }), { R: 1, netR: 0.9, reason: 'target' }), /does NOT match.*simulated never filled/);
  assert.match(MXAC.whatIfNote(row(), null), /^No stored result is on file/); assert.equal(MXAC.whatIfNote(null, {}), 'Nothing was simulated.');
  assert.deepEqual(Object.keys(MXAC.WHATIF_REASON).sort(), ['bad-stop', 'no-fill', 'no-trade', 'open', 'stop', 'target', 'wait']);
});

// ---- usability pass (11 Nov 2026) -------------------------------------------------------------------------------------------
test('humanize names a lesson by its title when the lessons are at hand, and mends a doubled full stop (display only)', () => {
  const ls = [{ id: 'ls_0mwc3emu90a7dd6b9881', title: 'WAIT · gmp: htf-bias' }, { id: 'ls_0mwc3fjt60d27c861c61', title: 'FLIP · gmp: htf-bias' }];
  const raw = 'conflicting lessons: ls_0mwc3emu90a7dd6b9881 vs ls_0mwc3fjt60d27c861c61 (FLIP against WAIT): the mentor has to settle which one holds here';
  assert.equal(MXAC.humanize(raw, ls), 'conflicting lessons: "WAIT · gmp: htf-bias" vs "FLIP · gmp: htf-bias" (FLIP against WAIT): the mentor has to settle which one holds here');
  assert.equal(MXAC.humanize(raw), raw, 'without the lessons the text is left alone');
  assert.equal(MXAC.humanize('lesson ls_0mwc3zzzzzzzzzzzzzzz applied', ls), 'lesson ls_0mwc3zzzzzzzzzzzzzzz applied', 'an id that is not among them stays an id: nothing is guessed');
  assert.equal(MXAC.humanize('Mentor: WAIT instead of BUY (htf-bias).. Bias down.'), 'Mentor: WAIT instead of BUY (htf-bias). Bias down.');
  assert.equal(MXAC.humanize('wait for it... then act'), 'wait for it... then act', 'an ellipsis is not a doubled full stop');
  assert.equal(MXAC.humanize('give two numbers, low .. high'), 'give two numbers, low .. high');
  assert.equal(MXAC.humanize('ATR is 2.19 times its median (limit 2)'), 'ATR is 2.19 times its median (limit 2)');
});

test('a half-written verdict is known as unsaved until it is stored; an untouched or saved form is not', () => {
  const blank = { choice: null, reasons: [], text: '', annotations: [], dirty: false };
  assert.equal(MXAC.mentorUnsaved(blank), false); assert.equal(MXAC.mentorUnsaved(null), false);
  assert.equal(MXAC.mentorUnsaved({ ...blank, dirty: true }), false, 'touched and emptied again: nothing to lose');
  assert.equal(MXAC.mentorUnsaved({ ...blank, dirty: true, text: '   ' }), false);
  assert.equal(MXAC.mentorUnsaved({ ...blank, dirty: true, choice: 'reject' }), true);
  assert.equal(MXAC.mentorUnsaved({ ...blank, dirty: true, text: 'It should have sold.' }), true);
  assert.equal(MXAC.mentorUnsaved({ ...blank, dirty: true, reasons: ['late'] }), true);
  assert.equal(MXAC.mentorUnsaved({ ...blank, dirty: true, annotations: [{ kind: 'entry', price: 1 }] }), true);
  assert.equal(MXAC.mentorUnsaved({ ...blank, dirty: false, choice: 'reject', text: 'stored' }), false, 'stored: dirty was cleared by the save');
});

test('the line under the chart at a decision point says what was decided and what to do next, never a number as a probability', () => {
  assert.equal(MXAC.pointLine({ action: 'WAIT', confidence: 'low' }), 'Setup reached: the engine says WAIT (low confidence). Read why, then give your verdict.');
  assert.equal(MXAC.pointLine({ action: 'BUY', confidence: 'high', corrected: true }), 'Setup reached: the engine says BUY (high confidence). Your verdict is saved: continue when you are ready.');
  assert.equal(MXAC.pointLine({ action: 'SELL', exam: true }), 'Exam setup reached: the engine says SELL. Its result is in the decision card.');
  for (const o of [{ action: 'WAIT', confidence: 'low' }, { action: 'BUY', corrected: true }, { action: 'SELL', exam: true }, {}]) assert.doesNotMatch(MXAC.pointLine(o), /%|probab|chance|\d/);
});

test('page wiring of the usability pass: the point line sits under the chart, Continue asks before dropping a verdict, the result columns lead', () => {
  const html = src('academy.html'), ui = src('assets/academy-ui.js'), tabs = src('assets/academy-tabs.js'), css = src('assets/academy.css');
  const iChart = html.indexOf('id="chart-wrap"'), iBar = html.indexOf('id="point-bar"'), iCtl = html.indexOf('id="ctl"'), iLegend = html.indexOf('id="chart-legend"');
  assert.ok(iChart > 0 && iChart < iBar && iBar < iCtl && iCtl < iLegend, 'chart, then the point line, then the controls, then the legend');
  assert.match(html, /id="point-bar" role="status" aria-live="polite" hidden/);
  // every way of leaving a decision point goes through the same question: play / continue, step, jump, restart
  const guards = ui.match(/!leaveOk\(\)/g) || []; assert.equal(guards.length, 4, 'play, step, jump and restart');
  // round 3 (11 Nov 2026): the question itself moved into MXAC.leaveGuard, shared with the Session tab and the Blind arena
  assert.match(ui, /const trainUnsaved = \(\) => !!S\.cur && !S\.cur\.closed && mentorUnsaved\(M\);\s*const leaveOk = leaveGuard\(\{ unsaved: trainUnsaved, tell:/);
  assert.match(ui, /cur\.correction = res\.correction; cur\.cmp = null; M\.dirty = false;/, 'a stored correction is no longer unsaved');
  assert.match(ui, /id: 'continue-msg', role: 'status'/);
  // the guard only delays a click: it stores nothing and decides nothing
  const body = ui.slice(ui.indexOf('const trainUnsaved'), ui.indexOf('// ---- the line under the chart')) + ui.slice(ui.indexOf('function leaveGuard(o)'), ui.indexOf('// the one line under the chart')); assert.ok(body.length > 600); assert.doesNotMatch(body, /api\.|MXA\.|MXK\.|prefSet|localStorage/);
  assert.match(ui, /\['Alternative', 'Net R after costs', 'Exit', 'Filled', 'Levels', 'Best', 'Worst', 'Exit time \(UTC\)'\]/);
  assert.match(ui, /PV\.chart\.timeScale\(\)\.fitContent\(\)/, 'the preview shows the whole two weeks it names');
  assert.match(tabs, /K\.showNode\(st\.node\)/, 'Blind arena: "Next setup" brings the chart back');
  assert.match(tabs, /MXAC\.humanize\(d\.thesis, Z\.lessons\)/);
  assert.match(css, /scroll-margin-top: 64px/); assert.match(css, /\.ac-side \.cond > :first-child \{ grid-column: 1 \/ -1; \}/);
});

// ---- round 2 (11 Nov 2026): keeping the place, the folded card, calmer forms --------------------------------------------------
test('a setup id in the engine\'s text is shown in plain words; other ids and words are left alone', () => {
  assert.equal(MXAC.humanize('rejected candidate gmp-1714660200s: the evidence does not beat it'), 'rejected the sell setup of 2024-05-02 14:30 UTC: the evidence does not beat it');
  assert.equal(MXAC.humanize('nq-open-1514903940b: not opened on paper'), 'the buy setup of 2018-01-02 14:39 UTC: not opened on paper');
  assert.equal(MXAC.humanize('mosha-bo-1532336640s closed'), 'the sell setup of 2018-07-23 09:04 UTC closed');
  for (const keep of ['data OANDA xau-usd policy-1.0', 'attempt at_0mwc5xyro13a8c328cea in session se_0mwc3emu9', 'snapshot 64e9d0fc81e8ea15', 'a body of 2.28 ATR 2 bars ago', 'level 2286.185 7 bars ago']) assert.equal(MXAC.humanize(keep), keep);
  // every real candidate id of the seven edges reads as its own side and time
  for (const e of EDGES) { const c = json(`academy/data/cand-${e.id}.json`)[0]; assert.equal(MXAC.humanize(c.id), `the ${c.side} setup of ${MXAC.fmtTime(c.t)}`, c.id); }
});

test('the folded decision card: the main reasons are a cut of lists that stay whole in the card', () => {
  const wait = { action: 'WAIT', waitReasons: ['a', 'b', 'c', 'd', 'e'], supporting: [{ text: 'x', weight: 2 }] };
  assert.deepEqual(MXAC.mainReasons(wait), { kind: 'wait', items: ['a', 'b', 'c'], more: 2 });
  const take = { action: 'BUY', supporting: [{ text: 'light', weight: 0.5 }, { factor: 'heavy', weight: 2 }, { text: 'mid', weight: 1 }, { text: 'none' }] };
  assert.deepEqual(MXAC.mainReasons(take), { kind: 'take', items: ['heavy', 'mid', 'light'], more: 1 });
  assert.deepEqual(take.supporting.map((x) => x.text || x.factor), ['light', 'heavy', 'mid', 'none'], 'the decision itself is not reordered');
  assert.deepEqual(MXAC.mainReasons({ action: 'SELL' }), { kind: 'take', items: [], more: 0 }); assert.deepEqual(MXAC.mainReasons(null), { kind: 'take', items: [], more: 0 });
  const ui = src('assets/academy-ui.js'), view = ui.slice(ui.indexOf('function decisionView(box, o) {'), ui.indexOf('function renderDecision() {'));
  // nothing left out: every part the unfolded card drew is still drawn, folded or not
  for (const id of ['-thesis', '-support', '-against', '-similar', '-lessons']) assert.ok(view.includes(`idp + '${id}'`), id);
  for (const t of ['Reasons to wait', 'What it is waiting for', 'Uncertainty', 'What would prove it wrong', 'Reward to risk', 'Stop distance', 'Risk engine', 'Similar past cases', 'Lessons applied', 'Facts about this setup from the edge']) assert.ok(view.includes(t), t);
  for (const k of ['evidence', 'wait', 'doubt', 'risk', 'similar', 'lessons']) assert.ok(view.includes(`part('${k}'`), k);
  assert.match(ui, /lessons: S\.lessons, fold: true, onLessons:/, 'the Train card is the folded one');
  assert.doesNotMatch(src('assets/academy-tabs.js'), /fold: true/, 'the Session and Blind cards already sit behind their own disclosure');
  // the view draws; it decides nothing and sends nothing
  assert.doesNotMatch(view, /api\.|MXA\.decide|MXK\./);
});

test('two conflicting lessons named by a decision are found by their ids, and only then', () => {
  const t = 'WAIT on the sell candidate: conflicting lessons: ls_0mwc3emu90a7dd6b9881 vs ls_0mwc3fjt60d27c861c61 (FLIP against WAIT): the mentor has to settle which one holds here.';
  assert.deepEqual(MXAC.conflictIds({ thesis: t }), ['ls_0mwc3emu90a7dd6b9881', 'ls_0mwc3fjt60d27c861c61']);
  assert.deepEqual(MXAC.conflictIds({ thesis: 'x', waitReasons: ['y', t] }), ['ls_0mwc3emu90a7dd6b9881', 'ls_0mwc3fjt60d27c861c61']);
  assert.equal(MXAC.conflictIds({ thesis: 'lesson ls_0mwc3emu90a7dd6b9881 applied' }), null); assert.equal(MXAC.conflictIds(null), null); assert.equal(MXAC.conflictIds({}), null);
  const tabs = src('assets/academy-tabs.js');
  assert.match(tabs, /MXAC\.lessonFocus = null;/, 'the Lessons tab marks them once, not on every later visit');
  assert.match(tabs, /li\.classList\.add\('hit'\)/);
});

test('the verdicts offered never repeat the engine\'s own answer as a change', () => {
  assert.deepEqual(MXAC.mentorChoices('WAIT'), [['approve', 'Approve'], ['reject', 'Reject'], ['BUY', 'Change to BUY'], ['SELL', 'Change to SELL']]);
  assert.deepEqual(MXAC.mentorChoices('BUY'), [['approve', 'Approve'], ['reject', 'Reject'], ['BUY', 'Keep BUY, other levels'], ['SELL', 'Change to SELL'], ['WAIT', 'Change to WAIT']]);
  assert.deepEqual(MXAC.mentorChoices('SELL').map((x) => x[1]), ['Approve', 'Reject', 'Change to BUY', 'Keep SELL, other levels', 'Change to WAIT']);
  // the rule that refuses a WAIT on a WAIT is still in force behind the form
  assert.deepEqual(MXAC.correctionProblems(MXAC.buildCorrection({ choice: 'WAIT', reasons: ['late'] }, 'at_1'), { action: 'WAIT' }), ['The engine already said WAIT: use Approve.']);
});

test('a reload keeps the place: the session saved last comes first, a finished one is not offered, and the position rides on one call a decision', () => {
  const rows = [{ id: 'a', kind: 'replay', status: 'paused', updatedAt: '2026-11-11T10:00:00Z' }, { id: 'b', kind: 'replay', status: 'done', updatedAt: '2026-11-11T12:00:00Z' }, { id: 'c', kind: 'replay', status: 'paused', updatedAt: '2026-11-11T11:00:00Z' }, { id: 'd', kind: 'session', status: 'paused', updatedAt: '2026-11-11T13:00:00Z' }];
  assert.deepEqual(MXAC.latestFirst(rows).map((r) => r.id), ['d', 'b', 'c', 'a']); assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c', 'd'], 'the list handed in is not reordered');
  assert.equal(MXAC.unfinished(MXAC.latestFirst(rows)).id, 'c', 'the unfinished replay saved last; a finished one and a Session-tab sitting are not offered');
  assert.equal(MXAC.unfinished([]), null); assert.equal(MXAC.unfinished(null), null); assert.deepEqual(MXAC.latestFirst(null), []);
  const ui = src('assets/academy-ui.js'), open = ui.slice(ui.indexOf('  async function openPoint(c) {'), ui.indexOf('  // A reload keeps your place'));
  // one train decision: the first of a run saves the session BEFORE its attempt (it needs the id) with the setup it is on, and
  // adds no call; every later one saves once AFTER its attempt. Never both.
  assert.match(open, /const firstSave = !S\.sessionId; if \(firstSave\) await saveSession\(true, c\.id\);/);
  assert.match(open, /if \(!firstSave\) await keepPlace\(\);/);
  assert.equal((open.match(/saveSession\(|keepPlace\(/g) || []).length, 2);
  assert.ok(open.indexOf("api.post(attemptBody(") < open.indexOf('await keepPlace()'), 'the position is saved after the attempt is stored');
  assert.match(ui, /async function keepPlace\(\) \{ try \{ await saveSession\(true\); \} catch \(e\) \{ log\(/, 'a failed position save never costs the decision');
  assert.match(ui, /cur: S\.cur && !S\.cur\.closed \? S\.cur\.cand\.id : curId \|\| null \}/);
  // the offer reads the list the page already asks for and loads nothing until Resume is pressed
  const offer = ui.slice(ui.indexOf('function renderResumeNow(s) {'), ui.indexOf('  // The edge used last')); assert.doesNotMatch(offer, /api\.get|MXR\.load/);
  assert.match(src('academy.html'), /id="resume-now" hidden/);
});

test('the red problem line waits for Save: before it, what is missing is a calm line and Save is offered', () => {
  const ui = src('assets/academy-ui.js'), tabs = src('assets/academy-tabs.js');
  assert.match(ui, /const b = \$\('m-save'\); if \(b\) b\.disabled = !M\.choice;/);
  assert.match(ui, /const n = \$\('m-err'\), on = !!M\.tried && probs\.length > 0;/);
  assert.match(ui, /if \(mentorCheck\(true\)\.length\) \{.*?return; \} S\.busy = true;/, 'Save with something missing shows the problem and stores nothing');
  assert.ok(ui.indexOf('if (mentorCheck(true).length)') < ui.indexOf("api.post({ action: 'correct'"), 'the check comes before the call');
  assert.match(tabs, /if \(save\.disabled \|\| check\(true\)\.length\) return;/);
  assert.match(tabs, /err\.hidden = !on;/); assert.match(tabs, /save\.disabled = !A\.action;/);
});

// ---- round 3 (11 Nov 2026): the Session tab and the Blind arena get the protections of the Train tab ------------------------------
test('leaveGuard: the first press over an unsaved answer says so and refuses, a second within ten seconds leaves, a saved answer never asks', () => {
  let now = 1000, dirty = true, told = 0; const ok = MXAC.leaveGuard({ unsaved: () => dirty, tell: () => { told++; }, now: () => now });
  assert.equal(MXAC.LEAVE_MS, 10000);
  assert.equal(ok(), false); assert.equal(told, 1); now += 9000; assert.equal(ok(), true, 'a second press within the ten seconds leaves'); assert.equal(told, 1);
  assert.equal(ok(), false, 'and the question starts again for the next half-written answer'); now += 10001; assert.equal(ok(), false, 'a press after the ten seconds is a first press again'); assert.equal(told, 3);
  ok.reset(); now += 10; assert.equal(ok(), false, 'reset forgets a first press'); dirty = false; assert.equal(ok(), true, 'nothing unsaved: never asks'); assert.equal(told, 4);
  dirty = true; assert.equal(ok(), false, 'a clean pass in between does not count as the first press');
  // the answer forms of the Session tab and the Blind arena use the Train form's own rule
  assert.equal(MXAC.mentorUnsaved({ dirty: true, choice: 'WAIT', text: '' }), true); assert.equal(MXAC.mentorUnsaved({ dirty: true, choice: null, text: 'a word' }), true); assert.equal(MXAC.mentorUnsaved({ dirty: false, choice: 'WAIT', text: 'x' }), false);
});

test('a sitting of the Session tab is offered after a reload, and only an unfinished one', () => {
  const rows = MXAC.latestFirst([{ id: 'a', kind: 'replay', status: 'paused', updatedAt: '2026-11-11T10:00:00Z' }, { id: 'b', kind: 'session', status: 'paused', updatedAt: '2026-11-11T12:00:00Z' }, { id: 'c', kind: 'session', status: 'done', updatedAt: '2026-11-11T13:00:00Z' }]);
  assert.equal(MXAC.unfinished(rows).id, 'a', 'the default is still a Train replay'); assert.equal(MXAC.unfinished(rows, 'session').id, 'b', 'an ended sitting is not offered');
  assert.equal(MXAC.unfinished(rows, ['replay', 'session']).id, 'b', 'whichever was saved last'); assert.equal(MXAC.unfinished([{ id: 'c', kind: 'session', status: 'done' }], 'session'), null);
});

test('page wiring of round 3: Session saves its place and guards a verdict, Blind guards an answer and answers once, the draft comes back without browser storage', () => {
  const ui = src('assets/academy-ui.js'), tabs = src('assets/academy-tabs.js'), css = src('assets/academy.css');
  // one guard, three users; no copy of it in the sections
  assert.equal((ui.match(/= leaveGuard\(\{/g) || []).length, 1, 'Train'); assert.equal((tabs.match(/K\.leaveGuard\(\{/g) || []).length, 2, 'Session and Blind arena'); assert.doesNotMatch(tabs, /LEAVE_MS|asked = /);
  assert.match(ui, /root\.addEventListener\('beforeunload', \(e\) => \{ if \(UNSAVED\.some\(/); assert.equal((tabs.match(/K\.watchUnsaved\(/g) || []).length, 2);
  // Session: every way of leaving a half-written verdict or note asks first
  const sess = tabs.slice(tabs.indexOf('function sessionTab(sec, ctx)'));
  for (const re of [/if \(canMove\(\) && leave\(\)\) \{ leavePoint\(\); Z\.clock\.step\(1\); \}/, /if \(cs\.playing\) \{ Z\.clock\.pause\(\); draw\(\); return; \} if \(!leave\(\)\) return;/, /if \(!Z\.clock \|\| Z\.ended \|\| !leave\(\)\) return;/, /if \(!sure && Z\.clock && !leave\(\)\) return;/, /if \(Z\.busy \|\| \(Z\.clock && !leave\(\)\)\) return;/, /Z\.clock\.state\(\)\.playing \|\| !leave\(\)\) return;/, /set: \(v\) => \{ myEdge = v; \}, leave \}/]) assert.match(sess, re);
  // Session: the place is saved with every decision (the first save comes before the attempt and carries the setup), and a failed save never costs the decision
  assert.match(sess, /const firstSave = !Z\.sessionId; if \(firstSave\) await save\(true, null, c\.id\);/);
  assert.match(sess, /if \(!firstSave\) \{ try \{ await save\(true\); \} catch \(e2\) \{ warn = /);
  assert.match(sess, /cur: Z\.cur \? Z\.cur\.cand\.id : curId \|\| null/);
  assert.equal((sess.match(/action: 'session\.save'/g) || []).length, 1, 'one way of saving');
  // Session resume: reads only (the stored attempt of this sitting, its verdict), the snapshot rebuilt at the setup's own time, no decision made again
  const rp = sess.slice(sess.indexOf('async function restorePoint(candId)'), sess.indexOf('// a note at the replay time'));
  assert.ok(rp.length > 500); assert.doesNotMatch(rp, /api\.post|decide\(|K\.decideOn|get: 'outcome'/); assert.match(rp, /K\.snapOf\(Z\.edge, Z\.series, Z\.dataVersion, c\.t, c\)/); assert.match(rp, /a\.sessionId === Z\.sessionId && a\.decision/);
  // Blind arena: the guard on the two ways an answer can be lost; one answer a setup; a setup shown in Train or Session since is recall
  const blind = tabs.slice(tabs.indexOf('function blindTab(sec, ctx)'), tabs.indexOf('// ---- Session training'));
  assert.match(blind, /if \(B\.busy \|\| !leave\(\)\) return;/); assert.match(blind, /set: \(v\) => \{ myEdge = v; \}, leave \}/);
  assert.match(blind, /catch \(e2\) \{ if \(e2\.status !== 409\) throw e2; B\.done\.add\(c\.id\); await already\(c\);/);
  assert.match(blind, /K\.decided\(c\.id, B\.pool, 'blind'\);/); assert.match(ui, /decidedAs\(c\.id, S\.pool, again \? 'replay-same' : 'train'\)/); assert.match(sess, /K\.decided\(c\.id, Z\.pool, again \? 'replay-same' : 'train'\)/);
  assert.doesNotMatch(blind, /get: 'attempts'|get: 'dataset'/, 'the arena never asks the server for a stored decision');
  assert.equal((blind.match(/id: 'bl-next'/g) || []).length, 2, '"Next setup" is built only where an answer is already stored (both answers shown, or the server said it had one)');
  // the lesson draft on resume: made again from stored things, never from the browser
  assert.match(ui, /S\.cur\.lesson = MXA\.lessons\.fromCorrection\(S\.cur\.first\.decision, Object\.assign\(\{\}, S\.cur\.correction, \{ sessionId: S\.sessionId \}\), f\);/);
  assert.match(ui, /const PREFS = \['mxacEdge', 'mxacFold', 'ms-phone'\];/, 'the storage allowlist holds display preferences only (the site\'s phone view joined on 11 Nov 2026): no draft, no decision');
  assert.match(ui, /delete CACHE\.pool\[st\.edge\.id \+ '\|exam'\]; if \(!firstSave\) await keepPlace\(\);/, 'the exam list is dropped after an exam setup (it sat inside a comment in round 2)');
  assert.match(css, /\.card\.folded > :not\(\.c-h\):not\(\.fold-bar\) \{ display: none; \}/);
});

// ==== the phone's simple view (11 Nov 2026) ===================================================================================
test('phone simple view: every rule sits inside the 640 px query under the shared simple attribute, so a wider screen and the full view read none', () => {
  const css = src('assets/academy.css'), at = css.indexOf('/* ==== The phone\'s simple view'); assert.ok(at > 0, 'the block is there');
  assert.ok(!css.slice(0, at).includes('data-phone'), 'nothing before the block reads the attribute');
  const block = css.slice(at), open = block.indexOf('@media (max-width: 640px) {'); assert.ok(open > 0);
  // outside the query: only "these are not drawn"
  const before = block.slice(block.indexOf('*/') + 2, open).trim(); assert.equal(before, 'button.pmore, .pv { display: none; }');
  const body = block.slice(open + '@media (max-width: 640px) {'.length, block.lastIndexOf('}'));
  assert.equal(block.slice(block.lastIndexOf('}') + 1).trim(), '', 'the query closes the file');
  const rules = body.replace(/\/\*[^]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean); assert.ok(rules.length > 40);
  for (const line of rules) {
    assert.ok(!/@media/.test(line), 'no nested query');
    // every selector of every rule on the line: the switch (.pv, offered in both phone views) or under the simple attribute
    for (const rule of line.split('}').map((r) => r.trim()).filter(Boolean)) for (const sel of rule.slice(0, rule.indexOf('{')).split(/,(?![^(]*\))/).map((x) => x.trim())) assert.ok(/^\.pv\b/.test(sel) || sel.startsWith('html[data-phone="simple"] '), 'scoped: ' + sel);
  }
  assert.ok(!/animation|infinite/.test(body), 'no animation is added'); assert.ok(!/font(-size)?:[^;]*(?<![\d.])(1[01]|\d)(\.\d+)?px/.test(body), 'no text under 12 px');
});

test('phone simple view: the page sets the view before the first paint, the switch writes one of two words, and nothing is asked of the API', () => {
  const html = src('academy.html'), ui = src('assets/academy-ui.js'), tabs = src('assets/academy-tabs.js');
  // the site's convention (the Desk, the Macro desk, ChronosTrade): key ms-phone = "full", else simple; attribute only on a phone
  assert.match(html, /function set\(\) \{ var full = false; try \{ full = localStorage\.getItem\('ms-phone'\) === 'full'; \} catch \(e\) \{\} if \(mq && mq\.matches && !full\) R\.dataset\.phone = 'simple'; else delete R\.dataset\.phone; \}/, 'simple on a phone unless Full was chosen; a blocked storage means simple; never set on a wider screen');
  assert.match(html, /matchMedia\('\(max-width: 640px\)'\)/);
  assert.ok(html.indexOf("getItem('ms-phone')") < html.indexOf('href="/assets/academy.css"'), 'set in the head, before the stylesheet paints');
  assert.ok(!/localStorage\.(setItem|removeItem)/.test(html), 'the page head only reads: every write goes through the allowlisted helper');
  assert.match(html, /<div class="pv" id="pv"><span id="pv-l">Phone view<\/span>.*data-pv="simple"[^>]*>Simple<\/button>.*data-pv="full"[^>]*>Full<\/button>/);
  const block = ui.slice(ui.indexOf("// ---- the phone's simple view"), ui.indexOf('// ---- tabs ---'));
  assert.ok(block.length > 500); assert.ok(!/api\(|api\.|fetch|decide|lessons\.|attempt/.test(block), 'the simple view calls nothing and decides nothing');
  assert.match(block, /if \(v === 'full'\) prefSet\('ms-phone', 'full'\); else prefDel\('ms-phone'\);/);
  assert.match(block, /const TAB_MORE = \['research', 'models', 'costs', 'audit'\];/, 'Train, Session, Blind arena, Progress and Lessons stay in the bar');
  // nothing is removed from the page: the parts that wait are still built, only marked
  for (const id of ['edge-info', 'lessons-box', 'resume-box', 'c-restart', 'sess-save', 'sess-resume']) assert.match(html, new RegExp('class="[^"]*\\bpm\\b[^"]*" id="' + id + '"'), id + ' waits behind a "more" button');
  for (const id of ['htf-card', 'log-card', 'acct-card', 'thesis-card', 'exam']) assert.match(html, new RegExp('class="card[^"]*\\bpcard\\b[^"]*" id="' + id + '"'), id + ' folds to its heading');
  for (const id of ['edge-more', 'setup-more', 'ctl-more']) assert.match(html, new RegExp('class="btn[^"]* pmore" id="' + id + '" aria-expanded="false"'));
  assert.match(ui, /moreBtn\(box, 'm-more', /); assert.match(ui, /moreBtn\(box, 'dec-more', /);
  assert.match(ui, /role: 'tab', id: 'tab-' \+ id, class: TAB_MORE\.indexOf\(id\) >= 0 \? 'tab-2' : null,/, 'every section keeps its tab; the seldom-used ones are only marked');
  assert.match(tabs, /const PHONE_FOLD = \['ls-check', 'ls-drafts-card', 'pg-agree', 'pg-rvn', 'pg-mistakes', 'pg-queue', 'pg-attempts', 'rs-studies', 'rs-notebook', 'md-training'\];/);
  assert.match(tabs, /PHONE_FOLD\.indexOf\(id\) >= 0 && K\.pfold \? K\.pfold\(c, title\) : c;/, 'a folded card is the same card, with a chevron in its heading');
});
