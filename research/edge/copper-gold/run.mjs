// The copper / gold ratio as a weekly risk-on signal for SPX500 and NAS100, out of sample, net of costs.
// Pre-registered in PREREGISTRATION.md (committed alone before any return was computed). Paper research only: nothing live reads this.
//   node research/edge/copper-gold/run.mjs fetch <dir>   (git show from origin/council-data, no network)
//   node research/edge/copper-gold/run.mjs full <dir>    (writes result.json next to this file)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const INDICES = ['spx500', 'nas100'];
export const METALS = ['xcu', 'xau'];
export const NAMES = { spx500: 'SPX500', nas100: 'NAS100' };
export const SPREAD = { spx500: 0.5, nas100: 1.5 };          // price units, charged on every entry and exit (the sibling index studies' figures)
export const MARKUP = 0.025;                                  // financing: DGS2 + 2.5 % a year, / 365 a night
export const LOOK = 13, ATR_N = 20, ATR_K = 3, NW_LAGS = 4, SEEDS = 40;
export const WINDOWS = { W1: { from: '2008-01-01', to: '2016-01-01', label: '2008-15 (check)' }, W2: { from: '2016-01-01', to: '2100-01-01', label: '2016 to now (decisive)' } };

const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const ym = (t) => day(t).slice(0, 7);
// the Monday (UTC day number) of the week holding unix time t; 1970-01-01 was a Thursday
export const weekOf = (t) => { const d = Math.floor(t / 86400); return d - ((d + 3) % 7); };

export function barsOf(json) {
  return foldWeekend(json.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
}

// week key -> index of the week's last candle; only weeks a later candle has closed (a week in progress has no week end)
export function weekEnds(bars) {
  const m = new Map();
  for (let i = 0; i + 1 < bars.length; i++) if (weekOf(bars[i].time) !== weekOf(bars[i + 1].time)) m.set(weekOf(bars[i].time), i);
  return m;
}

// the copper / gold signal at week wk: reads the two metals' week-end closes of wk and wk - 13 weeks only
export function signalAt(xcu, xau, xcuEnds, xauEnds, wk) {
  const now = [xcuEnds.get(wk), xauEnds.get(wk)], then = [xcuEnds.get(wk - LOOK * 7), xauEnds.get(wk - LOOK * 7)];
  if ([...now, ...then].some((i) => i === undefined)) return null;
  const r1 = xcu[now[0]].close / xau[now[1]].close, r0 = xcu[then[0]].close / xau[then[1]].close;
  const chg = r1 / r0 - 1;
  return { wk, ratio: r1, chg, on: chg > 0 };
}

export function atrAt(bars, i, n = ATR_N) {
  if (i < n) return null;
  let tr = 0;
  for (let k = i - n + 1; k <= i; k++) tr += Math.max(bars[k].high - bars[k].low, Math.abs(bars[k].high - bars[k - 1].close), Math.abs(bars[k].low - bars[k - 1].close));
  return tr / n;
}

// as-of lookup in a sorted [[YYYY-MM-DD, value]] list
export function asOfRate(list) {
  return (t) => {
    const d = day(t); let lo = 0, hi = list.length - 1, v = null;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m][0] <= d) { v = list[m][1]; lo = m + 1; } else hi = m - 1; }
    return v;
  };
}
export const nightRate = (dgs2) => (t) => (Math.max(0, dgs2(t) ?? 0) / 100 + MARKUP) / 365;

// Signal test rows for one index: per week end f with a signal, the next week's open-to-open return (no cost, no stop)
export function weekRows(bars, sigOf) {
  const ends = [...weekEnds(bars).entries()].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (let n = 0; n + 1 < ends.length; n++) {
    const [wk, i] = ends[n], i2 = ends[n + 1][1];
    if (i2 + 1 >= bars.length) break;
    const s = sigOf(wk);
    if (!s) continue;
    out.push({ wk, t: bars[i].time, on: s.on, r: bars[i2 + 1].open / bars[i + 1].open - 1 });
  }
  return out;
}

