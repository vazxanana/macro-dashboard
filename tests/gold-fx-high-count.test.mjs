// research/edge/gold-fx-high-count: the count signal on hand-made closes, no look-ahead, the control shift, the trade's
// stop and costs, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, shiftPairs, placeboDays, tradeAt, simulate, holm, rng, verdictOf, headline, report, inCcy, CCY, DAY, RT, SHIFT_MIN } from '../research/edge/gold-fx-high-count/run.mjs';
import { FIN } from '../council/fills.mjs';

const T0 = Date.UTC(2020, 0, 6) / 1000;
// g = gold in dollars, fx = rows of the five pairs (EUR, GBP, JPY, CHF, AUD)
const pts = (gs, fxs) => gs.map((g, i) => ({ t: T0 + i * DAY, g, fx: fxs[i] }));
const flatFx = (n) => Array.from({ length: n }, () => [1.1, 1.3, 150, 0.9, 0.7]);

test('gold in each currency: EUR, GBP, AUD divide by the pair, JPY, CHF multiply', () => {
  assert.deepEqual(CCY.map((c) => c[0]), ['EUR', 'GBP', 'JPY', 'CHF', 'AUD']);
  assert.equal(inCcy(2000, 1.25, -1), 1600);
  assert.equal(inCcy(2000, 150, 1), 300000);
});

test('long when two of five currencies make a 20-day high and dollars do not; none when dollars do too; short mirror', () => {
  const g = Array(20).fill(100); g[4] = 103; // the dollar series has a higher close inside its window
  const fx = flatFx(21);
  fx[20] = [1.0, 1.2, 150, 0.9, 0.7]; // EUR and GBP fall against the dollar: gold up in EUR and GBP only
  let rows = signals(pts([...g, 101], fx), 2);
  assert.equal(rows.length, 1); assert.equal(rows[0].s, 1); assert.equal(rows[0].nHi, 2);
  assert.equal(signals(pts([...g, 101], fx), 3)[0].s, 0); // three needed: not met
  assert.equal(signals(pts([...g.slice(0, 4), 100, ...g.slice(5), 101], fx), 2)[0].s, 0); // dollars at a high too
  const g2 = Array(20).fill(100); g2[6] = 97;
  const fx2 = flatFx(21); fx2[20] = [1.2, 1.4, 140, 0.85, 0.7]; // EUR, GBP up; JPY, CHF down: gold lower in four
  rows = signals(pts([...g2, 99], fx2), 2);
  assert.equal(rows[0].s, -1); assert.equal(rows[0].nLo, 4);
});

test('no look-ahead: a signal does not change when later closes change', () => {
  const n = 60, g = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 3) * 4);
  const fx = Array.from({ length: n }, (_, i) => [1.1 + Math.cos(i / 4) * 0.05, 1.3 + Math.sin(i / 5) * 0.04, 150 + Math.sin(i / 2) * 3, 0.9, 0.7 + Math.cos(i / 6) * 0.02]);
  const a = signals(pts(g, fx), 2), g2 = g.slice(), fx2 = fx.map((r) => r.slice());
  for (let i = 40; i < n; i++) { g2[i] *= 1.3; fx2[i] = fx2[i].map((x) => x * 0.8); }
  const b = signals(pts(g2, fx2), 2);
  for (let i = 0; i < a.length; i++) if (a[i].t < T0 + 40 * DAY) assert.deepEqual(a[i], b[i]);
});

test('a gap of more than five days restarts the 20-day history', () => {
  const p = pts(Array(25).fill(100), flatFx(25));
  for (let i = 10; i < 25; i++) p[i].t += 10 * DAY;
  assert.equal(signals(p).length, 0);
});

test('control keeps gold and each pair\'s own values, shifted by at least SHIFT_MIN days; placebo stays in the year', () => {
  const n = 800, p = pts(Array.from({ length: n }, (_, i) => 100 + i), Array.from({ length: n }, (_, i) => [i, i + 1e4, i + 2e4, i + 3e4, i + 4e4]));
  const s = shiftPairs(p, rng(7));
  for (let i = 0; i < n; i++) assert.equal(s[i].g, p[i].g);
  for (let c = 0; c < 5; c++) {
    const off = (s[0].fx[c] - c * 1e4 + n) % n;
    assert.ok(off >= SHIFT_MIN && off <= n - SHIFT_MIN);
    assert.deepEqual(s.map((x) => x.fx[c]).sort((a, b) => a - b), p.map((x) => x.fx[c]).sort((a, b) => a - b));
  }
  const days = p.map((x) => ({ t: x.t })), sig = [{ t: p[10].t, s: 1 }, { t: p[500].t, s: -1 }];
  const pl = placeboDays(days, sig, rng(3)), y = (t) => new Date(t * 1000).getUTCFullYear();
  assert.deepEqual(pl.map((d) => y(d.t)).sort(), sig.map((d) => y(d.t)).sort());
});

test('every trade has a stop on the losing side; costs and financing on buys only; one at a time', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ time: T0 + i * DAY, open: 100, high: 101, low: 99, close: 100 }));
  const b = tradeAt(bars, 25, 1, 5, 2), s = tradeAt(bars, 25, -1, 5, 2);
  assert.ok(b.stop < b.e && s.stop > s.e);
  assert.equal(b.risk, 4);
  assert.ok(Math.abs(s.cost - RT / 4) < 1e-12);
  assert.ok(Math.abs(b.cost - (RT + b.nights * FIN.xau.long * 100) / 4) < 1e-12);
  bars[26] = { ...bars[26], low: 95 };
  const st = tradeAt(bars, 25, 1, 5, 2);
  assert.equal(st.kind, 'stop'); assert.equal(st.exit, 96);
  const tr = simulate([{ t: bars[20].time, s: 1 }, { t: bars[21].time, s: 1 }], bars.map((x) => ({ ...x, low: 99 })), 5, 2);
  assert.equal(tr.length, 1);
});

test('Holm and the verdict rule', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const mk = (id, t, ctl = 39) => ({ id, holm: 0.01, placebo: { beaten: 39 }, control: { beaten: ctl }, is: { netExact: 0.1, n: 120 }, oos: { tMonth: t, x2: 0.1, excessExact: 0.1, n: 120 } });
  assert.equal(verdictOf([mk('T1', 2.5), mk('T2', 1), mk('T3', 1)]), 'PASS');
  assert.equal(verdictOf([mk('T1', 2.5, 30), mk('T2', 1), mk('T3', 1)]), 'FAIL');
  assert.equal(verdictOf([mk('T1', 1.9), mk('T2', 2.1), mk('T3', 1)]), 'PARTIAL');
});

test('the report agrees with result.json', () => {
  const dir = new URL('../research/edge/gold-fx-high-count/', import.meta.url);
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.equal(md, report(r));
  assert.ok(md.includes(headline(r)));
  assert.ok(headline(r).length < 220);
  assert.equal(r.verdict, verdictOf(r.tests));
  assert.ok(md.includes(`**Verdict: ${r.verdict}`));
  assert.deepEqual(r.tests.map((t) => [t.id, t.need, t.hold]), [['T1', 2, 5], ['T2', 3, 3], ['T3', 2, 3]]);
  // the counts fixed in the pre-registration
  assert.deepEqual(r.tests.map((t) => [t.is.signals, t.is.n, t.oos.signals, t.oos.n]), [[306, 187, 321, 183], [143, 116, 132, 100], [306, 224, 321, 226]]);
  for (const t of r.tests) { assert.equal(t.placebo.t.length, 40); assert.equal(t.control.t.length, 40); }
});
