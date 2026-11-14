// Small caps at the turn of the year (research/edge/smallcap-january): the NYSE calendar and window selection with holidays,
// equal-risk legs with a 3 x ATR(20) stop each, the pair stop, no look-ahead, the costs, Holm, and the written report against
// result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, nyseClosed, isTradingDay, tradingDays, windowOf, prep, atrAt, dgs2On, pairTrade, holm, permP, verdictOf } from '../research/edge/smallcap-january/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/smallcap-january/PREREGISTRATION.md'), RES = rd('../research/edge/smallcap-january/RESULT.md');
const J = JSON.parse(rd('../research/edge/smallcap-january/result.json'));
const DAY = 86400;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
// one flat candle (range 2 around px) per UTC day, weekends included as stubs
function cal(from, to, px = 100) {
  const rows = [];
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; t <= Date.parse(to + 'T00:00:00Z') / 1000; t += DAY) rows.push([t, px, px + 1, px - 1, px, 1]);
  return rows;
}
const edit = (B, day, f) => { const C = B.map((b) => ({ ...b })); C.ix = B.ix; Object.assign(C[B.ix[day]], f); return C; };

test('the constants and the tests are the pre-registered ones', () => {
  assert.deepEqual([P.ATR, P.K, P.SPREAD, P.FIN_ADD, P.DGS2_BEFORE, P.PAIR_STOP, P.DRAWS, P.SEED, P.PLACEBO_SEEDS, P.ALPHA], [20, 3, 0.0004, 2.5, 4, -1, 200000, 20261114, 40, 0.05]);
  assert.deepEqual(P.DECISIVE, [2016, 2026]); assert.equal(P.REPLICATION_TO, 2015);
  assert.deepEqual(TESTS.map((t) => [t.id, t.long, t.short, t.win, t.judged]), [['T1', 'us2000', 'spx500', 'T1', true], ['T2', 'us2000', 'spx500', 'T2', true], ['C', 'us2000', 'nas100', 'T1', false]]);
  assert.match(PRE, /0\.04 % of the entry price per leg/); assert.match(PRE, /\(DGS2 \+ 2\.5 %\)/); assert.match(PRE, /fixed 4 %/);
  assert.match(PRE, /5th-to-last US trading day of December/); assert.match(PRE, /10th US trading day of January/); assert.match(PRE, /200,000 draws/);
});

test('the NYSE calendar: usHolidays adjusted (federal holidays closed, half days open, New Year on a Saturday, specials)', () => {
  const c22 = nyseClosed(2022);
  for (const d of ['2022-01-17', '2022-02-21', '2022-04-15', '2022-05-30', '2022-06-20', '2022-07-04', '2022-09-05', '2022-11-24', '2022-12-26']) assert.ok(c22.has(d), d);
  assert.ok(!c22.has('2022-11-25') && isTradingDay('2022-11-25'), 'day after Thanksgiving trades');
  assert.ok(isTradingDay('2021-12-31'), 'New Year 2022 fell on a Saturday: 31 Dec 2021 stays open');
  assert.ok(!isTradingDay('2021-12-24'), 'Christmas 2021 on a Saturday: Friday 24 Dec closed');
  assert.ok(isTradingDay('2024-12-24'), '24 December is a half day');
  assert.ok(isTradingDay('2021-06-18') && !isTradingDay('2023-06-19'), 'Juneteenth only from 2022');
  assert.ok(!isTradingDay('2025-01-09') && !isTradingDay('2007-01-02') && !isTradingDay('2018-12-05'), 'special closures');
  assert.ok(!isTradingDay('2026-01-03'), 'a Saturday');
});

test('window selection with holidays on a hand-made calendar', () => {
  const days = tradingDays('2022-11-01', '2023-02-28');
  // Dec 2022: 26 closed; the last five are 23, 27, 28, 29, 30. Jan 2023: 2 closed (New Year on a Sunday), 16 MLK closed.
  assert.deepEqual(windowOf(days, 2023, 'T1'), { entry: '2022-12-23', exit: '2023-01-17' });
  assert.deepEqual(windowOf(days, 2023, 'T2'), { entry: '2022-12-30', exit: '2023-01-31' });
  const d25 = tradingDays('2024-11-01', '2025-02-28');
  assert.deepEqual(windowOf(d25, 2025, 'T1'), { entry: '2024-12-24', exit: '2025-01-16' }, '9 Jan 2025 closed moves the 10th day');
  assert.equal(windowOf(tradingDays('2022-11-01', '2023-01-10'), 2023, 'T1'), null, 'January not complete enough');
  // the result file uses the same days
  const t1 = J.tests.find((t) => t.id === 'T1').years.decisive, t2 = J.tests.find((t) => t.id === 'T2').years.decisive;
  assert.deepEqual([t1.find((r) => r.year === 2023).entryDay, t1.find((r) => r.year === 2023).exitDay], ['2022-12-23', '2023-01-17']);
  assert.ok(t1.every((r) => r.usDays === 14)); assert.ok(t2.every((r) => r.usDays >= 19 && r.usDays <= 21));
});

