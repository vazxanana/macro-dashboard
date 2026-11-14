// fx-tokyo-orb (research/edge/fx-tokyo-orb): the Tokyo opening range and its skips without look-ahead, the signal, the
// entry at the next open, the stop on the other side, the 06:00 UTC exit, the cost maths, the placebo, and RESULT.md
// against result.json. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { days, trade, tradesOf, costPx, manage, placeboTrade, rng, monthT, holm, report, atrBefore, dailies, K } from '../research/edge/fx-tokyo-orb/run.mjs';

const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000;
const DIR = new URL('../research/edge/fx-tokyo-orb/', import.meta.url);

// weekday M15 candles at 0.7000; each day's range hour 00:00-01:00 spans `r` around it, the rest of the day spans 0.0005 inside it
function series(nDays, from = U(2024, 6, 3), rangeOf = () => 0.0020, volOf = () => 100) {
  const B = [];
  for (let d = 0, day = from; d < nDays; day += 86400) {
    const wd = new Date(day * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const r = rangeOf(d), v = volOf(d);
    for (let t = day; t < day + 86400; t += 900) {
      const inR = t < day + 3600, half = inR ? r / 2 : 0.00025;
      B.push({ time: t, open: 0.7, high: 0.7 + half, low: 0.7 - half, close: 0.7, volume: inR ? v : 50 });
    }
    d++;
  }
  return B;
}
const at = (B, t) => B.findIndex((b) => b.time === t);

test('daily ATR: Monday-Friday UTC days from M15, today excluded, warm-up needs 15 earlier days', () => {
  const B = series(30), D = dailies(B);
  assert.equal(D.length, 30);
  assert.ok(Math.abs(D[0].high - D[0].low - 0.002) < 1e-12);
  assert.equal(atrBefore(D, D[14].day), null);
  assert.ok(Math.abs(atrBefore(D, D[15].day) - 0.002) < 1e-12);
});

test('range and skips: the four 00:00-00:45 candles, warm-up, new year, thin volume, narrow; nothing after 01:00 read', () => {
  const B = series(30, U(2024, 6, 3), (d) => (d === 24 ? 0.0004 : 0.0020), (d) => (d === 25 ? 30 : 100));
  const ds = days(B);
  assert.equal(ds.length, 30);
  assert.equal(ds[0].skip, 'warm-up'); assert.equal(ds[14].skip, 'warm-up'); assert.equal(ds[19].skip, 'warm-up');
  assert.equal(ds[20].skip, null); assert.equal(ds[21].skip, null);
  assert.ok(Math.abs(ds[21].range - 0.002) < 1e-12); assert.ok(Math.abs(ds[21].atr - 0.002) < 1e-12); assert.equal(ds[21].vmed, 400, 'the summed volume of the four range candles');
  assert.equal(ds[24].skip, 'narrow', 'range 0.0004 < 0.25 x ATR 0.002');
  assert.equal(ds[25].skip, 'thin', 'volume 4 x 30 < 0.5 x median 400');
  // change every candle from 01:00 of day 21 on: its range, ATR, volume median and skip do not move
  const C = B.map((b) => ({ ...b })); for (const b of C) if (b.time >= ds[21].day + 3600 && b.time < ds[21].day + 86400) { b.high = 9; b.low = 0.1; b.volume = 1e9; }
  const es = days(C);
  for (const k of ['hi', 'lo', 'range', 'atr', 'vmed', 'vol', 'skip']) assert.equal(es[21][k], ds[21][k]);
  // a missing range candle: no day
  const E = B.filter((b) => b.time !== ds[22].day + 1800);
  assert.equal(days(E).some((d) => d.day === ds[22].day), false);
  // 1 January and the first other weekday of the year are skipped
  const Y = series(40, U(2024, 11, 25)), ys = days(Y);
  assert.equal(ys.find((d) => d.day === U(2025, 1, 1)).skip, 'new-year');
  assert.equal(ys.find((d) => d.day === U(2025, 1, 2)).skip, 'new-year');
  assert.equal(ys.find((d) => d.day === U(2025, 1, 3)).skip, null);
});

function dayWith(mod) {
  const B = series(23); const d = days(B)[22];
  assert.equal(d.skip, null);
  mod(B, d, (hh, mm = 0) => at(B, d.day + hh * 3600 + mm * 60));
  return { B, d: days(B)[22] };
}

test('signal: the first M15 close above the range from the 01:00 candle on; entry at the next open; stop the low; exit at the 06:00 close', () => {
  const { B, d } = dayWith((B, d, i) => {
    const k = i(2, 0); B[k].high = d.hi + 0.0006; B[k].close = d.hi + 0.0005;
    for (let j = k + 1; B[j].time < d.day + 6 * 3600; j++) { B[j].open = B[j].close = d.hi + 0.0008; B[j].high = d.hi + 0.0010; B[j].low = d.hi + 0.0004; }
  });
  const t = trade('audusd', B, d);
  assert.equal(t.side, 1); assert.equal(t.sigAt, d.day + 2 * 3600); assert.equal(t.at, d.day + 2 * 3600 + 900);
  assert.ok(Math.abs(t.entry - (d.hi + 0.0008)) < 1e-12); assert.equal(t.stop, d.lo);
  assert.equal(t.exit, 'time'); assert.equal(t.exitAt, d.day + 5 * 3600 + 45 * 60);
  assert.ok(Math.abs(t.gross) < 1e-9);
  // a wick beyond the range without a close beyond it is no signal; a close beyond at 00:45 (inside the range hour) is no signal
  const q = dayWith((B, d, i) => { B[i(1, 0)].high = d.hi + 0.001; B[i(0, 45)].close = d.hi; });
  assert.equal(trade('audusd', q.B, q.d), null);
});

test('signal window: the 05:30 candle can signal (entry 05:45), the 05:45 candle cannot', () => {
  let { B, d } = dayWith((B, d, i) => { B[i(5, 30)].close = d.lo - 0.0001; });
  let t = trade('audusd', B, d);
  assert.equal(t.side, -1); assert.equal(t.at, d.day + 5 * 3600 + 45 * 60); assert.equal(t.stop, d.hi);
  ({ B, d } = dayWith((B, d, i) => { B[i(5, 45)].close = d.lo - 0.0001; }));
  assert.equal(trade('audusd', B, d), null);
});

test('stop: touched at the stop, a gap through it exits at the open, an entry open beyond the stop is no trade', () => {
  let { B, d } = dayWith((B, d, i) => { const k = i(1, 0); B[k].close = d.hi + 0.0002; B[i(3, 0)].low = d.lo - 0.0001; });
  let t = trade('audusd', B, d);
  assert.equal(t.exit, 'stop'); assert.equal(t.exitPx, d.lo); assert.ok(Math.abs(t.gross + 1) < 1e-9);
  ({ B, d } = dayWith((B, d, i) => { B[i(1, 0)].close = d.hi + 0.0002; const k = i(3, 0); B[k].open = B[k].low = d.lo - 0.0005; }));
  t = trade('audusd', B, d);
  assert.equal(t.exit, 'stop'); assert.ok(Math.abs(t.exitPx - (d.lo - 0.0005)) < 1e-12); assert.ok(t.gross < -1);
  ({ B, d } = dayWith((B, d, i) => { B[i(1, 0)].close = d.hi + 0.0002; const k = i(1, 15); B[k].open = d.lo - 0.0001; }));
  assert.equal(trade('audusd', B, d), null);
});

test('no look-ahead: changing every candle after the exit leaves the trade as it was', () => {
  const { B, d } = dayWith((B, d, i) => { B[i(1, 30)].close = d.hi + 0.0003; });
  const a = trade('audusd', B, d), C = B.map((b) => (b.time >= d.day + 6 * 3600 ? { ...b, open: 5, high: 9, low: 0.1, close: 5 } : b));
  assert.deepEqual(trade('audusd', C, days(C)[22]), a);
  // one trade a day: a later close on the other side the same morning does not add a second
  const { B: B2 } = dayWith((B, d, i) => { B[i(1, 30)].close = d.hi + 0.0003; B[i(3, 0)].close = d.lo - 0.0003; });
  assert.equal(tradesOf('audusd', B2).filter((t) => t.day === d.day).length, 1);
});

test('costs: 0.3 pip spread + 2 x 22.5e-6 x price + 1 pip slippage (entry and exit), twice at 2x', () => {
  assert.ok(Math.abs(costPx('audusd', 0.7) - (0.3e-4 + 2 * 22.5e-6 * 0.7 + 1e-4)) < 1e-15);
  assert.ok(Math.abs(costPx('usdjpy', 150) - (0.003 + 2 * 22.5e-6 * 150 + 0.01)) < 1e-12);
  assert.ok(Math.abs(costPx('usdjpy', 150, 2) - 2 * costPx('usdjpy', 150)) < 1e-12);
});

test('placebo: same entry candle and stop distance, the side drawn at random; seeded', () => {
  const { B, d } = dayWith((B, d, i) => { B[i(1, 30)].close = d.hi + 0.0003; });
  const t = trade('audusd', B, d), buy = placeboTrade('audusd', B, t, 0.2), sell = placeboTrade('audusd', B, t, 0.8);
  assert.equal(buy.side, 1); assert.equal(sell.side, -1);
  for (const q of [buy, sell]) { assert.equal(q.entry, t.entry); assert.ok(Math.abs(q.r0 - t.r0) < 1e-12); assert.equal(q.at, t.at); }
  assert.ok(Math.abs(sell.stop - (t.entry + t.r0)) < 1e-12);
  const a = rng(7), b = rng(7); assert.equal(a(), b());
});

test('statistics: month sums count empty months as 0; Holm', () => {
  const m = monthT([{ at: U(2020, 1, 5), net: 1 }, { at: U(2020, 3, 5), net: 1 }], U(2020, 1, 1), U(2020, 4, 1));
  assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 2) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.equal(typeof manage, 'function');
});

