// The site's file store on Cloudflare D1 (cloudflare/src/store-d1.mjs, store-mirror.mjs, store-blob.mjs): the @vercel/blob
// stand-in behind the switch STORE, reading files by their store URL, the mirror from the Vercel store, and real api/
// handlers (sign-in, users, notices, profile, lesson pictures, price alerts) running on it. Offline: D1 is node:sqlite in
// memory behind the D1 binding's calls, the Vercel Blob service is an in-memory fake, and any other network call fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Module, { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { blobApi, d1Store, STORE_HOST, CHUNK, PAGE, MAX_BYTES, NOT_READY, withSuffix, pathOf } from '../cloudflare/src/store-d1.mjs';
import { storeMirror, TEN } from '../cloudflare/src/store-mirror.mjs';
const require = createRequire(import.meta.url);

// ---- fakes ------------------------------------------------------------------------------------------------------------
// The D1 binding's calls (prepare / bind / first / all / run / batch) on a real SQLite: batch is one transaction,
// undefined cannot be bound, booleans become 0 / 1, errors read "D1_ERROR: …" as D1's do.
function fakeD1() {
  const sq = new DatabaseSync(':memory:');
  const db = { queries: 0, fail: null };
  const conv = (v) => { if (v === undefined) throw new Error("D1_TYPE_ERROR: Type 'undefined' not supported"); return typeof v === 'boolean' ? (v ? 1 : 0) : v instanceof ArrayBuffer ? new Uint8Array(v) : v; };
  const exec = (sql, args) => {
    db.queries++;
    if (db.fail && db.fail(sql)) throw new Error('D1_ERROR: injected failure');
    try {
      const st = sq.prepare(sql), a = args.map(conv);
      if (/^\s*(SELECT|WITH)\b|\bRETURNING\b/i.test(sql)) return { results: st.all(...a).map((r) => ({ ...r })), success: true, meta: { changes: 0 } };
      const r = st.run(...a); return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    } catch (e) { throw new Error(`D1_ERROR: ${e.message}`); }
  };
  const stmt = (sql, args = []) => ({ sql, args, bind: (...a) => stmt(sql, a), all: async () => exec(sql, args), run: async () => exec(sql, args),
    first: async (col) => { const r = exec(sql, args).results[0]; return r == null ? null : col ? r[col] : r; } });
  db.prepare = (sql) => stmt(sql);
  db.batch = async (list) => {
    sq.exec('BEGIN');
    try { const out = list.map((s) => exec(s.sql, s.args)); sq.exec('COMMIT'); return out; } catch (e) { sq.exec('ROLLBACK'); throw e; }
  };
  db.sql = sq;
  return db;
}
// The Vercel Blob service: the real package's list / put / del / head and reading a file by URL with the token.
function fakeVercel(token = 'tok') {
  const host = 'store1.private.blob.vercel-storage.com', files = new Map(), reads = [];
  let clock = Date.UTC(2026, 10, 1);
  const url = (p) => `https://${host}/${p}`, auth = (o) => { if (!o || o.token !== token) throw new Error('Vercel Blob: Access denied'); };
  const meta = (p) => { const f = files.get(p); return { url: url(p), downloadUrl: url(p) + '?download=1', pathname: p, size: f.bytes.length, uploadedAt: new Date(f.at), etag: f.etag }; };
  const set = (p, body, type = 'application/json', at = (clock += 1000)) => { files.set(p, { bytes: typeof body === 'string' ? new TextEncoder().encode(body) : body, type, at, etag: `"${crypto.randomUUID()}"` }); return p; };
  const real = {
    calls: [],
    async list(o = {}) { real.calls.push('list'); auth(o); const lim = Math.min(o.limit || 1000, 1000), all = [...files.keys()].filter((p) => p.startsWith(o.prefix || '')).sort(), i = o.cursor ? +o.cursor : 0;
      return { blobs: all.slice(i, i + lim).map(meta), hasMore: i + lim < all.length, cursor: i + lim < all.length ? String(i + lim) : undefined }; },
    async put(p, body, o) { real.calls.push('put'); auth(o); const q = o.addRandomSuffix ? withSuffix(p) : p; if (files.has(q) && !o.allowOverwrite) throw new Error('Vercel Blob: This blob already exists');
      set(q, typeof body === 'string' ? body : new Uint8Array(body), o.contentType); return { url: url(q), pathname: q, etag: files.get(q).etag }; },
    async del(u, o) { real.calls.push('del'); auth(o); for (const x of [].concat(u)) files.delete(pathOf(x)); },
    async head(u, o) { real.calls.push('head'); auth(o); return meta(pathOf(u)); },
  };
  const fetch = async (input, init = {}) => {
    const u = new URL(String(input));
    if (u.hostname !== host) throw new Error(`no network in tests: ${u.href}`);
    if (new Headers(init.headers).get('authorization') !== `Bearer ${token}`) return new Response('forbidden', { status: 403 });
    const f = files.get(pathOf(u.origin + u.pathname)); reads.push(u.href);
    if (!f) return new Response('not found', { status: 404 });
    if (init.during) await init.during();
    return new Response(f.bytes, { headers: { 'content-type': f.type } });
  };
  return { files, real, fetch, set, reads, host, tick: () => (clock += 1000) };
}

