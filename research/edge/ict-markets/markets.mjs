// ICT market expansion (edge research, 7 Nov 2026). Does the live ICT desk's A-rule (H1 iFVG reversal), UNCHANGED, hold on
// markets the desk does not trade yet, over the desk's own replay window (1 Aug 2025 - 7 Nov 2026), after costs?
// Drives the desk's own code: signals()/isASetup()/sizeOf()/MIN_GRADE/inHalt from ict/tracker.mjs and simulate() from
// ict/replay.mjs (gap guard, break-even on the index rule, trail from +2R, 36 H1 max). Busy rule as replay.mjs: an A-setup is
// only blocked by an open A-setup. Nothing is reimplemented except the candle loading and the cost charge. Paper research only.
//
// Data (fetched by fetch.mjs into <dir>):
//   OANDA mid candles through meridianx.dev/md/bars (api/bars.js): <sym>-1h.json (Oct 2024 on, signals + D1) and <sym>-5m.json
//   (15 Jun 2025 on, exits) for xau, xag, eurusd, gbpusd, usdjpy, de40. The 17:00 New York hour is dropped like the tracker's feed.
//   D1 = 17:00 New York rollover (DST-aware), stamped so time + 86400 = its close, as research/edge/ict-universe.
//   Crypto: Binance BTCUSDT/ETHUSDT 5m from council-data research/candles/crypto5m (to 31 Oct 2026) + Kraken 1h/5m through the
//   same proxy (src=kraken) for the last week; 24/7, no halt hour, UTC days.
//
//   node research/edge/ict-markets/markets.mjs <dataDir> <council-data ict/replay.json> <out.json>
import fs from 'node:fs';
import zlib from 'node:zlib';
import { MIN_GRADE, signals, isASetup, sizeOf, inHalt } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';
import { model, sessMult, nyHour, futCost, stats } from '../costs/costs.mjs';

const [DIR, REPLAY, OUT] = process.argv.slice(2);
const FROM = Date.UTC(2025, 7, 1) / 1000, END = Date.UTC(2026, 10, 7, 23, 59) / 1000, MID = Date.UTC(2026, 2, 20, 12) / 1000;   // window midpoint

// Round-trip cost in price units at signal time t: spread x session multiplier + commission + market-entry slip + exit slip
// (stop fill, or market slip on a time exit). OANDA spread-only levels (research/edge/costs) are the primary charge; 'raw'
// (ECN, IC Markets Raw levels + $7/lot) is the sensitivity. Silver / DE40 / crypto have no table in costs.mjs, set here.
const fx = (sym) => { const o = model(sym, 'oanda'), r = model(sym, 'raw');
  return { oanda: (t, p, ex) => { const c = o(t); return c.spread + c.comm + c.slipM + (ex === 'time' ? c.slipM : c.slipS); },
    raw: (t, p, ex) => { const c = r(t); return c.spread + c.comm + c.slipM + (ex === 'time' ? c.slipM : c.slipS); } }; };
