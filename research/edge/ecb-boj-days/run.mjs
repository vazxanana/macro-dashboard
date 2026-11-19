// Edge research · ecb-boj-days: follow the first 60 minutes after an ECB decision (EUR/USD) or a BoJ decision (USD/JPY),
// OANDA mid M5, net of the raw-spread forex costs. Rule, minute, costs, windows, placebo and pass bar: PREREGISTRATION.md
// (committed first, with dates.json).
//   node --use-env-proxy research/edge/ecb-boj-days/fetch.mjs <dir>    (candles, kept out of git)
//   node research/edge/ecb-boj-days/run.mjs <dir>                     (writes result.json and RESULT.md here)
// A NEW stand-alone event rule on two forex pairs; not a test of the gold book (owner decision item 44 untouched).
// Pure pieces are exported for tests/ecb-boj-days.test.mjs. Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, M5 = 300, H1 = 3600, FRA = 'Europe/Berlin';
const T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const DATES = JSON.parse(fs.readFileSync(path.join(HERE, 'dates.json'), 'utf8'));
export const P = Object.freeze({
  ECB_MIN: ['13:45', '14:15'], FIRST: 3600, ATR_N: 14, ATR_DAYS: 7, SPIKE: 2, BASE_N: 20, BASE_DAYS: 45,
  BOJ_FROM: 3 * H1, BOJ_TO: 5 * H1,
  EXIT: Object.freeze({ ECB: 21 * H1, BOJ: 15 * H1 }),
  PIP: Object.freeze({ eurusd: 1e-4, usdjpy: 0.01 }), COST_PIPS: 0.3 + 0.3, COMM_RT: 45e-6,
  W: Object.freeze({ rep: [T0('2010-01-01'), T0('2018-01-01')], dec: [T0('2018-01-01'), T0('2026-11-14')] }),
  SEEDS: 40, HALF: 182, EXCL_DAYS: 3, TRIES: 50, Q: 0.95, N_MIN: 40, T_MIN: 2, ALPHA: 0.05,
});
export const TESTS = Object.freeze([{ id: 'T1', bank: 'ECB', sym: 'eurusd' }, { id: 'T2', bank: 'BOJ', sym: 'usdjpy' }]);

const dnum = (s) => Date.parse(s + 'T00:00:00Z') / (DAY * 1000);
const dstr = (n) => new Date(n * DAY * 1000).toISOString().slice(0, 10);
const wday = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const weekday = (s) => { const w = wday(s); return w !== 0 && w !== 6; };

export function eventDates(bank) {
  const out = [];
  for (const [y, list] of Object.entries(DATES[bank].dates)) for (const md of list) out.push(`${y}-${md}`);
  return out.sort();
}
export const bannedOf = (bank) => new Set([...eventDates(bank), ...DATES[bank].unscheduled]);

// ── candles: typed arrays + a time → index map; t = candle start ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n, at: new Map() };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; b.at.set(r[0], i); });
  return b;
}
const rangeAt = (b, t) => { const i = b.at.get(t); return i == null ? null : b.h[i] - b.l[i]; };
// index of the first candle starting at or after t
function firstFrom(b, t) { let lo = 0, hi = b.n; while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] < t) lo = m + 1; else hi = m; } return lo; }
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
// the 20 previous weekdays (inside 45 calendar days, banned dates left out) for which f(date) gives a value
function prevDays(date, banned, f) {
  const out = [];
  for (let d = dnum(date) - 1; d >= dnum(date) - P.BASE_DAYS && out.length < P.BASE_N; d--) {
    const ds = dstr(d); if (!weekday(ds) || banned.has(ds)) continue;
    const v = f(ds); if (v != null) out.push(v);
  }
  return out.length < P.BASE_N ? null : out;
}

