// Edge research · santa-rally: the "Santa Claus rally" window (last 5 trading days of December + first 2 of January) on
// SPX500, NAS100, DE40 and UK100 OANDA daily candles, against every other 7-trading-day window of the same year.
// Rules, data and pass bar: PREREGISTRATION.md (committed first). Paper only; nothing here is read by the council.
//   node research/edge/santa-rally/run.mjs fetch <dir>   (git show of council-data's candle files + macro/cache.json, no network)
//   node research/edge/santa-rally/run.mjs <dir>         (writes result.json next to this file)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const P = {
  win: 7, dec: 5, jan: 2, atrN: 20, stopAtr: 3, cost: 0.0004, finAdd: 0.025, dgs2Default: 4, volFrac: 0.05, volN: 20,
  decisive: [2010, 2025], replication: [2003, 2009], placeboDraws: 1000, placeboMaxK: 239, seed: 20261214, alpha: 0.05,
};
export const KEYS = ['spx500', 'nas100', 'de40', 'uk100'];
const DAY = 86400;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const ymd = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

// ─── calendars ───
function easter(y) { // anonymous Gregorian algorithm → UTC ms of Easter Sunday
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31),
    da = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, mo - 1, da);
}
function nthWd(y, m, wd, n) { // n-th weekday wd of month m (n = -1: the last)
  if (n > 0) { const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); return ymd(y, m, 1 + ((wd - first + 7) % 7) + 7 * (n - 1)); }
  const lastD = new Date(Date.UTC(y, m + 1, 0)), back = (lastD.getUTCDay() - wd + 7) % 7;
  return ymd(y, m, lastD.getUTCDate() - back);
}
function observed(y, m, d) { const wd = new Date(Date.UTC(y, m, d)).getUTCDay(); return wd === 6 ? ymd(y, m, d - 1) : wd === 0 ? ymd(y, m, d + 1) : ymd(y, m, d); }
export const NYSE_SPECIAL = ['2004-06-11', '2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09'];
export function nyseHolidays(y) {
  const h = new Set(NYSE_SPECIAL.filter((d) => +d.slice(0, 4) === y));
  const ny = new Date(Date.UTC(y, 0, 1)).getUTCDay();
  if (ny !== 6) h.add(ny === 0 ? ymd(y, 0, 2) : ymd(y, 0, 1));   // New Year: Sunday → Monday; Saturday → no holiday
  h.add(nthWd(y, 0, 1, 3)); h.add(nthWd(y, 1, 1, 3)); h.add(iso(easter(y) / 1000 - 2 * DAY)); h.add(nthWd(y, 4, 1, -1));
  if (y >= 2022) h.add(observed(y, 5, 19));
  h.add(observed(y, 6, 4)); h.add(nthWd(y, 8, 1, 1)); h.add(nthWd(y, 10, 4, 4)); h.add(observed(y, 11, 25));
  return h;
}

// candles: [{t,o,h,l,c,v}] oldest first → indices of the trading days
export function usCalendar(bars) {
  const hol = new Map(), out = [];
  bars.forEach((b, i) => {
    const d = new Date(b.t * 1000), wd = d.getUTCDay(), y = d.getUTCFullYear();
    if (!wd || wd === 6) return;
    if (!hol.has(y)) hol.set(y, nyseHolidays(y));
    if (!hol.get(y).has(iso(b.t))) out.push(i);
  });
  return out;
}
export function volCalendar(bars, frac = P.volFrac, n = P.volN) {
  const out = [], vols = [];
  bars.forEach((b, i) => {
    const wd = new Date(b.t * 1000).getUTCDay();
    if (!wd || wd === 6) return;
    if (vols.length >= n) { const s = vols.slice(-n).sort((a, c) => a - c), med = (s[(n - 1) >> 1] + s[n >> 1]) / 2; if (!(b.v >= frac * med)) return; }
    out.push(i); vols.push(b.v);
  });
  return out;
}

// ─── financing ───
export function rateFn(dgs2) { // weekly [[date, pct]] → (date) → annual long financing rate
  const s = [...(dgs2 || [])].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return (d) => {
    let lo = 0, hi = s.length - 1, v = null;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m][0] <= d) { v = s[m][1]; lo = m + 1; } else hi = m - 1; }
    return ((v == null ? P.dgs2Default : v) / 100) + P.finAdd;
  };
}

