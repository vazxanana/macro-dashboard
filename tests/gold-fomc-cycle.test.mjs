// gold-fomc-cycle study: the week counting, the trade (stop, costs, financing), no look-ahead, the date check, and the report
// against result.json. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fold, windows, trade, atrAt, streamTrades, m5Check, monthSums, holm, shifted, report, headline, P, TESTS } from '../research/edge/gold-fomc-cycle/run.mjs';
import { scheduled, NEW } from '../research/edge/gold-fomc-cycle/dates.mjs';
import { nights, FIN } from '../council/fills.mjs';

const DAY = 86400;
// weekday candles from 2020-01-01 (Wednesday), flat at 100 with range 1, unless `px(i)` says otherwise
function days(n, px = () => 100) {
  const rows = []; let t = Date.parse('2020-01-01T00:00:00Z') / 1000, i = 0;
  while (rows.length < n) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6) { const c = px(i++); rows.push([t, c, c + 0.5, c - 0.5, c]); }
    t += DAY;
  }
  return fold(rows);
}

test('weekends fold into Monday', () => {
  const t = Date.parse('2020-01-03T00:00:00Z') / 1000;   // Friday
  const d = fold([[t, 10, 11, 9, 10], [t + DAY, 10, 13, 9, 12], [t + 2 * DAY, 12, 12.5, 8, 11], [t + 3 * DAY, 11, 12, 10.5, 11.5]]);
  assert.equal(d.length, 2);
  assert.deepEqual([d[1].d, d[1].o, d[1].h, d[1].l, d[1].c], ['2020-01-06', 10, 13, 8, 11.5]);
});

test('week w = days 5w-1..5w+3, week 0 never used, cut at the next meeting', () => {
  const D = days(200), m1 = D[30].d, m2 = D[30 + 31].d;   // next meeting 31 days later: day -1 is day 30
  const { list } = windows(D, [m1, m2], { unsched: [] });
  const first = list.filter((x) => x.meet === m1);
  assert.deepEqual(first.map((x) => x.w), [1, 2, 3, 4, 5]);   // week 6 = days 29-33 crosses day 30 = next meeting's day -1
  const w2 = first.find((x) => x.w === 2);
  assert.deepEqual([w2.start - 30, w2.end - 30, w2.entry - 30], [9, 13, 8]);
  assert.ok(!list.some((x) => x.start - 30 <= 3 && x.meet === m1));
});

test('unscheduled announcement days -1..+3 drop a week', () => {
  const D = days(200), m = D[30].d;
  const a = windows(D, [m], { unsched: [] }).list.length, b = windows(D, [m], { unsched: [D[30 + 11].d] }).list.length;
  assert.equal(a - b, 2);   // days 40-44 touch week 2 (days 39-43) and week 3 (entry day 43)
});

test('ATR uses only days up to the entry (no look-ahead)', () => {
  const D = days(60), A = atrAt(D, 40);
  const E = days(60, (i) => (i > 40 ? 500 : 100));
  assert.equal(atrAt(E, 40), A);
  assert.equal(A, 1);
});

test('a buy: stop at entry - 2 ATR, costs $0.60 and financing nights x FIN x entry', () => {
  const D = days(80, (i) => (i <= 40 ? 100 : 101)), win = { meet: 'x', w: 2, entry: 40, start: 41, end: 45 };
  const x = trade(D, win, 'buy');
  assert.equal(x.stop, 98);
  const nN = nights(D[40].t + DAY, D[45].t + DAY);
  assert.equal(x.nights, nN);
  assert.ok(nN >= 5);
  assert.ok(Math.abs(x.gross - 0.5) < 1e-12);
  assert.ok(Math.abs(x.cost - (0.6 + nN * FIN.xau.long * 100) / 2) < 1e-12);
  const s = trade(D, win, 'sell');
  assert.equal(s.nights, 0);
  assert.ok(Math.abs(s.cost - 0.3) < 1e-12);
  assert.ok(Math.abs(trade(D, win, 'buy', 2).cost - 2 * x.cost) < 1e-12);
});

test('every trade has a stop; a gap through it exits at the open', () => {
  const D = days(80, (i) => (i === 43 ? 90 : 100)), x = trade(D, { meet: 'x', w: 2, entry: 40, start: 41, end: 45 }, 'buy');
  assert.equal(x.why, 'gap');
  assert.equal(x.exit, 90);
  const y = trade(D, { meet: 'x', w: 2, entry: 40, start: 41, end: 45 }, 'sell');
  assert.equal(y.why, 'time');
  for (const k of Object.keys(TESTS)) for (const t of streamTrades(days(300), [days(300)[30].d, days(300)[90].d], TESTS[k]).trs) assert.ok(Number.isFinite(t.stop) && t.stop !== t.entryPx);
});

test('statistics helpers: month sums, Holm, placebo shift', () => {
  assert.deepEqual(monthSums([{ exitDate: '2020-01-02', net: 1 }, { exitDate: '2020-01-30', net: 2 }, { exitDate: '2020-02-01', net: -1 }]), [3, -1]);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  const D = days(300), m = [D[100].d, D[160].d], a = shifted(D, m, 7), b = shifted(D, m, 7);
  assert.deepEqual(a, b);
  for (let i = 0; i < 2; i++) { const k = D.findIndex((x) => x.d === a[i]), j = D.findIndex((x) => x.d === m[i]); const s = Math.abs(k - j); assert.ok(s >= 5 && s <= 20); }
});

test('the M5 date check: a spike in the release window passes, a quiet day fails', () => {
  const d0 = Date.parse('2020-03-18T00:00:00Z') / 1000, rows = [];
  for (let k = 30; k >= 0; k--) {
    const day = d0 - k * DAY;
    if ([0, 6].includes(new Date(day * 1000).getUTCDay())) continue;
    for (let s = 17 * 3600; s < 21 * 3600; s += 300) rows.push([day + s, 100, 100.5, 100, 100.2]);
  }
  assert.equal(m5Check(rows, '2020-03-18').ok, false);
  rows.find((r) => r[0] === d0 + 18 * 3600 + 900)[2] = 103;
  const c = m5Check(rows, '2020-03-18');
  assert.equal(c.ok, true);
  assert.equal(c.ratio, 6);
});

test('the calendar: new 2006-07 dates, 2008-21 list, 2022 on from council/events.mjs', () => {
  const s = scheduled();
  for (const d of NEW) assert.ok(s.includes(d));
  assert.ok(s.includes('2016-12-14') && s.includes('2024-12-18'));
  assert.ok(!scheduled(['2007-01-31']).includes('2007-01-31'));
});

test('RESULT.md and the headline match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-fomc-cycle/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-fomc-cycle/RESULT.md', import.meta.url), 'utf8');
  assert.equal(md, report(r));
  const h = headline(r);
  assert.ok(h.length < 220, 'headline under 220 characters');
  assert.ok(md.includes(h));
  assert.match(h, /^\*\*Verdict: (PASS|FAIL), /);
  for (const k of Object.keys(TESTS)) {
    const c = r.checks[k];
    assert.equal(r.tests[k].pass, c.oos && c.isSign && c.x2 && c.placebo);
    assert.equal(r.placebo[k].t.length, P.SEEDS);
    assert.equal(r.placebo[k].beaten, r.placebo[k].t.filter((x) => r.tests[k].OOS.tNet > x).length);
  }
  assert.equal(r.verdict, Object.keys(TESTS).some((k) => r.tests[k].pass) ? 'PASS' : 'FAIL');
  assert.equal(r.pHolmBar, 0.02275);
});
