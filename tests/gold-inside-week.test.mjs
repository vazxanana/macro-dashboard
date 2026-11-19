// research/edge/gold-inside-week: the rules on hand-made candles, no look-ahead, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../research/edge/gold-inside-week/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-inside-week');
const DAY = 86400, MON = Date.parse('2024-01-01T00:00:00Z') / 1000;   // a Monday
// weeks of 5 days from [high, low] per week (open / close in the middle unless given)
function build(spec) {
  const days = [];
  spec.forEach((wk, w) => wk.forEach(([h, l, o, c], d) => days.push({ time: MON + (w * 7 + d) * DAY, open: o ?? (h + l) / 2, high: h, low: l, close: c ?? (h + l) / 2 })));
  return days;
}
const flat = (h, l) => Array.from({ length: 5 }, () => [h, l]);

test('weeks: grouped Monday to Friday, Sunday stub folded into Monday', () => {
  const sun = MON + 6 * DAY;   // Sunday 7 Jan
  const rows = [[MON, 10, 11, 9, 10, 0], [MON + DAY, 10, 12, 9, 11, 0], [sun, 11, 15, 10.5, 11, 0], [sun + DAY, 11, 12, 10, 11, 0]];
  const days = G.loadDays(rows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5]]));
  assert.equal(days.length, 3);
  const W = G.weeksOf(days);
  assert.equal(W.length, 2);
  assert.equal(W[1].high, 15);   // the Sunday high belongs to Monday 8 Jan's week
  assert.equal(W[1].byDow[1], 2);
});

test('inside week, NR4 week, Monday held through Wednesday', () => {
  const W = G.weeksOf(build([flat(110, 90), flat(105, 95), flat(120, 80), flat(130, 70), flat(106, 104)]));
  assert.equal(G.isInside(W, 1), true);
  assert.equal(G.isInside(W, 2), false);
  assert.equal(G.isNR4(W, 4), true);           // 2 < 10, 40, 60
  assert.equal(G.isNR4(W, 3), false);
  const days = build([[[110, 90], [109, 91], [110, 90], [111, 95], [100, 80]], [[110, 90], [111, 92], [105, 95], [100, 99], [100, 99]]]);
  const W2 = G.weeksOf(days);
  assert.equal(G.mondayHeld(days, W2[0]), true);     // equal to Monday's high still holds
  assert.equal(G.mondayHeld(days, W2[1]), false);    // Tuesday broke Monday's high
});

test('bracket: fill at the level or a gapped open, stop the other side, both levels in one day = a loss', () => {
  // range 100-90; next days: 95, then a day through 100, then flat, exit close 104
  const days = build([[[96, 94], [101, 95, 96, 100], [103, 99, 100, 102], [105, 101, 102, 104], [104, 103]]]);
  const tr = G.bracket(days, 100, 90, [0, 1, 2], 3);
  assert.equal(tr.side, 1); assert.equal(tr.fill, 100); assert.equal(tr.stop, 90); assert.equal(tr.r0, 10);
  assert.ok(Math.abs(tr.R - 0.4) < 1e-12); assert.equal(tr.why, 'time');
  // a gap open above the level fills at the open
  const g = G.bracket(build([[[105, 102, 103, 104], [106, 104]]]), 100, 90, [0], 1);
  assert.equal(g.fill, 103); assert.equal(g.r0, 13);
  // both levels in one day
  const b = G.bracket(build([[[101, 89, 95, 95], [100, 90]]]), 100, 90, [0], 1);
  assert.equal(b.R, -1); assert.equal(b.both, true);
  // sell, then a gap through the stop fills at that open
  const s = G.bracket(build([[[95, 89, 92, 90], [104, 101, 103, 102]]]), 100, 90, [0], 1);
  assert.equal(s.side, -1); assert.equal(s.why, 'gap'); assert.ok(Math.abs(s.R - (-(103 - 90) / 10)) < 1e-12);
  // no fill
  assert.equal(G.bracket(build([[[99, 91], [99, 91]]]), 100, 90, [0, 1], 1), null);
  // every filled trade has a stop on the losing side
  for (const x of [tr, g, b, s]) assert.ok(x.side > 0 ? x.stop < x.fill : x.stop > x.fill);
});

