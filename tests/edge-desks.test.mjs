// node --test tests/edge-desks.test.mjs: the LIT desk's and the Engulfing desk's trackers (council/edge-desks.mjs) and their page
// (assets/desk-trades.js). Offline: a seeded market, no network. Owner, 21 Nov 2026: "The same for LIT and the same for engulfing."
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as E from '../council/edge-desks.mjs';

const require = createRequire(import.meta.url), SOP = require('../assets/mosha-sop.js');
const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
// a seeded five-minute walk on weekdays, grouped into the timeframes the trackers read
function market(days, seed, px = 4000, step = 1.6) {
  let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const T0 = 1790553600, m5 = []; let p = px, drift = 0;   // a Monday 00:00 UTC
  for (let i = 0; i < days * 288; i++) { const t = T0 + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    if (i % 72 === 0) drift = (rnd() - 0.5) * step * 0.5; const o = p, c = o + drift + (rnd() - 0.5) * step * 2, h = Math.max(o, c) + rnd() * step, l = Math.min(o, c) - rnd() * step; m5.push({ time: t, open: o, high: h, low: l, close: c }); p = c; }
  const B = { '5m': m5 };
  for (const tf of ['1h', '4h', '1d']) { const sec = SOP.SEC[tf], out = []; for (const b of m5) { const t = b.time - (b.time % sec), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } B[tf] = out; }
  return B;
}
const B = market(60, 11), END = B['5m'].at(-1).time + 300, from = END - 30 * 86400;
// a direct entry has no target (its document trails the stop with the M5 EF): its stop must still be on the losing side
const stopOk = (r) => (r.side > 0 ? r.stop < r.entry && (r.target == null ? r.kind === 'eg-direct' : r.target > r.entry) : r.stop > r.entry && (r.target == null ? r.kind === 'eg-direct' : r.target < r.entry));

test('Engulfing: every trade has its stop on the losing side, one order a zone, and results follow the rule', () => {
  const eg = E.egTrades(B, { from, market: 'xau' });
  assert.ok(eg.length >= 20, 'entries: ' + eg.length);
  const ids = new Set();
  for (const r of eg) { assert.ok(stopOk(r), 'rule 1: ' + r.id); assert.ok(r.r0 > 0); assert.ok(!ids.has(r.id)); ids.add(r.id);
    assert.match(r.kind, /^eg-(1d|4h|1h)$/); assert.ok(r.t <= END && (r.t >= from || r.endT == null || r.endT >= from), 'inside the window, or an older order still alive in it'); assert.ok(r.log.length >= 3 && r.marks.length === 2);
    assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - E.EG.target) < 1e-9, 'the target is 10R');
    if (r.status === 'stopped') assert.ok(r.R <= -1 + 1e-9, 'a stop is -1R, or worse when a candle opened beyond it'); if (r.status === 'target') assert.equal(r.R, E.EG.target);
    if (r.status === 'trail') assert.ok(r.R >= E.EG.trail[0] - E.EG.trail[1] - 1e-9, 'a trailed stop never books under +1R'); if (r.status === 'open') assert.equal(r.R, null); }
  const zones = eg.map((r) => r.kind + '|' + r.side + '|' + r.marks[0].a); assert.equal(new Set(zones).size, zones.length, 'one order a zone');
  assert.ok(eg.some((r) => r.side > 0) && eg.some((r) => r.side < 0), 'buys and the mirrored sells');
});

test('Engulfing: no look-ahead, an entry found with the candles cut at a moment is found with everything after it', () => {
  const T = END - 8 * 86400, cut = Object.fromEntries(Object.entries(B).map(([tf, a]) => [tf, a.filter((b) => b.time + SOP.SEC[tf] <= T)]));
  const key = (r) => [r.id, r.side, r.entry.toFixed(4), r.stop.toFixed(4)].join('|'), all = new Set(E.egTrades(B, { from, market: 'xau' }).map(key));
  const early = E.egTrades(cut, { from, market: 'xau' }); assert.ok(early.length >= 5);
  for (const r of early) assert.ok(all.has(key(r)), 'missing with later candles: ' + r.id);
});

test('the trail only ever tightens, and a stop is counted first when one candle holds both', () => {
  const tr = { side: 1, entry: 100, stop: 99, target: 110, r0: 1 }, bar = (i, o, h, l, c) => ({ time: i * 300, open: o, high: h, low: l, close: c });
  const run = E.egOutcome(tr, [bar(0, 100, 100.5, 99.8, 100.4), bar(1, 100.4, 103, 100.3, 102.8), bar(2, 102.8, 102.9, 101.5, 101.6)], 0, 1e9);
  assert.equal(run.status, 'trail'); assert.ok(Math.abs(run.R - 2) < 1e-9, 'best +3R, a 1R trail: out at +2R');
  const both = E.egOutcome(tr, [bar(0, 100, 111, 98.9, 105)], 0, 1e9); assert.equal(both.status, 'stopped'); assert.equal(both.R, -1);
  const time = E.egOutcome(tr, [bar(0, 100, 100.5, 99.5, 100.2), bar(1, 100.3, 100.6, 100.1, 100.4)], 0, 300); assert.equal(time.status, 'time'); assert.ok(Math.abs(time.R - 0.3) < 1e-9);
});

