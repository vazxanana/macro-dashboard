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
    const fx4 = E.EG.fixed[r.h], tR = fx4 ? fx4.rr : E.EG.target; assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - tR) < 1e-9, 'the target is 10R (4R on D1 and H4 since 22 Nov 2026, the owner\'s choice)');
    if (r.status === 'stopped') assert.ok(r.R <= -1 + 1e-9, 'a stop is -1R, or worse when a candle opened beyond it'); if (r.status === 'target') assert.equal(r.R, tR); if (fx4) assert.notEqual(r.status, 'trail', 'a fixed target has no trail');
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
  assert.deepEqual(Object.keys(E.DESKS), ['eg', 'msnr', 'lit', 'fade', 'bigfade', 'roundfade', 'boxfade', 'fvg', 'goldvb', 'jpyvb', 'nq1', 'zero', 'lyriac', 'dom']); assert.equal(E.DESKS.lit.markets.length, 11); assert.deepEqual(E.OLD, ['eg', 'msnr', 'lit']); assert.deepEqual(E.DESKS.eg.markets, Object.keys(SOP.MARKETS));
});

test('wiring: the loop runs the trackers, data health lists the files, and the page has both desks with an Open now panel', () => {
  const yml = rd('.github/workflows/council.yml'), dh = rd('council/datahealth.mjs'), page = rd('market-structure.html'), js = rd('assets/desk-trades.js'), src = rd('council/edge-desks.mjs');
  assert.match(yml, /timeout 280 node council\/edge-desks\.mjs data --only eg,msnr,lit \|\| echo/); assert.match(dh, /file: 'lit\/desk\.json'/); assert.match(dh, /file: 'eg\/desk\.json'/);
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
  const z = G.zones(C, '15m').filter((x) => x.dir > 0)[0]; assert.deepEqual([z.top, z.bot, z.base, z.at], [11, 9, 0, 1800], 'the zone is the engulfed candle, wick to wick'); assert.equal(z.touch, 2700, 'the first later candle that trades into it'); assert.equal(z.fail, 4500, 'a close through its far side');
  assert.equal(G.zones([{ time: 0, open: 10, high: 11, low: 9, close: 9.5 }, { time: 900, open: 9.5, high: 10.4, low: 9.4, close: 9.9 }], '15m').length, 0, 'a close short of the previous open is no engulf');
});
test('the three methods: a fixed stop on the losing side, a 2R target (the direct entry: none, a trailed stop), one position at a time, no look-ahead', () => {
  const all = G.methodTrades(B15, { from: 0, market: 'xau' }); assert.ok(all.length >= 5, 'entries: ' + all.length);
  let busy = -Infinity;
  for (const r of all) { assert.ok(stopOk(r), 'rule 1: ' + r.id); assert.match(r.kind, /^eg-(plan|simple|direct)$/); assert.ok(Math.abs(Math.abs(r.entry - r.stop) - G.EGM.pips) < 1e-9, '30 pips on gold');
    if (r.kind === 'eg-direct') { assert.equal(r.target, null); assert.ok(['stopped', 'trail', 'open'].includes(r.status)); if (r.status === 'stopped') assert.ok(r.R <= -1 + 1e-9); } else assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - (G.RR[r.kind] || G.EGM.rr)) < 1e-9, 'each reading has its own target (owner, 22 Nov 2026)');
    assert.ok(r.t > busy, 'one at a time'); busy = r.endT || Infinity; assert.ok(r.log.every((x, i, a) => !x.t || !i || !a[i - 1].t || x.t >= a[i - 1].t), 'the log runs forward'); assert.ok(r.marks.every((m) => m.at <= r.t || (m.label === 'M5 EF · trailed stop' && m.at <= r.endT)), 'every mark was known by the fill (the trailed stop\'s EF by the exit)'); }
  // cutting the candles after a closed trade's end changes nothing about it (a trade far enough in for the shorter history to hold enough candles)
  const one = all.find((r) => r.endT && r.endT < END - 5 * 86400 && r.t > B['5m'][0].time + 15 * 86400); const cut = Object.fromEntries(Object.entries(B15).map(([tf, a]) => [tf, a.filter((b) => b.time + SOP.SEC[tf] <= one.endT + 3600)]));
  const again = G.methodTrades(cut, { from: 0, market: 'xau' }).find((r) => r.id === one.id); assert.ok(again); assert.deepEqual([again.entry, again.stop, again.R, again.endT], [one.entry, one.stop, one.R, one.endT]);
  const fxB = Object.fromEntries(Object.entries(B15).map(([tf, a]) => [tf, a.map((b) => ({ time: b.time, open: b.open * 1.15 / 4000, high: b.high * 1.15 / 4000, low: b.low * 1.15 / 4000, close: b.close * 1.15 / 4000 }))]));
  const fxT = G.methodTrades(fxB, { from: 0, market: 'eurusd' }); assert.ok(fxT.length && fxT.every((r) => stopOk(r) && /^eurusd:eg-/.test(r.id) && Math.abs(r.r0 - 0.0030) < 1e-9), 'another market: 30 of its own pips (EUR/USD 0.0030)');
  assert.deepEqual(['xau', 'xag', 'eurusd', 'usdjpy', 'nas100'].map((m) => +G.stopSize(m).toFixed(5)), [3, 0.3, 0.003, 0.3, 30], '30 pips in points: gold 300 points ($3.00), silver $0.30, EUR/USD 0.0030, USD/JPY 0.30, an index 30 points');
});
test('MSNR desk: entries with the call only, the study\'s own functions and constants put back, the gold plan on gold only', () => {
  const big = market(140, 5), b15 = { ...big }; { const out = []; for (const b of big['5m']) { const t = b.time - (b.time % 900), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } b15['15m'] = out; }
  const end = big['5m'].at(-1).time + 300, fr = end - 60 * 86400, ms = E.msnrTrades(b15, { from: fr, market: 'xau' });
  assert.ok(ms.length >= 5, 'entries: ' + ms.length); let busy = -Infinity;
  for (const r of ms) { assert.ok(stopOk(r), 'rule 1: ' + r.id); assert.match(r.kind, /^msnr-(main|other)$/); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - (r.kind === 'msnr-main' ? E.MSNR.rrMain : E.MSNR.rrOther)) < 1e-6, '4R in the 12-16 UTC window, 3R at other hours (owner, 22 Nov 2026)'); assert.ok(r.t > busy); busy = r.endT || Infinity; assert.ok(r.t >= fr); }
  const src = rd('council/edge-desks.mjs'); assert.match(src, /from '\.\.\/research\/edge\/msnr-entry\/run\.mjs'/); assert.match(src, /finally \{ MS\.P\.PAD = keep\.PAD; MS\.P\.MIN_R0 = keep\.MIN_R0; \}/);
  E.msnrTrades(Object.fromEntries(Object.entries(b15).map(([tf, a]) => [tf, a.map((b) => ({ time: b.time, open: b.open / 3000, high: b.high / 3000, low: b.low / 3000, close: b.close / 3000 }))])), { from: fr, market: 'eurusd' });
  const P = require('node:module'); void P; 
  const sn = G.snrTrades(b15, { from: fr, market: 'xau' }); for (const r of sn) { assert.ok(stopOk(r)); assert.match(r.kind, /^msnr-(sop|qm)$/); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - G.RR[r.kind]) < 1e-9, 'the gold plan: 2R, its QM entry 3R (owner, 22 Nov 2026)'); }
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
  for (const r of rows) { assert.ok(stopOk(r)); if (r.status === 'target') assert.ok(Math.abs(r.R - (r.kind === 'msnr-main' ? E.MSNR.rrMain : E.MSNR.rrOther)) < 1e-9, 'a target books its own R: ' + r.R); if (r.status === 'stopped') assert.ok(r.R <= -1 + 1e-9); }
});

