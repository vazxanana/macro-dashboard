// node --test tests/watchdog-kick.test.mjs — the Worker starts watchdog.yml when the council or the ICT desk is stale
// (18 Nov 2026, docs/owner-decisions.md items 15 and 31). Offline: fake GitHub, fake council-data reader, fixed clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const K = require('../api/_watchdog-kick.js');
const H = await import('../council/health.mjs');

const NOW = Date.parse('2026-11-18T15:00:00Z');   // a Wednesday afternoon: markets open
const ago = (m, now = NOW) => new Date(now - m * 6e4).toISOString();
// fake GitHub: records every call; runs = the watchdog's run list (null = the list cannot be read)
function gh({ runs = [], dispatchStatus = 204 } = {}) {
  const calls = [];
  const fetchFn = async (url, o = {}) => {
    calls.push({ url, method: o.method || 'GET', body: o.body, auth: o.headers && o.headers.authorization });
    if (/\/dispatches$/.test(url)) return { ok: dispatchStatus < 300, status: dispatchStatus, json: async () => ({}) };
    if (runs === null) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ workflow_runs: runs }) };
  };
  return { fetchFn, calls, dispatched: () => calls.filter((c) => c.method === 'POST') };
}
const reader = (files) => async (p) => (p in files ? files[p] : null);

test('the limits are the watchdog\'s own (council/health.mjs) and the weekend is its weekend', () => {
  assert.equal(K.COUNCIL_MIN, H.CFG.stoppedMin); assert.equal(K.ICT_MIN, H.CFG.ictStoppedMin);
  for (const iso of ['2026-11-20T21:30:00Z', '2026-11-21T12:00:00Z', '2026-11-22T21:59:00Z', '2026-11-18T15:00:00Z', '2026-11-22T22:00:00Z']) {
    const t = Date.parse(iso); assert.equal(K.weekend(t), H.weekendShut(t / 1000), iso);
  }
});

test('a council saving on time starts nothing and asks GitHub nothing', async () => {
  const g = gh();
  const r = await K.run({ readAt: reader({ 'snapshot.json': ago(6), 'ict/snapshot.json': ago(30) }), token: 'tok', fetchFn: g.fetchFn, now: NOW });
  assert.equal(r.started, false); assert.equal(g.calls.length, 0, 'no network while all is well');
});

test('a stopped council starts the watchdog once, on main, with the dispatch token', async () => {
  const g = gh({ runs: [{ status: 'completed', created_at: ago(55) }] });
  const r = await K.run({ readAt: reader({ 'snapshot.json': ago(35), 'ict/snapshot.json': ago(30) }), token: 'tok', fetchFn: g.fetchFn, now: NOW });
  assert.equal(r.started, true); assert.match(r.why, /council last saved 35 min ago/);
  const d = g.dispatched(); assert.equal(d.length, 1);
  assert.match(d[0].url, /\/repos\/vazxanana\/macro-dashboard\/actions\/workflows\/watchdog\.yml\/dispatches$/);
  assert.deepEqual(JSON.parse(d[0].body), { ref: 'main' }); assert.equal(d[0].auth, 'Bearer tok');
});

test('the run list is the marker: a run active or started in the last 30 min means no second start', async () => {
  const files = { 'snapshot.json': ago(90), 'ict/snapshot.json': ago(90) };
  for (const runs of [[{ status: 'in_progress', created_at: ago(2) }], [{ status: 'queued', created_at: ago(1) }], [{ status: 'completed', created_at: ago(12) }]]) {
    const g = gh({ runs }); const r = await K.run({ readAt: reader(files), token: 'tok', fetchFn: g.fetchFn, now: NOW });
    assert.equal(r.started, false, JSON.stringify(runs)); assert.equal(g.dispatched().length, 0);
  }
  const g = gh({ runs: [{ status: 'completed', created_at: ago(31) }] });
  assert.equal((await K.run({ readAt: reader(files), token: 'tok', fetchFn: g.fetchFn, now: NOW })).started, true, 'after 30 min it starts again');
});

