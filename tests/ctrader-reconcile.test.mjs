// node --test tests/ctrader-reconcile.test.mjs — the read-only reconciliation of edge trades against the demo accounts
// (council/ctrader-reconcile.mjs). Offline: small council-data folders written to a temp directory.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reconcile } from '../council/ctrader-reconcile.mjs';

function data(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-recon-'));
  for (const [f, v] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), JSON.stringify(v)); }
  return dir;
}
const groups = [{ account: '1', books: ['council'], file: 'mirror.json' }, { account: '2', books: ['shadow'], file: 'mirror-2.json' }, { account: '3', books: ['replica'], file: 'mirror-3.json' }, { account: '4', books: ['ict'], file: 'mirror-4.json' }];
const T = (o) => ({ id: 'eurusd-intraday-1', market: 'eurusd', k: 'intraday', side: 'buy', entry: 1.1, stop: 1.098, t1: 1.105, rr: 2.5, status: 'open', opened: 100, shadow: false, ...o });
const base = (extra = {}) => ({ 'ctrader/mirror-accounts.json': { groups }, 'ctrader/mirror.json': { state: {} }, 'ctrader/mirror-2.json': { state: {} }, 'ctrader/mirror-3.json': { state: {} }, 'ctrader/mirror-4.json': { state: {} },
  'ctrader/accounts.json': { at: 'now', accounts: [{ label: 'Council', books: ['council'], open: [], orders: [], history: [] }, { label: 'Shadows', books: ['shadow'], open: [], orders: [], history: [] }, { label: 'Replica', books: ['replica'], open: [], orders: [], history: [] }, { label: 'ICT', books: ['ict'], open: [], orders: [], history: [] }] },
  'trades.json': [], 'ict/trades.json': [], 'research.json': [], 'config.json': {}, ...extra });

test('a market copy matches when the stop and target keep the council\'s distances from the fill (a feed basis is not a mismatch)', () => {
  const d = base({ 'trades.json': [T()] });
  d['ctrader/mirror.json'] = { state: { map: { 'eurusd-intraday-1': { positionId: '9', status: 'open', digits: 5, stop: 1.098, t1: 1.105, mark: 1.1, levelsFrom: 'mark', fillPrice: 1.1003 } } } };
  d['ctrader/accounts.json'].accounts[0].open = [{ id: '9', symbol: 'EURUSD', side: 'buy', entry: 1.1003, sl: 1.0983, tp: 1.1053, lots: 0.01 }];
  let r = reconcile(data(d)); assert.equal(r.rows.length, 1); assert.deepEqual(r.rows[0].issues, []); assert.equal(r.rows[0].state, 'position'); assert.equal(r.rows[0].basis, 0.0003); assert.equal(r.orphans.length, 0); assert.equal(r.noStop.length, 0);
  // the same position with the stop somewhere else, on the wrong side of the entry, or missing
  d['ctrader/accounts.json'].accounts[0].open[0].sl = 1.0950; r = reconcile(data(d)); assert.match(r.rows[0].issues.join(), /stop 1.095, expected 1.09830/);
  d['ctrader/accounts.json'].accounts[0].open[0].sl = null; r = reconcile(data(d)); assert.match(r.rows[0].issues.join(), /NO stop/); assert.equal(r.noStop.length, 1);
  d['ctrader/accounts.json'].accounts[0].open[0] = { id: '9', symbol: 'EURUSD', side: 'sell', entry: 1.1003, sl: 1.0983, tp: 1.1053 }; r = reconcile(data(d)); assert.match(r.rows[0].issues.join(), /side sell at the broker/);
});

