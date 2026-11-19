// research/edge/fomc-even-week: the cycle counting on hand-made days, the trade, the statistics, and the report against
// result.json. Offline: no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fold, windows, trade, firstOnOrAfter, rollovers, cycleD, holm, phi, stat, report, headline, shifted, WEEK, P } from '../research/edge/fomc-even-week/run.mjs';
import { scheduled, OLD, UNSCHEDULED, fromEvents } from '../research/edge/fomc-even-week/dates.mjs';

const DIR = new URL('../research/edge/fomc-even-week/', import.meta.url);
// weekday candles from a date, price rising 1 a day (o = previous close, h = c + 0.5, l = o - 0.5)
function weekdays(from, n, px = 100) {
  const rows = []; let t = Date.parse(from + 'T00:00:00Z') / 1000, c = px;
  while (rows.length < n) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6) { rows.push([t, c, c + 1.5, c - 0.5, c + 1]); c += 1; }
    t += 86400;
  }
  return rows;
}

test('the paper counting: week w = days 5w-1 .. 5w+3, entry the close before; week 0 never used', () => {
  assert.deepEqual(WEEK.paper(2), [9, 13]); assert.deepEqual(WEEK.paper(4), [19, 23]); assert.deepEqual(WEEK.paper(6), [29, 33]);
  assert.deepEqual(WEEK.paper(1), [4, 8]); assert.deepEqual(WEEK.paper(3), [14, 18]); assert.deepEqual(WEEK.paper(5), [24, 28]);
  assert.deepEqual(WEEK.brief(2), [10, 14]);
  const days = fold(weekdays('2024-01-01', 120)), m = days[30].d;   // day 0 = index 30
  const { list } = windows(days, [m], { unsched: [] });
  assert.deepEqual(list.map((x) => x.w), [1, 2, 3, 4, 5, 6]);
  const w2 = list.find((x) => x.w === 2);
  assert.deepEqual([w2.entry, w2.start, w2.end], [38, 39, 43]);
  assert.ok(list.every((x) => x.start - 30 >= 4), 'no day of week 0 (days -1..3) is in a window');
  assert.deepEqual(list.filter((x) => x.even).map((x) => x.w), [2, 4, 6]);
});

test('a cycle ends at day -1 of the next meeting; a short cycle drops week 6 (and 5)', () => {
  const days = fold(weekdays('2024-01-01', 120));
  const { list, drop } = windows(days, [days[10].d, days[10 + 30].d], { unsched: [] });   // next meeting at day 30: its day -1 = 29
  const first = list.filter((x) => x.meet === days[10].d).map((x) => x.w);
  assert.deepEqual(first, [1, 2, 3, 4, 5]);   // week 5 ends at day 28 < 29; week 6 (29-33) cut
  assert.ok(drop.cut >= 1);
  const { list: l2 } = windows(days, [days[10].d, days[10 + 28].d], { unsched: [] });   // next day -1 = 27: week 5 (24-28) cut too
  assert.deepEqual(l2.filter((x) => x.meet === days[10].d).map((x) => x.w), [1, 2, 3, 4]);
});

test('unscheduled announcements remove the windows that touch their days -1..+3; a missing statement day drops the meeting', () => {
  const days = fold(weekdays('2024-01-01', 120)), m = days[20].d;
  const u = days[20 + 11].d;   // banned days 30..34 = week 2 (29-33) and week 3 (34-38)
  const { list, drop } = windows(days, [m], { unsched: [u] });
  assert.deepEqual(list.map((x) => x.w), [1, 4, 5, 6]);
  assert.equal(drop.unscheduled, 2);
  const sat = '2024-01-06';
  assert.deepEqual(windows(days, [sat], { unsched: [] }).drop.noDay0, [sat]);
});

