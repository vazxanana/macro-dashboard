// Hikkake (a failed break of an inside day) on spot gold daily (PREREGISTRATION.md, pushed first).
//   node --use-env-proxy research/edge/gold-hikkake/fetch.mjs <dir>   OANDA mid H1 gold (cache out of git)
//   node research/edge/gold-hikkake/run.mjs <dir>                     the study -> result.json, RESULT.md
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { days, nyDay } from '../gold-drd-long/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

export const H = 3600;
export const B = 0.30, WAIT = 3, HOLD = 3, RR = 2, ATR_N = 20, COST = 0.60;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const TESTS = {
  T1: { name: 'T1 hikkake, both sides, net R (primary)', target: false, excess: false },
  T2: { name: 'T2 hikkake, both sides, net R minus the same-side trade on every day (primary)', target: false, excess: true },
  T3: { name: 'T3 hikkake, both sides, 2R target, net R', target: true, excess: false },
};

// H1 candles -> 17:00 New York days with first / last H1 index and ATR(20) of the 20 days ending at each day
export function build(h1) {
  const ds = days(h1), at = new Map(ds.map((x, j) => [x.d, j]));
  h1.forEach((c, k) => { const j = at.get(nyDay(c.time)); if (j == null) return; c.di = j; if (ds[j].a == null) ds[j].a = k; ds[j].b = k; });
  const tr = ds.map((x, i) => (i ? Math.max(x.high, ds[i - 1].close) - Math.min(x.low, ds[i - 1].close) : null));
  ds.forEach((x, i) => { if (i >= ATR_N) { let s = 0; for (let q = i - ATR_N + 1; q <= i; q++) s += tr[q]; x.atr = s / ATR_N; } else x.atr = null; });
  return ds;
}

// the setup closed at the end of day j = i + 1: inside day i, then day j breaks ONE side of it only.
// side +1 (buy): day j's low under day i's low, its high not above day i's high; side -1 mirrors. null otherwise.
export function setupAt(ds, j) {
  const i = j - 1; if (i < 1) return null;
  const p = ds[i - 1], d = ds[i], f = ds[j];
  if (!(d.high < p.high && d.low > p.low)) return null;
  if (f.low < d.low && f.high <= d.high) return { side: 1, i, j, level: d.high + B, fail: f.low, stop: f.low - B };
  if (f.high > d.high && f.low >= d.low) return { side: -1, i, j, level: d.low - B, fail: f.high, stop: f.high + B };
  return null;
}

// the stop order works from the first H1 candle of day j+1 to the end of day j+WAIT. Cancelled once price trades through
// the false-break extreme first (a candle that reaches both is cancelled: order unknown). -> { fillK, fill, stop } or null
export function entryOf(h1, ds, s) {
  const { side, j, level, fail, stop } = s;
  if (j + WAIT >= ds.length) return null;
  for (let q = j + 1; q <= j + WAIT; q++) if (ds[q].a == null) return null;
  for (let k = ds[j + 1].a; k <= ds[j + WAIT].b; k++) { const c = h1[k];
    const hit = side > 0 ? c.high >= level : c.low <= level, broke = side > 0 ? c.low <= fail : c.high >= fail;
    if (broke) return null;
    if (hit) { const fill = side > 0 ? Math.max(c.open, level) : Math.min(c.open, level);
      if (side > 0 ? stop >= fill : stop <= fill) return null;
      return { ...s, fillK: k, fill }; } }
  return null;
}

