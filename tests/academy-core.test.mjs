// node --test tests/academy-core.test.mjs — the Academy core (assets/academy-core.js): features, regimes, the decision
// policy, the running thesis, lesson memory, comparison, error classes, counterfactuals and the optional scorer.
// Offline and deterministic: every series below comes from a seeded generator with a known structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const MXA = createRequire(import.meta.url)('../assets/academy-core.js');
const TF = MXA.TF;

// ---- synthetic data ------------------------------------------------------------------------------------------------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T0 = 1704067200;                                    // Mon 1 Jan 2024 00:00 UTC
const at = (day) => T0 + Math.round(day * 96) * 900;      // "day 66.5" = 66 days and 12 hours after T0, on the M15 grid
function barsFrom(closes, { t0 = T0, tfSec = 900, wick = 0.3, seed = 1 } = {}) {
  const r = rng(seed), out = []; let prev = closes[0];
  for (let i = 0; i < closes.length; i++) { const o = prev, c = closes[i]; out.push({ time: t0 + i * tfSec, open: o, high: Math.max(o, c) + wick * r(), low: Math.min(o, c) - wick * r(), close: c }); prev = c; }
  return out;
}
function agg(bars, tfSec) { const out = []; for (const b of bars) { const k = Math.floor(b.time / tfSec) * tfSec, q = out[out.length - 1]; if (q && q.time === k) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); } return out; }
const series = (m15) => ({ '15m': m15, '1h': agg(m15, 3600), '4h': agg(m15, 14400), '1d': agg(m15, 86400) });
// the same slicing rule as the replay layer: only bars that had closed at t
function snapAt(ser, t, extra = {}) { const bars = {}; for (const tf of Object.keys(ser)) bars[tf] = ser[tf].filter((b) => b.time + TF[tf] <= t).slice(-400); return Object.assign({ v: 1, edge: 'test', market: 'XAU_USD', t, cand: null, bars, dataVersion: 'synthetic-1' }, extra); }
// drift + an 8-day swing + mean-reverting noise: real pullbacks, so swing highs and lows exist on every timeframe
function wave({ n, base = 2000, drift = 0, amp = 0, period = 96 * 8, noise = 0.4, seed = 7 }) { const r = rng(seed), out = []; let x = 0; for (let i = 0; i < n; i++) { x = 0.6 * x + (r() - 0.5) * 2 * noise; out.push(base + drift * i + amp * Math.sin(2 * Math.PI * i / period) + x); } return out; }

const UP_CLOSES = wave({ n: 96 * 70, drift: 0.012, amp: 14, noise: 0.5, seed: 11 });      // 70 days, rising
const UP = series(barsFrom(UP_CLOSES, { seed: 3 }));
// 60 days up, then 30 days down: the higher-timeframe bias flips
const FLIP = (() => { const a = wave({ n: 96 * 60, drift: 0.012, amp: 14, noise: 0.5, seed: 11 }), b = wave({ n: 96 * 30, base: a[a.length - 1], drift: -0.03, amp: 10, noise: 0.5, seed: 12 }); return series(barsFrom(a.concat(b), { seed: 4 })); })();

function candOf(s, side, o = {}) {
  const f = MXA.features(Object.assign({}, s, { cand: null })), d = side === 'buy' ? 1 : -1, e = f.lastClose, a = f.atr;
  return { id: o.id || 'c-' + s.t + '-' + side, edge: s.edge, market: s.market, t: s.t, side, entry: e, stop: e - d * (o.stopAtr || 1.5) * a, target: e + d * (o.tgtAtr || 3.5) * a, tf: o.tf || '15m', rule: {}, edgeVersion: 'ev1', pool: 'train' };
}
function withCand(ser, day, side, o = {}) { const s = snapAt(ser, at(day), Object.assign({ edge: o.edge || 'test' }, o.extra || {})); s.cand = candOf(s, side, o); return s; }
// scan the synthetic series for the first decision point with a wanted property (robust to small numeric changes)
function find(side, pred, o = {}) {
  for (let day = o.from || 55; day < (o.to || 69.9); day += 0.05) {
    const s = withCand(o.ser || UP, day, side, o), f = MXA.features(s), d = MXA.decide(s, o.opts || {});
    if (pred(d, f, s)) return { s, f, d, day };
  }
  assert.fail('no synthetic decision point matches: ' + (o.what || pred.toString()));
}
const factors = (list) => list.map((x) => x.factor);
const correction = (o) => Object.assign({ id: 'k1', attemptId: 'a1', at: 1, verdict: 'change', action: null, entry: null, stop: null, target: null, bias: null, edge: null, reasons: [], text: '', annotations: [] }, o);
const attempt = (n, decision) => ({ id: 'a' + n, candidateId: decision.candidateId, edge: decision.edge, sessionId: 's1', n, at: n, mode: n === 1 ? 'train' : 'replay-same', decision, lessonsAvailable: [], snapshotHash: 'h' });

// ---- features ------------------------------------------------------------------------------------------------------
test('features: an uptrend reads as HH/HL above its means, with the day, week and session levels in place', () => {
  const s = snapAt(UP, at(66)), f = MXA.features(s);
  assert.equal(f.structD1, 'up'); assert.equal(f.structH4, 'up'); assert.equal(f.maPosD1, 'above');
  assert.equal(f.htfBias, 'up'); assert.ok(f.htfScore >= 2);
  assert.equal(f.barsOk, true); assert.equal(f.missingTf, ''); assert.equal(f.sigTf, '15m');
  assert.equal(f.session, 'asia'); assert.equal(f.dow, 'thu'); assert.equal(f.hourUtc, 0);          // day 66 after a Monday = a Thursday, 00:00 UTC
  const y = s.bars['1d'].at(-1); assert.equal(f.pdh, Math.round(y.high * 1e5) / 1e5); assert.equal(f.pdl, Math.round(y.low * 1e5) / 1e5); assert.ok(f.distPdl > 0);
  const lastWeek = s.bars['1d'].filter((b) => b.time >= at(56) && b.time < at(63));           // Monday day 56 .. Sunday day 62
  assert.equal(f.pwh, Math.round(Math.max(...lastWeek.map((b) => b.high)) * 1e5) / 1e5); assert.equal(f.pwl, Math.round(Math.min(...lastWeek.map((b) => b.low)) * 1e5) / 1e5);
  assert.ok(f.sessHigh > f.sessLow, 'the previous session window (late, 21-24 UTC) has a range');
  assert.ok(f.atr > 0 && f.atrPct > 0 && f.atrPctile >= 0 && f.atrPctile <= 1);
  assert.ok(['low', 'normal', 'high'].includes(f.volState));
  assert.ok(f.entryLoc >= 0 && f.entryLoc <= 1);
  // candidate-only keys stay null between signals: never a guess
  for (const k of ['side', 'rr', 'stopAtr', 'biasAlign', 'confirm', 'oppLiq', 'dxyConflict']) assert.equal(f[k], null, k);
  assert.equal(f.dxyTrend, null); assert.equal(f.eventNear, null);
});

test('features: every key is documented, flat, and the documented list is exactly what comes back', () => {
  const s = withCand(UP, 66.55, 'buy'), f = MXA.features(s);
  assert.deepEqual(Object.keys(f).sort(), Object.keys(MXA.FEATURE_DOC).sort());
  for (const [k, v] of Object.entries(f)) assert.ok(v === null || ['number', 'string', 'boolean'].includes(typeof v), `${k} is ${typeof v}`);
  for (const k of ['htfBias', 'structH1', 'sweep', 'displacement', 'momentum', 'atrPct', 'volState', 'session', 'regime', 'rr', 'stopAtr', 'entryLoc', 'distSR', 'dxyTrend', 'dxyConflict', 'eventNear']) assert.ok(k in f, k);
  assert.equal(f.side, 'buy'); assert.equal(f.geomOk, true); assert.ok(Math.abs(f.rr - 3.5 / 1.5) < 0.01); assert.ok(Math.abs(f.stopAtr - 1.5) < 0.01); assert.equal(f.biasAlign, 'with');
  for (const k of MXA.PRICE_KEYS) assert.ok(k in MXA.FEATURE_DOC, k);
});

test('features: a wick through a prior swing low that closes back is a low sweep, with its age and level', () => {
  const m15 = UP['15m'].filter((b) => b.time < at(66)), px = m15.at(-1).close; let t = at(66);
  const add = (o, h, l, c) => { m15.push({ time: t, open: o, high: h, low: l, close: c }); t += 900; };
  // a hard drop into a swing low P (the lowest price for hours), a bounce, then a wick 1.5 through P that closes back above it, then a strong bar up
  const P = px - 8;
  add(px, px + 0.1, px - 4, px - 3.8); add(px - 3.8, px - 3.7, P, px - 7); add(px - 7, px - 5, px - 7.2, px - 5.2); add(px - 5.2, px - 3.9, px - 5.4, px - 4);
  add(px - 4, px - 3, px - 4.2, px - 3.2); add(px - 3.2, px - 3, px - 4.1, px - 3.9); add(px - 3.9, px - 3.7, px - 5, px - 4.8);
  add(px - 4.8, px - 4.6, P - 1.5, px - 6); add(px - 6, px - 2.9, px - 6.1, px - 3);
  const ser = series(m15), s = snapAt(ser, t), f = MXA.features(s);
  assert.equal(f.sweep, 'low'); assert.equal(f.sweepAge, 1); assert.equal(f.sweepOf, 'swing');
  assert.ok(Math.abs(f.sweepLevel - P) < 1e-4, `swept level ${f.sweepLevel} should be the swing low ${P}`);
  assert.ok(f.sweepDepth > 0);
  assert.equal(f.displacement, 'up'); assert.equal(f.dispAge, 0);
  s.cand = candOf(s, 'buy'); assert.equal(MXA.features(s).sweepFor, 'with');
  s.cand = candOf(s, 'sell'); assert.equal(MXA.features(s).sweepFor, 'against');
});

