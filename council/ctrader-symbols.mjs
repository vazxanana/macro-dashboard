// cTrader symbol specs (7 Nov 2026): the broker's own contract specs for every symbol the DEMO mirror trades, so its risk-based lot
// (council/ctrader-mirror.mjs riskVolume) is checked against the broker rather than assumed.
//   node council/ctrader-symbols.mjs <dataDir>      (each council round, before the mirror) -> <dataDir>/ctrader/symbols.json
//
// READ ONLY: every message goes through api/ctrader-link.js's read session, whose READ_ONLY allowlist has no trading message (auth,
// account list, trader, asset list, symbol list / by id, conversion chain, tick data, expected margin, leverage tiers). Demo only,
// like the mirror: CTRADER_MIRROR=on, CTRADER_ENV=demo and the account must report isLive:false. No account number, login or token
// is written; errors are scrubbed of the configured secrets.
//
// Per broker symbol (the one the mirror would pick for each market in SYMBOLS): lotSize and units a lot, min / step / max volume
// (raw and in lots), digits, pipPosition, base and quote asset names (ProtoOAAssetListReq), tradingMode, the trading schedule and
// holidays, leverageId with its tiers, commission / swap / distance fields, measurementUnits, pnlConversionFeeRate; the last bid /
// ask from the broker's ticks and the spread (price units; the Trader's cost model reads `symbols.<NAME>.spread`, unchanged format);
// quoteToDeposit (one unit of the quote currency in the account currency, along the broker's conversion chain and quotes);
// valuePerPoint (account currency per 1.0 price move per lot); the broker's margin for one lot and the leverage that implies (a
// wrong contract size would show as a leverage far from the account's); the P/L per point per lot seen on the demo's own closed
// deals (ctrader/account.json); and a sample trade: 0.20% (1R) of a $50k balance with a typical stop, sized by riskVolume itself.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SYMBOLS, LIMITS, riskVolume, specFor, normName, unseal, scrubber } from './ctrader-mirror.mjs';
const require = createRequire(import.meta.url);
const { _t } = require('../api/ctrader-link.js');

// the sample trade on the Council mirror row: an ICT A-setup (0.20% a trade) on a $50k demo, stop = the ICT replay's median stop
// per market (ict/replay.json, 7 Nov: NQ 164, ES 29, YM 208, RTY 18, GC 32), 20 pips for the council's forex pairs
export const SAMPLE = { balance: 50000, risk: LIMITS.risk.ict,
  stops: { xau: 32, gc: 32, nq: 160, es: 30, ym: 200, rty: 18, eurusd: 0.002, gbpusd: 0.002, audusd: 0.002, usdcad: 0.002, usdchf: 0.002 } };
