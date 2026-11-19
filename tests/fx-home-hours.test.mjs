// fx-home-hours study (research/edge/fx-home-hours): the windows in UTC (the AUD window across midnight), the H1 ATR from
// past candles only, the stop side and the gap fill, the time exit and the "no data" days, the costs and the financing over
// 17:00 New York, the statistics, the placebo hours, and the committed result against the pre-registered bar and RESULT.md.
// Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, PAIRS, startHour, sessions, isTradingDay, columns, hourly, atrAt, simTrade, rollovers, rateOn, financing, tradeCost, monthT, tOf, holm, normP, placeboHour, rng, windowOf } from '../research/edge/fx-home-hours/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/fx-home-hours/PREREGISTRATION.md'), RES = rd('../research/edge/fx-home-hours/RESULT.md');
const J = JSON.parse(rd('../research/edge/fx-home-hours/result.json')), RATES = JSON.parse(rd('../research/edge/fx-home-hours/rates.json'));
const U = (s) => Date.parse(s) / 1000;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
// flat M5 candles every 5 minutes from t0 to t1 at price p (range +-w), as rows [t, o, h, l, c]
const flat = (t0, t1, p, w = 0.0005) => { const r = []; for (let t = t0; t < t1; t += 300) r.push([t, p, p + w, p - w, p]); return r; };

test('the constants and the four legs are the pre-registered ones', () => {
  assert.deepEqual([P.ATR_N, P.EXIT_SLACK, P.SPREAD_PIPS, P.SLIP_PIPS, P.COMM_RT, P.MARKUP, P.SEEDS], [14, 1800, 0.3, 0.3, 45e-6, 1, 40]);
  assert.deepEqual(P.BAR, { nDec: 300, nRep: 150, t: 2.0, holm: 0.05, placeboAbove: 38 });
  const leg = (k) => [PAIRS[k].sym, PAIRS[k].side, startHour(PAIRS[k]), PAIRS[k].to];
  assert.deepEqual(leg('T1'), ['eurusd', -1, 7, 12]); assert.deepEqual(leg('T2'), ['usdjpy', 1, 0, 6]);
  assert.deepEqual(leg('T3'), ['gbpusd', -1, 7, 12]); assert.deepEqual(leg('T4'), ['audusd', -1, 22, 5]);
  for (const s of ['| T1 | EUR/USD | sell (EUR weakens) | 07:00 → 12:00 |', '| T2 | USD/JPY | buy (JPY weakens) | 00:00 → 06:00 |', '| T3 | GBP/USD | sell (GBP weakens) | 07:00 → 12:00 |', '| T4 | AUD/USD | sell (AUD weakens) | 22:00 → 05:00 next day |',
    'Decisive window: trades entered 1 Jan 2016 to 31 Oct 2026', 'Replication window: 1 Jan 2010 to 31 Dec 2015', '**month-sum t ≥ 2.0**', 'above at least 38 of the 40 seeds']) assert.ok(PRE.includes(s), s);
  assert.equal(windowOf(U('2015-12-31T23:59:00Z')), 'rep'); assert.equal(windowOf(U('2016-01-01T00:00:00Z')), 'dec');
  assert.equal(windowOf(U('2026-11-01T00:00:00Z')), null); assert.equal(windowOf(U('2009-12-31T22:00:00Z')), null);
});

test('windows in UTC: weekdays only, US holidays skipped, the AUD window starts the day before at 22:00', () => {
  const eur = sessions(PAIRS.T1, U('2024-03-01T00:00:00Z'), U('2024-03-06T00:00:00Z'));
  assert.deepEqual(eur.map((s) => s.date), ['2024-03-01', '2024-03-04', '2024-03-05']);
  assert.equal(eur[1].start, U('2024-03-04T07:00:00Z')); assert.equal(eur[1].end, U('2024-03-04T12:00:00Z'));
  const aud = sessions(PAIRS.T4, U('2024-03-04T00:00:00Z'), U('2024-03-05T00:00:00Z'));
  assert.equal(aud.length, 1); assert.equal(aud[0].start, U('2024-03-03T22:00:00Z')); assert.equal(aud[0].end, U('2024-03-04T05:00:00Z'));
  const jpy = sessions(PAIRS.T2, U('2024-03-04T00:00:00Z'), U('2024-03-05T00:00:00Z'));
  assert.equal(jpy[0].start, U('2024-03-04T00:00:00Z')); assert.equal(jpy[0].end, U('2024-03-04T06:00:00Z'));
  for (const d of ['2024-12-25', '2024-07-04', '2024-11-28', '2024-03-29', '2024-01-01']) assert.equal(isTradingDay(U(d + 'T00:00:00Z')), false, d);
  for (const d of ['2024-03-05', '2024-12-26']) assert.equal(isTradingDay(U(d + 'T00:00:00Z')), true, d);
  // the session dated 4 Jan 2016 (Monday) starts Sunday 3 Jan 22:00; the one dated 1 Jan 2016 is a holiday
  const edge = sessions(PAIRS.T4, U('2015-12-31T00:00:00Z'), U('2016-01-05T00:00:00Z'));
  assert.deepEqual(edge.map((s) => [s.date, windowOf(s.start)]), [['2015-12-31', 'rep'], ['2016-01-04', 'dec']]);
});

