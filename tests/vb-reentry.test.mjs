// vb-reentry: the re-entry walk on hand-made candles (no look-ahead), and the committed result.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reentry, position, walk } from '../research/edge/vb-reentry/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-reentry/result.json', import.meta.url), 'utf8'));
const bar = (t, o, h, l, c) => ({ t, o, h, l, c });

// open 100, trigger 105 / 95: buy at 105, stopped at 100, crosses 105 again, ends at 108
function day() {
  return [bar(0, 100, 101, 99, 100), bar(300, 100, 106, 100.5, 105.5), bar(600, 105, 105, 99.5, 100.2), bar(900, 100.2, 104, 100.1, 103),
    bar(1200, 103, 106, 102.5, 105.8), bar(1500, 105.8, 108.5, 105, 108), bar(1800, 108, 108.2, 107, 108)];
}
function T1(bars) { const p = position(bars, 1, 1, 105, 100); return { p, O: 100, up: 105, dn: 95 }; }

test('re-entry: same side, same trigger, same stop, from the candle after the stop-out', () => {
  const bars = day(), T = T1(bars);
  assert.equal(T.p.how, 'stop'); assert.equal(T.p.xi, 2);
  const re = reentry(bars, T);
  assert.equal(re.side, 1); assert.equal(re.entry, 105); assert.equal(re.stop, 100); assert.equal(re.f, 4);
  assert.equal(re.how, 'time'); assert.equal(re.exit, 108); assert.ok(Math.abs(re.R - 0.6) < 1e-12);
});

test('re-entry: none when T1 was not stopped, none before the stop-out candle', () => {
  const bars = day(); const T = T1(bars);
  assert.equal(reentry(bars, { ...T, p: { ...T.p, how: 'time' } }), null);
  assert.equal(reentry(bars.slice(0, 4), T), null);          // no second cross yet
});

test('no look-ahead: the re-entry fill does not depend on later candles', () => {
  const bars = day(), T = T1(bars), full = reentry(bars, T), cut = reentry(bars.slice(0, 5), T);
  assert.equal(cut.f, full.f); assert.equal(cut.entry, full.entry);
  const changed = bars.map((b, i) => (i > 4 ? bar(b.t, 50, 51, 40, 45) : b));
  const re2 = reentry(changed, T);
  assert.equal(re2.f, full.f); assert.equal(re2.entry, full.entry);
});

test('walk exits at a gapped open through the stop', () => {
  assert.deepEqual(walk([bar(0, 99, 99.5, 98, 99)], 0, 1, 100), { exit: 99, how: 'stop', i: 0 });
});

test('result: gates exact and the pre-registered verdict', () => {
  for (const m of R.markets) { assert.ok(m.walkerOk); for (const g of m.gate) assert.ok(g.ok); }
  assert.match(R.verdict, /^FAIL, 0 of 3/);
  for (const k of ['E1', 'E2', 'E3']) assert.equal(R.tests[k].pass, false);
  assert.equal(R.tests.E3.CONF.n, R.tests.E1.CONF.n + R.tests.E2.CONF.n);
  assert.ok(R.tests.E3.CONF.t < 2);
});