test('features: the dollar index is read only when it is given; a gold buy with the dollar rising is a conflict', () => {
  const s = withCand(UP, 66.55, 'buy'), r = rng(5); let x = 100; const c = [];
  for (let i = 0; i < 80; i++) { x += 0.05 + (r() - 0.5) * 0.04; c.push(x); }
  const dxy = barsFrom(c, { t0: s.t - 80 * 3600, tfSec: 3600, wick: 0.01 });
  assert.equal(MXA.features(s).dxyTrend, null); assert.equal(MXA.features(s).dxyConflict, null);
  const g = Object.assign({}, s, { inter: { dxy: { '1h': dxy } } }), f = MXA.features(g);
  assert.equal(f.dxyTrend, 'up'); assert.equal(f.dxyConflict, true);
  assert.equal(MXA.features(Object.assign({}, g, { cand: candOf(s, 'sell') })).dxyConflict, false);
  assert.equal(MXA.features(Object.assign({}, g, { market: 'NAS100_USD' })).dxyConflict, null, 'only gold is judged against the dollar');
  assert.ok(factors(MXA.decide(g, {}).contradicting).includes('dxy'));
});

test('features: eventNear comes from the schedule (next 12 h) and from releases already out (last 2 h); null without a calendar', () => {
  const s = withCand(UP, 66.55, 'buy'), H = 3600;
  assert.equal(MXA.features(s).eventNear, null); assert.equal(MXA.features(s).eventInH, null);
  const ahead = MXA.features(Object.assign({}, s, { schedule: [{ t: s.t + 3 * H, title: 'US CPI', impact: 'high' }, { t: s.t + 30 * H, title: 'FOMC', impact: 'high' }] }));
  assert.equal(ahead.eventNear, true); assert.equal(ahead.eventInH, 3); assert.equal(ahead.eventMins, 180); assert.equal(ahead.eventTitle, 'US CPI'); assert.equal(ahead.regime, 'event');
  const far = MXA.features(Object.assign({}, s, { schedule: [{ t: s.t + 30 * H, title: 'FOMC', impact: 'high' }] }));
  assert.equal(far.eventNear, false); assert.equal(far.eventInH, 30); assert.notEqual(far.regime, 'event');
  const out = MXA.features(Object.assign({}, s, { events: [{ t: s.t - H, title: 'NFP', impact: 'high' }] }));
  assert.equal(out.eventNear, true); assert.equal(out.eventMins, -60); assert.equal(out.eventInH, null);
  const old = MXA.features(Object.assign({}, s, { events: [{ t: s.t - 5 * H, title: 'NFP', impact: 'high' }], schedule: [{ t: s.t + 2 * H, title: 'PMI', impact: 'low' }] }));
  assert.equal(old.eventNear, false); assert.equal(old.eventInH, null);
});

// ---- regimes -------------------------------------------------------------------------------------------------------
test('regime: trending, ranging, breakout, reversal, high-vol and low-vol follow the written definitions', () => {
  const r = rng(21), nz = (k) => (r() - 0.5) * 2 * k, mk = (c, wick = 0.2) => barsFrom(c, { wick, seed: 5 });
  let c = [], x = 2000;
  for (let i = 0; i < 150; i++) { x += 0.5 + nz(0.5); c.push(x); }
  const tr = MXA.regime(mk(c)); assert.equal(tr.label, 'trending'); assert.equal(tr.trend, 'up'); assert.ok(tr.detail.ts >= MXA.REGIME_DEF.trendTs && tr.detail.er >= MXA.REGIME_DEF.trendEr);
  c = []; x = 0; for (let i = 0; i < 150; i++) { x = 0.3 * x + nz(1); c.push(2000 + x); }
  const rg = MXA.regime(mk(c)); assert.equal(rg.label, 'ranging'); assert.equal(rg.trend, 'flat');
  const bo = MXA.regime(mk(c.concat([c.at(-1) + 2.5, c.at(-1) + 5]))); assert.equal(bo.label, 'breakout'); assert.equal(bo.trend, 'up');
  c = []; x = 2000; for (let i = 0; i < 120; i++) { x += 0.5 + nz(0.5); c.push(x); } for (let i = 0; i < 6; i++) { x -= 1.5 + nz(0.2); c.push(x); }
  const rv = MXA.regime(mk(c)); assert.equal(rv.label, 'reversal'); assert.equal(rv.trend, 'down');
  c = []; x = 0; for (let i = 0; i < 150; i++) { x = 0.3 * x + nz(i >= 140 ? 6 : 1); c.push(2000 + x); }
  const hv = MXA.regime(mk(c)); assert.equal(hv.label, 'high-vol'); assert.equal(hv.vol, 'high'); assert.ok(hv.detail.volRatio >= MXA.REGIME_DEF.highVolRatio);
  c = []; x = 0; for (let i = 0; i < 150; i++) { x = 0.3 * x + nz(i >= 110 ? Math.pow(0.93, i - 110) : 1); c.push(2000 + x); }      // volatility dies away to the last bar
  const lv = MXA.regime(mk(c, 0.02)); assert.equal(lv.label, 'low-vol'); assert.equal(lv.vol, 'low');
  assert.equal(MXA.regime(mk(c).slice(0, 30)).label, null, 'too few bars: no label, never a guess');
  for (const k of MXA.REGIME_DEF.order.concat('event')) assert.ok(MXA.REGIME_DEF.text[k], k);
});

test('a volatility spike is flagged in the features and stops the decision (abnormal volatility)', () => {
  const m15 = UP['15m'].filter((b) => b.time < at(66)), r = rng(9); let t = at(66), px = m15.at(-1).close;
  for (let i = 0; i < 10; i++) { const c = px + (r() - 0.5) * 12; m15.push({ time: t, open: px, high: Math.max(px, c) + 2, low: Math.min(px, c) - 2, close: c }); px = c; t += 900; }
  const s = snapAt(series(m15), t); s.cand = candOf(s, 'buy');
  const f = MXA.features(s), d = MXA.decide(s, {});
  assert.equal(f.volState, 'high'); assert.equal(f.volAbnormal, true); assert.equal(f.regime, 'high-vol'); assert.ok(f.volRatio >= 2);
  assert.equal(d.action, 'WAIT'); assert.ok(d.uncertainty.some((u) => /abnormal volatility/.test(u)));
  assert.equal(d.confidence, 'low');
});

// ---- no look-ahead ---------------------------------------------------------------------------------------------------
test('assertNoFuture: a planted future bar, a late event, a result on the schedule or an outcome on the candidate all throw', () => {
  const s = withCand(UP, 66.55, 'buy');
  assert.equal(MXA.assertNoFuture(s), true);
  const fut = (tf) => { const c = structuredClone(s), last = c.bars[tf].at(-1); c.bars[tf].push(Object.assign({}, last, { time: last.time + TF[tf] })); return c; };
  for (const tf of ['15m', '1h', '4h', '1d']) assert.throws(() => MXA.assertNoFuture(fut(tf)), /after the decision time/, tf);
  assert.throws(() => MXA.decide(fut('15m'), {}), /after the decision time/, 'decide refuses a snapshot that holds the future');
  assert.throws(() => MXA.features && MXA.thesis.start(fut('1h')), /after the decision time/);
  // a bar still forming at t (opened before t, closes after it) is the future too
  const forming = structuredClone(s); forming.bars['1h'].push(Object.assign({}, forming.bars['1h'].at(-1), { time: s.t - 900 }));
  assert.throws(() => MXA.assertNoFuture(forming), /after the decision time/);
  const dx = structuredClone(s); dx.inter = { dxy: { '1h': [{ time: s.t, open: 1, high: 1, low: 1, close: 1 }] } };
  assert.throws(() => MXA.assertNoFuture(dx), /inter\.dxy/);
  assert.throws(() => MXA.assertNoFuture(Object.assign({}, s, { events: [{ t: s.t + 60, title: 'CPI', impact: 'high' }] })), /later than the decision time/);
  assert.throws(() => MXA.assertNoFuture(Object.assign({}, s, { events: [{ title: 'CPI', impact: 'high' }] })), /without a time/);
  assert.equal(MXA.assertNoFuture(Object.assign({}, s, { events: [{ t: s.t, title: 'CPI', impact: 'high', actual: 3.1 }] })), true, 'a release at or before t may carry its result');
  assert.equal(MXA.assertNoFuture(Object.assign({}, s, { schedule: [{ t: s.t + 3600, title: 'CPI', impact: 'high' }] })), true, 'the public schedule may be later than t');
  assert.throws(() => MXA.assertNoFuture(Object.assign({}, s, { schedule: [{ t: s.t + 3600, title: 'CPI', impact: 'high', actual: 3.1 }] })), /only t, title and impact/);
  assert.throws(() => MXA.assertNoFuture(Object.assign({}, s, { schedule: [{ t: s.t + 3600, title: 'CPI', impact: 'high', forecast: 3 }] })), /only t, title and impact/);
  assert.throws(() => MXA.assertNoFuture(Object.assign({}, s, { cand: Object.assign({}, s.cand, { netR: 1.2 }) })), /outcome field/);
  assert.throws(() => MXA.assertNoFuture(Object.assign({}, s, { cand: Object.assign({}, s.cand, { t: s.t + 1 }) })), /candidate is dated/);
  assert.throws(() => MXA.assertNoFuture(Object.assign({}, s, { bars: Object.assign({}, s.bars, { '7m': [] }) })), /unknown timeframe/);
  assert.throws(() => MXA.assertNoFuture({ bars: {} }), /snapshot\.t/);
});

