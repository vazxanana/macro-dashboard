// node --test tests/sounds.test.mjs — owner-chosen ChronosTrade sounds (api/sounds.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { handle } = createRequire(import.meta.url)('../api/sounds.js');
const mk = () => { let db = null; return { store: { get: async () => db, put: async (v) => { db = v; } }, peek: () => db }; };
const call = async (d, method, body) => { const out = {}; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
  await handle({ method, body }, res, { env: {}, isOwner: (pw) => pw === 'right', ...d }); return out; };
const MP3 = 'data:audio/mpeg;base64,' + 'A'.repeat(400);
test('only the owner sets sounds; everyone reads them', async () => {
  const s = mk();
  assert.equal((await call({ store: s.store }, 'POST', { ownerPw: 'wrong', kind: 'sl', data: MP3 })).code, 403);
  assert.equal((await call({ store: s.store }, 'POST', { ownerPw: 'right', kind: 'sl', data: MP3, name: 'faaah.mp3' })).code, 200);
  const g = await call({ store: s.store }, 'GET'); assert.equal(g.body.sl.data, MP3); assert.equal(g.body.tp, null);
  assert.equal((await call({ store: s.store }, 'POST', { ownerPw: 'right', kind: 'tp', data: 'data:text/html;base64,PHNjcmlwdD4=' })).code, 400);
  assert.equal((await call({ store: s.store }, 'POST', { ownerPw: 'right', kind: 'xx', data: MP3 })).code, 400);
  assert.equal((await call({ store: s.store }, 'POST', { ownerPw: 'right', kind: 'sl', data: 'data:audio/mpeg;base64,' + 'A'.repeat(1000000) })).code, 400);
  assert.equal((await call({ store: s.store }, 'POST', { ownerPw: 'right', kind: 'sl', data: null })).code, 200); assert.equal(s.peek().sl, null, 'reset');
});
