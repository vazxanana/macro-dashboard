// node --test tests/desk-ict-smt.test.mjs — research/edge/ict-smt (14 Nov 2026): the SMT detector on hand-made candles, no
// look-ahead on either market, the published numbers, and that the study reads the ICT engine without touching it. Offline.
// Not named tests/ict-*: it also checks research files and the Edge lab's verdict reader (as tests/desk-ict-equal-lows.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SMT, PARTNER, partnerHeld, smtAt, tagSignal } from '../research/edge/ict-smt/smt.mjs';
import { welch, holm, monthT, mulberry32 } from '../research/edge/ict-smt/run.mjs';
import { headlineOf, classify, studyVerdict } from '../research/edge/verdict.mjs';
import { slimStudy } from '../research/edge/lab-summary.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'ict-smt');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

// candles from a list of lows: each candle spans low .. low + 2, an hour apart
const mk = (lows) => lows.map((l, i) => ({ time: 3600 * i, open: l + 1, high: l + 2, low: l, close: l + 1 }));
const flip = (H) => H.map((b) => ({ time: b.time, open: -b.open, high: -b.low, low: -b.high, close: -b.close }));
// signal market: a swing low at index 5 (100), then a rally, then the sweep candle at index 14 trading to 99
const SIG = mk([110, 108, 106, 104, 102, 100, 102, 104, 106, 108, 110, 108, 106, 104, 99]);
// partner holding a higher low (its window low 200 at index 5, sweep-time low 203) / partner taking its own low (195 at the sweep)
const HOLD = mk([210, 208, 206, 204, 202, 200, 202, 204, 206, 208, 210, 208, 206, 205, 203]);
const TAKE = mk([210, 208, 206, 204, 202, 200, 202, 204, 206, 208, 210, 208, 206, 204, 195]);
const S = SIG.length - 1;

test('SMT: the signal takes its swing low while the partner holds a higher low', () => {
  const r = smtAt(SIG, S, 1, HOLD);
  assert.equal(r.smt, true); assert.equal(r.judged, true); assert.equal(r.level, 100); assert.equal(r.partnerRef, 200); assert.equal(r.swingT, 5 * 3600);
  const q = smtAt(SIG, S, 1, TAKE);
  assert.equal(q.smt, false); assert.equal(q.judged, true); assert.equal(q.why, 'partner took its own low too');
  // a partner low taken earlier than the sweep candle (after the window) also ends the divergence
  const early = mk([210, 208, 206, 204, 202, 200, 202, 204, 206, 199, 210, 208, 206, 205, 203]);
  assert.equal(smtAt(SIG, S, 1, early).smt, false);
  // inside the swing's own window the partner may print its low anywhere (index 3 here)
  const shifted = mk([210, 208, 206, 200, 202, 204, 202, 204, 206, 208, 210, 208, 206, 205, 203]);
  assert.equal(smtAt(SIG, S, 1, shifted).smt, true);
});

test('not judged = no SMT: no swing taken, partner candles missing, no partner candle at the sweep time', () => {
  const noSweep = mk([110, 108, 106, 104, 102, 100, 102, 104, 106, 108, 110, 108, 106, 104, 101]);
  assert.deepEqual([smtAt(noSweep, S, 1, HOLD).smt, smtAt(noSweep, S, 1, HOLD).judged], [false, false]);
  const gap = HOLD.filter((b, i) => i < 3 || i > 6);   // only 3 of the 7 window candles
  assert.equal(smtAt(SIG, S, 1, gap).judged, false); assert.equal(smtAt(SIG, S, 1, gap).why, 'partner candles missing around the swing');
  assert.equal(smtAt(SIG, S, 1, HOLD.slice(0, -1)).why, 'no partner candle at the sweep time');
  assert.equal(smtAt(SIG, -1, 1, HOLD).smt, false);
  assert.equal(tagSignal({ side: 1, sweepT: 987654321 }, SIG, HOLD).smt, false);
  assert.equal(tagSignal({ side: 1, sweepT: S * 3600 }, SIG, HOLD).smt, true);
});

test('sells are the exact mirror (highs)', () => {
  const a = smtAt(SIG, S, 1, HOLD), b = smtAt(flip(SIG), S, -1, flip(HOLD));
  assert.equal(b.smt, true); assert.equal(b.level, -a.level); assert.equal(b.partnerRef, -a.partnerRef);
  assert.equal(smtAt(flip(SIG), S, -1, flip(TAKE)).smt, false);
  assert.equal(smtAt(flip(SIG), S, 1, flip(HOLD)).judged, false, 'read as a buy, the mirrored candles hold no swept low');
});

