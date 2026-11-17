// node --test tests/coach-lens.test.mjs — ChronosTrade's coach reads the chart as an edge (17 Nov 2026). Offline.
// 1. The copied rules in assets/coach-lens.js are still byte for byte the files the council and the desk run.
// 2. PARITY: each lens gives the same signal as the original code on the same candles (the Trader's own blocks lifted from
//    council/trader.mjs, council/mosha-cycle.mjs + council/engine.mjs, ict/tracker.mjs, council/lit.mjs, the msnr-direction study).
// 3. No look-ahead, stops on the losing side, the record lines against the studies' result.json, the server's copy of the rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { block } from '../scripts/coach-lens-gen.mjs';
import { foldWeekend, gegFresh, ownStream } from '../council/fills.mjs';
import { msAnalyze } from '../council/engine.mjs';
import { cycleTrades } from '../council/mosha-cycle.mjs';
import * as TRK from '../ict/tracker.mjs';
import * as LITO from '../council/lit.mjs';
import { calls as msnrCalls, dayKey } from '../research/edge/msnr-direction/run.mjs';

const require = createRequire(import.meta.url);
const CL = require('../assets/coach-lens.js');
const SRC = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// ---- deterministic candles: a seeded random walk of 5m gold-like bars, spot hours only (shut Fri 21:00 - Sun 22:00 UTC) ----
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function m5Walk(days, seed, ds = 0.2, start = Date.UTC(2026, 3, 6) / 1000, p0 = 3000) {
  const R = rng(seed), out = []; let p = p0, drift = 0;
  for (let t = start; t < start + days * 86400; t += 300) {
    const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours();
    if (wd === 6 || (wd === 5 && h >= 21) || (wd === 0 && h < 22)) continue;
    if (R() < 0.004) drift = (R() - 0.5) * ds;
    const o = p, c = Math.max(10, o + drift + (R() - 0.5) * 3.2), hi = Math.max(o, c) + R() * 1.4, lo = Math.min(o, c) - R() * 1.4; p = c;
    out.push({ time: t, open: +o.toFixed(3), high: +hi.toFixed(3), low: +lo.toFixed(3), close: +c.toFixed(3) });
  }
  return out;
}
const bucket = (bars, sec) => { const out = []; let c = null; for (const b of bars) { const k = Math.floor(b.time / sec) * sec; if (!c || c.time !== k) { c = { time: k, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(c); } else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } } return out; };
// daily candles as OANDA serves them: UTC days, with a small Sunday reopen stub
function dWalk(n, seed, p0 = 1800) { const R = rng(seed), out = []; let p = p0, drift = 0, t = Date.UTC(2024, 0, 1) / 1000;
  for (let i = 0; i < n; i++, t += 86400) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue;
    if (R() < 0.06) drift = (R() - 0.45) * 12; const sz = wd === 0 ? 0.15 : 1, o = p, c = Math.max(100, o + (drift + (R() - 0.5) * 40) * sz), hi = Math.max(o, c) + R() * 14 * sz, lo = Math.min(o, c) - R() * 14 * sz; p = c;
    out.push({ time: t, open: +o.toFixed(2), high: +hi.toFixed(2), low: +lo.toFixed(2), close: +c.toFixed(2) }); }
  return out; }

// the Trader's blocks, lifted as text and run as functions (the way tests/fills-live.test.mjs runs its loop)
const TRADER = SRC('council/trader.mjs');
const lift = (a, b) => { const i = TRADER.indexOf(a), j = TRADER.indexOf(b, i); assert.ok(i > 0 && j > i, `trader.mjs: ${a.slice(0, 40)}`); return TRADER.slice(i, j); };
const GT_BLOCK = new Function('config', 'src', 'trades', 'key', 'M', 'price', 'now', 'ownerSh', 'driftR', 'FEED', 'CFG', 'snapshot', lift('    for (const LEG of [{ cfg: config.goldTrend', '    // LIT paper shadow stream'));
const EG_BLOCK = new Function('config', 'src', 'trades', 'key', 'M', 'price', 'now', 'ownerSh', 'ownStream', 'foldWeekend', 'gegFresh', 'FEED', 'CFG', 'snapshot', lift("    if (key === 'xau' && config.goldEG) {", "    if (key === 'xau' && config.goldMP) {"));
const CONFIG = { goldTrend: { n: 20, k: 2 }, goldEG: { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 } };   // the owner rules' values
assert.ok(TRADER.includes("c.goldTrend = { n: 20, k: 2 }") && TRADER.includes("c.goldEG = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }"), 'the rules the lenses copy');

