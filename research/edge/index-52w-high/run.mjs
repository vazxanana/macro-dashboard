// The 52-week-high anchor on equity indices (pre-registered: PREREGISTRATION.md, 14 Nov 2026). Paper research only.
//   node run.mjs fetch <dir>   copies the council's daily candle cache and macro cache out of the council-data branch (git show,
//                              no network) into <dir>, outside git
//   node run.mjs full <dir>    runs the three tests and writes result.json
// Pure pieces are exported for tests/index-52w-high.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend } from '../../../council/fills.mjs';

export const P = {
  LOOK: 252, NEAR: 0.99, DEEP: 0.80, ATR: 20, STOP_ATR: 2, HOLD: 20,
  RT: 0.0004, MARKUP: 0.025, RATE_FALLBACK: 0.04,
  DECISIVE_FROM: '2016-01-01', SEEDS: 40,
};
export const PRIMARY = 'spx500';
export const REPL = ['nas100', 'us30', 'de40', 'uk100', 'jp225'];
const DAY = 86400;
const T = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

// rows [t, o, h, l, c, v] -> folded weekday candles
export function candles(rows) {
  return foldWeekend(rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
}

// ATR20 at day i: simple mean of the 20 true ranges ending at i (null without 20 previous closes)
export function atrAt(b, i, n = P.ATR) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += Math.max(b[k].high - b[k].low, Math.abs(b[k].high - b[k - 1].close), Math.abs(b[k].low - b[k - 1].close));
  return s / n;
}

// prior 252-day closing high for every day (null before 252 days), from closes BEFORE that day
export function priorHighs(b, look = P.LOOK) {
  const out = new Array(b.length).fill(null);
  // monotonic deque over closes[i-look .. i-1]
  const dq = [];
  for (let i = 0; i < b.length; i++) {
    if (i >= look) out[i] = b[dq[0]].close;
    // add i for the next day's window, drop what leaves it
    while (dq.length && b[dq[dq.length - 1]].close <= b[i].close) dq.pop();
    dq.push(i);
    while (dq[0] <= i + 1 - look - 1) dq.shift();
  }
  return out;
}

export function signalsOf(b, kind, look = P.LOOK) {
  const hi = priorHighs(b, look);
  return b.map((x, i) => {
    if (hi[i] == null || atrAt(b, i) == null) return null;
    return kind === 'near' ? x.close >= P.NEAR * hi[i] : x.close < P.DEEP * hi[i];
  });
}

// the US 2Y as of a time (weekly series [[date, pct]]), fallback before it starts
export function rateAt(series, t) {
  if (!series || !series.length || t < T(series[0][0])) return { r: P.RATE_FALLBACK, src: 'fixed' };
  let lo = 0, hi = series.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T(series[m][0]) <= t) lo = m; else hi = m - 1; }
  return { r: series[lo][1] / 100, src: 'DGS2' };
}

// one trade from a signal at day i; side +1 long, -1 short; null when its 20th day is not in the data
export function tradeAt(b, i, side, rates, costX = 1) {
  const e = i + 1, last = i + P.HOLD;
  if (last >= b.length) return null;
  const atr = atrAt(b, i), S = P.STOP_ATR * atr, entry = b[e].open, stop = entry - side * S;
  let x = last, exit = b[last].close, how = 'time';
  for (let j = e; j <= last; j++) {
    const hit = side > 0 ? b[j].low <= stop : b[j].high >= stop;
    if (hit) { x = j; exit = side > 0 ? Math.min(b[j].open, stop) : Math.max(b[j].open, stop); how = 'stop'; break; }
  }
  const gross = side * (exit - entry) / S;
  const days = Math.round((b[x].time - b[e].time) / DAY);
  const { r, src } = rateAt(rates, b[e].time);
  const finRate = side > 0 ? r + P.MARKUP : Math.max(0, P.MARKUP - r);
  const cost = costX * (P.RT * entry + finRate / 365 * days * entry) / S;
  return { i, e, x, t: b[e].time, tx: b[x].time, entry, exit, stop, S, how, days, gross, net: gross - cost, cost, rateSrc: src };
}

// one position at a time over the days where pick(i) is true, entries inside [from, to)
export function stream(b, pick, side, rates, from, to, costX = 1) {
  const out = []; let free = 0;
  for (let i = 0; i < b.length - 1; i++) {
    if (i < free || !pick(i)) continue;
    const t = b[i + 1].time; if (t < from || t >= to) continue;
    const tr = tradeAt(b, i, side, rates, costX);
    if (!tr) break;
    out.push(tr); free = tr.x;
  }
  return out;
}

