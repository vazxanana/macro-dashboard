import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shortR, SHARES } from '../research/edge/bigfade-target-short/run.mjs';

test('bigfade-target-short: a target the fill has already passed closes at the fill, 0R', () => {
  // bullish candle 95..101 faded (sell): 10 % target = 100.4, fill 100 is already past it; 50 % = 98 is ahead
  const g = { ext: 101, mid: 98 }, r = { s: -1, fill: 100, R: SHARES.map(() => 0.7) }, q = shortR(r, g);
  assert.equal(q.past[SHARES.indexOf(0.1)], true); assert.equal(q.R[SHARES.indexOf(0.1)], 0);
  assert.equal(q.past[0], false); assert.equal(q.R[0], 0.7);
  assert.deepEqual(SHARES, [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.1]);
});

test('bigfade-target-short: the report is the result file; 50 % is the best of the eight and nearer is worse', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../research/edge/bigfade-target-short/result.json', import.meta.url), 'utf8')), md = fs.readFileSync(new URL('../research/edge/bigfade-target-short/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(j.verdict)); assert.match(j.verdict, /^FAIL\./); assert.ok(j.gate.ok); assert.equal(j.pick, 0.5);
  for (const w of ['d', 'c']) { const p = j.pooled[w].pts; for (let k = 1; k < p.length; k++) assert.ok(p[k].net < p[k - 1].net, `${w}: each nearer target loses more`); }
});
