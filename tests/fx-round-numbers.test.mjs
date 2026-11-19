// fx-round-numbers (research/edge/fx-round-numbers): the grid and touches, T1 (stall) and T2 (break) on hand-made M15 candles,
// no look-ahead in either, the exits, the cost maths, the placebo draw, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, gridOf, touched, stall, breaks, costPx, manage, monthT, holm, placeboOff, rng, report } from '../research/edge/fx-round-numbers/run.mjs';

const T0 = Date.UTC(2024, 5, 3) / 1000; // Monday 3 Jun 2024 00:00 UTC
const bar = (i, o, h, l, c) => ({ time: T0 + i * 900, open: o, high: h, low: l, close: c });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
// 30 hours of flat candles at `px`, then the given [o, h, l, c] rows
function path(px, rows) { const B = []; for (let i = 0; i < 120; i++) B.push(bar(i, px, px + 0.0002, px - 0.0002, px)); rows.forEach((r, j) => B.push(bar(120 + j, ...r))); return B; }

test('grid: 100-pip steps (1.1000 / 150.00), the "50" control and a shifted grid; a touch is low <= L <= high', () => {
  const g = gridOf('eurusd'); assert.ok(near(g.G, 0.01)); assert.ok(near(g.at(110), 1.1));
  const j = gridOf('usdjpy'); assert.ok(near(j.G, 1)); assert.ok(near(j.at(150), 150));
  assert.ok(near(gridOf('eurusd', 0.5).at(109), 1.095));
  assert.deepEqual(touched(g, { low: 1.0995, high: 1.1001 }), [110]);
  assert.deepEqual(touched(g, { low: 1.1, high: 1.1004 }), [110]);
  assert.deepEqual(touched(g, { low: 1.1001, high: 1.1099 }), []);
  assert.deepEqual(touched(g, { low: 1.0950, high: 1.1150 }), [110, 111]);
  assert.deepEqual(touched(j, { low: 149.9, high: 150.0 }), [150]);
  const u = rng(1); assert.equal(placeboOff(1), u()); assert.ok(placeboOff(7) >= 0 && placeboOff(7) < 1);
});

test('T1: sell the first touch of a fresh level from below, stop and target 15 pips, target reached', () => {
  const B = path(1.0950, [[1.0990, 1.1003, 1.0988, 1.0998], [1.0998, 1.0999, 1.0990, 1.0992], [1.0992, 1.0993, 1.0984, 1.0986]]);
  const t = stall('eurusd', B);
  assert.equal(t.length, 1); const x = t[0];
  assert.equal(x.side, -1); assert.ok(near(x.entry, 1.1)); assert.ok(near(x.stop, 1.1015)); assert.ok(near(x.target, 1.0985));
  assert.equal(x.at, B[120].time); assert.equal(x.exit, 'target'); assert.ok(near(x.gross, 1));
  // a limit entry and a target exit: spread + commission only
  assert.ok(near(x.net, 1 - (0.3e-4 + 2 * 22.5e-6 * 1.1) / 0.0015, 1e-9));
  // buy from above, mirrored
  const C = path(1.1050, [[1.1010, 1.1012, 1.0997, 1.1002], [1.1002, 1.1016, 1.1001, 1.1014]]);
  const y = stall('eurusd', C)[0]; assert.equal(y.side, 1); assert.equal(y.exit, 'target'); assert.ok(near(y.gross, 1));
});

test('T1: a level touched in the last 24 hours is not fresh; the first 24 hours of the file never trade', () => {
  const B = path(1.0950, [[1.0990, 1.1003, 1.0988, 1.0998], [1.0998, 1.0999, 1.0980, 1.0985]]);
  B[100] = bar(100, 1.0995, 1.1001, 1.0990, 1.0996); // touched 5 h before
  const t = stall('eurusd', B);
  assert.equal(t.filter((x) => x.at === B[120].time).length, 0, 'not fresh 5 h after a touch');
  assert.equal(t.filter((x) => x.at === B[100].time).length, 1, 'the earlier touch was the fresh one');
  const C = [bar(0, 1.0990, 1.1003, 1.0988, 1.0998), bar(1, 1.0998, 1.0999, 1.0980, 1.0985)];
  assert.equal(stall('eurusd', C).length, 0);
});

