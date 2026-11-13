// research/edge/pre-holiday: the calendar (observed dates, unscheduled closures), the day chosen, the stop, the costs, and the
// report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dayKind, isHoliday, tradingDays, holidayMarks, closeCandle, trade, atrAt, nights, holm, FIN_ADD, STOP_ATR } from '../research/edge/pre-holiday/run.mjs';

const dir = new URL('../research/edge/pre-holiday/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const preOf = (from, to) => holidayMarks(tradingDays(from, to)).pre;

test('holiday calendar: NYSE full holidays with observed dates', () => {
  for (const d of ['2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25',
    '2021-12-24', /* Christmas on Saturday, observed Friday */ '2023-01-02', /* New Year on Sunday, observed Monday */ '2026-07-03', /* 4 July on Saturday */
    '2022-06-20', /* Juneteenth on Sunday, observed Monday */ '2008-03-21' /* Good Friday */]) assert.equal(isHoliday(d), true, d);
  assert.equal(dayKind('2021-12-31'), 'open', 'a Saturday New Year is not observed on the Friday');
  assert.equal(isHoliday('2021-06-18'), false, 'no Juneteenth before 2022');
  assert.equal(dayKind('2025-01-09'), 'special', 'a day of mourning is closed, not a holiday');
  assert.equal(dayKind('2012-10-29'), 'special');
  assert.equal(dayKind('2025-12-24'), 'half');
  assert.equal(dayKind('2025-11-28'), 'half');
});

test('the pre-holiday day is the last trading day before each holiday', () => {
  const pre = preOf('2025-01-01', '2026-01-05');
  assert.deepEqual([...pre.keys()], ['2025-01-17', '2025-02-14', '2025-04-17', '2025-05-23', '2025-06-18', '2025-07-03', '2025-08-29', '2025-11-26', '2025-12-24', '2025-12-31']);
  assert.equal(pre.get('2025-12-31'), '2026-01-01');
  assert.equal(pre.has('2025-01-08'), false, 'no trade before an unscheduled closure');
  assert.equal(preOf('2021-12-20', '2022-01-07').has('2021-12-30'), false, 'no New Year holiday in 2022, so no trade on 30 Dec 2021');
  assert.equal(preOf('2021-12-20', '2022-01-07').get('2021-12-23'), '2021-12-24');
  assert.equal(preOf('2022-12-20', '2023-01-06').get('2022-12-30'), '2023-01-02');
  assert.equal(preOf('2026-06-25', '2026-07-10').get('2026-07-02'), '2026-07-03');
});

test('the close is 16:00 New York (13:00 on a half day), daylight saving read in New York', () => {
  assert.equal(new Date(closeCandle('2025-01-17') * 1000).toISOString(), '2025-01-17T20:00:00.000Z');
  assert.equal(new Date(closeCandle('2025-07-02') * 1000).toISOString(), '2025-07-02T19:00:00.000Z');
  assert.equal(new Date(closeCandle('2025-12-24') * 1000).toISOString(), '2025-12-24T17:00:00.000Z');
});

// 22 flat days of range 1 around 100 -> ATR 1, stop 98; then the held session's candles
function mk(held, close = 101) {
  const bars = [], D = [];
  for (let k = 0; k < 22; k++) { bars.push([k * 3600, 100, 100.5, 99.5, 100]); D.push({ d: `2025-03-${String(k + 1).padStart(2, '0')}`, i: k, close: 100, hi: 100.5, lo: 99.5 }); }
  for (const b of held) bars.push([bars.length * 3600, ...b]);
  D.push({ d: '2025-03-23', i: bars.length - 1, close, hi: 0, lo: 0 });
  return { bars, D };
}
const OPT = { cost: 0.0004, rate: () => 0 };

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
});

test('costs and financing in R: spread + one night (three over a weekend) of 2Y + 2.5 %', () => {
  const { bars, D } = mk([[100, 101, 99.8, 101]]);
  const t = trade(bars, D, 21, 22, OPT);
  const fin = FIN_ADD / 100 / 365 * 1;
  assert.equal(t.nights, 1);
  assert.ok(Math.abs(t.R - (1 - (0.0004 + fin) * 100) / 2) < 1e-12);
  assert.ok(Math.abs(t.grossR - 0.5) < 1e-12);
  const t2 = trade(bars, D, 21, 22, { cost: 0.0004, rate: () => 4 });
  assert.ok(Math.abs(t2.fin - (4 + FIN_ADD) / 365) < 1e-12, 'a 4 % 2-year yield adds to the 2.5 %');
  assert.equal(nights('2025-01-17', '2025-01-20'), 3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
});

test('RESULT.md says what result.json says', () => {
  assert.match(MD, new RegExp(`\\*\\*Verdict: ${R.verdict}\\*\\*`));
  const f = (x, d = 3) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(d);
  const o = R.pooled.oos, i = R.pooled.is;
  assert.ok(MD.includes(`${f(o.mean)}R a holiday, t ${o.t.toFixed(2)} (n ${o.n})`), 'pooled 2016-now');
  assert.ok(MD.includes(`${f(i.mean)}R, t ${i.t.toFixed(2)} (n ${i.n})`), 'pooled 2008-15');
  assert.ok(MD.includes(`${R.placebo.beaten} of 40`));
  assert.ok(MD.includes(`Welch t ${R.daysOOS.t.toFixed(2)}`));
  for (const k of Object.keys(R.markets)) {
    const m = R.markets[k].oos;
    assert.ok(MD.includes(`| ${R.markets[k].name} | ${m.n} | ${f(m.R)} | ${m.t.toFixed(2)} | ${f(m.grossR)} | ${m.tGross.toFixed(2)} | ${f(m.netPct)} |`), k);
  }
  for (const [t, ok] of Object.entries(R.checks)) assert.ok(MD.includes(`${t.toUpperCase()}`) && typeof ok === 'boolean');
  assert.equal(R.verdict, Object.values(R.checks).every(Boolean) ? 'PASS' : 'FAIL');
});