// ── ECB: the direction-free clock check (13:45 or 14:15 Frankfurt: the candle with the larger range) ──
export function ecbMinute(b, date, banned) {
  const c = P.ECB_MIN.map((hm) => ({ hm, T: zonedToUtc(date, hm, FRA) })).map((x) => ({ ...x, r: rangeAt(b, x.T) }));
  if (c.every((x) => x.r == null)) return null;
  const pick = (c[0].r ?? -1) >= (c[1].r ?? -1) ? c[0] : c[1];
  const base = prevDays(date, banned, (ds) => rangeAt(b, zonedToUtc(ds, pick.hm, FRA)));
  return { T: pick.T, local: pick.hm, range: pick.r, other: c.find((x) => x !== pick).r, confirmed: base ? pick.r >= P.SPIKE * median(base) : false };
}
// ── BoJ: the first M5 candle from 03:00 UTC whose range is above 2x the median of that UTC hour on the 20 previous weekdays ──
export function hourBase(b, date, hourSec, banned) {
  const xs = [];
  const days = prevDays(date, banned, (ds) => {
    const s = T0(ds) + hourSec, rs = [];
    for (let i = firstFrom(b, s); i < b.n && b.t[i] < s + H1; i++) rs.push(b.h[i] - b.l[i]);
    return rs.length ? rs : null;
  });
  if (!days) return null;
  for (const rs of days) xs.push(...rs);
  return median(xs);
}
export function bojRelease(b, date, banned) {
  const d0 = T0(date), base = {};
  for (let h = P.BOJ_FROM; h < P.BOJ_TO; h += H1) { base[h] = hourBase(b, date, h, banned); if (base[h] == null) return { skip: 'no baseline' }; }
  for (let i = firstFrom(b, d0 + P.BOJ_FROM); i < b.n && b.t[i] < d0 + P.BOJ_TO; i++) {
    const h = Math.floor((b.t[i] - d0) / H1) * H1;
    if (b.h[i] - b.l[i] > P.SPIKE * base[h]) return { T: b.t[i], range: b.h[i] - b.l[i], base: base[h] };
  }
  return { skip: 'no release bar' };
}

// ── ATR: simple mean true range of the last 14 one-hour candles (UTC hours, from M5) that ended at or before D ──
export function atrAt(b, D) {
  const cut = Math.floor(D / H1) * H1, lim = D - P.ATR_DAYS * DAY, hours = [];
  let i = firstFrom(b, cut) - 1;
  while (i >= 0 && hours.length < P.ATR_N + 1 && b.t[i] >= lim) {
    const hs = Math.floor(b.t[i] / H1) * H1; let hi = -Infinity, lo = Infinity; const c = b.c[i];
    while (i >= 0 && b.t[i] >= hs) { if (b.h[i] > hi) hi = b.h[i]; if (b.l[i] < lo) lo = b.l[i]; i--; }
    hours.push({ hi, lo, c });
  }
  if (hours.length < P.ATR_N + 1) return null;
  let s = 0;
  for (let k = 0; k < P.ATR_N; k++) { const x = hours[k], pc = hours[k + 1].c; s += Math.max(x.hi - x.lo, Math.abs(x.hi - pc), Math.abs(x.lo - pc)); }
  return s / P.ATR_N;
}

export function costOf(sym, entry, mult = 1) { return mult * (P.COST_PIPS * P.PIP[sym] + P.COMM_RT * entry); }

// decision time D of one date for one bank, or a skip reason
export function decision(b, bank, date, banned) {
  if (bank === 'ECB') { const m = ecbMinute(b, date, banned); return m ? { D: m.T, ecb: m } : { skip: 'no decision candle' }; }
  const r = bojRelease(b, date, banned); return r.skip ? r : { D: r.T, boj: r };
}
// the trade of one date: direction of the first 60 min, entry at D + 60, stop 1 ATR, out at the exit time (UTC)
export function trade(b, bank, sym, date, banned) {
  const dec = decision(b, bank, date, banned); if (dec.skip) return dec;
  const D = dec.D, iRef = b.at.get(D - M5), i60 = b.at.get(D + P.FIRST - M5);
  if (iRef == null || i60 == null) return { skip: 'first hour incomplete' };
  const ref = b.c[iRef], entry = b.c[i60], d = Math.sign(entry - ref);
  if (d === 0) return { skip: 'no direction' };
  const atr = atrAt(b, D); if (!(atr > 0)) return { skip: 'no ATR' };
  const stop = entry - d * atr, exitT = T0(date) + P.EXIT[bank];
  let exit = null, why = null, xT = null, last = -1;
  for (let i = i60 + 1; i < b.n && b.t[i] + M5 <= exitT; i++) {
    last = i;
    if (d > 0 ? b.o[i] <= stop : b.o[i] >= stop) { exit = b.o[i]; why = 'gap'; xT = b.t[i]; break; }
    if (d > 0 ? b.l[i] <= stop : b.h[i] >= stop) { exit = stop; why = 'stop'; xT = b.t[i] + M5; break; }
  }
  if (exit == null) { if (last < 0) return { skip: 'no candle after entry' }; exit = b.c[last]; why = 'time'; xT = b.t[last] + M5; }
  const R = d * (exit - entry) / atr, cost = costOf(sym, entry);
  return { date, D, d, ref, entry, stop, atr, exit, why, exitT: xT, R, costR: cost / atr, net: R - cost / atr, net2: R - 2 * cost / atr, ...(dec.ecb ? { ecb: dec.ecb } : {}) };
}

