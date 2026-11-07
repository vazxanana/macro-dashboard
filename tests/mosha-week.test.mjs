// node --test tests/mosha-week.test.mjs — the Mosha BO weekly filter buckets a feed's Sunday-dated daily candle into the week
// it opens (gold-fidelity, 8 Nov: folded backwards, OANDA's Sunday stub flipped the fallback reading)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const m = src.match(/const weekOf = \(t\) => (.*);\n/);
const weekOf = new Function('t', `return ${m[1]};`);
const T = (s) => Math.floor(Date.parse(s) / 1000);

test('weekOf: Monday 00:00 UTC buckets; a Sunday candle joins the following week; Saturday stays in its week', () => {
  assert.ok(m, 'weekOf present in the Mosha weekly block');
  const mon = T('2026-11-02T00:00:00Z');
  assert.equal(weekOf(T('2026-11-02T00:00:00Z')), mon);
  assert.equal(weekOf(T('2026-11-06T00:00:00Z')), mon, 'Friday');
  assert.equal(weekOf(T('2026-11-07T00:00:00Z')), mon, 'Saturday (Kraken 24/7 candle) stays in the week that traded it');
  assert.equal(weekOf(T('2026-11-01T00:00:00Z')), mon, 'Sunday 1 Nov (OANDA 22:00 UTC open) is the first session of the week of 2 Nov');
  assert.equal(weekOf(T('2026-11-08T00:00:00Z')), T('2026-11-09T00:00:00Z'), 'next Sunday -> next week');
  assert.equal(weekOf(T('2026-11-01T23:00:00Z')), mon);
  assert.equal(new Date(345600 * 1000).getUTCDay(), 1, 'the epoch anchor is a Monday');
});
test('the weekly aggregation uses weekOf (wiring pin)', () => {
  assert.match(src, /for \(const b of dly\) \{ const k = weekOf\(b\.time\), c = wk\.at\(-1\);/);
});