test('T1: in the fill candle only the stop counts; a gap past the level fills at the open; a gap past the stop is no trade', () => {
  const S = path(1.0950, [[1.0990, 1.1016, 1.0984, 1.1010]]);
  const s = stall('eurusd', S)[0]; assert.equal(s.exit, 'stop'); assert.ok(near(s.gross, -1));
  const T = path(1.0950, [[1.0990, 1.1003, 1.0980, 1.0981], [1.0981, 1.0983, 1.0970, 1.0975]]);
  const t = stall('eurusd', T)[0]; assert.equal(t.exit, 'target'); assert.equal(t.exitAt, T[121].time, 'the target in the fill candle does not count');
  const G = path(1.0950, []); G.push(bar(120, 1.1005, 1.1006, 1.0990, 1.0995), bar(121, 1.0995, 1.0996, 1.0980, 1.0982));
  G[119] = bar(119, 1.0990, 1.0995, 1.0985, 1.0990);
  const g = stall('eurusd', G)[0]; assert.ok(near(g.entry, 1.1005)); assert.ok(near(g.r0, 0.0010));
  const H = path(1.0950, []); H[119] = bar(119, 1.0990, 1.0995, 1.0985, 1.0990); H.push(bar(120, 1.1020, 1.1022, 1.0995, 1.1000));
  assert.equal(stall('eurusd', H).length, 0);
});

test('T1 and T2: no look-ahead; changing every candle after the decision changes neither the trade nor its entry', () => {
  const B = path(1.0950, [[1.0990, 1.1003, 1.0988, 1.0998], [1.0998, 1.0999, 1.0980, 1.0985], [1.0985, 1.0986, 1.0980, 1.0982]]);
  const a = stall('eurusd', B)[0], C = B.map((b) => ({ ...b }));
  C[121] = bar(121, 1.0998, 1.0999, 1.0990, 1.0995); C[122] = bar(122, 1.0995, 1.0996, 1.0994, 1.0995);
  const b = stall('eurusd', C)[0];
  for (const k of ['side', 'entry', 'stop', 'target', 'at', 'k']) assert.equal(b[k], a[k]);
  const D = path(1.0990, [[1.0994, 1.1008, 1.0993, 1.1006], [1.1007, 1.1010, 1.1004, 1.1009], [1.1009, 1.1050, 1.1008, 1.1045]]);
  const u = breaks('eurusd', D).find((t) => t.k === 110), E = D.map((x) => ({ ...x })); E[122] = bar(122, 1.1009, 1.1010, 1.0970, 1.0975);
  const v = breaks('eurusd', E).find((t) => t.k === 110);
  for (const k of ['side', 'entry', 'stop', 'target', 'at']) assert.equal(v[k], u[k]);
  assert.notEqual(v.exit, u.exit);
});

test('T2: the first close 5 pips beyond a touched level, market at the next open, stop 15 pips back past it, target 1.5R', () => {
  const D = path(1.0990, [[1.0994, 1.1008, 1.0993, 1.1006], [1.1007, 1.1010, 1.1004, 1.1009], [1.1009, 1.1050, 1.1008, 1.1045]]);
  const t = breaks('eurusd', D).filter((x) => x.k === 110);
  assert.equal(t.length, 1); const x = t[0];
  assert.equal(x.side, 1); assert.ok(near(x.entry, 1.1007)); assert.ok(near(x.stop, 1.0985)); assert.ok(near(x.r0, 0.0022));
  assert.ok(near(x.target, 1.1007 + 1.5 * 0.0022)); assert.equal(x.at, D[121].time); assert.equal(x.exit, 'target'); assert.ok(near(x.gross, 1.5));
  // market entry + limit target: spread + commission + one slippage
  assert.ok(near(x.net, 1.5 - (0.3e-4 + 2 * 22.5e-6 * 1.1007 + 0.5e-4) / 0.0022, 1e-9));
  // a close only 4 pips beyond: no break; the previous close already 5 pips beyond: not the first; no touch: no break
  assert.equal(breaks('eurusd', path(1.0990, [[1.0994, 1.1008, 1.0993, 1.1004], [1.1004, 1.1005, 1.1003, 1.1004]])).filter((y) => y.k === 110).length, 0);
  const F = path(1.0990, [[1.0994, 1.1008, 1.0993, 1.1006], [1.1006, 1.1012, 1.1005, 1.1010], [1.1010, 1.1011, 1.1009, 1.1010]]);
  assert.equal(breaks('eurusd', F).filter((y) => y.k === 110).length, 1);
  const N = path(1.1003, []); N[119] = bar(119, 1.1003, 1.1004, 1.1002, 1.1003); N.push(bar(120, 1.1003, 1.1008, 1.1002, 1.1006), bar(121, 1.1006, 1.1007, 1.1005, 1.1006));
  assert.equal(breaks('eurusd', N).filter((y) => y.k === 110 && y.at === N[121].time).length, 0);
  // a break down, mirrored; USD/JPY in sen
  const J = []; for (let i = 0; i < 10; i++) J.push(bar(i, 150.1, 150.12, 150.08, 150.1)); J.push(bar(10, 150.05, 150.06, 149.9, 149.93), bar(11, 149.93, 149.95, 149.6, 149.62));
  const j = breaks('usdjpy', J).find((y) => y.k === 150); assert.equal(j.side, -1); assert.ok(near(j.stop, 150.15)); assert.ok(near(j.entry, 149.93)); assert.equal(j.exit, 'target');
});

