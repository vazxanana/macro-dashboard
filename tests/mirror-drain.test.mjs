// The shadow book on the former LIT demo account, the old Shadows account drained (owner, 20 Nov 2026). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { accountsFor, stillHolds } from '../council/ctrader-mirror.mjs';

const ACC = JSON.parse(fs.readFileSync(new URL('../council/ctrader-accounts.json', import.meta.url), 'utf8'));
const MIRROR = fs.readFileSync(new URL('../council/ctrader-mirror.mjs', import.meta.url), 'utf8');

test('shadows go to the former LIT account (still the lit book and gotobi\'s); the old Shadows account was the Mosha 6R book 23-24 Nov 2026 and drains since', () => {
  assert.equal(ACC.mirrorAccounts.shadow, '10152146'); assert.equal(ACC.mirrorAccounts.lit, '10152146');
  assert.equal(ACC.mirrorAccounts.mosha6, '10152146'); assert.deepEqual(ACC.drain, []);   // 25 Nov 2026: 10152145 is the bfade book
  const { groups, byBook } = accountsFor({ CTRADER_ACCOUNT_ID: '49478137' }, { mirrorAccounts: ACC.mirrorAccounts, drain: ACC.drain });
  assert.equal(byBook.shadow, '10152146');
  const g = Object.fromEntries(groups.map((x) => [x.account, x]));
  assert.deepEqual(g['10152146'].books, ['shadow', 'lit', 'mosha6', 'ictnq', 'fvgm', 'egd1', 'litr']);   // 25 Nov 2026: mosha6 moved here from *155
  assert.equal(g['*155'], undefined, 'no account ending 155 any more');
  assert.deepEqual(g['10152145'], { account: '10152145', books: ['bfade'] }, '25 Nov 2026: the Big-candle fade book; it still manages the old copies it holds');
});

test('a drain entry never replaces an account a book still uses; no drain list = as before', () => {
  const r = accountsFor({ CTRADER_ACCOUNT_ID: 'b' }, { mirrorAccounts: { shadow: 'x' }, drain: ['x', ' ', null] });
  assert.equal(r.groups.find((g) => g.account === 'x').drain, undefined);
  assert.ok(!accountsFor({ CTRADER_ACCOUNT_ID: 'b' }, { mirrorAccounts: { shadow: 'x' } }).groups.some((g) => g.drain));
});

test('a drained account runs only while it still holds an open copy or a resting order', () => {
  assert.equal(stillHolds({ map: { a: { status: 'open' }, b: { status: 'closed at broker' } } }), true);
  assert.equal(stillHolds({ map: { a: { status: 'closed by council' } }, orders: {} }), false);
  assert.equal(stillHolds({ map: {}, orders: { t: { orderId: 1 } } }), true);
  assert.equal(stillHolds({}), false);
  assert.match(MIRROR, /acc\.groups\.filter\(\(g\) => !g\.drain \|\| stillHolds\(/);
  assert.match(MIRROR, /drain: cfg\.drain \|\| accFile\.drain/);
  // the round of a drained account passes no books, so mirrorRound opens nothing there (openBooks filter)
  assert.match(MIRROR, /\(!openBooks \|\| openBooks\.includes\(bookOf\(t\)\)\)/);
});
