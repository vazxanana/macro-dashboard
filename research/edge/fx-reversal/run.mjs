// Edge research · fx-reversal (PREREGISTRATION.md, committed first): cross-sectional 1-week reversal in G10 FX.
// Each week, at the close of the last Monday-Friday UTC daily candle, buy the 2 currencies (vs USD) that fell most over the
// past week and sell the 2 that rose most; equal 60-day volatility weights; a 3 x ATR(20) stop on every leg; out at the next
// week's decision close. Net of the measured raw-spread cost model and a stated 1 % a year financing against every leg.
//   node research/edge/fx-reversal/fetch.mjs <dir>   copies the daily candles out of the council-data branch (no network)
//   node research/edge/fx-reversal/run.mjs <dir>     writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { costModel, SLIP_SPREADS } from '../../../council/fills.mjs';
import { spreadFields, commissionRT } from '../../../council/ctrader-symbols.mjs';
import { SYMBOLS } from '../../../council/ctrader-mirror.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KEYS = ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf', 'nzdusd'];
export const CCY = { eurusd: 'EUR', gbpusd: 'GBP', usdjpy: 'JPY', audusd: 'AUD', usdcad: 'CAD', usdchf: 'CHF', nzdusd: 'NZD' };
export const USD_BASE = new Set(['usdjpy', 'usdcad', 'usdchf']);
export const P = { N_LEG: 2, VOL_N: 60, ATR_N: 20, STOP_K: 3, FIN_YEAR: 0.01, SEEDS: 40, PASS_SHARPE: 0.4, PASS_T: 2 };
export const WIN = { check: ['2008-01-01', '2015-12-31'], decisive: ['2016-01-01', '2026-11-06'] };
const DAY = 86400;
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : null);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);

// ── the foreign currency's price in dollars; a USD-base pair is inverted (high and low swap) ──
export function toForeign(rows, key) {
  const inv = USD_BASE.has(key);
  return rows.map(([t, o, h, l, c]) => inv ? { time: t, open: 1 / o, high: 1 / l, low: 1 / h, close: 1 / c } : { time: t, open: o, high: h, low: l, close: c });
}
const wday = (t) => new Date(t * 1000).getUTCDay();
const weekOf = (t) => { const d = Math.floor(t / DAY); return d - ((d + 3) % 7); };   // Monday's day number of the UTC week
const isWeekday = (t) => { const w = wday(t); return w >= 1 && w <= 5; };

// decision candles: per week, the last Monday-Friday candle; kept only when all series share the same timestamp
export function decisions(S) {
  const per = KEYS.map((k) => { const m = new Map(); S[k].forEach((b, i) => { if (isWeekday(b.time)) m.set(weekOf(b.time), i); }); return m; });
  const out = [];
  for (const [w, i0] of per[0]) {
    const t = S[KEYS[0]][i0].time;
    const idx = {};
    let ok = true;
    KEYS.forEach((k, j) => { const i = per[j].get(w); if (i == null || S[k][i].time !== t) ok = false; else idx[k] = i; });
    if (ok) out.push({ week: w, time: t, idx });
  }
  return out.sort((a, b) => a.time - b.time);
}

