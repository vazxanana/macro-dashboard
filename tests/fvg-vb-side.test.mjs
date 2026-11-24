// fvg-vb-side: the result file's figures, the set rule and the matched placebo (offline, no candles).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify, placebo, judge, SPLIT } from '../research/edge/fvg-vb-side/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fvg-vb-side/result.json', import.meta.url), 'utf8'));

test('result: FAIL, 0 of 3, figures as reported', () => {
  assert.equal(R.verdict, 'FAIL');
  for (const k of ['T1', 'T2', 'T3']) assert.equal(R.tests[k].pass, false);
  assert.equal(R.sets.with.conf.n, 11010);
  assert.equal(R.sets.with.conf.net, -0.1055);
  assert.ok(R.sets.with.conf.t < -9);
  assert.equal(R.sets.all.conf.n, 37608);
  assert.ok(R.placebo.beaten.conf < 38);
  const md = fs.readFileSync(new URL('../research/edge/fvg-vb-side/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.split('\n')[2].startsWith('**Verdict: FAIL'));
});

test('result: the cut test found no look-ahead', () => {
  assert.ok(R.cut.length >= 10);
  for (const c of R.cut) { assert.equal(c.missing, 0); assert.equal(c.extra, 0); assert.equal(c.labDiff, 0); }
});

test('classify: only after the breakout fill candle closed, before 21:00 UTC', () => {
  const d0 = 1700006400 - (1700006400 % 86400), lab = new Map([[d0, { kind: 'vb', D: 1, fillT: d0 + 3 * 3600 }], [d0 + 86400, { kind: 'nofill' }]]);
  assert.equal(classify({ et: d0 + 3 * 3600 + 299, s: 1 }, lab), 3);
  assert.equal(classify({ et: d0 + 3 * 3600 + 300, s: 1 }, lab), 0);
  assert.equal(classify({ et: d0 + 5 * 3600, s: -1 }, lab), 1);
  assert.equal(classify({ et: d0 + 21 * 3600, s: 1 }, lab), 3);
  assert.equal(classify({ et: d0 + 86400 + 3600, s: -1 }, lab), 2);
  assert.equal(classify({ et: d0 + 2 * 86400, s: 1 }, lab), 3);
});

test('placebo draws from another day of the same market and side', () => {
  const t = SPLIT + 86400 * 10;
  const rows = [{ t, set: 0, net: 1, side: 1, day: 1, market: 'xau' }, { t, set: 1, net: -1, side: 1, day: 2, market: 'xau' },
    { t, set: 2, net: 5, side: -1, day: 3, market: 'xau' }];
  assert.equal(placebo(rows, 1, 7), -1);
  const J = judge([[t, 0, 0.5, 0.1, 1, 1, 'xau'], [t, 1, 0.2, 0.1, 1, 2, 'xau']]);
  assert.equal(J.sets.with.conf.n, 1);
});
