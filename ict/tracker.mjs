// ICT desk tracker (owner, 6 Nov 2026): a SEPARATE edge from the Mosha council. Paper-trades the iFVG
// reversal model (see .claude/skills/ICT/SKILL.md) on US index futures and records every ICT feature of each
// signal, so the reviewer (Fred) and the data can show which filters matter. Shares nothing with council/:
// own code, own workflow (.github/workflows/ict.yml), own data folder (council-data ict/).
//
// Model (H1, both sides): a confirmed H1 swing low (3 bars each side, last 96 H1 bars) is swept; within 6 H1
// candles a candle BODY closes above the most recent bearish FVG of the down-leg (the inversion) → buy at the
// price when the tracker sees it; stop 2 ticks under the sweep low; target 3R (the 2R mark is recorded as a
// second variant); out after 36 trading hours (36 closed H1 candles; skill §21). Sells mirror. One open trade per market.
import fs from 'node:fs';
import path from 'node:path';

const DATA = process.argv[2] || 'data/ict';
export const MARKETS = {
  nq:  { sym: 'NQ=F',  cnbc: ['@ND.1'],           label: 'Nasdaq 100',   short: 'NQ',  tick: 0.25, dec: 2 },
  es:  { sym: 'ES=F',  cnbc: ['@SP.1', '@ES.1'],  label: 'S&P 500',      short: 'ES',  tick: 0.25, dec: 2 },
  ym:  { sym: 'YM=F',  cnbc: ['@DJ.1', '@YM.1'],  label: 'Dow Jones',    short: 'YM',  tick: 1,    dec: 0 },
  rty: { sym: 'RTY=F', cnbc: ['@TFS.1', '@RTY.1'], label: 'Russell 2000', short: 'RTY', tick: 0.1, dec: 1 },
  // skill §26 (owner, 7 Nov): gold futures with its own A-setup rule (aRule) from 2019-26 history. EUR/USD and GBP/USD were
  // tracked 7 Nov and removed the same day (owner: "remove gbpusd and eurusd").
  gc:  { sym: 'GC=F', cnbc: ['@GC.1'], label: 'Gold', short: 'GC', tick: 0.1, dec: 1, aRule: 'gold' },
};
// owner (7 Nov): grade F signals (total < 3 of 10) are not recorded at all
export const MIN_GRADE = 3;
// be (7 Nov, owner "improve the ict stats"): index futures move the stop to the entry once +1.5R is reached (more R in all four test
// sets, smaller drawdown in two; it hurt gold, so gold keeps the plain trail)
export const P = { piv: 3, look: 96, vmax: 6, rr: 3, trail: [2, 1.5], mark: 2, holdH: 36, maxAtr: 8, fresh: 3 * 3600, be: 1.5 };
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);