// manage from candle k0: worst = the entry was a stop order inside k0 (only the stop counts on k0). Out at the close of day d0 + hold.
export function manage(h1, ds, side, entry, stop, k0, d0, hold, worst, target) {
  const risk = side * (entry - stop), tgt = target ? entry + side * RR * risk : null, last = d0 + hold;
  if (last >= ds.length || ds[last].b == null) return null;
  const end = ds[last].b;
  for (let k = k0; k <= end; k++) { const c = h1[k], first = k === k0;
    if (first && worst) { if (side > 0 ? c.low <= stop : c.high >= stop) return { exit: stop, k, how: 'stop' }; continue; }
    if (!first && (side > 0 ? c.open <= stop : c.open >= stop)) return { exit: c.open, k, how: 'stop' };
    if (side > 0 ? c.low <= stop : c.high >= stop) return { exit: stop, k, how: 'stop' };
    if (tgt != null && (side > 0 ? c.high >= tgt : c.low <= tgt)) return { exit: tgt, k, how: 'target' };
  }
  return { exit: h1[end].close, k: end, how: 'time' };
}
// costs: $0.60 a round trip on every trade (x mult), financing on buys by nights x FIN.xau.long x entry
export function cost(side, entry, stop, res, entryT, exitT) {
  const risk = side * (entry - stop), gross = side * (res.exit - entry) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const c = COST / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
  return { gross, cost: c, fin, nights: nn, net: gross - c - fin, net2: gross - 2 * (c + fin) };
}
export const dayOfK = (h1, k) => h1[k].di;
export function trade(h1, ds, e, target) {
  const d0 = dayOfK(h1, e.fillK), res = manage(h1, ds, e.side, e.fill, e.stop, e.fillK, d0, HOLD, true, target); if (!res) return null;
  const entryT = h1[e.fillK].time, exitT = h1[res.k].time + H, c = cost(e.side, e.fill, e.stop, res, entryT, exitT);
  const atr = ds[d0 - 1] && ds[d0 - 1].atr;
  return { side: e.side, insideDay: e.i, breakDay: e.j, d0, fillK: e.fillK, entry: e.fill, stop: e.stop, entryT, exitT, exitK: res.k,
    hold: HOLD, risk: e.side * (e.fill - e.stop), riskAtr: atr ? e.side * (e.fill - e.stop) / atr : null, exit: res.exit, how: res.how, ...c };
}
export function setups(ds) { const out = []; for (let j = 2; j < ds.length; j++) { const s = setupAt(ds, j); if (s) out.push(s); } return out; }
export function runTest(h1, ds, target) {
  const cands = []; for (const s of setups(ds)) { const e = entryOf(h1, ds, s); if (e) cands.push(e); }
  cands.sort((p, q) => p.fillK - q.fillK || p.side - q.side);
  const out = []; let free = -1;
  for (const e of cands) { if (e.fillK <= free) continue; const t = trade(h1, ds, e, target); if (!t) continue; out.push(t); free = t.exitK; }
  return out;
}

// the control trade of day e: same side, market entry at the first H1 open of day e, stop riskAtr x ATR(20) of day e-1, out at
// the close of day e + HOLD, the same target rule and costs
export function control(h1, ds, e, side, riskAtr, target) {
  if (ds[e].a == null || !ds[e - 1] || !ds[e - 1].atr) return null;
  const k0 = ds[e].a, entry = h1[k0].open, stop = entry - side * riskAtr * ds[e - 1].atr;
  const res = manage(h1, ds, side, entry, stop, k0, e, HOLD, false, target); if (!res) return null;
  return cost(side, entry, stop, res, h1[k0].time, h1[res.k].time + H);
}
export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// every eligible day of each calendar year (index list)
export function yearDays(ds) { const m = new Map(); for (let e = ATR_N + 1; e < ds.length; e++) { if (ds[e].a == null || !ds[e - 1].atr) continue;
  const y = ymd(ds[e].t).slice(0, 4); if (!m.has(y)) m.set(y, []); m.get(y).push(e); } return m; }
