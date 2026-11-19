// node --test tests/desk-ict-smt-2008.test.mjs — research/edge/ict-smt-2008 (14 Nov 2026): ict-smt's SMT split replicated on
// 2008-2019. The detector is ict-smt's, byte for byte; checked on hand-made candles, no look-ahead, the cost model, the published
// numbers, and that the study reads the ICT engine without touching it. Offline.
// Not named tests/ict-*: it also checks research files and the Edge lab's verdict reader (as desk-ict-smt / desk-ict-equal-lows).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SMT, PARTNER, smtAt } from '../research/edge/ict-smt-2008/smt.mjs';
import { welch, holm, monthT, mulberry32, netOf, COST } from '../research/edge/ict-smt-2008/run.mjs';
import { headlineOf, classify, studyVerdict } from '../research/edge/verdict.mjs';
import { slimStudy } from '../research/edge/lab-summary.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'ict-smt-2008');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const mk = (lows) => lows.map((l, i) => ({ time: 3600 * i, open: l + 1, high: l + 2, low: l, close: l + 1 }));
const SIG = mk([110, 108, 106, 104, 102, 100, 102, 104, 106, 108, 110, 108, 106, 104, 99]);
const HOLD = mk([210, 208, 206, 204, 202, 200, 202, 204, 206, 208, 210, 208, 206, 205, 203]);
const TAKE = mk([210, 208, 206, 204, 202, 200, 202, 204, 206, 208, 210, 208, 206, 204, 195]);
const S = SIG.length - 1;

test('smt.mjs is ict-smt\'s detector, byte for byte (sha256 in the pre-registration)', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'smt.mjs'))).digest('hex');
  assert.equal(sha, 'a52082e777e89f84adfa27324f1269943d4180777b504ec4355774787e2dca1e');
  assert.ok(read('PREREGISTRATION.md').includes(sha));
  assert.deepEqual(SMT, { piv: 3, look: 96, win: 3, minWin: 5 });
  assert.deepEqual(PARTNER, { nq: 'es', es: 'nq', ym: 'es', rty: 'es' });
});

test('the rule on hand-made candles: SMT when the partner holds, none when it takes its own low', () => {
  assert.equal(smtAt(SIG, S, 1, HOLD).smt, true);
  assert.equal(smtAt(SIG, S, 1, TAKE).smt, false);
  assert.equal(smtAt(mk([110, 108, 106, 104, 102, 100, 102, 104, 106, 108, 110, 108, 106, 104, 101]), S, 1, HOLD).judged, false);
});

test('no look-ahead: candles after the sweep candle on either market never change the answer', () => {
  const base = smtAt(SIG, S, 1, HOLD);
  const tail = (H, lows) => H.concat(mk(lows).map((b, i) => ({ ...b, time: 3600 * (H.length + i) })));
  assert.deepEqual(smtAt(tail(SIG, [50, 40, 900]), S, 1, tail(HOLD, [10, 5, 1])), base);
  const trap = new Proxy(tail(SIG, [1, 2]), { get(t, k) { if (typeof k === 'string' && /^\d+$/.test(k) && +k > S) throw new Error('read ' + k); return Reflect.get(t, k); } });
  assert.deepEqual(smtAt(trap, S, 1, HOLD), base);
});

test('costs: ict-oos-2008\'s model (0.02 % of price + one tick), net = size x (R - cost / risk)', () => {
  assert.ok(Math.abs(COST.nq(2000) - 0.65) < 1e-12); assert.equal(COST.ym(10000), 3); assert.ok(Math.abs(COST.rty(700) - 0.24) < 1e-12);
  assert.equal(netOf({ size: 1.5, Rraw: 2, r0: 10 }, 1), 2.85);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.ok(welch([5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 5, 6]).p < 0.01);
  const t0 = Date.UTC(2008, 0, 1) / 1000, t1 = Date.UTC(2008, 3, 1) / 1000;
  const m = monthT([{ t: t0 + 86400, R: 1 }, { t: t0 + 2 * 86400, R: 1 }, { t: Date.UTC(2008, 1, 5) / 1000, R: 1 }], t0, t1);
  assert.equal(m.months, 3); assert.equal(m.t, 1.73);
  const a = mulberry32(1000), b = mulberry32(1000); assert.deepEqual([a(), a()], [b(), b()]);
});