async function yahoo(sym, interval, range) {
  for (let a = 0; a < 4; a++) {
    for (const host of ['query1', 'query2']) {
      try {
        const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}&includePrePost=true`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
        if (!r.ok) continue;
        const j = await r.json(), res = j && j.chart && j.chart.result && j.chart.result[0]; if (!res) continue;
        const ts = res.timestamp || [], q = res.indicators.quote[0], out = [];
        for (let i = 0; i < ts.length; i++) { const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
          if ([o, h, l, c].every((v) => v != null && isFinite(v) && v > 0)) out.push({ time: ts[i], open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c }); }
        return { bars: out, price: res.meta && res.meta.regularMarketPrice };
      } catch (e) { /* next host */ }
    }
    await sleep(1500 * (a + 1));
  }
  throw new Error(`Yahoo ${sym} ${interval} unreachable`);
}
// CNBC's chart service (front-month futures, ~10 min delayed) answers GitHub's runners; Yahoo has refused them
// since 4 Nov 2026 (429), so CNBC is first and Yahoo the fallback.
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const etStamp = (t) => { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return `${o.year}${o.month}${o.day}${o.hour}${o.minute}00`; };
// CME halt (17:00-18:00 New York) for all five markets; CNBC still prints into it (Friday settlement ticks, and the bar that
// straddles the 18:00 reopen), which made a fake H1 candle each day
const etH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
export const inHalt = (t) => +etH.format(new Date(t * 1000)) % 24 === 17;
export async function cnbcBars(sym, iv, from, to) {
  // audit (7 Nov): CNBC anchors intraday bars at the request's start minute (a run at hh:37 got 5m bars at :02/:07/...),
  // so H1 candles built from them were shifted and changed from run to run; start on the hour
  if (iv !== '1D') from = Math.floor(from / 3600) * 3600;
  const r = await fetch(`https://ts-api.cnbc.com/harmony/app/bars/${encodeURIComponent(sym)}/${iv}/${etStamp(from)}/${etStamp(to)}/adjusted/EST5EDT.json`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => null), pb = j && j.barData && j.barData.priceBars;
  if (!pb || !pb.length) throw new Error(`CNBC ${sym} ${iv}: ${(j && j.statusMessage) || `HTTP ${r.status}`}`);
  const out = [];
  for (const b of pb) { const o = +b.open, h = +b.high, l = +b.low, c = +b.close, t = Math.round(+b.tradeTimeinMills / 1000); if ([o, h, l, c, t].every((v) => isFinite(v) && v > 0) && (iv === '1D' || !inHalt(t))) out.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c }); }
  return out.sort((a, b) => a.time - b.time);
}
export const agg = (bars, sec) => { const m = new Map(); for (const b of bars) { const k = Math.floor(b.time / sec) * sec, c = m.get(k); if (!c) m.set(k, { time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } } return [...m.values()].sort((a, b) => a.time - b.time); };
// H1 (built from 5m, ~24 days), D1 (~1 year) and 5m (5 days) for one market
async function feed(M) {
  for (const sym of M.cnbc) {
    try {
      let m5 = [];
      for (let t = now - 24 * 86400; t < now; t += 6 * 86400) { m5 = m5.concat(await cnbcBars(sym, '5M', t, Math.min(now + 300, t + 6 * 86400))); await sleep(400); }
      { const by = new Map(); for (const b of m5) by.set(b.time, b); m5 = [...by.values()].sort((a, b) => a.time - b.time); }   // the later (fuller) copy of a bar wins
      const d1 = await cnbcBars(sym, '1D', now - 400 * 86400, now + 86400);
      if (m5.length > 500 && d1.length > 60) return { src: `cnbc ${sym}`, h1: agg(m5, 3600), d1, m5: m5.filter((b) => b.time >= now - 5 * 86400) };
    } catch (e) { console.log(String(e.message || e)); }
  }
  const [h1, d1, m5] = [await yahoo(M.sym, '60m', '60d'), await yahoo(M.sym, '1d', '1y'), await yahoo(M.sym, '5m', '5d')];
  return { src: `yahoo ${M.sym}`, h1: h1.bars.filter((b) => !inHalt(b.time)), d1: d1.bars, m5: m5.bars.filter((b) => !inHalt(b.time)) };
}
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { return d; } };
const save = (f, v) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(v, null, f === 'trades.json' ? 0 : 1));
const etHour = (t) => +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(new Date(t * 1000)) % 24;
const session = (h) => (h >= 18 || h < 3 ? 'Asia' : h < 8 ? 'London' : h < 12 ? 'NY AM' : h < 16 ? 'NY PM' : 'Close');

