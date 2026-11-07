// Edge research · seasonality: the pre-registered family (preregistration.md) of 6 calendar/clock hypotheses, 10 tests,
// on OANDA 5-minute mid candles for NAS100 (NQ), SPX500 (ES) and XAU/USD, 2006-01-01 to 2026-11-06.
//   node run.mjs <candleDir from fetch.mjs> [outJson=result.json]
// Half A (test) = entries 2006-2015, half B (confirm) = entries 2016-01-01 to 2026-11-06. Bonferroni over 10 tests in A,
// over the survivors in B; net x2 must stay positive in both halves. Paper research only: nothing live is changed.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { HISTORY, EVENTS } from '../../../council/events.mjs';

const [DIR, OUTJ = path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json')] = process.argv.slice(2);
if (!DIR) throw new Error('usage: node run.mjs <candleDir> [out.json]');
const END = Date.parse('2026-11-07T00:00:00Z') / 1000, SPLIT = Date.parse('2016-01-01T00:00:00Z') / 1000;
const NY = 'America/New_York', LDN = 'Europe/London';
const K = 10, ALPHA = 0.05, STALE = 1800;

// ---------- candles ----------
function load(sym) {
  const a = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `${sym}-5m.json.gz`))));
  const t = new Float64Array(a.length), o = new Float64Array(a.length), h = new Float64Array(a.length), l = new Float64Array(a.length), c = new Float64Array(a.length);
  a.forEach((r, i) => { t[i] = r[0]; o[i] = r[1]; h[i] = r[2]; l[i] = r[3]; c[i] = r[4]; });
  return { sym, t, o, h, l, c, n: a.length };
}
const M = { nq: load('nas100'), es: load('spx500'), xau: load('xau') };
function idxLE(m, T) { let lo = 0, hi = m.n - 1, r = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (m.t[mid] <= T) { r = mid; lo = mid + 1; } else hi = mid - 1; } return r; }
// Price at clock instant T: the open of the candle starting at T, else the close of the last candle that started within 30 min.
function priceAt(m, T) {
  const i = idxLE(m, T); if (i < 0) return null;
  if (m.t[i] === T) return m.o[i];
  return T - m.t[i] <= STALE ? m.c[i] : null;
}
function barAt(m, T) { const i = idxLE(m, T); return i >= 0 && m.t[i] === T ? i : -1; }

