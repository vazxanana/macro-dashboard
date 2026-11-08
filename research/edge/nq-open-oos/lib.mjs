// NQ New York open run: the live rule from council/trader.mjs, copied (trader.mjs is a script, not a module).
//   signal:  nqOpenSweep(bars, day, 570, 0, 0.0008)            (trader.mjs ~1808-1826)
//   filter:  nyflip block, midnight (00:00 ET) open ahead of the trade   (trader.mjs ~1883-1905)
//   manage:  open-trade loop (stop, 10R target, nqRun trail 2R/1R, 11:00 ET exit) (trader.mjs ~1840-1856, fills.mjs stopFill/exitR)
// Paper research only; nothing here is imported by the council.
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
const cache = new Map();
export function nyParts(t) {
  const k = Math.floor(t / 60); const c = cache.get(k); if (c) return c;
  const o = {}; for (const p of fmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value;
  const r = { d: `${o.year}-${o.month}-${o.day}`, m: +o.hour * 60 + +o.minute, wd: o.weekday };
  if (cache.size > 2e6) cache.clear(); cache.set(k, r); return r;
}
// unix seconds of 00:00 New York on calendar day d ('YYYY-MM-DD')
export function nyMidnight(d) {
  const [y, mo, da] = d.split('-').map(Number);
  for (const h of [4, 5]) { const t = Date.UTC(y, mo - 1, da, h) / 1000; const p = nyParts(t); if (p.d === d && p.m === 0) return t; }
  throw new Error('no NY midnight ' + d);
}
export const fixedR = (x) => +x.toFixed(2);
const stopFill = (b, sell, stop, afterFill = true) => !afterFill ? stop : sell ? Math.max(stop, b.open) : Math.min(stop, b.open);
const exitR = (sell, entry, px, r0) => +(((sell ? entry - px : px - entry)) / r0).toFixed(2);

// bars: [{time, open, high, low, close, m}] of one NY day (m = NY minute of day). Returns the live nqOpenSweep result or null.
// opt.bufPct: use 0.011% of the open as the stop buffer instead of the 2 points the live code actually uses (sensitivity only)
// opt.minPen: run threshold as a fraction of the open (live 0.0008)
export function nqOpenSweep(D, o = 570, minPen = 0.0008, opt = {}) {
  const first = D.find((b) => b.m === o); if (!first) return null;
  const O = first.open, live = new Map(); minPen *= O; const buf = opt.bufPct ? 0.00011 * O : 2;
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

// The midnight (00:00 ET) opening price. Live: the open of the 00:00 candle of the futures feed (always there). OANDA's CFD
// quotes before ~2016 often skip that minute, so unless exact is asked the price standing at 00:00 is used instead: the close of
// the last candle before midnight, else the open of the first candle in 00:00-00:59.
export function midnightPrice(D, exact = false) {
  const b0 = D.find((b) => b.m === 0); if (b0) return b0.open; if (exact) return null;
  const pre = D.find((b) => b.m === -1); if (pre) return pre.close;
  const n = D.find((b) => b.m >= 0 && b.m < 60); return n ? n.open : null;
}
// One day → the live nyflip trade (or null). opt: { cost (points, round trip), strict (also check the first minute after entry,
// which the live loop skips because checked = opened), ndoExact (only days with a 00:00 candle), noNdo (drop the midnight filter), ndoBehind (the skipped 'nyflip-x' trades),
// trail ([atR, by], live [2, 1]), bufPct, minPen }
export function dayTrade(D, opt = {}) {
  const g = nqOpenSweep(D, 570, opt.minPen ?? 0.0008, opt); if (!g) return null;
  const ndoBar = D.find((b) => b.m === 0), ndo = midnightPrice(D, opt.ndoExact);
  if (!opt.noNdo) {
    if (ndo == null) return null;
    const ok = (ndo - g.entry) * (g.sell ? 1 : -1) > 0;
    if (opt.ndoBehind ? ok : !ok) return null;
  }
  const sell = !g.sell, r0 = Math.abs(g.entry - g.stop); if (!(r0 > 0)) return null;
  const trail = opt.trail === undefined ? [2, 1] : opt.trail;
  const r = { sell, entry: g.entry, r0, stop: g.entry + (sell ? r0 : -r0), t1: g.entry + (sell ? -10 : 10) * r0, trail, mfe: 0,
    opened: g.t + 60, exitAt: g.t + (660 - g.m) * 60, status: 'open', R: null, m: g.m, t: g.t, lv: g.lv, ext: g.ext, ndo, ndoExact: !!ndoBar };
  if (!trail) { r.t1 = g.entry + (sell ? -2 : 2) * r0; }
  const checked = opt.strict ? g.t : g.t + 60;
  for (const b of D) {
    if (b.time <= checked) continue;
    const s = r.sell;
    if (s ? b.high >= r.stop : b.low <= r.stop) { const px = stopFill(b, s, r.stop, b.time > r.opened);
      if (r.trailMoved) { r.R = exitR(s, r.entry, px, r.r0); r.exit = 'trail'; } else { r.R = px === r.stop ? -1 : exitR(s, r.entry, px, r.r0); r.exit = 'stop'; }
      r.closed = b.time; break; }
    if (s ? b.low <= r.t1 : b.high >= r.t1) { r.R = fixedR(Math.abs(r.t1 - r.entry) / r.r0); r.exit = 'target'; r.closed = b.time; break; }
    r.mfe = fixedR(Math.max(r.mfe, (s ? r.entry - b.low : b.high - r.entry) / r.r0));
    if (r.trail && r.mfe >= r.trail[0]) { const ns = fixedR(r.entry + (s ? -1 : 1) * (r.mfe - r.trail[1]) * r.r0); if (s ? ns < r.stop : ns > r.stop) { r.stop = ns; r.trailMoved = true; } }
    if (b.time >= r.exitAt) { r.R = fixedR((s ? r.entry - b.open : b.open - r.entry) / r.r0); r.exit = '11:00'; r.closed = b.time; break; }
  }
  if (r.R == null) return null;            // data ends before the trade could close (missing candles): not counted
  const cost = opt.cost ?? 1;
  const costPts = typeof cost === 'function' ? cost(r.entry) : cost;
  return { t: r.t, m: r.m, side: sell ? -1 : 1, entry: r.entry, r0: r.r0, gross: r.R, R: +(r.R - costPts / r.r0).toFixed(4), exit: r.exit, lv: r.lv, ext: r.ext, ndo: r.ndo, ndoExact: r.ndoExact };
}

// ── stats ──
export function stats(rs) {
  const n = rs.length; if (!n) return { n: 0, R: 0, avg: null, t: null, win: null, dd: 0 };
  const sum = rs.reduce((a, x) => a + x, 0), avg = sum / n;
  const sd = n > 1 ? Math.sqrt(rs.reduce((a, x) => a + (x - avg) ** 2, 0) / (n - 1)) : 0;
  let eq = 0, pk = 0, dd = 0; for (const x of rs) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { n, R: +sum.toFixed(2), avg: +avg.toFixed(3), t: sd > 0 ? +(avg / (sd / Math.sqrt(n))).toFixed(2) : null, win: +(rs.filter((x) => x > 0).length / n).toFixed(3), dd: +dd.toFixed(2) };
}
export function welch(a, b) {
  const m = (x) => x.reduce((s, v) => s + v, 0) / x.length, v = (x, mu) => x.reduce((s, y) => s + (y - mu) ** 2, 0) / (x.length - 1);
  if (a.length < 2 || b.length < 2) return null; const ma = m(a), mb = m(b);
  return +((ma - mb) / Math.sqrt(v(a, ma) / a.length + v(b, mb) / b.length)).toFixed(2);
}
