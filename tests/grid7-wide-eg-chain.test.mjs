// tests/grid7-wide-eg-chain.test.mjs - the three-timeframe engulf chain grid: pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, and the trade engine on hand-made candles (market, trade-through limit). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trade, oppTarget, cellIndex, cellName, NC } from '../research/edge/grid7-wide-eg-chain/run.mjs';

const DIR = new URL('../research/edge/grid7-wide-eg-chain/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const f2 = (x) => (x < 0 ? '-' : '') + Math.abs(x).toFixed(2);

test('pre-registration names the chains, entries, windows, bar, control and assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['36 cells', 'D1 -> H4 -> H1', 'H4 -> H1 -> M15', 'H1 -> M15 -> M5', 'TRADES THROUGH', '2005-01-01 to 2014-12-31',
    '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', 'side-flipped', 'MSNR', 'same calendar month'])
    assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.cells.length, 36);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2
      && c.holm < 0.05 && c.vsControl.d != null && c.vsControl.c != null && c.vsControl.d >= 2 && c.vsControl.c >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  const anyN = R.cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : anyN ? 'FAIL' : 'INCONCLUSIVE');
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
  assert.equal(R.counts.control, R.cells.filter((c) => c.checks.control).length);
});

test('RESULT.md lists every cell with its figures from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(`${f3(c.disc.mean)} (${f2(c.disc.t)})`), c.cell + ' disc');
    assert.ok(row.includes(`${f3(c.conf.mean)} (${f2(c.conf.t)})`), c.cell + ' conf');
    assert.ok(row.includes(`${f2(c.vsControl.d)} / ${f2(c.vsControl.c)}`), c.cell + ' vs control');
  }
});

test('the cut test found nothing that a cut series would not know', () => {
  assert.ok(R.cut.length >= 10);
  assert.ok(R.cut.every((x) => x.n > 0));
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

test('cells index correctly', () => {
  const seen = new Set();
  for (let i = 0; i < NC; i++) { const n = cellName(i); assert.equal(cellIndex(n.ch, n.en, n.x, n.c), i); seen.add(i); }
  assert.equal(seen.size, 36);
});

test('the trade engine: market fill, stop first, gaps, targets, time limit, trade-through limit', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  // a market buy at 100, stop 99: 1R then 2R; the third target is not set
  let M = [bar(0, 100, 100.5, 99.5, 100.2), bar(300, 100.2, 101.2, 100, 101), bar(600, 101, 102.5, 100.8, 102)];
  let r = trade(M, 1, 'mkt', null, 99, 0, Infinity, [101, 102, NaN], 86400, 0);
  assert.deepEqual(r.R.slice(0, 2), [1, 2]); assert.ok(Number.isNaN(r.R[2]));
  // a candle holding the stop and the target is a stop
  r = trade([bar(0, 100, 103, 98, 100)], 1, 'mkt', null, 99, 0, Infinity, [101, 102, NaN], 86400, 0); assert.deepEqual(r.R.slice(0, 2), [-1, -1]);
  // a gap through the stop exits at the open
  r = trade([bar(0, 100, 100.4, 99.6, 100), bar(300, 98, 98.5, 97.5, 98)], 1, 'mkt', null, 99, 0, Infinity, [101, 102, NaN], 86400, 0); assert.deepEqual(r.R.slice(0, 2), [-2, -2]);
  // a market fill already past the stop is no trade
  assert.equal(trade([bar(0, 100, 101, 99, 100)], 1, 'mkt', null, 100.5, 0, Infinity, [101, 102, NaN], 600, 0), null);
  // the time limit closes at the candle's close (a sell)
  r = trade([bar(0, 100, 100.4, 99.6, 99.8), bar(300, 99.8, 100.1, 99.5, 99.5)], -1, 'mkt', null, 101, 0, Infinity, [99, 98, NaN], 600, 0);
  assert.deepEqual(r.R.slice(0, 2).map((x) => +x.toFixed(6)), [0.5, 0.5]);
  // a buy limit at 100 with a 0.1 trade-through: a candle touching 100 (low 99.95) does not fill; one trading to 99.9 does
  M = [bar(0, 100.5, 100.6, 99.95, 100.3), bar(300, 100.3, 100.4, 99.9, 100.1), bar(600, 100.1, 102.2, 100, 102)];
  r = trade(M, 1, 'lim', 100, 99, 0, Infinity, [101, 102, NaN], 86400, 0.1);
  assert.equal(r.fi, 1); assert.equal(r.fill, 100); assert.deepEqual(r.R.slice(0, 2), [1, 2]);
  // on the fill candle only the stop counts (a candle reaching both the fill and the target does not book the target)
  M = [bar(0, 100.5, 101.5, 99.8, 100.5), bar(300, 100.5, 100.9, 98.5, 99)];
  r = trade(M, 1, 'lim', 100, 99, 0, Infinity, [101, 102, NaN], 86400, 0.1); assert.deepEqual(r.R.slice(0, 2), [-1, -1]);
  // a limit that expires before the trade-through is no trade
  assert.equal(trade([bar(0, 100.5, 100.6, 99.95, 100.3), bar(300, 100.3, 100.4, 99.5, 100.1)], 1, 'lim', 100, 99, 0, 300, [101, 102, NaN], 86400, 0.1), null);
});

test('the opposite target is the nearest live zone of the other side ahead of the entry', () => {
  const Z = [{ dir: -1, at: 0, end: Infinity, top: 106, bot: 105 }, { dir: -1, at: 10, end: Infinity, top: 104, bot: 103 },
    { dir: -1, at: 20, end: 25, top: 102, bot: 101.5 }, { dir: 1, at: 30, end: Infinity, top: 102, bot: 101 }, { dir: -1, at: 100, end: Infinity, top: 101, bot: 100.5 }];
  assert.equal(oppTarget(Z, 1, 50, 100), 103);   // the dead zone (end 25) and the later zone (at 100) do not count
  assert.equal(oppTarget(Z, 1, 5, 100), 105);
  assert.equal(oppTarget(Z, -1, 50, 103), 102);
});
