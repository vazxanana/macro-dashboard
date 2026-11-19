// gold-hour-periodicity study: blocks of the UTC day, the same-block statistic from earlier days only (no look-ahead), the
// strongest-block pick, the stop and time exit on hand-made candles, costs, the placebo keeping day and side, and the report
// against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toDays, blockStat, trade, withNet, signals, tradesOf, placeboSigs, holm, monthT, P, TESTS } from '../research/edge/gold-hour-periodicity/run.mjs';

const D0 = Date.parse('2022-03-07T00:00:00Z') / 1000;   // a Monday
// n weekdays of H1 candles 00-24 UTC; block b on day k moves by drift(k, b) over its four hours
function rowsOf(n, drift) {
  const rows = []; let px = 1000, day = D0, made = 0;
  while (made < n) {
    const wd = new Date(day * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6) {
      for (let h = 0; h < 24; h++) {
        const b = Math.floor(h / 4), step = b < 5 ? drift(made, b) / 4 : 0, o = px, c = px + step;
        rows.push([day + h * 3600, o, Math.max(o, c) + 0.5, Math.min(o, c) - 0.5, c]); px = c;
      }
      made++;
    }
    day += 86400;
  }
  return rows;
}
const alt = (k, b) => (b === 2 ? 4 : (k + b) % 2 ? 1 : -1);   // block 2 rises every day, the others alternate

test('days and blocks: weekdays only, five complete blocks, 20-24 UTC never read, an incomplete block dropped', () => {
  const rows = rowsOf(6, alt), days = toDays(rows);
  assert.equal(days.length, 6);
  for (const d of days) { assert.equal(d.blocks.length, 5); for (const x of d.blocks) assert.equal(x.bars.length, 4); }
  assert.equal(days[0].blocks[2].t, D0 + 8 * 3600);
  assert.ok(Math.abs(days[0].blocks[2].r - Math.log(days[0].blocks[2].cl / days[0].blocks[2].o)) < 1e-15);
  const cut = rows.filter((r) => r[0] !== D0 + 9 * 3600);
  assert.equal(toDays(cut)[0].blocks[2], null);
});

test('block statistic reads only earlier days: changing day d and later changes nothing at d', () => {
  const a = toDays(rowsOf(30, alt)), b = toDays(rowsOf(30, (k, x) => (k >= 22 ? -9 : alt(k, x))));
  for (let x = 0; x < 5; x++) assert.deepEqual(blockStat(a, 22, x, 20), blockStat(b, 22, x, 20));
  assert.notDeepEqual(blockStat(a, 23, 2, 20), blockStat(b, 23, 2, 20));
  assert.equal(blockStat(a, 19, 2, 20), null);   // fewer than L earlier occurrences
  const s = blockStat(a, 22, 2, 20);
  assert.ok(s.m > 0 && s.z > 0);
  const want = a.slice(2, 22).reduce((t, d) => t + d.blocks[2].range, 0) / 20;
  assert.ok(Math.abs(s.A - want) < 1e-12);
});

test('T1 picks the steadiest block (largest |z|) on the side of its mean; T3 trades every block', () => {
  const days = toDays(rowsOf(26, (k, b) => (b === 2 ? 4 + (k % 3) : (k + b) % 2 ? 1 : -0.5)));
  const s1 = signals(days, TESTS.T1);
  assert.equal(s1.length, 6); for (const s of s1) { assert.equal(s.b, 2); assert.equal(s.side, 1); }
  const s3 = signals(days, TESTS.T3);
  assert.ok(s3.length > 6 && new Set(s3.map((s) => s.b)).size >= 2);
});