test('equal-risk legs: 1R = 3 x ATR(20) each, leg stops at the stop or a gapped open, the window close otherwise', () => {
  const L = prep(cal('2022-10-01', '2023-02-28', 100)), S = prep(cal('2022-10-01', '2023-02-28', 200));
  near(atrAt(L, L.ix['2022-12-23']), 2); near(atrAt(S, S.ix['2022-12-23']), 2);
  let t = pairTrade(L, S, '2022-12-23', '2023-01-17', 0);
  near(t.legs[0].stop, 94); near(t.legs[1].stop, 206);
  assert.ok(t.legs[0].stop < t.legs[0].entry && t.legs[1].stop > t.legs[1].entry, 'every leg has a stop on its losing side');
  assert.equal(t.why, 'window'); near(t.gross, 0);
  // the long leg touches its stop: -1R; with the short in profit at that close it stays on to the window close
  const L1 = edit(L, '2023-01-04', { low: 93 });
  const Sd = S.map((b) => (b.day >= '2023-01-04' ? { ...b, open: 197, high: 198, low: 196, close: 197 } : { ...b })); Sd.ix = S.ix;
  t = pairTrade(L1, Sd, '2022-12-23', '2023-01-17', 0);
  assert.equal(t.legs[0].why, 'leg'); near(t.legs[0].R, -1); assert.equal(t.legs[1].why, 'window'); assert.equal(t.why, 'leg'); near(t.gross, -0.5);
  // with the short flat at that close, pair R is -1R: the pair stop closes the short there
  t = pairTrade(L1, S, '2022-12-23', '2023-01-17', 0);
  assert.equal(t.legs[1].why, 'pair'); assert.equal(t.pairAt, '2023-01-04'); near(t.gross, -1);
  // a gap through the short's stop fills at the open
  const S1 = edit(S, '2023-01-05', { open: 209, high: 210, close: 209 });
  t = pairTrade(L, S1, '2022-12-23', '2023-01-17', 0);
  assert.equal(t.legs[1].why, 'leg-gap'); near(t.legs[1].R, -1.5);
  // a win: the long up 6 (+1R) and the short flat at the exit close
  const L2 = edit(L, '2023-01-17', { close: 106, high: 106.5 });
  t = pairTrade(L2, S, '2022-12-23', '2023-01-17', 1, 3);
  near(t.gross, 1); near(t.legs[0].cost, 0.0004 * 100 / 6); near(t.legs[1].cost, 0.0004 * 200 / 6);
  near(t.legs[0].fin, t.legs[0].nights * 0.055 / 365 * 100 / 6); near(t.net, t.gross - t.cost - t.fin);
  near(pairTrade(L2, S, '2022-12-23', '2023-01-17', 2, 3).net, t.gross - 2 * t.cost - 2 * t.fin);
});

test('the pair stop closes both legs at the first close where pair R is -1R or less', () => {
  const L = prep(cal('2022-10-01', '2023-02-28', 100)), S = prep(cal('2022-10-01', '2023-02-28', 200));
  const L1 = edit(L, '2023-01-05', { close: 97, low: 96.5 }), S1 = edit(S, '2023-01-05', { close: 203, high: 203.5 });   // -0.5R + -0.5R
  const t = pairTrade(L1, S1, '2022-12-23', '2023-01-17', 0);
  assert.equal(t.why, 'pair'); assert.equal(t.pairAt, '2023-01-05'); near(t.gross, -1);
  assert.ok(t.legs.every((g) => g.why === 'pair'));
  const S2 = edit(S, '2023-01-05', { close: 202.9, high: 203 });   // -0.5R + -0.483R: no pair stop
  assert.equal(pairTrade(L1, S2, '2022-12-23', '2023-01-17', 0).why, 'window');
});

