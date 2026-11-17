import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 12 Nov 2026: Vercel's build minutes were most of the bill. out/ is committed and CI's build job fails when it
// differs from `sh scripts/build.sh`, so Vercel serves the committed copy instead of building again.
test('Vercel serves the committed out/ and does not rebuild it', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(v.outputDirectory, 'out');
  // 17 Nov 2026: the Vercel project is gone (the site runs on the Cloudflare Worker); vercel.json keeps only what the
  // Worker reads (rewrites, headers) and the function limits the tests check. No build, ignore step or cron is left in it.
  for (const k of ['buildCommand', 'ignoreCommand', 'crons']) assert.equal(v[k], undefined, k);
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /scripts\/build\.sh/, 'CI still rebuilds out/ and compares it');
});
