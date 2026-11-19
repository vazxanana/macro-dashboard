// Gold after a day that closes at its extreme (a "full close"), against the same trade after every day (PREREGISTRATION.md).
//   git show origin/council-data:research/daily/xau.json > <dir>/xau.json   (cache kept out of git)
//   node research/edge/gold-marubozu-close/run.mjs <dir>                     the study -> result.json + RESULT.md
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const D = 86400;
export const SPREAD = 0.30, SLIP = SPREAD / 2, RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const ATR_N = 20, BUF = 0.30, FLOOR_ATR = 0.5, HOLD = 3;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const TESTS = {
  T1: { name: 'T1 full close up (top 10 %, range >= 0.5 ATR), buy', side: 1, band: 0.10, minR: 0.5 },
  T2: { name: 'T2 full close up on a wide day (top 10 %, range >= 1.0 ATR), buy', side: 1, band: 0.10, minR: 1.0 },
  T3: { name: 'T3 full close down (bottom 15 %, range >= 0.5 ATR), sell', side: -1, band: 0.15, minR: 0.5 },
};

export function enrich(ds) {
  const tr = ds.map((x, i) => (i ? Math.max(x.high, ds[i - 1].close) - Math.min(x.low, ds[i - 1].close) : null));
  return ds.map((x, i) => { let atr = null; if (i >= ATR_N) { let s = 0; for (let k = i - ATR_N + 1; k <= i; k++) s += tr[k]; atr = s / ATR_N; } return { ...x, atr }; });
}
// range filter of day i (reads day i and earlier only)
export const wideEnough = (x, minR) => x.atr > 0 && x.high - x.low >= minR * x.atr;
// full close of day i for this test: +1 / -1 when it is a setup of the test's side, else 0
export function fullClose(ds, i, t) {
  const x = ds[i], r = x.high - x.low;
  if (!(r > 0) || !wideEnough(x, t.minR)) return 0;
  if (t.side > 0 && x.close >= x.high - t.band * r) return 1;
  if (t.side < 0 && x.close <= x.low + t.band * r) return -1;
  return 0;
}
// one trade from day i (rule, baseline and placebo alike)
export function simulate(ds, i, side) {
  const sig = ds[i], last = i + HOLD;
  if (!(sig.atr > 0) || last >= ds.length) return null;
  const e = ds[i + 1], fill = e.open;
  let stop = side > 0 ? sig.low - BUF : sig.high + BUF;
  if (Math.abs(fill - stop) < FLOOR_ATR * sig.atr || (side > 0 ? stop >= fill : stop <= fill)) stop = fill - side * FLOOR_ATR * sig.atr;
  const risk = Math.abs(fill - stop);
  let exit = null, how = null, j;
  for (j = i + 1; j <= last; j++) { const c = ds[j];
    if (j > i + 1 && (side > 0 ? c.open <= stop : c.open >= stop)) { exit = c.open; how = 'stop'; break; }
    if (side > 0 ? c.low <= stop : c.high >= stop) { exit = stop; how = 'stop'; break; }
    if (j === last) { exit = c.close; how = 'time'; break; } }
  const entryT = e.t, exitT = ds[j].t + D, gross = side * (exit - fill) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const cost = RT / risk, fin = side > 0 ? nn * FIN.xau.long * fill / risk : 0;
  return { i, exitDay: j, side, entryT, exitT, entry: fill, stop, risk, exit, how, nights: nn, gross, cost, fin,
    net: gross - (cost + fin), net2: gross - 2 * (cost + fin) };
}
export function runRule(ds, t) {
  const out = []; let free = 0;
  for (let i = ATR_N; i < ds.length - 1; i++) {
    if (i < free || fullClose(ds, i, t) !== t.side) continue;
    const tr = simulate(ds, i, t.side); if (tr) { out.push(tr); free = tr.exitDay + 1; }
  }
  return out;
}
export function runBase(ds, side) {
  const out = []; for (let i = ATR_N; i < ds.length - 1; i++) { const tr = simulate(ds, i, side); if (tr) out.push(tr); } return out;
}

