// Shadow scalp filters study (research/edge/shadow-scalp-filters): the five pre-registered filters on hand-made trade rows,
// the monthly statistic, the Student t p-value and Holm, the windows, the candle aggregation, the imports (engine and fills
// used unchanged, the HistData clock shared), and the committed result against the pre-registered bar and the report.
// Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FILTERS, FAMILY, MARKETS, WIN, LIVE_CFG, COLS, aggregate, filterStats, evaluate, pOneSided, holm, monthKeys, monthOf, tStat, selection, placebo, hashU } from '../research/edge/shadow-scalp-filters/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/shadow-scalp-filters/PREREGISTRATION.md'), RUN = rd('../research/edge/shadow-scalp-filters/run.mjs');
const at = (y, mo, d, h = 10) => Date.UTC(y, mo - 1, d, h) / 1000;
const row = (o) => ({ m: 'xau', k: 'scalp', side: 'buy', opened: at(2024, 3, 5), R: -1, costR: 0.1, expCost: 0.12, h4: 'with', d1: 'with', spreads: 10, ...o });

test('windows, family, markets and settings are the pre-registered ones', () => {
  assert.deepEqual(FAMILY, ['scalp', 'intraday', 'rscalp', 'rintra']);
  assert.deepEqual(Object.keys(MARKETS), ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf', 'btc', 'eth', 'sol', 'xrp']);
  assert.equal(new Date(WIN.from.m1 * 1000).toISOString().slice(0, 10), '2020-01-01');
  assert.equal(new Date(WIN.from.c5 * 1000).toISOString().slice(0, 10), '2022-03-01');
  assert.equal(new Date(WIN.oos * 1000).toISOString().slice(0, 10), '2024-01-01');
  assert.equal(new Date(WIN.to * 1000).toISOString().slice(0, 10), '2026-11-01');
  assert.deepEqual(LIVE_CFG, { buf: 0.15, minRisk: 1.1 });
  assert.equal(monthKeys(WIN.from.m1, WIN.oos).length, 48); assert.equal(monthKeys(WIN.oos, WIN.to).length, 34);
  for (const s of ['2020-01-01 to 2023-12-31', '2024-01-01\n  to 2026-10-31', '`buf` 0.15', '`minRisk` 1.1', 'OOS, 1x costs: t ≥ 2 and Holm-adjusted p ≤ 0.05', 'at 0.5x and at 2x costs', 'owner item 44']) assert.ok(PRE.includes(s), s);
});

test('each filter removes exactly what the pre-registration says, from facts known at the signal', () => {
  const F = FILTERS;
  assert.deepEqual(Object.keys(F), ['F1', 'F2', 'F3', 'F4', 'F5']);
  assert.ok(F.F1.removes(row({ k: 'rscalp' })) && F.F1.removes(row({ k: 'rintra' })) && !F.F1.removes(row({ k: 'scalp' })) && !F.F1.removes(row({ k: 'intraday' })));
  assert.ok(F.F2.removes(row({ h4: 'against' })) && !F.F2.removes(row({ h4: 'with' })) && !F.F2.removes(row({ h4: 'none' })));
  assert.ok(F.F3.removes(row({ spreads: 7.99 })) && !F.F3.removes(row({ spreads: 8 })));
  assert.ok(F.F4.removes(row({ m: 'sol', expCost: 0.51 })) && F.F4.removes(row({ m: 'eth', expCost: 0.6 })) && !F.F4.removes(row({ m: 'eth', expCost: 0.5 })));
  assert.ok(!F.F4.removes(row({ m: 'btc', expCost: 2 })) && !F.F4.removes(row({ m: 'xau', expCost: 2 })));
  assert.ok(!F.F5.removes(row({ opened: at(2024, 3, 5, 7) })) && !F.F5.removes(row({ opened: at(2024, 3, 5, 12) + 3599 })));
  assert.ok(F.F5.removes(row({ opened: at(2024, 3, 5, 13) })) && F.F5.removes(row({ opened: at(2024, 3, 5, 6) + 3599 })));
  // the filters read only fields fixed at the signal, never the result
  for (const f of Object.values(F)) assert.ok(!/x\.(R|costR|closed|exit|finR)\b/.test(f.removes.toString()), f.name);
  assert.ok(COLS.includes('expCost') && COLS.includes('spreads') && COLS.includes('h4'));
});

test('the monthly statistic: D is minus the net R of the removed trades, empty months count as 0', () => {
  const ms = ['2024-01', '2024-02', '2024-03'];
  const rows = [row({ opened: at(2024, 1, 3), k: 'rscalp', R: -1, costR: 0.2 }), row({ opened: at(2024, 1, 4), R: 2, costR: 0.1 }),
    row({ opened: at(2024, 3, 3), k: 'rintra', R: 1, costR: 0.1 }), row({ opened: at(2023, 12, 3), k: 'rscalp', R: -5 })];
  const s = filterStats(rows, FILTERS.F1.removes, ms, 1);
  assert.equal(s.n, 3); assert.equal(s.removed, 2); assert.equal(s.kept, 1);
  assert.equal(s.removedR, -0.3); assert.equal(s.D, 0.3); assert.equal(s.months, 3);
  // months: +1.2, 0, -0.9
  assert.equal(s.t, +tStat([1.2, 0, -0.9]).toFixed(3));
  assert.equal(s.baselinePerTrade, +((-1.2 + 1.9 + 0.9) / 3).toFixed(3)); assert.equal(s.keptPerTrade, 1.9);
  const s2 = filterStats(rows, FILTERS.F1.removes, ms, 2); assert.equal(s2.removedR, -0.6);
  const s0 = filterStats(rows, FILTERS.F1.removes, ms, 0); assert.equal(s0.D, 0);
  assert.equal(monthOf(at(2024, 2, 29, 23)), '2024-02');
});

test('post-hoc selection and placebo', () => {
  const ms = ['2024-01', '2024-02'];
  const rows = [row({ opened: at(2024, 1, 3), k: 'rscalp', R: -1, costR: 0 }), row({ opened: at(2024, 1, 4), R: 0, costR: 0 }),
    row({ opened: at(2024, 2, 3), k: 'rscalp', R: -2, costR: 0 }), row({ opened: at(2024, 2, 4), R: 1, costR: 0 })];
  const s = selection(rows, FILTERS.F1.removes, ms, 1);
  assert.equal(s.months, 2); assert.equal(s.meanDiff, -2);
  const u = hashU(rows[0]); assert.ok(u >= 0 && u < 1); assert.equal(u, hashU({ ...rows[0] }));
  assert.equal(placebo(rows, 0, ms).removed, 0); assert.equal(placebo(rows, 1, ms).removed, 4);
});

test('Student t one-sided p and Holm', () => {
  assert.ok(Math.abs(pOneSided(2, 33) - 0.02689) < 1e-4);
  assert.ok(Math.abs(pOneSided(0, 10) - 0.5) < 1e-9);
  assert.ok(Math.abs(pOneSided(-1, 10) - 0.8296) < 1e-3);
  assert.ok(Math.abs(pOneSided(1.96, 1e6) - 0.025) < 1e-3);
  assert.deepEqual(holm([0.01, 0.04, 0.03, null, 0.5]).map((v) => v == null ? null : +v.toFixed(4)), [0.04, 0.09, 0.09, null, 0.5]);
});

test('evaluate applies the pass bar: t, Holm, both halves, costs', () => {
  // a filter that removes trades losing in every month of both windows passes F1; the others remove nothing
  const rows = [];
  for (const m of monthKeys(WIN.from.m1, WIN.to)) {
    const [y, mo] = m.split('-').map(Number);
    rows.push(row({ opened: at(y, mo, 10), k: 'rscalp', R: -1 - (mo % 3) * 0.1, costR: 0.1, h4: 'with', spreads: 20 }));
    rows.push(row({ opened: at(y, mo, 11), k: 'scalp', R: 0.5, costR: 0.1, h4: 'with', spreads: 20 }));
  }
  const ev = evaluate(rows);
  assert.equal(ev.filters.F1.pass, true); assert.deepEqual(ev.passed, ['F1']);
  assert.equal(ev.filters.F2.OOS.removed, 0); assert.equal(ev.filters.F2.pass, false);
  assert.ok(ev.filters.F1.holmP <= 0.05 && ev.filters.F1.OOS.t >= 2);
  assert.match(ev.barVerdict, /^PASS for F1/);
  // every trade there loses or wins by setup, so a random removal of the same share is no placebo pass: the bar verdict stands
  assert.ok(ev.filters.F1.selection.OOS.meanDiff < 0);
  // the same rows with the removed trades winning: no pass
  const ev2 = evaluate(rows.map((x) => x.k === 'rscalp' ? { ...x, R: 1 } : x));
  assert.equal(ev2.verdict, 'FAIL, 0 of 5');
  // a book that loses on every trade: removing ANY share "saves" R, so the placebo passes and the verdict is INCONCLUSIVE
  const lose = rows.map((x) => ({ ...x, R: -1 }));
  const ev3 = evaluate(lose);
  assert.equal(ev3.barDefect, true); assert.match(ev3.verdict, /^INCONCLUSIVE/);
  assert.ok(Math.abs(ev3.filters.F1.selection.OOS.meanDiff) < 1e-9);
});

test('aggregation buckets candles by period (and New York days with the 2 h shift)', () => {
  const b = [0, 60, 120, 300].map((t, i) => ({ time: 1700000100 + t, open: i, high: i + 1, low: i - 1, close: i + 0.5 }));
  const a = aggregate(b, 300);
  assert.equal(a.length, 2); assert.deepEqual(a[0], { time: 1700000100, open: 0, high: 3, low: -1, close: 2.5 });
  const d = aggregate([{ time: Date.UTC(2024, 0, 2, 21, 59) / 1000, open: 1, high: 1, low: 1, close: 1 }, { time: Date.UTC(2024, 0, 2, 22) / 1000, open: 2, high: 2, low: 2, close: 2 }], 86400, 7200);
  assert.equal(d.length, 2); assert.equal(d[1].time, Date.UTC(2024, 0, 2, 22) / 1000);
});

test('the engine, cleaner, fills and the HistData clock are imported, never copied', () => {
  for (const s of ["from '../../../council/engine.mjs'", "from '../../../council/clean.mjs'", "from '../../../council/fills.mjs'", "from '../../../council/histdata.mjs'", 'replayBar', 'tradeCost', 'buildRetrace', 'spotSkip'])
    assert.ok(RUN.includes(s), s);
  assert.ok(!/function (msAnalyze|buildSetup|buildRetrace|replayBar|tradeCost|costOf)\b/.test(RUN));
  assert.ok(!/from '[^']*(ict|ctrader|trader\.mjs)/.test(RUN), 'no ICT, mirror or Trader import');
});

