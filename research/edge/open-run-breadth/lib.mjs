// The NQ New York open run (council/trader.mjs nqOpenSweep + nyflip, as copied in research/edge/nq-open-oos/lib.mjs), made
// session-generic: open minute, time zone and midnight are per market; every threshold is the live one. Paper research only.
import fs from 'node:fs';
import path from 'node:path';

// Pre-registered sessions (preregistration.md). cost = primary all-in round trip in index points.
export const MARKETS = {
  nas100: { name: 'NQ', tz: 'America/New_York', open: 570, cost: 1.37 },
  spx500: { name: 'ES', tz: 'America/New_York', open: 570, cost: 1.0 },
  us30: { name: 'YM', tz: 'America/New_York', open: 570, cost: 5.5 },
  de40: { name: 'DAX', tz: 'Europe/Berlin', open: 540, cost: 2.0 },
};

const fmts = new Map(), cache = new Map();
export function partsIn(tz, t) {
  const key = tz + Math.floor(t / 60); const c = cache.get(key); if (c) return c;
  let f = fmts.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }); fmts.set(tz, f); }
  const o = {}; for (const p of f.formatToParts(new Date(t * 1000))) o[p.type] = p.value;
  const r = { d: `${o.year}-${o.month}-${o.day}`, m: +o.hour * 60 + +o.minute, wd: o.weekday };
  if (cache.size > 3e6) cache.clear(); cache.set(key, r); return r;
}
// unix seconds of 00:00 local on calendar day d
export function midnightIn(tz, d) {
  const [y, mo, da] = d.split('-').map(Number);
  for (let h = -3; h <= 8; h++) { const t = Date.UTC(y, mo - 1, da, h) / 1000; const p = partsIn(tz, t); if (p.d === d && p.m === 0) return t; }
  throw new Error('no midnight ' + tz + ' ' + d);
}

// Day map from fetch.mjs files (also reads the #511 NQ cache, nas100-<year>.json, which has the same layout):
// Map<local date, [{time, open, high, low, close, vol, m}]>, m = local minute of day, -1 for the last candle before midnight.
export function loadDays(dir, sym) {
  const tz = MARKETS[sym].tz, days = new Map(), re = new RegExp(`^${sym}-\\d{4}\\.json$`);
  for (const f of fs.readdirSync(dir).filter((f) => re.test(f)).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [d, rows] of Object.entries(j)) days.set(d, rows.map(([time, open, high, low, close, vol]) => { const p = partsIn(tz, time); return { time, open, high, low, close, vol, m: p.d === d ? p.m : -1 }; }));
  }
  return days;
}

export const fixedR = (x) => +x.toFixed(2);
const stopFill = (b, sell, stop, afterFill = true) => !afterFill ? stop : sell ? Math.max(stop, b.open) : Math.min(stop, b.open);
const exitR = (sell, entry, px, r0) => +(((sell ? entry - px : px - entry)) / r0).toFixed(2);

