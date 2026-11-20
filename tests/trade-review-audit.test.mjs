// The trade review, audited as a quant reviewer would (council/trade-review.mjs, 20 Nov 2026). Offline, hand-made desks: every
// test here failed on the code before the audit. Proposals only: nothing under test changes a rule, a size, a stop or config.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../council/trade-review.mjs';

const NOW = Date.UTC(2026, 10, 20, 12) / 1000, DAY = 86400, D0 = Date.UTC(2026, 10, 2) / 1000;
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let seq = 0;
// one closed record; `e` = fill time, held one hour unless told otherwise
const tr = (o = {}) => { const e = o.e ?? D0, R = o.R ?? -1; seq++;
  return { id: o.id || `${o.market || 'xau'}-${o.k || 'scalp'}-${seq}`, market: 'xau', label: 'XAU/USD', k: 'scalp', name: 'Scalp', side: 'buy', entry: 4000, stop: 3990, t1: 4020, rr: 2,
    opened: e, filled: e, closed: e + (o.held ?? 3600), status: R > 0 ? 'win' : R < 0 ? 'loss' : 'be', R, costR: 0.05, Rnet: +(R - 0.05).toFixed(3), mfe: o.mfe ?? (R > 0 ? R : 0.2), shadow: true, blockedBy: ['focus'], ...o, e: undefined, held: undefined }; };
const build = (trades, research = [], config = {}, extra = {}) => T.build({ trades, research, config, coach: {}, mirrors: [], analyst: null, losses: null, ledger: null, ...extra }, { now: NOW });
const sys = (J, key) => J.systems.find((s) => s.key === key);

test('audit: a record kept in trades.json AND research.json is one trade (it was counted live and again as research)', () => {
  const live = tr({ id: 'xau-replica-1', k: 'replica', name: 'Gold replica', shadow: false, blockedBy: [], R: 2 });
  const copy = { ...live, costR: undefined, Rnet: undefined }, other = tr({ id: 'eurusd-replica-2', market: 'eurusd', label: 'EUR/USD', k: 'replica', name: 'EUR/USD replica', R: -1, shadow: undefined });
  const J = build([live], [copy, other]);
  assert.equal(sys(J, 'replica|live').windows.all.n, 1);
  assert.equal(sys(J, 'replica|research').windows.all.n, 1, 'only the record that is not in trades.json');
  assert.equal(J.systems.reduce((s, x) => s + x.windows.all.n, 0), 2, 'two trades in all, not three');
});

test('audit: a stream that spans several markets is not named after the market of its last record', () => {
  const R = [];
  for (let i = 0; i < 6; i++) R.push(tr({ id: `r${i}`, market: i % 2 ? 'usdchf' : 'xau', label: i % 2 ? 'USD/CHF' : 'XAU/USD', k: 'replica', name: i % 2 ? 'USD/CHF replica' : 'XAU/USD replica', e: D0 + i * 3600, shadow: undefined }));
  const s = sys(build([], R), 'replica|research');
  assert.equal(s.name, 'Replica'); assert.deepEqual(s.markets, ['usdchf', 'xau']);
  assert.doesNotMatch(s.review.head, /USD\/CHF/);
  // a one-market stream keeps its own name, and an engine setup its setup name
  assert.equal(sys(build([], R.filter((x) => x.market === 'xau')), 'replica|research').name, 'XAU/USD replica');
});

test('audit: the +1R counterfactual counts a trade closed at +1R or more as having reached +1R (the MFE leaves out the exit candle)', () => {
  // a win that ran to its 2R target inside one candle: the recorded MFE (candles before the exit) is 0.6
  const fast = { R: 2, mfe: 0.6 }, loser = { R: -1, mfe: 0.3 }, gaveBack = { R: -1, mfe: 1.4 };
  assert.equal(T.reached1R(fast), true); assert.equal(T.lockDiff(fast), -1, 'a +1R close would have cost this trade 1R');
  assert.equal(T.lockDiff(loser), 0); assert.equal(T.lockDiff(gaveBack), 2);
  const rows = [fast, fast, loser, loser].map((x, i) => ({ ...x, net: x.R, exit: 'x', day: i, dayC: i }));
  const w = T.whereR(rows);
  assert.equal(w.reached1R.n, 2); assert.equal(w.lock1R.mean, -0.5, 'before the audit this read 0: the two wins were left unchanged');
  assert.equal(w.giveback.mean, 0, 'best open R is never under the R closed');
});

