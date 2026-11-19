// research/edge/gold-box-fade: the fade rule on hand-made candles, no look-ahead, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../research/edge/gold-box-fade/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-box-fade');
const DAY = 86400, H = 3600, MON = Date.parse('2024-01-01T00:00:00Z') / 1000;   // a Monday
// weekdays from MON; each day = list of hourly [o, h, l, c] (one hour each from 01:00)
function build(spec) {
  const rows = [];
  let d = MON;
  for (const hours of spec) {
    while ([0, 6].includes(new Date(d * 1000).getUTCDay())) d += DAY;
    hours.forEach(([o, h, l, c], k) => rows.push([d + (k + 1) * H, o, h, l, c]));
    d += DAY;
  }
  const bars = G.loadH1(rows);
  return { bars, days: G.daysOf(bars) };
}
const q = (h, l) => [[(h + l) / 2, h, l, (h + l) / 2]];
const { T1, T2, T3 } = G.TESTS;
const base = Array.from({ length: 2 }, () => q(105, 95));   // box 95-105 read at day 1, h = 10

test('days: Saturday and Sunday hours belong to the next Monday', () => {
  assert.equal(G.dayKey(MON + 6 * DAY + 22 * H), MON + 7 * DAY);
  assert.equal(G.dayKey(MON + 5 * DAY + 3 * H), MON + 7 * DAY);
});

test('box: the last five days against the mean of the 60 windows before', () => {
  const spec = [...Array.from({ length: 64 }, () => q(110, 100)), ...Array.from({ length: 5 }, () => q(106, 104))];
  const { days } = build(spec);
  const b = G.boxAt(days, days.length - 1);
  assert.equal(b.hi, 106); assert.equal(b.lo, 104); assert.equal(b.U, 10); assert.ok(Math.abs(b.ratio - 0.2) < 1e-12);
  assert.equal(G.boxAt(days, 63), null);
});

test('fade: an upper break is sold at the next open, stop 0.5 box beyond the edge, target the other side', () => {
  // break hour touches 105, next hour opens 104 -> sell 104, stop 110, target 95
  const { bars, days } = build([...base, [[103, 106, 102, 105], [104, 104.5, 99, 100]], [[100, 101, 94, 96]], q(97, 95.5)]);
  const f = G.fade(bars, days, 1, 105, 95, T1).trade;
  assert.equal(f.side, -1); assert.equal(f.fill, 104); assert.equal(f.stop, 110); assert.equal(f.target, 95);
  assert.equal(f.r0, 6); assert.equal(f.why, 'target'); assert.ok(Math.abs(f.R - 9 / 6) < 1e-12);
  // T2 targets the midpoint 100, reached in the entry hour itself
  const g = G.fade(bars, days, 1, 105, 95, T2).trade;
  assert.equal(g.target, 100); assert.equal(g.why, 'target'); assert.equal(g.exitDay, 2);
});

test('fade: a lower break is bought; stop first when one hour holds both; gap through the stop fills at the open', () => {
  let { bars, days } = build([...base, [[96, 97, 94, 95], [96, 106, 89, 100]], q(101, 99)]);
  let f = G.fade(bars, days, 1, 105, 95, T1).trade;
  assert.equal(f.side, 1); assert.equal(f.stop, 90); assert.equal(f.why, 'stop'); assert.equal(f.R, -1);
  ({ bars, days } = build([...base, [[96, 97, 94, 95], [96, 97, 95.5, 96]], [[85, 86, 84, 85]], q(86, 84)]));
  f = G.fade(bars, days, 1, 105, 95, T1).trade;
  assert.equal(f.why, 'gap'); assert.equal(f.exit, 85); assert.ok(Math.abs(f.R - (85 - 96) / 6) < 1e-12);
});

