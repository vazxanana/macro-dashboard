// node --test tests/guest-files.test.mjs — what a visitor who is not signed in gets from /cdata (11 Nov 2026).
// The guest files hold every book with system names, notes and block reasons; the server now cuts them to what the guest page
// draws (api/_guestcut.js, wired into api/data.js). Offline: the pinned council-data copies in tests/fixtures/council, fake
// GitHub answers, fake user store.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const G = require('../api/_guestcut.js'), data = require('../api/data.js'), S = require('../api/_session.js'), login = require('../api/login.js');

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url));
const PAGE = read('market-structure.html').toString('utf8');
const TRADES = read('tests/fixtures/council/trades.json'), RESEARCH = read('tests/fixtures/council/research.json');
const sys = (k, o = {}) => ({ id: `xau-${k}-${o.opened || 1}`, market: 'xau', label: 'XAU/USD', dec: 1, k, name: `System ${k}`, pair: 'H4 → M15', h: '15m', side: 'buy', entry: 4000, stop: 3990, t1: 4020, rr: 2, opened: 1, status: 'open', R: null, note: `rule text of ${k}`, feat: { d1: 'with' }, ctx: { vol: 1 }, ...o });
// a trades.json with every case the cut must decide, on top of the real pinned week
const EXTRA = [sys('gmp', { opened: 11 }), sys('gtrend5', { opened: 12, t1: null, addOf: 'xau-gtrend5-9' }), sys('mosha-bo', { opened: 13, shadow: true, blockedBy: ['weekly-against'] }),
  sys('lit', { opened: 14, name: 'LIT (paper shadow)' }), { ...sys('trend', { opened: 15 }), market: 'btc', label: 'BTC/USD', id: 'btc-trend-15', pm: { cause: 'late entry after the news' } }];
const TRADES_X = Buffer.from(JSON.stringify(JSON.parse(TRADES).concat(EXTRA)));
const REPLAY = Buffer.from(JSON.stringify({ note: 'Replay of our systems: replica v5, gold trend N20 …', from: '2022-12-01', to: '2026-11-10', trades: [
  { id: 'nq-nyflip-1', market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: 'nyflip', name: 'NQ New York open run', pair: 'M1', side: 'sell', entry: 100, stop: 110, t1: 80, opened: 5, closed: 6, status: 'win', R: 2, replay: true, paper: true, levelPrice: 101, note: 'swept the open' },
  { id: 'nq-tokyo-1', market: 'nq', k: 'nq-open', session: 'tokyo', side: 'buy', entry: 1, stop: 0.5, status: 'loss', R: -1, closed: 7, replay: true },
  { id: 'xau-replica-7', market: 'xau', label: 'XAU/USD', k: 'replica', session: 'london', name: 'Gold replica', side: 'buy', entry: 10, stop: 9, t1: 12, opened: 7, closed: 8, status: 'loss', R: -1, replay: true, ext: { h4: 1 }, src: 'oanda' },
  { id: 'xau-gmp-9', market: 'xau', k: 'gmp', name: 'Gold momentum pullback', shadow: true, side: 'buy', entry: 10, stop: 9, status: 'win', R: 1, closed: 9, replay: true },
  { id: 'xau-old-9', market: 'xau', k: 'intraday', name: 'Intraday', side: 'buy', entry: 10, stop: 9, status: 'win', R: 1, closed: 9, replay: true }] }));
const SNAP = Buffer.from(JSON.stringify({ at: '2026-11-11T18:00:00.000Z', errors: { 'macro:fred': 'timeout' }, lessons: { scalp: 'avoid the late session' }, ownerReviews: { candidates: [{ tag: 'hunt' }] }, moshaBo: { state: { h4: 1 } },
  goldTrend: { n: 20 }, costs: { live: 1 }, nqLast: { price: 28668, at: 1794423360, secret: 'x' }, nqRegime: { ts: 0.31 },
  markets: { xau: { label: 'XAU/USD', name: 'Gold', price: 3988.455, dec: 1, open: true, trend: { '1d': -1, '4h': 1, '1h': 1, '15m': -1 }, setups: [{ name: 'Position', next: 'Wait for H1 to break down (the CF)', state: 'IN ORIGIN' }] },
    btc: { label: 'BTC/USD', name: 'Bitcoin', price: 101000, dec: 0, chg: 1.2, trend: { '1d': 1 }, setups: [{ name: 'Scalp' }] } } }));
