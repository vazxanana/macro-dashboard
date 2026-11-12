// Shadow cut (owner, 12 Nov 2026): council/shadow-cut.mjs and its wiring in the Trader.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dropShadow, FAMILY } from '../council/shadow-cut.mjs';

const TR = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const RES = JSON.parse(fs.readFileSync(new URL('../research/edge/shadow-best/result.json', import.meta.url), 'utf8'));

test('dropShadow: only shadow signals of the family, never live ones, never a kept stream', () => {
  const cut = { setups: FAMILY, keep: [{ setup: 'intraday', market: 'xrp' }] };
  assert.equal(dropShadow(null, 'scalp', 'xau', true), false, 'no cut, nothing dropped');
  assert.equal(dropShadow(cut, 'scalp', 'xau', false), false, 'a live trade is never dropped');
  assert.equal(dropShadow(cut, 'scalp', 'xau', true), true);
  assert.equal(dropShadow(cut, 'intraday', 'xrp', true), false, 'kept stream');
  assert.equal(dropShadow(cut, 'intraday', 'btc', true), true);
  for (const k of ['swing', 'position', 'rswing', 'm30m1', 'replica', 'geg', 'gtrend']) assert.equal(dropShadow(cut, k, 'xau', true), false, k);
  assert.deepEqual(FAMILY, ['scalp', 'intraday', 'rscalp', 'rintra']);
});

test('the owner rule writes the study\'s keep list', () => {
  const m = TR.match(/\{ id: 'shadow-best', apply: \(c\) => \{ c\.shadowCut = \{ setups: CUT_FAMILY\.slice\(\), keep: (\[[^\]]*\])/);
  assert.ok(m, 'rule present');
  assert.deepEqual(JSON.parse(m[1]), RES.keep, 'keep list = research/edge/shadow-best result.json keep');
  assert.equal(RES.keep.length, 0);
});

test('the cut sits right before the record step, after the trade is built (open/pending trades untouched)', () => {
  const i = TR.indexOf('if (dropShadow(config.shadowCut, t.k, key, tr.shadow))'), j = TR.indexOf('recordOnce(trades, tr, now);');
  assert.ok(i > 0 && j > i && j - i < 600);
  // the management loop never reads the switch
  assert.deepEqual(TR.split('\n').filter((l) => /shadowCut/.test(l) && !/^\s*\/\//.test(l)).length, 2, 'the rule and the record step only');
});
