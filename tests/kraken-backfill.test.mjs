// node --test tests/kraken-backfill.test.mjs — the replay's Kraken history cache (council/krakenhist.mjs), the time-boxed backfill
// (council/krakenfill.mjs) and the replay's per-market feed choice (council/backtest.mjs) against a fake Kraken (and a fake
// Binance for the fallback): no network, no secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

process.env.KRAKEN_NO_WAIT = '1';
const { krakenTrades, krakenMinutes, krakenData, krakenGap, krakenCoverage, mergeCacheDirs, dayFile, partFile, KRAKEN_FEEDS } = await import('../council/krakenhist.mjs');
const { backfill, plan, prune, targetDay } = await import('../council/krakenfill.mjs');

const T = (s) => Date.parse(s) / 1000;
const NOW = T('2026-11-07T12:00:00Z');
const DAY = 86400;
const px = (t) => 100 + 5 * Math.sin(t / 40000) + 1.5 * Math.sin(t / 3000) + 0.4 * Math.sin(t / 400);

// A fake Kraken: `perDay` trades a day per pair, evenly spaced, at quarter-second times, none after `upTo`. Trades pages 1,000
// trades after the `since` cursor (nanoseconds, exclusive) and returns the last trade's id as `last`, like Kraken.
function fakeKraken({ perDay = { XBTUSD: 3000 }, upTo = NOW } = {}) {
  const calls = [];
  const handle = (u) => {
    const url = new URL(u), q = Object.fromEntries(url.searchParams), pair = q.pair;
    if (url.pathname.endsWith('/Trades')) {
      calls.push({ ep: 'Trades', pair, since: q.since });
      const step = DAY / perDay[pair], since = BigInt(q.since);
      const sinceS = Number(since / 1000000n) / 1000;   // ms precision is enough to find the first trade after it
      let k = Math.max(0, Math.floor((sinceS - 0.25) / step) - 1);
      const tAt = (i) => Math.floor(i * step * 4) / 4 + 0.25, ns = (t) => BigInt(Math.round(t * 4)) * 250000000n;   // exact quarter seconds
      while (ns(tAt(k)) <= since) k++;
      const rows = [];
      for (let i = k; rows.length < 1000 && tAt(i) <= upTo; i++) { const t = tAt(i); rows.push([px(t).toFixed(4), '0.01', t, 'b', 'l', '', i]); }
      return { error: [], result: { [`X${pair}`]: rows, last: rows.length ? String(ns(rows[rows.length - 1][2])) : q.since } };
    }
    if (url.pathname.endsWith('/OHLC')) {
      calls.push({ ep: 'OHLC', pair, interval: q.interval });
      const s = +q.interval * 60, end = Math.floor(upTo / s) * s, rows = [];
      for (let t = end - 719 * s; t <= end; t += s) { const o = px(t), c = px(t + s); rows.push([t, o.toFixed(4), (Math.max(o, c) + 0.1).toFixed(4), (Math.min(o, c) - 0.1).toFixed(4), c.toFixed(4), '0', '1', 5]); }
      return { error: [], result: { [`X${pair}`]: rows, last: end } };
    }
    return { error: ['EGeneral:Unknown method'] };
  };
  return { calls, handle, fetch: async (u) => ({ ok: true, json: async () => handle(u) }) };
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kraken-'));
async function withFetch(fake, fn) { const real = globalThis.fetch; globalThis.fetch = fake.fetch; try { return await fn(); } finally { globalThis.fetch = real; } }

test('Trades paging: stops at `to`, at the call cap and at the deadline, and resumes from the cursor', async () => {
  const k = fakeKraken({ perDay: { XBTUSD: 3000 } }), d = T('2026-11-05T00:00:00Z');
  await withFetch(k, async () => {
    const all = await krakenTrades('XBTUSD', d, d + DAY);
    assert.equal(all.complete, true); assert.equal(all.length, 3000);
    assert.equal(all.calls, 4);   // 3 full pages for the day, the 4th reaches past midnight
    assert.ok(all.every(([t]) => t >= d && t < d + DAY));
    const a = await krakenTrades('XBTUSD', d, d + DAY, 2);
    assert.equal(a.complete, false); assert.equal(a.calls, 2); assert.equal(a.length, 2000);
    const b = await krakenTrades('XBTUSD', d, d + DAY, 10, a.since);
    assert.equal(b.complete, true); assert.equal(a.length + b.length, 3000);
    assert.ok(b[0][0] > a[a.length - 1][0], 'the resumed read starts after the first part');
    const late = await krakenTrades('XBTUSD', d, d + DAY, 10, null, { deadline: Date.now() - 1 });
    assert.equal(late.calls, 0); assert.equal(late.complete, false);
  });
});

test('day cache: a budget-cut day is kept as .part.json with its cursor and call count, finished on the next run', async () => {
  const k = fakeKraken({ perDay: { XBTUSD: 3000 } }), dir = tmp(), from = T('2026-11-04T00:00:00Z');
  try {
    await withFetch(k, async () => {
      // run 1: today (11-07 to 12:00: 2 pages and an empty one, 3 calls) and 11-06 (4 calls) finish; 11-05 is cut after 1 call
      const r1 = await krakenMinutes('XBTUSD', from, NOW, { cacheDir: dir, budget: 8, now: NOW });
      assert.equal(r1.calls, 8); assert.equal(new Date(r1.from * 1000).toISOString().slice(0, 10), '2026-11-06');
      assert.deepEqual(r1.days.map((x) => [x.day, x.calls]), [['2026-11-06', 4]]);
      const p = JSON.parse(fs.readFileSync(partFile(dir, 'XBTUSD', T('2026-11-05T00:00:00Z')), 'utf8'));
      assert.equal(p.calls, 1); assert.ok(p.since && p.bars.length > 0);
      assert.ok(fs.existsSync(partFile(dir, 'XBTUSD', T('2026-11-07T00:00:00Z'))), 'today keeps its cursor');
      // run 2: today reads only its new trades (1 call), 11-06 comes from the cache, 11-05 resumes; 11-04 completes too
      const r2 = await krakenMinutes('XBTUSD', from, NOW, { cacheDir: dir, budget: 50, now: NOW });
      assert.equal(r2.cached, 1);
      assert.deepEqual(r2.days.map((x) => [x.day, x.calls]), [['2026-11-05', 4], ['2026-11-04', 4]], 'the call count spans both runs');
      assert.equal(new Date(r2.from * 1000).toISOString().slice(0, 10), '2026-11-04');
      assert.ok(!fs.existsSync(partFile(dir, 'XBTUSD', T('2026-11-05T00:00:00Z'))), 'a finished day drops its .part.json');
      // the 11-05 candles built in two parts equal the ones built in one read
      const two = JSON.parse(fs.readFileSync(dayFile(dir, 'XBTUSD', T('2026-11-05T00:00:00Z')), 'utf8'));
      const one = await krakenMinutes('XBTUSD', T('2026-11-05T00:00:00Z'), T('2026-11-06T00:00:00Z'), { budget: 50, now: NOW });
      assert.deepEqual(two, one.bars);
      assert.equal(two.length, 1440);
      // run 3: everything whole is cached; only today's new trades are read
      const r3 = await krakenMinutes('XBTUSD', from, NOW, { cacheDir: dir, budget: 50, now: NOW });
      assert.equal(r3.cached, 3); assert.ok(r3.calls <= 1, `calls ${r3.calls}`);
      assert.equal(r3.bars.length, 3 * 1440 + 720);
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('measure: a 30-day BTC backfill at ~175k trades a day is ~5,600 calls (two hours at 1.1 s a call)', async () => {
  // Kraken's XBTUSD printed ~175 calls' worth of trades a day in the 7 Nov runs (900 calls covered 11-03 to 11-07 20:00).
  // The fake prints 175,000 trades a day; the backfill target for a 30-day replay is 32 days back (window + warm-up + margin).
  const k = fakeKraken({ perDay: { XBTUSD: 175000 } }), dir = tmp();
  try {
    await withFetch(k, async () => {
      const rows = await backfill(dir, { days: 30, minutes: 10, now: NOW, pairs: { btc: 'XBTUSD' }, log: () => {} });
      const r = rows[0];
      assert.equal(r.covered, true); assert.equal(r.from, new Date(targetDay(NOW, 30) * 1000).toISOString().slice(0, 10));
      assert.equal(r.callsPerDay, 176);   // 175 full pages and one that reaches past midnight
      assert.ok(r.calls >= 5600 && r.calls <= 5800, `calls ${r.calls}`);
      const hours = (r.calls * 1.1) / 3600;
      assert.ok(hours > 1.7 && hours < 1.8, `hours ${hours}`);   // far beyond the 300 calls a coin the nightly replay spends
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('backfill: fewest missing days first, time-boxed, resumable; coverage and pruning read only the cache', async () => {
  const k = fakeKraken({ perDay: { XBTUSD: 20000, ETHUSD: 4000 } }), dir = tmp(), pairs = { btc: 'XBTUSD', eth: 'ETHUSD' };
  try {
    await withFetch(k, async () => {
      // ETH already has most of its days: it goes first
      for (let d = targetDay(NOW, 5) + 2 * DAY; d < Math.floor(NOW / DAY) * DAY; d += DAY) fs.writeFileSync(dayFile(dir, 'ETHUSD', d), '[]');
      assert.deepEqual(plan(dir, 5, NOW, pairs).map((p) => [p.key, p.missing]), [['eth', 2], ['btc', 7]]);
      // no time at all: nothing is read, nothing lost
      const none = await backfill(dir, { days: 5, minutes: 0, now: NOW, pairs, log: () => {} });
      assert.deepEqual(none.map((r) => r.calls), [0, 0]);
      const rows = await backfill(dir, { days: 5, minutes: 5, now: NOW, pairs, log: () => {} });
      assert.deepEqual(rows.map((r) => [r.key, r.covered, r.daysLeft]), [['eth', true, 0], ['btc', true, 0]]);
      assert.equal(rows[1].callsPerDay, 21);
      const c = krakenCoverage('XBTUSD', dir, NOW);
      assert.equal(c.fromT, targetDay(NOW, 5)); assert.equal(c.days, 7); assert.equal(c.partial, null);
      // a second run only reads today's new trades (none here)
      const again = await backfill(dir, { days: 5, minutes: 5, now: NOW, pairs, log: () => {} });
      assert.ok(again.every((r) => r.calls <= 1), JSON.stringify(again.map((r) => r.calls)));
    });
    // a day the backfill is inside shows its cursor; old crypto days and stray temp files are pruned, other files kept
    const inside = targetDay(NOW, 5) - DAY;
    fs.writeFileSync(partFile(dir, 'XBTUSD', inside), JSON.stringify({ since: String(BigInt(inside + 3600) * 1000000000n), calls: 3, bars: [] }));
    assert.deepEqual(krakenCoverage('XBTUSD', dir, NOW).partial, { day: new Date(inside * 1000).toISOString().slice(0, 10), at: new Date((inside + 3600) * 1000).toISOString().slice(0, 16), calls: 3 });
    fs.writeFileSync(path.join(dir, 'kraken-XBTUSD-2026-08-01.json'), '[]');
    fs.writeFileSync(path.join(dir, 'kraken-EURUSD-2026-08-01.json'), '[]');
    fs.writeFileSync(path.join(dir, 'kraken-XBTUSD-2026-11-06.json.123.tmp'), '[');
    assert.equal(prune(dir, NOW, 60, pairs), 2);
    assert.ok(fs.existsSync(path.join(dir, 'kraken-EURUSD-2026-08-01.json')), 'forex days are not pruned');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('cache merge: a save keeps the other run\'s days; a finished day beats a part; the further cursor wins', () => {
  const a = tmp(), b = tmp();
  try {
    const w = (dir, f, v) => fs.writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v));
    w(a, 'kraken-XBTUSD-2026-11-01.json', '[1]');                                 // only a has it
    w(a, 'kraken-XBTUSD-2026-11-02.json', '[2]'); w(b, 'kraken-XBTUSD-2026-11-02.part.json', { since: '5', bars: [] });   // a finished it
    w(a, 'kraken-ETHUSD-2026-11-03.part.json', { since: '900', bars: [9] }); w(b, 'kraken-ETHUSD-2026-11-03.part.json', { since: '100', bars: [1] });
    w(a, 'kraken-SOLUSD-2026-11-03.part.json', { since: '100', bars: [1] }); w(b, 'kraken-SOLUSD-2026-11-03.part.json', { since: '900', bars: [9] });
    w(a, 'EURUSD_2026_09_01_BID_candles_min_1.bi5', 'x');                          // a Dukascopy file
    w(b, 'kraken-XRPUSD-2026-11-01.json', '[7]');                                  // only b has it
    assert.equal(mergeCacheDirs(a, b), 4);
    const r = (f) => fs.readFileSync(path.join(b, f), 'utf8');
    assert.equal(r('kraken-XBTUSD-2026-11-01.json'), '[1]');
    assert.equal(r('kraken-XBTUSD-2026-11-02.json'), '[2]'); assert.ok(!fs.existsSync(path.join(b, 'kraken-XBTUSD-2026-11-02.part.json')));
    assert.equal(JSON.parse(r('kraken-ETHUSD-2026-11-03.part.json')).since, '900');
    assert.equal(JSON.parse(r('kraken-SOLUSD-2026-11-03.part.json')).since, '900');
    assert.equal(r('kraken-XRPUSD-2026-11-01.json'), '[7]');
    assert.equal(mergeCacheDirs(path.join(a, 'missing'), b), 0);
  } finally { fs.rmSync(a, { recursive: true, force: true }); fs.rmSync(b, { recursive: true, force: true }); }
});

test('feed choice: Kraken only when the cache covers the whole window, every timeframe from Kraken', async () => {
  const k = fakeKraken({ perDay: { XBTUSD: 3000 } }), dir = tmp(), need = T('2026-11-04T12:00:00Z');
  try {
    await withFetch(k, async () => {
      const short = await krakenData('XBTUSD', T('2026-11-04T00:00:00Z'), NOW, { cacheDir: dir, budget: 7, now: NOW });
      assert.match(krakenGap(short.K, short.data, need, 1440), /^Kraken history from 2026-11-06 only \(\d+ 1m candles, 7 calls, 0 days cached; needs 2026-11-04T12:00\)$/);
      const full = await krakenData('XBTUSD', T('2026-11-04T00:00:00Z'), NOW, { cacheDir: dir, budget: 50, now: NOW });
      assert.equal(krakenGap(full.K, full.data, need, 1440), null);
      assert.deepEqual(full.feeds, KRAKEN_FEEDS);
      assert.ok(Object.values(full.feeds).every((f) => f.startsWith('Kraken')));
      assert.deepEqual(Object.keys(full.data).sort(), ['15m', '1d', '1h', '1m', '30m', '4h', '5m']);
      // 1h: Kraken's 720 hourly candles, older hours built from the trades; no hour twice
      const h = full.data['1h'].map((b) => b.time);
      assert.equal(new Set(h).size, h.length); assert.ok(h.every((t, i) => !i || t > h[i - 1]));
      assert.equal(krakenGap({ ...full.K, from: need + 1 }, full.data, need, 1440) !== null, true);
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ─── the replay end to end: backtest.mjs on btc, against a local fake Kraken + Binance ───
const TF = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
function server(upTo) {
  const k = fakeKraken({ perDay: { XBTUSD: 4320 }, upTo }), binance = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1'), send = (j) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (u.pathname.startsWith('/0/public/')) return send(k.handle(`http://x${req.url}`));
    if (u.pathname === '/api/v3/klines') {
      const q = Object.fromEntries(u.searchParams), s = TF[q.interval]; binance.push(q.interval);
      const rows = []; for (let t = Math.ceil(+q.startTime / 1000 / s) * s; t * 1000 <= +q.endTime && t < upTo && rows.length < +q.limit; t += s) { const o = px(t) + 0.05, c = px(t + s) + 0.05; rows.push([t * 1000, String(o), String(Math.max(o, c) + 0.1), String(Math.min(o, c) - 0.1), String(c)]); }
      return send(rows);
    }
    res.writeHead(404); res.end('{}');
  });
  return { srv, kcalls: k.calls, binance };
}
const runBt = (dir, env) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [new URL('../council/backtest.mjs', import.meta.url).pathname, dir, '1'], { env: { ...process.env, BT_MARKETS: 'btc', KRAKEN_NO_WAIT: '1', ...env } });
  let log = ''; p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
  p.on('close', (code) => (code === 0 ? resolve(log) : reject(new Error(`exit ${code}\n${log}`))));
});

test('replay: a coin stays on Binance (whole market, reason recorded) until the Kraken cache covers its window, then Kraken', { timeout: 120000 }, async () => {
  const s = server(Date.now() / 1000), dir = tmp(), cache = path.join(dir, 'cache');
  await new Promise((r) => s.srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.srv.address().port}`, env = { KRAKEN_BASE: `${base}/0/public/`, BINANCE_HOSTS: base, DUKA_CACHE: cache, MD_BASE: `${base}/md/` };
  try {
    // 1. the cache is empty and this run may make only 3 Kraken calls: not enough, so every timeframe comes from Binance
    await runBt(dir, { ...env, KRAKEN_BUDGET_CRYPTO: '3' });
    let bt = JSON.parse(fs.readFileSync(path.join(dir, 'backtest.json'), 'utf8'));
    assert.equal(bt.markets.source.btc, 'Binance');
    assert.ok(Object.values(bt.markets.feeds.btc).every((f) => f === 'Binance BTCUSDT'), JSON.stringify(bt.markets.feeds.btc));
    assert.equal(bt.markets.krakenCoverage.btc.covers, false);
    assert.match(bt.markets.fallback.btc, /^Kraken history from \d{4}-\d\d-\d\d only/);
    assert.deepEqual([...new Set(s.binance)].sort(), Object.keys(TF).sort());
    assert.ok(bt.markets.btc.steps > 0);
    // 2. the backfill fills the cache (here: the next run's budget is enough); the replay switches btc to Kraken, all of it
    s.binance.length = 0;
    await runBt(dir, { ...env, KRAKEN_BUDGET_CRYPTO: '300' });
    bt = JSON.parse(fs.readFileSync(path.join(dir, 'backtest.json'), 'utf8'));
    assert.equal(bt.markets.source.btc, 'Kraken');
    assert.deepEqual(bt.markets.feeds.btc, KRAKEN_FEEDS);
    assert.equal(bt.markets.krakenCoverage.btc.covers, true);
    assert.equal((bt.markets.fallback || {}).btc, undefined);
    assert.equal(s.binance.length, 0, 'no Binance call once Kraken covers the window');
    assert.ok(bt.markets.btc.steps > 0);
    // 3. the next run reads the finished days from the cache and only today's new trades from Kraken
    const before = s.kcalls.filter((c) => c.ep === 'Trades').length;
    await runBt(dir, { ...env, KRAKEN_BUDGET_CRYPTO: '300' });
    assert.ok(s.kcalls.filter((c) => c.ep === 'Trades').length - before <= 3);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'backtest.json'), 'utf8')).markets.source.btc, 'Kraken');
  } finally { s.srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
