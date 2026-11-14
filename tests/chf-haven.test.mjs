// chf-haven study (research/edge/chf-haven): the signal on hand-made candles (no look-ahead), the entry, stop and gap exits,
// one position at a time, the costs, the statistics, and the written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, entryIndex, atrBefore, tradeAt, simulate, monthly, holm, normP, sample, verdictOf, P, PAIRS } from '../research/edge/chf-haven/run.mjs';
import { nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const RES = rd('../research/edge/chf-haven/RESULT.md'), PRE = rd('../research/edge/chf-haven/PREREGISTRATION.md');
const R = JSON.parse(rd('../research/edge/chf-haven/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T0 = Date.UTC(2021, 0, 4) / 1000;   // a Monday
const weekdays = (n) => { const out = []; for (let d = T0; out.length < n; d += 86400) { const w = new Date(d * 1000).getUTCDay(); if (w && w < 6) out.push(d); } return out; };
const bars = (closes) => weekdays(closes.length).map((time, i) => { const o = i ? closes[i - 1] : closes[0]; return { time, open: o, high: Math.max(o, closes[i]) + 0.001, low: Math.min(o, closes[i]) - 0.001, close: closes[i] }; });
const zero = () => 0;

test('a signal is a fall beyond 2 sd of the 60 returns BEFORE the day; later prices never change it', () => {
  const c = [100]; for (let i = 1; i < 80; i++) c.push(c[i - 1] * (i % 2 ? 1.01 : 0.99));
  c[70] = c[69] * 0.95;
  const b = bars(c), s = signals(b);
  assert.equal(s[0].t, b[61].time, 'a day needs 61 earlier closes');
  const d = s.find((x) => x.t === b[70].time);
  assert.ok(d.sig); assert.equal(s.filter((x) => x.sig).length, 1);
  const c2 = c.slice(); c2[70] = c[69] * 0.5;
  near(signals(bars(c2)).find((x) => x.t === d.t).sd, d.sd);
  const c3 = c.slice(); for (let i = 71; i < 80; i++) c3[i] = 1;
  assert.deepEqual(signals(bars(c3)).find((x) => x.t === d.t), d);
  // a rise of the same size is no signal
  const c4 = c.slice(); c4[70] = c[69] * 1.05;
  assert.ok(!signals(bars(c4)).find((x) => x.t === d.t).sig);
});

test('entry is the pair\'s first candle after the signal day; ATR uses only candles before it', () => {
  const b = bars(new Array(40).fill(0).map((_, i) => 1 + i / 1000));
  const fri = b.find((x, i) => i > 25 && new Date(x.time * 1000).getUTCDay() === 5);
  const j = entryIndex(b, fri.time);
  assert.equal(new Date(b[j].time * 1000).getUTCDay(), 1);
  const a = atrBefore(b, j), b2 = b.map((x, i) => (i >= j ? { ...x, high: x.high + 5 } : x));
  near(atrBefore(b2, j), a);
  assert.ok(Number.isNaN(atrBefore(b, 10)));
});

test('a short: stop 2 ATR above, a gap through it fills at the open, else out at the fifth close', () => {
  const b = bars(new Array(40).fill(1));
  const i = 30, atr = atrBefore(b, i), stop = b[i].open + 2 * atr;
  const time = tradeAt(b, i, zero);
  assert.equal(time.how, 'time'); assert.equal(time.k, i + 4); near(time.gross, 0);
  const g = b.map((x, k) => (k === i + 2 ? { ...x, open: stop + 0.01, high: stop + 0.02 } : x));
  const gap = tradeAt(g, i, zero);
  assert.equal(gap.how, 'gap'); near(gap.exit, stop + 0.01); assert.ok(gap.gross < -1);
  const h = b.map((x, k) => (k === i + 1 ? { ...x, high: stop + 0.5 } : x));
  const st = tradeAt(h, i, zero);
  assert.equal(st.how, 'stop'); near(st.gross, -1);
  assert.equal(tradeAt(b, 37, zero), null, 'a hold past the data is dropped');
});

test('costs: 0.6 pip + 0.0045 % commission + financing per rollover; 2x doubles them', () => {
  const b = bars(new Array(40).fill(0.9));
  const fin = PAIRS.find((p) => p.k === 'usdchf').finNight;
  const t = tradeAt(b, 30, fin), risk = t.stop - t.entry;
  assert.equal(t.nights, nights(b[30].time, b[34].time + 86400));
  near(t.costR, (0.6 * P.pip + 0.000045 * 0.9 + t.nights * 0.0001314) / risk);
  near(tradeAt(b, 30, fin, 2).costR, 2 * t.costR);
});

test('one position at a time: a signal while in a trade is ignored', () => {
  const b = bars(new Array(60).fill(1));
  const tr = simulate(b, [b[30].time, b[31].time, b[34].time, b[40].time], zero);
  assert.deepEqual(tr.map((x) => x.i), [31, 41]);
  assert.equal(tr.ignored, 2);
});

test('statistics: month sums count empty months, Holm, normal p, seeded placebo per year', () => {
  const m = monthly([{ t: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { t: Date.UTC(2020, 2, 5) / 1000, net: 2 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 3, 1) / 1000);
  assert.deepEqual(m, [1, 0, 2, 0]);
  near(normP(0), 0.5, 1e-6); near(normP(1.6449), 0.05, 1e-4);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  const days = [2019, 2020].flatMap((y) => new Array(10).fill(0).map((_, k) => ({ t: Date.UTC(y, 0, 1 + k) / 1000, sig: k < (y === 2019 ? 2 : 3) })));
  const s = sample(days, 7);
  assert.deepEqual(s, sample(days, 7));
  assert.equal(s.filter((t) => new Date(t * 1000).getUTCFullYear() === 2020).length, 3);
  assert.equal(new Set(s).size, 5);
});

test('result.json: the bar applied, figures in RESULT.md, the verdict line first', () => {
  assert.equal(R.tests.length, 3);
  for (const c of R.tests) {
    assert.equal(verdictOf(c).pass, c.pass);
    assert.equal(c.placebo.means.length, 40);
    assert.ok(c.dec.n >= 30);
    const s = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
    assert.ok(RES.includes(`| ${c.test} ${c.name} | 2016-26 (decisive) | ${c.dec.n} | ${s(c.dec.gross)} | ${s(c.dec.net)} |`), c.test);
    assert.ok(RES.includes(`beats ${c.placeboBeaten} of 40`));
  }
  assert.equal(R.verdict, R.tests.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.ok(RES.startsWith(`**Verdict: ${R.verdict}, ${R.passed} of 3 tests.**`));
  assert.ok(PRE.includes('Signal on day t when r_t < −2 × sd_t') && PRE.includes('assumed 4.0 % a year') && PRE.includes('15 Jan 2015'));
  assert.ok(RES.includes('risk-spill-jpy') && RES.includes('gold-haven-shock'));
});
