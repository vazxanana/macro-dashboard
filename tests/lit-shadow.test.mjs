// node --test tests/lit-shadow.test.mjs — the LIT paper shadow stream (council/lit.mjs, k 'lit'; owner, 8 Nov 2026).
// 1. pure functions on fixtures; 2. the regression pin: council/lit.mjs on a committed 3-week slice of OANDA gold 5m candles gives the
// orders / funnel / build counts the study's harness (research/edge/lit/run.mjs) gives on the same slice; 3. parity on the scratch cache
// (2024 and 2025 gold, when the cache is present): identical orders from both, and the forward window reproduces every order;
// 4. wiring pins: every LIT record is shadow with blockedBy ['owner-shadow'], never live, never in the live lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as L from '../council/lit.mjs';
import * as H from '../research/edge/lit/run.mjs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const FIX = new URL('./fixtures/lit/', import.meta.url);
const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('xau-2025-feb.json.gz', FIX))));
const EXP = JSON.parse(fs.readFileSync(new URL('expected.json', FIX), 'utf8'));
const CACHE = '/tmp/claude-0/-home-user-macro-dashboard/3e497cfa-7be6-5a8e-9ee7-f0897b9b5dd1/scratchpad/oanda5m';
const utc = (s) => Date.parse(s) / 1000;

// the harness's own pipeline on cleaned bars: orders of both directions (sign-corrected), funnel and build counts
function harness(bars) {
  const m15 = L.agg15(bars), M = H.MARKETS.xau, out = [], fun = { sweeps: 0, eqh: 0, inSession: 0, withAcc: 0, premium: 0, fbos: 0 }, bc = L.buildCounts(), cands = {};
  for (const dir of ['short', 'long']) {
    const mirror = dir === 'long', S15 = H.series(m15, mirror, M.tick), S5 = H.series(bars, mirror, M.tick), sg = S5.sign;
    const c = H.fbosCandidates(S15, fun); cands[dir] = c.length; for (const cd of c) { cd.confEnd = S15.t[cd.conf] + 900; cd.rEnd = S15.t[cd.r] + 900; }
    for (const cd of c) { const od = H.buildOrder(S5, cd, M, H.VARIANTS[0], bc); if (od) out.push({ dir, tSig: od.tSig, tJA: S5.t[od.jA], sess: od.sess, level: od.level, capOK: od.capOK, entry: sg * od.entry, stop: sg * od.stop, target: sg * od.target, MX: sg * od.MX, rr: +od.rr.toFixed(6), risk: +od.risk.toFixed(6) }); }
  }
  out.sort((a, b) => a.tJA - b.tJA || a.tSig - b.tSig);
  return { orders: out, funnel: fun, build: bc, cands };
}
const slim = (o) => ({ dir: o.dir, tSig: o.tSig, tJA: o.tJA, sess: o.sess, level: o.level, capOK: o.capOK, entry: o.entry, stop: o.stop, target: o.target, MX: o.MX, rr: +o.rr.toFixed(6), risk: +o.risk.toFixed(6) });

test('New York time: sessions, the 18:00 trading day, the 17:00 day end', () => {
  assert.equal(L.nyInfo(utc('2026-11-09T08:00:00Z')).sess, 'LONDON');        // 03:00 EST
  assert.equal(L.nyInfo(utc('2026-11-09T14:30:00Z')).hm, 930);               // the 09:30 bar
  assert.equal(L.nyInfo(utc('2026-11-09T14:30:00Z')).sess, 'NY_AM');
  assert.equal(L.nyInfo(utc('2026-11-09T18:00:00Z')).sess, 'NY_PM');
  assert.equal(L.nyInfo(utc('2026-11-09T23:30:00Z')).sess, 'ASIA');
  assert.equal(L.nyInfo(utc('2026-11-09T21:30:00Z')).sess, null);             // 16:30: no session
  assert.equal(L.nyInfo(utc('2026-11-08T23:30:00Z')).day, L.nyInfo(utc('2026-11-09T20:00:00Z')).day, 'Sunday 18:30 and Monday 15:00 are one trading day');
  assert.notEqual(L.nyInfo(utc('2026-11-09T22:30:00Z')).day, L.nyInfo(utc('2026-11-09T23:30:00Z')).day, 'the day turns at 18:00 New York');
  assert.equal(L.dayEnd(utc('2026-11-09T15:00:00Z')), utc('2026-11-09T22:00:00Z'), 'Monday 10:00 EST -> Monday 17:00 EST');
  assert.equal(L.dayEnd(utc('2026-11-08T23:30:00Z')), utc('2026-11-09T22:00:00Z'), 'Sunday 18:30 -> Monday 17:00');
  assert.equal(L.dayEnd(utc('2026-03-09T13:00:00Z')), utc('2026-03-09T21:00:00Z'), 'EDT: Monday 09:00 -> 17:00');
  assert.ok(L.inHalt(utc('2026-11-09T22:30:00Z')) && !L.inHalt(utc('2026-11-09T23:00:00Z')), 'the 17:00 New York hour is the halt');
});