// One index, one window of candles: daily returns of one unit of notional, long while onOf(wk) is true.
// opts: { spread, rate(t) a night, from, to (unix s) }. onOf(wk) -> true | false | null (null = no signal = flat).
export function simulate(bars, onOf, opts) {
  const { spread, rate, from, to } = opts;
  const endMap = weekEnds(bars), endAt = new Map([...endMap.entries()].map(([wk, i]) => [i, wk]));
  const k0 = bars.findIndex((b) => b.time >= from);
  if (k0 < 1) return null;
  let k1 = k0; while (k1 + 1 < bars.length && bars[k1 + 1].time < to) k1++;
  let wPrev = null; for (const [i, wk] of endAt) if (i < k0 && (wPrev === null || i > endMap.get(wPrev))) wPrev = wk;
  const carry = (k) => nights(bars[k].time, k + 1 < bars.length ? bars[k + 1].time : bars[k].time + 86400) * rate(bars[k].time);
  const out = [], trades = [];
  let pos = false, stop = null, open = null, stops = 0, switches = 0, held = 0;
  const close = (k, px, why) => { pos = false; trades.push({ ...open, exit: px, exitT: bars[k].time, why }); open = null; if (why === 'stop') stops++; };
  for (let k = k0; k <= k1; k++) {
    const b = bars[k], prev = bars[k - 1].close;
    let r = 0, entered = false;
    const wStart = k === k0 ? wPrev : endAt.get(k - 1);
    if (wStart !== undefined) {                                          // the first candle of a week (or of the window)
      const ie = wStart === null ? null : endMap.get(wStart), on = ie == null ? null : onOf(wStart);
      const atr = ie == null ? null : atrAt(bars, ie), lvl = atr == null ? null : bars[ie].close - ATR_K * atr;
      if (pos && !(on && lvl != null)) {                                 // switch out at the open
        r = (b.open - spread) / prev - 1; switches++; close(k, b.open - spread, 'signal');
        out.push({ t: b.time, r });
        continue;
      }
      if (pos) stop = Math.max(stop, lvl);                               // a kept position: the stop is never loosened
      if (!pos && on && lvl != null) {                                   // switch in at the open, with its stop
        const entry = b.open + spread; stop = lvl; pos = true; entered = true; switches++; open = { entry, entryT: b.time, stop0: stop };
        if (b.open <= stop) { r = (b.open - spread) / entry - 1; close(k, b.open - spread, 'stop'); }
        else if (b.low <= stop) { r = (stop - spread) / entry - 1; close(k, stop - spread, 'stop'); }
        else r = b.close / entry - 1;
      }
    }
    if (pos && !entered) {
      if (b.open <= stop) { r = (b.open - spread) / prev - 1; close(k, b.open - spread, 'stop'); }
      else if (b.low <= stop) { r = (stop - spread) / prev - 1; close(k, stop - spread, 'stop'); }
      else r = b.close / prev - 1;
    }
    if (pos) { r -= carry(k); held++; }
    out.push({ t: b.time, r });
  }
  return { rets: out, stops, switches, held, days: k1 - k0 + 1, trades, openAtEnd: pos, from: day(bars[k0].time), to: day(bars[k1].time) };
}

export function book(series) {
  const m = new Map();
  for (const s of series) for (const { t, r } of s) m.set(t, (m.get(t) || 0) + r / series.length);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, r]) => ({ t, r }));
}

export function stats(rs) {
  const r = rs.map((x) => x.r), n = r.length;
  if (!n) return null;
  const months = new Set(rs.map((x) => ym(x.t))).size;
  let eq = 1, peak = 1, dd = 0;
  for (const v of r) { eq *= 1 + v; peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak); }
  const mean = r.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { days: n, months, total: eq - 1, cagr: eq ** (12 / months) - 1, vol: sd * Math.sqrt(252), sharpe: sd > 0 ? mean / sd * Math.sqrt(252) : 0, maxDD: dd };
}

