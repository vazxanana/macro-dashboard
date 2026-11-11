// node --test tests/academy-correction.test.mjs — "The correction was not saved: no such attempt for this edge" (11 Nov 2026).
// The owner decided a setup (attempt 2), wrote a verdict and got that 404. The sequence, with the real handler and the real
// Blob backend of the store over a fake Blob service that behaves as the real one is documented to: an overwritten file is
// served from the CDN with its OLD bytes for up to a minute, unless the read asks the origin (`?cache=0`, what the Blob
// client's own `get(..., { useCache: false })` sends). Offline: no network, no real store.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handle } = require('../api/academy.js');
const ST = require('../api/_academy-store.js');
const UI = require('../assets/academy-ui.js');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const T0 = 1700000000;
const CANDS = [
  { id: 'replica:1', edge: 'replica', market: 'xau', t: T0, side: 'buy', entry: 2000, stop: 1995, target: 2010, tf: '15m', rule: {}, edgeVersion: 'ev1', pool: 'train' },
  { id: 'replica:2', edge: 'replica', market: 'xau', t: T0 + 3600, side: 'sell', entry: 2010, stop: 2015, target: 2000, tf: '15m', rule: {}, edgeVersion: 'ev1', pool: 'train' },
  { id: 'replica:x1', edge: 'replica', market: 'xau', t: T0 + 7200, side: 'buy', entry: 2020, stop: 2015, target: 2030, tf: '15m', rule: {}, edgeVersion: 'ev1', pool: 'exam' },
];
const DATA = { edges: async () => [{ id: 'replica', name: 'Gold replica', market: 'xau' }, { id: 'gtrend', name: 'Gold trend', market: 'xau' }], candidates: async (e) => (e === 'replica' ? CANDS : null), outcomes: async () => null };

// A Blob service with a CDN in front of it. put() changes the origin at once; a file the CDN already holds keeps being
// served with its old bytes until LAG ms after the overwrite. A read with ?cache=0 goes to the origin.
const LAG = 60e3;
function blobService() {
  const W = { now: Date.UTC(2026, 10, 11, 18), origin: new Map(), cdn: new Map(), reads: { cdn: 0, origin: 0 } };
  W.blob = {
    list: async ({ prefix }) => ({ blobs: [...W.origin.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ pathname: k, url: `https://store.private.blob.invalid/${k}`, uploadedAt: new Date(W.origin.get(k).at) })) }),
    put: async (p, body) => { W.origin.set(p, { body, at: W.now }); const c = W.cdn.get(p); if (c) c.until = W.now + LAG; },
  };
  W.fetch = async (url, o) => {
    assert.equal(o.headers.Authorization, 'Bearer tok');
    const u = new URL(url), p = decodeURIComponent(u.pathname.slice(1)), at = W.origin.get(p); if (!at) return { ok: false, status: 404, json: async () => null };
    if (u.searchParams.get('cache') === '0') { W.reads.origin++; return { ok: true, status: 200, json: async () => JSON.parse(at.body) }; }
    W.reads.cdn++; let c = W.cdn.get(p); if (!c || (c.until != null && W.now >= c.until)) { c = { body: at.body, until: null }; W.cdn.set(p, c); }
    return { ok: true, status: 200, json: async () => JSON.parse(c.body) };
  };
  // one function instance: its own memory of what it wrote, its own write queue
  W.instance = () => { const store = ST.blobStore({ BLOB_READ_WRITE_TOKEN: 'tok' }, { blob: W.blob, fetch: W.fetch, recent: new Map(), tails: new Map(), now: () => W.now }); return { env: {}, store, who: async () => ({ u: 'owner' }), sameOrigin: () => true, data: DATA, now: () => (W.now += 1000) }; };
  return W;
}
async function call(deps, method, payload) {
  const out = { headers: {} }, res = { setHeader: (k, v) => { out.headers[k] = v; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } };
  await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, deps);
  return out;
}
const get = (d, q) => call(d, 'GET', q), post = (d, b) => call(d, 'POST', b);
const decision = (o = {}) => ({ edge: 'replica', market: 'xau', t: T0, action: 'WAIT', entry: null, stop: null, target: null, candidateId: 'replica:1', thesis: 'No confirmation yet.', supporting: [], contradicting: [], waitReasons: ['no displacement'], invalidation: [],
  risk: null, similar: null, lessonsApplied: [], confidence: 'low', uncertainty: [], modelVersion: null, policyVersion: 'p1', edgeVersion: 'ev1', dataVersion: 'd1', featuresHash: 'abc', ...o });
