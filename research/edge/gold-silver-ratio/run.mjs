// Mean reversion of the gold / silver ratio (PREREGISTRATION.md, committed first).
//   node research/edge/gold-silver-ratio/run.mjs           reads origin/council-data research/daily/{xau,xag}.json (git show,
//                                                          no network) and writes result.json
// Pure pieces are exported for tests/gold-silver-ratio.test.mjs.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

export const P = { win: 250, vol: 60, zIn: 2, zStop: 3.5, hold: 60, costXau: 0.35, costXag: 0.03, finXau: FIN.xau.long, finXag: FIN.xau.long };
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// weekday candles present in both files: { t, go, gc, so, sc }
export function align(xau, xag) {
  const wk = (t) => { const w = new Date(t * 1000).getUTCDay(); return w >= 1 && w <= 5; };
  const s = new Map(xag.filter((r) => wk(r[0])).map((r) => [r[0], r]));
  const out = [];
  for (const g of xau) { if (!wk(g[0])) continue; const x = s.get(g[0]); if (!x) continue;
    out.push({ t: g[0], go: g[1], gc: g[4], so: x[1], sc: x[4] }); }
  return out.sort((a, b) => a.t - b.t);
}

const msd = (a) => { const n = a.length, m = a.reduce((p, q) => p + q, 0) / n; return [m, Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / (n - 1))]; };

// z at each close from the `win` log ratios BEFORE it (today not in its own window); null while fewer exist
export function zScores(days, win = P.win) {
  const L = days.map((d) => Math.log(d.gc / d.sc)), mean = [], sd = [], z = [];
  for (let i = 0; i < L.length; i++) {
    if (i < win) { mean.push(null); sd.push(null); z.push(null); continue; }
    const [m, s] = msd(L.slice(i - win, i)); mean.push(m); sd.push(s); z.push(s > 0 ? (L[i] - m) / s : null);
  }
  return { L, mean, sd, z };
}

// sd of the `n` daily log returns ending at close i (closes i-n .. i)
export function vol(closes, i, n = P.vol) {
  if (i < n) return null; const r = [];
  for (let k = i - n + 1; k <= i; k++) r.push(Math.log(closes[k] / closes[k - 1]));
  return msd(r)[1];
}

// net return of one trade in fraction of gross notional; side = +1 ratio long (buy gold / sell silver), -1 ratio short
export function cost(tr, p = P) {
  const g = tr.side, s = -tr.side, gross = tr.wg * g * (tr.gx / tr.ge - 1) + tr.ws * s * (tr.sx / tr.se - 1);
  const spread = tr.wg * p.costXau / tr.ge + tr.ws * p.costXag / tr.se;
  const n = nights(tr.tIn, tr.tOut), fin = n * ((g > 0 ? tr.wg * p.finXau : 0) + (s > 0 ? tr.ws * p.finXag : 0));
  return { gross, spread, fin, nights: n, net: gross - spread - fin };
}

function leg(days, i, k, side, p) {
  const sg = vol(days.map((d) => d.gc), i, p.vol), ss = vol(days.map((d) => d.sc), i, p.vol);
  if (!(sg > 0 && ss > 0)) return null;
  const e = days[i + 1], x = days[k];
  return { side, wg: ss / (sg + ss), ws: sg / (sg + ss), ge: e.go, se: e.so, gx: x.go, sx: x.so, tIn: e.t, tOut: x.t };
}

// the rule: signal at close i, enter at open i+1; exits checked at closes, executed at the next open
export function simulate(days, p = P, zs = zScores(days, p.win)) {
  const { L, mean, sd, z } = zs, out = []; let armed = true;
  for (let i = 0; i < days.length - 1; i++) {
    if (z[i] == null) continue;
    if (!armed) { if (Math.abs(z[i]) < p.zIn) armed = true; continue; }
    if (Math.abs(z[i]) < p.zIn) continue;
    const side = z[i] >= p.zIn ? -1 : 1, Lstop = mean[i] - side * p.zStop * sd[i];
    let k = null, how = null;
    for (let c = i + 1; c < days.length; c++) {
      if (side < 0 ? L[c] >= Lstop : L[c] <= Lstop) how = 'stop';
      else if (z[c] != null && (side < 0 ? z[c] <= 0 : z[c] >= 0)) how = 'target';
      else if (c - i >= p.hold) how = 'time';
      if (how) { k = c; break; }
    }
    if (k == null || k + 1 >= days.length) break; // open at the data's end: dropped
    const tr = leg(days, i, k + 1, side, p);
    if (tr) { Object.assign(tr, { sig: days[i].t, z: z[i], how, hold: k + 1 - (i + 1) }, cost(tr, p)); out.push(tr); }
    i = k; armed = false; // next loop step is close k+1; re-arm needs |z| < 2 first
  }
  return out;
}