test('LIT: trades come from the council\'s own detector, one position at a time, stops on the losing side', () => {
  const lit = E.litTrades(market(120, 5), { from: 0, market: 'xau' });
  for (const r of lit) { assert.ok(stopOk(r), 'rule 1: ' + r.id); assert.match(r.kind, /^lit-(rule|loose|break)$/); assert.ok(r.log.length === 4 && r.marks.length === 4); assert.ok(['target', 'stopped', 'breakeven', 'dayend', 'open'].includes(r.status)); }
  for (const k of ['lit-rule', 'lit-loose', 'lit-break']) { const x = lit.filter((r) => r.kind === k); for (let i = 1; i < x.length; i++) assert.ok(x[i].t >= (x[i - 1].endT || Infinity) || x[i - 1].endT == null, 'no entry inside an earlier trade of the same execution'); }
  // each execution is its own stream: a stream equals the detector run with that execution alone (no pick by what filled later)
  for (const set of E.LIT_SETS) assert.deepEqual(lit.filter((r) => r.kind === 'lit-' + set.id).map((r) => r.id), E.litTrades(market(120, 5), { from: 0, market: 'xau', sets: [set] }).map((r) => r.id));
  const old = E.litTrades(market(120, 5), { from: 0, market: 'xau', first: true }); for (let i = 1; i < old.length; i++) assert.ok(old[i].t >= (old[i - 1].endT || Infinity) || old[i - 1].endT == null);
  assert.deepEqual(E.LIT_SETS.map((s) => s.id), ['rule', 'loose', 'break'], 'the rule first, then the two study executions');
  const src = rd('council/edge-desks.mjs'); assert.match(src, /from '\.\/lit\.mjs'/); assert.match(src, /managePosition/);
});

test('the files: markets are joined into one record, nothing without a stop is stored, another market scales its sizes', () => {
  const now = END + 600, f = E.buildDesk('eg', [['xau', B], ['eurusd', Object.fromEntries(Object.entries(B).map(([tf, a]) => [tf, a.map((b) => ({ time: b.time, open: b.open * 1.15 / 4000, high: b.high * 1.15 / 4000, low: b.low * 1.15 / 4000, close: b.close * 1.15 / 4000 }))]))]], null, now, 30);
  assert.equal(f.desk, 'eg'); assert.deepEqual(f.read, ['xau', 'eurusd']); assert.ok(f.records.length >= 40);
  assert.ok(f.records.every((r) => (r.side > 0 ? r.stop < r.entry : r.stop > r.entry))); assert.ok(f.records.some((r) => r.market === 'eurusd' && /^eurusd:eg-/.test(r.id) && r.label));
  assert.equal(f.counts.n, f.records.length); assert.ok(f.records.every((r) => r.src === 'live' || r.src === 'replay'));
  const again = E.buildDesk('eg', [['xau', B]], f, now + 2100, 30); assert.equal(again.records.length, f.records.length, 'a second run adds nothing and keeps the other market');
  assert.deepEqual(Object.keys(E.DESKS), ['eg', 'msnr', 'lit']); assert.equal(E.DESKS.lit.markets.length, Object.keys(SOP.ALL).length); assert.deepEqual(E.DESKS.eg.markets, Object.keys(SOP.MARKETS));
});