test('no look-ahead on either market: later candles never change the answer, and are never read', () => {
  const base = smtAt(SIG, S, 1, HOLD);
  const tail = (H, lows) => H.concat(mk(lows).map((b, i) => ({ ...b, time: 3600 * (H.length + i) })));
  const sigL = tail(SIG, [50, 40, 900]), parL = tail(HOLD, [10, 5, 1]);   // the partner crashes right after the sweep candle
  assert.deepEqual(smtAt(sigL, S, 1, parL), base);
  const trap = (H, s) => new Proxy(H, { get(t, k) { if (typeof k === 'string' && /^\d+$/.test(k) && +k > s) throw new Error('read candle ' + k + ' after the sweep candle'); return Reflect.get(t, k); } });
  // the signal market is read through the guard; the partner is cut to candles at or before the sweep time before any is read
  assert.deepEqual(smtAt(trap(sigL, S), S, 1, parL), base);
  const seen = []; const spy = new Proxy(parL, { get(t, k) { if (typeof k === 'string' && /^\d+$/.test(k)) seen.push(+k); return Reflect.get(t, k); } });
  smtAt(SIG, S, 1, spy);
  // the binary search may look at a later index to find the cut, but no later candle's prices are used
  const used = partnerHeld(parL, 5 * 3600, S * 3600, 1); assert.deepEqual(used, partnerHeld(HOLD, 5 * 3600, S * 3600, 1));
  assert.ok(seen.length > 0);
});

test('the pre-registered constants and partners', () => {
  assert.deepEqual(SMT, { piv: 3, look: 96, win: 3, minWin: 5 });
  assert.deepEqual(PARTNER, { nq: 'es', es: 'nq', ym: 'es', rty: 'es' });
  assert.ok(!('gc' in PARTNER), 'gold is excluded');
});

