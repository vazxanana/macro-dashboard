// node --test tests/ict-cmeshut.test.mjs: CME weekend / full-holiday hours are dropped from the ICT desk's CNBC candles (owner, 7 Nov)
import test from 'node:test';
import assert from 'node:assert/strict';
import { cmeShut } from '../ict/tracker.mjs';
const T = (s) => Date.parse(s) / 1000;
test('weekend: Friday 17:00 to Sunday 18:00 New York is shut, either side is open', () => {
  assert.equal(cmeShut(T('2026-11-06T21:59:00Z')), false);   // Fri 16:59 EST
  assert.equal(cmeShut(T('2026-11-06T22:10:00Z')), true);    // Fri 17:10 EST
  assert.equal(cmeShut(T('2026-11-07T12:05:00Z')), true);    // Saturday: the flat CNBC candles seen on 7 Nov
  assert.equal(cmeShut(T('2026-10-17T15:00:00Z')), true);    // Saturday in EDT
  assert.equal(cmeShut(T('2026-11-08T22:59:00Z')), true);    // Sun 17:59 EST
  assert.equal(cmeShut(T('2026-11-08T23:00:00Z')), false);   // Sun 18:00 EST reopen
  assert.equal(cmeShut(T('2026-11-09T14:30:00Z')), false);   // Monday cash open
});
test('full holidays are shut until the 18:00 reopen; early-close days are not touched', () => {
  assert.equal(cmeShut(T('2026-04-03T14:00:00Z')), true);    // Good Friday 2026
  assert.equal(cmeShut(T('2027-01-01T15:00:00Z')), true);    // New Year 2027 (Friday)
  assert.equal(cmeShut(T('2025-12-25T15:00:00Z')), true);    // Christmas 2025 (Thursday)
  assert.equal(cmeShut(T('2025-12-25T23:30:00Z')), false);   // Thu 18:30 EST, reopened
  assert.equal(cmeShut(T('2026-11-26T15:00:00Z')), false);   // Thanksgiving (early close), not dropped here
});
