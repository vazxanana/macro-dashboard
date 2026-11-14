// The Santa Claus rally window (research/edge/santa-rally): offline checks on hand-made candles and the committed result.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyseHolidays, usCalendar, volCalendar, trade, yearly, runTest, rateFn, tStat, pOneSided, holm, mulberry32, P } from '../research/edge/santa-rally/run.mjs';

const DAY = 86400;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// every calendar day (weekends and holidays included, as OANDA's US CFDs print them) from `from` to `to`
function bars(from, to, f = () => ({ c: 100 })) {
  const out = []; const end = Date.parse(to + 'T00:00:00Z') / 1e3;
  for (let t = Date.parse(from + 'T00:00:00Z') / 1e3; t <= end; t += DAY) { const x = f(t); out.push({ t, o: x.o ?? x.c, h: x.h ?? x.c + 0.5, l: x.l ?? x.c - 0.5, c: x.c, v: x.v ?? 1000 }); }
  return out;
}
const zeroRate = () => 0;

test('NYSE holidays: observed rules and special closures', () => {
  const h06 = nyseHolidays(2006), h07 = nyseHolidays(2007), h10 = nyseHolidays(2010), h11 = nyseHolidays(2011), h22 = nyseHolidays(2022), h21 = nyseHolidays(2021);
  assert.ok(h06.has('2006-01-02'));             // New Year on a Sunday → Monday
  assert.ok(h07.has('2007-01-02'));             // day of mourning
  assert.ok(h10.has('2010-12-24'));             // Christmas on a Saturday → Friday
  assert.ok(!h10.has('2010-12-31') && !h11.has('2010-12-31')); // New Year 2011 on a Saturday: no Friday holiday
  assert.ok(h22.has('2022-12-26') && h22.has('2022-06-20')); // Christmas on Sunday → Monday; Juneteenth observed
  assert.ok(!h21.has('2021-06-18'));            // no Juneteenth before 2022
  assert.ok(nyseHolidays(2024).has('2024-03-29')); // Good Friday
  assert.ok(nyseHolidays(2025).has('2025-01-09'));
});

test('US calendar drops weekends and NYSE holidays even when a candle exists', () => {
  const b = bars('2024-12-20', '2025-01-10'), cal = usCalendar(b).map((i) => iso(b[i].t));
  assert.deepEqual(cal, ['2024-12-20', '2024-12-23', '2024-12-24', '2024-12-26', '2024-12-27', '2024-12-30', '2024-12-31', '2025-01-02', '2025-01-03', '2025-01-06', '2025-01-07', '2025-01-08', '2025-01-10']);
});

test('volume calendar drops weekends and stub candles', () => {
  const b = bars('2012-11-01', '2013-01-10', (t) => ({ c: 100, v: iso(t) === '2012-12-26' ? 2 : 1000 }));
  const days = volCalendar(b).map((i) => iso(b[i].t));
  assert.ok(!days.includes('2012-12-26') && days.includes('2012-12-27') && !days.includes('2012-12-29'));
});

test('one window: entry at the first open, exit at the last close, costs and financing', () => {
  // price rises 1 a calendar day; open = previous close
  const b = bars('2018-09-01', '2019-02-28', (t) => { const c = 1000 + (t - Date.parse('2018-09-01T00:00:00Z') / 1e3) / DAY; return { o: c - 1, c }; });
  const cal = usCalendar(b), s = cal.findIndex((i) => iso(b[i].t) === '2018-12-24');
  const w = trade(b, cal, s, () => 0.05);
  assert.equal(w.from, '2018-12-24'); assert.equal(w.to, '2019-01-03'); assert.equal(w.how, 'time');
  assert.equal(w.nights, 11);
  assert.ok(Math.abs(w.gross - (w.exit / w.entry - 1)) < 1e-12);
  assert.ok(Math.abs(w.net - (w.gross - P.cost - 0.05 * 11 / 365)) < 1e-12);
  const w2 = trade(b, cal, s, () => 0.05, 2);
  assert.ok(Math.abs(w2.net - (w.gross - 2 * (P.cost + 0.05 * 11 / 365))) < 1e-12);
});

test('the stop: 3 x ATR(20) under the entry, a gap fills at the open, a holiday candle can stop it', () => {
  const crash = '2018-12-25'; // a holiday: not a trading day, but the CFD trades
  const b = bars('2018-09-01', '2019-02-28', (t) => (iso(t) === crash ? { o: 90, h: 91, l: 85, c: 88 } : { c: t > Date.parse(crash + 'T00:00:00Z') / 1e3 ? 88 : 100 }));
  const cal = usCalendar(b), s = cal.findIndex((i) => iso(b[i].t) === '2018-12-24');
  const w = trade(b, cal, s, zeroRate);
  assert.ok(Math.abs(w.stop - (100 - 3 * 1)) < 1e-9); // true range 1 a day
  assert.equal(w.how, 'stop'); assert.equal(w.to, crash); assert.equal(w.exit, 90);
  // an intraday touch without a gap fills at the stop
  const c = bars('2018-09-01', '2019-02-28', (t) => (iso(t) === '2018-12-27' ? { o: 100, h: 100.5, l: 95, c: 99 } : { c: 100 }));
  const w3 = trade(c, usCalendar(c), s, zeroRate);
  assert.equal(w3.exit, 97); assert.equal(w3.to, '2018-12-27');
});