test('wiring: the loop runs the trackers, data health lists the files, and the page has both desks with an Open now panel', () => {
  const yml = rd('.github/workflows/council.yml'), dh = rd('council/datahealth.mjs'), page = rd('market-structure.html'), js = rd('assets/desk-trades.js'), src = rd('council/edge-desks.mjs');
  assert.match(yml, /timeout 280 node council\/edge-desks\.mjs data \|\| echo/); assert.match(dh, /file: 'lit\/desk\.json'/); assert.match(dh, /file: 'eg\/desk\.json'/);
  assert.match(dh, /file: 'msnr\/desk\.json'/);
  for (const k of ['lit', 'eg', 'msnr']) { assert.match(page, new RegExp(`<section class="view adm" id="v-${k}"`)); assert.match(page, new RegExp(`${k}: 'desks'`)); assert.match(js, new RegExp(`${k}/desk\\.json`)); }
  assert.match(page, /const VIEWS = \[[^\]]*'lit', 'eg'/); assert.equal(page.split('data-dk="open"').length - 1, 3); assert.ok(page.includes('<script src="/assets/desk-trades.js" defer></script>'));
  assert.equal(page.split('<a href="#eg" data-dsw="eg" class="adm">Engulfing</a>').length - 1, 5, 'the switch on every desk');
  assert.doesNotMatch(js, /localStorage|sessionStorage|fetch\(|\.stop\s*=[^=]/, 'the page code only reads the stored record and writes text');
  assert.doesNotMatch(src, /ctrader|alerts\.mjs|trader\.mjs|sendAlerts/, 'a paper record: no order, alert or Trader code');
  assert.match(js, /No trade is open now\./); assert.match(js, /at the last reading/); assert.match(js, /not a tested rule/);
});

// ─── the three zone methods on the Engulfing desk, and the MSNR desk (21 Nov 2026) ───
import * as G from '../council/eg-methods.mjs';
const B15 = (() => { const o = { ...B }, sec = 900, out = []; for (const b of B['5m']) { const t = b.time - (b.time % sec), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } o['15m'] = out; return o; })();

test('engulf zones: a zone is the engulfed candle, known at the engulfing close, touched and failed only by later candles', () => {
  const C = [{ time: 0, open: 10, high: 11, low: 9, close: 9.5 }, { time: 900, open: 9.5, high: 12, low: 9.4, close: 11.5 }, { time: 1800, open: 11.5, high: 12.5, low: 11.2, close: 12 }, { time: 2700, open: 12, high: 12.1, low: 10.5, close: 10.8 }, { time: 3600, open: 10.8, high: 10.9, low: 8, close: 8.5 }];
  const z = G.zones(C, '15m').filter((x) => x.dir > 0)[0]; assert.deepEqual([z.top, z.bot, z.base, z.at], [10, 9, 0, 1800], 'a body engulf: the zone runs from the wick to the engulfed candle\'s open'); assert.equal(z.touch, 3600, 'the first later candle that trades into it'); assert.equal(z.fail, 4500, 'a close through its far side');
  assert.equal(G.zones([{ time: 0, open: 10, high: 11, low: 9, close: 9.5 }, { time: 900, open: 9.5, high: 10.4, low: 9.4, close: 9.9 }], '15m').length, 0, 'a close short of the previous open is no engulf');
});
test('the three methods: a fixed stop on the losing side, a 2R target (the direct entry: none, a trailed stop), one position at a time, no look-ahead', () => {
  const all = G.methodTrades(B15, { from: 0, market: 'xau' }); assert.ok(all.length >= 5, 'entries: ' + all.length);
  let busy = -Infinity;
  for (const r of all) { assert.ok(stopOk(r), 'rule 1: ' + r.id); assert.match(r.kind, /^eg-(plan|simple|direct)$/); assert.ok(Math.abs(Math.abs(r.entry - r.stop) - G.EGM.pips) < 1e-9, '30 pips on gold');
    if (r.kind === 'eg-direct') { assert.equal(r.target, null); assert.ok(['stopped', 'trail', 'open'].includes(r.status)); if (r.status === 'stopped') assert.ok(r.R <= -1 + 1e-9); } else assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - G.EGM.rr) < 1e-9);
    assert.ok(r.t > busy, 'one at a time'); busy = r.endT || Infinity; assert.ok(r.log.every((x, i, a) => !x.t || !i || !a[i - 1].t || x.t >= a[i - 1].t), 'the log runs forward'); assert.ok(r.marks.every((m) => m.at <= r.t || (m.label === 'M5 EF · trailed stop' && m.at <= r.endT)), 'every mark was known by the fill (the trailed stop\'s EF by the exit)'); }
  // cutting the candles after a closed trade's end changes nothing about it (a trade far enough in for the shorter history to hold enough candles)
  const one = all.find((r) => r.endT && r.endT < END - 5 * 86400 && r.t > B['5m'][0].time + 15 * 86400); const cut = Object.fromEntries(Object.entries(B15).map(([tf, a]) => [tf, a.filter((b) => b.time + SOP.SEC[tf] <= one.endT + 3600)]));
  const again = G.methodTrades(cut, { from: 0, market: 'xau' }).find((r) => r.id === one.id); assert.ok(again); assert.deepEqual([again.entry, again.stop, again.R, again.endT], [one.entry, one.stop, one.R, one.endT]);
  const fxB = Object.fromEntries(Object.entries(B15).map(([tf, a]) => [tf, a.map((b) => ({ time: b.time, open: b.open * 1.15 / 4000, high: b.high * 1.15 / 4000, low: b.low * 1.15 / 4000, close: b.close * 1.15 / 4000 }))]));
  const fxT = G.methodTrades(fxB, { from: 0, market: 'eurusd' }); assert.ok(fxT.length && fxT.every((r) => stopOk(r) && /^eurusd:eg-/.test(r.id) && Math.abs(r.r0 / r.entry - G.EGM.pips / 4000) < 2e-4), 'another market: the same share of price');
});
test('MSNR desk: entries with the call only, the study\'s own functions and constants put back, the gold plan on gold only', () => {
  const big = market(140, 5), b15 = { ...big }; { const out = []; for (const b of big['5m']) { const t = b.time - (b.time % 900), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } b15['15m'] = out; }
  const end = big['5m'].at(-1).time + 300, fr = end - 60 * 86400, ms = E.msnrTrades(b15, { from: fr, market: 'xau' });
  assert.ok(ms.length >= 5, 'entries: ' + ms.length); let busy = -Infinity;
  for (const r of ms) { assert.ok(stopOk(r), 'rule 1: ' + r.id); assert.match(r.kind, /^msnr-(main|other)$/); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - E.MSNR.rr) < 1e-6); assert.ok(r.t > busy); busy = r.endT || Infinity; assert.ok(r.t >= fr); }
  const src = rd('council/edge-desks.mjs'); assert.match(src, /from '\.\.\/research\/edge\/msnr-entry\/run\.mjs'/); assert.match(src, /finally \{ MS\.P\.PAD = keep\.PAD; MS\.P\.MIN_R0 = keep\.MIN_R0; \}/);
  E.msnrTrades(Object.fromEntries(Object.entries(b15).map(([tf, a]) => [tf, a.map((b) => ({ time: b.time, open: b.open / 3000, high: b.high / 3000, low: b.low / 3000, close: b.close / 3000 }))])), { from: fr, market: 'eurusd' });
  const P = require('node:module'); void P; 
  const sn = G.snrTrades(b15, { from: fr, market: 'xau' }); for (const r of sn) { assert.ok(stopOk(r)); assert.match(r.kind, /^msnr-(sop|qm)$/); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - G.SNR.rr) < 1e-9); }
  const perDay = {}; for (const r of sn) { const d = Math.floor(r.t / 86400); perDay[d] = (perDay[d] || 0) + 1; assert.ok(perDay[d] <= G.SNR.perDay, 'at most two a day'); }
  assert.deepEqual(G.snrTrades(b15, { from: fr, market: 'eurusd' }), [], 'the plan is for gold');
  const egSrc = rd('council/eg-methods.mjs'); assert.doesNotMatch(egSrc, /ctrader|alerts\.mjs|trader\.mjs|sendAlerts|fetch\(/, 'a paper reading: no order, alert, network or Trader code');
  assert.doesNotMatch(egSrc + src, /L3XUS|LEXUS|t\.me\//i, 'the documents are read in the desk\'s own words, never named or copied');
});

