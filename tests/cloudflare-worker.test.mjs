// The site on Cloudflare Workers (cloudflare/): routing from vercel.json and the Node-style adapter.
// Offline: the adapter and the router are pure; the worker file is read as text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rewrite, headersFor, match } from '../cloudflare/src/routes.mjs';
import { run, queryOf, headersOf } from '../cloudflare/src/adapter.mjs';

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const U = (p) => new URL('https://aureumdesk.co.uk' + p);
const rw = (p) => { const u = rewrite(vercel.rewrites, U(p)); return u.pathname + u.search; };

test('cloudflare: rewrites are vercel.json\'s', () => {
  assert.equal(rw('/api/mcp/fred.abc'), '/api/mcp?key=fred.abc');
  assert.equal(rw('/api/academy-mcp/k1'), '/api/academy-mcp?key=k1');
  assert.equal(rw('/cdata/ict/replay.json'), '/api/data?p=ict%2Freplay.json');
  assert.equal(rw('/cdata/trades.json?v=12'), '/api/data?v=12&p=trades.json');
  assert.equal(rw('/md/bars?sym=xau&tf=1h'), '/api/bars?sym=xau&tf=1h');
  assert.equal(rw('/md/stream?sym=xau'), '/api/stream?sym=xau');
  assert.equal(rw('/macro-dashboard/assets/x.js?v=1'), '/assets/x.js?v=1');
  assert.equal(rw('/gold'), '/gold-trading.html');
  assert.equal(rw('/backtest'), '/backtest.html');
  assert.equal(rw('/academy'), '/academy.html');
  assert.equal(rw('/macro-desk'), '/macro-desk.html');
  assert.equal(rw('/market-structure.html'), '/market-structure.html');
  assert.equal(rw('/gold/x'), '/gold/x');
});