// excess: the trade's net (and net at 2x) minus the mean of its same-side control on every eligible day of its entry year
export function addExcess(h1, ds, T, target, byYear = yearDays(ds)) {
  for (const x of T) { if (x.riskAtr == null) { x.ctl = null; continue; }
    let s = 0, s2 = 0, n = 0;
    for (const e of byYear.get(ymd(x.entryT).slice(0, 4)) || []) { const c = control(h1, ds, e, x.side, x.riskAtr, target); if (!c) continue; s += c.net; s2 += c.net2; n++; }
    x.ctl = n ? s / n : null; x.ctlN = n; x.exc = n ? x.net - s / n : null; x.exc2 = n ? x.net2 - s2 / n : null; }
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
  const how = (h) => U.filter((x) => x.how === h).length;
  return { n, buys: U.filter((x) => x.side > 0).length, sells: U.filter((x) => x.side < 0).length,
    gross: r3(avg(U.map((x) => x.gross))), value: r3(avg(U.map((x) => x[key]))), at2x: r3(avg(U.map((x) => x[key2]))),
    cost: r3(avg(U.map((x) => x.cost))), fin: r3(avg(U.map((x) => x.fin))), total: r2(U.reduce((a, x) => a + x[key], 0)),
    win: n ? r2(U.filter((x) => x.net > 0).length / n * 100) : null, stops: how('stop'), targets: how('target'), times: how('time'),
    riskUsd: r2(n ? [...U].map((x) => x.risk).sort((a, b) => a - b)[n >> 1] : null), months: mt.months, t: r2(mt.t), tGross: r2(mg.t), dd: r2(dd) };
}
// placebo: each real OOS trade -> the control trade of a random eligible day of the same year (same side, stop in ATR, hold, target)
export function placebo(h1, ds, real, target, seeds = 40, byYear = yearDays(ds)) {
  const means = [];
  for (let s = 1; s <= seeds; s++) { const r = rng(6300 + s), v = [];
    for (const x of real) { if (x.riskAtr == null) continue; const pool = byYear.get(ymd(x.entryT).slice(0, 4)) || []; let c = null;
      for (let k = 0; k < 20 && !c && pool.length; k++) c = control(h1, ds, pool[Math.floor(r() * pool.length)], x.side, x.riskAtr, target);
      if (c) v.push(c.net); }
    means.push(avg(v)); }
  return means;
}

