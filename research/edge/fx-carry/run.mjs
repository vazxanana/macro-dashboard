// FX carry on the G8 currencies with a crash filter (research/edge/fx-carry, PREREGISTRATION.md revision 2). Paper research.
//   node run.mjs fetch <dir>   copies the council's daily candle cache out of the council-data branch (git show, no network)
//   node run.mjs full <dir>    runs the study on <dir>/<key>.json and writes result.json + RESULT.md next to this file
// Rule, costs, tests and pass bar are fixed in PREREGISTRATION.md; nothing here is tuned.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RATES = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8'));
export const CCYS = ['usd', 'eur', 'gbp', 'jpy', 'aud', 'nzd', 'cad', 'chf'];
// the USD pair of each currency; base = the currency is the pair's base (long the currency = buy the pair)
export const PAIRS = { eur: { key: 'eurusd', base: true }, gbp: { key: 'gbpusd', base: true }, aud: { key: 'audusd', base: true }, nzd: { key: 'nzdusd', base: true },
  jpy: { key: 'usdjpy', base: false }, cad: { key: 'usdcad', base: false }, chf: { key: 'usdchf', base: false } };
export const KEYS = [...Object.values(PAIRS).map((p) => p.key), 'spx500'];
export const P = { ATR_N: 20, STOP_ATR: 2, SPREAD_PIP: 0.3, SLIP: 0.5, COMM_RT: 0.000045, MARKUP: 1.0, VOL_N: 20, VOL_YEAR: 252, SEEDS: 40, SEED0: 1000,
  DEC: ['2016-01', '2026-10'], REP: ['2006-01', '2015-12'], FIRST_REB: '2005-12', LAST_REB: '2026-09', T_BAR: 2, HOLM_BAR: 0.05, PLACEBO_BEAT: 38 };
export const TESTS = { T1: { filter: false }, T2: { filter: true } };
const DAY = 86400;
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const ymOf = (t) => ymdOf(t).slice(0, 7);
export const pipOf = (key) => (key.endsWith('jpy') ? 0.01 : 0.0001);
const nextYm = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };

// --- rates -------------------------------------------------------------------------------------------------------------
// the rate in force on a UTC date: the last decision effective on or before it
export function rateAt(ccy, ymd, rates = RATES) {
  const x = rates.decisions[ccy]; let r = x.from[1];
  for (const [d, v] of x.changes) { if (d <= ymd) r = v; else break; }
  return r;
}
// long the first two, short the last two of the eight sorted by rate (highest first); ties keep the list order (stable sort)
export function rank(ymd, rates = RATES) {
  const s = CCYS.map((c, i) => ({ c, r: rateAt(c, ymd, rates), i })).sort((a, b) => b.r - a.r || a.i - b.i).map((x) => x.c);
  return { long: s.slice(0, 2), short: s.slice(-2), order: s };
}

// --- candles -----------------------------------------------------------------------------------------------------------
export function loadBars(dir, key) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, `${key}.json`), 'utf8'));
  return foldWeekend(j.rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c })));
}
// ATR(20): simple mean of the true range of the 20 candles ending at index i (needs i >= 20: the previous close of the first)
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null; let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high, pc) - Math.min(b.low, pc); }
  return s / n;
}
// the last candle index of each calendar month
export function monthEnds(bars) { const out = {}; bars.forEach((b, i) => { out[ymOf(b.time)] = i; }); return out; }
// the last candle index dated on or before a UTC date (binary search)
export function lastOnOrBefore(bars, ymd) {
  const lim = Date.parse(ymd + 'T00:00:00Z') / 1000; let lo = 0, hi = bars.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m].time <= lim) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
// 20-day realised volatility of log close-to-close returns ending at index i
export function rvol(bars, i, n = P.VOL_N) { if (i < n) return null; const r = []; for (let k = i - n + 1; k <= i; k++) r.push(Math.log(bars[k].close / bars[k - 1].close)); return sd(r); }
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// the crash filter at a date: true = flat (volatility strictly above its 1-year median)
export function crashFlat(spx, ymd) {
  const i = lastOnOrBefore(spx, ymd); if (i < P.VOL_N + P.VOL_YEAR) return { flat: null, i };
  const now = rvol(spx, i), hist = []; for (let k = i - P.VOL_YEAR + 1; k <= i; k++) hist.push(rvol(spx, k));
  const med = median(hist); return { flat: now > med, vol: now, med, i };
}

