// node --test tests/api-review.test.mjs — security and robustness review of the Vercel functions (11 Nov 2026).
// Three findings, each pinned by the request that showed it, then the re-verification the review asked for: every state-changing
// endpoint refuses a foreign Origin, /cdata's private files and path handling, the Mosha assistant's key opens nothing but the
// lessons, only Luxus teaches, a viewer does not read what reviewers read, a member writes only their own record, and the ICT
// apply permission comes from nowhere but the documented two places. Fake Blob store, fake web-push, fake fetch: no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Module, { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// ---- fakes for the modules that are not installed in CI ----
const BLOB = { blobs: [], puts: [], seq: 0 };
const fakeBlob = {
  list: async ({ prefix = '' } = {}) => ({ blobs: BLOB.blobs.filter((b) => b.pathname.startsWith(prefix)), hasMore: false }),
  put: async (pathname, body) => { BLOB.puts.push({ pathname, body }); const b = { pathname, url: `https://blob.test/${pathname}?${++BLOB.seq}`, uploadedAt: new Date(Date.now() + BLOB.seq).toISOString(), body }; BLOB.blobs.push(b); return b; },
  del: async (urls) => { const u = [].concat(urls); BLOB.blobs = BLOB.blobs.filter((b) => !u.includes(b.url)); },
};
const PUSH = { sent: [] };
const fakeWebpush = { setVapidDetails() {}, sendNotification: async (sub, payload) => { PUSH.sent.push({ sub, payload }); return { statusCode: 201 }; } };
const origLoad = Module._load;
Module._load = function (r, ...rest) { if (r === '@vercel/blob') return fakeBlob; if (r === 'web-push') return fakeWebpush; return origLoad.call(this, r, ...rest); };
const resetBlob = () => { BLOB.blobs = []; BLOB.puts = []; PUSH.sent = []; };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
const fetchWith = (routes = []) => async (url) => { const u = String(url);
  for (const [re, fn] of routes) if (re.test(u)) return fn(u);
  const b = BLOB.blobs.find((x) => x.url === u); if (b) return new Response(b.body, { status: 200 });
  return new Response('{"message":"Not Found"}', { status: 404 }); };
const realFetch = globalThis.fetch;

const G = require('../api/_guard.js'), S = require('../api/_session.js'), A = require('../api/_accounts.js');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const ENV = { CTRADER_LINK_KEY: 'link-key-fake-0123456789' };
const builtIns = { fred: { name: 'Fred', hash: sha('fred-pw'), role: 'reviewer', ict: true, mcp: true }, carlos: { name: 'Carlos', hash: sha('carlos-pw'), role: 'viewer' }, luxus: { name: 'Luxus', hash: sha('lx-pw'), role: 'viewer' } };
const deps = { builtIns, blobUsers: async () => ({ users: {} }) };
function res() { const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[String(k).toLowerCase()] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; }; r.end = () => r; r.redirect = (c) => { r.code = c; return r; }; return r; }
const cookie = (u, pw) => `ms_session=${u === 'owner' ? S.issue(ENV, 'owner', A.OWNER_HASH, S.account('owner')) : S.issue(ENV, u, sha(pw), S.account(u, builtIns[u]))}`;
const OWNER_C = cookie('owner'), FRED_C = cookie('fred', 'fred-pw'), CARLOS_C = cookie('carlos', 'carlos-pw');

