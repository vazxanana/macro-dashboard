// tests/msnr-direction-wide.test.mjs - the MSNR direction call on ten markets: pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, the measures on hand-made candles, and the cut test. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { framesOf, ladder, measure, monthT, judge, cutCheck, monthOf, LADDERS, NM } from '../research/edge/msnr-direction-wide/run.mjs';

const DIR = new URL('../research/edge/msnr-direction-wide/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

// a seeded random walk of H1 candles (weekdays only)
function walk(n, seed = 3, from = Date.UTC(2005, 0, 3) / 1000) {
  let s = seed, px = 100; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648), out = [];
  for (let t = from; out.length < n; t += 3600) { const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const o = px, c = o * Math.exp((r() - 0.5) * 0.006), h = Math.max(o, c) * (1 + r() * 0.002), l = Math.min(o, c) * (1 - r() * 0.002);
    out.push({ t, o, h, l, c, e: t + 3600 }); px = c; }
  return out;
}

test('pre-registration names the ladders, the windows, the nine tests and the bar', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['LH', 'L4', 'LD', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'nine', 't >= 2', 'cut test', 'direction(']) assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(Object.keys(R.tests).length, 9);
  for (const [k, T] of Object.entries(R.tests)) assert.equal(T.pass, T.a.mean > 0 && T.a.t >= 2 && T.b.mean > 0 && T.b.t >= 2 && T.pHolm < 0.05, k);
  const copy = JSON.parse(JSON.stringify(R.tests)); assert.equal(judge(copy), R.verdict);
  assert.equal(R.markets.length, 10);
  assert.equal(R.cut.mismatches, 0); assert.ok(R.cut.checked > 1000);
});

test('RESULT.md lists the nine tests with their figures from result.json', () => {
  for (const [k, T] of Object.entries(R.tests)) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${k} |`)); assert.ok(row, k);
    for (const t of [T.a.t, T.b.t]) assert.ok(row.includes(Math.abs(t).toFixed(2)), `${k} ${t}`);
  }
});

test('measures: a call that is right every time scores, a constant call in a flat walk does not', () => {
  const H1 = walk(4000), F = framesOf(H1);
  const lad = ladder(F, 'LH'), n = lad.work.length;
  // an oracle call: the sign of the next 5-candle move
  const oracle = { ...lad, call: Int8Array.from({ length: n }, (_, i) => (i + 5 < n ? Math.sign(lad.work[i + 5].c - lad.work[i].c) : 0)), events: [] };
  const M = measure(oracle); assert.ok(M.a[5].x.sum > 0); assert.ok(M.a[5].hit > 0.95);
  const flat = { ...lad, call: new Int8Array(n).fill(1), events: [] };
  const Z = measure(flat); assert.ok(Math.abs(Z.a[5].x.sum / Z.a[5].x.n) < 0.05);   // excess against the window mean: zero by construction for a constant call (up to scaling)
  assert.ok(Math.abs(Z.a[5].hit - Z.a[5].base) < 1e-9);
});

test('month sums: t over every month of the window, empty months as zero', () => {
  const ms = new Float64Array(NM); for (let j = 0; j < 120; j++) ms[j] = j % 2 ? 1 : 0.5;
  assert.ok(monthT(ms, 'a') > 10); assert.equal(monthT(new Float64Array(NM), 'a'), null);
  assert.equal(monthOf(Date.UTC(2015, 0, 15) / 1000), 120);
});

test('no look-ahead: calls of candles closed by a cut equal the full series', () => {
  const H1 = walk(6000, 11), c = cutCheck(H1, [H1[1500].t + 1800, H1[3333].t, H1[5000].t + 600]);
  assert.equal(c.mismatches, 0); assert.ok(c.checked > 5000);
  assert.deepEqual(Object.keys(LADDERS), ['LH', 'L4', 'LD']);
});