const hasResult = fs.existsSync(new URL('../research/edge/shadow-scalp-filters/result.json', import.meta.url));
test('the committed result agrees with its pass bar and with RESULT.md', { skip: !hasResult && 'no result.json yet' }, () => {
  const J = JSON.parse(rd('../research/edge/shadow-scalp-filters/result.json')), RES = rd('../research/edge/shadow-scalp-filters/RESULT.md');
  const ids = Object.keys(J.filters); assert.deepEqual(ids, ['F1', 'F2', 'F3', 'F4', 'F5']);
  const adj = holm(ids.map((id) => J.filters[id].OOS.p));
  for (const [i, id] of ids.entries()) {
    const r = J.filters[id];
    assert.ok(Math.abs(r.holmP - adj[i]) < 1e-3, id);
    const pass = r.OOS.t >= 2 && r.holmP <= 0.05 && r.IS.D > 0 && r.OOS.D > 0 && r.OOScost.x05.D > 0 && r.OOScost.x2.D > 0;
    assert.equal(r.pass, pass, id);
    assert.ok(RES.includes(`| ${id} `), `${id} row in RESULT.md`);
    assert.ok(RES.includes(String(r.OOS.t)), `${id} OOS t ${r.OOS.t} in RESULT.md`);
  }
  assert.ok(RES.includes(J.verdict), 'the verdict line');
  assert.ok(RES.includes(J.barVerdict), 'the pre-registered bar verdict');
  assert.equal(J.barDefect, ids.some((id) => J.filters[id].placebo.t >= 2));
  assert.ok(!fs.existsSync(new URL('../research/proposals/', import.meta.url)) || !fs.readdirSync(new URL('../research/proposals/', import.meta.url)).some((f) => /scalp-filter/.test(f)), 'no proposal for a void pass');
});