// ---------------------------------------------------------------------------------------------------------------------------
// Finding 1 (medium). POST /api/push needs no sign-in. { alerts: [{ id, sym: "xau", price: "1e999" }] } passed the "price > 0"
// check, was stored as price null, and the every-minute cron then threw while writing the notification text for that device:
// the round answered 500 and no device after it got its alert, every minute, until someone deleted the record by hand.
test('finding 1: a price alert that is not a finite number is refused, and a stored bad one cannot stop the other devices', async () => {
  resetBlob(); const env = { CRON_SECRET: 'cron-fake-0123456789', OANDA_TOKEN: 'oanda-fake', VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', BLOB_READ_WRITE_TOKEN: 'blob-fake' };
  const saved = {}; for (const k of Object.keys(env)) { saved[k] = process.env[k]; process.env[k] = env[k]; }
  try {
    const now = Math.floor(Date.now() / 1000), keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) }, ep = 'https://fcm.googleapis.com/fcm/send/';
    globalThis.fetch = fetchWith([[/oanda\.com\/v3\/instruments\/XAU_USD\/candles/, () => json({ candles: [{ time: String(now - 30), mid: { o: '1999', h: '2001', l: '1998', c: '2000.5' } }] })]]);
    const push = require('../api/push.js'), post = async (body) => { const r = res(); await push({ method: 'POST', headers: {}, query: {}, body: JSON.stringify(body) }, r); return r; };
    for (const price of ['1e999', '-1e999', 'Infinity', 1e308 * 10, 0, -5, 'abc', null, {}])
      assert.equal((await post({ sub: { endpoint: ep + 'evil', keys }, alerts: [{ id: 'a1', sym: 'xau', price, dir: 'above', at: now - 60 }] })).code, 400, `price ${JSON.stringify(price)}`);
    assert.equal((await post({ sub: { endpoint: ep + 'evil', keys }, alerts: [{ id: 'a1', sym: 'xau', price: 2000, dir: 'above', at: '1e999' }] })).code, 400, 'the time it was set must be a number too');
    assert.equal(BLOB.puts.length, 0, 'nothing stored');
    // records as they could already sit in the store (saved before this fix), listed BEFORE a good device
    const sub = (n) => ({ endpoint: ep + n, keys });
    await fakeBlob.put('push/aaaaaaaaaaaaaaaaaaaaaaaa/d.json', JSON.stringify({ sub: sub('evil'), alerts: [{ id: 'a1', sym: 'xau', price: null, dir: 'above', at: now - 60 }] }));
    await fakeBlob.put('push/bbbbbbbbbbbbbbbbbbbbbbbb/d.json', JSON.stringify({ sub: sub('odd'), alerts: [null, 7, { id: 'a2', sym: 'nope', price: 5, dir: 'above', at: now - 60 }, { id: 'a3', sym: 'xau', price: 'x', dir: 'below', at: now - 60 }] }));
    await fakeBlob.put('push/cccccccccccccccccccccccc/d.json', JSON.stringify({ sub: sub('good'), alerts: [{ id: 'a4', sym: 'xau', price: 2000, dir: 'above', at: now - 60 }] }));
    const cron = require('../api/alert-cron.js'), r = res(); await cron({ method: 'GET', headers: { authorization: `Bearer ${env.CRON_SECRET}` }, query: {} }, r);
    assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.sent, 1, 'the good device got its alert');
    assert.deepEqual(PUSH.sent.map((x) => x.sub.endpoint), [ep + 'good'], 'and a bad alert never fires');
    assert.doesNotMatch(JSON.stringify(r.body), /Cannot read|toLocaleString/);
  } finally { globalThis.fetch = realFetch; for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } resetBlob(); }
});

// ---- the Mosha lessons: a store in memory, the accounts as the session gives them ----
const ML = require('../api/mosha-lessons.js'), MO = require('../api/mosha.js');
const MENV = { SESSION_SECRET: 'a-test-session-secret-0123456789' }, NOW = Date.UTC(2026, 10, 11, 10, 0, 0);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]), pic = `data:image/png;base64,${PNG.toString('base64')}`;
const mk = () => { let db = [], bk = null; const img = new Map(); const c = (v) => JSON.parse(JSON.stringify(v));
  return { get: async () => c(db), put: async (v) => { db = c(v); }, getBook: async () => (bk ? c(bk) : null), putBook: async (v) => { bk = c(v); }, putImg: async (id, type, buf) => { img.set(id, buf); }, getImg: async (id) => img.get(id) || null, delImg: async (id) => { img.delete(id); }, peek: () => db, book: () => bk, img }; };
let tick = 0;
const lessons = async (store, method, who, body, extra = {}) => { const r = res(); await ML.handle({ method, body, query: extra.query || {}, headers: extra.headers || {} }, r, { env: MENV, store, who: async () => who, sameOrigin: () => true, now: NOW + 1000 * ++tick }); return r; };
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' }, LUXUS = { u: 'luxus', name: 'Luxus', role: 'viewer', mosha: 'teach', home: 'mosha' };
const FRED = { u: 'fred', name: 'Fred', role: 'reviewer' }, CARLOS = { u: 'carlos', name: 'Carlos', role: 'viewer' };
const BEARER = () => ({ authorization: `Bearer ${ML.readerKey(MENV)}` });

