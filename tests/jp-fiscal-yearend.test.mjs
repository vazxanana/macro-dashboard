// The Japanese fiscal year-end yen seasonal (research/edge/jp-fiscal-yearend): window selection on a hand-made calendar, the stop,
// no look-ahead, financing, the permutation, and the written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prep, t1Window, t2Window, position, yearRows, permP, holm, finPerNight, costOf, PAIRS, ATR_K, MARKUP, dOf }
  from '../research/edge/jp-fiscal-yearend/run.mjs';

const DIR = new URL('../research/edge/jp-fiscal-yearend/', import.meta.url);
const result = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const report = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const RATES = { order: ['usd', 'eur', 'gbp', 'jpy', 'aud', 'nzd', 'cad', 'chf'], monthEnd: {} };
for (let y = 2014; y <= 2016; y++) for (let m = 1; m <= 12; m++) RATES.monthEnd[`${y}-${String(m).padStart(2, '0')}`] = [2, 0, 0, 0, 0, 0, 0, 0];
const day = (s) => new Date(s * 1000).toISOString().slice(0, 10);

// every calendar day (weekends included, as the OANDA file has them) from 1 Dec 2014 to 30 Jun 2015, a flat price with 1.0 range
function calendar(px = () => 100) {
  const rows = []; for (let t = dOf(2014, 11, 1); t <= dOf(2015, 5, 30); t += 86400) { const p = px(t); rows.push([t, p, p + 0.5, p - 0.5, p, 1000]); }
  return rows;
}

test('T1 and T2 windows on a calendar where 1 March and 29 March fall on a Sunday (2015)', () => {
  const bars = prep(calendar());
  assert.ok(bars.every((b) => ![0, 6].includes(new Date(b.time * 1000).getUTCDay())), 'weekends folded away');
  const w1 = t1Window(bars, 2015);
  assert.equal(day(bars[w1.i0].time), '2015-03-02', 'first trading day on/after 1 March');
  assert.equal(day(bars[w1.i1].time), '2015-03-27', 'last trading day on/before 29 March');
  assert.equal(w1.n, 20);
  const w2 = t2Window(bars, 2015);
  assert.equal(day(bars[w2.i0].time), '2015-04-01');
  assert.equal(day(bars[w2.i1].time), '2015-04-14', 'the 10th trading day');
  assert.equal(w2.n, 10);
  // incomplete data: a file ending on 29 March cannot say the window is complete
  const cut = bars.filter((b) => b.time <= dOf(2015, 2, 27));
  assert.equal(t1Window(cut, 2015), null);
  assert.equal(t2Window(bars.filter((b) => b.time <= dOf(2015, 3, 13)), 2015), null);
});

test('the stop: 3 x ATR(20), touched -> -1R at the stop, gapped -> filled at the open', () => {
  const base = prep(calendar()), w = t1Window(base, 2015), risk = ATR_K * 1.0;     // true range 1.0 every day
  const flat = position(base, w.i0, w.i1, -1, PAIRS.usdjpy, RATES, 0);
  assert.equal(flat.risk, risk); assert.equal(flat.how, 'close'); assert.equal(flat.grossR + 0, 0);
  // a short: price climbs 1 a day from the 5th day of the window: the stop (entry + 3) is reached inside the window
  const t5 = base[w.i0 + 4].time;
  const up = prep(calendar((t) => 100 + Math.max(0, Math.round((t - t5) / 86400)))), p = position(up, w.i0, w.i1, -1, PAIRS.usdjpy, RATES, 0);
  assert.equal(p.how, 'stop'); assert.equal(p.exit, 100 + risk); assert.equal(p.grossR, -1);
  assert.ok(p.exitIx < w.i1);
  // a gap through the stop: the day opens 10 above the entry -> filled at that open, worse than -1R
  const gapT = base[w.i0 + 3].time, gap = prep(calendar((t) => (t >= gapT ? 110 : 100))), g = position(gap, w.i0, w.i1, -1, PAIRS.usdjpy, RATES, 0);
  assert.equal(g.how, 'stop'); assert.equal(g.exit, 110); assert.ok(g.grossR < -1);
  // no position without 20 candles before the entry
  assert.equal(position(base, 5, 10, 1, PAIRS.usdjpy, RATES), null);
});

test('no look-ahead: candles after the exit change nothing; the ATR reads only candles before the entry', () => {
  const bars = prep(calendar()), w = t2Window(bars, 2015), a = position(bars, w.i0, w.i1, 1, PAIRS.usdjpy, RATES);
  const later = bars.map((b, i) => (i > w.i1 ? { ...b, open: 1, high: 999, low: 0.5, close: 2 } : b));
  assert.deepEqual(position(later, w.i0, w.i1, 1, PAIRS.usdjpy, RATES), a);
  const inside = bars.map((b, i) => (i === w.i0 + 2 ? { ...b, high: b.high + 0.4 } : b));
  assert.equal(position(inside, w.i0, w.i1, 1, PAIRS.usdjpy, RATES).risk, a.risk, 'a candle inside the window does not move the stop');
});

