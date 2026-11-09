// node --test tests/nq-open-timeexit.test.mjs: the NQ open run (research.json nq-open) leaves at the open of the first candle at or
// after its exit time; that candle's high / low come after the exit and must not stop it or hit the target (look-ahead).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stopFill, exitR } from '../council/fills.mjs';

const SRC = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const a = SRC.indexOf('    for (const r of openNq) {'), b = SRC.indexOf('    if (NQ_ON.ny && ny.m >= 570');
assert.ok(a > 0 && b > a, 'trader.mjs: the nq-open management loop moved');
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
function nyParts(t) { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { d: `${o.year}-${o.month}-${o.day}`, m: +o.hour * 60 + +o.minute, wd: o.weekday }; }
const loop = new Function('openNq', 'bars', 'nyParts', 'stopFill', 'exitR', SRC.slice(a, b));

test('nq-open: the candle at the exit time exits at its open, never at the target it reaches later', () => {
  const t0 = Date.parse('2026-11-04T15:00:00Z') / 1000;   // 10:00 New York
  const r = { k: 'nq-open', side: 'buy', entry: 25000, stop: 24980, t1: 25060, status: 'open', checked: t0 - 60, filled: t0 - 60, day: '2026-11-04', exitAt: t0 + 120, exitLabel: '11:00' };
  const bars = [{ time: t0, open: 25001, high: 25010, low: 24995, close: 25005 }, { time: t0 + 60, open: 25005, high: 25012, low: 25000, close: 25010 },
    { time: t0 + 120, open: 25010, high: 25080, low: 25009, close: 25070 }];   // reaches the target only after the exit time
  loop([r], bars, nyParts, stopFill, exitR);
  assert.equal(r.status, 'win'); assert.equal(r.R, 0.5); assert.equal(r.exit, '11:00');
});
test('nq-open: a stop in the candle at the exit time is after the exit too', () => {
  const t0 = Date.parse('2026-11-04T15:00:00Z') / 1000;
  const r = { k: 'nq-open', side: 'buy', entry: 25000, stop: 24980, t1: 25060, status: 'open', checked: t0 - 60, filled: t0 - 60, day: '2026-11-04', exitAt: t0 + 60, exitLabel: '11:00' };
  const bars = [{ time: t0, open: 25001, high: 25010, low: 24995, close: 25005 }, { time: t0 + 60, open: 25010, high: 25011, low: 24970, close: 24975 }];
  loop([r], bars, nyParts, stopFill, exitR);
  assert.equal(r.R, 0.5); assert.equal(r.exit, '11:00');
});