// All iFVG signals in H (closed H1 bars) for one side; mirrored prices for sells.
export function signals(Hraw, D, side, tick) {
  const m = side > 0 ? (b) => b : (b) => ({ time: b.time, open: -b.open, high: -b.low, low: -b.high, close: -b.close });
  const H = Hraw.map(m), Dm = D.map(m), n = P.piv, N = H.length, out = [];
  const isPL = (j) => j >= n && j + n < N && H.slice(j - n, j + n + 1).every((b) => b.low >= H[j].low);
  const isPH = (j) => j >= n && j + n < N && H.slice(j - n, j + n + 1).every((b) => b.high <= H[j].high);
  let act = [], lastExit = -1;
  const H4 = agg(H, 14400);   // mirrored H4 (skill §29: v20 'run stops into an imbalance')
  // unfilled bullish FVG (mirrored space) on B closed before time t whose gap contains the sweep low x, within the last `look` candles
  const fvgHit = (B, sec, t, x, look) => { const n2 = B.findLastIndex((b) => b.time + sec <= t); for (let i = n2; i >= Math.max(2, n2 - look); i--) {
    const lo = B[i - 2].high, hi = B[i].low; if (hi <= lo) continue; let filled = false; for (let j = i + 1; j <= n2; j++) if (B[j].low <= lo) { filled = true; break; }
    if (!filled && x >= lo && x <= hi) return true; } return false; };
  for (let i = n; i < N; i++) {
    const j = i - n; if (j >= 0 && isPL(j)) act.push(j);
    act = act.filter((k) => i - k <= P.look);
    const swept = act.filter((k) => H[i].low < H[k].low);
    if (!swept.length || i <= lastExit) continue;
    act = act.filter((k) => H[i].low >= H[k].low);
    const s = i; let lo = H[s].low;
    for (let c = s; c < Math.min(s + P.vmax + 1, N); c++) {
      lo = Math.min(lo, H[c].low);
      let top = null, bot = null;
      for (let k = c - 1; k >= Math.max(s - 12, 2); k--) if (H[k].high < H[k - 2].low) { top = H[k - 2].low; bot = H[k].high; break; }
      if (top == null || !(H[c].close > top && (H[c].open <= top || H[c - 1].close <= top))) continue;
      const e = H[c].close, stop = lo - 2 * tick, r0 = e - stop;
      const tr = H.slice(Math.max(1, c - 47), c + 1).map((b, q, A) => Math.max(b.high, (A[q - 1] || b).close) - Math.min(b.low, (A[q - 1] || b).close));
      const atr = tr.reduce((a, x) => a + x, 0) / tr.length;
      if (r0 <= 0 || r0 > P.maxAtr * atr) break;
      let ih = null; for (let k = c - n; k > Math.max(c - P.look, 0); k--) if (isPH(k) && H[k].high > e) { ih = H[k].high; break; }
      let dol = null; for (let k = c - n; k > Math.max(c - P.look, 0); k--) if (isPH(k) && H[k].high >= e + r0) { dol = H[k].high; break; }
      const di = Dm.findLastIndex((d) => d.time + 86400 <= Hraw[c].time + 3600); // last daily candle closed before this H1 close
      let bias = null, pd = null, pdSweep = null;
      if (di >= 50) { const sma = Dm.slice(di - 49, di + 1).reduce((a, d) => a + d.close, 0) / 50; bias = Dm[di].close > sma;
        const R = Dm.slice(di - 19, di + 1), hi = Math.max(...R.map((d) => d.high)), lw = Math.min(...R.map((d) => d.low)); pd = +((e - lw) / (hi - lw)).toFixed(3); pdSweep = lo < Dm[di].low; }
      // stop size vs the daily range: r0 / ATR14 of the closed daily candles (skill §20)
      const atrD = di >= 14 ? Dm.slice(di - 13, di + 1).reduce((a, d) => a + (d.high - d.low), 0) / 14 : null, atrR = atrD ? +(r0 / atrD).toFixed(3) : null;
      // skill §29 (forward-test features, not filters): the sweep candle traded into an unfilled D1 / H4 FVG; prior daily candle-closure bias
      const htfFvg = fvgHit(Dm, 86400, Hraw[s].time, H[s].low, 20) ? 'D1' : fvgHit(H4, 14400, Hraw[s].time, H[s].low, 30) ? 'H4' : null;
      let cc = 0; if (di >= 1) { const a = Dm[di - 1], d = Dm[di]; cc = (d.low < a.low && d.close > a.low) || d.close > a.high ? 1 : (d.high > a.high && d.close < a.high) || d.close < a.low ? -1 : 0; }
      const b = H[c], rg = b.high - b.low || 1e-9, body = Math.abs(b.close - b.open) / rg, cl = (b.close - b.low) / rg;
      const strength = Math.round(4 * Math.min(1, body / 0.7) * (cl >= 0.75 ? 1 : cl >= 0.5 ? 0.6 : 0.3)), speed = c - s <= 2 ? 3 : c - s <= 4 ? 2 : 1;
      const rrRoom = dol != null ? (dol - e) / r0 : null, rrPts = rrRoom == null ? 1 : rrRoom >= 3 ? 3 : rrRoom >= 2 ? 2 : 1;
      out.push({ side, t: Hraw[c].time, close: Hraw[c].time + 3600, sweepT: Hraw[s].time, swept: side * H[swept.at(-1)].low,
        fvg: [side * Math.min(top, bot), side * Math.max(top, bot)].sort((x, y) => x - y), entry: side * e, stop: side * stop, r0,
        ih: ih == null ? null : side * ih, dol: dol == null ? null : side * dol, valid: ih == null || b.high < ih,
        feat: { atrR, bias: bias == null ? null : bias ? 'with' : 'against', pd, zone: pd == null ? null : pd < 0.5 ? (side > 0 ? 'discount' : 'premium') : (side > 0 ? 'premium' : 'discount'),
          pdSweep, speed: c - s, body: +body.toFixed(2), closeLoc: +cl.toFixed(2), session: session(etHour(Hraw[c].time + 3600)), etHour: etHour(Hraw[c].time + 3600), htfFvg, cc },
        grade: { strength, speed, rr: rrPts, total: strength + speed + rrPts } });
      lastExit = c + 6; break;
    }
  }
  return out;
}
// The A-setup filter (6 Nov 2026 research, .claude/skills/ICT/SKILL.md §14): the signal goes AGAINST the daily bias (prior
// close vs its 50-day average) and its candle-closure grade is at least 7/10 (B+). Every signal is still recorded; A-setups
// carry aset: true and are never blocked by a weaker open signal on the same market.
// A-setup (skills §14 + §20): against the daily bias, grade >= 7, and a stop of at least 0.3x the daily ATR (tight stops on H1 sweeps get
// hunted: on 2023-26 cash indices every year turned positive and the drawdown halved; confirmed on NQ futures 2023-25)
export const RISK_FLOOR = 0.3;
export const RISK_CAP = 0.75; // skill §22: stops wider than 0.75x the daily ATR are not A-setups
// skill §23: a signal on a jobs-report morning (before 10:00 New York on the NFP release day) is news, not a liquidity run.
// The release days come from council/events.mjs (#488): the first-Friday guess was wrong for 6 of the 15 reports in
// Aug 2025 - Nov 2026 (shutdown delays, holiday moves). Outside the calendar's range, or without it, the first Friday is used.
const ET_PARTS = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23' });
let NFP_DAYS = null, NFP_FROM = Infinity, NFP_TO = -Infinity;
try { const ev = (await import('../council/events.mjs')).EVENTS.filter((e) => e.type === 'NFP');
  if (ev.length) { NFP_DAYS = new Set(); for (const e of ev) { const p = Object.fromEntries(ET_PARTS.formatToParts(new Date(e.t * 1000)).map((x) => [x.type, x.value])); NFP_DAYS.add(`${p.year}-${p.month}-${p.day}`); NFP_FROM = Math.min(NFP_FROM, e.t - 40 * 86400); NFP_TO = Math.max(NFP_TO, e.t + 40 * 86400); } } } catch (e) {}