// One shared world for the handler tests: '@vercel/blob' is the switch, global fetch reaches the fake Vercel store and,
// through the switch's wrapper, the D1 store.
const V = fakeVercel(), ENV = { BLOB_READ_WRITE_TOKEN: 'tok', SESSION_SECRET: 'test-session-secret-0123456789', STORE_DB: fakeD1() };
const API = blobApi({ real: V.real, env: () => ENV });
globalThis.fetch = V.fetch;
API.installFetch(globalThis);
const origLoad = Module._load;
Module._load = function (r, ...rest) { if (r === '@vercel/blob') return API; return origLoad.call(this, r, ...rest); };
process.env.BLOB_READ_WRITE_TOKEN = 'tok';
const ready = async (db) => { const st = d1Store(db); await st.ensure(); await st.setState({ ready: new Date().toISOString() }); };
const freshEnv = async (o = {}) => { const e = { BLOB_READ_WRITE_TOKEN: 'tok', STORE: 'd1', STORE_DB: fakeD1(), ...o }; if (o.ready !== false) await ready(e.STORE_DB); return e; };
const T = { access: 'private', contentType: 'application/json', token: 'tok' };
const read = async (url, tok = 'tok') => { const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }); return r; };

// ---- the stand-in -------------------------------------------------------------------------------------------------------
test('every call shape the api/ modules use works on D1: put (overwrite, refusal, random suffix), list, read by URL, head, del', async () => {
  const env = await freshEnv(), a = blobApi({ real: V.real, env });
  const r = await a.put('notices/list.json', '[1]', { ...T, addRandomSuffix: false, allowOverwrite: true });
  assert.equal(new URL(r.url).hostname, STORE_HOST); assert.equal(r.pathname, 'notices/list.json'); assert.match(r.etag, /^"[0-9a-f]{32}"$/);
  const r2 = await a.put('notices/list.json', '[1,2]', { ...T, addRandomSuffix: false, allowOverwrite: true });
  assert.notEqual(r2.etag, r.etag);
  await assert.rejects(a.put('notices/list.json', '[3]', { ...T, addRandomSuffix: false, allowOverwrite: false }), /already exists/);
  await assert.rejects(a.put('mosha/shots/a.jpg', 'x', { access: 'private', token: 'tok' }).then(() => a.put('mosha/shots/a.jpg', 'y', { access: 'private', token: 'tok' })), /already exists/, 'no allowOverwrite = refused, as on Vercel');
  const s = await a.put('users/1731.json', '{"users":{}}', { ...T, addRandomSuffix: true });
  assert.match(s.pathname, /^users\/1731-[A-Za-z0-9]{30}\.json$/);
  const p = await a.put('bridge/ping-mt5.json', '{}', { ...T, addRandomSuffix: true });
  assert.equal((p.pathname.match(/ping-([a-z0-9]+)/) || [])[1], 'mt5', 'api/bridge.js reads the client from the name');
  // list: prefix, shape, Date upload time, newest by uploadedAt
  const { blobs, hasMore, cursor } = await a.list({ prefix: 'notices/list.json', token: 'tok' });
  assert.equal(hasMore, false); assert.equal(cursor, undefined); assert.equal(blobs.length, 1);
  assert.deepEqual(Object.keys(blobs[0]).sort(), ['downloadUrl', 'etag', 'pathname', 'size', 'uploadedAt', 'url']);
  assert.ok(blobs[0].uploadedAt instanceof Date); assert.equal(blobs[0].size, 5); assert.equal(blobs[0].etag, r2.etag);
  // reading by URL through the wrapped fetch, with ?cache=0 as the handlers send it, with and without the token
  const u = new URL(blobs[0].url); u.searchParams.set('cache', '0');
  const g = await a.answer(u, 'GET', new Headers({ authorization: 'Bearer tok' }));
  assert.equal(g.status, 200); assert.equal(await g.text(), '[1,2]'); assert.equal(g.headers.get('content-type'), 'application/json');
  assert.equal((await a.answer(u, 'GET', new Headers({ authorization: 'Bearer nope' }))).status, 403);
  assert.equal((await a.answer(u, 'POST', new Headers({ authorization: 'Bearer tok' }))).status, 405);
  assert.equal((await a.answer(new URL(`https://${STORE_HOST}/nothing.json`), 'GET', new Headers({ authorization: 'Bearer tok' }))).status, 404);
  const h = await a.head(blobs[0].url, { token: 'tok' }); assert.equal(h.size, 5); assert.equal(h.contentType, 'application/json');
  // del: one URL, a list, a pathname; deleting what is not there is no error
  await a.del(blobs[0].url, { token: 'tok' });
  await a.del([s.url, 'bridge/' + p.pathname.split('/')[1], 'never/there.json'], { token: 'tok' });
  assert.equal((await a.list({ token: 'tok' })).blobs.length, 1, 'only mosha/shots/a.jpg is left');
  await assert.rejects(a.head('notices/list.json', { token: 'tok' }), /does not exist/);
  // what Vercel refuses, refused the same way
  await assert.rejects(a.put('x.json', '', T), /body is required/);
  await assert.rejects(a.put('x.json', { a: 1 }, T), /plain JavaScript object/);
  await assert.rejects(a.put('a//b.json', '1', T), /cannot contain/);
  await assert.rejects(a.put('x.json', '1', { token: 'tok' }), /access must be/);
  await assert.rejects(blobApi({ real: V.real, env: { ...env, BLOB_READ_WRITE_TOKEN: '' } }).list({}), /No blob credentials/);
  await assert.rejects(a.put('x.json', '1', { ...T, ifMatch: '"e"' }), /not available on the Cloudflare store/);
  await assert.rejects(blobApi({ real: { copy: async () => 'vercel' }, env }).copy('a', 'b', T), /copy\(\) is not available on the Cloudflare store/);
});