test('audit: Holm runs over EVERY comparison made, not only over the ones already flagged', () => {
  // one real-looking split (overlap wins, asia loses) among many streams whose splits are noise
  const trades = [];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const k of ['scalp', 'intraday', 'rscalp', 'rintra', 'swing', 'position', 'rswing', 'm30m1']) for (let i = 0; i < 60; i++) {
    const e = D0 + Math.floor(i / 4) * DAY + [2, 9, 13, 18][i % 4] * 3600;
    const sig = k === 'scalp' && i % 4 === 0;   // scalp's Asia fills lose a little more often
    trades.push(tr({ k, name: k, e, side: i % 2 ? 'buy' : 'sell', market: i % 3 ? 'xau' : 'eurusd', R: (sig ? rnd() < 0.12 : rnd() < 0.4) ? 1.5 : -1 }));
  }
  const J = build(trades), n = J.thresholds.splitTests;
  const judged = J.systems.reduce((s, x) => s + ['session', 'hours', 'side', 'market'].reduce((q, f) => q + (x.splits[f].length === 2 ? (x.splits[f][0].vsRest ? 1 : 0) : x.splits[f].filter((b) => b.vsRest).length), 0) + (x.whereR.lock1R.n >= T.TR.STREAM_N ? 1 : 0), 0);
  assert.equal(n, judged, 'the count of tests is the count Holm ran over; buys against sells is one test, not two');
  assert.ok(n > 40, `tests ${n}`);
  const fl = J.flags.filter((f) => f.split && f.p != null);
  assert.ok(fl.length >= 1 && fl.length < n / 4, `flags ${fl.length} of ${n} tests`);
  for (const f of fl) {
    assert.equal(typeof f.holm, 'boolean');
    // survives only under the bar of ALL the tests: p <= 0.05 / n is necessary for the smallest p, so a p over 0.05 / (n - flags) can never pass
    if (f.holm) assert.ok(f.p <= 0.05 / (n - fl.length) + 0.0005, `${f.id} p ${f.p} passed against ${n} tests`);
  }
  const weak = fl.filter((f) => f.p > 0.004 && f.p < 0.05);
  assert.ok(weak.length >= 1, 'the desk has a flag with 0.004 < p < 0.05');
  for (const f of weak) assert.equal(f.holm, false, `${f.id} (p ${f.p}) survived Holm over the flagged tests only before the audit`);
});

test('audit: by-day t beside the per-trade t; same-day twins do not make a pattern strong', () => {
  // 40 losing trades, all filled on two days: a huge per-trade t, two observations of two days
  const twoDays = Array.from({ length: 40 }, (_, i) => tr({ k: 'm30m1', name: 'M30', e: D0 + (i % 2) * DAY + i * 60, R: i % 5 ? -1 : -0.8 }));
  const a = sys(build(twoDays), 'm30m1|shadow');
  assert.ok(a.windows.all.net.t < -10); assert.equal(a.windows.all.days, 2);
  assert.deepEqual({ days: a.windows.all.net.byDay.days, t: a.windows.all.net.byDay.t }, { days: 2, t: null }, 'under 5 days: no by-day t at all');
  const J = build(twoDays), f = J.flags.find((x) => x.kind === 'losing');
  assert.equal(f.robust, false); assert.match(f.text, /By day: too few days to judge \(2\)/);
  assert.equal(J.proposals.find((p) => p.flag === f.id).strong, false, '40 trades, t under −10, and not strong');
  // the same 40 losses over 20 days: the by-day t backs it, and the proposal is strong
  const spread = Array.from({ length: 40 }, (_, i) => tr({ k: 'm30m1', name: 'M30', e: D0 + Math.floor(i / 2) * DAY + (i % 2) * 7200, R: i % 5 ? -1 : -0.8 + (i % 3) * 0.3 }));
  const J2 = build(spread), f2 = J2.flags.find((x) => x.kind === 'losing'), p2 = J2.proposals.find((p) => p.flag === f2.id);
  assert.equal(f2.byDay.days, 20); assert.ok(f2.byDay.t <= -2); assert.equal(f2.robust, true); assert.equal(p2.strong, true);
  assert.deepEqual(p2.evidence.byDay, f2.byDay); assert.equal(p2.evidence.robust, true);
  // the cluster helpers themselves
  assert.equal(T.clusterT([1, 1, 1, 1, 1, 1], [1, 1, 1, 2, 2, 2]).t, null);
  const indep = T.clusterT([1, -1, 2, 0.5, 1.5, 1, 0.2, 1.1], [1, 2, 3, 4, 5, 6, 7, 8]), twins = T.clusterT([1, 1, -1, -1, 2, 2, 0.5, 0.5, 1.5, 1.5, 1, 1, 0.2, 0.2, 1.1, 1.1], [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8]);
  assert.equal(indep.t, twins.t, 'doubling every trade inside its day adds no information by day');
  assert.equal(T.backedByDay(-3, { days: 9, t: -2.4 }), true); assert.equal(T.backedByDay(-3, { days: 9, t: 2.4 }), false); assert.equal(T.backedByDay(-3, { days: 3, t: null }), false);
});