test('audit: the gold plan books in the order of the fills (cut just after an entry, the entry is already there) and an H4 break is a break', () => {
  let seen = 0;
  // entries from the 35th day on: the reading needs 20 closed days first
  for (const seed of [11, 4]) { const X = seed === 11 ? B : market(60, seed), Y = { ...X, '15m': m15of(X['5m']) }, full = G2.snrTrades(Y, { from: 0 });
    for (const r of full.filter((x) => x.t > X['5m'][0].time + 35 * 86400).slice(0, 30)) { const T = r.t + 300, early = G2.snrTrades(cutAt(Y, T), { from: 0 }); seen++;
      assert.ok(early.some((e) => e.id === r.id && e.entry === r.entry && e.stop === r.stop), 'seed ' + seed + ': found only with later candles: ' + r.id); }
    const H4 = X['4h']; for (const s of G2.snrSides(X['1d'], H4)) { const i = H4.findIndex((b) => b.time + 14400 === s.boT); assert.ok(s.dir > 0 ? H4[i].close > s.level && !(H4[i - 1].close > s.level) : H4[i].close < s.level && !(H4[i - 1].close < s.level), 'the candle that takes the level'); } }
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
  assert.match(src, /pipOf = \(\) => stopSize\(market\)/);   // the stop is 30 of the market's own pips, the same on every read
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
  // a break of the high right after the head counts (21 Nov 2026; it was dropped): the QM is known once the head is a known turn
  const early = cl.slice(); early[8] = 11.5; const E2 = early.map((c, i) => ({ ...C[i], close: c, open: i ? early[i - 1] : c, high: Math.max(c, i ? early[i - 1] : c) + 0.2, low: Math.min(c, i ? early[i - 1] : c) - 0.2 }));
  const qe = G.qmSetups(E2).filter((x) => x.tf === '15m' && x.level === 9); assert.equal(qe.length, 1); assert.equal(qe[0].at, C[9].time + 900, 'dated at the close that makes the head a known turn, not at the break before it');
  assert.equal(G.qmSetups(E2.slice(0, 9)).filter((x) => x.tf === '15m' && x.level === 9).length, 0, 'not while the head is not yet a known turn');
  // a close above the high BEFORE the head is not this shape
  const pre = cl.slice(); pre[6] = 11.6; const E3 = pre.map((c, i) => ({ ...C[i], close: c, open: i ? pre[i - 1] : c, high: Math.max(c, i ? pre[i - 1] : c) + 0.2, low: Math.min(c, i ? pre[i - 1] : c) - 0.2 }));
  assert.equal(G.qmSetups(E3).filter((x) => x.tf === '15m' && x.level === 9 && x.mid === 11).length, 0);
  // a sell mirrors it
  const S = C.map((b) => ({ time: b.time, open: 30 - b.open, high: 30 - b.low, low: 30 - b.high, close: 30 - b.close })), qs = G.qmSetups(S).filter((x) => x.tf === '15m');
  assert.equal(qs.length, 1); assert.deepEqual([qs[0].dir, qs[0].level, qs[0].mid], [-1, 21, 19]);
  // in the desk: QM entries, a 30-pip stop on the losing side, a 3R target, entry at a shoulder; found with the candles cut just after the fill
  let n = 0;
  for (const seed of [11, 4, 5, 23]) { const X = seed === 11 ? B : market(90, seed), Y = { ...X, '15m': m15of(X['5m']) }, sn = G.snrTrades(Y, { from: 0 }), shoulders = new Set(G.qmSetups(Y['15m']).map((x) => x.level));
    for (const r of sn.filter((x) => x.kind === 'msnr-qm')) { n++; assert.ok(stopOk(r)); assert.ok(Math.abs(Math.abs(r.entry - r.stop) - 3) < 1e-9); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - G.RR['msnr-qm']) < 1e-9); assert.ok(shoulders.has(r.entry));
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
  assert.equal(z.length, 1); assert.equal(z[0].dir, 1); assert.equal(z[0].top, 101); assert.equal(z[0].bot, 98.5);
  // a sell mirrors it: green, then red closing under the green's LOW
  assert.equal(zones([c(0, 99, 100.5, 98.6, 100), c(1, 100, 100.2, 98.8, 98.7)], '1h').length, 0);
  const s = zones([c(0, 99, 100.5, 98.6, 100), c(1, 100, 100.2, 98.2, 98.4)], '1h');
  assert.equal(s.length, 1); assert.equal(s[0].dir, -1); assert.equal(s[0].bot, 98.6); assert.equal(s[0].top, 100.5);
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

// 21 Nov 2026 (owner: "the fail is the same logic as entry for other timeframes", then "keep the msnr"): an EF counts like an EG
// on the MSNR gold plan only; the Engulfing plan and short method keep EG triggers and the M5 EG zone as the entry
test('an EF counts like an EG on the gold plan only: its EF triggers keep their stops and are found without hindsight', () => {
  const plan = G.methodTrades(B15, { from: 0, market: 'xau' }).filter((r) => r.kind === 'eg-plan' || r.kind === 'eg-simple');
  assert.ok(plan.length && plan.every((r) => !r.marks.some((k) => /^M(15|30) EF|M5 EF zone/.test(k.label))), 'the Engulfing plan takes no EF trigger or EF entry');
  let n = 0, cuts = 0;
  for (const seed of [11, 4, 5]) { const X = seed === 11 ? B : market(90, seed), Y = { ...X, '15m': m15of(X['5m']) };
    for (const r of G.snrTrades(Y, { from: 0 }).filter((x) => /-ef$/.test(x.id))) { n++; assert.ok(stopOk(r), r.id); assert.ok(r.marks.some((k) => / EF zone · entry$/.test(k.label))); assert.match(r.log[1].text, /engulf zone failed/);
      // the gold plan reads its side from about 35 days of history: only later trades are checked against a cut (as above)
      if (r.t > X['5m'][0].time + 35 * 86400 && cuts++ < 8) { const one = G.snrTrades(cutAt(Y, r.t + 300), { from: 0 }).find((x) => x.id === r.id); assert.ok(one, 'found when cut just after the fill: ' + r.id); assert.equal(one.entry, r.entry); } } }
  assert.ok(n >= 1 && cuts >= 1, 'gold-plan entries on a failed M15 / M30 zone: ' + n + ', checked against a cut: ' + cuts);
});

// ─── 21 Nov 2026: the engulf as the methods draw it (owner: "build"; an engulf may take "as many [candles] as it needs") ───
test('an engulf: the base candle wick to wick, completed by the first close beyond it however many candles later; a newer opposite candle or a close through the other side ends a pending base', () => {
  const c = (i, o, h, l, cl) => ({ time: 1_780_000_000 + i * 900, open: o, high: h, low: l, close: cl }), T = (i) => 1_780_000_000 + i * 900;
  // red base (high 101, low 98.5), an up candle that stays under its high, a doji, then the close above the high
  const C = [c(0, 100, 101, 98.5, 99), c(1, 99, 100.6, 98.9, 100.4), c(2, 100.4, 100.7, 100.1, 100.4), c(3, 100.4, 102, 100.2, 101.6), c(4, 101.6, 103, 101.5, 102.8)];
  const z = G.zones(C, '15m'); assert.equal(z.length, 1, 'one zone a base: the first close beyond it');
  assert.deepEqual([z[0].dir, z[0].top, z[0].bot, z[0].base, z[0].at, z[0].i], [1, 101, 98.5, T(0), T(4), 3], 'the base candle wick to wick, known from the completing close');
  for (let n = 1; n <= 3; n++) assert.equal(G.zones(C.slice(0, n), '15m').length, 0, 'no zone before the completing candle has closed');
  assert.deepEqual(G.engulfAt(C, 3), { dir: 1, j: 0 }); assert.equal(G.engulfAt(C, 1), null); assert.equal(G.engulfAt(C, 2), null, 'a doji completes nothing');
  assert.equal(G.engulfAt(C, 3, 2), null, 'the D1 / H4 / H1 engulf rule keeps its own look-back');
  // a newer red candle takes the base's place: the close must be beyond ITS high, and the older base is never completed
  const N = [c(0, 100, 101, 98.5, 99), c(1, 99, 99.8, 98.9, 99.6), c(2, 99.6, 99.9, 99.1, 99.3), c(3, 99.3, 100.5, 99.2, 100.3), c(4, 100.3, 101.8, 100.2, 101.5)];
  const zn = G.zones(N, '15m'); assert.equal(zn.length, 1); assert.deepEqual([zn[0].base, zn[0].top, zn[0].bot, zn[0].at], [T(2), 99.9, 99.1, T(4)]);
  // a close through the base's other side before the completing close cancels it
  const X = [c(0, 100, 101, 98.5, 99), c(1, 98, 98.4, 97.8, 98.3), c(2, 98.3, 101.9, 98.2, 101.5)];
  assert.equal(G.zones(X, '15m').length, 0);
  // a sell mirrors it
  const S = C.map((b) => ({ time: b.time, open: 200 - b.open, high: 200 - b.low, low: 200 - b.high, close: 200 - b.close })), zs = G.zones(S, '15m');
  assert.equal(zs.length, 1); assert.deepEqual([zs[0].dir, zs[0].top, zs[0].bot, zs[0].at], [-1, 101.5, 99, T(4)]);
  // on a long path: every zone is its base candle, the run between is never of the base's colour, many take more than one candle,
  // and nothing known at a cut changes with the candles after it
  const M = B15['15m'], Z = G.zones(M, '15m'), at = new Map(M.map((b, i) => [b.time, i])); let multi = 0;
  for (const q of Z) { const j = at.get(q.base), b = M[j]; assert.deepEqual([q.top, q.bot], [b.high, b.low]); assert.ok(q.dir > 0 ? b.open > b.close && M[q.i].close > b.high : b.open < b.close && M[q.i].close < b.low);
    for (let x = j + 1; x < q.i; x++) assert.ok(q.dir > 0 ? !(M[x].open > M[x].close) && !(M[x].close > b.high) : !(M[x].open < M[x].close) && !(M[x].close < b.low)); if (q.i > j + 1) multi++;
    assert.equal(q.at, M[q.i].time + 900); assert.ok(q.touch == null || q.touch >= q.at); assert.ok(q.fail == null || q.fail > q.at); }
  assert.ok(multi >= 20, 'engulfs that take more than one candle: ' + multi);
  const cutI = Math.floor(M.length / 2), Tc = M[cutI].time, early = G.zones(M.slice(0, cutI), '15m'), key = (q) => [q.dir, q.base, q.at, q.top, q.bot].join('|');
  assert.deepEqual(early.map(key), Z.filter((q) => q.at <= Tc).map(key));
  // the D1 / H4 / H1 engulf rule reads the same definition, with its own look-back
  assert.match(rd('council/edge-desks.mjs'), /engulfAt\(C, m, EG\.k\)/);
  assert.doesNotMatch(rd('council/eg-methods.mjs'), /An engulf here = a BODY engulf|body-engulf zones/);
});

test('plan and simple: the 15- / 30-minute engulf zone lies inside the H4 zone, the M5 entry zone is at the zone, and the limit is on the base candle\'s wick', () => {
  let n = 0;
  for (const seed of [11, 5, 23, 31, 47]) { const X = seed === 11 ? B : market(120, seed), Y = { ...X, '15m': m15of(X['5m']) }, m5 = new Map(Y['5m'].map((b) => [b.time, b]));
    for (const r of G.methodTrades(Y, { from: 0, market: 'xau' }).filter((x) => x.kind !== 'eg-direct')) { n++; assert.ok(stopOk(r)); assert.ok(Math.abs(Math.abs(r.entry - r.stop) - G.EGM.pips) < 1e-9, '30 pips from the entry');
      const h4 = r.marks.find((k) => /^H4 E[GF]/.test(k.label)), trg = r.marks.find((k) => /^M(15|30) EG zone$/.test(k.label)), en = r.marks.find((k) => k.label.startsWith('M5 EG zone · entry'));
      assert.ok(trg.bot >= h4.bot && trg.top <= h4.top, 'the trigger zone is not wholly inside the H4 zone: ' + r.id);
      assert.ok(en.bot <= Math.max(h4.top, trg.top) && en.top >= Math.min(h4.bot, trg.bot), 'the entry zone is away from the zone: ' + r.id);
      const base = m5.get(en.a); assert.deepEqual([en.top, en.bot], [base.high, base.low], 'the entry zone is its base candle, wick to wick'); assert.equal(r.entry, r.side > 0 ? base.high : base.low); } }
  assert.ok(n >= 10, 'plan / simple entries: ' + n);
  // no look-ahead: an entry is found, the same, with the candles cut just after its fill
  let cuts = 0; for (const r of G.methodTrades(B15, { from: 0, market: 'xau' }).filter((x) => x.t > B['5m'][0].time + 30 * 86400).filter((_, i) => i % 4 === 0).slice(0, 10)) { cuts++;
    const one = G.methodTrades(cutAt(B15, r.t + 300), { from: 0, market: 'xau' }).find((x) => x.id === r.id); assert.ok(one, 'found when cut just after the fill: ' + r.id); assert.deepEqual([one.entry, one.stop, one.t], [r.entry, r.stop, r.t]); }
  assert.ok(cuts >= 5, 'entries checked against a cut: ' + cuts);
  const src = rd('council/eg-methods.mjs'); assert.match(src, /m\.bot >= z\.bot && m\.top <= z\.top/); assert.match(src, /&& atZone\(z\)\) E = z;/);
});

// the close of the n-th weekday after a day (the gold plan's break window counts trading days)
const tradeEnd = (day, n) => { let t = day, k = 0; while (k < n) { t += 86400; const w = new Date(t * 1000).getUTCDay(); if (w !== 0 && w !== 6) k++; } return t + 86400; };
test('gold plan: the H4 break is of the level that stood before the Daily level was tapped, and a break on the rejection day counts', () => {
  let n = 0, sameDay = 0, cuts = 0;
  for (const seed of [11, 4, 5, 23, 31]) { const X = seed === 11 ? B : market(120, seed), D1 = X['1d'], H4 = X['4h'], ix = new Map(H4.map((b, i) => [b.time, i]));
    for (const s of G.snrSides(D1, H4)) { n++; const tap = ix.get(s.tapT), lj = ix.get(s.levelT), bo = ix.get(s.boT - 14400), up = s.dir > 0;
      assert.ok(s.tapT >= s.day && s.tapT < s.day + 86400 && (up ? H4[tap].low <= s.key.p : H4[tap].high >= s.key.p), 'the tap: an H4 candle of the rejecting day that trades to the Daily level');
      for (let q = s.day / 14400; q * 14400 < s.tapT; q++) { const b = H4[ix.get(q * 14400)]; if (b) assert.ok(up ? b.low > s.key.p : b.high < s.key.p, 'the first such candle'); }
      assert.equal(H4[lj].close, s.level); assert.ok(lj + G.SNR.piv <= tap, 'the level was a known turn by the close of the tap candle: external');
      for (let q = 1; q <= G.SNR.piv; q++) assert.ok(up ? H4[lj].close > H4[lj - q].close && H4[lj].close > H4[lj + q].close : H4[lj].close < H4[lj - q].close && H4[lj].close < H4[lj + q].close, 'a turn of the closes');
      assert.ok(bo >= tap, 'the break is not before the tap'); for (let q = lj + 1; q < bo; q++) assert.ok(up ? !(H4[q].close > s.level) : !(H4[q].close < s.level), 'the first close beyond the level');
      assert.ok(up ? H4[bo].close > s.level : H4[bo].close < s.level); assert.ok(s.boT <= tradeEnd(s.day, G.SNR.boDays), 'inside the trading-day window');
      assert.equal(s.t, Math.max(s.boT, s.day + 86400), 'known at the later of the break and the Daily close'); if (s.boT <= s.day + 86400) sameDay++;
      // nothing after the moment the side is known is read
      if (cuts++ < 40) { const one = G.snrSides(D1.filter((b) => b.time + 86400 <= s.t), H4.filter((b) => b.time + 14400 <= s.t)).find((x) => x.day === s.day && x.dir === s.dir); assert.ok(one, 'found with the candles cut at the side'); assert.deepEqual([one.t, one.level, one.boT], [s.t, s.level, s.boT]); } } }
  assert.ok(n >= 10 && sameDay >= 1, 'sides: ' + n + ', broken on the rejection day itself: ' + sameDay);
});

test('the direction\'s engulf zones of the timeframe above follow the same definition: a close beyond the base\'s high / low, the base candle wick to wick', () => {
  let s = 77; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; const P = []; let p = 4000, drift = 0;
  for (let i = 0, t = 1767571200; i < 6000; i++, t += 14400) { if (new Date(t * 1000).getUTCDay() % 6 === 0) continue; if (i % 40 === 0) drift = (rnd() - 0.5) * 12; const o = p, c = o + drift + (rnd() - 0.5) * 30; P.push({ time: t, open: o, high: Math.max(o, c) + rnd() * 8, low: Math.min(o, c) - rnd() * 8, close: c }); p = c; }
  const day = (t) => Math.floor(t / 86400) * 86400, R = G.direction(P, day, 86400), days = []; for (const b of P) { const k = day(b.time), q = days[days.length - 1]; if (q && q.time === k) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else days.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); }
  const DZ = G.zones(days, '1d'), egs = R.events.filter((e) => e.kind === 'eg' || e.kind === 'ef'); assert.ok(egs.filter((e) => e.kind === 'eg').length >= 2, 'switches on a Daily engulf zone: ' + egs.length);
  for (const e of egs) { const z = e.kind === 'eg' ? DZ.find((q) => q.base === e.zoneT && q.dir === e.s) : DZ.find((q) => q.dir === -e.s && q.fail === e.zoneAt && q.bot === e.bottom && q.top === e.top); assert.ok(z, 'the zone is one of zones(): ' + e.kind + ' ' + e.zoneT);
    assert.deepEqual([e.bottom, e.top], [z.bot, z.top]); assert.equal(e.zoneAt, e.kind === 'eg' ? z.at : z.fail); }
  assert.match(rd('council/eg-methods.mjs'), /const eg = engulfAt\(H, H\.length - 1\);/);
});

