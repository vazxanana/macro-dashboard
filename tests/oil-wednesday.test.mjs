// research/edge/oil-wednesday: calendar (holiday weeks, daylight saving), no look-ahead, stop first, time exit, the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { releaseOf, releases, isHoliday, nyToUtc, trade, indexBars, atrBefore, placeboDays, judge, holm, report, COST } from '../research/edge/oil-wednesday/run.mjs';

const DIR = new URL('../research/edge/oil-wednesday/', import.meta.url);
const U = (s) => Date.parse(s) / 1000;

test('calendar: Wednesday 10:30 New York, daylight saving both sides', () => {
  assert.deepEqual(releaseOf('2026-07-13'), { week: '2026-07-13', date: '2026-07-15', t: U('2026-07-15T14:30:00Z'), delayed: false });
  assert.equal(releaseOf('2026-01-12').t, U('2026-01-14T15:30:00Z'));
  assert.equal(releaseOf('2026-03-09').t, U('2026-03-11T14:30:00Z')); // the week after the US switch (8 Mar 2026)
  assert.equal(releaseOf('2026-11-02').t, U('2026-11-04T15:30:00Z')); // the week after the switch back (1 Nov 2026)
  assert.equal(nyToUtc('2026-03-08', 10, 30), U('2026-03-08T14:30:00Z'));
});

test('calendar: a federal holiday Monday-Wednesday moves the release to Thursday 11:00', () => {
  assert.deepEqual(releaseOf('2025-09-01'), { week: '2025-09-01', date: '2025-09-04', t: U('2025-09-04T15:00:00Z'), delayed: true }); // Labor Day
  assert.equal(releaseOf('2026-11-09').t, U('2026-11-12T16:00:00Z')); // Veterans Day on a Wednesday, EST
  assert.equal(releaseOf('2024-12-23').date, '2024-12-26'); // Christmas on a Wednesday
  assert.equal(releaseOf('2026-01-19').date, '2026-01-22'); // Martin Luther King Jr. Day
  assert.ok(isHoliday('2021-12-31')); // New Year 2022 fell on a Saturday
  assert.ok(isHoliday('2023-06-19') && !isHoliday('2020-06-19')); // Juneteenth from 2021
  assert.ok(isHoliday('2026-11-26') && isHoliday('2026-10-12'));
  const r = releases('2016-01-01', '2016-12-31');
  assert.equal(r.length, 52);
  assert.ok(r.every((x) => x.skip || ['Wed', 'Thu'].includes(new Date(x.t * 1000).toUTCString().slice(0, 3))));
});

test('placebo days are never the report day or a holiday, and repeat for a seed', () => {
  const rel = releases('2016-01-01', '2020-12-31'), a = placeboDays(rel, 7), b = placeboDays(rel, 7);
  assert.deepEqual(a, b);
  const rep = new Set(rel.map((x) => x.date));
  assert.ok(a.every((x) => !rep.has(x.date) && !isHoliday(x.date)));
  assert.notDeepEqual(a, placeboDays(rel, 8));
});

// synthetic M30 path: 25 quiet candles, the reaction candle at t0, then the rest
const t0 = U('2026-07-15T14:30:00Z'), exitT = U('2026-07-15T20:00:00Z');
function path(after) {
  const bars = [];
  for (let k = 25; k >= 1; k--) bars.push({ time: t0 - k * 1800, open: 50, high: 50.1, low: 49.9, close: 50 });
  bars.push({ time: t0, open: 50, high: 50.5, low: 49.95, close: 50.4 });
  after.forEach((b, k) => bars.push({ time: t0 + (k + 1) * 1800, ...b }));
  return bars;
}
const flat = { open: 50.4, high: 50.45, low: 50.35, close: 50.4 };
const eleven = (lastClose, extra = []) => [...Array(9).fill(flat), { open: 50.4, high: 50.45, low: 50.3, close: lastClose }, ...extra];

