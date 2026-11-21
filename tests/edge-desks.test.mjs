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
const stopOk = (r) => (r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry);

test('Engulfing: every trade has its stop on the losing side, one order a zone, and results follow the rule', () => {
  const eg = E.egTrades(B, { from, market: 'xau' });
  assert.ok(eg.length >= 20, 'entries: ' + eg.length);
  const ids = new Set();
  for (const r of eg) { assert.ok(stopOk(r), 'rule 1: ' + r.id); assert.ok(r.r0 > 0); assert.ok(!ids.has(r.id)); ids.add(r.id);
    assert.match(r.kind, /^eg-(1d|4h|1h)$/); assert.ok(r.t >= from && r.t <= END); assert.ok(r.log.length >= 3 && r.marks.length === 2);
    assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - E.EG.target) < 1e-9, 'the target is 10R');
    if (r.status === 'stopped') assert.equal(r.R, -1); if (r.status === 'target') assert.equal(r.R, E.EG.target);
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
  for (let i = 1; i < lit.length; i++) assert.ok(lit[i].t >= (lit[i - 1].endT || Infinity) || lit[i - 1].endT == null, 'no entry inside an earlier trade');
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
test('the three methods: a fixed stop on the losing side, a 2R target, one position at a time, no look-ahead', () => {
  const all = G.methodTrades(B15, { from: 0, market: 'xau' }); assert.ok(all.length >= 5, 'entries: ' + all.length);
  let busy = -Infinity;
  for (const r of all) { assert.ok(stopOk(r), 'rule 1: ' + r.id); assert.match(r.kind, /^eg-(plan|simple|direct)$/); assert.ok(Math.abs(Math.abs(r.entry - r.stop) - G.EGM.pips) < 1e-9, '30 pips on gold'); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - G.EGM.rr) < 1e-9);
    assert.ok(r.t > busy, 'one at a time'); busy = r.endT || Infinity; assert.ok(r.log.every((x, i, a) => !x.t || !i || !a[i - 1].t || x.t >= a[i - 1].t), 'the log runs forward'); assert.ok(r.marks.every((m) => m.at <= r.t), 'every mark was known by the fill'); }
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
  const sn = G.snrTrades(b15, { from: fr, market: 'xau' }); for (const r of sn) { assert.ok(stopOk(r)); assert.equal(r.kind, 'msnr-sop'); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - G.SNR.rr) < 1e-9); }
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
    assert.ok(['v', 'a', 'eg', 'ef', 'dom'].includes(e.kind)); assert.ok(e.top > e.bottom);
    assert.ok(e.zoneAt <= e.tapT + 14400 && e.tapT <= e.t, 'the zone is known and tapped before the break'); assert.ok(e.levelT < e.tapT, 'the level existed before the tap: external');
    assert.ok(e.s > 0 ? H4[e.i].close > e.level : H4[e.i].close < e.level, 'a close beyond the level'); assert.notEqual(e.s, prev); prev = e.s;
    assert.equal(D.call[e.i], e.s); assert.equal(D.events[D.last[e.i]], e); }
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
  for (const l of ['Daily EG zone', 'H4 EG zone', 'M15 EG zone', 'M5 EF (zone failed)', 'M5 EG zone · entry', 'H4 EF (zone failed)', 'Daily ${S.key.kind} level', 'H4 BO ${word(d)}', "ef: 'EF zone'", "v: 'V level'", 'M15 EG', 'M5 EG'])
    assert.ok(src.includes(l), 'mark: ' + l);
});