const mv = (a) => { const n = a.length, m = a.reduce((s, x) => s + x, 0) / n; return { n, m, v: n > 1 ? a.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1) : NaN }; };
export function welch(a, b) {
  const A = mv(a), B = mv(b), diff = A.m - B.m, se = Math.sqrt(A.v / A.n + B.v / B.n);
  return { nOn: A.n, nOff: B.n, meanOn: A.m, meanOff: B.m, diff, t: se > 0 ? diff / se : 0 };
}
// Newey-West (Bartlett, L lags) t of b in y = a + b * d, rows in time order
export function nwT(y, d, L = NW_LAGS) {
  const n = y.length, md = d.reduce((s, x) => s + x, 0) / n, my = y.reduce((s, x) => s + x, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (d[i] - md) ** 2; sxy += (d[i] - md) * (y[i] - my); }
  const b = sxy / sxx, a = my - b * md, g = y.map((v, i) => (d[i] - md) * (v - a - b * d[i]));
  let S = g.reduce((s, x) => s + x * x, 0);
  for (let l = 1; l <= L; l++) { let c = 0; for (let i = l; i < n; i++) c += g[i] * g[i - l]; S += 2 * (1 - l / (L + 1)) * c; }
  return { b, t: b / Math.sqrt(S / (sxx * sxx)) };
}
// one-sided p of a t (normal approximation, n in the hundreds)
export function pOf(t) {
  const z = t / Math.SQRT2, s = Math.sign(z), x = Math.abs(z), k = 1 / (1 + 0.3275911 * x);
  const erf = s * (1 - ((((1.061405429 * k - 1.453152027) * k + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x));
  return 1 - 0.5 * (1 + erf);
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length);
  let run = 0;
  idx.forEach(([p, i], j) => { run = Math.max(run, Math.min(1, (ps.length - j) * p)); out[i] = run; });
  return out;
}
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function signalTest(rows) {
  const w = welch(rows.filter((x) => x.on).map((x) => x.r), rows.filter((x) => !x.on).map((x) => x.r));
  const nw = nwT(rows.map((x) => x.r), rows.map((x) => (x.on ? 1 : 0)));
  return { ...w, nwT: nw.t, weeks: rows.length, onShare: w.nOn / rows.length };
}
export function placebo(rows, seeds = SEEDS) {
  const nOn = rows.filter((x) => x.on).length, ts = [];
  for (let s = 1; s <= seeds; s++) {
    const rnd = mulberry32(s), on = rows.map((_, i) => i < nOn);
    for (let i = on.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [on[i], on[j]] = [on[j], on[i]]; }
    ts.push(welch(rows.filter((_, i) => on[i]).map((x) => x.r), rows.filter((_, i) => !on[i]).map((x) => x.r)).t);
  }
  return ts;
}
// equal-weight weekly rows: the mean of the indices' next-week returns where every index has the week
export function ewRows(perIndex) {
  const m = new Map();
  for (const rows of perIndex) for (const x of rows) { if (!m.has(x.wk)) m.set(x.wk, []); m.get(x.wk).push(x); }
  return [...m.entries()].filter(([, xs]) => xs.length === perIndex.length).sort((a, b) => a[0] - b[0])
    .map(([wk, xs]) => ({ wk, t: xs[0].t, on: xs[0].on, r: xs.reduce((s, x) => s + x.r, 0) / xs.length }));
}

export function passOf(sig, sim) {
  const checks = { w2Positive: sig.W2.ew.diff > 0 && sig.W2.ew.t >= 2, w1SameSign: sig.W1.ew.diff > 0, w2Sharpe: sim.W2.book.rule.sharpe >= sim.W2.book.bench.sharpe };
  return { checks, pass: Object.values(checks).every(Boolean) };
}

const r4 = (x) => (Number.isFinite(x) ? +x.toFixed(4) : x);
const slim = (s) => s && Object.fromEntries(Object.entries(s).map(([k, v]) => [k, r4(v)]));

export function runAll(dir) {
  const read = (k) => { const f = path.join(dir, k + '.json'); return fs.existsSync(f) ? barsOf(JSON.parse(fs.readFileSync(f, 'utf8'))) : null; };
  const data = Object.fromEntries([...METALS, ...INDICES].map((k) => [k, read(k)]));
  const missing = Object.keys(data).filter((k) => !data[k]);
  if (missing.some((k) => METALS.includes(k))) throw new Error('missing metal file: ' + missing.join(', '));
  const idx = INDICES.filter((k) => data[k]);
  const cache = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'), 'utf8'));
  const rate = nightRate(asOfRate(cache.score.fred.DGS2));
  const xe = weekEnds(data.xcu), ge = weekEnds(data.xau);
  const sigOf = (wk) => signalAt(data.xcu, data.xau, xe, ge, wk);
  const onOf = (wk) => { const s = sigOf(wk); return s ? s.on : null; };
  const rowsAll = Object.fromEntries(idx.map((k) => [k, weekRows(data[k], sigOf)]));
  const sig = {}, sim = {};
  for (const [w, { from, to, label }] of Object.entries(WINDOWS)) {
    const inW = (x) => x.t >= T(from) && x.t < T(to);
    const per = Object.fromEntries(idx.map((k) => [k, rowsAll[k].filter(inW)]));
    const ew = ewRows(idx.map((k) => per[k]));
    const tests = Object.fromEntries(idx.map((k) => [k, signalTest(per[k])]));
    const hp = holm(idx.map((k) => pOf(tests[k].t)));
    idx.forEach((k, i) => { tests[k].pHolm = hp[i]; });
    const e = signalTest(ew);
    sig[w] = { label, from: day(ew[0].t), to: day(ew.at(-1).t), ew: slim(e), perIndex: Object.fromEntries(idx.map((k) => [k, slim(tests[k])])) };
    if (w === 'W2') {
      const ts = placebo(ew);
      sig[w].placebo = { seeds: SEEDS, onShare: r4(e.onShare), tMin: r4(Math.min(...ts)), tMedian: r4([...ts].sort((a, b) => a - b)[ts.length >> 1]), tMax: r4(Math.max(...ts)), atOrAboveReal: ts.filter((t) => t >= e.t).length };
    }
    const rules = [], benches = [], perSim = {};
    for (const k of idx) {
      const o = { spread: SPREAD[k], rate, from: T(from), to: T(to) };
      const a = simulate(data[k], onOf, o), b = simulate(data[k], (wk) => (sigOf(wk) ? true : null), o);
      rules.push(a.rets); benches.push(b.rets);
      perSim[k] = { name: NAMES[k], from: a.from, to: a.to, rule: slim(stats(a.rets)), bench: slim(stats(b.rets)), inMarket: r4(a.held / a.days), benchInMarket: r4(b.held / b.days), switches: a.switches, stops: a.stops, benchStops: b.stops, positions: a.trades.length + (a.openAtEnd ? 1 : 0) };
    }
    sim[w] = { label, markets: perSim, book: { rule: slim(stats(book(rules))), bench: slim(stats(book(benches))) } };
  }
  const info = Object.fromEntries(Object.entries(data).filter(([, v]) => v).map(([k, v]) => [k, { candles: v.length, first: day(v[0].time), last: day(v.at(-1).time) }]));
  return { sig, sim, data: info, missing };
}

function main() {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of [...METALS, ...INDICES]) {
      try { fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 })); }
      catch { console.log('missing on council-data:', k); }
    }
    fs.writeFileSync(path.join(dir, 'cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir);
    return;
  }
  if (mode !== 'full' || !dir) { console.log('usage: run.mjs fetch <dir> | full <dir>'); return; }
  const r = runAll(dir), p = passOf(r.sig, r.sim);
  const res = {
    built: '2026-11-13',
    prereg: 'research/edge/copper-gold/PREREGISTRATION.md',
    rule: 'paper research only: a stand-alone weekly long / flat rule on SPX500 and NAS100; not a gate, size or exit of the gold book; no live change',
    params: { lookWeeks: LOOK, threshold: 0, atrN: ATR_N, atrK: ATR_K, spread: SPREAD, financing: 'DGS2 + 2.5 % a year / 365 a night (nights(), Wednesday three)', nwLags: NW_LAGS, placeboSeeds: SEEDS },
    data: r.data,
    missing: r.missing,
    signal: r.sig,
    rule_vs_benchmark: r.sim,
    pass: p,
    verdict: p.pass ? 'PASS' : 'FAIL',
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, pass: p, sig: r.sig, sim: Object.fromEntries(Object.entries(r.sim).map(([w, x]) => [w, x.book])) }, null, 1));
  for (const w of ['W1', 'W2']) for (const k of INDICES) { const m = r.sim[w].markets[k]; if (m) console.log(w, k, JSON.stringify(m)); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