// live nqOpenSweep(bars, day, o, 0, 0.0008). opt.buf: 'pct' (0.011% of O, primary here) | number of points (live NQ: 2)
export function openSweep(D, o, minPen = 0.0008, opt = {}) {
  const first = D.find((b) => b.m === o); if (!first) return null;
  const O = first.open, live = new Map(); minPen *= O;
  const buf = opt.buf === undefined || opt.buf === 'pct' ? 0.00011 * O : opt.buf;
  for (const b of D) {
    if (!(b.m > o && b.m < o + 90)) continue;
    if (!live.has('L') && b.low < O) live.set('L', { t: b.time, ext: b.low });
    if (!live.has('H') && b.high > O) live.set('H', { t: b.time, ext: b.high });
    for (const [k, v] of live) {
      v.ext = k === 'L' ? Math.min(v.ext, b.low) : Math.max(v.ext, b.high);
      if (b.time - v.t > 900 || Math.abs(v.ext - O) < minPen) continue;
      if (k === 'L' && b.close > O && b.close > b.open) return { sell: false, lv: O, ext: v.ext, stop: v.ext - buf, t: b.time, m: b.m, entry: b.close };
      if (k === 'H' && b.close < O && b.close < b.open) return { sell: true, lv: O, ext: v.ext, stop: v.ext + buf, t: b.time, m: b.m, entry: b.close };
    }
  }
  return null;
}
export function midnightPrice(D, exact = false) {
  const b0 = D.find((b) => b.m === 0); if (b0) return b0.open; if (exact) return null;
  const pre = D.find((b) => b.m === -1); if (pre) return pre.close;
  const n = D.find((b) => b.m >= 0 && b.m < 60); return n ? n.open : null;
}
// One local day → the open-run trade or null. opt: { o, cost (points or fn(price)), buf, noNdo, ndoBehind, trail, minPen }
export function dayTrade(D, opt = {}) {
  const o = opt.o ?? 570;
  const g = openSweep(D, o, opt.minPen ?? 0.0008, opt); if (!g) return null;
  const ndo = midnightPrice(D);
  if (!opt.noNdo) {
    if (ndo == null) return null;
    const ok = (ndo - g.entry) * (g.sell ? 1 : -1) > 0;
    if (opt.ndoBehind ? ok : !ok) return null;
  }
  const sell = !g.sell, r0 = Math.abs(g.entry - g.stop); if (!(r0 > 0)) return null;
  const trail = opt.trail === undefined ? [2, 1] : opt.trail;
  const r = { sell, entry: g.entry, r0, stop: g.entry + (sell ? r0 : -r0), t1: g.entry + (sell ? -10 : 10) * r0, trail, mfe: 0,
    opened: g.t + 60, exitAt: g.t + (o + 90 - g.m) * 60, R: null };
  if (!trail) r.t1 = g.entry + (sell ? -2 : 2) * r0;
  const checked = g.t + 60;
  for (const b of D) {
    if (b.time <= checked) continue;
    const s = r.sell;
    if (s ? b.high >= r.stop : b.low <= r.stop) { const px = stopFill(b, s, r.stop, b.time > r.opened);
      if (r.trailMoved) { r.R = exitR(s, r.entry, px, r.r0); r.exit = 'trail'; } else { r.R = px === r.stop ? -1 : exitR(s, r.entry, px, r.r0); r.exit = 'stop'; }
      break; }
    if (s ? b.low <= r.t1 : b.high >= r.t1) { r.R = fixedR(Math.abs(r.t1 - r.entry) / r.r0); r.exit = 'target'; break; }
    r.mfe = fixedR(Math.max(r.mfe, (s ? r.entry - b.low : b.high - r.entry) / r.r0));
    if (r.trail && r.mfe >= r.trail[0]) { const ns = fixedR(r.entry + (s ? -1 : 1) * (r.mfe - r.trail[1]) * r.r0); if (s ? ns < r.stop : ns > r.stop) { r.stop = ns; r.trailMoved = true; } }
    if (b.time >= r.exitAt) { r.R = fixedR((s ? r.entry - b.open : b.open - r.entry) / r.r0); r.exit = 'close'; break; }
  }
  if (r.R == null) return null;            // data ends before the trade could close: not counted
  const cost = opt.cost ?? 1, costPts = typeof cost === 'function' ? cost(r.entry) : cost;
  return { t: g.t, m: g.m, side: sell ? -1 : 1, entry: g.entry, r0, gross: r.R, R: +(r.R - costPts / r0).toFixed(4), exit: r.exit };
}

export function stats(rs) {
  const n = rs.length; if (!n) return { n: 0, R: 0, avg: null, t: null, win: null, dd: 0 };
  const sum = rs.reduce((a, x) => a + x, 0), avg = sum / n;
  const sd = n > 1 ? Math.sqrt(rs.reduce((a, x) => a + (x - avg) ** 2, 0) / (n - 1)) : 0;
  let eq = 0, pk = 0, dd = 0; for (const x of rs) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { n, R: +sum.toFixed(2), avg: +avg.toFixed(3), t: sd > 0 ? +(avg / (sd / Math.sqrt(n))).toFixed(2) : null, win: +(rs.filter((x) => x > 0).length / n).toFixed(3), dd: +dd.toFixed(2) };
}
export function corr(a, b) {
  const n = a.length; if (n < 3) return null; const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return +(sab / Math.sqrt(saa * sbb)).toFixed(3);
}