export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
export function normP(t) { // one-sided upper p
  const z = t / Math.SQRT2, a = Math.abs(z), k = 1 / (1 + 0.3275911 * a);
  const erf = 1 - (((((1.061405429 * k - 1.453152735) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-a * a);
  const cdf = 0.5 * (1 + Math.sign(z) * erf);
  return 1 - cdf;
}
export function monthKey(t) { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
// t on calendar-month sums of (net - mu) over every month of [from, to)
export function monthT(parts, from, to) {
  const m0 = monthKey(from), m1 = monthKey(to - 1), x = new Array(m1 - m0 + 1).fill(0);
  for (const { trades, mu } of parts) for (const tr of trades) { const k = monthKey(tr.t) - m0; if (k >= 0 && k < x.length) x[k] += tr.net - mu; }
  const M = x.length, m = mean(x), sd = Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (M - 1));
  const t = sd > 0 ? m / (sd / Math.sqrt(M)) : 0;
  return { months: M, t, p: normP(t) };
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = run; });
  return out;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const summ = (tr, key = 'net') => ({ n: tr.length, gross: r3(mean(tr.map((x) => x.gross))), net: r3(mean(tr.map((x) => x[key]))), total: r2(tr.reduce((s, x) => s + x[key], 0)), win: r2(100 * tr.filter((x) => x[key] > 0).length / (tr.length || 1)) });

// one test in one window: per index the signal and baseline streams, D and month t
export function evalTest(data, keys, kind, side, rates, from, to, costX = 1) {
  const per = {}, parts = [], all = [], base = [];
  for (const k of keys) {
    const b = data[k], sig = signalsOf(b, kind);
    const s = stream(b, (i) => sig[i] === true, side, rates, from, to, costX);
    const n = stream(b, (i) => sig[i] === false, side, rates, from, to, costX);
    const mu = mean(n.map((x) => x.net));
    per[k] = { signal: summ(s), base: summ(n), D: r3(mean(s.map((x) => x.net)) - mu), signalDays: sig.filter((v, i) => v === true && i + 1 < b.length && b[i + 1].time >= from && b[i + 1].time < to).length };
    parts.push({ trades: s, mu }); all.push(...s.map((x) => ({ ...x, d: x.net - mu }))); base.push(...n);
  }
  const mt = monthT(parts, from, to);
  return { per, n: all.length, signal: summ(all), base: summ(base), D: r3(mean(all.map((x) => x.d))), t: r2(mt.t), p: mt.p, months: mt.months, parts };
}

// placebo: as many random days (with history) as the test has signal days, per index, against the real mu_base
export function placebo(data, keys, kind, side, rates, from, to, real, seeds = P.SEEDS) {
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const R = rng(s), parts = [], ds = [];
    for (const k of keys) {
      const b = data[k], sig = signalsOf(b, kind);
      const elig = []; for (let i = 0; i < b.length - 1; i++) if (sig[i] !== null && b[i + 1].time >= from && b[i + 1].time < to) elig.push(i);
      const want = real.per[k].signalDays, pick = new Set();
      while (pick.size < Math.min(want, elig.length)) pick.add(elig[Math.floor(R() * elig.length)]);
      const tr = stream(b, (i) => pick.has(i), side, rates, from, to);
      const mu = real.parts[keys.indexOf(k)].mu;
      parts.push({ trades: tr, mu }); ds.push(...tr.map((x) => x.net - mu));
    }
    const mt = monthT(parts, from, to);
    out.push({ seed: s, n: ds.length, D: mean(ds), t: mt.t });
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  return { seeds, medianD: r3(med(out.map((x) => x.D))), medianT: r2(med(out.map((x) => x.t))), reachRealT: out.filter((x) => x.t >= real.t).length, positiveD: out.filter((x) => x.D > 0).length };
}

// ── files ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEYS = [PRIMARY, ...REPL];
function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ref = execFileSync('git', ['rev-parse', 'origin/council-data']).toString().trim();
  for (const k of KEYS) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  fs.writeFileSync(path.join(dir, 'cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
  fs.writeFileSync(path.join(dir, 'ref.txt'), ref + '\n');
  console.log('saved', KEYS.join(' '), 'and macro/cache.json from council-data', ref);
}

const strip = (e) => { const { parts, ...rest } = e; return rest; };

function full(dir) {
  const data = {}, info = {};
  for (const k of KEYS) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'));
    data[k] = candles(j.rows);
    info[k] = { inst: j.inst, days: data[k].length, from: new Date(data[k][0].time * 1000).toISOString().slice(0, 10), to: new Date(data[k].at(-1).time * 1000).toISOString().slice(0, 10) };
  }
  const rates = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'), 'utf8')).score.fred.DGS2;
  const ref = fs.existsSync(path.join(dir, 'ref.txt')) ? fs.readFileSync(path.join(dir, 'ref.txt'), 'utf8').trim() : null;
  const cut = T(P.DECISIVE_FROM);
  // the windows' month grids: from the first possible entry (day 253) to the last candle
  const start = Math.min(...KEYS.map((k) => data[k][P.LOOK + 1].time)), end = Math.max(...KEYS.map((k) => data[k].at(-1).time)) + DAY;
  const TESTS = [
    { id: 'T1', name: 'spx500 near its 252-day high, long', keys: [PRIMARY], kind: 'near', side: 1 },
    { id: 'T2', name: 'five replication indices pooled, near the high, long', keys: REPL, kind: 'near', side: 1 },
    { id: 'T3', name: 'all six indices, more than 20 % below the high, short', keys: KEYS, kind: 'deep', side: -1 },
  ];
  const res = TESTS.map((t) => {
    const dec = evalTest(data, t.keys, t.kind, t.side, rates, cut, end);
    const rep = evalTest(data, t.keys, t.kind, t.side, rates, start, cut);
    const dec2 = evalTest(data, t.keys, t.kind, t.side, rates, cut, end, 2);
    const rep2 = evalTest(data, t.keys, t.kind, t.side, rates, start, cut, 2);
    const pl = placebo(data, t.keys, t.kind, t.side, rates, cut, end, dec);
    return { ...t, decisive: strip(dec), replication: strip(rep), x2: { decisive: { D: dec2.D, t: dec2.t, net: dec2.signal.net, baseNet: dec2.base.net }, replication: { D: rep2.D, t: rep2.t, net: rep2.signal.net, baseNet: rep2.base.net } }, placebo: pl };
  });
  const ph = holm(res.map((r) => r.decisive.p));
  res.forEach((r, i) => {
    r.decisive.p = Number(r.decisive.p.toPrecision(3)); r.replication.p = Number(r.replication.p.toPrecision(3));
    r.holm = Number(ph[i].toPrecision(3));
    const c1 = r.decisive.D > 0 && r.replication.D > 0, c2 = r.holm < 0.05, c3 = r.decisive.n >= 30;
    r.pass = { pass: c1 && c2 && c3, bothWindowsPositive: c1, holm: c2, n30: c3 };
  });
  // the fixed-rate share (entries before DGS2 starts)
  const fixed = KEYS.reduce((s, k) => s + stream(data[k], () => true, 1, rates, 0, T('2006-01-06')).length, 0);
  const [t1, t2, t3] = res;
  const sg = (x) => (x > 0 ? '+' : '') + x.toFixed(3);
  const line = (r) => `${r.id} D ${sg(r.decisive.D)}R a trade 2016-now (n ${r.decisive.n}, month t ${r.decisive.t}, Holm p ${r.holm}), ${sg(r.replication.D)}R before 2016 (n ${r.replication.n}, t ${r.replication.t})`;
  const verdict = `${t1.pass.pass ? 'PASS' : 'FAIL'}. ${line(t1)}; ${line(t2)} (${t2.pass.pass ? 'passes' : 'does not pass'}); ${line(t3)} (${t3.pass.pass ? 'passes' : 'does not pass'}).`;
  const out = {
    topic: 'index-52w-high', built: '2026-11-14', title: 'The 52-week-high anchor on equity indices',
    system: 'Long an equity index at the next daily open after a close within 1 % of its prior 252-day closing high, stop 2 x ATR20, out after 20 trading days, one at a time, net of a 0.04 % round trip and financing at the US 2Y + 2.5 %, against the same trade on every other day',
    verdict, data: { councilData: ref, markets: info, rates: 'FRED DGS2 weekly from council-data macro/cache.json score.fred (from 2006-01-06); a fixed 4 % before it', fixedRateTrades: fixed },
    window: { decisive: [P.DECISIVE_FROM, info[PRIMARY].to], replication: [new Date(start * 1000).toISOString().slice(0, 10), '2015-12-31'] }, params: P, tests: res,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(verdict);
  for (const r of res) {
    console.log(r.id, JSON.stringify({ dec: { n: r.decisive.n, sig: r.decisive.signal, base: r.decisive.base, D: r.decisive.D, t: r.decisive.t }, rep: { n: r.replication.n, sig: r.replication.signal, base: r.replication.base, D: r.replication.D, t: r.replication.t }, holm: r.holm, x2: r.x2, pl: r.placebo, pass: r.pass }));
    for (const k of r.keys) console.log('  ', k, JSON.stringify({ dec: r.decisive.per[k], rep: r.replication.per[k] }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) fetchAll(dir);
  else if (mode === 'full' && dir) full(dir);
  else { console.error('usage: node run.mjs fetch <dir> | full <dir>'); process.exit(1); }
}