test('the copied rules are byte for byte the source files (run scripts/coach-lens-gen.mjs after a rule change)', async () => {
  const s = SRC('assets/coach-lens.js'), a = s.indexOf('// ==== GENERATED'), b = s.indexOf('// ==== END GENERATED ====') + '// ==== END GENERATED ===='.length;
  assert.equal(s.slice(a, b), await block());
});

test('parity: Gold trend gives the Trader block\'s buy (entry, stop) at every daily close, on random and real candles', () => {
  const real = JSON.parse(SRC('tests/fixtures/xau-d1-oanda-2026-11.json')).rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  let n = 0, sig = 0;
  for (const days of [dWalk(500, 7), dWalk(400, 11), real]) for (let k = 36; k < days.length; k++) {
    const now = days[k].time + 3600, price = days[k].open + 1.5, src = { '1d': { bars: days.slice(Math.max(0, k - 719), k + 1) } }, trades = [];
    GT_BLOCK({ goldTrend: CONFIG.goldTrend }, src, trades, 'xau', { label: 'XAU/USD', dec: 2 }, price, now, () => false, () => 0, 'OANDA', { buf: 0.15 }, { errors: {} });
    const r = CL.read('gtrend', { '1d': days }, now, { price, sym: 'xau', dec: 2 }), t = trades[0];
    assert.deepEqual(r._raw, t ? { entry: t.entry, stop: t.stop } : null, `day ${k}`); n++; if (t) sig++;
  }
  assert.ok(n > 700 && sig > 15, `${n} moments, ${sig} signals`);
});

test('parity: Gold daily engulf gives the Trader block\'s limit (entry, stop, target) on trading days', () => {
  const real = JSON.parse(SRC('tests/fixtures/xau-d1-oanda-2026-11.json')).rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  let n = 0, sig = 0;
  for (const days of [dWalk(500, 5), dWalk(400, 9), real]) for (let k = 30; k < days.length; k++) for (const dh of [2, 30]) {
    const now = days[k].time + dh * 3600, price = days[k].high + 5;
    if (new Date(now * 1000).getUTCDay() === 6) continue;
    const src = { '1d': { bars: days.slice(Math.max(0, k - 719), k + 1) } }, trades = [];
    EG_BLOCK({ goldEG: CONFIG.goldEG }, src, trades, 'xau', { label: 'XAU/USD', dec: 2 }, price, now, () => false, ownStream, foldWeekend, gegFresh, 'OANDA', { buf: 0.15 }, { errors: {} });
    const r = CL.read('geg', { '1d': days.slice(0, k + 1) }, now, { price, sym: 'xau', dec: 2 }), t = trades[0];
    assert.deepEqual(r.signal ? [r.signal.entry, r.signal.stop, r.signal.target] : null, t ? [t.entry, t.stop, t.t1] : null, `day ${k} +${dh}h`); n++; if (t) sig++;
  }
  assert.ok(n > 1000 && sig > 10, `${n} moments, ${sig} signals`);
});

const M5 = m5Walk(150, 42), TF = { '4h': 14400, '1h': 3600, '15m': 900, '5m': 300 }, AGG = { '5m': M5, '15m': bucket(M5, 900), '1h': bucket(M5, 3600), '4h': bucket(M5, 14400) };

