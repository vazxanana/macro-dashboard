// Offline tests for the replay's trade step (council/fills.mjs replayBar / manageVariant, used by council/backtest.mjs): the replay
// fills and exits on the Trader's rules. Gap fixtures: weekend and news gaps through first, break-even and trailing stops, a limit
// fill + target in one candle, candles while spot is shut, and a parity check against the Trader's own order of checks.
//   node --test tests/backtest-fills.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { replayBar, stopFill, exitR, fillBarAmbiguous, spotClosed } from '../council/fills.mjs';

const ts = (iso) => Date.parse(iso) / 1000;
const bar = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c });
// the Backtest's exit variants (backtest.mjs VARIANTS): none, be1, be15, tp2 and the paper pt1 (half at +1R, trail 1R)
const variants = (stop) => [['none', null, false], ['be1', 1, false], ['be15', 1.5, false], ['tp2', null, true], ['pt1', null, false, { at: 1, trail: 1 }]]
  .map(([n, be, t2, pt]) => ({ n, be, t2, pt, stop, beMoved: false, done: false, R: null, size: 1, booked: 0, best: 0 }));
const trade = (o) => { const tr = { t2: null, mfe: 0, opened: 0, ...o }; tr.r0 = Math.abs(tr.entry - tr.stop); tr.v = variants(tr.stop); return tr; };
// the replay's candle loop (backtest.mjs): gold / forex skip shut-market candles, crypto never does
const run = (tr, bars, { crypto = false, wait = 86400 } = {}) => { for (const b of bars) replayBar(tr, b, { shut: !crypto && spotClosed(b.time), wait }); return tr; };
const R = (tr) => Object.fromEntries(tr.v.map((v) => [v.n, v.R == null ? null : +v.R.toFixed(2)]));

const MID = ts('2026-11-04T10:00:00Z');   // a Wednesday: spot open

test('weekend gap through the stop: every variant fills at the Sunday open, not at the stop', () => {
  // buy 4000, stop 3990 (1R = 10): Friday closes 3995, the Sunday reopen candle opens at 3970 = -3R
  const fri = ts('2026-11-06T21:58:00Z'), sun = ts('2026-11-08T23:00:00Z');
  const tr = run(trade({ side: 'buy', entry: 4000, stop: 3990, t1: 4030, t2: 4050, rr: 3, status: 'open', filled: fri - 3600, opened: fri - 3600 }),
    [bar(fri, 3996, 3997, 3995, 3995), bar(sun, 3970, 3975, 3965, 3972)]);
  assert.equal(tr.status, 'closed');
  assert.deepEqual(R(tr), { none: -3, be1: -3, be15: -3, tp2: -3, pt1: -3 });
  assert.equal(tr.v[0].gapR, 2, 'R lost beyond the stop');
});

test('a stop touched inside the candle still books exactly -1R; a news gap on a sell fills at the open', () => {
  const a = run(trade({ side: 'sell', entry: 100, stop: 102, t1: 94, rr: 3, status: 'open', filled: MID - 60 }), [bar(MID, 101, 102.4, 100.5, 101)]);
  assert.deepEqual(R(a), { none: -1, be1: -1, be15: -1, tp2: -1, pt1: -1 }); assert.equal(a.v[0].gapR, undefined);
  const b = run(trade({ side: 'sell', entry: 100, stop: 102, t1: 94, rr: 3, status: 'open', filled: MID - 60 }), [bar(MID, 103, 104, 102.5, 103)]);
  assert.equal(R(b).none, -1.5); assert.equal(b.v[0].gapR, 0.5);
});