const xag = (sp) => (t, p, ex) => sp * sessMult('XAUUSD', nyHour(t)) + 0.005 + (ex === 'time' ? 0.005 : 0.01);
// DAX CFD: ~1.4 pt in Xetra hours (03:00-11:30 New York), ~4 pt outside; 0.5 pt market slip, 1 pt on a stop
const dax = (sp) => (t, p, ex) => { const h = nyHour(t); return (h >= 3 && h < 12 ? sp : sp * 2.8) + 0.5 + (ex === 'time' ? 0.5 : 1); };
// crypto: Kraken spot taker 0.40% a side + ~0.02% spread/slip (the council replay's FEE.taker, #454); CFD sensitivity 0.06% RT
const kraken = (t, p) => p * (0.008 + 0.0002), cfd = (t, p) => p * 0.0006;
const U = {
  xau:    { label: 'Spot gold XAU/USD', tick: 0.01,    dec: 3, rules: ['gold', 'index'], cost: fx('XAUUSD') },
  xag:    { label: 'Spot silver XAG/USD', tick: 0.001, dec: 4, rules: ['gold', 'index'], cost: { oanda: xag(0.035), raw: xag(0.02) } },
  eurusd: { label: 'EUR/USD', tick: 0.00001, dec: 5, rules: ['index', 'gold'], cost: fx('EURUSD') },
  gbpusd: { label: 'GBP/USD', tick: 0.00001, dec: 5, rules: ['index', 'gold'], cost: fx('GBPUSD') },
  usdjpy: { label: 'USD/JPY', tick: 0.001,   dec: 3, rules: ['index', 'gold'], cost: fx('USDJPY') },
  de40:   { label: 'DAX (DE40 CFD)', tick: 0.1, dec: 1, rules: ['index', 'gold'], cost: { oanda: dax(1.4), raw: dax(1.0) } },
  btc:    { label: 'Bitcoin', tick: 0.1,  dec: 1, rules: ['index', 'gold'], crypto: 'BTCUSDT', cost: { oanda: kraken, raw: cfd } },
  eth:    { label: 'Ether',   tick: 0.01, dec: 2, rules: ['index', 'gold'], crypto: 'ETHUSDT', cost: { oanda: kraken, raw: cfd } },
};
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const toBar = (r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] });
const dedupe = (a) => { const m = new Map(); for (const b of a) m.set(b.time, b); return [...m.values()].sort((x, y) => x.time - y.time); };
const aggH = (bars) => { const out = []; let cur = null; for (const b of bars) { const k = b.time - (b.time % 3600);
  if (cur && cur.time === k) { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } else { cur = { ...b, time: k }; out.push(cur); } } return out; };
const NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' });
const nyOff = (t) => (NYF.formatToParts(new Date(t * 1000)).find((x) => x.type === 'timeZoneName').value.includes('-4') ? 4 : 5);
function daily(H, utc) {
  const out = []; let cur = null, key = null;
  for (const b of H) { const off = utc ? 0 : nyOff(b.time), sh = utc ? 0 : 7 * 3600, day = Math.floor((b.time - off * 3600 + sh) / 86400);
    if (day !== key) { key = day; const closeUtc = (day + 1) * 86400 - sh + off * 3600; cur = { time: closeUtc - 86400, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } }
  return out;
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

function load(key, u) {
  let H, m5;
  if (u.crypto) {
    const b = JSON.parse(zlib.gunzipSync(fs.readFileSync(`${DIR}/${key}5m.json.gz`))).map(toBar).filter((x) => x.time >= FROM - 120 * 86400);
    const last = b.at(-1).time, k5 = rd(`${DIR}/kr-${key}-5m.json`).bars, k1 = rd(`${DIR}/kr-${key}-1h.json`).bars;
    m5 = dedupe(b.concat(k5.filter((x) => x.time > last)));
    const h = aggH(b); H = dedupe(h.concat(k1.filter((x) => x.time > h.at(-1).time)));
  } else {
    m5 = rd(`${DIR}/${key}-5m.json`).map(toBar).filter((b) => !inHalt(b.time));
    H = rd(`${DIR}/${key}-1h.json`).map(toBar).filter((b) => !inHalt(b.time));
  }
  const now = Math.floor(Date.now() / 1000);
  H = H.filter((b) => b.time + 3600 <= now); m5 = m5.filter((b) => b.time + 300 <= now);
  const D = daily(H, !!u.crypto).filter((d) => d.time + 86400 <= now);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));
  return { H, m5, D, m5days };
}

