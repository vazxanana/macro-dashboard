import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trade, MULTS, GATE } from '../research/edge/bigfade-target-65/run.mjs';

test('bigfade-target-65: the target is 65 % of the candle back from its extreme, on the same fill and stop', () => {
  const M5 = []; let t = 1e9; const bar = (o, h, l, c) => { M5.push({ t, e: t + 300, o, h, l, c }); t += 300; };
  bar(100, 100.2, 99.9, 100); for (let i = 0; i < 16; i++) bar(100 - i * 0.5, 100 - i * 0.5 + 0.1, 99.4 - i * 0.5, 99.5 - i * 0.5);
  const g = { ts: 1e9, d: 1, ext: 101, mid: 98, a: 1 }, r = trade(M5, g, 0.01);   // candle 95..101: 50 % = 98, 65 % = 97.1
  assert.ok(r); assert.ok(Math.abs(r.R[0] - (100 - 98) / r.risk) < 1e-9); assert.ok(Math.abs(r.R[1] - (100 - 97.1) / r.risk) < 1e-9);
  assert.deepEqual(MULTS, [0.5, 0.65, 0.8, 1]);
});

test('bigfade-target-65: the report is the result file; better, and still a loss after costs', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../research/edge/bigfade-target-65/result.json', import.meta.url), 'utf8')), md = fs.readFileSync(new URL('../research/edge/bigfade-target-65/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(j.verdict)); assert.match(j.verdict, /^FAIL\./); assert.ok(j.gate.ok); assert.equal(j.gate.c.n, GATE.c.n);
  const c = j.pooled.c, d = j.pooled.d;
  assert.ok(c.diff.mean > 0 && d.diff.mean > 0 && c.diff.t >= 2 && d.diff.t >= 2);
  assert.ok(c.mults[1].net < 0 && d.mults[1].net < 0);
});
