// announcement-premium study: the date rules on hand-made cases, the statistics, a run on synthetic candles, and the report
// against result.json. Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { blsRuleDate, blsDate, nfpRuleDates, nfpDates, cpiDates, fomcDates, dayKind, isTradingDay, releaseDays, CPI_MEMORY, CPI_MEMORY_DROPPED }
  from '../research/edge/announcement-premium/dates.mjs';
import { stats, welch, holm, dayReturns, testMarket, judge, headline, report, finPct, rateOf, MARKETS, SPLIT }
  from '../research/edge/announcement-premium/run.mjs';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '../research/edge/announcement-premium');
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const MD = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');

test('payrolls rule: reference week, January, Independence Day, the 2013 shutdown', () => {
  assert.equal(blsRuleDate(2008, 2), '2008-03-07');        // 12 Feb 2008 a Tuesday, week ends Sat 16th, + 20 days
  assert.equal(blsDate(2007, 12), '2008-01-04');           // computed 4 Jan: not 1-3, stays
  assert.equal(blsRuleDate(2008, 12), '2009-01-02');
  assert.equal(blsDate(2008, 12), '2009-01-09');           // computed 2 Jan -> one week later
  assert.equal(blsDate(2008, 6), '2008-07-03');            // computed Fri 4 July -> Thursday 3rd
  assert.equal(blsDate(2009, 6), '2009-07-02');            // 4 July 2009 a Saturday: Fri 3rd observed -> Thursday 2nd
  assert.equal(blsDate(2013, 9), '2013-10-22');            // shutdown
  assert.equal(blsDate(2013, 10), '2013-11-08');
  const d = nfpRuleDates();
  assert.equal(d.length, 168); assert.equal(d[0], '2008-01-04'); assert.equal(d.at(-1), '2021-12-03');
  for (const x of d) { const wd = new Date(x + 'T12:00:00Z').getUTCDay(); assert.ok(wd === 5 || ['2008-07-03', '2009-07-02', '2014-07-03', '2015-07-02', '2020-07-02', '2013-10-22'].includes(x), x); }
  assert.ok(nfpDates().some((x) => x.d === '2022-01-07' && x.src === 'council/events.mjs'));
});

test('CPI: no dates before 2012, the memory dates the spike check dropped stay out', () => {
  const c = cpiDates();
  assert.ok(c.every((x) => x.d >= '2012-01-01'));
  for (const d of CPI_MEMORY_DROPPED) assert.ok(!c.some((x) => x.d === d), d);
  assert.equal(c.filter((x) => x.d < '2018-01-01').length, CPI_MEMORY.length - CPI_MEMORY_DROPPED.length);
  assert.ok(c.some((x) => x.d === '2018-01-12' && /BLS schedule/.test(x.src)));
});

test('NYSE calendar and release-day drops', () => {
  assert.equal(dayKind('2015-04-03'), 'holiday');   // Good Friday payrolls
  assert.equal(dayKind('2012-10-29'), 'special');
  assert.equal(dayKind('2026-11-07'), 'weekend');
  assert.equal(isTradingDay('2026-11-06'), true);
  assert.equal(isTradingDay('2023-11-23'), false);  // Thanksgiving
  assert.ok(fomcDates().includes('2024-06-12') && fomcDates().includes('2020-03-15'));
  const { days, dropped } = releaseDays('2024-06-01', '2024-06-30');
  assert.deepEqual(days.map((x) => x.d), ['2024-06-07']);
  assert.deepEqual(dropped.map((x) => [x.d, x.why]), [['2024-06-12', 'FOMC day']]);
  const gf = releaseDays('2015-04-01', '2015-04-05');
  assert.equal(gf.days.length, 0); assert.match(gf.dropped[0].why, /not a NYSE trading day/);
});

