// node --test tests/veteran-library.test.mjs — the Macro veteran's published library (scripts/veteran-index.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, cpiPilot } from '../scripts/veteran-index.mjs';

test('the index lists the revision 1.2 batch with groups, titles and the CPI pilot; no archives', () => {
  const I = buildIndex('research/macro-veteran');
  assert.equal(I.version, '1.2'); assert.ok(I.docs.length >= 80);
  assert.ok(!I.docs.some((d) => /\.zip$|\.sha256$/.test(d.path)), 'no provenance zips');
  assert.equal(I.groups[0], 'Start here'); assert.ok(I.docs.find((d) => d.path === 'SKILL.md').group === 'Start here');
  assert.ok(I.docs.find((d) => d.path === 'references/gold-driver-map.md').group === 'Gold and macro frameworks');
  assert.ok(I.docs.find((d) => d.path === 'notes/cpi-gold-study-design-review.md').group === 'Working notes');
  assert.match(I.docs.find((d) => d.path === 'references/latest-research-batch-status-2026-11-08.md').title, /Latest research batch/);
  assert.equal(I.cpiPilot.length, 1); assert.equal(I.cpiPilot[0].point, 0.255); assert.equal(I.cpiPilot[0].status, 'unresolved');
  assert.equal(I.validation.tests.passed, 50);
  assert.deepEqual(cpiPilot('/nonexistent'), []);
});
test('the batch\'s own evaluator tests still pass from the repository copy', () => {
  assert.ok(fs.existsSync('research/macro-veteran/references/scripts/forecast-evaluator.test.mjs'));
});
