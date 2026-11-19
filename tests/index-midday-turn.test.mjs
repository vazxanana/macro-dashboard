// US cash-session midday turn study (research/edge/index-midday-turn): DST-correct New York times, the stated NYSE calendar
// (half days skipped), the morning move reading nothing after 11:30, the ATR reading nothing of the trade day, a stop on every
// trade, the filter, month-sum t, Holm, the placebo windows, and the written report against result.json. Offline (synthetic
// candles only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P, TESTS, nyT, nyseDay, eligibleDays, toBars, dayPrices, morningOf, trade, dailyCandles, atrMap, runMarket, monthT, holm,
  median, PLACEBO_STARTS, placebo, build, render,
} from '../research/edge/index-midday-turn/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/index-midday-turn/PREREGISTRATION.md');
const U = (s) => Date.parse(s) / 1000;

function synth(from, days, seed = 7, shift = null) {
  let s = seed, px = 15000; const rows = [];
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let t = U(from + 'T00:00:00Z'); t < U(from + 'T00:00:00Z') + days * 86400; t += 300) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const o = px, c = o + (rnd() - 0.5) * 12, h = Math.max(o, c) + rnd() * 3, l = Math.min(o, c) - rnd() * 3;
    px = c; rows.push([t, o, h, l, c]);
  }
  if (shift) for (const r of rows) if (r[0] >= shift.from) for (let k = 1; k < 5; k++) r[k] += shift.by;
  return rows;
}

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([P.ATR, P.K, P.MED, P.FILT, P.COST, P.COST2, P.SEEDS, P.ALPHA, P.NMIN], [20, 1, 20, 0.25, 0.0004, 0.0008, 40, 0.05, 200]);
  assert.deepEqual([P.OPEN, P.ENTRY, P.EXIT, P.HOLD], ['09:30', '11:30', '14:00', 150]);
  assert.equal(P.WIN.D[0], '2016-01-01'); assert.equal(P.WIN.R[1], '2016-01-01');
  assert.deepEqual(TESTS.map((t) => `${t.id}:${t.sym}:${t.side}`), ['T1:nas100:fade', 'T2:nas100:follow', 'T3:spx500:fade', 'T4:spx500:follow']);
  for (const re of [/0\.25 × M/, /1 × ATR20/, /0\.04 % of notional/, /calendar-month sums/, /Holm/, /40 seeds/, /n ≥ 200/, /intraday-momentum/])
    assert.match(PRE, re);
});

test('New York times are DST-correct', () => {
  assert.equal(nyT('2026-01-15', '11:30'), U('2026-01-15T16:30:00Z'));
  assert.equal(nyT('2026-07-15', '11:30'), U('2026-07-15T15:30:00Z'));
  assert.equal(nyT('2026-03-09', '09:30'), U('2026-03-09T13:30:00Z'));   // after the 8 Mar switch
  assert.equal(nyT('2026-03-06', '09:30'), U('2026-03-06T14:30:00Z'));
  assert.equal(nyT('2026-11-02', '14:00'), U('2026-11-02T19:00:00Z'));
});

test('calendar: full days only, half days and closures skipped', () => {
  for (const d of ['2025-07-03', '2025-11-28', '2025-12-24']) assert.equal(nyseDay(d), 'half', d);
  const E = new Set(eligibleDays('2025-11-20', '2025-12-31'));
  for (const d of ['2025-11-27', '2025-11-28', '2025-12-24', '2025-12-25']) assert.ok(!E.has(d), d);
  for (const d of ['2025-11-26', '2025-12-01', '2025-12-26', '2025-12-29']) assert.ok(E.has(d), d);
});

test('no look-ahead: the move reads nothing after 11:30; the ATR nothing of the trade day; the trade nothing after 14:00', () => {
  const rows = synth('2026-01-01', 70), d = '2026-03-04';
  const b = toBars(rows), px = dayPrices(b, d), A = atrMap(dailyCandles(b, '2026-01-01', '2026-03-10'))(d);
  const moved = rows.map((r) => r[0] >= nyT(d, '11:30') ? [r[0], r[1] * 2, r[2] * 2, r[3] * 2, r[4] * 2] : r);
  const b2 = toBars(moved), px2 = dayPrices(b2, d);
  assert.equal(px2.p0, px.p0); assert.equal(px2.pE, px.pE);   // the 11:25-11:30 candle ends at 11:30: still the same
  assert.equal(morningOf(px2.p0, px2.pE), morningOf(px.p0, px.pE));
  // the ATR of d is unchanged when everything from 17:00 New York of the day before is changed
  const late = rows.map((r) => r[0] >= nyT('2026-03-03', '17:00') ? [r[0], r[1] * 3, r[2] * 3, r[3] * 3, r[4] * 3] : r);
  assert.equal(atrMap(dailyCandles(toBars(late), '2026-01-01', '2026-03-10'))(d), A);
  assert.notEqual(atrMap(dailyCandles(toBars(late), '2026-01-01', '2026-03-10'))('2026-03-05'), A);
  const after = rows.map((r) => r[0] >= nyT(d, '14:00') ? [r[0], r[1] + 500, r[2] + 500, r[3] + 500, r[4] + 500] : r);
  const b3 = toBars(after), x = trade(b, px.tE, px.tX, px.pE, px.pX, 1, A), y = trade(b3, px.tE, px.tX, px.pE, dayPrices(b3, d).pX, 1, A);
  assert.deepEqual(x, y);
});

