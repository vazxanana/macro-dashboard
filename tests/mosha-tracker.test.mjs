// The Mosha desk's tracker (council/mosha-desk.mjs): the desk's reading of the method on gold, recorded in the council loop
// like the ICT desk's signals (council-data mosha/desk.json). A paper record only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../council/mosha-desk.mjs';

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
  assert.deepEqual(M.OTHER, ['xag', 'eurusd', 'gbpusd', 'nas100']);
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
