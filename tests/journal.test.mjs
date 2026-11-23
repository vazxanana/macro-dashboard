// node --test tests/journal.test.mjs: the decision journal (23 Nov 2026; research/proposals/2026-11-20-discretion.md). The server
// stamps the time, refuses a stop on the wrong side, allows no edit after the stamp (a note only), deletes only within 2 minutes,
// and shows each account its own calls; the outcome reads only candles from the stamp on, stop first; the stats rule. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handle, canUse, _reset } = require('../api/journal.js');
const J = require('../api/_journal.js');
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

const T0 = Date.UTC(2026, 10, 23, 9, 0, 0);
// one file per account (review, 23 Nov 2026); peek() = every account's records in the order written
const mk = (delay = 0) => { _reset(); const db = new Map(), order = []; const wait = () => new Promise((r) => setTimeout(r, delay));
  return { get: async (u) => { if (delay) await wait(); return (db.get(u) || []).slice(); }, put: async (u, v) => { if (delay) await wait(); db.set(u, v); v.forEach((x) => { if (!order.includes(x.id)) order.push(x.id); }); },
    peek: () => order.map((id) => [...db.values()].flat().find((x) => x.id === id)).filter(Boolean), of: (u) => db.get(u) || [] }; };
const call = async (store, method, who, body, extra = {}) => { const out = {}; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
  await handle({ method, body }, res, { env: {}, store, who: async () => who, sameOrigin: () => true, now: T0, ...extra }); return out; };
const OWNER = { u: 'owner', role: 'owner' }, FRED = { u: 'fred', role: 'reviewer' }, LUXUS = { u: 'luxus', role: 'viewer' };
const BUY = { market: 'xau', side: 'buy', action: 'take', entry: 4000, stop: 3990, target: 4020, tf: 'M5', method: 'box touch', reason: 'at my level', confidence: 4 };

test('the server stamps the time; the page cannot', async () => {
  const s = mk(), r = await call(s, 'POST', OWNER, { call: { ...BUY, at: 1 } });
  assert.equal(r.code, 200); assert.equal(r.body.call.at, T0 / 1000); assert.equal(s.peek()[0].at, T0 / 1000); assert.equal(s.peek()[0].u, 'owner');
  assert.equal(r.body.call.u, undefined, 'the account key stays on the server'); assert.equal(r.body.call.planRR, 2);
});

test('every call has a stop on its losing side, and the other fields are checked', async () => {
  const s = mk(), bad = async (o) => { const r = await call(s, 'POST', OWNER, { call: { ...BUY, ...o } }); assert.equal(r.code, 400, JSON.stringify(o)); return r.body.error; };
  assert.match(await bad({ stop: '' }), /needs a stop/); assert.match(await bad({ stop: 4010 }), /stop below/); assert.match(await bad({ stop: 4000 }), /stop below/);
  assert.match(await bad({ side: 'sell', stop: 3990, target: 3980 }), /stop above/);
  assert.match(await bad({ target: 3995 }), /target above/); assert.match(await bad({ market: 'btc' }), /market/);
  assert.match(await bad({ action: 'maybe' }), /take or skip/); assert.match(await bad({ confidence: 9 }), /confidence/);
  assert.equal(s.peek().length, 0);
  const ok = await call(s, 'POST', OWNER, { call: { ...BUY, target: '', method: 'x'.repeat(90), reason: 'y'.repeat(400) } });
  assert.equal(ok.code, 200); assert.equal(ok.body.call.target, null); assert.equal(ok.body.call.method.length, 40); assert.equal(ok.body.call.reason.length, 300);
});

test('no edit after the stamp: a note only; delete only within 2 minutes', async () => {
  const s = mk(), id = (await call(s, 'POST', OWNER, { call: BUY })).body.call.id;
  assert.equal((await call(s, 'POST', OWNER, { call: { ...BUY, id, stop: 3950 } })).code, 400);
  assert.equal((await call(s, 'POST', OWNER, { save: { id, stop: 3950 } })).code, 400);
  const n = await call(s, 'POST', OWNER, { note: { id, text: 'stopped by news', stop: 1, entry: 1 } }, { now: T0 + 3600e3 });
  assert.equal(n.code, 200); assert.equal(n.body.call.note, 'stopped by news'); assert.equal(n.body.call.stop, 3990); assert.equal(n.body.call.at, T0 / 1000);
  assert.equal((await call(s, 'POST', OWNER, { remove: id }, { now: T0 + 121e3 })).code, 409);
  const w = await call(s, 'POST', OWNER, { remove: id }, { now: T0 + 119e3 }); assert.equal(w.code, 200);
  // review, 23 Nov 2026: nothing is deleted (the proposal); a withdrawn call stays on the record, marked, and is counted apart
  assert.equal(s.peek().length, 1); assert.equal(s.peek()[0].withdrawn, T0 / 1000 + 119); assert.equal(w.body.call.withdrawn, T0 / 1000 + 119);
  assert.equal((await call(s, 'POST', OWNER, { remove: id }, { now: T0 + 119e3 })).code, 409, 'withdrawn once');
  assert.equal((await call(s, 'GET', OWNER)).body.calls[0].withdrawn, T0 / 1000 + 119);
});

