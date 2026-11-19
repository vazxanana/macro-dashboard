// gold-key-reversal: the key / outside reversal rules on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { days } from '../research/edge/gold-drd-long/run.mjs';
import { keyRev, outsideRev, enrich, dayIndex, stopFor, simulate, runTest, TESTS, RT, BUF, holm, monthT } from '../research/edge/gold-key-reversal/run.mjs';
import { FIN } from '../council/fills.mjs';

const H = 3600;
// January (New York on UTC-5): a 17:00 New York day runs 22:00 UTC the evening before -> 21:00 UTC. spec = [open, high, low, close].
function make(specs, start = Date.UTC(2015, 0, 5) / 1000) {
  const h1 = []; let day = start;
  for (const [o, hi, lo, c] of specs) {
    while ([0, 6].includes(new Date(day * 1000).getUTCDay())) day += 86400;
    const t0 = day - 2 * H;
    for (let k = 0; k < 24; k++) { const px = k === 23 ? c : o; h1.push({ time: t0 + k * H, open: k ? px : o, high: k === 5 ? hi : Math.max(o, px), low: k === 7 ? lo : Math.min(o, px), close: px }); }
    day += 86400;
  }
  return h1;
}
const flat = (n, px = 100) => Array.from({ length: n }, () => [px, px + 1, px - 1, px]);
const bear = [100, 105, 99.5, 99.8];   // new 20-day high (105 > 101), close below the previous close (100)

test('key reversal and outside reversal signals read only the day and the days before it', () => {
  const ds = enrich(days(make([...flat(21), bear, ...flat(4, 97)])));
  assert.equal(keyRev(ds, 21), -1);
  assert.equal(keyRev(ds, 20), 0);
  const bull = enrich(days(make([...flat(21), [100, 100.5, 95, 100.2], ...flat(4, 101)])));
  assert.equal(keyRev(bull, 21), 1);
  // a new high closing UP is not a key reversal
  const up = enrich(days(make([...flat(21), [100, 105, 99.5, 104], ...flat(4, 104)])));
  assert.equal(keyRev(up, 21), 0);
  assert.equal(outsideRev(ds, 21), 0);   // a key reversal need not be an outside day: low 99.5 stays above the previous low 99
});

test('outside reversal: range takes out both sides, close against the previous close', () => {
  const mk = (x) => enrich(days(make([...flat(21), x, ...flat(4)])));
  assert.equal(outsideRev(mk([100, 102, 98, 99.5]), 21), -1);
  assert.equal(outsideRev(mk([100, 102, 98, 100.5]), 21), 1);
  assert.equal(outsideRev(mk([100, 102, 99.5, 99.5]), 21), 0);   // low not below the previous low
  assert.equal(outsideRev(mk([100, 102, 98, 100]), 21), 0);      // equal close
});

test('no look-ahead: changing every later candle changes no signal up to the day', () => {
  const a = enrich(days(make([...flat(21), bear, ...flat(4, 97)])));
  const b = enrich(days(make([...flat(21), bear, [99.8, 300, 1, 250], ...flat(3, 250)])));
  for (let i = 0; i <= 21; i++) { assert.equal(keyRev(a, i), keyRev(b, i)); assert.equal(outsideRev(a, i), outsideRev(b, i)); assert.equal(a[i].atr, b[i].atr); }
});

test('the stop: beyond the signal day extreme by $0.30, a 0.5 ATR floor, a skip when the entry opens past it', () => {
  const sig = { high: 105, low: 99, atr: 2 };
  assert.equal(stopFor(sig, -1, 100), 105 + BUF);
  assert.equal(stopFor(sig, -1, 105.4), null);
  assert.equal(stopFor(sig, -1, 105), 106);            // 0.3 away < 0.5 x 2: the floor
  assert.equal(stopFor(sig, 1, 104), 99 - BUF);
  assert.equal(stopFor(sig, 1, 98.5), null);
});

