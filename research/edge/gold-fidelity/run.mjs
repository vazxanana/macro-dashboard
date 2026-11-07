// Edge research · gold-fidelity (8 Nov 2026): the forward (live paper) record of the gold replica, Mosha BO, Gold trend (N20 + add),
// Gold trend fast, Gold H4 trendline and Gold daily engulf, against a replay of the SAME live code on OANDA XAU/USD candles for the
// same days, managed candle by candle with the Trader's own step (council/fills.mjs manageLive / expireOrder / sizeR, the pure form
// of trader.mjs "Manage open trades"; tests/fills-live.test.mjs holds the two together).
//   node research/edge/gold-fidelity/run.mjs <council-data dir> [outDir]      env: CANDLES=<dir>  FROM=2026-11-03T00:00:00Z  MD_BASE
// Reads <cdata>/trades.json, research.json, snapshot.json, config.json, research/replay-2w.json. Candles: xau-<tf>.json[.gz] rows
// [t,o,h,l,c] in CANDLES (1m, 5m, 1h, 4h, 1d; 15m / 30m are built from 1m as the proxy would serve them); a missing file is fetched
// from the site's /md/bars proxy and saved there. Writes <outDir>/result.json and prints the diff table.
// Replay: one run every minute (the live loop runs every ~4-6 min at arbitrary seconds), the Trader's view = the last 720 candles of
// every timeframe (719 closed + the forming one, built from 1m), price = the last 1m close. Signal code: the gold system blocks are
// the live blocks line for line (as research/edge/gold-systems-oos/replay.mjs); replicaSignals / msnrDirection are lifted verbatim
// out of trader.mjs at run time (research/edge/gold-systems/live.mjs). Each system enters only after its live start (config history),
// earlier would-be entries are kept as preLive rows for the record. Live gates of the current config apply to the replica.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { msAnalyze } from '../../../council/engine.mjs';
import { manageLive, expireOrder, sizeR, spotSkip, spotRollover, spotClosed, stopFill, exitR, driftR, tradeCost, spreadOf } from '../../../council/fills.mjs';
import { LIVE } from '../gold-systems/live.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CD = process.argv[2] || 'data', OUT = process.argv[3] || here;
const CANDLES = process.env.CANDLES || path.join(here, 'candles'), MD = process.env.MD_BASE || 'https://meridianx.dev/md/';
const FROM = Date.parse(process.env.FROM || '2026-11-03T00:00:00Z') / 1000;
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(CD, f), 'utf8')); } catch (e) { return d; } };
const iso = (t) => t == null ? '-' : new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const f2 = (v) => v == null ? null : +(+v).toFixed(2);
const M = { label: 'XAU/USD', name: 'Gold', group: 'Metals', dec: 1, spot: true }, key = 'xau', dp = 2;
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '30m': 6 * 3600, '15m': 3 * 3600 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── council-data ───
const T = rd('trades.json', []), trades = Array.isArray(T) ? T : T.trades || [];
const RS = rd('research.json', []), research = Array.isArray(RS) ? RS : RS.research || [];
const snapshot = rd('snapshot.json', {}), config = rd('config.json', {});
const replay2w = rd('research/replay-2w.json', { trades: [] });
const hist = config.history || [];
const at = (re) => { const h = hist.find((x) => re.test(x.change || '')); return h ? Date.parse(h.at) / 1000 : null; };
// when each system started trading live on paper (the live record can only hold trades from then on)
const LIVE_AT = { replica: at(/^Gold replica live \(v4\)/), replicaOff: at(/^Gold research only/), replicaOn: at(/^Gold replica trades live again/),
  'mosha-bo': at(/^Gold: Mosha's breakout system/), gtrend: at(/^Gold trend \(new paper system\)/), gtl: at(/^Gold H4 trendline \(new paper system/),
  geg: at(/^Gold daily engulf \(new paper system/), gtrend5: at(/^Gold trend fast \(new paper leg\)/), gtrend5Shadow: at(/^Gold trend fast \(5-day breakout\) to shadow/),
  replicaRulesSettled: at(/^Gold replica: the second unit now opens at \+1\.5R/) };
const LIVE_OANDA_CANDLES_SINCE = Date.parse('2026-11-07T19:00:06Z') / 1000;   // council/fidelity.mjs: the Trader trades gold on OANDA candles since then; Kraken PAXG + basis before
const liveOn = (k, t) => k === 'replica' ? LIVE_AT.replica != null && t >= LIVE_AT.replica && !(t >= LIVE_AT.replicaOff && t < LIVE_AT.replicaOn) : LIVE_AT[k] != null && t >= LIVE_AT[k];

// ─── candles ───
async function range(tf, sec, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) {
    const b = Math.min(b0, a + 4999 * sec); let j = null, err = null;
    for (let k = 0; k < 4 && !j; k++) {
      try { const r = await fetch(`${MD}bars?sym=xau&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(1500 * (k + 1));
    }
    if (!j) throw new Error(`xau ${tf} ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
const WARM = { '1m': 2 * 86400, '5m': 4 * 86400, '1h': 35 * 86400, '4h': 130 * 86400, '1d': 760 * 86400 };
async function loadTF(tf, sec) {
  for (const f of [`xau-${tf}.json.gz`, `xau-${tf}.json`]) { const p = path.join(CANDLES, f); if (fs.existsSync(p)) { let raw = fs.readFileSync(p); if (f.endsWith('.gz')) raw = zlib.gunzipSync(raw); return JSON.parse(raw).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })); } }
  console.error(`${tf}: fetching from ${MD}`);
  const rows = await range(tf, sec, FROM - WARM[tf], Math.floor(Date.now() / 60) * 60);
  fs.mkdirSync(CANDLES, { recursive: true }); fs.writeFileSync(path.join(CANDLES, `xau-${tf}.json.gz`), zlib.gzipSync(JSON.stringify(rows)));
  return rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
}
function aggregate(bars, sec) { const out = []; let cur = null; for (const b of bars) { const t = Math.floor(b.time / sec) * sec; if (!cur || cur.time !== t) { cur = { time: t, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); } else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } } return out; }
const data = {};
for (const [tf, sec] of [['1m', 60], ['5m', 300], ['1h', 3600], ['4h', 14400], ['1d', 86400]]) data[tf] = await loadTF(tf, sec);
data['15m'] = aggregate(data['1m'], 900); data['30m'] = aggregate(data['1m'], 1800);
const m1 = data['1m'], lastT = m1.at(-1).time + 60;
const TFS = [['1d', 86400], ['4h', 14400], ['1h', 3600], ['30m', 1800], ['15m', 900], ['5m', 300], ['1m', 60]], WIN = 720;
const m1At = new Map(m1.map((b) => [b.time, b]));
const closeAt = (t) => { for (let k = 0; k < 30; k++) { const b = m1At.get(Math.floor(t / 60) * 60 - k * 60); if (b) return b.close; } return null; };   // the 1m close the Trader read at run time t (its last closed or forming candle)
console.error('candles', Object.fromEntries(Object.entries(data).map(([k, v]) => [k, `${v.length} ${iso(v[0].time)}..${iso(v.at(-1).time)}`])));

// ─── the Trader's view at time t ───
const ptr = Object.fromEntries(TFS.map(([id]) => [id, 0]));
let i1 = 0;   // 1m candles closed by t
function view(t) {
  const src = {};
  for (const [id, sec] of TFS) {
    const arr = data[id]; let p = ptr[id]; while (p < arr.length && arr[p].time + sec <= t) p++; ptr[id] = p;
    const bars = arr.slice(Math.max(0, p - (WIN - 1)), p);
    if (id !== '1m') { const f0 = Math.floor(t / sec) * sec; let f = null; for (let j = i1 - 1; j >= 0 && m1[j].time >= f0; j--) { const b = m1[j]; f = f ? { time: f0, open: b.open, high: Math.max(f.high, b.high), low: Math.min(f.low, b.low), close: f.close } : { time: f0, open: b.open, high: b.high, low: b.low, close: b.close }; } if (f) bars.push(f); }
    if (bars.length < 60) return null;
    src[id] = { bars, A: msAnalyze(bars, 6) };
  }
  return src;
}
const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
const nyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
const nyParts = (t) => { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { m: +o.hour * 60 + +o.minute, wd: o.weekday }; };
const pxr = (v) => +v.toFixed(dp);

// ─── the replay's books ───
const book = [], done = [], rrows = [], chains = [], seenSig = new Set(), ids = new Set(), skipped = { rollover: 0, shut: 0, rolloverTouch: 0 };
const push = (tr) => { ids.add(tr.id); book.push(tr); return tr; };
const isLive = (x) => x.status === 'open' || x.status === 'pending';
// the live research rows' own management (trader.mjs "Research ... manage open Daily Cycle trades": stopFill, 2R, 48 h; no spotSkip)
function manageResearch(r, b) {
  const s = r.side === 'sell', r0 = Math.abs(r.entry - r.stop);
  if (s ? b.high >= r.stop : b.low <= r.stop) { const px = stopFill(b, s, r.stop, b.time > r.filled); r.status = 'loss'; r.R = px === r.stop ? -1 : exitR(s, r.entry, px, r0); r.closed = b.time; r.exitPx = px; return true; }
  if (s ? b.low <= r.t1 : b.high >= r.t1) { r.status = 'win'; r.R = +((Math.abs(r.t1 - r.entry)) / r0).toFixed(2); r.closed = b.time; r.exitPx = r.t1; return true; }
  if (b.time >= r.filled + 48 * 3600) { const R = +((s ? r.entry - b.close : b.close - r.entry) / r0).toFixed(2); r.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; r.R = R; r.closed = b.time; r.exit = '48 h'; r.exitPx = b.close; return true; }
  return false;
}
function manageBook(b) {
  const skip = spotSkip(b.time);
  if (skip) { if (spotRollover(b.time)) skipped.rollover++; else skipped.shut++; }
  for (const tr of book) {
    if (b.time < tr.checked) continue;
    if (skip) { const s = tr.side === 'sell'; if (tr.status === 'open' && (s ? b.high >= tr.stop : b.low <= tr.stop)) { skipped.rolloverTouch++; (tr.skippedTouch = tr.skippedTouch || []).push(b.time); } continue; }
    const r = manageLive(tr, b, { be: config.be || null });
    if (r === 'exit') { sizeR(tr); tr.cost = tradeCost(tr, M, {}); }
    else if (r && r.add && !ids.has(r.add.id)) { r.add.note = 'add'; r.add.preLive = tr.preLive; push(r.add); }
  }
  for (const r of rrows) if (r.status === 'open' && b.time >= r.checked) manageResearch(r, b);
}
function sweep(now) {
  for (const tr of book) if (expireOrder(tr, now, WAIT[tr.h])) tr.cost = null;
  for (let k = book.length - 1; k >= 0; k--) if (!isLive(book[k])) done.push(book.splice(k, 1)[0]);
}

// ─── system blocks (the live blocks of trader.mjs, same order as live) ───
const seenRp = new Set();
function replicaBlock(src, price, now) {
  // volatility gate (gold-adaptive-gate), 20-day range vs the top fifth of its own last 365 daily candles
  const dvb = src['1d'].bars.slice(-21, -1), volPct = dvb.length >= 15 ? dvb.reduce((a, b) => a + (b.high - b.low) / b.close * 100, 0) / dvb.length : null;
  let goldP = null;
  if (config.goldVolPct) { const db = src['1d'].bars.slice(0, -1), rr = db.map((b) => (b.high - b.low) / b.close * 100), ser = []; for (let i = 20; i <= rr.length; i++) ser.push(rr.slice(i - 20, i).reduce((a, v) => a + v, 0) / 20); const past = ser.slice(-367, -2).sort((a, b) => a - b); goldP = past.length >= 200 ? +past[Math.floor(config.goldVolPct / 100 * (past.length - 1))].toFixed(3) : null; }
  const volOk = (!config.goldVolMin && !config.goldVolPct) || (volPct != null && ((config.goldVolMin != null && volPct >= config.goldVolMin) || (goldP != null && volPct >= goldP)));
  state.gate = { volPct: f2(volPct), goldP };
  if (!marketOpen(now)) return;
  let sigs = []; try { sigs = LIVE.replicaSignals(src); } catch (e) { return; }
  let msnrDir = 0; try { msnrDir = LIVE.msnrDirection(src['4h'].bars.slice(0, -1), src['1d'].bars.slice(0, -1)); } catch (e) { msnrDir = 0; }
  const msnrOf = (sell) => msnrDir === 0 ? 'none' : msnrDir === (sell ? -1 : 1) ? 'with' : 'against';
  for (const g of sigs) {
    const sig = `replica|${g.sell ? 's' : 'b'}|${g.tc}`;
    if (seenRp.has(sig)) continue;
    const entry = price, buf = Math.max(0.1 * g.atr, 0.3), stop0 = g.sell ? g.ext + buf : g.ext - buf, r00 = Math.abs(entry - stop0);
    if (!(r00 > 0) || (g.sell ? entry >= stop0 : entry <= stop0)) continue;
    seenRp.add(sig);
    let stop = stop0; { const rn = g.sell ? Math.ceil(stop0 / 10) * 10 : Math.floor(stop0 / 10) * 10; if (Math.abs(stop0 - rn) <= 2) stop = g.sell ? rn + 0.5 : rn - 0.5; }
    const r0 = Math.abs(entry - stop);
    const h1live = src['1h'].A.events.filter((e) => e.endIdx == null && e.top > e.bot), h1clear = !h1live.some((e) => entry <= e.top && entry >= e.bot);
    const riskAtr = r00 / g.atr, pass = (h1clear || g.star) && riskAtr >= 1, t1 = entry + (g.sell ? -2 : 2) * r0;
    const lag = now - g.tc - 300, stale = lag > 480, drift = driftR(g.sell ? 'sell' : 'buy', g.cc, entry, stop0);
    const h4 = src['4h'].A.trend === (g.sell ? 1 : -1) ? 'against' : src['4h'].A.trend === (g.sell ? -1 : 1) ? 'with' : 'none', v5 = pass && h4 === 'against';
    const d1w = src['1d'].A.trend === (g.sell ? -1 : 1), dirOk = !config.goldD1With || d1w;
    const capped = book.filter((x) => x.k === 'replica' && !x.shadow && x.status === 'open' && !x.addOf).length >= 3;
    const liveRp = done.filter((x) => x.k === 'replica' && !x.shadow && x.R != null && x.closed), dayR = liveRp.filter((x) => Math.floor(x.closed / 86400) === Math.floor(now / 86400)).reduce((a, x) => a + x.R, 0), dayStop = dayR <= -1.5;
    let size = 1;
    { const first = Math.min(...trades.filter((x) => x.k === 'replica' && x.market === key && !x.shadow && x.R != null).map((x) => x.opened), Infinity);
      const h = replay2w.trades.filter((x) => x.market === key && x.k === 'replica' && x.R != null && x.closed < first).concat(trades.filter((x) => x.k === 'replica' && x.market === key && !x.shadow && x.R != null && x.closed && x.closed <= now).map((x) => ({ R: x.rawR != null ? x.rawR : x.R, closed: x.closed }))).sort((a, b) => a.closed - b.closed);
      if (h.length > 50) { let e = 0; const eq = h.map((x) => (e += x.R)); const avg = eq.slice(-50).reduce((a, v) => a + v, 0) / 50; if (eq.at(-1) < avg) size = 0.5; } }
    if (config.replicaMsnrSize) { const m = msnrOf(g.sell); if (m === 'against') size *= config.replicaMsnrSize.against; else if (m === 'with') size *= config.replicaMsnrSize.with; }
    const ny = nyParts(now), newsVeto = !!config.goldNewsVeto && !['Sat', 'Sun'].includes(ny.wd) && config.goldNewsVeto.some(([a, b]) => ny.m >= a && ny.m <= b);
    const row = { id: `${key}-replica-${now}-${g.sell ? 's' : 'b'}`, sig, tc: g.tc, k: 'replica', lag, side: g.sell ? 'sell' : 'buy', entry: pxr(entry), stop: pxr(stop), stop0: pxr(stop0), t1: pxr(t1), rr: 2, opened: now, filled: now, checked: now, status: 'open', R: null, drift,
      pass, v5, h4, h1clear, msnr: msnrOf(g.sell), star: g.star, riskAtr: +riskAtr.toFixed(2), ext: +g.ext.toFixed(2), chochLevel: +g.lvl.toFixed(2), d1: d1w ? 'with' : 'against', vol: f2(volPct), goldP, size,
      flags: { capped: v5 && capped, dayStop: v5 && dayStop, stale: v5 && stale, calm: v5 && !volOk, d1Skip: v5 && !dirOk, news: v5 && newsVeto } };
    rrows.push(row);
    const take = v5 && volOk && dirOk && !capped && !dayStop && !stale && !newsVeto && (config.replicaLive || []).includes(key);
    if (take) { const e = pxr(entry), st = pxr(stop), r = Math.abs(e - st);
      push({ id: row.id, market: key, label: M.label, dec: M.dec, k: 'replica', name: 'Replica', pair: 'M5 CHoCH', h: '5m', side: row.side, entry: e, stop: st, t1: pxr(entry + (g.sell ? -10 : 10) * r), rr: 10, trail: [2, 2], size, buf: 0.15, opened: now, filled: now, checked: now, status: 'open', R: null, r0: r, maxHold: 48 * 3600, noBe: true, entryMode: 'market', lag, drift,
        ...(config.goldFixedR ? { t1: pxr(entry + (g.sell ? -1 : 1) * config.goldFixedR * r), rr: config.goldFixedR, trail: undefined, tp1: undefined } : {}), ...(config.goldBeR ? { beAt: config.goldBeR } : {}),
        ...(config.goldRun ? { t1: pxr(entry + (g.sell ? -10 : 10) * r), rr: 10, trail: [config.goldRun.atR, config.goldRun.trail], runAfter: config.goldRun.atR } : {}), ...(config.goldAdd ? { addAt: config.goldAdd.atR, addSize: config.goldAdd.size } : {}),
        feat: { d1: row.d1, h4, msnr: row.msnr, star: g.star, h1clear, riskAtr: row.riskAtr }, shadow: false, blockedBy: [], preLive: !liveOn('replica', now), rulesSettled: now >= (LIVE_AT.replicaRulesSettled || 0) }); }
  }
}
function moshaBlock(src, price, now) {
  const ev = (id, sec) => { const bb = src[id].bars; return src[id].A.events.filter((e) => e.breakIdx < bb.length - 1).map((e) => ({ t: bb[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure })); };
  const E3 = ev('15m', 900), E2 = ev('1h', 3600), E1 = ev('4h', 14400), e3 = E3.at(-1);
  const before = (E, t) => E.filter((e) => e.t <= t).at(-1);
  // weekly structure: live reads CNBC XAU= daily (fallback: the feed's D1 candles); here OANDA D1, the fallback path
  const dly = src['1d'].bars, wk = [];
  for (const b of dly) { const k = Math.floor((b.time - 345600) / 604800) * 604800 + 345600, c = wk.at(-1); if (!c || c.time !== k) wk.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } }
  const wEv = msAnalyze(wk, 3).events.map((e) => ({ t: wk[e.breakIdx].time + 604800, dir: e.dir })).filter((e) => e.t <= now);
  const w1At = (t) => (before(wEv, t) || { dir: 0 }).dir;
  state.goldW1 = w1At(now) || null;
  // diagnostic: OANDA's D1 series has a Sunday-dated stub (the 22:00 UTC reopen); in Monday-aligned weeks it lands in the PREVIOUS
  // week and moves that week's close. The same weeks without the stub, for the comparison with the live CNBC spot days.
  { const wk2 = []; for (const b of dly) { if (new Date(b.time * 1000).getUTCDay() === 0) continue; const k = Math.floor((b.time - 345600) / 604800) * 604800 + 345600, c = wk2.at(-1); if (!c || c.time !== k) wk2.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } }
    const ev2 = msAnalyze(wk2, 3).events.map((e) => ({ t: wk2[e.breakIdx].time + 604800, dir: e.dir })).filter((e) => e.t <= now); state.goldW1NoStub = (before(ev2, now) || { dir: 0 }).dir || null; }
  const okW = (e) => config.moshaBoWeekly ? w1At(e.t) === e.dir : e.flip;
  if (e3 && now - e3.t <= 3600) {
    const e2 = before(E2, e3.t), e1 = before(E1, e3.t), d = e3.dir, id = `xau-moshabo-${e3.t}`;
    if (e1 && e2 && e1.dir === d && e2.dir === -d && e2.t > e1.t && !ids.has(id)) {
      const entry = +e3.level.toFixed(2), stop = +(d < 0 ? e3.top + 0.3 : e3.bot - 0.3).toFixed(2), r0 = Math.abs(entry - stop);
      const openBo = book.filter((x) => x.k === 'mosha-bo' && !x.shadow && isLive(x)).length;
      let pull = null; try { const hb = src['1h'].bars, i2 = hb.findIndex((b) => b.time >= e2.t); let ext = d < 0 ? Infinity : -Infinity, iE = i2; for (let i = Math.max(0, i2); i < hb.length && hb[i].time < e3.t; i++) { if (d < 0 ? hb[i].low < ext : hb[i].high > ext) { ext = d < 0 ? hb[i].low : hb[i].high; iE = i; } } pull = i2 < 0 || !isFinite(ext) ? null : hb.filter((b) => b.time > hb[iE].time && b.time < e3.t).length; } catch (e) { pull = null; }
      const blk = [!okW(e3) && 'weekly', openBo >= 2 && 'cap', !(d < 0 ? price < stop : price > stop) && 'price', !!(config.moshaSlow && pull != null && pull < config.moshaSlow) && 'momentum'].filter(Boolean);
      if (r0 > 0.5) { const tr = push({ id, market: key, label: M.label, dec: M.dec, k: 'mosha-bo', name: 'Mosha BO system', pair: 'H4 → H1 → M15', h: '15m', side: d < 0 ? 'sell' : 'buy', entry, stop, t1: +(entry + d * 3 * r0).toFixed(2), rr: 3, buf: 0.15, opened: now, checked: now, status: 'pending', R: null, r0, validFor: 24 * 3600, maxHold: 72 * 3600, noBe: true, entryMode: 'limit',
        ...(config.moshaBeR ? { beAt: config.moshaBeR } : {}), ...(config.moshaAdd ? { addAt: config.moshaAdd.atR, addSize: config.moshaAdd.size } : {}), ...(config.moshaRun ? { t1: +(entry + d * 10 * r0).toFixed(2), rr: 10, tp1: +(entry + d * config.moshaRun.atR * r0).toFixed(2), trail: [config.moshaRun.atR, config.moshaRun.trail] } : {}),
        feat: { h4At: e1.t, h1At: e2.t, m15At: e3.t, w1: w1At(e3.t) === d ? 'with' : 'against', m15Flip: !!e3.flip, pull }, shadow: blk.length > 0, blockedBy: blk, preLive: !liveOn('mosha-bo', now), price });
        chains.push(tr); }
    }
  }
}
const state = {};
function trendBlocks(src, price, now) {
  for (const LEG of [{ cfg: config.goldTrend, k: 'gtrend', name: 'Gold trend', snap: 'goldTrend' }, { cfg: config.goldTrendFast, k: 'gtrend5', name: 'Gold trend fast', snap: 'goldTrendFast' }]) if (LEG.cfg) {
    const GT = LEG.cfg, D = src['1d'].bars.slice(0, -1), n = D.length, last = D[n - 1];
    const tr14 = (i) => Math.max(D[i].high - D[i].low, Math.abs(D[i].high - D[i - 1].close), Math.abs(D[i].low - D[i - 1].close));
    const atr14 = (i) => { let a = 0; for (let j = i - 13; j <= i; j++) a += tr14(j); return a / 14; };
    const sh = LEG.k === 'gtrend5' && LIVE_AT.gtrend5Shadow != null && now >= LIVE_AT.gtrend5Shadow;
    const open = book.find((x) => x.k === LEG.k && (!x.shadow || (x.blockedBy || []).includes('owner-shadow')) && x.status === 'open' && !x.addOf);
    if (n > GT.n + 15) {
      if (open) {
        const gAdd = book.find((x) => x.addOf === open.id && x.status === 'open');
        if (last.time > (open.lastD || 0)) { const ns = +(last.close - GT.k * atr14(n - 1)).toFixed(dp); if (ns > open.stop) { open.stop = ns; open.trailMoved = true; } if (gAdd && ns > gAdd.stop) { gAdd.stop = ns; gAdd.trailMoved = true; } open.lastD = last.time;
          if (config.goldTrendAdd && !gAdd && !ids.has(`${open.id}-add`) && last.close - open.entry >= config.goldTrendAdd.atR * open.r0) { const ae = +price.toFixed(dp), rA = ae - open.stop;
            if (rA > 0) push({ id: `${open.id}-add`, market: key, label: M.label, dec: M.dec, k: LEG.k, name: `${LEG.name} add`, pair: open.pair, h: '1d', side: 'buy', entry: ae, stop: open.stop, t1: +(ae * 100).toFixed(2), rr: 99, trail: [1e6, 0], size: 1, buf: 0.15, opened: now, filled: now, checked: now, status: 'open', R: null, r0: rA, noBe: true, entryMode: 'market', addOf: open.id, shadow: !!open.shadow, blockedBy: open.shadow ? ['owner-shadow'] : [], preLive: open.preLive }); } }
      } else {
        const hi = Math.max(...D.slice(n - 1 - GT.n, n - 1).map((b) => b.high)), A = atr14(n - 1), id = `${key}-${LEG.k}-${last.time}`;
        if (last.close > hi && A > 0 && !ids.has(id) && now - (last.time + 86400) < 86400) { const entry = +price.toFixed(dp), stop = +(entry - GT.k * A).toFixed(dp), r0 = entry - stop;
          if (r0 > 0) push({ id, market: key, label: M.label, dec: M.dec, k: LEG.k, name: LEG.name, pair: `D1 ${GT.n}-day breakout`, h: '1d', side: 'buy', entry, stop, t1: +(entry * 100).toFixed(2), rr: 99, trail: [1e6, 0], buf: 0.15, opened: now, filled: now, checked: now, status: 'open', R: null, r0, noBe: true, entryMode: 'market', lastD: last.time, drift: driftR('buy', last.close, entry, stop), feat: { hi: +hi.toFixed(2), atr: +A.toFixed(2) }, shadow: sh, blockedBy: sh ? ['owner-shadow'] : [], preLive: !liveOn(LEG.k, now) }); }
      }
    }
    state[LEG.snap] = { hi20: n > GT.n ? +Math.max(...D.slice(n - 1 - GT.n, n - 1).map((b) => b.high)).toFixed(2) : null, lastClose: last && last.close, open: !!open, stop: open ? open.stop : null };
  }
  if (config.goldTL) {
    const TL = config.goldTL, H = src['4h'].bars.slice(0, -1), D = src['1d'].bars.slice(0, -1), n = H.length, last = H[n - 1];
    const open = book.find((x) => x.k === 'gtl' && !x.shadow && isLive(x));
    const piv = []; for (let i = TL.n; i < n - TL.n; i++) { let ok = true; for (let k = i - TL.n; k <= i + TL.n && ok; k++) if (k !== i && H[k].high >= H[i].high) ok = false; if (ok) piv.push([i, H[i].high]); }
    let st = { line: null };
    if (piv.length >= 2) { const [a, pa] = piv[piv.length - 2], [b, pb] = piv[piv.length - 1];
      if (pb < pa && b - a <= TL.span && n - 1 > b + TL.n) { const slope = (pb - pa) / (b - a), lv = pa + slope * (n - 1 - a), id = `${key}-gtl-${H[a].time}-${H[b].time}`;
        st = { line: +lv.toFixed(2), a: H[a].time, b: H[b].time, lastClose: last.close, traded: ids.has(id) };
        if (!open && last.close > lv && !st.traded && now - (last.time + 14400) < 3600) { const dir = LIVE.msnrDirection(H, D, TL.n4, 2); st.dir = dir;
          if (dir === 1) { const entry = +price.toFixed(dp), lo = Math.min(...H.slice(b).map((x) => x.low)), stop = +(lo - TL.pad).toFixed(dp), r0 = entry - stop;
            if (r0 > 0) push({ id, market: key, label: M.label, dec: M.dec, k: 'gtl', name: 'Gold H4 trendline', pair: 'H4 trendline break', h: '4h', side: 'buy', entry, stop, t1: +(entry + 10 * r0).toFixed(dp), tp1: +(entry + 2 * r0).toFixed(dp), rr: 10, trail: [2, 1], buf: 0.15, opened: now, filled: now, checked: now, status: 'open', R: null, r0, maxHold: TL.hold * 3600, noBe: true, entryMode: 'market', drift: driftR('buy', last.close, entry, stop), feat: { line: +lv.toFixed(2), anchors: [+pa.toFixed(2), +pb.toFixed(2)], lo: +lo.toFixed(2) }, shadow: false, blockedBy: [], preLive: !liveOn('gtl', now) }); }
          else st.blocked = 'direction'; } } }
    state.goldTL = { ...st, open: !!open, stop: open ? open.stop : null };
  }
  if (config.goldEG) {
    const EG = config.goldEG, D = src['1d'].bars.slice(0, -1), n = D.length, last = D[n - 1];
    const mine = book.concat(done).filter((x) => x.k === 'geg' && !x.shadow);
    for (const tr of mine.filter((x) => x.status === 'pending')) if (tr.zone && last.time > (tr.lastD || 0) && last.close < tr.zone[0]) { tr.status = 'expired'; tr.closed = now; tr.R = 0; tr.exit = 'zone failed'; }
    for (const tr of mine.filter((x) => x.status === 'pending')) tr.lastD = last.time;
    let st = { lastClose: last && last.close };
    if (n > EG.sma + EG.k + 2) { const sma = D.slice(n - EG.sma).reduce((a, b) => a + b.close, 0) / EG.sma, up = last.close > sma; st.sma = +sma.toFixed(2); st.up = up;
      let base = null; if (last.close > last.open) for (let j = n - 2; j >= n - 1 - EG.k && j >= 0; j--) { const b = D[j]; if (b.open > b.close) { if (last.close > b.high) base = b; break; } if (b.close < b.open) break; }
      st.zone = base ? [base.low, base.high] : null;
      const id = base ? `${key}-geg-${base.time}` : null, openCnt = mine.filter(isLive).length;
      if (base && up && !ids.has(id) && now - (last.time + 86400) < 86400 && openCnt < EG.maxOpen) { const entry = +base.high.toFixed(dp), stop = +(base.low - EG.pad).toFixed(dp), r0 = entry - stop;
        if (r0 > 0 && price > entry) push({ id, market: key, label: M.label, dec: M.dec, k: 'geg', name: 'Gold daily engulf', pair: 'D1 engulf zone', h: '1d', side: 'buy', entry, stop, t1: +(entry + 10 * r0).toFixed(dp), tp1: +(entry + 2 * r0).toFixed(dp), rr: 10, trail: [2, 1], buf: 0.15, opened: now, checked: now, status: 'pending', R: null, r0, validFor: EG.life * 86400, maxHold: EG.hold * 3600, noBe: true, entryMode: 'limit', zone: [+base.low.toFixed(dp), +base.high.toFixed(dp)], lastD: last.time, feat: { sma: +sma.toFixed(2), conf: last.close }, shadow: false, blockedBy: [], preLive: !liveOn('geg', now), price }); }
      else if (base && !up) st.blocked = 'below 20-day average'; }
    state.goldEG = { ...st, pending: mine.filter((x) => x.status === 'pending').map((x) => x.entry), open: mine.filter((x) => x.status === 'open').length };
  }
}

// ─── the run: every minute from FROM to the last candle ───
let steps = 0; const t0 = Date.now();
while (i1 < m1.length && m1[i1].time < FROM) i1++;
for (let t = FROM; t <= lastT; t += 60) {
  while (i1 < m1.length && m1[i1].time + 60 <= t) { manageBook(m1[i1]); i1++; }   // the 1m candle closed at t, for every trade opened before it
  sweep(t);
  if (i1 < WIN) continue;
  const src = view(t); if (!src) continue;
  steps++;
  const price = src['1m'].bars.at(-1).close;
  state.trend = { '1d': src['1d'].A.trend, '4h': src['4h'].A.trend, '1h': src['1h'].A.trend };
  replicaBlock(src, price, t);
  trendBlocks(src, price, t);
  moshaBlock(src, price, t);
}
sweep(lastT);
// gold's trading day on OANDA: 1m candles in the window by New York hour 17 and 18 (the 17:00-17:14 rollover skip only matters where candles print)
{ const hr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }); const cnt = { ny17: 0, ny18: 0, all: 0 };
  for (const b of m1) { if (b.time < FROM) continue; cnt.all++; const h = +hr.format(new Date(b.time * 1000)); if (h === 17) cnt.ny17++; if (h === 18) cnt.ny18++; } skipped.goldCandlesByNyHour = cnt; }
