// MSNR entry study (research/edge/msnr-entry): the engulfing entry, the trade simulation and the three streams on small
// hand-made candle series, the no-look-ahead property, the stop rule, the statistics, and the committed result against the
// pre-registered bar and the written report. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, STREAMS, STREAM_OF, engulf, candidates, simulate, book, inSession, closeStructure, calls, dayKey, group, bucket, stat, welch, normP, holm, conditions, verdictOf, bootstrap, windowOf, summarize, study } from '../research/edge/msnr-entry/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/msnr-entry/PREREGISTRATION.md'), RUN = rd('../research/edge/msnr-entry/run.mjs'), RES = rd('../research/edge/msnr-entry/RESULT.md');
const J = JSON.parse(rd('../research/edge/msnr-entry/result.json'));
const T0 = Date.UTC(2021, 0, 6, 12, 0, 0) / 1000;      // a Wednesday, 12:00 UTC, on a 15-minute boundary
const bars = (rows, t0 = T0) => rows.map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
const flip = (rows) => rows.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

// A falling 15-minute candle (M5 candles 0-2: 100 -> 98), a rising one that engulfs its body (3-5: 98 -> 100.5; the setup is
// known at candle 6's open), an M5 falling candle (6) and the M5 candle that engulfs it (7: the trigger), the entry at candle
// 8's open 100.8, stop = the pair's lower low 99.8 - 0.30 = 99.5 (r0 1.3), target 1.5R = 102.75, reached by candle 10.
const ROWS = [
  [100, 100.1, 99.3, 99.4], [99.4, 99.5, 98.6, 98.7], [98.7, 98.8, 97.9, 98.0],
  [98.0, 98.9, 97.95, 98.8], [98.8, 99.9, 98.7, 99.8], [99.8, 100.6, 99.7, 100.5],
  [100.5, 100.55, 99.9, 100.0], [100.0, 100.9, 99.8, 100.8],
  [100.8, 101.2, 100.7, 101.1], [101.1, 102.0, 101.0, 101.9], [101.9, 102.8, 101.8, 102.7],
  [102.7, 102.75, 102.6, 102.7], [102.7, 102.75, 102.6, 102.7],
];
const edit = (ch, rows = ROWS) => rows.map((r, i) => ch[i] || r);

test('the constants, windows and tests are the pre-registered ones', () => {
  assert.deepEqual([P.BODY, P.ARM, P.PAD, P.MIN_R0, P.HOLD, P.COST, P.K, P.ZONE_AGE, P.WAIT], [0.4, 2700, 0.30, 1, 43200, 0.30, 2, 60, 10]);
  for (const s of ['`BODY = 0.4`', '`ARM = 2700` s', '`PAD = 0.30` $', '`MIN_R0 = 1.00` $', '`HOLD = 43200` s', '`COST = 0.30` $', 'Window A: 1 Jan 2007 to 31 Dec 2019', 'Window B: 1 Jan 2020 to 31 Oct 2026', 't >= 2.0 in window B', 'Tests (fixed: three)', '**PASS**: T1 passes.']) assert.ok(PRE.includes(s), s);
  assert.deepEqual(P.A, ['2007-01-01', '2019-12-31']); assert.deepEqual(P.B, ['2020-01-01', '2026-10-31']);
  assert.deepEqual(Object.keys(TESTS), ['T1', 'T2', 'T3']); assert.deepEqual([TESTS.T1.rr, TESTS.T2.rr, TESTS.T3.rr], [1.5, 2, 1.5]);
  assert.deepEqual([TESTS.T1.session, TESTS.T2.session, TESTS.T3.session], [[12, 16], [12, 16], null]); assert.deepEqual(Object.keys(STREAMS), ['ALL', 'WITH', 'AGAINST']);
  assert.equal(windowOf(Date.UTC(2019, 11, 31, 23) / 1000), 'a'); assert.equal(windowOf(Date.UTC(2020, 0, 1) / 1000), 'b'); assert.equal(windowOf(Date.UTC(2006, 11, 31) / 1000), null); assert.equal(windowOf(Date.UTC(2026, 10, 1) / 1000), null);
});

