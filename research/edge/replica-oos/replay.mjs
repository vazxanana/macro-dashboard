// Edge research · replica-oos: the LIVE gold replica rule, unchanged, replayed on OANDA XAU/USD 2017-2026.
// 2017-2022 is the out-of-sample test (the rule was fitted on 2023+); 2023-2026 is the in-sample calibration of this harness.
//   CANDLES=<dir from fetch.mjs> OUT_DIR=<dir> node replay.mjs      -> OUT_DIR/trades.json (positions + raw signals)
//
// Same code as live:
//   - replicaSignals, platformEngulfs, goldLevels, msnrDirection are copied verbatim out of council/trader.mjs at run time
//     (research/edge/gold-systems/live.mjs); msAnalyze is the engine's own, through the checked speed copy
//     (research/edge/setups-promote/fastms.mjs, identical results); stopFill / exitR come from council/fills.mjs.
//   - The decision runs 4 minutes after each M5 close (the live cron lag) on the windows the live Trader reads from OANDA:
//     720 candles per timeframe, the last one still forming (rebuilt here from the M5 candles closed by then).
//   - The live config of 7 Nov 2026 (USER_RULES applied in order): v5 (clear of live H1 Origins or the star engulfing, stop
//     >= 1 M15 ATR, H4 trend against), D1 trend with (OANDA D1), volatility gate = 20-day range in the top fifth of its own last
//     year (goldVolPct 80, no 1.5% leg), no new entry 08:25-08:45 ET, entries more than 8 min late skipped, round-number stops,
//     max 3 open, -1.5R day stop, half size below the 50-trade equity average, MSNR tilt 1.5x against / 0.5x with,
//     exits: breakeven at +2R, a second unit at +1.5R (stop at the first entry), after +4R trail 1R behind the best price
//     (cap 10R), out after 48 h.
// Departures (M5 data, no M1): the entry is the close of the M5 candle the decision falls in (about 1 minute after the live
// entry), and trades are managed on M5 candles in the live loop's order (stop, target, time, then trail / breakeven / add).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { LIVE } from '../gold-systems/live.mjs';
import { fastAnalyze } from '../setups-promote/fastms.mjs';
import { stopFill, exitR } from '../../../council/fills.mjs';

