// Trend breadth and financing study (research/edge/trend-breadth): the daily harness on hand-made candles (entry at the next
// open, a stop on every position, a ratchet that never loosens, the add, no look-ahead, the mirror), the financing night
// count, the statistics, the pre-registered bar, and the committed result against the written report. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, COST, TESTS, atr, simulate, net, stat, monthly, normP, holm, maxDD, nights, verdictOf } from '../research/edge/trend-breadth/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/trend-breadth/PREREGISTRATION.md'), RES = rd('../research/edge/trend-breadth/RESULT.md'), RUN = rd('../research/edge/trend-breadth/run.mjs');
const J = JSON.parse(rd('../research/edge/trend-breadth/result.json'));
const DAY = 86400, T0 = Date.UTC(2021, 0, 4) / 1000;   // a Monday
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
// flat candles around 100 (range 2, so ATR 2 and a 2 ATR stop is 4 away), consecutive calendar days unless `gap` names an index
function flat(n, gap = {}) { const D = []; let t = T0; for (let i = 0; i < n; i++) { if (gap[i]) t += gap[i] * DAY; D.push({ time: t, open: 100, high: 101, low: 99, close: 100 }); t += DAY; } return D; }
const set = (D, i, o, h, l, c) => { D[i] = { time: D[i].time, open: o, high: h, low: l, close: c }; return D; };

test('the constants, costs and test sets are the pre-registered ones', () => {
  assert.deepEqual([P.K, P.ATR, P.ADD, P.MIN_BARS, P.PARITY.n, P.PARITY.g], [2, 14, 1, 60, 0.15, 0.15]);
  assert.deepEqual([P.FIN_GOLD, P.FIN_LONG, P.FIN_FX], [0.000148, 0.00015, 0.00004]);
  assert.deepEqual(COST, { fx: 0.00015, index: 0.0003, mid: 0.001, wide: 0.002 });
  assert.deepEqual(TESTS.map((t) => [t.id, t.sides, Object.keys(t.markets).length]), [['B1', 'long', 4], ['B2', 'long', 17], ['B3', 'long', 7], ['B4', 'both', 7]]);
  for (const k of ['xag xpt xpd xcu', 'bco wtico natgas corn wheat soybn sugar', 'eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf']) assert.ok(PRE.includes('`' + k + '`'), k);
  assert.ok(!TESTS.some((t) => Object.keys(t.markets).some((k) => /^xau/.test(k))), 'gold and its crosses are not in a breadth set');
  assert.match(PRE, /within\s+15 %/); assert.match(PRE, /within 0\.15R/);
});

test('a breakout close buys at the next open with a 2 ATR stop, and is stopped at the stop', () => {
  const D = flat(80);
  set(D, 70, 100, 103, 99.5, 102.5);                 // closes above the prior 20 highs (101)
  set(D, 71, 102.6, 103, 102, 102.8);                // the entry candle: bought at its open
  set(D, 72, 102.8, 103, 96, 97);                    // falls through the stop
  const A = atr(D, 70), ps = simulate(D, 20);
  assert.equal(ps.length, 1);
  const p = ps[0];
  assert.equal(p.t, D[71].time); near(p.legs[0].entry, 102.6); near(p.legs[0].r0, 2 * A);
  assert.equal(p.why, 'stop'); assert.ok(p.exit < p.legs[0].entry, 'the stop is on the losing side');
  assert.ok(p.g < 0 && p.g >= -1.2, `a stopped position loses about its risk (${p.g})`);
});

test('a stop gapped through fills at the open, not at the stop', () => {
  const D = flat(80);
  set(D, 70, 100, 103, 99.5, 102.5); set(D, 71, 102.6, 103, 102, 102.8); set(D, 72, 90, 91, 89, 90);
  const p = simulate(D, 20)[0];
  assert.equal(p.why, 'gap'); near(p.exit, 90); assert.ok(p.g < -1);
});

test('a signal on the last candle before a gap in the calendar is lost, as live', () => {
  const D = flat(80, { 71: 2 });                     // candle 71 starts three days after candle 70
  set(D, 70, 100, 103, 99.5, 102.5); set(D, 71, 102.6, 103, 102, 102.8);
  assert.equal(simulate(D, 20).length, 0);
});