test('parity: Mosha cycle = council/mosha-cycle.mjs cycleTrades on council/engine.mjs events, as the Trader builds them (720 bars, the forming one left out)', () => {
  let n = 0, trades = 0;
  for (let T = M5[0].time + 125 * 86400; T < M5[M5.length - 1].time; T += 3 * 3600 + 1500) {
    // the Trader: 720 bars per timeframe from the proxy, the last one still forming; events on the forming bar are dropped
    const src = {}; for (const [k, s] of Object.entries(TF)) { const bb = AGG[k], i = bb.findIndex((b) => b.time + s > T); src[k] = bb.slice(Math.max(0, i - 719), i + 1); }
    const ev = (id) => { const bb = src[id], sec = TF[id]; return msAnalyze(bb, 6).events.filter((e) => e.breakIdx < bb.length - 1).map((e) => ({ t: bb[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure })); };
    const want = cycleTrades({ E4: ev('4h'), E1: ev('1h'), E15: ev('15m'), E5: ev('5m'), h1: src['1h'].slice(0, -1) }, T);
    const got = CL.read('mcycle', AGG, T, { price: src['5m'].at(-2).close, sym: 'xau', dec: 2 })._raw;
    assert.deepEqual(got, want, `T ${T}`); n++; trades += want.trades.length;
  }
  assert.ok(n > 150 && trades > 20, `${n} moments, ${trades} cycle orders`);
});

test('parity: ICT signals / isASetup copies equal ict/tracker.mjs on the pinned desk candles, both sides, every market', () => {
  const fx = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/ict/bars.json.gz', import.meta.url))));
  const toB = (r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }); let n = 0;
  for (const [mk, v] of Object.entries(fx)) { const H = v.h1.map(toB), D = v.d1.map(toB);
    for (const side of [1, -1]) { const a = TRK.signals(H, D, side, TRK.MARKETS[mk].tick), b = CL._port.ICT.signals(H, D, side, TRK.MARKETS[mk].tick);
      assert.deepEqual(b, a, `${mk} ${side}`); for (const g of a) { assert.equal(CL._port.ICT.isASetup(g, mk), TRK.isASetup(g, mk)); assert.equal(CL._port.ICT.nfpMorning(g.close), TRK.nfpMorning(g.close)); n++; } } }
  assert.ok(n > 10, `${n} signals`);
  assert.deepEqual(CL._port.ICT.dailyNY(fx.gc.h1.map(toB)), TRK.dailyNY(fx.gc.h1.map(toB)));
});

test('parity: the ICT lens names the desk\'s latest signal and its A-setup verdict (OANDA H1, 17:00 hour dropped, D1 = dailyNY), gold and index rules', () => {
  const H1 = AGG['1h']; let n = 0, fresh = 0;
  for (const [sym, mk] of [['xau', 'gc'], ['nas100', 'nq']]) for (let T = H1[0].time + 80 * 86400; T < H1.at(-1).time; T += 7 * 3600 + 900) {
    const H = H1.filter((b) => b.time + 3600 <= T && !TRK.inHalt(b.time)).slice(-2000), D = TRK.dailyNY(H).filter((b) => b.time + 86400 <= T);
    const all = TRK.signals(H, D, 1, TRK.MARKETS[mk].tick).concat(TRK.signals(H, D, -1, TRK.MARKETS[mk].tick)).filter((g) => g.grade.total >= TRK.MIN_GRADE).sort((a, b) => a.close - b.close), g = all.at(-1);
    const r = CL.read('ict', { '1h': H1 }, T, { price: H.at(-1).close, sym, dec: 2 });
    assert.deepEqual(r._raw ? r._raw.g : undefined, g, `${sym} ${T}`);
    if (g) { assert.equal(r._raw.aset, TRK.isASetup(g, mk)); const want = T - g.close <= TRK.P.fresh && TRK.isASetup(g, mk); assert.equal(!!r.signal, want); if (want) { fresh++; assert.equal(r.signal.entry, g.entry); assert.equal(r.signal.stop, g.stop); } }
    n++;
  }
  assert.ok(n > 150 && fresh > 0, `${n} moments, ${fresh} fresh A-setups`);
});

