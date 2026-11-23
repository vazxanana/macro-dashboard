// research/edge/data-quality/audit.mjs - quality audit of the research candle cache every overnight study reads
// (research/edge/_lib/edgekit.mjs, DATA_DIR). Research only: reads the cache and council-data's HistData files, writes
// quality.json next to this file. Changes no cache file and nothing live.
//
//   node research/edge/data-quality/audit.mjs [--markets xau,eurusd] [--no-histdata] [--out <file>]
//
// Checks per market and year (5m OANDA mid candles; 1d raw UTC days):
//   1. structure: duplicate or unsorted times, OHLC consistency (h >= max(o, c), l <= min(o, c), all > 0), a time that is not
//      on a 5-minute boundary, a candle on a Saturday (UTC) or inside the weekend closure (New York time), flat candles.
//   2. gaps: missing 5-minute slots on a weekday outside the weekend, the 17:00 New York break (16:55-18:15 New York) and the
//      listed holidays, joined into runs; counts over 15 min / 1 h / 3 h, and the 20 longest from 2020 on.
//   3. spikes: a candle whose range is over 15x the median range of the 288 candles around it, and a close that jumps over
//      10x the median absolute 5-minute return and comes back at least half way within 3 candles. A range spike whose
//      extreme is a lone wick (half or more of its range is beyond every high / low of the 3 candles either side) is
//      "artefact-like". Checked against the second feed where it exists (confirmed = a real move, not excluded).
//   4. a second feed: council-data HistData M1 (git show origin/council-data:research/candles/...; labels converted to UTC
//      ONLY with council/histdata.mjs histStampUtc), grouped to 5m; candles present in both, the close difference
//      (median, 99th percentile, after the year's median offset: HistData is a bid feed, OANDA mid), the lag of best return
//      correlation (0 = clocks agree), and the UTC days whose median difference is over 5x the normal (rolling 61 days).
//   5. 1d against the 5m candles grouped by UTC day (the 1d files are UTC-aligned) and, for information, against
//      edgekit.dailyNY (17:00 New York days; the close differs by construction).
// Every finding that a study should leave out goes into `exclusions` [{ from, to, fromT, toT, kind, reason }].

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, nyOffsetH, dailyNY } from '../_lib/edgekit.mjs';
import { histStampUtc, euSummer } from '../../../council/histdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
export const FOCUS = Date.UTC(2020, 0, 1) / 1000;
export const ALL_MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag',
  // added 23 Nov 2026 (2019 on, no second feed)
  'gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
// indices keep their own hours: the open 5-minute slots of each weekday are learned from the candles of each year (a slot
// is open when the normal days of that weekday hold a candle there half the time or more), on the exchange's own clock
export const INDICES = { nas100: 'ny', spx500: 'ny', de40: 'eu' };
// market-wide events named in a gap's reason (the gap stays excluded: there are no prices to trade on)
export const KNOWN = [
  { from: '2020-03-08', to: '2020-03-25', markets: ['nas100', 'spx500'], why: 'March 2020: US index futures locked limit up / down, the CFD stopped quoting' },
  { from: '2022-05-04', to: '2022-05-13', why: 'the same hole is in nearly every market of the cache: a fetch gap, not the market' },
  { from: '2022-12-26', to: '2022-12-27', why: 'the same hole is in every forex market of the cache (HistData has prices): a fetch gap' },
  { from: '2025-01-09', to: '2025-01-10', markets: ['nas100', 'spx500'], why: 'US national day of mourning: US stock markets shut, index futures closed early' },
  { from: '2025-11-28', to: '2025-11-29', markets: ['nas100', 'spx500'], why: 'the CME outage of 28 Nov 2025 (trading halted for hours)' },
];
export const METALS = new Set(['xau', 'xag']);
// second feed folders in council-data (HistData M1); nzdusd and eurjpy have none
export const HIST = { xau: 'xau-histdata', xag: 'XAGUSD', eurusd: 'EURUSD', gbpusd: 'GBPUSD', usdjpy: 'USDJPY', audusd: 'AUDUSD', usdcad: 'USDCAD', usdchf: 'USDCHF' };
// display unit of a price difference
export const UNIT = { xau: [1, '$'], xag: [1, '$'], usdjpy: [0.01, 'pip'], eurjpy: [0.01, 'pip'], gbpjpy: [0.01, 'pip'], audjpy: [0.01, 'pip'], cadjpy: [0.01, 'pip'],
  nas100: [1, 'pt'], spx500: [1, 'pt'], de40: [1, 'pt'] };
const unitOf = (m) => UNIT[m] || [0.0001, 'pip'];
export const TH = {
  gapMin: [15, 60, 180], excludeGapMin: 60, rangeX: 15, jumpX: 10, window: 288, revertK: 3, wickFrac: 0.5,
  feedDayX: 5, feedMinCommon: 50, feedRollDays: 30, d1Tol: 1e-6, breakNY: [16 * 60 + 55, 18 * 60 + 15], sundayOpenNY: 18 * 60 + 30,
};
const S5 = 300;
const iso = (t) => new Date(t * 1000).toISOString().replace('.000Z', 'Z');
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

