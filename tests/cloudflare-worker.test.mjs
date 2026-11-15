// The site on Cloudflare (cf/worker.mjs, cf/blob-r2.mjs, wrangler.toml), offline: routes match vercel.json, every Vercel
// function is either run or named as not run, the request / response adapter, the R2 stand-in for @vercel/blob, and the
// Academy's outcome files never in the public assets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// the Worker bundles the two bridge sources as text (wrangler.toml rules); Node needs the same rule to import it
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent("export async function load(url, ctx, next) { if (/\\.(mq5|cs)$/.test(url)) { const fs = await import('node:fs'); return { format: 'module', shortCircuit: true, source: 'export default ' + JSON.stringify(fs.readFileSync(new URL(url), 'utf8')) }; } return next(url, ctx); }"));
const W = await import('../cf/worker.mjs');
const B = await import('../cf/blob-r2.mjs');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const toml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');

test('every vercel.json API rewrite routes to the same function', () => {
  assert.deepEqual(W.route('/api/mcp/fred.abc'), { fn: 'mcp', q: { key: 'fred.abc' } });
  assert.deepEqual(W.route('/api/academy-mcp/k1'), { fn: 'academy-mcp', q: { key: 'k1' } });
  assert.deepEqual(W.route('/cdata/ict/replay.json'), { fn: 'data', q: { p: 'ict/replay.json' } });
  assert.equal(W.route('/md/bars').fn, 'bars');
  assert.equal(W.route('/md/stream').fn, 'stream');
  assert.equal(W.route('/api/login').fn, 'login');
  assert.equal(W.route('/assets/x.js'), null);
  for (const r of vercel.rewrites) if (/^\/(api|cdata|md)\//.test(r.source)) assert.ok(W.route(r.source.replace(/:\w+\*?/g, 'x')), r.source);
});
test('every Vercel function is run on Cloudflare or named as not run', () => {
  const fns = fs.readdirSync(path.join(ROOT, 'api')).filter((f) => !f.startsWith('_') && /\.m?js$/.test(f)).map((f) => f.replace(/\.m?js$/, ''));
  const src = fs.readFileSync(path.join(ROOT, 'cf/worker.mjs'), 'utf8');
  for (const f of fns) assert.ok(W.API[f] || f === 'run' || f === 'og', `api/${f} is neither run nor named`);
  assert.match(src, /NOT_HERE = \{ run:/);
  assert.match(src, /\/api\/og/);
});
test('crons: the price alerts and the second opinion, as in vercel.json; no council run', () => {
  const paths = vercel.crons.map((c) => c.path);
  assert.ok(paths.includes('/api/alert-cron') && paths.some((p) => p.startsWith('/api/edge-analyst')));
  assert.deepEqual(W.CRONS['* * * * *'][0], 'alert-cron');
  assert.deepEqual(W.CRONS['*/10 * * * *'], ['edge-analyst', { job: 'scan' }]);
  for (const c of Object.keys(W.CRONS)) assert.ok(toml.includes(`"${c}"`), c);
});
test('wrangler.toml: the assets, the R2 bucket, the alias and the Worker-first paths', () => {
  assert.match(toml, /directory = "out"/);
  assert.match(toml, /bucket_name = "meridianx-blob"/);
  assert.match(toml, /"@vercel\/blob" = "\.\/cf\/blob-r2\.mjs"/);
  for (const p of ['/api/*', '/cdata/*', '/md/*', '/gold', '/macro-desk', '/backtest', '/academy']) assert.ok(toml.includes(`"${p}"`), p);
  assert.match(toml, /compatibility_flags = \["nodejs_compat"\]/);
});
test('request adapter: headers, query, JSON body, the client IP only from Cloudflare', async () => {
  const req = await W.nodeReq(new Request('https://x.dev/api/login?a=1', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '6.6.6.6', 'cf-connecting-ip': '1.2.3.4' }, body: '{"password":"p"}' }), { b: '2' });
  assert.deepEqual(req.query, { a: '1', b: '2' });
  assert.deepEqual(req.body, { password: 'p' });
  assert.equal(req.headers['x-real-ip'], '1.2.3.4');
  const spoof = await W.nodeReq(new Request('https://x.dev/api/me', { headers: { 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '6.6.6.6' } }));
  assert.equal(spoof.headers['x-real-ip'], undefined);
  assert.equal(spoof.headers['x-forwarded-for'], undefined);
  const bad = await W.nodeReq(new Request('https://x.dev/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' }));
  assert.equal(bad.body, '{bad');
});
test('response adapter: status, json, send, 304 / HEAD without a body, redirect, streaming', async () => {
  let r = new W.NodeRes(); r.status(201).json({ a: 1 }); let x = await r.p;
  assert.equal(x.status, 201); assert.deepEqual(await x.json(), { a: 1 });
  r = new W.NodeRes(); r.setHeader('ETag', '"c-1"'); r.status(304).end(); x = await r.p; assert.equal(x.status, 304); assert.equal(x.body, null); assert.equal(x.headers.get('etag'), '"c-1"');
  r = new W.NodeRes(true); r.status(200).send('hello'); x = await r.p; assert.equal(x.body, null);
  r = new W.NodeRes(); r.redirect('/x'); x = await r.p; assert.equal(x.status, 302); assert.equal(x.headers.get('location'), '/x');
  r = new W.NodeRes(); r.send(Buffer.from('ab')); x = await r.p; assert.equal(await x.text(), 'ab');
  r = new W.NodeRes(); r.writeHead(200, { 'Content-Type': 'text/event-stream' }); r.write('a\n'); r.write('b\n'); r.end();
  x = await r.p; assert.equal(x.headers.get('content-type'), 'text/event-stream'); assert.equal(await x.text(), 'a\nb\n');
});
test('a handler that throws answers 500 without its message', async () => {
  W.API.__t = () => { throw new Error('secret detail'); };
  const x = await W.runFn('__t', new Request('https://x.dev/api/__t'), {}, null); delete W.API.__t;
  assert.equal(x.status, 500); assert.doesNotMatch(await x.text(), /secret detail/);
  assert.equal((await W.runFn('run', new Request('https://x.dev/api/run'), {}, null)).status, 503);
});
// a fake R2 bucket with the calls cf/blob-r2.mjs uses
function fakeR2() {
  const m = new Map(); let n = 0;
  const obj = (key) => { const v = m.get(key); return v && { key, size: v.data.length, uploaded: v.at, httpEtag: `"e${v.e}"`, httpMetadata: v.meta, body: v.data, text: async () => v.data }; };
  return {
    m,
    async put(key, data, o = {}) { m.set(key, { data: typeof data === 'string' ? data : Buffer.from(data).toString(), at: new Date(), e: ++n, meta: o.httpMetadata || {} }); return obj(key); },
    async head(key) { return obj(key) || null; },
    async get(key) { return obj(key) || null; },
    async delete(keys) { for (const k of [].concat(keys)) m.delete(k); },
    async list({ prefix = '' } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map(obj), truncated: false }; },
  };
}
test('blob stand-in: put / list / fetch / del keep the Vercel pathname, random suffix like Vercel', async () => {
  const b = fakeR2(); B.useBucket(b);
  const a = await B.put('notices/list.json', '[1]', { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  assert.equal(a.pathname, 'notices/list.json'); assert.ok(a.url.startsWith(B.BASE)); assert.ok(a.etag);
  const s = await B.put('users/1.json', '{}', { addRandomSuffix: true });
  assert.match(s.pathname, /^users\/1-[a-z0-9]{21}\.json$/);
  await assert.rejects(B.put('notices/list.json', 'x', { allowOverwrite: false }));
  const l = await B.list({ prefix: 'notices/' });
  assert.equal(l.blobs.length, 1); assert.ok(l.blobs[0].uploadedAt instanceof Date); assert.equal(l.hasMore, false);
  const r = await fetch(l.blobs[0].url + '?cache=0', { headers: { Authorization: 'Bearer x' } });   // the Worker's fetch wrapper (imported above)
  assert.equal(r.status, 200); assert.equal(await r.text(), '[1]');
  assert.equal((await fetch(B.BASE + 'missing.json')).status, 404);
  await B.del([l.blobs[0].url, s.url]); assert.equal(b.m.size, 0);
});
test('the Academy outcomes are not in the public site; the Worker reads them from the private bucket', async () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [e.name]);
  assert.ok(!walk(path.join(ROOT, 'out')).some((f) => /^(out|cand|feat)-[a-z-]+\.json$/.test(f)), 'an Academy data file is in out/');
  const { academyData, PREFIX } = await import('../cf/academy-data.mjs');
  const b = fakeR2(); await b.put(PREFIX + 'out-geg.json', '{"outcomes":[]}');
  const d = academyData(b);
  assert.deepEqual(await d.outcomes('geg'), { outcomes: [] });
  assert.equal(await d.candidates('geg'), null);
  assert.ok(Array.isArray(await d.edges()));
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/cloudflare.yml'), 'utf8');
  assert.match(wf, /academy-data\/\$\(basename/);
});
test('edge cache: public candles and a visitor\'s guest files only, kept for their s-maxage, 304 on a matching ETag', async () => {
  const route = (p) => W.route(p), R = (u, h = {}) => new Request(u, { headers: h });
  assert.equal(W.cacheable(route('/md/bars'), R('https://x.dev/md/bars?sym=xau'), new URL('https://x.dev/md/bars?sym=xau')), true);
  assert.equal(W.cacheable(route('/cdata/trades.json'), R('https://x.dev/cdata/trades.json'), new URL('https://x.dev/cdata/trades.json')), true);
  assert.equal(W.cacheable(route('/cdata/trades.json'), R('https://x.dev/cdata/trades.json', { cookie: 'ms_session=a' }), new URL('https://x.dev/cdata/trades.json')), false, 'a cookie');
  assert.equal(W.cacheable(route('/cdata/trades.json'), R('https://x.dev/cdata/trades.json?m=1'), new URL('https://x.dev/cdata/trades.json?m=1')), false, 'the member mark');
  assert.equal(W.cacheable(route('/api/me'), R('https://x.dev/api/me'), new URL('https://x.dev/api/me')), false);
  const store = new Map(), cache = { async match(k) { const v = store.get(k.url); return v ? v.clone() : undefined; }, async put(k, v) { store.set(k.url, v); } };
  let runs = 0; const u = new URL('https://x.dev/md/bars?sym=xau&n=5');
  const run = async () => { runs++; return new Response('{"bars":[]}', { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=20', ETag: '"e1"' } }); };
  const a = await W.edgeCached(R(u), u, run, null, cache); assert.equal(a.headers.get('cache-control'), 'public, max-age=0, s-maxage=20');
  await new Promise((r) => setTimeout(r, 5));
  const b = await W.edgeCached(R(u), u, run, null, cache);
  assert.equal(runs, 1, 'a hit runs no code'); assert.equal(await b.text(), '{"bars":[]}');
  assert.equal(b.headers.get('cache-control'), 'public, max-age=0, s-maxage=20'); assert.equal(b.headers.get('x-mx-cc'), null);
  assert.equal((await W.edgeCached(R(u, { 'if-none-match': '"e1"' }), u, run, null, cache)).status, 304);
  const priv = new URL('https://x.dev/md/bars?p=1'); await W.edgeCached(R(priv), priv, async () => new Response('x', { headers: { 'Cache-Control': 'private, no-store' } }), null, cache);
  assert.ok(!store.has(priv.toString()), 'a private answer is never stored');
});
test('Fred\'s connector on a host without processes: the syntax check says so instead of refusing every change', async () => {
  const { createRequire } = await import('node:module'); const req = createRequire(import.meta.url);
  const { syntaxCheck } = req('../api/mcp.js').lib;
  assert.equal(syntaxCheck('ict/x.mjs', 'export const a = 1;\n'), 'node --check ok');
  assert.throws(() => syntaxCheck('ict/x.mjs', 'export const = ;\n'), /syntax error in ict\/x\.mjs/, 'a real error is still refused');
  process.env.MCP_NO_EXEC = '1';
  try { assert.match(syntaxCheck('ict/x.mjs', 'export const = ;\n'), /not checked on this host/); assert.throws(() => syntaxCheck('a.json', '{'), /not valid JSON/, 'JSON is still parsed'); }
  finally { delete process.env.MCP_NO_EXEC; }
  assert.match(toml, /MCP_NO_EXEC = "1"/);
});
test('the bridge sources the owner downloads are bundled in the Worker, byte for byte', async () => {
  const { createRequire } = await import('node:module'); const req = createRequire(import.meta.url);
  const bridge = req('../api/bridge.js');
  assert.match(toml, /globs = \["\*\*\/\*\.mq5", "\*\*\/\*\.cs"\]/);
  let txt;
  // the Worker set the reader at import: read each file through the handler's own path
  for (const [k, f] of Object.entries(bridge.FILES)) {
    const S = req('../api/_session.js'), A = req('../api/_accounts.js'), env = { SESSION_SECRET: 'test-secret-0123456789abcdef' };
    const old = process.env.SESSION_SECRET; process.env.SESSION_SECRET = env.SESSION_SECRET;
    try {
      const tok = S.issue(env, 'owner', A.OWNER_HASH, { u: 'owner', name: 'Owner', role: 'owner' });
      const x = await W.runFn('bridge', new Request('https://x.dev/api/bridge', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://x.dev', host: 'x.dev', cookie: `${S.COOKIE}=${tok}` }, body: JSON.stringify({ file: k }) }), {}, null);
      txt = await x.text(); assert.equal(x.status, 200, k);
      assert.equal(txt, fs.readFileSync(path.join(ROOT, f), 'utf8'), f);
    } finally { if (old === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old; }
  }
});