test('the stop only ever moves up, every position has one, and the add shares it', () => {
  const D = flat(100);
  set(D, 70, 100, 103, 99.5, 102.5);
  let px = 102.6;
  for (let i = 71; i < 90; i++) { set(D, i, px, px + 2.2, px - 0.3, px + 2); px += 2; }   // a steady climb
  for (let i = 90; i < 100; i++) { set(D, i, px, px + 0.2, px - 6, px - 5); px -= 5; }      // then a fall
  const ps = simulate(D, 20);
  assert.ok(ps.length >= 1);
  const p = ps[0];
  assert.equal(p.legs.length, 2, 'one add after a close 1R above the entry');
  assert.ok(p.legs[1].i > p.legs[0].i && p.legs[1].r0 > 0 && p.legs[1].entry > p.legs[0].entry);
  assert.ok(p.exit > p.legs[0].entry - p.legs[0].r0, 'the exit is above the first stop: the ratchet lifted it');
  assert.ok(p.legs[0].R > 1, `the first unit keeps part of the run (${p.legs[0].R})`);
  for (const q of ps) for (const l of q.legs) assert.ok(l.r0 > 0, 'every unit has a stop a positive distance away');
});

test('no look-ahead: changing every candle after a position closes changes nothing before it', () => {
  const D = flat(120);
  set(D, 70, 100, 103, 99.5, 102.5); set(D, 71, 102.6, 103, 102, 102.8); set(D, 72, 102.8, 103, 96, 97);
  const a = simulate(D, 20)[0];
  const E = D.map((b, i) => (i > 72 ? { ...b, open: 500, high: 900, low: 400, close: 800 } : b));
  const b = simulate(E, 20)[0];
  assert.deepEqual([a.t, a.c, a.exit, a.g], [b.t, b.c, b.exit, b.g]);
  // and the entry does not read its own candle's close: only the open
  const F = D.map((x) => ({ ...x })); F[71].close = 102.61;
  near(simulate(F, 20)[0].legs[0].entry, 102.6);
});

test('the mirror sells a close under the prior lows only when both sides are asked for', () => {
  const D = flat(80);
  set(D, 70, 100, 100.5, 97, 97.5); set(D, 71, 97.4, 98, 97, 97.2); set(D, 72, 97.2, 104, 97, 100);
  assert.equal(simulate(D, 20).length, 0, 'long only: no trade');
  const p = simulate(D, 20, { sides: 'both' })[0];
  assert.equal(p.side, -1); assert.ok(p.exit > p.legs[0].entry, 'a short is stopped above its entry'); assert.ok(p.g < 0);
});

test('net R charges each unit its round trip and its nights; a short is credited nothing unless told to pay', () => {
  const p = { side: 1, legs: [{ entry: 100, r0: 4, R: 1, nights: 10 }, { entry: 104, r0: 2, R: 0.5, nights: 4 }] };
  const x = net(p, 0.001, 0.0002);
  near(x.cost, 0.001 * 100 / 4 + 0.001 * 104 / 2); near(x.fin, 0.0002 * 10 * 100 / 4 + 0.0002 * 4 * 104 / 2); near(x.n, 1.5 - x.cost - x.fin);
  near(net(p, 0.001, 0.0002, { mult: 2 }).cost, 2 * x.cost);
  const s = { side: -1, legs: [{ entry: 100, r0: 4, R: 1, nights: 10 }] };
  near(net(s, 0, 0.0002).fin, 0); near(net(s, 0, 0.0002, { shortPays: true }).fin, 0.0002 * 10 * 100 / 4);
});

test('financing nights: weekdays at 22:00 UTC, Wednesday counts three, a weekend none', () => {
  const mon = Date.UTC(2021, 0, 4, 12) / 1000;
  assert.equal(nights(mon, mon + 3600), 0);
  assert.equal(nights(mon, mon + DAY), 1);                    // Monday night
  assert.equal(nights(mon, mon + 3 * DAY), 5);                // Mon 1 + Tue 1 + Wed 3
  assert.equal(nights(mon, mon + 7 * DAY), 7);                // a whole week pays seven nights
  const fri = Date.UTC(2021, 0, 8, 23) / 1000;
  assert.equal(nights(fri, fri + 2 * DAY), 0);                // Friday 23:00 to Sunday 23:00
});

test('statistics: t, month sums with empty months, Holm, drawdown', () => {
  const s = stat([1, -1, 2, 0]); near(s.mean, 0.5); near(s.sum, 2); assert.ok(s.t > 0);
  const a = Date.UTC(2020, 0, 1) / 1000, b = Date.UTC(2020, 11, 31) / 1000;
  const m = monthly([{ c: Date.UTC(2020, 0, 15) / 1000, n: 2 }, { c: Date.UTC(2020, 0, 20) / 1000, n: 1 }, { c: Date.UTC(2020, 5, 2) / 1000, n: -1 }], a, b);
  assert.equal(m.months, 12); near(m.sum, 2); near(m.mean, 2 / 12);
  near(normP(0), 0.5, 1e-6); assert.ok(normP(2) < 0.03 && normP(2) > 0.02); assert.ok(normP(-2) > 0.97);
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]).map((x) => +x.toFixed(2)), [0.04, 0.09, 0.09, 0.5]);
  near(maxDD([1, -2, -1, 4, -1]), 3);
});