test('list pages with limit and cursor, prefix matching is literal (no % or _ wildcards)', async () => {
  const env = await freshEnv(), a = blobApi({ real: V.real, env });
  for (const p of ['push/a/d.json', 'push/b/d.json', 'push/c/d.json', 'push/d/d.json', 'push/e/d.json', 'pusher.json', 'p%sh/x.json', 'p_sh/y.json']) await a.put(p, '{}', T);
  const seen = []; let cursor, pages = 0;
  do { const r = await a.list({ prefix: 'push/', limit: 2, cursor, token: 'tok' }); seen.push(...r.blobs.map((b) => b.pathname)); cursor = r.hasMore ? r.cursor : undefined; pages++; } while (cursor);
  assert.deepEqual(seen, ['push/a/d.json', 'push/b/d.json', 'push/c/d.json', 'push/d/d.json', 'push/e/d.json']); assert.equal(pages, 3);
  assert.deepEqual((await a.list({ prefix: 'p%', token: 'tok' })).blobs.map((b) => b.pathname), ['p%sh/x.json']);
  assert.deepEqual((await a.list({ prefix: 'p_', token: 'tok' })).blobs.map((b) => b.pathname), ['p_sh/y.json']);
  assert.equal((await a.list({ token: 'tok', limit: 5000 })).blobs.length, 8, 'a limit over 1000 is cut to 1000');
  await assert.rejects(a.list({ token: 'tok', cursor: '' + '' || '!!' }), /bad cursor/);
});

