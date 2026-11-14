// research/edge/fx-month-start: the month-start calendar and the two-candle hold on hand-made candles, the placebo, and the
// report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEGS, P, atr, legHold, calendar, monthEvents, midCandidates, spxMonth, placebo, monthSums, sideOf, report, headline } from '../research/edge/fx-month-start/run.mjs';

const DIR = new URL('../research/edge/fx-month-start/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const DAY = 86400;

// flat weekday candles from a start date (UTC), optional overrides by index
function bars(from, n, over = {}) {
  const out = []; let t = Date.UTC(...from) / 1000;
  while (out.length < n) { const wd = new Date(t * 1000).getUTCDay(); if (wd >= 1 && wd <= 5) out.push({ time: t, open: 1.1, high: 1.101, low: 1.099, close: 1.1 }); t += DAY; }
  for (const [i, o] of Object.entries(over)) Object.assign(out[+i], o);
  return out;
}
const allPairs = (b) => Object.fromEntries(LEGS.map((l) => [l.key, b.map((x) => ({ ...x }))]));

test('pre-registration committed with the rules the code uses', () => {
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const s of ['1.5 x ATR(20)', '40 seeds', '38 of the 40', 'learned in sample', 'January 2005 to December 2014', 'month-sums t',
    'UTC daily close', 'Reported only', 'calendar day 8 to 19', 'Day 1 alone', 'SPX500'])
    assert.ok(pre.includes(s), s);
  assert.equal(P.STOP_ATR, 1.5); assert.equal(P.ATR_N, 20); assert.equal(P.SEEDS, 40); assert.equal(P.SEEDS_NEED, 38); assert.equal(P.HOLD, 2);
  assert.deepEqual(P.MID, [8, 19]); assert.equal(P.IS[1], '2014-12-31'); assert.equal(P.OOS[0], '2015-01-01');
});

