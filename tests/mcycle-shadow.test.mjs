// node --test tests/mcycle-shadow.test.mjs
// 14 Nov 2026, owner on decision 54 ("Make it a paper shadow"): the Mosha cycle's NEW trades are paper shadows.
// The rule only adds mcycle to config.ownerShadow; the cycle's block already reads it (cycleBlockers, #780).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cycleBlockers } from '../council/mosha-cycle.mjs';

const TRADER = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const i = TRADER.indexOf("  { id: 'mcycle-shadow', apply:"), j = TRADER.indexOf("Owner decision 54.' },", i);
const RULE = new Function('return ' + TRADER.slice(i, j + "Owner decision 54.' }".length).trim())();

test('the rule adds mcycle to ownerShadow once, keeps every other key, and states the owner decision', () => {
  assert.ok(i > 0 && j > i);
  assert.equal(RULE.id, 'mcycle-shadow');
  assert.match(RULE.why, /decision 54/);
  const c = { ownerShadow: { replica: 1, 'mosha-bo': 2 }, moshaCycle: true, goldTrend: { n: 20 } };
  const before = JSON.parse(JSON.stringify(c));
  const t0 = Math.floor(Date.now() / 1000);
  RULE.apply(c);
  assert.ok(c.ownerShadow.mcycle >= t0 && c.ownerShadow.mcycle <= t0 + 5);
  assert.equal(c.ownerShadow.replica, 1); assert.equal(c.ownerShadow['mosha-bo'], 2);
  const { ownerShadow, ...rest } = c; const { ownerShadow: o0, ...rest0 } = before;
  assert.deepEqual(rest, rest0, 'no other setting moves: the cycle stays on, its rule unchanged');
  const keep = c.ownerShadow.mcycle; RULE.apply(c); assert.equal(c.ownerShadow.mcycle, keep, 'applying twice keeps the first start time');
});

test('once applied, a new cycle signal is a shadow (owner-shadow) and keeps its stop', () => {
  const o = { leg: 'main', side: 'sell', entry: 100, stop: 101, room: true };
  assert.deepEqual(cycleBlockers(o, [], 99.5, false), []);
  assert.deepEqual(cycleBlockers(o, [], 99.5, true), ['owner-shadow']);
  assert.ok(TRADER.includes("ownerSh('mcycle')"), 'the cycle block reads the switch');
  assert.ok(TRADER.indexOf("{ id: 'mcycle-shadow'") < TRADER.indexOf('for (const u of USER_RULES)'), 'applied by the usual once-only rule loop');
});
