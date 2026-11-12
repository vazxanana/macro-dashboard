// Edge research · shadow-scalp-filters: five pre-registered filters on the engine's scalp / intraday family
// (scalp, intraday, rscalp, rintra), 2020 to Oct 2026, net of costs, IS 2020-23 vs OOS 2024 on. See PREREGISTRATION.md.
// Usage:
//   node research/edge/shadow-scalp-filters/run.mjs fetch <candleDir>            candles from origin/council-data (git, no network)
//   node research/edge/shadow-scalp-filters/run.mjs market <key> <candleDir> <outDir>   replay one market → <outDir>/<key>.json
//   node research/edge/shadow-scalp-filters/run.mjs report <outDir>             → result.json next to this file (+ tables on stdout)
// Every function that decides a trade is imported unchanged (engine, cleaner, fills, HistData clock); the replay loop is the
// council/backtest.mjs loop (a CLI, not importable) restricted to the four setups and the live exit (R_none).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { msAnalyze, CFG, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from '../../../council/engine.mjs';
import { cleanBars, LTF_CLEAN } from '../../../council/clean.mjs';
import { replayBar, spotSkip, tradeCost, spreadOf } from '../../../council/fills.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ─── markets (pre-registered) ───
export const MARKETS = {
  xau: { dir: 'xau-histdata', sym: 'XAUUSD', base: '1m', M: { group: 'Metals', spot: true, dec: 2 } },
  eurusd: { dir: 'EURUSD', sym: 'EURUSD', base: '1m', M: { group: 'Forex', dec: 5 } },
  gbpusd: { dir: 'GBPUSD', sym: 'GBPUSD', base: '1m', M: { group: 'Forex', dec: 5 } },
  audusd: { dir: 'AUDUSD', sym: 'AUDUSD', base: '1m', M: { group: 'Forex', dec: 5 } },
  usdcad: { dir: 'USDCAD', sym: 'USDCAD', base: '1m', M: { group: 'Forex', dec: 5 } },
  usdchf: { dir: 'USDCHF', sym: 'USDCHF', base: '1m', M: { group: 'Forex', dec: 5 } },
  btc: { dir: 'crypto5m', sym: 'BTCUSDT', base: '5m', M: { group: 'Crypto', dec: 1 } },
  eth: { dir: 'crypto5m', sym: 'ETHUSDT', base: '5m', M: { group: 'Crypto', dec: 2 } },
  sol: { dir: 'crypto5m', sym: 'SOLUSDT', base: '5m', M: { group: 'Crypto', dec: 2 } },
  xrp: { dir: 'crypto5m', sym: 'XRPUSDT', base: '5m', M: { group: 'Crypto', dec: 4 } },
};
export const WIN = { warm: { m1: Date.UTC(2019, 6, 1) / 1000, c5: Date.UTC(2022, 0, 1) / 1000 },
  from: { m1: Date.UTC(2020, 0, 1) / 1000, c5: Date.UTC(2022, 2, 1) / 1000 }, oos: Date.UTC(2024, 0, 1) / 1000, to: Date.UTC(2026, 10, 1) / 1000 };
export const LIVE_CFG = { buf: 0.15, minRisk: 1.1 };   // council-data config.json, 12 Nov 2026
const SEC = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
const WAIT = { '15m': 3 * 3600, '1h': 12 * 3600 };
const FRESH = 12, VIEW = 720, STEP = 300;
export const FAMILY = ['scalp', 'intraday', 'rscalp', 'rintra'];
const DEFS = PAIRS.filter((p) => FAMILY.includes(p.k)).map((p) => [p, buildSetup]).concat(RETR.filter((p) => FAMILY.includes(p.k)).map((p) => [p, buildRetrace]));

