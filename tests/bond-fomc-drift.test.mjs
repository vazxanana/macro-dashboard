// Bond FOMC drift study (research/edge/bond-fomc-drift): New York times across daylight saving, the signal reading only
// decision-day candles, the entry on the next trading day, the stop side and the gap fill on hourly blocks, financing nights,
// the copied event list against council/events.mjs, and the committed result against the written report. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, MARKETS, ny, addDay, signal, atrAt, simulate, trade, nextTradingDays, isTradingDay, costs, finRate, dgs2At, holm, pOneSided, tOf, monthSums, placeboPool, headline, windowOf } from '../research/edge/bond-fomc-drift/run.mjs';
import { fomcDates, clockOf, UNSCHEDULED } from '../research/edge/bond-fomc-drift/events.mjs';
import { HISTORY, EVENTS } from '../council/events.mjs';
import { nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/bond-fomc-drift/PREREGISTRATION.md'), RUN = rd('../research/edge/bond-fomc-drift/run.mjs'), RES = rd('../research/edge/bond-fomc-drift/RESULT.md');
const J = JSON.parse(rd('../research/edge/bond-fomc-drift/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

// M5 candles [t, o, h, l, c] for a list of New York days, 08:00 to 17:00, flat at `px` unless `f(t)` says otherwise
function day5m(dates, f = () => null, px = 100) {
  const out = [];
  for (const d of dates) for (let t = ny(d, '08:00'); t < ny(d, '17:00'); t += 300) { const o = f(t) || [px, px, px, px]; out.push([t, ...o]); }
  return out;
}
const daily = (n, end, tr = 1) => Array.from({ length: n }, (_, i) => ({ time: end - (n - i) * 86400, open: 100, high: 100 + tr / 2, low: 100 - tr / 2, close: 100 }));

test('constants are the pre-registered ones', () => {
  assert.deepEqual([P.COST, P.STOP_K, P.ATR_N, P.FIN_ADD, P.SEEDS, P.GAP_DAYS], [0.001, 1.5, 20, 2.5, 40, 5]);
  assert.deepEqual(P.A, ['2008-01-01', '2015-12-31']); assert.deepEqual(P.B, ['2016-01-01', '2026-11-13']);
  assert.deepEqual(MARKETS, { T1: 'usb10y', T2: 'usb30y' });
  for (const s of ['**0.10 % of the entry price a round trip**', '1.5 x ATR(20)', '**Decisive: 2016-01-01 to 2026-11-13.**', '**Placebo, 40 seeds**', 'Holm over these two']) assert.ok(PRE.includes(s), s);
  assert.equal(windowOf('2015-12-16'), 'a'); assert.equal(windowOf('2016-01-27'), 'b'); assert.equal(windowOf('2007-12-11'), null);
});

test('New York times are DST-correct', () => {
  assert.equal(ny('2024-01-31', '14:00'), Date.UTC(2024, 0, 31, 19, 0) / 1000);   // EST
  assert.equal(ny('2024-07-31', '14:00'), Date.UTC(2024, 6, 31, 18, 0) / 1000);   // EDT
  assert.equal(ny('2025-03-07', '09:30'), Date.UTC(2025, 2, 7, 14, 30) / 1000);   // Friday before the switch
  assert.equal(ny('2025-03-10', '09:30'), Date.UTC(2025, 2, 10, 13, 30) / 1000);  // Monday after
  assert.equal(ny('2024-11-01', '16:00'), Date.UTC(2024, 10, 1, 20, 0) / 1000);
  assert.equal(ny('2024-11-04', '16:00'), Date.UTC(2024, 10, 4, 21, 0) / 1000);
  assert.equal(clockOf('2012-04-25'), '12:30'); assert.equal(clockOf('2012-08-01'), '14:15'); assert.equal(clockOf('2013-01-30'), '14:00');
});

test('the event list: 2022 on equals council/events.mjs, unscheduled ones are out', () => {
  const ds = fomcDates(), fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
  const council = [...new Set([...HISTORY, ...EVENTS].filter((e) => e.type === 'FOMC').map((e) => (e.local ? e.local.slice(0, 10) : fmt.format(new Date(e.t * 1000)))))].filter((d) => d >= '2022-01-01').sort();
  assert.deepEqual(ds.filter((d) => d >= '2022-01-01' && d <= council.at(-1)), council.filter((d) => d <= '2026-12-31'));
  for (const u of UNSCHEDULED) assert.ok(!ds.includes(u), u);
  assert.ok(!ds.includes('2020-03-18'));
  for (const d of ds) assert.ok(new Date(d + 'T12:00:00Z').getUTCDay() >= 1 && new Date(d + 'T12:00:00Z').getUTCDay() <= 5, d);
  assert.ok(!/from ['"][^'"]*(pre-fomc-drift|fomc-follow|tsmom|index-overnight)/.test(RUN), 'no import from another study');
});

test('the signal reads only decision-day candles between the statement and 16:00', () => {
  const D = '2024-07-31', f = (t) => (t >= ny(D, '14:00') && t < ny(D, '16:00') ? [101, 101, 101, 101] : null);
  const b2 = day5m(['2024-07-30', D, '2024-08-01'], f);
  const s = signal(b2, D, '14:00');
  assert.equal(s.side, 1); near(s.s, 1); assert.equal(s.t0, ny(D, '13:55')); assert.equal(s.t1, ny(D, '16:00'));
  // changing every candle after 16:00 on D, or on any other day, changes nothing
  const later = b2.map((r) => (r[0] >= ny(D, '16:00') ? [r[0], 50, 50, 50, 50] : r));
  assert.deepEqual(signal(later, D, '14:00'), s);
  // a fall is a sell, no change no trade
  assert.equal(signal(day5m([D], (t) => (t >= ny(D, '14:00') ? [99, 99, 99, 99] : null)), D, '14:00').side, -1);
  assert.equal(signal(day5m([D]), D, '14:00').side, 0);
  // 12:30 statement: the window starts at 12:25
  assert.equal(signal(b2, D, '12:30').t0, ny(D, '12:25'));
});

test('entry is the 09:30 open of the next trading day; exit the 16:00 close of the third', () => {
  const D = '2024-07-31', days = ['2024-07-31', '2024-08-01', '2024-08-02', '2024-08-05', '2024-08-06'];
  const bars = day5m(days, (t) => (t === ny('2024-08-01', '09:30') ? [100.5, 100.6, 100.4, 100.5] : t === ny('2024-08-05', '15:55') ? [100, 100.2, 100, 100.2] : null));
  assert.deepEqual(nextTradingDays(bars, D, 3), ['2024-08-01', '2024-08-02', '2024-08-05']);   // the weekend is skipped
  assert.ok(!isTradingDay(bars, '2024-08-03'));
  const tr = trade(bars, daily(25, ny('2024-08-01', '00:00')), D, 1);
  assert.equal(tr.entryT, ny('2024-08-01', '09:30')); assert.equal(tr.entry, 100.5); assert.equal(tr.how, 'time'); assert.equal(tr.exit, 100.2);
  assert.equal(tr.exitT, ny('2024-08-05', '16:00')); near(tr.stopDist, 1.5); near(tr.stop, 99);
  near(tr.R, (100.2 - 100.5) / 1.5);
});

test('the ATR uses only daily candles complete before the entry', () => {
  const t = Date.UTC(2024, 7, 1, 13, 30) / 1000, d = daily(21, Math.floor(t / 86400) * 86400, 2);
  near(atrAt(d, t), 2);
  const withToday = [...d, { time: Math.floor(t / 86400) * 86400, open: 100, high: 150, low: 50, close: 100 }];
  near(atrAt(withToday, t), 2);                                     // the entry day's own candle is not complete
  assert.equal(atrAt(d.slice(1), t), null);                          // fewer than 21 candles: no ATR
});

test('stop side, hourly blocks and the gap fill', () => {
  const e = ny('2024-08-01', '09:30'), x = ny('2024-08-05', '16:00');
  const mk = (f) => day5m(['2024-08-01', '2024-08-02', '2024-08-05'], f);
  // a buy: stop below; a low touching it in the second hour exits at the stop
  let b = mk((t) => (t === e + 3600 + 600 ? [100, 100, 98, 99] : null));
  let s = simulate(b, e, x, 1, 1.5); near(s.stop, 98.5); assert.equal(s.how, 'stop'); assert.equal(s.exit, 98.5); assert.equal(s.exitT, e + 7200);
  // a sell: stop above
  b = mk((t) => (t === e + 900 ? [100, 102, 100, 100] : null));
  s = simulate(b, e, x, -1, 1.5); near(s.stop, 101.5); assert.equal(s.how, 'stop'); assert.equal(s.exit, 101.5);
  // a gap: the next day's 09:30 block opens below the stop -> exit at that open
  const g = ny('2024-08-02', '09:30');
  b = mk((t) => (t >= ny('2024-08-02', '08:00') ? [97, 97.2, 96.8, 97] : null));
  s = simulate(b, e, x, 1, 1.5); assert.equal(s.how, 'gap'); assert.equal(s.exit, 97); assert.equal(s.exitT, ny('2024-08-02', '08:00'));   // the first candle of that block
  assert.ok(s.exitT <= g);
  // a block opening exactly at the stop is a gap at the stop
  b = mk((t) => (t === e + 3600 ? [98.5, 98.6, 98.5, 98.6] : null));
  s = simulate(b, e, x, 1, 1.5); assert.equal(s.how, 'gap'); assert.equal(s.exit, 98.5);
});

test('costs: spread, financing nights and the rates', () => {
  const entryT = ny('2024-08-01', '09:30'), exitT = ny('2024-08-05', '16:00');
  assert.equal(nights(entryT, exitT), 2);                            // Thu and Fri 22:00 (Wednesday counts three); Mon 22:00 is after the exit
  assert.equal(nights(ny('2024-07-30', '09:30'), ny('2024-08-01', '16:00')), 4);   // Tue 1 + Wed 3
  const r = dgs2At('2024-08-01'); assert.ok(r > 3 && r < 6);
  near(finRate(1, 4), 6.5); near(finRate(-1, 4), 0); near(finRate(-1, 1), 1.5);
  const c = costs({ entry: 100, entryT, exitT, side: 1 }); near(c.spread, 0.1); near(c.fin, 2 * (r + 2.5) / 100 / 365 * 100);
  const c2 = costs({ entry: 100, entryT, exitT, side: 1 }, 2); near(c2.spread, 0.2); near(c2.fin, 2 * c.fin);
});

test('statistics, Holm and the placebo pool', () => {
  near(pOneSided(2.0, 60), 0.025, 0.002); near(pOneSided(-1, 30), 1 - pOneSided(1, 30), 1e-9);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]); assert.deepEqual(holm([0.04, 0.01]), [0.04, 0.02]);
  near(tOf([1, 2, 3]), 2 / Math.sqrt(1 / 3));
  assert.deepEqual(monthSums([{ date: '2024-01-31', net: 1 }, { date: '2024-01-02', net: 2 }, { date: '2024-03-20', net: -1 }]), [3, -1]);
  const pool = placeboPool(['2024-07-01', '2024-08-31'], ['2024-07-31']);
  for (let k = 0; k <= 5; k++) assert.ok(!pool.includes(addDay('2024-07-31', k)));
  assert.ok(pool.includes('2024-07-30') && pool.includes('2024-08-06') && !pool.includes('2024-08-03'));
});

test('the committed result matches the written report and the pass bar', () => {
  assert.equal(J.study, 'bond-fomc-drift'); assert.ok(/^(PASS|FAIL):/.test(J.verdict));
  const tests = J.tests;
  for (const k of ['T1', 'T2', 'POOL']) {
    const b = tests[k].b, c = tests[k].cond;
    assert.equal(c.positiveT2, b.net > 0 && b.t >= 2); assert.equal(c.holm, b.holm < 0.05); assert.equal(c.replication, tests[k].a.net > 0); assert.equal(c.costs2, b.net2 > 0);
    assert.equal(c.abovePlacebo, b.net > J.placebo.b[k].p95);
    assert.equal(tests[k].pass, Object.values(c).every(Boolean));
  }
  assert.equal(J.verdict.slice(0, 4), tests.T1.pass || tests.T2.pass ? 'PASS' : 'FAIL');
  const h = headline({ verdict: J.verdict.slice(0, 4), tests });
  assert.ok(RES.includes(h), 'RESULT.md opens with the headline from result.json');
  const sgn = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  for (const k of ['T1', 'T2', 'POOL']) for (const w of ['a', 'b']) assert.ok(RES.includes(`| ${tests[k][w].n} | ${sgn(tests[k][w].gross)} | ${sgn(tests[k][w].net)} | ${sgn(tests[k][w].net2)} |`), `${k} ${w}`);
  assert.equal(tests.T1.b.n + tests.T1.a.n, J.events.filter((e) => e.T1 !== undefined).length);
});