export const nfpMorning = (t) => { if (!t) return false; const p = Object.fromEntries(ET_PARTS.formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value]));
  if (+p.hour >= 10) return false;
  if (NFP_DAYS && t >= NFP_FROM && t <= NFP_TO) return NFP_DAYS.has(`${p.year}-${p.month}-${p.day}`);
  return p.weekday === 'Fri' && +p.day <= 7; };
// skill §25 (owner: "we had way better results before"): a tight stop (0.15-0.3x the daily ATR) still counts as an A-setup when the
// signal has A+ quality (inversion body >= 60%, not the NY afternoon), at HALF size; R of such a trade is recorded x0.5 (Rraw = per unit)
export const RISK_TIGHT = 0.15, TIGHT_SIZE = 0.5;
const aBase = (g) => !!g.feat && g.feat.bias === 'against' && g.grade && g.grade.total >= 7 && !nfpMorning(g.close ?? g.signalAt);
const aTight = (g) => aBase(g) && g.feat.atrR != null && g.feat.atrR >= RISK_TIGHT && g.feat.atrR < RISK_FLOOR && g.feat.body >= 0.6 && g.feat.session !== 'NY PM';
const aIndex = (g) => (aBase(g) && (g.feat.atrR == null || (g.feat.atrR >= RISK_FLOOR && g.feat.atrR < RISK_CAP))) || aTight(g);
// skill §26: the index rule does not carry over. Spot gold 2019-26: A-setups lose in every window, while BUYS with a stop of
// 0.3-0.75x the daily ATR are positive in every year (2019-22 +56.7R, 2023-24 +36.0R, 2025-26 +32.8R). EUR/USD: London-session
// signals only (+28.6 | +11.7 | +14.9R, 7 of 8 years positive). GBP/USD: no rule held in every window, so no A-setups (tracked only).
const RULES = {
  gold: (g) => !!g.feat && g.side > 0 && g.feat.atrR != null && g.feat.atrR >= RISK_FLOOR && g.feat.atrR < RISK_CAP,
};
export const isASetup = (g, mk) => { const r = mk && MARKETS[mk] && MARKETS[mk].aRule; return r ? RULES[r](g) : aIndex(g); };
// skill §27: index A-setups are sized by the room to the draw on liquidity (DOL, the next untaken high/low) at the signal:
// 1.5x when it is >= 2R away, 0.5x when closer or unknown (more R in all four test sets, smaller drawdown in three)
export const DOL_ROOM = 2, ROOM_SIZE = [0.5, 1.5];
const roomR = (g) => (g.dol != null && g.r0 > 0 ? ((g.side > 0 ? 1 : -1) * (g.dol - g.entry)) / g.r0 : null);
export const sizeOf = (g, mk) => { if (mk && MARKETS[mk] && MARKETS[mk].aRule) return 1;
  const r = roomR(g); return +((aTight(g) ? TIGHT_SIZE : 1) * (r != null && r >= DOL_ROOM ? ROOM_SIZE[1] : ROOM_SIZE[0])).toFixed(2); };