// ─── 21 Nov 2026, second pass against the documents: what each page shows that the desks did not apply yet ───
const rows = (a) => a.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
const closedBack = (H4, mark, d, T) => H4.some((b) => b.time + 14400 > mark.at && b.time + 14400 <= T && (d > 0 ? b.close < mark.bot : b.close > mark.top));

test('plan and simple: the trigger zone is wholly inside the H4 zone, the entry price is inside it, and a turned H4 zone is dead once an H4 candle closes back through it', () => {
  let n = 0, turned = 0, cuts = 0;
  for (const seed of [11, 5, 23, 31, 47]) { const X = seed === 11 ? B : market(120, seed), Y = { ...X, '15m': m15of(X['5m']) }, all = G.methodTrades(Y, { from: 0, market: 'xau' }).filter((x) => x.kind !== 'eg-direct');
    for (const r of all) { n++; assert.ok(stopOk(r));
      const h4 = r.marks.find((k) => /^H4 E[GF]/.test(k.label)), trg = r.marks.find((k) => /^M(15|30) EG zone$/.test(k.label)), T = r.log[0].t;
      assert.ok(trg.bot >= h4.bot && trg.top <= h4.top, 'the 15- / 30-minute engulf zone pokes out of the H4 zone: ' + r.id);
      assert.ok(r.entry >= h4.bot && r.entry <= h4.top, 'the entry price is outside the H4 zone: ' + r.id);
      if (h4.label === 'H4 EF (zone failed)') { turned++; assert.ok(!closedBack(X['4h'], h4, r.side, T), 'a turned H4 zone an H4 candle had closed back through: ' + r.id); } }
    // no look-ahead: found the same with the candles cut just after the fill
    for (const r of all.filter((x) => x.t > X['5m'][0].time + 30 * 86400).filter((_, i) => i % 5 === 0).slice(0, 6)) { cuts++;
      const one = G.methodTrades(cutAt(Y, r.t + 300), { from: 0, market: 'xau' }).find((x) => x.id === r.id); assert.ok(one, 'found when cut just after the fill: ' + r.id); assert.deepEqual([one.entry, one.stop, one.t], [r.entry, r.stop, r.t]); } }
  assert.ok(n >= 10 && turned >= 1 && cuts >= 5, `entries ${n}, in a turned zone ${turned}, cut checks ${cuts}`);
});

// Real candles of 1 May 2024 (OANDA mid, UTC), the morning one of the methods draws as its own example: the 5-minute candle of
// 05:00 completes the M5 buy engulf of the 04:55 candle AND closes through the M5 sell zone above it, inside the 15-minute
// candle (05:00 to 05:15) that completes the trigger. Until this pass a failure before the trigger candle had closed was
// thrown away, and the limit at that M5 engulf (the example's entry, stop and target to a cent) was never placed.
test('plan and simple: the M5 failure may come inside the candle that completes the trigger, and the entry zone is the M5 engulf that same candle completed (the short method\'s own example)', () => {
  const F = JSON.parse(rd('tests/fixtures/xau-oanda-2024-05-01.json')), X = Object.fromEntries(['1d', '4h', '1h', '15m', '5m'].map((tf) => [tf, rows(F[tf])]));
  const U = (h, m) => Date.UTC(2024, 4, 1, h, m) / 1000, find = (o) => o.find((x) => x.base === U(4, 55) && x.side === 1);
  const o = []; G.methodTrades(X, { from: 0, market: 'xau', orders: o }); const x = find(o);
  assert.ok(x, 'the order at the 04:55 M5 engulf'); assert.equal(x.kind, 'eg-simple', 'the Daily\'s last engulf is a sell: the short method');
  assert.deepEqual([x.entry, +x.stop.toFixed(2), +x.target.toFixed(2)], [2284.33, 2281.33, 2287.33]);   // the short method's target is 1R since 22 Nov 2026 (the owner's choice; 2R = 2290.33 before) assert.equal(x.placed, U(5, 15), 'it rests only from the close of the trigger candle, not from the M5 close inside it');
  const base = X['5m'].find((b) => b.time === U(4, 55)); assert.equal(x.entry, base.high); assert.ok(base.close < base.open);
  // the desk's one-hour limit (an open owner question) ends before price comes back at 07:40, so no trade is booked from it
  assert.equal(x.until, U(6, 15)); assert.equal(x.fillT, null);
  const i = X['5m'].findIndex((b) => b.time >= x.placed && b.low <= x.entry); assert.equal(X['5m'][i].time, U(7, 40), 'the first return to the limit');
  const oc = G.outcome(X['5m'], i, 1, x.entry, x.stop, x.target, Infinity); assert.equal(oc.status, 'target', 'from that return the example\'s target comes before its stop');
  // with a limit that lives until then, the order fills at that candle (the life is the only thing changed)
  const keep = G.EGM.fill; try { G.EGM.fill = 30; const o2 = []; G.methodTrades(X, { from: 0, market: 'xau', orders: o2 }); assert.equal(find(o2).fillT, U(7, 40)); } finally { G.EGM.fill = keep; }
  // nothing after the trigger's close is needed to place it
  const o3 = []; G.methodTrades(cutAt(X, U(5, 15)), { from: 0, market: 'xau', orders: o3 }); assert.deepEqual([find(o3).entry, find(o3).placed], [x.entry, x.placed]);
  // every order names an engulf completed by the failing close when there is one
  const src = rd('council/eg-methods.mjs'); assert.match(src, /z\.fail <= t0 \|\|/); assert.match(src, /const P = at5\.get\(d \+ ':' \+ F\.fail\)/);
});

// the gold plan's own pictures, typed in as candles: an open-close level at 100 made by two up days; a later day wicks to 99 and
// closes back above; on H4 the last A level before the drop to the level has ONE candle between it and the tap candle
const planCase = ({ wick = false, body = false, boDay = 1, start = 20000 } = {}) => {   // day 20000 is a Friday
  const days = []; for (let d = start; days.length < 24; d++) { const w = new Date(d * 86400000).getUTCDay(); if (w !== 0 && w !== 6) days.push(d * 86400); }
  const D = [], dd = (o, h, l, c) => D.push({ time: days[D.length], open: o, high: h, low: l, close: c });
  dd(90, 93, 89, 92); dd(92, 96, 91, 95); dd(95, 96, 90, 91); dd(91, 95, 90, 94); dd(94, 101, 93, 100); dd(100, 110, 98.5, 109);   // the level: 100; the second candle of its pair wicks through it
  if (wick) dd(109, 110, 99.5, 105.2); else dd(109, 110, 104, 105.2);                                    // a later WICK on the level
  if (body) { dd(105.2, 106, 97, 98); dd(98, 104.9, 97.5, 104.7); }                                     // then a body down through it and a body back up: fresh again
  const rej = D.length; dd(104.5, 106.6, 99, 105.3);
  for (let q = 0; q < boDay - 1; q++) dd(105, 105.4, 104.6, 105);                                       // quiet days under the H4 level
  dd(105, 125, 104.8, 124); dd(124, 130, 122, 128); dd(128, 131, 126, 130);
  const H = [], h = (di, k, o, hi, lo, c) => H.push({ time: days[di] + k * 14400, open: o, high: hi, low: lo, close: c });
  const flat = (di) => { const x = D[di]; for (let k = 0; k < 6; k++) { const a = x.open + (x.close - x.open) * k / 6, b = x.open + (x.close - x.open) * (k + 1) / 6; h(di, k, a, Math.max(a, b) + 0.2, Math.min(a, b) - 0.2, b); } };
  for (let di = 0; di < rej - 1; di++) flat(di);
  const p = rej - 1; h(p, 0, 109, 110, 108.5, 109.6); h(p, 1, 109.6, 109.8, 107, 107.5); h(p, 2, 107.5, 107.8, 106, 106.3); h(p, 3, 106.3, 106.5, 104.4, 104.6); h(p, 4, 104.6, 105, 104.2, 104.6); h(p, 5, 104.6, 105.2, 104.4, 105);
  // the rejection day: W closes 105.5 (the A level), one down candle, the tap candle, the engulf, two small candles under the level
  h(rej, 0, 104.5, 106.6, 104.2, 105.5); h(rej, 1, 105.5, 105.6, 102.5, 102.8); h(rej, 2, 102.8, 103.3, 99, 100.4); h(rej, 3, 100.4, 104.5, 100.2, 104.3); h(rej, 4, 104.3, 105.5, 103.5, 104.2); h(rej, 5, 104.2, 105.5, 103.8, 105);
  for (let q = 1; q < boDay; q++) for (let k = 0; k < 6; k++) h(rej + q, k, 105, 105.4, 104.6, 105);
  const b = rej + boDay; h(b, 0, 105, 105.5, 104.8, 105.2); h(b, 1, 105.2, 105.4, 104.8, 105); h(b, 2, 105, 107.8, 104.9, 107.5); h(b, 3, 107.5, 112, 107, 111.5); h(b, 4, 111.5, 119, 111, 118); h(b, 5, 118, 125, 117, 124);
  for (let di = b + 1; di < D.length; di++) flat(di);
  return { D, H, rej: D[rej].time, W: days[rej], tap: days[rej] + 2 * 14400, bo: days[b] + 3 * 14400 };
};
const sideOf = (c) => G.snrSides(c.D, c.H).find((s) => s.day === c.rej);

test('gold plan: an H4 A / V turn completed by the tap candle\'s close is the level that is broken (the plan\'s own example)', () => {
  const c = planCase(), s = sideOf(c); assert.ok(s, 'the side of the example');
  assert.deepEqual([s.dir, s.key.kind, s.key.p], [1, 'OC', 100]); assert.equal(s.tapT, c.tap);
  assert.equal(s.level, 105.5, 'the A level right before the drop to the Daily level, not the older peak (109.6)'); assert.equal(s.levelT, c.W);
  assert.equal(s.boT, c.bo, 'the first close above 105.5: the large candle of the next day'); assert.equal(s.t, c.bo);
  // known without any later candle
  const one = G.snrSides(c.D.filter((b) => b.time + 86400 <= s.t), c.H.filter((b) => b.time + 14400 <= s.t)).find((x) => x.day === c.rej); assert.deepEqual([one.level, one.boT], [s.level, s.boT]);
});

test('gold plan: the rejected Daily level must be fresh: a wick since it formed spends it, a body through it makes it fresh again, the second candle of its own pair does not count', () => {
  assert.ok(sideOf(planCase()), 'only the second candle of the pair wicked through the level: fresh');
  assert.equal(sideOf(planCase({ wick: true })), undefined, 'a later Daily candle put a wick on the level: not fresh, no rejection of it');
  const c = planCase({ wick: true, body: true }), s = sideOf(c); assert.ok(s, 'a body through the level after that wick: fresh again'); assert.equal(s.key.p, 100);
  // on generated markets: every side's level is fresh by the rule, read only from candles before the rejecting one
  let n = 0;
  for (const seed of [11, 4, 5, 23, 31]) { const X = seed === 11 ? B : market(120, seed), D1 = X['1d'], ix = new Map(D1.map((b, i) => [b.time, i]));
    for (const s of G.snrSides(D1, X['4h'])) { n++; const i = ix.get(s.day), p = s.key.p; let f = D1.findIndex((b, j) => j < i && b.close === p && (s.key.kind === 'OC' ? D1[j + 1].time === s.key.t : b.time === s.key.t)); assert.ok(f >= 0, 'the level\'s own candle');
      let fresh = true; for (let q = f + 2; q < i; q++) { const b = D1[q]; if (b.low > p || b.high < p) continue; fresh = (b.open < p && b.close > p) || (b.open > p && b.close < p); }
      assert.ok(fresh, 'a side on a level a wick had spent'); } }
  assert.ok(n >= 5, 'sides checked: ' + n);
});

