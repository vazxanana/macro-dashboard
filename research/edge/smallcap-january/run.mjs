// Small caps at the turn of the year: research/edge/smallcap-january. Pre-registered in PREREGISTRATION.md (committed alone,
// before any price was read). Paper research only: nothing here is read by the council, the mirror or any page.
//   node run.mjs fetch <dir>   copies the three daily candle files and macro/cache.json out of the council-data branch
//                              (git show, no network)
//   node run.mjs full <dir>    runs the study and writes result.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';
import { usHolidays } from '../../../council/datacheck.mjs';

export const P = {
  ATR: 20, K: 3,
  SPREAD: 0.0004,           // CFD round trip a leg, fraction of the entry price (x1)
  FIN_ADD: 2.5,             // financing a year = DGS2 + 2.5 %, charged on both legs, per rollover night / 365 (x1)
  DGS2_BEFORE: 4,           // DGS2 taken as 4 % before the series starts (6 Jan 2006)
  PAIR_STOP: -1,            // pair R at a daily close at or under this closes every open leg
  MULTS: [0, 1, 2],
  DECISIVE: [2016, 2026], REPLICATION_TO: 2015,
  DRAWS: 200000, SEED: 20261114, PLACEBO_SEEDS: 40, ALPHA: 0.05,
};
export const TESTS = [
  { id: 'T1', long: 'us2000', short: 'spx500', win: 'T1', judged: true, name: 'US2000 vs SPX500, 5th-last December day to 10th January day' },
  { id: 'T2', long: 'us2000', short: 'spx500', win: 'T2', judged: true, name: 'US2000 vs SPX500, last December day to last January day' },
  { id: 'C', long: 'us2000', short: 'nas100', win: 'T1', judged: false, name: 'control: US2000 vs NAS100, the T1 window' },
];
const DAY = 86400;
const dayOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// ── the US trading-day calendar (usHolidays adjusted to the NYSE, as the pre-registration states) ──
export const SPECIAL_CLOSED = ['2004-06-11', '2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09'];
const CLOSED = new Map();
export function nyseClosed(y) {
  if (CLOSED.has(y)) return CLOSED.get(y);
  const s = new Set();
  const tg = [...usHolidays(y).keys()].filter((d) => d.slice(5, 7) === '11').sort();   // Thanksgiving, then the day after
  for (const [d, kind] of usHolidays(y)) {
    if (!d.startsWith(`${y}-`)) continue;                     // New Year on a Saturday: usHolidays moves it to 31 Dec, the NYSE stays open
    if (kind === 'closed') { s.add(d); continue; }
    if (d.endsWith('-12-24')) continue;                       // NYSE half day
    if (tg.length === 2 && d === tg[1]) continue;             // day after Thanksgiving: NYSE half day
    if (d.slice(5, 7) === '06' && y < 2022) continue;          // Juneteenth: NYSE closed from 2022
    s.add(d);                                                 // MLK, Presidents', Memorial, Juneteenth, 4 July, Labor, Thanksgiving
  }
  for (const d of SPECIAL_CLOSED) if (d.startsWith(`${y}-`)) s.add(d);
  CLOSED.set(y, s); return s;
}
export function isTradingDay(d) {
  const wd = new Date(d + 'T00:00:00Z').getUTCDay();
  return wd >= 1 && wd <= 5 && !nyseClosed(+d.slice(0, 4)).has(d);
}
export function tradingDays(from, to) {
  const out = [];
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += DAY * 1000) { const d = new Date(t).toISOString().slice(0, 10); if (isTradingDay(d)) out.push(d); }
  return out;
}
// the two windows of the turn whose January is in year Y: { entry, exit } as US trading days, or null
export function windowOf(days, Y, win) {
  const dec = days.filter((d) => d.startsWith(`${Y - 1}-12`)), jan = days.filter((d) => d.startsWith(`${Y}-01`));
  if (win === 'T1') { if (dec.length < 5 || jan.length < 10) return null; return { entry: dec[dec.length - 5], exit: jan[9] }; }
  if (win === 'T2') { if (!dec.length || !jan.length) return null; return { entry: dec[dec.length - 1], exit: jan[jan.length - 1] }; }
  return null;
}

