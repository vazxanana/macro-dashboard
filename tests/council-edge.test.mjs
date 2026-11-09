// node --test tests/council-edge.test.mjs — the council-edge study's analysis code (research/edge/council-edge): the statistics,
// the breakdown of the paper records, the harness patcher and the three pre-registered scorers. Pure, offline, fixtures inline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarize, wilson, maxDrawdown, pairedDiff, groupBy, sessionOf, holdBucket, tq } from '../research/edge/council-edge/stats.mjs';
import { netR, collectRows, breakdown, exitOf, toMarkdown } from '../research/edge/council-edge/breakdown.mjs';
import { netOf, costR, h1, h2, h3, sessionGate, fromGold, fromReplica, fromSolo, forwardCost, COST, T0, SPLIT, WF } from '../research/edge/council-edge/analyze.mjs';
import { PATCHES, patchSource } from '../research/edge/council-edge/run.mjs';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const T = (s) => Date.parse(s) / 1000;

test('summarize: mean, t, interval, win rate with Wilson interval, drawdown, profit factor', () => {
  const s = summarize([1, -1, 2, -1, -1]);
  assert.equal(s.n, 5); near(s.mean, 0); assert.equal(s.wins, 2); near(s.win, 0.4); near(s.total, 0); near(s.maxDD, -2); near(s.pf, 1);
  assert.ok(s.lo < 0 && s.hi > 0); assert.equal(s.neg, false);
  const [lo, hi] = wilson(2, 5); near(lo, 0.1176); near(hi, 0.7693);
  const n = summarize([-1, -1, -1.2, -0.9, -1.1, -1]); assert.equal(n.neg, true, 'all losers: interval below zero');
  assert.equal(summarize([-1, -1, -1, -1]).neg, false, 'n < 5 is never flagged');
  assert.equal(summarize([]).n, 0); assert.equal(summarize([NaN, 1]).n, 1);
  near(tq(1), 12.706); near(tq(30), 2.042); assert.ok(tq(1000) > 1.96 && tq(1000) < 1.97);
});
test('maxDrawdown, pairedDiff, groupBy, sessions, hold buckets', () => {
  near(maxDrawdown([2, -1, -2, 3, -4]), -4); near(maxDrawdown([1, 2]), 0);
  near(pairedDiff([1, 2, 3], [0, 2, 1]).mean, 1); assert.throws(() => pairedDiff([1], [1, 2]));
  assert.deepEqual([...groupBy([{ a: 1 }, { a: 2 }, { a: 1 }, { a: null }], (r) => r.a).keys()], [1, 2]);
  assert.equal(sessionOf(T('2026-11-02T03:00:00Z')), 'asia'); assert.equal(sessionOf(T('2026-11-02T07:00:00Z')), 'london');
  assert.equal(sessionOf(T('2026-11-02T12:30:00Z')), 'overlap'); assert.equal(sessionOf(T('2026-11-02T16:00:00Z')), 'newyork');
  assert.equal(sessionOf(T('2026-11-02T21:00:00Z')), 'late');
  assert.equal(holdBucket(1800), '< 1 h'); assert.equal(holdBucket(5 * 3600), '4-12 h'); assert.equal(holdBucket(72 * 3600), '>= 48 h'); assert.equal(holdBucket(-1), null);
});

