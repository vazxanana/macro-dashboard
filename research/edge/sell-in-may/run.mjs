// The Halloween effect on equity index CFDs (PREREGISTRATION.md, committed before this file).
// A stand-alone index allocation rule: nothing of the gold book, nothing live.
//   node research/edge/sell-in-may/run.mjs fetch <dir>   (git show from origin/council-data, no network)
//   node research/edge/sell-in-may/run.mjs full <dir>    (writes result.json and RESULT.md here)
// The candle fold, ATR, DGS2 lookup, Sharpe, drawdown and book helpers follow research/edge/vol-managed (same conventions;
// that study is on its own branch, so they are written out here rather than imported).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MARKETS = {
  spx500: { name: 'S&P 500', ccy: 'USD', spreadRT: 0.0003 },
  nas100: { name: 'Nasdaq 100', ccy: 'USD', spreadRT: 0.0003 },
  us30: { name: 'Dow 30', ccy: 'USD', spreadRT: 0.0003 },
  de40: { name: 'Germany 40', ccy: 'EUR', spreadRT: 0.0003 },
  uk100: { name: 'UK 100', ccy: 'GBP', spreadRT: 0.0003 },
  jp225: { name: 'Japan 225', ccy: 'JPY', spreadRT: 0.0005 },
  eu50: { name: 'Euro Stoxx 50', ccy: 'EUR', spreadRT: 0.0005 },
  fr40: { name: 'France 40', ccy: 'EUR', spreadRT: 0.0003 },
  au200: { name: 'Australia 200', ccy: 'AUD', spreadRT: 0.0005 },
};
// stated approximate yearly policy rates, % (PREREGISTRATION.md table); USD uses DGS2
export const RATES = {
  EUR: { 2007: 3.0, 2008: 3.0, 2009: 0.5, 2010: 0.25, 2011: 0.5, 2012: 0.1, 2013: 0, 2014: 0, 2015: -0.2, 2016: -0.35, 2017: -0.4, 2018: -0.4, 2019: -0.45, 2020: -0.5, 2021: -0.5, 2022: 0.25, 2023: 3.3, 2024: 3.7, 2025: 2.2, 2026: 2.0 },
  GBP: { 2007: 5.5, 2008: 4.7, 2009: 0.5, 2010: 0.5, 2011: 0.5, 2012: 0.5, 2013: 0.5, 2014: 0.5, 2015: 0.5, 2016: 0.4, 2017: 0.3, 2018: 0.6, 2019: 0.75, 2020: 0.2, 2021: 0.1, 2022: 1.5, 2023: 4.7, 2024: 5.1, 2025: 4.3, 2026: 3.9 },
  JPY: { 2007: 0.4, 2008: 0.4, 2009: 0.1, 2010: 0.1, 2011: 0.1, 2012: 0.1, 2013: 0.1, 2014: 0.1, 2015: 0.1, 2016: -0.1, 2017: -0.1, 2018: -0.1, 2019: -0.1, 2020: -0.1, 2021: -0.1, 2022: -0.1, 2023: -0.1, 2024: 0.1, 2025: 0.4, 2026: 0.6 },
  AUD: { 2007: 6.5, 2008: 6.7, 2009: 3.3, 2010: 4.4, 2011: 4.6, 2012: 3.9, 2013: 2.9, 2014: 2.5, 2015: 2.1, 2016: 1.6, 2017: 1.5, 2018: 1.5, 2019: 1.1, 2020: 0.3, 2021: 0.1, 2022: 1.5, 2023: 3.9, 2024: 4.35, 2025: 3.9, 2026: 3.6 },
};
export const P = {
  atrN: 20, stopAtr: 3, finAdd: 0.025, dgs2Default: 0.03, dgs2LagDays: 7,
  startYm: '2007-10', discPairs: [2008, 2015], decPairs: [2016, 2026],
  discBook: ['2008-01', '2015-12'], decBook: ['2016-01', null], tMin: 2,
};
const DAY = 86400;
export const ymOf = (t) => new Date(t * 1e3).toISOString().slice(0, 7);
const dateOf = (t) => new Date(t * 1e3).toISOString().slice(0, 10);

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
export function atrAt(bars, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].c; s += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); }
  return s / n;
}
// last bar of each calendar month that has a later bar (a complete month)
export function monthEnds(bars) {
  const ends = [];
  for (let i = 0; i < bars.length - 1; i++) if (ymOf(bars[i].t) !== ymOf(bars[i + 1].t)) ends.push(i);
  return ends;
}
// season boundaries: index -> 'oct' | 'apr' (the last trading day of October / April)
export function boundaries(bars) {
  const m = new Map();
  for (const e of monthEnds(bars)) { const mo = ymOf(bars[e].t).slice(5); if (mo === '10') m.set(e, 'oct'); else if (mo === '04') m.set(e, 'apr'); }
  return m;
}
export function dgs2Lookup(series, lag = P.dgs2LagDays) {
  const s = (series || []).map(([d, v]) => [Date.parse(d + 'T00:00:00Z') / 1e3, v / 100]).filter((x) => Number.isFinite(x[1])).sort((a, b) => a[0] - b[0]);
  return (t) => {
    const lim = t - lag * DAY; let lo = 0, hi = s.length - 1, ans = null;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m][0] <= lim) { ans = s[m][1]; lo = m + 1; } else hi = m - 1; }
    return ans;
  };
}
// annual financing rate (fraction) for a market on day t; counts fallback days in `stat`
export function rateFn(ccy, dgs2, stat = { fallback: 0 }) {
  return (t) => {
    let r;
    if (ccy === 'USD') { r = dgs2 ? dgs2(t) : null; if (r == null) { r = P.dgs2Default; if (ymOf(t) >= P.startYm) stat.fallback++; } }
    else { const y = new Date(t * 1e3).getUTCFullYear(), tab = RATES[ccy]; r = (tab[y] ?? tab[Math.min(...Object.keys(tab).map(Number).filter((k) => k >= y))] ?? tab[Math.max(...Object.keys(tab).map(Number))]) / 100; }
    return Math.max(r, 0) + P.finAdd;
  };
}
export const finCost = (rate, t0, t1) => rate * (t1 - t0) / DAY / 365;

