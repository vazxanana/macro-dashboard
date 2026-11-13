// Edge research · fx-month-end (PREREGISTRATION.md, committed first): the month-end US dollar rebalancing flow into the
// London 4 pm fix (Melvin and Prins 2015). On the last London business day of a month, at 10:00 London, the sign of
// (S&P 500 month-to-date return − mean of DAX / FTSE / Nikkei month-to-date returns) picks the side: US outperformed →
// short USD on six majors from the 10:00 London H1 open to the 16:00 London close, else long USD. 1.5 x ATR(24 H1) stop on
// every leg, equal risk, net of the measured raw-spread cost model.
//   node --use-env-proxy research/edge/fx-month-end/run.mjs fetch <dir>   H1 candles from the proxy + daily index candles
//   node research/edge/fx-month-end/run.mjs <dir>                          writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { costModel, SLIP_SPREADS } from '../../../council/fills.mjs';
import { spreadFields, commissionRT } from '../../../council/ctrader-symbols.mjs';
import { SYMBOLS } from '../../../council/ctrader-mirror.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FX = ['eurusd', 'gbpusd', 'audusd', 'usdjpy', 'usdchf', 'usdcad'];
export const USD_BASE = new Set(['usdjpy', 'usdchf', 'usdcad']);
export const IDX = ['spx500', 'de40', 'uk100', 'jp225'];
export const P = { STOP_K: 1.5, ATR_N: 24, ENTRY_H: 10, EXIT_H: 16, PLACEBO_PER_YEAR: 40, RESAMPLES: 2000, PASS_T: 2, MIN_N: 100 };
export const WIN = { check: ['2008-01-01', '2015-12-31'], decisive: ['2016-01-01', '2026-10-31'] };
const DAY = 86400, HOUR = 3600;
const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : null);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

// ── London clock ──
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
// UTC offset of London (0 or 1 hour) at unix time t: BST from the last Sunday of March 01:00 UTC to the last Sunday of October 01:00 UTC
export function londonOffsetH(t) {
  const y = new Date(t * 1000).getUTCFullYear();
  const a = Date.UTC(y, 2, lastSunday(y, 2), 1) / 1000, b = Date.UTC(y, 9, lastSunday(y, 9), 1) / 1000;
  return t >= a && t < b ? 1 : 0;
}
// unix time of hh:00 London on the UTC calendar date y-m-d (the offset at noon UTC of that day decides; DST switches at 01:00 UTC on a Sunday)
export function londonAt(y, m, d, hh) { const noon = Date.UTC(y, m, d, 12) / 1000; return Date.UTC(y, m, d, hh) / 1000 - londonOffsetH(noon) * HOUR; }

// ── England and Wales bank holidays ──
function easter(y) {   // Anonymous Gregorian algorithm → [month (0-based), day]
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return [mo - 1, da];
}
const key = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const firstMon = (y, m) => { const w = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((8 - w) % 7); };
const lastMon = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - ((d.getUTCDay() + 6) % 7); };
const ONE_OFF = ['2011-04-29', '2012-06-05', '2022-06-03', '2022-09-19', '2023-05-08', '2002-06-03', '2002-06-04', '1999-12-31'];
export function ukHolidays(y) {
  const s = new Set();
  const add = (m, d) => s.add(key(y, m, d));
  const sub = (m, d) => { const w = new Date(Date.UTC(y, m, d)).getUTCDay(); return w === 6 ? d + 2 : w === 0 ? d + 1 : d; };
  add(0, sub(0, 1));
  const [em, ed] = easter(y);
  const ge = Date.UTC(y, em, ed);
  const gf = new Date(ge - 2 * DAY * 1000), mo = new Date(ge + DAY * 1000);
  s.add(gf.toISOString().slice(0, 10)); s.add(mo.toISOString().slice(0, 10));
  if (y === 2020) add(4, 8); else if (y === 1995) add(4, 8); else add(4, firstMon(y, 4));
  if (y === 2012) add(5, 4); else if (y === 2022) add(5, 2); else if (y === 2002) add(5, 4); else add(4, lastMon(y, 4));
  add(7, lastMon(y, 7));
  const xw = new Date(Date.UTC(y, 11, 25)).getUTCDay();   // Christmas and Boxing Day with substitutes
  if (xw === 6) { add(11, 27); add(11, 28); } else if (xw === 0) { add(11, 26); add(11, 27); } else if (xw === 5) { add(11, 25); add(11, 28); } else { add(11, 25); add(11, 26); }
  for (const d of ONE_OFF) if (d.startsWith(String(y))) s.add(d);
  return s;
}
export function isLondonBusinessDay(y, m, d) {
  const w = new Date(Date.UTC(y, m, d)).getUTCDay();
  return w >= 1 && w <= 5 && !ukHolidays(y).has(key(y, m, d));
}
export function lastLondonBusinessDay(y, m) {
  for (let d = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); d >= 1; d--) if (isLondonBusinessDay(y, m, d)) return d;
  return null;
}

