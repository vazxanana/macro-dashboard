// node --test tests/fills-live.test.mjs: manageLive (council/fills.mjs) is the Trader's "Manage open trades" loop for one candle.
// The parity test lifts that loop out of council/trader.mjs as text and runs it on random gappy gold candles (a weekend and the
// 17:00 New York rollover inside) against manageLive, with the fields the gold systems carry: resting limit orders, a trailing
// stop from +2R, a per-trade break-even, a time exit, a pyramid add, size. Any later change to the Trader's loop that manageLive
// does not follow fails here (gold fidelity, 8 Nov 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { manageLive, addUnit, expireOrder, sizeR, spotSkip, stopFill, exitR, fillBarAmbiguous } from '../council/fills.mjs';

const ts = (s) => Date.parse(s) / 1000;
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '30m': 6 * 3600, '15m': 3 * 3600 };

// ─── the Trader's loop, lifted from council/trader.mjs between its section markers ───
const SRC = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const M1 = '// ─── Manage open trades on this market with the candles since the last check ───', M2 = '// ─── Review closed trades';
const i1 = SRC.indexOf(M1), i2 = SRC.indexOf(M2);
assert.ok(i1 > 0 && i2 > i1, 'trader.mjs: the "Manage open trades" section markers moved');
const liveLoop = new Function('trades', 'key', 'src', 'M', 'config', 'now', 'spotSkip', 'stopFill', 'exitR', 'fillBarAmbiguous', 'startReview', 'NEWS', 'WAIT', 'FEED', SRC.slice(i1, i2));
// run the Trader's loop once over all candles (one long run), as the live code would with bars since tr.checked
function liveRun(tr, bars, now, be = null) {
  const trades = [tr], src = { '1m': { bars }, '5m': { bars }, '15m': { bars } };
  liveLoop(trades, 'xau', src, { group: 'Metals' }, { be }, now, spotSkip, stopFill, exitR, fillBarAmbiguous, () => {}, [], WAIT, 'oanda');
  return { tr, add: trades.find((x) => x.addOf === tr.id) || null };
}
// the same candles through manageLive, the way a replay drives it
function sharedRun(tr, bars, now, be = null) {
  let add = null;
  for (const b of bars) {
    if (b.time < tr.checked) continue;
    if (spotSkip(b.time)) continue;
    const r = manageLive(tr, b, { be, feed: 'oanda' });
    if (r === 'exit') break;
    if (r && r.add && !add) add = r.add;
  }
  sizeR(tr);
  expireOrder(tr, now, WAIT[tr.h]);
  return { tr, add };
}
// note / checked / dataGap are the Trader's bookkeeping (text, run pointer, a recorded feed hole), not management
const strip = (t) => { if (!t) return null; const { note, checked, dataGap, ...rest } = t; return rest; };

