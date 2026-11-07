// node --test tests/ctrader-symbols.test.mjs — the broker symbol-spec dump (council/ctrader-symbols.mjs) against a fake cTrader:
// read messages only, demo only, the specs the mirror's risk sizing needs, and the Trader's spread format kept
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { symbolSpecs, lastTick, chainRate, observedValue, scheduleText, modeName, SAMPLE } from '../council/ctrader-symbols.mjs';
import { costModel } from '../council/fills.mjs';
import { SYMBOLS } from '../council/ctrader-mirror.mjs';
const require = createRequire(import.meta.url);
const { _t } = require('../api/ctrader-link.js');

const ENV = { CTRADER_MIRROR: 'on', CTRADER_CLIENT_ID: ' cid ', CTRADER_CLIENT_SECRET: 'sec', CTRADER_ACCESS_TOKEN: 'AT-secret', CTRADER_ACCOUNT_ID: '4242', CTRADER_ENV: 'demo' };
const NOW = 1794000000000;   // ms
const ASSETS = [{ assetId: 1, name: 'USD' }, { assetId: 2, name: 'EUR' }, { assetId: 3, name: 'XAU' }, { assetId: 4, name: 'CAD' }, { assetId: 5, name: 'US100' }, { assetId: 6, name: 'AUD' }, { assetId: 7, name: 'US30' }, { assetId: 8, name: 'GBP' }];
const LIGHT = [{ symbolId: 41, symbolName: 'XAUUSD', baseAssetId: 3, quoteAssetId: 1, description: 'Gold' }, { symbolId: 1, symbolName: 'EURUSD', baseAssetId: 2, quoteAssetId: 1 },
  { symbolId: 5, symbolName: 'USDCAD', baseAssetId: 1, quoteAssetId: 4 }, { symbolId: 101, symbolName: 'US100', baseAssetId: 5, quoteAssetId: 1 },
  { symbolId: 103, symbolName: 'US30', baseAssetId: 7, quoteAssetId: 1 }, { symbolId: 6, symbolName: 'AUDUSD', baseAssetId: 6, quoteAssetId: 1 },
  { symbolId: 2, symbolName: 'GBPUSD', baseAssetId: 8, quoteAssetId: 1, enabled: false }];
const FX = { lotSize: 10000000, minVolume: 100000, stepVolume: 100000, maxVolume: 1000000000, digits: 5, pipPosition: 4 };
const FULL = { 41: { lotSize: 10000, minVolume: 100, stepVolume: 100, maxVolume: 10000000, digits: 2, pipPosition: 1, tradingMode: 0, leverageId: 9, scheduleTimeZone: 'UTC',
    schedule: [{ startSecond: 82800, endSecond: 165600 }], holiday: [{ name: 'Christmas', holidayDate: 20812, isRecurring: true, startSecond: 0, endSecond: 86400 }], swapLong: -40.1, swapShort: 12.3 },
  1: FX, 5: FX, 6: FX, 101: { lotSize: 100, minVolume: 10, stepVolume: 10, maxVolume: 50000, digits: 2, pipPosition: 0, tradingMode: 'ENABLED', measurementUnits: 'points', leverageId: 9 },
  103: { lotSize: 100, minVolume: 10, stepVolume: 10, maxVolume: 50000, digits: 2, pipPosition: 0, tradingMode: 3 } };
const PX = { 41: [4000.10, 4000.40], 1: [1.10000, 1.10006], 5: [1.38000, 1.38010], 6: [0.65000, 0.65002], 101: [25000.0, 25001.0], 103: [47000, 47002] };
// relative-encoded ticks, newest first (the decoder must not depend on the order)
const ticks = (px, now) => { const pts = [[now - 2000, px], [now - 9000, px - 0.5], [now - 60000, px + 0.25]].map(([t, p]) => [t, Math.round(p * 1e5)]);
  return pts.map(([t, p], i) => (i ? { timestamp: t - pts[i - 1][0], tick: p - pts[i - 1][1] } : { timestamp: t, tick: p })); };

