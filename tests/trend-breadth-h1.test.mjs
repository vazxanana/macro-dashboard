// Trend breadth on hourly candles (research/edge/trend-breadth-h1): the hourly harness on hand-made candles (entry at the
// next hour's open, a stop on every unit, a ratchet that never loosens, the add, the re-entry inside a day, the mirror, no
// look-ahead), costs and financing, the statistics, the pre-registered bar, and the written report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, atr, simulate, unitNet, positions, stat, monthly, normP, holm, windowStats, verdictOf, parity } from '../research/edge/trend-breadth-h1/run.mjs';
import { MARKETS, COST } from '../research/edge/trend-breadth-h1/markets.mjs';
import { nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/trend-breadth-h1/PREREGISTRATION.md'), RUN = rd('../research/edge/trend-breadth-h1/run.mjs');
const DAY = 86400, HOUR = 3600, T0 = Date.UTC(2021, 0, 4) / 1000;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
// days: [{ o, h, l, c }] → D1 candles and 24 H1 candles a day: flat at the open, the high in hour 11, the low in hour 12, the
// close in hour 23. `drop` = day indexes with no H1 candles (a shut market).
function mk(days, drop = []) {
  const D = [], H = [];
  days.forEach((d, i) => {
    const t = T0 + i * DAY; D.push({ time: t, open: d.o, high: d.h, low: d.l, close: d.c });
    if (drop.includes(i)) return;
    for (let k = 0; k < 24; k++) {
      const b = { time: t + k * HOUR, open: d.o, high: d.o, low: d.o, close: d.o };
      if (k === 11) b.high = d.h; if (k === 12) b.low = d.l;
      if (k === 23) { b.close = d.c; b.high = Math.max(d.o, d.c); b.low = Math.min(d.o, d.c); }
      H.push(b);
    }
  });
  return { D, H };
}
const flat = (n, px = 100) => Array.from({ length: n }, () => ({ o: px, h: px + 1, l: px - 1, c: px }));
const BRK = { o: 100, h: 103, l: 99.5, c: 102.5 };

test('the constants, the market list and the costs are the pre-registered ones', () => {
  assert.deepEqual([P.N, P.K, P.ATR, P.ADD, P.PARITY.n, P.PARITY.g, P.FIN_LONG, P.FIN_FX], [20, 2, 14, 1, 0.15, 0.15, 0.00015, 0.00004]);
  assert.deepEqual(Object.keys(MARKETS), 'xag nas100 spx500 us30 de40 jp225 eurusd gbpusd usdjpy audusd usdcad wtico bco'.split(' '));
  assert.deepEqual([COST.fx, COST.index, COST.mid], [0.00015, 0.0003, 0.001]);
  for (const [k, m] of Object.entries(MARKETS)) { assert.ok(PRE.includes('`' + k + '`'), k); assert.equal(m.sides, m.group === 'forex' ? 'both' : 'long'); }
  assert.ok(!Object.keys(MARKETS).includes('xau'), 'gold is the parity market, not a test');
  assert.match(PRE, /within \*\*15 %\*\*/); assert.match(PRE, /within \*\*0\.15R\*\*/); assert.match(PRE, /Holm-corrected over the fourteen tests/);
  assert.match(RUN, /import \{ stopFill, spotSkip, nights \} from '\.\.\/\.\.\/\.\.\/council\/fills\.mjs'/);
});

test('a breakout day buys at the next hour\'s open with a 2 ATR stop and is stopped at the stop', () => {
  const days = [...flat(40), BRK, { o: 102.5, h: 103, l: 97, c: 97.5 }, ...flat(3, 97.5)], { D, H } = mk(days);
  const U = simulate(H, D);
  assert.equal(U.length, 1);
  const u = U[0], A = atr(D, 40);
  assert.equal(u.t, D[41].time); near(u.e, 102.5); near(u.r0, 2 * A); assert.equal(u.why, 'stop'); near(u.R, -1);
  assert.equal(u.c, D[41].time + 12 * HOUR, 'closed on the hour its low reached the stop');
});

test('a stop gapped through fills at the open, not at the stop', () => {
  const days = [...flat(40), BRK, { o: 102.5, h: 103, l: 102, c: 102.8 }, { o: 90, h: 91, l: 89, c: 90 }, ...flat(2, 90)], { D, H } = mk(days);
  const u = simulate(H, D)[0];
  assert.equal(u.why, 'gap'); near(u.R, (90 - 102.5) / u.r0); assert.ok(u.R < -1);
});

test('a signal acts only within 24 hours of its day\'s close, and only when a candle starts at the run', () => {
  const days = [...flat(40), BRK, ...flat(4, 102.5)];
  assert.equal(simulate(mk(days, [41]).H, mk(days, [41]).D).length, 0, 'no hourly candle the next day: the signal is lost');
  assert.equal(simulate(mk(days).H, mk(days).D).length, 1);
});

test('the stop only ever moves up, every unit has one, and the add shares it', () => {
  const days = [...flat(40), BRK]; let px = 102.5;
  for (let i = 0; i < 18; i++) { days.push({ o: px, h: px + 2.2, l: px - 0.3, c: px + 2 }); px += 2; }
  for (let i = 0; i < 8; i++) { days.push({ o: px, h: px + 0.2, l: px - 6, c: px - 5 }); px -= 5; }
  const { D, H } = mk(days), U = simulate(H, D);
  const f = U.find((u) => !u.of), a = U.find((u) => u.of);
  assert.ok(f && a, 'a first unit and its add'); assert.equal(a.of, f.id);
  assert.ok(a.t > f.t && a.e > f.e && a.r0 > 0 && f.r0 > 0, 'the add is bought later, higher, with a positive risk');
  assert.equal(a.c, f.c, 'both leave on the same stop'); assert.ok(f.R > 1 && a.R < f.R);
  const stop = f.e + f.R * f.r0; assert.ok(stop > f.e - f.r0, 'the exit stop is above the first stop'); near(a.e + a.R * a.r0, stop, 1e-6);
  assert.equal(U.filter((u) => u.of).length, 1, 'one add only');
});

test('stopped out while the last closed day is an unused breakout: bought again inside the day', () => {
  const days = [...flat(40), BRK, { o: 102.5, h: 106, l: 102, c: 105.5 }, { o: 105.5, h: 106, l: 100, c: 104 }, ...flat(3, 104)], { D, H } = mk(days);
  const U = simulate(H, D), ps = positions(U, MARKETS.nas100);
  assert.equal(ps.length, 2);
  assert.equal(ps[0].t, D[41].time); assert.equal(ps[0].c, D[42].time + 12 * HOUR);
  assert.equal(ps[1].t, D[42].time + 13 * HOUR, 'the next hour after the stop-out'); assert.equal(ps[1].re, true); assert.equal(ps[0].re, undefined);
  assert.equal(ps[1].id, String(D[41].time), 'on the signal of the last closed day, used once');
  assert.equal(ps[1].end, true, 'still open at the end of the data: marked and flagged');
});

test('the mirror sells a breakdown when both sides are asked for, and never otherwise', () => {
  const days = [...flat(40), { o: 100, h: 100.5, l: 97, c: 97.5 }, { o: 97.5, h: 103, l: 97, c: 100 }, ...flat(3, 100)], { D, H } = mk(days);
  assert.equal(simulate(H, D).length, 0);
  const U = simulate(H, D, { sides: 'both' });
  assert.equal(U.length, 1); assert.equal(U[0].side, -1); near(U[0].e, 97.5); assert.equal(U[0].why, 'stop'); near(U[0].R, -1);
});

test('no look-ahead: units closed before a cut are the same with or without the candles after it', () => {
  const days = [...flat(40), BRK, { o: 102.5, h: 106, l: 102, c: 105.5 }, { o: 105.5, h: 106, l: 100, c: 104 }, ...flat(3, 104), { o: 104, h: 120, l: 80, c: 90 }, ...flat(5, 90)];
  const full = mk(days), cut = mk(days.slice(0, 44));
  const a = simulate(full.H, full.D).filter((u) => u.c < cut.D[43].time), b = simulate(cut.H, cut.D).filter((u) => u.c < cut.D[43].time);
  assert.ok(a.length >= 1); assert.deepEqual(a, b);
});

test('a unit pays its round trip and financing on its own risk; a currency pays on either side', () => {
  const u = { id: 'a', side: 1, t: Date.UTC(2021, 0, 4, 10) / 1000, c: Date.UTC(2021, 0, 11, 10) / 1000, e: 2000, r0: 40, R: 1.5 };
  assert.equal(nights(u.t, u.c), 7);
  const x = unitNet(u, MARKETS.nas100); near(x.cost, 0.0003 * 2000 / 40); near(x.fin, 7 * 0.00015 * 2000 / 40); near(x.n, 1.5 - x.cost - x.fin);
  near(unitNet(u, MARKETS.nas100, { mult: 2, fin: 0 }).n, 1.5 - 2 * x.cost);
  near(unitNet({ ...u, side: -1 }, MARKETS.eurusd).fin, 7 * 0.00004 * 2000 / 40); near(unitNet(u, MARKETS.wtico).cost, 0.001 * 2000 / 40);
});

test('statistics: monthly t, Holm, the normal tail', () => {
  near(stat([1, 2, 3]).t, 2 / (1 / Math.sqrt(3)));
  const from = Date.UTC(2021, 0, 1) / 1000, to = Date.UTC(2021, 2, 31) / 1000, rows = [{ c: from + 5 * DAY, n: 1 }, { c: from + 40 * DAY, n: 2 }, { c: to + 40 * DAY, n: 50 }];
  const m = monthly(rows, from, to); assert.equal(m.months, 3); near(m.sum, 3);
  near(normP(0), 0.5, 1e-6); assert.ok(Math.abs(normP(1.96) - 0.025) < 1e-3); assert.ok(normP(-2) > 0.97);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
});

test('the pre-registered bar', () => {
  const t = (cp, ct, h, rp, rt, x2) => ({ conf: { perPos: cp, tMonthly: ct, x2 }, rep: { perPos: rp, tMonthly: rt }, holm: h });
  assert.equal(verdictOf(t(0.2, 2.5, 0.04, 0.1, 1.2, 0.1)).pass, true);
  assert.equal(verdictOf(t(0.2, 1.9, 0.04, 0.1, 1.2, 0.1)).pass, false); assert.equal(verdictOf(t(0.2, 2.5, 0.06, 0.1, 1.2, 0.1)).pass, false);
  assert.equal(verdictOf(t(0.2, 2.5, 0.04, 0.1, 0.9, 0.1)).pass, false); assert.equal(verdictOf(t(0.2, 2.5, 0.04, -0.1, 1.2, 0.1)).pass, false);
  assert.equal(verdictOf(t(0.2, 2.5, 0.04, 0.1, 1.2, -0.01)).pass, false);
});

test('the parity gate: both windows, count within 15 % and mean gross within 0.15R', () => {
  const ref = [], mine = [];
  for (let i = 0; i < 20; i++) { ref.push({ t: '2010-01-0' + (1 + (i % 9)) + 'T00:09', g: 0.5 }); ref.push({ t: '2020-01-0' + (1 + (i % 9)) + 'T00:09', g: 1 }); }
  const at = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
  for (let i = 0; i < 20; i++) { mine.push({ t: at('2010-02-01'), g: 0.6 }); mine.push({ t: at('2020-02-01'), g: 1.1 }); }
  assert.equal(parity(mine, ref).ok, true);
  assert.equal(parity(mine.map((p) => (p.t > at('2018-01-01') ? { ...p, g: 1.2 } : p)), ref).ok, false, 'one window off by 0.2R fails the gate');
  assert.equal(parity(mine.slice(0, 32), ref).ok, false, 'a fifth fewer positions fails the gate');
});

test('the committed result: the gate, the verdict and the report agree with result.json', () => {
  const R = JSON.parse(rd('../research/edge/trend-breadth-h1/result.json')), RES = rd('../research/edge/trend-breadth-h1/RESULT.md');
  const has = (s) => assert.ok(RES.includes(String(s)), `report lacks ${s}`);
  const sg = (x, d = 3) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d), tt = (x) => (x < 0 ? '−' : '') + Math.abs(x);
  const nn = (x) => x.toLocaleString('en-US');
  // the gate, recomputed from its own rows
  for (const g of R.gate.rows) {
    assert.equal(g.ok, Math.abs(g.n - g.refN) <= 0.15 * g.refN && Math.abs(g.gross - g.refGross) <= 0.15);
    has(`| ${g.refN} | ${g.n} | ${sg(g.refGross)} | ${sg(g.gross)} |`);
  }
  const ref = JSON.parse(rd('../research/edge/gold-systems-oos/result.json')).positions.filter((p) => p.sys === 'gtrend');
  assert.deepEqual(R.gate.rows.map((g) => g.refN), [ref.filter((p) => p.t < '2018-01-01').length, ref.filter((p) => p.t >= '2018-01-01').length]);
  assert.equal(R.gate.ok, R.gate.rows.every((g) => g.ok));
  const tests = R.gate.ok ? R.tests : R.uninterpreted.tests;
  assert.equal(tests.length, 14); assert.deepEqual(tests.slice(0, 13).map((t) => t.id), Object.keys(MARKETS)); assert.equal(tests[13].id, 'pool');
  // Holm over the fourteen one-sided p values, and each verdict from its own row
  const hs = holm(tests.map((t) => normP(t.conf.tMonthly)));
  tests.forEach((t, i) => { near(t.holm, +hs[i].toPrecision(3), 1e-9); assert.deepEqual(t.verdict, verdictOf(t)); });
  assert.equal(tests[13].conf.n, tests.slice(0, 13).reduce((a, t) => a + t.conf.n, 0), 'the pool is every market\'s positions');
  const passed = tests.filter((t) => t.verdict.pass);
  assert.match(RES, new RegExp('^\\*\\*Verdict:\\*\\* ' + (!R.gate.ok ? 'INCONCLUSIVE' : passed.length ? 'PASS' : 'FAIL')));
  assert.equal(R.verdict.split(':')[0], !R.gate.ok ? 'INCONCLUSIVE' : passed.length ? 'PASS' : 'FAIL');
  for (const t of tests) has(`| ${nn(t.rep.n)} | ${sg(t.rep.perPos)} | ${tt(t.rep.tMonthly)} | ${t.id === 'pool' ? '**' : ''}${nn(t.conf.n)}${t.id === 'pool' ? '**' : ''} | ${t.id === 'pool' ? '**' : ''}${sg(t.conf.perPos)}${t.id === 'pool' ? '**' : ''} | ${tt(t.conf.tPos)} | ${t.id === 'pool' ? '**' : ''}${tt(t.conf.tMonthly)}${t.id === 'pool' ? '**' : ''} | ${sg(t.conf.x2)} | ${sg(t.conf.noFin)} | ${sg(t.conf.gross)} | ${t.p} | ${t.holm} |`);
  for (const g of R.gold) has(`${sg(g.perPos)}R`);
  const flatRes = RES.replace(/\s+/g, ' '), t2 = (x) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(2);
  for (const k of ['indices', 'forex', 'energy']) { const g = R.groups[k], want = `${sg(g.rep.perPos)}R (n ${nn(g.rep.n)}, t ${t2(g.rep.tMonthly)}) then ${sg(g.conf.perPos)}R (n ${nn(g.conf.n)}, t ${t2(g.conf.tMonthly)})`; assert.ok(flatRes.includes(want), `report lacks ${want}`); }
  assert.ok(!/is an edge|proven edge/i.test(RES));
});