test('T1 short: entry next open, out at the third close, costs in R, nothing after the exit read', () => {
  const specs = [...flat(21), bear, [99.8, 99.9, 97, 97], [97, 97.5, 96.5, 97], [97, 97.5, 96.5, 97], ...flat(3, 97)];
  const h1 = make(specs), ds = enrich(days(h1)), idx = dayIndex(h1);
  const T = runTest(h1, idx, ds, TESTS.T1);
  assert.equal(T.length, 1);
  const tr = T[0];
  assert.equal(tr.side, -1); assert.equal(tr.entry, 99.8); assert.equal(tr.stop, 105.3); assert.equal(tr.how, 'time'); assert.equal(tr.exit, 97);
  assert.equal(tr.exitDay, 24);
  assert.ok(Math.abs(tr.gross - 2.8 / 5.5) < 1e-9);
  assert.ok(Math.abs(tr.cost - RT / 5.5) < 1e-9);
  assert.equal(tr.fin, 0);   // shorts pay no financing
  const later = make([...specs.slice(0, 25), ...flat(3, 500)]);
  assert.deepEqual({ ...runTest(later, dayIndex(later), enrich(days(later)), TESTS.T1)[0] }, { ...tr });
});

test('a stop is taken on H1 and a long pays financing per rollover', () => {
  const h1 = make([...flat(21), bear, [99.8, 106, 99, 100], ...flat(4, 100)]), ds = enrich(days(h1));
  const tr = simulate(h1, dayIndex(h1), ds, 21, -1);
  assert.equal(tr.how, 'stop'); assert.equal(tr.exit, 105.3); assert.ok(Math.abs(tr.gross + 1) < 1e-9);
  const h2 = make([...flat(21), [100, 100.5, 95, 100.2], [100.2, 101, 100, 101], [101, 102, 100.5, 102], [102, 103, 101.5, 103], ...flat(2, 103)]);
  const d2 = enrich(days(h2)), t2 = runTest(h2, dayIndex(h2), d2, TESTS.T2)[0];
  assert.equal(t2.side, 1); assert.equal(t2.entry, 100.2); assert.equal(t2.exit, 103); assert.equal(t2.nights, 4);   // Wed 4 Feb 2015 entry: the Wednesday rollover counts three, Thursday one
  assert.ok(Math.abs(t2.fin - 4 * FIN.xau.long * 100.2 / t2.risk) < 1e-12);
  assert.ok(Math.abs(t2.net - (t2.gross - t2.cost - t2.fin)) < 1e-12);
});

test('statistics helpers', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  const T = [{ exitT: Date.UTC(2017, 0, 10) / 1000, net: 1 }, { exitT: Date.UTC(2017, 1, 10) / 1000, net: 1 }];
  assert.equal(monthT(T, ['2017-01-01', '2017-03-31']).months, 3);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-key-reversal/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-key-reversal/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.deepEqual(r.passAlone, []);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 260 && line.includes('FAIL'));
  const T1 = r.tests.T1;
  assert.ok(line.includes(`n ${T1.oos.n}`) && line.includes(T1.oos.net.toFixed(3)) && line.includes(T1.oos.t.toFixed(2)) && line.includes(T1.is.net.toFixed(3)));
  for (const k of ['T1', 'T2', 'T3']) {
    const x = r.tests[k];
    assert.equal(x.pass, false);
    for (const w of ['oos', 'is']) {
      const row = md.split('\n').find((l) => l.startsWith(`| ${k} `) && l.includes(w === 'oos' ? '2017-2026' : '2008-2016'));
      assert.ok(row && row.includes(`| ${x[w].n} |`) && row.includes(x[w].net.toFixed(3)) && row.includes(x[w].t.toFixed(2)), `${k} ${w}`);
    }
    assert.ok(md.includes(`| ${k} | ${x.oos.net.toFixed(3)} | ${x.placebo.beaten} of 40 |`), `${k} placebo`);
    assert.ok(md.includes(x.p.toFixed(4)));
  }
});
