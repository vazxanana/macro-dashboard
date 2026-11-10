#!/usr/bin/env node
// Local server for the Academy page (academy.html): for runs on your own machine and for scripts/audit/academy.cjs.
//
//   sh scripts/build.sh && node scripts/academy-dev.mjs            recorded candles (tests/fixtures/academy), port 8770
//   node --use-env-proxy scripts/academy-dev.mjs --live            real candles through https://meridianx.dev/md/bars
//   node scripts/academy-dev.mjs --guest                           answers /api/me as signed out (to see the owner-only card)
//   node scripts/academy-dev.mjs --fake-llm                        the analyst answers from a FAKE provider (scripts/academy-fake-llm.cjs:
//                                                                  a fixed rule, not a language model, no network, no cost). It is injected
//                                                                  into the handler here and nowhere else; the page shows a FAKE banner
//   node scripts/academy-dev.mjs --connector                       the analyst's questions wait for your own assistant: this server gets a
//                                                                  LOCAL secret (so the connector has a key) and serves
//                                                                  /api/academy-mcp/<key> through the real handler. No provider, no cost
//   node --use-env-proxy scripts/academy-dev.mjs --record [--edge gmp --from 2024-04-23 --to 2024-05-09]
//                                                                  records the fixtures ONCE from the live API, then exits
//   PORT=8770  ACADEMY_STORE_DIR=<dir>  (default: a new folder under the system temp directory, printed at start)
//
// What it serves:
//   - out/ (run the build first) with the vercel.json rewrites (/academy, /backtest, /macro-desk, …);
//   - /api/me as the owner (the real sign-in is not involved: this server is for local use only);
//   - /api/academy through the real handler (api/academy.js `handle`) with a file store and an injected owner session,
//     exactly as the handler's own tests inject it;
//   - /md/bars from the recorded fixtures (default) or proxied to the live site (--live).
//
// Fixture mode is honest about what it holds: the fixtures are real OANDA candles for one window (manifest.json), so the
// candidate lists are narrowed to the setups inside that window (real candidates, real outcomes, nothing invented; past
// cases still come from the whole history). Other markets have no recorded candles and answer with an empty list. It places no orders and talks to no broker.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out'), FIX = path.join(ROOT, 'tests', 'fixtures', 'academy');
const { handle } = require('../api/academy.js');
const MXR = require('../assets/academy-replay.js');
const MXAC = require('../assets/academy-ui.js');

const argv = process.argv.slice(2), flag = (n) => argv.includes('--' + n), opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LIVE = flag('live'), GUEST = flag('guest'), RECORD = flag('record');
const PORT = +(process.env.PORT || 8770), LIVE_BASE = 'https://meridianx.dev';
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' };
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const manifest = () => (fs.existsSync(path.join(FIX, 'manifest.json')) ? readJson(path.join(FIX, 'manifest.json')) : null);

// ---- recording (once): real candles for one window plus the lookback each timeframe needs ---------------------------------
async function record() {
  const old = manifest() || {}, edge = opt('edge', old.edge || 'gmp'), day = (s) => { const t = MXAC.dayToSec(s); if (t == null) throw new Error('dates are YYYY-MM-DD'); return t; };
  const from = day(opt('from', old.from ? MXAC.isoDay(old.from) : '2024-04-23')), to = day(opt('to', old.to ? MXAC.isoDay(old.to) : '2024-05-09'));
  const cands = readJson(path.join(ROOT, 'academy', 'data', `cand-${edge}.json`)).filter((c) => c.t >= from && c.t < to && !(c.rule && (c.rule.clockShift || c.rule.pre2020)));
  if (!cands.length) throw new Error(`no usable ${edge} candidate between those dates`);
  const sym = cands[0].market, tfs = {}; fs.mkdirSync(FIX, { recursive: true });
  for (const tf of MXAC.TFS) {
    const a = from - MXAC.lookbackSec(tf), bars = await MXR.load({ sym, tf, from: a, to, base: LIVE_BASE, cache: false });
    if (!bars.length) throw new Error(`the live API returned no ${tf} candles`);
    fs.writeFileSync(path.join(FIX, `bars-${sym}-${tf}.json`), JSON.stringify({ sym, tf, src: bars.src, inst: bars.inst, from: a, to, cols: ['time', 'open', 'high', 'low', 'close'], bars: bars.map((b) => [b.time, b.open, b.high, b.low, b.close]) }) + '\n');
    tfs[tf] = { from: a, to, n: bars.length }; console.log(`${sym} ${tf}: ${bars.length} candles from ${bars.src}`);
  }
  const m = { edge, sym, from, to, recorded: new Date().toISOString().slice(0, 10), source: `${LIVE_BASE}/md/bars (OANDA mid candles, UTC)`, note: 'Real candles, never synthetic. The dev server narrows every candidate list to [from, to).',
    candidates: { train: cands.filter((c) => c.pool !== 'exam').length, exam: cands.filter((c) => c.pool === 'exam').length }, tfs };
  fs.writeFileSync(path.join(FIX, 'manifest.json'), JSON.stringify(m, null, 1) + '\n'); console.log('manifest', JSON.stringify(m.candidates));
}

