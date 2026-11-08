// node --test tests/profile.test.mjs — profile photo and name kept on the server (api/profile.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { handle } = createRequire(import.meta.url)('../api/profile.js');
const OWNER = '49c5624f2625ed8b42b6e1bf2819a3a41ddb9743aeca36ea34ea7eb96c252ca8', FRED = 'a'.repeat(64), GONE = 'b'.repeat(64);
const html = "window.MS_USERS = { fred: { name: 'Fred', hash: '" + FRED + "', role: 'reviewer' }, luxus: { name: 'Luxus', hash: '" + GONE + "', role: 'viewer' } };";
const mk = () => { const db = {}; return { db, store: { get: async (u) => db[u] || null, put: async (u, v) => { db[u] = v; } } }; };
const call = async (d, method, { query = {}, headers = {}, body } = {}) => { const out = { code: 0, body: null }; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
  await handle({ method, query, headers, body }, res, { env: { BLOB_READ_WRITE_TOKEN: 't' }, pageHtml: html, blobUsers: async () => ({ users: { luxus: { name: 'Luxus', hash: GONE, role: 'viewer', disabled: true } } }), ...d }); return out; };
const JPG = 'data:image/jpeg;base64,' + 'A'.repeat(200);

test('a member saves a photo and a name and reads them back on another device', async () => {
  const { store, db } = mk();
  assert.equal((await call({ store }, 'POST', { body: { u: 'fred', h: FRED, photo: JPG, name: 'Fred <b>' } })).code, 200);
  assert.equal(db.fred.photo, JPG); assert.equal(db.fred.name, 'Fred b');
  const g = await call({ store }, 'GET', { query: { u: 'fred' }, headers: { 'x-ms-auth': FRED } }); assert.equal(g.body.photo, JPG);
  assert.equal((await call({ store }, 'POST', { body: { u: 'fred', h: FRED, photo: null } })).body.photo, undefined, 'remove photo');
  assert.equal(db.fred.name, 'Fred b', 'the name stays');
});
test('wrong hash, removed users, other accounts and bad images are refused; the owner uses the owner hash', async () => {
  const { store } = mk();
  assert.equal((await call({ store }, 'POST', { body: { u: 'fred', h: OWNER, photo: JPG } })).code, 403);
  assert.equal((await call({ store }, 'POST', { body: { u: 'luxus', h: GONE, photo: JPG } })).code, 403, 'disabled in the list');
  assert.equal((await call({ store }, 'GET', { query: { u: 'fred' }, headers: { 'x-ms-auth': 'c'.repeat(64) } })).code, 403);
  assert.equal((await call({ store }, 'POST', { body: { u: 'fred', h: FRED, photo: 'data:text/html;base64,PHNjcmlwdD4=' } })).code, 400);
  assert.equal((await call({ store }, 'POST', { body: { u: 'fred', h: FRED, photo: 'data:image/jpeg;base64,' + 'A'.repeat(170000) } })).code, 400);
  assert.equal((await call({ store }, 'POST', { body: { u: 'owner', h: OWNER, photo: JPG } })).code, 200);
  assert.equal((await call({ store, blobUsers: async () => { throw new Error('down'); } }, 'POST', { body: { u: 'fred', h: FRED, photo: JPG } })).code, 500, 'fails closed when the list cannot be read');
});
