// The Mosha desk's tracker (council/mosha-desk.mjs): the desk's reading of the method on gold, recorded in the council loop
// like the ICT desk's signals (council-data mosha/desk.json). A paper record only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../council/mosha-desk.mjs';
import { createRequire } from 'node:module';
const SOPX = createRequire(import.meta.url)('../assets/mosha-sop.js');

const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const rec = (o) => ({ id: 'bar-15m-1000', kind: 'barrier', h: '15m', l: '1m', side: -1, t: 1000, entry: 100, stop: 102, target: 94, status: 'open', R: null, log: [{ t: 990, text: 'x' }], ...o });

test('a record is stored only with a stop on the losing side of its entry', () => {
  assert.equal(M.clean(rec({ stop: 99 })), null); assert.equal(M.clean(rec({ side: 1, stop: 102 })), null); assert.equal(M.clean(rec({ stop: NaN })), null);
  const c = M.clean(rec({ zone: { big: 1 } })); assert.equal(c.r0, 2); assert.equal(c.zone, undefined); assert.equal(c.side, -1);
});

test('merge: a new record is stamped, live only when seen within the hour; a closed one is frozen; an open one is followed', () => {
  const now = 5000;
  let a = M.merge(null, [rec({ t: now - 600, id: 'a' }), rec({ t: now - 9000, id: 'b', side: 1, stop: 98, target: 106 })], now);
  assert.deepEqual(a.map((r) => [r.id, r.src, r.first]), [['a', 'live', now], ['b', 'replay', now]]);
  // the open one closes: its first sight and source stay
  let b = M.merge(a, [rec({ t: now - 600, id: 'a', status: 'stopped', R: -1, endT: now + 100 }), rec({ t: now - 9000, id: 'b', side: 1, stop: 98, target: 106 })], now + 2000);
  assert.equal(b[0].R, -1); assert.equal(b[0].src, 'live'); assert.equal(b[0].first, now);
  // a closed record never changes, whatever a later run reads
  let c = M.merge(b, [rec({ t: now - 600, id: 'a', status: 'target', R: 3, entry: 101, stop: 103 })], now + 4000);
  assert.deepEqual(c.find((r) => r.id === 'a'), b[0]);
  // a record this run no longer reads is kept
  assert.ok(c.find((r) => r.id === 'b'));
  // the same trade read again under another id (same kind and side, minutes apart) is not added twice
  let d = M.merge(c, [rec({ t: now - 600 + 300, id: 'a2' })], now + 6000);
  assert.equal(d.filter((r) => r.kind === 'barrier' && r.side === -1).length, 1);
  assert.ok(M.merge(null, Array.from({ length: M.KEEP + 50 }, (_, i) => rec({ id: 'k' + i, t: 1e6 + i * 7200 })), 2e9).length === M.KEEP);
});

test('the page functions are lifted from the page, and the script is a paper record only', () => {
  const F = M.loadFns(); for (const k of ['msAnalyze', 'msMosha', 'msZones', 'msInternal']) assert.equal(typeof F[k], 'function');
  const src = rd('council/mosha-desk.mjs');
  assert.doesNotMatch(src, /ctrader|sendAlerts|alerts\.mjs|trader\.mjs|NEW_ORDER|method:\s*'POST'/i);
  const yml = rd('.github/workflows/council.yml');
  assert.match(yml, /timeout 120 node council\/mosha-desk\.mjs data \|\| echo/); assert.match(yml, /\n {12}assets\n/);
  assert.match(rd('council/datahealth.mjs'), /file: 'mosha\/desk\.json'/);
});