// ---------- time zones and calendars ----------
const fmt = {};
function parts(ts, tz) {
  fmt[tz] ||= new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(fmt[tz].formatToParts(new Date(ts * 1000)).map((x) => [x.type, x.value]));
  return { d: `${p.year}-${p.month}-${p.day}`, h: +p.hour, mi: +p.minute, wd: p.weekday };
}
function zoned(date, hm, tz) { // local wall time -> unix seconds
  const [y, mo, d] = date.split('-').map(Number), [hh, mm] = hm.split(':').map(Number);
  const want = Date.UTC(y, mo - 1, d, hh, mm) / 1000; let t = want;
  for (let k = 0; k < 3; k++) { const p = parts(t, tz); const [py, pm, pd] = p.d.split('-').map(Number); const got = Date.UTC(py, pm - 1, pd, p.h, p.mi) / 1000; t += want - got; }
  return t;
}
const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const dow = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
const addDays = (s, k) => new Date(Date.parse(s + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
function nthWd(y, m, wd, n) { const f = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return iso(y, m, 1 + ((wd - f + 7) % 7) + 7 * (n - 1)); }
function lastWd(y, m, wd) { const last = new Date(Date.UTC(y, m, 0)); const d = last.getUTCDate() - ((last.getUTCDay() - wd + 7) % 7); return iso(y, m, d); }
function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return iso(y, mo, da); }
function nyseHolidays(y) {
  const H = new Set(); const obs = (s, nySat) => { const w = dow(s); if (w === 6) { if (nySat) H.add(addDays(s, -1)); } else if (w === 0) H.add(addDays(s, 1)); else H.add(s); };
  obs(iso(y, 1, 1), false); H.add(nthWd(y, 1, 1, 3)); H.add(nthWd(y, 2, 1, 3)); H.add(addDays(easter(y), -2)); H.add(lastWd(y, 5, 1));
  if (y >= 2022) obs(iso(y, 6, 19), true); obs(iso(y, 7, 4), true); H.add(nthWd(y, 9, 1, 1)); H.add(nthWd(y, 11, 4, 4)); obs(iso(y, 12, 25), true);
  return H;
}
const NYSE_SPECIAL = ['2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09'];
const NYSE = new Set(NYSE_SPECIAL); for (let y = 2005; y <= 2027; y++) for (const d of nyseHolidays(y)) NYSE.add(d);
function ukHolidays(y) {
  const H = new Set(); const e = easter(y);
  const ny = iso(y, 1, 1), w = dow(ny); H.add(w === 6 ? addDays(ny, 2) : w === 0 ? addDays(ny, 1) : ny);
  H.add(addDays(e, -2)); H.add(addDays(e, 1));
  if (y !== 2020) H.add(nthWd(y, 5, 1, 1));
  if (y !== 2012 && y !== 2022) H.add(lastWd(y, 5, 1));
  H.add(lastWd(y, 8, 1));
  const xm = iso(y, 12, 25), xw = dow(xm);
  if (xw === 6) { H.add(iso(y, 12, 27)); H.add(iso(y, 12, 28)); } else if (xw === 0) { H.add(iso(y, 12, 26)); H.add(iso(y, 12, 27)); }
  else if (xw === 5) { H.add(xm); H.add(iso(y, 12, 28)); } else { H.add(xm); H.add(iso(y, 12, 26)); }
  return H;
}
const UK = new Set(['2011-04-29', '2012-06-04', '2012-06-05', '2020-05-08', '2022-06-02', '2022-06-03', '2022-09-19', '2023-05-08']);
for (let y = 2005; y <= 2027; y++) for (const d of ukHolidays(y)) UK.add(d);
const TDAYS = []; for (let s = '2006-01-02'; s < '2026-11-07'; s = addDays(s, 1)) { const w = dow(s); if (w >= 1 && w <= 5 && !NYSE.has(s)) TDAYS.push(s); }
const TIDX = new Map(TDAYS.map((d, i) => [d, i]));

// ---------- FOMC (scheduled statements; second day of each scheduled meeting) ----------
// 2006-2021 hard-coded from the Fed's public meeting calendar (federalreserve.gov does not resolve from the sandbox) and
// verified below on the candles; 2022+ from council/events.mjs. Unscheduled actions are excluded; March 2020 was cancelled.
const FOMC_OLD = {
  2006: ['01-31', '03-28', '05-10', '06-29', '08-08', '09-20', '10-25', '12-12'],
  2007: ['01-31', '03-21', '05-09', '06-28', '08-07', '09-18', '10-31', '12-11'],
  2008: ['01-30', '03-18', '04-30', '06-25', '08-05', '09-16', '10-29', '12-16'],
  2009: ['01-28', '03-18', '04-29', '06-24', '08-12', '09-23', '11-04', '12-16'],
  2010: ['01-27', '03-16', '04-28', '06-23', '08-10', '09-21', '11-03', '12-14'],
  2011: ['01-26', '03-15', '04-27', '06-22', '08-09', '09-21', '11-02', '12-13'],
  2012: ['01-25', '03-13', '04-25', '06-20', '08-01', '09-13', '10-24', '12-12'],
  2013: ['01-30', '03-20', '05-01', '06-19', '07-31', '09-18', '10-30', '12-18'],
  2014: ['01-29', '03-19', '04-30', '06-18', '07-30', '09-17', '10-29', '12-17'],
  2015: ['01-28', '03-18', '04-29', '06-17', '07-29', '09-17', '10-28', '12-16'],
  2016: ['01-27', '03-16', '04-27', '06-15', '07-27', '09-21', '11-02', '12-14'],
  2017: ['02-01', '03-15', '05-03', '06-14', '07-26', '09-20', '11-01', '12-13'],
  2018: ['01-31', '03-21', '05-02', '06-13', '08-01', '09-26', '11-08', '12-19'],
  2019: ['01-30', '03-20', '05-01', '06-19', '07-31', '09-18', '10-30', '12-11'],
  2020: ['01-29', '04-29', '06-10', '07-29', '09-16', '11-05', '12-16'],
  2021: ['01-27', '03-17', '04-28', '06-16', '07-28', '09-22', '11-03', '12-15'],
};
const PRESS_1230 = new Set(['2011-04-27', '2011-06-22', '2011-11-02', '2012-01-25', '2012-04-25', '2012-06-20', '2012-09-13', '2012-12-12']);
const fomcRaw = [];
for (const [y, ds] of Object.entries(FOMC_OLD)) for (const md of ds) { const d = `${y}-${md}`; fomcRaw.push({ d, at: +y >= 2013 ? '14:00' : PRESS_1230.has(d) ? '12:30' : '14:15', src: 'hard-coded' }); }
for (const e of [...HISTORY, ...EVENTS]) if (e.type === 'FOMC') { const p = parts(e.t, NY); if (p.d < '2026-11-07' && !fomcRaw.some((x) => x.d === p.d)) fomcRaw.push({ d: p.d, at: `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`, src: 'events.mjs' }); }
fomcRaw.sort((a, b) => a.d.localeCompare(b.d));
const median = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
function spike(m, d, at) {
  const T = zoned(d, at, NY), i = barAt(m, T); if (i < 0) return null;
  const r = m.h[i] - m.l[i], base = [];
  for (let k = -25; k <= 25; k++) { if (!k) continue; const dd = addDays(d, k), w = dow(dd); if (w === 0 || w === 6) continue; const j = barAt(m, zoned(dd, at, NY)); if (j >= 0) base.push(m.h[j] - m.l[j]); }
  const med = median(base); return base.length >= 10 && med > 0 ? r / med : null;
}
const fomcCheck = fomcRaw.map((e) => { const g = spike(M.xau, e.d, e.at), s = spike(M.es, e.d, e.at); return { ...e, xau: g && +g.toFixed(2), es: s && +s.toFixed(2), ok: (g ?? 0) >= 2 || (s ?? 0) >= 2 }; });
const oldFail = fomcCheck.filter((e) => e.src === 'hard-coded' && !e.ok);
const oldN = fomcCheck.filter((e) => e.src === 'hard-coded').length;
const FOMC_RESTRICTED = oldFail.length > 0.1 * oldN;
const FOMC = fomcCheck.filter((e) => e.ok && (!FOMC_RESTRICTED || e.src === 'events.mjs'));

// ---------- statistics ----------
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; }
  return h; }
