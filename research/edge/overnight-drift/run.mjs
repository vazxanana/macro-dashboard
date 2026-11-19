// Edge research · overnight-drift (PREREGISTRATION.md, committed first): buy the US index CFDs at the New York session close,
// sell at the next session open, stop 2 x ATR20 of the overnight ranges, net of spread and financing; the intraday leg
// (open -> close) described beside it; gold described on its own sessions.
//   node --use-env-proxy research/edge/overnight-drift/fetch.mjs <dir>   (candles, kept out of git)
//   node research/edge/overnight-drift/run.mjs full <dir>                 (writes result.json)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { FIN } from '../../../council/fills.mjs';

const DAY = 86400, H = 3600;
export const SPREAD = { spx500: 0.5, nas100: 1.5, us30: 2.5, xau: 0.30 };
export const FIN_ADD = 2.5;            // % a year over the 2Y
export const ATR_N = 20, STOP_ATR = 2;
export const WINDOWS = { rep: ['2008-01-01', '2015-12-31'], dec: ['2016-01-01', '2026-10-31'] };
export const INDICES = ['spx500', 'nas100', 'us30'];

// ---------- clock ----------
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const parse = (s) => s.split('-').map(Number);
export const addDays = (s, k) => { const [y, m, d] = parse(s); return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10); };
export const weekday = (s) => { const [y, m, d] = parse(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
// New York wall time on day s at h:mi -> unix seconds (US daylight rule since 2007; never ambiguous on a weekday)
export function nyToUtc(s, h, mi = 0) { const [y, m, d] = parse(s); return Date.UTC(y, m - 1, d, h, mi) / 1000 + nyOffsetH(Date.UTC(y, m - 1, d, 12) / 1000) * H; }
export function nyDate(t) { return new Date((t - nyOffsetH(t) * H) * 1000).toISOString().slice(0, 10); }

// ---------- NYSE calendar ----------
const nth = (y, m, wd, n) => { const f = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return ymd(y, m, 1 + ((wd - f + 7) % 7) + 7 * (n - 1)); };
const last = (y, m, wd) => { const L = new Date(Date.UTC(y, m, 0)); return ymd(y, m, L.getUTCDate() - ((L.getUTCDay() - wd + 7) % 7)); };
function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
  h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return ymd(y, mo, da); }
const observed = (s) => { const w = weekday(s); return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s; };
export const SPECIAL = ['2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09'];
const HCACHE = new Map();
export function holidays(y) {
  if (HCACHE.has(y)) return HCACHE.get(y);
  const s = new Set();
  const ny = ymd(y, 1, 1); if (weekday(ny) === 0) s.add(ymd(y, 1, 2)); else if (weekday(ny) !== 6) s.add(ny);   // Saturday: no holiday
  s.add(nth(y, 1, 1, 3)); s.add(nth(y, 2, 1, 3)); s.add(addDays(easter(y), -2)); s.add(last(y, 5, 1));
  if (y >= 2022) s.add(observed(ymd(y, 6, 19)));
  s.add(observed(ymd(y, 7, 4))); s.add(nth(y, 9, 1, 1)); s.add(nth(y, 11, 4, 4)); s.add(observed(ymd(y, 12, 25)));
  for (const x of SPECIAL) if (x.startsWith(String(y))) s.add(x);
  HCACHE.set(y, s); return s;
}
export function tradingDay(s) { const w = weekday(s); return w !== 0 && w !== 6 && !holidays(+s.slice(0, 4)).has(s); }
export function earlyClose(s) {
  if (!tradingDay(s)) return false;
  const [y, m, d] = parse(s);
  return (m === 7 && d === 3) || (m === 12 && d === 24) || s === addDays(nth(y, 11, 4, 4), 1);
}
export function session(s) { return { day: s, open: nyToUtc(s, 9, 30), close: earlyClose(s) ? nyToUtc(s, 13) : nyToUtc(s, 16) }; }
export function nextTradingDay(s, isDay = tradingDay) { let x = addDays(s, 1); while (!isDay(x)) x = addDays(x, 1); return x; }
export function tradingDays(from, to, isDay = tradingDay) { const out = []; for (let x = from; x <= to; x = addDays(x, 1)) if (isDay(x)) out.push(x); return out; }

// calendar days of financing for a position held from t0 to t1: every 17:00 New York rollover of a trading day inside (t0, t1]
// counts the calendar days to the next trading day (Friday 3, the eve of a holiday more)
export function rolloverDays(t0, t1, isDay = tradingDay) {
  let n = 0;
  for (let s = nyDate(t0); ; s = addDays(s, 1)) {
    const r = nyToUtc(s, 17); if (r > t1) break;
    if (r > t0 && isDay(s)) { const nx = nextTradingDay(s, isDay); n += (Date.parse(nx) - Date.parse(s)) / 1000 / DAY; }
  }
  return n;
}

// ---------- candles ----------
export function index(bars) { const at = new Map(); bars.forEach((b, i) => at.set(b[0], i)); return { bars, at }; }
function firstAtOrAfter(B, t) { let lo = 0, hi = B.bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B.bars[m][0] < t) lo = m + 1; else hi = m; } return lo; }
export const priceAt = (B, t) => { const i = B.at.get(t); return i == null ? null : B.bars[i][1]; };
// candles that start in [a, b)
export function between(B, a, b) { const out = []; for (let i = firstAtOrAfter(B, a); i < B.bars.length && B.bars[i][0] < b; i++) out.push(B.bars[i]); return out; }

