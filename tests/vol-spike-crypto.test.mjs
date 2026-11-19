// vol-spike-crypto: the frozen rule is byte for byte, crypto keeps its weekends, the costs follow the pre-registration,
// the verdict follows the bar, the placebo never enters on a signal day or above SMA20, and the report quotes result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cryptoCandles, nightsOf, nightsHeld, netCrypto, verdictOf, placeboTrades, PRIMARY, FIN_YEAR, missingDays } from '../research/edge/vol-spike-crypto/run.mjs';
import { signals, sma, rng, candles } from '../research/edge/vol-spike-crypto/frozen.mjs';
import { CFD_CRYPTO } from '../council/fills.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'vol-spike-crypto');
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const MD = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');

test('frozen rule is #860 byte for byte', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(sha, '339077aa9b4193eed610095fd75862195cf259c7ed29f78d4a26ac8f71beb8c1');
});

test('crypto keeps all seven UTC days (the frozen candles() would drop weekends)', () => {
  const rows = [...Array(14)].map((_, i) => [1704067200 + i * 86400, 1, 2, 0.5, 1.5]); // 2024-01-01 Mon .. 14 days
  assert.equal(cryptoCandles(rows).length, 14);
  assert.equal(candles(rows).length, 10);
  assert.equal(missingDays(cryptoCandles(rows)), 0);
  assert.equal(missingDays(cryptoCandles([rows[0], rows[3]])), 2);
});

test('costs: CFD round trip + 15 % a year per night, Friday x3, no night on a gap exit day', () => {
  assert.equal(CFD_CRYPTO, 0.0004);
  assert.equal(FIN_YEAR, 0.15);
  assert.equal(nightsOf(Date.UTC(2026, 10, 13) / 1000), 3); // Friday
  assert.equal(nightsOf(Date.UTC(2026, 10, 14) / 1000), 1); // Saturday
  const D = [...Array(5)].map((_, i) => ({ time: Date.UTC(2026, 10, 9 + i) / 1000, open: 100, high: 101, low: 99, close: 100 }));
  D[4] = { ...D[4], open: 80, low: 79 }; // Friday gaps under the stop
  const tr = { i: 0, j: 4, entry: 100, exit: 80, why: 'stop', stop: 90, risk: 10 };
  assert.equal(nightsHeld(D, tr), 4);
  const n = netCrypto(D, tr);
  assert.ok(Math.abs(n.R - (80 - 100 - 0.04 - 0.15 / 365 * 4 * 100) / 10) < 1e-12);
  assert.ok(Math.abs(netCrypto(D, tr, 2).costR - 2 * n.costR) < 1e-12);
  assert.equal(netCrypto(D, tr, 0).R, -2);
  assert.equal(nightsHeld(D, { ...tr, why: 'time' }), 7);
});

test('verdict follows the pre-registered bar', () => {
  assert.equal(verdictOf({ n: 50, avgR: 0.1, tMonths: 2.1 }, { n: 20, avgR: 0.01 }, { avgR: 0.01 }), 'PASS');
  assert.equal(verdictOf({ n: 50, avgR: 0.1, tMonths: 1.9 }, { n: 20, avgR: 0.01 }, { avgR: 0.01 }), 'FAIL');
  assert.equal(verdictOf({ n: 50, avgR: 0.1, tMonths: 2.1 }, { n: 20, avgR: -0.01 }, { avgR: 0.01 }), 'FAIL');
  assert.equal(verdictOf({ n: 50, avgR: 0.1, tMonths: 2.1 }, { n: 20, avgR: 0.01 }, { avgR: -0.01 }), 'FAIL');
  assert.match(verdictOf({ n: 39, avgR: 0.1, tMonths: 3 }, { n: 20, avgR: 0.1 }, { avgR: 0.1 }), /^NOT MEASURABLE \(inconclusive/);
  assert.match(verdictOf({ n: 50, avgR: 0.1, tMonths: 3 }, { n: 9, avgR: 0.1 }, { avgR: 0.1 }), /^NOT MEASURABLE \(inconclusive/);
  assert.equal(verdictOf(R.primary.D.base, R.primary.W.base, R.primary.D.x2), R.verdict);
  assert.equal(R.verdict, 'FAIL');
  assert.equal(R.gate.equal, true);
  assert.deepEqual(R.gate.published.B, { n: 165, avgR: 0.151, tTrades: 2.53 });
  assert.deepEqual(R.coinSets.primary, ['btc', 'eth', 'sol', 'xrp']);
  assert.equal(R.primary.D.base.n, Object.keys(PRIMARY).reduce((a, k) => a + R.coins[k].D.n, 0));
});

test('placebo enters only below SMA20 and never on a signal day', () => {
  const D = []; let px = 100; const r = rng(5);
  for (let i = 0; i < 900; i++) {
    const ch = (i % 150 === 140 ? -0.08 : 0.001) + (r() - 0.5) * 0.01, o = px; px = px * (1 + ch);
    D.push({ time: 1577836800 + i * 86400, open: o, high: Math.max(o, px) * 1.003, low: Math.min(o, px) * 0.997, close: px });
  }
  const sig = signals(D), s20 = sma(D, 20); assert.ok(sig.some(Boolean));
  const tr = placeboTrades(D, 200, D[0].time, D.at(-1).time, rng(9));
  assert.equal(tr.length, 200);
  for (const t of tr) { assert.equal(sig[t.i - 1], false); assert.ok(D[t.i - 1].close < s20[t.i - 1]); assert.ok(t.risk > 0); }
});

test('report quotes result.json', () => {
  assert.equal(R.placebo.values.length, 40);
  assert.equal(R.placebo.seedFrom, 7001);
  const b = R.primary.D.base;
  for (const s of [b.n, b.avgR, b.tMonths, R.primary.W.base.avgR, R.primary.D.x2.avgR, R.placebo.p95, R.placebo.beats, R.others.D.base.avgR])
    assert.ok(MD.includes(String(s)), `RESULT.md lacks ${s}`);
  assert.match(MD, /\*\*Verdict: FAIL\.\*\*/);
});