test('gold plan: the H4 break has three TRADING days after the rejection day, whatever the weekday', () => {
  // day 20000 is a Friday: the first weekday of the case; the rejection day is its 7th weekday
  const wd = (c) => new Date(c.rej * 1000).getUTCDay();
  for (const start of [20000, 20003, 20004, 20005, 20006]) {   // rejection on a Monday, Tuesday, Wednesday, Thursday, Friday
    const c3 = planCase({ boDay: 3, start }), c4 = planCase({ boDay: 4, start }), s = sideOf(c3);
    assert.ok(s, 'a break on the third trading day counts, rejection on weekday ' + wd(c3)); assert.equal(s.boT, c3.bo); assert.ok(s.boT <= tradeEnd(c3.rej, 3));
    assert.equal(sideOf(c4), undefined, 'a break on the fourth trading day does not, rejection on weekday ' + wd(c4)); }
  assert.deepEqual([20000, 20003, 20004, 20005, 20006].map((start) => wd(planCase({ start }))).sort(), [1, 2, 3, 4, 5]);
  assert.equal(G.SNR.boDays, 3);
});

test('gold plan: one entry a visit to an H4 zone on one side (the first order that fills, whatever its type); a visit ends with a closed M15 candle wholly outside the zone; the 2-a-day limit after it', () => {
  let visits = 0, again = 0, cuts = 0;
  for (const seed of [11, 4, 5, 23, 31]) { const X = seed === 11 ? B : market(120, seed), Y = { ...X, '15m': m15of(X['5m']) }, M15 = Y['15m'], o = [], tr = G.snrTrades(Y, { from: 0, market: 'xau', orders: o });
    assert.deepEqual(o.filter((x) => x.took === 'trade').map((x) => x.id), tr.map((r) => r.id), 'the trades are the orders that were taken');
    const out = (z, a, b) => M15.some((c) => c.time >= a - a % 900 + 900 && c.time + 900 <= b && (c.low > z.top || c.high < z.bot)), last = new Map(), perDay = {};
    for (let i = 1; i < o.length; i++) assert.ok(o[i].t >= o[i - 1].t, 'decided in the order of the fills');
    for (const x of o) { const k = x.side + ':' + x.zone.dir + ':' + x.zone.base, pv = last.get(k);
      if (x.took === 'same') { if (pv == null || out(x.zone, pv, x.t)) last.set(k, x.t); continue; }   // the order another trigger already gave: no second record, but its own zone's entry of this visit
      if (x.took === 'visit') { visits++; assert.ok(pv != null && !out(x.zone, pv, x.t), 'refused although price had left the zone since the visit\'s entry: ' + x.id); continue; }
      if (pv != null) { again++; assert.ok(out(x.zone, pv, x.t), 'a second entry in one visit: ' + x.id); }
      last.set(k, x.t); const d = Math.floor(x.t / 86400); if (x.took === 'trade') { perDay[d] = (perDay[d] || 0) + 1; assert.ok(perDay[d] <= G.SNR.perDay); } else assert.ok(x.took === 'day' && perDay[d] >= G.SNR.perDay, 'refused by the day\'s limit only when the day is full'); }
    for (const r of tr) { assert.ok(stopOk(r)); const h4 = r.marks.find((k) => /^H4 E[GF]/.test(k.label)); if (h4.label === 'H4 EF (zone failed)') assert.ok(!closedBack(X['4h'], h4, r.side, r.log[1].t), 'a turned H4 zone an H4 candle had closed back through: ' + r.id); }
    // no look-ahead (the sides need about 35 days of candles first)
    for (const r of tr.filter((x) => x.t > X['5m'][0].time + 35 * 86400).filter((_, i) => i % 4 === 0).slice(0, 6)) { cuts++; assert.ok(G.snrTrades(cutAt(Y, r.t + 300), { from: 0 }).some((e) => e.id === r.id && e.entry === r.entry && e.stop === r.stop), 'found only with later candles: ' + r.id); } }
  assert.ok(visits >= 1 && again >= 1 && cuts >= 5, `orders refused as a visit's second entry ${visits}, entries on a later visit ${again}, cut checks ${cuts}`);
});

test('the MSNR desk says what kinds msnr-main / msnr-other are: the owner\'s earlier scalp method, not an entry of the documents', () => {
  const phrase = 'the owner\'s earlier scalp method (direction call + m15 / m5 engulf)', text = (p) => rd(p).replace(/\\'/g, '\'').toLowerCase();
  assert.ok(text('assets/desk-trades.js').includes(phrase)); assert.ok(text('council/edge-desks.mjs').includes(phrase));
  const r = E.msnrTrades({ ...B, '15m': m15of(B['5m']) }, { from: 0, market: 'xau' })[0]; if (r) assert.match(r.label, /^Earlier scalp method · /);
});

// ─── LIT desk fixes (21 Nov 2026): daily limits, the Asia session's extreme alone, re-sweeps tested, a smallest stop ───
const LM = await import('../council/lit.mjs');
const lbT = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
// the detector's candidates of one seeded market, both sides, with the series they were read on
function litCands(X) { const b5 = LM.cleanBars(X['5m']), m15 = LM.agg15(b5), out = [];
  for (const dir of ['short', 'long']) { const S15 = LM.series(m15, dir === 'long', LM.XAU.tick), S5 = LM.series(b5, dir === 'long', LM.XAU.tick);
    for (const cd of LM.fbosCandidates(S15)) { cd.confEnd = S15.t[cd.conf] + 900; cd.rEnd = S15.t[cd.r] + 900; out.push({ cd, S15, S5, dir }); } }
  return out; }
const litM5 = { ...LM.XAU, cost: () => 0 };

test('LIT desk: the daily limits hold on every execution (one London and one New York-morning fill a day, a win ends the day, stop at -1.5R)', () => {
  let cut = 0, seen = 0;
  for (const seed of [5, 9, 3]) { const X = market(120, seed), lit = E.litTrades(X, { from: 0 }), free = E.litTrades(X, { from: 0, limits: false });
    for (const kind of ['lit-rule', 'lit-loose', 'lit-break']) { const days = new Map();
      for (const r of lit.filter((x) => x.kind === kind)) { seen++;
        const day = LM.nyInfo(r.t - 300).day, sess = LM.nyInfo(r.log[0].t - 900).sess, ds = days.get(day) || { fills: {}, R: 0, won: false }; days.set(day, ds);
        assert.ok(['LONDON', 'NY_AM'].includes(sess), 'a sweep in London or the New York morning: ' + r.id);
        assert.ok(!ds.won, 'no trade after a win that day: ' + r.id); assert.ok(ds.R > LM.P.dayCapR, 'no trade once the day is at -1.5R: ' + r.id); assert.ok(!ds.fills[sess], 'one fill a session: ' + r.id);
        ds.fills[sess] = 1; if (r.R != null) { ds.R += r.R; if (r.R > 0) ds.won = true; } } }
    cut += free.length - lit.length;
    assert.equal(new Set(lit.map((r) => r.id)).size, lit.length, 'ids are unique');
    // the old reading (the desk-slices study) keeps no limits
    assert.deepEqual(E.litTrades(X, { from: 0, first: true }).map((r) => r.id), E.litTrades(X, { from: 0, first: true, limits: false, asia: false }).map((r) => r.id)); }
  assert.ok(seen >= 60 && cut >= 3, 'the limits removed trades on these candles: ' + cut + ' of ' + seen);
});

