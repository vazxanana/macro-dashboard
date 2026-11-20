// research/edge/nowcast-vs-consensus (pre-registered 20 Nov 2026): the rule on hand-made rows, the committed result equals a
// fresh run on the committed inputs, the report and the Week ahead's sentence quote it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rows, analyse, verdictOf, build, sentence, leanOf, printSide, MIN_JUDGED, HALF } from '../research/edge/nowcast-vs-consensus/run.mjs';
import * as WA from '../council/week-ahead.mjs';
import * as PR from '../council/prep-record.mjs';

const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DIR = 'research/edge/nowcast-vs-consensus/';
const rec = (d, nowcast, print, chart) => ({ release_date: d, reference_month: d.slice(0, 7), model_chart_date: chart || '2000-01-01', model_age_days: 1,
  model_original_delivery_authenticated: false, measure: { core: { actual: { numeric: print }, forecasts: { C: { numeric: nowcast } } } } });

test('the rule: the desk\'s 0.05 band, the print to one decimal, a print on the consensus is not judged', () => {
  assert.equal(leanOf(0.24, 0.2), 'in line'); assert.equal(leanOf(0.25, 0.2), 'above'); assert.equal(leanOf(0.15, 0.2), 'below'); assert.equal(leanOf(0.151, 0.2), 'in line');
  assert.equal(printSide(0.3, 0.3), 'on'); assert.equal(printSide(0.4, 0.3), 'above'); assert.equal(printSide(0.1, 0.3), 'below'); assert.equal(printSide(0.1 + 0.2, 0.3), 'on');
  const bench = { records: [rec('2023-02-14', 0.46, 0.5), rec('2023-01-12', 0.31, 0.5), rec('2023-03-14', 0.46, 0.3), rec('2023-04-12', 0.1, 0.1), rec('2023-05-10', 0.6, 0.2), rec('2023-06-13', 0.4, 0.4)] };
  const hist = { rows: [['Core CPI m/m', '2023-01-12T13:30:00Z', '0.3%', '0.5%', ''], ['Core CPI m/m', '2023-02-14T13:30:00Z', '0.4%', '0.5%', ''], ['CPI m/m', '2023-03-14T12:30:00Z', '0.9%', '0.9%', ''],
    ['Core CPI m/m', '2023-03-14T12:30:00Z', '0.3%', '0.3%', ''], ['Core CPI m/m', '2023-04-12T12:30:00Z', '0.2%', '0.2%', ''], ['Core CPI m/m', '2023-05-10T12:30:00Z', '0.3%', '0.2%', '']] };
  const R = rows(bench, hist, 'core');
  assert.deepEqual(R.map((r) => r.d), ['2023-01-12', '2023-02-14', '2023-03-14', '2023-04-12', '2023-05-10']);   // sorted, the release without a consensus row left out
  assert.deepEqual(R.map((r) => [r.lean, r.side, r.judged, r.hit]), [['in line', 'above', false, null], ['above', 'above', true, true], ['above', 'on', false, null], ['below', 'below', true, true], ['above', 'below', true, false]]);
  const A = analyse(R);
  assert.deepEqual([A.releases, A.lean, A.inLine, A.leanPrintOnConsensus, A.judged.n, A.judged.hits], [5, 4, 1, 1, 3, 2]);
  assert.equal(A.judged.p, +PR.binomP(2, 3).toFixed(4)); assert.equal(A.preRelease, true); assert.equal(A.authenticated, false);
  assert.equal(rows(bench, hist, 'headline').length, 0);
});

test('the bar: under 20 judged is INCONCLUSIVE; PASS needs p < 0.05 and both halves above 50%; a release-day nowcast is never judged a pass', () => {
  const t = (hits, n) => ({ n, hits, rate: n ? hits / n : null, p: n ? PR.binomP(hits, n) : null });
  const A = (all, a, b, pre = true) => ({ preRelease: pre, judged: t(...all), halves: { first: t(...a), second: t(...b) } });
  assert.equal(MIN_JUDGED, 20); assert.equal(HALF, 18);
  assert.equal(verdictOf(A([19, 19], [10, 10], [9, 9])), 'INCONCLUSIVE');
  assert.equal(verdictOf(A([17, 20], [9, 10], [8, 10])), 'PASS');
  assert.equal(verdictOf(A([14, 20], [7, 10], [7, 10])), 'FAIL');            // p 0.115
  assert.equal(verdictOf(A([15, 20], [10, 10], [5, 10])), 'FAIL');           // a half at 50 %
  assert.equal(verdictOf(A([16, 20], [16, 20], [0, 0])), 'FAIL');            // a half with nothing judged
  assert.equal(verdictOf(A([3, 20], [1, 10], [2, 10])), 'FAIL');             // significant the wrong way
  assert.equal(verdictOf(A([17, 20], [9, 10], [8, 10], false)), 'INCONCLUSIVE');
});