function lgamma(x) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
function pUpper(t, df) { if (!isFinite(t)) return t > 0 ? 0 : 1; const x = df / (df + t * t), tail = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? tail : 1 - tail; }
function st(v) {
  const n = v.length; if (!n) return { n: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : NaN;
  const t = mean / (sd / Math.sqrt(n));
  return { n, mean, sd, t, p: pUpper(t, n - 1), win: v.filter((x) => x > 0).length / n, sum: v.reduce((a, b) => a + b, 0) };
}
function welch(a, b) { const A = st(a), B = st(b); if (!A.n || !B.n) return null; const se = Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n); return { diff: A.mean - B.mean, t: (A.mean - B.mean) / se, nEvent: A.n, nCtrl: B.n, ctrlMean: B.mean }; }

// ---------- trade builders ----------
const COST = { nq: (p) => 0.0002 * p + 0.25, es: (p) => 0.0002 * p + 0.25, xau: () => 0.30 };
function nightsHeld(t0, t1) { const a = parts(t0 - 17 * 3600, NY).d, b = parts(t1 - 17 * 3600, NY).d; return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }
function trade(mk, side, t0, t1, meta) {
  const m = M[mk], e = priceAt(m, t0), x = priceAt(m, t1); if (e == null || x == null || !(e > 0)) return { missing: true, t0, ...meta };
  const gross = side * (x - e) / e * 100, c = COST[mk](e) / e * 100;
  return { t0, t1, entry: e, exit: x, gross, net1: gross - c, net2: gross - 2 * c, nights: nightsHeld(t0, t1), ...meta };
}
const inWin = (t) => t >= zoned('2006-01-01', '00:00', 'UTC') && t < END;

function H1(mk) { const out = [], ctrl = [];
  for (let i = 1; i < TDAYS.length; i++) { const p = TDAYS[i - 1], d = TDAYS[i];
    out.push(trade(mk, 1, zoned(p, '16:00', NY), zoned(d, '09:30', NY), { d }));
    ctrl.push(trade(mk, 1, zoned(d, '09:30', NY), zoned(d, '16:00', NY), { d })); }
  return { trades: out, ctrl }; }
