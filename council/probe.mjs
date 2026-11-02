// Probe data sources from GitHub's runners: Pyth (the trader's TradingView feed) and Tiingo FX.
const T = (s) => Date.parse(s) / 1000;
async function get(url, n = 400) { try { const r = await fetch(url); const t = await r.text(); return `${r.status} ${t.slice(0, n).replace(/\s+/g, ' ')}`; } catch (e) { return 'ERR ' + e.message; } }
for (const sym of ['Metal.XAU/USD', 'Metal.XAUUSD', 'FX.EUR/USD']) for (const res of ['1', '30', '60', 'D', '1D']) {
  const from = res.includes('D') ? T('2026-09-01T00:00Z') : T('2026-11-02T14:00Z'), to = T('2026-11-02T15:30Z');
  console.log(`PYTH ${sym} ${res}:`, await get(`https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=${encodeURIComponent(sym)}&resolution=${res}&from=${from}&to=${to}`, 300));
}
console.log('PYTH 1m depth (5 Oct):', await get(`https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=Metal.XAU%2FUSD&resolution=1&from=${T('2026-10-05T10:00Z')}&to=${T('2026-10-05T10:05Z')}`, 300));
console.log('PYTH 1m depth (1 Aug):', await get(`https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=Metal.XAU%2FUSD&resolution=1&from=${T('2026-08-01T10:00Z')}&to=${T('2026-08-01T10:05Z')}`, 300));
console.log('TIINGO api xauusd (no key):', await get('https://api.tiingo.com/tiingo/fx/xauusd/prices?resampleFreq=1min&startDate=2026-11-02', 300));
const page = await get('https://www.tiingo.com/products/forex-api', 200000);
console.log('TIINGO page status:', page.slice(0, 4));
const txt = page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
for (const k of ['XAU', 'gold', 'Gold', 'metal', 'minute', 'history', 'historical', 'tick', 'top-of-book', 'Top-of-Book', 'websocket', 'Power', '$', 'per month', 'limit']) {
  let i = txt.indexOf(k), c = 0; while (i >= 0 && c < 3) { console.log(`  [${k}] …${txt.slice(Math.max(0, i - 120), i + 160)}…`); i = txt.indexOf(k, i + 200); c++; }
}