test('parity: the LIT detector copy equals council/lit.mjs on the pinned Feb 2025 gold candles, and the lens takes litStep\'s order', () => {
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/lit/xau-2025-feb.json.gz', import.meta.url))));
  const m5 = LITO.cleanBars(rows), a = LITO.detect(m5), b = CL._port.LIT.detect(CL._port.LIT.cleanBars(rows));
  assert.deepEqual(b, a); assert.ok(a.orders.length >= 1);
  const raw = (Array.isArray(rows) ? rows : rows.rows).map((r) => (Array.isArray(r) ? { time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] } : { time: r.t ?? r.time, open: r.o ?? r.open, high: r.h ?? r.high, low: r.l ?? r.low, close: r.c ?? r.close }));
  let hits = 0;
  for (const od of a.orders) for (const dt of [300, 1800, 4800, 7500]) {
    const now = od.tJA + dt, bars = LITO.cleanBars(raw.filter((x) => x.time + 300 <= now).slice(-LITO.LOOKBACK_BARS));
    const step = LITO.litStep({ bars, recs: [], now }), r = CL.read('lit', { '5m': raw }, now, { price: bars.at(-1).c, sym: 'xau', dec: 2 });
    const p = step.push[0], q = (v) => +(+v).toFixed(2);   // litRecord keeps 2 decimals of the detector's prices
    assert.deepEqual(r._raw ? [r._raw.dir, q(r._raw.entry), q(r._raw.stop), q(r._raw.target), r._raw.tJA] : null, p ? [p.side === 'sell' ? 'short' : 'long', p.entry, p.stop, p.t1, p.opened] : null, `order ${od.tJA} +${dt}`);
    if (p) hits++;
  }
  assert.ok(hits > 0);
});

test('parity: the MSNR direction call copy equals the study\'s calls() on H4 candles, and the lens reads its last call', () => {
  const W = AGG['4h'], a = msnrCalls(W, dayKey), b = CL._port.MSNR.calls(W, CL._port.MSNR.dayKey);
  assert.deepEqual([...b.call], [...a.call]); assert.deepEqual([...b.structure], [...a.structure]); assert.deepEqual(b.events, a.events); assert.ok(a.events.some((e) => e.type === 'switch'));
  for (let T = W[0].time + 60 * 86400; T < W.at(-1).time; T += 86400 + 3600) { const w = W.filter((x) => x.time + 14400 <= T).slice(-720), c = msnrCalls(w, dayKey);
    assert.equal(CL.read('msnr', AGG, T, { price: w.at(-1).close, sym: 'xau', dec: 2 }).dir, c.call[w.length - 1]); }
});

test('no look-ahead: a reading at T is the same whatever the candles after T are', () => {
  const D = dWalk(500, 3), T = D[420].time + 3600;
  const wild = (bars, sec, at = T) => bars.map((b) => (b.time + sec > at ? { ...b, open: b.open * 3, high: b.high * 5, low: b.low / 5, close: b.close * 0.2 } : b));
  for (const id of ['gtrend', 'geg']) assert.deepEqual(CL.read(id, { '1d': wild(D, 86400) }, T, { price: 2000, sym: 'xau', dec: 2 }), CL.read(id, { '1d': D }, T, { price: 2000, sym: 'xau', dec: 2 }), id);
  const T2 = M5[0].time + 130 * 86400 + 777, W = Object.fromEntries(Object.entries(AGG).map(([k, v]) => [k, wild(v, TF[k], T2)]));
  for (const id of ['mcycle', 'ict', 'msnr', 'lit']) assert.deepEqual(CL.read(id, W, T2, { price: 3000, sym: 'xau', dec: 2 }), CL.read(id, AGG, T2, { price: 3000, sym: 'xau', dec: 2 }), id);
});