test('costs and financing: short USD/JPY pays the rate gap plus the markup, long receives the gap less the markup', () => {
  const r = { order: RATES.order, monthEnd: { '2015-02': [5, 0, 0, 1, 0, 0, 0, 0] } }, t = dOf(2015, 2, 2);
  assert.ok(Math.abs(finPerNight(PAIRS.usdjpy, -1, t, r) - (-(4) - MARKUP) / 100 / 365) < 1e-15);
  assert.ok(Math.abs(finPerNight(PAIRS.usdjpy, 1, t, r) - (4 - MARKUP) / 100 / 365) < 1e-15);
  assert.ok(Math.abs(costOf(PAIRS.usdjpy, 100) - (0.6 * 0.01 + 2 * 22.5e-6 * 100)) < 1e-12);
  const bars = prep(calendar()), w = t1Window(bars, 2015);
  const z = position(bars, w.i0, w.i1, -1, PAIRS.usdjpy, RATES, 0), b = position(bars, w.i0, w.i1, -1, PAIRS.usdjpy, RATES, 1), x2 = position(bars, w.i0, w.i1, -1, PAIRS.usdjpy, RATES, 2);
  assert.equal(z.netR, z.grossR); assert.ok(b.netR < z.netR); assert.ok(Math.abs((x2.grossR - x2.netR) - 2 * (b.grossR - b.netR)) < 1e-12);
  assert.ok(b.nights >= 26 && b.nights <= 30);
});

test('comparison set: same length, every other trading day of the year, no shared day; permutation and Holm', () => {
  const bars = prep(calendar((t) => 100 + 3 * Math.sin(t / 86400 / 7))), rows = yearRows(bars, PAIRS.usdjpy, RATES, -1, t1Window);
  const r = rows.find((x) => x.y === 2015);
  assert.ok(r.comps.length > 50);
  assert.ok(r.comps.every((c) => c.k !== r.k && (c.k + r.n - 1 < r.k || c.k > r.k + r.n - 1)));
  const fake = [{ pos: { netR: 1 }, comps: [{ r: 0 }, { r: 0 }] }, { pos: { netR: 1 }, comps: [{ r: 0 }, { r: 2 }] }];
  const P = permP(fake, 1000, 7);                                   // S = 1; a draw reaches 1 only when year 2 draws 2: half
  assert.ok(P.p > 0.4 && P.p < 0.6);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
});

test('result.json is consistent with itself', () => {
  for (const T of ['T1', 'T2']) {
    const dec = result.years[T].filter((r) => r.y >= 2016 && r.y <= 2026), rep = result.years[T].filter((r) => r.y >= 2005 && r.y <= 2015);
    assert.equal(dec.length, 11); assert.equal(rep.length, 11);
    const m = (a) => a.reduce((x, y) => x + y.netR, 0) / a.length;
    assert.ok(Math.abs(m(dec) - result.tests[T].decisive.meanNetR) < 0.002);
    assert.ok(Math.abs(m(rep) - result.tests[T].replication.meanNetR) < 0.002);
    assert.equal(dec.filter((r) => r.netR > 0).length, result.tests[T].decisive.won);
    assert.ok(result.years[T].every((r) => r.how === 'close' ? r.grossR > -1 - 1e-9 : r.grossR <= -1 + 1e-9), 'a stopped year loses 1R or more before costs');
    assert.equal(result.costLevels[T].base.decNetR, result.tests[T].decisive.meanNetR);
    const b = result.pass[T]; assert.equal(b.pass, b.bothWindows && b.holm);
  }
  const ps = holm([result.tests.T1.decisive.permP, result.tests.T2.decisive.permP]);
  assert.ok(Math.abs(ps[0] - result.holm.T1) < 1e-4 && Math.abs(ps[1] - result.holm.T2) < 1e-4);
  const n = ['T1', 'T2'].filter((k) => result.pass[k].pass).length;
  assert.equal(result.verdict, n === 2 ? 'PASS' : n ? 'PARTIAL' : 'FAIL');
  assert.equal(result.placebo.T1.runs.length, 40); assert.equal(result.placebo.T2.runs.length, 40);
});

test('RESULT.md opens with the verdict and quotes result.json', () => {
  const first = report.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(first && first.includes(result.verdict));
  assert.ok(report.indexOf('**Verdict') < report.indexOf('\n## '), 'verdict line before the first section');
  const sg = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(3);
  for (const T of ['T1', 'T2']) {
    const d = result.tests[T].decisive, r = result.tests[T].replication;
    for (const x of [d.meanNetR, d.meanGrossR, r.meanNetR, r.meanGrossR]) assert.ok(report.includes(sg(x)), `${T}: ${sg(x)} in RESULT.md`);
    assert.ok(report.includes(String(d.permP)), `${T} permutation p`);
    assert.ok(report.includes(`${d.offsetRank} of ${d.offsetOf}`), `${T} offset rank`);
    assert.ok(report.includes(`${result.placebo[T].wouldPass} of 40`), `${T} placebo`);
    for (const y of result.years[T]) assert.ok(report.includes(`| ${y.y} |`), `${T} year ${y.y}`);
  }
});
