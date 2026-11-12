// node --test tests/ctrader-symbols.test.mjs — the broker symbol-spec dump (council/ctrader-symbols.mjs) against a fake cTrader:
// read messages only, demo only, the specs the mirror's risk sizing needs, and the Trader's spread format kept
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { symbolSpecs, lastTick, chainRate, observedValue, scheduleText, modeName, impliedPrice, SAMPLE } from '../council/ctrader-symbols.mjs';
import { costModel } from '../council/fills.mjs';
import { SYMBOLS, riskVolume, specFor } from '../council/ctrader-mirror.mjs';
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

function fakeBroker({ live = false, deposit = 1, quiet = false, px = PX, full = FULL } = {}) {
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
        case P.SYMBOL_BY_ID_REQ: return r(P.SYMBOL_BY_ID_RES, { symbol: p.symbolId.map((id) => ({ symbolId: id, ...full[id] })) });
        case P.GET_TICKDATA_REQ: { if (quiet || !px[p.symbolId]) return r(P.GET_TICKDATA_RES, { tickData: [], hasMore: false });
          return r(P.GET_TICKDATA_RES, { tickData: ticks(px[p.symbolId][p.type === 2 ? 1 : 0], p.toTimestamp), hasMore: false }); }
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
  assert.deepEqual(f.sample, { balance: 50000, riskPct: 0.2, riskCash: 100, maxLots: 5, maxMarginPct: 20 });
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

// ---- the real specs: Fusion Markets cTrader demo, first ctrader/symbols.json (7 Nov 2026 21:05 UTC, market shut: no quotes) ------
const REAL = JSON.parse(fs.readFileSync(new URL('./fixtures/ctrader/symbols.json', import.meta.url), 'utf8'));

test('real Fusion specs: a lot is lotSize/100 units; index CFDs are 1 unit ($1 a point a lot), gold 100 oz, forex 100,000', () => {
  assert.equal(REAL.broker, 'Fusion Markets'); assert.deepEqual(REAL.account, { currency: 'USD', leverage: 500 }); assert.deepEqual(REAL.missing, {});
  assert.equal(REAL.markets.nq, 'NAS100');   // Fusion lists NAS100, not US100
  const want = { XAUUSD: [10000, 100, 'XAU', 'USD', 100], NAS100: [100, 1, 'NAS100', 'USD', 1], US500: [100, 1, 'US500', 'USD', 1], US30: [100, 1, 'US30', 'USD', 1],
    US2000: [100, 1, 'US2000', 'USD', 1], EURUSD: [10000000, 100000, 'EUR', 'USD', 100000], USDCAD: [10000000, 100000, 'USD', 'CAD', null] };
  for (const [n, [lot, units, base, quote, vpp]] of Object.entries(want)) {
    const e = REAL.symbols[n];
    assert.deepEqual([e.lotSize, e.unitsPerLot, e.base, e.quote, e.valuePerPoint], [lot, units, base, quote, vpp], n);
    assert.deepEqual([e.minLots, e.stepLots, e.maxLots, e.tradingMode], [0.01, 0.01, 100, 'ENABLED'], n);
  }
  // the broker's own margin for one lot, solved for the price (1:500 gold / forex, 1:100 indices): the market's price level, so
  // unitsPerLot is right (a 10-unit index lot would imply a tenth of the price)
  const px = (n) => impliedPrice(REAL.symbols[n], REAL.account.leverage);
  assert.equal(px('XAUUSD'), 4070.4); assert.equal(px('NAS100'), 26981); assert.equal(px('US500'), 7379); assert.equal(px('US30'), 51284); assert.equal(px('US2000'), 2752);
  assert.equal(px('EURUSD'), 1.114); assert.equal(px('USDCAD'), null);   // CAD-quoted: no broker quote yet to convert with (weekend)
});

test('real Fusion specs: the mirror lot for a 0.20% (1R) ICT trade at $50k, and Meridian forex at 0.02%', () => {
  const lotFor = (n, entry, stop, id = 'ict:x') => { const e = REAL.symbols[n];
    return riskVolume({ info: e, t: { id, entry, stop, size: 1 }, balance: 50000, name: n, spec: specFor(REAL, n), now: Date.parse(REAL.at) / 1000 }); };
  assert.equal(lotFor('NAS100', 26981, 26821).lots, 0.62);    // $100 / (160 pts x $1) = 0.625 -> 0.62
  assert.equal(lotFor('US500', 7379, 7349).lots, 3.33);       // 30 pts: 3.33
  assert.equal(lotFor('US30', 51284, 51084).lots, 0.5);       // 200 pts: 0.50
  assert.equal(lotFor('US2000', 2752, 2734).lots, 5.55);   // 18 pts: 5.55 lots; margin 5.55 x $27.52 = $153, far under 20% of $50k (owner, 7 Nov: cap by risk)
  // the margin cap: a 0.05 gold stop would need 20 lots ($16,282 margin at $814/lot) > 20% of $50k -> skipped; 0.1 -> 10 lots ($8,141) allowed
  assert.match(lotFor('XAUUSD', 4070, 4069.95).skip, /19\.99 lot would use 162\d\d\.\d+ margin, over 20% of the balance/);
  assert.equal(lotFor('XAUUSD', 4070, 4069.9).lots, 10);
  // without the broker's margin (no spec) the old 5-lot cap still applies
  assert.match(riskVolume({ info: REAL.symbols.US2000, t: { id: 'ict:x', entry: 2752, stop: 2734, size: 1 }, balance: 50000, name: 'US2000', spec: null }).skip, /5-lot cap \(the broker's margin is not known\)/);
  assert.equal(lotFor('XAUUSD', 4070, 4038).lots, 0.03);      // $32 x 100 oz = $3,200 a lot -> 0.031 -> 0.03
  assert.equal(lotFor('EURUSD', 1.114, 1.112, 'm1').lots, 0.05);   // Meridian 0.02% = $10, 20 pips = $200 a lot
  assert.equal(lotFor('USDCAD', 1.38, 1.378, 'm2').lots, 0.06);    // USD base: 1 CAD = 1/1.38 USD, 20 pips = $144.9 a lot -> 0.069 -> 0.06
  // the sample lots written in the file never risk more than the sample's 1R
  for (const [n, e] of Object.entries(REAL.symbols)) if (e.sample && e.sample.lots != null) assert.ok(e.sample.risked <= REAL.sample.riskCash + 1e-9, n);
  // no spread while the market is shut: the Trader keeps its default cost
  assert.equal(costModel({ xau: { group: 'Metals', spot: true } }, { symbols: SYMBOLS, brokerInfo: REAL }).xau.src, 'default');
});

// ---- raw-spread quotes (12 Nov 2026): bid = ask is not a spread of 0; the last positive one is kept with its time; commission ----
test('a bid = ask quote never writes spread 0: measured, then kept with its own time, else default; commission round trip', async () => {
  const flat = { ...PX, 1: [1.10000, 1.10000] }, full = { ...FULL, 1: { ...FX, commissionType: 1, preciseTradingCommissionRate: 2250000000 }, 41: { ...FULL[41], commissionType: 1, preciseTradingCommissionRate: 1200000000 }, 5: { ...FX, commissionType: 2, preciseTradingCommissionRate: 500000000 }, 101: { ...FULL[101], preciseTradingCommissionRate: 0 } };
  const a = await run(fakeBroker({ px: flat, full }));
  const e = a.symbols.EURUSD;
  assert.deepEqual([e.spread, e.spreadAt, e.spreadSrc, e.quoteSpread], [null, null, 'default', 0]);
  assert.equal(e.commissionRT, 0.000045); assert.equal(a.symbols.XAUUSD.commissionRT, 0.000024);   // 22.5 and 12 USD a million, a side
  assert.equal(a.symbols.USDCAD.commissionRT, null); assert.equal(a.symbols.US100.commissionRT, 0);   // another commission type is not guessed; none = 0
  assert.equal(a.symbols.XAUUSD.spreadSrc, 'measured'); assert.equal(a.symbols.XAUUSD.spread, 0.3);
  const b = await run(fakeBroker({ full }), { prev: a, now: NOW + 600e3 });        // a positive quote: measured
  assert.deepEqual([b.symbols.EURUSD.spread, b.symbols.EURUSD.spreadSrc], [0.00006, 'measured']);
  const c = await run(fakeBroker({ px: flat, full }), { prev: b, now: NOW + 1200e3 });   // bid = ask again: the 0.6 pip is kept, with its time
  assert.deepEqual([c.symbols.EURUSD.spread, c.symbols.EURUSD.spreadAt, c.symbols.EURUSD.spreadSrc, c.symbols.EURUSD.quoteSpread], [0.00006, b.symbols.EURUSD.spreadAt, 'kept', 0]);
  assert.deepEqual(c.symbols.EURUSD.spreadLog.map((x) => x[1]), [0, 0.00006, 0]);
  const d = await run(fakeBroker({ px: flat, full }), { prev: c, now: NOW + 8 * 86400e3 });   // kept at most 7 days
  assert.deepEqual([d.symbols.EURUSD.spread, d.symbols.EURUSD.spreadSrc], [null, 'default']);
  // a file written before this change (spread 0) is never carried as a spread
  const old = { symbols: { EURUSD: { spread: 0, spreadAt: new Date(NOW - 60e3).toISOString() } } };
  assert.equal((await run(fakeBroker({ px: flat, full }), { prev: old })).symbols.EURUSD.spreadSrc, 'default');
});
