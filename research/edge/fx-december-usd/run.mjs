// The year-end US dollar seasonal (PREREGISTRATION.md, pushed first).
//   node research/edge/fx-december-usd/run.mjs fetch <dir>   copies the six daily files, ctrader/symbols.json (council-data) and
//                                                            the fx-carry study's rates.json (git show, no network)
//   node research/edge/fx-december-usd/run.mjs full <dir>    the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test. Paper only: nothing here is read by the council or the page.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, stopFill } from '../../../council/fills.mjs';

// side = +1 long the pair for "short USD"
export const PAIRS = [
  { k: 'eurusd', sym: 'EURUSD', side: 1, base: 'eur', quote: 'usd', pip: 1e-4 },
  { k: 'gbpusd', sym: 'GBPUSD', side: 1, base: 'gbp', quote: 'usd', pip: 1e-4 },
  { k: 'audusd', sym: 'AUDUSD', side: 1, base: 'aud', quote: 'usd', pip: 1e-4 },
  { k: 'nzdusd', sym: 'NZDUSD', side: 1, base: 'nzd', quote: 'usd', pip: 1e-4 },
  { k: 'usdjpy', sym: 'USDJPY', side: -1, base: 'usd', quote: 'jpy', pip: 1e-2 },
  { k: 'usdchf', sym: 'USDCHF', side: -1, base: 'usd', quote: 'chf', pip: 1e-4 },
];
export const SPREAD_PIP = 0.3, SLIP_PIP = 0.15, COMM_SIDE = 22.5e-6;
export const ATR_N = 20, ATR_K = 3, T2_DAYS = 10, SEED = 20261114, DRAWS = 1000;
export const DATA_FROM = Date.UTC(2005, 0, 1) / 1000, DECISIVE_YEAR = 2010;
const H = 3600, DAY = 86400;
const dOf = (y, m, d) => Date.UTC(y, m, d) / 1000;
const ymd = (t) => { const d = new Date(t * 1000); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };

// folded weekday candles from 1 Jan 2005
export function prep(rows) {
  return foldWeekend(rows.filter((r) => r[0] >= DATA_FROM).map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
}
// index of the first candle whose time is >= t (bars.length if none)
export function firstOnOrAfter(bars, t) { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time < t) lo = m + 1; else hi = m; } return lo; }
const exitTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

