// Volatility-managed exposure on US index CFDs (PREREGISTRATION.md, committed before this file).
// A stand-alone index allocation rule: nothing of the gold book, nothing live.
//   node research/edge/vol-managed/run.mjs fetch <dir>   (git show from origin/council-data, no network)
//   node research/edge/vol-managed/run.mjs full <dir>    (writes result.json and RESULT.md here)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MARKETS = { spx500: 'S&P 500', nas100: 'Nasdaq 100', us30: 'Dow 30' };
export const P = {
  rvN: 22, cap: 2, atrN: 20, stopAtr: 3,
  spreadRT: 0.0003, finAdd: 0.025, dgs2Default: 0.03, dgs2LagDays: 7,
  disc: ['2008-01', '2015-12'], dec: ['2016-01', null],
  boot: { draws: 2000, block: 6, seed: 20261113 },
};
const DAY = 86400;
const ymOf = (t) => new Date(t * 1e3).toISOString().slice(0, 7);
const dateOf = (t) => new Date(t * 1e3).toISOString().slice(0, 10);

// Saturday / Sunday candles folded into the next weekday; a trailing weekend candle is dropped.
export function foldWeekend(rows) {
  const out = []; let pend = null;
  for (const [t, o, h, l, c] of rows) {
    const wd = new Date(t * 1e3).getUTCDay();
    if (wd === 0 || wd === 6) { pend = pend ? { o: pend.o, h: Math.max(pend.h, h), l: Math.min(pend.l, l) } : { o, h, l }; continue; }
    if (pend) { out.push({ t, o: pend.o, h: Math.max(pend.h, h), l: Math.min(pend.l, l), c }); pend = null; }
    else out.push({ t, o, h, l, c });
  }
  return out;
}

// RV at bar i: sum of squared returns of the rvN weekdays ending at bar i (needs bars i-rvN .. i). Null when short.
export function rvAt(bars, i, n = P.rvN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const r = bars[k].c / bars[k - 1].c - 1; s += r * r; }
  return s;
}
export function atrAt(bars, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].c; s += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); }
  return s / n;
}
export const rawWeight = (rv, variant) => (variant === 'V' ? 1 / rv : 1 / Math.sqrt(rv));
export const capped = (c, raw, cap = P.cap) => Math.min(c * raw, cap);

// c such that the mean capped weight over `raws` equals 1 (bisection; the mean is monotone in c).
export function solveC(raws, cap = P.cap) {
  if (!raws.length) throw new Error('no discovery months');
  const mean = (c) => raws.reduce((a, r) => a + capped(c, r, cap), 0) / raws.length;
  let lo = 0, hi = 1;
  while (mean(hi) < 1) { hi *= 2; if (hi > 1e12) throw new Error('cap below 1'); }
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (mean(m) < 1) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// month-end bar indices: the last weekday bar of each calendar month (only complete months: a later bar exists)
export function monthEnds(bars) {
  const ends = [];
  for (let i = 0; i < bars.length - 1; i++) if (ymOf(bars[i].t) !== ymOf(bars[i + 1].t)) ends.push(i);
  return ends;
}

// DGS2 for a day: latest weekly value dated at least lag days before it, as a fraction; null when none.
export function dgs2Lookup(series, lag = P.dgs2LagDays) {
  const s = (series || []).map(([d, v]) => [Date.parse(d + 'T00:00:00Z') / 1e3, v / 100]).filter((x) => Number.isFinite(x[1])).sort((a, b) => a[0] - b[0]);
  return (t) => {
    const lim = t - lag * DAY; let lo = 0, hi = s.length - 1, ans = null;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m][0] <= lim) { ans = s[m][1]; lo = m + 1; } else hi = m - 1; }
    return ans;
  };
}

