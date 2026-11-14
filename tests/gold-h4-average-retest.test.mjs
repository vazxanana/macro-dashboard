// research/edge/gold-h4-average-retest: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, indicators, signalAt, trade, baseline, monthSums, holm, shuffledPath, oneAtATime, tOf, pOne } from '../research/edge/gold-h4-average-retest/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const H4 = 14400, T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday, OOS
const flat = (n, px = 1000, rng = 10) => Array.from({ length: n }, (_, k) => ({ time: T0 + k * H4, open: px, high: px + rng / 2, low: px - rng / 2, close: px }));
const add = (bs, o, h, l, c) => { bs.push({ time: bs.at(-1).time + H4, open: o, high: h, low: l, close: c }); return bs.length - 1; };

test('parameters as pre-registered', () => {
  assert.deepEqual([P.maN, P.atrN, P.slopeN, P.band, P.prior, P.priorN, P.stopAtr, P.hold, P.cost, P.minN, P.seeds, P.needBeat],
    [300, 42, 30, 1, 3, 120, 3, 30, 0.60, 100, 40, 38]);
  assert.deepEqual([P.isFrom, P.isTo, P.oosFrom, P.oosTo], ['2007-01-01', '2016-12-31', '2017-01-01', '2026-10-31']);
  assert.deepEqual(TESTS.map((t) => t.sides), [[1], [-1], [1, -1]]);
});

test('SMA, ATR and d from candles up to the candle; no look-ahead', () => {
  const bs = flat(320);
  const I = indicators(bs);
  assert.equal(I.S[P.maN - 2], null); assert.equal(I.S[P.maN - 1], 1000);
  assert.equal(I.A[P.atrN - 1], null); assert.equal(I.A[P.atrN], 10);
  assert.equal(I.d[310], 0);
  const i = add(bs, 1000, 1025, 995, 1020); const I1 = indicators(bs);
  add(bs, 1020, 9000, 1, 5000); add(bs, 5000, 5001, 4999, 5000); const I2 = indicators(bs);
  assert.equal(I2.S[i], I1.S[i]); assert.equal(I2.A[i], I1.A[i]); assert.equal(I2.d[i], I1.d[i]);
});

test('signal: first close back within 1 ATR of a rising (falling) average after a 3-ATR run', () => {
  const n = 400, S = Array.from({ length: n }, (_, k) => 1000 + k), d = new Array(n).fill(2);
  d[300] = 3.5; d[349] = 1.5; d[350] = 0.5;
  const I = { S, d };
  assert.equal(signalAt(I, 350), 1);
  assert.equal(signalAt(I, 349), 0); // still above the band
  assert.equal(signalAt({ S, d: d.map((v, k) => (k === 350 ? -1.2 : v)) }, 350), 0); // through the average: no signal
  assert.equal(signalAt({ S, d: d.map((v, k) => (k === 300 ? 2.9 : v)) }, 350), 0); // no 3-ATR run in the last 120 candles
  assert.equal(signalAt({ S, d: d.map((v, k) => (k === 300 ? 2 : k === 229 ? 3.1 : v)) }, 350), 0); // the run is 121 candles back
  assert.equal(signalAt({ S, d: d.map((v, k) => (k === 300 ? 2 : k === 230 ? 3.1 : v)) }, 350), 1); // 120 candles back counts
  assert.equal(signalAt({ S: S.map((v) => -v), d }, 350), 0); // falling average: no buy
  const dn = d.map((v) => -v), Sd = S.map((v) => 5000 - v);
  assert.equal(signalAt({ S: Sd, d: dn }, 350), -1); // the mirror sell
});

test('entry next open, 3 x ATR stop, 30-candle time exit, costs and financing on buys only', () => {
  const bs = flat(320); const i = 310, I = indicators(bs), atr = I.A[i], risk = 3 * atr;
  for (let k = 0; k < 40; k++) add(bs, 1000, 1004, 996, 1000 + (k === 29 ? 6 : 0));
  const I2 = indicators(bs);
  const t = trade(bs, I2, i, 1);
  assert.equal(t.entry, 1000); assert.equal(t.why, 'time'); assert.equal(t.xi, i + P.hold);
  assert.ok(Math.abs(t.stop - (1000 - risk)) < 1e-9);
  assert.ok(Math.abs(t.R - (bs[i + P.hold].close - 1000) / risk) < 1e-12);
  const nn = nights(bs[i + 1].time, bs[i + P.hold].time + H4); assert.equal(t.nights, nn); assert.ok(nn > 0);
  assert.ok(Math.abs(t.finR - nn * FIN.xau.long * 1000 / risk) < 1e-12);
  assert.ok(Math.abs(t.net - (t.R - 0.6 / risk - t.finR)) < 1e-12);
  const s = trade(bs, I2, i, -1); assert.equal(s.finR, 0); assert.equal(s.nights, 0);
  const x2 = trade(bs, I2, i, 1, 2); assert.ok(Math.abs(x2.finR - 2 * t.finR) < 1e-12); assert.ok(Math.abs(x2.costR - 2 * t.costR) < 1e-12);
  assert.equal(trade(bs, I2, bs.length - 10, 1), null); // 30 candles past the data: not taken
});

