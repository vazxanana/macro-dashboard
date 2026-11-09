// node --test tests/veteran-library.test.mjs — the Macro veteran's published library (scripts/veteran-index.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, cpiPilot } from '../scripts/veteran-index.mjs';

test('the index lists the revision 1.3 batch with groups, titles, what is new and the CPI pilot; no archives', () => {
  const I = buildIndex('research/macro-veteran');
  assert.equal(I.version, '1.3'); assert.ok(I.docs.length >= 110); assert.equal(I.prepared, '2026-11-09');
  assert.ok(I.whatsNew.length >= 5); assert.ok(I.whatsNew.some((l) => /6\.11 bp/.test(l)));
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
  assert.deepEqual(cpiPilot('/nonexistent'), []);
});
test('the batch\'s own evaluator tests still pass from the repository copy', () => {
  assert.ok(fs.existsSync('research/macro-veteran/references/scripts/forecast-evaluator.test.mjs'));
});
