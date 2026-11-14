// gold-ibs: the IBS rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { days } from '../research/edge/gold-drd-long/run.mjs';
import { ibsOf, enrich, dayIndex, simulate, runTest, TESTS, RT, monthT, holm, inWin, WIN } from '../research/edge/gold-ibs/run.mjs';
import { FIN } from '../council/fills.mjs';

const H = 3600;
// January (New York on UTC-5): a 17:00 New York day runs 22:00 UTC the evening before -> 21:00 UTC. One flat H1 candle per hour
// except the first (open) and the last (close); weekdays only. spec = [open, high, low, close] per day.
function make(specs, start = Date.UTC(2015, 0, 5) / 1000) {   // Monday 5 Jan 2015
  const h1 = []; let day = start;
  for (const [o, hi, lo, c] of specs) {
    while ([0, 6].includes(new Date(day * 1000).getUTCDay())) day += 86400;
    const t0 = day - 2 * H;   // 22:00 UTC the evening before
    for (let k = 0; k < 24; k++) { const px = k === 23 ? c : o; h1.push({ time: t0 + k * H, open: k ? px : o, high: k === 5 ? hi : Math.max(o, px), low: k === 7 ? lo : Math.min(o, px), close: px }); }
    day += 86400;
  }
  return h1;
}
const flat = (n, px = 100) => Array.from({ length: n }, () => [px, px + 1, px - 1, px]);   // true range 2 -> ATR 2, stop 4 away

test('IBS is the close position inside the day', () => {
  assert.equal(ibsOf({ high: 10, low: 0, close: 1 }), 0.1);
  assert.equal(ibsOf({ high: 10, low: 0, close: 10 }), 1);
  assert.equal(ibsOf({ high: 5, low: 5, close: 5 }), null);
});

test('17:00 New York days and the day fields use nothing after the day', () => {
  const h1 = make([...flat(25), [100, 101, 90, 91], [91, 96, 90.5, 95], ...flat(6, 95)]);
  const ds = enrich(days(h1));
  assert.equal(ds.length, 33);
  assert.ok(Math.abs(ds[25].ibs - 1 / 11) < 1e-12);
  const before = JSON.stringify(ds.slice(0, 26));
  const h2 = make([...flat(25), [100, 101, 90, 91], [91, 200, 10, 150], ...flat(6, 150)]);
  assert.equal(JSON.stringify(enrich(days(h2)).slice(0, 26)), before);   // later candles change no earlier field
  assert.equal(ds[20].atr, 2);
});

test('T1 long: entry next open, exit at the first close with IBS > 0.5, costs and financing in R', () => {
  const h1 = make([...flat(25), [100, 101, 90, 91], [91, 96, 90.5, 95], ...flat(6, 95)]);
  const ds = enrich(days(h1)), idx = dayIndex(h1);
  const T = runTest(h1, idx, ds, TESTS.T1);
  assert.equal(T.length, 1);
  const tr = T[0], risk = 2 * ds[25].atr;
  assert.equal(tr.entry, 91); assert.equal(tr.how, 'ibs'); assert.equal(tr.exit, 95); assert.equal(tr.hold, 1);
  assert.ok(Math.abs(tr.gross - 4 / risk) < 1e-12);
  assert.ok(Math.abs(tr.cost - RT / risk) < 1e-12);
  assert.equal(tr.nights, 0); assert.equal(tr.fin, 0);   // open to close of one 17:00 New York day: no 22:00 UTC rollover in January
  const h3 = make([...flat(25), [100, 101, 90, 91], [91, 92, 90, 90.3], [90.3, 96, 90.2, 95], ...flat(6, 95)]), d3 = enrich(days(h3));
  const t3 = runTest(h3, dayIndex(h3), d3, TESTS.T1)[0];
  assert.equal(t3.hold, 2); assert.equal(t3.nights, 1);
  assert.ok(Math.abs(t3.fin - FIN.xau.long * 91 / (2 * d3[25].atr)) < 1e-12);
  assert.ok(Math.abs(tr.net - (tr.gross - tr.cost - tr.fin)) < 1e-12);
  // the same path, its later days changed: the trade is the same (nothing after its exit is read)
  const h2 = make([...flat(25), [100, 101, 90, 91], [91, 96, 90.5, 95], ...flat(6, 300)]);
  const T2 = runTest(h2, dayIndex(h2), enrich(days(h2)), TESTS.T1);
  assert.deepEqual({ ...T2[0] }, { ...tr });
});

