// node --test tests/decay-alert.test.mjs: one phone message when the set of decaying live systems changes (8 Nov)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decayDigest, decayKey } from '../council/alerts.mjs';
const now = Date.parse('2026-11-08T00:05:00Z') / 1000;
const sys = (id, name, status, live = true, why = ['CUSUM 8.5/5.6']) => ({ id, name, status, live, why });
const D = (...s) => ({ systems: s });
test('first run with a decaying live system alerts once; the same set again is silent', () => {
  const d = D(sys('mosha-bo', 'Mosha BO', 'decaying'), sys('replica', 'Gold replica', 'healthy'), sys('trend', 'Crypto trend', 'decaying', false));
  const a = decayDigest(d, undefined, now);
  assert.match(a.ev.title, /^Edge decay: Mosha BO$/); assert.match(a.ev.msg, /Mosha BO: CUSUM 8.5\/5.6/); assert.doesNotMatch(a.ev.msg, /Crypto trend/);   // shadow systems never alert
  assert.equal(a.mark.key, 'mosha-bo'); assert.deepEqual(a.mark.items, ['Mosha BO']);
  assert.equal(decayDigest(d, a.mark, now + 3600), null);
});
test('all healthy on the first run says nothing; a recovery after an alert says cleared; a new system is named', () => {
  assert.equal(decayDigest(D(sys('replica', 'Gold replica', 'healthy')), undefined, now), null);
  const prev = { key: 'mosha-bo', at: '2026-11-07T22:00:00Z', items: ['Mosha BO'] };
  const c = decayDigest(D(sys('mosha-bo', 'Mosha BO', 'healthy')), prev, now);
  assert.equal(c.ev.title, 'Edge decay cleared'); assert.match(c.ev.msg, /Mosha BO/); assert.equal(c.mark.key, '');
  const n = decayDigest(D(sys('mosha-bo', 'Mosha BO', 'decaying'), sys('ict-a', 'ICT A-setups', 'decaying'), sys('nq-open', 'NQ open run', 'watch')), prev, now);
  assert.equal(n.ev.title, 'Edge decay: ICT A-setups'); assert.match(n.ev.msg, /On watch: NQ open run/);
  assert.equal(decayKey(D(sys('b', 'B', 'decaying'), sys('a', 'A', 'decaying'))), 'a|b');
});
test('the Trader sends it after building the decay block and marks coach.json decaySent', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /decayDigest\(cj\.decay, cj\.decaySent, now\)/); assert.match(src, /cj\.decaySent = dg\.mark/);
});
test('the daily Coach rewrite keeps decaySent, so a recovery after an alert still says cleared (live miss, 8 Nov 00:03)', async () => {
  const { coachCarry } = await import('../council/proposals.mjs');
  const prev = { key: 'mosha-bo', at: '2026-11-07T22:20:53Z', items: ['Mosha BO'] };
  const kept = coachCarry({ decaySent: prev, notes: ['x'] }).decaySent;
  assert.deepEqual(kept, prev);
  assert.equal(decayDigest(D(sys('mosha-bo', 'Mosha BO', 'healthy')), kept, now).ev.title, 'Edge decay cleared');
  assert.equal(decayDigest(D(sys('mosha-bo', 'Mosha BO', 'healthy')), undefined, now), null, 'without the mark the recovery is silent');
});