export function tStat(v) { const n = v.length; if (n < 2) return null; const [m, s] = msd(v); return s > 0 ? m / (s / Math.sqrt(n)) : null; }
export function monthlyT(T) { const m = new Map(); for (const x of T) { const k = ymd(x.tIn).slice(0, 7); m.set(k, (m.get(k) || 0) + x.net); } return { months: m.size, t: tStat([...m.values()]) }; }
function maxDD(T) { let c = 0, hi = 0, dd = 0; for (const x of T) { c += x.net; hi = Math.max(hi, c); dd = Math.min(dd, c - hi); } return dd; }
const r4 = (x) => x == null ? null : +x.toFixed(4), r2 = (x) => x == null ? null : +x.toFixed(2);
export function summary(T) {
  const net = T.map((x) => x.net), n = T.length, mean = n ? net.reduce((p, q) => p + q, 0) / n : null, mt = monthlyT(T), tt = tStat(net);
  const how = {}; for (const x of T) how[x.how] = (how[x.how] || 0) + 1;
  const strict = tt == null || mt.t == null ? null : Math.min(tt, mt.t);
  return { n, meanNetPct: r4(mean * 100), meanGrossPct: n ? r4(T.reduce((p, q) => p + q.gross, 0) / n * 100) : null,
    costPct: n ? r4(T.reduce((p, q) => p + q.spread + q.fin, 0) / n * 100) : null, totalNetPct: r2(net.reduce((p, q) => p + q, 0) * 100),
    tTrade: r2(tt), tMonthly: r2(mt.t), months: mt.months, tStrict: r2(strict), win: n ? r4(T.filter((x) => x.net > 0).length / n) : null,
    holdDays: n ? r2(T.reduce((p, q) => p + q.hold, 0) / n) : null, how, worstDDPct: r2(maxDD(T) * 100),
    short: T.filter((x) => x.side < 0).length, long: T.filter((x) => x.side > 0).length };
}

// seeded uniform (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// placebo: same side and holding length, entry open on a random day of the window where it fits; weights from the day before
export function placebo(days, real, lo, hi, seeds = 40, p = P) {
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const u = rng(s), nets = [];
    for (const tr of real) {
      const cand = []; for (let j = Math.max(lo, p.vol + 1); j <= hi; j++) if (j + tr.hold < days.length) cand.push(j);
      if (!cand.length) continue;
      const j = cand[Math.floor(u() * cand.length)], x = leg(days, j - 1, j + tr.hold, tr.side, p);
      if (x) nets.push(cost(x, p).net);
    }
    out.push(nets.reduce((a, b) => a + b, 0) / nets.length);
  }
  return out;
}

export function load() {
  const read = (k) => JSON.parse(execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  return { xau: read('xau'), xag: read('xag') };
}

export function run({ xau, xag }) {
  const days = align(xau.rows, xag.rows), T = simulate(days);
  const A = T.filter((x) => ymd(x.tIn) <= '2017-12-31'), B = T.filter((x) => ymd(x.tIn) >= '2018-01-01');
  const lo = days.findIndex((d) => ymd(d.t) >= '2006-01-01'), hi = days.findLastIndex((d) => ymd(d.t) <= '2017-12-31');
  const pl = placebo(days, A, lo, hi), sa = summary(A), sb = summary(B), real = sa.meanNetPct / 100;
  const beaten = pl.filter((m) => real > m).length, sorted = [...pl].sort((a, b) => a - b);
  const pass = { confirm: sa.meanNetPct > 0 && sa.tStrict != null && sa.tStrict >= 2, later: sb.meanNetPct > 0, placebo: beaten >= 38 };
  const years = {}; for (const x of T) { const y = ymd(x.tIn).slice(0, 4); (years[y] ||= { n: 0, netPct: 0 }); years[y].n++; years[y].netPct += x.net * 100; }
  for (const y of Object.values(years)) y.netPct = r2(y.netPct);
  return {
    built: '2026-11-13', verdict: pass.confirm && pass.later && pass.placebo ? 'PASS' : 'FAIL', pass,
    data: { src: 'OANDA mid daily XAU_USD / XAG_USD, council-data research/daily (UTC-aligned days, weekends dropped)', from: ymd(days[0].t), to: ymd(days.at(-1).t), days: days.length, firstZ: ymd(days[P.win].t) },
    params: { ...P, finNote: 'gold long FIN.xau.long (council/fills.mjs); silver long assumed at the same rate; shorts nothing' },
    windows: { '2006-17': sa, '2018-now': sb, all: summary(T) },
    placebo: { seeds: 40, beaten, meanPct: pl.map((m) => r4(m * 100)), p95Pct: r4(sorted[37] * 100), medianPct: r4((sorted[19] + sorted[20]) / 2 * 100) },
    years,
    trades: T.map((x) => ({ sig: ymd(x.sig), in: ymd(x.tIn), out: ymd(x.tOut), side: x.side > 0 ? 'ratio long' : 'ratio short', z: r2(x.z), how: x.how, hold: x.hold, grossPct: r4(x.gross * 100), netPct: r4(x.net * 100) })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = run(load());
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  const { trades, ...rest } = out; console.log(JSON.stringify(rest, null, 1));
}
