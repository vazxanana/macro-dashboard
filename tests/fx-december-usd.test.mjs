// The year-end US dollar seasonal study: the pieces on hand-made candles (offline), and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAIRS, prep, firstOnOrAfter, decWindow, janWindow, position, costOf, finPerNight, yearly, oneSample, holm, pUpper, placebo } from '../research/edge/fx-december-usd/run.mjs';
import { nights } from '../council/fills.mjs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const day = (y, m, d) => Date.UTC(y, m, d) / 1000;
const EUR = PAIRS.find((p) => p.k === 'eurusd'), JPY = PAIRS.find((p) => p.k === 'usdjpy');
const F0 = { swap: { EURUSD: { long: 0, short: 0 }, GBPUSD: { long: 0, short: 0 }, AUDUSD: { long: 0, short: 0 }, USDCHF: { long: 0, short: 0 } },
  rates: { order: ['usd', 'eur', 'gbp', 'jpy', 'aud', 'nzd', 'cad', 'chf'], monthEnd: { '2010-01': [0, 0, 0, 0, 0, 0, 0, 0] } } };
// weekday candles (plus a Sunday stub each week) from a start date, price from f(t)
function candles(from, to, f, wiggle = 0.001) {
  const out = [];
  for (let t = from; t < to; t += 86400) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue;
    const c = f(t), o = f(t - 86400); out.push([t, o, Math.max(o, c) + wiggle, Math.min(o, c) - wiggle, c, 100]); }
  return out;
}

test('basket: four pairs long, USD/JPY and USD/CHF short', () => {
  assert.deepEqual(PAIRS.map((p) => [p.sym, p.side]), [['EURUSD', 1], ['GBPUSD', 1], ['AUDUSD', 1], ['NZDUSD', 1], ['USDJPY', -1], ['USDCHF', -1]]);
});

test('prep: rows before 2005 dropped, weekends folded; windows from the calendar', () => {
  const bars = prep(candles(day(2004, 11, 1), day(2007, 1, 1), () => 1.2));
  assert.ok(bars[0].time >= day(2005, 0, 1));
  assert.ok(bars.every((b) => ![0, 6].includes(new Date(b.time * 1000).getUTCDay())));
  const w = decWindow(bars, 2005), d0 = new Date(bars[w.i0].time * 1000), d1 = new Date(bars[w.i1].time * 1000);
  assert.equal(d0.getUTCMonth(), 11); assert.ok(d0.getUTCDate() >= 15 && d0.getUTCDate() <= 17);
  assert.equal(d1.getUTCMonth(), 11); assert.ok(d1.getUTCDate() >= 29);
  assert.equal(bars[w.i1 + 1].time >= day(2006, 0, 1), true);
  assert.equal(decWindow(bars, 2007), null, 'no candle after December: incomplete');
  const j = janWindow(bars, 2006); assert.equal(j.n, 10); assert.equal(new Date(bars[j.i0].time * 1000).getUTCMonth(), 0);
  assert.equal(firstOnOrAfter(bars, bars[5].time), 5); assert.equal(firstOnOrAfter(bars, bars[5].time + 1), 6);
});

test('position: costs of the raw-spread model, 3 x ATR stop, financing per night', () => {
  const bars = prep(candles(day(2005, 0, 1), day(2005, 3, 1), () => 1.25, 0.001));
  const i0 = 30, i1 = 39, p = position(bars, i0, i1, 1, EUR, F0);
  assert.ok(Math.abs(p.cost - ((0.3 + 0.3) * 1e-4 / 1.25 + 45e-6)) < 1e-15);
  assert.equal(p.gross, 0); assert.equal(p.how, 'close'); assert.equal(p.fin, 0);
  assert.equal(position(bars, 5, 10, 1, EUR, F0), null, 'no 20 candles before: no position');
  assert.ok(Math.abs(costOf(JPY, 150) - (0.6 * 0.01 / 150 + 45e-6)) < 1e-15);
  // a swap of -1 pip a lot a night on a long charges nights x 1e-4 / entry
  const F1 = { ...F0, swap: { ...F0.swap, EURUSD: { long: -1, short: 0.5 } } }, q = position(bars, i0, i1, 1, EUR, F1);
  assert.ok(q.nights >= 12 && q.nights <= 16, String(q.nights));
  assert.ok(Math.abs(q.fin - (-q.nights * 1e-4 / 1.25)) < 1e-15);
  assert.ok(Math.abs(position(bars, i0, i1, 1, EUR, F1, { cost: 2, fin: 2 }).ret - 2 * q.ret) < 1e-15);
  // the policy-rate differential for a pair the broker file lacks: short USD/JPY earns jpy - usd
  const R = { order: F0.rates.order, monthEnd: { '2010-01': [5, 0, 0, 1, 0, 0, 0, 0] } };
  assert.ok(Math.abs(finPerNight(JPY, -1, 100, day(2010, 1, 3), { swap: {}, rates: R }) - (-4 / 36500)) < 1e-15, 'short USD/JPY pays usd - jpy');
  // a fall through the stop ends a long at the stop (or a gapped open)
  const fall = prep(candles(day(2005, 0, 1), day(2005, 3, 1), (t) => t < day(2005, 1, 20) ? 1.25 : 1.15, 0.001));
  const k0 = fall.findIndex((b) => b.time >= day(2005, 1, 10)), s = position(fall, k0, k0 + 15, 1, EUR, F0);
  assert.equal(s.how, 'stop'); assert.ok(s.gross < 0);
  assert.equal(nights(day(2005, 0, 3), day(2005, 0, 4) + 23 * 3600), 2);
});

