// us-asia-lead: session times, the US signal, the trade (stop on the losing side, both sides), Holm, the placebo's
// determinism, and the report against result.json. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P, asiaDay, sessionTimes, nyAt, usSignals, makeSeries, simulate, trade, holm, isStrong, signOf, report, tStat,
} from '../research/edge/us-asia-lead/run.mjs';

const read = (f) => fs.readFileSync(new URL(`../research/edge/us-asia-lead/${f}`, import.meta.url), 'utf8');

test('the pre-registered constants', () => {
  assert.equal(P.ATR_N, 20); assert.equal(P.STOP_ATR, 1); assert.equal(P.COST, 0.0004); assert.equal(P.SD_N, 20);
  assert.equal(P.SEEDS, 40); assert.equal(P.MIN_N, 100); assert.equal(P.MIN_N_T2, 50);
});

test('a US Friday leads the Asian Monday; sessions are 00:00-06:00 and 01:30-08:00 UTC', () => {
  assert.equal(asiaDay('2026-11-13'), '2026-11-16'); // Friday → Monday
  assert.equal(asiaDay('2026-11-10'), '2026-11-11');
  const j = sessionTimes('jp225', '2026-11-16'), h = sessionTimes('hk33', '2026-11-16'), b = Date.parse('2026-11-16T00:00:00Z') / 1000;
  assert.equal(j.open, b); assert.equal(j.close, b + 6 * 3600); assert.equal(h.open, b + 5400); assert.equal(h.close, b + 8 * 3600);
  // the US close (20:00 or 21:00 UTC) is before the next Asian open in both seasons
  for (const d of ['2026-07-14', '2026-12-15']) assert.ok(nyAt(d, 16) < sessionTimes('jp225', asiaDay(d)).open);
});

test('the US signal is the 09:30-16:00 New York return, and the strong-day sd excludes the day itself', () => {
  const rows = [];
  const days = [];
  for (let d = 1; d <= 30; d++) { const dt = new Date(Date.UTC(2026, 9, d)); if (dt.getUTCDay() > 0 && dt.getUTCDay() < 6) days.push(dt.toISOString().slice(0, 10)); }
  days.forEach((d, i) => {
    const o = nyAt(d, 9, 30), c = nyAt(d, 16) - 900, ret = i === days.length - 1 ? 0.05 : (i % 2 ? 0.002 : -0.002);
    rows.push([o, 100, 100, 100, 100], [c, 100, 100, 100, 100 * (1 + ret)]);
  });
  const sig = usSignals(makeSeries(rows), '2026-10-01', '2026-10-30');
  assert.equal(sig.length, days.length);
  assert.ok(Math.abs(sig[0].ret + 0.002) < 1e-12);
  assert.equal(sig[19].sd, null); assert.ok(sig[20].sd > 0);
  const last = sig.at(-1); assert.ok(isStrong(last)); assert.ok(last.sd < 0.003); // the 5 % day is not in its own sd
  assert.equal(signOf(0), 0); assert.equal(signOf(-1e-9), -1);
});

test('every trade has its stop on the losing side, for buys and sells; gaps and stops exit as written', () => {
  assert.throws(() => simulate([[0, 100, 101, 99, 100]], { s: 1, entry: 100, stop: 101, from: 0, to: 0 }));
  assert.throws(() => simulate([[0, 100, 101, 99, 100]], { s: -1, entry: 100, stop: 99, from: 0, to: 0 }));
  const bars = [[0, 100, 100.5, 99.5, 100.2], [900, 100.2, 100.4, 98.9, 99.2], [1800, 99.2, 99.5, 99, 99.3]];
  const buy = simulate(bars, { s: 1, entry: 100, stop: 99, from: 0, to: 2 });
  assert.equal(buy.how, 'stop'); assert.equal(buy.R, -1);
  const sell = simulate(bars, { s: -1, entry: 100, stop: 101, from: 0, to: 2 });
  assert.equal(sell.how, 'time'); assert.ok(Math.abs(sell.R - 0.7) < 1e-9);
  const gap = simulate([[0, 100, 100, 100, 100], [900, 102, 103, 101.5, 102.5]], { s: -1, entry: 100, stop: 101, from: 0, to: 1 });
  assert.equal(gap.how, 'gap'); assert.equal(gap.R, -2);
  const S = makeSeries(bars), p = { date: '2026-11-10', asia: '2026-11-11', t0: 0, iE: 0, iX: 2, entry: 100, atr: 1, atClose: 99.5 };
  for (const s of [1, -1]) {
    const t = trade(S, p, s);
    assert.ok(s * (t.entry - t.stop) > 0);
    assert.ok(Math.abs(t.costR - 0.0004 * 100 / 1) < 1e-12); assert.ok(Math.abs(t.net - (t.R - t.costR)) < 1e-12);
    assert.ok(Math.abs(t.net2 - (t.R - 2 * t.costR)) < 1e-12);
  }
});

test('Holm and the month t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.equal(tStat([1]), null); assert.ok(Math.abs(tStat([1, 2, 3]) - 2 / (1 / Math.sqrt(3))) < 1e-12);
});

test('the report is the one result.json gives and the verdict follows the pre-registered rules', () => {
  const r = JSON.parse(read('result.json')), md = read('RESULT.md');
  assert.equal(report(r), md);
  assert.ok(md.includes(`## Verdict: ${r.verdict}.`));
  for (const k of ['T1', 'T2', 'T3']) {
    const c = r.conditions[k], d = r.tests[k].decisive, x = r.tests[k].replication;
    assert.equal(c.decisivePositive, d.netR > 0); assert.equal(c.replicationPositive, x.netR > 0); assert.equal(c.holm, d.pHolm < 0.05);
    assert.equal(c.pass, c.decisivePositive && c.replicationPositive && c.holm && c.n);
    assert.equal(r.tests[k].decisive.placebo.sign.p5 <= r.tests[k].decisive.placebo.sign.p95, true);
  }
  const anyPass = ['T1', 'T2', 'T3'].some((k) => r.conditions[k].pass), anyBoth = ['T1', 'T2', 'T3'].some((k) => r.conditions[k].decisivePositive && r.conditions[k].replicationPositive);
  assert.equal(r.verdictClass, anyPass ? 'PASS' : anyBoth ? 'INCONCLUSIVE' : 'FAIL');
  assert.equal(r.verdictClass, 'FAIL');
  assert.ok(!/now live|live change/i.test(md.replace(/nothing live changed/gi, '')));
});

test('the pre-registration was written before the run and names the pass bar', () => {
  const pre = read('PREREGISTRATION.md');
  assert.match(pre, /Holm-adjusted one-sided p < 0\.05/);
  assert.match(pre, /n >= 100 in each window \(T2: n >= 50/);
  assert.match(pre, /0\.0004/);
});