// Finding 2 (low). Teaching is Luxus's alone; the owner reads, and may remove a lesson or a picture. The gate let the owner's
// session through whenever the body carried a "remove" object, and the handlers for "book" and "add" run before "remove":
// POST { remove: {}, book: { id: "seed-01", remove: true } } erased a line of the book, and { remove: {}, add: { note } } started
// a lesson, both from the owner's session, which the same calls without "remove" refuse (403).
test('finding 2: the owner\'s "remove" opens nothing else: no book change and no lesson rides along with it', async () => {
  const s = mk(), a = await lessons(s, 'POST', LUXUS, { add: { note: 'The sweep of the H1 high, then the M5 VR and its CF.', image: pic } }), id = a.body.lesson.id;
  assert.equal(a.code, 200);
  for (const extra of [{ book: { id: 'seed-01', remove: true } }, { book: { id: 'seed-01', confirm: true } }, { book: { id: 'seed-01', text: 'The owner rewrites the line.' } }, { add: { note: 'The owner teaches a lesson.' } }, { add: { title: 'x', image: pic } }, { say: { id, text: 'x' } }, { edit: { id, note: 'x' } }, { learn: { kind: 'rule', text: 'A line taught by the owner.' } }]) {
    const what = Object.keys(extra)[0];
    assert.equal((await lessons(s, 'POST', OWNER, extra)).code, 403, `${what} alone`);
    const r = await lessons(s, 'POST', OWNER, { remove: {}, ...extra }); assert.ok(r.code === 403 || r.code === 404, `${what} with an empty remove: ${r.code}`);
    assert.equal(s.book(), null, `${what}: the book is untouched`); assert.equal(s.peek().length, 1, `${what}: no lesson added`); assert.equal(s.peek()[0].note, 'The sweep of the H1 high, then the M5 VR and its CF.');
  }
  // what the owner may do still works, and only that part of the body is carried out
  const r = await lessons(s, 'POST', OWNER, { remove: { id }, book: { id: 'seed-01', remove: true } });
  assert.equal(r.code, 200); assert.equal(r.body.removed, 1); assert.equal(s.peek().length, 0); assert.equal(s.book(), null, 'the lesson went, the book did not change');
});

// Finding 3 (medium, only with an MCP_KEYS entry for the member). With an explicit key the connector did not read the stored
// user list before working out the member's ICT level, so on a cold server instance the first call fell back to the built-in
// record: Fred, switched to "no ICT" on the Users page, was listed and allowed the write tools once per instance (a member
// who is not built in stayed on "read" for good). Now the stored list is read first, as it always was for a derived key.
test('finding 3: an MCP_KEYS key does not skip the stored list: the member\'s ICT level is the owner\'s, from the first call', async () => {
  const handler = require('../api/mcp.js'), L = handler.lib, KEY = 'abcdefghijklmnopqrstuvwx', old = { keys: process.env.MCP_KEYS, load: L.IO.loadUsers };
  const post = async (key) => { const r = res(); await handler({ method: 'POST', headers: { host: 'meridianx.dev' }, query: { key }, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } }, r); return r; };
  const cold = () => { L.GRANT.users = null; L.GRANT.at = 0; L.RL.clear(); };
  const quiet = console.log; console.log = () => {};
  try {
    process.env.MCP_KEYS = `fred:${KEY},zed:${KEY}zed`;
    L.IO.loadUsers = async () => ({ fred: { name: 'Fred', role: 'reviewer', hash: sha('x'), perms: { ict: false } }, zed: { name: 'Zed', role: 'viewer', hash: sha('y'), perms: { ict: false } } });
    cold(); let r = await post(KEY); assert.equal(r.code, 403, 'Fred without ICT, first call on a cold instance'); assert.match(r.body.error.message, /ICT desk/);
    cold(); r = await post(`${KEY}zed`); assert.equal(r.code, 403, 'a member who is not built in, the same');
    // read-only stays read-only from the first call
    L.IO.loadUsers = async () => ({ fred: { name: 'Fred', role: 'reviewer', hash: sha('x'), perms: { ict: 'read' } } });
    cold(); r = await post(KEY); assert.equal(r.code, 200); const names = r.body.result.tools.map((t) => t.name);
    for (const w of ['ict_note', 'ict_propose_change', 'ict_desk_update', 'ict_apply_change', 'ict_revert_change']) assert.ok(!names.includes(w), `${w} not listed for read`);
    // unchanged: an explicit key is still the owner's grant while the list cannot be read (the built-in level then applies),
    // and the apply tools never appear without a readable list
    L.IO.loadUsers = async () => { throw new Error('blob down'); };
    cold(); r = await post(KEY); assert.equal(r.code, 200); assert.ok(r.body.result.tools.some((t) => t.name === 'ict_note'));
    assert.ok(!r.body.result.tools.some((t) => /ict_apply_change|ict_revert_change/.test(t.name)), 'no apply tool on an unreadable list');
  } finally { console.log = quiet; if (old.keys === undefined) delete process.env.MCP_KEYS; else process.env.MCP_KEYS = old.keys; L.IO.loadUsers = old.load; cold(); }
});

