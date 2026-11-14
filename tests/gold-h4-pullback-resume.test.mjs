// gold-h4-pullback-resume: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { h4Start, toH4, breakout, triggers, simulate, levels, runTest, TESTS, holm, monthT, rng, RT, BUF, HOLD, N, RECENT }
  from '../research/edge/gold-h4-pullback-resume/run.mjs';

const dir = new URL('../research/edge/gold-h4-pullback-resume/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const H = 3600, at = (s) => Date.parse(s) / 1000;
const T0 = at('2020-01-06T22:00:00Z');   // Monday 17:00 New York (winter): an H4 block start

// 21 flat H4 blocks at 100 (range 99.5-100.5), a breakout block to 107 (high 108), then the given H1 candles, then padding
function scenario(after, pad = 60, padPx = null) {
  const h1 = []; let t = T0; const push = (o, h, l, c) => { h1.push([t, o, h, l, c]); t += H; };
  for (let b = 0; b < 21; b++) for (let k = 0; k < 4; k++) push(100, 100.5, 99.5, 100);
  push(100, 102, 99.8, 101.8); push(101.8, 104, 101.7, 103.9); push(103.9, 108, 103.8, 107.5); push(107.5, 107.6, 106.8, 107);
  for (const x of after) push(...x);
  const p = padPx ?? h1.at(-1)[4];
  for (let k = 0; k < pad; k++) push(p, p + 0.05, p - 0.05, p);
  return h1;
}
// pullback from 107 to a low of 104 (≥ 38.2 % of the 99.5 -> 108 leg), then a close above the recent highs
const PULL = [[107, 107.1, 106, 106.2], [106.2, 106.3, 105, 105.1], [105.1, 105.2, 104, 104.3], [104.3, 104.9, 104.2, 104.8], [104.8, 105.4, 104.7, 105.3]];
const mirror = (h1) => h1.map(([t, o, h, l, c]) => [t, 200 - o, 200 - l, 200 - h, 200 - c]);

test('H4 blocks start at 17:00 New York, daylight saving correct', () => {
  assert.equal(h4Start(at('2024-07-10T23:00:00Z')), at('2024-07-10T21:00:00Z'));   // EDT: 17:00 NY = 21:00 UTC
  assert.equal(h4Start(at('2024-07-10T20:00:00Z')), at('2024-07-10T17:00:00Z'));
  assert.equal(h4Start(at('2024-01-10T23:00:00Z')), at('2024-01-10T22:00:00Z'));   // EST: 17:00 NY = 22:00 UTC
  assert.equal(h4Start(at('2024-01-11T05:00:00Z')), at('2024-01-11T02:00:00Z'));
  const c = toH4(scenario([]));
  assert.equal(c[0].time, T0); assert.equal(c[0].end, T0 + 4 * H);
  assert.equal(c[21].close, 107); assert.equal(c[21].high, 108);
  assert.equal(breakout(c, 21), 1); assert.equal(breakout(c, 20), 0); assert.equal(breakout(c, N - 1), 0);
});

test('a bullish setup: leg, 38.2 % pullback, trigger on the close above the recent highs', () => {
  const h1 = scenario(PULL), tr = triggers(h1, toH4(h1));
  assert.equal(tr.length, 1);
  const x = tr[0];
  assert.equal(x.side, 1); assert.equal(x.L, 99.5); assert.equal(x.X, 108); assert.equal(x.P, 104);
  assert.equal(x.k, 88 + 4); assert.equal(x.ref, 105.2);   // the 5th pullback candle closes 105.3 > 105.2 (the highs since the low)
  // the 4th candle (close 104.8) is not above the low candle's high (105.2): no earlier trigger
  const lv = levels(x, 105.3, 'leg'); assert.equal(lv.stop, 104 - BUF); assert.equal(lv.target, 108);
  assert.equal(levels(x, 106, 'leg'), null);            // target under 1.5R away: skipped
  assert.ok(Math.abs(levels(x, 106, 'fixed').target - (106 + 2 * (106 - 103.7))) < 1e-9);
});

test('the setup dies on a close below the leg start, on a shallow pullback, or after 30 H4 candles', () => {
  const below = [[107, 107, 99, 99.4], ...PULL.slice(2)];
  let h1 = scenario(below); assert.equal(triggers(h1, toH4(h1)).length, 0);
  const shallow = [[107, 107.1, 106, 106.2], [106.2, 106.3, 105.5, 105.6], [105.6, 106.4, 105.5, 106.3]];   // 108-105.5 < 38.2 % of 8.5
  h1 = scenario(shallow); assert.equal(triggers(h1, toH4(h1)).length, 0);
  const wait = Array.from({ length: RECENT * 4 }, () => [106.9, 107.0, 106.7, 106.8]);   // drifting for 30 H4 candles first
  // a wick to 104 (closes stay at the drift's 106.8, so no H4 breakdown), then a close above the recent highs
  const WICK = [[106.9, 107, 104, 106.8], [106.8, 107.5, 106.7, 107.4]];
  h1 = scenario([...wait, ...WICK]); assert.equal(triggers(h1, toH4(h1)).length, 0);
  const short = Array.from({ length: (RECENT - 3) * 4 }, () => [106.9, 107.0, 106.7, 106.8]);
  h1 = scenario([...short, ...WICK]); assert.equal(triggers(h1, toH4(h1)).length, 1);
  h1 = scenario([...wait, ...PULL]);   // the deep pullback after a long drift is itself an H4 breakdown: a sell setup, not a buy
  assert.ok(triggers(h1, toH4(h1)).every((x) => x.side < 0));
});

test('sells are the exact mirror', () => {
  const h1 = mirror(scenario(PULL)), tr = triggers(h1, toH4(h1));
  assert.equal(tr.length, 1); assert.equal(tr[0].side, -1);
  assert.equal(tr[0].L, 100.5); assert.equal(tr[0].X, 92); assert.equal(tr[0].P, 96); assert.equal(tr[0].k, 92);
  assert.equal(levels(tr[0], 94.7, 'leg').stop, 96 + BUF);
});

test('no look-ahead: changing every price after a candle leaves every trigger up to it', () => {
  const h1 = scenario(PULL, 200), base = triggers(h1, toH4(h1));
  const r = rng(5);
  for (const cut of [60, 88, 90, 92, 93, 120]) {
    const b = h1.map((x, q) => (q <= cut ? x : [x[0], 50 + 150 * r(), 300, 1, 50 + 150 * r()]));
    const tb = triggers(b, toH4(b)).filter((x) => x.k <= cut);
    assert.deepEqual(tb, base.filter((x) => x.k <= cut), `cut ${cut}`);
    const tt = triggers(h1.slice(0, cut + 1), toH4(h1.slice(0, cut + 1)));
    assert.deepEqual(tt, base.filter((x) => x.k <= cut), `truncated ${cut}`);
  }
});

test('trade: entry next open, stop first in a shared candle, gap fill, time exit after 48 H1, financing on buys only', () => {
  let h1 = scenario([...PULL, [105.3, 120, 90, 105]]);   // stop and target in one candle
  let tr = triggers(h1, toH4(h1))[0], lv = levels(tr, 105.3, 'leg');
  let t = simulate(h1, null, null, tr.k + 1, 1, lv.stop, lv.target);
  assert.equal(t.how, 'stop'); assert.equal(t.entry, 105.3); assert.ok(Math.abs(t.gross + 1) < 1e-9);
  assert.ok(Math.abs(t.cost - RT / t.risk) < 1e-12);
  h1 = scenario([...PULL, [105.3, 105.4, 105.2, 105.3], [102, 102.2, 101, 101.5]]);   // gaps through the stop
  tr = triggers(h1, toH4(h1))[0]; t = simulate(h1, null, null, tr.k + 1, 1, 103.7, 108);
  assert.equal(t.exit, 102); assert.ok(t.gross < -1);
  h1 = scenario([...PULL, [105.3, 109, 105.2, 108.5]]); tr = triggers(h1, toH4(h1))[0];
  t = simulate(h1, null, null, tr.k + 1, 1, 103.7, 108); assert.equal(t.how, 'target'); assert.equal(t.exit, 108);
  h1 = scenario(PULL, 80, 105.5); tr = triggers(h1, toH4(h1))[0];
  t = simulate(h1, null, null, tr.k + 1, 1, 103.7, 108);
  assert.equal(t.how, 'time'); assert.equal(t.exitT, h1[tr.k + HOLD][0] + H); assert.ok(t.nights >= 1 && t.fin > 0);
  const s = simulate(mirror(h1), null, null, tr.k + 1, -1, 96.3, 92); assert.equal(s.fin, 0);
  // M5 inside an hour decides the order: target first in M5 although the H1 candle also touches the stop
  h1 = scenario([...PULL, [105.3, 108.2, 103, 104]]); tr = triggers(h1, toH4(h1))[0];
  const e = tr.k + 1, hs = h1[e][0], m5 = [[hs, 105.3, 108.2, 105.2, 108], [hs + 300, 108, 108, 103, 104]];
  t = simulate(h1, m5, new Map([[hs, [0, 2]]]), e, 1, 103.7, 108); assert.equal(t.how, 'target');
  assert.equal(simulate(h1, null, null, e, 1, 103.7, 108).how, 'stop');
});

test('one position at a time; Holm; month t', () => {
  const h1 = scenario(PULL), trig = triggers(h1, toH4(h1));
  const T = runTest(h1, null, null, [...trig, { ...trig[0], k: trig[0].k + 2 }], TESTS.T2);
  assert.equal(T.length, 1);   // the second signal falls inside the open position
  assert.equal(runTest(h1, null, null, trig, TESTS.T3).length, 1);
  assert.equal(runTest(mirror(h1), null, null, triggers(mirror(h1), toH4(mirror(h1))), TESTS.T3).length, 0);   // T3: buys only
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  const m = monthT([{ exitT: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { exitT: Date.UTC(2020, 1, 5) / 1000, net: 1 }], ['2020-01-01', '2020-03-31']);
  assert.equal(m.months, 3);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passAlone, []);
  for (const k of ['T1', 'T2', 'T3']) assert.equal(R.tests[k].pass, false);
  const v = MD.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(v && v.length < 220 + 6, 'verdict line length');
  assert.match(v, /FAIL, 0 of 3/);
  const t1 = R.tests.T1;
  const sgn = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
  assert.ok(v.includes(`${sgn(t1.oos.net)}R`) && v.includes(`n ${t1.oos.n}`) && v.includes(`t ${sgn(t1.oos.t, 2)}`) && v.includes(sgn(t1.is.net)));
  for (const [k, x] of Object.entries(R.tests)) {
    const row = MD.split('\n').find((l) => l.startsWith(`| ${k} `)); assert.ok(row, k);
    for (const s of [`| ${x.is.n} |`, `| ${x.oos.n} |`, `${sgn(x.oos.gross)} / ${sgn(x.oos.net)}`, `${sgn(x.is.gross)} / ${sgn(x.is.net)}`,
      `${sgn(x.oos.tGross, 2)} / ${sgn(x.oos.t, 2)}`, `${sgn(x.is.tGross, 2)} / ${sgn(x.is.t, 2)}`, sgn(x.oos.net2x),
      `${x.placebo.beaten} of ${x.placebo.of}`, x.holm.toFixed(3)]) assert.ok(row.includes(s), `${k}: ${s}`);
  }
  assert.ok(MD.includes(`median stop $${t1.oos.medianStop.toFixed(2)} OOS`));
});
