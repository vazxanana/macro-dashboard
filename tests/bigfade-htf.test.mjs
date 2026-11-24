// bigfade-htf: big-candle-fade's rule on H4, judged after costs (research only). Offline: result.json figures and rule units.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, trade, TESTS, cellName, passOf, H1_PARENT } from '../research/edge/bigfade-htf/run.mjs';
import { signals as parentSignals } from '../research/edge/big-candle-fade/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/bigfade-htf/result.json', import.meta.url), 'utf8'));
const P = JSON.parse(fs.readFileSync(new URL('../research/edge/big-candle-fade/result.json', import.meta.url), 'utf8'));

test('verdict and the two pre-registered tests', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.deepEqual(TESTS.map((c) => cellName(c).name), ['h4 k1.5 nobreak half', 'h4 k2 nobreak half']);
  assert.deepEqual(R.tests.map((t) => t.test), ['h4 k1.5 nobreak half', 'h4 k2 nobreak half']);
  assert.ok(R.tests.every((t) => !t.pass && t.conf.meanNet < 0 && t.conf.n >= 200));
  assert.equal(R.tests[0].conf.n, 3906); assert.ok(Math.abs(R.tests[0].conf.meanNet + 0.150) < 0.0006);
  assert.ok(R.cut.length === 10 && R.cut.every((c) => c.missing === 0 && c.extra === 0));
  assert.equal(R.markets.length, 10);
});

test('the H1 half is the parent study\'s own figures', () => {
  for (const [k, v] of Object.entries(H1_PARENT)) {
    const c = P.cells.find((x) => x.cell === k); assert.ok(c, k);
    assert.equal(c.disc.n, v.d.n); assert.equal(c.conf.n, v.c.n);
    assert.ok(Math.abs(c.conf.mean - v.c.mean) < 0.0006 && Math.abs(c.conf.meanNet - v.c.net) < 0.0006);
    assert.ok(Math.abs(c.disc.meanNet - v.d.net) < 0.0006);
  }
});

// a seeded random walk of hourly candles
function walk(n, seed = 7) {
  let s = seed, px = 100; const out = [];
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < n; i++) { const o = px, big = rnd() < 0.05 ? 6 : 1, c = o + (rnd() - 0.5) * big;
    out.push({ t: i * 3600, e: (i + 1) * 3600, o, h: Math.max(o, c) + rnd() * 0.3, l: Math.min(o, c) - rnd() * 0.3, c }); px = c; }
  return out;
}

test('signals equal the parent\'s on the same timeframe (parity)', () => {
  const T = walk(1500); const mine = signals(T).big;
  const key = (g) => [g.j, g.d, g.ts, g.ext, g.mid, g.a, g.brk].join('|');
  // the parent also grades k3; the set of candles over k1.5 and their levels must be the same
  const theirsAll = parentSignals({ '15m': walk(20), '1h': T }).big.filter((g) => g.tf === 1).map(key);
  assert.deepEqual(mine.map(key), theirsAll);
  assert.ok(mine.length > 10);
});

test('no look-ahead: a candle cut later does not change earlier signals', () => {
  const T = walk(1200, 11), full = signals(T).big;
  for (const cut of [400, 800, 1100]) { const part = signals(T.slice(0, cut)).big;
    assert.deepEqual(part, full.filter((g) => g.j < cut)); }
});

test('the fade puts its stop on the losing side; small risk is no trade', () => {
  const M5 = Array.from({ length: 50 }, (_, i) => { const o = 100 - i * 0.1; return { t: 1000 + i * 300, e: 1300 + i * 300, o, h: o + 0.05, l: o - 0.15, c: o - 0.1 }; });
  const g = { d: 1, ts: 1000, ext: 101, mid: 100.5, a: 1 };   // a big up candle: fade = sell, stop above 101.1
  const r = trade(M5, g, 0.01); assert.equal(r.s, -1); assert.ok(r.stop > r.fill); assert.equal(r.R[0], 1); assert.equal(r.R[1], 2);
  assert.equal(trade(M5, g, 5).skip, 'small');
  assert.equal(passOf({ d: { n: 300, meanNet: 0.1 }, c: { n: 300, meanNet: 0.1, tNet: 2.1 } }, 0.01), true);
  assert.equal(passOf({ d: { n: 300, meanNet: -0.1 }, c: { n: 300, meanNet: 0.1, tNet: 2.1 } }, 0.01), false);
});