// ─── fetch ───
function fetchCandles(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const git = (args, enc) => execFileSync('git', args, { encoding: enc, maxBuffer: 1 << 30, cwd: path.join(HERE, '../../..') });
  for (const [key, m] of Object.entries(MARKETS)) {
    const names = git(['ls-tree', '--name-only', `origin/council-data`, `research/candles/${m.dir}/`], 'utf8').split('\n').filter(Boolean)
      .filter((f) => path.basename(f).startsWith(m.sym + '_') && (m.base === '5m' || +path.basename(f).match(/_M1_(\d{4})/)[1] >= 2019));
    for (const f of names) { const out = path.join(dir, path.basename(f)); if (!fs.existsSync(out)) fs.writeFileSync(out, git(['show', `origin/council-data:${f}`], 'buffer')); }
    console.log(key, names.length, 'files');
  }
}

// ─── candles ───
export function aggregate(bars, sec, shift = 0) {
  const out = []; let cur = null;
  for (const b of bars) {
    const t0 = Math.floor((b.time + shift) / sec) * sec - shift;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { if (b.high > cur.high) cur.high = b.high; if (b.low < cur.low) cur.low = b.low; cur.close = b.close; }
  }
  return out;
}
function loadBase(key, cdir) {
  const m = MARKETS[key], out = [];
  if (m.base === '5m') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cdir, `${m.sym}_5m.json.gz`))));
    for (const r of rows) if (r[0] >= WIN.warm.c5 && r[0] < WIN.to) out.push({ time: r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4] });
    return out;
  }
  const files = fs.readdirSync(cdir).filter((f) => f.startsWith(m.sym + '_M1_')).sort();
  for (const f of files) {
    for (const line of zlib.gunzipSync(fs.readFileSync(path.join(cdir, f))).toString('utf8').split('\n')) {
      if (line.length < 20) continue;
      const p = line.split(';'), t = histStampUtc(p[0]);
      if (t < WIN.warm.m1 || t >= WIN.to || (out.length && t <= out[out.length - 1].time)) continue;
      out.push({ time: t, open: +p[1], high: +p[2], low: +p[3], close: +p[4] });
    }
  }
  return out;
}