function fmt(v, d = 3) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d); }
export function report(out) {
  const L = [];
  L.push(`# Hikkake (a failed break of an inside day) on spot gold: result (${out.built})`, '');
  L.push(`**Verdict: ${out.verdict}**`, '');
  L.push('Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed; sha256 in `result.json`). A new stand-alone');
  L.push('daily rule, not a gate, exit, entry or size of the gold book (docs/owner-decisions.md item 44); nothing of that book was read.');
  L.push('Paper research only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.', '');
  L.push('## Rule (as pre-registered)', '');
  L.push('- OANDA mid H1 XAU/USD, 17:00 New York days (weekend hours dropped, `gold-drd-long` `days()`), ATR(20) of daily true ranges.');
  L.push('- Inside day i (high below, low above the day before). Day i+1 breaks ONE side only: low under day i\'s low with its high not');
  L.push('  above day i\'s high = a buy setup (the break down failed); the mirror = a sell setup.');
  L.push(`- A buy stop at day i's high + $${B.toFixed(2)} works from the first H1 candle of day i+2 to the end of day i+${1 + WAIT}; cancelled once price`);
  L.push(`  trades at or under day i+1's low first (a candle reaching both is cancelled). **Stop = day i+1's low − $${B.toFixed(2)} on every trade.**`);
  L.push(`- Out at the close of the ${HOLD}rd day after the fill day (T1, T2) or at a ${RR}R target first (T3); a stop gapped through fills at the`);
  L.push('  open; the fill candle counts only against the stop. One position at a time.');
  L.push(`- Costs: $${COST.toFixed(2)} a round trip (2x = $${(2 * COST).toFixed(2)}); financing on buys = nights x FIN.xau.long (${out.costs.financing.rate}) x entry.`);
  L.push('- T2 control: for every trade, the same-side trade entered at the first H1 open of EVERY eligible day of its calendar year with the');
  L.push('  same stop in ATR(20) units, the same hold, target rule and costs; excess = the trade\'s net R minus that mean.');
  L.push(`- In sample ${out.windows.is.join(' to ')}, out of sample (decisive) ${out.windows.oos.join(' to ')} by entry date; t on calendar-month sums`);
  L.push('  (every month, 0 when nothing closed); Holm over the three out-of-sample one-sided p values; placebo = 40 seeds.', '');
  L.push(`Data: ${out.data.src}, ${out.data.from} to ${out.data.to} (${out.data.h1} H1 candles, ${out.data.days} days).`, '');
  L.push('## Results', '');
  L.push('| Test | Window | n (buys / sells) | Gross R | Measure | Value | At 2x costs | Win % | Stop / target / time | Total | Worst DD | Month t | Month t gross | Median risk $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, t] of Object.entries(out.tests)) for (const w of ['is', 'oos']) { const s = t[w];
    L.push(`| ${k} | ${w === 'is' ? 'IS 2007-16' : 'OOS 2017-26'} | ${s.n} (${s.buys} / ${s.sells}) | ${fmt(s.gross)} | ${t.measure} | ${fmt(s.value)} | ${fmt(s.at2x)} | ${s.win ?? '—'} | ${s.stops} / ${s.targets} / ${s.times} | ${fmt(s.total, 2)} | ${fmt(s.dd, 2)} | ${fmt(s.t, 2)} | ${fmt(s.tGross, 2)} | ${s.riskUsd ?? '—'} |`); }
  L.push('', 'Tests: ' + Object.entries(out.tests).map(([, t]) => t.name).join('; ') + '.', '');
  L.push('T2 control means (net R a trade of the same-side trade on every day): IS ' + fmt(out.tests.T2.ctlIs) + ', OOS ' + fmt(out.tests.T2.ctlOos) + '.', '');
  L.push('## The checks', '');
  L.push('| Test | OOS value > 0 | OOS t ≥ 2 | Holm p ≤ 0.05 | IS value > 0 | OOS at 2x > 0 | Beats ≥ 38 of 40 placebos | OOS n ≥ 30 | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const [k, t] of Object.entries(out.tests)) { const c = t.checks;
    L.push(`| ${k} | ${yn(c.oosPos)} | ${yn(c.t2)} | ${yn(c.holm)} (${t.holmP}) | ${yn(c.isPos)} | ${yn(c.x2)} | ${c.placebo == null ? 'n/a' : yn(c.placebo)} | ${yn(c.n30)} | ${yn(t.pass)} |`); }
  L.push('', '## Placebo (out of sample, 40 seeds)', '');
  L.push('Each OOS trade is replaced by the control trade of a random eligible day of the same year (same side, stop in ATR, hold, target rule, costs). T2 has no placebo of its own (its control is the every-day mean).', '');
  L.push('| Test | Real net R a trade | Seeds beaten | Placebo median | Placebo 95th pct | Placebo min / max |'); L.push('|---|---|---|---|---|---|');
  for (const [k, t] of Object.entries(out.tests)) if (t.placebo) { const p = t.placebo;
    L.push(`| ${k} | ${fmt(t.oos.value)} | ${p.beaten} of 40 | ${fmt(p.median)} | ${fmt(p.p95)} | ${fmt(p.min)} / ${fmt(p.max)} |`); }
  L.push('', '## Setups (reported)', '');
  L.push(`Inside days ${out.funnel.inside}; one-side false breaks ${out.funnel.setups} (buy ${out.funnel.buySetups}, sell ${out.funnel.sellSetups}); filled ${out.funnel.filled}; traded one at a time (T1) ${out.funnel.traded}.`, '');
  L.push('## Reading', '');
  for (const s of out.reading) L.push(s);
  L.push('');
  return L.join('\n');
}

