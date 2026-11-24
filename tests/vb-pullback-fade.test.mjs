// vb-pullback-fade: the result file, the day classification rule and the cut test's record (offline, no candles read)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify, judge, SETS } from '../research/edge/vb-pullback-fade/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-pullback-fade/result.json', import.meta.url), 'utf8'));

test('vb-pullback-fade: result.json verdict and figures', () => {
  assert.equal(R.verdict, 'FAIL');
  for (const k of ['T1', 'T2', 'T3']) assert.equal(R.tests[k].pass, false);
  assert.equal(R.sets.with.conf.n, 5178); assert.equal(R.sets.with.conf.net, -0.0877); assert.equal(R.sets.with.conf.t, -3.99);
  assert.equal(R.sets.against.conf.n, 6895); assert.equal(R.sets.control.conf.n, 8690);
  assert.ok(R.sets.with.disc.net < 0 && R.sets.against.disc.net < 0);
  assert.ok(R.T3.conf.diff < 0);
  const md = fs.readFileSync(new URL('../research/edge/vb-pullback-fade/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.split('\n')[2].startsWith('**Verdict: FAIL'));
});

test('vb-pullback-fade: a fade counts only after the breakout fill, on its own UTC day, before 21:00', () => {
  const d0 = Date.UTC(2020, 5, 3) / 1000, fillT = d0 + 8 * 3600;
  const lab = new Map([[d0, { kind: 'vb', D: 1, fillT }], [d0 + 86400, { kind: 'nofill' }]]);
  assert.equal(classify({ ts: fillT, d: -1 }, lab), null);            // inside the fill candle: not known yet
  assert.equal(classify({ ts: fillT + 300, d: -1 }, lab), 'with');    // break down faded = buy = with a buy breakout
  assert.equal(classify({ ts: fillT + 300, d: 1 }, lab), 'against');
  assert.equal(classify({ ts: d0 + 21 * 3600, d: -1 }, lab), null);   // after 21:00 UTC
  assert.equal(classify({ ts: d0 + 86400 + 3600, d: 1 }, lab), 'control');
  assert.equal(classify({ ts: d0 + 2 * 86400, d: 1 }, lab), null);    // unlabelled day
});

test('vb-pullback-fade: no look-ahead cut test recorded clean; judge is deterministic', () => {
  assert.equal(R.cut.length, 10);
  for (const c of R.cut) { assert.equal(c.missing, 0); assert.equal(c.extra, 0); assert.equal(c.labDiff, 0); }
  const t = Date.UTC(2018, 0, 5) / 1000, rows = [];
  for (let i = 0; i < 30; i++) for (const s of [0, 1, 2]) rows.push([t + i * 86400 * 7, s, (i % 3) - 0.5, 0.1, 0, 'xau'], [t - 3e8 + i * 86400 * 7, s, (i % 3) - 0.5, 0.1, 0, 'xau']);
  const J = judge(rows); assert.equal(J.sets.with.conf.n, 30); assert.equal(SETS.length, 3); assert.equal(J.verdict, 'FAIL');
});
