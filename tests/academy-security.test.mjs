// node --test tests/academy-security.test.mjs — security and reliability of the MeridianX Academy. Offline.
// Access (every route, enumerated from the handler's own tables so a new route cannot be forgotten), request validation,
// storage (persistence, separation by edge, a failing store, the namespace), look-ahead, isolation from every trading and
// order path, and the pacing of the page's API wrapper.
//
// Tests marked `todo` state a defect in a file this test's owner does not edit, with the exact fix. They fail today on
// purpose and do not fail the run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { handle, _t } = require('../api/academy.js');
const ST = require('../api/_academy-store.js');
const S = require('../api/_session.js');
const MXR = require('../assets/academy-replay.js');
const MXA = require('../assets/academy-core.js');
const MXAC = require('../assets/academy-ui.js');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = (f) => JSON.parse(src(f));
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' }, MEMBERS = [{ u: 'fred', name: 'Fred', role: 'reviewer', ict: 'write', mcp: true }, { u: 'orlando', name: 'Orlando', role: 'reviewer' }, { u: 'luxus', name: 'Luxus', role: 'viewer' }, { u: 'Owner', role: 'owner' }, { u: 'owner ', role: 'owner' }, { role: 'owner' }];
const GETS = Object.keys(_t.GET), POSTS = Object.keys(_t.POST), T0 = 1715094900;
const DATA = _t.fileData(ROOT);
const usable = (c) => !(c.rule && (c.rule.clockShift || c.rule.pre2020));
const CAND = json('academy/data/cand-gmp.json').find((c) => c.id === 'gmp-1715094900s'), [EXAMC, EXAM2] = json('academy/data/cand-gmp.json').filter((c) => c.pool === 'exam' && c.t > 1714000000 && usable(c));

