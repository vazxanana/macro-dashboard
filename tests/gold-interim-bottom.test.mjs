// gold-interim-bottom: the pieces on hand-made data, and the committed report against result.json (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../research/edge/gold-interim-bottom/run.mjs';

const T0 = Date.UTC(2010, 0, 4) / 1000;
// weekdays only, one bar a day
function bars(n, f) {
  const out = []; let t = T0, i = 0;
  while (out.length < n) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd < 6) { const c = f(i++); out.push({ time: t, open: c, high: c + 1, low: c - 1, close: c }); } t += 86400; }
  return out;
}

test('percentile, SMA and the 52-week dollar change', () => {
  assert.equal(M.pct([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(M.pct([0, 10], 0.3), 3);
  assert.deepEqual(M.sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  const dxy = [{ time: T0, close: 100 }, { time: T0 + 365 * 86400, close: 110 }];
  assert.ok(Math.abs(M.dollar52(dxy, T0 + 365 * 86400) - 0.1) < 1e-12);
  assert.equal(M.dollar52(dxy, T0 + 400 * 86400), null); // stale
});

test('thresholds come from earlier bear month-ends only, and need 12 of them', () => {
  const g = bars(900, (i) => (i < 300 ? 100 + i : 400 - (i - 300) * 0.4)); // a long fall: a bear regime
  const dxy = g.map((b, i) => ({ time: b.time, close: 100 + i * 0.01 }));
  const rows = M.monthEnds(g, dxy), bear = rows.filter((r) => r.bear);
  assert.ok(bear.length > 13);
  bear.forEach((r, k) => assert.equal(r.priorN, k));
  for (const r of bear) if (r.priorN < M.MIN_PRIOR) { assert.equal(r.c1, false); assert.equal(r.c2, false); }
  // changing a LATER month's stretch never changes an earlier threshold
  const late = bear.at(-1), first = bear.find((r) => r.priorN === M.MIN_PRIOR);
  const g2 = g.map((b, i) => (i >= late.i - 5 ? { ...b, close: b.close * 0.5 } : b));
  const r2 = M.monthEnds(g2, dxy).find((r) => r.t === first.t);
  assert.equal(r2.thrX, first.thrX);
});

test('the trade has its stop on the losing side and exits at the stop or after 63 days', () => {
  const up = bars(200, (i) => 100 + i * 0.1);
  const x = M.trade(up, 50);
  assert.ok(x.stop < x.entry);
  assert.equal(x.how, 'time');
  assert.equal(x.exitIdx, 51 + M.HOLD - 1);
  const down = bars(200, (i) => (i <= 51 ? 100 : 100 - (i - 51) * 3));
  const y = M.trade(down, 50);
  assert.ok(y.how === 'stop' || y.how === 'gap');
  assert.ok(y.gross <= -0.99);
  assert.ok(y.net < y.gross); // costs and financing
});

test('the committed result: FAIL, as RESULT.md says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-interim-bottom/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-interim-bottom/RESULT.md', import.meta.url), 'utf8');
  assert.match(r.verdict, /^FAIL/);
  assert.equal(r.pass, false);
  assert.match(md, /\*\*Verdict: FAIL/);
  const [T1, T2] = r.tests;
  assert.equal(T1.pass, false);
  assert.equal(T2.pass, false);
  assert.equal(T1.n, 1);
  assert.equal(r.counts.both, 2);
  assert.ok(md.includes(`+${T1.net.toFixed(2)}R net, n ${T1.n}`));
  assert.equal(r.reported.bearAll.n, 62);
});