test('audit: a side split the markets\' own move explains carries a regime note and is not strong', () => {
  // two markets fall over the record: buys lose, sells win, whatever the rule
  const trades = [];
  for (const [m, label, p0] of [['xau', 'XAU/USD', 4000], ['eurusd', 'EUR/USD', 1.2]]) for (let i = 0; i < 60; i++) {
    const buy = i % 2 === 0, e = D0 + Math.floor(i / 4) * DAY + (i % 4) * 5400;
    trades.push(tr({ k: 'm30m1', name: 'M30', market: m, label, e, side: buy ? 'buy' : 'sell', entry: p0 * (1 - i * 0.002), R: buy ? (i % 10 === 0 ? 1.5 : -1) : (i % 5 === 1 ? -1 : 1.5) }));
  }
  const J = build(trades), s = sys(J, 'm30m1|shadow'), f = J.flags.find((x) => x.kind === 'weak-side'), p = J.proposals.find((x) => x.flag === f.id);
  assert.equal(s.regime.markets, 2); assert.equal(s.regime.down, 2); assert.deepEqual(s.regime.betterSide, { markets: 2, withMove: 2 });
  assert.ok(s.regime.with.mean > 0 && s.regime.against.mean < 0 && s.regime.t >= 2);
  assert.equal(f.value, 'buy'); assert.equal(f.regime.confounded, true); assert.equal(f.regime.share, 1);
  assert.ok(f.n >= T.TR.STRONG_N && f.holm === true && f.robust === true, 'everything else says strong');
  assert.equal(p.strong, false, 'and the regime note says it is the market, not the rule');
  assert.match(p.why, /Regime note: 2 of 2 markets fell/); assert.match(p.why, /known only afterwards/); assert.equal(p.prereg, undefined);
  // the same results with prices that go nowhere in particular (half the buys with the move): no regime note
  const flat = trades.map((x, i) => ({ ...x, entry: x.market === 'xau' ? 4000 + (i % 2 ? 3 : -3) : 1.2 + (i % 2 ? 0.001 : -0.001) }));
  for (const m of ['xau', 'eurusd']) { const L = flat.filter((x) => x.market === m); L[L.length - 1].entry = L[0].entry; }
  const J2 = build(flat), f2 = J2.flags.find((x) => x.kind === 'weak-side');
  assert.equal(f2.regime, undefined);
});

test('audit: a "weak" subset that still makes money is flagged, never proposed away', () => {
  const trades = Array.from({ length: 60 }, (_, i) => { const buy = i % 2 === 0; return tr({ k: 'position', name: 'Position', e: D0 + Math.floor(i / 4) * DAY + (i % 4) * 5400, side: buy ? 'buy' : 'sell', entry: 4000 + (i % 3), R: buy ? (i % 4 === 0 ? 1.5 : -0.6) : 2 + (i % 3) * 0.2 }); });
  const J = build(trades), f = J.flags.find((x) => x.id === 'position|shadow|weak-side:buy');
  assert.ok(f && f.mean > 0 && f.t < -2, 'buys make money, less than sells');
  assert.equal(J.proposals.some((p) => p.flag === f.id), false, '"take only sells" would give up a profitable half');
});

