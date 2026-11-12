// node --test tests/expect.test.mjs — "What to expect" (council/expect.mjs): the maths against the studies' own result.json
// numbers, the coach.json `expect` block, the digest line and the page / trader wiring. Pure, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EX, describe, drawdown, seBand, yearBand, nVerdict, forwardCheck, expectOne, buildExpect, expectLine, loadExpectBase, fBand, fDD, verdictText } from '../council/expect.mjs';
import { waiting } from '../council/digest.mjs';
import { mcDrawdown, loadBase } from '../council/decay.mjs';
import { P as STUDY, nights as studyNights } from '../research/edge/trend-breadth/run.mjs';

const rdE = (f) => JSON.parse(fs.readFileSync(new URL(`../research/edge/${f}`, import.meta.url), 'utf8'));
const BASE = loadExpectBase(), DBASE = loadBase();
const GOLD = rdE('honest-book/gold-1d.json').bars;
const sys = (id) => BASE.systems.find((s) => s.id === id);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// Financing of the Gold replica, Mosha BO and the momentum pullback, recomputed here from their study records with the STUDY's own
// night counter and rate (research/edge/trend-breadth), independently of research/edge/expectations/build.mjs: per window
// { n, before, after, fin, nights }. A buy pays nights x rate x price / risk on its first unit; a sell pays nothing.
function finCheck(id) {
  const sec = (x) => Date.parse(x.length <= 10 ? x + 'T00:00:00Z' : x + ':00Z') / 1000, px = (t) => { let v = GOLD[0][1]; for (const b of GOLD) { if (b[0] <= t) v = b[1]; else break; } return v; };
  const charge = (buy, t, c, price, r0, size = 1) => buy ? studyNights(t, c) * STUDY.FIN_GOLD * price / r0 * size : 0;
  let rec, win;
  if (id === 'replica') { const S = rdE('sizing/inputs.json'), P = rdE('replica-oos/positions.json'), cN = S.cols.indexOf('net1'); win = [['2017-01-01', '2022-12-31'], ['2023-01-01', '2026-11-06']];
    rec = S.systems.replica.map((r, i) => { assert.equal(sec(P[i].at), r[0], 'replica records line up'); const l = P[i].legs[0]; return { t: r[0], R: r[cN], f: charge(P[i].side === 'buy', r[0], r[1], px(r[0]), l[2], l[1]), nn: P[i].side === 'buy' ? studyNights(r[0], r[1]) : 0 }; }); }
  else if (id === 'mosha-bo') { win = [['2006-07-01', '2017-12-31'], ['2018-01-01', '2026-11-06']];
    rec = rdE('mosha-oos/result.json').positions.map((p) => ({ t: sec(p.t), R: p.n, f: charge(p.side === 'buy', sec(p.t), sec(p.c), px(sec(p.t)), p.r0), nn: p.side === 'buy' ? studyNights(sec(p.t), sec(p.c)) : 0 })); }
  else { const T = rdE('robustness/out/gmp.json').trades, P = rdE('decay-monitor/positions.json').systems.gmp; win = [['2018-01-01', '2022-12-31'], ['2023-01-01', '2026-10-31']];
    rec = T.map((x, i) => { assert.equal(P[i][0], x.t); return { t: x.t, R: x.R, f: charge(x.side > 0, P[i][1], P[i][2], P[i][3], P[i][4]), nn: x.side > 0 ? studyNights(P[i][1], P[i][2]) : 0 }; }); }
  const of = ([a, b]) => { const w = rec.filter((p) => p.t >= sec(a) && p.t < sec(b) + 86400), m = (f) => w.reduce((q, p) => q + f(p), 0) / w.length; return { n: w.length, before: m((p) => p.R), after: m((p) => p.R - p.f), fin: m((p) => p.f), nights: m((p) => p.nn) }; };
  return { oos: of(win[0]), built: of(win[1]) };
}

