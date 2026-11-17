// node --test tests/academy-preview.test.mjs — a preview deployment of the Academy is isolated: its own storage folder in the
// shared Blob store. Offline (a fake Blob client). The Vercel deploy gate (scripts/vercel-ignore.sh) went with the Vercel project, 17 Nov 2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ST = require('../api/_academy-store.js');
const ROOT = new URL('../', import.meta.url).pathname;

// one fake Blob store shared by every "deployment", as the real project shares one store
function fakeBlob() {
  const files = new Map();
  return { files, io: () => ({ recent: new Map(), tails: new Map(),
    blob: { async list({ prefix }) { return { blobs: [...files.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ pathname: k, url: 'blob://' + k, uploadedAt: new Date(0).toISOString() })) }; },
      async put(p, json) { files.set(p, json); return { pathname: p }; } },
    fetch: async (url) => { const k = String(url).replace('blob://', '').replace(/\?cache=0$/, ''); return files.has(k) ? { ok: true, json: async () => JSON.parse(files.get(k)) } : { ok: false, status: 404 }; } }) };
}

test('the storage folder follows the deployment: production and local runs use academy/, a preview uses academy-preview/', () => {
  assert.equal(ST.rootFor({ VERCEL_ENV: 'production' }), 'academy/'); assert.equal(ST.rootFor({}), 'academy/'); assert.equal(ST.rootFor(undefined), 'academy/');
  assert.equal(ST.rootFor({ VERCEL_ENV: 'preview' }), 'academy-preview/'); assert.equal(ST.rootFor({ VERCEL_ENV: 'development' }), 'academy-preview/');
  assert.notEqual(ST.ROOT, ST.PREVIEW_ROOT); assert.ok(!ST.PREVIEW_ROOT.startsWith(ST.ROOT) && !ST.ROOT.startsWith(ST.PREVIEW_ROOT), 'neither folder is inside the other (a prefix listing of one never returns the other)');
});

test('a preview and production share one Blob store and never see or overwrite each other\'s Academy files', async () => {
  const B = fakeBlob(), tok = { BLOB_READ_WRITE_TOKEN: 't' };
  const prod = ST.blobStore({ ...tok, VERCEL_ENV: 'production' }, B.io()), prev = ST.blobStore({ ...tok, VERCEL_ENV: 'preview' }, B.io());
  await prod.put('lessons.json', { v: 1, rows: [{ id: 'real' }] });
  assert.equal(await prev.get('lessons.json', null), null, 'the preview starts empty: it cannot read production lessons');
  await prev.put('lessons.json', { v: 1, rows: [{ id: 'trial' }] }); await prev.put('attempts/gmp.json', { v: 1, rows: [1, 2, 3] });
  assert.deepEqual((await prod.get('lessons.json')).rows, [{ id: 'real' }], 'production is untouched by the preview\'s writes');
  assert.equal(await prod.get('attempts/gmp.json', null), null);
  assert.deepEqual([...B.files.keys()].sort(), ['academy-preview/attempts/gmp.json', 'academy-preview/lessons.json', 'academy/lessons.json']);
  // every key a preview can ever write stays inside its folder
  for (const k of B.files.keys()) assert.ok(k.startsWith('academy/') || k.startsWith('academy-preview/'));
  await assert.rejects(() => prev.put('../academy/lessons.json', {}), /bad store key/);
});

test('the Academy handler picks the folder from the environment it runs in (no flag a request could set)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'api/academy.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'api/_academy-store.js'), 'utf8');
  assert.match(src, /ST\.blobStore\(env\)/); assert.match(src, /ROOT = rootFor\(env\)/);
  assert.ok(!/rootFor\((req|q|b)\b/.test(src), 'the folder never comes from a request');
});
