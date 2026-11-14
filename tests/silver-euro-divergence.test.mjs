// research/edge/silver-euro-divergence: silver in euros built from XAG/USD / EUR/USD, the signal on hand-made closes, no
// look-ahead, the trade's stop and costs (no financing), and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { matched, signals, tradeAt, simulate, holm, verdictOf, headline, report, DAY, RT, KEYS, TESTS } from '../research/edge/silver-euro-divergence/run.mjs';

const T0 = Date.UTC(2020, 0, 6) / 1000;
const pts = (gs, es) => gs.map((g, i) => ({ t: T0 + i * DAY, g, e: es[i] }));

test('silver in euros = the XAG/USD close / the EUR/USD close of the same UTC day; unmatched days dropped', () => {
  assert.deepEqual(KEYS, ['xag', 'eurusd']);
  assert.equal(RT, 0.06);
  const xag = [{ time: T0, close: 30 }, { time: T0 + DAY, close: 31 }, { time: T0 + 2 * DAY, close: 32 }];
  const fx = [{ time: T0 + 3600, close: 1.2 }, { time: T0 + 2 * DAY, close: 1.25 }];
  const m = matched(xag, fx);
  assert.equal(m.length, 2);
  assert.equal(m[0].g, 30); assert.equal(m[0].e, 25);
  assert.equal(m[1].t, T0 + 2 * DAY); assert.ok(Math.abs(m[1].e - 32 / 1.25) < 1e-12);
});

test('long when euros make a 20-day closing high and dollars do not; short on the low mirror', () => {
  const g = Array(20).fill(100), e = Array(20).fill(90);
  g[3] = 105;
  let rows = signals(pts([...g, 101], [...e, 91]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].s, 1);
  rows = signals(pts([...g, 106], [...e, 91]));
  assert.equal(rows[0].s, 0);
  const g2 = Array(20).fill(100); g2[5] = 95;
  rows = signals(pts([...g2, 99], [...e, 89]));
  assert.equal(rows[0].s, -1);
});

test('no look-ahead: a signal does not change when later closes change', () => {
  const g = Array.from({ length: 40 }, (_, i) => 30 + Math.sin(i)), e = g.map((x, i) => x * 0.9 + (i === 25 ? 2 : 0));
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

test('every trade has a stop on the losing side; $0.06 a round trip, no financing on either side', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ time: T0 + i * DAY, open: 30, high: 30.5, low: 29.5, close: 30 }));
  const b = tradeAt(bars, 25, 1, 5, 2), s = tradeAt(bars, 25, -1, 5, 2);
  assert.ok(b.stop < b.e && s.stop > s.e);
  assert.equal(b.risk, 2);
  assert.ok(b.nights > 0);
  assert.equal(b.fin, 0); assert.equal(s.fin, 0);
  assert.ok(Math.abs(b.cost - RT / 2) < 1e-12 && Math.abs(s.cost - RT / 2) < 1e-12);
  bars[26] = { ...bars[26], low: 27 };
  const st = tradeAt(bars, 25, 1, 5, 2);
  assert.equal(st.kind, 'stop'); assert.equal(st.exit, 28);
  const tr = simulate([{ t: bars[20].time, s: 1 }, { t: bars[21].time, s: 1 }], bars.map((x) => ({ ...x, low: 29.5 })), 5, 2);
  assert.equal(tr.length, 1);
});

test('Holm and the verdict rule: T2 is descriptive and can never pass or change the verdict', () => {
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.ok(TESTS.find((t) => t.id === 'T2').descriptive);
  const mk = (id, t, descriptive = false) => ({ id, descriptive, holm: 0.01, placebo: { beaten: 39 }, is: { netExact: 0.1 }, oos: { tMonth: t, x2: 0.1, excessExact: 0.1, n: 50 } });
  assert.equal(verdictOf([mk('T1', 2.5), mk('T2', 1, true), mk('T3', 1)]), 'PASS');
  assert.equal(verdictOf([mk('T1', 1.9), mk('T2', 1, true), mk('T3', 2.1)]), 'PARTIAL');
  const ts = [mk('T1', 1.9), mk('T2', 3, true), mk('T3', 1)];
  assert.equal(verdictOf(ts), 'FAIL');
  assert.equal(ts[1].pass, null);
});

test('the report agrees with result.json', () => {
  const dir = new URL('../research/edge/silver-euro-divergence/', import.meta.url);
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.equal(md, report(r));
  assert.ok(md.includes(headline(r)));
  assert.ok(headline(r).length < 220);
  assert.equal(r.verdict, verdictOf(r.tests));
  assert.ok(md.includes(`**Verdict: ${r.verdict}`));
  assert.equal(r.tests.length, 3);
  assert.equal(r.fin, 0);
  for (const t of r.tests) {
    assert.equal(t.placebo.t.length, 40);
    if (t.descriptive) { assert.equal(t.holm, null); assert.equal(t.pass, null); assert.ok(t.is.signals < 100 && t.oos.signals < 100); }
    else assert.ok(t.is.signals >= 100 && t.oos.signals >= 100);
  }
  assert.equal(r.context.is.long + r.context.is.short, 152);
  assert.equal(r.context.oos.long + r.context.oos.short, 114);
});
