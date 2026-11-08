// node --test tests/ctrader-account.test.mjs — the owner's demo accounts snapshot for the profile view (read only, demo only)
import test from 'node:test';
import assert from 'node:assert/strict';
import { accountSnapshot, accountSnapshots, labelOf } from '../council/ctrader-account.mjs';
const ENV = { CTRADER_MIRROR: 'on', CTRADER_CLIENT_ID: ' cid ', CTRADER_CLIENT_SECRET: 'sec', CTRADER_ACCESS_TOKEN: 'AT', CTRADER_ACCOUNT_ID: '49478137', CTRADER_ENV: 'demo' };
const lib = (live, extra = []) => ({
  readAccounts: async () => [{ id: '49478137', login: '10152028', live, broker: 'Fusion Markets' }, ...extra],
  readAccount: async (env, WS, tok, acc) => { assert.equal(env.CTRADER_CLIENT_ID, 'cid'); assert.equal(tok, 'AT');
    return { account: { ...acc, currency: 'USD' }, balance: acc.id === '49478137' ? 997.73 : 10000, floating: 0, equity: 997.73, open: [], orders: [], history: [{ net: -2.27 }], days: 30, at: 'x' }; },
});
test('publishes the demo account with masked numbers', async () => {
  const s = await accountSnapshot({ env: ENV, lib: lib(false) });
  assert.equal(s.balance, 997.73); assert.equal(s.source, 'council'); assert.equal(s.account.id, '…137'); assert.equal(s.account.login, '…028');
  assert.equal(s.label, 'Council + ICT + Shadows + LIT + Replica'); assert.equal(s.base, true);
  assert.doesNotMatch(JSON.stringify(s), /49478137|10152028/);
});
test('refuses a live account, and does nothing when the mirror is off or not demo', async () => {
  assert.match((await accountSnapshot({ env: ENV, lib: lib(true) })).error, /not a demo/);
  assert.equal(await accountSnapshot({ env: { ...ENV, CTRADER_MIRROR: 'off' }, lib: lib(false) }), null);
  assert.equal(await accountSnapshot({ env: { ...ENV, CTRADER_ENV: 'live' }, lib: lib(false) }), null);
});
test('one labelled snapshot per mirror account, the base first; unknown accounts get an error entry', async () => {
  const cfg = { mirrorAccounts: { ict: '10152144', shadow: '10152145', lit: '10152146', replica: '10152148' } };
  const extra = [{ id: '49485359', login: '10152144', live: false, broker: 'Fusion Markets' }, { id: '49485361', login: '10152145', live: false, broker: 'Fusion Markets' }, { id: '49485365', login: '10152146', live: true, broker: 'Fusion Markets' }];
  const all = await accountSnapshots({ env: ENV, cfg, lib: lib(false, extra) });
  assert.deepEqual(all.map((a) => a.label), ['Council', 'ICT', 'Shadows', 'LIT', 'Replica']);
  assert.deepEqual(all.map((a) => a.books), [['council'], ['ict'], ['shadow'], ['lit'], ['replica']]);
  assert.equal(all[0].base, true); assert.equal(all[1].base, false);
  assert.equal(all[1].balance, 10000); assert.equal(all[1].account.login, '…144');
  assert.match(all[3].error, /not a demo/);                       // the LIT number is live in this fake: refused
  assert.match(all[4].error, /not found for this token/);         // replica not on the token yet
  assert.doesNotMatch(JSON.stringify(all), /49485359|10152144|10152148/);
  assert.equal(labelOf(['council', 'shadow']), 'Council + Shadows');
  const s = await accountSnapshot({ env: ENV, cfg, lib: lib(false, extra) });
  assert.equal(s.label, 'Council');
});