test('the direction reading: every switch names a tapped key level of the timeframe above and the external level it broke, nothing reads ahead', () => {
  let s = 77; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const H4 = []; let p = 4000, drift = 0;
  for (let i = 0, t = 1767571200; i < 2400; i++, t += 14400) { if (new Date(t * 1000).getUTCDay() % 6 === 0) continue; if (i % 40 === 0) drift = (rnd() - 0.5) * 12;
    const o = p, c = o + drift + (rnd() - 0.5) * 30, h = Math.max(o, c) + rnd() * 8, l = Math.min(o, c) - rnd() * 8; H4.push({ time: t, open: o, high: h, low: l, close: c }); p = c; }
  const day = (t) => Math.floor(t / 86400) * 86400, D = G.direction(H4, day, 86400);
  assert.ok(D.events.length >= 5, 'switches: ' + D.events.length);
  let prev = 0;
  for (const e of D.events) {
    assert.ok(['v', 'a', 'oc', 'eg', 'ef', 'dom'].includes(e.kind)); assert.ok(e.kind === 'oc' ? e.top >= e.bottom : e.top > e.bottom);
    assert.ok(e.zoneAt <= e.tapT + 14400 && e.tapT <= e.t, 'the zone is known and tapped before the break'); assert.ok(e.levelT < e.tapT, 'the level existed before the tap: external');
    assert.ok(e.s > 0 ? H4[e.i].close > e.level : H4[e.i].close < e.level, 'a close beyond the level'); assert.notEqual(e.s, prev); prev = e.s;
    assert.equal(D.call[e.i], e.s); assert.equal(D.events[D.last[e.i]], e);
    // the switch is the FIRST close beyond the level from the tap candle on (a candle that taps and closes beyond is the breakout candle)
    for (let j = H4.findIndex((x) => x.time === e.tapT); j < e.i; j++) assert.ok(e.s > 0 ? !(H4[j].close > e.level) : !(H4[j].close < e.level), 'no earlier close beyond the level'); }
  for (let i = 1; i < H4.length; i++) if (D.call[i] !== D.call[i - 1]) assert.ok(D.events.some((e) => e.i === i), 'the direction changes only at a switch');
  // cut at a candle: the reading up to it is unchanged; and with every later price moved, unchanged too
  const N = 1100, cut = G.direction(H4.slice(0, N), day, 86400), moved = G.direction(H4.map((b, i) => (i < N ? b : { time: b.time, open: b.open + 500, high: b.high + 500, low: b.low + 500, close: b.close + 500 })), day, 86400);
  for (let i = 0; i < N; i++) { assert.equal(cut.call[i], D.call[i]); assert.equal(moved.call[i], D.call[i]); }
  // an A level is a turn of the closes, not a wick
  const src = fs.readFileSync(new URL('../council/eg-methods.mjs', import.meta.url), 'utf8');
  assert.match(src, /lastA = \{ p: x\.close/); assert.match(src, /add\(1, 'v', x\.low, x\.close/); assert.match(src, /add\(-z\.s, 'ef'/);
});

test('every desk record carries the key levels its reading used as chart marks', () => {
  const src = fs.readFileSync(new URL('../council/eg-methods.mjs', import.meta.url), 'utf8') + fs.readFileSync(new URL('../council/edge-desks.mjs', import.meta.url), 'utf8');
  for (const l of ['Daily EG zone', 'H4 EG zone', "tn + zw(m)", 'M5 EF (zone failed)', 'M5 EG zone · entry', 'H4 EF (zone failed)', 'Daily ${S.key.kind} level', 'level · BO ${word(d)}', "ef: 'EF zone'", "v: 'V level'", 'M15 EG', 'M5 EG'])
    assert.ok(src.includes(l), 'mark: ' + l);
});

test('a limit entry: on its fill candle only the stop counts, never the target, the best-so-far or the trail', () => {
  // a buy limit at 100, stop 99, target 102: the fill candle's high (103) came before the fill and must not be a win or a run
  const bars = [{ time: 0, open: 103, high: 103, low: 99.9, close: 100.2 }, { time: 300, open: 100.2, high: 100.4, low: 98.9, close: 99 }];
  const a = G.outcome(bars, 0, 1, 100, 99, 102, 1e9); assert.deepEqual([a.status, a.R, a.endT, a.mfe], ['stopped', -1, 300, 0]);
  const b = E.egOutcome({ side: 1, entry: 100, stop: 99, target: 110, r0: 1 }, bars, 0, 1e9); assert.deepEqual([b.status, b.R, b.mfe], ['stopped', -1, 0], 'the trail was not armed by the fill candle\'s high');
  const c = SOP.outcome({ side: 1, entry: 100, stop: 99, target: 102 }, bars, 0, true); assert.deepEqual([c.status, c.R, c.mfe], ['stopped', -1, 0]);
  const m = SOP.outcome({ side: 1, entry: 100, stop: 99, target: 102 }, bars, 0); assert.equal(m.status, 'target', 'a market entry at the candle\'s open is read as before');
  // the stop still counts on the fill candle
  const s = G.outcome([{ time: 0, open: 101, high: 101, low: 98.5, close: 99 }], 0, 1, 100, 99, 102, 1e9); assert.equal(s.status, 'stopped');
});

// ─── the independent audit of 21 Nov 2026: each defect it confirmed, pinned ───
const G2 = await import('../council/eg-methods.mjs');
const m15of = (m5) => { const out = []; for (const b of m5) { const t = b.time - (b.time % 900), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ ...b, time: t }); } return out; };
const cutAt = (X, T) => Object.fromEntries(Object.entries(X).map(([tf, a]) => [tf, a.filter((b) => b.time + ({ ...SOP.SEC, '15m': 900 })[tf] <= T)]));

test('audit: a candle that opens beyond the stop exits at its open, worse than -1R', () => {
  const gap = [{ time: 0, open: 100, high: 100.5, low: 99.5, close: 100 }, { time: 300, open: 96, high: 96.5, low: 95, close: 95.5 }];
  const a = E.egOutcome({ side: 1, entry: 100, stop: 99, target: 110, r0: 1 }, gap, 0, 1e9); assert.equal(a.status, 'stopped'); assert.equal(a.exit, 96); assert.equal(a.R, -4);
  const b = G2.outcome(gap, 0, 1, 100, 99, 102, 1e9); assert.equal(b.exit, 96); assert.equal(b.R, -4);
  const c = SOP.outcome({ side: 1, entry: 100, stop: 99, target: 103 }, gap, 0); assert.equal(c.exit, 96); assert.equal(c.R, -4);
  // a stop traded inside the candle is still the stop
  assert.equal(E.egOutcome({ side: 1, entry: 100, stop: 99, target: 110, r0: 1 }, [gap[0], { time: 300, open: 99.6, high: 99.8, low: 98, close: 98.5 }], 0, 1e9).R, -1);
});

test('audit: MSNR on a 5-decimal market keeps full precision (a stop is the trigger pair\'s extreme and the pad, a target is 1.5R)', () => {
  const X = market(60, 5, 1.15, 0.0005), rows = E.msnrTrades(X, { from: 0, market: 'eurusd' }); assert.ok(rows.length >= 10, 'entries: ' + rows.length);
  const grid = rows.filter((r) => Math.abs(r.stop * 1000 - Math.round(r.stop * 1000)) < 1e-9).length; assert.ok(grid < rows.length / 4, 'stops are not on a 0.001 grid: ' + grid + ' of ' + rows.length);
  for (const r of rows) { assert.ok(stopOk(r)); if (r.status === 'target') assert.ok(Math.abs(r.R - E.MSNR.rr) < 1e-9, 'a target books 1.5R: ' + r.R); if (r.status === 'stopped') assert.ok(r.R <= -1 + 1e-9); }
});

test('audit: the gold plan books in the order of the fills (cut just after an entry, the entry is already there) and an H4 break is a break', () => {
  let seen = 0;
  // entries from the 35th day on: the reading needs 20 closed days first
  for (const seed of [11, 4]) { const X = seed === 11 ? B : market(60, seed), Y = { ...X, '15m': m15of(X['5m']) }, full = G2.snrTrades(Y, { from: 0 });
    for (const r of full.filter((x) => x.t > X['5m'][0].time + 35 * 86400).slice(0, 30)) { const T = r.t + 300, early = G2.snrTrades(cutAt(Y, T), { from: 0 }); seen++;
      assert.ok(early.some((e) => e.id === r.id && e.entry === r.entry && e.stop === r.stop), 'seed ' + seed + ': found only with later candles: ' + r.id); }
    const H4 = X['4h']; for (const s of G2.snrSides(X['1d'], H4)) { const i = H4.findIndex((b) => b.time + 14400 === s.t); assert.ok(s.dir > 0 ? H4[i].close > s.level && !(H4[i - 1].close > s.level) : H4[i].close < s.level && !(H4[i - 1].close < s.level), 'the candle that takes the level'); } }
  assert.ok(seen >= 10, 'entries checked: ' + seen);
});

test('audit: LIT: a trade still running on the last candle read is open, a market entry never comes before the sweep is confirmed, a fill candle that reaches the stop is stopped', () => {
  const src = rd('council/edge-desks.mjs');
  assert.match(src, /\(sim\.kind === 'dataEnd' \|\| sim\.kind === 'dayEnd'\) && sim\.tExit >= lastT/); assert.match(src, /Math\.max\(b \+ 1, j0 - 1\)/); assert.match(src, /if \(h\[k\] >= ord\.stop\) \{ const risk = ord\.stop - fp;/);
  for (const seed of [5, 9, 21]) { const X = market(120, seed), lit = E.litTrades(X, { from: 0, market: 'xau' }), lastT = X['5m'].at(-1).time;
    for (const r of lit) { if (r.status !== 'open') assert.ok(r.endT - 300 < lastT || r.status !== 'dayend', 'a day-end on the last candle read is an open trade: ' + r.id);
      if (r.kind === 'lit-break') assert.ok(r.t >= r.log[0].t, 'the market entry is not before the sweep is known: ' + r.id); } }
});

test('audit: a daily order placed before the window that is still alive in it is kept, and the zone keeps its one order', () => {
  const X = market(90, 11), end = X['5m'].at(-1).time + 300, wide = E.egTrades(X, { from: end - 60 * 86400, market: 'xau' }), near = E.egTrades(X, { from: end - 14 * 86400, market: 'xau' });
  const live = wide.filter((r) => r.endT == null || r.endT >= end - 14 * 86400);
  for (const r of live) assert.ok(near.some((n) => n.id === r.id), 'dropped at the window edge: ' + r.id);
  for (const n of near) assert.ok(wide.some((r) => r.id === n.id), 'a second order on a zone at the window edge: ' + n.id);
});

test('audit: the direction: a zone tapped just before the BO the other way still counts, a break with no BO the other way does not; a zone is marked from when it was known', () => {
  const src = rd('council/eg-methods.mjs'); assert.match(src, /if \(st === -q\.s\) q\.opp = true;/); assert.match(src, /if \(!q\.opp\) continue;/); assert.match(src, /zoneAt: q\.zone\.known/);
  assert.match(src, /pipOf = \(entry\) =>/);
});

test('a stop does not change between two reads: on another market the sizes scale from the trade\'s own price, not the newest candle\'s', () => {
  // the same candles, then two more weeks in which the price doubles: every trade closed before must keep its stop
  const X = market(40, 5, 1.15, 0.0005), T = X['5m'].at(-1).time, far = { '5m': X['5m'].slice() }; let p = X['5m'].at(-1).close;
  for (let i = 1; i <= 14 * 288; i++) { const t = T + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue; const c = p * 1.0002; far['5m'].push({ time: t, open: p, high: c * 1.00005, low: p * 0.99995, close: c }); p = c; }
  for (const tf of ['1h', '4h', '1d']) { const sec = SOP.SEC[tf], out = []; for (const b of far['5m']) { const t = b.time - (b.time % sec), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } far[tf] = out; }
  assert.ok(far['5m'].at(-1).close > 1.5 * X['5m'].at(-1).close);
  for (const [name, fn] of [['msnr', E.msnrTrades], ['lit', E.litTrades]]) {
    const a = fn(X, { from: 0, market: 'eurusd' }).filter((r) => r.endT != null && r.endT < T - 86400), b = new Map(fn(far, { from: 0, market: 'eurusd' }).map((r) => [r.id, r]));
    assert.ok(a.length >= 5, name + ' trades: ' + a.length);
    for (const r of a) { const q = b.get(r.id); assert.ok(q, name + ': the trade is still read: ' + r.id); assert.ok(Math.abs(q.stop - r.stop) < 1e-12 && Math.abs(q.entry - r.entry) < 1e-12, name + ': same stop: ' + r.id); }
  }
});

test('the documents, page by page: a failed H4 zone is a zone too, the trigger is an M15 or an M30 engulf, "inside" is inside, exits are the stop or the target', () => {
  let ef = 0, m30 = 0, direct = 0, snr30 = 0;
  for (const seed of [11, 5, 23, 31, 47]) { const X = market(120, seed), Y = { ...X, '15m': m15of(X['5m']) };
    const all = G.methodTrades(Y, { from: 0, market: 'xau' }), sn = G.snrTrades(Y, { from: 0, market: 'xau' });
    for (const r of all.concat(sn)) { assert.ok(stopOk(r)); assert.ok(['target', 'stopped', 'open'].concat(r.kind === 'eg-direct' ? ['trail'] : []).includes(r.status), 'no time exit: ' + r.status); assert.ok(!/24 hours/.test(r.log.map((x) => x.text).join(' '))); }
    for (const r of all) { if (r.marks.some((m) => m.label === 'H4 EF (zone failed)')) ef++; if (r.marks.some((m) => m.label === 'M30 EG zone')) m30++;
      if (r.kind === 'eg-direct') { direct++; const [h4, h1, m15] = r.marks; assert.ok(h1.top <= h4.top && h1.bot >= h4.bot && m15.top <= h1.top && m15.bot >= h1.bot, 'each fresh zone lies inside the one above'); } }
    const perDay = {}; for (const r of sn) { const d = Math.floor(r.t / 86400); perDay[d] = (perDay[d] || 0) + 1; assert.ok(perDay[d] <= G.SNR.perDay); if (/-30$/.test(r.id)) { snr30++; assert.equal(r.l, '30m'); } }
    assert.equal(new Set(sn.map((r) => r.id)).size, sn.length); }
  assert.ok(ef >= 1, 'entries in a failed H4 zone: ' + ef); assert.ok(m30 >= 1, 'entries on an M30 engulf: ' + m30);
  const src = rd('council/eg-methods.mjs'); assert.match(src, /a\.top <= b\.top && a\.bot >= b\.bot/); assert.ok(!/EGM\.hold\)/.test(src), 'no 24-hour exit is passed any more');
});

// ─── 21 Nov 2026: what the documents define that the desks did not apply yet ───
test('direct entry: the stop is trailed with the M5 EF, only tightens, only from zones failed after the fill, no target', () => {
  const bar = (i, o, h, l, c) => ({ time: i * 300, open: o, high: h, low: l, close: c });
  const M5 = [bar(0, 101, 101.2, 99.9, 100.5), bar(1, 100.5, 102, 100.4, 101.8), bar(2, 101.8, 104, 101.7, 103.9), bar(3, 103.9, 104.2, 103, 103.2), bar(4, 103.2, 103.3, 101.4, 101.5)];
  // sell zones (dir -1): one failed before the fill closed (ignored), one failed at 900 (the close of candle 2): the stop moves to its bottom 101.6
  const Z = [{ dir: -1, top: 99.5, bot: 99, fail: 0, base: -600 }, { dir: -1, top: 102.5, bot: 101.6, fail: 900, base: 300 }, { dir: -1, top: 98, bot: 96, fail: 900, base: 0 }, { dir: 1, top: 103, bot: 102, fail: 900, base: 0 }];
  const o = G.efTrail(M5, Z, 0, 1, 100, 97);
  assert.equal(o.status, 'trail'); assert.equal(o.stop, 101.6, 'the tighter EF only; a looser one and a buy zone do not move it'); assert.equal(o.moves, 1);
  assert.equal(o.endT, 1200); assert.ok(Math.abs(o.R - 1.6 / 3) < 1e-9, 'R from the opening risk');
  // no zone failed after the fill: the opening stop, -1R; the fill candle never moves or arms anything
  const s = G.efTrail([bar(0, 100.5, 100.6, 99.9, 100.2), bar(1, 100.2, 100.3, 96.5, 96.8)], [{ dir: -1, top: 99.8, bot: 99.5, fail: 0, base: 0 }], 0, 1, 100, 97);
  assert.deepEqual([s.status, s.R, s.moves], ['stopped', -1, 0]);
  // a sell mirrors it
  const neg = (b) => ({ time: b.time, open: -b.open, high: -b.low, low: -b.high, close: -b.close });
  const m = G.efTrail(M5.map(neg), Z.map((z) => ({ ...z, dir: -z.dir, top: -z.bot, bot: -z.top })), 0, -1, -100, -97);
  assert.equal(m.status, 'trail'); assert.equal(m.stop, -101.6); assert.ok(Math.abs(m.R - o.R) < 1e-9);
  // in the desk: every direct trade has no target, a trailed exit books what its stop gave, cutting the candles after its end changes nothing
  let n = 0, tr = 0;
  for (const seed of [11, 5, 23, 31, 47, 61]) { const X = market(120, seed), Y = { ...X, '15m': m15of(X['5m']) };
    for (const r of G.methodTrades(Y, { from: 0, market: 'xau' }).filter((x) => x.kind === 'eg-direct')) { n++; assert.equal(r.target, null); assert.ok(stopOk(r));
      if (r.status === 'trail') { tr++; assert.ok(r.stopNow != null && (r.side > 0 ? r.stopNow > r.stop : r.stopNow < r.stop), 'the trailed stop is tighter'); assert.ok(r.marks.some((k) => k.label === 'M5 EF · trailed stop')); }
      if (r.endT && r.endT < X['5m'].at(-1).time - 2 * 86400) { const again = G.methodTrades(cutAt(Y, r.endT + 3600), { from: 0, market: 'xau' }).find((x) => x.id === r.id);
        if (again) assert.deepEqual([again.entry, again.stop, again.R, again.endT, again.status], [r.entry, r.stop, r.R, r.endT, r.status], 'no look-ahead: ' + r.id); } } }
  assert.ok(n >= 1, 'direct entries: ' + n);
});

test('gold plan, second entry type: a QM on the closes (shoulder, high, lower head, close beyond the high), limit at the shoulder', () => {
  const cl = [12, 11, 9, 10, 10.5, 11, 10, 8, 9, 10, 11.5, 12, 12.5], T0 = 1790553600;
  const C = cl.map((c, i) => ({ time: T0 + i * 900, open: i ? cl[i - 1] : c, high: Math.max(c, i ? cl[i - 1] : c) + 0.2, low: Math.min(c, i ? cl[i - 1] : c) - 0.2, close: c }));
  const q = G.qmSetups(C).filter((x) => x.tf === '15m');
  assert.equal(q.length, 1); assert.deepEqual([q[0].dir, q[0].level, q[0].mid, q[0].at, q[0].head.close], [1, 9, 11, C[10].time + 900, 8]);
  assert.ok(q[0].top === 9 && q[0].bot < 9, 'the zone is the shoulder candle, from its close to its wick');
  assert.equal(G.qmSetups(C.slice(0, 10)).filter((x) => x.tf === '15m').length, 0, 'not before the close beyond the high');
  // a break of the high before the head is a known turn is not this shape
  const early = cl.slice(); early[8] = 11.5; const E2 = early.map((c, i) => ({ ...C[i], close: c, open: i ? early[i - 1] : c, high: Math.max(c, i ? early[i - 1] : c) + 0.2, low: Math.min(c, i ? early[i - 1] : c) - 0.2 }));
  assert.equal(G.qmSetups(E2).filter((x) => x.tf === '15m' && x.level === 9).length, 0);
  // a sell mirrors it
  const S = C.map((b) => ({ time: b.time, open: 30 - b.open, high: 30 - b.low, low: 30 - b.high, close: 30 - b.close })), qs = G.qmSetups(S).filter((x) => x.tf === '15m');
  assert.equal(qs.length, 1); assert.deepEqual([qs[0].dir, qs[0].level, qs[0].mid], [-1, 21, 19]);
  // in the desk: QM entries, a 30-pip stop on the losing side, a 3R target, entry at a shoulder; found with the candles cut just after the fill
  let n = 0;
  for (const seed of [11, 4, 5, 23]) { const X = seed === 11 ? B : market(90, seed), Y = { ...X, '15m': m15of(X['5m']) }, sn = G.snrTrades(Y, { from: 0 }), shoulders = new Set(G.qmSetups(Y['15m']).map((x) => x.level));
    for (const r of sn.filter((x) => x.kind === 'msnr-qm')) { n++; assert.ok(stopOk(r)); assert.ok(Math.abs(Math.abs(r.entry - r.stop) - 3) < 1e-9); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - G.SNR.rr) < 1e-9); assert.ok(shoulders.has(r.entry));
      assert.match(r.id, /^msnr-qm-[bs]-\d+(-30)?$/); assert.ok(r.marks.some((m) => / QM zone · entry$/.test(m.label)));
      if (n <= 12 && r.t > X['5m'][0].time + 35 * 86400) assert.ok(G.snrTrades(cutAt(Y, r.t + 300), { from: 0 }).some((e) => e.id === r.id && e.entry === r.entry && e.stop === r.stop), 'no look-ahead: ' + r.id); }
    const perDay = {}; for (const r of sn) { const d = Math.floor(r.t / 86400); perDay[d] = (perDay[d] || 0) + 1; assert.ok(perDay[d] <= G.SNR.perDay, 'two a day over both entry types'); } }
  assert.ok(n >= 1, 'QM entries: ' + n);
});