// ---------------------------------------------------------------------------------------------------------------------------
// Re-verification
test('every state-changing endpoint refuses the owner\'s own cookie when the request comes from another site', async () => {
  G._reset(); resetBlob(); const saved = { k: process.env.CTRADER_LINK_KEY, b: process.env.BLOB_READ_WRITE_TOKEN, t: process.env.TV_WEBHOOK_KEY };
  Object.assign(process.env, { CTRADER_LINK_KEY: ENV.CTRADER_LINK_KEY, BLOB_READ_WRITE_TOKEN: 'blob-fake', TV_WEBHOOK_KEY: 'tv-key-fake-0123456789' });
  try {
    const wrote = []; const mem = { get: async () => [], put: async (...a) => { wrote.push(a); }, getBook: async () => null, putBook: async (...a) => { wrote.push(a); }, putImg: async (...a) => { wrote.push(a); } };
    const obj = { get: async () => ({}), put: async (...a) => { wrote.push(a); } };
    const d = { env: ENV, deps, store: mem, load: async () => ({ users: {} }), save: async (...a) => { wrote.push(a); } };
    const cases = [
      ['login', require('../api/login.js').handle, { password: 'fred-pw' }, d],
      ['logout', require('../api/logout.js'), {}, null],
      ['users', require('../api/users.js').handle, { users: { ana: { name: 'Ana', role: 'viewer', pw: 'a-new-password' } } }, d],
      ['profile', require('../api/profile.js').handle, { name: 'Mallory' }, { ...d, store: obj }],
      ['notify', require('../api/notify.js').handle, { title: 'Hello', body: 'from another site' }, d],
      ['sounds', require('../api/sounds.js').handle, { kind: 'tp', data: null }, { ...d, store: obj }],
      ['mosha', MO.handle, { save: { side: 'buy', entry: 4000, stop: 3990, at: Math.floor(Date.now() / 1000) } }, d],
      ['mosha-lessons', ML.handle, { remove: { id: '20261111100000000abcd' } }, d],
      ['academy', require('../api/academy.js').handle, { action: 'miss', note: 'x' }, d],
      ['bridge', require('../api/bridge.js'), { file: 'mt5' }, null],
      ['tv-webhook', require('../api/tv-webhook.js'), { list: true }, null],
    ];
    for (const [name, fn, body, opt] of cases) {
      const r = res(); await fn({ method: 'POST', headers: { host: 'meridianx.dev', origin: 'https://evil.example', cookie: OWNER_C }, query: {}, body }, r, opt || undefined);
      assert.ok(r.code === 401 || r.code === 403, `${name}: ${r.code} ${JSON.stringify(r.body)}`);
      assert.equal(r.headers['set-cookie'], undefined, `${name}: no cookie set or cleared`);
      assert.doesNotMatch(JSON.stringify(r.body), /CouncilBridge|tv-key-fake/, `${name}: nothing handed over`);
    }
    assert.equal(wrote.length, 0, 'nothing was written'); assert.equal(BLOB.puts.length, 0);
    // the same cookie from the site itself is the owner (so the refusals above are the Origin check, not a bad cookie)
    const ok = res(); await require('../api/notify.js').handle({ method: 'POST', headers: { host: 'meridianx.dev', origin: 'https://meridianx.dev', cookie: OWNER_C }, query: {}, body: { title: 'Hello' } }, ok, d);
    assert.equal(ok.code, 200); assert.equal(wrote.length, 1);
    // an Origin that is not a URL ("null": a sandboxed frame) is foreign too
    for (const origin of ['null', 'meridianx.dev', 'https://meridianx.dev.evil.example', 'http://meridianx.dev:8080']) assert.equal(S.sameOrigin({ headers: { host: 'meridianx.dev', origin } }), false, origin);
  } finally { for (const [k, v] of [['CTRADER_LINK_KEY', saved.k], ['BLOB_READ_WRITE_TOKEN', saved.b], ['TV_WEBHOOK_KEY', saved.t]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } G._reset(); resetBlob(); }
});

test('/cdata: the sealed tokens and the user list are never read, whatever the spelling; no path leaves the branch; guests get the allowlist only', async () => {
  const data = require('../api/data.js'), asked = [];
  const fetchFn = async (u) => { asked.push(String(u)); return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('{}').buffer }; };
  const get = async (p, c, method = 'GET') => { const r = res(); await data.handle({ method, headers: { host: 'x.test', ...(c ? { cookie: c } : {}) }, query: { p } }, r, { env: ENV, fetch: fetchFn, deps }); return r; };
  S._cache.users = null;
  for (const c of [null, CARLOS_C, FRED_C, OWNER_C]) for (const p of ['users.json', 'ctrader/tokens.json', 'USERS.JSON', 'Ctrader/Tokens.json', '/users.json', '//ctrader/tokens.json'])
    assert.equal((await get(p, c)).code, 404, `${p} as ${c ? 'a member' : 'a guest'}`);
  for (const p of ['../users.json', 'ctrader/../users.json', 'ctrader/./tokens.json', 'ctrader//tokens.json', 'a/..', '..', '.git/config', 'ict/.hidden', 'users.json/', 'users.json%00', 'users.json\u0000.csv', 'ctrader%2ftokens.json', 'ctrader\\tokens.json', 'trades.json?ref=main', 'trades.json#x', 'x'.repeat(201), ['trades.json', 'users.json'], '', null])
    for (const c of [null, OWNER_C]) assert.equal((await get(p, c)).code, 400, `${JSON.stringify(p)}`);
  assert.equal(asked.length, 0, 'GitHub was never asked for any of them');
  // a guest: the allowlist and nothing near it
  for (const p of ['Trades.json', 'trades.json.bak', 'ict/trades.json', 'ict/replay.json.md', 'research/ledger.json', 'ctrader/accounts.json', 'ctrader/mirror.json', 'reviews/losses.json', 'coach.json', 'mt5/signals.csv.json', 'ict/desk.json', 'ict/mcp-notes.json']) {
    const r = await get(p, null); assert.equal(r.code, 401, p); assert.match(r.headers['cache-control'], /private, no-store/); assert.equal(r.headers['access-control-allow-origin'], undefined);
  }
  assert.equal(asked.length, 0);
  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) assert.equal((await get('trades.json', OWNER_C, m)).code, 405, m);
  const pub = await get('trades.json', null); assert.equal(pub.code, 200); assert.equal(asked.length, 1); assert.match(asked[0], /council-data\/trades\.json/);
  S._cache.users = null;
});