// ─── one window ───
// cal = trading-day indices into bars; s = position in cal of the first window day
export function trade(bars, cal, s, rateOf, mul = 1, win = P.win) {
  if (s < P.atrN + 1 || s + win - 1 >= cal.length) return null;
  let tr = 0;
  for (let j = s - P.atrN; j < s; j++) { const b = bars[cal[j]], pc = bars[cal[j - 1]].c; tr += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); }
  const atr = tr / P.atrN, a = cal[s], z = cal[s + win - 1], entry = bars[a].o, stop = entry - P.stopAtr * atr;
  let exit = bars[z].c, exitI = z, how = 'time';
  for (let i = a; i <= z; i++) {
    const b = bars[i];
    if (i > a && b.o <= stop) { exit = b.o; exitI = i; how = 'stop'; break; }
    if (b.l <= stop) { exit = stop; exitI = i; how = 'stop'; break; }
  }
  const nights = Math.round((Date.parse(iso(bars[exitI].t)) - Date.parse(iso(bars[a].t))) / (DAY * 1000)) + 1;
  const gross = exit / entry - 1, fin = rateOf(iso(bars[a].t)) * nights / 365;
  return { s, from: iso(bars[a].t), to: iso(bars[exitI].t), entry, exit, stop, how, nights, gross, fin, net: gross - mul * (P.cost + fin) };
}

// every start position's net once, plus the year structure
export function yearly(bars, cal, rateOf, mul = 1) {
  const net = cal.map((_, s) => trade(bars, cal, s, rateOf, mul)), yr = (s) => new Date(bars[cal[s]].t * 1000).getUTCFullYear(),
    mo = (s) => new Date(bars[cal[s]].t * 1000).getUTCMonth(), years = new Map();
  cal.forEach((_, s) => { const y = yr(s); if (!years.has(y)) years.set(y, { y, p0: s, starts: [] }); if (net[s]) years.get(y).starts.push(s); });
  for (const Y of years.values()) {
    const dec = Y.starts.length ? cal.map((_, s) => s).filter((s) => yr(s) === Y.y && mo(s) === 11) : [];
    const ss = dec.length >= P.dec ? dec[dec.length - P.dec] : null;
    // the window's last 2 days must be the first 2 trading days of January Y+1
    Y.santa = ss != null && net[ss] && dec.at(-1) === ss + P.dec - 1 && yr(ss + P.dec) === Y.y + 1 && mo(ss + P.win - 1) === 0 ? ss : null;
    Y.sum = Y.starts.reduce((a, s) => a + net[s].net, 0); Y.set = new Set(Y.starts);
  }
  const excessAt = (Y, s) => (net[s] && Y.set.has(s) && Y.starts.length > 1 ? net[s].net - (Y.sum - net[s].net) / (Y.starts.length - 1) : null);
  return { net, years, excessAt };
}

// ─── statistics ───
function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
  return h; }
export function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function pOneSided(t, df) { if (!(df > 0) || !Number.isFinite(t)) return null; const tail = 0.5 * ibeta(df / 2, 0.5, df / (df + t * t)); return t > 0 ? tail : 1 - tail; }
export function tStat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, sd: null, t: null, p: null, pos: xs.filter((x) => x > 0).length };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)), t = sd > 0 ? mean / (sd / Math.sqrt(n)) : null;
  return { n, mean, sd, t, p: t == null ? null : pOneSided(t, n - 1), pos: xs.filter((x) => x > 0).length };
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, out = Array(m); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); out[i] = run; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ─── one test (one or more indices pooled) ───
// sets: [{ key, bars, cal }] → per-year rows and the stats of both windows, and the placebo
export function runTest(sets, rateOf, mul = 1, placebo = true) {
  const Ys = sets.map((x) => ({ key: x.key, ...yearly(x.bars, x.cal, rateOf, mul) }));
  const allYears = [...new Set(Ys.flatMap((x) => [...x.years.keys()]))].sort((a, b) => a - b);
  const rows = [];
  for (const y of allYears) {
    const parts = [];
    for (const X of Ys) {
      const Y = X.years.get(y); if (!Y || Y.santa == null) continue;
      const w = X.net[Y.santa], ex = X.excessAt(Y, Y.santa);
      parts.push({ key: X.key, from: w.from, to: w.to, net: w.net, gross: w.gross, fin: w.fin, how: w.how, base: w.net - ex, excess: ex, n: Y.starts.length });
    }
    if (!parts.length) continue;
    const avg = (f) => parts.reduce((a, p) => a + p[f], 0) / parts.length;
    rows.push({ y, net: avg('net'), base: avg('base'), excess: avg('excess'), parts });
  }
  const inW = (w) => rows.filter((r) => r.y >= w[0] && r.y <= w[1]);
  const dec = inW(P.decisive), rep = inW(P.replication);
  const out = { rows, decisive: tStat(dec.map((r) => r.excess)), replication: tStat(rep.map((r) => r.excess)), stops: rows.reduce((a, r) => a + r.parts.filter((p) => p.how === 'stop').length, 0) };
  if (placebo) {
    const rnd = mulberry32(P.seed), means = [];
    for (let d = 0; d < P.placeboDraws; d++) {
      const k = Math.floor(rnd() * (P.placeboMaxK + 1)), ys = [];
      for (const r of dec) {
        const vals = [];
        for (const X of Ys) { const Y = X.years.get(r.y); if (!Y || Y.santa == null) continue; const e = X.excessAt(Y, Y.p0 + k); if (e != null) vals.push(e); }
        if (vals.length) ys.push(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
      means.push(ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : -Infinity);
    }
    const m = out.decisive.mean, sorted = [...means].sort((a, b) => a - b);
    out.placebo = { draws: P.placeboDraws, share: means.filter((x) => x >= m).length / means.length,
      p5: sorted[Math.floor(0.05 * sorted.length)], p50: sorted[Math.floor(0.5 * sorted.length)], p95: sorted[Math.floor(0.95 * sorted.length)] };
  }
  return out;
}

export function toBars(rows) { return rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] })); }

