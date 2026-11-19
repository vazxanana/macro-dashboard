// Energy seasonal windows: window dates over weekends and holidays, the stop with a gap fill, costs and financing,
// the year-based t, and the report against result.json. Offline (synthetic candles; result.json is committed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toBars, tradingDays, firstOnOrAfter, lastOnOrBefore, atrBefore, simTrade, costTrade, finRate, dgs2At, windowTrade,
  yearWindow, tStat, pOneSided, holm, pct95of40, dayKey, TESTS, SPREAD, P } from '../research/edge/energy-seasonal/run.mjs';

const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
// daily rows from a start date over N calendar days; Saturday absent, Sunday a thin stub, optional thin / missing days
function rows(from, n, { px = (i) => 50 + i * 0.01, vol = () => 1000, skip = [] } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = T(from) + i * 86400, d = new Date(t * 1000), wd = d.getUTCDay(), k = dayKey(t);
    if (wd === 6 || skip.includes(k)) continue;
    const c = px(i);
    out.push([t, c, c + 0.5, c - 0.5, c, wd === 0 ? 10 : vol(k)]);
  }
  return out;
}

test('pre-registered numbers', () => {
  assert.deepEqual(SPREAD, { wtico: 0.03, bco: 0.03, natgas: 0.005 });
  assert.equal(P.STOP_K, 3); assert.equal(P.ATR_N, 20); assert.equal(P.CARRY, 2.5);
  assert.deepEqual(TESTS.map((t) => [t.key, t.side, t.from, t.to, t.L]), [
    ['wtico', 1, [2, 15], [4, 30], 74], ['bco', 1, [2, 15], [4, 30], 74], ['natgas', 1, [9, 1], [10, 31], 60], ['natgas', -1, [2, 1], [3, 31], 58]]);
});

test('window dates: weekend folded, a thin holiday is skipped, a missing day is not a trading day', () => {
  // 15 Feb 2025 is a Saturday, 16 Feb a Sunday stub, 17 Feb Presidents' Day (thin) -> entry 18 Feb (Tuesday)
  const r = rows('2024-12-01', 180, { vol: (k) => (k === '2025-02-17' ? 50 : 1000), skip: ['2025-04-18'] });
  const bars = toBars(r), td = tradingDays(bars);
  assert.ok(bars.every((b) => ![0, 6].includes(new Date(b.time * 1000).getUTCDay())), 'weekend stubs folded away');
  const [t0, t1] = yearWindow(TESTS[0], 2025);
  assert.equal(dayKey(bars[firstOnOrAfter(bars, td, t0)].time), '2025-02-18');
  assert.equal(dayKey(bars[lastOnOrBefore(bars, td, t1)].time), '2025-04-30');
  // 31 Mar 2024 is a Sunday, 29 Mar Good Friday has no candle -> last trading day 28 Mar
  const b2 = toBars(rows('2023-12-01', 200, { skip: ['2024-03-29'] })), td2 = tradingDays(b2);
  const [, e4] = yearWindow(TESTS[3], 2024);
  assert.equal(dayKey(b2[lastOnOrBefore(b2, td2, e4)].time), '2024-03-28');
  // the Sunday stub folds into Monday: Monday's open is the Sunday open, its range covers both
  const raw = [[T('2025-03-02'), 10, 12, 9, 11, 10], [T('2025-03-03'), 11, 11.5, 10.5, 11.2, 900]];
  assert.deepEqual(toBars(raw)[0], { time: T('2025-03-03'), open: 10, high: 12, low: 9, close: 11.2, volume: 900 });
});

test('a window not complete in the file is dropped', () => {
  const M = { bars: toBars(rows('2025-12-01', 140)), dgs2: [['2025-01-01', 4]] }; M.td = tradingDays(M.bars);
  const [t0, t1] = yearWindow(TESTS[0], 2026); // file ends ~19 Apr 2026
  assert.match(windowTrade(M, TESTS[0], t0, t1).skip, /not complete/);
});

test('ATR(20) and the 3 x ATR stop; gap through the stop fills at the open, a touch at the stop, else the close', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ time: i * 86400, open: 100, high: 101, low: 99, close: 100, volume: 1 }));
  const td = bars.map(() => true);
  assert.equal(atrBefore(bars, td, 25), 2);
  assert.equal(atrBefore(bars, td, 10), null);
  // long: stop at 100 - 6 = 94; day 27 opens at 90 -> exit at the open
  const g = bars.map((b) => ({ ...b })); g[27] = { ...g[27], open: 90, high: 91, low: 89, close: 90 };
  let tr = simTrade(g, 25, 29, 1, 2);
  assert.deepEqual([tr.stop, tr.exit, tr.how, tr.iExit], [94, 90, 'gap', 27]);
  // short: stop 106; a touch at 106.5 high -> exit at the stop
  const s = bars.map((b) => ({ ...b })); s[26] = { ...s[26], high: 106.5 };
  tr = simTrade(s, 25, 29, -1, 2);
  assert.deepEqual([tr.stop, tr.exit, tr.how], [106, 106, 'stop']);
  assert.ok(tr.stop > tr.entry, 'a short stop sits above its entry');
  tr = simTrade(bars, 25, 29, 1, 2);
  assert.deepEqual([tr.exit, tr.how, tr.iExit], [100, 'close', 29]);
  // the entry day's own range can stop the trade (the open is the entry, no gap test)
  const e = bars.map((b) => ({ ...b })); e[25] = { ...e[25], low: 93 };
  assert.equal(simTrade(e, 25, 29, 1, 2).iExit, 25);
});

