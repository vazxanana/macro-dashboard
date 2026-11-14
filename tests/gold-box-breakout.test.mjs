// research/edge/gold-box-breakout: the rule on hand-made candles, no look-ahead, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../research/edge/gold-box-breakout/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-box-breakout');
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
const q = (h, l) => [[(h + l) / 2, h, l, (h + l) / 2]];   // one-hour day

test('days: UTC days, Saturday and Sunday hours belong to the next Monday', () => {
  const sun = MON + 6 * DAY, sat = MON + 5 * DAY;
  assert.equal(G.dayKey(sun + 22 * H), MON + 7 * DAY);
  assert.equal(G.dayKey(sat + 3 * H), MON + 7 * DAY);
  assert.equal(G.dayKey(MON + 4 * DAY + 23 * H), MON + 4 * DAY);
  const bars = G.loadH1([[MON + 4 * DAY + H, 10, 11, 9, 10], [sun + 22 * H, 10, 15, 10, 14], [MON + 7 * DAY + H, 14, 14.5, 12, 13]]);
  const days = G.daysOf(bars);
  assert.equal(days.length, 2);
  assert.equal(days[1].high, 15); assert.equal(days[1].open, 10); assert.equal(days[1].close, 13);
});

test('box and the usual range: the last L days against the mean of the 60 windows before', () => {
  // 64 days of range 10, then 5 days of range 2
  const spec = [...Array.from({ length: 64 }, () => q(110, 100)), ...Array.from({ length: 5 }, () => q(106, 104))];
  const { days } = build(spec);
  const d = days.length - 1;
  const b = G.boxAt(days, d, 5);
  assert.equal(b.hi, 106); assert.equal(b.lo, 104); assert.equal(b.h, 2);
  // the 60 windows end d-60..d-1; the last four contain the narrow days, all still span 100-110 -> U = 10
  assert.equal(b.U, 10); assert.ok(Math.abs(b.ratio - 0.2) < 1e-12);
  assert.ok(G.pickBox(days, 5, true)(d));
  assert.equal(G.boxAt(days, 63, 5), null);             // too little history for 60 windows of 5 days
  assert.ok(G.boxAt(days, 64, 5));
  assert.equal(G.pickBox(days, 5, true)(d - 5), null);   // a normal box is no signal
});

test('bracket: fill at the level or a gapped open, stop the other side, target 2R, time exit, both in one hour = -1R', () => {
  const base = Array.from({ length: 2 }, () => q(105, 95));
  // buy: hour touches 105 from 103, then the target 105 + 2 x 10 = 125
  let { bars, days } = build([...base, [[103, 106, 102, 105]], [[106, 126, 104, 120]], q(121, 119)]);
  let tr = G.bracket(bars, days, 1, 105, 95);
  assert.equal(tr.side, 1); assert.equal(tr.fill, 105); assert.equal(tr.stop, 95); assert.equal(tr.r0, 10);
  assert.equal(tr.why, 'target'); assert.equal(tr.R, 2);
  // a gap above the level fills at the open
  ({ bars, days } = build([...base, [[108, 109, 107, 108]], q(109, 107)]));
  tr = G.bracket(bars, days, 1, 105, 95, 2, 5, 1);
  assert.equal(tr.fill, 108); assert.equal(tr.r0, 13); assert.equal(tr.why, 'time');
  assert.ok(Math.abs(tr.R - (108 - 108) / 13) < 1e-12);
  // sell: touches 95, stop at 105; stop and target in one later hour -> stop first
  ({ bars, days } = build([...base, [[97, 98, 94, 95]], [[96, 106, 70, 100]], q(101, 99)]));
  tr = G.bracket(bars, days, 1, 105, 95);
  assert.equal(tr.side, -1); assert.equal(tr.why, 'stop'); assert.equal(tr.R, -1);
  // a gap through the stop fills at that open
  ({ bars, days } = build([...base, [[97, 98, 94, 95]], [[108, 109, 107, 108]], q(108, 107)]));
  tr = G.bracket(bars, days, 1, 105, 95);
  assert.equal(tr.why, 'gap'); assert.ok(Math.abs(tr.R - (-(108 - 95) / 10)) < 1e-12);
  // both levels in one hour
  ({ bars, days } = build([...base, [[100, 106, 94, 100]], q(101, 99)]));
  tr = G.bracket(bars, days, 1, 105, 95);
  assert.equal(tr.R, -1); assert.equal(tr.both, true);
  // no fill within 5 days
  ({ bars, days } = build([...base, ...Array.from({ length: 6 }, () => q(104, 96)), q(110, 90)]));
  assert.equal(G.bracket(bars, days, 1, 105, 95), null);
  // data ends before the time exit: open, never booked
  ({ bars, days } = build([...base, [[103, 106, 102, 105]], q(106, 104)]));
  assert.equal(G.bracket(bars, days, 1, 105, 95).open, true);
  // T2: no target, out at the 20th day's last close
  ({ bars, days } = build([...base, [[103, 106, 102, 105]], ...Array.from({ length: 20 }, () => q(130, 106))]));
  tr = G.bracket(bars, days, 1, 105, 95, 0);
  assert.equal(tr.why, 'time'); assert.equal(tr.exit, 118); assert.equal(tr.exitDay, 2 + 20);
});