test('LIT desk: a sweep of the Asia session\'s extreme alone gives no trade; with older untaken structure taken in the same move it does', () => {
  // hand-made M15 highs: an older swing high (the day before), Asia's high, then the sweep candle
  const mk = (older, asiaHi, mx) => { const h = [4000, older, 4000, 3999, 4001, asiaHi, 4002, mx], ny = h.map((_, i) => ({ day: i < 4 ? 1 : 2 })), pivH = h.map((_, i) => (i === 1 ? 1 : 0));
    return [{ h, ny, pivH, tick: 0.01 }, { kind: 'ASIA', s: 7, MX: mx }]; };
  assert.equal(E.litAsiaAlone(...mk(4010, 4005, 4006)), true, 'only the Asia high went');
  assert.equal(E.litAsiaAlone(...mk(4010, 4005, 4010.01)), false, 'the older swing high went too');
  assert.equal(E.litAsiaAlone(...mk(4010, 4005, 4010)), true, 'a touch is not a sweep (one tick beyond)');
  assert.equal(E.litAsiaAlone(...mk(4004, 4005, 4006)), true, 'an older high Asia had already taken is not new structure');
  { const [S, cd] = mk(4010, 4005, 4011); assert.equal(E.litAsiaAlone(S, { ...cd, kind: 'pd' }), false, 'another level is not filtered'); S.pivH[1] = 0; assert.equal(E.litAsiaAlone(S, cd), false, 'an earlier day\'s high counts without being a swing'); }
  let alone = 0, asia = 0, removed = 0;
  for (const seed of [5, 21, 7]) { const X = market(120, seed), C = litCands(X), on = E.litTrades(X, { from: 0, limits: false }), off = E.litTrades(X, { from: 0, limits: false, asia: false });
    removed += off.length - on.length;
    for (const { cd, S15 } of C) { if (cd.kind !== 'ASIA') continue; asia++; const a = E.litAsiaAlone(S15, cd); if (a) alone++;
      // no look-ahead: the same answer on the candles up to the candle that closed back
      const n = cd.r + 1, cutS = { h: S15.h.slice(0, n), ny: S15.ny.slice(0, n), pivH: S15.pivH.slice(0, n), tick: S15.tick }; for (let k = Math.max(0, n - LM.P.pivot); k < n; k++) cutS.pivH[k] = 0;
      assert.equal(E.litAsiaAlone(cutS, cd), a); }
    // every Asia-level trade left on the desk comes from a candidate that also took older structure
    for (const r of on) { if (!/the Asia session's/.test(r.log[0].text)) continue;
      const hit = C.filter(({ cd, dir }) => cd.kind === 'ASIA' && cd.t + 900 === r.log[0].t && (dir === 'short') === (r.side < 0)); assert.ok(hit.length && hit.some(({ cd, S15 }) => !E.litAsiaAlone(S15, cd)), r.id); } }
  assert.ok(asia >= 20 && alone >= 15 && alone < asia && removed >= 3, `Asia candidates ${asia}, alone ${alone}, trades removed ${removed}`);
});

test('LIT desk: the study executions test a new extreme as a new sweep: one waiting period, the swing known by then, at most two re-sweeps, a smallest stop', () => {
  assert.equal(E.LIT_MIN_STOP, 0.00014); assert.equal(E.LIT_RESWEEPS, 2);
  for (const s of E.LIT_SETS) assert.equal(!!s.resweep, s.id !== 'rule', 'the rule is the pre-registered one: a break of the extreme voids it');
  let res = 0, fresh = 0, refused = 0, oldLate = 0, n = 0;
  for (const seed of [5, 9]) for (const { cd, S15, S5 } of litCands(market(120, seed))) for (const set of E.LIT_SETS.slice(1)) {
    const od = E.litOrder(S5, cd, litM5, set, S15), old = E.litOrder(S5, cd, litM5, E.litOldSet(set), S15);
    const a0 = lbT(S5.t, cd.t), e0 = lbT(S5.t, cd.rEnd), j00 = lbT(S5.t, cd.confEnd); let m0 = a0; for (let k = a0; k < e0; k++) if (S5.h[k] > S5.h[m0]) m0 = k;
    if (old && old.b > m0 + LM.P.rbosWait) oldLate++; if (old && !od) refused++;
    if (!od) continue; n++;
    assert.ok(od.b <= m0 + LM.P.rbosWait, 'the break comes inside the one waiting period from the first extreme'); assert.ok(od.res <= E.LIT_RESWEEPS);
    assert.ok(od.stop > od.entry && od.risk >= E.LIT_MIN_STOP * Math.abs(od.entry), 'a stop on the losing side, not nearer than the smallest stop');
    // the break level: the last M5 swing low before the extreme that was confirmed when this sweep was
    assert.ok(S5.pivL[od.p] && od.p < od.mxIdx && od.p + LM.P.pivot < od.j0 && od.level === S5.l[od.p]); for (let k = od.p + 1; k < od.mxIdx; k++) assert.ok(!(S5.pivL[k] && k + LM.P.pivot < od.j0), 'no later known swing was passed over');
    assert.ok(od.jA >= od.j0 && od.mk >= od.j0 - 1, 'no order or market entry before the sweep in force is confirmed');
    if (!od.res) { assert.equal(od.mxIdx, m0); assert.equal(od.j0, j00); continue; }
    res++; if (od.p + LM.P.pivot >= j00) fresh++;
    // the sweep tests again at the new extreme, on its M15 candles
    const i0 = lbT(S15.t, Math.floor(S5.t[od.mxIdx] / 900) * 900);
    const rs = [i0, i0 - 1, i0 - 2].map((i) => E.litResweep(S15, cd, i)).find((x) => x && x.MX === od.MX && od.j0 === lbT(S5.t, S15.t[x.conf] + 900)); assert.ok(rs, 'the new extreme passed the sweep tests');
    assert.ok(LM.SESS_TRADE.includes(S15.ny[rs.s].sess) && S15.ny[rs.s].hm !== 930 && rs.r - rs.s < LM.P.rejectBars && S15.c[rs.r] < cd.L);
    let above = 0; for (let i = rs.s; i < rs.r; i++) if (S15.c[i] >= cd.L) above++; assert.ok(above < 2, 'never two closes beyond the level');
    let vec = false; for (let j = Math.max(0, rs.s - LM.P.vecWindow); j <= Math.min(rs.conf, rs.r + LM.P.vecWindow); j++) if (S15.vec[j]) vec = true; assert.ok(vec, 'a vector at the re-sweep');
    // no look-ahead: the same answer with the M15 candles cut at the confirming candle, none one candle earlier
    const cutS = (m) => ({ h: S15.h.slice(0, m), c: S15.c.slice(0, m), vec: S15.vec.slice(0, m), ny: S15.ny.slice(0, m), n: m });
    assert.deepEqual(E.litResweep(cutS(rs.conf + 1), cd, rs.s), rs); assert.equal(E.litResweep(cutS(rs.conf), cd, rs.s), null); }
  assert.ok(n >= 60 && res >= 10 && fresh >= 5 && refused >= 20 && oldLate >= 10, `orders ${n}, re-swept ${res}, on a swing made after the first sweep ${fresh}, refused ${refused}, old reading past the waiting period ${oldLate}`);
  // the smallest stop: a quiet market whose buffer is almost nothing gives stops under it, which are skipped (never widened)
  const tiny = { ...litM5, stopExtra: () => 0.0001 }; let small = 0, kept = 0;
  for (const X of [market(120, 5, 4000, 0.15), market(120, 5)]) for (const { cd, S15, S5 } of litCands(X)) for (const set of E.LIT_SETS.slice(1)) { const noFloor = E.litOrder(S5, cd, tiny, { ...set, minStop: 0 }, S15), od = E.litOrder(S5, cd, tiny, set, S15);
    if (noFloor && noFloor.risk < E.LIT_MIN_STOP * Math.abs(noFloor.entry)) { small++; assert.equal(od, null); } else if (noFloor) { kept++; assert.equal(od.stop, noFloor.stop); } }
  assert.ok(small >= 1 && kept >= 1, `stops under the smallest stop ${small}, others ${kept}`);
});

test('LIT desk: no look-ahead after the fixes: a trade is found, with the same entry, stop and target, on the candles cut just after its fill', () => {
  let cuts = 0;
  for (const seed of [5, 9]) { const X = market(120, seed), lit = E.litTrades(X, { from: 0 }); const per = {};
    for (const r of lit) { if ((per[r.kind] = (per[r.kind] || 0) + 1) % 3 !== 1 || r.endT == null) continue;
      const one = E.litTrades({ '5m': X['5m'].filter((b) => b.time < r.t + 600) }, { from: 0 }).find((x) => x.id === r.id);
      assert.ok(one, 'found when cut after the fill: ' + r.id); assert.equal(one.entry, r.entry); assert.equal(one.stop, r.stop); assert.equal(one.target, r.target); assert.equal(one.t, r.t); assert.equal(one.log[1].text, r.log[1].text); cuts++; } }
  assert.ok(cuts >= 15, 'cuts: ' + cuts);
});

// ─── 21 Nov 2026, the independent review of the build: one order is one record, two CLOSED H4 candles, zones handed out in the order the setups were known ───
import crypto from 'node:crypto';
const sameOrder = (rows) => { const m = new Map(), out = []; for (const r of rows) { const k = [r.market, r.side, r.t, r.entry, r.stop].join('|'); if (m.has(k)) out.push(m.get(k) + ' = ' + r.id); else m.set(k, r.id); } return out; };

test('review: gold plan: a 15- and a 30-minute trigger that give ONE order are one record and use one of the day\'s two entries', () => {
  let same = 0, n = 0;
  for (const seed of [4, 3, 22]) { const X = market(60, seed), Y = { ...X, '15m': m15of(X['5m']) }, o = [], tr = G.snrTrades(Y, { from: 0, market: 'xau', orders: o }); n += tr.length;
    assert.deepEqual(sameOrder(tr), [], 'one order recorded twice (seed ' + seed + ')');
    const taken = new Map(tr.map((r) => [r.side + '|' + r.t + '|' + r.entry, r.id])), perDay = {};
    for (const x of o.filter((q) => q.took === 'same')) { same++; const first = o.find((q) => q.took !== 'same' && q.t === x.t && q.side === x.side && q !== x); assert.ok(first && first.took !== 'visit', 'the order it repeats was taken (or refused by the day): ' + x.id); assert.ok(!tr.some((r) => r.id === x.id)); }
    for (const r of tr) { assert.ok(stopOk(r)); const d = Math.floor(r.t / 86400); perDay[d] = (perDay[d] || 0) + 1; assert.ok(perDay[d] <= G.SNR.perDay); }
    assert.equal(taken.size, tr.length); }
  assert.ok(same >= 3 && n >= 50, `repeats of an order already taken: ${same}, trades ${n}`);
});

test('review: direct entry: "left alone for two H4 candles" counts two CLOSED H4 candles, not eight hours of clock time', () => {
  let n = 0, weekend = 0;
  for (const seed of [1, 6, 7, 21, 11]) { const X = market(60, seed), Y = { ...X, '15m': m15of(X['5m']) }, H4 = X['4h'];
    for (const r of G.methodTrades(Y, { from: 0, market: 'xau' }).filter((x) => x.kind === 'eg-direct')) { n++; const z = r.marks[0], tc = r.log[0].t; assert.equal(z.label, 'Fresh H4 EG zone');
      const quiet = H4.filter((b) => b.time >= z.at && b.time + 14400 <= tc); assert.equal(quiet.length, G.EGM.quiet, 'H4 candles closed between the zone and the order: ' + r.id);
      for (const b of quiet) assert.ok(r.side > 0 ? b.low > z.top : b.high < z.bot, 'a quiet candle traded into the zone: ' + r.id);
      assert.ok(r.t >= tc && stopOk(r)); if (tc - z.at > G.EGM.quiet * 14400) weekend++; } }
  assert.ok(n >= 8 && weekend >= 1, `direct entries ${n}, over a weekend ${weekend}`);
});

test('review: plan and simple: an M5 zone goes to the setup that was known first; an order that rested and filled does not vanish with later candles', () => {
  // seed 5: a 15- and a 30-minute trigger close together and choose the same M5 entry zone; the 30-minute one's M5 failure came first
  let checked = 0, late = 0;
  for (const seed of [5, 35, 50]) { const X = market(60, seed), Y = { ...X, '15m': m15of(X['5m']) }, full = []; G.methodTrades(Y, { from: 0, market: 'xau', orders: full });
    const keys = new Set(full.map((x) => [x.side, x.base, x.placed, x.entry, x.fillT].join('|')));
    assert.equal(new Set(full.map((x) => x.side + ':' + x.base)).size, full.length, 'one order a zone');
    // every order of the full run, read again on the candles cut one candle after its fill
    // and on the candles cut just before each order was placed (where the other trigger's order had rested and could have filled)
    for (const T of full.filter((q) => q.placed > X['5m'][0].time + 12 * 86400).flatMap((q) => (q.fillT != null ? [q.placed - 300, q.fillT + 300] : [q.placed - 300]))) { const o = []; G.methodTrades(cutAt(Y, T), { from: 0, market: 'xau', orders: o }); checked++;
      for (const y of o.filter((q) => q.fillT != null)) { if (!keys.has([y.side, y.base, y.placed, y.entry, y.fillT].join('|'))) late++; } } }
  assert.ok(checked >= 20, 'cuts: ' + checked); assert.equal(late, 0, 'orders that filled on the cut candles and are missing, or placed later, with every candle');
});

// the D1 / H4 / H1 engulf rule: a hand-made Friday where the H4 base candle and its last H1 candle have the same high and low
function twinDay() { const T0 = 1790553600, m5 = []; let p = 4000;   // Monday 00:00 UTC; five rising days, every hour green
  const add = (o, h, l, c) => { m5.push({ time: T0 + m5.length * 300, open: o, high: h, low: l, close: c }); p = c; }, up = (n, step) => { for (let i = 0; i < n; i++) add(p, p + step + 0.02, p - 0.02, p + step); };
  up(4 * 288 + 48, 0.05);                       // to Friday 04:00
  const O = p; up(36, 0.008);                   // three small green hours inside the H4 candle
  add(p, O + 3, p - 0.1, O + 2.5); for (let i = 0; i < 10; i++) add(p, p + 0.05, p - 0.75, p - 0.7); add(p, p + 0.05, O - 5, O - 4.5);   // the fourth hour: red, the H4 candle's whole range
  for (let i = 0; i < 11; i++) add(p, p + 0.8, p - 0.02, p + 0.75); add(p, O + 4.1, p - 0.02, O + 4);   // 08:00 hour: green, closes above the base's high
  up(36, 0.05);                                 // stays above the zone until the H4 candle has closed
  add(p, p + 0.1, O + 2.9, p + 0.05); up(47, 0.05);   // 12:00: back to the zone, both limits fill on this candle
  const X = { '5m': m5 }; for (const tf of ['1h', '4h', '1d']) { const sec = SOP.SEC[tf], out = []; for (const b of m5) { const t = b.time - (b.time % sec), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } X[tf] = out; }
  return X; }
const perTf = (X, o) => { const tfs = E.EG.tfs, out = []; try { for (const tf of tfs) { E.EG.tfs = [tf]; out.push(...E.egTrades(X, o)); } } finally { E.EG.tfs = tfs; } return out; };
test('review: the engulf rule: an H4 and an H1 reading that are the same order are one record (the higher timeframe); every other record is as it was', () => {
  // the H4 reading has its own 4R target since 22 Nov 2026 (the owner's choice), so an H4 and an H1 reading of one zone are two
  // trades with two exits; with that put back (EG.fixed empty) they are the same order and everything is as pinned
  { const X = twinDay(), now = E.egTrades(X, { from: 0, market: 'xau' }); assert.deepEqual(now.map((r) => r.kind).sort(), ['eg-1h', 'eg-4h']); const h4 = now.find((r) => r.kind === 'eg-4h'), h1 = now.find((r) => r.kind === 'eg-1h');
    assert.deepEqual([h4.side, h4.t, h4.entry, h4.stop], [h1.side, h1.t, h1.entry, h1.stop]); assert.ok(Math.abs((h4.target - h4.entry) / h4.r0 - 4) < 1e-9 && Math.abs((h1.target - h1.entry) / h1.r0 - 10) < 1e-9); }
  const fixed = E.EG.fixed; E.EG.fixed = {}; try {
  const X = twinDay(), each = perTf(X, { from: 0, market: 'xau' }), all = E.egTrades(X, { from: 0, market: 'xau' });
  assert.deepEqual(each.map((r) => r.kind), ['eg-4h', 'eg-1h'], 'read alone, each timeframe gives the order'); const [a, b] = each;
  assert.deepEqual([b.side, b.t, b.entry, b.stop, b.target], [a.side, a.t, a.entry, a.stop, a.target], 'the same order'); assert.ok(stopOk(a) && a.side > 0);
  assert.equal(all.length, 1); assert.deepEqual(all[0], a, 'kept: the H4 reading, unchanged');
  // seeded markets: the output is byte for byte what the function gave before this rule (hashes taken on the code before it),
  // and it is the timeframes read one by one, less only a lower timeframe's copy of an order
  const PIN = { 11: [134, '51184a386d7c76a3'], 4: [153, 'e79be8a21b48ce47'], 7: [136, 'a25a1bb7bc5957ab'] };
  for (const seed of [11, 4, 7]) { const Y = seed === 11 ? B : market(60, seed), r = E.egTrades(Y, { from: 0, market: 'xau' });
    assert.deepEqual([r.length, crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 16)], PIN[seed], 'seed ' + seed);
    const one = new Set(), exp = perTf(Y, { from: 0, market: 'xau' }).filter((x) => { const k = [x.side, x.t, x.entry, x.stop, x.target].join('|'); if (one.has(k)) return false; one.add(k); return true; }).sort((p, q) => p.t - q.t);
    assert.deepEqual(r.map((x) => JSON.stringify(x)).sort(), exp.map((x) => JSON.stringify(x)).sort()); assert.deepEqual(sameOrder(r), []); }
  } finally { E.EG.fixed = fixed; }
});