test('cleanBars, agg15, completeQuarters', () => {
  const t0 = utc('2026-11-09T13:00:00Z');   // Monday 08:00 EST
  const b = L.cleanBars([[t0 + 300, 2, 2.5, 1.5, 2.2], [t0, 1, 1.2, 0.9, 1.1], [t0 + 600, 3, 2.9, 3.1, 2.8], [t0 + 900, 0, 1, 1, 1], [utc('2026-11-07T15:00:00Z'), 1, 1, 1, 1], [utc('2026-11-09T22:10:00Z'), 1, 1, 1, 1]]);
  assert.deepEqual(b.map((x) => x.t - t0), [0, 300, 600], 'sorted; a non-positive price, a Saturday candle and a 17:00 candle dropped');
  assert.deepEqual(b[2], { t: t0 + 600, o: 3, h: 3, l: 2.8, c: 2.8 }, 'high / low widened to cover open and close');
  const q = Math.floor(t0 / 900) * 900, m5 = [0, 300, 600, 900, 1200].map((d, i) => ({ t: q + d, o: i, h: i + 1, l: i - 1, c: i + 0.5 }));
  const m15 = L.agg15(m5);
  assert.deepEqual(m15, [{ t: q, o: 0, h: 3, l: -1, c: 2.5 }, { t: q + 900, o: 3, h: 5, l: 2, c: 4.5 }]);
  assert.equal(L.completeQuarters(m5).length, 3, 'the second quarter has only two of its three bars: dropped');
  assert.equal(L.completeQuarters(m5.slice(0, 3)).length, 3, 'a quarter whose last slot is in is complete');
  assert.equal(L.completeQuarters(m5.slice(0, 2)).length, 0);
  assert.equal(L.completeQuarters([]).length, 0);
});

test('series: body-only vectors, ATR(14), fractal pivots, the mirror', () => {
  const bars = []; for (let i = 0; i < 40; i++) bars.push({ t: 1000 + i * 300, o: 100, h: 100.6, l: 99.4, c: i === 20 ? 101 : 100.2 });
  bars[28] = { t: 1000 + 28 * 300, o: 100, h: 100.6, l: 96, c: 100.2 };   // a lone low: a pivot low at 28
  const S = L.series(bars, false, 0.01);
  assert.equal(S.vec[20], 1, 'body 1.0 vs mean body 0.2: a vector'); assert.equal(S.vec[21], 0); assert.equal(S.vec[5], 0);
  assert.ok(Number.isNaN(S.atr[12]) && Math.abs(S.atr[13] - 1.2) < 1e-9, 'ATR(14) = mean true range from bar 13');
  assert.equal(S.pivL[28], 1); assert.equal(S.pivL[29], 0); assert.equal(S.pivH[28], 0);
  const M = L.series(bars, true, 0.01);
  assert.equal(M.pivH[28], 1, 'mirrored: the low is a high'); assert.equal(M.h[28], -96); assert.equal(M.sign, -1);
  assert.equal(L.accumulation(S, 39).n, 10, 'the longest run of bars within 3 ATR ending at bar 38: bars 29-38 (the lone low at 28 breaks it)');
  assert.equal(L.accumulation(S, 36), null, 'bars 29-35 are only 7: no accumulation');
});

