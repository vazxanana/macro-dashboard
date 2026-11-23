// Box zone study (pre-registered 22 Nov 2026, PREREGISTRATION.md). Pure functions + `node run.mjs fetch <dir>` / `node run.mjs run <dir>`.
// Candles stay outside git (OANDA mid through the site's candle proxy).
import fs from 'node:fs';
import path from 'node:path';

export const MARKETS = { eurusd: 0.00006, gbpusd: 0.00008, audusd: 0.00006, usdjpy: 0.008, xau: 0.25 };
export const FROM = Date.UTC(2010, 0, 1) / 1000, TO = Date.UTC(2020, 0, 1) / 1000, HALF = Date.UTC(2015, 0, 1) / 1000;
export const MIN_N = 3;

// Weekend candles (OANDA's Sunday stub) folded into Monday.
export function fold(B) {
  const o = []; let c = null;
  for (const b of B) {
    const wd = new Date(b.time * 1e3).getUTCDay();
    if (wd === 0 || wd === 6) { c = c ? { ...c, high: Math.max(c.high, b.high), low: Math.min(c.low, b.low), close: b.close } : { ...b }; continue; }
    if (c) { o.push({ ...b, open: c.open, high: Math.max(b.high, c.high), low: Math.min(b.low, c.low) }); c = null; } else o.push(b);
  }
  return o;
}

// Every box that ended (closed out), any length: { i0, i1, bi (the breaking candle), hi, lo, dir, n, known }.
export function boxes(C, sec) {
  const out = []; let b = null;
  for (let i = 0; i < C.length; i++) {
    const x = C[i];
    if (!b) { b = { i0: i, i1: i, hi: x.high, lo: x.low }; continue; }
    if (x.close > b.hi || x.close < b.lo) {
      out.push({ ...b, dir: x.close > b.hi ? 1 : -1, bi: i, n: b.i1 - b.i0 + 1, known: x.time + sec });
      b = { i0: i, i1: i, hi: x.high, lo: x.low }; continue;
    }
    b.i1 = i; b.hi = Math.max(b.hi, x.high); b.lo = Math.min(b.lo, x.low);
  }
  return out;
}

// Daily zones: a box (3+ candles) that breaks the other way from the break before it; joined with the next box when it breaks
// the same way and overlaps. dead = when the first Daily close beyond its far side is known. A join is known only once the next
// box closes out, so the first box stands alone from its own known time until then (its life capped at the join's known time),
// and the joined zone starts at the join's known time (review of 23 Nov 2026: before, the join was used from the first box's
// known time, a look-ahead by selection).
export function zones(D) {
  const DB = boxes(D, 86400), Z = [];
  const deadOf = (z) => { for (let i = z.from + 1; i < D.length; i++) { const c = D[i].close; if (z.dir < 0 ? c > z.hi : c < z.lo) return D[i].time + 86400; } return Infinity; };
  for (let k = 1; k < DB.length; k++) {
    const a = DB[k - 1], b = DB[k];
    if (b.dir === a.dir || b.n < MIN_N) continue;
    const z = { dir: b.dir, hi: b.hi, lo: b.lo, known: b.known, from: b.bi };
    z.dead = deadOf(z);
    const n = DB[k + 1];
    if (n && n.dir === b.dir && n.n >= MIN_N && n.lo <= b.hi && n.hi >= b.lo) {
      const j = { dir: b.dir, hi: Math.max(b.hi, n.hi), lo: Math.min(b.lo, n.lo), known: n.known, from: n.bi, joined: true };
      j.dead = deadOf(j);
      z.dead = Math.min(z.dead, n.known);
      Z.push(z);
      if (j.dead > j.known) Z.push(j);
      continue;
    }
    Z.push(z);
  }
  return Z;
}

// Candidate entries on H4 for every zone visit.
export function candidates(D, H) {
  const Z = zones(D), HB = boxes(H, 14400), at = new Map(HB.map((b) => [b.bi, b])), out = [];
  for (const z of Z) {
    let left = false, inside = false, test = null;
    for (let i = 0; i < H.length; i++) {
      const x = H[i], t = x.time + 14400;
      if (t <= z.known) continue;
      if (t > z.dead) break;
      if (!left) { if (z.dir < 0 ? x.high < z.lo : x.low > z.hi) left = true; continue; }
      if (!inside) { if (z.dir < 0 ? x.high >= z.lo : x.low <= z.hi) inside = true; else continue; }
      const b = at.get(i);
      if (!b) continue;
      if (b.dir === -z.dir) { test = b; continue; }
      if (!test || b.n < MIN_N) continue;
      const d = z.dir, entry = x.close, stop = d > 0 ? b.lo : b.hi, tgt = d > 0 ? test.hi : test.lo, risk = Math.abs(entry - stop);
      if (!(risk > 0) || !(d > 0 ? tgt > entry : tgt < entry)) continue;
      out.push({ t, i, d, entry, stop, tgt, risk, rr: Math.abs(tgt - entry) / risk });
      left = false; inside = false; test = null; // one trade per visit
    }
  }
  return out.sort((a, b) => a.t - b.t || a.i - b.i);
}

