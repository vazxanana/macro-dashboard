// research/edge/fx-weekday: the pieces of run.mjs on hand-made candles, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEGS, P, welch, holm, pTwo, legDay, finNight, nightsOf, basketDays, basket, scan, monthT, placebo, report, atr } from '../research/edge/fx-weekday/run.mjs';

const DIR = new URL('../research/edge/fx-weekday/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const DAY = 86400;
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday

// weekday candles only, flat at 1.1 with a 0.002 range, the last one as given
function bars(n, last) {
  const out = []; let t = T0;
  while (out.length < n) { const wd = new Date(t * 1000).getUTCDay(); if (wd >= 1 && wd <= 5) out.push({ time: t, open: 1.1, high: 1.101, low: 1.099, close: 1.1 }); t += DAY; }
  if (last) Object.assign(out[out.length - 1], last);
  return out;
}

test('pre-registration committed first and unchanged in its rules', () => {
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const s of ['2 x ATR(20)', 'Holm', '40 seeds', 'Decisive: 4 Jan 2016', 'foldWeekend', 'P1, same sign', 'P3, tradeable']) assert.ok(pre.includes(s), s);
  assert.equal(P.STOP_ATR, 2); assert.equal(P.ATR_N, 20); assert.equal(P.SEEDS, 40); assert.equal(P.DEC[0], '2016-01-04');
});

test('the basket is long USD against six currencies', () => {
  assert.deepEqual(LEGS.map((l) => l.ccy), ['eur', 'gbp', 'aud', 'nzd', 'jpy', 'chf']);
  assert.deepEqual(LEGS.map((l) => l.usd), [-1, -1, -1, -1, 1, 1]);
});

test('every position has a stop: a gap through it fills at the open, a wick at the stop', () => {
  const leg = LEGS[0];
  const b = bars(25), a = atr(b, 23);
  assert.ok(Math.abs(a - 0.002) < 1e-12);
  const gap = bars(25, { open: 1.09, low: 1.08, high: 1.09, close: 1.085 });
  const g = legDay(gap, 24, leg, 1, { swaps: null });
  assert.equal(g.kind, 'gap'); assert.ok(Math.abs(g.gross - (1.09 - 1.1) / 1.1) < 1e-12);
  const wick = bars(25, { open: 1.1, low: 1.09, high: 1.1, close: 1.1 });
  const w = legDay(wick, 24, leg, 1, { swaps: null });
  assert.equal(w.kind, 'stop'); assert.ok(Math.abs(w.grossR + 1) < 1e-9);
  const short = legDay(wick, 24, leg, -1, { swaps: null });
  assert.equal(short.kind, 'close');
});

test('costs: one spread + commission round trip; doubled at 2x', () => {
  const b = bars(25), x1 = legDay(b, 24, LEGS[0], 1, { swaps: null }), x2 = legDay(b, 24, LEGS[0], 1, { swaps: null, costMult: 2 });
  assert.ok(Math.abs(x1.cost - (0.3 * 0.0001 / 1.1 + 0.000045)) < 1e-15);
  assert.ok(Math.abs(x2.cost - 2 * x1.cost) < 1e-15);
  const jpy = LEGS.find((l) => l.ccy === 'jpy');
  const bj = bars(25).map((x) => ({ ...x, open: 110, high: 110.1, low: 109.9, close: 110 }));
  assert.ok(Math.abs(legDay(bj, 24, jpy, 1, { swaps: null }).cost - (0.3 * 0.01 / 110 + 0.000045)) < 1e-15);
});

test('financing: broker swaps by side, the rate gap less the markup, three nights on Wednesday', () => {
  const sw = { symbols: { EURUSD: { long: -0.6, short: 0.2, pipPosition: 4 } } };
  assert.ok(Math.abs(finNight(LEGS[0], -1, 1, '2020-01-01', { swaps: sw }).frac - 0.00002) < 1e-15);
  assert.equal(finNight(LEGS[0], 1, 1, '2020-01-01', { swaps: sw }).src, 'broker');
  const rates = { decisions: { usd: { from: ['2000-01-01', 5], changes: [] }, jpy: { from: ['2000-01-01', 0], changes: [] } } };
  const jpy = LEGS.find((l) => l.ccy === 'jpy');
  assert.ok(Math.abs(finNight(jpy, 1, 110, '2020-01-01', { swaps: null, rates }).frac - (5 - 1) / 100 / 365) < 1e-15);
  assert.ok(Math.abs(finNight(jpy, -1, 110, '2020-01-01', { swaps: null, rates }).frac - (-5 - 1) / 100 / 365) < 1e-15);
  assert.equal(nightsOf(Date.UTC(2020, 0, 8) / 1000), 3);
  assert.equal(nightsOf(Date.UTC(2020, 0, 9) / 1000), 1);
  assert.equal(R.financing.source.eur, 'broker'); assert.equal(R.financing.source.chf, 'broker');
  assert.equal(R.financing.source.nzd, 'rates'); assert.equal(R.financing.source.jpy, 'rates');
});

test('basket days need all six pairs with the same previous candle', () => {
  const data = Object.fromEntries(LEGS.map((l) => [l.key, bars(30)]));
  const base = basketDays(data);
  assert.equal(base.days.length, 30 - P.ATR_N - 1);
  data.usdjpy = data.usdjpy.filter((_, i) => i !== 25);
  const b = basketDays(data);
  assert.equal(b.days.length, 30 - P.ATR_N - 1 - 2); assert.equal(b.skipped - base.skipped, 2);
  const one = basket(Object.fromEntries(LEGS.map((l) => [l.key, bars(30)])), basketDays(Object.fromEntries(LEGS.map((l) => [l.key, bars(30)]))).days[0], 1, { swaps: null });
  assert.equal(one.legs.length, 6); assert.equal(one.gross, 0);
});

test('statistics: Welch, Holm, two-sided p, month t, placebo deterministic', () => {
  const w = welch([1, 2, 3, 4], [0, 1, 0, 1]);
  assert.ok(Math.abs(w.diff - 2) < 1e-12); assert.ok(Math.abs(w.t - 2 / Math.sqrt((5 / 3) / 4 + (1 / 3) / 4)) < 1e-12);
  assert.ok(Math.abs(pTwo(1.959964) - 0.05) < 1e-4);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const rows = []; for (let i = 0; i < 200; i++) rows.push({ ymd: `2020-${String(1 + (i % 12)).padStart(2, '0')}-01`, wd: 1 + (i % 5), g: Math.sin(i) });
  assert.equal(scan(rows).length, 5);
  assert.ok(monthT(rows, 1).months > 0);
  assert.deepEqual(placebo(rows, 3), placebo(rows, 3));
});

test('result.json: verdict follows the pass bar, and the report says it', () => {
  assert.equal(R.weekdays.length, 5);
  for (const w of R.weekdays) {
    assert.equal(w.checks.p2, w.decisive.holmP < 0.05);
    assert.equal(w.checks.p3, w.decisive.netRSide > 0);
    assert.equal(w.checks.p1, w.decisive.netPctSide > 0 && w.replication.netPctSide > 0);
    assert.equal(w.pass, w.checks.p1 && w.checks.p2 && w.checks.p3);
    assert.ok(w.decisive.n > 400 && w.replication.n > 400);
  }
  assert.equal(R.verdict, R.weekdays.some((w) => w.pass) ? 'PASS' : 'FAIL');
  assert.equal(R.placebo.seedMaxAbsT.length, 40);
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(R));
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
});