function fakeBroker({ live = false, deposit = 1, quiet = false } = {}) {
  const sent = [];
  class WS { constructor(url) { this.url = url; setTimeout(() => this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); sent.push({ url: this.url, ...m }); const P = _t.PT, p = m.payload;
      const r = (t, pl) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType: t, payload: pl }) }), 0);
      switch (m.payloadType) {
        case P.APP_AUTH_REQ: return r(P.APP_AUTH_RES, {});
        case P.ACCOUNTS_BY_TOKEN_REQ: return r(P.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 4242, traderLogin: 10152028, isLive: live, brokerTitleShort: 'Fusion Markets' }] });
        case P.ACCOUNT_AUTH_REQ: return r(P.ACCOUNT_AUTH_RES, {});
        case P.TRADER_REQ: return r(P.TRADER_RES, { trader: { balance: 5000000, moneyDigits: 2, depositAssetId: deposit, leverageInCents: 50000 } });
        case P.ASSET_LIST_REQ: return r(P.ASSET_LIST_RES, { asset: ASSETS });
        case P.SYMBOLS_LIST_REQ: return r(P.SYMBOLS_LIST_RES, { symbol: LIGHT });
        case P.SYMBOL_BY_ID_REQ: return r(P.SYMBOL_BY_ID_RES, { symbol: p.symbolId.map((id) => ({ symbolId: id, ...FULL[id] })) });
        case P.GET_TICKDATA_REQ: { if (quiet || !PX[p.symbolId]) return r(P.GET_TICKDATA_RES, { tickData: [], hasMore: false });
          return r(P.GET_TICKDATA_RES, { tickData: ticks(PX[p.symbolId][p.type === 2 ? 1 : 0], p.toTimestamp), hasMore: false }); }
        case P.SYMBOLS_FOR_CONVERSION_REQ: { // the chain from the quote asset to the account currency, through USD
          const L = (id) => LIGHT.find((x) => x.symbolId === id), via = { 4: [L(5)], 1: [] }[p.firstAssetId] || [];
          return r(P.SYMBOLS_FOR_CONVERSION_RES, { symbol: p.lastAssetId === 6 ? [...via, L(6)] : via }); }
        case P.EXPECTED_MARGIN_REQ: { const mid = PX[p.symbolId] ? PX[p.symbolId][0] : 0, units = p.volume[0] / 100;
          return r(P.EXPECTED_MARGIN_RES, { margin: [{ volume: p.volume[0], buyMargin: Math.round((units * mid / 500) * 100), sellMargin: 1 }], moneyDigits: 2 }); }
        case P.GET_DYNAMIC_LEVERAGE_REQ: return r(P.GET_DYNAMIC_LEVERAGE_RES, { leverage: { leverageId: p.leverageId, tiers: [{ volume: 100000000, leverage: 500 }] } });
        default: return r(P.ERROR_RES, { errorCode: 'UNEXPECTED' });
      } }
    close() {} }
  return { WS, sent };
}
const run = (b, o = {}) => symbolSpecs({ env: ENV, WS: b.WS, now: NOW, sleep: async () => {}, ...o });

