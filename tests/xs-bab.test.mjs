// research/edge/xs-bab: the beta, shrinkage and halves on a hand-made panel, no look-ahead, the equal-beta legs and the cap,
// the stop and costs, the FX inversion, Holm, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  P, GROUPS, INVERT, groupAverage, betaAt, shrink, rankAt, bookOf, legOf, monthEnds, monthOf, invertBars, halfCostFn,
  nightRateFn, combine, netOf, holm, statsOf,
} from '../research/edge/xs-bab/run.mjs';
import { nights } from '../council/fills.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../research/edge/xs-bab');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const T0 = Date.UTC(2010, 0, 4) / 1000;

// a common factor f_k (deterministic, zero mean) and market j = beta_j x f_k + a small own wiggle
const fac = (k) => 0.01 * Math.sin(k * 1.7) * (k % 3 ? 1 : -1.3);
function market(beta, own, days = 600, mut = null) {
  const bars = []; let prev = 100;
  for (let t = T0; bars.length < days; t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const k = bars.length, r = beta * fac(k) + own * Math.cos(k * 2.3 + beta) + (mut ? mut(k, t) : 0);
    const c = prev * (1 + r), o = prev;
    bars.push({ time: t, open: o, high: Math.max(o, c) * 1.003, low: Math.min(o, c) * 0.997, close: c }); prev = c;
  }
  return { bars, ends: monthEnds(bars), half: () => 0, rate: () => 0 };
}
const BETAS = [0.4, 0.7, 0.9, 1.1, 1.3, 1.6];
function panel(mut = null) {
  const D = {}; BETAS.forEach((b, j) => { D['m' + j] = market(b, 0.0005, 600, mut ? (k, t) => mut(j, k, t) : null); });
  return D;
}
const KEYS = BETAS.map((_, j) => 'm' + j);