for (const tr of book) { tr.atEnd = true; const b = m1.at(-1); tr.floatR = tr.status === 'open' ? +(((tr.side === 'sell' ? tr.entry - b.close : b.close - tr.entry)) / tr.r0).toFixed(2) : null; }
const allTr = done.concat(book);
console.error(`${steps} steps, ${allTr.length} replay trade rows, ${rrows.length} replica signals, ${chains.length} Mosha chains (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

// ─── the live record for the same window ───
const SYS = new Set(['replica', 'mosha-bo', 'gtrend', 'gtrend5', 'gtl', 'geg']);
const liveTr = trades.filter((x) => x.market === key && SYS.has(x.k) && x.opened >= FROM && x.opened <= lastT + 86400);
const liveRs = research.filter((x) => x.market === key && x.k === 'replica' && !x.void && x.opened >= FROM && x.opened <= lastT);
// re-judge a live record's own levels on OANDA 1m candles from its own fill time, with the loop that managed it live
function rejudge(x, research) {
  const r = { ...x, status: x.filled ? 'open' : 'pending', R: null, closed: null, exit: undefined, exitPx: undefined, beMoved: false, trailMoved: false, mfe: 0, mae: 0, addDone: true, checked: x.filled || x.opened, stop: x.stop0 != null && !research ? x.stop : x.stop };
  if (r.stop0 != null && research) r.stop = x.stop;
  for (const b of m1) { if (b.time < r.checked) continue; if (research) { if (manageResearch(r, b)) break; } else { if (spotSkip(b.time)) continue; const v = manageLive(r, b, { be: null }); if (v === 'exit') break; } }
  if (!research) sizeR(r);
  return { status: r.status, R: r.R, closed: r.closed, exit: r.exit || r.exitKind || null, exitPx: r.exitPx ?? null };
}
const rows = [], cls = (c) => c;
// 1. live trades.json rows (replica live trades, the engulf order)
for (const L of liveTr) {
  const rs = research.find((x) => x.id === L.id), sig = rs && rs.sig;
  const P = L.k === 'replica' ? (sig ? rrows.find((x) => x.sig === sig) : null) : allTr.find((x) => x.id === L.id);
  const oa = closeAt(L.opened), spot = rejudge(L, false);
  const kraken = L.opened < LIVE_OANDA_CANDLES_SINCE;
  const row = { system: L.k, id: L.id, live: { side: L.side, opened: L.opened, filled: L.filled || null, entry: L.entry, stop: L.stop, t1: L.t1, status: L.status, R: L.R ?? null, Rnet: L.Rnet ?? null, costR: L.costR ?? null, closed: L.closed || null, exit: L.exit || L.exitKind || null, mode: L.entryMode || 'market', feed: kraken ? 'Kraken PAXG + basis' : 'OANDA' },
    oandaAtRun: oa, spot, replay: P ? { opened: P.opened, filled: P.filled || null, entry: P.entry, stop: P.stop, t1: P.t1, status: P.status, R: P.R ?? null, closed: P.closed || null, exit: P.exit || P.exitKind || null, preLive: !!P.preLive, flags: P.flags || null } : null };
  if (!P) { row.class = kraken ? 'feed' : 'rule'; row.note = L.k === 'replica' ? 'no replica CHoCH with this signal time on OANDA candles' : 'no such order in the replay'; }
  else {
    // a market entry is the run's price: live - OANDA-at-that-minute is the feed part, replay - OANDA-at-that-minute the timing part;
    // a limit order's level comes from the feed's daily candle, so its whole difference is feed
    const limit = (L.entryMode || 'market') === 'limit';
    row.diff = { entry: f2(L.entry - P.entry), stop: f2(L.stop - P.stop), feedEntry: limit ? f2(L.entry - P.entry) : oa != null ? f2(L.entry - oa) : null, timingEntry: limit ? 0 : oa != null && P.filled ? f2(P.entry - oa) : null, R: L.R != null && P.R != null ? f2(L.R - P.R) : null, exitSpot: spot.status !== L.status || (spot.R != null && L.R != null && Math.abs(spot.R - L.R) > 0.01) };
    const feedDom = row.diff.feedEntry != null && Math.abs(row.diff.feedEntry) >= Math.abs(row.diff.timingEntry ?? 0);
    row.class = Math.abs(row.diff.entry || 0) < 0.01 && Math.abs(row.diff.stop || 0) < 0.01 && !row.diff.exitSpot ? 'match' : row.diff.exitSpot ? 'feed' : feedDom ? 'feed' : 'timing';
    if (L.k === 'geg') row.note = `same order id; live levels are the Kraken PAXG + basis zone (placed ${iso(L.opened)}), the replay's are OANDA's; both unfilled by the Friday close (OANDA low since placement ${f2(Math.min(...m1.filter((b) => b.time >= L.opened).map((b) => b.low)))})`;
    if (L.k === 'replica') row.note = `signal ${sig} seen on both feeds; live traded under the rules of ${iso(L.opened)} (v4 live, 2R target, no gate)`;
  }
  rows.push(row);
}
// 2. live research.json replica signals: matched by sig (the CHoCH candle time), outcome re-judged on OANDA 1m with the research loop
const matchR = [];
for (const L of liveRs) {
  const P = rrows.find((x) => x.sig === L.sig), oa = closeAt(L.opened), spot = rejudge(L, true);
  matchR.push({ id: L.id, sig: L.sig, side: L.side, opened: L.opened, lag: L.lag, live: { entry: L.entry, stop: L.stop, t1: L.t1, pass: !!L.pass, v5: !!L.v5, h4: L.h4, d1: L.d1, msnr: L.msnr, status: L.status, R: L.R ?? null, closed: L.closed || null, exit: L.exit || null, flags: ['capped', 'dayStop', 'stale', 'calm', 'd1Skip', 'news'].filter((f) => L[f]) , vol: L.vol ?? null },
    oandaAtRun: oa, spot, replay: P ? { opened: P.opened, lag: P.lag, entry: P.entry, stop: P.stop, t1: P.t1, pass: P.pass, v5: P.v5, h4: P.h4, d1: P.d1, msnr: P.msnr, status: P.status, R: P.R, closed: P.closed || null, exit: P.exit || null, flags: Object.keys(P.flags).filter((f) => P.flags[f]), vol: P.vol } : null,
    diff: P ? { entry: f2(L.entry - P.entry), stop: f2(L.stop - P.stop), feedEntry: oa != null ? f2(L.entry - oa) : null, timingEntry: oa != null ? f2(P.entry - oa) : null, sameOutcome: P.status === L.status && (P.R == null || L.R == null || Math.abs(P.R - L.R) < 0.01), sameV5: !!P.v5 === !!L.v5, sameH4: P.h4 === L.h4, sameD1: P.d1 === L.d1, spotSameAsLive: spot.status === L.status && (spot.R == null || L.R == null || Math.abs(spot.R - L.R) < 0.01) } : null });
}
const unmatchedReplaySig = rrows.filter((x) => !liveRs.some((l) => l.sig === x.sig) && liveOn('replica', x.opened) && x.opened <= Math.max(...liveRs.map((l) => l.opened)));
// 3. replay rows after the system's live start with no live counterpart
for (const P of allTr.filter((x) => !x.addOf && !x.preLive && !liveTr.some((l) => l.id === x.id))) {
  const kraken = P.opened < LIVE_OANDA_CANDLES_SINCE;
  rows.push({ system: P.k, id: P.id, live: null, replay: { opened: P.opened, filled: P.filled || null, entry: P.entry, stop: P.stop, t1: P.t1, status: P.status, R: P.R ?? null, closed: P.closed || null, exit: P.exit || P.exitKind || null, shadow: !!P.shadow, blockedBy: P.blockedBy || [], flags: P.flags || null },
    class: P.k === 'mosha-bo' ? (kraken ? 'feed' : 'rule') : kraken ? 'feed' : 'rule', note: P.k === 'mosha-bo' ? `chain on OANDA structure events (${(P.blockedBy || []).join('+') || 'would trade live'}); the live Trader read Kraken PAXG candles then and recorded no chain, live or shadow` : 'replay row without a live record' });
}
// 4. items found by reading the code (no price row)
rows.push({ system: 'mosha-bo', id: 'add-shadow-flag', class: 'bug', note: 'trader.mjs (to 7 Nov) pushed every pyramid add with shadow: false, so a blocked (shadow) Mosha chain reaching +1.5R would have put its add on the live book, against the rule text ("kept as a shadow trade, not our system"). Found here by reading; fixed on main by #564 while this study ran; tests/fills-live.test.mjs pins it (the add inherits the parent\'s shadow flag and blockers).' });
rows.push({ system: 'replica', id: 'research-loop-no-spotSkip', class: 'rule', note: `research.json replica rows are managed by their own loop (stopFill, 2R, 48 h) without spotSkip or fillBarAmbiguous: on OANDA candles ${matchR.filter((m) => m.live.closed && spotSkip(m.live.closed)).length} of ${matchR.length} live research exits fell in a skipped window; the live book (manageLive) skips them.` });
rows.push({ system: 'all', id: 'cost-model', class: 'rule', note: 'research replays (replay-2w.json, gold-systems-oos) charge $0.30 a unit round trip; the live Rnet (fills.mjs tradeCost) charges the spread plus half a spread of slippage per market order: $0.45 for a market entry with a target exit, $0.60 with a stop exit. Replay rows here carry both (cost.costR vs 0.30 / r0).' });

const byClass = {}; for (const r of rows) byClass[r.class] = (byClass[r.class] || 0) + 1;
const stateCmp = { replay: { ...state, at: iso(lastT) }, snapshot: { at: snapshot.at, goldTrend: snapshot.goldTrend && snapshot.goldTrend.state, goldTrendFast: snapshot.goldTrendFast && snapshot.goldTrendFast.state, goldTL: snapshot.goldTL && snapshot.goldTL.state, goldEG: snapshot.goldEG && snapshot.goldEG.state, goldW1: snapshot.goldW1, goldW1Src: snapshot.goldW1Src, goldVol: snapshot.goldVol, goldVolP: snapshot.goldVolP, trend: snapshot.markets && snapshot.markets.xau && snapshot.markets.xau.trend } };
const cost30 = (x) => x.r0 ? +(0.3 / x.r0).toFixed(3) : null;
const out = { at: new Date().toISOString(), window: { from: iso(FROM), to: iso(lastT), steps }, candles: { source: 'OANDA XAU/USD mid (meridianx.dev/md/bars)', m1: m1.length, from: iso(m1[0].time), to: iso(m1.at(-1).time) },
  liveSince: Object.fromEntries(Object.entries(LIVE_AT).map(([k, v]) => [k, v ? iso(v) : null])), liveOandaCandlesSince: iso(LIVE_OANDA_CANDLES_SINCE),
  live: { trades: liveTr.map((x) => ({ id: x.id, k: x.k, side: x.side, opened: x.opened, filled: x.filled || null, entry: x.entry, stop: x.stop, t1: x.t1, status: x.status, R: x.R ?? null, Rnet: x.Rnet ?? null, closed: x.closed || null, exit: x.exit || x.exitKind || null, shadow: !!x.shadow })), researchSignals: liveRs.length, researchV5: liveRs.filter((x) => x.v5).length, moshaRows: trades.filter((x) => x.k === 'mosha-bo').length },
  replay: { trades: allTr.map(({ skippedTouch, ...x }) => ({ ...x, skippedTouch: skippedTouch || undefined, cost30: cost30(x) })), researchSignals: rrows.length, researchV5: rrows.filter((x) => x.v5).length, chains: chains.map((x) => ({ id: x.id, side: x.side, opened: x.opened, entry: x.entry, stop: x.stop, blockedBy: x.blockedBy, shadow: x.shadow, feat: x.feat, status: x.status, R: x.R, preLive: x.preLive })), skipped },
  replicaSignals: { matched: matchR.filter((m) => m.replay).length, liveOnly: matchR.filter((m) => !m.replay).length, replayOnly: unmatchedReplaySig.length,
    summary: (() => { const mm = matchR.filter((m) => m.replay), med = (a) => { const v = a.filter((x) => x != null).sort((p, q) => p - q); return v.length ? v[v.length >> 1] : null; };
      return { live: liveRs.length, liveV5: liveRs.filter((x) => x.v5).length, replay: rrows.length, replayV5: rrows.filter((x) => x.v5).length, entryDiffMedian: med(mm.map((m) => m.diff.entry)), feedPartMedianAbs: med(mm.map((m) => Math.abs(m.diff.feedEntry))), timingPartMedianAbs: med(mm.map((m) => Math.abs(m.diff.timingEntry))),
        sameOutcome: mm.filter((m) => m.diff.sameOutcome).length, sameV5: mm.filter((m) => m.diff.sameV5).length, sameH4: mm.filter((m) => m.diff.sameH4).length, sameD1: mm.filter((m) => m.diff.sameD1).length, liveExitReproducedOnSpot: matchR.filter((m) => m.diff && m.diff.spotSameAsLive).length, liveExitReproducedOnSpotAll: matchR.filter((m) => m.spot.status === m.live.status && (m.spot.R == null || m.live.R == null || Math.abs(m.spot.R - m.live.R) < 0.01)).length,
        liveR: f2(liveRs.reduce((a, x) => a + (x.R || 0), 0)), liveLevelsOnSpotR: f2(matchR.reduce((a, m) => a + (m.spot.R || 0), 0)), replaySignalsR: f2(rrows.reduce((a, x) => a + (x.R || 0), 0)), liveExitsInSkippedCandles: matchR.filter((m) => m.live.closed && spotSkip(m.live.closed)).length }; })(), rows: matchR, replayOnlyRows: unmatchedReplaySig.map((x) => ({ sig: x.sig, side: x.side, opened: x.opened, entry: x.entry, stop: x.stop, pass: x.pass, v5: x.v5, status: x.status, R: x.R })) },
  diff: { rows, byClass }, states: stateCmp };
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));

// ─── print ───
const md = [];
md.push(`| System | Record | Live (feed) | Replay on OANDA | Entry diff | Exit / R | Class |`, `|---|---|---|---|---|---|---|`);
for (const r of rows) {
  const L = r.live, P = r.replay;
  md.push(`| ${r.system} | ${r.id} | ${L ? `${L.side} ${L.mode} ${iso(L.opened)} e ${L.entry} s ${L.stop} → ${L.status}${L.R != null ? ` ${L.R}R` : ''} (${L.feed})` : L === null && P ? 'none' : 'n/a'} | ${P ? `${P.entry != null ? `e ${P.entry} s ${P.stop}` : ''} ${iso(P.opened)} → ${P.status}${P.R != null ? ` ${P.R}R` : ''}${P.shadow ? ` shadow (${P.blockedBy.join('+')})` : ''}` : r.replay === null && L ? 'none' : 'n/a'} | ${r.diff ? `${r.diff.entry >= 0 ? '+' : ''}${r.diff.entry} (feed ${r.diff.feedEntry}, timing ${r.diff.timingEntry})` : '-'} | ${r.diff ? `spot re-judge: ${r.spot.status}${r.spot.R != null ? ` ${r.spot.R}R` : ''}${r.diff.R != null ? `; R diff ${r.diff.R}` : ''}` : '-'} | **${r.class}** |`);
}
console.log(md.join('\n'));
console.log('\nby class', JSON.stringify(byClass));
console.log(`\nreplica research signals: live ${liveRs.length} (v5 ${liveRs.filter((x) => x.v5).length}), replay ${rrows.length} (v5 ${rrows.filter((x) => x.v5).length}); matched ${out.replicaSignals.matched}, live-only ${out.replicaSignals.liveOnly}, replay-only ${unmatchedReplaySig.length}`);
const mm = matchR.filter((m) => m.replay);
const med = (a) => { const v = a.filter((x) => x != null).sort((p, q) => p - q); return v.length ? v[v.length >> 1] : null; };
console.log(`  matched: entry diff live-replay median ${med(mm.map((m) => m.diff.entry))}, |feed part| median ${med(mm.map((m) => Math.abs(m.diff.feedEntry)))}, |timing part| median ${med(mm.map((m) => Math.abs(m.diff.timingEntry)))}; same outcome ${mm.filter((m) => m.diff.sameOutcome).length}, same v5 ${mm.filter((m) => m.diff.sameV5).length}, same H4 ${mm.filter((m) => m.diff.sameH4).length}, same D1 ${mm.filter((m) => m.diff.sameD1).length}; live exit reproduced on OANDA with the live levels ${matchR.filter((m) => m.diff && m.diff.spotSameAsLive).length}/${mm.length}`);
console.log(`  live R ${f2(liveRs.reduce((a, x) => a + (x.R || 0), 0))} vs same levels on OANDA ${f2(matchR.reduce((a, m) => a + (m.spot.R || 0), 0))} vs replay signals ${f2(rrows.reduce((a, x) => a + (x.R || 0), 0))}`);
for (const m of matchR) console.log(`  ${iso(m.opened)} ${m.side} lag ${m.lag} live e ${m.live.entry} s ${m.live.stop} ${m.live.status} ${m.live.R} [${m.live.flags.join('+')}] v5 ${m.live.v5} h4 ${m.live.h4} | spot ${m.spot.status} ${m.spot.R} | replay ${m.replay ? `e ${m.replay.entry} s ${m.replay.stop} ${m.replay.status} ${m.replay.R} v5 ${m.replay.v5} h4 ${m.replay.h4} lag ${m.replay.lag} [${m.replay.flags.join('+')}]` : 'NONE'}`);
console.log(`\nreplay trade rows (${allTr.length}):`);
for (const x of allTr) console.log(`  ${x.k}${x.addOf ? ' add' : ''} ${x.id} ${x.side} ${x.entryMode} opened ${iso(x.opened)} filled ${iso(x.filled)} e ${x.entry} s ${x.stop} → ${x.status} R ${x.R} ${x.exit || x.exitKind || ''} closed ${iso(x.closed)}${x.shadow ? ` shadow(${x.blockedBy.join('+')})` : ''}${x.preLive ? ' preLive' : ''}${x.atEnd ? ` atEnd float ${x.floatR}` : ''} cost ${x.cost ? x.cost.costR.toFixed(3) : '-'} vs 0.30: ${cost30(x)}`);
console.log(`\nMosha chains ${chains.length}; skipped candles: rollover ${skipped.rollover}, shut ${skipped.shut}, stop-touches inside skipped candles ${skipped.rolloverTouch}`);
console.log('\nstates at the last step vs snapshot:', JSON.stringify(stateCmp, null, 1));
