// fx-london-orb (research/edge/fx-london-orb): the London clock with UK summer time, the opening range and its filter without
// look-ahead, the stop-order fill rules, the fade entry, the cost maths, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { londonOffsetH, londonAt, days, follow, fade, costPx, K, manage, monthT, rng, placeboTrade, report } from '../research/edge/fx-london-orb/run.mjs';

const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000;

test('London clock: 07:00 London is 06:00 UTC in summer time, 07:00 UTC otherwise, switching on the UK dates', () => {
  assert.equal(londonAt(U(2024, 1, 15), 7), U(2024, 1, 15, 7));
  assert.equal(londonAt(U(2024, 7, 1), 7), U(2024, 7, 1, 6));
  // 2024: UK summer time from 31 Mar to 27 Oct (US switched on 10 Mar and 3 Nov: those weeks follow the UK, not the US)
  assert.equal(londonAt(U(2024, 3, 29), 7), U(2024, 3, 29, 7));
  assert.equal(londonAt(U(2024, 4, 1), 7), U(2024, 4, 1, 6));
  assert.equal(londonAt(U(2024, 10, 25), 16), U(2024, 10, 25, 15));
  assert.equal(londonAt(U(2024, 10, 28), 16), U(2024, 10, 28, 16));
  assert.equal(londonAt(U(2024, 3, 12), 7), U(2024, 3, 12, 7));
  assert.equal(londonOffsetH(U(2016, 3, 27, 0, 59)), 0);
  assert.equal(londonOffsetH(U(2016, 3, 27, 1)), 1);
});