test('not sure is no: an unreadable snapshot, run list or a missing token starts nothing; a refused dispatch is reported', async () => {
  let g = gh(); assert.equal((await K.run({ readAt: reader({}), token: 'tok', fetchFn: g.fetchFn, now: NOW })).started, false); assert.equal(g.calls.length, 0);
  g = gh({ runs: null }); let r = await K.run({ readAt: reader({ 'snapshot.json': ago(40) }), token: 'tok', fetchFn: g.fetchFn, now: NOW });
  assert.equal(r.started, false); assert.match(r.why, /could not be read/); assert.equal(g.dispatched().length, 0);
  g = gh(); r = await K.run({ readAt: reader({ 'snapshot.json': ago(40) }), token: null, fetchFn: g.fetchFn, now: NOW });
  assert.equal(r.started, false); assert.match(r.why, /no GitHub dispatch token/); assert.equal(g.calls.length, 0);
  g = gh({ dispatchStatus: 403 }); r = await K.run({ readAt: reader({ 'snapshot.json': ago(40) }), token: 'tok', fetchFn: g.fetchFn, now: NOW });
  assert.equal(r.started, false); assert.match(r.why, /Actions: write/);
});

test('the ICT desk counts outside the futures weekend only, and only while the council itself saves', async () => {
  let g = gh(); let r = await K.run({ readAt: reader({ 'snapshot.json': ago(5), 'ict/snapshot.json': ago(60) }), token: 'tok', fetchFn: g.fetchFn, now: NOW });
  assert.equal(r.started, true); assert.match(r.why, /ICT desk last saved 60 min ago/);
  const SAT = Date.parse('2026-11-21T12:00:00Z');
  g = gh(); r = await K.run({ readAt: reader({ 'snapshot.json': ago(5, SAT), 'ict/snapshot.json': ago(600, SAT) }), token: 'tok', fetchFn: g.fetchFn, now: SAT });
  assert.equal(r.started, false); assert.equal(g.calls.length, 0, 'the futures weekend: an old ICT file is expected');
  const s = K.staleNow({ council: ago(40), ict: ago(90), now: NOW });
  assert.deepEqual(s.map((x) => x.id), ['council'], 'a stopped council is the news; the ICT line is not added');
});

test('the endpoint: ?job=watchdog needs the cron secret, never caches, and the public answer is unchanged', async () => {
  const status = require('../api/status.js'), env = process.env, keep = { c: env.CRON_SECRET, t: env.GH_DISPATCH_TOKEN };
  const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };   // no network in the suite
  const res = () => { const r = { code: 0, body: null, h: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.h[k.toLowerCase()] = v; }; return r; };
  try {
    env.CRON_SECRET = 'cron-secret-123456'; delete env.GH_DISPATCH_TOKEN;
    let r = res(); await status({ method: 'GET', headers: {}, query: { job: 'watchdog' } }, r);
    assert.equal(r.code, 401); assert.equal(r.h['cache-control'], 'private, no-store');
    r = res(); await status({ method: 'GET', headers: { authorization: 'Bearer wrong' }, query: { job: 'watchdog' } }, r); assert.equal(r.code, 401);
    r = res(); await status({ method: 'GET', headers: { authorization: 'Bearer cron-secret-123456' }, query: { job: 'watchdog' } }, r);
    assert.equal(r.code, 200); assert.equal(r.body.started, false, 'offline here: council-data is not readable, so nothing is started');
  } finally { globalThis.fetch = realFetch; if (keep.c == null) delete env.CRON_SECRET; else env.CRON_SECRET = keep.c; if (keep.t != null) env.GH_DISPATCH_TOKEN = keep.t; }
});

test('wiring: first in the Worker\'s 10-minute chain, no new trigger, and the module only reads, decides and dispatches the watchdog', () => {
  const w = fs.readFileSync(new URL('../cloudflare/src/worker.mjs', import.meta.url), 'utf8');
  assert.match(w, /CHAINED = \{ '\*\/10 \* \* \* \*': \['\/api\/status\?job=watchdog', '\/api\/trade-review\?job=review'\] \}/);
  assert.match(w, /CRONS = \{ '\*\/10 \* \* \* \*': '\/api\/edge-analyst\?job=scan' \}/, 'still one cron');
  const k = fs.readFileSync(new URL('../api/_watchdog-kick.js', import.meta.url), 'utf8');
  assert.equal((k.match(/method: 'POST'/g) || []).length, 1, 'one write call: the dispatch');
  assert.match(k, /const WORKFLOW = 'watchdog\.yml'/); assert.doesNotMatch(k, /council\.yml|ctrader|trades\.json/);
  assert.doesNotMatch(k, /require\(/, 'no imports: nothing else can be reached from it');
});