test('T2: stop first in one candle, a gap through the stop exits at the open, out after 8 hours otherwise', () => {
  const S = path(1.0990, [[1.0994, 1.1008, 1.0993, 1.1006], [1.1007, 1.1050, 1.0980, 1.1000]]);
  assert.equal(breaks('eurusd', S).find((x) => x.k === 110).exit, 'stop');
  const G = path(1.0990, [[1.0994, 1.1008, 1.0993, 1.1006], [1.1007, 1.1010, 1.1004, 1.1009], [1.0970, 1.0975, 1.0960, 1.0965]]);
  const g = breaks('eurusd', G).find((x) => x.k === 110); assert.equal(g.exit, 'stop'); assert.ok(near(g.exitPx, 1.0970)); assert.ok(g.gross < -1);
  const rows = [[1.0994, 1.1008, 1.0993, 1.1006]]; for (let i = 0; i < 40; i++) rows.push([1.1007, 1.1010, 1.1004, 1.1008]);
  const H = path(1.0990, rows), h = breaks('eurusd', H).find((x) => x.k === 110);
  assert.equal(h.exit, 'time'); assert.equal(h.exitAt, H[121].time + 8 * 3600 - 900); assert.ok(near(h.exitPx, 1.1008));
  const m = manage(H, { side: 1, stop: 1.0985, target: 1.2, i: 121, stopOnly: false }, H[121].time + 3600); assert.equal(m.kind, 'time');
});

test('costs, month t and Holm', () => {
  assert.ok(near(costPx('eurusd', 1.1, 1), 0.3e-4 + 2 * 22.5e-6 * 1.1 + 0.5e-4));
  assert.ok(near(costPx('usdjpy', 150, 2, 2), 2 * (0.003 + 2 * 22.5e-6 * 150 + 0.01)));
  const tr = [{ at: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { at: Date.UTC(2020, 2, 5) / 1000, net: 1 }];
  const m = monthT(tr, Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 3, 1) / 1000); assert.equal(m.months, 3);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(K.X_PIPS, 15); assert.equal(K.Y_PIPS, 5); assert.equal(K.HOLD_S, 8 * 3600); assert.equal(K.FRESH_S, 24 * 3600); assert.equal(K.SEEDS, 40);
});

test('RESULT.md is the report of result.json, and the verdicts follow the pre-registered tests', () => {
  const dir = new URL('../research/edge/fx-round-numbers/', import.meta.url);
  const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const rd = fs.existsSync(new URL('READING.md', dir)) ? fs.readFileSync(new URL('READING.md', dir), 'utf8') : '';
  assert.equal(fs.readFileSync(new URL('RESULT.md', dir), 'utf8'), report(R, rd));
  let pass = 0;
  for (const r of ['T1', 'T2']) {
    const V = R.rules[r];
    assert.equal(V.tests['decisive n >= 300'], V.real.decisive.n >= 300);
    assert.equal(V.tests['decisive net R a trade > 0'], V.real.decisive.net > 0);
    assert.equal(V.tests['replication net R a trade > 0'], V.real.replication.net > 0);
    assert.equal(V.tests['decisive month-sum t >= 2'], V.real.decisive.t >= 2);
    assert.equal(V.tests['beats the placebo 95th percentile'], V.real.decisive.net > V.placebo.p95);
    assert.equal(V.placebo.means.length, 40);
    assert.equal(V.verdict, Object.values(V.tests).every(Boolean) ? 'PASS' : 'FAIL');
    if (V.verdict === 'PASS') pass++;
  }
  assert.ok(R.verdict.startsWith(`${pass ? 'PASS' : 'FAIL'}: ${pass} of 2`));
  assert.match(fs.readFileSync(new URL('RESULT.md', dir), 'utf8').split('\n')[2], /^\*\*Verdict: (PASS|FAIL)/);
});
