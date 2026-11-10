// node --test tests/oanda-symbols.test.mjs — the OANDA symbol map (api/_oanda.js) is complete for the research universe and
// consistent (lowercase key → instrument, display decimals, group), the /md/bars timeframes include D and W, and the daily
// cache script (scripts/daily-cache.mjs) writes compact D1 files from a fake proxy. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { windows, merge, refresh, main, CAP, DAY, START, COLS } from '../scripts/daily-cache.mjs';

const require = createRequire(import.meta.url);
const { SYM, DEC, GROUP, LIST } = require('../api/_oanda.js');
const BARS = require('../api/bars.js');
const ROOT = new URL('..', import.meta.url).pathname;

// what the breadth studies (ict-breadth, open-run-breadth), the live page and the alerts need
const REQUIRED = {
  xau: 'XAU_USD', xag: 'XAG_USD', xpt: 'XPT_USD', xpd: 'XPD_USD', xcu: 'XCU_USD',
  nas100: 'NAS100_USD', spx500: 'SPX500_USD', us30: 'US30_USD', us2000: 'US2000_USD', de40: 'DE30_EUR', uk100: 'UK100_GBP', jp225: 'JP225_USD',
  au200: 'AU200_AUD', eu50: 'EU50_EUR', hk33: 'HK33_HKD', cn50: 'CN50_USD', fr40: 'FR40_EUR', ch20: 'CH20_CHF',
  bco: 'BCO_USD', wtico: 'WTICO_USD', natgas: 'NATGAS_USD', usb10y: 'USB10Y_USD', de10yb: 'DE10YB_EUR',
  eurusd: 'EUR_USD', gbpusd: 'GBP_USD', audusd: 'AUD_USD', nzdusd: 'NZD_USD', usdjpy: 'USD_JPY', usdcad: 'USD_CAD', usdchf: 'USD_CHF',
  eurjpy: 'EUR_JPY', gbpjpy: 'GBP_JPY', eurgbp: 'EUR_GBP', audjpy: 'AUD_JPY', eurchf: 'EUR_CHF', audnzd: 'AUD_NZD', cadjpy: 'CAD_JPY', chfjpy: 'CHF_JPY',
};

test('symbol map: every required market, keys unchanged for the page', () => {
  for (const [k, inst] of Object.entries(REQUIRED)) assert.equal(SYM[k], inst, `SYM.${k}`);
  assert.ok(Object.keys(SYM).length >= 60, 'the research universe');
});

test('symbol map: lowercase keys, OANDA instrument names, unique, decimals and group for each', () => {
  const insts = new Set();
  for (const [k, inst, dec, group] of LIST) {
    assert.match(k, /^[a-z][a-z0-9]*$/, k);
    assert.match(inst, /^[A-Z0-9]+_[A-Z]{3}$/, inst);
    assert.ok(!insts.has(inst), `duplicate instrument ${inst}`); insts.add(inst);
    assert.ok(Number.isInteger(dec) && dec >= 0 && dec <= 5, `${k} decimals`);
    assert.ok(['metal', 'index', 'energy', 'bond', 'ag', 'fx'].includes(group), `${k} group`);
    assert.equal(SYM[k], inst); assert.equal(DEC[k], dec); assert.equal(GROUP[k], group);
  }
  assert.deepEqual(Object.keys(SYM).sort(), Object.keys(DEC).sort());
  assert.deepEqual(Object.keys(SYM).sort(), Object.keys(GROUP).sort());
  assert.equal(LIST.length, Object.keys(SYM).length, 'no key defined twice');
});

test('symbol map: decimals follow the quote currency / asset class', () => {
  for (const [k, inst, dec, group] of LIST) {
    const quote = inst.slice(-3);
    if (group === 'fx') assert.equal(dec, quote === 'JPY' ? 3 : 5, `${k} fx decimals`);
    if (group === 'index') assert.ok(dec <= 2, `${k} index decimals`);
    if (group === 'bond' || group === 'energy') assert.equal(dec, 3, `${k} decimals`);
    if (k === 'xau') assert.equal(dec, 3);
    if (k === 'xag') assert.equal(dec, 4);
  }
});

test('symbol map: null prototype (sym=constructor / __proto__ answer unknown sym)', () => {
  for (const m of [SYM, DEC, GROUP]) { assert.equal(Object.getPrototypeOf(m), null); for (const bad of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) assert.equal(m[bad], undefined, bad); }
});

