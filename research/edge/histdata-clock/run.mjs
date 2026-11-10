// HistData M1 clock audit (PREREGISTRATION.md, written first). A data audit: it tests no trading rule.
//
//   node research/edge/histdata-clock/run.mjs <council-data research/candles dir> <OANDA cache dir (fetch.mjs)>
//
// Reads the raw HistData files (never changes them) and the cached OANDA H1 closes; writes result.json next to this file
// and prints the tables RESULT.md quotes. The four candidate rules live in rules.mjs, on label fields only; this audit
// does not import the shared converter (council/histdata.mjs): a test compares the converter with the rule certified here.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { HISTORY, EVENTS, zonedToUtc } from '../../../council/events.mjs';
import { RULES, yearOf, mismatch, changeSundays } from './rules.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [HIST, CACHE] = process.argv.slice(2);
if (!HIST || !CACHE) { console.error('usage: node research/edge/histdata-clock/run.mjs <candles dir> <oanda cache dir>'); process.exit(1); }

const SYMBOLS = [
  { sym: 'XAUUSD', dir: 'xau-histdata', oanda: 'xau' }, { sym: 'XAGUSD', dir: 'XAGUSD', oanda: 'xag' },
  { sym: 'NSXUSD', dir: 'nsxusd-histdata', oanda: 'nas100', index: true }, { sym: 'SPXUSD', dir: 'spxusd-histdata', oanda: 'spx500', index: true },
  { sym: 'UDXUSD', dir: 'udx-histdata', oanda: 'eurusd', flip: true, proxy: 'OANDA EUR/USD, sign flipped' },
  { sym: 'EURUSD', dir: 'EURUSD', oanda: 'eurusd' }, { sym: 'GBPUSD', dir: 'GBPUSD', oanda: 'gbpusd' }, { sym: 'USDJPY', dir: 'USDJPY', oanda: 'usdjpy' },
  { sym: 'AUDUSD', dir: 'AUDUSD', oanda: 'audusd' }, { sym: 'USDCAD', dir: 'USDCAD', oanda: 'usdcad' }, { sym: 'USDCHF', dir: 'USDCHF', oanda: 'usdchf' },
];
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const H = 3600, DAY = 86400;

const RK = Object.keys(RULES);   // the candidate rules: rules.mjs

// New York wall clock of a UTC second
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
const nyMin = (t) => { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return +o.hour * 60 + +o.minute; };
const nyOffH = (t) => { const m = nyMin(t), u = Math.floor((t % DAY) / 60); return (((u - m) % 1440) + 1440) % 1440 / 60; };   // hours New York is behind UTC

// ── releases (official local times; a date without a clear spike supports nothing) ──
const CPI_EARLY = ['2018-01-12', '2018-02-14', '2018-03-13', '2018-04-11', '2018-05-10', '2018-06-12', '2018-07-12', '2018-08-10', '2018-09-13', '2018-10-11', '2018-11-14', '2018-12-12',
  '2019-01-11', '2019-02-13', '2019-03-12', '2019-04-10', '2019-05-10', '2019-06-12', '2019-07-11', '2019-08-13', '2019-09-12', '2019-10-10', '2019-11-13', '2019-12-11',
  '2020-01-14', '2020-02-13', '2020-03-11', '2020-04-10', '2020-05-12', '2020-06-10', '2020-07-14', '2020-08-12', '2020-09-11', '2020-10-13', '2020-11-12', '2020-12-10',
  '2021-01-13', '2021-02-10', '2021-03-10', '2021-04-13', '2021-05-12', '2021-06-10', '2021-07-13', '2021-08-11', '2021-09-14', '2021-10-13', '2021-11-10', '2021-12-10'];   // research/edge/event-reaction/build.mjs
const FOMC_EARLY = ['2018-01-31', '2018-03-21', '2018-05-02', '2018-06-13', '2018-08-01', '2018-09-26', '2018-11-08', '2018-12-19',
  '2019-01-30', '2019-03-20', '2019-05-01', '2019-06-19', '2019-07-31', '2019-09-18', '2019-10-30', '2019-12-11',
  '2020-01-29', '2020-04-29', '2020-06-10', '2020-07-29', '2020-09-16', '2020-11-05', '2020-12-16',
  '2021-01-27', '2021-03-17', '2021-04-28', '2021-06-16', '2021-07-28', '2021-09-22', '2021-11-03', '2021-12-15'];   // Federal Reserve meeting calendars, scheduled meetings
