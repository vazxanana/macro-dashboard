// nas-vol-breakout-early: the frozen pieces (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as E from '../research/edge/nas-vol-breakout-early/run.mjs';

test('the rule copy is pinned and the cost is the measured NAS100 profile of index-vol-breakout-hourcost', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/index-vol-breakout/original.mjs', import.meta.url))).digest('hex');
  assert.equal(sha, E.ORIG_SHA);
  const c = E.frozenCost();
  assert.equal(c.hp.length >= 21, true);
  assert.ok(c.hp.every((h) => h.frac > 0 && h.frac < 0.001));
});

test('the window and halves are the pre-registered ones', () => {
  assert.deepEqual(E.W.ALL, ['2010-01-01', '2015-12-31']);
  assert.deepEqual(E.W.H1, ['2010-01-01', '2012-12-31']);
  assert.deepEqual(E.W.H2, ['2013-01-01', '2015-12-31']);
  const p = fs.readFileSync(new URL('../research/edge/nas-vol-breakout-early/PREREGISTRATION.md', import.meta.url), 'utf8');
  assert.match(p, /2010-01-01 → 2015-12-31/); assert.match(p, /38 of the 40 placebo seeds/);
});

test('decide: every check must hold', () => {
  const tr = [];
  for (let y = 2010; y <= 2015; y++) for (let m = 1; m <= 12; m++) for (let k = 0; k < 4; k++) tr.push({ day: `${y}-${String(m).padStart(2, '0')}-1${k}`, net: k % 2 ? 0.6 : -0.2, net2: k % 2 ? 0.5 : -0.3, R: 0.3, r: 1, side: 1, how: 'time' });
  const d = E.decide(tr, Array(40).fill(0));
  assert.equal(d.pass, true);
  assert.equal(E.decide(tr, Array(40).fill(1)).checks.placebo, false);
});