// one call to the real handler. o = { who, store, env, headers, sameOrigin (false = use the real Origin check), data }
let CLOCK = Date.UTC(2026, 10, 10, 12);
async function call(method, payload, o = {}) {
  const out = { headers: {} }, res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } };
  const deps = { env: o.env || {}, now: () => (CLOCK += 1000), data: o.data || DATA };
  if (o.store) deps.store = o.store; if (o.who !== undefined) deps.who = async () => o.who; if (o.sameOrigin !== false) deps.sameOrigin = () => true;
  const req = method === 'GET' ? { method, headers: o.headers || {}, query: payload } : { method, headers: o.headers || {}, body: payload };
  await handle(req, res, deps); return out;
}
const snapStore = (store) => JSON.stringify([...store.raw.entries()].sort());
const decision = (o = {}) => ({ action: 'SELL', entry: CAND.entry, stop: CAND.stop, target: CAND.target, t: CAND.t, market: 'xau', confidence: 'low', thesis: 'x', ...o });
const attempt = (o = {}, d = {}) => ({ action: 'attempt', attempt: { candidateId: CAND.id, edge: 'gmp', mode: 'train', decision: decision(d), lessonsAvailable: [], snapshotHash: 'abc123', ...o }, features: { session: 'overlap' } });
const LESSON = { edge: 'gmp', title: 'Wait in the overlap', text: '', when: [{ f: 'session', op: 'eq', v: 'overlap' }], then: { action: 'WAIT', adjust: {}, note: '' }, source: {} };
// a valid body for every POST action, in an order that works on a fresh store (each uses ids made by the ones before)
async function fill(store, o = {}) {
  const own = { who: OWNER, store, ...o }, ids = {}, done = [];
  const post = async (b) => { const r = await call('POST', b, own); assert.equal(r.code, 200, `${b.action}: ${JSON.stringify(r.body)}`); done.push(b.action); return r.body; };
  ids.attempt = (await post(attempt())).attempt.id;
  ids.correction = (await post({ action: 'correct', edge: 'gmp', correction: { attemptId: ids.attempt, verdict: 'change', action: 'WAIT', reasons: ['session'], text: 'no' } })).correction.id;
  ids.lesson = (await post({ action: 'lesson.save', lesson: LESSON })).lesson.id;
  ids.lesson2 = (await post({ action: 'lesson.revise', id: ids.lesson, patch: { title: 'Wait in the overlap, revised' } })).lesson.id;
  await post({ action: 'lesson.deactivate', id: ids.lesson2, active: false, reason: 'test' });
  await post({ action: 'lesson.stats', id: ids.lesson2, inc: { applied: 1 } });
  ids.session = (await post({ action: 'session.save', session: { edge: 'gmp', title: 't', state: { a: 1 } } })).session.id;
  await post({ action: 'seen', edge: 'gmp', id: 'gmp-1715883900b', mode: 'train' });
  await post(attempt({ candidateId: EXAMC.id, mode: 'exam' }, { entry: EXAMC.entry, stop: EXAMC.stop, target: EXAMC.target, t: EXAMC.t, action: EXAMC.side === 'buy' ? 'BUY' : 'SELL' }));
  await post({ action: 'exam.result', result: { edge: 'gmp', candidateId: EXAMC.id, lessonIds: [], withLessons: { action: 'WAIT' }, withoutLessons: { action: 'WAIT' } } });
  await post(attempt({ candidateId: 'gmp-1715159400s', mode: 'blind' }, { action: 'WAIT' }));
  await post({ action: 'blind.submit', blind: { edge: 'gmp', candidateId: 'gmp-1715159400s', action: 'WAIT', text: 'x' } });
  await post({ action: 'miss', miss: { edge: 'gmp', t: T0, kind: 'right-wait', text: '' } });
  await post({ action: 'notebook.add', note: { title: 'n', hypothesis: 'h', dataset: 'd', method: 'm', validation: 'hypothesis' } });
  ids.model = (await post({ action: 'model.register', model: { name: 'scorer', version: '1', metrics: { auc: 0.5 } } })).model.id;
  await post({ action: 'model.promote', id: ids.model, confirm: true });
  await post({ action: 'model.rollback', confirm: true });
  await post({ action: 'explain', question: 'why?' });
  // leave a champion in place, so that a promotion and a rollback are both possible next
  await post({ action: 'model.promote', id: (await post({ action: 'model.register', model: { name: 'baseline', version: '1' } })).model.id, confirm: true });
  return { ids, done };
}
// a body for each POST action that would be accepted from the owner (ids from a filled store)
const validBodies = (ids) => ({
  attempt: attempt({ candidateId: 'gmp-1715009700s' }), correct: { action: 'correct', edge: 'gmp', correction: { attemptId: ids.attempt, verdict: 'approve' } }, 'lesson.save': { action: 'lesson.save', lesson: LESSON },
  'lesson.revise': { action: 'lesson.revise', id: ids.lesson2, patch: { title: 'again' } }, 'lesson.deactivate': { action: 'lesson.deactivate', id: ids.lesson2, active: true }, 'lesson.stats': { action: 'lesson.stats', id: ids.lesson2, inc: { applied: 1 } },
  'session.save': { action: 'session.save', session: { edge: 'gmp', state: {} } }, seen: { action: 'seen', edge: 'gmp', id: 'gmp-1715932200b', mode: 'train' }, 'exam.result': { action: 'exam.result', result: { edge: 'gmp', candidateId: EXAM2.id, lessonIds: [], withLessons: { action: 'WAIT' }, withoutLessons: { action: 'WAIT' } } },
  'blind.submit': { action: 'blind.submit', blind: { edge: 'gmp', candidateId: 'gmp-1715694000b', action: 'WAIT', text: 'x' } }, miss: { action: 'miss', miss: { edge: 'gmp', t: T0, kind: 'right-wait' } },
  'notebook.add': { action: 'notebook.add', note: { title: 'n2', hypothesis: 'h', dataset: 'd', method: 'm', validation: 'hypothesis' } }, 'model.register': { action: 'model.register', model: { name: 'scorer', version: '2' } },
  'model.promote': { action: 'model.promote', id: ids.model, confirm: true }, 'model.rollback': { action: 'model.rollback', confirm: true }, explain: { action: 'explain', question: 'why?' },
});
const getQuery = (name, ids) => ({ get: name, edge: 'gmp', id: name === 'session' ? ids.session : name === 'research' ? '' : CAND.id, cand: CAND.id, t: String(T0), month: '2026-11' });
// no stack, no file path, no module name in anything the API says
const LEAK = /\n\s+at |\bat [\w.<>]+ \(|[A-Za-z]:\\|\/(home|tmp|var|usr|opt|root|vercel)\/|node:|\.m?js\b|node_modules|ENOENT|EACCES|TypeError|ReferenceError|SyntaxError/;
const clean = (r, what) => { if (r.code < 400) return; assert.deepEqual(Object.keys(r.body), ['error'], `${what}: an error answer is { error } and nothing else`); const t = String(r.body.error); assert.ok(!LEAK.test(t) && t.length < 400, `${what}: the answer leaks an internal detail: ${t.slice(0, 200)}`); };

// ==== access =================================================================================================================
test('the handler exports its routes: the tables this file walks are the ones the handler dispatches on', () => {
  assert.ok(GETS.length >= 20 && POSTS.length >= 16, `${GETS.length} GET, ${POSTS.length} POST`);
  const head = src('api/academy.js').slice(0, 4000); for (const n of [...GETS, ...POSTS]) assert.ok(head.includes(n), `${n} is documented in the file header`);
  assert.match(src('api/academy.js'), /Object\.prototype\.hasOwnProperty\.call\(GET, q\.get \|\| ''\)/); assert.match(src('api/academy.js'), /Object\.prototype\.hasOwnProperty\.call\(POST, b\.action\)/);
});

test('every GET name and every POST action answers 401 without a session and writes nothing', async () => {
  const store = ST.memoryStore(), { ids } = await fill(store), before = snapStore(store), bodies = validBodies(ids);
  assert.deepEqual(Object.keys(bodies).sort(), POSTS.slice().sort(), 'a body is listed for every POST action: add one when a route is added');
  for (const name of GETS) { const r = await call('GET', getQuery(name, ids), { who: null, store }); assert.equal(r.code, 401, `GET ${name}`); assert.deepEqual(r.body, { error: 'sign in first' }); assert.equal(r.headers['Cache-Control'], 'private, no-store'); }
  for (const name of POSTS) { const r = await call('POST', bodies[name], { who: null, store }); assert.equal(r.code, 401, `POST ${name}`); assert.deepEqual(r.body, { error: 'sign in first' }); }
  assert.equal(snapStore(store), before, 'nothing was written');
  // and through the real session reader: no cookie, a made-up cookie, a cookie signed with another secret
  const env = { SESSION_SECRET: 'a-test-secret-of-32-characters!!' }, forged = S.sign({ SESSION_SECRET: 'another-secret-of-32-characters!' }, { v: 1, u: 'owner', n: 'Owner', r: 'owner', f: 'x', pv: 1, iat: Date.now(), exp: Date.now() + 1e6 });
  for (const cookie of [undefined, 'ms_session=nonsense', 'ms_session=' + encodeURIComponent(forged), 'ms_session=' + encodeURIComponent(Buffer.from(JSON.stringify({ u: 'owner' })).toString('base64url') + '.AAAA')]) {
    for (const name of ['edges', 'lessons', 'audit']) assert.equal((await call('GET', getQuery(name, ids), { store, env, headers: cookie ? { cookie } : {} })).code, 401, `GET ${name} with ${cookie ? cookie.slice(0, 24) : 'no cookie'}`);
    assert.equal((await call('POST', bodies['lesson.save'], { store, env, headers: cookie ? { cookie } : {} })).code, 401);
  }
  assert.equal(snapStore(store), before);
});

test('every GET name and every POST action answers 403 for a signed-in member who is not the owner, and writes nothing', async () => {
  const store = ST.memoryStore(), { ids } = await fill(store), before = snapStore(store), bodies = validBodies(ids);
  for (const who of MEMBERS) {
    for (const name of GETS) { const r = await call('GET', getQuery(name, ids), { who, store }); assert.equal(r.code, 403, `GET ${name} as ${who.u}`); assert.deepEqual(r.body, { error: 'the Academy is for the owner only' }); }
    for (const name of POSTS) { const r = await call('POST', bodies[name], { who, store }); assert.equal(r.code, 403, `POST ${name} as ${who.u}`); assert.deepEqual(r.body, { error: 'the Academy is for the owner only' }); }
  }
  assert.equal(snapStore(store), before, 'nothing was written');
  // a member with every permission the Desk can give is still not the owner
  assert.equal((await call('GET', { get: 'edges' }, { who: { u: 'fred', role: 'owner', perms: { council: true, ict: 'write', mcp: true }, owner: true }, store })).code, 403);
});

test('a POST from another origin is 403 for every action, even with the owner\'s session; other methods are 405', async () => {
  const store = ST.memoryStore(), { ids } = await fill(store), before = snapStore(store), bodies = validBodies(ids);
  for (const origin of ['https://evil.example', 'https://meridianx.dev.evil.example', 'http://meridianx.dev:8080', 'null', 'not a url'])
    for (const name of POSTS) { const r = await call('POST', bodies[name], { who: OWNER, store, sameOrigin: false, headers: { origin, host: 'meridianx.dev' } }); assert.equal(r.code, 403, `${name} from ${origin}`); assert.deepEqual(r.body, { error: 'not allowed' }); }
  assert.equal(snapStore(store), before, 'nothing was written');
  // the same site passes the origin check (and is then judged on its session)
  assert.equal((await call('POST', bodies['lesson.save'], { who: OWNER, store, sameOrigin: false, headers: { origin: 'https://meridianx.dev', host: 'meridianx.dev' } })).code, 200);
  assert.equal((await call('POST', bodies['lesson.save'], { who: null, store, sameOrigin: false, headers: { origin: 'https://meridianx.dev', host: 'meridianx.dev' } })).code, 401);
  for (const method of ['PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) { const r = await call(method, {}, { who: OWNER, store }); assert.equal(r.code, 405, method); assert.equal(r.headers.Allow, 'GET, POST'); }
  // the order of the locks: method, origin, session, owner. None of them reads the store or the body first.
  const h = src('api/academy.js'), a = h.indexOf('async function handle('), body = h.slice(a, h.indexOf('\n}\n', a));
  const at = (s) => { const i = body.indexOf(s); assert.ok(i > 0, s); return i; };
  assert.ok(at("req.method !== 'GET' && req.method !== 'POST'") < at('sameOrigin') && at('sameOrigin') < at("if (!acct) return res.status(401)") && at("if (!acct) return res.status(401)") < at("if (acct.u !== 'owner') return res.status(403)") && at("if (acct.u !== 'owner') return res.status(403)") < at('context(req, d, env, acct)') && at('context(req, d, env, acct)') < at('bodyOf(req)'));
});

// ==== request validation =====================================================================================================
const deep = (n) => { let o = { leaf: 1 }; for (let i = 0; i < n; i++) o = { o }; return o; };
const BAD_IDS = ['../../etc/passwd', '..', 'a/b', '/abs/path', 'x\\y', 'gmp.json/../x', '.hidden', 'a b', 'id\u0000null', 'id\nnewline', '', 'x'.repeat(121), '%2e%2e%2f', 'a?b=c', 'a#b', '<script>', 42, null, {}, ['a']];
const BAD_EDGES = ['../attempts', 'GMP', 'gmp/..', 'gmp.json', 'nope', 'gmp\u0000', ' gmp', 'gmp ', '..', 'a'.repeat(41), '__proto__', 'constructor', 42, {}, ['gmp'], null];
test('request validation: wrong types, missing fields and unknown names are refused with a 4xx and nothing is written', async () => {
  const store = ST.memoryStore(), { ids } = await fill(store), before = snapStore(store), own = { who: OWNER, store };
  const bad = [
    ['an unknown action', { action: 'nope' }], ['no action', {}], ['an action that is an object', { action: { $ne: 1 } }], ['an action named like an object method', { action: 'toString' }], ['hasOwnProperty as an action', { action: 'hasOwnProperty' }], ['__proto__ as an action', { action: '__proto__' }], ['constructor as an action', { action: 'constructor' }],
    ['attempt as text', { action: 'attempt', attempt: 'x' }], ['attempt as a list', { action: 'attempt', attempt: [] }], ['a decision time that is text', attempt({}, { t: 'now' })], ['a decision time that is not finite', attempt({}, { t: Infinity })], ['an entry that is text', attempt({}, { entry: '2300' })],
    ['an unknown action word', attempt({}, { action: 'HOLD' })], ['an unknown mode', attempt({ mode: 'live' })], ['a SELL without a stop', attempt({}, { stop: null })], ['a SELL with its stop below the entry', attempt({}, { stop: CAND.entry - 5 })], ['a target on the wrong side', attempt({}, { target: CAND.entry + 50 })],
    ['lessonsAvailable as text', attempt({ lessonsAvailable: 'ls_1' })], ['a list that is too long', attempt({ lessonsAvailable: Array.from({ length: 501 }, (_, i) => 'ls' + i) })], ['features as a list', { ...attempt(), features: [1, 2] }], ['a feature that is an object', { ...attempt(), features: { session: { $gt: '' } } }], ['a feature key with a space', { ...attempt(), features: { 'a b': 1 } }], ['201 features', { ...attempt(), features: Object.fromEntries(Array.from({ length: 201 }, (_, i) => ['f' + i, i])) }],
    ['reasons as text', { action: 'correct', edge: 'gmp', correction: { attemptId: ids.attempt, verdict: 'change', action: 'WAIT', reasons: 'session' } }], ['an unknown reason', { action: 'correct', edge: 'gmp', correction: { attemptId: ids.attempt, verdict: 'change', action: 'WAIT', reasons: ['because'] } }], ['an unknown verdict', { action: 'correct', edge: 'gmp', correction: { attemptId: ids.attempt, verdict: 'maybe' } }],
    ['a change without an action', { action: 'correct', edge: 'gmp', correction: { attemptId: ids.attempt, verdict: 'change' } }], ['a mentor BUY without a stop', { action: 'correct', edge: 'gmp', correction: { attemptId: ids.attempt, verdict: 'change', action: 'BUY', entry: 2300 } }], ['an error class with a slash', { action: 'correct', edge: 'gmp', correction: { attemptId: ids.attempt, verdict: 'approve', errorClass: '../x' } }],
    ['a lesson without a title', { action: 'lesson.save', lesson: { ...LESSON, title: '' } }], ['when as an object', { action: 'lesson.save', lesson: { ...LESSON, when: { f: 'session' } } }], ['an unknown operator', { action: 'lesson.save', lesson: { ...LESSON, when: [{ f: 'session', op: 'regex', v: '.*' }] } }], ['a condition value that is an object', { action: 'lesson.save', lesson: { ...LESSON, when: [{ f: 'session', op: 'eq', v: { $ne: null } }] } }],
    ['between without two numbers', { action: 'lesson.save', lesson: { ...LESSON, when: [{ f: 'rr', op: 'between', v: [3, 1] }] } }], ['an unknown effect', { action: 'lesson.save', lesson: { ...LESSON, then: { action: 'ORDER' } } }], ['a condition key that is a path', { action: 'lesson.save', lesson: { ...LESSON, when: [{ f: '../x', op: 'eq', v: 1 }] } }], ['21 conditions', { action: 'lesson.save', lesson: { ...LESSON, when: Array.from({ length: 21 }, () => LESSON.when[0]) } }],
    ['an empty patch', { action: 'lesson.revise', id: ids.lesson2, patch: {} }], ['a counter that does not exist', { action: 'lesson.stats', id: ids.lesson2, inc: { wins: 1 } }], ['a negative counter', { action: 'lesson.stats', id: ids.lesson2, inc: { applied: -1 } }], ['a huge counter', { action: 'lesson.stats', id: ids.lesson2, inc: { examNetWith: 1e9 } }], ['active as text', { action: 'lesson.deactivate', id: ids.lesson2, active: 'yes' }],
    ['a session id that is not one', { action: 'session.save', session: { id: '../../x', edge: 'gmp' } }], ['a session status that is unknown', { action: 'session.save', session: { edge: 'gmp', status: 'live' } }], ['a session kind with a slash', { action: 'session.save', session: { edge: 'gmp', kind: 'a/b' } }], ['session state as a list', { action: 'session.save', session: { edge: 'gmp', state: [1] } }],
    ['state nested too deeply', { action: 'session.save', session: { edge: 'gmp', state: deep(12) } }], ['a state with 501 keys', { action: 'session.save', session: { edge: 'gmp', state: Object.fromEntries(Array.from({ length: 501 }, (_, i) => ['k' + i, i])) } }], ['a state list of 5,001 items', { action: 'session.save', session: { edge: 'gmp', state: { a: Array.from({ length: 5001 }, () => 0) } } }], ['a number that is not finite in the state', { action: 'session.save', session: { edge: 'gmp', state: { a: NaN } } }],
    ['seen without ids', { action: 'seen', edge: 'gmp', mode: 'train' }], ['an exam result on a train setup', { action: 'exam.result', result: { edge: 'gmp', candidateId: CAND.id, withLessons: { action: 'WAIT' }, withoutLessons: { action: 'WAIT' } } }], ['a blind MANAGE answer', { action: 'blind.submit', blind: { edge: 'gmp', candidateId: CAND.id, action: 'MANAGE' } }],
    ['a miss time that is no time', { action: 'miss', miss: { edge: 'gmp', t: -5, kind: 'right-wait' } }], ['a missed opportunity without a stop', { action: 'miss', miss: { edge: 'gmp', t: T0, kind: 'missed', action: 'BUY', entry: 2300, text: 'x' } }], ['a validated note without a sample size', { action: 'notebook.add', note: { title: 'n', hypothesis: 'h', dataset: 'd', method: 'm', validation: 'validated' } }], ['an unknown validation', { action: 'notebook.add', note: { title: 'n', hypothesis: 'h', dataset: 'd', method: 'm', validation: 'proven' } }],
    ['a model registered as champion', { action: 'model.register', model: { name: 'x', version: '1', status: 'champion' } }], ['a promotion without confirm', { action: 'model.promote', id: ids.model }], ['confirm as text', { action: 'model.promote', id: ids.model, confirm: 'true' }], ['a rollback without confirm', { action: 'model.rollback' }], ['a question that is an object', { action: 'explain', question: { a: 1 } }], ['no question', { action: 'explain' }],
  ];
  for (const [what, body] of bad) { const r = await call('POST', body, own); assert.ok(r.code >= 400 && r.code < 500, `${what}: ${r.code} ${JSON.stringify(r.body).slice(0, 120)}`); assert.equal(typeof r.body.error, 'string'); clean(r, what); }
  // bodies that are not a JSON object at all
  for (const [what, body] of [['a list', [1, 2]], ['text that is not JSON', '{nope'], ['JSON null', 'null'], ['a JSON string', '"x"'], ['a number', 5], ['nothing', undefined], ['a buffer of rubbish', Buffer.from([0xff, 0xfe, 0x00])]]) { const r = await call('POST', body, own); assert.equal(r.code, 400, what); clean(r, what); }
  // GET: unknown names, bad numbers, bad months
  for (const [what, q] of [['an unknown get', { get: 'secrets' }], ['no get', {}], ['__proto__', { get: '__proto__' }], ['constructor', { get: 'constructor' }], ['toString', { get: 'toString' }], ['a pool that does not exist', { get: 'candidates', edge: 'gmp', pool: 'live' }], ['from that is not a number', { get: 'candidates', edge: 'gmp', from: 'abc' }], ['history without a time', { get: 'history', edge: 'gmp' }], ['a month that is a path', { get: 'audit', month: '../2026-11' }], ['a month that is not one', { get: 'audit', month: '2026-13' }], ['a calendar time that is text', { get: 'calendar', t: 'now' }]]) { const r = await call('GET', q, own); assert.equal(r.code, 400, what); clean(r, what); }
  assert.equal(snapStore(store), before, 'none of them wrote anything');
});

test('request validation: ids and edges that do not match their patterns, and path-like ids, are refused on every route that takes one', async () => {
  const store = ST.memoryStore(), { ids } = await fill(store), before = snapStore(store), own = { who: OWNER, store }, refused = (r, what) => { assert.ok(r.code >= 400 && r.code < 500, `${what}: ${r.code} ${JSON.stringify(r.body).slice(0, 100)}`); clean(r, what); };
  const withEdge = (e) => [attempt({ edge: e }), { action: 'correct', edge: e, correction: { attemptId: ids.attempt, verdict: 'approve' } }, { action: 'lesson.save', lesson: { ...LESSON, edge: e } }, { action: 'lesson.revise', id: ids.lesson2, patch: { edge: e } }, { action: 'session.save', session: { edge: e } }, { action: 'seen', edge: e, id: CAND.id, mode: 'train' },
    { action: 'exam.result', result: { edge: e, candidateId: EXAMC.id, withLessons: { action: 'WAIT' }, withoutLessons: { action: 'WAIT' } } }, { action: 'blind.submit', blind: { edge: e, candidateId: CAND.id, action: 'WAIT' } }, { action: 'miss', miss: { edge: e, t: T0, kind: 'right-wait' } }, { action: 'correct', edge: 'gmp', correction: { attemptId: ids.attempt, verdict: 'approve', edge: e } }];
  for (const e of BAD_EDGES) {
    if (e !== null) for (const body of withEdge(e)) refused(await call('POST', body, own), `${body.action} with edge ${JSON.stringify(e)}`);
    if (typeof e === 'string') for (const name of GETS.filter((n) => /edge\(q\.edge/.test(_t.GET[n].toString()))) { const r = await call('GET', { ...getQuery(name, ids), edge: e }, own); if (e === '' || (name === 'lessons' || name === 'research') && e === '') continue; refused(r, `GET ${name} with edge ${JSON.stringify(e)}`); }
  }
  assert.ok(GETS.filter((n) => /edge\(q\.edge/.test(_t.GET[n].toString())).length >= 12, 'the edge routes were found');
  const withId = (id) => [attempt({ candidateId: id }), attempt({ sessionId: id || 'a/b' }), attempt({ lessonsAvailable: [id] }), { action: 'correct', edge: 'gmp', correction: { attemptId: id, verdict: 'approve' } }, { action: 'lesson.revise', id, patch: { title: 't' } }, { action: 'lesson.deactivate', id }, { action: 'lesson.stats', id, inc: { applied: 1 } },
    { action: 'lesson.save', lesson: { ...LESSON, source: { attemptId: id || 'a/b' } } }, { action: 'seen', edge: 'gmp', ids: [id], mode: 'train' }, { action: 'exam.result', result: { edge: 'gmp', candidateId: id, withLessons: { action: 'WAIT' }, withoutLessons: { action: 'WAIT' } } }, { action: 'blind.submit', blind: { edge: 'gmp', candidateId: id, action: 'WAIT' } },
    { action: 'model.promote', id, confirm: true }, { action: 'session.save', session: { id: id || 'se_', edge: 'gmp' } }, { action: 'miss', miss: { edge: 'gmp', t: T0, kind: 'right-wait', sessionId: id || 'a/b' } }];
  for (const id of BAD_IDS) for (const body of withId(id)) refused(await call('POST', body, own), `${body.action} with id ${JSON.stringify(id)}`);
  for (const id of BAD_IDS.filter((x) => typeof x === 'string' && x)) for (const q of [{ get: 'outcome', id, edge: 'gmp' }, { get: 'outcome', id }, { get: 'attempts', edge: 'gmp', cand: id }, { get: 'corrections', edge: 'gmp', cand: id }, { get: 'history', edge: 'gmp', cand: id }, { get: 'session', id }, { get: 'misses', edge: 'gmp', session: id }]) refused(await call('GET', q, own), `GET ${q.get} with id ${JSON.stringify(id)}`);
  assert.equal(snapStore(store), before, 'nothing was written');
  // an id that is well formed but unknown is a plain 404, never a file read
  for (const body of [{ action: 'lesson.revise', id: 'ls_nope', patch: { title: 't' } }, { action: 'lesson.deactivate', id: 'ls_nope' }, { action: 'model.promote', id: 'md_nope', confirm: true }, { action: 'correct', edge: 'gmp', correction: { attemptId: 'at_nope', verdict: 'approve' } }, { action: 'session.save', session: { id: 'se_0000000000', edge: 'gmp' } }]) assert.equal((await call('POST', body, own)).code, 404, body.action);
  assert.equal((await call('GET', { get: 'session', id: 'se_0000000000' }, own)).code, 404); assert.equal(snapStore(store), before);
});

test('request validation: oversize bodies are refused before any work (413), by header, by text and by object', async () => {
  const store = ST.memoryStore(), own = { who: OWNER, store }, big = 'x'.repeat(257 * 1024);
  for (const [what, body, o] of [['a text body over 256 KB', JSON.stringify({ action: 'notebook.add', note: { title: big } }), {}], ['an object over 256 KB', { action: 'notebook.add', note: { title: 'n', hypothesis: big, dataset: 'd', method: 'm', validation: 'hypothesis' } }, {}], ['a declared length over 256 KB', { action: 'explain', question: 'q' }, { headers: { 'content-length': String(300 * 1024) } }], ['a buffer over 256 KB', Buffer.from(JSON.stringify({ action: 'explain', question: big })), {}]]) {
    const r = await call('POST', body, { ...own, ...o }); assert.equal(r.code, 413, what); assert.match(r.body.error, /too large \(256 KB at most\)/); clean(r, what);
  }
  assert.deepEqual(store.keys(), [], 'nothing was written'); assert.equal((await call('POST', { action: 'explain', question: 'x'.repeat(200 * 1024) }, own)).code, 200, 'just under the cap is read (and the question is cut to its field length)');
  // long text inside the cap is cut to the field's length, never stored whole
  const r = await call('POST', { action: 'notebook.add', note: { title: 't'.repeat(5000), hypothesis: 'h'.repeat(50000), dataset: 'd', method: 'm', validation: 'hypothesis' } }, own); assert.equal(r.code, 200); assert.equal(r.body.note.title.length, 160); assert.equal(r.body.note.hypothesis.length, 4000);
});

test('request validation: __proto__ / constructor / prototype keys and control characters never reach the store and never touch a prototype', async () => {
  const store = ST.memoryStore(), own = { who: OWNER, store };
  // as an attacker sends them: JSON text, so "__proto__" is an own key of the parsed body
  const evil = JSON.parse('{"action":"session.save","__proto__":{"polluted":1},"session":{"edge":"gmp","__proto__":{"polluted":2},"state":{"__proto__":{"polluted":3},"constructor":{"prototype":{"polluted":4}},"prototype":{"polluted":5},"deep":{"__proto__":{"polluted":6},"ok":1},"list":[{"__proto__":{"polluted":7},"ok":2}],"te\\u0000xt":"a\\u0000b\\u0007c\\u001fd"}}}');
  const r = await call('POST', JSON.stringify(evil), own); assert.equal(r.code, 200);
  const saved = store.peek(`sessions/${r.body.session.id}.json`), text = JSON.stringify(saved);
  assert.ok(!/__proto__|"constructor"|"prototype"|polluted/.test(text), text); assert.deepEqual(saved.state, { deep: { ok: 1 }, list: [{ ok: 2 }], text: 'abcd' }, 'the dangerous keys are dropped, the control characters stripped, the rest kept');
  assert.equal({}.polluted, undefined); assert.equal(Object.prototype.polluted, undefined); assert.equal([].polluted, undefined);
  for (const s of [store.raw.get(`sessions/${r.body.session.id}.json`), store.raw.get('sessions/index.json')]) assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(JSON.parse(JSON.stringify(s))) && !/\\u00(0[0-8bcef]|1[0-9a-f]|7f)/i.test(s), 'no control character is stored');
  // where a name is structural (a feature key, a counter, a metric, an action) it is refused outright
  const before = snapStore(store);
  for (const [what, body] of [['a __proto__ feature', JSON.parse('{"action":"attempt","attempt":' + JSON.stringify(attempt().attempt) + ',"features":{"__proto__":{"x":1}}}')], ['a __proto__ condition', { action: 'lesson.save', lesson: { ...LESSON, when: [{ f: '__proto__', op: 'ne', v: 1 }] } }], ['a __proto__ counter', JSON.parse('{"action":"lesson.stats","id":"ls_x","inc":{"__proto__":1}}')], ['a constructor counter', { action: 'lesson.stats', id: 'ls_x', inc: { constructor: 1 } }], ['a __proto__ metric', JSON.parse('{"action":"model.register","model":{"name":"m","version":"1","metrics":{"__proto__":1}}}')]]) {
    const x = await call('POST', typeof body === 'string' ? body : JSON.stringify(body), own); assert.ok(x.code >= 400 && x.code < 500, `${what}: ${x.code}`); clean(x, what);
  }
  assert.equal(snapStore(store), before); assert.equal({}.x, undefined);
  // control characters in every free-text field are stripped before they are stored; in an id or an edge they are refused (see the test above)
  const n = await call('POST', { action: 'notebook.add', note: { title: 'a\u0000b\u001b[31mred', hypothesis: 'h\u0007', dataset: 'd\u007f', method: 'm', validation: 'hypothesis', tags: ['t\u0001ag'] } }, own);
  assert.deepEqual([n.body.note.title, n.body.note.hypothesis, n.body.note.dataset, n.body.note.tags], ['ab[31mred', 'h', 'd', ['tag']]);
  const l = await call('POST', { action: 'lesson.save', lesson: { ...LESSON, title: 'T\u0000itle\r\n', text: 'x\u0008y', when: [{ f: 'session', op: 'eq', v: 'over\u0000lap' }], then: { action: 'WAIT', note: 'n\u0001ote' } } }, own);
  assert.deepEqual([l.body.lesson.title, l.body.lesson.text, l.body.lesson.when[0].v, l.body.lesson.then.note], ['Title', 'xy', 'overlap', 'note']);
  assert.ok(!/\\u00(0[0-8bcef]|1[0-9a-f]|7f)/i.test([...store.raw.values()].join('')), 'no control character anywhere in the store, the audit trail included');
});

// DEFECT in api/academy.js (only small route additions are this test's owner's to make there): whenOf() and featuresOf() take any
// name that matches KEY_NAME, and KEY_NAME matches the names every object inherits ("constructor", "toString", "valueOf",
// "hasOwnProperty" …). MXA.lessons.matches reads f[c.f], which for such a name is the inherited function, never null: a lesson
// `when: [{ f: 'constructor', op: 'ne', v: 'x' }]` therefore matches EVERY setup of its edge, i.e. it is a lesson with no
// condition, which the page's own validation forbids (the page refuses unknown feature keys; a direct API call does not).
// Owner-only, so not an access hole; it is a way to store a lesson that fires on everything.
// FIX: in api/academy.js, next to KEY_NAME: `const keyName = (k) => typeof k === 'string' && KEY_NAME.test(k) && !(k in Object.prototype);`
// and use it in whenOf (c.f), featuresOf (k) and the model metrics loop. Belt and braces in assets/academy-core.js matches():
// `const x = Object.prototype.hasOwnProperty.call(f, c.f) ? f[c.f] : null;`.
test('a lesson condition or a feature named like an inherited object member ("constructor", "toString") is refused', { todo: 'api/academy.js whenOf / featuresOf: refuse keys that are `in Object.prototype` (see the comment above this test)' }, async () => {
  const store = ST.memoryStore(), own = { who: OWNER, store };
  for (const f of ['constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
    const r = await call('POST', { action: 'lesson.save', lesson: { ...LESSON, when: [{ f, op: 'ne', v: 'x' }] } }, own); assert.ok(r.code >= 400 && r.code < 500, `condition on "${f}": ${r.code}`);
    const a = await call('POST', { ...attempt(), features: { [f]: 1 } }, own); assert.ok(a.code >= 400 && a.code < 500, `feature "${f}": ${a.code}`);
  }
});
test('what that defect means, and that the page is not open to it: such a lesson would match every setup; the page\'s validation refuses the key', () => {
  const always = { id: 'x', edge: 'gmp', version: 1, active: true, when: [{ f: 'constructor', op: 'ne', v: 'x' }], then: { action: 'WAIT' } };
  assert.equal(MXA.lessons.matches(always, { session: 'asia' }), true, 'the core reads the inherited member (reported with the fix above)');
  assert.ok(MXA.lessons.validate(always).some((e) => /unknown feature key "constructor"/.test(e)), 'the page validates a lesson before it is saved and refuses this one');
  assert.match(src('assets/academy-ui.js'), /const errs = MXA\.lessons\.validate\(L\)/);
});

test('no answer of the API carries a stack, a file path or an internal error text, whatever goes wrong inside', async () => {
  const boom = () => { throw new Error(`ENOENT: no such file or directory, open '${ROOT}/academy/data/cand-gmp.json' at Object.readFileSync (node:fs:441:20)`); };
  const broken = { ...DATA, edges: boom, candidates: boom, outcomes: boom, features: boom, calendar: boom, research: boom, evaluation: boom, training: boom }, store = ST.memoryStore();
  for (const name of GETS) { const r = await call('GET', getQuery(name, { session: 'se_0000000000' }), { who: OWNER, store, data: broken }); clean(r, `GET ${name} on broken data`); if (r.code >= 500) assert.deepEqual(r.body, { error: 'the Academy is unavailable' }, name); }
  const r = await call('POST', attempt(), { who: OWNER, store, data: broken }); assert.equal(r.code, 500); assert.deepEqual(r.body, { error: 'the Academy is unavailable' });
  // a store that fails says so in the same plain words for every route
  const dead = ST.memoryStore(); dead.backend.read = async () => { throw new Error(`EACCES: permission denied, open '/var/task/academy/lessons.json'`); };
  for (const name of GETS) { const x = await call('GET', getQuery(name, { session: 'se_0000000000' }), { who: OWNER, store: dead }); clean(x, `GET ${name} on a dead store`); assert.ok(x.code === 200 || x.code === 503 || x.code === 400 || x.code === 403, `${name}: ${x.code}`); if (x.code === 503) assert.deepEqual(x.body, { error: 'the Academy store is unavailable: nothing was saved' }); }
  // no storage configured at all
  const none = await call('GET', { get: 'lessons' }, { who: OWNER, env: {} }); assert.equal(none.code, 503); assert.deepEqual(none.body, { error: 'storage not set up' });
});

// ==== storage ================================================================================================================
test('storage: lessons, attempts and corrections survive a new handler context on the same directory', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-sec-')), env = { ACADEMY_STORE_DIR: dir }, own = { who: OWNER, env };
  const a = await call('POST', attempt(), own), k = await call('POST', { action: 'correct', edge: 'gmp', correction: { attemptId: a.body.attempt.id, verdict: 'change', action: 'WAIT', reasons: ['session'], text: 'no' } }, own), l = await call('POST', { action: 'lesson.save', lesson: LESSON }, own);
  assert.deepEqual([a.code, k.code, l.code], [200, 200, 200]);
  // a fresh copy of the handler module and of the store module: no object of the first context is left
  for (const key of Object.keys(require.cache)) if (/[\\/]api[\\/]_?academy/.test(key)) delete require.cache[key];
  const fresh = require('../api/academy.js'); assert.notEqual(fresh.handle, handle);
  const get = async (q) => { const out = {}, res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } }; await fresh.handle({ method: 'GET', headers: {}, query: q }, res, { env, who: async () => OWNER, data: fresh._t.fileData(ROOT) }); return out.body; };
  assert.deepEqual((await get({ get: 'attempts', edge: 'gmp', cand: CAND.id })).attempts, [a.body.attempt]); assert.deepEqual((await get({ get: 'corrections', edge: 'gmp' })).corrections, [k.body.correction]); assert.deepEqual((await get({ get: 'lessons', edge: 'gmp' })).lessons, [l.body.lesson]);
  assert.deepEqual((await get({ get: 'audit', month: '2026-11' })).rows.map((r) => r.action), ['lesson.save', 'correct', 'attempt']); assert.equal((await get({ get: 'progress', edge: 'gmp' })).counts.attempts, 1);
  // on disk: plain JSON files under the directory, written whole (no temp file left behind)
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(dir, path.join(d, e.name)).replace(/\\/g, '/')]));
  assert.deepEqual(walk(dir).sort(), ['attempts/gmp.json', 'audit/2026-11.json', 'corrections/gmp.json', 'dataset/gmp.json', 'lessons.json', 'seen/gmp.json']); for (const f of walk(dir)) JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  // a file that is there but cannot be parsed is an error (503), never read as "empty" and then overwritten
  fs.writeFileSync(path.join(dir, 'lessons.json'), '{"v":1,"rows":[{"id":"ls_'); const cut = fs.readFileSync(path.join(dir, 'lessons.json'), 'utf8');
  assert.equal((await call('GET', { get: 'lessons' }, own)).code, 503); assert.equal((await call('POST', { action: 'lesson.save', lesson: LESSON }, own)).code, 503); assert.equal(fs.readFileSync(path.join(dir, 'lessons.json'), 'utf8'), cut, 'the damaged file was not replaced by an empty one');
});

