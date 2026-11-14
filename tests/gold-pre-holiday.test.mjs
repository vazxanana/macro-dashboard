// Spot gold into US market holidays (research/edge/gold-pre-holiday): the calendar, the trade on hand-made candles (stop,
// gap, no look-ahead), the statistics helpers, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { holidays, buildDays, atrBefore, trade, eventDays, st, pOne, holm, rng } from '../research/edge/gold-pre-holiday/run.mjs';

const H = 3600;
const day = (s) => Date.parse(s) / 1000 / 86400;

test('the holiday list is the NYSE full holidays (no 3 July, day after Thanksgiving or Christmas Eve)', () => {
  const y24 = holidays(2024).map((h) => h.date);
  assert.deepEqual(y24, ['2024-01-01', '2024-01-15', '2024-02-19', '2024-03-29', '2024-05-27', '2024-06-19', '2024-07-04', '2024-09-02', '2024-11-28', '2024-12-25']);
  assert.ok(!holidays(2021).some((h) => h.name === 'Juneteenth'), 'Juneteenth from 2022');
  assert.ok(!holidays(2022).some((h) => h.name === "New Year's Day"), 'a Saturday New Year is not observed on the Friday');
  let n = 0; for (let y = 2006; y <= 2026; y++) n += holidays(y).length; assert.equal(n, 192);
});

// hand-made H1 candles: one candle at 12:00 UTC per weekday (New York day = that date), flat at 100 with range 2
function mk(dates, px = () => 100) {
  return dates.map((s, i) => { const p = px(i, s); return { time: Date.parse(s + 'T12:00:00Z') / 1000, open: p, high: p + 1, low: p - 1, close: p }; });
}
const weekdays = (from, n) => { const out = []; let t = Date.parse(from); while (out.length < n) { const w = new Date(t).getUTCDay(); if (w && w < 6) out.push(new Date(t).toISOString().slice(0, 10)); t += 86400e3; } return out; };

test('the event days around a Monday holiday: the Friday and Thursday before, the Tuesday after', () => {
  const ds = buildDays(mk(weekdays('2024-01-01', 25)));
  const hol = holidays(2024).find((h) => h.name === 'Martin Luther King Day'), set = new Set(holidays(2024).map((h) => h.d));
  const e = eventDays(ds, hol, set);
  assert.equal(ds[e.pre1].d, day('2024-01-12')); assert.equal(ds[e.pre2].d, day('2024-01-11')); assert.equal(ds[e.post].d, day('2024-01-16'));
});

test('ATR uses only earlier days, and the stop fills at a gapped open or at the stop', () => {
  const dates = weekdays('2024-02-01', 20), h1 = mk(dates), ds = buildDays(h1);
  assert.equal(atrBefore(ds, 14), null, 'fewer than 14 earlier days');
  const a = 16, atr = atrBefore(ds, a); assert.equal(atr, 2);
  // changing the trade day itself or later candles never moves the ATR
  const h2 = h1.map((c, i) => (i >= a ? { ...c, high: 500, low: 1 } : c)); assert.equal(atrBefore(buildDays(h2), a), 2);
  // a day with a second candle that gaps through the stop: exit at that open
  const extra = { time: h1[a].time + H, open: 95, high: 96, low: 94, close: 95 };
  const hs = [...h1.slice(0, a + 1), extra, ...h1.slice(a + 1)], dd = buildDays(hs);
  const tr = trade(hs, dd, a, a, { cost: 0 }); assert.equal(tr.stopped, true); assert.equal(tr.exit, 95); assert.equal(tr.gross, -2.5);
  // a low through the stop without a gap: exit at the stop (-1R), costs in R of the ATR
  const touch = { time: h1[a].time + H, open: 100, high: 100, low: 97, close: 99 };
  const ht = [...h1.slice(0, a + 1), touch, ...h1.slice(a + 1)], dt = buildDays(ht);
  const t2 = trade(ht, dt, a, a, { cost: 0.6 }); assert.equal(t2.exit, 98); assert.equal(t2.gross, -1); assert.equal(t2.costR, 0.3);
  // no stop hit: out at the last candle's close of the exit day; a one-day hold pays no financing
  const t3 = trade(h1, ds, a, a); assert.equal(t3.stopped, false); assert.equal(t3.exit, 100); assert.equal(t3.nights, 0);
});

test('statistics helpers', () => {
  const s = st([1, 2, 3]); assert.equal(s.mean, 2); assert.equal(s.sd, 1);
  assert.ok(Math.abs(pOne(2.35, 91) - 0.0105) < 0.0005); assert.ok(Math.abs(pOne(0, 50) - 0.5) < 1e-9); assert.ok(pOne(-3, 30) > 0.99);
  assert.deepEqual(holm([0.01, 0.0066, 0.1]).map((x) => +x.toFixed(4)), [0.02, 0.0198, 0.1]);
  const a = rng(7), b = rng(7); assert.equal(a(), b());
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-pre-holiday/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-pre-holiday/RESULT.md', import.meta.url), 'utf8');
  const head = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.equal(r.verdict, 'PASS'); assert.match(head, /^\*\*Verdict: PASS/); assert.ok(head.length < 220);
  const f = (v, d = 3) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  for (const k of ['T1', 'T2', 'T3']) {
    const t = r.tests[k];
    for (const w of ['is', 'oos']) { const s = t[w];
      assert.ok(md.includes(`| ${s.n} | ${f(s.grossPct, 4)} | ${f(s.grossR)} | ${f(s.grossT, 2)} |`), `${k} ${w} gross row`);
      assert.ok(md.includes(`| ${f(s.netR)} | ${f(s.netT, 2)} | ${f(s.monthT, 2)} (${s.months}) | ${f(s.net2x)} |`), `${k} ${w} net row`); }
    assert.ok(md.includes(`| ${k} | ${f(t.oos.netT, 2)} | ${t.pOne} | ${t.pHolm} | ${f(t.is.netR)} | ${f(t.oos.net2x)} | ${t.placebo.beat} of 40`), `${k} bar row`);
  }
  assert.equal(r.tests.T1.pass, true); assert.equal(r.tests.T2.pass, true); assert.equal(r.tests.T3.pass, false);
  assert.match(head, new RegExp(`n ${r.tests.T1.oos.n}, t ${r.tests.T1.oos.netT}, Holm p ${r.tests.T1.pHolm.toFixed(3)}`));
});