test('every trade has a stop: a gap through it exits at the open, a touch at the stop, else the 14:00 price', () => {
  const t0 = U('2026-03-04T16:30:00Z'), rows = [];
  for (let k = 0; k < 30; k++) rows.push([t0 + k * 300, 100, 100.5, 99.5, 100]);
  const b = toBars(rows), tX = t0 + 150 * 60;
  const time = trade(b, t0, tX, 100, 101, 1, 2); assert.equal(time.how, 'time'); assert.equal(time.R, 0.5);
  assert.ok(Math.abs(time.net - (0.5 - 0.0004 * 100 / 2)) < 1e-12); assert.ok(time.net2 < time.net);
  const touch = toBars(rows.map((r, i) => i === 5 ? [r[0], 100, 100, 97.5, 99] : r));
  const s = trade(touch, t0, tX, 100, 101, 1, 2); assert.equal(s.how, 'stop'); assert.equal(s.exit, 98); assert.equal(s.R, -1);
  const gap = toBars(rows.map((r, i) => i === 5 ? [r[0], 103, 103.5, 102.5, 103] : r));
  const g = trade(gap, t0, tX, 100, 101, -1, 2); assert.equal(g.how, 'gap'); assert.equal(g.exit, 103); assert.equal(g.R, -1.5);
  assert.equal(g.stop, 102);
});

test('the filter, both sides, and their mirror image before stops', () => {
  const b = toBars(synth('2025-10-01', 120, 11)), { recs, skipped } = runMarket(b, eligibleDays('2025-10-01', '2026-01-27'));
  assert.equal(skipped.warmup, 20);
  const tr = recs.filter((r) => r.follow);
  assert.ok(tr.length > 20);
  let i = 0; const hist = [];
  for (const r of recs) {
    if (hist.length >= 20 && r.ready) {
      const M = median(hist.slice(-20));
      assert.equal(!!r.follow, r.m !== 0 && Math.abs(r.m) >= 0.25 * M, r.date);
    }
    hist.push(Math.abs(r.m)); i++;
  }
  for (const r of tr) {
    assert.equal(r.follow.side, Math.sign(r.m)); assert.equal(r.fade.side, -Math.sign(r.m));
    assert.equal(r.follow.dist, r.A); assert.ok(r.follow.dist > 0);
    if (r.follow.how === 'time' && r.fade.how === 'time') assert.ok(Math.abs(r.follow.R + r.fade.R) < 1e-12);
  }
});

test('statistics: month-sum t, Holm, the placebo windows', () => {
  const m = monthT([{ date: '2020-01-02', v: 1 }, { date: '2020-01-20', v: 1 }, { date: '2020-02-03', v: 1 }, { date: '2020-03-03', v: 3 }]);
  assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 2 * Math.sqrt(3)) < 1e-12);   // sums 2, 1, 3: mean 2, sd 1
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]), [0.04, 0.09, 0.09, 0.5]);
  assert.equal(PLACEBO_STARTS.length, 48); assert.equal(PLACEBO_STARTS[0], 570); assert.equal(PLACEBO_STARTS.at(-1), 810);
  assert.ok(!PLACEBO_STARTS.includes(690)); assert.ok(PLACEBO_STARTS.every((s) => s + 150 <= 960));
  const b = toBars(synth('2025-10-01', 120, 5)), { recs } = runMarket(b, eligibleDays('2025-10-01', '2026-01-27'));
  const pl = placebo(b, recs, ['2025-01-01', '2027-01-01'], 3);
  assert.equal(pl.length, 3); assert.equal(pl[0].n, recs.filter((r) => r.follow).length);
  assert.deepEqual(placebo(b, recs, ['2025-01-01', '2027-01-01'], 3), pl);   // seeded: repeatable
});

test('the written report matches result.json', () => {
  const j = JSON.parse(rd('../research/edge/index-midday-turn/result.json')), md = rd('../research/edge/index-midday-turn/RESULT.md');
  assert.equal(md, render(j));
  assert.match(md, new RegExp(`^\\*\\*Verdict: ${j.verdict}\\.\\*\\*`, 'm'));
  assert.ok(['PASS', 'FAIL'].includes(j.verdict));
  for (const id of ['T1', 'T2', 'T3', 'T4']) {
    const x = j.tests[id], p = x.pass;
    assert.equal(p.ok, x.decisive.net > 0 && x.replication.net > 0 && p.holm < 0.05 && x.decisive.n >= 200);
  }
  assert.equal(j.verdict === 'PASS', Object.values(j.tests).some((x) => x.pass.ok));
  assert.equal(j.markets.nas100.placebo.bySeed.length, 40);
});

test('a synthetic run builds and renders with no figure missing', () => {
  const b = toBars(synth('2015-10-01', 200, 3)), days = eligibleDays('2015-10-01', '2016-04-15');
  const r = runMarket(b, days), pl = placebo(b, r.recs, P.WIN.D, 2);
  const j = build({ nas100: r, spx500: r }, { nas100: pl, spx500: pl });
  assert.ok(!render(j).includes('NaN'));
  assert.ok(j.tests.T1.replication.n > 0 && j.tests.T1.decisive.n > 0);
});
