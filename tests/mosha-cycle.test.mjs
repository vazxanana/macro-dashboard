// Mosha cycle (council/mosha-cycle.mjs): H4 move, H1 ChoCh = the pullback starts, M15 / M5 trade the pullback (target the H4 50%),
// then the M15 / M5 ChoCh back with H4 (target the H4 extreme). Every trade has a stop on the losing side of its entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cycleState, cycleTrades, cycleText, BUF } from '../council/mosha-cycle.mjs';

const H = 3600, T0 = 1_800_000_000;
// H4 BO down at T0 (broken level 4100, origin top 4150); H1 candles fall to 4000, then the H1 ChoCh up at T0 + 10 h
const E4 = [{ t: T0, dir: -1, level: 4100, top: 4150, bot: 4100, flip: true }];
const h1 = Array.from({ length: 12 }, (_, i) => ({ time: T0 - 4 * H + i * H, open: 4100 - i * 8, high: 4105 - i * 8, low: 4100 - i * 9 - (i === 9 ? 1 : 0), close: 4098 - i * 8 }));
const E1 = [{ t: T0 + 10 * H, dir: 1, level: 4030, top: 4030, bot: 4010, flip: true }];
const pull = { t: T0 + 11 * H, dir: 1, level: 4040, top: 4040, bot: 4020, flip: true };       // M15 BO up with the pullback
const back = { t: T0 + 14 * H, dir: -1, level: 4050, top: 4062, bot: 4050, flip: true };      // M5 ChoCh back down with H4

test('the stages: move, pullback (H1 ChoCh), resumed (lower ChoCh back)', () => {
  assert.equal(cycleState([], [], []).stage, 'none');
  assert.equal(cycleState(E4, [], h1).stage, 'move');
  const st = cycleState(E4, E1, h1);
  assert.equal(st.stage, 'pullback'); assert.equal(st.h4.far, 4150); assert.ok(st.ext < 4030, 'the move extreme comes from the H1 candles before the ChoCh');
  assert.equal(st.p50, +((4150 + st.ext) / 2).toFixed(2));
  assert.equal(cycleTrades({ E4, E1, E15: [pull], E5: [back], h1 }, T0 + 14 * H + 60).state.stage, 'resumed');
});

test('the pullback trade and the main trade, each with its stop and target', () => {
  const { trades } = cycleTrades({ E4, E1, E15: [pull], E5: [back], h1 }, T0 + 14 * H + 60);
  const p = trades.find((x) => x.leg === 'pull'), m = trades.find((x) => x.leg === 'main');
  assert.equal(p.side, 'buy'); assert.equal(p.entry, 4040); assert.equal(p.stop, 4020 - BUF); assert.equal(p.t1, p.p50); assert.equal(p.tf, '15m');
  assert.equal(m.side, 'sell'); assert.equal(m.entry, 4050); assert.equal(m.stop, 4062 + BUF); assert.equal(m.t1, m.ext); assert.equal(m.tf, '5m');
  assert.ok(m.room && m.rr >= 1); assert.equal(p.fresh, false); assert.equal(m.fresh, true);
  for (const x of trades) assert.ok(x.side === 'buy' ? x.stop < x.entry : x.stop > x.entry, 'stop on the losing side');
});

test('no lower-timeframe break before the H1 ChoCh counts; no main trade without a pullback break first', () => {
  const early = { ...pull, t: T0 + 5 * H };
  assert.equal(cycleTrades({ E4, E1, E15: [early], E5: [], h1 }, T0 + 20 * H).trades.length, 0);
  assert.equal(cycleTrades({ E4, E1, E15: [], E5: [back], h1 }, T0 + 20 * H).trades.length, 0);
});

test('a target under 1R is flagged (the Trader records it as a shadow)', () => {
  const wide = { ...back, top: 4200 };
  const m = cycleTrades({ E4, E1, E15: [pull], E5: [wide], h1 }, T0 + 15 * H).trades.find((x) => x.leg === 'main');
  assert.equal(m.room, false);
});

test('one line for the site, and the Trader wiring', () => {
  assert.match(cycleText(cycleState(E4, E1, h1)), /H1 ChoCh/);
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /id: 'mosha-cycle'/); assert.match(src, /k: 'mcycle'/); assert.match(src, /'mosha-bo', 'mcycle'/);
  const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(page, /const SYS_K = \['replica', 'mosha-bo', 'mcycle'/); assert.match(page, /id="ms-rep-mcycle"/);
});