test('the basket: seven legs, positive = US dollar up', () => {
  assert.deepEqual(LEGS.map((l) => l.key), ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdcad', 'usdchf']);
  assert.deepEqual(LEGS.map((l) => l.usd), [-1, -1, -1, -1, 1, 1, 1]);
});

test('events: the last basket day of a month to the 2nd basket day of the next; a gap in one pair skips the month', () => {
  const b = bars([2020, 0, 1], 70);   // 1 Jan 2020 (Wed) to early April
  const data = allPairs(b), cal = calendar(data);
  const { events } = monthEvents(cal, data);
  assert.deepEqual(events.map((e) => [e.e, e.d1, e.d2]), [
    ['2020-01-31', '2020-02-03', '2020-02-04'],
    ['2020-02-28', '2020-03-02', '2020-03-03'],
    ['2020-03-31', '2020-04-01', '2020-04-02'],
  ]);
  // one pair missing 31 Jan: the basket's last January day is 30 Jan, and the other pairs then have a candle in between
  const d2 = allPairs(b); d2.nzdusd = d2.nzdusd.filter((x) => new Date(x.time * 1000).toISOString().slice(0, 10) !== '2020-01-31');
  const c2 = calendar(d2), ev2 = monthEvents(c2, d2);
  assert.deepEqual(ev2.events.map((e) => e.d1), ['2020-03-02', '2020-04-01']); assert.deepEqual(ev2.skipped, ['2020-02']);
  // mid-month candidates: entry day 8-19 with both exit days in the same month
  const mc = midCandidates(cal, data).get('2020-02');
  assert.equal(mc[0].ymd, '2020-02-10'); assert.equal(mc.at(-1).ymd, '2020-02-19');
});

test('every leg has a 1.5 x ATR stop over the two held candles; a stopped leg pays only the candles it held', () => {
  const leg = LEGS[0];
  assert.ok(Math.abs(atr(bars([2020, 0, 6], 25), 23) - 0.002) < 1e-12);
  const flat = legHold(bars([2020, 0, 6], 25), 22, 2, leg, 1, { swaps: null });
  assert.equal(flat.kind, 'close'); assert.equal(flat.held, 2); assert.equal(flat.gross, 0);
  const wick2 = legHold(bars([2020, 0, 6], 25, { 24: { low: 1.096 } }), 22, 2, leg, 1, { swaps: null });
  assert.equal(wick2.kind, 'stop'); assert.equal(wick2.held, 2); assert.ok(Math.abs(wick2.grossR + 1) < 1e-9);
  const gap1 = legHold(bars([2020, 0, 6], 25, { 23: { open: 1.09, low: 1.085, high: 1.09, close: 1.12 } }), 22, 2, leg, 1, { swaps: null });
  assert.equal(gap1.kind, 'gap'); assert.equal(gap1.held, 1); assert.ok(Math.abs(gap1.gross - (1.09 - 1.1) / 1.1) < 1e-12);
  const short = legHold(bars([2020, 0, 6], 25, { 24: { high: 1.104 } }), 22, 2, leg, -1, { swaps: null });
  assert.equal(short.kind, 'stop');
});

test('costs: one spread + commission round trip, doubled at 2x, none at 0', () => {
  const b = bars([2020, 0, 6], 25), x = (c) => legHold(b, 22, 2, LEGS[0], 1, { swaps: null, costMult: c });
  assert.ok(Math.abs(x(1).cost - (0.3 * 0.0001 / 1.1 + 0.000045)) < 1e-15);
  assert.ok(Math.abs(x(2).cost - 2 * x(1).cost) < 1e-15);
  assert.equal(x(0).cost, 0);
});

test('side learned in sample, the placebo learns its own, month sums, the equity month', () => {
  const mk = (ymd, g, r) => ({ ymd, L1: { gross: g, netR: r }, S1: { gross: -g, netR: -r } });
  assert.equal(sideOf([mk('2010-01-04', -1, 0), mk('2020-01-04', 5, 0)]), -1);   // only in-sample rows choose
  const cands = new Map([['2010-01', [mk('2010-01-12', -1, -1)]], ['2020-01', [mk('2020-01-12', 1, 0.5)]]]);
  const pl = placebo(['2010-01', '2020-01'], cands, 2);
  for (const x of pl) { assert.equal(x.side, -1); assert.equal(x.n, 1); assert.equal(x.meanR, -0.5); }
  assert.equal(monthSums([{ ymd: '2020-01-02', v: 1 }, { ymd: '2020-02-14', v: 4 }], (r) => r.v).months, 2);
  const spx = bars([2020, 0, 1], 45).map((b, i) => ({ ...b, close: 100 + i }));
  // January: from the last December close (none before 1 Jan here) -> null; February: 31 Jan close to 28 Feb close
  assert.equal(spxMonth(spx, '2020-01-31'), null);
  const jan = spx.filter((b) => new Date(b.time * 1000).getUTCMonth() === 0).at(-1).close, feb = spx.find((b) => new Date(b.time * 1000).toISOString().startsWith('2020-02-28')).close;
  assert.ok(Math.abs(spxMonth(spx, '2020-02-28') - (feb / jan - 1)) < 1e-12);
});

test('result.json: verdict follows the pass bar, and RESULT.md is the report of it', () => {
  const po = R.primary.outOfSample, pi = R.primary.inSample, T = R.tests;
  assert.equal(T.T1, po.netR > 0 && po.t >= 2 && po.monthT >= 2);
  assert.equal(T.T2, pi.netR > 0);
  assert.equal(T.T3, po.netR2 > 0);
  assert.equal(T.T4, R.placebo.beaten >= 38);
  assert.equal(R.placebo.seedNetR.length, 40);
  assert.ok(Math.abs(R.placebo.beaten - R.placebo.seedNetR.filter((x) => R.placebo.realNetR > x).length) <= 1);
  assert.equal(R.verdict, T.T1 && T.T2 && T.T3 && T.T4 ? 'PASS' : 'FAIL');
  assert.equal(R.primary.side, pi.grossPctLongUsd >= 0 ? 'long USD' : 'short USD');
  assert.equal(R.verdict, 'FAIL');
  assert.equal(R.headline, headline(R));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(R));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict: '));
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}`));
  assert.ok(R.headline.length < 220, 'headline under 220 characters');
  assert.ok(md.includes('learned in sample and only applied out of sample'));
  // one event a month, entries before exits
  assert.equal(R.trades.length, pi.n + po.n);
  assert.equal(new Set(R.trades.map((t) => t.ymd.slice(0, 7))).size, R.trades.length);
  for (const t of R.trades) { assert.ok(t.entry < t.ymd && t.ymd < t.exit); assert.notEqual(t.entry.slice(0, 7), t.ymd.slice(0, 7)); }
});
