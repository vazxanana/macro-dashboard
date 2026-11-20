// The trade reviewer's language-model part (api/_trade-review.js, api/trade-review.js), its wiring on both hosts and the page
// card (17 Nov 2026). Offline: a fake model, a memory store, the made-up desk of tests/fixtures/trade-review.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as T from '../council/trade-review.mjs';

const require = createRequire(import.meta.url);
const R = require('../api/_trade-review.js'), H = require('../api/trade-review.js'), ST = require('../api/_academy-store.js'), LLM = require('../api/_academy-llm.js');
const FX = new URL('./fixtures/trade-review/', import.meta.url).pathname, NOW = 1794700800;
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const FILE = () => { const r = T.main(FX, { dry: true, now: NOW }); r.J.hash = T.hashOf(r.J); return r.J; };
const KEY_ENV = { BLOB_READ_WRITE_TOKEN: 'x', CRON_SECRET: 'cron-secret-123456', ACADEMY_LLM_KEY: 'k-test', ACADEMY_LLM_URL: 'https://llm.invalid/v1', ACADEMY_LLM_MODEL: 'm-test' };
function res() { const o = { code: 0, body: null, h: {} }; return Object.assign(o, { setHeader: (k, v) => { o.h[k] = v; }, status: (c) => { o.code = c; return o; }, json: (b) => { o.body = b; return o; } }); }
const readFile = (file) => async (p) => (p === 'research/trade-review.json' && file ? { status: 200, ok: true, buf: Buffer.from(JSON.stringify(file)) } : { status: 404, ok: false });
const answer = (J) => {
  const sc = J.systems.find((s) => s.key === 'scalp|shadow'), geg = J.systems.find((s) => s.key === 'geg|live');
  return JSON.stringify({ overview: 'The shadow scalps lose in Asia; the live book is too young to judge.', streams: [
    { key: sc.key, review: 'Asia fills lose.', working: ['overlap fills'], losing: ['Asia fills'], proposals: [
      { flag: 'scalp|shadow|weak-session:asia', change: 'Skip Asia for the scalps', why: 'It loses there (n 999, t -99 says the model).' },
      { flag: 'made-up|flag', change: 'Remove the stop', why: 'no' },
      { flag: geg ? 'geg|live|losing' : 'x', change: 'Another stream\'s flag', why: 'no' }] },
    { key: 'not-a-stream', review: 'x' },
  ] });
};

test('trade reviewer: the request holds the file\'s streams and flags only, and fits the long prompt limit', () => {
  const J = FILE(), q = R.buildRequest(J);
  assert.ok(q.prompt.length + q.system.length < LLM.PROMPT_MAX_LONG);
  const keys = q.payload.streams.map((s) => s.key);
  assert.ok(keys.includes('scalp|shadow') && keys.includes('replica|research'));
  const rank = (k) => (k.endsWith('|live') ? 0 : k.endsWith('|shadow') ? 1 : 2);
  assert.deepEqual(keys.map(rank), keys.map(rank).slice().sort());   // live first, then shadow, then research
  assert.ok(!keys.includes('geg|live'), 'a stream under 5 trades with no flag is left out');
  assert.doesNotMatch(q.prompt, /ict:nq-b-1/);
  assert.match(q.system, /MUST name exactly one flag id/); assert.match(q.system, /PAPER/); assert.match(q.system, /removing a stop/);
  const s = q.payload.streams.find((x) => x.key === 'scalp|shadow');
  assert.ok(s.flags.some((f) => f.id === 'scalp|shadow|weak-session:asia' && Number.isFinite(f.n) && Number.isFinite(f.t)));
});