const ICT = Buffer.from(JSON.stringify({ at: 'x', from: '2025-08-01', ruleCode: 'abc', totals: { n: 804, wins: 304, losses: 448, be: 52, nearFlat: 60, open: 2, R: 117.08, R2: 61.51 }, totalsA: { n: 99 }, trades: [{ id: 'es-s-1', feat: { grade: 7 }, note: 'A-setup' }], shadowByVariant: { nofri: [] } }));
const CSV = Buffer.from('# council-bridge v1 generated 1794423384\nid,market,k,side,status\nxau-geg-1793664000,xau,geg,buy,pending\n');
const FILES = { 'trades.json': TRADES_X, 'research.json': RESEARCH, 'research/replay-2w.json': REPLAY, 'snapshot.json': SNAP, 'ict/replay.json': ICT, 'mt5/signals.csv': CSV };
const KEY = 'test-key';
const J = (f, key = KEY) => JSON.parse(G.cut(f, FILES[f], key).toString('utf8'));

// the page's own definitions, read out of its source
const list = (re) => JSON.parse(re.exec(PAGE)[1].replace(/'/g, '"'));
const P_SYS_K = list(/const SYS_K = (\[[^\]]+\]);\n  \/\/ guests: our main system only/), P_NQ = list(/const NQ_SYS = (\[[^\]]+\]), nqSys/);
const P_SYSG = list(/tf = TFS\.find\(\(t\) => t\.id === '4h'\), SYSG = (\[[^\]]+\]);/), P_F = list(/const GUEST_F = (\[[^\]]+\]);/), P_MAIN = list(/var MAIN = (\[[^\]]+\])/);
const between = (from, to) => { const i = PAGE.indexOf(from), j = PAGE.indexOf(to, i); assert.ok(i >= 0 && j > i, `page block: ${from}`); return PAGE.slice(i, j); };
// GUEST_DATA as the page installs it for a guest (SYS_K with 'main' pushed: the line right after the setters)
const pageCut = (extra = []) => new Function(`const SYS_K = ${JSON.stringify(P_SYS_K.concat(extra))}, nqSys = (x) => x.market !== 'nq' || ${JSON.stringify(P_NQ)}.includes(x.session);\n${between('  const GUEST_F = [', '  if (PUB) for (const [key, cut] of Object.entries(GUEST_DATA))')}\nreturn GUEST_DATA;`)();

test('one definition of "main system": the server lists are the page lists', () => {
  assert.deepEqual(G.SYS_K, P_SYS_K, 'SYS_K'); assert.deepEqual(G.SYS_K, P_MAIN, "the sign-in card's MAIN");
  assert.deepEqual(G.NQ_SYS, P_NQ, 'NQ_SYS'); assert.deepEqual(G.SYSG, P_SYSG, "the guest trade card's SYSG"); assert.deepEqual(G.FIELDS, P_F, 'GUEST_F');
  assert.deepEqual([...G.CUT_FILES, 'mt5/signals.csv'].sort(), [...data.GUEST_OK].sort(), 'every guest file but the bridge csv has a cut');
  for (const f of G.CUT_FILES) assert.equal(typeof G.CUTS[f], 'function', f);
  // the page takes the cut rows: 'main' joins SYS_K for a guest, the card reads `card`, the sign-in card counts 'main'
  assert.match(PAGE, /\n  if \(PUB\) SYS_K\.push\('main'\);\n/);
  assert.match(PAGE, /\(SYSG\.includes\(x\.k\) \|\| x\.card\)/);
  assert.match(PAGE, /MAIN\.indexOf\(t\.k\) >= 0 \|\| t\.k === 'main'/);
});

