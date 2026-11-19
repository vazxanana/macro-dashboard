// node --test tests/gotobi-demo.test.mjs — the gotobi fade on a cTrader DEMO account (council/gotobi.mjs, 19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RULE, LABEL, stopDistance, units, volumeOf, plan, run, priceAt, dayStart } from '../council/gotobi.mjs';
import { isGotobi } from '../council/yen-spread.mjs';
import { PT } from '../council/ctrader-mirror.mjs';
import * as STUDY from '../research/edge/gotobi/run.mjs';

test('the calendar is the study\'s: every gotobi day 2016-2027 equals research/edge/gotobi/run.mjs gotobiSet', () => {
  const study = STUDY.gotobiSet(2016, 2027); let n = 0;
  for (let t = Date.UTC(2016, 0, 1); t < Date.UTC(2027, 11, 1); t += 86400e3) { const d = new Date(t).toISOString().slice(0, 10); assert.equal(isGotobi(d), study.has(d), d); if (study.has(d)) n++; }
  assert.ok(n > 800);
});

// synthetic M5 mid candles over 40 days: each business day a known move between 00:55 and 06:00
function bars(ymd, seed = 1) { const out = []; let px = 150, s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let t = dayStart(ymd) - 40 * 86400; t < dayStart(ymd); t += 300) { const o = px; px += (r() - 0.5) * 0.06; out.push({ time: t, open: +o.toFixed(3), high: +(Math.max(o, px) + 0.01).toFixed(3), low: +(Math.min(o, px) - 0.01).toFixed(3), close: +px.toFixed(3) }); }
  return out; }

test('the stop distance D equals the study\'s stopDist on the same candles (1.5 x the median move, 20 Tokyo business days, at least 15)', () => {
  for (const day of ['2026-11-20', '2026-11-25', '2026-12-30', '2027-01-05']) {
    const b = bars(day, day.length + +day.slice(-2)), ix = STUDY.index(b.map((x) => [x.time, x.open, x.high, x.low, x.close]));
    const theirs = STUDY.stopDist((d) => STUDY.windowMove(ix, 'fade', d), day), ours = stopDistance(b, day);
    assert.ok(theirs > 0); assert.ok(Math.abs(ours - theirs) < 1e-5, `${day} ${ours} ${theirs}`);
  }
  assert.equal(stopDistance([], '2026-11-20'), null, 'no candles: no trade');
  assert.equal(RULE.entry, 55 * 60); assert.equal(RULE.exit, 6 * 3600); assert.equal(RULE.side, 'sell');
});

test('size: a stop hit loses the risk share of the balance; volume on the broker\'s step, refused under its minimum', () => {
  const u = units(100000, 0.0025, 0.2, 150); assert.equal(u, Math.floor(250 / (0.2 / 150)));   // 187,500 units
  assert.equal(volumeOf({ stepVolume: 100000, minVolume: 100000, maxVolume: 1e10 }, u), 18700000);
  assert.equal(volumeOf({ stepVolume: 100000, minVolume: 100000 }, 500), null);
});