const attempt = (o = {}, dec = {}) => ({ action: 'attempt', attempt: { candidateId: 'replica:1', edge: 'replica', mode: 'train', decision: decision(dec), lessonsAvailable: [], snapshotHash: 'h1', ...o }, features: { rr: 2 } });
// the owner's own verdict: Reject, bias up, "missing confirmation", "wait for better entry", two entry marks
const verdict = (attemptId) => ({ action: 'correct', edge: 'replica', correction: { attemptId, verdict: 'reject', action: null, entry: null, stop: null, target: null, bias: 'up', edge: null, reasons: ['missing-confirmation'], text: 'wait for better entry',
  annotations: [{ kind: 'entry', t: T0 - 8340, price: 4378.21 }, { kind: 'entry', t: T0, price: 4386.04 }], errorClass: 'missed-context' } });

test('the owner\'s sequence: attempt 2 stored by one instance, the verdict handled by another within a minute, is saved (it was "no such attempt for this edge")', async () => {
  const W = blobService(), A = W.instance(), B = W.instance();
  const a1 = await post(A, attempt()); assert.equal(a1.code, 200); assert.equal(a1.body.n, 1);            // an earlier sitting decided this setup
  W.now += 10 * 60e3;
  assert.equal((await get(B, { get: 'attempts', edge: 'replica', cand: 'replica:1' })).body.attempts.length, 1);   // another instance has read the file since
  W.now += 5 * 60e3;
  const a2 = await post(A, attempt({ mode: 'replay-same' })); assert.equal(a2.code, 200); assert.equal(a2.body.n, 2, 'the page says "your verdict on attempt 2"');
  W.now += 20e3;                                                                                              // the owner writes the verdict
  const c = await post(B, verdict(a2.body.attempt.id));
  assert.notEqual(c.body && c.body.error, 'no such attempt for this edge', 'the attempt stored 20 seconds ago is found');
  assert.equal(c.code, 200); assert.equal(c.body.correction.attemptId, a2.body.attempt.id); assert.equal(c.body.correction.annotations.length, 2); assert.equal(c.body.datasetUpdated, true);
  // and it is there for every instance, at once
  for (const I of [A, B, W.instance()]) assert.equal((await get(I, { get: 'corrections', edge: 'replica', cand: 'replica:1' })).body.corrections.length, 1);
});

test('a write made from a lagging read would drop the rows stored in between: two instances, three decisions inside a minute, three rows', async () => {
  const W = blobService(), A = W.instance(), B = W.instance();
  const a1 = await post(A, attempt()); W.now += 10 * 60e3;
  await get(B, { get: 'attempts', edge: 'replica' }); await get(B, { get: 'audit', month: '2026-11' }); W.now += 60e3;
  const a2 = await post(A, attempt({ mode: 'replay-same' })); W.now += 15e3;
  const a3 = await post(B, attempt({ candidateId: 'replica:2' }, { candidateId: 'replica:2', t: T0 + 3600 })); W.now += 15e3;
  for (const r of [a1, a2, a3]) assert.equal(r.code, 200);
  const fresh = W.instance(), rows = (await get(fresh, { get: 'attempts', edge: 'replica' })).body.attempts;
  assert.deepEqual(rows.map((r) => r.id), [a1.body.attempt.id, a2.body.attempt.id, a3.body.attempt.id], 'no stored attempt was overwritten');
  assert.equal((await get(fresh, { get: 'audit', month: '2026-11' })).body.rows.filter((r) => r.action === 'attempt').length, 3, 'nor its audit row');
  assert.equal((await get(fresh, { get: 'dataset', edge: 'replica' })).body.rows.length, 3);
  assert.equal((await post(fresh, verdict(a2.body.attempt.id))).code, 200);
});

