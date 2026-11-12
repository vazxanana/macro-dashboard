import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 12 Nov 2026: Vercel's build minutes were most of the bill. out/ is committed and CI's build job fails when it
// differs from `sh scripts/build.sh`, so Vercel serves the committed copy instead of building again.
test('Vercel serves the committed out/ and does not rebuild it', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(v.outputDirectory, 'out');
  assert.doesNotMatch(v.buildCommand, /build\.sh|node /);
  assert.ok(v.buildCommand.length < 256);
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /scripts\/build\.sh/, 'CI still rebuilds out/ and compares it');
});