test('no look-ahead: the signal and its trade do not change with prices after the exit', () => {
  const spec = [...Array.from({ length: 64 }, () => q(110, 100)), ...Array.from({ length: 5 }, () => q(106, 104)),
    [[105, 107, 104.5, 106.5]], [[106.5, 111, 106, 108]], q(109, 108)];
  const a = build([...spec, q(300, 1), q(500, 1)]), b = build([...spec, q(150, 50), q(900, 2)]);
  const sa = G.stream(a.bars, a.days, G.pickBox(a.days, 5, true), 2), sb = G.stream(b.bars, b.days, G.pickBox(b.days, 5, true), 2);
  const fa = sa.find((x) => x.tr), fb = sb.find((x) => x.tr);
  assert.equal(fa.d, 68); assert.deepEqual(fa.tr, fb.tr);
  assert.equal(fa.tr.why, 'target'); assert.equal(fa.tr.exitDay, 70);
  // the box of day d reads nothing after d
  assert.deepEqual(G.boxAt(a.days, 68, 5), G.boxAt(b.days, 68, 5));
});

test('costs: $0.60 a trade in R, financing on buys only, doubled at 2x', () => {
  const buy = { side: 1, fill: 2000, r0: 20, R: 0, t: MON + H, c: MON + 2 * DAY + 23 * H };   // Mon, Tue, Wed 22:00 = 1 + 1 + 3
  const c = G.costs(buy);
  assert.ok(Math.abs(c.spread - 0.03) < 1e-12);
  assert.ok(Math.abs(c.fin - 5 * G.P.fin * 2000 / 20) < 1e-12);
  const c2 = G.costs(buy, 2);
  assert.ok(Math.abs(c2.net - 2 * c.net) < 1e-12);
  assert.equal(G.costs({ ...buy, side: -1 }).fin, 0);
});

test('statistics: month t, Holm, placebo is seeded', () => {
  assert.deepEqual(G.holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(G.pTwo(1.96) - 0.05) < 1e-3);
  const r1 = G.rng(7), r2 = G.rng(7);
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
});

test('report matches result.json; every trade has a stop; the verdict holds', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(md, G.report(r));
  const line = G.verdictLine(r);
  assert.ok(md.includes(line));
  assert.ok(line.length < 220 + 4);
  assert.equal(r.pass, false); assert.deepEqual(r.passing, []);
  assert.equal(r.tests.T1.oos.n, 80); assert.equal(r.tests.T1.oos.net, -0.299); assert.equal(r.placebo.beaten, 1);
  assert.equal(r.placebo.draws.length, 40);
  for (const k of ['T1', 'T2', 'T3']) assert.ok(r.tests[k].oos.medR0 > 8, 'median stop at least $8');
  assert.ok(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8').includes('T1 (primary)'));
});
