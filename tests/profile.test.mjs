// node --test tests/profile.test.mjs — profile photo and name kept on the server (api/profile.js), behind the session cookie
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handle } = require('../api/profile.js');
const S = require('../api/_session.js');
const ENV = { BLOB_READ_WRITE_TOKEN: 't', SESSION_SECRET: 'test-session-secret-0123456789' };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const OWNER = '49c5624f2625ed8b42b6e1bf2819a3a41ddb9743aeca36ea34ea7eb96c252ca8', FRED = sha('fred-pw'), GONE = sha('luxus-pw');
const builtIns = { fred: { name: 'Fred', hash: FRED, role: 'reviewer' }, luxus: { name: 'Luxus', hash: GONE, role: 'viewer' } };
const deps = { builtIns, blobUsers: async () => ({ users: { luxus: { name: 'Luxus', hash: GONE, role: 'viewer', disabled: true } } }) };
const cookie = (u, h, role = 'reviewer') => `${S.COOKIE}=${encodeURIComponent(S.issue(ENV, u, h, u === 'owner' ? S.account('owner') : { name: u, role }))}`;
const mk = () => { const db = {}; return { db, store: { get: async (u) => db[u] || null, put: async (u, v) => { db[u] = v; } } }; };
const call = async (d, method, { query = {}, headers = {}, body } = {}) => { const out = { code: 0, body: null }; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
  await handle({ method, query, headers: { host: 'x.test', ...headers }, body }, res, { env: ENV, deps, ...d }); return out; };
const JPG = 'data:image/jpeg;base64,' + 'A'.repeat(200);

test('a member saves a photo and a name with the session cookie and reads them back on another device', async () => {
  const { store, db } = mk(), c = cookie('fred', FRED);
  assert.equal((await call({ store }, 'POST', { headers: { cookie: c }, body: { photo: JPG, name: 'Fred <b>' } })).code, 200);
  assert.equal(db.fred.photo, JPG); assert.equal(db.fred.name, 'Fred b');
  const g = await call({ store }, 'GET', { headers: { cookie: c } }); assert.equal(g.body.photo, JPG);
  assert.equal((await call({ store }, 'POST', { headers: { cookie: c }, body: { photo: null } })).body.photo, undefined, 'remove photo');
  assert.equal(db.fred.name, 'Fred b', 'the name stays');
});
test('profile requires a session: the old {u, h} hash body and X-MS-Auth header are refused', async () => {
  const { store, db } = mk();
  assert.equal((await call({ store }, 'POST', { body: { u: 'fred', h: FRED, photo: JPG } })).code, 401);
  assert.equal((await call({ store }, 'GET', { query: { u: 'fred' }, headers: { 'x-ms-auth': FRED } })).code, 401);
  assert.equal((await call({ store }, 'POST', { headers: { cookie: `${S.COOKIE}=forged.token` }, body: { photo: JPG } })).code, 401);
  assert.equal(Object.keys(db).length, 0);
});
test('a session writes only its own record; removed users, bad images and cross-site posts are refused; the owner too', async () => {
  const { store, db } = mk();
  assert.equal((await call({ store }, 'POST', { headers: { cookie: cookie('fred', FRED) }, body: { u: 'owner', photo: JPG } })).code, 200);
  assert.ok(db.fred && !db.owner, 'u in the body is ignored');
  assert.equal((await call({ store }, 'POST', { headers: { cookie: cookie('luxus', GONE, 'viewer') }, body: { photo: JPG } })).code, 401, 'disabled in the list');
  assert.equal((await call({ store }, 'POST', { headers: { cookie: cookie('fred', sha('old-pw')) }, body: { photo: JPG } })).code, 401, 'password changed since');
  assert.equal((await call({ store }, 'POST', { headers: { cookie: cookie('fred', FRED) }, body: { photo: 'data:text/html;base64,PHNjcmlwdD4=' } })).code, 400);
  assert.equal((await call({ store }, 'POST', { headers: { cookie: cookie('fred', FRED) }, body: { photo: 'data:image/jpeg;base64,' + 'A'.repeat(170000) } })).code, 400);
  assert.equal((await call({ store }, 'POST', { headers: { cookie: cookie('fred', FRED), origin: 'https://evil.test' }, body: { photo: JPG } })).code, 403);
  assert.equal((await call({ store }, 'POST', { headers: { cookie: cookie('owner', OWNER) }, body: { photo: JPG } })).code, 200); assert.ok(db.owner);
  assert.equal((await call({ store, deps: { builtIns, blobUsers: async () => { throw new Error('down'); } } }, 'POST', { headers: { cookie: cookie('fred', FRED) }, body: { photo: JPG } })).code, 503, 'fails closed when the list cannot be read');
});
