// gold-h4-inside-bar: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { h4Start, toH4, inside, bracket, manage, runTest, placebo, TESTS, holm, monthT, report, RT, HOLD, LIFE } from '../research/edge/gold-h4-inside-bar/run.mjs';

const dir = new URL('../research/edge/gold-h4-inside-bar/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const T0 = Date.UTC(2020, 0, 6, 2) / 1000;   // Monday 02:00 UTC, an H4 boundary

// H1 rows: 60 quiet hours around 100 (range 1 an hour), then a mother H4 (range 6), an inside H4, then `after` hours
function h1Of(after = [], { mother = true, insideBar = true } = {}) {
  const r = []; let t = T0;
  const push = (o, h, l, c) => { r.push([t, o, h, l, c]); t += 3600; };
  for (let k = 0; k < 60; k++) push(100, 100.5, 99.5, 100);
  if (mother) { push(100, 103, 99, 102); push(102, 102.5, 97, 98); push(98, 100, 98, 99); push(99, 100, 98.5, 99.5); }   // 97..103
  if (insideBar) for (let k = 0; k < 4; k++) push(99.5, 100.5, 99, 100);   // 99..100.5, inside 97..103
  for (const x of after) push(...x);
  for (let k = 0; k < 40; k++) { const p = r.at(-1)[4]; push(p, p + 0.05, p - 0.05, p); }
  return r;
}
const sigIdx = (c) => c.findIndex((_, i) => inside(c, i));

test('H4 boundaries 22/02/06/10/14/18 UTC, Sunday stub joins the 22:00 candle; next = first H1 after', () => {
  const at = (s) => Date.parse(s) / 1000;
  assert.equal(h4Start(at('2020-01-06T03:00:00Z')), at('2020-01-06T02:00:00Z'));
  assert.equal(h4Start(at('2020-06-07T21:00:00Z')), at('2020-06-07T22:00:00Z'));
  const c = toH4([[at('2020-06-07T21:00:00Z'), 1, 2, 0.5, 1.5], [at('2020-06-07T22:00:00Z'), 1.5, 3, 1, 2], [at('2020-06-08T02:00:00Z'), 2, 2, 2, 2]]);
  assert.equal(c.length, 2); assert.equal(c[0].high, 3); assert.equal(c[0].next, 2); assert.equal(c[1].next, 3);
});

test('inside bar: strictly inside, mother range >= ATR', () => {
  const c = toH4(h1Of()); const i = sigIdx(c);
  assert.ok(i > 0); assert.equal(c[i - 1].high, 103); assert.equal(c[i - 1].low, 97);
  const m = { high: 103, low: 97 };
  assert.equal(inside([m, { high: 103, low: 98, atr: 2 }], 1), false);   // equal high: not strictly inside
  assert.equal(inside([m, { high: 104, low: 98, atr: 2 }], 1), false);
  assert.equal(inside([m, { high: 102, low: 98, atr: 2 }], 1), true);
  const c3 = toH4(h1Of()); c3[i].atr = 7; assert.equal(inside(c3, i), false);   // mother range 6 < ATR 7
});

test('bracket: buy stop at mother high, stop at mother low, target 2R, costs and financing', () => {
  const h1 = h1Of([[100, 103.5, 100, 103.2], [103.2, 116, 103, 115]]), c = toH4(h1), i = sigIdx(c);
  const t = bracket(h1, c, i, 2);
  assert.equal(t.side, 1); assert.equal(t.fill, 103); assert.equal(t.stop, 97); assert.equal(t.how, 'target');
  assert.ok(Math.abs(t.gross - 2) < 1e-9); assert.ok(Math.abs(t.cost - RT / 6) < 1e-12); assert.ok(t.fin >= 0);
  const s = bracket(h1Of([[99, 99.5, 96.5, 96.8], [96.8, 97, 84, 85]]), toH4(h1Of([[99, 99.5, 96.5, 96.8], [96.8, 97, 84, 85]])), i, 2);
  assert.equal(s.side, -1); assert.equal(s.stop, 103); assert.equal(s.fin, 0); assert.equal(s.how, 'target');
});

test('fill rules: gap at the open, both levels in one candle = loss on the nearer side, fill candle to the stop = loss', () => {
  let h1 = h1Of([[104, 105, 103.5, 104.5]]), c = toH4(h1), i = sigIdx(c);
  assert.equal(bracket(h1, c, i, 2).fill, 104);                                    // gapped above: fills at the open
  h1 = h1Of([[102.5, 103.5, 96.5, 100]]); c = toH4(h1);
  let t = bracket(h1, c, i, 2); assert.equal(t.side, 1); assert.equal(t.how, 'stop'); assert.ok(Math.abs(t.gross + 1) < 1e-9);
  h1 = h1Of([[97.5, 103.5, 96.5, 100]]); c = toH4(h1);
  t = bracket(h1, c, i, 2); assert.equal(t.side, -1); assert.equal(t.how, 'stop');
  h1 = h1Of([[100, 115.5, 100, 115]]); c = toH4(h1);                               // fill candle runs to the target: not booked as a win
  t = bracket(h1, c, i, 2); assert.notEqual(t.how, 'stop'); assert.equal(t.fillIdx, c[i].next);
  const r = bracket(h1Of([], {}), toH4(h1Of()), i, 2); assert.equal(r.unfilled, true);   // never reached: unfilled after LIFE
  assert.equal(LIFE, 24);
});

test('time exit after 24 H1 candles from the fill; buy-only test places no sell stop', () => {
  const h1 = h1Of([[100, 103.5, 100, 103.2]]), c = toH4(h1), i = sigIdx(c);
  const t = bracket(h1, c, i, null); assert.equal(t.how, 'time'); assert.equal(t.exitIdx, t.fillIdx + HOLD - 1);
  const s = h1Of([[99, 99.5, 96.5, 96.8]]); assert.equal(bracket(s, toH4(s), i, 2, true).unfilled, true);
  const m = manage(h1, 10, 1, 100, 99.6, 2); assert.equal(m.how, 'stop'); assert.equal(m.exit, 99.6);   // the fill candle's low 99.5 reaches the stop
});

test('no look-ahead: prices after the inside close do not change the signal or the order levels', () => {
  const a = h1Of([[100, 100, 100, 100]]), b = h1Of([[300, 900, 1, 2]]);
  const ca = toH4(a), cb = toH4(b), i = sigIdx(ca);
  assert.equal(sigIdx(cb), i); assert.equal(ca[i - 1].high, cb[i - 1].high); assert.equal(ca[i].atr, cb[i].atr);
});

test('one bracket at a time, Holm, month t, placebo keeps side', () => {
  const h1 = h1Of([[100, 103.5, 100, 103.2], [103.2, 116, 103, 115]]), c = toH4(h1), T = runTest(h1, c, TESTS.T1);
  for (let k = 1; k < T.length; k++) assert.ok(T[k].fillIdx > T[k - 1].exitIdx);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  assert.equal(monthT([{ exitT: Date.UTC(2020, 0, 5) / 1000, net: 1 }], ['2020-01-01', '2020-03-31']).months, 3);
  const pl = placebo(h1, TESTS.T1, T, 3); assert.equal(pl.length, 3);
});

test('the report matches result.json and the verdict follows the checks', () => {
  assert.equal(MD, report(R));
  const v = MD.match(/\*\*Verdict: [^*]+\*\*/)[0]; assert.ok(v.length < 220, v);
  assert.equal(R.verdict, R.tests.T1.pass ? 'PASS' : 'FAIL');
  for (const x of Object.values(R.tests)) assert.equal(x.pass, Object.values(x.checks).every(Boolean));
  assert.ok(MD.includes(`n ${R.tests.T1.oos.n}`));
  assert.equal(R.windows.is[0], '2007-01-01'); assert.equal(R.windows.oos[0], '2017-01-01');
});