test('review 21 Nov 2026: one QM per shape, no fill before the 5-minute history, a stop text that says the booked R', () => {
  for (const seed of [11, 4, 5, 23, 31, 47]) { const X = seed === 11 ? B : market(120, seed), Y = { ...X, '15m': m15of(X['5m']) };
    const q = G.qmSetups(Y['15m']), keys = q.map((x) => [x.tf, x.dir, x.base, x.at].join(':'));
    assert.equal(new Set(keys).size, keys.length, 'no QM twice (two heads under one shoulder and break), seed ' + seed);
    const sn = G.snrTrades(Y, { from: 0 }); assert.equal(new Set(sn.map((r) => r.id)).size, sn.length, 'no id twice, seed ' + seed);
    // the 5-minute candles start 13 days after the 15-minute ones: no order placed before them fills at their first candle
    const late = { ...Y, '5m': Y['5m'].filter((b) => b.time >= Y['5m'][0].time + 13 * 86400) }, first = late['5m'][0].time;
    for (const r of G.snrTrades(late, { from: 0 })) { const placed = r.log[1].t; assert.ok(placed >= first, 'placed after the 5-minute history starts: ' + r.id); assert.ok(r.t - placed <= 2 * 3600 + 300, 'filled inside its two hours: ' + r.id); }
    for (const r of G.methodTrades({ ...late, '15m': Y['15m'] }, { from: 0, market: 'xau' })) assert.ok(r.t >= first, r.id); }
  const src = rd('council/eg-methods.mjs'); assert.doesNotMatch(src, /'Stopped: −1\.00R'/, 'a gap at the open books worse than −1R: the text says the booked R');
});