test('costs: spread and nightly financing in R, long and short rates', () => {
  assert.ok(Math.abs(finRate(1, 4) - 0.065) < 1e-12);
  assert.equal(finRate(-1, 4), 0);
  assert.ok(Math.abs(finRate(-1, 1) - 0.015) < 1e-12);
  assert.equal(dgs2At([['2020-01-03', 1.5], ['2020-01-10', 1.6]], T('2020-01-09')), 1.5);
  // Monday entry, Friday exit: rollovers Mon, Tue, Wed (x3), Thu = 6 nights (Friday's is after the 21:00 exit stamp)
  const bars = [{ time: T('2025-03-03') }, { time: T('2025-03-07') }];
  const tr = { entry: 70, exit: 73, risk: 3, iExit: 1 };
  const c = costTrade(tr, bars, 0, 1, 'wtico', 2.5);
  assert.equal(c.nights, 6);
  assert.ok(Math.abs(c.gross - 1) < 1e-12);
  assert.ok(Math.abs(c.spreadR - 0.01) < 1e-12);
  assert.ok(Math.abs(c.finR - 6 * 0.05 / 365 * 70 / 3) < 1e-12);
  assert.ok(Math.abs(c.net - (c.preFin - c.finR)) < 1e-12);
  const sh = costTrade({ ...tr, exit: 67 }, bars, 0, -1, 'wtico', 3);
  assert.equal(sh.finR, 0); assert.ok(Math.abs(sh.gross - 1) < 1e-12);
});

test('t over years, Student p, Holm and the placebo 95th percentile', () => {
  const s = tStat([1, 2, 3, 4]);
  assert.ok(Math.abs(s.mean - 2.5) < 1e-12); assert.ok(Math.abs(s.t - 2.5 / Math.sqrt(5 / 3) * 2) < 1e-12);
  assert.ok(Math.abs(pOneSided(1.812461, 10) - 0.05) < 1e-4);
  assert.ok(Math.abs(pOneSided(2.228139, 10) - 0.025) < 1e-4);
  assert.ok(Math.abs(pOneSided(0, 7) - 0.5) < 1e-9);
  assert.ok(Math.abs(pOneSided(-1.812461, 10) - 0.95) < 1e-4);
  assert.deepEqual(holm([0.1, 0.01, 0.04, 0.5]).map((x) => +x.toFixed(4)), [0.2, 0.04, 0.12, 0.5]);
  assert.equal(pct95of40(Array.from({ length: 40 }, (_, i) => 39 - i)), 37);
});

test('RESULT.md says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/energy-seasonal/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/energy-seasonal/RESULT.md', import.meta.url), 'utf8');
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  assert.equal(r.verdict, 'FAIL'); assert.deepEqual(r.passed, []);
  assert.match(md, /\*\*Verdict: FAIL, 0 of 4 tests pass\.\*\*/);
  assert.match(md, /n is about 10 a test/);
  for (const k of ['T1', 'T2', 'T3', 'T4']) {
    const x = r.rows[k];
    for (const [w, s] of [['2016-26', x.decisive], ['2008-15', x.replication]])
      assert.ok(md.includes(`| ${w} | ${s.n} | ${f(s.avg)} | ${s.t.toFixed(2)} | ${s.pos} of ${s.n} | ${f(s.preFin)} | ${f(s.gross)} | ${s.stopped} |`), `${k} ${w}`);
    assert.ok(md.includes(`| ${k} | ${f(x.placebo.median)} | ${f(x.placebo.p95)} | ${f(x.placebo.max)} | ${x.placebo.rank} | ${x.placebo.distinct} |`), k + ' placebo');
    assert.ok(md.includes(`| ${x.p.toFixed(4)} | no (${x.pHolm.toFixed(4)}) |`), k + ' p');
    assert.equal(r.tests[k].pass, false);
    assert.equal(x.decisive.n, 11); assert.equal(x.replication.n, 8);
    for (const y of x.years) assert.ok(Math.sign(y.entry - y.stop) === (x.side === 'long' ? 1 : -1), `${k} ${y.year} stop on the losing side`);
  }
});
