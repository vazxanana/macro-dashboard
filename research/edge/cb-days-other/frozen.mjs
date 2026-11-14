// Edge research · cb-days-other: the FROZEN rule of ecb-boj-days ("follow the first hour after a central-bank decision"),
// applied to five other banks' scheduled decisions. Committed with PREREGISTRATION.md and dates.json BEFORE any trade of
// this study was computed. Every block marked "copied byte for byte" is the text of ecb-boj-days run.mjs (branch
// ecb-boj-days, commit 13ecff890) at the named lines, unchanged; tests/cb-days-other.test.mjs pins the sha256 of the
// trade function and of the ATR / cost functions. What is new here, and only this: the event list (dates.json), the pair,
// the decision minute (decision()) and the exit time (P.EXIT). Paper research only: nothing live reads this file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, M5 = 300, H1 = 3600;
const T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const DATES = JSON.parse(fs.readFileSync(path.join(HERE, 'dates.json'), 'utf8'));
export const BANKS = Object.freeze(['BOE', 'BOC', 'SNB', 'RBA', 'RBNZ']);
// new: per bank the pair, the exit time (seconds after 00:00 UTC of the decision date) and its pip; the rest is
// ecb-boj-days' P unchanged (first window 60 min, ATR 14 one-hour candles within 7 days, the 2x / 20-day check, costs).
export const P = Object.freeze({
  FIRST: 3600, ATR_N: 14, ATR_DAYS: 7, SPIKE: 2, BASE_N: 20, BASE_DAYS: 45,
  EXIT: Object.freeze({ BOE: 21 * H1, BOC: 21 * H1, SNB: 21 * H1, RBA: 15 * H1, RBNZ: 15 * H1 }),
  SYM: Object.freeze({ BOE: 'gbpusd', BOC: 'usdcad', SNB: 'usdchf', RBA: 'audusd', RBNZ: 'nzdusd' }),
  PIP: Object.freeze({ gbpusd: 1e-4, usdcad: 1e-4, usdchf: 1e-4, audusd: 1e-4, nzdusd: 1e-4 }), COST_PIPS: 0.3 + 0.3, COMM_RT: 45e-6,
});

// ── copied byte for byte: ecb-boj-days run.mjs lines 28-31 ──
const dnum = (s) => Date.parse(s + 'T00:00:00Z') / (DAY * 1000);
const dstr = (n) => new Date(n * DAY * 1000).toISOString().slice(0, 10);
const wday = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const weekday = (s) => { const w = wday(s); return w !== 0 && w !== 6; };
// ── end of copy ──

// ── copied byte for byte: ecb-boj-days run.mjs lines 33-38 ──
export function eventDates(bank) {
  const out = [];
  for (const [y, list] of Object.entries(DATES[bank].dates)) for (const md of list) out.push(`${y}-${md}`);
  return out.sort();
}
export const bannedOf = (bank) => new Set([...eventDates(bank), ...DATES[bank].unscheduled]);
// ── end of copy ──

// ── copied byte for byte: ecb-boj-days run.mjs lines 40-58 ──
// ── candles: typed arrays + a time → index map; t = candle start ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n, at: new Map() };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; b.at.set(r[0], i); });
  return b;
}
const rangeAt = (b, t) => { const i = b.at.get(t); return i == null ? null : b.h[i] - b.l[i]; };
// index of the first candle starting at or after t
function firstFrom(b, t) { let lo = 0, hi = b.n; while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] < t) lo = m + 1; else hi = m; } return lo; }
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
// the 20 previous weekdays (inside 45 calendar days, banned dates left out) for which f(date) gives a value
function prevDays(date, banned, f) {
  const out = [];
  for (let d = dnum(date) - 1; d >= dnum(date) - P.BASE_DAYS && out.length < P.BASE_N; d--) {
    const ds = dstr(d); if (!weekday(ds) || banned.has(ds)) continue;
    const v = f(ds); if (v != null) out.push(v);
  }
  return out.length < P.BASE_N ? null : out;
}
// ── end of copy ──

// ── new: the decision minute D of one date (local time of the bank, daylight time included) ──
// One candidate minute: D = its M5 candle's start. Two candidates (BoC 09:45 / 10:00 Toronto; RBNZ 09:00 / 14:00 Wellington
// before 2019): the direction-free clock check of ecb-boj-days, D = the candidate whose M5 candle has the larger range
// (a tie goes to the first listed), reading those candles only. RBNZ: 09:00 winning means no trade.
export function candidates(bank, date) {
  const B = DATES[bank], e = B.early;
  return (e && date < e.before ? [e.minute, ...B.minutes] : B.minutes).map((hm) => ({ hm, T: zonedToUtc(date, hm, B.tz) }));
}
export function clockCheck(b, bank, date, banned) {
  const c = candidates(bank, date).map((x) => ({ ...x, r: rangeAt(b, x.T) }));
  if (c.every((x) => x.r == null)) return null;
  let pick = c[0]; for (const x of c.slice(1)) if ((x.r ?? -1) > (pick.r ?? -1)) pick = x;
  if (pick.r == null) return null;
  const tz = DATES[bank].tz, base = prevDays(date, banned, (ds) => rangeAt(b, zonedToUtc(ds, pick.hm, tz)));
  return { T: pick.T, local: pick.hm, range: pick.r, two: c.length > 1, confirmed: base ? pick.r >= P.SPIKE * median(base) : false };
}
export function decision(b, bank, date, banned) {
  const m = clockCheck(b, bank, date, banned);
  if (!m) return { skip: 'no decision candle' };
  if (bank === 'RBNZ' && DATES.RBNZ.early && m.local === DATES.RBNZ.early.minute) return { skip: 'early clock (09:00 Wellington)', ecb: m };
  return { D: m.T, ecb: m };
}