test('no look-ahead: candles after the exit change nothing; the ATR ends at the entry candle', () => {
  const L = prep(cal('2022-10-01', '2023-03-31', 100)), S = prep(cal('2022-10-01', '2023-03-31', 200));
  const base = pairTrade(L, S, '2022-12-23', '2023-01-17', 1, 3);
  const L2 = L.map((b) => ({ ...b })); L2.ix = L.ix; const S2 = S.map((b) => ({ ...b })); S2.ix = S.ix;
  for (let i = L.ix['2023-01-18']; i < L2.length; i++) Object.assign(L2[i], { open: 50, high: 300, low: 10, close: 40 });
  for (let i = S.ix['2023-01-18']; i < S2.length; i++) Object.assign(S2[i], { open: 50, high: 900, low: 10, close: 40 });
  assert.deepEqual(pairTrade(L2, S2, '2022-12-23', '2023-01-17', 1, 3).net, base.net);
  const L3 = edit(L, '2022-12-27', { high: 140, low: 60 });   // a wide candle the day after entry does not move the stop
  near(pairTrade(L3, S, '2022-12-23', '2023-01-17', 0).legs[0].stop, 94);
  assert.equal(dgs2On([['2015-12-25', 1.0], ['2016-01-01', 1.05]], '2015-12-31'), 1.0);
  assert.equal(dgs2On([['2006-01-06', 4.36]], '2005-12-30'), 4);
});

test('Holm and the permutation p', () => {
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(holm([0.3, 0.2]), [0.4, 0.4]);
  assert.ok(permP(1, [[0, 0, 1], [0, 0, 1]], 20000, 1) < 0.15);
  assert.ok(permP(-1, [[0, 1], [0, 1]], 2000, 1) > 0.99);
  const fake = [{ judged: true, decisive: { meanNet: 0.2, perm: { 1: 0.01 } }, replication: { meanNet: 0.1 } }, { judged: true, decisive: { meanNet: 0.2, perm: { 1: 0.04 } }, replication: { meanNet: -0.1 } }];
  assert.equal(verdictOf(fake), 'PASS'); assert.equal(fake[0].pass, true); assert.equal(fake[1].pass, false);
});

test('the report says what result.json says', () => {
  assert.equal(J.verdict, 'FAIL');
  assert.match(RES.split('\n')[0], /^\*\*Verdict: FAIL, 0 of 2\.\*\*/);
  const f = (x, d = 3) => (x < 0 ? '−' : x > 0 ? '+' : '') + Math.abs(x).toFixed(d);
  for (const t of J.tests) {
    for (const s of ['decisive', 'replication']) {
      const x = t[s];
      const row = `| ${t.id} | ${s} ${x.years[0]}-${String(x.years[1]).slice(2)} | ${x.n} | ${x.won} of ${x.n} | ${x.stopped} (${x.pairStops}) | ${f(x.meanG)} | ${f(x.meanNet)} | ${f(x.t, 2)} | ${x.perm[1]} | ${x.rank} of ${x.of} | ${x.placebo.atOrAbove} of ${x.placebo.of} |`;
      assert.ok(RES.includes(row), `summary row ${t.id} ${s}`);
      assert.ok(RES.includes(`| ${t.id} | ${s} | ${f(x.meanNet0)} | ${x.perm[0]} | ${f(x.meanNet)} | ${x.perm[1]} | ${f(x.meanNet2)} | ${x.perm[2]} |`), `cost row ${t.id} ${s}`);
      for (const r of t.years[s]) assert.ok(RES.includes(`| ${s.slice(0, 3)} | ${r.year} | ${r.entryDay} |`) && RES.includes(`| ${f(r.net)} |`), `year ${t.id} ${r.year}`);
    }
    if (t.judged) { assert.equal(t.pass, false); assert.ok(RES.includes(`| ${t.holmP} |`), `Holm ${t.id}`); }
  }
  assert.ok(J.tests.every((t) => t.dropped.decisive.length === 0 && t.decisive.n === 11 && t.replication.n === 12));
  const t1 = J.tests[0].decisive, t2 = J.tests[1].decisive;
  assert.match(RES, new RegExp(`T1 .*${f(t1.meanNet)}R a turn on 2016-26 \\(${t1.won} of 11 won`));
  assert.match(RES, new RegExp(`T2 .*${f(t2.meanNet)}R on 2016-26 \\(${t2.won} of 11`));
  assert.match(RES, /commit 73798fbd/);
});
