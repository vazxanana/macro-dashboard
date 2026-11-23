// node --test tests/holdout-phase-pick.test.mjs - discretion made explicit, the phase reader picks the entry
// (research/edge/holdout-phase-pick), offline: no look-ahead on synthetic candles (candidates, their phase and the choice),
// the trimmed phase input equals the whole series, the choice and the book's rules, the zone generator equals its study's
// trades under the one-position rule, every stored trade's stop on the losing side, holdout windows only, and the files agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { readPhase } from '../research/edge/_lib/phase.mjs';
import * as ZR from '../research/edge/daily-zone-retest/run.mjs';
import { candidatesOf, phaseSeries, phaseAt, choose, book, genZone, verdictOf, monthSums, SETS, pinsOk, GENS } from '../research/edge/holdout-phase-pick/run.mjs';

const DIR = new URL('../research/edge/holdout-phase-pick/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8) / 1000;
function walk(n, seed = 5) {
  const r = K.rng(seed); const out = []; let p = 100, x = 0, ph1 = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    ph1 += (2 * Math.PI) / (288 * 6) * (0.7 + 0.6 * r()); ph2 += (2 * Math.PI) / (48 * 3) * (0.7 + 0.6 * r());
    x += (r() - 0.5) * 0.15;
    const mid = 100 * Math.exp(0.002 * x + 0.03 * Math.sin(ph1) + 0.008 * Math.sin(ph2));
    const o = p, c = mid * (1 + (r() - 0.5) * 0.002), h = Math.max(o, c) * (1 + r() * 0.0008), l = Math.min(o, c) * (1 - r() * 0.0008);
    out.push({ t: T0 + i * 300, o, h, l, c, e: T0 + (i + 1) * 300 }); p = c;
  }
  return out;
}
const perturb = (bars, T) => bars.map((b) => (b.t < T ? b : { ...b, o: b.o * 1.03 + 2, h: b.h * 1.03 + 4, l: b.l * 1.03 - 1, c: b.c * 1.03 - 1 }));
const B = walk(90000);
const base = candidatesOf(B, 'syn', { cost: 0.01 });

test('pinned module hashes match the pre-registration', () => {
  for (const v of Object.values(pinsOk())) assert.ok(v.ok, JSON.stringify(v));
});

test('no look-ahead: candidates closed before a cut, their phase and the choice do not move when every later price changes', () => {
  assert.ok(base.filter((x) => x.gen === 'box').length > 20 && base.some((x) => x.gen === 'pull'), 'synthetic market gives candidates');
  for (const frac of [0.35, 0.7]) {
    const T = B[Math.floor(B.length * frac) + 7].t;
    const A = candidatesOf(perturb(B, T), 'syn', { cost: 0.01 });
    const keep = (xs) => xs.filter((x) => x.exitT < T).map((x) => JSON.stringify(x)).sort();
    assert.deepEqual(keep(A), keep(base));
  }
});

test('the phase at a signal reads only candles closed by then; the trimmed input equals the whole series', () => {
  const S = phaseSeries(B);
  const pick = base.filter((_, i) => i % Math.max(1, Math.floor(base.length / 25)) === 0);
  for (const x of pick) {
    const t = x.signalT;
    const whole = JSON.stringify(readPhase(S, t));
    assert.equal(JSON.stringify(phaseAt(S, t)), whole, 'trimmed = whole');
    // cut every series at t: nothing after the signal close is available, the reading is the same
    const cut = phaseSeries(B.filter((b) => b.e <= t));
    assert.equal(JSON.stringify(readPhase(cut, t)), whole, 'only closed candles');
  }
});

const ph = (d1, h4, h1) => ({ tf: { '1d': { side: d1[0], stage: d1[1], confirmed: !!d1[2] }, '4h': { side: h4[0], stage: h4[1], confirmed: !!h4[2] }, '1h': { side: h1[0], stage: h1[1] } } });
test('the choice, as pre-registered', () => {
  // never in an H4 range
  for (const g of GENS) assert.equal(choose(g, 1, ph([1, 'pullback', 1], [1, 'range', 1], [1, 'move'])).ok, false);
  // pullback end: H4 with the trade and continuation, D1 not against
  assert.equal(choose('pull', 1, ph([0, 'range', 0], [1, 'continuation', 0], [-1, 'pullback'])).ok, true);
  assert.equal(choose('pull', 1, ph([-1, 'move', 1], [1, 'continuation', 1], [1, 'move'])).ok, false);
  assert.equal(choose('pull', -1, ph([-1, 'move', 1], [-1, 'move', 1], [-1, 'move'])).ok, false);
  // box break: H4 with the trade, confirmed, move / continuation; H1 not in a pullback
  assert.equal(choose('box', -1, ph([1, 'move', 1], [-1, 'move', 1], [-1, 'continuation'])).ok, true);
  assert.equal(choose('box', -1, ph([1, 'move', 1], [-1, 'move', 0], [-1, 'move'])).ok, false);
  assert.equal(choose('box', -1, ph([1, 'move', 1], [-1, 'pullback', 1], [-1, 'move'])).ok, false);
  assert.equal(choose('box', -1, ph([1, 'move', 1], [-1, 'continuation', 1], [-1, 'pullback'])).ok, false);
  // zone retest: D1 with the trade, in a pullback or a continuation
  assert.equal(choose('zone', 1, ph([1, 'pullback', 0], [-1, 'move', 1], [-1, 'move'])).ok, true);
  assert.equal(choose('zone', 1, ph([1, 'move', 1], [1, 'move', 1], [1, 'move'])).ok, false);
  assert.equal(choose('zone', 1, ph([-1, 'pullback', 1], [1, 'move', 1], [1, 'move'])).ok, false);
});

