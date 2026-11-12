// node --test tests/forex-spread.test.mjs — the forex spread fix (12 Nov 2026): the demo is a raw-spread account whose majors are
// quoted bid = ask most of the day and charged a commission instead. A spread of 0 is never a measured cost; the median of the
// broker's quotes plus its commission is; the demo fills of every account count. Offline, on the real reads of 8-12 Nov.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { costModel, tradeCost, annotateCosts, mirrorMaps, spreadOf, MIN_QUOTES } from '../council/fills.mjs';
import { spreadFields, commissionRT, rolloverHour } from '../council/ctrader-symbols.mjs';
import { SYMBOLS } from '../council/ctrader-mirror.mjs';

const RAW = JSON.parse(fs.readFileSync(new URL('./fixtures/ctrader/symbols-raw-12nov.json', import.meta.url), 'utf8'));
const FX = ['eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'];
const MK = { xau: { group: 'Metals', spot: true }, ...Object.fromEntries(FX.map((k) => [k, { group: 'Forex' }])) };
const NAME = { eurusd: 'EURUSD', gbpusd: 'GBPUSD', audusd: 'AUDUSD', usdcad: 'USDCAD', usdchf: 'USDCHF', xau: 'XAUUSD' };
// what the new writer would have kept from the reads of 8-12 Nov (each read: a fresh quote at its own time)
function rebuilt() {
  const f = JSON.parse(JSON.stringify({ at: RAW.at, account: RAW.account, symbols: RAW.symbols }));
  for (const [n, e] of Object.entries(f.symbols)) {
    let before = {};
    for (const [sec, bid, ask] of RAW.reads[n]) before = { ...before, ...spreadFields({ bid, ask, ts: sec * 1000 }, true, before, sec) };
    Object.assign(e, before, { commissionRT: commissionRT({ commissionType: e.commission.type, preciseTradingCommissionRate: e.commission.preciseRate }) });
  }
  return f;
}

test('the real file as main wrote it: three majors at spread 0, treated as missing (the 1-pip default), never as a measured 0', () => {
  for (const n of ['EURUSD', 'GBPUSD', 'AUDUSD']) assert.equal(RAW.symbols[n].spread, 0, n);
  const m = costModel(MK, { symbols: SYMBOLS, brokerInfo: RAW });
  for (const k of ['eurusd', 'gbpusd', 'audusd']) assert.deepEqual([m[k].spread, m[k].src], [null, 'default'], k);
  // a 0 handed straight to tradeCost is missing too: the default spread is charged
  const t = { market: 'eurusd', side: 'buy', entry: 1.1, stop: 1.0995, r0: 0.0005, opened: 1, filled: 1, closed: 2, status: 'loss', R: -1, entryMode: 'market' };
  assert.ok(Math.abs(tradeCost(t, MK.eurusd, { spread: 0, src: 'broker' }).costR - tradeCost(t, MK.eurusd, {}).costR) < 1e-12);
});

test('what the broker really quotes: 0.0 pips on most reads outside the rollover, a commission of 22.5 USD a million a side', () => {
  const f = rebuilt();
  for (const n of ['EURUSD', 'AUDUSD', 'USDCAD', 'USDCHF']) { const s = f.symbols[n].spreadTypical;
    assert.ok(s.n >= MIN_QUOTES && s.median === 0 && s.zeroShare >= 0.99, `${n} ${JSON.stringify(s)}`); }
  assert.ok(f.symbols.GBPUSD.spreadTypical.median === 0 && f.symbols.GBPUSD.spreadTypical.zeroShare > 0.8);
  // the rollover hours (21:00-22:59 UTC) hold the wide reads and are left out of the typical spread
  const roll = RAW.reads.USDCAD.filter(([sec]) => rolloverHour(sec)), wide = roll.filter(([, b, a]) => a - b >= 0.00015);
  assert.ok(wide.length >= 20 && RAW.reads.USDCAD.filter(([sec, b, a]) => !rolloverHour(sec) && a - b >= 0.00015).length <= 3);
  // gold has a real spread every read: median $0.06
  assert.equal(f.symbols.XAUUSD.spreadTypical.median, 0.06); assert.equal(f.symbols.XAUUSD.spreadTypical.zeroShare, 0);
  // commission: 2 x 22.5 / 1e6 of the price a round trip on forex, 2 x 12 on gold; the demo's deal of 0.07 lot EURUSD at 1.10876
  // paid 0.34 a round trip: 7,000 x 1.10876 x 0.000045 = 0.349 (two sides, each rounded to the cent)
  assert.equal(f.symbols.EURUSD.commissionRT, 0.000045); assert.equal(f.symbols.XAUUSD.commissionRT, 0.000024);
  assert.ok(Math.abs(7000 * 1.10876 * 0.000045 - 0.34) < 0.01);
  // never a stored zero: spread is positive (kept from a wider read) or null
  for (const e of Object.values(f.symbols)) assert.ok(e.spread == null || e.spread > 0);
});