test('fade: no trade on a two-sided hour, an entry past the stop, an entry past the target, or no break', () => {
  let { bars, days } = build([...base, [[100, 106, 94, 100], [100, 101, 99, 100]], q(101, 99)]);
  assert.equal(G.fade(bars, days, 1, 105, 95, T1).skip, 'both');
  ({ bars, days } = build([...base, [[103, 112, 102, 111], [111, 113, 110, 112]], q(113, 111)]));
  assert.equal(G.fade(bars, days, 1, 105, 95, T1).skip, 'past-stop');
  ({ bars, days } = build([...base, [[103, 106, 98, 99], [99, 100, 97, 98]], q(99, 97)]));
  assert.equal(G.fade(bars, days, 1, 105, 95, T2).skip, 'past-target');   // sell entry 99 below the midpoint 100
  assert.ok(G.fade(bars, days, 1, 105, 95, T1).trade);                   // but T1's target 95 is still ahead
  ({ bars, days } = build([...base, ...Array.from({ length: 6 }, () => q(104, 96)), q(110, 90)]));
  assert.equal(G.fade(bars, days, 1, 105, 95, T1), null);
});

test('time exits: T3 at the 5th day after the fill day, T1 at the 20th', () => {
  const flat = Array.from({ length: 22 }, () => q(104, 101));
  const { bars, days } = build([...base, [[103, 106, 102, 105], [104, 104.5, 101, 102]], ...flat]);
  const a = G.fade(bars, days, 1, 105, 95, T3).trade, b = G.fade(bars, days, 1, 105, 95, T1).trade;
  assert.equal(a.why, 'time'); assert.equal(a.exitDay, 2 + 5);
  assert.equal(b.why, 'time'); assert.equal(b.exitDay, 2 + 20);
});

test('no look-ahead: the signal and its trade do not change with prices after the exit', () => {
  const spec = [...Array.from({ length: 64 }, () => q(110, 100)), ...Array.from({ length: 5 }, () => q(106, 104)),
    [[105, 106.5, 104.8, 106], [105.8, 106, 103.5, 104]], q(105, 104.5)];
  const a = build([...spec, q(300, 1), q(500, 1)]), b = build([...spec, q(150, 50), q(900, 2)]);
  const fa = G.stream(a.bars, a.days, T1).find((x) => x.tr), fb = G.stream(b.bars, b.days, T1).find((x) => x.tr);
  assert.equal(fa.d, 68); assert.deepEqual(fa.tr, fb.tr);
  assert.equal(fa.tr.side, -1); assert.equal(fa.tr.why, 'target'); assert.equal(fa.tr.exitDay, 69);
  assert.deepEqual(G.boxAt(a.days, 68), G.boxAt(b.days, 68));
});

test('costs: $0.60 a trade in R, financing on buys only, doubled at 2x', () => {
  const buy = { side: 1, fill: 2000, r0: 20, R: 0, t: MON + H, c: MON + 2 * DAY + 23 * H };
  const c = G.costs(buy);
  assert.ok(Math.abs(c.spread - 0.03) < 1e-12);
  assert.ok(Math.abs(c.fin - 5 * G.P.fin * 2000 / 20) < 1e-12);
  assert.ok(Math.abs(G.costs(buy, 2).net - 2 * c.net) < 1e-12);
  assert.equal(G.costs({ ...buy, side: -1 }).fin, 0);
});

test('statistics: Holm, p, seeded placebo', () => {
  assert.deepEqual(G.holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(G.pTwo(1.96) - 0.05) < 1e-3);
  const r1 = G.rng(7), r2 = G.rng(7);
  assert.deepEqual([r1(), r1()], [r2(), r2()]);
});

test('report matches result.json; the verdict holds', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(md, G.report(r));
  const line = G.verdictLine(r);
  assert.ok(md.includes(line)); assert.ok(line.length < 220);
  assert.equal(r.pass, false); assert.deepEqual(r.passing, []);
  assert.equal(r.tests.T1.conf.n, 99); assert.equal(r.tests.T1.conf.net, -0.234); assert.equal(r.tests.T1.conf.tNet, -1.51);
  assert.equal(r.tests.T1.desc.net, -0.076); assert.equal(r.placebo.beaten, 3); assert.equal(r.placebo.draws.length, 40);
  for (const k of ['T1', 'T2', 'T3']) assert.ok(r.tests[k].conf.medR0 > 5, 'median stop at least $5');
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  assert.ok(pre.includes('T1 (primary)') && pre.includes('option (b)'));
});
