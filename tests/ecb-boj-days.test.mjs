// research/edge/ecb-boj-days: the event list, the ECB minute in Frankfurt time with daylight time, the BoJ release candle
// found from candles up to it only, the stop side, the time exit, the month-sum t and Holm, and RESULT.md against
// result.json. Offline: synthetic candles only and the committed result files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { eventDates, bannedOf, toBars, ecbMinute, bojRelease, atrAt, trade, monthT, holm, pOne, judge, standIns, costOf, headline, report, P, DATES }
  from '../research/edge/ecb-boj-days/run.mjs';
import { zonedToUtc } from '../council/events.mjs';

const DIR = new URL('../research/edge/ecb-boj-days/', import.meta.url);
const M5 = 300, FRA = 'Europe/Berlin', T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

test('event list: weekdays, sorted, the council calendar from August 2025, unscheduled kept apart', () => {
  for (const bank of ['ECB', 'BOJ']) {
    const ds = eventDates(bank);
    assert.deepEqual(ds, [...ds].sort());
    for (const d of ds) assert.ok(![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay()), d);
    for (const u of DATES[bank].unscheduled) assert.ok(!ds.includes(u) && bannedOf(bank).has(u), u);
  }
  assert.ok(eventDates('ECB').includes('2025-10-30') && eventDates('BOJ').includes('2026-10-30'));
});

test('ECB minute: Frankfurt time to UTC with daylight time (14:15 is 12:15 UTC in summer, 13:15 UTC in winter)', () => {
  assert.equal(zonedToUtc('2024-07-18', '14:15', FRA), Date.UTC(2024, 6, 18, 12, 15) / 1000);
  assert.equal(zonedToUtc('2024-12-12', '14:15', FRA), Date.UTC(2024, 11, 12, 13, 15) / 1000);
  assert.equal(zonedToUtc('2015-01-22', '13:45', FRA), Date.UTC(2015, 0, 22, 12, 45) / 1000);
  assert.equal(zonedToUtc('2015-07-16', '13:45', FRA), Date.UTC(2015, 6, 16, 11, 45) / 1000);
});

// a flat market: every M5 candle of the 50 days before has range `r`; `bar` adds or replaces candles
function flat(lastDate, r = 0.0002, px = 1.1, bars = []) {
  const rows = new Map(), end = T0(lastDate) + 86400;
  for (let t = end - 50 * 86400; t < end; t += M5) { const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue; rows.set(t, [t, px, px + r / 2, px - r / 2, px]); }
  for (const x of bars) rows.set(x[0], x);
  return toBars([...rows.values()].sort((a, b) => a[0] - b[0]));
}

test('ECB clock check picks the larger candidate candle and reads nothing after it', () => {
  const date = '2024-12-12', A = zonedToUtc(date, '13:45', FRA), B = zonedToUtc(date, '14:15', FRA);
  let b = flat(date, 0.0002, 1.1, [[B, 1.1, 1.103, 1.099, 1.102]]);
  let m = ecbMinute(b, date, new Set());
  assert.equal(m.local, '14:15'); assert.equal(m.T, B); assert.equal(m.confirmed, true);
  b = flat(date, 0.0002, 1.1, [[A, 1.1, 1.103, 1.099, 1.102]]);
  m = ecbMinute(b, date, new Set());
  assert.equal(m.local, '13:45'); assert.equal(m.T, A);
});

test('BoJ release candle: the first one from 03:00 UTC over 2x the hour median, found from candles up to it only', () => {
  const date = '2024-12-19', d0 = T0(date);
  const spike = [d0 + 3 * 3600 + 20 * 60, 150, 150.5, 149.6, 150.3];
  const b = flat(date, 0.02, 150, [[d0 + 2 * 3600 + 55 * 60, 150, 151, 149, 150], spike]);   // a big candle before 03:00 does not count
  const r = bojRelease(b, date, new Set());
  assert.equal(r.T, spike[0]);
  // every candle after the release candle changed: the same answer (no look-ahead)
  const later = []; for (let t = spike[0] + M5; t < d0 + 86400; t += M5) later.push([t, 1, 1000, 0.1, 500]);
  const b2 = flat(date, 0.02, 150, [[d0 + 2 * 3600 + 55 * 60, 150, 151, 149, 150], spike, ...later]);
  assert.deepEqual(bojRelease(b2, date, new Set()), r);
  // no spike before 05:00 UTC: skipped; a spike at 05:00 is too late
  assert.equal(bojRelease(flat(date, 0.02, 150, [[d0 + 5 * 3600, 150, 152, 148, 150]]), date, new Set()).skip, 'no release bar');
  // BoJ days are left out of the baseline; with too few days, no trade
  const ban = new Set(); for (let k = 1; k <= 45; k++) ban.add(new Date((d0 - k * 86400) * 1000).toISOString().slice(0, 10));
  assert.equal(bojRelease(b, date, ban).skip, 'no baseline');
});

