// gold-weekday: the weekday session rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { days } from '../research/edge/gold-drd-long/run.mjs';
import { enrich, dayIndex, simulate, runWeekday, chooseWeekday, RT, monthT, holm, inWin, WIN, wdOf } from '../research/edge/gold-weekday/run.mjs';

const H = 3600;
// January (New York on UTC-5): a 17:00 New York day runs 22:00 UTC the evening before -> 21:00 UTC. Hours 23:00 UTC .. 21:00
// UTC (the 17:00-18:00 New York hour left out, as on the feed). spec = [open, high, low, close] per weekday.
function make(specs, start = Date.UTC(2015, 0, 5) / 1000) {   // Monday 5 Jan 2015
  const h1 = []; let day = start;
  for (const [o, hi, lo, c] of specs) {
    while ([0, 6].includes(new Date(day * 1000).getUTCDay())) day += 86400;
    const t0 = day - H;   // 23:00 UTC the evening before
    for (let k = 0; k < 22; k++) { const px = k === 21 ? c : o; h1.push({ time: t0 + k * H, open: k ? px : o, high: k === 5 ? hi : Math.max(o, px), low: k === 7 ? lo : Math.min(o, px), close: px }); }
    day += 86400;
  }
  return h1;
}
const flat = (n, px = 100) => Array.from({ length: n }, () => [px, px + 1, px - 1, px]);   // true range 2 -> ATR 2

test('weekday of a 17:00 New York day and ATR known before the day opens', () => {
  const h1 = make([...flat(25), [100, 130, 70, 100]]);
  const ds = enrich(days(h1));
  assert.equal(ds.length, 26);
  assert.deepEqual(ds.slice(0, 5).map((x) => x.wd), [1, 2, 3, 4, 5]);   // Sunday-evening hours belong to Monday
  assert.equal(wdOf(ds[5].d), 1);
  assert.equal(ds[25].atr, 2);   // the wide day itself is not in its own ATR
  const h2 = make([...flat(25), [100, 130, 70, 100], [100, 300, 1, 100]]);
  assert.equal(JSON.stringify(enrich(days(h2)).slice(0, 26)), JSON.stringify(ds));   // a later day changes no earlier field
});

test('session trade: first H1 open to last H1 close, costs in R, no rollover inside one session', () => {
  const h1 = make([...flat(25), [100, 101.5, 99.5, 101]]);
  const ds = enrich(days(h1)), idx = dayIndex(h1);
  const tr = simulate(h1, idx, ds, 25, 1);
  assert.equal(tr.entry, 100); assert.equal(tr.exit, 101); assert.equal(tr.how, 'close'); assert.equal(tr.risk, 2);
  assert.ok(Math.abs(tr.gross - 0.5) < 1e-12);
  assert.ok(Math.abs(tr.cost - RT / 2) < 1e-12);
  assert.equal(tr.nights, 0); assert.equal(tr.fin, 0);
  assert.ok(Math.abs(tr.net - (0.5 - RT / 2)) < 1e-12);
  const sh = simulate(h1, idx, ds, 25, -1);
  assert.ok(Math.abs(sh.gross + 0.5) < 1e-12); assert.equal(sh.fin, 0);
  // the next day's prices do not change the trade
  const h2 = make([...flat(25), [100, 101.5, 99.5, 101], [101, 500, 1, 400]]);
  assert.deepEqual({ ...simulate(h2, dayIndex(h2), enrich(days(h2)), 25, 1) }, { ...tr });
});

