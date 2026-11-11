// node --test tests/desk-ict-equal-lows.test.mjs — research/edge/ict-equal-lows (11 Nov 2026): the equal-pool detector on hand-made
// candles, no look-ahead, the published numbers, and that the study reads the ICT engine without touching it. Offline.
// Not named tests/ict-*: it also checks research files and the Edge lab's verdict reader.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { EQ, sweptSwings, equalPool, dailyAtr, tagSignal } from '../research/edge/ict-equal-lows/eq.mjs';
import { welch, holm } from '../research/edge/ict-equal-lows/run.mjs';
import { headlineOf, classify, studyVerdict } from '../research/edge/verdict.mjs';
import { slimStudy } from '../research/edge/lab-summary.mjs';
import * as T from '../ict/tracker.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'ict-equal-lows');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

// candles from a list of lows: each candle spans low .. low + 2, an hour apart
const mk = (lows) => lows.map((l, i) => ({ time: 3600 * i, open: l + 1, high: l + 2, low: l, close: l + 1 }));
const flip = (H) => H.map((b) => ({ time: b.time, open: -b.open, high: -b.low, low: -b.high, close: -b.close }));
// two swing lows at index 5 (100) and index 13 (`second`), then a candle at index 20 with low `sweep`
const shape = (second, sweep, gap = 0) => { const a = [110, 108, 106, 104, 102, 100, 102, 104, 106, 108, 110]; const b = [106, 104, second, 104, 106, 108, 110, 108, 106]; return mk(a.concat(new Array(gap).fill(111), b, [sweep])); };

test('equal lows: two separate untouched swing lows at about the same price, both taken by one candle', () => {
  const H = shape(100.5, 99), s = H.length - 1, r = equalPool(H, s, 1, 10);   // band = 0.1 x 10 = 1.0
  assert.deepEqual(sweptSwings(H, s, 1).map((x) => x.level), [100, 100.5]);
  assert.equal(r.eq, true); assert.equal(r.pool, 2); assert.equal(r.swings, 2); assert.equal(r.width, 0.05);
});

test('equal lows: one swing only, lows too far apart, or the sweep reaching only one of them is not a pool', () => {
  const far = shape(103, 99), s = far.length - 1;
  assert.equal(equalPool(far, s, 1, 10).eq, false, 'two swept swings 3.0 apart with a 1.0 band');
  assert.equal(equalPool(far, s, 1, 40).eq, true, 'the same swings are equal when the daily range is four times wider');
  const one = shape(100.5, 100.2);   // trades through 100.5 only
  assert.deepEqual(sweptSwings(one, one.length - 1, 1).map((x) => x.level), [100.5]);
  assert.equal(equalPool(one, one.length - 1, 1, 10).eq, false);
  assert.equal(equalPool(shape(100.5, 99), s, 1, null).eq, false, 'no daily ATR yet: not judged');
  assert.equal(equalPool(shape(100.5, 99), s, 1, 0).eq, false);
});

test('equal lows: a swing touched before the sweep candle, or not yet confirmed, does not count', () => {
  // the second low undercuts the first: the first is no longer untouched
  const H = shape(99.5, 98), s = H.length - 1;
  assert.deepEqual(sweptSwings(H, s, 1).map((x) => x.level), [99.5]);
  assert.equal(equalPool(H, s, 1, 10).eq, false);
  // a low whose third right-hand candle is the sweep candle itself is not confirmed before it
  const late = mk([110, 108, 106, 104, 102, 100, 102, 104, 106, 108, 106, 104, 100.4, 104, 106, 99]);
  assert.deepEqual(sweptSwings(late, late.length - 1, 1).map((x) => x.level), [100]);
  // older than the look-back
  const old = shape(100.5, 99, 90), so = old.length - 1;
  assert.deepEqual(sweptSwings(old, so, 1).map((x) => x.level), [100.5]);
  assert.equal(EQ.look, T.P.look); assert.equal(EQ.piv, T.P.piv);
});

test('equal lows: two flat candles are one swing, not a pool (at least 4 candles apart)', () => {
  const H = mk([110, 108, 106, 104, 100, 100, 104, 106, 108, 110, 108, 99]), s = H.length - 1;
  assert.equal(sweptSwings(H, s, 1).length, 2);
  assert.equal(equalPool(H, s, 1, 10).eq, false);
  assert.equal(equalPool(H, s, 1, 10, { ...EQ, sep: 1 }).eq, true);
});

test('equal highs for sells are the exact mirror', () => {
  const H = shape(100.5, 99), M = flip(H), s = H.length - 1;
  const a = equalPool(H, s, 1, 10), b = equalPool(M, s, -1, 10);
  assert.deepEqual({ ...b }, { ...a });
  assert.deepEqual(sweptSwings(M, s, -1).map((x) => x.level), [-100, -100.5]);
  assert.equal(equalPool(M, s, 1, 10).eq, false, 'read as a buy, the mirrored candles hold no swept lows');
});

