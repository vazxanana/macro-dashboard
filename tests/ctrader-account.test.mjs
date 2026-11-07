// node --test tests/ctrader-account.test.mjs — the owner's demo account snapshot for the profile view (read only, demo only)
import test from 'node:test';
import assert from 'node:assert/strict';
import { accountSnapshot } from '../council/ctrader-account.mjs';
const ENV = { CTRADER_MIRROR: 'on', CTRADER_CLIENT_ID: ' cid ', CTRADER_CLIENT_SECRET: 'sec', CTRADER_ACCESS_TOKEN: 'AT', CTRADER_ACCOUNT_ID: '49478137', CTRADER_ENV: 'demo' };
const lib = (live) => ({
  readAccounts: async () => [{ id: '49478137', login: '10152028', live, broker: 'Fusion Markets' }],
  readAccount: async (env, WS, tok, acc) => { assert.equal(env.CTRADER_CLIENT_ID, 'cid'); assert.equal(tok, 'AT');
    return { account: { ...acc, currency: 'USD' }, balance: 997.73, floating: 0, equity: 997.73, open: [], orders: [], history: [{ net: -2.27 }], days: 30, at: 'x' }; },
});
test('publishes the demo account with masked numbers', async () => {
  const s = await accountSnapshot({ env: ENV, lib: lib(false) });
  assert.equal(s.balance, 997.73); assert.equal(s.source, 'council'); assert.equal(s.account.id, '…137'); assert.equal(s.account.login, '…028');
  assert.doesNotMatch(JSON.stringify(s), /49478137|10152028/);
});
test('refuses a live account, and does nothing when the mirror is off or not demo', async () => {
  assert.match((await accountSnapshot({ env: ENV, lib: lib(true) })).error, /not a demo/);
  assert.equal(await accountSnapshot({ env: { ...ENV, CTRADER_MIRROR: 'off' }, lib: lib(false) }), null);
  assert.equal(await accountSnapshot({ env: { ...ENV, CTRADER_ENV: 'live' }, lib: lib(false) }), null);
});