export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const yr = (x) => ymd(x.entryT).slice(0, 4);
export const inWin = (T, [f, t]) => T.filter((x) => { const s = ymd(x.entryT); return s >= f && s <= t; });
export const mean = (T, k) => (T.length ? T.reduce((a, x) => a + x[k], 0) / T.length : 0);
export function yearMeans(base) {
  const m = {}; for (const x of base) { const y = yr(x); (m[y] ||= { n: 0, net: 0, net2: 0 }); m[y].n++; m[y].net += x.net; m[y].net2 += x.net2; }
  for (const y of Object.keys(m)) { m[y].net /= m[y].n; m[y].net2 /= m[y].n; } return m;
}
export const excess = (T, ym) => T.map((x) => ({ ...x, ex: x.net - ym[yr(x)].net, ex2: x.net2 - ym[yr(x)].net2 }));
export function monthT(T, [f, t], key) {
  const sums = new Map(); for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of T) { const k = ymd(x.exitT - 1).slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
  const v = [...sums.values()], n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? m / (sd / Math.sqrt(n)) : 0 };
}
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
export function holm(ps) { const o = ps.map((p, k) => [p, k]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, k], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[k] = run; }); return adj; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3)), r2 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(2));

export function summary(T, w) {
  const n = T.length, mt = monthT(T, w, 'ex');
  return { n, mean: r3(mean(T, 'ex')), mean2x: r3(mean(T, 'ex2')), gross: r3(mean(T, 'gross')), net: r3(mean(T, 'net')), net2x: r3(mean(T, 'net2')),
    cost: r3(mean(T, 'cost')), fin: r3(mean(T, 'fin')), total: r2(T.reduce((a, x) => a + x.ex, 0)),
    win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null, stops: T.filter((x) => x.how !== 'time').length,
    months: mt.months, t: r2(mt.t), tNet: r2(monthT(T, w, 'net').t), tGross: r2(monthT(T, w, 'gross').t) };
}
// placebo day: same year, same close-to-close direction, same range filter, close NOT in the full-close band
export function placeboPool(ds, t) {
  const by = new Map();
  for (let i = ATR_N; i < ds.length - HOLD - 1; i++) { const x = ds[i], p = ds[i - 1];
    if (!wideEnough(x, t.minR) || fullClose(ds, i, t) !== 0) continue;
    if (t.side > 0 ? !(x.close > p.close) : !(x.close < p.close)) continue;
    const y = ymd(ds[i + 1].t).slice(0, 4); if (!by.has(y)) by.set(y, []); by.get(y).push(i); }
  return by;
}
export function placebo(ds, real, t, ym, seeds = 40) {
  const pool = placeboPool(ds, t), means = [];
  for (let s = 1; s <= seeds; s++) { const r = rng(10500 + s), v = [];
    for (const x of real) { const P = pool.get(yr(x)) || []; if (!P.length) continue;
      const tr = simulate(ds, P[Math.floor(r() * P.length)], t.side); if (tr) v.push(tr.net - ym[yr(tr)].net); }
    means.push(v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0); }
  return means;
}

export function load(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bars = j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  return enrich(foldWeekend(bars).map((b) => ({ t: b.time, open: b.open, high: b.high, low: b.low, close: b.close })));
}

