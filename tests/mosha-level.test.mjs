// Mosha level reversal study (research/edge/mosha-level): the detector's pieces on hand-made candles, and the committed result
// against the pre-registered verdict. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, VARIANTS, swings, h4Context, simulate, stat, summarize, verdictOf } from '../research/edge/mosha-level/run.mjs';

const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const R = JSON.parse(fs.readFileSync(new URL('../research/edge/mosha-level/result.json', import.meta.url)));
const PRE = fs.readFileSync(new URL('../research/edge/mosha-level/PREREGISTRATION.md', import.meta.url), 'utf8');
const RUN = fs.readFileSync(new URL('../research/edge/mosha-level/run.mjs', import.meta.url), 'utf8');

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([K.W4, K.W5, K.TOL, K.PAD, K.BASE, K.MIN_R0, K.MIN_RR, K.COST], [3, 1, 0.0005, 0.30, 3, 1, 2, 0.30]);
  assert.equal(K.EPISODE, 86400); assert.equal(K.VALID, 86400); assert.equal(K.HOLD, 259200); assert.equal(K.LEVEL_AGE, 30 * 86400);
  for (const s of ['`W4 = 3`', '`W5 = 1`', '`TOL = 0.05 %`', '`PAD = $0.30`', '`BASE = 3`', '`MIN_R0 = $1.00`', '`MIN_RR = 2`', '`COST = $0.30`']) assert.ok(PRE.includes(s), s);
  assert.deepEqual(Object.keys(VARIANTS), ['P', 'W', 'T3', 'F']);
  assert.equal(new Date(K.FROM * 1000).toISOString().slice(0, 10), '2020-01-01'); assert.equal(new Date(K.SPLIT * 1000).toISOString().slice(0, 10), '2024-01-01');
});

test('swings: a three-candle swing needs the candle after it; ties count on the left only', () => {
  const B = [bar(0, 5, 6, 4, 5), bar(1, 5, 7, 3, 5), bar(2, 5, 9, 5, 6), bar(3, 6, 8, 4, 5), bar(4, 5, 8, 2, 3), bar(5, 3, 8, 2, 4), bar(6, 4, 6, 3, 5)];
  const { hi, lo } = swings(B, 1);
  assert.deepEqual([...hi], [0, 0, 1, 0, 0, 1, 0]);   // 9 is a high; the second 8 has a lower high after it and an equal one before
  assert.deepEqual([...lo], [0, 1, 0, 0, 0, 1, 0]);   // of the two equal lows at 2 only the later one counts (the first has no higher low after it)
});

test('H4 context: a level exists three candles later; engulf zones are the barriers', () => {
  const H = (i, o, h, l, c) => bar(i * K.H4, o, h, l, c);
  const H4 = [H(0, 10, 11, 9, 10), H(1, 10, 12, 9, 11), H(2, 11, 12, 10, 11), H(3, 11, 20, 11, 15), H(4, 15, 16, 13, 14), H(5, 14, 15, 12, 13), H(6, 13, 14, 12, 12.5), H(7, 12.5, 17, 11.5, 16)];
  const { levels, zones } = h4Context(H4);
  const a = levels.find((l) => l.side === -1 && l.p === 20);
  assert.ok(a); assert.equal(a.born, 7 * K.H4);                       // the close of the third candle after it
  const bull = zones.find((z) => z.side === 1 && z.born === 8 * K.H4);
  assert.deepEqual([bull.bot, bull.top], [11.5, 14]);                 // green candle 7 closes above red candle 6's high: zone = the lower low up to the red candle's high
});

