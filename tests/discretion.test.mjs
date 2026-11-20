// discretion: the pure pieces on made-up data, and the committed report and proposal against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../research/edge/discretion/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('discretion: times, acts, grades and the before / hindsight classes', () => {
  assert.equal(M.sec(1794000000), 1794000000);
  assert.equal(M.sec(1794000000000), 1794000000);
  assert.equal(M.sec('2026-11-06T00:00:00Z'), Date.parse('2026-11-06T00:00:00Z') / 1000);
  assert.equal(M.sec(''), null);
  assert.equal(M.actOf({ act: 'Taken' }), 'taken');
  assert.equal(M.actOf({ act: ' skipped ' }), 'skipped');
  assert.equal(M.actOf({ act: 'missed' }), 'missed');
  assert.equal(M.actOf({}), '');
  assert.equal(M.gradeOf({ score: 8, grade: 'F' }), 8);
  assert.equal(M.gradeOf({ grade: 'a+' }), 6);
  assert.equal(M.gradeOf({ grade: '?' }), null);
  const x = { opened: 1000, closed: 2000 };
  assert.equal(M.classOf({ at: 900 }, x), 'B0');
  assert.equal(M.classOf({ at: 1500 }, x), 'B');
  assert.equal(M.classOf({ at: 2000 }, x), 'H');   // at the close is hindsight
  assert.equal(M.classOf({}, x), 'H');             // no stamp is hindsight
  assert.equal(M.unitR({ Rraw: -1, R: -0.5 }), -1);
  assert.equal(M.unitR({ R: 2 }), 2);
});

test('discretion: Welch t, Holm and the power arithmetic', () => {
  const w = M.welch([1, 2, 3, 4], [0, 1, 2, 3]);
  assert.ok(Math.abs(w.diff - 1) < 1e-12);
  assert.ok(Math.abs(w.t - 1 / Math.sqrt(2 * (5 / 3) / 4)) < 1e-9);
  assert.deepEqual(M.holm([0.01, 0.04]).map((v) => +v.toFixed(4)), [0.02, 0.04]);
  assert.ok(Math.abs(M.pOneSided(1.96) - 0.025) < 1e-3);
  const p = M.power(1, 0.5);
  assert.equal(p.t2, 32);                               // 2 * (2 * 1 / 0.5)^2
  assert.equal(p.p80, Math.ceil(2 * (2.8016 / 0.5) ** 2));
  assert.equal(M.power(0, 0.5), null);
  const r = M.ratePer30([0, 86400 * 10, 86400 * 30]);
  assert.equal(r.n, 3); assert.equal(r.per30, 3);
});

test('discretion: only decisions stamped before the exit are judged; hindsight is kept apart; under 20 a side is too few', () => {
  const execs = [], reviews = {};
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 60; i++) {
    const taken = i % 2 === 0;
    execs.push({ id: 's' + i, src: 'live', status: 'win', opened: 1000 + i, closed: 5000 + i, Rraw: (taken ? 1.5 : -0.5) + (rnd() - 0.5), aset: true });
    reviews['s' + i] = { act: taken ? 'Taken' : 'Skipped', at: 2000 + i, by: i % 3 ? 'p1' : 'p2', score: taken ? 8 : 4 };
  }
  // hindsight marks on big winners must not enter the test
  for (let i = 0; i < 10; i++) { execs.push({ id: 'h' + i, src: 'replay', status: 'win', opened: 10, closed: 20, R: 9 }); reviews['h' + i] = { act: 'Taken', at: 9999 }; }
  execs.push({ id: 'o1', src: 'live', status: 'open', opened: 1, R: 0 }); reviews.o1 = { act: 'Taken', at: 2 };
  reviews.gone = { act: 'Skipped', at: 1 };
  const r = M.ictStudy(execs, reviews);
  assert.equal(r.counts.reviews, 72); assert.equal(r.counts.unmatched, 1); assert.equal(r.counts.open, 1);
  assert.equal(r.counts.reviewers, 2);
  assert.equal(r.before, 60); assert.equal(r.hindsight.n, 10);
  assert.equal(r.tests.D1.a.n, 30); assert.equal(r.tests.D1.b.n, 30);
  assert.ok(r.tests.D1.a.mean < 2, 'the hindsight 9R winners are not in the taken side');
  assert.equal(r.tests.D1.verdict, 'PASS'); assert.equal(r.verdict, 'PASS');
  assert.equal(r.tests.D2.verdict, 'PASS');
  // the same data cut to 19 a side: no t is given
  const few = M.ictStudy(execs.slice(0, 38), Object.fromEntries(Object.entries(reviews).slice(0, 38)));
  assert.equal(few.tests.D1.judged, false); assert.equal(few.tests.D1.t, null); assert.equal(few.verdict, 'TOO FEW TO JUDGE');
  // no file at all
  const none = M.ictStudy(execs, null);
  assert.equal(none.counts.reviews, 0); assert.equal(none.verdict, 'TOO FEW TO JUDGE');
  // taken no better than skipped: judged, FAIL
  const flat = M.ictStudy(execs.slice(0, 60).map((x, i) => ({ ...x, Rraw: (i % 4 < 2 ? 1 : -1) })), Object.fromEntries(Object.entries(reviews).slice(0, 60)));
  assert.equal(flat.tests.D1.judged, true); assert.equal(flat.tests.D1.verdict, 'FAIL');
});