test('big files are kept in chunks, read back whole, and refused past the limit; nothing half written stays', async () => {
  const env = await freshEnv(), a = blobApi({ real: V.real, env }), db = env.STORE_DB;
  ENV.STORE = 'd1'; const saved = ENV.STORE_DB; ENV.STORE_DB = db;
  try {
    for (const n of [0, 1, CHUNK, CHUNK + 1, Math.round(1.5 * 1024 * 1024), PAGE * CHUNK + 12345]) {
      const buf = crypto.randomBytes(n), p = `mosha/shots/f${n}.jpg`;
      if (n === 0) { await a.put(p, Buffer.alloc(0), { access: 'private', token: 'tok', contentType: 'image/jpeg' }); }
      else await a.put(p, buf, { access: 'private', token: 'tok', contentType: 'image/jpeg' });
      const r = await read(`https://${STORE_HOST}/${p}`);
      assert.equal(r.status, 200); assert.ok(Buffer.from(await r.arrayBuffer()).equals(buf), `${n} bytes back whole`);
      const rows = db.sql.prepare('SELECT COUNT(*) AS c FROM store_chunks WHERE pathname = ?').get(p).c;
      assert.equal(rows, Math.ceil(n / CHUNK));
    }
    // an overwrite of a big file leaves only the new version's chunks
    const big2 = crypto.randomBytes(PAGE * CHUNK + 99);
    await a.put('mosha/book.json', crypto.randomBytes(PAGE * CHUNK + 5), { ...T, allowOverwrite: true });
    await a.put('mosha/book.json', big2, { ...T, allowOverwrite: true });
    assert.ok(Buffer.from(await (await read(`https://${STORE_HOST}/mosha/book.json`)).arrayBuffer()).equals(big2));
    assert.equal(db.sql.prepare("SELECT COUNT(DISTINCT etag) AS c FROM store_chunks WHERE pathname = 'mosha/book.json'").get().c, 1);
    // too large: a clear error, nothing stored
    await assert.rejects(a.put('huge.bin', Buffer.alloc(MAX_BYTES + 1), { access: 'private', token: 'tok' }), /File is too large/);
    // a refused create of a big file takes its chunks away again
    await assert.rejects(a.put('mosha/book.json', crypto.randomBytes(PAGE * CHUNK + 1), { ...T, allowOverwrite: false }), /already exists/);
    assert.equal(db.sql.prepare("SELECT COUNT(DISTINCT etag) AS c FROM store_chunks WHERE pathname = 'mosha/book.json'").get().c, 1);
    assert.equal(db.sql.prepare("SELECT COUNT(*) AS c FROM store_chunks WHERE pathname = 'huge.bin'").get().c, 0);
    // a commit that failed half way (D1 error) leaves no visible file; its stray chunks are cleared by the housekeeping
    db.fail = (sql) => sql.startsWith('INSERT INTO store_blobs');
    await assert.rejects(a.put('half.json', '{"a":1}', T), /injected/);
    db.fail = null;
    assert.equal((await read(`https://${STORE_HOST}/half.json`)).status, 404);
    assert.equal(db.sql.prepare("SELECT COUNT(*) AS c FROM store_chunks WHERE pathname = 'half.json'").get().c, 0, 'the batch rolled back whole');
    // chunks of a big write whose commit never ran are cleared by the housekeeping after an hour
    db.sql.prepare("INSERT INTO store_chunks (pathname, etag, n, data, at) VALUES ('stray.bin', '\"e\"', 0, 'AA==', 1)").run();
    assert.equal((await d1Store(db).housekeep(Date.now(), false)).orphans, 1);
  } finally { delete ENV.STORE; ENV.STORE_DB = saved; }
});

test('the switch: OFF by default every call goes to the real package; ON, nothing reaches Vercel; not ready = fail closed', async () => {
  const v = fakeVercel(), env = { BLOB_READ_WRITE_TOKEN: 'tok', STORE_DB: fakeD1() }, a = blobApi({ real: v.real, env: () => env });
  assert.equal(a.on(), false);
  await a.put('notices/list.json', '[1]', { ...T, allowOverwrite: true }); await a.list({ prefix: 'n', token: 'tok' }); await a.del('notices/list.json', { token: 'tok' });
  assert.deepEqual(v.real.calls, ['put', 'list', 'del']);
  assert.equal((await a.answer(new URL(`https://${STORE_HOST}/x`), 'GET', new Headers({ authorization: 'Bearer tok' }))).status, 404, 'off: a store URL answers nothing');
  for (const s of ['d1', ' D1 ']) { env.STORE = s; assert.equal(a.on(), true); }
  for (const s of ['', 'vercel', 'd2', 'true']) { env.STORE = s; assert.equal(a.on(), false); }
  env.STORE = 'd1';
  await assert.rejects(a.list({ token: 'tok' }), (e) => e.message.includes(NOT_READY), 'no complete copy recorded yet: refused, never empty');
  await assert.rejects(a.put('x.json', '1', T), /not ready/);
  await ready(env.STORE_DB);
  await a.put('x.json', '1', T); assert.deepEqual(v.real.calls, ['put', 'list', 'del'], 'nothing more reached Vercel');
  env.STORE = 'd1'; delete env.STORE_DB;
  await assert.rejects(a.list({ token: 'tok' }), /STORE_DB binding/);
  // the fetch wrapper: other hosts pass through untouched, store URLs never leave
  const seen = [], t = { fetch: async (u) => { seen.push(String(u)); return new Response('net'); } };
  blobApi({ real: v.real, env: () => env }).installFetch(t);
  assert.equal(await (await t.fetch('https://example.test/a')).text(), 'net');
  await t.fetch(`https://${STORE_HOST}/a`, { headers: { Authorization: 'Bearer tok' } }).catch(() => {});
  assert.deepEqual(seen, ['https://example.test/a']);
});