// --- one leg -----------------------------------------------------------------------------------------------------------
// carry of a leg in R: every rollover counted by council/fills.mjs nights (22:00 UTC Mon-Fri, Wednesday three), at the rates
// in force on that rollover's date, less the markup, on every leg, whichever side
export function carryR({ ccy, side, entry, r0, t0, t1, markup = P.MARKUP, rates = RATES }) {
  const pr = PAIRS[ccy]; let s = 0, n = 0;
  for (let d = Math.floor(t0 / DAY) * DAY + 22 * 3600; d < t1; d += DAY) {
    if (d <= t0) continue; const w = new Date(d * 1000).getUTCDay(); if (w < 1 || w > 5) continue;
    const k = w === 3 ? 3 : 1, ymd = ymdOf(d), rc = rateAt(ccy, ymd, rates), ru = rateAt('usd', ymd, rates);
    const diff = pr.base ? rc - ru : ru - rc;     // r_base - r_quote
    s += k * (side * diff - markup); n += k;
  }
  return { R: s / 100 / 365 * entry / r0, nights: n };
}
// one leg from the close of bars[i] to the close of bars[j] (or its stop); side +1 = long the pair, -1 = short it
export function leg(bars, i, j, { ccy, side, costMult = 1, rates = RATES }) {
  const key = PAIRS[ccy].key, a = atr(bars, i); if (!a || !(a > 0)) return null;
  const entry = bars[i].close, r0 = P.STOP_ATR * a, stop = entry - side * r0, t0 = bars[i].time + DAY;
  let exit = bars[j].close, kind = 'month', t1 = bars[j].time + DAY, at = j;
  for (let k = i + 1; k <= j; k++) {
    const b = bars[k];
    if (side > 0 ? b.open <= stop : b.open >= stop) { exit = b.open; kind = 'gap'; t1 = b.time; at = k; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; kind = 'stop'; t1 = b.time + DAY / 2; at = k; break; }
  }
  const price = side * (exit - entry) / r0;
  const carry = carryR({ ccy, side, entry, r0, t0, t1, markup: P.MARKUP * costMult, rates });
  const cost = costMult * ((2 * P.SLIP + 1) * P.SPREAD_PIP * pipOf(key) + P.COMM_RT * entry) / r0;
  return { ccy, key, side, entry, stop, r0, exit, kind, t0, t1, at, price, carry: carry.R, nights: carry.nights, cost, net: price + carry.R - cost };
}
// the pair side that is long (dir +1) or short (dir -1) the currency
export const sideOf = (ccy, dir) => (PAIRS[ccy].base ? dir : -dir);

// --- the book ----------------------------------------------------------------------------------------------------------
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffled(r) { const a = [...CCYS]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return { long: a.slice(0, 2), short: a.slice(-2) }; }
// data = { bars: { key: bars }, ends: { key: monthEnds }, spx }; one entry per holding month
export function book(data, { filter = false, costMult = 1, pick = null, rates = RATES } = {}) {
  const out = []; const master = data.bars.eurusd, mEnds = data.ends.eurusd;
  for (let ym = P.FIRST_REB; ym <= P.LAST_REB; ym = nextYm(ym)) {
    const hold = nextYm(ym), rebDay = ymdOf(master[mEnds[ym]].time);
    const picks = pick ? pick(ym) : rank(rebDay, rates);
    const f = filter ? crashFlat(data.spx, rebDay) : { flat: false };
    const row = { ym: hold, reb: rebDay, long: picks.long, short: picks.short, flat: !!f.flat, legs: [] };
    if (!f.flat) for (const [dir, list] of [[1, picks.long], [-1, picks.short]]) for (const c of list) {
      if (c === 'usd') continue;
      const k = PAIRS[c].key, i = data.ends[k][ym], j = data.ends[k][hold];
      const l = leg(data.bars[k], i, j, { ccy: c, side: sideOf(c, dir), costMult, rates }); if (l) row.legs.push(l);
    }
    const sum = (f2) => row.legs.reduce((s, l) => s + l[f2], 0);
    Object.assign(row, { R: sum('net'), price: sum('price'), carry: sum('carry'), cost: sum('cost') });
    out.push(row);
  }
  return out;
}