test('/md/bars accepts D and W next to the page timeframes; the alias maps are null-prototype', () => {
  const src = fs.readFileSync(path.join(ROOT, 'api/bars.js'), 'utf8');
  for (const tf of ["'1m'", "'5m'", "'15m'", "'1h'", "'4h'", "'1d'", 'D:', "'1w'", 'W:']) assert.ok(src.includes(tf), `tf ${tf}`);
  assert.match(src, /D: \['D', 86400/); assert.match(src, /W: \['W', 604800/);
});

test('/md/bars: ChronosTrade timeframes map to OANDA granularities with the right seconds', async () => {
  const want = { '1m': ['M1', 60], '2m': ['M2', 120], '5m': ['M5', 300], '10m': ['M10', 600], '15m': ['M15', 900], '30m': ['M30', 1800], '1h': ['H1', 3600], '2h': ['H2', 7200], '4h': ['H4', 14400], '1d': ['D', 86400], '1w': ['W', 604800] };
  const page = fs.readFileSync(path.join(ROOT, 'backtest.html'), 'utf8'), m = /const TFS = (\{[^}]+\});/.exec(page); assert.ok(m, 'the page lists its timeframes');
  const TFS = Function('return ' + m[1])(); assert.deepEqual(TFS, Object.fromEntries(Object.entries(want).map(([k, v]) => [k, v[1]])), 'page seconds');
  const opts = [...page.matchAll(/<option value="(\d+[mhd])"(?: selected)?>/g)].map((x) => x[1]); assert.deepEqual(opts, ['1m', '2m', '5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d'], 'replay timeframes in the session form');
  const handler = BARS, realFetch = globalThis.fetch, had = Object.prototype.hasOwnProperty.call(process.env, 'OANDA_TOKEN'), tok = process.env.OANDA_TOKEN; process.env.OANDA_TOKEN = 'test-token';
  const mk = () => { const out = {}; const res = { setHeader() {}, status(c) { out.code = c; return res; }, json(j) { out.json = j; return res; } }; return [out, res]; };
  try {
    for (const [tf, [gran, sec]] of Object.entries(want)) {
      let url = ''; globalThis.fetch = async (u) => { url = String(u); return { ok: true, json: async () => ({ candles: [{ time: '1000', complete: true, volume: 1, mid: { o: '1', h: '2', l: '0.5', c: '1.5' } }] }) }; };
      const n = sec >= 604800 ? 2000 : 6000, to = 1700000000, [out, res] = mk(); await handler({ query: { sym: 'xau', tf, from: String(to - n * sec), to: String(to) } }, res);   // a window that ended in the past
      assert.equal(out.code, 200, tf); const q = new URL(url).searchParams; assert.equal(q.get('granularity'), gran, tf + ' -> ' + gran);
      assert.equal(+q.get('to') - +q.get('from'), Math.min(n, 4999) * sec, tf + ': the window is capped at 4999 candles');
    }
    const [out, res] = mk(); await handler({ query: { sym: 'xau', tf: '3m' } }, res); assert.equal(out.code, 400, 'an unknown timeframe is refused');
  } finally { globalThis.fetch = realFetch; if (had) process.env.OANDA_TOKEN = tok; else Reflect.deleteProperty(process.env, 'OANDA_TOKEN'); }
});

test('daily cache workflow: weekly, free, writes research/daily to council-data through the script', () => {
  const y = fs.readFileSync(path.join(ROOT, '.github/workflows/daily-cache.yml'), 'utf8');
  assert.match(y, /cron: '\d+ \d+ \* \* [0-6]'/, 'weekly schedule');
  assert.ok(y.includes('ref: council-data')); assert.ok(y.includes('node scripts/daily-cache.mjs data'));
  assert.ok(y.includes('git -C data add research/daily'));
  assert.ok(!/secrets\./.test(y), 'no secrets: the proxy is keyless');
  assert.ok(!y.includes('${{ github.event.inputs.symbols }} ') || y.includes('SYMS:'), 'inputs reach the shell through env');
  const s = fs.readFileSync(path.join(ROOT, 'scripts/daily-cache.mjs'), 'utf8');
  assert.ok(s.includes('https://meridianx.dev/md/bars'));
});

test('daily cache: windows cover the range in ≤ 4999-day calls; merge keeps complete candles, newest wins, sorted', () => {
  const now = START + 12000 * DAY, w = windows(START, now);
  assert.equal(w[0][0], START); assert.equal(w[w.length - 1][1], now);
  for (let i = 0; i < w.length; i++) { assert.ok(w[i][1] - w[i][0] <= CAP * DAY); if (i) assert.equal(w[i][0], w[i - 1][1]); }
  const rows = merge([[100, 1, 2, 0.5, 1.5, 7], [200, 1, 1, 1, 1, 1]], [
    { time: 200, open: 2, high: 3, low: 1, close: 2.5, volume: 9 }, { time: 50, open: 1, high: 1, low: 1, close: 1 }, { time: 300, open: 1, high: 1, low: 1, close: 1, live: true },
  ]);
  assert.deepEqual(rows, [[50, 1, 1, 1, 1, 0], [100, 1, 2, 0.5, 1.5, 7], [200, 2, 3, 1, 2.5, 9]]);
});

test('daily cache: refresh writes the compact file, re-run merges, an unknown market is an index error not a crash', async () => {
  const calls = [];
  const srv = http.createServer((req, res) => {
    const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams); calls.push(q);
    res.setHeader('content-type', 'application/json');
    if (q.sym === 'cn50') { res.writeHead(502); return res.end(JSON.stringify({ error: 'OANDA 400: Invalid value specified for instrument' })); }
    if (q.tf !== 'D') { res.writeHead(400); return res.end(JSON.stringify({ error: 'unknown sym or tf' })); }
    const from = Math.max(+q.from, +q.to - CAP * DAY), bars = [];
    for (let t = Math.ceil(from / DAY) * DAY; t < +q.to; t += DAY) if (t >= START + 3000 * DAY && new Date(t * 1000).getUTCDay() % 6) bars.push({ time: t, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3, ...(t + DAY >= +q.to ? { live: true } : {}) });
    res.end(JSON.stringify({ src: 'OANDA', inst: 'X', tf: 'D', bars }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}/bars`, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-'));
  try {
    const now = START + 9000 * DAY;
    const e = await refresh(dir, 'uk100', base, now);
    assert.equal(e.status, 'ok'); assert.equal(e.inst, 'UK100_GBP'); assert.equal(e.group, 'index');
    const f = JSON.parse(fs.readFileSync(path.join(dir, 'uk100.json'), 'utf8'));
    assert.deepEqual(f.cols, COLS); assert.equal(f.tf, 'D'); assert.equal(f.sym, 'uk100'); assert.equal(f.inst, 'UK100_GBP');
    assert.equal(f.rows.length, e.rows); assert.ok(f.rows.length > 4000, 'full history, several windows'); assert.equal(f.rows[0][0], e.first);
    assert.ok(f.rows.every((r) => r.length === 6 && r.every((x) => typeof x === 'number')), 'compact numeric rows');
    assert.ok(f.rows.every((r, i) => !i || r[0] > f.rows[i - 1][0]), 'sorted, unique days');
    assert.ok(!f.rows.some((r) => r[0] >= now - DAY), 'the live candle is not stored');
    assert.ok(calls.filter((c) => c.sym === 'uk100').length >= 2);
    // re-run a week later: only one short call, rows merged
    const n0 = calls.length, e2 = await refresh(dir, 'uk100', base, now + 7 * DAY);
    assert.equal(calls.length - n0, 1); assert.ok(e2.rows > e.rows); assert.ok(+calls[n0].from >= e.last - 7 * DAY);
    const bad = await refresh(dir, 'cn50', base, now);
    assert.equal(bad.status, 'error'); assert.match(bad.error, /OANDA 400/); assert.ok(!fs.existsSync(path.join(dir, 'cn50.json')));
    // main() with a symbol list writes the index
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-root-'));
    const log = console.log; console.log = () => {};
    try { await main([root, 'xau', 'cn50', 'nothere'], base); } finally { console.log = log; }
    const idx = JSON.parse(fs.readFileSync(path.join(root, 'research/daily/_index.json'), 'utf8'));
    assert.deepEqual(Object.keys(idx.symbols), ['cn50', 'xau']); assert.equal(idx.symbols.xau.status, 'ok'); assert.equal(idx.symbols.cn50.status, 'error');
    assert.ok(fs.existsSync(path.join(root, 'research/daily/xau.json')));
  } finally { srv.close(); }
});