test('unit: trail from +2R trails 1R behind the best price, and a gapped trailing stop fills at the open', () => {
  const t0 = ts('2026-11-03T10:00:00Z');
  const tr = { id: 'x', side: 'buy', entry: 4000, stop: 3980, t1: 4200, rr: 10, trail: [2, 1], noBe: true, status: 'open', filled: t0 - 60, checked: t0 - 60, dec: 1 };
  assert.equal(manageLive(tr, bar(t0, 4001, 4045, 4000, 4040)), null);   // +2.25R: the stop moves to best - 1R = 4025
  assert.equal(tr.trailMoved, true); assert.equal(tr.stop, 4025);
  assert.equal(manageLive(tr, bar(t0 + 60, 4015, 4016, 4010, 4012)), 'exit');   // opened through the trailing stop: fills at the open
  assert.equal(tr.exit, 'trailing stop'); assert.equal(tr.exitPx, 4015); assert.equal(tr.R, 0.75); assert.equal(tr.status, 'win'); assert.equal(tr.gapR, 0.5);
});
test('unit: beAt moves the stop to the entry, a stop there books 0R (be); maxHold exits at the close', () => {
  const t0 = ts('2026-11-03T10:00:00Z');
  const tr = { id: 'x', side: 'sell', entry: 4000, stop: 4010, t1: 3900, rr: 10, beAt: 1.5, noBe: true, status: 'open', filled: t0 - 60, checked: t0 - 60, dec: 1 };
  manageLive(tr, bar(t0, 3999, 4000, 3984, 3990)); assert.equal(tr.beMoved, true); assert.equal(tr.stop, 4000);
  assert.equal(manageLive(tr, bar(t0 + 60, 3995, 4000, 3994, 3996)), 'exit'); assert.equal(tr.R, 0); assert.equal(tr.status, 'be');
  const th = { id: 'y', side: 'buy', entry: 4000, stop: 3990, t1: 4100, rr: 10, maxHold: 3600, noBe: true, status: 'open', filled: t0, checked: t0, dec: 1 };
  manageLive(th, bar(t0 + 1800, 4001, 4004, 3999, 4003));
  assert.equal(manageLive(th, bar(t0 + 3600, 4004, 4006, 4003, 4005)), 'exit'); assert.equal(th.exitKind, 'time'); assert.equal(th.R, 0.5); assert.equal(th.exit, '1 h');
});
test('unit: the pyramid add opens at +addAt R with the stop at the entry, the trail re-expressed, size x addAt; a shadow parent gives a shadow add', () => {
  const t0 = ts('2026-11-03T10:00:00Z');
  const tr = { id: 'xau-moshabo-1', market: 'xau', k: 'mosha-bo', name: 'Mosha BO system', side: 'buy', entry: 4000, stop: 3990, t1: 4100, rr: 10, trail: [3, 1], beAt: 1.5, addAt: 1.5, addSize: 1, noBe: true, maxHold: 72 * 3600,
    status: 'open', filled: t0, checked: t0, dec: 1, shadow: true, blockedBy: ['weekly'] };
  const r = manageLive(tr, bar(t0 + 60, 4001, 4016, 4000, 4014));
  assert.ok(r && r.add, 'an add is returned'); assert.equal(tr.addDone, true);
  assert.equal(r.add.entry, 4015); assert.equal(r.add.stop, 4000); assert.equal(r.add.size, 1.5); assert.deepEqual(r.add.trail, [1, 0.667]); assert.equal(r.add.r0, 15);
  assert.equal(r.add.shadow, true); assert.deepEqual(r.add.blockedBy, ['weekly']); assert.equal(r.add.addOf, tr.id);
  const bare = { ...tr, id: 'xau-moshabo-3', blockedBy: [], addDone: false, mfe: 0 };
  assert.deepEqual(addUnit(bare, bar(t0 + 60, 4001, 4016, 4000, 4014), 'oanda').blockedBy, ['owner-shadow']);   // a shadow with no blocker named gets owner-shadow, as the Trader does
  assert.equal(manageLive(tr, bar(t0 + 120, 4014, 4030, 4013, 4020)), null, 'one add only');
  const live = { ...tr, id: 'xau-moshabo-2', shadow: false, blockedBy: [], addDone: false, mfe: 0 };
  assert.equal(addUnit(live, bar(t0 + 60, 4001, 4016, 4000, 4014)).shadow, false);
});
test('unit: a resting limit expires on the run clock; a limit fill + target in one candle is missed; sizeR scales R once', () => {
  const t0 = ts('2026-11-03T10:00:00Z');
  const p = { id: 'p', side: 'buy', entry: 3980, stop: 3970, t1: 4080, rr: 10, status: 'pending', opened: t0, checked: t0, validFor: 24 * 3600, h: '15m', entryMode: 'limit' };
  assert.equal(expireOrder(p, t0 + 24 * 3600), false); assert.equal(expireOrder(p, t0 + 24 * 3600 + 1), true); assert.equal(p.status, 'expired'); assert.equal(p.R, 0);
  const q = { id: 'q', side: 'buy', entry: 3980, stop: 3970, t1: 3990, rr: 1, status: 'pending', opened: t0, checked: t0 };
  assert.equal(manageLive(q, bar(t0 + 60, 3985, 3995, 3979, 3992)), 'exit'); assert.equal(q.status, 'missed'); assert.equal(q.R, 0);
  const z = { R: -1, size: 1.5 }; sizeR(z); assert.equal(z.R, -1.5); assert.equal(z.rawR, -1); sizeR(z); assert.equal(z.R, -1.5);
});

