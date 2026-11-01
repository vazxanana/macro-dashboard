// Council · Trader (+ daily statistical Coach)
// Runs every ~4 minutes in GitHub Actions: pulls candles for every market, runs the Mosha rules,
// paper-trades every Ready setup, manages open trades and writes everything to the data folder.
// Usage: node council/trader.mjs <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from './engine.mjs';
import { entryContext, startReview, watchReview, newsNear, lessons } from './review.mjs';

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
// Only fresh signals: the CF break must be at most this many lower-timeframe candles old
const FRESH = 12;
const MAX_OPEN = 2;   // live trades per market
const SEC = Object.fromEntries(TFS.map(([id, , s]) => [id, s]));

// Trading session by UTC hour (rough, ignores daylight saving)
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
// Spot gold and forex close for the weekend (Fri 21:00 – Sun 22:00 UTC); crypto never closes.
// PAXG keeps trading 24/7, but those candles aren't the gold market, so no new gold/forex trades then,
// nor in the first hour after the Sunday reopen.
const marketOpen = (M, t) => { if (M.group === 'Crypto') return true; const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours();
  return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };   // Sunday 22:00–23:00 too: the reopen gaps and spreads are wide
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
const LIMITS = { buf: [0.10, 0.25], minRR: [1.2, 2.5], minRisk: [0.4, 1.2] };
const config = Object.assign({ buf: 0.15, minRR: 1.2, minRisk: 0.6, be: null, fresh: FRESH, newsGuard: false, paused: {}, pausedMarkets: {}, filters: {}, history: [] }, rd('config.json', {}));
config.filters = config.filters || {};
const now = Math.floor(Date.now() / 1000), nowISO = new Date(now * 1000).toISOString();
config.pausedMarkets = config.pausedMarkets || {};
for (const [k, until] of Object.entries(config.pausedMarkets)) if (Date.parse(until) / 1000 <= now) { delete config.pausedMarkets[k]; config.history.push({ at: nowISO, by: 'coach-stats', change: `Resumed market ${k}`, why: 'Pause period ended.' }); }
for (const [k, until] of Object.entries(config.paused)) if (Date.parse(until) / 1000 <= now) { delete config.paused[k]; config.history.push({ at: nowISO, by: 'coach-stats', change: `Resumed ${k}`, why: 'Pause period ended.' }); }
CFG.buf = Math.min(LIMITS.buf[1], Math.max(LIMITS.buf[0], config.buf));
CFG.minRisk = Math.min(LIMITS.minRisk[1], Math.max(LIMITS.minRisk[0], config.minRisk));
const state = Object.assign({ seen: {}, lastRun: 0 }, rd('state.json', {}));
let trades = rd('trades.json', []);
const snapshot = { at: nowISO, markets: {}, errors: {} };