test('the owner\'s private skill text is not in the repository files of this study', () => {
  for (const s of [PRE, RUN, RES, JSON.stringify(J)]) for (const w of ['L3XUS', 'Prem,', 'L3-SYSTEM', 'Sama', 'BERG', 'Scalp Edge', 'cBot']) assert.ok(!s.includes(w), w);
  assert.ok(!/from ['"][^'"]*msnr-direction/.test(RUN), 'nothing is imported from the direction study');
  assert.ok(!/from ['"]\.\.\/\.\.\/\.\.\/(council|api|ict)\//.test(RUN), 'a study imports nothing live');
});

test('body engulf: next to each other, opposite colours, body over body, more than 0.4 of the first body', () => {
  const b = (time, o, c) => ({ time, open: o, high: Math.max(o, c) + 0.1, low: Math.min(o, c) - 0.1, close: c });
  assert.equal(engulf(b(0, 100, 99), b(300, 99, 100), 300), 1); assert.equal(engulf(b(0, 99, 100), b(300, 100, 99), 300), -1);
  assert.equal(engulf(b(0, 100, 99), b(300, 99.1, 100), 300), 0, 'opens above the first close');
  assert.equal(engulf(b(0, 100, 99), b(300, 99, 99.9), 300), 0, 'closes below the first open');
  assert.equal(engulf(b(0, 100, 99), b(600, 99, 100), 300), 0, 'a candle is missing between them');
  assert.equal(engulf(b(0, 99, 100), b(300, 100, 101), 300), 0, 'same colour');
  assert.equal(engulf(b(0, 100, 100), b(300, 100, 100), 300), 0, 'no body');
});

test('a buy candidate: setup, trigger, entry at the next open, stop past the pair, and its mirror image', () => {
  const { cand, funnel } = candidates(bars(ROWS));
  assert.equal(cand.length, 1); const c = cand[0];
  assert.deepEqual([c.i, c.t, c.trig, c.side, c.entry, c.stop, c.r0, c.hour, c.setup], [8, T0 + 8 * 300, T0 + 7 * 300, 1, 100.8, 99.5, 1.3, 12, T0 + 1800]);
  assert.equal(funnel.setups, 1); assert.ok(funnel.triggers >= 2, 'the M5 engulf inside the setup candle is a trigger that was not armed'); assert.equal(funnel.armed, 1);
  const s = candidates(bars(flip(ROWS))).cand; assert.equal(s.length, 1);
  assert.deepEqual([s[0].i, s[0].side, s[0].entry, s[0].r0], [8, -1, 99.2, 1.3]); near(s[0].stop, 100.5);
  for (const x of [c, s[0]]) { assert.ok(x.r0 > 0); assert.ok(x.side > 0 ? x.stop < x.entry : x.stop > x.entry, 'the stop is on the losing side'); }
});

test('no candidate: no setup, the trigger too late, a gap before the entry candle, a stop under $1.00 away', () => {
  assert.equal(candidates(bars(edit({ 5: [99.8, 100.0, 99.7, 99.9] }))).cand.length, 0, 'the 15-minute candle does not engulf (closes under the first open)');
  // the same trigger pair nine candles later (45 minutes after the setup became known): not armed any more
  const flat = [100.5, 100.55, 100.45, 100.5], late = [...ROWS.slice(0, 6), ...Array(9).fill(flat), ...ROWS.slice(6)];
  assert.equal(candidates(bars(late)).cand.length, 0);
  const just = [...ROWS.slice(0, 6), ...Array(7).fill(flat), ...ROWS.slice(6)];      // the trigger candle opens 40 minutes after: still armed
  assert.equal(candidates(bars(just)).cand.length, 1);
  const gap = bars(ROWS); for (let i = 8; i < gap.length; i++) gap[i].time += 300;
  const g = candidates(gap); assert.equal(g.cand.length, 0); assert.equal(g.funnel.gap, 1);
  const tight = candidates(bars(edit({ 6: [100.5, 100.55, 100.3, 100.35], 7: [100.35, 100.7, 100.3, 100.6], 8: [100.6, 101.2, 100.55, 101.1] })));
  assert.equal(tight.cand.length, 0); assert.equal(tight.funnel.small, 1);       // stop 100.0, entry 100.6: r0 0.6
});

test('simulation: target, stop first when one candle holds both, a gap through the stop, the 12-hour exit, costs', () => {
  const run = (rows, rr = 1.5) => { const M = bars(rows), c = candidates(M).cand[0]; return simulate(M, c, rr); };
  const a = run(ROWS); assert.equal(a.exit, 'target'); assert.equal(a.closed, T0 + 10 * 300); near(a.target, 102.75); near(a.R, 1.5); near(a.net, 1.5 - 0.3 / 1.3, 1e-4); near(a.net2, 1.5 - 0.6 / 1.3, 1e-4);
  const both = run(edit({ 10: [101.9, 102.8, 99.4, 102.7] })); assert.equal(both.exit, 'stop'); near(both.R, -1); near(both.net, -1 - 0.3 / 1.3, 1e-4);
  const gap = run(edit({ 9: [99.0, 99.2, 98.8, 99.1] })); assert.equal(gap.exit, 'stop (gap)'); near(gap.exitPx, 99.0); near(gap.R, (99.0 - 100.8) / 1.3, 1e-4); assert.ok(gap.R < -1);
  assert.equal(run(ROWS, 2), null, 'the 2R target 103.4 is not reached and the file ends: no result, not a marked one');
  const flat = [101, 101.2, 100.9, 101], long = [...ROWS.slice(0, 9), ...Array(150).fill(flat)], t = run(long);
  assert.equal(t.exit, 'time'); assert.equal(t.closed, T0 + 8 * 300 + 43200); near(t.exitPx, 101); near(t.R, 0.2 / 1.3, 1e-4);
  // the entry candle itself can stop the trade
  const first = run(edit({ 8: [100.8, 100.9, 99.4, 99.6] })); assert.equal(first.exit, 'stop'); assert.equal(first.closed, T0 + 8 * 300);
  // the mirror image gives the same R
  const M = bars(flip(ROWS)), s = simulate(M, candidates(M).cand[0], 1.5); assert.equal(s.exit, 'target'); near(s.R, 1.5); near(s.target, 97.25);
});

test('one at a time, and the three streams', () => {
  // two setups: the second trigger comes while the first trade is still open
  const flat = [101, 101.2, 100.9, 101], shift = (rows, d) => rows.map((r) => r.map((x) => +(x + d).toFixed(2)));
  // (a far 5R target, so the first trade stays open until its 12-hour exit; the second pattern sits $2 higher, above the first stop)
  const two = [...ROWS.slice(0, 9), flat, flat, flat, ...shift(ROWS.slice(0, 9), 2), ...Array(150).fill([102.9, 103.1, 102.8, 102.9])];
  const M = bars(two), C = candidates(M).cand; assert.equal(C.length, 2); assert.equal(C[1].i, 20);
  const b = book(M, C, 5); assert.equal(b.trades.length, 1); assert.equal(b.busy, 1); assert.equal(b.trades[0].exit, 'time'); assert.ok(b.trades[0].closed > C[1].t);
  const alone = book(M, C.slice(1), 5); assert.equal(alone.trades.length, 1); assert.equal(alone.trades[0].i, C[1].i);
  // a candidate entering on the very candle the previous trade closed on is skipped; the next candle is free
  const N = bars(ROWS), c0 = candidates(N).cand[0], at = (i) => ({ ...c0, i, t: N[i].time });
  assert.equal(book(N, [c0], 1.5).trades[0].closed, N[10].time);
  assert.equal(book(N, [c0, at(10)], 1.5).trades.length, 1); assert.equal(book(N, [c0, at(11)], 1.5).trades.length, 2);
  const c = (side, call) => ({ side, call });
  assert.deepEqual(['ALL', 'WITH', 'AGAINST'].map((s) => [c(1, 1), c(1, -1), c(-1, -1), c(-1, 1), c(1, 0), c(-1, 0)].filter(STREAM_OF[s]).length), [6, 2, 2]);
  assert.ok(STREAM_OF.WITH(c(-1, -1)) && STREAM_OF.AGAINST(c(-1, 1)) && !STREAM_OF.WITH(c(1, 0)) && !STREAM_OF.AGAINST(c(1, 0)));
  assert.ok(inSession({ hour: 12 }, [12, 16]) && inSession({ hour: 15 }, [12, 16]) && !inSession({ hour: 16 }, [12, 16]) && !inSession({ hour: 11 }, [12, 16]) && inSession({ hour: 3 }, null));
});

// a seeded random walk long enough for Daily key levels, H4 switches and many candidates
function walk(n, seed, from = Date.UTC(2021, 0, 4) / 1000) {
  let a = seed >>> 0; const R = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = []; let px = 1800, drift = 0;
  for (let i = 0; i < n; i++) { if (i % 900 === 0) drift = (R() - 0.5) * 0.3; const o = px, c = +(o + drift + (R() - 0.5) * 3).toFixed(2), h = +(Math.max(o, c) + R() * 0.8).toFixed(2), l = +(Math.min(o, c) - R() * 0.8).toFixed(2); out.push({ time: from + i * 300, open: o, high: h, low: l, close: c }); px = c; }
  return out;
}

test('no look-ahead: changing any candle from t on never changes a candidate entered before t, its call, or a trade closed before t', () => {
  const F = walk(40000, 7), all = candidates(F).cand;
  assert.ok(all.length > 200, `${all.length} candidates`); assert.ok(all.some((c) => c.call === 1) && all.some((c) => c.call === -1), 'the call takes both sides on this series');
  assert.ok(all.some((c) => c.ms !== 0));
  const tr = book(F, all, 1.5).trades;
  for (const k of [9000, 21377, 33000]) {
    const G = F.slice(0, k).concat(walk(F.length - k, 99 + k, F[k].time).map((b) => ({ ...b, open: b.open + 50, high: b.high + 55, low: b.low + 45, close: b.close + 50 })));
    const cut = candidates(G).cand.filter((c) => c.i < k), ref = all.filter((c) => c.i < k);
    assert.deepEqual(cut, ref, `candidates before ${k}`);
    assert.deepEqual(candidates(F.slice(0, k + 1)).cand.filter((c) => c.i < k), ref, `prefix ${k}`);
    const before = tr.filter((o) => o.closed < F[k].time), tg = book(G, candidates(G).cand, 1.5).trades.filter((o) => o.closed < F[k].time);
    assert.deepEqual(tg, before, `trades closed before ${k}`);
  }
  // the call at an H4 close is the same on the candles up to it
  const H4 = group(F, bucket(P.H4)), full = calls(H4, dayKey).call, part = calls(H4.slice(0, 400), dayKey).call;
  assert.deepEqual([...part], [...full.slice(0, 400)]);
  const ms = closeStructure(H4); assert.deepEqual([...closeStructure(H4.slice(0, 300))], [...ms.slice(0, 300)]);
});

test('every simulated trade has a stop on the losing side with a positive distance, and never loses more than the stop unless it gapped', () => {
  const F = walk(40000, 11), { cand } = candidates(F); let n = 0;
  for (const rr of [1.5, 2]) for (const s of Object.keys(STREAMS)) for (const o of book(F, cand.filter(STREAM_OF[s]), rr).trades) { n++;
    assert.ok(o.r0 >= P.MIN_R0); assert.ok(o.side > 0 ? o.stop < o.entry : o.stop > o.entry); near(o.r0, o.side * (o.entry - o.stop), 2e-3);
    assert.ok(o.side > 0 ? o.target > o.entry : o.target < o.entry); assert.ok(o.closed >= o.t); assert.ok(o.closed - o.t <= P.HOLD);
    if (o.exit === 'stop') near(o.R, -1, 1e-3); if (o.exit === 'target') near(o.R, rr, 1e-3); if (o.exit === 'stop (gap)') assert.ok(o.R <= -1 + 1e-3); if (o.exit === 'time') assert.ok(o.R > -1 && o.R < rr);
    assert.ok(o.net < o.R && o.net2 < o.net); assert.ok(o.t - o.trig === 300 && o.trig - o.setup < P.ARM && o.trig >= o.setup); }
  assert.ok(n > 300, `${n} trades`);
  const b = book(F, cand, 1.5).trades; for (let i = 1; i < b.length; i++) assert.ok(b[i].t > b[i - 1].closed, 'one at a time');
});

test('statistics: t, Welch, Holm, the bootstrap, the conditions and the verdict', () => {
  const s = stat([1, -1, 1, 1, -1, 2]); assert.deepEqual([s.n, s.exp, s.wr, s.R, s.maxDD, s.pf], [6, 0.5, 0.667, 3, 1, 2.5]); near(s.t, 0.5 / (Math.sqrt(1.5) / Math.sqrt(6)), 0.006);
  assert.equal(stat([]).n, 0); assert.equal(welch([1, 2, 3, 4], [1, 2, 3, 4]), 0); assert.ok(welch([2, 3, 4, 5], [1, 2, 3, 4]) > 0);
  near(normP(0), 0.5, 1e-3); near(normP(1.645), 0.05, 1e-3); near(normP(-1.645), 0.95, 1e-3);
  assert.deepEqual(holm([['a', 0.01], ['b', 0.04], ['c', 0.03]]), { a: 0.03, c: 0.06, b: 0.06 });
  const bt = bootstrap([1, -1, 1, 1, -1, 2, 1, -1, 1.5, -1, 1, -1]); assert.deepEqual(bt, bootstrap([1, -1, 1, 1, -1, 2, 1, -1, 1.5, -1, 1, -1]), 'seeded'); assert.ok(bt.positiveShare > 0.5 && bt.dd95 >= bt.dd50);
  const S = (wa, wb, aa, ab, gb, x2 = 0.05) => ({ WITH: { a: { n: 150, exp: wa, t: 1 }, b: { n: 150, exp: wb, t: wb > 0.1 ? 2.4 : 0.5, x2 } }, ALL: { a: { n: 300, exp: aa }, b: { n: 300, exp: ab } }, AGAINST: { a: { n: 150, exp: 0 }, b: { n: 150, exp: gb } } });
  const mk = (st, p) => ({ streams: st, conditions: conditions(st, p) });
  const good = { T1: mk(S(0.1, 0.2, 0.05, 0.1, 0), 0.02), T2: mk(S(-0.1, 0.02, 0, 0, 0), 0.9), T3: mk(S(-0.1, -0.1, 0, 0, 0), 1) };
  assert.equal(verdictOf(good), 'PASS'); assert.ok(good.T1.pass && !good.T2.pass);
  assert.equal(verdictOf({ T1: mk(S(0.1, 0.2, 0.15, 0.1, 0), 0.02), T2: good.T2, T3: good.T3 }), 'INCONCLUSIVE', 'positive in both windows with t >= 2, but the gate does not add in 2007-19');
  assert.equal(verdictOf({ T1: mk(S(0.1, 0.2, 0.05, 0.1, 0), 0.2), T2: good.T2, T3: good.T3 }), 'INCONCLUSIVE', 'does not survive Holm');
  assert.equal(verdictOf({ T1: good.T2, T2: mk(S(0.1, 0.2, 0.05, 0.1, 0), 0.02), T3: good.T3 }), 'INCONCLUSIVE', 'only a variant passes');
  assert.equal(verdictOf({ T1: mk(S(-0.1, 0.2, -0.2, 0.1, 0), 0.02), T2: good.T2, T3: good.T3 }), 'FAIL', 'negative in 2007-19');
  assert.equal(verdictOf({ T1: mk(S(0.1, 0.05, 0, 0, 0), 0.4), T2: good.T2, T3: good.T3 }), 'FAIL', 't under 2 in 2020-26');
});

test('the study on a synthetic series: three tests, three streams each, WITH and AGAINST never share a candidate', () => {
  const F = walk(40000, 7, Date.UTC(2021, 0, 4) / 1000), S = study(F);
  assert.deepEqual(Object.keys(S.tests), ['T1', 'T2', 'T3']);
  for (const k of Object.keys(S.tests)) { const X = S.tests[k].streams; assert.equal(X.WITH.candidates + X.AGAINST.candidates <= X.ALL.candidates, true); assert.ok(X.ALL.b.n >= X.WITH.b.n); assert.equal(Object.keys(S.tests[k].conditions).length, 6); }
  assert.ok(S.tests.T3.candidates > S.tests.T1.candidates); assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(S.verdict));
  const sm = summarize(S.books.T1.ALL.trades); assert.equal(sm.a.n, 0); assert.equal(sm.b.n, S.books.T1.ALL.trades.length);
  for (const o of S.books.T1.ALL.trades) assert.ok(o.hour >= 12 && o.hour < 16);
});

test('the committed result: computed with the pre-registered numbers, the verdict follows the bar, and the report says the same', () => {
  assert.equal(J.topic, 'msnr-entry'); assert.equal(J.variantsTried, 3); assert.deepEqual(Object.keys(J.tests), ['T1', 'T2', 'T3']);
  for (const k of ['BODY', 'ARM', 'PAD', 'MIN_R0', 'HOLD', 'COST', 'K', 'ZONE_AGE', 'WAIT']) assert.equal(J.params[k], P[k], k);
  const tests = JSON.parse(JSON.stringify(J.tests));
  for (const k of Object.keys(tests)) { assert.deepEqual(conditions(tests[k].streams, tests[k].pHolm), J.tests[k].conditions, k); assert.equal(tests[k].p, normP(tests[k].streams.WITH.b.t)); }
  assert.deepEqual(holm(Object.keys(tests).map((k) => [k, tests[k].p])), Object.fromEntries(Object.keys(tests).map((k) => [k, tests[k].pHolm])));
  const v = verdictOf(tests); assert.ok(J.verdict.startsWith(v + ':'), J.verdict);
  const line = RES.split('\n').find((l) => /^\*\*Verdict/.test(l)); assert.ok(line && line.startsWith(`**Verdict: ${v}`), line);
  assert.ok(RES.indexOf(line) < 200, 'the verdict is the first sentence of the report');
  // every test x window x stream row of the report carries the result file's n, net R, t and win rate
  const sg = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(3)}`, tt = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`;
  for (const k of Object.keys(J.tests)) for (const s of Object.keys(STREAMS)) for (const [w, label] of [['a', '2007-19'], ['b', '2020-26']]) {
    const X = J.tests[k].streams[s][w], row = RES.split('\n').find((l) => l.startsWith(`| ${k} | ${label} | ${s} |`)); assert.ok(row, `${k} ${label} ${s}`);
    for (const cell of [X.n.toLocaleString('en-US'), sg(X.exp), tt(X.t), `${(X.wr * 100).toFixed(1)}%`]) assert.ok(row.includes(`| ${cell} |`), `${k} ${label} ${s}: ${cell} in ${row}`); }
  // the lab's candidates and equity line
  assert.equal(J.candidates.length, 3); for (const c of J.candidates) { assert.ok(c.is.n > 0 && c.oos.n > 0 && typeof c.oos.exp === 'number' && typeof c.oos.t === 'number'); assert.ok(['PASS', 'FAIL'].includes(c.verdict)); }
  assert.equal(J.trades.length, J.tests.T1.streams.WITH.a.n + J.tests.T1.streams.WITH.b.n); assert.ok(J.trades.every((t) => typeof t.R === 'number' && /^\d{4}-\d\d-\d\d$/.test(t.d)));
  near(J.trades.reduce((a, t) => a + t.R, 0), J.tests.T1.streams.WITH.a.R + J.tests.T1.streams.WITH.b.R, 0.02);
  assert.ok(!/\bedge\b/i.test(line) || /not an edge|no edge/i.test(line), 'never called an edge');
});
