// passing-rules-book: accounting of the five passing rules as one paper book (research/edge/passing-rules-book). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as P from '../research/edge/passing-rules-book/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/passing-rules-book/result.json', import.meta.url), 'utf8'));
const near = (a, b, e = 0.06) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

test('result: accounting, gates passed, window and in-sample wording', () => {
  assert.match(R.verdict, /^ACCOUNTING \(no rule tested\)/);
  assert.match(R.verdict, /not evidence/);
  assert.ok(R.gates.gold.W3.ok && R.gates.gold.W4.ok && R.gates.gotobi.ok);
  assert.deepEqual(R.window, ['2016-01-01', '2026-11-19']);
  assert.equal(R.months, 131);
  const md = fs.readFileSync(new URL('../research/edge/passing-rules-book/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, /in sample for at least one/);
  assert.doesNotMatch(md, /\ban edge\b/i);
});

test('the book is the sum of its five rules', () => {
  const sum = P.KEYS.reduce((a, k) => a + R.rules[k].totalR, 0);
  near(R.book.totalR, sum, 0.05);
  assert.equal(R.book.trades, P.KEYS.reduce((a, k) => a + R.rules[k].trades, 0));
  R.monthKeys.forEach((_, i) => near(P.KEYS.reduce((a, k) => a + R.monthly[k][i], 0), P.KEYS.reduce((a, k) => a + R.monthly[k][i], 0)));
  near(R.book.totalR, R.monthKeys.reduce((a, _, i) => a + P.KEYS.reduce((s, k) => s + R.monthly[k][i], 0), 0), 0.1);
});

test('committed sources reproduce their rows in result.json', () => {
  const c = P.committedRows(), days = P.weekdays(P.FROM, P.END), months = P.monthsOf(P.FROM.slice(0, 7), P.END.slice(0, 7));
  for (const k of ['jpyVB', 'preHol', 'turn']) {
    const s = P.series(c[k], days, months), tot = s.monthly.reduce((a, b) => a + b, 0);
    near(tot, R.rules[k].totalR, 0.01); assert.equal(s.trades, R.rules[k].trades);
  }
  assert.equal(R.rules.jpyVB.trades, 2079);
});

test('bootstrap is seeded and reproduces the book figure from the stored monthly series', () => {
  const book = R.monthKeys.map((_, i) => P.KEYS.reduce((a, k) => a + R.monthly[k][i], 0));
  const b = P.bootstrap(book, { draws: 20000 });
  near(b.total.p50, R.book.boot.total.p50, 0.3); near(b.total.p5, R.book.boot.total.p5, 0.3);
  assert.deepEqual(P.bootstrap([1, -1, 2], { draws: 50, h: 4 }), P.bootstrap([1, -1, 2], { draws: 50, h: 4 }));
});

test('drawdown and time under water on a hand-made series', () => {
  const days = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'];
  const d = P.drawdown([1, -2, -1, 3, 0], days);
  assert.equal(d.maxDD, -3); assert.equal(d.ddFrom, '2026-01-05'); assert.equal(d.ddTo, '2026-01-07');
  assert.equal(d.underWaterDays, 3); assert.equal(d.uwOpen, false);
  const o = P.drawdown([1, -1, 0, 0, 0], days);
  assert.equal(o.uwOpen, true); assert.equal(o.underWaterDays, 4);
  assert.equal(P.pathDD([2, -3, 1, -1]), -3);
});

test('a weekend booking moves to the next weekday; nothing outside the window counts', () => {
  const days = P.weekdays('2026-01-02', '2026-01-06'), months = P.monthsOf('2026-01', '2026-01');
  assert.deepEqual(days, ['2026-01-02', '2026-01-05', '2026-01-06']);
  const s = P.series([['2026-01-03', 1], ['2025-12-31', 5], ['2026-01-06', -0.5]], days, months);
  assert.deepEqual(s.daily, [0, 1, -0.5]); assert.equal(s.trades, 2);
});

test('0.25 % figures are R x 0.25', () => {
  for (const x of [R.book, ...Object.values(R.rules)]) { near(x.pct.perYear, x.perYear * 0.25); near(x.pct.maxDD, x.maxDD * 0.25); }
});
