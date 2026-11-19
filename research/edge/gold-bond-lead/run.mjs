// Do Treasury bond prices lead spot gold when gold lags them? (research/edge/gold-bond-lead; rules fixed in PREREGISTRATION.md)
// Paper research only: a standalone cross-asset signal, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-bond-lead/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-bond-lead/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const WLOOK = 52, DLOOK = 250, Z = 1, ATR_N = 20, STOP_ATR = 2, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a trade
export const KEYS = ['xau', 'usb10y', 'usb02y', 'usb30y'];
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', kind: 'week', market: 'usb10y', sides: [1], lag: true, hold: 5, what: '10-year bond up > 1 sd in a week, gold lagged its co-move: long gold for the next week (primary)' },
  { id: 'T2', kind: 'week', market: 'usb10y', sides: [-1], lag: true, hold: 5, what: '10-year bond down > 1 sd in a week, gold lagged: short gold for the next week (mirror)' },
  { id: 'T3', kind: 'day', market: 'usb02y', sides: [1, -1], lag: true, hold: 1, what: '2-year bond day > 1 sd with gold lagging its co-move: gold the bond\'s way for the next day' },
];
export const INFO = [
  { id: 'I1', kind: 'week', market: 'usb30y', sides: [1], lag: true, hold: 5, what: 'T1 rule on the 30-year bond (informational)' },
  { id: 'I2', kind: 'week', market: 'usb10y', sides: [1], lag: false, hold: 5, what: 'T1 without the lag condition: every 10-year up week > 1 sd, long gold (informational)' },
  { id: 'I3', kind: 'week', market: 'usb10y', sides: [-1], lag: false, hold: 5, what: 'T2 without the lag condition: every 10-year down week > 1 sd, short gold (informational)' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
const dayOf = (t) => Math.floor(t / DAY) * DAY;
const weekOf = (t) => { const d = dayOf(t), wd = (new Date(d * 1000).getUTCDay() + 6) % 7; return d - wd * DAY; };   // Monday 00:00 UTC

// aligned pairs: weekly (gold's last candle of each Monday week, bond on that same day) or daily (common days)
export function pairs(gold, bond, kind) {
  const bc = new Map(bond.map((b) => [dayOf(b.time), b.close]));
  let pts = gold.map((g) => ({ t: dayOf(g.time), g: g.close, b: bc.get(dayOf(g.time)) }));
  if (kind === 'week') {
    const last = new Map();
    for (const p of pts) last.set(weekOf(p.t), p);          // gold's last candle of the week
    pts = [...last.values()].filter((p) => p.b != null);   // the bond must have that same day stamp
  } else pts = pts.filter((p) => p.b != null);
  const gap = kind === 'week' ? 14 * DAY : 5 * DAY, out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], c = pts[i];
    out.push({ t: c.t, b: c.b / a.b - 1, g: c.g / a.g - 1, brk: c.t - a.t > gap });
  }
  return out;
}
const slope = (xs, ys) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxx > 0 ? sxy / sxx : 0;
};
// signal rows: z, beta, lag e for each pair with `look` earlier pairs in one unbroken chain (only earlier pairs used)
export function signals(prs, look) {
  const out = []; let start = 0;
  for (let i = 0; i < prs.length; i++) {
    if (prs[i].brk) { start = i + 1; continue; }   // a gap: this return spans the hole, history restarts after it
    if (i - start < look) continue;
    const w = prs.slice(i - look, i), bs = w.map((p) => p.b), gs = w.map((p) => p.g);
    const m = bs.reduce((a, b) => a + b, 0) / look, sd = Math.sqrt(bs.reduce((a, b) => a + (b - m) ** 2, 0) / (look - 1));
    if (!(sd > 0)) continue;
    const beta = slope(bs, gs), z = prs[i].b / sd, e = prs[i].g - beta * prs[i].b;
    out.push({ t: prs[i].t, z, beta, e, b: prs[i].b, g: prs[i].g });
  }
  return out;
}
// side of a signal row under a test: +1 / -1 / 0
export function sideOf(row, test, z = Z) {
  let s = 0;
  if (row.z > z && (!test.lag || row.e < 0)) s = 1;
  else if (row.z < -z && (!test.lag || row.e > 0)) s = -1;
  return test.sides.includes(s) ? s : 0;
}

