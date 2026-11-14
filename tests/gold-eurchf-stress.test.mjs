// research/edge/gold-eurchf-stress: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAY, RT, weekRows, sideOf, entryIndex, tradeAt, simulate, holm, normP, monthly, placeboDays, rng,
} from '../research/edge/gold-eurchf-stress/run.mjs';

const DIR = new URL('../research/edge/gold-eurchf-stress/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
function bars(n, fn, skip = () => false) {
  const out = []; let d = T0, i = 0;
  while (out.length < n) {
    const wd = new Date(d * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6 && !skip(d)) { const c = fn(i++); out.push({ time: d, open: c, high: c + 1, low: c - 1, close: c }); }
    d += DAY;
  }
  return out;
}

test('signal: EUR/CHF 20-close return on gold\'s last day of the week; the same day stamp or no signal', () => {
  const g = bars(60, (i) => 100 + i), f = bars(60, (i) => 1.1 * (1 - 0.002 * i), (d) => d === T0 + 32 * DAY);   // fx missing a Friday
  const rows = weekRows(g, f);
  assert.ok(rows.every((x) => new Date(x.t * 1000).getUTCDay() === 5));
  assert.ok(!rows.some((x) => x.t === T0 + 32 * DAY), 'unaligned week dropped');
  const r = rows[rows.length - 1], k = f.findIndex((b) => b.time === r.t);
  assert.ok(Math.abs(r.r - (f[k].close / f[k - 20].close - 1)) < 1e-12);
  assert.ok(r.r < -0.02 && sideOf(r.r) === 1, 'franc bid by more than 2 % -> long gold');
  assert.equal(sideOf(0.02), -1); assert.equal(sideOf(-0.02), 1); assert.equal(sideOf(0.0199), 0); assert.equal(sideOf(-0.0199), 0);
});

test('no look-ahead: changing every price after a week never changes that week\'s row', () => {
  const g = bars(80, (i) => 100 + Math.sin(i)), f1 = bars(80, (i) => 1.1 + 0.01 * Math.cos(i)), f2 = f1.map((b, i) => (i > 50 ? { ...b, close: b.close * 1.3 } : b));
  const cut = f1[50].time, a = weekRows(g, f1).filter((x) => x.t <= cut), b = weekRows(g, f2).filter((x) => x.t <= cut);
  assert.deepEqual(a, b);
  // the entry is on a strictly later day
  assert.equal(entryIndex(g, g[30].time), 31);
});

test('trade: stop 2 x ATR(20) of earlier candles, 20-candle hold, costs, financing on longs only, one at a time', () => {
  const g = bars(80, () => 100);   // true range 2 -> ATR 2, risk 4
  const L = tradeAt(g, 26, 1), S = tradeAt(g, 26, -1);
  assert.equal(L.risk, 4); assert.equal(L.stop, 96); assert.equal(S.stop, 104);
  assert.equal(L.k, 45, 'out at the close of the 20th candle');
  assert.equal(L.gross, 0); assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(S.net + RT / 4) < 1e-12);
  const g2 = bars(80, (i) => (i === 30 ? 90 : 100)); g2[30].open = 90;
  const x = tradeAt(g2, 26, 1);
  assert.equal(x.kind, 'gap'); assert.equal(x.exit, 90);
  const tr = simulate([{ t: g[25].time, s: 1 }, { t: g[30].time, s: -1 }, { t: g[50].time, s: 1 }], g);
  assert.equal(tr.length, 2, 'a signal while a trade is open is skipped');
});

test('statistics: Holm, the one-sided p, month sums with empty months, a seeded placebo keeps the side mix', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((p) => +p.toFixed(3)), [0.03, 0.08, 0.5]);
  assert.ok(Math.abs(normP(1.96) - 0.025) < 0.001);
  const m = monthly([{ c: Date.UTC(2020, 0, 10) / 1000, net: 1 }, { c: Date.UTC(2020, 2, 10) / 1000, net: 1 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'net');
  assert.equal(m.months, 3); assert.equal(m.sum, 2);
  const el = Array.from({ length: 50 }, (_, i) => ({ t: i })), sides = [1, 1, -1];
  const a = placeboDays(el, sides, rng(7)), b = placeboDays(el, sides, rng(7));
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((d) => d.s).sort(), [-1, 1, 1]);
});

test('report: the verdict line and tables agree with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.ok(r.tests.every((t) => !t.pass));
  const line = md.match(/\*\*Verdict: (.+?)\*\*/)[1];
  assert.ok(line.length < 220 && line.startsWith('FAIL, 0 of 3'));
  const [t1, t2, t3] = r.tests, mn = (x) => (x < 0 ? '−' + (-x).toFixed(3) : '+' + x.toFixed(3));
  assert.ok(line.includes(`${mn(t1.oos.net)}R`) && line.includes(`n ${t1.oos.n}`) && line.includes(`month t ${String(t1.oos.tMonth).replace('-', '−')}`));
  assert.ok(md.includes(`**${t1.oos.n} (${t1.oos.long} / ${t1.oos.short})**`));
  for (const [t, w] of [[t1, 'is'], [t2, 'is'], [t2, 'oos'], [t3, 'is'], [t3, 'oos']]) {
    assert.ok(md.includes(`| ${mn(t[w].net)} | ${mn(t[w].x2)} |`), `${t.id} ${w} net / x2`);
  }
  for (const t of r.tests) assert.ok(md.includes(`| ${t.placebo.below} of 40 |`), `${t.id} placebo`);
  const [bl, bs, bo] = r.baselines;
  assert.ok(md.includes(`| ${mn(bl.oos.net)} (${bl.oos.tMonth >= 0 ? '+' : '−'}${Math.abs(bl.oos.tMonth).toFixed(2)}) | ${bl.oos.n} |`));
  assert.ok(md.includes(`| ${mn(bs.oos.net)} (−${Math.abs(bs.oos.tMonth).toFixed(2)}) | ${bs.oos.n} |`));
  assert.ok(md.includes(`| ${mn(bo.oos.net)} (+${bo.oos.tMonth.toFixed(2)}) | ${bo.oos.n} |`));
  assert.equal(t1.placebo.seeds, 40);
  assert.ok(t1.oos.medianStop >= 10 && t1.is.medianStop >= 10, 'median stop $10 or more');
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('decision 44'));
});