test('statistics: Holm, Welch, monthly-sum t, the seeded placebo RNG', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(welch([5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 5, 6]).p < 0.01); assert.equal(welch([1], [1, 2]).t, null);
  const t0 = Date.UTC(2024, 0, 1) / 1000, t1 = Date.UTC(2024, 3, 1) / 1000;   // Jan-Mar 2024
  const m = monthT([{ t: t0 + 86400, R: 1 }, { t: t0 + 2 * 86400, R: 1 }, { t: Date.UTC(2024, 1, 5) / 1000, R: 1 }, { t: t1 + 5, R: 99 }], t0, t1);
  assert.equal(m.months, 3, 'a month with no trade counts as 0'); assert.equal(m.mean, 1); assert.equal(m.t, 1.73);   // sums 2, 1, 0
  const a = mulberry32(1000), b = mulberry32(1000); assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('the study reads the ICT engine and never writes to it', () => {
  const smt = read('smt.mjs'), run = read('run.mjs');
  const smtImports = [...smt.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(smtImports, ['../ict-equal-lows/eq.mjs']);
  assert.ok(!/require\(|process\.|fetch\(|readFile|writeFile|Date\.now/.test(smt), 'the detector is pure');
  const imports = [...run.matchAll(/(?:from\s+|require\()\s*'([^']+)'/g)].map((m) => m[1]).filter((p) => !p.startsWith('node:'));
  assert.deepEqual(imports.sort(), ['../../../api/_ictlab.js', './smt.mjs']);
  assert.equal((run.match(/writeFileSync\(/g) || []).length, 2);   // the candle cache (outside git) and result.json
  assert.ok(!/E\.P\b|Object\.assign\(P|params: \{[^}]/.test(run), 'no parameter of the tracker is overridden');
  assert.ok(/E\.isASetup\(g, m\) && pred\(g\)/.test(run), 'the filter only narrows the A-rule');
  assert.ok(!/stop\s*=|\.stop\s*[+\-*]?=/.test(run + smt), 'no stop is set or moved');
  assert.ok(/endsWith\(path\.join\('ict-smt', 'run\.mjs'\)\)/.test(run), 'importing the runner runs nothing');
  for (const d of ['ict', 'council', 'api']) for (const f of fs.readdirSync(path.join(HERE, '..', d))) if (/\.(mjs|js)$/.test(f)) assert.ok(!fs.readFileSync(path.join(HERE, '..', d, f), 'utf8').includes('ict-smt'), `${d}/${f}`);
});

test('result.json is the run the report describes, on the pre-registered plan', () => {
  const R = JSON.parse(read('result.json')), md = read('RESULT.md'), pre = read('PREREGISTRATION.md');
  assert.equal(R.planSha256, crypto.createHash('sha256').update(pre).digest('hex'), 'the pre-registration was not edited after the run');
  assert.ok(md.includes(R.planSha256.slice(0, 8)) && md.includes(R.planSha256.slice(-4)));
  assert.equal(R.window.from, '2020-01-01'); assert.equal(R.window.to, '2026-10-31'); assert.equal(R.testsJudged, 3);
  // the verdict: the report's bold line, the Edge lab's reading and result.json agree; the headline fits the ledger
  const h = headlineOf(md); assert.ok(h.length <= 220, h); assert.match(md, /^\*\*Verdict: FAIL\. .+\*\*$/m);
  assert.equal(classify(h), 'fail'); assert.equal(studyVerdict(R, md).verdict, 'fail'); assert.match(R.verdict, /^FAIL: /);
  // the bar, recomputed from the published figures
  const T1 = R.tests.T1, T2 = R.tests.T2, T3 = R.tests.T3, V = R.streams.smt, N = R.streams.others;
  assert.equal(T1.n, V.oos.n); assert.equal(T1.exp, V.oos.exp); assert.equal(T1.month.months, 34); assert.equal(V.isM.months, 48);
  assert.deepEqual([T1.holmP, T2.holmP, T3.holmP], holm([T1.month.p, T2.p, T3.p]));
  assert.equal(R.checks.oosN30, V.oos.n >= 30); assert.equal(R.checks.isSameSign, V.is.exp > 0); assert.equal(R.checks.oos2xPositive, V.oos2x.exp > 0);
  assert.equal(R.checks.t2Holm, T2.holmP < 0.05); assert.equal(R.checks.t3SameSign, T3.diff > 0); assert.equal(R.checks.placebo, R.placebo.t1AtLeastObserved <= 2);
  assert.equal(T2.diff, +(V.oos.exp - N.oos.exp).toFixed(3)); assert.equal(T3.diff, +(V.is.exp - N.is.exp).toFixed(3));
  assert.ok(!(V.oos.exp > 0) || !(T2.diff > 0), 'FAIL rule: OOS not positive or OOS difference not positive');
  // the placebo: 40 seeded draws, its counts recomputed from its own draws
  assert.equal(R.placebo.draws_.length, 40); assert.deepEqual(R.placebo.draws_.map((d) => d.seed), Array.from({ length: 40 }, (_, i) => 1000 + i));
  assert.equal(R.placebo.t1AtLeastObserved, R.placebo.draws_.filter((d) => d.t1 >= T1.month.t).length);
  assert.ok(R.placebo.draws_.every((d) => d.t1 > T1.month.t && d.diff > T2.diff), 'the report says the observed figures are below every draw');
  // every published figure is in the report
  const num = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d), sgn = (x) => (x < 0 ? '−' : '') + Math.abs(x);
  for (const s of [V.is, V.oos, N.is, N.oos, R.streams.unfiltered.is, R.streams.unfiltered.oos]) { assert.ok(md.includes(`| ${s.n} |`), `n ${s.n}`); assert.ok(md.includes(num(s.exp)), `R a trade ${s.exp}`); }
  for (const x of [T1.month.t, V.isM.t, N.oosM.t, T2.t, T3.t]) assert.ok(md.includes(sgn(x)), `t ${x}`);
  assert.ok(md.includes(num(T2.diff) + 'R') && md.includes(num(T3.diff) + 'R') && md.includes(num(V.oos2x.exp) + 'R'));
  assert.ok(md.includes(num(V.isGross.exp) + 'R') && md.includes(num(V.oosGross.exp) + 'R'));
  for (const [k, m] of Object.entries(R.markets)) assert.ok(md.includes(`${num(m.smt.oos.exp)} (${m.smt.oos.n})`), k);
  // the trade list is the pooled SMT stream
  assert.equal(R.trades.length, V.is.n + V.oos.n); assert.ok(Math.abs(R.trades.reduce((a, t) => a + t.R, 0) - (V.is.R + V.oos.R)) < 0.05);
  assert.ok(R.trades.every((t) => t.d >= '2020-01-01' && t.d <= '2026-10-31' && t.m !== 'gc'));
  for (const s of Object.values(R.sources)) { assert.equal(s.unresolved, 0); assert.match(s.src, /^OANDA /); }
  assert.ok(!fs.readdirSync(path.join(HERE, '..', 'research', 'proposals')).some((f) => /smt/.test(f)), 'nothing passed, so no proposal');
  const slim = slimStudy(R); assert.equal(slim.candidates.length, 1); assert.equal(slim.candidates[0].oos.n, V.oos.n);
});
