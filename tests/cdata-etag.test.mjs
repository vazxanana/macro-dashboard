// node --test tests/cdata-etag.test.mjs — /cdata conditional answers (12 Nov 2026): a strong ETag from the exact bytes sent,
// tagged with the variant (guest cut / whole file), 304 with no body when If-None-Match matches, every other header as on the 200.
// Offline: the pinned council-data copies in tests/fixtures/council, fake GitHub answers, fake user store.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const G = require('../api/_guestcut.js'), data = require('../api/data.js'), S = require('../api/_session.js'), login = require('../api/login.js');

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url));
const CSV = Buffer.from('id,market,side,entry,stop\nx1,xau,buy,4000,3990\n');
const NOTE = Buffer.from('# report\n');
const FILES = { 'trades.json': read('tests/fixtures/council/trades.json'), 'research.json': read('tests/fixtures/council/research.json'),
  'snapshot.json': Buffer.from(JSON.stringify({ at: '2026-11-11T18:00:00.000Z', lessons: { scalp: 'a note' },
    markets: { xau: { label: 'XAU/USD', name: 'Gold', price: 3988.455, dec: 1, open: true, trend: { '1d': -1, '4h': 1 }, setups: [{ name: 'Position' }] } } })), 'mt5/signals.csv': CSV, 'analysis/latest.md': NOTE };
const CUTS = G.CUT_FILES.filter((f) => FILES[f]);
const ENV = { CTRADER_LINK_KEY: 'link-key-fake-0123456789' }, sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const deps = { builtIns: { luxus: { name: 'Luxus', hash: sha('lx-pw'), role: 'viewer' } }, blobUsers: async () => ({ users: {} }) };
function res() { const r = { code: 0, body: null, ended: false, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; }; r.send = (b) => { r.body = b; return r; };
  r.end = (b) => { r.ended = true; r.body = b === undefined ? null : b; return r; }; return r; }
const fileOf = (u) => Object.keys(FILES).find((f) => String(u).includes(`/council-data/${f}?`));
const fetchOf = (files) => async (u) => { const b = files[fileOf(u)]; return b ? { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) } : { ok: false, status: 404 }; };
const ask = async (p, { cookie, m, inm, method = 'GET', files = FILES } = {}) => {
  const r = res(), headers = { host: 'x.test', ...(cookie ? { cookie } : {}), ...(inm ? { 'if-none-match': inm } : {}) };
  await data.handle({ method, headers, query: { p, ...(m ? { m } : {}) } }, r, { env: ENV, fetch: fetchOf(files), deps }); return r; };
const signIn = async () => { const r = res(); await login.handle({ method: 'POST', headers: { host: 'x.test' }, body: { password: 'lx-pw' } }, r, { env: ENV, deps }); return String(r.headers['set-cookie']).split(';')[0]; };
const PUBLIC = 'public, max-age=0, s-maxage=20, stale-while-revalidate=60';

test('the ETag is strong, from the exact bytes sent, and names the variant', async () => {
  assert.ok(CUTS.length >= 3);
  for (const p of CUTS) {
    const g = await ask(p);
    assert.equal(g.code, 200); assert.equal(g.headers.etag, data.etagOf(g.body, 'c'), p); assert.match(g.headers.etag, /^"c-[A-Za-z0-9_-]{32}"$/);
  }
  const c = await ask('mt5/signals.csv'); assert.equal(c.headers.etag, data.etagOf(CSV, 'f'));
  const first = await ask('trades.json'), again = await ask('trades.json'); assert.equal(again.headers.etag, first.headers.etag, 'stable for the same bytes');
  const changed = await ask('trades.json', { files: { ...FILES, 'trades.json': Buffer.from('[]') } }); assert.notEqual(changed.headers.etag, first.headers.etag);
});