test('trade reviewer: the answer is checked against the file; evidence and the test come from the file, never the model', () => {
  const J = FILE(), p = R.parseAnswer('```json\n' + answer(J) + '\n```', J);
  assert.equal(p.ok, true);
  assert.equal(p.answer.streams.length, 1); assert.equal(p.answer.streams[0].key, 'scalp|shadow');
  const P = p.answer.streams[0].proposals; assert.equal(P.length, 1); assert.equal(p.answer.dropped, 2);
  const flag = J.flags.find((f) => f.id === 'scalp|shadow|weak-session:asia');
  assert.equal(P[0].evidence.n, flag.n); assert.equal(P[0].evidence.t, flag.t); assert.equal(P[0].evidence.inSample, true);
  assert.equal(P[0].test.data, '2020-01-01 → now');
  assert.equal(R.parseAnswer('no json here', J).ok, false);
  assert.equal(R.parseAnswer(JSON.stringify({ streams: [{ key: 'nope' }] }), J).ok, false);
});

test('trade reviewer endpoint: cron secret, off without a key, one call per new reading, owner and reviewers only', async () => {
  const J = FILE(), store = ST.memoryStore();
  let r = res(); await H.handle({ method: 'GET', query: { job: 'review' }, headers: {} }, r, { env: KEY_ENV, store }); assert.equal(r.code, 401);
  // no key: nothing is asked
  let calls = 0; const complete = async (q) => { calls++; assert.match(q.prompt, /scalp\|shadow/); return { available: true, text: answer(J), provider: 'fake', costUsd: 0.01 }; };
  r = res(); await H.handle({ method: 'GET', query: { job: 'review' }, headers: { authorization: 'Bearer cron-secret-123456' } }, r, { env: { BLOB_READ_WRITE_TOKEN: 'x', CRON_SECRET: KEY_ENV.CRON_SECRET }, store, complete, readFile: readFile(J) });
  assert.equal(r.code, 200); assert.ok(r.body.off); assert.equal(calls, 0);
  // switched off by its own flag
  r = res(); await H.handle({ method: 'GET', query: { job: 'review' }, headers: { authorization: 'Bearer cron-secret-123456' } }, r, { env: { ...KEY_ENV, TRADE_REVIEW: 'off' }, store, complete, readFile: readFile(J) });
  assert.ok(r.body.off); assert.equal(calls, 0);
  // with a key: one call, stored with the file's mark
  const d = { env: KEY_ENV, store, complete, readFile: readFile(J), now: () => NOW * 1000 };
  r = res(); await H.handle({ method: 'GET', query: { job: 'review' }, headers: { authorization: 'Bearer cron-secret-123456' } }, r, d);
  assert.equal(r.code, 200); assert.equal(r.body.ok, true); assert.equal(calls, 1);
  const doc = store.peek('latest.json'); assert.equal(doc.reviewAt, J.at); assert.equal(doc.answer.streams[0].proposals.length, 1);
  // the same reading again, or a new one inside 12 hours: no call
  r = res(); await H.handle({ method: 'GET', query: { job: 'review' }, headers: { authorization: 'Bearer cron-secret-123456' } }, r, d); assert.match(r.body.skipped, /already/); assert.equal(calls, 1);
  const J2 = { ...J, hash: 'other', at: '2026-11-15T01:00:00.000Z' };
  r = res(); await H.handle({ method: 'GET', query: { job: 'review' }, headers: { authorization: 'Bearer cron-secret-123456' } }, r, { ...d, readFile: readFile(J2) }); assert.match(r.body.skipped, /too soon/); assert.equal(calls, 1);
  r = res(); await H.handle({ method: 'GET', query: { job: 'review' }, headers: { authorization: 'Bearer cron-secret-123456' } }, r, { ...d, readFile: readFile(J2), now: () => (NOW + H.MIN_GAP_S + 1) * 1000 }); assert.equal(r.body.ok, true); assert.equal(calls, 2);
  // a budget skip is not stored and is tried again
  const st2 = ST.memoryStore();
  r = res(); await H.handle({ method: 'GET', query: { job: 'review' }, headers: { authorization: 'Bearer cron-secret-123456' } }, r, { ...d, store: st2, complete: async () => ({ available: true, skipped: 'budget', scope: 'day' }) });
  assert.match(r.body.skipped, /budget/); assert.equal(st2.peek('latest.json'), undefined);
  // reading: owner and reviewers
  r = res(); await H.handle({ method: 'GET', query: {}, headers: {} }, r, { env: KEY_ENV, store, who: async () => null }); assert.equal(r.code, 401);
  r = res(); await H.handle({ method: 'GET', query: {}, headers: {} }, r, { env: KEY_ENV, store, who: async () => ({ u: 'carlos', role: 'viewer' }) }); assert.equal(r.code, 403);
  r = res(); await H.handle({ method: 'GET', query: {}, headers: {} }, r, { env: KEY_ENV, store, who: async () => ({ u: 'owner', role: 'owner' }) });
  assert.equal(r.code, 200); assert.equal(r.body.enabled, true); assert.ok(r.body.ai.answer);
  r = res(); await H.handle({ method: 'POST', query: {}, headers: {} }, r, { env: KEY_ENV, store }); assert.equal(r.code, 405);
});

