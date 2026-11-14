// Is gold stretched against Brent crude a signal for gold? (research/edge/gold-brent-ratio; rules fixed in PREREGISTRATION.md)
// Paper research only: a stand-alone rule on spot gold, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-brent-ratio/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-brent-ratio/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 250, ZIN = 2, ZARM = 1, ATR_N = 20, STOP_ATR = 3, HOLD = 20, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const KEYS = ['xau', 'bco'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', sides: [1, -1], what: 'both sides pooled (primary)' },
  { id: 'T2', sides: [1], what: 'longs only: gold cheap against Brent' },
  { id: 'T3', sides: [-1], what: 'shorts only: gold expensive against Brent' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));

// ── z of ln(gold / Brent) over the LOOK values ending at the day (day included); matched by UTC day stamp ──
export function ratioZ(gold, brent, look = LOOK) {
  const bm = new Map(brent.map((b) => [b.time, b.close])), xs = [], out = [];
  for (const g of gold) {
    const b = bm.get(g.time);
    if (!(b > 0) || !(g.close > 0)) continue;
    xs.push(Math.log(g.close / b));
    if (xs.length < look) continue;
    const w = xs.slice(-look), m = w.reduce((a, c) => a + c, 0) / look;
    const sd = Math.sqrt(w.reduce((a, c) => a + (c - m) ** 2, 0) / (look - 1));
    out.push({ t: g.time, x: xs[xs.length - 1], z: sd > 0 ? (xs[xs.length - 1] - m) / sd : 0 });
  }
  return out;
}
// signals: short on a cross above +ZIN, long on a cross below -ZIN; each side re-armed once |z| < ZARM after its signal
export function signals(zs, zin = ZIN, zarm = ZARM) {
  let armL = true, armS = true; const out = [];
  for (const d of zs) {
    if (Math.abs(d.z) < zarm) { armL = true; armS = true; }
    if (armS && d.z > zin) { out.push({ t: d.t, s: -1, z: d.z }); armS = false; }
    else if (armL && d.z < -zin) { out.push({ t: d.t, s: 1, z: d.z }); armL = false; }
  }
  return out;
}

export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (gold[m].time > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

export function tradeAt(gold, j, side, hold = HOLD, costX = 1) {
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
  const t = gold[j].time, c = exitStamp(gold[k].time), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}

export function simulate(sigs, gold, { costX = 1, hold = HOLD } = {}) {
  const out = []; let lastK = -1;
  for (const d of sigs) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(gold, j, d.s, hold, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}
// unconditional same-side baseline: a trade at every gold open of [from, to] (overlapping), mean net R
export function baseline(gold, side, from, to) {
  const v = [];
  for (let j = 0; j < gold.length; j++) {
    if (gold[j].time < from || gold[j].time > to) continue;
    const tr = tradeAt(gold, j, side); if (tr) v.push(tr.net);
  }
  return stat(v);
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
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function summarize(trades, from, to, x2, base) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const absG = stat(trades.map((x) => Math.abs(x.gross))).mean, mc = stat(trades.map((x) => x.cost)).mean;
  const ex = base && trades.length ? stat(trades.map((x) => x.net - base[x.side].mean)).mean : null;
  return {
    n: s.n, long: trades.filter((x) => x.side > 0).length, short: trades.filter((x) => x.side < 0).length,
    win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined, excess: r3(ex),
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(mc) : null, costShare: s.n && absG > 0 ? r3(mc / absG) : null,
    medianStop: s.n ? r2(median(trades.map((x) => x.risk))) : null,
  };
}

export function runTest(test, gold, zs, { seeds = SEEDS, end = OOS_END } = {}) {
  const sigAll = signals(zs).filter((d) => test.sides.includes(d.s));
  const win = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(end, gold[gold.length - 1].time + DAY - 1)] };
  const out = { id: test.id, sides: test.sides, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const sig = sigAll.filter((d) => d.t >= from && d.t <= to), days = zs.filter((d) => d.t >= from && d.t <= to);
    const base = { 1: baseline(gold, 1, from, to), [-1]: baseline(gold, -1, from, to) };
    const tr = simulate(sig, gold), tr2 = simulate(sig, gold, { costX: 2 });
    out[w] = { from: iso(from), to: iso(to), signals: sig.length, baseLong: r3(base[1].mean), baseShort: r3(base[-1].mean), ...summarize(tr, from, to, tr2, base) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const sides = tr.map((x) => x.side), ts = [];
        for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(placeboDays(days, sides, rng(s)), gold), from, to).tMonth);
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sides.length, t: ts, atLeast2: ts.filter((t) => t != null && t >= 2).length, atLeastReal: ts.filter((t) => t != null && real != null && t >= real).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, c2 = t.is.netExact > 0, c3 = t.oos.x2 > 0, c4 = t.oos.excess > 0, c5 = t.oos.n >= 30;
    t.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, beatsBaseline: c4, n30: c5 }; t.pass = c1 && c2 && c3 && c4 && c5;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), brent = load(dir, 'bco'), zs = ratioZ(gold, brent);
  const tests = TESTS.map((t) => runTest(t, gold, zs));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), bco: span(brent), firstZ: iso(zs[0].t) }, tests, verdict };
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
    const out = { title: 'Gold stretched against Brent crude as a signal for gold', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { signal: `z of ln(gold / Brent) over ${LOOK} days: short above +${ZIN}, long below -${ZIN}, re-armed under |z| ${ZARM}`, entry: "gold's next folded UTC daily open", stop: `${STOP_ATR} x ${ATR_N}-day ATR from the entry`, exit: `close of the ${HOLD}th gold candle (entry candle = 1)`, costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on longs`, oneAtATime: true },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, 'n', x.n, `(${x.long}/${x.short})`, 'sig', x.signals, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'excess', x.excess, 'base', x.baseLong, x.baseShort, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost, 'share', x.costShare, 'medStop', x.medianStop); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
