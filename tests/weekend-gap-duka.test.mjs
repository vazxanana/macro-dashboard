// research/edge/weekend-gap-duka: the frozen copy of #880's run.mjs, the pre-registered mid / side-fill helpers on a small
// hand-made fixture, the probe's stop rule, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { midM1, toM5, spreadAt, simSide, netR, holmAdj, probe, PAIRS, SETS, pct } from '../research/edge/weekend-gap-duka/run.mjs';
import { headlineOf, classify } from '../research/edge/verdict.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'weekend-gap-duka');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

test('frozen.mjs is #880\'s run.mjs byte for byte and loads', async () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, '3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273');
  const F = await import('../research/edge/weekend-gap-duka/frozen.mjs');
  for (const k of ['weeks', 'ruleG', 'book', 'stats', 'normP', 'mulberry', 'pipOf']) assert.equal(typeof F[k], 'function', k);
});

test('the three headline pair sets, eighteen pairs, no repeat', () => {
  assert.equal(PAIRS.length, 18); assert.equal(new Set(PAIRS).size, 18);
  assert.deepEqual(SETS.M, ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'EURJPY']);
});

// fixture: ten minutes from Sunday 10 Mar 2024 21:00 UTC; bid / ask hand-made; minute 21:03 has no ask
const T0 = Date.UTC(2024, 2, 10, 21) / 1000;
const BID = [1.0900, 1.0902, 1.0898, 1.0901, 1.0905, 1.0903, 1.0907, 1.0910, 1.0908, 1.0912].map((c, i) => ({ time: T0 + 60 * i, open: c - 0.0001, high: c + 0.0002, low: c - 0.0003, close: c }));
const ASK = BID.filter((_, i) => i !== 3).map((b, j) => ({ time: b.time, open: b.open + 0.0004, high: b.high + 0.0004, low: b.low + 0.0004, close: b.close + (b.time === T0 ? 0.0020 : 0.0004) }));

test('mid minutes average both sides and drop a one-sided minute; M5 by UTC bucket', () => {
  const mid = midM1(BID, ASK);
  assert.equal(mid.length, 9);
  assert.ok(!mid.some((b) => b.time === T0 + 180));
  assert.ok(Math.abs(mid[1].close - (1.0902 + 1.0906) / 2) < 1e-12);
  const m5 = toM5(mid);
  assert.deepEqual(m5.map((b) => b.time), [T0, T0 + 300]);
  assert.equal(m5[0].open, mid[0].open); assert.equal(m5[0].close, mid[3].close);           // 21:04 is the bucket's last
  assert.ok(Math.abs(m5[1].high - Math.max(...mid.slice(4).map((b) => b.high))) < 1e-12);
});

test('spread at a moment: close of the last minute present at or before it, in pips', () => {
  assert.ok(Math.abs(spreadAt(BID, ASK, T0 + 60, 'EURUSD') - 20) < 1e-9);                    // the 21:00 minute closes at 21:01
  assert.equal(spreadAt(BID, ASK, T0 + 59, 'EURUSD'), null);                                // nothing closed yet
  assert.ok(Math.abs(spreadAt(BID, ASK, T0 + 240, 'EURUSD') - 4) < 1e-9);                    // 21:03 has no ask: 21:02 used
  assert.equal(pct([3, 1, 2, 4], 0.5), 3);
});

test('side fills: stop first, a gapped open at the open, target, time exit on the exit side', () => {
  const bar = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c });
  // buy, entry on the ask 1.1000, r0 0.0020: stop 1.0980, target 1.1020 (levels from mid, fixed)
  const both = simSide(1, 1.1000, 0.002, 1.1020, 1.0980, [bar(300, 1.1, 1.1025, 1.0975, 1.1)], 10000);
  assert.equal(both.exit, 'stop'); assert.ok(Math.abs(both.R + 1) < 1e-9);
  const gap = simSide(1, 1.1000, 0.002, 1.1020, 1.0980, [bar(300, 1.0970, 1.0990, 1.0960, 1.0985)], 10000);
  assert.equal(gap.exit, 'stop (gap)'); assert.ok(Math.abs(gap.R + 1.5) < 1e-9);
  const tgt = simSide(-1, 1.1000, 0.002, 1.0980, 1.1020, [bar(300, 1.0995, 1.1005, 1.0978, 1.0990)], 10000);
  assert.equal(tgt.exit, 'target'); assert.ok(Math.abs(tgt.R - 1) < 1e-9);
  const tm = simSide(1, 1.1000, 0.002, 1.1020, 1.0980, [bar(300, 1.1, 1.101, 1.099, 1.1005), bar(600, 1.1005, 1.101, 1.099, 1.1008)], 899);
  assert.equal(tm.exit, 'time'); assert.equal(tm.exitT, 600); assert.ok(Math.abs(tm.R - 0.25) < 1e-9);   // the 600 candle ends at 900, after the cut
  // net R: 1 pip a side + 22.5 per million a side, no spread charge; stress +0.5 pip a side
  assert.ok(Math.abs(netR('EURUSD', 1, 1.1, 0.002) - (1 - (0.0002 + 45e-6 * 1.1) / 0.002)) < 1e-12);
  assert.ok(Math.abs(netR('USDJPY', 1, 150, 0.2, 0.5) - (1 - (0.03 + 45e-6 * 150) / 0.2)) < 1e-12);
});

test('Holm over three sets', () => {
  const a = holmAdj([0.01, 0.03, 0.02]);
  assert.deepEqual(a.map((x) => +x.toFixed(4)), [0.03, 0.04, 0.04]);
  assert.deepEqual(holmAdj([0.5, 0.9, 0.6]), [1, 1, 1]);
});

test('the probe stops the study when no file can be fetched', async () => {
  const refused = async () => { const e = new Error('fetch failed'); e.cause = { code: 'refused' }; throw e; };
  const p = await probe(refused);
  assert.equal(p.reachable, false); assert.ok(p.rows.every((r) => r.status === null && /refused/.test(r.error)));
  const ok = await probe(async () => ({ status: 200, arrayBuffer: async () => new ArrayBuffer(8) }));
  assert.equal(ok.reachable, true);
});

test('RESULT.md and result.json say the same thing, and the Edge lab reads it as inconclusive', () => {
  const r = JSON.parse(read('result.json')), md = read('RESULT.md');
  assert.equal(r.verdict, 'NOT MEASURABLE (inconclusive: Dukascopy is not reachable from this runner)');
  assert.equal(r.coverage.reachable, false); assert.ok(r.coverage.probe.length >= 6 && r.coverage.probe.every((x) => !x.ok));
  for (const k of ['measurementA', 'testB', 'feedCheck', 'placebo']) assert.equal(r[k], null, k);
  assert.match(md, /^\*\*Verdict: NOT MEASURABLE \(inconclusive: Dukascopy is not reachable from this runner\)\.\*\*/m);
  assert.equal(classify(headlineOf(md)), 'inc');
  assert.match(md, /3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273/);
  const pre = read('PREREGISTRATION.md');
  assert.match(pre, /NOT MEASURABLE \(inconclusive: Dukascopy is not reachable from this runner\)/);
  // no candle cache kept in git
  assert.deepEqual(fs.readdirSync(DIR).sort(), ['PREREGISTRATION.md', 'RESULT.md', 'frozen.mjs', 'result.json', 'run.mjs']);
});