test('trade reviewer: its own budgets and kill switches', () => {
  const e = H.llmEnv({ ACADEMY_LLM_DAILY_USD: '9' });
  assert.equal(e.ACADEMY_LLM_DAILY_USD, '0.5'); assert.equal(e.ACADEMY_LLM_MAX_CALLS_DAY, '2'); assert.equal(e.ACADEMY_LLM_STOP, '');
  assert.equal(H.llmEnv({ TRADE_REVIEW_LLM_STOP: '1' }).ACADEMY_LLM_STOP, '1');
  assert.equal(H.llmEnv({ TRADE_REVIEW: 'off' }).ACADEMY_LLM_STOP, '1');
  assert.equal(H.llmEnv({ TRADE_REVIEW_LLM_DAILY_USD: '0.2' }).ACADEMY_LLM_DAILY_USD, '0.2');
  // nothing of the council, the mirror or order code is imported; nothing writes council-data
  for (const f of ['api/trade-review.js', 'api/_trade-review.js']) {
    const s = src(f); assert.doesNotMatch(s, /require\('\.\.\/council|ctrader|mirror|dataWrite|PUT/);
  }
});

test('trade reviewer: wired on Cloudflare (handler + chained after the 10-minute cron); its function entry in vercel.json', () => {
  const w = src('cloudflare/src/worker.mjs');
  assert.match(w, /import tradeReview from '\.\.\/\.\.\/api\/trade-review\.js'/); assert.match(w, /'trade-review': tradeReview/);
  assert.match(w, /CHAINED = \{ '\*\/10 \* \* \* \*': \[[^\]]*'\/api\/trade-review\?job=review'\] \}/);   // after the watchdog kick (18 Nov 2026)
  const v = JSON.parse(src('vercel.json'));
  assert.ok(v.functions['api/trade-review.js']); assert.equal(v.crons, undefined, 'no Vercel cron: the Worker runs it (17 Nov 2026)');
});

test('trade review card: admin only, its own style and script, reads through msData, renders the file', () => {
  const html = src('market-structure.html');
  assert.match(html, /<div class="card adm" id="ms-tr">\s*<style id="ms-tr-css">/);
  const css = html.match(/<style id="ms-tr-css">([\s\S]*?)<\/style>/)[1];
  assert.match(css, /var\(--au-ink, var\(--ink\)\)/); assert.match(css, /var\(--au-accent/); assert.match(css, /pointer: coarse[^}]*min-height: 44px/);
  for (const m of css.matchAll(/font-size: (\d+)px/g)) assert.ok(+m[1] >= 12, `font ${m[1]}px`);
  const js = html.match(/<script id="ms-tr-js">([\s\S]*?)<\/script>/)[1];
  assert.match(js, /msData\.json\('research\/trade-review\.json'\)/); assert.doesNotMatch(js, /\/cdata\//);
  assert.match(js, /fetch\('\/api\/trade-review'/);
  // run its pure pieces on the fixture's reading
  const W = {}, el = () => ({ addEventListener() {}, querySelectorAll: () => [], set innerHTML(v) { this.h = v; }, set textContent(v) { this.t = v; } });
  vm.runInNewContext(js, { window: W, document: { getElementById: el, documentElement: { dataset: { role: 'viewer' } } }, localStorage: { getItem: () => null, setItem() {} }, location: { protocol: 'https:', hostname: 'x' }, setInterval() {}, fetch() {} });
  const J = FILE(), M = W.MS_TR;
  assert.match(M.sumLine(J), /Live book/); assert.match(M.sumLine(J), /proposals only/);
  assert.equal(M.streamsOf(J, 'live').length, 2); assert.equal(M.streamsOf(J, 'all').length, 4);
  const sc = J.systems.find((s) => s.key === 'scalp|shadow'), F = Object.fromEntries(J.flags.map((f) => [f.id, f]));
  const h = M.streamHTML(sc, F); assert.match(h, /Forward record/); assert.match(h, /Demo copies/); assert.match(h, /Survives Holm/);
  const p = M.propHTML(J.proposals[0], 0); assert.match(p, /In sample/); assert.match(p, /2020-01-01 → now/);
  assert.match(M.aiHTML({ enabled: false, reason: 'no language-model key configured', ai: null }), /rule-based review above is the whole review/);
});

test('trade review: the week pane lists its strong proposals only', () => {
  const html = src('market-structure.html'), m = html.match(/<script id="ms-wk-js">([\s\S]*?)<\/script>/), W = {};
  vm.runInNewContext(m[1], { window: W });
  const J = FILE(), now = NOW;
  const L = W.MS_WEEK.decisions({ tradeReview: J }, now, []).filter((d) => d.k === 'review');
  assert.equal(L.length, J.proposals.filter((p) => p.strong).length);
  assert.ok(L.length >= 1); assert.match(L[0].title, /^Trade review: /); assert.match(L[0].detail, /t −?\d/); assert.match(L[0].act, /Nothing was changed/);
  assert.equal(W.MS_WEEK.decisions({ tradeReview: { proposals: J.proposals.map((p) => ({ ...p, strong: false })) } }, now, []).filter((d) => d.k === 'review').length, 0);
  assert.match(html, /get\('research\/trade-review\.json'\)\]\)\.then/);
});

// ---- 20 Nov 2026 audit ----
test('trade reviewer: a model proposal for a stream the desk itself proposes nothing for is discarded; the by-day t and the regime note reach the model', () => {
  const D = T.readData(FX), J = T.build({ ...D, config: { shadowCut: { setups: ['scalp'], keep: [] } } }, { now: NOW });
  const sc = J.systems.find((s) => s.key === 'scalp|shadow');
  assert.equal(sc.stopped, true); assert.equal(R.closedWhy(sc), 'its shadow signals are no longer recorded (owner, 12 Nov 2026)');
  const q = R.buildRequest(J), s = q.payload.streams.find((x) => x.key === 'scalp|shadow');
  assert.match(s.closed, /no longer recorded/); assert.match(q.system, /"closed" set/); assert.match(q.system, /tByDay/); assert.match(q.system, /regimeNote/);
  const f = s.flags.find((x) => x.id === 'scalp|shadow|weak-session:asia');
  assert.ok('tByDay' in f && Number.isInteger(f.days), 'the by-day t travels with the flag');
  assert.ok('netTByDay' in s.all && Number.isInteger(s.all.days));
  const p = R.parseAnswer(answer(J), J);
  assert.equal(p.ok, true); assert.equal(p.answer.streams[0].proposals.length, 0, 'before the audit the model could propose "Skip Asia" for a stream the owner had stopped');
  assert.equal(p.answer.dropped, 3);
  // the stream open again: the proposal comes back, with the by-day evidence of the file
  const open = FILE(), po = R.parseAnswer(answer(open), open).answer.streams[0].proposals;
  assert.equal(po.length, 1); assert.ok(po[0].evidence.byDay && typeof po[0].evidence.robust === 'boolean');
});
