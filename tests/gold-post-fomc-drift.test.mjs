// gold-post-fomc-drift: the rule on hand-made candles, no look-ahead, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signals, trade, excess, holm, monthT, meetings, P } from '../research/edge/gold-post-fomc-drift/run.mjs';

const dir = new URL('../research/edge/gold-post-fomc-drift/', import.meta.url);
const res = JSON.parse(readFileSync(new URL('result.json', dir)));
const report = readFileSync(new URL('RESULT.md', dir), 'utf8');
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// weekdays from Monday 2 Jan 2017, closes from a step list
function make(steps, start = 1483315200) {
  const out = []; let c = 1000, t = start;
  for (const d of steps) {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400;
    const o = c; c += d; out.push({ time: t, open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c }); t += 86400;
  }
  return out;
}

test('meeting list: scheduled days, unscheduled ones never in it', () => {
  const m = meetings();
  assert.ok(m.includes('2007-01-31') && m.includes('2016-12-14') && m.includes('2024-12-18'));
  assert.ok(!m.includes('2008-01-22') && !m.includes('2020-03-15'));
});

test('side = the statement day move; candles after the day do not change the signal', () => {
  const bars = make([...Array(60)].map((_, i) => (i === 40 ? -15 : 1)));
  const day = ymd(bars[40].time);
  const { sigs } = signals(bars, [day], P, []);
  assert.equal(sigs.length, 1); assert.equal(sigs[0].side, -1); assert.equal(sigs[0].i, 40);
  const bumped = bars.map((b, k) => (k > 40 ? { ...b, close: b.close * 3, high: b.high * 3, low: b.low * 0.1, open: b.open * 2 } : b));
  assert.deepEqual(signals(bumped, [day], P, []).sigs[0], sigs[0]);
  // an unscheduled announcement inside the window drops the meeting
  assert.equal(signals(bars, [day], P, [ymd(bars[45].time)]).sigs.length, 0);
});

test('every trade has a stop 2 ATR away; a gap through the stop exits at the open; time exit after 10 candles; buys pay financing', () => {
  const bars = make([...Array(80)].map(() => 2));
  const day = ymd(bars[30].time);
  const s = signals(bars, [day], P, []).sigs[0];
  const t = trade(bars, s, 1);
  assert.ok(t.riskUsd > 0 && Math.abs(t.entry - t.stop - 2 * s.atr) < 1e-6);
  assert.equal(t.why, 'time'); assert.equal(t.x - t.e, P.hold - 1); assert.equal(t.e, s.i + 1);
  assert.ok(t.net < t.gross);
  const sh = trade(bars, s, -1); assert.ok(Math.abs(sh.gross - sh.net - P.cost / sh.riskUsd) < 1e-4);
  const gap = bars.map((b, k) => (k === s.i + 3 ? { ...b, open: t.stop - 50, low: t.stop - 60 } : b));
  const g = trade(gap, s, 1);
  assert.equal(g.why, 'stop'); assert.equal(g.exit, +(t.stop - 50).toFixed(3)); assert.ok(g.gross < -1);
});

test('excess is measured against the same-side baseline of the same window', () => {
  const mk = (side, net) => ({ side, net, entryDay: '2018-02-01', exitDay: '2018-02-10' });
  const ex = excess([mk(1, 1), mk(-1, 0)], [mk(1, 0.5), mk(1, 1.5)], [mk(-1, -1), mk(-1, 1)], 'oos');
  assert.deepEqual(ex.map((t) => t.ex), [0, 0]);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.ok(monthT([{ exitDay: '2020-01-05', net: 1 }, { exitDay: '2020-03-05', net: 1 }], 'net', '2020-01-01', '2020-03') > 0);
});

test('the report matches result.json and the verdict follows the pre-registered bar', () => {
  const { T1, T2 } = res.tests; const F = res.res.F;
  assert.equal(res.verdict, 'FAIL'); assert.equal(T1.pass, false); assert.equal(T2.pass, false);
  assert.ok(T1.t < 2);
  const line = report.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 220 + 14, line.length);
  for (const s of [`n ${F.oos.n}`, `${F.oos.net.toFixed(3)}R`, `month t ${T1.t.toFixed(2)}`, `+${F.is.net.toFixed(3)}R`, `${T1.beaten} of 40`]) assert.ok(line.includes(s), s);
  for (const s of [`+${F.is.gross.toFixed(3)}`, `${F.oos.gross.toFixed(3)}`, `+${res.res.longAll.oos.net.toFixed(3)}`, `+${res.res.fade.oos.net.toFixed(3)}`, `${res.res.F2x.oos.net.toFixed(3)}`, `+${T2.exIs.toFixed(3)}`, `${T2.exOos.toFixed(3)}`]) assert.ok(report.includes(s), s);
  assert.ok(F.oos.stopMedianUsd >= 10 && F.is.stopMedianUsd >= 10);
  assert.equal(res.placebo.length, 40);
  assert.equal(res.trades.length, res.signals);
});
