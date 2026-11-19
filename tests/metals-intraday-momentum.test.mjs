// Intraday momentum on gold, silver and crude (research/edge/metals-intraday-momentum): DST-correct New York session times,
// the CME calendar, the signal reading nothing after the first half hour (no look-ahead), a stop on every trade, month-sum t,
// the placebo and Holm, and the written report against result.json. Offline (hand-made and synthetic candles only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P, COST, SESSION, nyT, eligibleDays, toBars, dayPrices, signalOf, trade, runMarket, monthT, placebo, holm, render,
} from '../research/edge/metals-intraday-momentum/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/metals-intraday-momentum/PREREGISTRATION.md');
const U = (s) => Date.parse(s) / 1000;

// a deterministic M5 random walk over every weekday from `from` for `days` calendar days
function synth(from, days, seed = 7, shift = null) {
  let s = seed, px = 2000; const rows = [];
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let t = U(from + 'T00:00:00Z'); t < U(from + 'T00:00:00Z') + days * 86400; t += 300) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const o = px, c = o + (rnd() - 0.5) * 2, h = Math.max(o, c) + rnd() * 0.5, l = Math.min(o, c) - rnd() * 0.5;
    px = c; rows.push([t, o, h, l, c]);
  }
  if (shift) for (const r of rows) if (r[0] >= shift.from) for (let k = 1; k < 5; k++) r[k] += shift.by;
  return rows;
}

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([P.K, P.AVG, P.SEEDS, P.Q, P.ALPHA, P.MIN_N, P.HALF], [1.5, 20, 40, 0.95, 0.05, 300, 30]);
  assert.deepEqual(COST, { xau: 0.30, xag: 0.03, wtico: 0.04 });
  assert.deepEqual(SESSION.xau, { open: '08:20', close: '13:30' });
  assert.deepEqual(SESSION.xag, { open: '08:20', close: '13:30' });
  assert.deepEqual(SESSION.wtico, { open: '09:00', close: '14:30' });
  assert.deepEqual(P.WIN, { A: ['2007-01-01', '2016-01-01'], B: ['2016-01-01', '2026-11-14'] });
  for (const re of [/1\.5 × A/, /\$0\.30 an ounce/, /\$0\.03 an ounce/, /\$0\.04 a barrel/, /t ≥ 2 on calendar-month sums/, /Holm/, /n ≥ 300/, /40 seeds/, /2× cost/, /owner decision 44/, /stand-alone study/])
    assert.match(PRE, re);
});

test('New York session times are DST-correct', () => {
  assert.equal(nyT('2026-01-15', '08:20'), U('2026-01-15T13:20:00Z'));   // EST
  assert.equal(nyT('2026-07-15', '13:30'), U('2026-07-15T17:30:00Z'));   // EDT
  assert.equal(nyT('2026-03-06', '14:30'), U('2026-03-06T19:30:00Z'));   // Friday before the switch (8 Mar 2026)
  assert.equal(nyT('2026-03-09', '09:00'), U('2026-03-09T13:00:00Z'));   // Monday after
  assert.equal(nyT('2026-03-08', '08:20'), U('2026-03-08T12:20:00Z'));   // the switch day itself, after 02:00
  assert.equal(nyT('2026-10-30', '13:30'), U('2026-10-30T17:30:00Z'));   // still EDT (US ends 1 Nov)
  assert.equal(nyT('2026-11-02', '13:30'), U('2026-11-02T18:30:00Z'));
  assert.equal(nyT('2016-03-14', '08:20'), U('2016-03-14T12:20:00Z'));
});

test('the CME calendar drops holidays and early closes', () => {
  const E = new Set(eligibleDays('xau', '2025-11-20', '2026-01-10'));
  for (const d of ['2025-11-27', '2025-11-28', '2025-12-24', '2025-12-25', '2026-01-01', '2025-11-22', '2025-11-23']) assert.ok(!E.has(d), d);
  for (const d of ['2025-11-26', '2025-12-01', '2025-12-23', '2025-12-26', '2026-01-02']) assert.ok(E.has(d), d);
  const C = new Set(eligibleDays('wtico', '2026-04-01', '2026-04-10'));
  assert.ok(!C.has('2026-04-03'));   // Good Friday
  assert.ok(C.has('2026-04-02') && C.has('2026-04-06'));
  assert.ok(!new Set(eligibleDays('xag', '2026-01-19', '2026-01-19')).has('2026-01-19'));   // MLK: early close
  assert.ok(new Set(eligibleDays('xau', '2026-10-12', '2026-10-12')).has('2026-10-12'));    // Columbus Day: regular hours
});

test('no look-ahead: the signal reads nothing after open + 30 min; the trade nothing after the close', () => {
  const date = '2026-02-11';
  const base = toBars(synth('2026-02-02', 14));
  const p = dayPrices(base, 'xau', date);
  assert.equal(p.tO, nyT(date, '08:20')); assert.equal(p.tS, nyT(date, '08:50')); assert.equal(p.tE, nyT(date, '13:00')); assert.equal(p.tC, nyT(date, '13:30'));
  const later = toBars(synth('2026-02-02', 14, 7, { from: nyT(date, '08:50'), by: 13 }));
  const q = dayPrices(later, 'xau', date);
  assert.equal(signalOf(q.pO, q.pS), signalOf(p.pO, p.pS));
  assert.notEqual(q.pE, p.pE);
  // crude reads its own clock
  const c = dayPrices(base, 'wtico', date);
  assert.equal(c.tS, nyT(date, '09:30')); assert.equal(c.tC, nyT(date, '14:30'));
  // a change after the close changes nothing of the day's trade
  const days = eligibleDays('xau', '2026-01-01', date);
  const after = toBars(synth('2025-12-01', 80, 7, { from: nyT(date, '13:30'), by: 500 }));
  const r1 = runMarket(toBars(synth('2025-12-01', 80)), 'xau', days), r2 = runMarket(after, 'xau', days);
  assert.deepEqual(r1.recs.at(-1), r2.recs.at(-1));
  assert.ok(r1.recs.at(-1).tr);
});

