// gold-hourly-shock: the shock detector (no look-ahead), the fade / follow trades on hand-made candles, the release tag, and the
// report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, prepare, shocks, spec, sim, stream, releaseTimes, releaseIn, broad830, blsDate, monthT, holm, inW, headline } from '../research/edge/gold-hourly-shock/run.mjs';

const DIR = new URL('../research/edge/gold-hourly-shock/', import.meta.url);
const T0 = Date.UTC(2018, 0, 2, 0) / 1000;   // a Tuesday
// n quiet candles alternating +-0.1 around 1000, one hour apart
function quiet(n, t0 = T0) {
  const rows = []; let c = 1000;
  for (let i = 0; i < n; i++) { const o = c; c = 1000 + (i % 2 ? 0.1 : -0.1); rows.push([t0 + i * 3600, o, Math.max(o, c) + 0.05, Math.min(o, c) - 0.05, c]); }
  return rows;
}

test('the volatility uses only the 500 returns before the candle; the shock is beyond 3 sd', () => {
  const rows = quiet(520), t = rows.at(-1)[0] + 3600;
  rows.push([t, 1000, 1010, 999.9, 1009]);             // a big up candle
  rows.push([t + 3600, 1009, 1009.5, 1005, 1006]);     // the next candle
  const C = prepare(rows), i = C.length - 2;
  const sdBefore = C[i].sd;
  const changed = prepare(rows.map((r, k) => (k >= i ? [r[0], r[1], r[2] * 3, r[3], r[4] * 1.5] : r)));
  assert.equal(changed[i].sd, sdBefore, 'sd ignores the candle itself and later prices');
  assert.ok(C[i].z > P.K);
  const S = shocks(C, []);
  assert.deepEqual(S.map((s) => s.i), [i]);
  assert.equal(S[0].up, true);
  assert.equal(C[499].sd, null, 'no sd before 500 returns');
});

test('a return across a closure of over 6 hours is never a shock and never in the estimate', () => {
  const rows = quiet(520), t = rows.at(-1)[0] + 50 * 3600;
  rows.push([t, 1000, 1010, 999.9, 1009], [t + 3600, 1009, 1009.5, 1005, 1006]);
  const C = prepare(rows);
  assert.equal(C.at(-2).gap, true); assert.equal(C.at(-2).r, null);
  assert.equal(shocks(C, []).length, 0);
});

// a frame: previous close 1000, shock candle o/h/l/c, then entry candles
const frame = (shock, after) => {
  const rows = [[T0, 1000, 1000, 1000, 1000], [T0 + 3600, ...shock]];
  after.forEach((b, k) => rows.push([T0 + (k + 2) * 3600, ...b]));
  return prepare(rows);
};

test('T1 fade: sell after an up shock, stop $0.30 above its high, target its 50%; stop first in one candle', () => {
  const C = frame([1000, 1010, 1000, 1009], [[1009, 1009.2, 1004.8, 1005]]);
  const s = spec(C, 1, 'fade');
  assert.equal(s.side, -1); assert.equal(s.E, 1009); assert.equal(+s.stop.toFixed(2), 1010.3); assert.equal(s.target, 1005);
  const r = sim(C, 1, 'fade');
  assert.equal(r.why, 'target'); assert.equal(+r.gross.toFixed(4), +(4 / 1.3).toFixed(4));
  assert.equal(+r.net.toFixed(4), +((4 - 0.6) / 1.3).toFixed(4), 'a sell pays the spread only');
  const both = sim(frame([1000, 1010, 1000, 1009], [[1009, 1011, 1004, 1005]]), 1, 'fade');
  assert.equal(both.why, 'stop'); assert.equal(+both.gross.toFixed(4), -1);
  const gapped = sim(frame([1000, 1010, 1000, 1009], [[1009, 1009.1, 1008, 1008.5], [1012, 1013, 1011, 1012]]), 1, 'fade');
  assert.equal(gapped.why, 'stop'); assert.equal(gapped.px, 1012, 'a stop gapped through fills at the open');
});

test('T1 fade on a down shock buys, and a buy pays financing over a rollover', () => {
  const C = prepare([[T0, 1000, 1000, 1000, 1000], [T0 + 3600, 1000, 1000, 990, 991],
    ...[0, 1, 2, 3, 4, 5].map((k) => [T0 + (k + 2) * 3600, 991, 991.5, 990.5, 991.2])]);
  const r = sim(C, 1, 'fade');
  assert.equal(r.side, 1); assert.equal(r.why, 'time'); assert.equal(r.nights, 0);
  const night = Date.UTC(2018, 0, 2, 19) / 1000;   // shock at 19:00 UTC, entry 20:00, out after 22:00
  const D = prepare([[night - 3600, 1000, 1000, 1000, 1000], [night, 1000, 1000, 990, 991],
    ...[0, 1, 2, 3, 4, 5].map((k) => [night + (k + 1) * 3600, 991, 991.5, 990.5, 991.2])]);
  const q = sim(D, 1, 'fade');
  assert.equal(q.nights, 1); assert.ok(Math.abs(q.fin - P.FIN * 991 / q.r0) < 1e-12);
  assert.ok(Math.abs(sim(D, 1, 'fade', 2).net - (q.gross - 2 * (0.6 / q.r0 + q.fin))) < 1e-12, '2x costs double spread and financing');
});

