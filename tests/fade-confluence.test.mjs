// fade-confluence: the result file against its RESULT.md, and the confluence rule on hand-made signals (no look-ahead).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { countAt, stricterStop, confluence, W } from '../research/edge/fade-confluence/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fade-confluence/result.json', import.meta.url), 'utf8'));
const md = fs.readFileSync(new URL('../research/edge/fade-confluence/RESULT.md', import.meta.url), 'utf8');

test('fade-confluence: verdict and figures', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.passed, 0); assert.ok(md.startsWith('# Fade confluence'));
  const [t2, t3] = R.tests;
  assert.equal(t2.confirmation.n, 118326); assert.equal(t3.confirmation.n, 23332); assert.equal(t2.discovery.n, 109256);
  assert.equal(t2.confirmation.tMonth, -49.82); assert.equal(t3.confirmation.tMonth, -30.67);
  for (const t of R.tests) { assert.equal(t.pass, false); assert.ok(t.confirmation.after < t.control[1].p50); assert.ok(t.discovery.after < 0); }
  assert.ok(md.includes('−0.272R') && md.includes('−0.342R') && md.includes('n 118,326'));
  const big = R.alone.find((a) => a.rule === 'bigfade'); assert.equal(big.own.c.n, 54443);   // parity with big-candle-fade
  const rnd = R.alone.find((a) => a.rule === 'roundfade'); assert.equal(rnd.own.c.n, 88734); // parity with round-number-breaks
  assert.ok(R.cut.length === 40 && R.cut.every((c) => c.missing === 0 && c.extra === 0));
});

const mk = (rule, t, s, entry, stop) => ({ rule, t, s, entry, stop, fi: t });
test('fade-confluence: count, stricter stop, one position, no look-ahead', () => {
  const ms = [mk('fade', 0, 1, 100, 98), mk('fade', 300, 1, 100, 97), mk('bigfade', 600, 1, 100, 99), mk('fvg', 600, -1, 100, 101),
    mk('roundfade', 600 + W + 1, 1, 100, 99.5), mk('boxfade', 4000, 1, 100, 99.9)];
  assert.equal(countAt(ms, 2).length, 2);                       // fade (latest, t 300) + bigfade; the sell is not counted
  assert.equal(countAt(ms, 4).length, 1);                       // the others are more than W before
  assert.equal(stricterStop(1, 100, [97, 99, 100.5], 0.5), 99);  // nearest losing-side stop with risk >= cost
  assert.equal(stricterStop(1, 100, [99.9], 0.5), null);
  const exitOf = (e) => ({ endT: e.t + 1000, R: 1, cr: 0.1 });
  const all = confluence(ms, 2, 0.05, exitOf);
  assert.deepEqual(all.map((e) => [e.t, e.stop, e.k]), [[600, 99, 2], [4000, 99.9, 2]]);   // 4000: boxfade + roundfade (t 2401, within W); the nearer stop 99.9
  // a later member never changes an earlier decision
  for (let n = 1; n <= ms.length; n++) { const part = confluence(ms.slice(0, n), 2, 0.05, exitOf);
    assert.deepEqual(part, all.filter((e) => e.t <= ms[n - 1].t)); }
  // a second agreeing signal while the position is open is skipped
  const two = confluence([...ms, mk('fade', 700, 1, 100, 98)], 2, 0.05, exitOf); assert.deepEqual(two.map((e) => e.t), [600, 4000]);
});
