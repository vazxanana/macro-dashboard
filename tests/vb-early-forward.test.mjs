// vb-early-forward: the gold and USD/JPY T1 forward trades split by fill hour (research/edge/vb-early-forward). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as V from '../research/edge/vb-early-forward/run.mjs';

const DIR = new URL('../research/edge/vb-early-forward/', import.meta.url);
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');

// a hand-made discovery set: 36 months, early trades +0.3R on average, late trades 0R
function baseOf() {
  const rows = [];
  for (let m = 0; m < 36; m++) {
    const day = `${2020 + Math.floor(m / 12)}-${String(1 + (m % 12)).padStart(2, '0')}-10`;
    for (let i = 0; i < 6; i++) rows.push([day, 60 + i * 30, i % 2 ? 1.3 : -0.7, 'xau']);
    for (let i = 0; i < 10; i++) rows.push([day, 480 + i * 30, i % 2 ? 1 : -1, 'usdjpy']);
  }
  return { rows, D: V.measuredD(rows) };
}
const mkTr = (n, fillMin, net, mk = 'xau', side = 'buy') => Array.from({ length: n }, (_, i) =>
  ({ mk, side, how: 'time', day: `2027-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 25)).padStart(2, '0')}`, fillMin, R: net, net: net + (i % 2 ? 0.01 : -0.01) }));

test('vb early: the constants are the pre-registration\'s', () => {
  assert.equal(V.START, '2026-11-24'); assert.equal(V.CUT_MIN, 360); assert.equal(V.MIN_SIDE, 40);
  assert.deepEqual(V.CHECKS, [120, 240]); assert.equal(V.DRAWS, 20000); assert.equal(V.SEED, 20261120);
  assert.match(pre, /2026-11-24/); assert.match(pre, /fewer than \*\*40\*\*/); assert.match(pre, /seed 20261120/);
  assert.deepEqual([V.GATES.xau.n, V.GATES.xau.netR, V.GATES.usdjpy.n, V.GATES.usdjpy.netR], [1121, 0.105, 2079, 0.063]);
});

test('vb early: a fill candle before 06:00 UTC is early, from 06:00 late', () => {
  assert.equal(V.isEarly({ fillMin: 0 }), true); assert.equal(V.isEarly({ fillMin: 355 }), true);
  assert.equal(V.isEarly({ fillMin: 360 }), false); assert.equal(V.isEarly({ fillMin: 1200 }), false);
  const R = V.build([...mkTr(3, 100, 1), ...mkTr(2, 400, -1)], baseOf(), 'x', null);
  assert.equal(R.early.n, 3); assert.equal(R.late.n, 2);
  assert.equal(R.markets.xau.early.n, 3); assert.equal(R.markets.usdjpy.early.n, 0);
  assert.equal(R.earlyByHour['00-03'].n, 3); assert.equal(R.earlyByHour['03-06'].n, 0);
  assert.ok(Math.abs(R.D - 2) < 0.02, `D ${R.D}`);
});

test('vb early: nothing before the start date counts', () => {
  const old = mkTr(5, 100, 5).map((x) => ({ ...x, day: '2026-11-23' })), R = V.build([...old, ...mkTr(2, 100, 1), ...mkTr(2, 500, 0)], baseOf(), 'x', null);
  assert.equal(R.early.n + R.late.n, 4);
  // the trade builders take only days from the start (hand-made USD/JPY days, the forward study's shape)
  const mk = (t0, day) => ({ day, d0: t0, prevRange: 1, bars: Array.from({ length: 240 }, (_, i) => ({ t: t0 + i * 300, o: 150 + i * 0.01, h: 150 + i * 0.01 + 0.02, l: 150 + i * 0.01 - 0.005, c: 150 + i * 0.01 + 0.01 })) });
  const d0 = Date.parse('2026-11-23T00:00:00Z') / 1000, tr = V.usdjpyForward([mk(d0, '2026-11-23'), mk(d0 + 86400, '2026-11-24')]);
  assert.ok(tr.length <= 1 && tr.every((x) => x.day >= V.START && Number.isFinite(x.fillMin)));
});

