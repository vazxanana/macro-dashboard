// research/edge/turnaround-tuesday: the Monday / holiday-week logic, the New York close across daylight saving, the stop, the
// costs and financing, the rule's trigger, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dayKind, tradingDays, weekPairs, weekOf, closeCandle, trade, atrAt, nights, holm, ruleOn, dayChg, verdictOf, FIN_ADD, STOP_ATR, RULES } from '../research/edge/turnaround-tuesday/run.mjs';

const dir = new URL('../research/edge/turnaround-tuesday/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const pairsOf = (from, to) => { const d = tradingDays(from, to); return weekPairs(d).map((p) => [d[p.m], d[p.x]]); };

test('M is the first trading day of the week and T the next; holiday weeks shift both', () => {
  assert.equal(weekOf('2025-01-22'), '2025-01-20');
  assert.equal(weekOf('2025-01-19'), '2025-01-13', 'a Sunday belongs to the week before');
  // January 2025: 20 Jan MLK (Monday holiday) -> M Tuesday 21, T Wednesday 22; 9 Jan closed (mourning) is not a trading day
  assert.deepEqual(pairsOf('2025-01-03', '2025-01-31'), [['2025-01-06', '2025-01-07'], ['2025-01-13', '2025-01-14'], ['2025-01-21', '2025-01-22'], ['2025-01-27', '2025-01-28']]);
  assert.equal(dayKind('2025-01-09'), 'special');
  // the previous trading day of M 6 Jan is Fri 3 Jan; of M 21 Jan is Fri 17 Jan
  const d = tradingDays('2025-01-02', '2025-01-31');
  assert.equal(d[d.indexOf('2025-01-21') - 1], '2025-01-17');
  // Christmas 2018: Monday 24 Dec is a half day, Tuesday 25 a holiday -> T is Wednesday 26
  assert.deepEqual(pairsOf('2018-12-21', '2018-12-28'), [['2018-12-24', '2018-12-26']]);
  // Good Friday 2025 (18 Apr) closes the Friday; Easter Monday 21 Apr is a normal Monday
  assert.deepEqual(pairsOf('2025-04-17', '2025-04-25')[0], ['2025-04-21', '2025-04-22']);
  // a week with one trading day has no T: 1-2 Jan 2009 is Thu-Fri; build a fake one-day week with the calendar of 2020-12-31
  const days = ['2020-12-24', '2020-12-28', '2021-01-04', '2021-01-05'];
  assert.deepEqual(weekPairs(days).map((p) => [days[p.m], days[p.x]]), [['2021-01-04', '2021-01-05']], 'a week whose only day is M is skipped');
});

test('the close is 16:00 New York (13:00 on a half day) across daylight saving', () => {
  assert.equal(new Date(closeCandle('2025-01-06') * 1000).toISOString(), '2025-01-06T20:00:00.000Z');
  assert.equal(new Date(closeCandle('2025-03-10') * 1000).toISOString(), '2025-03-10T19:00:00.000Z', 'the Monday after the March change');
  assert.equal(new Date(closeCandle('2025-11-03') * 1000).toISOString(), '2025-11-03T20:00:00.000Z', 'the Monday after the November change');
  assert.equal(new Date(closeCandle('2018-12-24') * 1000).toISOString(), '2018-12-24T17:00:00.000Z');
});

test('the trigger: R1 any down close, R2 down more than 1 %', () => {
  const D = [{ close: 100 }, { close: 99.5 }, { close: 98.4 }, { close: 98.4 }];
  assert.equal(ruleOn(dayChg(D, 1), RULES.r1.drop), true);
  assert.equal(ruleOn(dayChg(D, 1), RULES.r2.drop), false, '-0.5 % is not more than 1 %');
  assert.equal(ruleOn(dayChg(D, 2), RULES.r2.drop), true);
  assert.equal(ruleOn(dayChg(D, 3), RULES.r1.drop), false, 'unchanged is not down');
  assert.equal(dayChg([{ close: null }, { close: 1 }], 1), null);
});

// 22 flat days of range 1 around 100 -> ATR 1, stop 98; then the held session's candles
function mk(held, close = 101) {
  const bars = [], D = [];
  for (let k = 0; k < 22; k++) { bars.push([k * 3600, 100, 100.5, 99.5, 100]); D.push({ d: `2025-03-${String(k + 1).padStart(2, '0')}`, i: k, close: 100, hi: 100.5, lo: 99.5 }); }
  for (const b of held) bars.push([bars.length * 3600, ...b]);
  D.push({ d: '2025-03-23', i: bars.length - 1, close, hi: 0, lo: 0 });
  return { bars, D };
}
const OPT = { cost: 0.0005, rate: () => 0 };

test('stop 2 x ATR(20): a low through it fills at the stop, a gap through it at the open', () => {
  let { bars, D } = mk([[100, 101, 99, 100.5], [100.5, 101.2, 100.2, 101]]);
  assert.equal(atrAt(D, 21), 1);
  let t = trade(bars, D, 21, 22, OPT);
  assert.equal(t.how, 'time'); assert.equal(t.stop, 100 - STOP_ATR * 1); assert.equal(t.exit, 101);
  ({ bars, D } = mk([[100, 100.2, 97.5, 98.2], [98.2, 99, 98, 98.5]], 98.5));
  t = trade(bars, D, 21, 22, OPT);
  assert.equal(t.how, 'stop'); assert.equal(t.exit, 98);
  ({ bars, D } = mk([[97, 97.5, 96, 97.2]], 97.2));
  t = trade(bars, D, 21, 22, OPT);
  assert.equal(t.how, 'stop-gap'); assert.equal(t.exit, 97);
  assert.ok(t.R < -1, 'a gap below the stop books worse than -1R');
});

test('costs and financing in R: spread + one night (more over a holiday) of 2Y + 2.5 %', () => {
  const { bars, D } = mk([[100, 101, 99.8, 101]]);
  const t = trade(bars, D, 21, 22, OPT);
  const fin = FIN_ADD / 100 / 365 * 1;
  assert.equal(t.nights, 1);
  assert.ok(Math.abs(t.R - (1 - (0.0005 + fin) * 100) / 2) < 1e-12);
  assert.ok(Math.abs(t.grossR - 0.5) < 1e-12);
  const t2 = trade(bars, D, 21, 22, { cost: 0.0005, rate: () => 4 });
  assert.ok(Math.abs(t2.fin - (4 + FIN_ADD) / 365) < 1e-12, 'a 4 % 2-year yield adds to the 2.5 %');
  assert.equal(nights('2018-12-24', '2018-12-26'), 2);
  assert.equal(nights('2025-01-21', '2025-01-22'), 1);
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.2]).map((x) => +x.toFixed(2)), [0.04, 0.09, 0.09, 0.2]);
});