test('the committed result equals a fresh run on the committed inputs; the pre-registration and the report are there', () => {
  const R = JSON.parse(rd(DIR + 'result.json'));
  const fresh = build(JSON.parse(rd('research/macro-veteran/references/cpi-model-benchmark-inputs-2022-2024.json')), JSON.parse(rd('council/consensus-history.json')));
  assert.deepEqual(JSON.parse(JSON.stringify(fresh)), R);
  assert.equal(R.verdict, 'INCONCLUSIVE'); assert.equal(R.core.releases, 36); assert.equal(R.headline.releases, 36);
  assert.equal(R.inLine, WA.IN_LINE); assert.equal(R.inLine, PR.IN_LINE);
  assert.ok(R.core.preRelease && !R.core.authenticated);
  assert.ok(R.events.core.every((r) => r.ageDays === 1 && r.chartDate < r.d));
  const md = rd(DIR + 'RESULT.md'), c = R.core, h = R.headline;
  assert.match(md, /\*\*Verdict: INCONCLUSIVE\*\*/);
  for (const s of [`${c.judged.hits} of ${c.judged.n} judged`, `p ${c.judged.p.toFixed(2)}`, `${c.lean} of 36 (53 %)`, `${h.lean} of 36 (56 %)`, `**${c.judged.hits} of ${c.judged.n} (62 %), p 0.58**`,
    `${h.judged.hits} of ${h.judged.n} (42 %), p ${h.judged.p.toFixed(2)}`, `| ${c.halves.first.hits} of ${c.halves.first.n} | ${h.halves.first.hits} of ${h.halves.first.n} |`,
    `| ${c.halves.second.hits} of ${c.halves.second.n} | ${h.halves.second.hits} of ${h.halves.second.n} |`, `| ${c.bySide.above.hits} of ${c.bySide.above.n} | ${h.bySide.above.hits} of ${h.bySide.above.n} |`,
    `| ${c.bySide.below.hits} of ${c.bySide.below.n} | ${h.bySide.below.hits} of ${h.bySide.below.n} |`, `| ${c.leanPrintOnConsensus} | ${h.leanPrintOnConsensus} |`, R.sentence.replace('(two-sided binomial p\n', '')])
    assert.ok(md.replace(/\n/g, ' ').includes(s), s);
  assert.equal(R.events.core.filter((r) => r.lean === 'above').length, 17); assert.match(md, /17 of the 19 core leans/);
  assert.equal(R.events.headline.filter((r) => r.lean === 'above').length, 16); assert.match(md, /16 of the 20 headline leans/);
  assert.equal(c.calendarDiffers + h.calendarDiffers, 0);
  const pre = rd(DIR + 'PREREGISTRATION.md');
  assert.match(pre, /committed alone, before `run\.mjs` exists/); assert.match(pre, /judged n ≥ 20 AND p < 0\.05/); assert.match(pre, /not a trade/);
  assert.match(md, /not an authenticated real-time vintage/);
});

test('the Week ahead quotes the study on the core CPI row only, in the study\'s own words', () => {
  const R = JSON.parse(rd(DIR + 'result.json')), S = WA.PREP_STUDY;
  assert.equal(S.text, R.sentence); assert.equal(S.text, sentence(R));
  assert.deepEqual([S.verdict, S.hits, S.n, S.p], [R.verdict, R.core.judged.hits, R.core.judged.n, +R.core.judged.p.toFixed(2)]);
  const nc = { core: 0.27, head: 0.31 };
  const core = WA.prepFor({ title: 'Core CPI m/m', exp: '0.2%', type: 'CPI' }, nc, null);
  assert.ok(core.text.includes(R.sentence)); assert.match(core.text, /too few judged releases to say\. A model's estimate, not a forecast/);
  assert.deepEqual(core.study, { study: 'nowcast-vs-consensus', verdict: 'INCONCLUSIVE', hits: 8, n: 13, p: 0.58 });
  for (const r of [{ title: 'CPI m/m', exp: '0.2%', type: 'CPI' }, { title: 'Core PCE Price Index m/m', exp: '0.2%', type: 'PCE' }]) {
    const p = WA.prepFor(r, nc, null); assert.equal(p.study, null); assert.ok(!/2022-24/.test(p.text), r.title);
  }
  assert.ok(!/\bedge\b/.test(S.text));
});
