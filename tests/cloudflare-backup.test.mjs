// The Vercel Blob store's copy in Cloudflare KV (cloudflare/src/backup.mjs). Offline: fake Blob list, fake fetch, fake KV.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { blobBackup, PER_RUN, EVERY_MS } from '../cloudflare/src/backup.mjs';

function fakeKV() {
  const m = new Map();
  return { m, async get(k, t) { const v = m.get(k); if (v == null) return null; return t === 'json' ? JSON.parse(v.value) : v.value; },
    async put(k, value, o = {}) { m.set(k, { value, metadata: o.metadata }); } };
}
function store(files) {
  const blobs = Object.entries(files).map(([p, f]) => ({ pathname: p, url: `https://x.blob/${p}`, size: f.body.length, uploadedAt: f.at }));
  const calls = [];
  const list = async ({ token, cursor }) => { assert.equal(token, 'tok'); const i = cursor ? +cursor : 0; const page = blobs.slice(i, i + 2); return { blobs: page, hasMore: i + 2 < blobs.length, cursor: String(i + 2) }; };
  const fetch = async (u, o) => { calls.push(u); assert.equal(o.headers.Authorization, 'Bearer tok'); assert.match(u, /cache=0/);
    const p = new URL(u).pathname.slice(1); const f = files[p]; if (!f || f.fail) return new Response('no', { status: 500 });
    return new Response(f.body, { headers: { 'content-type': 'application/json' } }); };
  return { list, fetch, calls };
}

test('copies every file, pages through the listing, and skips unchanged files on the next round', async () => {
  const files = { 'users/a.json': { body: '[1]', at: '1' }, 'profiles/owner.json': { body: '{"n":1}', at: '2' }, 'mosha/lessons.json': { body: '[]', at: '3' } };
  const s = store(files), kv = fakeKV(), env = { BACKUP: kv, BLOB_READ_WRITE_TOKEN: 'tok' };
  const r = await blobBackup(env, { list: s.list, fetch: s.fetch, now: 1e12 });
  assert.deepEqual([r.done, r.blobs, r.copied, r.failed], [true, 3, 3, 0]);
  assert.equal(new TextDecoder().decode(kv.m.get('blob:users/a.json').value), '[1]');
  assert.equal(kv.m.get('blob:users/a.json').metadata.uploadedAt, '1');
  // within a day: nothing is read again
  assert.equal((await blobBackup(env, { list: s.list, fetch: s.fetch, now: 1e12 + 3600e3 })).skip, 'fresh');
  // a day later: only the changed file is copied, and a deleted file keeps its copy, marked gone
  files['users/a.json'] = { body: '[2]', at: '9' }; delete files['mosha/lessons.json'];
  const s2 = store(files), r2 = await blobBackup(env, { list: s2.list, fetch: s2.fetch, now: 1e12 + EVERY_MS + 1 });
  assert.equal(r2.copied, 1); assert.equal(s2.calls.length, 1);
  assert.equal(new TextDecoder().decode(kv.m.get('blob:users/a.json').value), '[2]');
  assert.ok(kv.m.get('blob:mosha/lessons.json'), 'a file deleted at Vercel stays copied');
  assert.ok(JSON.parse(kv.m.get('meta').value).files['mosha/lessons.json'].gone);
});

test('a failed read is retried on the next run; nothing runs without the binding or the token', async () => {
  const files = { 'a.json': { body: '1', at: '1', fail: true } };
  const s = store(files), kv = fakeKV(), env = { BACKUP: kv, BLOB_READ_WRITE_TOKEN: 'tok' };
  const r = await blobBackup(env, { list: s.list, fetch: s.fetch, now: 1 });
  assert.deepEqual([r.done, r.failed], [false, 1]);
  files['a.json'].fail = false;
  assert.equal((await blobBackup(env, { list: s.list, fetch: s.fetch, now: 2 })).copied, 1);
  assert.equal((await blobBackup({ BLOB_READ_WRITE_TOKEN: 'tok' })).skip, 'no BACKUP binding');
  assert.equal((await blobBackup({ BACKUP: kv })).skip, 'no BLOB_READ_WRITE_TOKEN');
  assert.ok(PER_RUN <= 400, 'a run stays inside the Workers request limit');
});

test('the Worker binds the copy, runs it from the 10-minute cron, and the backup code only reads the Blob store', () => {
  const w = fs.readFileSync(new URL('../cloudflare/wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(w, /"binding": "BACKUP"/);
  const src = fs.readFileSync(new URL('../cloudflare/src/worker.mjs', import.meta.url), 'utf8');
  assert.match(src, /'\*\/10 \* \* \* \*'\) console\.log\('blob backup'/);
  const b = fs.readFileSync(new URL('../cloudflare/src/backup.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(b, /\bdel\(|\bput\(\s*[^'"]*b\.url|method:\s*'(POST|PUT|DELETE)'/);
});