test('the Mosha assistant\'s key: the lessons, an answer and a proposed line; no other door of the site opens to it', async () => {
  G._reset(); const s = mk(), a = await lessons(s, 'POST', LUXUS, { add: { note: 'First the H4, then the H1, then M5.', image: pic } }), id = a.body.lesson.id, img = a.body.img;
  const H = BEARER();
  const g = await lessons(s, 'GET', null, null, { headers: H }); assert.equal(g.code, 200); assert.deepEqual([g.body.who, g.body.canTeach], ['assistant', false]);
  assert.equal((await lessons(s, 'GET', null, null, { headers: H, query: { img } })).code, 200);
  assert.equal((await lessons(s, 'POST', null, { reply: { id, text: 'You go top-down: H4, then H1, then the M5 gives the trade.' } }, { headers: H })).code, 200);
  const p = await lessons(s, 'POST', null, { learn: { kind: 'step', text: 'A line the desk proposes from the lesson.' } }, { headers: H }); assert.equal(p.code, 200); assert.equal(p.body.item.status, 'proposed'); assert.equal(p.body.item.by, 'assistant');
  const lineId = p.body.item.id, before = JSON.stringify([s.peek(), s.book()]);
  // every teacher's or owner's action, alone and hidden behind something the key may do
  const acts = [{ add: { note: 'A lesson from the key.' } }, { add: { lesson: id, image: pic } }, { edit: { id, note: 'x' } }, { remove: { id } }, { remove: { id, img } }, { say: { id, text: 'x', verdict: 'right' } }, { say: { id, answers: [{ i: 0, a: 'yes' }] } },
    { book: { id: lineId, confirm: true } }, { book: { id: lineId, text: 'The key rewrites its own line.' } }, { book: { id: 'seed-01', remove: true } }];
  for (const body of acts) assert.equal((await lessons(s, 'POST', null, body, { headers: H })).code, 403, JSON.stringify(Object.keys(body)));
  assert.equal(JSON.stringify([s.peek(), s.book()]), before, 'nothing changed');
  // a line it proposed stays "proposed" whatever it sends with it; status / by / id are not taken from the request
  const sly = await lessons(s, 'POST', null, { learn: { kind: 'rule', text: 'Another proposed line.', status: 'confirmed', by: 'luxus', id: 'seed-01' } }, { headers: H });
  assert.deepEqual([sly.body.item.status, sly.body.item.by], ['proposed', 'assistant']); assert.notEqual(sly.body.item.id, 'seed-01');
  assert.equal((await lessons(s, 'GET', null, null, { headers: H, query: { get: 'reader' } })).code, 403, 'the key does not show itself');
  // the rest of the site: the key is not a session anywhere
  const env = { ...MENV, BLOB_READ_WRITE_TOKEN: 'blob-fake' }, hdr = { host: 'x.test', ...H }, none = { get: async () => { throw new Error('the store must not be read'); }, put: async () => { throw new Error('the store must not be written'); } };
  const doors = [['mosha log', MO.handle, { env, store: none }], ['users', require('../api/users.js').handle, { env, deps, load: none.get }], ['profile', require('../api/profile.js').handle, { env, deps, store: none }],
    ['notify', require('../api/notify.js').handle, { env, store: none }], ['academy', require('../api/academy.js').handle, { env }]];
  for (const [name, fn, d] of doors) for (const method of ['GET', 'POST']) { const r = res(); await fn({ method, headers: hdr, query: {}, body: { remove: 'x', save: {}, users: {}, name: 'x', title: 'x', action: 'miss' } }, r, d); assert.ok(r.code === 401 || r.code === 403, `${name} ${method}: ${r.code}`); }
  S._cache.users = null; const cd = res(); await require('../api/data.js').handle({ method: 'GET', headers: hdr, query: { p: 'coach.json' } }, cd, { env, deps, fetch: async () => { throw new Error('not reached'); } }); assert.equal(cd.code, 401, '/cdata');
  const me = res(); await require('../api/me.js').handle({ method: 'GET', headers: hdr }, me, { env, deps }); assert.deepEqual(me.body, { account: null }, '/api/me');
  S._cache.users = null; G._reset();
});

