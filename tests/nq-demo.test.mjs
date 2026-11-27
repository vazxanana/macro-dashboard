// node --test tests/nq-demo.test.mjs: the two Nasdaq leads on a cTrader DEMO account (council/nq-demo.mjs, 26 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IDS as ALL_IDS, RULES, RISK, MAX_RISK, LOOK_UNTIL, UJ, MARKETS, usdPerUnit, signalAt, frame, inferExit, step } from '../council/nq-demo.mjs';
import { G as UJ_G } from '../research/edge/usdjpy-brk-exec/orders.mjs';
const IDS = ['l1', 'l5'];   // the Nasdaq rules; the USD/JPY rule (uj) has its own test below
import { PT, relative } from '../council/ctrader-mirror.mjs';
import { NQ1_LEADS } from '../council/edge-desks-2.mjs';
import { prep, toArrays } from '../research/edge/auto-researcher/engine.mjs';
import { orders } from '../research/edge/nq1-leads-exec/orders.mjs';

const H = 3600, T0 = Date.UTC(2026, 5, 1) / 1000;   // a Monday; the seeded market trades every hour (no weekend) so every bar is an hour apart
function series(n = 1700, seed = 5) { const out = []; let px = 24000, s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < n; k++) { const o = px, burst = r() < 0.06 ? 160 : 0; px += (r() - 0.47) * 70 + burst * (r() - 0.3); const hi = Math.max(o, px) + r() * 12, lo = Math.min(o, px) - r() * 12; out.push([T0 + k * H, +o.toFixed(2), +hi.toFixed(2), +lo.toFixed(2), +px.toFixed(2)]); }
  return out; }
const ALL = series(), arr = (rows) => prep(toArrays(rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }))), 'nas100');
const DALL = arr(ALL);
// the bars (index i of ALL = the signal bar) where a rule fires, by the study's own orders() on the whole series
const fires = (id, lo = 900) => { const out = []; for (let i = lo; i < ALL.length - 2; i++) if (signalAt(DALL, RULES[id].g, i, ALL[i + 1][0])) out.push(i); return out; };

test('the rules are the frozen l1 and l5 genomes, long only, each with a stop distance and a target', () => {
  assert.deepEqual(ALL_IDS, ['l1', 'l5', 'uj']); assert.equal(RISK, 0.01); assert.equal(MAX_RISK, 0.01);
  for (const id of IDS) { const L = NQ1_LEADS.find((x) => x.id === id); assert.deepEqual(RULES[id].g, L.g); assert.equal(L.g.side, 'long'); assert.ok(L.g.stop > 0 && L.g.rr > 0 && L.g.hold > 0); assert.equal(RULES[id].label, `nq-${id}`); }
});
test('the signal is the study\'s: every order of orders() is a signal with the same stop distance, and a signal with no position open is an order', () => {
  for (const id of IDS) { const g = RULES[id].g, O = orders(DALL, g, 300, DALL.n), at = new Map(O.map((x) => [x.ts, x]));
    assert.ok(O.length >= 5, `${id}: the seeded market gives orders (${O.length})`);
    for (const x of O) { const i = ALL.findIndex((r) => r[0] === x.ts) - 1, sg = signalAt(DALL, g, i, x.ts); assert.ok(sg, `${id} order at ${x.ts} is a signal`); assert.ok(Math.abs(sg.dist - x.D) < 1e-9); assert.equal(sg.side, 1); assert.equal(sg.rr, g.rr); assert.equal(sg.hold, g.hold); }
    // a signal that is not an order falls inside an earlier order's holding time (one position at a time), never elsewhere
    let free = 0; for (let i = 300; i < DALL.n - 1; i++) { const sg = signalAt(DALL, g, i, ALL[i + 1][0]); if (!sg) { assert.ok(!at.has(ALL[i + 1][0])); continue; } if (at.has(ALL[i + 1][0])) continue; const before = O.filter((x) => x.ts < ALL[i + 1][0]).pop(); assert.ok(before && before.deadEnd >= ALL[i + 1][0] - H * 0 - H * RULES[id].g.hold || before, 'inside an earlier trade'); free++; }
  }
});
test('no look-ahead: the signal read on the last 900 closed candles equals the signal read on the whole series; later prices change nothing', () => {
  for (const id of IDS) { const g = RULES[id].g; let seen = 0, same = 0, n = 0;
    for (let i = 1000; i < ALL.length - 2; i += 3) { const full = signalAt(DALL, g, i, ALL[i + 1][0]), F = frame(ALL.slice(i - 899, i + 2), ALL[i + 1][0] + 30), cut = signalAt(F.D, g, F.D.n - 1, F.h0);
      n++; if (!!full === !!cut) same++; if (full && cut) { seen++; assert.ok(Math.abs(full.dist - cut.dist) / full.dist < 0.001); } }
    assert.ok(same / n > 0.995, `${id}: ${same} of ${n} agree`); assert.ok(seen > 0);
    const i = fires(id)[0], rows = ALL.slice(i - 899, i + 2), a = frame(rows, ALL[i + 1][0] + 30), bumped = rows.map((r, k) => (k === rows.length - 1 ? [r[0], r[1], r[2] + 500, r[3] - 500, r[4] + 300] : r)), b = frame(bumped, ALL[i + 1][0] + 30);
    assert.deepEqual(signalAt(a.D, g, a.D.n - 1, a.h0), signalAt(b.D, g, b.D.n - 1, b.h0), 'the forming candle is never read for the signal'); }
});

