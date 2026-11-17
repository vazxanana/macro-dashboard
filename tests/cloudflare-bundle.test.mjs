// The files the Worker bundles (cloudflare/src/bundled.mjs): the Academy's generated data and the two bridge downloads, which
// api/academy.js and api/bridge.js read from disk on Node and Vercel. Offline: bundled.mjs and wrangler.jsonc are read as
// text (their imports are text modules only wrangler can load); the reader and both hooks run here on the same files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EDGES } from '../academy/edges.mjs';
import { bundledData, academyFiles, ACADEMY_COMMON } from '../cloudflare/src/academy-data.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const AC = require('../api/academy.js');
// api/bridge.js loads the Blob client when it is required and CI installs no package: a stand-in (no Blob file is read here)
const origLoad = Module._load;
Module._load = function (r, ...rest) { return r === '@vercel/blob' ? { list: async () => ({ blobs: [], hasMore: false }) } : origLoad.call(this, r, ...rest); };
const bridge = require('../api/bridge.js');
Module._load = origLoad;
const ST = require('../api/_academy-store.js');
const S = require('../api/_session.js');
const A = require('../api/_accounts.js');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FILES = academyFiles(EDGES), TEXTS = Object.fromEntries(FILES.map((f) => [f, src(f)]));
const OUT_FIELDS = ['R', 'netR', 'exitT', 'exit', 'reason', 'mfeR', 'maeR'];
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' };