// A+ tier (skill §17): an A-setup whose inversion candle body is >= 60% of its range and that does not fire in the NY afternoon (12-16 ET)
export const isAPlus = (g, mk) => !(mk && MARKETS[mk] && MARKETS[mk].aRule) && isASetup(g, mk) && g.feat.body >= 0.6 && g.feat.session !== 'NY PM';   // §26: no A+ tier for gold / FX (strong bodies did worse there)
// PAPER COMPARISON ONLY (research/edge/ict-index-longonly, merged 7 Nov 2026): candidate NQ/ES rule 'dip' = the gold rule's BUYS
// (grade >= MIN_GRADE, stop 0.3-0.75x the daily ATR) taken only when the last completed daily close is below the close 20 trading
// days earlier; size 1, no break-even, gold exit (trail from +2R, 36 H1 max). It is NOT live: its records go to their own file
// (ict/shadow.json, replay.json .shadow), carry shadow: true + variant: 'dip', never alert and never touch the A-rule records.
export const SHADOW = { dip: { markets: ['nq', 'es'], back: 20 } };
export const dipGate = (g, D) => { const di = D.findLastIndex((d) => d.time + 86400 <= g.close);   // same daily candle as signals() uses
  return di >= SHADOW.dip.back ? D[di].close < D[di - SHADOW.dip.back].close : null; };
export const isDip = (g, mk, D) => SHADOW.dip.markets.includes(mk) && g.side > 0 && !!g.grade && g.grade.total >= MIN_GRADE && RULES.gold(g) && dipGate(g, D) === true;
// PAPER COMPARISON ONLY (8 Nov 2026): two more shadow variants of the CURRENT A-setup rule (same sizing, same exits incl. break-even
// on indices, all five markets), each with its own one-open-trade-per-market rule, in ict/shadow.json .variants and replay.json
// .shadowByVariant. Not live: shadow: true + variant, no alerts, the A-rule records are never touched.
//  'nofri' (research/edge/ict-filters): A-setups except those whose signal candle closes on a New York Friday (OOS 2024-26 +0.156R vs +0.125R
//    a trade, max drawdown 11.3R vs 16.0R; a weak pass).
//  'h1opp' (research/edge/confluence): A-setups only when the Meridian H1 structure trend does NOT agree with the trade (council/engine.mjs
//    msAnalyze, N = 6, on the last 720 closed H1 candles before the signal; 'opposed' = trend against the trade or none, exactly the research's
//    mH1 != 'with'). OOS +0.361R a trade on 61% of the trades vs +0.223R, same total R: a forward-test idea, not a pass.
SHADOW.nofri = { markets: Object.keys(MARKETS) };
SHADOW.h1opp = { markets: Object.keys(MARKETS), N: 6, look: 720, min: 60 };
export const VARIANTS = ['nofri', 'h1opp'];
const NY_DOW = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
export const nyFriday = (t) => NY_DOW.format(new Date(t * 1000)) === 'Fri';
const aRecorded = (g, mk) => !!g.grade && g.grade.total >= MIN_GRADE && isASetup(g, mk);
export const isNoFri = (g, mk) => SHADOW.nofri.markets.includes(mk) && aRecorded(g, mk) && !nyFriday(g.close);
// Meridian structure engine, loaded only for the shadow (a missing council/ checkout can only fail the shadow, never the live desk)
let meridian = null;
export const loadMeridian = async () => (meridian = meridian || (await import('../council/engine.mjs')).msAnalyze);
// Meridian H1 trend (+1 up, -1 down, 0 none) on the closed H1 candles before the signal closes (the research's trendAt)
export const h1Trend = (g, H, ms) => { const i = H.findLastIndex((b) => b.time + 3600 <= g.close); if (i < SHADOW.h1opp.min) return 0;
  return ms(H.slice(Math.max(0, i - SHADOW.h1opp.look + 1), i + 1), SHADOW.h1opp.N).trend; };
export const isH1Opp = (g, mk, H, ms) => SHADOW.h1opp.markets.includes(mk) && aRecorded(g, mk) && h1Trend(g, H, ms) !== g.side;
export const variantRule = (v, g, mk, ctx) => (v === 'nofri' ? isNoFri(g, mk) : v === 'h1opp' ? isH1Opp(g, mk, ctx.H, ctx.ms) : v === 'dip' ? isDip(g, mk, ctx.D) : false);
// each variant's verdict on one signal, stored on the replay's A-setups (vr) so the Coach can tell the trades a filter rejects from the
// ones its stream only missed while busy (council/proposals.mjs ictVariantVerdicts); a tag, it changes no record
export const variantTags = (g, mk, ctx) => Object.fromEntries(VARIANTS.map((v) => [v, !!variantRule(v, g, mk, ctx)]));
export const letter = (g) =>(g >= 10 ? 'A+' : g >= 9 ? 'A' : g >= 8 ? 'A-' : g >= 7 ? 'B+' : g >= 6 ? 'B' : g >= 5 ? 'B-' : g >= 3 ? 'C' : 'F');