const DATA_END = Date.UTC(2026, 10, 1) / 1000;
function releases() {
  const out = [], NY = 'America/New_York', iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  for (const d of CPI_EARLY) out.push({ type: 'CPI', date: d, hhmm: '08:30', t: zonedToUtc(d, '08:30', NY) });
  for (const d of FOMC_EARLY) out.push({ type: 'FOMC', date: d, hhmm: '14:00', t: zonedToUtc(d, '14:00', NY) });
  for (let y = 2018; y <= 2021; y++) for (let m = 0; m < 12; m++) {                    // Amendment 1: first and second Friday
    const first = 1 + ((5 - new Date(Date.UTC(y, m, 1)).getUTCDay() + 7) % 7);
    for (const dd of [first, first + 7]) { const d = iso(Date.UTC(y, m, dd)); out.push({ type: 'US0830', date: d, hhmm: '08:30', t: zonedToUtc(d, '08:30', NY) }); }
  }
  out.push({ type: 'US0830', date: '2020-07-02', hhmm: '08:30', t: zonedToUtc('2020-07-02', '08:30', NY) });
  for (const e of [...HISTORY, ...EVENTS]) if (['CPI', 'NFP', 'FOMC'].includes(e.type) && e.t < DATA_END && !e.scheduled) out.push({ type: e.type, date: e.at.slice(0, 10), hhmm: e.type === 'FOMC' ? '14:00' : '08:30', t: e.t });
  return out.sort((a, b) => a.t - b.t);
}
const REL = releases();

// ── raw files: minute-indexed on LABEL time ──
const L0 = Date.UTC(2017, 11, 31) / 1000, NMIN = Math.ceil((Date.UTC(2026, 10, 3) / 1000 - L0) / 60), NHR = Math.ceil(NMIN / 60);
function load(s) {
  const dir = path.join(HIST, s.dir), files = fs.readdirSync(dir).filter((f) => f.startsWith(s.sym + '_M1_') && f.endsWith('.csv.gz')).sort();
  const R = new Float32Array(NMIN).fill(NaN), HC = new Float64Array(NHR).fill(NaN), labels = [];
  let rows = 0, dup = 0, prev = -1, unordered = 0; const dupByYear = {};
  for (const f of files) for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString().split('\n')) {
    if (ln.length < 20) continue; rows++;
    const p = ln.split(';'), L = Date.UTC(+ln.slice(0, 4), +ln.slice(4, 6) - 1, +ln.slice(6, 8), +ln.slice(9, 11), +ln.slice(11, 13)) / 1000, i = (L - L0) / 60;
    if (i < 0 || i >= NMIN) continue;
    if (!Number.isNaN(R[i])) { dup++; const y = yearOf(L); dupByYear[y] = (dupByYear[y] || 0) + 1; continue; }
    if (L < prev) unordered++; prev = Math.max(prev, L);
    R[i] = +p[2] - +p[3]; HC[Math.floor(i / 60)] = +p[4]; labels.push(L);          // file order is time order, so the last write of an hour is its close
  }
  labels.sort((a, b) => a - b);
  return { R, HC, labels, rows, dup, dupByYear, unordered, files: files.length };
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };

