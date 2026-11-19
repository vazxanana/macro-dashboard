// research/edge/gold-outside-week: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { weeks, weekOf, outsideSignal, baseSignal, strong, trade, run, signalsOf, monthSums, holm, P } from '../research/edge/gold-outside-week/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400;
// weekday candles from Monday 2024-01-01 for n calendar days, each from fn(dayIndex, weekIndex) -> [o, h, l, c]
function days(n, fn) {
  const ds = []; let t = Date.UTC(2024, 0, 1) / 1000;
  for (let k = 0; k < n; k++, t += D) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) { const [o, h, l, c] = fn(ds.length, Math.floor(k / 7)); ds.push({ time: t, open: o, high: h, low: l, close: c }); } }
  return ds;
}
// week 0 flat 990-1010, week 1 outside (980-1040) closing at `c1`, weeks 2.. flat around 1000 unless `after` says otherwise
function sample(c1 = 1035, after = null) {
  return days(49, (i, w) => {
    if (w === 1) return i === 5 ? [1000, 1001, 980, 1000] : [1000, 1040, 999, c1];
    if (w >= 2 && after) return after(i, w);
    return [1000, 1010, 990, 1000];
  });
}

test('weeks: Monday-based, aggregated open / high / low / close', () => {
  assert.equal(new Date(weekOf(Date.UTC(2024, 0, 3) / 1000) * 1000).toISOString().slice(0, 10), '2024-01-01');
  assert.equal(new Date(weekOf(Date.UTC(2024, 0, 7) / 1000) * 1000).toISOString().slice(0, 10), '2024-01-01'); // Sunday
  const W = weeks(sample());
  assert.equal(W.length, 7); assert.equal(W[1].days, 5);
  assert.deepEqual([W[1].open, W[1].high, W[1].low, W[1].close], [1000, 1040, 980, 1035]);
});

test('signal: outside week with a close in its outer third, else none', () => {
  let W = weeks(sample(1035)); assert.equal(outsideSignal(W, 1), 1);
  W = weeks(sample(985)); assert.equal(outsideSignal(W, 1), -1);
  W = weeks(sample(1010)); assert.equal(outsideSignal(W, 1), 0); // middle third
  W = weeks(sample()); assert.equal(outsideSignal(W, 2), 0); // inside the outside week
  assert.equal(outsideSignal(W, 0), 0);
  assert.equal(strong({ high: 10, low: 10, close: 10 }), 0);
  assert.equal(baseSignal(W, 1), 1);
  assert.deepEqual(signalsOf(W, outsideSignal), [[1, 1]]);
});

test('no look-ahead: the signal reads only weeks up to the signal week', () => {
  const W = weeks(sample(1035)), W2 = weeks(sample(1035, () => [5000, 9000, 1, 4000]));
  assert.equal(outsideSignal(W2, 1), outsideSignal(W, 1));
});

test('trade: next week open, stop $0.30 past the other extreme, time exit, financing on buys only', () => {
  const ds = sample(1035), W = weeks(ds);
  const b = trade(ds, W, 1, 1, 10);
  assert.equal(b.entry, 1000); assert.ok(Math.abs(b.stop - (980 - P.buf)) < 1e-9); assert.ok(Math.abs(b.risk - 20.3) < 1e-9);
  assert.equal(b.why, 'time'); assert.equal(b.xi - b.e, 9); assert.equal(b.R, 0);
  assert.ok(Math.abs(b.costR - 0.6 / 20.3) < 1e-12);
  assert.equal(b.nights, nights(ds[b.e].time, ds[b.xi].time + D)); assert.ok(b.nights > 0);
  assert.ok(Math.abs(b.finR - b.nights * FIN.xau.long * 1000 / 20.3) < 1e-12);
  const s = trade(ds, W, 1, -1, 10);
  assert.ok(Math.abs(s.stop - 1040.3) < 1e-9); assert.equal(s.finR, 0); assert.equal(s.nights, 0);
});

test('stops: a touch fills at the stop, a gap through it at the open; one position at a time', () => {
  const touch = sample(1035, (i, w) => (w === 2 && i === 12 ? [1000, 1001, 975, 978] : [1000, 1010, 990, 1000]));
  let ds = touch, W = weeks(ds), t = trade(ds, W, 1, 1, 10);
  assert.equal(t.why, 'stop'); assert.ok(Math.abs(t.R + 1) < 1e-9);
  const gap = sample(1035, (i, w) => (w === 2 && i === 12 ? [970, 975, 965, 972] : [1000, 1010, 990, 1000]));
  ds = gap; W = weeks(ds); t = trade(ds, W, 1, 1, 10);
  assert.equal(t.why, 'gap'); assert.equal(t.exit, 970); assert.ok(t.R < -1);
  // two signals one week apart: the second enters before the first exits, so it is skipped
  ds = sample(1035); W = weeks(ds);
  const T = run(ds, W, [[1, 1], [2, -1]], 10);
  assert.equal(T.length, 1);
  assert.equal(run(ds, W, [[1, 1], [2, -1]], 5).length, 2); // a 5-day hold ends before week 3 opens
});

test('statistics helpers: month sums fill empty months, Holm is monotone', () => {
  const xs = monthSums([{ m: '2024-02', net: 1 }, { m: '2024-02', net: 0.5 }], '2024-01', '2024-03');
  assert.deepEqual(xs, [0, 1.5, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('RESULT.md agrees with result.json', () => {
  const res = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-outside-week/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-outside-week/RESULT.md', import.meta.url), 'utf8');
  const g = res.gold, t1 = g.tests.T1;
  assert.equal(res.verdict, 'FAIL'); assert.equal(g.verdict, 'FAIL');
  const v = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(v.length < 260 && /FAIL, 0 of 3/.test(v));
  assert.ok(v.includes(`n ${t1.oos.n}`) && v.includes(`${t1.oos.mean}R`) && v.includes(`t ${t1.oos.monthT}`) && v.includes(`n ${t1.is.n}`));
  const f3 = (x) => (x > 0 ? '+' : '') + x.toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const r = g.tests[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} `));
    for (const s of [String(r.is.n), f3(r.is.mean), f3(r.isGross.mean), String(r.oos.n), f3(r.oos.mean), f3(r.oosGross.mean), f3(r.oos2x.mean), f3(r.half1.mean), f3(r.half2.mean), r.oos.monthT.toFixed(2)]) assert.ok(row.includes(s), `${id} ${s}`);
    assert.equal(g.checks[id].pass, false);
  }
  assert.ok(md.includes(`beats ${t1.placebo.beaten} of 40`));
  assert.ok(md.includes(`$${t1.stopUsd.oos}`) && t1.stopUsd.oos >= 10 && t1.stopUsd.is >= 10);
  assert.ok(md.includes(`OOS n ${g.baseline.oos.n}`) && md.includes(`t ${t1.vsBaseline.oos.welchT}`));
  assert.equal(t1.placebo.draws.length, P.seeds);
});