// weekday candles up to and including index i (Sunday stubs left out of volatility and ATR)
function wdBack(B, i, n) {
  const a = [];
  for (let j = i; j >= 0 && a.length < n; j--) if (isWeekday(B[j].time)) a.push(j);
  return a.reverse();
}
export function vol(B, i, n = P.VOL_N) {
  const ix = wdBack(B, i, n + 1); if (ix.length < n + 1) return null;
  const r = []; for (let j = 1; j < ix.length; j++) r.push(Math.log(B[ix[j]].close / B[ix[j - 1]].close));
  const m = r.reduce((s, x) => s + x, 0) / r.length;
  return Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / (r.length - 1));
}
export function atr(B, i, n = P.ATR_N) {
  const ix = wdBack(B, i, n + 1); if (ix.length < n + 1) return null;
  let a = 0;
  for (let j = 1; j < ix.length; j++) { const b = B[ix[j]], pc = B[ix[j - 1]].close; a += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return a / n;
}

// ranking: lowest past return bought, highest sold; ties by key order (a stable sort on KEYS)
export function pick(ret, n = P.N_LEG) {
  const order = KEYS.map((k, j) => ({ k, j, r: ret[k] })).sort((a, b) => a.r - b.r || a.j - b.j);
  return { buy: order.slice(0, n).map((x) => x.k), sell: order.slice(-n).map((x) => x.k) };
}

// one leg from candle e (entry at its open) to candle x (exit at its close); side +1 buy, -1 sell
export function leg(B, e, x, side, stopDist) {
  const entry = B[e].open, stop = entry - side * stopDist;
  for (let i = e; i <= x; i++) {
    const b = B[i];
    if (i > e && side * (b.open - stop) <= 0) return { entry, exit: b.open, why: 'gap', exitT: b.time, stop };
    if (side > 0 ? b.low <= stop : b.high >= stop) return { entry, exit: stop, why: 'stop', exitT: b.time, stop };
  }
  return { entry, exit: B[x].close, why: 'time', exitT: B[x].time + DAY, stop };
}

// trading cost a round trip as a fraction of the pair's own price (measured model; see the pre-registration)
export function buildCosts(fixture) {
  const f = JSON.parse(JSON.stringify({ at: fixture.at, account: fixture.account, symbols: fixture.symbols }));
  for (const [n, e] of Object.entries(f.symbols)) {
    let before = {};
    for (const [sec, bid, ask] of fixture.reads[n] || []) before = { ...before, ...spreadFields({ bid, ask, ts: sec * 1000 }, true, before, sec) };
    Object.assign(e, before, { commissionRT: commissionRT({ commissionType: e.commission.type, preciseTradingCommissionRate: e.commission.preciseRate }) });
  }
  const MK = Object.fromEntries(KEYS.map((k) => [k, { group: 'Forex' }]));
  const m = costModel(MK, { symbols: SYMBOLS, brokerInfo: f });
  const fxCom = Object.values(m).map((x) => x.commissionRT).find((v) => v > 0);
  const out = {};
  for (const k of KEYS) {
    const pip = k === 'usdjpy' ? 0.01 : 0.0001;
    const measured = /^quotes/.test(m[k].src);
    const spreadPips = measured ? m[k].spread / pip : 1;            // quoted spread: measured median, else the default 1 pip
    const slipPips = 2 * SLIP_SPREADS * 1;                          // half the default spread at entry and at exit
    out[k] = { src: measured ? m[k].src : 'default+commission (not in the fixture)', pip, spreadPips, slipPips,
      commissionRT: m[k].commissionRT > 0 ? m[k].commissionRT : fxCom };
  }
  return out;
}
// cost as a fraction of notional for one round trip at pair price px (the pair as quoted, before inversion)
export const legCost = (c, px) => (c.spreadPips + c.slipPips) * c.pip / px + c.commissionRT;

// ── the book ──
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function runBook(S, rawPx, costs, { seed = null } = {}) {
  const dec = decisions(S), rnd = seed != null ? mulberry32(seed) : null, weeks = [];
  for (let w = 1; w + 1 < dec.length; w++) {
    const d = dec[w], prev = dec[w - 1], nx = dec[w + 1];
    const ret = {}, sig = {}, at = {};
    let ok = true;
    for (const k of KEYS) {
      const B = S[k], i = d.idx[k];
      ret[k] = B[i].close / B[prev.idx[k]].close - 1;
      sig[k] = vol(B, i); at[k] = atr(B, i);
      if (!(sig[k] > 0) || !(at[k] > 0) || !(nx.idx[k] > i)) ok = false;
    }
    if (!ok) continue;
    let sel;
    if (rnd) { const a = KEYS.slice(); for (let j = a.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [a[j], a[r]] = [a[r], a[j]]; } sel = { buy: a.slice(0, P.N_LEG), sell: a.slice(-P.N_LEG) }; }
    else sel = pick(ret);
    const L = [...sel.buy.map((k) => [k, 1]), ...sel.sell.map((k) => [k, -1])];
    const inv = L.reduce((s, [k]) => s + 1 / sig[k], 0);
    let R = 0, G = 0, C = 0, F = 0, stops = 0;
    const legs = [];
    for (const [k, side] of L) {
      const B = S[k], e = d.idx[k] + 1, x = nx.idx[k], wt = (1 / sig[k]) / inv;
      const lg = leg(B, e, x, side, P.STOP_K * at[k]);
      const g = side * (lg.exit / lg.entry - 1);
      const pairPx = rawPx[k][e][1];                       // the pair's own open (as quoted) for the pip cost
      const c = legCost(costs[k], pairPx), fin = P.FIN_YEAR * Math.max(0, (lg.exitT - B[e].time) / DAY) / 365;
      G += wt * g; C += wt * c; F += wt * fin; R += wt * (g - c - fin);
      if (lg.why !== 'time') stops++;
      legs.push({ k, side, w: r4(wt), why: lg.why, g: r4(g) });
    }
    weeks.push({ t: S[KEYS[0]][d.idx[KEYS[0]] + 1].time, dec: d.time, R, G, C, F, stops, legs });
  }
  return weeks;
}

export function stats(rows, key = 'R') {
  const x = rows.map((r) => r[key]), n = x.length;
  if (n < 2) return { n };
  const m = x.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
  const mo = new Map();
  for (const r of rows) { const d = new Date(r.t * 1000), k = d.getUTCFullYear() * 12 + d.getUTCMonth(); mo.set(k, (mo.get(k) || 0) + r[key]); }
  const ms = [...mo.values()], mm = ms.reduce((s, v) => s + v, 0) / ms.length;
  const msd = Math.sqrt(ms.reduce((s, v) => s + (v - mm) ** 2, 0) / (ms.length - 1));
  let eq = 0, pk = 0, dd = 0;
  for (const v of x) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, mean: m, sd, sharpe: sd > 0 ? m / sd * Math.sqrt(52) : null, months: ms.length, tMonth: msd > 0 ? mm / (msd / Math.sqrt(ms.length)) : null, total: eq, maxDD: dd };
}
export const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y), p = q * (s.length - 1), lo = Math.floor(p); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo); };
const inWin = (rows, [a, b]) => rows.filter((r) => r.t >= T(a) && r.t < T(b) + DAY);
const fmt = (s) => ({ n: s.n, mean: r4(s.mean * 100), sd: r4(s.sd * 100), sharpe: r3(s.sharpe), months: s.months, tMonth: r3(s.tMonth), totalPct: r3(s.total * 100), maxDDPct: r3(s.maxDD * 100) });

