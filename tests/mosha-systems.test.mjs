// node --test tests/mosha-systems.test.mjs: the council's Mosha systems on the Mosha desk (owner, 20 Nov 2026: "why mosha desk
// doesnt have the trades like ict and executions"; assets/mosha-systems.js). Which trades it lists, the paper and demo executions,
// the 20-trade rule, who sees the card, and that it is display only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const S = require('../assets/mosha-systems.js');
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const PAGE = rd('../market-structure.html'), JS = rd('../assets/mosha-systems.js');

const T = [
  { id: 'xau-moshabo-1', k: 'mosha-bo', market: 'xau', label: 'XAU/USD', dec: 1, side: 'sell', entry: 3770.8, stop: 3768.4, t1: 2516.8, r0: 125.2, opened: 100, filled: 200, status: 'open', R: null, shadow: true, blockedBy: ['owner-shadow'], mfe: 2.1 },
  { id: 'xau-moshabo-1-add', addOf: 'xau-moshabo-1', k: 'mosha-bo', market: 'xau', dec: 1, side: 'sell', entry: 3580.7, stop: 3768.4, t1: 2516.8, opened: 300, filled: 300, status: 'open', R: null, shadow: true },
  { id: 'xau-mcycle-pull-9', k: 'mcycle', market: 'xau', dec: 2, side: 'buy', entry: 3882.05, stop: 3838.95, t1: 3965.5, opened: 50, filled: 60, closed: 90, status: 'loss', R: -1, Rnet: -1.02, shadow: true },
  { id: 'xau-mcycle-main-9', k: 'mcycle', market: 'xau', side: 'buy', entry: 3900, stop: 3890, t1: 3950, opened: 40, status: 'missed', R: 0, shadow: true },
  { id: 'xau-geg-1', k: 'geg', market: 'xau', side: 'buy', entry: 1, stop: 0.5, t1: 2, opened: 10, status: 'win', R: 2 },
  { id: 'xau-mcycle-r', k: 'mcycle', replay: true, side: 'buy', entry: 1, stop: 0.5, opened: 5, status: 'win', R: 3 },
];
const FILES = [
  { books: ['shadow', 'lit'], data: { state: { map: { 'xau-mcycle-pull-9': { fillPrice: 3882.03, slipR: 0, lots: 0.01, status: 'closed at broker', openedAt: '2026-11-16T14:58:30.000Z', closedAt: '2026-11-17T13:41:04.000Z', viaLimit: true, stop: 3838.95 } }, skipped: { 'xau-mcycle-main-9': 'price has run 1.00R from the council entry' } } } },
  { books: ['ict'], data: { state: { map: { 'xau-moshabo-1': { fillPrice: 1, status: 'open' } } } } },
];

test('only the two Mosha systems\' forward trades are listed, newest first', () => {
  const B = S.build(T, FILES);
  assert.deepEqual(B.rows.map((r) => r.id), ['xau-moshabo-1-add', 'xau-moshabo-1', 'xau-mcycle-pull-9', 'xau-mcycle-main-9']);
  assert.equal(B.rows[0].add, true); assert.equal(B.rows[1].system, 'Mosha BO');
});
test('each trade carries its paper execution and its demo copy; the ICT account is never read', () => {
  const B = S.build(T, FILES), by = Object.fromEntries(B.rows.map((r) => [r.id, r]));
  assert.equal(by['xau-mcycle-pull-9'].demo.fill, 3882.03); assert.equal(by['xau-mcycle-pull-9'].demo.label, 'shadow + lit account');
  assert.equal(by['xau-mcycle-pull-9'].R, -1); assert.equal(by['xau-mcycle-pull-9'].Rnet, -1.02);
  assert.equal(by['xau-moshabo-1'].demo, null, 'a copy on the ICT account is not shown');
  assert.equal(by['xau-mcycle-main-9'].demo.none, true); assert.match(by['xau-mcycle-main-9'].demo.why, /1\.00R/);
  assert.equal(by['xau-moshabo-1'].R, null, 'an open trade has no result');
});
test('the record counts closed trades only and never a missed order', () => {
  const B = S.build(T, FILES);
  assert.equal(B.per.mcycle.gross.n, 1); assert.equal(B.per.mcycle.gross.total, -1); assert.equal(B.per.mcycle.net.total, -1.02);
  assert.equal(B.per['mosha-bo'].gross.n, 0); assert.equal(B.per['mosha-bo'].open, 2); assert.equal(B.per.mcycle.copied, 1);
  assert.equal(S.MIN_JUDGE, 20);
});
test('who sees it: never the teacher, never a guest', () => {
  assert.equal(S.visible({ role: 'owner', mosha: 'teach' }), true); assert.equal(S.visible({ role: 'reviewer', mosha: 'read' }), true);
  assert.equal(S.visible({ role: 'viewer', mosha: 'teach' }), false); assert.equal(S.visible({ role: 'public' }), false);
  assert.match(PAGE, /html\[data-mosha="teach"\]:not\(\[data-role="owner"\]\) #v-mosha #mo-sys \{ display: none; \}/);
});
test('page wiring, honest wording, display only', () => {
  assert.match(PAGE, /<div class="card mo-wide" id="mo-sys">/);
  assert.ok(PAGE.indexOf('/assets/mosha-desk.js') < PAGE.indexOf('/assets/mosha-systems.js'));
  assert.match(JS, /Too few to judge/); assert.match(JS, /not a tested edge/); assert.match(JS, /failed after costs/);
  assert.doesNotMatch(JS, /method:\s*'POST'|localStorage|\.stop\s*=[^=]/, 'reads only');
  assert.doesNotMatch(JS, /fetch\(/, 'council-data goes through msData');
});