test('the H1 ATR reads only hours that ended at or before the entry', () => {
  const t0 = U('2024-03-04T00:00:00Z'), rows = [];
  for (let h = 0; h < 20; h++) for (let m = 0; m < 12; m++) { const t = t0 + h * 3600 + m * 300; rows.push([t, 1, 1 + 0.001 * (h + 1), 1, 1]); }
  const E = t0 + 16 * 3600, B = columns(rows), a = atrAt(hourly(B), E);
  // hours 2..15 (h = 1..14 zero-based ranges 0.002 .. 0.015), each true range = its high - prior close (1)
  near(a, (2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15) * 0.001 / 14 + 0.001);
  const later = rows.map((r) => (r[0] >= E ? [r[0], 1, 9, 0.1, 5] : r));
  near(atrAt(hourly(columns(later)), E), a);
  assert.equal(atrAt(hourly(B), t0 + 14 * 3600), null, '14 complete hours are not enough (15 needed)');
  assert.ok(atrAt(hourly(B), t0 + 15 * 3600) > 0);
});

const setup = (pr, start, end, px, patch = {}) => {
  const rows = flat(start - 20 * 3600, end + 3600, px).map((r) => (patch[r[0]] ? [r[0], ...patch[r[0]]] : r));
  const B = columns(rows); return { B, HH: hourly(B) };
};

test('a sell: stop above the entry, a touch exits at the stop, a gap through it exits at the open', () => {
  const pr = PAIRS.T1, s = U('2024-03-04T07:00:00Z'), e = U('2024-03-04T12:00:00Z');
  const base = setup(pr, s, e, 1.1);
  const x = simTrade(base.B, base.HH, pr, s, e);
  near(x.r0, 0.001); near(x.stop, 1.101); assert.equal(x.how, 'time'); near(x.exit, 1.1); near(x.gross, 0); assert.equal(x.exitT, e);
  const t = s + 3600;
  const touch = setup(pr, s, e, 1.1, { [t]: [1.1, 1.1015, 1.0995, 1.1] });
  const y = simTrade(touch.B, touch.HH, pr, s, e); assert.equal(y.how, 'stop'); near(y.exit, 1.101); near(y.gross, -1);
  const gap = setup(pr, s, e, 1.1, { [t]: [1.1025, 1.103, 1.102, 1.1025] });
  const z = simTrade(gap.B, gap.HH, pr, s, e); assert.equal(z.how, 'gap'); near(z.exit, 1.1025); near(z.gross, -2.5);
  const buy = PAIRS.T2, bs = U('2024-03-04T00:00:00Z'), be = U('2024-03-04T06:00:00Z');
  const b = setup(buy, bs, be, 150, { [bs + 600]: [150, 150.01, 148, 150] });
  const w = simTrade(b.B, b.HH, buy, bs, be); assert.ok(w.stop < w.entry); assert.equal(w.how, 'stop'); near(w.gross, -1);
});

test('no data: a missing entry candle, or no candle in the last 30 minutes of the window', () => {
  const pr = PAIRS.T1, s = U('2024-03-04T07:00:00Z'), e = U('2024-03-04T12:00:00Z');
  const rows = flat(s - 20 * 3600, e + 3600, 1.1);
  assert.equal(simTrade(columns(rows.filter((r) => r[0] !== s)), hourly(columns(rows)), pr, s, e).skip, 'nodata');
  const thin = rows.filter((r) => !(r[0] >= e - 1800 && r[0] < e));
  assert.equal(simTrade(columns(thin), hourly(columns(thin)), pr, s, e).skip, 'nodata');
  const ok = rows.filter((r) => !(r[0] >= e - 1500 && r[0] < e));
  const x = simTrade(columns(ok), hourly(columns(ok)), pr, s, e); assert.equal(x.how, 'time'); assert.equal(x.exitT, e - 1500);
});