export function verdict(dec, chk, p95) {
  const checks = { sharpe: dec.sharpe > P.PASS_SHARPE, tMonth: dec.tMonth >= P.PASS_T, check2008: chk.total > 0, placebo: dec.sharpe > p95 };
  return { pass: Object.values(checks).every(Boolean), checks };
}

export function loadSeries(dir) {
  const S = {}, raw = {};
  for (const k of KEYS) { const j = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')); raw[k] = j.rows; S[k] = toForeign(j.rows, k); }
  return { S, raw };
}

export function full(dir) {
  const { S, raw } = loadSeries(dir);
  const fixture = JSON.parse(fs.readFileSync(path.join(HERE, '../../../tests/fixtures/ctrader/symbols-raw-12nov.json'), 'utf8'));
  const costs = buildCosts(fixture);
  const weeks = runBook(S, raw, costs);
  const dRows = inWin(weeks, WIN.decisive), cRows = inWin(weeks, WIN.check);
  const dec = stats(dRows), chk = stats(cRows);
  const plac = [];
  for (let s = 1; s <= P.SEEDS; s++) { const pw = runBook(S, raw, costs, { seed: s }); plac.push(stats(inWin(pw, WIN.decisive)).sharpe); }
  const p95 = pct(plac, 0.95);
  const v = verdict(dec, chk, p95);
  const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0);
  const legsN = (rows) => rows.reduce((s, r) => s + r.legs.length, 0);
  const byYear = {};
  for (const r of weeks.filter((r) => r.t >= T('2008-01-01'))) { const y = new Date(r.t * 1000).getUTCFullYear(); byYear[y] = (byYear[y] || 0) + r.R; }
  const block = (rows, s) => ({ ...fmt(s), gross: fmt(stats(rows, 'G')), costPct: r3(sum(rows, 'C') * 100), financingPct: r3(sum(rows, 'F') * 100),
    legs: legsN(rows), stoppedShare: r3(sum(rows, 'stops') / Math.max(1, legsN(rows))), from: new Date(rows[0].t * 1000).toISOString().slice(0, 10), to: new Date(rows.at(-1).t * 1000).toISOString().slice(0, 10) });
  return {
    topic: 'fx-reversal', built: '2026-11-13', title: 'Cross-sectional 1-week reversal in G10 FX',
    system: 'Each week at the last Monday-Friday UTC daily close, buy the 2 of EUR GBP JPY AUD CAD CHF NZD (vs USD) with the lowest past-week return and sell the 2 with the highest; equal 60-day volatility weights; a 3 x ATR(20) stop on every leg; one week; net of the measured raw-spread cost model and 1 % a year financing against every leg',
    verdict: v.pass ? 'PASS' : 'FAIL', checks: v.checks,
    clock: 'decision at the close of the last Monday-Friday OANDA daily candle of the UTC week (00:00 UTC, about 2 h after 17:00 New York); entry at the next candle open',
    params: P, windows: WIN, costs,
    decisive: block(dRows, dec), check: block(cRows, chk),
    placebo: { seeds: P.SEEDS, p95: r3(p95), median: r3(pct(plac, 0.5)), max: r3(Math.max(...plac)), sharpes: plac.map(r3), beaten: plac.filter((x) => dec.sharpe > x).length },
    byYearPct: Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, r3(v * 100)])),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node run.mjs <dir>'); process.exit(1); }
  const out = full(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: out.verdict, checks: out.checks, decisive: out.decisive, check: out.check, placebo: { p95: out.placebo.p95, median: out.placebo.median, beaten: out.placebo.beaten }, byYear: out.byYearPct, costs: out.costs }, null, 1));
}