test('the pre-registered constants', () => {
  assert.equal(P.betaDays, 250); assert.equal(P.shrinkW, 0.6); assert.equal(P.capK, 3); assert.equal(P.atrK, 3); assert.equal(P.atrN, 20);
  assert.deepEqual(GROUPS.C.keys, ['xau', 'xag', 'xpt', 'xpd', 'xcu', 'bco', 'wtico', 'natgas', 'corn', 'wheat', 'soybn', 'sugar']);
  assert.deepEqual(GROUPS.F.keys, ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdcad', 'usdchf']);
  assert.equal(GROUPS.I.keys.length, 17);
  assert.deepEqual(INVERT, ['usdjpy', 'usdcad', 'usdchf']);
  assert.ok(near(shrink(1.5), 0.6 * 1.5 + 0.4)); assert.ok(near(shrink(1), 1));
});

test('beta: OLS on the group average over the last 250 common days, ranked ascending by shrunk beta', () => {
  const D = panel(), avg = groupAverage(D, KEYS), m = monthOf(D.m0.bars[0].time) + 14;
  const list = rankAt(D, KEYS, avg, m);
  assert.deepEqual(list.map((x) => x.key), KEYS);
  // the average's beta is the mean of the betas (1.0); each market's beta scales with its own
  const mb = BETAS.reduce((a, b) => a + b, 0) / BETAS.length;
  list.forEach((x, j) => assert.ok(Math.abs(x.beta - BETAS[j] / mb) < 0.03, `${x.key} ${x.beta}`));
  list.forEach((x) => assert.ok(near(x.sb, shrink(x.beta))));
  // too little history: no beta
  assert.equal(rankAt(D, KEYS, avg, monthOf(D.m0.bars[0].time) + 10).length, 0);
});

test('no look-ahead: a beta at month m reads nothing after the month-m close', () => {
  const D = panel(), avg = groupAverage(D, KEYS), m = monthOf(D.m0.bars[0].time) + 14;
  const endT = D.m0.bars[D.m0.ends.get(m)].time;
  const D2 = panel((j, k, t) => (t > endT && j === 0 ? 5 * fac(k) : 0));
  const avg2 = groupAverage(D2, KEYS);
  assert.deepEqual(rankAt(D2, KEYS, avg2, m), rankAt(D, KEYS, avg, m));
  const i = D.m0.ends.get(m);
  assert.equal(betaAt(D2, 'm0', avg2, i), betaAt(D, 'm0', avg, i));
  assert.notEqual(rankAt(D2, KEYS, avg2, m + 2)[0].key, 'm0', 'later months do see it');
});

test('halves, equal ex-ante beta legs and the cap at 3 x the inverse-ATR size', () => {
  const list = [
    { key: 'a', sb: 0.6, atrPct: 0.01 }, { key: 'b', sb: 0.7, atrPct: 0.01 }, { key: 'c', sb: 0.8, atrPct: 0.002 },
    { key: 'd', sb: 1.0, atrPct: 0.01 }, { key: 'e', sb: 1.2, atrPct: 0.01 }, { key: 'f', sb: 1.4, atrPct: 0.05 }, { key: 'g', sb: 1.5, atrPct: 0.01 },
  ];
  const bk = bookOf(list);
  assert.deepEqual(bk.low, ['a', 'b', 'c']); assert.deepEqual(bk.high, ['e', 'f', 'g'], 'odd n: the middle sits out');
  assert.ok(near(bk.bL, 0.7)); assert.ok(near(bk.bH, (1.2 + 1.4 + 1.5) / 3));
  const by = Object.fromEntries(bk.pos.map((p) => [p.key, p]));
  assert.ok(near(by.a.raw, 1 / (3 * 0.7))); assert.equal(by.a.dir, 1); assert.equal(by.g.dir, -1);
  // ex-ante beta of each uncapped leg is 1
  assert.ok(near(['a', 'b', 'c'].reduce((s, k) => s + by[k].raw * list.find((x) => x.key === k).sb, 0), 1));
  assert.ok(near(['e', 'f', 'g'].reduce((s, k) => s + by[k].raw, 0) * bk.bH, 1));
  // f: ATR 5x the median 0.01 -> inverse-ATR size (1/3) x 0.2, cap 0.2, below its raw weight
  assert.ok(near(by.f.cap, 3 * (1 / 3) * (0.01 / 0.05))); assert.ok(by.f.capped); assert.ok(near(by.f.w, by.f.cap));
  assert.ok(!by.c.capped && near(by.c.w, by.c.raw), 'a calm market is not capped');
  assert.equal(bookOf(list.slice(0, 5)), null, 'fewer than 6 markets: no book');
  assert.equal(bookOf(list.map((x) => ({ ...x, sb: x.sb - 1.2 }))), null, 'a leg beta under 0.1: no book');
});

test('a position: entry at the next open, 3 x ATR(20) stop on the losing side, out at the next month end, costs and financing', () => {
  const M = market(1, 0.0005); M.half = (px) => 0.0002 * px; M.rate = () => 0.0001;
  const m = monthOf(M.bars[0].time) + 3, i = M.ends.get(m), last = M.bars[M.bars.length - 1].time;
  for (const dir of [1, -1]) {
    const lg = legOf(M, m, dir, last);
    assert.equal(lg.entry, M.bars[i + 1].open);
    assert.ok(dir > 0 ? lg.stop < lg.entry : lg.stop > lg.entry);
    if (lg.why === 'time') {
      const x = M.bars.findLastIndex((b) => monthOf(b.time) === m + 1);
      assert.equal(lg.exitPx, M.bars[x].close);
      assert.ok(near(lg.g, dir * (lg.exitPx / lg.entry - 1) * 100, 1e-9));
      let fin = 0; for (let k = i + 1; k < x; k++) fin += nights(M.bars[k].time, M.bars[k + 1].time) * 0.0001 * M.bars[k].close * 100 / lg.entry;
      assert.ok(near(lg.fin, fin, 1e-9));
    }
    assert.ok(near(lg.spr, 0.0002 * lg.entry * 100 / lg.entry + 0.0002 * lg.exitPx * 100 / lg.entry, 1e-9));
  }
  // a crash: the long is stopped at its stop, never below
  const C = market(1, 0.0005, 600, (k) => (k > 90 && k < 95 ? -0.05 : 0)); C.half = () => 0; C.rate = () => 0;
  const mc = monthOf(C.bars[85].time) - 1, lc = legOf(C, mc, 1, C.bars[C.bars.length - 1].time);
  assert.ok(lc.why === 'stop' || lc.why === 'stop-gap');
  assert.ok(lc.exitPx <= lc.stop + 1e-12);
});

test('FX: inverted pairs, pip costs in the inverted price, flat financing; group cost rules', () => {
  const b = [{ time: 1, open: 150, high: 151, low: 149, close: 150.5 }], q = invertBars(b)[0];
  assert.ok(near(q.high, 1 / 149) && near(q.low, 1 / 151) && near(q.close, 1 / 150.5));
  const hj = halfCostFn('F', 'usdjpy', true), px = 1 / 150;
  assert.ok(near(hj(px), (2 * 0.01 / 2) * px * px, 1e-15), 'two pips of 0.01, mapped to 1 / p');
  assert.ok(near(halfCostFn('F', 'eurusd', false)(1.1), 0.0001));
  assert.ok(near(halfCostFn('C', 'xau', false)(4000), 0.15)); assert.ok(near(halfCostFn('C', 'corn', false)(400), 0.0003 * 400));
  assert.ok(near(halfCostFn('I', 'de40', false)(20000), 0.0002 * 20000));
  assert.ok(near(nightRateFn('F')(0), 0.00004)); assert.ok(near(nightRateFn('C')(0), 0.03 / 365));
  assert.ok(near(nightRateFn('I', () => 4)(0), (0.04 + 0.025) / 365)); assert.ok(near(nightRateFn('I', () => null)(0), (0.04 + 0.025) / 365));
});

test('the primary series is the equal mean of commodities and FX, months where both exist; Holm', () => {
  const a = [{ m: 1, g: 1, spr: 0.1, fin: 0.2 }, { m: 2, g: 2, spr: 0, fin: 0 }], b = [{ m: 2, g: 4, spr: 0.2, fin: 0.4 }, { m: 3, g: 1, spr: 0, fin: 0 }];
  const c = combine([a, b]);
  assert.deepEqual(c.map((r) => r.m), [2]); assert.ok(near(c[0].g, 3)); assert.ok(near(netOf(c[0], 2), 3 - 2 * 0.3));
  assert.deepEqual(holm([0.01, 0.04, 0.3, 0.012]), [true, false, false, true]);
  assert.ok(near(statsOf([1, -1, 2]).mean, 2 / 3));
});

test('RESULT.md agrees with result.json', () => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(j.study, 'xs-bab'); assert.ok(['PASS', 'FAIL'].includes(j.verdict));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.includes(`**Verdict: ${j.verdict}, ${j.statement}**`));
  assert.ok(`${j.verdict}, ${j.statement}`.length < 220);
  const P0 = j.tests.find((t) => t.test === 'P');
  assert.equal(j.verdict === 'PASS', P0.pass);
  assert.equal(j.tests.length, 4);
  for (const t of j.tests) {
    assert.equal(t.pass, Object.values(t.checks).every(Boolean));
    const s = j.series[t.test];
    assert.equal(t.checks.oosPositive, s.oos.x1.mean > 0); assert.equal(t.checks.isPositive, s.is.x1.mean > 0); assert.equal(t.checks.cost2x, s.oos.x2.mean > 0);
    assert.ok(md.includes(`(${s.oos.x1.mean})`) && md.includes(`(${s.oos.x1.t})`));
    assert.equal(j.placebo[t.test].draws, 40);
  }
  assert.ok(md.includes(`| **OOS ${j.series.P.oos.from} to ${j.series.P.oos.to}, net (1x)** | ${j.series.P.oos.x1.months} | ${j.series.P.oos.x1.mean} | ${j.series.P.oos.x1.t} |`));
  assert.equal(j.series.P.oos.from, '2017-01'); assert.equal(j.series.P.is.to, '2016-12');
});
