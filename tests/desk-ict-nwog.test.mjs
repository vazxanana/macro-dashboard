// node --test tests/desk-ict-nwog.test.mjs — research/edge/ict-nwog (14 Nov 2026): the NWOG / NDOG detector on hand-made candles,
// no look-ahead, the published numbers, and that the study reads the ICT engine without touching it. Offline.
// Not named tests/ict-*: it also checks research files and the Edge lab's verdict reader (as tests/desk-ict-equal-lows.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GAP, findGaps, filledBefore, liveGaps, ranInto, tagSignal } from '../research/edge/ict-nwog/gap.mjs';
import { welch, holm, monthT, rng } from '../research/edge/ict-nwog/run.mjs';
import { headlineOf, classify, studyVerdict } from '../research/edge/verdict.mjs';
import { slimStudy } from '../research/edge/lab-summary.mjs';
import * as T from '../ict/tracker.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'ict-nwog');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const U = (d, h) => Date.UTC(2026, 10, d, h) / 1000;   // November 2026 (New York = UTC-5 after 1 Nov)

// Thu 5 Nov 12:00 UTC .. Mon 9 Nov 06:00 UTC, as the lab keeps them (the 17:00 New York hour dropped), CME-shut weekend hours left
// out except one stray CFD print on Saturday (at 102.1). Levels: 100 until Thursday's 16:00 New York candle; reopen at 101, then 102 (NDOG
// 100-101, up); Friday closes 102; Sunday reopens at 103, then 104 (NWOG 102-103, up).
function week(sweep) {
  const H = [];
  for (let t = U(5, 12); t <= U(9, 6); t += 3600) {
    if (T.inHalt(t)) continue;
    const wd = new Date(t * 1000).getUTCDay(), sat = t === U(7, 12);
    if (!sat && (wd === 6 || (wd === 5 && t >= U(6, 22)) || (wd === 0 && t < U(8, 23)))) continue;
    let c = t < U(5, 23) ? 100 : t < U(8, 23) ? 102 : 104, o = c;
    if (t === U(5, 23)) o = 101; if (t === U(8, 23)) o = 103; if (sat) { o = c = 102.1; }
    H.push({ time: t, open: o, high: Math.max(o, c) + 0.2, low: Math.min(o, c) - 0.2, close: c });
  }
  if (sweep) Object.assign(H[H.length - 1], sweep);
  return H;
}
const neg = (H) => H.map((b) => ({ time: b.time, open: -b.open, high: -b.low, low: -b.high, close: -b.close }));

test('gaps: the daily 17:00 New York break is an NDOG, the weekend an NWOG, a CFD print while CME is shut is ignored', () => {
  const H = week(), g = findGaps(H);
  assert.deepEqual(g.map((x) => [x.kind, x.close, x.open, x.lo, x.hi]), [['ndog', 100, 101, 100, 101], ['nwog', 102, 103, 102, 103]]);
  assert.equal(H[g[0].j].time, U(5, 21), 'the close is the 16:00 New York candle'); assert.equal(g[0].t, U(5, 23), 'the reopen is the 18:00 candle');
  assert.equal(H[g[1].j].time, U(6, 21), 'Friday\'s last candle, not the Saturday print'); assert.equal(g[1].t, U(8, 23));
  // a break whose open equals the close is no gap
  const flat = week(); flat.find((b) => b.time === U(8, 23)).open = 102; assert.deepEqual(findGaps(flat).map((x) => x.kind), ['ndog']);
  assert.equal(GAP.last, 5);
});

test('ran into: a buy\'s down-wick into or through an open gap; filled gaps and gaps the candle does not reach do not count', () => {
  const into = (lo, top = 104) => { const H = week({ open: top, close: top, high: top + 0.2, low: lo }); return ranInto(H, findGaps(H), H.length - 1, 1); };
  assert.deepEqual(into(102.5), { gap: true, kinds: ['nwog'], n: 1, live: 2 });
  assert.deepEqual(into(100.5).kinds.sort(), ['ndog', 'nwog']);
  assert.deepEqual(into(95), { gap: true, kinds: ['nwog', 'ndog'], n: 2, live: 2 }, 'through both gaps counts');
  assert.equal(into(103.5).gap, false, 'the wick stops above the gap');
  assert.equal(into(99, 101.8).kinds.includes('nwog'), false, 'a body below the NWOG did not run into it from above');
  // a candle between the reopen and the sweep that traded back to 102 filled the NWOG
  const H = week({ open: 104, close: 104, high: 104.2, low: 102.5 }); H[H.length - 3].low = 101.9;
  const G = findGaps(H); assert.equal(filledBefore(H, G[1], H.length - 1), true); assert.equal(filledBefore(H, G[0], H.length - 1), false);
  assert.deepEqual(ranInto(H, G, H.length - 1, 1), { gap: false, kinds: [], n: 0, live: 1 });
  // the pre-registered fill rule reads every kept candle after the reopen, a CFD print while CME is shut included
  const S = week(); S.find((b) => b.time === U(7, 12)).low = 99.9; assert.equal(filledBefore(S, findGaps(S)[0], S.length - 1), true);
});