test('audit: nothing is proposed for the live record of a system the owner has since made a paper shadow', () => {
  const trades = Array.from({ length: 14 }, (_, i) => tr({ k: 'gtl', name: 'Gold H4 trendline', shadow: false, blockedBy: [], e: D0 + i * DAY, R: -1 + (i % 3) * 0.05 }));
  const open = build(trades), sh = build(trades, [], { ownerShadow: { gtl: Date.UTC(2026, 10, 11) / 1000 } });
  assert.ok(open.proposals.some((p) => p.system === 'gtl' && p.action === 'move to shadow'));
  assert.equal(sh.proposals.filter((p) => p.system === 'gtl').length, 0);
  assert.equal(sys(sh, 'gtl|live').shadowed, '2026-11-11'); assert.match(sys(sh, 'gtl|live').review.head, /a paper shadow by the owner's rule since 2026-11-11/);
  // and liveNow leaves that record (and a retired engine setup's) out of the live total
  assert.deepEqual(sh.totals.liveNow.streams, []); assert.equal(sh.totals.live.all.n, 14); assert.equal(open.totals.liveNow.all.n, 14);
});

test('audit: an owner decision made after the evidence is shown with the proposal, which is then not strong', () => {
  const before = Array.from({ length: 40 }, (_, i) => tr({ k: 'replica', name: 'Gold replica', shadow: false, blockedBy: [], e: D0 + Math.floor(i / 3) * DAY + (i % 3) * 7200, R: -1 + (i % 4) * 0.1 }));
  const J = build(before, [], { userRules: ['replica-live-again'] }), p = J.proposals.find((x) => x.system === 'replica' && x.action === 'move to shadow');
  assert.ok(p, 'the losing live record is still reported and proposed');
  assert.equal(p.decided.rule, 'replica-live-again'); assert.equal(p.decided.at, '2026-11-20'); assert.equal(p.decided.closedSince, 0); assert.equal(p.strong, false);
  // without that owner rule the same record is strong
  assert.equal(build(before).proposals.find((x) => x.system === 'replica').strong, true);
  // every row of the table names a rule the Trader really has
  const trader = src('council/trader.mjs');
  for (const d of T.OWNER_DECISIONS) assert.ok(trader.includes(`id: '${d.rule}'`), d.rule);
  // and the "already tested" text no longer says the replica is a paper shadow
  assert.doesNotMatch(T.STUDIED['replica|keep off live'].text, /has been a paper shadow/);
});

test('audit: under 10 closed trades no t is printed; a forward sample is never called an edge', () => {
  const two = [tr({ k: 'geg', name: 'Gold daily engulf', shadow: false, blockedBy: [], R: -1, Rnet: -1.03 }), tr({ k: 'geg', name: 'Gold daily engulf', shadow: false, blockedBy: [], e: D0 + DAY, R: -1, Rnet: -1.03 })];
  const s = sys(build(two), 'geg|live');
  assert.match(s.review.head, /too few to judge/); assert.doesNotMatch(s.review.head, /\(t −?\d/);
  const wins = Array.from({ length: 30 }, (_, i) => tr({ k: 'swing', name: 'Swing', e: D0 + i * DAY, R: i % 3 ? 1.5 : -1 }));
  const J = build(wins), f = J.flags.find((x) => x.kind === 'positive');
  assert.ok(f); assert.doesNotMatch(JSON.stringify([J.flags, J.proposals, J.ledger, J.systems.map((x) => x.review)]).replace(/research\/edge|edge-lab/g, ''), /\bedge\b/i);
  assert.doesNotMatch(f.text, /proven/); assert.match(f.text, /proves nothing yet/);
});

test('audit: the forward check: "held" needs days as well as trades; a side that "holds" in the same market move says so; no cost, no "after costs"', () => {
  const e = { id: 's#x', stream: 's', kind: 'weak-side', field: 'side', value: 'buy', recordedAt: 1000, evidence: { n: 100, mean: -0.4, t: -5 } };
  const row = (t, side, net, px) => ({ e: t - 600, t, day: T.dayOf(t - 600), dayC: T.dayOf(t), market: 'xau', side, R: net, net, px, mfe: null, costKnown: false });
  // 80 trades in three days of a falling market: buys lose, sells win
  const three = Array.from({ length: 80 }, (_, i) => row(2000 + Math.floor(i / 27) * DAY + i * 600, i % 2 ? 'buy' : 'sell', i % 2 ? (i % 8 === 1 ? 1 : -1) : (i % 8 === 0 ? -1 : 1), 4000 - i));
  const f = T.forwardCheck(e, three);
  assert.ok(f.t <= -2 && f.n === 40); assert.equal(f.byDay.t, null); assert.equal(f.status, 'unclear', 'three days of one move are not "held"');
  assert.match(f.text, /Not counted as held: the new trades span \d days? only \(5 needed\)/);
  assert.equal(f.regime, true); assert.match(f.text, /the regime again, not evidence for the rule/);
  assert.match(f.basis, /R before costs \(no cost on record\)/); assert.doesNotMatch(f.basis, /after costs/);
  // the same split over 20 days with prices going nowhere: held, no regime remark; with costs on record the basis says so
  const many = Array.from({ length: 80 }, (_, i) => ({ ...row(2000 + Math.floor(i / 4) * DAY + (i % 4) * 3600, i % 2 ? 'buy' : 'sell', i % 2 ? (i % 8 === 1 ? 1 : -1) : (i % 8 === 0 ? -1 : 1), 4000 + (i % 4 < 2 ? 2 : -2)), costKnown: true }));
  many[many.length - 1].px = many[0].px;
  const h = T.forwardCheck(e, many);
  assert.equal(h.status, 'held'); assert.ok(h.byDay.days >= 5 && h.byDay.t <= -2); assert.equal(h.regime, undefined); assert.match(h.basis, /R after costs/);
  assert.equal(T.FWD.DAYS, 5);
});
