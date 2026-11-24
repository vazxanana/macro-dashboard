import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trade, stats, MULTS, GATE } from '../research/edge/bigfade-target-125/run.mjs';

test('bigfade-target-125: the longer target sits 25 % further on the same fill and stop', () => {
  const M5 = []; let t = 1e9; const bar = (o, h, l, c) => { M5.push({ t, e: t + 300, o, h, l, c }); t += 300; };
  bar(100, 100.2, 99.9, 100); for (let i = 0; i < 12; i++) bar(100 - i * 0.5, 100 - i * 0.5 + 0.1, 99.4 - i * 0.5, 99.5 - i * 0.5);
  const g = { ts: 1e9, d: 1, ext: 101, mid: 98, a: 1 }, r = trade(M5, g, 0.01);
  assert.ok(r); assert.equal(r.s, -1); assert.ok(r.stop > r.fill);
  assert.ok(Math.abs(r.R[0] - r.hr) < 1e-9 && Math.abs(r.R[1] - 1.25 * r.hr) < 1e-9, 'both targets reached: R is the target');
  assert.equal(trade(M5, { ...g, mid: 99.9 }, 0.01), null, 'a middle under 1R away is no trade');
  assert.deepEqual(MULTS, [1, 1.25, 1.5, 2]);
});

test('bigfade-target-125: the paired difference is taken trade by trade', () => {
  const rows = []; for (let m = 0; m < 24; m++) for (let k = 0; k < 5; k++) rows.push({ m, w: 0, cr: 0.1, R: [1, 1.2 + (k % 2) * 0.02, 1, 1] });
  const s = stats(rows, 0); assert.equal(s.n, 120); assert.ok(Math.abs(s.diff.mean - 0.208) < 0.002); assert.equal(s.mults[0].net, 0.9);
});

test('bigfade-target-125: the report is the result file; better, and still a loss after costs', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../research/edge/bigfade-target-125/result.json', import.meta.url), 'utf8')), md = fs.readFileSync(new URL('../research/edge/bigfade-target-125/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(j.verdict)); assert.match(j.verdict, /^FAIL\./);
  assert.ok(j.gate.ok); assert.equal(j.gate.c.n, GATE.c.n); assert.equal(j.gate.d.n, GATE.d.n);
  const c = j.pooled.c, d = j.pooled.d;
  assert.ok(c.diff.mean > 0 && d.diff.mean > 0 && c.diff.t >= 2 && d.diff.t >= 2);
  assert.ok(c.mults[1].net < 0 && d.mults[1].net < 0, 'after costs the rule still loses with the longer target');
});
