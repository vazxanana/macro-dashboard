// The last-hour study: New York time with DST, half days, no look-ahead, the stop, the costs, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P, COST, nyT, nyseDay, eligibleDays, toBars, daySignal, trade, sideOf, runMarket, median, monthlyT, monthsOf, holm, placebo, tradesOf,
} from '../research/edge/last-hour/run.mjs';

// a flat day of M5 candles from 04:00 to 20:00 New York at `px`, with `edit(t, bar)` to shape it
function day(date, px = 100, edit = () => {}) {
  const rows = [];
  for (let t = nyT(date, '04:00'); t < nyT(date, '20:00'); t += 300) { const r = [t, px, px, px, px]; edit(t, r, date); rows.push(r); }
  return rows;
}

test('New York time follows daylight saving: 15:00 is 19:00 UTC in summer and 20:00 UTC in winter', () => {
  assert.equal(new Date(nyT('2024-07-15', '15:00') * 1000).toISOString(), '2024-07-15T19:00:00.000Z');
  assert.equal(new Date(nyT('2024-01-15', '15:00') * 1000).toISOString(), '2024-01-15T20:00:00.000Z');
  // the week the US moves its clock and Europe does not
  assert.equal(new Date(nyT('2024-03-11', '09:30') * 1000).toISOString(), '2024-03-11T13:30:00.000Z');
  assert.equal(new Date(nyT('2024-03-08', '09:30') * 1000).toISOString(), '2024-03-08T14:30:00.000Z');
});

test('calendar: half days and closures are never eligible', () => {
  assert.equal(nyseDay('2024-11-29'), 'half');   // day after Thanksgiving
  assert.equal(nyseDay('2024-12-24'), 'half');
  assert.equal(nyseDay('2024-07-03'), 'half');   // 4 July on a Thursday
  assert.equal(nyseDay('2020-07-03'), 'closed');  // 4 July on a Saturday → Friday closed
  assert.equal(nyseDay('2024-03-29'), 'closed');  // Good Friday
  assert.equal(nyseDay('2025-01-09'), 'closed');
  const e = eligibleDays('2024-11-25', '2024-12-31');
  for (const d of ['2024-11-28', '2024-11-29', '2024-12-24', '2024-12-25', '2024-11-30']) assert.ok(!e.includes(d), d);
  assert.ok(e.includes('2024-11-27') && e.includes('2024-12-26'));
  assert.deepEqual(COST, { nas100: 4, spx500: 2, us30: 5 });
});

test('the signal reads nothing that ends after 15:00, and 09:30-15:00 makes the range', () => {
  const d = '2024-07-15', up = (t, r) => { if (t >= nyT(d, '09:30') && t < nyT(d, '15:00')) { const k = (t - nyT(d, '09:30')) / 300; r[1] = 100 + k * 0.1; r[4] = 100 + (k + 1) * 0.1; r[2] = r[4] + 0.05; r[3] = r[1] - 0.05; } else if (t >= nyT(d, '15:00')) r.fill(106.6, 1); };
  const a = day(d, 100, up), s = daySignal(toBars(a), d);
  assert.equal(s.p0, 100); assert.ok(Math.abs(s.pE - 106.6) < 1e-9); assert.equal(s.bars, 66);
  assert.ok(Math.abs(s.range - (106.65 - 99.95)) < 1e-9);
  const b = a.map((r) => (r[0] + 300 > nyT(d, '15:00') ? [r[0], 999, 9999, 1, 999] : r));
  assert.deepEqual({ ...daySignal(toBars(b), d) }, { ...s });
  // a 15:00 candle missing for more than 10 minutes: no signal; fewer than 50 candles: no signal
  assert.equal(daySignal(toBars(a.filter((r) => r[0] < nyT(d, '14:45') || r[0] >= nyT(d, '15:00'))), d), null);
  assert.equal(daySignal(toBars(a.filter((r, i) => i % 2)), d), null);
});

test('stop at 0.5 x range, gap fills at the open, otherwise the 16:00 close; costs over the stop distance', () => {
  const d = '2024-01-16', sig = { date: d, t15: nyT(d, '15:00'), t16: nyT(d, '16:00'), pE: 100, range: 4 };
  const after = (f) => toBars(day(d, 100, (t, r) => { if (t >= sig.t15) f(t, r); }));
  // drifts to 101 by 16:00: long +0.5R gross
  let tr = trade(after((t, r) => r.fill(t + 300 >= sig.t16 ? 101 : 100.5, 1)), sig, 1, 2);
  assert.equal(tr.how, 'time'); assert.equal(tr.dist, 2); assert.equal(tr.stop, 98); assert.equal(tr.R, 0.5); assert.equal(tr.net, 0.5 - 1);
  // a low at 97.9 at 15:20: stopped at 98, -1R
  tr = trade(after((t, r) => { if (t === sig.t15 + 1200) r[3] = 97.9; r[4] = t > sig.t15 + 1200 ? 103 : 100; }), sig, 1, 2);
  assert.equal(tr.how, 'stop'); assert.equal(tr.exit, 98); assert.equal(tr.R, -1);
  // a short whose candle opens above the stop: exits at that open
  tr = trade(after((t, r) => { if (t >= sig.t15 + 600) r.fill(103, 1); }), sig, -1, 2);
  assert.equal(tr.how, 'gap'); assert.equal(tr.exit, 103); assert.equal(tr.R, -1.5);
  assert.equal(sideOf('fade', 0.01), -1); assert.equal(sideOf('follow', 0.01), 1); assert.equal(sideOf('fade', -0.01), 1);
  for (const v of [0.5, 2]) assert.ok(Math.abs(trade(after((t, r) => r.fill(100, 1)), { ...sig, range: v * 2 }, 1, COST.spx500).net + COST.spx500 / v) < 1e-12);
});