// ── A. release minutes ──
function ratioAt(D, L) {
  const m = (L - L0) / 60; if (m < 40 || m + 1 >= NMIN) return null;
  const base = []; for (let i = m - 35; i < m - 5; i++) if (!Number.isNaN(D.R[i])) base.push(D.R[i]);
  const a = D.R[m], b = D.R[m + 1], top = Math.max(Number.isNaN(a) ? -1 : a, Number.isNaN(b) ? -1 : b), md = median(base);
  if (base.length < 20 || top < 0 || !(md > 0)) return null;
  return top / md;
}
function checkA(D, s) {
  const rows = [];
  for (const e of REL) {
    const r5 = ratioAt(D, e.t - 5 * H), r4 = ratioAt(D, e.t - 4 * H); if (r5 == null || r4 == null) continue;
    let shows = null, confounded = false;
    if (s.index && e.hhmm === '08:30') { if (r5 >= 4) shows = 5; else if (r5 < 2 && r4 >= 4) { shows = 4; confounded = true; } }
    else if (r5 >= 4 && r4 < 2) shows = 5; else if (r4 >= 4 && r5 < 2) shows = 4;
    if (shows == null) continue;
    const L = e.t - shows * H;                                                       // the label the spike sits at
    rows.push({ type: e.type, date: e.date, year: yearOf(L), shows, confounded, mismatch: mismatch(L), r5: +r5.toFixed(1), r4: +r4.toFixed(1), rules: Object.fromEntries(RK.map((k) => [k, RULES[k].off(L) === shows])) });
  }
  return rows;
}

// ── B. hourly returns against OANDA ──
function loadOanda(sym) {
  const m = new Map();
  for (const y of YEARS) for (const h of [1, 2]) { const f = path.join(CACHE, `${sym}-1h-${y}-${h}.json`); if (fs.existsSync(f)) for (const [t, c] of JSON.parse(fs.readFileSync(f, 'utf8'))) m.set(t, c); }
  return m;
}
function corr(x, y) { const n = x.length; let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i]; sxy += x[i] * y[i]; } const v = (sxx - sx * sx / n) * (syy - sy * sy / n); return v > 0 ? (sxy - sx * sy / n) / Math.sqrt(v) : 0; }
function checkB(D, s, O) {
  const rows = [], first = Date.UTC(2018, 0, 1) / 1000;                              // 1 Jan 2018 is a Monday
  for (let wk = first; wk + 5 * DAY <= DATA_END; wk += 7 * DAY) {
    const cs = {};
    for (const k of [3, 4, 5, 6]) {
      const x = [], y = [];
      for (let t = wk + H; t < wk + 5 * DAY; t += H) {
        const o1 = O.get(t), o0 = O.get(t - H), i = (t - k * H - L0) / H, h1 = D.HC[i], h0 = D.HC[i - 1];
        if (o1 == null || o0 == null || Number.isNaN(h1) || Number.isNaN(h0)) continue;
        x.push(Math.log(h1 / h0) * (s.flip ? -1 : 1)); y.push(Math.log(o1 / o0));
      }
      cs[k] = x.length >= 60 ? corr(x, y) : null;
    }
    const ks = [3, 4, 5, 6].filter((k) => cs[k] != null).sort((a, b) => cs[b] - cs[a]); if (ks.length < 2) continue;
    const best = ks[0], decisive = cs[best] >= 0.8 && cs[best] - cs[ks[1]] >= 0.25, Lw = wk + 2 * DAY + 12 * H;   // Wednesday 12:00 as a label
    rows.push({ week: new Date(wk * 1000).toISOString().slice(0, 10), year: yearOf(Lw), decisive, shows: decisive ? best : null, best, corr: +cs[best].toFixed(3), next: +cs[ks[1]].toFixed(3), mismatch: mismatch(Lw),
      rules: decisive ? Object.fromEntries(RK.map((k) => [k, RULES[k].off(Lw) === best])) : null });
  }
  return rows;
}