test('RESULT.md is the report of result.json, the verdict first, and the study changes nothing live', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8'), rd = fs.readFileSync(new URL('READING.md', DIR), 'utf8');
  assert.equal(md, report(R, rd));
  assert.match(md.split('\n')[2], /^\*\*Verdict: (PASS|FAIL)/);
  assert.equal(Object.keys(R.tests).join(), 'T1,T2,T3');
  assert.deepEqual(Object.values(R.tests).map((x) => x.pair), ['usdjpy', 'audusd', 'nzdusd']);
  for (const V of Object.values(R.tests)) {
    assert.equal(V.verdict, Object.values(V.checks).every(Boolean) ? 'PASS' : 'FAIL');
    assert.equal(V.checks['decisive n >= 300'], V.decisive.n >= 300);
    assert.equal(V.placebo.seeds, 40);
  }
  assert.ok(R.verdict.startsWith(Object.values(R.tests).some((v) => v.verdict === 'PASS') ? 'PASS' : 'FAIL'));
  assert.equal(R.params.SPREAD_PIP, 0.3); assert.equal(R.params.COMM_SIDE, 22.5e-6); assert.equal(R.params.SLIP_PIP, 0.5);
  assert.match(md, /nothing live changed/i);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(pre, /Paper research only/); assert.match(pre, /00:00-01:00 UTC/);
  // the study imports nothing of the council, the mirror or the API
  const src = fs.readFileSync(new URL('run.mjs', DIR), 'utf8');
  assert.doesNotMatch(src, /from '\.\.\/\.\.\/\.\.\/(council|api)\//);
});