// Plan: for each month end e (with RV and ATR), the weight of the next month for each variant ('V', 'S', 'B' = benchmark 1).
// c fitted on months whose position starts in the discovery window only.
export function plan(bars, variant, disc = P.disc) {
  const ends = monthEnds(bars), months = [];
  for (const e of ends) {
    const rv = rvAt(bars, e), atr = atrAt(bars, e);
    if (rv == null || atr == null || !(rv > 0)) continue;
    const next = ymOf(bars[e + 1].t);
    months.push({ e, ym: next, raw: variant === 'B' ? null : rawWeight(rv, variant), stop: bars[e].c - P.stopAtr * atr });
  }
  let c = 1;
  if (variant !== 'B') {
    const raws = months.filter((m) => m.ym >= disc[0] && m.ym <= disc[1]).map((m) => m.raw);
    c = solveC(raws);
    for (const m of months) m.w = capped(c, m.raw);
  } else for (const m of months) m.w = 1;
  return { c, months };
}

// Daily simulation: returns [{ t, ym, r }] net daily returns from the first planned month on, and per-month details.
export function simulate(bars, pl, dgs2) {
  const half = P.spreadRT / 2, out = [], log = [];
  let fallbackDays = 0;
  const byEnd = new Map(pl.months.map((m) => [m.e, m]));
  let cur = null, held = 0; // held = weight held at the previous close
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i], pc = bars[i - 1].c;
    // position set at the previous close?
    if (byEnd.has(i - 1)) {
      const m = byEnd.get(i - 1);
      // month-end rebalance cost from what was held (0 after a stop)
      const cost = Math.abs(m.w - held) * half;
      cur = { ...m, stopped: false, entryCost: cost };
      if (out.length) out[out.length - 1].r -= cost; else cur.firstCost = cost;
      held = m.w;
      log.push({ ym: m.ym, w: m.w, stop: m.stop });
    }
    if (!cur) continue;
    let r = 0;
    if (held > 0) {
      const days = (b.t - bars[i - 1].t) / DAY;
      let y = dgs2(bars[i - 1].t);
      if (y == null) { y = P.dgs2Default; if (ymOf(b.t) >= P.disc[0]) fallbackDays++; }
      const fin = held * (y + P.finAdd) * days / 365;
      if (b.l <= cur.stop) {
        const px = Math.min(b.o, cur.stop);
        r = held * (px / pc - 1) - held * half - fin;
        cur.stopped = true; log[log.length - 1].stoppedAt = dateOf(b.t);
        held = 0;
      } else r = held * (b.c / pc - 1) - fin;
    }
    if (cur.firstCost != null) { r -= cur.firstCost; cur.firstCost = null; }
    out.push({ t: b.t, ym: ymOf(b.t), r });
  }
  return { daily: out, log, fallbackDays };
}

export function monthly(daily) {
  const m = new Map();
  for (const d of daily) m.set(d.ym, (m.get(d.ym) ?? 1) * (1 + d.r));
  return [...m].map(([ym, g]) => ({ ym, r: g - 1 }));
}
export function sharpe(rs) {
  const n = rs.length; if (n < 2) return null;
  const mu = rs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(rs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
  return sd > 0 ? (mu / sd) * Math.sqrt(12) : null;
}
export function maxDD(daily) {
  let eq = 1, pk = 1, dd = 0;
  for (const d of daily) { eq *= 1 + d.r; pk = Math.max(pk, eq); dd = Math.min(dd, eq / pk - 1); }
  return dd;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// paired circular block bootstrap of the Sharpe difference
export function bootP(a, b, { draws, block, seed } = P.boot) {
  const n = a.length, rnd = mulberry32(seed); let pos = 0;
  for (let d = 0; d < draws; d++) {
    const xa = [], xb = [];
    while (xa.length < n) { const s = Math.floor(rnd() * n); for (let k = 0; k < block && xa.length < n; k++) { xa.push(a[(s + k) % n]); xb.push(b[(s + k) % n]); } }
    const da = sharpe(xa), db = sharpe(xb);
    if (da != null && db != null && da - db > 0) pos++;
  }
  return pos / draws;
}
export function holm(ps, alpha = 0.10) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), ok = ps.map(() => false);
  for (let k = 0; k < idx.length; k++) { if (idx[k][0] <= alpha / (idx.length - k)) ok[idx[k][1]] = true; else break; }
  return ok;
}