// rate (% a year) as of a day from a [[date, value]] list, last value dated on or before the day
export function asOf(list) { return (s) => { let lo = 0, hi = list.length - 1, r = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m][0] <= s) { r = list[m][1]; lo = m + 1; } else hi = m - 1; } return r; }; }

// ---------- the trades ----------
// windows: [{ day, t0, t1 }] in time order (t0 entry, t1 planned exit). Each night's range, ATR from the 20 before it only.
export function nights(B, windows, { spread, finPerDay, isDay = tradingDay, atrN = ATR_N, k = STOP_ATR }) {
  const ranges = [], trades = []; let skipped = 0;
  for (const w of windows) {
    const bs = between(B, w.t0, w.t1), e = priceAt(B, w.t0), x = priceAt(B, w.t1);
    const prev = ranges.slice(-atrN);
    if (bs.length) ranges.push(Math.max(...bs.map((b) => b[2])) - Math.min(...bs.map((b) => b[3])));
    if (e == null || x == null || !bs.length) { skipped++; continue; }
    if (prev.length < atrN) continue;
    const atr = prev.reduce((a, b) => a + b, 0) / atrN, risk = k * atr, stop = e - risk;
    let exit = x, exitT = w.t1, stopped = false;
    for (const b of bs) {
      if (b[1] <= stop) { exit = b[1]; exitT = b[0]; stopped = true; break; }
      if (b[3] <= stop) { exit = stop; exitT = b[0]; stopped = true; break; }
    }
    const days = rolloverDays(w.t0, exitT, isDay), fin = days * finPerDay(w.day, e), gross = exit - e;
    trades.push({ day: w.day, t0: w.t0, exitT, entry: e, exit, stop, risk, stopped, days, hours: (exitT - w.t0) / H,
      grossR: gross / risk, spreadR: spread / risk, finR: fin / risk, R: (gross - spread - fin) / risk,
      grossPct: 100 * gross / e, netPct: 100 * (gross - spread - fin) / e, spreadPct: 100 * spread / e, finPct: 100 * fin / e });
  }
  return { trades, skipped };
}
export function dayLegs(B, windows, spread) {
  const out = []; let skipped = 0;
  for (const w of windows) { const e = priceAt(B, w.t0), x = priceAt(B, w.t1); if (e == null || x == null) { skipped++; continue; }
    out.push({ day: w.day, hours: (w.t1 - w.t0) / H, grossPct: 100 * (x - e) / e, netPct: 100 * (x - e - spread) / e }); }
  return { legs: out, skipped };
}
export function indexWindows(from, to) {
  const ds = tradingDays(from, to), N = [], D = [];
  for (let i = 0; i < ds.length; i++) { const s = session(ds[i]); D.push({ day: s.day, t0: s.open, t1: s.close });
    if (i + 1 < ds.length) N.push({ day: s.day, t0: s.close, t1: session(ds[i + 1]).open }); }
  return { night: N, day: D };
}
// gold: day 08:00 -> 16:00 New York, night 16:00 -> 08:00 the next gold day (a weekday with both candles)
export function goldWindows(B, from, to) {
  const has = (s) => { const w = weekday(s); return w > 0 && w < 6 && B.at.has(nyToUtc(s, 8)) && B.at.has(nyToUtc(s, 16)); };
  const ds = tradingDays(from, to, has), N = [], D = [];
  for (let i = 0; i < ds.length; i++) { D.push({ day: ds[i], t0: nyToUtc(ds[i], 8), t1: nyToUtc(ds[i], 16) });
    if (i + 1 < ds.length) N.push({ day: ds[i], t0: nyToUtc(ds[i], 16), t1: nyToUtc(ds[i + 1], 8) }); }
  return { night: N, day: D, isDay: has };
}