// ---- /md/bars ---------------------------------------------------------------------------------------------------------------
const fixCache = new Map();
function fixtureBars(sym, tf, from, to) {
  if (!/^[a-z0-9]{2,12}$/.test(sym) || !Object.prototype.hasOwnProperty.call(MXR.TF, tf)) return { status: 400, body: { error: 'unknown sym or tf' } };
  const f = path.join(FIX, `bars-${sym}-${tf}.json`);
  if (!fs.existsSync(f)) return { status: 200, body: { src: 'recorded fixture (none for this market)', inst: null, tf, bars: [] } };
  if (!fixCache.has(f)) fixCache.set(f, readJson(f));
  const d = fixCache.get(f), bars = [];
  for (const b of d.bars) if (b[0] >= from && b[0] < to) bars.push({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] });
  return { status: 200, body: { src: `${d.src} (recorded)`, inst: d.inst, tf, bars: bars.slice(-5000) } };   // the live API keeps the end of a long window too
}
async function bars(url, res) {
  const q = url.searchParams, from = Math.floor(+q.get('from')), to = Math.ceil(+q.get('to'));
  if (LIVE) {
    try { const r = await fetch(LIVE_BASE + '/md/bars' + url.search, { signal: AbortSignal.timeout(20000) }); return send(res, r.status, Buffer.from(await r.arrayBuffer()), r.headers.get('content-type') || 'application/json'); }
    catch (e) { return json(res, 502, { error: 'the live candle proxy could not be reached: ' + String(e.message || e) }); }
  }
  if (!(from > 0) || !(to > from)) return json(res, 400, { error: 'bad range (the fixture server needs from and to)' });
  const r = fixtureBars(String(q.get('sym') || ''), String(q.get('tf') || ''), from, to); return json(res, r.status, r.body);
}

// ---- /api/academy -----------------------------------------------------------------------------------------------------------
const STORE = process.env.ACADEMY_STORE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'academy-store-'));
const DATA = require('../api/academy.js')._t.fileData(ROOT);
// --fake-llm: the fake provider reaches the handler as an injected dependency (its settings, its fetch, its label). The server's
// own environment is never read for it and the deployed function is called without dependencies, so nothing else can switch it on.
const FAKE = flag('fake-llm') ? require('./academy-fake-llm.cjs').make() : null;
// --connector: a connector secret that exists only in this process, so the connector has a key here (the deployed site uses its own)
const CONNECTOR = flag('connector') && !FAKE;
const DEPS = { env: { ACADEMY_STORE_DIR: STORE, ...(FAKE ? FAKE.env : {}), ...(CONNECTOR ? { ACADEMY_CONNECTOR_SECRET: 'local-dev-server-only-secret-0000' } : {}) }, who: async () => (GUEST ? null : OWNER), sameOrigin: () => true, data: DATA, ...(FAKE ? { fetch: FAKE.fetch, provider: FAKE.provider } : {}) };
// fixture mode: only the LIST of setups (?get=candidates) is narrowed to the recorded window. Everything else reads the whole
// generated files, so "similar past cases" (?get=history) are the same rows as on the live site.
function listDeps() {
  const m = manifest(); if (LIVE || !m) return DEPS;                     // live candles: every setup can be replayed
  return { ...DEPS, data: { ...DATA, async candidates(edge) { const raw = await DATA.candidates(edge); return Array.isArray(raw) ? raw.filter((c) => c.t >= m.from && c.t < m.to) : raw; } } };
}
const LIST_DEPS = listDeps();
function readBody(req, max = 300 * 1024) {
  return new Promise((resolve, reject) => { const parts = []; let n = 0; req.on('data', (c) => { n += c.length; if (n > max) { reject(new Error('too large')); req.destroy(); } else parts.push(c); }); req.on('end', () => resolve(Buffer.concat(parts).toString('utf8'))); req.on('error', reject); });
}
// the assistant connector, through the real handler: /api/academy-mcp/<key> (the rewrite of vercel.json) or ?key=
async function connector(req, res, url) {
  let body; if (req.method === 'POST') { try { body = await readBody(req); } catch (e) { return json(res, 413, { error: 'the body is too large' }); } }
  const key = url.pathname.split('/')[3] || url.searchParams.get('key') || '';
  const vres = { setHeader: (k, v) => res.setHeader(k, v), status(c) { res.statusCode = c; return vres; }, json(o) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return vres; }, end() { res.end(); return vres; } };
  await require('../api/academy-mcp.js').handle({ method: req.method, headers: req.headers, query: { key }, body }, vres, { env: DEPS.env, data: DATA });
}
async function academy(req, res, url) {
  let body; if (req.method === 'POST') { try { body = await readBody(req); } catch (e) { return json(res, 413, { error: 'the body is too large' }); } }
  const vres = { setHeader: (k, v) => res.setHeader(k, v), status(c) { res.statusCode = c; return vres; }, json(o) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return vres; } };
  await handle({ method: req.method, headers: req.headers, url: req.url, query: Object.fromEntries(url.searchParams), body }, vres, req.method === 'GET' && url.searchParams.get('get') === 'candidates' ? LIST_DEPS : DEPS);
}

