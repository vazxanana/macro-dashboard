// vb-dollar-confirm: the recorded result and the grouping rule (offline, fast).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { tag, TESTS } from '../research/edge/vb-dollar-confirm/run.mjs';

const DIR = new URL('../research/edge/vb-dollar-confirm/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));

test('result.json: gate, verdict and the plan hash', () => {
  assert.equal(R.gateOk, true);
  assert.equal(R.gate.length, 7);
  assert.match(R.verdict, /^FAIL, 0 of 4/);
  assert.equal(Object.keys(R.decision).length, 4);
  for (const d of Object.values(R.decision)) assert.equal(d.verdict, 'FAIL');
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', DIR))).digest('hex');
  assert.equal(R.planSha256, sha);
  assert.deepEqual(Object.keys(TESTS), ['T1', 'T2', 'T3', 'T4']);
});

test('result.json: group counts add up and the RESULT.md figures come from it', () => {
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  for (const mk of ['xau', 'usdjpy']) for (const w of ['DISC', 'CONF']) {
    const x = R.groups[mk][w];
    assert.equal(x.agree.n + x.disagree.n + x.none.n, x.all.n);
  }
  assert.equal(R.groups.xau.CONF.agree.n, 593);
  assert.equal(R.groups.usdjpy.CONF.agree.n, 444);
  assert.ok(md.includes(R.verdict));
});

test('tag: only an earlier fill candle of the other market is read, dollar-consistent = opposite sides', () => {
  const A = [{ day: 'd1', side: 1, fillT: 1000 }, { day: 'd2', side: 1, fillT: 1000 }, { day: 'd3', side: -1, fillT: 1000 }, { day: 'd4', side: 1, fillT: 1000 }, { day: 'd5', side: 1, fillT: 1000 }];
  const B = [{ day: 'd1', side: -1, fillT: 700 }, { day: 'd2', side: 1, fillT: 700 }, { day: 'd3', side: 1, fillT: 700 },
    { day: 'd4', side: -1, fillT: 1000 }, { day: 'd5', side: -1, fillT: 1300 }];
  const g = tag(A, B).map((x) => x.group);
  assert.deepEqual(g, ['agree', 'disagree', 'agree', 'none', 'none']);
  // changing anything about B after A's fill (its result, a later fill) never moves A's group
  const B2 = B.map((x) => ({ ...x, R: 99, exitT: 5000 }));
  assert.deepEqual(tag(A, B2).map((x) => x.group), g);
});