// ── the signal: month-to-date returns from daily candles that closed by the signal time ──
// rows = [[t, o, h, l, c, v], …] (00:00 UTC days); returns { mtd, base, last } or null
export function mtd(rows, monthStart, signalT) {
  let base = null, last = null;
  for (const r of rows) {
    if (r[0] + DAY <= monthStart) base = r;
    if (r[0] + DAY <= signalT) last = r; else break;
  }
  if (!base || !last || last[0] < monthStart - 3 * DAY) return null;   // no candle closed this month yet → a 0 return is fine; stale base is not
  return { mtd: last[4] / base[4] - 1, base: base[0], last: last[0] };
}
export function signal(D, y, m, d) {
  const signalT = londonAt(y, m, d, P.ENTRY_H), monthStart = Date.UTC(y, m, 1) / 1000;
  const r = {};
  for (const k of IDX) { const x = mtd(D[k], monthStart, signalT); if (!x) return null; r[k] = x; }
  const gap = r.spx500.mtd - (r.de40.mtd + r.uk100.mtd + r.jp225.mtd) / 3;
  return { gap, signalT, readUpTo: Math.max(...IDX.map((k) => r[k].last + DAY)), mtd: Object.fromEntries(IDX.map((k) => [k, r[k].mtd])) };
}

// ── H1 legs ──
export function atrBefore(H, i, n = P.ATR_N) {   // mean true range of the n candles before index i
  if (i - n - 1 < 0) return null;
  let a = 0;
  for (let j = i - n; j < i; j++) { const b = H[j], pc = H[j - 1].close; a += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return a / n;
}
// one leg: entry at the open of H[e], exit at the close of H[x]; side +1 buy, -1 sell
export function leg(H, e, x, side, stopDist) {
  const entry = H[e].open, stop = entry - side * stopDist;
  for (let i = e; i <= x; i++) {
    const b = H[i];
    if (i > e && side * (b.open - stop) <= 0) return { entry, exit: b.open, why: 'gap', stop };
    if (side > 0 ? b.low <= stop : b.high >= stop) return { entry, exit: stop, why: 'stop', stop };
  }
  return { entry, exit: H[x].close, why: 'time', stop };
}

// round-trip trading cost in price for pair k at price px (measured raw-spread model on the 12 Nov fixture)
export function buildCosts(fixture) {
  const f = JSON.parse(JSON.stringify({ at: fixture.at, account: fixture.account, symbols: fixture.symbols }));
  for (const [n, e] of Object.entries(f.symbols)) {
    let before = {};
    for (const [sec, bid, ask] of fixture.reads[n] || []) before = { ...before, ...spreadFields({ bid, ask, ts: sec * 1000 }, true, before, sec) };
    Object.assign(e, before, { commissionRT: commissionRT({ commissionType: e.commission.type, preciseTradingCommissionRate: e.commission.preciseRate }) });
  }
  const m = costModel(Object.fromEntries(FX.map((k) => [k, { group: 'Forex' }])), { symbols: SYMBOLS, brokerInfo: f });
  const fxCom = Object.values(m).map((x) => x.commissionRT).find((v) => v > 0);
  const out = {};
  for (const k of FX) {
    const pip = k === 'usdjpy' ? 0.01 : 0.0001, measured = /^quotes/.test(m[k].src);
    out[k] = { src: measured ? m[k].src : 'default+commission (not in the fixture)', pip, spreadPips: measured ? m[k].spread / pip : 1,
      slipPips: 2 * SLIP_SPREADS * 1, commissionRT: m[k].commissionRT > 0 ? m[k].commissionRT : fxCom };
  }
  return out;
}
export const legCostPx = (c, px) => (c.spreadPips + c.slipPips) * c.pip + c.commissionRT * px;

// index of the H1 candle starting at time t (binary search), or -1
function at(H, t) { let lo = 0, hi = H.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (H[mid].time === t) return mid; if (H[mid].time < t) lo = mid + 1; else hi = mid - 1; } return -1; }