test('both engulfs side by side: the next-candle reading is its own kinds, every zone it uses is a next-candle engulf, no direct entry, the any-candle reading unchanged', () => {
  const C = B15['15m'], zn = G.zones(C, '15m', 1), za = G.zones(C, '15m'), idx = new Map(C.map((b, i) => [b.time, i]));
  assert.ok(zn.length > 20 && zn.length < za.length, 'fewer zones with the next-candle engulf: ' + zn.length + ' of ' + za.length);
  for (const z of zn) assert.equal(z.i - idx.get(z.base), 1, 'the base is the candle right before the completing one');
  const any = G.methodTrades(B15, { from: 0, market: 'xau' }), nx = G.methodTrades(B15, { from: 0, market: 'xau', span: 'next' });
  assert.ok(nx.length >= 1, 'next-candle trades on these candles: ' + nx.length);
  for (const r of nx) { assert.match(r.kind, /^eg-(plan|simple)-n$/); assert.match(r.id, /^eg-(plan|simple)-n-[bs]-/); assert.match(r.label, / · next-candle EG$/); assert.ok(r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, 'rule 1: ' + r.id); assert.ok(Math.abs(r.r0 - 3) < 1e-9, '30 pips on gold'); }
  assert.ok(any.every((r) => /^eg-(plan|simple|direct)$/.test(r.kind)), 'the any-candle reading keeps its kinds');
  const ids = new Set(any.map((r) => r.id)); assert.ok(nx.every((r) => !ids.has(r.id)), 'no id shared between the two readings');
  assert.match(rd('council/edge-desks.mjs'), /methodTrades\(B, \{ \.\.\.o, span: 'next' \}\)/);
});

test('the earlier scalp method: an EG is two candles, the second closes beyond the first, and the zone drawn is the first candle', () => {
  assert.equal(E.eg2({ open: 2, close: 1, high: 2.1, low: 0.9 }, { open: 1, close: 2.2, high: 2.3, low: 1 }, 1), true);
  assert.equal(E.eg2({ open: 2, close: 1, high: 2.1, low: 0.9 }, { open: 1, close: 2.05, high: 2.3, low: 1 }, 1), false, 'a close inside the first candle\'s wick is no engulf');
  assert.equal(E.eg2({ open: 1, close: 2, high: 2.1, low: 0.9 }, { open: 2, close: 0.8, high: 2, low: 0.7 }, -1), true);
  assert.equal(E.eg2({ open: 1, close: 2, high: 2.1, low: 0.9 }, { open: 2, close: 0.8, high: 2, low: 0.7 }, 1), false);
  const X = market(60, 5, 1.15, 0.0005), rows = E.msnrTrades(X, { from: 0, market: 'eurusd' }); assert.ok(rows.length >= 5, 'entries: ' + rows.length);
  const M5 = X['5m'], at = new Map(M5.map((b, i) => [b.time, i]));
  for (const r of rows) { const z = r.marks.find((m) => m.label === 'M5 EG'), i = at.get(z.a), p = M5[i], c = M5[i + 1];
    assert.ok(z.top === p.high && z.bot === p.low, 'the M5 zone is the first candle, wick to wick: ' + r.id);
    assert.ok(E.eg2(p, c, r.side), 'the second candle closes beyond the first: ' + r.id);
    const z15 = r.marks.find((m) => m.label === 'M15 EG'); if (z15) { const k = M5.filter((b) => b.time >= z15.a && b.time < z15.a + 900); assert.ok(Math.abs(z15.top - Math.max(...k.map((b) => b.high))) < 1e-12 && Math.abs(z15.bot - Math.min(...k.map((b) => b.low))) < 1e-12, 'the M15 zone is the first 15-minute candle: ' + r.id); } }
});

test('an engulf completes within three candles of its first candle, never later (owner, 22 Nov 2026: "Change to 3 candles"; four until then)', () => {
  const c = (o, cl, h, l) => ({ open: o, close: cl, high: h ?? Math.max(o, cl) + 0.1, low: l ?? Math.min(o, cl) - 0.1 }), red = c(10, 9), in1 = c(9, 9.4, 9.5, 8.95), up = c(9.4, 10.5);
  const at = (n) => { const C = [red, ...Array.from({ length: n - 1 }, () => ({ open: 9.2, close: 9.2, high: 9.5, low: 8.95 })), up].map((b, i) => ({ ...b, time: i * 900 })); return G.engulfAt(C, C.length - 1); };
  assert.equal(G.EG_SPAN, 3);
  for (const n of [1, 2, 3]) assert.deepEqual(at(n), { dir: 1, j: 0 }, 'completed by candle ' + n + ' after');
  assert.equal(at(4), null, 'the fourth candle after is too late'); assert.equal(at(5), null);
  assert.match(rd('assets/mosha-sop.js'), /var EG_SPAN = 3;[\s\S]*j >= i - EG_SPAN/, 'the page copy uses the same span');
});

// 22 Nov 2026, owner: "inside the entry zone i want m1 buy eg to become ef to entry for sells, for buy i want in the entry area a
// sell m1 eg to fail"; on six marked examples: "example 3 use the recent one and the rest is perfect"
test('M1 EF entry: inside a 15-minute zone the most recent one-minute engulf of the other side fails, the entry is that close', async () => {
  const G = await import('../council/eg-methods.mjs');
  // a seeded one-minute walk, grouped into 15-minute candles
  const m1of = (n, seed, px, step) => { let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; const out = []; let p = px, drift = 0;
    for (let i = 0; i < n; i++) { if (i % 90 === 0) drift = (rnd() - 0.5) * step * 0.4; const o = p, c = o + drift + (rnd() - 0.5) * step * 2, h = Math.max(o, c) + rnd() * step, l = Math.min(o, c) - rnd() * step; out.push({ time: 1790553600 + i * 60, open: o, high: h, low: l, close: c }); p = c; } return out; };
  const group = (C, sec) => { const out = []; for (const b of C) { const t = b.time - (b.time % sec), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } return out; };
  let n = 0;
  for (const seed of [3, 17, 29]) { const M1 = m1of(6000, seed, 4000, 0.5), X = { '1m': M1, '15m': group(M1, 900) }, all = G.m1Trades(X, { market: 'xau' }), Z15 = G.zones(X['15m'], '15m'), Z1 = G.zones(M1, '1m');
    let busy = -Infinity;
    for (const r of all) { n++; assert.equal(r.kind, 'eg-m1'); assert.equal(r.l, '1m');
      assert.ok(r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, 'a stop on the losing side, the target on the winning side');
      assert.ok(Math.abs(Math.abs(r.target - r.entry) - 2 * r.r0) < 1e-9 && Math.abs(Math.abs(r.entry - r.stop) - r.r0) < 1e-9, '2R, 1R = the opening risk');
      assert.ok(r.t > busy, 'one position at a time'); busy = r.endT || Infinity;
      const [zm, qm] = r.marks, Z = Z15.find((z) => z.dir === r.side && z.base === zm.a && z.top === zm.top), q = Z1.find((z) => z.dir === -r.side && z.base === qm.a && z.fail === r.t);
      assert.ok(Z && q, 'the entry zone is a 15-minute engulf of the trade\'s side, the trigger a one-minute engulf of the other side that failed at the entry');
      assert.ok(q.top <= Z.top && q.bot >= Z.bot && q.at > Z.at && r.t <= Z.end, 'the one-minute engulf is wholly inside the zone, formed after it, and fails while the zone is alive');
      const c = M1.find((b) => b.time + 60 === r.t); assert.equal(r.entry, c.close); assert.ok(r.side > 0 ? c.close > q.top : c.close < q.bot, 'entry = the close through its far side');
      // the most recent one: no newer one-minute engulf of that side, inside the zone, still stood at the entry
      assert.ok(!Z1.some((b) => b.dir === -r.side && b.at > Z.at && b.top <= Z.top && b.bot >= Z.bot && b.at > q.at && b.at <= r.t && (b.fail == null || b.fail > r.t)), 'no newer engulf was still standing');
      if (r.status === 'stopped') assert.ok(r.R <= -1 + 1e-9); if (r.status === 'target') assert.equal(r.R, 2); assert.ok(r.endT == null || r.endT > r.t - 60); }
    // no look-ahead: a trade closed before a cut is the same when the candles end at the cut
    const done = all.filter((r) => r.endT != null); if (done.length > 2) { const cut = done[Math.floor(done.length / 2)].endT + 60, M1c = M1.filter((b) => b.time + 60 <= cut), part = G.m1Trades({ '1m': M1c, '15m': group(M1c, 900) }, { market: 'xau' });
      for (const r of done.filter((x) => x.endT + 60 <= cut)) { const p = part.find((x) => x.id === r.id); assert.ok(p, 'a closed trade exists when cut just after it: ' + r.id); assert.deepEqual([p.entry, p.stop, p.target, p.status, p.R], [r.entry, r.stop, r.target, r.status, r.R]); } } }
  assert.ok(n > 20, 'the seeded markets give entries: ' + n);
  assert.ok(E.DESKS.eg.tfs.includes('1m'), 'the Engulfing desk reads one-minute candles');
  assert.ok(E.DESKS.eg.read({ '5m': [], '15m': [], '1m': [] }, { from: 0, market: 'xau' }).length === 0);
});

