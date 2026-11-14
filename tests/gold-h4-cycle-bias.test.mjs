// gold-h4-cycle-bias: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dayEnd, h4Start, toDays, structure, signals, makeSim, atrBefore, monthT, holm, pOf, rng, RT, ATR_K, TESTS }
  from '../research/edge/gold-h4-cycle-bias/run.mjs';
import { FIN } from '../council/fills.mjs';

const dir = new URL('../research/edge/gold-h4-cycle-bias/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
const H = 3600, at = (s) => Date.parse(s) / 1000;

test('New York days and H4 blocks start at 17:00 New York, daylight saving correct', () => {
  assert.equal(dayEnd(at('2024-07-10T20:00:00Z')), at('2024-07-10T21:00:00Z'));   // EDT: 17:00 NY = 21:00 UTC
  assert.equal(dayEnd(at('2024-07-10T21:00:00Z')), at('2024-07-11T21:00:00Z'));
  assert.equal(dayEnd(at('2024-01-10T21:00:00Z')), at('2024-01-10T22:00:00Z'));   // EST: 22:00 UTC
  assert.equal(h4Start(at('2024-01-11T05:00:00Z')), at('2024-01-11T02:00:00Z'));
});

const bar = (h, l, c) => ({ h, l, c });
test('structure: a 3-a-side swing is known only after the third candle closes; a close beyond it flips the state', () => {
  // swing high 110 at index 3, known at the close of index 6
  const b = [bar(100, 99, 99.5), bar(101, 99, 100), bar(102, 100, 101), bar(110, 101, 102), bar(103, 101, 102),
    bar(104, 101, 102), bar(105, 101, 103), bar(111, 102, 110.5), bar(112, 104, 111)];
  const s = structure(b);
  assert.deepEqual(s.map((x) => x.st), [0, 0, 0, 0, 0, 0, 0, 1, 1]);
  assert.equal(s[7].flip, 1); assert.equal(s[8].flip, 0);
  // the same close one candle earlier (before the swing is known) does not flip
  const early = b.slice(0, 6).concat([bar(111, 102, 110.5)]);
  assert.equal(structure(early)[6].st, 0);
  // changing later candles never changes earlier states (no look-ahead)
  const alt = b.slice(0, 7).concat([bar(100, 90, 91), bar(95, 80, 81)]);
  assert.deepEqual(structure(alt).slice(0, 7), s.slice(0, 7));
});

// H1 candles from a closing-price path (a wick of 0.2 beyond the close in the candle's direction, 0.05 beyond the open)
function path(closes, t0 = at('2020-01-06T23:00:00Z')) {
  let p = closes[0];
  return closes.map((c, i) => { const r = [t0 + i * H, p, c > p ? c + 0.2 : p + 0.05, c < p ? c - 0.2 : p - 0.05, c]; p = c; return r; });
}
function upMove() {
  const c = []; let p = 100; const seg = (n, d) => { for (let i = 0; i < n; i++) { p += d; c.push(p); } };
  for (let k = 0; k < 4; k++) { seg(12, 1); seg(12, -1); }   // H4 swings
  seg(40, 1.5);                                               // rally: H4 close above a swing high, H1 up
  seg(4, -1); seg(3, 1); seg(8, -1.5);                        // H1 pullback: close below an H1 swing low
  seg(3, 0.8); seg(6, -0.5); seg(12, 1.5);                    // resume: H1 close above the last H1 swing high
  seg(60, 0.05);
  return c;
}

test('a buy signal after the H1 pullback inside an H4 up move; the mirror path gives a sell; no look-ahead', () => {
  const h1 = path(upMove()), sig = signals(h1);
  assert.ok(sig.some((s) => s.side === 1), 'a buy');
  const first = sig.find((s) => s.side === 1);
  const mir = h1.map(([t, o, h, l, c]) => [t, 400 - o, 400 - l, 400 - h, 400 - c]);
  const ms = signals(mir);
  assert.ok(ms.some((s) => s.side === -1 && s.k === first.k), 'mirror sell at the same candle');
  // rewriting every candle after the signal leaves the signal (and everything before it) unchanged
  const cut = h1.slice(0, first.k + 1).concat(h1.slice(first.k + 1).map(([t]) => [t, 1, 1.1, 0.9, 1]));
  assert.deepEqual(signals(cut).filter((s) => s.k <= first.k), sig.filter((s) => s.k <= first.k));
});

test('the trade: next-day 17:00 New York exit, stop 2 x ATR(14), costs and financing on buys', () => {
  const h1 = path(upMove().concat(Array.from({ length: 200 }, (_, i) => 200 + Math.sin(i) * 3)));
  const days = toDays(h1), sim = makeSim(h1, days), e = days[16].k0 + 3;
  const x = sim(e, 1), atr = atrBefore(days, 16);
  assert.ok(Math.abs(x.risk - ATR_K * atr) < 1e-9);
  if (x.how === 'time') assert.equal(x.exitT, days[17].end);
  assert.ok(Math.abs(x.cost - RT / x.risk) < 1e-12);
  assert.ok(Math.abs(x.fin - x.nights * FIN.xau.long * x.entry / x.risk) < 1e-12);
  assert.ok(Math.abs(x.net - (x.gross - x.cost - x.fin)) < 1e-12);
  const s = sim(e, -1); assert.equal(s.fin, 0); assert.equal(s.nights, 0);
  // a candle opening through the stop fills at its open
  const g = h1.map((r) => r.slice()); const q = e + 2, stop = x.entry - x.risk;
  g[q] = [g[q][0], stop - 5, stop - 4, stop - 6, stop - 5];
  const y = makeSim(g, toDays(g))(e, 1);
  assert.equal(y.how, 'stop'); assert.equal(y.exit, stop - 5);
});

test('statistics: month t counts empty months, Holm, one-sided p, seeded rng', () => {
  const rows = [{ entryT: at('2020-01-05T00:00:00Z'), v: 1 }, { entryT: at('2020-03-05T00:00:00Z'), v: 2 }];
  const t = monthT(rows, 'v', ['2020-01-01', '2020-03-31']);   // months 1, 0, 2: mean 1, sd 1
  assert.ok(Math.abs(t - Math.sqrt(3)) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(pOf(1.96) - 0.025) < 1e-3); assert.ok(pOf(-1) > 0.5);
  assert.equal(rng(5)(), rng(5)());
});

test('the report agrees with result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.match(MD, /\*\*Verdict: FAIL, 0 of 3:[^*]+\*\*/);
  assert.deepEqual(Object.keys(R.tests), Object.keys(TESTS));
  const f3 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3), f2 = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
  for (const id of ['T1', 'T2', 'T3']) for (const w of ['is', 'oos']) {
    const s = R.tests[id][w], n = s.n.toLocaleString('en-US');
    const row = `| ${n} | ${f3(s.gross)} | ${f3(s.net)} | ${f3(s.excess)} | ${f2(s.tGross)} | ${f2(s.tNet)} | ${f2(s.tExcess)} |`;
    assert.ok(MD.includes(row), `${id} ${w}: ${row}`);
    assert.ok(s.n >= 100, `${id} ${w} n`);
  }
  for (const id of ['T1', 'T2', 'T3']) assert.ok(MD.includes(R.tests[id].holm.toFixed(3)), `${id} Holm`);
  assert.ok(MD.includes(`beats ${R.nulls.placebo.beaten} of 40`)); assert.ok(MD.includes(`real beats ${R.nulls.control.beaten} of 40`));
  assert.ok(R.tests.T1.oos.tExcess < 2 && R.tests.T1.holm > 0.05);
  // pre-registration: the windows, costs and counts read before
  assert.match(PRE, /2007-01-01 to 2016-12-31, out of sample 2017-01-01 to 2026-10-31/);
  assert.match(PRE, /\$0\.60 a round trip/); assert.match(PRE, /\| 2007-16 \| 834 \| 455 \| 2,918 \|/);
  const headline = MD.match(/\*\*Verdict: ([^*]+)\*\*/)[1];
  assert.ok(headline.length < 220, `headline ${headline.length}`);
});
