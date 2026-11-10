// node --test tests/mosha-desk.test.mjs: the Mosha desk (owner, 10 Nov 2026: "And a place to mosha"): the trade log's server
// rules (api/mosha.js), the desk's statistics and candle check (assets/mosha-desk.js) and the page wiring. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handle, build, rOf, canRead, KEEP } = require('../api/mosha.js');
const D = require('../assets/mosha-desk.js');
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PAGE = rd('../market-structure.html'), JS = rd('../assets/mosha-desk.js'), API = rd('../api/mosha.js');

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0), T0 = Date.UTC(2026, 10, 10, 5, 20, 0) / 1000;
const mk = (seed = []) => { let db = seed.slice(); return { get: async () => db, put: async (v) => { db = v; }, peek: () => db }; };
const call = async (store, method, who, body, extra = {}) => { const out = {}; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
  await handle({ method, body }, res, { env: {}, store, who: async () => who, sameOrigin: () => true, now: NOW, ...extra }); return out; };
const OWNER = { u: 'owner', role: 'owner' }, FRED = { u: 'fred', role: 'reviewer' }, LUXUS = { u: 'luxus', role: 'viewer' };
const SELL = { side: 'sell', at: T0, entry: 4120.42, stop: 4128.92, target: 4072.84, how: 'zone', tf: 'M5', h4: 'against', swept: 'H4 high 4146.9', note: 'the 10 Nov sell' };

test('who reads and who writes: the owner writes, a member with the desks reads, a viewer and a guest get nothing', async () => {
  const s = mk();
  assert.equal((await call(s, 'GET', null)).code, 401);
  assert.equal((await call(s, 'GET', LUXUS)).code, 403);
  assert.equal((await call(s, 'GET', { ...FRED, perms: { desks: false } })).code, 403, 'an explicit permission wins over the role');
  assert.equal((await call(s, 'GET', { ...LUXUS, perms: { desks: true } })).code, 200);
  const g = await call(s, 'GET', FRED); assert.equal(g.code, 200); assert.equal(g.body.canWrite, false); assert.deepEqual(g.body.trades, []);
  assert.equal((await call(s, 'POST', FRED, { save: SELL })).code, 403); assert.equal(s.peek().length, 0);
  assert.equal((await call(s, 'POST', OWNER, { save: SELL }, { sameOrigin: () => false })).code, 403, 'cross-site refused');
  assert.equal((await call(s, 'PUT', OWNER)).code, 405);
  assert.equal((await call(s, 'GET', OWNER)).body.canWrite, true);
  assert.equal(canRead(null), false); assert.equal(canRead(OWNER), true);
});

test('every trade has a stop, on the losing side of its entry', async () => {
  const s = mk(), bad = async (o) => { const r = await call(s, 'POST', OWNER, { save: { ...SELL, ...o } }); assert.equal(r.code, 400, JSON.stringify(o)); return r.body.error; };
  assert.match(await bad({ stop: '' }), /needs a stop/); assert.match(await bad({ stop: null }), /needs a stop/); assert.match(await bad({ stop: 0 }), /needs a stop/); assert.match(await bad({ stop: 'x' }), /needs a stop/);
  assert.match(await bad({ stop: 4120.42 }), /stop above the entry/); assert.match(await bad({ stop: 4100 }), /stop above the entry/);
  assert.match(await bad({ side: 'buy', stop: 4128.92, target: 4200 }), /stop below the entry/);
  assert.match(await bad({ target: 4130 }), /target below the entry/); assert.match(await bad({ side: 'buy', stop: 4100, target: 4100 }), /target above the entry/);
  assert.match(await bad({ entry: '' }), /entry price/); assert.match(await bad({ side: 'short' }), /buy or sell/); assert.match(await bad({ at: 0 }), /entry time/); assert.match(await bad({ at: NOW / 1000 + 3 * 86400 }), /entry time/);
  assert.match(await bad({ target: 'abc' }), /not a price/);
  assert.equal(s.peek().length, 0, 'nothing refused was stored');
  assert.equal((await call(s, 'POST', OWNER, {})).code, 400); assert.equal((await call(s, 'POST', OWNER, '{bad')).code, 400); assert.equal((await call(s, 'POST', OWNER, [])).code, 400);
});