test('decoders: relative ticks in either order, conversion chains both ways, schedule text, trading modes', () => {
  const t = ticks(4000.1, NOW); assert.deepEqual(lastTick(t), { ts: NOW - 2000, px: 4000.1 });
  // the same ticks encoded oldest first
  const abs = []; let ts = 0, px = 0; ticks(1.1, NOW).forEach((d, i) => { ts = i ? ts + d.timestamp : d.timestamp; px = i ? px + d.tick : d.tick; abs.push([ts, px]); });
  abs.reverse(); const enc = abs.map(([a, p], i) => (i ? { timestamp: a - abs[i - 1][0], tick: p - abs[i - 1][1] } : { timestamp: a, tick: p }));
  assert.deepEqual(lastTick(enc), { ts: NOW - 2000, px: 1.1 }); assert.equal(lastTick([]), null);
  const usdcad = { baseAssetId: 1, quoteAssetId: 4 }, audusd = { baseAssetId: 6, quoteAssetId: 1 }, mid = (s) => (s === usdcad ? 1.25 : 0.8);
  assert.equal(chainRate([usdcad], 4, 1, mid), 0.8);                // 1 CAD = 1/1.25 USD
  assert.equal(chainRate([usdcad], 1, 4, mid), 1.25);
  assert.equal(chainRate([usdcad, audusd], 4, 6, mid), 1);          // CAD -> USD -> AUD: 0.8 / 0.8
  assert.equal(chainRate([audusd], 4, 6, mid), null);               // a broken chain is not guessed
  assert.equal(scheduleText([{ startSecond: 82800, endSecond: 165600 }]), 'Sun 23:00–Mon 22:00');
  assert.equal(modeName(0), 'ENABLED'); assert.equal(modeName(3), 'CLOSE_ONLY_MODE'); assert.equal(modeName('ENABLED'), 'ENABLED'); assert.equal(modeName(undefined), 'ENABLED');
  // the demo's own deals: 0.02 lot of a 100-unit lot, 10-point move, $20 gross -> $100 a point a lot; a cent-sized deal is left out
  assert.deepEqual(observedValue([{ symbol: 'XAUUSD', side: 'buy', lots: 0.02, entry: 4000, exit: 4010, gross: 20 }, { symbol: 'XAUUSD', side: 'sell', lots: 0.01, entry: 4010, exit: 4000, gross: 10 },
    { symbol: 'XAUUSD', side: 'buy', lots: 0.01, entry: 4000, exit: 4000.3, gross: 0.3 }], 'XAUUSD'), { n: 2, perPointPerLot: 100 });
});

test('dumps the specs of every symbol the mirror uses: lots, assets, mode, schedule, quotes, conversion, margin; read messages only', async () => {
  const b = fakeBroker(), f = await run(b, { history: [{ symbol: 'US100', side: 'buy', lots: 0.5, entry: 25000, exit: 25010, gross: 5 }] });
  assert.ok(b.sent.length > 10);
  assert.ok(b.sent.every((m) => _t.READ_ONLY.has(m.payloadType)), 'only read messages');
  assert.ok(b.sent.every((m) => m.url === _t.HOSTS.demo), 'demo host only');
  assert.deepEqual(f.account, { currency: 'USD', leverage: 500 }); assert.equal(f.broker, 'Fusion Markets');
  // every market in SYMBOLS is answered: the broker name the mirror would pick, or missing (GBPUSD is disabled at this broker)
  assert.deepEqual(Object.keys(f.markets).sort(), Object.keys(SYMBOLS).sort());
  assert.equal(f.markets.xau, 'XAUUSD'); assert.equal(f.markets.gc, 'XAUUSD'); assert.equal(f.markets.nq, 'US100'); assert.equal(f.markets.gbpusd, null); assert.equal(f.markets.es, null);
  assert.deepEqual(f.missing.es, SYMBOLS.es);
  const g = f.symbols.XAUUSD;
  assert.deepEqual(g.markets, ['xau', 'gc']);
  assert.deepEqual([g.base, g.quote, g.lotSize, g.unitsPerLot, g.minLots, g.stepLots, g.maxLots, g.digits, g.pipPosition], ['XAU', 'USD', 10000, 100, 0.01, 0.01, 1000, 2, 1]);
  assert.equal(g.tradingMode, 'ENABLED'); assert.equal(g.scheduleText, 'Sun 23:00–Mon 22:00'); assert.equal(g.scheduleTimeZone, 'UTC'); assert.deepEqual(g.holidays[0], { name: 'Christmas', date: '2026-12-25', recurring: true, start: 0, end: 86400 });
  assert.deepEqual(g.leverageTiers, [{ volume: 100000000, leverage: 500 }]); assert.equal(g.swap.long, -40.1);
  assert.equal(g.bid, 4000.1); assert.equal(g.ask, 4000.4); assert.equal(g.spread, 0.3); assert.equal(g.quoteAt, new Date(NOW - 2000).toISOString());
  assert.equal(g.quoteToDeposit, 1); assert.equal(g.valuePerPoint, 100); assert.equal(g.pipValue, 10);
  assert.equal(g.marginPerLot, 800.02); assert.equal(Math.round(g.impliedLeverage), 500);   // 100 oz x 4000.25 / 800.02: 1:500, the account's
  // USDCAD: CAD-quoted, valued in USD along the broker's chain at its own quote (1 CAD = 1/1.38005 USD)
  const c = f.symbols.USDCAD; assert.equal(c.quote, 'CAD'); assert.ok(Math.abs(c.quoteToDeposit - 1 / 1.38005) < 1e-8);
  assert.ok(Math.abs(c.valuePerPoint - 100000 / 1.38005) < 1e-3); assert.ok(Math.abs(c.pipValue - 10 / 1.38005) < 1e-6);
  const n = f.symbols.US100; assert.deepEqual([n.quote, n.unitsPerLot, n.valuePerPoint, n.minLots, n.stepLots, n.measurementUnits], ['USD', 1, 1, 0.1, 0.1, 'points']);
  assert.deepEqual(n.observed, { n: 1, perPointPerLot: 1, matches: true });
  assert.equal(f.symbols.US30.tradingMode, 'CLOSE_ONLY_MODE');
  // the sample: 0.20% (1R) of $50k = $100. Gold, 32-point stop: $3,200 a lot -> 0.03 lot; US100, 160 points at $1: 0.625 -> 0.6 lot
  assert.deepEqual(f.sample, { balance: 50000, riskPct: 0.2, riskCash: 100, maxLots: 5 });
  assert.deepEqual(g.sample, { stop: SAMPLE.stops.xau, lots: 0.03, volume: 300, riskCash: 100, perLot: 3200, risked: 96 });
  assert.deepEqual(n.sample, { stop: 160, lots: 0.6, volume: 60, riskCash: 100, perLot: 160, risked: 96 });
  assert.equal(f.symbols.EURUSD.sample.lots, 0.5);   // 20 pips = $200 a lot
  // the Trader's cost model reads the broker spread from this file, unchanged format
  const cm = costModel({ xau: { group: 'Metals', spot: true } }, { symbols: SYMBOLS, brokerInfo: f });
  assert.equal(cm.xau.spread, 0.3); assert.equal(cm.xau.src, 'broker');
  // nothing that identifies the account or a token
  assert.doesNotMatch(JSON.stringify(f), /4242|10152028|AT-secret|sec\b/);
});

