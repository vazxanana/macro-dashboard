// Elder's ray pullback in the 13-day EMA trend, on spot gold daily (PREREGISTRATION.md, pushed first).
//   git show origin/council-data:research/daily/xau.json > <dir>/xau.json     (cache out of git, no network)
//   node research/edge/gold-elder-ray/run.mjs <dir>/xau.json                  the study -> result.json, RESULT.md
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const D = 86400;
export const EMA_N = 13, EMA_FROM = 26, STOP_ATR = 1.0, HOLD = 3, ATR_N = 20, COST = 0.60;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const TESTS = {
  T1: { name: 'T1 Elder ray pullback, both sides, net R (primary)', control: null },
  T2: { name: 'T2 Elder ray minus the same-side trade on every day of its year (primary)', control: 'every' },
  T3: { name: 'T3 Elder ray minus the same-side trade on any day of the same EMA13 slope (secondary)', control: 'trend' },
};

// daily candles [t,o,h,l,c,...] -> weekday days (weekend folded) with ATR(20) of the 20 true ranges ending at each day
export function build(rows) {
  const ds = foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
  const tr = ds.map((x, i) => (i ? Math.max(x.high, ds[i - 1].close) - Math.min(x.low, ds[i - 1].close) : null));
  const k = 2 / (EMA_N + 1); let e = null;
  ds.forEach((x, i) => { e = i ? x.close * k + e * (1 - k) : x.close; x.ema = i >= EMA_FROM ? e : null; });
  ds.forEach((x, i) => { if (i >= ATR_N) { let s = 0; for (let q = i - ATR_N + 1; q <= i; q++) s += tr[q]; x.atr = s / ATR_N; } else x.atr = null; });
  return ds;
}
// EMA13 slope at day i: +1 rising, -1 falling, 0 flat or unknown (candles up to day i only)
export function slopeAt(ds, i) { if (i < 1 || ds[i].ema == null || ds[i - 1].ema == null) return 0; return Math.sign(ds[i].ema - ds[i - 1].ema); }
export const bear = (x) => x.low - x.ema, bull = (x) => x.high - x.ema;
// the setup known at the close of day i: +1 = EMA rising, bear power < 0 and higher than the day before; -1 mirrors it
export function setupAt(ds, i) {
  const sl = slopeAt(ds, i); if (!sl || !ds[i].atr) return null; const a = ds[i], b = ds[i - 1];
  if (sl > 0 && bear(a) < 0 && bear(a) > bear(b)) return { i, side: 1, p: bear(a) };
  if (sl < 0 && bull(a) > 0 && bull(a) < bull(b)) return { i, side: -1, p: bull(a) };
  return null;
}
export function setups(ds) { const out = []; for (let i = 1; i < ds.length; i++) { const s = setupAt(ds, i); if (s) out.push(s); } return out; }

