// api/lse.js: London Strategic Edge data for the owner only (19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../api/lse.js');

function call(query, { who = { u: 'owner' }, env = { LSE_API_KEY: 'k-secret' }, method = 'GET', fetchFn } = {}) {
  const seen = [];
  const F = fetchFn || (async (url, o) => { seen.push({ url, o }); return { ok: true, status: 200, json: async () => ({ key: 'my key name', plan: 'free', rows: [1] }) }; });
  const res = { code: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  return L.handle({ method, query }, res, { env, who: async () => who, fetch: F, now: Date.now() }).then(() => ({ res, seen }));
}

test('owner only, GET only, never cached', async () => {
  L._hits.length = 0;
  assert.equal((await call({ op: 'usage' }, { who: null })).res.code, 401);
  assert.equal((await call({ op: 'usage' }, { who: { u: 'fred' } })).res.code, 403);
  assert.equal((await call({ op: 'usage' }, { method: 'POST' })).res.code, 405);
  assert.equal((await call({ op: 'usage' }, { env: {} })).res.code, 503);
  const { res, seen } = await call({ op: 'usage' });
  assert.equal(res.code, 200); assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(res.body.data.key, undefined); assert.equal(res.body.data.plan, 'free');
  assert.equal(seen[0].o.headers['X-API-Key'], 'k-secret'); assert.equal(seen[0].o.redirect, 'error');
  assert.ok(!JSON.stringify(res.body).includes('k-secret'));
});

test('only allowlisted operations and parameters reach the provider', async () => {
  L._hits.length = 0;
  assert.equal(L.target({ op: 'ref', dataset: 'economic_calendar', from: '2025-04-01', evil: 'x' }).url,
    'https://download.londonstrategicedge.com/v3/reference/preview?dataset=economic_calendar&from=2025-04-01');
  assert.match(L.target({ op: 'export' }).error, /op must be/);
  assert.match(L.target({ op: 'ref' }).error, /dataset is required/);
  assert.match(L.target({ op: 'ref', dataset: '../x' }).error, /bad dataset/);
  assert.match(L.target({ op: 'series', kind: 'observation', code: 'a b' }).error, /bad code/);
  assert.match(L.target({ op: 'macro', kind: 'all' }).error, /bad kind/);
  for (const op of Object.values(L.OPS)) assert.ok(!/export|file|jobs|slice/.test(op.path), op.path);   // previews and lists, never a download
  const r = await call({ op: 'macro', kind: 'yield', country: 'GB', limit: '20' });
  assert.equal(r.seen[0].url, 'https://download.londonstrategicedge.com/v3/macro?kind=yield&country=GB&limit=20');
});

test('provider errors and the rate limit', async () => {
  L._hits.length = 0;
  const bad = await call({ op: 'usage' }, { fetchFn: async () => ({ ok: false, status: 401, json: async () => ({ code: 'key-missing' }) }) });
  assert.equal(bad.res.code, 502); assert.match(bad.res.body.error, /401/); assert.equal(bad.res.body.detail, 'key-missing');
  const down = await call({ op: 'usage' }, { fetchFn: async () => { throw new Error('x'); } });
  assert.equal(down.res.code, 502);
  L._hits.length = 0; for (let i = 0; i < 30; i++) L._hits.push(Date.now());
  assert.equal((await call({ op: 'usage' })).res.code, 429);
  L._hits.length = 0;
});

test('wired on the Worker, nothing on a page, the key never in a file', () => {
  const w = fs.readFileSync(new URL('../cloudflare/src/worker.mjs', import.meta.url), 'utf8');
  assert.ok(w.includes("import lse from '../../api/lse.js'") && /\blse,/.test(w));
  for (const p of ['market-structure.html', 'macro-desk.html', 'backtest.html', 'cloudflare/wrangler.jsonc'])
    assert.ok(!fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').includes('londonstrategicedge'), p);
});
