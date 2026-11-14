// A broad dollar day: the US dollar moves the same way against all six majors on one day. Does gold then move against it
// over the next five days? (research/edge/gold-broad-dollar-day; rules fixed in PREREGISTRATION.md). Paper research only:
// a stand-alone rule on gold, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-broad-dollar-day/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-broad-dollar-day/run.mjs count <dir>   signal counts per window only (no return is computed)
//   node research/edge/gold-broad-dollar-day/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 20, KD = 1.0, KG = 0.5, ATR_N = 14, STOP_ATR = 2.0, HOLD = 5, RT = 0.60, SEEDS = 40, GAP = 5 * DAY;
export const DXY_PAIRS = ['eurusd', 'gbpusd', 'usdjpy', 'usdcad', 'usdchf'];
// the six majors and the sign of a USD-strong move in each (quote currency USD -> the pair falls)
export const BREADTH = { eurusd: -1, gbpusd: -1, audusd: -1, usdjpy: 1, usdcad: 1, usdchf: 1 };
export const PAIRS = Object.keys(BREADTH);
export const KEYS = ['xau', ...PAIRS];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000, SPLIT = Date.UTC(2017, 0, 1) / 1000, OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', kind: 'up', side: 1, what: 'broad dollar-up day: buy gold, hold 5 days (primary)' },
  { id: 'T2', kind: 'down', side: -1, what: 'broad dollar-down day: sell gold, hold 5 days' },
  { id: 'T3', kind: 'upGoldDown', side: 1, what: 'broad dollar-up day on which gold also fell > 0.5 sd: buy gold, hold 5 days' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;

// the council's ICE DXY build (council/macro.mjs dxySeries: USD/SEK = 11.2 / EURUSD) on days with all five pairs
export function dxyIndex(fx) {
  const m = new Map();
  for (const k of DXY_PAIRS) for (const b of fx[k] || []) { const d = dayOf(b.time); (m.get(d) || m.set(d, {}).get(d))[k] = b.close; }
  const out = [];
  for (const [d, r] of m) {
    if (!DXY_PAIRS.every((k) => r[k] > 0)) continue;
    out.push({ time: d, close: 50.14348112 * Math.pow(r.eurusd, -0.576) * Math.pow(r.usdjpy, 0.136) * Math.pow(r.gbpusd, -0.119) * Math.pow(r.usdcad, 0.091) * Math.pow(11.2 / r.eurusd, 0.042) * Math.pow(r.usdchf, 0.036) });
  }
  return out.sort((a, b) => a.time - b.time);
}

// one row per day with gold, the index and all six pairs; returns from the previous common day; brk = a hole over GAP
export function returns(gold, dxy, fx) {
  const maps = Object.fromEntries(PAIRS.map((k) => [k, new Map((fx[k] || []).map((b) => [dayOf(b.time), b.close]))]));
  const dc = new Map(dxy.map((b) => [dayOf(b.time), b.close]));
  const pts = [];
  for (const g of gold) {
    const t = dayOf(g.time), d = dc.get(t);
    if (d == null || !PAIRS.every((k) => maps[k].has(t))) continue;
    pts.push({ t, g: g.close, d, p: Object.fromEntries(PAIRS.map((k) => [k, maps[k].get(t)])) });
  }
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    out.push({ t: b.t, g: b.g / a.g - 1, d: b.d / a.d - 1, usd: Object.fromEntries(PAIRS.map((k) => [k, BREADTH[k] * (b.p[k] / a.p[k] - 1)])), brk: b.t - a.t > GAP });
  }
  return out;
}
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
// signal rows: the day's gold and index returns in units of the sd of the LOOK returns before it (only earlier returns);
// agree = how many of the six pairs moved the dollar's way (+) / against it (-) that day
export function signals(rets, look = LOOK) {
  const out = []; let start = 0;
  for (let i = 0; i < rets.length; i++) {
    if (rets[i].brk) { start = i + 1; continue; }
    if (i - start < look) continue;
    const w = rets.slice(i - look, i), sG = sd(w.map((r) => r.g)), sD = sd(w.map((r) => r.d));
    if (!(sG > 0 && sD > 0)) continue;
    const u = Object.values(rets[i].usd);
    out.push({ t: rets[i].t, zg: rets[i].g / sG, zd: rets[i].d / sD, up: u.filter((x) => x > 0).length, dn: u.filter((x) => x < 0).length });
  }
  return out;
}
export function kindsOf(row) {
  const k = [];
  if (row.up === PAIRS.length && row.zd > KD) { k.push('up'); if (row.zg < -KG) k.push('upGoldDown'); }
  if (row.dn === PAIRS.length && row.zd < -KD) k.push('down');
  return k;
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
// exit stamp: a Friday candle ends at the 22:00 UTC weekly close, any other at the day end
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
  const t = dayOf(gold[j].time), c = exitStamp(dayOf(gold[k].time)), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
export function simulate(days, gold, { costX = 1, oneAtATime = true } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || (oneAtATime && j <= lastK)) continue;
    const tr = tradeAt(gold, j, d.s, HOLD, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, s = n > 1 ? sd(a) : 0;
  return { n, mean: m, sum: m * n, t: s > 0 ? m / (s / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
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

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// the same-side every-day baseline, per calendar year of the entry: mean net R of the trade taken on every eligible day
export function baselineByYear(days, gold, side) {
  const all = simulate(days.map((d) => ({ t: d.t, s: side })), gold, { oneAtATime: false });
  const by = {};
  for (const x of all) (by[yearOf(x.t)] ||= []).push(x.net);
  return { all, mean: Object.fromEntries(Object.entries(by).map(([y, a]) => [y, a.reduce((p, q) => p + q, 0) / a.length])) };
}
// excess = net R of a trade minus the baseline's mean net R in the trade's entry year
export const withExcess = (trades, base) => trades.map((x) => ({ ...x, excess: x.net - (base.mean[yearOf(x.t)] ?? 0) }));

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross)), ex = stat(trades.map((x) => x.excess));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const me = trades.length ? monthly(trades, from, to, 'excess') : { t: null };
  return {
    n: s.n, win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    excess: r3(ex.mean), excessExact: ex.mean == null ? null : +ex.mean.toPrecision(4),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tExcess: r2(me.t), tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(stat(trades.map((x) => x.cost)).mean) : null, meanRisk: s.n ? r2(stat(trades.map((x) => x.risk)).mean) : null,
  };
}

const pct = (srt, real) => ({ beaten: srt.filter((t) => real != null && t != null && real > t).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[srt.length - 2]) });