test('statistics and financing', () => {
  assert.deepEqual(stats([1, 2, 3]).mean, 2);
  const w = welch([1, 2, 3, 4], [0, 1, 0, 1]);
  assert.ok(Math.abs(w.diff - 2) < 1e-12 && w.t > 2);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(finPct(3.65) - 6.15 / 365) < 1e-12);
  const rate = rateOf([['2020-01-03', 1], ['2020-01-10', 2]]);
  assert.equal(rate('2020-01-09'), 1); assert.equal(rate('2020-01-10'), 2); assert.equal(rate('2019-12-31'), null);
  const rows = [[Date.UTC(2020, 0, 6) / 1e3, 0, 0, 0, 100], [Date.UTC(2020, 0, 7) / 1e3, 0, 0, 0, 101]];
  assert.ok(Math.abs(dayReturns(rows).get('2020-01-07') - 1) < 1e-9);
});

test('a synthetic market: release days earn 1 % more, the test sees it; costs are charged on release days only', () => {
  const rel = new Set(['2018-01-05', '2018-02-02', '2019-03-08', '2015-06-05']), rows = []; let c = 100, k = 0;
  for (let t = Date.UTC(2014, 0, 1); t <= Date.UTC(2019, 11, 31); t += 86400e3) {
    const d = new Date(t).toISOString().slice(0, 10); if (!isTradingDay(d)) continue;
    const g = (rel.has(d) ? 1 : 0) + ((k++ % 2) ? 0.1 : -0.1); c *= 1 + g / 100; rows.push([t / 1e3, c, c, c, c]);
  }
  const relDays = [...rel].map((d) => ({ d, types: ['NFP'] }));
  const out = testMarket({ id: 'T1', key: 'x', name: 'x', cost: 0.04 }, rows, relDays, rel, () => 1.5, '2019-12-31');
  assert.equal(out.oos.n, 3); assert.equal(out.is.n, 1);
  assert.ok(Math.abs(out.oos.relGross - 1.033) < 0.05);
  assert.ok(Math.abs(out.oos.cost - (0.04 + 4 / 365)) < 1e-4);
  assert.ok(out.oos.diffNet > 0.9 && out.oos.diffNet2 > 0.8);
  assert.equal(out.placebo.seeds, 40);
});

test('result.json: five tests, the verdict follows T1, Holm and the checks hold', () => {
  assert.deepEqual(R.tests.map((t) => t.id), MARKETS.map((m) => m.id));
  const J = judge(JSON.parse(JSON.stringify(R.tests)));
  assert.equal(J.verdict, R.verdict);
  for (const t of R.tests) {
    assert.equal(t.pass, Object.values(t.checks).every(Boolean));
    assert.equal(t.checks.nOk, t.oos.n >= 100);
    assert.equal(t.checks.sameSignIS, t.is.diffNet > 0);
    assert.equal(t.checks.cost2, t.oos.diffNet2 > 0);
    assert.equal(t.checks.placebo, t.placebo.beaten >= 38);
    assert.ok(t.oos.from >= SPLIT && t.is.to < SPLIT && t.is.from >= '2008-01-01');
  }
  assert.equal(R.funnel.releaseDays, R.releaseDates.length);
  assert.ok(R.releaseDates.every((x) => !fomcDates().includes(x.d) && isTradingDay(x.d)));
  assert.equal(R.verdict, 'FAIL');
});

test('RESULT.md: the bold verdict line with its reason, under 220 characters, and the tables from result.json', () => {
  const line = MD.split('\n').find((l) => /^\*\*Verdict:/.test(l));
  assert.equal(line, headline(R));
  assert.ok(line.length < 220, String(line.length));
  assert.match(line, new RegExp(`^\\*\\*Verdict: ${R.verdict}: .+\\.\\*\\*$`));
  assert.equal(MD, report(R));
  for (const t of R.tests) {
    const row = MD.split('\n').find((l) => l.startsWith(`| ${t.id} | ${t.name} | ${t.oos.n} |`));
    assert.ok(row, t.id);
    assert.ok(row.includes(` ${t.holmP} `) && row.endsWith(`| ${t.pass ? 'yes' : 'no'} |`), t.id);
  }
});
