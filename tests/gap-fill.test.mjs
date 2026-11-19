// research/edge/gap-fill: fading the 09:30 New York opening gap. Offline: the calendar, the gap with no look-ahead, the trade
// on hand-made candles (stop first, time exit), the statistics, and RESULT.md against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as G from '../research/edge/gap-fill/run.mjs';

const { nyTime, nyOffsetH, nyse, dayKind, gapOf, dayTrade, simTrade, filled, sessions, monthT, holm, report, decide, COST } = G;
const DIR = new URL('../research/edge/gap-fill/', import.meta.url);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);

test('gap-fill: DST-correct 09:30 and 16:00 New York (US / Europe mismatch weeks)', () => {
  assert.equal(iso(nyTime(2026, 2, 6, 9, 30)), '2026-03-06T14:30');
  assert.equal(iso(nyTime(2026, 2, 9, 9, 30)), '2026-03-09T13:30');
  assert.equal(iso(nyTime(2026, 9, 30, 9, 30)), '2026-10-30T13:30');
  assert.equal(iso(nyTime(2026, 10, 2, 9, 30)), '2026-11-02T14:30');
  assert.equal(iso(nyTime(2016, 6, 1, 16, 0)), '2016-07-01T20:00');
  assert.equal(nyOffsetH(Date.UTC(2021, 2, 14, 6, 59) / 1000), -5);
  assert.equal(nyOffsetH(Date.UTC(2021, 2, 14, 7, 0) / 1000), -4);
});

test('gap-fill: NYSE holidays, early closes, and the session list', () => {
  for (const d of ['2016-03-25', '2018-12-05', '2021-07-05', '2022-06-20', '2025-01-09', '2026-11-26']) assert.ok(nyse(+d.slice(0, 4)).closed.has(d), d);
  assert.ok(!nyse(2021).closed.has('2021-12-31'));
  for (const d of ['2018-07-03', '2025-11-28', '2026-12-24']) assert.ok(nyse(+d.slice(0, 4)).early.has(d), d);
  assert.equal(dayKind(2025, 10, 28), 'early');
  const s = sessions('2025-11-24', '2025-12-02').map(([y, m, d, k]) => `${d}${k[0]}`);
  assert.deepEqual(s, ['24t', '25t', '26t', '28e', '1t', '2t']); // Thanksgiving out, the Friday after early
});

