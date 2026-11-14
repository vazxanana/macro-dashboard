// fx-weekly-reversal study: ranking without look-ahead, the stop, the USD-value conversion, and the report against result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PAIRS, P, SCEN, invertBar, expressed, align, weekEnds, rankAsc, reversal, simLeg, runBook, legNet, monthSums, stats, exitTime, costFrac,
} from '../research/edge/fx-weekly-reversal/run.mjs';

const DAY = 86400, MON = Date.UTC(2024, 0, 1) / 1000; // Monday 1 Jan 2024
const dir = new URL('../research/edge/fx-weekly-reversal/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// weekday times for n weeks
function weekdays(weeks) { const t = []; for (let w = 0; w < weeks; w++) for (let d = 0; d < 5; d++) t.push(MON + (w * 7 + d) * DAY); return t; }
const flat = (times, px) => times.map((time) => ({ time, open: px, high: px * 1.001, low: px * 0.999, close: px }));

test('USD/xxx pairs are inverted into the value of the currency in USD (high from the low)', () => {
  const b = { time: 1, open: 10, high: 12.5, low: 8, close: 11 };
  assert.deepEqual(invertBar(b), { time: 1, open: 0.1, high: 0.125, low: 0.08, close: 1 / 11 });
  assert.deepEqual(expressed([b], false)[0], b);
  // a rising USD/JPY is a falling JPY
  const q = [{ time: 1, open: 100, high: 100, low: 100, close: 100 }, { time: 2, open: 110, high: 110, low: 110, close: 110 }];
  const x = expressed(q, true);
  assert.ok(x[1].close < x[0].close);
  const inv = Object.fromEntries(PAIRS.map((p) => [p.ccy, p.inv]));
  assert.deepEqual(inv, { EUR: false, GBP: false, JPY: true, AUD: false, NZD: false, CAD: true, CHF: true, SEK: true, NOK: true });
  // a cost fraction is the same in quoted and inverted terms (cost R = fraction x expressed entry / expressed distance)
  assert.ok(Math.abs(costFrac(PAIRS[7], 10) - (40 * 0.0001 / 10 + 0.000045)) < 1e-15);
});

test('ranking reads closes up to the decision day only; reversal buys the fallers', () => {
  const times = weekdays(6), ccys = PAIRS.map((p) => p.ccy);
  const X = Object.fromEntries(ccys.map((c, k) => [c, times.map((time, i) => ({ time, open: 1, high: 1, low: 1, close: 1 + (i >= 10 ? (k - 4) * 0.01 : 0) }))]));
  const d = 14; // Friday of week 3
  const r = rankAsc(X, ccys, d, 5);
  assert.deepEqual(reversal(r), { long: ['EUR', 'GBP'], short: ['SEK', 'NOK'] });
  // changing every price after d changes nothing
  const X2 = Object.fromEntries(ccys.map((c) => [c, X[c].map((b, i) => (i > d ? { ...b, close: 50 * Math.random() + 1 } : b))]));
  assert.deepEqual(rankAsc(X2, ccys, d, 5), r);
  // too little history = no ranking; ties broken by list order
  assert.equal(rankAsc(X, ccys, 3, 5), null);
  const T = Object.fromEntries(ccys.map((c) => [c, times.map((time) => ({ time, open: 1, high: 1, low: 1, close: 1 }))]));
  assert.deepEqual(rankAsc(T, ccys, 10, 5), ccys);
  // week ends: the last weekday of each Monday-Sunday week
  assert.deepEqual(weekEnds(times).slice(0, 3), [4, 9, 14]);
});

test('every leg has a stop at 1R; gap fills at the open; a stopped leg is flat to the rebalance', () => {
  const b = (o, h, l, c) => ({ time: 0, open: o, high: h, low: l, close: c });
  const bars = [b(100, 101, 99, 100), b(100, 100.5, 97, 98), b(98, 99, 96, 97)];
  assert.deepEqual(simLeg(bars, 0, 2, 1, 2), { entry: 100, stop: 98, exit: 98, exitIdx: 1, how: 'stop' });
  const gap = [b(100, 101, 99, 100), b(95, 96, 94, 95), b(95, 96, 94, 95)];
  assert.equal(simLeg(gap, 0, 2, 1, 2).exit, 95);
  assert.equal(simLeg(gap, 0, 2, 1, 2).how, 'gap');
  assert.deepEqual(simLeg(bars, 0, 2, -1, 5), { entry: 100, stop: 105, exit: 97, exitIdx: 2, how: 'close' });
  // a stop is always on the losing side, at the ATR distance
  const s = simLeg(bars, 0, 2, -1, 0.5); assert.equal(s.stop, 100.5); assert.equal(s.how, 'stop');
  // a Friday close leaves before the Friday rollover; a stop is charged to mid-candle
  const fri = MON + 4 * DAY;
  assert.equal(exitTime(fri, 'close'), fri + 20 * 3600);
  assert.equal(exitTime(MON, 'close'), MON + DAY);
  assert.equal(exitTime(MON, 'stop'), MON + DAY / 2);
});

test('the book: four legs a week, R = sum / 4, entry next open, exit next week-end', () => {
  const times = weekdays(8), series = PAIRS.map((p, k) => {
    const q = times.map((time, i) => ({ time, open: 1 + k * 0.001 * (i % 3), high: 1.01 + k * 0.001, low: 0.99, close: 1 + k * 0.001 * (i % 3) }));
    return { ccy: p.ccy, q, x: q };
  });
  const D = align(series), weeks = runBook(D, reversal);
  assert.ok(weeks.length >= 3);
  for (const w of weeks) {
    assert.equal(w.legs.length, 4);
    assert.ok(Math.abs(w.net - w.legs.reduce((s, l) => s + legNet(l), 0) / 4) < 1e-12);
    assert.ok(Math.abs(w.gross - w.legs.reduce((s, l) => s + legNet(l, SCEN.gross), 0) / 4) < 1e-12);
    assert.ok(w.x2 <= w.net + 1e-12);
  }
  assert.deepEqual(monthSums([{ exit: '2024-01-05', net: 1 }, { exit: '2024-01-12', net: 2 }, { exit: '2024-02-02', net: -1 }]), [3, -1]);
  assert.equal(stats([1, -1, 1, -1]).mean, 0);
});

test('the report says what result.json says', () => {
  const d = R.primary.decisive, r = R.primary.replication;
  assert.equal(R.verdict, 'FAIL');
  assert.match(MD.split('\n').find((l) => l.startsWith('**Verdict')), /^\*\*Verdict: FAIL, 1 of 5 checks\*\*/);
  assert.equal(Object.values(R.checks).filter(Boolean).length, 1);
  assert.equal(R.params.ATR_MULT, 2); assert.equal(R.params.LOOK, 5); assert.equal(R.placebo.tAll.length, P.SEEDS);
  const m = (v) => v.toFixed(2).replace('-', '−');
  const row = MD.split('\n').find((l) => l.startsWith('| Decisive, 8 Jan 2016'));
  assert.ok(row.includes(`| ${d.weeks} |`) && row.includes(m(d.monthly.net.t)) && row.includes(`${m(d.weekly.net.total)}R`) && row.includes(`${m(d.weekly.net.dd)}R`));
  assert.ok(row.includes(d.weekly.net.mean.toFixed(4).replace('-', '−')));
  const rep = MD.split('\n').find((l) => l.startsWith('| Replication, 9 Jul 2004'));
  assert.ok(rep.includes(`| ${r.weeks} |`) && rep.includes(m(r.monthly.net.t)) && rep.includes(`+${r.weekly.gross.mean.toFixed(4)}`));
  assert.ok(MD.includes(`95th percentile (${m(R.placebo.t.p95)})`) && MD.includes(`beats ${R.placebo.beats} of 40`));
  assert.ok(MD.includes(`2x (trading\n  costs and financing charges doubled, credits at 1x) ${d.weekly.x2.mean.toFixed(4).replace('-', '−')} (t ${m(d.monthly.x2.t)})`));
  assert.ok(MD.includes(`${d.legs.n.toLocaleString('en-US')} legs, ${d.legs.win.toFixed(1)} % won, ${d.legs.stopped} % stopped`));
  const v = R.variants.daily.decisive;
  assert.ok(MD.includes(`| ${v.monthly.gross.t.toFixed(2)} | ${m(v.monthly.net.t)} |`));
  for (const [y, val] of Object.entries(R.primary.years)) assert.ok(MD.includes(`${y} ${val > 0 ? '+' : '−'}${Math.abs(val).toFixed(2)}`), y);
});

test('paper only: the study imports nothing live but the shared fill helpers', () => {
  const src = fs.readFileSync(new URL('run.mjs', dir), 'utf8');
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(imports.sort(), ['../../../council/fills.mjs', 'node:child_process', 'node:fs']);
  assert.ok(!/fetch\(|ctrader|mirror|https?:/.test(src));
});