// ─── the maths ───
test('bands: the estimate narrows with n, a year widens with the trade count; formats read as the owner does', () => {
  const b = seBand(0.5, 2, 100);   // ± 1.645 · 2 / 10
  near(b.lo, 0.171, 1e-3, 'lo'); near(b.hi, 0.829, 1e-3, 'hi');
  assert.ok(seBand(0.5, 2, 400).hi < b.hi);
  const y = yearBand(0.5, 2, 25);  // 12.5 ± 1.645 · 2 · 5
  near(y.exp, 12.5, 1e-9, 'year exp'); near(y.lo, -3.95, 1e-3, 'year lo'); near(y.hi, 28.95, 1e-3, 'year hi');
  assert.equal(fBand(-3.95, 28.95), '−4.0 to +29R'); assert.equal(fBand(-0.073, 0.037, 2), '−0.07 to +0.04R'); assert.equal(fDD(17.31, 60.72), '−17 to −61R'); assert.equal(fDD(5.38, 6.88), '−5.4 to −6.9R');
  assert.equal(EX.z, 1.645);
});
test('trades until a verdict: n = (2 sd / exp)², converted at the trade rate, capped at 2 years; never for an edge at or below zero', () => {
  const v = nVerdict(0.5, 2, 50);   // (4/0.5)² = 64 trades, 1.28 years
  assert.deepEqual(v, { n: 64, years: 1.28, within: true });
  assert.equal(nVerdict(0.5, 2, 20).within, false);           // 3.2 years
  assert.deepEqual(nVerdict(-0.02, 1.3, 80), { n: null, years: null, within: false });
  assert.deepEqual(nVerdict(0, 1.3, 80), { n: null, years: null, within: false });
  assert.match(verdictText({ honest: nVerdict(-0.02, 1.3, 80), backtest: nVerdict(0.33, 1.56, 78) }, { exp: -0.02 }, { exp: 0.33 }), /^90 trades \(about 14 months\) if it repeats its backtest \(\+0\.33R a trade\); an edge of −0\.02R a trade out of sample cannot be proven$/);
  assert.match(verdictText({ honest: nVerdict(0.009, 2.04, 18.6), backtest: nVerdict(0.009, 2.04, 18.5) }, { exp: 0.009 }, { exp: 0.009 }), /^no verdict within 2 years: an edge of \+0\.01R a trade out of sample cannot be proven$/);
  assert.match(buildExpect({ systems: [] }).systems.find((s) => s.id === 'mosha-bo').verdict.text, /^no verdict within 2 years: an edge of \+0\.12R a trade out of sample cannot be proven$/, 'Mosha (after financing on its buys): far over 50 years of trades, not provable');
});
test('forward record against the honest band for its own n: above / below / inside, and not placed under 10 trades', () => {
  const h = { exp: -0.05, sd: 3.26 };
  assert.equal(forwardCheck({ n: 24, exp: 0.9, R: 21.6 }, h).out, null);          // band ± 1.09
  assert.equal(forwardCheck({ n: 100, exp: 0.9, R: 90 }, h).out, 'above');       // band ± 0.54
  assert.equal(forwardCheck({ n: 100, exp: -0.7, R: -70 }, h).out, 'below');
  const few = forwardCheck({ n: 5, exp: 3, R: 15 }, h); assert.equal(few.judged, false); assert.equal(few.out, null);
  assert.equal(forwardCheck({ n: 0, exp: 0, R: 0 }, h), null); assert.equal(forwardCheck(null, h), null);
});

