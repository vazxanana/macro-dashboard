// Offline tests for council/repairs.mjs (one-time data repairs; no trading rule changes).
//   node --test tests/repairs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { voidM30Twins, m30Twin, M30_DEDUPE_AT, recostCrypto, RECOST_KEY } from '../council/repairs.mjs';
import { annotateCosts } from '../council/fills.mjs';

const NOW = '2026-11-08T00:00:00.000Z';
const before = M30_DEDUPE_AT - 3600, after = M30_DEDUPE_AT + 3600;
const mk = (k, opened, extra = {}) => ({ id: `xau-${k}-${opened}`, market: 'xau', k, side: 'buy', entry: 4000, stop: 3998, t1: 4006, opened, filled: opened, status: 'loss', R: -1, Rnet: -1.1, costR: 0.1, shadow: true, blockedBy: ['focus'], ...extra });

test('voidM30Twins marks the pre-dedupe m30m1 copies of a Scalp entry as duplicates and leaves everything else alone', () => {
  const T = [
    mk('scalp', before), mk('m30m1', before),                                     // the copy: same market, side, minute, entry
    mk('scalp', before - 60), mk('m30m1', before - 60, { entry: 4001 }),         // another entry: not a copy
    mk('m30m1', before - 120),                                                   // an m30m1 of its own (no Scalp twin)
    mk('scalp', before - 180, { side: 'sell' }), mk('m30m1', before - 180),       // other side: not a copy
    mk('scalp', after), mk('m30m1', after),                                       // after the dedupe went in: the Trader never records these; untouched by the repair
    mk('intraday', before - 240), mk('m30m1', before - 240, { status: 'win', R: 2, Rnet: 1.9 }),   // a copy of an Intraday entry (the same M1 break) counts too
  ];
  const config = {};
  assert.equal(voidM30Twins(T, config, NOW), 2);
  const dup = T.filter((x) => x.status === 'duplicate');
  assert.deepEqual(dup.map((x) => x.id), [`xau-m30m1-${before}`, `xau-m30m1-${before - 240}`]);
  assert.equal(dup[0].dupOf, `xau-scalp-${before}`); assert.equal(dup[1].dupOf, `xau-intraday-${before - 240}`);
  assert.ok(dup.every((x) => x.void && /copy of the Scalp/.test(x.voidWhy)));
  assert.equal(dup[0].R, -1, 'R is kept for the record'); assert.equal(dup[1].R, 2);
  // the Scalp records and the m30m1 trades of their own are untouched
  for (const x of T.filter((x) => x.status !== 'duplicate')) { assert.ok(['loss', 'win'].includes(x.status)); assert.equal(x.dupOf, undefined); }
  assert.equal(T.find((x) => x.id === `xau-m30m1-${after}`).status, 'loss');
  assert.deepEqual(config.repairs, ['void-m30m1-twins-2026-11-06']);
  assert.equal(config.history.length, 1); assert.equal(config.history[0].by, 'repair'); assert.match(config.history[0].change, /2 m30m1 trades .* duplicate .*\+1\.00R gross/);
  // a second run changes nothing
  const snap = JSON.stringify(T); assert.equal(voidM30Twins(T, config, NOW), 0); assert.equal(JSON.stringify(T), snap); assert.equal(config.history.length, 1);
});

test('the duplicate status drops the copy from every closed-trade tally (the same DONE set the Trader, digest, decay monitor and page use)', () => {
  const DONE = new Set(['win', 'loss', 'be']);
  const T = [mk('scalp', before), mk('m30m1', before)];
  voidM30Twins(T, {}, NOW);
  const closed = T.filter((x) => DONE.has(x.status) && Number.isFinite(x.R));
  assert.equal(closed.length, 1); assert.equal(closed[0].k, 'scalp');
  assert.equal(m30Twin(T[1], T).id, T[0].id); assert.equal(m30Twin(T[0], T), null);
});

test('on the pinned council-data copy the 6 Nov 13:16 m30m1 is the Scalp copy; the 20:00 one (after the dedupe) is its own trade', () => {
  const T = JSON.parse(fs.readFileSync(new URL('./fixtures/council/trades.json', import.meta.url), 'utf8'));
  const config = {}, n = voidM30Twins(T, config, NOW);
  assert.equal(n, 1);
  const d = T.find((x) => x.status === 'duplicate');
  assert.equal(d.id, 'xau-m30m1-1793971016'); assert.equal(d.dupOf, 'xau-scalp-1793971016');
  assert.equal(T.find((x) => x.id === 'xau-m30m1-1793995258').status, 'loss');
  assert.equal(T.find((x) => x.id === 'xau-scalp-1793971016').status, 'loss');
});

test('the Trader runs the repair once per data set, after the trades are loaded', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{[^}]*voidM30Twins[^}]*\} from '\.\/repairs\.mjs'/);
  const load = src.indexOf("let trades = rd('trades.json'"), call = src.indexOf('voidM30Twins(trades, config, nowISO)');
  assert.ok(load > 0 && call > load, 'the repair runs after trades.json is read');
  assert.ok(call < src.indexOf('Take new Ready setups'), 'and before new trades are taken');
});

test('recostCrypto clears the Kraken-sized costR of closed crypto trades once; annotateCosts then re-costs them under the CFD model', () => {
  const MK = { btc: { group: 'Crypto' }, xau: { group: 'Metals', spot: true } };
  const T = [
    { id: 'btc-1', market: 'btc', k: 'scalp', side: 'buy', entry: 100000, stop: 99500, t1: 101000, opened: 1, filled: 1, status: 'loss', R: -1, costR: 1.62, Rnet: -2.62, costSrc: 'default', shadow: true },
    { id: 'btc-2', market: 'btc', k: 'trend', side: 'buy', entry: 100000, stop: 95000, opened: 2, filled: 2, status: 'open', R: null },
    { id: 'xau-1', market: 'xau', k: 'scalp', side: 'buy', entry: 4000, stop: 3998, t1: 4006, opened: 3, filled: 3, status: 'win', R: 2, costR: 0.22, Rnet: 1.78, costSrc: 'default' },
  ];
  const config = {};
  assert.equal(recostCrypto(T, MK, config, NOW), 1);
  assert.equal(T[0].costR, undefined); assert.equal(T[0].Rnet, undefined);
  assert.equal(T[2].costR, 0.22, 'gold untouched'); assert.equal(T[1].costR, undefined, 'open trade untouched');
  assert.ok(config.repairs.includes(RECOST_KEY)); assert.match(config.history[0].change, /1 closed crypto paper trades re-costed/);
  annotateCosts(T, MK, {});
  assert.ok(T[0].costR > 0.08 && T[0].costR < 0.15, `CFD cost ${T[0].costR}`); assert.equal(T[0].R, -1, 'gross R unchanged'); assert.ok(T[0].Rnet > -1.2);
  T[0].costR = 1.62;
  assert.equal(recostCrypto(T, MK, config, NOW), 0, 'runs once'); assert.equal(T[0].costR, 1.62);
});
