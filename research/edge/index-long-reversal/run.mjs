// Long-term reversal across national stock indices (research/edge/index-long-reversal/PREREGISTRATION.md, committed first).
// Research only: nothing here is read by the council, the mirror or any page; no order code.
//   node research/edge/index-long-reversal/run.mjs fetch <dir>   copies council-data research/daily/<key>.json of the 17 index
//                                                                keys and macro/cache.json into <dir> (outside git); git show
//                                                                from origin/council-data, no network
//   node research/edge/index-long-reversal/run.mjs full <dir>    writes result.json and RESULT.md next to this file
// ATR, the DGS2 as-of lookup and the per-night financing are copied from research/edge/dual-momentum/run.mjs (branch
// dual-momentum, not imported across branches); weekend folding and the rollover count come from council/fills.mjs (main).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- the pre-registered constants ----
export const KEYS = ['au200', 'ch20', 'cn50', 'de40', 'es35', 'eu50', 'fr40', 'hk33', 'in50', 'jp225', 'nas100', 'nl25', 'sg30', 'spx500', 'uk100', 'us2000', 'us30'];
export const P = { L: 36, skip: 1, nLong: 3, nShort: 3, minRanked: 6, hold: 12, atrN: 20, atrK: 3, staleDays: 7 };
export const VARIANTS = [12, 60];
export const COST = { roundTrip: 0.0004, markup: 0.025, fallbackRate: 4 }; // 0.04 % of price a leg; DGS2 + 2.5 %; 4 % before DGS2
export const WIN = { decFrom: '2016-01', repTo: '2015-12', minRankedRep: 10 };
export const BAR = { minT: 2, nwLags: 12, placeboPct: 0.95 };
export const PLACEBO = { draws: 40, seed: 20261114 };
export const SCALES = [0, 1, 2];

const DAY = 86400;
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r4 = (x) => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : null);

// month index (year * 12 + month0) of a unix time, and its label
export const monthOf = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export const monthLabel = (m) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
export const monthFrom = (s) => { const [y, mo] = s.split('-').map(Number); return y * 12 + mo - 1; };
// unix time of the first second of the month after m
const monthEndT = (m) => Date.UTC(Math.floor((m + 1) / 12), (m + 1) % 12, 1) / 1000;

// candle file rows [t, o, h, l, c, v] -> trading-day bars (weekend stubs folded into the next weekday)
export function barsOf(file) {
  return foldWeekend(file.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
}
// month -> index of the market's last candle of that month
export function monthEnds(bars) {
  const m = new Map();
  bars.forEach((b, i) => m.set(monthOf(b.time), i));
  return m;
}
// mean true range of the n candles ending at i (copied from dual-momentum)
export function atrAt(bars, i, n = P.atrN) {
  if (i < n) return null;
  let tr = 0;
  for (let k = i - n + 1; k <= i; k++) tr += Math.max(bars[k].high - bars[k].low, Math.abs(bars[k].high - bars[k - 1].close), Math.abs(bars[k].low - bars[k - 1].close));
  return tr / n;
}

// the markets ranked at the end of month m with lookback L (months), skipping the last month; reads month-end closes at or
// before the end of month m only. Returns [{ key, score }] ascending by score (ties by key).
export function rankAt(D, m, L = P.L) {
  const out = [];
  for (const key of Object.keys(D).sort()) {
    const { bars, ends } = D[key];
    const i = ends.get(m), a = ends.get(m - P.skip), b = ends.get(m - P.skip - L);
    if (i == null || a == null || b == null) continue;
    if (bars[i].time < monthEndT(m) - P.staleDays * DAY) continue; // stale month end
    out.push({ key, score: bars[a].close / bars[b].close - 1 });
  }
  return out.sort((x, y) => x.score - y.score || (x.key < y.key ? -1 : 1));
}

// as-of lookup in a sorted [[YYYY-MM-DD, value]] list (copied from dual-momentum)
export function asOfRate(list) {
  const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  return (t) => {
    const d = day(t); let lo = 0, hi = list.length - 1, v = null;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid][0] <= d) { v = list[mid][1]; lo = mid + 1; } else hi = mid - 1; }
    return v;
  };
}
// financing a night as a share of price: (max(0, DGS2) + 2.5 %) / 365; a fixed 4 % before the first DGS2 value
export function nightRate(dgs2) {
  return (t) => { const v = dgs2(t); return (Math.max(0, v == null ? COST.fallbackRate : v) / 100 + COST.markup) / 365; };
}

