// Shadow-best study (research/edge/shadow-best): the 32 pre-registered cells, the selection rule on hand-made trades, the
// monthly t and Holm, the placebo partitions, no look-ahead in the per-trade rows, and the committed result against
// RESULT.md. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CELLS, IS_MONTHS, OOS_MONTHS, RULE, PLACEBO_N, cellId, windowOf, tradesOf, rowObj, windowStats, applyRule, cellTable, partition, placebo,
  evaluate, holm, tStat, pOneSided } from '../research/edge/shadow-best/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/shadow-best/PREREGISTRATION.md'), RUN = rd('../research/edge/shadow-best/run.mjs');
const at = (y, mo, d, h = 10) => Date.UTC(y, mo - 1, d, h) / 1000;
const tr = (o) => ({ m: 'xau', k: 'scalp', side: 'buy', opened: at(2024, 3, 5), net: -1, gross: -0.9, ...o });

test('the 32 cells, windows and rule are the pre-registered ones', () => {
  assert.equal(CELLS.length, 32);
  for (const m of ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']) for (const k of ['scalp', 'intraday', 'rscalp', 'rintra']) assert.ok(CELLS.some((c) => c.k === k && c.m === m), `${k} ${m}`);
  for (const m of ['btc', 'eth', 'sol', 'xrp']) {
    assert.deepEqual(CELLS.filter((c) => c.m === m).map((c) => c.k), ['intraday', 'rintra'], m);
  }
  assert.equal(IS_MONTHS.length, 48); assert.equal(OOS_MONTHS.length, 34);
  assert.equal(IS_MONTHS[0], '2020-01'); assert.equal(OOS_MONTHS[0], '2024-01'); assert.equal(OOS_MONTHS.at(-1), '2026-10');
  assert.deepEqual(RULE, { minOosN: 100, minT: 2, alpha: 0.05 }); assert.equal(PLACEBO_N, 40);
  for (const s of ['**32 cells**', 'OOS n ≥ 100', 'Holm over **all 32 cells**', '40 random partitions', 'no engine shadow stream is worth keeping', 'committed on 12 Nov 2026, alone'])
    assert.ok(PRE.includes(s), s);
});

test('importing the study never runs the earlier study\'s command line', () => {
  assert.ok(RUN.indexOf('process.argv.length') < RUN.indexOf("await import('../shadow-scalp-filters/run.mjs')"));
  assert.ok(!/from '\.\.\/shadow-scalp-filters\/run\.mjs'/.test(RUN), 'no static import (it would run before the argv is hidden)');
  assert.ok(!/from '[^']*(ict\/|ctrader|trader\.mjs)/.test(RUN));
});

test('per-trade rows: net = R - costR, the cell and window come from the signal only (no look-ahead)', () => {
  const raw = { key: 'eurusd', cols: ['opened', 'filled', 'closed', 'k', 'side', 'entry', 'r0', 'rr', 'R', 'costR'],
    rows: [[at(2023, 12, 31, 23), at(2024, 1, 2), at(2024, 1, 3), 'scalp', 'sell', 1.1, 0.001, 2, 2, 0.25]] };
  const [x] = tradesOf(raw).map(rowObj);
  assert.deepEqual(x, { m: 'eurusd', k: 'scalp', opened: at(2023, 12, 31, 23), side: 'sell', net: 1.75, gross: 2 });
  // filled and closed in 2024, signal in 2023: the trade is IS
  assert.equal(windowOf(x.opened), 'IS');
  assert.equal(windowOf(at(2024, 1, 1, 0)), 'OOS'); assert.equal(windowOf(at(2026, 11, 1, 0)), null); assert.equal(windowOf(at(2019, 12, 31)), null);
  // the result of a trade never moves it to another cell or window
  const t1 = cellTable([x]), t2 = cellTable([{ ...x, net: -5, gross: -5 }]);
  const c1 = t1.find((c) => c.k === 'scalp' && c.m === 'eurusd'), c2 = t2.find((c) => c.k === 'scalp' && c.m === 'eurusd');
  assert.equal(c1.IS.n, 1); assert.equal(c2.IS.n, 1); assert.equal(c1.OOS.n, 0);
});

test('window statistics: monthly sums, empty months count as 0', () => {
  const ms = ['2024-01', '2024-02', '2024-03'];
  const s = windowStats([tr({ opened: at(2024, 1, 3), net: 1, gross: 1.2 }), tr({ opened: at(2024, 1, 9), net: 0.5, gross: 0.6 }), tr({ opened: at(2024, 3, 3), net: -0.3, gross: 0 })], ms);
  assert.equal(s.n, 3); assert.equal(s.net, +(1.2 / 3).toFixed(4)); assert.equal(s.gross, +(1.8 / 3).toFixed(4)); assert.equal(s.total, 1.2);
  assert.equal(s.t, +tStat([1.5, 0, -0.3]).toFixed(3));
  assert.ok(Math.abs(s.p - pOneSided(tStat([1.5, 0, -0.3]), 2)) < 1e-3);
});