test('no look-ahead: the answer at a candle never depends on any later candle', () => {
  const H = shape(100.5, 99), s = H.length - 1, base = equalPool(H, s, 1, 10);
  const later = H.concat(mk([50, 40, 30, 20, 500, 600]).map((b, i) => ({ ...b, time: 3600 * (H.length + i) })));
  assert.deepEqual(equalPool(later, s, 1, 10), base);
  // a guard that throws when any candle after s is read
  const trap = new Proxy(later, { get(t, k) { if (typeof k === 'string' && /^\d+$/.test(k) && +k > s) throw new Error('read candle ' + k + ' after the sweep candle'); return Reflect.get(t, k); } });
  assert.deepEqual(equalPool(trap, s, 1, 10), base);
  // the daily ATR uses only daily candles closed before the signal candle's close
  const D = Array.from({ length: 20 }, (_, i) => ({ time: 86400 * i, open: 1, high: 10 + (i >= 16 ? 1000 : 0), low: 0, close: 1 }));
  assert.equal(dailyAtr(D, 86400 * 16), 10); assert.equal(dailyAtr(D, 86400 * 14), null);
  assert.equal(equalPool(H, -1, 1, 10).eq, false); assert.equal(tagSignal({ side: 1, sweepT: 123456789, close: 0 }, H, D).eq, false);
});

test('on the desk\'s own signals (pinned candles): a tag for every signal, and the engine is not changed by it', () => {
  const bars = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'fixtures', 'ict', 'bars.json.gz'))).toString('utf8'));
  const rows = (a) => a.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
  const P0 = JSON.stringify(T.P); let n = 0;
  for (const [k, M] of Object.entries(T.MARKETS)) { if (!bars[k]) continue; const H = rows(bars[k].h1), D = rows(bars[k].d1), frozen = JSON.stringify(H);
    for (const side of [1, -1]) for (const g of T.signals(H, D, side, M.tick)) { n++;
      const stop = g.stop, r = tagSignal(g, H, D);
      assert.equal(typeof r.eq, 'boolean'); assert.ok(r.swings >= 0 && r.pool <= Math.max(1, r.swings));
      // the swings it reports are real: each below-traded by the sweep candle, and the engine's own swept level is one the candle took too
      const s = H.findIndex((b) => b.time === g.sweepT); for (const x of sweptSwings(H, s, side)) assert.ok(side > 0 ? H[s].low < x.level : H[s].high > x.level);
      assert.equal(g.stop, stop, 'the signal keeps its stop'); assert.ok((g.entry - g.stop) * side > 0, 'a stop on the losing side'); }
    assert.equal(JSON.stringify(H), frozen, 'candles untouched'); }
  assert.ok(n >= 1); assert.equal(JSON.stringify(T.P), P0, 'the tracker\'s parameters are as they were');
});