test('regression pin: council/lit.mjs on the committed 3-week gold slice = the harness (orders, funnel, candidates, build counts)', () => {
  const bars = L.cleanBars(rows);
  assert.equal(rows.length, EXP.rows); assert.equal(bars.length, EXP.m5);
  const det = L.detect(bars);
  assert.equal(det.m15, EXP.m15);
  assert.deepEqual(det.funnel, EXP.funnel); assert.deepEqual(det.build, EXP.build);
  assert.deepEqual(det.orders.map(slim), EXP.orders);
  // and the harness, live, on the same slice: the pin is what the harness gives today too
  const h = harness(bars);
  assert.deepEqual(h.orders, EXP.orders); assert.deepEqual(h.funnel, EXP.funnel); assert.deepEqual(h.build, EXP.build); assert.deepEqual(h.cands, EXP.candidates);
  assert.equal(det.orders.length, 1); assert.equal(det.orders[0].capOK, true);
  const od = det.orders[0];
  assert.equal(new Date(od.tJA * 1000).toISOString(), '2025-02-20T09:45:00.000Z'); assert.equal(od.sess, 'LONDON'); assert.equal(od.level, 'acc');
  assert.deepEqual([od.entry, od.stop, od.target, od.MX, od.rbosLevel], [2953.885, 2955.555, 2946.49, 2954.955, 2952.385]);
  assert.deepEqual([od.accLow, od.accHigh, od.accN], [2946.49, 2954.83, 8]); assert.equal(od.obBar.o, 2953.885);
});

test('litRecord: a pending limit at the OB open, shadow and owner-shadow always, the study\'s stop / target / life, the day end', () => {
  const od = L.detect(L.cleanBars(rows)).orders[0], r = L.litRecord(od, { feed: 'oanda' });
  assert.equal(r.id, 'xau-lit-s-1740044700'); assert.equal(r.k, 'lit'); assert.equal(r.name, 'LIT (paper shadow)'); assert.equal(r.pair, 'M15 FBOS → M5 RBOS → OB limit');
  assert.equal(r.shadow, true); assert.deepEqual(r.blockedBy, ['owner-shadow']);
  assert.equal(r.market, 'xau'); assert.equal(r.side, 'sell'); assert.equal(r.status, 'pending'); assert.equal(r.entryMode, 'limit'); assert.equal(r.noBe, true);
  assert.deepEqual([r.entry, r.stop, r.t1, r.rr, r.r0], [2953.89, 2955.55, 2946.49, 4.43, 1.66], 'the Trader\'s 2 decimals for gold');
  assert.equal(r.validFor, 24 * 300); assert.equal(r.opened, od.tJA); assert.equal(r.checked, od.tJA); assert.equal(r.R, null); assert.equal(r.feed, 'oanda');
  assert.equal(r.lit.dayEnd, utc('2025-02-20T22:00:00Z'), '17:00 EST'); assert.equal(r.opened + r.maxHold, r.lit.dayEnd - 60, 'held to the day end from the order bar until it fills');
  assert.deepEqual(r.feat, { sess: 'LONDON', level: 'acc', L: 2954.83, MX: 2954.95, rbos: 2952.39, accN: 8, accLow: 2946.49, accHigh: 2954.83, riskPct: 0.0565 });
  for (const s of ['LIT (paper shadow, owner-shadow, never live)', '04:00 New York M15 bar swept the accumulation\'s own high 2954.83 in London', 'MX 2954.95', 'swing low 2952.39 by wick (RBOS)', 'limit at the order block\'s open 2953.89', 'stop 2955.55', 'target the accumulation\'s low 2946.49 (4.4R)', 'Rests 24 M5 bars; out at 17:00 New York', 'break-even after two post-entry M5 swing breaks', '09:30 candle can fill here', '1-tick trade-through']) assert.ok(r.note.includes(s), `note: ${s}`);
  const copy = L.litRecord(od); assert.notEqual(copy.blockedBy, r.blockedBy, 'own arrays'); assert.equal(copy.feed, undefined);
  // the long side mirrors: a buy limit, stop below MX (the sweep's low), target the accumulation's high
  const lo = { ...od, dir: 'long', entry: -od.entry, stop: -od.stop, target: -od.target, MX: -od.MX, L: -od.L, rbosLevel: -od.rbosLevel, accLow: -od.accLow, accHigh: -od.accHigh, obBar: { ...od.obBar, o: -od.obBar.o, c: -od.obBar.c, h: -od.obBar.l, l: -od.obBar.h } };
  const b = L.litRecord(lo); assert.equal(b.side, 'buy'); assert.equal(b.id, 'xau-lit-b-1740044700'); assert.ok(b.stop < b.entry && b.t1 > b.entry); assert.equal(b.shadow, true);
  assert.ok(b.note.includes('swept the accumulation\'s own low') && b.note.includes('Buy limit') && b.note.includes('last bearish M5 candle'));
});

