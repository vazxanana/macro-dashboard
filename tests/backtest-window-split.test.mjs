// ChronosTrade's candle windows (backtest.html fetchBars, 15 Nov 2026): a window the server refuses with a 5xx is asked again
// in halves (down to 500 candles), so a host with a small CPU budget (the Cloudflare free plan) can still serve a long session;
// a window that loads is fetched exactly as before. The function is lifted from the page's text and run on a fake server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../backtest.html', import.meta.url), 'utf8');
const start = html.indexOf('  async function fetchBars(');
const end = html.indexOf('\n    return out;\n  }', start) + '\n    return out;\n  }'.length;
const src = html.slice(start, end);
function make(maxCandles, calls) {
  const TFS = { '5m': 300 }, BASE = 'https://x/md/bars';
  const fetch = async (u) => {
    const q = new URL(u).searchParams, a = +q.get('from'), b = +q.get('to'), n = (b - a) / 300; calls.push(n);
    if (n > maxCandles) return { ok: false, status: 503, json: async () => ({ error: 'cpu' }) };
    const bars = []; for (let t = a; t < b; t += 300) bars.push({ time: t, open: 1, high: 1, low: 1, close: 1 });
    return { ok: true, status: 200, json: async () => ({ bars }) };
  };
  return new Function('TFS', 'BASE', 'fetch', `${src}; return fetchBars;`)(TFS, BASE, fetch);
}
test('a refused window is split in halves; the candles are the same, in order, once each', async () => {
  const from = 1.7e9, to = from + 12000 * 300;
  const callsOk = [], ok = await make(1e9, callsOk)('xau', '5m', from, to);
  const callsCut = [], cut = await make(1300, callsCut)('xau', '5m', from, to);
  assert.equal(callsOk.length, 3, 'no refusal: one call a window, as before');
  assert.deepEqual(cut.map((x) => x.time), ok.map((x) => x.time));
  assert.equal(ok.length, 12000);
  assert.ok(callsCut.some((n) => n > 1300) && callsCut.filter((n) => n <= 1300).length >= 8);
});
test('a 4xx or a window already small is not split: the error is shown as before', async () => {
  await assert.rejects(make(400, [])('xau', '5m', 1.7e9, 1.7e9 + 4999 * 300), /cpu/);   // stops splitting at 1,000 candles
  const TFS = { '5m': 300 }, calls = [];
  const f = new Function('TFS', 'BASE', 'fetch', `${src}; return fetchBars;`)(TFS, 'https://x/md/bars', async (u) => { calls.push(u); return { ok: false, status: 400, json: async () => ({ error: 'bad range' }) }; });
  await assert.rejects(f('xau', '5m', 1.7e9, 1.7e9 + 4999 * 300), /bad range/);
  assert.equal(calls.length, 1);
});
