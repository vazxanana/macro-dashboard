// research/edge/gold-euro-divergence: the signal on hand-made closes, no look-ahead, the trade's stop and costs, and the
// report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, tradeAt, simulate, holm, verdictOf, headline, report, DAY, RT } from '../research/edge/gold-euro-divergence/run.mjs';
import { FIN } from '../council/fills.mjs';

const T0 = Date.UTC(2020, 0, 6) / 1000;
const pts = (gs, es) => gs.map((g, i) => ({ t: T0 + i * DAY, g, e: es[i] }));

test('long when euros make a 20-day closing high and dollars do not; short on the low mirror', () => {
  const g = Array(20).fill(100), e = Array(20).fill(90);
  g[3] = 105; // the dollar series has a higher close in its window
  let rows = signals(pts([...g, 101], [...e, 91]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].s, 1);
  rows = signals(pts([...g, 106], [...e, 91])); // both at a high: no signal
  assert.equal(rows[0].s, 0);
  const g2 = Array(20).fill(100); g2[5] = 95;
  rows = signals(pts([...g2, 99], [...e, 89]));
  assert.equal(rows[0].s, -1);
});

test('no look-ahead: a signal does not change when later closes change', () => {
  const g = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 3), e = g.map((x, i) => x * 0.9 + (i === 25 ? 5 : 0));
  const a = signals(pts(g, e)), g2 = g.slice(), e2 = e.slice();
  for (let i = 30; i < 40; i++) { g2[i] *= 1.3; e2[i] *= 0.7; }
  const b = signals(pts(g2, e2));
  for (let i = 0; i < a.length; i++) if (a[i].t < T0 + 30 * DAY) assert.deepEqual(a[i], b[i]);
});

test('a gap of more than five days restarts the 20-day history', () => {
  const p = pts(Array(25).fill(100), Array(25).fill(90));
  for (let i = 10; i < 25; i++) p[i].t += 10 * DAY;
  assert.equal(signals(p).length, 0);
});

test('every trade has a stop on the losing side; costs and financing on buys only', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ time: T0 + i * DAY, open: 100, high: 101, low: 99, close: 100 }));
  const b = tradeAt(bars, 25, 1, 5, 2), s = tradeAt(bars, 25, -1, 5, 2);
  assert.ok(b.stop < b.e && s.stop > s.e);
  assert.equal(b.risk, 4);
  assert.ok(Math.abs(s.cost - RT / 4) < 1e-12);
  assert.ok(Math.abs(b.cost - (RT + b.nights * FIN.xau.long * 100) / 4) < 1e-12);
  bars[26] = { ...bars[26], low: 95 };
  const st = tradeAt(bars, 25, 1, 5, 2);
  assert.equal(st.kind, 'stop'); assert.equal(st.exit, 96);
  // one at a time: a second signal inside an open trade is skipped
  const tr = simulate([{ t: bars[20].time, s: 1 }, { t: bars[21].time, s: 1 }], bars.map((x) => ({ ...x, low: 99 })), 5, 2);
  assert.equal(tr.length, 1);
});

test('Holm and the verdict rule', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const mk = (id, t) => ({ id, holm: 0.01, placebo: { beaten: 39 }, is: { netExact: 0.1 }, oos: { tMonth: t, x2: 0.1, excessExact: 0.1, n: 50 } });
  assert.equal(verdictOf([mk('T1', 2.5), mk('T2', 1), mk('T3', 1)]), 'PASS');
  assert.equal(verdictOf([mk('T1', 1.9), mk('T2', 2.1), mk('T3', 1)]), 'PARTIAL');
  assert.equal(verdictOf([mk('T1', 1.9), mk('T2', 1), mk('T3', 1)]), 'FAIL');
});

test('the report agrees with result.json', () => {
  const dir = new URL('../research/edge/gold-euro-divergence/', import.meta.url);
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.equal(md, report(r));
  assert.ok(md.includes(headline(r)));
  assert.ok(headline(r).length < 220);
  assert.equal(r.verdict, verdictOf(r.tests));
  assert.ok(md.includes(`**Verdict: ${r.verdict}`));
  assert.equal(r.tests.length, 3);
  for (const t of r.tests) {
    assert.equal(t.placebo.t.length, 40);
    assert.ok(t.is.signals >= 100 && t.oos.signals >= 100);
  }
  assert.equal(r.context.is.long + r.context.is.short, 232);
  assert.equal(r.context.oos.long + r.context.oos.short, 211);
});
