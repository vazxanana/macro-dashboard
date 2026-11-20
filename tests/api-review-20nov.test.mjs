// API review of 20 Nov 2026: the server functions written or changed 17-20 Nov (sign-up, passkeys, the daily reports, last
// seen, battles, the licensed data endpoint, the cron kicks, the coach). One test per defect found, each written to fail on the
// code before its fix. Offline: fake stores, a fake clock, a fake mail sender and a fake model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DAILY = require('../api/daily.js'), SIGNUP = require('../api/signup.js'), LSE = require('../api/lse.js'), COACH = require('../api/chronos-coach.js');
const ST = require('../api/_academy-store.js'), G = require('../api/_guard.js');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const rep = { day: '2026-11-20', publishAt: '2026-11-20T06:30:00.000Z', builtAt: '2026-11-20T06:05:00Z', note: 'n',
  world: { title: 'World economy', lead: 'Dollar Smile left side.', sections: [{ h: 'The picture', lines: ['VIX 24.6.'] }] },
  markets: { title: 'Markets', lead: 'Gold 3,627, a normal day ±1.4%.', sections: [{ h: 'Where markets stand', lines: ['Gold 3,627.5.'] }] } };
const mk = () => ({ code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const memStore = () => { const m = new Map(); return { m, get: async (k, dflt) => (m.has(k) ? JSON.parse(JSON.stringify(m.get(k))) : dflt), put: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); } }; };
const ENV = { CRON_SECRET: 's'.repeat(24), BLOB_READ_WRITE_TOKEN: 'x', OWNER_EMAIL: 'owner@x.io', DAILY_AI: 'off' };
const AUTH = { authorization: 'Bearer ' + ENV.CRON_SECRET };
const at = (s) => () => Date.parse(s);
function world() {
  const W = { store: memStore(), notices: [], sent: [] };
  W.d = (o = {}) => ({ env: ENV, store: W.store, readFile: async () => ({ ok: true, buf: Buffer.from(JSON.stringify({ reports: [rep] })) }),
    notices: { get: async () => W.notices, put: async (l) => { W.notices = l; } }, send: async (to, subj) => { W.sent.push([to, subj]); }, ...o });
  W.cron = async (o) => { const r = mk(); await DAILY.handle({ method: 'GET', query: { job: 'daily' }, headers: AUTH }, r, W.d(o)); return r; };
  W.owner = async (query, o = {}, headers = {}) => { const r = mk(); await DAILY.handle({ method: 'GET', query, headers }, r, W.d({ who: async () => ({ u: 'owner' }), ...o })); return r; };
  return W;
}
const USERS = { a: { email: 'a@x.io' }, b: { email: 'b@x.io' } };
const down = async () => { throw Object.assign(new Error('the user list could not be read'), { status: 503 }); };

test('daily email, the 06:30 job: an unreadable member list never marks the day as sent (members got nothing that day)', async () => {
  const W = world();
  let r = await W.cron({ userList: down, now: at('2026-11-20T06:30:05Z') });
  assert.equal(r.code, 200); assert.equal(W.sent.length, 0, 'nothing goes out on a guess of who the members are');
  assert.notEqual(((await W.store.get('state.json', null)) || {}).mailed, rep.day, 'the day is not marked');
  assert.ok(!JSON.stringify(r.body).includes('@'));
  // the next run, ten minutes later, reads the list and sends to everyone, once
  r = await W.cron({ userList: async () => USERS, now: at('2026-11-20T06:40:05Z') });
  assert.deepEqual(W.sent.map((x) => x[0]), ['owner@x.io', 'a@x.io', 'b@x.io']); assert.deepEqual(r.body.email, { sent: 3, failed: 0 });
  r = await W.cron({ userList: async () => USERS, now: at('2026-11-20T06:50:05Z') }); assert.equal(W.sent.length, 3); assert.equal(r.body.email, undefined);
});

test('daily email, send=all: an unreadable member list is refused and does not use up the day\'s one send', async () => {
  const W = world();
  let r = await W.owner({ send: 'all', day: rep.day }, { userList: down, now: at('2026-11-20T08:00:00Z') });
  assert.equal(r.code, 503); assert.equal(W.sent.length, 0); assert.notEqual(((await W.store.get('state.json', null)) || {}).resent, rep.day);
  r = await W.owner({ send: 'all', day: rep.day }, { userList: async () => USERS, now: at('2026-11-20T08:01:00Z') });
  assert.equal(r.code, 200); assert.deepEqual([r.body.recipients, r.body.sent], [3, 3]);
});

test('daily email: a removed or macro-off member is never on the list the job sends to', async () => {
  const W = world(), users = { a: { email: 'a@x.io' }, off: { email: 'off@x.io', perms: { macro: false } }, gone: { email: 'gone@x.io', disabled: true } };
  await W.cron({ userList: async () => users, now: at('2026-11-20T06:30:05Z') });
  assert.deepEqual(W.sent.map((x) => x[0]), ['owner@x.io', 'a@x.io']);
});