// one leg of a cohort formed at the end of month m: entry at the open of the market's next candle, 1R = 3 x ATR(20) at the
// month-m candle, stop 1R from the entry (gap fills at the open), out at the close of the last candle of month m + 12
// (or at the file's last close when the file ends before that and before `lastT`). Returns null when not entered, else
// { key, dir, m, entry, R, stop, exitPx, exitT, why, months: Map(month -> { g, spr, fin }) }.
export function legOf(D, key, m, dir, rate, lastT) {
  const { bars, ends } = D[key];
  const i = ends.get(m); if (i == null) return null;
  const e = i + 1; if (e >= bars.length) return null;
  const atr = atrAt(bars, i); if (!(atr > 0)) return null;
  const R = P.atrK * atr, entry = bars[e].open, stop = entry - dir * R, end = m + P.hold;
  const months = new Map(), add = (mm, f, v) => { const o = months.get(mm) || { g: 0, spr: 0, fin: 0 }; o[f] += v; months.set(mm, o); };
  add(monthOf(bars[e].time), 'spr', (COST.roundTrip / 2) * entry / R);
  let ref = entry;
  for (let k = e; k < bars.length; k++) {
    const b = bars[k], mk = monthOf(b.time);
    let px = null, why = null;
    if (k > e && dir * (b.open - stop) <= 0) { px = b.open; why = 'stop-gap'; }
    else if (dir > 0 ? b.low <= stop : b.high >= stop) { px = stop; why = 'stop'; }
    if (px == null) {
      const lastOfEnd = k + 1 < bars.length && monthOf(bars[k + 1].time) > end;
      const fileEnds = k + 1 >= bars.length;
      if (lastOfEnd) { px = b.close; why = 'time'; }
      else if (fileEnds && b.time < lastT - 10 * DAY) { px = b.close; why = 'data-end'; }
      else if (fileEnds) { add(mk, 'g', dir * (b.close - ref) / R); return { key, dir, m, entry, R, stop, exitPx: null, exitT: null, why: 'open', months }; }
    }
    if (px != null) {
      add(mk, 'g', dir * (px - ref) / R);
      add(mk, 'spr', (COST.roundTrip / 2) * px / R);
      return { key, dir, m, entry, R, stop, exitPx: px, exitT: b.time, why, months };
    }
    add(mk, 'g', dir * (b.close - ref) / R);
    add(mk, 'fin', nights(b.time, bars[k + 1].time) * rate(b.time) * b.close / R);
    ref = b.close;
  }
  return null;
}

// a seeded generator (mulberry32) and a Fisher-Yates shuffle
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(xs, rnd) {
  const a = xs.slice();
  for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
  return a;
}

// every cohort: formation months mFrom..mTo; order(list, m) may reorder the ranked list (placebo). Legs memoised in `memo`.
export function cohortsOf(D, { L = P.L, mFrom, mTo, rate, lastT, order = null, memo = new Map() }) {
  const out = [];
  for (let m = mFrom; m <= mTo; m++) {
    let list = rankAt(D, m, L);
    if (list.length < P.minRanked) continue;
    if (order) list = order(list, m);
    const pick = [...list.slice(0, P.nLong).map((x) => [x.key, 1]), ...list.slice(-P.nShort).map((x) => [x.key, -1])];
    const legs = [], missing = [];
    for (const [key, dir] of pick) {
      const id = `${key}|${m}|${dir}`;
      if (!memo.has(id)) memo.set(id, legOf(D, key, m, dir, rate, lastT));
      const lg = memo.get(id);
      if (lg) legs.push(lg); else missing.push(key);
    }
    out.push({ m, ranked: list.length, longs: pick.slice(0, P.nLong).map((x) => x[0]), shorts: pick.slice(-P.nShort).map((x) => x[0]), legs, missing });
  }
  return out;
}