function H2(mk) { const out = [], ctrl = [], ev = new Set(FOMC.map((e) => e.d));
  for (const e of FOMC) { const i = TIDX.get(e.d); if (i == null || i < 1) continue; const [hh, mm] = e.at.split(':').map(Number); const mins = hh * 60 + mm - 15;
    const at = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    out.push(trade(mk, 1, zoned(TDAYS[i - 1], at, NY), zoned(e.d, at, NY), { d: e.d, at })); }
  for (let i = 1; i < TDAYS.length; i++) { const d = TDAYS[i]; if (ev.has(d)) continue; const at = d < '2013-01-01' ? '14:00' : '13:45';
    ctrl.push(trade(mk, 1, zoned(TDAYS[i - 1], at, NY), zoned(d, at, NY), { d })); }
  return { trades: out, ctrl }; }
function monthsOf() { const by = new Map(); for (const d of TDAYS) { const k = d.slice(0, 7); if (!by.has(k)) by.set(k, []); by.get(k).push(d); } return [...by.values()]; }
function H3(mk) { const ms = monthsOf(), out = [], spans = [];
  for (let k = 0; k + 1 < ms.length; k++) { const a = ms[k].at(-2), b = ms[k + 1][2]; if (!a || !b) continue; spans.push([TIDX.get(a), TIDX.get(b)]);
    out.push(trade(mk, 1, zoned(a, '16:00', NY), zoned(b, '16:00', NY), { d: a })); }
  const ctrlOf = (len) => { const c = []; let i = 0; while (i + len < TDAYS.length) { const j = i + len; if (spans.some(([s, e]) => !(j <= s || i >= e))) { i++; continue; } c.push(trade(mk, 1, zoned(TDAYS[i], '16:00', NY), zoned(TDAYS[j], '16:00', NY), { d: TDAYS[i] })); i = j; } return c; };
  return { trades: out, ctrl: ctrlOf(5), ctrl4: ctrlOf(4) }; }
function H4() { const out = [];
  for (let s = '2006-01-02'; s < '2026-11-07'; s = addDays(s, 1)) { const w = dow(s); if (w === 0 || w === 6 || UK.has(s)) continue;
    out.push(trade('xau', -1, zoned(s, '15:00', LDN), zoned(s, '15:30', LDN), { d: s })); }
  return { trades: out }; }
function H5() { const out = [], ctrl = [];
  for (let s = '2006-01-01'; s < '2026-11-07'; s = addDays(s, 1)) { const w = dow(s); if (w === 5 || w === 6) continue; const n = addDays(s, 1);
    out.push(trade('xau', 1, zoned(s, '18:00', NY), zoned(n, '08:00', LDN), { d: s }));
    ctrl.push(trade('xau', 1, zoned(n, '08:00', LDN), zoned(n, '17:00', NY), { d: s })); }
  return { trades: out, ctrl }; }
function H6(mk) { const out = [];
  for (const f of TDAYS) { if (dow(f) !== 5) continue; const mo = addDays(f, 3); if (!TIDX.has(mo)) continue;
    out.push(trade(mk, -1, zoned(f, '16:00', NY), zoned(mo, '16:00', NY), { d: f })); }
  return { trades: out }; }

const TESTS = [
  ['H1', 'nq', 'Overnight drift, long 16:00→09:30 ET', () => H1('nq')], ['H1', 'es', 'Overnight drift, long 16:00→09:30 ET', () => H1('es')],
  ['H2', 'nq', 'Pre-FOMC drift, long 24h to 15 min before statement', () => H2('nq')], ['H2', 'es', 'Pre-FOMC drift, long 24h to 15 min before statement', () => H2('es')],
  ['H3', 'nq', 'Turn of month, long day −2 close → day +3 close', () => H3('nq')], ['H3', 'es', 'Turn of month, long day −2 close → day +3 close', () => H3('es')],
  ['H4', 'xau', 'Gold PM fix, short 15:00→15:30 London', () => H4()], ['H5', 'xau', 'Gold Asia session, long 18:00 ET → 08:00 London', () => H5()],
  ['H6', 'nq', 'Weekend effect, short Fri 16:00 → Mon 16:00 ET', () => H6('nq')], ['H6', 'es', 'Weekend effect, short Fri 16:00 → Mon 16:00 ET', () => H6('es')],
];
const half = (x) => (x.t0 < SPLIT ? 'A' : 'B');
const r4 = (x) => (x == null || !isFinite(x) ? x : +x.toFixed(4));
function summ(v) { const s = st(v); return s.n ? { n: s.n, mean: r4(s.mean), sd: r4(s.sd), t: +s.t.toFixed(2), p: +s.p.toPrecision(3), win: +(100 * s.win).toFixed(1), sum: +s.sum.toFixed(2) } : { n: 0 }; }

