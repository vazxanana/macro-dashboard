// Gold after a weekly candle with a long wick (research/edge/gold-weekly-wick): the rule on hand-made candles, no look-ahead,
// and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { weeksOf, wickSide, eligible, signals, signalOf, simulate, oneAtATime, monthT, holm, P } from '../research/edge/gold-weekly-wick/run.mjs';

const H = 3600, D = 86400;
const wkOf = (o, h, l, c, nd = 5) => ({ open: o, high: h, low: l, close: c, nd });

test('a lower wick over 60 % of the range is a buy, an upper wick a sell, anything else nothing', () => {
  assert.equal(wickSide(wkOf(100, 102, 80, 101)), 1, 'lower wick 20 of 22');
  assert.equal(wickSide(wkOf(100, 122, 99, 99.5)), -1, 'upper wick 22 of 23');
  assert.equal(wickSide(wkOf(90, 101, 89, 100)), 0, 'a strong up week has no long wick');
  assert.equal(wickSide(wkOf(100, 106, 94, 100)), 0, 'a doji with two 50 % wicks is neither');
  assert.equal(wickSide(wkOf(100, 100, 100, 100)), 0);
});

test('weeks are Monday-Friday of New York days, and the filter reads only past weeks', () => {
  const mon = Date.UTC(2024, 10, 4) / (D * 1000);   // a Monday (4 Nov 2024)
  const ds = [0, 1, 2, 3, 4, 7, 8].map((k, i) => ({ d: mon + k, open: 10 + i, high: 12 + i, low: 9 + i, close: 11 + i }));
  const w = weeksOf(ds);
  assert.equal(w.length, 2); assert.equal(w[0].nd, 5); assert.equal(w[0].open, 10); assert.equal(w[0].close, 15); assert.equal(w[0].high, 16); assert.equal(w[1].i0, 5);
  // 22 weeks of range 10, then a short week (3 days) and a narrow week: neither eligible; changing a LATER week changes nothing
  const wk = Array.from({ length: 24 }, () => ({ high: 110, low: 100, nd: 5 }));
  wk[21] = { high: 110, low: 100, nd: 3 }; wk[22] = { high: 104, low: 100, nd: 5 };
  const e = eligible(wk);
  assert.ok(e.includes(20) && !e.includes(21) && !e.includes(22) && !e.includes(23), 'the last week has no next week to enter');
  const wk2 = wk.map((x) => ({ ...x })); wk2[23] = { high: 500, low: 0, nd: 5 };
  assert.deepEqual(eligible(wk2).filter((i) => i < 23), e.filter((i) => i < 23));
});

test('a trade enters at the next week\'s first open, stops past the wick, a gap fills at the open, and every trade has a stop', () => {
  const day0 = 20041, t0 = day0 * D - 7 * H;   // first H1 of a New York day
  const ds = Array.from({ length: 12 }, (_, i) => ({ d: day0 + i }));
  const h1 = [], start = new Map();
  ds.forEach((x, i) => { start.set(x.d, h1.length); for (let k = 0; k < 2; k++) h1.push({ time: t0 + i * D + k * H, open: 100 + i, high: 101 + i, low: 99.5 + i, close: 100.5 + i }); });
  const sg = { w: 0, side: 1, day: 0, stop: 95 - P.buf };
  const tr = simulate(h1, start, ds, sg, 10);
  assert.equal(tr.entry, 100); assert.equal(tr.how, 'time'); assert.equal(tr.exit, h1[start.get(ds[10].d) - 1].close);
  assert.ok(tr.risk > 0 && tr.costR > 0 && tr.finR > 0, 'a buy pays the spread and financing');
  // a gap through the stop on day 3 fills at that open
  const g = h1.map((b) => ({ ...b })), k = start.get(ds[3].d); g[k] = { ...g[k], open: 90, low: 89, high: 91 };
  const tg = simulate(g, start, ds, sg, 10); assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 90); assert.ok(tg.R < -1);
  // an entry already past the stop is skipped; a sell pays no financing
  assert.equal(simulate(h1, start, ds, { ...sg, stop: 100.5 }, 10), null);
  const ts = simulate(h1, start, ds, { w: 0, side: -1, day: 0, stop: 130 }, 10); assert.equal(ts.finR, 0); assert.ok(ts.R < 0);
  // signals come with a stop on the losing side of the signal week
  const wk = Array.from({ length: 22 }, (_, i) => ({ open: 100, high: 110, low: 100, close: 105, nd: 5, i0: i * 5 }));
  wk[20] = { open: 108, high: 110, low: 90, close: 109, nd: 5, i0: 100 };
  const S = signals(wk); assert.equal(S.length, 1); assert.deepEqual(S[0], signalOf(wk, 20, 1)); assert.equal(S[0].stop, 90 - P.buf); assert.equal(S[0].day, wk[21].i0);
  // one at a time
  const T = oneAtATime([{ entryT: 0, exitT: 10 }, { entryT: 5, exitT: 20 }, { entryT: 10, exitT: 30 }]); assert.deepEqual(T.map((x) => x.entryT), [0, 10]);
});

test('month t counts every month of the window, and Holm adjusts upwards', () => {
  const at = (s) => Date.parse(s) / 1000;
  const r = monthT([{ exitT: at('2020-01-15'), net: 1 }, { exitT: at('2020-03-15'), net: 1 }], ['2020-01-01', '2020-04-30']);
  assert.equal(r.months, 4);
  const a = holm([0.01, 0.04, 0.03]); assert.deepEqual(a.map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-weekly-wick/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-weekly-wick/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL, 1 of 4 checks/);
  const t1 = r.tests.T1, sg = (x) => (x > 0 ? `+${x.toFixed(3)}` : x.toFixed(3));
  assert.match(md, new RegExp(`2017-26 \\| ${t1.oos.n} \\(${t1.oos.buys} / ${t1.oos.sells}\\) \\| ${sg(t1.oos.gross)} \\| ${sg(t1.oos.net)} \\| ${sg(t1.oos.net2x)} `));
  assert.match(md, new RegExp(`\\| ${t1.oos.tNet.toFixed(2)} \\| ${t1.oos.tGross.toFixed(2)} \\|`));
  assert.ok(md.includes(`month t ${t1.oos.tNet.toFixed(2)}`) && md.includes(`n ${t1.oos.n},`));
  assert.ok(md.includes(`95th percentile (${r.placebo.p95.toFixed(2)})`) && md.includes(`median ${r.placebo.median.toFixed(2)}`));
  assert.equal(Object.values(r.checks).filter(Boolean).length, 1);
  assert.ok(t1.oos.medianStop >= 10 && t1.is.medianStop >= 10, 'median stop of at least $10');
});