test('the study reads the ICT engine and never writes to it', () => {
  const eq = read('eq.mjs'), run = read('run.mjs');
  assert.ok(!/^\s*import\s/m.test(eq) && !/require\(|process\.|fetch\(|readFile|writeFile|Date\.now/.test(eq), 'the detector is pure');
  const imports = [...run.matchAll(/(?:from\s+|require\()\s*'([^']+)'/g)].map((m) => m[1]).filter((p) => !p.startsWith('node:'));
  assert.deepEqual(imports.sort(), ['../../../api/_ictlab.js', './eq.mjs']);
  assert.equal((run.match(/writeFileSync\(/g) || []).length, 2);   // the candle cache (outside git) and result.json
  assert.ok(/writeFileSync\(path\.join\(CACHE,/.test(run) && /writeFileSync\(path\.join\(OUT, 'result\.json'\)/.test(run));
  assert.ok(!/E\.P\b|Object\.assign\(P|params: \{[^}]/.test(run), 'no parameter of the tracker is overridden');
  assert.ok(/E\.isASetup\(g, m\) && pred\(g\)/.test(run), 'the filter only narrows the A-rule');
  assert.ok(!/stop\s*=|\.stop\s*[+\-*]?=/.test(run + eq), 'no stop is set or moved');
  assert.ok(run.indexOf("stage === 'full'") > 0 && /endsWith\(path\.join\('ict-equal-lows', 'run\.mjs'\)\)/.test(run), 'importing the runner runs nothing');
  // nothing live reads the study
  for (const d of ['ict', 'council', 'api']) for (const f of fs.readdirSync(path.join(HERE, '..', d))) if (/\.(mjs|js)$/.test(f)) assert.ok(!fs.readFileSync(path.join(HERE, '..', d, f), 'utf8').includes('ict-equal-lows'), `${d}/${f}`);
});

test('Holm and Welch', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.deepEqual(holm([0.6258, 0.6805, 0.4629]), [1, 1, 1]);
  const w = welch([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]); assert.equal(w.diff, 0); assert.equal(w.t, 0); assert.equal(w.p, 0.5);
  assert.ok(welch([5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 5, 6]).p < 0.01); assert.equal(welch([1], [1, 2]).t, null);
});

test('result.json is the run the report describes, on the pre-registered plan', () => {
  const R = JSON.parse(read('result.json')), md = read('RESULT.md'), pre = read('PREREGISTRATION.md');
  assert.equal(R.planSha256, crypto.createHash('sha256').update(pre).digest('hex'), 'the pre-registration was not edited after the run');
  assert.ok(md.includes(R.planSha256.slice(0, 8)) && md.includes(R.planSha256.slice(-4)));
  assert.deepEqual({ piv: R.definition.piv, look: R.definition.look, tol: R.definition.tol, sep: R.definition.sep }, EQ);
  assert.equal(R.window.from, '2020-01-01'); assert.equal(R.window.to, '2026-10-31'); assert.equal(R.testsJudged, 3); assert.equal(R.candidates.length, 3);
  // the verdict: the report's first line, the Edge lab's reading and result.json agree
  assert.equal(classify(headlineOf(md)), 'fail'); assert.equal(studyVerdict(R, md).verdict, 'fail'); assert.match(R.verdict, /^FAIL\. None of the 3 pre-registered tests passes/);
  assert.deepEqual(R.candidates.map((c) => c.verdict), ['FAIL', 'FAIL', 'INCONCLUSIVE']);
  assert.ok(!fs.readdirSync(path.join(HERE, '..', 'research', 'proposals')).some((f) => /equal-lows/.test(f)), 'nothing passed, so no proposal');
  // every published figure of the three tests is in the report
  const num = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d), n = (x) => x.toLocaleString('en-US');
  for (const c of R.candidates) {
    for (const s of [c.is, c.oos, c.others.is, c.others.oos, R.baseline[c.book].is, R.baseline[c.book].oos]) { assert.ok(md.includes(`| ${n(s.n)} |`), `n ${s.n}`); if (s.exp !== 0) assert.ok(md.includes(num(s.exp)), `R a trade ${s.exp}`); }
    assert.ok(md.includes(num(c.vsOthers.oos.diff) + 'R') && md.includes(num(c.vsOthers.is.diff) + 'R'));
    assert.equal(c.vsOthers.holmP, 1); assert.equal(c.checks.holm, false);
    // the bar, recomputed from the published stats
    const B = R.baseline[c.book], pos = [2024, 2025, 2026].filter((y) => c.years[y] > 0).length;
    assert.equal(c.checks.oosN30, c.oos.n >= 30); assert.equal(c.checks.oosBeatsBase, c.oos.exp > B.oos.exp); assert.equal(c.checks.isBeatsBase, c.is.exp > B.is.exp);
    assert.equal(c.checks.isPositive, c.is.exp > 0); assert.equal(c.checks.oosYears, pos >= 2); assert.equal(c.oosYearsPositive, `${pos} of 3`);
    const all = Object.values(c.checks).every(Boolean), fail = !c.checks.oosBeatsBase || !c.checks.oosPositive;
    assert.equal(c.verdict, all ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE');
  }
  // the trade list is the pooled equal-pool stream, and its total is the published one
  const T1 = R.candidates[0]; assert.equal(R.trades.length, T1.all.n); assert.equal(T1.all.n, T1.is.n + T1.oos.n);
  assert.ok(Math.abs(R.trades.reduce((a, t) => a + t.R, 0) - T1.all.R) < 0.02);
  assert.ok(R.trades.every((t, i) => i === 0 || t.d >= R.trades[i - 1].d) && R.trades.every((t) => t.d >= '2020-01-01' && t.d <= '2026-10-31'));
  // streams: the two halves together hold about as many trades as the unfiltered stream (each is its own one-open stream)
  for (const c of R.candidates) { const B = R.baseline[c.book], sum = c.all.n + c.others.all.n; assert.ok(sum >= B.all.n && sum <= B.all.n * 1.05, `${c.book}: ${sum} vs ${B.all.n}`); }
  for (const s of Object.values(R.sources)) { assert.equal(s.unresolved, 0); assert.match(s.src, /^OANDA /); }
  // the Edge lab's summary keeps what its page reads
  const slim = slimStudy(R); assert.equal(slim.candidates.length, 3); assert.equal(slim.candidates[0].oos.n, 107); assert.ok(slim.baseline.all.oos.n > 0);
});