// ── C and D1. the weekly close and reopen, the label gap across the weekend ──
function weekends(D) {
  const out = []; const A = D.labels;
  for (let i = 1; i < A.length; i++) if (A[i] - A[i - 1] >= 40 * H) out.push({ last: A[i - 1], first: A[i] });
  return out;
}
const circ = (a, b) => { const d = Math.abs(a - b) % 1440; return Math.min(d, 1440 - d); };
function checkCD(D) {
  const W = weekends(D), res = { weekends: W.length, C: {}, D1: {}, close: {} };
  // D1: usual label gap per year, the four change weekends
  const byYear = {}; for (const w of W) (byYear[yearOf(w.first)] ||= []).push(w.first - w.last);
  const usual = Object.fromEntries(Object.entries(byYear).map(([y, g]) => [y, median(g)]));
  const change = changeSundays;
  for (const k of RK) {
    const rule = RULES[k];
    // C: the reopen (and the close) as New York wall-clock minutes under this rule
    const re = W.map((w) => nyMin(w.first + rule.off(w.first) * H)), cl = W.map((w) => nyMin(w.last + rule.off(w.last) * H));
    const mode = (a) => { const c = new Map(); for (const m of a) { const b = Math.floor(m / 5) * 5; c.set(b, (c.get(b) || 0) + 1); } return [...c].sort((p, q) => q[1] - p[1])[0][0]; };
    const refOpen = mode(re), refClose = mode(cl);
    res.C[k] = { refOpenNy: refOpen, rows: W.map((w, i) => ({ year: yearOf(w.first), sunday: new Date(w.first * 1000).toISOString().slice(0, 10), ny: re[i], agree: circ(re[i], refOpen) <= 10, mismatch: mismatch(w.first) })) };
    res.close[k] = { refCloseNy: refClose, byYear: Object.fromEntries(YEARS.map((y) => { const idx = W.map((w, i) => i).filter((i) => yearOf(W[i].first) === y); return [y, { n: idx.length, agree: idx.filter((i) => circ(cl[i], refClose) <= 10).length }]; })) };
    // D1: the label gap's deviation on the change weekends against this rule's prediction
    res.D1[k] = [];
    for (const y of YEARS) for (const [name, sun] of change(y)) {
      const w = W.find((q) => q.last < sun + 12 * H && q.first > sun); if (!w || w.first - w.last > 80 * H) continue;
      const dev = (w.first - w.last - usual[y]) / 60;                               // minutes
      const tA = w.last + rule.off(w.last) * H, tB = w.first + rule.off(w.first) * H, ny = nyOffH(tB) - nyOffH(tA);   // New York's shift over the weekend (h): spring −1, autumn +1
      const predicted = (ny - (rule.off(w.first) - rule.off(w.last))) * 60;
      res.D1[k].push({ year: y, weekend: name, devMin: Math.round(dev), predictedMin: predicted, agree: Math.abs(dev - predicted) <= 10 });
    }
  }
  // other weekends with a one-hour deviation that no clock change explains
  const changeSet = new Set(YEARS.flatMap((y) => change(y).map(([, sun]) => sun)));
  res.oddWeekends = W.filter((w) => { const dev = Math.abs((w.first - w.last - usual[yearOf(w.first)]) / 60); if (dev < 50 || dev > 70) return false; for (const sun of changeSet) if (w.last < sun + 12 * H && w.first > sun) return false; return true; })
    .map((w) => ({ sunday: new Date(w.first * 1000).toISOString().slice(0, 10), devMin: Math.round((w.first - w.last - usual[yearOf(w.first)]) / 60) }));
  return res;
}

// ── D2. repeated labels, missing label hours on the weekdays next to a change date ──
function checkD2(D) {
  const holes = []; const A = D.labels;
  const near = new Set(); for (const y of YEARS) for (const [, sun] of changeSundays(y)) for (const d of [-3, -2, 1, 2]) near.add(sun + d * DAY);
  for (let i = 1; i < A.length; i++) { const g = A[i] - A[i - 1]; if (g < 55 * 60 || g >= 40 * H) continue; const day = Math.floor(A[i - 1] / DAY) * DAY; if (near.has(day)) holes.push({ from: A[i - 1], min: g / 60 }); }
  const byStart = {}; for (const h of holes) { const k = new Date(h.from * 1000).toISOString().slice(11, 16) + ' +' + Math.round(h.min / 15) * 15 + 'm'; byStart[k] = (byStart[k] || 0) + 1; }
  return { repeatedLabels: D.dup, repeatedByYear: D.dupByYear, outOfOrder: D.unordered, holesNearChanges: holes.length, holesByLabelStart: byStart };
}