const inWin = (ym, w) => ym >= w[0] && (w[1] == null || ym <= w[1]);
function winStats(daily, w) {
  const d = daily.filter((x) => inWin(x.ym, w)), m = monthly(d);
  const rs = m.map((x) => x.r), ann = rs.length ? (rs.reduce((g, r) => g * (1 + r), 1) ** (12 / rs.length) - 1) : null;
  return { months: rs.length, from: m[0]?.ym, to: m.at(-1)?.ym, sharpe: sharpe(rs), cagr: ann, maxDD: maxDD(d), rs };
}
const r4 = (x) => (x == null ? null : Math.round(x * 1e4) / 1e4);

// book: per day the mean of the markets' net daily returns over the union of days (a market with no bar that day adds 0:
// its move is in its next bar's return)
export function book(series) {
  const maps = series.map((s) => new Map(s.map((d) => [d.t, d]))), ts = [...new Set(series.flatMap((s) => s.map((d) => d.t)))].sort((a, b) => a - b);
  return ts.map((t) => ({ t, ym: ymOf(t), r: maps.reduce((a, m) => a + (m.get(t)?.r ?? 0), 0) / maps.length }));
}

export function runAll(barsBy, dgs2Series) {
  const dgs2 = dgs2Lookup(dgs2Series);
  const last = Math.min(...Object.values(barsBy).map((b) => b.at(-1).t));
  // decisive window ends with the last complete month (a month end exists in every market)
  const lastYm = Object.values(barsBy).map((b) => ymOf(b[monthEnds(b).at(-1)].t)).sort()[0];
  const dec = [P.dec[0], lastYm];
  const res = { variants: {}, markets: {}, dec, disc: P.disc };
  const sims = {};
  for (const v of ['B', 'V', 'S']) {
    sims[v] = {};
    for (const [k, bars] of Object.entries(barsBy)) {
      const pl = plan(bars, v), sim = simulate(bars, pl, dgs2);
      sims[v][k] = { c: pl.c, sim, pl };
    }
  }
  for (const [k] of Object.entries(barsBy)) {
    res.markets[k] = { name: MARKETS[k] };
    for (const v of ['B', 'V', 'S']) {
      const s = sims[v][k], D = winStats(s.sim.daily, dec), Q = winStats(s.sim.daily, P.disc);
      const ws = s.pl.months.filter((m) => inWin(m.ym, dec)).map((m) => m.w);
      res.markets[k][v] = { c: v === 'B' ? 1 : s.c, stops: s.sim.log.filter((x) => x.stoppedAt && inWin(x.ym, dec)).length,
        meanWeightDec: r4(ws.reduce((a, b) => a + b, 0) / ws.length), capShareDec: r4(ws.filter((w) => w >= P.cap - 1e-12).length / ws.length),
        dec: { months: D.months, sharpe: r4(D.sharpe), cagr: r4(D.cagr), maxDD: r4(D.maxDD) },
        disc: { months: Q.months, sharpe: r4(Q.sharpe), cagr: r4(Q.cagr), maxDD: r4(Q.maxDD) } };
    }
  }
  const bk = {}; for (const v of ['B', 'V', 'S']) bk[v] = book(Object.keys(barsBy).map((k) => sims[v][k].sim.daily));
  const bD = winStats(bk.B, dec), bQ = winStats(bk.B, P.disc);
  res.book = { B: { dec: { months: bD.months, from: bD.from, to: bD.to, sharpe: r4(bD.sharpe), cagr: r4(bD.cagr), maxDD: r4(bD.maxDD) },
    disc: { months: bQ.months, from: bQ.from, to: bQ.to, sharpe: r4(bQ.sharpe), cagr: r4(bQ.cagr), maxDD: r4(bQ.maxDD) } } };
  const ps = [];
  for (const v of ['V', 'S']) {
    const D = winStats(bk[v], dec), Q = winStats(bk[v], P.disc);
    if (D.months !== bD.months) throw new Error('month mismatch');
    const P_ = bootP(D.rs, bD.rs);
    res.book[v] = { dec: { months: D.months, sharpe: r4(D.sharpe), cagr: r4(D.cagr), maxDD: r4(D.maxDD) },
      disc: { months: Q.months, sharpe: r4(Q.sharpe), cagr: r4(Q.cagr), maxDD: r4(Q.maxDD) },
      dSharpeDec: r4(D.sharpe - bD.sharpe), dSharpeDisc: r4(Q.sharpe - bQ.sharpe), bootP: r4(P_),
      ddNotDeeper: D.maxDD >= bD.maxDD };
    ps.push(1 - P_);
  }
  const hk = holm(ps);
  ['V', 'S'].forEach((v, i) => {
    const x = res.book[v];
    x.checks = { dSharpePos: x.dSharpeDec > 0, bootP09: x.bootP >= 0.9, holm: hk[i] && x.bootP >= 0.9, ddNotDeeper: x.ddNotDeeper, discSameSign: x.dSharpeDisc > 0 };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  res.fallbackDays = Math.max(...Object.values(sims.V).map((s) => s.sim.fallbackDays));
  res.verdict = res.book.V.pass || res.book.S.pass ? 'PASS' : 'FAIL';
  res.lastBar = dateOf(last);
  return res;
}

const pct = (x, d = 1) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)} %`);
const f2 = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x.toFixed(2)}`);
const VN = { B: 'Benchmark (weight 1)', V: 'V: c / variance', S: 'S: c / volatility' };