// --- statistics --------------------------------------------------------------------------------------------------------
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
export function normP(t) {   // one-sided p of a normal t (mean > 0)
  if (t == null) return 1; const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  const up = 0.5 * (1 - erf); return +(t >= 0 ? up : 1 - up).toFixed(4);
}
export function holm(ps) { const s = [...ps].sort((x, y) => x[1] - y[1]), out = {}; let top = 0; s.forEach(([k, p], i) => { top = Math.max(top, Math.min(1, p * (s.length - i))); out[k] = +top.toFixed(4); }); return out; }
export function maxDD(series) { let c = 0, pk = 0, dd = 0; for (const x of series) { c += x; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); } return dd; }
export function stats(months) {
  const R = months.map((m) => m.R), n = R.length, mean = R.reduce((a, b) => a + b, 0) / n, s = n > 1 ? sd(R) : 0, t = s > 0 ? mean / (s / Math.sqrt(n)) : null;
  const part = (f) => months.reduce((a, m) => a + m[f], 0) / n, legs = months.reduce((a, m) => a + m.legs.length, 0);
  const kinds = {}; for (const m of months) for (const l of m.legs) kinds[l.kind] = (kinds[l.kind] || 0) + 1;
  return { months: n, flat: months.filter((m) => !m.legs.length).length, legs, mean: r3(mean), price: r3(part('price')), carry: r3(part('carry')), cost: r3(part('cost')),
    sd: r3(s), t: t == null ? null : +t.toFixed(2), p: normP(t == null ? null : +t.toFixed(2)), total: +R.reduce((a, b) => a + b, 0).toFixed(2), pos: r3(R.filter((x) => x > 0).length / n),
    maxDD: +maxDD(R).toFixed(2), exits: kinds, r0pct: legs ? +(100 * median(months.flatMap((m) => m.legs.map((l) => l.r0 / l.entry)))).toFixed(2) : null, perLeg: legs ? r3(R.reduce((a, b) => a + b, 0) / legs) : null };
}
export const inWin = (months, [a, b]) => months.filter((m) => m.ym >= a && m.ym <= b);
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };

export function verdictOf(tests) {
  const c12 = (x) => x.c1 && x.c2, pass = Object.entries(tests).filter(([, x]) => x.pass).map(([k]) => k);
  if (pass.length) return { verdict: 'PASS', tests: pass };
  if (!Object.values(tests).some(c12)) return { verdict: 'FAIL', tests: [] };
  return { verdict: 'INCONCLUSIVE', tests: Object.entries(tests).filter(([, x]) => c12(x)).map(([k]) => k) };
}

export function gate(data) {
  const bad = [];
  for (const k of Object.keys(data.bars)) {
    if (k === 'spx500') continue; const cnt = {};
    for (const b of data.bars[k]) {
      const ym = ymOf(b.time); cnt[ym] = (cnt[ym] || 0) + 1;
      if (ym >= P.FIRST_REB && ym <= P.DEC[1] && !(b.high >= Math.max(b.open, b.close) && Math.min(b.open, b.close) >= b.low && b.low > 0)) bad.push(`${k} ${ymdOf(b.time)} broken candle`);
    }
    for (let ym = P.FIRST_REB; ym <= P.DEC[1]; ym = nextYm(ym)) if ((cnt[ym] || 0) < 15) bad.push(`${k} ${ym}: ${cnt[ym] || 0} candles`);
  }
  return bad;
}