test('T2 follow: with the shock, stop at its 50%, out at the 6th candle; skips', () => {
  const after = [0, 1, 2, 3, 4, 5, 6].map((k) => [1009 + k, 1010 + k, 1008.5 + k, 1010 + k]);
  const r = sim(frame([1000, 1010, 1000, 1009], after), 1, 'follow');
  assert.equal(r.side, 1); assert.equal(r.stop, 1005); assert.equal(r.why, 'time'); assert.equal(r.px, 1015, 'closes at the 6th candle');
  assert.equal(spec(frame([1000, 1010, 1000, 1009], [[1004, 1005, 1003, 1004]]), 1, 'follow').skip, 'stop side');
  assert.equal(spec(frame([1000, 1010, 1000, 1009], [[1004.5, 1005, 1003, 1004]]), 1, 'fade').skip, 'target passed');
  assert.equal(spec(frame([1000, 1000.3, 1000, 1000.2], [[1000.35, 1000.4, 1000, 1000.1]]), 1, 'fade').skip, 'stop too close');
});

test('one position at a time: a shock before the last exit candle is skipped', () => {
  const after = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [1009, 1009.5, 1008.5, 1009]);
  const C = frame([1000, 1010, 1000, 1009], after);
  const { trades, funnel } = stream(C, [{ i: 1 }, { i: 3 }, { i: 7 }], 'follow');
  assert.equal(trades.length, 1); assert.equal(funnel.busy, 1, 'the shock at 3 is inside the trade; the one at its exit candle is not busy');
  assert.equal(trades[0].xi, 7);
});

test('release tag: payrolls, CPI and FOMC minutes fall in their H1 candle; the broad tag is the 08:00 New York hour', () => {
  const rel = releaseTimes();
  const nfp = Date.UTC(2019, 1, 1, 13, 30) / 1000;    // 1 Feb 2019 08:30 New York
  assert.equal(blsDate(2019, 1), '2019-02-01');
  assert.equal(releaseIn(Date.UTC(2019, 1, 1, 13) / 1000, rel), 'NFP');
  assert.equal(releaseIn(Date.UTC(2019, 1, 1, 14) / 1000, rel), null);
  assert.ok(rel.some((x) => x.t === nfp));
  assert.equal(releaseIn(Date.UTC(2015, 2, 18, 18) / 1000, rel), 'FOMC');        // 14:00 New York (EDT)
  assert.equal(releaseIn(Date.UTC(2010, 0, 27, 19) / 1000, rel), 'FOMC');        // 14:15 New York (EST)
  assert.equal(releaseIn(Date.UTC(2023, 4, 10, 12) / 1000, rel), 'CPI');         // 2023-05-10 08:30 EDT
  assert.equal(broad830(Date.UTC(2023, 4, 10, 12) / 1000), true);
  assert.equal(broad830(Date.UTC(2023, 4, 13, 12) / 1000), false, 'a Saturday');
});

test('statistics: month sums, Holm, windows', () => {
  const tr = [{ te: Date.UTC(2020, 0, 3) / 1000, net: 1 }, { te: Date.UTC(2020, 0, 9) / 1000, net: 1 }, { te: Date.UTC(2020, 1, 3) / 1000, net: 1 }, { te: Date.UTC(2020, 2, 3) / 1000, net: 3 }];
  const m = monthT(tr); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 2 / Math.sqrt(1 / 3)) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.equal(inW(Date.UTC(2016, 11, 31) / 1000, P.IS), true); assert.equal(inW(Date.UTC(2017, 0, 1) / 1000, P.IS), false);
});

test('the report says what result.json says', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(pre, /not a gate, exit, entry or size of the live gold book/);
  assert.equal(R.headline, headline(R)); assert.ok(md.includes(R.headline)); assert.ok(R.headline.length < 220);
  assert.match(R.headline, /^\*\*Verdict: (PASS|FAIL)/);
  assert.equal(R.verdict, R.passed.length ? 'PASS' : 'FAIL');
  for (const k of ['T1', 'T2', 'T3']) {
    const x = R.tests[k];
    assert.equal(x.pass, Object.values(x.checks).every(Boolean));
    assert.equal(x.checks.oosPos, x.oos.net > 0); assert.equal(x.checks.n, x.oos.n >= 30); assert.equal(x.checks.placebo, x.placebo.beats >= 38);
    assert.equal(x.placebo.seeds, 40);
    assert.equal(x.trades.length, x.funnel.trades);
    assert.equal(x.trades.filter((r) => inW(r[0], P.OOS)).length, x.oos.n);
    for (const r of x.trades) assert.ok(r[2] >= P.MIN_R, 'every trade has a stop at least $0.30 away');
    assert.ok(md.includes(`| ${k} ${x.name} | OOS 2017-now | ${x.oos.n} |`));
    assert.ok(md.includes(`${x.placebo.beats} of 40`));
  }
  assert.equal(R.verdict, 'FAIL');
});
