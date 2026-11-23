// The edge-book accounting (research/proposals/2026-11-23-edge-book.*): the json equals the script's output, the document's
// figures equal the json, and the sources are the committed studies'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, stats, monthKeys, maxDD } from '../research/proposals/2026-11-23-edge-book.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = path.join(ROOT, 'research/proposals');
const J = JSON.parse(fs.readFileSync(path.join(P, '2026-11-23-edge-book.json'), 'utf8'));
const DOC = fs.readFileSync(path.join(P, '2026-11-23-edge-book.md'), 'utf8');

// half up on the stored (3-decimal) value, as the 20 Nov accounting printed it
const fx = (v, d) => (Math.round(Math.abs(v) * 10 ** d + 1e-9) / 10 ** d).toFixed(d);
const sign = (v, d) => (v < 0 ? '−' : '+') + fx(v, d);
const neg = (v, d) => (v < 0 ? '−' : '') + fx(v, d);

test('the json is the script\'s output', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(build())), J);
});

test('helpers: every calendar month counts, drawdown from the peak', () => {
  assert.equal(monthKeys('2025-11-01', '2026-02-28').join(','), '2025-11,2025-12,2026-01,2026-02');
  assert.equal(maxDD([1, -2, 3, -4, 1]), -4);
  const s = stats([['2026-01-05', 1], ['2026-03-02', -1]], '2026-01-01', '2026-03-31');
  assert.equal(s.trades, 2); assert.deepEqual(s.monthly, [1, 0, -1]); assert.equal(s.maxDD, -1);
});

test('the core book matches the 20 Nov two-breakouts accounting', () => {
  const tb = JSON.parse(fs.readFileSync(path.join(P, '2026-11-20-two-breakouts.json'), 'utf8')).window;
  const c = J.A.books.core;
  assert.equal(c.trades, tb.book.trades);
  assert.equal(c.R, tb.book.R);
  assert.equal(c.monthT, tb.book.monthT);
  assert.equal(J.A.monthlyCorr.goldVB.usdjpyVB, tb.monthlyCorr);
});

test('the sources reproduce their studies\' published figures', () => {
  const s = stats(JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge/gold-pre-holiday/result.json'), 'utf8')).tests.T1.trades
    .map((t) => [t.date, t.net]), '2017-01-01', '2026-12-31');
  assert.equal(s.trades, 92); assert.equal(s.perTrade, 0.133);
  const tt = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge/turnaround-tuesday/result.json'), 'utf8')).cells['nas100-r2'].trades
    .filter((t) => t[0] >= '2016');
  assert.equal(tt.length, 81); assert.equal(Math.round(tt.reduce((a, t) => a + t[6], 0) / tt.length * 1000) / 1000, 0.098);
  const ge = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge/gotobi-exec/result.json'), 'utf8'));
  assert.equal(J.sources.gotobi.n, ge.E.n);
});

test('the document\'s book tables equal the json', () => {
  const row = (label, r) => `| ${label} | ${r.trades} | ${sign(r.R, 1)} | ${sign(r.perTrade, 3)} | ${sign(r.perYear, 1)} | ${fx(r.monthT, 2)} | ${neg(r.worstMonth, 1)} | ${neg(r.maxDD, 1)} |`;
  const A = [['Gold breakout', J.A.rules.goldVB], ['USD/JPY breakout', J.A.rules.usdjpyVB], ['Pre-holiday', J.A.rules.preHoliday],
    ['Turnaround Tuesday', J.A.rules.turnaround], ['**Core: the two breakouts**', J.A.books.core], ['Core + pre-holiday', J.A.books.coreHoliday]];
  for (const [l, r] of A) assert.ok(DOC.includes(row(l, r) + ` ${r.losingFullYears} of ${r.fullYears} |`), l);
  const B = [['Gold breakout', J.B.rules.goldVB], ['USD/JPY breakout', J.B.rules.usdjpyVB], ['Gotobi T2', J.B.rules.gotobi], ['Pre-holiday', J.B.rules.preHoliday],
    ['Core: the two breakouts', J.B.books.core], ['**Candidate book: breakouts + gotobi + pre-holiday**', J.B.books.candidate]];
  for (const [l, r] of B) assert.ok(DOC.includes(row(l, r) + '\n') || DOC.endsWith(row(l, r)), l);
  const risk = (b) => `| ${b.risk.map((x) => x.pctPerTrade).join(' / ')} | ${b.risk.map((x) => sign(x.pctPerYear, 1)).join(' / ')} | ${b.risk.map((x) => neg(x.worstDDpct, 1)).join(' / ')} |`;
  assert.ok(DOC.includes(`| Core, window A ${risk(J.A.books.core)}`));
  assert.ok(DOC.includes(`| Candidate, window B ${risk(J.B.books.candidate)}`));
  assert.ok(DOC.includes(`(${neg(J.A.books.core.years['2023'], 1)}R)`));
  assert.ok(DOC.includes(`breakout ${fx(J.A.monthlyCorr.goldVB.usdjpyVB, 2)}, with pre-holiday ${fx(J.A.monthlyCorr.goldVB.preHoliday, 2)}`));
  assert.ok(DOC.includes(`with pre-holiday ${fx(J.A.monthlyCorr.usdjpyVB.preHoliday, 2)})`));
  assert.ok(DOC.includes(`gold breakout is ${neg(J.B.monthlyCorr.gotobi.goldVB, 2)} and with the USD/JPY breakout ${fx(J.B.monthlyCorr.gotobi.usdjpyVB, 2)}`));
});

test('the document quotes committed study figures, calls nothing an edge and promises nothing', () => {
  const r = (p) => fs.readFileSync(path.join(ROOT, 'research/edge', p, 'RESULT.md'), 'utf8');
  assert.match(r('gold-vol-breakout-replicate'), /n 1657, month t \+3\.19/);
  assert.match(r('usdjpy-vol-breakout-early'), /n 2089, month t \+2\.95/);
  assert.match(r('gotobi-exec'), /\+0\.163R a trade, month t 1\.80/);
  assert.match(r('gotobi-replicate'), /n 4784, \+0\.099R a trade net, month t \+2\.75/);
  assert.match(r('turnaround-replicate'), /month t 1\.69|1\.69 \(131 months/);
  assert.ok(!/\bis an edge\b|\bproven edge\b(?! )|guarantee/i.test(DOC.replace(/None of the four is proven/, '')));
  assert.match(DOC, /in-sample years for every rule in the book/);
  assert.match(DOC, /\*\*11 distinct rules\*\*/);
});
