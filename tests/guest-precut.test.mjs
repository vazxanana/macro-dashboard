// node --test tests/guest-precut.test.mjs — guest cuts made by the council loop (15 Nov 2026): scripts/guest-cut.mjs writes
// guest/<p> + guest/_index.json in a council-data dir; api/data.js serves that copy to a visitor while fresh, else cuts on the fly.
// Offline: the pinned council-data copies in tests/fixtures/council, a temp dir, fake GitHub answers, fake user store.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { makeCuts } from '../scripts/guest-cut.mjs';
const require = createRequire(import.meta.url);
const G = require('../api/_guestcut.js'), data = require('../api/data.js'), S = require('../api/_session.js'), login = require('../api/login.js');

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url));
const SRC = { 'trades.json': read('tests/fixtures/council/trades.json'), 'research.json': read('tests/fixtures/council/research.json'),
  'snapshot.json': Buffer.from(JSON.stringify({ at: '2026-11-15T10:00:00.000Z', lessons: { scalp: 'a note' },
    markets: { xau: { label: 'XAU/USD', name: 'Gold', price: 4001.5, dec: 1, open: true, trend: { '1d': 1 }, setups: [{ name: 'Position' }] } } })),
  'research/replay-2w.json': Buffer.from(JSON.stringify({ from: 'a', to: 'b', trades: [{ id: 'r1', k: 'gtrend', market: 'xau', side: 'buy', entry: 1, stop: 0.5, note: 'x' }] })),
  'ict/replay.json': Buffer.from(JSON.stringify({ from: '2025-08-01', totals: { n: 5, wins: 2, R: 1.5, losses: 3 }, trades: [{ id: 'q' }] })) };
const ENV = { CTRADER_LINK_KEY: 'link-key-fake-0123456789' }, sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const NOW = Date.parse('2026-11-15T12:00:00Z');
const deps = { builtIns: { luxus: { name: 'Luxus', hash: sha('lx-pw'), role: 'viewer' } }, blobUsers: async () => ({ users: {} }) };

function dirWith(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gcut-'));
  for (const [p, b] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true }); fs.writeFileSync(path.join(d, p), b); }
  return d;
}
function filesOf(d) {
  const o = {};
  const walk = (r) => { for (const n of fs.readdirSync(path.join(d, r))) { const q = r ? `${r}/${n}` : n;
    if (fs.statSync(path.join(d, q)).isDirectory()) walk(q); else o[q] = fs.readFileSync(path.join(d, q)); } };
  walk(''); return o;
}
function res() { const r = { code: 0, body: null, ended: false, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; }; r.send = (b) => { r.body = b; return r; };
  r.end = (b) => { r.ended = true; r.body = b === undefined ? null : b; return r; }; return r; }
const fetchOf = (files, log = []) => async (u) => {
  const m = String(u).match(/\/council-data\/([^?]+)\?/); const f = m && decodeURIComponent(m[1]); log.push(f);
  const b = files[f]; return b ? { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) } : { ok: false, status: 404 }; };
const ask = async (p, files, { cookie, m, now = NOW, log, env = ENV } = {}) => {
  const r = res(), headers = { host: 'x.test', ...(cookie ? { cookie } : {}) };
  await data.handle({ method: 'GET', headers, query: { p, ...(m ? { m } : {}) } }, r, { env, fetch: fetchOf(files, log), deps, now: () => now }); return r; };
const signIn = async () => { const r = res(); await login.handle({ method: 'POST', headers: { host: 'x.test' }, body: { password: 'lx-pw' } }, r, { env: ENV, deps }); return String(r.headers['set-cookie']).split(';')[0]; };

test('the script writes cuts byte-identical to G.cut with the same key, and an index of hashes', () => {
  for (const env of [ENV, { GUEST_ID_KEY: 'loop-key' }, {}]) {
    const d = dirWith(SRC), { index } = makeCuts(d, env, NOW), key = data.guestKey(env);
    assert.equal(index.at, new Date(NOW).toISOString());
    for (const p of G.CUT_FILES) {
      const out = fs.readFileSync(path.join(d, 'guest', p)), want = G.cut(p, SRC[p], key);
      assert.equal(Buffer.compare(out, want), 0, p);
      assert.deepEqual(index.files[p], { srcSha: sha(SRC[p]), sha: sha(want) });
    }
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(d, 'guest/_index.json'), 'utf8')), JSON.parse(JSON.stringify(index)));
  }
  assert.equal(data.guestKey({}), null); assert.equal(data.guestKey({ GUEST_ID_KEY: 'k' }), 'k');
  assert.deepEqual(data.guestKey(ENV), S.secret(ENV), 'no GUEST_ID_KEY: the session secret, as before');
});

test('the script writes only changed cuts and keeps the old cut of a file that is missing or does not parse', () => {
  const d = dirWith(SRC); makeCuts(d, ENV, NOW);
  const old = fs.readFileSync(path.join(d, 'guest/snapshot.json'));
  fs.writeFileSync(path.join(d, 'snapshot.json'), '{ broken');
  fs.rmSync(path.join(d, 'research.json'));
  const { index, written } = makeCuts(d, ENV, NOW + 60e3);
  assert.deepEqual(written, []);
  assert.ok(index.files['snapshot.json'].error); assert.equal(index.files['research.json'].error, 'missing');
  assert.ok(index.files['trades.json'].sha);
  assert.equal(Buffer.compare(fs.readFileSync(path.join(d, 'guest/snapshot.json')), old), 0, 'old cut left in place');
});