// ---- the mirror ---------------------------------------------------------------------------------------------------------
const rowsOf = (db) => Object.fromEntries(db.sql.prepare('SELECT pathname, uploaded_at, src FROM store_blobs').all().map((r) => [r.pathname, { at: r.uploaded_at, src: r.src }]));
const textOf = async (db, p) => { const f = await d1Store(db).readFile(p); return f && Buffer.from(f.bytes).toString(); };

test('mirror (switch off): copies new and changed files, skips unchanged ones, follows deletes, runs bounded, records ready', async () => {
  const v = fakeVercel(), db = fakeD1(), env = { BLOB_READ_WRITE_TOKEN: 'tok', STORE_DB: db }, deps = { list: v.real.list, fetch: v.fetch, perRun: 2 };
  v.set('users/1-a.json', '{"users":{}}'); v.set('profiles/fred.json', '{"name":"Fred"}'); v.set('mosha/shots/x.jpg', crypto.randomBytes(CHUNK + 7), 'image/jpeg');
  const r1 = await storeMirror(env, deps);
  assert.deepEqual([r1.copied, r1.left, r1.complete, r1.ready], [2, 1, false, null], 'two a run');
  assert.equal(await storeMirror(env, { ...deps, cron: '* * * * *' }).then((r) => r.quiet), true, 'the minute cron does not mirror');
  const r2 = await storeMirror(env, deps);
  assert.deepEqual([r2.copied, r2.left, r2.complete], [1, 0, true]); assert.ok(r2.ready);
  assert.equal(await textOf(db, 'profiles/fred.json'), '{"name":"Fred"}');
  assert.equal((await d1Store(db).readFile('mosha/shots/x.jpg')).contentType, 'image/jpeg');
  assert.equal(rowsOf(db)['users/1-a.json'].at, v.files.get('users/1-a.json').at, 'the copy keeps Vercel\'s upload time');
  const before = v.reads.length, r3 = await storeMirror(env, deps);
  assert.deepEqual([r3.copied, r3.deleted, v.reads.length - before], [0, 0, 0], 'unchanged: nothing read');
  v.set('profiles/fred.json', '{"name":"Freddy"}'); v.files.delete('users/1-a.json'); v.set('users/2-b.json', '{"users":{"x":1}}');
  const r4 = await storeMirror(env, deps);
  assert.deepEqual([r4.copied, r4.deleted], [2, 1]);
  assert.equal(await textOf(db, 'profiles/fred.json'), '{"name":"Freddy"}'); assert.equal(rowsOf(db)['users/1-a.json'], undefined);
  // a failed read is retried next run and keeps the run from counting as complete
  v.set('notices/list.json', '[]'); const realFetch = deps.fetch;
  const r5 = await storeMirror(env, { ...deps, fetch: async (u, o) => (String(u).includes('notices') ? new Response('x', { status: 500 }) : realFetch(u, o)) });
  assert.deepEqual([r5.failed, r5.complete], [1, false]); assert.match(r5.errors[0], /notices\/list.json: read 500/);
  assert.equal((await storeMirror(env, deps)).copied, 1);
  assert.equal((await storeMirror({ STORE_DB: db }, deps)).skip, 'no BLOB_READ_WRITE_TOKEN');
  assert.equal((await storeMirror({ BLOB_READ_WRITE_TOKEN: 'tok' }, deps)).skip, 'no STORE_DB binding');
  assert.equal((await storeMirror({ ...env, STORE_MIRROR: 'off' }, deps)).skip, 'STORE_MIRROR is off');
});