// flat candles on weekdays, 1.1000, then the 07:00-08:00 London window of each day given a range
function series(nDays, from = U(2024, 6, 3), rangeOf = () => 0.0020) {
  const B = [];
  for (let d = 0, day = from; d < nDays; day += 86400) {
    const wd = new Date(day * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const a = londonAt(day, 7), b = londonAt(day, 8), r = rangeOf(d);
    for (let t = day; t < day + 86400; t += 300) {
      const inR = t >= a && t < b, hi = inR ? 1.1 + r / 2 : 1.1, lo = inR ? 1.1 - r / 2 : 1.1;
      B.push({ time: t, open: 1.1, high: hi, low: lo, close: 1.1 });
    }
    d++;
  }
  return B;
}

test('opening range: the 07:00-08:00 London candles only, the median of the 20 days before, and no candle after 08:00 read', () => {
  const B = series(25, U(2024, 6, 3), (d) => (d === 22 ? 0.0001 : d === 23 ? 0.0100 : 0.0020));
  const ds = days(B);
  assert.equal(ds.length, 25);
  assert.equal(ds[0].skip, 'warm-up'); assert.equal(ds[19].skip, 'warm-up'); assert.equal(ds[20].skip, null);
  assert.ok(Math.abs(ds[20].range - 0.002) < 1e-12); assert.ok(Math.abs(ds[20].med - 0.002) < 1e-12);
  assert.equal(ds[22].skip, 'narrow'); assert.equal(ds[23].skip, 'wide');
  assert.equal(ds[20].start, londonAt(ds[20].day, 8)); assert.equal(ds[20].start % 86400, 7 * 3600, 'summer: the range ends at 08:00 London = 07:00 UTC');
  // change every candle at or after 08:00 London of day 20: its range, median and filter do not move
  const C = B.map((b) => ({ ...b })); for (const b of C) if (b.time >= ds[20].start && b.time < ds[20].day + 86400) { b.high = 9; b.low = 0.1; }
  const es = days(C);
  for (const k of ['hi', 'lo', 'range', 'med', 'skip']) assert.equal(es[20][k], ds[20][k]);
  // a day with fewer than 11 of its 12 range candles is skipped
  const D = B.filter((b) => !(b.time >= londonAt(ds[21].day, 7) && b.time < londonAt(ds[21].day, 7, 10)));
  assert.equal(days(D).some((d) => d.day === ds[21].day), false);
});

function dayWith(mod) {
  const B = series(21); const d = days(B)[20];
  mod(B, d, (hh, mm) => B.findIndex((b) => b.time === londonAt(d.day, hh, mm)));
  return { B, d: days(B)[20] };
}

test('follow: the buy stop fills at the range high, the stop is the low, exit 16:00 London; a gap fills at the open', () => {
  let { B, d } = dayWith((B, d, at) => { const i = at(9, 0); B[i].high = d.hi + 0.0005; B[i].close = d.hi + 0.0004; for (let j = i + 1; j < B.length; j++) { B[j].open = B[j].close = B[j].high = B[j].low = d.hi + 0.0010; } });
  let t = follow('eurusd', B, d, false);
  assert.equal(t.side, 1); assert.equal(t.entry, d.hi); assert.equal(t.stop, d.lo); assert.equal(t.exit, 'time');
  assert.equal(t.exitAt, londonAt(d.day, 15, 55)); assert.ok(Math.abs(t.gross - 0.0010 / 0.0020) < 1e-9);
  // F2: 1.5R target from the fill
  ({ B, d } = dayWith((B, d, at) => { const i = at(9, 0); B[i].high = d.hi + 0.0001; B[i + 2].high = d.hi + 0.0040; }));
  t = follow('eurusd', B, d, true);
  assert.equal(t.exit, 'target'); assert.ok(Math.abs(t.gross - 1.5) < 1e-9);
  // a candle opening above the high fills at its open
  ({ B, d } = dayWith((B, d, at) => { const i = at(8, 30); B[i].open = B[i].high = B[i].low = B[i].close = d.hi + 0.0003; }));
  t = follow('eurusd', B, d, false);
  assert.ok(Math.abs(t.entry - (d.hi + 0.0003)) < 1e-12);
  // both sides touched in one candle: the nearer side fills and is stopped in the same candle, -1R gross
  ({ B, d } = dayWith((B, d, at) => { const i = at(10, 0); B[i].open = d.lo + 0.0002; B[i].high = d.hi + 0.0001; B[i].low = d.lo - 0.0001; }));
  t = follow('eurusd', B, d, false);
  assert.equal(t.side, -1); assert.equal(t.exit, 'stop'); assert.ok(Math.abs(t.gross + 1) < 1e-9);
  // no touch before 12:00 London: no trade (a touch at 12:00 does not count)
  ({ B, d } = dayWith((B, d, at) => { B[at(12, 0)].high = d.hi + 0.001; }));
  assert.equal(follow('eurusd', B, d, false), null);
});

test('follow and fade read no candle after their exit', () => {
  const { B, d } = dayWith((B, d, at) => { const i = at(9, 0); B[i].high = d.hi + 0.0002; B[i + 3].low = d.lo - 0.0001; });
  const t = follow('eurusd', B, d, false); assert.equal(t.exit, 'stop');
  const C = B.map((b) => (b.time > t.exitAt ? { ...b, high: 5, low: 0.01 } : b));
  assert.deepEqual(follow('eurusd', C, d, false), t);
});

test('fade: the first close above the range sells at the next open, stop past the break candle + 0.1 x range, target the middle', () => {
  const { B, d } = dayWith((B, d, at) => { const i = at(8, 15); B[i].high = d.hi + 0.0006; B[i].close = d.hi + 0.0003; B[i + 1].open = d.hi + 0.0002; B[i + 3].low = d.mid - 0.0001; });
  const t = fade('eurusd', B, d);
  assert.equal(t.side, -1); assert.ok(Math.abs(t.entry - (d.hi + 0.0002)) < 1e-12);
  assert.ok(Math.abs(t.stop - (d.hi + 0.0006 + 0.1 * d.range)) < 1e-12); assert.equal(t.target, d.mid); assert.equal(t.exit, 'target');
  assert.equal(t.at, londonAt(d.day, 8, 20));
  // an open already past the middle: no trade
  const { B: B2, d: d2 } = dayWith((B, d, at) => { const i = at(8, 15); B[i].high = d.hi + 0.0006; B[i].close = d.hi + 0.0003; B[i + 1].open = d.mid - 0.0001; });
  assert.equal(fade('eurusd', B2, d2), null);
  // stop and target in one candle: the stop counts
  const p = { side: -1, entry: 1.1, stop: 1.101, target: 1.099, i: 0, fillBar: true, checkOpen: false };
  assert.equal(manage([{ time: 0, open: 1.1, high: 1.102, low: 1.098, close: 1.1 }], p, 600).kind, 'stop');
});

test('costs: 0.3 pip spread + 2 x 22.5e-6 x price commission + 0.5 pip per market or stop fill; JPY pips are 0.01', () => {
  assert.ok(Math.abs(costPx('eurusd', 1.1, 2) - (0.3e-4 + 45e-6 * 1.1 + 1e-4)) < 1e-15);
  assert.ok(Math.abs(costPx('usdjpy', 150, 1) - (0.003 + 45e-6 * 150 + 0.005)) < 1e-12);
  assert.ok(Math.abs(costPx('eurusd', 1.1, 1, 2) - 2 * costPx('eurusd', 1.1, 1)) < 1e-15);
  assert.equal(K.COMM_SIDE, 22.5e-6); assert.equal(K.SPREAD_PIP, 0.3); assert.equal(K.SLIP_PIP, 0.5);
  // a target exit is a limit: one market fill (the entry); a stop exit two
  const { B, d } = dayWith((B, d, at) => { const i = at(9, 0); B[i].high = d.hi + 0.0001; B[i + 2].high = d.hi + 0.0040; });
  const t = follow('eurusd', B, d, true);
  assert.ok(Math.abs(t.gross - t.net - costPx('eurusd', t.entry, 1) / t.r0) < 1e-12);
});

test('fade: an open equal to the stop up to float noise is "at the stop": no trade', () => {
  const { B, d } = dayWith((B, d, at) => { const i = at(8, 15); B[i].high = d.hi + 0.0006; B[i].close = d.hi + 0.0003; B[i + 1].open = d.hi + 0.0006 + 0.1 * d.range - 1e-16; });
  assert.equal(fade('eurusd', B, d), null);
});

test('placebo: seeds 1-40 are the seeds, draws are repeatable, the entry is a 08:00-11:55 London open, F2 keeps its fill rule', () => {
  const a = rng(1), b = rng(1), c = rng(2), xs = Array.from({ length: 5 }, a);
  assert.deepEqual(xs, Array.from({ length: 5 }, b)); assert.notDeepEqual(xs, Array.from({ length: 5 }, c));
  for (const x of xs) assert.ok(x >= 0 && x < 1);
  const B = series(21), d = days(B)[20];
  const real = { side: 1, entry: 1.1, r0: 0.002, target: 1.103, day: d.day };
  const q = placeboTrade('eurusd', B, real, 0.999, 'F2');
  assert.equal(q.exitAt <= londonAt(d.day, 15, 55), true);
  assert.ok(Math.abs(q.r0 - 0.002) < 1e-12);
  // the entry candle reaches the target: F2 (stop only in the fill candle) holds on, FADE takes the target there
  const C = B.map((x) => ({ ...x })), i = C.findIndex((x) => x.time === londonAt(d.day, 8)); C[i].high = 1.104;
  assert.equal(placeboTrade('eurusd', C, real, 0, 'FADE').exit, 'target');
  assert.equal(placeboTrade('eurusd', C, real, 0, 'F2').exit, 'time');
  assert.equal(placeboTrade('eurusd', C, real, 0, 'F2').entry, C[i].open);
});

test('month-sum t counts every month of the window, empty months as 0', () => {
  const a = U(2020, 1, 1), b = U(2020, 4, 1), tr = [{ at: U(2020, 1, 5), net: 1 }, { at: U(2020, 3, 5), net: 1 }];
  const m = monthT(tr, a, b); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - (2 / 3) / (Math.sqrt(1 / 3) / Math.sqrt(3))) < 1e-12);
});

test('RESULT.md states what result.json holds', { skip: !fs.existsSync(new URL('../research/edge/fx-london-orb/result.json', import.meta.url)) }, () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fx-london-orb/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/fx-london-orb/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${R.verdict.split(':')[0]}`));
  const f = (x, d = 3) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`;
  for (const [v, V] of Object.entries(R.variants)) {
    for (const w of ['decisive', 'replication']) {
      const s = V[w];
      assert.ok(md.includes(`| ${v} | ${w === 'decisive' ? '2020 on' : '2016-19'} | ${s.n} | ${f(s.net)} | ${f(s.gross)} | ${s.t.toFixed(2)} |`), `${v} ${w} row`);
    }
    assert.ok(md.includes(`| ${v} | ${V.verdict} |`), `${v} verdict row`);
    assert.ok(md.includes(f(V.placebo.p95)), `${v} placebo p95`);
  }
  // the whole file is the report of result.json (with READING.md appended), byte for byte
  const rd = new URL('../research/edge/fx-london-orb/READING.md', import.meta.url);
  assert.equal(md, report(R, fs.existsSync(rd) ? fs.readFileSync(rd, 'utf8') : ''));
});
