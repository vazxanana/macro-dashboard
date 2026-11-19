// Market intraday momentum study (research/edge/intraday-momentum): DST-correct New York times, the stated NYSE calendar,
// the signal reading nothing after 10:00 (no look-ahead into 15:30), a stop on every trade, the placebo and Holm, and the
// written report against result.json. Offline (synthetic candles only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P, nyT, nyseDay, nyseYear, eligibleDays, toBars, dayPrices, signalOf, trade, runMarket, hitRate, holm, ols, render,
} from '../research/edge/intraday-momentum/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/intraday-momentum/PREREGISTRATION.md');
const U = (s) => Date.parse(s) / 1000;

// a deterministic M5 random walk over every weekday hour from `from` for `days` calendar days
function synth(from, days, seed = 7, shift = null) {
  let s = seed, px = 5000; const rows = [];
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let t = U(from + 'T00:00:00Z'); t < U(from + 'T00:00:00Z') + days * 86400; t += 300) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const o = px, c = o + (rnd() - 0.5) * 4, h = Math.max(o, c) + rnd(), l = Math.min(o, c) - rnd();
    px = c; rows.push([t, o, h, l, c]);
  }
  if (shift) for (const r of rows) if (r[0] >= shift.from) for (let k = 1; k < 5; k++) r[k] += shift.by;
  return rows;
}

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([P.K, P.AVG, P.SEEDS, P.Q, P.ALPHA], [1.5, 20, 40, 0.95, 0.05]);
  assert.deepEqual(P.COST, { spx500: 1.0, nas100: 2.0 });
  assert.equal(P.WIN.B[0], '2016-01-01');
  assert.match(PRE, /1\.5 × A/); assert.match(PRE, /SPX500 1 point/); assert.match(PRE, /NAS100 2 points/); assert.match(PRE, /t ≥ 2/);
  assert.match(PRE, /placebo of 40 seeds/); assert.match(PRE, /Holm/);
});

test('New York times are DST-correct on fixed dates', () => {
  assert.equal(nyT('2026-01-15', '15:30'), U('2026-01-15T20:30:00Z'));   // EST
  assert.equal(nyT('2026-07-15', '15:30'), U('2026-07-15T19:30:00Z'));   // EDT
  assert.equal(nyT('2026-03-06', '10:00'), U('2026-03-06T15:00:00Z'));   // Friday before the switch
  assert.equal(nyT('2026-03-09', '10:00'), U('2026-03-09T14:00:00Z'));   // Monday after (8 Mar 2026)
  assert.equal(nyT('2026-10-30', '16:00'), U('2026-10-30T20:00:00Z'));   // still EDT (US ends 1 Nov)
  assert.equal(nyT('2026-11-02', '16:00'), U('2026-11-02T21:00:00Z'));
  assert.equal(nyT('2008-03-10', '16:00'), U('2008-03-10T20:00:00Z'));   // 2008 switch on 9 Mar
});

test('the stated NYSE calendar', () => {
  for (const d of ['2018-12-05', '2025-01-09', '2012-10-29', '2012-10-30', '2026-04-03', '2026-07-03', '2022-06-20', '2021-12-24', '2017-01-02'])
    assert.equal(nyseDay(d), 'closed', d);
  for (const d of ['2021-12-31', '2010-12-31', '2021-06-18', '2026-07-02']) assert.equal(nyseDay(d), 'open', d);   // no Saturday → Friday for New Year; Juneteenth from 2022
  for (const d of ['2025-07-03', '2025-11-28', '2025-12-24', '2019-07-03', '2018-12-24']) assert.equal(nyseDay(d), 'half', d);
  assert.ok(!nyseYear(2020).half.has('2020-07-02'));   // 4 July on a Saturday: no half day
  assert.ok(!nyseYear(2022).half.has('2022-07-01'));   // 4 July on a Monday: none
  const E = new Set(eligibleDays('2025-11-20', '2025-12-31').map((d) => d.date));
  for (const d of ['2025-11-27', '2025-11-28', '2025-12-01', '2025-12-24', '2025-12-25', '2025-12-26']) assert.ok(!E.has(d), d);
  for (const d of ['2025-11-26', '2025-12-02', '2025-12-23', '2025-12-29']) assert.ok(E.has(d), d);
  const one = eligibleDays('2025-12-29', '2025-12-29')[0];
  assert.equal(one.prev, '2025-12-26');   // previous trading day across the weekend
});