test('breakdown: net R from Rnet, costR or the fills model; books; negative flags', () => {
  assert.equal(netR({ R: 1, Rnet: 0.9 }), 0.9);
  near(netR({ R: 2, costR: 0.1, rawR: 1, size: 2 }), 1.8);
  near(netR({ market: 'xau', R: -1, entry: 4000, stop: 3990, entryMode: 'market', status: 'loss' }), -1 - 0.6 / 10);   // 0.30 + 2 x 0.15 slip
  near(netR({ market: 'nq', R: 1, entry: 20000, stop: 19990 }), 1 - 1.37 / 10);
  assert.equal(exitOf({ status: 'win', rr: 2, R: 2 }), 'target'); assert.equal(exitOf({ exitKind: 'time' }), 'time'); assert.equal(exitOf({ status: 'loss', R: -1 }), 'stop');
  const base = { market: 'xau', entry: 4000, stop: 3990, side: 'buy' };
  const trades = [];
  for (let i = 0; i < 8; i++) trades.push({ ...base, id: 'l' + i, k: 'scalp', status: 'loss', R: -1, Rnet: -1.1, opened: T('2026-11-02T03:00:00Z') + i * 60, closed: T('2026-11-02T03:30:00Z') + i * 60 });
  trades.push({ ...base, id: 's1', k: 'scalp', shadow: true, status: 'win', R: 2, Rnet: 1.9, opened: T('2026-11-02T08:00:00Z'), closed: T('2026-11-02T12:00:00Z') });
  trades.push({ ...base, id: 'd', k: 'm30m1', status: 'duplicate', R: -1 }, { ...base, id: 'o', k: 'scalp', status: 'open', R: null });
  const rows = collectRows({ trades, research: [{ ...base, id: 'r', k: 'replica', status: 'win', R: 2, opened: T('2026-11-03T01:00:00Z'), closed: T('2026-11-03T05:00:00Z') }] });
  assert.equal(rows.length, 10, 'duplicates and open trades are not counted');
  const bd = breakdown(rows);
  assert.deepEqual(Object.keys(bd.books).sort(), ['live', 'research paper', 'shadow']);
  assert.equal(bd.books.live.all.n, 8); assert.equal(bd.books.live.all.neg, true);
  assert.ok(bd.negative.some((x) => x.book === 'live' && x.dim === 'session' && x.key === 'asia'));
  assert.equal(bd.books['research paper'].by.family[0].key, 'main system');
  assert.ok(toMarkdown(bd).includes('**NEGATIVE**'));
});