test('dayEndHold: once filled the time exit is re-stamped from the fill to 17:00 New York', () => {
  const r = L.litRecord(L.detect(L.cleanBars(rows)).orders[0]);
  assert.equal(L.dayEndHold(r), false, 'pending: nothing');
  r.status = 'open'; r.filled = r.opened + 1500;
  assert.equal(L.dayEndHold(r), true); assert.equal(r.filled + r.maxHold, r.lit.dayEnd - 60);
  assert.equal(L.dayEndHold(r), false, 'idempotent');
  r.filled = r.lit.dayEnd - 30; assert.equal(L.dayEndHold(r), true); assert.equal(r.maxHold, 60, 'never less than a minute');
});

test('blockedWhy: one order at a time, one fill per session, stop after a win or -1.5R, Rnet before R', () => {
  const T = utc('2025-02-20T09:45:00Z'), od = { tJA: T, sess: 'LONDON' }, day = (t) => L.nyInfo(t).day;
  assert.equal(L.blockedWhy([], od), null);
  assert.equal(L.blockedWhy([{ status: 'pending', opened: T - 3600 }], od), 'busy');
  assert.equal(L.blockedWhy([{ status: 'open', opened: T - 3600, filled: T - 3000, lit: { sess: 'LONDON' } }], od), 'busy');
  assert.equal(L.blockedWhy([{ status: 'expired', opened: T - 3600, closed: T + 60 }], od), 'busy', 'its life covered the order bar');
  assert.equal(L.blockedWhy([{ status: 'expired', opened: T - 7500, closed: T - 300 }], od), null, 'over before the order bar');
  const L1 = { status: 'loss', opened: T - 7000, filled: T - 6500, closed: T - 5000, R: -1, Rnet: -1.1, lit: { sess: 'LONDON' } };
  assert.equal(L.blockedWhy([L1], od), 'sessionDone', 'a London fill already today');
  assert.equal(L.blockedWhy([L1], { tJA: utc('2025-02-20T14:00:00Z'), sess: 'NY_AM' }), null, 'the New York morning is still open');
  const W = { ...L1, status: 'win', R: 4.4, Rnet: 4.3 };
  assert.equal(L.blockedWhy([W], { tJA: utc('2025-02-20T14:00:00Z'), sess: 'NY_AM' }), 'dayDone', 'after a win the day is done');
  const L2 = { ...L1, status: 'loss', R: -0.3, Rnet: -0.4, lit: { sess: 'NY_AM' }, filled: T - 6000 };
  assert.equal(L.blockedWhy([L1, L2], { tJA: T + 600, sess: 'NY_AM' }), 'dayDone', '-1.1 + -0.4 = -1.5R: the cap (Rnet counts)');
  assert.equal(L.blockedWhy([L1, { ...L2, Rnet: -0.3 }], { tJA: T + 600, sess: 'LONDON' }), 'sessionDone');
  assert.equal(L.blockedWhy([{ ...L1, Rnet: undefined }, { ...L2, Rnet: undefined, lit: { sess: 'LONDON' } }], { tJA: T + 600, sess: 'NY_AM' }), null, 'R when not yet costed: -1.3R, still trading');
  assert.equal(day(T - 7000), day(T), 'the fixture trades sit in one trading day');
  assert.equal(L.blockedWhy([{ ...W, filled: T - 86400, closed: T - 80000 }], od), null, 'yesterday\'s win does not count');
});

