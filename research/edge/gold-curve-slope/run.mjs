// Does the US yield curve's slope tell spot gold's next weeks? (research/edge/gold-curve-slope; rules fixed in PREREGISTRATION.md)
// Paper research only: a stand-alone gold rule, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-curve-slope/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-curve-slope/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 156, WIN = 4, Z = 1, ATR_N = 20, STOP_ATR = 2, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const DUR = { usb02y: 1.9, usb10y: 8.0, usb30y: 17.0 };   // assumed modified durations (pre-registered)
export const KEYS = ['xau', 'usb02y', 'usb10y', 'usb30y'];
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', long: 'usb30y', hold: 20, what: '2s30s 4-week slope change z > +1: long gold, z < -1: short gold, 20 gold candles (primary)' },
  { id: 'T2', long: 'usb10y', hold: 20, what: '2s10s 4-week slope change, same rule, 20 gold candles' },
  { id: 'T3', long: 'usb30y', hold: 5, what: '2s30s 4-week slope change, same rule, 5 gold candles' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
export const weekOf = (t) => { const d = dayOf(t), wd = (new Date(d * 1000).getUTCDay() + 6) % 7; return d - wd * DAY; };

// weekly points: gold's last candle of each Monday week, both bonds on that same day stamp; brk = a hole > 14 days before it
export function weekly(gold, short, long) {
  const sc = new Map(short.map((b) => [dayOf(b.time), b.close])), lc = new Map(long.map((b) => [dayOf(b.time), b.close]));
  const last = new Map();
  for (const g of gold) last.set(weekOf(g.time), dayOf(g.time));
  const pts = [...last.values()].map((t) => ({ t, s: sc.get(t), l: lc.get(t) })).filter((p) => p.s != null && p.l != null);
  return pts.map((p, i) => ({ ...p, brk: i > 0 && p.t - pts[i - 1].t > 14 * DAY }));
}
// slope change over WIN weeks (positive = steepening) and its z against the LOOK earlier values (only earlier data)
export function signals(pts, dShort, dLong, look = LOOK, win = WIN) {
  const ds = [], out = []; let start = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].brk) { start = i; ds.length = 0; }
    if (i - start < win) continue;
    const a = pts[i - win], c = pts[i];
    const dyS = -Math.log(c.s / a.s) / dShort, dyL = -Math.log(c.l / a.l) / dLong, d = dyL - dyS;
    if (ds.length >= look) {
      const w = ds.slice(-look), m = w.reduce((x, y) => x + y, 0) / look, sd = Math.sqrt(w.reduce((x, y) => x + (y - m) ** 2, 0) / (look - 1));
      if (sd > 0) out.push({ t: c.t, ds: d, z: d / sd, dyL, dyS });
    }
    ds.push(d);
  }
  return out;
}
export const sideOf = (row, z = Z) => (row.z > z ? 1 : row.z < -z ? -1 : 0);

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
  const risk = STOP_ATR * atr, e = gold[j].open, stop = e - side * risk;   // every trade has a stop
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
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const side = (k) => { const a = trades.filter((x) => x.side === k); return a.length ? r3(stat(a.map((x) => x.net)).mean) : null; };
  const costSum = trades.reduce((a, x) => a + x.cost, 0), grossSum = trades.reduce((a, x) => a + x.gross, 0);
  return {
    n: s.n, long: trades.filter((x) => x.side > 0).length, short: trades.filter((x) => x.side < 0).length,
    netLong: side(1), netShort: side(-1),
    win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(costSum / s.n) : null, costShare: grossSum > 0 ? r3(costSum / grossSum) : null,
    medianStopUsd: s.n ? r2(median(trades.map((x) => x.risk))) : null,
  };
}