test('daily email, test=email: a link on another site cannot make the owner\'s browser send the report to an address it names', async () => {
  const W = world(); DAILY._tests.length = 0;
  for (const site of ['cross-site', 'same-site']) {
    const r = await W.owner({ test: 'email', to: 'someone@elsewhere.example', fresh: '1' }, { now: at('2026-11-20T07:00:00Z') }, { 'sec-fetch-site': site });
    assert.equal(r.code, 403, site); assert.equal(W.sent.length, 0, site);
  }
  // typed into the address bar (none), asked by the site's own page (same-origin), or a client that sends no such header: as before
  for (const site of ['none', 'same-origin', undefined]) {
    const r = await W.owner({ test: 'email', to: 'me@x.io' }, { now: at('2026-11-20T07:00:00Z') }, site ? { 'sec-fetch-site': site } : {});
    assert.equal(r.code, 200, String(site));
  }
  assert.equal(W.sent.length, 3);
});

test('daily email: the owner\'s send=all finishing after the 06:30 job never un-marks the day (the job would send twice)', async () => {
  const W = world(); let inner = null;
  // the owner asks at 06:35, before the job's first run of the window; while those emails go out, the 10-minute job runs
  const send = async (to, subj) => { W.sent.push([to, subj]); if (!inner) inner = W.cron({ userList: async () => USERS, now: at('2026-11-20T06:40:05Z') }); await inner; };
  const r = await W.owner({ send: 'all', day: rep.day }, { userList: async () => USERS, send, now: at('2026-11-20T06:35:00Z') });
  assert.equal(r.code, 200);
  const state = await W.store.get('state.json', null);
  assert.equal(state.mailed, rep.day, 'the job\'s mark is still there'); assert.equal(state.resent, rep.day);
  const n = W.sent.length; await W.cron({ userList: async () => USERS, now: at('2026-11-20T06:50:05Z') });
  assert.equal(W.sent.length, n, 'the next run does not send the 06:30 email again');
});

test('sign-up: a mail provider\'s failure is not described to a visitor (no provider text, no list of tries)', async () => {
  G._reset();
  const files = {}, store = { async get(p) { return JSON.parse(JSON.stringify(files[p] || [])); }, async put(p, v) { files[p] = v; } };
  const r = mk(); r.end = () => r;
  const send = async () => { throw Object.assign(new Error('email service failed'), { tries: ['object: E_SENDER_NOT_VERIFIED sender domain aureumdesk.co.uk is not onboarded (account 1234)'] }); };
  await SIGNUP.handle({ method: 'POST', query: {}, headers: { host: 'aureumdesk.co.uk', 'x-real-ip': '10.9.9.9' }, body: { name: 'Maria', username: 'maria', email: 'maria@example.com', password: 'maria-password-1' } }, r,
    { env: { CTRADER_LINK_KEY: 'link-key-fake-0123456789', BLOB_READ_WRITE_TOKEN: 'fake' }, store, deps: { builtIns: {}, blobUsers: async () => ({ users: {} }) }, builtIns: {}, now: () => Date.UTC(2026, 10, 20, 12), send });
  assert.equal(r.code, 502); assert.deepEqual(Object.keys(r.body), ['error']);
  assert.ok(!/onboarded|E_SENDER|account 1234/.test(JSON.stringify(r.body)));
  assert.equal((files['signups/pending.json'] || []).length, 0, 'nothing is stored for an email that was not sent');
});

test('forgot password: the answer leaves before the member\'s link is stored and mailed, and is the same when that work fails', async () => {
  const users = { maria: { name: 'Maria', role: 'viewer', hash: 'a'.repeat(64), email: 'maria@example.com' } };
  const ask = async (email, o = {}) => {
    G._reset(); const files = {}, seen = { atSend: undefined, sends: 0 }, r = mk(); r.end = () => r;
    const store = { async get(p) { if (o.storeDown) throw new Error('signup store read 500'); return JSON.parse(JSON.stringify(files[p] || [])); }, async put(p, v) { files[p] = v; } };
    await SIGNUP.handle({ method: 'POST', query: {}, headers: { host: 'aureumdesk.co.uk', 'x-real-ip': '10.8.8.8' }, body: { forgot: email } }, r,
      { env: { CTRADER_LINK_KEY: 'link-key-fake-0123456789', BLOB_READ_WRITE_TOKEN: 'fake' }, store, builtIns: {}, now: () => Date.UTC(2026, 10, 20, 12),
        deps: { builtIns: {}, blobUsers: async () => ({ users }) }, send: async () => { seen.sends++; seen.atSend = r.body && r.code; } });
    return { r, seen };
  };
  const known = await ask('maria@example.com'), unknown = await ask('nobody@example.com');
  assert.equal(known.seen.sends, 1); assert.equal(unknown.seen.sends, 0);
  assert.equal(known.seen.atSend, 200, 'the member\'s answer was already given when the email started: its time does not tell a known address from an unknown one');
  assert.deepEqual([known.r.code, known.r.body], [unknown.r.code, unknown.r.body]);
  // the reset store failing is only ever met for a known address: it must not change the answer either
  const down = await ask('maria@example.com', { storeDown: true });
  assert.deepEqual([down.r.code, down.r.body], [unknown.r.code, unknown.r.body]); assert.equal(down.seen.sends, 0);
});