// ---- static files and rewrites --------------------------------------------------------------------------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8' };
const REWRITES = readJson(path.join(ROOT, 'vercel.json')).rewrites.filter((r) => !/[:*(]/.test(r.source) && /\.html$/.test(r.destination)).map((r) => [r.source, r.destination]);   // the plain page rewrites: /academy → /academy.html …
function send(res, status, body, type) { res.statusCode = status; res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 'no-store'); res.end(body); }
const json = (res, status, o) => send(res, status, JSON.stringify(o), 'application/json; charset=utf-8');
function file(res, pathname) {
  let p = pathname; const rw = REWRITES.find((r) => r[0] === p); if (rw) p = rw[1];
  if (p.startsWith('/macro-dashboard/')) p = p.slice('/macro-dashboard'.length);
  if (p.endsWith('/')) p += 'index.html';
  const full = path.join(OUT, path.normalize(decodeURIComponent(p)));
  if (!full.startsWith(OUT + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) return send(res, 404, 'not found', 'text/plain; charset=utf-8');
  send(res, 200, fs.readFileSync(full), TYPES[path.extname(full)] || 'application/octet-stream');
}

async function serve(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (url.pathname === '/api/me') return json(res, 200, { account: GUEST ? null : OWNER });
    if (url.pathname === '/api/academy') return await academy(req, res, url);
    if (url.pathname === '/api/academy-mcp' || url.pathname.startsWith('/api/academy-mcp/')) return await connector(req, res, url);
    if (url.pathname === '/md/bars') return await bars(url, res);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/md/') || url.pathname.startsWith('/cdata/')) return json(res, 404, { error: 'not served by the Academy dev server' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'GET', 'text/plain; charset=utf-8');
    return file(res, url.pathname);
  } catch (e) { if (!res.headersSent) json(res, 500, { error: String((e && e.message) || e) }); else res.end(); }
}

if (RECORD) { record().then(() => process.exit(0), (e) => { console.error('record failed:', e.message); process.exit(1); }); }
else {
  if (!fs.existsSync(path.join(OUT, 'academy.html'))) { console.error('out/academy.html is missing: run `sh scripts/build.sh` first'); process.exit(1); }
  const m = manifest();
  http.createServer(serve).listen(PORT, '127.0.0.1', () => {
    console.log(`Academy dev server: http://127.0.0.1:${PORT}/academy`);
    console.log(`  candles: ${LIVE ? 'LIVE through ' + LIVE_BASE + '/md/bars' : m ? `recorded ${m.sym} candles, setups from ${MXAC.isoDay(m.from)} to ${MXAC.isoDay(m.to - 86400)} (edge ${m.edge}: ${m.candidates.train} train, ${m.candidates.exam} exam)` : 'NO fixtures recorded (run with --record once)'}`);
    console.log(`  store:   ${STORE}${GUEST ? '\n  signed out (--guest)' : ''}`);
    console.log(`  analyst: ${FAKE ? 'FAKE PROVIDER (--fake-llm): test answers by a fixed rule, not a language model, no network' : CONNECTOR ? 'through the connector (--connector): questions wait for your own assistant; the address is on the page under "Set up the connector"' : 'off (no key is read here; --fake-llm serves labelled test answers, --connector queues questions for your own assistant)'}`);
  });
}
