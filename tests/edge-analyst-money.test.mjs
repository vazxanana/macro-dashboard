// The edge analyst's money and safety guarantees (review of 12 Nov 2026). Offline: the REAL language-model adapter
// (api/_academy-llm.js) over a fake provider, the real store over a memory backend or the lagging fake Blob service, a fake
// clock and fake candles. No real provider is ever called: every provider request goes to `provider()` below.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { blobService } from './fixtures/blob-lag.mjs';
const require = createRequire(import.meta.url);
const E = require('../api/_edge-analyst.js');
const EP = require('../api/edge-analyst.js');
const ST = require('../api/_academy-store.js');
const LLM = require('../api/_academy-llm.js');

const PURL = 'https://llm.example.invalid/v1/chat';
const KEY = 'sk-test-secret-123456';
const AUTH = { authorization: 'Bearer cron-secret-xyz' };
const ANSWER = '{"verdict":"TAKE","confidence":"medium","reasons":["with the H4 trend"]}';
const T0 = Date.parse('2026-11-11T00:00:00Z');

// a provider that counts its calls and reports usage; `mode(n, body)` may return a special answer for call n
function provider({ mode = null, inflate = 1, out = 300 } = {}) {
  const P = { calls: 0, bodies: [] };
  P.fetch = async (url, o = {}) => {
    assert.equal(url, PURL, 'only the fake provider is ever called');
    P.calls++; const body = JSON.parse(o.body); P.bodies.push(body);
    const m = mode && mode(P.calls, body); if (m) return m();
    const chars = body.messages.map((x) => x.content).join('').length;
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: ANSWER }, finish_reason: 'stop' }], usage: { prompt_tokens: Math.ceil((chars / 4) * inflate), completion_tokens: out } }) };
  };
  return P;
}
// OANDA candles: every candle up to and PAST `to` (a feed that misbehaves), the last ones not complete
function oanda(extra = 3) {
  return async (url) => {
    const u = new URL(url), g = u.searchParams.get('granularity'), sec = { D: 86400, H4: 14400, H1: 3600, M15: 900 }[g], to = +u.searchParams.get('to');
    const n = +u.searchParams.get('count'), start = Math.floor(to / sec) * sec - n * sec, c = [];
    for (let t = start; t <= to + extra * sec; t += sec) c.push({ time: String(t), complete: t + sec <= to, mid: { o: String(4000 + t / 1e7), h: '4100', l: '3900', c: '4001' } });
    return { ok: true, json: async () => ({ candles: c }) };
  };
}
const trade = (i, at, o = {}) => ({ id: `xau-replica-b-${i}`, k: 'replica', market: 'xau', side: 'buy', entry: 4000 + i * 0.37, r0: 10, stop: 3990 + i * 0.37, tp1: 4020 + i, opened: at, filled: at, status: 'open', dec: 2, ...o });

function rig({ env = {}, trades = [], research = [], prov = provider(), store = ST.memoryStore(), clock = { t: T0 }, playbook = [] } = {}) {
  const files = { 'trades.json': trades, 'research.json': research, 'macro/forecast.json': { playbook } };
  const E0 = { CRON_SECRET: 'cron-secret-xyz', OANDA_TOKEN: 'oanda-tok', ACADEMY_LLM_KEY: KEY, ACADEMY_LLM_URL: PURL, ACADEMY_LLM_MODEL: 'm', ACADEMY_LLM_RETRIES: '0', ...env };
  const readFile = async (p) => (files[p] ? { ok: true, status: 200, buf: Buffer.from(JSON.stringify(files[p])) } : { ok: false, status: 404 });
  const d = { store, env: E0, readFile, fetch: oanda(), now: () => clock.t, complete: (req, o) => LLM.complete(req, { ...o, fetch: prov.fetch, sleep: async () => {} }) };
  return { d, files, prov, store, clock, env: E0 };
}
const res = () => { const r = { code: 0, body: null, h: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.h[k] = v; }; return r; };
const scanOnce = async (R) => { const r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: AUTH }, r, R.d); assert.equal(r.code, 200, JSON.stringify(r.body)); return r.body; };
const ledger = (store) => LLM._t.ledgerOf(store.peek ? store.peek('cost.json') : undefined);