test('the book: one position per market, by fill time, ties pullback end, zone retest, box break; a blocked one is dropped', () => {
  const c = (gen, entryT, exitT, market = 'm') => ({ gen, market, entryT, exitT, signalT: entryT - 300 });
  const xs = [c('box', 100, 500), c('zone', 100, 400), c('pull', 100, 300), c('box', 200, 250), c('zone', 300, 900), c('box', 300, 350, 'n')];
  const got = book(xs).map((x) => x.gen + x.market + x.entryT);
  assert.deepEqual(got.sort(), ['boxn300', 'pullm100', 'zonem300'].sort());
});

test('the zone generator, with its study\'s one-position rule, gives its study\'s trades', () => {
  const mine = genZone(B, 'syn', K.COSTS.xau);
  const ref = ZR.trades('syn', B).trades; // the study's own (cost: toolkit COSTS of 'syn' = none)
  const mine0 = genZone(B, 'syn', 0);
  let free = -Infinity; const one = [];
  for (const x of [...mine0].sort((a, b) => a.entryT - b.entryT)) if (x.entryT >= free) { one.push(x); free = x.exitT; }
  assert.deepEqual(one.map((x) => [x.entryT, x.exitT, +x.R.toFixed(9)]), ref.map((x) => [x.entryT, x.exitT, +x.R.toFixed(9)]));
  for (const x of mine) assert.ok(x.Rnet < x.R && x.Rnet2 < x.Rnet, 'costs charged');
});

const tj = JSON.parse(fs.readFileSync(new URL('trades.json', DIR), 'utf8'));
const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const rows = tj.rows.map((r) => Object.fromEntries(tj.cols.map((c, i) => [c, r[i]])));

test('stored trades: stop on the losing side, target on the winning side, holdout windows only, the choice held', () => {
  assert.ok(fs.statSync(new URL('trades.json', DIR)).size < 3e6);
  const sets = { A: [SETS.A.from, SETS.A.to, K.MARKETS], B: [SETS.B.from, SETS.B.to, K.HOLDOUT_MARKETS] };
  for (const x of rows) {
    assert.ok(x.side * (x.entry - x.stop) > 0, 'stop on the losing side');
    assert.ok(x.side * (x.target - x.entry) > 0, 'target on the winning side');
    const [a, b, ms] = sets[x.set];
    assert.ok(x.entryT >= a && x.entryT < b && ms.includes(x.market), 'holdout only');
    assert.ok(x.exitT >= x.entryT && x.entryT >= x.signalT, 'fill after the signal close, exit after the fill');
    if (x.book) assert.equal(x.take, 1, 'the book takes only candidates the choice allows');
    assert.ok(x.book || x.control);
  }
  // one position at a time per market in each book
  for (const k of ['book', 'control']) for (const m of new Set(rows.map((x) => x.market))) {
    const xs = rows.filter((x) => x[k] && x.market === m).sort((a, b) => a.entryT - b.entryT);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i].entryT >= xs[i - 1].exitT, k + ' ' + m);
  }
});

test('files agree: result.json from trades.json, RESULT.md from result.json', () => {
  const sum = (xs, k) => xs.reduce((a, x) => a + x[k], 0);
  for (const [k, blk] of [['book', res.primary], ['control', res.control]]) {
    const xs = rows.filter((x) => x[k]);
    const p = blk.net.pooled;
    assert.equal(xs.length, p.n, k);
    assert.ok(Math.abs(sum(xs, 'Rnet') / xs.length - p.meanR) < 2e-4, k + ' mean');
    assert.ok(Math.abs(sum(xs, 'R') / xs.length - blk.gross.pooled.meanR) < 2e-4, k + ' gross');
    for (const s of ['A', 'B']) assert.equal(xs.filter((x) => x.set === s).length, blk.net.sets[s].n);
    const months = ['A', 'B'].flatMap((s) => monthSums(xs.filter((x) => x.set === s), 'Rnet'));
    assert.equal(months.length, p.months);
  }
  assert.ok(res.gate.ok, 'harness gate reproduced the three generators');
  assert.match(res.phaseTests, /^pass \d+, fail 0$/);
  assert.equal(verdictOf(res.primary, res.holm.holmP).verdict, res.verdict);
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes(`**Verdict: ${res.verdict}.**`) && md.includes(res.headline));
  assert.ok(md.indexOf('Verdict') < 200, 'verdict first');
});