// ─── the base file against the studies' result.json (same windows, same costs x1) ───
// Since 11 Nov 2026 (owner approved the edge review's decision 2) the four long-only gold systems' figures are AFTER overnight
// financing: n is still the study's, the mean and t are those of research/edge/trend-breadth Part A (same method, same rate), and
// the figure before financing (fin.before) is still gold-systems-oos'.
test('gold systems: 2006-17 out of sample and 2018-26 match gold-systems-oos before financing and trend-breadth Part A after it', () => {
  const G = rdE('gold-systems-oos/result.json'), A = rdE('trend-breadth/result.json').partA;
  const partA = (k, w) => A.find((r) => r.sys === k && r.window.startsWith(w));
  for (const [id, k] of [['gtl', 'gtl'], ['geg', 'geg']]) {
    const s = sys(id), o = G.systems[k].periods.oos.x1, c = G.systems[k].periods.cal.x1, a = partA(k, 'untouched'), a2 = partA(k, '2018-01');
    assert.equal(s.honest.n, o.n, `${id} oos n`); assert.equal(s.honest.n, a.n);
    near(s.honest.exp, a.afterF1, 0.0011, `${id} oos mean after financing`); near(s.honest.t, a.tF1, 0.011, `${id} oos t after financing`);
    near(s.fin.before.exp, o.mean, 0.0015, `${id} oos mean before financing`); near(s.fin.before.t, o.t, 0.011, `${id} oos t before financing`);
    near(s.fin.perTrade, a.fin, 0.0011, `${id} financing a position`); near(s.fin.nights, a.nights, 0.011, `${id} nights held`);
    near(s.fin.before.exp - s.fin.perTrade, s.honest.exp, 0.0011, `${id}: after = before less financing`);
    assert.ok(s.honest.exp < o.mean, `${id}: financing only lowers the figure`);
    // the built-on window runs a few days past the study's (to 6 Nov), so it is recomputed here with the STUDY's own night counter and rate
    const sec = (x) => Date.parse(x + ':00Z') / 1000, px = (t) => { let v = GOLD[0][1]; for (const b of GOLD) { if (b[0] <= t) v = b[1]; else break; } return v; };
    const cal = G.positions.filter((p) => p.sys === k && sec(p.t) >= Date.parse('2018-01-01T00:00:00Z') / 1000 && sec(p.t) < Date.parse('2026-11-07T00:00:00Z') / 1000);
    const want = cal.reduce((q, p) => q + p.n - studyNights(sec(p.t), sec(p.c)) * STUDY.FIN_GOLD * px(sec(p.t)) / p.r0, 0) / cal.length;
    assert.equal(s.builtOn.n, c.n, `${id} cal n`); assert.equal(cal.length, c.n); near(s.builtOn.exp, want, 0.0011, `${id} cal mean after financing`); near(s.builtOn.exp, a2.afterF1, 0.02, `${id} cal mean near Part A's 2018-26 row`);
    assert.equal(G.systems[k].verdict.verdict, 'regime-bound'); assert.match(s.regime, /regime-bound/); assert.match(s.regime, /financing/);
  }
  assert.equal(partA('gtl', 'untouched').survives, false); assert.match(sys('gtl').regime, /does not survive financing/);
  for (const id of ['nq-open', 'ict-a', 'trend']) assert.equal(sys(id).fin, null, `${id}: no financing in its figures, and the file says so`);
  assert.match(BASE.financing.notComputed, /NQ open run/); assert.doesNotMatch(BASE.financing.notComputed, /replica|Mosha|pullback/i); assert.equal(BASE.financing.rate, 0.000148);
  assert.deepEqual(BASE.financing.systems, ['gtrend', 'gtrend5', 'geg', 'gtl', 'replica', 'mosha-bo', 'gmp']);
  assert.deepEqual(BASE.systems.filter((s) => s.live).map((s) => s.id), ['gtrend', 'geg', 'ict-a'], 'live since 11 Nov: Gold trend, Gold daily engulf (and the separate ICT desk)');
  near(sys('gtrend').honest.perYear, 74 / 11.5, 0.05, 'gtrend positions a year over the 11.5-year window');
});
// Since 12 Nov 2026 (owner approved docs/owner-decisions.md item 42) Gold trend and Gold trend fast pay financing on EVERY unit, the
// add included: their figures are the book study's own (research/edge/supported-book/result.json, untouched 2006-17, per system),
// built from its unit records (legs.json) through its position function: positions closed in the window, net of $0.30 a unit
// and financing on each unit at its own entry price and risk.
test('Gold trend and Gold trend fast: every unit charged, equal to the supported-book study per system; built-on window recomputed from the same units', async () => {
  const SB = rdE('supported-book/result.json').windows.W1, { positions } = await import('../research/edge/supported-book/run.mjs'), L = rdE('supported-book/legs.json').units;
  for (const [id, book] of [['gtrend', 'S2'], ['gtrend5', 'S3']]) {
    const s = sys(id), b = SB[book].x1F1.bySystem[id];
    assert.equal(s.honest.n, b.positions, `${id} positions`); near(s.honest.exp, b.perPosition, 0.0006, `${id} R a position after financing on every unit`); near(s.honest.t, b.tPosition, 0.006, `${id} t`);
    near(s.honest.R, b.total, 0.051, `${id} total`); near(s.fin.perTrade * s.honest.n, b.financing, 0.06, `${id} financing over the window`);
    assert.equal(s.fin.everyUnit, true); assert.equal(s.units, 'research/edge/supported-book/legs.json (every unit)');
    near(s.fin.before.exp - s.fin.perTrade, s.honest.exp, 0.0011, `${id}: after = before less financing`);
    // more than the first-unit charge of 11 Nov (the add pays too), never less
    const A = rdE('trend-breadth/result.json').partA.find((r) => r.sys === id && r.window.startsWith('untouched')); assert.ok(s.fin.perTrade > A.fin, `${id}: every unit costs more than the first unit alone`);
    const P = positions(L.filter((u) => u.sys === id)).filter((p) => p.day >= '2018-01-01' && p.day <= '2026-11-06');
    assert.equal(s.builtOn.n, P.length); near(s.builtOn.exp, P.reduce((q, p) => q + p.n, 0) / P.length, 0.0011, `${id} built-on mean`);
    assert.match(s.regime, /a position after financing on every unit on 2006-17/);
  }
  assert.deepEqual([sys('gtrend').honest.exp, sys('gtrend5').honest.exp], [0.313, 0.211], 'the figures item 42 gave the owner');
  assert.deepEqual(BASE.financing.everyUnit, ['gtrend', 'gtrend5']);
  // the daily engulf has no add: unchanged, and equal to the book study's per-system figure too
  near(sys('geg').honest.exp, SB.S2.x1F1.bySystem.geg.perPosition, 0.0006, 'geg'); assert.equal(sys('geg').honest.n, SB.S2.x1F1.bySystem.geg.positions);
});
test('NQ open run: 2004-22 untouched and 2023-26 built on match research/edge/nq-open-oos result.json', () => {
  const N = rdE('nq-open-oos/result.json'), s = sys('nq-open');
  assert.equal(s.honest.n, N.periods.untouched.n); near(s.honest.exp, N.periods.untouched.avg, 0.0015, 'untouched avg'); near(s.honest.t, N.periods.untouched.t, 0.011, 't'); near(s.honest.maxDD, N.periods.untouched.dd, 0.011, 'dd');
  assert.equal(s.builtOn.n, N.periods.built.n); near(s.builtOn.exp, N.periods.built.avg, 0.0015, 'built avg');
  assert.match(s.regime, /made nothing 2004-22/);
});
test('gold replica: 2017-22 out of sample and 2023-26 in sample match research/edge/replica-oos result.json', () => {
  const R = rdE('replica-oos/result.json').periods.x1, s = sys('replica');
  // the study's figures are before financing; the file's are after it on the buys (11 Nov 2026) and keep the study's as `before`
  assert.equal(s.honest.n, R.oos.n); near(s.fin.before.exp, R.oos.exp, 0.0015, 'oos exp before financing'); near(s.fin.before.t, R.oos.t, 0.011, 'oos t before financing');
  assert.ok(s.honest.maxDD >= -R.oos.maxDD - 0.011 && s.honest.maxDD < -R.oos.maxDD + 1, 'oos maxDD: the study\'s, a little deeper after financing');
  const f = finCheck('replica'); near(s.honest.exp, f.oos.after, 0.0011, 'oos exp after financing'); near(s.fin.perTrade, f.oos.fin, 0.0011, 'financing a position'); near(s.fin.nights, f.oos.nights, 0.011, 'nights');
  assert.ok(s.honest.exp < R.oos.exp && R.oos.exp - s.honest.exp < 0.02, 'a day-trading system pays little');
  assert.equal(s.builtOn.n, R.is.n); near(s.builtOn.exp, f.built.after, 0.0011, 'is exp after financing'); near(f.built.before, R.is.exp, 0.0015, 'is exp before financing');
  assert.match(s.regime, /fails out of sample/); assert.match(s.regime, /after financing/);
});
test('ICT A-setups: 2008-17 and the 2018-26 reference match research/edge/ict-oos-2008 result.json', () => {
  const I = rdE('ict-oos-2008/result.json'), s = sys('ict-a');
  assert.equal(s.honest.n, I.test.pooled.net.n); near(s.honest.exp, I.test.pooled.net.exp, 0.0015, 'exp'); near(s.honest.t, I.test.pooled.net.t, 0.011, 't'); near(s.honest.maxDD, I.test.pooled.net.maxDD, 0.3, 'maxDD');
  assert.equal(s.builtOn.n, I.ref.pooled.net.n); near(s.builtOn.exp, I.ref.pooled.net.exp, 0.0015, 'ref exp');
  assert.equal(I.verdict.verdict, 'FAILS'); assert.match(s.regime, /fails out of sample/);
});
test('Mosha BO: 2006-17 out of sample and the 2018-26 calibration match research/edge/mosha-oos result.json; crypto trend: the decayed window of crypto-trend-decay', () => {
  const M = rdE('mosha-oos/result.json').system.periods, m = sys('mosha-bo');
  assert.equal(m.honest.n, M.oos.x1.n); near(m.fin.before.exp, M.oos.x1.mean, 0.0015, 'mosha oos mean before financing'); near(m.fin.before.t, M.oos.x1.t, 0.011, 'mosha oos t before financing');
  assert.ok(m.honest.maxDD >= -M.oos.x1.maxDD - 0.011 && m.honest.maxDD < -M.oos.x1.maxDD + 1.5, 'mosha oos maxDD: the study\'s, a little deeper after financing');
  const f = finCheck('mosha-bo'); near(m.honest.exp, f.oos.after, 0.0011, 'mosha oos mean after financing'); near(m.fin.perTrade, f.oos.fin, 0.0011, 'mosha financing a position');
  assert.equal(m.builtOn.n, M.cal.x1.n); near(f.built.before, M.cal.x1.mean, 0.0015, 'mosha cal mean before financing'); near(m.builtOn.exp, f.built.after, 0.0011, 'mosha cal mean after financing');
  assert.match(m.regime, /null result/); assert.match(m.regime, /after financing/);
  // the momentum pullback: its rebuild record, a buy charged on its own entry price and risk (research/edge/decay-monitor/positions.json)
  const g = sys('gmp'), gf = finCheck('gmp'); near(g.honest.exp, gf.oos.after, 0.0011, 'gmp 2018-22 after financing'); near(g.fin.before.exp, gf.oos.before, 0.0011, 'gmp before'); near(g.fin.perTrade, gf.oos.fin, 0.0011, 'gmp financing');
  assert.ok(g.fin.perTrade > 0 && g.fin.perTrade < 0.03); near(g.builtOn.exp, gf.built.after, 0.0011, 'gmp 2023-26 after financing');
  const C = rdE('crypto-trend-decay/result.json'), c = sys('trend'), w = C.windows['2024-26 H2 (2025-06-01..2026-10-31)'].net;
  assert.equal(c.honest.n, w.n); near(c.honest.exp, w.exp, 0.0015, 'trend exp'); near(c.honest.t, w.t, 0.011, 'trend t');
  assert.equal(c.live, false); assert.equal(sys('gtrend5').live, false, 'gold trend fast is shadow');
  assert.equal(C.verdict, 'decayed'); assert.match(c.regime, /decayed/);
});
test('drawdown band: from the decay baseline MC95 (decay.mjs mcDrawdown of the baseline record) to the worst the untouched years gave', () => {
  for (const s of BASE.systems) {
    const b = DBASE.systems[s.id];
    assert.equal(s.dd.mc95, b.mcDD, `${s.id} mc95 is the decay baseline's`); assert.equal(s.backtest.exp, b.ref); assert.equal(s.backtest.sd, b.sd);
    near(s.dd.worst, Math.max(s.honest.maxDD, b.maxDD), 0.011, `${s.id} worst`);
  }
  // the MC95 itself: reproducible, at least the record's own drawdown, and larger for a record with the same mean and more spread
  const R = []; for (let i = 0; i < 120; i++) R.push(i % 3 ? -1 : 2.3);
  const a = mcDrawdown(R, { iters: 500 }); assert.equal(a, mcDrawdown(R, { iters: 500 })); assert.ok(a >= drawdown(R).max - 1e-9);
  assert.ok(mcDrawdown(R.map((x) => x * 2), { iters: 500 }) > a);
  const d = describe([1, -1, 2, -2]); assert.equal(d.n, 4); assert.equal(d.mean, 0); near(d.sd, Math.sqrt(10 / 3), 1e-9, 'sd');
});