test('the pass bar is the pre-registered one', () => {
  const ok = { conf: { mean: 0.2, tM: 2.5 }, holm: 0.02, rep: { mean: 0.1, tM: 1.2 }, confX2: 0.1 };
  assert.equal(verdictOf(ok).pass, true);
  assert.equal(verdictOf({ ...ok, holm: 0.06 }).pass, false);
  assert.equal(verdictOf({ ...ok, conf: { mean: 0.2, tM: 1.9 } }).pass, false);
  assert.equal(verdictOf({ ...ok, rep: { mean: 0.1, tM: 0.9 } }).pass, false);
  assert.equal(verdictOf({ ...ok, rep: { mean: -0.1, tM: 1.5 } }).pass, false);
  assert.equal(verdictOf({ ...ok, confX2: -0.01 }).pass, false);
});

test('the committed result: the gate decided, nothing interpreted past it, and the report states the same figures', () => {
  assert.equal(J.topic, 'trend-breadth');
  const gate = J.parity.filter((p) => p.sys === 'gtrend');
  assert.equal(gate.length, 2);
  for (const p of J.parity) assert.equal(p.ok, Math.abs(p.n - p.refN) <= P.PARITY.n * p.refN && Math.abs(p.g - p.refG) <= P.PARITY.g + 1e-9, `${p.sys} ${p.window}`);
  assert.equal(J.parityOk, gate.every((p) => p.ok));
  if (!J.parityOk) {
    assert.ok(!('tests' in J) && J.uninterpreted && J.uninterpreted.tests.length === 4, 'breadth figures sit under "uninterpreted"');
    assert.match(J.verdict, /^INCONCLUSIVE\./); assert.match(J.verdict, /harness not validated/);
    assert.match(RES, /^\*\*Verdict:\*\* INCONCLUSIVE[.:]/); assert.match(RES, /no breadth number is interpreted/);
    assert.ok(!/\bPASS(ES)?\b/.test(RES.replace(/PASSES only|A PASS|passes/g, '')), 'the report claims no pass');
  } else {
    for (const t of J.tests) assert.deepEqual(t.verdict, verdictOf(t));
  }
  // Part A: every untouched row's figures are in the report, and the reading follows the pre-registered rule
  const f = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);
  for (const r of J.partA) {
    assert.ok(r.afterF1 <= r.before && r.afterHalf >= r.afterF1, 'financing only ever costs a long position');
    if (!r.window.startsWith('untouched')) continue;
    assert.equal(r.survives, r.afterF1 > 0 && r.tF1 >= 1, r.sys);
    for (const v of [f(r.before), f(r.afterF1), String(r.n)]) assert.ok(RES.includes(v), `${r.sys}: ${v} in RESULT.md`);
  }
  const u = Object.fromEntries(J.partA.filter((r) => r.window.startsWith('untouched')).map((r) => [r.sys, r]));
  assert.deepEqual([u.gtrend.survives, u.gtrend5.survives, u.geg.survives, u.gtl.survives], [true, true, true, false]);
  assert.ok(Object.values(u).every((r) => r.tF1 < 2), 'no system has an out-of-sample t of 2 after financing');
  assert.match(RES, /does not survive at today's rate/);
});

test('the study stands apart: no council, mirror, ICT or API import, and nothing live reads it', () => {
  const imports = [...RUN.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['node:child_process', 'node:fs', 'node:path', 'node:url']);
  // 11 Nov 2026, later the same day: the owner approved counting financing, so council/fills.mjs and the Trader now NAME the study as
  // the source of the rate in comments and in the rule's history text. The check that matters is unchanged: none of them imports
  // or reads the study's code or files, and the mirror and the ICT tracker do not mention it at all.
  for (const f of ['../council/trader.mjs', '../council/fills.mjs', '../council/expect.mjs', '../council/ctrader-mirror.mjs', '../ict/tracker.mjs']) assert.ok(!/(from\s*|import\(\s*|readFileSync\([^)]*|rd\w*\()['"`][^'"`]*trend-breadth/.test(rd(f)), f);
  for (const f of ['../council/ctrader-mirror.mjs', '../ict/tracker.mjs']) assert.ok(!rd(f).includes('trend-breadth'), f);
  assert.match(PRE, /before\*\* any number below was computed/);
});
