// gotobi-replicate: the frozen rule is byte for byte the gotobi study's run.mjs, run.mjs changes only the market list (and
// R2's years), costs per cross are the frozen formula, and RESULT.md says what result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/gotobi-replicate/frozen.mjs';
import * as R from '../research/edge/gotobi-replicate/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gotobi-replicate');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
// sha256 of research/edge/gotobi/run.mjs at commit 5f341e069 of branch gotobi
const FROZEN_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';

test('gotobi-replicate: frozen.mjs is the original run.mjs byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA);
  assert.match(read('PREREGISTRATION.md'), new RegExp(FROZEN_SHA));
});

test('gotobi-replicate: run.mjs re-implements nothing of the rule; only the market list differs', () => {
  const src = read('run.mjs').replace(/\/\/[^\n]*/g, '');   // code only, comments out
  assert.match(read('run.mjs'), /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['trade', 'stopDist', 'windowMove', 'legTimes', 'entryPx', 'exitPx', 'costPx', 'gotobiOfMonth', 'gotobiSet', 'jpHolidays', 'tseHolidays', 'monthT', 'draw', 'mulberry32', 'holm'])
    assert.doesNotMatch(src, new RegExp(`(function\\s+${fn}\\b|(const|let)\\s+${fn}\\s*=)`), `run.mjs defines ${fn}`);
  for (const k of ['0.003', '22.5e-6', '1.5 \\*', 'STOP_K =', 'LOOKBACK =']) assert.doesNotMatch(src, new RegExp(`(^|[^.\\w])${k}`, 'm'));
  // the leg is the original's T2
  const t2 = F.TESTS.find((x) => x.id === 'T2');
  assert.deepEqual({ pair: t2.pair, leg: t2.leg }, { pair: R.ORIGINAL.pair, leg: R.ORIGINAL.leg });
  assert.equal(R.LEG, t2.leg);
  // the market list: four crosses, none of the original's pairs
  assert.deepEqual(Object.keys(R.CROSSES), ['gbpjpy', 'audjpy', 'cadjpy', 'chfjpy']);
  for (const k of Object.keys(R.CROSSES)) assert.ok(!(k in F.PAIRS));
  // the bars and the statistics constants are the frozen ones
  assert.equal(R.T_BAR, F.T_BAR); assert.equal(R.SEEDS, F.SEEDS); assert.equal(R.P_RANK, F.P_RANK);
  assert.equal(R.R1_WINDOW[0], F.REPLICATION[0]);
  assert.equal(R.R2_WINDOW[1], '2009-12-31');
});

test('gotobi-replicate: costs per cross are the frozen formula (0.3 pip assumed, 0.5 slippage, 22.5e-6 x price a side)', () => {
  for (const [k, c] of Object.entries(R.COSTS)) {
    assert.deepEqual(c, { spreadPips: 0.3, slipPipsASide: 0.5, commissionASide: 22.5e-6, pip: 0.01, spreadMeasured: false }, k);
    for (const px of [80, 150, 200]) {
      const mine = c.spreadPips * c.pip + 2 * c.slipPipsASide * c.pip + 2 * c.commissionASide * px;
      assert.ok(Math.abs(mine - F.costPx(px)) < 1e-12, `${k} ${px}`);
    }
  }
});

// a deterministic M5 path, 2009-11-01 -> 2010-04-30
function path5m(seed = 7) {
  const rnd = F.mulberry32(seed), out = []; let px = 140;
  for (let t = Date.parse('2009-11-01T00:00:00Z') / 1000; t < Date.parse('2010-04-30T00:00:00Z') / 1000; t += 300) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 6 || (w === 0 && t % 86400 < 22 * 3600)) continue;
    if (rnd() < 0.01) continue;   // a few holes
    const o = px, c = o + (rnd() - 0.5) * 0.06; px = c;
    out.push([t, o, Math.max(o, c) + rnd() * 0.02, Math.min(o, c) - rnd() * 0.02, c]);
  }
  return out;
}

test('gotobi-replicate: runLeg gives the frozen runPair trades, on full and on 00:00-06:55 UTC candles', () => {
  const bars = path5m(), last = '2010-04-28';
  const { G, all } = F.runPair(bars, 'fade', last);
  const want = [...all.values()].filter((t) => G.has(t.day));
  assert.ok(want.length > 20);
  const got = R.runLeg(bars, '2010-01-01', last).got;
  assert.deepEqual(got, want);
  const cut = R.runLeg(bars.filter((b) => b[0] % 86400 < 7 * 3600), '2010-01-01', last).got;
  assert.deepEqual(cut, want);
  // the placebo pool excludes every gotobi day and uses the frozen draw
  const run = R.runLeg(bars, '2010-01-01', last);
  assert.ok(run.pool.every((t) => !run.G.has(t.day)));
  const pl = R.placebo([{ pool: run.pool, n: 5 }]);
  assert.equal(pl.values.length, 40);
  assert.equal(pl.values[0], Math.round(F.draw(run.pool, 5, 1).reduce((s, t) => s + t.net, 0) / 5 * 1e4) / 1e4);
});

test('gotobi-replicate: RESULT.md matches result.json, verdict first', () => {
  const j = JSON.parse(read('result.json')), md = read('RESULT.md');
  const fmt = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
  assert.equal(md, R.report(j));
  assert.equal(j.verdict, R.verdictOf(j.r1, j.r2));
  const lines = md.split('\n').filter(Boolean);
  assert.ok(lines[1].startsWith(`**Verdict: ${j.verdict}.**`));
  const P = j.r1.pooled.all;
  assert.match(md, new RegExp(`n ${P.n}, ${fmt(P.netR).replace('+', '\\+')}R a trade net, month t ${fmt(P.t, 2).replace('+', '\\+')}`));
  for (const c of Object.values(j.r1.crosses)) assert.ok(md.includes(`| ${c.pair} | 2010-now | ${c.all.n} | ${fmt(c.all.netR)} |`), c.pair);
  assert.ok(md.includes(`| **R2 USD/JPY** |`) && md.includes(`| ${j.r2.all.n} | ${fmt(j.r2.all.netR)} |`));
  // the checks are what the numbers say
  assert.equal(j.r1.checks.pooledNetPositive, P.netR > 0);
  assert.equal(j.r1.checks.pooledMonthT, P.t >= 2);
  assert.equal(j.r1.checks.crossesPositive, Object.values(j.r1.crosses).filter((c) => c.all.netR > 0).length >= 3);
  assert.equal(j.r1.checks.placebo, P.netR > [...j.r1.placebo.values].sort((a, b) => a - b)[39 - 2]);
  assert.equal(j.r2.pass, j.r2.all.netR > 0 && j.r2.all.t >= 1.5);
  // the gate reproduced the original T2
  assert.equal(j.gate.decisive.n, 771);
  assert.equal(Math.round(j.gate.decisive.netR * 1000) / 1000, 0.148);
  assert.equal(j.gate.decisive.t, 2.74);
});
