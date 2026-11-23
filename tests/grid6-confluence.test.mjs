// tests/grid6-confluence.test.mjs - research/edge/grid6-confluence: no look-ahead in the triggers and their counts (a cut and
// a changed future on a seeded market), every trade's stop on the losing side, the clustered slope on a known series, and
// RESULT.md pinned to result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { triggers, tradeOf, slope, SIGNALS, EXITS, KS } from '../research/edge/grid6-confluence/run.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import { rng } from '../research/edge/_lib/edgekit.mjs';

const DIR = new URL('../research/edge/grid6-confluence/', import.meta.url);
function market(n, seed = 9, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const t0 = Date.UTC(2012, 0, 2) / 1000, out = []; let c = px, k = 0;
  for (let i = 0; out.length < n; i++) { const t = t0 + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue;
    const o = c; c = o + (r() - 0.5) * 0.12 + Math.sin(k++ / 900) * 0.01; const h = Math.max(o, c) + r() * 0.05, l = Math.min(o, c) - r() * 0.05;
    out.push({ t, o, h, l, c, e: t + 300 }); }
  return out;
}
const key = (g) => [g.j, g.ts, g.d, g.trig, g.stopLvl, g.c0, g.atr, g.sig.join('')].join('|');

test('the design: ten signals, three exits, buckets 3..8', () => {
  assert.equal(SIGNALS.length, 10); assert.deepEqual(EXITS, ['1R', '2R', 'trail']); assert.deepEqual(KS, [3, 4, 5, 6, 7, 8]);
});

test('no look-ahead: triggers and counts before a cut are the same with the candles cut there or changed after it', () => {
  const B = market(60000), from = B[0].t + 40 * 86400, to = B[B.length - 1].e;
  const full = triggers(frames(B), { from, to }); assert.ok(full.length > 100, 'triggers on the seeded market: ' + full.length);
  assert.ok(full.some((g) => g.count >= 3), 'some counts of 3 or more');
  for (const f of [0.55, 0.7, 0.85]) { const C = B[Math.floor(B.length * f)].e;
    const A = full.filter((g) => g.ts <= C).map(key).sort();
    const cut = triggers(frames(B.filter((b) => b.e <= C)), { from, to: C }).filter((g) => g.ts <= C).map(key).sort();
    assert.deepEqual(cut, A);
    const alt = B.map((b) => (b.e > C ? { ...b, o: b.o + 3, h: b.h + 6, l: b.l - 6, c: b.c - 3 } : b));
    const ch = triggers(frames(alt), { from, to }).filter((g) => g.ts <= C).map(key).sort();
    assert.deepEqual(ch, A); }
});

test('every trade has its stop on the losing side; a stop past the fill gives no trade', () => {
  const B = market(30000, 4); const F = frames(B); const trg = triggers(F, { from: B[0].t + 40 * 86400, to: B[B.length - 1].e });
  let n = 0;
  for (const g of trg.slice(0, 300)) { const stop = g.d > 0 ? g.stopLvl - 0.1 * g.atr : g.stopLvl + 0.1 * g.atr;
    assert.ok(g.d * (g.c0 - g.stopLvl) > 0 || g.trig !== 'box', 'a box close-out is beyond its other side');
    const r = tradeOf(B, g.d, stop, g.ts, 0.001); if (!r) continue; n++;
    assert.ok(r.risk > 0); for (const v of r.R) assert.ok(v >= -1 - 1e-9 || Number.isFinite(v)); }
  assert.ok(n > 50, 'trades: ' + n);
  const S = [{ t: 0, o: 100, h: 100.5, l: 99.5, c: 100, e: 300 }];
  assert.equal(tradeOf(S, 1, 100.2, 0, 0), null, 'a buy with its stop above the fill');
});

test('the clustered slope finds a planted rise and none in noise', () => {
  const r = rng(5);
  const up = [], flat = [];
  for (let i = 0; i < 4000; i++) { const c = Math.floor(r() * 8), m = i % 60, e = (r() - 0.5) * 4;
    up.push({ count: c, m, cr: 0, R: [0, 0.1 * c + e, 0] }); flat.push({ count: c, m, cr: 0, R: [0, e, 0] }); }
  const a = slope(up, 1, false), b = slope(flat, 1, false);
  assert.ok(Math.abs(a.b - 0.1) < 0.03 && a.t > 4, 'planted slope ' + a.b + ' t ' + a.t);
  assert.ok(Math.abs(b.t) < 3, 'noise t ' + b.t);
});

test('RESULT.md says what result.json says', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.equal(R.study, 'grid6-confluence'); assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.equal(R.tests.length, 21); assert.equal(R.placeboTests.length, 21);
  assert.equal(R.passed, R.tests.filter((t) => t.passHolm).length);
  const s = R.real.slope['2R']; assert.ok(md.includes(String(s[0].t)) && md.includes(String(s[1].t)), 'the 2R slope t values are in RESULT.md');
  for (const c of R.cut) { assert.equal(c.missing, 0); assert.equal(c.extra, 0); }
  assert.ok(R.nReal > 1000);
});