test('only Luxus teaches: a stored "teach" on another account reads, the owner reads and removes, a viewer without the desk gets nothing', async () => {
  const s = mk(), a = await lessons(s, 'POST', LUXUS, { add: { note: 'A lesson in words.', image: pic } }), id = a.body.lesson.id, img = a.body.img;
  await lessons(s, 'POST', null, { reply: { id, text: 'What the desk understood.' } }, { headers: BEARER() });
  const TEACHY = { u: 'fred', name: 'Fred', role: 'reviewer', mosha: 'teach', perms: { mosha: 'teach', desks: true } }, NEW = { u: 'luxus2', name: 'Luxus', role: 'viewer', mosha: 'teach', perms: { mosha: 'teach' } };
  for (const who of [TEACHY, NEW, FRED, OWNER]) {
    assert.equal(MO.moshaLevel(who), 'read', who.u);
    const g = await lessons(s, 'GET', who); assert.equal(g.code, 200); assert.equal(g.body.canTeach, false, who.u);
    for (const body of [{ add: { note: 'Someone else teaches.' } }, { add: { lesson: id, image: pic } }, { say: { id, verdict: 'right' } }, { say: { id, text: 'x' } }, { edit: { id, note: 'x' } }, { learn: { kind: 'rule', text: 'Someone else\'s rule.' } }, { book: { id: 'seed-01', confirm: true } }, { book: { id: 'seed-02', remove: true } }])
      assert.equal((await lessons(s, 'POST', who, body)).code, 403, `${who.u} ${JSON.stringify(Object.keys(body))}`);
    if (who !== OWNER) assert.equal((await lessons(s, 'POST', who, { remove: { id } })).code, 403, `${who.u} remove`);
  }
  assert.equal(s.book(), null); assert.equal(s.peek().length, 1); assert.equal(s.peek()[0].shots.length, 1);
  assert.equal(MO.moshaLevel(LUXUS), 'teach'); assert.equal(MO.moshaLevel({ ...LUXUS, perms: { mosha: 'read' } }), 'read', 'the owner can switch him to read'); assert.equal(MO.moshaLevel({ ...LUXUS, perms: { mosha: false } }), false);
  assert.equal((await lessons(s, 'POST', LUXUS, { say: { id, verdict: 'right' } })).code, 200); assert.equal((await lessons(s, 'POST', LUXUS, { book: { id: 'seed-01', confirm: true } })).code, 200);
  // a viewer the desk is not open to: not the list, not a picture, not the trade log
  assert.equal(MO.moshaLevel(CARLOS), false);
  assert.equal((await lessons(s, 'GET', CARLOS)).code, 403); assert.equal((await lessons(s, 'GET', CARLOS, null, { query: { img } })).code, 403); assert.equal((await lessons(s, 'GET', null)).code, 401);
  const log = async (who, method = 'GET', body) => { const r = res(); await MO.handle({ method, headers: {}, query: {}, body }, r, { env: MENV, store: { get: async () => [], put: async () => { throw new Error('no write'); } }, who: async () => who, sameOrigin: () => true }); return r; };
  assert.equal((await log(CARLOS)).code, 403); assert.equal((await log(null)).code, 401); assert.equal((await log(FRED)).body.canWrite, false);
  for (const who of [FRED, LUXUS, TEACHY]) assert.equal((await log(who, 'POST', { save: { side: 'buy', entry: 4000, stop: 3990, at: Math.floor(NOW / 1000) } })).code, 403, `${who.u} cannot write the owner's log`);
});