// This week's economic calendar (high-impact news), refreshed every 6 hours: the review checks every loss against it
if (!state.news || now - (state.news.at || 0) > 6 * 3600) {
  try { const j = await (await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json')).json(); if (Array.isArray(j)) state.news = { at: now, data: j.filter((e) => e.impact === 'High').map((e) => ({ title: e.title, country: e.country, date: e.date, impact: e.impact })) }; } catch (e) {}
}
const NEWS = (state.news && state.news.data) || [];

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
      let exitBar = null;
      for (const b of bars) {
        if (b.time < tr.checked) continue;
        if (tr.status === 'pending') {
          if (s ? b.high >= tr.entry : b.low <= tr.entry) { tr.status = 'open'; tr.filled = b.time; }
          else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; break; }
          else continue;
        }
        const r0 = tr.r0 || (tr.r0 = Math.abs(tr.entry - tr.stop));
        if (s ? b.high >= tr.stop : b.low <= tr.stop) {
          if (tr.beMoved) { tr.status = 'be'; tr.R = 0; } else { tr.status = 'loss'; tr.R = -1; }
          tr.closed = b.time; exitBar = b; break;
        }
        if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'win'; tr.closed = b.time; tr.R = tr.rr; exitBar = b; break; }
        // how far the trade went for (MFE) and against (MAE), in R: the Coach learns trade management from these
        tr.mfe = +Math.max(tr.mfe || 0, ((s ? tr.entry - b.low : b.high - tr.entry) / r0)).toFixed(2);
        tr.mae = +Math.max(tr.mae || 0, ((s ? b.high - tr.entry : tr.entry - b.low) / r0)).toFixed(2);
        // break-even rule from the Coach: once the trade is config.be R in profit, the stop moves to the entry
        if (config.be && !tr.beMoved && tr.mfe >= config.be) { tr.stop = tr.entry; tr.beMoved = true; }
      }
      tr.checked = bars.at(-1).time;
      if (exitBar) startReview(tr, exitBar, key, NEWS);
      if (tr.status === 'pending' && now - tr.opened > (WAIT[tr.h] || 86400)) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
    }

    // ─── Review closed trades: keep watching price after the exit, then give a verdict (system error or market) ───
    for (const tr of trades.filter((x) => x.market === key && (x.status === 'win' || x.status === 'loss' || x.status === 'be') && (!x.pm || x.pm.phase === 'watch'))) {
      if (!tr.pm) { if (now - tr.closed > 7 * 86400) continue; startReview(tr, null, key, NEWS); }   // trades closed before reviews existed
      const bars = (src['1m'].bars[0].time <= tr.pm.checked ? src['1m'] : src['5m'].bars[0].time <= tr.pm.checked ? src['5m'] : src['15m']).bars;
      watchReview(tr, bars);
    }

    // ─── Take new Ready setups ───
    snapshot.markets[key].open = marketOpen(M, now);
    for (const t of (marketOpen(M, now) ? setups : [])) {
      if (t.state !== 'READY' || state.seen[t.sig]) continue;
      state.seen[t.sig] = now;
      const def = PAIRS.concat(RETR).find((p) => p.k === t.k), cfT = +String(t.sig).split('|')[2];
      if (!cfT || now - cfT > (config.fresh || FRESH) * SEC[def.l]) continue;   // an old CF: the move already happened
      // Conditions at the signal: the Coach learns which of them win
      const feat = { d1: src['1d'].A.trend === (t.sell ? -1 : 1) ? 'with' : 'against', struct: t.retr == null ? 'n/a' : t.retr >= 0.5 ? 'main' : 'internal', session: sessionOf(now) };
      // Rules from the Coach. A blocked setup is still followed as a SHADOW trade (no score), so the Coach can check the rule was right
      const f = config.filters[t.k] || {}, blockedBy = [];
      if (config.paused[t.k]) blockedBy.push('paused');
      if (config.pausedMarkets[key]) blockedBy.push('market');
      // a market fill changes the reward:risk, so judge the rule on the price we would really get
      const mkt = t.sell ? price >= t.entry : price <= t.entry;
      const rrNow = mkt ? (t.t1 - price) * (t.sell ? -1 : 1) / Math.abs(price - t.stop) : t.rr;
      if (!(rrNow >= config.minRR)) blockedBy.push('minRR');
      // news guard (the Coach turns it on when news keeps stopping trades out): no short-term trade from 15 min before to 45 min after high-impact news
      if (config.newsGuard && (def.h === '15m' || def.h === '1h') && newsNear(key, M.label, NEWS, now - 15 * 60, now + 45 * 60).length) blockedBy.push('news');
      if (f.d1 && feat.d1 !== f.d1) blockedBy.push('d1');
      if (f.struct && feat.struct !== 'n/a' && feat.struct !== f.struct) blockedBy.push('struct');
      if (f.noSession && f.noSession.includes(feat.session)) blockedBy.push('session');
      // exposure: at most MAX_OPEN live trades per market, and never long and short the same market at once
      const live = trades.filter((x) => x.market === key && !x.shadow && (x.status === 'open' || x.status === 'pending'));
      if (live.length >= MAX_OPEN || live.some((x) => x.side !== (t.sell ? 'sell' : 'buy'))) blockedBy.push('exposure');
      // the same idea twice (another setup with the same stop and target, e.g. intraday and scalp sharing one M5 structure) doubles the risk: take it once
      const tick = Math.abs(t.entry) * 1e-5;
      if (live.some((x) => Math.abs(x.stop - t.stop) <= tick && Math.abs(x.t1 - t.t1) <= tick)) blockedBy.push('duplicate');
      const shadow = blockedBy.length > 0;
      const why = { paused: `paused until ${String(config.paused[t.k]).slice(0, 10)}`, minRR: `reward:risk ${(isFinite(rrNow) ? rrNow : 0).toFixed(2)} under ${config.minRR}`, d1: `rule: only ${f.d1} D1`, struct: `rule: only ${f.struct} structure`, session: `rule: not in ${feat.session}`, exposure: 'already 2 trades or an opposite trade open on this market', news: 'high-impact news within the hour', duplicate: 'same stop and target as a trade already open', market: `market paused until ${String(config.pausedMarkets[key]).slice(0, 10)}` };
      const h = def.h;
      const tr = { id: `${key}-${t.k}-${now}`, market: key, label: M.label, dec: M.dec, k: t.k, name: t.name, pair: t.pair, h, side: t.sell ? 'sell' : 'buy',
        entry: t.entry, stop: t.stop, t1: t.t1, rr: +t.rr.toFixed(2), buf: CFG.buf, opened: now, checked: now, status: 'pending', R: null, feat,
        shadow, blockedBy, note: shadow ? `Shadow (${blockedBy.map((b) => why[b]).join(', ')})` : t.next };
      try { tr.ctx = entryContext(t, src, def, M, price); } catch (e) {}
      if (mkt) {
        // price is already through the entry: fill at the market price, never at a better level than was available
        tr.entry = price; tr.status = 'open'; tr.filled = now;
        const r = Math.abs(tr.entry - tr.stop), rw = (tr.t1 - tr.entry) * (t.sell ? -1 : 1);
        if (!(r > 0) || (t.sell ? price >= tr.stop : price <= tr.stop) || rw <= 0) { tr.status = 'skipped'; tr.note = 'Price already past the stop or target when the signal came in.'; }
        else tr.rr = +(rw / r).toFixed(2);
      }
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
  const closedAll = trades.filter((x) => (x.status === 'win' || x.status === 'loss' || x.status === 'be') && now - x.closed < 30 * 86400);
  const closed = closedAll.filter((x) => !x.shadow), shadows = closedAll.filter((x) => x.shadow);
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
    if (rs.wr < 0.35 && config.minRisk < LIMITS.minRisk[1]) { const v = +Math.min(LIMITS.minRisk[1], config.minRisk + 0.1).toFixed(2); change(`Minimum stop ${config.minRisk} → ${v} ATR`, `Win rate ${Math.round(rs.wr * 100)}% over ${rs.n} trades: stops get hit by normal candle noise.`); config.minRisk = v; }
    else if (rs.wr < 0.35 && config.buf < LIMITS.buf[1]) { const v = +Math.min(LIMITS.buf[1], config.buf + 0.02).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Win rate ${Math.round(rs.wr * 100)}% over ${rs.n} trades: stops may sit inside the noise.`); config.buf = v; }
    else if (rs.wr > 0.6 && config.buf > LIMITS.buf[0]) { const v = +Math.max(LIMITS.buf[0], config.buf - 0.01).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Win rate ${Math.round(rs.wr * 100)}% over ${rs.n} trades: a tighter stop gives more R.`); config.buf = v; }
  }
  const low = recent.filter((x) => x.rr < 1.5), ls = stat(low);
  if (ls.n >= 6 && ls.exp < 0 && config.minRR < 1.5) { change(`Minimum reward:risk ${config.minRR} → 1.5`, `Trades under 1.5R returned ${ls.exp}R each over ${ls.n} trades.`); config.minRR = 1.5; }
  // ─── Self-evolution: learn filters from the conditions that lose, and drop them when shadow trades prove them wrong ───
  const exp = (arr) => arr.length ? arr.reduce((a, x) => a + x.R, 0) / arr.length : 0;
  for (const [k, arr] of Object.entries(bySetup)) {
    if (arr.length < 8) continue;
    const fl = config.filters[k] = config.filters[k] || {};
    for (const fe of ['d1', 'struct']) {
      if (fl[fe]) continue;
      const g = {}; arr.forEach((x) => { const v = x.feat && x.feat[fe]; if (v && v !== 'n/a') (g[v] = g[v] || []).push(x); });
      const vals = Object.entries(g).map(([v, a]) => ({ v, n: a.length, e: exp(a) }));
      const bad = vals.find((x) => x.n >= 5 && x.e < -0.2), good = vals.find((x) => x.n >= 3 && x.e > 0.1);
      if (bad && good) { fl[fe] = good.v; (fl.since = fl.since || {})[fe] = nowISO; change(`${k}: only ${good.v} ${fe === 'd1' ? 'D1' : 'structure'}`, `${bad.v}: ${bad.e.toFixed(2)}R over ${bad.n} trades; ${good.v}: +${good.e.toFixed(2)}R over ${good.n}.`); }
    }
    const gs = {}; arr.forEach((x) => { const v = x.feat && x.feat.session; if (v) (gs[v] = gs[v] || []).push(x); });
    for (const [v, a] of Object.entries(gs)) {
      if ((fl.noSession || []).includes(v) || a.length < 5 || exp(a) >= -0.2) continue;
      const rest = arr.filter((x) => !(x.feat && x.feat.session === v));
      if (rest.length >= 3 && exp(rest) > 0) { fl.noSession = (fl.noSession || []).concat(v); (fl.since = fl.since || {})['session:' + v] = nowISO; change(`${k}: skip the ${v} session`, `${exp(a).toFixed(2)}R over ${a.length} trades there; +${exp(rest).toFixed(2)}R elsewhere.`); }
    }
  }
  // drop a rule when the trades it blocked would have paid (shadow expectancy > +0.2R over 5+), or after 21 days to re-test it
  for (const [k, fl] of Object.entries(config.filters)) {
    for (const fe of ['d1', 'struct']) {
      if (!fl[fe]) continue;
      const sh = shadows.filter((x) => x.k === k && (x.blockedBy || []).includes(fe));
      const old = fl.since && fl.since[fe] && now - Date.parse(fl.since[fe]) / 1000 > 21 * 86400;
      if ((sh.length >= 5 && exp(sh) > 0.2) || old) { change(`${k}: dropped the ${fe === 'd1' ? 'D1' : 'structure'} rule`, old ? '21 days old: re-testing without it.' : `The trades it blocked made +${exp(sh).toFixed(2)}R over ${sh.length}.`); delete fl[fe]; if (fl.since) delete fl.since[fe]; }
    }
    for (const v of (fl.noSession || []).slice()) {
      const sh = shadows.filter((x) => x.k === k && (x.blockedBy || []).includes('session') && x.feat && x.feat.session === v);
      const old = fl.since && fl.since['session:' + v] && now - Date.parse(fl.since['session:' + v]) / 1000 > 21 * 86400;
      if ((sh.length >= 5 && exp(sh) > 0.2) || old) { fl.noSession = fl.noSession.filter((x) => x !== v); if (fl.since) delete fl.since['session:' + v]; change(`${k}: trading the ${v} session again`, old ? '21 days old: re-testing.' : `Blocked trades made +${exp(sh).toFixed(2)}R over ${sh.length}.`); }
    }
    if (!fl.d1 && !fl.struct && !(fl.noSession || []).length) delete config.filters[k];
  }
  // trade management: turn break-even on when 40%+ of recent losers had been +1R first; re-test it after 21 days
  const recentLoss = closed.filter((x) => x.status === 'loss' && now - x.closed < 14 * 86400);
  if (!config.be && recentLoss.length >= 8) {
    const gaveBack = recentLoss.filter((x) => (x.mfe || 0) >= 1).length;
    if (gaveBack / recentLoss.length >= 0.4) { config.be = 1; config.beSince = nowISO; change('Break-even at +1R turned on', `${gaveBack} of ${recentLoss.length} recent losers were +1R or more before turning around.`); }
  } else if (config.be && config.beSince && now - Date.parse(config.beSince) / 1000 > 21 * 86400) {
    const bes = closed.filter((x) => x.status === 'be'), wins = closed.filter((x) => x.status === 'win');
    change('Break-even rule off for a re-test', `${bes.length} trades closed at break-even and ${wins.length} won over the last 30 days; testing without it.`);
    config.be = null; delete config.beSince;
  }
  // ─── Lessons from the trade reviews: act on system errors that keep repeating (live and shadow losses, last 14 days) ───
  const rl = trades.filter((x) => x.status === 'loss' && x.pm && x.pm.phase === 'done' && now - x.closed < 14 * 86400);
  const cnt = (c) => rl.filter((x) => x.pm.cause === c || (x.pm.factors || []).includes(c)).length, share = (c) => rl.length ? cnt(c) / rl.length : 0;
  if (rl.length >= 6) {
    if (cnt('hunt') >= 3 && share('hunt') >= 0.3 && config.buf < LIMITS.buf[1]) { const v = +Math.min(LIMITS.buf[1], config.buf + 0.02).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Reviews: ${cnt('hunt')} of ${rl.length} losses were stopped out and then went to the target (stop hunted).`); config.buf = v; }
    if (cnt('noise') >= 3 && config.minRisk < LIMITS.minRisk[1]) { const v = +Math.min(LIMITS.minRisk[1], config.minRisk + 0.1).toFixed(2); change(`Minimum stop ${config.minRisk} → ${v} ATR`, `Reviews: ${cnt('noise')} losses had a stop inside one normal candle.`); config.minRisk = v; }
    if (cnt('late') >= 3 && share('late') >= 0.3 && (config.fresh || FRESH) > 6) { const v = (config.fresh || FRESH) - 2; change(`Fresh signals only: ${config.fresh || FRESH} → ${v} candles`, `Reviews: ${cnt('late')} of ${rl.length} losses were late entries.`); config.fresh = v; }
    if (cnt('news') >= 3 && !config.newsGuard) { config.newsGuard = true; config.newsSince = nowISO; change('News guard on', `Reviews: ${cnt('news')} losses came from high-impact news; no short-term trades from 15 min before to 45 min after news.`); }
  }
  // break-even that keeps costing wins: move it later
  const beR = trades.filter((x) => x.status === 'be' && x.pm && x.pm.phase === 'done' && now - x.closed < 14 * 86400);
  const beCost = beR.filter((x) => x.pm.cause === 'becost').length;
  if (config.be && config.be < 2 && beCost >= 3 && beCost > beR.length - beCost) { change(`Break-even ${config.be}R → ${config.be + 0.5}R`, `Reviews: ${beCost} of ${beR.length} break-even exits then went on to the target.`); config.be = config.be + 0.5; }
  // re-test the news guard after 21 days, using its shadow trades
  if (config.newsGuard && config.newsSince && now - Date.parse(config.newsSince) / 1000 > 21 * 86400) {
    const sh = shadows.filter((x) => (x.blockedBy || []).includes('news'));
    if (!(sh.length >= 3 && exp(sh) < 0)) { config.newsGuard = false; delete config.newsSince; change('News guard off for a re-test', sh.length ? `Trades it blocked made ${exp(sh).toFixed(2)}R over ${sh.length}.` : '21 days old: re-testing without it.'); }
    else config.newsSince = nowISO;
  }

  // markets: pause one for 3 days when it loses (6+ trades, worse than -0.3R each); resume early if its shadow trades recover
  const byMarket = {}; closed.forEach((x) => (byMarket[x.market] = byMarket[x.market] || []).push(x));
  for (const [m, arr] of Object.entries(byMarket)) {
    if (config.pausedMarkets[m] || arr.length < 6) continue;
    const e = exp(arr);
    if (e < -0.3) { config.pausedMarkets[m] = new Date((now + 3 * 86400) * 1000).toISOString(); change(`Paused market ${m} for 3 days`, `${e.toFixed(2)}R per trade over ${arr.length} trades.`); }
  }
  for (const m of Object.keys(config.pausedMarkets)) {
    const sh = shadows.filter((x) => x.market === m && (x.blockedBy || []).includes('market'));
    if (sh.length >= 4 && exp(sh) > 0.3) { delete config.pausedMarkets[m]; change(`Resumed market ${m} early`, `Shadow trades while paused made +${exp(sh).toFixed(2)}R over ${sh.length}.`); }
  }
  // resume a paused setup early when its shadow trades recover
  for (const k of Object.keys(config.paused)) {
    const sh = shadows.filter((x) => x.k === k && (x.blockedBy || []).includes('paused'));
    if (sh.length >= 4 && exp(sh) > 0.3) { delete config.paused[k]; change(`Resumed ${k} early`, `Shadow trades while paused made +${exp(sh).toFixed(2)}R over ${sh.length}.`); }
  }
  wr('coach.json', { date: today, at: nowISO, stats, last14: rs, lessons: lessons(trades, now), notes: notes.length ? notes : ['No change today: not enough evidence to move a rule.'] });
}
config.history = config.history.slice(-200);

wr('config.json', config);
wr('state.json', state);
wr('trades.json', trades);
snapshot.lessons = lessons(trades, now);
wr('snapshot.json', snapshot);
const open = trades.filter((x) => x.status === 'open' || x.status === 'pending').length;
console.log(`Council run ${nowISO}: ${Object.keys(snapshot.markets).length} markets, ${Object.keys(snapshot.errors).length} errors, ${open} open/pending trades, ${trades.length} total.`);
if (Object.keys(snapshot.errors).length) console.log(snapshot.errors);