// ---- New York clock, holidays ----------------------------------------------------------------------------------------
const OFF = new Map();
function off(t) { const h = Math.floor(t / 3600); let v = OFF.get(h); if (v === undefined) { v = nyOffsetH(h * 3600); OFF.set(h, v); } return v; }
const dayKey = (y, m, d) => Date.UTC(y, m, d) / 86400e3;
function easter(y) { // anonymous Gregorian algorithm: [month 0-11, day]
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return [mo - 1, da];
}
const nthWd = (y, m, wd, n) => { const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((wd - first + 7) % 7) + 7 * (n - 1); };
const lastWd = (y, m, wd) => { const last = new Date(Date.UTC(y, m + 1, 0)); return last.getUTCDate() - ((last.getUTCDay() - wd + 7) % 7); };
// dayKey (New York date) -> minute of the New York day from which the market may be shut (0 = the whole day)
export function holidays(metal) {
  const H = new Map(); const put = (k, from) => { const v = H.get(k); H.set(k, v === undefined ? from : Math.min(v, from)); };
  for (let y = 2004; y <= 2027; y++) {
    put(dayKey(y, 0, 1), 0); put(dayKey(y, 11, 25), 0); put(dayKey(y, 11, 24), 13 * 60); put(dayKey(y, 11, 31), 13 * 60);
    const [em, ed] = easter(y); const gf = dayKey(y, em, ed) - 2; put(gf, 0); put(gf - 1, 16 * 60 + 55);
    if (!metal) continue;
    const us = [dayKey(y, 0, nthWd(y, 0, 1, 3)), dayKey(y, 1, nthWd(y, 1, 1, 3)), dayKey(y, 4, lastWd(y, 4, 1)), dayKey(y, 8, nthWd(y, 8, 1, 1))];
    if (y >= 2022) us.push(dayKey(y, 5, 19));
    const j4 = new Date(Date.UTC(y, 6, 4)).getUTCDay(); us.push(dayKey(y, 6, j4 === 6 ? 3 : j4 === 0 ? 5 : 4));
    const tg = dayKey(y, 10, nthWd(y, 10, 4, 4)); us.push(tg);
    for (const k of us) put(k, 13 * 60);
    put(tg + 1, 13 * 60); put(dayKey(y, 6, 3), 13 * 60);
    // a fixed holiday on a weekend is observed on the Friday before or the Monday after; the market shuts the evening before
    for (const [m, d] of [[11, 25], [0, 1]]) { const w = new Date(Date.UTC(y, m, d)).getUTCDay(); const k = dayKey(y, m, d) + (w === 6 ? -1 : w === 0 ? 1 : 0); if (w === 6 || w === 0) { put(k, 0); put(k - 1, 16 * 60 + 55); } }
  }
  return H;
}
// German exchange holidays (Eurex shut): New Year, Good Friday, Easter Monday, 1 May, 24-26 and 31 December
export function holidaysDE() {
  const H = new Map();
  for (let y = 2004; y <= 2027; y++) {
    const [em, ed] = easter(y); const e = dayKey(y, em, ed);
    for (const k of [dayKey(y, 0, 1), e - 2, e + 1, dayKey(y, 4, 1), dayKey(y, 11, 24), dayKey(y, 11, 25), dayKey(y, 11, 26), dayKey(y, 11, 31)]) H.set(k, 0);
  }
  return H;
}
// local clock of an index: New York for the US indices, Central European for de40
const euOff = (t) => (euSummer(t) ? 2 : 1);
export const localOf = (t, clock) => (clock === 'eu' ? t + euOff(t) * 3600 : t - off(t) * 3600);
// learn the open slots per local year and weekday from the candles: Map year -> Uint8Array(7 * 288)
export function learnSchedule(T, clock) {
  const perDay = new Map(); // local day key -> slots with a candle
  for (let i = 0; i < T.length; i++) { const l = localOf(T[i], clock), k = Math.floor(l / 86400); let a = perDay.get(k); if (!a) perDay.set(k, a = []); a.push(Math.floor((l - k * 86400) / S5)); }
  const byYW = new Map(); // year * 7 + weekday -> list of days
  for (const [k, slots] of perDay) { const y = new Date(k * 86400e3).getUTCFullYear(), wd = (k + 4) % 7, key = y * 7 + wd; let a = byYW.get(key); if (!a) byYW.set(key, a = []); a.push(slots); }
  const out = new Map();
  for (const [key, days] of byYW) {
    const y = Math.floor(key / 7), wd = key % 7; if (!out.has(y)) out.set(y, new Uint8Array(7 * 288)); const S = out.get(y);
    const med = median(days.map((d) => d.length)); const normal = days.filter((d) => d.length >= 0.5 * med); if (normal.length < 5) continue;
    const cnt = new Uint16Array(288); for (const d of normal) for (const sl of d) cnt[sl]++;
    for (let sl = 0; sl < 288; sl++) if (cnt[sl] >= 0.5 * normal.length) S[wd * 288 + sl] = 1;
  }
  return out;
}
export function indexClass(t, clock, sched, hol) {
  const l = localOf(t, clock), k = Math.floor(l / 86400), wd = (k + 4) % 7, sl = Math.floor((l - k * 86400) / S5), hm = sl * 5;
  if (wd === 6) return 'weekend';
  const S = sched.get(new Date(k * 86400e3).getUTCFullYear());
  if (!S || !S[wd * 288 + sl]) return wd === 5 || wd === 0 ? 'weekend' : 'break';
  const h = hol.get(k); if (h !== undefined && hm >= h) return 'holiday';
  return null;
}
// 'weekend' | 'break' | 'holiday' | null (a slot that should hold a candle)
export function slotClass(t, hol) {
  const ny = t - off(t) * 3600, k = Math.floor(ny / 86400), wd = (k + 4) % 7, hm = Math.floor((ny - k * 86400) / 60);
  if ((wd === 5 && hm >= 17 * 60) || wd === 6 || (wd === 0 && hm < TH.sundayOpenNY)) return 'weekend';
  if (wd >= 1 && wd <= 4 && hm >= TH.breakNY[0] && hm < TH.breakNY[1]) return 'break';
  const h = hol.get(k); if (h !== undefined && hm >= h) return 'holiday';
  return null;
}
const closedNow = (t) => { const ny = t - off(t) * 3600, k = Math.floor(ny / 86400), wd = (k + 4) % 7, hm = Math.floor((ny - k * 86400) / 60);
  return (wd === 5 && hm >= 17 * 60 + 5) || wd === 6 || (wd === 0 && hm < 16 * 60 + 55); };

