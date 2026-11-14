// research/edge/gold-metals-rank: the rank rule on hand-made candles, no look-ahead, the trade mechanics, and the report
// against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { returns, rankOf, tradeAt, simulate, controlRows, rng, placeboDays, holm, RT, DAY } from '../research/edge/gold-metals-rank/run.mjs';

const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const mkBars = (closes) => closes.map((c, i) => ({ time: T0 + i * DAY, open: c, high: c + 1, low: c - 1, close: c }));

test('rank: gold last, first and ties', () => {
  assert.equal(rankOf(-0.02, [0.01, 0.0, -0.01]), 3);
  assert.equal(rankOf(0.05, [0.01, 0.0, -0.01]), 0);
  assert.equal(rankOf(0.01, [0.01, 0.01, 0.01]), 0);   // a tie is not "higher"
});

test('returns use only closes up to the day (no look-ahead)', () => {
  const n = 30, g = mkBars(Array.from({ length: n }, (_, i) => 100 + i)), s = mkBars(Array.from({ length: n }, () => 50));
  const a = returns([g, s, s, s]);
  assert.equal(a.length, n - 20);
  assert.ok(Math.abs(a[0].g - (120 / 100 - 1)) < 1e-12);
  // changing every close after day 25 leaves rows up to day 25 unchanged
  const g2 = g.map((b, i) => (i > 25 ? { ...b, close: 1 } : b)), b2 = returns([g2, s, s, s]);
  for (let i = 0; i <= 5; i++) assert.deepEqual(b2[i], a[i]);
});

test('trade: long and short, stop, cost, financing only on buys', () => {
  const closes = Array.from({ length: 40 }, () => 100);
  const bars = mkBars(closes);
  const L = tradeAt(bars, 25, 1), S = tradeAt(bars, 25, -1);
  assert.equal(L.risk, 2 * 2);          // ATR 2 (high - low)
  assert.ok(L.gross === 0 && Math.abs(S.gross) === 0);
  assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(S.net + RT / S.risk) < 1e-12);
  // a drop through the stop on the 2nd candle stops the long
  const b2 = bars.map((b, i) => (i === 26 ? { ...b, low: 90 } : b));
  const L2 = tradeAt(b2, 25, 1);
  assert.equal(L2.kind, 'stop'); assert.equal(L2.exit, 96); assert.equal(L2.gross, -1);
});

test('one at a time and the controls are seeded', () => {
  const bars = mkBars(Array.from({ length: 60 }, () => 100));
  const sig = [25, 26, 27, 40].map((i) => bars[i].time);
  const tr = simulate(sig, bars, 1);
  assert.equal(tr.length, 2);
  const rs = Array.from({ length: 30 }, (_, i) => ({ t: T0 + i * DAY, g: i, o: [i, i + 1, i + 2] }));
  assert.deepEqual(controlRows(rs, rng(3)), controlRows(rs, rng(3)));
  assert.deepEqual(controlRows(rs, rng(3)).map((x) => x.g), rs.map((x) => x.g));   // gold's own return stays on its day
  assert.deepEqual(placeboDays(rs.map((x) => x.t), sig, rng(5)), placeboDays(rs.map((x) => x.t), sig, rng(5)));
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-metals-rank/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-metals-rank/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.match(md, /\*\*Verdict: FAIL, 0 of 3/);
  const t1 = r.tests.find((t) => t.id === 'T1');
  assert.equal(t1.oos.n, 146); assert.equal(t1.oos.excess, 0.02); assert.equal(t1.oos.tExcess, 0.33);
  assert.equal(t1.placebo.beaten, 24); assert.equal(t1.control.beaten, 25);
  for (const t of r.tests) {
    assert.equal(t.pass, false);
    for (const w of ['is', 'oos']) assert.ok(t[w].n >= 100);
    const sgn = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
    assert.ok(md.includes(`| ${t.oos.n} | ${sgn(t.oos.gross)} | ${sgn(t.oos.net)} |`), `${t.id} row`);
  }
});