export const TESTS = [
  { id: 'T1', name: 'SPX500', keys: ['spx500'], cal: 'us' },
  { id: 'T2', name: 'NAS100', keys: ['nas100'], cal: 'us' },
  { id: 'T3', name: 'DE40 + UK100 pooled', keys: ['de40', 'uk100'], cal: 'vol' },
];

export function study(files, dgs2) {
  const rateOf = rateFn(dgs2), res = {};
  for (const T of TESTS) {
    const sets = T.keys.map((k) => { const bars = toBars(files[k].rows); return { key: k, bars, cal: T.cal === 'us' ? usCalendar(bars) : volCalendar(bars) }; });
    res[T.id] = { name: T.name, x1: runTest(sets, rateOf, 1, true), x2: runTest(sets, rateOf, 2, false) };
  }
  const hp = holm(TESTS.map((T) => res[T.id].x1.decisive.p ?? 1));
  TESTS.forEach((T, i) => {
    const r = res[T.id].x1; r.holmP = hp[i];
    r.checks = { bothPositive: r.decisive.mean > 0 && r.replication.mean > 0, holm: hp[i] < P.alpha, placebo: r.placebo.share < P.alpha };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  const passed = TESTS.filter((T) => res[T.id].x1.pass).map((T) => T.id);
  return { tests: res, passed, verdict: passed.length ? `PASS (${passed.join(', ')})` : 'FAIL' };
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (import.meta.url === `file://${process.argv[1]}`) {
  const [a, b] = process.argv.slice(2);
  if (a === 'fetch') {
    fs.mkdirSync(b, { recursive: true });
    for (const k of KEYS) fs.writeFileSync(path.join(b, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(b, 'cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', b);
  } else {
    if (!a) throw new Error('usage: node run.mjs fetch <dir> | node run.mjs <dir>');
    const files = Object.fromEntries(KEYS.map((k) => [k, JSON.parse(fs.readFileSync(path.join(a, `${k}.json`), 'utf8'))]));
    const dgs2 = JSON.parse(fs.readFileSync(path.join(a, 'cache.json'), 'utf8')).score.fred.DGS2;
    const r = study(files, dgs2);
    const r6 = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
    const clean = JSON.parse(JSON.stringify(r, (k, v) => r6(v)));
    const out = {
      study: 'santa-rally', title: 'The Santa Claus rally window on index CFDs', built: '2026-11-14', verdict: r.verdict, params: P,
      data: { src: 'OANDA mid daily (UTC days), council-data research/daily/<key>.json at 61a60d2fd', keys: KEYS, dgs2: 'FRED DGS2 weekly, council-data macro/cache.json score.fred.DGS2; 4 % before its first value (2006-01-06)',
        last: Object.fromEntries(KEYS.map((k) => [k, iso(files[k].rows.at(-1)[0])])) },
      ...clean,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const T of TESTS) {
      const x = r.tests[T.id].x1, x2 = r.tests[T.id].x2, f = (v) => (v * 100).toFixed(3) + '%';
      console.log(T.id, T.name, 'dec n', x.decisive.n, 'mean', f(x.decisive.mean), 't', x.decisive.t?.toFixed(2), 'p', x.decisive.p?.toFixed(3), 'holm', x.holmP.toFixed(3), 'pos', x.decisive.pos,
        '| rep n', x.replication.n, f(x.replication.mean), 't', x.replication.t?.toFixed(2), 'pos', x.replication.pos, '| placebo', x.placebo.share, '| 2x dec', f(x2.decisive.mean), 't', x2.decisive.t?.toFixed(2), '| stops', x.stops, x.pass ? 'PASS' : 'fail');
    }
    console.log('verdict', r.verdict);
  }
}