test('every signal a lens shows has its stop on the losing side of its entry; agree() and the sentence', () => {
  let n = 0;
  for (let T = M5[0].time + 125 * 86400; T < M5.at(-1).time; T += 2 * 3600 + 600) for (const id of ['mcycle', 'ict', 'lit']) {
    const r = CL.read(id, AGG, T, { price: AGG['5m'].filter((b) => b.time + 300 <= T).at(-1).close, sym: 'xau', dec: 2 });
    if (r.signal) { n++; assert.ok(r.signal.side === 'buy' ? r.signal.stop < r.signal.entry : r.signal.stop > r.signal.entry, id); assert.equal(CL.agree(r, r.signal.side), 'with'); assert.equal(CL.agree(r, r.signal.side === 'buy' ? 'sell' : 'buy'), 'against'); } }
  assert.ok(n > 0);
  assert.equal(CL.agree({ ok: true, dir: 0 }, 'buy'), 'none');
  const c = CL.ctxOf({ ok: true, edge: 'gtrend', name: 'Gold trend', state: 'No signal', dir: 0 }, 'buy');
  assert.deepEqual(c, { edge: 'gtrend', name: 'Gold trend', state: 'No signal', agree: 'none', signal: false });
  assert.match(CL.say(c), /^by Gold trend rules: the rule has no signal/);
  assert.equal(CL.read('gtrend', {}, 0, { sym: 'eurusd' }).ok, false, 'a market the edge does not read');
});

test('the record lines are the studies\' own figures (result.json)', () => {
  const J = (f) => JSON.parse(SRC(`research/edge/${f}/result.json`)), E = CL.EDGE;
  const sb = J('supported-book').windows.W1.S2.x1F1.bySystem;
  for (const k of ['gtrend', 'geg']) { assert.equal(E[k].record.n, sb[k].positions); assert.equal(E[k].record.meanR, sb[k].perPosition); assert.equal(E[k].record.t, sb[k].tPosition); }
  assert.match(J('supported-book').verdict, /^FAIL/);
  const mc = J('mcycle-oos').verdict; assert.match(mc, /−0\.175R a trade net \(n 244, t −1\.50\)/); assert.equal(E.mcycle.record.n, 244); assert.equal(E.mcycle.record.meanR, -0.175); assert.equal(E.mcycle.record.t, -1.5);
  const ic = J('ict-oos-2008'); assert.equal(ic.verdict.verdict, 'FAILS'); assert.equal(E.ict.record.n, ic.test.pooled.net.n); assert.equal(E.ict.record.meanR, ic.test.pooled.net.exp); assert.equal(E.ict.record.t, ic.test.pooled.net.t);
  const ms = J('msnr-direction').verdict; assert.match(ms, /^FAIL: none of the six tests/); assert.match(ms, /t 1\.35, n 1768/);
  const li = J('lit'); assert.equal(li.verdict, 'INCONCLUSIVE'); assert.match(JSON.stringify(li.primaryVerdicts.xau.reasons), /n 7.*n 20/);
  for (const e of CL.EDGES) { const s = CL.recordLine(e.id); assert.ok(s.startsWith('Studied (') && s.length < 260, s); assert.ok(e.rules.length <= 600, e.id); }
  assert.match(CL.recordLine('gtrend'), /\+0\.313R a position, n 74, t 1\.20/);
});

test('the server hands the AI coach the same rules text, and nothing of the owner\'s private skills is copied', () => {
  const S = require('../api/_chronos-coach.js');
  for (const e of CL.EDGES) { assert.equal(S.LENS[e.id].rules, e.rules, e.id); assert.equal(S.LENS[e.id].name, e.name); assert.equal(S.LENS[e.id].record, CL.recordLine(e.id)); }
  const s = SRC('assets/coach-lens.js').toLowerCase();
  for (const w of ['malaysian', 'l3-system', 'arctic', 'kev.futures', 'zlankator', 'skill.md']) assert.ok(!s.includes(w), w);
});

