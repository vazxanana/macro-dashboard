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

// ── page wiring, quality pass (11 Nov 2026) ──
test('page: a notification that could not be sent or deleted says why; a delete no longer fails without a word', async () => {
  const fs = await import('node:fs'); const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(html, /function post\(body\) \{ return fetch\(API, \{ method: 'POST'[^\n]*\.catch\(function \(\) \{ return \{ ok: false, st: 0, j: \{\} \}; \}\); \}/, 'offline is an answer, not an unhandled rejection');
  assert.match(html, /function why\(x\) \{ return x\.st === 401 \|\| x\.st === 403 \? 'your owner session has ended\./);
  assert.match(html, /m\.textContent = 'Not sent: ' \+ why\(x\) \+ ' Your text is kept\.'/);
  assert.match(html, /post\(\{ remove: b\.dataset\.del \}\)\.then\(function \(x\) \{ if \(!x\.ok\) \{ b\.disabled = false; b\.textContent = 'Delete'; m\.textContent = 'Not deleted: ' \+ why\(x\);/);
  assert.doesNotMatch(html, /JSON\.stringify\(\{ remove: b\.dataset\.del \}\) \}\)\.then\(load\)/);
});
test('page: the slide-in card does not take the keyboard from someone typing, hands focus back, and "Mark all read" clears it', async () => {
  const fs = await import('node:fs'); const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(html, /typing = prev && \(\/\^\(INPUT\|TEXTAREA\|SELECT\)\$\/\.test\(prev\.tagName\) \|\| prev\.isContentEditable \|\| document\.querySelector\('dialog\[open\]'\)\);/);
  assert.match(html, /if \(!typing\) setTimeout\(function \(\) \{ var b = c\.querySelector\('\[data-ok\]'\); if \(b\) b\.focus\(\); \}, 60\);/);
  assert.match(html, /var t = prev && prev !== document\.body && document\.contains\(prev\) && prev\.getClientRects\(\)\.length \? prev : bell;/);
  assert.match(html, /badge\(\); var c = document\.querySelector\('\.nt-in'\); if \(c\) c\.remove\(\); \};/);
});