// Stop first when one candle holds both; one open position per market.
export function trades(D, H, cost) {
  const T = []; let busy = 0;
  for (const c of candidates(D, H)) {
    if (c.t < busy || c.t < FROM || c.t >= TO) continue;
    let R = null, j;
    for (j = c.i + 1; j < H.length; j++) {
      const y = H[j];
      if (c.d > 0 ? y.low <= c.stop : y.high >= c.stop) { R = -1; break; }
      if (c.d > 0 ? y.high >= c.tgt : y.low <= c.tgt) { R = c.rr; break; }
    }
    busy = j < H.length ? H[j].time + 14400 : Infinity;
    if (R == null) continue;
    T.push({ ...c, R, cr: cost / c.risk });
  }
  return T;
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
export function tstat(a) { const n = a.length; if (n < 2) return null; const m = mean(a), sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : null; }
export function monthT(T, f) { const M = new Map(); for (const x of T) { const k = new Date(x.t * 1e3).toISOString().slice(0, 7); M.set(k, (M.get(k) || 0) + f(x)); } return tstat([...M.values()]); }
export function stats(T, k = 1) {
  const net = T.map((x) => x.R - k * x.cr);
  return { n: T.length, won: T.filter((x) => x.R > 0).length, mean: +mean(net).toFixed(4), total: +net.reduce((s, v) => s + v, 0).toFixed(2), tTrade: tstat(net) && +tstat(net).toFixed(2), tMonth: monthT(T, (x) => x.R - k * x.cr) && +monthT(T, (x) => x.R - k * x.cr).toFixed(2) };
}

export function report(byMkt) {
  const all = Object.values(byMkt).flat(), h1 = all.filter((x) => x.t < HALF), h2 = all.filter((x) => x.t >= HALF);
  const pool = stats(all), x2 = stats(all, 2), gross = stats(all, 0);
  const markets = Object.fromEntries(Object.entries(byMkt).map(([k, T]) => [k, { ...stats(T), gross: stats(T, 0).mean, min1R: stats(T.filter((x) => x.rr >= 1)) }]));
  const checks = {
    meanAndMonthT: pool.mean > 0 && pool.tMonth >= 2,
    bothHalves: stats(h1).mean > 0 && stats(h2).mean > 0,
    threeMarkets: Object.values(markets).filter((m) => m.mean > 0).length >= 3,
    doubleCost: x2.mean > 0,
  };
  return { pool, halves: { '2010-2014': stats(h1), '2015-2019': stats(h2) }, doubleCost: x2, gross, min1R: stats(all.filter((x) => x.rr >= 1)), markets, checks,
    passed: Object.values(checks).filter(Boolean).length, verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    medianTargetR: +[...all].map((x) => x.rr).sort((a, b) => a - b)[all.length >> 1].toFixed(2) };
}

async function fetchAll(dir) {
  const base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/';
  const get = async (sym, tf, from, to, step) => {
    const m = new Map();
    for (let a = from; a < to; a += step) {
      const r = await fetch(`${base}bars?sym=${sym}&tf=${tf}&from=${a}&to=${Math.min(to, a + step)}`);
      for (const b of (await r.json()).bars || []) m.set(b.time, b);
      await new Promise((r) => setTimeout(r, 300));
    }
    return [...m.values()].sort((a, b) => a.time - b.time);
  };
  fs.mkdirSync(dir, { recursive: true });
  const from = Date.UTC(2009, 5, 1) / 1000, to = Date.UTC(2020, 2, 1) / 1000;
  for (const s of Object.keys(MARKETS)) for (const [tf, st] of [['1d', 3000 * 86400], ['4h', 700 * 86400]]) fs.writeFileSync(path.join(dir, `${s}-${tf}.json`), JSON.stringify(await get(s, tf, from, to, st)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir);
  else if (cmd === 'run') {
    const byMkt = {};
    for (const [s, cost] of Object.entries(MARKETS)) {
      const D = fold(JSON.parse(fs.readFileSync(path.join(dir, `${s}-1d.json`)))), H = JSON.parse(fs.readFileSync(path.join(dir, `${s}-4h.json`)));
      byMkt[s] = trades(D, H, cost);
    }
    const r = report(byMkt);
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify({ study: 'box-zone', built: '2026-11-22', window: '2010-01-01 to 2019-12-31', ...r }, null, 1) + '\n');
    console.log(JSON.stringify(r, null, 1));
  }
}
