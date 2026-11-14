// node --test tests/gold-vol-breakout-reverse.test.mjs — research/edge/gold-vol-breakout-reverse (14 Nov 2026): the original
// T1 imported unchanged from a verbatim copy, the reverse order on hand-made days (when it is live, its fill, its stop, no
// look-ahead), the R2 difference, the decision, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-vol-breakout-reverse/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-vol-breakout-reverse');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const R = JSON.parse(read('result.json'));
const D0 = Date.parse('2020-03-03T00:00:00Z') / 1000;

// a day of 252 M5 candles; `segs` [[from index, price]] gives flat candles (±0.05), `at` maps an index → [o,h,l,c].
// O = 100 and prevRange 2 → levels 99 / 101.
function day(at = {}, segs = [[0, 100]]) {
  const bars = [];
  for (let i = 0; i < 252; i++) {
    const p = segs.filter(([f]) => f <= i).at(-1)[1], c = at[i] || [p, p + 0.05, p - 0.05, p];
    bars.push({ t: D0 + i * 300, o: c[0], h: c[1], l: c[2], c: c[3] });
  }
  return bars;
}

test('original.mjs is the verbatim copy; windows and gate are the pre-registered ones', () => {
  assert.equal(sha(read('original.mjs')), S.ORIG_SHA);
  assert.deepEqual(S.WINDOWS, { IS: ['2007-01-01', '2016-12-31'], OOS: ['2017-01-01', '2026-10-31'] });
  assert.equal(S.K, 0.5);
  assert.equal(R.gate.ok, true);
  for (const k of Object.keys(S.GATE)) assert.equal(R.gate.got[k], S.GATE[k]);
});

test('a T1 time exit has no reverse trade', () => {
  const x = S.dayTrades(day({ 10: [100, 101.2, 100.1, 101.1] }, [[0, 100], [11, 101.1]]), 2);
  assert.equal(x.t1.side, 1); assert.equal(x.t1.how, 'time');
  assert.equal(x.rev, undefined);
});

test('after a stopped buy the sell stop at O − 0.5 × range fills, stop at O', () => {
  // buy fills at 101 (candle 10), stopped at 100 in candle 20, sell stop 99 fills in candle 30, out at 21:00 at 98.5
  const x = S.dayTrades(day({ 10: [100, 101.2, 100.1, 101.1], 20: [100.5, 100.6, 99.9, 100], 30: [99.5, 99.6, 98.8, 98.9] }, [[0, 100], [11, 100.5], [21, 99.5], [31, 98.5]]), 2);
  assert.equal(x.t1.how, 'stop'); assert.equal(x.stopOut.idx, 20);
  assert.equal(x.rev.side, -1); assert.equal(x.rev.entry, 99); assert.equal(x.rev.stop, 100); assert.equal(x.rev.fillIdx, 30);
  assert.equal(x.rev.how, 'time'); assert.equal(x.rev.exit, 98.5);
  assert.ok(Math.abs(x.rev.R - 0.5) < 1e-9);
  assert.ok(Math.abs(x.rev.net - (x.rev.R - 0.6)) < 1e-9, 'cost $0.60 on a $1 risk; no financing on a sell');
});

test('the reverse never fills in the stop-out candle, and a gap fills at the open', () => {
  // T1 buy fills and is stopped in one candle (10) that also reaches 99: no reverse from that candle
  const a = S.dayTrades(day({ 10: [100, 101.2, 98.5, 99] }, [[0, 100], [11, 99.5]]), 2);
  assert.equal(a.t1.how, 'stop'); assert.equal(a.stopOut.idx, 10);
  assert.equal(a.rev, null, 'flat candles after: the sell stop at 99 is never reached later');
  // a later candle opens through 99: fill at its open (98.5); the stop candle reaching O books a stop
  const b = S.dayTrades(day({ 10: [100, 101.2, 98.5, 99], 15: [98.5, 98.6, 98.2, 98.3], 16: [98.3, 100.2, 98.3, 100.1] }, [[0, 100], [11, 99.5]]), 2);
  assert.equal(b.rev.entry, 98.5); assert.equal(b.rev.how, 'stop'); assert.equal(b.rev.exit, 100);
  assert.ok(Math.abs(b.rev.R - -1) < 1e-9);
});