test('the study reads the ICT engine and never writes to it', () => {
  const run = read('run.mjs');
  const imports = [...run.matchAll(/(?:from\s+|require\()\s*'([^']+)'/g)].map((m) => m[1]).filter((p) => !p.startsWith('node:'));
  assert.deepEqual(imports.sort(), ['../../../api/_ictlab.js', './smt.mjs']);
  assert.ok(/E\.isASetup\(g, m\) && pred\(g\)/.test(run), 'the filter only narrows the A-rule');
  assert.ok(!/Object\.assign\(P|params: \{[^}]/.test(run), 'no parameter of the tracker is overridden');
  assert.ok(!/\.stop\s*[+\-*]?=[^=]/.test(run), 'no stop is set or moved');
  assert.ok(/endsWith\(path\.join\('ict-smt-2008', 'run\.mjs'\)\)/.test(run), 'importing the runner runs nothing');
  for (const d of ['ict', 'council', 'api']) for (const f of fs.readdirSync(path.join(HERE, '..', d))) if (/\.(mjs|js)$/.test(f)) assert.ok(!fs.readFileSync(path.join(HERE, '..', d, f), 'utf8').includes('ict-smt-2008'), `${d}/${f}`);
});

test('result.json is the run the report describes, on the pre-registered plan', () => {
  const R = JSON.parse(read('result.json')), md = read('RESULT.md'), pre = read('PREREGISTRATION.md');
  assert.equal(R.planSha256, crypto.createHash('sha256').update(pre).digest('hex'), 'the pre-registration was not edited after the run');
  assert.ok(md.includes(R.planSha256.slice(0, 8)));
  assert.equal(R.window.from, '2008-01-01'); assert.equal(R.window.to, '2019-12-31'); assert.equal(R.testsJudged, 2);
  const h = headlineOf(md); assert.ok(h.length <= 220, h);
  const v = R.verdict.split(':')[0]; assert.match(md, new RegExp(`^\\*\\*Verdict: ${v}\\. .+\\*\\*$`, 'm'));
  assert.equal(classify(h), { PASS: 'pass', FAIL: 'fail', INCONCLUSIVE: 'inc' }[v]); assert.equal(studyVerdict(R, md).verdict, classify(h));
  const H1 = R.tests.H1, H2 = R.tests.H2, V = R.streams.smt, N = R.streams.others;
  assert.equal(H2.month.months, 144); assert.deepEqual([H1.holmP, H2.holmP], holm([H1.p, H2.month.p]));
  assert.equal(H1.diff, +(N.all.exp - V.all.exp).toFixed(3));
  assert.equal(R.checks.h1T2, H1.t >= 2); assert.equal(R.checks.h1Placebo, R.placebo.diffAtLeastObserved <= 2); assert.equal(R.checks.h2T2, H2.month.t >= 2);
  const pass = R.checks.nSmt30 && R.checks.h1T2 && R.checks.h1Holm && R.checks.h1Placebo && R.checks.h1x2;
  assert.equal(v, pass ? 'PASS' : !(H1.diff > 0) ? 'FAIL' : 'INCONCLUSIVE');
  assert.equal(R.placebo.draws_.length, 40); assert.deepEqual(R.placebo.draws_.map((d) => d.seed), Array.from({ length: 40 }, (_, i) => 1000 + i));
  assert.equal(R.placebo.diffAtLeastObserved, R.placebo.draws_.filter((d) => d.diff >= H1.diff).length);
  const num = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d), sgn = (x) => (x < 0 ? '−' : '') + Math.abs(x);
  for (const s of [V.all, N.all, V.h1, V.h2, N.h1, N.h2, R.streams.unfiltered.all]) { assert.ok(md.includes(`| ${s.n} |`), `n ${s.n}`); assert.ok(md.includes(num(s.exp)), `R a trade ${s.exp}`); }
  for (const x of [H1.t, H2.month.t, V.m.t]) assert.ok(md.includes(sgn(x)), `t ${x}`);
  assert.ok(md.includes(num(H1.diff) + 'R'));
  assert.equal(R.trades.length, V.all.n + N.all.n);
  assert.ok(R.trades.every((t) => t.d >= '2008-01-01' && t.d <= '2019-12-31'));
  for (const s of Object.values(R.sources)) { assert.equal(s.unresolved, 0); assert.match(s.src, /^OANDA /); }
  const slim = slimStudy(R); assert.equal(slim.candidates.length, 1);
});
