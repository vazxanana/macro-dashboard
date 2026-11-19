// api/daily.js + api/_daily.js: the AI summary, the bell notice and the 06:30 email of the daily reports (19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = require('../api/_daily.js'), API = require('../api/daily.js');

const rep = { day: '2026-11-20', publishAt: '2026-11-20T06:30:00.000Z', builtAt: '2026-11-20T06:05:00Z', note: 'n',
  world: { title: 'World economy', lead: 'Dollar Smile left side. Today: United Kingdom Retail Sales m/m at 07:00 London.', sections: [{ h: 'The picture', lines: ['VIX 24.6 · US 2-year 4.80%.'] }] },
  markets: { title: 'Markets', lead: 'Gold 3,627, a normal day ±1.4%.', sections: [{ h: 'Where markets stand', lines: ['Gold 3,627.5: 51% chance of closing the day higher (usual 53%).'] }] } };
const mk = () => ({ code: 0, body: null, headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const memStore = () => { const m = new Map(); return { m, get: async (k, dflt) => (m.has(k) ? m.get(k) : dflt), put: async (k, v) => { m.set(k, v); } }; };

test('recipients: the owner and members with an email and macro on, deduplicated, never a disabled one', () => {
  const users = { fred: { name: 'Fred' }, a: { email: 'A@x.io' }, b: { email: 'b@x.io', perms: { macro: false } }, c: { email: 'c@x.io', disabled: true }, d: { email: 'not-an-email' }, e: { email: 'a@x.io' } };
  assert.deepEqual(D.recipients(users, 'owner@x.io'), ['owner@x.io', 'a@x.io']);
  assert.deepEqual(D.recipients({}, ''), []);
});

test('the AI summary is checked: JSON, every figure in the report, no advice, stops or certainty', () => {
  const good = JSON.stringify({ world: 'Stress gauges are lit with VIX at 24.6 and the US 2-year at 4.80%; UK retail sales at 07:00 is the release to watch today.', markets: 'Gold sits near 3,627 with a normal day of ±1.4%; the odds of a higher close are 51% against a usual 53%, so no real lean.' });
  assert.equal(D.parseBrief('Here: ' + good, rep).ok, true);
  assert.match(D.parseBrief(JSON.stringify({ world: 'VIX at 31.2 means trouble for everyone today, a long sentence here.', markets: 'Gold near 3,627 with a normal day of 1.4% either way, calm.' }), rep).why, /31\.2 is not in the report/);
  assert.match(D.parseBrief(JSON.stringify({ world: 'You should buy gold before the UK data at 07:00, it looks good.', markets: 'Gold near 3,627 with a normal day of 1.4% either way, calm.' }), rep).why, /advice/);
  assert.match(D.parseBrief(JSON.stringify({ world: 'Gold will rise after the UK retail data at 07:00 this morning, clearly.', markets: 'Gold near 3,627 with a normal day of 1.4% either way, calm.' }), rep).why, /advice/);
  assert.equal(D.parseBrief('not json', rep).ok, false); assert.equal(D.parseBrief('{"world":"x","markets":"y"}', rep).ok, false);
  assert.match(D.briefRequest(rep).system, /every number you write must appear/);
});

test('the email: both reports, the AI box only when there is a summary, escaped, a test is marked', () => {
  const m = D.emailOf({ ...rep, world: { ...rep.world, lead: '<b>x</b>' } }, { world: 'W sum', markets: 'M sum' }, { test: true });
  assert.match(m.subject, /^Test · Daily reports · Friday 20 November$/); assert.ok(m.html.includes('&lt;b&gt;x&lt;/b&gt;') && !m.html.includes('<b>x</b>'));
  assert.ok(m.html.includes('AI summary') && m.text.includes('AI SUMMARY') && m.text.includes('WORLD ECONOMY') && m.text.includes('MARKETS'));
  assert.ok(m.html.includes('https://aureumdesk.co.uk/macro-desk#s-daily'));
  assert.ok(!D.emailOf(rep, null).html.includes('AI summary'));
});

test('the cron job: once a day inside the window, AI then notice then email; nothing outside it', async () => {
  const env = { CRON_SECRET: 's'.repeat(24), BLOB_READ_WRITE_TOKEN: 'x', OWNER_EMAIL: 'owner@x.io' }, auth = { authorization: 'Bearer ' + env.CRON_SECRET };
  const file = { reports: [rep] }, readFile = async () => ({ ok: true, buf: Buffer.from(JSON.stringify(file)) });
  let notices = [], sent = [], calls = 0;
  const base = () => ({ env, store, readFile, users: { a: { email: 'a@x.io' } }, notices: { get: async () => notices, put: async (l) => { notices = l; } },
    send: async (to, subj) => { sent.push([to, subj]); }, complete: async () => { calls++; return { available: true, text: JSON.stringify({ world: 'UK retail sales at 07:00 is the release today, with VIX at 24.6.', markets: 'Gold near 3,627 with a normal day of ±1.4%, odds 51% against 53%.' }) }; } });
  const store = memStore();
  let res = mk(); await API.handle({ method: 'GET', query: { job: 'daily' }, headers: {} }, res, { ...base(), now: () => Date.parse('2026-11-20T06:30:05Z') }); assert.equal(res.code, 401);
  res = mk(); await API.handle({ method: 'GET', query: { job: 'daily' }, headers: auth }, res, { ...base(), now: () => Date.parse('2026-11-20T06:20:00Z') });
  assert.match(res.body.why, /outside/); assert.equal(sent.length, 0);
  const prev = process.env.ACADEMY_LLM_KEY;
  Object.assign(env, { ACADEMY_LLM_KEY: 'k', ACADEMY_LLM_URL: 'https://llm.invalid/v1', ACADEMY_LLM_MODEL: 'm' });
  res = mk(); await API.handle({ method: 'GET', query: { job: 'daily' }, headers: auth }, res, { ...base(), now: () => Date.parse('2026-11-20T06:30:05Z') });
  assert.equal(res.body.ai, 'written'); assert.equal(res.body.notice, 'daily-2026-11-20'); assert.deepEqual(res.body.email, { sent: 2, failed: 0 });
  assert.deepEqual(sent.map((x) => x[0]), ['owner@x.io', 'a@x.io']); assert.match(sent[0][1], /^Daily reports · Friday 20 November$/);
  assert.ok(!JSON.stringify(res.body).includes('@'));   // no address in the answer
  res = mk(); await API.handle({ method: 'GET', query: { job: 'daily' }, headers: auth }, res, { ...base(), now: () => Date.parse('2026-11-20T06:40:05Z') });
  assert.equal(sent.length, 2); assert.equal(calls, 1); assert.equal(notices.length, 1); assert.equal(res.body.email, undefined);
  // the page's read and the owner's test
  res = mk(); await API.handle({ method: 'GET', query: { brief: '1' }, headers: {} }, res, { ...base(), who: async () => ({ u: 'fred', perms: {} }), now: () => Date.parse('2026-11-20T07:00:00Z') });
  assert.match(res.body.brief.world, /UK retail/);
  res = mk(); await API.handle({ method: 'GET', query: { brief: '1' }, headers: {} }, res, { ...base(), who: async () => ({ u: 'carlos', perms: { macro: false } }) }); assert.equal(res.code, 403);
  res = mk(); await API.handle({ method: 'GET', query: { test: 'email', to: 'me@x.io' }, headers: {} }, res, { ...base(), who: async () => ({ u: 'fred' }) }); assert.equal(res.code, 403);
  res = mk(); await API.handle({ method: 'GET', query: { test: 'email', to: 'me@x.io' }, headers: {} }, res, { ...base(), who: async () => ({ u: 'owner' }), now: () => Date.parse('2026-11-20T07:00:00Z') });
  assert.equal(res.body.sent, true); assert.equal(res.body.ai, true); assert.deepEqual(sent[2], ['me@x.io', 'Test · Daily reports · Friday 20 November']);
  res = mk(); await API.handle({ method: 'GET', query: { test: 'email', to: 'nope' }, headers: {} }, res, { ...base(), who: async () => ({ u: 'owner' }) }); assert.equal(res.code, 400);
  if (prev === undefined) delete process.env.ACADEMY_LLM_KEY;
  assert.equal(API.llmEnv({ DAILY_LLM_MODEL: 'x', ACADEMY_LLM_MODEL: 'y' }).ACADEMY_LLM_MODEL, 'x'); assert.equal(API.llmEnv({ DAILY_AI: 'off' }).ACADEMY_LLM_STOP, '1');
});

test('the page reads the summary, the endpoint is wired, no model name or address in the files', () => {
  const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.ok(rd('macro-desk.html').includes("fetch('/api/daily?brief=1'") && rd('macro-desk.html').includes('id="dr-ai"'));
  for (const p of ['api/daily.js', 'api/_daily.js']) assert.ok(!/@gmail|claude|opus|sonnet|haiku/i.test(rd(p)), p);
});