test('storage: two edges never share a file, and one edge never reads the other\'s rows', async () => {
  const store = ST.memoryStore(), own = { who: OWNER, store }, nq = json('academy/data/cand-nq-open.json').find((c) => c.pool !== 'exam' && !(c.rule && (c.rule.clockShift || c.rule.pre2020)) && c.t > 1700000000);
  await fill(store);
  const nqDecision = { action: nq.side === 'buy' ? 'BUY' : 'SELL', entry: nq.entry, stop: nq.stop, target: nq.target, t: nq.t, market: 'nas100' };
  const a = await call('POST', { action: 'attempt', attempt: { candidateId: nq.id, edge: 'nq-open', mode: 'train', decision: nqDecision, snapshotHash: 'h' }, features: { session: 'overlap' } }, own); assert.equal(a.code, 200, JSON.stringify(a.body));
  await call('POST', { action: 'correct', edge: 'nq-open', correction: { attemptId: a.body.attempt.id, verdict: 'approve' } }, own); await call('POST', { action: 'miss', miss: { edge: 'nq-open', t: nq.t, kind: 'right-wait' } }, own); await call('POST', { action: 'lesson.save', lesson: { ...LESSON, edge: 'nq-open', title: 'nq only' } }, own);
  for (const kind of ['attempts', 'corrections', 'dataset', 'seen', 'misses']) { assert.ok(store.keys().includes(`${kind}/gmp.json`) && store.keys().includes(`${kind}/nq-open.json`), kind); assert.ok(!JSON.stringify(store.peek(`${kind}/gmp.json`)).includes(nq.id), `${kind}/gmp.json holds no nq-open row`); assert.ok(!JSON.stringify(store.peek(`${kind}/nq-open.json`)).includes('gmp-'), `${kind}/nq-open.json holds no gmp row`); }
  for (const name of ['attempts', 'corrections', 'misses', 'exams', 'dataset', 'blind']) { const g = (await call('GET', { get: name, edge: 'gmp' }, own)).body, n = (await call('GET', { get: name, edge: 'nq-open' }, own)).body; assert.ok(!JSON.stringify(g).includes(nq.id), `GET ${name}&edge=gmp`); assert.ok(!/gmp-\d/.test(JSON.stringify(n)), `GET ${name}&edge=nq-open`); }
  // the correction of one edge cannot be attached to an attempt of the other
  assert.equal((await call('POST', { action: 'correct', edge: 'gmp', correction: { attemptId: a.body.attempt.id, verdict: 'approve' } }, own)).code, 404);
  // lessons are one file by design (a lesson may hold for every edge), and each edge is given only its own and the global ones
  const L = (e) => call('GET', { get: 'lessons', edge: e }, own).then((r) => r.body.lessons.map((l) => l.edge));
  assert.ok((await L('gmp')).every((e) => e === 'gmp' || e === '*')); assert.deepEqual(await L('nq-open'), ['nq-open']); assert.deepEqual(await L('gtl'), []);
  assert.equal((await call('GET', { get: 'progress', edge: 'nq-open' }, own)).body.counts.attempts, 1); assert.equal((await call('GET', { get: 'progress', edge: 'gtl' }, own)).body.counts.attempts, 0);
  // an attempt whose decision names another edge than its attempt is refused
  assert.equal((await call('POST', attempt({}, { edge: 'nq-open' }), own)).code, 400);
});