test('cloudflare: headers follow vercel.json, later rules winning', () => {
  const h = (p) => headersFor(vercel.headers, U(p));
  assert.equal(h('/assets/a.js?v=abc')['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.equal(h('/assets/a.js')['Cache-Control'], 'public, max-age=0, must-revalidate');
  assert.equal(h('/')['Cache-Control'], 'no-cache');
  assert.equal(h('/macro-desk.html')['Cache-Control'], 'no-cache');
  assert.equal(h('/sw.js')['Cache-Control'], 'no-cache');
  assert.equal(h('/app.webmanifest')['Content-Type'], 'application/manifest+json');
  assert.equal(h('/icon-192.png')['Cache-Control'], 'public, max-age=604800');
  for (const p of ['/', '/assets/a.js', '/api/me']) {
    assert.equal(h(p)['X-Frame-Options'], 'SAMEORIGIN');
    assert.match(h(p)['Strict-Transport-Security'], /max-age=63072000/);
  }
  assert.equal(h('/robots.txt')['Cache-Control'], undefined);
  assert.equal(match('/(.*)\\.html', '/a.html').constructor, Object);
  assert.equal(match('/(.*)\\.html', '/ahtml'), null);
});

test('cloudflare: every function of api/ is routed', () => {
  const src = fs.readFileSync('cloudflare/src/worker.mjs', 'utf8');
  const names = fs.readdirSync('api').filter((f) => !f.startsWith('_') && /\.m?js$/.test(f)).map((f) => f.replace(/\.m?js$/, ''));
  for (const n of names) {
    const routed = src.includes(`from '../../api/${n}.js'`);
    assert.ok(routed, `api/${n} is not routed in the worker`);
  }
  // 17 Nov 2026: api/run.js and api/og.mjs are gone; an old /api/og link gets the static preview card.
  assert.doesNotMatch(src, /const GONE/);
  assert.match(src, /name === 'og'\) return Response\.redirect\(new URL\('\/icons\/og-card\.png'/);
  assert.ok(fs.existsSync('icons/og-card.png'));
  // The cron secret is sent, and only the 10-minute job is scheduled (17 Nov 2026: the minute price-alert cron is gone).
  const wr = fs.readFileSync('cloudflare/wrangler.jsonc', 'utf8');
  assert.match(wr, /"crons": \["\*\/10 \* \* \* \*"\]/);
  assert.doesNotMatch(src, /alert-cron|'\* \* \* \* \*'/);
  assert.match(src, /'\*\/10 \* \* \* \*': '\/api\/edge-analyst\?job=scan'/);
  assert.match(src, /Bearer \$\{env\.CRON_SECRET/);
  // No secret in the config file.
  assert.doesNotMatch(wr, /"vars"/);
});

const req = (p, init = {}) => new Request('https://aureumdesk.co.uk' + p, init);

test('cloudflare adapter: json, text, status, headers, redirect', async () => {
  let seen;
  const h = (rq, rs) => { seen = rq; rs.setHeader('X-A', '1'); rs.status(201).json({ ok: true, q: rq.query }); };
  const r = await run(h, req('/api/x?a=1&a=2&b=3'), U('/api/x?a=1&a=2&b=3'));
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('x-a'), '1');
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await r.json(), { ok: true, q: { a: ['1', '2'], b: '3' } });
  assert.equal(seen.method, 'GET');
  assert.equal(seen.url, '/api/x?a=1&a=2&b=3');

  const t = await run((rq, rs) => rs.status(200).send('hello'), req('/x'), U('/x'));
  assert.equal(await t.text(), 'hello');
  const rd = await run((rq, rs) => rs.redirect(302, '/y'), req('/x'), U('/x'));
  assert.equal(rd.status, 302); assert.equal(rd.headers.get('location'), '/y');
  const nb = await run((rq, rs) => rs.status(304).end(), req('/x'), U('/x'));
  assert.equal(nb.status, 304); assert.equal(await nb.text(), '');
});

test('cloudflare adapter: request bodies are parsed by content type, as on Vercel', async () => {
  const echo = (rq, rs) => rs.json({ t: typeof rq.body, b: Buffer.isBuffer(rq.body) ? 'buf' : rq.body });
  const post = (body, ct) => run(echo, req('/x', { method: 'POST', body, headers: ct ? { 'content-type': ct } : {} }), U('/x'));
  assert.deepEqual(await (await post('{"a":1}', 'application/json')).json(), { t: 'object', b: { a: 1 } });
  assert.deepEqual(await (await post('a=1&b=2', 'application/x-www-form-urlencoded')).json(), { t: 'object', b: { a: '1', b: '2' } });
  assert.deepEqual(await (await post('hi', 'text/plain')).json(), { t: 'string', b: 'hi' });
  assert.deepEqual(await (await post(new Uint8Array([1, 2]), 'application/octet-stream')).json(), { t: 'object', b: 'buf' });
  const bad = await post('{nope', 'application/json');
  assert.equal(bad.status, 400);
  const empty = await run(echo, req('/x', { method: 'POST' }), U('/x'));
  assert.deepEqual(await empty.json(), { t: 'undefined' });
});

test('cloudflare adapter: the client address is Cloudflare\'s, never the client\'s', () => {
  const h = headersOf(req('/x', { headers: { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9', 'x-real-ip': '9.9.9.9', 'x-vercel-forwarded-for': '9.9.9.9' } }));
  assert.equal(h['x-real-ip'], '1.2.3.4');
  assert.equal(h['x-forwarded-for'], '1.2.3.4');
  assert.equal(h['x-vercel-forwarded-for'], undefined);
  const n = headersOf(req('/x', { headers: { 'x-forwarded-for': '9.9.9.9' } }));
  assert.equal(n['x-forwarded-for'], undefined);
  assert.deepEqual(queryOf(U('/x?p=a%2Fb')), { p: 'a/b' });
});

test('cloudflare adapter: streaming, errors and a handler that never answers', async () => {
  const s = await run(async (rq, rs) => {
    rs.writeHead(200, { 'Content-Type': 'text/event-stream' });
    rs.write('retry: 1500\n\n');
    await new Promise((r) => setTimeout(r, 5));
    rs.write('data: 1\n\n');
    rs.end();
  }, req('/s'), U('/s'));
  assert.equal(s.headers.get('content-type'), 'text/event-stream');
  assert.equal(await s.text(), 'retry: 1500\n\ndata: 1\n\n');

  const orig = console.error; console.error = () => {};
  try {
    const e = await run(() => { throw new Error('boom'); }, req('/e'), U('/e'));
    assert.equal(e.status, 500);
    assert.deepEqual(await e.json(), { error: 'Server error' });
  } finally { console.error = orig; }
  const n = await run(() => {}, req('/n'), U('/n'));
  assert.equal(n.status, 500);
  const late = await run(async (rq, rs) => { await new Promise((r) => setTimeout(r, 5)); rs.status(200).send('late'); }, req('/l'), U('/l'));
  assert.equal(await late.text(), 'late');
});