// ── statistics ──
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, x) => a + x, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
// month-sum t: every calendar month from `from` to `to` (unix s) gets the sum of its trades' values (0 if none)
export function monthT(trs, from, to, key = 'net') {
  const sums = new Map(), m0 = new Date(from * 1000), m1 = new Date((to - 1) * 1000);
  for (let y = m0.getUTCFullYear(), m = m0.getUTCMonth(); y < m1.getUTCFullYear() || (y === m1.getUTCFullYear() && m <= m1.getUTCMonth()); m === 11 ? (y++, m = 0) : m++) sums.set(`${y}-${String(m + 1).padStart(2, '0')}`, 0);
  for (const x of trs) { const k = x.date.slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
  const s = stat([...sums.values()]);
  return { months: s.n, t: s.t };
}
export function quantile(xs, q) {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!s.length) return null;
  const x = (s.length - 1) * q, lo = Math.floor(x), hi = Math.ceil(x);
  return s[lo] + (s[hi] - s[lo]) * (x - lo);
}
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOne = (t) => (t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2)));
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, out = new Array(m);
  let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); out[i] = run; });
  return out;
}
// placebo pool of one event: weekdays within ±HALF days, inside the window, not within EXCL_DAYS of any decision of that bank
export function standIns(date, win, bank) {
  const d0 = dnum(date), ban = [...bannedOf(bank)].map(dnum), out = [];
  for (let d = d0 - P.HALF; d <= d0 + P.HALF; d++) {
    const ds = dstr(d); if (!weekday(ds)) continue;
    if (ban.some((x) => Math.abs(x - d) <= P.EXCL_DAYS)) continue;
    const T = T0(ds); if (T < win[0] || T >= win[1]) continue;
    out.push(ds);
  }
  return out;
}
export function placebo(b, bank, sym, dates, win, banned, seeds = P.SEEDS) {
  const pools = dates.map((d) => standIns(d, win, bank)), cache = new Map(), out = [];
  const tr = (ds) => { if (!cache.has(ds)) cache.set(ds, trade(b, bank, sym, ds, banned)); return cache.get(ds); };
  for (let s = 1; s <= seeds; s++) {
    const r = rng(s * 7919 + (bank === 'ECB' ? 1 : 2)), xs = [];
    for (const pool of pools) for (let k = 0; k < P.TRIES && pool.length; k++) { const x = tr(pool[Math.floor(r() * pool.length)]); if (!x.skip) { xs.push(x.net); break; } }
    out.push(xs);
  }
  return out;
}
export function judge(dec, rep, holmP, p95, pooled = false) {
  const c = { nOk: dec.n >= P.N_MIN, positive: dec.mean > 0, t2: dec.mt != null && dec.mt >= P.T_MIN, ...(pooled ? {} : { holm: holmP < P.ALPHA }),
    sameSign: rep.mean != null && rep.mean > 0, beatsPlacebo: p95 != null && dec.mean > p95 };
  return { ...c, pass: Object.values(c).every(Boolean) };
}

const r2 = (x, d = 3) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
function summarize(trs, win) {
  const net = stat(trs.map((x) => x.net)), gross = stat(trs.map((x) => x.R)), n2 = stat(trs.map((x) => x.net2)), why = {};
  for (const x of trs) why[x.why] = (why[x.why] || 0) + 1;
  const mt = monthT(trs, win[0], win[1]), mt2 = monthT(trs, win[0], win[1], 'net2');
  return { n: net.n, netR: r2(net.mean), monthT: r2(mt.t, 2), months: mt.months, tradeT: r2(net.t, 2), grossR: r2(gross.mean), costR: r2(stat(trs.map((x) => x.costR)).mean),
    net2R: r2(n2.mean), monthT2: r2(mt2.t, 2), win: r2(trs.filter((x) => x.net > 0).length / (trs.length || 1)), exits: why, raw: { n: net.n, mean: net.mean, mt: mt.t } };
}