test('discretion: loss reviews are counted by their stamp against the close', () => {
  const c = M.lossReviewCount({ a: { at: 50, closed: 100, R: -1, by: 'x' }, b: { at: '2026-11-07T00:00:00Z', closed: 1794000000, R: -1, by: 'x', shadow: true }, c: { closed: 5, R: -1 } });
  assert.deepEqual({ n: c.n, authors: c.authors, before: c.before, after: c.after, noStamp: c.noStamp, shadow: c.shadow }, { n: 3, authors: 1, before: 1, after: 1, noStamp: 1, shadow: 1 });
});

test('discretion: the committed result, report and proposal agree, and hold no person or trade', () => {
  const r = JSON.parse(rd('../research/edge/discretion/result.json'));
  const md = rd('../research/edge/discretion/RESULT.md'), prop = rd('../research/proposals/2026-11-20-discretion.md');
  const pre = rd('../research/edge/discretion/PREREGISTRATION.md');
  assert.equal(md, M.report(r), 'RESULT.md is the report of result.json');
  assert.equal(r.verdict, 'TOO FEW TO JUDGE');
  assert.equal(r.decisionsBeforeOutcome, 0);
  assert.equal(r.inventory['ict/desk.json'].present, false);
  const L = r.inventory['reviews/losses.json'];
  assert.equal(L.before, 0); assert.equal(L.after, L.n);
  assert.ok(pre.includes(r.councilData));
  // the power rows follow the pre-registered formulas from the stored sd
  for (const t of [r.ict.power.aSetups, r.ict.power.everySignal, r.council.power.liveBook]) for (const row of t.rows) {
    const p = M.power(t.sd, row.d);
    assert.equal(row.t2, p.t2); assert.equal(row.p80, p.p80);
  }
  // the proposal quotes the study's figures
  const A = r.ict.power.aSetups;
  assert.ok(prop.includes(`about ${A.rows[2].t2} taken`)); assert.ok(prop.includes(`about ${A.rows[3].t2} a side`));
  assert.ok(prop.includes('0 take / skip decisions recorded before the outcome'));
  assert.match(prop, /Nothing is built/);
  // aggregates only: no trade id, no reviewer name, no note text; never called an edge
  const all = JSON.stringify(r) + md;
  assert.doesNotMatch(all, /\b[a-z]{2,6}-(scalp|rscalp|replica|geg|gtrend|[sb])-\d{6,}/);
  assert.doesNotMatch(all, /"by"\s*:|"text"\s*:|"lesson"\s*:/);
  assert.doesNotMatch(md + prop, /\b(is|a proven|a tested) an? edge\b|proven edge/i);
  // ICT is its own section and the council systems theirs
  assert.match(md, /## 2\. ICT \(a separate edge, its own section\)/);
  assert.match(md, /## 3\. Council systems \(own section, never pooled with ICT\)/);
});

test('discretion: the study reads files only and imports no trading code', () => {
  const src = rd('../research/edge/discretion/run.mjs');
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['node:fs', 'node:path', 'node:url']);
  assert.doesNotMatch(src, /fetch\(|child_process|writeFileSync\((?!path\.join\(here)/);
});
