// The Halloween effect on equity index CFDs (research/edge/sell-in-may): offline checks on hand-made candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boundaries, simulate, halfYears, rateFn, finCost, dgs2Lookup, tStat, report, foldWeekend, ymOf, P, RATES } from '../research/edge/sell-in-may/run.mjs';

const DAY = 86400;
// weekday bars from 1 Sep 2006, close = f(t); a narrow range unless f says otherwise
function bars(until, f = () => ({ c: 100 })) {
  const out = []; let t = Date.UTC(2006, 8, 1) / 1e3; const end = Date.parse(until + 'T00:00:00Z') / 1e3;
  for (; t <= end; t += DAY) { const wd = new Date(t * 1e3).getUTCDay(); if (!wd || wd === 6) continue; const x = f(t); const c = x.c; out.push({ t, o: x.o ?? c, h: x.h ?? c + 0.1, l: x.l ?? c - 0.1, c }); }
  return out;
}
const zero = () => 0; // financing off: rate 0
const dateOf = (t) => new Date(t * 1e3).toISOString().slice(0, 10);

test('season boundaries are the last trading days of October and April', () => {
  const b = bars('2008-12-31'), bd = [...boundaries(b)].map(([i, s]) => [dateOf(b[i].t), s]);
  assert.deepEqual(bd, [['2006-10-31', 'oct'], ['2007-04-30', 'apr'], ['2007-10-31', 'oct'], ['2008-04-30', 'apr'], ['2008-10-31', 'oct']]);
  // a month ending on a weekend: April 2007 ends on Monday 30th; October 2009 ends Saturday -> Friday 30th
  const c = bars('2009-12-31'), oct09 = [...boundaries(c)].find(([i, s]) => s === 'oct' && ymOf(c[i].t) === '2009-10');
  assert.equal(dateOf(c[oct09[0]].t), '2009-10-30');
});

test('the rule is long from the October close to the April close and flat in summer; costs on entry and exit', () => {
  // price rises 1 a day: every held day earns, every flat day is exactly 0
  const b = bars('2009-06-30', (t) => ({ c: 1000 + (t - Date.UTC(2006, 8, 1) / 1e3) / DAY }));
  const s = simulate(b, 'R', zero, 0.001);
  assert.equal(s.log[0].entry, '2007-10-31');
  assert.equal(s.log[0].exit, '2008-04-30'); assert.equal(s.log[0].how, 'season');
  assert.equal(s.log[1].entry, '2008-10-31'); assert.equal(s.log[1].exit, '2009-04-30');
  for (const d of s.daily) {
    const mo = d.ym.slice(5), ds = dateOf(d.t);
    if (['06', '07', '08', '09'].includes(mo) || (mo === '05') || (mo === '10' && ds !== '2007-10-31' && ds !== '2008-10-31')) assert.equal(d.r, 0, ds);
    if (['11', '12', '01', '02', '03'].includes(mo)) assert.ok(d.r > 0, ds);
  }
  // entry day pays half the spread, exit day earns the day and pays half the spread
  assert.equal(s.daily.find((d) => dateOf(d.t) === '2007-10-31').r, -0.0005);
  const ex = b.findIndex((x) => dateOf(x.t) === '2008-04-30');
  assert.ok(Math.abs(s.daily.find((d) => dateOf(d.t) === '2008-04-30').r - (b[ex].c / b[ex - 1].c - 1 - 0.0005)) < 1e-12);
});

test('the stop: 3 x ATR(20) below the entry close, gap fills at the open, then flat until the next November', () => {
  const crash = Date.UTC(2008, 0, 15) / 1e3;
  const b = bars('2009-06-30', (t) => (t === crash ? { o: 90, h: 91, l: 85, c: 88 } : { c: t > crash ? 88 : 100 }));
  const i0 = b.findIndex((x) => dateOf(x.t) === '2007-10-31');
  const s = simulate(b, 'R', zero, 0);
  assert.ok(Math.abs(s.log[0].stop - (100 - 3 * 0.2)) < 1e-9); // true range 0.2 a day
  assert.equal(s.log[0].how, 'stop'); assert.equal(s.log[0].exit, '2008-01-15'); assert.equal(s.log[0].fill, 90); // gap below the stop: the open
  assert.equal(s.daily.find((d) => d.t === crash).r, 90 / 100 - 1);
  for (const d of s.daily.filter((d) => d.t > crash && d.ym < '2008-11')) assert.equal(d.r, 0);
  assert.equal(s.log[1].entry, '2008-10-31');
  assert.ok(i0 > 0);
  // the benchmark buys again at the next boundary (end of April) with a new stop
  const bm = simulate(b, 'B', zero, 0);
  assert.equal(bm.log[1].entry, '2008-04-30');
  // a touch without a gap fills at the stop
  const c = bars('2008-06-30', (t) => (t === crash ? { o: 100, h: 100.1, l: 99, c: 99.5 } : { c: 100 }));
  const sc = simulate(c, 'R', zero, 0);
  assert.ok(Math.abs(sc.log[0].fill - 99.4) < 1e-9);
});

