// fvg-cost5-holdout: the FVG return's low-cost cut on eight unread markets (offline: reads the committed files)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stat, keep, passOf, KEEP, MARKETS, monthOf, NM, FROM, HALF } from '../research/edge/fvg-cost5-holdout/run.mjs';
import { MARKETS as GRID } from '../research/edge/grid7-fvg-wide/run.mjs';

const D = 'research/edge/fvg-cost5-holdout/', J = JSON.parse(fs.readFileSync(D + 'result.json', 'utf8')), MD = fs.readFileSync(D + 'RESULT.md', 'utf8'), PRE = fs.readFileSync(D + 'PREREGISTRATION.md', 'utf8');

test('the markets are ones the FVG grid never read, and the pre-registration names the bar', () => {
  assert.equal(KEEP, 0.05); assert.equal(MARKETS.length, 8); for (const m of MARKETS) assert.ok(!GRID.includes(m), m);
  for (const w of ['at most **5 %**', 'median H1 gap of **2019**', 'at least 300 kept trades', 'twice the cost', '2020-22 AND in 2023-26']) assert.ok(PRE.includes(w), w);
});
test('stat, keep and the pass bar on hand-made rows', () => {
  assert.equal(monthOf(FROM), 0); assert.equal(monthOf(HALF), 36); assert.equal(NM, 82);
  const R = [[0, 0, 0.04, 1], [1, 0, 0.2, -1], [40, 1, 0.05, -1]];
  assert.equal(keep(R, 0.05).length, 2); const s = stat(keep(R, 0.05)); assert.equal(s.n, 2); assert.equal(s.gross, 0); assert.equal(s.net, -0.045);
  assert.equal(stat(keep(R, 0.05), 1, 0).net, 0.96); assert.equal(stat(keep(R, 0.05), 2, 1).net, -1.1);
  const ok = { n: 300, net: 0.1, tNet: 2 }; assert.equal(passOf(ok, ok, ok, ok), true); assert.equal(passOf(ok, ok, { net: -0.01 }, ok), false); assert.equal(passOf({ ...ok, tNet: 1.99 }, ok, ok, ok), false);
});
test('the result: FAIL, and the report says what the file says', () => {
  assert.match(J.verdict, /^FAIL\./); const k = J.kept; assert.equal(passOf(k.all, k.h2020, k.h2023, k.x2), false);
  assert.ok(k.all.tNet < 2 && k.h2023.net < 0 && k.x2.net < 0); assert.ok(MD.includes(J.verdict)); assert.ok(MD.includes(String(k.all.n)));
});