// one event on day y-m-d: null when data is missing
export function event(D, H, costs, y, m, d) {
  const s = signal(D, y, m, d);
  if (!s || s.gap === 0) return null;
  const t0 = londonAt(y, m, d, P.ENTRY_H), t1 = londonAt(y, m, d, P.EXIT_H - 1);
  const usdSide = s.gap > 0 ? -1 : 1;   // -1 = short USD
  const legs = [];
  for (const k of FX) {
    const B = H[k], e = at(B, t0), x = at(B, t1);
    if (e < 0 || x < 0 || x - e !== (P.EXIT_H - 1 - P.ENTRY_H)) return null;
    const a = atrBefore(B, e); if (!(a > 0)) return null;
    const side = USD_BASE.has(k) ? usdSide : -usdSide;
    const lg = leg(B, e, x, side, P.STOP_K * a), dist = P.STOP_K * a;
    const gR = side * (lg.exit - lg.entry) / dist, c = legCostPx(costs[k], lg.entry) / dist;
    legs.push({ k, side, why: lg.why, gR, R: gR - c, cR: c });
  }
  const mean = (f) => legs.reduce((q, l) => q + f(l), 0) / legs.length;
  return { day: key(y, m, d), t: t0, gap: s.gap, usd: usdSide > 0 ? 'long' : 'short', R: mean((l) => l.R), G: mean((l) => l.gR), C: mean((l) => l.cR), legs };
}

export function stats(rows, k = 'R') {
  const x = rows.map((r) => r[k]), n = x.length;
  if (n < 2) return { n };
  const m = x.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
  let eq = 0, pk = 0, dd = 0;
  for (const v of x) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const t = sd > 0 ? m / (sd / Math.sqrt(n)) : null;
  return { n, mean: m, sd, t, p: t == null ? null : 1 - phi(t), total: eq, maxDD: dd, win: x.filter((v) => v > 0).length / n };
}
export function phi(z) {   // standard normal CDF (Abramowitz-Stegun 7.1.26 on erf)
  const s = z < 0 ? -1 : 1, x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + s * y);
}
export function holm(ps, alpha = 0.05) {   // → array of booleans, same order
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), ok = Array(ps.length).fill(false);
  for (let j = 0; j < o.length; j++) { if (o[j].p <= alpha / (o.length - j)) ok[o[j].i] = true; else break; }
  return ok;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y), p = q * (s.length - 1), lo = Math.floor(p); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo); };

export function monthEnds(from, to) {
  const out = [];
  for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) for (let m = 0; m < 12; m++) {
    const d = lastLondonBusinessDay(y, m), k = key(y, m, d);
    if (k >= from && k <= to) out.push([y, m, d]);
  }
  return out;
}

export function verdictOf(dec, chk, decV, chkV, p95) {
  const okHolm = holm([dec.p, decV.p]);
  const rule = (s, c, h, placebo) => ({ meanPos: s.mean > 0, t: s.t >= P.PASS_T, holm: h, n: s.n >= P.MIN_N, check2008: c.mean > 0, ...(placebo == null ? {} : { placebo }) });
  const base = rule(dec, chk, okHolm[0], dec.mean > p95), variant = rule(decV, chkV, okHolm[1]);
  const pass = (c) => Object.values(c).every(Boolean);
  return { base, variant, basePass: pass(base), variantPass: pass(variant), pass: pass(base) || pass(variant) };
}

function loadAll(dir) {
  const D = {}, H = {};
  for (const k of IDX) D[k] = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')).rows;
  for (const k of FX) H[k] = JSON.parse(fs.readFileSync(path.join(dir, `${k}-h1.json`), 'utf8'));
  return { D, H };
}