test('the verdict follows the checks: a cell passes on all five, the study on any cell', () => {
  const v = verdictOf(R);
  assert.equal(v.verdict, R.verdict);
  for (const [id, c] of Object.entries(v.cells)) { assert.deepEqual(c.checks, R.checks[id].checks, id); assert.equal(c.pass, Object.values(c.checks).every(Boolean)); }
  assert.equal(R.verdict, Object.values(R.checks).some((c) => c.pass) ? 'PASS' : 'FAIL');
  for (const c of Object.values(R.cells)) for (const t of c.trades) assert.ok(t[0] < t[1], 'exit after entry');
});

test('RESULT.md says what result.json says', () => {
  assert.match(MD, new RegExp(`\\*\\*Verdict: ${R.verdict}\\*\\*`));
  const f = (x, d = 3) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(d);
  for (const [id, c] of Object.entries(R.cells)) {
    const o = c.oos, i = c.is, v = R.checks[id];
    assert.ok(MD.includes(`| ${c.name} | ${o.n} | ${f(o.R)} | ${o.t.toFixed(2)} | ${f(o.grossR)} | ${o.tGross.toFixed(2)} | ${f(o.netPct)} | ${o.win.toFixed(2)} % | ${o.stops} | ${v.holmP.toFixed(4)} |`), id + ' 2016-now');
    assert.ok(MD.includes(`| ${c.name} | ${i.n} | ${f(i.R)} | ${i.t.toFixed(2)} | ${f(i.grossR)} | ${i.tGross.toFixed(2)} | ${f(i.netPct)} |`), id + ' 2008-15');
    const w = c.vsAllOOS;
    assert.ok(MD.includes(`${f(w.ruleMean)} % against ${f(w.allMean)} %, Welch t ${w.t.toFixed(2)}`), id + ' C4');
    assert.ok(MD.includes(`${c.placebo.beaten} of 40`), id + ' C5');
    assert.ok(MD.includes(v.pass ? 'PASS.' : 'FAIL.'));
  }
});