test('decide ignores everything after t: the same decision whatever the future holds', () => {
  const t = at(66.55), cut = UP['15m'].filter((b) => b.time + 900 <= t);
  const futureOf = (seed, drift) => { const r = rng(seed), c = []; let x = cut.at(-1).close; for (let i = 0; i < 96 * 3; i++) { x += drift + (r() - 0.5) * 3; c.push(x); } return barsFrom(c, { t0: t, seed }); };
  const crash = series(cut.concat(futureOf(1, -1.5))), moon = series(cut.concat(futureOf(2, +1.5)));
  const mk = (ser) => { const s = snapAt(ser, t); s.cand = candOf(s, 'buy', { id: 'same' }); return s; };
  const a = MXA.decide(mk(UP), {}), b = MXA.decide(mk(crash), {}), c = MXA.decide(mk(moon), {});
  assert.deepEqual(b, a); assert.deepEqual(c, a);
  // future bars or outcomes handed in through the options are never read
  const d = MXA.decide(mk(UP), { futureBars: futureOf(3, -2), outcome: { netR: -1 }, outcomes: [{ netR: 5 }] });
  assert.deepEqual(d, a);
  // and the counterfactual walker is not reachable from the decision path
  for (const fn of [MXA.decide, MXA.features, MXA.thesis.update, MXA.lessons.retrieve]) assert.ok(!/simulate|simOne/.test(fn.toString()));
  // the walker itself gives different answers for the two futures (so the equality above is not vacuous)
  const alt = [{ label: 'x', side: 'buy', entry: null, stop: cut.at(-1).close - 5, target: cut.at(-1).close + 10 }];
  assert.notEqual(MXA.simulate(alt, crash['15m'].filter((q) => q.time >= t), {})[0].reason, MXA.simulate(alt, moon['15m'].filter((q) => q.time >= t), {})[0].reason);
});

test('decide: only history that was finished before t is counted', () => {
  const { s, f } = find('buy', (d) => d.action === 'BUY');
  const lite = MXA.lite(f), past = [], fut = [];
  for (let i = 0; i < 40; i++) past.push({ t: s.t - (i + 1) * 3600, features: lite, netR: i % 2 ? 1 : -0.5 });
  for (let i = 0; i < 10; i++) fut.push({ t: s.t + i * 60, features: lite, netR: 100 });                       // dated at or after t
  const open = [{ t: s.t - 7200, exitT: s.t + 3600, features: lite, netR: 100 }];                           // fired before t, but its result came after
  const a = MXA.decide(s, { history: past }), b = MXA.decide(s, { history: past.concat(fut, open) });
  assert.deepEqual(b, a);
  assert.equal(a.similar.n, 40); assert.equal(a.similar.winRate, 0.5); assert.equal(a.similar.avgR, 0.25); assert.match(a.similar.note, /40 similar past cases/);
  assert.ok(factors(a.supporting).includes('similar'));
  const few = MXA.decide(s, { history: past.slice(0, 7) });
  assert.equal(few.similar.n, 7); assert.match(few.similar.note, /too few to rely on/); assert.ok(!factors(few.supporting).includes('similar'));
  assert.match(MXA.decide(s, {}).similar.note, /no history/);
  const undated = MXA.decide(s, { history: past.map((h) => ({ features: h.features, netR: h.netR })) });
  assert.equal(undated.similar.n, 0); assert.ok(undated.notes.some((n) => /40 history entries have no time/.test(n)), 'entries that cannot be dated are refused out loud');
});

test('decide: an unfamiliar regime (the edge has a record, but almost none of it in this regime) is a stated uncertainty', () => {
  const { s, f } = find('buy', (d) => d.action === 'BUY');
  const other = Object.assign(MXA.lite(f), { regime: f.regime === 'low-vol' ? 'trending' : 'low-vol' }), hist = [];
  for (let i = 0; i < 40; i++) hist.push({ t: s.t - (i + 1) * 3600, features: other, netR: 0.3 });
  const d = MXA.decide(s, { history: hist });
  assert.equal(d.action, 'WAIT'); assert.ok(d.uncertainty.some((u) => /unfamiliar regime/.test(u))); assert.equal(d.confidence, 'low');
  assert.ok(d.gates.some((g) => g.code === 'unfamiliar' && g.hard));
});

// ---- the decision ----------------------------------------------------------------------------------------------------
test('decide is deterministic: the same snapshot and options give a deep-equal decision and the same featuresHash', () => {
  const s = withCand(UP, 66.55, 'buy'), o = { history: [{ t: s.t - 100, features: { regime: 'ranging', session: 'overlap', biasAlign: 'with' }, netR: 1 }] };
  const a = MXA.decide(s, o), b = MXA.decide(structuredClone(s), structuredClone(o));
  assert.deepEqual(a, b); assert.equal(a.featuresHash, b.featuresHash); assert.match(a.featuresHash, /^[0-9a-f]{16}$/); assert.equal(a.id, b.id);
  // key order of the snapshot does not matter, and a different snapshot hashes differently
  const shuffled = { dataVersion: s.dataVersion, cand: s.cand, bars: { '1d': s.bars['1d'], '4h': s.bars['4h'], '1h': s.bars['1h'], '15m': s.bars['15m'] }, t: s.t, market: s.market, edge: s.edge, v: 1 };
  assert.deepEqual(MXA.decide(shuffled, o), a);
  assert.notEqual(MXA.decide(withCand(UP, 66.6, 'buy'), o).featuresHash, a.featuresHash);
  assert.equal(MXA.hash({ b: 1, a: [1, { d: 2, c: 3 }] }), MXA.hash({ a: [1, { c: 3, d: 2 }], b: 1 }));
});

test('decide: a clean candidate with the trend is taken, with evidence, versions and invalidation', () => {
  const { s, d } = find('buy', (x, f) => x.action === 'BUY' && f.confirm === 'strong');
  assert.equal(d.action, 'BUY'); assert.equal(d.entry, s.cand.entry); assert.equal(d.stop, s.cand.stop); assert.equal(d.target, s.cand.target); assert.equal(d.candidateId, s.cand.id);
  assert.ok(factors(d.supporting).includes('htfBias') && factors(d.supporting).includes('confirmation'));
  for (const item of d.supporting.concat(d.contradicting)) { assert.ok(item.factor && item.text.length > 10 && item.weight > 0); }
  assert.ok(d.evidence.margin >= d.evidence.needMargin && d.evidence.support >= d.evidence.needSupport);
  assert.equal(d.policyVersion, MXA.POLICY_VERSION); assert.equal(d.edgeVersion, 'ev1'); assert.equal(d.dataVersion, 'synthetic-1'); assert.equal(d.modelVersion, null); assert.equal(d.modelScore, null);
  assert.ok(d.invalidation.length >= 2 && /stop/.test(d.invalidation[0]));
  assert.ok(['low', 'medium', 'high'].includes(d.confidence)); assert.equal(d.confidence, 'low', 'no history: the engine does not claim more than low confidence');
  assert.equal(d.risk.allowed, null, 'the risk engine was not consulted'); assert.ok(Math.abs(d.risk.rr - 3.5 / 1.5) < 0.01);
  assert.deepEqual(d.uncertainty, []); assert.deepEqual(d.waitReasons, []); assert.deepEqual(d.lessonsApplied, []);
  assert.match(d.thesis, /^BUY/);
});

test('decide: a technically valid candidate can be rejected (WAIT) with its reasons', () => {
  const { s, d, f } = find('sell', (x) => x.action === 'WAIT' && x.uncertainty.length === 0);
  assert.equal(f.geomOk, true, 'the candidate itself is valid'); assert.equal(f.biasAlign, 'against');
  assert.equal(d.action, 'WAIT'); assert.ok(d.waitReasons.length >= 2); assert.match(d.waitReasons[0], /does not beat the evidence against/);
  assert.ok(d.waitReasons.some((r) => /against the higher timeframes/.test(r)));
  assert.ok(factors(d.contradicting).includes('htfBias')); assert.ok(d.evidence.contradiction > d.evidence.support);
  assert.equal(d.entry, s.cand.entry, 'the rejected levels stay on the decision so the mentor can see what was refused');
  assert.ok(d.waitingFor.length >= 1); assert.match(d.thesis, /^WAIT on the sell candidate/);
});

test('decide: per-edge relevance: a trend edge is not penalised for a premium entry, a reversal edge is', () => {
  for (const id of ['replica', 'mosha-bo', 'gtrend', 'gtl', 'geg', 'gmp', 'nq-open']) { const p = MXA.EDGE_PROFILE[id]; assert.ok(p && p.name && p.kind && TF[p.tf] && p.waitFor, id); }
  assert.deepEqual(MXA.EDGE_PROFILE.gtrend.w.location, [0, 0]); assert.ok(MXA.EDGE_PROFILE.replica.w.location[1] > 0);
  const hit = find('buy', (d, f) => f.locFor === 'poor', { edge: 'replica' });
  assert.ok(factors(hit.d.contradicting).includes('location'));
  const asTrend = Object.assign({}, hit.s, { edge: 'gtrend', cand: Object.assign({}, hit.s.cand, { edge: 'gtrend' }) });
  assert.equal(MXA.features(asTrend).locFor, 'poor'); assert.ok(!factors(MXA.decide(asTrend, {}).contradicting).includes('location'));
  // an unknown edge falls back to the default profile and still decides
  assert.ok(['BUY', 'WAIT'].includes(MXA.decide(Object.assign({}, hit.s, { edge: 'something-new' }), {}).action));
});

test('decide: no candidate means WAIT with the running thesis (bias and what it is waiting for)', () => {
  const s = snapAt(UP, at(66), { edge: 'gtrend' }), d = MXA.decide(s, {});
  assert.equal(d.action, 'WAIT'); assert.equal(d.candidateId, null); assert.equal(d.entry, null); assert.equal(d.stop, null);
  assert.match(d.thesis, /Bias up/); assert.match(d.thesis, /Waiting for a long setup from Gold trend/);
  assert.match(d.waitReasons[0], /no candidate/); assert.ok(d.waitingFor.length === 1); assert.ok(d.invalidation.some((x) => /swing low/.test(x)));
  assert.deepEqual(d.supporting, []); assert.deepEqual(d.lessonsApplied, []);
});