export function study(dir) {
  const bars = {}, ends = {};
  for (const k of KEYS) { bars[k] = loadBars(dir, k); ends[k] = monthEnds(bars[k]); }
  const data = { bars, ends, spx: bars.spx500 }, g = gate(data);
  if (g.length) return { verdict: 'not run: data gate failed', gate: g.slice(0, 50) };
  const res = { tests: {}, placebo: {} }, runs = {};
  for (const [name, T] of Object.entries(TESTS)) {
    const m = book(data, T), m2 = book(data, { ...T, costMult: 2 }); runs[name] = m;
    const pl = []; for (let s = 1; s <= P.SEEDS; s++) { const r = rng(P.SEED0 + s), picks = {}; const pm = book(data, { ...T, pick: (ym) => (picks[ym] ||= shuffled(r)) }); pl.push(stats(inWin(pm, P.DEC)).mean); }
    const dec = stats(inWin(m, P.DEC)), rep = stats(inWin(m, P.REP)), dec2 = stats(inWin(m2, P.DEC)), rep2 = stats(inWin(m2, P.REP));
    const byYear = {}; for (const mm of m) { const y = mm.ym.slice(0, 4); (byYear[y] ||= { R: 0, months: 0, legs: 0, carry: 0, price: 0 }); const b = byYear[y]; b.R += mm.R; b.months++; b.legs += mm.legs.length; b.carry += mm.carry; b.price += mm.price; }
    for (const b of Object.values(byYear)) for (const k of ['R', 'carry', 'price']) b[k] = +b[k].toFixed(2);
    const beat = pl.filter((x) => dec.mean > x).length;
    res.placebo[name] = { means: pl, p5: r3(pct(pl, 0.05)), p50: r3(pct(pl, 0.5)), p95: r3(pct(pl, 0.95)), beat };
    res.tests[name] = { decisive: dec, replication: rep, decisive2x: dec2, replication2x: rep2, byYear, beat };
  }
  const h = holm(Object.entries(res.tests).map(([k, x]) => [k, x.decisive.p]));
  for (const [k, x] of Object.entries(res.tests)) {
    x.holm = h[k];
    x.c1 = x.decisive.mean > 0 && x.decisive.t != null && x.decisive.t >= P.T_BAR; x.c2 = x.replication.mean > 0; x.c3 = x.holm < P.HOLM_BAR;
    x.c4 = x.beat >= P.PLACEBO_BEAT; x.c5 = x.decisive2x.mean > 0; x.pass = x.c1 && x.c2 && x.c3 && x.c4 && x.c5;
  }
  const v = verdictOf(res.tests);
  // reported, not tested: how often each currency was picked, USD legs flat, months flat by the filter
  const picks = {}; for (const c of CCYS) picks[c] = { long: 0, short: 0 };
  const decRows = inWin(runs.T1, P.DEC); for (const m of decRows) { for (const c of m.long) picks[c].long++; for (const c of m.short) picks[c].short++; }
  const repPicks = {}; for (const c of CCYS) repPicks[c] = { long: 0, short: 0 };
  for (const m of inWin(runs.T1, P.REP)) { for (const c of m.long) repPicks[c].long++; for (const c of m.short) repPicks[c].short++; }
  const t2flat = { decisive: inWin(runs.T2, P.DEC).filter((m) => m.flat).length, replication: inWin(runs.T2, P.REP).filter((m) => m.flat).length };
  const months = runs.T1.map((m, i) => ({ ym: m.ym, long: m.long, short: m.short, legs: m.legs.length, R: +m.R.toFixed(3), carry: +m.carry.toFixed(3), price: +m.price.toFixed(3), cost: +m.cost.toFixed(4), t2flat: runs.T2[i].flat }));
  return { study: 'fx-carry', revision: 2, verdict: v.verdict, which: v.tests, built: '2026-11-14',
    data: { src: 'council-data research/daily/<key>.json (OANDA mid daily, weekends folded into Monday)', keys: KEYS, last: ymdOf(bars.eurusd.at(-1).time),
      rates: 'rates.json: central-bank policy rates written out from known decisions, approximate and from memory (no 2026 decision recorded)' },
    windows: { decisive: P.DEC, replication: P.REP }, params: P, ...res, holm: h, picks: { decisive: picks, replication: repPicks }, t2flat, months };
}