// a fake demo broker, as tests/ctrader-mirror.test.mjs: ACCEPTED then FILLED, positions by reconcile
function broker({ live = false, dropStop = false } = {}) {
  const b = { sent: [], positions: [] };
  b.WS = class { constructor() { setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); b.sent.push(m); if (m.payloadType === PT.HEARTBEAT) return;
      const r = (payloadType, payload) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), 0);
      const P = m.payload || {};
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 77, traderLogin: 10152146, isLive: live }] });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.TRADER_REQ: return r(PT.TRADER_RES, { trader: { balance: 10000000, moneyDigits: 2 } });
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: [{ symbolId: 4, symbolName: 'USDJPY' }] });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: [{ symbolId: 4, digits: 3, lotSize: 10000000, stepVolume: 100000, minVolume: 100000, maxVolume: 1e10 }] });
        case PT.NEW_ORDER_REQ: { const pos = { positionId: 9001, price: 155.5, stopLoss: dropStop ? undefined : 155.5 + P.relativeStopLoss / 100000, tradeData: { volume: P.volume, label: P.label, comment: P.comment } }; b.positions.push(pos);
          r(PT.EXECUTION_EVENT, { executionType: 2 }); return r(PT.EXECUTION_EVENT, { executionType: 3, position: pos, deal: { executionPrice: 155.5 } }); }
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: b.positions });
        case PT.AMEND_POSITION_SLTP_REQ: { const p = b.positions.find((x) => x.positionId === P.positionId); if (p) p.stopLoss = P.stopLoss; return r(PT.EXECUTION_EVENT, { executionType: 4 }); }
        case PT.CLOSE_POSITION_REQ: { b.positions = b.positions.filter((x) => x.positionId !== P.positionId); r(PT.EXECUTION_EVENT, { executionType: 2 }); return r(PT.EXECUTION_EVENT, { executionType: 3, deal: { executionPrice: 155.38 } }); }
        default: return r(PT.ERROR_RES, { errorCode: 'X' });
      } }
    close() {} };
  return b;
}
const ENV = { CTRADER_MIRROR: 'on', CTRADER_ENV: 'demo', CTRADER_CLIENT_ID: 'id', CTRADER_CLIENT_SECRET: 'sec', CTRADER_ACCESS_TOKEN: 'tok' };
function setup() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gotobi-')); fs.mkdirSync(path.join(dir, 'ctrader'));
  fs.writeFileSync(path.join(dir, 'ctrader', 'mirror-accounts.json'), JSON.stringify({ groups: [{ account: '10152146', books: ['lit'] }, { account: '49478137', books: ['council'] }] })); return dir; }
const clockAt = (t) => { let now = t * 1000; return { clock: () => now, wait: async (u) => { if (u * 1000 > now) now = u * 1000; } }; };

test('a gotobi morning on the demo: a sell at 00:55 with its stop at entry + D, labelled "gotobi" on the LIT account, closed at 06:00', async () => {
  const dir = setup(), b = broker(), day = '2026-11-20', c = clockAt(dayStart(day) + 50 * 60), cand = bars(day, 7);
  const out = await run({ env: ENV, dir, WS: b.WS, ...c, bars: async () => cand, log: () => {}, pause: async () => {} });
  const o = b.sent.find((m) => m.payloadType === PT.NEW_ORDER_REQ).payload, D = stopDistance(cand, day);
  assert.equal(o.tradeSide, 2); assert.equal(o.orderType, 1); assert.equal(o.label, LABEL); assert.equal(o.comment, `gotobi ${day}`);
  assert.equal(o.relativeStopLoss, Math.round(D * 100000 / 100) * 100, 'the stop is D from the fill');
  assert.equal(o.ctidTraderAccountId, 77);
  const rec = out.rec; assert.equal(rec.status, 'closed'); assert.equal(rec.how, 'time exit 06:00'); assert.equal(rec.R, +((155.5 - 155.38) / D).toFixed(3));
  const file = JSON.parse(fs.readFileSync(path.join(dir, 'gotobi', 'trades.json'), 'utf8')); assert.equal(file.trades.length, 1); assert.equal(file.trades[0].day, day);
  assert.ok(!b.sent.some((m) => m.payloadType === PT.NEW_ORDER_REQ && m.payload.tradeSide === 1), 'never a buy order: the exit is a close');
});

