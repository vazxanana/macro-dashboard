// node --test tests/book.test.mjs — the book-weights paper comparison (council/book.mjs): weights sum to one, the gold cap binds
// and renormalises, the proposed book is built from byte-identical trades (none added, removed or changed), the daily series,
// the coach.json record the page reads and the Sunday digest line. Pure, no network, fixtures inline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BK, IDEAS, LABEL, weights, multipliers, collect, daily, drawdown, correlation, sharpe, buildBook } from '../council/book.mjs';
import { bookLine, buildDigest } from '../council/digest.mjs';

const T = (s) => Date.parse(s) / 1000;
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('weights: equal risk per distinct idea, summing to one', () => {
  const ideas = [{ id: 'a', ks: ['a'] }, { id: 'b', ks: ['b', 'b2'] }, { id: 'c', ks: ['c'] }];
  const W = weights(ideas);
  near(sum(W.w), 1); near(W.w.a, 1 / 3); near(W.w.b, 1 / 3, 1e-9);   // two streams, one idea, one share
  assert.equal(W.capped, false); assert.equal(W.goldShare, 0);
  assert.deepEqual(weights([]), { w: {}, capped: false, goldShare: 0, goldIdeas: [], n: 0 });
});
test('weights: the gold cap binds only above it, then the family shares the cap and the rest is renormalised', () => {
  const below = weights([{ id: 'g1', gold: true }, { id: 'a' }, { id: 'b' }], 0.4);   // 1 of 3 = 33% < 40%
  assert.equal(below.capped, false); near(below.w.g1, 1 / 3); near(sum(below.w), 1);
  const above = weights([{ id: 'g1', gold: true }, { id: 'g2', gold: true }, { id: 'g3', gold: true }, { id: 'a' }, { id: 'b' }], 0.4);   // 3 of 5 = 60%
  assert.equal(above.capped, true); near(above.goldShare, 0.4); near(above.w.g1, 0.4 / 3); near(above.w.a, 0.3); near(sum(above.w), 1);
  assert.deepEqual(above.goldIdeas, ['g1', 'g2', 'g3']);
  const all = weights([{ id: 'g1', gold: true }, { id: 'g2', gold: true }], 0.4);   // nothing to move the risk to
  assert.equal(all.capped, false); near(sum(all.w), 1); assert.match(all.note, /cannot apply/);
});
test('the live registry: 8 ideas, 9 streams, the gold family capped at 40%, ICT counted once', () => {
  const X = multipliers();
  assert.equal(X.N, 8); assert.equal(X.M, 9); assert.equal(X.capped, true); near(X.goldShare, 0.4); near(sum(X.w), 1);
  near(sum(X.m), X.M);                                     // the proposed book risks the live book's total
  assert.equal(IDEAS.filter((i) => i.id === 'ict-a').length, 1);
  assert.deepEqual(IDEAS.find((i) => i.id === 'gtrend').ks, ['gtrend', 'gtrend5']);   // one bet
  assert.ok(X.m['ict-a'] > 1 && X.m.gtl < 1, 'ICT gets more than one unit, a gold system less');
  assert.ok(BK.goldCap === 0.4 && BK.sharpeClean === 0.3);
});