// ── verdicts (the pre-registered criteria) ──
function verdict(k, y, A, B, CD) {
  const a = A.filter((r) => r.year === y && !r.confounded), aAgree = a.filter((r) => r.rules[k]).length, aMisBad = a.filter((r) => r.mismatch && !r.rules[k]).length, aMis = a.filter((r) => r.mismatch).length;
  const b = B.filter((r) => r.year === y && r.decisive), bAgree = b.filter((r) => r.rules[k]).length, bMis = b.filter((r) => r.mismatch), bMisAgree = bMis.filter((r) => r.rules[k]).length;
  const c = CD.C[k].rows.filter((r) => r.year === y), cAgree = c.filter((r) => r.agree).length, cMis = c.filter((r) => r.mismatch), cMisAgree = cMis.filter((r) => r.agree).length;
  const d = CD.D1[k].filter((r) => r.year === y), dAgree = d.filter((r) => r.agree).length;
  const passA = a.length >= 8 && aAgree / a.length >= 0.95 && aMisBad === 0;
  const passB = b.length >= 30 && bAgree / b.length >= 0.98 && bMis.length >= 3 && bMisAgree === bMis.length;
  const passS = c.length > 0 && cAgree / c.length >= 0.85 && cMisAgree === cMis.length && dAgree >= 3;
  const thinOnly = !(passA && passB && passS) && aAgree === a.length && bAgree === b.length && cMisAgree === cMis.length && dAgree === d.length
    && (a.length < 8 || b.length < 30 || bMis.length < 3 || d.length < 3) && (c.length === 0 || cAgree / c.length >= 0.85);
  return { A: { clear: a.length, agree: aAgree, mismatch: aMis, mismatchAgree: aMis - aMisBad, pass: passA }, B: { decisive: b.length, agree: bAgree, mismatch: bMis.length, mismatchAgree: bMisAgree, pass: passB },
    C: { weekends: c.length, agree: cAgree, mismatch: cMis.length, mismatchAgree: cMisAgree }, D1: { read: d.length, agree: dAgree }, session: passS, pass: passA && passB && passS, thinOnly };
}

const out = { built: '2026-11-10', prereg: 'research/edge/histdata-clock/PREREGISTRATION.md', rules: Object.fromEntries(RK.map((k) => [k, RULES[k].name])), releases: REL.length, symbols: {} };
for (const s of SYMBOLS) {
  const D = load(s), O = loadOanda(s.oanda), A = checkA(D, s), B = checkB(D, s, O), CD = checkCD(D), D2 = checkD2(D);
  const years = {};
  for (const y of YEARS) {
    const v = Object.fromEntries(RK.map((k) => [k, verdict(k, y, A, B, CD)]));
    // rules that give the same offsets all through this symbol-year are one rule here
    const sig = (k) => { let x = ''; for (let L = Date.UTC(y, 0, 3, 12) / 1000; L < Date.UTC(y + 1, 0, 1) / 1000; L += 7 * DAY) x += RULES[k].off(L); return x; };
    const passing = RK.filter((k) => v[k].pass), distinct = new Set(passing.map(sig));
    const certified = distinct.size === 1 ? passing : [];
    const score = (k) => v[k].A.agree + v[k].B.agree + v[k].C.agree + v[k].D1.agree, best = RK.slice().reverse().reduce((p, q) => (score(q) > score(p) ? q : p));
    years[y] = { certified, status: certified.length ? 'CERTIFIED' : RK.some((k) => v[k].thinOnly) ? 'UNCERTIFIED (thin)' : 'UNCERTIFIED', bestSupported: best, rules: v };
  }
  // B, one character per Monday-to-Friday week from 2018-01-01: the offset the week shows, '?' read but not decisive, '-' not readable
  const byWeek = new Map(B.map((r) => [r.week, r])); let read = '';
  for (let wk = Date.UTC(2018, 0, 1) / 1000; wk + 5 * DAY <= DATA_END; wk += 7 * DAY) { const r = byWeek.get(new Date(wk * 1000).toISOString().slice(0, 10)); read += !r ? '-' : r.decisive ? r.shows : '?'; }
  const bad = (k) => A.filter((r) => !r.confounded && !r.rules[k]).map((r) => ({ type: r.type, date: r.date, shows: r.shows, r5: r.r5, r4: r.r4 }));
  out.symbols[s.sym] = { proxy: s.proxy || null, files: D.files, rows: D.rows, oandaHours: O.size, years,
    A: { clear: A.filter((r) => !r.confounded).length, openConfounded: A.filter((r) => r.confounded).length, cols: ['type', 'date', 'shows', 'openConfounded', 'ratio5', 'ratio4'], rows: A.map((r) => [r.type, r.date, r.shows, r.confounded ? 1 : 0, r.r5, r.r4]), disagreeR4: bad('R4') },
    B: { firstWeek: '2018-01-01', weeks: read.length, readable: B.length, decisive: B.filter((r) => r.decisive).length, read, notDecisive: B.filter((r) => !r.decisive).map((r) => ({ week: r.week, best: r.best, corr: r.corr, next: r.next })) },
    C: Object.fromEntries(RK.map((k) => [k, { refOpenNy: CD.C[k].refOpenNy, refCloseNy: CD.close[k].refCloseNy, disagree: CD.C[k].rows.filter((r) => !r.agree).length, ...(k === 'R4' ? { disagreeList: CD.C[k].rows.filter((r) => !r.agree).map((r) => [r.sunday, r.ny]), closeByYear: CD.close[k].byYear } : {}) }])),
    D1: { cols: ['year', 'weekend', 'deviationMin', 'R1 predicted', 'R2 predicted', 'R3 predicted', 'R4 predicted'], rows: CD.D1.R4.map((r, i) => [r.year, r.weekend, r.devMin, ...RK.map((k) => CD.D1[k][i].predictedMin)]) }, oddWeekends: CD.oddWeekends, D2 };
  const line = YEARS.map((y) => `${y}:${years[y].certified.join('+') || (years[y].status === 'UNCERTIFIED' ? 'none' : 'thin')}`).join(' ');
  console.error(s.sym.padEnd(7), line);
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out) + '\n');