// ─── the three-timeframe SOP (22 Nov 2026; the owner's table: marking zone / engulf at the zone / confirmation) ───
// hand-made candles of the H1 / M15 / M5 chain; fillers are dojis (never a first candle, never complete an engulf).
// `gap`: dojis between the M5 first candle and the M5 candle that closes beyond it (1 = completed by the 2nd candle, 3 = the 4th);
// `broken`: an H1 candle closes through the marking zone before the M15 engulf; `flip`: the mirrored sell
const sop3Case = ({ gap = 1, broken = false, flip = false } = {}) => {
  const T0 = 1790553600, m = (v) => (flip ? 200 - v : v);
  const k = (o, c, h, l) => (flip ? { open: m(o), close: m(c), high: m(l), low: m(h) } : { open: o, close: c, high: h, low: l }), dj = (p, h = p + 0.1, l = p - 0.1) => k(p, p, h, l);
  const stamp = (a, sec) => a.map((b, i) => ({ time: T0 + i * sec, ...b }));
  // H1: a red candle 99.5-101.2, engulfed by the next one (the marking zone, known at T0 + 3 h); price comes back in hour 4
  const H1 = stamp([dj(100.5), k(101, 100, 101.2, 99.5), k(100, 102, 102.2, 99.9), broken ? k(102, 99, 102.1, 98.9) : dj(102, 102.3, 101.8), dj(101.5, 102.6, 100.4), ...Array.from({ length: 8 }, () => dj(104))], 3600);
  // M15: candle 16 trades back into the zone (red, 100.4-102.1), candle 17 closes beyond it: the engulf at the zone, known at T0 + 18 x 900
  const M15 = stamp([...Array.from({ length: 16 }, () => dj(102, 102.2, 101.8)), k(102, 100.6, 102.1, 100.4), k(100.6, 102.5, 102.6, 100.5), ...Array.from({ length: 30 }, () => dj(103))], 900);
  // M5: from candle 55 a red candle 101.8-102.6, `gap` dojis, a green close beyond it; then down to the middle (102.2), then up to 2R
  const M5 = stamp([...Array.from({ length: 55 }, () => dj(102.5, 102.55, 102.45)), k(102.5, 101.9, 102.6, 101.8), ...Array.from({ length: gap }, () => dj(102, 102.2, 101.85)), k(102, 102.9, 103, 101.95),
    dj(102.9, 103, 102.6), dj(102.5, 102.7, 102.1), dj(103), dj(104), dj(105), dj(106), dj(106.5, 106.6, 106), ...Array.from({ length: 60 }, () => dj(106.5))], 300);
  return { B: { '1h': H1, '15m': M15, '5m': M5 }, T0, K: T0 + (55 + gap + 2) * 300, fillT: T0 + (55 + gap + 3) * 300, m };
};
const near9 = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test('three-timeframe SOP: zone, engulf at the zone, confirmation; a limit at 50 % of the confirmation zone, the stop past the engulf zone, 2R (a buy and the mirrored sell)', () => {
  for (const flip of [false, true]) { const c = sop3Case({ flip }), d = flip ? -1 : 1, all = G.sopTrades3(c.B, { market: 'xau' });
    assert.equal(all.length, 1, 'one trade'); const r = all[0];
    assert.equal(r.kind, 'eg-sop3'); assert.equal(r.id, `eg3-1h-${flip ? 's' : 'b'}${c.K}`); assert.equal(r.label, 'H1 zone → M15 EG → M5 CF'); assert.equal(r.style, 'scalp'); assert.equal(r.h, '1h'); assert.equal(r.l, '5m'); assert.equal(r.side, d);
    near9(r.entry, c.m(102.2), 'the middle of the M5 zone 101.8-102.6'); near9(r.stop, c.m(100.1), 'the far side of the M15 zone (100.4) and the $0.30 buffer, not the M5 zone'); near9(r.r0, 2.1, '1R'); near9(r.target, c.m(106.4), '2R');
    assert.equal(r.t, c.fillT); assert.equal(r.status, 'target'); assert.equal(r.R, 2);
    assert.deepEqual(r.marks.map((x) => x.label), ['H1 EG zone', 'M15 EG zone · 1 candle', 'M5 EG zone · entry', '50 % · limit']); near9(r.marks[3].p, r.entry, 'the 50 % level');
    assert.ok(r.marks.every((x) => x.at <= c.K), 'every mark was known when the order was placed');
    assert.equal(r.log.length, 6); assert.match(r.log[3].text, /completed in 2 candles/); assert.ok(r.log.every((x) => x.text.length <= 240), 'a log line fits the stored length');
    for (let i = 1; i < 5; i++) assert.ok(r.log[i].t >= r.log[i - 1].t, 'the log is in time order');
  }
  assert.deepEqual(G.SOP3.chains.map((x) => [x.tfs.join('/'), x.style]), [['1d/4h/1h', 'swing'], ['4h/1h/15m', 'intraday'], ['1h/15m/5m', 'scalp']]);
  assert.equal(G.SOP3.rr, 2); assert.equal(G.SOP3.wait, 24); assert.equal(G.SOP3.fill, 24);
});

test('three-timeframe SOP: the confirmation engulf may take 3 candles, never 4; no trade once the marking zone was closed through; no hindsight on the hand-made case', () => {
  assert.equal(G.sopTrades3(sop3Case({ gap: 2 }).B, { market: 'xau' }).length, 1, 'completed by the third candle');
  for (const flip of [false, true]) { assert.equal(G.sopTrades3(sop3Case({ gap: 3, flip }).B, { market: 'xau' }).length, 0, 'the fourth candle is too late');
    assert.equal(G.sopTrades3(sop3Case({ broken: true, flip }).B, { market: 'xau' }).length, 0, 'the marking zone was closed through before the engulf at it'); }
  const c = sop3Case(), full = G.sopTrades3(c.B, { market: 'xau' })[0], sec = { '1h': 3600, '15m': 900, '5m': 300 }, cut = (T) => Object.fromEntries(Object.entries(c.B).map(([tf, a]) => [tf, a.filter((b) => b.time + sec[tf] <= T)]));
  // the test market is short: the 100-candle floor of the 5-minute history is met by candles BEFORE the setup, so pad the front
  const pad = (X) => ({ ...X, '5m': Array.from({ length: 100 }, (_, i) => ({ time: c.T0 - (100 - i) * 300, open: 102.5, close: 102.5, high: 102.55, low: 102.45 })).concat(X['5m']) });
  const after = G.sopTrades3(pad(cut(c.fillT + 300)), { market: 'xau' }); assert.equal(after.length, 1, 'found with the candles cut just after the fill');
  assert.deepEqual([after[0].id, after[0].t, after[0].entry, after[0].stop, after[0].target], [full.id, full.t, full.entry, full.stop, full.target]); assert.equal(after[0].status, 'open'); assert.equal(after[0].R, null);
  assert.equal(G.sopTrades3(pad(cut(c.K - 300)), { market: 'xau' }).length, 0, 'absent before the confirmation engulf has closed');
  assert.equal(G.sopTrades3(pad(cut(c.fillT)), { market: 'xau' }).length, 0, 'the order rests, unfilled, before the fill candle');
});

test('three-timeframe SOP on the seeded market: stops on the losing side, each step known in time, one position a chain, no look-ahead, the other readings untouched', async () => {
  const before = JSON.stringify(B15), all = G.sopTrades3(B15, { from: 0, market: 'xau' }); assert.equal(JSON.stringify(B15), before, 'the candles are not changed');
  assert.ok(all.length >= 30, 'entries: ' + all.length); assert.ok(all.some((r) => r.side > 0) && all.some((r) => r.side < 0));
  const Zs = { '1d': G.zones(B15['1d'], '1d'), '4h': G.zones(B15['4h'], '4h'), '1h': G.zones(B15['1h'], '1h'), '15m': G.zones(B15['15m'], '15m'), '5m': G.zones(B15['5m'], '5m') }, busy = {}, ids = new Set();
  for (const r of all) { const ch = G.SOP3.chains.find((x) => x.tfs[0] === r.h), [zt, et, ct] = ch.tfs, d = r.side;
    assert.ok(!ids.has(r.id)); ids.add(r.id); assert.match(r.id, new RegExp(`^eg3-${zt}-${d > 0 ? 'b' : 's'}\\d+$`)); assert.equal(r.style, ch.style); assert.equal(r.l, ct);
    assert.ok(d > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, 'rule 1: a stop on the losing side: ' + r.id);
    near9(Math.abs(r.target - r.entry), 2 * r.r0, '2R'); near9(Math.abs(r.entry - r.stop), r.r0, '1R');
    const [mz, me, mc] = r.marks, Z = Zs[zt].find((z) => z.dir === d && z.base === mz.a), e = Zs[et].find((z) => z.dir === d && z.base === me.a), c = Zs[ct].find((z) => z.dir === d && z.base === mc.a);
    assert.ok(Z && e && c, 'the three zones are engulf zones of the trade\'s side on their timeframes'); assert.ok(Z.n <= 3 && e.n <= 3 && c.n <= 3, 'each completed within three candles');
    const K = +r.id.match(/(\d+)$/)[1]; assert.equal(c.at, K);
    assert.ok(Z.at <= e.at && e.at < c.at && Z.end > K && e.end > K, 'zone, then the engulf, then the confirmation, the two higher zones alive');
    assert.ok(e.bot <= Z.top && e.top >= Z.bot && c.bot <= e.top && c.top >= e.bot, 'each zone touches the one above');
    near9(r.entry, (c.top + c.bot) / 2, 'the limit is the middle of the confirmation zone'); near9(r.stop, d > 0 ? e.bot - 0.3 : e.top + 0.3, 'the stop is past the engulf zone');
    assert.ok(r.t >= K, 'filled after the order was placed');
    if (r.status === 'stopped') assert.ok(r.R <= -1 + 1e-9); if (r.status === 'target') assert.equal(r.R, 2); assert.ok(['stopped', 'target', 'open'].includes(r.status), 'a trade ends at its stop or its target');
    assert.ok(!(r.t <= (busy[zt] ?? -Infinity)), 'one position at a time a chain'); busy[zt] = r.endT || Infinity; }
  assert.ok(new Set(all.map((r) => r.h)).size >= 2, 'more than one chain trades');
  // no look-ahead: cut the candles at a moment; what is found then is found, the same, with everything after it, and the other way round
  const sec = { ...SOP.SEC, '15m': 900 }, key = (r) => [r.id, r.t, r.entry, r.stop, r.target].join('|');
  for (const back of [5, 17, 31]) { const T = END - back * 86400 - 7 * 300, part = G.sopTrades3(Object.fromEntries(Object.entries(B15).map(([tf, a]) => [tf, a.filter((b) => b.time + sec[tf] <= T)])), { from: 0, market: 'xau' });
    const fullBy = new Map(all.map((r) => [key(r), r])); assert.ok(part.length >= 3);
    for (const p of part) { const f = fullBy.get(key(p)); assert.ok(f, 'missing with later candles: ' + p.id); if (p.R != null) assert.deepEqual([p.status, p.R, p.endT], [f.status, f.R, f.endT]); }
    const partKeys = new Set(part.map(key)); for (const f of all) if (f.t + 300 <= T) assert.ok(partKeys.has(key(f)), 'a trade filled before the cut is found on the cut candles: ' + f.id); }
  // the desk: the reading is added beside the others, whose output is what their own functions give
  const o = { from, market: 'xau' }, desk = E.DESKS.eg.read(B15, o), others = E.egTrades(B15, o).concat(G.methodTrades(B15, o), G.methodTrades(B15, { ...o, span: 'next' }), G.m1Trades(B15, o));
  assert.deepEqual(desk.filter((r) => r.kind !== 'eg-sop3' && r.kind !== 'eg-ef'), others); assert.deepEqual(desk.filter((r) => r.kind === 'eg-sop3'), G.sopTrades3(B15, o));
  for (const tf of ['1d', '4h', '1h', '15m', '5m']) assert.ok(E.DESKS.eg.tfs.includes(tf), 'the desk reads ' + tf);
  // stored: the kind, the label and the style tag survive the record cleaner; another market's id carries its market
  const { clean } = await import('../council/mosha-desk.mjs'), s = clean(all[0]); assert.equal(s.kind, 'eg-sop3'); assert.equal(s.style, all[0].style); assert.equal(s.label, all[0].label); assert.equal(s.marks.length, 4); assert.equal(s.log.length, all[0].log.length);
  assert.equal(clean({ ...all[0], style: 'x<y' }).style, undefined, 'only a known style is stored');
  const eur = Object.fromEntries(Object.entries(B15).map(([tf, a]) => [tf, a.map((b) => ({ time: b.time, open: b.open * 1.15 / 4000, high: b.high * 1.15 / 4000, low: b.low * 1.15 / 4000, close: b.close * 1.15 / 4000 }))])), er = G.sopTrades3(eur, { from: 0, market: 'eurusd' });
  assert.ok(er.length && er.every((r) => /^eurusd:eg3-(1d|4h|1h)-[bs]\d+$/.test(r.id) && (r.side > 0 ? r.stop < r.entry : r.stop > r.entry)));
  // the page names the kind and says what is the desk's own choice
  const page = rd('assets/desk-trades.js'); assert.match(page, /'eg-sop3': 'Three-timeframe SOP'/); assert.match(page, /three-timeframe SOP is listed apart/i); assert.match(page, /The desk\\'s own choices there/);
  assert.match(E.DESKS.eg.note, /three-timeframe SOP/); assert.match(rd('council/eg-methods.mjs'), /PAPER READING of the owner's table, before costs: not a tested rule, never an edge/);
});

test('three-timeframe SOP: the comparison options leave the desk reading as it was, and keep every stop on the losing side', () => {
  const B = sop3Case().B, base = G.sopTrades3(B, { market: 'xau' });
  assert.deepEqual(G.sopTrades3(B, { market: 'xau', conf: 'touch', stop: 'eg', target: 'rr', rr: G.SOP3.rr }), base);
  for (const o of [{ conf: 'inside' }, { stop: 'conf' }, { stop: 'pips' }, { rr: 1 }, { target: 'zone' }])
    for (const r of G.sopTrades3(B, { market: 'xau', ...o })) assert.ok(r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, JSON.stringify(o));
});

// ─── an H4 EF barrier to the next H4 EG zone (23 Nov 2026, a gold example of 20-23 Nov) ───
// the real OANDA candles to 23 Nov 2026 09:00 UTC (the H4 sell zone 3566.86-3595.29 failed at the 04:00 close; price had not yet
// come back to it), then a hand-made 5-minute path: into the barrier, an M15 break up, back to the zone's top, up to the target.
// `mir`: every price mirrored (p -> 8000 - p), so the same story is a sell.
const EFX = JSON.parse(rd('tests/fixtures/xau-ef-barrier-2026-11-23.json')), C23 = 1795392000;
const agg = (m5, sec) => { const out = []; for (const b of m5) { const t = b.time - (b.time % sec), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ ...b, time: t }); } return out; };
const efCase = (pts, mir = false) => {
  const m5 = rows(EFX['5m']); let t = m5.at(-1).time, p = m5.at(-1).close;
  for (const [to, n] of pts) for (let i = 1; i <= n; i++) { const c = p + (to - p) / (n - i + 1); t += 300; m5.push({ time: t, open: p, high: Math.max(p, c) + 0.2, low: Math.min(p, c) - 0.2, close: c }); p = c; }
  const flip = (a) => (mir ? a.map((b) => ({ time: b.time, open: 8000 - b.open, close: 8000 - b.close, high: 8000 - b.low, low: 8000 - b.high })) : a), M5 = flip(m5);
  return { '5m': M5, '15m': agg(M5, 900), '4h': flip(rows(EFX['4h'])).concat(agg(M5.filter((b) => b.time >= C23), 14400)) };
};
const EF_PATH = [[3593.5, 12], [3618, 12], [3618, 6], [3595.0, 10], [3640, 18], [3722, 40]];