test('a member writes only their own record; only the owner posts notices and saves accounts', async () => {
  const profile = require('../api/profile.js'), users = require('../api/users.js'), notify = require('../api/notify.js');
  const db = new Map(), store = { get: async (u) => db.get(u) || null, put: async (u, v) => { db.set(u, v); } }, d = { env: ENV, deps, store };
  const call = async (h, method, c, body, opt = d) => { const r = res(); await h.handle({ method, headers: { host: 'x.test', cookie: c }, query: { u: 'fred', user: 'fred', key: 'fred' }, body }, r, opt); return r; };
  await call(profile, 'POST', FRED_C, { name: 'Fred F' });
  // Carlos names Fred's record every way a body or a query could: his own record is the one written
  const r = await call(profile, 'POST', CARLOS_C, { name: 'Mallory', u: 'fred', user: 'fred', key: 'fred', account: 'fred', __proto__: { u: 'fred' } });
  assert.equal(r.code, 200); assert.equal(db.get('fred').name, 'Fred F'); assert.equal(db.get('carlos').name, 'Mallory'); assert.deepEqual([...db.keys()].sort(), ['carlos', 'fred']);
  assert.equal((await call(profile, 'GET', CARLOS_C)).body.name, 'Mallory');
  // the account list: a member reads their own record and saves nothing
  let saved = 0; const ud = { env: ENV, deps, builtIns, load: async () => ({ users: {} }), save: async () => { saved++; } };
  const mine = await call(users, 'GET', CARLOS_C, null, ud); assert.deepEqual(Object.keys(mine.body.users), ['carlos']); assert.equal(mine.body.builtins, undefined); assert.doesNotMatch(JSON.stringify(mine.body), /[0-9a-f]{64}/);
  G._reset();
  for (const c of [CARLOS_C, FRED_C]) assert.equal((await call(users, 'POST', c, { users: { carlos: { name: 'Carlos', role: 'reviewer', perms: { ictApply: true, mosha: 'teach', ict: 'write' } } } }, ud)).code, 403);
  assert.equal(saved, 0); G._reset();
  // notices
  const notes = []; const nd = { env: ENV, store: { get: async () => notes.slice(), put: async (l) => { notes.length = 0; notes.push(...l); } }, who: (rq) => S.fromRequest(rq, ENV, deps) };
  for (const c of [CARLOS_C, FRED_C]) { assert.equal((await call(notify, 'POST', c, { title: 'From a member' }, nd)).code, 403); assert.equal((await call(notify, 'POST', c, { remove: 'x' }, nd)).code, 403); assert.equal((await call(notify, 'GET', c, null, nd)).code, 200); }
  assert.equal(notes.length, 0);
});