test('cost model on the rebuilt file: quotes + commission; a typical 0 is used only with a commission; src names the basis', () => {
  const f = rebuilt(), m = costModel(MK, { symbols: SYMBOLS, brokerInfo: f });
  for (const k of FX) assert.deepEqual([m[k].spread, m[k].commissionRT, m[k].src], [0, 0.000045, 'quotes+commission'], k);
  assert.deepEqual([m.xau.spread, m.xau.src], [0.06, 'quotes+commission']);
  // without the commission a typical 0 is not enough: the positive spread kept, else the default
  const noCom = JSON.parse(JSON.stringify(f)); for (const e of Object.values(noCom.symbols)) e.commissionRT = null;
  const m2 = costModel(MK, { symbols: SYMBOLS, brokerInfo: noCom });
  assert.equal(m2.eurusd.src, f.symbols.EURUSD.spread > 0 ? 'broker' : 'default'); assert.equal(m2.xau.src, 'quotes');
  // too few reads: the positive measured / kept spread
  const few = JSON.parse(JSON.stringify(f)); few.symbols.XAUUSD.spreadTypical.n = MIN_QUOTES - 1;
  assert.deepEqual([costModel(MK, { symbols: SYMBOLS, brokerInfo: few }).xau.spread, costModel(MK, { symbols: SYMBOLS, brokerInfo: few }).xau.src.split('+')[0]], [few.symbols.XAUUSD.spread, 'broker']);
  // one forex scalp, 5-pip stop, market entry, stopped: commission 0.45 pip x 1.1 + half a default pip of slippage in and out
  const t = { id: 'x', market: 'eurusd', side: 'sell', entry: 1.1, stop: 1.1005, r0: 0.0005, opened: 1, filled: 1, closed: 2, status: 'loss', R: -1, entryMode: 'market' };
  const c = tradeCost(t, MK.eurusd, m.eurusd), want = (0.000045 * 1.1 + 0.5 * spreadOf(MK.eurusd, 1.1) * 2) / 0.0005;
  assert.ok(Math.abs(c.costR - want) < 1e-9, `${c.costR} vs ${want}`);
  assert.ok(c.costR < tradeCost(t, MK.eurusd, {}).costR);   // the default charged a full pip of spread on top
  // the basis is stamped on the trade, once, at its close
  const [s] = annotateCosts([{ ...t }], MK, m); assert.equal(s.costSrc, 'quotes+commission'); assert.equal(s.costR, +want.toFixed(3));
});

test('every demo account counts toward the entry slippage; no account overwrites another', () => {
  const fill = (i, side, px, ce) => ({ symbol: 'EURUSD', side, fillPrice: px, councilEntry: ce, i });
  const a = { state: { map: { t1: fill(1, 'buy', 1.10001, 1.1), t2: fill(2, 'buy', 1.10001, 1.1), t3: fill(3, 'sell', 1.09999, 1.1) } } };
  const b = { state: { map: { t1: fill(4, 'buy', 1.10002, 1.1), t5: fill(5, 'sell', 1.09998, 1.1) } } };
  const map = mirrorMaps([['mirror.json', a], ['mirror-2.json', b], ['missing.json', null]]);
  assert.equal(Object.keys(map).length, 5);
  const m = costModel(MK, { symbols: SYMBOLS, brokerInfo: rebuilt(), mirrorMap: map });
  assert.deepEqual([m.eurusd.fills, m.eurusd.entrySlip, m.eurusd.src], [5, 0.00001, 'quotes+commission+mirror']);
  assert.equal(costModel(MK, { symbols: SYMBOLS, mirrorMap: a.state.map }).eurusd.fills, 3);   // one account alone: too few
});

test('the Trader reads every mirror file the account map lists', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /rd\('ctrader\/mirror-accounts\.json'/);
  assert.match(src, /mirrorMap: mirrorMaps\(/);
});