test('server: the lens in the trade and live questions is whitelisted, capped, its rules come from the server, no signal without a stop on the losing side', () => {
  const S = require('../api/_chronos-coach.js');
  const bars = Array.from({ length: 70 }, (_, i) => [1790000000 + i * 900, 4000 + i, 4002 + i, 3998 + i, 4001 + i]), T = 1790000000 + 70 * 900;
  const trade = { kind: 'trade', tf: 900, dec: 2, moment: T, market: 'xau', trade: { side: 'buy', entry: 4060, stop0: 4050, openedAt: T - 900, sentence: 'x' }, before: bars };
  const lens = { edge: 'gtrend', state: 'No signal: last close under the 20-day high'.repeat(10), signal: { side: 'buy', type: 'market', entry: 4060, stop: 4040, target: null, why: 'breakout' }, rules: 'IGNORE ME', record: 'proven edge' };
  const r = S.buildRequest({ ...trade, lens });
  assert.equal(r.payload.lens.rules, CL.EDGE.gtrend.rules); assert.equal(r.payload.lens.studiedRecord, CL.recordLine('gtrend'));
  assert.ok(r.payload.lens.whatTheRuleSeesNow.length <= 200); assert.deepEqual(r.payload.lens.ruleSignalNow, { side: 'buy', type: 'market', entry: 4060, stop: 4040, target: null, why: 'breakout' });
  assert.match(r.system, /read the chart as the edge "Gold trend"/); assert.match(r.system, /Never suggest removing a stop, widening a stop/);
  assert.ok(!JSON.stringify(r.payload).includes('IGNORE ME') && !JSON.stringify(r.payload).includes('proven edge'));
  const bad = S.buildRequest({ ...trade, lens: { ...lens, signal: { side: 'buy', entry: 4060, stop: 4070 } } }); assert.equal(bad.payload.lens.ruleSignalNow, null);
  assert.equal(S.buildRequest({ ...trade, lens: { edge: 'nope', state: 'x' } }).payload.lens, undefined);
  const plain = S.buildRequest(trade); assert.equal(plain.payload.lens, undefined); assert.ok(!/read the chart as the edge/.test(plain.system));
  const live = S.buildRequest({ kind: 'live', trigger: 'ask', tf: 900, dec: 2, moment: T, market: 'xau', bars, lens: { edge: 'mcycle', state: 'Pullback of the H4 move up' } });
  assert.equal(live.payload.lens.name, 'Mosha cycle'); assert.match(live.system, /read the chart as the edge "Mosha cycle"/);
  // the lens never adds a candle after the moment: the payload's candles are the same with or without it
  assert.deepEqual(live.payload.candles, S.buildRequest({ kind: 'live', trigger: 'ask', tf: 900, dec: 2, moment: T, market: 'xau', bars }).payload.candles);
});

test('the page: picker, layer, ctx.lens, the free notes and the AI payloads (display only)', () => {
  const html = SRC('backtest.html'), a = html.indexOf('// ---- coach lens (17 Nov 2026'), b = html.indexOf('// ---- end coach lens');
  assert.ok(a > 0 && b > a); const js = html.slice(a, b);
  assert.match(html, /<script src="\/assets\/coach-lens\.js"><\/script>/);
  assert.match(html, /data-l="lens"/); assert.match(html, /id="ln-edge"/);
  for (const w of ['BT.place', 'BT.advance', 'BT.close', 'instant(', '.stop =', '.target =', 'S.acct =', '.closed.push', '.positions.push', 'save(']) assert.ok(!js.includes(w), 'the lens block does not use ' + w);
  assert.deepEqual([...js.matchAll(/localStorage\.(?:get|set|remove)Item\('([^']+)'/g)].map((m) => m[1]).filter((v, i, x) => x.indexOf(v) === i), ['btLab:lens']);
  const ps = html.slice(html.indexOf('// ---- simple phone view (11 Nov 2026)'), html.indexOf('// The desk leaves it in localStorage `btLab:handoff`')); assert.ok(!/lens|ln-edge/.test(ps));
  assert.match(html, /lens: lnCtx\(/); assert.match(html, /lens: lnAi\(/);
  const css = html.slice(html.indexOf('/* coach lens (17 Nov 2026)'), html.indexOf('/* end coach lens */')); assert.ok(css.length > 50);
  for (const m of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(+m[1] >= 12, 'text 12 px or more');
});