test('final pass (switch on): copies only newer Vercel files, never over a write or delete made here, then stops; switch back keeps them', async () => {
  const v = fakeVercel(), db = fakeD1(), env = { BLOB_READ_WRITE_TOKEN: 'tok', STORE_DB: db }, deps = { list: v.real.list, fetch: v.fetch };
  for (const p of ['notices/list.json', 'profiles/fred.json', 'ctlink/fred/1.json', 'push/a/d-1.json', 'sounds/config.json']) v.set(p, `"${p} v1"`);
  assert.equal((await storeMirror(env, deps)).complete, true);
  // in the gap before the switch, Vercel keeps changing
  v.set('notices/list.json', '"notices v2"'); v.set('mosha/trades.json', '"new in the gap"'); v.files.delete('ctlink/fred/1.json');
  v.set('sounds/config.json', '"sounds v2"'); v.set('push/a/d-1.json', '"push v2"');
  // the switch: the site writes and deletes in D1 before the final pass runs
  env.STORE = 'd1'; const a = blobApi({ real: v.real, env });
  await a.put('sounds/config.json', '"sounds written after the switch"', { ...T, allowOverwrite: true });
  await a.del((await a.list({ prefix: 'push/a/', token: 'tok' })).blobs.map((b) => b.url), { token: 'tok' });
  // a write that lands while the final pass is reading the same file from Vercel
  v.set('profiles/fred.json', '"profile v2 at Vercel"');
  const race = async () => { await a.put('profiles/fred.json', '"profile written during the copy"', { ...T, allowOverwrite: true }); };
  const f1 = await storeMirror(env, { ...deps, fetch: (u, o) => v.fetch(u, String(u).includes('profiles') ? { ...o, during: race } : o) });
  assert.equal(f1.mode, 'd1'); assert.equal(f1.complete, true); assert.equal(f1.skipped, 1, 'the copy lost to the write made during it');
  assert.equal(await textOf(db, 'notices/list.json'), '"notices v2"', 'newer at Vercel: copied');
  assert.equal(await textOf(db, 'mosha/trades.json'), '"new in the gap"', 'new in the gap: copied');
  assert.equal(await textOf(db, 'sounds/config.json'), '"sounds written after the switch"', 'never over a write made here');
  assert.equal(await textOf(db, 'profiles/fred.json'), '"profile written during the copy"');
  assert.equal(await textOf(db, 'push/a/d-1.json'), null, 'never brings back a file deleted here');
  assert.equal(await textOf(db, 'ctlink/fred/1.json'), null, 'a file Vercel deleted in the gap is gone (an unlink stays unlinked)');
  const st = await d1Store(db).state(); assert.ok(st.final.done); assert.ok(st.switchedAt);
  // stopped: no more Vercel reads, on either cron
  const n = v.real.calls.length;
  assert.equal((await storeMirror(env, deps)).skip, 'final pass done'); assert.equal((await storeMirror(env, { ...deps, cron: '* * * * *' })).quiet, true);
  assert.equal(v.real.calls.length, n);
  // switch back: the site reads Vercel again; the mirror never overwrites or deletes what the site wrote in D1 (kept)
  delete env.STORE;
  const b = await storeMirror(env, deps);
  assert.equal(b.mode, 'mirror'); assert.ok(b.kept >= 2);
  assert.equal(await textOf(db, 'sounds/config.json'), '"sounds written after the switch"');
  const st2 = await d1Store(db).state(); assert.equal(st2.final, null); assert.equal(st2.switchedAt, null);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS c FROM store_gone').get().c, 0, 'tombstones are cleared once no final pass needs them');
});

test('final pass on the minute cron only during the first hour after the switch; it fails closed while never complete', async () => {
  const v = fakeVercel(), db = fakeD1(), env = { BLOB_READ_WRITE_TOKEN: 'tok', STORE_DB: db, STORE: 'd1' };
  v.set('users/1-a.json', '{"users":{}}');
  const t0 = Date.UTC(2026, 10, 17, 12);
  const r = await storeMirror(env, { list: async () => { throw new Error('Vercel down'); }, fetch: v.fetch, now: t0 }).catch((e) => ({ error: e.message }));
  assert.match(r.error, /Vercel down/);
  assert.equal(await storeMirror(env, { list: v.real.list, fetch: v.fetch, cron: '* * * * *', now: t0 + 2 * 3600e3 }).then((x) => x.quiet), true, 'past the first hour: the 10-minute cron only');
  const ok = await storeMirror(env, { list: v.real.list, fetch: v.fetch, cron: '* * * * *', now: t0 + 60e3 });
  assert.equal(ok.complete, true); assert.ok(ok.ready, 'a complete final pass also makes the store ready');
});

// ---- real handlers on the D1 store ------------------------------------------------------------------------------------
const S = require('../api/_session.js'), A = require('../api/_accounts.js');
function res() { const r = { code: 0, body: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; return r; }; r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; }; r.send = (b) => { r.body = b; return r; }; return r; }
const call = async (h, req, d) => { const r = res(); await h.handle({ query: {}, ...req, headers: { host: 'x.test', ...(req.headers || {}) } }, r, d); return r; };
const owner = () => `${S.COOKIE}=${encodeURIComponent(S.issue(ENV, 'owner', A.OWNER_HASH, S.account('owner')))}`;
const d1World = async () => { const db = fakeD1(); await ready(db); ENV.STORE = 'd1'; ENV.STORE_DB = db; S._cache.users = null; S._cache.at = 0; return db; };