test('litStep on the fixture: the forward window places the study\'s order once, as a shadow; later rounds and dead orders place nothing', () => {
  const all = L.cleanBars(rows), T = utc('2025-02-20T09:45:00Z');
  const win = all.filter((b) => b.t <= T).slice(-L.LOOKBACK_BARS);
  assert.ok(win.length < all.length && win[0].t <= utc('2025-02-02T23:00:00Z') + 86400 * 3, 'the window starts before the previous trading week');
  const st = L.litStep({ bars: win, recs: [], now: T + 300, feed: 'oanda' });
  assert.equal(st.push.length, 1); assert.equal(st.skipped.length, 0);
  const r = st.push[0];
  assert.equal(r.id, 'xau-lit-s-1740044700'); assert.deepEqual([r.entry, r.stop, r.t1], [2953.89, 2955.55, 2946.49]); assert.equal(r.shadow, true); assert.deepEqual(r.blockedBy, ['owner-shadow']);
  assert.equal(st.last, T); assert.equal(st.orders, 1); assert.equal(st.m15, L.agg15(L.completeQuarters(win)).length);
  // one bar earlier: the order bar is not in yet (the RBOS check needs the bar after the break): nothing
  const early = L.litStep({ bars: all.filter((b) => b.t < T), recs: [], now: T, feed: 'oanda' });
  assert.equal(early.push.length, 0);
  // the record exists: nothing new; a half-built quarter at the end changes nothing here
  assert.equal(L.litStep({ bars: all.filter((b) => b.t <= T + 300), recs: [r], now: T + 600 }).push.length, 0);
  // another LIT order open at the time: busy
  const busy = L.litStep({ bars: win, recs: [{ id: 'x', k: 'lit', status: 'open', opened: T - 3600, filled: T - 3000, lit: { sess: 'LONDON' } }], now: T + 300 });
  assert.equal(busy.push.length, 0); assert.deepEqual(busy.skipped, [{ id: 'xau-lit-s-1740044700', why: 'busy' }]);
  // the Trader was away for over the order's life: the harness's order would have expired, nothing is recorded
  assert.equal(L.litStep({ bars: all.filter((b) => b.t <= T + 3 * 3600), recs: [], now: T + 3 * 3600 }).push.length, 0);
  // the whole slice at its end: the one order is long dead by then
  assert.equal(L.litStep({ bars: all, recs: [], now: all.at(-1).t + 300 }).push.length, 0);
  // an open record gets its day-end hold and break-even check in the same step
  const open = { ...r, status: 'open', filled: T + 600, maxHold: r.maxHold };
  const st2 = L.litStep({ bars: all.filter((b) => b.t <= T + 7200), recs: [open], now: T + 7500 });
  assert.equal(st2.held, 1); assert.equal(open.filled + open.maxHold, open.lit.dayEnd - 60); assert.equal(st2.push.length, 0);
});