test('the cut keeps exactly the rows and values the page keeps for a guest', () => {
  const D0 = pageCut(), D1 = pageCut(['main']), same = (a, b, what) => {
    assert.equal(a.length, b.length, `${what}: same rows`);
    a.forEach((x, i) => { for (const f of G.FIELDS) if (!['id', 'k', 'session', 'addOf', 'card'].includes(f)) assert.deepEqual(x[f], b[i][f], `${what} row ${i} ${f}`); }); };
  const full = { t: JSON.parse(TRADES_X), r: JSON.parse(RESEARCH), p: JSON.parse(REPLAY) }, c = { t: J('trades.json'), r: J('research.json'), p: J('research/replay-2w.json') };
  same(c.t, D0.trades(full.t), 'trades'); same(c.r, D0.research(full.r), 'research'); same(c.p.trades, D0.replay(full.p).trades, 'replay');
  assert.ok(c.t.length >= 4 && c.t.length < full.t.length / 3, 'the pinned week is mostly other books');
  assert.deepEqual([c.p.from, c.p.to, Object.keys(c.p).sort()], ['2022-12-01', '2026-11-10', ['from', 'to', 'trades']]);
  // and the page's own filter, run on the cut file, drops nothing more (so every guest number is the same as before)
  assert.deepEqual(D1.trades(c.t), c.t); assert.deepEqual(D1.research(c.r), c.r); assert.deepEqual(D1.replay(c.p), c.p);
  const R = (a) => a.filter((x) => x.R != null).reduce((q, x) => q + x.R, 0);
  assert.equal(R(c.t), R(D0.trades(full.t))); assert.equal(R(c.p.trades), R(D0.replay(full.p).trades));
  // which rows: shadow, older engines, LIT and the NQ trackers are gone; the stop is on every row that is left
  assert.deepEqual(c.t.slice(-3).map((x) => [x.market, x.k, x.opened, x.card]), [['xau', 'main', 11, undefined], ['xau', 'main', 12, true], ['btc', 'main', 15, undefined]], 'gmp is main but not a card trade (as SYSG); shadow Mosha and LIT are dropped');
  assert.deepEqual(c.p.trades.map((x) => [x.market, x.k, x.session]), [['nq', 'nq-open', 'nyflip'], ['xau', 'main', undefined], ['xau', 'other', undefined]]);
  for (const x of [...c.t, ...c.r, ...c.p.trades]) { assert.ok(Number.isFinite(x.stop) && Number.isFinite(x.entry), 'entry and stop stay'); assert.ok(Object.keys(x).every((f) => G.FIELDS.includes(f)), Object.keys(x).join()); }
  for (const x of c.r) assert.deepEqual([x.market, x.k, x.session], ['nq', 'nq-open', 'nyflip']);
});

test('nothing of the other books, no system name, note or reason is in a guest file', () => {
  const T = JSON.parse(TRADES_X), all = T.concat(JSON.parse(RESEARCH), JSON.parse(REPLAY).trades);
  const out = G.CUT_FILES.map((f) => G.cut(f, FILES[f], KEY).toString('utf8')).join('\n');
  // a watch-list taken from the files themselves: every system name, pair text, real system key and id, the start of every note
  const names = [...new Set(all.flatMap((x) => [x.name, x.pair]).filter((s) => typeof s === 'string' && s.length >= 3))];
  const notes = [...new Set(all.map((x) => x.note).filter((s) => typeof s === 'string' && s.length >= 12).map((s) => s.slice(0, 24)))];
  const keys = [...new Set(all.map((x) => x.k).filter((k) => k && k !== 'nq-open'))], ids = [...new Set(all.map((x) => x.id))];
  assert.ok(names.includes('Scalp') && names.includes('Gold daily engulf') && keys.includes('rscalp') && keys.includes('geg') && notes.length > 20 && ids.length > 90, 'the watch-list is real');
  for (const w of names) assert.ok(!out.includes(JSON.stringify(w)), `name or pair in a guest file: ${w}`);
  for (const w of notes) assert.ok(!out.includes(w), `note in a guest file: ${w}`);
  for (const k of keys) assert.ok(!out.includes(`"k":"${k}"`) && !out.includes(`-${k}-`), `system key in a guest file: ${k}`);
  for (const id of ids) assert.ok(!out.includes(JSON.stringify(id)), `real id in a guest file: ${id}`);
  for (const w of ['blockedBy', 'shadow', '"note"', '"name":"System', '"pair"', '"feat"', '"pm"', '"ctx"', '"h"', 'costR', 'Rnet', 'mfe', 'reason', 'setups', 'lessons', 'ownerReviews', 'errors', 'moshaBo', 'goldTrend', 'nqRegime', 'costs', 'ruleCode', 'totalsA', 'shadowByVariant', 'A-setup', 'weekly-against', 'nyflip-x', 'sd2ifvg', 'secret', 'Wait for H1'])
    assert.ok(!out.includes(w), `in a guest file: ${w}`);
  // snapshot: prices and the timestamp; gold's three trend arrows; nothing else
  assert.deepEqual(J('snapshot.json'), { at: '2026-11-11T18:00:00.000Z', nqLast: { price: 28668, at: 1794423360 },
    markets: { xau: { label: 'XAU/USD', name: 'Gold', price: 3988.455, dec: 1, open: true, trend: { '1d': -1, '4h': 1, '1h': 1 } }, btc: { label: 'BTC/USD', name: 'Bitcoin', price: 101000, dec: 0, chg: 1.2 } } });
  // the ICT replay: the one line of the sign-in card
  assert.deepEqual(J('ict/replay.json'), { from: '2025-08-01', totals: { n: 804, wins: 304, R: 117.08 } });
  assert.ok(G.cut('ict/replay.json', ICT, KEY).length < 100 && G.cut('trades.json', TRADES_X, KEY).length < TRADES_X.length / 10);
});