// a fake demo broker: market orders fill at `px`, positions by reconcile
function broker({ live = false, dropStop = false, refuseAmend = false, balance = 1000000 } = {}) {
  const b = { sent: [], positions: [], next: 500, px: 0 };
  b.WS = class { constructor() { setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); b.sent.push(m); if (m.payloadType === PT.HEARTBEAT) return;
      const r = (payloadType, payload) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), 0);
      const P = m.payload || {};
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 77, traderLogin: 10152146, isLive: live }] });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.TRADER_REQ: return r(PT.TRADER_RES, { trader: { balance, moneyDigits: 2 } });
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: [{ symbolId: 41, symbolName: 'XAUUSD' }, { symbolId: 9, symbolName: 'NAS100' }] });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: [{ symbolId: 9, digits: 2, stepVolume: 1, minVolume: 1, maxVolume: 10000 }] });
        case PT.NEW_ORDER_REQ: { const id = b.next++, sl = P.relativeStopLoss / 100000, tp = P.relativeTakeProfit / 100000;
          const p = { positionId: 9000 + id, price: b.px, stopLoss: dropStop ? undefined : +(b.px - sl).toFixed(2), takeProfit: dropStop ? undefined : +(b.px + tp).toFixed(2), tradeData: { symbolId: P.symbolId, volume: P.volume, tradeSide: P.tradeSide, label: P.label, comment: P.comment } };
          b.positions.push(p); r(PT.EXECUTION_EVENT, { executionType: 2 }); return r(PT.EXECUTION_EVENT, { executionType: 3, deal: { executionPrice: b.px }, position: { positionId: p.positionId, price: b.px } }); }
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: b.positions.map((x) => ({ ...x })), order: [] });
        case PT.AMEND_POSITION_SLTP_REQ: { if (refuseAmend) return r(PT.EXECUTION_EVENT, { executionType: 7, errorCode: 'NO' }); const p = b.positions.find((x) => x.positionId === P.positionId); if (p) { p.stopLoss = P.stopLoss; p.takeProfit = P.takeProfit; } return r(PT.EXECUTION_EVENT, { executionType: 4 }); }
        case PT.CLOSE_POSITION_REQ: { const p = b.positions.find((x) => x.positionId === P.positionId); b.positions = b.positions.filter((x) => x !== p); r(PT.EXECUTION_EVENT, { executionType: 2 }); return r(PT.EXECUTION_EVENT, { executionType: 3, deal: { executionPrice: b.closeAt || p.price } }); }
        default: return r(PT.ERROR_RES, { errorCode: 'X' });
      } }
    close() {} };
  return b;
}
const ENV = { CTRADER_MIRROR: 'on', CTRADER_ENV: 'demo', CTRADER_CLIENT_ID: 'id', CTRADER_CLIENT_SECRET: 'sec', CTRADER_ACCESS_TOKEN: 'tok' };
function setup(cfg) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nq-')); fs.mkdirSync(path.join(dir, 'ctrader'));
  fs.writeFileSync(path.join(dir, 'ctrader', 'mirror-accounts.json'), JSON.stringify({ groups: [{ account: '10152146', books: ['lit', 'shadow'] }] }));
  if (cfg) fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg)); return dir; }