export function full(dir) {
  const { D, H } = loadAll(dir);
  const fixture = JSON.parse(fs.readFileSync(path.join(HERE, '../../../tests/fixtures/ctrader/symbols-raw-12nov.json'), 'utf8'));
  const costs = buildCosts(fixture);
  const run = (win) => { const ev = [], miss = []; for (const [y, m, d] of monthEnds(...win)) { const e = event(D, H, costs, y, m, d); if (e) ev.push(e); else miss.push(key(y, m, d)); } return { ev, miss }; };
  const C = run(WIN.check), Dd = run(WIN.decisive);
  const med = pct(C.ev.map((e) => Math.abs(e.gap)), 0.5);
  const big = (ev) => ev.filter((e) => Math.abs(e.gap) > med);
  const dec = stats(Dd.ev), chk = stats(C.ev), decV = stats(big(Dd.ev)), chkV = stats(big(C.ev));
  // placebo: 40 random London business days a year (not month-ends) in the decisive window
  const rnd = mulberry32(1), pl = [];
  for (let y = +WIN.decisive[0].slice(0, 4); y <= +WIN.decisive[1].slice(0, 4); y++) {
    const days = [];
    for (let m = 0; m < 12; m++) { const last = lastLondonBusinessDay(y, m); for (let d = 1; d <= new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); d++) { const k = key(y, m, d); if (k < WIN.decisive[0] || k > WIN.decisive[1]) continue; if (d !== last && isLondonBusinessDay(y, m, d)) days.push([y, m, d]); } }
    for (let j = days.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [days[j], days[r]] = [days[r], days[j]]; }
    for (const [yy, mm, dd] of days.slice(0, P.PLACEBO_PER_YEAR)) { const e = event(D, H, costs, yy, mm, dd); if (e) pl.push(e.R); }
  }
  const rs = mulberry32(2), means = [];
  for (let i = 0; i < P.RESAMPLES; i++) { let s = 0; for (let j = 0; j < dec.n; j++) s += pl[Math.floor(rs() * pl.length)]; means.push(s / dec.n); }
  const p95 = pct(means, 0.95);
  const v = verdictOf(dec, chk, decV, chkV, p95);
  const fmt = (s, rows) => ({ n: s.n, meanR: r4(s.mean), sdR: r4(s.sd), t: r3(s.t), pOneSided: r4(s.p), totalR: r3(s.total), maxDDR: r3(s.maxDD), winShare: r3(s.win),
    grossMeanR: r4(stats(rows, 'G').mean), grossT: r3(stats(rows, 'G').t), costMeanR: r4(stats(rows, 'C').mean),
    stoppedShare: r3(rows.reduce((q, e) => q + e.legs.filter((l) => l.why !== 'time').length, 0) / Math.max(1, rows.length * FX.length)),
    usOutperformShare: r3(rows.filter((e) => e.gap > 0).length / Math.max(1, rows.length)),
    perPairMeanR: Object.fromEntries(FX.map((k) => [k, r4(rows.reduce((q, e) => q + e.legs.find((l) => l.k === k).R, 0) / Math.max(1, rows.length))])),
    from: rows[0]?.day, to: rows.at(-1)?.day });
  const byYear = {};
  for (const e of [...C.ev, ...Dd.ev]) { const y = e.day.slice(0, 4); byYear[y] = r3((byYear[y] || 0) + e.R); }
  return {
    topic: 'fx-month-end', built: '2026-11-13', title: 'Month-end US dollar rebalancing flow into the London 4 pm fix',
    system: 'Last London business day of each month: sign of S&P 500 month-to-date return minus the mean of DAX, FTSE and Nikkei month-to-date returns at 10:00 London; US outperformed = short USD on EUR/USD, GBP/USD, AUD/USD, USD/JPY, USD/CHF, USD/CAD from the 10:00 London H1 open to the 16:00 London close, else long USD; 1.5 x ATR(24 H1) stop on every leg, equal risk, net of the measured raw-spread costs',
    verdict: v.pass ? 'PASS' : 'FAIL', checks: { base: v.base, variant: v.variant },
    clock: 'London time with daylight saving; signal from OANDA daily index candles that closed by 10:00 London (00:00 UTC days, so the previous UTC day); entry at the 10:00 London H1 open, exit at the 16:00 London close',
    params: P, windows: WIN, costs, variantGapMedian: r4(med),
    base: { decisive: fmt(dec, Dd.ev), check: fmt(chk, C.ev) },
    variant: { decisive: fmt(decV, big(Dd.ev)), check: fmt(chkV, big(C.ev)) },
    missing: { check: C.miss, decisive: Dd.miss },
    placebo: { events: pl.length, meanR: r4(pl.reduce((s, x) => s + x, 0) / pl.length), resamples: P.RESAMPLES, p95: r4(p95), p50: r4(pct(means, 0.5)) },
    byYearR: byYear,
  };
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of IDX) {
    const f = path.join(dir, `${k}.json`);
    if (!fs.existsSync(f)) fs.writeFileSync(f, execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  }
  const start = T('2007-11-01'), end = T('2026-11-07'), step = 4900 * HOUR;
  for (const k of FX) {
    const f = path.join(dir, `${k}-h1.json`);
    if (fs.existsSync(f)) continue;
    const m = new Map();
    for (let a = start; a < end; a += step) {
      const b = Math.min(end, a + step), url = `https://meridianx.dev/md/bars?sym=${k}&tf=1h&from=${a}&to=${b}`;
      let j = null;
      for (let tr = 0; tr < 4 && !j; tr++) { try { const r = await fetch(url); if (r.ok) j = await r.json(); else await new Promise((z) => setTimeout(z, 3000)); } catch { await new Promise((z) => setTimeout(z, 3000)); } }
      if (!j) throw new Error('fetch failed ' + url);
      for (const x of j.bars) m.set(x.time, { time: x.time, open: x.open, high: x.high, low: x.low, close: x.close });
      await new Promise((z) => setTimeout(z, 300));
    }
    fs.writeFileSync(f, JSON.stringify([...m.values()].sort((p, q) => p.time - q.time)));
    console.log('saved', k, m.size);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv[2] === 'fetch' ? ['fetch', process.argv[3]] : ['run', process.argv[2]];
  if (!dir) { console.error('usage: node run.mjs [fetch] <dir>'); process.exit(1); }
  if (cmd === 'fetch') await fetchAll(dir);
  else {
    const out = full(dir);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ verdict: out.verdict, checks: out.checks, base: out.base, variant: out.variant, placebo: out.placebo, missing: out.missing, byYear: out.byYearR }, null, 1));
  }
}