// ─── replay one market ───
function replayMarket(key, cdir, odir) {
  const mk = MARKETS[key], M = mk.M, crypto = M.group === 'Crypto';
  CFG.buf = LIVE_CFG.buf; CFG.minRisk = LIVE_CFG.minRisk; setMarket(M);
  const base = loadBase(key, cdir), bsec = SEC[mk.base];
  console.log(`${key}: ${base.length} ${mk.base} candles ${new Date(base[0].time * 1000).toISOString().slice(0, 10)} → ${new Date(base.at(-1).time * 1000).toISOString().slice(0, 10)}`);
  const ids = mk.base === '1m' ? ['5m', '15m', '1h', '4h', '1d'] : ['15m', '1h', '4h', '1d'];
  const TF = { [mk.base]: base };
  for (const id of ids) TF[id] = aggregate(base, SEC[id], id === '1d' && !crypto ? 2 * 3600 : 0);   // gold / forex days end 17:00 New York (22:00 UTC)
  const wick = (id) => M.group === 'Forex' && LTF_CLEAN.has(id) ? { wickK: 15 } : {};
  for (const id of ids) cleanBars(TF[id], wick(id));
  { const CH = 200000; for (let s = 0; s < base.length; s += CH) {   // the base in chunks (the cleaner looks 100 back, 3 ahead)
    const a = Math.max(0, s - 150), e = Math.min(base.length, s + CH), arr = base.slice(a, Math.min(base.length, e + 4)).map((b) => ({ ...b }));
    cleanBars(arr, wick(mk.base));
    for (let i = s; i < e; i++) base[i] = arr[i - a];
  } }
  const ptr = {};
  let ib = 0;
  function view(id, t) {
    const sec = SEC[id], arr = TF[id]; let p = ptr[id] || 0;
    while (p < arr.length && arr[p].time + sec <= t) p++;
    ptr[id] = p;
    const bars = arr.slice(Math.max(0, p - (id === mk.base ? VIEW : VIEW - 1)), p);
    if (id !== mk.base && id !== '1d') {   // forming candle from the base candles of this period
      const f0 = Math.floor(t / sec) * sec; let f = null;
      for (let j = ib - 1; j >= 0 && base[j].time >= f0; j--) { const b = base[j]; f = f ? { time: f0, open: b.open, high: Math.max(f.high, b.high), low: Math.min(f.low, b.low), close: f.close } : { time: f0, open: b.open, high: b.high, low: b.low, close: b.close }; }
      if (f) bars.push(f);
    }
    return bars;
  }
  const from = crypto ? WIN.from.c5 : WIN.from.m1, steps0 = Math.floor(from / STEP) * STEP;
  const seen = new Set(), open = [], done = [];
  const marketOpen = (t) => { if (crypto) return true; const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
  let steps = 0, lastIb = -1; const t0w = Date.now();
  for (let t = steps0; t < WIN.to; t += STEP) {
    while (ib < base.length && base[ib].time < t) {
      const b = base[ib++], shut = !crypto && spotSkip(b.time);
      for (const tr of open) replayBar(tr, b, { shut, wait: WAIT[tr.h] });
      for (let k = open.length - 1; k >= 0; k--) { const s = open[k].status; if (s !== 'pending' && s !== 'open') { const tr = open.splice(k, 1)[0]; if (s === 'closed') done.push(tr); } }
    }
    if (ib === lastIb || !marketOpen(t)) continue;
    lastIb = ib;
    const src = {}, price = base[ib - 1].close;
    const ltf = mk.base === '1m' ? ['1m', '5m'] : ['5m'];
    for (const id of ltf) { const bars = view(id, t); if (bars.length >= 60) src[id] = { bars, A: msAnalyze(bars, 6) }; }
    // a signal needs its confirming lower-timeframe break within FRESH candles of that timeframe: skip the higher one otherwise
    const fresh = (id) => { const s = src[id], ll = s && s.A.last; return !!ll && t - s.bars[ll.breakIdx].time <= FRESH * SEC[id]; };
    const need = new Set();
    for (const [pr] of DEFS) if (src[pr.l] && fresh(pr.l)) need.add(pr.h);
    if (!need.size) continue;
    for (const id of need) { const bars = view(id, t); if (bars.length >= 60) src[id] = { bars, A: msAnalyze(bars, 6) }; }
    steps++;
    for (const [pr, fn] of DEFS) {
      if (!src[pr.h] || !src[pr.l]) continue;
      let st; try { st = fn(pr, price, src); } catch (e) { st = null; }
      if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
      seen.add(st.sig);
      const side = st.sell ? 'sell' : 'buy';
      if (open.some((x) => x.k === st.k && x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
      const cfT = +String(st.sig).split('|')[2];
      if (!cfT || t - cfT > FRESH * SEC[pr.l]) continue;
      if (t < from) continue;
      const tr = { m: key, k: st.k, h: pr.h, side, entry: st.entry, stop: st.stop, t1: st.t1, rr: st.rr, opened: t, status: 'pending', mfe: 0, mode: 'limit' };
      if (st.sell ? price >= st.entry : price <= st.entry) {
        const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
        if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
        tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t; tr.mode = 'market';
      }
      tr.r0 = Math.abs(tr.entry - tr.stop);
      if (!(tr.r0 > 0)) continue;
      // features at the signal (no later data): H4 and D1 trend, stop in spreads, expected cost at entry (stop exit, no financing)
      const v4 = view('4h', t), v1d = view('1d', t), dir = st.sell ? -1 : 1;
      const h4 = v4.length >= 60 ? msAnalyze(v4, 6).trend : 0, d1 = v1d.length > 100 ? msAnalyze(v1d, 6).trend : 0;
      tr.h4 = h4 === dir ? 'with' : h4 === -dir ? 'against' : 'none';
      tr.d1 = d1 === dir ? 'with' : d1 === -dir ? 'against' : 'none';
      tr.spreads = tr.r0 / spreadOf(M, tr.entry);
      const ec = tradeCost({ entry: tr.entry, r0: tr.r0, entryMode: tr.mode, exitKind: 'stop', side, opened: t }, M);
      tr.expCost = ec ? ec.costR : null;
      tr.v = [{ n: 'none', be: null, t2: false, pt: undefined, stop: tr.stop, beMoved: false, done: false, R: null, size: 1, booked: 0, best: 0 }];
      open.push(tr);
    }
    if (steps % 100000 === 0) console.log(`${key} ${new Date(t * 1000).toISOString().slice(0, 10)} steps ${steps} trades ${done.length} ${((Date.now() - t0w) / 1000).toFixed(0)}s`);
  }
  const rows = done.map((x) => {
    const v = x.v[0], exitKind = v.R === x.rr ? 'target' : 'stop';
    const c = tradeCost({ market: key, side: x.side, entry: x.entry, r0: x.r0, entryMode: x.mode, exitKind, opened: x.opened, filled: x.filled, closed: v.closed }, M);
    return [x.opened, x.filled, v.closed, x.k, x.side, +x.entry.toPrecision(8), +x.r0.toPrecision(6), +x.rr.toFixed(3), +v.R.toFixed(3), +c.costR.toFixed(4),
      +(x.expCost != null ? x.expCost : c.costR).toFixed(4), x.h4, x.d1, x.mode, exitKind, +x.spreads.toFixed(2), +c.finR.toFixed(4)];
  });
  fs.mkdirSync(odir, { recursive: true });
  fs.writeFileSync(path.join(odir, `${key}.json`), JSON.stringify({ key, base: mk.base, from, to: WIN.to, steps, openAtEnd: open.length, cfg: LIVE_CFG,
    cols: COLS, rows }));
  console.log(`${key}: ${steps} steps, ${rows.length} closed trades, ${open.length} open / pending at the end, ${((Date.now() - t0w) / 1000).toFixed(0)}s`);
}
export const COLS = ['opened', 'filled', 'closed', 'k', 'side', 'entry', 'r0', 'rr', 'R', 'costR', 'expCost', 'h4', 'd1', 'mode', 'exit', 'spreads', 'finR'];

// ─── the five filters (PREREGISTRATION.md): each returns true when it REMOVES the trade ───
export const FILTERS = {
  F1: { name: 'No retrace setups (rscalp, rintra)', removes: (x) => x.k === 'rscalp' || x.k === 'rintra' },
  F2: { name: 'Only with the H4 trend', removes: (x) => x.h4 === 'against' },
  F3: { name: 'Stop of 8 spreads or more', removes: (x) => x.spreads < 8 },
  F4: { name: 'No SOL / ETH trade with expected cost over 0.5R', removes: (x) => (x.m === 'sol' || x.m === 'eth') && x.expCost > 0.5 },
  F5: { name: 'Only 07:00-13:00 UTC', removes: (x) => { const h = new Date(x.opened * 1000).getUTCHours(); return h < 7 || h >= 13; } },
};

// ─── statistics ───
const lgamma = (z) => { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); };
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// one-sided p of Student t (P[T >= t]) with df degrees of freedom
export function pOneSided(t, df) { if (!Number.isFinite(t) || !(df > 0)) return null; const x = df / (df + t * t), tail = 0.5 * ibeta(df / 2, 0.5, x); return t >= 0 ? tail : 1 - tail; }
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).filter(([p]) => p != null).sort((a, b) => a[0] - b[0]), out = ps.map(() => null), m = idx.length; let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); out[i] = run; });
  return out;
}
export function monthKeys(from, to) { const out = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), mo = d.getUTCMonth();
  while (Date.UTC(y, mo, 1) / 1000 < to) { out.push(`${y}-${String(mo + 1).padStart(2, '0')}`); if (++mo === 12) { mo = 0; y++; } } return out; }
