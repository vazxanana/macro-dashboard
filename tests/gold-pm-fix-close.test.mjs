// gold-pm-fix-close: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  nyUtc, londonUtc, tradingDays, dailyAtr, setups, runSetup, aboveMedian, holm, monthT, pOne, TESTS, MED_N,
} from '../research/edge/gold-pm-fix-close/run.mjs';

const dir = new URL('../research/edge/gold-pm-fix-close/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const report = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

test('London and New York wall clock', () => {
  assert.equal(londonUtc(2026, 1, 15, 15, 0), Date.UTC(2026, 0, 15, 15, 0) / 1000);          // winter: 15:00 UTC
  assert.equal(londonUtc(2026, 7, 15, 15, 0), Date.UTC(2026, 6, 15, 14, 0) / 1000);          // BST: 14:00 UTC
  assert.equal(londonUtc(2026, 3, 20, 15, 0), Date.UTC(2026, 2, 20, 15, 0) / 1000);          // US summer, UK not yet
  assert.equal(nyUtc(2026, 3, 20, 17, 0), Date.UTC(2026, 2, 20, 21, 0) / 1000);
  assert.equal(nyUtc(2026, 1, 15, 17, 0), Date.UTC(2026, 0, 15, 22, 0) / 1000);
});

// hand-made M5 candles: a flat price per day except the slices we set
function build(days, pricer) {
  const bars = [];
  for (const D of days) for (let t = D.start; t < D.end; t += 300) { const p = pricer(t); bars.push([t, p.o, p.h, p.l, p.c]); }
  return bars;
}

test('signal = 17:00 NY close / 15:00 London price, next-day trade, ATR known at entry', () => {
  const days = tradingDays('2026-01-05', '2026-02-13');
  const fixD = days[20], fixT = londonUtc(fixD.y, fixD.m, fixD.d, 15, 0);
  // price 100 everywhere; on day 20 the 15:00 London price is 100 and it closes at 102 (a rise after the auction)
  const bars = build(days, (t) => {
    let c = 100;                                                // 0.5 range each candle, so ATR > 0
    if (t >= fixT && t < fixD.end) c = 102;
    return { o: c, h: c + 0.25, l: c - 0.25, c };
  });
  const { out } = setups(bars, days);
  const u = out.T1.find((x) => x.date === fixD.date);
  assert.ok(u, 'setup for the day');
  assert.ok(u.s > 0.019 && u.s < 0.021);
  assert.equal(u.next, days[21].date);
  assert.ok(u.entryT >= fixD.end, 'entry is after the signal close');
  const { atrIncl } = dailyAtr(bars, days);
  assert.equal(u.atr, atrIncl[20], 'ATR includes D, not D+1');
  // no look-ahead: changing every price after the 17:00 close of D leaves the signal and ATR unchanged
  const bars2 = bars.map((b) => (b[0] >= fixD.end ? [b[0], 50, 51, 49, 50] : b));
  const u2 = setups(bars2, days).out.T1.find((x) => x.date === fixD.date);
  assert.equal(u2.s, u.s); assert.equal(u2.atr, u.atr);
});

test('a trade always has a stop; stop and gap fills', () => {
  const bars = [[0, 100, 100.5, 99.5, 100], [300, 100, 100.2, 97, 98], [600, 98, 99, 97.5, 98.5]];
  const u = { i0: 0, i1: 3, entry: 100, atr: 2, exitPx: 98.5, entryT: 0, exitT: 900 };
  const buy = runSetup(bars, u, 1);
  assert.equal(buy.how, 'stop'); assert.equal(buy.R, -1);
  const gap = [[0, 100, 100.2, 99.8, 100], [300, 96, 96.5, 95, 96]];
  assert.equal(runSetup(gap, { ...u, i1: 2, exitPx: 96 }, 1).how, 'gap');
  const sell = runSetup(bars, u, -1);
  assert.equal(sell.how, 'time'); assert.ok(Math.abs(sell.R - 0.75) < 1e-9);
});

test('large-signal filter uses previous days only', () => {
  assert.equal(aboveMedian(new Array(MED_N - 1).fill(1), 5), null);
  const h = Array.from({ length: MED_N }, (_, i) => i / MED_N);
  assert.equal(aboveMedian(h, 0.9), true); assert.equal(aboveMedian(h, 0.1), false);
});

test('statistics helpers', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((v) => +v.toFixed(2)), [0.03, 0.08, 0.5]);
  const m = monthT([{ date: '2020-01-02', net: 1 }, { date: '2020-02-02', net: 2 }, { date: '2020-03-02', net: 3 }]);
  assert.equal(m.months, 3); assert.ok(m.t > 3);
});

test('result.json is consistent and the report matches it', () => {
  assert.equal(res.study, 'gold-pm-fix-close');
  assert.deepEqual(res.windows, { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] });
  const adj = holm(TESTS.map((k) => pOne(res.tests[k].oos.tMonth)));
  TESTS.forEach((k, i) => {
    const x = res.tests[k];
    assert.ok(Math.abs(x.holm - adj[i]) < 1e-3);
    const pass = x.is.net > 0 && x.oos.net > 0 && x.oos.tMonth >= 2 && x.holm < 0.05 && x.oos.n >= 200 && x.placebo.beats >= 38 && x.oos.net2x > 0;
    assert.equal(x.pass, pass);
    for (const [w, s] of [['IS 2007-16', x.is], ['OOS 2017-26', x.oos]]) {
      const f = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
      assert.ok(report.includes(`| ${w} | ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${f(s.net2x)} |`), `${k} ${w} row`);
    }
    assert.ok(report.includes(`| ${k} | `) && report.includes(`| ${x.placebo.beats} | **${x.pass ? 'yes' : 'no'}** |`));
  });
  assert.equal(res.passed.length, 0);
  assert.match(res.verdict, /^FAIL/);
  const line = report.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.length < 220 && line.includes('FAIL, 0 of 3'));
  const t1 = res.tests.T1.oos;
  assert.ok(line.includes(`n ${t1.n}`) && line.includes(`−${Math.abs(t1.net).toFixed(3)}R`) && line.includes(`−${Math.abs(t1.tMonth).toFixed(2)}`));
});