test('no look-ahead: changing prices after the reverse fill never changes T1 or the fill', () => {
  const base = { 10: [100, 101.2, 100.1, 101.1], 20: [100.5, 100.6, 99.9, 100], 30: [99.5, 99.6, 98.8, 98.9] }, segs = [[0, 100], [11, 100.5], [21, 99.5], [31, 98.5]];
  const a = S.dayTrades(day(base, segs), 2), b = S.dayTrades(day({ ...base, 31: [98.9, 98.9, 90, 91] }, segs), 2);
  assert.deepEqual(a.t1, b.t1); assert.deepEqual(a.stopOut, b.stopOut);
  assert.equal(a.rev.entry, b.rev.entry); assert.equal(a.rev.fillT, b.rev.fillT);
});

test('R2 difference is the reverse trade per T1 day; fill rate and hours count stop-outs', () => {
  const rows = [
    { day: '2020-01-02', t1: { net: 1, R: 1.1, net2: 0.9 }, stopOut: null, rev: undefined },
    { day: '2020-01-03', t1: { net: -1, R: -0.9, net2: -1.1 }, stopOut: { t: D0 + 13 * 3600, hour: 13 }, rev: { net: 0.5, R: 0.6, net2: 0.4 } },
    { day: '2020-02-03', t1: { net: -1, R: -0.9, net2: -1.1 }, stopOut: { t: D0 + 9 * 3600, hour: 9 }, rev: null },
  ];
  assert.deepEqual(S.diffRows(rows).map((x) => x.net), [0, 0.5, 0]);
  const c = S.combined(rows);
  assert.equal(c.t1.days, 3); assert.ok(Math.abs(c.combined.total - (-1 + 0.5)) < 1e-9);
  assert.deepEqual(S.fillRate(rows), { t1Days: 3, t1Stops: 2, revFills: 1, rate: 0.5 });
  const h = S.byHour(rows); assert.equal(h['13'].fills, 1); assert.equal(h['09'].fills, 0);
});

test('decision follows the pre-registered checks', () => {
  for (const [k, d] of Object.entries(R.decision)) {
    const c = d.checks;
    assert.equal(d.pass, Object.values(c).every(Boolean), k);
    assert.equal(c.t2, d.t >= 2); assert.equal(c.holm, d.pHolm < 0.05); assert.equal(c.placebo, d.placeboBeaten >= 38);
  }
  const o = R.tests.R1.OOS;
  assert.equal(R.decision.R1.checks.n150, o.n >= 150);
  assert.equal(R.decision.R1.checks.cost2x, o.net2R > 0);
  assert.equal(R.decision.R1.placeboBeaten, R.placebo.R1.means.filter((v) => o.netR > v).length);
  assert.equal(R.placebo.R1.means.length, 40);
});

test('the report is the function of result.json and the verdict line is readable', () => {
  assert.equal(read('RESULT.md'), S.report(R));
  assert.equal(R.planSha256, sha(read('PREREGISTRATION.md')));
  assert.ok(R.verdict.length < 220);
  assert.ok(read('RESULT.md').includes(`**Verdict: ${R.verdict}**`));
  assert.ok(R.verdict.startsWith(R.decision.R1.pass ? 'PASS' : 'FAIL'));
  const v = studyVerdict(R, read('RESULT.md'));
  assert.equal(v.verdict, R.decision.R1.pass ? 'pass' : 'fail');
  // R2's difference is R1's trades summed per day
  assert.ok(Math.abs(R.tests.R2.OOS.diff.total - R.tests.R1.OOS.total) < 0.02);
  assert.equal(R.fills.OOS.revFills, R.tests.R1.OOS.n);
});
