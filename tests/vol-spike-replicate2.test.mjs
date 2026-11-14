// vol-spike-replicate2: the frozen files are byte for byte, the stored result follows from the pre-registered rules,
// the placebo never enters on a signal day, and the report quotes result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { N, E, verdictOf, fisher, pOneSided, placeboTrades, ORIGINAL, BONFERRONI } from '../research/edge/vol-spike-replicate2/run.mjs';
import { signals, rng, MARKETS as US } from '../research/edge/vol-spike-replicate2/frozen.mjs';
import { NEW as R920 } from '../research/edge/vol-spike-replicate2/gate920.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'vol-spike-replicate2');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, f))).digest('hex');
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const MD = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');

test('frozen rule and #920 code are byte for byte', () => {
  assert.equal(sha('frozen.mjs'), '339077aa9b4193eed610095fd75862195cf259c7ed29f78d4a26ac8f71beb8c1');
  assert.equal(sha('gate920.mjs'), '7b723b642a28104d81a0b61f8a0c475b1c337c66246304fadfd60ab30541495d');
});

test('the replication set is disjoint from #860 and #920', () => {
  for (const k of Object.keys(N)) { assert.ok(!(k in US), k); assert.ok(!(k in R920), k); }
  for (const k of Object.keys(US)) assert.equal(E[k].before, '2008-01-01');
  for (const k of Object.keys(R920)) assert.equal(E[k].before, '2005-01-01');
  assert.deepEqual(Object.keys(N).sort(), ['ch20', 'cn50', 'es35', 'in50', 'nl25', 'sg30', 'us2000']);
});

test('gate passed on #920 published figures', () => {
  assert.equal(R.gate.equal, true);
  assert.deepEqual(R.gate.published.R1, { n: 278, avgR: 0.056, t: 1.2 });
  assert.deepEqual(R.gate.published.R2, { n: 303, avgR: -0.022, t: -0.52 });
  assert.deepEqual(R.Q.r2rebuilt, { n: 303, avgR: -0.022 });
});

test('verdict follows the pre-registered bar', () => {
  assert.equal(verdictOf(R.primary.base, R.primary.x2), R.verdict);
  assert.equal(verdictOf({ n: 100, avgR: 0.1, tMonths: 2.1 }, { avgR: 0.01 }), 'REPLICATES');
  assert.equal(verdictOf({ n: 100, avgR: 0.1, tMonths: 1.9 }, { avgR: 0.01 }), 'DOES NOT REPLICATE');
  assert.equal(verdictOf({ n: 100, avgR: 0.1, tMonths: 2.1 }, { avgR: -0.01 }), 'DOES NOT REPLICATE');
  assert.match(verdictOf({ n: 39, avgR: 0.1, tMonths: 3 }, { avgR: 0.1 }), /^NOT MEASURABLE \(inconclusive/);
  assert.equal(R.verdict, 'DOES NOT REPLICATE');
  assert.equal(R.primary.base.n, Object.values(R.markets).reduce((a, m) => a + m.n, 0));
  assert.equal(R.cells.C1.base.n + R.cells.C2.base.n, R.primary.base.n);
});

test('Fisher: the update figure is reproduced and the pre-registered one recomputes', () => {
  assert.ok(Math.abs(fisher([0.0057, pOneSided(-0.52)]).p - 0.02598237694305985) < 1e-9);
  const f = R.fisher.preregistered;
  assert.ok(Math.abs(fisher([ORIGINAL.p, pOneSided(R.Q.base.tTrades)]).p - f.p) < 1e-6);
  assert.equal(f.belowBonferroni, f.p < BONFERRONI);
  assert.ok(Math.abs(BONFERRONI - 0.05 / 333) < 1e-12);
  const all = fisher([ORIGINAL.p, pOneSided(1.2), pOneSided(-0.52), pOneSided(R.cells.C1.base.tTrades), pOneSided(R.cells.C2.base.tTrades)]);
  assert.ok(Math.abs(all.p - R.fisher.allCellsUpperBound.p) < 1e-6);
});

test('placebo never enters on a signal day', () => {
  // a calm path with sharp drops: plenty of signal days
  const D = []; let px = 100; const r = rng(5);
  for (let i = 0; i < 900; i++) { const t = 1104796800 + i * 86400; if ([0, 6].includes(new Date(t * 1000).getUTCDay())) continue;
    const ch = (i % 150 === 140 ? -0.04 : 0.001) + (r() - 0.5) * 0.004; const o = px; px = px * (1 + ch);
    D.push({ time: t, open: o, high: Math.max(o, px) * 1.002, low: Math.min(o, px) * 0.998, close: px }); }
  const sig = signals(D); assert.ok(sig.some(Boolean));
  const tr = placeboTrades(D, 200, 0, [], () => true, rng(9));
  for (const t of tr) assert.equal(sig[t.i - 1], false);
  assert.ok(tr.every((t) => t.exit !== undefined && t.risk > 0));
});

test('placebo and report quote result.json', () => {
  assert.equal(R.placebo.values.length, 40);
  assert.equal(R.placebo.seedFrom, 9001);
  for (const s of [R.primary.base.tMonths, R.primary.base.avgR, R.primary.x2.avgR, R.placebo.p95, R.fisher.preregistered.p.toFixed(4)])
    assert.ok(MD.includes(String(s)), `RESULT.md lacks ${s}`);
  assert.match(MD, /DOES NOT REPLICATE/);
});
