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
  assert.match(buildExpect({ systems: [] }).systems.find((s) => s.id === 'mosha-bo').verdict.text, /^no verdict within 2 years: an edge of \+0\.14R a trade out of sample cannot be proven$/, 'Mosha: 833 trades = 155 years > 50: not provable');
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
  for (const [id, k] of [['gtrend', 'gtrend'], ['gtrend5', 'gtrend5'], ['gtl', 'gtl'], ['geg', 'geg']]) {
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
  for (const id of ['replica', 'mosha-bo', 'gmp', 'nq-open', 'ict-a', 'trend']) assert.equal(sys(id).fin, null, `${id}: no financing in its figures, and the file says so`);
  assert.match(BASE.financing.notComputed, /replica/i); assert.equal(BASE.financing.rate, 0.000148);
  assert.deepEqual(BASE.systems.filter((s) => s.live).map((s) => s.id), ['gtrend', 'geg', 'ict-a'], 'live since 11 Nov: Gold trend, Gold daily engulf (and the separate ICT desk)');
  near(sys('gtrend').honest.perYear, 75 / 11.5, 0.05, 'gtrend trades a year over the 11.5-year window');
});
test('NQ open run: 2004-22 untouched and 2023-26 built on match research/edge/nq-open-oos result.json', () => {
  const N = rdE('nq-open-oos/result.json'), s = sys('nq-open');
  assert.equal(s.honest.n, N.periods.untouched.n); near(s.honest.exp, N.periods.untouched.avg, 0.0015, 'untouched avg'); near(s.honest.t, N.periods.untouched.t, 0.011, 't'); near(s.honest.maxDD, N.periods.untouched.dd, 0.011, 'dd');
  assert.equal(s.builtOn.n, N.periods.built.n); near(s.builtOn.exp, N.periods.built.avg, 0.0015, 'built avg');
  assert.match(s.regime, /made nothing 2004-22/);
});
test('gold replica: 2017-22 out of sample and 2023-26 in sample match research/edge/replica-oos result.json', () => {
  const R = rdE('replica-oos/result.json').periods.x1, s = sys('replica');
  assert.equal(s.honest.n, R.oos.n); near(s.honest.exp, R.oos.exp, 0.0015, 'oos exp'); near(s.honest.t, R.oos.t, 0.011, 'oos t'); near(s.honest.maxDD, -R.oos.maxDD, 0.011, 'oos maxDD');
  assert.equal(s.builtOn.n, R.is.n); near(s.builtOn.exp, R.is.exp, 0.0015, 'is exp');
  assert.match(s.regime, /fails out of sample/);
});
test('ICT A-setups: 2008-17 and the 2018-26 reference match research/edge/ict-oos-2008 result.json', () => {
  const I = rdE('ict-oos-2008/result.json'), s = sys('ict-a');
  assert.equal(s.honest.n, I.test.pooled.net.n); near(s.honest.exp, I.test.pooled.net.exp, 0.0015, 'exp'); near(s.honest.t, I.test.pooled.net.t, 0.011, 't'); near(s.honest.maxDD, I.test.pooled.net.maxDD, 0.3, 'maxDD');
  assert.equal(s.builtOn.n, I.ref.pooled.net.n); near(s.builtOn.exp, I.ref.pooled.net.exp, 0.0015, 'ref exp');
  assert.equal(I.verdict.verdict, 'FAILS'); assert.match(s.regime, /fails out of sample/);
});
test('Mosha BO: 2006-17 out of sample and the 2018-26 calibration match research/edge/mosha-oos result.json; crypto trend: the decayed window of crypto-trend-decay', () => {
  const M = rdE('mosha-oos/result.json').system.periods, m = sys('mosha-bo');
  assert.equal(m.honest.n, M.oos.x1.n); near(m.honest.exp, M.oos.x1.mean, 0.0015, 'mosha oos mean'); near(m.honest.t, M.oos.x1.t, 0.011, 'mosha oos t'); near(m.honest.maxDD, -M.oos.x1.maxDD, 0.011, 'mosha oos maxDD');
  assert.equal(m.builtOn.n, M.cal.x1.n); near(m.builtOn.exp, M.cal.x1.mean, 0.0015, 'mosha cal mean');
  assert.match(m.regime, /null result/);
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
  assert.ok(r.dd.lo <= r.dd.hi && r.dd.hi === 40.2, 'replica: the 8-year worst drawdown −40.2R caps the band'); assert.match(r.verdict.text, /59 trades/); assert.match(r.line, /^Expect −0\.05R a trade/);
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
  assert.match(l, /^Expectations: Gold replica \+1\.10R a trade over 120, above its band −0\.54 to \+0\.44R\. What the untouched data said to expect; no rule changed\.$/);
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
