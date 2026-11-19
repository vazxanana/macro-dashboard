// Does gold catch up with the other havens? (research/edge/gold-haven-catchup; rules fixed in PREREGISTRATION.md)
// Haven index H = equal-weight mean of the weekly log returns of the yen, the franc and the US 10-year Treasury CFD. Gold's
// weekly move is regressed on H over the 52 weeks before; a residual beyond 1 sd is faded (gold closes the gap: T1, T2), or
// gold follows a strong raw haven week (T3). Both-sided, against a same-side baseline and a seeded placebo.
// Paper research only: a stand-alone rule on gold, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-haven-catchup/run.mjs fetch <dir>   copy the daily caches out of origin/council-data
//   node research/edge/gold-haven-catchup/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 52, Z = 1, ATR_N = 20, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40, PLACEBO_NEED = 38;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const HAVEN = [['usdjpy', -1], ['usdchf', -1], ['usb10y', 1]];   // yen, franc, 10-year Treasury CFD, haven direction
export const KEYS = ['xau', ...HAVEN.map((c) => c[0])];
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', sig: 'ze', dir: -1, hold: 5, stopAtr: 2, what: "gold's weekly residual against the haven index beyond 1 sd, faded (gold closes the gap), 5 candles (primary)" },
  { id: 'T2', sig: 'ze', dir: -1, hold: 10, stopAtr: 3, what: 'the same residual signal held 10 candles, stop 3 x ATR(20)' },
  { id: 'T3', sig: 'zh', dir: 1, hold: 5, stopAtr: 2, what: 'raw haven week beyond 1 sd: gold the same way as the havens, 5 candles' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
export const weekOf = (t) => { const d = dayOf(t), wd = (new Date(d * 1000).getUTCDay() + 6) % 7; return d - wd * DAY; };

const closeMap = (bars) => new Map(bars.map((b) => [dayOf(b.time), b.close]));
// per day: gold (log) and the haven index level (mean of signed log prices); only days with every market
export function levels(gold, mk) {
  const cm = Object.fromEntries(HAVEN.map(([k]) => [k, closeMap(mk[k] || [])])), out = new Map();
  for (const g of gold) {
    const d = dayOf(g.time); let h = 0, ok = g.close > 0;
    for (const [k, sg] of HAVEN) { const c = cm[k].get(d); if (!(c > 0)) { ok = false; break; } h += sg * Math.log(c); }
    if (ok) out.set(d, { g: Math.log(g.close), h: h / HAVEN.length });
  }
  return out;
}
// weekly rows: gold's last candle of each Monday week; c = gold's week, d = H's week (consecutive qualifying week ends)
export function weeks(gold, lv) {
  const last = new Map();
  for (const g of gold) last.set(weekOf(g.time), dayOf(g.time));
  const pts = [...last.values()].map((t) => ({ t, ...lv.get(t) })).filter((p) => p.h != null).sort((a, b) => a.t - b.t);
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push({ t: pts[i].t, c: pts[i].g - pts[i - 1].g, d: pts[i].h - pts[i - 1].h, brk: pts[i].t - pts[i - 1].t > 14 * DAY });
  return out;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdev = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
// signal rows; each uses only the LOOK weeks before it (one unbroken history) and the week itself
export function signals(wk, look = LOOK) {
  const out = []; let start = 0;
  for (let i = 0; i < wk.length; i++) {
    if (wk[i].brk) { start = i + 1; continue; }
    if (i - start < look) continue;
    const w = wk.slice(i - look, i), cs = w.map((p) => p.c), ds = w.map((p) => p.d);
    const mc = mean(cs), md = mean(ds);
    let sxy = 0, sxx = 0; for (let k = 0; k < look; k++) { sxy += (ds[k] - md) * (cs[k] - mc); sxx += (ds[k] - md) ** 2; }
    const beta = sxx > 0 ? sxy / sxx : 0, alpha = mc - beta * md;
    const res = w.map((p) => p.c - alpha - beta * p.d), sdE = sdev(res), sdH = sdev(ds);
    if (!(sdE > 0) || !(sdH > 0)) continue;
    const e = wk[i].c - alpha - beta * wk[i].d;
    out.push({ t: wk[i].t, i, start, beta, e, sdE, ze: e / sdE, zh: wk[i].d / sdH });
  }
  return out;
}
export const sideOf = (row, sig, dir = 1, z = Z) => (row[sig] == null ? 0 : row[sig] > z ? dir : row[sig] < -z ? -dir : 0);

// ── trade ──
export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dayOf(gold[m].time) > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);
export function tradeAt(gold, j, side, hold, stopAtr, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = stopAtr * atr, e = gold[j].open, stop = e - side * risk;
  const through = (px) => (side > 0 ? px <= stop : px >= stop);
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (k > j && through(b.open)) { exit = b.open; kind = 'gap'; break; }
    if (through(side > 0 ? b.low : b.high)) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; }
  const t = dayOf(gold[j].time), c = exitStamp(dayOf(gold[k].time)), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
export function simulate(days, gold, test, { costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(gold, j, d.s, test.hold, test.stopAtr, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = mean(a), sd = n > 1 ? sdev(a) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(rows, from, to, key) {
  const a = mk(from), b = mk(Math.max(to, ...rows.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rows) m[mk(r.c) - a] += r[key];
  return { ...stat(m), months: m.length };
}
export function normP(t) {
  if (t == null) return 1;
  const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return t >= 0 ? (1 - erf) / 2 : (1 + erf) / 2;
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function placeboDays(eligible, sides, r) {
  const pick = shuffle(eligible, r).slice(0, sides.length).sort((x, y) => x.t - y.t), sd = shuffle(sides, r);
  return pick.map((d, i) => ({ t: d.t, s: sd[i] }));
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const side = (sd) => { const a = trades.filter((x) => x.side === sd); return { n: a.length, net: a.length ? r3(stat(a.map((x) => x.net)).mean) : null }; };
  const cost = s.n ? stat(trades.map((x) => x.cost)).mean : null;
  return {
    n: s.n, longs: side(1), shorts: side(-1),
    win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: r3(cost), costShare: cost != null && g.mean ? r3(cost / Math.abs(g.mean)) : null,
    meanRisk: s.n ? r2(stat(trades.map((x) => x.risk)).mean) : null, medianStop: s.n ? r2(median(trades.map((x) => x.risk))) : null,
  };
}

// same-side baseline: the same trade entered on every eligible week, long (and short), one at a time
export function baseline(days, gold, test) {
  const b = {};
  for (const sd of [1, -1]) { const tr = simulate(days.map((d) => ({ t: d.t, s: sd })), gold, test); b[sd] = { n: tr.length, net: tr.length ? stat(tr.map((x) => x.net)).mean : null }; }
  return b;
}
export function excessOf(trades, base) {
  if (!trades.length) return null;
  return mean(trades.map((x) => x.net - (base[x.side].net ?? 0)));
}

export function runTest(test, gold, rows, { seeds = SEEDS, end = OOS_END } = {}) {
  const first = gold[ATR_N + 1] ? dayOf(gold[ATR_N + 1].time) : Infinity;
  const ok = rows.filter((r) => r.t >= first && r[test.sig] != null);
  const win = { is: [ok.length ? ok[0].t : first, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
  const out = { id: test.id, sig: test.sig, dir: test.dir, hold: test.hold, stopAtr: test.stopAtr, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = ok.filter((d) => d.t >= from && d.t <= to).map((d) => ({ t: d.t, s: sideOf(d, test.sig, test.dir) })), sig = days.filter((d) => d.s);
    const tr = simulate(sig, gold, test), tr2 = simulate(sig, gold, test, { costX: 2 }), base = baseline(days, gold, test);
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2),
      baseline: { long: { n: base[1].n, net: r3(base[1].net) }, short: { n: base[-1].n, net: r3(base[-1].net) } }, excess: r3(excessOf(tr, base)) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const sides = tr.map((x) => x.side), ts = [];
        for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(placeboDays(days, sides, rng(s)), gold, test), from, to).tMonth);
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sides.length, t: ts, beaten: ts.filter((t) => real != null && (t == null || real > t)).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, c2 = t.is.netExact > 0, c3 = t.oos.x2 > 0, c4 = t.oos.excess > 0, c5 = (t.placebo?.beaten ?? 0) >= PLACEBO_NEED, c6 = t.oos.n >= 30;
    t.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, beatsBaseline: c4, placebo38: c5, n30: c6 }; t.pass = c1 && c2 && c3 && c4 && c5 && c6;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), mkts = Object.fromEntries(HAVEN.map(([k]) => [k, load(dir, k)]));
  const rows = signals(weeks(gold, levels(gold, mkts)));
  const tests = TESTS.map((t) => runTest(t, gold, rows));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  const isR = rows.filter((r) => r.t < SPLIT), oosR = rows.filter((r) => r.t >= SPLIT && r.t <= OOS_END);
  const beta = { is: { rows: isR.length, medianBeta: r3(median(isR.map((r) => r.beta))) }, oos: { rows: oosR.length, medianBeta: r3(median(oosR.map((r) => r.beta))) } };
  return { data: { xau: span(gold), ...Object.fromEntries(Object.entries(mkts).map(([k, b]) => [k, span(b)])) }, beta, tests, verdict };
}

const main = async () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const sha = execFileSync('git', ['rev-parse', 'origin/council-data'], { encoding: 'utf8' }).trim();
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `${sha}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'SOURCE'), sha + '\n');
    console.log('council-data', sha, '->', dir);
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Does gold catch up with the other havens (yen, franc, US 10-year Treasury)?', built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { haven: 'equal-weight mean of weekly log returns of 1/USDJPY, 1/USDCHF, USB10Y', residual: `e = g - alpha - beta x h, OLS on the ${LOOK} weeks before`, entry: 'next gold daily open; T1/T3 held 5 candles, stop 2 x ATR(20); T2 held 10 candles, stop 3 x ATR(20)', costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on longs`, oneAtATime: true },
      fin: FIN.xau.long, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, x.from, x.to, 'elig', x.eligible, 'sig', x.signals, 'n', x.n, JSON.stringify(x.longs), JSON.stringify(x.shorts), 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'tTr', x.tTrade, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost, 'share', x.costShare, 'medStop', x.medianStop, 'base', JSON.stringify(x.baseline), 'excess', x.excess, 'tot', x.total); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('beta', JSON.stringify(r.beta));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