// ─── fixtures: a live book with every kind of record ───
const D0 = () => ({
  trades: [
    { id: 't1', k: 'replica', market: 'xau', status: 'win', R: 2, Rnet: 1.9, closed: T('2026-11-04T06:00:00Z') },
    { id: 't2', k: 'gtrend', market: 'xau', status: 'loss', R: -1, Rnet: -1.1, closed: T('2026-11-05T10:00:00Z') },
    { id: 't3', k: 'gtrend5', market: 'xau', status: 'loss', R: -1, Rnet: -1.1, closed: T('2026-11-05T10:00:00Z') },
    { id: 't4', k: 'scalp', market: 'eth', status: 'win', R: 0.5, Rnet: 0.4, closed: T('2026-11-04T12:00:00Z') },        // retired engine: 'other'
    { id: 't5', k: 'geg', market: 'xau', status: 'win', R: 3, Rnet: 2.9, closed: T('2026-11-03T12:00:00Z') },             // before the window
    { id: 't6', k: 'replica', market: 'xau', status: 'win', R: 1, Rnet: 0.9, closed: T('2026-11-06T12:00:00Z'), shadow: true },   // shadow: never
    { id: 't7', k: 'gtl', market: 'xau', status: 'open', R: null, opened: T('2026-11-06T12:00:00Z') },
  ],
  research: [
    { id: 'n1', k: 'nq-open', session: 'nyflip', status: 'loss', R: -1, closed: T('2026-11-04T15:00:00Z') },
    { id: 'n2', k: 'nq-open', session: 'nyflip-x', status: 'win', R: 2, closed: T('2026-11-04T15:00:00Z') },   // variant the live rule skips
    { id: 'n3', k: 'replica', status: 'win', R: 2, closed: T('2026-11-04T15:00:00Z') },                        // research replica: not the live book
  ],
  ictTrades: [
    { id: 'i1', market: 'nq', aset: true, status: 'win', R: 2, r0: 100, size: 1, closed: T('2026-11-06T15:00:00Z') },
    { id: 'i2', market: 'es', aset: false, status: 'win', R: 2, r0: 10, closed: T('2026-11-06T15:00:00Z') },   // not an A-setup
    { id: 'i3', market: 'gc', aset: true, status: 'open', R: null, r0: 10, opened: T('2026-11-07T15:00:00Z') },
  ],
  ictReplay: { trades: [
    { id: 'i1-r', market: 'nq', aset: true, status: 'win', R: 2, r0: 100, closed: T('2026-11-06T15:00:00Z') },   // replay copy of the forward i1
    { id: 'r1', market: 'ym', aset: true, status: 'loss', R: -1, r0: 100, closed: T('2026-11-05T15:00:00Z') },
    { id: 'r2', market: 'ym', aset: true, status: 'loss', R: -1, r0: 100, closed: T('2026-11-05T16:00:00Z'), valid: false },
    { id: 'r3', market: 'ym', aset: true, status: 'loss', R: -1, r0: 100, closed: T('2026-11-05T16:00:00Z'), shadow: true, variant: 'nofri' },
  ] },
});