// ── candles ──
export function prep(rows) {
  const B = foldWeekend(rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
  for (const b of B) b.day = dayOf(b.time);
  B.ix = Object.fromEntries(B.map((b, i) => [b.day, i]));
  return B;
}
// mean true range of the n candles up to and INCLUDING index i (all closed at a close-of-day entry); needs i >= n
export function atrAt(B, i, n = P.ATR) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(B[j].high - B[j].low, Math.abs(B[j].high - B[j - 1].close), Math.abs(B[j].low - B[j - 1].close));
  return s / n;
}

// DGS2 (percent) on a day: the last weekly value on or before it; DGS2_BEFORE before the series starts
export function dgs2On(series, d) {
  let v = null;
  for (const [day, x] of series || []) { if (day <= d) v = x; else break; }
  return v == null ? P.DGS2_BEFORE : v;
}

// One pair trade: long `L` and short `S` entered at the close of US trading day `entry`, out at the close of `exit`.
// Reads no candle after the exit day. Returns null when a needed candle or ATR is missing.
export function pairTrade(L, S, entry, exit, mult = 1, dgs2 = P.DGS2_BEFORE, legStops = true) {
  const iL = L.ix[entry], iS = S.ix[entry];
  if (iL == null || iS == null || L.ix[exit] == null || S.ix[exit] == null) return null;
  const aL = atrAt(L, iL), aS = atrAt(S, iS);
  if (!(aL > 0) || !(aS > 0)) return null;
  const legs = [
    { side: 1, B: L, i0: iL, entry: L[iL].close, dist: P.K * aL },
    { side: -1, B: S, i0: iS, entry: S[iS].close, dist: P.K * aS },
  ];
  for (const g of legs) { g.stop = g.entry - g.side * g.dist; g.open = true; g.R = 0; g.exitT = null; g.why = null; }
  const t0 = L[iL].time + DAY;
  const upTo = (B, i) => { const o = []; for (let j = i + 1; j < B.length && B[j].day <= exit; j++) o.push(B[j].day); return o; };
  const dates = [...new Set([...upTo(L, iL), ...upTo(S, iS)])].sort();
  let oneSided = 0, pairAt = null;
  for (const d of dates) {
    const bars = legs.map((g) => (g.B.ix[d] != null ? g.B[g.B.ix[d]] : null));
    if (!bars[0] || !bars[1]) oneSided++;
    legs.forEach((g, k) => {                                  // per-leg protective stops first, within the candle
      const b = bars[k]; if (!legStops || !g.open || !b) return;
      const gapPast = g.side > 0 ? b.open <= g.stop : b.open >= g.stop, touch = g.side > 0 ? b.low <= g.stop : b.high >= g.stop;
      if (gapPast) { g.exit = b.open; g.why = 'leg-gap'; g.exitT = b.time; }
      else if (touch) { g.exit = g.stop; g.why = 'leg'; g.exitT = b.time + DAY - 1; }
      else return;
      g.open = false; g.R = g.side * (g.exit - g.entry) / g.dist;
    });
    if (bars[0] && bars[1] && legs.some((g) => g.open)) {      // the pair stop at the close
      const mark = legs.reduce((s, g, k) => s + (g.open ? g.side * (bars[k].close - g.entry) / g.dist : g.R), 0);
      if (mark <= P.PAIR_STOP + 1e-12 && d !== exit) {
        legs.forEach((g, k) => { if (g.open) { g.exit = bars[k].close; g.why = 'pair'; g.exitT = bars[k].time + DAY; g.open = false; g.R = g.side * (g.exit - g.entry) / g.dist; } });
        pairAt = d; break;
      }
    }
    if (d === exit) break;
  }
  legs.forEach((g) => { if (g.open) { const b = g.B[g.B.ix[exit]]; g.exit = b.close; g.why = 'window'; g.exitT = b.time + DAY; g.open = false; g.R = g.side * (g.exit - g.entry) / g.dist; } });
  const rate = (dgs2 + P.FIN_ADD) / 100 / 365;
  for (const g of legs) {
    g.nights = nights(t0, g.exitT);
    g.cost = mult * P.SPREAD * g.entry / g.dist;
    g.fin = mult * g.nights * rate * g.entry / g.dist;
  }
  const gross = legs[0].R + legs[1].R, cost = legs[0].cost + legs[1].cost, fin = legs[0].fin + legs[1].fin;
  const why = pairAt ? 'pair' : legs.some((g) => g.why.startsWith('leg')) ? 'leg' : 'window';
  return { entry, exit, legs, gross, cost, fin, net: gross - cost - fin, why, pairAt, oneSided, dgs2 };
}

