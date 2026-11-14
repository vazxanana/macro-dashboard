// Gold-oil-lead study (research/edge/gold-oil-lead): the big-day signal on hand-made candles (no look-ahead), the entry at
// gold's next open, the 2 ATR stop both ways, costs and long-only financing, one position at a time, the placebo's side
// mix, the statistics, and the written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bigDays, entryIndex, atrBefore, tradeAt, simulate, placeboDays, rng, holm, normP, verdictOf, RT, STOP_ATR, HOLD, LOOK } from '../research/edge/gold-oil-lead/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/gold-oil-lead/PREREGISTRATION.md'), RES = rd('../research/edge/gold-oil-lead/RESULT.md');
const R = JSON.parse(rd('../research/edge/gold-oil-lead/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T0 = Date.UTC(2021, 0, 4) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let d = T0; out.length < n; d += 86400) { const w = new Date(d * 1000).getUTCDay(); if (w && w < 6) out.push(d); } return out; };
const bars = (closes) => weekdays(closes.length).map((time, i) => { const o = i ? closes[i - 1] : closes[0]; return { time, open: o, high: Math.max(o, closes[i]) + 1, low: Math.min(o, closes[i]) - 1, close: closes[i] }; });

test('a big day is beyond 2 sd of the 60 returns BEFORE it, both signs, and later prices never change it', () => {
  const closes = [100]; for (let i = 1; i < 80; i++) closes.push(closes[i - 1] * (i % 2 ? 1.01 : 0.99));
  closes[70] = closes[69] * 1.05; closes[75] = closes[74] * 0.95;
  for (let i = 71; i < 75; i++) closes[i] = closes[70] * (i % 2 ? 1.01 : 0.99);
  for (let i = 76; i < 80; i++) closes[i] = closes[75] * (i % 2 ? 1.01 : 0.99);
  const b = bars(closes), s = bigDays(b);
  assert.equal(s[0].t, b[LOOK + 1].time, 'a day needs 61 earlier closes');
  const up = s.find((x) => x.t === b[70].time), dn = s.find((x) => x.t === b[75].time);
  assert.ok(up.big && up.s === 1); assert.ok(dn.big && dn.s === -1);
  const c2 = closes.slice(); c2[70] = closes[69] * 3;
  near(bigDays(bars(c2)).find((x) => x.t === up.t).sd, up.sd, 1e-12);
  const c3 = closes.slice(); for (let i = 71; i < 80; i++) c3[i] = 1;
  assert.deepEqual(bigDays(bars(c3)).find((x) => x.t === up.t), up);
});

test('entry is gold\'s first candle after the signal day (Friday -> Monday); ATR uses only earlier candles', () => {
  const g = bars(new Array(40).fill(0).map((_, i) => 1000 + i));
  const fri = g.find((x) => new Date(x.time * 1000).getUTCDay() === 5 && x.time > g[25].time);
  assert.equal(new Date(g[entryIndex(g, fri.time)].time * 1000).getUTCDay(), 1);
  assert.equal(entryIndex(g, g[g.length - 1].time), -1);
  const a = atrBefore(g, 30), g2 = g.map((x, i) => (i >= 30 ? { ...x, high: x.high + 50 } : x));
  near(atrBefore(g2, 30), a);
});

test('stop 2 x ATR on both sides, gap exits, $0.60 a trade, financing on longs only', () => {
  const g = bars(new Array(30).fill(1000)), j = 25;
  g[j] = { ...g[j], open: 1000, high: 1001, low: 999.5, close: 1000.5 };
  let tr = tradeAt(g, j, 1);
  near(tr.risk, STOP_ATR * atrBefore(g, j)); near(tr.stop, 1000 - tr.risk); assert.equal(tr.kind, 'time');
  assert.equal(tr.k, j + HOLD - 1);
  near(tr.fin, nights(tr.t, tr.c) * FIN.xau.long * 1000 / tr.risk); near(tr.net, tr.gross - RT / tr.risk - tr.fin);
  near(RT, 0.6);
  const sh = tradeAt(g, j, -1);
  near(sh.stop, 1000 + sh.risk); assert.equal(sh.fin, 0); near(sh.gross, -tr.gross); near(sh.net, sh.gross - RT / sh.risk);
  const g3 = g.map((x) => ({ ...x })); g3[j + 1] = { ...g3[j + 1], open: 1100, high: 1101 };
  const gap = tradeAt(g3, j, -1); assert.equal(gap.kind, 'gap'); near(gap.exit, 1100);
  const g4 = g.map((x) => ({ ...x })); g4[j] = { ...g4[j], low: 990 };
  const st = tradeAt(g4, j, 1); assert.equal(st.kind, 'stop'); near(st.gross, -1);
  assert.equal(tradeAt(g, 28, 1), null, 'a trade that runs past the data is left out');
});

test('one position at a time, side = dir x sign, and the placebo keeps the side mix', () => {
  const g = bars(new Array(60).fill(0).map((_, i) => 1000 + (i % 3)));
  const days = [{ t: g[30].time, s: 1 }, { t: g[31].time, s: -1 }, { t: g[40].time, s: -1 }];
  const tr = simulate(days, g, -1);
  assert.equal(tr.length, 2); assert.equal(tr[0].side, -1); assert.equal(tr[1].side, 1);
  const elig = g.slice(25).map((x) => ({ t: x.time })), sides = [1, 1, -1, -1, -1];
  const p = placeboDays(elig, sides, rng(7));
  assert.equal(p.length, 5); assert.deepEqual(p.map((x) => x.s).sort(), sides.slice().sort());
  assert.deepEqual(placeboDays(elig, sides, rng(7)), p, 'seeded');
});

test('Holm and the verdict rule', () => {
  const h = holm([0.01, 0.04, 0.5]); near(h[0], 0.03); near(h[1], 0.08); near(h[2], 0.5);
  assert.ok(normP(2) < 0.025 && normP(2) > 0.02);
  const mk = (id, t, holmP, is, x2) => ({ id, holm: holmP, is: { netExact: is }, oos: { tMonth: t, x2, n: 50 } });
  assert.equal(verdictOf([mk('T1', 2.5, 0.01, 0.1, 0.05), mk('T2', 0, 1, 0, 0), mk('T3', 0, 1, 0, 0)]), 'PASS');
  assert.equal(verdictOf([mk('T1', 2.5, 0.01, -0.1, 0.05), mk('T2', 0, 1, 0, 0), mk('T3', 3, 0.01, 0.1, 0.1)]), 'PARTIAL');
  assert.equal(verdictOf([mk('T1', 1, 0.3, 0.1, 0.05), mk('T2', 0, 1, 0, 0), mk('T3', 0, 1, 0, 0)]), 'FAIL');
});

test('the report and the pre-registration agree with result.json', () => {
  assert.match(PRE, /standalone cross-asset signal/); assert.match(PRE, /decision 44/);
  assert.equal(R.verdict, 'FAIL');
  const v = RES.match(/\*\*Verdict: ([^*]+)\*\*/); assert.ok(v, 'bold verdict line');
  assert.ok(v[1].startsWith('FAIL')); assert.ok(v[1].length < 220);
  const ids = R.tests.map((t) => t.id); assert.deepEqual(ids, ['T1', 'T2', 'T3']);
  for (const t of R.tests) {
    assert.equal(t.pass, false);
    assert.equal(t.placebo.t.length, 40);
    const f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
    assert.ok(RES.includes(`| ${f(t.oos.net)} |`), `${t.id} OOS net in the report`);
    assert.ok(RES.includes(t.holm.toFixed(3)), `${t.id} Holm p in the report`);
  }
  const t1 = R.tests[0];
  assert.ok(v[1].includes(`n ${t1.oos.n}`) && v[1].includes(String(Math.abs(t1.oos.tMonth))));
});