test('swingBreaks / swingBreakEven: break-even after two post-entry M5 swing breaks, both sides, never backwards', () => {
  const t0 = utc('2026-11-09T14:00:00Z'), mk = (lows) => lows.map((l, i) => ({ t: t0 + i * 300, o: l + 0.4, h: l + 1, l, c: l + 0.6 }));
  // sell: fill bar 0; pivot low at 2 (confirmed at bar 4), broken at 5; pivot at 5 (confirmed at 7), broken at 8
  const lows = [10, 9.5, 9, 9.5, 9.8, 8.9, 9.2, 9.4, 8.5, 8.7, 8.9];
  const sb = L.swingBreaks(mk(lows), true, t0 + 120);
  assert.deepEqual(sb, { breaks: 2, at: t0 + 8 * 300 });
  assert.equal(L.swingBreaks(mk(lows.slice(0, 8)), true, t0 + 120).breaks, 1, 'one break so far');
  assert.equal(L.swingBreaks(mk(lows), true, t0 + 5 * 300 + 60).breaks, 0, 'filled on bar 5: only pivots after the fill bar count (pivot 5 is the fill bar; pivot 8 is never broken)');
  assert.equal(L.swingBreaks(mk(lows), false, t0 + 120).breaks, 0, 'a buy reads highs: this shape has no swing-high breaks');
  // buy: the mirror on highs
  const highs = [10, 10.5, 11, 10.5, 10.2, 11.1, 10.8, 10.6, 11.5, 11.3, 11.1], bb = highs.map((h, i) => ({ t: t0 + i * 300, o: h - 0.4, h, l: h - 1, c: h - 0.6 }));
  assert.deepEqual(L.swingBreaks(bb, false, t0 + 120), { breaks: 2, at: t0 + 8 * 300 });
  const tr = { k: 'lit', side: 'sell', status: 'open', filled: t0 + 120, entry: 9.9, stop: 10.6, t1: 5 };
  assert.equal(L.swingBreakEven(tr, mk(lows.slice(0, 8))), false, 'one break: no move'); assert.equal(tr.stop, 10.6);
  assert.equal(L.swingBreakEven(tr, mk(lows)), true); assert.equal(tr.stop, 9.9); assert.equal(tr.beMoved, true); assert.equal(tr.beSwing, t0 + 8 * 300);
  assert.equal(L.swingBreakEven(tr, mk(lows)), false, 'once');
  const pend = { k: 'lit', side: 'sell', status: 'pending', entry: 9.9, stop: 10.6 }; assert.equal(L.swingBreakEven(pend, mk(lows)), false); assert.equal(pend.stop, 10.6);
  const other = { k: 'mosha-bo', side: 'sell', status: 'open', filled: t0 + 120, entry: 9.9, stop: 10.6 }; assert.equal(L.swingBreakEven(other, mk(lows)), false, 'LIT records only');
  const better = { k: 'lit', side: 'sell', status: 'open', filled: t0 + 120, entry: 9.9, stop: 9.5 }; assert.equal(L.swingBreakEven(better, mk(lows)), false, 'a stop already past the entry stays');
  const buy = { k: 'lit', side: 'buy', status: 'open', filled: t0 + 120, entry: 10.1, stop: 9.3, feedBasis: 0.05 };
  assert.equal(L.swingBreakEven(buy, bb), true); assert.equal(buy.stop, 10.15, 'the entry in the feed\'s frame');
});

test('parity with the harness on the scratch cache (2024 and 2025 gold): identical orders; the forward window reproduces each order', (t) => {
  if (!fs.existsSync(path.join(CACHE, 'xau-2024.json.gz')) || !fs.existsSync(path.join(CACHE, 'xau-2025.json.gz'))) return t.skip('no oanda5m cache in the scratchpad (the committed fixture pin above covers CI)');
  let checked = 0;
  for (const year of [2024, 2025]) {
    const bars = L.cleanBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(CACHE, `xau-${year}.json.gz`)))));
    const h = harness(bars), det = L.detect(bars);
    assert.deepEqual(det.orders.map(slim), h.orders, `${year}: the same orders`);
    assert.deepEqual(det.funnel, h.funnel, `${year}: the same funnel`); assert.deepEqual(det.build, h.build, `${year}: the same build counts`);
    assert.ok(det.orders.length >= 10, `${year}: ${det.orders.length} orders`);
    // forward: a window of LOOKBACK_BARS closed candles ending on the order bar gives the same order (its id, prices, R:R) with no history before
    const seen = new Set();
    for (const od of det.orders.filter((o) => o.capOK)) {
      if (seen.has(L.recordId('xau', od))) continue; seen.add(L.recordId('xau', od));   // two sweeps, one MX bar: the first by sweep time is the order, the second is busy (harness selectTrades)
      const i = bars.findIndex((b) => b.t === od.tJA), win = bars.slice(Math.max(0, i + 1 - L.LOOKBACK_BARS), i + 1);
      if (win.length < L.LOOKBACK_BARS) continue;   // January: not enough history in the year file
      const st = L.litStep({ bars: win, recs: [], now: od.tJA + 300 });
      const r = st.push.find((x) => x.id === L.recordId('xau', od));
      assert.ok(r, `${year}: the window reproduces ${L.recordId('xau', od)} (${new Date(od.tJA * 1000).toISOString()})`);
      assert.deepEqual([r.entry, r.stop, r.t1, r.rr], [+od.entry.toFixed(2), +od.stop.toFixed(2), +od.target.toFixed(2), +od.rr.toFixed(2)]);
      assert.equal(r.shadow, true); assert.deepEqual(r.blockedBy, ['owner-shadow']);
      checked++;
    }
  }
  assert.ok(checked >= 20, `${checked} forward windows checked`);
});

