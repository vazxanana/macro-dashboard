// Published time-series momentum on gold, out of sample (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-tsmom/run.mjs fetch <dir>   copies council-data research/daily/xau.json to <dir> (git show, no network)
//   node research/edge/gold-tsmom/run.mjs full <dir>    runs the study and writes result.json
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { nights, FIN } from '../../../council/fills.mjs';

export const P = { lookback: 12, target: 0.10, cap: 3, com: 60, minRet: 60, atrN: 20, stopAtr: 3, cost: 0.30, ann: 261 };
const D = 86400;
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);

// weekday candles only, oldest first
export function weekdays(rows) {
  return rows.map(([t, o, h, l, c]) => ({ t, o, h, l, c })).filter((b) => { const w = new Date(b.t * 1000).getUTCDay(); return w >= 1 && w <= 5; })
    .sort((a, b) => a.t - b.t);
}
// index of the last candle of each calendar month (the last month is dropped when no candle of the next month exists yet)
export function monthEnds(bars) {
  const out = [];
  for (let i = 0; i < bars.length - 1; i++) if (ym(bars[i].t) !== ym(bars[i + 1].t)) out.push(i);
  return out;
}
// EWMA annualised volatility of daily log returns up to and including candle i (centre of mass com); null with too few returns
export function ewmaVol(bars, i, p = P) {
  if (i < p.minRet) return null;
  const lam = p.com / (p.com + 1);
  let v = null;
  for (let k = 1; k <= i; k++) {
    const r = Math.log(bars[k].c / bars[k - 1].c);
    v = v == null ? r * r : lam * v + (1 - lam) * r * r;
  }
  return Math.sqrt(v * p.ann);
}
// simple ATR(n) of the candles up to and including i
export function atr(bars, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += Math.max(bars[k].h - bars[k].l, Math.abs(bars[k].h - bars[k - 1].c), Math.abs(bars[k].l - bars[k - 1].c));
  return s / n;
}
export const weight = (vol, p = P) => (vol > 0 ? Math.min(p.cap, p.target / vol) : 0);
// direction from the lookback return: variant 'ls' long / short, 'lf' long / flat, 'bh' always long
export function direction(ret, variant) {
  if (variant === 'bh') return 1;
  if (!(Number.isFinite(ret)) || ret === 0) return 0;
  return ret > 0 ? 1 : variant === 'ls' ? -1 : 0;
}

// One holding month. bars[a] = the month-end candle (signal), entry at bars[a+1].o, exit at bars[b+1].o (b = next month end).
// Returns { ret, gross, dir, w, stopped, ... } as a fraction of capital.
export function holdMonth(bars, a, b, dir, w, { stop = true, costs = true, p = P } = {}) {
  const entry = bars[a + 1].o, t0 = bars[a + 1].t, exitBar = bars[b + 1];
  if (!dir || !w) return { dir: 0, w: 0, ret: 0, gross: 0, stopped: false, entry, exit: entry, t0, t1: exitBar.t, nights: 0, fin: 0, cost: 0 };
  const A = atr(bars, a, p.atrN), sl = dir > 0 ? entry - p.stopAtr * A : entry + p.stopAtr * A;
  let exit = exitBar.o, t1 = exitBar.t, stopped = false;
  if (stop) {
    for (let k = a + 1; k <= b; k++) {
      const x = bars[k];
      if (dir > 0 && x.l <= sl) { exit = Math.min(x.o, sl); t1 = x.t; stopped = true; break; }
      if (dir < 0 && x.h >= sl) { exit = Math.max(x.o, sl); t1 = x.t; stopped = true; break; }
    }
    if (!stopped && (dir > 0 ? exitBar.o <= sl : exitBar.o >= sl)) { /* gap through at the exit open: the exit open is the fill */ }
  }
  const gross = w * dir * (exit - entry) / entry;
  // a stop inside a day: the candle time + 12 h stands for the fill time (financing counts only 22:00 UTC rollovers)
  const tExit = stopped ? t1 + (exit === sl ? 12 * 3600 : 0) : t1;
  const nn = dir > 0 ? nights(t0, tExit) : 0, fin = costs ? nn * (dir > 0 ? FIN.xau.long : FIN.xau.short) * w : 0;
  const cost = costs ? w * p.cost / entry : 0;
  return { dir, w, entry, exit, sl, t0, t1: tExit, stopped, nights: nn, gross, fin, cost, ret: gross - fin - cost };
}

// every holding month from the first month end that has `look` months behind it and enough returns for the volatility
export function run(bars, { variant = 'ls', look = P.lookback, stop = true, costs = true, p = P } = {}) {
  const me = monthEnds(bars), out = [];
  for (let m = 0; m + 1 < me.length; m++) {
    const a = me[m], b = me[m + 1];
    let ret = null;
    if (variant !== 'bh') { if (m < look) continue; ret = bars[a].c / bars[me[m - look]].c - 1; }
    const vol = ewmaVol(bars, a, p); if (vol == null) continue;
    const dir = direction(ret, variant), w = variant === 'bh' ? 1 : weight(vol, p);
    const h = holdMonth(bars, a, b, dir, w, { stop: variant === 'bh' ? false : stop, costs, p });
    out.push({ month: ym(bars[a + 1].t), signal: ret == null ? null : +ret.toFixed(5), vol: +vol.toFixed(4), ...h });
  }
  return out;
}