test('the selection rule: every one of the five conditions can fail a cell alone', () => {
  const good = { IS: { net: 0.1, n: 500, p: 0.2, t: 0.8 }, OOS: { net: 0.2, n: 300, t: 4, p: 0.0001 } };
  const fill = (n) => Array.from({ length: n }, () => ({ IS: { net: -0.1, n: 100 }, OOS: { net: -0.1, n: 100, t: -1, p: 0.84 } }));
  const run = (c) => applyRule([c, ...fill(31)])[0];
  assert.equal(run(good).keep, true);
  assert.deepEqual(run({ ...good, IS: { ...good.IS, net: 0 } }).failed, ['isPos']);
  assert.deepEqual(run({ ...good, OOS: { ...good.OOS, net: -0.01 } }).failed, ['oosPos']);
  assert.deepEqual(run({ ...good, OOS: { ...good.OOS, n: 99 } }).failed, ['oosN']);
  assert.deepEqual(run({ ...good, OOS: { ...good.OOS, t: 1.99, p: 0.0001 } }).failed, ['oosT']);
  // t 2.5 over 34 months: one-sided p about 0.009, x32 by Holm > 0.05
  const p25 = pOneSided(2.5, 33); assert.ok(p25 < 0.05 && p25 * 32 > 0.05);
  assert.deepEqual(run({ ...good, OOS: { ...good.OOS, t: 2.5, p: p25 } }).failed, ['holm']);
  // Holm over the whole set, nulls left out
  const h = holm([0.001, 0.02, null]); assert.ok(Math.abs(h[0] - 0.002) < 1e-12 && Math.abs(h[1] - 0.02) < 1e-12 && h[2] === null);
});

test('a hand-made book: one cell that wins every month is kept, a losing family keeps nothing', () => {
  const rows = [];
  for (const m of [...IS_MONTHS, ...OOS_MONTHS]) {
    const [y, mo] = m.split('-').map(Number);
    for (let d = 1; d <= 5; d++) rows.push(tr({ k: 'intraday', m: 'gbpusd', opened: at(y, mo, d), net: 0.3 + (d % 3) * 0.05, gross: 0.5 }));
    rows.push(tr({ k: 'scalp', m: 'xau', opened: at(y, mo, 9), net: -0.2, gross: 0 }));
  }
  const ev = evaluate(rows);
  assert.deepEqual(ev.keep, [{ setup: 'intraday', market: 'gbpusd' }]);
  assert.match(ev.verdict, /^PASS for 1 of 32/);
  assert.equal(ev.placebo.runs, 40);
  const lose = evaluate(rows.map((x) => ({ ...x, net: -0.2 })));
  assert.deepEqual(lose.keep, []); assert.equal(lose.verdict, 'FAIL, 0 of 32 cells: no engine shadow stream is worth keeping');
  assert.equal(lose.placebo.totalKeeps, 0);
});

test('placebo partitions keep each real cell\'s IS and OOS sizes and are fixed by the hash', () => {
  const rows = [];
  for (let i = 0; i < 400; i++) rows.push(tr({ k: i % 2 ? 'scalp' : 'rintra', m: i % 3 ? 'eurusd' : 'xau', opened: at(2020 + (i % 7), 1 + (i % 10), 1 + (i % 27), i % 24), net: (i % 5) - 2, side: i % 2 ? 'buy' : 'sell' }));
  const real = cellTable(rows), sizes = real.map((c) => ({ IS: c.IS.n, OOS: c.OOS.n }));
  const p1 = partition(rows, sizes, 1), p1b = partition(rows, sizes, 1), p2 = partition(rows, sizes, 2);
  p1.forEach((c, i) => { assert.equal(c.IS.n, sizes[i].IS); assert.equal(c.OOS.n, sizes[i].OOS); });
  assert.deepEqual(p1, p1b);
  assert.notDeepEqual(p1.map((c) => c.OOS.total), p2.map((c) => c.OOS.total));
  const pl = placebo(rows, real, 3); assert.equal(pl.per.length, 3); assert.equal(pl.runs, 3);
});

const hasResult = fs.existsSync(new URL('../research/edge/shadow-best/result.json', import.meta.url));
test('the committed result agrees with its rule and with RESULT.md', { skip: !hasResult && 'no result.json yet' }, () => {
  const J = JSON.parse(rd('../research/edge/shadow-best/result.json')), RES = rd('../research/edge/shadow-best/RESULT.md');
  assert.equal(J.cells.length, 32);
  const again = applyRule(J.cells.map((c) => ({ k: c.k, m: c.m, IS: c.IS, OOS: c.OOS })));
  again.forEach((c, i) => { assert.equal(c.keep, J.cells[i].keep, cellId(c)); assert.equal(c.holmP, J.cells[i].holmP, cellId(c)); });
  assert.deepEqual(J.keep, J.cells.filter((c) => c.keep).map((c) => ({ setup: c.k, market: c.m })));
  assert.ok(RES.includes(J.verdict), 'verdict line');
  assert.ok(RES.split('\n').find((l) => l.trim()).length > 0);
  for (const c of J.cells) {
    const line = RES.split('\n').find((l) => l.startsWith(`| ${c.k} | ${c.m} |`));
    assert.ok(line, `${c.k} ${c.m} row`);
    assert.ok(line.includes(String(c.OOS.n)) && line.includes(String(c.OOS.t)), `${c.k} ${c.m} OOS n / t`);
  }
  assert.ok(RES.includes(`${J.placebo.totalKeeps} keeps`), 'placebo count');
  if (!J.keep.length) assert.ok(!fs.readdirSync(new URL('../research/proposals/', import.meta.url)).some((f) => /shadow-best/.test(f)), 'no proposal when nothing is kept');
});