// ---- loading -----------------------------------------------------------------------------------------------------------
function yearFiles(market, tf) {
  const dir = path.join(DATA_DIR, market);
  return fs.readdirSync(dir).filter((f) => f.startsWith(tf + '-') && f.endsWith('.json.gz')).sort().map((f) => ({ y: +f.slice(tf.length + 1, tf.length + 5), file: path.join(dir, f) }));
}
const readRows = (file) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());

function emptyYear() {
  return { n5m: 0, dup: 0, unsorted: 0, ohlcBad: 0, nonPositive: 0, oddMinute: 0, wrongYearFile: 0, saturday: 0, weekendClosed: 0, flat: 0,
    expectedSlots: 0, coverage: null, gaps: { over15m: 0, over1h: 0, over3h: 0, missingMin: 0 }, holidayGapMin: 0,
    rangeSpikes: 0, artefactSpikes: 0, jumpReverts: 0, spikesConfirmed: 0, spikesExcluded: 0, d1: null, ny1d: null, histdata: null };
}

// structure checks on the raw rows; returns sorted unique typed arrays
function load5m(market, years, bad) {
  const files = yearFiles(market, '5m'); const rows = [];
  for (const { y, file } of files) {
    const Y = years[y] || (years[y] = emptyYear()); const r = readRows(file); let prev = -Infinity; const seen = new Set();
    for (const x of r) {
      const [t, o, h, l, c] = x; Y.n5m++;
      if (seen.has(t)) Y.dup++; else seen.add(t);
      if (t < prev) Y.unsorted++; prev = t;
      if (t % S5) Y.oddMinute++;
      if (yearOf(t) !== y) Y.wrongYearFile++;
      if (!(o > 0 && h > 0 && l > 0 && c > 0)) { Y.nonPositive++; bad.push({ t, why: 'non-positive price' }); }
      else if (h < Math.max(o, c) - 1e-12 || l > Math.min(o, c) + 1e-12 || h < l) { Y.ohlcBad++; bad.push({ t, why: 'high / low not around open and close' }); }
      if (new Date(t * 1000).getUTCDay() === 6) Y.saturday++;
      if (!INDICES[market] && closedNow(t)) Y.weekendClosed++;
      if (o === h && h === l && l === c) Y.flat++;
      rows.push(x);
    }
  }
  rows.sort((a, b) => a[0] - b[0]);
  const u = rows.filter((x, i) => i === 0 || x[0] !== rows[i - 1][0]);
  const N = u.length, T = new Float64Array(N), O = new Float64Array(N), Hh = new Float64Array(N), L = new Float64Array(N), C = new Float64Array(N);
  u.forEach((x, i) => { T[i] = x[0]; O[i] = x[1]; Hh[i] = x[2]; L[i] = x[3]; C[i] = x[4]; });
  return { N, T, O, H: Hh, L, C };
}

// ---- sliding median ----------------------------------------------------------------------------------------------------
// median of vals[j] over j in [i - half, i + half), NaN values skipped. Sorted window in a Float64Array.
export function slidingMedian(vals, half) {
  const N = vals.length, out = new Float64Array(N), buf = new Float64Array(2 * half + 2); let n = 0;
  const pos = (v) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (buf[m] < v) lo = m + 1; else hi = m; } return lo; };
  const add = (v) => { if (Number.isNaN(v)) return; const p = pos(v); buf.copyWithin(p + 1, p, n); buf[p] = v; n++; };
  const del = (v) => { if (Number.isNaN(v)) return; const p = pos(v); buf.copyWithin(p, p + 1, n); n--; };
  for (let j = 0; j < Math.min(half, N); j++) add(vals[j]);
  for (let i = 0; i < N; i++) {
    if (i + half - 1 < N && i + half - 1 >= half) add(vals[i + half - 1]);
    if (i - half - 1 >= 0) del(vals[i - half - 1]);
    out[i] = n ? (n % 2 ? buf[n >> 1] : (buf[(n >> 1) - 1] + buf[n >> 1]) / 2) : NaN;
  }
  return out;
}

