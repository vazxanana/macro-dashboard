import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { curve, best, SHARES, label } from '../research/edge/bigfade-target-sweep/run.mjs';

test('bigfade-target-sweep: the target is chosen on discovery after costs and judged on the other window', () => {
  const rows = []; for (let m = 0; m < 30; m++) for (let k = 0; k < 4; k++) rows.push({ m, w: 0, cr: 0.2, R: SHARES.map((s) => (s === 0.8 ? 0.5 : 0.1) + (k % 2) * 0.01) });
  const c = curve(rows, 0), b = best(c);
  assert.equal(b.share, 0.8); assert.equal(c.pts[0].diffT, null); assert.ok(c.pts.find((p) => p.share === 0.8).diff > 0.39);
  assert.equal(SHARES.length, 15); assert.equal(label(99), 'none (stop or 1 day)'); assert.equal(label(0.65), '65 %');
});

test('bigfade-target-sweep: the report is the result file; no target pays the costs out of sample', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../research/edge/bigfade-target-sweep/result.json', import.meta.url), 'utf8')), md = fs.readFileSync(new URL('../research/edge/bigfade-target-sweep/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(j.verdict)); assert.match(j.verdict, /^FAIL\./); assert.ok(j.gate.ok);
  const d = j.pooled.d.pts, c = j.pooled.c.pts;
  assert.equal(d.reduce((q, p) => (p.net > q.net ? p : q)).share, j.pick, 'the choice is the best of discovery after costs');
  assert.ok(c.every((p) => p.net < 0), 'every target loses after costs in 2015-26');
  assert.equal(c.length, 15);
});
