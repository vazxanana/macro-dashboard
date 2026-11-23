// tests/mosha-cf-risk.test.mjs - research/edge/mosha-cf-risk: the desk's sequence code read on closed candles only, the
// study's limit simulator and placebo, and RESULT.md pinned to result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { simLimit, placebo, flip, welch } from '../research/edge/mosha-cf-risk/run.mjs';
import { loadFns } from '../council/mosha-desk.mjs';

const require = createRequire(import.meta.url);
const SOP = require('../assets/mosha-sop.js');
const DIR = new URL('../research/edge/mosha-cf-risk/', import.meta.url);
const cv = (A) => A.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
function m5(n, seed = 5, t0 = Date.UTC(2012, 0, 2) / 1000) {
  const R = K.rng(seed), out = []; let px = 1500, drift = 0;
  for (let i = 0; i < n; i++) { if (i % 400 === 0) drift = (R() - 0.5) * 0.6; const o = px, c = o + drift + (R() - 0.5) * 2.4, h = Math.max(o, c) + R(), l = Math.min(o, c) - R();
    out.push({ t: t0 + i * 300, o, h, l, c, e: t0 + (i + 1) * 300 }); px = c; }
  return out;
}
function frames(M5) {
  const last = M5[M5.length - 1].e, B = { '5m': cv(M5) };
  for (const [tf, s] of [['15m', 900], ['1h', 3600], ['4h', 14400]]) B[tf] = cv(K.resample(M5, s)).filter((b) => b.time + s <= last);
  return B;
}

test('cut test: the low-risk sequence entries known by a moment do not change when later candles change', () => {
  const F = loadFns(), save = SOP.LADDER.slice(); SOP.LADDER.length = 0; SOP.LADDER.push(['4h', '1h']);
  try {
    const A = m5(26000), from = A[8000].t;
    const run = (M) => SOP.sopTrades(frames(M), F, { from, market: 'xau', nest: false, case2: false, cf: 'same' });
    const full = run(A);
    assert.ok(full.filter((r) => !r.retest).length > 0, 'the seeded market gives sequence entries');
    for (const cut of [15000, 21000]) {
      const cutT = A[cut - 1].e, B2 = A.slice(0, cut).concat(m5(26000 - cut, 77, A[cut].t).map((b) => ({ ...b, o: b.o - 1500 + A[cut - 1].c, h: b.h - 1500 + A[cut - 1].c, l: b.l - 1500 + A[cut - 1].c, c: b.c - 1500 + A[cut - 1].c })));
      const pick = (rows) => rows.filter((r) => r.t <= cutT && !r.cfLimit && !r.retest).map((r) => [r.id, r.side, r.entry, r.stop, r.target]);
      assert.deepEqual(pick(run(B2)), pick(full));
    }
    for (const r of full) assert.ok(r.side > 0 ? r.stop < r.entry : r.stop > r.entry, 'stop on the losing side');
  } finally { SOP.LADDER.length = 0; SOP.LADDER.push(...save); }
});

test('the limit at the CF line: stop past the far side, filled on 5-minute candles, the fill candle only stops it', () => {
  const C = [0, 1, 2, 3].map((i) => ({ time: 3600 * i, open: 10, high: 10.5, low: 9.5, close: 10 }));
  const fine = [];
  for (let i = 0; i < 48; i++) fine.push({ time: 300 * i, open: 10.2, high: 10.3, low: 10.1, close: 10.2 });
  fine[14] = { time: 4200, open: 10.1, high: 30, low: 9.9, close: 10 };   // fills at the line (10) in candle 1; its high is above the target: not counted
  const z = { dir: 1, lo: 9.5, hi: 10, tgt: 12, known: 3600, kind: 'cf' };
  const tr = simLimit(SOP, 'xau', z, C, 3600, fine);
  assert.equal(tr.entry, 10); assert.equal(tr.t, 4200); assert.ok(tr.stop < 9.5);
  assert.notEqual(tr.status, 'target');
  assert.equal(simLimit(SOP, 'xau', { ...z, tgt: 9.8 }, C, 3600, fine), null);   // a target on the wrong side: no order
});

test('the placebo keeps side, stop and target distances; the flip mirrors them', () => {
  const A = m5(4000), B = frames(A), Cc = B['1h'], fine = B['5m'], tr = { side: 1, entry: Cc[200].close, stop: Cc[200].close - 3, target: Cc[200].close + 6, t: Cc[200].time + 3600 };
  const p = placebo(SOP, tr, Cc, 3600, fine, K.rng(1), 'eg');
  assert.equal(p.side, 1); assert.ok(Math.abs(p.entry - p.stop - 3) < 1e-9); assert.ok(Math.abs(p.target - p.entry - 6) < 1e-9); assert.ok(p.t < tr.t);
  const f = flip(SOP, tr, fine); assert.equal(f.side, -1); assert.ok(f.stop > f.entry && f.target < f.entry);
  assert.ok(Math.abs(welch([1, 2, 3, 4], [0, 1, 2, 3]).diff - 1) < 1e-9);
});

test('RESULT.md is pinned to result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.match(md.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + R.verdict + '\\.'));
  const f = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);
  for (const s of [String(R.T1.all.n), f(R.T1.all.meanR), String(R.T1.all.tMonth).replace('-', '−'), String(R.T3.all.n), f(R.T3.all.meanR), String(R.T2.high.all.n), f(R.T2.high.all.meanR)]) assert.ok(md.includes(s), 'RESULT.md lacks ' + s);
  assert.ok(R.headline && R.T1 && R.T2 && R.T3 && R.T3.gate);
  assert.ok(fs.existsSync(new URL('PREREGISTRATION.md', DIR)));
});
