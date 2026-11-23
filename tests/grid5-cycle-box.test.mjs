// tests/grid5-cycle-box.test.mjs - research/edge/grid5-cycle-box: no look-ahead (cut test on seeded candles), stops on the
// losing side, the phase reading on tails equals readPhase on the whole series, the cell index, and RESULT.md pinned to
// result.json. Offline: no candle cache needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { readPhase } from '../research/edge/_lib/phase.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import * as G from '../research/edge/grid5-cycle-box/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'grid5-cycle-box');

function seeded(days = 90, seed = 5) {
  const r = K.rng(seed), out = []; let p = 100; const t0 = Date.UTC(2010, 0, 4) / 1000;
  for (let i = 0; i < 288 * days; i++) {
    const t = t0 + i * 300; if (new Date(t * 1000).getUTCDay() === 6) continue;
    const o = p; p += (r() - 0.5) * 0.12 + 0.002 * Math.sin(i / 400);
    out.push({ t, o, h: Math.max(o, p) + r() * 0.05, l: Math.min(o, p) - r() * 0.05, c: p, e: t + 300 });
  }
  return out;
}
const T0 = Date.UTC(2010, 0, 4) / 1000;

test('cell index round trip', () => {
  assert.equal(G.NC, 2160);
  const seen = new Set();
  for (let ch = 0; ch < 3; ch++) for (let sg = 0; sg < 4; sg++) for (let sd = 0; sd < 3; sd++) for (let ev = 0; ev < 3; ev++)
    for (let e = 0; e < 2; e++) for (let st = 0; st < 2; st++) for (let x = 0; x < 5; x++) {
      const c = G.cellIndex(ch, sg, sd, ev, e, st, x); seen.add(c);
      const n = G.cellName(c); assert.equal(n.exit, G.EXITS[x]); assert.equal(n.stage, G.STAGES[sg]); assert.equal(n.chain, G.CHAINS[ch].join('>'));
    }
  assert.equal(seen.size, G.NC);
});

test('no look-ahead: trades built on cut candles equal the full run up to the cut', () => {
  const M5 = seeded(), cost = 0.01;
  const full = G.tradesOf(M5, frames(M5), cost, { from: T0 });
  const cut = T0 + 50 * 86400, M5c = M5.filter((b) => b.e <= cut);
  const part = G.tradesOf(M5c, frames(M5c), cost, { from: T0 });
  const key = (r) => [r.ch, r.ev, r.e, r.st, r.tc].join('|');
  const done = (r) => r.tc + G.CAP[G.CHAINS[r.ch][1]] + 13 * K.TF[G.CHAINS[r.ch][1]] < cut;
  const A = new Map(full.filter(done).map((r) => [key(r), r])), B = new Map(part.filter(done).map((r) => [key(r), r]));
  assert.ok(A.size > 200, 'enough trades to compare: ' + A.size);
  assert.equal(B.size, A.size);
  for (const [k, a] of A) { const b = B.get(k); assert.ok(b, k);
    assert.equal(b.sg, a.sg); assert.equal(b.sd, a.sd); assert.equal(b.d, a.d);
    assert.deepEqual(b.o && b.o.R, a.o && a.o.R); assert.deepEqual(b.p && b.p.R, a.p && a.p.R); }
});

test('every trade has its stop on the losing side; limits never fill on a mere touch', () => {
  const M5 = seeded(40, 9);
  const rows = G.tradesOf(M5, frames(M5), 0.01, { from: T0 });
  for (const r of rows) for (const tr of [r.o, r.p]) if (tr) { assert.ok(tr.risk > 0); assert.ok(tr.R.every(Number.isFinite)); }
  // trade-through: a buy limit at 100 with a candle low exactly 100 does not fill; 100 - cost / 2 does
  const bars = [{ t: 0, o: 101, h: 101.2, l: 100, c: 100.8, e: 300 }, { t: 300, o: 100.8, h: 101, l: 99.995, c: 100.5, e: 600 },
    { t: 600, o: 100.5, h: 103, l: 100.4, c: 102.9, e: 900 }];
  for (let i = 3; i < 700; i++) bars.push({ t: i * 300, o: 102.9, h: 103, l: 102.8, c: 102.9, e: i * 300 + 300 });
  const tr = G.tradeOne(bars, 1, 'lim', 100, 99, 0, 900, 86400, 2, 0.01);
  assert.equal(tr.t, 300);
});

test('phase reading on tails equals readPhase on the whole series', () => {
  const M5 = seeded(120, 2), F = frames(M5);
  for (const t of [T0 + 60 * 86400 + 3600, T0 + 90 * 86400 + 7200, T0 + 115 * 86400]) {
    for (const ch of G.CHAINS) {
      const a = G.phaseAt(F, ch, t);
      const by = {}; for (const k of ['1d', '4h', '1h', '15m', '5m']) by[k] = ch.includes(k) || G.ABOVE_U[ch[0]] === k ? F[k] : [];
      const ph = readPhase(by, t);
      assert.equal(a.stage, ph.tf[ch[0]].stage); assert.equal(a.side, ph.tf[ch[0]].side);
    }
  }
});

test('RESULT.md is pinned to result.json', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.match(md.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + res.verdict + '\\. '));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(res.verdict));
  assert.equal(typeof res.headline, 'string');
  assert.equal(res.cells, 12960);
  const c = res.counts;
  for (const x of [c.discovery, c.raw, c.holm, c.placebo.discovery, c.placebo.raw]) assert.ok(md.includes(String(x.toLocaleString('en-GB'))), 'count ' + x);
  assert.equal(res.verdict, res.reach100 < 100 ? 'INCONCLUSIVE' : c.holmNotPlacebo > 0 ? 'PASS' : 'FAIL');
});
