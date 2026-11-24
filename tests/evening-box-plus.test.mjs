// tests/evening-box-plus.test.mjs - the evening box fade judged after costs: pre-registration, RESULT.md agrees with result.json,
// the choice rule and the holdout checks follow the bar, gate and cut test, and the pure helpers on hand-made rows. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { variants, tradesOf, screen, HOLDOUT, MIN_N } from '../research/edge/evening-box-plus/run.mjs';

const DIR = new URL('../research/edge/evening-box-plus/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration fixes the 48 variants, the choice rule and the holdout', () => {
  for (const w of ['BEFORE any run', 'AFTER costs', '48 variants', 'S1', 'S2', 'S3', '+fade', '+other', 'no-roll', 'largest min(after-cost month t',
    'the holdout is NOT read', 'gbpjpy, audjpy, cadjpy, eurgbp, euraud', '1.5 x the cost', '3 of the 5 markets', 'ASSUMED']) assert.ok(pre.includes(w), w);
  assert.equal(variants().length, 48);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line); assert.ok(line.includes(R.headline));
});

test('gate, cut test, the choice rule and the verdict follow the bar', () => {
  for (const g of R.gate) assert.ok(g.ok, g.what);
  assert.ok(R.cutsOk);
  assert.equal(R.screen.length, 48);
  for (const v of R.screen) assert.equal(v.eligible, v.A.n >= MIN_N && v.B.n >= MIN_N && v.A.meanNet > 0 && v.B.meanNet > 0, v.name);
  const el = R.screen.filter((v) => v.eligible).sort((a, b) => b.score - a.score || b.all.n - a.all.n);
  assert.equal(R.chosen, el.length ? el[0].name : null);
  if (!R.chosen) { assert.equal(R.holdout, null); assert.equal(R.verdict, 'FAIL'); return; }
  const h = R.holdout; assert.deepEqual(R.holdoutMarkets, HOLDOUT); assert.equal(h.per.length, 5);
  assert.equal(h.nPos, h.per.filter((p) => p.meanNet > 0).length);
  assert.equal(h.pass, h.enough && h.checks.every((c) => c.ok));
  assert.equal(R.verdict, !h.enough ? 'INCONCLUSIVE' : h.pass ? 'PASS' : 'FAIL');
});

test('RESULT.md carries every variant and the holdout figures', () => {
  const lines = md.split('\n');
  for (const v of R.screen) { const l = lines.find((x) => x.startsWith(`| ${v.name} |`)); assert.ok(l, v.name);
    if (v.A.n) assert.ok(l.includes(f3(v.A.meanNet)), v.name); }
  if (R.holdout) { assert.ok(md.includes(f3(R.holdout.all.meanNet))); for (const p of R.holdout.per) assert.ok(lines.some((l) => l.startsWith(`| ${p.market} |`)), p.market); }
});

test('variant trades on hand-made rows: filters, stops, missing slots, cost multiple', () => {
  // [t, fade, other, roll, S1: cost R1 R2 R3 Rb, S2: ..., S3: ...]
  const t = Date.UTC(2010, 0, 5) / 1000;
  const rows = [[t, 1, 0, 1, 0.4, 1, 2, -1, null, 0.2, -1, -1, -1, 1.5, 0.1, 1, 2, 3, null],
    [t + 900, 0, 1, 0, null, null, null, null, null, 0.2, 1, 2, -1, null, 0.1, 1, 1, 1, 2.2]];
  const v = (s, x, f) => variants().find((q) => q.name === `${s} ${x} ${f}`);
  assert.deepEqual(tradesOf(rows, v('S1', '2R', 'none')).map((q) => q[2]), [2]);
  assert.deepEqual(tradesOf(rows, v('S2', 'box', 'none')).map((q) => q[2]), [1.5]);
  assert.deepEqual(tradesOf(rows, v('S3', 'box', '+other')).map((q) => q[2]), [2.2]);
  assert.deepEqual(tradesOf(rows, v('S2', '2R', 'no-roll')).map((q) => q[2]), [2]);
  assert.deepEqual(tradesOf(rows, v('S3', '1R', '+fade')).map((q) => q[3]), [0.1]);
  assert.ok(Math.abs(tradesOf(rows, v('S3', '1R', '+fade'), 1.5)[0][3] - 0.15) < 1e-12);
  const S = screen([{ rows }]); assert.equal(S.chosen, null, 'too few trades to be eligible');
});