// Daily simulation of the rule ('R') or the benchmark ('B') for one market. Returns [{ t, ym, r }] and a trade log.
export function simulate(bars, kind, rate, spreadRT, startYm = P.startYm) {
  const half = spreadRT / 2, bd = boundaries(bars), out = [], log = [];
  const start = [...bd].find(([e, s]) => s === 'oct' && ymOf(bars[e].t) >= startYm)?.[0];
  if (start == null) throw new Error('no October boundary to start from');
  let held = 0, stop = null, cur = null;
  const act = (i) => { // actions at the close of bar i; returns the cost paid
    const s = bd.get(i); if (!s) return 0;
    const b = bars[i], st = b.c - P.stopAtr * atrAt(bars, i);
    if (kind === 'R') {
      if (s === 'apr' && held) { held = 0; cur.exit = dateOf(b.t); cur.how = 'season'; return half; }
      if (s === 'oct' && !held) { held = 1; stop = st; cur = { entry: dateOf(b.t), px: b.c, stop: st }; log.push(cur); return half; }
      return 0;
    }
    if (held) { stop = st; return 0; } // benchmark: a new stop at each boundary, not a trade
    held = 1; stop = st; cur = { entry: dateOf(b.t), px: b.c, stop: st }; log.push(cur); return half;
  };
  out.push({ t: bars[start].t, ym: ymOf(bars[start].t), r: -act(start) });
  for (let i = start + 1; i < bars.length; i++) {
    const b = bars[i], pc = bars[i - 1].c; let r = 0;
    if (held) {
      const fin = finCost(rate(bars[i - 1].t), bars[i - 1].t, b.t);
      if (b.l <= stop) { const px = Math.min(b.o, stop); r = px / pc - 1 - half - fin; held = 0; cur.exit = dateOf(b.t); cur.how = 'stop'; cur.fill = px; }
      else r = b.c / pc - 1 - fin;
    }
    r -= act(i);
    out.push({ t: b.t, ym: ymOf(b.t), r });
  }
  return { daily: out, log };
}