test('RULE 1: a fill without a stop gets it by amend at entry + D; a live account, a non-gotobi day and a late start send no order', async () => {
  { const dir = setup(), b = broker({ dropStop: true }), day = '2026-11-20', c = clockAt(dayStart(day) + 50 * 60);
    const out = await run({ env: ENV, dir, WS: b.WS, ...c, bars: async () => bars(day, 7), log: () => {}, pause: async () => {} });
    const a = b.sent.find((m) => m.payloadType === PT.AMEND_POSITION_SLTP_REQ); assert.ok(a, 'amended'); assert.ok(a.payload.stopLoss > 155.5);
    assert.equal(out.rec.stopSetBy, 'amend'); }
  { const dir = setup(), b = broker({ live: true }), day = '2026-11-20', c = clockAt(dayStart(day) + 50 * 60);
    const out = await run({ env: ENV, dir, WS: b.WS, ...c, bars: async () => bars(day, 7), log: () => {}, pause: async () => {} });
    assert.equal(out.rec.status, 'error'); assert.match(out.rec.why, /not a demo account/); assert.ok(!b.sent.some((m) => m.payloadType === PT.NEW_ORDER_REQ)); }
  { const dir = setup(), b = broker(), c = clockAt(dayStart('2026-11-19') + 50 * 60);
    const out = await run({ env: ENV, dir, WS: b.WS, ...c, bars: async () => [], log: () => {} }); assert.equal(out.skipped, 'day'); assert.equal(b.sent.length, 0); }
  { const dir = setup(), b = broker(), day = '2026-11-20', c = clockAt(dayStart(day) + 58 * 60);
    const out = await run({ env: ENV, dir, WS: b.WS, ...c, bars: async () => bars(day, 7), log: () => {} }); assert.equal(out.skipped, 'late'); assert.equal(b.sent.length, 0); }
  { const dir = setup(), b = broker(), day = '2026-11-20', c = clockAt(dayStart(day) + 50 * 60);
    const out = await run({ env: { ...ENV, CTRADER_ENV: 'live' }, dir, WS: b.WS, ...c, bars: async () => bars(day, 7), log: () => {} }); assert.equal(out.skipped, 'config'); assert.equal(b.sent.length, 0); }
});

test('the module sends only the mirror\'s allowed messages and never imports the council\'s trading rules', () => {
  const src = fs.readFileSync(new URL('../council/gotobi.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from '\.\/(trader|engine|fills)\.mjs'/);
  assert.match(src, /acc\.isLive !== false/); assert.match(src, /relativeStopLoss: relative\(D, digits\)/);
  assert.equal(priceAt([{ time: 100, open: 1, close: 2 }], 100), 1);
  assert.equal(plan(dayStart('2026-11-20') + 10).gotobi, true);
});

test('the website\'s timer starts the gotobi job only on a weekday between 00:25 and 00:49 UTC, once, and only with a readable run list', async () => {
  const K = (await import('module')).createRequire(import.meta.url)('../api/_gotobi-kick.js');
  const at = (s) => Date.parse(s);
  assert.equal(K.inWindow(at('2026-11-20T00:30:00Z')), true); assert.equal(K.inWindow(at('2026-11-21T00:30:00Z')), false, 'Saturday');
  assert.equal(K.inWindow(at('2026-11-20T00:55:00Z')), false);
  assert.equal(K.decide({ runs: null, now: at('2026-11-20T00:30:00Z') }).start, false);
  assert.equal(K.decide({ runs: [{ status: 'in_progress', created_at: '2026-11-20T00:22:00Z' }], now: at('2026-11-20T00:30:00Z') }).start, false);
  assert.equal(K.decide({ runs: [{ status: 'completed', created_at: '2026-11-19T00:30:00Z' }], now: at('2026-11-20T00:30:00Z') }).start, true);
  let posted = 0; const fetchFn = async (u, o) => { if (o && o.method === 'POST') { posted++; return { status: 204, ok: true }; } return { ok: true, json: async () => ({ workflow_runs: [] }) }; };
  assert.equal((await K.run({ token: 't', fetchFn, now: at('2026-11-20T00:40:00Z') })).started, true); assert.equal(posted, 1);
  assert.equal((await K.run({ token: null, fetchFn, now: at('2026-11-20T00:40:00Z') })).started, false);
  const wf = fs.readFileSync(new URL('../.github/workflows/gotobi.yml', import.meta.url), 'utf8');
  assert.match(wf, /node council\/gotobi\.mjs data/); assert.match(wf, /cancel-in-progress: false/); assert.doesNotMatch(wf, /CTRADER_ACCOUNT_ID/, 'never the council account by default');
});
