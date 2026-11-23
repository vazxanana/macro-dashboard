// tests/grid6-phase-trigger.test.mjs - research/edge/grid6-phase-trigger: no look-ahead (cut test on seeded candles), stops on
// the losing side, the context on tails equals readPhase on the whole series, the cell index, the collapse rule, and RESULT.md
// pinned to result.json. Offline: no candle cache needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { readPhase } from '../research/edge/_lib/phase.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import * as G from '../research/edge/grid6-phase-trigger/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'grid6-phase-trigger');
const T0 = Date.UTC(2010, 0, 4) / 1000;

function seeded(days = 60, seed = 5) {
  const r = K.rng(seed), out = []; let p = 100;
  for (let i = 0; i < 288 * days; i++) {
    const t = T0 + i * 300; if (new Date(t * 1000).getUTCDay() === 6) continue;
    const o = p; p += (r() - 0.5) * 0.12 + 0.002 * Math.sin(i / 400);
    out.push({ t, o, h: Math.max(o, p) + r() * 0.05, l: Math.min(o, p) - r() * 0.05, c: p, e: t + 300 });
  }
  return out;
}

test('cell index round trip and stage levels', () => {
  assert.equal(G.ALL_LEVELS.length, 45);
  const kept = G.ALL_LEVELS, NC = kept.length * 3 * 3 * 4 * 4 * 5, seen = new Set();
  for (let lv = 0; lv < kept.length; lv++) for (let sd = 0; sd < 3; sd++) for (let ps = 0; ps < 3; ps++) for (let tg = 0; tg < 4; tg++)
    for (let ss = 0; ss < 4; ss++) for (let x = 0; x < 5; x++) {
      const c = G.cellIndex(lv, sd, ps, tg, ss, x); seen.add(c);
      const n = G.cellName(c, kept); assert.equal(n.stage, kept[lv].name); assert.equal(n.exit, G.EXITS[x]); assert.equal(n.trigger, G.TRIGS[tg]);
    }
  assert.equal(seen.size, NC); assert.equal(Math.max(...seen), NC - 1);
  // a context belongs to any, three singles and one pair of each kind
  const lv = G.levelsOf([0, 1, 2], kept).map((i) => kept[i].name);
  assert.deepEqual(lv, ['any', 'D1 move', 'H4 pullback', 'H1 continuation', 'H4 pullback + H1 continuation', 'D1 move + H4 pullback']);
});

test('collapse rule keeps a pair only at 3% or more of the discovery H1 closes', () => {
  const pairs = new Array(32).fill(0); pairs[0] = 50; pairs[1] = 2; pairs[16] = 48;
  const { kept, dropped } = G.keptLevels([{ n: 100, pairs }]);
  assert.ok(kept.some((L) => L.name === 'H4 move + H1 move'));
  assert.ok(dropped.some((L) => L.name === 'H4 move + H1 pullback'));
  assert.ok(kept.some((L) => L.name === 'D1 move + H4 move'));
  assert.equal(kept.filter((L) => !L.pair).length, 13);
});

test('no look-ahead: trades built on cut candles equal the full run up to the cut', () => {
  const M5 = seeded(), cost = 0.01;
  const full = G.tradesOf(M5, frames(M5), cost, { from: T0 + 20 * 86400 }).rows;
  const cut = T0 + 45 * 86400, M5c = M5.filter((b) => b.e <= cut);
  const part = G.tradesOf(M5c, frames(M5c), cost, { from: T0 + 20 * 86400 }).rows;
  const key = (r) => [r.tg, r.tc, r.d].join('|');
  const done = (r) => r.tc + G.CAP + 3600 < cut;
  const A = new Map(full.filter(done).map((r) => [key(r), r])), B = new Map(part.filter(done).map((r) => [key(r), r]));
  assert.ok(A.size > 200, 'enough trades to compare: ' + A.size);
  assert.equal(B.size, A.size);
  for (const [k, a] of A) { const b = B.get(k); assert.ok(b, k);
    assert.deepEqual(b.st, a.st); assert.equal(b.sd, a.sd); assert.equal(b.ps, a.ps); assert.equal(b.ss, a.ss);
    assert.deepEqual(b.o && b.o.R, a.o && a.o.R); assert.deepEqual(b.p && b.p.R, a.p && a.p.R); }
});

test('every trade has its stop on the losing side; the far exit is dropped under 0.5R', () => {
  const M5 = seeded(30, 9);
  const { rows } = G.tradesOf(M5, frames(M5), 0.01, { from: T0 + 10 * 86400 });
  assert.ok(rows.length > 100);
  for (const r of rows) for (const tr of [r.o, r.p]) if (tr) { assert.ok(tr.risk > 0); for (const x of [0, 1, 2, 4]) assert.ok(Number.isFinite(tr.R[x])); }
  // a far side 0.2R away is not a target
  const bars = []; for (let i = 0; i < 700; i++) bars.push({ t: i * 300, o: 100, h: 100.05, l: 99.95, c: 100, e: i * 300 + 300 });
  const tr = G.tradeOne(bars, 1, 99, 0, 100.2, 0.01); assert.ok(Number.isNaN(tr.R[3]));
  const tr2 = G.tradeOne(bars, 1, 99, 0, 102, 0.01); assert.ok(Number.isFinite(tr2.R[3]));
});

test('context on tails equals readPhase on the whole series', () => {
  const M5 = seeded(120, 2), F = frames(M5);
  for (const t of [T0 + 60 * 86400 + 3600, T0 + 90 * 86400 + 7200, T0 + 115 * 86400]) {
    const a = G.contextAt(F, t);
    const ph = readPhase({ '1d': F['1d'], '4h': F['4h'], '1h': F['1h'], '15m': F['15m'], '5m': [] }, t);
    assert.deepEqual(a.st, ['1d', '4h', '1h'].map((k) => G.STAGE.indexOf(ph.tf[k].stage)));
    assert.equal(a.side, ph.tf['4h'].side); assert.equal(a.half, ph.tf['4h'].half);
  }
});

test('RESULT.md is pinned to result.json', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.match(md.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + res.verdict + '\\. '));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(res.verdict));
  assert.equal(typeof res.headline, 'string');
  assert.equal(res.cells, res.stageLevels.length * 3 * 3 * 4 * 4 * 5 * 6);
  const c = res.counts;
  for (const x of [c.discovery, c.raw, c.holm, c.placebo.discovery, c.placebo.raw, res.cells]) assert.ok(md.includes(String(x.toLocaleString('en-GB'))), 'count ' + x);
  assert.equal(res.verdict, res.reach100 < 100 ? 'INCONCLUSIVE' : c.holmNotPlacebo > 0 ? 'PASS' : 'FAIL');
});
