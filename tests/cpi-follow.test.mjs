// The CPI follow / fade study: New York clock with DST, no look-ahead, the stop floor, the range filter, costs, and the report
// against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyParts, windowOf, stopOf, manage, costOf, filterRef, tradeDay, isPayrollsLike, holm, pOne, tstat, P, TESTS } from '../research/edge/cpi-follow/run.mjs';
import { MEMORY, SCHEDULE_2018_21, cpiDates } from '../research/edge/cpi-follow/events.mjs';

const at = (iso) => Date.parse(iso) / 1000;
// a New York day from [minute, o, h, l, c]
const day = (rows) => new Map(rows.map((r) => [r[0], r.slice(1)]));
const base = (extra = []) => day([[505, 100, 100.2, 99.9, 100], [510, 100, 101, 99.8, 100.8], [515, 100.8, 101.5, 100.5, 101.2], [520, 101.2, 101.4, 100.9, 101], ...extra]);

test('New York clock: 08:30 is 13:30 UTC in winter and 12:30 UTC in summer, across the DST switches', () => {
  assert.deepEqual(nyParts(at('2024-01-11T13:30:00Z')), { date: '2024-01-11', min: 510, dow: 4 });
  assert.deepEqual(nyParts(at('2024-07-11T12:30:00Z')), { date: '2024-07-11', min: 510, dow: 4 });
  // 2024-03-10 spring forward, 2024-11-03 fall back
  assert.equal(nyParts(at('2024-03-08T13:30:00Z')).min, 510);
  assert.equal(nyParts(at('2024-03-11T12:30:00Z')).min, 510);
  assert.equal(nyParts(at('2024-11-01T12:30:00Z')).min, 510);
  assert.equal(nyParts(at('2024-11-04T13:30:00Z')).min, 510);
  assert.equal(nyParts(at('2024-11-04T04:59:00Z')).date, '2024-11-03');
});

test('the window reads 08:25-08:40 candles only; the entry is the 08:45 price', () => {
  const w = windowOf(base());
  assert.equal(w.pre, 100); assert.equal(w.c45, 101); assert.equal(w.hi, 101.5); assert.equal(w.lo, 99.8);
  assert.ok(Math.abs(w.range - 1.7) < 1e-12); assert.equal(w.move, 1);
  assert.equal(windowOf(day([[510, 1, 1, 1, 1], [515, 1, 1, 1, 1], [520, 1, 1, 1, 1]])), null, 'no 08:25 candle, no trade');
});

test('no look-ahead: candles after the entry never change the entry, stop or filter; management starts at 08:45', () => {
  const a = base([[525, 101, 101.1, 100.9, 101], [955, 101, 102, 100.95, 101.9]]);
  const b = base([[525, 101, 101.1, 100.9, 101], [955, 101, 150, 100.95, 140]]);
  const sa = stopOf('follow', windowOf(a)), sb = stopOf('follow', windowOf(b));
  assert.deepEqual(sa, sb);
  // an 08:40 low below the stop does not stop the trade (it is before the entry)
  assert.equal(manage(base([[525, 101, 101.1, 100.9, 101]]), { dir: 1, entry: 101, stop: 100.9 }, 960).how, 'stop');
  assert.equal(manage(base([[525, 101, 101.1, 100.95, 101]]), { dir: 1, entry: 101, stop: 100.9 }, 960).how, 'time');
  // the filter reads only days before the event
  const ranges = [['2024-01-02', 1], ['2024-01-03', 1], ['2024-01-04', 1], ['2024-01-08', 1], ['2024-01-09', 1], ['2024-01-10', 1], ['2024-01-12', 1], ['2024-01-15', 1], ['2024-01-16', 1], ['2024-01-17', 1], ['2024-01-18', 50], ['2024-01-19', 50]];
  assert.equal(filterRef(ranges, '2024-01-18', () => false), 1);
});

test('follow stop: the far extreme, moved out to 0.25 x range when closer; fade stop: 1 x range past the faded extreme', () => {
  const w = windowOf(base());
  assert.deepEqual(stopOf('follow', w), { dir: 1, entry: 101, stop: 99.8 });
  const near = { pre: 100, c45: 100.05, hi: 101, lo: 100, range: 1, move: 0.05 };
  const s = stopOf('follow', near); assert.equal(s.dir, 1); assert.ok(Math.abs((s.entry - s.stop) - P.floor * near.range) < 1e-12);
  const f = stopOf('fade', w); assert.equal(f.dir, -1); assert.ok(Math.abs(f.stop - (101.5 + 1.7)) < 1e-12);
  const fd = stopOf('fade', { ...w, move: -1 }); assert.equal(fd.dir, 1); assert.ok(Math.abs(fd.stop - (99.8 - 1.7)) < 1e-12);
  // every trade has a stop on the losing side
  for (const r of ['follow', 'fade']) for (const mv of [1, -1]) { const x = stopOf(r, { ...w, move: mv }); assert.ok(x.dir > 0 ? x.stop < x.entry : x.stop > x.entry); }
});

