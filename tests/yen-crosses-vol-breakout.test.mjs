// yen-crosses-vol-breakout: gold's T1 breakout on the five yen crosses (research/edge/yen-crosses-vol-breakout). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARKETS, W, judge } from '../research/edge/yen-crosses-vol-breakout/run.mjs';

const DIR = new URL('../research/edge/yen-crosses-vol-breakout/', import.meta.url);

test('yen crosses: the pre-registered markets and windows', () => {
  assert.deepEqual(MARKETS, ['eurjpy', 'gbpjpy', 'audjpy', 'cadjpy', 'chfjpy']);
  assert.deepEqual(W.A, ['2005-01-01', '2015-12-31']); assert.equal(W.B[0], '2016-01-01');
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(pre, /Primary: the pool/); assert.match(pre, /at least 38 of 40/);
});

test('yen crosses: the pass needs all four checks', () => {
  const day = (y, i) => `${y}-${String(1 + (i % 12)).padStart(2, '0')}-0${1 + (i % 7)}`;
  const tr = (v) => [...Array.from({ length: 240 }, (_, i) => ({ day: day(2008, i), net: v + (i % 3) * 0.01, net2: v / 2, R: v, r: 1, side: 1, how: 'time', nights: 0, finR: 0 })),
    ...Array.from({ length: 240 }, (_, i) => ({ day: day(2020, i), net: v + (i % 3) * 0.01, net2: v / 2, R: v, r: 1, side: 1, how: 'time', nights: 0, finR: 0 }))];
  assert.equal(judge(tr(0.5), Array(40).fill(0)).pass, true);
  assert.equal(judge(tr(0.5), Array(40).fill(1)).pass, false, 'placebo');
  assert.equal(judge(tr(-0.5), Array(40).fill(-1)).pass, false);
});

test('yen crosses: the report matches result.json and reads the pool', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
  assert.deepEqual(Object.keys(R.series), ['pool', ...MARKETS]);
  assert.equal(R.verdict.startsWith('PASS'), R.series.pool.pass);
  for (const r of Object.values(R.series)) assert.equal(r.pass, Object.values(r.checks).every(Boolean));
});