test('costs: spread, slippage and commission; financing only over 17:00 New York, Wednesday three, never a credit', () => {
  near(tradeCost(PAIRS.T1, 1.1), 0.6e-4 + 45e-6 * 1.1); near(tradeCost(PAIRS.T2, 150), 0.006 + 45e-6 * 150);
  // winter: 17:00 New York = 22:00 UTC; summer: 21:00 UTC
  assert.deepEqual(rollovers(U('2024-01-10T22:00:00Z'), U('2024-01-11T05:00:00Z')), [{ t: U('2024-01-10T22:00:00Z'), nights: 3 }]);
  assert.deepEqual(rollovers(U('2024-01-08T22:00:00Z'), U('2024-01-09T05:00:00Z')), [{ t: U('2024-01-08T22:00:00Z'), nights: 1 }]);
  assert.deepEqual(rollovers(U('2024-07-08T22:00:00Z'), U('2024-07-09T05:00:00Z')), []);
  assert.deepEqual(rollovers(U('2024-07-08T07:00:00Z'), U('2024-07-08T12:00:00Z')), []);
  assert.equal(rateOn(RATES, 'usd', '2023-08-01'), 5.375); assert.equal(rateOn(RATES, 'usd', '2015-01-01'), 0.125);
  // short AUD / long USD in Jan 2024: USD 5.375, AUD 4.35 -> +1.025 - 1 markup = +0.025 % a year: a credit, booked as 0
  const pr = PAIRS.T4; assert.equal(rateOn(RATES, 'aud', '2024-01-10'), 4.35);
  assert.equal(financing(RATES, pr, 0.67, U('2024-01-10T22:00:00Z'), U('2024-01-11T05:00:00Z')).fin, 0);
  // in 2012 (USD 0.125, AUD 4.25): charge (4.25 - 0.125 + 1) / 100 / 365 a night
  const f = financing(RATES, pr, 1.0, U('2012-01-09T22:00:00Z'), U('2012-01-10T05:00:00Z'));
  assert.equal(f.nights, 1); near(f.fin, (rateOn(RATES, 'aud', '2012-01-09') - rateOn(RATES, 'usd', '2012-01-09') + 1) / 100 / 365);
  assert.equal(financing(RATES, pr, 1.0, U('2012-07-09T22:00:00Z'), U('2012-07-10T05:00:00Z')).fin, 0, 'summer: the 21:00 rollover is before the entry');
  assert.equal(RATES.source, 'research/edge/fx-carry/rates.json (branch fx-carry, commit f9fb1ba28)');
});

test('statistics: month-sum t, Holm, one-sided p; placebo hours never the rule\'s own', () => {
  const tr = [['2024-01-03', 1], ['2024-01-20', 1], ['2024-02-05', -1], ['2024-03-05', 2]].map(([d, v]) => ({ t: U(d + 'T07:00:00Z'), net: v }));
  near(monthT(tr), tOf([2, -1, 2]));
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]), [0.04, 0.09, 0.09, 0.5].map((x, i) => [0.04, 0.09, 0.09, 0.5][i]));
  near(normP(1.6448536), 0.05, 1e-6); near(normP(-1.6448536), 0.95, 1e-6); assert.equal(normP(null), 1);
  const u = rng(7), seen = new Set();
  for (let i = 0; i < 5000; i++) { const h = placeboHour(u(), 22); assert.ok(h !== 22 && h >= 0 && h <= 23); seen.add(h); }
  assert.equal(seen.size, 23);
  const a = rng(1), b = rng(1); assert.equal(a(), b());
});

const num = (s) => +String(s).replace('−', '-').replace('+', '');
const sg = (v) => String(v).replace('-', '−');
test('the committed result: FAIL by the pre-registered bar, and RESULT.md says what result.json says', () => {
  assert.equal(J.topic, 'fx-home-hours'); assert.ok(J.verdict.startsWith('FAIL'));
  assert.ok(/^\*\*Verdict: FAIL\.\*\*/m.test(RES));
  for (const k of ['T1', 'T2', 'T3', 'T4']) {
    const X = J.tests[k];
    assert.equal(X.pass, false); assert.ok(!(X.conditions.t && X.conditions.rep), `${k} would not be FAIL`);
    assert.deepEqual(Object.keys(X.conditions), ['n', 't', 'holm', 'rep', 'cost2', 'placebo']);
    const row = RES.split('\n').find((l) => l.startsWith(`| ${k} `)); assert.ok(row, k);
    const c = row.split('|').slice(1, -1).map((s) => s.trim());
    assert.equal(+c[2], X.dec.n); near(num(c[3]), X.dec.gross); near(num(c[4]), X.dec.exp); near(num(c[5]), X.dec.R); near(num(c[6]), X.dec.t);
    near(num(c[7]), X.pHolm); assert.equal(c[8], [X.placebo.p5, X.placebo.p50, X.placebo.p95].map(sg).join(' / '));
    assert.equal(+c[9], X.placebo.above); near(num(c[10]), X.dec.exp2); assert.equal(+c[11], X.rep.n);
    assert.equal(c[12], `${X.rep.exp > 0 ? '+' : ''}${sg(X.rep.exp)} (${sg(X.rep.t)})`);
  }
  const t5 = RES.split('\n').find((l) => l.startsWith('| T5 ')).split('|').slice(1, -1).map((s) => s.trim());
  near(num(t5[3]), J.T5.dec.gross); near(num(t5[4]), J.T5.dec.exp); near(num(t5[6]), J.T5.dec.t); assert.equal(+t5[9], J.T5.placebo.above); near(num(t5[10]), J.T5.dec.exp2);
  assert.equal(J.T5.pass, false); assert.equal(J.candidates.length, 4); assert.ok(J.candidates.every((c) => c.verdict === 'FAIL'));
  for (const k of ['summer', 'winter']) { const d = J.tests.T4.dst[k]; assert.ok(RES.includes(`n ${d.n}, gross ${d.gross > 0 ? '+' : ''}${sg(d.gross)}R, net ${sg(d.exp)}R, t ${sg(d.t)}`), k); }
  assert.ok(RES.includes('02d5d7e86'));
});
