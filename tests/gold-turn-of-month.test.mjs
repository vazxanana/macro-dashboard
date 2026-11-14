// research/edge/gold-turn-of-month: month ends from the candles, the windows, the trade on hand-made candles, no look-ahead,
// and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, trade, events, monthEnds, monthT, holm, COST, TESTS, dateOf } from '../research/edge/gold-turn-of-month/run.mjs';

const dir = new URL('../research/edge/gold-turn-of-month/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// hand-made candles every calendar day from 2024-01-01 (weekends get folded)
function rows(n, f) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000; for (let k = 0; k < n; k++, t += 86400) out.push(f(k, t)); return out; }

test('month ends: last weekday candle of each month; the file\'s own last month has none', () => {
  const P = prepare(rows(100, (i, t) => [t, 100, 101, 99, 100, 1]));
  const E = monthEnds(P.bars);
  assert.equal(dateOf(P.bars[E.get('2024-01')].time), '2024-01-31');
  assert.equal(dateOf(P.bars[E.get('2024-03')].time), '2024-03-29');   // 30-31 Mar are a weekend
  assert.equal(E.has('2024-04'), false);                                  // the file ends 9 Apr
});

test('windows: T1 TD-2 -> TD+3, T2 TD-4 -> TD-1, T3 TD-1 -> TD+5', () => {
  const P = prepare(rows(100, (i, t) => [t, 100, 101, 99, 100, 1]));
  const d = (e) => [dateOf(P.bars[e.i].time), dateOf(P.bars[e.j].time)];
  const first = (k) => events(P, k).find((e) => e.mk === '2024-01');
  assert.deepEqual(d(first('T1')), ['2024-01-30', '2024-02-05']);
  assert.deepEqual(d(first('T2')), ['2024-01-26', '2024-01-31']);
  assert.deepEqual(d(first('T3')), ['2024-01-31', '2024-02-07']);
  assert.deepEqual(Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.side])), { T1: 1, T2: -1, T3: 1 });
});

test('trade: R, stop, costs, financing on longs only', () => {
  const P = prepare(rows(60, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  // weekday k: close 100 + calendar index; TR = 2 on a day after a weekday, larger after a fold
  const L = trade(P, 25, 35, 1), S = trade(P, 25, 35, -1);
  assert.ok(L.risk > 0 && L.R > 0); assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(L.net - (L.R - COST / L.risk - L.fin)) < 1e-12);
  assert.equal(S.how, 'stop'); assert.ok(Math.abs(S.R + 1) < 1e-9);
  assert.equal(trade(P, 5, 8, 1), null);                                 // no ATR(20) yet
});

test('no look-ahead: prices after the exit do not move a trade', () => {
  const base = (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i), 98 + Math.sin(i), 100 + Math.cos(i), 1];
  const a = rows(80, base), b = a.map((r, i) => i > 50 ? [r[0], 999, 1999, 1, 500, 1] : r);
  const Pa = prepare(a), Pb = prepare(b);
  assert.deepEqual(trade(Pa, 25, 29, 1), trade(Pb, 25, 29, 1));
  assert.deepEqual(trade(Pa, 25, 29, -1), trade(Pb, 25, 29, -1));
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
  const T1 = R.tests.T1;
  assert.ok(line.includes(T1.oos.net.toFixed(3)) && line.includes(`n ${T1.oos.n}`) && line.includes(T1.oos.tNet.toFixed(2)) && line.includes(`${T1.placebo.beaten} of 40`));
  for (const k of ['T1', 'T2', 'T3']) { const r = R.tests[k];
    for (const w of ['oos', 'is']) { const x = r[w];
      const sign = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
      assert.ok(MD.includes(`| ${x.n} | ${sign(x.net)} | ${x.tNet.toFixed(2)} | ${sign(x.gross)} |`), `${k} ${w}`); }
    assert.ok(MD.includes(`| ${r.holm} | ${r.placebo.beaten} |`), `${k} placebo`);
    assert.equal(r.pass, false); }
  assert.ok(!/is an edge/.test(MD.replace('Nothing is an edge here', '')));
});