// ---- HistData ---------------------------------------------------------------------------------------------------------
function loadHist(market) {
  const folder = HIST[market]; if (!folder) return null;
  const list = execFileSync('git', ['ls-tree', '--name-only', 'origin/council-data', `research/candles/${folder}/`], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
  const t5 = [], o5 = [], h5 = [], l5 = [], c5 = []; let last = -Infinity, dropped = 0, lines = 0;
  for (const f of list) {
    const text = zlib.gunzipSync(execFileSync('git', ['show', `origin/council-data:${f}`], { cwd: ROOT, maxBuffer: 1 << 30 })).toString();
    let s = 0;
    while (s < text.length) {
      let e = text.indexOf('\n', s); if (e < 0) e = text.length;
      const line = text.slice(s, e); s = e + 1;
      if (line.length < 20) continue;
      const p = line.split(';'); if (p.length < 5) continue; lines++;
      const t = histStampUtc(p[0]);
      if (t <= last) { dropped++; continue; } last = t;
      const o = +p[1], h = +p[2], l = +p[3], c = +p[4], b = Math.floor(t / S5) * S5, k = t5.length - 1;
      if (k >= 0 && t5[k] === b) { if (h > h5[k]) h5[k] = h; if (l < l5[k]) l5[k] = l; c5[k] = c; }
      else { t5.push(b); o5.push(o); h5.push(h); l5.push(l); c5.push(c); }
    }
  }
  return { T: Float64Array.from(t5), O: Float64Array.from(o5), H: Float64Array.from(h5), L: Float64Array.from(l5), C: Float64Array.from(c5), lines, dropped, files: list.length, folder };
}
function idxMap(T) { const m = new Map(); for (let i = 0; i < T.length; i++) m.set(T[i], i); return m; }
const median = (a) => { if (!a.length) return null; const s = Float64Array.from(a).sort(); const n = s.length; return n % 2 ? s[n >> 1] : (s[(n >> 1) - 1] + s[n >> 1]) / 2; };
const quant = (a, q) => { if (!a.length) return null; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function corr(x, y) { const n = x.length; if (n < 30) return null; let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; } const mx = sx / n, my = sy / n;
  let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; a += dx * dy; b += dx * dx; c += dy * dy; } return b && c ? a / Math.sqrt(b * c) : null; }
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);

