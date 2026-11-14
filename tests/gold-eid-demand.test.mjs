// research/edge/gold-eid-demand: the fixed Eid dates, the windows, the H1-checked trade and the year baseline on hand-made
// candles (no look-ahead), the statistics helpers, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FITR, ADHA } from '../research/edge/gold-eid-demand/dates.mjs';
import { festWindows, trade, atr, ordinary, baselines, pT, holm, tOne, ymdOf, P, headline, verdictLine } from '../research/edge/gold-eid-demand/run.mjs';

const DIR = new URL('../research/edge/gold-eid-demand/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

test('Eid dates: one of each a year 2007-2026, walking back about 11 days a year, the two 66-72 days apart', () => {
  for (const list of [FITR, ADHA]) {
    assert.deepEqual(list.map((d) => +d.slice(0, 4)), Array.from({ length: 20 }, (_, i) => 2007 + i));
    for (let i = 1; i < list.length; i++) {
      const gap = (Date.parse(list[i]) - Date.parse(list[i - 1])) / 864e5;
      assert.ok(gap >= 351 && gap <= 357, `${list[i]} gap ${gap}`);
    }
  }
  FITR.forEach((d, i) => { const g = (Date.parse(ADHA[i]) - Date.parse(d)) / 864e5; assert.ok(g >= 66 && g <= 72, `${d} ${ADHA[i]}`); });
  assert.equal(FITR.at(-1), '2026-03-20'); assert.equal(ADHA[17], '2024-06-16');
});

function days(n, f = (i) => 100 + i) {
  const out = []; let t = Date.UTC(2024, 0, 2) / 1000;
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w >= 1 && w <= 5) { const c = f(out.length); out.push({ time: t, open: c, high: c + 1, low: c - 1, close: c }); } t += 86400; }
  return out;
}
const hours = (d) => d.flatMap((b) => Array.from({ length: 24 }, (_, h) => ({ time: b.time + h * 3600, open: b.close, high: b.close + 0.1, low: b.close - 0.1, close: b.close })));

test('windows: the run-up ends on the trading day before the Eid, the post starts on the Eid (weekend: the Friday)', () => {
  const b = days(120);
  const w = festWindows(b, '2024-04-10'); // a Wednesday
  assert.equal(ymdOf(b[w.run[1]].time), '2024-04-09'); assert.equal(w.run[1] - w.run[0], P.RUN);
  assert.equal(ymdOf(b[w.post[0]].time), '2024-04-10'); assert.equal(w.post[1] - w.post[0], P.POST);
  const s = festWindows(b, '2024-03-30'); // a Saturday
  assert.equal(ymdOf(b[s.run[1]].time), '2024-03-29'); assert.equal(ymdOf(b[s.post[0]].time), '2024-03-29');
  assert.equal(festWindows(b, '2030-01-01').post, undefined);
});

test('trade and baseline: no look-ahead, H1 stop, costs, financing on buys only, excess removes the drift', () => {
  const b = days(200), h = hours(b);
  const a0 = atr(b, 30);
  assert.equal(atr(b.map((x, i) => (i > 30 ? { ...x, high: x.high + 50 } : x)), 30), a0);
  const t = trade(b, h, 30, 40, 'buy');
  assert.equal(t.kind, 'close'); assert.ok(t.finR > 0 && Math.abs(t.netR - (t.grossR - t.costR - t.finR)) < 1e-12);
  assert.equal(trade(b, h, 30, 40, 'sell').finR, 0);
  const stop = b[30].close - P.STOP_ATR * a0, h2 = h.map((x) => (x.time === b[33].time + 5 * 3600 ? { ...x, low: stop - 0.5 } : x));
  assert.equal(trade(b, h2, 30, 40, 'buy').kind, 'stop');
  const h4 = h.map((x) => (x.time >= b[40].time + 86400 ? { ...x, low: 0, open: 0 } : x));
  assert.deepEqual(trade(b, h4, 30, 40, 'buy'), t);
  // a steady uptrend: every 10-day long of the year makes about the same, so a window's excess is about zero
  const ord = ordinary(b, h, 10, 'buy', new Set(), [2024, 2024]), B = baselines(ord);
  assert.ok(ord.length > 100 && B[2024].n === ord.length);
  assert.ok(Math.abs(t.netR - B[2024].c1) < 0.05);
  // the busy days of a test are left out of its baseline
  const busy = new Set([50, 51, 52]); assert.ok(ordinary(b, h, 10, 'buy', busy, [2024, 2024]).length < ord.length);
  assert.ok(B[2024].c2 < B[2024].c1);
});

test('statistics helpers', () => {
  assert.ok(Math.abs(pT(2.262, 9) - 0.05) < 0.002);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(tOne([1, 2, 3]) - 3.4641) < 1e-3);
});

test('result.json and RESULT.md agree, verdict follows the pre-registered bar', () => {
  assert.equal(R.study, 'gold-eid-demand');
  for (const k of ['T1', 'T2', 'T3']) {
    const b = R.bar[k], T = R.tests[k];
    assert.equal(b.tOos, T.oos.t >= 2 && T.oos.holmP < 0.05); assert.equal(b.cost2, T.oos.netR2 > 0 && T.oos.excessR2 > 0);
    assert.equal(b.placebo, R.placebo[k].beaten >= 38); assert.equal(R.placebo[k].seedExcessR.length, 40);
    assert.equal(b.pass, b.tOos && b.sameSign && b.cost2 && b.placebo);
    assert.equal(R.trades.filter((t) => t.test === k).length, T.all.n);
    for (const t of R.trades.filter((x) => x.test === k)) assert.ok(Math.abs(t.excessR - (t.netR - t.baseR)) < 2e-4);
  }
  assert.equal(R.tests.T1.all.n, 20); assert.equal(R.tests.T3.all.n, 40);
  assert.equal(R.verdict, Object.values(R.bar).some((x) => x.pass) ? 'PASS' : 'FAIL');
  assert.equal(R.headline, headline(R));
  const vl = MD.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.equal(vl, `**Verdict: ${verdictLine(R)}**`); assert.ok(vl.length <= 220);
  const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) assert.ok(MD.includes(`| ${f(R.tests[k].oos.excessR)} | ${R.tests[k].oos.t >= 0 ? '+' : '−'}${Math.abs(R.tests[k].oos.t).toFixed(2)} |`), k);
});
