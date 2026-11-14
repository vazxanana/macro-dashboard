// Gold after a yen surge day: does gold follow the flight into the yen? (research/edge/gold-yen-surge;
// rules fixed in PREREGISTRATION.md). Paper research only: a stand-alone rule, never a gate / entry / exit / size of the
// live gold book (decision 44).
//   node research/edge/gold-yen-surge/run.mjs fetch <dir> [commit]   copy the daily caches out of council-data at PIN (no network)
//   node research/edge/gold-yen-surge/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 20, K = 1.5, ATR_N = 14, STOP_ATR = 1.5, RT = 0.60, SEEDS = 40, GAP = 5 * DAY;
export const KEYS = ['xau', 'usdjpy'];
export const PIN = 'e3dbfa18e93eb7a5997ab9f330518745e1f9e1fa'; // the council-data commit named in PREREGISTRATION.md
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000, SPLIT = Date.UTC(2017, 0, 1) / 1000, OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', kind: 'surge', side: 1, hold: 3, what: 'yen surge (USD/JPY down > 1.5 sd): buy gold, hold 3 days (primary)' },
  { id: 'T2', kind: 'slump', side: -1, hold: 3, what: 'yen slump (USD/JPY up > 1.5 sd): sell gold, hold 3 days' },
  { id: 'T3', kind: 'surge', side: 1, hold: 1, what: 'yen surge (USD/JPY down > 1.5 sd): buy gold, hold 1 day' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;

// USD/JPY returns; brk = the return spans a hole of more than GAP
export function returns(jpy) {
  const out = [];
  for (let i = 1; i < jpy.length; i++) out.push({ t: dayOf(jpy[i].time), y: jpy[i].close / jpy[i - 1].close - 1, brk: jpy[i].time - jpy[i - 1].time > GAP });
  return out;
}
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
// signal rows: the day's return in units of the sd of the LOOK returns before it (only earlier returns used)
export function signals(rets, look = LOOK) {
  const out = []; let start = 0;
  for (let i = 0; i < rets.length; i++) {
    if (rets[i].brk) { start = i + 1; continue; }
    if (i - start < look) continue;
    const s = sd(rets.slice(i - look, i).map((r) => r.y));
    if (!(s > 0)) continue;
    out.push({ t: rets[i].t, z: rets[i].y / s });
  }
  return out;
}
export function kindOf(row, k = K) {
  if (row.z < -k) return 'surge';
  if (row.z > k) return 'slump';
  return null;
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
export function simulate(days, gold, hold, { costX = 1, oneAtATime = true } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || (oneAtATime && j <= lastK)) continue;
    const tr = tradeAt(gold, j, d.s, hold, costX); if (!tr) continue;
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

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  return {
    n: s.n, win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(stat(trades.map((x) => x.cost)).mean) : null, meanRisk: s.n ? r2(stat(trades.map((x) => x.risk)).mean) : null,
  };
}

export function runTest(test, gold, rows, { seeds = SEEDS, end = OOS_END } = {}) {
  const win = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
  const out = { id: test.id, kind: test.kind, side: test.side, hold: test.hold, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = rows.filter((d) => d.t >= from && d.t <= to);
    const sig = days.filter((d) => kindOf(d) === test.kind).map((d) => ({ t: d.t, s: test.side }));
    const tr = simulate(sig, gold, test.hold), tr2 = simulate(sig, gold, test.hold, { costX: 2 });
    const all = days.map((d) => ({ t: d.t, s: 1 })), base = simulate(all, gold, test.hold, { oneAtATime: false });
    const baseS = test.side < 0 ? simulate(days.map((d) => ({ t: d.t, s: -1 })), gold, test.hold, { oneAtATime: false }) : null;
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2),
      baseBuy: { n: base.length, net: r3(stat(base.map((x) => x.net)).mean), gross: r3(stat(base.map((x) => x.gross)).mean) },
      ...(baseS ? { baseSell: { n: baseS.length, net: r3(stat(baseS.map((x) => x.net)).mean), gross: r3(stat(baseS.map((x) => x.gross)).mean) } } : {}) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const ts = [];
        for (let s = 1; s <= seeds; s++) {
          const pick = shuffle(days, rng(s)).slice(0, sig.length).sort((a, b) => a.t - b.t).map((d) => ({ t: d.t, s: test.side }));
          ts.push(summarize(simulate(pick, gold, test.hold), from, to).tMonth);
        }
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sig.length, t: ts, beaten: ts.filter((t) => real != null && t != null && real > t).length, atLeast2: ts.filter((t) => t != null && t >= 2).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const ch = { oosNetPositive: t.oos.netExact > 0, oosTAndHolm: t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05,
      isPositive: t.is.netExact > 0, x2Positive: t.oos.x2 > 0, placebo38: (t.placebo?.beaten ?? 0) >= 38, n30: t.oos.n >= 30 };
    t.checks = ch; t.pass = Object.values(ch).every(Boolean);
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), jpy = load(dir, 'usdjpy');
  const rows = signals(returns(jpy));
  const tests = TESTS.map((t) => runTest(t, gold, rows));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const ctx = {};
  for (const [w, a, b] of [['is', IS_FROM, SPLIT - 1], ['oos', SPLIT, OOS_END]]) {
    const rs = rows.filter((r) => r.t >= a && r.t <= b);
    ctx[w] = { days: rs.length, surge: rs.filter((r) => kindOf(r) === 'surge').length, slump: rs.filter((r) => kindOf(r) === 'slump').length };
  }
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), usdjpy: span(jpy) }, context: ctx, tests, verdict };
}

const main = async () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const sha = execFileSync('git', ['rev-parse', process.argv[4] || PIN], { encoding: 'utf8' }).trim();
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `${sha}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'SOURCE'), sha + '\n');
    console.log('council-data', sha, '->', dir);
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Gold after a yen surge day', built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { signal: `USD/JPY daily return beyond ${K} x the sd of the ${LOOK} returns before the day (surge = USD/JPY down, slump = up)`, entry: 'next gold open', stop: `${STOP_ATR} x ATR(${ATR_N}) before the entry`, costs: `$${RT.toFixed(2)} a trade + nights() x FIN.xau.long on buys`, oneAtATime: true },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, 'elig', x.eligible, 'sig', x.signals, 'n', x.n, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost, 'tot', x.total, 'baseBuy', JSON.stringify(x.baseBuy), x.baseSell ? 'baseSell ' + JSON.stringify(x.baseSell) : ''); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('context', JSON.stringify(r.context));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