test('trade: entry at the block open, stop 1.0 x A on the losing side, time exit, stop and gap fills', () => {
  const days = toDays(rowsOf(1, () => 4)), x = days[0].blocks[1];
  const t = trade(x, 1, 2);
  assert.equal(t.fill, x.o); assert.equal(t.stop, x.o - 2); assert.equal(t.why, 'time'); assert.equal(t.exit, x.cl); assert.ok(t.R > 0);
  const s = trade(x, -1, 2);
  assert.equal(s.stop, x.o + 2); assert.equal(s.why, 'stop'); assert.equal(s.R, -1);
  const g = { ...x, bars: x.bars.map((k, i) => (i === 2 ? { ...k, open: x.o + 5, high: x.o + 5.5 } : k)) };
  const gt = trade(g, -1, 10);   // stop o+10 not reached by the gap candle
  assert.equal(gt.why, 'time');
  const gs = trade(g, -1, 3);    // candle 1 already reaches o+3? it closes at o+2 with high o+2.5: no; candle 2 opens at o+5 > stop
  assert.equal(gs.why, 'gap'); assert.equal(gs.exit, x.o + 5);
});

test('costs: $0.60 a round trip in R, x2 doubles it, no financing inside a block', () => {
  const x = toDays(rowsOf(1, () => 4))[0].blocks[0], t = withNet(trade(x, 1, 3));
  assert.equal(t.nights, 0); assert.equal(t.fin, 0);
  assert.ok(Math.abs(t.R - t.net - P.COST / 3) < 1e-12);
  assert.ok(Math.abs(t.R - t.net2 - 2 * P.COST / 3) < 1e-12);
});

test('placebo keeps each trade day and side and moves it to another block; T3 shuffles sides within a day', () => {
  const days = toDays(rowsOf(30, alt)), s1 = signals(days, TESTS.T1), p1 = placeboSigs(s1, TESTS.T1, 7);
  assert.equal(p1.length, s1.length);
  p1.forEach((p, i) => { assert.equal(p.d, s1[i].d); assert.equal(p.side, s1[i].side); assert.notEqual(p.b, s1[i].b); });
  assert.deepEqual(placeboSigs(s1, TESTS.T1, 7), p1);
  const s3 = signals(days, TESTS.T3), p3 = placeboSigs(s3, TESTS.T3, 3);
  const count = (arr, d) => arr.filter((x) => x.d === d).map((x) => x.side).sort().join();
  for (const d of new Set(s3.map((s) => s.d))) assert.equal(count(p3, d), count(s3, d));
  assert.ok(tradesOf(days, p1).every((t) => t.r0 > 0));
});

test('statistics: month sums and Holm', () => {
  const t0 = Date.parse('2020-01-15T00:00:00Z') / 1000, rows = [0, 1, 2, 3].map((m) => ({ c: t0 + m * 31 * 86400, net: m + 1 }));
  const r = monthT(rows, t0, t0 + 3 * 31 * 86400);
  assert.equal(r.months, 4); assert.ok(Math.abs(r.t - 2.5 / (Math.sqrt(5 / 3) / 2)) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((h) => h.adj), [0.03, 0.08, 0.5]);
});

test('report agrees with result.json', () => {
  const res = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-hour-periodicity/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-hour-periodicity/RESULT.md', import.meta.url), 'utf8');
  assert.equal(res.verdict, 'FAIL');
  assert.equal(res.tests.T1.pass || res.tests.T2.pass || res.tests.T3.pass, false);
  const v = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(v && v.length < 240 && /FAIL/.test(v));
  const fmt = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  const n = (x) => x.toLocaleString('en-US');
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['is', 'oos']) {
    const s = res.tests[k][w];
    const row = md.split('\n').find((l) => l.startsWith(`| ${k} `) && l.includes(w === 'is' ? 'IS 2007-16' : 'OOS 2017'));
    assert.ok(row, k + w);
    for (const part of [n(s.n), fmt(s.gross), fmt(s.net), fmt(s.net2), (s.t < 0 ? '−' : '+') + Math.abs(s.t).toFixed(2)]) assert.ok(row.includes(part), `${k} ${w} ${part}`);
  }
  assert.ok(v.includes(fmt(res.tests.T1.oos.net) + 'R') && v.includes(n(res.tests.T1.oos.n)));
  for (const k of ['T1', 'T2', 'T3']) assert.ok(md.includes(fmt(res.tests[k].placebo.p95)), k + ' placebo');
  assert.equal(res.tests.T1.oos.fin, 0);
});