test('stop on H1 at 1 ATR, and a gap through it fills at the open', () => {
  let h1 = make([...flat(25), [100, 101, 97, 99]]), ds = enrich(days(h1));
  let tr = simulate(h1, dayIndex(h1), ds, 25, 1);
  assert.equal(tr.how, 'stop'); assert.equal(tr.exit, 98); assert.ok(Math.abs(tr.gross + 1) < 1e-12);
  h1 = make([...flat(25), [100, 103.5, 99, 100]]); ds = enrich(days(h1));
  tr = simulate(h1, dayIndex(h1), ds, 25, -1);
  assert.equal(tr.how, 'stop'); assert.equal(tr.exit, 102);
  h1 = make([...flat(25), [95, 96, 94, 95]]); ds = enrich(days(h1));   // opens far below: stop is 2 under the open, not hit
  tr = simulate(h1, dayIndex(h1), ds, 25, 1);
  assert.equal(tr.entry, 95); assert.equal(tr.how, 'close');
  const idx = dayIndex(h1); h1[idx.a.get(ds[25].d) + 3].open = 90; h1[idx.a.get(ds[25].d) + 3].low = 90;
  tr = simulate(h1, idx, ds, 25, 1);
  assert.equal(tr.how, 'stop'); assert.equal(tr.exit, 90);   // that candle opened through the stop
});

test('runWeekday picks only that weekday; the in-sample choice reads only 2007-16', () => {
  const h1 = make([...flat(30)]), ds = enrich(days(h1)), idx = dayIndex(h1);
  assert.ok(runWeekday(h1, idx, ds, 3, 1).every((x) => ds[x.i].wd === 3));
  assert.equal(runWeekday(h1, idx, ds, 3, 1).length, 2);   // two Wednesdays with an ATR in 30 days
  // Fridays rise 1 each, other days flat, all in 2015: Friday long is chosen; the same days moved to 2017 choose nothing
  const spec = Array.from({ length: 60 }, (_, k) => (k % 5 === 4 ? [100, 101.2, 99.5, 101] : [100, 101, 99, 100]));
  const a = make(spec), c = chooseWeekday(a, dayIndex(a), enrich(days(a)));
  assert.equal(c.wd, 5); assert.equal(c.side, 1);
  const b = make(spec, Date.UTC(2017, 0, 2) / 1000), c2 = chooseWeekday(b, dayIndex(b), enrich(days(b)));
  assert.deepEqual(Object.values(c2.isLongGross), [0, 0, 0, 0, 0]);
});

test('month-sum t, Holm, windows', () => {
  const T = [{ entryT: Date.UTC(2017, 0, 3) / 1000, exitT: Date.UTC(2017, 0, 4) / 1000, net: 1 }, { entryT: Date.UTC(2017, 1, 3) / 1000, exitT: Date.UTC(2017, 1, 4) / 1000, net: 2 }];
  const m = monthT(T, ['2017-01-01', '2017-03-31']);
  assert.equal(m.months, 3); assert.ok(Math.abs(m.t - Math.sqrt(3)) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(inWin(T, WIN.oos).length, 2); assert.equal(inWin(T, WIN.is).length, 0);
  assert.deepEqual(WIN, { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] });
});

test('the report says what result.json says', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-weekday/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-weekday/RESULT.md', import.meta.url), 'utf8');
  const line = md.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(line && line.length < 220);
  assert.equal(line.match(/\*\*Verdict: ([A-Z]+)/)[1], R.verdict);
  assert.equal(R.verdict, R.tests.T1.pass ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passAlone, R.tests.T2.pass ? ['T2'] : []);
  assert.equal(R.choice.weekday, R.tests.T2.weekday);
  for (const k of ['T1', 'T2']) { const x = R.tests[k];
    for (const w of ['oos', 'is']) { const row = md.split('\n').find((l) => l.startsWith(`| ${k} `) && l.includes(w === 'oos' ? '| 2017-2026 |' : '| 2007-2016 |'));
      assert.ok(row, `${k} ${w} row`); const cells = row.split('|').map((s) => s.trim());
      assert.equal(+cells[3], x[w].n); assert.equal(+cells[5], x[w].net); assert.equal(+cells[12], x[w].t); }
    assert.equal(x.pass, Object.values(x.checks).every(Boolean));
    const pr = md.split('\n').find((l) => l.startsWith(`| ${k} |`) && l.includes(' / 40 |'));
    assert.ok(pr.includes(`${x.placebo.beaten} / 40`)); }
});
