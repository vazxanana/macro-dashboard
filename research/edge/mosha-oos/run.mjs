// Edge research · mosha-oos: the LIVE Mosha BO rule (council/trader.mjs "Mosha breakout system", config of 7 Nov 2026: moshaBo,
// moshaBoWeekly, moshaSlow 12, moshaBeR 1.5, moshaAdd {atR 1.5, size 1}, moshaRun {atR 3, trail 1}), unchanged, replayed on OANDA
// XAU/USD 2006-2026 (preregistration.md). Same harness as #530 (research/edge/gold-systems-oos).
//   node run.mjs fetch <candleDir> [#530 cache dir]            -> xau-{5m,15m,1h,4h,1d}.json.gz (kept out of git)
//   CANDLES=<candleDir> OUT_DIR=<dir> node run.mjs replay       -> OUT_DIR/trades.json (every leg, live and blocked chains)
//   node run.mjs analyze <trades.json> > result.json            -> statistics, the pre-registered verdict, the decay-monitor replay
//
// Replay = the live block line for line on the windows the live Trader reads (720 candles per timeframe, the last one forming;
// closed events only: breakIdx < bars.length - 1), one run 4 minutes after every M5 close; msAnalyze from council/engine.mjs;
// stopFill / exitR / fillBarAmbiguous / spotSkip from council/fills.mjs; management = the live "Manage open trades" loop on M5
// candles in the live order (fill, stop, target, time, MFE/MAE, trail, breakeven, add). Departures (no M1): the current price is
// the close of the M5 candle the run falls in; fills and stops are judged on M5 candles; the forming H1 bar of the pull count is
// built from the M5 candles closed by the run. The weekly filter reads OANDA daily candles (live: CNBC XAU= first, OANDA as the
// fallback). Blocked chains (weekly / cap / price / momentum) are managed as a shadow book, as live, but are not positions.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { msAnalyze } from '../../../council/engine.mjs';
import { stopFill, exitR, fillBarAmbiguous, spotSkip } from '../../../council/fills.mjs';

const MODE = process.argv[2];
const fx = (v) => +v.toFixed(2);   // xau dec 1 -> Math.max(2, dec + 1) = 2 decimals
const CFG = { moshaSlow: 12, moshaBeR: 1.5, moshaAdd: { atR: 1.5, size: 1 }, moshaRun: { atR: 3, trail: 1 }, weekly: true, cap: 2, pad: 0.3, minR0: 0.5, validFor: 24 * 3600, maxHold: 72 * 3600, W: 720 };

// ─── fetch ───
if (MODE === 'fetch') {
  const [OUT, IN] = process.argv.slice(3), BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
  const FROM = T('2006-03-01'), END = T(process.env.OOS_TO || '2026-11-07'), NEED = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
  async function range(tf, sec, a0, b0) {
    const m = new Map();
    for (let a = a0; a < b0;) {
      const b = Math.min(b0, a + 4999 * sec); let j = null, err = null;
      for (let k = 0; k < 6 && !j; k++) {
        try { const r = await fetch(`${BASE}bars?sym=xau&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
          if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
        if (!j) await sleep(2000 * (k + 1));
      }
      if (!j) throw new Error(`xau ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
      a = b; await sleep(100);
    }
    return [...m.values()];
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const [tf, sec] of Object.entries(NEED)) {
    const f = path.join(OUT, `xau-${tf}.json.gz`); if (fs.existsSync(f)) { console.log(`${tf}: exists`); continue; }
    const cf = IN && path.join(IN, `xau-${tf}.json.gz`), have = cf && fs.existsSync(cf) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(cf))) : [];
    const first = have.length ? have[0][0] : END, last = have.length ? have.at(-1)[0] + sec : FROM;
    const pre = first > FROM ? await range(tf, sec, FROM, first) : [], post = last < END ? await range(tf, sec, last, END) : [];
    const all = new Map(); for (const r of [...pre, ...have, ...post]) all.set(r[0], r);
    const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
    fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars))); console.log(`${tf}: ${bars.length} candles`);
  }
}

