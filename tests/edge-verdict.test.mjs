// node --test tests/edge-verdict.test.mjs — one headline + class per edge study for /edge-lab.html (research/edge/verdict.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { headlineOf, headlineParts, classify, classifyAll, verdictField, verdictOfData, studyVerdict, builtOf } from '../research/edge/verdict.mjs';

const EDGE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../research/edge');

test('headline: the text after "Verdict:", in any of the shapes the studies use', () => {
  assert.equal(headlineOf('- **Verdict: FAIL. No variant passes, so there is no `proposal.md`.** No variant has positive OOS expectancy, and more.'),
    'FAIL. No variant passes, so there is no proposal.md.');
  assert.equal(headlineOf('## Verdict: FAIL, all six cells. The live exit is the best of the seven on 2023-26 and no variant beats it on 2004-22.\n\nmore'),
    'FAIL, all six cells. The live exit is the best of the seven on 2023-26 and no variant beats it on 2004-22.');
  assert.equal(headlineOf('intro\n\n## Verdict\n\nNothing passes the bar. Second sentence here. Third.'), 'Nothing passes the bar. Second sentence here.');
  assert.equal(headlineOf('**Verdict.**\nKeep fixed 1R.'), 'Keep fixed 1R.');
  // a Verdict section that is a table: one "name: verdict" piece per row, from the Verdict column
  const tbl = '## Verdict\n\n| system | verdict | why |\n|---|---|---|\n| **Scalp** | **FAIL.** No regime gate. More words. | x |\n| Swing | **INCONCLUSIVE.** Weak lead. | y |\n\nOwner note.';
  assert.deepEqual(headlineParts(tbl), ['Scalp: FAIL.', 'Swing: INCONCLUSIVE.']); assert.equal(headlineOf(tbl), 'Scalp: FAIL.; Swing: INCONCLUSIVE.');
  assert.equal(classifyAll(headlineParts(tbl)), 'inc'); assert.equal(classifyAll(['a: FAIL', 'b: fails']), 'fail');
  // a heading whose text is only a bracket note is bare: the paragraph below it is the verdict
  assert.equal(headlineOf('## Verdicts (window 2006-17)\n\n| s | n | Verdict |\n|---|---|---|\n| Gold trend | 75 | **regime-bound** |\n'), 'Gold trend: regime-bound');
  // a table cell that mentions a verdict is not a verdict line
  assert.equal(headlineOf('| Healthy | Neither. A record with fewer than 10 trades gets no verdict |\n'), '');
  assert.equal(headlineOf(''), '');
  const long = headlineOf('**Verdict: ' + 'word '.repeat(80) + '**');
  assert.ok(long.length <= 220 && long.endsWith('…'), long);
});

test('class: pass / fail / inc from the words a study wrote', () => {
  for (const s of ['FAIL', 'FAILS (pre-registered bar).', 'decayed', 'nothing passes. No candidate shadow stream.', 'no. Both pre-registered rules FAIL', 'keep fixed 1R. No overlay passes the pre-registered bar.',
    'null result. No regime filter passes.', 'NQ-ONLY. The rule does not carry over to any other market', 'no rule change passes.']) assert.equal(classify(s), 'fail', s);
  for (const s of ['PASS, but weak.', 'PASS. The edge is real, but it is a dip-buying edge', 'The filter passes every test']) assert.equal(classify(s), 'pass', s);
  for (const s of ['regime-dependent, not robust, not dead', 'mixed']) assert.equal(classify(s), 'inc', s);
  assert.equal(classify(''), '');
});

test('result.json: a string verdict, an object with a class key, candidates, or nothing', () => {
  assert.equal(verdictField({ verdict: 'FAILS', P1: false }), 'FAILS');
  assert.equal(verdictField({ primary: 'FAIL', histdataConfirms: false }), 'FAIL');
  assert.equal(verdictField({ label: 'NQ-ONLY', passL: [] }), 'NQ-ONLY');
  assert.equal(verdictField({ answer: 'yes', nominalPasses: ['x'] }), '', 'an answer to the question is not a class');
  assert.equal(verdictOfData({ verdict: 'FAIL - no exit beats the live exit' }), 'fail');
  assert.equal(verdictOfData({ candidates: [{ verdict: 'fail' }, { verdict: 'PASS' }] }), 'pass');
  assert.equal(verdictOfData({ candidates: [{ verdict: 'fail' }, { verdict: 'FAIL' }] }), 'fail');
  assert.equal(verdictOfData({ topic: 'x' }), '');
  assert.equal(builtOf({ generated: '2026-11-07T22:25:29.847Z' }), '2026-11-07'); assert.equal(builtOf({}), null);
  const sv = studyVerdict({ verdict: { answer: 'yes' } }, '## Verdict\n\nTwo of 21 cells meet the letter of the bar; neither is dependable. No live rule changes.');
  assert.equal(sv.verdict, 'inc'); assert.match(sv.headline, /^Two of 21/);
  // the author's RESULT.md verdict outranks one noisy formal pass in the candidates table
  assert.equal(studyVerdict({ candidates: [{ verdict: 'pass' }, { verdict: 'fail' }] }, '**Verdict: no engine setup has a robust edge. Promote none.**').verdict, 'fail');
  assert.equal(studyVerdict({ verdict: 'struct passes the gate on the replay. It is NOT confirmed on 2018-26 history; fails there.' }, '').headline.slice(0, 6), 'struct');
});

test('every committed study gets a class, and the pre-registered null results read as fail', () => {
  const rows = {};
  for (const d of fs.readdirSync(EDGE, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const res = path.join(EDGE, d.name, 'result.json'), md = path.join(EDGE, d.name, 'RESULT.md');
    if (!fs.existsSync(res) && !fs.existsSync(md)) continue;
    let data = null; try { data = JSON.parse(fs.readFileSync(res, 'utf8')); } catch (e) { /* no or invalid result.json */ }
    rows[d.name] = studyVerdict(data, fs.existsSync(md) ? fs.readFileSync(md, 'utf8') : '');
  }
  for (const t of ['seasonality', 'macro-gold', 'ict-sessions', 'nq-open-exits', 'ict-breadth', 'open-run-breadth', 'ict-oos-2008', 'event-risk', 'sizing', 'scalp-filters'])
    if (rows[t]) assert.equal(rows[t].verdict, 'fail', `${t}: ${rows[t].headline}`);
  for (const t of ['ict-filters', 'ict-index-longonly']) if (rows[t]) assert.equal(rows[t].verdict, 'pass', t);
  const withReport = Object.entries(rows).filter(([t]) => fs.existsSync(path.join(EDGE, t, 'RESULT.md')));
  const noHeadline = withReport.filter(([, r]) => !r.headline).map(([t]) => t);
  assert.ok(noHeadline.length <= 3, `studies whose RESULT.md has no readable verdict line: ${noHeadline.join(', ')}`);
});
