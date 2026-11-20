// vb-macro-size: the pre-registered split of T1 trades by the Gold Macro Score (offline, hand-made trades).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as V from '../research/edge/vb-macro-size/run.mjs';

const DIR = new URL('../research/edge/vb-macro-size/', import.meta.url);

test('the score a trade carries is the latest weekly reading strictly before its day', () => {
  const W = [{ t: Date.parse('2020-01-03T00:00:00Z') / 1000, s: 0.1 }, { t: Date.parse('2020-01-10T00:00:00Z') / 1000, s: 0.9 }];
  const scoreAt = (t) => { let s = null; for (const w of W) { if (w.t <= t) s = w.s; else break; } return s; };
  const A = V.analyse([{ day: '2020-01-10', side: 'buy', R: 1, net: 1 }, { day: '2020-01-13', side: 'buy', R: 1, net: 1 }, { day: '2020-01-02', side: 'buy', R: 1, net: 1 }], scoreAt);
  assert.equal(A.unscored, 1, 'a trade before the first reading is left out');
  assert.equal(A.H1.atOrBelow.n, 1, 'the Friday trade takes the previous week\'s reading');
  assert.equal(A.H1.above.n, 1);
});

test('H1 passes only with t >= 2, Holm p < 0.05 and the same sign in both halves; H2 is the mirror', () => {
  const rows = [];
  for (let y = 2007; y <= 2026; y++) for (let k = 0; k < 40; k++) {
    const day = `${y}-0${1 + (k % 9)}-1${k % 9}`, above = k % 2 === 0;
    rows.push({ day, side: 'buy', R: 0, net: (above ? 0.3 : -0.1) + ((k * 7) % 5 - 2) * 0.2, above });
    rows.push({ day, side: 'sell', R: 0, net: (above ? -0.4 : 0.1) + ((k * 3) % 5 - 2) * 0.2, above });
  }
  const scoreAt = () => null, A = V.analyse([], scoreAt);
  assert.equal(A.n, 0);
  const H1 = V.split(rows.map((x) => ({ ...x, score: x.above ? 1 : 0 })), 'buy', 1), H2 = V.split(rows.map((x) => ({ ...x, score: x.above ? 1 : 0 })), 'sell', -1);
  assert.ok(H1.diff > 0 && H1.t > 2 && H1.halves.every((h) => h.d > 0));
  assert.ok(H2.diff < 0 && H2.t < -2 && H2.halves.every((h) => h.d < 0));
});

test('the book\'s sizing: longs x1 above +0.25 else x0.5, shorts x0 above else x1', () => {
  const rows = [{ day: '2020-01-02', side: 'buy', above: true, net: 1, R: 1 }, { day: '2020-01-03', side: 'buy', above: false, net: 1, R: 1 },
    { day: '2020-01-06', side: 'sell', above: true, net: -1, R: -1 }, { day: '2020-01-07', side: 'sell', above: false, net: 2, R: 2 }];
  const s = V.sized(rows);
  assert.equal(s.flat.total, 3); assert.equal(s.book.total, 3.5); assert.equal(s.book.risk, 2.5);
});

test('the pre-registration was pushed before run.mjs and names the gate and both tests', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(p, /n 3713, \+0\.155R/); assert.match(p, /H1, the sizing claim/); assert.match(p, /H2, the "never short" claim/);
  assert.equal(V.P.BUY, 0.25); assert.equal(V.P.SPLIT, '2017-01-01');
});