test('the desk reads the stored trades first and replays in the browser only without them', () => {
  const js = rd('assets/mosha-sop.js');
  assert.match(js, /D\.json\('mosha\/desk\.json'\)/); assert.match(js, /if \(j && !force\)/); assert.match(js, /S\.file = null; S\.state = 'idle'; replay\(\)/);
  for (const k of ['data-sop-src', 'Live (', 'Replay (', 'Mosha trades']) assert.ok(js.includes(k), k);
  assert.doesNotMatch(js, /fetch\('\/cdata/);
});

test('second source: Kraken when OANDA fails, never a mix; it adds only what is happening now and leaves OANDA records alone', async () => {
  const now = Date.UTC(2026, 10, 18, 12) / 1000;                       // a Wednesday
  const kr = () => ({ ok: true, json: async () => ({ error: [], result: { PAXGUSD: [[now - 600, '10', '11', '9', '10.5', '0', '3', 1], [Date.UTC(2026, 10, 14, 12) / 1000, '1', '2', '0', '1', '0', '1', 1], [now, '1', '1', '1', '1', '0', '1', 1]], last: 1 } }) });
  const get = async (u) => (/kraken/.test(u) ? kr() : { ok: false, status: 502 });
  const c = await M.candles(now, get, async () => {});
  assert.equal(c.feed, 'Kraken'); assert.match(c.why, /502/);
  assert.deepEqual(c.B['5m'].map((b) => b.time), [now - 600]);          // the Saturday candle and the forming one are dropped
  await assert.rejects(M.candles(now, async () => ({ ok: false, status: 500 }), async () => {}), /second source/);
  const ok = await M.candles(now, async (u) => ({ ok: true, json: async () => ({ bars: [{ time: now - 86400 * 3, open: 1, high: 1, low: 1, close: 1 }] }) }), async () => {});
  assert.equal(ok.feed, 'OANDA');
  assert.equal(M.spotShut(Date.UTC(2026, 10, 20, 21) / 1000), true); assert.equal(M.spotShut(Date.UTC(2026, 10, 22, 23) / 1000), false);
  // merge on the fallback
  const prev = M.merge(null, [rec({ id: 'o', t: now - 9000 })], now - 8000);              // an open OANDA record
  const m = M.merge(prev, [rec({ id: 'o', t: now - 9000, status: 'stopped', R: -1 }), rec({ id: 'old', t: now - 30000, side: 1, stop: 98, target: 106 }), rec({ id: 'new', t: now - 900, side: 1, stop: 98, target: 106 })], now, 'Kraken');
  assert.equal(m.find((r) => r.id === 'o').R, null);                    // not closed by another feed's prices
  assert.equal(m.find((r) => r.id === 'old'), undefined);               // no history replayed on another price basis
  const n = m.find((r) => r.id === 'new'); assert.equal(n.feed, 'Kraken'); assert.match(n.log.at(-1).text, /Kraken/);
  // back on OANDA: the Kraken record is left to its own feed, the OANDA one is followed again
  const b = M.merge(m, [rec({ id: 'o', t: now - 9000, status: 'stopped', R: -1 }), rec({ id: 'new', t: now - 900, side: 1, stop: 98, target: 106, status: 'target', R: 3 })], now + 600);
  assert.equal(b.find((r) => r.id === 'o').R, -1); assert.equal(b.find((r) => r.id === 'new').R, null);
});

test('a record keeps the marks its chart draws, and the chart opens it with them and its log as the steps', async () => {
  const c = M.clean(rec({ marks: [{ kind: 'zone', top: 105, bot: 101, a: 500, at: 600, label: 'M15 barrier', junk: 1 }, { kind: 'level', p: 99, a: 900, label: 'QM', under: true }, { kind: 'x', a: 1 }, { kind: 'level', p: NaN, a: 2 }] }));
  assert.deepEqual(c.marks, [{ kind: 'zone', a: 500, at: 600, label: 'M15 barrier', top: 105, bot: 101 }, { kind: 'level', a: 900, at: 900, label: 'QM', p: 99, under: true }]);
  const RP = (await import('../assets/mosha-replay.js')).default, at = 1e9;
  const sp = RP.specOfTrade({ replayed: true, name: 'M15 barrier, M1 QM', id: 'a', market: 'xau', side: 'sell', at, entry: 100, stop: 102, target: 94, status: 'closed', exit: 102, exitAt: at + 3600, R: -1,
    marks: [{ kind: 'zone', top: 105, bot: 101, a: at - 86400, at: at - 86000, label: 'M15 barrier' }], steps: [{ t: at - 86000, text: 'barrier' }, { t: at, text: 'entry' }] }, at + 9e5);
  assert.equal(sp.marks.length, 1); assert.equal(sp.marks[0].b, sp.to); assert.ok(sp.from <= at - 86400 - 3 * 3600 && sp.from >= at - 6 * 86400);
  assert.equal(sp.steps.length, 2); assert.equal(sp.exit, null); assert.match(sp.label, /M15 barrier, M1 QM/);
  // a logged trade without marks is drawn as before
  const lg = RP.specOfTrade({ id: 'b', market: 'xau', side: 'buy', at, entry: 100, stop: 98, target: 104, status: 'open' }, at + 100);
  assert.equal(lg.from, at - 12 * 3600); assert.equal(lg.steps.length, 3); assert.equal(lg.marks.length, 0);
  // the history option reads further back
  const seen = []; await M.bars('1h', 2e9, async (u) => { seen.push(+/from=(\d+)/.exec(u)[1]); return { ok: true, json: async () => ({ bars: [] }) }; }, 90);
  assert.ok(Math.min(...seen) <= 2e9 - (90 + 76) * 86400);
});

test('more markets: a record of another market keeps its market and its decimals, and is never taken for a gold trade re-read', () => {
  const fx = M.clean(rec({ id: 'eurusd:bar-15m-1000', market: 'eurusd', entry: 1.152345, stop: 1.153012, target: 1.150344 }));
  assert.equal(fx.market, 'eurusd'); assert.equal(fx.entry, 1.152345); assert.equal(fx.stop, 1.153012);
  assert.equal(M.clean(rec({})).market, undefined, 'a gold record is stored as before');
  assert.equal(M.clean(rec({ market: 'nope' })).market, undefined);
  assert.equal(M.clean(rec({ id: 'eurusd:x', market: 'eurusd', entry: 1.15, stop: 1.14 })), null, 'rule 1 on every market');
  const out = M.merge([M.clean(rec({}))], [rec({ id: 'eurusd:bar-15m-1000', market: 'eurusd', entry: 1.1523, stop: 1.1530, target: 1.1502 })], 1500);
  assert.equal(out.length, 2, 'same kind, side and minute on another market is another trade');
  assert.deepEqual(M.OTHER, ['eurusd', 'gbpusd']);
  const src = rd('council/mosha-desk.mjs'); assert.match(src, /for \(const m of OTHER\) \{ try \{/); assert.match(src, /skipped/);
  const page = rd('assets/mosha-sop.js'); assert.match(page, /data-sop-mk/); assert.match(page, /market: mkR\(r\)/);
});

test('Open now: the desk has its own panel of open trades, first on the desk, hidden for the teacher, kept on the phone', () => {
  const page = rd('market-structure.html'), js = rd('assets/mosha-sop.js');
  assert.ok(page.indexOf('id="mo-open"') > 0 && page.indexOf('id="mo-open"') < page.indexOf('id="mo-sopr"'));
  assert.match(page, /html\[data-mosha="teach"\]:not\(\[data-role="owner"\]\) #v-mosha #mo-open \{ display: none; \}/);
  assert.match(page, /#v-mosha #mo-open \{ order: -11; \}/); assert.match(page, /:not\(#mo-sopr\):not\(#mo-open\)/); assert.match(page, /c\.id === 'mo-open'/);
  assert.match(js, /openPanel\(every\.filter\(function \(r\) \{ return r\.R == null; \}\)\)/, 'every open record, whatever the filter');
  assert.match(js, /at the last reading/); assert.match(js, /No trade is open now\./); assert.match(js, /#mo-open \[data-sop-chart\]/);
  const block = js.slice(js.indexOf('function openCard'), js.indexOf('function draw()'));
  assert.doesNotMatch(block, /fetch\(|localStorage|\.stop\s*=[^=]/, 'display only');
});

test('P&L calendar: a month of closed R by the UTC exit day, open trades never added in, on all three desks', () => {
  const SOP = SOPX, day = (s) => Date.parse(s + 'Z') / 1000;
  const rows = [{ id: 'a', side: 1, R: 2, endT: day('2026-11-18T10:00:00') }, { id: 'b', side: -1, R: -1, endT: day('2026-11-18T15:00:00') }, { id: 'c', side: 1, R: -1, endT: day('2026-11-02T09:00:00') },
    { id: 'd', side: 1, R: 3, endT: day('2026-10-30T09:00:00') }, { id: 'e', side: 1, R: null, endT: null, float: 5 }];
  const M = SOP.calMonth(rows, null); assert.equal(M.ym, '2026-11', 'the latest month with a close'); assert.equal(M.n, 3); assert.equal(M.R, 0); assert.equal(M.prev, '2026-10'); assert.equal(M.next, null);
  assert.equal(M.cells.filter(Boolean).length, 30); assert.equal(M.cells.findIndex(Boolean), 6, '1 Nov 2026 is a Sunday: six empty cells before it (Monday first)');
  const d18 = M.cells.find((c) => c && c.day === '2026-11-18'); assert.equal(d18.n, 2); assert.equal(d18.R, 1);
  assert.equal(SOP.calMonth(rows, '2026-10').R, 3); assert.equal(SOP.calMonth(rows, '2031-01').ym, '2026-11', 'an unknown month falls back'); assert.equal(SOP.calMonth([], null).ym, null);
  const st = { calM: null, calDay: '2026-11-18' }, html = SOP.calHTML(rows, st, 'data-x-chart', (r) => 'Gold ' + r.id);
  assert.match(html, /P&amp;L calendar/); assert.match(html, /November 2026/); assert.match(html, /data-cal-day="2026-11-18"/); assert.match(html, /data-x-chart="a"/); assert.doesNotMatch(html, /data-x-chart="e"/, 'an open trade is not in a day');
  assert.match(html, /before costs/); assert.equal(st.calM, '2026-11');
  const page = rd('market-structure.html'), sop = rd('assets/mosha-sop.js'), dk = rd('assets/desk-trades.js');
  assert.match(page, /#v-mosha \.mo-cal \{ display: grid; grid-template-columns: repeat\(7/); assert.match(sop, /calHTML\(list, S, 'data-sop-chart'/); assert.match(dk, /SOP\.calHTML\(list, S, 'data-dk-chart'/);
});

test('a re-entry after a close is a new trade; only the same trade re-read under another id is left out', () => {
  const now = 1795000000, r = (o) => ({ id: 'x', kind: 'msnr-main', side: 1, t: now - 5000, entry: 100, stop: 98, target: 103, status: 'stopped', R: -1, endT: now - 4700, exit: 98, log: [], marks: [], ...o });
  const prev = M.merge([], [r({ id: 'a' })], now - 4000);
  // 10 minutes later, after the first was stopped, at another price: a new trade
  const next = M.merge(prev, [r({ id: 'a' }), r({ id: 'b', t: now - 4400, entry: 99.2, stop: 97.2, target: 102.2, status: 'open', R: null, endT: null, exit: null })], now);
  assert.deepEqual(next.map((x) => x.id).sort(), ['a', 'b']);
  // the same order read under another id while the stored one is still open, at the same price: not stored twice
  const open = M.merge([], [r({ id: 'c', status: 'open', R: null, endT: null, exit: null })], now - 4000);
  const twin = M.merge(open, [r({ id: 'c', status: 'open', R: null, endT: null, exit: null }), r({ id: 'c2', t: now - 4700, entry: 100.1, status: 'open', R: null, endT: null, exit: null })], now);
  assert.deepEqual(twin.map((x) => x.id), ['c']);
});

test('an open record the run no longer reads is settled on the candles at its stored stop and target, never guessed', () => {
  const bar = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c }), r = M.clean(rec({ t: 1200, float: -0.2 })), none = new Set();
  // a sell at 100, stop 102, target 94
  const quiet = [bar(900, 100, 100.5, 99.5, 100), bar(1200, 100, 101, 99, 100), bar(1500, 100, 101.5, 98, 99)];
  assert.equal(M.settle([r], none, quiet)[0].status, 'open', 'neither level reached: still open');
  const stop = M.settle([r], none, quiet.concat(bar(1800, 99, 102.5, 93, 95)))[0];
  assert.equal(stop.status, 'stopped'); assert.equal(stop.R, -1); assert.equal(stop.endT, 1800); assert.equal(stop.float, undefined); assert.ok(stop.settled, 'the stop first when one candle holds both');
  assert.match(stop.log.at(-1).text, /no longer reads this trade again/); assert.ok(stop.log.every((x) => x.t != null));
  const tgt = M.settle([r], none, quiet.concat(bar(1800, 99, 99.5, 93.5, 94)))[0]; assert.equal(tgt.status, 'target'); assert.equal(tgt.R, 3);
  const gap = M.settle([r], none, quiet.concat(bar(1800, 103, 103.5, 102.5, 103)))[0]; assert.equal(gap.exit, 103); assert.equal(gap.R, -1.5, 'a gap through the stop exits at the open');
  const all = quiet.concat(bar(1800, 99, 102.5, 93, 95));
  assert.equal(M.settle([r], new Set([r.id]), all)[0].status, 'open', 'a record the run read is the run\'s to follow');
  assert.equal(M.settle([{ ...r, market: 'eurusd' }], none, all)[0].status, 'open', 'another market\'s candles settle nothing');
  assert.equal(M.settle([{ ...r, feed: 'Kraken' }], none, all)[0].status, 'open', 'another feed\'s record is left alone');
  assert.equal(M.settle([{ ...r, t: 600 }], none, all)[0].status, 'open', 'a record from before the candles on file is left alone');
  // the candle that holds the fill can only stop the trade (review, 21 Nov 2026)
  const mid = { ...r, t: 1380 }, pre = [bar(900, 100, 100.5, 99.5, 100)];
  assert.equal(M.settle([mid], none, pre.concat(bar(1200, 100, 102.5, 99, 100), bar(1500, 99, 99.5, 93, 94)))[0].status, 'stopped', 'a stop touched in the fill\'s own 5-minute candle is read');
  assert.equal(M.settle([r], none, pre.concat(bar(1200, 100, 100.5, 93, 99), bar(1500, 99, 100, 98, 99)))[0].status, 'open', 'the fill candle reaching the target is not a target');
  // a direct entry with no target and a trailed stop settles at the stop it stood at, R from the opening risk
  const tr = M.settle([{ ...r, target: null, stopNow: 99, stopAt: 1500, r0: 2 }], none, pre.concat(bar(1200, 100, 100.5, 99.5, 100), bar(1500, 98.5, 99.4, 98, 99)))[0];
  assert.equal(tr.status, 'trail'); assert.equal(tr.exit, 99); assert.equal(tr.R, 0.5);
  // review 21 Nov 2026: the trailed stop does not exist before it moved, so a candle before `stopAt` is read at the opening stop
  const early = M.settle([{ ...r, target: null, stopNow: 99, stopAt: 1800, r0: 2 }], none, pre.concat(bar(1200, 100, 100.5, 99.5, 100), bar(1500, 98.5, 99.4, 98, 99)))[0];
  assert.equal(early.status, 'open', 'the stop at 99 is not in force before 1800');
  assert.equal(M.settle([{ ...r, target: null, stopNow: 99, r0: 2 }], none, pre.concat(bar(1200, 100, 100.5, 99.5, 100), bar(1500, 98.5, 99.4, 98, 99)))[0].status, 'open', 'no move time: the opening stop');
  assert.equal(M.clean(rec({ target: null, stopNow: 99, stopAt: 1800 })).stopAt, 1800, 'clean keeps the move time');
  const kept = M.clean(rec({ target: null, stopNow: 99 })); assert.equal(kept.target, null, 'no target stays no target (not 0)'); assert.equal(kept.stopNow, 99);
  const closed = { ...r, status: 'target', R: 3 }; assert.equal(M.settle([closed], none, all)[0], closed, 'a closed record is frozen');
  assert.match(rd('council/edge-desks.mjs'), /settle\(merge\(records, fresh, now\)/); assert.match(rd('council/mosha-desk.mjs'), /settle\(merge\(prev && prev\.records, fresh, now, feed\)/);
});

test('the Mosha desk keeps gold, EUR/USD and GBP/USD only (owner, 21 Nov 2026): other markets\' records go', () => {
  const rec = (id, market) => ({ id, t: 1795000000 + id.length, side: 1, entry: 1, stop: 0.9, target: 1.2, status: 'stopped', R: -1, kind: 'barrier', ...(market ? { market } : {}) });
  const out = M.keepMarkets({ records: [rec('a'), rec('xag:b', 'xag'), rec('eurusd:c', 'eurusd'), rec('nas100:d', 'nas100'), rec('gbpusd:e', 'gbpusd')], counts: {} });
  assert.deepEqual(out.records.map((r) => r.id), ['a', 'eurusd:c', 'gbpusd:e']);
  assert.deepEqual(out.markets.sort(), ['eurusd', 'gbpusd', 'xau']); assert.equal(out.counts.n, 3);
});

test('the readings of 21 Nov 2026 (second table, M30 barriers, repeat of the SOP) are read back from a stored id, and are never taken for a re-read of another order', () => {
  const g = (id) => SOPX.readings({ id });
  assert.deepEqual([g('bar-4h-c30-s1000').alt, g('bar-1h-c15-z-b1000').alt, g('bar-1h-s1000').alt], ['30m', '15m', null]);
  assert.deepEqual([g('bar-sop-1h-m5-b1000').rsop, g('bar-sop-sw-4h-c30-v2-s1000').rsop, g('bar-j-1h-s1000').rsop], [true, true, false]);
  assert.equal(g('bar-sop-sw-4h-c30-v2-s1000').sweep, true); assert.equal(g('bar-sop-sw-4h-c30-v2-s1000').visit, 2);
  assert.deepEqual([g('bar-30m-s1000').m30, g('bar-j-cf-30m-b1000').m30, g('eurusd:bar-sop-vr-30m-s1000').m30, g('bar-15m-s1000').m30, g('bar-sw-4h-c30-s1000').m30], [true, true, true, false, false]);
  // a stored record keeps no flag: the same reading must come back from the cleaned record
  const c = M.clean(rec({ id: 'bar-sop-1h-c15-s1000', h: '1h', l: '15m', alt: '15m', rsop: true, label: 'H1 barrier · BO origin · repeat SOP · M15 confirm · with H4' }));
  assert.deepEqual(SOPX.readings(c), SOPX.readings({ id: c.id, alt: '15m', rsop: true }));
  // an order at the same price and minute under another reading is its own record
  const prev = [{ ...M.clean(rec({ id: 'bar-1h-s1000', h: '1h', l: '5m' })), first: 1, src: 'replay' }];
  const out = M.merge(prev, [rec({ id: 'bar-1h-s1000', h: '1h', l: '5m' }), rec({ id: 'bar-sop-1h-s1300', h: '1h', l: '5m', t: 1300 }), rec({ id: 'bar-1h-c15-s1000', h: '1h', l: '15m' })], 5000);
  assert.deepEqual(out.map((r) => r.id).sort(), ['bar-1h-c15-s1000', 'bar-1h-s1000', 'bar-sop-1h-s1300']);
});

// 21 Nov 2026 (independent review): one order under two ids was stored twice; the tags that change no trade are kept
test('one order is stored once: where the tracker joins the sequence and the barrier lists the sequence\'s record is kept; a CF-inside-the-VR record is its own reading', () => {
  const o = { market: 'xau', side: 1, t: 1795000300, entry: 4397.57, stop: 4393.99, target: 4403.87, status: 'open', R: null, log: [], marks: [] };
  const seq = [{ ...o, id: 'sop-5m-1795000000', kind: 'sop', h: '15m', l: '5m' }], bars = [{ ...o, id: 'bar-sop-1h-b1795000300', kind: 'barrier', h: '1h', l: '5m', rsop: true }, { ...o, id: 'bar-1h-b1795000900', kind: 'barrier', h: '1h', l: '5m', t: 1795000900 }];
  const m5 = Array.from({ length: 12 }, (_, i) => ({ time: 1795000000 + i * 300, open: 4397, high: 4398, low: 4396, close: 4397 }));
  const keep = [SOPX.sopTrades, SOPX.barrierTrades, SOPX.oldBarrierTrades];
  try { SOPX.sopTrades = () => seq.map((r) => ({ ...r })); SOPX.barrierTrades = () => bars.map((r) => ({ ...r })); SOPX.oldBarrierTrades = () => [];
    const out = M.build({ '5m': m5 }, {}, null, 1795004000);
    assert.deepEqual(out.records.map((r) => r.id).sort(), ['bar-1h-b1795000900', 'sop-5m-1795000000'], 'the repeat-SOP twin of the sequence\'s order is not stored');
    assert.equal(new Set(out.records.map((r) => [r.side, r.t, r.entry, r.stop].join('|'))).size, out.records.length);
  } finally { [SOPX.sopTrades, SOPX.barrierTrades, SOPX.oldBarrierTrades] = keep; }
  assert.match(rd('council/mosha-desk.mjs'), /SOP\.uniq\(seq\.concat\(SOP\.barrierTrades\(/);
  // clean keeps the new fields, and only where a record has them
  const c = M.clean(rec({ id: 'sop-c2-i-30m-1000', kind: 'sop', h: '1h', l: '30m', case: 2, case2: true, withWeekly: false, er20: 0.3149, label: 'H1 iBO → M30 VR, CF · CF inside the VR' }));
  assert.deepEqual([c.case2, c.withWeekly, c.er20, c.case, c.label], [true, false, 0.31, 2, 'H1 iBO → M30 VR, CF · CF inside the VR']);
  assert.equal(M.clean(rec({ kind: 'sop', withWeekly: true, er20: 0 })).withWeekly, true); assert.equal(M.clean(rec({ kind: 'sop', withWeekly: true, er20: 0 })).er20, 0);
  const plain = M.clean(rec({ kind: 'sop', withWeekly: null, er20: null })); assert.ok(!('case2' in plain) && !('withWeekly' in plain) && !('er20' in plain), 'no tag where none is known');
  // a CF-inside-the-VR record beside a clean sequence record of the same minute and price is another reading, never a re-read
  const prev = [{ ...M.clean(rec({ id: 'sop-30m-1000', kind: 'sop', h: '1h', l: '30m' })), first: 1, src: 'replay' }];
  const out = M.merge(prev, [rec({ id: 'sop-30m-1000', kind: 'sop', h: '1h', l: '30m' }), rec({ id: 'sop-c2-30m-1300', kind: 'sop', h: '1h', l: '30m', t: 1300, case: 2, case2: true })], 5000);
  assert.deepEqual(out.map((r) => r.id).sort(), ['sop-30m-1000', 'sop-c2-30m-1300']);
  assert.equal(M.merge(out, [rec({ id: 'sop-c2-30m-1600', kind: 'sop', h: '1h', l: '30m', t: 1600, case: 2, case2: true })], 6000).length, 2, 'the same c2 trade re-read under another id is still left out');
});