// a store whose n-th write fails (1 = the first write of the call)
function failingStore(seed, failAt) {
  const store = ST.memoryStore(seed), real = store.backend.write; let n = 0;
  store.backend.write = async (k, v) => { n++; if (n === failAt) throw new Error(`blob write 500 for academy/${k} (token vercel_blob_rw_XXXX)`); return real(k, v); };
  return { store, writes: () => n, heal: () => { failAt = Infinity; } };
}
const seedOf = async () => { const s = ST.memoryStore(), f = await fill(s); return { seed: Object.fromEntries([...s.raw.entries()].map(([k, v]) => [k, JSON.parse(v)])), ids: f.ids }; };
test('storage: a failed store write answers 503 in plain words and leaves the earlier state intact (the write that fails is the first of the call)', async () => {
  const { seed, ids } = await seedOf(), bodies = validBodies(ids);
  for (const name of POSTS.filter((n) => n !== 'explain')) {   // explain writes nothing while the adapter is off
    const f = failingStore(seed, 1), before = snapStore(f.store), r = await call('POST', bodies[name], { who: OWNER, store: f.store });
    assert.equal(r.code, 503, `${name}: ${JSON.stringify(r.body)}`); assert.deepEqual(r.body, { error: 'the Academy store is unavailable: nothing was saved' }, 'no token, no key, no file name in the answer'); assert.equal(snapStore(f.store), before, `${name}: the earlier state is intact`); assert.equal(f.writes(), 1);
    // and the same call succeeds once the store works again: nothing was half done
    f.heal(); const again = await call('POST', bodies[name], { who: OWNER, store: f.store }); assert.equal(again.code, 200, `${name} again: ${JSON.stringify(again.body)}`); assert.notEqual(snapStore(f.store), before);
  }
  // a failed READ is a 503 too and writes nothing (a missing file is the only thing read as empty)
  const s2 = ST.memoryStore(seed), before = snapStore(s2); s2.backend.read = async () => { throw new Error('blob read 500'); };
  for (const name of POSTS.filter((n) => n !== 'explain')) { const r = await call('POST', bodies[name], { who: OWNER, store: s2 }); assert.equal(r.code, 503, name); } assert.equal(snapStore(s2), before);
});

