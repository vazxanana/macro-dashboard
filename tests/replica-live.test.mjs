// The owner's replica-live-again rule (20 Nov 2026): lifted out of the Trader and applied to a config shaped like council-data's.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const TRADER = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const i = TRADER.indexOf("  { id: 'replica-live-again', apply:"), j = TRADER.indexOf('\n];\nconfig.userRules', i);
const RULE = new Function('return [' + TRADER.slice(i, j) + '];')()[0];

test('replica-live-again: removes only the replica from ownerShadow, once, with the owner\'s words; the mirror rule stays', () => {
  assert.ok(i > TRADER.indexOf("{ id: 'replica-mirror-gold-only'"), 'it runs after the supported-book and mirror rules');
  const c = { ownerShadow: { replica: 1, 'mosha-bo': 1, gtl: 1, gmp: 1, 'nq-open': 1, mcycle: 2 }, mirrorReplica: { markets: ['xau'] } };
  RULE.apply(c);
  assert.deepEqual(Object.keys(c.ownerShadow), ['mosha-bo', 'gtl', 'gmp', 'nq-open', 'mcycle']);
  assert.deepEqual(c.mirrorReplica, { markets: ['xau'] });
  const d = { ownerShadow: { gtl: 1 } }; RULE.apply(d); assert.deepEqual(d, { ownerShadow: { gtl: 1 } });
  const e = {}; RULE.apply(e); assert.deepEqual(e, {});
  assert.match(RULE.why, /Owner request of 20 Nov 2026/); assert.match(RULE.why, /replica-oos/);
  assert.match(TRADER, /owner: "And mine replica shadow to live"/);
  assert.equal((TRADER.match(/\{ id: 'replica-live-again',/g) || []).length, 1); assert.equal((TRADER.match(/\{ id: 'replica-live',/g) || []).length, 1, 'the older replica-live rule (already applied on council-data) is a different rule');
});