// costs: $0.60 a round trip (x mult), financing on buys by nights x FIN.xau.long x entry, all in R of the risk
export function cost(side, entry, stop, exit, entryT, exitT) {
  const risk = side * (entry - stop), gross = side * (exit - entry) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const c = COST / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
  return { gross, cost: c, fin, nights: nn, net: gross - c - fin, net2: gross - 2 * (c + fin) };
}
// the trade entered at the open of day e (signal known at the close of day e-1): stop 1 ATR(20) of day e-1, out at the close of
// day e+HOLD-1; from the second day an open beyond the stop exits at the open; a range reaching the stop exits at the stop
export function tradeAt(ds, e, side) {
  const last = e + HOLD - 1; if (last >= ds.length || !ds[e - 1] || !ds[e - 1].atr) return null;
  const entry = ds[e].open, stop = entry - side * STOP_ATR * ds[e - 1].atr;
  let exit = null, xd = last, how = 'time', xt = ds[last].time + D;
  for (let q = e; q <= last; q++) { const c = ds[q];
    if (q > e && (side > 0 ? c.open <= stop : c.open >= stop)) { exit = c.open; xd = q; how = 'stop'; xt = c.time; break; }
    if (side > 0 ? c.low <= stop : c.high >= stop) { exit = stop; xd = q; how = 'stop'; xt = c.time + D / 2; break; } }
  if (exit == null) exit = ds[last].close;
  return { side, e, xd, entry, stop, exit, how, entryT: ds[e].time, exitT: xt, risk: side * (entry - stop), ...cost(side, entry, stop, exit, ds[e].time, xt) };
}
export function runTest(ds) {
  const out = []; let free = -1;
  for (const s of setups(ds)) { const e = s.i + 1; if (e <= free) continue; const t = tradeAt(ds, e, s.side); if (!t) continue; out.push({ ...t, i: s.i, m: s.m }); free = t.xd; }
  return out;
}
export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// control pools per year: 'every' = every day with ATR and EMA known; 'trend' = days whose PREVIOUS day had the same-side
// EMA13 slope (rising for buys, falling for sells) and was not a setup. Keyed by year and side.
export function pools(ds) {
  const P = { every: new Map(), trend: new Map() }, put = (m, k, e) => { if (!m.has(k)) m.set(k, []); m.get(k).push(e); };
  for (let e = Math.max(ATR_N, EMA_FROM) + 2; e < ds.length; e++) { if (!ds[e - 1].atr || ds[e - 1].ema == null) continue; const y = ymd(ds[e].time).slice(0, 4);
    put(P.every, `${y}:1`, e); put(P.every, `${y}:-1`, e);
    const sl = slopeAt(ds, e - 1); if (!sl || setupAt(ds, e - 1)) continue;
    put(P.trend, `${y}:${sl}`, e); }
  return P;
}
export function addExcess(ds, T, pool, key) {
  const memo = new Map();
  for (const x of T) { const k = `${ymd(x.entryT).slice(0, 4)}:${x.side}`;
    if (!memo.has(k)) { let s = 0, s2 = 0, n = 0; for (const e of pool.get(k) || []) { const c = tradeAt(ds, e, x.side); if (!c) continue; s += c.net; s2 += c.net2; n++; }
      memo.set(k, n ? { m: s / n, m2: s2 / n, n } : null); }
    const c = memo.get(k); x[key] = c ? x.net - c.m : null; x[key + '2'] = c ? x.net2 - c.m2 : null; x[key + 'Ctl'] = c ? c.m : null; x[key + 'N'] = c ? c.n : 0; }
  return T;
}
export const inWin = (T, [f, t]) => T.filter((x) => { const s = ymd(x.entryT); return s >= f && s <= t; });
export function monthT(T, [f, t], key = 'net') {
  const sums = new Map(); for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of T) { if (x[key] == null) continue; const k = ymd(x.exitT).slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
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
const avg = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : null);
export function summary(T, w, key = 'net', key2 = 'net2') {
  const U = T.filter((x) => x[key] != null), n = U.length, mt = monthT(U, w, key), mg = monthT(U, w, 'gross');
  let eq = 0, pk = 0, dd = 0; for (const x of U) { eq += x[key]; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, buys: U.filter((x) => x.side > 0).length, sells: U.filter((x) => x.side < 0).length,
    gross: r3(avg(U.map((x) => x.gross))), value: r3(avg(U.map((x) => x[key]))), at2x: r3(avg(U.map((x) => x[key2]))),
    cost: r3(avg(U.map((x) => x.cost))), fin: r3(avg(U.map((x) => x.fin))), total: r2(U.reduce((a, x) => a + x[key], 0)),
    win: n ? r2(U.filter((x) => x.net > 0).length / n * 100) : null, stops: U.filter((x) => x.how === 'stop').length,
    riskUsd: r2(n ? [...U].map((x) => x.risk).sort((a, b) => a - b)[n >> 1] : null), months: mt.months, t: r2(mt.t), tGross: r2(mg.t), dd: r2(dd) };
}
// placebo: each real OOS trade -> the trade of a random eligible day of the same year, same side
export function placebo(ds, real, every, seeds = 40) {
  const means = [];
  for (let s = 1; s <= seeds; s++) { const r = rng(7600 + s), v = [];
    for (const x of real) { const pool = every.get(`${ymd(x.entryT).slice(0, 4)}:${x.side}`) || []; let c = null;
      for (let k = 0; k < 20 && !c && pool.length; k++) c = tradeAt(ds, pool[Math.floor(r() * pool.length)], x.side);
      if (c) v.push(c.net); }
    means.push(avg(v)); }
  return means;
}