export function study(ds) {
  const out = { tests: {}, baseline: {} }, ps = [], ym = {};
  for (const side of [1, -1]) { const all = runBase(ds, side); ym[side] = yearMeans(all);
    for (const [w, win] of Object.entries(WIN)) { const T = inWin(all, win);
      out.baseline[`${side > 0 ? 'long' : 'short'}_${w}`] = { n: T.length, gross: r3(mean(T, 'gross')), net: r3(mean(T, 'net')), net2x: r3(mean(T, 'net2')), t: r2(monthT(T, win, 'net').t) }; } }
  for (const [k, t] of Object.entries(TESTS)) {
    const all = excess(runRule(ds, t), ym[t.side]), res = {};
    for (const [w, win] of Object.entries(WIN)) res[w] = inWin(all, win);
    const so = summary(res.oos, WIN.oos), si = summary(res.is, WIN.is);
    const pl = placebo(ds, res.oos, t, ym[t.side]), sorted = [...pl].sort((a, b) => a - b);
    const p = 1 - phi(so.t || 0); ps.push(p);
    const years = {}; for (const x of [...res.is, ...res.oos]) (years[yr(x)] ||= []).push(x);
    out.tests[k] = { name: t.name, oos: so, is: si, p: +p.toFixed(4),
      placebo: { beaten: pl.filter((m) => so.mean > m).length, of: pl.length, p5: r3(sorted[1]), median: r3(sorted[19]), p95: r3(sorted[37]) },
      years: Object.fromEntries(Object.entries(years).map(([y, T]) => [y, { n: T.length, ex: r3(mean(T, 'ex')), net: r3(mean(T, 'net')) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { n: x.oos.n >= 100 && x.is.n >= 100, oos: x.oos.mean > 0 && x.oos.t >= 2 && x.holm < 0.05, is: x.is.mean > 0,
      cost2x: x.oos.mean2x > 0 && x.oos.net2x > 0, placebo: x.placebo.beaten >= 38 };
    x.pass = Object.values(x.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passCount = Object.values(out.tests).filter((x) => x.pass).length;
  return out;
}

const sg = (v, d = 3) => (v == null ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
export function verdictLine(r) {
  const t = r.tests.T1;
  return `**Verdict: ${r.verdict}, ${r.passCount} of 3: buying gold after a close in the top tenth of its range made ${sg(t.oos.mean)}R a trade over the every-day buy 2017-26 (n ${t.oos.n}, month t ${sg(t.oos.t, 2)}); 2007-16 ${sg(t.is.mean)}R.**`;
}
export function report(r) {
  const L = [];
  L.push('# Gold after a day that closes at its extreme (a "full close"): result (2026-11-14)', '');
  L.push(verdictLine(r), '');
  L.push('Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed; sha256 in `result.json`). A new',
    'stand-alone daily rule, **not a gate, exit, entry or size of the gold book** (docs/owner-decisions.md item 44); none of that',
    'book\'s positions were read. Paper research only: nothing live changed and no proposal is written. This page is written by',
    '`run.mjs` from `result.json`.', '');
  L.push('## Rule (as pre-registered)', '',
    `Data: ${r.data.src}, ${r.data.from} to ${r.data.to}, ${r.data.days} days. A setup is day i with a range of at least 0.5 (T2: 1.0)`,
    'x ATR(20) whose close is in the top 10 % of its range (T3: the bottom 15 %). Entry at the next UTC open; stop $0.30 past the',
    'setup day\'s low (high for the sell), at least 0.5 x ATR away; out at the third daily close. One position at a time. Costs',
    `$${r.costs.roundTrip.toFixed(2)} a round trip plus financing on buys (${r.costs.financing.rate} of price a rollover). Excess = net R`,
    'minus the mean net R of the same trade after every day of the same calendar year (same side).', '');
  L.push('## Tests (R of the stop; excess over the same-year every-day trade; t on calendar-month sums)', '');
  L.push('| Test | Period | n | Win | Gross R | Net R | Net 2x | Excess R | Excess 2x | t excess | t net | t gross | Stops |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const x of Object.values(r.tests)) for (const [w, lab] of [['is', '2007-2016'], ['oos', '2017 → 2026-10']]) { const s = x[w];
    L.push(`| ${x.name} | ${lab} | ${s.n} | ${s.win.toFixed(1)} % | ${sg(s.gross)} | ${sg(s.net)} | ${sg(s.net2x)} | ${sg(s.mean)} | ${sg(s.mean2x)} | ${sg(s.t, 2)} | ${sg(s.tNet, 2)} | ${sg(s.tGross, 2)} | ${s.stops} |`); }
  L.push('', '## Baseline (the same trade after every day)', '', '| Side | Period | n | Gross R | Net R | Net 2x | t net |', '|---|---|---|---|---|---|---|');
  for (const [k, b] of Object.entries(r.baseline)) L.push(`| ${k.split('_')[0]} | ${k.endsWith('is') ? '2007-2016' : '2017 → 2026-10'} | ${b.n} | ${sg(b.gross)} | ${sg(b.net)} | ${sg(b.net2x)} | ${sg(b.t, 2)} |`);
  L.push('', '## Decision (out of sample, Holm over the three tests)', '',
    '| Test | p | Holm p | excess > 0, t ≥ 2, Holm < 0.05 | 2007-16 excess > 0 | 2x costs > 0 | placebos beaten (need 38 of 40) | n ≥ 100 each window | pass |',
    '|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const [k, x] of Object.entries(r.tests)) L.push(`| ${k} | ${x.p} | ${x.holm} | ${yn(x.checks.oos)} | ${yn(x.checks.is)} | ${yn(x.checks.cost2x)} | ${x.placebo.beaten} of ${x.placebo.of} | ${yn(x.checks.n)} | **${x.pass ? 'pass' : 'fail'}** |`);
  L.push('', 'Placebo: each real out-of-sample trade replaced by the same trade after a random day of the same year that moved the same',
    'way and passed the same range filter but did not close in the band (keeps drift, direction and volatility; removes where',
    'the close sat). Placebo mean excess, 5th / 50th / 95th percentile of the 40 draws:', '');
  for (const [k, x] of Object.entries(r.tests)) L.push(`- ${k}: ${sg(x.placebo.p5)} / ${sg(x.placebo.median)} / ${sg(x.placebo.p95)} (real ${sg(x.oos.mean)})`);
  L.push('', '## By year (excess R a trade)', '', '| Year | ' + Object.keys(r.tests).join(' | ') + ' |', '|---|' + Object.keys(r.tests).map(() => '---').join('|') + '|');
  const ys = [...new Set(Object.values(r.tests).flatMap((x) => Object.keys(x.years)))].sort();
  for (const y of ys) L.push(`| ${y} | ` + Object.values(r.tests).map((x) => (x.years[y] ? `${sg(x.years[y].ex)} (${x.years[y].n})` : '')).join(' | ') + ' |');
  L.push('', '## Reading', '', r.reading, '');
  L.push('To repeat: `git show origin/council-data:research/daily/xau.json > <dir>/xau.json`, then',
    '`node research/edge/gold-marubozu-close/run.mjs <dir>`. Tests: `tests/gold-marubozu-close.test.mjs`.', '');
  return L.join('\n');
}

function main(dir) {
  const ds = load(path.join(dir, 'xau.json'));
  const res = study(ds);
  const pre = fs.readFileSync(new URL('./PREREGISTRATION.md', import.meta.url));
  const out = { built: '2026-11-14', prereg: { sha256: crypto.createHash('sha256').update(pre).digest('hex') },
    data: { src: 'council-data research/daily/xau.json (OANDA mid, UTC days), weekends folded (council/fills.mjs foldWeekend)', from: ymd(ds[0].t), to: ymd(ds.at(-1).t), days: ds.length },
    costs: { spread: SPREAD, slippagePerOrder: SLIP, roundTrip: RT, financing: { rate: FIN.xau.long, side: 'longs only' } },
    rule: { atr: ATR_N, buffer: BUF, floorAtr: FLOOR_ATR, hold: HOLD }, windows: WIN, ...res };
  out.reading = process.env.READING || '';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(out));
  console.log(JSON.stringify(out.baseline));
  for (const [k, x] of Object.entries(out.tests)) console.log(k, JSON.stringify({ oos: x.oos, is: x.is, holm: x.holm, placebo: x.placebo, checks: x.checks }));
  console.log(verdictLine(out), verdictLine(out).length);
}
if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2]);
