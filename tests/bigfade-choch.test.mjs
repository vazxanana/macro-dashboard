import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { walk, base, choch, compare, summary, firstAt, WAIT } from '../research/edge/bigfade-choch/run.mjs';

const T0 = 1.7e9, mk = (rows) => rows.map((r, i) => ({ t: T0 + i * 60, e: T0 + i * 60 + 60, o: r[0], h: r[1], l: r[2], c: r[3] }));
// a bullish big candle ended at index 10 (high 101, 50 % = 98); after it: a swing low at 100.0, then a close below it
const pre = Array.from({ length: 10 }, (_, i) => [99 + i * 0.2, 99.3 + i * 0.2, 98.9 + i * 0.2, 99.2 + i * 0.2]);
const after = [[100.8, 100.9, 100.5, 100.6], [100.6, 100.7, 100.3, 100.4], [100.4, 100.5, 100.0, 100.3], [100.3, 100.6, 100.2, 100.5], [100.5, 100.7, 100.3, 100.6], [100.6, 100.6, 99.8, 99.9], [99.9, 100.0, 99.5, 99.6], [99.6, 99.7, 98.9, 99.0], [99.0, 99.1, 97.9, 98.0], [98.0, 98.1, 97.5, 97.6]];
const L = mk([...pre, ...after]), g = { ts: T0 + 10 * 60, d: 1, ext: 101, mid: 98, a: 1 };

test('bigfade-choch: the entry waits for a close beyond a confirmed swing and never reads later candles', () => {
  const c = choch(L, g, WAIT['1m']);
  assert.ok(!c.skip, JSON.stringify(c));
  assert.equal(c.lvl, 100.0, 'the swing low confirmed two candles after it');
  assert.equal(c.t, L[16].t, 'entry at the open after the candle that closed below the swing');
  assert.equal(c.fill, 99.9); assert.ok(Math.abs(c.risk - (101.1 - 99.9)) < 1e-9, 'stop past the highest high since the candle + 0.1 ATR');
  assert.equal(c.how, 'target'); assert.ok(Math.abs(c.R - (99.9 - 98) / 1.2) < 1e-9);
  const cut = choch(L.slice(0, 16), g, WAIT['1m']); assert.equal(cut.skip, 'open', 'cut at the break candle: no entry candle yet, and nothing invented');
  const before = choch(L.slice(0, 15), g, WAIT['1m']); assert.equal(before.skip, 'noChoch');
  const changed = L.map((b, i) => (i > 16 ? { ...b, o: b.o + 5, h: b.h + 5, l: b.l + 5, c: b.c + 5 } : b)), c2 = choch(changed, g, WAIT['1m']);
  assert.equal(c2.t, c.t); assert.equal(c2.fill, c.fill); assert.equal(c2.risk, c.risk);
});

test('bigfade-choch: no trade when the 50 % or the stop level comes first; the base trade is the desk\'s', () => {
  const tf = mk([...pre, [100.8, 100.9, 97.9, 98.2], ...after]); assert.equal(choch(tf, g, 3600).skip, 'targetFirst');
  const sf = mk([...pre, [100.8, 101.2, 100.6, 101.0], ...after]); assert.equal(choch(sf, g, 3600).skip, 'stopFirst');
  const b = base(L, g); assert.equal(b.t, L[10].t); assert.equal(b.fill, 100.8); assert.ok(b.plan >= 1); assert.equal(b.how, 'target');
  assert.equal(base(L, { ...g, mid: 100.7 }).skip, 'near');
  assert.equal(firstAt(L, g.ts), 10);
});

test('bigfade-choch: walk fills a gap at the open and stops first inside one candle', () => {
  const W = mk([[100, 100.1, 99.9, 100], [102, 102.1, 101.9, 102]]); assert.ok(Math.abs(walk(W, 0, -1, 101, 98).R - -2) < 1e-9);
  const X = mk([[100, 101.5, 97, 99]]); assert.equal(walk(X, 0, -1, 101, 98).R, -1);
});

test('bigfade-choch: the comparison and the summary', () => {
  const T = (n, win, r) => Array.from({ length: n }, (_, i) => ({ mo: '2023-' + String(1 + (i % 12)).padStart(2, '0'), R: i % 10 < win ? r : -1, net: (i % 10 < win ? r : -1) - 0.1, plan: r }));
  const B = T(600, 3, 2), C = T(400, 6, 1), cmp = compare(B, C);
  assert.ok(cmp.z > 2); assert.ok(Math.abs(summary(C).win - 0.6) < 1e-9); assert.ok(Math.abs(summary(B).net - (0.3 * 2 - 0.7 - 0.1)) < 1e-9);
});

test('bigfade-choch: the report is the result file', { skip: !fs.existsSync(new URL('../research/edge/bigfade-choch/result.json', import.meta.url)) }, () => {
  const j = JSON.parse(fs.readFileSync(new URL('../research/edge/bigfade-choch/result.json', import.meta.url), 'utf8')), md = fs.readFileSync(new URL('../research/edge/bigfade-choch/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(j.verdict)); assert.match(j.verdict, /^(PASS|FAIL)\./);
  assert.equal(/^PASS/.test(j.verdict), j.tests.winRate && j.tests.better && j.tests.worth);
  assert.ok(j.pooled.c.choch.n > 300 && j.pooled.c.base.n > j.pooled.c.choch.n);
});
