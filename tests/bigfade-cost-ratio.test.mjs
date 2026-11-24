// bigfade-cost-ratio: the pre-registered split of the Big-candle fade by cost against risk (offline: reads the committed files)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stat, keep, passOf, KEEP } from '../research/edge/bigfade-cost-ratio/run.mjs';

const D = 'research/edge/bigfade-cost-ratio/', J = JSON.parse(fs.readFileSync(D + 'result.json', 'utf8')), MD = fs.readFileSync(D + 'RESULT.md', 'utf8'), PRE = fs.readFileSync(D + 'PREREGISTRATION.md', 'utf8');

test('the pre-registration names one threshold and the pass bar', () => {
  assert.equal(KEEP, 0.10); assert.match(PRE, /at most \*\*10 %\*\* of its risk/); assert.match(PRE, /at least 300 kept trades/); assert.match(PRE, /twice the cost/);
});
test('keep, stat and the pass bar on hand-made rows', () => {
  const rows = [{ m: 0, w: 0, cr: 0.05, R: [1, 2] }, { m: 1, w: 0, cr: 0.2, R: [-1, -1] }, { m: 130, w: 1, cr: 0.1, R: [0.5, 0.5] }];
  assert.equal(keep(rows, 0.1).length, 2);
  const s = stat(keep(rows, 0.1), 0); assert.equal(s.n, 1); assert.equal(s.gross, 1); assert.equal(s.net, 0.95);
  assert.equal(stat(keep(rows, 0.1), 1, 0, 2).net, 0.3);
  const ok = { n: 300, net: 0.1, tNet: 2 }; assert.equal(passOf(ok, ok, ok), true); assert.equal(passOf({ ...ok, n: 299 }, ok, ok), false); assert.equal(passOf(ok, { ...ok, tNet: 1.9 }, ok), false); assert.equal(passOf(ok, ok, { net: -0.01 }), false);
});
test('the result: gate reproduced, FAIL, and the report says what the file says', () => {
  assert.equal(J.gate.ok, true); assert.match(J.verdict, /^FAIL\./);
  assert.equal(passOf(J.kept.d, J.kept.c, J.kept.c2x), false);
  assert.ok(J.kept.c.net < 0 && J.kept.d.net < 0);
  assert.ok(MD.includes(J.verdict)); assert.ok(MD.includes(String(J.kept.c.n)));
  assert.ok(J.kept.c.gross < J.dropped.c.gross, 'the before-cost R sits in the dropped (tight-stop) trades');
});