test('wiring pins: the stream is shadow-only in council/trader.mjs; nothing live lists k lit', () => {
  const trader = read('../council/trader.mjs'), page = read('../market-structure.html'), alerts = read('../council/alerts.mjs'), decay = read('../council/decay.mjs'), expect = read('../council/expect.mjs');
  assert.ok(trader.includes("{ id: 'lit-shadow', apply: (c) => { c.litShadow = true; }"), 'the owner rule');
  assert.ok(trader.includes("import { litStep, cleanBars as litClean, LOOKBACK_BARS as LIT_BARS, K as LIT_K } from './lit.mjs';"), 'the import');
  assert.ok(trader.includes("if (key === 'xau' && config.litShadow && feed === 'OANDA') {"), 'gold only, on the OANDA feed, behind the owner rule');
  assert.ok(trader.includes("const raw = await oandaBars(key, '5m', LIT_BARS);"), 'the longer 5m read is LIT\'s only');
  assert.ok(trader.includes("const bars = litClean(raw.filter((b) => !b.live && b.time + 300 <= now));"), 'closed candles only');
  assert.ok(trader.includes("const recs = trades.filter((x) => x.k === LIT_K && x.market === key);"), 'the gates see the stream\'s own records');
  assert.ok(trader.includes("for (const rec of st.push) if (rec.shadow === true && (rec.blockedBy || []).includes('owner-shadow')) trades.push(rec);"), 'a record reaches trades.json only as an owner shadow');
  const a = trader.indexOf("if (key === 'xau' && config.litShadow && feed === 'OANDA') {"), b = trader.indexOf("if (key === 'xau' && config.goldTL) {", a), blk = trader.slice(a, b);
  assert.ok(a > 0 && b > a); assert.equal((blk.match(/trades\.push\(/g) || []).length, 1, 'one push in the block'); assert.ok(!/shadow: false/.test(blk));
  assert.ok(!blk.includes('research.push') && !blk.includes('sendAlerts') && !blk.includes('alertable'), 'no alert, no research record');
  // the live lists: the futures / cTrader bridge whitelist, the page's system keys, the alert filter
  const sysk = trader.match(/const SYSK = \[([^\]]*)\]/); assert.ok(sysk && !sysk[1].includes("'lit'"), 'not in the bridge whitelist');
  assert.equal(L.K, 'lit'); assert.ok(!/SYS_K = \[[^\]]*'lit'/.test(page), 'not a system on the page');
  assert.ok(alerts.includes('export const alertable = (trades, research) => trades.filter((x) => !x.shadow)'), 'shadows never alert');
  assert.ok(!decay.includes("'lit'") && !expect.includes("'lit'"), 'decay.mjs SYSTEMS and expect.mjs are unchanged: no baseline for LIT');
  assert.ok(read('../research/edge/lit/RESULT.md').startsWith("8 Nov: the owner keeps LIT as a paper shadow stream (council/lit.mjs, k 'lit') to build a forward record; this study's verdict stands."));
  // the module's constants the records are built from
  assert.deepEqual(L.BLOCKED, ['owner-shadow']); assert.equal(L.NAME, 'LIT (paper shadow)'); assert.equal(L.VALID_FOR, 7200); assert.equal(L.LOOKBACK_BARS, 4000);
  assert.deepEqual(L.VARIANT, { id: 'wick-open', trig: 'wick', entry: 'open' }, 'the pre-registered primary');
  for (const k of Object.keys(L.P)) assert.equal(L.P[k], H.P[k], `P.${k} is the harness\'s`);
});