// ── copied byte for byte: ecb-boj-days run.mjs lines 90-105 ──
// ── ATR: simple mean true range of the last 14 one-hour candles (UTC hours, from M5) that ended at or before D ──
export function atrAt(b, D) {
  const cut = Math.floor(D / H1) * H1, lim = D - P.ATR_DAYS * DAY, hours = [];
  let i = firstFrom(b, cut) - 1;
  while (i >= 0 && hours.length < P.ATR_N + 1 && b.t[i] >= lim) {
    const hs = Math.floor(b.t[i] / H1) * H1; let hi = -Infinity, lo = Infinity; const c = b.c[i];
    while (i >= 0 && b.t[i] >= hs) { if (b.h[i] > hi) hi = b.h[i]; if (b.l[i] < lo) lo = b.l[i]; i--; }
    hours.push({ hi, lo, c });
  }
  if (hours.length < P.ATR_N + 1) return null;
  let s = 0;
  for (let k = 0; k < P.ATR_N; k++) { const x = hours[k], pc = hours[k + 1].c; s += Math.max(x.hi - x.lo, Math.abs(x.hi - pc), Math.abs(x.lo - pc)); }
  return s / P.ATR_N;
}

export function costOf(sym, entry, mult = 1) { return mult * (P.COST_PIPS * P.PIP[sym] + P.COMM_RT * entry); }
// ── end of copy ──

// ── copied byte for byte: ecb-boj-days run.mjs lines 112-130 ──
// the trade of one date: direction of the first 60 min, entry at D + 60, stop 1 ATR, out at the exit time (UTC)
export function trade(b, bank, sym, date, banned) {
  const dec = decision(b, bank, date, banned); if (dec.skip) return dec;
  const D = dec.D, iRef = b.at.get(D - M5), i60 = b.at.get(D + P.FIRST - M5);
  if (iRef == null || i60 == null) return { skip: 'first hour incomplete' };
  const ref = b.c[iRef], entry = b.c[i60], d = Math.sign(entry - ref);
  if (d === 0) return { skip: 'no direction' };
  const atr = atrAt(b, D); if (!(atr > 0)) return { skip: 'no ATR' };
  const stop = entry - d * atr, exitT = T0(date) + P.EXIT[bank];
  let exit = null, why = null, xT = null, last = -1;
  for (let i = i60 + 1; i < b.n && b.t[i] + M5 <= exitT; i++) {
    last = i;
    if (d > 0 ? b.o[i] <= stop : b.o[i] >= stop) { exit = b.o[i]; why = 'gap'; xT = b.t[i]; break; }
    if (d > 0 ? b.l[i] <= stop : b.h[i] >= stop) { exit = stop; why = 'stop'; xT = b.t[i] + M5; break; }
  }
  if (exit == null) { if (last < 0) return { skip: 'no candle after entry' }; exit = b.c[last]; why = 'time'; xT = b.t[last] + M5; }
  const R = d * (exit - entry) / atr, cost = costOf(sym, entry);
  return { date, D, d, ref, entry, stop, atr, exit, why, exitT: xT, R, costR: cost / atr, net: R - cost / atr, net2: R - 2 * cost / atr, ...(dec.ecb ? { ecb: dec.ecb } : {}) };
}
// ── end of copy ──

// ── copied byte for byte: ecb-boj-days run.mjs lines 132-163 ──
// ── statistics ──
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, x) => a + x, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
// month-sum t: every calendar month from `from` to `to` (unix s) gets the sum of its trades' values (0 if none)
export function monthT(trs, from, to, key = 'net') {
  const sums = new Map(), m0 = new Date(from * 1000), m1 = new Date((to - 1) * 1000);
  for (let y = m0.getUTCFullYear(), m = m0.getUTCMonth(); y < m1.getUTCFullYear() || (y === m1.getUTCFullYear() && m <= m1.getUTCMonth()); m === 11 ? (y++, m = 0) : m++) sums.set(`${y}-${String(m + 1).padStart(2, '0')}`, 0);
  for (const x of trs) { const k = x.date.slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
  const s = stat([...sums.values()]);
  return { months: s.n, t: s.t };
}
export function quantile(xs, q) {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!s.length) return null;
  const x = (s.length - 1) * q, lo = Math.floor(x), hi = Math.ceil(x);
  return s[lo] + (s[hi] - s[lo]) * (x - lo);
}
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOne = (t) => (t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2)));
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, out = new Array(m);
  let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); out[i] = run; });
  return out;
}
// ── end of copy ──
