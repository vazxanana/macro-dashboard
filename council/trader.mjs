// Council · Trader (+ daily statistical Coach)
// Runs every 15 minutes in GitHub Actions: pulls candles for every market, runs the Mosha rules,
// paper-trades every Ready setup, manages open trades and writes everything to the data folder.
// Usage: node council/trader.mjs <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from './engine.mjs';

const DIR = process.argv[2] || 'data';
fs.mkdirSync(DIR, { recursive: true });
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return d; } };
const wr = (f, v) => fs.writeFileSync(path.join(DIR, f), JSON.stringify(v, null, 1));

const MARKETS = {
  xau:    { label: 'XAU/USD', name: 'Gold',     group: 'Metals', kraken: 'PAXGUSD', dec: 1, spot: true },
  btc:    { label: 'BTC/USD', name: 'Bitcoin',  group: 'Crypto', kraken: 'XBTUSD',  dec: 1 },
  eth:    { label: 'ETH/USD', name: 'Ethereum', group: 'Crypto', kraken: 'ETHUSD',  dec: 2 },
  sol:    { label: 'SOL/USD', name: 'Solana',   group: 'Crypto', kraken: 'SOLUSD',  dec: 2 },
  xrp:    { label: 'XRP/USD', name: 'XRP',      group: 'Crypto', kraken: 'XRPUSD',  dec: 4 },
  eurusd: { label: 'EUR/USD', name: 'Euro',     group: 'Forex',  kraken: 'EURUSD',  dec: 5 },
  gbpusd: { label: 'GBP/USD', name: 'Pound',    group: 'Forex',  kraken: 'GBPUSD',  dec: 5 },
  audusd: { label: 'AUD/USD', name: 'Aussie',   group: 'Forex',  kraken: 'AUDUSD',  dec: 5 },
  usdcad: { label: 'USD/CAD', name: 'Loonie',   group: 'Forex',  kraken: 'USDCAD',  dec: 5 },
  usdchf: { label: 'USD/CHF', name: 'Swissy',   group: 'Forex',  kraken: 'USDCHF',  dec: 5 },
};
const TFS = [['1d', 1440, 86400], ['4h', 240, 14400], ['1h', 60, 3600], ['15m', 15, 900], ['5m', 5, 300], ['1m', 1, 60]];
// How long an unfilled order waits, by the higher timeframe of its pair
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '15m': 3 * 3600 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function kraken(pair, interval) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}`);
      const j = await r.json();
      if (j.error && j.error.length) { if (/too many|rate/i.test(j.error[0])) { await sleep(2500 * (a + 1)); continue; } throw new Error(j.error[0]); }
      const key = Object.keys(j.result).find((k) => k !== 'last');
      return j.result[key].map((k) => ({ time: +k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
    } catch (e) { if (a === 3) throw e; await sleep(1500); }
  }
}

// ─── Config: the Coach's knobs, with their allowed ranges ───
const LIMITS = { buf: [0.10, 0.25], minRR: [1.2, 2.5] };
const config = Object.assign({ buf: 0.15, minRR: 1.2, paused: {}, history: [] }, rd('config.json', {}));
const now = Math.floor(Date.now() / 1000), nowISO = new Date(now * 1000).toISOString();
for (const [k, until] of Object.entries(config.paused)) if (Date.parse(until) / 1000 <= now) { delete config.paused[k]; config.history.push({ at: nowISO, by: 'coach-stats', change: `Resumed ${k}`, why: 'Pause period ended.' }); }
CFG.buf = Math.min(LIMITS.buf[1], Math.max(LIMITS.buf[0], config.buf));
const state = Object.assign({ seen: {}, lastRun: 0 }, rd('state.json', {}));
let trades = rd('trades.json', []);
const snapshot = { at: nowISO, markets: {}, errors: {} };

let spot = null;
try { const j = await (await fetch('https://api.gold-api.com/price/XAU')).json(); spot = +j.price || null; } catch (e) {}

const BUILDERS = PAIRS.map((p) => [p, buildSetup]).concat(RETR.map((p) => [p, buildRetrace]));
for (const [key, M] of Object.entries(MARKETS)) {
  try {
    const src = {};
    for (const [id, iv] of TFS) {
      const bars = await kraken(M.kraken, iv);
      await sleep(1100);
      src[id] = { bars };
    }
    let off = 0;
    if (M.spot && spot) { const o = spot - src['1m'].bars.at(-1).close; if (Math.abs(o) < 150) off = o; }
    for (const id of Object.keys(src)) {
      src[id].bars = src[id].bars.map((b) => ({ time: b.time, open: b.open + off, high: b.high + off, low: b.low + off, close: b.close + off }));
      src[id].A = msAnalyze(src[id].bars, 6);
    }
    const price = src['1m'].bars.at(-1).close;
    setMarket(M);
    const setups = BUILDERS.map(([pr, fn]) => { try { return fn(pr, price, src); } catch (e) { return null; } }).filter(Boolean);
    snapshot.markets[key] = {
      label: M.label, name: M.name, price, dec: M.dec,
      trend: Object.fromEntries(['1d', '4h', '1h'].map((k) => [k, src[k].A.trend])),
      setups: setups.map((t) => ({ k: t.k, name: t.name, pair: t.pair, side: t.sell ? 'sell' : 'buy', state: t.state, entry: t.entry, stop: t.stop, t1: t.t1, rr: +t.rr.toFixed(2), next: t.next, retrace: !!t.retrace })),
    };

    // ─── Manage open trades on this market with the candles since the last check ───
    for (const tr of trades.filter((x) => x.market === key && (x.status === 'pending' || x.status === 'open'))) {
      const bars = (src['1m'].bars[0].time <= tr.checked ? src['1m'] : src['5m'].bars[0].time <= tr.checked ? src['5m'] : src['15m']).bars;
      const s = tr.side === 'sell';
      for (const b of bars) {
        if (b.time < tr.checked) continue;
        if (tr.status === 'pending') {
          if (s ? b.high >= tr.entry : b.low <= tr.entry) { tr.status = 'open'; tr.filled = b.time; }
          else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; break; }
          else continue;
        }
        if (s ? b.high >= tr.stop : b.low <= tr.stop) { tr.status = 'loss'; tr.closed = b.time; tr.R = -1; break; }
        if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'win'; tr.closed = b.time; tr.R = tr.rr; break; }
      }
      tr.checked = bars.at(-1).time;
      if (tr.status === 'pending' && now - tr.opened > (WAIT[tr.h] || 86400)) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
    }

    // ─── Take new Ready setups ───
    for (const t of setups) {
      if (t.state !== 'READY' || state.seen[t.sig]) continue;
      state.seen[t.sig] = now;
      const skip = config.paused[t.k] ? `paused until ${config.paused[t.k].slice(0, 10)}` : t.rr < config.minRR ? `reward:risk ${t.rr.toFixed(2)} under ${config.minRR}` : null;
      const h = (PAIRS.concat(RETR)).find((p) => p.k === t.k).h;
      const tr = { id: `${key}-${t.k}-${now}`, market: key, label: M.label, dec: M.dec, k: t.k, name: t.name, pair: t.pair, h, side: t.sell ? 'sell' : 'buy',
        entry: t.entry, stop: t.stop, t1: t.t1, rr: +t.rr.toFixed(2), buf: CFG.buf, opened: now, checked: now, status: skip ? 'skipped' : 'pending', R: null, note: skip || t.next };
      if (!skip && (t.sell ? price >= t.entry : price <= t.entry)) { tr.status = 'open'; tr.filled = now; }
      trades.push(tr);
    }
  } catch (e) { snapshot.errors[key] = String(e.message || e); }
}

// forget signatures older than 30 days, keep the last 3000 trades
for (const [sig, t] of Object.entries(state.seen)) if (now - t > 30 * 86400) delete state.seen[sig];
trades = trades.slice(-3000);
state.lastRun = now;

// ─── Daily statistical Coach: small, bounded rule changes from the results ───
const coach = rd('coach.json', { date: '' });
const today = nowISO.slice(0, 10);
if (coach.date !== today) {
  const closed = trades.filter((x) => (x.status === 'win' || x.status === 'loss') && now - x.closed < 30 * 86400);
  const stat = (arr) => { const w = arr.filter((x) => x.status === 'win').length; const R = arr.reduce((a, x) => a + x.R, 0); return { n: arr.length, w, wr: arr.length ? w / arr.length : null, R: +R.toFixed(2), exp: arr.length ? +(R / arr.length).toFixed(2) : null }; };
  const bySetup = {};
  for (const t of closed) (bySetup[t.k] = bySetup[t.k] || []).push(t);
  const stats = Object.fromEntries(Object.entries(bySetup).map(([k, arr]) => [k, stat(arr)]));
  const notes = [];
  const change = (what, why) => { config.history.push({ at: nowISO, by: 'coach-stats', change: what, why }); notes.push(`${what}: ${why}`); };
  for (const [k, arr] of Object.entries(bySetup)) {
    const st = stats[k], last4 = arr.slice(-4);
    if (config.paused[k]) continue;
    if ((st.n >= 6 && st.exp < -0.25) || (last4.length === 4 && last4.every((x) => x.status === 'loss'))) {
      config.paused[k] = new Date((now + 3 * 86400) * 1000).toISOString();
      change(`Paused ${k} for 3 days`, st.n >= 6 && st.exp < -0.25 ? `Expectancy ${st.exp}R over ${st.n} trades.` : 'Four losses in a row.');
    }
  }
  const recent = closed.filter((x) => now - x.closed < 14 * 86400), rs = stat(recent);
  if (rs.n >= 10) {
    if (rs.wr < 0.35 && config.buf < LIMITS.buf[1]) { const v = +Math.min(LIMITS.buf[1], config.buf + 0.02).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Win rate ${Math.round(rs.wr * 100)}% over ${rs.n} trades: stops may sit inside the noise.`); config.buf = v; }
    else if (rs.wr > 0.6 && config.buf > LIMITS.buf[0]) { const v = +Math.max(LIMITS.buf[0], config.buf - 0.01).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Win rate ${Math.round(rs.wr * 100)}% over ${rs.n} trades: a tighter stop gives more R.`); config.buf = v; }
  }
  const low = recent.filter((x) => x.rr < 1.5), ls = stat(low);
  if (ls.n >= 6 && ls.exp < 0 && config.minRR < 1.5) { change(`Minimum reward:risk ${config.minRR} → 1.5`, `Trades under 1.5R returned ${ls.exp}R each over ${ls.n} trades.`); config.minRR = 1.5; }
  wr('coach.json', { date: today, at: nowISO, stats, last14: rs, notes: notes.length ? notes : ['No change today: not enough evidence to move a rule.'] });
}
config.history = config.history.slice(-200);

wr('config.json', config);
wr('state.json', state);
wr('trades.json', trades);
wr('snapshot.json', snapshot);
const open = trades.filter((x) => x.status === 'open' || x.status === 'pending').length;
console.log(`Council run ${nowISO}: ${Object.keys(snapshot.markets).length} markets, ${Object.keys(snapshot.errors).length} errors, ${open} open/pending trades, ${trades.length} total.`);
if (Object.keys(snapshot.errors).length) console.log(snapshot.errors);