test('the Santa window is the last 5 December and first 2 January trading days, and the excess uses every other start', () => {
  const b = bars('2017-06-01', '2019-03-31');
  const cal = usCalendar(b), Y = yearly(b, cal, zeroRate);
  const y18 = Y.years.get(2018), w = Y.net[y18.santa];
  assert.equal(w.from, '2018-12-24'); assert.equal(w.to, '2019-01-03');
  // flat prices: every window nets −cost, so the excess is 0
  assert.ok(Math.abs(Y.excessAt(y18, y18.santa)) < 1e-12);
  // a Santa-only rally: the excess = its net minus the others' mean
  const up = bars('2017-06-01', '2019-03-31', (t) => { const d = iso(t); return { c: d >= '2018-12-24' && d <= '2019-01-03' ? 100 + (t - Date.parse('2018-12-23T00:00:00Z') / 1e3) / DAY : d > '2019-01-03' ? 111 : 100 }; });
  const U = yearly(up, usCalendar(up), zeroRate), u = U.years.get(2018);
  const others = u.starts.filter((s) => s !== u.santa).map((s) => U.net[s].net);
  assert.ok(Math.abs(U.excessAt(u, u.santa) - (U.net[u.santa].net - others.reduce((a, x) => a + x, 0) / others.length)) < 1e-12);
  assert.ok(U.excessAt(u, u.santa) > 0);
});

test('no look-ahead in the stop: the ATR uses only the 20 trading days before the entry', () => {
  const b = bars('2018-09-01', '2019-02-28', (t) => (iso(t) >= '2018-12-24' ? { c: 100, h: 130, l: 99.6 } : { c: 100 }));
  const cal = usCalendar(b), s = cal.findIndex((i) => iso(b[i].t) === '2018-12-24');
  assert.ok(Math.abs(trade(b, cal, s, zeroRate).stop - 97) < 1e-9);
});

test('statistics: t, one-sided p, Holm, seeded placebo generator', () => {
  const s = tStat([1, 2, 3, 4]); assert.ok(Math.abs(s.t - 2.5 / (Math.sqrt(5 / 3) / 2)) < 1e-12);
  assert.ok(Math.abs(pOneSided(2.131, 15) - 0.025) < 0.001);
  assert.ok(Math.abs(pOneSided(-2.131, 15) - 0.975) < 0.001);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const r1 = mulberry32(5), r2 = mulberry32(5); assert.equal(r1(), r2());
  assert.equal(rateFn([['2010-01-01', 1]])('2009-06-01'), P.dgs2Default / 100 + P.finAdd);
  assert.equal(rateFn([['2010-01-01', 1], ['2010-01-08', 2]])('2010-01-07'), 0.01 + P.finAdd);
});

test('runTest pools indices by year and runs the placebo', () => {
  const mk = () => { const b = bars('2008-06-01', '2012-03-31', (t) => ({ c: 100 + Math.sin(t / DAY) })); return { key: 'x', bars: b, cal: usCalendar(b) }; };
  const r = runTest([mk(), { ...mk(), key: 'y' }], zeroRate, 1, true);
  assert.ok(r.rows.every((x) => x.parts.length === 2));
  assert.equal(r.placebo.draws, P.placeboDraws);
  assert.ok(r.placebo.share >= 0 && r.placebo.share <= 1);
});

test('the committed result and report agree', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/santa-rally/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/santa-rally/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\*\*/);
  assert.match(md, /low power/i);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = r.tests[id].x1;
    assert.equal(x.decisive.n, 16); assert.equal(x.replication.n, 7); assert.equal(x.pass, false);
    const pct = (v) => (v < 0 ? '−' : '+') + Math.abs(v * 100).toFixed(2) + ' %';
    assert.ok(md.includes(`16, ${pct(x.decisive.mean)}, ${x.decisive.t.toFixed(2).replace('-', '−')}`), id);
    assert.ok(md.includes(`${(x.placebo.share * 100).toFixed(1)} %`), id);
  }
  assert.ok(fs.readFileSync(new URL('../research/edge/santa-rally/PREREGISTRATION.md', import.meta.url), 'utf8').includes('Pass bar'));
});