test('a trade logged while open counts as written down before its result; R is worked out on the server', async () => {
  const s = mk(), a = await call(s, 'POST', OWNER, { save: { ...SELL, R: 99, pre: false, id: undefined } }); assert.equal(a.code, 200);
  const t = a.body.trade; assert.equal(t.status, 'open'); assert.equal(t.pre, true); assert.equal(t.R, null); assert.equal(t.planRR, 5.6); assert.equal(t.market, 'xau'); assert.equal(t.logged, new Date(NOW).toISOString());
  // closing it: the page cannot send its own R, and the levels of the open trade may still be corrected
  const c = await call(s, 'POST', OWNER, { save: { id: t.id, ...SELL, status: 'closed', exit: 4072.84, exitAt: T0 + 5.5 * 3600, R: -5 } }); assert.equal(c.code, 200);
  assert.equal(c.body.trade.R, 5.598); assert.equal(c.body.trade.pre, true); assert.equal(c.body.trade.status, 'closed'); assert.equal(s.peek().length, 1);
  // once closed, side / entry / stop / target stay; notes and tags may change
  const e = await call(s, 'POST', OWNER, { save: { id: t.id, side: 'buy', entry: 1, stop: 0.5, target: 2, note: 'kept the plan', how: 'cf' } }); assert.equal(e.code, 200);
  assert.deepEqual([e.body.trade.side, e.body.trade.entry, e.body.trade.stop, e.body.trade.target, e.body.trade.R, e.body.trade.exit], ['sell', 4120.42, 4128.92, 4072.84, 5.598, 4072.84]);
  assert.equal(e.body.trade.note, 'kept the plan'); assert.equal(e.body.trade.how, 'cf'); assert.ok(e.body.trade.edited);
  // a trade logged already closed is kept apart
  const late = await call(s, 'POST', OWNER, { save: { ...SELL, at: T0 - 86400, status: 'closed', exit: 4128.92, exitAt: T0 - 80000 } }); assert.equal(late.body.trade.pre, false); assert.equal(late.body.trade.R, -1);
  assert.equal((await call(s, 'POST', OWNER, { save: { ...SELL, status: 'closed' } })).code, 400, 'a closed trade needs its exit');
  assert.equal((await call(s, 'POST', OWNER, { save: { ...SELL, status: 'closed', exit: 4100, exitAt: T0 - 60 } })).code, 400, 'exit before the entry');
  assert.equal((await call(s, 'POST', OWNER, { save: { id: 'nope', ...SELL } })).code, 404);
  const g = await call(s, 'GET', FRED); assert.deepEqual(g.body.trades.map((x) => x.at), [T0, T0 - 86400], 'newest first');
  assert.equal((await call(s, 'POST', OWNER, { remove: 'nope' })).code, 404); assert.equal((await call(s, 'POST', OWNER, { remove: t.id })).body.removed, 1); assert.equal(s.peek().length, 1);
});

test('text is cleaned and bounded, unknown tags fall back, the log is capped, a failed read never overwrites it', async () => {
  const b = build({ ...SELL, market: 'DOGE', how: 'magic', tf: 'W1', h4: 'sideways', swept: 'x'.repeat(200), note: 'a\u0000b' + 'n'.repeat(2000) }, null, NOW).trade;
  assert.deepEqual([b.market, b.how, b.tf, b.h4], ['xau', 'other', 'M5', '']); assert.equal(b.swept.length, 80); assert.equal(b.note.length, 1000); assert.ok(!b.note.includes('\u0000'));
  assert.equal(rOf({ side: 'buy', entry: 100, stop: 98, exit: 106 }), 3); assert.equal(rOf({ side: 'sell', entry: 100, stop: 102, exit: 103 }), -1.5); assert.equal(rOf({ side: 'sell', entry: 100, stop: 100, exit: 90 }), null);
  const full = mk(Array.from({ length: KEEP }, (_, i) => ({ id: 'x' + i, at: T0 - i }))); assert.equal((await call(full, 'POST', OWNER, { save: SELL })).code, 400); assert.equal(full.peek().length, KEEP);
  let put = 0; const broken = { get: async () => { throw new Error('read 500'); }, put: async () => { put++; } };
  assert.equal((await call(broken, 'POST', OWNER, { save: SELL })).code, 500); assert.equal(put, 0);
  assert.equal((await call(mk(), 'GET', OWNER, null, { store: undefined, env: {} })).code, 503, 'no storage, no made-up log');
  assert.match(API, /if \(!r\.ok\) throw new Error/);
});

