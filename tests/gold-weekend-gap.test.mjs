// Gold weekend gap study (research/edge/gold-weekend-gap): week boundaries in New York time across both US daylight-saving
// switches, the gap and ATR known at the Friday close (no look-ahead), stop first, the time exit, the rules' skips, and the
// written report against result.json. Offline, on hand-made candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, nyTime, nyParts, shut, weeks, nyDays, atrAt, simTrade, ruleG, ruleH, holm, normP } from '../research/edge/gold-weekend-gap/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const T = (s) => Date.parse(s + 'Z') / 1000;
// flat M5 candles (open = close = px, range ±1) every 5 minutes outside the spot-shut weekend, from a to b
function flat(a, b, px = 2000) { const out = []; for (let t = a; t < b; t += 300) if (!shut(nyParts(t))) out.push({ time: t, open: px, high: px + 1, low: px - 1, close: px }); return out; }
const at = (M5, t) => M5.find((x) => x.time === t);

test('New York times follow US daylight saving (Friday 17:00, Sunday 17:00, Monday 12:00)', () => {
  assert.equal(nyTime(2025, 7, 11, 17), T('2025-07-11T21:00:00'));     // summer: UTC-4
  assert.equal(nyTime(2025, 1, 10, 17), T('2025-01-10T22:00:00'));     // winter: UTC-5
  // fall-back week: Friday 31 Oct 2025 still summer, Sunday 2 Nov already winter (F + 48 h is NOT Sunday 17:00)
  assert.equal(nyTime(2025, 10, 31, 17), T('2025-10-31T21:00:00'));
  assert.equal(nyTime(2025, 11, 2, 17), T('2025-11-02T22:00:00'));
  // spring-forward week: Friday 7 Mar 2025 winter, Sunday 9 Mar summer
  assert.equal(nyTime(2025, 3, 7, 17), T('2025-03-07T22:00:00'));
  assert.equal(nyTime(2025, 3, 9, 17), T('2025-03-09T21:00:00'));
  assert.equal(nyTime(2025, 3, 10, 12), T('2025-03-10T16:00:00'));
  const p = nyParts(T('2025-11-02T22:00:00')); assert.deepEqual([p.wd, p.h], [0, 17]);
});

test('week boundaries across the fall-back switch: Friday\'s last close, the reopen after Sunday 17:00 New York, stray prints ignored', () => {
  const M5 = flat(T('2025-09-20T00:00:00'), T('2025-11-04T00:00:00'));
  // a stray weekend print on Sunday 2 Nov at 21:00 UTC (16:00 New York after the switch): must never be the reopen
  M5.push({ time: T('2025-11-02T21:00:00'), open: 1900, high: 1900, low: 1900, close: 1900 }); M5.sort((a, b) => a.time - b.time);
  const w = weeks(M5).find((x) => x.fri === '2025-10-31');
  assert.ok(!w.skip, w.skip);
  assert.equal(M5[w.iF].time, T('2025-10-31T20:55:00'));                 // the last candle starting before 17:00 New York (21:00 UTC)
  assert.equal(w.sun17, T('2025-11-02T22:00:00'));
  assert.equal(M5[w.iR].time, T('2025-11-02T22:00:00'));                // not the 21:00 stray
  assert.equal(w.noon, T('2025-11-03T17:00:00'));
  assert.equal(w.ro, 2000);
});

test('the gap and ATR are known at the Friday close and the reopen: later candles never change them', () => {
  const M5 = flat(T('2024-01-01T00:00:00'), T('2024-02-14T00:00:00'));
  const iF = M5.findIndex((x) => x.time === T('2024-02-09T21:55:00')), iR = M5.findIndex((x) => x.time === T('2024-02-11T22:00:00'));
  M5[iF].close = 1995; M5[iR].open = 2004;
  const base = weeks(M5).find((x) => x.fri === '2024-02-09');
  assert.equal(base.fc, 1995); assert.equal(base.ro, 2004); assert.equal(base.gap, 9);
  assert.ok(Math.abs(base.atr - 2) < 1e-9, `atr ${base.atr}`);          // flat days, range 2
  // every candle after the reopen candle moves wildly: Friday's close, the reopen, the gap and ATR stay the same
  const M2 = M5.map((x, i) => (i > iR ? { ...x, open: x.open + 50, high: x.high + 80, low: x.low - 80, close: x.close - 50 } : x));
  const w2 = weeks(M2).find((x) => x.fri === '2024-02-09');
  assert.deepEqual([w2.fc, w2.ro, w2.gap, w2.atr], [base.fc, base.ro, base.gap, base.atr]);
  // ATR at the Friday reads days up to Friday's only: a huge Monday does not reach it
  const days = nyDays(M2), fri = Date.UTC(2024, 1, 9) / 86400000;
  assert.ok(Math.abs(atrAt(days, fri) - base.atr) < 1e-9);
});

test('a Good-Friday-like week (no Friday candles) is skipped, not built from Thursday', () => {
  const M5 = flat(T('2024-01-01T00:00:00'), T('2024-02-14T00:00:00')).filter((x) => !(x.time >= T('2024-02-09T05:00:00') && x.time < T('2024-02-09T22:00:00')));
  assert.equal(weeks(M5).find((x) => x.fri === '2024-02-09').skip, 'friday');
});