export const MODES = ['ENABLED', 'DISABLED_WITHOUT_PENDINGS_EXECUTION', 'DISABLED_WITH_PENDINGS_EXECUTION', 'CLOSE_ONLY_MODE'];
const FRESH_QUOTE = 15 * 60;   // a quote older than this (market shut) keeps the previous spread
// Spreads (12 Nov 2026, owner approved the cost-measurement fix). The demo is a raw-spread account: its forex majors are quoted
// with bid = ask most of the day (EURUSD, AUDUSD, USDCAD, USDCHF 0.0 pips on 93-95 % of the reads of 8-12 Nov outside the 17:00
// New York rollover, GBPUSD 0.0 on 83 %) and it charges a commission instead (ProtoOASymbol commissionType 1 = USD per million
// USD of notional, a side: 22.5 on forex, 12 on gold; the demo's own deals show 0.04-0.06 a 0.01-lot round trip). So:
//   spread       only ever a POSITIVE quoted spread: measured this run (spreadSrc 'measured'), else the last positive one kept for
//                at most SPREAD_KEEP_DAYS with its own spreadAt ('kept'), else null ('default': the cost model uses its default).
//                A zero or negative ask - bid is never written here (before this, a bid = ask quote wrote spread 0).
//   quoteSpread  this run's ask - bid as quoted (0 allowed), quoteSpreadAt.
//   spreadLog    the quoted spreads of the last SPREAD_LOG fresh reads ([unix sec, spread], zeros included), and spreadTypical
//                { n, median, mean, zeroShare, from, to } over the reads outside the rollover hours (21:00-22:59 UTC, where raw
//                spreads widen): what a fill outside the rollover really pays.
//   commissionRT the broker's round-trip commission as a fraction of the price (2 x rate a side / 1e6; commission type 1 only,
//                0 where the broker charges none, null where the type is another one).
export const SPREAD_KEEP_DAYS = 7, SPREAD_LOG = 300, SPREAD_LOG_DAYS = 14;
export const rolloverHour = (sec) => { const h = new Date(sec * 1000).getUTCHours(); return h === 21 || h === 22; };
const med0 = (a) => { const v = a.slice().sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
export function spreadFields(q, fresh, before = {}, nowSec) {
  const raw = fresh && q && Number.isFinite(q.ask - q.bid) ? +(q.ask - q.bid).toPrecision(6) : null, qsec = q ? Math.floor(q.ts / 1000) : null;
  const o = { quoteSpread: raw != null && raw >= 0 ? raw : null, quoteSpreadAt: raw != null && raw >= 0 ? new Date(q.ts).toISOString() : null };
  const keptAge = before.spreadAt ? nowSec - Date.parse(before.spreadAt) / 1000 : Infinity;
  if (raw > 0) Object.assign(o, { spread: raw, spreadAt: new Date(q.ts).toISOString(), spreadSrc: 'measured' });
  else if (+before.spread > 0 && keptAge <= SPREAD_KEEP_DAYS * 86400) Object.assign(o, { spread: +before.spread, spreadAt: before.spreadAt, spreadSrc: 'kept' });
  else Object.assign(o, { spread: null, spreadAt: null, spreadSrc: 'default' });
  let log = (Array.isArray(before.spreadLog) ? before.spreadLog : []).filter((x) => Array.isArray(x) && Number.isFinite(x[0]) && Number.isFinite(x[1]) && x[1] >= 0 && x[0] >= nowSec - SPREAD_LOG_DAYS * 86400);
  if (o.quoteSpread != null && !log.some((x) => x[0] === qsec)) log = log.concat([[qsec, o.quoteSpread]]);
  o.spreadLog = log.slice(-SPREAD_LOG);
  const v = o.spreadLog.filter((x) => !rolloverHour(x[0])).map((x) => x[1]);
  o.spreadTypical = v.length ? { n: v.length, median: +med0(v).toPrecision(6), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toPrecision(6),
    zeroShare: +(v.filter((x) => x === 0).length / v.length).toFixed(3), from: new Date(o.spreadLog[0][0] * 1000).toISOString(), to: new Date(o.spreadLog[o.spreadLog.length - 1][0] * 1000).toISOString() } : null;
  return o;
}
export function commissionRT(x) {
  const type = x && x.commissionType, rate = num(x && x.preciseTradingCommissionRate);
  if (rate == null) return null;
  if (rate === 0) return 0;
  return type === 1 || type === 'USD_PER_MILLION_USD' ? +(2 * rate / 1e8 / 1e6).toPrecision(6) : null;
}
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hm = (sec) => { const s = ((+sec % 604800) + 604800) % 604800, d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${DAY[d]} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
export const modeName = (v) => (v == null ? 'ENABLED' : typeof v === 'number' ? MODES[v] || String(v) : String(v));
// ProtoOAInterval: seconds from Sunday 00:00 in the symbol's scheduleTimeZone
export const scheduleText = (iv) => (iv || []).map((x) => `${hm(x.startSecond)}–${hm(x.endSecond)}`).join(', ');

// ProtoOATickData: the first tick holds the absolute timestamp (ms) and price (1/100000), every later one the change from the one
// before. The newest tick is the latest timestamp, whatever order the list comes in.
export function lastTick(list) {
  let ts = 0, px = 0, best = null;
  (list || []).forEach((d, i) => { ts = i ? ts + Number(d.timestamp) : Number(d.timestamp); px = i ? px + Number(d.tick) : Number(d.tick);
    if (Number.isFinite(ts) && Number.isFinite(px) && (!best || ts > best.ts)) best = { ts, px: px / 1e5 }; });
  return best;
}
// one unit of fromAsset in toAsset along the broker's conversion chain (ProtoOASymbolsForConversionRes: light symbols, in order)
export function chainRate(chain, fromAsset, toAsset, mid) {
  let cur = String(fromAsset), rate = 1;
  for (const s of chain || []) {
    const p = mid(s); if (!(p > 0)) return null;
    if (String(s.baseAssetId) === cur) { rate *= p; cur = String(s.quoteAssetId); }
    else if (String(s.quoteAssetId) === cur) { rate /= p; cur = String(s.baseAssetId); }
    else return null;
  }
  return cur === String(toAsset) ? rate : null;
}
// P/L per 1.0 price move per lot on the demo's own closed deals (ctrader/account.json history: position side, lots, entry, exit,
// gross in the account currency). Deals under 1 unit of gross are left out (cent rounding).
export function observedValue(history, name) {
  const v = (Array.isArray(history) ? history : []).filter((h) => h && h.symbol === name && +h.lots > 0 && Math.abs(+h.gross) >= 1 && Number.isFinite(+h.entry) && Number.isFinite(+h.exit) && +h.exit !== +h.entry)
    .map((h) => +h.gross / ((h.side === 'sell' ? -1 : 1) * (+h.exit - +h.entry) * +h.lots)).filter((x) => x > 0).sort((a, b) => a - b);
  return v.length ? { n: v.length, perPointPerLot: +v[v.length >> 1].toPrecision(6) } : null;
}
// The contract-size check that works with the market shut: margin for one lot = units x price x quoteToDeposit / leverage, where the
// leverage is the lower of the account's and the symbol's tier (tiers come in hundredths: 50000 = 1:500). Solved for the price, a
// wrong unitsPerLot shows as a price 10x or 100x off the market. Needs marginPerLot, unitsPerLot, quoteToDeposit and the tiers.
export function impliedPrice(e, accountLeverage) {
  const tier = e && Array.isArray(e.leverageTiers) && e.leverageTiers.length ? +e.leverageTiers[0].leverage / 100 : null;
  const lev = [tier, +accountLeverage].filter((x) => x > 0), L = lev.length ? Math.min(...lev) : null;
  if (!e || !(e.marginPerLot > 0) || !(e.unitsPerLot > 0) || !(e.quoteToDeposit > 0) || !L) return null;
  return +((e.marginPerLot * L) / (e.unitsPerLot * e.quoteToDeposit)).toPrecision(6);
}
const num = (v) => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);
const lotsOf = (v, lot) => (num(v) == null || !(lot > 0) ? null : +(+v / lot).toFixed(6));

export async function symbolSpecs({ env, tokens = null, prev = null, history = null, WS = globalThis.WebSocket, now = Date.now(), lib = _t, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const need = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'];
  if (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on' || need.some((k) => !String(env[k] || '').trim()) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') return null;
  const env2 = { ...env, CTRADER_CLIENT_ID: String(env.CTRADER_CLIENT_ID).trim(), CTRADER_CLIENT_SECRET: String(env.CTRADER_CLIENT_SECRET).trim() };
  let accessToken = String(env.CTRADER_ACCESS_TOKEN).trim();
  try { const t = tokens && unseal(tokens, env); if (t && t.accessToken) accessToken = t.accessToken; } catch (e) {}
  const at = new Date(now).toISOString(), id = String(env.CTRADER_ACCOUNT_ID).trim();
  const accounts = await lib.readAccounts(WS, accessToken, env2);
  const acc = accounts.find((a) => a.id === id) || accounts.find((a) => a.login === id);
  if (!acc) return { error: 'account not found for this token', at };
  if (acc.live) return { error: 'refused: not a demo account', at };
  const P = lib.PT, s = lib.session(WS, lib.HOSTS.demo), ctid = Number(acc.id), errors = [];
  const soft = async (what, f) => { try { return await f(); } catch (e) { errors.push(`${what}: ${String((e && e.message) || e).slice(0, 160)}`); return null; } };
  try {
    await s.send(P.APP_AUTH_REQ, { clientId: env2.CTRADER_CLIENT_ID, clientSecret: env2.CTRADER_CLIENT_SECRET });
    await s.send(P.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: ctid, accessToken });
    const trader = (await s.send(P.TRADER_REQ, { ctidTraderAccountId: ctid })).trader || {};
    const [names, assets] = [await s.send(P.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }), await s.send(P.ASSET_LIST_REQ, { ctidTraderAccountId: ctid })];
    const assetName = new Map((assets.asset || []).map((a) => [String(a.assetId), a.name || a.displayName || null]));
    const deposit = assetName.get(String(trader.depositAssetId)) || null;
    // the broker symbol the mirror picks for each market: the first name in SYMBOLS that the broker lists as enabled
    const light = new Map((names.symbol || []).filter((x) => x.enabled !== false).map((x) => [normName(x.symbolName), x]));
    const markets = {}, missing = {}, picked = new Map();
    for (const [m, list] of Object.entries(SYMBOLS)) {
      const n = list.find((x) => light.has(normName(x)));
      if (!n) { markets[m] = null; missing[m] = list; continue; }
      markets[m] = n; const L = light.get(normName(n));
      if (!picked.has(n)) picked.set(n, { light: L, markets: [] }); picked.get(n).markets.push(m);
    }
    const ids = [...picked.values()].map((x) => Number(x.light.symbolId));
    const full = new Map(ids.length ? ((await s.send(P.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: ids })).symbol || []).map((x) => [String(x.symbolId), x]) : []);
    // last bid / ask from the broker's ticks over the last 15 minutes (historical requests: at most 5 a second, so spaced out)
    const quotes = new Map(), nowSec = Math.floor(now / 1000);
    const quote = async (symbolId) => {
      if (quotes.has(String(symbolId))) return quotes.get(String(symbolId));
      const q = {};
      for (const [k, type] of [['bid', 1], ['ask', 2]]) {
        await sleep(250);
        const r = await soft(`ticks ${symbolId}`, () => s.send(P.GET_TICKDATA_REQ, { ctidTraderAccountId: ctid, symbolId: Number(symbolId), type, fromTimestamp: now - FRESH_QUOTE * 1000, toTimestamp: now }));
        const t = r && lastTick(r.tickData); if (t) { q[k] = t.px; q[k + 'At'] = t.ts; }
      }
      const out = q.bid > 0 && q.ask > 0 ? { bid: q.bid, ask: q.ask, mid: (q.bid + q.ask) / 2, ts: Math.max(q.bidAt, q.askAt) } : null;
      quotes.set(String(symbolId), out); return out;
    };
    const levCache = new Map(), out = {}, prevSyms = (prev && prev.symbols) || {};
    for (const [name, { light: L, markets: ms }] of picked) {
      const x = full.get(String(L.symbolId)) || {}, before = prevSyms[name] || {};
      const lot = num(x.lotSize), base = assetName.get(String(L.baseAssetId)) || null, quoteCcy = assetName.get(String(L.quoteAssetId)) || null;
      const q = await quote(L.symbolId);
      // quote currency -> account currency, from the broker's conversion chain and its own quotes
      let rate = null;
      if (quoteCcy && deposit && quoteCcy === deposit) rate = 1;
      else if (L.quoteAssetId != null && trader.depositAssetId != null) {
        const chain = await soft(`conversion ${name}`, () => s.send(P.SYMBOLS_FOR_CONVERSION_REQ, { ctidTraderAccountId: ctid, firstAssetId: Number(L.quoteAssetId), lastAssetId: Number(trader.depositAssetId) }));
        const mids = new Map();
        for (const c of (chain && chain.symbol) || []) { const cq = await quote(c.symbolId); if (cq) mids.set(String(c.symbolId), cq.mid); }
        if (chain) rate = chainRate(chain.symbol, L.quoteAssetId, trader.depositAssetId, (c) => mids.get(String(c.symbolId)));
      }
      const fresh = q && nowSec - Math.floor(q.ts / 1000) <= FRESH_QUOTE;
      const lev = x.leverageId != null ? (levCache.has(String(x.leverageId)) ? levCache.get(String(x.leverageId))
        : await soft(`leverage ${name}`, async () => { const r = await s.send(P.GET_DYNAMIC_LEVERAGE_REQ, { ctidTraderAccountId: ctid, leverageId: Number(x.leverageId) }); levCache.set(String(x.leverageId), r.leverage || null); return r.leverage || null; })) : null;
      const mg = lot ? await soft(`margin ${name}`, () => s.send(P.EXPECTED_MARGIN_REQ, { ctidTraderAccountId: ctid, symbolId: Number(L.symbolId), volume: [lot] })) : null;
      const m0 = mg && (mg.margin || [])[0], md = mg && Number.isFinite(+mg.moneyDigits) ? +mg.moneyDigits : Number.isFinite(+trader.moneyDigits) ? +trader.moneyDigits : 2;
      const marginPerLot = m0 && num(m0.buyMargin) != null ? +m0.buyMargin / 10 ** md : null;
      const rateNow = rate != null ? +rate.toPrecision(8) : null;
      const e = {
        markets: ms, symbolId: Number(L.symbolId), description: L.description || null, base, quote: quoteCcy,
        lotSize: lot, unitsPerLot: lot ? lot / 100 : null, minVolume: num(x.minVolume), stepVolume: num(x.stepVolume), maxVolume: num(x.maxVolume),
        minLots: lotsOf(x.minVolume, lot), stepLots: lotsOf(x.stepVolume, lot), maxLots: lotsOf(x.maxVolume, lot),
        digits: num(x.digits), pipPosition: num(x.pipPosition), measurementUnits: x.measurementUnits || null,
        tradingMode: modeName(x.tradingMode), scheduleTimeZone: x.scheduleTimeZone || null,
        schedule: (x.schedule || []).map((i) => [num(i.startSecond), num(i.endSecond)]), scheduleText: scheduleText(x.schedule) || null,
        holidays: (x.holiday || []).slice(0, 20).map((h) => ({ name: h.name || null, date: Number.isFinite(+h.holidayDate) ? new Date(+h.holidayDate * 86400e3).toISOString().slice(0, 10) : null,
          recurring: !!h.isRecurring, start: num(h.startSecond), end: num(h.endSecond) })),
        leverageId: num(x.leverageId), leverageTiers: lev && Array.isArray(lev.tiers) ? lev.tiers.map((t) => ({ volume: num(t.volume), leverage: num(t.leverage) })) : null,
        commission: { type: x.commissionType ?? null, preciseRate: num(x.preciseTradingCommissionRate), preciseMin: num(x.preciseMinCommission), minType: x.minCommissionType ?? null, minAsset: x.minCommissionAsset || null },
        swap: { long: num(x.swapLong), short: num(x.swapShort), type: x.swapCalculationType ?? null, rollover3Days: x.swapRollover3Days ?? null },
        distances: { sl: num(x.slDistance), tp: num(x.tpDistance), setIn: x.distanceSetIn ?? null }, pnlConversionFeeRate: num(x.pnlConversionFeeRate),
        enableShortSelling: x.enableShortSelling ?? null,
        // quotes: a fresh one replaces the last; spreads by spreadFields (a positive spread only; the last good one kept with its time)
        bid: q ? q.bid : before.bid ?? null, ask: q ? q.ask : before.ask ?? null, quoteAt: q ? new Date(q.ts).toISOString() : before.quoteAt ?? null,
        ...spreadFields(q, fresh, before, nowSec), commissionRT: commissionRT(x),
        quoteToDeposit: rateNow ?? before.quoteToDeposit ?? null, rateAt: rateNow != null ? at : before.rateAt ?? null,
        marginPerLot,
      };
      e.valuePerPoint = lot && e.quoteToDeposit ? +((lot / 100) * e.quoteToDeposit).toPrecision(8) : null;   // account currency per 1.0 price move per lot
      e.pipValue = e.valuePerPoint != null && e.pipPosition != null ? +(e.valuePerPoint * 10 ** -e.pipPosition).toPrecision(8) : null;
      const mid = q ? q.mid : e.bid > 0 && e.ask > 0 ? (e.bid + e.ask) / 2 : null;
      e.notionalPerLot = lot && mid && e.quoteToDeposit ? +((lot / 100) * mid * e.quoteToDeposit).toFixed(2) : null;
      e.impliedLeverage = e.notionalPerLot && marginPerLot > 0 ? +(e.notionalPerLot / marginPerLot).toFixed(1) : null;
      e.observed = observedValue(history, name);
      if (e.observed && e.valuePerPoint) e.observed.matches = Math.abs(e.observed.perPointPerLot / e.valuePerPoint - 1) <= 0.05;
      out[name] = e;
    }
    const file = { at, source: 'council/ctrader-symbols.mjs', broker: acc.broker || null, account: { currency: deposit, leverage: trader.leverageInCents ? trader.leverageInCents / 100 : null },
      markets, missing, symbols: out, errors };
    for (const e of Object.values(out)) e.impliedPrice = impliedPrice(e, file.account.leverage);
    // the sample trade, sized by the mirror's own riskVolume with these specs
    file.sample = { balance: SAMPLE.balance, riskPct: +(SAMPLE.risk * 100).toFixed(3), riskCash: +(SAMPLE.balance * SAMPLE.risk).toFixed(2), maxLots: LIMITS.maxLots, maxMarginPct: LIMITS.maxMarginShare * 100 };
    for (const [name, e] of Object.entries(out)) {
      const stop = SAMPLE.stops[e.markets[0]], mid = e.bid > 0 && e.ask > 0 ? (e.bid + e.ask) / 2 : null;
      if (!stop) continue;
      // the price only matters when the account currency is the base (USDCAD on a USD account: 1/price); any price works for the rest
      if (!mid && e.base && e.base === file.account.currency) { e.sample = { stop, skip: `${name}: no broker quote yet` }; continue; }
      const entry = mid || 100 * stop;
      const rv = riskVolume({ info: { lotSize: e.lotSize, minVolume: e.minVolume, stepVolume: e.stepVolume, maxVolume: e.maxVolume },
        t: { id: 'ict:sample', entry, stop: entry - stop, size: 1 }, balance: SAMPLE.balance, name, spec: specFor(file, name), now: Math.floor(now / 1000) });
      e.sample = { stop, ...(rv.skip ? { skip: rv.skip } : { lots: rv.lots, volume: rv.volume, riskCash: rv.riskCash, perLot: rv.perLot, risked: +(rv.lots * rv.perLot).toFixed(2) }) };
    }
    return file;
  } finally { s.close(); }
}