test('financing: rate x calendar days / 365 while held, a floor at 0 for the policy rate, DGS2 at least 7 days old', () => {
  assert.ok(Math.abs(finCost(0.0365, 0, 3 * DAY) - 0.0003) < 1e-15); // Friday to Monday = 3 days
  const eur = rateFn('EUR', null), t16 = Date.UTC(2016, 5, 1) / 1e3, t23 = Date.UTC(2023, 5, 1) / 1e3;
  assert.equal(eur(t16), 0.025); // -0.35 % floored at 0, + 2.5 %
  assert.ok(Math.abs(eur(t23) - (RATES.EUR[2023] / 100 + 0.025)) < 1e-15);
  const d = dgs2Lookup([['2020-01-03', 1.5], ['2020-01-10', 2.0]]);
  assert.equal(d(Date.UTC(2020, 0, 16) / 1e3), 0.015); // the 10th is only 6 days old
  assert.equal(d(Date.UTC(2020, 0, 17) / 1e3), 0.02);
  const usd = rateFn('USD', d);
  assert.ok(Math.abs(usd(Date.UTC(2020, 0, 17) / 1e3) - 0.045) < 1e-15);
  // a held flat-price market loses exactly the financing; summer days cost nothing
  const b = bars('2008-06-30'), s = simulate(b, 'R', () => 0.0365, 0);
  const mon = s.daily.find((x) => dateOf(x.t) === '2007-11-05');
  assert.ok(Math.abs(mon.r + 0.0003) < 1e-12);
  assert.ok(s.daily.filter((x) => x.ym === '2008-06').every((x) => x.r === 0));
});

test('half-year pairs: winter y = Oct y-1 close to Apr y close, summer y = to Oct y close, net of financing', () => {
  const b = bars('2009-12-31', (t) => ({ c: 100 + (t - Date.UTC(2006, 8, 1) / 1e3) / DAY / 10 }));
  const hy = halfYears(b, zero), cl = (d) => b.find((x) => dateOf(x.t) === d).c;
  assert.deepEqual(Object.keys(hy), ['2007', '2008', '2009']);
  assert.ok(Math.abs(hy[2008].w - (cl('2008-04-30') / cl('2007-10-31') - 1)) < 1e-12);
  assert.ok(Math.abs(hy[2008].s - (cl('2008-10-31') / cl('2008-04-30') - 1)) < 1e-12);
  // an incomplete summer is not a pair
  assert.equal(halfYears(bars('2010-09-30'), zero)[2010], undefined);
});

test('t statistic and the weekend fold', () => {
  const r = tStat([1, 2, 3]); assert.equal(r.mean, 2); assert.ok(Math.abs(r.t - 2 / (1 / Math.sqrt(3))) < 1e-12);
  const fri = Date.UTC(2026, 10, 6) / 1e3;
  const f = foldWeekend([[fri, 10, 11, 9, 10.5], [fri + 2 * DAY, 10.4, 12, 10.3, 10.6], [fri + 3 * DAY, 10.6, 10.8, 8, 10.2]]);
  assert.deepEqual(f[1], { t: fri + 3 * DAY, o: 10.4, h: 12, l: 8, c: 10.2 });
});

test('result.json and RESULT.md agree, and the verdict follows the pre-registered checks', () => {
  const dir = new URL('../research/edge/sell-in-may/', import.meta.url);
  const res = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  assert.equal(fs.readFileSync(new URL('RESULT.md', dir), 'utf8'), report(res));
  const pd = res.pooled.dec;
  assert.equal(pd.n, 11); assert.deepEqual(pd.years, [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.equal(res.checks.t2, pd.t >= 2);
  assert.equal(res.checks.sharpeNotLower, res.book.R.dec.sharpe >= res.book.B.dec.sharpe);
  assert.equal(res.verdict, Object.values(res.checks).every(Boolean) ? 'PASS' : 'FAIL');
  assert.equal(Object.keys(res.markets).length, 9);
  assert.equal(res.params.stopAtr, 3); assert.equal(res.params.atrN, 20); assert.equal(P.finAdd, 0.025);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
  for (const [ccy, tab] of Object.entries(RATES)) for (const [y, v] of Object.entries(tab)) assert.ok(new RegExp(`^\\| ${y} \\|`, 'm').test(pre), `${ccy} ${y}`);
});
