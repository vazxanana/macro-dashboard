import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { profile } from '../research/proposals/2026-11-20-usdjpy-risk.mjs';

const J = JSON.parse(fs.readFileSync(new URL('../research/proposals/2026-11-20-usdjpy-risk.json', import.meta.url)));
test('the committed json is the script output', () => {
  const now = execFileSync(process.execPath, [new URL('../research/proposals/2026-11-20-usdjpy-risk.mjs', import.meta.url).pathname], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(now), J);
});
test('profile on hand-made rows', () => {
  const p = profile([['2020-01-01', 1], ['2020-01-02', -1], ['2020-01-03', -1], ['2020-02-01', 3]]);
  assert.equal(p.totalR, 2); assert.equal(p.maxDD, -2); assert.equal(p.worstLosingStreak, 2); assert.equal(p.ddTo, '2020-01-03');
});
test('the note quotes the json', () => {
  const md = fs.readFileSync(new URL('../research/proposals/2026-11-20-usdjpy-risk.md', import.meta.url), 'utf8'), p = J.profile;
  assert.ok(md.includes('+131.7R') && md.includes('−33.8R') && md.includes(`${p.longestUnderwaterDays} days`) && md.includes(`${p.worstLosingStreak} trades`) && md.includes(p.monthsPositive));
});
