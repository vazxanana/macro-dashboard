// The Treasury auction cycle study: the date rule on known dates, the short's stop and R, the verdict, the report against
// result.json. Offline: synthetic candles only, plus the committed result.json and RESULT.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auctionDay, weekdayIn, tdDiff, dateCheck, KNOWN, calendar, isUsTradingDay, buildDays, atrAt, trade, netOf, futNetOf, verdictOf, STOP_ATR, HOLD } from '../research/edge/treasury-auction-cycle/run.mjs';

const DIR = new URL('../research/edge/treasury-auction-cycle/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

test('date rule: the two verified dates (council-data Forex Factory calendar) and the holiday move', () => {
  assert.equal(auctionDay('a10', 2026, 11).d, '2026-11-10');      // Wed 11 Nov 2026 is Veterans Day: previous trading day
  assert.equal(auctionDay('a10', 2026, 11).moved, true);
  assert.equal(auctionDay('a30', 2026, 11).d, '2026-11-12');
  assert.equal(auctionDay('a10', 2024, 8).d, '2024-08-07');
  assert.equal(auctionDay('a10', 2024, 11).d, '2024-11-13');
  assert.equal(auctionDay('a30', 2024, 11).d, '2024-11-14');
  assert.equal(weekdayIn(2024, 5, 3, 7), '2024-05-08');
  assert.equal(weekdayIn(2024, 10, 3, 21), '2024-10-23');         // the 5-year rule
  for (let y = 2009; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
    const a = auctionDay('a10', y, m), day = +a.plain.slice(8);
    assert.ok(day >= 7 && day <= 13 && new Date(a.plain + 'T00:00:00Z').getUTCDay() === 3, a.plain);
    assert.ok(isUsTradingDay(a.d), a.d);
  }
  assert.equal(tdDiff('2024-03-12', '2024-03-13'), 1);
  assert.equal(tdDiff('2024-11-08', '2024-11-12'), 1);              // Mon 11 Nov 2024 Veterans Day skipped
  assert.deepEqual(dateCheck(), R.dates.check);
  assert.equal(KNOWN.filter((k) => !/memory/.test(k.src)).length, R.dates.verified);
  assert.ok(R.dates.check.filter((c) => !/memory/.test(c.src)).every((c) => c.diffTradingDays === 0));
});

function synth(from, to, f) {
  const rows = []; let i = 0;
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000, e = Date.parse(to + 'T00:00:00Z') / 1000; t <= e; t += 86400) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const o = f(i - 1), c = f(i); rows.push([t, o, Math.max(o, c) + 0.2, Math.min(o, c) - 0.2, c, 100]); i++;
  }
  return rows;
}

test('the short: stop 1.5 x ATR(20) above the entry, a touch fills at the stop, a gap at the open, R in stop units', () => {
  const rows = synth('2024-01-01', '2024-03-29', (i) => 110 + 0.1 * Math.sin(i));
  const D = buildDays(rows, calendar('2024-01-01', '2024-03-31'));
  const e = D.findIndex((x) => x.d === '2024-03-15'), atr = atrAt(D, e);
  const base = trade(rows, D, e, e + HOLD, -1, 0.0003);
  assert.ok(Math.abs(base.stop - base.entry - STOP_ATR * atr) < 1e-4);
  assert.equal(base.how, 'time');
  assert.ok(Math.abs(base.gross - (base.entry - base.exit) / base.dist) < 1e-12);
  const k = D[e + 2].ri, touch = rows.map((r) => r.slice()); touch[k][2] = base.stop + 1;
  const T = trade(touch, D, e, e + HOLD, -1, 0.0003);
  assert.equal(T.how, 'stop'); assert.ok(Math.abs(T.gross + 1) < 1e-9);
  const gap = rows.map((r) => r.slice()); gap[k][1] = base.stop + base.dist; gap[k][2] = base.stop + base.dist + 0.1;
  const G = trade(gap, D, e, e + HOLD, -1, 0.0003);
  assert.equal(G.how, 'gap'); assert.ok(Math.abs(G.gross + 2) < 1e-3);
  assert.ok(netOf(base) < base.gross && netOf(base, 0) === base.gross && netOf(base, 2) < netOf(base));
  assert.ok(futNetOf(base, 0.019325) < base.gross);
  // no look-ahead: changing candles after the exit changes nothing
  const later = rows.map((r) => r.slice()); for (let i = D[e + HOLD].ri + 1; i < later.length; i++) later[i][2] += 50;
  assert.deepEqual(trade(later, D, e, e + HOLD, -1, 0.0003), base);
});

test('verdict: the four checks of the pre-registration, and result.json agrees', () => {
  const T = R.streams.T1;
  assert.deepEqual(verdictOf(T), { checks: R.checks, verdict: R.verdict });
  assert.equal(R.verdict, 'FAIL');
  assert.equal(T.outOfSample.n, 107); assert.equal(T.inSample.n, 107);
  assert.equal(T.oosFrom, '2017-12'); assert.equal(T.firstMonth, '2009-01'); assert.equal(T.lastMonth, '2026-10');
  assert.equal(T.placebo.means.length, 40);
  assert.ok(T.trades.every((t) => t[5] > t[4] || t[7] !== 'time'));   // every short's stop above its entry
  assert.ok(Object.keys(R.streams).every((k) => R.streams[k].trades.length === R.streams[k].months));
});

test('RESULT.md: verdict line, short opening sentence, figures from result.json', () => {
  const T = R.streams.T1, f = (x) => (x > 0 ? '+' : '') + x.toFixed(3);
  assert.match(MD, /\*\*Verdict: FAIL\.\*\*/);
  const first = MD.split('\n').find((l, i) => i > 0 && l.trim());
  assert.ok(first.length < 220, first);
  for (const s of [f(T.outOfSample.net), f(T.inSample.net), f(T.cost.x2.outOfSample.net), f(T.futures.x1.outOfSample.net), f(T.outOfSample.gross)])
    assert.ok(MD.includes(s.replace('-', '-')), s);
  assert.ok(MD.includes(`t ${T.outOfSample.t.toFixed(2)}`));
  assert.ok(MD.includes(`${T.placebo.beaten} of the 40`));
  assert.ok(MD.includes(`ranks ${T.rankOfZero}th of 21`));
  for (const k of ['L10', 'S30', 'L30', 'S5', 'L5']) assert.ok(MD.includes(`${f(R.streams[k].outOfSample.net)} (${R.streams[k].outOfSample.t.toFixed(2)})`), k);
});