test('no look-ahead: a signal and its trade do not change with prices after them', () => {
  const spec = [flat(110, 90), flat(105, 95), [[104, 96], [106, 99, 100, 105], [107, 104], [108, 105], [109, 106]], flat(112, 108), flat(150, 50), flat(200, 10)];
  const a = build(spec), W = G.weeksOf(a), sa = G.stream(a, W, 'T1');
  const spec2 = spec.slice(); spec2[4] = flat(300, 1); spec2[5] = flat(400, 1);
  const b = build(spec2), sb = G.stream(b, G.weeksOf(b), 'T1');
  assert.equal(sa[0].w, 1);
  assert.deepEqual(sa[0].tr, sb[0].tr);           // the week-1 signal's trade closes in week 3, before the changed weeks
  assert.equal(sa[0].tr.exitI, W[3].idx.at(-1));
  // T3: Thursday's orders use Monday's range only
  const d1 = build([[[110, 90], [109, 91], [108, 92], [111, 100], [112, 105]]]), d2 = build([[[110, 90], [109, 91], [108, 92], [111, 100], [150, 60]]]);
  assert.deepEqual(G.signals(d1, G.weeksOf(d1), 'T3').map((x) => [x.hi, x.lo]), G.signals(d2, G.weeksOf(d2), 'T3').map((x) => [x.hi, x.lo]));
});

test('costs: $0.60 a trade in R, financing on buys only', () => {
  const tr = { side: 1, fill: 2000, r0: 20, R: 0, t: MON, c: MON + 2 * DAY + 21 * 3600 };
  const c = G.costs(tr);
  assert.ok(Math.abs(c.spread - 0.03) < 1e-12);
  assert.ok(c.nights >= 2 && c.fin > 0);
  assert.equal(G.costs({ ...tr, side: -1 }).fin, 0);
  assert.ok(Math.abs(G.costs(tr, { mult: 2 }).spread - 0.06) < 1e-12);
});

test('statistics helpers', () => {
  assert.deepEqual(G.holm([0.01, 0.04, 0.03]), [true, false, false]);
  const r = G.mulberry32(7), r2 = G.mulberry32(7);
  assert.equal(r(), r2());
  assert.equal(G.maxDD([{ c: 1, net: 1 }, { c: 2, net: -3 }, { c: 3, net: 1 }]), -3);
});

test('RESULT.md agrees with result.json', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(res.verdict, 'FAIL'); assert.equal(res.passed, 0);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.includes('FAIL, 0 of 3') && line.length < 260);
  const f = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  const lab = { T1: 'T1 inside week (primary)', T2: 'T2 NR4 week', T3: 'T3 Monday held to Wednesday' };
  for (const [k, v] of Object.entries(res.tests)) {
    assert.equal(v.pass, false);
    for (const [w, tag] of [['inSample', 'IS 2008-16'], ['outOfSample', 'OOS 2017-26']]) {
      const x = v.windows[w];
      const row = `| ${lab[k]} | ${tag} | ${x.n} | ${f(x.gross)} | ${f(x.net)} | ${f(x.net2)} | ${(x.win * 100).toFixed(1)} | ${f(x.totalNet, 2)} | ${f(x.maxDD, 2)} | ${x.t.toFixed(2).replace('-', '−')} |`;
      assert.ok(md.includes(row), `row missing: ${row}`);
    }
    const p = v.placebo;
    assert.ok(md.includes(`| ${k} | ${f(p.real)} | ${f(p.median)} | ${f(p.p95)} |`), `placebo ${k}`);
    assert.ok(md.includes(`${p.beaten} of 40`));
  }
  assert.ok(!/inside week.*edge\b/i.test(line));
});