test('sign-in on D1: the owner saves members (users.js), a member signs in (login.js through _accounts.js), a new password ends the old one', async () => {
  const db = await d1World(), users = require('../api/users.js'), login = require('../api/login.js');
  try {
    await API.put('users/1-seed.json', JSON.stringify({ users: {} }), { ...T, addRandomSuffix: true });   // as the mirror left it
    const s1 = await call(users, { method: 'POST', headers: { cookie: owner() }, body: { users: { maria: { name: 'Maria', role: 'viewer', pw: 'maria-pw-1' } }, note: 'add' } }, { env: ENV });
    assert.equal(s1.code, 200, JSON.stringify(s1.body));
    const files = db.sql.prepare("SELECT pathname FROM store_blobs WHERE pathname LIKE 'users/%'").all();
    assert.equal(files.length, 1, 'the save is a new file and the older one is deleted'); assert.notEqual(files[0].pathname, 'users/1-seed.json');
    const ok = await call(login, { method: 'POST', body: { id: 'maria', password: 'maria-pw-1' } }, { env: ENV });
    assert.equal(ok.code, 200); assert.equal(ok.body.account.u, 'maria'); assert.match(ok.headers['set-cookie'], /^ms_session=/);
    assert.equal((await call(users, { method: 'POST', headers: { cookie: owner() }, body: { users: { maria: { name: 'Maria', role: 'viewer', pw: 'maria-pw-2' } } } }, { env: ENV })).code, 200);
    assert.equal((await call(login, { method: 'POST', body: { id: 'maria', password: 'maria-pw-1' } }, { env: ENV })).code, 401, 'read back at once: the old password is refused');
    assert.equal((await call(login, { method: 'POST', body: { id: 'maria', password: 'maria-pw-2' } }, { env: ENV })).code, 200);
    // a store that cannot be read: sign-in fails closed (503), never the built-ins alone
    db.fail = (sql) => sql.includes('store_blobs');
    assert.equal((await call(login, { method: 'POST', body: { id: 'maria', password: 'maria-pw-2' } }, { env: ENV })).code, 503);
    db.fail = null;
  } finally { delete ENV.STORE; }
});

test('notices (notify.js) and the profile (profile.js) on D1: written in place, read back at once', async () => {
  await d1World();
  try {
    const notify = require('../api/notify.js'), profile = require('../api/profile.js');
    await API.put('users/1-seed.json', JSON.stringify({ users: { fred: { name: 'Fred', role: 'reviewer', hash: crypto.createHash('sha256').update('fred-pw').digest('hex') } } }), { ...T, addRandomSuffix: true });
    const fred = `${S.COOKIE}=${encodeURIComponent(S.issue(ENV, 'fred', crypto.createHash('sha256').update('fred-pw').digest('hex'), { name: 'Fred', role: 'reviewer' }))}`;
    const p1 = await call(notify, { method: 'POST', headers: { cookie: owner() }, body: { title: 'Hello', body: 'First' } }, { env: ENV });
    assert.equal(p1.code, 200, JSON.stringify(p1.body));
    await call(notify, { method: 'POST', headers: { cookie: owner() }, body: { title: 'Two' } }, { env: ENV });
    const g = await call(notify, { method: 'GET', headers: { cookie: fred } }, { env: ENV });
    assert.equal(g.code, 200); assert.deepEqual(g.body.items.map((x) => x.title), ['Two', 'Hello']);
    assert.equal((await call(notify, { method: 'POST', headers: { cookie: owner() }, body: { remove: p1.body.item.id } }, { env: ENV })).body.removed, 1);
    const photo = 'data:image/jpeg;base64,' + 'A'.repeat(100000);
    assert.equal((await call(profile, { method: 'POST', headers: { cookie: fred }, body: { photo, name: 'Fred F' } }, { env: ENV })).code, 200);
    const pg = await call(profile, { method: 'GET', headers: { cookie: fred } }, { env: ENV });
    assert.equal(pg.body.photo, photo); assert.equal(pg.body.name, 'Fred F');
    assert.equal((await call(profile, { method: 'GET', headers: { cookie: 'ms_session=forged' } }, { env: ENV })).code, 401, 'the session check is unchanged');
  } finally { delete ENV.STORE; }
});