function main(dir) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = build(h1), byYear = yearDays(ds);
  const pre = fs.readFileSync(path.join(here, 'PREREGISTRATION.md'));
  const out = { built: '2026-11-14', prereg: crypto.createHash('sha256').update(pre).digest('hex'),
    data: { src: 'OANDA mid H1 XAU_USD via the site proxy (fetch.mjs), 17:00 New York days (gold-drd-long days())', from: ymd(ds[0].t), to: ymd(ds.at(-1).t), days: ds.length, h1: h1.length },
    rule: { buffer: B, waitDays: WAIT, holdDays: HOLD, target: RR, atr: ATR_N },
    costs: { roundTrip: COST, financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'buys only' } }, windows: WIN, tests: {} };
  const S = setups(ds), filled = S.map((s) => entryOf(h1, ds, s)).filter(Boolean);
  let inside = 0; for (let i = 1; i < ds.length; i++) if (ds[i].high < ds[i - 1].high && ds[i].low > ds[i - 1].low) inside++;
  const ps = [];
  for (const [k, test] of Object.entries(TESTS)) {
    const all = runTest(h1, ds, test.target); addExcess(h1, ds, all, test.target, byYear);
    const key = test.excess ? 'exc' : 'net', key2 = test.excess ? 'exc2' : 'net2';
    const oos = inWin(all, WIN.oos), is = inWin(all, WIN.is), so = summary(oos, WIN.oos, key, key2), si = summary(is, WIN.is, key, key2);
    let pl = null;
    if (!test.excess) { const m = placebo(h1, ds, oos, test.target, 40, byYear), z = [...m].sort((a, b) => a - b);
      pl = { beaten: m.filter((v) => so.value > v).length, median: r3((z[19] + z[20]) / 2), p95: r3(z[37]), min: r3(z[0]), max: r3(z[39]), means: m.map(r3) }; }
    const p = 1 - phi(so.t || 0); ps.push(p);
    out.tests[k] = { name: test.name, measure: test.excess ? 'excess R' : 'net R', is: si, oos: so, p: +p.toFixed(4), placebo: pl,
      ctlIs: test.excess ? r3(avg(is.filter((x) => x.ctl != null).map((x) => x.ctl))) : undefined,
      ctlOos: test.excess ? r3(avg(oos.filter((x) => x.ctl != null).map((x) => x.ctl))) : undefined,
      trades: oos.map((x) => [ymd(x.entryT), x.side, r3(x.net), r3(x.exc)]) };
    if (k === 'T1') out.funnel = { inside, setups: S.length, buySetups: S.filter((s) => s.side > 0).length, sellSetups: S.filter((s) => s.side < 0).length, filled: filled.length, traded: all.length };
  }
  const adj = holm(ps);
  Object.values(out.tests).forEach((t, n) => { t.holmP = +adj[n].toFixed(4);
    t.checks = { oosPos: t.oos.value > 0, t2: t.oos.t >= 2, holm: adj[n] <= 0.05, isPos: t.is.value > 0, x2: t.oos.at2x > 0,
      placebo: t.placebo ? t.placebo.beaten >= 38 : null, n30: t.oos.n >= 30 };
    t.pass = Object.values(t.checks).every((v) => v !== false); });
  const T1 = out.tests.T1, T2 = out.tests.T2, T3 = out.tests.T3, pass = T1.pass && T2.pass;
  const nPass = [T1, T2, T3].filter((t) => t.pass).length;
  out.pass = pass; out.passCount = nPass;
  out.verdict = `${pass ? 'PASS' : 'FAIL'}, ${nPass} of 3: the gold hikkake made ${fmt(T1.oos.value)}R a trade net out of sample (n ${T1.oos.n}, month t ${fmt(T1.oos.t, 2)}), ${fmt(T2.oos.value)}R over the every-day same-side trade (t ${fmt(T2.oos.t, 2)}); in sample ${fmt(T1.is.value)}R.`;
  out.reading = [
    `- T1: in sample ${fmt(T1.is.value)}R a trade net (n ${T1.is.n}, t ${fmt(T1.is.t, 2)}), out of sample ${fmt(T1.oos.value)}R (n ${T1.oos.n}, t ${fmt(T1.oos.t, 2)}), ${fmt(T1.oos.at2x)}R at twice the costs; costs ${fmt(T1.oos.cost)}R and financing ${fmt(T1.oos.fin)}R a trade out of sample.`,
    `- T2 (the signal against gold's own drift): the trade minus the same-side trade on every day of its year, ${fmt(T2.is.value)}R in sample (t ${fmt(T2.is.t, 2)}), ${fmt(T2.oos.value)}R out of sample (t ${fmt(T2.oos.t, 2)}).`,
    `- T3 (2R target): ${fmt(T3.is.value)}R in sample, ${fmt(T3.oos.value)}R out of sample (t ${fmt(T3.oos.t, 2)}).`,
    `- Fewer trades than the pre-registration expected (${T1.is.n} in sample, ${T1.oos.n} out of sample against 120-180): ${out.funnel.filled} of ${out.funnel.setups} setups filled, most were cancelled by a trade through the false-break extreme or never reached the order. The OOS t has little power at this n; the sign, not the size, decides.`,
    pass ? '- Passes the pre-registered bar: a lead to replicate on other markets or years before it is called more; nothing live changes.'
      : '- Not an edge: nothing is proposed and nothing live changes. Do not re-fit the waiting days, buffer, hold or target on these results.',
  ];
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(out));
  console.log(out.verdict);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main(process.argv[2]);