test('decide: missing data means WAIT with the uncertainty named, and the features stay null', () => {
  const s = withCand(UP, 66.55, 'buy'), noD1 = Object.assign({}, s, { bars: { '15m': s.bars['15m'], '1h': s.bars['1h'], '4h': s.bars['4h'] } });
  const f = MXA.features(noD1), d = MXA.decide(noD1, {});
  assert.equal(f.barsOk, false); assert.equal(f.missingTf, '1d'); assert.equal(f.structD1, null); assert.equal(f.pdh, null); assert.equal(f.maPosD1, null);
  assert.equal(d.action, 'WAIT'); assert.ok(d.uncertainty.some((u) => /missing data: 1d/.test(u))); assert.equal(d.confidence, 'low');
  const short = Object.assign({}, s, { bars: Object.assign({}, s.bars, { '15m': s.bars['15m'].slice(-20) }) }), d2 = MXA.decide(short, {});
  assert.equal(MXA.features(short).atr, null); assert.equal(d2.action, 'WAIT'); assert.ok(d2.uncertainty.some((u) => /missing data: 15m/.test(u)));
  const d3 = MXA.decide(Object.assign({}, s, { cand: null, bars: {} }), {}); assert.equal(d3.action, 'WAIT'); assert.ok(d3.uncertainty.length > 0);
});

test('decide: a candidate without a stop, or with the stop on the wrong side, is never taken', () => {
  const { s } = find('buy', (d) => d.action === 'BUY');
  const noStop = MXA.decide(Object.assign({}, s, { cand: Object.assign({}, s.cand, { stop: null }) }), {});
  assert.equal(noStop.action, 'WAIT'); assert.ok(noStop.uncertainty.some((u) => /never a trade without a stop/.test(u)));
  const wrong = MXA.decide(Object.assign({}, s, { cand: Object.assign({}, s.cand, { stop: s.cand.entry + 5 }) }), {});
  assert.equal(wrong.action, 'WAIT'); assert.ok(wrong.uncertainty.some((u) => /wrong side/.test(u)));
  // a TAKE lesson cannot override it
  const L = { id: 'L-take', edge: '*', version: 1, active: true, title: 'take', text: '', when: [{ f: 'session', op: 'in', v: ['asia', 'london', 'overlap', 'newyork', 'late'] }], then: { action: 'TAKE', adjust: {}, note: '' } };
  const forced = MXA.decide(Object.assign({}, s, { cand: Object.assign({}, s.cand, { stop: null }) }), { lessons: [L] });
  assert.equal(forced.action, 'WAIT'); assert.equal(forced.lessonsApplied[0].applied, false);
});

test('decide: reward to risk below 1 after costs is refused', () => {
  const { s } = find('buy', (d) => d.action === 'BUY');
  const thin = Object.assign({}, s, { cand: Object.assign({}, s.cand, { target: s.cand.entry + 1.1 * (s.cand.entry - s.cand.stop) }) });
  assert.notEqual(MXA.decide(thin, {}).uncertainty.some((u) => /reward to risk after costs/.test(u)), true, 'gross 1.1 passes the gate');
  const d = MXA.decide(thin, { edgeDef: { version: 'e9', cost: 0.2 * (s.cand.entry - s.cand.stop) } });
  assert.equal(d.action, 'WAIT'); assert.ok(d.uncertainty.some((u) => /reward to risk after costs is 0\.75/.test(u)));
  assert.equal(d.risk.rrNet, 0.75);
  // a plain "take it" lesson cannot pass it, but a lesson that moves the target far enough is judged on the new levels
  const when = [{ f: 'biasAlign', op: 'eq', v: 'with' }], edgeDef = { version: 'e9', cost: 0.2 * (s.cand.entry - s.cand.stop) };
  const plain = { id: 'L-p', edge: 'test', version: 1, active: true, title: 'take', text: '', when, then: { action: 'TAKE', adjust: {}, note: '' } };
  const p = MXA.decide(thin, { edgeDef, lessons: [plain] }); assert.equal(p.action, 'WAIT'); assert.ok(p.gates.some((g) => g.code === 'rr' && g.hard));
  const far = Object.assign({}, plain, { id: 'L-f', then: { action: 'TAKE', adjust: { target: { ref: 'entry', k: 3, unit: 'r' } }, note: '' } });
  const q = MXA.decide(thin, { edgeDef, lessons: [far] }); assert.equal(q.action, 'BUY'); assert.equal(q.risk.rr, 3); assert.ok(!q.gates.some((g) => g.code === 'rr')); assert.deepEqual(q.uncertainty, []);
});

test('decide: an event near is a stated uncertainty; a mentor lesson passes it only when it names the event', () => {
  const base = find('buy', (d) => d.action === 'BUY'), s = Object.assign({}, base.s, { schedule: [{ t: base.s.t + 2 * 3600, title: 'US CPI', impact: 'high' }] });
  const d1 = MXA.decide(s, {}), f = MXA.features(s);
  assert.equal(d1.action, 'WAIT'); assert.ok(d1.uncertainty.some((u) => /event risk: US CPI in 120 min/.test(u)));
  const blind = { id: 'L-blind', edge: 'test', version: 1, active: true, title: 'take with the trend', text: '', when: [{ f: 'biasAlign', op: 'eq', v: 'with' }], then: { action: 'TAKE', adjust: {}, note: '' } };
  const d2 = MXA.decide(s, { lessons: [blind] });
  assert.equal(d2.action, 'WAIT'); assert.equal(d2.lessonsApplied[0].applied, false); assert.match(d2.lessonsApplied[0].effect, /blocked by event/);
  // the mentor says: take it even with the release coming -> the draft names eventNear, and the same snapshot is then taken
  const k = correction({ id: 'k-news', verdict: 'change', action: 'BUY', reasons: ['news'], text: 'CPI in two hours does not matter for this one.' });
  const L = MXA.lessons.fromCorrection(d1, k, f);
  assert.ok(L.when.some((c) => c.f === 'eventNear' && c.op === 'eq' && c.v === true)); assert.equal(L.then.action, 'TAKE'); assert.deepEqual(MXA.lessons.validate(L), []);
  const d3 = MXA.decide(s, { lessons: [L] });
  assert.equal(d3.action, 'BUY'); assert.ok(d3.uncertainty.some((u) => /event risk/.test(u) && /taken anyway on lesson/.test(u)), 'the uncertainty stays on the record');
  assert.equal(d3.confidence, 'low'); assert.equal(MXA.compare(attempt(1, d1), attempt(2, d3), k).verdict, 'learned');
});

test('decide: a risk-engine block forces WAIT and copies the blocks; no lesson overrides it', () => {
  const { s, d } = find('buy', (x) => x.action === 'BUY');
  const risk = { allowed: false, blocks: ['daily loss limit reached', 'max open risk'], size: 0, riskPct: 0.25 };
  const r = MXA.decide(s, { risk });
  assert.equal(r.action, 'WAIT'); assert.equal(r.risk.allowed, false); assert.deepEqual(r.risk.blocks, risk.blocks); assert.equal(r.risk.riskPct, 0.25);
  assert.match(r.waitReasons[0], /risk engine: daily loss limit reached; max open risk/);
  const ok = MXA.decide(s, { risk: { allowed: true, blocks: [], size: 1, riskPct: 0.25 } });
  assert.equal(ok.action, 'BUY'); assert.equal(ok.risk.allowed, true); assert.deepEqual(ok.supporting, d.supporting);
  const L = { id: 'L-take', edge: 'test', version: 1, active: true, title: 'take', text: '', when: [{ f: 'biasAlign', op: 'eq', v: 'with' }], then: { action: 'TAKE', adjust: {}, note: '' } };
  assert.equal(MXA.decide(s, { risk, lessons: [L] }).action, 'WAIT');
});

test('decide: MANAGE advice holds, tightens or exits, and never loosens a stop', () => {
  const s = snapAt(UP, at(66.55)), f = MXA.features(s), px = f.lastClose, a = f.atr;
  // 1.5 R in profit: stop to breakeven
  const won = MXA.decide(s, { position: { id: 'p1', side: 'buy', entry: px - 3 * a, stop: px - 5 * a, target: px + 4 * a } });
  assert.equal(won.action, 'MANAGE'); assert.equal(won.manage.advice, 'tighten'); assert.ok(won.stop >= px - 3 * a - 1e-6); assert.ok(won.stop < px); assert.match(won.manage.reasons[0], /breakeven/);
  // nothing to do: hold, the stop is untouched
  const flat = MXA.decide(s, { position: { side: 'buy', entry: px - 0.2 * a, stop: px - 2 * a, target: px + 4 * a } });
  assert.equal(flat.manage.advice, 'hold'); assert.equal(flat.stop, px - 2 * a);
  // price through the stop, or no stop at all: exit
  assert.equal(MXA.decide(s, { position: { side: 'buy', entry: px + 3 * a, stop: px + a } }).manage.advice, 'exit');
  const naked = MXA.decide(s, { position: { side: 'sell', entry: px, stop: null } }); assert.equal(naked.manage.advice, 'exit'); assert.match(naked.manage.reasons[0], /without a stop/);
  // property: over many decision points and both sides, the advised stop is never further from price than the stop given
  for (let day = 56; day < 69.5; day += 0.35) {
    const sn = snapAt(UP, at(day)), g = MXA.features(sn), p = g.lastClose, r = g.atr;
    for (const k of [0.3, 1.2, 2.5, 4]) {
      const long = MXA.decide(sn, { position: { side: 'buy', entry: p - k * r, stop: p - (k + 1) * r, initialStop: p - (k + 2) * r } });
      const short = MXA.decide(sn, { position: { side: 'sell', entry: p + k * r, stop: p + (k + 1) * r, initialStop: p + (k + 2) * r } });
      assert.ok(long.stop >= p - (k + 1) * r, `long stop loosened on day ${day}`); assert.ok(long.stop < p);
      assert.ok(short.stop <= p + (k + 1) * r, `short stop loosened on day ${day}`); assert.ok(short.stop > p);
    }
  }
});

