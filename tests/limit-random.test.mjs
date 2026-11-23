// tests/limit-random.test.mjs - research/edge/limit-random: seeded random resting limits, stops on the losing side, no
// look-ahead in the orders, RESULT.md pinned to result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectCandles, randomTrades, atr14, PICK, FROM, TO } from '../research/edge/limit-random/run.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import * as K from '../research/edge/_lib/edgekit.mjs';

const DIR = new URL('../research/edge/limit-random/', import.meta.url);
function m5(n, seed = 3, t0 = FROM - 20 * 86400) {
  const R = K.rng(seed), out = []; let px = 1.1;
  for (let i = 0; i < n; i++) { const o = px, c = o + (R() - 0.5) * 0.0008, h = Math.max(o, c) + R() * 0.0003, l = Math.min(o, c) - R() * 0.0003;
    out.push({ t: t0 + i * 300, o, h, l, c, e: t0 + (i + 1) * 300 }); px = c; }
  return out;
}

test('selection is seeded and about one H1 candle in four', () => {
  const H = frames(m5(40000))['1h'];
  const a = selectCandles(H, 11, -Infinity, Infinity), b = selectCandles(H, 11, -Infinity, Infinity);
  assert.deepEqual(a, b);
  const share = a.length / (H.length - 15); assert.ok(Math.abs(share - PICK) < 0.05, 'share ' + share);
});

test('orders: both sides, stop on the losing side, fill after the H1 close, rows do not depend on later prices', () => {
  const M5 = m5(40000), H = frames(M5)['1h'], picks = selectCandles(H, 5, -Infinity, Infinity);
  const run = (bars, hh) => randomTrades('eurusd', bars, hh, picks, 1.2, () => 0.5, -Infinity, Infinity).rows;
  const rows = run(M5, H);
  assert.ok(rows.length > 100);
  assert.ok(rows.some((r) => r.side > 0) && rows.some((r) => r.side < 0));
  const closes = new Set(picks.map((i) => H[i].e));
  for (const r of rows) assert.ok([...closes].some((e) => r.t >= e && r.t < e + 12 * 300), 'fill inside the 12-candle life');
  // cut: change every price after a moment; trades closed (2-day limit) before it stay the same
  const cut = M5[25000].t, M2 = M5.slice(0, 25000).concat(m5(15000, 77, cut));
  const H2 = frames(M2)['1h'];
  const early = (rs) => rs.filter((r) => r.t + 2 * 86400 + 12 * 300 < cut);
  assert.deepEqual(early(run(M2, H2)), early(rows));
  const A = atr14(H); assert.ok(A[20] > 0);
});

test('RESULT.md agrees with result.json', { skip: !fs.existsSync(new URL('result.json', DIR)) }, () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const lines = md.split('\n');
  assert.match(lines[2], new RegExp('^\\*\\*Verdict: ' + r.verdict + '\\.'));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(r.verdict));
  assert.ok(r.headline && r.headline.length > 20);
  for (const k of ['dom', 'rnd']) assert.ok(md.includes(r.pooled[k].trail.n.toLocaleString('en-GB')), k + ' n in RESULT.md');
  for (const v of [r.T1.early.tBefore, r.T1.late.tBefore, r.T2.t]) assert.ok(md.includes(String(v)), 't ' + v + ' in RESULT.md');
  assert.equal(r.verdict, r.passes[0] ? 'PASS' : 'FAIL');
  assert.ok(TO > FROM);
});