test('the ICT apply permission: the stored box or Fred\'s built-in default, and nothing else', async () => {
  const L = require('../api/mcp.js').lib, users = require('../api/users.js'), old = L.IO.loadUsers, keys = process.env.MCP_KEYS;
  const withList = async (list, name) => { L.GRANT.users = null; L.GRANT.at = 0; L.IO.loadUsers = typeof list === 'function' ? list : async () => list; return L.canApply(name, 'h', { CTRADER_LINK_KEY: 'k' }, true); };
  try {
    delete process.env.MCP_KEYS;
    assert.equal(await withList({}, 'fred'), true, 'Fred: the owner\'s default');
    assert.equal(await withList({ fred: { ict: true, perms: { ictApply: false } } }, 'fred'), false, 'the unticked box wins');
    assert.equal(await withList({ fred: { ict: true, disabled: true } }, 'fred'), false, 'a disabled Fred');
    assert.equal(await withList({ fred: { ict: 'read' } }, 'fred'), false, 'Fred on read-only ICT');
    assert.equal(await withList(async () => { throw new Error('down'); }, 'fred'), false, 'an unreadable list');
    // every way a record other than Fred's could claim it without the owner's box
    for (const rec of [{ ict: true, ictApply: true }, { ict: true, ictApply: true, perms: {} }, { ict: true, perms: { ictApply: 'true' } }, { ict: true, perms: { ictApply: 1 } }, { ict: true, apply: true, perms: { apply: true } }, { ict: 'read', perms: { ictApply: true } }, { ict: false, perms: { ictApply: true, ict: false } }, { ict: true, perms: { ictApply: true, ict: 'read' } }])
      assert.equal(await withList({ ana: rec, orlando: rec }, 'ana') || await withList({ orlando: rec }, 'orlando'), false, JSON.stringify(rec));
    assert.equal(await withList({ ana: { ict: true, perms: { ictApply: true } } }, 'ana'), true, 'the owner\'s box, with ICT write: the one way in for another member');
    // an MCP_KEYS entry is a connector key, never the apply permission
    process.env.MCP_KEYS = 'zed:abcdefghijklmnopqrstuvwx,carlos:abcdefghijklmnopqrstuvwy';
    assert.equal(await withList({}, 'zed'), false); assert.equal(await withList({}, 'carlos'), false); assert.equal(await withList({ zed: { ictApply: true } }, 'zed'), false);
    // the Users page cannot store the flag outside perms, and only as a boolean; the session's account never invents it
    const h = sha('a-password'), kept = users.clean({ ana: { name: 'Ana', role: 'reviewer', hash: h, ict: true, ictApply: true, mosha: 'teach', home: 'mosha' } });
    assert.deepEqual(kept.ana, { name: 'Ana', role: 'reviewer', hash: h, ict: true }); assert.equal(users.clean({ ana: { name: 'Ana', role: 'reviewer', hash: h, perms: { ictApply: 'yes' } } }), null);
    assert.equal(S.account('ana', kept.ana).ictApply, undefined); assert.equal(A.BUILT_IN.fred.ictApply, true);
    for (const k of Object.keys(A.BUILT_IN)) if (k !== 'fred') assert.equal(A.BUILT_IN[k].ictApply, undefined, `${k} has no built-in apply`);
  } finally { L.IO.loadUsers = old; L.GRANT.users = null; L.GRANT.at = 0; if (keys === undefined) delete process.env.MCP_KEYS; else process.env.MCP_KEYS = keys; }
});
