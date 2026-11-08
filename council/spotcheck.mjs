// Council · spot check (reporting only): re-judges the live Trader's closed Kraken-era gold/forex paper trades on OANDA spot candles.
// Until 7 Nov 16:01 UTC the live Trader managed gold and forex trades on Kraken candles; Kraken's forex books are thin, so a lone print can reach
// a target (or a stop) that spot never touched. For each closed trade the same entry, stop and target are walked through
// OANDA 5-minute candles (meridianx.dev/md, the feed the site's charts use): stop first inside a candle, as the Trader does.
// Writes research/spotcheck.json. Changes no rule or trade.
//   node council/spotcheck.mjs <dataDir> [tradesFile]
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2] || 'data', TRADES = process.argv[3] || path.join(DIR, 'trades.json');
const MD = process.env.MD_BASE || 'https://meridianx.dev/md/';
const MARKETS = ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'];

// one trade on spot candles: 'win' | 'loss' | 'open' (neither level reached in the candles we have)
export function judge(t, bars) {
  const s = t.side === 'sell', r0 = t.r0 || Math.abs(t.entry - t.stop);
  const stop = t.beMoved ? (s ? t.entry + r0 : t.entry - r0) : t.stop;   // judge the original risk: break-even moves are live-only
  for (const b of bars) {
    if (b.time + 300 <= t.filled) continue;
    if (s ? b.high >= stop : b.low <= stop) return 'loss';
    if (s ? b.low <= t.t1 : b.high >= t.t1) return 'win';
  }
  return 'open';
}
// trades a fixed stop/target walk can judge: plain closed win/loss, not trailing systems or add-on units.
// Feed (8 Nov): the live Trader has managed gold and forex on OANDA candles since 7 Nov 16:01 UTC, and every record since then
// carries feed 'oanda'; a trade managed on OANDA walked through OANDA candles again is the same feed judging itself, so only
// the Kraken-era trades (feed 'kraken', or no feed tag: written before the tag existed) are judged. The rest are counted.
export const krakenEra = (t) => !t.feed || t.feed === 'kraken';
export const judgeable = (t) => (t.status === 'win' || t.status === 'loss') && t.filled && !t.addOf && !(t.rr >= 50) && t.t1 != null && t.stop != null;

export function summarize(trades, barsBy) {
  const out = {};
  for (const m of Object.keys(barsBy)) {
    const bars = barsBy[m]; if (!bars || !bars.length) continue;
    const from = bars[0].time + 600, inWin = trades.filter((t) => t.market === m && judgeable(t) && t.filled >= from && t.closed <= bars.at(-1).time + 300);
    const T = inWin.filter(krakenEra);
    const c = { n: 0, sameFeed: inWin.length - T.length, same: 0, liveWinSpotLoss: 0, liveWinSpotNever: 0, liveLossSpotWin: 0, liveLossSpotNever: 0, liveR: 0, spotR: 0, liveOnly: { n: 0, liveR: 0, spotR: 0 }, examples: [] };
    for (const t of T) {
      const o = judge(t, bars), sR = o === 'win' ? t.rr : o === 'loss' ? -1 : 0, lR = t.status === 'win' ? t.rr : -1;
      c.n++; c.liveR += lR; c.spotR += sR;
      if (!t.shadow) { c.liveOnly.n++; c.liveOnly.liveR += lR; c.liveOnly.spotR += sR; }
      if (o === t.status) c.same++;
      else { const k = t.status === 'win' ? (o === 'loss' ? 'liveWinSpotLoss' : 'liveWinSpotNever') : (o === 'win' ? 'liveLossSpotWin' : 'liveLossSpotNever'); c[k]++;
        if (c.examples.length < 5) c.examples.push({ id: t.id, side: t.side, entry: t.entry, stop: t.stop, t1: t.t1, live: t.status, spot: o }); }
    }
    for (const o of [c, c.liveOnly]) { o.liveR = +o.liveR.toFixed(2); o.spotR = +o.spotR.toFixed(2); }
    c.from = new Date(from * 1000).toISOString();
    out[m] = c;
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('spotcheck.mjs')) {
  const raw = JSON.parse(fs.readFileSync(TRADES, 'utf8')), trades = Array.isArray(raw) ? raw : raw.trades || [];
  const barsBy = {}, errors = {};
  for (const m of MARKETS) {
    try { const r = await fetch(`${MD}bars?sym=${m}&tf=5m&n=2500`, { signal: AbortSignal.timeout(20000) }); const j = r.ok ? await r.json() : null;
      if (!j || j.src !== 'OANDA' || !Array.isArray(j.bars)) throw new Error(j && j.error ? j.error : `HTTP ${r.status}`);
      barsBy[m] = j.bars.map((b) => ({ time: b.time, high: +b.high, low: +b.low })); }
    catch (e) { errors[m] = String(e.message || e).slice(0, 120); }
  }
  const markets = summarize(trades, barsBy), fx = Object.entries(markets).filter(([m]) => m !== 'xau').map(([, c]) => c);
  const out = { at: new Date().toISOString(), source: 'OANDA spot 5m (meridianx.dev/md) vs the live Trader\'s Kraken-era trades (feed kraken or untagged; trades managed on OANDA since 7 Nov 16:01 UTC are counted as sameFeed, not judged)',
    note: 'Same entry/stop/target walked through spot candles, stop first inside a candle; break-even moves ignored. 5m candles cannot order a stop and target inside one candle.',
    markets, forex: { n: fx.reduce((a, c) => a + c.n, 0), liveR: +fx.reduce((a, c) => a + c.liveR, 0).toFixed(2), spotR: +fx.reduce((a, c) => a + c.spotR, 0).toFixed(2) }, errors };
  fs.mkdirSync(path.join(DIR, 'research'), { recursive: true });
  fs.writeFileSync(path.join(DIR, 'research', 'spotcheck.json'), JSON.stringify(out, null, 1));
  for (const [m, c] of Object.entries(markets)) console.log(`${m.padEnd(7)} n${c.n} same ${c.same} | live ${c.liveR}R vs spot ${c.spotR}R | live win→spot loss ${c.liveWinSpotLoss}, never ${c.liveWinSpotNever}; live loss→spot win ${c.liveLossSpotWin}`);
  console.log(`forex: live ${out.forex.liveR}R vs spot ${out.forex.spotR}R over ${out.forex.n} trades`, Object.keys(errors).length ? errors : '');
}