const results = [];
for (const [h, mk, label, fn] of TESTS) {
  const R = fn(); const all = R.trades.filter((x) => inWin(x.t0)), ok = all.filter((x) => !x.missing);
  const by = { A: ok.filter((x) => half(x) === 'A'), B: ok.filter((x) => half(x) === 'B') };
  const res = { h, mk, label, missing: { A: all.filter((x) => x.missing && half(x) === 'A').length, B: all.filter((x) => x.missing && half(x) === 'B').length } };
  for (const k of ['A', 'B']) {
    const yrs = (new Set(by[k].map((x) => parts(x.t0, NY).d.slice(0, 4)))).size;
    res[k] = { gross: summ(by[k].map((x) => x.gross)), net1: summ(by[k].map((x) => x.net1)), net2: summ(by[k].map((x) => x.net2)), years: yrs,
      perYearNet1: +(by[k].reduce((a, x) => a + x.net1, 0) / Math.max(1, yrs)).toFixed(2), nights: +(by[k].reduce((a, x) => a + x.nights, 0) / Math.max(1, by[k].length)).toFixed(2),
      costPct: r4(by[k].reduce((a, x) => a + (x.gross - x.net1), 0) / Math.max(1, by[k].length)) };
  }
  res.full = { net1: summ(ok.map((x) => x.net1)) };
  const yr = {}; for (const x of ok) { const y = parts(x.t0, NY).d.slice(0, 4); (yr[y] ||= []).push(x.net1); }
  res.byYear = Object.fromEntries(Object.entries(yr).map(([y, v]) => [y, { n: v.length, sum: +v.reduce((a, b) => a + b, 0).toFixed(2), mean: r4(v.reduce((a, b) => a + b, 0) / v.length) }]));
  const bnights = res.B.nights; res.breakEvenFinancingPctYr = bnights > 0 && res.B.net1.n ? +(res.B.net1.mean / (bnights / 365)).toFixed(2) : null;
  if (R.ctrl) { res.control = {}; for (const k of ['A', 'B']) { const c = R.ctrl.filter((x) => !x.missing && inWin(x.t0) && half(x) === k);
    const w = welch(by[k].map((x) => x.gross), c.map((x) => x.gross)); res.control[k] = w && { diff: r4(w.diff), t: +w.t.toFixed(2), ctrlMean: r4(w.ctrlMean), nCtrl: w.nCtrl }; } }
  if (R.ctrl4) { res.control4 = {}; for (const k of ['A', 'B']) { const c = R.ctrl4.filter((x) => !x.missing && inWin(x.t0) && half(x) === k);
    const w = welch(by[k].map((x) => x.gross), c.map((x) => x.gross)); res.control4[k] = w && { diff: r4(w.diff), t: +w.t.toFixed(2), ctrlMean: r4(w.ctrlMean), nCtrl: w.nCtrl }; } }
  // Post-hoc diagnostics (labelled in RESULT.md; they cannot change a verdict): medians, and the pre-FOMC drift without the
  // 2008-09 crisis years (half A) and without its three best events (half B).
  const med = (v) => r4(median(v));
  res.posthoc = { medianNet1: { A: med(by.A.map((x) => x.net1)), B: med(by.B.map((x) => x.net1)) } };
  if (h === 'H2') {
    res.posthoc.A_ex2008_09 = summ(by.A.filter((x) => !/^200[89]/.test(x.d)).map((x) => x.net1));
    res.posthoc.B_exTop3 = summ(by.B.map((x) => x.net1).sort((a, b) => b - a).slice(3));
    res.posthoc.full = summ(ok.map((x) => x.net1));
  }
  results.push(res);
}
// ---------- verdicts ----------
for (const r of results) r.stage1 = r.A.net1.n > 1 && r.A.net1.mean > 0 && r.A.net1.p < ALPHA / K && !(r.h === 'H2' && FOMC_RESTRICTED);
const m = results.filter((r) => r.stage1).length;
for (const r of results) {
  r.stage2 = r.stage1 && r.B.net1.mean > 0 && r.B.net1.p < ALPHA / Math.max(1, m);
  r.x2both = r.A.net2.mean > 0 && r.B.net2.mean > 0;
  const bothPos = r.A.net1.mean > 0 && r.B.net1.mean > 0;
  r.verdict = r.stage1 && r.stage2 && r.x2both ? 'PASS' : bothPos ? 'CONSISTENT, NOT SIGNIFICANT' : 'FAIL';
  if (r.verdict === 'PASS' && r.control && !(r.control.A?.diff > 0 && r.control.B?.diff > 0)) r.verdict = 'PASS (mostly market drift)';
}
const coverage = Object.fromEntries(Object.entries(M).map(([k, m]) => [k, { candles: m.n, from: new Date(m.t[0] * 1000).toISOString().slice(0, 10), to: new Date(m.t[m.n - 1] * 1000).toISOString().slice(0, 10) }]));
const out = { generated: new Date().toISOString(), preregistration: 'research/edge/seasonality/preregistration.md', K, alphaA: ALPHA / K, survivorsA: m, alphaB: ALPHA / Math.max(1, m),
  halves: { A: '2006-01-01..2015-12-31', B: '2016-01-01..2026-11-06' }, units: 'percent of entry price per trade', coverage,
  fomc: { total: fomcCheck.length, hardCoded: oldN, hardCodedFailed: oldFail.map((e) => ({ d: e.d, at: e.at, xau: e.xau, es: e.es })), restricted: FOMC_RESTRICTED, used: FOMC.length,
    checks: fomcCheck.map((e) => [e.d, e.at, e.src === 'events.mjs' ? 'E' : 'H', e.xau, e.es, e.ok ? 1 : 0]) },
  tests: results };
