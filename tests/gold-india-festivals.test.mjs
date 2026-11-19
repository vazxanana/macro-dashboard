// research/edge/gold-india-festivals: the fixed festival dates, the windows and the H1-checked trade on hand-made candles (no
// look-ahead), the statistics helpers, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DHANTERAS, AKSHAYA } from '../research/edge/gold-india-festivals/dates.mjs';
import { festWindows, trade, atr, lastBefore, pT, holm, tOne, ymdOf, P, headline, verdictLine } from '../research/edge/gold-india-festivals/run.mjs';

const DIR = new URL('../research/edge/gold-india-festivals/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');

test('festival dates: 2007-2026, a source on every row, exclusions fixed before any price', () => {
  for (const list of [DHANTERAS, AKSHAYA]) {
    assert.deepEqual(list.map((e) => e.year), Array.from({ length: 20 }, (_, i) => 2007 + i));
    for (const e of list) { assert.equal(e.date.slice(0, 4), String(e.year)); assert.ok(e.src && typeof e.ok === 'boolean'); }
  }
  const D = Object.fromEntries(DHANTERAS.map((e) => [e.year, e.date])), A = Object.fromEntries(AKSHAYA.map((e) => [e.year, e]));
  assert.equal(D[2012], '2012-11-11'); assert.equal(D[2025], '2025-10-18'); assert.equal(D[2026], '2026-11-06');
  assert.equal(A[2013].date, '2013-05-13'); assert.equal(A[2020].date, '2020-04-26'); assert.equal(A[2026].date, '2026-04-19');
  for (const e of DHANTERAS) { const m = +e.date.slice(5, 7); assert.ok(m === 10 || m === 11, e.date); }
  for (const e of AKSHAYA) { const m = +e.date.slice(5, 7); assert.ok(m === 4 || m === 5, e.date); }
  assert.deepEqual(AKSHAYA.filter((e) => !e.ok).map((e) => e.year), [2007, 2008]);
  assert.ok(DHANTERAS.every((e) => e.ok));
  assert.match(PRE, /2007 excluded/); assert.match(PRE, /2008 excluded/);
});

// hand-made weekday daily candles from 2024-09-02 and flat H1 candles inside each day
function days(n, f = (i) => 100 + i) {
  const out = []; let t = Date.UTC(2024, 8, 2) / 1000;
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w >= 1 && w <= 5) { const c = f(out.length); out.push({ time: t, open: c, high: c + 1, low: c - 1, close: c }); } t += 86400; }
  return out;
}
const hours = (d) => d.flatMap((b) => Array.from({ length: 24 }, (_, h) => ({ time: b.time + h * 3600, open: b.close, high: b.close + 0.1, low: b.close - 0.1, close: b.close })));

test('windows: the run-up ends on the trading day before the festival, the post starts on the festival day (weekend: the Friday)', () => {
  const b = days(80);
  const w = festWindows(b, '2024-10-29'); // a Tuesday
  assert.equal(ymdOf(b[w.run[1]].time), '2024-10-28'); assert.equal(w.run[1] - w.run[0], P.RUN);
  assert.equal(ymdOf(b[w.post[0]].time), '2024-10-29'); assert.equal(w.post[1] - w.post[0], P.POST);
  const s = festWindows(b, '2024-10-19'); // a Saturday
  assert.equal(ymdOf(b[s.run[1]].time), '2024-10-18'); assert.equal(ymdOf(b[s.post[0]].time), '2024-10-18');
  assert.equal(lastBefore(b, '2024-10-19'), lastBefore(b, '2024-10-19', true));
  assert.equal(festWindows(b, '2030-01-01').post, undefined); // not covered: left out
});

test('trade: no look-ahead in the stop, H1 stop and gap fills, costs and financing on buys only', () => {
  const b = days(60), h = hours(b);
  const a0 = atr(b, 30);
  assert.equal(atr(b.map((x, i) => (i > 30 ? { ...x, high: x.high + 50 } : x)), 30), a0); // later candles never move the entry ATR
  const t = trade(b, h, 30, 40, 'buy');
  assert.equal(t.kind, 'close'); assert.equal(t.r0, P.STOP_ATR * a0);
  assert.ok(t.grossR > 0 && t.finR > 0 && Math.abs(t.netR - (t.grossR - t.costR - t.finR)) < 1e-12);
  const s = trade(b, h, 30, 40, 'sell');
  assert.equal(s.finR, 0); assert.ok(s.kind !== 'close' || s.grossR < 0);
  // a dip inside day 33 touches a long's stop on H1 only
  const stop = b[30].close - P.STOP_ATR * a0, h2 = h.map((x) => (x.time === b[33].time + 5 * 3600 ? { ...x, low: stop - 0.5 } : x));
  const st = trade(b, h2, 30, 40, 'buy'); assert.equal(st.kind, 'stop'); assert.equal(st.exit, stop); assert.equal(st.exitYmd, ymdOf(b[33].time));
  // an H1 candle opening through the stop fills at its open
  const h3 = h.map((x) => (x.time === b[34].time ? { ...x, open: stop - 2, low: stop - 3 } : x));
  const g = trade(b, h3, 30, 40, 'buy'); assert.equal(g.kind, 'gap'); assert.equal(g.exit, stop - 2);
  // H1 after the exit close never matters
  const h4 = h.map((x) => (x.time >= b[40].time + 86400 ? { ...x, low: 0, open: 0 } : x));
  assert.deepEqual(trade(b, h4, 30, 40, 'buy'), t);
  // 2x cost lowers net R by exactly one cost
  const t2 = trade(b, h, 30, 40, 'buy', 2); assert.ok(Math.abs(t.netR - t2.netR - P.COST / t.r0) < 1e-12);
});

test('statistics helpers', () => {
  assert.ok(Math.abs(pT(2.262, 9) - 0.05) < 0.002);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(tOne([1, 2, 3]) - 3.4641) < 1e-3);
});

test('result.json and RESULT.md agree, verdict follows the pre-registered bar', () => {
  assert.equal(R.study, 'gold-india-festivals');
  for (const k of ['T1', 'T2', 'T3']) {
    const b = R.bar[k], T = R.tests[k];
    assert.equal(b.tOos, T.oos.t >= 2 && T.oos.holmP < 0.05); assert.equal(b.cost2, T.oos.netR2 > 0);
    assert.equal(b.placebo, R.placebo[k].beaten >= 38); assert.equal(R.placebo[k].seedNetR.length, 40);
    assert.equal(b.pass, b.tOos && b.sameSign && b.cost2 && b.placebo);
    assert.equal(R.trades.filter((t) => t.test === k).length, T.all.n);
  }
  assert.equal(R.verdict, Object.values(R.bar).some((x) => x.pass) ? 'PASS' : 'FAIL');
  assert.equal(R.headline, headline(R));
  const vl = MD.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.equal(vl, `**Verdict: ${verdictLine(R)}**`); assert.ok(vl.length <= 220);
  const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) assert.ok(MD.includes(`| ${f(R.tests[k].oos.netR)} | ${R.tests[k].oos.t >= 0 ? '+' : '−'}${Math.abs(R.tests[k].oos.t).toFixed(2)} |`), k);
  assert.deepEqual(R.data.excluded.length, 2);
});