test('simulate: the stop counts first, a target before the fill cancels the order, time exit at 72 h', () => {
  const o = { side: -1, entry: 100, stop: 102, target: 90, r0: 2, placed: 0 };
  const m = (t, o_, h, l, c) => bar(t * 60, o_, h, l, c);
  let r = simulate([m(0, 98, 99, 97, 98), m(1, 98, 100.5, 98, 100), m(2, 100, 103, 89, 95)], o);
  assert.equal(r.exit, 'stop'); assert.equal(r.R, -1); assert.equal(r.net, +(-1 - 0.30 / 2).toFixed(4));       // stop and target in one candle: the stop
  r = simulate([m(0, 98, 99, 89, 95), m(1, 95, 101, 95, 100)], o); assert.equal(r.status, 'missed');             // target traded before the fill
  r = simulate([m(0, 98, 100.5, 98, 100), m(1, 100, 101, 90, 91)], o); assert.equal(r.exit, 'target'); assert.equal(r.R, 5);
  r = simulate([m(0, 98, 100.5, 98, 100), m(1, 103, 104, 102.5, 103)], o); assert.equal(r.exit, 'stop (gap)'); assert.equal(r.R, -1.5);
  r = simulate([m(0, 98, 100.5, 98, 100), m(4320, 99, 99.5, 98.5, 99)], o); assert.equal(r.exit, 'time'); assert.equal(r.R, 0.5);
  r = simulate([m(0, 98, 99, 97, 98), m(1441, 98, 100.5, 98, 100)], o); assert.equal(r.status, 'expired');       // 24 h without a fill
  const buy = simulate([m(0, 52, 52, 49.5, 50.5), m(1, 50.5, 56, 50, 55.5)], { side: 1, entry: 50, stop: 49, target: 55, r0: 1, placed: 0 });
  assert.equal(buy.exit, 'target'); assert.equal(buy.R, 5);
});

test('statistics and the verdict rule', () => {
  const s = stat([1, -1, 2, -1]); assert.equal(s.n, 4); assert.equal(s.avg, 0.25); assert.equal(s.total, 1); assert.equal(s.maxDD, 1); assert.equal(s.win, 0.5);
  const mk = (avg, n, t) => ({ n, avg, t, total: avg * n });
  const good = { all: mk(0.3, 200, 2.5), is: mk(0.2, 120), oos: mk(0.4, 80), x2: mk(0.2, 200), years: { 2023: mk(0.2, 30), 2024: mk(0.3, 30), 2025: mk(0.5, 30), 2026: mk(-0.1, 20) } };
  assert.equal(verdictOf(good).verdict, 'PASS');
  assert.equal(verdictOf({ ...good, all: mk(0.3, 200, 1.5) }).verdict, 'INCONCLUSIVE');
  assert.equal(verdictOf({ ...good, oos: mk(0.4, 20) }).verdict, 'INCONCLUSIVE');
  assert.equal(verdictOf({ ...good, oos: mk(-0.1, 80) }).verdict, 'FAIL');
  assert.equal(verdictOf({ ...good, all: mk(-0.1, 200, -1) }).verdict, 'FAIL');
});

test('the committed result is the pre-registered verdict on its own numbers', () => {
  assert.equal(R.topic, 'mosha-level'); assert.equal(R.variantsTried, 4);
  assert.deepEqual(R.params, JSON.parse(JSON.stringify(K)));
  const P = R.variants.P, v = verdictOf(P);
  assert.equal(R.primary.verdict, v.verdict); assert.ok(R.verdict.startsWith(v.verdict + ':'));
  assert.equal(P.filled, P.all.n); assert.equal(P.is.n + P.oos.n, P.all.n); assert.equal(P.sells.n + P.buys.n, P.all.n);
  assert.equal(Object.values(P.exits).reduce((a, b) => a + b, 0), P.all.n);
  assert.equal(Object.values(P.years).reduce((a, s) => a + s.n, 0), P.all.n);
  assert.equal(R.trades.length, P.all.n); assert.ok(Math.abs(R.trades.reduce((a, t) => a + t.R, 0) - P.all.total) < 0.05);
  assert.ok(Object.keys(P.years).every((y) => +y >= 2020 && +y <= 2026));
  for (const k of Object.keys(R.variants)) assert.ok(R.variants[k].pHolm >= R.variants[k].p);
  const md = fs.readFileSync(new URL('../research/edge/mosha-level/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(`**Verdict: ${v.verdict}.`)); assert.ok(md.includes(String(P.all.n))); assert.ok(md.includes('−' + Math.abs(P.all.avg).toFixed(3)));
});

test('paper research only: the study reads candles and writes its own files, nothing else', () => {
  assert.ok(!/council\/(trader|ctrader|alerts|live)|api\/|child_process|process\.env\.(?!GOLD_|OUT_DIR|MD_BASE)/.test(RUN));
  assert.ok(RUN.includes("import('../gold-systems/data.mjs')"));   // the shared loader, which uses the audited clock converter
  assert.ok(!/histToUtc|histStampUtc/.test(RUN));
});