test('a gap through the stop exits at the open; the 11:00 exit is the 10:55 close', () => {
  const g = manage(base([[525, 99, 99.5, 98, 99]]), { dir: 1, entry: 101, stop: 99.8 }, 960);
  assert.deepEqual([g.how, g.exit], ['stop-gap', 99]);
  const t = manage(base([[525, 101, 101.1, 100.9, 101], [655, 101, 101.3, 101, 101.2], [700, 101, 103, 101, 103]]), { dir: 1, entry: 101, stop: 99.8 }, 660);
  assert.deepEqual([t.how, t.exit, t.at], ['time', 101.2, 655]);
});

test('the range filter: under 0.5 x the median of 20 earlier non-event weekdays is skipped; fewer than 10 days, no trade', () => {
  const r = [...Array(25)].map((_, i) => [new Date(Date.UTC(2024, 0, 2 + i)).toISOString().slice(0, 10), i % 2 ? 4 : 2]);
  const ref = filterRef(r, '2024-01-30', () => false); assert.equal(ref, 3);
  assert.equal(filterRef(r, '2024-01-30', (d) => d < '2024-01-22'), null, 'events excluded, too few left');
  const d = base([[525, 101, 101.1, 100.9, 101], [955, 101, 102, 100.95, 102]]);
  assert.equal(tradeDay('xau', d, 'follow', 960, 3.5).skip, 'filter');   // 1.7 < 1.75
  assert.ok(!tradeDay('xau', d, 'follow', 960, 3.3).skip);
  assert.equal(tradeDay('xau', d, 'follow', 960, null).skip, 'no-ref');
  assert.ok(isPayrollsLike('2024-01-05') && !isPayrollsLike('2024-01-12') && !isPayrollsLike('2024-01-04'));
});

test('costs: gold $0.30, forex 0.3 pip + 45 per million + 2 pips, NAS100 3.5 points; net = gross - cost / risk', () => {
  assert.equal(costOf('xau', 2000), 0.30);
  assert.equal(costOf('nas100', 20000), 3.5);
  assert.ok(Math.abs(costOf('eurusd', 1.1) - (0.00003 + 4.5e-5 * 1.1 + 0.0002)) < 1e-12);
  assert.ok(Math.abs(costOf('usdjpy', 150) - (0.003 + 4.5e-5 * 150 + 0.02)) < 1e-12);
  const d = base([[525, 101, 101.1, 100.9, 101], [955, 101, 102, 100.95, 102.2]]), t = tradeDay('xau', d, 'follow', 960, 2);
  assert.ok(Math.abs(t.gross - 1.2 / 1.2) < 1e-12); assert.ok(Math.abs(t.net - (1 - 0.3 / 1.2)) < 1e-12);
});

test('statistics: Holm, one-sided Student p, t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]), [0.04, 0.09, 0.09, 0.5]);
  assert.ok(Math.abs(pOne(2.0, 1e6) - 0.02275) < 1e-4);
  assert.ok(Math.abs(pOne(2.228, 10) - 0.025) < 1e-3);
  assert.equal(+tstat([1, 2, 3]).t.toFixed(4), 3.4641);
});

test('events: memory list of 72 dates 2012-17, the 2018-21 schedule, council CPI dates after; no duplicates', () => {
  assert.equal(MEMORY.length, 72); assert.equal(SCHEDULE_2018_21.length, 48);
  const all = cpiDates(at('2026-11-13T00:00:00Z'));
  assert.equal(new Set(all.map((x) => x.d)).size, all.length);
  assert.ok(all.some((x) => x.d === '2026-11-10') && !all.some((x) => x.d === '2026-12-10'));
  const pre = fs.readFileSync(new URL('../research/edge/cpi-follow/PREREGISTRATION.md', import.meta.url), 'utf8');
  for (const yr of ['2012', '2013', '2014', '2015', '2016', '2017']) {
    const line = pre.split('\n').find((l) => l.trim().startsWith(`- ${yr}:`)), ds = line.split(':')[1].split(',').map((s) => `${yr}-${s.trim()}`);
    assert.deepEqual(ds, MEMORY.filter((d) => d.startsWith(yr)), `pre-registered ${yr} dates`);
  }
});

test('the report says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/cpi-follow/result.json', import.meta.url))), md = fs.readFileSync(new URL('../research/edge/cpi-follow/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\.\\*\\*`));
  assert.equal(r.verdict, r.tests.some((t) => t.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(r.tests.map((t) => t.id), TESTS.map(([a, b]) => `${a}-${b}`));
  const f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  for (const t of r.tests) {
    const d = t.decisive, p = t.replication;
    assert.ok(md.includes(`| ${t.id} | ${d.events} | ${f(d.eventR)} | ${d.t} | ${d.trades} | ${f(d.tradeR)} | ${t.holmP} | ${p.events} | ${f(p.eventR)} | ${p.t} | ${p.trades} | ${f(p.tradeR)} | ${f(t.placebo.p95)} | ${t.pass ? 'yes' : 'no'} |`), t.id);
    assert.equal(t.pass, Object.values(t.checks).every(Boolean));
    assert.equal(t.checks.decisive, d.eventR > 0 && d.t >= 2 && d.tradeR > 0);
    assert.equal(t.placebo.values.length, 40);
  }
  assert.match(md, /stand-alone event rule/); assert.match(md, /event-reaction/);
});
