// research/edge/mosha-6r-quality: which 6R barrier entries to skip (offline: the files and pure helpers).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEATS, costBand, sessionOf, kindOf, welch, YEARS, MIN_KEEP, SHUFFLES } from '../research/edge/mosha-6r-quality/run.mjs';

const DIR = new URL('../research/edge/mosha-6r-quality/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, DIR), 'utf8');

test('mosha-6r-quality: the pre-registration names the features, the three tests and the placebo', () => {
  const p = read('PREREGISTRATION.md');
  for (const w of ['T1', 'T2', 'T3', 'Q80', 'Q20', 'Holm', 'USEFUL-TO-AVOID', 'shuffles', 'discovery', 'month-sum t']) assert.ok(p.includes(w), w);
  assert.equal(FEATS.length, 10);
  assert.equal(SHUFFLES, 40);
  assert.equal(MIN_KEEP, 300);
  assert.equal(YEARS.length, 9);
});

test('mosha-6r-quality: bands, sessions and kinds', () => {
  assert.equal(costBand(0.04), '<=0.05');
  assert.equal(costBand(0.07), '0.05-0.10');
  assert.equal(costBand(0.15), '0.10-0.20');
  assert.equal(costBand(0.5), '>0.20');
  assert.equal(sessionOf(Date.UTC(2024, 0, 3, 3) / 1000), 'asia');
  assert.equal(sessionOf(Date.UTC(2024, 0, 3, 9) / 1000), 'london');
  assert.equal(sessionOf(Date.UTC(2024, 0, 3, 15) / 1000), 'ny');
  assert.equal(kindOf('bar-sw-123'), 'sweep');
  assert.equal(kindOf('bar-eg-123'), 'eg');
  assert.equal(kindOf('bar-123'), 'bo');
  assert.ok(welch([1, 2, 3, 4], [-1, -2, -3, -4]).t > 2 || welch([1, 2, 3, 4], [-1, -2, -3, -4]) > 2);
});

test('mosha-6r-quality: the written result matches result.json', () => {
  const j = JSON.parse(read('result.json'));
  const r = read('RESULT.md');
  assert.match(r.split('\n')[2], /^\*\*Verdict: FAIL\./);
  assert.equal(j.verdict, 'FAIL');
  assert.ok(j.n && j.groups && j.tests);
  assert.ok(r.includes('## What it means'));
  assert.ok(r.includes('18763') && r.includes('12745'));
});