test('each account reads and changes only its own calls; who may use it', async () => {
  const s = mk(); await call(s, 'POST', OWNER, { call: BUY }); const f = (await call(s, 'POST', FRED, { call: { ...BUY, action: 'skip' } })).body.call;
  const g = await call(s, 'GET', OWNER); assert.equal(g.body.calls.length, 1); assert.equal(g.body.calls[0].action, 'take');
  assert.equal((await call(s, 'GET', FRED)).body.calls[0].id, f.id);
  assert.equal((await call(s, 'POST', OWNER, { note: { id: f.id, text: 'x' } })).code, 404); assert.equal((await call(s, 'POST', OWNER, { remove: f.id })).code, 404);
  assert.equal((await call(s, 'GET', null)).code, 401); assert.equal((await call(s, 'GET', LUXUS)).code, 403);
  assert.equal((await call(s, 'GET', { ...LUXUS, perms: { desks: true } })).code, 200); assert.equal((await call(s, 'GET', { ...FRED, perms: { desks: false } })).code, 403);
  assert.equal((await call(s, 'POST', OWNER, { call: BUY }, { sameOrigin: () => false })).code, 403);
  assert.equal(canUse(OWNER), true); assert.equal(canUse(null), false);
  _reset(); const fail = { get: async () => { throw new Error('read'); }, put: async () => { throw new Error('must not write'); } };
  assert.equal((await call(fail, 'POST', OWNER, { call: BUY })).code, 500, 'a failed read is never saved over');
});

test('outcome: candles from the stamp on only, stop first in one candle, target, open', () => {
  const at = 1000, c = { at, side: 'buy', entry: 100, stop: 99, target: 102 };
  const b = (time, o, h, l, cl, extra) => ({ time, open: o, high: h, low: l, close: cl, ...extra });
  // a candle before the stamp that hit the stop is never read
  assert.equal(J.outcome(c, [b(700, 100, 100, 98, 99), b(1000, 100, 101, 99.5, 100.5)]).status, 'open');
  assert.deepEqual([J.outcome(c, [b(700, 100, 100, 98, 99), b(1000, 100, 101, 99.5, 100.5)]).R], [0.5]);
  const fill = b(1000, 100, 100.4, 99.6, 100.2);   // the entry reached
  // stop and target in one candle: the stop
  const both = J.outcome(c, [fill, b(1300, 100, 103, 98.5, 101)]); assert.equal(both.status, 'stop'); assert.equal(both.R, -1);
  assert.deepEqual(J.outcome(c, [fill, b(1300, 100, 102.5, 99.5, 102)]), { status: 'target', R: 2, fillT: 1000, endT: 1300, best: 2, n: 2 });
  assert.equal(J.outcome(c, [fill, b(1300, 98, 98.5, 97, 98)]).R, -2, 'a gap through the stop fills at the open');
  assert.equal(J.outcome(c, [b(1300, 100, 101, 99.5, 100.6, { live: true })]).R, null, 'a forming candle is not read');
  const sell = { at, side: 'sell', entry: 100, stop: 101, target: null }; assert.equal(J.outcome(sell, [b(1000, 100, 100.2, 97, 97.5)]).R, 2.5);
  assert.equal(J.outcome({ ...c, action: 'skip' }, [fill, b(1300, 100, 102.5, 99.5, 102)]).status, 'target', 'a skip is scored as if taken');
});