test('sells are the exact mirror', () => {
  const H = week({ open: 104, close: 104, high: 104.2, low: 100.5 }), M = neg(H), s = H.length - 1;
  assert.deepEqual(findGaps(M).map((x) => [x.kind, x.lo, x.hi]), findGaps(H).map((x) => [x.kind, -x.hi, -x.lo]));
  assert.deepEqual(ranInto(M, findGaps(M), s, -1), ranInto(H, findGaps(H), s, 1));
  assert.equal(ranInto(M, findGaps(M), s, 1).gap, false, 'read as a buy, the mirrored candle reaches no gap from above');
});

test('only the 5 most recent gaps of a kind are live', () => {
  const H = Array.from({ length: 40 }, (_, i) => ({ time: 3600 * i, open: 1000, high: 1000.2, low: 999.8, close: 1000 }));
  const G = Array.from({ length: 7 }, (_, k) => ({ kind: 'ndog', i: 2 + 3 * k, j: 1 + 3 * k, t: 0, close: 500 + k, open: 501 + k, lo: 500 + k, hi: 501 + k }));
  assert.deepEqual(liveGaps(H, G, 39).map((g) => g.lo), [502, 503, 504, 505, 506]);
  assert.deepEqual(liveGaps(H, G, 12).map((g) => g.lo), [500, 501, 502, 503], 'a gap whose reopen is the sweep candle or later is not yet known');
});

test('no look-ahead: the tag at the sweep candle never depends on a later candle', () => {
  const H = week({ open: 104, close: 104, high: 104.2, low: 100.5 }), s = H.length - 1, base = ranInto(H, findGaps(H), s, 1);
  const later = H.concat(Array.from({ length: 30 }, (_, i) => ({ time: H[s].time + 3600 * (i + 1), open: 50, high: 500, low: 1, close: 60 })));
  assert.deepEqual(ranInto(later, findGaps(later), s, 1), base);
  const G = findGaps(later), trap = new Proxy(later, { get(t, k) { if (typeof k === 'string' && /^\d+$/.test(k) && +k > s) throw new Error('read candle ' + k + ' after the sweep candle'); return Reflect.get(t, k); } });
  assert.deepEqual(ranInto(trap, G, s, 1), base);
  assert.deepEqual(tagSignal({ side: 1, sweepT: 123 }, H, findGaps(H)), { gap: false, kinds: [], n: 0, live: 0 });
});

test('on the desk\'s own signals (pinned candles): a tag for every signal, and the engine is not changed by it', () => {
  const bars = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'fixtures', 'ict', 'bars.json.gz'))).toString('utf8'));
  const rows = (a) => a.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
  const P0 = JSON.stringify(T.P); let n = 0;
  for (const [k, M] of Object.entries(T.MARKETS)) { if (!bars[k]) continue; const H = rows(bars[k].h1), D = rows(bars[k].d1), frozen = JSON.stringify(H), G = findGaps(H);
    for (const g of G) { assert.ok(g.j < g.i && g.lo < g.hi); assert.ok(['nwog', 'ndog'].includes(g.kind)); }
    for (const side of [1, -1]) for (const g of T.signals(H, D, side, M.tick)) { n++;
      const stop = g.stop, r = tagSignal(g, H, G);
      assert.equal(typeof r.gap, 'boolean'); assert.ok(r.n <= r.live && r.live <= 2 * GAP.last);
      assert.equal(g.stop, stop, 'the signal keeps its stop'); assert.ok((g.entry - g.stop) * side > 0, 'a stop on the losing side'); }
    assert.equal(JSON.stringify(H), frozen, 'candles untouched'); }
  assert.ok(n >= 1); assert.equal(JSON.stringify(T.P), P0, 'the tracker\'s parameters are as they were');
});