// ---------- statistics ----------
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
export function monthT(T, f = (x) => x.R) {
  const m = new Map(); for (const x of T) { const k = x.day.slice(0, 7); m.set(k, (m.get(k) || 0) + f(x)); }
  const v = [...m.values()], n = v.length; if (n < 2) return { months: n, t: null };
  const mu = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? r2(mu / (sd / Math.sqrt(n))) : null };
}
export function drawdown(T) { let eq = 0, pk = 0, m = 0; for (const x of T) { eq += x.R; pk = Math.max(pk, eq); m = Math.min(m, eq - pk); } return r2(m); }
const Phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export const pOne = (t) => (t == null ? 1 : 1 - Phi(t));
export function holm(ps, a = 0.05) { const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = ps.map(() => false);
  for (let j = 0; j < o.length; j++) { if (o[j][0] <= a / (o.length - j)) out[o[j][1]] = true; else break; } return out; }
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export function summary(T) {
  if (!T.length) return { n: 0 };
  const sum = (k) => T.reduce((a, x) => a + x[k], 0), mt = monthT(T);
  return { n: T.length, avgR: r3(sum('R') / T.length), totalR: r2(sum('R')), grossR: r3(sum('grossR') / T.length), spreadR: r3(sum('spreadR') / T.length),
    finR: r3(sum('finR') / T.length), win: r2(100 * T.filter((x) => x.R > 0).length / T.length), stopped: T.filter((x) => x.stopped).length,
    months: mt.months, t: mt.t, dd: drawdown(T), netPct: +(sum('netPct') / T.length).toFixed(4), grossPct: +(sum('grossPct') / T.length).toFixed(4),
    spreadPct: +(sum('spreadPct') / T.length).toFixed(4), finPct: +(sum('finPct') / T.length).toFixed(4), hours: r2(sum('hours') / T.length),
    netPctPerH: +(sum('netPct') / sum('hours')).toFixed(5), grossPctPerH: +(sum('grossPct') / sum('hours')).toFixed(5) };
}
export function legSummary(L) {
  if (!L.length) return { n: 0 };
  const g = L.map((x) => x.grossPct), n = L.map((x) => x.netPct), h = mean(L.map((x) => x.hours)), mt = monthT(L, (x) => x.netPct);
  return { n: L.length, grossPct: +mean(g).toFixed(4), netPct: +mean(n).toFixed(4), hours: r2(h), netPctPerH: +(mean(n) / h).toFixed(5),
    grossPctPerH: +(mean(g) / h).toFixed(5), months: mt.months, tNetPct: mt.t };
}
const cut = (T, [f, t]) => T.filter((x) => x.day >= f && x.day <= t);
const years = (T) => { const o = {}; for (const x of T) { const y = x.day.slice(0, 4); (o[y] ||= { n: 0, R: 0 }); o[y].n++; o[y].R += x.R; }
  for (const y in o) o[y].R = r2(o[y].R); return o; };