test('H4 EF barrier: a gold example of 20-23 Nov 2026 (the failed sell zone, the return, the M15 BO, long at the zone\'s top, the next H4 sell EG as target), and its mirror', () => {
  assert.equal(G.efTrades(efCase([]), { market: 'xau' }).filter((r) => r.t >= C23).length, 0, 'on the real candles alone: price has not come back to the barrier by 09:00 UTC');
  for (const mir of [false, true]) { const m = (v) => (mir ? 8000 - v : v), d = mir ? -1 : 1, all = G.efTrades(efCase(EF_PATH, mir), { market: 'xau' }).filter((r) => r.t >= C23);
    assert.equal(all.length, 1, 'one trade'); const r = all[0];
    assert.equal(r.kind, 'eg-ef'); assert.equal(r.label, 'H4 EF barrier → next H4 EG'); assert.equal(r.id, `eg-ef-${mir ? 's' : 'b'}-1795161600`); assert.equal(r.side, d); assert.equal(r.h, '4h'); assert.equal(r.l, '15m');
    const [ef, bo, tg] = r.marks;
    near9(ef.top, Math.max(m(3595.29), m(3566.86)), 'the EF zone'); near9(ef.bot, Math.min(m(3595.29), m(3566.86)), 'the EF zone'); assert.equal(ef.at, 1795406400, 'failed at the 04:00 H4 close of 23 Nov');
    assert.equal(ef.label, `H4 EF · ${mir ? 'sell' : 'buy'} barrier`); assert.equal(bo.label, `M15 ${mir ? 'V' : 'A'} level · BO ${mir ? 'sell' : 'buy'}`); assert.equal(tg.label, `H4 ${mir ? 'buy' : 'sell'} EG · target`);
    near9(tg.top, Math.max(m(3744.545), m(3719.835)), 'the target zone'); near9(tg.bot, Math.min(m(3744.545), m(3719.835)), 'the target zone');
    near9(r.entry, m(3595.29), 'a limit at the zone\'s top (bottom for the sell)'); near9(r.stop, m(3566.56), 'past the far side by $0.30'); near9(r.target, m(3719.835), 'the near side of the next H4 zone of the other side');
    assert.ok(d > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, 'rule 1');
    assert.equal(r.status, 'target'); near9(r.R, 124.545 / 28.73, '4.34R');
    const K = r.log[3].t; assert.ok(r.marks.every((x) => x.at <= K), 'every mark was known when the order was placed'); assert.ok(r.t >= K);
    for (let i = 1; i < r.log.length; i++) assert.ok(r.log[i].t >= r.log[i - 1].t, 'the log is in time order');
    assert.ok(r.log.every((x) => x.text.length <= 240), 'a log line fits the stored length'); assert.ok(r.marks.every((x) => x.label.length <= 24), 'a mark label fits the stored length'); }
});

test('H4 EF barrier: no trade when the BO never comes, when the zone is closed back through first, when the target is under 2R; no hindsight on the example', () => {
  const n = (pts) => G.efTrades(efCase(pts), { market: 'xau' }).filter((r) => r.t >= C23).length;
  assert.equal(n([[3593.5, 12], [3600, 40]]), 0, 'back in the zone, no M15 close above the last A level and out of it');
  assert.equal(n([[3593.5, 12], [3560, 12], [3618, 12], [3618, 6], [3595.0, 10], [3722, 40]]), 0, 'a 15-minute close below the zone ends it before a BO');
  assert.equal(n([[3593.5, 12], [3618, 12], [3618, 6], [3640, 30]]), 0, 'the order is never filled: the price does not come back to the zone\'s top');
  // the target is the NEAREST opposite H4 zone standing, taken only 2R or more away: on this path an H4 sell engulf made at 16:00
  // (the 08:00 candle, 3600.51-3650.20) stands 0.18R above the entry when the M15 BO closes (16:45): no trade, the farther zone is not taken
  const near = [[3650, 35], [3610, 19], [3616, 6], [3594, 21], [3594, 2], [3625, 12], [3595, 12], [3722, 40]], Bn = efCase(near);
  const zn = G.zones(Bn['4h'], '4h').find((z) => z.dir < 0 && z.at === C23 + 16 * 3600); assert.ok(zn && zn.bot > 3595.29 && zn.bot < 3595.29 + 2 * 28.73 && (zn.fail == null || zn.fail > C23 + 16.75 * 3600), 'a sell zone under 2R stands at the BO');
  assert.equal(G.efTrades(Bn, { market: 'xau' }).filter((r) => r.t >= C23).length, 0, 'the nearest opposite zone is under 2R: no trade');
  const m2 = G.EFB.minRR; try { G.EFB.minRR = 5; assert.equal(n(EF_PATH), 0, 'the example is 4.34R: under a 5R floor it would not be taken'); } finally { G.EFB.minRR = m2; }
  assert.equal(n(EF_PATH), 1);
  // cut the candles: absent before the BO's close, resting unfilled before the fill candle, found the same just after the fill
  const B0 = efCase(EF_PATH), full = G.efTrades(B0, { market: 'xau' }).filter((r) => r.t >= C23)[0], K = full.log[3].t, sec = { '4h': 14400, '15m': 900, '5m': 300 };
  const cut = (T) => Object.fromEntries(Object.entries(B0).map(([tf, a]) => [tf, a.filter((b) => b.time + sec[tf] <= T)]));
  assert.equal(G.efTrades(cut(K - 900), { market: 'xau' }).filter((r) => r.t >= C23).length, 0, 'absent before the M15 BO has closed');
  assert.equal(G.efTrades(cut(full.t), { market: 'xau' }).filter((r) => r.t >= C23).length, 0, 'the order rests, unfilled, before the fill candle');
  const after = G.efTrades(cut(full.t + 300), { market: 'xau' }).filter((r) => r.t >= C23); assert.equal(after.length, 1, 'found with the candles cut just after the fill');
  assert.deepEqual([after[0].id, after[0].t, after[0].entry, after[0].stop, after[0].target], [full.id, full.t, full.entry, full.stop, full.target]); assert.equal(after[0].status, 'open'); assert.equal(after[0].R, null);
});

test('H4 EF barrier on the seeded market: stops on the losing side, a failed H4 zone of the other side as barrier, a 2R+ target zone standing, one position at a time, no look-ahead, the desk and the page', async () => {
  const all = G.efTrades(B15, { from: 0, market: 'xau' }); assert.ok(all.length >= 3, 'entries: ' + all.length);
  const Z4 = G.zones(B15['4h'], '4h'), ids = new Set(); let busy = -Infinity;
  for (const r of all) { const d = r.side; assert.ok(!ids.has(r.id)); ids.add(r.id); assert.match(r.id, /^eg-ef-[bs]-\d+$/);
    assert.ok(d > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, 'rule 1: ' + r.id);
    assert.ok(Math.abs(r.target - r.entry) >= G.EFB.minRR * r.r0 - 1e-9, '2R or more'); near9(Math.abs(r.entry - r.stop), r.r0, '1R');
    const [ef, , tg] = r.marks, Z = Z4.find((z) => z.dir === -d && z.base === ef.a), T = Z4.find((z) => z.dir === -d && z.base === tg.a), K = r.log[3].t;
    assert.ok(Z && Z.fail != null && Z.fail === ef.at && Z.fail < K, 'the barrier is an H4 zone of the other side that failed before the order');
    near9(r.entry, d > 0 ? Z.top : Z.bot, 'a limit at the zone\'s near side'); near9(r.stop, d > 0 ? Z.bot - 0.3 : Z.top + 0.3, 'the stop past its far side');
    assert.ok(T && T.at <= K && (T.fail == null || T.fail > K) && T.end > K, 'the target zone was standing when the order was placed'); near9(r.target, d > 0 ? T.bot : T.top, 'its near side');
    for (const o of Z4) if (o.dir === -d && o.at <= K && (o.fail == null || o.fail > K) && o.end > K) { const p = d > 0 ? o.bot : o.top; assert.ok(!((p - r.entry) * d > 0 && (p - r.entry) * d < (r.target - r.entry) * d - 1e-9), 'the nearest such zone'); }
    assert.ok(['stopped', 'target', 'open'].includes(r.status)); if (r.status === 'stopped') assert.ok(r.R <= -1 + 1e-9);
    assert.ok(r.t > busy, 'one position at a time'); busy = r.endT || Infinity; }
  const sec = { ...SOP.SEC, '15m': 900 }, key = (r) => [r.id, r.t, r.entry, r.stop, r.target].join('|'), fullBy = new Map(all.map((r) => [key(r), r]));
  for (const back of [5, 17, 31]) { const T = END - back * 86400 - 7 * 300, part = G.efTrades(Object.fromEntries(Object.entries(B15).map(([tf, a]) => [tf, a.filter((b) => b.time + sec[tf] <= T)])), { from: 0, market: 'xau' });
    for (const p of part) { const f = fullBy.get(key(p)); assert.ok(f, 'missing with later candles: ' + p.id); if (p.R != null) assert.deepEqual([p.status, p.R, p.endT], [f.status, f.R, f.endT]); }
    const pk = new Set(part.map(key)); for (const f of all) if (f.t + 300 <= T) assert.ok(pk.has(key(f)), 'a trade filled before the cut is found on the cut candles: ' + f.id); }
  const o = { from, market: 'xau' }; assert.deepEqual(E.DESKS.eg.read(B15, o).filter((r) => r.kind === 'eg-ef'), G.efTrades(B15, o));
  const { clean } = await import('../council/mosha-desk.mjs'), s = clean(all[0]); assert.equal(s.kind, 'eg-ef'); assert.equal(s.label, all[0].label); assert.equal(s.marks.length, 3); assert.deepEqual(s.marks.map((x) => x.label), all[0].marks.map((x) => x.label));
  assert.ok(G.efTrades({ ...B15, '5m': B15['5m'].map((b) => ({ time: b.time, open: b.open * 1.15 / 4000, high: b.high * 1.15 / 4000, low: b.low * 1.15 / 4000, close: b.close * 1.15 / 4000 })), '15m': B15['15m'].map((b) => ({ time: b.time, open: b.open * 1.15 / 4000, high: b.high * 1.15 / 4000, low: b.low * 1.15 / 4000, close: b.close * 1.15 / 4000 })), '4h': B15['4h'].map((b) => ({ time: b.time, open: b.open * 1.15 / 4000, high: b.high * 1.15 / 4000, low: b.low * 1.15 / 4000, close: b.close * 1.15 / 4000 })) }, { market: 'eurusd' })
    .every((r) => /^eurusd:eg-ef-[bs]-\d+$/.test(r.id) && (r.side > 0 ? r.stop < r.entry : r.stop > r.entry)), 'another market: its id, a stop on the losing side');
  const page = rd('assets/desk-trades.js'); assert.match(page, /'eg-ef': 'H4 EF barrier → next H4 EG'/); assert.match(page, /The H4 EF barrier is listed apart too/);
  assert.match(E.DESKS.eg.note, /A seventh reading, apart/); assert.match(rd('council/eg-methods.mjs'), /PAPER READING of an example the owner marked, before costs: not a tested rule, never an edge/);
});