const DIR = process.env.CANDLES, OUT = process.env.OUT_DIR || '.';
const START = Date.parse((process.env.OOS_FROM || '2017-01-01') + 'T00:00:00Z') / 1000;
const load = (tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `xau-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const B = { '5m': load('5m'), '1h': load('1h'), '4h': load('4h'), '1d': load('1d') };
// 15m from M5 (UTC buckets, as OANDA's own M15)
B['15m'] = []; for (const b of B['5m']) { const t = Math.floor(b.time / 900) * 900, l = B['15m'].at(-1);
  if (!l || l.time !== t) B['15m'].push({ ...b, time: t }); else { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } }
// sensitivity only (not live): D1_WEEKDAYS=1 folds OANDA's Sunday-evening daily stub into Monday, as the HistData study did
if (process.env.D1_WEEKDAYS) { const d = []; for (const b of B['1d']) { const wd = new Date(b.time * 1000).getUTCDay(), l = d.at(-1);
  if (wd === 1 && l && l.sun) { d[d.length - 1] = { time: b.time, open: l.open, high: Math.max(l.high, b.high), low: Math.min(l.low, b.low), close: b.close }; }
  else d.push(wd === 0 ? { ...b, sun: true } : b); } B['1d'] = d.filter((b) => !b.sun); }
const SEC = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
const M5 = B['5m'];
console.error('candles', Object.fromEntries(Object.entries(B).map(([k, v]) => [k, v.length])));

// ─── live helpers (copied from council/trader.mjs) ───
const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
const nyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
function nyParts(t) { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { m: +o.hour * 60 + +o.minute, wd: o.weekday }; }
const pxr = (v) => +v.toFixed(2);   // gold dec 1 -> 2 decimals
const CFG = { volPct: 80, d1With: true, newsVeto: [[505, 525]], msnrSize: { against: 1.5, with: 0.5 }, beR: 2, add: { atR: 1.5 }, run: { atR: 4, trail: 1 }, maxHold: 48 * 3600 };

// ─── windows as the live Trader sees them at time T: the last n closed candles plus the forming one ───
const ptr = { '15m': 0, '1h': 0, '4h': 0, '1d': 0 };
function closedCount(tf, c) { const a = B[tf], s = SEC[tf]; let p = ptr[tf]; while (p < a.length && a[p].time + s <= c) p++; ptr[tf] = p; return p; }
function forming(tf, c, j) {   // the forming candle of tf at c (M5 candles [bucket, c)); a flat candle at the last close if none yet
  const t0 = Math.floor(c / SEC[tf]) * SEC[tf]; let f = null;
  for (let k = j; k >= 0 && M5[k].time >= t0; k--) { const b = M5[k]; f = f ? { time: t0, open: b.open, high: Math.max(f.high, b.high), low: Math.min(f.low, b.low), close: f.close } : { time: t0, open: b.open, high: b.high, low: b.low, close: b.close }; }
  return f || { time: t0, open: M5[j].close, high: M5[j].close, low: M5[j].close, close: M5[j].close };
}
const win = (tf, n, nc, fb) => B[tf].slice(Math.max(0, nc - (n - 1)), nc).concat([fb]);

// ─── trade management: one candle of the live loop (council/trader.mjs "Manage open trades") ───
function manage(tr, b) {
  if (b.time < tr.checked) return null;
  const s = tr.sell, r0 = tr.r0;
  if (s ? b.high >= tr.stop : b.low <= tr.stop) {
    const px = stopFill(b, s, tr.stop, b.time > tr.filled), gapped = px !== tr.stop;
    if (tr.trail && tr.trailMoved) tr.R = exitR(s, tr.entry, px, r0);
    else if (tr.beMoved) tr.R = exitR(s, tr.entry, px, r0);
    else tr.R = gapped ? exitR(s, tr.entry, px, r0) : -1;
    tr.exitKind = 'stop'; tr.closed = b.time; return null;
  }
  if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.R = tr.rr; tr.exitKind = 'target'; tr.closed = b.time; return null; }
  if (tr.maxHold && b.time >= tr.filled + tr.maxHold) { tr.R = +((s ? tr.entry - b.close : b.close - tr.entry) / r0).toFixed(2); tr.exitKind = 'time'; tr.closed = b.time; return null; }
  tr.mfe = +Math.max(tr.mfe || 0, ((s ? tr.entry - b.low : b.high - tr.entry) / r0)).toFixed(2);
  if (tr.trail && tr.mfe >= tr.trail[0]) { const ns = tr.entry + (s ? -1 : 1) * (tr.mfe - tr.trail[1]) * r0; if (s ? ns < tr.stop : ns > tr.stop) { tr.stop = +ns.toFixed(2); tr.trailMoved = true; } }
  if (tr.beAt && !tr.beMoved && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= tr.beAt) { tr.stop = tr.entry; tr.beMoved = true; }
  if (tr.addAt && !tr.addDone && tr.mfe >= tr.addAt) {
    tr.addDone = true; const dir = s ? -1 : 1, ae = pxr(tr.entry + dir * tr.addAt * r0), rA = Math.abs(ae - tr.entry);
    // the add is managed from this same candle (live: checked = this candle's time), stop at the first entry
    if (rA > 0) return { sell: s, entry: ae, stop: tr.entry, t1: tr.t1, rr: +(Math.abs(tr.t1 - ae) / rA).toFixed(2), trail: tr.trail ? [+((tr.trail[0] - tr.addAt) / tr.addAt).toFixed(3), +(tr.trail[1] / tr.addAt).toFixed(3)] : null,
      size: +(tr.addAt * (tr.size || 1)).toFixed(2), filled: b.time, checked: b.time, r0: rA, maxHold: Math.max(300, (tr.filled + tr.maxHold) - b.time), add: true, parent: tr.id };
  }
  return null;
}
function runTo(list, k, kEnd) {   // advance open legs through M5 candles [their pointer, kEnd)
  for (let q = 0; q < list.length; q++) { const x = list[q];
    for (let i = x.k; i < kEnd && x.closed == null; i++) { x.k = i + 1; const a = manage(x, M5[i]); if (a) { a.k = i; list.push(a); } } }
}

// ─── replay ───
const seen = new Set(), signals = [], legs = [], open = [];
const anaCache = new Map(), msnrCache = new Map();
let j0 = M5.findIndex((b) => b.time + 300 >= START);
for (let j = Math.max(j0, 200); j < M5.length - 1; j++) {
  const c = M5[j].time + 300, T = c + 240;
  // manage the live book through the candles closed by c
  runTo(open, 0, j + 1);
  for (let q = open.length - 1; q >= 0; q--) if (open[q].closed != null) legs.push(open.splice(q, 1)[0]);
  if (!marketOpen(T)) continue;
  const n15 = closedCount('15m', c), nh = closedCount('1h', c), n4 = closedCount('4h', c), nd = closedCount('1d', c);
  if (n15 < 120 || nh < 720 || n4 < 720 || nd < 720) continue;
  const f15 = forming('15m', c, j), fh = forming('1h', c, j);
  const ph = { time: c, open: M5[j].close, high: M5[j].close, low: M5[j].close, close: M5[j].close };   // forming M5 (dropped by replicaSignals)
  const src = { '5m': { bars: M5.slice(j - 119, j + 1).concat([ph]) }, '15m': { bars: win('15m', 120, n15, f15) }, '1h': { bars: win('1h', 60, nh, fh) } };
  let sigs = []; try { sigs = LIVE.replicaSignals(src); } catch (e) { sigs = []; }
  if (!sigs.length) continue;
  const nxt = M5[j + 1], hasEntry = nxt.time === c;   // the M5 candle the entry falls in
  for (const g of sigs) {
    const key = `${g.sell ? 's' : 'b'}|${g.tc}`; if (seen.has(key)) continue; seen.add(key);
    if (!hasEntry) continue;
    const entry = nxt.close, buf = Math.max(0.1 * g.atr, 0.3), stop0 = g.sell ? g.ext + buf : g.ext - buf, r00 = Math.abs(entry - stop0);
    if (!(r00 > 0) || (g.sell ? entry >= stop0 : entry <= stop0)) continue;
    let stop = stop0; { const rn = g.sell ? Math.ceil(stop0 / 10) * 10 : Math.floor(stop0 / 10) * 10; if (Math.abs(stop0 - rn) <= 2) stop = g.sell ? rn + 0.5 : rn - 0.5; }
    const riskAtr = r00 / g.atr, dir = g.sell ? -1 : 1, lag = T - g.tc - 300;
    // the 720-candle analyses (H1 Origins, H4 trend, D1 trend), once per decision time
    let an = anaCache.get(T);
    if (!an) { an = {
        h1: fastAnalyze(win('1h', 720, nh, fh), 6), h4: fastAnalyze(win('4h', 720, n4, forming('4h', c, j)), 6), dw: win('1d', 720, nd, forming('1d', c, j)) };
      an.d1 = fastAnalyze(an.dw, 6); anaCache.clear(); anaCache.set(T, an); }
    const h1clear = !an.h1.events.some((e) => e.endIdx == null && e.top > e.bot && entry <= e.top && entry >= e.bot);
    const pass = (h1clear || g.star) && riskAtr >= 1;
    const h4 = an.h4.trend === -dir ? 'against' : an.h4.trend === dir ? 'with' : 'none', v5 = pass && h4 === 'against';
    if (!v5) { signals.push({ T, sell: g.sell, pass, h4, v5: false }); continue; }
    const d1w = an.d1.trend === dir;
    // volatility gate on the 719 closed daily candles (live: src['1d'].bars.slice(0, -1))
    const db = an.dw.slice(0, -1), rr = db.map((b) => (b.high - b.low) / b.close * 100), ser = [];
    const dvb = db.slice(-20), volPct = dvb.reduce((a, b) => a + (b.high - b.low) / b.close * 100, 0) / dvb.length;
    for (let i = 20; i <= rr.length; i++) { let s = 0; for (let q = i - 20; q < i; q++) s += rr[q]; ser.push(s / 20); }
    const past = ser.slice(-367, -2).sort((a, b) => a - b), goldP = past.length >= 200 ? +past[Math.floor(CFG.volPct / 100 * (past.length - 1))].toFixed(3) : null;
    const volOk = goldP != null && volPct >= goldP;
    const ny = nyParts(T), news = !['Sat', 'Sun'].includes(ny.wd) && CFG.newsVeto.some(([a, b]) => ny.m >= a && ny.m <= b);
    const mk = `${n4}|${nd}`; let md = msnrCache.get(mk);
    if (md == null) { try { md = LIVE.msnrDirection(B['4h'].slice(Math.max(0, n4 - 719), n4), B['1d'].slice(Math.max(0, nd - 719), nd)); } catch (e) { md = 0; } msnrCache.clear(); msnrCache.set(mk, md); }
    const msnr = md === 0 ? 'none' : md === dir ? 'with' : 'against';
    const stale = lag > 480;
    // live risk rules at the decision
    const capped = open.filter((x) => !x.add).length >= 3;
    const day = Math.floor(T / 86400), dayR = legs.filter((x) => Math.floor(x.closed / 86400) === day).reduce((a, x) => a + x.R * (x.size || 1), 0), dayStop = dayR <= -1.5;
    let size = 1;
    if (legs.length > 50) { const hist = legs.slice().sort((a, b) => a.closed - b.closed); let e = 0; const eq = hist.map((x) => (e += x.R)); const avg = eq.slice(-50).reduce((a, v) => a + v, 0) / 50; if (eq.at(-1) < avg) size = 0.5; }
    if (msnr === 'against') size *= CFG.msnrSize.against; else if (msnr === 'with') size *= CFG.msnrSize.with;
    const sg = { T, sell: g.sell, entry: pxr(entry), stop: pxr(stop), r0: Math.abs(pxr(entry) - pxr(stop)), pass, h4, v5, d1w, volOk, vol: +volPct.toFixed(3), gate: goldP, news, msnr, stale, capped, dayStop, lag, riskAtr: +riskAtr.toFixed(2), star: g.star, h1clear, leg: g.L };
    signals.push(sg);
    if (!(volOk && (!CFG.d1With || d1w) && !capped && !dayStop && !stale && !news)) continue;
    const r0 = sg.r0, tr = { id: `rp-${T}-${g.sell ? 's' : 'b'}`, sell: g.sell, entry: sg.entry, stop: sg.stop, t1: pxr(entry + dir * 10 * r0), rr: 10, trail: [CFG.run.atR, CFG.run.trail],
      size, opened: T, filled: c + 300, checked: c + 300, r0, maxHold: CFG.maxHold, beAt: CFG.beR, addAt: CFG.add.atR, k: j + 2, msnr, sig: sg };
    open.push(tr);
  }
}
runTo(open, 0, M5.length);
for (const x of open) { const b = M5.at(-1); x.R = +((x.sell ? x.entry - b.close : b.close - x.entry) / x.r0).toFixed(2); x.closed = b.time; x.exitKind = 'end'; legs.push(x); }

// signal-level diagnostic: every v5 signal as one independent unit with the live exits (no gate, no risk rules, size 1)
const solo = [];
for (const s of signals.filter((x) => x.v5)) {
  const j = M5.findIndex((b) => b.time >= s.T - 240 + 300); if (j < 0) continue;
  const dir = s.sell ? -1 : 1, tr = { id: `solo-${s.T}-${dir}`, sell: s.sell, entry: s.entry, stop: s.stop, t1: pxr(s.entry + dir * 10 * s.r0), rr: 10, trail: [CFG.run.atR, CFG.run.trail],
    size: 1, opened: s.T, filled: M5[j].time, checked: M5[j].time, r0: s.r0, maxHold: CFG.maxHold, beAt: CFG.beR, addAt: CFG.add.atR, k: j };
  const L = [tr]; runTo(L, 0, Math.min(M5.length, j + 700));
  for (const x of L) if (x.closed == null) { const b = M5[Math.min(M5.length, j + 700) - 1]; x.R = +((x.sell ? x.entry - b.close : b.close - x.entry) / x.r0).toFixed(2); x.closed = b.time; x.exitKind = 'end'; }
  solo.push({ T: s.T, d1w: s.d1w, volOk: s.volOk, news: s.news, msnr: s.msnr, legs: L.map((x) => ({ R: x.R, size: x.size, r0: x.r0, exitKind: x.exitKind, closed: x.closed, add: !!x.add })) });
}

// positions: the first unit and its add
const byId = new Map(); for (const x of legs) if (!x.add) byId.set(x.id, { id: x.id, T: x.opened, sell: x.sell, msnr: x.msnr, size0: x.size, legs: [] });
for (const x of legs) byId.get(x.add ? x.parent : x.id).legs.push({ R: x.R, size: x.size, r0: x.r0, entry: x.entry, exitKind: x.exitKind, closed: x.closed, add: !!x.add });
const positions = [...byId.values()].sort((a, b) => a.T - b.T);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'trades.json'), JSON.stringify({ from: new Date(START * 1000).toISOString().slice(0, 10), to: new Date(M5.at(-1).time * 1000).toISOString().slice(0, 10), positions, signals, solo }));
// compact list of the positions (committed next to RESULT.md): entry time, side, first-unit size, and each leg's R / size / exit
fs.writeFileSync(path.join(OUT, 'positions.json'), '[\n' + positions.map((p) => JSON.stringify({ at: new Date(p.T * 1000).toISOString().slice(0, 16), side: p.sell ? 'sell' : 'buy', size: p.size0, msnr: p.msnr,
  legs: p.legs.map((l) => [l.R, l.size, +l.r0.toFixed(2), l.exitKind]) })).join(',\n') + '\n]\n');
console.error('positions', positions.length, 'signals', signals.length, 'v5', signals.filter((s) => s.v5).length, 'solo', solo.length);