test('after the council moved its stop, or when the stop guard set it, the council\'s own level is expected', () => {
  const d = base({ 'trades.json': [T({ stop: 1.1 })] });
  d['ctrader/mirror.json'] = { state: { map: { 'eurusd-intraday-1': { positionId: '9', status: 'open', digits: 5, stop: 1.1, t1: 1.105, mark: 1.1, levelsFrom: 'mark', fillPrice: 1.1003, amended: 1 } } } };
  d['ctrader/accounts.json'].accounts[0].open = [{ id: '9', symbol: 'EURUSD', side: 'buy', entry: 1.1003, sl: 1.1, tp: 1.105 }];
  assert.deepEqual(reconcile(data(d)).rows[0].issues, []);
  d['ctrader/mirror.json'].state.map['eurusd-intraday-1'].stop = 1.098;   // the mirror has not followed yet: said, not an error
  const r = reconcile(data(d)); assert.deepEqual(r.rows[0].issues, []); assert.match(r.rows[0].note, /moved its stop/);
});

test('missing copies: a recorded reason is listed; no reason is a mismatch; replica research trades count for the replica book', () => {
  const rep = { id: 'eth-replica-1-b', k: 'replica', market: 'eth', side: 'buy', entry: 2000, stop: 1980, t1: 2040, status: 'open', opened: 5, pass: true };
  const d = base({ 'trades.json': [T(), T({ id: 'xrp-swing-1', market: 'xrp', shadow: true }), T({ id: 'gbpusd-scalp-1', market: 'gbpusd', shadow: true })], 'research.json': [rep, { id: 'nq-1', k: 'nq-open', status: 'open' }] });
  d['ctrader/mirror-2.json'] = { state: { skipped: { 'xrp-swing-1': 'none of XRPUSD found at the broker' }, wait: { 'gbpusd-scalp-1': { why: 'GBPUSD market closed' } } } };
  const r = reconcile(data(d)), by = Object.fromEntries(r.rows.map((x) => [x.id, x]));
  assert.equal(r.rows.length, 4);
  assert.match(by['eurusd-intraday-1'].issues.join(), /no copy and no recorded reason/);
  assert.equal(by['xrp-swing-1'].why, 'skipped: none of XRPUSD found at the broker'); assert.deepEqual(by['xrp-swing-1'].issues, []);
  assert.match(by['gbpusd-scalp-1'].why, /waiting: GBPUSD market closed/);
  assert.equal(by['eth-replica-1-b'].book, 'replica'); assert.match(by['eth-replica-1-b'].issues.join(), /no copy/);
});

test('a demo position or order nobody stands behind is reported; a copy the broker closed first is explained from the deal history', () => {
  const d = base({ 'trades.json': [T()] });
  d['ctrader/mirror.json'] = { state: { map: { 'eurusd-intraday-1': { positionId: '9', status: 'closed at broker', digits: 5, stop: 1.098, t1: 1.105, mark: 1.1, levelsFrom: 'mark', fillPrice: 1.1003 } } } };
  d['ctrader/accounts.json'].accounts[0].history = [{ positionId: '9', exit: 1.0983, closedAt: '2026-11-10T03:41:00Z', net: -2 }];
  d['ctrader/accounts.json'].accounts[0].open = [{ id: '77', symbol: 'XAUUSD', side: 'buy', entry: 4000, sl: 3990, tp: null }];
  d['ctrader/accounts.json'].accounts[1].orders = [{ id: '88', symbol: 'EURUSD', side: 'buy', price: 1.09, sl: null }];
  const r = reconcile(data(d));
  assert.match(r.rows[0].note, /closed the copy at its stop/); assert.deepEqual(r.rows[0].issues, []);
  assert.deepEqual(r.orphans.map((o) => [o.account, o.kind, o.id, o.why]), [['council', 'position', '77', 'the mirror has no record of it'], ['shadow', 'order', '88', 'the mirror has no record of it']]);
});

test('the reconciliation only reads: no broker session, no write', () => {
  const src = fs.readFileSync(new URL('../council/ctrader-reconcile.mjs', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/writeFile|writeAtomic|session\(|WebSocket|fetch\(|mirrorRound/.test(src));
});