test('the stop wins on its candle; a later open past the stop fills at the open', () => {
  const bs = flat(320); const i = 310; add(bs, 1000, 1004, 950, 1000); for (let k = 0; k < 35; k++) add(bs, 1000, 1004, 996, 1000);
  const t = trade(bs, indicators(bs), i, 1); assert.equal(t.why, 'stop'); assert.equal(t.R, -1);
  const g = flat(320); add(g, 1000, 1004, 996, 999); add(g, 900, 905, 895, 900); for (let k = 0; k < 35; k++) add(g, 900, 904, 896, 900);
  const tg = trade(g, indicators(g), 310, 1); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 900);
});

test('baseline, month sums, t, Holm, one position at a time, shuffled path', () => {
  const bs = flat(400); const I = indicators(bs);
  const B = baseline(bs, I, 1, 'oos'); assert.equal(B.n, 400 - 1 - P.atrN - (P.hold - 1));
  assert.equal(baseline(bs, I, 1, 'is').n, 0);
  assert.deepEqual(monthSums([{ d: '2024-01-05', x: 1 }, { d: '2024-03-02', x: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.ok(Math.abs(tOf([1, 2, 3]) - 2 / Math.sqrt(1 / 3)) < 1e-9); assert.equal(pOne(null), 1);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.deepEqual(oneAtATime([{ ei: 1, xi: 30 }, { ei: 10, xi: 40 }, { ei: 31, xi: 60 }]).map((t) => t.ei), [1, 31]);
  const r = flat(50).map((b, k) => ({ ...b, open: 100 + k, high: 102 + k, low: 99 + k, close: 101 + k }));
  const s1 = shuffledPath(r, 7), s2 = shuffledPath(r, 7);
  assert.deepEqual(s1, s2); assert.equal(s1.length, r.length); assert.deepEqual(s1[0], r[0]);
  assert.ok(s1.every((b, k) => b.time === r[k].time && b.high >= b.open && b.low <= b.open));
  // the product of the close-to-close ratios (the year's drift) is kept
  const drift = (p) => p.at(-1).close / p[0].close; assert.ok(Math.abs(drift(s1) - drift(r)) < 1e-9);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-h4-average-retest/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-h4-average-retest/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict},`)); assert.ok(vl.length < 220);
  assert.equal(r.verdict, 'FAIL'); assert.equal(r.passed.length, 0);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
  const ft = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
  const lines = md.split('\n');
  for (const [id, label] of [['T1', 'T1 buy'], ['T2', 'T2 sell'], ['T3', 'T3 both']]) {
    const g = r.tests[id];
    for (const [w, key] of [['IS', 'is'], ['OOS', 'oos']]) {
      const row = lines.find((l) => l.includes(label) && l.includes(`| ${w} `));
      const c = row.split('|').map((x) => x.trim());
      assert.equal(c[3], String(g[key].excess.n), `${id} ${w} n`);
      assert.equal(c[5], f(g[key].excess.mean)); assert.equal(c[6], ft(g[key].excess.monthT));
      assert.equal(c[7], f(g[key].net.mean)); assert.equal(c[8], ft(g[key].net.monthT)); assert.equal(c[9], f(g[key].gross.mean));
      if (w === 'OOS') assert.equal(c[10], f(g.oos2x.mean));
    }
    const pr = lines.find((l) => l.startsWith(`| ${id} | `) && l.includes(' of 40 |'));
    assert.ok(pr.includes(`${g.placebo.beaten} of 40`)); assert.ok(pr.includes(`${g.control.beaten} of 40`));
    assert.ok(md.includes(`${id} ${g.holmP.toFixed(3)}`));
  }
  assert.ok(vl.includes(f(r.tests.T1.oos.excess.mean) + 'R')); assert.ok(vl.includes(`n ${r.tests.T1.oos.excess.n}`));
  assert.ok(vl.includes(ft(r.tests.T1.oos.excess.monthT))); assert.ok(vl.includes(f(r.tests.T1.is.excess.mean) + 'R'));
});