test('time exit at 16:00 New York, both rules, costs in R', () => {
  const bars = path(eleven(50.35, [{ open: 99, high: 120, low: 1, close: 2 }])), ix = indexBars(bars);
  const c = trade(bars, ix, t0, exitT, 'C'), f = trade(bars, ix, t0, exitT, 'F');
  assert.equal(c.side, 1); assert.equal(c.entry, 50.4); assert.equal(c.stop, 49.94); assert.equal(c.how, 'time'); assert.equal(c.exit, 50.35);
  assert.ok(Math.abs(c.R - -0.05 / 0.46) < 1e-9 && Math.abs(c.net - (c.R - COST / 0.46)) < 1e-9);
  assert.equal(f.side, -1); assert.equal(f.stop, 50.51); assert.equal(f.how, 'time'); assert.ok(Math.abs(f.R - 0.05 / 0.11) < 1e-9);
});

test('no look-ahead: later candles never change the decision, the ATR or a closed result', () => {
  const a = path(eleven(50.35)), b = path(eleven(50.35, [{ open: 10, high: 90, low: 5, close: 80 }]));
  const ia = indexBars(a), ib = indexBars(b), i0 = ia.get(t0);
  assert.equal(atrBefore(a, i0), atrBefore(b, i0));
  for (const r of ['C', 'F']) assert.deepEqual(trade(a, ia, t0, exitT, r), trade(b, ib, t0, exitT, r));
  // the reaction candle itself is not in the ATR
  const big = a.map((x) => (x.time === t0 ? { ...x, high: 80 } : x));
  assert.equal(atrBefore(big, i0), atrBefore(a, i0));
  // a quiet reaction candle (range under 0.3 x ATR) is skipped
  const q = a.map((x) => (x.time === t0 ? { ...x, high: 50.03, low: 49.99, close: 50.02 } : x));
  assert.equal(trade(q, indexBars(q), t0, exitT, 'C'), null);
});

test('stop first, a gap fills at the open, the stop never moves', () => {
  const s = path([flat, { open: 50.4, high: 50.6, low: 49.9, close: 50.5 }, ...Array(9).fill(flat)]), is = indexBars(s);
  const c = trade(s, is, t0, exitT, 'C'), f = trade(s, is, t0, exitT, 'F');
  assert.equal(c.how, 'stop'); assert.equal(c.exit, 49.94); assert.ok(Math.abs(c.R + 1) < 1e-9);
  assert.equal(f.how, 'stop'); assert.equal(f.exit, 50.51);
  const g = path([flat, { open: 49.8, high: 49.85, low: 49.7, close: 49.8 }, ...Array(9).fill(flat)]);
  const cg = trade(g, indexBars(g), t0, exitT, 'C');
  assert.equal(cg.how, 'gap'); assert.equal(cg.exit, 49.8); assert.ok(cg.R < -1);
  // every trade has its stop on the losing side of its entry
  for (const x of [c, f, cg]) assert.ok((x.entry - x.stop) * x.side > 0);
});

test('verdict rules and Holm', () => {
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(judge({ mean: 0.1, t: 2.5, n: 200 }, { mean: 0.05 }, 0.02, 39).pass, true);
  assert.equal(judge({ mean: 0.1, t: 2.5, n: 120 }, { mean: 0.05 }, 0.02, 39).pass, false);
  assert.equal(judge({ mean: 0.1, t: 2.5, n: 200 }, { mean: -0.05 }, 0.02, 39).pass, false);
  assert.equal(judge({ mean: 0.1, t: 2.5, n: 200 }, { mean: 0.05 }, 0.02, 37).pass, false);
});

test('RESULT.md is the report of result.json, verdict first', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(res));
  assert.match(md.split('\n')[2], new RegExp(`^\\*\\*Verdict: ${res.verdict}, `));
  assert.equal(res.verdict, ['F', 'C'].some((r) => res.rules[r].verdict.pass) ? 'PASS' : 'FAIL');
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(pre, /0\.03/); assert.match(pre, /38 of the 40/);
});