// ---- budgets ------------------------------------------------------------------------------------------------------------
test('daily budget: a day of scans every 10 minutes never books more than the daily budget when usage matches the estimate', async () => {
  const trades = []; for (let i = 0; i < 60; i++) trades.push(trade(i, T0 / 1000 + 600 + i * 1200));
  const R = rig({ trades }); await R.store.put('state.json', { since: T0 / 1000 });
  for (let m = 10; m < 24 * 60; m += 10) { R.clock.t = T0 + m * 60e3; await scanOnce(R); }
  const L = ledger(R.store), day = L.days['2026-11-11'];
  assert.ok(day.usd <= 0.5 + 1e-9, `day spend ${day.usd}`); assert.ok(R.prov.calls >= 3, 'it did spend up to the budget');
  assert.equal(day.requests, R.prov.calls); assert.ok(day.skipped > 0, 'calls past the budget were refused before they were made');
});

test('the calls cap: at most 12 provider calls a UTC day, then the next UTC day opens again', async () => {
  const trades = []; for (let i = 0; i < 60; i++) trades.push(trade(i, T0 / 1000 + 600 + i * 1200));
  const R = rig({ trades, env: { ACADEMY_LLM_USD_PER_MTOK_IN: '0.01', ACADEMY_LLM_USD_PER_MTOK_OUT: '0.01' } }); await R.store.put('state.json', { since: T0 / 1000 });
  for (let m = 10; m < 24 * 60; m += 10) { R.clock.t = T0 + m * 60e3; await scanOnce(R); }
  assert.equal(R.prov.calls, 12);
  R.clock.t = T0 + 24 * 3600e3 + 60e3; await scanOnce(R);   // 00:01 UTC of the next day
  assert.ok(R.prov.calls > 12);
  assert.equal(ledger(R.store).days['2026-11-12'].requests, R.prov.calls - 12);
});

test('monthly and hard budgets, and the UTC month rollover', async () => {
  const at = Date.parse('2026-11-30T23:50:00Z') / 1000, cheap = { EDGE_LLM_DAILY_USD: '100', EDGE_LLM_MAX_CALLS_DAY: '1000' };
  // month full on 30 Nov: refused at 23:55 UTC, allowed at 00:05 UTC on 1 Dec (a new month and day bucket)
  let R = rig({ trades: [trade(1, at)], env: cheap });
  await R.store.put('state.json', { since: at - 10 }); await R.store.put('cost.json', { v: 1, days: {}, months: { '2026-11': { usd: 4.99 } }, total: { usd: 4.99 } });
  R.clock.t = Date.parse('2026-11-30T23:55:00Z'); let b = await scanOnce(R);
  assert.equal(R.prov.calls, 0); assert.match(b.skipped[0].why, /month/);
  R.clock.t = Date.parse('2026-12-01T00:05:00Z'); b = await scanOnce(R);
  assert.equal(R.prov.calls, 1); assert.equal(b.studied.length, 1);
  // the hard stop is lifetime: a new month does not reopen it
  R = rig({ trades: [trade(2, at)], env: { ...cheap, EDGE_LLM_MONTHLY_USD: '100' } });
  await R.store.put('state.json', { since: at - 10 }); await R.store.put('cost.json', { v: 1, days: {}, months: {}, total: { usd: 24.99 } });
  R.clock.t = Date.parse('2026-12-01T00:05:00Z'); b = await scanOnce(R);
  assert.equal(R.prov.calls, 0); assert.match(b.skipped[0].why, /hard-stop/);
});

test('the day bucket is the UTC day: a full day at 23:59 UTC does not block 00:01 UTC', async () => {
  const at = Date.parse('2026-11-11T23:50:00Z') / 1000;
  const R = rig({ trades: [trade(1, at)] }); await R.store.put('state.json', { since: at - 10 });
  await R.store.put('cost.json', { v: 1, days: { '2026-11-11': { usd: 0.49, requests: 3 } }, months: { '2026-11': { usd: 0.49 } }, total: { usd: 0.49 } });
  R.clock.t = Date.parse('2026-11-11T23:59:00Z'); await scanOnce(R); assert.equal(R.prov.calls, 0);
  R.clock.t = Date.parse('2026-11-12T00:01:00Z'); await scanOnce(R); assert.equal(R.prov.calls, 1);
});

