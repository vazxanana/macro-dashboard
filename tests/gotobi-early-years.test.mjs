// gotobi-early-years: the frozen rule is byte for byte the gotobi study's run.mjs (as gotobi-cost froze it), run.mjs changes
// only the markets and years, the costs and Fisher are the pre-registered ones, and RESULT.md says what result.json holds.
// Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/gotobi-early-years/frozen.mjs';
import * as R from '../research/edge/gotobi-early-years/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gotobi-early-years');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
// sha256 of research/edge/gotobi-cost/frozen.mjs (= research/edge/gotobi/run.mjs at commit 5f341e069 of branch gotobi)
const FROZEN_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';

test('gotobi-early-years: frozen.mjs is the frozen rule byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA);
  assert.match(read('PREREGISTRATION.md'), new RegExp(FROZEN_SHA));
});

test('gotobi-early-years: run.mjs re-implements nothing of the rule; only the markets and years differ', () => {
  const src = read('run.mjs').replace(/\/\/[^\n]*/g, '');
  assert.match(read('run.mjs'), /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['trade', 'stopDist', 'windowMove', 'legTimes', 'entryPx', 'exitPx', 'costPx', 'gotobiOfMonth', 'gotobiSet', 'jpHolidays', 'tseHolidays', 'monthT', 'draw', 'mulberry32', 'summary'])
    assert.doesNotMatch(src, new RegExp(`(function\\s+${fn}\\b|(const|let)\\s+${fn}\\s*=)`), `run.mjs defines ${fn}`);
  for (const k of ['0.003', '22.5e-6', '1.5 \\*', 'STOP_K =', 'LOOKBACK =']) assert.doesNotMatch(src, new RegExp(`(^|[^.\\w])${k}`, 'm'));
  const t2 = F.TESTS.find((x) => x.id === 'T2');
  assert.deepEqual({ pair: t2.pair, leg: t2.leg }, { pair: R.ORIGINAL.pair, leg: R.ORIGINAL.leg });
  assert.equal(R.LEG, 'fade');
  assert.deepEqual(Object.keys(R.CROSSES), ['eurjpy', 'gbpjpy', 'audjpy', 'cadjpy', 'chfjpy', 'nzdjpy']);
  assert.equal(R.U_WINDOW[1], '2009-12-31');
  assert.equal(R.T_BAR, F.T_BAR); assert.equal(R.SEEDS, F.SEEDS); assert.equal(R.P_RANK, F.P_RANK);
});

function path5m(seed = 7, from = '2005-01-03', to = '2005-07-30') {
  const rnd = F.mulberry32(seed), out = []; let px = 140;
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; t < Date.parse(to + 'T00:00:00Z') / 1000; t += 300) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 6 || (w === 0 && t % 86400 < 22 * 3600)) continue;
    if (rnd() < 0.01) continue;
    const o = px, c = o + (rnd() - 0.5) * 0.06; px = c;
    out.push([t, o, Math.max(o, c) + rnd() * 0.02, Math.min(o, c) - rnd() * 0.02, c]);
  }
  return out;
}

test('gotobi-early-years: runLeg gives the frozen trades, on full and on 00:00-06:55 UTC candles', () => {
  const bars = path5m(), ix = F.index(bars), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, 'fade', d)); return moves.get(d); };
  const run = R.runLeg(bars, '2005-01-03', '2005-07-28');
  assert.ok(run.got.length > 30);
  for (const t of run.got) assert.deepEqual(t, F.trade(ix, 'fade', t.day, F.stopDist(moveOf, t.day)));
  assert.deepEqual(R.runLeg(bars.filter((b) => b[0] % 86400 < 7 * 3600), '2005-01-03', '2005-07-28').got, run.got);
  assert.ok(run.pool.every((t) => !run.G.has(t.day)) && run.got.every((t) => run.G.has(t.day)));
  // every trade has a stop on the losing side of its entry
  for (const t of run.got) assert.ok(t.stop > t.entry && t.D > 0);
});

