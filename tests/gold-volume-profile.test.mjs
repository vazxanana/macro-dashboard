// research/edge/gold-volume-profile: the profile and the trade on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toDays, atrAt, profile, openSide, trade, eligible, sideOf, monthSums, holm, TESTS, P } from '../research/edge/gold-volume-profile/run.mjs';
import { FIN } from '../council/fills.mjs';

const H = 3600, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday 00:00 UTC
// n weekdays of 24 flat hourly candles around 1000 (range 990..1010 a day -> ATR 20)
function days(n) {
  const rows = []; let t = T0, k = 0;
  while (k < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) { for (let h = 0; h < 24; h++) rows.push([t + h * H, 1000, h === 5 ? 1010 : 1001, h === 15 ? 990 : 999, 1000, 10]); k++; } t += 86400; }
  return rows;
}

test('the profile: POC at the fullest price, value area grown to 70 % of the volume', () => {
  // one day: low 1000, high 1010; 9 candles parked at 1004..1005 with big volume, one candle across the whole range
  const bars = [[T0, 1000, 1010, 1000, 1005, 10]];
  for (let k = 1; k <= 9; k++) bars.push([T0 + k * H, 1004.5, 1005, 1004, 1004.5, 100]);
  const day = { key: '2024-01-01', bars, open: 1000, high: 1010, low: 1000, close: 1004.5, vol: 910 };
  const pr = profile(day, 25); // bin 1.0
  assert.ok(Math.abs(pr.poc - 1004.5) < 1e-9);
  assert.ok(pr.val <= 1004 && pr.vah >= 1005 && pr.vah - pr.val < 3, JSON.stringify(pr));
  assert.equal(openSide(1006.5, pr), 1); assert.equal(openSide(1002, pr), -1); assert.equal(openSide(1004.5, pr), 0);
  assert.equal(profile({ ...day, vol: 0 }, 25), null);
});

test('T1 fades toward the POC, T2 goes with the open; inside value no trade', () => {
  assert.deepEqual(TESTS.map((t) => [sideOf(t, 1), sideOf(t, -1), sideOf(t, 0)]), [[-1, 1, 0], [1, -1, 0]]);
});

test('no look-ahead: the profile and ATR used on day D do not change with day D or later', () => {
  const rows = days(25), ds = toDays(rows), el = eligible(ds), e = el.at(-1);
  const pr = e.pr, atr = atrAt(ds, e.i - 1);
  const later = rows.map((r) => (r[0] >= Date.parse(ds[e.i].key) / 1000 ? [r[0], 5000, 9000, 1, 7000, 1e6] : r));
  const ds2 = toDays(later), e2 = eligible(ds2).find((x) => x.i === e.i);
  assert.deepEqual(e2.pr, pr); assert.equal(atrAt(ds2, e.i - 1), atr);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry at the day open, 1 x ATR stop, out at the 20:00 candle close, financing on buys only', () => {
  const ds = toDays(days(20)), i = 18;
  const tr = trade(ds, i, 1);
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 980); assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1000);
  assert.ok(Math.abs(tr.costR - 0.03) < 1e-12); assert.equal(tr.nights, 0); assert.equal(tr.finR, 0);
  // a stop touched mid-day, and a gap through it
  const rows = days(20); const d = ds[i].bars[0][0];
  const hit = rows.map((r) => (r[0] === d + 10 * H ? [r[0], 1000, 1001, 975, 990, 10] : r));
  const th = trade(toDays(hit), i, 1); assert.equal(th.why, 'stop'); assert.equal(th.exit, 980); assert.ok(Math.abs(th.R + 1) < 1e-12);
  const gap = rows.map((r) => (r[0] === d + 10 * H ? [r[0], 970, 972, 965, 971, 10] : r));
  const tg = trade(toDays(gap), i, 1); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 970);
  const s = trade(ds, i, -1); assert.equal(s.finR, 0);
  assert.ok(FIN.xau.long > 0);
});

test('weekend hours go to Monday; month sums count empty months; Holm; preregistered parameters', () => {
  const sat = Date.UTC(2024, 0, 6) / 1000, sun = sat + 86400 + 22 * H, mon = sat + 2 * 86400;
  const d = toDays([[sat - 86400 + 12 * H, 1, 2, 0.5, 1.5, 1], [sun, 1.5, 3, 1.4, 1.6, 1], [mon + H, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(d.length, 2); assert.equal(d[1].key, '2024-01-08'); assert.equal(d[1].open, 1.5); assert.equal(d[1].high, 3);
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(P.isFrom, '2007-01-01'); assert.equal(P.oosFrom, '2017-01-01'); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
  assert.equal(P.binDiv, 25); assert.equal(P.va, 0.70); assert.equal(P.stopAtr, 1.0); assert.equal(P.exitHour, 20);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-volume-profile/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-volume-profile/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} `));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), g.is.monthT.toFixed(2), f(g.isExcess.mean), g.isExcess.monthT.toFixed(2),
      String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), g.oos.monthT.toFixed(2), f(g.oosExcess.mean), g.oosExcess.monthT.toFixed(2),
      String(c.holmP), f(g.oos2x.mean), `${g.placebo.beaten} of 40`, c.pass ? 'yes' : 'no']);
  }
  assert.equal(r.verdict, r.gold.passed.length ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