test('market shut: the last spread and rate are kept; an AUD account values gold in AUD along the broker chain', async () => {
  const first = await run(fakeBroker());
  const f = await run(fakeBroker({ quiet: true }), { prev: first, now: NOW + 86400e3 });
  assert.equal(f.symbols.XAUUSD.spread, 0.3); assert.equal(f.symbols.XAUUSD.quoteAt, first.symbols.XAUUSD.quoteAt);
  assert.equal(f.symbols.USDCAD.quoteToDeposit, first.symbols.USDCAD.quoteToDeposit); assert.equal(f.symbols.USDCAD.rateAt, first.symbols.USDCAD.rateAt);
  // AUD account: 1 USD = 1/0.65001 AUD; the $50k sample is A$50,000: gold's 32-point stop costs A$4,923 a lot -> 0.02 lot (0.03 if valued in USD)
  const a = await run(fakeBroker({ deposit: 6 }));
  assert.equal(a.account.currency, 'AUD'); assert.ok(Math.abs(a.symbols.XAUUSD.quoteToDeposit - 1 / 0.65001) < 1e-6);
  assert.equal(a.symbols.XAUUSD.sample.lots, 0.02);
  assert.ok(Math.abs(a.symbols.USDCAD.quoteToDeposit - 1 / 1.38005 / 0.65001) < 1e-6);   // CAD -> USD -> AUD
});

test('demo only: a live account is refused, and nothing runs when the mirror is off or not demo', async () => {
  const b = fakeBroker({ live: true }); const f = await run(b);
  assert.match(f.error, /not a demo/); assert.ok(b.sent.every((m) => m.payloadType !== _t.PT.ACCOUNT_AUTH_REQ));
  assert.equal(await run(fakeBroker(), { env: { ...ENV, CTRADER_MIRROR: 'off' } }), null);
  assert.equal(await run(fakeBroker(), { env: { ...ENV, CTRADER_ENV: 'live' } }), null);
  // the read session refuses every trading message (new order, amend, cancel, close)
  const s = _t.session(fakeBroker().WS, _t.HOSTS.demo);
  for (const pt of [2106, 2108, 2109, 2110, 2111]) await assert.rejects(s.send(pt, {}), /not a read/);
  s.close();
});