test('a visitor: 304 with no body on a match, 200 with the cut on a mismatch; the 304 carries the 200 headers', async () => {
  S._cache.users = null;
  for (const p of CUTS) {
    const g = await ask(p), n = await ask(p, { inm: g.headers.etag });
    assert.equal(n.code, 304, p); assert.equal(n.body, null); assert.ok(n.ended);
    assert.deepEqual(n.headers, g.headers, `${p}: same headers`);
    assert.equal(n.headers['cache-control'], PUBLIC); assert.equal(n.headers.vary, 'Cookie'); assert.equal(n.headers['access-control-allow-origin'], '*');
    for (const inm of [`W/${g.headers.etag}`, `"x", ${g.headers.etag}`, '*']) assert.equal((await ask(p, { inm })).code, 304, `${p} ${inm}`);
    const o = await ask(p, { inm: '"c-old"' });
    assert.equal(o.code, 200); assert.ok(Buffer.compare(o.body, G.cut(p, FILES[p], S.secret(ENV))) === 0, `${p}: the cut, unchanged`);
  }
});

test('member and visitor never share an ETag; neither gets a 304 for the other one', async () => {
  S._cache.users = null; const cookie = await signIn();
  for (const p of CUTS) {
    const g = await ask(p), m = await ask(p, { cookie, m: '1' });
    assert.ok(Buffer.compare(m.body, FILES[p]) === 0, `${p}: whole file`); assert.equal(m.headers.etag, data.etagOf(FILES[p], 'f'));
    assert.notEqual(m.headers.etag, g.headers.etag, p);
    const mg = await ask(p, { cookie, m: '1', inm: g.headers.etag });
    assert.equal(mg.code, 200, `${p}: a member with the visitor ETag gets the whole file`); assert.ok(Buffer.compare(mg.body, FILES[p]) === 0);
    assert.equal(mg.headers['cache-control'], 'private, no-store');
    const gm = await ask(p, { inm: m.headers.etag });
    assert.equal(gm.code, 200, `${p}: a visitor with the member ETag gets the cut`); assert.ok(gm.body.length < FILES[p].length);
    // the member mark without a session: the cut, private, never a 304 on the whole file's ETag
    const fake = await ask(p, { m: '1', inm: m.headers.etag });
    assert.equal(fake.code, 200); assert.equal(fake.headers['cache-control'], 'private, no-store'); assert.equal(fake.headers.etag, g.headers.etag);
    // the member's own ETag: 304, still private, no-store, no CORS
    const mm = await ask(p, { cookie, m: '1', inm: m.headers.etag });
    assert.equal(mm.code, 304); assert.equal(mm.body, null); assert.equal(mm.headers['cache-control'], 'private, no-store'); assert.equal(mm.headers['access-control-allow-origin'], undefined);
  }
  // a protected file: whole to a member, 304 on its ETag, 401 without a session whatever the ETag
  const n = await ask('analysis/latest.md', { cookie }); assert.equal(n.code, 200); assert.equal(n.headers.etag, data.etagOf(NOTE, 'f'));
  assert.equal((await ask('analysis/latest.md', { cookie, inm: n.headers.etag })).code, 304);
  const anon = await ask('analysis/latest.md', { inm: n.headers.etag }); assert.equal(anon.code, 401); assert.equal(anon.headers.etag, undefined);
});

test('HEAD gets the same headers (and the same 304)', async () => {
  const g = await ask('trades.json'), h = await ask('trades.json', { method: 'HEAD' });
  assert.equal(h.code, 200); assert.deepEqual(h.headers, g.headers);
  assert.equal((await ask('trades.json', { method: 'HEAD', inm: g.headers.etag })).code, 304);
});

test('mt5/signals.csv: no If-None-Match gets the whole file as before; errors carry no ETag', async () => {
  const c = await ask('mt5/signals.csv');
  assert.equal(c.code, 200); assert.ok(Buffer.compare(c.body, CSV) === 0); assert.equal(c.headers['content-type'], 'text/csv; charset=utf-8');
  assert.equal(c.headers['cache-control'], PUBLIC); assert.equal(c.headers['access-control-allow-origin'], '*');
  assert.equal((await ask('mt5/signals.csv', { inm: c.headers.etag })).code, 304);
  const miss = await ask('mt5/signals.csv', { files: {} }); assert.equal(miss.code, 404); assert.equal(miss.headers.etag, undefined);
});