test('the licensed data endpoint: an operation name found only on Object.prototype is refused in words, not a crash', async () => {
  for (const op of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    let t; assert.doesNotThrow(() => { t = LSE.target({ op }); }, op);
    assert.match(t.error, /op must be one of/, op);
  }
  assert.ok(LSE.target({ op: 'usage' }).url);
});

test('the Worker: /api/<name> runs only a handler of its own list (a name inherited from Object is a 404)', () => {
  const w = src('cloudflare/src/worker.mjs');
  assert.match(w, /Object\.hasOwn\(HANDLERS, name\)/);
  assert.ok(!/const h = HANDLERS\[name\];/.test(w));
});

test('the coach: a provider\'s refusal is described (its own words, the variables to check) to the owner only', async () => {
  const NOW = Date.UTC(2026, 10, 20, 12), SEC = 900, T0 = 1794000000;
  const bars = (from, n) => Array.from({ length: n }, (_, i) => [from + i * SEC, 4000 + i, 4002 + i, 3998 + i, 4001 + i]);
  const body = (m) => ({ kind: 'trade', market: m, tf: SEC, dec: 2, moment: T0 + 40 * SEC, trade: { side: 'sell', entry: 4010, stop0: 4015, target: 4000, openedAt: T0, closedAt: T0 + 10 * SEC, exit: 4015, R: -1, reason: 'stop' }, before: bars(T0 - 100 * SEC, 100), after: bars(T0, 20) });
  const env = { BLOB_READ_WRITE_TOKEN: 'x', ACADEMY_LLM_KEY: 'k-test', ACADEMY_LLM_URL: 'https://llm.invalid/v1/messages', ACADEMY_LLM_MODEL: 'm-test', ACADEMY_LLM_FORMAT: 'messages' };
  const ask = async (u, ans) => { COACH._calls.clear(); const r = mk();
    await COACH.handle({ method: 'POST', headers: { host: 'aureumdesk.co.uk' }, query: {}, body: body('xau') }, r, { env, store: ST.memoryStore(), who: async () => ({ u, name: u, role: u === 'owner' ? 'owner' : 'viewer' }), now: () => NOW, complete: async () => ans }); return r.body; };
  const refused = { available: true, error: 'the provider refused the request', status: 400, errorType: 'invalid_request_error', detail: 'model: internal-model-id-7 is not available to organisation org_123' };
  const badKey = { available: true, error: 'the provider refused the key', status: 401 };
  for (const ans of [refused, badKey]) {
    const m = await ask('luxus', ans); assert.equal(m.state, 'error');
    assert.ok(!/internal-model-id-7|org_123|invalid_request_error|_LLM_|ACADEMY|CHRONOS/.test(m.message), m.message);
    assert.match(m.message, /could not be reached|Try again/);
  }
  const o = await ask('owner', refused); assert.match(o.message, /internal-model-id-7/); assert.match(o.message, /CHRONOS_LLM_MODEL/);
  assert.match((await ask('owner', badKey)).message, /ACADEMY_LLM_KEY/);
});

test('the Worker hands a handler the host the request came to, never a forwarded host the client typed (links in emails)', async () => {
  const { headersOf } = await import('../cloudflare/src/adapter.mjs');
  const h = headersOf(new Request('https://aureumdesk.co.uk/api/signup', { method: 'POST', headers: { 'x-forwarded-host': 'localhost:8080', 'cf-connecting-ip': '203.0.113.9' } }));
  assert.equal(h['x-forwarded-host'], undefined);
  // so the reset link a member is emailed is the site's own, whatever header the asker added
  G._reset(); const out = [], files = {}, store = { async get(p) { return JSON.parse(JSON.stringify(files[p] || [])); }, async put(p, v) { files[p] = v; } };
  const r = mk(); r.end = () => r;
  await SIGNUP.handle({ method: 'POST', query: {}, headers: { ...h, host: 'aureumdesk.co.uk' }, body: { forgot: 'maria@example.com' } }, r,
    { env: { CTRADER_LINK_KEY: 'link-key-fake-0123456789', BLOB_READ_WRITE_TOKEN: 'fake' }, store, builtIns: {}, now: () => Date.UTC(2026, 10, 20, 12),
      deps: { builtIns: {}, blobUsers: async () => ({ users: { maria: { name: 'Maria', role: 'viewer', hash: 'a'.repeat(64), email: 'maria@example.com' } } }) }, send: async (to, subject, text) => { out.push(text); } });
  assert.equal(r.code, 200); assert.equal(out.length, 1); assert.match(out[0], /https:\/\/aureumdesk\.co\.uk\/market-structure\.html#reset=/); assert.ok(!out[0].includes('localhost'));
});