// cloudflare/src/bundled.mjs as written: its imports (repository paths) and its two maps
const BUNDLED = src('cloudflare/src/bundled.mjs');
const IMPORTS = [...BUNDLED.matchAll(/^import\s+(?:(\w+)|\{\s*([\w\s,]+?)\s*\})\s+from\s+'([^']+)';/gm)].map((m) => ({ name: m[1] || null, named: m[2] || null, spec: m[3], file: path.posix.normalize(path.posix.join('cloudflare/src', m[3])) }));
const mapOf = (name) => Object.fromEntries([...((new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\};`).exec(BUNDLED) || [])[1] || '').matchAll(/'([^']+)':\s*(\w+)/g)].map((m) => [m[1], m[2]]));
// wrangler.jsonc without its comments and trailing commas (strings kept)
function jsonc(text) {
  let out = '', i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i];
    if (inStr) { out += c; if (c === '\\') { out += text[i + 1]; i += 2; continue; } if (c === '"') inStr = false; i++; continue; }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*') { const j = text.indexOf('*/', i + 2); i = j < 0 ? text.length : j + 2; continue; }
    out += c; i++;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}
const CFG = jsonc(src('cloudflare/wrangler.jsonc'));
// wrangler turns a `rules` glob into a pattern the import path must match: glob-to-regexp 0.4.1 with its default options
// (these characters escaped, any run of * = anything, / included)
const globRe = (g) => new RegExp(`^${g.replace(/[/$^+.()=!|?[\]{},]/g, '\\$&').replace(/\*+/g, '.*')}$`);
const textModule = (spec) => (CFG.rules || []).some((r) => r.type === 'Text' && r.globs.some((g) => globRe(g).test(spec)));

// every disk read (sync) made while fn runs, as repository paths
async function diskReads(fn) {
  const seen = [], orig = { readFileSync: fs.readFileSync, statSync: fs.statSync, existsSync: fs.existsSync };
  for (const k of Object.keys(orig)) fs[k] = function (p, ...rest) { seen.push(path.relative(ROOT, String(p)).split(path.sep).join('/')); return orig[k].call(this, p, ...rest); };
  try { await fn(); } finally { Object.assign(fs, orig); }
  return seen;
}
// one call of the real Academy handler; d = extra deps (never `data` unless a test gives it)
async function academy(method, payload, d) {
  const out = { headers: {} }, res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } };
  await AC.handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, d);
  return out;
}
const ownerDeps = (store, extra = {}) => { let clock = Date.UTC(2026, 10, 16, 12); return { env: {}, store, who: async () => OWNER, sameOrigin: () => true, now: () => (clock += 1000), ...extra }; };

test('cloudflare bundle: every file the Node reader reads is bundled as text, under its own path; nothing of academy/archive', async () => {
  // the Node reader itself names the files: every disk read of fileData() for every method and edge
  const N = AC._t.fileData(ROOT);
  const reads = await diskReads(async () => { await N.edges(); for (const e of EDGES) { await N.candidates(e.id); await N.outcomes(e.id); await N.features(e.id); } await N.calendar(); await N.research(); await N.evaluation(); await N.training(); });
  const read = [...new Set(reads.filter((f) => /\.json$/.test(f) && fs.existsSync(path.join(ROOT, f))))].sort();
  assert.deepEqual(read, [...FILES].sort(), 'academyFiles() lists exactly what api/academy.js reads from disk');
  assert.ok(ACADEMY_COMMON.every((f) => FILES.includes(f)) && FILES.length === ACADEMY_COMMON.length + 3 * EDGES.length, FILES.join());
  // bundled.mjs imports each one and maps it under its path (the Academy's map holds those files and nothing else)
  const map = mapOf('ACADEMY_TEXTS');
  assert.deepEqual(Object.keys(map).sort(), [...FILES].sort());
  for (const f of FILES) {
    const imp = IMPORTS.find((i) => i.file === f); assert.ok(imp, `bundled.mjs does not import ${f}`);
    assert.equal(map[f], imp.name, `${f} is mapped to the import of another file`);
    assert.ok(textModule(imp.spec), `${imp.spec} is not a text module (wrangler.jsonc rules): it would be inlined as code`);
  }
  // nothing else: the handlers, the registry (pure code, bundled by esbuild), the reader and the two EA sources
  const BRIDGE_FILES = [...src('api/bridge.js').match(/const FILES = \{([^}]*)\}/)[1].matchAll(/'([^']+\/[^']+)'/g)].map((m) => m[1]);
  const allowed = new Set([...FILES, ...BRIDGE_FILES, 'api/academy.js', 'api/bridge.js', 'academy/edges.mjs', 'cloudflare/src/academy-data.mjs']);
  for (const i of IMPORTS) {
    assert.ok(allowed.has(i.file), `bundled.mjs imports ${i.file}`);
    assert.ok(fs.existsSync(path.join(ROOT, i.file)), `${i.file} does not exist`);
    assert.ok(!/(^|\/)archive\//.test(i.file), `${i.file}: academy/archive/ is never shipped`);
  }
  assert.ok(!/archive\//.test(JSON.stringify(CFG.rules)), 'no text rule reaches an archive');
  for (const spec of ['../../academy/archive/pre-clock/cand-gmp.json', '../../vercel.json', '../../academy/edges.mjs', '../../api/academy.js', './academy-data.mjs']) assert.ok(!textModule(spec), `${spec} must not be a text module`);
  assert.ok(CFG.rules.every((r) => r.fallthrough === true), 'wrangler keeps its default module rules');
  // wired: the Worker loads it, and it hands both handlers their files
  assert.match(src('cloudflare/src/worker.mjs'), /^import '\.\/bundled\.mjs';/m);
  assert.ok(IMPORTS.some((i) => i.name === 'academy' && i.file === 'api/academy.js') && IMPORTS.some((i) => i.name === 'bridge' && i.file === 'api/bridge.js'));
  assert.match(BUNDLED, /^academy\.useData\(bundledData\(ACADEMY_TEXTS, EDGES\)\);$/m);
  assert.match(BUNDLED, /^bridge\.useFiles\(BRIDGE_TEXTS\);$/m);
  const bmap = mapOf('BRIDGE_TEXTS'); assert.deepEqual(Object.keys(bmap).sort(), [...BRIDGE_FILES].sort());
  for (const f of BRIDGE_FILES) { const imp = IMPORTS.find((i) => i.file === f); assert.ok(imp && bmap[f] === imp.name && textModule(imp.spec), f); }
});

test('cloudflare bundle: the bundled reader answers what the Node reader reads from disk, parsing a file only when asked', async () => {
  const P = bundledData(TEXTS, EDGES), N = AC._t.fileData(ROOT);
  assert.deepEqual(await P.edges(), await N.edges());
  for (const e of EDGES) for (const m of ['candidates', 'outcomes', 'features']) assert.deepEqual(await P[m](e.id), await N[m](e.id), `${m}(${e.id})`);
  for (const m of ['calendar', 'research', 'evaluation', 'training']) assert.deepEqual(await P[m](), await N[m](), m);
  for (const m of ['candidates', 'outcomes', 'features']) { assert.equal(await P[m]('nope'), null); assert.equal(await P[m]('constructor'), null); assert.equal(await P[m]('__proto__'), null); }
  assert.equal(await bundledData({}, null).edges(), null, 'no registry: null, as the Node reader without edges.mjs or edges.json');
  // lazy and once: a broken file costs nothing until it is asked for; a parsed file is the same object every time
  const L = bundledData({ ...TEXTS, 'academy/data/cand-gtl.json': '{broken' }, EDGES);
  assert.equal(await L.candidates('geg'), await L.candidates('geg'));
  await assert.rejects(() => L.candidates('gtl'), SyntaxError);
  assert.ok(Array.isArray(await L.candidates('gmp')));
});

test('cloudflare bundle: through the hook the Academy serves the bundled files, reads no disk, and keeps its rules', async () => {
  const P = bundledData(TEXTS, EDGES), store = ST.memoryStore(), d = ownerDeps(store);
  AC.useData(P);
  try {
    assert.equal(AC.connector.context({}, {}).data, P, 'the assistant connector reads the same copy');
    const reads = await diskReads(async () => {
      const e = await academy('GET', { get: 'edges' }, d); assert.equal(e.code, 200); assert.deepEqual(e.body.edges.map((x) => x.id), EDGES.map((x) => x.id));
      for (const edge of EDGES.map((x) => x.id)) {
        const cands = JSON.parse(TEXTS[`academy/data/cand-${edge}.json`]), flagged = (c) => !!(c.rule && (c.rule.clockShift || c.rule.pre2020));
        const tr = await academy('GET', { get: 'candidates', edge, limit: '5000' }, d), ex = await academy('GET', { get: 'candidates', edge, pool: 'exam', limit: '5000' }, d);
        assert.equal(tr.code, 200); assert.equal(ex.code, 200);
        assert.equal(tr.body.total, cands.filter((c) => c.pool !== 'exam' && !flagged(c)).length, `${edge} train pool`);
        assert.equal(ex.body.total, cands.filter((c) => c.pool === 'exam' && !flagged(c)).length, `${edge} exam pool`);
        assert.ok(tr.body.candidates.every((c) => c.pool !== 'exam') && ex.body.candidates.every((c) => c.pool === 'exam'), `${edge}: the pools stay apart`);
        for (const c of [...tr.body.candidates, ...ex.body.candidates]) assert.ok(!OUT_FIELDS.some((k) => k in c), `${edge} ${c.id} carries an outcome field`);
      }
      for (const g of ['research', 'evaluation', 'training', 'calendar']) { const r = await academy('GET', { get: g }, d); assert.equal(r.code, 200); assert.equal(r.body.available, true, g); }
    });
    assert.deepEqual(reads.filter((f) => /^(academy|ml)\//.test(f)), [], 'no Academy file was read from disk');

    // no outcome before an attempt; the outcome after one is the bundled file's
    const cands = JSON.parse(TEXTS['academy/data/cand-gmp.json']), outs = JSON.parse(TEXTS['academy/data/out-gmp.json']);
    const usable = (c) => !(c.rule && (c.rule.clockShift || c.rule.pre2020));
    const c = cands.filter((x) => x.pool !== 'exam' && usable(x)).pop(), x = cands.filter((y) => y.pool === 'exam' && usable(y)).pop();
    const dec = (k) => ({ action: k.side === 'buy' ? 'BUY' : 'SELL', entry: k.entry, stop: k.stop, target: k.target, t: k.t, market: k.market, confidence: 'low', thesis: 'x' });
    const att = (k, mode) => ({ action: 'attempt', attempt: { candidateId: k.id, edge: 'gmp', mode, decision: dec(k), lessonsAvailable: [], snapshotHash: 'h' }, features: { session: 'x' } });
    const before = await academy('GET', { get: 'outcome', edge: 'gmp', id: c.id }, d);
    assert.equal(before.code, 403); assert.match(before.body.error, /decide first/); assert.equal(before.body.outcome, undefined);
    assert.equal((await academy('POST', att(c, 'train'), d)).code, 200);
    const after = await academy('GET', { get: 'outcome', edge: 'gmp', id: c.id }, d);
    assert.equal(after.code, 200);
    assert.deepEqual(after.body.outcome, Object.fromEntries([['id', c.id], ...OUT_FIELDS.filter((k) => outs[c.id][k] !== undefined).map((k) => [k, outs[c.id][k]])]));
    // the exam pool: never trained on, a test only on an exam setup, decided once and then gone from the exam list
    assert.equal((await academy('POST', att(x, 'train'), d)).code, 400);
    assert.equal((await academy('POST', att(c, 'exam'), d)).code, 400);
    const n0 = (await academy('GET', { get: 'candidates', edge: 'gmp', pool: 'exam', limit: '5000' }, d)).body.total;
    assert.equal((await academy('POST', att(x, 'exam'), d)).code, 200);
    assert.equal((await academy('POST', att(x, 'exam'), d)).code, 409);
    assert.equal((await academy('GET', { get: 'candidates', edge: 'gmp', pool: 'exam', limit: '5000' }, d)).body.total, n0 - 1);
    // past cases: train-pool trades finished before the time asked, no ids, never an exam-pool or flagged setup
    const feats = JSON.parse(TEXTS['academy/data/feat-gmp.json']).features, t = x.t;
    const h = await academy('GET', { get: 'history', edge: 'gmp', before: String(t) }, d);
    const want = cands.filter((k) => k.pool !== 'exam' && usable(k) && k.t < t && outs[k.id] && typeof outs[k.id].netR === 'number' && outs[k.id].exitT < t && feats[k.id] && !['missed', 'expired', 'cancelled'].includes(outs[k.id].reason));
    assert.equal(h.code, 200); assert.equal(h.body.total, want.length); assert.ok(h.body.total > 0);
    assert.ok(h.body.rows.every((r) => Object.keys(r).sort().join() === 'exitT,features,netR,t'), 'history rows carry no id and no price');
  } finally { AC.useData(null); }
});

test('cloudflare bundle: the Node path is unchanged: without the hook the disk is read, and a test\'s own data still wins', async () => {
  AC.useData(null);
  const store = ST.memoryStore(), d = ownerDeps(store);
  let body;
  const reads = await diskReads(async () => { const r = await academy('GET', { get: 'candidates', edge: 'gtrend', limit: '5000' }, d); assert.equal(r.code, 200); body = r.body; });
  assert.ok(reads.includes('academy/data/cand-gtrend.json'), 'read from disk');
  AC.useData(bundledData(TEXTS, EDGES));
  try {
    assert.deepEqual((await academy('GET', { get: 'candidates', edge: 'gtrend', limit: '5000' }, d)).body, body, 'the bundled copy answers the same');
    const own = { edges: async () => [{ id: 'gtrend' }], candidates: async () => [{ id: 'own-1', edge: 'gtrend', t: 1, pool: 'train' }], outcomes: async () => null };
    assert.deepEqual((await academy('GET', { get: 'candidates', edge: 'gtrend' }, { ...d, data: own })).body.candidates.map((c) => c.id), ['own-1'], 'd.data wins over the hook');
  } finally { AC.useData(null); }
  assert.notEqual(AC.connector.context({}, {}).data, null);
  assert.equal(typeof AC.connector.context({}, {}).data.candidates, 'function');
  assert.throws(() => AC.useData({}), TypeError);
  assert.throws(() => AC.useData({ candidates: async () => null }), TypeError);
  assert.doesNotThrow(() => AC.useData(null));
});

test('cloudflare bundle: the bridge download serves the bundled text behind the same owner check; without the hook it reads the disk', async () => {
  const keep = process.env.SESSION_SECRET; process.env.SESSION_SECRET = 'test-only-'.repeat(4);
  const tok = S.issue(process.env, 'owner', A.OWNER_HASH, S.account('owner')), cookie = `${S.COOKIE}=${encodeURIComponent(tok)}`;
  const call = async (body, headers = { cookie }) => {
    const out = { headers: {} }, res = { setHeader(k, v) { out.headers[k.toLowerCase()] = v; return res; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; }, send(x) { out.text = x; return res; } };
    await bridge({ method: 'POST', headers, body }, res); return out;
  };
  try {
    bridge.useFiles(null);
    const disk = await call({ file: 'mt5' }); assert.equal(disk.code, 200); assert.equal(disk.text, src('mt5/CouncilBridge.mq5'));
    bridge.useFiles({ 'mt5/CouncilBridge.mq5': 'bundled mt5 text', 'ctrader/CouncilBridge.cs': 'bundled cs text' });
    let r;
    const reads = await diskReads(async () => { r = await call({ file: 'mt5' }); });
    assert.equal(r.code, 200); assert.equal(r.text, 'bundled mt5 text'); assert.match(r.headers['content-type'], /^text\/plain/);
    assert.ok(!reads.some((f) => /CouncilBridge/.test(f)), 'not read from disk');
    assert.equal((await call({ file: 'ctrader' })).text, 'bundled cs text');
    // the owner check is unchanged: signed out nothing, a wrong file name nothing
    const out = await call({ file: 'mt5' }, {}); assert.equal(out.code, 403); assert.equal(out.text, undefined);
    assert.equal((await call({ file: 'nope' })).code, 400);
    // a file the host did not bundle is "missing from the deployment", as on Node when the file is not shipped
    bridge.useFiles({ 'mt5/CouncilBridge.mq5': 'only this one' });
    const miss = await call({ file: 'ctrader' }); assert.equal(miss.code, 500); assert.equal(miss.body.error, 'file missing from the deployment');
    assert.throws(() => bridge.useFiles([]), TypeError); assert.throws(() => bridge.useFiles('text'), TypeError);
  } finally { bridge.useFiles(null); if (keep === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = keep; }
});

test('cloudflare config: the two custom domains are recorded, workers.dev stays on, no vars', () => {
  const routes = CFG.routes || [];
  for (const host of ['aureumdesk.co.uk', 'www.aureumdesk.co.uk']) assert.ok(routes.some((r) => r.pattern === host && r.custom_domain === true), `${host} is a custom domain`);
  assert.ok(routes.every((r) => r.custom_domain === true && !/[*/]/.test(r.pattern)), 'whole hostnames only, no zone route patterns');
  assert.equal(CFG.workers_dev, true);
  assert.equal(CFG.vars, undefined);
});