// the book's monthly R for months bFrom..bTo: mean of the live cohorts' R (a cohort = mean of its entered legs' R that month)
// at cost scale c. Rows { m, n (live cohorts), g, spr, fin, net }; `attr` (optional Map) collects each leg's share of the
// book's net R by `key|side`.
export function bookOf(cohorts, bFrom, bTo, c = 1, attr = null) {
  const rows = [];
  for (let M = bFrom; M <= bTo; M++) {
    const live = cohorts.filter((h) => h.m < M && M <= h.m + P.hold && h.legs.length);
    if (!live.length) continue;
    let g = 0, spr = 0, fin = 0;
    for (const h of live) {
      for (const lg of h.legs) {
        const o = lg.months.get(M); if (!o) continue;
        const w = 1 / h.legs.length / live.length;
        g += w * o.g; spr += w * o.spr; fin += w * o.fin;
        if (attr) { const k = `${lg.key}|${lg.dir > 0 ? 'long' : 'short'}`; attr.set(k, (attr.get(k) || 0) + w * (o.g - c * (o.spr + o.fin))); }
      }
    }
    rows.push({ m: M, n: live.length, g, spr, fin, net: g - c * (spr + fin) });
  }
  return rows;
}

// Newey-West t of a mean (Bartlett kernel, `lags` lags)
export function nwT(xs, lags = BAR.nwLags) {
  const n = xs.length; if (n < 3) return null;
  const mu = xs.reduce((a, b) => a + b, 0) / n, d = xs.map((x) => x - mu);
  const gam = (l) => { let s = 0; for (let k = l; k < n; k++) s += d[k] * d[k - l]; return s / n; };
  let lrv = gam(0);
  for (let l = 1; l <= Math.min(lags, n - 1); l++) lrv += 2 * (1 - l / (lags + 1)) * gam(l);
  return lrv > 0 ? mu / Math.sqrt(lrv / n) : null;
}
// statistics of a month series
export function statsOf(rows, f = 'net') {
  const xs = rows.map((r) => r[f]), n = xs.length;
  if (!n) return { months: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  let cum = 0, peak = 0, dd = 0;
  for (const x of xs) { cum += x; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { months: n, mean, sd, total: cum, tNW: nwT(xs), tPlain: sd > 0 ? mean / (sd / Math.sqrt(n)) : null, posShare: xs.filter((x) => x > 0).length / n, maxDD: dd, years: n / 12 };
}
const pct = (xs, p) => { const a = xs.slice().sort((x, y) => x - y), k = (a.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return a[lo] + (a[hi] - a[lo]) * (k - lo); };

// ---- the whole study on loaded data ----
export function study(D, dgsList, opts = {}) {
  const rate = nightRate(asOfRate(dgsList || []));
  let lastT = 0, firstM = Infinity;
  for (const k of Object.keys(D)) { const b = D[k].bars; lastT = Math.max(lastT, b[b.length - 1].time); firstM = Math.min(firstM, monthOf(b[0].time)); }
  const lastM = monthOf(lastT) - 1; // the last complete month
  const decFrom = monthFrom(WIN.decFrom), repTo = monthFrom(WIN.repTo);
  const run = (L, order, memo) => cohortsOf(D, { L, mFrom: firstM, mTo: lastM, rate, lastT, order, memo });
  const firstTen = (L) => { for (let m = firstM; m <= lastM; m++) if (rankAt(D, m, L).length >= WIN.minRankedRep) return m; return null; };

  const one = (L) => {
    const memo = new Map(), C = run(L, null, memo), ften = firstTen(L), repFrom = ften + 1;
    const win = (from, to, c = 1, attr = null) => bookOf(C, from, to, c, attr);
    const dec = {}, rep = {};
    for (const c of SCALES) { dec[c] = statsOf(win(decFrom, lastM, c)); rep[c] = statsOf(win(repFrom, repTo, c)); }
    const decRows = win(decFrom, lastM), repRows = win(repFrom, repTo);
    return { L, C, memo, ften, repFrom, dec, rep, decRows, repRows, gross: { dec: statsOf(decRows, 'g'), rep: statsOf(repRows, 'g') } };
  };
  const main = one(P.L);
  const variants = VARIANTS.map(one);

  // placebo: random order of the ranked markets each month, same everything else, decisive mean net R a month
  const draws = [];
  if (!opts.noPlacebo) {
    for (let d = 0; d < PLACEBO.draws; d++) {
      const rnd = mulberry32(PLACEBO.seed + d);
      const C = run(P.L, (list) => shuffle(list, rnd), main.memo);
      draws.push(statsOf(bookOf(C, decFrom, lastM)).mean);
    }
  }
  const attr = new Map(); bookOf(main.C, decFrom, lastM, 1, attr);
  const attrRep = new Map(); bookOf(main.C, main.repFrom, repTo, 1, attrRep);
  return { lastM, decFrom, repTo, main, variants, draws, attr, attrRep, lastT };
}

// pass checks of the judged test
export function verdictOf(S) {
  const d = S.main.dec[1], r = S.main.rep[1], p95 = S.draws.length ? pct(S.draws, BAR.placeboPct) : null;
  const checks = {
    decPositive: d.mean > 0, repPositive: r.mean > 0, tNW: d.tNW >= BAR.minT, placebo: p95 != null && d.mean > p95,
  };
  return { checks, p95, pass: Object.values(checks).every(Boolean) };
}

// legs whose formation month's book months fall in [from, to]: counts by exit reason and their summed net R per leg
function legSummary(C, from, to) {
  const legs = C.filter((h) => h.m + 1 >= from && h.m + 1 <= to).flatMap((h) => h.legs);
  const why = {};
  for (const lg of legs) why[lg.why] = (why[lg.why] || 0) + 1;
  const missing = C.filter((h) => h.m + 1 >= from && h.m + 1 <= to).reduce((a, h) => a + h.missing.length, 0);
  return { legs: legs.length, why, notEntered: missing };
}

// ---- result.json and RESULT.md ----
export function report(S) {
  const V = verdictOf(S), M = S.main, rows = M.decRows;
  const sOut = (s) => ({ months: s.months, mean: r4(s.mean), sd: r4(s.sd), total: r2(s.total), tNW: r2(s.tNW), tPlain: r2(s.tPlain), posShare: r3(s.posShare), maxDD: r2(s.maxDD), years: r2(s.years) });
  const years = {};
  for (const r of [...M.repRows, ...rows]) { const y = Math.floor(r.m / 12); (years[y] ||= { months: 0, net: 0, g: 0 }); years[y].months++; years[y].net += r.net; years[y].g += r.g; }
  const attrList = (A) => [...A.entries()].map(([k, v]) => { const [key, side] = k.split('|'); return { key, side, net: r2(v) }; }).sort((a, b) => b.net - a.net);
  const costShare = (rs) => ({ spread: r4(rs.reduce((a, r) => a + r.spr, 0) / rs.length), financing: r4(rs.reduce((a, r) => a + r.fin, 0) / rs.length) });
  const picks = {};
  for (const h of M.C.filter((h) => h.m + 1 >= S.decFrom && h.m + 1 <= S.lastM)) {
    for (const k of h.longs) (picks[k] ||= { long: 0, short: 0 }).long++;
    for (const k of h.shorts) (picks[k] ||= { long: 0, short: 0 }).short++;
  }
  const out = {
    study: 'index-long-reversal',
    built: '2026-11-14',
    verdict: V.pass ? 'PASS' : 'FAIL',
    statement: V.pass
      ? 'Long-term reversal across national indices passes the pre-registered bar.'
      : `Buying the three national indices with the worst 36-month return and shorting the three best is not an edge after costs (decisive 2016-now ${r3(M.dec[1].mean)}R a month, Newey-West t ${r2(M.dec[1].tNW)}).`,
    claim: 'Balvers, Wu & Gilliland (2000); Richards (1997): past 3-year losers among national indices beat past winners over the next year.',
    params: { ...P, cost: COST, windows: WIN, bar: BAR, placebo: PLACEBO, financing: '(max(0, DGS2) + 2.5 %) / 365 of the close a rollover night, longs and shorts alike; 4 % before the first DGS2 value', dgs2: 'council-data macro/cache.json score.fred.DGS2' },
    universe: S.universe,
    windows: { decisive: { from: monthLabel(S.decFrom), to: monthLabel(S.lastM) }, replication: { firstTenRanked: monthLabel(M.ften), from: monthLabel(M.repFrom), to: monthLabel(S.repTo) } },
    checks: V.checks,
    main: {
      decisive: Object.fromEntries(SCALES.map((c) => [`x${c}`, sOut(M.dec[c])])),
      replication: Object.fromEntries(SCALES.map((c) => [`x${c}`, sOut(M.rep[c])])),
      costPerMonth: { decisive: costShare(rows), replication: costShare(M.repRows) },
      liveCohorts: { decisiveMin: Math.min(...rows.map((r) => r.n)), decisiveMax: Math.max(...rows.map((r) => r.n)) },
      legs: { decisive: legSummary(M.C, S.decFrom, S.lastM), replication: legSummary(M.C, M.repFrom, S.repTo) },
      independentYears: { decisive: r2(rows.length / 12), replication: r2(M.repRows.length / 12) },
    },
    perYear: Object.entries(years).map(([y, v]) => ({ year: +y, months: v.months, net: r2(v.net), gross: r2(v.g) })),
    drivers: { decisive: attrList(S.attr), replication: attrList(S.attrRep) },
    picks: { decisive: picks },
    variants: S.variants.map((v) => ({
      lookback: v.L, firstTenRanked: monthLabel(v.ften), replicationFrom: monthLabel(v.repFrom),
      decisive: sOut(v.dec[1]), replication: sOut(v.rep[1]), decisiveGross: sOut(v.gross.dec),
    })),
    placebo: {
      draws: S.draws.length, seed: PLACEBO.seed, real: r4(M.dec[1].mean), p95: r4(V.p95), median: S.draws.length ? r4(pct(S.draws, 0.5)) : null,
      p5: S.draws.length ? r4(pct(S.draws, 0.05)) : null, atOrAbove: S.draws.filter((x) => x >= M.dec[1].mean).length,
    },
  };
  return { json: out, md: mdOf(out) };
}

function mdOf(o) {
  const m = o.main, d = m.decisive, r = m.replication, ck = o.checks, yn = (b) => (b ? 'yes' : 'no');
  const row = (name, s) => `| ${name} | ${s.months} | ${s.mean} | ${s.tNW} | ${s.tPlain} | ${s.total} | ${s.maxDD} | ${Math.round(s.posShare * 100)} % |`;
  const top = (list, n) => list.slice(0, n).map((x) => `${x.key} ${x.side} ${x.net > 0 ? '+' : ''}${x.net}R`).join(', ');
  const bot = (list, n) => list.slice(-n).reverse().map((x) => `${x.key} ${x.side} ${x.net > 0 ? '+' : ''}${x.net}R`).join(', ');
  const L = [];
  L.push('# Result: long-term reversal across national stock indices (14 Nov 2026)', '');
  L.push(`**Verdict: ${o.verdict}.** ${o.statement} Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Paper research only; nothing live changed.`, '');
  L.push(`Claim: ${o.claim} Related: \`dual-momentum\` and \`index-spread-momentum\` (both FAIL, branches of the same names) tested MOMENTUM; this tests the opposite, LONG-TERM REVERSAL across ${o.universe.length} national index CFDs.`, '');
  L.push(`Data: OANDA mid daily candles of ${o.universe.map((u) => u.key).join(', ')} (council-data research/daily/*.json, weekend stubs folded with \`foldWeekend\`). Each CFD is quoted in its own currency (JP225, CN50, IN50 in US dollars, the rest local); currency moves are not hedged or converted, and each leg's R is its price move over its own 1R (3 x ATR(20) of the same series), so legs are comparable in R. Price indices, no dividends. DGS2 from council-data macro/cache.json \`score.fred.DGS2\` (weekly, as-of), a fixed 4 % before its first value (2006-01).`, '');
  L.push(`Rule: at each month end rank the markets with a fresh month-end close and 37 months of month-end history by close(m-1) / close(m-37) - 1; long the bottom 3, short the top 3 at the next open, 1R = 3 x ATR(20), stop 1R from the entry (gap fills at the open; a stopped leg is flat for the rest of its cohort), out at the close of month m+12; 12 overlapping cohorts; book R a month = mean of the live cohorts' mean leg R. Costs: 0.04 % of price a leg round trip, plus financing (DGS2 + 2.5 %) / 365 a rollover night on longs and shorts alike.`, '');
  L.push('## Main test (36-month lookback, skip one month)', '');
  L.push('| Window, cost | Months | Mean R a month | NW t (12 lags) | Plain t | Total R | Worst drawdown R | Months up |', '|---|---|---|---|---|---|---|---|');
  L.push(row(`**Decisive ${o.windows.decisive.from} to ${o.windows.decisive.to}, net (1x)**`, d.x1));
  L.push(row('Decisive, gross (0x)', d.x0));
  L.push(row('Decisive, 2x costs', d.x2));
  L.push(row(`**Replication ${o.windows.replication.from} to ${o.windows.replication.to}, net (1x)**`, r.x1));
  L.push(row('Replication, gross (0x)', r.x0));
  L.push(row('Replication, 2x costs', r.x2), '');
  L.push(`Costs a month (base): decisive spread ${m.costPerMonth.decisive.spread}R + financing ${m.costPerMonth.decisive.financing}R; replication spread ${m.costPerMonth.replication.spread}R + financing ${m.costPerMonth.replication.financing}R. Live cohorts a decisive month: ${m.liveCohorts.decisiveMin} to ${m.liveCohorts.decisiveMax}. First month end with 10 or more ranked markets: ${o.windows.replication.firstTenRanked}.`, '');
  L.push('## Against the bar', '');
  L.push(`- Decisive mean net R a month > 0: ${yn(ck.decPositive)} (${d.x1.mean}).`);
  L.push(`- Replication mean net R a month > 0: ${yn(ck.repPositive)} (${r.x1.mean}).`);
  L.push(`- Decisive Newey-West t >= 2: ${yn(ck.tNW)} (${d.x1.tNW}).`);
  L.push(`- Above the placebo's 95th percentile: ${yn(ck.placebo)} (${o.placebo.real} against ${o.placebo.p95}).`, '');
  L.push(`## Placebo (random order of the ranked markets each month, same construction and costs; decisive window, ${o.placebo.draws} seeded draws)`, '');
  L.push('| Real mean net R a month | Draws median | 5th pct | 95th pct | Draws at or above the real |', '|---|---|---|---|---|');
  L.push(`| ${o.placebo.real} | ${o.placebo.median} | ${o.placebo.p5} | ${o.placebo.p95} | ${o.placebo.atOrAbove} of ${o.placebo.draws} |`, '');
  L.push('## Per year (book R summed over the year\'s months, net at 1x and gross)', '');
  L.push('| Year | Months | Net R | Gross R |', '|---|---|---|---|');
  for (const y of o.perYear) L.push(`| ${y.year} | ${y.months} | ${y.net} | ${y.gross} |`);
  L.push('');
  L.push('## Which markets drive it (each leg\'s share of the book\'s net R, base costs)', '');
  L.push(`- Decisive, largest contributions: ${top(o.drivers.decisive, 5)}.`);
  L.push(`- Decisive, largest drags: ${bot(o.drivers.decisive, 5)}.`);
  L.push(`- Replication, largest contributions: ${top(o.drivers.replication, 5)}; largest drags: ${bot(o.drivers.replication, 5)}.`);
  const pk = Object.entries(o.picks.decisive).sort((a, b) => (b[1].long + b[1].short) - (a[1].long + a[1].short)).map(([k, v]) => `${k} ${v.long} long / ${v.short} short`).join('; ');
  L.push(`- Times picked in the decisive cohorts: ${pk}.`);
  const lw = (x) => Object.entries(x.why).map(([k, v]) => `${k} ${v}`).join(', ');
  L.push(`- Legs: decisive ${m.legs.decisive.legs} (${lw(m.legs.decisive)}; ${m.legs.decisive.notEntered} not entered); replication ${m.legs.replication.legs} (${lw(m.legs.replication)}; ${m.legs.replication.notEntered} not entered).`, '');
  L.push('## Named variants (reported only, not judged)', '');
  L.push('| Lookback | Window | Months | Mean net R a month | NW t | Total R | Worst drawdown R |', '|---|---|---|---|---|---|---|');
  for (const v of o.variants) {
    L.push(`| ${v.lookback} months | decisive | ${v.decisive.months} | ${v.decisive.mean} | ${v.decisive.tNW} | ${v.decisive.total} | ${v.decisive.maxDD} |`);
    L.push(`| ${v.lookback} months | replication from ${v.replicationFrom} | ${v.replication.months} | ${v.replication.mean} | ${v.replication.tNW} | ${v.replication.total} | ${v.replication.maxDD} |`);
  }
  L.push('');
  L.push('## What it means, and what it does not', '');
  L.push(o.verdict === 'PASS'
    ? '- The rule cleared every pre-registered check. A pass would only lead to a written proposal for a paper shadow; it is not a council rule.'
    : '- The rule does not clear the pre-registered bar: on this universe, from 2016, buying the three indices that fell (or rose least) over three years and shorting the three that rose most is not an edge after costs. Never call it one; not a council rule, no proposal written, nothing live changed.');
  if (o.verdict !== 'PASS' && o.placebo.atOrAbove > o.placebo.draws / 2) {
    const nq = o.picks.decisive.nas100;
    L.push(`- Post hoc reading, not a test: the real book did worse than ${o.placebo.atOrAbove} of ${o.placebo.draws} random orderings. Over 2016-now the three-year winners kept winning${nq ? ` (NAS100 was short in ${nq.short} decisive cohorts and is the largest drag)` : ''}, so fading them lost; this is not evidence that following them is an edge (\`dual-momentum\` and \`index-spread-momentum\` found none).`);
  }
  L.push(`- Few independent observations: a 12-month hold gives about ${m.independentYears.decisive} non-overlapping years in the decisive window and ${m.independentYears.replication} in the replication window. The overlapping monthly book has ${d.x1.months} and ${r.x1.months} months, but neighbouring months share 11 of 12 cohorts, which is why the t uses 12 Newey-West lags; even so, a 36-month signal changes slowly, so the same few markets sit on each side for years (see the picks above) and the result rests on a handful of national stories.`);
  L.push('- The universe overlaps (US30 / SPX500 / NAS100 / US2000; EU50 / DE40 / FR40 / NL25 / ES35), so a "bottom 3" can be three versions of one market; there are fewer independent countries than 17 markets.');
  L.push('- Price CFDs without dividends: high-yield markets (UK100, AU200, ES35) are understated against low-yield ones (NAS100) over three years; currency effects are left in each leg\'s own currency; the papers used dollar total returns of MSCI indices. This is the claim as a CFD trader could run it, not a replication of the papers\' data.');
  L.push('- Financing is charged on shorts as well (conservative); the "gross" rows show the result with no cost at all. The 1R stop at 3 x ATR(20) cuts many legs before their 12 months: the papers held without stops.');
  L.push('');
  L.push('To repeat: `node research/edge/index-long-reversal/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/index-long-reversal/run.mjs full <dir>`. Tests: `tests/index-long-reversal.test.mjs`.');
  return L.join('\n') + '\n';
}

// ---- command line ----
export function load(dir) {
  const D = {}, universe = [];
  for (const key of KEYS) {
    const f = path.join(dir, key + '.json');
    if (!fs.existsSync(f)) continue;
    const file = JSON.parse(fs.readFileSync(f, 'utf8'));
    const bars = barsOf(file);
    if (bars.length < 100) continue;
    D[key] = { bars, ends: monthEnds(bars) };
    universe.push({ key, inst: file.inst, first: new Date(bars[0].time * 1000).toISOString().slice(0, 10), last: new Date(bars[bars.length - 1].time * 1000).toISOString().slice(0, 10), days: bars.length });
  }
  const cache = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'), 'utf8'));
  return { D, universe, dgs: cache?.score?.fred?.DGS2 || [] };
}

async function main() {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir); return;
  }
  if (mode !== 'full' || !dir) { console.log('usage: run.mjs fetch <dir> | full <dir>'); return; }
  const { D, universe, dgs } = load(dir);
  const S = study(D, dgs); S.universe = universe;
  const { json, md } = report(S);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(json, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md);
  console.log(md);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