// ─── replay ───
if (MODE === 'replay') {
  const DIR = process.env.CANDLES, OUT = process.env.OUT_DIR || '.';
  const load = (tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `xau-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const M5 = load('5m'), M15 = load('15m'), H1 = load('1h'), H4 = load('4h'), D1 = load('1d');
  console.error('candles', { m5: M5.length, m15: M15.length, h1: H1.length, h4: H4.length, d1: D1.length });
  const NM = M5.length, W = CFG.W;
  const SKIP = new Uint8Array(NM); for (let i = 0; i < NM; i++) SKIP[i] = spotSkip(M5[i].time) ? 1 : 0;

  // the live "Manage open trades" loop, one M5 candle; adds are pushed to `book` (live: trades), inheriting the parent's shadow flag
  // (live gives every add shadow: false, see RESULT.md "live-code finding")
  const book = [], all = [], ids = new Set();
  const push = (t) => { all.push(t); ids.add(t.id); book.push(t); return t; };
  function manage(tr, i) {
    const b = M5[i];
    if (SKIP[i]) return;
    const s = tr.side === 'sell';
    if (tr.status === 'pending') {
      if (b.time >= tr.opened + tr.validFor) { tr.status = 'expired'; tr.closed = b.time; tr.R = 0; return; }
      if (s ? b.high >= tr.entry : b.low <= tr.entry) {
        if (fillBarAmbiguous(b, s, tr.entry, tr.stop, tr.t1)) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; tr.exit = 'fill and target in one candle'; return; }
        tr.status = 'open'; tr.filled = b.time;
      } else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; return; }
      else return;
    }
    const r0 = tr.r0;
    if (s ? b.high >= tr.stop : b.low <= tr.stop) {
      const px = stopFill(b, s, tr.stop, b.time > tr.filled), gapped = px !== tr.stop;
      if (tr.trail && tr.trailMoved) { tr.R = exitR(s, tr.entry, px, r0); tr.exit = 'trailing stop'; }
      else if (tr.beMoved) { tr.R = exitR(s, tr.entry, px, r0); tr.exit = 'breakeven'; }
      else { tr.R = gapped ? exitR(s, tr.entry, px, r0) : -1; tr.exit = 'stop'; }
      if (gapped) tr.gapR = +((s ? px - tr.stop : tr.stop - px) / r0).toFixed(2);
      tr.exitPx = px; tr.status = 'closed'; tr.closed = b.time; return;
    }
    if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'closed'; tr.closed = b.time; tr.R = tr.rr; tr.exitPx = tr.t1; tr.exit = 'target'; return; }
    if (tr.maxHold && b.time >= tr.filled + tr.maxHold) { tr.R = +((s ? tr.entry - b.close : b.close - tr.entry) / r0).toFixed(2); tr.status = 'closed'; tr.closed = b.time; tr.exit = `${tr.maxHold / 3600} h`; tr.exitPx = b.close; return; }
    const fav = (s ? tr.entry - b.low : b.high - tr.entry) / r0;
    tr.mfe = +Math.max(tr.mfe || 0, fav).toFixed(2);
    tr.mae = +Math.max(tr.mae || 0, (s ? b.high - tr.entry : tr.entry - b.low) / r0).toFixed(2);
    if (tr.trail && tr.mfe >= tr.trail[0]) { const ns = tr.entry + (s ? -1 : 1) * (tr.mfe - tr.trail[1]) * r0; if (s ? ns < tr.stop : ns > tr.stop) { tr.stop = fx(ns); tr.trailMoved = true; } }
    if (tr.beAt && !tr.beMoved && fav >= tr.beAt) { tr.stop = tr.entry; tr.beMoved = true; }
    if (tr.addAt && !tr.addDone && tr.status === 'open' && tr.mfe >= tr.addAt) {
      tr.addDone = true; const dir = s ? -1 : 1, ae = fx(tr.entry + dir * tr.addAt * r0), rA = Math.abs(ae - tr.entry);
      if (rA > 0 && !ids.has(`${tr.id}-add`)) push({ id: `${tr.id}-add`, k: 'mosha-bo', side: tr.side, entry: ae, stop: tr.entry, t1: tr.t1, rr: +(Math.abs(tr.t1 - ae) / rA).toFixed(2),
        trail: tr.trail ? [+((tr.trail[0] - tr.addAt) / tr.addAt).toFixed(3), +(tr.trail[1] / tr.addAt).toFixed(3)] : undefined, size: +(tr.addAt * (tr.size || 1)).toFixed(2),
        opened: b.time, filled: b.time, status: 'open', R: null, r0: rA, maxHold: Math.max(300, (tr.filled + tr.maxHold) - b.time), noBe: true, entryMode: 'market', addOf: tr.id, shadow: !!tr.shadow, blockedBy: tr.blockedBy || [], ptr: i });
    }
  }
  const isLive = (x) => x.status === 'open' || x.status === 'pending';

  // windows at a run: the candles that have started by the run (time <= c), the last 720; closed events only
  const ptr = (A) => { let p = 0; return (c) => { while (p < A.length && A[p].time <= c) p++; return p; }; };
  const p15 = ptr(M15), p1 = ptr(H1), p4 = ptr(H4), pd = ptr(D1);
  const evCache = (A, sec) => { let key = -1, val = null; return (p) => { if (p === key) return val; key = p;
    const bb = A.slice(Math.max(0, p - W), p), R = msAnalyze(bb, 6);
    val = R.events.filter((e) => e.breakIdx < bb.length - 1).map((e) => ({ t: bb[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure })); return val; }; };
  const E3of = evCache(M15, 900), E2of = evCache(H1, 3600), E1of = evCache(H4, 14400);
  const before = (E, t) => E.filter((e) => e.t <= t).at(-1);
  // weekly structure (live: Monday-aligned weeks from the daily window of 720 candles, msAnalyze swing 3, closed weeks' breaks)
  let wKey = -1, wEv = null;
  function weeklyEvents(p, now) {
    if (p === wKey) return wEv; wKey = p;
    const dly = D1.slice(Math.max(0, p - W), p), wk = [];
    for (const b of dly) { const k = Math.floor((b.time - 345600) / 604800) * 604800 + 345600, c = wk.at(-1);
      if (!c || c.time !== k) wk.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } }
    wEv = msAnalyze(wk, 3).events.map((e) => ({ t: wk[e.breakIdx].time + 604800, dir: e.dir })).filter((e) => e.t <= now); return wEv;
  }
  // the H1 window at a run, with the forming bar built from the M5 candles closed by the run (index <= j)
  function h1Window(p, j) {
    const hb = H1.slice(Math.max(0, p - W), p); if (!hb.length) return hb;
    const last = hb[hb.length - 1], c = M5[j].time;
    if (last.time + 3600 > c + 300) {   // forming at the run: partial OHLC
      let hi = -Infinity, lo = Infinity, op = null, cl = null;
      for (let i = j; i >= 0 && M5[i].time >= last.time; i--) { hi = Math.max(hi, M5[i].high); lo = Math.min(lo, M5[i].low); op = M5[i].open; cl = cl ?? M5[i].close; }
      if (op == null) hb.pop(); else hb[hb.length - 1] = { time: last.time, open: op, high: hi, low: lo, close: cl };   // no M5 of that hour closed yet: live has no such bar
    }
    return hb;
  }

  const START = Date.parse('2006-03-20T00:00:00Z') / 1000;
  const chains = [];   // every chain evaluated (live: every record incl. shadow), for the diagnostics
  let lastE3 = null;
  for (let j = 0; j < NM - 1; j++) {
    const c = M5[j].time + 300, now = c + 240;
    // 1. manage the book through the candles closed by c (each trade from its own pointer; adds pushed during the loop are picked up next run)
    const n0 = book.length;
    for (let q = 0; q < n0; q++) { const tr = book[q]; for (let i = tr.ptr; i <= j && isLive(tr); i++) { manage(tr, i); tr.ptr = i + 1; } if (tr.ptr <= j) tr.ptr = j + 1; }
    for (const tr of book) if (tr.status === 'pending' && now - tr.opened > tr.validFor) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
    for (let q = book.length - 1; q >= 0; q--) if (!isLive(book[q])) book.splice(q, 1);
    if (M5[j].time < START) continue;
    const nd = pd(c); if (nd < 40) continue;
    // 2. the Mosha block
    const E3 = E3of(p15(c)), e3 = E3[E3.length - 1];
    if (!e3 || now - e3.t > 3600) continue;
    const id = `xau-moshabo-${e3.t}`; if (ids.has(id)) continue;
    const E2 = E2of(p1(c)), E1 = E1of(p4(c)), e2 = before(E2, e3.t), e1 = before(E1, e3.t), d = e3.dir;
    if (!(e1 && e2 && e1.dir === d && e2.dir === -d && e2.t > e1.t)) continue;
    const price = M5[j + 1].time === c ? M5[j + 1].close : M5[j].close;
    const entry = fx(e3.level), stop = fx(d < 0 ? e3.top + CFG.pad : e3.bot - CFG.pad), r0 = Math.abs(entry - stop);
    const openBo = book.filter((x) => !x.shadow && isLive(x)).length;
    let pull = null;
    { const hb = h1Window(p1(c), j), i2 = hb.findIndex((b) => b.time >= e2.t); let ext = d < 0 ? Infinity : -Infinity, iE = i2;
      for (let i = Math.max(0, i2); i < hb.length && hb[i].time < e3.t; i++) { if (d < 0 ? hb[i].low < ext : hb[i].high > ext) { ext = d < 0 ? hb[i].low : hb[i].high; iE = i; } }
      pull = i2 < 0 || !isFinite(ext) ? null : hb.filter((b) => b.time > hb[iE].time && b.time < e3.t).length; }
    const wEv = weeklyEvents(nd, now), w1 = (before(wEv, e3.t) || { dir: 0 }).dir;
    const blk = [CFG.weekly && w1 !== d && 'weekly', openBo >= CFG.cap && 'cap', !(d < 0 ? price < stop : price > stop) && 'price', !!(CFG.moshaSlow && pull != null && pull < CFG.moshaSlow) && 'momentum'].filter(Boolean);
    if (!(r0 > CFG.minR0)) { chains.push({ id, t: now, d, r0: fx(r0), small: true }); continue; }
    const tr = { id, k: 'mosha-bo', side: d < 0 ? 'sell' : 'buy', entry, stop, t1: fx(entry + d * 10 * r0), rr: 10, tp1: fx(entry + d * CFG.moshaRun.atR * r0), trail: [CFG.moshaRun.atR, CFG.moshaRun.trail], beAt: CFG.moshaBeR, addAt: CFG.moshaAdd.atR, addSize: CFG.moshaAdd.size,
      opened: now, status: 'pending', R: null, r0, validFor: CFG.validFor, maxHold: CFG.maxHold, noBe: true, entryMode: 'limit', feat: { h4At: e1.t, h1At: e2.t, m15At: e3.t, w1: w1 === d ? 'with' : 'against', m15Flip: !!e3.flip, pull, price }, shadow: blk.length > 0, blockedBy: blk, ptr: j + 2 };
    push(tr); chains.push({ id, t: now, d, r0: fx(r0), blk });
  }
  const lastBar = M5[NM - 1];
  for (const tr of book) { if (tr.status === 'pending') { tr.status = 'expired'; tr.R = 0; } else { tr.R = +(((tr.side === 'sell' ? -1 : 1) * (lastBar.close - tr.entry)) / tr.r0).toFixed(2); tr.exit = 'end (marked)'; tr.status = 'closed'; } tr.closed = lastBar.time; tr.atEnd = true; }
  const legs = all.map(({ ptr, ...t }) => t);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'trades.json'), JSON.stringify({ cfg: CFG, chains: chains.length, legs }));
  const cnt = {}; for (const t of legs) { const s = `${t.shadow ? 'shadow' : 'live'}${t.addOf ? '+add' : ''}:${t.status}`; cnt[s] = (cnt[s] || 0) + 1; }
  console.error('chains', chains.length, 'legs', cnt);
}

// ─── analyze ───
if (MODE === 'analyze') {
  const REP = process.argv[3];
  const { legs, cfg } = JSON.parse(fs.readFileSync(REP, 'utf8'));
  const D = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
  const P = { oos: [D('2006-07-01'), D('2018-01-01')], h1: [D('2006-07-01'), D('2012-01-01')], h2: [D('2012-01-01'), D('2018-01-01')], cal: [D('2018-01-01'), D('2026-11-07')],
    s2019_22: [D('2019-01-01'), D('2023-01-01')], s2023_24: [D('2023-01-01'), D('2025-01-01')], s2025_26: [D('2025-01-01'), D('2026-11-07')] };
  const yearOf = (t) => new Date(t * 1000).getUTCFullYear(), monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
  const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
  // positions = first unit + its add; R summed over legs (x size); costs 0.30 (x1) / 0.60 (x2) per unit round trip as cost / r0 per leg
  function positions(list) {
    const byRoot = new Map();
    for (const x of list) { if (x.status === 'expired' || x.status === 'missed') continue; const r = x.addOf || x.id; if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(x); }
    const pos = [];
    for (const [id, L] of byRoot) {
      const first = L.find((x) => !x.addOf); if (!first) continue;
      const cost = (m) => L.reduce((a, x) => a + (x.R - m * 0.30 / x.r0) * (x.size || 1), 0);
      pos.push({ id, side: first.side, t: first.filled ?? first.opened, c: Math.max(...L.map((x) => x.closed)), g: cost(0), n: cost(1), n2: cost(2), add: L.length > 1, atEnd: L.some((x) => x.atEnd), r0: first.r0, exit: first.exit, blk: first.blockedBy || [] });
    }
    return pos.sort((a, b) => a.t - b.t);
  }
  const live = legs.filter((x) => !x.shadow), shadow = legs.filter((x) => x.shadow);
  const pos = positions(live), posSh = positions(shadow);
  function stats(rows, key = 'n') {
    const a = rows.slice().sort((x, y) => x.c - y.c), v = a.map((x) => x[key]), n = v.length;
    if (!n) return { n: 0 };
    const R = v.reduce((p, x) => p + x, 0), mean = R / n, sd = Math.sqrt(v.reduce((p, x) => p + (x - mean) ** 2, 0) / Math.max(1, n - 1));
    let eq = 0, peak = 0, dd = 0; for (const x of v) { eq += x; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); }
    return { n, win: r3(v.filter((x) => x > 0).length / n), mean: r3(mean), R: r2(R), t: n > 1 && sd > 0 ? r2(mean / sd * Math.sqrt(n)) : null, maxDD: r2(dd) };
  }
  const inP = (rows, [a, b]) => rows.filter((x) => x.t >= a && x.t < b);
  function boot(rows, key, blocks = false, B = 10000) {
    let s = 987654321; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const units = blocks ? [...rows.reduce((m, x) => m.set(monthOf(x.t), [...(m.get(monthOf(x.t)) || []), x[key]]), new Map()).values()] : rows.map((x) => [x[key]]);
    const k = units.length; if (k < 2) return null;
    const means = [];
    for (let b = 0; b < B; b++) { let sum = 0, cnt = 0; for (let i = 0; i < k; i++) { const u = units[Math.floor(rnd() * k)]; for (const v of u) { sum += v; cnt++; } } means.push(sum / cnt); }
    means.sort((x, y) => x - y);
    return { lo: r3(means[Math.floor(0.025 * B)]), hi: r3(means[Math.floor(0.975 * B)]), pLE0: r3(means.filter((m) => m <= 0).length / B), units: k };
  }
  const out = { note: 'Mosha BO, live config; net R per position; x1 = 0.30 per unit round trip, x2 = 0.60; OOS = fills 2006-07-01 .. 2017-12-31; calibration = 2018-01-01 .. 2026-11-06', cfg, chains: legs.filter((x) => !x.addOf).length };
  const S = { periods: {}, years: {}, boot: {} };
  for (const [pk, rg] of Object.entries(P)) { const r = inP(pos, rg); S.periods[pk] = { x1: stats(r), x2: stats(r, 'n2'), gross: stats(r, 'g') }; }
  for (let y = 2006; y <= 2026; y++) { const r = pos.filter((x) => yearOf(x.t) === y); S.years[y] = { x1: stats(r), x2: stats(r, 'n2') }; }
  const o = inP(pos, P.oos);
  S.boot = { oos_x1: boot(o, 'n'), oos_x2: boot(o, 'n2'), oos_x1_months: boot(o, 'n', true), oos_x2_months: boot(o, 'n2', true), cal_x1: boot(inP(pos, P.cal), 'n') };
  S.adds = { oos: o.filter((x) => x.add).length, cal: inP(pos, P.cal).filter((x) => x.add).length };
  S.medianStop = { oos: r2(o.map((x) => x.r0).sort((a, b) => a - b)[Math.floor(o.length / 2)] || 0), cal: r2(inP(pos, P.cal).map((x) => x.r0).sort((a, b) => a - b)[Math.floor(inP(pos, P.cal).length / 2)] || 0) };
  S.sides = { oos: { buy: stats(o.filter((x) => x.side === 'buy')), sell: stats(o.filter((x) => x.side === 'sell')) }, cal: { buy: stats(inP(pos, P.cal).filter((x) => x.side === 'buy')), sell: stats(inP(pos, P.cal).filter((x) => x.side === 'sell')) } };
  S.exits = { oos: Object.fromEntries([...new Set(o.map((x) => x.exit))].map((e) => [e, stats(o.filter((x) => x.exit === e))])) };
  // ── pre-registered verdict (the #530 bar) ──
  const po = S.periods.oos, cal = S.periods.cal.x1, yrs = Object.entries(S.years).filter(([y, v]) => +y >= 2006 && +y <= 2017 && v.x1.n);
  const tests = {
    'x1 mean > 0': po.x1.mean > 0, 'x2 mean > 0': po.x2.mean > 0,
    '1 t >= 2.0': (po.x1.t ?? 0) >= 2,
    '2 bootstrap CI lower > 0': (S.boot.oos_x1?.lo ?? -1) > 0,
    '3 both halves > 0': (S.periods.h1.x1.mean ?? -1) > 0 && (S.periods.h2.x1.mean ?? -1) > 0,
    '4 >= half of years positive': yrs.filter(([, v]) => v.x1.R > 0).length >= yrs.length / 2,
    '5 maxDD within 2x calibration': po.x1.maxDD >= 2 * cal.maxDD,
  };
  const fails = !tests['x1 mean > 0'] || !tests['x2 mean > 0'];
  const robust = !fails && ['1 t >= 2.0', '2 bootstrap CI lower > 0', '3 both halves > 0', '4 >= half of years positive', '5 maxDD within 2x calibration'].every((t) => tests[t]);
  S.verdict = { tests, yearsPositive: `${yrs.filter(([, v]) => v.x1.R > 0).length}/${yrs.length}`, verdict: fails ? 'fails' : robust ? 'robust' : 'regime-bound',
    missed: Object.entries(tests).filter(([, v]) => !v).map(([t]) => t), bullOnly: (S.periods.h1.x1.mean ?? 0) > 0 && !((S.periods.h2.x1.mean ?? 0) > 0) };
  out.system = S;
  // ── diagnostics (not part of the verdict) ──
  const dg = { blocked: {}, blockedAll: {}, firstUnitOnly: {}, concentration: {}, liveAddLeak: {} };
  // blocked chains (the live shadow book): what each filter kept out, OOS and calibration, as positions of the shadow book
  for (const [pk, rg] of [['oos', P.oos], ['cal', P.cal]]) {
    const sh = inP(posSh, rg); dg.blockedAll[pk] = { x1: stats(sh), x2: stats(sh, 'n2') };
    dg.blocked[pk] = {}; for (const b of ['weekly', 'cap', 'price', 'momentum']) { const r = sh.filter((x) => x.blk.includes(b)); dg.blocked[pk][b] = { x1: stats(r), only: stats(sh.filter((x) => x.blk.length === 1 && x.blk[0] === b)) }; }
  }
  // the first unit alone (the add never changes the first unit's exit)
  { const rows = live.filter((x) => !x.addOf && x.status === 'closed').map((x) => ({ t: x.filled ?? x.opened, c: x.closed, n: x.R - 0.30 / x.r0, n2: x.R - 0.60 / x.r0, g: x.R }));
    dg.firstUnitOnly = Object.fromEntries(['oos', 'h1', 'h2', 'cal'].map((p) => [p, { x1: stats(inP(rows, P[p])), x2: stats(inP(rows, P[p]), 'n2') }])); }
  // concentration: OOS without the best 5 positions
  { const v = o.map((x) => x.n).sort((a, b) => b - a); dg.concentration = { oos_total: r2(v.reduce((a, b) => a + b, 0)), oos_without_best5: r2(v.slice(5).reduce((a, b) => a + b, 0)), best5: v.slice(0, 5).map(r2) }; }
  // live-code finding: the generic add is recorded shadow: false, so an add spawned by a blocked (shadow) chain would enter the live record
  { const leak = shadow.filter((x) => x.addOf && x.status === 'closed').map((x) => ({ t: x.filled, c: x.closed, n: (x.R - 0.30 / x.r0) * (x.size || 1), n2: (x.R - 0.60 / x.r0) * (x.size || 1), g: x.R * (x.size || 1) }));
    dg.liveAddLeak = { oos: stats(inP(leak, P.oos)), cal: stats(inP(leak, P.cal)) }; }
  // gold's own calendar-year change (OANDA D1 closes) and its correlation with the system's years, 2006-17
  if (process.env.CANDLES) {
    const D1 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-1d.json.gz'))));
    const yc = {}; for (const r of D1) { const y = yearOf(r[0]); (yc[y] = yc[y] || { first: r[1], last: r[4] }).last = r[4]; }
    const gy = {}; for (let y = 2006; y <= 2026; y++) if (yc[y]) gy[y] = r3((yc[y].last / (yc[y - 1] ? yc[y - 1].last : yc[y].first) - 1));
    const corr = (a, b) => { const n = a.length, ma = a.reduce((p, x) => p + x, 0) / n, mb = b.reduce((p, x) => p + x, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return r2(sab / Math.sqrt(saa * sbb)); };
    const ys = Array.from({ length: 12 }, (_, i) => 2006 + i);
    dg.goldYear = gy; dg.corrWithGoldYear = corr(ys.map((y) => S.years[y].x1.R || 0), ys.map((y) => gy[y]));
  }
  out.diagnostics = dg;
  // ── pre-declared diagnostic: the decay monitor (council/decay.mjs, live baseline council/decay-base.json) walked forward over the record ──
  const { assess, loadBase } = await import('../../../council/decay.mjs');
  const base = loadBase().systems['mosha-bo'];
  function walk(rows) {
    const pts = rows.slice().sort((a, b) => a.c - b.c).map((p) => ({ t: p.c, R: r3(p.n), src: 'hist' }));
    const st = [], firstDecay = {}; let nDec = 0, nWatch = 0, worstS = 0;
    for (let i = 1; i <= pts.length; i++) { const a = assess(pts.slice(0, i), base); st.push(a.status); if (a.status === 'decaying') { nDec++; firstDecay.t = firstDecay.t ?? pts[i - 1].t; } if (a.status === 'watch') nWatch++; worstS = Math.max(worstS, a.cusRef.s); }
    const fin = pts.length ? assess(pts, base) : null;
    const years = {}; for (let i = 0; i < pts.length; i++) { const y = yearOf(pts[i].t); years[y] = years[y] || { n: 0, decaying: 0, watch: 0 }; years[y].n++; if (st[i] === 'decaying') years[y].decaying++; if (st[i] === 'watch') years[y].watch++; }
    return { n: pts.length, decayingAt: nDec, watchAt: nWatch, shareDecaying: pts.length ? r3(nDec / pts.length) : null, firstDecaying: firstDecay.t ? new Date(firstDecay.t * 1000).toISOString().slice(0, 10) : null, worstCusum: r2(worstS), limit: base.h,
      final: fin ? { status: fin.status, cusRef: fin.cusRef, cusZero: fin.cusZero, dd: fin.dd, roll: fin.roll, why: fin.why } : null, years };
  }
  out.decay = { base: { ref: base.ref, sd: base.sd, k: base.k, h: base.h, W: base.W, ddLimit: base.ddLimit, src: base.src }, oos: walk(o), h1: walk(inP(pos, P.h1)), h2: walk(inP(pos, P.h2)), cal: walk(inP(pos, P.cal)) };
  out.positions = pos.map((p) => ({ id: p.id, side: p.side, t: new Date(p.t * 1000).toISOString().slice(0, 16), c: new Date(p.c * 1000).toISOString().slice(0, 16), g: r3(p.g), n: r3(p.n), n2: r3(p.n2), add: p.add, r0: r2(p.r0), exit: p.exit, atEnd: p.atEnd || undefined }));
  console.log(JSON.stringify(out, null, 1));
}
