// node --test tests/live-account.test.mjs: the live account (council/live.mjs, 27 Nov 2026). Off unless three locks agree; the one
// live account the owner names; 0.5 % a trade; no new order past the daily stop; every order with its stop; nothing else reaches it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RULES, LIVE_IDS, BO8, signalAt, step as nqStep } from '../council/nq-demo.mjs';
import { step as vbStep } from '../council/vb-demo.mjs';
import { liveConfig, pickLive, dayGate, LIVE } from '../council/live.mjs';
import { PT, session, LIVE_HOST, DEMO_HOST, relative } from '../council/ctrader-mirror.mjs';
import { NQ2_GOLD } from '../council/edge-desks-2.mjs';
import { G as BO8_G } from '../research/edge/gold-bo8-exec/orders.mjs';
import { prep, toArrays } from '../research/edge/auto-researcher/engine.mjs';

const H = 3600, T0 = Date.UTC(2026, 5, 1) / 1000;
function series(n = 1700, seed = 5) { const out = []; let px = 24000, s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < n; k++) { const o = px, burst = r() < 0.06 ? 160 : 0; px += (r() - 0.47) * 70 + burst * (r() - 0.3); const hi = Math.max(o, px) + r() * 12, lo = Math.min(o, px) - r() * 12; out.push([T0 + k * H, +o.toFixed(2), +hi.toFixed(2), +lo.toFixed(2), +px.toFixed(2)]); }
  return out; }
const ALL = series(), DALL = prep(toArrays(ALL.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }))), 'nas100');
const I1 = (() => { for (let i = 900; i < ALL.length - 2; i++) if (signalAt(DALL, RULES.l1.g, i, ALL[i + 1][0]) && !signalAt(DALL, RULES.l5.g, i, ALL[i + 1][0])) return i; })();
const feedAt = (i) => async (now, mk) => (mk === 'nas100' ? ALL.slice(i - 899, i + 2).map((r, k, a) => (k === a.length - 1 ? [r[0], r[1], r[1] + 1, r[1] - 1, r[1]] : r)) : []);

function broker({ accounts, balance = 1000000 } = {}) {
  const b = { sent: [], urls: [], positions: [], px: ALL[I1 + 1][1], next: 1 };
  b.WS = class { constructor(url) { b.urls.push(url); setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); b.sent.push(m); if (m.payloadType === PT.HEARTBEAT) return;
      const r = (payloadType, payload) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), 0), P = m.payload || {};
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: accounts });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.TRADER_REQ: return r(PT.TRADER_RES, { trader: { balance, moneyDigits: 2 } });
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: [{ symbolId: 9, symbolName: 'NAS100' }] });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: [{ symbolId: 9, digits: 2, stepVolume: 1, minVolume: 1, maxVolume: 100000 }] });
        case PT.NEW_ORDER_REQ: { const sl = P.relativeStopLoss / 100000, tp = P.relativeTakeProfit / 100000, p = { positionId: 9000 + b.next++, price: b.px, stopLoss: +(b.px - sl).toFixed(2), takeProfit: +(b.px + tp).toFixed(2), tradeData: { volume: P.volume, tradeSide: P.tradeSide, label: P.label, comment: P.comment } };
          b.positions.push(p); r(PT.EXECUTION_EVENT, { executionType: 2 }); return r(PT.EXECUTION_EVENT, { executionType: 3, deal: { executionPrice: b.px }, position: { positionId: p.positionId, price: b.px } }); }
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: b.positions.map((x) => ({ ...x })), order: [] });
        default: return r(PT.ERROR_RES, { errorCode: 'X' });
      } }
    close() {} };
  return b;
}
const DEMO = { ctidTraderAccountId: 77, traderLogin: 10152146, isLive: false }, LIVEACC = { ctidTraderAccountId: 88, traderLogin: 5554321, isLive: true };
const ENV = { CTRADER_LIVE: 'on', CTRADER_CLIENT_ID: 'id', CTRADER_CLIENT_SECRET: 'sec', CTRADER_ACCESS_TOKEN: 'tok' };
const CFG = { live: { on: true, account: '*4321', risk: 0.005, dayStop: 0.15 } };
function setup(cfg) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-')); if (cfg) fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg)); return dir; }
const go = (dir, b, extra = {}) => nqStep({ env: ENV, dir, WS: b.WS, clock: () => (ALL[I1 + 1][0] + 40) * 1000, bars: feedAt(I1), log: () => {}, pause: async () => {}, mode: 'live', ...extra });
const news = (b) => b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).map((m) => m.payload);

