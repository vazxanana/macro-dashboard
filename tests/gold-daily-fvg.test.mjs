// Gold's daily three-candle gap, traded on its first retest (research/edge/gold-daily-fvg): the rule on hand-made candles,
// no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { atrAt, gapAt, gaps, retest, manage, marketTrade, oneAtATime, monthT, holm, report, P } from '../research/edge/gold-daily-fvg/run.mjs';

const H = 3600;
// flat days of range 20 around 1000
const flat = (n) => Array.from({ length: n }, (_, i) => ({ d: i, t: i * 24 * H, open: 1000, high: 1010, low: 990, close: 1000 }));

test('a bullish gap needs the low above the high of two days earlier by 0.25 ATR; the mirror is a sell', () => {
  const ds = flat(20); assert.equal(atrAt(ds, 16), 20);
  ds[17] = { ...ds[17], high: 1040, low: 1000, close: 1035 }; ds[18] = { ...ds[18], open: 1035, high: 1050, low: 1016, close: 1045 };
  const g = gapAt(ds, 18); assert.equal(g.side, 1); assert.equal(g.top, 1016); assert.equal(g.bottom, 1010);
  const small = ds.map((x) => ({ ...x })); small[18].low = 1012; assert.equal(gapAt(small, 18), null, 'a 2-dollar gap is under 0.25 ATR');
  const dn = flat(20); dn[17] = { ...dn[17], high: 1000, low: 960 }; dn[18] = { ...dn[18], high: 984, low: 950 };
  const s = gapAt(dn, 18); assert.equal(s.side, -1); assert.equal(s.bottom, 984); assert.equal(s.top, 990);
  // no look-ahead: changing a later day leaves the gap of day 18 unchanged
  const later = ds.map((x) => ({ ...x })); later[19] = { ...later[19], high: 5000, low: 1 };
  assert.deepEqual(gapAt(later, 18), g); assert.deepEqual(gaps(later).filter((x) => x.i <= 18), gaps(ds).filter((x) => x.i <= 18));
});

test('the first retest fills a limit with a stop past the gap, a 2R target, and stop first on the fill candle', () => {
  // 40 days, one H1 candle each (day j's candle is index j)
  const ds = flat(40), h1 = ds.map((x) => ({ time: x.t, open: x.open, high: x.high, low: x.low, close: x.close })), rng = ds.map((_, j) => [j, j]);
  const g = { i: 18, side: 1, top: 1016, bottom: 1000, atr: 20, gapAtr: 0.8 };
  // days 19..20 stay above the gap, day 21 dips to 1012: fill at 1016, stop 1000 - 10 = 990, risk 26, target 1068
  for (let j = 19; j < 40; j++) h1[j] = { ...h1[j], open: 1030, high: 1035, low: 1025, close: 1030 };
  h1[21] = { ...h1[21], open: 1030, low: 1012 }; h1[24] = { ...h1[24], high: 1070 };
  const tr = retest(h1, rng, ds, g);
  assert.equal(tr.entry, 1016); assert.equal(tr.stop, 990); assert.equal(tr.risk, 26); assert.equal(tr.how, 'target'); assert.equal(tr.exit, 1068);
  assert.ok(Math.abs(tr.R - 2) < 1e-9 && tr.finR > 0 && tr.costR > 0 && tr.net < tr.R, 'a buy pays spread and financing');
  // a fill candle that also reaches the stop is a stop
  const s = h1.map((b) => ({ ...b })); s[21].low = 985; assert.equal(retest(s, rng, ds, g).how, 'stop');
  // a candle that opens below the stop: no trade
  const d = h1.map((b) => ({ ...b })); d[21] = { ...d[21], open: 980, low: 975 }; assert.equal(retest(d, rng, ds, g).dead, true);
  // risk under $10 is skipped
  assert.equal(retest(h1, rng, ds, { ...g, bottom: 1012, atr: 2 }).skip, true);
  // untouched within 20 days: nothing
  const u = h1.map((b, j) => (j > 18 ? { ...b, low: 1030 } : b)); assert.equal(retest(u, rng, ds, g), null);
  // time exit at the close of the 10th day after the fill
  const t = h1.map((b) => ({ ...b })); t[24].high = 1035; const tt = retest(t, rng, ds, g); assert.equal(tt.how, 'time'); assert.equal(tt.exitT, h1[31].time + H);
});

test('management: an open through the stop fills at the open, both in one candle is a stop; market trades have a stop', () => {
  const h1 = [{ time: 0, open: 100, high: 101, low: 99, close: 100 }, { time: H, open: 90, high: 91, low: 89, close: 90 }];
  assert.deepEqual(manage(h1, 0, 1, 1, 100, 95, 110, false), { exit: 90, exitT: H, how: 'stop' });
  const both = [{ time: 0, open: 100, high: 111, low: 94, close: 100 }];
  assert.equal(manage(both, 0, 0, 1, 100, 95, 110, false).how, 'stop');
  const ds = flat(15), h = ds.map((x) => ({ time: x.t, open: 1000, high: 1001, low: 999, close: 1000 })), rng = ds.map((_, j) => [j, j]);
  const m = marketTrade(h, rng, ds, 1, -1, 20); assert.equal(m.stop, 1020); assert.equal(m.finR, 0); assert.equal(m.how, 'time');
  assert.equal(marketTrade(h, rng, ds, 1, 1, 0), null, 'no stop distance, no trade');
  assert.deepEqual(oneAtATime([{ entryT: 0, exitT: 10 }, { entryT: 5, exitT: 20 }, { entryT: 10, exitT: 30 }]).map((x) => x.entryT), [0, 10]);
});

test('month t counts every month of the window, and Holm adjusts upwards', () => {
  const at = (s) => Date.parse(s) / 1000;
  assert.equal(monthT([{ exitT: at('2020-01-15'), net: 1 }, { exitT: at('2020-03-15'), net: 1 }], ['2020-01-01', '2020-04-30']).months, 4);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-daily-fvg/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-daily-fvg/RESULT.md', import.meta.url), 'utf8');
  assert.equal(md, report(r), 'RESULT.md is written from result.json');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL, 1 of 4 checks: /);
  const head = md.split('\n').find((l) => l.startsWith('**Verdict')); assert.ok(head.length < 220);
  assert.equal(Object.values(r.checks).filter(Boolean).length, 1);
  assert.ok(r.tests.T1.oos.medianStop >= 10 && r.tests.T1.is.medianStop >= 10, 'median stop of at least $10');
  assert.equal(r.params.cost, 0.6); assert.equal(r.placebo.tOOS.length, 40); assert.equal(P.seed, 20261114);
  assert.ok(r.tests.T1.oos.tNet < r.placebo.p95 && !r.checks.placebo);
});