// DEFECT in api/_academy-store.js (not this test's owner's to edit), make() → tx(): the files of one write step are written
// one after the other (`for (const [k, v] of steps) await write(k, v);`). When a LATER write fails the earlier ones stay:
// the call answers 503 "nothing was saved" although part of it was. For `attempt` (attempts → seen → dataset → audit): the
// attempt row is stored without its seen entry or its audit row; the page offers "Try again", and the retry stores the same
// decision a second time as attempt n + 1.
// FIX: in tx(), remember what each file held before the step and put it back when a write fails:
//   const undo = []; try { for (const [k, v] of steps) { undo.push([k, await backend.read(k)]); await write(k, v); } }
//   catch (e) { for (const [k, old] of undo.reverse()) { try { if (old !== undefined) await backend.write(k, old); else if (backend.remove) await backend.remove(k); } catch (e2) { /* best effort */ } } throw e; }
// (reads of every file were already made before the first write, so `got` can be reused instead of reading again; a file that
// did not exist before needs a `remove` on each backend, or an empty row file written back.) The audit file is last in every
// step, so "no audit row" stays the mark of a step that did not complete.
test('storage: a store write that fails in the middle of a several-file step leaves the earlier state intact', { todo: 'api/_academy-store.js tx(): roll back the files already written when a later write of the same step fails (see the comment above this test)' }, async () => {
  const { seed, ids } = await seedOf(), bodies = validBodies(ids);
  for (const name of ['attempt', 'correct', 'exam.result', 'blind.submit', 'session.save']) for (const at of [2, 3]) {
    const f = failingStore(seed, at), before = snapStore(f.store), r = await call('POST', bodies[name], { who: OWNER, store: f.store });
    if (f.writes() < at) continue;   // this action writes fewer files
    assert.equal(r.code, 503, name); assert.equal(snapStore(f.store), before, `${name}, write ${at} failed: the files written before it are still changed`);
  }
});
test('what that defect means today: after a mid-step failure the audit trail has no row for the half-written step, so it can be found', async () => {
  const { seed, ids } = await seedOf(), f = failingStore(seed, 2), auditBefore = f.store.raw.get('audit/2026-11.json');
  const r = await call('POST', validBodies(ids).attempt, { who: OWNER, store: f.store }); assert.equal(r.code, 503);
  assert.equal(f.store.raw.get('audit/2026-11.json'), auditBefore, 'the audit file is the last write of every step: a step that did not finish is not in it');
});