test('a big day needs |move| above 1.5 x the median of the 20 days before it; a later price never changes a decision', () => {
  const dates = eligibleDays('2024-02-01', '2024-03-15'), rows = [];
  const mv = (i) => (i === 25 ? 3 : 1);   // 1 % moves, then a 3 % day
  dates.forEach((d, i) => rows.push(...day(d, 100, (t, r) => {
    if (t >= nyT(d, '09:30') && t < nyT(d, '15:00')) { r[2] = 100 + mv(i); r[4] = t + 300 >= nyT(d, '15:00') ? 100 + mv(i) : 100; }
    else if (t >= nyT(d, '15:00')) r.fill(100 + mv(i), 1);
  })));
  const m = runMarket(toBars(rows), 'spx500', dates);
  assert.equal(m.skipped.warmup, 20);
  const rec = m.pool.find((r) => r.date === dates[25]);
  assert.ok(Math.abs(rec.med - 0.01) < 1e-12); assert.equal(rec.big, true);
  assert.equal(m.pool.filter((r) => r.big).length, 1);
  assert.equal(median([3, 1, 2, 10]), 2.5);
  // shaking every price after the day's 15:00 leaves the earlier decisions alone
  const cut = nyT(dates[25], '15:00'), b2 = rows.map((r) => (r[0] >= cut ? [r[0], r[1] * 1.3, r[2] * 1.3, r[3] * 1.3, r[4] * 1.3] : r));
  const m2 = runMarket(toBars(b2), 'spx500', dates);
  for (const r of m.pool.filter((x) => x.date <= dates[25])) { const q = m2.pool.find((x) => x.date === r.date); assert.equal(q.big, r.big); assert.equal(q.med, r.med); assert.equal(q.x, r.x); }
});

test('monthly t counts empty months as 0; Holm; the placebo draws from the window only', () => {
  assert.deepEqual(monthsOf('2015-11-01', '2016-02-10'), ['2015-11', '2015-12', '2016-01', '2016-02']);
  const s = monthlyT([{ date: '2016-01-05', net: 1 }, { date: '2016-01-06', net: 1 }, { date: '2016-03-01', net: 2 }], ['2016-01-01', '2016-03-31']);
  assert.equal(s.n, 3); assert.ok(Math.abs(s.mean - 4 / 3) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  const pool = [{ date: '2016-02-01', big: true, fade: { net: 1 }, follow: { net: -1 } }, { date: '2016-02-02', big: false, fade: { net: 3 }, follow: { net: -3 } },
    { date: '2015-02-02', big: false, fade: { net: 99 }, follow: { net: 99 } }];
  const pl = placebo([{ pool }], 'fade', ['2016-01-01', '2016-12-31'], 40);
  assert.ok(pl.seeds.every((x) => x === 1 || x === 3));
  assert.deepEqual(tradesOf(pool, 'fade', ['2016-01-01', '2016-12-31']), [{ date: '2016-02-01', net: 1 }]);
  assert.equal(P.Q_RANK, 38);
});

test('the report says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/last-hour/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/last-hour/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`^# .*\\n\\n\\*\\*Verdict: ${r.verdict}: [^*]+\\.\\*\\*`));
  const sg = (v, d = 3) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
  for (const [lab, v] of [['Fade', 'fade'], ['Follow', 'follow']]) {
    const x = r.variants[v];
    assert.ok(md.includes(`${lab}, pooled 2016 → 2026-11-12: n ${x.D.n}, ${sg(x.D.net)}R a trade net of costs, t ${sg(x.D.tMonths, 2)}`), lab);
    assert.equal(x.pass.ok, x.pass.netOk && x.pass.tOk && x.pass.repOk && x.pass.holmOk && x.pass.placeboOk);
    assert.equal(x.placebo.seeds.length, 40);
  }
  assert.equal(r.verdict, ['fade', 'follow'].some((v) => r.variants[v].pass.ok) ? 'PASS' : 'FAIL');
  assert.deepEqual(r.costs, { nas100: 4, spx500: 2, us30: 5 });
});