function fmt(v, d = 3) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d); }
export function report(out) {
  const L = [];
  L.push(`# Elder's ray pullback in the 13-day EMA trend, on spot gold daily: result (${out.built})`, '');
  L.push(`**Verdict: ${out.verdict}**`, '');
  L.push('Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed; sha256 in `result.json`). A new stand-alone');
  L.push('daily rule, not a gate, exit, entry or size of the gold book (docs/owner-decisions.md item 44); nothing of that book was read.');
  L.push('Paper research only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.', '');
  L.push('## Rule (as pre-registered)', '');
  L.push('- Council-data OANDA mid XAU/USD daily candles (UTC days), weekend candles folded into the next weekday (`foldWeekend`), ATR(20).');
  L.push(`- Buy at the close of day i when EMA${EMA_N}(close) is rising, low − EMA < 0 and higher than the day before; sell when EMA${EMA_N} is falling,`);
  L.push('  high − EMA > 0 and lower than the day before (Elder\'s bear / bull power).');
  L.push(`- Entry at the open of day i+1, **stop ${STOP_ATR} ATR(20) away on every trade**, out at the close of day i+${HOLD}; an open beyond the stop exits at`);
  L.push('  the open, a range reaching it exits at the stop. One position at a time.');
  L.push(`- Costs: $${COST.toFixed(2)} a round trip (2x = $${(2 * COST).toFixed(2)}); financing on buys = nights x FIN.xau.long (${out.costs.financing.rate}) x entry.`);
  L.push('- T2 control: the same-side trade (same stop, hold, costs) entered at the open of EVERY eligible day of the trade\'s calendar year;');
  L.push('  T3 control: only the days after a day of the same-side EMA13 slope that was not a setup. Excess = the trade\'s net R minus the control mean.');
  L.push(`- In sample ${out.windows.is.join(' to ')}, out of sample (decisive) ${out.windows.oos.join(' to ')} by entry date; t on calendar-month sums`);
  L.push('  (every month, 0 when nothing closed); Holm over the three out-of-sample one-sided p values; placebo = 40 seeds (T1).', '');
  L.push(`Data: ${out.data.src}, ${out.data.from} to ${out.data.to} (${out.data.days} weekdays).`, '');
  L.push('## Results', '');
  L.push('| Test | Window | n (buys / sells) | Gross R | Measure | Value | At 2x costs | Win % | Stops | Total | Worst DD | Month t | Month t gross | Median risk $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, t] of Object.entries(out.tests)) for (const w of ['is', 'oos']) { const s = t[w];
    L.push(`| ${k} | ${w === 'is' ? 'IS 2007-16' : 'OOS 2017-26'} | ${s.n} (${s.buys} / ${s.sells}) | ${fmt(s.gross)} | ${t.measure} | ${fmt(s.value)} | ${fmt(s.at2x)} | ${s.win ?? '—'} | ${s.stops} | ${fmt(s.total, 2)} | ${fmt(s.dd, 2)} | ${fmt(s.t, 2)} | ${fmt(s.tGross, 2)} | ${s.riskUsd ?? '—'} |`); }
  L.push('', 'Tests: ' + Object.values(out.tests).map((t) => t.name).join('; ') + '.', '');
  L.push(`Control means (net R a trade): T2 every day IS ${fmt(out.tests.T2.ctlIs)}, OOS ${fmt(out.tests.T2.ctlOos)}; T3 same EMA13 slope IS ${fmt(out.tests.T3.ctlIs)}, OOS ${fmt(out.tests.T3.ctlOos)}.`, '');
  L.push('## The checks', '');
  L.push('| Test | OOS value > 0 | OOS t ≥ 2 | Holm p ≤ 0.05 | IS value > 0 | OOS at 2x > 0 | Beats ≥ 38 of 40 placebos | OOS n ≥ 30 | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const [k, t] of Object.entries(out.tests)) { const c = t.checks;
    L.push(`| ${k} | ${yn(c.oosPos)} | ${yn(c.t2)} | ${yn(c.holm)} (${t.holmP}) | ${yn(c.isPos)} | ${yn(c.x2)} | ${c.placebo == null ? 'n/a' : yn(c.placebo)} | ${yn(c.n30)} | ${yn(t.pass)} |`); }
  const p = out.tests.T1.placebo;
  L.push('', '## Placebo (out of sample, 40 seeds, T1)', '');
  L.push('Each OOS trade is replaced by the trade of a random eligible day of the same year (same side, stop, hold, costs).', '');
  L.push('| Real net R a trade | Seeds beaten | Placebo median | Placebo 95th pct | Placebo min / max |'); L.push('|---|---|---|---|---|');
  L.push(`| ${fmt(out.tests.T1.oos.value)} | ${p.beaten} of 40 | ${fmt(p.median)} | ${fmt(p.p95)} | ${fmt(p.min)} / ${fmt(p.max)} |`);
  L.push('', '## Setups (reported)', '');
  L.push(`Setups ${out.funnel.setups} (buy ${out.funnel.buySetups}, sell ${out.funnel.sellSetups}); traded one at a time ${out.funnel.traded}.`, '');
  L.push('## Reading', '');
  for (const s of out.reading) L.push(s);
  L.push('');
  return L.join('\n');
}

