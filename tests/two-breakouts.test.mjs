import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { book, maxDD } from '../research/proposals/2026-11-20-two-breakouts.mjs';

const J = JSON.parse(fs.readFileSync(new URL('../research/proposals/2026-11-20-two-breakouts.json', import.meta.url)));

test('the committed json is the script output', () => {
  const now = execFileSync(process.execPath, [new URL('../research/proposals/2026-11-20-two-breakouts.mjs', import.meta.url).pathname], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(now), J);
});
test('book sums the two streams by month; drawdown on hand-made rows', () => {
  const b = book([['2021-01-04', 1], ['2021-02-01', -1], ['2021-03-01', 2]], [['2021-01-05', -1], ['2021-02-02', 2], ['2021-03-02', 1]], '2021-01-01', '2021-03-31');
  assert.equal(b.book.R, 4); assert.equal(b.months, 3); assert.equal(b.book.trades, 6);
  assert.equal(maxDD([1, -2, 1, -1]), -2);
});
test('the note quotes the json', () => {
  const md = fs.readFileSync(new URL('../research/proposals/2026-11-20-two-breakouts.md', import.meta.url), 'utf8'), w = J.window;
  assert.ok(md.includes((Math.round(w.book.monthT * 100 + 1e-9) / 100).toFixed(2)) && md.includes('0.03') && md.includes('in-sample'));
  assert.equal(w.monthlyCorr, 0.034); assert.equal(w.daily.bothLose, 293); assert.ok(md.includes('293 days'));
});
