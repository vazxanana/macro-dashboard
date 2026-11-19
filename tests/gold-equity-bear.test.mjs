// Gold-equity-bear study (research/edge/gold-equity-bear): the drawdown signal on hand-made candles (no look-ahead), the entry at
// gold's next open, stop and gap exits, financing by the live nights() rule, one position at a time, the statistics, and the
// written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { drawdowns, entryIndex, atrBefore, tradeAt, simulate, monthly, holm, normP, sample, rng, RT, K_ATR, HOLD, LOOK } from '../research/edge/gold-equity-bear/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const RES = rd('../research/edge/gold-equity-bear/RESULT.md'), PRE = rd('../research/edge/gold-equity-bear/PREREGISTRATION.md');
const R = JSON.parse(rd('../research/edge/gold-equity-bear/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T0 = Date.UTC(2021, 0, 4) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let d = T0; out.length < n; d += 86400) { const w = new Date(d * 1000).getUTCDay(); if (w && w < 6) out.push(d); } return out; };
const bars = (closes) => weekdays(closes.length).map((time, i) => ({ time, open: i ? closes[i - 1] : closes[0], high: Math.max(closes[i], i ? closes[i - 1] : closes[0]) + 1, low: Math.min(closes[i], i ? closes[i - 1] : closes[0]) - 1, close: closes[i] }));

test('drawdown = close against the highest close of the 252 candles ending at the day; later prices never change it', () => {
  const closes = new Array(400).fill(100); closes[100] = 200; closes[280] = 170;
  const b = bars(closes), d = drawdowns(b);
  assert.equal(d.length, 400 - LOOK + 1);
  assert.equal(d[0].t, b[LOOK - 1].time);
  const at = (i) => d.find((x) => x.t === b[i].time).dd;
  near(at(280), 170 / 200 - 1);                                   // the 200 high is inside the 252 window
  near(at(100 + LOOK), 100 / 170 - 1);                              // ... and has left it 252 candles later
  const c2 = closes.slice(); for (let i = 281; i < 400; i++) c2[i] = 999;
  near(drawdowns(bars(c2)).find((x) => x.t === b[280].time).dd, at(280));
});

test('entry is gold\'s first candle after the signal day, ATR only from candles before it', () => {
  const g = bars(new Array(40).fill(0).map((_, i) => 1000 + i));
  const fri = g.find((x) => new Date(x.time * 1000).getUTCDay() === 5 && x.time > g[25].time);
  assert.equal(new Date(g[entryIndex(g, fri.time)].time * 1000).getUTCDay(), 1);
  const a = atrBefore(g, 30), g2 = g.map((x, i) => (i >= 30 ? { ...x, high: x.high + 50 } : x));
  near(atrBefore(g2, 30), a);
  assert.equal(atrBefore(g, 20), null);
});

test('stop 2 x ATR below the open, a gap at its open, else the 20th close; costs = $0.60 + nights() x FIN', () => {
  const g = bars(new Array(60).fill(1000)), j = 25;
  let tr = tradeAt(g, j);
  near(tr.risk, K_ATR * atrBefore(g, j)); near(tr.stop, 1000 - tr.risk);
  assert.equal(tr.kind, 'time'); assert.equal(tr.k, j + HOLD - 1);
  near(tr.fin, nights(tr.t, tr.c) * FIN.xau.long * 1000 / tr.risk); near(tr.net, tr.gross - RT / tr.risk - tr.fin);
  near(tradeAt(g, j, HOLD, 2).net, tr.gross - 2 * (RT / tr.risk + tr.fin));
  const g2 = g.slice(); g2[j + 3] = { ...g2[j + 3], open: 900, low: 890 };
  tr = tradeAt(g2, j); assert.equal(tr.kind, 'gap'); near(tr.exit, 900);
  const g3 = g.slice(); g3[j + 2] = { ...g3[j + 2], low: 990 };
  tr = tradeAt(g3, j); assert.equal(tr.kind, 'stop'); near(tr.gross, -1);
  assert.equal(tradeAt(g, 50), null, 'a trade that runs past the data is left out');
});

test('one position at a time; the baseline may overlap', () => {
  const g = bars(new Array(80).fill(1000));
  const days = g.slice(25, 30).map((x) => ({ t: x.time }));
  assert.equal(simulate(days, g).length, 1);
  assert.equal(simulate(days, g, HOLD, { free: true }).length, 5);
});

test('statistics: month sums with empty months, Holm, the normal tail, a seeded sample', () => {
  const t0 = Date.UTC(2020, 0, 1) / 1000, t1 = Date.UTC(2020, 11, 31) / 1000;
  const m = monthly([{ c: Date.UTC(2020, 1, 3) / 1000, v: 1 }, { c: Date.UTC(2020, 1, 9) / 1000, v: 1 }], t0, t1, 'v');
  assert.equal(m.months, 12); near(m.sum, 2);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  near(normP(0), 0.5, 1e-6); near(normP(1.96), 0.025, 1e-3);
  const arr = new Array(50).fill(0).map((_, i) => ({ t: i }));
  assert.deepEqual(sample(arr, 5, rng(7)), sample(arr, 5, rng(7)));
});

test('the report matches result.json and the pre-registration', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.passed, 0); assert.equal(R.tests.length, 3);
  const t1 = R.tests[0];
  assert.ok(RES.includes(`**Verdict: ${R.headline}**`));
  assert.ok(R.headline.length < 220);
  for (const t of R.tests) {
    assert.equal(t.placebo.ts.length, 40);
    assert.ok(t.oos.medianStopUsd >= 10 && t.is.medianStopUsd >= 10);
    assert.ok(RES.includes(`${t.placebo.beaten} of 40`));
    assert.ok(RES.includes(`| ${t.oos.n} |`));
  }
  assert.ok(RES.includes(String(t1.oos.excess).replace('-', '−')));
  const y2223 = t1.trades.filter((x) => /^202[23]/.test(x.entry));
  assert.ok(RES.includes(`${y2223.length} were entered in 2022-23 and ${y2223.filter((x) => x.kind !== 'time').length} of those were stopped`));
  assert.ok(PRE.includes('$0.60 a round trip') && PRE.includes('T1 | spx500 | 10 %'));
});