test('break-even and trailing stops gapped through fill at the open too', () => {
  // buy 100, stop 98 (1R = 2), target 106. Candle 1 runs to 104 (+2R): be1 and be15 move to the entry, pt1 books half at +1R and
  // trails to 102. Candle 2 opens at 99 (gap): the first stop (98) is untouched, the moved stops fill at 99, not at their level.
  const tr = run(trade({ side: 'buy', entry: 100, stop: 98, t1: 106, rr: 3, status: 'open', filled: MID - 60 }),
    [bar(MID, 100, 104, 99.5, 103.5), bar(MID + 60, 99, 99.5, 98.8, 99.2)]);
  assert.equal(tr.v[0].done, false, 'the first stop was not reached');
  assert.equal(R(tr).be1, -0.5, 'break-even gapped: -0.5R, not 0R');
  assert.equal(R(tr).be15, -0.5);
  assert.equal(R(tr).pt1, 0.25, 'half at +1R, the trailed half out at the 99 open: 0.5 - 0.25');
  assert.equal(tr.v[4].gapR, 1.5, 'trail stop 102, filled 99');
});

test('on the fill candle the open came before the fill: a limit order stopped there books -1R', () => {
  // buy limit 100 (stop 98): the candle opens at 101 and trades down to 97: filled at 100, stopped at 98
  const tr = run(trade({ side: 'buy', entry: 100, stop: 98, t1: 106, rr: 3, status: 'pending', opened: MID - 300 }), [bar(MID, 101, 101.5, 97, 97.5)]);
  assert.equal(tr.filled, MID); assert.equal(R(tr).none, -1);
});

test('a limit fill and the target in one candle, order unknown: missed (0R, fillTarget), never a win', () => {
  const amb = run(trade({ side: 'buy', entry: 100, stop: 99, t1: 103, rr: 3, status: 'pending', opened: MID - 300 }), [bar(MID, 101.5, 103.5, 100, 102)]);
  assert.equal(amb.status, 'missed'); assert.equal(amb.fillTarget, true); assert.equal(amb.filled, undefined);
  // opened at / through the entry: the fill came first, the target after it: a win
  const ok = run(trade({ side: 'buy', entry: 100, stop: 99, t1: 103, rr: 3, status: 'pending', opened: MID - 300 }), [bar(MID, 99.8, 103.5, 99.6, 103)]);
  assert.equal(ok.status, 'closed'); assert.equal(R(ok).none, 3);
  // fill, stop and target in one candle: the stop (conservative)
  const all = run(trade({ side: 'buy', entry: 100, stop: 99, t1: 103, rr: 3, status: 'pending', opened: MID - 300 }), [bar(MID, 101.5, 103.5, 98.5, 100)]);
  assert.equal(R(all).none, -1);
});

test('weekend candles (Kraken PAXG fallback) neither fill, stop nor target a gold / forex trade; crypto keeps trading', () => {
  const sat = ts('2026-11-07T12:00:00Z'), mon = ts('2026-11-09T08:00:00Z');
  const g = run(trade({ side: 'buy', entry: 4000, stop: 3990, t1: 4030, rr: 3, status: 'open', filled: sat - 86400, opened: sat - 86400 }), [bar(sat, 3995, 3996, 3980, 3992), bar(mon, 3993, 4000, 3992, 3998)]);
  assert.equal(g.status, 'open'); assert.equal(g.mfe, 0, 'no MFE from a shut candle either');
  const c = run(trade({ side: 'buy', entry: 4000, stop: 3990, t1: 4030, rr: 3, status: 'open', filled: sat - 86400, opened: sat - 86400 }), [bar(sat, 3995, 3996, 3980, 3992)], { crypto: true });
  assert.equal(R(c).none, -1);
  // a resting order is not filled by a shut candle, but it still expires on time
  const p = run(trade({ side: 'buy', entry: 3985, stop: 3975, t1: 4015, rr: 3, status: 'pending', opened: sat - 3600 }), [bar(sat, 3995, 3996, 3980, 3992)], { wait: 7200 });
  assert.equal(p.status, 'pending');
  run(p, [bar(sat + 7200, 3990, 3991, 3980, 3985)], { wait: 7200 });
  assert.equal(p.status, 'expired');
});