test('off unless all three locks agree: config.live on with an account, CTRADER_LIVE=on, one live account ending in those digits', async () => {
  for (const cfg of [null, { live: { on: false, account: '*4321' } }, { live: { on: true } }, { live: { on: true, account: '4321' } }]) {
    const b = broker({ accounts: [DEMO, LIVEACC] }), out = await go(setup(cfg), b); assert.equal(out.skipped, 'off'); assert.equal(b.sent.length, 0); }
  { const b = broker({ accounts: [DEMO, LIVEACC] }), out = await go(setup(CFG), b, { env: { ...ENV, CTRADER_LIVE: 'off' } }); assert.equal(out.skipped, 'off'); assert.equal(b.sent.length, 0); }
  for (const accounts of [[DEMO], [DEMO, { ...LIVEACC, traderLogin: 9999999 }], [LIVEACC, { ...LIVEACC, ctidTraderAccountId: 89, traderLogin: 1114321 }], [{ ...DEMO, traderLogin: 4444321 }]]) {
    const b = broker({ accounts }), out = await go(setup(CFG), b); assert.equal(out.error, true); assert.equal(news(b).length, 0); assert.ok(!b.sent.some((m) => m.payloadType === PT.ACCOUNT_AUTH_REQ), 'no account authorised'); }
  assert.equal(pickLive([DEMO, LIVEACC], '4321').ctidTraderAccountId, 88); assert.equal(pickLive([{ ...DEMO, traderLogin: 4321 }], '4321'), null, 'a demo account is never picked');
  { const b = broker({ accounts: [DEMO, LIVEACC] }); await vbStep({ env: ENV, dir: setup(null), WS: b.WS, clock: () => Date.UTC(2026, 10, 30, 0, 5) , bars: async () => [], log: () => {}, mode: 'live' }); assert.equal(b.sent.length, 0); }
});
test('a live order: the live host, the named account, label lv-, 0.5 % of the balance, its stop and target on the order; its own record', async () => {
  const dir = setup(CFG), b = broker({ accounts: [DEMO, LIVEACC] }), sg = signalAt(DALL, RULES.l1.g, I1, ALL[I1 + 1][0]);
  const out = await go(dir, b); assert.deepEqual(out.did, ['l1 bought']);
  assert.ok(b.urls.every((u) => u === LIVE_HOST)); const auth = b.sent.find((m) => m.payloadType === PT.ACCOUNT_AUTH_REQ).payload; assert.equal(auth.ctidTraderAccountId, 88);
  const o = news(b); assert.equal(o.length, 1); assert.equal(o[0].label, 'lv-nq-l1'); assert.equal(o[0].ctidTraderAccountId, 88);
  assert.equal(o[0].relativeStopLoss, relative(sg.dist, 2)); assert.ok(o[0].relativeStopLoss > 0); assert.equal(o[0].volume, Math.floor(10000 * 0.005 / sg.dist * 100), '0.5 % of the balance');
  const J = JSON.parse(fs.readFileSync(path.join(dir, 'live', 'nq.json'), 'utf8')); assert.equal(J.trades[0].status, 'open'); assert.ok(J.trades[0].stop < J.trades[0].fill); assert.ok(!fs.existsSync(path.join(dir, 'nq', 'trades.json')), 'the demo record is untouched');
});
test('the daily stop: once the balance is 15 % under the day\'s first balance no new order goes out', async () => {
  const dir = setup(CFG), now = ALL[I1 + 1][0] + 40; fs.mkdirSync(path.join(dir, 'live')); fs.writeFileSync(path.join(dir, 'live', 'day.json'), JSON.stringify({ day: new Date(now * 1000).toISOString().slice(0, 10), start: 10000 / 0.84 }));
  const b = broker({ accounts: [DEMO, LIVEACC] }), out = await go(dir, b); assert.deepEqual(out.did, ['l1 daily stop']); assert.equal(news(b).length, 0);
  const d2 = setup(); assert.ok(dayGate(d2, 10000, now, 0.15).ok, 'the first balance of the day is its start'); assert.ok(dayGate(d2, 8600, now, 0.15).ok, '14 % down: still trading');
  assert.equal(dayGate(d2, 8500, now, 0.15).ok, false, '15 % down: stopped'); assert.ok(dayGate(d2, 8500, now + 86400, 0.15).ok, 'a new UTC day starts again');
  assert.equal(liveConfig(CFG).dayStop, 0.15); assert.equal(liveConfig(CFG).risk, 0.005); assert.equal(liveConfig({ live: { on: true, account: '*4321', risk: 0.05 } }).risk, LIVE.maxRisk, 'never over 1 % a trade');
});
test('demo stays demo: session() refuses the live host, the demo jobs still use the demo host, and the live rules are the tested genomes', async () => {
  assert.throws(() => session(class { constructor() {} }, (x) => x, LIVE_HOST), /non-demo/);
  const dir = setup(), b = broker({ accounts: [DEMO] }); fs.mkdirSync(path.join(dir, 'ctrader')); fs.writeFileSync(path.join(dir, 'ctrader', 'mirror-accounts.json'), JSON.stringify({ groups: [{ account: '10152146', books: ['lit'] }] }));
  await go(dir, b, { mode: 'demo', env: { CTRADER_MIRROR: 'on', CTRADER_ENV: 'demo', CTRADER_CLIENT_ID: 'id', CTRADER_CLIENT_SECRET: 's', CTRADER_ACCESS_TOKEN: 't' } }); assert.ok(b.urls.length && b.urls.every((u) => u === DEMO_HOST)); assert.equal(news(b)[0].label, 'nq-l1');
  assert.deepEqual(LIVE_IDS, ['l1', 'l5', 'uj', 'bo8']); const { mk, ...g } = BO8_G; assert.deepEqual(BO8.g, g); assert.equal(BO8.market, 'xau'); assert.deepEqual(BO8.g, NQ2_GOLD.g);
  for (const f of ['council/ctrader-mirror.mjs', 'council/gotobi.mjs', 'council/dom-demo.mjs', 'council/ctrader-suite.mjs', 'council/gotobi-due.mjs', 'council/test-order.mjs']) assert.ok(!/from '\.\/live\.mjs'/.test(fs.readFileSync(f, 'utf8')), f + ' never reaches the live account');
  const users = fs.readdirSync('council').filter((f) => f.endsWith('.mjs') && /liveSession|LIVE_HOST|from '\.\/live\.mjs'/.test(fs.readFileSync('council/' + f, 'utf8'))).sort(); assert.deepEqual(users, ['ctrader-mirror.mjs', 'live.mjs', 'nq-demo.mjs', 'vb-demo.mjs'], 'only the live module, the two jobs and the session code name the live host');
});