export function runTest(test, gold, rows, { seeds = SEEDS, end = OOS_END } = {}) {
  const win = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
  const out = { id: test.id, kind: test.kind, side: test.side, hold: HOLD, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = rows.filter((d) => d.t >= from && d.t <= to);
    const base = baselineByYear(days, gold, test.side);
    const sig = days.filter((d) => kindsOf(d).includes(test.kind)).map((d) => ({ t: d.t, s: test.side }));
    const tr = withExcess(simulate(sig, gold), base), tr2 = simulate(sig, gold, { costX: 2 });
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2),
      base: { n: base.all.length, net: r3(stat(base.all.map((x) => x.net)).mean), gross: r3(stat(base.all.map((x) => x.gross)).mean) } };
    if (w === 'oos') out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net), excess: r3(x.excess) }));
    if (seeds) {
      const real = out[w].tExcess, ph = [], ct = [];
      const byYear = {}; for (const d of days) (byYear[yearOf(d.t)] ||= []).push(d);
      const need = {}; for (const s of sig) need[yearOf(s.t)] = (need[yearOf(s.t)] || 0) + 1;
      for (let s = 1; s <= seeds; s++) {
        // placebo: as many random eligible days of the window as signals
        const pick = shuffle(days, rng(s)).slice(0, sig.length).sort((a, b) => a.t - b.t).map((d) => ({ t: d.t, s: test.side }));
        ph.push(summarize(withExcess(simulate(pick, gold), base), from, to).tExcess);
        // control: the same number of random days in each calendar year as the signal had (keeps the year's drift and volatility)
        const r = rng(1000 + s), pc = [];
        for (const [y, n] of Object.entries(need)) pc.push(...shuffle(byYear[y], r).slice(0, n));
        const cp = pc.sort((a, b) => a.t - b.t).map((d) => ({ t: d.t, s: test.side }));
        ct.push(summarize(withExcess(simulate(cp, gold), base), from, to).tExcess);
      }
      out[w].placebo = { seeds, t: ph, ...pct([...ph].sort((a, b) => a - b), real) };
      out[w].control = { seeds, t: ct, ...pct([...ct].sort((a, b) => a - b), real) };
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const ch = { oosExcessTAndHolm: t.oos.tExcess != null && t.oos.tExcess >= 2 && t.holm < 0.05, isExcessPositive: t.is.excessExact > 0,
      oosNetPositive: t.oos.netExact > 0, x2Positive: t.oos.x2 > 0, placebo38: (t.oos.placebo?.beaten ?? 0) >= 38,
      control38: (t.oos.control?.beaten ?? 0) >= 38, n100: t.is.signals >= 100 && t.oos.signals >= 100 };
    t.checks = ch; t.pass = Object.values(ch).every(Boolean);
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function prepare(dir) {
  const gold = load(dir, 'xau'), fx = Object.fromEntries(PAIRS.map((k) => [k, load(dir, k)]));
  const dxy = dxyIndex(fx), rows = signals(returns(gold, dxy, fx));
  return { gold, fx, dxy, rows };
}
export function counts(rows, gold) {
  const out = {};
  for (const [w, a, b] of [['is', IS_FROM, SPLIT - 1], ['oos', SPLIT, OOS_END]]) {
    const rs = rows.filter((r) => r.t >= a && r.t <= b), o = { days: rs.length };
    for (const t of TESTS) {
      const sig = rs.filter((r) => kindsOf(r).includes(t.kind)).map((r) => ({ t: r.t }));
      // trades one at a time: entry index only (no price after the entry is read)
      let lastJ = -1e9, n = 0;
      for (const s of sig) { const j = entryIndex(gold, s.t); if (j < 0 || j <= lastJ + HOLD - 1) continue; n++; lastJ = j; }
      o[t.id] = { signals: sig.length, approxTrades: n };
    }
    out[w] = o;
  }
  return out;
}

export function study(dir) {
  const { gold, fx, dxy, rows } = prepare(dir);
  const tests = TESTS.map((t) => runTest(t, gold, rows));
  const ps = tests.map((t) => normP(t.oos.tExcess)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), dxy: span(dxy), ...Object.fromEntries(PAIRS.map((k) => [k, span(fx[k])])) }, counts: counts(rows, gold), tests, verdict };
}

