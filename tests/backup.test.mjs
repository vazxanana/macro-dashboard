// The owner's backup (12 Nov 2026): api/backup.js + scripts/backup-restore.mjs + the Profile card. Offline: a fake Blob source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as R from '../scripts/backup-restore.mjs';
const require = createRequire(import.meta.url);
const B = require('../api/backup.js');
const ROOT = new URL('..', import.meta.url).pathname;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255, 254]);
const FILES = [
  { pathname: 'users/1-abc.json', ct: 'application/json', buf: Buffer.from('[{"key":"fred","hash":"h"}]') },
  { pathname: 'mosha/shots/l1-0.png', ct: 'image/png', buf: PNG },
  { pathname: 'notices/list.json', ct: 'application/json', buf: Buffer.from('[{"id":"1","title":"t é"}]') },
  { pathname: 'academy/attempts.json', ct: 'application/json', buf: Buffer.from('x'.repeat(5000)) },
];
const source = (files = FILES, reads = []) => ({
  async list() { return files.map((f) => ({ pathname: f.pathname, url: 'https://blob.example/' + f.pathname, size: f.buf.length, uploadedAt: new Date(0) })).sort((a, b) => (a.pathname < b.pathname ? -1 : 1)); },
  async read(b) { reads.push(b.pathname); const f = files.find((x) => x.pathname === b.pathname); if (!f) throw new Error('gone'); return { ct: f.ct, buf: f.buf }; },
});
const res = () => { const r = { code: 0, h: {}, body: null, setHeader(k, v) { r.h[k] = v; }, status(c) { r.code = c; return r; }, json(o) { r.body = o; return r; } }; return r; };
const ENV = { BLOB_READ_WRITE_TOKEN: 'blob-secret-value', SESSION_SECRET: 'session-secret-value-xyz', OANDA_TOKEN: 'oanda-secret' };
const call = async (d = {}, body = {}, req = {}) => { const r = res(); await B.handle({ method: 'POST', headers: {}, body, ...req }, r, { env: ENV, source: source(), isOwner: async () => true, flags: async () => ({ runMode: 'council' }), ...d }); return r; };
async function whole(d = {}) { let from = 0, all = null; for (let guard = 0; guard < 50; guard++) { const r = await call(d, { from }); assert.equal(r.code, 200); all = all ? { ...all, files: all.files.concat(r.body.files) } : r.body; if (r.body.next == null) return all; from = r.body.next; } throw new Error('no end'); }

test('only the owner, only POST, only the same site', async () => {
  assert.equal((await call({ isOwner: async () => false })).code, 401);
  assert.equal((await call({ isOwner: async () => { throw new Error('x'); } })).code, 401);
  assert.equal((await call({}, {}, { method: 'GET' })).code, 405);
  assert.equal((await call({ sameOrigin: () => false })).code, 403);
  const r = await call(); assert.equal(r.code, 200); assert.equal(r.h['Cache-Control'], 'private, no-store');
  // the real owner check is the session module's (a member's or a forged cookie is not the owner)
  const src = fs.readFileSync(path.join(ROOT, 'api/backup.js'), 'utf8');
  assert.match(src, /S\.isOwnerSession\(r, env\)/);
});

test('every file once, in parts under the budget, text as text and pictures as base64', async () => {
  const all = await whole({ budget: 3000 });
  assert.deepEqual(all.files.map((f) => f.pathname), FILES.map((f) => f.pathname).sort());
  assert.equal(all.store.count, 4); assert.equal(all.files.length, all.store.count);
  for (const f of FILES) { const g = all.files.find((x) => x.pathname === f.pathname); assert.deepEqual(R.bytes(g), f.buf, f.pathname); assert.equal(g.size, f.buf.length); }
  assert.equal(all.files.find((x) => x.pathname.endsWith('.png')).enc, 'base64');
  assert.equal(all.files.find((x) => x.pathname === 'notices/list.json').enc, 'utf8');
  // a file bigger than the budget still travels (alone in its part), never dropped
  const big = await call({ budget: 10 }, { from: 0 }); assert.equal(big.body.files.length, 1); assert.equal(big.body.next, 1);
});

test('no secret value ever leaves: the environment only says set or not; flags only in the first part', async () => {
  const r = await call(), txt = JSON.stringify(r.body);
  for (const v of Object.values(ENV)) assert.ok(!txt.includes(v), 'a secret value leaked');
  assert.equal(r.body.env.BLOB_READ_WRITE_TOKEN, true); assert.equal(r.body.env.TELEGRAM_BOT_TOKEN, false);
  assert.deepEqual(r.body.flags, { runMode: 'council' });
  const p2 = await call({ budget: 10 }, { from: 1 }); assert.equal(p2.body.env, undefined); assert.equal(p2.body.flags, undefined);
  // every variable the code reads with a secret-looking name is listed (names only)
  for (const k of ['SESSION_SECRET', 'CRON_SECRET', 'OANDA_TOKEN', 'VAPID_PRIVATE_KEY', 'GH_TOKEN', 'TELEGRAM_BOT_TOKEN']) assert.ok(B.ENV_NAMES.includes(k), k);
});

test('a file that cannot be read fails the part with nothing saved (never a silent gap)', async () => {
  const s = source(); s.read = async () => { throw new Error('boom'); };
  const r = await call({ source: s }); assert.equal(r.code, 502); assert.ok(!r.body.files);
});

test('restore: files land at their paths, round trip byte for byte; paths that escape are refused; blob put gets the same', async () => {
  const all = await whole({ budget: 3000 }), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-')), file = path.join(dir, 'b.json');
  fs.writeFileSync(file, JSON.stringify(all));
  const j = R.read(file), c = R.check(j); assert.equal(c.complete, true); assert.deepEqual(c.sizeMismatch, []);
  const out = path.join(dir, 'out'); assert.equal(R.toDir(j, out), 4);
  for (const f of FILES) assert.deepEqual(fs.readFileSync(path.join(out, f.pathname)), f.buf);
  for (const p of ['../x', '/etc/passwd', 'a/../../b', 'a\\b', '']) assert.throws(() => R.safePath(p));
  const puts = []; assert.equal(await R.toBlob(j, 'tok', async (p, body, o) => { puts.push([p, Buffer.from(body), o]); }), 4);
  for (const [p, body, o] of puts) { assert.deepEqual(body, FILES.find((f) => f.pathname === p).buf); assert.equal(o.access, 'private'); assert.equal(o.addRandomSuffix, false); }
  await assert.rejects(() => R.toBlob(j, ''));
  // an incomplete backup says so
  assert.equal(R.check({ ...j, files: j.files.slice(1) }).complete, false);
});

test('page: the owner-only card asks every part and saves one file; the guide exists; vercel.json lists the function', () => {
  const html = fs.readFileSync(path.join(ROOT, 'market-structure.html'), 'utf8');
  assert.match(html, /id="ms-pf-bk"[^>]*hidden/);
  assert.match(html, /card\.hidden = window\.MS_WHO !== 'owner'/);
  assert.match(html, /fetch\('\/api\/backup', \{ method: 'POST', credentials: 'same-origin'/);
  assert.match(html, /j\.next == null \? all : next\(j\.next\)/);
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')); assert.ok(v.functions['api/backup.js']);
  const doc = fs.readFileSync(path.join(ROOT, 'docs/platform-backup.md'), 'utf8');
  assert.match(doc, /git clone --mirror/); assert.match(doc, /backup-restore\.mjs files/);
});