test('gotobi-early-years: costs at 0 / base / 2 x and the published x are the frozen formula', () => {
  const run = R.runLeg(path5m(3), '2005-01-03', '2005-07-28');
  for (const t of run.got) {
    assert.ok(Math.abs(R.atMult(1)(t) - t.net) < 1e-12);
    assert.ok(Math.abs(R.atMult(0)(t) - t.R) < 1e-12);
    assert.ok(Math.abs(R.atMult(2)(t) - (t.R - 2 * t.costR)) < 1e-12);
    assert.ok(Math.abs(R.atX(1.3)(t) - t.net) < 1e-12);   // x = 1.30 pips is the frozen costPx
  }
  assert.equal(R.pubOf('gbpjpy', 0.5), 0.49 + 1);
  assert.equal(R.pubOf('eurjpy', 0), 1.39);                 // no published figure: the stand-in, the largest cross figure
  assert.equal(R.PUB_STANDIN, 1.39);
});

test('gotobi-early-years: drawdown, placebo and Fisher (the ledger reproduced)', () => {
  const tr = [1, -2, 0.5, -1, 3].map((r, i) => ({ entryT: i, pair: 'x', R: r, costR: 0, day: '2005-01-0' + (i + 1) }));
  assert.equal(R.worstDD(tr, R.atMult(0)), 2.5);
  const f = R.fisher([R.pOneSided(2.74), R.pOneSided(3.8)]);
  assert.ok(Math.abs(f.p - R.LEDGER.calendarDisjointP) / R.LEDGER.calendarDisjointP < 1e-9);
  const b = R.fisherBlock(1.0);
  assert.equal(b.calendarDisjoint.weaker, b.calendarDisjoint.withU);   // a weak U makes the pairing with U the weaker
  const b2 = R.fisherBlock(10);
  assert.equal(b2.calendarDisjoint.weaker, b2.calendarDisjoint.withR2);
  const run = R.runLeg(path5m(5), '2005-01-03', '2005-07-28');
  const pl = R.placebo([{ pool: run.pool, n: 5 }]);
  assert.equal(pl.values.length, 40);
  assert.equal(pl.values[0], Math.round(F.draw(run.pool, 5, 1).reduce((s, t) => s + t.net, 0) / 5 * 1e4) / 1e4);
});

test('gotobi-early-years: the verdict rule', () => {
  const g = { pass: true, summary: {} };
  const U = (net, t, x2, enough = true) => ({ enough, pooled: { all: { n: 2000 } }, pass: net > 0 && t >= 2 && x2 > 0 });
  assert.equal(R.verdictOf(g, U(0.1, 2.5, 0.01)), 'REPLICATES');
  assert.equal(R.verdictOf(g, U(0.1, 1.9, 0.01)), 'DOES NOT REPLICATE');
  assert.equal(R.verdictOf(g, U(0.1, 2.5, -0.01)), 'DOES NOT REPLICATE');
  assert.match(R.verdictOf(g, U(0.1, 2.5, 0.01, false)), /^NOT MEASURABLE \(inconclusive: /);
  assert.match(R.verdictOf({ pass: false, summary: { n: 1, netR: 0, t: 0 } }, null), /^NOT MEASURABLE \(inconclusive: the gate failed/);
});

test('gotobi-early-years: result.json and RESULT.md agree, and the gate reproduced #878', () => {
  const o = JSON.parse(read('result.json')), md = read('RESULT.md');
  assert.equal(o.gate.pass, true);
  assert.deepEqual([o.gate.summary.n, o.gate.summary.netR.toFixed(3), o.gate.summary.t.toFixed(2)], [771, '0.148', '2.74']);
  assert.ok(md.includes(`**Verdict: ${o.verdict}.**`));
  const C = o.u.pooled.costs;
  assert.equal(o.u.pass, C.base.meanR > 0 && C.base.monthT >= 2 && C.x2.meanR > 0);
  assert.equal(o.verdict, o.u.enough ? (o.u.pass ? 'REPLICATES' : 'DOES NOT REPLICATE') : o.verdict);
  const f = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  for (const s of [C.gross, C.base, C.x2]) assert.ok(md.includes(`| ${s.n} | ${f(s.meanR)} | ${f(s.tradeT, 2)} | ${f(s.monthT, 2)} |`));
  assert.ok(md.includes('not a net edge'));
  assert.ok(Math.abs(o.fisher.calendarDisjoint.withR2.p - R.LEDGER.calendarDisjointP) < 1e-12);
  // the six crosses' first candles are no earlier than 2004-12 and no trade lies after 2009
  for (const c of Object.values(o.u.crosses)) {
    assert.ok(c.firstCandle >= '2004-12-01');
    assert.ok(Object.keys(c.byYear).every((y) => y >= '2005' && y <= '2009'));
  }
});
