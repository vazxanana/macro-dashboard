// The live account's card (27 Nov 2026): the snapshot step only reads, the file's shape, /cdata serves live/* to the owner alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { shape } from '../council/live-account.mjs';
const require = createRequire(import.meta.url);

test('live account snapshot: read-only messages only', () => {
  const src = fs.readFileSync(new URL('../council/live-account.mjs', import.meta.url), 'utf8');
  for (const bad of ['NEW_ORDER_REQ', 'AMEND_POSITION_SLTP_REQ', 'CLOSE_POSITION_REQ', 'CANCEL_ORDER_REQ', 'dayGate'])
    assert.ok(!src.includes(bad), bad + ' must not be in the snapshot step');
  for (const want of ['TRADER_REQ', 'RECONCILE_REQ', 'SYMBOLS_LIST_REQ', 'liveConnect']) assert.ok(src.includes(want), want);
});

test('live account snapshot: shape, masked login, day loss, positions without a stop counted', () => {
  const cfg = { live: { on: true, account: '*7653', risk: 0.005, dayStop: 0.15, goldRisk: 0.05 } };
  const out = shape({
    trader: { balance: 95000, moneyDigits: 2 },
    positions: [{ tradeData: { symbolId: 41, tradeSide: 1, volume: 100, label: 'lv-vb-xau', openTimestamp: Date.UTC(2026, 10, 30, 0, 5) }, price: 4100.5, stopLoss: 4080.1, takeProfit: 0, swap: -120 },
      { tradeData: { symbolId: 7, tradeSide: 2, volume: 1000 }, price: 155.2 }],
    orders: [{ tradeData: { symbolId: 41, tradeSide: 2, volume: 100, label: 'lv-vb-xau' }, stopPrice: 4060, stopLoss: 4100.5 }],
    names: [{ symbolId: 41, symbolName: 'XAUUSD' }, { symbolId: 7, symbolName: 'USDJPY' }],
    day: { day: '2026-11-30', start: 1000 }, at: '2026-11-30T10:00:00.000Z', cfg });
  assert.equal(out.account, '…653');
  assert.equal(out.balance, 950);
  assert.equal(out.day.loss, 0.05);
  assert.equal(out.dayStop, 0.15);
  assert.equal(out.positions[0].symbol, 'XAUUSD');
  assert.equal(out.positions[0].side, 'buy');
  assert.equal(out.positions[0].target, null);
  assert.equal(out.positions[0].swap, -1.2);
  assert.equal(out.noStop, 1);
  assert.equal(out.orders[0].price, 4060);
  assert.ok(!JSON.stringify(out).includes('7653'));
  // a day file of another day: no start
  const o2 = shape({ trader: { balance: 100 }, positions: [], orders: [], names: [], day: { day: '2026-11-29', start: 1000 }, at: '2026-11-30T10:00:00.000Z', cfg });
  assert.equal(o2.day.start, null);
});

test('/cdata: live/* is the owner\'s alone', async () => {
  const src = fs.readFileSync(new URL('../api/data.js', import.meta.url), 'utf8');
  assert.match(src, /\/\^live\\\/\/i\.test\(p\) && acct\.u !== 'owner'/);
  const D = require('../api/data.js');
  assert.ok(typeof D === 'function' || typeof D.default === 'function' || typeof D.handler === 'function' || D);
});

test('council.yml runs the snapshot; the Profile card reads the three files and only reads', () => {
  const y = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  assert.match(y, /node council\/live-account\.mjs data/);
  const h = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  const js = h.slice(h.indexOf('<script id="ms-lv-js">'), h.indexOf('</script>', h.indexOf('<script id="ms-lv-js">')));
  for (const f of ['live/account.json', 'live/nq.json', 'live/vb.json']) assert.ok(js.includes(f), f);
  assert.ok(!/localStorage|sessionStorage|method:\s*'POST'|fetch\(/.test(js), 'the card only reads through msData and keeps nothing');
  assert.match(h, /data-pf-go="ms-pf-live"/);
});
