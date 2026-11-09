// node --test tests/notify.test.mjs — desk notifications (api/notify.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { handle } = createRequire(import.meta.url)('../api/notify.js');
const mk = () => { let db = []; return { get: async () => db, put: async (v) => { db = v; }, peek: () => db }; };
const call = async (store, method, who, body, extra = {}) => { const out = {}; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
  await handle({ method, body }, res, { env: {}, store, who: async () => who, sameOrigin: () => true, ...extra }); return out; };
const OWNER = { u: 'owner' }, FRED = { u: 'fred' };
test('only the owner sends; members read; guests get nothing', async () => {
  const s = mk();
  assert.equal((await call(s, 'GET', null)).code, 401);
  assert.equal((await call(s, 'POST', FRED, { title: 'hi' })).code, 403);
  assert.equal((await call(s, 'POST', OWNER, {})).code, 400);
  const p = await call(s, 'POST', OWNER, { title: 'Market closed early', body: 'No trades after 17:00 <b>today</b>' }); assert.equal(p.code, 200);
  await call(s, 'POST', OWNER, { body: 'second' });
  const g = await call(s, 'GET', FRED); assert.equal(g.body.items.length, 2); assert.equal(g.body.items[0].body, 'second', 'newest first'); assert.equal(g.body.items[0].title, 'Message from the desk');
  assert.equal((await call(s, 'POST', OWNER, { remove: p.body.item.id })).body.removed, 1); assert.equal(s.peek().length, 1);
  assert.equal((await call(s, 'POST', OWNER, { title: 'x' }, { sameOrigin: () => false })).code, 403, 'cross-site refused');
});