test('the store reads a Blob file from the origin, never from the CDN copy; a failed read still throws', async () => {
  const W = blobService(), A = W.instance(), B = W.instance();
  await A.store.put('lessons.json', { v: 1, rows: [1] }); await B.store.get('lessons.json', null); W.now += 5e3; await A.store.put('lessons.json', { v: 1, rows: [1, 2] }); W.now += 5e3;
  assert.deepEqual(await B.store.get('lessons.json', null), { v: 1, rows: [1, 2] });
  assert.equal(W.reads.cdn, 0, 'no read went through the CDN'); assert.ok(W.reads.origin >= 2);
  const s = src('api/_academy-store.js'); assert.match(s, /searchParams\.set\('cache', '0'\)/); assert.match(s, /if \(!r\.ok\) throw new Error\(`blob read \$\{r\.status\}`\)/);
});

test('every refusal of a correction stands: an unknown attempt, another edge, an exam attempt, a blind attempt before its answer', async () => {
  const W = blobService(), A = W.instance();
  const a = await post(A, attempt());
  assert.equal((await post(A, verdict('at_nope000000000000'))).code, 404);
  const other = await post(A, { ...verdict(a.body.attempt.id), edge: 'gtrend' }); assert.equal(other.code, 404); assert.equal(other.body.error, 'no such attempt for this edge');
  const x = await post(A, attempt({ candidateId: 'replica:x1', mode: 'exam' }, { candidateId: 'replica:x1' })); assert.equal(x.code, 200);
  assert.equal((await post(A, verdict(x.body.attempt.id))).code, 409);
  const b = await post(A, attempt({ candidateId: 'replica:2', mode: 'blind' }, { candidateId: 'replica:2' })); assert.equal(b.code, 200);
  assert.equal((await post(A, verdict(b.body.attempt.id))).code, 409);
  assert.equal((await get(A, { get: 'corrections', edge: 'replica' })).body.corrections.length, 0);
});

test('the page: a correction that could not be saved keeps the form, says what to do and offers Try again', () => {
  const f = UI.correctionFailure;
  assert.equal(typeof f, 'function');
  const net = f({ status: 0, message: 'the Academy service could not be reached' }, 1);
  assert.match(net.text, /not saved/); assert.match(net.text, /still here/); assert.match(net.text, /Try again/); assert.equal(net.restore, false);
  const first = f({ status: 404, message: 'no such attempt for this edge' }, 1);
  assert.equal(first.restore, false, 'the first time it is only tried again'); assert.match(first.text, /still here/); assert.doesNotMatch(first.text, /no such attempt/, 'plain words, not the server\'s');
  const second = f({ status: 404, message: 'no such attempt for this edge' }, 2);
  assert.equal(second.restore, true, 'the second time the page stores its decision again, then the verdict');
  assert.equal(f({ status: 404, message: 'no such attempt for this edge' }, 2, 'exam').restore, false, 'never for a test on a new setup');
  assert.equal(f({ status: 409, message: 'answer first' }, 3).restore, false); assert.equal(f({ status: 400, message: 'correction.text must be text' }, 2).restore, false);
  // the form is never cleared or redrawn by a failure, and the button says Try again
  const ui = src('assets/academy-ui.js'), fn = ui.slice(ui.indexOf('async function saveCorrection()'), ui.indexOf('// ---- lesson draft'));
  const fail = fn.slice(fn.indexOf('} catch (e) {'));
  assert.doesNotMatch(fail, /hidePoint\(|renderMentor\(|M\.annotations = |Object\.assign\(M/); assert.match(fail, /Try again/); assert.match(fn, /M\.dirty = false/);
  assert.match(fn, /api\.post\(/); assert.doesNotMatch(fn, /fetch\(/, 'every call through the paced api');
});
