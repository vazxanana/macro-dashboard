// Price "value" across index and commodity CFDs (Asness, Moskowitz & Pedersen 2013), monthly rebalance; pre-registered
// 14 Nov 2026 (PREREGISTRATION.md, pushed alone first). Value at month S = mean ln(month-end close, S-66..S-54) - ln(close S).
// Within each group: long the cheapest third, short the dearest third at the next month's first open, 1R = stop = 3 x ATR(20),
// out at the month's last close. Primary = indices + commodities equal-weighted, net of an assumed round trip and 3 % a year
// financing on every leg. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const GROUPS = {
  indices: ['au200', 'ch20', 'de40', 'eu50', 'fr40', 'hk33', 'jp225', 'nas100', 'nl25', 'sg30', 'spx500', 'uk100', 'us2000', 'us30'],
  commodities: ['xau', 'xag', 'xpt', 'xpd', 'xcu', 'bco', 'wtico', 'natgas', 'corn', 'wheat', 'soybn', 'sugar'],
};
export const P = {
  V_FROM: 54, V_TO: 66, M_LOOK: 12, M_SKIP: 1, MIN_SCORED: 9, ATR_N: 20, ATR_MULT: 3,
  COST_ABS: { xau: 0.30, xag: 0.03 }, COST_FRAC: { indices: 0.0004, commodities: 0.0006 }, FIN_YEAR: 0.03,
  SEEDS: 40, NW_LAGS: 3,
};
export const IS_TO = '2016-12';
export const OOS = { from: '2017-01', to: '2026-10' };
const DAY = 86400;

