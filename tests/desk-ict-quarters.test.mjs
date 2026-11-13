// node --test tests/desk-ict-quarters.test.mjs — research/edge/ict-quarters (13 Nov 2026): the quarter classifier on fixed
// dates (daylight-time switches included), the published numbers, and that the study reads the ICT engine without touching it.
// Offline. Not named tests/ict-*: it also checks research files and the Edge lab's verdict reader.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tradingDay, weekQ, monthQ, yearQ, favoured, FAVOURED, CYCLES } from '../research/edge/ict-quarters/quarters.mjs';
import { welch, holm, judge, quarterOf } from '../research/edge/ict-quarters/run.mjs';
import { headlineOf, classify, studyVerdict } from '../research/edge/verdict.mjs';
import { slimStudy } from '../research/edge/lab-summary.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'ict-quarters');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const T = (s) => Date.parse(s) / 1000;
const td = (s) => { const d = tradingDay(T(s)); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')} ${d.dow}`; };

test('trading day starts at 18:00 New York, in winter and in summer', () => {
  // winter (UTC-5): 18:00 New York = 23:00 UTC
  assert.equal(td('2026-01-13T22:59:00Z'), '2026-01-13 2');   // Tuesday 17:59 New York: still Tuesday
  assert.equal(td('2026-01-13T23:00:00Z'), '2026-01-14 3');   // Tuesday 18:00 New York: Wednesday's trading day
  // summer (UTC-4): 18:00 New York = 22:00 UTC
  assert.equal(td('2026-07-14T21:59:00Z'), '2026-07-14 2');
  assert.equal(td('2026-07-14T22:00:00Z'), '2026-07-15 3');
  // Sunday evening reopen belongs to Monday
  assert.equal(td('2026-01-11T23:00:00Z'), '2026-01-12 1');
  assert.equal(weekQ(T('2026-01-11T23:00:00Z')), 1);
});

test('daylight-time switch weekends (US: 2nd Sunday of March, 1st Sunday of November)', () => {
  // 8 Mar 2026: clocks go forward at 07:00 UTC; Sunday 18:00 New York = 22:00 UTC is Monday's trading day
  assert.equal(td('2026-03-08T21:30:00Z'), '2026-03-08 0');   // Sunday 17:30 EDT: the halt hour, a weekend day
  assert.equal(td('2026-03-08T22:30:00Z'), '2026-03-09 1');
  // the Friday before, still on winter time: 18:00 New York = 23:00 UTC
  assert.equal(td('2026-03-06T22:30:00Z'), '2026-03-06 5');
  // 1 Nov 2026: clocks go back at 06:00 UTC; Sunday 18:00 New York = 23:00 UTC
  assert.equal(td('2026-11-01T22:30:00Z'), '2026-11-01 0');
  assert.equal(td('2026-11-01T23:30:00Z'), '2026-11-02 1');
  // the week between the US and the European switches (US already on daylight time)
  assert.equal(td('2026-03-24T22:00:00Z'), '2026-03-25 3');
  assert.equal(td('2026-03-24T21:59:00Z'), '2026-03-24 2');
});

test('week, month and year quarters on fixed dates', () => {
  const at = (s) => [weekQ(T(s)), monthQ(T(s)), yearQ(T(s))];
  assert.deepEqual(at('2026-06-09T14:00:00Z'), [2, 2, 2]);      // Tue 9 Jun: Monday the 8th -> month Q2; June -> year Q2
  assert.deepEqual(at('2026-06-01T14:00:00Z'), [1, 1, 2]);      // Mon 1 Jun: first Monday on the 1st -> month Q1
  assert.deepEqual(at('2026-06-29T14:00:00Z'), [1, 'X', 2]);    // Monday the 29th: apart
  assert.deepEqual(at('2026-07-02T14:00:00Z'), [4, 'P', 3]);    // Thu 2 Jul: its Monday was 29 Jun -> partial first week
  assert.deepEqual(at('2026-07-03T14:00:00Z'), ['F', 'P', 3]);  // Friday
  assert.deepEqual(at('2026-07-06T14:00:00Z'), [1, 1, 3]);      // Mon 6 Jul: first Monday -> Q1
  assert.deepEqual(at('2026-07-14T14:00:00Z'), [2, 2, 3]);      // Mon the 13th -> Q2
  assert.deepEqual(at('2026-07-21T14:00:00Z'), [2, 3, 3]);
  assert.deepEqual(at('2026-07-28T14:00:00Z'), [2, 4, 3]);
  assert.deepEqual(at('2026-03-31T21:30:00Z'), [2, 'X', 1]);    // Tue 31 Mar 17:30 EDT: still March, its Monday the 30th
  assert.deepEqual(at('2026-03-31T22:30:00Z'), [3, 'P', 2]);    // 18:30 EDT: Wed 1 Apr's trading day -> year Q2; its Monday (30 Mar) is in March
  assert.equal(yearQ(T('2025-12-31T23:30:00Z')), 1);            // New Year's Eve 18:30 New York belongs to 1 Jan
  assert.equal(FAVOURED, 2); assert.equal(favoured('week', T('2026-06-09T14:00:00Z')), true); assert.equal(favoured('year', T('2026-07-14T14:00:00Z')), false);
  assert.deepEqual(Object.keys(CYCLES), ['week', 'month', 'year']);
  assert.equal(quarterOf('month', { sweepT: T('2026-06-09T14:00:00Z'), close: T('2026-06-10T14:00:00Z') }), 2, 'the sweep candle decides, not the close');
});

test('every hour of 2020-2026 has exactly one quarter in each cycle, Q2 about a quarter of the weekdays', () => {
  let n = 0, q2 = { week: 0, month: 0, year: 0 };
  for (let t = T('2020-01-01T00:00:00Z'); t < T('2026-11-01T00:00:00Z'); t += 3600) {
    const d = tradingDay(t); if (d.dow === 0 || d.dow === 6) { assert.equal(weekQ(t), 'W'); continue; }
    n++; for (const c of Object.keys(CYCLES)) { const q = CYCLES[c](t); assert.ok([1, 2, 3, 4, 'F', 'P', 'X'].includes(q), `${c} ${q}`); if (q === 2) q2[c]++; }
  }
  assert.ok(Math.abs(q2.week / n - 0.2) < 0.01 && Math.abs(q2.year / n - 0.25) < 0.02 && Math.abs(q2.month / n - 0.23) < 0.02, JSON.stringify(q2) + ' of ' + n);
});

test('the study reads the ICT engine and never writes to it', () => {
  const q = read('quarters.mjs'), run = read('run.mjs');
  assert.ok(!/require\(|process\.|fetch\(|readFile|writeFile|Date\.now/.test(q), 'the classifier is pure');
  assert.deepEqual([...q.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]), ['../../../council/histdata.mjs']);
  const imports = [...run.matchAll(/(?:from\s+|require\()\s*'([^']+)'/g)].map((m) => m[1]).filter((p) => !p.startsWith('node:'));
  assert.deepEqual(imports.sort(), ['../../../api/_ictlab.js', './quarters.mjs']);
  assert.equal((run.match(/writeFileSync\(/g) || []).length, 2);
  assert.ok(/writeFileSync\(path\.join\(CACHE,/.test(run) && /writeFileSync\(path\.join\(OUT, 'result\.json'\)/.test(run));
  assert.ok(/E\.isASetup\(g, m\) && pred\(g\)/.test(run), 'the filter only narrows the A-rule');
  assert.ok(!/stop\s*=|\.stop\s*[+\-*]?=/.test(run + q), 'no stop is set or moved');
  assert.ok(!/Object\.assign\(P|E\.P\b/.test(run), 'no parameter of the tracker is overridden');
  for (const d of ['ict', 'council', 'api']) for (const f of fs.readdirSync(path.join(HERE, '..', d))) if (/\.(mjs|js)$/.test(f)) assert.ok(!fs.readFileSync(path.join(HERE, '..', d, f), 'utf8').includes('ict-quarters'), `${d}/${f}`);
});

test('Holm, Welch and the verdict rule', () => {
  assert.deepEqual(holm([0.5022, 0.3133, 0.7403]), [1, 0.9399, 1]);
  assert.equal(welch([1, 2, 3], [1, 2, 3]).t, 0);
  const ok = { oosN30: true, isPositive: true, oosPositive: true, isDiffPositive: true, oosDiffPositive: true, oosT2: true, holm: true };
  assert.equal(judge(ok), 'PASS'); assert.equal(judge({ ...ok, holm: false }), 'INCONCLUSIVE');
  assert.equal(judge({ ...ok, oosDiffPositive: false }), 'FAIL'); assert.equal(judge({ ...ok, oosPositive: false }), 'FAIL');
});

test('result.json is the run the report describes, on the pre-registered plan', () => {
  const R = JSON.parse(read('result.json')), md = read('RESULT.md'), pre = read('PREREGISTRATION.md');
  assert.equal(R.planSha256, crypto.createHash('sha256').update(pre).digest('hex'), 'the pre-registration was not edited after the run');
  assert.ok(md.includes(R.planSha256.slice(0, 8)) && md.includes(R.planSha256.slice(-4)));
  assert.equal(R.window.from, '2020-01-01'); assert.equal(R.window.to, '2026-10-31'); assert.equal(R.testsJudged, 3); assert.equal(R.candidates.length, 3);
  assert.deepEqual(R.candidates.map((c) => c.cycle), ['week', 'month', 'year']);
  assert.equal(classify(headlineOf(md)), 'fail'); assert.equal(studyVerdict(R, md).verdict, 'fail'); assert.match(R.verdict, /^FAIL\. None of the 3 pre-registered tests passes/); assert.equal(classify(R.verdict), 'fail');
  assert.deepEqual(R.candidates.map((c) => c.verdict), ['FAIL', 'INCONCLUSIVE', 'FAIL']);
  assert.ok(!fs.readdirSync(path.join(HERE, '..', 'research', 'proposals')).some((f) => /quarter/.test(f)), 'nothing passed, so no proposal');
  const num = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d), n = (x) => x.toLocaleString('en-US'), t2 = (x) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(2);
  for (const s of [R.baseline.all.is, R.baseline.all.oos]) { assert.ok(md.includes(`| ${n(s.n)} |`)); assert.ok(md.includes(num(s.exp))); }
  for (const c of R.candidates) {
    for (const s of [c.is, c.oos, c.rest.is, c.rest.oos]) { assert.ok(md.includes(`| ${n(s.n)} |`), `n ${s.n}`); assert.ok(md.includes(num(s.exp)), `R a trade ${s.exp}`); }
    assert.ok(md.includes(num(c.vsRest.oos.diff) + 'R') && md.includes(num(c.vsRest.is.diff) + 'R'));
    assert.ok(md.includes(`| ${t2(c.vsRest.oos.t)} |`) && md.includes(`| ${t2(c.vsRest.is.t)} |`), `t ${c.vsRest.oos.t} ${c.vsRest.is.t}`);
    assert.ok(md.includes(`| ${c.vsRest.holmP.toFixed(2)} |`));
    assert.equal(c.checks.oosT2, c.vsRest.oos.t >= 2); assert.equal(c.checks.isDiffPositive, c.vsRest.is.diff > 0); assert.equal(c.checks.oosDiffPositive, c.vsRest.oos.diff > 0);
    assert.equal(c.checks.holm, c.vsRest.holmP < 0.05); assert.equal(c.checks.oosN30, c.oos.n >= 30); assert.equal(c.verdict, judge(c.checks));
    // the quarters reported, not judged, are in the report too
    for (const q of Object.values(c.reportedNotJudged.quarters)) assert.ok(md.includes(`${num(q.oos.exp)} (${q.oos.n})`), `quarter OOS ${q.oos.exp} (${q.oos.n})`);
  }
  assert.deepEqual(holm(R.candidates.map((c) => c.vsRest.oos.p)), R.candidates.map((c) => c.vsRest.holmP));
  for (const s of Object.values(R.sources)) { assert.equal(s.unresolved, 0); assert.match(s.src, /^OANDA /); }
  const slim = slimStudy(R); assert.equal(slim.candidates.length, 3); assert.equal(slim.candidates[0].oos.n, R.candidates[0].oos.n);
});