test('ids are opaque, stable and the same in every file; a row object never passes', () => {
  const t = J('trades.json'), real = JSON.parse(TRADES_X).filter((x) => !x.shadow && G.SYS_K.includes(x.k));
  assert.ok(t.every((x) => /^g[A-Za-z0-9_-]{14}$/.test(x.id))); assert.equal(new Set(t.map((x) => x.id)).size, t.length);
  assert.deepEqual(J('trades.json').map((x) => x.id), t.map((x) => x.id), 'the same on every request');
  assert.notEqual(J('trades.json', 'another-key')[0].id, t[0].id, 'keyed with the server secret');
  assert.equal(G.idOf(KEY)('nq-nyflip-1'), J('research/replay-2w.json').trades[0].id, 'one id per trade across the files (the page de-duplicates by id)');
  const add = t.find((x) => x.addOf); assert.equal(add.addOf, G.idOf(KEY)('xau-gtrend5-9'));
  assert.equal(real.length, t.length);
  const odd = G.cut('trades.json', Buffer.from(JSON.stringify([{ id: 'a', k: 'replica', market: 'xau', entry: { note: 'x' }, stop: 1, status: ['open'], side: 'buy' }, null, 'x', [1]])), KEY).toString();
  assert.equal(odd, JSON.stringify([{ id: G.idOf(KEY)('a'), market: 'xau', k: 'main', side: 'buy', stop: 1, card: true }]), 'a field that is not a plain value is dropped, a row that is not an object is dropped');
});

test('the sign-in card says the same from the cut files as from the whole ones', () => {
  const W = {}; new Function('window', between('window.msGateProof = function', '  // live proof for guests'))(W);
  const now = 1794430000, full = W.msGateProof(JSON.parse(TRADES_X), JSON.parse(ICT), now), cutG = W.msGateProof(J('trades.json'), J('ict/replay.json'), now);
  assert.deepEqual(cutG, full); assert.equal(cutG.ict.v, '+117R'); assert.match(cutG.ict.s, /^804 trades since Aug 2025 · before costs$/); assert.match(cutG.ict.tip, /38% won/);
  assert.equal(cutG.open.v, '3', 'the three open main-system trades of the extra rows');
});

// ── the handler ──
const ENV = { CTRADER_LINK_KEY: 'link-key-fake-0123456789' }, sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const builtIns = { luxus: { name: 'Luxus', hash: sha('lx-pw'), role: 'viewer' } }, deps = { builtIns, blobUsers: async () => ({ users: {} }) };
function res() { const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.send = (b) => { r.body = b; return r; }; return r; }
const fileOf = (u) => Object.keys(FILES).find((f) => String(u).includes(`/council-data/${f}?`));
const fetchOf = (files = FILES) => async (u) => { const f = fileOf(u), b = files[f]; return b ? { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) } : { ok: false, status: 404 }; };
const ask = async (p, { cookie, m, files, d = deps } = {}) => { const r = res(); await data.handle({ method: 'GET', headers: { host: 'x.test', ...(cookie ? { cookie } : {}) }, query: { p, ...(m ? { m } : {}) } }, r, { env: ENV, fetch: fetchOf(files), deps: d }); return r; };
const signIn = async () => { const r = res(); await login.handle({ method: 'POST', headers: { host: 'x.test' }, body: { password: 'lx-pw' } }, r, { env: ENV, deps }); return String(r.headers['set-cookie']).split(';')[0]; };
const PUBLIC = 'public, max-age=0, s-maxage=20, stale-while-revalidate=60';

test('/cdata: a visitor gets the cut file, a signed-in member the whole file byte for byte', async () => {
  S._cache.users = null; const cookie = await signIn();
  for (const p of G.CUT_FILES) {
    const g = await ask(p), want = G.cut(p, FILES[p], S.secret(ENV));
    assert.equal(g.code, 200, p); assert.ok(Buffer.compare(g.body, want) === 0, `${p}: the guest answer is the cut`); assert.ok(g.body.length < FILES[p].length, p);
    assert.equal(g.headers['cache-control'], PUBLIC, p); assert.equal(g.headers['access-control-allow-origin'], '*'); assert.equal(g.headers.vary, 'Cookie', p);
    const m = await ask(p, { cookie, m: '1' });
    assert.equal(m.code, 200, p); assert.ok(Buffer.compare(m.body, FILES[p]) === 0, `${p}: a member gets the file as it is`);
    assert.equal(m.headers['cache-control'], 'private, no-store', p); assert.equal(m.headers['access-control-allow-origin'], undefined, p); assert.equal(m.headers.vary, 'Cookie', p);
    const m2 = await ask(p, { cookie });   // an older page that does not mark its address: the cookie alone decides, still never cached
    assert.ok(Buffer.compare(m2.body, FILES[p]) === 0, p); assert.equal(m2.headers['cache-control'], 'private, no-store', p);
  }
});

