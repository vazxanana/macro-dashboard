// gold-pre-nfp-replicate: the date rule, the trade on hand-made candles, no look-ahead, the release-minute check, and the
// report against result.json (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { derive, payrolls, councilNfp, holidays } from '../research/edge/gold-pre-nfp-replicate/dates.mjs';
import { timesOf, atr, trade, runPre, indexOf, endingAt, spikeRatio, checkDates, ruleCheck, monthSums, tOf, COST, STOP_K }
  from '../research/edge/gold-pre-nfp-replicate/run.mjs';
import { zonedToUtc } from '../council/events.mjs';

const H = 3600, DIR = 'research/edge/gold-pre-nfp-replicate/';
const flat = (t0, n, p = 2000) => Array.from({ length: n }, (_, i) => [t0 + i * H, p, p + 0.5, p - 0.5, p]);

test('date rule: third Friday after the reference week, January shift, holiday Thursday', () => {
  assert.equal(derive(2021, 11), '2022-01-07');           // Dec 2021 report
  assert.equal(derive(2023, 1), '2023-03-10');            // Feb 2023: the second Friday, not the first
  assert.equal(derive(2024, 11), '2025-01-10');           // derived 3 Jan → one week later
  assert.equal(derive(2025, 5), '2025-07-03');            // 4 July on a Friday → Thursday
  assert.equal(derive(2015, 5), '2015-07-02');            // 4 July on a Saturday, observed Friday 3 → Thursday 2
  assert.ok(holidays(2020).has('2020-07-03'));
  const rc = ruleCheck();
  assert.equal(rc.listed, councilNfp().length);
  assert.equal(rc.match, 56);
  assert.deepEqual(rc.miss, ['2025-11-20', '2025-12-16', '2026-02-11']);
  const p = payrolls();
  assert.equal(p[0].d, '2006-04-07'); assert.equal(p.at(-1).d, '2021-12-03');
  assert.equal(p.find((x) => x.report === '2013-09').d, '2013-10-22');
});

test('times: entry 17:00 New York three weekdays before, exit 08:00 New York on the day', () => {
  const tm = timesOf('2019-03-08');                         // Friday, EST
  assert.equal(tm.E, Date.UTC(2019, 2, 5, 22) / 1000);
  assert.equal(tm.X, Date.UTC(2019, 2, 8, 13) / 1000);
});

test('trade: 2 x ATR20 x √hours stop, stop and gap exits, costs', () => {
  const b = flat(0, 40);
  assert.equal(atr(b, 25), 1);
  const up = trade(b, 25, 34, 1, 9);
  assert.equal(up.dist, STOP_K * 3); assert.equal(up.how, 'time');
  assert.ok(Math.abs(up.net + COST / 6) < 1e-12);
  const s = flat(0, 40); s[30] = [30 * H, 2000, 2000.2, 1990, 1995];
  assert.equal(trade(s, 25, 34, 1, 9).exit, 1994);
  const g = flat(0, 40); g[28] = [28 * H, 1990, 1991, 1989, 1990];
  assert.equal(trade(g, 25, 34, 1, 9).how, 'gap');
});

test('no look-ahead: prices after the exit candle change nothing', () => {
  const R = '2019-03-08', tm = timesOf(R), bars = flat(tm.E - 40 * H, 40 + (tm.X - tm.E) / H + 30);
  const c = bars.map((x) => [...x]);
  for (const x of c) if (x[0] >= tm.X) { x[2] = 9000; x[3] = 10; x[4] = 5000; }
  const a = runPre(bars, indexOf(bars), R), b = runPre(c, indexOf(c), R);
  assert.deepEqual(a.pre, b.pre);
  assert.equal(bars[endingAt(indexOf(bars), bars, tm.X)][0], tm.X - H);
});

test('release-minute check: a wide 08:30 candle verifies, a narrow one does not, an adjacent Friday can take it', () => {
  const R = '2019-03-08', m5 = [];
  for (let k = -9; k <= 8; k++) {
    const d = new Date(Date.parse(R + 'T00:00:00Z') + k * 864e5).toISOString().slice(0, 10), t = zonedToUtc(d, '08:30', 'America/New_York');
    const w = d === '2019-03-01' ? 5 : 1;
    m5.push([t, 100, 100 + w / 2, 100 - w / 2, 100]);
  }
  assert.equal(spikeRatio(m5, R, R), 1);
  assert.equal(spikeRatio(m5, R, '2019-03-01'), 5);
  const [x] = checkDates([{ report: '2019-02', derived: R, d: R, why: 'rule' }], { [R]: m5 });
  assert.equal(x.status, 'moved'); assert.equal(x.d, '2019-03-01');
  assert.equal(spikeRatio([], R, R), null);
});

test('statistics: month sums and t', () => {
  assert.deepEqual(monthSums([{ R: '2010-01-08', net: 1 }, { R: '2010-01-29', net: 2 }, { R: '2010-02-05', net: -1 }]), [3, -1]);
  assert.equal(tOf([1, 1]), 0);
});

test('report agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8')), md = fs.readFileSync(DIR + 'RESULT.md', 'utf8');
  const head = md.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.equal(head.replace(/\*\*/g, ''), r.headline);
  assert.ok(r.headline.length < 220);
  assert.equal(r.verdict, r.test.pass ? 'PASS' : r.gate.ok ? 'FAIL' : 'INCONCLUSIVE');
  assert.ok(r.gate.ok, 'the harness reproduced gold-pre-cpi T2 on 2022-26');
  assert.equal(r.gate.n, 47);
  const x = r.test;
  assert.equal(x.pass, x.checks.tOne && x.checks.costs2 && x.checks.placebo && x.checks.halves);
  assert.equal(x.placebo.means.length, 40);
  assert.equal(x.placebo.beats, x.placebo.means.filter((m) => x.net > m).length);
  assert.equal(x.n, r.trades.length);
  const mean = r.trades.reduce((s, t) => s + t.net, 0) / r.trades.length;
  assert.ok(Math.abs(mean - x.net) < 0.002);
  for (const t of r.trades) assert.ok(t.stop < t.entry, 'every trade is a long with its stop below');
  assert.ok(md.includes(`| ${x.n} | ${x.months} |`));
  assert.equal(r.dates.n, r.dates.verified + r.dates.moved + r.dates.unverified + r.dates.exceptionVerified + r.dates.exceptionUnverified);
  assert.ok(fs.readFileSync(DIR + 'PREREGISTRATION.md', 'utf8').includes('One test, so no Holm correction'));
});
