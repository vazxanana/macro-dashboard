// .github/workflows/vb-forward.yml: one forward record's failure must not cost the others their save (23 Nov 2026).
// Before, every step ran only while all before it had passed, so a candle failure in the last record (gotobi-forward, added on
// the branch of 23 Nov) skipped Save and the gold, holiday, turnaround and USD/JPY records computed above it were lost for the
// day. Each record step and Save now run unless the job was cancelled; a failed record still turns the job red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const wf = fs.readFileSync(new URL('../.github/workflows/vb-forward.yml', import.meta.url), 'utf8');
const steps = wf.split(/\n      - /).slice(1).map((b) => ({ name: (/^name: (.*)/.exec(b) || [])[1] || b.slice(0, 40), body: b }));

test('every forward record step after the first, and Save, run unless the job was cancelled; none hides a failure', () => {
  const rec = steps.filter((s) => /-forward\/run\.mjs/.test(s.body)), save = steps.find((s) => s.name === 'Save');
  assert.ok(rec.length >= 5, 'the forward records are all in the workflow'); assert.ok(save, 'a Save step');
  for (const s of [...rec.slice(1), save]) assert.match(s.body, /\n\s+if: \$\{\{ !cancelled\(\) \}\}/, `${s.name}: runs after an earlier record failed`);
  assert.doesNotMatch(wf, /continue-on-error/, 'a failure still shows: the job ends red');
  assert.ok(steps.findIndex((s) => s === save) > steps.findIndex((s) => s === rec.at(-1)), 'Save comes after every record');
});