// ─── coach.json expect ───
const dsys = (id, name, fwd, live = true) => ({ id, name, desk: 'Meridian', live, fwd });
test('buildExpect: one entry per system with bands, drawdown, verdict, regime note and the forward placement; `out` names live systems outside their band', () => {
  const E = buildExpect({ systems: [dsys('replica', 'Gold replica', { n: 120, exp: 1.1, R: 132 }), dsys('nq-open', 'NQ New York open run', { n: 90, exp: -0.6, R: -54 }), dsys('gtrend', 'Gold trend', { n: 3, exp: 2, R: 6 }), dsys('trend', 'Crypto trend', { n: 40, exp: 4, R: 160 }, false)] }, { now: 1_800_000_000 });
  assert.equal(E.at, new Date(1_800_000_000 * 1000).toISOString()); assert.equal(E.systems.length, BASE.systems.length);
  const r = E.systems.find((s) => s.id === 'replica');
  assert.equal(r.forward.out, 'above'); assert.equal(r.live, true); assert.ok(r.perTrade.lo < r.perTrade.exp && r.perTrade.exp < r.perTrade.hi);
  near(r.perYear.exp, r.perTrade.exp * r.perYear.trades, 0.02, 'year exp = per trade × trades a year');
  assert.ok(r.dd.lo <= r.dd.hi && r.dd.hi === 40.2, 'replica: the 8-year worst drawdown −40.2R caps the band'); assert.match(r.verdict.text, /60 trades/); assert.match(r.line, /^Expect −0\.06R a trade after financing/);
  assert.equal(E.systems.find((s) => s.id === 'nq-open').forward.out, 'below');
  const g = E.systems.find((s) => s.id === 'gtrend'); assert.equal(g.forward.judged, false); assert.equal(g.forward.out, null); assert.match(g.line, /too few to place/);
  assert.equal(E.systems.find((s) => s.id === 'trend').forward.out, 'above');
  assert.deepEqual(E.out, ['replica', 'nq-open'], 'shadow systems are never in `out`');
  assert.match(E.systems.find((s) => s.id === 'gtl').line, /No forward trade yet/);
  assert.match(buildExpect({ systems: [] }, { base: null }).error, /expect-base/);
});
test('digest: one line only when a live forward record leaves its band; waiting() carries it', () => {
  assert.equal(expectLine(buildExpect({ systems: [dsys('replica', 'Gold replica', { n: 24, exp: 0.9, R: 21.6 })] })), null);
  const E = buildExpect({ systems: [dsys('replica', 'Gold replica', { n: 120, exp: 1.1, R: 132 }), dsys('trend', 'Crypto trend', { n: 40, exp: 4, R: 160 }, false)] });
  const l = expectLine(E);
  assert.match(l, /^Expectations: Gold replica \+1\.10R a trade over 120, above its band −0\.55 to \+0\.43R\. What the untouched data said to expect; no rule changed\.$/);
  const W = waiting({ coach: { expect: E }, health: { at: new Date().toISOString(), status: 'ok' } }, Math.floor(Date.now() / 1000), {});
  assert.deepEqual(W, [l]);
  assert.deepEqual(waiting({ coach: {}, health: { at: new Date().toISOString(), status: 'ok' } }, Math.floor(Date.now() / 1000), {}), []);
});

