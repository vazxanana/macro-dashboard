// Edge research · gold-weekend: the INTENDED weekend handling for Gold trend (gtrend, N20), Gold trend fast (gtrend5, N5) and
// Gold daily engulf (geg) (preregistration.md). A copy of research/edge/gold-systems-oos/replay.mjs (#530) with ONLY these changes,
// each marked "WEEKEND" below; everything else (runs, entry prices, stops, add, trail, hold, management, Gold H4 trendline) is #530's:
//   1. daily candles starting on a Saturday or Sunday (UTC) are folded into the next weekday candle (its time and close, the first
//      weekend open, the high / low over all): the trend legs and the engulf see trading days only (the Sunday 22:00-24:00 stub is
//      no longer a day in the lookbacks, the 20-day average or ATR(14), and can no longer be the signal candle);
//   2. a daily signal is fresh for 24 h from the REOPEN after its day's UTC end (first M5 candle at / after the end that is not in
//      fills.mjs spotClosed): Monday-Thursday that is the day end (unchanged); Friday it is the Sunday reopen;
//   3. no market entry / add on a run whose M5 candle is in the spot-shut window (a stray weekend quote).
// Gold H4 trendline keeps the raw daily candles (its MSNR direction), as #530.
//   CANDLES=<#530 candle dir> OUT_DIR=<dir> node replay-intended.mjs     -> OUT_DIR/trades.json (every trade leg)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { LIVE } from '../gold-systems/live.mjs';
import { stopFill, exitR, fillBarAmbiguous, spotSkip, spotClosed } from '../../../council/fills.mjs';