// ── tables for RESULT.md ──
const f = (x) => `${x.agree}/${x.clear ?? x.decisive ?? x.weekends ?? x.read}`;
console.log('| Symbol | Year | Status | Certified rule | A releases (agree / clear; mismatch) | B OANDA weeks (agree / decisive; mismatch) | C reopens (agree / weekends; mismatch) | D1 change weekends |');
console.log('|---|---|---|---|---|---|---|---|');
for (const s of SYMBOLS) for (const y of YEARS) {
  const Y = out.symbols[s.sym].years[y], k = Y.certified.includes('R4') ? 'R4' : Y.certified[0] || Y.bestSupported, v = Y.rules[k];
  console.log(`| ${s.sym} | ${y} | ${Y.status} | ${Y.certified.join(' = ') || `(best: ${Y.bestSupported})`} | ${f(v.A)}; ${v.A.mismatchAgree}/${v.A.mismatch} | ${f(v.B)}; ${v.B.mismatchAgree}/${v.B.mismatch} | ${f(v.C)}; ${v.C.mismatchAgree}/${v.C.mismatch} | ${f(v.D1)} |`);
}
console.log('\n| Rule | symbol-years certified (of ' + SYMBOLS.length * YEARS.length + ') | A agree / clear | B agree / decisive | B mismatch-window agree / decisive | C agree / weekends | D1 agree / read |');
console.log('|---|---|---|---|---|---|---|');
for (const k of RK) {
  const t = { cert: 0, a: 0, an: 0, b: 0, bn: 0, bm: 0, bmn: 0, c: 0, cn: 0, d: 0, dn: 0 };
  for (const s of SYMBOLS) for (const y of YEARS) { const Y = out.symbols[s.sym].years[y], v = Y.rules[k]; if (Y.certified.includes(k)) t.cert++; t.a += v.A.agree; t.an += v.A.clear; t.b += v.B.agree; t.bn += v.B.decisive; t.bm += v.B.mismatchAgree; t.bmn += v.B.mismatch; t.c += v.C.agree; t.cn += v.C.weekends; t.d += v.D1.agree; t.dn += v.D1.read; }
  console.log(`| ${k} ${RULES[k].name} | ${t.cert} | ${t.a}/${t.an} | ${t.b}/${t.bn} | ${t.bm}/${t.bmn} | ${t.c}/${t.cn} | ${t.d}/${t.dn} |`);
}