test('stats: taken vs skipped, Welch t, too few to judge under 20 a side, by method and confidence', () => {
  const row = (action, R, method = 'CF', confidence = 3) => ({ action, R, method, confidence, status: R > 0 ? 'target' : 'stop' });
  const few = J.stats([row('take', 2), row('skip', -1), { action: 'take', status: 'open', R: 0.3 }]);
  assert.equal(few.all.judged, false); assert.match(few.all.verdict, /too few to judge \(1 taken, 1 skipped/); assert.equal(few.open, 1); assert.equal(few.resolved, 2);
  const rows = []; for (let i = 0; i < 20; i++) { rows.push(row('take', i % 2 ? 2 : -1, 'zone', 5)); rows.push(row('skip', i % 4 ? -1 : 2, 'CF', 1)); }
  const s = J.stats(rows); assert.equal(s.all.judged, true); assert.equal(s.all.taken.n, 20); assert.equal(s.all.taken.meanR, 0.5); assert.equal(s.all.skipped.meanR, -0.25);
  const t = J.welch(rows.filter((x) => x.action === 'take').map((x) => x.R), rows.filter((x) => x.action === 'skip').map((x) => x.R));
  assert.equal(s.all.t, +t.toFixed(3)); assert.ok(t > 1.5);
  assert.deepEqual(s.byMethod.map((g) => g.key), ['CF', 'zone']); assert.deepEqual(s.byConfidence.map((g) => g.key), ['1', '5']);
  assert.match(s.byMethod[0].verdict, /too few/); assert.doesNotMatch(JSON.stringify(s), /proven|is an edge/);
});

test('review: the entry must be reached after the stamp; a call written with the price already past it books nothing', () => {
  // price 4000 at the stamp; a "buy 3900, stop 3890, target 4000" would have booked +10R on the next candle (its target was
  // already behind the price): the entry is never reached from the stamp on, so it waits and is not scored
  const at = 1000, c = { at, side: 'buy', entry: 3900, stop: 3890, target: 4000 }, b = (time, o, h, l, cl) => ({ time, open: o, high: h, low: l, close: cl });
  const later = [b(1000, 4000, 4003, 3998, 4001), b(1300, 4001, 4004, 3999, 4002)];
  assert.deepEqual([J.outcome(c, later).status, J.outcome(c, later).R], ['pending', null]);
  assert.equal(J.stats([{ action: 'take', ...J.outcome(c, later) }]).pending, 1);
  assert.equal(J.stats([{ action: 'take', ...J.outcome(c, later) }]).resolved, 0);
  // on the candle that reaches the entry only the stop counts (its high may have come before the fill)
  const fc = J.outcome({ at, side: 'buy', entry: 100, stop: 99, target: 101 }, [b(1000, 101.5, 101.6, 99.8, 100.2)]);
  assert.equal(fc.status, 'open'); assert.equal(J.outcome({ at, side: 'buy', entry: 100, stop: 99, target: 101 }, [b(1000, 100.5, 101.6, 98.8, 100)]).R, -1);
});

test('review: a call keeps its first two weeks\' result as it ages (5-minute candles, then hourly from where they end)', () => {
  const at = 0, c = { at, side: 'buy', entry: 100, stop: 99, target: 102 }, b = (time, o, h, l, cl) => ({ time, open: o, high: h, low: l, close: cl });
  // on 5-minute candles: filled at 0, target at 600; an hourly candle from 0 holds the stop too, so read alone it says "stop"
  const fine = [b(0, 100, 100.2, 99.8, 100), b(300, 100, 101, 99.5, 100.8), b(600, 100.8, 102.2, 100.6, 102)];
  const hourly = [b(0, 100, 102.2, 98.9, 101)];
  assert.equal(J.outcome(c, fine).status, 'target'); assert.equal(J.outcome(c, hourly).status, 'stop');
  assert.equal(J.outcome(c, J.joinBars(fine, hourly, 300)).status, 'target');
  assert.deepEqual(J.joinBars(fine, [...hourly, b(3600, 1, 1, 1, 1)], 300).map((x) => x.time), [0, 300, 600, 3600]);
  assert.deepEqual(J.joinBars([], hourly), [], 'never the hourly candles alone');
  const PAGE = rd('../market-structure.html'), blk = PAGE.slice(PAGE.indexOf('<script id="ms-jr-js">'), PAGE.indexOf('</script>', PAGE.indexOf('<script id="ms-jr-js">')));
  assert.match(blk, /J\.joinBars\(fine, coarse, 300\)/); assert.doesNotMatch(blk, /now - c\.at > 14 \* 86400 \? '1h'/);
});

test('review: a stored file of another shape is never saved over', async () => {
  _reset(); const blob = { list: async ({ prefix }) => ({ blobs: [{ pathname: prefix, url: 'https://x.invalid/' + prefix }] }), put: async () => { throw new Error('must not write'); } };
  const store = require('../api/journal.js').blobStore({ BLOB_READ_WRITE_TOKEN: 't' }, { blob, fetch: async (u) => { assert.match(String(u), /cache=0/); return { ok: true, json: async () => ({ calls: [1, 2] }) }; } });
  await assert.rejects(store.get('owner'), /another shape/);
  const r = await call(store, 'POST', OWNER, { call: BUY }); assert.equal(r.code, 500);
});

test('wiring: routed on the Worker and Vercel, the store read from the origin, the page button and card, no browser storage', () => {
  assert.ok(JSON.parse(rd('../vercel.json')).functions['api/journal.js']);
  assert.match(rd('../cloudflare/src/worker.mjs'), /import journal from '\.\.\/\.\.\/api\/journal\.js'/);
  const API = rd('../api/journal.js'); assert.match(API, /DIR = 'journal\/'/); assert.match(API, /\$\{DIR\}\$\{u\}\.json/); assert.match(API, /searchParams\.set\('cache', '0'\)/);
  const PAGE = rd('../market-structure.html'), blk = PAGE.slice(PAGE.indexOf('<script id="ms-jr-js">'), PAGE.indexOf('</script>', PAGE.indexOf('<script id="ms-jr-js">')));
  assert.match(PAGE, /<script src="\/assets\/ms-journal\.js" defer><\/script>/); assert.match(blk, /ms-jr-btn/); assert.match(blk, /My calls/); assert.match(blk, /Log a call/);
  assert.doesNotMatch(blk, /localStorage|sessionStorage|ctrader|\/api\/mosha|council\//);
  assert.match(PAGE, /html\[data-role="public"\] :is\(#ms-jr-btn, #ms-jr, #ms-jr-card(, span\.dc)?\)/);
  const css = PAGE.slice(PAGE.indexOf('<style id="ms-jr-css">'), PAGE.indexOf('</style>', PAGE.indexOf('<style id="ms-jr-css">')));
  for (const m of css.matchAll(/(\d+(?:\.\d+)?)px var\(--sans\)|font-size: (\d+(?:\.\d+)?)px/g)) assert.ok(+(m[1] || m[2]) >= 12, m[0]);
  assert.match(css, /pointer: coarse[^}]*min-height: 44px/);
});

test('review: two accounts writing at the same moment both keep their call (one file per account)', async () => {
  const s = mk(5);
  const [a, b] = await Promise.all([call(s, 'POST', FRED, { call: BUY }), call(s, 'POST', OWNER, { call: { ...BUY, action: 'skip' } })]);
  assert.equal(a.code, 200); assert.equal(b.code, 200);
  assert.equal(s.of('fred').length, 1); assert.equal(s.of('owner').length, 1);
  assert.equal(require('../api/journal.js').pathOf('fred'), 'journal/fred.json');
});

test('review: one account\'s writes run one at a time, so two calls at once are both kept and one signal takes one call', async () => {
  const s = mk(5), sig = { ...BUY, source: { desk: 'eg', id: 'eurusd:x-1' }, market: 'xau' };
  const [a, b] = await Promise.all([call(s, 'POST', OWNER, { call: BUY }), call(s, 'POST', OWNER, { call: { ...BUY, action: 'skip' } })]);
  assert.equal(a.code, 200); assert.equal(b.code, 200); assert.equal(s.of('owner').length, 2);
  const [c, d] = await Promise.all([call(s, 'POST', OWNER, { call: sig }), call(s, 'POST', OWNER, { call: { ...sig, action: 'skip' } })]);
  assert.deepEqual([c.code, d.code].sort(), [200, 409]); assert.equal(s.of('owner').length, 3);
});

test('review: members filling their own files never close the journal to the owner; posts are limited per hour', async () => {
  const s = mk(); const full = Array.from({ length: 2000 }, (_, i) => ({ id: 'm' + i, u: 'fred', at: 1, action: 'take' }));
  await s.put('fred', full);
  assert.equal((await call(s, 'POST', FRED, { call: BUY })).code, 409, 'the member\'s own cap');
  assert.equal((await call(s, 'POST', OWNER, { call: BUY })).code, 200, 'the owner is not refused');
  _reset(); const codes = []; for (let i = 0; i < 61; i++) codes.push((await call(s, 'POST', OWNER, { note: { id: 'none', text: 'x' } })).code);
  assert.equal(codes.filter((c) => c === 429).length, 1); assert.equal(codes[60], 429);
  assert.equal((await call(s, 'POST', FRED, { note: { id: 'none', text: 'x' } })).code, 404, 'another account has its own limit');
});

test('review: what withdrawn calls went on to do is reported beside the split, never in it', () => {
  const rows = [{ action: 'take', R: 2, status: 'target' }, { action: 'take', R: -1, status: 'stop', withdrawn: 9 }, { action: 'skip', R: 2, status: 'target', withdrawn: 9 }];
  const s = J.stats(rows); assert.equal(s.all.taken.n, 1); assert.equal(s.withdrawn, 2);
  assert.equal(s.withdrawnOut.taken.n, 1); assert.equal(s.withdrawnOut.taken.meanR, -1); assert.equal(s.withdrawnOut.skipped.meanR, 2);
});