test('open-close levels: a Daily level type of the gold plan, and a key level of the direction reading', () => {
  // the gold plan: a Daily rejection of an OC level (two candles of one colour; the level where the first closed)
  let oc = 0;
  for (const seed of [11, 4, 5, 23, 31]) { const X = seed === 11 ? B : market(120, seed), D1 = X['1d'].filter((b) => { const w = new Date(b.time * 1000).getUTCDay(); return w && w < 6; });
    for (const s of G.snrSides(D1, X['4h'])) { if (s.key.kind !== 'OC') continue; oc++; const j = D1.findIndex((b) => b.time === s.key.t) - 1, a = D1[j], b = D1[j + 1];
      assert.equal(a.close, s.key.p); assert.ok((a.close > a.open) === (b.close > b.open), 'two candles of one colour'); assert.ok(s.key.t < s.day, 'the level existed before the rejecting candle'); } }
  assert.ok(oc >= 1, 'rejections of an OC level: ' + oc);
  // the direction: an OC level is a key level; two up candles that are not a dominant pair give a buy level at the junction
  const day = (t) => Math.floor(t / 86400) * 86400;
  const src = rd('council/eg-methods.mjs'); assert.match(src, /add\(1, 'oc', Math\.min\(p\.close, c\.open\), Math\.max\(p\.close, c\.open\)/); assert.match(src, /!domU\) add/);
  // across a long random path every OC switch names a same-colour pair of the timeframe above that is not a dominant pair
  let s = 77; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; const P = []; let p = 4000, drift = 0;
  for (let i = 0, t = 1767571200; i < 4000; i++, t += 14400) { if (new Date(t * 1000).getUTCDay() % 6 === 0) continue; if (i % 40 === 0) drift = (rnd() - 0.5) * 12; const o = p, c = o + drift + (rnd() - 0.5) * 30; P.push({ time: t, open: o, high: Math.max(o, c) + rnd() * 8, low: Math.min(o, c) - rnd() * 8, close: c }); p = c; }
  const R = G.direction(P, day, 86400), days = []; for (const b of P) { const k = day(b.time), q = days[days.length - 1]; if (q && q.time === k) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else days.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); }
  const ocs = R.events.filter((e) => e.kind === 'oc'); assert.ok(ocs.length >= 1, 'switches on an OC level: ' + ocs.length);
  for (const e of ocs) { const j = days.findIndex((d) => d.time === e.zoneT), a = days[j], b = days[j + 1], up = e.s > 0;
    assert.ok(up ? a.close > a.open && b.close > b.open : a.close < a.open && b.close < b.open); assert.ok(!(up ? b.close > a.high : b.close < a.low), 'not a dominant pair');
    assert.ok(e.bottom <= a.close && a.close <= e.top); assert.ok(e.zoneAt === b.time + 86400 && e.zoneAt <= e.tapT + 14400); }
});

