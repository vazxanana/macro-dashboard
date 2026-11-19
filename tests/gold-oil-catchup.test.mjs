// Gold-oil catch-up study (research/edge/gold-oil-catchup): the decile / divergence signal on hand-made candles (no
// look-ahead), the entry at gold's next open, stop and costs, one position at a time, the baseline excess, the placebo and
// the control, the statistics, and the written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, quantile, tradeAt, atrBefore, simulate, baseline, withExcess, placeboDays, controlDays, rng, holm, normP, verdictOf, RT, STOP_ATR, N, WIN } from '../research/edge/gold-oil-catchup/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/gold-oil-catchup/PREREGISTRATION.md'), RES = rd('../research/edge/gold-oil-catchup/RESULT.md');
const R = JSON.parse(rd('../research/edge/gold-oil-catchup/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T0 = Date.UTC(2010, 0, 4) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let d = T0; out.length < n; d += 86400) { const w = new Date(d * 1000).getUTCDay(); if (w && w < 6) out.push(d); } return out; };
const bars = (closes) => weekdays(closes.length).map((time, i) => { const o = i ? closes[i - 1] : closes[0]; return { time, open: o, high: Math.max(o, closes[i]) + 1, low: Math.min(o, closes[i]) - 1, close: closes[i] }; });
const wiggle = (n, base, amp) => { const c = [base]; for (let i = 1; i < n; i++) c.push(c[i - 1] * (1 + amp * Math.sin(i * 1.7) * (i % 3 ? 1 : -1))); return c; };

test('quantile interpolates', () => { near(quantile([1, 2, 3, 4, 5], 0.5), 3); near(quantile([4, 1, 3, 2], 0.9), 3.7); });

test('signal: an oil decile move with gold flat, both signs; gold moving kills it; later prices never change it', () => {
  const n = N + WIN + 40, oil = wiggle(n, 50, 0.01), gold = wiggle(n, 1000, 0.002);
  const k = N + WIN + 10;
  for (let i = k - 9; i <= k; i++) oil[i] = oil[i - 1] * 1.03;            // a 10-day surge into day k
  for (let i = k + 1; i < n; i++) oil[i] = oil[k] * (1 + 0.005 * Math.sin(i));
  for (let i = k - 9; i <= k; i++) gold[i] = gold[k - 10];             // gold flat over the same 10 days
  const g = bars(gold), o = bars(oil), s = signals(g, o);
  const at = s.find((x) => x.t === g[k].time);
  assert.equal(at.s, 1, 'oil up, gold flat -> long');
  assert.equal(s[0].i, N + WIN, 'needs N + WIN earlier aligned closes');
  const dn = oil.map((x, i) => (i >= k - 9 && i <= k ? oil[k - 10] * Math.pow(0.97, i - k + 10) : x));
  for (let i = k + 1; i < n; i++) dn[i] = dn[k];
  assert.equal(signals(g, bars(dn)).find((x) => x.t === g[k].time).s, -1, 'oil down -> short');
  const gm = gold.slice(); for (let i = k - 9; i <= k; i++) gm[i] = gm[i - 1] * 1.02;
  const sm = signals(bars(gm), o).find((x) => x.t === g[k].time);
  assert.equal(sm.oilOnly, 1); assert.equal(sm.s, 0, 'gold already followed -> no signal');
  const o2 = oil.slice(), g2 = gold.slice(); for (let i = k + 1; i < n; i++) { o2[i] = 1; g2[i] = 5000; }
  assert.deepEqual(signals(bars(g2), bars(o2)).find((x) => x.t === g[k].time), at, 'no look-ahead');
});

test('a gold day with no oil close on the same day is not a signal day', () => {
  const n = N + WIN + 20, g = bars(wiggle(n, 1000, 0.002)), o = bars(wiggle(n, 50, 0.01));
  const drop = g[N + WIN + 12].time, s = signals(g, o.filter((b) => b.time !== drop));
  assert.ok(!s.some((x) => x.t === drop));
});

test('stop 3 x ATR, gap exits, $0.60 a round trip, financing on longs only', () => {
  const g = bars(new Array(40).fill(1000)), j = 30;
  const tr = tradeAt(g, j, 1, 3);
  near(tr.risk, STOP_ATR * atrBefore(g, j)); near(tr.stop, 1000 - tr.risk); assert.equal(tr.kind, 'time'); assert.equal(tr.k, j + 2);
  near(tr.fin, nights(tr.t, tr.c) * FIN.xau.long * 1000 / tr.risk); near(tr.net, tr.gross - RT / tr.risk - tr.fin); near(RT, 0.6);
  const sh = tradeAt(g, j, -1, 3); assert.equal(sh.fin, 0); near(sh.net, sh.gross - RT / sh.risk);
  const g3 = g.map((x) => ({ ...x })); g3[j + 1] = { ...g3[j + 1], open: 1100, high: 1101 };
  const gap = tradeAt(g3, j, -1, 3); assert.equal(gap.kind, 'gap'); near(gap.exit, 1100);
  const g4 = g.map((x) => ({ ...x })); g4[j] = { ...g4[j], low: 900 };
  assert.equal(tradeAt(g4, j, 1, 3).kind, 'stop');
  assert.equal(tradeAt(g, 38, 1, 3), null);
  const a = atrBefore(g, j), g5 = g.map((x, i) => (i >= j ? { ...x, high: x.high + 50 } : x)); near(atrBefore(g5, j), a);
});

test('entry at the next open, one position at a time, excess against the same-side baseline', () => {
  const g = bars(new Array(80).fill(0).map((_, i) => 1000 + (i % 4)));
  const days = [{ t: g[30].time, i: 30, s: 1 }, { t: g[31].time, i: 31, s: -1 }, { t: g[40].time, i: 40, s: -1 }];
  const tr = simulate(days, g, 3);
  assert.equal(tr.length, 2); assert.equal(tr[0].j, 31); assert.equal(tr[0].side, 1); assert.equal(tr[1].side, -1);
  const base = baseline(g, g[25].time, g[70].time, 3), ex = withExcess(tr, base);
  near(ex[0].ex, ex[0].net - base.long); near(ex[1].ex, ex[1].net - base.short);
  assert.ok(base.nLong > 40);
});

test('placebo keeps the days, control keeps the year and the side; both seeded', () => {
  const g = bars(new Array(600).fill(0).map((_, i) => 1000 + i));
  const ev = [100, 200, 300, 450].map((i) => ({ t: g[i].time, i, s: i % 200 ? 1 : -1 }));
  const p = placeboDays(ev, rng(3)); assert.deepEqual(p.map((x) => x.t), ev.map((x) => x.t)); assert.deepEqual(placeboDays(ev, rng(3)), p);
  const c = controlDays(ev, g, g[0].time, g[599].time, rng(5));
  const yr = (t) => new Date(t * 1000).getUTCFullYear();
  assert.deepEqual(c.map((x) => yr(x.t)).sort(), ev.map((x) => yr(x.t)).sort());
  assert.deepEqual(c.map((x) => x.s).sort(), ev.map((x) => x.s).sort());
  assert.deepEqual(controlDays(ev, g, g[0].time, g[599].time, rng(5)), c);
});

test('Holm and the verdict rule', () => {
  const h = holm([0.01, 0.04, 0.5]); near(h[0], 0.03); near(h[1], 0.08); near(h[2], 0.5);
  assert.ok(normP(2) < 0.025 && normP(2) > 0.02);
  const mk = (id, t, hp, is, x2, pl = 0, co = 0) => ({ id, holm: hp, is: { excessExact: is }, oos: { tExcess: t, x2, x2Excess: x2, placebo: { atLeastReal: pl }, control: { atLeastReal: co } } });
  assert.equal(verdictOf([mk('T1', 2.5, 0.01, 0.1, 0.05), mk('T2', 0, 1, 0, 0), mk('T3', 0, 1, 0, 0)]), 'PASS');
  assert.equal(verdictOf([mk('T1', 2.5, 0.01, 0.1, 0.05, 0, 5), mk('T2', 3, 0.01, 0.1, 0.1), mk('T3', 0, 1, 0, 0)]), 'PARTIAL');
  assert.equal(verdictOf([mk('T1', 1, 0.3, 0.1, 0.05), mk('T2', 0, 1, 0, 0), mk('T3', 0, 1, 0, 0)]), 'FAIL');
});

test('the report and the pre-registration agree with result.json', () => {
  assert.match(PRE, /stand-alone rule on spot gold/); assert.match(PRE, /decision 44/); assert.match(RES, /decision 44/);
  assert.equal(R.verdict, 'FAIL');
  const v = RES.match(/\*\*Verdict: ([^*]+)\*\*/); assert.ok(v, 'bold verdict line');
  assert.ok(v[1].startsWith('FAIL')); assert.ok(v[1].length < 220);
  assert.deepEqual(R.tests.map((t) => t.id), ['T1', 'T2', 'T3']);
  const f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  for (const t of R.tests) {
    assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) {
      assert.equal(t[w].placebo.t.length, 40); assert.equal(t[w].control.t.length, 40);
      assert.ok(RES.includes(`| ${f(t[w].net)} |`), `${t.id} ${w} net`);
      assert.ok(RES.includes(`| ${f(t[w].excess)} |`), `${t.id} ${w} excess`);
      assert.ok(RES.includes(`| ${t[w].n} (${t[w].long} / ${t[w].short})`), `${t.id} ${w} n`);
    }
    assert.ok(RES.includes(t.holm.toFixed(3)));
    assert.ok(RES.includes(`${t.oos.placebo.atLeastReal} of 40`) && RES.includes(`${t.oos.control.atLeastReal} of 40`));
  }
  const t1 = R.tests[0];
  assert.ok(v[1].includes(`n ${t1.oos.n}`) && v[1].includes(f(t1.oos.excess)));
});