test('run.mjs: every patch matches the harness it targets exactly once; imports become absolute', () => {
  for (const [name, P] of Object.entries(PATCHES)) {
    const src = fs.readFileSync(new URL(`../research/edge/${P.file}`, import.meta.url), 'utf8');
    const live = patchSource(src, P.file, []), alt = patchSource(src, P.file, P.holdOpen);
    assert.ok(!/from '\.\.?\//.test(live), `${name}: no relative import left`);
    assert.equal(alt.split('\n').length - live.split('\n').length, 1, `${name}: the variant adds one line`);
    assert.ok(alt.includes('b.open'), name);
  }
  assert.throws(() => patchSource('x', 'replica-oos/replay.mjs', [['missing', 'y']]), /found 0 times/);
});

// a position helper: one unit unless legs are given
const P = (sys, T, r0, R, extra = {}) => ({ sys, id: `${sys}-${T}`, T, r0, legs: [{ R, size: 1, r0 }], timeExit: false, ...extra });
test('netOf / costR: each unit pays the round trip in its own R', () => {
  const p = { r0: 10, legs: [{ R: 2, size: 1, r0: 10 }, { R: 1, size: 1.5, r0: 15 }] };
  near(netOf(p, 0.6), (2 - 0.06) + 1.5 * (1 - 0.04)); near(costR(p), 0.06);
  assert.equal(costR({ r0: 0 }), Infinity);
});
test('h1: paired difference only on positions both runs took, pass needs t >= 2 and both halves', () => {
  const live = [], alt = [];
  for (let i = 0; i < 40; i++) { const t = T0 + i * 86400 * 60, sys = i % 2 ? 'gtl' : 'replica';
    live.push(P(sys, t, 10, -0.5, { timeExit: true })); alt.push(P(sys, t, 10, -0.5 + 0.1 + (i % 3) * 0.01, { timeExit: true })); }
  alt.push(P('geg', T0 + 5, 10, 1));
  const r = h1(live, alt, COST.x1);
  assert.equal(r.n, 40); assert.equal(r.onlyAlt, 1); assert.ok(r.all.mean > 0.1 && r.all.t > 2); assert.equal(r.pass, true);
  assert.ok(r.A.n > 0 && r.B.n > 0);
  const flat = h1(live, live, COST.x1); assert.equal(flat.pass, false); assert.equal(flat.all.mean, 0);
});
test('h2: the gate removes positions whose cost is over 0.10R; the pass needs the removed to lose', () => {
  const ps = [];
  for (let i = 0; i < 60; i++) { const t = T0 + i * 86400 * 40; ps.push(P(['replica', 'gtl', 'geg'][i % 3], t, i % 2 ? 4 : 20, i % 2 ? -0.6 - (i % 5) * 0.05 : 0.3)); }
  const r = h2(ps, COST.x1);
  assert.equal(r.removed.n, 30, 'stops under $6 cost more than 0.10R');
  assert.ok(r.removed.mean < 0 && r.removed.t <= -2); assert.ok(r.A.kept > r.A.all && r.B.kept > r.B.all);
  assert.equal(r.pass, true);
  const none = h2(ps.filter((p) => p.r0 > 6), COST.x1); assert.equal(none.removed.n, 0); assert.equal(none.pass, false);
});
test('h3: the session gate only uses positions closed before the quarter starts (no look-ahead)', () => {
  const ps = [];
  // 2020: 20 asia losers (history), 2021-Q1: asia losers again and london winners
  for (let i = 0; i < 20; i++) ps.push(P('replica', T('2020-03-01T02:00:00Z') + i * 86400 * 10, 10, -1 - (i % 4) * 0.1));
  for (let i = 0; i < 10; i++) ps.push(P('replica', T('2021-01-10T02:00:00Z') + i * 86400 * 5, 10, -1));
  for (let i = 0; i < 10; i++) ps.push(P('replica', T('2021-01-10T09:00:00Z') + i * 86400 * 5, 10, 1));
  const closedAt = (p) => p.T + 3600;
  const g = sessionGate(ps, closedAt);
  assert.equal(g.drop.size, 10); assert.deepEqual(Object.values(g.off), [['asia']]);
  // the same 2021 losers with history that closes only after the quarter started: nothing is switched off
  const late = sessionGate(ps, (p) => p.T < WF.from ? WF.from + 1 : p.T + 3600); assert.equal(late.drop.size, 0);
  const r = h3(ps, closedAt); assert.equal(r.dropped.n, 10); assert.equal(r.n, 20);
});
test('harness readers: replica positions, solo filter and gold legs with adds', () => {
  const rj = { positions: [{ id: 'rp-1-s', T: T0 + 10, legs: [{ R: -1, size: 0.5, r0: 8, exitKind: 'stop' }, { R: 2, size: 0.75, r0: 12, exitKind: 'time', add: true }] }],
    solo: [{ T: T0, volOk: true, d1w: true, news: false, legs: [{ R: 1, size: 1, r0: 5 }] }, { T: T0, volOk: false, d1w: true, legs: [{ R: 1, size: 1, r0: 5 }] }] };
  const r = fromReplica(rj); assert.equal(r[0].r0, 8); assert.equal(r[0].timeExit, true); assert.equal(r[0].legs.length, 2);
  assert.equal(fromSolo(rj).length, 1);
  const g = fromGold([{ id: 'a', k: 'gtl', filled: T0, closed: T0 + 9, status: 'closed', R: 1, r0: 5, exit: '96 h' }, { id: 'a-add', addOf: 'a', k: 'gtl', filled: T0 + 5, closed: T0 + 9, status: 'closed', R: 0.5, r0: 3 },
    { id: 'b', k: 'geg', status: 'expired', R: 0 }]);
  assert.equal(g.length, 1); assert.equal(g[0].legs.length, 2); assert.equal(g[0].timeExit, true);
  const f = forwardCost([{ status: 'loss', R: -1, Rnet: -1.5, costR: 0.5 }, { status: 'win', R: 2, Rnet: 1.95, costR: 0.05 }, { status: 'open' }]);
  assert.equal(f.low.n, 1); assert.equal(f.high.n, 1); near(f.high.mean, -1.5);
  assert.ok(SPLIT > T0);
});