// ─── wiring ───
test('the Trader builds it with the decay block every 6 hours and keeps it through the daily Coach rewrite', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{ buildExpect \} from '\.\/expect\.mjs'/);
  assert.match(src, /cj\.expect = \{ \.\.\.buildExpect\(cj\.decay, \{ now \}\), slot: CC_SLOT \}/);
  assert.match(src, /decay: prev\.decay, (?:\w+: prev\.\w+, )*expect: prev\.expect/);
});
test('page: the card sits next to the edge-decay card in the research pane, admin only, self-contained style + script reading coach.expect', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  const decay = html.indexOf('id="ms-decay"'), card = html.indexOf('id="ms-expect"'), research = html.indexOf('id="ms-cp-research"'), analyst = html.indexOf('class="card c-analyst"');
  assert.ok(research < decay && decay < card && card < analyst, 'card order: scoreboard, decay, expect, analyst');
  assert.match(html, /<div class="card c-expect adm" id="ms-expect">/);
  assert.match(html, /<style id="ms-ex-css">/); assert.match(html, /<script id="ms-ex-js">/);
  assert.match(html, /C\.coach && C\.coach\.expect/); assert.match(html, /document\.addEventListener\('ms:council', render\)/);
  assert.match(html, /id="ms-expect-b"/); assert.match(html, /id="ms-expect-sum"/);
  assert.match(html, /@media \(max-width: 760px\) \{\s*\.ex-t thead \{ display: none; \}/, 'phone layout: the table becomes blocks');
  for (const f of ['perTrade', 'perYear', 'dd', 'verdict', 'forward', 'regime', 'line', 'honest', 'backtest']) assert.ok(html.includes(`s.${f}`), `the page reads ${f}`);
});