test('collect: the live book once, after costs, in the window; shadows, research replicas, skipped variants, replay copies out', () => {
  const D = D0(), before = JSON.stringify(D), P = collect(D);
  assert.equal(JSON.stringify(D), before, 'the input records are byte-identical afterwards');
  assert.deepEqual(P.map((p) => p.id), ['t1', 't4', 'n1', 't2', 't3', 'r1', 'i1'], 'in close order');
  assert.deepEqual(P.map((p) => p.idea), ['replica', 'other', 'nq-open', 'gtrend', 'gtrend', 'ict-a', 'ict-a']);
  near(P[0].R, 1.9); assert.equal(P[0].raw, 2);                       // Rnet, raw R kept
  assert.equal(P.find((p) => p.id === 'r1').src, 'replay'); assert.equal(P.find((p) => p.id === 'i1').src, 'live');
  near(P.find((p) => p.id === 'i1').R, 2 - 1.37 / 100);              // the CME micro round trip in R of the initial risk
  assert.deepEqual(collect(D, { from: '2026-11-06' }).map((p) => p.id), ['i1']);
});
test('daily: both books from the same trades; the proposed one is the live R times the idea multiplier, nothing else', () => {
  const D = D0(), P = collect(D), X = multipliers(), S = daily(P, X.m);
  assert.deepEqual(S.days.map((d) => d.d), ['2026-11-04', '2026-11-05', '2026-11-06']);
  near(S.days[0].live, 1.9 + 0.4 - 1, 1e-6); near(S.days[0].prop, 1.9 * X.m.replica + 0.4 * 1 - 1 * X.m['nq-open'], 1e-6);   // 'other' keeps its live size
  near(S.live.R, P.reduce((a, p) => a + p.R, 0), 0.011); near(S.proposed.R, P.reduce((a, p) => a + p.R * (X.m[p.idea] ?? 1), 0), 0.011);   // totals rounded to 0.01R
  near(S.days.at(-1).cumLive, S.live.R, 0.006); near(S.days.at(-1).cumProp, S.proposed.R, 0.006);   // series at 0.001R, totals at 0.01R
  assert.ok(Number.isFinite(S.corr) && S.corr <= 1 && S.corr >= -1); assert.equal(S.live.sharpe, null, 'three days: no Sharpe yet');
  // the same trades sized at one unit everywhere give the live book back exactly
  const one = daily(P, Object.fromEntries(IDEAS.map((i) => [i.id, 1])));
  assert.deepEqual(one.days.map((d) => d.prop), one.days.map((d) => d.live));
});
test('statistics: drawdown from the running peak, correlation, Sharpe only with enough days', () => {
  assert.deepEqual(drawdown([1, 2, -1, -2, 1]), { cur: 2, max: 3 });
  near(correlation([1, 2, 3, 4], [2, 4, 6, 8]), 1); near(correlation([1, 2, 3, 4], [-1, -2, -3, -4]), -1);
  assert.equal(correlation([1, 1, 1], [1, 2, 3]), null); assert.equal(correlation([1, 2], [1, 2]), null);
  assert.equal(sharpe(Array(BK.minDaysSharpe - 1).fill(0).map((_, i) => (i % 2 ? 1 : -0.5))), null);
  assert.ok(sharpe(Array(BK.minDaysSharpe).fill(0).map((_, i) => (i % 2 ? 1 : -0.5))) > 0);
});
test('buildBook: the coach.json record the page and the digest read, clearly a paper comparison', () => {
  const b = buildBook(D0(), { now: T('2026-11-07T18:00:00Z') });
  assert.equal(b.label, LABEL); assert.match(b.rule, /no live change|Nothing here changes/i);
  assert.equal(b.at, '2026-11-07T18:00:00.000Z'); assert.equal(b.from, '2026-11-04'); assert.equal(b.to, '2026-11-06');
  assert.deepEqual(b.budget, { M: 9, N: 8, goldCap: 0.4, capped: true, goldShare: 0.4, goldIdeas: ['mosha-bo', 'gtrend', 'gtl', 'geg', 'gmp'] });
  assert.equal(b.sizing.sharpe, 0.3); assert.deepEqual(b.sizing.ddRange, [81, 189]); assert.match(b.sizing.note, /clean-half/);
  assert.equal(b.nTrades, 7); assert.equal(b.nDays, 3); assert.equal(b.ictReplay, 1); assert.equal(b.ictForward, 1);
  for (const k of ['R', 'dd', 'ddCur', 'sharpe', 'worstDay', 'bestDay']) { assert.ok(k in b.live); assert.ok(k in b.proposed); }
  near(b.diff, b.proposed.R - b.live.R, 0.011);
  const rows = Object.fromEntries(b.byIdea.map((r) => [r.id, r]));
  assert.equal(b.byIdea.length, IDEAS.length + 1, 'every idea, traded or not, plus the other bucket');
  assert.equal(rows.gtrend.n, 2); assert.equal(rows.gtrend.streams, 2); near(rows.gtrend.live, -2.2, 0.011); near(rows.gtrend.prop, -2.2 * 0.72, 0.011);
  assert.equal(rows.gtl.n, 0); assert.equal(rows.gtl.live, 0); assert.equal(rows.gtl.gold, true); assert.equal(rows.replica.gold, false);
  assert.equal(rows.other.m, 1); assert.equal(rows.other.live, rows.other.prop); assert.equal(rows.other.n, 1);
  assert.deepEqual(b.days.map((d) => d.d), ['2026-11-04', '2026-11-05', '2026-11-06']);
  for (const d of b.days) for (const k of ['n', 'live', 'prop', 'cumLive', 'cumProp']) assert.ok(Number.isFinite(d[k]), `${d.d}.${k}`);
  const empty = buildBook({}, { now: T('2026-11-07T18:00:00Z') });
  assert.equal(empty.nTrades, 0); assert.equal(empty.to, null); assert.equal(empty.live.R, 0); assert.equal(empty.corr, null);
});
test('digest: one book line on the Sunday preview only, labelled as a paper comparison', () => {
  const b = buildBook(D0(), { now: T('2026-11-07T18:00:00Z') });
  const line = bookLine(b);
  assert.match(line, /^Book weights \(paper comparison, no live change\): live [+−]\d+\.\d\dR vs proposed [+−]\d+\.\d\dR since 4 Nov \(7 trades\) · max DD \d+\.\d \/ \d+\.\dR( · corr -?\d\.\d\d)?\.$/);
  assert.equal(bookLine(null), null); assert.equal(bookLine({ nTrades: 0 }), null);
  const D = { coach: { book: b } };
  const p = buildDigest(D, { now: T('2026-11-08T21:20:00Z'), kind: 'preview', prev: {}, sbRows: null });
  assert.ok(p.lines.includes(line)); assert.equal(p.lines.at(-2), line, 'just before the time stamp');
  const d = buildDigest(D, { now: T('2026-11-06T21:20:00Z'), kind: 'daily', prev: {}, sbRows: null });
  assert.ok(!d.msg.includes('Book weights'));
});
