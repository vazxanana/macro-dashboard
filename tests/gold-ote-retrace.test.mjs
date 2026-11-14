// The OTE retracement limit on gold: swings and impulses without look-ahead, the order and its stop, costs, Holm, the placebo,
// and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { h1From, impulses, order, stream, manage, costR, holm, placebo, monthT, trendAt, d1From, FIB, BUF, COST, VALID, HOLD } from '../research/edge/gold-ote-retrace/run.mjs';

const T0 = Date.UTC(2016, 0, 4) / 1000; // a Monday
// H1 shapes -> M5 rows (12 per hour; open, the extremes in the middle, close), so h1From gives these candles back
function m5Of(hours) {
  const out = [];
  hours.forEach(([o, h, l, c], i) => { const t = T0 + i * 3600;
    for (let k = 0; k < 12; k++) { const p = o + (c - o) * k / 11; out.push([t + k * 300, k ? out.at(-1)[4] : o, k === 4 ? h : Math.max(p, k ? out.at(-1)[4] : o), k === 7 ? l : Math.min(p, k ? out.at(-1)[4] : o), p]); } });
  return out;
}
const prep = (m5) => { const h1 = h1From(m5); h1.idx = new Int32Array(m5.length); h1.forEach((b, i) => { for (let k = b.a; k < b.b; k++) h1.idx[k] = i; }); return h1; };
// 20 quiet hours (ATR ~1), a swing high at hour 10 (101), a dip to 99 and a strong close above it at hour 16
function scene() {
  const H = [];
  for (let i = 0; i < 20; i++) H.push([100, 100.5, 99.5, 100]);
  H[10] = [100, 101, 99.6, 100.2];
  H[13] = [100, 100.2, 99, 99.4];
  H[16] = [99.6, 104, 99.5, 103.8];
  for (let i = 17; i < 24; i++) H[i] = [103.5, 103.9, 103, 103.4];
  H[20] = [103.4, 103.5, 100.3, 101.5]; // the retracement through 0.705 (100.475)
  for (let i = 24; i < 120; i++) H.push([101.5, 102, 101, 101.5]);
  return H;
}

test('pre-registered numbers', () => { assert.equal(FIB, 0.705); assert.equal(BUF, 0.30); assert.equal(COST, 0.60); assert.equal(VALID, 24); assert.equal(HOLD, 72); });

test('the impulse: a close above the confirmed swing high, origin the lowest low since it, entry at 0.705, stop under the origin', () => {
  const h1 = prep(m5Of(scene())), s = impulses(h1).filter((x) => x.side > 0)[0];
  assert.equal(s.j, 16); assert.equal(s.origin, 99); assert.equal(s.ext, 104);
  assert.ok(Math.abs(s.entry - (104 - FIB * 5)) < 1e-9); assert.ok(Math.abs(s.stop - (99 - BUF)) < 1e-9);
  assert.ok(s.entry > s.stop && s.t1 > s.entry && s.t2 > s.t1);
});

test('no look-ahead: changing every candle after the break changes neither the signal nor anything before it', () => {
  const a = scene(), b = scene().map((x, i) => (i > 16 ? [200, 210, 190, 205] : x));
  const sa = impulses(prep(m5Of(a))).filter((x) => x.j <= 16), sb = impulses(prep(m5Of(b))).filter((x) => x.j <= 16);
  assert.deepEqual(sa, sb);
  // a swing is known only once 3 later candles are closed: a break inside those 3 candles is no signal
  const c = scene(); c[12] = [100, 101.5, 99.8, 101.2]; c[13] = [100, 100.2, 99, 99.4];
  assert.ok(!impulses(prep(m5Of(c))).some((x) => x.side > 0 && x.j === 12));
});

test('the order fills at the limit, every trade has its stop on the losing side, the stop is first on a tie', () => {
  const m5 = m5Of(scene()), h1 = prep(m5), s = impulses(h1).filter((x) => x.side > 0)[0];
  const r = order(m5, h1, s, s.t1);
  assert.equal(r.status, 'filled'); const tr = r.trade;
  assert.ok(tr.entry <= s.entry + 1e-9 && tr.stop < tr.entry && tr.fillT > s.time);
  // one M5 candle through both stop and target: the stop
  const rows = [[0, 10, 10.1, 9.9, 10], [300, 10, 12, 8, 10]];
  assert.equal(manage(rows, 0, 1, 1, 9, 11).how, 'stop');
  // a gap through the stop fills at the open
  assert.deepEqual(manage([[0, 10, 10, 10, 10], [300, 8, 8.2, 7.9, 8]], 0, 1, 1, 9, 11), { k: 1, px: 8, how: 'stop' });
});

test('costs: $0.60 over the risk, financing only on buys', () => {
  const base = { entry: 2000, stop: 1996, fillT: T0 + 3600, exitT: T0 + 3 * 86400 };
  assert.ok(Math.abs(costR({ ...base, side: -1, stop: 2004 }) - 0.15) < 1e-12);
  assert.ok(costR({ ...base, side: 1 }) > 0.15);
  assert.ok(Math.abs(costR({ ...base, side: 1 }, 2) - 2 * costR({ ...base, side: 1 })) < 1e-12);
});

test('one at a time, the placebo keeps the fills, Holm, month t with empty months', () => {
  const m5 = m5Of(scene()), h1 = prep(m5), s = impulses(h1).filter((x) => x.time >= T0);
  const { T, cnt } = stream(m5, h1, s, 'T1', d1From(m5));
  assert.equal(cnt.filled, T.length);
  for (let i = 1; i < T.length; i++) assert.ok(T[i].fillT >= T[i - 1].exitT);
  for (const p of placebo(m5, h1, T, 7)) { assert.ok(T.some((x) => x.fillT === p.fillT && x.entry === p.entry)); assert.ok(p.side * (p.entry - p.stop) > 0); }
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((x) => +x.toFixed(4)), [0.03, 0.08, 0.5]);
  const mt = monthT([{ fillT: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { fillT: Date.UTC(2020, 2, 5) / 1000, net: 1 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 3, 1) / 1000);
  assert.equal(mt.months, 3);
  // the D1 filter needs 50 completed days and reads only days before the impulse's day
  assert.equal(trendAt([{ time: 0, close: 1 }], 86400 * 2), null);
});

test('the report says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-ote-retrace/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-ote-retrace/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const line = md.split('\n').find((l) => l.startsWith('**Verdict: FAIL'));
  assert.ok(line && line.length < 260 && /0 of 3/.test(line));
  const f = (v) => (v > 0 ? '+' : '') + v.toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) {
    const t = r.tests[k]; assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) {
      const x = t[w]; assert.ok(md.includes(`| ${x.net.n} | ${f(x.gross.avg)} | ${f(x.net.avg)} | ${(x.tGross > 0 ? '+' : '') + x.tGross.toFixed(2)} | ${x.tNet.toFixed(2)} | ${f(x.net2.avg)} | ${x.net.pf.toFixed(2)} | ${x.net.dd}R |`), `${k} ${w}`);
    }
    assert.ok(md.includes(`| ${k} | ${t.p.toFixed(4)} | ${t.pHolm.toFixed(3)} | ${t.placebo.beaten} | ${f(t.placebo.median)} |`), k + ' placebo row');
  }
  assert.ok(/stand-alone rule/.test(md) && /nothing live changed/.test(md));
});