test('weekends fold into Monday; a five-day hold crosses seven rollovers; Holm and the normal tail', () => {
  const t = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
  const f = fold([[t('2024-01-05'), 10, 11, 9, 10], [t('2024-01-07'), 10.2, 13, 8, 10.5], [t('2024-01-08'), 10.4, 12, 9.5, 11]]);
  assert.equal(f.length, 2); assert.deepEqual([f[1].o, f[1].h, f[1].l, f[1].c], [10.2, 13, 8, 11]);
  assert.equal(rollovers(t('2024-01-10'), t('2024-01-17')), 7);   // Wed close .. next Wed close
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(1 - phi(2) - 0.02275) < 1e-4);
});

test('a window long: buy the close before, stop 2 x ATR(20) under it, costs and financing taken off', () => {
  const days = fold(weekdays('2024-01-01', 120));
  const w = { meet: days[30].d, w: 2, even: true, entry: 38, start: 39, end: 43 };
  const x = trade(days, w, 'spx500');
  assert.equal(x.entryPx, days[38].c); assert.equal(x.exit, days[43].c); assert.equal(x.why, 'time');
  assert.ok(x.stop < x.entryPx);
  assert.ok(Math.abs(x.gross - (5 / days[38].c) * 100) < 1e-9);
  const cost = P.COST.spx500 / x.entryPx * 100 + x.nights * P.FIN_YEAR / 365 * 100;
  assert.ok(Math.abs(x.net - (x.gross - cost)) < 1e-9 && Math.abs(x.perDay - x.net / 5) < 1e-12);
  // a gap through the stop exits at the open
  const d2 = days.map((d) => ({ ...d })); d2[41] = { ...d2[41], o: x.stop - 1, l: x.stop - 2 };
  const y = trade(d2, w, 'spx500'); assert.equal(y.why, 'gap'); assert.equal(y.exit, x.stop - 1);
  // per cycle D = mean even per-day minus mean odd per-day
  const D = cycleD([{ meet: 'a', even: true, perDay: 0.3 }, { meet: 'a', even: true, perDay: 0.1 }, { meet: 'a', even: false, perDay: 0.05 }, { meet: 'b', even: true, perDay: 1 }]);
  assert.equal(D.length, 1); assert.ok(Math.abs(D[0].D - 0.15) < 1e-12);
  // the placebo moves meetings onto other trading days of the file
  const sh = shifted(days, [days[30].d, days[70].d], 1);
  assert.ok(sh.every((d) => days.some((x) => x.d === d)) && !sh.includes(days[30].d));
});

test('the dates: eight scheduled meetings a year (seven in 2020), unscheduled apart, 2022 on from council/events.mjs', () => {
  const s = scheduled();
  for (const y of Object.keys(OLD)) assert.equal(s.filter((d) => d.startsWith(y)).length, y === '2020' ? 7 : 8, y);
  for (const d of fromEvents()) assert.ok(s.includes(d));
  for (const u of UNSCHEDULED) assert.ok(!s.includes(u));
  assert.ok(!s.includes('2020-03-18'));
});

test('the report and its headline match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(r));
  const h = headline(r);
  assert.ok(md.includes(h) && h.startsWith('**Verdict: ' + r.verdict) && h.length < 220);
  const S = r.markets.spx500.windows;
  assert.equal(r.verdict, Object.values(r.checks).every(Boolean) ? 'PASS' : 'FAIL');
  assert.equal(r.checks.isSign, S.IS.Dnet > 0);
  assert.equal(r.checks.placebo, r.placebo.beaten >= 38);
  assert.equal(r.placebo.means.length, 40);
  assert.equal(r.placebo.beaten, r.placebo.means.filter((x) => S.OOS.Dnet > x).length);
  assert.equal(r.checks.oos, S.OOS.Dnet > 0 && S.OOS.pHolm <= r.pHolmBar);
  assert.ok(md.includes(`t ${S.OOS.tNet < 0 ? '−' : '+'}${Math.abs(S.OOS.tNet).toFixed(2)}`));
  assert.ok(stat([1, 2, 3]).t > 0);
  assert.equal(firstOnOrAfter([{ d: '2024-01-02' }, { d: '2024-01-04' }], '2024-01-03'), 1);
});