test('storage: every key lies in the Academy\'s own namespace, on every backend', async () => {
  // the key check: lower-case relative .json paths only
  for (const k of ['../users.json', '/etc/passwd', 'a/../b.json', '..', 'users/list.json/../../x.json', 'A.json', 'a b.json', 'a.txt', 'a.json/', '.env', 'a\\b.json', 'a\u0000.json', '', 'x'.repeat(161) + '.json', 'profiles/%2e%2e/x.json', 5, null, {}]) assert.throws(() => ST.checkKey(k), /bad store key/, JSON.stringify(k));
  for (const k of ['lessons.json', 'attempts/gmp.json', 'attempts/nq-open-archive-3.json', 'sessions/se_abc123.json', 'audit/2026-11.json']) assert.equal(ST.checkKey(k), k);
  assert.equal(ST.ROOT, 'academy/');
  // every key the API ever writes, for every action
  const store = ST.memoryStore(); await fill(store);
  const KINDS = /^(lessons|blind|notebook|models|cost|llm-cache)\.json$|^(attempts|corrections|seen|exams|dataset|misses)\/(gmp|nq-open|replica|mosha-bo|gtrend|gtl|geg)(-archive-\d+)?\.json$|^sessions\/(index|se_[a-z0-9]{8,40})\.json$|^audit\/\d{4}-(0[1-9]|1[0-2])(-archive-\d+)?\.json$/;
  for (const k of store.keys()) assert.match(k, KINDS, k); assert.ok(store.keys().length >= 12);
  // the Blob backend: every list, read and put is under academy/, private, never with a random suffix; nothing else in the store is touched
  const seen = [], files = new Map(), blob = { list: async (o) => { seen.push(['list', o.prefix]); return { blobs: [...files.keys()].filter((k) => k.startsWith(o.prefix)).map((k) => ({ pathname: k, url: 'https://blob.invalid/' + k, uploadedAt: new Date(0).toISOString() })) }; }, put: async (p, body, o) => { seen.push(['put', p, o.access, o.addRandomSuffix]); files.set(p, body); return {}; } };
  const bs = ST.blobStore({ BLOB_READ_WRITE_TOKEN: 'test-token' }, { blob, fetch: async (url) => { const k = String(url).replace('https://blob.invalid/', ''); seen.push(['read', k]); return { ok: files.has(k), status: files.has(k) ? 200 : 404, json: async () => JSON.parse(files.get(k)) }; }, recent: new Map(), tails: new Map() });
  await fill(bs);
  assert.ok(seen.length > 40 && [...files.keys()].length >= 12); for (const k of files.keys()) assert.match(k.replace(/^academy\//, ''), KINDS, k);
  for (const [op, p, access, suffix] of seen) { assert.ok(p.startsWith('academy/') && !p.includes('..'), `${op} ${p}`); if (op === 'put') { assert.equal(access, 'private'); assert.equal(suffix, false); } }
  assert.ok(!seen.some(([, p]) => /^(users|profiles|notices|sounds|push)\//.test(p)), 'the members\' list, the profiles, the notices, the sounds and the push store are never named');
  // the file store: nothing outside its directory
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-ns-')), dir = path.join(parent, 'store'); fs.mkdirSync(dir); await fill(undefined, { env: { ACADEMY_STORE_DIR: dir } });
  assert.deepEqual(fs.readdirSync(parent), ['store']); assert.ok(fs.readdirSync(dir).length >= 8);
  // on Vercel the directory setting is ignored: production always uses the private Blob store
  assert.match(src('api/academy.js'), /env\.ACADEMY_STORE_DIR && !env\.VERCEL \? ST\.fileStore\(env\.ACADEMY_STORE_DIR\) : env\.BLOB_READ_WRITE_TOKEN \? ST\.blobStore\(env\)/);
});

// ==== look-ahead =============================================================================================================
test('look-ahead: a snapshot never holds a bar that closes after its time, a candidate that fires later, an outcome, or a result of a scheduled release', () => {
  const MAN = json('tests/fixtures/academy/manifest.json');
  const series = Object.fromEntries(MXAC.TFS.map((tf) => [tf, json(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`).bars.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }))])), t = CAND.t;
  const base = { edge: 'gmp', market: 'xau', t, cand: CAND, series, dataVersion: 'x' }, snap = MXR.snapshot(base);
  // handed the WHOLE recorded series (days of candles after t), the builder keeps only bars closed at or before t
  for (const tf of MXAC.TFS) { assert.ok(series[tf].some((b) => b.time > t), `${tf}: the series does hold later candles`); assert.ok(snap.bars[tf].length > 0 && snap.bars[tf].every((b) => b.time + MXR.TF[tf] <= t), tf); }
  assert.ok(MXAC.snapshotClean(snap));
  const refuses = (fn, what) => assert.throws(fn, (e) => e.code === 'LOOKAHEAD', what);
  // a future bar put into a snapshot by hand is refused by both guards, on every timeframe
  for (const tf of MXAC.TFS) for (const bar of [{ time: t, open: 1, high: 1, low: 1, close: 1 }, { time: t - MXR.TF[tf] + 60, open: 1, high: 1, low: 1, close: 1 }, series[tf].find((b) => b.time > t)]) {
    const dirty = { ...snap, bars: { ...snap.bars, [tf]: snap.bars[tf].concat(bar) } };
    refuses(() => MXR.guard(dirty), `MXR.guard: a ${tf} bar that closes after t`); assert.throws(() => MXA.assertNoFuture(dirty), /./, `MXA.assertNoFuture: ${tf}`); assert.throws(() => MXA.decide(dirty, {}), /./, 'and no decision is made on it'); assert.equal(MXAC.snapshotClean(dirty), false);
  }
  refuses(() => MXR.guard({ ...snap, bars: { ...snap.bars, '1h': snap.bars['1h'].concat(MXR.formingAt(series['5m'], '1h', t, '5m')) } }), 'the bar still forming at t');
  // a candidate after t, and a candidate that carries any outcome field
  refuses(() => MXR.snapshot({ ...base, t: t - 60 }), 'the candidate one minute before it fires'); refuses(() => MXR.snapshot({ ...base, cand: { ...CAND, t: t + 1 } }), 'a candidate that fires after t');
  for (const k of ['R', 'netR', 'exitT', 'exit', 'mfeR', 'maeR', 'outcome']) { refuses(() => MXR.snapshot({ ...base, cand: { ...CAND, [k]: 1 } }), `a candidate with ${k}`); assert.throws(() => MXA.assertNoFuture({ ...snap, cand: { ...CAND, [k]: 1 } }), /./, `the core refuses ${k} too`); }
  assert.throws(() => MXA.decide({ ...snap, cand: { ...CAND, result: 'win' } }, {}), /./, 'the decision itself refuses a candidate with a result');
  // releases: the builder keeps only events at or before t, and of a scheduled release only its time, title and impact;
  // a snapshot made by hand with a later event, or with a result on a scheduled release, is refused by the guard
  const rel = MXR.snapshot({ ...base, events: [{ t: t - 60, title: 'CPI', impact: 'high' }, { t: t + 60, title: 'NFP', impact: 'high', actual: 1 }], schedule: [{ t: t + 3600, title: 'NFP', impact: 'high', actual: 0.3, surprise: 1, result: 'hot' }, { t: t + 100 * 3600, title: 'too far', impact: 'high' }] });
  assert.ok((rel.events || []).every((e) => e.t <= t) && (rel.events || []).length <= 1, JSON.stringify(rel.events)); for (const e of rel.schedule || []) { assert.deepEqual(Object.keys(e).sort(), ['impact', 't', 'title']); assert.ok(e.t > t && e.t <= t + 72 * 3600); }
  refuses(() => MXR.guard({ ...snap, events: [{ t: t + 60, title: 'CPI', impact: 'high' }] }), 'an event after t');
  for (const k of ['actual', 'surprise', 'result', 'forecastError']) refuses(() => MXR.guard({ ...snap, schedule: [{ t: t + 3600, title: 'CPI', impact: 'high', [k]: 0.3 }] }), `a scheduled release with ${k}`);
  // the API: a candidate never carries an outcome field, and an outcome is refused until the attempt for that setup is stored
  for (const f of ['R', 'netR', 'exitT', 'exit', 'reason', 'mfeR', 'maeR']) assert.ok(!(f in CAND), `cand-gmp.json has no ${f}`);
});
// GAP in assets/academy-replay.js and assets/academy-core.js (not this test's owner's to edit): the outcome file's fields are
// id, R, netR, exitT, exit, reason, mfeR, maeR (api/academy.js OUT_FIELDS). Both guards list the others; neither lists `reason`
// (how the trade ended: "stop", "target", "trail"), and MXR.guard does not list `result`. No candidate can carry them today (the
// API hands out candidates through a whitelist of fields, tested above), so nothing leaks; the guards are the second lock and
// should know every outcome field.
// FIX: assets/academy-replay.js line "const OUTCOME_KEYS = [...]": add 'reason', 'result'; assets/academy-core.js OUTCOME_KEYS: add 'reason'.
test('look-ahead: both guards refuse EVERY field of the outcome file on a candidate, `reason` and `result` included', { todo: "assets/academy-replay.js and assets/academy-core.js OUTCOME_KEYS: add 'reason' (and 'result' in the replay module)" }, () => {
  const snap = MXR.snapshot({ edge: 'gmp', market: 'xau', t: CAND.t, cand: CAND, series: { '5m': [] }, dataVersion: 'x' });
  for (const k of ['R', 'netR', 'exitT', 'exit', 'reason', 'mfeR', 'maeR', 'outcome', 'result']) { assert.throws(() => MXR.guard({ ...snap, cand: { ...CAND, [k]: 'stop' } }), (e) => e.code === 'LOOKAHEAD', `MXR.guard: ${k}`); assert.throws(() => MXA.assertNoFuture({ ...snap, cand: { ...CAND, [k]: 'stop' } }), /./, `MXA.assertNoFuture: ${k}`); }
});
test('look-ahead: the API hands out no outcome before the attempt, hides a blind answer until the mentor has answered, and its past cases end before the setup', async () => {
  const store = ST.memoryStore(), own = { who: OWNER, store };
  const cands = (await call('GET', { get: 'candidates', edge: 'gmp', limit: '5000' }, own)).body.candidates; assert.ok(cands.length > 300); for (const c of cands) for (const f of ['R', 'netR', 'exitT', 'exit', 'reason', 'mfeR', 'maeR', 'outcome']) assert.ok(!(f in c), `${c.id} carries ${f}`);
  for (const q of [{ get: 'outcome', id: CAND.id, edge: 'gmp' }, { get: 'outcome', id: CAND.id }, { get: 'outcome', id: EXAMC.id, edge: 'gmp' }]) { const r = await call('GET', q, own); assert.equal(r.code, 403); assert.match(r.body.error, /^decide first/); }
  await call('POST', { action: 'seen', edge: 'gmp', id: CAND.id, mode: 'train' }, own); assert.equal((await call('GET', { get: 'outcome', id: CAND.id, edge: 'gmp' }, own)).code, 403, 'being shown a setup is not deciding it');
  await call('POST', attempt(), own); const out = await call('GET', { get: 'outcome', id: CAND.id, edge: 'gmp' }, own); assert.equal(out.code, 200); assert.ok(out.body.outcome.exitT > CAND.t);
  // blind: the engine's stored answer and the outcome stay hidden until the mentor's answer is stored
  const bid = 'gmp-1715159400s'; const b = await call('POST', attempt({ candidateId: bid, mode: 'blind' }, { action: 'WAIT' }), own); assert.equal(b.body.attempt.decision, null); assert.equal(b.body.attempt.hidden, true);
  assert.equal((await call('GET', { get: 'attempts', edge: 'gmp', cand: bid }, own)).body.attempts[0].decision, null); assert.equal((await call('GET', { get: 'outcome', id: bid, edge: 'gmp' }, own)).code, 403); assert.deepEqual((await call('GET', { get: 'blind', edge: 'gmp' }, own)).body.blind, []);
  assert.ok(!(await call('GET', { get: 'dataset', edge: 'gmp' }, own)).body.rows.some((r) => r.candidateId === bid), 'nor in the dataset rows');
  await call('POST', { action: 'blind.submit', blind: { edge: 'gmp', candidateId: bid, action: 'WAIT', text: 'x' } }, own); assert.equal((await call('GET', { get: 'outcome', id: bid, edge: 'gmp' }, own)).code, 200);
  // past cases: train pool only, finished before the setup, no id and no price
  const h = (await call('GET', { get: 'history', edge: 'gmp', cand: CAND.id }, own)).body; assert.ok(h.rows.length > 100); for (const r of h.rows) { assert.ok(r.t < CAND.t && r.exitT < CAND.t); assert.deepEqual(Object.keys(r).sort(), ['exitT', 'features', 'netR', 't']); }
  const examT = new Set(json('academy/data/cand-gmp.json').filter((c) => c.pool === 'exam').map((c) => c.t)); assert.ok(!h.rows.some((r) => examT.has(r.t)), 'no exam setup is among the past cases');
  // the page asks for an outcome in three places only, each after its attempt (the browser audit watches the requests themselves)
  const ui = src('assets/academy-ui.js') + src('assets/academy-tabs.js'), asks = [...ui.matchAll(/get: 'outcome'/g)].length; assert.equal(asks, 4, 'reopenTrade, settlePoint, the What-if card, the blind arena');
});

// ==== isolation ==============================================================================================================
const walk = (d, ok) => (fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__pycache__' || e.name === 'node_modules' ? [] : walk(d + '/' + e.name, ok)) : ok.test(e.name) ? [d + '/' + e.name] : [])) : []);
const RUNTIME = ['academy.html', 'api/academy.js', 'api/_academy-store.js', 'api/_academy-llm.js', 'scripts/academy-dev.mjs', ...walk('assets', /^academy[\w-]*\.(js|css)$/), ...walk('ml', /\.(py|mjs|js|sh|toml|txt|cfg|ya?ml)$/)];
const GENERATORS = walk('academy', /\.(mjs|js)$/);
const ACADEMY_FILES = [...RUNTIME, ...GENERATORS];
test('isolation: no file of the Academy references the trader, the mirror, a broker, an order call, the council-data writer or a production write token', () => {
  assert.ok(RUNTIME.length >= 12 && RUNTIME.includes('assets/academy-core.js') && RUNTIME.some((f) => f.startsWith('ml/')) && GENERATORS.some((f) => f.startsWith('academy/gen/')), `${RUNTIME.length} + ${GENERATORS.length}`);
  const FORBID = [
    [/(?:from|import|require)\s*\(?\s*['"][^'"]*council\/(?!events\.mjs)[\w.-]+['"]/, 'imports a council module (only council/events.mjs, the release calendar, may be read)'],
    [/(?:from|import|require)\s*\(?\s*['"][^'"]*(?:\/|^)(?:ict\/|api\/(?!_?academy|_session)[\w-]+)/, 'imports the ICT desk or another API function'],
    [/ctrader|c-trader|tradovate|tradestation|metatrader|\bmt5\b/i, 'names a broker or a broker bridge'],
    [/NEW_ORDER|ORDER_REQ|AMEND_POSITION|CANCEL_ORDER|CLOSE_POSITION|placeOrder|sendOrder|submitOrder|createOrder|marketOrder\s*\(|limitOrder\s*\(/, 'calls or names an order message'],
    [/datasync|jsonio|git\s+push|git\s+commit|signals\.csv|ctrader\/|mirror\.json/, 'touches the council-data writer, the mirror\'s files or the signal file of the bridges'],
    [/\bGH_(?:MCP_|READ_)?TOKEN\b|GITHUB_TOKEN|CTRADER_[A-Z_]+|\bOANDA_TOKEN\b|CRON_SECRET|SESSION_SECRET|VAPID_PRIVATE_KEY|\bNTFY|TELEGRAM|MCP_KEYS|\bRUN_MODE\b/, 'names a production secret of another part of the site'],
    [/child_process|\bexecSync\b|\bspawn(?:Sync)?\s*\(|new\s+WebSocket|\bsubprocess\b|os\.system\s*\(/, 'spawns a process or opens a socket'],
  ];
  // what RUNS (the page, its modules, the API, the local server, the training service): none of the above, and not even the Trader's name
  const STRICT = FORBID.concat([[/council\/(?!events\.mjs)[\w.-]+\.mjs|\btrader\.mjs\b|demo mirror|\beval\s*\(|new\s+Function\s*\(|trades\.json|snapshot\.json/, 'names a council module, the mirror or the bots\' files, or evaluates text']]);
  for (const f of RUNTIME) { const text = src(f); for (const [re, what] of STRICT) { const m = re.exec(text); assert.ok(!m, `${f} ${what}: "${m && text.slice(Math.max(0, m.index - 30), m.index + 50).replace(/\s+/g, ' ')}"`); } }
  // the offline generators (academy/gen, run by hand on research candles, never shipped to a function and never run by the site):
  // the same bans. What they may do, and do: READ the rule code of the seven systems as text, to replay the same signals
  // (the registry names those files in its descriptions). They import none of it, place nothing and write only academy/data.
  for (const f of GENERATORS) { const text = src(f); for (const [re, what] of FORBID) { const m = re.exec(text); assert.ok(!m, `${f} ${what}: "${m && text.slice(Math.max(0, m.index - 30), m.index + 50).replace(/\s+/g, ' ')}"`); } }
  const readsRuleCode = GENERATORS.filter((f) => /readFileSync\([^)]*council\//.test(src(f))).sort();
  assert.deepEqual(readsRuleCode, ['academy/gen/gmp.mjs', 'academy/gen/run.mjs'], 'the generators that read the Trader\'s source text (read only): a new one is a decision, not a drift');
  // one generator uses the network: the clock check reads public candles from the site's keyless candle proxy, and nothing else
  const NET = /\bfetch\s*\(|https?:\/\/(?!www\.w3\.org)|node:https?|require\(['"]https?['"]\)/;
  assert.deepEqual(GENERATORS.filter((f) => NET.test(src(f))), ['academy/gen/clock-check.mjs']); assert.deepEqual([...src('academy/gen/clock-check.mjs').matchAll(/fetch\(`\$\{BASE\}(\/[a-z/]+)/g)].map((m) => m[1]), ['/md/bars']); assert.equal((src('academy/gen/clock-check.mjs').match(/\bfetch\s*\(/g) || []).length, 1);
  for (const f of GENERATORS) { const text = src(f); for (const m of text.matchAll(/writeFileSync\(\s*([^,]+),/g)) assert.ok(!/council|out\/|api\//.test(m[1]), `${f} writes ${m[1]}`); }
  assert.ok(!fs.existsSync(path.join(ROOT, 'out', 'academy')), 'and neither the generators nor their data are copied into the built site');
  // the one write token the Academy may hold is the private Blob store's, in its API and its store only, and only for keys under academy/
  const blob = ACADEMY_FILES.filter((f) => /BLOB_READ_WRITE_TOKEN/.test(src(f))); assert.deepEqual(blob.sort(), ['api/_academy-store.js', 'api/academy.js']);
  // the session module is read for the owner check and for nothing else
  assert.deepEqual([...src('api/academy.js').matchAll(/\bS\.(\w+)/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).sort(), ['defaultDeps', 'fromRequest', 'sameOrigin']);
  assert.deepEqual([...src('api/academy.js').matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]), ['node:fs', 'node:path', 'node:crypto', 'node:url', './_session.js', './_academy-store.js', './_academy-llm.js']);
  // the network: the page talks to its own API and the candle proxy; the API talks to the Blob store and, only when the owner sets a key, to the language-model address
  for (const f of ['assets/academy-ui.js', 'assets/academy-tabs.js', 'assets/academy-core.js', 'assets/academy-risk.js']) assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(src(f)), `${f} names no outside address`);
  assert.deepEqual([...new Set([...(src('assets/academy-ui.js') + src('assets/academy-tabs.js') + src('assets/academy-replay.js')).matchAll(/['"`](\/(?:api|md|cdata)\/[a-z-]+)/g)].map((m) => m[1]))].sort(), ['/api/academy', '/md/bars']);
  for (const f of ['assets/academy-core.js', 'assets/academy-risk.js', 'assets/academy-tabs.js']) assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/.test(src(f)), `${f} makes no request of its own and keeps nothing in the browser`);
  // the Vercel function ships only what the Academy needs
  const fn = json('vercel.json').functions['api/academy.js']; assert.ok(fn && fn.includeFiles, 'the function lists its files'); assert.ok(!/council|ict\/|ctrader|trader/.test(JSON.stringify(fn)), JSON.stringify(fn));
});

test('isolation: the built Academy holds no name of a secret setting and no key-like string, and is served with no secret in it', () => {
  const built = ['out/academy.html', ...walk('out/assets', /^academy[\w-]*\.(js|css)$/)]; assert.ok(built.length >= 6, built.join());
  assert.ok(!fs.existsSync(path.join(ROOT, 'out/academy')) && !fs.existsSync(path.join(ROOT, 'out/ml')) && !fs.existsSync(path.join(ROOT, 'out/api')), 'the candidates, the outcomes, the models and the API are not copied to out/: they are served through the API only');
  const NAME = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:SECRET|TOKEN|PASSWORD|PASSWD|KEY|HASH)\b|\b(?:SECRET|TOKEN|PASSWORD|API_?KEY)_[A-Z0-9_]+\b|process\.env/;
  const KEY = /sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|gh[ousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|vercel_blob_rw_[A-Za-z0-9_]+|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.|Bearer\s+[A-Za-z0-9._-]{16,}|\b[a-f0-9]{64}\b(?!["'&]|\.(js|css))/;
  for (const f of built) {
    const text = src(f).replace(/\?v=[a-f0-9]{8,64}/g, '');   // asset stamps are hashes of public files
    const n = NAME.exec(text); assert.ok(!n, `${f} names a secret setting: ${n && n[0]}`);
    const k = KEY.exec(text); assert.ok(!k, `${f} holds a key-like string: ${k && k[0].slice(0, 12)}…`);
  }
  // the page says how the optional adapter is switched on without naming the variable that holds its key
  const costs = src('assets/academy-tabs.js'); assert.match(costs, /The key never reaches this page\./); assert.ok(!/ACADEMY_LLM_KEY/.test(costs));
  // the adapter's key is read from the server's settings only and is in no answer of the API
  const llm = src('api/_academy-llm.js'); assert.match(llm, /ACADEMY_LLM_KEY/);
  assert.ok(!/key\s*:/i.test(JSON.stringify(Object.keys(require('../api/_academy-llm.js')))));
});
test('isolation: with a key set on the server, no route of the API ever answers with it', async () => {
  const SECRET = 'k-live-0123456789abcdefSECRET', env = { ACADEMY_LLM_KEY: SECRET, ACADEMY_LLM_URL: 'https://llm.invalid/v1', ACADEMY_LLM_MODEL: 'some-model', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_TESTTOKEN', SESSION_SECRET: 's'.repeat(40), ACADEMY_LLM_STOP: '1' };
  const store = ST.memoryStore(), { ids } = await fill(store, { env });
  for (const name of GETS) { const r = await call('GET', getQuery(name, ids), { who: OWNER, store, env }); const t = JSON.stringify(r.body); assert.ok(!t.includes(SECRET) && !t.includes('vercel_blob_rw_') && !t.includes('s'.repeat(40)), `GET ${name}`); }
  assert.ok(![...store.raw.values()].join('').includes(SECRET), 'and it is in no stored file');
});

// ==== pacing =================================================================================================================
const okRes = (body = {}) => ({ status: 200, ok: true, headers: { get: () => null }, json: async () => body });
test('pacing: under a burst the page\'s API wrapper never sends more than its minute budget, in any 60 seconds, reads and writes together', async () => {
  let T = 0; const sent = [];
  const api = MXAC.makeApi({ fetch: async (url, init) => { sent.push({ t: T, post: !!(init && init.method === 'POST'), n: init && init.body ? JSON.parse(init.body).n : +new URL(url, 'http://x').searchParams.get('n') }); return okRes(); }, sleep: async (ms) => { T += ms; }, now: () => T, perMinute: MXAC.PACE });
  const jobs = []; for (let i = 0; i < 200; i++) jobs.push(i % 3 === 0 ? api.post({ action: 'attempt', n: i }) : api.get({ get: 'attempts', n: i }));
  await Promise.all(jobs);
  assert.equal(sent.length, 200, 'every call was sent'); assert.equal(MXAC.PACE, 24); assert.ok(MXAC.PACE < 30, 'under the firewall\'s 30 a minute');
  for (let i = 0; i < sent.length; i++) { const inWindow = sent.filter((x) => x.t > sent[i].t - 60000 && x.t <= sent[i].t).length; assert.ok(inWindow <= MXAC.PACE, `call ${i} at ${sent[i].t} ms is number ${inWindow} in its minute`); }
  assert.ok(sent[sent.length - 1].t >= 8 * 60000, '200 calls take at least eight minutes'); assert.deepEqual(sent.filter((x) => x.post).map((x) => x.n), Array.from({ length: 67 }, (_, i) => i * 3), 'writes keep their order');
  // a slower budget set later is obeyed from the next call on
  let lim = 24, T2 = 0; const at = [], api2 = MXAC.makeApi({ fetch: async () => { at.push(T2); return okRes(); }, sleep: async (ms) => { T2 += ms; }, now: () => T2, perMinute: () => lim });
  await Promise.all(Array.from({ length: 5 }, () => api2.get({ get: 'x' }))); lim = 3; await Promise.all(Array.from({ length: 4 }, () => api2.get({ get: 'x' }))); assert.ok(at[5] >= 60000, 'the sixth call waited for the window once the budget fell to 3');
});
test('pacing: a write is never dropped on a 429: it is sent again as it was, once, in order; and when the server keeps refusing, the caller is told', async () => {
  // the server refuses every third request with 429
  let T = 0, n = 0; const got = [], stored = [];
  const api = MXAC.makeApi({ perMinute: MXAC.PACE, sleep: async (ms) => { T += ms; }, now: () => T, fetch: async (url, init) => { n++; const body = JSON.parse(init.body); got.push(body.i); if (n % 3 === 0) return { status: 429, ok: false, headers: { get: (k) => (k === 'Retry-After' ? '1' : null) }, json: async () => ({ error: 'limited' }) }; stored.push(body.i); return okRes({ ok: true, i: body.i }); } });
  const answers = await Promise.all(Array.from({ length: 40 }, (_, i) => api.post({ action: 'attempt', i })));
  assert.deepEqual(stored, Array.from({ length: 40 }, (_, i) => i), 'every write reached the server exactly once, in the order it was made'); assert.deepEqual(answers.map((a) => a.i), stored); assert.ok(api.stats.retries >= 13);
  for (let i = 0; i < got.length; i++) assert.ok(i === 0 || got[i] >= got[i - 1], 'a refused write is retried before the next one is sent');
  // the retries count against the budget too
  assert.ok(n > 40 && T >= 60000, `${n} requests for 40 writes, paced over ${Math.round(T / 1000)} s`);
  // a server that never stops refusing: TRIES attempts, then an error with status 429 that names the limit (reported, not lost)
  let tries = 0; const dead = MXAC.makeApi({ perMinute: 0, sleep: async () => {}, fetch: async () => { tries++; return { status: 429, ok: false, headers: { get: () => null }, json: async () => ({}) }; } });
  await assert.rejects(() => dead.post({ action: 'correct' }), (e) => e.status === 429 && /still limiting requests after 4 tries/.test(e.message)); assert.equal(tries, MXAC.TRIES);
  // and the next write still goes out afterwards: one failure does not jam the queue
  let ok = 0; const mixed = MXAC.makeApi({ perMinute: 0, sleep: async () => {}, fetch: async (u, init) => { const b = JSON.parse(init.body); if (b.bad) return { status: 500, ok: false, headers: { get: () => null }, json: async () => ({ error: 'the Academy is unavailable' }) }; ok++; return okRes(); } });
  const res = await Promise.allSettled([mixed.post({ bad: 1 }), mixed.post({ a: 1 }), mixed.post({ bad: 1 }), mixed.post({ b: 1 })]); assert.deepEqual(res.map((r) => r.status), ['rejected', 'fulfilled', 'rejected', 'fulfilled']); assert.equal(ok, 2);
  // every call of both page files goes through the wrapper (one fetch in the whole page, inside it)
  assert.deepEqual(src('assets/academy-ui.js').match(/.{28}\bfetch\(.{10}/g), ['Api({ fetch: (url, init) => fetch(url, init)'], 'the one fetch of the page is the one handed to the wrapper'); assert.ok(!/\bfetch\(/.test(src('assets/academy-tabs.js')));
});