const windowsOf = (rows, gold, end) => {
  const first = gold[ATR_N + 1] ? dayOf(gold[ATR_N + 1].time) : Infinity;
  const from = Math.max(first, rows.length ? rows[0].t : first);
  return { is: [from, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
};

export function runTest(test, gold, bonds, { seeds = SEEDS, end = OOS_END } = {}) {
  const rows = signals(weekly(gold, bonds.usb02y, bonds[test.long]), DUR.usb02y, DUR[test.long]);
  const win = windowsOf(rows, gold, end);
  const out = { id: test.id, long: test.long, hold: test.hold, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = rows.filter((d) => d.t >= from && d.t <= to).map((d) => ({ t: d.t, s: sideOf(d) })), sig = days.filter((d) => d.s);
    const tr = simulate(sig, gold, test.hold), tr2 = simulate(sig, gold, test.hold, { costX: 2 });
    // unconditional same-side baselines: every eligible week long / every eligible week short
    const bl = simulate(days.map((d) => ({ t: d.t, s: 1 })), gold, test.hold), bs = simulate(days.map((d) => ({ t: d.t, s: -1 })), gold, test.hold);
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2),
      baseline: { allLong: summarize(bl, from, to), allShort: summarize(bs, from, to) } };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const sides = sig.map((d) => d.s), ts = [];
        for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(placeboDays(days, sides, rng(s)), gold, test.hold), from, to).tMonth);
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sides.length, t: ts, atLeastReal: ts.filter((t) => t != null && real != null && t >= real).length, beaten: ts.filter((t) => t != null && real != null && t < real).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, c2 = t.is.netExact > 0, c3 = t.oos.x2 > 0, c4 = t.oos.n >= 30, c5 = t.placebo.beaten >= 38;
    t.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, n30: c4, placebo38: c5 }; t.pass = c1 && c2 && c3 && c4 && c5;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

// informational: bear steepening longs (z > +1 and the long yield rose) vs every-week longs; T1 year by year
export function info(gold, bonds) {
  const rows = signals(weekly(gold, bonds.usb02y, bonds.usb30y), DUR.usb02y, DUR.usb30y), win = windowsOf(rows, gold, OOS_END), out = { bear: {}, years: {} };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = rows.filter((d) => d.t >= from && d.t <= to);
    out.bear[w] = summarize(simulate(days.filter((d) => d.z > Z && d.dyL > 0).map((d) => ({ t: d.t, s: 1 })), gold, 20), from, to);
  }
  const all = rows.filter((d) => d.t >= win.is[0] && d.t <= win.oos[1]).map((d) => ({ t: d.t, s: sideOf(d) })).filter((d) => d.s);
  for (const x of simulate(all, gold, 20)) { const y = new Date(x.c * 1000).getUTCFullYear(); out.years[y] = r2((out.years[y] || 0) + x.net); }
  return out;
}

export function study(dir) {
  const gold = load(dir, 'xau'), bonds = Object.fromEntries(['usb02y', 'usb10y', 'usb30y'].map((k) => [k, load(dir, k)]));
  const tests = TESTS.map((t) => runTest(t, gold, bonds));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), usb02y: span(bonds.usb02y), usb10y: span(bonds.usb10y), usb30y: span(bonds.usb30y) }, tests, info: info(gold, bonds), verdict };
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
    const out = { title: 'The US yield curve slope as a signal for spot gold over the next weeks', built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { slope: `4-week change of (long yield - 2-year yield), yields proxied by -ln(price change) / duration (${JSON.stringify(DUR)}); z vs the ${LOOK} earlier weekly values`, sides: `z > ${Z} long gold, z < -${Z} short gold`, entry: 'next gold open after the signal week', stop: `${STOP_ATR} x ${ATR_N}-day ATR from the entry`, costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on longs`, oneAtATime: true },
      fin: FIN.xau.long, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, x.from, x.to, 'elig', x.eligible, 'sig', x.signals, 'n', x.n, `(${x.long}/${x.short})`, 'L', x.netLong, 'S', x.netShort, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost, 'share', x.costShare, 'stop$', x.medianStopUsd, 'tot', x.total, '| allL', x.baseline.allLong.net, x.baseline.allLong.n, 'allS', x.baseline.allShort.net, x.baseline.allShort.n); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('info', JSON.stringify(r.info));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