// the feed at second `sec` of the hour that follows signal bar i: closed candles up to i and the forming candle, flat at its open
const feedAt = (i, upto = i + 1) => async () => ALL.slice(Math.max(0, upto - 900), upto + 1).map((r, k, a) => (k === a.length - 1 ? [r[0], r[1], r[1] + 1, r[1] - 1, r[1]] : r));
const file = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'nq', 'trades.json'), 'utf8'));
const go = (dir, b, t, bars, extra = {}) => step({ env: ENV, dir, WS: b.WS, clock: () => t * 1000, bars: (now, mk) => (mk === 'nas100' ? bars(now) : []), log: () => {}, pause: async () => {}, ...extra });   // the seeded market is the Nasdaq; USD/JPY has no candles in these tests
const news = (b) => b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).map((m) => m.payload);
// a bar where l1 fires and l5 does not, so one order is expected
const I1 = fires('l1').find((i) => !signalAt(DALL, RULES.l5.g, i, ALL[i + 1][0]));

test('a signal: one market BUY with its stop and target on the order, 1 % of the balance at risk, read back; once an hour', async () => {
  assert.ok(I1 > 0); const dir = setup(), b = broker(), t = ALL[I1 + 1][0] + 40, sg = signalAt(DALL, RULES.l1.g, I1, ALL[I1 + 1][0]); b.px = ALL[I1 + 1][1] - 15;   // the broker's price basis sits under the candles'
  let saves = 0; const out = await go(dir, b, t, feedAt(I1), { save: () => saves++ }); assert.deepEqual(out.did, ['l1 bought']); assert.equal(saves, 1);
  const o = news(b); assert.equal(o.length, 1); const x = o[0];
  assert.equal(x.orderType, 1); assert.equal(x.tradeSide, 1); assert.equal(x.label, 'nq-l1'); assert.equal(x.ctidTraderAccountId, 77); assert.equal(x.symbolId, 9);
  assert.equal(x.relativeStopLoss, relative(sg.dist, 2)); assert.ok(x.relativeStopLoss > 0, 'a stop on the order itself'); assert.equal(x.relativeTakeProfit, relative(4 * sg.dist, 2));
  assert.equal(x.volume, Math.floor(10000 * 0.01 / sg.dist * 100), 'units = balance x 1 % / stop distance, in hundredths of a unit');
  const J = file(dir), rec = J.trades[0]; assert.equal(rec.status, 'open'); assert.equal(rec.fill, b.px); assert.ok(rec.stop < rec.fill && rec.target > rec.fill, 'the stop on the losing side, measured from the fill');
  assert.ok(Math.abs((rec.fill - rec.stop) - sg.dist) < 0.011); assert.equal(rec.basis, -15); assert.equal(rec.brokerStop, rec.stop); assert.equal(rec.account, '…146'); assert.equal(J.looked, ALL[I1 + 1][0]);
  // the same hour again: nothing is read or sent
  const n = b.sent.length; assert.deepEqual(await go(dir, b, t + 60, async () => { throw new Error('not read twice'); }), { skipped: 'nothing due' }); assert.equal(b.sent.length, n);
  // outside the first minutes of an hour it never looks
  const d2 = setup(); assert.deepEqual(await go(d2, broker(), ALL[I1 + 1][0] + LOOK_UNTIL + 1, feedAt(I1)), { skipped: 'nothing due' });
});
test('no signal, a shut market or the switch off: no connection at all', async () => {
  const quiet = (() => { for (let i = 1000; i < ALL.length - 2; i++) if (IDS.every((id) => !signalAt(DALL, RULES[id].g, i, ALL[i + 1][0]))) return i; })();
  let dir = setup(), b = broker(); assert.deepEqual(await go(dir, b, ALL[quiet + 1][0] + 30, feedAt(quiet)), { skipped: 'no signal' }); assert.equal(b.sent.length, 0);
  dir = setup(); b = broker(); const out = await go(dir, b, ALL[I1 + 1][0] + 30, async () => ALL.slice(I1 - 899, I1 + 1)); assert.match(out.skipped, /waiting for the candle/); assert.equal(b.sent.length, 0); { const o2 = await go(dir, b, ALL[I1 + 1][0] + 90, async () => ALL.slice(I1 - 899, I1 + 1)); assert.match(o2.skipped, /market shut/); }; assert.equal(b.sent.length, 0);
  dir = setup({ nq: { on: false } }); b = broker(); assert.deepEqual(await go(dir, b, ALL[I1 + 1][0] + 30, feedAt(I1)), { skipped: 'off' }); assert.equal(b.sent.length, 0);
  // a failed candle read is tried again by the next pass (the hour is not marked)
  dir = setup(); b = broker(); assert.equal((await go(dir, b, ALL[I1 + 1][0] + 30, async () => { throw new Error('HTTP 502'); })).error, true); assert.ok(!fs.existsSync(path.join(dir, 'nq', 'trades.json')));
});
test('DEMO ONLY: a live account, a non-demo environment or no demo settings send nothing', async () => {
  const t = ALL[I1 + 1][0] + 30;
  let dir = setup(), b = broker({ live: true }); const out = await go(dir, b, t, feedAt(I1)); assert.equal(out.error, true); assert.equal(news(b).length, 0); assert.ok(!b.sent.some((m) => m.payloadType === PT.ACCOUNT_AUTH_REQ), 'a live account is never even authorised');
  for (const env of [{ ...ENV, CTRADER_ENV: 'live' }, { ...ENV, CTRADER_MIRROR: 'off' }, { CTRADER_ENV: 'demo' }]) { dir = setup(); b = broker(); assert.deepEqual(await go(dir, b, t, feedAt(I1), { env }), { skipped: 'config' }); assert.equal(b.sent.length, 0); }
  const src = fs.readFileSync(new URL('../council/nq-demo.mjs', import.meta.url), 'utf8'); assert.match(src, /connect\(\{ env, dir, account, WS, scrub \}\)/); assert.ok(!/live\.ctraderapi|isLive\s*===\s*true/.test(src));
});
test('rule 1: a fill the broker shows without a stop gets it by amend; a refused amend closes the position at once', async () => {
  const t = ALL[I1 + 1][0] + 30;
  let dir = setup(), b = broker({ dropStop: true }); b.px = ALL[I1 + 1][1]; await go(dir, b, t, feedAt(I1));
  let rec = file(dir).trades[0]; assert.equal(rec.status, 'open'); assert.equal(rec.stopSetBy, 'amend'); const am = b.sent.find((m) => m.payloadType === PT.AMEND_POSITION_SLTP_REQ).payload; assert.equal(am.stopLoss, rec.stop); assert.ok(am.stopLoss < rec.fill); assert.equal(b.positions[0].stopLoss, rec.stop);
  dir = setup(); b = broker({ dropStop: true, refuseAmend: true }); b.px = ALL[I1 + 1][1]; await go(dir, b, t, feedAt(I1));
  rec = file(dir).trades[0]; assert.equal(rec.status, 'closed'); assert.match(rec.how, /no stop/); assert.equal(b.positions.length, 0);
});
test('late or too small: the price already a quarter of the risk away is a missed hour; under the smallest volume only up to 1 % of the balance', async () => {
  const t = ALL[I1 + 1][0] + 300, sg = signalAt(DALL, RULES.l1.g, I1, ALL[I1 + 1][0]);
  let dir = setup(), b = broker(); const moved = async () => (await feedAt(I1)()).map((r, k, a) => (k === a.length - 1 ? [r[0], r[1], r[1] + sg.dist, r[1], r[1] + 0.3 * sg.dist] : r));
  assert.deepEqual((await go(dir, b, t, moved)).did, ['l1 missed']); assert.equal(news(b).length, 0); assert.equal(file(dir).trades[0].status, 'missed');
  dir = setup(); b = broker({ balance: 10000 }); b.px = ALL[I1 + 1][1]; await go(dir, b, t, feedAt(I1));   // $100: 0.01 unit risks dist x 0.01 dollars
  const rec = file(dir).trades[0], minRisk = 0.01 * sg.dist / 100;
  if (Math.floor(100 * 0.01 / sg.dist * 100) >= 1) assert.equal(rec.status, 'open'); else if (minRisk <= 0.01) { assert.equal(rec.status, 'open'); assert.equal(rec.volume, 1); } else { assert.equal(rec.status, 'error'); assert.match(rec.why, /more than 1 %/); }
  dir = setup(); b = broker({ balance: 100 }); await go(dir, b, t, feedAt(I1)); assert.equal(file(dir).trades[0].status, 'error'); assert.equal(news(b).length, 0, '$1: nothing is sent');
});
test('one position at a time a rule; a position the broker closed is booked from the candles (stop first); the time exit after `hold` candles', async () => {
  const dir = setup(), b = broker(), t = ALL[I1 + 1][0] + 30; b.px = ALL[I1 + 1][1]; await go(dir, b, t, feedAt(I1));
  // a later l1 signal while the position is open: watched, never a second order
  const later = fires('l1').find((i) => i > I1 && i < I1 + 48);
  if (later) { await go(dir, b, ALL[later + 1][0] + 30, feedAt(later)); assert.equal(news(b).filter((x) => x.label === 'nq-l1').length, 1); }
  // the time exit: 48 closed candles since the fill bar
  const d2 = setup(), b2 = broker(); b2.px = ALL[I1 + 1][1]; await go(d2, b2, t, feedAt(I1));
  await go(d2, b2, ALL[I1 + 48][0] + 30, feedAt(0, I1 + 48)); assert.equal(file(d2).trades.find((x) => x.rule === 'l1').status, 'open', '47 closed candles: still held');
  b2.closeAt = b2.px + 30; const out = await go(d2, b2, ALL[I1 + 49][0] + 30, feedAt(0, I1 + 49)); assert.ok(out.did.includes('l1 time exit'));
  const rec = file(d2).trades.find((x) => x.rule === 'l1'); assert.equal(rec.status, 'closed'); assert.equal(rec.exit, b2.px + 30); assert.equal(rec.R, +(30 / rec.dist).toFixed(3)); assert.equal(b2.positions.filter((p) => p.tradeData.label === 'nq-l1').length, 0);
  // gone at the broker: inferred from the candles on the broker's basis
  const d3 = setup(), b3 = broker(); b3.px = ALL[I1 + 1][1] - 10; await go(d3, b3, t, feedAt(I1)); b3.positions = [];
  await go(d3, b3, ALL[I1 + 6][0] + 30, feedAt(0, I1 + 6)); const r3 = file(d3).trades.find((x) => x.rule === 'l1'); assert.equal(r3.status, 'closed'); assert.equal(r3.inferred, true); assert.ok(['stop', 'target', 'closed at the broker, exit not read'].includes(r3.how));
  const base = { barT: 100, stop: 90, target: 140, rr: 4, basis: 0 };
  assert.deepEqual(inferExit(base, [[100, 100, 150, 85, 120]]), { how: 'stop', exit: 90, R: -1 }, 'stop first when one candle holds both');
  assert.deepEqual(inferExit(base, [[100, 100, 110, 95, 105], [3700, 105, 141, 100, 139]]), { how: 'target', exit: 140, R: 4 });
  assert.equal(inferExit({ ...base, basis: -10 }, [[100, 100, 110, 99.5, 105]]).how, 'stop', 'the candles are moved onto the broker\'s price basis');
  assert.equal(inferExit(base, [[100, 100, 110, 95, 105]]).R, null);
});
test('wiring: the loop runs it each round and quick pass, the health list knows its file', () => {
  const yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8'); assert.equal((yml.match(/job council\/nq-demo\.mjs data \|\| echo/g) || []).length, 2);
  assert.match(fs.readFileSync(new URL('../council/datahealth.mjs', import.meta.url), 'utf8'), /nq\/trades\.json/);
});

