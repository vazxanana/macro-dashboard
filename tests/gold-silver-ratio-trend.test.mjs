// Gold-silver-ratio-trend study (research/edge/gold-silver-ratio-trend): the weekly ratio-momentum signal on hand-made candles
// (no look-ahead, next calendar week only), each leg's entry / 3 ATR stop / gap / week-end exit, costs and long-only financing,
// the pair's 0.5R legs, Holm and the verdict rule, and the written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { joint, weeks, weekOf, signals, leg, pair, atrUpTo, indexAt, holm, normP, verdictOf, rng, COST, STOP_ATR, FIN_LONG, LEG } from '../research/edge/gold-silver-ratio-trend/run.mjs';
import { nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const RES = rd('../research/edge/gold-silver-ratio-trend/RESULT.md'), PRE = rd('../research/edge/gold-silver-ratio-trend/PREREGISTRATION.md');
const R = JSON.parse(rd('../research/edge/gold-silver-ratio-trend/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let d = T0; out.length < n; d += 86400) { const w = new Date(d * 1000).getUTCDay(); if (w && w < 6) out.push(d); } return out; };
const bars = (closes) => weekdays(closes.length).map((time, i) => { const o = i ? closes[i - 1] : closes[0]; return { time, open: o, high: Math.max(o, closes[i]) + 1, low: Math.min(o, closes[i]) - 1, close: closes[i] }; });

test('weeks are Monday-based and the signal follows the sign of the ratio change, traded the next week', () => {
  assert.equal(weekOf(Date.UTC(2020, 0, 6) / 1000), weekOf(Date.UTC(2020, 0, 10) / 1000));
  assert.equal(weekOf(Date.UTC(2020, 0, 13) / 1000), weekOf(Date.UTC(2020, 0, 10) / 1000) + 1);
  const n = 100, g = [], m = [];
  for (let i = 0; i < n; i++) { g.push(1000 * (1 + 0.004 * i)); m.push(20); }   // ratio rising
  const wk = weeks(joint(bars(g), bars(m)));
  assert.equal(wk.length, 20); assert.equal(new Date(wk[0].last * 1000).getUTCDay(), 5);
  const s = signals(wk, 4);
  assert.equal(s.length, 15); assert.ok(s.every((x) => x.s === 1));
  assert.equal(s[0].sig, wk[4].last); assert.equal(s[0].from, wk[5].first); assert.equal(s[0].to, wk[5].last);
  const s2 = signals(weeks(joint(bars(g.map((x, i) => 2000 - i)), bars(m))), 4);
  assert.ok(s2.every((x) => x.s === -1), 'ratio falling -> short gold / long metal');
});

test('no look-ahead: later prices never change a signal, and a missing week breaks the pair of weeks', () => {
  const n = 100, g = [], m = [];
  for (let i = 0; i < n; i++) { g.push(1000 + 30 * Math.sin(i / 3)); m.push(20 + Math.cos(i / 5)); }
  const s = signals(weeks(joint(bars(g), bars(m))), 4), k = 7, cut = s[k].sig;
  const gb = bars(g).map((b) => (b.time > cut ? { ...b, close: 1 } : b));
  const s2 = signals(weeks(joint(gb, bars(m))), 4);
  assert.deepEqual(s2[k], s[k]);
  const holey = bars(g).filter((b) => weekOf(b.time) !== weekOf(s[k].from));
  assert.ok(!signals(weeks(joint(holey, bars(m))), 4).some((x) => x.sig === s[k].sig), 'the next calendar week only');
});

test('a leg: entry at the next open, ATR known at the signal close, 3 ATR stop, gap, week-end exit, costs, financing', () => {
  const b = bars(new Array(40).fill(1000)), si = 24, sig = b[si].time;
  const from = b[si + 1].time, to = b[si + 5].time;
  assert.equal(indexAt(b, sig), si);
  const a = atrUpTo(b, si), later = b.map((x, i) => (i > si ? { ...x, high: x.high + 50 } : x));
  near(atrUpTo(later, si), a);
  const L = leg(b, sig, from, to, 1, COST.xau);
  near(L.risk, STOP_ATR * a); near(L.stop, 1000 - L.risk); assert.equal(L.kind, 'time'); near(L.e, b[si + 1].open);
  near(L.fin, nights(L.t, L.c) * FIN_LONG * L.e / L.risk); near(L.net, L.gross - COST.xau / L.risk - L.fin); near(COST.xau, 0.6);
  const S = leg(b, sig, from, to, -1, COST.xau); assert.equal(S.fin, 0);
  const g3 = b.map((x) => ({ ...x })); g3[si + 2] = { ...g3[si + 2], open: 1100, high: 1101 };
  const gap = leg(g3, sig, from, to, -1, COST.xau); assert.equal(gap.kind, 'gap'); near(gap.exit, 1100);
  const g4 = b.map((x) => ({ ...x })); g4[si + 1] = { ...g4[si + 1], low: 900 };
  const st = leg(g4, sig, from, to, 1, COST.xau); assert.equal(st.kind, 'stop'); near(st.gross, -1);
  assert.equal(leg(b, sig, b[si + 2].time, to, 1, COST.xau), null, 'no entry before the week starts');
});

test('the pair: opposite legs, 0.5R each, metal costs its own', () => {
  const g = bars(new Array(40).fill(0).map((_, i) => 1000 + 5 * i)), m = bars(new Array(40).fill(0).map((_, i) => 20 + 0.01 * i));
  const sg = { sig: g[24].time, from: g[25].time, to: g[29].time };
  const p = pair(g, m, 'xag', sg, 1);
  assert.equal(p.gold.side, 1); assert.equal(p.metal.side, -1);
  near(p.net, LEG * (p.gold.net + p.metal.net)); near(p.metal.cost, COST.xag / p.metal.risk); assert.equal(p.metal.fin, 0);
  const q = pair(g, m, 'xag', sg, -1); assert.equal(q.gold.fin, 0); assert.ok(q.metal.fin > 0);
});

test('Holm, the seeded draws and the verdict rule', () => {
  const h = holm([0.01, 0.04, 0.5]); near(h[0], 0.03); near(h[1], 0.08); near(h[2], 0.5);
  assert.ok(normP(2) < 0.025 && normP(2) > 0.02);
  assert.equal(rng(7)(), rng(7)());
  const mk = (id, tM, holmP, isNet, x2, below) => ({ id, holm: holmP, is: { netExact: isNet, n: 500 }, oos: { tMonth: tM, x2, n: 500, placebo: { below } } });
  assert.equal(verdictOf([mk('T1', 2.5, 0.01, 0.1, 0.05, 39), mk('T2', 0, 1, -1, -1, 0), mk('T3', 0, 1, -1, -1, 0)]), 'PASS');
  assert.equal(verdictOf([mk('T1', 2.5, 0.01, 0.1, 0.05, 37), mk('T2', 0, 1, -1, -1, 0), mk('T3', 0, 1, -1, -1, 0)]), 'FAIL');
  assert.equal(verdictOf([mk('T1', 1, 1, 0.1, 0.05, 39), mk('T2', 3, 0.001, 0.1, 0.1, 40), mk('T3', 0, 1, -1, -1, 0)]), 'PARTIAL');
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.tests.length, 3);
  const line = RES.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.includes('FAIL, 0 of 3') && line.length < 240);
  const f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  for (const t of R.tests) {
    assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) {
      const x = t[w], row = RES.split('\n').find((l) => l.includes(`${w === 'is' ? 'IS 2007-16' : 'OOS 2017-26'} | ${x.n} (${x.long} / ${x.short})`) && l.includes(f(x.net)));
      assert.ok(row, `${t.id} ${w} row`);
      assert.ok(row.includes(f(x.x2)) && row.includes(x.tMonth.toFixed(2).replace('-', '−')), `${t.id} ${w} figures`);
      assert.ok(x.n >= 100);
    }
  }
  const t1 = R.tests[0];
  assert.ok(line.includes(String(t1.oos.net)) && line.includes(String(t1.oos.tMonth)) && line.includes(String(t1.is.net)));
  assert.ok(RES.includes(`above n of 40`) && RES.includes(`| ${t1.oos.placebo.below} |`));
  assert.ok(PRE.includes('Holm over T1-T3') && PRE.includes('38 of the 40'));
});