const DIR = process.env.CANDLES, OUT = process.env.OUT_DIR || '.';
const load = (tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `xau-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const M5 = load('5m'), H4 = load('4h'), D1raw = load('1d');
// WEEKEND 1: fold Saturday / Sunday daily candles into the next weekday candle
const D1 = []; { let carry = null;
  for (const b of D1raw) { const wd = new Date(b.time * 1000).getUTCDay();
    if (wd === 0 || wd === 6) { carry = carry ? { ...carry, high: Math.max(carry.high, b.high), low: Math.min(carry.low, b.low) } : { open: b.open, high: b.high, low: b.low }; continue; }
    D1.push(carry ? { time: b.time, open: carry.open, high: Math.max(carry.high, b.high), low: Math.min(carry.low, b.low), close: b.close } : b); carry = null; } }
console.error('candles', { m5: M5.length, h4: H4.length, d1: D1raw.length, d1TradingDays: D1.length });
const NM = M5.length;
const SKIP = new Uint8Array(NM); for (let i = 0; i < NM; i++) SKIP[i] = spotSkip(M5[i].time) ? 1 : 0;

const CFG = { goldTrend: { n: 20, k: 2 }, goldTrendFast: { n: 5, k: 2 }, goldTrendAdd: { atR: 1 },
  goldTL: { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 }, goldEG: { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 } };
const dp = 2, key = 'xau', W = 719;   // xau dec 1 -> Math.max(2, dec + 1) = 2 decimals; 720-candle windows, the last one forming
const fx = (v) => +v.toFixed(dp);

// ─── trade management: the live "Manage open trades" loop, one M5 candle ───
function manage(tr, i) {
  const b = M5[i];
  if (SKIP[i]) return;
  if (tr.status === 'pending') {
    if (b.low <= tr.entry) {
      if (fillBarAmbiguous(b, false, tr.entry, tr.stop, tr.t1)) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; tr.exit = 'fill and target in one candle'; return; }
      tr.status = 'open'; tr.filled = b.time;
    } else if (b.high >= tr.t1) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; return; }
    else return;
  }
  const r0 = tr.r0;
  if (b.low <= tr.stop) {
    const px = stopFill(b, false, tr.stop, b.time > tr.filled), gapped = px !== tr.stop;
    if (tr.trail && tr.trailMoved) { tr.R = exitR(false, tr.entry, px, r0); tr.exit = 'trailing stop'; }
    else if (tr.beMoved) tr.R = exitR(false, tr.entry, px, r0);
    else { tr.R = gapped ? exitR(false, tr.entry, px, r0) : -1; tr.exit = 'stop'; }
    if (gapped) tr.gapR = +((tr.stop - px) / r0).toFixed(2);
    tr.exitPx = px; tr.status = 'closed'; tr.closed = b.time; return;
  }
  if (b.high >= tr.t1) { tr.status = 'closed'; tr.closed = b.time; tr.R = tr.rr; tr.exitPx = tr.t1; tr.exit = 'target'; return; }
  if (tr.maxHold && b.time >= tr.filled + tr.maxHold) { tr.R = +((b.close - tr.entry) / r0).toFixed(2); tr.status = 'closed'; tr.closed = b.time; tr.exit = `${tr.maxHold / 3600} h`; tr.exitPx = b.close; return; }
  tr.mfe = +Math.max(tr.mfe || 0, (b.high - tr.entry) / r0).toFixed(2);
  tr.mae = +Math.max(tr.mae || 0, (tr.entry - b.low) / r0).toFixed(2);
  if (tr.trail && tr.mfe >= tr.trail[0]) { const ns = tr.entry + (tr.mfe - tr.trail[1]) * r0; if (ns > tr.stop) { tr.stop = fx(ns); tr.trailMoved = true; } }
}
const isLive = (x) => x.status === 'open' || x.status === 'pending';

// ─── windows: closed-candle counts at time c (a candle is closed once its bucket has ended; see RESULT.md for why this equals
// the live "drop the last candle" rule at every run that has an M5 candle) ───
function counter(A, sec) { let p = 0; return (c) => { while (p < A.length && A[p].time + sec <= c) p++; return p; }; }
const nd1 = counter(D1, 86400), nh4 = counter(H4, 14400), nd1raw = counter(D1raw, 86400);
// WEEKEND 2: the reopen after each trading day's UTC end (first M5 candle at / after it that is not spot-shut)
const REOPEN = new Float64Array(D1.length); { let p = 0;
  for (let i = 0; i < D1.length; i++) { const e = D1[i].time + 86400; while (p < NM && M5[p].time < e) p++; let q = p; while (q < NM && spotClosed(M5[q].time)) q++; REOPEN[i] = q < NM ? M5[q].time : e; } }
const tr14 = (i) => Math.max(D1[i].high - D1[i].low, Math.abs(D1[i].high - D1[i - 1].close), Math.abs(D1[i].low - D1[i - 1].close));
const atr14 = (i) => { let a = 0; for (let j = i - 13; j <= i; j++) a += tr14(j); return a / 14; };

const trades = [], ids = new Set();
const push = (t) => { trades.push(t); ids.add(t.id); return t; };
let book = [];   // live (open / pending) trades

// per-H4-count cache of the trendline (pivots through the last 719 closed H4 candles) and of the MSNR direction
let tlKey = -1, tlState = null; const msnrCache = new Map();
function tlLine(nh) {
  if (nh === tlKey) return tlState;
  tlKey = nh; tlState = null;
  const TL = CFG.goldTL, H = H4.slice(Math.max(0, nh - W), nh), n = H.length;
  const piv = []; for (let i = TL.n; i < n - TL.n; i++) { let ok = true; for (let k = i - TL.n; k <= i + TL.n && ok; k++) if (k !== i && H[k].high >= H[i].high) ok = false; if (ok) piv.push([i, H[i].high]); }
  if (piv.length >= 2) {
    const [a, pa] = piv[piv.length - 2], [b, pb] = piv[piv.length - 1];
    if (pb < pa && b - a <= TL.span && n - 1 > b + TL.n) {
      const slope = (pb - pa) / (b - a), lv = pa + slope * (n - 1 - a), id = `${key}-gtl-${H[a].time}-${H[b].time}`;
      tlState = { H, n, a, b, pa, pb, lv, id, lo: Math.min(...H.slice(b).map((x) => x.low)) };
    }
  }
  return tlState;
}

const START = Date.parse('2006-03-20T00:00:00Z') / 1000;
const FIRST_ENTRY = Date.parse((process.env.FIRST_ENTRY || '2006-07-01') + 'T00:00:00Z') / 1000;
for (let j = 0; j < NM - 1; j++) {
  const c = M5[j].time + 300, now = c + 240;
  // 1. manage the live book through the candles closed by c (each trade from its own pointer)
  for (const tr of book) { for (let i = tr.ptr; i <= j && isLive(tr); i++) { manage(tr, i); tr.ptr = i + 1; } if (tr.ptr <= j) tr.ptr = j + 1; }
  for (const tr of book) if (tr.status === 'pending' && now - tr.opened > tr.validFor) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
  book = book.filter(isLive);
  if (M5[j].time < START) continue;
  const nd = nd1(c), nh = nh4(c), ndr = nd1raw(c);
  if (nd < 40) continue;
  const hasEntry = M5[j + 1].time === c, price = hasEntry ? M5[j + 1].close : M5[j].close, k0 = j + 2;
  const canEnter = hasEntry && now >= FIRST_ENTRY;
  const canEnterW = canEnter && !spotClosed(M5[j + 1].time);   // WEEKEND 3 (hasEntry: M5[j + 1] is the candle in progress)
  const last = D1[nd - 1];
  // 2. Gold trend / Gold trend fast (live block "Gold trend (5 Nov ...)")
  for (const LEG of [{ cfg: CFG.goldTrend, k: 'gtrend', name: 'Gold trend' }, { cfg: CFG.goldTrendFast, k: 'gtrend5', name: 'Gold trend fast' }]) {
    const GT = LEG.cfg, n = Math.min(nd, W);
    const open = book.find((x) => x.k === LEG.k && x.status === 'open');
    if (!(n > GT.n + 15)) continue;
    if (open) {
      const gAdd = book.find((x) => x.addOf === open.id && x.status === 'open');
      if (last.time > (open.lastD || 0)) { const ns = fx(last.close - GT.k * atr14(nd - 1)); if (ns > open.stop) { open.stop = ns; open.trailMoved = true; } if (gAdd && ns > gAdd.stop) { gAdd.stop = ns; gAdd.trailMoved = true; } open.lastD = last.time;
        if (CFG.goldTrendAdd && !gAdd && !ids.has(`${open.id}-add`) && last.close - open.entry >= CFG.goldTrendAdd.atR * open.r0 && canEnterW) {
          const ae = fx(price), rA = ae - open.stop;
          if (rA > 0) book.push(push({ id: `${open.id}-add`, k: LEG.k, side: 'buy', entry: ae, stop: open.stop, t1: fx(ae * 100), rr: 99, trail: [1e6, 0], size: 1, opened: now, filled: now, status: 'open', R: null, r0: rA, noBe: true, entryMode: 'market', addOf: open.id, ptr: k0 }));
        } }
    } else {
      const hi = Math.max(...D1.slice(nd - 1 - GT.n, nd - 1).map((b) => b.high)), A = atr14(nd - 1), id = `${key}-${LEG.k}-${last.time}`;
      if (last.close > hi && A > 0 && !ids.has(id) && now - REOPEN[nd - 1] < 86400 && canEnterW) {
        const entry = fx(price), stop = fx(entry - GT.k * A), r0 = entry - stop;
        if (r0 > 0) book.push(push({ id, k: LEG.k, side: 'buy', entry, stop, t1: fx(entry * 100), rr: 99, trail: [1e6, 0], opened: now, filled: now, status: 'open', R: null, r0, noBe: true, entryMode: 'market', lastD: last.time, feat: { hi: fx(hi), atr: fx(A) }, ptr: k0 }));
      }
    }
  }
  // 3. Gold H4 trendline (live block "config.goldTL")
  if (nh >= 30) {
    const TL = CFG.goldTL, lastH = H4[nh - 1], open = book.find((x) => x.k === 'gtl' && isLive(x));
    if (!open && now - (lastH.time + 14400) < 3600 && canEnter) {
      const L = tlLine(nh);
      if (L && lastH.close > L.lv && !ids.has(L.id)) {
        const mk = `${nh}|${ndr}`;
        let dir = msnrCache.get(mk);
        if (dir == null) { dir = LIVE.msnrDirection(L.H, D1raw.slice(Math.max(0, ndr - W), ndr), TL.n4, 2); msnrCache.clear(); msnrCache.set(mk, dir); }
        if (dir === 1) {
          const entry = fx(price), stop = fx(L.lo - TL.pad), r0 = entry - stop;
          if (r0 > 0) book.push(push({ id: L.id, k: 'gtl', side: 'buy', entry, stop, t1: fx(entry + 10 * r0), rr: 10, trail: [2, 1], opened: now, filled: now, status: 'open', R: null, r0, maxHold: TL.hold * 3600, noBe: true, entryMode: 'market',
            feat: { line: fx(L.lv), anchors: [fx(L.pa), fx(L.pb)], lo: fx(L.lo) }, ptr: k0 }));
        }
      }
    }
  }
  // 4. Gold daily engulf (live block "config.goldEG")
  {
    const EG = CFG.goldEG, n = Math.min(nd, W);
    const mine = book.filter((x) => x.k === 'geg');
    for (const tr of mine.filter((x) => x.status === 'pending')) if (tr.zone && last.time > (tr.lastD || 0) && last.close < tr.zone[0]) { tr.status = 'expired'; tr.closed = now; tr.R = 0; tr.exit = 'zone failed'; }
    for (const tr of mine.filter((x) => x.status === 'pending')) tr.lastD = last.time;
    if (n > EG.sma + EG.k + 2 && now - REOPEN[nd - 1] < 86400) {   // WEEKEND 2
      let sma = 0; for (let q = nd - EG.sma; q < nd; q++) sma += D1[q].close; sma /= EG.sma; const up = last.close > sma;
      let base = null;
      if (last.close > last.open) for (let q = nd - 2; q >= nd - 1 - EG.k && q >= 0; q--) { const b = D1[q]; if (b.open > b.close) { if (last.close > b.high) base = b; break; } if (b.close < b.open) break; }
      const id = base ? `${key}-geg-${base.time}` : null;
      const openCnt = mine.filter(isLive).length;
      if (base && up && !ids.has(id) && openCnt < EG.maxOpen && canEnterW) {
        const entry = fx(base.high), stop = fx(base.low - EG.pad), r0 = entry - stop;
        if (r0 > 0 && price > entry) book.push(push({ id, k: 'geg', side: 'buy', entry, stop, t1: fx(entry + 10 * r0), rr: 10, trail: [2, 1], opened: now, status: 'pending', R: null, r0, validFor: EG.life * 86400, maxHold: EG.hold * 3600, noBe: true, entryMode: 'limit',
          zone: [fx(base.low), fx(base.high)], lastD: last.time, feat: { sma: fx(sma), conf: last.close }, ptr: k0 }));
      }
    }
  }
}
// still open at the end of the data: marked at the last M5 close (flagged 'end'); waiting orders expire
const lastBar = M5[NM - 1];
for (const tr of book) { if (tr.status === 'pending') { tr.status = 'expired'; tr.R = 0; } else { tr.R = +((lastBar.close - tr.entry) / tr.r0).toFixed(2); tr.exit = 'end (marked)'; tr.status = 'closed'; } tr.closed = lastBar.time; tr.atEnd = true; }

const legs = trades.map(({ ptr, ...t }) => t);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'trades.json'), JSON.stringify(legs));
const cnt = {}; for (const t of legs) { const s = `${t.k}${t.addOf ? '+add' : ''}:${t.status}`; cnt[s] = (cnt[s] || 0) + 1; }
console.error('legs', cnt);
