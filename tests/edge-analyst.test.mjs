// The edge analyst (api/_edge-analyst.js + api/edge-analyst.js): a language model's blind second opinion on each live entry of
// the seven edges. Offline: memory store, fake council-data, fake candles, fake model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const E = require('../api/_edge-analyst.js');
const EP = require('../api/edge-analyst.js');
const ST = require('../api/_academy-store.js');

const NOW = Date.parse('2026-11-11T15:00:00Z'), T = Math.floor(NOW / 1000);
const live = (o) => ({ id: 'xau-replica-b-1', k: 'replica', market: 'xau', side: 'buy', entry: 4000, r0: 10, stop: 4005, tp1: 4020, opened: T - 3600, status: 'open', dec: 2,
  feat: { atrR: 0.4, R: 3, exitPx: 1, mfe: 2, bias: 'up' }, ...o });

test('candidates: live entries of the seven edges only, new, not studied, entered after the start', () => {
  const trades = [live(), live({ id: 'sh', shadow: true }), live({ id: 'add', addOf: 'x' }), live({ id: 'pend', status: 'pending' }), live({ id: 'old', opened: T - 4 * 86400 }),
    live({ id: 'pre', opened: T - 7200 }), live({ id: 'other', k: 'scalp' }), live({ id: 'eu', market: 'eurusd' }), live({ id: 'done' })];
  const research = [{ id: 'nq-nyflip-1', k: 'nq-open', session: 'nyflip', market: 'nq', side: 'sell', entry: 25000, r0: 20, opened: T - 600, status: 'open' },
    { id: 'nq-nyflipt-1', k: 'nq-open', session: 'nyflip-trend', market: 'nq', side: 'sell', entry: 25000, r0: 20, opened: T - 600, shadow: true }];
  const got = E.candidates(trades, research, ['done'], T, T - 5000).map((x) => x.id);
  assert.deepEqual(got, ['xau-replica-b-1', 'nq-nyflip-1']);
});

test('the request holds nothing known after the entry', () => {
  const x = live({ R: 2.5, Rnet: 2.4, exit: 4025, closed: T, status: 'win', stop: 4010, mfe: 3 });
  const sec = 3600, bars = { H1: [{ time: x.opened - 2 * sec, open: 1, high: 2, low: 0.5, close: 1.5 }, { time: x.opened - sec, open: 1, high: 2, low: 0.5, close: 1.5 },
    { time: x.opened, open: 9, high: 9, low: 9, close: 9 }, { time: x.opened - sec / 2, open: 7, high: 7, low: 7, close: 7, complete: false }] };
  const pb = [{ at: new Date((x.opened + 3600) * 1000).toISOString(), country: 'USD', title: 'CPI', consensus: '0.3%', previous: '0.2%', actual: '0.9%' }];
  const q = E.buildRequest(x, bars, pb), txt = q.prompt;
  assert.equal(q.payload.candlesClosedBeforeEntry.H1.length, 2, 'only candles that ended at or before the entry');
  assert.ok(!txt.includes('"9"') && !txt.includes(',9,'), 'the candle at the entry is not sent');
  assert.equal(q.payload.trade.stop, 3990, 'the opening stop, not the trailed one');
  for (const bad of ['"Rnet"', '"R"', '"exit"', '"closed"', '"mfe"', '"exitPx"', '"win"', '0.9%', '"actual"', '4025']) assert.ok(!txt.includes(bad), `no ${bad} in the request`);
  assert.deepEqual(Object.keys(q.payload.trade.features).sort(), ['atrR', 'bias']);
  assert.equal(q.payload.releases[0].alreadyOut, false);
});

test('parseAnswer checks the answer in code', () => {
  assert.equal(E.parseAnswer('no json').ok, false);
  assert.equal(E.parseAnswer('{"verdict":"BUY","confidence":"high","reasons":["a"]}').ok, false);
  assert.equal(E.parseAnswer('{"verdict":"take","confidence":"low","reasons":[]}').ok, false);
  const p = E.parseAnswer('Sure: {"verdict":"reduce","confidence":"Medium","reasons":["near resistance"],"risks":["CPI tomorrow"],"wouldChange":"a close above 4010"}');
  assert.ok(p.ok); assert.equal(p.answer.verdict, 'REDUCE'); assert.equal(p.answer.confidence, 'medium');
});

test('stats: too few to judge under 20 closed, follow-the-AI arithmetic', () => {
  const row = (v, R) => ({ answer: { verdict: v }, result: { R } });
  const s = E.stats([row('TAKE', 2), row('SKIP', -1), row('REDUCE', -1), { answer: { verdict: 'TAKE' } }]);
  assert.equal(s.studied, 4); assert.equal(s.closed, 3); assert.equal(s.takeAll, 0); assert.equal(s.followAI, 1.5); assert.equal(s.judged, false);
  assert.match(s.note, /Too few to judge: 3 of 20/);
});