// half-year returns of an unstopped long, net of financing: { [y]: { w, s } } for pairs with both halves in the data
export function halfYears(bars, rate) {
  const bd = [...boundaries(bars)].sort((a, b) => a[0] - b[0]), at = {};
  const ret = (a, z) => { let g = 1; for (let i = a + 1; i <= z; i++) g *= 1 + bars[i].c / bars[i - 1].c - 1 - finCost(rate(bars[i - 1].t), bars[i - 1].t, bars[i].t); return g - 1; };
  for (let k = 0; k + 2 < bd.length; k++) {
    const [o, so] = bd[k], [a, sa] = bd[k + 1], [z, sz] = bd[k + 2];
    if (so !== 'oct' || sa !== 'apr' || sz !== 'oct') continue;
    const y = Number(ymOf(bars[a].t).slice(0, 4));
    if (Number(ymOf(bars[o].t).slice(0, 4)) !== y - 1 || Number(ymOf(bars[z].t).slice(0, 4)) !== y) continue;
    at[y] = { w: ret(o, a), s: ret(a, z) };
  }
  return at;
}

export function tStat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, t: null };
  const mu = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
  return { n, mean: mu, sd, t: sd > 0 ? mu / (sd / Math.sqrt(n)) : null };
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
export function book(series) {
  const maps = series.map((s) => new Map(s.map((d) => [d.t, d]))), ts = [...new Set(series.flatMap((s) => s.map((d) => d.t)))].sort((a, b) => a - b);
  return ts.map((t) => ({ t, ym: ymOf(t), r: maps.reduce((a, m) => a + (m.get(t)?.r ?? 0), 0) / maps.length }));
}
const inWin = (ym, w) => ym >= w[0] && (w[1] == null || ym <= w[1]);
function winStats(daily, w) {
  const d = daily.filter((x) => inWin(x.ym, w)), m = monthly(d), rs = m.map((x) => x.r);
  const cagr = rs.length ? rs.reduce((g, r) => g * (1 + r), 1) ** (12 / rs.length) - 1 : null;
  return { months: rs.length, from: m[0]?.ym, to: m.at(-1)?.ym, sharpe: sharpe(rs), cagr, maxDD: maxDD(d) };
}
const r4 = (x) => (x == null ? null : Math.round(x * 1e4) / 1e4);
const sum4 = (s) => ({ months: s.months, from: s.from, to: s.to, sharpe: r4(s.sharpe), cagr: r4(s.cagr), maxDD: r4(s.maxDD) });

export function runAll(barsBy, dgs2Series) {
  const dgs2 = dgs2Lookup(dgs2Series), stat = { fallback: 0 };
  const lastYm = Object.values(barsBy).map((b) => ymOf(b[monthEnds(b).at(-1)].t)).sort()[0];
  const decBook = [P.decBook[0], lastYm];
  const res = { decBook, discBook: P.discBook, decPairs: P.decPairs, discPairs: P.discPairs, markets: {}, pairs: {} };
  const sims = { R: {}, B: {} }, hy = {};
  for (const [k, bars] of Object.entries(barsBy)) {
    const M = MARKETS[k], rate = rateFn(M.ccy, dgs2, M.ccy === 'USD' ? stat : { fallback: 0 });
    for (const kind of ['R', 'B']) sims[kind][k] = simulate(bars, kind, rate, M.spreadRT);
    hy[k] = halfYears(bars, rate);
  }
  const pairYears = (w) => { const ys = []; for (let y = w[0]; y <= w[1]; y++) ys.push(y); return ys; };
  const D = {};
  for (const y of pairYears([P.discPairs[0], P.decPairs[1]])) {
    const ds = Object.keys(barsBy).filter((k) => hy[k][y]).map((k) => hy[k][y].w - hy[k][y].s);
    if (ds.length) { D[y] = ds.reduce((a, b) => a + b, 0) / ds.length; res.pairs[y] = { D: r4(D[y]), markets: ds.length,
      winter: r4(Object.keys(barsBy).filter((k) => hy[k][y]).reduce((a, k) => a + hy[k][y].w, 0) / ds.length),
      summer: r4(Object.keys(barsBy).filter((k) => hy[k][y]).reduce((a, k) => a + hy[k][y].s, 0) / ds.length) }; }
  }
  const pooled = (w) => { const ys = pairYears(w).filter((y) => D[y] != null), t = tStat(ys.map((y) => D[y])); return { years: ys, n: t.n, mean: r4(t.mean), sd: r4(t.sd), t: r4(t.t), positive: ys.filter((y) => D[y] > 0).length }; };
  res.pooled = { dec: pooled(P.decPairs), disc: pooled(P.discPairs) };
  for (const [k] of Object.entries(barsBy)) {
    const per = (w) => { const ys = pairYears(w).filter((y) => hy[k][y]), ds = ys.map((y) => hy[k][y].w - hy[k][y].s), t = tStat(ds); return { n: t.n, mean: r4(t.mean), t: r4(t.t), positive: ds.filter((x) => x > 0).length }; };
    res.markets[k] = { name: MARKETS[k].name, ccy: MARKETS[k].ccy, spreadRT: MARKETS[k].spreadRT, d: { dec: per(P.decPairs), disc: per(P.discPairs) } };
    for (const kind of ['R', 'B']) {
      const s = sims[kind][k], stops = (w) => s.log.filter((x) => x.how === 'stop' && inWin(x.exit.slice(0, 7), w)).length;
      res.markets[k][kind] = { dec: { ...sum4(winStats(s.daily, decBook)), stops: stops(decBook) }, disc: { ...sum4(winStats(s.daily, P.discBook)), stops: stops(P.discBook) } };
    }
  }
  const bk = { R: book(Object.keys(barsBy).map((k) => sims.R[k].daily)), B: book(Object.keys(barsBy).map((k) => sims.B[k].daily)) };
  res.book = {};
  for (const kind of ['R', 'B']) res.book[kind] = { dec: sum4(winStats(bk[kind], decBook)), disc: sum4(winStats(bk[kind], P.discBook)) };
  const pd = res.pooled.dec;
  res.checks = { meanPositive: pd.mean > 0, t2: pd.t != null && pd.t >= P.tMin, sharpeNotLower: res.book.R.dec.sharpe >= res.book.B.dec.sharpe };
  res.verdict = Object.values(res.checks).every(Boolean) ? 'PASS' : 'FAIL';
  res.dgs2FallbackDays = stat.fallback;
  res.lastBar = dateOf(Math.min(...Object.values(barsBy).map((b) => b.at(-1).t)));
  return res;
}

