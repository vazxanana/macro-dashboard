// eu-gap-fade: London session times with summer time, the gap and its trigger (no look-ahead), the prior US session, the
// trade (stop on the losing side, both sides), Holm, the placebo's determinism, and the report against result.json.
// Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P, TESTS, ldnAt, nyAt, euSessions, gaps, usSessions, priorUS, makeSeries, simulate, trade, holm, pOne, signOf, report, tStat, summary,
} from '../research/edge/eu-gap-fade/run.mjs';

const read = (f) => fs.readFileSync(new URL(`../research/edge/eu-gap-fade/${f}`, import.meta.url), 'utf8');
const U = (s) => Date.parse(s) / 1000;

test('the pre-registered constants and tests', () => {
  assert.equal(P.MED_N, 20); assert.equal(P.TRIG, 0.5); assert.equal(P.ATR_N, 20); assert.equal(P.STOP_ATR, 1); assert.equal(P.COST, 0.0004);
  assert.equal(P.SEEDS, 40); assert.equal(P.MIN_N, 200); assert.equal(P.MIN_N_T3, 100);
  assert.deepEqual(TESTS.T1.mks, ['de40']); assert.deepEqual(TESTS.T2.mks, ['uk100', 'eu50']); assert.equal(TESTS.T3.usLed, true);
  const all = Object.values(TESTS).flatMap((t) => t.mks); assert.ok(!all.includes('jp225') && !all.includes('hk33'));
});

test('the cash session is 08:00-16:30 London: 07:00-15:30 UTC in summer, 08:00-16:30 UTC in winter', () => {
  assert.equal(ldnAt('2026-07-14', 8), U('2026-07-14T07:00:00Z')); assert.equal(ldnAt('2026-07-14', 16, 30), U('2026-07-14T15:30:00Z'));
  assert.equal(ldnAt('2026-12-15', 8), U('2026-12-15T08:00:00Z')); assert.equal(ldnAt('2026-12-15', 16, 30), U('2026-12-15T16:30:00Z'));
  // the week the US is on daylight time and Europe is not (March 2026: US 8 Mar, Europe 29 Mar)
  assert.equal(ldnAt('2026-03-16', 8), U('2026-03-16T08:00:00Z')); assert.equal(ldnAt('2026-03-30', 8), U('2026-03-30T07:00:00Z'));
  assert.equal(ldnAt('2026-10-23', 8), U('2026-10-23T07:00:00Z')); assert.equal(ldnAt('2026-10-26', 8), U('2026-10-26T08:00:00Z'));
});

// a market with one 08:00 candle and one 16:15 candle a weekday; open[i] and close[i] given
function market(days, open, close) {
  const rows = [];
  days.forEach((d, i) => { const o = ldnAt(d, 8), c = ldnAt(d, 16, 30) - 900; rows.push([o, open[i], open[i], open[i], open[i]], [c, close[i], close[i], close[i], close[i]]); });
  return makeSeries(rows);
}
const weekdays = (from, n) => { const out = []; for (let t = U(from + 'T00:00:00Z'); out.length < n; t += 86400) { const w = new Date(t * 1000).getUTCDay(); if (w && w < 6) out.push(new Date(t * 1000).toISOString().slice(0, 10)); } return out; };

test('the gap is today\'s 08:00 open minus the previous 16:30 close; the trigger median excludes today', () => {
  const days = weekdays('2026-09-01', 25), open = [], close = [];
  days.forEach((d, i) => { const prevC = i ? close[i - 1] : 100; open.push(prevC + (i % 2 ? 1 : -1)); close.push(open[i]); });
  open[24] = close[23] + 0.4; // |gap| 0.4 against a median of 1: under the 0.5 trigger
  close[24] = open[24];
  const S = market(days, open, close), sess = euSessions(S, '2026-09-01', '2026-10-31');
  assert.equal(sess.length, 25);
  const g = gaps(sess);
  assert.equal(g.length, 24);
  assert.equal(g[0].g, open[1] - close[0]);
  assert.equal(g[19].med, null); assert.equal(g[20].med, 1); assert.equal(g[20].trig, true);
  assert.equal(g[23].trig, false); // 0.4 ≤ 0.5 × 1
  // a big gap today does not raise its own median
  const open2 = open.slice(); open2[24] = close[23] + 50;
  const g2 = gaps(euSessions(market(days, open2, close.map((c, i) => (i === 24 ? open2[24] : c))), '2026-09-01', '2026-10-31'));
  assert.equal(g2[23].med, 1); assert.equal(g2[23].trig, true);
  // a day missing its 16:15 candle is not a session day and is skipped
  const S3 = makeSeries(S.bars.filter((b) => b[0] !== ldnAt(days[5], 16, 30) - 900));
  assert.equal(euSessions(S3, '2026-09-01', '2026-10-31').length, 24);
});

