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
  assert.deepEqual(Object.keys(E.DESKS), ['eg', 'lit']); assert.equal(E.DESKS.lit.markets.length, Object.keys(SOP.ALL).length); assert.deepEqual(E.DESKS.eg.markets, Object.keys(SOP.MARKETS));
});

test('wiring: the loop runs the trackers, data health lists the files, and the page has both desks with an Open now panel', () => {
  const yml = rd('.github/workflows/council.yml'), dh = rd('council/datahealth.mjs'), page = rd('market-structure.html'), js = rd('assets/desk-trades.js'), src = rd('council/edge-desks.mjs');
  assert.match(yml, /timeout 150 node council\/edge-desks\.mjs data \|\| echo/); assert.match(dh, /file: 'lit\/desk\.json'/); assert.match(dh, /file: 'eg\/desk\.json'/);
  for (const k of ['lit', 'eg']) { assert.match(page, new RegExp(`<section class="view adm" id="v-${k}"`)); assert.match(page, new RegExp(`${k}: 'desks'`)); assert.match(js, new RegExp(`${k}/desk\\.json`)); }
  assert.match(page, /const VIEWS = \[[^\]]*'lit', 'eg'/); assert.equal(page.split('data-dk="open"').length - 1, 2); assert.ok(page.includes('<script src="/assets/desk-trades.js" defer></script>'));
  assert.equal(page.split('<a href="#eg" data-dsw="eg" class="adm">Engulfing</a>').length - 1, 4, 'the switch on every desk');
  assert.doesNotMatch(js, /localStorage|sessionStorage|fetch\(|\.stop\s*=[^=]/, 'the page code only reads the stored record and writes text');
  assert.doesNotMatch(src, /ctrader|alerts\.mjs|trader\.mjs|sendAlerts/, 'a paper record: no order, alert or Trader code');
  assert.match(js, /No trade is open now\./); assert.match(js, /at the last reading/); assert.match(js, /not a tested rule/);
});