function main(file) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const j = JSON.parse(fs.readFileSync(file, 'utf8')), ds = build(j.rows), P = pools(ds);
  const pre = fs.readFileSync(path.join(here, 'PREREGISTRATION.md'));
  const out = { built: '2026-11-14', prereg: crypto.createHash('sha256').update(pre).digest('hex'),
    data: { src: 'council-data research/daily/xau.json (OANDA mid XAU_USD daily, UTC days, weekend folded)', from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length, updated: j.updated },
    rule: { ema: EMA_N, emaFrom: EMA_FROM, stopAtr: STOP_ATR, holdDays: HOLD, atr: ATR_N },
    costs: { roundTrip: COST, financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'buys only' } }, windows: WIN, tests: {} };
  const S = setups(ds), all = runTest(ds);
  addExcess(ds, all, P.every, 'exc'); addExcess(ds, all, P.trend, 'exs');
  out.funnel = { setups: S.length, buySetups: S.filter((s) => s.side > 0).length, sellSetups: S.filter((s) => s.side < 0).length, traded: all.length };
  const ps = [];
  for (const [k, test] of Object.entries(TESTS)) {
    const key = test.control === 'every' ? 'exc' : test.control === 'trend' ? 'exs' : 'net', key2 = key + '2';
    const k2 = key === 'net' ? 'net2' : key2;
    const oos = inWin(all, WIN.oos), is = inWin(all, WIN.is), so = summary(oos, WIN.oos, key, k2), si = summary(is, WIN.is, key, k2);
    let pl = null;
    if (!test.control) { const m = placebo(ds, oos, P.every), z = [...m].sort((a, b) => a - b);
      pl = { beaten: m.filter((v) => so.value > v).length, median: r3((z[19] + z[20]) / 2), p95: r3(z[37]), min: r3(z[0]), max: r3(z[39]), means: m.map(r3) }; }
    const p = 1 - phi(so.t || 0); ps.push(p);
    const ck = key + 'Ctl';
    out.tests[k] = { name: test.name, measure: test.control ? 'excess R' : 'net R', is: si, oos: so, p: +p.toFixed(4), placebo: pl,
      ctlIs: test.control ? r3(avg(is.filter((x) => x[ck] != null).map((x) => x[ck]))) : undefined,
      ctlOos: test.control ? r3(avg(oos.filter((x) => x[ck] != null).map((x) => x[ck]))) : undefined };
  }
  out.trades = inWin(all, WIN.oos).map((x) => [ymd(x.entryT), x.side, r3(x.net), r3(x.exc), r3(x.exs)]);
  const adj = holm(ps);
  Object.values(out.tests).forEach((t, n) => { t.holmP = +adj[n].toFixed(4);
    t.checks = { oosPos: t.oos.value > 0, t2: t.oos.t >= 2, holm: adj[n] <= 0.05, isPos: t.is.value > 0, x2: t.oos.at2x > 0,
      placebo: t.placebo ? t.placebo.beaten >= 38 : null, n30: t.oos.n >= 30 };
    t.pass = Object.values(t.checks).every((v) => v !== false); });
  const T1 = out.tests.T1, T2 = out.tests.T2, T3 = out.tests.T3, pass = T1.pass && T2.pass;
  out.pass = pass; out.passCount = [T1, T2, T3].filter((t) => t.pass).length;
  out.verdict = `${pass ? 'PASS' : 'FAIL'}, ${out.passCount} of 3: the gold Elder ray pullback made ${fmt(T1.oos.value)}R a trade net out of sample (n ${T1.oos.n}, month t ${fmt(T1.oos.t, 2)}), ${fmt(T2.oos.value)}R over the every-day trade (t ${fmt(T2.oos.t, 2)}); in sample ${fmt(T1.is.value)}R.`;
  out.reading = [
    `- T1: in sample ${fmt(T1.is.value)}R a trade net (n ${T1.is.n}, t ${fmt(T1.is.t, 2)}), out of sample ${fmt(T1.oos.value)}R (n ${T1.oos.n}, t ${fmt(T1.oos.t, 2)}), ${fmt(T1.oos.at2x)}R at twice the costs; costs ${fmt(T1.oos.cost)}R and financing ${fmt(T1.oos.fin)}R a trade out of sample; placebo beaten ${T1.placebo.beaten} of 40.`,
    `- T2 (the signal against gold's own drift): ${fmt(T2.is.value)}R in sample (t ${fmt(T2.is.t, 2)}), ${fmt(T2.oos.value)}R out of sample (t ${fmt(T2.oos.t, 2)}).`,
    `- T3 (the ray against the same EMA13 slope alone): ${fmt(T3.is.value)}R in sample (t ${fmt(T3.is.t, 2)}), ${fmt(T3.oos.value)}R out of sample (t ${fmt(T3.oos.t, 2)}).`,
    pass ? '- Passes the pre-registered bar: a lead to replicate on other markets or years before it is called more; nothing live changes.'
      : '- Not an edge: nothing is proposed and nothing live changes. Do not re-fit the EMA length, the power rule, stop or hold on these results.',
  ];
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(out));
  console.log(out.verdict);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main(process.argv[2]);
