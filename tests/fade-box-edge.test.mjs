// fade-box-edge: three M15 box-fade candidates judged after costs on unread data. Offline: reads the committed files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../research/edge/fade-box-edge/report.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'fade-box-edge');
const res = JSON.parse(fs.readFileSync(path.join(ROOT, 'result.json'), 'utf8'));
const md = fs.readFileSync(path.join(ROOT, 'RESULT.md'), 'utf8');

test('RESULT.md line 3 states the verdict of result.json', () => {
  const l3 = md.split('\n')[2];
  assert.match(l3, /^\*\*Verdict: (PASS|FAIL|INCONCLUSIVE)\. .+\*\*$/);
  assert.equal(l3.match(/Verdict: (\w+)/)[1], res.verdict);
  assert.ok(res.headline.startsWith(res.verdict));
});

test('the verdict follows the pre-registered bar from the stored primary tests', () => {
  assert.equal(res.primary.length, 6);
  const prim = res.primary.map((p) => ({ c: p.candidate, set: p.set, stat: { n: p.n, meanR: p.meanR, tMonth: p.tMonth, pOne: p.pOne } }));
  assert.equal(R.judge(prim).verdict, res.verdict);
  for (const p of res.primary) { const s = res.sets[p.set][p.candidate].after; assert.equal(s.n, p.n); assert.equal(s.meanR, p.meanR); assert.equal(s.tMonth, p.tMonth); }
});

test('the figures quoted in RESULT.md come from result.json', () => {
  for (const p of res.primary) {
    const s = res.sets[p.set][p.candidate];
    assert.ok(md.includes(s.after.n.toLocaleString('en-US')), `${p.candidate} ${p.set} n`);
    assert.ok(md.includes(s.after.tMonth.toFixed(2)), `${p.candidate} ${p.set} t ${s.after.tMonth}`);
    assert.ok(md.includes(s.before.tMonth.toFixed(2)), `${p.candidate} ${p.set} before t`);
  }
});

test('the candidates are the pre-registered ones and the cut test found no difference', () => {
  assert.deepEqual(R.CANDIDATES.E1.conds, ['rc8', 'topIn']); assert.equal(R.CANDIDATES.E1.k, 1);
  assert.deepEqual(R.CANDIDATES.E2.conds, ['rc8', 'er30']); assert.equal(R.CANDIDATES.E2.k, 2);
  assert.deepEqual(R.CANDIDATES.E3.conds, []); assert.equal(R.CANDIDATES.E3.k, 2);
  assert.ok(res.cut.checks >= 12); assert.equal(res.cut.mismatches, 0);
});

test('after costs = before costs less cost / risk, trade by trade', () => {
  const rows = [{ t: Date.UTC(2006, 2, 1) / 1000, ch: 1, rc: 9, topPos: 0, R: { k1: { tr: 0.5, cr: 0.1 } } },
    { t: Date.UTC(2006, 5, 1) / 1000, ch: 1, rc: 9, topPos: 0, R: { k1: { tr: -1, cr: 0.1 } } },
    { t: Date.UTC(2006, 5, 1) / 1000, ch: 1, rc: 5, topPos: 0, R: { k1: { tr: 3, cr: 0.1 } } }]; // risk under 8 round trips: out
  const c = R.CANDIDATES.E1, picked = R.pick(rows, c), a = Date.UTC(2005, 0, 1) / 1000, b = Date.UTC(2010, 0, 1) / 1000;
  assert.equal(picked.length, 2);
  assert.equal(R.stat(picked, c, a, b, 0).meanR, -0.25); assert.equal(R.stat(picked, c, a, b, 1).meanR, -0.35);
});
