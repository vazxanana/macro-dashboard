// research/edge/gold-quarter-end: quarter / month ends from the candles, the side rule, the T3 filter, the trade with its
// H1 stop on hand-made candles, no look-ahead, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, trade, events, largeOnly, sideOf, monthT, holm, COST, HOLD, dateOf } from '../research/edge/gold-quarter-end/run.mjs';

const dir = new URL('../research/edge/gold-quarter-end/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// hand-made daily candles every calendar day from 2024-01-01 (weekends get folded)
function rows(n, f) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000; for (let k = 0; k < n; k++, t += 86400) out.push(f(k, t)); return out; }

test('events: quarter TD-5 -> TD-1 with the previous quarter end; month events skip quarter months', () => {
  const P = prepare(rows(200, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  const q = events(P, 'q'), m = events(P, 'm');
  const e = q[0];                                               // Q2 2024 (Q1 has no previous quarter end on file)
  assert.equal(e.mk, '2024-06');
  assert.equal(dateOf(P.bars[e.j].time), '2024-06-28');
  assert.equal(dateOf(P.bars[e.i].time), '2024-06-24');          // TD-5 = 4 candles before TD-1
  assert.equal(e.j - e.i, HOLD);
  assert.equal(dateOf(P.bars[e.p].time), '2024-03-29');
  assert.equal(e.side, -1);                                       // rising quarter -> sell
  assert.ok(m.every((x) => !['03', '06', '09', '12'].includes(x.mk.slice(5))));
  assert.equal(dateOf(P.bars[m[0].p].time), '2024-01-31');        // February's month-to-date from January's end
  assert.equal(sideOf(-0.01), 1); assert.equal(sideOf(0), 0);
});

test('T3: only |q| above the median of the 8 previous quarters', () => {
  const ev = [1, 2, 3, 4, 5, 6, 7, 8, 4.4, 4.8, -9].map((q, k) => ({ k, q }));
  const got = largeOnly(ev).map((x) => x.k);
  assert.deepEqual(got, [9, 10]);                                 // medians 4.5 (4.4 out), 4.7 (4.8 in), 4.9 (-9 in)
});

test('trade: stop on H1 with gap fill at the open, costs, financing on buys only', () => {
  const D = rows(60, (i, t) => [t, 100, 101, 99, 100, 1]);
  const P0 = prepare(D);
  const i = 30, j = 34, t0 = P0.bars[i].time + 86400;
  // flat H1 path, then an H1 candle on the 2nd day that opens 5 below the entry: a buy is stopped at that open
  const h1 = []; for (let t = t0; t < P0.bars[j].time + 86400; t += 3600) h1.push([t, 100, 100.2, 99.8, 100]);
  const gapAt = h1.findIndex((x) => x[0] >= P0.bars[i + 2].time); h1[gapAt] = [h1[gapAt][0], 95, 95.5, 94.5, 95];
  const P = prepare(D, h1);
  const L = trade(P, i, j, 1), S = trade(P, i, j, -1);
  assert.equal(L.how, 'stop'); assert.equal(L.src, 'h1'); assert.equal(L.exit, 95); assert.ok(L.R < -1);
  assert.ok(L.fin > 0); assert.equal(S.fin, 0); assert.equal(S.how, 'time');
  assert.ok(Math.abs(L.net - (L.R - COST / L.risk - L.fin)) < 1e-12);
  assert.ok(Math.abs(L.net2 - (L.R - 2 * COST / L.risk - 2 * L.fin)) < 1e-12);
  assert.equal(Math.round(L.risk * 1e6) / 1e6, 3);               // 1.5 x ATR(20) of 2-wide candles
  assert.equal(trade(P, 5, 9, 1), null);                          // no ATR(20) yet
  assert.equal(trade(P0, i, j, 1).src, 'daily');                  // no H1 on file: the daily fallback
});

test('no look-ahead: prices after the exit (daily and H1) and the side rule after the entry move nothing', () => {
  const base = (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i), 98 + Math.sin(i), 100 + Math.cos(i), 1];
  const a = rows(200, base), b = a.map((r, i) => i > 120 ? [r[0], 999, 1999, 1, 500, 1] : r);
  const h1 = (D) => D.flatMap(([t, o, h, l, c]) => [[t, o, h, l, o], [t + 3600 * 23, o, h, l, c]]);
  const Pa = prepare(a, h1(a)), Pb = prepare(b, h1(b));
  assert.deepEqual(trade(Pa, 60, 64, 1), trade(Pb, 60, 64, 1));
  const ea = events(Pa, 'q').filter((e) => e.j < 80), eb = events(Pb, 'q').filter((e) => e.j < 80);
  assert.deepEqual(ea, eb);
});

test('statistics: month sums and Holm', () => {
  const T = [{ a: '2020-01-02', net: 1 }, { a: '2020-01-09', net: 1 }, { a: '2020-02-03', net: 1 }, { a: '2020-03-03', net: 3 }];
  const m = monthT(T); assert.equal(m.months, 3); assert.ok(m.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report matches result.json, verdict line', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []);
  const line = MD.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.ok(line.length < 220, line);
  const f = (x) => (x > 0 ? '+' : '') + x.toFixed(3), r = R.results;
  assert.ok(line.includes(f(r.T1.OOS.net) + 'R') && line.includes(`n ${r.T1.OOS.n}`) && line.includes(`t ${r.T1.OOS.tNet.toFixed(2)}`));
  assert.ok(line.includes(f(r.T1.IS.net) + 'R') && line.includes(`${r.T1.placebo.beaten} of 40`));
  for (const k of ['T1', 'T2', 'T3']) {
    for (const w of ['IS', 'OOS']) {
      const s = r[k][w];
      assert.ok(MD.includes(`| ${s.n} | ${f(s.net)} | ${s.tNet.toFixed(2)} | ${f(s.gross)} |`), `${k} ${w}`);
    }
    assert.ok(MD.includes(`${r[k].placebo.beaten} / 40`), k);
    assert.equal(r[k].pass, false);
  }
  assert.equal(R.data.parity.within2c, R.data.parity.days);
});