// --- report ------------------------------------------------------------------------------------------------------------
const f = (x, d = 3) => (x == null ? 'n/a' : (x < 0 ? '−' : x > 0 ? '+' : '') + Math.abs(x).toFixed(d));
export function report(J) {
  const L = [];
  L.push('# The FX carry trade on the G8 currencies, with a crash filter: result', '');
  const T1 = J.tests.T1, T2 = J.tests.T2;
  const why = J.verdict === 'FAIL' ? 'neither test makes money with month-sum t ≥ 2 in 2016-26 AND makes money in 2006-15'
    : J.verdict === 'PASS' ? `${J.which.join(' and ')} met all five pre-registered conditions` : `${J.which.join(' and ')} met conditions 1 and 2 but not all five`;
  L.push(`**Verdict: ${J.verdict}** (${why}). T1 (carry, every month): ${f(T1.decisive.mean)}R a month net in 2016-26 (n ${T1.decisive.months} months, ${T1.decisive.legs} legs, t ${T1.decisive.t}), ${f(T1.replication.mean)}R in 2006-15 (n ${T1.replication.months}, t ${T1.replication.t}). T2 (flat when S&P 500 volatility is above its 1-year median): ${f(T2.decisive.mean)}R a month in 2016-26 (t ${T2.decisive.t}), ${f(T2.replication.mean)}R in 2006-15 (t ${T2.replication.t}).`, '');
  L.push('Pre-registration: [`PREREGISTRATION.md`](PREREGISTRATION.md) (revision 2, committed alone before any computation; revision 1, a FRED-based design that was never run because no rate host was reachable, is kept as [`PREREGISTRATION-r1.md`](PREREGISTRATION-r1.md), marked superseded). Paper research only; nothing live changed. **The policy rates are approximate and written from memory** (`rates.json`): a PASS would need them checked against their sources first; a FAIL does not hinge on them unless a ranking error is systematic.', '');
  L.push('## Results (R per month = the sum of up to four legs of 1R each, net of costs, flat months as 0)', '');
  L.push('| test | window | months (flat) | legs | net R / month | carry part | price part | cost part | month-sum t | Holm p | total R | worst drawdown R | months positive | net at 2x cost |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, x] of Object.entries(J.tests)) for (const [w, s, s2] of [['2016-26 (decisive)', x.decisive, x.decisive2x], ['2006-15 (replication)', x.replication, x.replication2x]]) {
    L.push(`| ${k} | ${w} | ${s.months} (${s.flat}) | ${s.legs} | ${f(s.mean)} | ${f(s.carry)} | ${f(s.price)} | −${s.cost.toFixed(3)} | ${s.t} | ${w.startsWith('2016') ? x.holm : '–'} | ${f(s.total, 2)} | ${s.maxDD.toFixed(2)} | ${(s.pos * 100).toFixed(0)} % | ${f(s2.mean)} |`);
  }
  L.push('', '## Pass conditions (pre-registered)', '', '| test | 1: t ≥ 2, mean > 0 (2016-26) | 2: mean > 0 (2006-15) | 3: Holm p < 0.05 | 4: beats ≥ 38 of 40 placebos | 5: > 0 at 2x cost | pass |', '|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const [k, x] of Object.entries(J.tests)) L.push(`| ${k} | ${yn(x.c1)} | ${yn(x.c2)} | ${yn(x.c3)} | ${yn(x.c4)} (${x.beat} of 40) | ${yn(x.c5)} | ${yn(x.pass)} |`);
  L.push('', '## Placebo (40 seeds, random currencies each month, same mechanics), 2016-26 mean net R a month', '', '| test | rule | placebo 5th | 50th | 95th | placebos beaten |', '|---|---|---|---|---|---|');
  for (const [k, x] of Object.entries(J.placebo)) L.push(`| ${k} | ${f(J.tests[k].decisive.mean)} | ${f(x.p5)} | ${f(x.p50)} | ${f(x.p95)} | ${x.beat} of 40 |`);
  L.push('', '## By year (T1, net R, with its carry and price parts)', '', '| year | months | legs | net R | carry | price |', '|---|---|---|---|---|---|');
  for (const [y, b] of Object.entries(J.tests.T1.byYear)) L.push(`| ${y} | ${b.months} | ${b.legs} | ${f(b.R, 2)} | ${f(b.carry, 2)} | ${f(b.price, 2)} |`);
  L.push('', '## What was picked (T1, months as long / short)', '', '| currency | 2016-26 long | short | 2006-15 long | short |', '|---|---|---|---|---|');
  for (const c of CCYS) L.push(`| ${c.toUpperCase()} | ${J.picks.decisive[c].long} | ${J.picks.decisive[c].short} | ${J.picks.replication[c].long} | ${J.picks.replication[c].short} |`);
  L.push('', `A USD pick is a flat leg (no position). T2 was flat by the filter in ${J.t2flat.decisive} of ${T2.decisive.months} decisive months and ${J.t2flat.replication} of ${T2.replication.months} replication months. Exits in 2016-26 (T1): ${Object.entries(T1.decisive.exits).map(([k, v]) => `${k} ${v}`).join(', ')} (month = closed at the next rebalance, stop = inside a candle, gap = at a candle's open).`);
  L.push('', '## Reading', '');
  L.push(...readingOf(J));
  L.push('', '## Decisions the pre-registration made where the brief was silent', '',
    '- Ties broken by the fixed list order USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF; every leg closed and reopened monthly (full round trip); a month\'s R is the SUM of its legs; exit time of a stop inside a daily candle = midday (night count); the 1 % markup on every leg whichever side; half a spread of slippage on both market orders.',
    '- The ranking uses the rates in force on the rebalance day; the carry uses the rates in force on each rollover\'s date.', '',
    'To repeat: `node research/edge/fx-carry/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Tests: `tests/fx-carry.test.mjs`.');
  return L.join('\n') + '\n';
}
function readingOf(J) {
  const T1 = J.tests.T1, T2 = J.tests.T2, out = [];
  out.push(`- **Where the R comes from (T1, 2016-26)**: carry ${f(T1.decisive.carry)}R a month, price ${f(T1.decisive.price)}R, costs −${T1.decisive.cost.toFixed(3)}R. In 2006-15: carry ${f(T1.replication.carry)}R, price ${f(T1.replication.price)}R. The carry is small next to a 2 x ATR stop: a 4-point rate gap less the 1 % markup is about 0.25 % of price a month, while a leg\'s 1R (2 x ATR(20)) was a median ${T1.decisive.r0pct} % of price in 2016-26 (${T1.replication.r0pct} % in 2006-15).`);
  out.push(`- **The crash filter**: T2 minus T1 in 2016-26 = ${f(T2.decisive.mean - T1.decisive.mean)}R a month; in 2006-15 ${f(T2.replication.mean - T1.replication.mean)}R.`);
  out.push(`- **Against chance**: the rule's 2016-26 mean beats ${T1.beat} of 40 random-currency books for T1 and ${T2.beat} of 40 for T2.`);
  out.push('- Never call this an edge without its n and t above. Nothing is proposed on a FAIL; a new carry test would need fetched (not remembered) rates and its own pre-registration.');
  return out;
}

function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of KEYS) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  console.log(`fetched ${KEYS.length} files into ${dir}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) fetchAll(dir);
  else if (mode === 'full' && dir) {
    const J = study(dir);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(J, null, 1) + '\n');
    if (J.tests) fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(J));
    console.log(J.verdict, J.tests ? Object.fromEntries(Object.entries(J.tests).map(([k, x]) => [k, { dec: x.decisive, rep: x.replication, beat: x.beat, holm: x.holm }])) : J.gate);
  } else { console.error('usage: node run.mjs fetch <dir> | full <dir>'); process.exit(1); }
}