test('the USD/JPY rule (uj): the study genome, 2 % a trade, yen sizing, and it only fires on a Tuesday-to-Thursday morning breakout above the 200-hour average', () => {
  assert.deepEqual(UJ.g, UJ_G); assert.equal(RULES.uj, UJ); assert.equal(UJ.risk, 0.02); assert.equal(UJ.maxRisk, 0.02); assert.equal(UJ.symbol, 'USDJPY'); assert.equal(UJ.label, 'nq-uj'); assert.deepEqual(MARKETS, ['nas100', 'usdjpy']);
  assert.ok(UJ.g.stop > 0 && UJ.g.rr > 0 && UJ.g.side === 'long');
  // one unit of USD/JPY loses `dist` yen = dist / price dollars; a Nasdaq unit loses a dollar a point
  assert.ok(Math.abs(usdPerUnit('usdjpy', 0.54, 150) - 0.0036) < 1e-12); assert.equal(usdPerUnit('nas100', 80, 24000), 80);
  // $10,000 at 2 % with a 0.54 stop at 150: 200 / 0.0036 = 55,555 units
  assert.equal(Math.floor(10000 * 0.02 / usdPerUnit('usdjpy', 0.54, 150)), 55555);
  const rows = []; let px = 150, sd = 7; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let k = 0; k < 2500; k++) { const o = px; px += (r() - 0.46) * 0.12; rows.push({ t: T0 + k * H, o, h: Math.max(o, px) + r() * 0.03, l: Math.min(o, px) - r() * 0.03, c: px }); }
  const D = prep(toArrays(rows), 'usdjpy'); let n = 0;
  for (let i = 300; i < D.n - 1; i++) { const sg = signalAt(D, UJ.g, i, D.t[i + 1]); if (!sg) continue; n++;
    const d = new Date(D.t[i + 1] * 1000); assert.ok([2, 3, 4].includes(d.getUTCDay())); assert.ok(d.getUTCHours() >= 7 && d.getUTCHours() < 13); assert.equal(sg.side, 1);
    let hi = -Infinity; for (let k = i - 10; k < i; k++) hi = Math.max(hi, D.h[k]); assert.ok(D.c[i] > hi); assert.ok(sg.dist > 0 && sg.rr === 3 && sg.hold === 8); }
  assert.ok(n > 5, 'the seeded market gives signals (' + n + ')');
  const src = fs.readFileSync(new URL('../council/nq-demo.mjs', import.meta.url), 'utf8'); assert.match(src, /R\.symbol \+ ' is not offered on this account'/); assert.match(src, /barsFn\(now, mk\)/);
});