// first gold candle whose UTC day is later than t
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

export function tradeAt(gold, j, side, hold, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = STOP_ATR * atr, e = gold[j].open, stop = e - side * risk;
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
export function simulate(days, gold, hold, { costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(gold, j, d.s, hold, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1)) : 0;
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
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  return {
    n: s.n, long: trades.filter((x) => x.side > 0).length, short: trades.filter((x) => x.side < 0).length,
    win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(stat(trades.map((x) => x.cost)).mean) : null, meanRisk: s.n ? r2(stat(trades.map((x) => x.risk)).mean) : null,
  };
}

export function runTest(test, gold, bond, { seeds = SEEDS, end = OOS_END } = {}) {
  const look = test.kind === 'week' ? WLOOK : DLOOK;
  const first = gold[ATR_N + 1] ? dayOf(gold[ATR_N + 1].time) : Infinity;
  const rows = signals(pairs(gold, bond, test.kind), look).filter((r) => r.t >= first);
  const win = { is: [rows.length ? rows[0].t : first, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
  const out = { id: test.id, kind: test.kind, market: test.market, sides: test.sides, lag: test.lag, hold: test.hold, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = rows.filter((d) => d.t >= from && d.t <= to).map((d) => ({ t: d.t, s: sideOf(d, test) })), sig = days.filter((d) => d.s);
    const tr = simulate(sig, gold, test.hold), tr2 = simulate(sig, gold, test.hold, { costX: 2 });
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const sides = sig.map((d) => d.s), ts = [];
        for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(placeboDays(days, sides, rng(s)), gold, test.hold), from, to).tMonth);
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sides.length, t: ts, atLeast2: ts.filter((t) => t != null && t >= 2).length, atLeastReal: ts.filter((t) => t != null && real != null && t >= real).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, c2 = t.is.netExact > 0, c3 = t.oos.x2 > 0, c4 = t.oos.n >= 30;
    t.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, n30: c4 }; t.pass = c1 && c2 && c3 && c4;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), m = Object.fromEntries(['usb10y', 'usb02y', 'usb30y'].map((k) => [k, load(dir, k)]));
  const tests = TESTS.map((t) => runTest(t, gold, m[t.market]));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const info = INFO.map((t) => { const r = runTest(t, gold, m[t.market], { seeds: 0 }); delete r.trades; return r; });
  // co-move context (descriptive): median beta of the T1 rows in each window
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  const ctx = {};
  for (const [k, kind, look] of [['usb10y', 'week', WLOOK], ['usb02y', 'day', DLOOK]]) {
    const rows = signals(pairs(gold, m[k], kind), look), med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? r3(s[Math.floor(s.length / 2)]) : null; };
    ctx[k] = { is: { rows: rows.filter((r) => r.t < SPLIT).length, medianBeta: med(rows.filter((r) => r.t < SPLIT).map((r) => r.beta)) }, oos: { rows: rows.filter((r) => r.t >= SPLIT && r.t <= OOS_END).length, medianBeta: med(rows.filter((r) => r.t >= SPLIT && r.t <= OOS_END).map((r) => r.beta)) } };
  }
  return { data: { xau: span(gold), usb10y: span(m.usb10y), usb02y: span(m.usb02y), usb30y: span(m.usb30y) }, coMove: ctx, tests, info, verdict };
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
    const out = { title: 'Treasury bond prices as a lead for spot gold when gold lags them', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { weekly: `bond weekly return z vs the ${WLOOK} weeks before > ${Z} (or < -${Z}) and gold's return less (more) than beta x the bond's (beta from the same ${WLOOK} weeks); entry next gold open, out at the close of the 5th gold candle`, daily: `same on the 2-year with ${DLOOK} days, held one candle`, stop: `${STOP_ATR} x ${ATR_N}-day ATR from the entry`, costs: `$${RT.toFixed(2)} a trade + nights() x FIN.xau.long on longs`, oneAtATime: true },
      fin: FIN.xau.long, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of [...r.tests, ...r.info]) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, x.from, x.to, 'elig', x.eligible, 'sig', x.signals, 'n', x.n, `(${x.long}/${x.short})`, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'tTr', x.tTrade, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost, 'tot', x.total); }
      if (t.p != null) console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('coMove', JSON.stringify(r.coMove));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
