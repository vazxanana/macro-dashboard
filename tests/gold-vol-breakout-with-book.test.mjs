// gold-vol-breakout-with-book: a descriptive note (no rule tested). Offline: the series builders on hand-made records, the
// verbatim copy of the original rule, that the book is read only through supported-book's own functions, and RESULT.md
// against result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as S from '../research/edge/gold-vol-breakout-with-book/run.mjs';
import { weekdays, bookStats } from '../research/edge/supported-book/run.mjs';

const DIR = 'research/edge/gold-vol-breakout-with-book/';
const R = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8'));

test('original.mjs is the verbatim copy of the breakout rule', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(DIR + 'original.mjs')).digest('hex');
  assert.equal(sha, S.ORIG_SHA);
  assert.equal(R.originalSha256, S.ORIG_SHA);
  assert.equal(S.T1.k, 0.5); assert.equal(S.T1.sides, 'both');
});

test('the plan is the committed one, and the note tests nothing', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(DIR + 'PREREGISTRATION.md')).digest('hex');
  assert.equal(R.planSha256, sha);
  assert.equal(R.kind, 'descriptive'); assert.equal(R.test, 'none');
  assert.ok(!('pass' in R) && !('decision' in R));
});

test('breakout daily series: net R on its trade day, 0 elsewhere, outside the window dropped', () => {
  const days = weekdays('2020-01-06', '2020-01-10');
  const tr = [{ day: '2020-01-06', net: 1.5 }, { day: '2020-01-08', net: -1 }, { day: '2020-01-13', net: 9 }];
  const b = S.breakoutDaily(tr, days);
  assert.deepEqual(b.v, [1.5, 0, -1, 0, 0]); assert.equal(b.n, 2);
});

test('combine: plain sum, drawdown ratio and monthly figures on hand-made series', () => {
  const days = weekdays('2020-01-01', '2020-02-28'), n = days.length;
  const a = new Array(n).fill(0), b = new Array(n).fill(0);
  a[0] = 2; a[3] = -3; a[30] = 4;            // book: peak 2, trough -1 → dd 3
  b[1] = 1; b[3] = 2; b[10] = -2; b[35] = 1; // breakout: peak 3, trough 1 → dd 2
  const c = S.combine({ v: a, n: 3 }, { v: b, n: 4 }, days, 1);
  assert.equal(c.book.maxDD, 3); assert.equal(c.breakout.maxDD, 2);
  assert.equal(c.combined.maxDD, 3);         // 2, 3, 3, 2, …, 0 → from 3 to 0
  assert.equal(c.ddRatio, 0.6);
  assert.equal(c.combined.total, 5); assert.equal(c.combined.n, 7);
  assert.equal(c.book.months, 2);
  assert.ok(c.corr.daily > -1 && c.corr.daily < 1);
});

test("the book is supported-book's own record: the note's book figures equal bookStats for the same window", () => {
  const legs = JSON.parse(fs.readFileSync('research/edge/supported-book/legs.json', 'utf8')).units;
  for (const [wk, W] of Object.entries(S.WINDOWS)) {
    const { out, days, v } = bookStats(legs, S.BOOK, { ...W, halves: [] }, S.BOOK_OPT);
    const st = S.stats(v, days, out.positions, S.yearsOf(W.from, W.to));
    assert.deepEqual(st, R.windows[wk].book);
    assert.equal(out.tMonthly, st.tMonthly); assert.equal(out.maxDD, st.maxDD);
    assert.ok(R.windows[wk].check.ok);
  }
  assert.equal(R.windows.A.book.maxDD, 19.8);   // supported-book's published worst closed drawdown (W1, S2, x1F1)
});

test('only the original rule and supported-book are imported (no council, ICT or live file directly)', () => {
  const src = fs.readFileSync(DIR + 'run.mjs', 'utf8');
  const rel = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.')).sort();
  assert.deepEqual(rel, ['../supported-book/run.mjs', './original.mjs']);
});

test('RESULT.md is report(result.json), and the verdict line is descriptive and short', () => {
  assert.equal(fs.readFileSync(DIR + 'RESULT.md', 'utf8'), S.report(R));
  assert.equal(R.verdict, S.verdictLine(R));
  assert.ok(R.verdict.startsWith('DESCRIPTIVE, no rule tested: '));
  assert.ok(`**Verdict: ${R.verdict}**`.length < 220);
  assert.ok(!/\b(pass|passes|fail|fails|edge)\b/i.test(R.verdict));
  const a = R.windows.A;
  assert.equal(a.combined.n, a.book.n + a.breakout.n);
  assert.ok(Math.abs(a.combined.total - (a.book.total + a.breakout.total)) <= 0.11);
  assert.ok(Math.abs(a.ddRatio - a.combined.maxDD / (a.book.maxDD + a.breakout.maxDD)) < 0.01);
});
