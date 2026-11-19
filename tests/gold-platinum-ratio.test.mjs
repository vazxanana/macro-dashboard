// Gold-platinum-ratio study (research/edge/gold-platinum-ratio): the joint-day match, the ratio z and the monthly momentum
// on hand-made candles (no look-ahead), the entry at gold's next open, the 3 ATR stop, costs and long-only financing, one
// position at a time, the placebo's side mix, Holm and the verdict rule, and the written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { joint, ratioZ, monthMom, entryIndex, atrBefore, tradeAt, simulate, placeboDays, rng, holm, normP, verdictOf, RT, STOP_ATR, LOOK, MOM } from '../research/edge/gold-platinum-ratio/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/gold-platinum-ratio/PREREGISTRATION.md'), RES = rd('../research/edge/gold-platinum-ratio/RESULT.md');
const R = JSON.parse(rd('../research/edge/gold-platinum-ratio/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let d = T0; out.length < n; d += 86400) { const w = new Date(d * 1000).getUTCDay(); if (w && w < 6) out.push(d); } return out; };
const bars = (closes) => weekdays(closes.length).map((time, i) => { const o = i ? closes[i - 1] : closes[0]; return { time, open: o, high: Math.max(o, closes[i]) + 1, low: Math.min(o, closes[i]) - 1, close: closes[i] }; });

test('joint days are matched by stamp, not by row', () => {
  const g = bars([1, 2, 3, 4, 5]), p = bars([10, 20, 30, 40, 50]).filter((_, i) => i !== 2);
  const j = joint(g, p);
  assert.deepEqual(j.map((x) => [x.g, x.m]), [[1, 10], [2, 20], [4, 40], [5, 50]]);
});

test('ratio z uses only the 250 values before the day, sides revert, and later prices never change it', () => {
  const n = LOOK + 20, g = [], m = [];
  for (let i = 0; i < n; i++) { g.push(1000 * (1 + 0.01 * Math.sin(i))); m.push(1000); }
  g[LOOK + 5] = 1300; g[LOOK + 10] = 700;
  const j = joint(bars(g), bars(m)), z = ratioZ(j);
  assert.equal(z[0].t, j[LOOK].t, 'the first z needs 250 earlier values');
  const hi = z.find((x) => x.t === j[LOOK + 5].t), lo = z.find((x) => x.t === j[LOOK + 10].t);
  assert.ok(hi.z >= 2 && hi.s === -1, 'gold rich -> sell gold'); assert.ok(lo.z <= -2 && lo.s === 1, 'gold cheap -> buy gold');
  const g2 = g.slice(); for (let i = LOOK + 6; i < n; i++) g2[i] = 5;
  assert.deepEqual(ratioZ(joint(bars(g2), bars(m))).find((x) => x.t === hi.t), hi);
});

test('monthly momentum fires on the last joint day of a month only, from the 21 days before', () => {
  const g = [], m = [];
  for (let i = 0; i < 80; i++) { g.push(100 + i); m.push(100 + 0.5 * i); }
  const j = joint(bars(g), bars(m)), mm = monthMom(j);
  const sig = mm.filter((x) => x.signal);
  for (const s of sig) {
    const i = j.findIndex((x) => x.t === s.t), d = (t) => new Date(t * 1000).getUTCMonth();
    assert.notEqual(d(j[i + 1].t), d(j[i].t));
    near(s.rg, j[i].g / j[i - MOM].g - 1); assert.equal(s.s, 1);
  }
  assert.ok(sig.length >= 2);
  assert.ok(!mm[mm.length - 1].signal, 'the last day on file is never a month end');
});

test('entry at the next gold candle; 3 x ATR stop both ways, gaps, $0.60, financing on longs only', () => {
  const g = bars(new Array(40).fill(1000)), j = 30;
  const fri = g.find((x) => new Date(x.time * 1000).getUTCDay() === 5 && x.time > g[25].time);
  assert.equal(new Date(g[entryIndex(g, fri.time)].time * 1000).getUTCDay(), 1);
  const a = atrBefore(g, j), g2 = g.map((x, i) => (i >= j ? { ...x, high: x.high + 50 } : x));
  near(atrBefore(g2, j), a);
  const tr = tradeAt(g, j, 1, 5);
  near(tr.risk, STOP_ATR * a); near(tr.stop, 1000 - tr.risk); assert.equal(tr.kind, 'time'); assert.equal(tr.k, j + 4);
  near(tr.fin, nights(tr.t, tr.c) * FIN.xau.long * 1000 / tr.risk); near(tr.net, tr.gross - RT / tr.risk - tr.fin); near(RT, 0.6);
  const sh = tradeAt(g, j, -1, 5); assert.equal(sh.fin, 0); near(sh.net, sh.gross - RT / sh.risk);
  const g3 = g.map((x) => ({ ...x })); g3[j + 1] = { ...g3[j + 1], open: 1100, high: 1101 };
  const gap = tradeAt(g3, j, -1, 5); assert.equal(gap.kind, 'gap'); near(gap.exit, 1100);
  const g4 = g.map((x) => ({ ...x })); g4[j] = { ...g4[j], low: 900 };
  const st = tradeAt(g4, j, 1, 5); assert.equal(st.kind, 'stop'); near(st.gross, -1);
  assert.equal(tradeAt(g, 37, 1, 5), null, 'a trade that runs past the data is left out');
});

test('one position at a time, and the placebo keeps the side mix', () => {
  const g = bars(new Array(70).fill(0).map((_, i) => 1000 + (i % 3)));
  const days = [{ t: g[30].time, s: 1 }, { t: g[33].time, s: -1 }, { t: g[45].time, s: -1 }];
  const tr = simulate(days, g, 10);
  assert.equal(tr.length, 2); assert.equal(tr[0].side, 1); assert.equal(tr[1].side, -1);
  const elig = g.slice(25).map((x) => ({ t: x.time })), sides = [1, -1, -1, -1];
  const p = placeboDays(elig, sides, rng(3));
  assert.equal(p.length, 4); assert.deepEqual(p.map((x) => x.s).sort(), sides.slice().sort());
  assert.deepEqual(placeboDays(elig, sides, rng(3)), p, 'seeded');
});

test('Holm and the verdict rule', () => {
  const h = holm([0.01, 0.04, 0.5]); near(h[0], 0.03); near(h[1], 0.08); near(h[2], 0.5);
  assert.ok(normP(2) < 0.025 && normP(2) > 0.02);
  const mk = (id, t, holmP, is, x2, p95 = 1) => ({ id, holm: holmP, is: { netExact: is }, oos: { tMonth: t, x2, n: 50 }, placebo: { p95 } });
  assert.equal(verdictOf([mk('T1', 2.5, 0.01, 0.1, 0.05), mk('T2', 0, 1, 0, 0), mk('T3', 0, 1, 0, 0)]), 'PASS');
  assert.equal(verdictOf([mk('T1', 2.5, 0.01, 0.1, 0.05, 3), mk('T2', 0, 1, 0, 0), mk('T3', 0, 1, 0, 0)]), 'FAIL', 'below the placebo p95');
  assert.equal(verdictOf([mk('T1', 2.5, 0.01, -0.1, 0.05), mk('T2', 0, 1, 0, 0), mk('T3', 3, 0.01, 0.1, 0.1)]), 'PARTIAL');
});

test('the report and the pre-registration agree with result.json', () => {
  assert.match(PRE, /standalone cross-asset/); assert.match(PRE, /decision\s+44/);
  assert.equal(R.verdict, 'FAIL');
  const v = RES.match(/\*\*Verdict: ([^*]+)\*\*/); assert.ok(v, 'bold verdict line');
  assert.ok(v[1].startsWith('FAIL')); assert.ok(v[1].length < 220);
  assert.deepEqual(R.tests.map((t) => t.id), ['T1', 'T2', 'T3']);
  const f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  for (const t of R.tests) {
    assert.equal(t.pass, false); assert.equal(t.placebo.t.length, 40);
    assert.ok(RES.includes(`| ${f(t.oos.net)} |`), `${t.id} OOS net in the report`);
    assert.ok(RES.includes(`| ${f(t.is.net)} |`), `${t.id} IS net in the report`);
    assert.ok(RES.includes(t.holm.toFixed(3)), `${t.id} Holm p in the report`);
    assert.ok(RES.includes(`| ${t.placebo.atLeastReal} of 40 |`), `${t.id} placebo in the report`);
  }
  const t1 = R.tests[0];
  assert.ok(v[1].includes(`n ${t1.oos.n}`) && v[1].includes(Math.abs(t1.oos.tMonth).toFixed(2)) && v[1].includes(f(t1.oos.net)));
});