test('known bound: a provider that reports more input tokens than chars/4 can take the day past its budget by that one call\'s difference', async () => {
  const trades = []; for (let i = 0; i < 40; i++) trades.push(trade(i, T0 / 1000 + 600 + i * 1200));
  const R = rig({ trades, prov: provider({ inflate: 1.6, out: 900 }) }); await R.store.put('state.json', { since: T0 / 1000 });
  let worst = 0;
  for (let m = 10; m < 24 * 60; m += 10) { R.clock.t = T0 + m * 60e3; await scanOnce(R); }
  const day = ledger(R.store).days['2026-11-11'];
  // the reservation (estimate) is checked; what is booked after is what the provider reported (docs/academy/LLM.md section 4)
  for (const b of R.prov.bodies) worst = Math.max(worst, Math.ceil(b.messages.map((x) => x.content).join('').length / 4) * 0.6 * 10 / 1e6);
  assert.ok(day.usd <= 0.5 + worst + 1e-9, `over by more than one call's underestimate: ${day.usd}`);
});

// ---- a retry, a failure, two instances, a stale read -------------------------------------------------------------------
test('a retry after a 503 is one reservation; a refused (unbilled) call gives it back and leaves the entry for the next run', async () => {
  const fail503 = () => ({ ok: false, status: 503, headers: { get: () => null }, json: async () => ({ error: { type: 'overloaded', message: `bad ${KEY}` } }) });
  let R = rig({ trades: [trade(1, T0 / 1000)], env: { ACADEMY_LLM_RETRIES: '1' }, prov: provider({ mode: (n) => (n === 1 ? fail503 : null) }) });
  await R.store.put('state.json', { since: T0 / 1000 - 10 }); R.clock.t = T0 + 60e3;
  let b = await scanOnce(R);
  assert.equal(R.prov.calls, 2); assert.equal(b.studied.length, 1); assert.equal(ledger(R.store).days['2026-11-11'].requests, 1, 'one reservation for the call and its retry');
  R = rig({ trades: [trade(2, T0 / 1000)], prov: provider({ mode: () => fail503 }) });
  await R.store.put('state.json', { since: T0 / 1000 - 10 }); R.clock.t = T0 + 60e3;
  b = await scanOnce(R);
  assert.ok(!JSON.stringify(b).includes(KEY), 'the key is never in the cron answer');
  const L = ledger(R.store).days['2026-11-11']; assert.equal(L.usd, 0); assert.equal(L.requests, 0); assert.equal(L.errors, 1);
  assert.equal(R.store.peek('reviews.json').rows.length, 0, 'an unbilled failure is tried again later');
});

test('a billed answer that cannot be used is stored as refused and never paid for again', async () => {
  const empty = () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: '' }, finish_reason: 'length' }], usage: { prompt_tokens: 3000, completion_tokens: 900 } }) });
  const timeout = () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); };
  for (const [name, m] of [['empty answer', empty], ['timeout', timeout]]) {
    const R = rig({ trades: [trade(1, T0 / 1000)], prov: provider({ mode: () => m }) });
    await R.store.put('state.json', { since: T0 / 1000 - 10 });
    for (let k = 1; k <= 6; k++) { R.clock.t = T0 + k * 600e3; await scanOnce(R); }
    assert.equal(R.prov.calls, 1, `${name}: paid once, not every run`);
    const rows = R.store.peek('reviews.json').rows; assert.equal(rows.length, 1); assert.ok(rows[0].refused, `${name}: stored as refused`);
  }
  // a parse that fails is stored as refused too, and the entry is not asked again
  const R = rig({ trades: [trade(1, T0 / 1000)], prov: provider({ mode: () => () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: 'buy it' } }], usage: { prompt_tokens: 10, completion_tokens: 3 } }) }) }) });
  await R.store.put('state.json', { since: T0 / 1000 - 10 });
  for (let k = 1; k <= 3; k++) { R.clock.t = T0 + k * 600e3; await scanOnce(R); }
  assert.equal(R.prov.calls, 1); assert.ok(R.store.peek('reviews.json').rows[0].refused);
});

test('two scans at once in one instance share the store\'s lock (the cost ledger loses no write)', async () => {
  const W = blobService(), env = { ...W.env }, io = { blob: { ...W.blob, put: async (...a) => { await new Promise((r) => setTimeout(r, 5)); return W.blob.put(...a); } }, fetch: W.fetch, recent: new Map() };
  assert.equal(typeof EP.storeOf, 'function');
  const a = EP.storeOf(env, io), b = EP.storeOf(env, io);
  const bump = (s) => s.update('cost.json', { n: 0 }, (c) => ({ n: (c.n || 0) + 1 }));
  await Promise.all([bump(a), bump(b), bump(a), bump(b)]);
  assert.equal(W.json('edge-analyst/cost.json').n, 4);
});