// The Trader's own order of checks (council/trader.mjs "Manage open trades", config.be as the break-even), as a reference
function live(tr, bars, be) {
  const s = tr.side === 'sell', r0 = Math.abs(tr.entry - tr.stop);
  for (const b of bars) {
    if (spotClosed(b.time)) continue;
    if (tr.status === 'pending') {
      if (s ? b.high >= tr.entry : b.low <= tr.entry) { if (fillBarAmbiguous(b, s, tr.entry, tr.stop, tr.t1)) { tr.status = 'missed'; tr.R = 0; break; } tr.status = 'open'; tr.filled = b.time; }
      else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.R = 0; break; } else continue;
    }
    if (s ? b.high >= tr.stop : b.low <= tr.stop) {
      const px = stopFill(b, s, tr.stop, b.time > tr.filled), gapped = px !== tr.stop;
      tr.R = tr.beMoved ? exitR(s, tr.entry, px, r0) : gapped ? exitR(s, tr.entry, px, r0) : -1; tr.status = 'done'; break;
    }
    if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.R = tr.rr; tr.status = 'done'; break; }
    if (be && !tr.beMoved && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= be) { tr.stop = tr.entry; tr.beMoved = true; }
  }
  return tr;
}

test('parity: on random gappy candles the replay books what the Trader books (no break-even = R_none, +1R = R_be1)', () => {
  let x = 7; const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  let n = 0, gaps = 0, missed = 0;
  for (let k = 0; k < 400; k++) {
    const sell = rnd() < 0.5, sg = sell ? -1 : 1, entry = 100, r0 = 1 + rnd(), stop = entry - sg * r0, rr = 1.5 + 2 * rnd(), t1 = entry + sg * rr * r0;
    // 1m candles from a Thursday into the next week, with a jump every so often (news, missing candles) and the weekend in between
    const bars = []; let px = entry + sg * (rnd() * 1.5) * r0, t = ts('2026-11-05T12:00:00Z') + Math.floor(rnd() * 2000) * 60;
    for (let i = 0; i < 400; i++) {
      t += rnd() < 0.02 ? 3600 * (1 + Math.floor(rnd() * 60)) : 60;
      const o = px + (rnd() < 0.05 ? (rnd() - 0.5) * 3 * r0 : 0); px = o + (rnd() - 0.5) * 0.4 * r0;
      bars.push(bar(t, o, Math.max(o, px) + rnd() * 0.2 * r0, Math.min(o, px) - rnd() * 0.2 * r0, px));
    }
    const pending = rnd() < 0.5, base = { side: sell ? 'sell' : 'buy', entry, stop, t1, rr, status: pending ? 'pending' : 'open', opened: bars[0].time - 60, filled: pending ? undefined : bars[0].time - 60 };
    // (no expiry here: the Trader expires a resting order on its run clock, outside the candle loop)
    const rep = run(trade(base), bars, { wait: Infinity }), L0 = live({ ...base }, bars, null), L1 = live({ ...base }, bars, 1);
    if (rep.status === 'missed') { missed++; assert.equal(L0.status, 'missed'); continue; }
    for (const [L, v] of [[L0, rep.v[0]], [L1, rep.v[1]]]) {
      if (L.status !== 'done') { assert.equal(v.done, false); continue; }
      assert.equal(+v.R.toFixed(2), +L.R.toFixed(2), `case ${k} ${v.n}`); n++; if (v.gapR) gaps++;
    }
  }
  assert.ok(n > 300 && gaps > 20 && missed > 0, `exercised: ${n} exits, ${gaps} gapped, ${missed} missed`);
});

test('the Backtest manages trades with the shared step, no flat -1R stop of its own', () => {
  const src = fs.readFileSync(new URL('../council/backtest.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{[^}]*\breplayBar\b[^}]*\} from '\.\/fills\.mjs'/);
  assert.match(src, /import \{[^}]*\bspotClosed\b[^}]*\} from '\.\/fills\.mjs'/);
  assert.match(src, /replayBar\(tr, b, \{ shut/);
  assert.doesNotMatch(src, /function manage\(/);
  assert.doesNotMatch(src, /v\.R = v\.beMoved \? 0 : -1/);
});