fs.writeFileSync(OUTJ, JSON.stringify(out, null, 1));

// ---------- print ----------
const f = (x, d = 3) => (x == null || !isFinite(x) ? '–' : (x > 0 ? '+' : '') + x.toFixed(d));
console.log(`FOMC: ${fomcCheck.length} dates, hard-coded ${oldN}, failed check ${oldFail.length}: ${oldFail.map((e) => `${e.d} ${e.at} (xau ${e.xau}, es ${e.es})`).join('; ') || 'none'}; restricted=${FOMC_RESTRICTED}; used ${FOMC.length}`);
console.log(`Stage-1 bar p < ${(ALPHA / K).toFixed(4)}; survivors ${m}; stage-2 bar p < ${(ALPHA / Math.max(1, m)).toFixed(4)}`);
for (const r of results) {
  console.log(`\n${r.h} ${r.mk.toUpperCase()} — ${r.label}  →  ${r.verdict}`);
  for (const k of ['A', 'B']) { const x = r[k];
    console.log(`  ${k}: n ${x.net1.n} (miss ${r.missing[k]})  gross ${f(x.gross.mean, 4)}  net1 ${f(x.net1.mean, 4)} t ${f(x.net1.t, 2)} p ${x.net1.p}  net2 ${f(x.net2.mean, 4)}  win ${x.net1.win}%  cost ${x.costPct}  net1/yr ${f(x.perYearNet1, 1)}%  nights ${x.nights}`
      + (r.control?.[k] ? `  ctrl Δ ${f(r.control[k].diff, 4)} (t ${r.control[k].t}, ctrl ${f(r.control[k].ctrlMean, 4)})` : '') + (r.control4?.[k] ? `  ctrl4 Δ ${f(r.control4[k].diff, 4)} (t ${r.control4[k].t})` : '')); }
  if (r.posthoc) console.log('  post-hoc: ' + JSON.stringify(r.posthoc));
  console.log('  years net1 sum%: ' + Object.entries(r.byYear).map(([y, v]) => `${y.slice(2)} ${f(v.sum, 1)}`).join(' ') + `  | break-even financing B ${r.breakEvenFinancingPctYr ?? '–'}%/yr`);
}
