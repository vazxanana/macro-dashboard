// research/edge/gold-release-quotes: the N4 trade on executable quotes, the stop, dedupe and Part A (offline, made-up quotes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trade, dedupe, partA, partB, holm } from '../research/edge/gold-release-quotes/run.mjs';
const eventMarks = (t) => { const o = []; for (let s = -600; s <= 3900; s += 60) o.push(t + s); return [...o, t + 5, t + 15, t + 30].sort((a, b) => a - b); };

// an event whose mid follows f(s), spread 0.2
function ev(t, f, type = 'CPI') { const marks = eventMarks(t).map((m) => m - t); return { t, type, at: '', marks, quotes: marks.map((s) => [f(s) - 0.1, f(s) + 0.1]), widest: Array.from({ length: 75 }, () => 0.5) }; }

test('continuation pays the spread at both ends; reversal is stopped', () => {
  const up = ev(0, (s) => (s <= -60 ? 100 : s <= 300 ? 100 + s / 100 : 103 + (s - 300) / 1000));
  const c = trade(up, 'continuation'); // move 3.6 (100 -> 103.6? mid(300)=103) dist 3, entry ask 103.1, exit bid at 3600
  assert.equal(c.stopped, false); assert.ok(Math.abs(c.R - ((106.3 - 0.1) - 103.1) / 3) < 1e-9); assert.ok(c.Rmid > c.R);
  const r = trade(up, 'reversal'); assert.equal(r.stopped, true); assert.ok(r.R <= -1);
  assert.equal(trade(ev(0, () => 100), 'continuation').skip, 'no move');
});

test('dedupe keeps the earlier of two close events; Part A and Part B shapes', () => {
  const a = ev(0, () => 100), b = ev(1800, () => 100, 'NFP'), c = ev(86400, () => 100, 'FOMC');
  assert.deepEqual(dedupe([b, a, c]).map((e) => e.t), [0, 86400]);
  const A = partA([a, c], Array.from({ length: 24 }, () => ({ frac: 1e-4 })));
  assert.equal(A.ALL.n, 2); assert.ok(Math.abs(A.ALL.marks[5].median - 0.002) < 1e-9); assert.ok(Math.abs(A.ALL.minuteTWidest.median - 0.005) < 1e-9);
  const B = partB([a, c]); assert.equal(B.continuation.verdict, 'TOO FEW');
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
});