test('another instance never reads an old cost.json from the CDN: the spend it did not make still blocks it', async () => {
  const W = blobService(), env = { ...W.env };
  const inst = () => ({ blob: W.blob, fetch: W.fetch, recent: new Map(), now: () => W.now });
  const A = ST.make(ST.blobBackend(env, { ...inst(), root: 'edge-analyst/' })), B = ST.make(ST.blobBackend(env, { ...inst(), root: 'edge-analyst/' }));
  await A.put('cost.json', LLM.emptyLedger()); await B.get('cost.json');                // the CDN now holds the empty ledger
  await W.fetch('https://store.private.blob.invalid/edge-analyst/cost.json', { headers: { Authorization: 'Bearer tok' } });
  await A.put('cost.json', { v: 1, days: { '2026-11-11': { usd: 0.49, requests: 5 } }, months: { '2026-11': { usd: 0.49 } }, total: { usd: 0.49 } });
  const R = rig({ trades: [trade(1, T0 / 1000)], store: B }); await B.put('state.json', { since: T0 / 1000 - 10 }); R.clock.t = T0 + 60e3;
  const b = await scanOnce(R);
  assert.equal(R.prov.calls, 0); assert.match(b.skipped[0].why, /day/);
});

test('known limit (the store says so): two INSTANCES that read and write cost.json in the same moment can lose a reservation', async () => {
  const W = blobService(), env = { ...W.env };
  const A = ST.make(ST.blobBackend(env, { blob: W.blob, fetch: W.fetch, recent: new Map(), root: 'edge-analyst/' }), new Map());
  const B = ST.make(ST.blobBackend(env, { blob: W.blob, fetch: W.fetch, recent: new Map(), root: 'edge-analyst/' }), new Map());
  await A.put('cost.json', { n: 0 });
  W.onPut = async () => { await B.update('cost.json', { n: 0 }, (c) => ({ n: c.n + 1 })); };   // B writes while A's upload is on its way
  await A.update('cost.json', { n: 0 }, (c) => ({ n: c.n + 1 }));
  assert.equal(W.json('edge-analyst/cost.json').n, 1, 'one of the two reservations is lost (no conditional write yet)');
});

// ---- off switches ---------------------------------------------------------------------------------------------------------
test('EDGE_ANALYST=off, EDGE_LLM_STOP=1, no key or a non-https endpoint: no provider call at all', async () => {
  for (const env of [{ EDGE_ANALYST: 'off' }, { EDGE_ANALYST: 'OFF' }, { EDGE_LLM_STOP: '1' }, { EDGE_LLM_STOP: 'true' }, { ACADEMY_LLM_KEY: '' }, { ACADEMY_LLM_URL: 'http://llm.example.invalid/v1' }, { ACADEMY_LLM_MODEL: '' }]) {
    const R = rig({ trades: [trade(1, T0 / 1000)], env }); await R.store.put('state.json', { since: T0 / 1000 - 10 }); R.clock.t = T0 + 60e3;
    await scanOnce(R); await scanOnce(R);
    assert.equal(R.prov.calls, 0, JSON.stringify(env));
    assert.ok(!R.store.peek('reviews.json') || !R.store.peek('reviews.json').rows.length);
  }
});