test('statistics: never an edge without n and t', () => {
  assert.deepEqual(D.stats([]), { n: 0, win: null, avg: null, total: 0, t: null, maxDD: 0 });
  const s = D.stats([2, -1, -1, 3, -1]); assert.deepEqual([s.n, s.win, s.avg, s.total, s.maxDD], [5, 0.4, 0.4, 2, 2]); assert.equal(s.t, 0.46);
  assert.equal(D.stats([1, 1, 1]).t, null, 'no spread, no t');
  assert.equal(D.verdict(D.stats([])).key, 'none'); assert.equal(D.verdict(D.stats([5, 5, 5, 4])).key, 'few'); assert.match(D.verdict(D.stats([5, 5, 5, 4])).text, /Too few to judge: 4 of 20/);
  const many = (a, b) => Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b));
  assert.equal(D.verdict(D.stats(many(3, -1))).key, 'pos'); assert.equal(D.verdict(D.stats(many(1.2, -1))).key, 'luck'); assert.equal(D.verdict(D.stats(many(0.5, -1))).key, 'neg');
  assert.match(D.verdict(D.stats(many(1.2, -1))).text, /not yet apart from luck \(t 0\.4\d over 20 trades\)/);
  assert.equal(D.MIN_JUDGE, 20);
});

test('the record counts only trades written down before their result; the rest is kept apart', () => {
  const t = (o) => ({ status: 'closed', side: 'sell', how: 'cf', h4: 'with', at: T0, exitAt: T0 + 3600, pre: true, ...o });
  const S = D.summary([t({ R: 2, exitAt: T0 + 100 }), t({ R: -1, exitAt: T0 + 200, how: 'zone', h4: 'against', side: 'buy', at: T0 + 9 * 3600 }), t({ R: 16.4, pre: false }), { status: 'open', pre: true, at: T0 }, t({ R: null })]);
  assert.equal(S.open, 1); assert.equal(S.closed, 3); assert.deepEqual([S.pre.n, S.pre.total], [2, 1]); assert.deepEqual([S.post.n, S.post.total], [1, 16.4]); assert.equal(S.all.n, 3);
  assert.deepEqual(S.curve.map((p) => p.r), [2, 1], 'the curve is the pre-result trades in closing order');
  assert.deepEqual(S.by.how.map((r) => [r.key, r.stats.n]), [['cf', 1], ['zone', 1]]); assert.deepEqual(S.by.h4.map((r) => r.key), ['with', 'against']);
  assert.deepEqual(S.by.session.map((r) => r.key), ['asia', 'new york']); assert.deepEqual(S.by.side.map((r) => [r.key, r.stats.total]), [['sell', 2], ['buy', -1]]);
  assert.equal(D.sessionOf(Date.UTC(2026, 10, 10, 7) / 1000), 'london'); assert.equal(D.sessionOf(Date.UTC(2026, 10, 10, 21) / 1000), 'asia'); assert.equal(D.sessionOf(Date.UTC(2026, 10, 10, 12) / 1000), 'new york');
  assert.equal(D.summary(null).closed, 0);
});

test('a logged trade checked on our candles: the stop counts first', () => {
  const bar = (i, o, h, l, c) => ({ time: T0 + i * 300, open: o, high: h, low: l, close: c }), t = { side: 'sell', at: T0, entry: 100, stop: 102, target: 94, status: 'open' };
  const win = [bar(-1, 101, 101.5, 100.6, 101), bar(0, 101, 101.2, 99.5, 99.8), bar(1, 99.8, 101, 99, 99.2), bar(2, 99.2, 99.4, 93.8, 94.2)];
  assert.deepEqual(D.replay(t, win), { ok: true, filled: true, at: T0, outcome: 'target', when: T0 + 600, R: 3, worst: 0.6, best: 3.1 });
  const both = [bar(0, 100, 102.1, 93, 95)]; assert.equal(D.replay(t, both).outcome, 'stop'); assert.equal(D.replay(t, both).R, -1); assert.equal(D.replay(t, both).worst, 1);
  assert.equal(D.replay(t, [bar(0, 101, 101.2, 99.5, 99.8), bar(1, 99.8, 100.5, 97, 97.5)]).outcome, 'neither');
  const never = D.replay(t, [bar(0, 105, 106, 104, 105), bar(1, 105, 106, 104, 105)]); assert.equal(never.filled, false); assert.match(never.why, /never traded at the entry/);
  assert.equal(D.replay(t, []).ok, false); assert.equal(D.replay({ ...t, stop: 100 }, win).ok, false);
  // a closed trade is only checked up to its logged exit
  assert.equal(D.replay({ ...t, status: 'closed', exitAt: T0 + 300 }, win).outcome, 'neither');
  // buys mirror
  const buy = { side: 'buy', at: T0, entry: 100, stop: 98, target: 104, status: 'open' };
  assert.equal(D.replay(buy, [bar(0, 100.5, 101, 99.8, 100.6), bar(1, 100.6, 104.2, 100.1, 104)]).outcome, 'target'); assert.equal(D.replay(buy, [bar(0, 100.5, 101, 97.9, 98.2)]).outcome, 'stop');
});