// ---- lessons: the Replay & Prove core ---------------------------------------------------------------------------------
test('Replay & Prove: BUY corrected to WAIT becomes a lesson; the same snapshot then waits, lists the lesson, and compare says learned', () => {
  const { s, d: d1, f } = find('buy', (x, g) => x.action === 'BUY' && g.confirm === 'weak' && g.dispFor === 'none');
  const k = correction({ id: 'k-conf', attemptId: 'a1', at: s.t + 60, verdict: 'change', action: 'WAIT', reasons: ['missing-confirmation'], text: 'The trigger candle closed in the middle of its range. Wait for a body close.' });
  const L = MXA.lessons.fromCorrection(d1, k, f);
  assert.deepEqual(MXA.lessons.validate(L), []); assert.equal(L.edge, 'test'); assert.equal(L.version, 1); assert.equal(L.active, true);
  assert.equal(L.text, k.text, 'the mentor\'s words are kept'); assert.equal(L.then.action, 'WAIT');
  assert.deepEqual(L.when, [{ f: 'confirm', op: 'eq', v: 'weak' }, { f: 'dispFor', op: 'eq', v: 'none' }]);
  assert.deepEqual(L.source, { attemptId: 'a1', correctionId: 'k-conf', candidateId: d1.candidateId, sessionId: null });
  assert.equal(MXA.lessons.matches(L, f), true);
  // the SAME snapshot, decided again with the lesson
  const d2 = MXA.decide(s, { lessons: [L] });
  assert.equal(d2.action, 'WAIT'); assert.equal(d2.featuresHash, d1.featuresHash);
  assert.equal(d2.lessonsApplied.length, 1); assert.equal(d2.lessonsApplied[0].id, L.id); assert.equal(d2.lessonsApplied[0].version, 1); assert.equal(d2.lessonsApplied[0].applied, true);
  assert.match(d2.lessonsApplied[0].effect, /changed BUY to WAIT/); assert.match(d2.waitReasons[0], /^lesson /);
  assert.deepEqual(d2.supporting, d1.supporting, 'the evidence is the same: only the lesson changed the answer');
  const cmp = MXA.compare(attempt(1, d1), attempt(2, d2), k);
  assert.equal(cmp.verdict, 'learned'); assert.equal(cmp.lessonApplied, true); assert.deepEqual(cmp.lessonIds, [L.id]);
  assert.deepEqual(cmp.matchesCorrection, { action: true, entry: null, stop: null, target: null });
  assert.deepEqual(cmp.changed.find((c) => c.field === 'action'), { field: 'action', from: 'BUY', to: 'WAIT' });
  // without the lesson the replay does not change: not-learned
  assert.equal(MXA.compare(attempt(1, d1), attempt(2, MXA.decide(s, {})), k).verdict, 'not-learned');
  // a snapshot the lesson does not describe is unaffected
  const other = find('buy', (x, g) => x.action === 'BUY' && g.confirm === 'strong');
  assert.equal(MXA.lessons.matches(L, other.f), false); assert.deepEqual(MXA.decide(other.s, { lessons: [L] }), other.d);
  // and so is another edge
  const otherEdge = Object.assign({}, s, { edge: 'mosha-bo' }); assert.deepEqual(MXA.decide(otherEdge, { lessons: [L] }).lessonsApplied, []);
});