test('no look-ahead: the signal reads nothing after 10:00; the trade nothing after 16:00', () => {
  const d = { date: '2026-02-11', prev: '2026-02-10' };
  const base = toBars(synth('2026-02-02', 14));
  const p = dayPrices(base, d);
  // move every price from 10:00 on: the signal must not change; the 15:30 / 16:00 prices must
  const later = toBars(synth('2026-02-02', 14, 7, { from: nyT(d.date, '10:00'), by: 37 }));
  const q = dayPrices(later, d);
  assert.equal(signalOf(q.p0, q.p10), signalOf(p.p0, p.p10));
  assert.notEqual(q.pE, p.pE);
  // the signal's two prices are candles that ended by 10:00
  const at10 = nyT(d.date, '10:00');
  assert.ok(p.t10 === at10 && p.t0 === nyT(d.prev, '16:00'));
  // a change after 16:00 changes nothing of the day's trade
  const after = toBars(synth('2026-02-02', 14, 7, { from: nyT(d.date, '16:00'), by: 500 }));
  const r1 = runMarket(base, 'spx500', eligibleDays('2026-01-01', '2026-02-11').filter((x) => x.date >= '2026-01-01'));
  const r2 = runMarket(after, 'spx500', eligibleDays('2026-01-01', '2026-02-11').filter((x) => x.date >= '2026-01-01'));
  assert.deepEqual(r1.recs.at(-1), r2.recs.at(-1));
});

test('every trade has a stop; a stop and a gap are filled as stated', () => {
  const t1530 = U('2026-02-11T20:30:00Z'), t16 = U('2026-02-11T21:00:00Z');
  const mk = (rows) => toBars(rows.map((r, i) => [t1530 + i * 300, ...r]));
  // long, A = 2 → stop 3 under 100; the third candle's low touches 96.9
  let b = mk([[100, 101, 99.5, 100.5], [100.5, 101, 99, 99.5], [99.5, 99.8, 96.9, 97.5], [97.5, 98, 97, 97.8], [97.8, 99, 97.5, 98], [98, 98.5, 97.9, 98.2]]);
  let x = trade(b, { t1530, t16, pE: 100, pX: 98.2 }, 1, 2, 1);
  assert.equal(x.stop, 97); assert.equal(x.how, 'stop'); assert.equal(x.exit, 97); assert.equal(x.R, -1); assert.ok(Math.abs(x.net - (-1 - 1 / 3)) < 1e-12);
  // short, gap through the stop at a candle's open → its open
  b = mk([[100, 100.5, 99.5, 100], [104, 104.5, 103, 103.5]]);
  x = trade(b, { t1530, t16, pE: 100, pX: 103.5 }, -1, 2, 1);
  assert.equal(x.stop, 103); assert.equal(x.how, 'gap'); assert.equal(x.exit, 104); assert.ok(Math.abs(x.R - -4 / 3) < 1e-12);
  // no stop hit: out at 16:00
  b = mk([[100, 100.5, 99.5, 100.2]]);
  x = trade(b, { t1530, t16, pE: 100, pX: 100.6 }, 1, 2, 1);
  assert.equal(x.how, 'time'); assert.ok(Math.abs(x.R - 0.2) < 1e-12);
  // on a run, every trade carries a stop on its losing side
  const run = runMarket(toBars(synth('2025-12-01', 70)), 'nas100', eligibleDays('2025-12-01', '2026-02-06'));
  const tr = run.recs.filter((r) => r.tr);
  assert.ok(tr.length > 10);
  for (const r of tr) { assert.ok(r.tr.dist > 0); assert.ok(r.tr.side > 0 ? r.tr.stop < r.tr.entry : r.tr.stop > r.tr.entry); assert.equal(r.tr.side, Math.sign(r.r1)); }
  assert.equal(run.skipped.warmup, 20);
});

test('placebo, Holm and the regression', () => {
  const rows = Array.from({ length: 400 }, (_, i) => ({ r1: i % 3 ? 1 : -1, r2: i % 3 ? 0.5 : -0.5 }));   // a perfect sign
  const h = hitRate(rows); assert.equal(h.hit, 1); assert.equal(h.beats, 40); assert.ok(h.placeboQ95 < 0.6);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(holm([0.04, 0.01]), [0.04, 0.02]);
  const o = ols([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
  assert.ok(Math.abs(o.slope - 1.99) < 1e-9);
});

test('RESULT.md is the rendering of result.json, and the verdict follows the pass bar', () => {
  const j = JSON.parse(rd('../research/edge/intraday-momentum/result.json'));
  assert.equal(rd('../research/edge/intraday-momentum/RESULT.md'), render(j));
  const anyOk = Object.values(j.markets).some((m) => m.B.net > 0 && m.B.t >= 2 && m.B.hit > m.B.placeboQ95 && m.pass.holm < 0.05);
  assert.equal(j.verdict, anyOk ? 'PASS' : 'FAIL');
  assert.match(rd('../research/edge/intraday-momentum/RESULT.md'), new RegExp(`^# .*\\n\\n\\*\\*Verdict: ${j.verdict}\\.`));
  if (j.verdict === 'FAIL') assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-intraday-momentum.md', import.meta.url)));
});