test('simTrade: the stop is checked first, a gap through the stop exits at the open, the time exit at the last close by noon', () => {
  const c = (t, o, h, l, cl) => ({ time: t, open: o, high: h, low: l, close: cl });
  // a buy at 100, stop 95, target 105; candle 2 holds both: the stop
  let B = [c(0, 100, 100, 100, 100), c(300, 100, 104, 99, 101), c(600, 101, 106, 94, 100)];
  assert.deepEqual(simTrade(B, 0, 1, 100, 5, 105, 95, 99999), { exitT: 600, exitPx: 95, exit: 'stop', R: -1 });
  // a sell at 100, stop 105: candle 1 opens at 107, beyond the stop: out at 107
  B = [c(0, 100, 100, 100, 100), c(300, 107, 108, 106, 107)];
  const g = simTrade(B, 0, -1, 100, 5, 95, 105, 99999); assert.equal(g.exit, 'stop (gap)'); assert.equal(g.exitPx, 107); assert.ok(Math.abs(g.R + 1.4) < 1e-12);
  // the target, alone
  B = [c(0, 100, 100, 100, 100), c(300, 100, 105.5, 99, 104)];
  assert.equal(simTrade(B, 0, 1, 100, 5, 105, 95, 99999).exit, 'target');
  // time exit: candles end at 600, 900, 1200; noon = 900: the close of the candle ending at 900, candle 3 never read
  B = [c(0, 100, 100, 100, 100), c(300, 100, 101, 99, 101), c(600, 101, 102, 100, 102), c(900, 102, 200, 0, 102)];
  assert.deepEqual(simTrade(B, 0, 1, 100, 5, 105, 95, 900), { exitT: 900, exitPx: 102, exit: 'time', R: 0.4 });
});

test('Rule G enters toward Friday\'s close at the reopen candle\'s close; skips a gap filled in the first candle; Rule H waits an hour', () => {
  const M5 = flat(T('2024-01-01T00:00:00'), T('2024-02-14T00:00:00'));
  const iF = M5.findIndex((x) => x.time === T('2024-02-09T21:55:00')), iR = M5.findIndex((x) => x.time === T('2024-02-11T22:00:00'));
  M5[iF].close = 2000;
  for (let i = iR; i < M5.length; i++) M5[i] = { ...M5[i], open: 2003, high: 2003.5, low: 2002.5, close: 2003 };   // gap up $3 (1.5 ATR), never filled
  const w = weeks(M5).find((x) => x.fri === '2024-02-09');
  const g = ruleG(M5, w); assert.equal(g.side, -1); assert.equal(g.entry, 2003); assert.equal(g.target, 2000); assert.equal(g.stop, 2006); assert.equal(g.exit, 'time');
  assert.ok(Math.abs(g.net - (0 - 0.30 / 3)) < 1e-4); assert.ok(Math.abs(g.net2 - (0 - 0.60 / 3)) < 1e-4); assert.equal(g.fin, 0);
  const h = ruleH(M5, w); assert.equal(h.filled, T('2024-02-11T23:00:00'));   // the candle ending one hour after the reopen
  // the reopen candle closes beyond Friday's close: no Rule G trade
  const M2 = M5.slice(); M2[iR] = { ...M2[iR], close: 1999, low: 1998.5 };
  assert.deepEqual(ruleG(M2, weeks(M2).find((x) => x.fri === '2024-02-09')), { skip: 'filled' });
  assert.deepEqual(ruleH(M2, weeks(M2).find((x) => x.fri === '2024-02-09')), { skip: 'filled' });
});

test('Holm over two rules at the one-sided level of t = 2', () => {
  assert.ok(Math.abs(normP(2) - K.ALPHA) < 1e-4);
  assert.deepEqual(holm([normP(2.4), normP(2.05)]), [true, true]);
  assert.deepEqual(holm([normP(2.1), normP(1.0)]), [false, false]);     // the smaller p needs alpha / 2 (t about 2.28)
});

test('RESULT.md says what result.json says', () => {
  const R = JSON.parse(rd('../research/edge/gold-weekend-gap/result.json')), md = rd('../research/edge/gold-weekend-gap/RESULT.md');
  assert.match(md.split('\n').find((l) => /Verdict/.test(l)), new RegExp(R.verdict.split(' ')[0]));
  assert.equal(R.pass, false); assert.equal(R.verdict, 'FAIL');
  const f = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
  for (const k of ['G', 'H']) for (const w of ['dec', 'rep']) { const s = R.rules[k][w];
    assert.ok(md.includes(`| ${k} | ${w === 'dec' ? '2020 to now' : '2010-19'} | ${s.n} | ${(s.win * 100).toFixed(0)} % | ${f(s.gross)} | ${f(s.net)} | ${f(s.net2)} | ${s.t.toFixed(2)} |`), `${k} ${w} row`); }
  assert.ok(md.includes(`${R.weeks.eligibleDec} eligible weeks`));
  assert.ok(md.includes(f(R.placebo.dec.p95)) && md.includes(f(R.placebo.dec.median)));
  for (const b of R.fill.dec) if (b.all.n) assert.ok(md.includes(`${b.all.filled} of ${b.all.n}`), b.bin);
  assert.match(rd('../research/edge/gold-weekend-gap/PREREGISTRATION.md'), /not a test of that book/);
});
