// research/edge/gold-silver-reversal-day: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { silverRev, signals, commonDays, trade, stream, baseline, addExcess, monthSums, holm, lcg, HOLD, RT, DAY } from '../research/edge/gold-silver-reversal-day/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const bar = (time, o, h, l, c) => ({ time, open: o, high: h, low: l, close: c });
function bars(n, f) { const out = []; let t = T0; for (let i = 0; i < n; i++) { while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += DAY; out.push(bar(t, ...f(i))); t += DAY; } return out; }
const flat = () => [100, 101, 99, 100];   // true range 2 -> ATR 2

test('silver reversal: thrust >= 0.5 x ATR beyond the previous close, close on the other side; needs 21 earlier candles', () => {
  const s = bars(40, (i) => (i === 30 ? [100, 101.2, 99.5, 99.8] : i === 31 ? [100, 100.5, 98.8, 100.3] : i === 32 ? [100, 100.9, 99.5, 99.9] : flat()));
  assert.equal(silverRev(s, 30), -1);   // up 1.2 >= 1.0, closed below 100
  assert.equal(silverRev(s, 31), 1);    // down 1.0 from 99.8 >= 1.0, closed above 99.8
  assert.equal(silverRev(s, 32), 0);    // up 0.6 from 100.3: thrust too small
  assert.equal(silverRev(s, 20), null); // not enough history
  // a later candle never changes an earlier reading
  const later = s.map((b, i) => (i === 35 ? bar(b.time, 1, 1000, 0.5, 1) : b));
  assert.equal(silverRev(later, 30), -1);
});

test('signals: gold traded the way silver closed, goldRev marks a gold close the same way', () => {
  const xag = bars(40, (i) => (i === 30 ? [100, 101.2, 99.5, 99.8] : flat()));
  const xau = bars(40, (i) => (i === 30 ? [100, 101, 99, 100.5] : flat()));
  const days = commonDays({ xau, xag });
  const sg = signals({ xau, xag }, days);
  assert.equal(sg.length, 1); assert.equal(sg[0].side, -1); assert.equal(sg[0].goldRev, false);
  const xau2 = xau.map((b, i) => (i === 30 ? bar(b.time, 100, 101, 99, 99.5) : b));
  assert.equal(signals({ xau: xau2, xag }, commonDays({ xau: xau2, xag }))[0].goldRev, true);
});

test('trade: stop 2 x ATR(20), stop first, 5-candle hold, costs and financing on buys', () => {
  const g = bars(60, flat);
  const tr = trade(g, 30, 1);
  assert.equal(tr.risk, 4); assert.equal(tr.kind, 'time'); assert.equal(tr.k, 30 + HOLD - 1);
  const fin = nights(tr.t, tr.c) * FIN.xau.long * 100 / 4;
  assert.ok(Math.abs(tr.net - (0 - RT / 4 - fin)) < 1e-12);
  assert.ok(Math.abs(trade(g, 30, -1).net + RT / 4) < 1e-12);   // sells: no financing
  const g2 = bars(60, (i) => (i === 32 ? [100, 101, 95, 99] : flat()));
  const st = trade(g2, 30, 1); assert.equal(st.kind, 'stop'); assert.equal(st.exit, 96);
  const g3 = bars(60, (i) => (i === 32 ? [94, 95, 93, 94] : flat()));
  assert.equal(trade(g3, 30, 1).kind, 'gap');
  assert.equal(trade(g, 57, 1), null);   // runs past the data
});

test('stream holds one position at a time; excess subtracts the same-side baseline', () => {
  const g = bars(120, (i) => [100 + i * 0.5, 101 + i * 0.5, 99 + i * 0.5, 100.4 + i * 0.5]);
  const sigs = [g[40], g[42], g[60]].map((b) => ({ t: Math.floor(b.time / DAY) * DAY, side: 1 }));
  assert.equal(stream(g, sigs).length, 2);
  const days = g.map((b) => ({ t: Math.floor(b.time / DAY) * DAY }));
  const base = baseline(g, days, days[30].t, days[80].t);
  assert.ok(base[1].net > 0 && base[-1].net < 0);
  const ex = addExcess(stream(g, sigs), base); assert.ok(Math.abs(ex[0].excess - (ex[0].net - base[1].net)) < 1e-12);
});

test('month sums, Holm and the seeded generator', () => {
  const from = Date.UTC(2020, 0, 1) / 1000, end = Date.UTC(2020, 2, 31) / 1000;
  assert.deepEqual(monthSums([{ c: Date.UTC(2020, 0, 9) / 1000, v: 1 }, { c: Date.UTC(2020, 2, 9) / 1000, v: 2 }], from, end, 'v'), [1, 0, 2]);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  const a = lcg(7), b = lcg(7); assert.equal(a(), b()); assert.notEqual(lcg(1)(), lcg(2)());
});

test('the report says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-silver-reversal-day/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-silver-reversal-day/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.includes('FAIL, 0 of 3') && vl.length < 220);
  const [T1, T2, T3] = r.tests;
  assert.equal(T1.pass, false); assert.equal(T2.lead, false); assert.equal(T3.lead, false);
  for (const s of [String(T1.oos.n), T1.oos.mean.toFixed(3), T1.oos.tMonth.toFixed(2), T1.is.mean.toFixed(3)]) assert.ok(vl.includes(s), s);
  for (const s of [T1.is.tMonth.toFixed(2), T2.oos.tMonth.toFixed(2), T2.oos.mean.toFixed(3), T3.oos.tMonth.toFixed(2), T3.oos.mean.toFixed(3),
    T3.oos.x2.toFixed(3), String(T1.placebo.beaten) + ' of 40', T1.placebo.median.toFixed(2)])
    assert.ok(md.includes(s), s);
  assert.equal(T1.placebo.t.length, 40);
  const w = r.windows.oos;
  for (const s of [w.baseline.short.net.toFixed(3), w.all.medianStop.toFixed(2), w.followMirror.excess.toFixed(3)]) assert.ok(md.includes(s), s);
  assert.ok(w.all.medianStop >= 10);
  assert.ok(r.windows.is.signals.n >= 100 && w.signals.n >= 100);
});
