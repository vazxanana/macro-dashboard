// research/edge/gold-china-holidays: the SGE closure dates, the windows and the trade on hand-made candles (no look-ahead), the
// statistics helpers, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LNY, GOLDEN, DROPPED } from '../research/edge/gold-china-holidays/dates.mjs';
import { windows, trade, atr, lastBefore, pT, holm, tOne, ymdOf, P, headline } from '../research/edge/gold-china-holidays/run.mjs';

const DIR = new URL('../research/edge/gold-china-holidays/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const wd = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();

test('SGE closure dates: every year 2008-2026, weekdays, known examples', () => {
  for (const list of [LNY, GOLDEN]) {
    assert.deepEqual(list.map((e) => e.year), Array.from({ length: 19 }, (_, i) => 2008 + i));
    for (const e of list) {
      assert.ok(wd(e.first) >= 1 && wd(e.first) <= 5, `${e.first} weekday`);
      assert.ok(wd(e.reopen) >= 1 && wd(e.reopen) <= 5, `${e.reopen} weekday`);
      assert.ok(e.reopen > e.first && e.first.slice(0, 4) === String(e.year));
      assert.ok(['notice', 'checked'].includes(e.src) && e.note);
    }
  }
  const L = Object.fromEntries(LNY.map((e) => [e.year, e]));
  assert.deepEqual([L[2024].first, L[2024].reopen], ['2024-02-12', '2024-02-19']); // SGE traded on the eve, 9 Feb
  assert.deepEqual([L[2020].first, L[2020].reopen], ['2020-01-24', '2020-02-03']); // extended closure
  assert.deepEqual([L[2026].first, L[2026].reopen], ['2026-02-16', '2026-02-24']);
  assert.deepEqual([L[2014].first, L[2014].reopen], ['2014-01-31', '2014-02-07']);
  const G = Object.fromEntries(GOLDEN.map((e) => [e.year, e]));
  assert.deepEqual([G[2023].first, G[2023].reopen], ['2023-09-29', '2023-10-09']);
  assert.deepEqual([G[2024].first, G[2024].reopen], ['2024-10-01', '2024-10-08']);
  assert.deepEqual(DROPPED, []);
});

// hand-made weekday candles from 2023-11-01
function bars(n, f = (i) => 100 + i) {
  const out = []; let t = Date.UTC(2023, 10, 1) / 1000;
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w >= 1 && w <= 5) { const c = f(out.length); out.push({ time: t, open: c, high: c + 1, low: c - 1, close: c }); } t += 86400; }
  return out;
}

test('windows: pre ends on the last UTC day before the closure, shut to the day before the reopen, post 5 days', () => {
  const b = bars(120), ev = { first: '2024-02-12', reopen: '2024-02-19' };
  const w = windows(b, ev);
  assert.equal(ymdOf(b[w.pre[1]].time), '2024-02-09');
  assert.equal(w.pre[1] - w.pre[0], P.PRE);
  assert.deepEqual(w.shut, [w.pre[1], lastBefore(b, '2024-02-19')]);
  assert.equal(ymdOf(b[w.shut[1]].time), '2024-02-16');
  assert.equal(ymdOf(b[w.post[1]].time), '2024-02-23');
  assert.equal(w.post[1] - w.post[0], P.POST);
});

test('trade: no look-ahead in the stop, the stop fills, costs and financing', () => {
  const b = bars(60);
  const a0 = atr(b, 30);
  const changed = b.map((x, i) => (i > 30 ? { ...x, high: x.high + 50, low: x.low } : x));
  assert.equal(atr(changed, 30), a0); // later candles never move the entry ATR
  const t = trade(b, 30, 40);
  assert.ok(t.grossR > 0 && t.netR < t.grossR && t.finR > 0 && t.kind === 'close');
  assert.equal(t.r0, P.STOP_ATR * a0);
  // a crash through the stop
  const crash = b.map((x, i) => (i === 33 ? { ...x, open: x.open, low: x.close - 100 } : x));
  const s = trade(crash, 30, 40);
  assert.equal(s.kind, 'stop'); assert.ok(Math.abs(s.grossR + 1) < 1e-9);
  const gap = b.map((x, i) => (i === 33 ? { ...x, open: 50, low: 49, high: 51, close: 50 } : x));
  assert.equal(trade(gap, 30, 40).kind, 'gap');
  assert.ok(trade(b, 30, 40, 2).netR < t.netR);
});

test('statistics helpers', () => {
  assert.ok(Math.abs(pT(2.262, 9) - 0.05) < 0.001);
  assert.ok(Math.abs(pT(0, 9) - 1) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]).map((x) => +x.toFixed(4)), [0.04, 0.09, 0.09, 0.5]);
  assert.ok(Math.abs(tOne([1, 2, 3]) - 2 / (1 / Math.sqrt(3))) < 1e-9);
});

test('RESULT.md agrees with result.json', () => {
  assert.equal(R.study, 'gold-china-holidays');
  assert.ok(['PASS', 'FAIL'].includes(R.verdict));
  assert.equal(R.headline, headline(R));
  assert.ok(R.headline.length < 220);
  const bold = MD.match(/\*\*Verdict: ([^*]+)\*\*/);
  assert.ok(bold && bold[1].startsWith(R.verdict) && bold[1].includes(R.headline.replace(/^(Passes|Fails): /, '')));
  const T1 = R.tests.T1;
  assert.equal(R.bar.tOos, T1.oos.t >= 2 && T1.oos.holmP < 0.05);
  assert.equal(R.verdict === 'PASS', Object.values(R.bar).every(Boolean));
  assert.equal(R.placebo.seedNetR.length, 40);
  assert.equal(R.placebo.beaten, R.placebo.seedNetR.filter((x) => R.placebo.realNetR > x).length);
  for (const k of ['T1', 'T2', 'T3']) assert.equal(R.tests[k].oos.n + R.tests[k].is.n, R.tests[k].all.n);
  assert.ok(MD.includes(`t ${T1.oos.t >= 0 ? '+' : '−'}${Math.abs(T1.oos.t).toFixed(2)}`));
  assert.ok(MD.includes('owner item 44'));
  assert.equal(R.trades.filter((t) => t.kind === 'lny').length, R.tests.T1.all.n + R.tests.T2.all.n + R.tests.T3.all.n);
});