export const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function tStat(a) { const n = a.length; if (n < 2) return null; const m = a.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : null; }
const net = (x, k) => x.R - k * x.costR;
const r3 = (v) => v == null || !Number.isFinite(v) ? null : +v.toFixed(3);
// one filter on one window: the months' D (R saved = minus the net R of the removed trades), t, and the book before / after
export function filterStats(rows, removes, months, k = 1) {
  const D = Object.fromEntries(months.map((m) => [m, 0])), K = Object.fromEntries(months.map((m) => [m, 0])), inWin = rows.filter((x) => monthOf(x.opened) in D);
  let nr = 0, sr = 0, sk = 0;
  for (const x of inWin) { const v = net(x, k), mo = monthOf(x.opened); if (removes(x)) { nr++; sr += v; D[mo] -= v; } else { sk += v; K[mo] += v; } }
  const n = inWin.length, base = n ? (sr + sk) / n : null, kept = n - nr ? sk / (n - nr) : null, d = Object.values(D), t = tStat(d);
  return { n, removed: nr, kept: n - nr, removedR: r3(sr), removedPerTrade: nr ? r3(sr / nr) : null, baselinePerTrade: r3(base), keptPerTrade: r3(kept),
    improvementPerTrade: base != null && kept != null ? r3(kept - base) : null, D: r3(-sr), months: months.length, t: r3(t), p: t == null ? null : +pOneSided(t, months.length - 1).toPrecision(4),
    keptR: r3(sk), keptT: r3(tStat(Object.values(K))) };
}
// Post-hoc diagnostics (NOT in the pre-registration; added after the first report, see RESULT.md):
// selection = do the removed trades lose MORE per trade than the kept ones? month by month, mean net R of the removed minus
// mean net R of the kept (months with both), t on those monthly differences (negative = the filter removes the worse trades).
export function selection(rows, removes, months, k = 1) {
  const S = new Set(months), by = new Map();
  for (const x of rows) { const mo = monthOf(x.opened); if (!S.has(mo)) continue; const g = by.get(mo) || { r: [0, 0], k: [0, 0] }; const v = net(x, k), a = removes(x) ? g.r : g.k; a[0] += v; a[1]++; by.set(mo, g); }
  const d = [...by.values()].filter((g) => g.r[1] && g.k[1]).map((g) => g.r[0] / g.r[1] - g.k[0] / g.k[1]);
  return { months: d.length, meanDiff: d.length ? r3(d.reduce((s, v) => s + v, 0) / d.length) : null, t: r3(tStat(d)) };
}
// placebo: remove the same share of trades at random (a fixed hash of the trade, no market fact): what the pre-registered
// statistic gives for a filter that knows nothing
export const hashU = (x) => { let h = 2166136261; for (const c of `${x.m}|${x.k}|${x.opened}|${x.side}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1e6) / 1e6; };
export function placebo(rows, share, months, k = 1) { return filterStats(rows, (x) => hashU(x) < share, months, k); }

export function rowsOf(file) { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j.rows.map((r) => Object.assign(Object.fromEntries(j.cols.map((c, i) => [c, r[i]])), { m: j.key })); }

export function evaluate(rows) {
  const ISm = monthKeys(WIN.from.m1, WIN.oos), OOSm = monthKeys(WIN.oos, WIN.to);
  const out = { windows: { IS: [ISm[0], ISm.at(-1)], OOS: [OOSm[0], OOSm.at(-1)] }, filters: {} };
  const base = (ms, k) => { const a = rows.filter((x) => ms.includes(monthOf(x.opened))); return { n: a.length, perTrade: a.length ? r3(a.reduce((s, x) => s + net(x, k), 0) / a.length) : null, total: r3(a.reduce((s, x) => s + net(x, k), 0)) }; };
  out.baseline = { IS: base(ISm, 1), OOS: base(OOSm, 1), OOSgross: base(OOSm, 0), ISgross: base(ISm, 0) };
  for (const [id, f] of Object.entries(FILTERS)) {
    const r = { name: f.name, IS: filterStats(rows, f.removes, ISm, 1), OOS: filterStats(rows, f.removes, OOSm, 1),
      OOScost: Object.fromEntries([['x0', 0], ['x05', 0.5], ['x1', 1], ['x2', 2]].map(([n, k]) => [n, filterStats(rows, f.removes, OOSm, k)])),
      bySetup: {}, byMarket: {} };
    for (const s of FAMILY) { const a = rows.filter((x) => x.k === s); r.bySetup[s] = { IS: filterStats(a, f.removes, ISm, 1), OOS: filterStats(a, f.removes, OOSm, 1) }; }
    for (const m of Object.keys(MARKETS)) { const a = rows.filter((x) => x.m === m); if (a.length) r.byMarket[m] = { IS: filterStats(a, f.removes, ISm, 1), OOS: filterStats(a, f.removes, OOSm, 1) }; }
    out.filters[id] = r;
  }
  const ids = Object.keys(FILTERS), adj = holm(ids.map((id) => out.filters[id].OOS.p));
  ids.forEach((id, i) => {
    const r = out.filters[id]; r.holmP = adj[i] == null ? null : +adj[i].toPrecision(4);
    r.checks = { oosT2Holm: r.OOS.t != null && r.OOS.t >= 2 && r.holmP != null && r.holmP <= 0.05, bothHalves: r.IS.D > 0 && r.OOS.D > 0, costs: r.OOScost.x05.D > 0 && r.OOScost.x2.D > 0 };
    r.pass = r.checks.oosT2Holm && r.checks.bothHalves && r.checks.costs;
  });
  out.passed = ids.filter((id) => out.filters[id].pass);
  out.barVerdict = out.passed.length ? `PASS for ${out.passed.join(', ')} (${out.passed.length} of 5)` : 'FAIL, 0 of 5';
  // post-hoc: selection and placebo (see selection / placebo above)
  for (const id of ids) {
    const r = out.filters[id], f = FILTERS[id];
    r.selection = { IS: selection(rows, f.removes, ISm, 1), OOS: selection(rows, f.removes, OOSm, 1), OOSgross: selection(rows, f.removes, OOSm, 0) };
    const share = r.OOS.n ? r.OOS.removed / r.OOS.n : 0, pl = placebo(rows, share, OOSm, 1);
    r.placebo = { share: r3(share), D: pl.D, t: pl.t, removedPerTrade: pl.removedPerTrade, keptPerTrade: pl.keptPerTrade };
  }
  const placeboPasses = ids.filter((id) => out.filters[id].placebo.t >= 2).length;
  out.barDefect = placeboPasses > 0;
  out.verdict = !out.passed.length ? 'FAIL, 0 of 5'
    : out.barDefect ? `INCONCLUSIVE: the pre-registered bar passes ${out.passed.length} of 5, but a random filter of the same size passes it too (${placeboPasses} of 5 placebos)`
    : out.barVerdict;
  return out;
}

function report(odir) {
  const files = fs.readdirSync(odir).filter((f) => f.endsWith('.json') && MARKETS[f.slice(0, -5)]);
  const rows = files.flatMap((f) => rowsOf(path.join(odir, f)));
  const meta = Object.fromEntries(files.map((f) => { const j = JSON.parse(fs.readFileSync(path.join(odir, f), 'utf8')); return [j.key, { base: j.base, from: new Date(j.from * 1000).toISOString().slice(0, 10), trades: j.rows.length, openAtEnd: j.openAtEnd }]; }));
  const ev = evaluate(rows);
  const res = { study: 'shadow-scalp-filters', title: 'Five filters on the shadow scalp / intraday setups', built: new Date().toISOString().slice(0, 10),
    preregistration: 'research/edge/shadow-scalp-filters/PREREGISTRATION.md', verdict: ev.verdict, markets: meta, cfg: LIVE_CFG, family: FAMILY, ...ev };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log('baseline', JSON.stringify(ev.baseline));
  for (const [id, r] of Object.entries(ev.filters)) console.log(id, r.name, '| IS', JSON.stringify(r.IS), '| OOS', JSON.stringify(r.OOS), '| holm', r.holmP, '| x0.5 D', r.OOScost.x05.D, 'x2 D', r.OOScost.x2.D, 'x0 D', r.OOScost.x0.D, '| pass', r.pass);
  for (const [id, r] of Object.entries(ev.filters)) console.log(id, 'selection', JSON.stringify(r.selection), 'placebo', JSON.stringify(r.placebo));
  console.log(ev.barVerdict); console.log(ev.verdict);
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
if (cmd === 'fetch') fetchCandles(a1);
else if (cmd === 'market') replayMarket(a1, a2, a3);
else if (cmd === 'report') report(a1);
