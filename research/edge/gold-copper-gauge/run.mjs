// The gold / copper ratio as a fear gauge for spot gold (research/edge/gold-copper-gauge; rules fixed in PREREGISTRATION.md)
// Ratio Q = ln(gold / copper) at a new 20-row high -> buy gold 5 candles (T1), new low -> sell (T2), the copper-driven part
// (ratio extreme while gold is not at its own extreme the same way) both sides (T3). Measured as excess over the same side
// traded on every eligible day. Paper research only: a stand-alone rule on gold, never part of the live gold book (decision 44).
//   node research/edge/gold-copper-gauge/run.mjs fetch <dir>   copy the daily caches out of origin/council-data
//   node research/edge/gold-copper-gauge/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 20, HOLD = 5, STOP_ATR = 2, ATR_N = 20, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40, NEED = 38, MIN_N = 100;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const KEYS = ['xau', 'xcu'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', what: 'gold / copper ratio at a new 20-row high: buy gold for 5 candles (primary)' },
  { id: 'T2', what: 'gold / copper ratio at a new 20-row low: sell gold for 5 candles' },
  { id: 'T3', what: 'ratio extreme while gold is not at its own 20-day extreme the same way: gold the ratio\'s way for 5 candles' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

// one row per gold candle that has a copper candle on the same UTC day; flags read only rows / candles at or before it
export function rows(gold, copper, look = LOOK) {
  const cm = new Map(copper.map((b) => [dayOf(b.time), b.close]));
  const pts = [];
  for (let i = 0; i < gold.length; i++) { const c = cm.get(dayOf(gold[i].time)); if (c > 0 && gold[i].close > 0) pts.push({ i, t: dayOf(gold[i].time), q: Math.log(gold[i].close / c) }); }
  const out = [];
  for (let r = look - 1; r < pts.length; r++) {
    const p = pts[r], i = p.i;
    if (i < look - 1) continue;
    let qmax = -Infinity, qmin = Infinity, gmax = -Infinity, gmin = Infinity;
    for (let k = r - look + 1; k < r; k++) { qmax = Math.max(qmax, pts[k].q); qmin = Math.min(qmin, pts[k].q); }
    for (let k = i - look + 1; k < i; k++) { gmax = Math.max(gmax, gold[k].close); gmin = Math.min(gmin, gold[k].close); }
    const gc = gold[i].close;
    out.push({ t: p.t, i, q: p.q, hi: p.q > qmax, lo: p.q < qmin, ghi: gc > gmax, glo: gc < gmin });
  }
  return out;
}
export function sideOf(row, id) {
  if (id === 'T1') return row.hi ? 1 : 0;
  if (id === 'T2') return row.lo ? -1 : 0;
  if (row.hi && !row.ghi) return 1;
  if (row.lo && !row.glo) return -1;
  return 0;
}

// ── trade ──
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);
export function tradeAt(gold, j, side, costX = 1, hold = HOLD, stopAtr = STOP_ATR) {
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
// signals d = { t, i, s }: entry at gold[i + 1]; one position at a time
export function simulate(days, gold, costX = 1) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = d.i + 1; if (j >= gold.length || j <= lastK) continue;
    const tr = tradeAt(gold, j, d.s, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}

// ── statistics ──
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdev = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = mean(a), sd = n > 1 ? sdev(a) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(rowsIn, from, to, key) {
  const a = mk(from), b = mk(Math.max(to, ...rowsIn.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rowsIn) m[mk(r.c) - a] += r[key];
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
  return pick.map((d, i) => ({ t: d.t, i: d.i, s: sd[i] }));
}
// control: each real trade moved to a random eligible day of the same calendar year, same side
export function controlDays(eligible, trades, r) {
  const byYear = new Map();
  for (const d of eligible) { const y = yearOf(d.t); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(d); }
  const out = [];
  for (const tr of trades) { const pool = byYear.get(yearOf(tr.sig)); if (!pool?.length) continue; const d = pool[Math.floor(r() * pool.length)]; out.push({ t: d.t, i: d.i, s: tr.side }); }
  return out.sort((a, b) => a.t - b.t);
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// baseline: the same side traded on every eligible day of the window (overlapping), mean net R (and at 2x costs)
export function baseline(gold, eligible, side, costX = 1) {
  const a = [];
  for (const d of eligible) { const tr = tradeAt(gold, d.i + 1, side, costX); if (tr) a.push(tr.net); }
  return { n: a.length, net: a.length ? mean(a) : null };
}
const withExcess = (trades, base) => trades.map((x) => ({ ...x, ex: x.net - base[x.side] }));
export function summarize(trades, from, to, base, x2, base2) {
  const tr = withExcess(trades, base), s = stat(tr.map((x) => x.net)), g = stat(tr.map((x) => x.gross)), ex = stat(tr.map((x) => x.ex));
  const mo = tr.length ? monthly(tr, from, to, 'net') : { t: null, months: 0 }, mx = tr.length ? monthly(tr, from, to, 'ex') : { t: null }, mg = tr.length ? monthly(tr, from, to, 'gross') : { t: null };
  const side = (sd) => { const a = tr.filter((x) => x.side === sd); return { n: a.length, net: a.length ? r3(stat(a.map((x) => x.net)).mean) : null, excess: a.length ? r3(stat(a.map((x) => x.ex)).mean) : null }; };
  const out = {
    n: s.n, longs: side(1), shorts: side(-1),
    win: s.n ? r3(tr.filter((x) => x.net > 0).length / s.n) : null, stops: tr.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), excess: r3(ex.mean), excessExact: ex.mean == null ? null : +ex.mean.toPrecision(4), total: r2(s.sum),
    tMonth: r2(mo.t), tMonthExcess: r2(mx.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(stat(tr.map((x) => x.cost)).mean) : null, meanRisk: s.n ? r2(stat(tr.map((x) => x.risk)).mean) : null,
  };
  if (x2) { const t2 = withExcess(x2, base2); out.x2 = r3(stat(t2.map((x) => x.net)).mean); out.x2Excess = r3(stat(t2.map((x) => x.ex)).mean); }
  return out;
}

export function runTest(test, gold, rws, { seeds = SEEDS, end = OOS_END } = {}) {
  const ok = rws.filter((r) => atrBefore(gold, r.i + 1) > 0 && r.i + HOLD < gold.length);
  const win = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, end] };
  const out = { id: test.id, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const elig = ok.filter((d) => d.t >= from && d.t <= to), days = elig.map((d) => ({ t: d.t, i: d.i, s: sideOf(d, test.id) })), sig = days.filter((d) => d.s);
    const sides = [...new Set(sig.map((d) => d.s))];
    const base = {}, base2 = {};
    for (const sd of [1, -1]) { base[sd] = sides.includes(sd) ? baseline(gold, elig, sd).net : 0; base2[sd] = sides.includes(sd) ? baseline(gold, elig, sd, 2).net : 0; }
    const tr = simulate(sig, gold), tr2 = simulate(sig, gold, 2);
    out[w] = { from: iso(from), to: iso(to), eligible: elig.length, signals: sig.length, baseline: { buy: sides.includes(1) ? r3(base[1]) : null, sell: sides.includes(-1) ? r3(base[-1]) : null }, ...summarize(tr, from, to, base, tr2, base2) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const real = out.oos.tMonthExcess, sidesT = tr.map((x) => x.side);
        const draw = (gen) => { const ts = [], exs = []; for (let s = 0; s < seeds; s++) { const sm = summarize(simulate(gen(s), gold), from, to, base); ts.push(sm.tMonthExcess); exs.push(sm.excess); } return { ts, exs }; };
        const pack = (ts, exs, seedFrom) => { const srt = [...ts].map((x) => x ?? 0).sort((a, b) => a - b); return { seeds, seedFrom, t: ts, beaten: ts.filter((t) => real != null && (t == null || real > t)).length, median: r2(srt[Math.floor(srt.length / 2)]), p95: r2(srt[Math.min(srt.length - 1, Math.floor(0.95 * srt.length))]), meanExcess: r3(mean(exs.filter((x) => x != null))) }; };
        const p = draw((s) => placeboDays(days, sidesT, rng(s + 1))), c = draw((s) => controlDays(days, tr, rng(s + 101)));
        out.placebo = pack(p.ts, p.exs, 1); out.control = pack(c.ts, c.exs, 101);
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonthExcess != null && t.oos.tMonthExcess >= 2 && t.holm < 0.05, c2 = t.is.excessExact > 0, c3 = t.oos.x2 > 0 && t.oos.x2Excess > 0;
    const c4 = (t.placebo?.beaten ?? 0) >= NEED && (t.control?.beaten ?? 0) >= NEED, c5 = t.is.n >= MIN_N && t.oos.n >= MIN_N;
    t.checks = { oosExcessTAndHolm: c1, isExcessPositive: c2, x2Positive: c3, placeboAndControl38: c4, n100: c5 }; t.pass = c1 && c2 && c3 && c4 && c5;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), copper = load(dir, 'xcu'), rws = rows(gold, copper);
  const tests = TESTS.map((t) => runTest(t, gold, rws));
  const ps = tests.map((t) => normP(t.oos.tMonthExcess)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), xcu: span(copper), ratioRows: rws.length }, tests, verdict };
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
    const out = { title: 'The gold / copper ratio as a fear gauge for spot gold', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { ratio: 'Q = ln(gold close / copper close) on matched UTC days (weekends folded)', extreme: `new ${LOOK}-row high / low of Q; gold's own extreme = close beyond its ${LOOK - 1} previous closes`, entry: `next gold daily open, held ${HOLD} candles, stop ${STOP_ATR} x ATR(${ATR_N}), one position at a time`, baseline: 'same side on every eligible day of the window (overlapping), mean net R', costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on buys` },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, 'elig', x.eligible, 'sig', x.signals, 'n', x.n, JSON.stringify(x.longs), JSON.stringify(x.shorts), 'base', JSON.stringify(x.baseline), 'gross', x.gross, 'net', x.net, 'ex', x.excess, 'x2', x.x2, 'x2ex', x.x2Excess, 'tMo', x.tMonth, 'tMoEx', x.tMonthExcess, 'tMoG', x.tMonthGross, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost, 'risk', x.meanRisk); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }), 'control', JSON.stringify({ ...t.control, t: undefined }));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