const main = async () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const sha = execFileSync('git', ['rev-parse', 'origin/council-data'], { encoding: 'utf8' }).trim();
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `${sha}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'SOURCE'), sha + '\n');
    console.log('council-data', sha, '->', dir);
  } else if (cmd === 'count') {
    const { gold, rows } = prepare(dir);
    console.log(JSON.stringify(counts(rows, gold), null, 1));
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    for (const t of r.tests) for (const w of ['is', 'oos']) { delete t[w].placebo?.t; delete t[w].control?.t; }
    const out = { title: 'A broad dollar day and gold over the next five days', built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { breadth: 'all six of EURUSD, GBPUSD, AUDUSD (down) and USDJPY, USDCAD, USDCHF (up) move the dollar\'s way on the day (mirror for a down day)',
        dxy: 'council/macro.mjs dxySeries on folded daily closes; its return beyond 1 x the sd of the 20 returns before the day',
        entry: 'next gold open', stop: `${STOP_ATR} x ATR(${ATR_N}) before the entry`, hold: `${HOLD} daily candles`, costs: `$${RT.toFixed(2)} a trade + nights() x FIN.xau.long on buys`, oneAtATime: true,
        baseline: 'same-side trade entered on every eligible day, mean net R per calendar year of the entry; excess = trade net minus it' },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, JSON.stringify({ ...x, placebo: undefined, control: undefined })); console.log('  placebo', JSON.stringify(x.placebo), 'control', JSON.stringify(x.control)); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | count <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
