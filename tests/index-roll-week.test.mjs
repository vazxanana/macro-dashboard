// index-roll-week study: the calendar helper, the trade rule on hand-made candles (no look-ahead), and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as M from '../research/edge/index-roll-week/run.mjs';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'research', 'edge', 'index-roll-week');
const R = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
const MD = fs.readFileSync(path.join(dir, 'RESULT.md'), 'utf8');

test('dates: third Friday, roll Thursday 8 days before, windows', () => {
  const d = M.datesOf('2026-09');
  assert.deepEqual(d, { F: '2026-09-18', X: '2026-09-18', R: '2026-09-10', w1: ['2026-09-04', '2026-09-11'], w2: ['2026-09-14', '2026-09-18'] });
  // W1 steps over Labor Day (Mon 7 Sep 2026): R-3 = Fri 4 Sep
  assert.equal(new Date(d.R + 'T12:00:00Z').getUTCDay(), 4);
  const e = M.datesOf('2025-12');
  assert.equal(e.F, '2025-12-19'); assert.equal(e.R, '2025-12-11');
  assert.deepEqual(e.w1, ['2025-12-08', '2025-12-12']); assert.deepEqual(e.w2, ['2025-12-15', '2025-12-19']);
  // Good Friday on the third Friday (21 Mar 2008): expiry Thursday, roll Thursday 13 Mar unchanged
  const g = M.datesOf('2008-03');
  assert.equal(g.F, '2008-03-21'); assert.equal(g.X, '2008-03-20'); assert.equal(g.R, '2008-03-13');
  assert.deepEqual(g.w2, ['2008-03-17', '2008-03-20']);
  assert.equal(M.datesOf('2008-03', 'eurex').X, '2008-03-20');
  assert.equal(M.easter(2026), '2026-04-05'); assert.equal(M.easter(2008), '2008-03-23');
  assert.equal(M.isTradingDay('2026-04-06', 'eurex'), false);   // Easter Monday
  assert.equal(M.isTradingDay('2026-04-06', 'nyse'), true);
  assert.equal(M.shiftTD('2026-09-08', -1), '2026-09-04');
});

test('quarter days and other windows stay inside the quarter, never the rule start', () => {
  const days = M.quarterDays('2025-06');
  assert.equal(days[0], '2025-04-01'); assert.equal(days.at(-1), '2025-06-30');
  const W = M.otherWindows(days, days[3]);
  assert.ok(W.every(([a, b]) => a !== days[3] && b <= days.at(-1) && days.indexOf(b) - days.indexOf(a) === M.HOLD));
  assert.equal(W.length, days.length - M.HOLD - 1);
});

function candles(n, path0) {
  const out = []; let t = Date.parse('2025-01-06T00:00:00Z') / 1000, i = 0;
  while (out.length < n) { const wd = new Date(t * 1000).getUTCDay(); if (wd !== 0 && wd !== 6) { const c = path0(i++); out.push({ d: M.ymdOf(t), o: c, h: c + 1, l: c - 1, c }); } t += 86400; }
  return out;
}

test('trade: stop at 2 x ATR, gap fill, costs and financing in R, no look-ahead', () => {
  const B = candles(40, (i) => 100 + i * 0.1), idx = new Map(B.map((b, i) => [b.d, i]));
  const rate = () => 0;
  const t = M.trade(B, idx, B[25].d, B[29].d, { rate });
  assert.ok(Math.abs(t.risk - 2 * M.atrAt(B, 25)) < 1e-12);
  assert.equal(t.how, 'time');
  assert.ok(Math.abs(t.gross - (B[29].c - B[25].c) / t.risk) < 1e-12);
  assert.ok(Math.abs(t.costR - M.SPREAD * B[25].c / t.risk) < 1e-12);
  assert.ok(Math.abs(t.finR - (M.FIN_ADD / 100 / 365) * t.nights * B[25].c / t.risk) < 1e-12);
  const t2 = M.trade(B, idx, B[25].d, B[29].d, { rate, cm: 2 });
  assert.ok(Math.abs(t2.costR - 2 * t.costR) < 1e-12 && Math.abs(t2.finR - 2 * t.finR) < 1e-12);
  // a gap through the stop fills at the open
  const G = B.map((b) => ({ ...b })); G[27] = { ...G[27], o: G[25].c - 10, l: G[25].c - 11, h: G[25].c - 9, c: G[25].c - 10 };
  const g = M.trade(G, idx, G[25].d, G[29].d, { rate });
  assert.equal(g.how, 'stop-gap'); assert.equal(g.exit, G[27].o);
  // changing every candle after the exit changes nothing
  const F = B.map((b, i) => i > 29 ? { ...b, o: 1, h: 1e6, l: 0.5, c: 1 } : b);
  assert.deepEqual(M.trade(F, idx, B[25].d, B[29].d, { rate }), t);
});

test('holm and monthT', () => {
  assert.deepEqual(M.holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  const s = M.monthT([{ sD: '2020-03-10', net: 1 }, { sD: '2020-03-20', net: 1 }, { sD: '2020-06-10', net: 0 }]);
  assert.equal(s.n, 2); assert.equal(s.mean, 1);
});

test('result.json: eight tests, verdict follows the primary, the report quotes it', () => {
  assert.equal(R.study, 'index-roll-week'); assert.equal(R.primary, 'T1');
  assert.deepEqual(Object.keys(R.tests), Object.keys(M.TESTS));
  const v = M.verdictOf(R.tests);
  assert.equal(R.verdict, v.verdict); assert.equal(R.verdict, 'FAIL');
  assert.equal(R.checks.T1.pass, false);
  const T1 = R.tests.T1;
  const head = MD.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(head.length < 220, 'headline under 220 characters');
  for (const s of [T1.oos.net.toFixed(3), T1.oos.t.toFixed(2), T1.is.net.toFixed(3), `${T1.placebo.beaten} of 40`, `n ${T1.oos.n}`]) assert.ok(head.includes(s), s);
  for (const [k, x] of Object.entries(R.tests)) {
    const row = MD.split('\n').find((l) => l.startsWith(`| ${k} `));
    assert.ok(row, k);
    const f = (v) => (v > 0 ? '+' : '') + v.toFixed(3);
    for (const s of [String(x.oos.n), f(x.oos.net), x.oos.t.toFixed(2), f(x.is.net), `${x.placebo.beaten} / 40`]) assert.ok(row.includes(s), `${k} ${s}`);
  }
});