test('an EG closes beyond the other candle\'s HIGH (a buy) or LOW (a sell); a body engulf alone is not one (owner, 21 Nov 2026)', async () => {
  const { zones } = await import('../council/eg-methods.mjs');
  const c = (i, o, h, l, cl) => ({ time: 1_780_000_000 + i * 3600, open: o, high: h, low: l, close: cl });
  // red 100 -> 99 with a wick to 101; green closes 100.5: above the red's open (a body engulf) but under its high
  assert.equal(zones([c(0, 100, 101, 98.5, 99), c(1, 99, 100.8, 98.8, 100.5)], '1h').length, 0);
  // the same green closing 101.2, above the high: an EG, whatever it opened at
  const z = zones([c(0, 100, 101, 98.5, 99), c(1, 99.6, 101.5, 99.2, 101.2)], '1h');
  assert.equal(z.length, 1); assert.equal(z[0].dir, 1); assert.equal(z[0].top, 100); assert.equal(z[0].bot, 98.5);
  // a sell mirrors it: green, then red closing under the green's LOW
  assert.equal(zones([c(0, 99, 100.5, 98.6, 100), c(1, 100, 100.2, 98.8, 98.7)], '1h').length, 0);
  const s = zones([c(0, 99, 100.5, 98.6, 100), c(1, 100, 100.2, 98.2, 98.4)], '1h');
  assert.equal(s.length, 1); assert.equal(s[0].dir, -1); assert.equal(s[0].bot, 99); assert.equal(s[0].top, 100.5);
});

