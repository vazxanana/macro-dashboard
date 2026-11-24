// tests/dom-vb-side.test.mjs - offline: the committed result and the set rule of research/edge/dom-vb-side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify, welch } from '../research/edge/dom-vb-side/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/dom-vb-side/result.json', import.meta.url), 'utf8'));

test('a DOM limit is WITH / AGAINST only when armed after the breakout fill candle closed and before 21:00 UTC', () => {
  const d0 = Date.UTC(2020, 5, 3) / 1000, lab = new Map([[d0, { D: 1, fillT: d0 + 3600 }]]);
  assert.equal(classify({ ts: d0 + 3600, side: 1 }, lab), 2);        // inside the fill candle: not known yet
  assert.equal(classify({ ts: d0 + 3900, side: 1 }, lab), 0);
  assert.equal(classify({ ts: d0 + 3900, side: -1 }, lab), 1);
  assert.equal(classify({ ts: d0 + 21 * 3600, side: 1 }, lab), 2);
  assert.equal(classify({ ts: d0 + 86400 + 3900, side: 1 }, lab), 2); // no breakout that day
});

test('result.json: verdict and the bar', () => {
  const T = R.tests, pass = T.T1.pass && (T.T2.pass || T.T3.pass) && R.control.pass;
  assert.equal(R.verdict, pass ? 'PASS' : 'FAIL');
  assert.equal(R.control.draws, 200);
  for (const k of ['all', 'with', 'against']) for (const w of ['disc', 'conf']) {
    const x = R.sets[k][w]; assert.ok(Math.abs(x.R - x.costR - x.net) < 2e-4, `${k} ${w} net = R - cost`);
  }
  assert.ok(R.sets.with.conf.n + R.sets.against.conf.n < R.sets.all.conf.n);
  assert.match(R.verdictLine, new RegExp(`^Verdict: ${R.verdict}\\.`));
});

test('the DOM trades equal dom-zone-holdout trade for trade, and the cut test finds no look-ahead', () => {
  assert.equal(R.holdoutCheck.length, 7);
  for (const c of R.holdoutCheck) assert.equal(c.diff, 0, c.market);
  assert.ok(R.cut.length >= 5);
  for (const c of R.cut) { assert.equal(c.labDiff, 0, c.market + c.cut); assert.equal(c.missing, 0, c.market + c.cut); }
});

test('welch', () => { const w = welch([1, 2, 3, 4], [0, 1, 2, 3]); assert.equal(w.diff, 1); assert.ok(w.t > 0); });