test('the study reads the ICT engine and never writes to it', () => {
  const gap = read('gap.mjs'), run = read('run.mjs');
  const gi = [...gap.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]); assert.deepEqual(gi, ['../../../ict/calendar.mjs']);
  assert.ok(!/require\(|process\.|fetch\(|readFile|writeFile|Date\.now/.test(gap), 'the detector is pure');
  const imports = [...run.matchAll(/(?:from\s+|require\()\s*'([^']+)'/g)].map((m) => m[1]).filter((p) => !p.startsWith('node:'));
  assert.deepEqual(imports.sort(), ['../../../api/_ictlab.js', '../../../council/fills.mjs', './gap.mjs']);
  assert.equal((run.match(/writeFileSync\(/g) || []).length, 2);   // the candle cache (outside git) and result.json
  assert.ok(/writeFileSync\(path\.join\(CACHE,/.test(run) && /writeFileSync\(path\.join\(OUT, 'result\.json'\)/.test(run));
  assert.ok(!/E\.P\b|Object\.assign\(P|params: \{[^}]/.test(run), 'no parameter of the tracker is overridden');
  assert.ok(/E\.isASetup\(g, m\) && pred\(g\)/.test(run), 'the filter only narrows the A-rule');
  assert.ok(!/\.stop\s*[+\-*]?=[^=]/.test(run + gap), 'no stop is set or moved');
  assert.ok(/endsWith\(path\.join\('ict-nwog', 'run\.mjs'\)\)/.test(run), 'importing the runner runs nothing');
  for (const d of ['ict', 'council', 'api']) for (const f of fs.readdirSync(path.join(HERE, '..', d))) if (/\.(mjs|js)$/.test(f)) assert.ok(!fs.readFileSync(path.join(HERE, '..', d, f), 'utf8').includes('ict-nwog'), `${d}/${f}`);
});

test('statistics: Holm, Welch, t on calendar-month sums, the seeded placebo draws', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(welch([5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 5, 6]).p < 0.01); assert.equal(welch([1], [1, 2]).t, null);
  const from = Date.UTC(2024, 0, 1) / 1000, to = Date.UTC(2024, 3, 1) / 1000, m = (mo, R) => ({ t: Date.UTC(2024, mo, 10) / 1000, R });
  const r = monthT([m(0, 1), m(0, 1), m(1, 1), m(2, 3)], from, to);   // month sums 2, 1, 3
  assert.equal(r.months, 3); assert.equal(r.mean, 2); assert.equal(r.t, 3.46);
  assert.equal(monthT([m(0, 3)], from, to).mean, 1, 'a month with no trade counts as 0');
  const a = rng(7), b = rng(7), xs = Array.from({ length: 5 }, () => a()); assert.deepEqual(xs, Array.from({ length: 5 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1)); assert.notDeepEqual(xs, Array.from({ length: 5 }, rng(8)));
});

test('result.json is the run the report describes, on the pre-registered plan', () => {
  const R = JSON.parse(read('result.json')), md = read('RESULT.md'), pre = read('PREREGISTRATION.md');
  assert.equal(R.planSha256, crypto.createHash('sha256').update(pre).digest('hex'), 'the pre-registration was not edited after the run');
  assert.ok(md.includes(R.planSha256.slice(0, 8)) && md.includes(R.planSha256.slice(-4)));
  for (const f of ['gap.mjs', 'run.mjs']) assert.ok(pre.includes(crypto.createHash('sha256').update(read(f)).digest('hex')), `${f} is the file the pre-registration hashed`);
  assert.equal(R.window.from, '2020-01-01'); assert.equal(R.window.to, '2026-10-31'); assert.equal(R.testsJudged, 3);
  // the verdict: the report's first line, the Edge lab's reading and result.json agree
  const h = headlineOf(md); assert.ok(h.length <= 220, h); assert.equal(classify(h), 'fail'); assert.equal(studyVerdict(R, md).verdict, 'fail');
  assert.match(R.verdict, /^FAIL\./); assert.ok(R.tests.every((x) => !x.pass)); assert.deepEqual(R.tests.map((x) => x.holmP), holm(R.tests.map((x) => x.p)));
  assert.ok(!fs.readdirSync(path.join(HERE, '..', 'research', 'proposals')).some((f) => /nwog/.test(f)), 'nothing passed, so no proposal');
  // every figure of the tests and streams is in the report
  const num = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d), n = (x) => x.toLocaleString('en-US');
  for (const x of R.tests) { assert.ok(md.includes(num(x.value) + 'R'), `${x.id} value`); assert.ok(md.includes(Math.abs(x.t).toFixed(2)), `${x.id} t`); }
  for (const c of R.candidates) for (const s of [c.is, c.oos]) { assert.ok(md.includes(`| ${n(s.n)} |`), `n ${s.n}`); assert.ok(md.includes(num(s.exp)), `R a trade ${s.exp}`); }
  // the bar, recomputed from the published stats
  for (const [x, c] of [[R.tests[0], R.candidates[0]], [R.tests[2], R.candidates[2]]]) {
    assert.equal(x.checks.oosN30, c.oos.n >= 30); assert.equal(x.checks.oosT2, c.monthT.oos.t >= 2); assert.equal(x.checks.isPositive, c.is.exp > 0);
    assert.equal(x.checks.oos2xPositive, c.oos2x.exp > 0); assert.equal(x.t, c.monthT.oos.t); assert.equal(x.value, c.oos.exp); }
  assert.equal(R.tests[1].value, R.candidates[0].vsWithout.oos.diff);
  // placebo
  const P = R.placebo; assert.equal(P.rows.length, 40); assert.equal(P.atLeastRealT, P.rows.filter((q) => q.oosT >= P.realOosT).length);
  assert.ok(md.includes(`${P.atLeastRealT} of 40`)); assert.equal(P.reachT2, P.rows.filter((q) => q.oosT >= 2).length);
  // the trade list is the pooled WITH stream
  const W = R.candidates[0]; assert.equal(R.trades.length, W.all.n); assert.ok(Math.abs(R.trades.reduce((a, t) => a + t.R, 0) - W.all.R) < 0.02);
  for (const s of Object.values(R.sources)) { assert.equal(s.unresolved, 0); assert.match(s.src, /^OANDA /); }
  const slim = slimStudy(R); assert.ok(slim && typeof slim === 'object');
});
