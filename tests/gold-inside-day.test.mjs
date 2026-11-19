// research/edge/gold-inside-day: the rule on hand-made candles, no look-ahead, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../research/edge/gold-inside-day/run.mjs';
import { foldWeekend } from '../council/fills.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-inside-day');
const DAY = 86400, MON = Date.parse('2024-01-01T00:00:00Z') / 1000;   // a Monday
// M5 candles of one day from 01:00 UTC, one per [o, h, l, c]; returns { m5, E } with E the folded-day shape walk() reads
function oneDay(list, start = MON + 3600) {
  const m5 = list.map(([o, h, l, c], k) => [start + k * 300, o, h, l, c]);
  return { m5, E: { time: MON, a: 0, b: m5.length - 1 } };
}
// day objects for signal tests: [high, low, close], all full
const days = (spec) => spec.map(([h, l, c], k) => ({ time: MON + k * DAY, open: (h + l) / 2, high: h, low: l, close: c ?? (h + l) / 2, n: 200 }));

test('days from M5: UTC days, weekend folded into Monday exactly as foldWeekend, candle ranges carried', () => {
  const fri = MON + 4 * DAY, sun = MON + 6 * DAY, mon2 = MON + 7 * DAY;
  const m5 = [[fri, 10, 11, 9, 10], [fri + 300, 10, 12, 9.5, 11], [sun + 79200, 11, 15, 10.5, 11], [mon2, 11, 12, 10, 11.5], [mon2 + 300, 11.5, 12.5, 11, 12]];
  const raw = G.utcDays(m5), D = G.foldDays(raw);
  assert.equal(raw.length, 3); assert.equal(D.length, 2);
  const fw = foldWeekend(raw.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
  assert.deepEqual(D.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })), fw);
  assert.equal(D[1].high, 15); assert.equal(D[1].open, 11); assert.equal(D[1].a, 2); assert.equal(D[1].b, 4); assert.equal(D[1].n, 3);
});

test('inside day, ATR14 and the tight condition; thin days are never signals', () => {
  const D = days([[110, 90], [105, 95], [106, 94], [104, 96], [103, 97]]);
  assert.equal(G.isInside(D, 1), true);
  assert.equal(G.isInside(D, 2), false);          // high above the previous high
  assert.equal(G.isInside(D, 3), true);
  const eq = days([[110, 90], [110, 95]]);
  assert.equal(G.isInside(eq, 1), false);         // an equal high is not inside
  assert.deepEqual(G.signals(D, 'T1'), [1, 3]);   // day 4 has no next day
  const thin = D.map((d, k) => (k === 2 ? { ...d, n: 50 } : d));
  assert.deepEqual(G.signals(thin, 'T1'), []);    // day 1's order day is thin; day 3's previous day is thin too
  // ATR: 15 days of range 10 flat closes -> 10; a 2-wide inside day is tight, a 9-wide one is not
  const A = days([...Array.from({ length: 15 }, () => [110, 100, 105]), [106, 104, 105], [109, 101]]);
  assert.equal(G.atr(A, 14), 10);
  assert.equal(G.atr(A, 3), null);
  assert.equal(G.tight(A, 15), true);
  const B = days([...Array.from({ length: 15 }, () => [110, 100, 105]), [109.5, 100.5, 105], [109, 101]]);
  assert.equal(G.tight(B, 15), false);
  assert.deepEqual(G.signals(A, 'T3'), [15]); assert.deepEqual(G.signals(B, 'T3'), []);
});

test('walk: fill at the level or a gapped open, stop the other side, fill-candle stop, target, 21:00 exit', () => {
  // range 100-90. Buy fills at 100, then drifts; exit at the last candle before 21:00 (all candles here are before it)
  let { m5, E } = oneDay([[95, 96, 94, 95], [96, 101, 95, 100], [100, 103, 99, 102], [102, 105, 101, 104]]);
  const tr = G.walk(m5, E, 100, 90);
  assert.equal(tr.side, 1); assert.equal(tr.fill, 100); assert.equal(tr.stop, 90); assert.equal(tr.r0, 10);
  assert.ok(Math.abs(tr.R - 0.4) < 1e-12); assert.equal(tr.why, 'time'); assert.equal(tr.t, m5[1][0]);
  // T2: the 1R target (110) is not reached here; reached at 110 later
  ({ m5, E } = oneDay([[95, 96, 94, 95], [96, 101, 95, 100], [100, 111, 99, 108], [108, 109, 80, 85]]));
  const t2 = G.walk(m5, E, 100, 90, { target: 1 });
  assert.equal(t2.why, 'target'); assert.ok(Math.abs(t2.R - 1) < 1e-12);
  assert.equal(G.walk(m5, E, 100, 90).why, 'stop');   // T1 rides to the stop in the last candle
  // target and stop in one candle: the stop
  ({ m5, E } = oneDay([[96, 101, 95, 100], [100, 112, 88, 100]]));
  assert.equal(G.walk(m5, E, 100, 90, { target: 1 }).R, -1);
  // a gap open above the level fills at the open
  ({ m5, E } = oneDay([[103, 104, 102, 104], [104, 105, 103, 104]]));
  const g = G.walk(m5, E, 100, 90);
  assert.equal(g.fill, 103); assert.equal(g.r0, 13);
  // both levels in the fill candle: a full loss
  ({ m5, E } = oneDay([[95, 101, 89, 95]]));
  const b = G.walk(m5, E, 100, 90);
  assert.equal(b.R, -1); assert.equal(b.fillStop, true);
  // sell, then a candle gapping through the stop exits at its open
  ({ m5, E } = oneDay([[92, 93, 89, 90], [103, 104, 101, 102]]));
  const s = G.walk(m5, E, 100, 90);
  assert.equal(s.side, -1); assert.equal(s.why, 'gap'); assert.ok(Math.abs(s.R - (-(103 - 90) / 10)) < 1e-12);
  // no fill
  ({ m5, E } = oneDay([[95, 99, 91, 95]]));
  assert.equal(G.walk(m5, E, 100, 90), null);
  // orders end at 21:00 UTC: a candle opening at 21:00 neither fills nor is the exit
  const late = [[MON + 20 * 3600 + 3300, 95, 96, 94, 95], [MON + 21 * 3600, 95, 120, 94, 119]];
  assert.equal(G.walk(late, { time: MON, a: 0, b: 1 }, 100, 90), null);
  const exitAt = [[MON + 3600, 96, 101, 95, 100], [MON + 20 * 3600 + 3300, 100, 102, 99, 101], [MON + 21 * 3600, 101, 130, 50, 120]];
  const x = G.walk(exitAt, { time: MON, a: 0, b: 2 }, 100, 90);
  assert.equal(x.why, 'time'); assert.ok(Math.abs(x.R - 0.1) < 1e-12);
  // every filled trade has its stop on the losing side
  for (const y of [tr, t2, g, b, s, x]) assert.ok(y.side > 0 ? y.stop < y.fill : y.stop > y.fill);
});

