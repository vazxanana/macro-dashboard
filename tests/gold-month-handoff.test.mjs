// research/edge/gold-month-handoff: month ends and the signal from the candles, the trade and the baseline on hand-made
// candles, no look-ahead, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, trade, signals, monthEnds, baselines, baseOf, monthT, holm, lookSide, COST, TESTS, dateOf } from '../research/edge/gold-month-handoff/run.mjs';

const dir = new URL('../research/edge/gold-month-handoff/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// hand-made candles every calendar day from 2024-01-01 (weekends get folded)
function rows(n, f) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000; for (let k = 0; k < n; k++, t += 86400) out.push(f(k, t)); return out; }

test('month ends: last weekday candle of each month; the file\'s own last month has none', () => {
  const P = prepare(rows(100, (i, t) => [t, 100, 101, 99, 100, 1]));
  const E = new Map(monthEnds(P.bars));
  assert.equal(dateOf(P.bars[E.get('2024-01')].time), '2024-01-31');
  assert.equal(dateOf(P.bars[E.get('2024-03')].time), '2024-03-29');
  assert.equal(E.has('2024-04'), false);
});

test('signal: sign of the month\'s close-to-close return, first month skipped, flat month no trade', () => {
  // up through February, down through March
  const P = prepare(rows(100, (i, t) => { const c = i < 60 ? 100 + i : 160 - (i - 60); return [t, c, c + 1, c - 1, c, 1]; }));
  const S = signals(P.bars);
  assert.deepEqual(S.map((e) => [e.mk, e.side]), [['2024-02', 1], ['2024-03', -1]]);
  const flat = prepare(rows(100, (i, t) => [t, 100, 101, 99, 100, 1]));
  assert.equal(signals(flat.bars).length, 0);
  assert.deepEqual(Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.h])), { T1: 5, T2: 3, T3: 10 });
});

test('trade: R, stop, costs, financing on buys only; baseline by year and side', () => {
  const P = prepare(rows(60, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  const L = trade(P, 25, 10, 1), S = trade(P, 25, 10, -1);
  assert.ok(L.risk > 0 && L.R > 0 && L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(L.net - (L.R - COST / L.risk - L.fin)) < 1e-12);
  assert.equal(S.how, 'stop'); assert.ok(Math.abs(S.R + 1) < 1e-9);
  assert.equal(trade(P, 5, 3, 1), null);
  const B = baselines(P, 3);
  assert.ok(baseOf(B, '2024-02-01', 1) > 0 && baseOf(B, '2024-02-01', -1) < 0);
});

test('no look-ahead: prices after the exit move neither the signal nor the trade', () => {
  const base = (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i), 98 + Math.sin(i), 100 + Math.cos(i / 3) * 5, 1];
  const a = rows(130, base), b = a.map((r, i) => i > 100 ? [r[0], 999, 1999, 1, 500, 1] : r);
  const Pa = prepare(a), Pb = prepare(b);
  const ea = signals(Pa.bars).find((e) => e.mk === '2024-02'), eb = signals(Pb.bars).find((e) => e.mk === '2024-02');
  assert.deepEqual(ea, eb);
  assert.deepEqual(trade(Pa, ea.i, 5, ea.side), trade(Pb, eb.i, 5, eb.side));
  assert.equal(lookSide(Pa.bars, 40), lookSide(Pb.bars, 40));
});

test('statistics: month sums and Holm', () => {
  const T = [{ a: '2020-01-02', net: 1 }, { a: '2020-01-09', net: 1 }, { a: '2020-02-03', net: 1 }, { a: '2020-03-03', net: 3 }];
  const m = monthT(T); assert.equal(m.months, 3); assert.ok(m.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report matches result.json, verdict line', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []);
  assert.ok(R.data.eventsIS >= 100 && R.data.eventsOOS >= 100);
  const line = MD.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.ok(line.length < 220, line);
  const T1 = R.tests.T1, sign = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
  assert.ok(line.includes(sign(T1.oos.excess)) && line.includes(`n ${T1.oos.n}`) && line.includes(T1.oos.tExcess.toFixed(2))
    && line.includes(sign(T1.is.excess)) && line.includes(`${T1.placebo.beaten} of 40`));
  for (const k of ['T1', 'T2', 'T3']) { const r = R.tests[k];
    for (const w of ['oos', 'is']) { const x = r[w];
      assert.ok(MD.includes(`| ${x.n} | ${sign(x.excess)} | ${x.tExcess.toFixed(2)} | ${sign(x.net)} | ${x.tNet.toFixed(2)} | ${sign(x.gross)} |`), `${k} ${w}`); }
    assert.ok(MD.includes(`| ${r.holm} | ${r.placebo.beaten} |`), `${k} placebo`);
    assert.equal(r.pass, false); }
  assert.ok(!/is an edge/.test(MD.replace('Nothing is an edge here', '')));
});
