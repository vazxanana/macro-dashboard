// tests/combo-grid-2.test.mjs - combination grid 2 (research/edge/combo-grid-2): the body engulf, the filters' size, no look-ahead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NCOMBO, DIRS, ZONES, GRID_MARKETS, buildZones, frames, signalsFor, CHAINS } from '../research/edge/combo-grid-2/run.mjs';

test('grid 2 has 11 filters, 9 zones and 18 markets', () => {
  assert.equal(DIRS.length, 11); assert.equal(ZONES.length, 9); assert.equal(GRID_MARKETS.length, 18);
  assert.equal(NCOMBO, 5 * 9 * 2 * 11 * 47 * 7);
});

const c = (t, o, h, l, cl) => ({ t, o, h, l, c: cl, e: t + 3600 });
test('the body engulf: the second body covers the first whole body, the first body at least 40 % of its range', () => {
  const L = [c(0, 10, 10.6, 9.4, 9.5), c(3600, 9.4, 10.3, 9.3, 10.2), c(7200, 10.2, 10.25, 9.0, 9.1), c(10800, 9.0, 11, 8.9, 9.05)];
  const z = buildZones('egb', L);
  // candle 1 (up, body 9.4-10.2) covers candle 0's body (9.5-10.0): a buy zone = candle 0 wick to wick
  assert.equal(z[0].d, 1); assert.equal(z[0].bot, 9.4); assert.equal(z[0].top, 10.6); assert.equal(z[0].at, 7200);
  // candle 2 (down, body 9.1-10.2) covers candle 1's body: a sell zone
  assert.equal(z[1].d, -1); assert.equal(z[1].top, 10.3);
  // candle 3's body (9.0-9.05) is too small to cover anything: no zone; and a first candle with a small body never counts
  assert.equal(z.length, 2);
  assert.equal(buildZones('egb', [c(0, 10, 11, 9, 10.1), c(3600, 10.2, 10.4, 9.8, 9.85)]).length, 0);
});

function seeded(n, seed = 7) {
  let a = seed, px = 1.3; const out = []; const t0 = Date.UTC(2019, 9, 1) / 1000;
  for (let i = 0; i < n; i++) { a = (a * 1103515245 + 12345) % 2147483648; const r = a / 2147483648 - 0.5; const o = px; px = Math.max(0.5, px + r * 0.0015);
    const h = Math.max(o, px) + Math.abs(r) * 0.0005, l = Math.min(o, px) - Math.abs(r) * 0.0005; const t = t0 + i * 300;
    if (new Date(t * 1000).getUTCDay() === 6) continue; out.push({ t, o, h, l, c: px, e: t + 300 }); }
  return out;
}
test('no look-ahead for the body engulf zones: signals before a cut do not change', () => {
  const M5 = seeded(80000), cut = M5[55000].t;
  const A = frames(M5), B = frames(M5.filter((b) => b.t < cut));
  const key = (s) => [s.z.d, s.z.at, s.z.bot, s.z.top, s.visit, s.trig, s.j, s.ext].join('|');
  let n = 0;
  for (const [tfL, tfT] of CHAINS.slice(1)) {
    const ts = (s, T) => (s.trig === 5 ? T[s.k0].t : T[s.j].e);
    const a = signalsFor(A, tfL, tfT, 'egb', {}).filter((s) => ts(s, A[tfT]) < cut - 3 * 86400).map(key).sort();
    const b = signalsFor(B, tfL, tfT, 'egb', {}).filter((s) => ts(s, B[tfT]) < cut - 3 * 86400).map(key).sort();
    assert.deepEqual(a, b); n += a.length; }
  assert.ok(n > 50);
});