test('stop on H1, gap fill at the open, time exit, and the short pays no financing', () => {
  const sig = [100, 101, 90, 91];
  let h1 = make([...flat(25), sig, [91, 92, 80, 81], ...flat(6, 81)]), ds = enrich(days(h1));
  let tr = simulate(h1, dayIndex(h1), ds, 25, 1, TESTS.T1.exit);
  assert.equal(tr.how, 'stop'); assert.equal(tr.exit, 91 - 2 * ds[25].atr);
  h1 = make([...flat(25), sig, [91, 92, 90, 90.3], [80, 81, 79, 80], ...flat(5, 80)]); ds = enrich(days(h1));
  tr = simulate(h1, dayIndex(h1), ds, 25, 1, TESTS.T1.exit);
  assert.equal(tr.how, 'stop'); assert.equal(tr.exit, 80); assert.equal(tr.hold, 2);   // opened through the stop: filled at the open
  h1 = make([...flat(25), sig, ...Array.from({ length: 7 }, () => [91, 91.5, 90.8, 90.9])]); ds = enrich(days(h1));
  tr = simulate(h1, dayIndex(h1), ds, 25, 1, TESTS.T1.exit);
  assert.equal(tr.how, 'time'); assert.equal(tr.hold, 5);
  h1 = make([...flat(25), [100, 110, 99, 109.5], [109.5, 110, 104, 104.5], ...flat(6, 104.5)]); ds = enrich(days(h1));
  tr = runTest(h1, dayIndex(h1), ds, TESTS.T2)[0];
  assert.equal(tr.side, -1); assert.equal(tr.how, 'ibs'); assert.equal(tr.fin, 0); assert.ok(tr.gross > 0);
});

test('month-sum t, Holm, windows', () => {
  const T = [{ entryT: Date.UTC(2017, 0, 3) / 1000, exitT: Date.UTC(2017, 0, 4) / 1000, net: 1 }, { entryT: Date.UTC(2017, 1, 3) / 1000, exitT: Date.UTC(2017, 1, 4) / 1000, net: 2 }];
  const m = monthT(T, ['2017-01-01', '2017-03-31']);
  assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 1 / (1 / Math.sqrt(3))) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.equal(inWin(T, WIN.oos).length, 2); assert.equal(inWin(T, WIN.is).length, 0);
});

test('the report says what result.json says', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-ibs/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-ibs/RESULT.md', import.meta.url), 'utf8');
  const v = md.match(/\*\*Verdict: ([A-Z]+)/); assert.ok(v); assert.equal(v[1], R.verdict);
  assert.equal(R.verdict, R.tests.T1.pass ? 'PASS' : 'FAIL');
  const line = md.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(line.length < 400);
  for (const k of ['T1', 'T2', 'T3']) { const x = R.tests[k];
    for (const w of ['oos', 'is']) { const row = md.split('\n').find((l) => l.startsWith(`| ${k} `) && l.includes(w === 'oos' ? '2017' : '2008'));
      assert.ok(row, `${k} ${w} row`); for (const f of ['n', 'net', 't']) assert.ok(row.includes(String(x[w][f]).replace('-', '−')) || row.includes(String(x[w][f])), `${k} ${w} ${f}`); }
    assert.equal(x.pass, Object.values(x.checks).every(Boolean)); }
});