// manage one open trade on the closed 5m candles (shared by the live records and the shadow 'dip' records)
function manageTrade(tr, H, m5, f) {
  const s = tr.side === 'buy' ? 1 : -1;
  // time exit after P.holdH closed H1 candles since the signal (trading hours, not clock hours: weekends don't count). Audit:
  // the exit is at the close of the 36th candle and nothing after it is managed (it used the price at run time before)
  const hold = H.filter((b) => b.time >= (tr.signalAt || tr.opened)), endT = hold.length >= P.holdH ? hold[P.holdH - 1].time + 3600 : Infinity;
  for (const b of m5.bars.filter((b) => b.time >= tr.checked && b.time < endT)) {
    if (!tr.mark2 && (s > 0 ? b.high >= tr.t2 : b.low <= tr.t2)) tr.mark2 = b.time + 300;
    tr.mfe = Math.max(tr.mfe || 0, +(((s > 0 ? b.high : -b.low) - s * tr.entry) / tr.r0).toFixed(2));
    if (s > 0 ? b.low <= tr.stop : b.high >= tr.stop) { const Rraw = +((s * (tr.stop - tr.entry)) / tr.r0).toFixed(2), R = +(Rraw * (tr.size || 1)).toFixed(2);
      Object.assign(tr, { status: Rraw > 0.001 ? 'win' : Rraw < -0.001 ? 'loss' : 'be', R, Rraw, exitPx: tr.stop, closed: b.time + 300, exit: tr.trailMoved ? 'trail' : tr.beMoved ? 'breakeven' : 'stop' }); break; }
    if (tr.t1 != null && (s > 0 ? b.high >= tr.t1 : b.low <= tr.t1)) { const Rraw = +((s * (tr.t1 - tr.entry)) / tr.r0).toFixed(2);   // older records with a fixed target; sized like every other exit
      Object.assign(tr, { status: 'win', R: +(Rraw * (tr.size || 1)).toFixed(2), Rraw, exitPx: tr.t1, closed: b.time + 300, exit: 'target' }); break; }
    if (tr.be && !tr.beMoved && tr.mfe >= tr.be && (tr.entry - tr.stop) * s > 0) { tr.stop = tr.entry; tr.beMoved = true; }   // break-even from +1.5R (index futures)
    if (tr.trail && tr.mfe >= tr.trail[0]) { const ns = f(tr.entry + s * (tr.mfe - tr.trail[1]) * tr.r0); if ((ns - tr.stop) * s > 0) { tr.stop = ns; tr.trailMoved = true; } }   // trail from +2R, 1.5R behind the best
    tr.checked = b.time + 300;
  }
  if (tr.status === 'open' && endT !== Infinity) { const px = hold[P.holdH - 1].close, Rraw = +((s * (px - tr.entry)) / tr.r0).toFixed(2), R = +(Rraw * (tr.size || 1)).toFixed(2);
    Object.assign(tr, { status: Rraw > 0 ? 'win' : Rraw < 0 ? 'loss' : 'be', R, Rraw, exitPx: f(px), closed: endT, exit: 'time' }); }
  if (tr.closed) tr.R2 = tr.mark2 && (!tr.closed || tr.mark2 <= tr.closed) ? +(2 * (tr.size || 1)).toFixed(2) : tr.R;   // the 2R-target variant
}