const pct = (x, d = 1) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)} %`);
const f2 = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x.toFixed(2)}`);

export function report(res) {
  const L = [], b = res.book, pd = res.pooled.dec, pq = res.pooled.disc, yes = (x) => (x ? 'met' : '**not met**');
  L.push('# Result: the Halloween effect on equity index CFDs (13 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}** on the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). ` +
    `Nine index CFDs, decisive pairs ${pd.years[0]}-${pd.years.at(-1)} (n ${pd.n}): November-April minus May-October, pooled equal-weight, ` +
    `mean ${pct(pd.mean, 2)} a year, t ${f2(pd.t)} (${pd.positive} of ${pd.n} years positive). ` +
    `The winter-only book's Sharpe ${f2(b.R.dec.sharpe)} against ${f2(b.B.dec.sharpe)} for holding (${res.decBook[0]} to ${res.decBook[1]}). ` +
    (res.verdict === 'PASS' ? 'A paper-shadow proposal at most; nothing live changes.' : 'Not an edge; nothing live changes and no proposal is written.'), '');
  L.push('A stand-alone index allocation rule, not a test of the gold book (owner decision item 44 untouched). Price returns only (no dividends), each market in its own currency. Net of a stated spread per entry and exit and of financing on the held notional (DGS2 + 2.5 % for the US indices, a stated local policy rate + 2.5 % for the others, floored at 2.5 %). Every position carries a 3 x ATR(20) catastrophe stop.', '');
  L.push('## The test (judged)', '');
  L.push('| Check | Value | |', '|---|---|---|');
  L.push(`| 1a. pooled decisive mean (winter - summer) > 0 | ${pct(pd.mean, 2)} (sd ${pct(pd.sd, 2)}, n ${pd.n}) | ${yes(res.checks.meanPositive)} |`);
  L.push(`| 1b. its t >= 2 | ${f2(pd.t)} | ${yes(res.checks.t2)} |`);
  L.push(`| 2. winter-only book Sharpe >= holding's, ${res.decBook[0]} to ${res.decBook[1]} | ${f2(b.R.dec.sharpe)} vs ${f2(b.B.dec.sharpe)} | ${yes(res.checks.sharpeNotLower)} |`, '');
  L.push(`Discovery pairs ${pq.years[0]}-${pq.years.at(-1)} (reported, not judged): mean ${pct(pq.mean, 2)}, t ${f2(pq.t)}, ${pq.positive} of ${pq.n} positive.`, '');
  L.push('## Year by year (pooled, net of financing, unstopped)', '');
  L.push('| Pair | Winter (Nov-Apr) | Summer (May-Oct) | Winter - summer | Markets |', '|---|---|---|---|---|');
  for (const [y, p] of Object.entries(res.pairs)) L.push(`| ${y}${y >= res.decPairs[0] ? '' : ' (discovery)'} | ${pct(p.winter)} | ${pct(p.summer)} | ${pct(p.D)} | ${p.markets} |`);
  L.push('', '## The books', '');
  L.push('| Book | Window | Months | Sharpe | Return a year | Max drawdown |', '|---|---|---|---|---|---|');
  for (const [kind, lab] of [['R', 'Winter only (rule)'], ['B', 'Always long (benchmark)']]) for (const w of ['disc', 'dec'])
    L.push(`| ${lab} | ${b[kind][w].from} to ${b[kind][w].to} | ${b[kind][w].months} | ${f2(b[kind][w].sharpe)} | ${pct(b[kind][w].cagr)} | ${pct(b[kind][w].maxDD)} |`);
  L.push('', '## The nine markets (reported, not judged)', '');
  L.push('| Market | Winter - summer, decisive (mean, t, positive) | Same, discovery | Rule Sharpe dec | Holding Sharpe dec | Rule return a year dec | Holding return a year dec | Rule max DD dec | Holding max DD dec | Stops dec (rule / holding) |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [, m] of Object.entries(res.markets)) {
    const dd = m.d.dec, dq = m.d.disc;
    L.push(`| ${m.name} | ${pct(dd.mean)}, t ${f2(dd.t)}, ${dd.positive}/${dd.n} | ${pct(dq.mean)}, t ${f2(dq.t)}, ${dq.positive}/${dq.n} | ${f2(m.R.dec.sharpe)} | ${f2(m.B.dec.sharpe)} | ${pct(m.R.dec.cagr)} | ${pct(m.B.dec.cagr)} | ${pct(m.R.dec.maxDD)} | ${pct(m.B.dec.maxDD)} | ${m.R.dec.stops} / ${m.B.dec.stops} |`);
  }
  L.push('', '## Notes', '');
  L.push(`- Data: OANDA mid daily candles, council-data \`research/daily/\` (weekend candles folded into Monday), all nine files present, last bar ${res.lastBar}. DGS2 from council-data \`macro/cache.json\` (weekly, at least 7 days old); US index rate lookups from October 2007 on that used the 3.0 % fallback: ${res.dgs2FallbackDays}. The non-US policy rates are the stated yearly approximations of the pre-registration.`);
  L.push('- Pair y = winter November y-1 to April y, then summer May to October y. Entry and exit at the closes of the last trading days of October and April.');
  L.push('- Sharpe on monthly net returns without a risk-free rate (financing is already charged on the notional; a flat month is 0). The books are the daily mean of the nine markets\' net returns.');
  L.push('- Not tested (pre-stated): other seasons or entry days, other stops, short summers, other markets, dividends, currency-hedged returns.');
  L.push('- To repeat: `node research/edge/sell-in-may/run.mjs fetch <dir>` then `node research/edge/sell-in-may/run.mjs full <dir>`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  if (mode === 'fetch') {
    mkdirSync(dir, { recursive: true });
    for (const k of Object.keys(MARKETS)) writeFileSync(join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    writeFileSync(join(dir, 'macro-cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const barsBy = {};
    for (const k of Object.keys(MARKETS)) {
      const f = join(dir, `${k}.json`);
      if (!existsSync(f)) throw new Error(`missing ${f}: the pre-registration names nine markets; the run stops`);
      barsBy[k] = foldWeekend(JSON.parse(readFileSync(f, 'utf8')).rows);
    }
    let dgs = []; try { dgs = JSON.parse(readFileSync(join(dir, 'macro-cache.json'), 'utf8')).score.fred.DGS2; } catch { dgs = []; }
    const res = runAll(barsBy, dgs);
    const out = { study: 'sell-in-may', title: 'The Halloween effect on equity index CFDs', built: '2026-11-13', params: P, rates: RATES, ...res };
    writeFileSync(join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    writeFileSync(join(HERE, 'RESULT.md'), report(out));
    console.log(report(out));
  } else { console.error('unknown mode'); process.exit(2); }
}