test('parity: the Trader\'s own loop text and manageLive book the same trade and the same add on random gappy candles', () => {
  let x = 11; const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  let exits = 0, adds = 0, trails = 0, gaps = 0, pend = 0, times = 0, shadows = 0;
  for (let k = 0; k < 600; k++) {
    const sell = rnd() < 0.5, sg = sell ? -1 : 1, entry = 4000 + Math.round(rnd() * 200), r0 = +(8 + rnd() * 60).toFixed(2), stop = +(entry - sg * r0).toFixed(2);
    const kind = Math.floor(rnd() * 4);   // 0 replica-style, 1 Mosha-style (limit), 2 engulf-style (limit, trail [2,1]), 3 trend-style (no target, no time)
    const base = { id: `xau-t-${k}`, market: 'xau', label: 'XAU/USD', dec: 1, k: ['replica', 'mosha-bo', 'geg', 'gtrend'][kind], name: 'T', pair: 'p', h: ['5m', '15m', '1d', '1d'][kind], side: sell ? 'sell' : 'buy', entry, stop, buf: 0.15, R: null, noBe: true, shadow: kind === 1 && rnd() < 0.5, blockedBy: [] };
    if (kind === 0) Object.assign(base, { t1: +(entry + sg * 10 * r0).toFixed(2), rr: 10, trail: [4, 1], beAt: 2, addAt: 1.5, addSize: 1, maxHold: 48 * 3600, entryMode: 'market', size: [0.5, 1, 1.5][Math.floor(rnd() * 3)] });
    if (kind === 1) Object.assign(base, { t1: +(entry + sg * 10 * r0).toFixed(2), rr: 10, trail: [3, 1], beAt: 1.5, addAt: 1.5, addSize: 1, maxHold: 72 * 3600, validFor: 24 * 3600, entryMode: 'limit' });
    if (kind === 2) Object.assign(base, { t1: +(entry + sg * 10 * r0).toFixed(2), rr: 10, trail: [2, 1], maxHold: 240 * 3600, validFor: 20 * 86400, entryMode: 'limit' });
    if (kind === 3) Object.assign(base, { t1: +(entry * 100).toFixed(2), rr: 99, trail: [1e6, 0], entryMode: 'market' });
    if (base.shadow && rnd() < 0.6) base.blockedBy = ['weekly'];
    // 1m candles from Thursday 5 Nov across the weekend into the next week, with holes (missing candles) and jumps (news, reopen)
    const t0 = ts('2026-11-05T12:00:00Z') + Math.floor(rnd() * 3000) * 60, bars = []; let px = entry + sg * (rnd() * 1.2 - 0.3) * r0, t = t0;
    const n = 300 + Math.floor(rnd() * 2500), drift = sg * (rnd() - 0.3) * 0.03 * r0;   // most cases drift the trade's way, so adds and trails happen
    for (let i = 0; i < n; i++) {
      t += rnd() < 0.01 ? 3600 * (1 + Math.floor(rnd() * 30)) : 60;
      const o = px + (rnd() < 0.03 ? (rnd() - 0.5) * 2.5 * r0 : 0); px = o + drift + (rnd() - 0.5) * 0.25 * r0;
      bars.push(bar(t, o, Math.max(o, px) + rnd() * 0.15 * r0, Math.min(o, px) - rnd() * 0.15 * r0, px));
    }
    const pending = base.entryMode === 'limit' && rnd() < 0.8;
    Object.assign(base, pending ? { status: 'pending', opened: t0 - 120, checked: t0 - 120 } : { status: 'open', opened: t0 - 120, filled: t0 - 120, checked: t0 - 120 });
    const now = bars.at(-1).time + 60;
    const A = liveRun(structuredClone(base), bars, now), B = sharedRun(structuredClone(base), bars, now);
    assert.deepEqual(strip(B.tr), strip(A.tr), `case ${k} trade`);
    assert.deepEqual(strip(B.add), strip(A.add), `case ${k} add`);
    if (['win', 'loss', 'be', 'missed'].includes(A.tr.status)) exits++; if (A.add) adds++; if (A.tr.trailMoved) trails++; if (A.tr.gapR) gaps++; if (pending) pend++; if (A.tr.exitKind === 'time') times++; if (A.add && A.add.shadow) shadows++;
  }
  assert.ok(exits > 300 && adds > 40 && trails > 60 && gaps > 10 && pend > 80 && times > 10 && shadows > 3, `exercised: ${exits} exits, ${adds} adds (${shadows} shadow), ${trails} trails, ${gaps} gapped, ${pend} resting, ${times} time exits`);
});

test('the Trader\'s add inherits the parent\'s shadow flag (a blocked Mosha chain is not our system; #564)', () => {
  assert.match(SRC, /addOf: tr\.id, shadow: !!tr\.shadow, blockedBy: tr\.shadow \?/);
});
