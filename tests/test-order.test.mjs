// council/test-order.mjs: one resting test order on a demo account. Offline: the pure pieces and the locks, as text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const T = await import('../council/test-order.mjs');
const SRC = fs.readFileSync(new URL('../council/test-order.mjs', import.meta.url), 'utf8');
const WF = fs.readFileSync(new URL('../.github/workflows/demo-test-order.yml', import.meta.url), 'utf8');

test('the order rests far under the price with its stop under the entry and its target over it', () => {
  const p = T.plan(1.05234, 5);
  assert.ok(p.entry < 1.05234 * 0.975 && p.entry > 1.05234 * 0.965); assert.ok(p.stop < p.entry && p.stop > 0); assert.ok(p.target > p.entry);
  assert.equal(String(p.entry).split('.')[1].length <= 5, true);
  assert.throws(() => T.plan(0)); assert.throws(() => T.plan(NaN));
});
test('the account: the named one, else the Equinox book of the accounts file', () => {
  const f = new URL('../council/ctrader-accounts.json', import.meta.url).pathname;
  assert.equal(T.accountOf({ TEST_ACCOUNT: '*144' }, f), '*144');
  assert.equal(T.accountOf({}, f), JSON.parse(fs.readFileSync(f, 'utf8')).mirrorAccounts.eqx);
  assert.equal(T.accountOf({}, '/nonexistent.json'), null);
});
test('the price reader takes the last close of either candle shape', async () => {
  const f = (rows) => async () => ({ ok: true, json: async () => rows });
  assert.equal(await T.lastPrice('x/', f({ bars: [{ time: 1, close: 1.1 }, { time: 2, close: 1.2 }] })), 1.2);
  assert.equal(await T.lastPrice('x/', f([[1, 1, 1, 1, 1.3, 0]])), 1.3);
  await assert.rejects(T.lastPrice('x/', async () => ({ ok: false, status: 403 })));
});
test('demo only, a stop on the order, nothing else sent, started by hand', async () => {
  assert.match(SRC, /import \{ connect \} from '\.\/gotobi\.mjs'/);                       // the demo-locked connection
  assert.match(SRC, /CTRADER_ENV[^\n]*!== 'demo'/); assert.match(SRC, /stopLoss: P\.stop, takeProfit: P\.target/);
  assert.match(SRC, /timeInForce: 1, expirationTimestamp/); assert.equal((SRC.match(/NEW_ORDER_REQ/g) || []).length, 1);
  assert.ok(!/CANCEL_ORDER_REQ|CLOSE_POSITION_REQ|AMEND_/.test(SRC)); assert.ok(!/writeFileSync/.test(SRC));
  const r = await T.run({ env: { CTRADER_ENV: 'live' }, log: () => {} }); assert.equal(r.error, 'not demo');
  assert.match(WF, /workflow_dispatch/); assert.ok(!/schedule:|push:|pull_request/.test(WF)); assert.match(WF, /contents: read/);
});
