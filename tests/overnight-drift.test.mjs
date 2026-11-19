// research/edge/overnight-drift: session boundaries with daylight saving, the NYSE calendar, weekend and holiday nights,
// financing days, the stop and its ATR (no look-ahead), and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as R from '../research/edge/overnight-drift/run.mjs';

const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);

test('session boundaries follow New York daylight saving (and the US / Europe mismatch weeks)', () => {
  assert.equal(iso(R.session('2024-01-10').open), '2024-01-10T14:30');   // EST
  assert.equal(iso(R.session('2024-01-10').close), '2024-01-10T21:00');
  assert.equal(iso(R.session('2024-03-11').open), '2024-03-11T13:30');   // EDT from 10 Mar, Europe still on winter time
  assert.equal(iso(R.session('2024-03-08').close), '2024-03-08T21:00');
  assert.equal(iso(R.session('2024-11-01').close), '2024-11-01T20:00');  // EDT until 3 Nov
  assert.equal(iso(R.session('2024-11-04').open), '2024-11-04T14:30');
  assert.equal(R.nyDate(R.session('2024-11-04').close), '2024-11-04');
});

test('NYSE calendar: observed holidays, Saturday New Year, Juneteenth from 2022, special closures, early closes', () => {
  assert.ok(!R.tradingDay('2024-03-29'));                  // Good Friday
  assert.ok(!R.tradingDay('2021-12-24'));                  // Christmas on a Saturday, observed Friday
  assert.ok(R.tradingDay('2021-12-31'));                   // New Year on a Saturday: no holiday
  assert.ok(R.tradingDay('2021-06-18') && !R.tradingDay('2022-06-20'));
  assert.ok(!R.tradingDay('2012-10-29') && !R.tradingDay('2018-12-05') && !R.tradingDay('2025-01-09'));
  assert.ok(!R.tradingDay('2017-01-02'));                  // New Year on a Sunday, observed Monday
  assert.ok(R.earlyClose('2024-11-29') && R.earlyClose('2024-07-03') && R.earlyClose('2024-12-24'));
  assert.ok(!R.earlyClose('2015-07-03'));                  // itself the observed holiday
  assert.equal(iso(R.session('2024-11-29').close), '2024-11-29T18:00');
  assert.equal(R.nextTradingDay('2024-11-27'), '2024-11-29');
});

test('financing counts calendar days at each 17:00 rollover: Friday 3, holiday eves more, none before 17:00', () => {
  const d = (a, b) => R.rolloverDays(R.session(a).close, R.session(b).open);
  assert.equal(d('2024-03-12', '2024-03-13'), 1);
  assert.equal(d('2024-03-08', '2024-03-11'), 3);
  assert.equal(d('2024-03-28', '2024-04-01'), 4);          // Good Friday
  assert.equal(d('2024-11-27', '2024-11-29'), 2);          // Thanksgiving
  const c = R.session('2024-03-05').close; assert.equal(R.rolloverDays(c, c + 1800), 0);
  const w = R.indexWindows('2024-03-07', '2024-03-12').night;
  assert.deepEqual(w.map((x) => x.day), ['2024-03-07', '2024-03-08', '2024-03-11']);
  assert.equal((w[1].t1 - w[1].t0) / 3600, 64.5);          // Friday close to Monday open, one position
});

// a synthetic M30 path: flat nights of range 3, one night that falls through its stop
function path(days, drop) {
  const W = R.indexWindows(days[0], days.at(-1)), bars = [];
  for (const w of [...W.night]) for (let t = w.t0, k = 0; t < w.t1; t += 1800, k++) {
    const o = 100 + (k % 2 ? 1 : 0); let b = [t, o, o + 1, o - 1, o];
    if (drop && w.day === drop && k === 3) b = [t, o, o, 90, 92];
    bars.push(b);
  }
  for (const w of W.night) if (!bars.some((b) => b[0] === w.t1)) bars.push([w.t1, 100, 101, 99, 100]);
  bars.sort((a, b) => a[0] - b[0]); return { B: R.index(bars), W };
}
const days = R.tradingDays('2024-01-02', '2024-03-15');

test('the stop is 2 x ATR20 of earlier nights, taken at the stop (or a gapped open), and every trade has one', () => {
  const drop = days[30], { B, W } = path(days, drop);
  const N = R.nights(B, W.night, { spread: 0, finPerDay: () => 0 });
  assert.equal(N.trades.length, W.night.length - 20);
  for (const t of N.trades) { assert.ok(t.stop < t.entry && t.risk > 0); assert.ok(t.R >= -1 - 1e-9); }
  const s = N.trades.find((t) => t.day === drop);
  assert.ok(s.stopped); assert.equal(s.exit, s.stop); assert.equal(+s.R.toFixed(6), -1);
  assert.ok(Math.abs(s.risk - 2 * 3) < 1e-9);              // the earlier nights' range is 3 (99 to 102)
  const after = N.trades.find((t) => t.day === days[31]);
  assert.ok(after.risk > s.risk);                          // the fall night widens the ATR only after it ends
});

test('no look-ahead: changing every candle after an entry leaves that trade\'s stop unchanged', () => {
  const { B, W } = path(days, null), k = 35, t0 = W.night[k].t0;
  const B2 = R.index(B.bars.map((b) => (b[0] > W.night[k].t1 ? [b[0], b[1], b[2] + 50, b[3] - 50, b[4]] : b)));
  const a = R.nights(B, W.night, { spread: 0, finPerDay: () => 0 }).trades.find((t) => t.t0 === t0);
  const b = R.nights(B2, W.night, { spread: 0, finPerDay: () => 0 }).trades.find((t) => t.t0 === t0);
  assert.equal(a.stop, b.stop); assert.equal(a.R, b.R);
  const rate = R.asOf([['2024-01-05', 4], ['2024-01-12', 5]]);
  assert.equal(rate('2024-01-11'), 4); assert.equal(rate('2024-01-12'), 5); assert.equal(rate('2024-01-01'), null);
});

test('costs: spread once a round trip, financing per rollover day, R = net / risk', () => {
  const { B, W } = path(days, null);
  const t = R.nights(B, W.night, { spread: 0.5, finPerDay: () => 0.1 }).trades.find((x) => x.day === '2024-03-08');
  assert.equal(t.days, 3);
  assert.ok(Math.abs(t.R - (t.exit - t.entry - 0.5 - 0.3) / t.risk) < 1e-12);
});

test('Holm and the one-sided p', () => {
  assert.deepEqual(R.holm([0.01, 0.02, 0.04]), [true, true, true]);
  assert.deepEqual(R.holm([0.02, 0.03, 0.04]), [false, false, false]);
  assert.ok(Math.abs(R.pOne(1.96) - 0.025) < 1e-3);
});

test('RESULT.md says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/overnight-drift/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/overnight-drift/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\*\\*`));
  const f = (x, d = 3) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  for (const m of R.INDICES) for (const w of ['rep', 'dec']) {
    const s = r.markets[m][w].night;
    assert.ok(md.includes(`| ${s.n} | ${f(s.grossR)} | ${f(-s.spreadR)} | ${f(-s.finR)} | ${f(s.avgR)} | ${s.t} |`), `${m} ${w}`);
  }
  for (const m of R.INDICES) assert.equal(r.checks[m].pass, r.passing.includes(m));
});
