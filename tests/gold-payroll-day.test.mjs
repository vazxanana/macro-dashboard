// gold-payroll-day: the date rule, the trade and its stop on hand-made candles, no look-ahead, the baseline, the statistics and
// the report against result.json (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { derive, releaseDates, atr, trade, baseline, events, indexOf, monthSums, tOf, pOne, holm, mulberry32, COST, STOP_K }
  from '../research/edge/gold-payroll-day/run.mjs';

const D = 86400, DIR = 'research/edge/gold-payroll-day/';
// weekday candles from Monday 2019-01-07, flat at p with a 1-dollar range
function flat(n, p = 1300) {
  const out = []; let t = Date.UTC(2019, 0, 7) / 1000;
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w > 0 && w < 6) out.push({ time: t, open: p, high: p + 0.5, low: p - 0.5, close: p }); t += D; }
  return out;
}

test('payroll dates: the BLS rule, January shift, holiday Thursday, 2013 exceptions, council list from 2022', () => {
  assert.equal(derive(2023, 1), '2023-03-10');
  assert.equal(derive(2024, 11), '2025-01-10');
  assert.equal(derive(2015, 5), '2015-07-02');
  const d = releaseDates();
  assert.equal(d.filter((x) => x.d < '2017').length, 120);
  assert.equal(d.filter((x) => x.d >= '2017').length, 117);
  assert.ok(d.some((x) => x.d === '2013-10-22') && d.some((x) => x.d === '2025-12-16'));
  assert.ok(!d.some((x) => x.d === '2025-11-07'), 'the cancelled October 2025 report has no date');
});

test('trade: 2 x ATR(20) stop, time / stop / gap exits, costs and financing', () => {
  const b = flat(40);
  assert.equal(atr(b, 25), 1);
  assert.equal(atr(b, 10), null);
  const t = trade(b, 25, 28);
  assert.equal(t.dist, STOP_K); assert.equal(t.how, 'time'); assert.equal(t.gross, 0);
  assert.ok(t.net < -COST / STOP_K + 1e-12 && t.fin > 0, 'cost and at least one night charged');
  const s = flat(40); s[27] = { ...s[27], low: 1290 };
  assert.equal(trade(s, 25, 28).how, 'stop'); assert.equal(trade(s, 25, 28).exit, 1298);
  const g = flat(40); g[26] = { ...g[26], open: 1295, low: 1294 };
  assert.equal(trade(g, 25, 28).exit, 1295);
  assert.equal(trade(b, 25, 45), null);
});

test('no look-ahead: candles after the exit candle change neither the trade nor the event', () => {
  const b = flat(60), c = b.map((x, i) => (i > 40 ? { ...x, open: 9000, high: 9000, low: 10, close: 5000 } : x));
  assert.deepEqual(trade(b, 30, 33), trade(c, 30, 33));
  const d = [{ d: new Date(b[30].time * 1000).toISOString().slice(0, 10), src: 'test' }], base = { 2019: { gross: 0, net: 0, net2: 0 } };
  assert.deepEqual(events(b, 'T1', d, base, indexOf(b)).rows, events(c, 'T1', d, base, indexOf(c)).rows);
  assert.equal(events(b, 'T2', d, base).rows[0].entryDay, new Date(b[29].time * 1000).toISOString().slice(0, 10));
});

test('baseline: every candle of the year, excess = net − year mean', () => {
  const b = flat(300), base = baseline(b, 'T1');
  assert.ok(base['2019'].n > 200);
  const d = [{ d: new Date(b[100].time * 1000).toISOString().slice(0, 10), src: 'test' }];
  const [r] = events(b, 'T1', d, base).rows;
  assert.ok(Math.abs(r.exN - (r.net - base['2019'].net)) < 1e-12);
});

test('statistics: month sums, t, one-sided p, Holm, seeded placebo stream', () => {
  assert.deepEqual(monthSums([{ d: '2010-01-08', exN: 1 }, { d: '2010-01-29', exN: 2 }, { d: '2010-02-05', exN: -1 }]), [3, -1]);
  assert.ok(Math.abs(pOne(0, 10) - 0.5) < 1e-9);
  assert.ok(Math.abs(pOne(2.228, 10) - 0.025) < 1e-3);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(tOf([1, 1]), 0);
  assert.equal(mulberry32(1)(), mulberry32(1)());
});

test('report agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8')), md = fs.readFileSync(DIR + 'RESULT.md', 'utf8');
  const head = md.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.equal(head.replace(/\*\*/g, ''), r.headline);
  assert.ok(r.headline.length < 220);
  const [t1, t2] = r.tests;
  assert.equal(r.verdict, t1.pass ? 'PASS' : 'FAIL');
  for (const x of r.tests) {
    assert.equal(x.pass, Object.values(x.checks).every(Boolean));
    assert.equal(x.placebo.means.length, 40);
    assert.equal(x.placebo.beats, x.placebo.means.filter((m) => x.oos.exN > m).length);
    const oos = x.trades.filter((t) => t.d >= '2017-01-01');
    assert.equal(oos.length, x.oos.n);
    assert.ok(Math.abs(oos.reduce((s, t) => s + t.exN, 0) / oos.length - x.oos.exN) < 0.001);
    assert.ok(x.oos.n >= 100 && x.is.n >= 100);
    for (const t of x.trades) assert.ok(t.stop < t.entry, 'every trade is a long with its stop below');
  }
  assert.ok(md.includes(`| T1 | out of sample 2017-26 | ${t1.oos.n} |`));
  assert.ok(md.includes(`beats ${t2.placebo.beats} of 40`));
});