// ─── calendar ───
export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function shiftYm(s, k) { const [y, m] = s.split('-').map(Number), n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`; }
export const rowsToBars = (rows) => rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export function indexMarket(key, group, bars) {
  const first = new Map(), last = new Map();
  bars.forEach((b, i) => { const k = ym(b.time); if (!first.has(k)) first.set(k, i); last.set(k, i); });
  return { key, group, bars, first, last };
}
export function monthsBetween(from, to) { const out = []; for (let s = from; s <= to; s = shiftYm(s, 1)) out.push(s); return out; }

// ─── signals (month-end closes up to and including S only) ───
export function valueScore(mk, S) {
  if (!mk.last.has(S)) return null;
  let s = 0, n = 0;
  for (let k = P.V_FROM; k <= P.V_TO; k++) { const i = mk.last.get(shiftYm(S, -k)); if (i == null) return null; s += Math.log(mk.bars[i].close); n++; }
  return s / n - Math.log(mk.bars[mk.last.get(S)].close);
}
export function momentum(mk, S) {
  if (!mk.last.has(S)) return null;
  const a = mk.last.get(shiftYm(S, -P.M_LOOK)), b = mk.last.get(shiftYm(S, -P.M_SKIP));
  if (a == null || b == null) return null;
  return mk.bars[b].close / mk.bars[a].close - 1;
}
export const SIGNALS = { value: valueScore, momentum };
// markets of one group, highest score first (ties: fixed universe order)
export function rankAt(mks, S, sig) {
  const r = [];
  mks.forEach((mk, k) => { const v = SIGNALS[sig](mk, S); if (v != null && Number.isFinite(v)) r.push({ key: mk.key, k, v }); });
  return r.sort((x, y) => y.v - x.v || x.k - y.k).map((x) => x.key);
}
export function thirds(ranked) { const k = Math.floor(ranked.length / 3); return { long: ranked.slice(0, k), short: ranked.slice(ranked.length - k) }; }

export function atr(bars, d, n = P.ATR_N) {
  if (d - n < 0) return null;
  let s = 0;
  for (let i = d - n + 1; i <= d; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// one leg: entry at bars[e].open, stop at 1R (a candle opening beyond it fills at its open), else out at bars[x].close
export function simLeg(bars, e, x, side, dist) {
  const entry = bars[e].open, stop = side > 0 ? entry - dist : entry + dist;
  for (let i = e; i <= x; i++) {
    const b = bars[i];
    if (side > 0 && b.low <= stop) { const gap = b.open <= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
    if (side < 0 && b.high >= stop) { const gap = b.open >= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
  }
  return { entry, stop, exit: bars[x].close, exitIdx: x, how: 'close' };
}
export const exitTime = (t, how) => (how === 'close' ? t + DAY : how === 'gap' ? t : t + DAY / 2);
export const costOf = (mk, px) => (P.COST_ABS[mk.key] != null ? P.COST_ABS[mk.key] : P.COST_FRAC[mk.group] * px);
export function leg(mk, S, H, side) {
  const d = mk.last.get(S), e = mk.first.get(H), x = mk.last.get(H);
  if (d == null || e == null || x == null) return null;
  const a = atr(mk.bars, d); if (!a) return null;
  const dist = P.ATR_MULT * a, L = simLeg(mk.bars, e, x, side, dist);
  const gross = (side * (L.exit - L.entry)) / dist;
  const costR = costOf(mk, L.entry) / dist;
  const n = nights(mk.bars[e].time, exitTime(mk.bars[L.exitIdx].time, L.how));
  const finR = (n * (P.FIN_YEAR / 365) * L.entry) / dist;
  return { key: mk.key, side, gross, costR, finR, nights: n, how: L.how };
}

// ─── a group's book: one row per holding month H (signal month S = H - 1) ───
export function groupBook(mks, months, sig, { order } = {}) {
  const byKey = Object.fromEntries(mks.map((m) => [m.key, m])), out = new Map();
  for (const H of months) {
    const S = shiftYm(H, -1);
    let ranked = rankAt(mks, S, sig);
    if (ranked.length < P.MIN_SCORED) continue;
    if (order) ranked = order(ranked);
    const pk = thirds(ranked), legs = [];
    for (const [ks, side] of [[pk.long, 1], [pk.short, -1]]) for (const k of ks) { const l = leg(byKey[k], S, H, side); if (l) legs.push(l); }
    if (legs.length) out.set(H, { month: H, scored: ranked.length, long: pk.long, short: pk.short, legs });
  }
  return out;
}
export const legNet = (l, k = 1) => l.gross - k * (l.costR + l.finR);
export const monthR = (row, k = 1) => row.legs.reduce((s, l) => s + legNet(l, k), 0) / row.legs.length;
// series of { month, r(k) } from one book (Map) or the mean of several (only months all hold)
export function series(books, w) {
  w ||= books.map(() => 1 / books.length);
  const months = [...books[0].keys()].filter((m) => books.every((b) => b.has(m))).sort();
  return months.map((m) => ({ month: m, r: (k) => books.reduce((s, b, i) => s + w[i] * monthR(b.get(m), k), 0) }));
}

// ─── statistics ───
export function neweyWestT(v, lags = P.NW_LAGS) {
  const n = v.length; if (n < 2) return 0;
  const mu = v.reduce((a, b) => a + b, 0) / n, e = v.map((x) => x - mu);
  const g = (l) => { let s = 0; for (let i = l; i < n; i++) s += e[i] * e[i - l]; return s / n; };
  let lrv = g(0); for (let l = 1; l <= lags; l++) lrv += 2 * (1 - l / (lags + 1)) * g(l);
  return lrv > 0 ? mu / Math.sqrt(lrv / n) : 0;
}
const r3 = (v, k = 3) => +v.toFixed(k);
export function tPlain(v) { const n = v.length; if (n < 2) return 0; const mu = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)); return sd ? (mu / sd) * Math.sqrt(n) : 0; }
export function stats(vals) {
  const n = vals.length; if (!n) return { n: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let cum = 0, peak = 0, dd = 0; for (const v of vals) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { n, mean: r3(mean, 4), total: r3(cum, 2), t: r3(tPlain(vals), 2), tNW: r3(neweyWestT(vals), 2), sharpe: sd ? r3((mean / sd) * Math.sqrt(12), 2) : 0, dd: r3(dd, 2), posPct: r3((vals.filter((v) => v > 0).length / n) * 100, 1) };
}
// standard normal CDF (Abramowitz & Stegun 7.1.26)
export function phi(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2); return x >= 0 ? (1 + y) / 2 : (1 - y) / 2; }
export const pTwo = (t) => 2 * (1 - phi(Math.abs(t)));
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[i] = run; });
  return adj;
}
export function percentile(vals, q) { const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h); return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo]; }
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffler(rng) { return (ranked) => { const c = [...ranked]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; }; }
export function corr(a, b) { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let sab = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return sab / Math.sqrt(sa * sb); }

const inW = (from, to) => (x) => x.month >= from && x.month <= to;
export function windowSummary(ser) {
  const v = (k) => ser.map((x) => x.r(k));
  return { from: ser[0]?.month, to: ser.at(-1)?.month, gross: stats(v(0)), net: stats(v(1)), net2x: stats(v(2)) };
}
function legStats(books, from, to) {
  const legs = books.flatMap((b) => [...b.values()].filter(inW(from, to)).flatMap((m) => m.legs)), n = legs.length;
  if (!n) return { n: 0 };
  const sum = (f) => legs.reduce((s, l) => s + f(l), 0);
  return { n, winPct: r3((legs.filter((l) => legNet(l) > 0).length / n) * 100, 1), stopped: legs.filter((l) => l.how !== 'close').length, gapFills: legs.filter((l) => l.how === 'gap').length, avgGross: r3(sum((l) => l.gross) / n), avgCost: r3(sum((l) => l.costR) / n), avgFin: r3(sum((l) => l.finR) / n) };
}
function perMarket(book, from, to) {
  const o = {};
  for (const m of [...book.values()].filter(inW(from, to))) for (const l of m.legs) { const r = (o[l.key] ||= { long: 0, short: 0, netR: 0 }); r[l.side > 0 ? 'long' : 'short']++; r.netR += legNet(l); }
  for (const k in o) o[k].netR = r3(o[k].netR, 2);
  return o;
}
function perYear(ser) { const o = {}; for (const x of ser) { const y = x.month.slice(0, 4); (o[y] ||= { months: 0, gross: 0, net: 0 }); o[y].months++; o[y].gross += x.r(0); o[y].net += x.r(1); } for (const y in o) { o[y].gross = r3(o[y].gross, 2); o[y].net = r3(o[y].net, 2); } return o; }

// ─── the whole study ───
export function study(groups, lastMonth) {
  const all = monthsBetween('2003-01', lastMonth);
  const V = { indices: groupBook(groups.indices, all, 'value'), commodities: groupBook(groups.commodities, all, 'value') };
  const M = { indices: groupBook(groups.indices, all, 'momentum'), commodities: groupBook(groups.commodities, all, 'momentum') };
  // value + momentum per group as one book of averaged legs is not what is wanted: each half is averaged as a book
  const vmGroup = (g) => series([V[g], M[g]]);
  const toMap = (ser) => new Map(ser.map((x) => [x.month, x]));
  const vmI = toMap(vmGroup('indices')), vmC = toMap(vmGroup('commodities'));
  const vmMonths = [...vmI.keys()].filter((m) => vmC.has(m)).sort();
  const sers = {
    T1: series([V.indices, V.commodities]),
    T2: series([V.indices]),
    T3: series([V.commodities]),
    T4: vmMonths.map((m) => ({ month: m, r: (k) => (vmI.get(m).r(k) + vmC.get(m).r(k)) / 2 })),
  };
  const tests = {};
  for (const [name, ser] of Object.entries(sers)) {
    const is = ser.filter((x) => x.month <= IS_TO), oos = ser.filter(inW(OOS.from, OOS.to));
    tests[name] = { inSample: windowSummary(is), oos: windowSummary(oos), byYear: perYear(ser.filter((x) => x.month <= OOS.to)) };
  }
  const names = Object.keys(tests), ps = names.map((n) => pTwo(tests[n].oos.net.t)), adj = holm(ps);
  names.forEach((n, i) => { tests[n].oos.p = r3(ps[i], 4); tests[n].oos.pHolm = r3(adj[i], 4); });

  // placebo: random order inside each group, the same machinery; T4's value half randomised, momentum kept
  const oosMonths = monthsBetween(OOS.from, OOS.to), placebo = { T1: [], T2: [], T3: [], T4: [] };
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  for (let s = 1; s <= P.SEEDS; s++) {
    const rng = mulberry32(s), order = shuffler(rng);
    const pi = groupBook(groups.indices, oosMonths, 'value', { order }), pc = groupBook(groups.commodities, oosMonths, 'value', { order });
    placebo.T1.push(mean(series([pi, pc]).map((x) => x.r(1))));
    placebo.T2.push(mean(series([pi]).map((x) => x.r(1))));
    placebo.T3.push(mean(series([pc]).map((x) => x.r(1))));
    const a = toMap(series([pi, M.indices])), b = toMap(series([pc, M.commodities]));
    placebo.T4.push(mean([...a.keys()].filter((m) => b.has(m) && m >= OOS.from && m <= OOS.to).map((m) => (a.get(m).r(1) + b.get(m).r(1)) / 2)));
  }
  const pl = {};
  for (const n of names) {
    const real = tests[n].oos.net.mean, d = placebo[n];
    pl[n] = { real, p5: r3(percentile(d, 0.05), 4), p50: r3(percentile(d, 0.5), 4), p95: r3(percentile(d, 0.95), 4), beaten: d.filter((x) => x < real).length, of: d.length };
  }
  const checksOf = (n) => {
    const T = tests[n];
    return { oosPositiveT2Holm: T.oos.net.mean > 0 && T.oos.net.t >= 2 && T.oos.pHolm <= 0.05, inSamplePositive: T.inSample.net.mean > 0, oos2xPositive: T.oos.net2x.mean > 0, abovePlacebo95: T.oos.net.mean > pl[n].p95 };
  };
  const checks = Object.fromEntries(names.map((n) => [n, checksOf(n)]));
  const pass = Object.fromEntries(names.map((n) => [n, Object.values(checks[n]).every(Boolean)]));

  // reported only
  const momOnly = {};
  for (const g of ['indices', 'commodities']) {
    const ser = series([M[g]]);
    momOnly[g] = { inSample: windowSummary(ser.filter((x) => x.month <= IS_TO)), oos: windowSummary(ser.filter(inW(OOS.from, OOS.to))) };
  }
  const corrOf = (g, from, to) => { const vs = toMap(series([V[g]])), ms = toMap(series([M[g]])); const k = [...vs.keys()].filter((m) => ms.has(m) && m >= from && m <= to); return k.length > 2 ? r3(corr(k.map((m) => vs.get(m).r(1)), k.map((m) => ms.get(m).r(1))), 3) : null; };
  const firstOf = (book) => [...book.keys()].sort()[0];
  return {
    study: 'value-everywhere', built: '2026-11-14',
    rule: 'value = mean ln(close, 4.5-5.5 years ago) - ln(close now); per group long cheapest third / short dearest third, 1R = 3 x ATR(20) stop, one month',
    params: P, universe: GROUPS, lastMonth,
    data: Object.fromEntries([...groups.indices, ...groups.commodities].map((m) => [m.key, { group: m.group, first: ym(m.bars[0].time), last: new Date(m.bars.at(-1).time * 1000).toISOString().slice(0, 10), candles: m.bars.length, firstValueSignal: all.find((S) => valueScore(m, S) != null) || null }])),
    firstBookMonth: { valueIndices: firstOf(V.indices), valueCommodities: firstOf(V.commodities), momIndices: firstOf(M.indices), momCommodities: firstOf(M.commodities), T1: sers.T1[0]?.month, T4: sers.T4[0]?.month },
    windows: { inSample: { to: IS_TO }, oos: OOS },
    tests, placebo: pl, checks, pass, verdict: pass.T1 ? 'PASS' : 'FAIL',
    legs: {
      inSample: { indices: legStats([V.indices], '2000-01', IS_TO), commodities: legStats([V.commodities], '2000-01', IS_TO) },
      oos: { indices: legStats([V.indices], OOS.from, OOS.to), commodities: legStats([V.commodities], OOS.from, OOS.to) },
    },
    byMarket: { oos: { indices: perMarket(V.indices, OOS.from, OOS.to), commodities: perMarket(V.commodities, OOS.from, OOS.to) } },
    momentumOnly: momOnly,
    valueMomentumCorr: { indices: { inSample: corrOf('indices', '2000-01', IS_TO), oos: corrOf('indices', OOS.from, OOS.to) }, commodities: { inSample: corrOf('commodities', '2000-01', IS_TO), oos: corrOf('commodities', OOS.from, OOS.to) } },
    months: sers.T1.filter((x) => x.month <= OOS.to).map((x) => ({ month: x.month, gross: r3(x.r(0), 4), net: r3(x.r(1), 4), longI: V.indices.get(x.month).long, shortI: V.indices.get(x.month).short, longC: V.commodities.get(x.month).long, shortC: V.commodities.get(x.month).short })),
  };
}

// ─── data ───
const gitRead = (k) => execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 });
export function loadGroups(read = gitRead) {
  const o = {};
  for (const [g, keys] of Object.entries(GROUPS)) o[g] = keys.map((k) => indexMarket(k, g, foldWeekend(rowsToBars(JSON.parse(read(k)).rows))));
  return o;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = study(loadGroups(), '2026-10');
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  console.log(res.verdict, JSON.stringify(res.pass), res.firstBookMonth);
  for (const [n, T] of Object.entries(res.tests)) console.log(n, 'IS', T.inSample.from, T.inSample.net, '| gross', T.inSample.gross.mean, T.inSample.gross.t, '\n   OOS', T.oos.net, 'gross', T.oos.gross.mean, T.oos.gross.t, '2x', T.oos.net2x.mean, 'p', T.oos.p, 'holm', T.oos.pHolm, '\n   placebo', res.placebo[n], res.checks[n]);
  console.log('legs', JSON.stringify(res.legs));
  console.log('mom', JSON.stringify(Object.fromEntries(Object.entries(res.momentumOnly).map(([g, v]) => [g, { is: v.inSample.net, oos: v.oos.net }]))));
  console.log('corr', JSON.stringify(res.valueMomentumCorr));
  console.log('byYear T1', JSON.stringify(res.tests.T1.byYear));
  console.log('byMarket', JSON.stringify(res.byMarket));
}