test('lesson pictures (mosha-lessons.js store) on D1: chunked pictures, no overwrite', async () => {
  await d1World();
  try {
    const ML = require('../api/mosha-lessons.js'), st = ML.blobStore(ENV), pic = crypto.randomBytes(Math.round(1.5 * 1024 * 1024));
    await st.putImg('abc123', 'image/jpeg', pic);
    assert.ok((await st.getImg('abc123', 'image/jpeg')).equals(pic), 'a 1.5 MB picture read back whole (no ?cache=0 on pictures)');
    await assert.rejects(st.putImg('abc123', 'image/jpeg', pic), /already exists/, 'a picture is never overwritten');
    await st.put([{ id: 'l1', shots: [{ img: 'abc123', type: 'image/jpeg' }] }]); assert.equal((await st.get())[0].id, 'l1');
    await st.delImg('abc123', 'image/jpeg'); assert.equal(await st.getImg('abc123', 'image/jpeg'), null);
  } finally { delete ENV.STORE; }
});

// ---- wiring and coverage ------------------------------------------------------------------------------------------------
test('wiring: the binding and aliases, the switch loads before any handler, the backup and the mirror read the real Vercel store', () => {
  const w = fs.readFileSync('cloudflare/wrangler.jsonc', 'utf8');
  assert.match(w, /"d1_databases": \[\{ "binding": "STORE_DB", "database_name": "aureum-data", "database_id": "c5aa93f8-763e-4ead-9c37-db4d4051b4cb" \}\]/);
  assert.match(w, /"@vercel\/blob": "\.\/src\/store-blob\.mjs"/); assert.match(w, /"vercel-blob-real": "\.\/node_modules\/@vercel\/blob"/);
  assert.doesNotMatch(w, /"vars"/); assert.doesNotMatch(w, /"STORE"\s*:/, 'the switch is a Worker secret, never in the file');
  const src = fs.readFileSync('cloudflare/src/worker.mjs', 'utf8');
  assert.ok(src.indexOf("import './store-blob.mjs'") > 0 && src.indexOf("import './store-blob.mjs'") < src.indexOf("from '../../api/"), 'the switch is imported before the handlers');
  assert.match(src, /storeMirror\(env, \{ cron: event\.cron \}\)/);
  assert.match(fs.readFileSync('cloudflare/src/backup.mjs', 'utf8'), /import\('vercel-blob-real'\)/);
  assert.match(fs.readFileSync('cloudflare/src/store-mirror.mjs', 'utf8'), /import\('vercel-blob-real'\)/);
  const sb = fs.readFileSync('cloudflare/src/store-blob.mjs', 'utf8');
  assert.match(sb, /from 'vercel-blob-real'/); assert.match(sb, /from 'cloudflare:workers'/); assert.match(sb, /installFetch\(globalThis\)/);
  assert.equal(TEN, '*/10 * * * *');
});

test('coverage: the api/ modules use only list, put and del of @vercel/blob, with options the D1 store takes, and store no blob URL', () => {
  const files = fs.readdirSync('api').filter((f) => /\.m?js$/.test(f)).filter((f) => fs.readFileSync(`api/${f}`, 'utf8').includes("require('@vercel/blob')"));
  // 15 until 17 Nov 2026; run.js, status.js (runner reports), tv-webhook.js and _alerts.js (price alerts) were removed
  assert.equal(files.length, 13, files.join(' '));   // 13 since 17 Nov 2026: api/passkey.js (Face ID sign-in), signup.js (sign-up requests, reset tokens)
  const used = new Set(), opts = new Set();
  for (const f of files) {
    const t = fs.readFileSync(`api/${f}`, 'utf8');
    for (const m of t.matchAll(/(?:B\(\)|blob\(\)|require\('@vercel\/blob'\))\.(\w+)\(/g)) used.add(m[1]);
    for (const m of t.matchAll(/(?:const|var|let) \{([^}]+)\} = require\('@vercel\/blob'\)/g)) m[1].split(',').forEach((x) => used.add(x.trim()));
    for (const m of t.matchAll(/(?:\{ (access: [^}]*)\}|list\(\{ ([^}]*)\})/g)) for (const part of (m[1] || m[2]).split(',')) opts.add(part.split(':')[0].trim());
    assert.doesNotMatch(t, /blob\.vercel-storage\.com/, `${f} names a Vercel host`);
  }
  assert.deepEqual([...used].sort(), ['del', 'list', 'put']);
  for (const k of opts) assert.ok(['access', 'addRandomSuffix', 'allowOverwrite', 'contentType', 'token', 'prefix', 'limit', 'cursor'].includes(k), `option ${k}`);
});
