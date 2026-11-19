// node --test tests/veteran-library.test.mjs — the Macro veteran's published library (scripts/veteran-index.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, cpiPilot } from '../scripts/veteran-index.mjs';

test('the index lists the revision 1.8 package with groups, titles, what is new and the CPI pilot; no archives', () => {
  const I = buildIndex('research/macro-veteran');
  // 19 Nov 2026: the 1.5 base (SKILL.md 1.5, validation.json of 17 Nov) plus the 1.6-1.8 news increments; the revision is README.md's
  assert.equal(I.version, '1.8'); assert.ok(I.docs.length >= 200); assert.equal(I.prepared, '2026-11-17');
  assert.ok(I.whatsNew.length >= 5); assert.equal(I.newIn, '1.8'); assert.ok(I.whatsNew.some((l) => /5 of 36/.test(l)));
  assert.ok(I.whatsNew.some((l) => /deliberately left empty/.test(l) && /No surprise/.test(l)), 'no surprise without a frozen consensus');
  for (const p of ['references/news-trading-strategy-register-v2-2026-11-19.md', 'references/employment-situation-multifield-with-hours-2022-2024.csv',
    'references/ism-jobs-same-day-verified-2022-2024.json', 'references/v1-8-combined-news-batch-readme.md'])
    assert.equal(I.docs.find((d) => d.path === p).group, 'News and release research', p);
  assert.ok(!I.docs.some((d) => /^notes\/.*\.json$/.test(d.path) && /overlap-route|overlap-calendar/.test(d.path)), 'work JSONs with local paths left out');
  assert.equal(I.docs.find((d) => d.path === 'START_HERE.md').group, 'Start here');
  assert.equal(I.docs.find((d) => d.path === 'references/treasury-cpi-calendar-study-2022-2024.md').group, 'Release integrity and rates study');
  assert.equal(I.docs.find((d) => d.path === 'references/bls-release-integrity-case-2026-11-09.md').group, 'Release integrity and rates study');
  assert.equal(I.docs.find((d) => d.path === 'references/scripts/treasury-cpi-study.py').kind, 'script');
  assert.ok(I.docs.some((d) => d.path === 'references/latest-research-batch-status-2026-11-09.md'));
  assert.ok(!I.docs.some((d) => /^work\/|raw\//.test(d.path)), 'no raw captures or one-time work scripts');
  assert.equal(I.validation.tests.passed, 12);
  assert.ok(!I.docs.some((d) => /\.zip$|\.sha256$/.test(d.path)), 'no provenance zips');
  assert.equal(I.groups[0], 'Start here'); assert.ok(I.docs.find((d) => d.path === 'SKILL.md').group === 'Start here');
  assert.ok(I.docs.find((d) => d.path === 'references/gold-driver-map.md').group === 'Gold and macro frameworks');
  assert.ok(I.docs.find((d) => d.path === 'notes/cpi-gold-study-design-review.md').group === 'Working notes');
  assert.match(I.docs.find((d) => d.path === 'references/latest-research-batch-status-2026-11-08.md').title, /Latest research batch/);
  assert.equal(I.cpiPilot.length, 1); assert.equal(I.cpiPilot[0].point, 0.255); assert.equal(I.cpiPilot[0].status, 'unresolved');
  // 17 Nov 2026: a "resolved" record with outcome null is a pending attempt, never a result
  assert.equal(I.cpiPilot[0].outcome, null); assert.equal(I.cpiPilot[0].pending, 1);
  assert.ok(!I.docs.some((d) => d.path === 'references/cpi-model-benchmark-protocol-2022-2024.json'), 'left out: names a product, hash-bound');
  assert.deepEqual(cpiPilot('/nonexistent'), []);
});
test('the batch\'s own evaluator tests still pass from the repository copy', () => {
  assert.ok(fs.existsSync('research/macro-veteran/references/scripts/forecast-evaluator.test.mjs'));
});
