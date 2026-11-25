import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tagsOf, holm, welch } from '../research/edge/fade-liquidity/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fade-liquidity/result.json', import.meta.url)));
test('fade-liquidity: tags use closed candles and the zone that holds the fill', () => {
  const T15 = Array.from({ length: 120 }, (_, i) => ({ t: i * 900, e: i * 900 + 900, h: 10, l: 9, o: 9.5, c: 9.6 }));
  const g = { j: 110, ts: T15[110].e, d: 1, ext: 11 };
  const ctx = { T15, D1: [{ t: 0, e: 86400, h: 10.5, l: 9 }], zones: [{ at: 0, end: Infinity, d: -1, bot: 10.8, top: 11.5 }], maxLife: 1e9 };
  const x = tagsOf(g, 11.1, -1, ctx);
  assert.equal(x.dom, true); assert.equal(x.domSide, 1); assert.equal(x.hi24, true);
  assert.equal(tagsOf(g, 12, -1, ctx).dom, false);
});
test('fade-liquidity: holm and welch', () => {
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.ok(welch({ n: 100, sum: 10, sq: 20 }, { n: 100, sum: 0, sq: 20 }) > 0);
});
test('fade-liquidity: the committed result says FAIL, gate and cut test passed', () => {
  assert.equal(R.gate.ok, true); assert.ok(R.cutRes.every((c) => c.mismatches === 0));
  assert.equal(R.tests.length, 8); assert.ok(R.tests.every((x) => x.pass === false)); assert.match(R.verdict, /^FAIL\./);
});