test('yearly: the claimed window against the same-length windows of the year, nothing after the window read', () => {
  const rows = candles(day(2005, 0, 1), day(2008, 1, 1), (t) => {
    const d = new Date(t * 1000); return d.getUTCMonth() === 11 && d.getUTCDate() >= 15 ? 1.2 + 0.002 * (d.getUTCDate() - 14) : 1.2; });
  const P = [{ pair: EUR, bars: prep(rows) }], Y = yearly(P, 'dec', F0);
  assert.deepEqual(Y.years.map((r) => r.y), [2005, 2006, 2007]);
  for (const r of Y.years) { assert.ok(r.excess > 0); assert.ok(r.nComp >= 20 && r.nComp <= 23, String(r.nComp)); }
  // changing every candle after a December window never changes that year's claimed return
  const cut = day(2006, 0, 1), B = rows.map((r) => r[0] >= cut ? [r[0], 2, 2.1, 1.9, 2, 1] : r);
  assert.equal(yearly([{ pair: EUR, bars: prep(B) }], 'dec', F0).years[0].claim, Y.years[0].claim);
  const J = yearly(P, 'jan', F0); assert.ok(J.years.every((r) => r.nComp <= 11));
});

test('placebo: a window that wins every year beats nearly every random window', () => {
  const rows = candles(day(2009, 0, 1), day(2014, 1, 1), (t) => {
    const d = new Date(t * 1000), y = d.getUTCFullYear(); return 1.2 + 0.03 * (y - 2009) + (d.getUTCMonth() === 11 && d.getUTCDate() >= 15 ? 0.002 * (d.getUTCDate() - 14) : 0); });
  const P = [{ pair: EUR, bars: prep(rows) }], Y = yearly(P, 'dec', F0), pl = placebo(P, 'dec', F0, Y, 200, 3);
  assert.equal(pl.draws, 200); assert.ok(pl.share < 0.05, String(pl.share));
});

test('statistics: Student t tail, one-sample t, Holm', () => {
  assert.ok(Math.abs(pUpper(0, 10) - 0.5) < 1e-12);
  assert.ok(Math.abs(pUpper(2.228, 10) - 0.025) < 5e-4);
  const o = oneSample([1, 2, 3, -1]); assert.equal(o.n, 4); assert.equal(o.pos, 3); assert.ok(Math.abs(o.mean - 1.25) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(read('../research/edge/fx-december-usd/result.json')), md = read('../research/edge/fx-december-usd/RESULT.md');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\*\*/);
  for (const k of ['T1', 'T2', 'T3']) assert.equal(r.pass[k].pass, false);
  const sg = (x) => (x >= 0 ? '+' : '') + x;
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['decisive', 'replication']) {
    const T = r.tests[k][w], row = `| ${T.years} | ${sg(T.meanExcessBp)} bp | ${T.sdBp} | ${T.t} | ${T.p} | ${T.positive} of ${T.years} |`;
    assert.ok(md.includes(row), `${k} ${w}: ${row}`); }
  for (const k of ['T1', 'T2', 'T3']) { assert.ok(md.includes(`${r.holm[k]}, not met`)); assert.ok(md.includes(`${+(r.placebo[k].share * 100).toFixed(1)} %, not met`)); }
  for (const x of r.years.T1) assert.ok(md.includes(`| ${x.y} | ${sg(x.claimBp)} | ${sg(x.baseBp)} | ${sg(x.excessBp)} |`), String(x.y));
  assert.equal(r.tests.T1.decisive.years, 16); assert.equal(r.tests.T1.decisive.from, 2010);
  assert.match(md, /[Ll]ow power/);
  assert.equal(r.costs.spreadPip, 0.3); assert.equal(r.costs.commissionPerSide, 22.5e-6);
  assert.match(r.costs.financing.eurusd, /broker swap/); assert.match(r.costs.financing.usdjpy, /rates\.json/);
});
