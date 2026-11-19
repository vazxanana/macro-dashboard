// research/edge/gold-200d-stretch: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { zAt, zs, atrAt, stretchOf, signals, trade, run, baseline, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-200d-stretch/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
// weekday candles alternating close 999 / 1001 (sd 1, mean 1000), range 10 (true range 10)
function base(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) { const c = ds.length % 2 ? 1001 : 999; ds.push({ time: t, open: 1000, high: 1005, low: 995, close: c }); } t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };
const pad = (ds, n = P.maxHold) => { for (let k = 0; k < n; k++) add(ds, 1000, 1004, 996, 1000); return ds; };

test('z from the 200 closes ending at the day; stretches beyond +/-2', () => {
  const ds = base(200);
  assert.equal(zAt(ds, 198), null);
  assert.ok(Math.abs(zAt(ds, 199) - 1) < 1e-9); // close 1001, mean 1000, sd 1
  const up = add(ds, 1001, 1012, 1000, 1010); assert.ok(zAt(ds, up) > 2); assert.equal(stretchOf(zAt(ds, up)), 1);
  const dn = base(200); const i = add(dn, 999, 1000, 985, 988); assert.equal(stretchOf(zAt(dn, i)), -1);
  const Z = zs(ds);
  assert.deepEqual(signals(Z, TESTS[1]), [up]); assert.deepEqual(signals(Z, TESTS[2]), [up]); assert.deepEqual(signals(Z, TESTS[0]), []);
  assert.equal(stretchOf(null), 0); assert.equal(stretchOf(1.99), 0);
});

test('no look-ahead: z, ATR and stretch of a day do not change with later days', () => {
  const ds = base(200); const i = add(ds, 1001, 1012, 1000, 1010);
  const z = zAt(ds, i), a = atrAt(ds, i);
  add(ds, 1010, 5000, 1, 4000); add(ds, 4000, 4001, 3999, 4000);
  assert.equal(zAt(ds, i), z); assert.equal(atrAt(ds, i), a); assert.equal(zs(ds)[i], z);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry next open, 2 x ATR stop, exit back inside 1 sd, financing on buys only', () => {
  const ds = base(200); const i = add(ds, 999, 1000, 985, 988); // low stretch; ATR(14) = (13 x 10 + 15) / 14
  const atr = atrAt(ds, i), risk = 2 * atr;
  add(ds, 990, 1000, 989, 999.5); pad(ds); // the entry day closes back near the mean -> z >= -1
  const Z = zs(ds), tr = trade(ds, Z, i, 1, 'z');
  assert.equal(tr.entry, 990); assert.ok(Math.abs(tr.stop - (990 - risk)) < 1e-9); assert.equal(tr.why, 'back'); assert.equal(tr.held, 1);
  assert.ok(Math.abs(tr.R - 9.5 / risk) < 1e-12); assert.ok(Math.abs(tr.costR - 0.6 / risk) < 1e-12);
  const nn = nights(ds[i + 1].time, ds[i + 1].time + D); assert.equal(tr.nights, nn);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 990 / risk) < 1e-12);
  assert.ok(Math.abs(tr.net - (tr.R - tr.costR - tr.finR)) < 1e-12);
  const s = trade(ds, Z, i, -1, 'z'); assert.equal(s.finR, 0); assert.equal(s.nights, 0);
  const x2 = trade(ds, Z, i, 1, 'z', 2); assert.ok(Math.abs(x2.finR - 2 * tr.finR) < 1e-12); assert.ok(Math.abs(x2.costR - 2 * tr.costR) < 1e-12);
  // run fades the stretch: a low stretch is bought
  assert.equal(run(ds, Z, [i])[0].side, 1);
});

test('the stop wins on its day; a later gap fills at the open; time exit after 20 days; fixed hold', () => {
  const ds = base(200), i = 199; add(ds, 1000, 1004, 970, 1003); pad(ds);
  let Z = zs(ds); const st = trade(ds, Z, i, 1, 'z'); assert.equal(st.why, 'stop'); assert.equal(st.R, -1);
  const g = base(200); add(g, 1000, 1004, 990, 992); add(g, 960, 965, 955, 962); pad(g);
  const tg = trade(g, zs(g), 199, 1, 3); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 960);
  const h = base(200); for (let k = 0; k < 22; k++) add(h, 1000, 1004, 996, 1000 + (k % 2 ? 0.1 : -0.1));
  Z = zs(h); const sh = trade(h, Z, 199, -1, 'z'); assert.ok(['back', 'time'].includes(sh.why));
  const fx = trade(h, Z, 199, 1, 4); assert.equal(fx.held, 4); assert.equal(fx.why, 'time');
  assert.equal(trade(base(205), zs(base(205)), 199, 1, 'z'), null); // 20-day window past the data end: not taken
});

test('one position at a time; baseline in the OOS window; month sums; Holm; weekend fold; parameters', () => {
  const ds = base(260); for (let k = 0; k < 30; k++) add(ds, 1000, 1004, 996, 1000);
  const Z = zs(ds);
  // force stretches by hand: each fade holds to its time exit unless back inside, so later signals are skipped
  const fake = Z.map(() => -3), T = run(ds, fake, [200, 201, 202]);
  assert.equal(T.length, 1); assert.equal(T[0].ei, 201);
  const B = baseline(ds, Z, 1, 2); // a buy at every OOS day's open (these 2020-21 candles are OOS), overlap allowed
  assert.equal(B.length, ds.length - 2 - P.atrN); // no ATR before day 14, no window past the end assert.ok(B.every((x) => x.side === 1 && x.held <= 2 && x.d >= P.oosFrom));
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].open, 1.5); assert.equal(days[1].high, 3);
  assert.deepEqual([P.maN, P.zIn, P.zOut, P.atrN, P.stopAtr, P.maxHold, P.cost, P.seeds, P.needBeat, P.minN], [200, 2, 1, 14, 2, 20, 0.60, 40, 38, 20]);
  assert.deepEqual([P.isFrom, P.isTo, P.oosFrom, P.oosTo], ['2007-01-01', '2016-12-31', '2017-01-01', '2026-10-31']);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-200d-stretch/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-200d-stretch/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict},`)); assert.ok(vl.length < 220);
  assert.equal(r.gold.passed.length, 0);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
  const ft = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
  const rows = md.split('\n').filter((l) => /^\| (\*\*)?T[123] /.test(l));
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id];
    for (const [w, s, sg] of [['IS', g.is, g.isGross], ['OOS', g.oos, g.oosGross]]) {
      const row = rows.find((l) => l.includes(`${id} `) && l.includes(`| ${w} `));
      const c = row.split('|').map((x) => x.trim());
      assert.equal(c[3], String(s.n), `${id} ${w} n`);
      assert.equal(c[5], f(sg.mean)); assert.equal(c[6], f(s.mean));
      assert.equal(c[7], ft(sg.monthT)); assert.equal(c[8], ft(s.monthT));
      if (w === 'OOS') assert.equal(c[9], f(g.oos2x.mean));
    }
    const pr = md.split('\n').find((l) => l.startsWith(`| ${id} | `) && l.includes(' of 40 |'));
    assert.ok(pr.includes(`${g.placebo.beaten} of 40`)); assert.ok(pr.includes(f(g.placebo.median))); assert.ok(pr.includes(f(g.baseline.mix)));
  }
  assert.ok(vl.includes(f(r.gold.tests.T3.oos.mean) + 'R')); assert.ok(vl.includes(`n ${r.gold.tests.T3.oos.n}`)); assert.ok(vl.includes(ft(r.gold.tests.T3.oos.monthT)));
});
