// research/edge/natgas-storage-day: schedule rule (holiday weeks, daylight saving), the stop from earlier reports only,
// stop first, the month-sum t, the verdict, and RESULT.md = the report of result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { releaseOf, releases, isHoliday, nyToUtc, timesOf, series, runA, monthT, judge, placeboDays, report, COST, addDays } from '../research/edge/natgas-storage-day/run.mjs';

const DIR = new URL('../research/edge/natgas-storage-day/', import.meta.url);
const U = (s) => Date.parse(s) / 1000;

test('schedule: Thursday 10:30 New York, daylight saving on both sides', () => {
  assert.deepEqual(releaseOf('2026-07-13'), { week: '2026-07-13', date: '2026-07-16', t: U('2026-07-16T14:30:00Z') });
  assert.equal(releaseOf('2026-01-12').t, U('2026-01-15T15:30:00Z'));
  assert.equal(releaseOf('2026-03-02').t, U('2026-03-05T15:30:00Z')); // before the US switch (8 Mar 2026)
  assert.equal(releaseOf('2026-03-09').t, U('2026-03-12T14:30:00Z')); // after it
  assert.equal(releaseOf('2026-11-02').t, U('2026-11-05T15:30:00Z')); // after the switch back (1 Nov 2026)
  const tm = timesOf('2026-07-16');
  assert.equal(tm.entry, U('2026-07-16T15:00:00Z')); assert.equal(tm.exit, U('2026-07-16T18:30:00Z'));
  assert.equal(tm.bEntry, U('2026-07-15T18:30:00Z')); assert.equal(tm.bExit, U('2026-07-16T14:25:00Z'));
});

test('schedule: a week with a federal holiday (Monday-Friday) is left out', () => {
  assert.equal(releaseOf('2026-11-23').skip, true);   // Thanksgiving
  assert.equal(releaseOf('2026-11-09').skip, true);   // Veterans Day on a Wednesday
  assert.equal(releaseOf('2025-09-01').skip, true);   // Labor Day (Monday)
  assert.equal(releaseOf('2026-06-29').skip, true);   // 4 July 2026 is a Saturday, observed Friday 3 July
  assert.equal(releaseOf('2021-12-27').skip, true);   // New Year 2022 on a Saturday, observed Friday 31 Dec 2021
  assert.equal(releaseOf('2026-03-30').date, '2026-04-02'); // Good Friday is not a federal holiday
  assert.equal(releaseOf('2020-06-15').date, '2020-06-18'); // Juneteenth only from 2021
  assert.equal(releaseOf('2022-06-13').skip, undefined); assert.equal(releaseOf('2022-06-20').skip, true);
  const r = releases('2016-01-01', '2016-12-31');
  assert.equal(r.length, 52);
  assert.ok(r.every((x) => x.skip || new Date(x.t * 1000).getUTCDay() === 4));
  assert.ok(r.filter((x) => x.skip).length >= 9);
});

test('placebo days are never the Thursday or a holiday, and repeat for a seed', () => {
  const rel = releases('2016-01-01', '2020-12-31'), a = placeboDays(rel, 3), b = placeboDays(rel, 3);
  assert.deepEqual(a, b); assert.notDeepEqual(a, placeboDays(rel, 4));
  assert.ok(a.every((x) => new Date(x.date + 'T00:00:00Z').getUTCDay() !== 4 && !isHoliday(x.date)));
  assert.equal(a.length, rel.filter((x) => !x.skip).length);
});

// synthetic M5 candles: one report day = candles from 10:30 to 14:25 New York (opens), price path chosen per event
function day(iso, path) {
  const t0 = nyToUtc(iso, 10, 30), rows = [];
  for (let k = 0; k < 48; k++) { const p = path(k); rows.push([t0 + k * 300, p.o, p.h, p.l, p.c]); }
  return rows;
}
const flat = (px) => () => ({ o: px, h: px, l: px, c: px });
// warm-up day: 11:00 -> 14:30 move of +0.1 (A = 0.1, risk 0.15), first half hour flat (no trade in the warm-up anyway)
const warm = (k) => (k < 6 ? { o: 3, h: 3, l: 3, c: 3 } : { o: 3 + (k - 6) * 0.1 / 42, h: 3.2, l: 2.9, c: 3 + (k - 5) * 0.1 / 42 });
const days = Array.from({ length: 22 }, (_, k) => addDays('2026-01-01', 7 * k));