// monthly statistics: n, mean, sd, Sharpe (x sqrt 12), t, one-sided p, sum, worst drawdown of the running sum, sum / |drawdown|
const phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
export function stats(rs) {
  const n = rs.length; if (!n) return { n: 0 };
  const mean = rs.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(rs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
  let eq = 0, pk = 0, dd = 0; for (const x of rs) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { n, meanPct: +(mean * 100).toFixed(3), sharpe: +(sd > 0 ? mean / sd * Math.sqrt(12) : 0).toFixed(2), t: +t.toFixed(2),
    p: +(1 - phi(t)).toFixed(4), sumPct: +(eq * 100).toFixed(1), annPct: +(mean * 1200).toFixed(2), ddPct: +(dd * 100).toFixed(1),
    retPerDd: dd < 0 ? +(eq / -dd).toFixed(2) : null };
}
// Holm: adjusted p for each test (step-down, monotone)
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let mx = 0;
  idx.forEach(([p, i], k) => { mx = Math.max(mx, Math.min(1, p * (ps.length - k))); adj[i] = +mx.toFixed(4); });
  return adj;
}

export const WIN = { conf: ['2007-04', '2017-12'], late: ['2018-01', '2026-10'] };
const inWin = (rows, [f, t]) => rows.filter((r) => r.month >= f && r.month <= t);
const S = (rows) => stats(rows.map((r) => r.ret));

export function study(bars) {
  const V = { ls: run(bars, { variant: 'ls' }), lf: run(bars, { variant: 'lf' }) };
  const BH = run(bars, { variant: 'bh', costs: false }), BHfin = run(bars, { variant: 'bh', costs: true });
  const out = { built: '2026-11-13', data: { from: new Date(bars[0].t * 1000).toISOString().slice(0, 10), to: new Date(bars.at(-1).t * 1000).toISOString().slice(0, 10), days: bars.length,
    src: 'OANDA mid XAU_USD daily, council-data research/daily/xau.json, weekend stubs dropped' }, params: P, fin: { long: FIN.xau.long, short: FIN.xau.short, asOf: FIN.xau.asOf },
    windows: WIN, variants: {}, buyHold: {}, lookbacks: {}, years: {} };
  for (const [w, rg] of Object.entries(WIN)) out.buyHold[w] = { gross: S(inWin(BH, rg)), afterFinancing: S(inWin(BHfin, rg)) };
  for (const [k, rows] of Object.entries(V)) {
    const o = out.variants[k] = {};
    for (const [w, rg] of Object.entries(WIN)) {
      const r = inWin(rows, rg);
      o[w] = { ...S(r), long: r.filter((x) => x.dir > 0).length, short: r.filter((x) => x.dir < 0).length, flat: r.filter((x) => !x.dir).length,
        stops: r.filter((x) => x.stopped).length, avgW: +(r.filter((x) => x.dir).reduce((s, x) => s + x.w, 0) / Math.max(1, r.filter((x) => x.dir).length)).toFixed(2),
        finPct: +(r.reduce((s, x) => s + x.fin, 0) * 100).toFixed(1), costPct: +(r.reduce((s, x) => s + x.cost, 0) * 100).toFixed(2) };
    }
    o.noStop = Object.fromEntries(Object.entries(WIN).map(([w, rg]) => [w, S(inWin(run(bars, { variant: k, stop: false }), rg))]));
    o.gross = Object.fromEntries(Object.entries(WIN).map(([w, rg]) => [w, S(inWin(run(bars, { variant: k, costs: false }), rg))]));
    for (const look of [1, 3, 6]) (out.lookbacks[k] ||= {})[look] = Object.fromEntries(Object.entries(WIN).map(([w, rg]) => [w, S(inWin(run(bars, { variant: k, look }), rg))]));
    for (let y = 2007; y <= 2026; y++) { const r = rows.filter((x) => x.month.startsWith(String(y))); if (r.length) (out.years[y] ||= {})[k] = +(r.reduce((s, x) => s + x.ret, 0) * 100).toFixed(1); }
  }
  for (let y = 2007; y <= 2026; y++) { const r = BH.filter((x) => x.month.startsWith(String(y))); if (r.length && out.years[y]) out.years[y].bh = +(r.reduce((s, x) => s + x.ret, 0) * 100).toFixed(1); }
  const adj = holm([out.variants.ls.conf.p, out.variants.lf.conf.p]), bh = out.buyHold.conf.gross.retPerDd;
  out.checks = {};
  ['ls', 'lf'].forEach((k, i) => {
    const c = out.variants[k].conf, l = out.variants[k].late;
    out.checks[k] = { sharpe: c.sharpe > 0.3, t: c.t >= 2, holm: adj[i] < 0.05, holmP: adj[i], beatsBuyHold: c.retPerDd != null && c.retPerDd > bh, late: l.sumPct > 0 };
    out.checks[k].pass = ['sharpe', 't', 'holm', 'beatsBuyHold', 'late'].every((x) => out.checks[k][x]);
  });
  out.verdict = out.checks.ls.pass || out.checks.lf.pass ? 'PASS' : 'FAIL';
  out.monthly = Object.fromEntries(Object.entries(V).map(([k, rows]) => [k, rows.map((r) => [r.month, r.dir, +r.w.toFixed(3), +(r.ret * 100).toFixed(3), r.stopped ? 1 : 0])]));
  return out;
}

function fetchData(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const txt = execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64 << 20 }).toString();
  fs.writeFileSync(path.join(dir, 'xau.json'), txt);
  console.log('saved', path.join(dir, 'xau.json'), JSON.parse(txt).rows.length, 'rows');
}
function full(dir) {
  const bars = weekdays(JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8')).rows);
  const out = study(bars);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  const { monthly, ...show } = out; console.log(JSON.stringify(show, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') fetchData(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