test('CSV export: one row per trade, quoted where needed', () => {
  const out = D.csv([{ at: T0, market: 'xau', side: 'sell', entry: 4120.42, stop: 4128.92, target: 4072.84, planRR: 5.6, how: 'zone', tf: 'M5', h4: 'against', swept: 'H4 high, 4146.9', status: 'closed', exit: 4072.84, exitAt: T0 + 19800, R: 5.598, pre: true, note: 'said "wait"' }]).split('\n');
  assert.equal(out.length, 3); assert.match(out[0], /^entry time \(UTC\),market,side,entry,stop,target/);
  assert.equal(out[1], '2026-11-10 05:20,xau,sell,4120.42,4128.92,4072.84,5.6,zone,M5,against,"H4 high, 4146.9",closed,4072.84,2026-11-10 10:50,5.598,yes,"said ""wait"""');
});

test('page wiring: a desk next to the others, members only, the form on the server\'s say', () => {
  assert.match(PAGE, /const VIEWS = \[[^\]]*'mosha'\]/); assert.match(PAGE, /mosha: 'mosha'/);   // its own key since Luxus teaches there (tests/mosha-lessons.test.mjs): open with the other desks, or on its own assert.match(PAGE, /const DESKS = \['ict', 'gold', 'mosha', 'crypto', 'lit', 'sdv'\]/);
  assert.match(PAGE, /if \(v === 'mosha' && window\.renderMosha\) setTimeout\(window\.renderMosha, 0\);/);
  assert.ok(PAGE.includes('<script src="/assets/mosha-desk.js" defer></script>'));
  assert.equal(PAGE.split('<a href="#mosha" data-dsw="mosha" class="adm">Mosha</a>').length - 1, 6, 'the switch on all six desks');
  assert.match(PAGE, /<section class="view adm" id="v-mosha" aria-label="Mosha desk" hidden>/);
  const sec = PAGE.slice(PAGE.indexOf('id="v-mosha"'), PAGE.indexOf('id="v-lit"'));
  assert.match(sec, /id="mo-form-card" hidden/); assert.match(JS, /fc\.hidden = !M\.canWrite/);
  for (const n of ['side', 'market', 'at', 'entry', 'stop', 'target', 'how', 'tf', 'h4', 'swept', 'note', 'status', 'exit', 'exitAt']) assert.ok(sec.includes(`name="${n}"`), n);
  assert.match(sec, /name="stop"[^>]*required/); assert.match(sec, /Every trade has a stop/);
  for (const topic of ['mosha-level', 'mosha-retrace', 'mosha-cycle', 'mosha-sweep', 'mosha-select']) { assert.ok(sec.includes(`/edge-lab.html#${topic}`), topic); assert.ok(fs.existsSync(new URL(`../research/edge/${topic}/RESULT.md`, import.meta.url))); }
  // the desk's figures are the studies' own
  const R = (t) => JSON.parse(rd(`../research/edge/${t}/result.json`)), sw = R('mosha-sweep');
  assert.ok(sec.includes('6,260') && sw.entries.CF.all.n === 6260 && sw.entries.CF.all.avg === -0.109 && sw.entries.CF.all.t === -4.62);
  assert.ok(sec.includes('6,478') && sw.entries.ZONE.all.n === 6478 && sw.entries.ZONE.all.avg === -0.214 && sw.entries.ZONE.all.t === -7.36);
  assert.equal(R('mosha-select').cells.length, 18); assert.ok(R('mosha-select').cells.every((c) => c.d.avg < 0 && c.v.avg < 0 && c.c.avg < 0)); assert.ok(sec.includes('18 versions'));
  // nothing here is called an edge, and no order code is near it
  assert.ok(!/\bedge\b(?! \()/i.test(sec.replace(/it is not an edge|edge-lab\.html/g, '')), 'no edge claim on the desk');
  assert.ok(!/prompt\(|confirm\(|alert\(/.test(JS.replace(/msConfirm\(/g, '')));
  assert.ok(!/require\(|import /.test(JS)); assert.deepEqual([...API.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]), ['./_session.js', '@vercel/blob']);
  assert.ok(JSON.parse(rd('../vercel.json')).functions['api/mosha.js']);
});