test('(a): the first 20 events only build the stop; then follow the first half hour to 14:30', () => {
  let rows = [];
  for (const d of days.slice(0, 20)) rows.push(...day(d, warm));
  // event 21: up 0.05 in the first half hour, then drifts to +0.06 by 14:30 with no stop touch
  rows.push(...day(days[20], (k) => (k < 6 ? { o: 3 + k * 0.01, h: 3 + (k + 1) * 0.01, l: 3 + k * 0.01, c: 3 + (k + 1) * 0.01 } : { o: 3.06, h: 3.07, l: 3.05, c: 3.06 + (k === 47 ? 0.06 : 0) })));
  const { T, skipped } = runA(series(rows), days.slice(0, 21).map((date) => ({ date })));
  assert.equal(skipped.warmup, 20); assert.equal(T.length, 1);
  const x = T[0];
  assert.equal(x.side, 1); assert.equal(x.entry, 3.06); assert.equal(x.how, 'time');
  assert.ok(Math.abs(x.risk - 0.15) < 1e-9); assert.ok(Math.abs(x.stop - 2.91) < 1e-9);
  assert.ok(Math.abs(x.R - 0.06 / 0.15) < 1e-9); assert.ok(Math.abs(x.net - (x.R - COST / 0.15)) < 1e-9);
  assert.ok((x.entry - x.stop) * x.side > 0); // the stop is on the losing side
});

test('(a): stop first, a gap fills at the open, later events never change an earlier trade', () => {
  let base = []; for (const d of days.slice(0, 20)) base.push(...day(d, warm));
  // down first half hour; at 12:00 the candle trades through the stop above (sell: stop = entry + 0.15)
  const down = (k) => (k < 6 ? { o: 3 - k * 0.01, h: 3 - k * 0.01, l: 3 - (k + 1) * 0.01, c: 3 - (k + 1) * 0.01 } : k === 18 ? { o: 2.95, h: 3.2, l: 2.94, c: 3.1 } : { o: 2.94, h: 2.95, l: 2.93, c: 2.94 });
  const a = runA(series([...base, ...day(days[20], down)]), days.slice(0, 21).map((date) => ({ date }))).T[0];
  assert.equal(a.side, -1); assert.equal(a.how, 'stop'); assert.ok(Math.abs(a.exit - 3.09) < 1e-9); assert.ok(Math.abs(a.R + 1) < 1e-9);
  const gap = (k) => (k === 18 ? { o: 3.3, h: 3.35, l: 3.25, c: 3.3 } : down(k));
  const g = runA(series([...base, ...day(days[20], gap)]), days.slice(0, 21).map((date) => ({ date }))).T[0];
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 3.3); assert.ok(g.R < -1);
  // adding a wild later event changes nothing before it
  const b = runA(series([...base, ...day(days[20], down), ...day(days[21], () => ({ o: 9, h: 50, l: 0.1, c: 40 }))]), days.slice(0, 22).map((date) => ({ date }))).T[0];
  assert.deepEqual(a, b);
});

test('month-sum t and the verdict rules', () => {
  const T = [{ date: '2020-01-02', net: 1 }, { date: '2020-01-09', net: 1 }, { date: '2020-02-06', net: 1 }, { date: '2020-03-05', net: 3 }];
  const m = monthT(T); assert.equal(m.n, 3); assert.equal(m.t, +(2 / (1 / Math.sqrt(3))).toFixed(2));
  const ok = { mean: 0.1, tMonth: 2.2 };
  assert.equal(judge(ok, { mean: 0.05 }, { mean: 0.02 }, 39).pass, true);
  assert.equal(judge({ mean: 0.1, tMonth: 1.9 }, { mean: 0.05 }, { mean: 0.02 }, 39).pass, false);
  assert.equal(judge(ok, { mean: -0.01 }, { mean: 0.02 }, 39).pass, false);
  assert.equal(judge(ok, { mean: 0.05 }, { mean: -0.02 }, 39).pass, false);
  assert.equal(judge(ok, { mean: 0.05 }, { mean: 0.02 }, 37).pass, false);
});

test('RESULT.md is the report of result.json, verdict first; the pre-registration names the bar', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(res));
  assert.match(md, new RegExp(`\\*\\*Verdict: ${res.verdict}, \\d of 4 checks hold: `));
  const p = res.primary;
  const pass = p.OOS.net.mean > 0 && p.OOS.net.tMonth >= 2 && p.IS.net.mean > 0 && p.OOS.x2.mean > 0 && p.placebo.beat >= 38;
  assert.equal(res.verdict, pass ? 'PASS' : 'FAIL');
  assert.equal(p.placebo.means.length, 40);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(pre, /\$0\.005/); assert.match(pre, /38 of the 40/); assert.match(pre, /1\.5 x A/);
});