// 21 Nov 2026 (owner, on a EUR/USD plan buy: "there is no eg sell fail on m5 to enter buy"): the M5 engulf that failed must be
// formed into or at the zone, so its range touches the H4 zone or the M15 / M30 engulf zone of the trade
test('plan and simple: the failed M5 zone touches the H4 zone or the M15 / M30 engulf zone', () => {
  let n = 0;
  for (const r of G.methodTrades(B15, { from: 0, market: 'xau' }).filter((x) => x.kind === 'eg-plan' || x.kind === 'eg-simple')) { n++;
    const ef = r.marks.find((k) => k.label === 'M5 EF (zone failed)'), zs = r.marks.filter((k) => /^H4 E[GF]|^M(15|30) (EG zone|EF \(zone failed\))$/.test(k.label));
    assert.ok(ef && zs.length >= 2, r.id); const lo = Math.min(...zs.map((z) => z.bot)), hi = Math.max(...zs.map((z) => z.top));
    assert.ok(ef.bot <= hi && ef.top >= lo, 'the failed M5 zone is away from the zone: ' + r.id); }
  assert.ok(n >= 1, 'plan / simple entries on these candles: ' + n);
  assert.match(rd('council/eg-methods.mjs'), /\|\| !atZone\(z\)\) continue;/);
});

// 21 Nov 2026 (owner: "the fail is the same logic as entry for other timeframes"): an EF counts like an EG on every timeframe
test('an EF counts like an EG: a failed opposite M15 / M30 zone triggers, an earlier M5 EF can be the entry; stops hold; no hindsight', () => {
  const all = G.methodTrades(B15, { from: 0, market: 'xau' }), plan = all.filter((r) => r.kind === 'eg-plan' || r.kind === 'eg-simple');
  const efTrig = plan.filter((r) => r.marks.some((k) => /^M(15|30) EF \(zone failed\)$/.test(k.label))), efEntry = plan.filter((r) => r.marks.some((k) => k.label === 'M5 EF zone · entry'));
  assert.ok(efTrig.length >= 1, 'entries on a failed M15 / M30 zone: ' + efTrig.length); assert.ok(efEntry.length >= 1, 'entries at an earlier M5 EF: ' + efEntry.length);
  for (const r of efTrig.concat(efEntry)) { assert.ok(stopOk(r), r.id); assert.match(r.log[0].text, /engulf (zone failed|[a-z]+ closed)/);
    const one = G.methodTrades(cutAt(B15, r.t + 900), { from: 0, market: 'xau' }).find((x) => x.id === r.id); assert.ok(one, 'found when cut just after the fill: ' + r.id); assert.equal(one.entry, r.entry); }
  const sn = G.snrTrades(B15, { from: 0, market: 'xau' }); assert.ok(sn.filter((r) => /-ef$/.test(r.id)).every((r) => stopOk(r) && r.marks.some((k) => / EF zone · entry$/.test(k.label))));
});