test('the prior US session closes after the previous European close and at or before the open', () => {
  const rows = [];
  for (const d of ['2026-11-12', '2026-11-13']) rows.push([nyAt(d, 9, 30), 100, 100, 100, 100], [nyAt(d, 16) - 900, 101, 101, 101, d === '2026-11-13' ? 99 : 101]);
  const us = usSessions(makeSeries(rows), '2026-11-11', '2026-11-16');
  // Monday 16 Nov: the previous European session is Friday 13 Nov; Friday's New York session closes after it
  const u = priorUS(us, ldnAt('2026-11-13', 16, 30), ldnAt('2026-11-16', 8));
  assert.equal(u.date, '2026-11-13'); assert.ok(u.ret < 0);
  // Friday 13 Nov: the Thursday session
  assert.equal(priorUS(us, ldnAt('2026-11-12', 16, 30), ldnAt('2026-11-13', 8)).date, '2026-11-12');
  // a previous European close after the US close leaves no prior US session
  assert.equal(priorUS(us, nyAt('2026-11-13', 16) + 60, ldnAt('2026-11-16', 8)), null);
  // 11 Nov 2026 is a cash day without candles here: its return is null, never a sign
  assert.equal(us.find((x) => x.date === '2026-11-11').ret, null);
});

test('every trade has its stop on the losing side, for buys and sells; a fade is against the gap', () => {
  assert.throws(() => simulate([[0, 100, 101, 99, 100]], { s: 1, entry: 100, stop: 101, from: 0, to: 0 }));
  assert.throws(() => simulate([[0, 100, 101, 99, 100]], { s: -1, entry: 100, stop: 99, from: 0, to: 0 }));
  const bars = [[0, 100, 100.5, 99.5, 100.2], [900, 100.2, 100.4, 98.9, 99.2], [1800, 99.2, 99.5, 99, 99.3]];
  const S = makeSeries(bars), row = { date: '2026-11-10', O: 100, iO: 0, iX: 2, g: 1.2 };
  const sell = trade(S, row, 1, -signOf(row.g), 'de40');
  assert.equal(sell.s, -1); assert.equal(sell.stop, 101); assert.equal(sell.how, 'time'); assert.ok(Math.abs(sell.R - 0.7) < 1e-9);
  assert.ok(Math.abs(sell.costR - 0.04) < 1e-12); assert.ok(Math.abs(sell.net - 0.66) < 1e-9);
  const buy = trade(S, { ...row, g: -1.2 }, 1, 1, 'de40');
  assert.equal(buy.stop, 99); assert.equal(buy.how, 'stop'); assert.equal(buy.R, -1);
  const gap = simulate([[0, 100, 100, 100, 100], [900, 102, 103, 101.5, 102.5]], { s: -1, entry: 100, stop: 101, from: 0, to: 1 });
  assert.equal(gap.how, 'gap'); assert.equal(gap.R, -2);
});

test('statistics: month sums, one-sided p, Holm', () => {
  assert.equal(tStat([1]), null); assert.ok(tStat([1, 2, 3]) > 0);
  assert.ok(Math.abs(pOne(1.6449) - 0.05) < 1e-3); assert.equal(pOne(null), 1);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
  const s = summary([{ date: '2020-01-02', s: 1, R: 1, costR: 0.1, net: 0.9, net2: 0.8, entry: 100, stop: 99, how: 'time' },
    { date: '2020-02-03', s: -1, R: -1, costR: 0.1, net: -1.1, net2: -1.2, entry: 100, stop: 101, how: 'stop' }]);
  assert.equal(s.n, 2); assert.equal(s.months, 2); assert.equal(s.maxDD, 1.1); assert.equal(s.buys, 1);
});

test('result.json and RESULT.md agree, with a Verdict line and the source named', () => {
  const res = JSON.parse(read('result.json')), md = read('RESULT.md');
  assert.equal(md, report(res));
  assert.match(md, /^## Verdict: (PASS|FAIL|INCONCLUSIVE)/m);
  assert.ok(res.verdict.startsWith(res.verdictClass));
  for (const k of ['T1', 'T2', 'T3']) {
    const c = res.conditions[k], d = res.tests[k].decisive, r = res.tests[k].replication;
    assert.equal(c.decisivePositive, d.netR > 0); assert.equal(c.replicationPositive, r.netR > 0); assert.equal(c.holm, d.pHolm < 0.05);
    assert.equal(c.pass, c.decisivePositive && c.replicationPositive && c.holm && c.n);
    assert.equal(d.placebo.p5 <= d.placebo.p95, true);
  }
  const any = Object.values(res.conditions).some((c) => c.pass);
  assert.equal(res.verdictClass === 'PASS', any);
  const pre = read('PREREGISTRATION.md');
  assert.match(pre, /#913/); assert.match(pre, /JP225/); assert.match(pre, /excluded/);
});