test('a visitor gets the precut copy while fresh, without reading the source; the fallback when stale, missing or mismatched', async () => {
  S._cache.users = null;
  const env = { ...ENV, GUEST_ID_KEY: 'loop-key' }, d = dirWith(SRC); makeCuts(d, env, NOW);
  const files = filesOf(d), real = (p) => G.cut(p, SRC[p], data.guestKey(env));
  // the real precut equals the on-the-fly cut with the same key, and the source is not read
  for (const p of G.CUT_FILES) {
    const log = [], r = await ask(p, files, { env, log });
    assert.equal(r.code, 200, p); assert.equal(Buffer.compare(r.body, real(p)), 0, p); assert.ok(!log.includes(p), `${p}: source not read`);
  }
  // a marked precut makes serving it visible
  const fake = Buffer.from('[{"precut":true}]'), ix = JSON.parse(files['guest/_index.json']);
  ix.files['trades.json'].sha = sha(fake);
  const F = { ...files, 'guest/trades.json': fake, 'guest/_index.json': Buffer.from(JSON.stringify(ix)) };
  const g = await ask('trades.json', F, { env });
  assert.equal(g.code, 200); assert.equal(Buffer.compare(g.body, fake), 0);
  assert.equal(g.headers.etag, data.etagOf(fake, 'c')); assert.equal(g.headers['cache-control'], 'public, max-age=0, s-maxage=20, stale-while-revalidate=60');
  assert.equal(g.headers.vary, 'Cookie'); assert.equal(g.headers['access-control-allow-origin'], '*');
  assert.equal((await ask('trades.json', F, { env, now: NOW + 29 * 60e3 })).body.toString(), fake.toString(), '29 min: still fresh');
  // GUEST_PRECUT_MAX_MIN (the Cloudflare Worker sets a day): the ready copy is served up to that age, capped at a week
  const day = { ...env, GUEST_PRECUT_MAX_MIN: '1440' };
  assert.equal((await ask('trades.json', F, { env: day, now: NOW + 23 * 3600e3 })).body.toString(), fake.toString(), 'a day: 23 h still served');
  assert.equal(Buffer.compare((await ask('trades.json', F, { env: day, now: NOW + 25 * 3600e3 })).body, real('trades.json')), 0, 'a day: 25 h cut on the fly');
  assert.equal(Buffer.compare((await ask('trades.json', F, { env: { ...env, GUEST_PRECUT_MAX_MIN: '999999' }, now: NOW + 8 * 86400e3 })).body, real('trades.json')), 0, 'capped at a week');
  assert.match(fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8'), /GUEST_PRECUT_MAX_MIN = "1440"/);
  // stale (31 min), missing index, missing copy, error entry, sha mismatch, broken index: cut on the fly
  const cases = { stale: [F, NOW + 31 * 60e3], noIndex: [{ ...F, 'guest/_index.json': undefined }, NOW], noCopy: [{ ...F, 'guest/trades.json': undefined }, NOW],
    error: [{ ...F, 'guest/_index.json': Buffer.from(JSON.stringify({ ...ix, files: { 'trades.json': { error: 'x' } } })) }, NOW],
    mismatch: [{ ...files, 'guest/trades.json': fake }, NOW], badIndex: [{ ...F, 'guest/_index.json': Buffer.from('{') }, NOW] };
  for (const [name, [f2, now]] of Object.entries(cases)) {
    const r = await ask('trades.json', f2, { env, now });
    assert.equal(r.code, 200, name); assert.equal(Buffer.compare(r.body, real('trades.json')), 0, name);
  }
});

test('a member never gets the precut copy; nobody reads guest/ paths directly', async () => {
  S._cache.users = null;
  const d = dirWith(SRC); makeCuts(d, ENV, NOW); const files = { ...filesOf(d), 'guest/trades.json': Buffer.from('[]') };
  const cookie = await signIn(), log = [];
  const m = await ask('trades.json', files, { cookie, m: '1', log });
  assert.equal(m.code, 200); assert.equal(Buffer.compare(m.body, SRC['trades.json']), 0); assert.equal(m.headers['cache-control'], 'private, no-store');
  assert.equal(m.headers.etag, data.etagOf(SRC['trades.json'], 'f'));
  assert.ok(!log.some((f) => f && f.startsWith('guest/')), 'a member read no guest/ file');
  for (const p of ['guest/trades.json', 'guest/_index.json', 'GUEST/snapshot.json', 'guest/ict/replay.json']) {
    assert.equal((await ask(p, files)).code, 404, p); assert.equal((await ask(p, files, { cookie, m: '1' })).code, 404, `${p} member`);
  }
});

test('the loop runs the script in each full round before its save (one commit), keyed, never failing it, not in the quick pass', () => {
  const y = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  const line = y.split('\n').find((l) => l.includes('node scripts/guest-cut.mjs'));
  assert.ok(line && /timeout 60/.test(line) && /\|\| echo/.test(line) && !/datasync/.test(line), line);
  const at = y.indexOf(line);
  assert.ok(at < y.indexOf('data save "Council run') && at < y.indexOf('Quick pass (8 Nov'));
  assert.ok(y.indexOf('data save "Council run') - at < 1200, 'right before the round save');
  assert.match(y, /GUEST_ID_KEY: \$\{\{ secrets\.GUEST_ID_KEY \}\}/);
});
