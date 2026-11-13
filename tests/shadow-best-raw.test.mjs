// shadow-best-raw (research/edge/shadow-best-raw): shadow-best's cells re-costed on the measured raw-spread costs. The cost of a
// row equals council/fills.mjs tradeCost on the broker file rebuilt from the 12 Nov fixture; 2x doubles it; importing the study
// never runs the earlier studies' command lines; the committed RESULT.md says what result.json says. Offline: no candle file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tradeCost, spreadOf } from '../council/fills.mjs';
import { SYMBOLS } from '../council/ctrader-mirror.mjs';
import { BROKER, MARKETS, COLS, CELLS, brokerFile, model, recost, asRows, oldRows } from '../research/edge/shadow-best-raw/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/shadow-best-raw/PREREGISTRATION.md'), RUN = rd('../research/edge/shadow-best-raw/run.mjs');
const RES = JSON.parse(rd('../research/edge/shadow-best-raw/result.json')), MD = rd('../research/edge/shadow-best-raw/RESULT.md');
const at = (y, mo, d, h = 10) => Date.UTC(y, mo - 1, d, h) / 1000;
// a raw replay row in shadow-scalp-filters' COLS order
const row = (o) => { const x = { opened: at(2024, 3, 5), filled: at(2024, 3, 5), closed: at(2024, 3, 5, 12), k: 'scalp', side: 'sell', entry: 1.1, r0: 0.0005, rr: 2,
  R: -1, costR: 0, expCost: 0, h4: 'with', d1: 'none', mode: 'market', exit: 'stop', spreads: 5, finR: 0, ...o }; return COLS.map((c) => x[c]); };

test('the broker names are the mirror\'s and the cost model is the measured one', () => {
  for (const [k, v] of Object.entries(BROKER)) assert.deepEqual(v, SYMBOLS[k], k);
  assert.deepEqual(Object.keys(BROKER).sort(), Object.keys(MARKETS).sort());
  const mm = model();
  for (const k of ['eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']) assert.deepEqual([mm[k].spread, mm[k].commissionRT, mm[k].src], [0, 0.000045, 'quotes+commission'], k);
  assert.deepEqual([mm.xau.spread, mm.xau.commissionRT, mm.xau.src], [0.06, 0.000024, 'quotes+commission']);
  for (const k of ['btc', 'eth', 'sol', 'xrp']) assert.deepEqual([mm[k].spread, mm[k].src], [null, 'default'], k);
  assert.equal(CELLS.length, 32);
});

test('a row\'s cost equals fills.mjs tradeCost on the fixture model (forex, gold, crypto; market / limit; stop / target)', () => {
  const mm = model(brokerFile());
  const cases = [
    ['eurusd', {}], ['eurusd', { mode: 'limit', exit: 'target', R: 2 }], ['usdchf', { side: 'buy', entry: 0.88, r0: 0.0007 }],
    ['xau', { side: 'buy', entry: 4000, r0: 3, filled: at(2024, 3, 5), closed: at(2024, 3, 8) }], ['xau', { mode: 'limit', exit: 'stop', entry: 2000, r0: 1.5 }],
    ['btc', { entry: 60000, r0: 300 }], ['xrp', { mode: 'limit', exit: 'target', entry: 0.6, r0: 0.004, R: 2 }],
  ];
  for (const [key, o] of cases) {
    const r = row(o), y = recost(key, COLS, r, mm), x = Object.fromEntries(COLS.map((c, i) => [c, r[i]]));
    const t = { market: key, side: x.side, entry: x.entry, r0: x.r0, entryMode: x.mode, exitKind: x.exit, opened: x.opened, filled: x.filled, closed: x.closed };
    assert.equal(y.cost, tradeCost(t, MARKETS[key].M, mm[key]).costR, `${key} ${JSON.stringify(o)}`);
    assert.equal(y.oldCheck, tradeCost(t, MARKETS[key].M).costR);
    if (/^(btc|xrp)$/.test(key)) assert.equal(y.cost, y.oldCheck, 'crypto unchanged');
  }
  // forex by hand: a market sell stopped = commission + half a DEFAULT pip in and out; a limit entry at its target = commission
  const fx = MARKETS.eurusd.M, pip = spreadOf(fx, 1.1);
  assert.ok(Math.abs(recost('eurusd', COLS, row({}), mm).cost - (0.000045 * 1.1 + pip) / 0.0005) < 1e-12);
  assert.ok(Math.abs(recost('eurusd', COLS, row({ mode: 'limit', exit: 'target', R: 2 }), mm).cost - 0.000045 * 1.1 / 0.0005) < 1e-12);
  // gold by hand (a sell: no financing): $0.06 spread + commission + half the measured spread in and out
  assert.ok(Math.abs(recost('xau', COLS, row({ entry: 2000, r0: 2 }), mm).cost - (0.06 + 0.000024 * 2000 + 0.06) / 2) < 1e-12);
});

test('net = gross - k x cost; the old rows keep the replay\'s stamped cost', () => {
  const rc = [{ m: 'eurusd', k: 'scalp', opened: 1, side: 'buy', gross: 0.5, oldCost: 0.3, cost: 0.1 }];
  assert.equal(asRows(rc, 1)[0].net, 0.4); assert.equal(asRows(rc, 2)[0].net, 0.3); assert.equal(oldRows(rc)[0].net, 0.2);
});

test('importing never runs the earlier studies\' command lines; neither earlier study is imported statically', () => {
  assert.ok(RUN.indexOf('process.argv.length') < RUN.indexOf("await import('../shadow-best/run.mjs')"));
  assert.ok(!/from '\.\.\/shadow-(best|scalp-filters)\/run\.mjs'/.test(RUN));
  for (const s of ['committed on 13 Nov 2026, alone', 'ONE change', '**2x the measured cost**', '**32 cells**', '2026-11-13-shadow-raw.md', 'I expect 0 of 32 again'])
    assert.ok(PRE.includes(s), s);
});

test('result.json reproduces shadow-best and RESULT.md says what result.json says', () => {
  assert.equal(RES.reproduces.shadowBest, true); assert.equal(RES.trades, 107735); assert.equal(RES.cells.length, 32);
  assert.ok(MD.includes(`**Verdict: ${RES.verdict}**`));
  assert.ok(MD.includes(`At 2x the measured cost: ${RES.verdict2x}`));
  assert.ok(MD.includes(`${RES.x1.placebo.totalKeeps} keeps`));
  for (const c of RES.cells) {
    const f = (v) => v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(3);
    const line = `| ${c.k} | ${c.m} | ${c.IS.n} | ${f(c.IS.net)} | ${f(c.IS.gross)} | ${c.OOS.n} | ${f(c.OOS.net)} | ${f(c.OOS.gross)} | ${c.OOS.t} | ${f(c.old.OOS.net)} | ${f(c.x2.OOS.net)} | ${c.keep ? 'yes' : 'no'} |`;
    assert.ok(MD.includes(line), line);
  }
  for (const [m, c] of Object.entries(RES.costPerTrade)) assert.ok(MD.includes(`| ${m} | ${c.n} | ${c.oldPerTrade.toFixed(3)} | ${c.newPerTrade.toFixed(3)} |`), m);
  assert.equal(RES.keep.length === 0, !fs.existsSync(new URL('../research/proposals/2026-11-13-shadow-raw.md', import.meta.url)));
});