export function run(dir) {
  const out = { study: 'ecb-boj-days', built: '2026-11-14', preregistration: 'research/edge/ecb-boj-days/PREREGISTRATION.md', dates: DATES.provenance,
    scope: 'A new stand-alone event rule on EUR/USD and USD/JPY; not a test of the gold book (owner decision item 44 untouched).',
    rule: 'direction of the first 60 minutes after the decision (close of the M5 candle ending at D + 60 min against the one ending at D); entry at D + 60 min in that direction, stop 1 x the 14-hour ATR known at D, no target, out at 21:00 UTC (ECB) / 15:00 UTC (BoJ). D: ECB the larger-range candle of 13:45 / 14:15 Frankfurt; BoJ the first M5 candle from 03:00 UTC with a range above 2x the median of that hour on the 20 previous weekdays (none before 05:00 UTC: no trade)',
    costs: 'per round trip 0.3 pip spread + 0.3 pip slippage + 45 USD per million notional commission (0.0045 % of the price)', windows: { rep: '2010-2017', dec: '2018 → now' }, tests: [], detail: {} };
  const holmIn = [], pooledDec = [], pooledRep = [], pooledPl = [];
  for (const T of TESTS) {
    const b = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${T.sym}-5m.json.gz`)))));
    const lastT = b.t[b.n - 1] + M5, banned = bannedOf(T.bank), all = eventDates(T.bank);
    const det = { bank: T.bank, sym: T.sym, candles: b.n, from: dstr(Math.floor(b.t[0] / DAY)), to: dstr(Math.floor((lastT - 1) / DAY)), windows: {} };
    for (const [w, win0] of Object.entries(P.W)) {
      const win = [win0[0], Math.min(win0[1], lastT)], dates = all.filter((d) => T0(d) >= win[0] && T0(d) < win[1]);
      const trs = [], skipped = {};
      for (const d of dates) { const x = trade(b, T.bank, T.sym, d, banned); if (x.skip) skipped[x.skip] = (skipped[x.skip] || 0) + 1; else trs.push(x); }
      const S = { events: dates.length, skipped, ...summarize(trs, win) };
      const byYear = {};
      for (const x of trs) (byYear[x.date.slice(0, 4)] ||= []).push(x.net);
      S.byYear = Object.fromEntries(Object.entries(byYear).map(([y, xs]) => [y, { n: xs.length, netR: r2(stat(xs).mean) }]));
      if (T.bank === 'ECB') {
        const ck = {}; let conf = 0;
        for (const x of trs) { const y = x.date.slice(0, 4); ck[y] ||= { '13:45': 0, '14:15': 0 }; ck[y][x.ecb.local]++; if (x.ecb.confirmed) conf++; }
        S.clock = { byYear: ck, confirmed: conf, unconfirmed: trs.filter((x) => !x.ecb.confirmed).map((x) => x.date) };
      }
      S.trades = trs.map((x) => ({ date: x.date, D: new Date(x.D * 1000).toISOString().slice(11, 16), side: x.d > 0 ? 'buy' : 'sell', entry: r2(x.entry, 5), stop: r2(x.stop, 5), exit: r2(x.exit, 5), why: x.why, R: r2(x.R), net: r2(x.net) }));
      (w === 'dec' ? pooledDec : pooledRep).push(...trs);
      if (w === 'dec') {
        const pl = placebo(b, T.bank, T.sym, dates, win, banned), pm = pl.map((xs) => stat(xs).mean);
        pooledPl.push(pl);
        S.placebo = { seeds: pm.length, p5: r2(quantile(pm, 0.05)), p50: r2(quantile(pm, 0.5)), p95: r2(quantile(pm, P.Q)), max: r2(Math.max(...pm)), beaten: pm.filter((x) => S.raw.mean > x).length, p95raw: quantile(pm, P.Q) };
        S.window = [dstr(win[0] / DAY), dstr(Math.floor((win[1] - 1) / DAY))];
      }
      det.windows[w] = S;
    }
    out.detail[T.id] = det;
    holmIn.push({ T, p: pOne(det.windows.dec.raw.mt) });
  }
  const adj = holm(holmIn.map((x) => x.p));
  holmIn.forEach(({ T, p }, k) => {
    const W = out.detail[T.id].windows, j = judge(W.dec.raw, W.rep.raw, adj[k], W.dec.placebo.p95raw);
    out.tests.push({ id: T.id, bank: T.bank, sym: T.sym, n: W.dec.n, netR: W.dec.netR, monthT: W.dec.monthT, p: r2(p, 4), holmP: r2(adj[k], 4),
      repN: W.rep.n, repNetR: W.rep.netR, placeboP5: W.dec.placebo.p5, placeboP50: W.dec.placebo.p50, placeboP95: W.dec.placebo.p95, net2R: W.dec.net2R, monthT2: W.dec.monthT2, ...j });
  });
  // pooled: both tests' trades, month sums over the decisive window; placebo seed s = both banks' seed s draws together
  const dec = [P.W.dec[0], Math.min(P.W.dec[1], ...TESTS.map((T) => T0(out.detail[T.id].to) + DAY))];
  const ps = summarize(pooledDec, dec), pr = summarize(pooledRep, P.W.rep);
  const pm = pooledPl[0].map((xs, s) => stat([...xs, ...pooledPl[1][s]]).mean), p95 = quantile(pm, P.Q);
  out.pooled = { n: ps.n, netR: ps.netR, monthT: ps.monthT, repN: pr.n, repNetR: pr.netR, net2R: ps.net2R, monthT2: ps.monthT2,
    placeboP5: r2(quantile(pm, 0.05)), placeboP50: r2(quantile(pm, 0.5)), placeboP95: r2(p95), ...judge(ps.raw, pr.raw, null, p95, true) };
  for (const T of TESTS) for (const w of Object.keys(P.W)) { delete out.detail[T.id].windows[w].raw; if (w === 'dec') delete out.detail[T.id].windows[w].placebo.p95raw; }
  out.passed = out.tests.filter((x) => x.pass).map((x) => x.id);
  out.verdict = out.passed.length ? 'PASS' : 'FAIL';
  return out;
}

const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
export const NAME = { T1: 'T1 ECB, EUR/USD', T2: 'T2 BoJ, USD/JPY' };
export function headline(r) {
  const s = r.tests.map((x) => `${NAME[x.id]}: n ${x.n}, ${f(x.netR)}R a trade net, month t ${f(x.monthT, 2)}, Holm p ${x.holmP}, 2010-17 ${f(x.repNetR)}R`).join('; ');
  return `**Verdict: ${r.verdict}, ${r.passed.length} of ${r.tests.length} tests.** 2018 → now: ${s}. Pooled ${f(r.pooled.netR)}R (n ${r.pooled.n}, month t ${f(r.pooled.monthT, 2)}).`;
}
export function report(r) {
  const L = [];
  L.push('# ECB and BoJ decision days: follow the first hour: result', '');
  L.push(headline(r), '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed with \`dates.json\` before any trade of the rule was computed). ${r.scope} Rule: ${r.rule}. Costs: ${r.costs}. Data: OANDA mid M5 through the candle proxy. Dates: ${r.dates}`, '');
  L.push('## The tests (2018 → now decides)', '', '| test | window | n | net R a trade | month t | Holm p | 2010-17 net R (n) | placebo p5 / p50 / p95 | at 2x cost: net R (month t) | pass |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const x of r.tests) {
    const w = r.detail[x.id].windows.dec.window;
    L.push(`| ${NAME[x.id]} | ${w[0]} → ${w[1]} | ${x.n} | ${f(x.netR)} | ${f(x.monthT, 2)} | ${x.holmP} | ${f(x.repNetR)} (${x.repN}) | ${f(x.placeboP5)} / ${f(x.placeboP50)} / ${f(x.placeboP95)} | ${f(x.net2R)} (${f(x.monthT2, 2)}) | ${x.pass ? 'yes' : 'no'} |`);
  }
  const q = r.pooled;
  L.push(`| Pooled (not in Holm, cannot pass alone) | 2018 → now | ${q.n} | ${f(q.netR)} | ${f(q.monthT, 2)} | n/a | ${f(q.repNetR)} (${q.repN}) | ${f(q.placeboP5)} / ${f(q.placeboP50)} / ${f(q.placeboP95)} | ${f(q.net2R)} (${f(q.monthT2, 2)}) | ${q.pass ? 'yes' : 'no'} |`);
  L.push('', '"pass" = n ≥ 40, mean net R > 0, month-sum t ≥ 2 (every month of the window counted, 0 without a trade), Holm p < 0.05 over T1 and T2, positive in 2010-17 and above the placebo\'s 95th percentile (the same rule on non-event weekdays near each event, 40 seeds).', '');
  L.push('## Detail per window', '', '| test | window | events | trades | net R | month t | trade t | gross R | cost R | win | exits | skipped |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const T of TESTS) for (const w of ['rep', 'dec']) {
    const x = r.detail[T.id].windows[w];
    L.push(`| ${NAME[T.id]} | ${r.windows[w]} | ${x.events} | ${x.n} | ${f(x.netR)} | ${f(x.monthT, 2)} | ${f(x.tradeT, 2)} | ${f(x.grossR)} | ${f(x.costR)} | ${(x.win * 100).toFixed(0)} % | ${Object.entries(x.exits).map(([k, v]) => `${k} ${v}`).join(', ')} | ${Object.entries(x.skipped).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'} |`);
  }
  L.push('', '## By year (net R a trade, n)', '');
  for (const T of TESTS) for (const w of ['rep', 'dec']) L.push(`- ${NAME[T.id]}, ${r.windows[w]}: ` + Object.entries(r.detail[T.id].windows[w].byYear).map(([y, x]) => `${y} ${f(x.netR, 2)} (${x.n})`).join(' · '));
  L.push('', '## The ECB clock check (direction-free; which candidate minute had the larger candle)', '');
  for (const w of ['rep', 'dec']) {
    const c = r.detail.T1.windows[w].clock;
    L.push(`- ${r.windows[w]}: ` + Object.entries(c.byYear).map(([y, x]) => `${y} 13:45 ${x['13:45']} / 14:15 ${x['14:15']}`).join(' · ') + `. Confirmed (chosen candle over 2x its minute's 20-day median): ${c.confirmed} of ${r.detail.T1.windows[w].n}; not confirmed: ${c.unconfirmed.join(', ') || 'none'}.`);
  }
  L.push('', '## What this means', '');
  if (r.verdict === 'PASS') L.push(`Passing: ${r.passed.join(', ')}. A hypothesis for a forward paper shadow only; never call it an edge before a forward record. Nothing live changed.`);
  else L.push('No test meets the pre-registered bar, so following the first hour after an ECB or BoJ decision is not an edge on the council\'s feed after costs. No proposal is written and nothing live changed. This was a new stand-alone event rule, not a test of the gold book (item 44). Any other version (another first window, exit time, stop, pair or filter) would need its own pre-registration on data not used here.');
  const near = r.tests.filter((x) => !x.pass && x.netR > 0 && x.repNetR > 0 && x.netR > x.placeboP95);
  if (near.length) L.push('', `Post hoc reading (not part of the verdict): ${near.map((x) => NAME[x.id]).join(', ')} made money in both windows and beat the placebo's 95th percentile, but its month-sum t is under 2 (a few large time exits carry the mean; most trades are stopped). That is not evidence of an edge; a follow-up would need its own pre-registration on data not used here.`);
  const ck = r.detail.T1.windows.dec.clock.unconfirmed.filter((d) => d >= '2025-08-01');
  L.push('', `Caveat: the dates before August 2025 were written from memory of the central banks' calendars (the sandbox cannot reach their sites); \`dates.json\` lists the uncertain ones and where to check them. The ECB clock check (pre-registered) picks the larger of two candles, so on a quiet decision it can pick the wrong minute${ck.length ? ` (it did not confirm ${ck.join(', ')}, which come from the checked council calendar)` : ''}; the "not confirmed" dates above are where the date, the minute or the feed may be off.`);
  L.push('', 'To repeat: `node --use-env-proxy research/edge/ecb-boj-days/fetch.mjs <dir>`, then `node research/edge/ecb-boj-days/run.mjs <dir>`. Tests: `tests/ecb-boj-days.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const r = run(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(r));
  for (const x of r.tests) console.log(x.id, x.n, x.netR, x.monthT, x.holmP, x.repNetR, x.placeboP95, x.pass);
  console.log('pooled', r.pooled.n, r.pooled.netR, r.pooled.monthT, r.pooled.pass);
  console.log('verdict', r.verdict);
}