test('/cdata cache separation: only a request with no cookie and no member mark is publicly cacheable', async () => {
  S._cache.users = null; const cookie = await signIn(), cutT = G.cut('trades.json', TRADES_X, S.secret(ENV));
  const cases = { 'a member mark without a session': { m: '1' }, 'a forged cookie': { cookie: 'ms_session=forged.mac' }, 'a forged cookie on a marked address': { cookie: 'ms_session=a.b', m: '1' } };
  for (const [what, o] of Object.entries(cases)) { const r = await ask('trades.json', o);
    assert.equal(r.code, 200, what); assert.ok(Buffer.compare(r.body, cutT) === 0, `${what}: the cut file, never the whole one`);
    assert.equal(r.headers['cache-control'], 'private, no-store', `${what}: not stored under a member's address or cookie`); assert.equal(r.headers['access-control-allow-origin'], undefined, what); }
  // the sign-in check itself down (user list unreadable, never read before): a member is treated as a visitor, not the other way round
  S._cache.users = null;
  const down = await ask('trades.json', { cookie, m: '1', d: { builtIns, blobUsers: async () => { throw new Error('store down'); } } });
  assert.equal(down.code, 200); assert.ok(Buffer.compare(down.body, cutT) === 0); assert.equal(down.headers['cache-control'], 'private, no-store');
  S._cache.users = null;
  // errors for a marked request are not stored either
  const gone = await ask('trades.json', { m: '1', files: {} }); assert.equal(gone.code, 404); assert.equal(gone.headers['cache-control'], 'private, no-store');
  assert.equal((await ask('trades.json', { files: {} })).headers['cache-control'], 's-maxage=15');
});

test('/cdata: mt5/signals.csv is served whole to everyone, as before (the broker bridges read it without a session)', async () => {
  S._cache.users = null; const cookie = await signIn();
  for (const o of [{}, { cookie }, { cookie: 'ms_session=forged.mac' }]) { const r = await ask('mt5/signals.csv', o);
    assert.equal(r.code, 200); assert.ok(Buffer.compare(r.body, CSV) === 0, 'byte for byte'); assert.equal(r.headers['cache-control'], PUBLIC);
    assert.equal(r.headers['access-control-allow-origin'], '*'); assert.equal(r.headers['content-type'], 'text/csv; charset=utf-8'); assert.equal(r.headers.vary, undefined); }
  assert.ok(!G.CUT_FILES.includes('mt5/signals.csv')); assert.throws(() => G.cut('mt5/signals.csv', CSV, KEY));
});

test('/cdata fails closed: a file that does not parse, or that the cut cannot read, is a 503 for a visitor, never the whole file', async () => {
  const bad = { 'trades.json': Buffer.from('[{"id":"xau-geg-1","note":"secret rule text"'), 'snapshot.json': Buffer.from('"lessons: secret"'), 'research.json': Buffer.from('{"rows":[{"note":"secret"}]}'),
    'research/replay-2w.json': Buffer.from('{"note":"secret","trades":"none"}'), 'ict/replay.json': Buffer.from('[{"note":"secret"}]') };
  for (const p of G.CUT_FILES) { const r = await ask(p, { files: bad });
    assert.equal(r.code, 503, p); assert.equal(r.headers['cache-control'], 'private, no-store', p); assert.doesNotMatch(JSON.stringify(r.body), /secret|geg/, p); assert.deepEqual(r.body, { error: 'data not available right now' }); }
  // a cut that throws for any other reason
  const keep = G.CUTS['trades.json']; G.CUTS['trades.json'] = () => { throw new Error('bug'); };
  try { const r = await ask('trades.json'); assert.equal(r.code, 503); assert.deepEqual(r.body, { error: 'data not available right now' }); } finally { G.CUTS['trades.json'] = keep; }
  // a member still gets the file as it is, parse or not (as before)
  S._cache.users = null; const cookie = await signIn(), m = await ask('trades.json', { cookie, files: bad }); assert.equal(m.code, 200); assert.ok(Buffer.compare(m.body, bad['trades.json']) === 0);
  // and the page reads a 503 as "could not be loaded" (msData answers null for a failed read)
  assert.match(PAGE, /\.then\(function \(r\) \{ return r\.ok \? r\.text\(\) : null; \}\)/);
});