test('Replay & Prove: WAIT corrected to BUY with a better stop and target; the replay takes it at the mentor\'s levels', () => {
  const { s, d: d1, f } = find('buy', (x, g) => x.action === 'WAIT' && x.uncertainty.length === 0 && g.biasAlign === 'with' && g.nearSup !== null && g.nearSup < g.lastClose - 0.3 * g.atr);
  const stop = f.nearSup - 0.3 * f.atr, entry = s.cand.entry, target = entry + 2.5 * (entry - stop);
  const k = correction({ id: 'k-take', attemptId: 'a1', verdict: 'change', action: 'BUY', stop, target, reasons: ['htf-bias'], text: 'With the daily trend this is a buy. Stop under the last swing low, 2.5 R target.' });
  const L = MXA.lessons.fromCorrection(d1, k, f);
  assert.deepEqual(MXA.lessons.validate(L), []); assert.equal(L.then.action, 'TAKE');
  assert.deepEqual(L.when.map((c) => c.f), ['biasAlign', 'htfLtfConflict']);
  // the levels are stored as RULES relative to features, never as raw prices
  assert.equal(L.then.adjust.stop.ref, 'levelBehind'); assert.equal(L.then.adjust.stop.unit, 'atr'); assert.ok(Math.abs(L.then.adjust.stop.k + 0.3) < 1e-3);
  assert.ok(MXA.ADJUST_REFS.includes(L.then.adjust.target.ref)); assert.equal(L.then.adjust.entry, undefined, 'the entry was not changed');
  for (const r of Object.values(L.then.adjust)) assert.deepEqual(Object.keys(r).sort(), ['k', 'ref', 'text', 'unit']);
  assert.ok(!JSON.stringify(L.then).includes(String(Math.round(stop))), 'no raw price in the rule');
  const d2 = MXA.decide(s, { lessons: [L] });
  assert.equal(d2.action, 'BUY'); assert.ok(Math.abs(d2.stop - stop) < 1e-3); assert.ok(Math.abs(d2.target - target) < 1e-3); assert.equal(d2.entry, entry);
  assert.equal(d2.lessonsApplied[0].applied, true); assert.match(d2.lessonsApplied[0].effect, /TAKE: changed WAIT to BUY/); assert.match(d2.lessonsApplied[0].effect, /stop .* to /);
  assert.ok(Math.abs(d2.risk.rr - 2.5) < 0.01); assert.match(d2.thesis, /on the mentor's lesson/);
  const cmp = MXA.compare(attempt(1, d1), attempt(2, d2), k);
  assert.equal(cmp.verdict, 'learned'); assert.deepEqual(cmp.matchesCorrection, { action: true, entry: null, stop: true, target: true });
  assert.ok(cmp.changed.some((c) => c.field === 'stop') && cmp.changed.some((c) => c.field === 'target'));
  // the rule travels: on another matching snapshot the stop is again 0.3 ATR behind THAT snapshot's level, not the old price
  const next = find('buy', (x, g) => g.biasAlign === 'with' && g.htfLtfConflict === false && g.nearSup !== null && x.uncertainty.length === 0 && Math.abs(g.lastClose - f.lastClose) > 3, { from: 56 });
  const d3 = MXA.decide(next.s, { lessons: [L] });
  assert.equal(d3.action, 'BUY'); assert.ok(Math.abs(d3.stop - (next.f.nearSup - 0.3 * next.f.atr)) < 1e-3); assert.ok(Math.abs(d3.stop - stop) > 1);
  // a half-learned replay: right action, wrong stop
  const half = Object.assign({}, d2, { stop: stop - 3 * (entry - stop) });
  const c2 = MXA.compare(attempt(1, d1), attempt(2, half), k); assert.equal(c2.verdict, 'partly'); assert.equal(c2.matchesCorrection.stop, false);
});

test('lessons: FLIP takes the other side with the stop mirrored; a rule that would break the geometry is refused', () => {
  const { s, f } = find('sell', (x, g) => x.action === 'WAIT' && x.uncertainty.length === 0 && g.biasAlign === 'against');
  const d1 = MXA.decide(s, {}), k = correction({ id: 'k-flip', verdict: 'change', action: 'BUY', reasons: ['htf-bias'], text: 'Wrong side: this is a buy.' });
  const L = MXA.lessons.fromCorrection(d1, k, f); assert.equal(L.then.action, 'FLIP');
  const d2 = MXA.decide(s, { lessons: [L] }), e = s.cand.entry;
  assert.equal(d2.action, 'BUY'); assert.equal(d2.side, 'buy'); assert.ok(d2.stop < e && d2.target > e); assert.ok(Math.abs((e - d2.stop) - (s.cand.stop - e)) < 1e-6);
  assert.equal(MXA.compare(attempt(1, d1), attempt(2, d2), k).verdict, 'learned');
  assert.equal(MXA.classifyError(Object.assign({}, d1, { action: 'SELL' }), k), 'incorrect-bias');
  const bad = Object.assign({}, L, { id: 'L-bad', then: { action: 'TAKE', adjust: { stop: { ref: 'entry', k: -2, unit: 'atr' } }, note: '' }, when: [{ f: 'biasAlign', op: 'eq', v: 'against' }] });
  const ok = MXA.decide(s, { lessons: [bad] }); assert.equal(ok.action, 'SELL'); assert.ok(ok.stop > e, 'k is measured in the trade direction: -2 ATR is behind a sell, above the entry');
  const wrong = Object.assign({}, bad, { then: { action: 'TAKE', adjust: { stop: { ref: 'entry', k: 2, unit: 'atr' } }, note: '' } });
  const kept = MXA.decide(s, { lessons: [wrong] }); assert.equal(kept.stop, s.cand.stop); assert.match(kept.lessonsApplied[0].effect, /stop rule rejected/);
});

test('lessons: two matching lessons that demand opposite actions are not resolved silently: WAIT, with the conflict named', () => {
  const { s, d } = find('buy', (x) => x.action === 'BUY');
  const A = { id: 'L-A', edge: 'test', version: 1, active: true, title: 'stand aside', text: '', updatedAt: 1, when: [{ f: 'biasAlign', op: 'eq', v: 'with' }, { f: 'side', op: 'eq', v: 'buy' }], then: { action: 'WAIT', adjust: {}, note: 'wait' } };
  const B = { id: 'L-B', edge: '*', version: 1, active: true, title: 'always take', text: '', updatedAt: 2, when: [{ f: 'side', op: 'eq', v: 'buy' }], then: { action: 'TAKE', adjust: {}, note: 'take' } };
  const ret = MXA.lessons.retrieve([B, A], MXA.features(s), 'test');
  assert.deepEqual(ret.matched.map((l) => l.id), ['L-A', 'L-B'], 'more conditions first'); assert.equal(ret.conflicts.length, 1); assert.equal(ret.conflicts[0].a, 'L-A'); assert.equal(ret.conflicts[0].b, 'L-B');
  const c = MXA.decide(s, { lessons: [B, A] });
  assert.equal(d.action, 'BUY'); assert.equal(c.action, 'WAIT');
  assert.ok(c.uncertainty.includes('conflicting lessons: L-A vs L-B')); assert.match(c.waitReasons[0], /conflicting lessons: L-A vs L-B/);
  assert.deepEqual(c.lessonsApplied.map((l) => [l.id, l.applied]), [['L-A', false], ['L-B', false]]); assert.match(c.lessonsApplied[0].effect, /conflicts with lesson L-B/);
  assert.equal(c.confidence, 'low');
  // WAIT and SKIP agree with each other (SKIP = refused), and each alone simply applies
  const S = Object.assign({}, B, { id: 'L-S', then: { action: 'SKIP', adjust: {}, note: 'never this' } });
  const both = MXA.decide(s, { lessons: [A, S] }); assert.equal(both.action, 'WAIT'); assert.equal(both.refused, true); assert.deepEqual(both.uncertainty, []); assert.equal(both.lessonsApplied.length, 2);
  assert.equal(MXA.decide(s, { lessons: [B] }).action, 'BUY'); assert.match(MXA.decide(s, { lessons: [B] }).lessonsApplied[0].effect, /agrees with the policy/);
});

test('lessons: revise makes version 2 and only the newest version counts; deactivate removes the effect', () => {
  const { s, d, f } = find('buy', (x) => x.action === 'BUY');
  const v1 = { id: 'L-1', edge: 'test', version: 1, active: true, title: 'wait in this session', text: 'first wording', createdAt: 10, updatedAt: 10, when: [{ f: 'session', op: 'eq', v: f.session }], then: { action: 'WAIT', adjust: {}, note: 'not this session' }, source: {}, supersedes: null, stats: { applied: 3 } };
  const frozen = structuredClone(v1);
  assert.equal(MXA.decide(s, { lessons: [v1] }).action, 'WAIT');
  // version 2 narrows the lesson so it no longer describes this snapshot
  const v2 = MXA.lessons.revise(v1, { text: 'second wording', when: [{ f: 'session', op: 'eq', v: f.session }, { f: 'confirm', op: 'eq', v: 'no-such-value' }] }, 20);
  assert.equal(v2.version, 2); assert.equal(v2.id, 'L-1'); assert.equal(v2.supersedes, 'L-1'); assert.equal(v2.updatedAt, 20); assert.equal(v2.createdAt, 10); assert.equal(v2.active, true); assert.equal(v2.stats.applied, 0);
  assert.deepEqual(v1, frozen, 'the old version is kept untouched');
  assert.deepEqual(MXA.decide(s, { lessons: [v1, v2] }), d, 'version 1 is superseded: it must not fire');
  assert.deepEqual(MXA.decide(s, { lessons: [v2, v1] }), d, 'whatever the order of the list');
  // a version 2 that still matches is the one applied
  const v2b = MXA.lessons.revise(v1, { title: 'wait in this session (reworded)' }, 21), w = MXA.decide(s, { lessons: [v1, v2b] });
  assert.equal(w.action, 'WAIT'); assert.deepEqual(w.lessonsApplied.map((l) => [l.id, l.version]), [['L-1', 2]]);
  assert.deepEqual(MXA.lessons.retrieve([v1, v2b], f, 'test').matched, [v2b]);
  // deactivate: the effect is gone, and the older version does not come back
  const off = MXA.lessons.deactivate(v2b, 30); assert.equal(off.active, false); assert.equal(off.updatedAt, 30); assert.equal(v2b.active, true);
  assert.deepEqual(MXA.decide(s, { lessons: [v1, off] }), d); assert.deepEqual(MXA.decide(s, { lessons: [MXA.lessons.deactivate(v1)] }), d);
  // a lesson with a new id that supersedes another one hides it too
  const repl = Object.assign({}, v1, { id: 'L-9', supersedes: 'L-1', when: [{ f: 'confirm', op: 'eq', v: 'no-such-value' }] });
  assert.deepEqual(MXA.decide(s, { lessons: [v1, repl] }), d);
});

test('lessons: matches understands every operator, and validate reports unknown features, bad operators and raw prices', () => {
  const f = { rr: 2, session: 'london', eventNear: false, sweepFor: null };
  const L = (when) => ({ id: 'x', edge: '*', version: 1, when, then: { action: 'WAIT', adjust: {} } });
  assert.equal(MXA.lessons.matches(L([{ f: 'rr', op: 'gte', v: 2 }, { f: 'rr', op: 'lte', v: 2 }, { f: 'rr', op: 'between', v: [1.5, 2.5] }, { f: 'session', op: 'in', v: ['london', 'overlap'] }, { f: 'session', op: 'ne', v: 'asia' }, { f: 'eventNear', op: 'eq', v: false }]), f), true);
  assert.equal(MXA.lessons.matches(L([{ f: 'rr', op: 'gte', v: 2.1 }]), f), false);
  assert.equal(MXA.lessons.matches(L([{ f: 'session', op: 'in', v: ['asia'] }]), f), false);
  assert.equal(MXA.lessons.matches(L([{ f: 'sweepFor', op: 'ne', v: 'against' }]), f), false, 'a missing feature never matches');
  assert.equal(MXA.lessons.matches(L([{ f: 'rr', op: 'like', v: 2 }]), f), false);
  assert.deepEqual(MXA.lessons.validate(L([{ f: 'rr', op: 'between', v: [1, 3] }])), []);
  const errs = MXA.lessons.validate({ id: 'x', edge: '*', version: 1, when: [{ f: 'vibes', op: 'eq', v: 1 }, { f: 'rr', op: 'like', v: 1 }, { f: 'pdh', op: 'gte', v: 2000 }, { f: 'rr', op: 'between', v: [3, 1] }], then: { action: 'HOLD', adjust: { stop: { ref: 'moon', k: 'a', unit: 'pips' } } } });
  for (const re of [/unknown feature key "vibes"/, /bad op "like"/, /"pdh" is a raw price level/, /needs \[low, high\]/, /bad action "HOLD"/, /unknown anchor "moon"/, /k must be a number/, /unit must be/]) assert.ok(errs.some((e) => re.test(e)), String(re));
  assert.ok(MXA.lessons.validate({ id: 'x', edge: '*', version: 1, when: [], then: { action: null, adjust: {} } }).length >= 2);
  for (const r of ['missing-confirmation', 'wrong-structure', 'liquidity', 'htf-bias', 'session', 'volatility', 'rr', 'news', 'late', 'early', 'other']) { assert.ok(Array.isArray(MXA.REASON_FEATURES[r]), r); for (const k of MXA.REASON_FEATURES[r]) { assert.ok(k in MXA.FEATURE_DOC, k); assert.ok(!MXA.PRICE_KEYS.includes(k), k); } }
});

test('lessons.fromCorrection: numeric features become a band, a rejection becomes SKIP, an approval repeats the action', () => {
  const { s, d, f } = find('buy', (x) => x.action === 'BUY');
  const rej = MXA.lessons.fromCorrection(d, correction({ id: 'k2', verdict: 'reject', reasons: ['rr', 'session'], text: 'Not worth it.' }), f);
  assert.equal(rej.then.action, 'SKIP'); assert.deepEqual(rej.when.map((c) => [c.f, c.op]), [['rr', 'between'], ['stopAtr', 'between'], ['session', 'eq']]);
  const band = rej.when[0].v; assert.ok(band[0] < f.rr && f.rr < band[1] && Math.abs((band[1] - band[0]) - 1) < 1e-6);
  assert.deepEqual(MXA.lessons.validate(rej), []);
  const r2 = MXA.decide(s, { lessons: [rej] }); assert.equal(r2.action, 'WAIT'); assert.equal(r2.refused, true);
  const app = MXA.lessons.fromCorrection(d, correction({ id: 'k3', verdict: 'approve', reasons: [], text: 'Good.' }), f);
  assert.equal(app.then.action, 'TAKE'); assert.deepEqual(app.when.map((c) => c.f), ['biasAlign', 'regime'], 'no reason given: the default conditions');
  assert.equal(MXA.compare(attempt(1, d), attempt(2, MXA.decide(s, { lessons: [app] })), correction({ id: 'k3', verdict: 'approve' })).verdict, 'learned');
  assert.notEqual(rej.id, app.id); assert.equal(MXA.lessons.fromCorrection(d, correction({ id: 'k2', verdict: 'reject', reasons: ['rr', 'session'] }), f).id, rej.id, 'ids are deterministic');
});

// ---- thesis ------------------------------------------------------------------------------------------------------------
test('thesis: start states the bias and what is awaited; update records the invalidation and the bias change, without mutating', () => {
  const s0 = snapAt(FLIP, at(58), { edge: 'gtrend' }), th = MXA.thesis.start(s0);
  assert.equal(th.bias, 'up'); assert.equal(th.edge, 'gtrend'); assert.equal(th.startedAt, s0.t); assert.match(th.expecting, /a long setup from Gold trend/);
  assert.ok(th.why.length >= 2 && th.invalidation.length >= 1); assert.deepEqual(th.changes, []); assert.deepEqual(th.decisions, []); assert.ok(th.levels.below > 0);
  for (const k of ['id', 'edge', 'market', 'startedAt', 'bias', 'expecting', 'why', 'invalidation', 'changes', 'decisions']) assert.ok(k in th, k);
  const frozen = structuredClone(th);
  // still up, still waiting
  const s1 = snapAt(FLIP, at(59), { edge: 'gtrend' }), d1 = MXA.decide(s1, { thesis: th }), t1 = MXA.thesis.update(th, s1, d1);
  assert.deepEqual(th, frozen, 'update is pure'); assert.notEqual(t1, th);
  assert.equal(t1.bias, 'up'); assert.equal(t1.changes.length, 1); assert.equal(t1.changes[0].kind, 'waiting'); assert.match(t1.changes[0].text, /still waiting for/); assert.equal(t1.decisions.length, 1);
  // the market turns: the level the thesis rested on breaks and the bias flips
  const s2 = snapAt(FLIP, at(72), { edge: 'gtrend' }), d2 = MXA.decide(s2, { thesis: t1 }), t2 = MXA.thesis.update(t1, s2, d2);
  assert.equal(MXA.features(s2).htfBias, 'down'); assert.equal(t2.bias, 'down');
  const flip = t2.changes.find((c) => c.kind === 'bias'); assert.ok(flip); assert.equal(flip.from, 'up'); assert.equal(flip.to, 'down'); assert.equal(flip.t, s2.t); assert.match(flip.text, /bias up to down/);
  assert.ok(t2.changes.some((c) => c.kind === 'invalidation' && /invalidation hit/.test(c.text)));
  assert.deepEqual(t2.biasHistory.map((b) => b.bias), ['up', 'down']); assert.match(t2.expecting, /a short setup/); assert.match(d2.thesis, /The bias has changed since the thesis began \(up to down\)/);
  // a rejected candidate and an entry are both written down with the reason
  const s3 = snapAt(FLIP, at(76), { edge: 'gtrend' }); s3.cand = candOf(s3, 'buy', { tf: '1d' });
  const d3 = MXA.decide(s3, { thesis: t2 }), t3 = MXA.thesis.update(t2, s3, d3);
  assert.equal(d3.action, 'WAIT'); assert.ok(factors(d3.contradicting).includes('thesis')); assert.equal(t3.changes.at(-1).kind, 'rejected'); assert.match(t3.changes.at(-1).text, /rejected candidate/);
  const t4 = MXA.thesis.update(t3, s3, Object.assign({}, d3, { action: 'SELL', supporting: [{ factor: 'htfBias', text: 'with the trend', weight: 2 }] }));
  assert.equal(t4.changes.at(-1).kind, 'entered'); assert.equal(t4.status, 'in-trade');
  // repeated waiting does not flood the history, and the history is capped
  let th5 = th; for (let i = 0; i < 120; i++) { const sn = snapAt(FLIP, at(58) + (i + 1) * 900, { edge: 'gtrend' }); th5 = MXA.thesis.update(th5, sn, MXA.decide(sn, {})); }
  assert.ok(th5.decisions.length <= 40); assert.ok(th5.changes.length <= 60); assert.ok(th5.changes.filter((c) => c.kind === 'waiting').length < 10); assert.ok(th5.changes.some((c) => c.n > 1));
});

// ---- comparison, grading, error classes -----------------------------------------------------------------------------------
test('gradeAgainst and compare: levels match within a tolerance of the risk distance', () => {
  const d = { action: 'BUY', side: 'buy', entry: 100, stop: 98, target: 104, lessonsApplied: [] };
  const k = correction({ verdict: 'change', action: 'BUY', entry: 100.1, stop: 97.9, target: 106 });
  const g = MXA.gradeAgainst(d, k);
  assert.equal(g.action, true); assert.equal(g.entry, true); assert.equal(g.stop, true); assert.equal(g.target, false); assert.equal(g.grade, 'partial'); assert.ok(g.score > 0.5 && g.score < 1);
  assert.equal(MXA.gradeAgainst(d, correction({ verdict: 'approve' })).grade, 'match');
  assert.equal(MXA.gradeAgainst(d, correction({ verdict: 'reject' })).grade, 'miss'); assert.equal(MXA.gradeAgainst(d, correction({ verdict: 'reject' })).expected.action, 'WAIT');
  assert.equal(MXA.gradeAgainst({ action: 'WAIT', side: 'buy', entry: 100, stop: 98 }, correction({ verdict: 'reject' })).expected.action, 'BUY', 'rejecting a WAIT means: it should have been taken');
  const b = Object.assign({}, d, { target: 106, lessonsApplied: [{ id: 'L1', version: 1, applied: true, correctionId: 'k1', effect: 'target' }] });
  const c = MXA.compare({ decision: d }, { decision: b }, k);
  assert.equal(c.verdict, 'learned'); assert.deepEqual(c.matchesCorrection, { action: true, entry: true, stop: true, target: true }); assert.deepEqual(c.lessonIds, ['L1']);
  assert.deepEqual(c.changed.map((x) => x.field), ['target', 'lessonsApplied']);
  assert.equal(MXA.compare(d, Object.assign({}, b, { lessonsApplied: [] }), k).verdict, 'partly', 'right answer, but not from a lesson');
  assert.equal(MXA.compare(d, d, k).verdict, 'partly', 'the action matched before and after; the target still does not');
  assert.equal(MXA.compare(d, d, correction({ verdict: 'change', action: 'WAIT' })).verdict, 'not-learned');
  assert.equal(MXA.compare(d, b, k, { tolR: 0.01 }).matchesCorrection.entry, false, 'a tighter tolerance can be asked for');
});

test('classifyError names the mistake from the decision and the mentor\'s correction', () => {
  const took = { action: 'BUY', side: 'buy', entry: 100, stop: 98, target: 104, supporting: [{ weight: 3 }], contradicting: [{ weight: 0.5 }], uncertainty: [] };
  const wait = (reasons) => correction({ verdict: 'change', action: 'WAIT', reasons });
  assert.equal(MXA.classifyError(took, wait(['early'])), 'premature-entry');
  assert.equal(MXA.classifyError(took, wait(['late'])), 'late-entry');
  assert.equal(MXA.classifyError(took, wait(['missing-confirmation'])), 'false-confirmation');
  assert.equal(MXA.classifyError(took, wait(['htf-bias'])), 'incorrect-bias');
  assert.equal(MXA.classifyError(took, wait(['wrong-structure'])), 'misidentified-structure');
  assert.equal(MXA.classifyError(took, wait(['liquidity'])), 'missed-liquidity');
  assert.equal(MXA.classifyError(took, wait(['news'])), 'failure-to-recognise-uncertainty');
  assert.equal(MXA.classifyError(took, wait(['rr'])), 'unrealistic-target');
  assert.equal(MXA.classifyError(took, wait(['session'])), 'overtrading');
  assert.equal(MXA.classifyError(took, wait([])), 'failure-to-wait');
  assert.equal(MXA.classifyError(Object.assign({}, took, { contradicting: [{ weight: 2.5 }] }), wait([])), 'ignored-contradiction');
  assert.equal(MXA.classifyError(took, correction({ verdict: 'change', action: 'SELL' })), 'incorrect-bias');
  assert.equal(MXA.classifyError(took, correction({ verdict: 'change', action: 'BUY', stop: 96 })), 'poor-stop');
  assert.equal(MXA.classifyError(took, correction({ verdict: 'change', action: 'BUY', target: 110 })), 'unrealistic-target');
  assert.equal(MXA.classifyError(took, correction({ verdict: 'change', action: 'BUY', entry: 99 })), 'late-entry', 'the mentor would pay less: the engine chased');
  assert.equal(MXA.classifyError(took, correction({ verdict: 'change', action: 'BUY', entry: 101 })), 'premature-entry');
  assert.equal(MXA.classifyError(took, correction({ verdict: 'approve' })), 'none');
  assert.equal(MXA.classifyError(took, null, { netR: -1, mfeR: 0.2 }), 'none', 'a loss alone is not an error');
  assert.equal(MXA.classifyError(took, null, { netR: -1, mfeR: 1.4 }), 'unrealistic-target');
  const ex = MXA.explainError(took, wait(['early'])); assert.equal(ex.cls, 'premature-entry'); assert.ok(ex.why.length > 10);
  for (const c of ['premature-entry', 'late-entry', 'incorrect-bias', 'misidentified-structure', 'missed-liquidity', 'false-confirmation', 'poor-stop', 'unrealistic-target', 'overtrading', 'ignored-contradiction', 'failure-to-wait', 'failure-to-recognise-uncertainty', 'none']) assert.ok(MXA.ERROR_CLASSES.includes(c), c);
});

test('classifyMiss judges from what was known at the time: a justified WAIT is not a mistake because price later ran', () => {
  const rejected = find('sell', (x) => x.action === 'WAIT' && x.uncertainty.length === 0 && x.evidence.contradiction >= 3);
  const ran = MXA.classifyMiss(rejected.d, { id: 'c', R: 2.1, netR: 2, mfeR: 2.4, maeR: -0.3 }, rejected.f);
  assert.equal(ran.cls, 'correct-wait'); assert.equal(ran.justified, true); assert.equal(ran.hindsight, false);
  assert.match(ran.why, /price later ran/); assert.match(ran.why, /not a mistake/); assert.match(ran.why, /documented contradictions/);
  assert.equal(MXA.classifyMiss(rejected.d, { netR: -1 }, rejected.f).cls, 'correct-rejection');
  // stated uncertainty justifies a wait just the same
  const gated = { action: 'WAIT', candidateId: 'c', entry: 1, supporting: [{ weight: 5 }], contradicting: [], uncertainty: ['event risk: CPI in 20 min'] };
  assert.equal(MXA.classifyMiss(gated, { netR: 3 }, {}).cls, 'correct-wait'); assert.match(MXA.classifyMiss(gated, { netR: 3 }, {}).why, /event risk/);
  // a thin case against, and the trade won: that one is on the engine
  const thin = { action: 'WAIT', candidateId: 'c', entry: 1, supporting: [{ weight: 3 }], contradicting: [{ weight: 1.8 }], uncertainty: [] };
  assert.equal(MXA.classifyMiss(thin, { netR: 1.5 }, {}).cls, 'missed-valid-opportunity'); assert.equal(MXA.classifyMiss(thin, { netR: 1.5 }, {}).justified, false);
  assert.equal(MXA.classifyMiss(Object.assign({}, thin, { supporting: [{ weight: 1 }] }), { netR: 1.5 }, {}).cls, 'false-negative');
  assert.equal(MXA.classifyMiss({ action: 'WAIT', candidateId: null, entry: null }, { netR: 1 }, {}).cls, 'correct-wait');
  const took = { action: 'BUY', candidateId: 'c', supporting: [{ weight: 4 }], contradicting: [{ weight: 1 }], uncertainty: [] };
  assert.equal(MXA.classifyMiss(took, { netR: 2, maeR: -0.2 }, {}).cls, 'correct-entry');
  assert.equal(MXA.classifyMiss(took, { netR: 2, maeR: -0.9 }, {}).cls, 'premature-entry');
  assert.equal(MXA.classifyMiss(took, { netR: -1 }, { confirm: 'weak' }).cls, 'premature-entry');
  assert.equal(MXA.classifyMiss(took, { netR: -1 }, { confirm: 'strong', entryOffset: 1.4 }).cls, 'late-entry');
  assert.equal(MXA.classifyMiss(took, { netR: -1 }, { confirm: 'strong', entryOffset: 0, locFor: 'good' }).cls, 'false-positive');
  for (const c of ['correct-rejection', 'missed-valid-opportunity', 'correct-wait', 'premature-entry', 'late-entry', 'false-positive', 'false-negative']) assert.ok(MXA.MISS_CLASSES.includes(c), c);
});

// ---- counterfactuals -------------------------------------------------------------------------------------------------------
test('simulate: the stop is taken first when one bar touches both, costs come off every filled trade, waiting and missed fills are honest', () => {
  const B = (i, o, h, l, c) => ({ time: 1000 + i * 300, open: o, high: h, low: l, close: c });
  // one bar spans both the stop (99) and the target (102): conservative = stopped
  const both = MXA.simulate([{ label: 'take', side: 'buy', entry: null, stop: 99, target: 102 }], [B(0, 100, 102.5, 98.5, 101)], {})[0];
  assert.equal(both.filled, true); assert.equal(both.reason, 'stop'); assert.equal(both.R, -1); assert.equal(both.exitT, 1000);
  assert.equal(MXA.simulate([{ label: 'short', side: 'sell', entry: null, stop: 101, target: 98 }], [B(0, 100, 101.5, 97.5, 99)], {})[0].reason, 'stop');
  // a clean run to the target: R = 2, less spread + commission + 2 x slippage over the 1.00 risk
  const bars = [B(0, 100, 100.6, 99.6, 100.5), B(1, 100.5, 101.4, 100.2, 101.2), B(2, 101.2, 102.3, 101, 102.1), B(3, 102.1, 103, 99, 99.5)];
  const [mkt] = MXA.simulate([{ label: 'take', side: 'buy', entry: null, stop: 99, target: 102 }], bars, { spread: 0.1, commission: 0.04, slippage: 0.03 });
  assert.deepEqual([mkt.reason, mkt.R, mkt.netR, mkt.exitT, mkt.entryT, mkt.fill], ['target', 2, 1.8, 1600, 1000, 100]); assert.equal(mkt.mfeR, 2); assert.equal(mkt.maeR, -0.4);
  // waiting 3 bars enters at the fourth bar's open and is stopped there
  const [late] = MXA.simulate([{ label: 'wait 3', side: 'buy', entry: null, stop: 101, target: 104, afterBars: 3 }], bars, {});
  assert.equal(late.entryT, 1900); assert.equal(late.reason, 'stop'); assert.equal(late.R, -1);
  // a resting buy limit below the market: filled at its own price, the stop can be hit on the fill bar, the target cannot
  const [lim] = MXA.simulate([{ label: 'limit', side: 'buy', entry: 99.8, stop: 99.3, target: 100.4 }], bars, {});
  assert.equal(lim.fill, 99.8); assert.equal(lim.entryT, 1000); assert.equal(lim.reason, 'target'); assert.equal(lim.exitT, 1300, 'the fill bar\'s high does not count as the target');
  const [never] = MXA.simulate([{ label: 'deep limit', side: 'buy', entry: 95, stop: 94, target: 97, expireBars: 3 }], bars, { spread: 0.1 });
  assert.deepEqual([never.filled, never.reason, never.R, never.netR, never.exitT], [false, 'no-fill', 0, 0, null]);
  // a buy limit needs the ASK to reach it: a low exactly at the limit does not fill once there is a spread
  assert.equal(MXA.simulate([{ label: 'l', side: 'buy', entry: 99.6, stop: 99, target: 101 }], bars, { spread: 0.1 })[0].entryT, 1900);
  // a stop that gaps is filled at the open, worse than -1 R
  const [gap] = MXA.simulate([{ label: 'gap', side: 'buy', entry: null, stop: 99, target: 105 }], [B(0, 100, 100.5, 99.5, 100.2), B(1, 98, 98.4, 97.5, 98.2)], {});
  assert.equal(gap.reason, 'stop'); assert.equal(gap.R, -2);
  // nothing resolved: marked at the last close; no side: no trade; no stop: refused
  const [open] = MXA.simulate([{ label: 'open', side: 'buy', entry: null, stop: 90, target: 120 }], bars, {}); assert.equal(open.reason, 'open'); assert.equal(open.R, -0.05);
  assert.equal(MXA.simulate([{ label: 'WAIT', side: null }], bars, {})[0].reason, 'no-trade'); assert.equal(MXA.simulate([{ label: 'x', side: 'buy', entry: null, stop: null }], bars, {})[0].reason, 'bad-stop');
  assert.deepEqual(MXA.simulate([{ label: 'a', side: 'buy', entry: null, stop: 99, target: 102 }], [], {})[0].filled, false);
});

// ---- scorer and difficulty ---------------------------------------------------------------------------------------------------
test('score: a hand-built two-tree model is evaluated exactly; decide uses a model only when it is promoted and calibrated', () => {
  const model = { version: 'gbt-test-1', promoted: true, calibrated: true, featureNames: ['rr', 'session', 'eventNear'], encoders: { session: { asia: 0, london: 1, overlap: 2 } }, baseScore: 0.1, link: 'logit',
    trees: [{ f: 0, t: 1.5, left: { v: -0.4 }, right: { f: 1, t: 0.5, left: { v: 0.1 }, right: { v: 0.3 } } }, { root: { f: 2, t: 0.5, defaultLeft: false, left: { v: 0.2 }, right: { v: -0.6 } } }] };
  assert.equal(MXA.score(null, { rr: 2 }), null);
  const a = MXA.score(model, { rr: 2, session: 'london', eventNear: false });
  assert.ok(Math.abs(a.raw - 0.6) < 1e-9); assert.ok(Math.abs(a.p - 1 / (1 + Math.exp(-0.6))) < 1e-6);
  assert.ok(Math.abs(MXA.score(model, { rr: 2, session: 'asia', eventNear: true }).raw - (0.1 + 0.1 - 0.6)) < 1e-9);
  assert.ok(Math.abs(MXA.score(model, { rr: 1.5, session: 'london', eventNear: false }).raw - (0.1 - 0.4 + 0.2)) < 1e-9, 'x <= threshold goes left');
  assert.ok(Math.abs(MXA.score(model, { rr: null, session: 'mars', eventNear: null }).raw - (0.1 - 0.4 - 0.6)) < 1e-9, 'missing: left by default, right when defaultLeft is false; an unknown category is missing');
  assert.equal(MXA.score(Object.assign({}, model, { link: 'identity' }), { rr: 2, session: 'london', eventNear: false }).p, 0.6);
  assert.ok(Math.abs(MXA.score(Object.assign({}, model, { platt: [2, -1] }), { rr: 2, session: 'london', eventNear: false }).p - 1 / (1 + Math.exp(-0.2))) < 1e-6);
  assert.throws(() => MXA.score({ featureNames: ['rr'] }, {}), /MODEL_SCHEMA/); assert.throws(() => MXA.score({ featureNames: ['rr'], trees: [{ f: 0, t: 1, left: { v: 1 } }] }, { rr: 5 }), /malformed/);
  for (const k of ['version', 'promoted', 'calibrated', 'featureNames', 'trees', 'baseScore', 'link']) assert.ok(MXA.MODEL_SCHEMA[k], k);
  const { s } = find('buy', (x) => x.action === 'BUY');
  const used = MXA.decide(s, { model });
  assert.equal(used.modelVersion, 'gbt-test-1'); assert.equal(typeof used.modelScore, 'number'); assert.equal(used.modelScore, MXA.score(model, MXA.features(s)).p);
  for (const off of [{ promoted: false }, { calibrated: false }]) { const d = MXA.decide(s, { model: Object.assign({}, model, off) }); assert.equal(d.modelVersion, null); assert.equal(d.modelScore, null); assert.ok(d.notes.some((n) => /not promoted and calibrated/.test(n))); assert.ok(!factors(d.supporting.concat(d.contradicting)).includes('model')); }
  assert.equal(MXA.decide(s, {}).modelScore, null, 'no model: confidence stays in words, no probability anywhere');
});

test('difficulty grows with the amount of conflicting evidence and stated uncertainty', () => {
  const ev = (s, c, u = []) => ({ supporting: [{ weight: s }], contradicting: c ? [{ weight: c }] : [], uncertainty: u });
  assert.equal(MXA.difficulty({}, ev(5, 0)), 'beginner'); assert.equal(MXA.difficulty({}, ev(5, 1.5)), 'intermediate');
  assert.equal(MXA.difficulty({}, ev(5, 3)), 'advanced'); assert.equal(MXA.difficulty({}, ev(4, 3.5)), 'expert');
  assert.equal(MXA.difficulty({ htfLtfConflict: true }, ev(5, 0)), 'intermediate'); assert.equal(MXA.difficulty({ eventNear: true, volAbnormal: true }, ev(5, 1.5, ['event risk'])), 'expert');
  const { d, f } = find('buy', (x) => x.action === 'BUY'); assert.ok(['beginner', 'intermediate', 'advanced', 'expert'].includes(MXA.difficulty(f, d)));
});

test('the file is one dependency-free UMD module with the contract\'s names', () => {
  for (const k of ['VERSION', 'POLICY_VERSION', 'assertNoFuture', 'features', 'FEATURE_DOC', 'regime', 'REGIME_DEF', 'decide', 'EDGE_PROFILE', 'thesis', 'lessons', 'compare', 'gradeAgainst', 'classifyError', 'classifyMiss', 'simulate', 'score', 'MODEL_SCHEMA', 'difficulty']) assert.ok(MXA[k] !== undefined, k);
  for (const k of ['start', 'update']) assert.equal(typeof MXA.thesis[k], 'function');
  for (const k of ['fromCorrection', 'matches', 'retrieve', 'revise', 'deactivate', 'validate']) assert.equal(typeof MXA.lessons[k], 'function');
  const src = createRequire(import.meta.url)('node:fs').readFileSync(new URL('../assets/academy-core.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\/.*$/gm, '');                                   // comments may say "require()"
  assert.ok(!/\brequire\(|\bimport\s|fetch\(|XMLHttpRequest|Date\.now|new Date|Math\.random|localStorage/.test(code), 'no dependency, network, clock or randomness');
  // loads as a plain browser script too
  const g = {}; new Function('globalThis', 'module', src.replace("typeof globalThis !== 'undefined' ? globalThis : this", 'globalThis'))(g, undefined);
  assert.equal(g.MXA.VERSION, MXA.VERSION);
});
