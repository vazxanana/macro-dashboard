// activity-xs: the weekly activity cross-section on hand-made candles, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MARKETS, P, foldWeekendV, rowsToBars, indexMarket, abnormal, amihud, rankAt, thirds, leg, runBook, weekOf, holm, pOf,
  monthSums, report,
} from '../research/edge/activity-xs/run.mjs';

const DAY = 86400, MON = Date.UTC(2010, 0, 4) / 1000; // a Monday
// weekday candles only: n weeks of Mon-Fri, price path from f(i), quote count from g(i)
function bars(nWeeks, f, g) {
  const out = []; let i = 0;
  for (let w = 0; w < nWeeks; w++) for (let d = 0; d < 5; d++) { const t = MON + (w * 7 + d) * DAY, c = f(i); out.push({ time: t, open: c, high: c + 1, low: c - 1, close: c, v: g(i) }); i++; }
  return out;
}

test('weekend stubs fold into Monday with their quote count', () => {
  const sat = MON - 2 * DAY, rows = [[sat, 10, 12, 9, 11, 5], [sat + DAY, 11, 13, 8, 12, 7], [MON, 12, 14, 11, 13, 100]];
  const b = foldWeekendV(rowsToBars(rows));
  assert.equal(b.length, 1);
  assert.deepEqual([b[0].open, b[0].high, b[0].low, b[0].close, b[0].v], [10, 14, 8, 13, 112]);
});

test('measure (b) = 20-candle mean / 250-candle mean; (a) = mean |log return| / v; both need 250 candles and v >= 10', () => {
  const b = bars(60, (i) => 100 + i, (i) => (i >= 280 ? 300 : 100));
  assert.equal(abnormal(b, 248), null);
  const d = 299; // last 20 at 300, previous 230 at 100
  assert.ok(Math.abs(abnormal(b, d) - 300 / ((230 * 100 + 20 * 300) / 250)) < 1e-12);
  let s = 0; for (let i = d - 19; i <= d; i++) s += Math.abs(Math.log(b[i].close / b[i - 1].close)) / b[i].v;
  assert.ok(Math.abs(amihud(b, d) - s / 20) < 1e-15);
  const z = b.map((x, i) => (i === 100 ? { ...x, v: 5 } : x));
  assert.equal(abnormal(z, d), null); // a placeholder inside the window gives no measure
});

test('no look-ahead: changing candles after the signal day leaves the measures and the ranking unchanged', () => {
  const mk = (k, s) => indexMarket(k, bars(60, (i) => 100 + Math.sin(i * s) * 5, (i) => 50 + ((i * (s * 37 + 3)) % 40)));
  const mks = MARKETS.slice(0, 10).map((k, j) => mk(k, 0.1 + j * 0.07));
  const W = weekOf(mks[0].bars[270].time);
  const before = [rankAt(mks, W, abnormal), rankAt(mks, W, amihud)];
  const changed = mks.map((m) => { const d = m.last.get(W); return indexMarket(m.key, m.bars.map((b, i) => (i > d ? { ...b, close: b.close * 3, v: b.v * 50 } : b))); });
  assert.deepEqual([rankAt(changed, W, abnormal), rankAt(changed, W, amihud)], before);
});

test('thirds, a stop on the losing side at 3 x ATR, gap and stop fills', () => {
  assert.deepEqual(thirds(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']), { long: ['a', 'b', 'c'], short: ['h', 'i', 'j'] });
  const b = bars(60, () => 100, () => 50); // flat: true range 2, ATR 2, stop distance 6
  const m = indexMarket('spx500', b), W = weekOf(b[270].time);
  const L = leg(m, W, 1);
  assert.equal(L.how, 'close'); assert.equal(L.gross, 0);
  assert.ok(Math.abs(L.costR - (P.COST_FRAC * 100) / 6) < 1e-12);
  const e = m.first.get(W + 7 * DAY), crash = b.map((x, i) => (i === e + 1 ? { ...x, open: 90, low: 89, close: 90 } : x));
  const G = leg(indexMarket('spx500', crash), W, 1);
  assert.equal(G.how, 'gap'); assert.ok(Math.abs(G.gross - (90 - 100) / 6) < 1e-12);
  const S = leg(indexMarket('spx500', crash), W, -1);
  assert.equal(S.how, 'close');
});

test('the book ranks high activity long and low activity short, booked in the holding week\'s month', () => {
  const mks = MARKETS.slice(0, 9).map((k, j) => indexMarket(k, bars(60, (i) => 100 + i * 0.01, (i) => (i >= 280 ? 100 + j * 50 : 100))));
  const W = weekOf(mks[0].bars[284].time), book = runBook(mks, abnormal, { weeks: [W] });
  assert.equal(book.length, 1);
  assert.deepEqual(book[0].long, ['ch20', 'eu50', 'fr40']);
  assert.deepEqual(book[0].short, ['us30', 'nas100', 'spx500']);
  assert.equal(book[0].month, new Date((W + 7 * DAY) * 1000).toISOString().slice(0, 7));
  const sums = monthSums(book, { from: '2000-01', to: book[0].month });
  assert.equal(sums.length, 1);
});

test('Holm and the p approximation', () => {
  assert.ok(Math.abs(pOf(1.96) - 0.05) < 0.001);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(holm([0.04, 0.01]), [0.04, 0.02]);
});

test('RESULT.md is report(result.json), the verdict follows the pre-registered bar, the headline is short', () => {
  const dir = new URL('../research/edge/activity-xs/', import.meta.url);
  const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  assert.equal(fs.readFileSync(new URL('RESULT.md', dir), 'utf8'), report(R));
  const T1 = R.tests.T1;
  const pass = T1.oos.net.t >= 2 && T1.holmP <= 0.05 && T1.is.net.mean > 0 && T1.oos.net2x.mean > 0;
  assert.equal(R.verdict, pass ? 'PASS' : 'FAIL');
  assert.deepEqual(R.universe, MARKETS);
  assert.equal(MARKETS.length, 14);
  const line = report(R).split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 220, line);
  assert.ok(fs.existsSync(new URL('PREREGISTRATION.md', dir)));
});