const res = { at: new Date().toISOString(), window: ['2025-08-01', '2026-11-07'], mid: new Date(MID * 1000).toISOString(), src: {}, trades: [] };
for (const [key, u] of Object.entries(U)) {
  if (ONLY && !ONLY.includes(key)) continue;
  const src = load(key, u);
  res.src[key] = { h1: src.H.length, m5: src.m5.length, d1: src.D.length, h1from: new Date(src.H[0].time * 1000).toISOString().slice(0, 10), to: new Date(src.H.at(-1).time * 1000).toISOString().slice(0, 16) };
  for (const cfg of u.rules) {
    // the desk's two unchanged rule sets: 'index' = a market without aRule (against the daily bias, grade >= 7, stop 0.3-0.75x
    // the daily ATR + tight A+ at half size, DOL sizing, break-even at +1.5R); 'gold' = GC's aRule (buys, stop 0.3-0.75x ATR,
    // size 1, no break-even). mk names the market whose rule isASetup()/sizeOf() apply.
    const M = { label: u.label, short: key.toUpperCase(), tick: u.tick, dec: u.dec, aRule: cfg === 'gold' ? 'gold' : undefined }, mk = cfg === 'gold' ? 'gc' : 'nq';
    const sig = signals(src.H, src.D, 1, u.tick).concat(signals(src.H, src.D, -1, u.tick)).filter((g) => g.close >= FROM && g.close <= END && g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
    let busyA = 0, gaps = 0, nA = 0;
    for (const g of sig) {
      if (!isASetup(g, mk) || g.close < busyA) continue;
      nA++;
      const i = lb(src.H, g.close), j = lb(src.m5, g.close);
      const t = simulate(g, M, key, { H: src.H.slice(i, i + 120), m5: src.m5.slice(j, j + 12 * 24 * 12), m5days: src.m5days });
      if (!t) { gaps++; continue; }
      busyA = t.closed || Infinity;
      if (!t.closed) continue;
      const size = sizeOf(g, mk), cO = u.cost.oanda(g.close, g.entry, t.exit) / g.r0, cR = u.cost.raw(g.close, g.entry, t.exit) / g.r0;
      res.trades.push({ m: key, cfg, side: t.side, t: g.close, size, Rraw: t.R, gross: +(t.R * size).toFixed(3), net: +((t.R - cO) * size).toFixed(3), netRaw: +((t.R - cR) * size).toFixed(3),
        costR: +cO.toFixed(4), exit: t.exit, res: t.res, session: g.feat.session, atrR: g.feat.atrR });
    }
    res.src[key][cfg] = { signals: sig.length, aSignals: nA, gaps };
  }
  // drift control (not a rule, as research/edge/ict-universe): random H1-close BUYS, ~1 in 25 candles, stop 0.3-0.75x the daily
  // ATR14 (the gold rule's band), the gold rule's exit, same costs. A buys-only rule has to beat simply being long that market.
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 60; i < src.H.length - 40; i++) {
    if (rnd() > 0.04) continue;
    const close = src.H[i].time + 3600; if (close < FROM || close > END) continue;
    const di = src.D.findLastIndex((d) => d.time + 86400 <= close); if (di < 14) continue;
    const atrD = src.D.slice(di - 13, di + 1).reduce((a, d) => a + (d.high - d.low), 0) / 14, k = 0.3 + 0.45 * rnd(), e = src.H[i].close, r0 = k * atrD;
    const g = { side: 1, entry: e, r0, stop: e - r0, close, t: src.H[i].time, sweepT: src.H[i].time, swept: e, fvg: [e, e], ih: null, dol: null, valid: true, feat: {}, grade: { total: 0 } };
    const j = lb(src.m5, close), t = simulate(g, { label: u.label, short: key, tick: u.tick, dec: u.dec, aRule: 'gold' }, key, { H: src.H.slice(i + 1, i + 121), m5: src.m5.slice(j, j + 12 * 24 * 12), m5days: src.m5days });
    if (!t || !t.closed) continue;
    const cO = u.cost.oanda(close, e, t.exit) / r0;
    res.trades.push({ m: key, cfg: 'ctrlbuy', side: 'buy', t: close, size: 1, Rraw: t.R, gross: t.R, net: +(t.R - cO).toFixed(3), netRaw: +(t.R - u.cost.raw(close, e, t.exit) / r0).toFixed(3), costR: +cO.toFixed(4), exit: t.exit, res: t.res });
  }
  console.log(key, JSON.stringify(res.src[key]));
}

