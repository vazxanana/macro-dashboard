// research/edge/crypto-month-end: the rule's dates, stop, costs, financing and placebo on hand-made candles (offline), and the
// report against result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as S from '../research/edge/crypto-month-end/run.mjs';

const DIR = path.resolve('research/edge/crypto-month-end');
const at = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

// flat candles from `from` for `n` days: open = close = px, high px+1, low px-1 (true range 2, so ATR 2, stop distance 4)
function flat(from, n, px = 100) {
  const rows = [];
  for (let k = 0; k < n; k++) rows.push([at(from) + k * 86400, px, px + 1, px - 1, px]);
  return rows;
}

test('turn dates: close of the 3rd-to-last day to the close of day 2 of the next month', () => {
  const d = S.turnDates(2026, 0); // January 2026 (31 days)
  assert.equal(S.day(d.tEntry), '2026-01-29');
  assert.equal(S.day(d.tExit), '2026-02-02');
  const f = S.turnDates(2024, 1); // February 2024 (29 days)
  assert.equal(S.day(f.tEntry), '2024-02-27');
  assert.equal(S.day(f.tExit), '2024-03-02');
  const dec = S.turnDates(2025, 11);
  assert.equal(S.day(dec.tEntry), '2025-12-29');
  assert.equal(S.day(dec.tExit), '2026-01-02');
  const m = S.mirrorDates(2026, 4);
  assert.equal(S.day(m.tEntry), '2026-05-13');
  assert.equal(S.day(m.tExit), '2026-05-17');
});

test('ATR needs 21 candles and uses the true range', () => {
  const rows = flat('2026-01-01', 30);
  assert.equal(S.atrAt(rows, 19), null);
  assert.equal(S.atrAt(rows, 20), 2);
});

test('a trade: costs and financing in R, every trade has a stop', () => {
  const rows = flat('2026-01-01', 40);
  rows[32][4] = 102; // close of 2 Feb (index 32) up 2: gross +0.5R
  const ix = S.indexRows(rows), d = S.turnDates(2026, 0);
  const x = S.simTrade(rows, ix, d.tEntry, d.tExit, 'btc');
  assert.equal(x.entry, 100);
  assert.equal(x.stop, 96);
  assert.ok(x.stop < x.entry);
  assert.equal(x.stopped, false);
  assert.equal(x.gross, 0.5);
  assert.ok(Math.abs(x.cost - 0.0004 * 100 / 4) < 1e-12);
  // 30 Jan (Fri) x3 + 31 Jan + 1 Feb + 2 Feb rollovers at 17:00 New York = 6 nights
  assert.equal(x.nights, 6);
  assert.ok(Math.abs(x.fin - 6 * 0.15 / 365 * 100 / 4) < 1e-12);
  assert.ok(Math.abs(x.R - (x.gross - x.cost - x.fin)) < 1e-12);
  const x2 = S.simTrade(rows, ix, d.tEntry, d.tExit, 'btc', 2);
  assert.ok(Math.abs(x2.cost - 2 * x.cost) < 1e-12 && Math.abs(x2.fin - 2 * x.fin) < 1e-12);
});

test('the stop: at the stop on a low through it, at the open on a gap below it', () => {
  const rows = flat('2026-01-01', 40), d = S.turnDates(2026, 0);
  rows[30][3] = 90; // 31 Jan low through 96
  let x = S.simTrade(rows, S.indexRows(rows), d.tEntry, d.tExit, 'btc');
  assert.equal(x.stopped, true);
  assert.equal(x.exit, 96);
  assert.equal(x.gross, -1);
  const g = flat('2026-01-01', 40);
  g[30][1] = 94; g[30][3] = 93;
  x = S.simTrade(g, S.indexRows(g), d.tEntry, d.tExit, 'btc');
  assert.equal(x.exit, 94);
  assert.equal(x.gross, -1.5);
});

test('no look-ahead: prices after the exit change nothing', () => {
  const rows = flat('2026-01-01', 60), d = S.turnDates(2026, 0);
  const a = S.simTrade(rows, S.indexRows(rows), d.tEntry, d.tExit, 'btc');
  for (let k = 33; k < 60; k++) rows[k] = [rows[k][0], 500, 600, 1, 300];
  const b = S.simTrade(rows, S.indexRows(rows), d.tEntry, d.tExit, 'btc');
  assert.deepEqual(a, b);
});

test('placebo windows stay inside the month and away from the turn; seeds are repeatable', () => {
  const rows = flat('2025-01-01', 500);
  const evs = S.events(rows, 'btc', S.turnDates).out;
  assert.ok(evs.length > 10);
  assert.equal(S.placeboSeed(rows, 'btc', evs, 7), S.placeboSeed(rows, 'btc', evs, 7));
  const r = S.rng(3), seen = [];
  for (let k = 0; k < 2000; k++) seen.push(2 + Math.floor(r() * (28 - 6 - 2 + 1)));
  assert.ok(Math.min(...seen) === 2 && Math.max(...seen) === 22);
});

test('result.json and RESULT.md agree, and the verdict follows the pre-registered bar', () => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  const b = j.btc;
  assert.equal(b.is.n + b.oos.n, b.N);
  assert.equal(b.is.n, Math.floor(b.N / 2));
  const pass = b.oos.t >= 2 && b.is.R > 0 && b.oos.cost2.R > 0 && b.placebo.beats >= 38;
  assert.equal(j.verdict, pass ? 'PASS' : 'FAIL');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${j.verdict}`));
  for (const v of [b.is.R, b.oos.R, b.oos.cost2.R, j.eth.oos.R]) assert.ok(md.includes((v >= 0 ? '+' : '') + v.toFixed(4)), String(v));
  assert.ok(md.includes(`${b.placebo.beats} of 40`));
  assert.ok(md.includes(`t ${b.oos.t}`) && md.includes(`n ${b.oos.n}`));
  assert.ok(fs.existsSync(path.join(DIR, 'PREREGISTRATION.md')));
  for (const tr of b.trades) assert.ok(tr.s < tr.e, 'every trade has a stop below its entry');
});