function rig({ key = true, answer = '{"verdict":"SKIP","confidence":"low","reasons":["into the prior day high"]}' } = {}) {
  const store = ST.memoryStore(), calls = [];
  const files = { 'trades.json': [live()], 'research.json': [], 'macro/forecast.json': { playbook: [] } };
  const env = { CRON_SECRET: 'cron-secret-xyz', OANDA_TOKEN: 'tok', ...(key ? { ACADEMY_LLM_KEY: 'k', ACADEMY_LLM_URL: 'https://llm.example/v1', ACADEMY_LLM_MODEL: 'm' } : {}) };
  const readFile = async (p) => (files[p] ? { ok: true, status: 200, buf: Buffer.from(JSON.stringify(files[p])) } : { ok: false, status: 404 });
  const fetch = async (url) => { const g = new URL(url).searchParams.get('granularity'), sec = { D: 86400, H4: 14400, H1: 3600, M15: 900 }[g], to = +new URL(url).searchParams.get('to');
    const c = []; for (let t = to - 5 * sec; t <= to; t += sec) c.push({ time: String(t), complete: t + sec <= T, mid: { o: '1', h: '2', l: '0.5', c: '1.5' } });
    return { ok: true, json: async () => ({ candles: c }) }; };
  const complete = async (req) => { calls.push(req); return { available: true, text: answer, costUsd: 0.01, provider: 'fake', model: 'm' }; };
  return { store, files, env, calls, d: { store, env, readFile, fetch, complete, now: () => NOW } };
}
const res = () => { const r = { code: 0, body: null, h: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.h[k] = v; }; return r; };

test('cron: needs the secret; first run only records the start', async () => {
  const R = rig();
  let r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: {} }, r, R.d); assert.equal(r.code, 401);
  r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: { authorization: 'Bearer cron-secret-xyz' } }, r, R.d);
  assert.equal(r.code, 200); assert.equal(r.body.studied.length, 0, 'the trade entered before the first run is not studied');
  assert.equal(R.calls.length, 0);
});

test('cron: studies a new entry once, puts the result beside it later', async () => {
  const R = rig(); await R.store.put('state.json', { since: T - 7200 });
  const auth = { authorization: 'Bearer cron-secret-xyz' };
  let r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: auth }, r, R.d);
  assert.deepEqual(r.body.studied, [{ id: 'xau-replica-b-1', verdict: 'SKIP' }]);
  assert.ok(!/"R"|"Rnet"|"exit"/.test(R.calls[0].prompt));
  r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: auth }, r, R.d);
  assert.equal(R.calls.length, 1, 'never studied twice');
  R.files['trades.json'] = [live({ status: 'loss', R: -1, Rnet: -1.05, closed: T })];
  r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: auth }, r, R.d);
  assert.equal(r.body.results, 1);
  const row = R.store.peek('reviews.json').rows[0]; assert.equal(row.result.R, -1.05); assert.equal(row.answer.verdict, 'SKIP');
});

test('cron: no key = no call; a bad answer is stored as refused', async () => {
  let R = rig({ key: false }); await R.store.put('state.json', { since: T - 7200 });
  let r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: { authorization: 'Bearer cron-secret-xyz' } }, r, R.d);
  assert.ok(r.body.off); assert.equal(R.calls.length, 0);
  R = rig({ answer: 'I think you should buy' }); await R.store.put('state.json', { since: T - 7200 });
  r = res(); await EP.handle({ method: 'GET', query: { job: 'scan' }, headers: { authorization: 'Bearer cron-secret-xyz' } }, r, R.d);
  assert.ok(R.store.peek('reviews.json').rows[0].refused);
});

test('reading: owner and reviewers only', async () => {
  const R = rig();
  for (const [who, code] of [[null, 401], [{ u: 'luxus', role: 'viewer' }, 403], [{ u: 'fred', role: 'reviewer' }, 200], [{ u: 'owner', role: 'owner' }, 200]]) {
    const r = res(); await EP.handle({ method: 'GET', query: {}, headers: {} }, r, { ...R.d, who: async () => who }); assert.equal(r.code, code);
    if (code === 200) { assert.equal(r.body.enabled, true); assert.equal(r.body.stats.closed, 0); assert.equal(r.h['Cache-Control'], 'private, no-store'); }
  }
});

test('budgets are this feature\'s own; EDGE_ANALYST=off stops every call', () => {
  const e = EP.llmEnv({ ACADEMY_LLM_DAILY_USD: '9', EDGE_LLM_DAILY_USD: '0.2' });
  assert.equal(e.ACADEMY_LLM_DAILY_USD, '0.2'); assert.equal(EP.llmEnv({}).ACADEMY_LLM_MAX_CALLS_DAY, '12');
  assert.equal(EP.llmEnv({ EDGE_ANALYST: 'off' }).ACADEMY_LLM_STOP, '1');
});

test('wiring: cron, function, page card, nothing imports council or order code', () => {
  const v = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.ok(v.crons.some((c) => c.path === '/api/edge-analyst?job=scan'));
  assert.ok(v.functions['api/edge-analyst.js']);
  const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(page, /id="ms-ea" class="card adm"|class="card adm" id="ms-ea"/);
  assert.match(page, /<script id="ms-ea-js">[\s\S]*?\/api\/edge-analyst/);
  for (const f of ['../api/_edge-analyst.js', '../api/edge-analyst.js']) {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/require\([^)]*(council|ctrader|mirror|mt5)/.test(src), `${f} imports no council or order code`);
  }
});
