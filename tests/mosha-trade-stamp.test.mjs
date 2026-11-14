// node --test tests/mosha-trade-stamp.test.mjs: the server's time stamps on a Mosha lesson's trade levels (14 Nov 2026), which
// let Luxus's record (assets/mosha-record.js) tell levels written down before the result from levels filled in afterwards. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../api/mosha-lessons.js'), R = require('../assets/mosha-record.js');

const ENV = { SESSION_SECRET: 'a-test-session-secret-0123456789' };
const T0 = Date.UTC(2026, 10, 13, 8, 0, 0);          // ms
const mk = () => { let db = [], bk = null; return { get: async () => JSON.parse(JSON.stringify(db)), put: async (v) => { db = JSON.parse(JSON.stringify(v)); }, getBook: async () => bk, putBook: async (v) => { bk = v; }, seed: (v) => { db = JSON.parse(JSON.stringify(v)); }, putImg: async () => {}, getImg: async () => null, delImg: async () => {}, peek: () => db }; };
const LUXUS = { u: 'luxus', name: 'Luxus', role: 'viewer', mosha: 'teach' };
const call = async (store, body, nowMs) => { const out = {}; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; }, send: () => out };
  await L.handle({ method: 'POST', body, query: {}, headers: {} }, res, { env: ENV, store, who: async () => LUXUS, sameOrigin: () => true, now: nowMs }); return out; };
const S = (ms) => Math.floor(ms / 1000);
const SELL = { market: 'xau', side: 'sell', at: S(T0), entry: 4100, stop: 4110, target: 4070 };

test('add: the server stamps setAt and firstAt with its own clock; stamps the page sends are dropped', async () => {
  const st = mk(), now = T0 + 60e3;
  const r = await call(st, { add: { note: 'a sell', trade: { ...SELL, setAt: 1, firstAt: 1, exitSetAt: 1 } } }, now);
  assert.equal(r.code, 200); const t = r.body.lesson.trade;
  assert.equal(t.setAt, S(now)); assert.equal(t.firstAt, S(now)); assert.equal(t.exitSetAt, undefined);
  const w = await call(st, { add: { note: 'with exit', trade: { ...SELL, exit: 4090, exitAt: S(T0) + 3600 } } }, T0 + 7200e3);
  assert.equal(w.body.lesson.trade.exitSetAt, S(T0 + 7200e3), 'an exit given with the lesson is stamped too');
  const n = await call(st, { add: { note: 'words only' } }, now); assert.equal(n.body.lesson.trade, null);
});

test('edit: levels move setAt (firstAt kept); an exit alone stamps exitSetAt only; an unchanged edit moves nothing', async () => {
  const st = mk(), t1 = T0 + 60e3;
  const id = (await call(st, { add: { note: 'a sell', trade: SELL } }, t1)).body.lesson.id;
  const ex = await call(st, { edit: { id, trade: { ...SELL, exit: 4090, exitAt: S(T0) + 3600, setAt: 0 } } }, T0 + 9000e3);
  let t = ex.body.lesson.trade; assert.equal(t.setAt, S(t1)); assert.equal(t.firstAt, S(t1)); assert.equal(t.exitSetAt, S(T0 + 9000e3));
  const same = await call(st, { edit: { id, note: 'more words', trade: { ...SELL, exit: 4090, exitAt: S(T0) + 3600 } } }, T0 + 9500e3);
  t = same.body.lesson.trade; assert.equal(t.setAt, S(t1)); assert.equal(t.exitSetAt, S(T0 + 9000e3));
  for (const [k, v] of [['entry', 4101], ['stop', 4112], ['target', 4060], ['side', 'buy'], ['market', 'xag'], ['at', S(T0) + 300]]) {
    const lv = k === 'side' ? { ...SELL, side: 'buy', stop: 4090, target: 4130 } : k === 'market' ? { ...SELL, market: 'xag' } : { ...SELL, [k]: v };
    const nowK = T0 + 10000e3 + Math.random() * 1e6;
    const r = await call(st, { edit: { id, trade: lv } }, nowK); assert.equal(r.code, 200, k);
    assert.equal(r.body.lesson.trade.setAt, S(nowK), k + ' moves setAt'); assert.equal(r.body.lesson.trade.firstAt, S(t1), k + ' keeps firstAt');
    await call(st, { edit: { id, trade: SELL } }, nowK + 1000);
  }
  await call(st, { edit: { id, trade: null } }, T0 + 20000e3);
  assert.equal(st.peek()[0].tradeFirstAt, S(t1), 'removed levels keep their first time on the lesson');
  const back = await call(st, { edit: { id, trade: SELL } }, T0 + 21000e3);
  assert.equal(back.body.lesson.trade.firstAt, S(t1)); assert.equal(back.body.lesson.trade.setAt, S(T0 + 21000e3));
});

test('an older lesson without stamps stays as it is until its levels change', async () => {
  const st = mk(); st.seed([{ id: 'old1', by: 'luxus', name: 'Luxus', at: new Date(T0 - 600e3).toISOString(), edited: null, title: 'old', note: 'x', lang: 'en', trade: { ...SELL }, chart: null, shots: [], thread: [] }]);
  const ex = await call(st, { edit: { id: 'old1', trade: { ...SELL, exit: 4090, exitAt: S(T0) + 3600 } } }, T0 + 9000e3);
  const t = ex.body.lesson.trade; assert.equal(t.setAt, undefined); assert.equal(t.firstAt, undefined); assert.equal(t.exitSetAt, S(T0 + 9000e3));
  const lv = await call(st, { edit: { id: 'old1', trade: { ...SELL, entry: 4101 } } }, T0 + 9900e3);
  assert.equal(lv.body.lesson.trade.setAt, S(T0 + 9900e3)); assert.equal(lv.body.lesson.trade.firstAt, undefined, 'its first time is unknown: not invented');
});

test('the record: setAt decides before / after; without it the lesson time stands and the row says so; a later exit stamp is fine', () => {
  const lesson = (trade, at = T0 - 600e3) => ({ id: 'l', by: 'luxus', title: 's', at: new Date(at).toISOString(), trade });
  const win = { ok: true, filled: true, outcome: 'target', when: S(T0) + 900, R: 3 };
  const early = R.judge(lesson({ ...SELL, setAt: S(T0) - 300 }), win); assert.equal(early.pre, true); assert.equal(early.stamped, true);
  const late = R.judge(lesson({ ...SELL, setAt: S(T0) + 1200 }), win); assert.equal(late.pre, false, 'levels filled in after the target: added afterwards');
  assert.equal(R.judge(lesson({ ...SELL, setAt: S(T0) + 900 }), win).pre, false, 'set in the candle that reached the target: not before');
  const old = R.judge(lesson({ ...SELL }), win); assert.equal(old.pre, true); assert.equal(old.stamped, false);
  const exitLater = R.judge(lesson({ ...SELL, setAt: S(T0) - 300, exit: 4075, exitAt: S(T0) + 1000, exitSetAt: S(T0) + 86400 }), win);
  assert.equal(exitLater.pre, true, 'his exit given later does not move the levels');
  const hand = { ...SELL, exit: 4090, exitAt: S(T0) + 3600 }, neither = { ok: true, filled: true, outcome: 'neither', R: null };
  assert.equal(R.judge(lesson({ ...hand, setAt: S(T0) + 4000 }), neither).pre, false, 'levels after his exit');
  assert.equal(R.judge(lesson({ ...hand, setAt: S(T0) + 60 }), neither).pre, true);
});