// baseline: the live A-stream in council-data ict/replay.json, re-costed as research/edge/costs (CME micros: 1 tick spread +
// $1.24 RT + 1 tick entry slip + 1 tick exit slip), size as recorded
const J = rd(REPLAY);
for (const x of J.trades.filter((x) => x.aset && x.closed && x.R != null)) {
  const c = futCost(x.short), raw = x.Rraw != null ? x.Rraw : x.R, size = x.size || 1, cR = (c.spread + c.comm + c.slipM + (x.exit === 'time' ? c.slipM : c.slipS)) / x.r0;
  res.trades.push({ m: x.market, cfg: 'live', side: x.side, t: x.signalAt, size, Rraw: raw, gross: x.R, net: +((raw - cR) * size).toFixed(3), netRaw: +((raw - cR) * size).toFixed(3), costR: +cR.toFixed(4), exit: x.exit, res: x.res, session: x.feat && x.feat.session, atrR: x.feat && x.feat.atrR });
}

// summary per market x rule set
const cell = (a) => { const s = stats(a.map((x) => x.net)), h1 = stats(a.filter((x) => x.t < MID).map((x) => x.net)), h2 = stats(a.filter((x) => x.t >= MID).map((x) => x.net));
  return { ...s, gross: stats(a.map((x) => x.gross)).exp, netRaw: stats(a.map((x) => x.netRaw)).exp, costR: a.length ? +(a.reduce((p, x) => p + x.costR * x.size, 0) / a.length).toFixed(3) : null,
    h1: { n: h1.n, exp: h1.exp, R: h1.R }, h2: { n: h2.n, exp: h2.exp, R: h2.R }, buys: a.filter((x) => x.side === 'buy').length,
    pass: s.n >= 30 && s.t != null && s.t >= 2 && h1.R > 0 && h2.R > 0 };
};
res.summary = {};
const keys = [...new Set(res.trades.map((x) => `${x.m}|${x.cfg}`))];
for (const k of keys) { const [m, cfg] = k.split('|'); res.summary[k] = cell(res.trades.filter((x) => x.m === m && x.cfg === cfg)); }
res.summary['ALL|live'] = cell(res.trades.filter((x) => x.cfg === 'live'));
// drift-adjusted (buys-only gold rule): net R a trade minus the random-buys control of the same market
for (const k of keys) { const [m, cfg] = k.split('|'), c = res.summary[`${m}|ctrlbuy`]; if (cfg === 'gold' && c) res.summary[k].driftAdj = +(res.summary[k].exp - c.exp).toFixed(3); }
res.cols = ['m', 'cfg', 'side', 't', 'size', 'Rraw', 'gross', 'net', 'netRaw', 'costR', 'exit', 'res', 'session', 'atrR'];
res.trades = res.trades.map((x) => res.cols.map((c) => x[c] ?? null));
fs.writeFileSync(OUT, JSON.stringify(res));
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('market|rule', 16), 'n    win%   R/tr   totR   maxDD  t     H1(n,R)        H2(n,R)        gross  raw    cost  pass');
for (const [k, s] of Object.entries(res.summary)) console.log(pad(k, 16), pad(s.n, 4), pad(s.wr == null ? '-' : (100 * s.wr).toFixed(0) + '%', 6), pad(s.exp, 6), pad(s.R, 6), pad(s.maxDD, 6), pad(s.t, 5), pad(`${s.h1.n},${s.h1.R}`, 14), pad(`${s.h2.n},${s.h2.R}`, 14), pad(s.gross, 6), pad(s.netRaw, 6), pad(s.costR, 5), s.pass ? 'PASS' : '');