if (process.argv[1] && process.argv[1].endsWith('ctrader-symbols.mjs')) {
  const CD = path.join(process.argv[2] || 'data', 'ctrader');
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(CD, f), 'utf8')); } catch (e) { return null; } };
  const scrub = scrubber(process.env), tokens = rd('tokens.json');
  try { const t = tokens && unseal(tokens, process.env); if (t) scrub.add(t.accessToken, t.refreshToken); } catch (e) {}
  try {
    const prev = rd('symbols.json');
    const r = await symbolSpecs({ env: process.env, tokens, prev, history: (rd('account.json') || {}).history });
    if (!r) process.exit(0);
    if (r.error) { console.log(`cTrader symbols: ${scrub(r.error)}`); process.exit(0); }   // the last good file stays
    r.errors = r.errors.map(scrub);
    fs.mkdirSync(CD, { recursive: true });
    fs.writeFileSync(path.join(CD, 'symbols.json'), JSON.stringify(r, null, 1));
    const line = Object.entries(r.symbols).map(([n, e]) => `${n} ${e.unitsPerLot}/lot ${e.quote}${e.valuePerPoint != null ? ` ${e.valuePerPoint}/pt` : ''}`).join(' · ');
    console.log(`cTrader symbols: ${Object.keys(r.symbols).length} (${r.account.currency || '?'} account) · ${scrub(line)}${r.errors.length ? ` · ${r.errors.length} errors` : ''}`);
  } catch (e) { console.log(`cTrader symbols failed: ${scrub(e.message || e)}`); }
}