// ── statistics (copied from research/edge/grain-seasonality, not imported) ──
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
export function tStat(a) { if (a.length < 2) return null; const m = mean(a), v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); return v > 0 ? m / Math.sqrt(v / a.length) : null; }
export function permP(real, pools, draws = P.DRAWS, seed = P.SEED) {
  const r = rng(seed), n = pools.length; let ge = 0;
  for (let d = 0; d < draws; d++) {
    let s = 0;
    for (const p of pools) s += p[Math.floor(r() * p.length)];
    if (s / n >= real - 1e-12) ge++;
  }
  return (1 + ge) / (1 + draws);
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
const r3 = (x) => x == null ? null : +x.toFixed(3);
const r4 = (x) => x == null ? null : +x.toFixed(4);

// every turn of one sample: the real trade, and the null pool (every other start day of year Y-1, same length)
export function runTest(M, test, days, years, dgs) {
  const L = M[test.long], S = M[test.short], at = Object.fromEntries(days.map((d, i) => [d, i]));
  const rows = [], pools = { 0: [], 1: [], 2: [] }, byOffset = [], dropped = [];
  for (const Y of years) {
    const w = windowOf(days, Y, test.win);
    if (!w || at[w.exit] == null) { dropped.push({ year: Y, why: 'window not in the data' }); continue; }
    const hole = days.slice(at[w.entry], at[w.exit] + 1).filter((d) => L.ix[d] == null || S.ix[d] == null);
    if (hole.length) { dropped.push({ year: Y, why: 'data hole', days: hole }); continue; }
    const len = at[w.exit] - at[w.entry], rate = dgs2On(dgs, w.entry);
    const tr = {}; for (const m of P.MULTS) tr[m] = pairTrade(L, S, w.entry, w.exit, m, rate);
    if (!tr[1]) { dropped.push({ year: Y, why: 'no ATR at entry' }); continue; }
    const yearDays = days.filter((d) => d.startsWith(`${Y - 1}-`)), lastDec = at[yearDays[yearDays.length - 1]];
    const pool = { 0: [], 1: [], 2: [] }, offs = {};
    for (const s of yearDays) {
      const i = at[s], e = days[i + len];
      if (!e) continue;
      const k = lastDec - i + 1, r = dgs2On(dgs, s), x = {};
      for (const m of P.MULTS) x[m] = pairTrade(L, S, s, e, m, r);
      if (!x[1]) continue;
      offs[k] = x[1].net;
      if (s === w.entry) continue;
      for (const m of P.MULTS) pool[m].push(x[m].net);
    }
    for (const m of P.MULTS) pools[m].push(pool[m]);
    byOffset.push(offs);
    const t = tr[1];
    rows.push({ year: Y, entryDay: w.entry, exitDay: w.exit, usDays: len, dgs2: t.dgs2, why: t.why, pairAt: t.pairAt, oneSided: t.oneSided,
      long: { entry: r4(t.legs[0].entry), stop: r4(t.legs[0].stop), exit: r4(t.legs[0].exit), how: t.legs[0].why, R: r3(t.legs[0].R), nights: t.legs[0].nights },
      short: { entry: r4(t.legs[1].entry), stop: r4(t.legs[1].stop), exit: r4(t.legs[1].exit), how: t.legs[1].why, R: r3(t.legs[1].R), nights: t.legs[1].nights },
      g: r3(t.gross), cost: r3(t.cost), fin: r3(t.fin), net: r3(t.net), net0: r3(tr[0].net), net2: r3(tr[2].net), pool: pool[1].length,
      // post-hoc diagnostics (not in the pre-registration, never judged): the plain relative return from entry close to exit
      // close in percent, and the same pair with the pair stop only (no per-leg stops), base costs
      relPct: r3(100 * (L[L.ix[w.exit]].close / L[L.ix[w.entry]].close - S[S.ix[w.exit]].close / S[S.ix[w.entry]].close)),
      netPairOnly: r3(pairTrade(L, S, w.entry, w.exit, 1, rate, false).net) });
  }
  return { rows, pools, byOffset, dropped };
}

export function summarize(res, realOffset, placeboFn) {
  const { rows, pools, byOffset } = res, n = rows.length;
  if (!n) return { n: 0 };
  const nets = { 0: rows.map((r) => r.net0), 1: rows.map((r) => r.net), 2: rows.map((r) => r.net2) };
  const out = { n, won: nets[1].filter((x) => x > 0).length, meanG: r3(mean(rows.map((r) => r.g))), meanNet0: r3(mean(nets[0])), meanNet: r3(mean(nets[1])), meanNet2: r3(mean(nets[2])),
    t: r3(tStat(nets[1])), stopped: rows.filter((r) => r.why !== 'window').length, pairStops: rows.filter((r) => r.why === 'pair').length,
    meanLongR: r3(mean(rows.map((r) => r.long.R))), meanShortR: r3(mean(rows.map((r) => r.short.R))), years: [rows[0].year, rows[n - 1].year] };
  out.postHoc = { relPctMean: r3(mean(rows.map((r) => r.relPct))), relPctPos: rows.filter((r) => r.relPct > 0).length, relPctT: r3(tStat(rows.map((r) => r.relPct))),
    pairOnlyMeanNet: r3(mean(rows.map((r) => r.netPairOnly))), pairOnlyWon: rows.filter((r) => r.netPairOnly > 0).length };
  out.perm = {}; for (const k of P.MULTS) out.perm[k] = +permP(mean(nets[k]), pools[k]).toFixed(5);
  const common = Object.keys(byOffset[0]).filter((k) => byOffset.every((o) => o[k] != null)).map(Number);
  const offMeans = common.map((k) => ({ k, mean: mean(byOffset.map((o) => o[k])) }));
  const real = mean(nets[1]);
  out.rank = 1 + offMeans.filter((x) => x.k !== realOffset && x.mean > real + 1e-12).length;
  out.of = offMeans.length;
  out.offsetBest = offMeans.slice().sort((a, b) => b.mean - a.mean).slice(0, 5).map((x) => ({ k: x.k, mean: r3(x.mean) }));
  if (placeboFn) { const pl = placeboFn(); out.placebo = { atOrAbove: pl.filter((x) => x >= real - 1e-12).length, of: pl.length, min: r3(Math.min(...pl)), max: r3(Math.max(...pl)), means: pl.map(r3) }; }
  return out;
}

// placebo: per seed and turn, a random start US trading day of year Y-1, same length as that turn's real window
export function placebo(M, test, days, rows, dgs, seeds = P.PLACEBO_SEEDS) {
  const L = M[test.long], S = M[test.short], at = Object.fromEntries(days.map((d, i) => [d, i])), out = [];
  for (let s = 1; s <= seeds; s++) {
    const r = rng(P.SEED + s), vals = [];
    for (const row of rows) {
      const cand = days.filter((d) => d.startsWith(`${row.year - 1}-`) && days[at[d] + row.usDays]);
      for (let tries = 0; tries < 50; tries++) {
        const st = cand[Math.floor(r() * cand.length)], x = pairTrade(L, S, st, days[at[st] + row.usDays], 1, dgs2On(dgs, st));
        if (x) { vals.push(x.net); break; }
      }
    }
    out.push(mean(vals));
  }
  return out;
}

export function verdictOf(tests) {
  const judged = tests.filter((t) => t.judged);
  const ps = holm(judged.map((t) => t.decisive.perm[1]));
  judged.forEach((t, i) => { t.holmP = +ps[i].toFixed(5); t.pass = t.decisive.meanNet > 0 && t.replication.meanNet > 0 && t.holmP < P.ALPHA; });
  return judged.some((t) => t.pass) ? 'PASS' : 'FAIL';
}

// ── files ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEYS = ['us2000', 'spx500', 'nas100'];
function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const get = (p) => execFileSync('git', ['show', `origin/council-data:${p}`], { maxBuffer: 1 << 28 });
  for (const k of KEYS) { const f = path.join(dir, `${k}.json`); if (!fs.existsSync(f)) { fs.writeFileSync(f, get(`research/daily/${k}.json`)); console.log('saved', k); } }
  const c = path.join(dir, 'cache.json');
  if (!fs.existsSync(c)) { fs.writeFileSync(c, JSON.stringify({ DGS2: JSON.parse(get('macro/cache.json')).score.fred.DGS2 })); console.log('saved DGS2'); }
}

