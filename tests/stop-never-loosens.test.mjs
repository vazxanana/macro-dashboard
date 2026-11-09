// node --test tests/stop-never-loosens.test.mjs: a break-even must never move a stop that a trail already moved past the entry back to
// the entry (hard rule: a stop only ever tightens). Checked on manageLive (council/fills.mjs) and on the Trader's own loop text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { manageLive, spotSkip, stopFill, exitR, fillBarAmbiguous } from '../council/fills.mjs';

const t0 = Date.parse('2026-11-04T14:00:00Z') / 1000;
const SRC = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const i1 = SRC.indexOf('// ─── Manage open trades on this market with the candles since the last check ───'), i2 = SRC.indexOf('// ─── Review closed trades');
const liveLoop = new Function('trades', 'key', 'src', 'M', 'config', 'now', 'spotSkip', 'stopFill', 'exitR', 'fillBarAmbiguous', 'startReview', 'NEWS', 'WAIT', 'FEED', SRC.slice(i1, i2));
const mk = (extra) => ({ id: 'x', market: 'xau', side: 'buy', entry: 4000, stop: 3990, t1: 4100, rr: 10, trail: [3, 1], status: 'open', filled: t0 - 60, checked: t0 - 60, dec: 1, ...extra });
// one candle from +0 to +3.5R without touching the stop: the trail moves the stop to +2.5R; break-even must not pull it back to the entry
const bars = [{ time: t0, open: 4001, high: 4035, low: 4000.5, close: 4030 }];

for (const [name, extra, be] of [['per-trade beAt', { beAt: 1.5, noBe: true }, null], ['Coach config.be', {}, 1]]) {
  test(`manageLive: ${name} after a trail never loosens the stop`, () => {
    const tr = mk(extra); manageLive(tr, bars[0], { be });
    assert.equal(tr.stop, 4025); assert.ok(tr.trailMoved);
  });
  test(`Trader loop: ${name} after a trail never loosens the stop`, () => {
    const tr = mk(extra), src = { '1m': { bars }, '5m': { bars }, '15m': { bars } };
    liveLoop([tr], 'xau', src, { group: 'Metals' }, { be }, t0 + 300, spotSkip, stopFill, exitR, fillBarAmbiguous, () => {}, [], {}, 'oanda');
    assert.equal(tr.stop, 4025);
  });
}