// ---- one market ---------------------------------------------------------------------------------------------------------
export function auditMarket(market, { histdata = true } = {}) {
  const t0 = Date.now(); const metal = METALS.has(market); const clock = INDICES[market];
  const hol = clock === 'eu' ? holidaysDE() : holidays(metal || clock === 'ny'); const [U, uName] = unitOf(market);
  const years = {}; const badRows = []; const exclusions = []; const notes = []; const review = [];
  const D = load5m(market, years, badRows); const { N, T, O, H, L, C } = D;
  const sched = clock ? learnSchedule(T, clock) : null;
  const cls = sched ? (t) => indexClass(t, clock, sched, hol) : (t) => slotClass(t, hol);
  for (const b of badRows) exclusions.push(ex(b.t, b.t + S5, 'structure', b.why));

  // second feed (4), loaded first so gaps and spikes can be checked against it
  const hd = histdata ? loadHist(market) : null; const hdIdx = hd ? idxMap(hd.T) : null;
  const hdCount = (a, b) => { if (!hd || a < hd.T[0] || b > hd.T[hd.T.length - 1] + S5) return null; let n = 0; for (let t = a; t < b; t += S5) if (hdIdx.has(t)) n++; return n; };

  // 2. gaps and coverage
  const gapRuns = [];
  const runAdd = (list, s, kind) => { const r = list[list.length - 1]; if (r && r.to === s && r.kind === kind) r.to = s + S5; else list.push({ from: s, to: s + S5, kind }); };
  for (let i = 1; i < N; i++) {
    for (let s = T[i - 1] + S5; s < T[i]; s += S5) { const k = cls(s); if (k === null) runAdd(gapRuns, s, 'gap'); else if (k === 'holiday') runAdd(gapRuns, s, 'holiday'); }
  }
  // expected slots per year (slots that should hold a candle) between the first and last candle
  for (let s = T[0]; s <= T[N - 1]; s += S5) if (cls(s) === null) { const y = yearOf(s); (years[y] || (years[y] = emptyYear())).expectedSlots++; }
  const counted = {}; for (let i = 0; i < N; i++) if (cls(T[i]) === null) { const y = yearOf(T[i]); counted[y] = (counted[y] || 0) + 1; }
  for (const [y, Y] of Object.entries(years)) Y.coverage = Y.expectedSlots ? r4((counted[y] || 0) / Y.expectedSlots) : null;
  for (const r of gapRuns) {
    const min = (r.to - r.from) / 60, Y = years[yearOf(r.from)] || (years[yearOf(r.from)] = emptyYear());
    if (r.kind === 'holiday') { Y.holidayGapMin += min; continue; }
    Y.gaps.missingMin += min; if (min > 15) Y.gaps.over15m++; if (min > 60) Y.gaps.over1h++; if (min > 180) Y.gaps.over3h++;
    if (min >= TH.excludeGapMin) {
      const n = hdCount(r.from, r.to), slots = (r.to - r.from) / S5;
      const second = n === null ? 'no second feed for that time' : n >= slots / 2 ? `HistData has prices in ${n} of the ${slots} 5-minute slots, so the market traded: a hole in the cache` : `HistData is nearly empty there too (${n} of ${slots} slots): the market was probably shut`;
      const known = KNOWN.find((k) => (!k.markets || k.markets.includes(market)) && r.from < Date.parse(k.to) / 1000 && r.to > Date.parse(k.from) / 1000);
      const hours = clock ? 'inside its learned trading hours, outside listed holidays' : 'outside the weekend, the 17:00 New York break and listed holidays';
      exclusions.push(ex(r.from, r.to, 'gap', `no candles for ${fmtMin(min)} from ${nyText(r.from)} (${hours}); ${second}${known ? '; ' + known.why : ''}`));
    }
  }
  const longestGaps = gapRuns.filter((r) => r.kind === 'gap' && r.from >= FOCUS).sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 20)
    .map((r) => ({ from: iso(r.from), to: iso(r.to), minutes: (r.to - r.from) / 60, nyStart: nyText(r.from) }));

  // 3. spikes
  const rng = new Float64Array(N), ret = new Float64Array(N);
  for (let i = 0; i < N; i++) { rng[i] = H[i] - L[i]; ret[i] = i && T[i] - T[i - 1] <= 900 ? Math.abs(C[i] - C[i - 1]) : NaN; }
  const half = TH.window / 2, medR = slidingMedian(rng, half), medA = slidingMedian(ret, half);
  const spikes = [];
  for (let i = 0; i < N; i++) {
    const floor = C[i] * 2e-6; let hit = null;
    const mr = Math.max(medR[i] || 0, floor);
    if (rng[i] > TH.rangeX * mr) {
      let hiN = -Infinity, loN = Infinity;
      for (let j = Math.max(0, i - 3); j <= Math.min(N - 1, i + 3); j++) if (j !== i) { if (H[j] > hiN) hiN = H[j]; if (L[j] < loN) loN = L[j]; }
      const excess = Math.max(H[i] - hiN, loN - L[i], 0), frac = rng[i] ? excess / rng[i] : 0;
      hit = { i, kind: 'range', x: rng[i] / mr, frac, artefact: frac >= TH.wickFrac, size: rng[i], end: T[i] + S5 };
    }
    const ma = Math.max(medA[i] || 0, floor);
    if (!Number.isNaN(ret[i]) && ret[i] > TH.jumpX * ma && i + 1 < N) {
      const d = C[i] - C[i - 1]; let k = 0;
      for (let j = 1; j <= TH.revertK && i + j < N; j++) if (Math.abs(C[i + j] - C[i - 1]) <= 0.5 * Math.abs(d)) { k = j; break; }
      if (k) {
        const jx = ret[i] / ma;
        if (hit) { hit.jump = true; hit.artefact = true; hit.x = Math.max(hit.x, jx); hit.end = Math.max(hit.end, T[i + k] + S5); }
        else hit = { i, kind: 'jump', x: jx, frac: null, artefact: true, size: Math.abs(d), end: T[i + k] + S5, jump: true };
      }
    }
    if (!hit) continue;
    const Y = years[yearOf(T[i])] || (years[yearOf(T[i])] = emptyYear());
    if (hit.kind === 'range') Y.rangeSpikes++; if (hit.jump) Y.jumpReverts++; if (hit.artefact) Y.artefactSpikes++;
    let confirmed = null;
    if (hdIdx && T[i] >= hd.T[0] && T[i] <= hd.T[hd.T.length - 1]) {
      // the second feed decides only where it holds the candle itself (and, for a jump, the one before)
      const j = hdIdx.get(T[i]), p = i ? hdIdx.get(T[i - 1]) : undefined;
      if (j === undefined || (hit.jump && p === undefined)) confirmed = null;
      else if (!hit.jump) confirmed = hd.H[j] - hd.L[j] >= 0.5 * rng[i];
      else { const dO = C[i] - C[i - 1]; confirmed = (hd.C[j] - hd.C[p]) * Math.sign(dO) >= 0.5 * Math.abs(dO) || hd.H[j] - hd.L[j] >= 0.5 * rng[i]; }
    }
    if (confirmed) Y.spikesConfirmed++;
    const rec = { t: iso(T[i]), kind: hit.jump ? (hit.kind === 'range' ? 'range+jump' : 'jump') : 'range', x: Math.round(hit.x * 10) / 10,
      size: Math.round((hit.size / U) * 100) / 100, unit: uName, lonePart: hit.frac == null ? null : Math.round(hit.frac * 100) / 100,
      artefactLike: hit.artefact, secondFeed: confirmed === null ? 'none' : confirmed ? 'confirmed' : 'not seen' };
    spikes.push(rec);
    // 'spike' = the second feed holds that candle and shows no such move (likely a bad print in the OANDA cache): excluded;
    // 'spike-unchecked' = no second-feed candle there (mostly news minutes and the 17:00 rollover: may be real): `review`
    if (hit.artefact && confirmed !== true) {
      if (confirmed === false) Y.spikesExcluded++; else Y.spikesUnchecked = (Y.spikesUnchecked || 0) + 1;
      (confirmed === false ? exclusions : review).push(ex(T[i], hit.end, confirmed === false ? 'spike' : 'spike-unchecked', `${hit.jump ? 'close jump that comes back' : 'lone-wick candle'} ${rec.x}x the local median (${rec.size} ${uName}) at ${nyText(T[i])}; ${confirmed === null ? 'no second-feed candle to check it against' : 'the HistData candle at the same time shows no such move'}`));
    }
  }

  // 4. second feed comparison
  let feed = null;
  if (hd) {
    const oIdx = idxMap(T); const byYear = {}; const days = new Map();
    let both = 0, oOnly = 0, hOnly = 0;
    const hFirst = hd.T[0], hLast = hd.T[hd.T.length - 1];
    for (let i = 0; i < N; i++) {
      const t = T[i]; if (t < hFirst || t > hLast) continue; const y = yearOf(t);
      const B = byYear[y] || (byYear[y] = { both: 0, oandaOnly: 0, histOnly: 0, diffs: [], ro: { '-12': [[], []], '-1': [[], []], 0: [[], []], 1: [[], []], 12: [[], []] } });
      const j = hdIdx.get(t); if (j === undefined) { B.oandaOnly++; if (t >= FOCUS) oOnly++; continue; }
      B.both++; if (t >= FOCUS) both++;
      const d = (C[i] - hd.C[j]) / U; B.diffs.push(d);
      const dk = Math.floor(t / 86400); let dd = days.get(dk); if (!dd) days.set(dk, dd = []); dd.push([d, (H[i] - L[i]) / U]);
      if (i && T[i - 1] === t - S5) {
        const rO = Math.log(C[i] / C[i - 1]);
        for (const L0 of [-12, -1, 0, 1, 12]) { const a = hdIdx.get(t + L0 * S5), b = hdIdx.get(t + L0 * S5 - S5); if (a !== undefined && b !== undefined) { B.ro[L0][0].push(rO); B.ro[L0][1].push(Math.log(hd.C[a] / hd.C[b])); } }
      }
    }
    for (let j = 0; j < hd.T.length; j++) { const t = hd.T[j]; if (t < T[0] || t > T[N - 1]) continue; if (oIdx.get(t) === undefined) { const y = yearOf(t); (byYear[y] || (byYear[y] = { both: 0, oandaOnly: 0, histOnly: 0, diffs: [], ro: {} })).histOnly++; if (t >= FOCUS) hOnly++; } }
    const perYear = {}; const offsets = {};
    for (const [y, B] of Object.entries(byYear)) {
      const offY = median(B.diffs) ?? 0; offsets[y] = offY;
      const abs = B.diffs.map((d) => Math.abs(d - offY));
      const lag = {}; let best = null;
      for (const [L0, pair] of Object.entries(B.ro || {})) { const c = corr(pair[0], pair[1]); lag[L0] = r4(c); if (c != null && (best == null || c > lag[best])) best = L0; }
      perYear[y] = { both: B.both, oandaOnly: B.oandaOnly, histOnly: B.histOnly, shareBoth: r4(B.both / Math.max(1, B.both + B.oandaOnly + B.histOnly)),
        offset: r4(offY), medAbs: r4(median(abs)), p99Abs: r4(quant(abs, 0.99)), maxAbs: r4(abs.reduce((m, x) => (x > m ? x : m), 0)), lagCorr: lag, bestLag: best == null ? null : +best };
      years[y] && (years[y].histdata = perYear[y]);
    }
    // disagreement days. Two readings of a day against the 61 days around it (only days with 50+ common candles):
    //   scatter = the median of |difference - the day's own median|, divided by the day's median OANDA candle range (so a
    //     busy day is not flagged for being busy): over 5x normal = the two feeds do not move together -> excluded;
    //   shift = the day's median difference against the year's: over 5x normal while the scatter is normal = the whole
    //     day sat a near-constant amount apart (a wider bid / mid gap: HistData is a bid feed) -> a note only.
    const keys = [...days.keys()].sort((a, b) => a - b); const dayStat = new Map();
    for (const k of keys) {
      const arr = days.get(k); if (arr.length < TH.feedMinCommon) continue; const y = yearOf(k * 86400);
      const dm = median(arr.map((x) => x[0])), sc = median(arr.map((x) => Math.abs(x[0] - dm))), rg = median(arr.map((x) => x[1]));
      dayStat.set(k, { dm, sc, rg, rel: rg > 0 ? sc / rg : null, shift: Math.abs(dm - (offsets[y] || 0)), n: arr.length });
    }
    const mk = [...dayStat.keys()]; const badDays = [];
    for (let a = 0; a < mk.length; a++) {
      const k = mk[a], S = dayStat.get(k), wr = [], ws = [];
      for (let b = Math.max(0, a - TH.feedRollDays); b <= Math.min(mk.length - 1, a + TH.feedRollDays); b++) if (b !== a) { const o = dayStat.get(mk[b]); if (o.rel != null) wr.push(o.rel); ws.push(o.sc); }
      const baseRel = median(wr), baseSc = median(ws), y = yearOf(k * 86400), day = iso(k * 86400).slice(0, 10);
      const scat = S.rel != null && baseRel > 0 && S.rel > TH.feedDayX * baseRel, shift = baseSc > 0 && S.shift > TH.feedDayX * baseSc;
      if (!scat && !shift) continue;
      const rec = { day, kind: scat ? 'scatter' : 'shift', holiday: hol.has(k), common: S.n, dayOffset: r4(S.dm), shiftFromYear: r4(S.shift), scatter: r4(S.sc), scatterPerRange: r4(S.rel), normalPerRange: r4(baseRel), normalScatter: r4(baseSc), unit: uName };
      badDays.push(rec); if (years[y]) years[y].feedBadDays = (years[y].feedBadDays || 0) + 1;
      const holi = hol.has(Math.floor((k * 86400 + 12 * 3600) / 86400)) ? ' (a listed holiday: thin trading on both feeds)' : '';
      if (scat) exclusions.push(ex(k * 86400, k * 86400 + 86400, 'feed', `OANDA and HistData do not move together that day${holi}: scatter ${r4(S.rel)} of a candle range against ${r4(baseRel)} normally (${Math.round((S.rel / baseRel) * 10) / 10}x); which feed is wrong is not known`));
      else notes.push({ day, note: `OANDA mid sat ${r4(S.dm)} ${uName} from the HistData bid all day (${r4(S.shift)} ${uName} more than the year's usual gap) while the candles moved together: a wider spread that day, not a broken candle` });
    }
    const focus = Object.entries(perYear).filter(([y]) => +y >= 2020).map(([, v]) => v);
    const allAbs = []; for (const [y, B] of Object.entries(byYear)) if (+y >= 2020) for (const d of B.diffs) allAbs.push(Math.abs(d - offsets[y]));
    feed = { folder: hd.folder, files: hd.files, lines: hd.lines, droppedRepeats: hd.dropped, unit: uName,
      from2020: { both, oandaOnly: oOnly, histOnly: hOnly, shareBoth: r4(both / Math.max(1, both + oOnly + hOnly)), medAbs: r4(median(allAbs)), p99Abs: r4(quant(allAbs, 0.99)),
        offsetByYear: Object.fromEntries(Object.entries(offsets).filter(([y]) => +y >= 2020).map(([y, v]) => [y, r4(v)])), bestLagAllZero: focus.every((v) => v.bestLag === 0) },
      perYear, badDays };
  }

  // 5. 1d checks
  const d1rows = []; for (const { y, file } of yearFiles(market, '1d')) { for (const r of readRows(file)) d1rows.push([...r, y]); }
  d1rows.sort((a, b) => a[0] - b[0]);
  const utc = new Map(); for (let i = 0; i < N; i++) { const k = Math.floor(T[i] / 86400) * 86400; const v = utc.get(k); if (!v) utc.set(k, [O[i], H[i], L[i], C[i], 1]); else { if (H[i] > v[1]) v[1] = H[i]; if (L[i] < v[2]) v[2] = L[i]; v[3] = C[i]; v[4]++; } }
  const d1seen = new Set();
  for (const r of d1rows) {
    const [t, o, h, l, c, fy] = r; const y = yearOf(t); const Y = years[y] || (years[y] = emptyYear());
    const S = Y.d1 || (Y.d1 = { rows: 0, dup: 0, ohlcBad: 0, notMidnight: 0, saturday: 0, sundayStubs: 0, matched: 0, mismatched: 0, missingIn5m: 0, missingIn1d: 0, wrongYearFile: 0 });
    S.rows++; if (d1seen.has(t)) S.dup++; d1seen.add(t); if (fy !== y) S.wrongYearFile++;
    if (t % 86400) S.notMidnight++;
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 6) S.saturday++; if (wd === 0) S.sundayStubs++;
    if (!(o > 0 && l > 0) || h < Math.max(o, c) - 1e-12 || l > Math.min(o, c) + 1e-12) { S.ohlcBad++; exclusions.push(ex(t, t + 86400, 'daily', '1d candle with high / low not around open and close')); }
    if (t < T[0] || t > T[N - 1]) continue;
    const a = utc.get(t); if (!a) { S.missingIn5m++; continue; }
    const tol = Math.max(TH.d1Tol * c, 1e-9);
    const diffs = [o - a[0], h - a[1], l - a[2], c - a[3]].map(Math.abs);
    if (diffs.some((x) => x > tol)) { S.mismatched++; S.examples = S.examples || []; if (S.examples.length < 5) S.examples.push({ day: iso(t).slice(0, 10), d1: [o, h, l, c], from5m: a.slice(0, 4), n5m: a[4] });
      if (diffs[1] > 10 * tol || diffs[2] > 10 * tol) exclusions.push(ex(t, t + 86400, 'daily', `1d candle disagrees with its own 5m candles (high ${r4(diffs[1] / U)}, low ${r4(diffs[2] / U)} ${uName} apart)`)); }
    else S.matched++;
  }
  const lastD1 = d1rows.length ? d1rows[d1rows.length - 1][0] : -Infinity;
  for (const [k, v] of utc) { if (v[4] < 12 || d1seen.has(k) || k > lastD1) continue; const Y = years[yearOf(k)]; if (Y && Y.d1) Y.d1.missingIn1d++; }
  // dailyNY against the 1d rows: information only (different day boundaries)
  const bars = []; for (let i = 0; i < N; i++) bars.push({ t: T[i], o: O[i], h: H[i], l: L[i], c: C[i] });
  const ny = dailyNY(bars); const d1byDate = new Map(d1rows.map((r) => [iso(r[0]).slice(0, 10), r]));
  const nyStat = {};
  for (const d of ny) { const y = +d.date.slice(0, 4); const S = nyStat[y] || (nyStat[y] = { days: 0, short: 0, withD1: 0, diffs: [] }); S.days++; if (d.n < 200) S.short++; const r = d1byDate.get(d.date); if (r) { S.withD1++; S.diffs.push(Math.abs(d.c - r[4]) / U); } }
  for (const [y, S] of Object.entries(nyStat)) if (years[y]) years[y].ny1d = { tradingDays: S.days, shortDays: S.short, withSameDate1d: S.withD1, medCloseDiff: r4(median(S.diffs)), unit: uName };

  // verdict (2020 on)
  const fy = Object.entries(years).filter(([y]) => +y >= 2020).map(([, v]) => v);
  const sum = (f) => fy.reduce((s, v) => s + (f(v) || 0), 0);
  const structural = sum((v) => v.dup + v.unsorted + v.ohlcBad + v.nonPositive + v.oddMinute + v.saturday);
  const minCov = Math.min(...fy.filter((v) => v.expectedSlots > 20000).map((v) => v.coverage ?? 1));
  const exFocus = exclusions.filter((e) => e.toT > FOCUS);
  const why = []; let verdict = 'usable';
  if (structural > 0) why.push(`${structural} candles with structural faults`);
  if (minCov < 0.95) why.push(`lowest yearly coverage ${(minCov * 100).toFixed(1)} %`);
  if (feed && !feed.from2020.bestLagAllZero) why.push('the second feed fits best at a shifted clock in some year');
  if (structural > 50 || minCov < 0.9 || (feed && !feed.from2020.bestLagAllZero)) verdict = 'not usable';
  else if (exFocus.length) verdict = 'usable with exclusions';
  const kinds = {}; for (const e of exFocus) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  if (verdict === 'usable with exclusions') why.push(Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ') + ' intervals from 2020 on');
  if (!why.length) why.push('no fault found from 2020 on');
  const spikesFocus = spikes.filter((s) => s.t >= '2020');
  return {
    market, metal, index: clock ? { clock: clock === 'eu' ? 'Central European' : 'New York', openHoursPerWeek: Object.fromEntries([...sched].map(([y, S]) => [y, Math.round(S.reduce((a, b) => a + b, 0) * 5 / 6) / 10])) } : null, secondFeedAvailable: !!HIST[market], unit: uName, first: iso(T[0]), last: iso(T[N - 1]), n5m: N, verdict, verdictWhy: why.join('; '),
    focus: { exclusions: exFocus.length, byKind: kinds, unexcusedGapMin: sum((v) => v.gaps.missingMin), gapsOver1h: sum((v) => v.gaps.over1h), minCoverage: r4(minCov),
      spikes: spikesFocus.length, spikesExcluded: sum((v) => v.spikesExcluded), spikesUnchecked: review.filter((e) => e.toT > FOCUS).length, feedBadDays: feed ? feed.badDays.filter((d) => d.day >= '2020').length : null },
    years, longestGaps, spikes: spikesFocus.sort((a, b) => b.x - a.x).slice(0, 40), spikesBefore2020: spikes.filter((s) => s.t < '2020').length,
    feed, exclusions, review: review.filter((e) => e.toT > FOCUS), reviewBefore2020: review.filter((e) => e.toT <= FOCUS).length, notes, seconds: Math.round((Date.now() - t0) / 1000),
  };
}
function ex(fromT, toT, kind, reason) { return { from: iso(fromT), to: iso(toT), fromT, toT, kind, reason }; }
const fmtMin = (m) => (m >= 120 ? (m / 60).toFixed(1) + ' h' : m + ' min');
function nyText(t) { const ny = t - off(t) * 3600; const d = new Date(ny * 1000); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + d.toISOString().slice(11, 16) + ' New York'; }

// ---- main ---------------------------------------------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2); const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const markets = (get('--markets') || ALL_MARKETS.join(',')).split(',');
  const out = get('--out') || path.join(HERE, 'quality.json');
  const res = { built: new Date().toISOString(), cache: 'edgekit DATA_DIR (OANDA mid 5m and raw UTC 1d candles)', focusFrom: '2020-01-01',
    secondFeed: 'council-data research/candles HistData M1 (bid), labels to UTC with council/histdata.mjs histStampUtc', thresholds: TH,
    markets: {} };
  for (const m of markets) {
    const r = auditMarket(m, { histdata: !args.includes('--no-histdata') });
    res.markets[m] = r;
    console.log(`${m}: ${r.verdict} (${r.verdictWhy}); ${r.seconds} s`);
  }
  fs.writeFileSync(out, JSON.stringify(res) + '\n');
  console.log('wrote', out);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