function full(dir) {
  const M = Object.fromEntries(KEYS.map((k) => [k, prep(JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')).rows)]));
  const dgs = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'), 'utf8')).DGS2;
  const first = KEYS.map((k) => M[k][0].day).sort().at(-1), last = KEYS.map((k) => M[k].at(-1).day).sort()[0];
  const days = tradingDays(String(first).slice(0, 4) + '-01-01', last);
  const tests = [];
  for (const test of TESTS) {
    const dec = [], rep = [];
    for (let y = P.DECISIVE[0]; y <= P.DECISIVE[1]; y++) dec.push(y);
    for (let y = +M.us2000[0].day.slice(0, 4) + 1; y <= P.REPLICATION_TO; y++) rep.push(y);
    const off = test.win === 'T1' ? 5 : 1;
    const D = runTest(M, test, days, dec, dgs), R = runTest(M, test, days, rep, dgs);
    const out = { id: test.id, name: test.name, long: test.long, short: test.short, window: test.win, judged: test.judged, offset: off,
      decisive: summarize(D, off, () => placebo(M, test, days, D.rows, dgs)), replication: summarize(R, off, () => placebo(M, test, days, R.rows, dgs)),
      years: { decisive: D.rows, replication: R.rows }, dropped: { decisive: D.dropped, replication: R.dropped } };
    tests.push(out);
    console.log(test.id, 'dec', out.decisive.n, out.decisive.won, out.decisive.meanNet, 'p', out.decisive.perm[1], 'rank', out.decisive.rank, '/', out.decisive.of,
      '| rep', out.replication.n, out.replication.won, out.replication.meanNet, 'p', out.replication.perm[1], 'rank', out.replication.rank, '/', out.replication.of);
  }
  const verdict = verdictOf(tests);
  const J = { topic: 'smallcap-january', built: '2026-11-14', title: 'Small caps at the turn of the year: long US2000, short SPX500 on OANDA CFDs',
    system: 'US2000 long against SPX500 short over the turn of the year (NAS100 control); OANDA mid daily candles, council-data research/daily',
    data: Object.fromEntries(KEYS.map((k) => [k, { candles: M[k].length, first: M[k][0].day, last: M[k].at(-1).day }])),
    params: P, specialClosed: SPECIAL_CLOSED, verdict, tests };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(J, null, 1) + '\n');
  console.log('verdict', verdict, tests.filter((t) => t.judged).map((t) => `${t.id} holm ${t.holmP} ${t.pass ? 'pass' : 'fail'}`).join(' | '));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) fetchAll(dir);
  else if (mode === 'full' && dir) full(dir);
  else { console.error('usage: node run.mjs fetch <dir> | full <dir>'); process.exit(1); }
}
