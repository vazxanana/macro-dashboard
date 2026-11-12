// node --test tests/backtest-oanda.test.mjs — the replay reads gold from OANDA spot (a fake /md/bars proxy), not Kraken PAXG,
// and writes the adx / adxBand columns last. Offline: MD_BASE points at a local server; a 2-day window keeps it to seconds.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SCRIPT = new URL('../council/backtest.mjs', import.meta.url).pathname;
// a smooth, deterministic gold price with swings at several scales, so the engine finds structure
const px = (t) => 4000 + 60 * Math.sin(t / 400000) + 15 * Math.sin(t / 37000) + 4 * Math.sin(t / 5000) + 1.2 * Math.sin(t / 700);
const TF = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
function bars(tf, from, to) {
  const s = TF[tf], out = [];
  for (let t = Math.ceil(from / s) * s; t < to; t += s) {
    const o = px(t), c = px(t + s), m = px(t + s / 2);
    out.push({ time: t, open: o, high: Math.max(o, c, m) + 0.3, low: Math.min(o, c, m) - 0.3, close: c, volume: 1 });
  }
  return out;
}
function proxy(calls) {
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), q = Object.fromEntries(u.searchParams), now = Math.floor(Date.now() / 1000);
    calls.push(q);
    if (u.pathname !== '/bars' || !TF[q.tf]) { res.writeHead(404); return res.end('{}'); }
    const s = TF[q.tf], to = q.to ? +q.to : Math.floor(now / s) * s, from = q.from ? +q.from : to - (+q.n || 500) * s;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ src: 'OANDA', inst: 'XAU_USD', tf: q.tf, bars: bars(q.tf, from, to) }));
  });
}
const run = (dir, env) => new Promise((resolve, reject) => {
  // the replay's window is "the last 2 days from now": pin the child's clock (tests/fixtures/pin-now.mjs) so the synthetic
  // price always shows the same window, one with setups (8 Nov 2026: unpinned, the test failed at some hours of the day)
  const PIN = { PIN_NOW: '1794000000', NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import ${new URL('./fixtures/pin-now.mjs', import.meta.url).pathname}`.trim() };
  const p = spawn(process.execPath, [SCRIPT, dir, '2'], { env: { ...process.env, ...PIN, ...env } });
  let log = ''; p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
  p.on('close', (code) => (code === 0 ? resolve(log) : reject(new Error(`exit ${code}\n${log}`))));
});

test('gold replay: every timeframe from OANDA, no Kraken fallback, no PAXG shift; adx/adxBand columns last', { timeout: 120000 }, async () => {
  const calls = [], srv = proxy(calls);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-oanda-'));
  fs.writeFileSync(path.join(dir, 'config.json'), '{}');
  try {
    const log = await run(dir, { MD_BASE: `http://127.0.0.1:${srv.address().port}/`, BT_MARKETS: 'xau', DUKA_CACHE: '' });
    const bt = JSON.parse(fs.readFileSync(path.join(dir, 'backtest.json'), 'utf8')), mk = bt.markets;
    assert.equal(mk.source.xau, 'OANDA', log);
    assert.ok(!mk.fallback || !mk.fallback.xau, `no fallback: ${JSON.stringify(mk.fallback)}`);
    assert.deepEqual(mk.errors, {});
    assert.match(mk.goldShift.method, /^none: OANDA gold is spot/);
    assert.equal(mk.d1src.xau, 'OANDA');
    assert.ok(mk.xau.steps > 0, 'the replay stepped');
    // the loader paged 1m/1h/4h/1d by from/to, every call for xau
    for (const tf of ['1m', '1h', '4h', '1d']) assert.ok(calls.some((q) => q.tf === tf && q.from && q.to && q.sym === 'xau'), `paged ${tf}`);
    assert.ok(calls.filter((q) => q.tf === '1m').every((q) => +q.to - +q.from <= 4999 * 60), 'at most 4,999 1m candles a call');
    assert.deepEqual(bt.tradeCols.slice(-7), ['status', 'adx', 'adxBand', 'newsT1', 'newsMin', 'R_pt1', 'fin'], 'news research tag after adx/adxBand, then the paper exit R_pt1, then (11 Nov 2026) the overnight financing of the live exit');
    { const fi = bt.tradeCols.indexOf('fin'), si = bt.tradeCols.indexOf('status'); assert.ok(bt.trades.every((r) => r[si] === 'open' ? r[fi] === null : Number.isFinite(r[fi]) && r[fi] >= 0), 'fin: a number for every finished row, never negative'); assert.equal(bt.financing.of, 'R_none'); }
    { // R_pt1 (paper exit, half off at +1R): null while open, otherwise between -1 and the 10R cap (below -1 only through a stop gapped
      // past at the candle's open, which the first stop of R_none then shows too); the live columns are unaffected by it
      const pi = bt.tradeCols.indexOf('R_pt1'), si = bt.tradeCols.indexOf('status'), ni = bt.tradeCols.indexOf('R_none');
      for (const r of bt.trades) if (r[si] === 'open') assert.equal(r[pi], null); else if (r[pi] != null) assert.ok((r[pi] >= -1.01 || r[pi] === r[ni]) && r[pi] <= 10, `R_pt1 ${r[pi]}`);
      assert.ok(bt.overall.pt1 && bt.overall.none && bt.overall.none.n >= bt.overall.pt1.n, 'pt1 counts only finished paper exits'); }
    assert.equal(bt.tradeCols.indexOf('adxBand'), 22, 'adx / adxBand indexes hold');
    { const ni = bt.tradeCols.indexOf('newsT1'); for (const r of bt.trades) assert.ok(r[ni] === null || ['CPI', 'NFP', 'FOMC', 'PCE'].includes(r[ni]), 'newsT1 is a tier-1 release or null'); }
    assert.equal(bt.tradeCols.indexOf('status'), 20, 'older column indexes hold');
    for (const r of bt.trades) assert.equal(r.length, bt.tradeCols.length);
    const ai = bt.tradeCols.indexOf('adx'), bi = bt.tradeCols.indexOf('adxBand');
    for (const r of bt.trades) {
      if (!String(r[1]).startsWith('swing')) assert.equal(r[ai], null, 'adx is a Swing-only tag');
      else if (r[ai] != null) assert.equal(typeof r[bi], 'boolean');
    }
    assert.ok(bt.trades.length > 0, log);
  } finally { srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