export function report(res) {
  const L = [], b = res.book, yes = (x) => (x ? 'met' : '**not met**');
  const why = (v) => Object.entries(b[v].checks).filter(([, ok]) => !ok).map(([k]) => k).join(', ') || 'none';
  L.push('# Result: volatility-managed exposure on US index CFDs (13 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}** on the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). ` +
    `Equal-weight book of S&P 500, Nasdaq 100 and Dow 30, decisive window ${res.dec[0]} to ${res.dec[1]} (${b.B.dec.months} months): ` +
    `variant V (c / variance) Sharpe ${f2(b.V.dec.sharpe)} against ${f2(b.B.dec.sharpe)} for holding (difference ${f2(b.V.dSharpeDec)}, bootstrap P ${b.V.bootP.toFixed(3)}); ` +
    `variant S (c / volatility) ${f2(b.S.dec.sharpe)} (difference ${f2(b.S.dSharpeDec)}, P ${b.S.bootP.toFixed(3)}). ` +
    (res.verdict === 'PASS' ? 'A paper-shadow proposal at most; nothing live changes.' : 'Not an edge; nothing live changes and no proposal is written.'), '');
  L.push('A stand-alone index allocation rule: not a test of the gold book (owner decision item 44 untouched). Net of a 0.03 % round-trip spread per unit traded and of financing at DGS2 + 2.5 % a year on the held notional; price returns only (no dividends), for the rule and the benchmark alike. Every position carries a 3 x ATR(20) daily catastrophe stop.', '');
  L.push('## The book (judged)', '');
  L.push('| Series | Window | Months | Sharpe | Return a year | Max drawdown |', '|---|---|---|---|---|---|');
  for (const v of ['B', 'V', 'S']) for (const [w, lab] of [['disc', '2008-15 (scaling)'], ['dec', `${res.dec[0]} to ${res.dec[1]}`]])
    L.push(`| ${VN[v]} | ${lab} | ${b[v][w].months} | ${f2(b[v][w].sharpe)} | ${pct(b[v][w].cagr)} | ${pct(b[v][w].maxDD)} |`);
  L.push('');
  L.push('| Check (book) | V | S |', '|---|---|---|');
  L.push(`| 1. decisive Sharpe difference > 0 | ${f2(b.V.dSharpeDec)} ${yes(b.V.checks.dSharpePos)} | ${f2(b.S.dSharpeDec)} ${yes(b.S.checks.dSharpePos)} |`);
  L.push(`| 2. paired 6-month block bootstrap P >= 0.9 (2,000 draws) | ${b.V.bootP.toFixed(3)} ${yes(b.V.checks.bootP09)} | ${b.S.bootP.toFixed(3)} ${yes(b.S.checks.bootP09)} |`);
  L.push(`| 2b. Holm over the two variants | ${yes(b.V.checks.holm)} | ${yes(b.S.checks.holm)} |`);
  L.push(`| 3. decisive max drawdown not deeper | ${pct(b.V.dec.maxDD)} vs ${pct(b.B.dec.maxDD)} ${yes(b.V.checks.ddNotDeeper)} | ${pct(b.S.dec.maxDD)} vs ${pct(b.B.dec.maxDD)} ${yes(b.S.checks.ddNotDeeper)} |`);
  L.push(`| 4. 2008-15 Sharpe difference > 0 | ${f2(b.V.dSharpeDisc)} ${yes(b.V.checks.discSameSign)} | ${f2(b.S.dSharpeDisc)} ${yes(b.S.checks.discSameSign)} |`);
  L.push(`| **Variant passes** | ${b.V.pass ? 'yes' : 'no'} (fails: ${why('V')}) | ${b.S.pass ? 'yes' : 'no'} (fails: ${why('S')}) |`, '');
  L.push('## The three markets (reported, not judged)', '');
  L.push('| Market | Series | c | Mean weight 2016+ | Months at the 2x cap | Stops 2016+ | Sharpe 2008-15 | Sharpe 2016+ | Return a year 2016+ | Max drawdown 2016+ |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, m] of Object.entries(res.markets)) for (const v of ['B', 'V', 'S']) {
    const x = m[v];
    L.push(`| ${m.name} | ${VN[v]} | ${v === 'B' ? '1' : x.c.toPrecision(4)} | ${x.meanWeightDec.toFixed(2)} | ${pct(x.capShareDec, 0)} | ${x.stops} | ${f2(x.disc.sharpe)} | ${f2(x.dec.sharpe)} | ${pct(x.dec.cagr)} | ${pct(x.dec.maxDD)} |`);
  }
  L.push('');
  L.push('## Notes', '');
  L.push(`- c is fitted on positions for January 2008 to December 2015 only (mean capped weight 1 there) and frozen; the mean weight after 2015 is whatever c gives.`);
  L.push(`- Data: OANDA mid daily candles, council-data \`research/daily/\` (weekend stubs folded into Monday), last bar ${res.lastBar}. DGS2 from council-data \`macro/cache.json\` (weekly, at least 7 days old); days from 2008 on the 3.0 % fallback: ${res.fallbackDays}.`);
  L.push('- Sharpe on monthly net returns without a risk-free rate (financing is already charged on the notional). The bootstrap resamples the rule and the benchmark months together.');
  L.push('- Not tested (pre-stated): other markets, look-backs, caps or stops, dividends. Any of them needs its own pre-registration.');
  L.push('- To repeat: `node research/edge/vol-managed/run.mjs fetch <dir>` then `node research/edge/vol-managed/run.mjs full <dir>`.', '');
  return L.join('\n');
}

function loadBars(dir, k) { return foldWeekend(JSON.parse(readFileSync(join(dir, `${k}.json`), 'utf8')).rows); }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  if (mode === 'fetch') {
    mkdirSync(dir, { recursive: true });
    for (const k of Object.keys(MARKETS)) writeFileSync(join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    writeFileSync(join(dir, 'macro-cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const barsBy = {}; for (const k of Object.keys(MARKETS)) barsBy[k] = loadBars(dir, k);
    let dgs = []; try { dgs = JSON.parse(readFileSync(join(dir, 'macro-cache.json'), 'utf8')).score.fred.DGS2; } catch { dgs = []; }
    const res = runAll(barsBy, dgs);
    const out = { study: 'vol-managed', title: 'Volatility-managed exposure on US index CFDs', built: '2026-11-13', params: P, ...res };
    writeFileSync(join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    writeFileSync(join(HERE, 'RESULT.md'), report(out));
    console.log(report(out));
  } else { console.error('unknown mode'); process.exit(2); }
}