async function main() {
  fs.mkdirSync(DATA, { recursive: true });
  // shadow 'dip' records (paper comparison, never alerted): a separate file so trades.json and the live stats stay as they were
  const shadow = load('shadow.json', null) || { variant: 'dip', since: new Date(now * 1000).toISOString(), trades: [], errors: {} }; shadow.errors = shadow.errors || {};
  // 'nofri' / 'h1opp' live under .variants (the top-level fields stay the 'dip' stream, so older readers keep working)
  shadow.variants = shadow.variants || {};
  for (const v of VARIANTS) { const V = (shadow.variants[v] = shadow.variants[v] || { since: new Date(now * 1000).toISOString(), trades: [], errors: {} }); V.trades = V.trades || []; V.errors = V.errors || {}; }
  const trades = load('trades.json', []), snap = { at: new Date().toISOString(), markets: {}, errors: {}, model: { ...P, name: 'H1 iFVG reversal' } }, bars = {};
  for (const [key, M] of Object.entries(MARKETS)) {
    try {
      const F = await feed(M), price = F.m5.length ? F.m5.at(-1).close : F.h1.at(-1).close;
      // audit (7 Nov): CNBC's last bar is still forming (and the feed runs ~10 min behind), so a candle counts as closed only
      // once the feed has a later bar, or the last bar is 20+ min old (session halt, weekend). Before, an H1 candle could be
      // "closed" on part of its 5m bars and a forming 5m bar was managed once and then skipped for good.
      const done = F.m5.filter((b, i, A) => b.time + 300 <= now && (i < A.length - 1 || now - (b.time + 300) >= 1200));
      const frontier = done.length ? done.at(-1).time + 300 : now, m5 = { bars: done };
      const H = F.h1.filter((b) => b.time + 3600 <= Math.min(now, frontier)), D = F.d1.filter((b) => b.time + 86400 <= now);
      const f = (v) => +(+v).toFixed(M.dec);
      // 1. manage open trades on 5m candles
      for (const tr of trades.filter((x) => x.market === key && x.status === 'open')) manageTrade(tr, H, m5, f);
      // 2. new signals: an inversion candle closed in the last 3 h, not yet recorded, no open trade on this market
      const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).sort((a, b) => a.close - b.close);
      for (const g of sig) {
        const id = `${key}-${g.side > 0 ? 'b' : 's'}-${g.t}`;
        if (trades.some((x) => x.id === id) || now - g.close > P.fresh || g.grade.total < MIN_GRADE) continue;
        const aset = isASetup(g, key);
        if (trades.some((x) => x.market === key && x.status === 'open' && (!aset || x.aset))) continue;   // one open per market; an A-setup is only blocked by another A-setup
        const s = g.side, entry = f(price), r0 = Math.abs(entry - g.stop);
        if ((entry - g.stop) * s <= 0 || r0 > 1.6 * g.r0) continue;   // price already through the stop, or ran far from the signal
        trades.push({ id, market: key, label: M.label, short: M.short, side: s > 0 ? 'buy' : 'sell', model: 'H1 iFVG reversal', signalAt: g.close, signalPx: f(g.entry),
          entry, stop: f(g.stop), r0: +r0.toFixed(M.dec + 1), t1: null, trail: P.trail, be: M.aRule ? null : P.be, stop0: f(g.stop), t2: f(entry + s * P.mark * r0), opened: now, checked: frontier, status: 'open', R: null, size: aset ? sizeOf(g, key) : 1,
          sweep: { t: g.sweepT, level: f(g.swept) }, fvg: g.fvg.map(f), ih: g.ih == null ? null : f(g.ih), dol: g.dol == null ? null : f(g.dol), valid: g.valid,
          feat: g.feat, grade: { ...g.grade, letter: letter(g.grade.total) }, aset, aplus: isAPlus(g, key) });
      }
      // 3. snapshot + candles for the page
      const last = sig.at(-1), dd = D.at(-1);
      snap.markets[key] = { label: M.label, short: M.short, src: F.src, price: f(price), at: m5.bars.length ? m5.bars.at(-1).time + 300 : now,
        lastSignal: last ? { side: last.side > 0 ? 'buy' : 'sell', at: last.close, entry: f(last.entry), grade: letter(last.grade.total) } : null,
        pdh: dd ? f(dd.high) : null, pdl: dd ? f(dd.low) : null, open: trades.filter((x) => x.market === key && x.status === 'open').length };
      bars[key] = { h1: H.slice(-400).map((b) => [b.time, f(b.open), f(b.high), f(b.low), f(b.close)]), m5: m5.bars.slice(-600).map((b) => [b.time, f(b.open), f(b.high), f(b.low), f(b.close)]),
        d1: D.slice(-120).map((b) => [b.time, f(b.open), f(b.high), f(b.low), f(b.close)]) };
      // 4. shadow 'dip' (paper comparison only): its own open trade per market, own entries, own file; runs after everything
      // the live desk does and cannot change it (own try: a shadow error is logged in shadow.json, not in the live snapshot)
      if (SHADOW.dip.markets.includes(key)) {
        try {
          for (const tr of shadow.trades.filter((x) => x.market === key && x.status === 'open')) manageTrade(tr, H, m5, f);
          for (const g of sig) {
            const id = `${key}-b-${g.t}-dip`;
            if (shadow.trades.some((x) => x.id === id) || now - g.close > P.fresh || !isDip(g, key, D)) continue;
            if (shadow.trades.some((x) => x.market === key && x.status === 'open')) continue;   // one open shadow trade per market
            const entry = f(price), r0 = Math.abs(entry - g.stop);
            if (entry - g.stop <= 0 || r0 > 1.6 * g.r0) continue;
            shadow.trades.push({ id, shadow: true, variant: 'dip', market: key, label: M.label, short: M.short, side: 'buy', model: 'H1 iFVG reversal', signalAt: g.close, signalPx: f(g.entry),
              entry, stop: f(g.stop), r0: +r0.toFixed(M.dec + 1), t1: null, trail: P.trail, be: null, stop0: f(g.stop), t2: f(entry + P.mark * r0), opened: now, checked: frontier, status: 'open', R: null, size: 1,
              sweep: { t: g.sweepT, level: f(g.swept) }, fvg: g.fvg.map(f), ih: g.ih == null ? null : f(g.ih), dol: g.dol == null ? null : f(g.dol), valid: g.valid,
              feat: g.feat, grade: { ...g.grade, letter: letter(g.grade.total) }, aset: false });
          }
          delete shadow.errors[key];
        } catch (e) { shadow.errors[key] = String(e.message || e); }
      }
      // 5. shadow 'nofri' / 'h1opp' (paper comparison only): the A-setup rule with one extra condition, each its own stream (own open
      // trade per market, own ids, own records in shadow.json .variants); runs last, own try per variant, errors kept there
      for (const v of VARIANTS) {
        const V = shadow.variants[v];
        if (!SHADOW[v].markets.includes(key)) continue;
        try {
          for (const tr of V.trades.filter((x) => x.market === key && x.status === 'open')) manageTrade(tr, H, m5, f);
          const ctx = { H, D, ms: v === 'h1opp' ? await loadMeridian() : null };
          for (const g of sig) {
            const s = g.side, id = `${key}-${s > 0 ? 'b' : 's'}-${g.t}-${v}`;
            if (V.trades.some((x) => x.id === id) || now - g.close > P.fresh || !variantRule(v, g, key, ctx)) continue;
            if (V.trades.some((x) => x.market === key && x.status === 'open')) continue;   // one open trade per market for this variant
            const entry = f(price), r0 = Math.abs(entry - g.stop);
            if ((entry - g.stop) * s <= 0 || r0 > 1.6 * g.r0) continue;
            V.trades.push({ id, shadow: true, variant: v, market: key, label: M.label, short: M.short, side: s > 0 ? 'buy' : 'sell', model: 'H1 iFVG reversal', signalAt: g.close, signalPx: f(g.entry),
              entry, stop: f(g.stop), r0: +r0.toFixed(M.dec + 1), t1: null, trail: P.trail, be: M.aRule ? null : P.be, stop0: f(g.stop), t2: f(entry + s * P.mark * r0), opened: now, checked: frontier, status: 'open', R: null, size: sizeOf(g, key),
              sweep: { t: g.sweepT, level: f(g.swept) }, fvg: g.fvg.map(f), ih: g.ih == null ? null : f(g.ih), dol: g.dol == null ? null : f(g.dol), valid: g.valid,
              feat: g.feat, grade: { ...g.grade, letter: letter(g.grade.total) }, aset: true, aplus: isAPlus(g, key), ...(v === 'h1opp' ? { mH1: h1Trend(g, H, ctx.ms) } : {}) });
          }
          delete V.errors[key];
        } catch (e) { V.errors[key] = String(e.message || e); }
      }
    } catch (e) { snap.errors[key] = String(e.message || e); }
    await sleep(800);
  }
  const C = trades.filter((x) => x.closed);
  snap.totals = { n: C.length, wins: C.filter((x) => x.R > 0).length, R: +C.reduce((a, x) => a + x.R, 0).toFixed(2), open: trades.filter((x) => x.status === 'open').length };
  save('trades.json', trades.slice(-3000)); save('snapshot.json', snap); save('bars.json', bars);
  { const SC = shadow.trades.filter((x) => x.closed); shadow.at = snap.at;
    shadow.totals = { n: SC.length, wins: SC.filter((x) => x.R > 0).length, R: +SC.reduce((a, x) => a + x.R, 0).toFixed(2), open: shadow.trades.filter((x) => x.status === 'open').length };
    shadow.trades = shadow.trades.slice(-3000);
    for (const v of VARIANTS) { const V = shadow.variants[v], VC = V.trades.filter((x) => x.closed);
      V.totals = { n: VC.length, wins: VC.filter((x) => x.R > 0).length, R: +VC.reduce((a, x) => a + x.R, 0).toFixed(2), open: V.trades.filter((x) => x.status === 'open').length };
      V.trades = V.trades.slice(-3000); }
    save('shadow.json', shadow); }
  console.log(JSON.stringify(snap.totals), Object.keys(snap.errors).length ? snap.errors : 'no errors');
}
if (process.argv[1] && process.argv[1].endsWith('tracker.mjs')) main().catch((e) => { console.error(e); process.exit(1); });