// ---------- the run ----------
function load(dir, f) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f)))); }
function full(dir) {
  const rates = JSON.parse(fs.readFileSync(new URL('../gold-carry/rates.json', import.meta.url), 'utf8'));
  const dgs2 = asOf(rates.DGS2), FROM = '2007-10-01', TO = WINDOWS.dec[1];
  const finIdx = (day, px) => { const r = dgs2(day); return ((r == null ? 0 : r) + FIN_ADD) / 100 / 365 * px; };
  const out = { built: '2026-11-13', data: {}, costs: { spread: SPREAD, financing: `DGS2 + ${FIN_ADD} % a year per calendar day of each 17:00 New York rollover; gold FIN.xau.long ${FIN.xau.long} of price a day`, rates: 'research/edge/gold-carry/rates.json DGS2 (weekly)' },
    windows: WINDOWS, markets: {}, gold: {} };
  for (const m of INDICES) {
    const B = index(load(dir, `${m}-30m.json.gz`));
    out.data[m] = { candles: B.bars.length, from: new Date(B.bars[0][0] * 1000).toISOString().slice(0, 10), to: new Date(B.bars.at(-1)[0] * 1000).toISOString().slice(0, 10), tf: 'M30' };
    const W = indexWindows(FROM, TO);
    const N = nights(B, W.night, { spread: SPREAD[m], finPerDay: finIdx }), N2 = nights(B, W.night, { spread: 2 * SPREAD[m], finPerDay: finIdx }), D = dayLegs(B, W.day, SPREAD[m]);
    const row = { skippedNights: N.skipped, skippedDays: D.skipped };
    for (const [k, w] of Object.entries(WINDOWS)) row[k] = { night: summary(cut(N.trades, w)), night2x: summary(cut(N2.trades, w)), day: legSummary(cut(D.legs, w)) };
    row.years = years(cut(N.trades, [WINDOWS.rep[0], TO]));
    out.markets[m] = row;
  }
  // pass rule
  const dec = INDICES.map((m) => out.markets[m].dec), ps = dec.map((d) => (d.night.avgR > 0 ? pOne(d.night.t) : 1)), H_ = holm(ps);
  out.checks = {}; INDICES.forEach((m, i) => { const d = dec[i];
    out.checks[m] = { positive: d.night.avgR > 0, t2: d.night.t != null && d.night.t >= 2, p: +ps[i].toFixed(4), holm: H_[i], perHour: d.night.netPctPerH > d.day.netPctPerH };
    out.checks[m].pass = out.checks[m].positive && out.checks[m].t2 && out.checks[m].holm && out.checks[m].perHour;
    out.checks[m].robust = out.checks[m].pass ? out.markets[m].rep.night.avgR > 0 : null; });
  out.passing = INDICES.filter((m) => out.checks[m].pass);
  out.verdict = out.passing.length ? 'PASS' : 'FAIL';
  // gold, descriptive
  const G = index(load(dir, 'xau-1h.json.gz'));
  out.data.xau = { candles: G.bars.length, from: new Date(G.bars[0][0] * 1000).toISOString().slice(0, 10), to: new Date(G.bars.at(-1)[0] * 1000).toISOString().slice(0, 10), tf: 'H1' };
  const GW = goldWindows(G, FROM, TO), GN = nights(G, GW.night, { spread: SPREAD.xau, finPerDay: (d, px) => FIN.xau.long * px, isDay: GW.isDay }), GD = dayLegs(G, GW.day, SPREAD.xau);
  for (const [k, w] of Object.entries(WINDOWS)) out.gold[k] = { night: summary(cut(GN.trades, w)), day: legSummary(cut(GD.legs, w)) };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ checks: out.checks, verdict: out.verdict }, null, 1));
  for (const m of [...INDICES]) for (const k of ['rep', 'dec']) console.log(m, k, JSON.stringify(out.markets[m][k]));
  for (const k of ['rep', 'dec']) console.log('xau', k, JSON.stringify(out.gold[k]));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'full') full(dir); else console.log('usage: run.mjs full <dir>');
}