test('ATR from closed one-hour candles before D only; the stop on the losing side; the time exit; costs', () => {
  const date = '2024-12-12', D = zonedToUtc(date, '14:15', FRA);   // 13:15 UTC
  const ev = [[D, 1.1, 1.1035, 1.0995, 1.1030]];   // the decision candle (largest at 14:15)
  for (let t = D + M5; t < D + 3600; t += M5) ev.push([t, 1.103, 1.1032, 1.1028, 1.103]);   // first hour: up, close 1.103
  const tail = []; for (let t = D + 3600; t < T0(date) + 23 * 3600; t += M5) tail.push([t, 1.103, 1.1031, 1.1029, t + M5 > T0(date) + 21 * 3600 ? 2 : 1.104]);
  const b = flat(date, 0.0002, 1.1, [...ev, ...tail]);
  const atr = atrAt(b, D);
  assert.ok(Math.abs(atr - 0.0002) < 1e-12);   // only the flat hours before 13:00 UTC count
  const x = trade(b, 'ECB', 'eurusd', date, new Set());
  assert.equal(x.d, 1); assert.equal(x.entry, 1.103); assert.ok(x.stop < x.entry); assert.ok(Math.abs(x.entry - x.stop - atr) < 1e-12);
  assert.equal(x.why, 'time'); assert.equal(x.exitT, T0(date) + 21 * 3600); assert.equal(x.exit, 1.104);
  assert.ok(Math.abs(x.costR - costOf('eurusd', 1.103) / atr) < 1e-12);
  assert.ok(Math.abs(costOf('eurusd', 1.1) - (0.6e-4 + 45e-6 * 1.1)) < 1e-15);
  assert.ok(Math.abs(costOf('usdjpy', 150) - (0.006 + 45e-6 * 150)) < 1e-12);
  // a sell: the stop sits above the entry; a candle opening beyond it exits at its open
  const evS = [[D, 1.1, 1.1005, 1.0965, 1.097]];
  for (let t = D + M5; t < D + 3600; t += M5) evS.push([t, 1.097, 1.0972, 1.0968, 1.097]);
  const bS = flat(date, 0.0002, 1.1, [...evS, [D + 3600, 1.098, 1.0985, 1.0975, 1.098]]);
  const s = trade(bS, 'ECB', 'eurusd', date, new Set());
  assert.equal(s.d, -1); assert.ok(s.stop > s.entry); assert.equal(s.why, 'gap'); assert.equal(s.exit, 1.098);
});

test('month-sum t counts empty months as 0; Holm; the pass bar; the placebo pool', () => {
  const trs = [{ date: '2024-01-10', net: 1 }, { date: '2024-03-10', net: 1 }];
  const m = monthT(trs, T0('2024-01-01'), T0('2024-05-01'));
  assert.equal(m.months, 4);
  assert.ok(Math.abs(m.t - 0.5 / (Math.sqrt(1 / 3) / 2)) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04]).map((x) => +x.toFixed(4)), [0.02, 0.04]);
  assert.ok(Math.abs(pOne(1.6449) - 0.05) < 1e-4);
  const good = { n: 70, mean: 0.2, mt: 2.4 };
  assert.equal(judge(good, { mean: 0.1 }, 0.02, 0.1).pass, true);
  assert.equal(judge(good, { mean: -0.1 }, 0.02, 0.1).pass, false);
  assert.equal(judge({ ...good, mt: 1.9 }, { mean: 0.1 }, 0.02, 0.1).pass, false);
  assert.equal(judge(good, { mean: 0.1 }, 0.02, 0.3).pass, false);
  const pool = standIns('2024-07-18', P.W.dec, 'ECB');
  assert.ok(pool.length > 150);
  for (const d of pool) for (const e of bannedOf('ECB')) assert.ok(Math.abs(Date.parse(d) - Date.parse(e)) > 3 * 864e5, d + ' ' + e);
});

test('result.json and RESULT.md agree; the verdict is the pre-registered rule', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(r));
  assert.ok(md.includes(headline(r)));
  assert.equal(r.tests.length, 2);
  assert.equal(r.verdict, r.tests.some((x) => x.pass) ? 'PASS' : 'FAIL');
  for (const x of r.tests) assert.equal(x.pass, x.n >= 40 && x.netR > 0 && x.monthT >= 2 && x.holmP < 0.05 && x.repNetR > 0 && x.netR > x.placeboP95);
  assert.match(md, /not a test of the gold book/);
  assert.ok(fs.existsSync(new URL('PREREGISTRATION.md', DIR)) && fs.existsSync(new URL('dates.json', DIR)));
});