test('every trade has a stop; a stop and a gap are filled as stated', () => {
  const tE = U('2026-02-11T18:00:00Z'), tC = U('2026-02-11T18:30:00Z');
  const mk = (rows) => toBars(rows.map((r, i) => [tE + i * 300, ...r]));
  // long, A = 2 → stop 3 under 100; the third candle's low touches 96.9; cost 0.30
  let b = mk([[100, 101, 99.5, 100.5], [100.5, 101, 99, 99.5], [99.5, 99.8, 96.9, 97.5], [97.5, 98, 97, 97.8], [97.8, 99, 97.5, 98], [98, 98.5, 97.9, 98.2]]);
  let x = trade(b, { tE, tC, pE: 100, pX: 98.2 }, 1, 2, 0.3);
  assert.equal(x.stop, 97); assert.equal(x.how, 'stop'); assert.equal(x.exit, 97); assert.equal(x.R, -1); assert.ok(Math.abs(x.net - (-1 - 0.1)) < 1e-12);
  // short, gap through the stop at a candle's open → its open
  b = mk([[100, 100.5, 99.5, 100], [104, 104.5, 103, 103.5]]);
  x = trade(b, { tE, tC, pE: 100, pX: 103.5 }, -1, 2, 0.3);
  assert.equal(x.stop, 103); assert.equal(x.how, 'gap'); assert.equal(x.exit, 104); assert.ok(Math.abs(x.R - -4 / 3) < 1e-12);
  // no stop hit: out at the close
  b = mk([[100, 100.5, 99.5, 100.2]]);
  x = trade(b, { tE, tC, pE: 100, pX: 100.6 }, 1, 2, 0.3);
  assert.equal(x.how, 'time'); assert.ok(Math.abs(x.R - 0.2) < 1e-12);
  // a candle after the close is never read
  b = mk([[100, 100.5, 99.5, 100.2], [100.2, 100.5, 100, 100.3], [100.3, 100.4, 100.1, 100.2], [100.2, 100.3, 100, 100.1], [100.1, 100.2, 100, 100.1], [100.1, 100.2, 100, 100.1], [100.1, 100.1, 50, 60]]);
  assert.equal(trade(b, { tE, tC, pE: 100, pX: 100.1 }, 1, 2, 0.3).how, 'time');
  // on a run, every trade carries a stop on its losing side, the signal's sign, and its mirror for the placebo
  for (const sym of ['xau', 'xag', 'wtico']) {
    const run = runMarket(toBars(synth('2025-10-01', 120)), sym, eligibleDays(sym, '2025-10-01', '2026-01-28'));
    const tr = run.recs.filter((r) => r.tr);
    assert.ok(tr.length > 30, sym);
    for (const r of tr) {
      assert.ok(r.tr.dist > 0); assert.ok(r.tr.side > 0 ? r.tr.stop < r.tr.entry : r.tr.stop > r.tr.entry); assert.equal(r.tr.side, Math.sign(r.r1));
      assert.equal(r.alt.side, -r.tr.side); assert.equal(r.alt.dist, r.tr.dist);
    }
    assert.equal(run.skipped.warmup, 20);
  }
});

test('month-sum t, placebo and Holm', () => {
  const m = monthT([{ date: '2020-01-02', x: 1 }, { date: '2020-01-20', x: 1 }, { date: '2020-02-03', x: 1 }, { date: '2020-03-03', x: 3 }]);
  assert.equal(m.months, 3); assert.ok(Math.abs(m.mean - 2) < 1e-12);
  // a perfect sign: the rule beats every seed
  const rows = Array.from({ length: 400 }, (_, i) => { const s = i % 3 ? 1 : -1;
    return { date: '2020-01-01', r1: s, r2: s * 0.01, tr: { side: s, net: 0.5 }, alt: { side: -s, net: -0.7 } }; });
  const p = placebo(rows);
  assert.equal(p.hit, 1); assert.equal(p.beats, 40); assert.equal(p.hitBeats, 40); assert.ok(p.netQ95 < 0); assert.ok(p.hitQ95 < 0.6);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('RESULT.md is the rendering of result.json, and the verdict follows the pass bar', () => {
  const j = JSON.parse(rd('../research/edge/metals-intraday-momentum/result.json'));
  assert.equal(rd('../research/edge/metals-intraday-momentum/RESULT.md'), render(j));
  assert.deepEqual(Object.values(j.tests).map((m) => m.test), ['T1', 'T2', 'T3']);
  const ps = Object.values(j.tests).map((m) => m.pass.p), hp = holm(ps);
  Object.values(j.tests).forEach((m, i) => {
    assert.ok(Math.abs(m.pass.holm - hp[i]) < 1e-3);
    const ok = m.A.net > 0 && m.B.net > 0 && m.B.tMonth >= 2 && m.pass.holm < 0.05 && m.B.n >= 300;
    assert.equal(m.pass.ok, ok, m.test);
  });
  const anyOk = Object.values(j.tests).some((m) => m.pass.ok);
  assert.equal(j.verdict, anyOk ? 'PASS' : 'FAIL');
  assert.match(rd('../research/edge/metals-intraday-momentum/RESULT.md'), new RegExp(`^# .*\\n\\n\\*\\*Verdict: ${j.verdict}\\*\\*`));
  assert.match(j.standAlone, /owner decision 44/);
});