test('no look-ahead: the signal uses the inside day and the day before; the trade ignores candles after its exit', () => {
  const D = days([[110, 90], [105, 95], [104, 96], [150, 50], [200, 10]]);
  const D2 = days([[110, 90], [105, 95], [104, 96], [300, 1], [400, 1]]);
  assert.deepEqual(G.signals(D, 'T1').slice(0, 1), G.signals(D2, 'T1').slice(0, 1));
  const A = days([...Array.from({ length: 15 }, () => [110, 100, 105]), [106, 104, 105], [109, 101], [500, 1]]);
  const A2 = days([...Array.from({ length: 15 }, () => [110, 100, 105]), [106, 104, 105], [109, 101], [5, 4]]);
  assert.equal(G.tight(A, 15), G.tight(A2, 15));
  // changing a candle after the stop does not change the trade
  const a = oneDay([[96, 101, 95, 100], [100, 100, 89, 90], [90, 95, 85, 94]]), b = oneDay([[96, 101, 95, 100], [100, 100, 89, 90], [90, 500, 1, 2]]);
  assert.deepEqual(G.walk(a.m5, a.E, 100, 90), G.walk(b.m5, b.E, 100, 90));
});

test('costs: $0.60 a round trip in R, financing on buys only', () => {
  const tr = { side: 1, fill: 2000, r0: 20, R: 0, t: MON, c: MON + 2 * DAY + 21 * 3600 };
  const c = G.costs(tr);
  assert.ok(Math.abs(c.spread - 0.03) < 1e-12);
  assert.ok(c.nights >= 2 && c.fin > 0);
  assert.equal(G.costs({ ...tr, side: -1 }).fin, 0);
  assert.ok(Math.abs(G.costs(tr, 2).spread - 0.06) < 1e-12);
  assert.equal(G.costs({ ...tr, c: MON + 21 * 3600 }).nights, 0);   // a same-day 21:00 exit crosses no rollover
});

test('statistics helpers', () => {
  assert.deepEqual(G.holm([0.01, 0.04, 0.03]), [true, false, false]);
  const r = G.mulberry32(7), r2 = G.mulberry32(7);
  assert.equal(r(), r2());
  assert.equal(G.maxDD([{ c: 1, net: 1 }, { c: 2, net: -3 }, { c: 3, net: 1 }]), -3);
});

test('RESULT.md agrees with result.json, and the pre-registration is the one committed', async () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(res.verdict, 'FAIL'); assert.equal(res.passed, 0);
  assert.equal(md, G.report(res));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.includes('FAIL, 0 of 3') && line.length < 220, line);
  const crypto = await import('node:crypto');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'))).digest('hex'), res.prereg);
  const f = (v, d = 3) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  for (const [k, v] of Object.entries(res.tests)) {
    assert.equal(v.pass, false);
    for (const [w, tag] of [['inSample', 'IS 2008-16'], ['outOfSample', 'OOS 2017-now']]) {
      const x = v.windows[w];
      const row = `| ${k} | ${tag} | ${x.signals} | ${x.unfilled} | ${x.n} | ${f(x.gross)} | ${f(x.net)} | ${f(x.net2)} | ${(x.win * 100).toFixed(1)} | ${f(x.totalNet, 2)} | ${f(x.maxDD, 2)} | ${f(x.t, 2)} |`;
      assert.ok(md.includes(row), `row missing: ${row}`);
    }
    assert.ok(md.includes(`| ${k} | ${f(v.placebo.real)} | ${v.placebo.beaten} of 40 |`), `placebo ${k}`);
    assert.equal(v.checks.placebo, v.placebo.beaten >= 38);
  }
});