// ---- no look-ahead -------------------------------------------------------------------------------------------------------
test('the request a provider receives holds no candle that ended after the entry, no actual, no outcome', async () => {
  const at = Date.parse('2026-11-11T14:37:00Z') / 1000;   // inside a D1, H4, H1 and M15 candle
  const closed = trade(1, at, { status: 'win', R: 2.5, Rnet: 2.41, exit: 4031.5, exitPx: 4031.5, closed: at + 7200, mfe: 3.1, mae: 0.2, stop: 4012.34, trailMoved: true, best: 4040.5, pm: 'post-mortem', feat: { atrR: 0.4, regime: 'up', Rfinal: 9, mfeR: 1, pull: true } });
  const pb = [{ at: '2026-11-11T13:30:00Z', country: 'USD', title: 'CPI m/m', consensus: '0.3%', previous: '0.2%', actual: '0.77%' }, { at: '2026-11-11T19:00:00Z', country: 'USD', title: 'FOMC', consensus: null, previous: '4.00%', actual: '3.75%' }];
  const R = rig({ trades: [closed], playbook: pb }); await R.store.put('state.json', { since: at - 10 }); R.clock.t = (at + 3 * 3600) * 1000;
  await scanOnce(R); assert.equal(R.prov.calls, 1);
  const body = R.prov.bodies[0], all = JSON.stringify(body), prompt = body.messages.at(-1).content;
  const payload = JSON.parse(prompt.slice(prompt.indexOf('{'), prompt.lastIndexOf('}') + 1));
  const SEC = { D1: 86400, H4: 14400, H1: 3600, M15: 900 };
  for (const [tf, rows] of Object.entries(payload.candlesClosedBeforeEntry)) {
    assert.ok(rows.length > 0, tf);
    for (const c of rows) assert.ok(Date.parse(`${c[0].replace(' ', 'T')}:00Z`) / 1000 + SEC[tf] <= at, `${tf} candle ${c[0]} ended after the entry`);
  }
  for (const bad of ['0.77%', '3.75%', 'actual', '4031.5', '2.41', '4012.34', '4040.5', 'post-mortem', '"win"', 'Rfinal', 'mfeR', 'trailMoved']) assert.ok(!all.includes(bad), `no ${bad}`);
  assert.equal(payload.trade.stop, 3990.37, 'the opening stop from r0');
  assert.ok(!JSON.stringify(Object.keys(body)).includes('key') && !all.includes(KEY), 'the key travels only in the header');
});

test('a record with no opening risk whose stop has trailed is not studied with the moved stop', async () => {
  // NQ open-run records carry no r0 / stop0, and the Trader trails their `stop` after +2R (trailMoved)
  const at = T0 / 1000 + 3600;
  const nq = { id: 'nq-nyflip-2026-11-11', k: 'nq-open', session: 'nyflip', market: 'nq', side: 'buy', entry: 25000, stop: 25040, trailMoved: true, t1: 25600, tp1: 25120, opened: at, filled: at, status: 'open', dec: 2 };
  assert.equal(E.stopAtEntry(nq), null, 'the opening stop is unknown');
  assert.equal(E.stopAtEntry({ ...nq, trailMoved: false, stop: 24940 }), 24940, 'an unmoved stop is the opening one');
  const R = rig({ research: [nq] }); await R.store.put('state.json', { since: at - 10 }); R.clock.t = (at + 1800) * 1000;
  await scanOnce(R);
  assert.equal(R.prov.calls, 0); assert.ok(!R.prov.bodies.some((b) => JSON.stringify(b).includes('25040')));
});

// ---- the read endpoint ---------------------------------------------------------------------------------------------------
test('GET: owner and reviewers only; never the key, a cron or OANDA secret, the endpoint or a token', async () => {
  const R = rig({ trades: [trade(1, T0 / 1000)], env: { BLOB_READ_WRITE_TOKEN: 'blob-tok-secret', ACADEMY_LLM_URL: 'https://llm.example.invalid/v1/chat?key=urlsecret' } });
  await R.store.put('state.json', { since: T0 / 1000 - 10 }); R.clock.t = T0 + 60e3;
  R.d.complete = (req, o) => LLM.complete(req, { ...o, fetch: async (url, x) => R.prov.fetch(PURL, x), sleep: async () => {} });
  await scanOnce(R);
  for (const [who, code] of [[null, 401], [{ u: 'carlos', role: 'viewer' }, 403], [{ u: 'luxus', role: 'viewer', perms: { council: true } }, 403], [{ u: 'x', role: 'member' }, 403], [{ u: 'fred', role: 'reviewer' }, 200], [{ u: 'owner', role: 'owner' }, 200]]) {
    const r = res(); await EP.handle({ method: 'GET', query: {}, headers: {} }, r, { ...R.d, who: async () => who }); assert.equal(r.code, code, JSON.stringify(who));
    const txt = JSON.stringify(r.body);
    for (const s of [KEY, 'cron-secret-xyz', 'oanda-tok', 'blob-tok-secret', 'urlsecret']) assert.ok(!txt.includes(s), `${s} leaked to ${JSON.stringify(who)}`);
    assert.equal(r.h['Cache-Control'], 'private, no-store');
  }
  // a wrong cron secret or none: 401, nothing run
  for (const h of [{}, { authorization: 'Bearer nope' }, { authorization: 'cron-secret-xyz' }]) { const r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: h }, r, R.d); assert.equal(r.code, 401); }
  const r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: AUTH }, r, { ...R.d, env: { ...R.env, CRON_SECRET: '' } }); assert.equal(r.code, 401, 'no CRON_SECRET set: the scan is closed');
});