test('gap-fill: the calendar equals orb-nas100 when that study is present', async () => {
  const f = new URL('../research/edge/orb-nas100/run.mjs', import.meta.url);
  if (!fs.existsSync(f)) return;
  const O = await import(f);
  for (let y = 2015; y <= 2027; y++) {
    assert.deepEqual([...G.nyse(y).closed].sort(), [...O.nyse(y).closed].sort(), `closed ${y}`);
    assert.deepEqual([...G.nyse(y).early].sort(), [...O.nyse(y).early].sort(), `early ${y}`);
    for (const [m, d] of [[0, 15], [2, 10], [6, 1], [10, 3]]) assert.equal(G.nyTime(y, m, d, 9, 30), O.nyTime(y, m, d, 9, 30));
  }
  const tr = [{ day: '2021-01-04', net: 1 }, { day: '2021-02-05', net: -0.4 }, { day: '2021-03-01', net: 0.7 }];
  assert.deepEqual(G.monthT(tr), O.monthT(tr));
  assert.deepEqual(G.holm([0.2, 0.01, 0.03]), O.holm([0.2, 0.01, 0.03]));
  const a = G.rng(7), b = O.rng(7); for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

// previous session Mon 9 Jun 2025, the trade day Tue 10 Jun 2025 (both EDT)
const PREV = [2025, 5, 9], CUR = [2025, 5, 10];
const P930 = nyTime(...PREV, 9, 30), P1555 = nyTime(...PREV, 15, 55), T930 = nyTime(...CUR, 9, 30);
function market({ prevOpen = 100, prevClose = 100.5, open, rest = [] }) {
  const m = new Map([[P930, [P930, prevOpen, prevOpen + 0.1, prevOpen - 0.1, prevOpen]], [P1555, [P1555, prevClose, prevClose, prevClose, prevClose]]]);
  m.set(T930, [T930, open, open + 0.05, open - 0.05, open]);
  rest.forEach((b, i) => { if (b) { const t = T930 + 300 * (i + 1); m.set(t, [t, ...b]); } });
  return m;
}

test('gap-fill: the gap reads only the previous close and the 09:30 open (no look-ahead)', () => {
  const m = market({ open: 101, rest: [[101, 101, 101, 101]] });
  const g = gapOf(m, PREV, CUR);
  assert.equal(g.P, 100.5); assert.equal(g.O, 101); assert.equal(g.g, 0.5); assert.equal(g.prevDir, 1);
  // any candle after 09:30 can change, the gap does not
  const m2 = new Map(m); for (let t = T930 + 300; t < T930 + 6 * 3600; t += 300) m2.set(t, [t, 50, 200, 1, 77]);
  assert.deepEqual(gapOf(m2, PREV, CUR), g);
  // a candle of the previous day after 15:55 (the 16:00 one) is not the close
  const m3 = new Map(m); const t16 = nyTime(...PREV, 16, 0); m3.set(t16, [t16, 1, 1, 1, 1]);
  assert.equal(gapOf(m3, PREV, CUR).P, 100.5);
});

test('gap-fill: side against the gap, target the previous close, 1R stop, stop first in one candle', () => {
  // gap up +0.5 % (100.5 → 101.0): sell at the 09:35 open 101.0, target 100.5, stop 101.5
  const both = market({ open: 101, rest: [[101, 101.6, 100.4, 101]] });
  const x = dayTrade(both, PREV, CUR);
  assert.equal(x.side, -1); assert.equal(x.target, 100.5); assert.equal(x.stop, 101.5); assert.equal(x.how, 'stop'); assert.equal(x.R, -1);
  const win = market({ open: 101, rest: [[101, 101.2, 100.4, 100.6]] });
  assert.equal(dayTrade(win, PREV, CUR).how, 'target');
  assert.equal(dayTrade(win, PREV, CUR, { cost: 0.1 }).net, 1 - 0.1 / 0.5);
  // the variant flag: prior session up (100 → 100.5), gap up = with it, not against
  assert.equal(x.against, false);
  const down = market({ open: 100, prevOpen: 100, prevClose: 100.5, rest: [[100, 100.1, 99.9, 100]] }); // gap −0.5 %, against the up day
  const y = dayTrade(down, PREV, CUR); assert.equal(y.side, 1); assert.equal(y.against, true);
});

test('gap-fill: time exit at the 15:55 close; band and already-filled skips', () => {
  const rest = [[101, 101.1, 100.9, 101]]; const last = nyTime(...CUR, 15, 55) - T930; rest[last / 300 - 1] = [100.9, 100.95, 100.85, 100.8];
  const x = dayTrade(market({ open: 101, rest }), PREV, CUR);
  assert.equal(x.how, 'time'); assert.equal(x.exit, 100.8); assert.ok(Math.abs(x.R - 0.4) < 1e-9);
  assert.equal(dayTrade(market({ open: 100.6, rest }), PREV, CUR).skip, 'band');   // 0.1 %
  assert.equal(dayTrade(market({ open: 102.5, rest }), PREV, CUR).skip, 'band');   // 2 %
  assert.equal(dayTrade(market({ open: 101, rest: [[100.4, 100.5, 100.3, 100.4]] }), PREV, CUR).skip, 'filled');
  assert.equal(dayTrade(market({ open: 101 }), PREV, CUR).skip, 'missing');        // no 09:35 candle
  // a candle that opens through the stop exits at its open
  const gap = simTrade(new Map([[T930 + 300, [T930 + 300, 101, 101, 101, 101]], [T930 + 600, [T930 + 600, 102, 102, 102, 102]]]), ...CUR, -1, 101, 0.5);
  assert.equal(gap.how, 'stop'); assert.equal(gap.exit, 102); assert.equal(gap.R, -2);
});

test('gap-fill: fill rate counts a touch of the previous close from 09:30 on', () => {
  const m = market({ open: 101, rest: [[101, 101.1, 100.6, 100.7], [100.7, 100.8, 100.5, 100.6]] });
  assert.equal(filled(m, CUR, 100.5, 101), true);
  assert.equal(filled(market({ open: 101, rest: [[101, 101.1, 100.6, 100.7]] }), CUR, 100.5, 101), false);
});

test('gap-fill: statistics, the decision and RESULT.md equal result.json', () => {
  const tr = [{ day: '2021-01-04', net: 1 }, { day: '2021-01-05', net: -0.5 }, { day: '2021-02-01', net: 1 }, { day: '2021-03-01', net: -1 }];
  const mt = monthT(tr); assert.equal(mt.months, 3);
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]), [0.04, 0.09, 0.09, 0.5]);
  assert.deepEqual(COST, { nas100: 2, spx500: 1 });
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  assert.equal(fs.readFileSync(new URL('RESULT.md', DIR), 'utf8'), report(R));
  assert.deepEqual(decide(R.markets), R.decision);
  assert.equal(Object.keys(R.decision.byTest).length, 4);
  assert.ok(R.verdict.startsWith(R.decision.verdict));
  for (const k of ['nas100', 'spx500']) for (const r of ['all', 'against']) assert.equal(R.markets[k].tests[r].placebo.values.length, 40);
});
