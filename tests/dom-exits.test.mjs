// tests/dom-exits.test.mjs - research/edge/dom-exits: the 24 h / 2R walk, the paired statistics, and RESULT.md pinned to
// result.json. Offline (no candles).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { walk, diff, summ, openAtOnce, EXITS } from '../research/edge/dom-exits/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/dom-exits/result.json', import.meta.url), 'utf8'));
const MD = fs.readFileSync(new URL('../research/edge/dom-exits/RESULT.md', import.meta.url), 'utf8');
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });

test('the walk: only the stop on the fill candle, a gap fills at the open, out at the deadline close', () => {
  // buy filled at 100, stop 99. The fill candle reaches 103 (not counted), the next one gaps to 102.5 past a 2R target (102)
  const B = [bar(0, 101, 103, 99.8, 102), bar(300, 102.5, 103, 102, 102.8)];
  assert.deepEqual(walk(B, 0, 1, 100, 99, 1, { target: 102 }), { R: 2.5, t: 300 });
  // a gap through the stop fills at the open (worse than -1R)
  const G = [bar(0, 100, 100.5, 99.5, 100), bar(300, 98, 98.5, 97.5, 98)];
  assert.equal(walk(G, 0, 1, 100, 99, 1, { target: 102 }).R, -2);
  // the 24 h hold: out at the close of the candle that ends at the deadline
  const H = []; for (let i = 0; i < 300; i++) H.push(bar(i * 300, 100, 100.5, 99.5, 100 + i / 1000));
  const w = walk(H, 0, 1, 100, 99, 1, { hold: 86400 });
  assert.equal(w.t, 86400); assert.equal(+w.R.toFixed(3), 0.287);
});

test('the paired difference is per trade and the far target counts only where it exists', () => {
  const rows = [{ t: 0, cr: 0.1, R: [1, 2, 3, 4, 6, 2, 1, null, 1, 0.5] }, { t: 40 * 86400, cr: 0.1, R: [-1, -1, -1, -1, -1, -1, -1, 3, -1, -0.5] },
    { t: 80 * 86400, cr: 0.1, R: [1, -1, -1, -1, -1, -1, 0, null, -1, 1] }];
  assert.equal(diff(rows, 7).n, 1); assert.equal(diff(rows, 7).mean, 4);
  assert.equal(diff(rows, 0).mean, +((-1 + 0 + 2) / 3).toFixed(4));
  assert.equal(summ(rows, 1).after, +((0 - 0.3) / 3).toFixed(4));
  assert.equal(openAtOnce([{ t: 0, x2: 10 }, { t: 5, x2: 20 }, { t: 10, x2: 30 }]).max, 2);
});

test('result.json follows the pre-registered bar', () => {
  assert.equal(EXITS.length, 10);
  const { early: e, late: l } = R.T1;
  assert.equal(R.verdict, e.before > 0 && e.tBefore >= 2 && l.before > 0 && l.tBefore >= 2 ? 'PASS' : 'FAIL');
  assert.equal(Object.keys(R.T2).length, 9);
  for (const [k, v] of Object.entries(R.T2)) assert.equal(v.beats, v.mean > 0 && v.holm < 0.05 && v.early.mean > 0 && v.late.mean > 0, k);
  assert.deepEqual(R.beats2R, Object.entries(R.T2).filter(([, v]) => v.beats).map(([k]) => k));
  assert.ok(R.cut.length === 5 && R.cut.every((c) => c.same));
  assert.equal(typeof R.headline, 'string');
});

test('RESULT.md says what result.json holds', () => {
  const line3 = MD.split('\n')[2];
  assert.match(line3, new RegExp(`^\\*\\*Verdict: ${R.verdict}\\.`));
  const f3 = (x) => (x > 0 ? '+' : '') + x.toFixed(3), f2 = (x) => x.toFixed(2), n = (x) => x.toLocaleString('en-GB');
  for (const h of [R.T1.early, R.T1.late]) for (const s of [f3(h.before), f2(h.tBefore), n(h.n)]) assert.ok(line3.includes(s), s);
  for (const h of [R.T1.early, R.T1.late]) assert.ok(MD.includes(`| ${n(h.n)} | ${f3(h.before)} (${f2(h.tBefore)}) | ${f3(h.after)} (${f2(h.tAfter)})`));
  for (const [k, v] of Object.entries(R.T2)) assert.ok(MD.includes(`${f3(v.mean)} (${f2(v.t)})`), k);
  for (const [m, v] of Object.entries(R.perMarket)) { const x = v.exits['2R']; assert.ok(MD.includes(`| ${n(x.n)} | ${f3(x.before)} (${f2(x.tBefore)}) | ${f3(x.after)} (${f2(x.tAfter)})`), m); }
  assert.ok(MD.includes(`${R.T2['24h'].holm.toFixed(3)}`));
});