// financing a night as a fraction of the entry price, for a position of sign s (+1 long the pair) opened at entry
export function finPerNight(pair, s, entry, t, F) {
  const sw = F.swap && F.swap[pair.sym];
  if (sw) return (s > 0 ? sw.long : sw.short) * pair.pip / entry;
  const [y, m] = ymd(t), pm = m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`;
  const row = F.rates.monthEnd[pm] || F.rates.monthEnd[Object.keys(F.rates.monthEnd).sort().at(-1)], ix = (c) => F.rates.order.indexOf(c);
  return s * (row[ix(pair.base)] - row[ix(pair.quote)]) / 100 / 365;
}
export const costOf = (pair, entry, mult = 1) => mult * ((SPREAD_PIP + 2 * SLIP_PIP) * pair.pip / entry + 2 * COMM_SIDE);

// one position: bars i0..i1, sign s; null without 20 candles before it or past the data
export function position(bars, i0, i1, s, pair, F, { cost = 1, fin = 1 } = {}) {
  if (i0 < ATR_N || i1 >= bars.length || i1 < i0) return null;
  let tr = 0; for (let j = i0 - ATR_N; j < i0; j++) { const b = bars[j], pc = bars[j - 1] ? bars[j - 1].close : b.open;
    tr += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  const entry = bars[i0].open, risk = ATR_K * tr / ATR_N, stop = entry - s * risk;
  if (!(risk > 0)) return null;
  let exit = null, tEnd = null, how = 'close';
  for (let j = i0; j <= i1; j++) { const b = bars[j];
    if (s > 0 ? b.low <= stop : b.high >= stop) { exit = stopFill(b, s < 0, stop, j > i0); tEnd = exitTime(b.time); how = 'stop'; break; } }
  if (exit == null) { exit = bars[i1].close; tEnd = exitTime(bars[i1].time); }
  const gross = s * (exit - entry) / entry, nn = nights(bars[i0].time, tEnd), f = fin * nn * finPerNight(pair, s, entry, bars[i0].time, F);
  const c = costOf(pair, entry, cost);
  return { gross, cost: c, fin: f, nights: nn, how, ret: gross - c + f };
}

// the claimed December window of a pair and year: first day on/after 15 Dec to the last December day; complete only when the
// data has a candle after 31 Dec
export function decWindow(bars, y) {
  const i0 = firstOnOrAfter(bars, dOf(y, 11, 15)), iN = firstOnOrAfter(bars, dOf(y + 1, 0, 1));
  if (i0 >= bars.length || iN >= bars.length || i0 >= iN) return null;
  return { i0, i1: iN - 1, n: iN - i0 };
}
export function janWindow(bars, y) {
  const i0 = firstOnOrAfter(bars, dOf(y, 0, 1)); if (i0 >= bars.length || ymd(bars[i0].time)[1] !== 0) return null;
  const i1 = i0 + T2_DAYS - 1; return i1 < bars.length ? { i0, i1, n: T2_DAYS } : null;
}
// same-length windows from a calendar date
export const fromDate = (bars, t, n) => { const i0 = firstOnOrAfter(bars, t), i1 = i0 + n - 1; return i1 < bars.length ? { i0, i1 } : null; };

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
  return h;
}
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
export function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export const pUpper = (t, df) => { const p2 = ibeta(df / (df + t * t), df / 2, 0.5) / 2; return t >= 0 ? p2 : 1 - p2; };
export function oneSample(xs) {
  const n = xs.length, m = mean(xs), sd = n > 1 ? sdOf(xs) : NaN, t = m / (sd / Math.sqrt(n));
  return { n, mean: m, sd, t, p: n > 1 ? pUpper(t, n - 1) : NaN, pos: xs.filter((x) => x > 0).length };
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// one test, every year: { years: [{ y, claim, base, excess, nComp, pairs }], claimN: { 'pair|y': n } }
// kind 'dec' (sign: short USD) or 'jan' (long USD); P = [{ pair, bars }]
export function yearly(P, kind, F, opt = {}) {
  const S = kind === 'jan' ? -1 : 1, years = new Set();
  for (const { bars } of P) for (const b of bars) years.add(ymd(b.time)[0]);
  const out = [], claimN = {};
  for (const y of [...years].sort((a, b) => a - b)) {
    const claimR = [], comp = new Map();
    for (const { pair, bars } of P) {
      const w = kind === 'jan' ? janWindow(bars, y) : decWindow(bars, y); if (!w) continue;
      const pos = position(bars, w.i0, w.i1, S * pair.side, pair, F, opt); if (!pos) continue;
      claimR.push(pos.ret); claimN[`${pair.k}|${y}`] = w.n;
      const starts = kind === 'jan' ? [...Array(11).keys()].map((m) => [m + 1, 1]) : [...Array(12).keys()].flatMap((m) => [[m, 1], [m, 15]]).filter(([m, d]) => !(m === 11 && d === 15));
      for (const [m, d] of starts) {
        const c = fromDate(bars, dOf(y, m, d), w.n); if (!c) continue;
        if (kind === 'dec' && c.i1 >= w.i0) continue;          // shares a day with the claimed window
        if (ymd(bars[c.i0].time)[0] !== y) continue;
        const cp = position(bars, c.i0, c.i1, S * pair.side, pair, F, opt); if (!cp) continue;
        const key = `${m}-${d}`; if (!comp.has(key)) comp.set(key, []); comp.get(key).push(cp.ret);
      }
    }
    if (!claimR.length || !comp.size) continue;
    const base = mean([...comp.values()].map(mean)), claim = mean(claimR);
    out.push({ y, claim, base, excess: claim - base, nComp: comp.size, pairs: claimR.length });
  }
  return { years: out, claimN };
}

// placebo: a random start date, the same rules, the statistic against the claimed test's yearly baselines (decisive years)
export function placebo(P, kind, F, Y, draws = DRAWS, seed = SEED) {
  const S = kind === 'jan' ? -1 : 1, dec = Y.years.filter((r) => r.y >= DECISIVE_YEAR), want = mean(dec.map((r) => r.excess));
  const rng = mulberry32(seed); let ge = 0; const stats = [];
  for (let i = 0; i < draws; i++) {
    const m = Math.floor(rng() * 12), d = 1 + Math.floor(rng() * (kind !== 'jan' && m === 11 ? 15 : 28)), ex = [];
    for (const r of dec) {
      const rs = [];
      for (const { pair, bars } of P) {
        const n = kind === 'jan' ? T2_DAYS : Y.claimN[`${pair.k}|${r.y}`]; if (!n) continue;
        const w = fromDate(bars, dOf(r.y, m, d), n); if (!w) continue;
        const p = position(bars, w.i0, w.i1, S * pair.side, pair, F); if (p) rs.push(p.ret);
      }
      if (rs.length) ex.push(mean(rs) - r.base);
    }
    if (!ex.length) continue;
    const s = mean(ex); stats.push(s); if (s >= want - 1e-15) ge++;
  }
  return { share: ge / stats.length, draws: stats.length, want };
}

const bp = (x) => +(x * 1e4).toFixed(2), r2 = (x) => +x.toFixed(2), r4 = (x) => +x.toFixed(4);
const summ = (rows) => { if (!rows.length) return null; const o = oneSample(rows.map((r) => r.excess));
  return { years: rows.length, from: rows[0].y, to: rows.at(-1).y, meanExcessBp: bp(o.mean), sdBp: bp(o.sd), t: r2(o.t), p: r4(o.p), positive: o.pos,
    meanClaimBp: bp(mean(rows.map((r) => r.claim))), meanBaseBp: bp(mean(rows.map((r) => r.base))) }; };

export function study(data, F) {
  const basket = PAIRS.map((pair) => ({ pair, bars: prep(data[pair.k]) })), eur = basket.filter((x) => x.pair.k === 'eurusd');
  const defs = { T1: ['dec', basket], T2: ['jan', basket], T3: ['dec', eur] };
  const out = { tests: {}, cost2x: {}, placebo: {}, years: {} }, rawP = {};
  for (const [k, [kind, P]] of Object.entries(defs)) {
    const Y = yearly(P, kind, F), Y2 = yearly(P, kind, F, { cost: 2, fin: 2 });
    const dec = Y.years.filter((r) => r.y >= DECISIVE_YEAR), rep = Y.years.filter((r) => r.y < DECISIVE_YEAR);
    out.tests[k] = { decisive: summ(dec), replication: summ(rep) }; rawP[k] = oneSample(dec.map((r) => r.excess)).p;
    out.cost2x[k] = summ(Y2.years.filter((r) => r.y >= DECISIVE_YEAR));
    const pl = placebo(P, kind, F, Y); out.placebo[k] = { share: r4(pl.share), draws: pl.draws };
    out.years[k] = Y.years.map((r) => ({ y: r.y, claimBp: bp(r.claim), baseBp: bp(r.base), excessBp: bp(r.excess), comps: r.nComp, pairs: r.pairs }));
  }
  const ks = ['T1', 'T2', 'T3'], ps = ks.map((k) => rawP[k]), adj = holm(ps);
  out.holm = Object.fromEntries(ks.map((k, i) => [k, r4(adj[i])]));
  out.pass = {};
  for (const [i, k] of ks.entries()) {
    const T = out.tests[k], b = { bothWindows: T.decisive.meanExcessBp > 0 && !!T.replication && T.replication.meanExcessBp > 0, holm: adj[i] < 0.05, placebo: out.placebo[k].share < 0.05, cost2x: out.cost2x[k].meanExcessBp > 0 };
    b.pass = Object.values(b).every(Boolean); out.pass[k] = b;
  }
  const n = ks.filter((k) => out.pass[k].pass).length;
  out.verdict = n === 3 ? 'PASS' : n ? 'PARTIAL' : 'FAIL';
  // what a position costs, for the report (T1 basket, decisive)
  const cs = [];
  for (const { pair, bars } of basket) for (let y = DECISIVE_YEAR; y <= 2025; y++) { const w = decWindow(bars, y); const p = w && position(bars, w.i0, w.i1, pair.side, pair, F); if (p) cs.push(p); }
  out.costT1 = { positions: cs.length, costBp: bp(mean(cs.map((p) => p.cost))), finBp: bp(mean(cs.map((p) => p.fin))), stops: cs.filter((p) => p.how === 'stop').length };
  return out;
}

const FILES = ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdchf'];
async function main() {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  const show = (ref) => execFileSync('git', ['show', ref], { maxBuffer: 1 << 28 });
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true });
    for (const k of FILES) fs.writeFileSync(path.join(dir, `${k}.json`), show(`origin/council-data:research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, 'symbols.json'), show('origin/council-data:ctrader/symbols.json'));
    fs.writeFileSync(path.join(dir, 'rates.json'), show('origin/fx-carry:research/edge/fx-carry/rates.json'));
    console.log('wrote', dir); return; }
  const raw = {}, data = {}, sha = {}, span = {};
  for (const k of FILES) { raw[k] = fs.readFileSync(path.join(dir, `${k}.json`)); const j = JSON.parse(raw[k]); data[k] = j.rows;
    sha[k] = crypto.createHash('sha256').update(raw[k]).digest('hex');
    span[k] = { first: new Date(j.rows[0][0] * 1000).toISOString().slice(0, 10), last: new Date(j.rows.at(-1)[0] * 1000).toISOString().slice(0, 10) }; }
  const symRaw = fs.readFileSync(path.join(dir, 'symbols.json')), sym = JSON.parse(symRaw), ratesRaw = fs.readFileSync(path.join(dir, 'rates.json'));
  const swap = {}, finSrc = {};
  for (const p of PAIRS) { const s = sym.symbols && sym.symbols[p.sym] && sym.symbols[p.sym].swap;
    if (s && s.type === 0) { swap[p.sym] = { long: s.long, short: s.short }; finSrc[p.k] = `broker swap (pips a lot a night): long ${s.long}, short ${s.short}`; }
    else finSrc[p.k] = 'policy-rate differential, fx-carry rates.json monthEnd'; }
  const F = { swap, rates: JSON.parse(ratesRaw) };
  const res = study(data, F);
  const doc = { study: 'fx-december-usd', built: '2026-11-14', verdict: res.verdict,
    claim: { T1: 'short USD basket, first trading day on/after 15 Dec to the last trading day of December, vs the same-length hold from every other half-month of the year', T2: 'long USD basket, first 10 trading days of January, vs the first 10 of every other month of the year', T3: 'T1 on EUR/USD alone' },
    basket: PAIRS.map((p) => `${p.side > 0 ? 'long' : 'short'} ${p.sym}`),
    data: { files: FILES.map((k) => `council-data research/daily/${k}.json`), usedFrom: '2005-01-01', span, sha256: sha,
      symbols: { file: 'council-data ctrader/symbols.json', at: sym.at, sha256: crypto.createHash('sha256').update(symRaw).digest('hex') },
      rates: { file: 'fx-carry research/edge/fx-carry/rates.json', asOf: F.rates.asOf, sha256: crypto.createHash('sha256').update(ratesRaw).digest('hex') } },
    costs: { spreadPip: SPREAD_PIP, slipPipEachSide: SLIP_PIP, commissionPerSide: COMM_SIDE, financing: finSrc },
    units: 'returns in basis points of the entry price, basket = equal-weight mean of the pairs', ...res,
    note: 'Paper only. About 16 yearly observations in the decisive window: low power. Nothing in the council reads this study.' };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, tests: res.tests, holm: res.holm, placebo: res.placebo, cost2x: res.cost2x, pass: res.pass, costT1: res.costT1, finSrc }, null, 1));
  for (const k of ['T1', 'T2', 'T3']) { console.log(k); console.table(res.years[k]); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