test('vb early: readings and checkpoints follow the pre-registration; the first crossing stands', () => {
  const base = baseOf();
  assert.equal(V.build([...mkTr(39, 100, 1), ...mkTr(200, 500, 0)], base, 'x', null).reading, 'too few', 'either side under 40');
  // early far worse than late: below A's 5th, and at 120 a side the split fails
  const f = V.build([...mkTr(130, 100, -1), ...mkTr(130, 500, 1)], base, 'x', null);
  assert.equal(f.reading, 'below the measured range'); assert.equal(f.crossed[120].reading, 'fails'); assert.match(f.verdict, /^FAIL/);
  const later = V.build([...mkTr(130, 100, 2), ...mkTr(130, 500, 0)], base, 'y', f);
  assert.equal(later.crossed[120].reading, 'fails', 'the first crossing stands'); assert.equal(later.crossed[120].at, 'x');
  // early clearly ahead at 240 a side, t >= 2, early mean > 0: confirmed
  const c = V.build([...mkTr(250, 100, 1.5), ...mkTr(250, 500, 0)], base, 'z', null);
  assert.equal(c.reading, 'ahead of no difference'); assert.equal(c.crossed[120].reading, 'holds so far'); assert.equal(c.crossed[240].reading, 'confirmed'); assert.match(c.verdict, /^PASS/);
  // ahead of no difference but the early side loses: not shown either way
  const n = V.build([...mkTr(250, 100, -0.1), ...mkTr(250, 500, -1.5)], base, 'z', null);
  assert.equal(n.crossed[240].reading, 'not shown either way');
  assert.equal(V.checkAt(240, 0.5, { p5: -1 }, { p95: 0.2 }, 1.9, 0.3), 'not shown either way', 't under 2');
  assert.equal(V.checkAt(120, -2, { p5: -1 }, { p95: 0.2 }, 0, 0), 'fails');
});

test('vb early: world B has no difference, world A the measured one', () => {
  const base = baseOf(), m = V.monthsOf(base.rows);
  assert.ok(Math.abs(base.D - 0.3) < 1e-9);
  const A = V.bands(m, 60, 60, { draws: 2000 }), B = V.bands(m, 60, 60, { draws: 2000, shift: base.D });
  assert.ok(Math.abs(A.p50 - 0.3) < 0.1, `A middle ${A.p50}`); assert.ok(Math.abs(B.p50) < 0.1, `B middle ${B.p50}`);
  assert.ok(A.p5 <= A.p50 && A.p50 <= A.p95);
});

test('vb early: the workflow runs it on the candles it already fetched', () => {
  const wf = fs.readFileSync(new URL('../.github/workflows/vb-forward.yml', import.meta.url), 'utf8');
  assert.ok(wf.includes('node research/edge/vb-early-forward/run.mjs run "$RUNNER_TEMP/c" "$RUNNER_TEMP/u" data/research/forward/vb-early.json'));
  assert.ok(wf.indexOf('vb-early-forward/run.mjs') > wf.indexOf('usdjpy-vol-breakout-forward/run.mjs run'), 'after both records');
  if (fs.existsSync(new URL('baseline.json', DIR))) {
    const b = JSON.parse(fs.readFileSync(new URL('baseline.json', DIR), 'utf8'));
    assert.equal(b.gates.xau.n, 1121); assert.equal(b.gates.usdjpy.n, 2079); assert.equal(b.rows.length, 1121 + 2079);
    assert.ok(b.rows.every(([d]) => d < V.START), 'no baseline day reaches the forward window');
  }
});

test('a fail at the 120-trade checkpoint is never replaced by the 240 reading (review 23 Nov 2026)', async () => {
  const { verdictOf } = await import('../research/edge/vb-early-forward/run.mjs');
  assert.equal(verdictOf({ 120: { reading: 'fails' }, 240: { reading: 'confirmed' } }), 'FAIL');
  assert.equal(verdictOf({ 120: { reading: 'holds so far' }, 240: { reading: 'confirmed' } }), 'PASS');
  assert.equal(verdictOf({ 120: { reading: 'holds so far' } }), 'INCONCLUSIVE');
  assert.equal(verdictOf({ 120: { reading: 'holds so far' }, 240: { reading: 'not shown either way' } }), 'INCONCLUSIVE');
  assert.equal(verdictOf({}), 'INCONCLUSIVE');
});
