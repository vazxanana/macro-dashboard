// Diversified time-series momentum on the council's OANDA daily CFD candles (PREREGISTRATION.md, 17 Nov 2026).
//   node research/edge/tsmom-portfolio/run.mjs fetch <dir>   the 38 daily files + the DGS2 series from origin/council-data (git, no network)
//   node research/edge/tsmom-portfolio/run.mjs run <dir>     writes result.json next to this file and prints the tables
// Pure pieces are exported for tests/tsmom-portfolio.test.mjs. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;

export const CLASSES = {
  metals: ['xau', 'xag', 'xcu', 'xpt', 'xpd'],
  indices: ['au200', 'ch20', 'de40', 'eu50', 'fr40', 'hk33', 'jp225', 'nas100', 'spx500', 'uk100', 'us2000', 'us30', 'sg30'],
  energies: ['bco', 'wtico', 'natgas'],
  bonds: ['usb02y', 'usb05y', 'usb10y', 'usb30y', 'de10yb', 'uk10yb'],
  ags: ['corn', 'wheat', 'soybn', 'sugar'],
  forex: ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdcad', 'usdchf'],
};
export const UNIVERSE = Object.values(CLASSES).flat();
export const classOf = (k) => Object.keys(CLASSES).find((c) => CLASSES[c].includes(k));

// round trip as a fraction of price (PREREGISTRATION.md, Costs)
const RT = {};
for (const k of CLASSES.forex) RT[k] = 0.0006;
for (const k of CLASSES.indices) RT[k] = 0.0006;
for (const k of ['nas100', 'spx500', 'us30', 'us2000']) RT[k] = 0.0003;
Object.assign(RT, { xau: 0.0006, xag: 0.001, xcu: 0.0015, xpt: 0.003, xpd: 0.002, bco: 0.001, wtico: 0.001, natgas: 0.002 });
for (const k of CLASSES.bonds) RT[k] = 0.0008;
for (const k of CLASSES.ags) RT[k] = 0.002;
export const COST_RT = RT;
export const MARKUP = 0.025, MARKUP_FX = 0.01, FIRST_DGS2 = 4.36;

export const SPECS = {
  'P12-1': { near: 2, far: 13 },   // primary: 12 months, skipping the last one
  P3: { near: 1, far: 4 },
  P6: { near: 1, far: 7 },
};
export const P = { volTarget: 0.10, volN: 60, capW: 4, minCloses: 61, freshDays: 10, kTarget: 0.10, kN: 252, kMin: 126, kLo: 0.25, kHi: 8 };
export const WINDOWS = { replication: ['2005-01', '2019-12'], inSample: ['2020-01', '2023-12'], outOfSample: ['2024-01', '2026-10'] };

const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const ymIdx = (s) => +s.slice(0, 4) * 12 + (+s.slice(5, 7) - 1);
const isWeekend = (t) => { const d = new Date(t * 1000).getUTCDay(); return d === 0 || d === 6; };

// one market's candles: weekend-dated rows dropped, nothing else touched
export function series(rows) {
  const t = [], c = [];
  for (const r of rows) if (!isWeekend(r[0]) && Number.isFinite(r[4]) && r[4] > 0) { t.push(r[0]); c.push(r[4]); }
  return { t, c, mi: t.map((x) => ymIdx(ym(x))) };
}

// last index with t < D (closes strictly before the rebalance day)
export function lastBefore(s, D) {
  let lo = 0, hi = s.t.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (s.t[m] < D) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}

// the market's last close dated in month index x, searching at or below index L
function monthEndClose(s, L, x) {
  for (let j = L; j >= 0; j--) { if (s.mi[j] === x) return s.c[j]; if (s.mi[j] < x) return null; }
  return null;
}

// signal and volatility of one market at rebalance day D of month index m: only closes strictly before D are read
export function marketAt(s, D, m, spec) {
  const L = lastBefore(s, D);
  if (L < 0 || L + 1 < P.minCloses || s.t[L] < D - P.freshDays * DAY) return null;
  const a = monthEndClose(s, L, m - spec.near), b = monthEndClose(s, L, m - spec.far);
  if (a == null || b == null) return null;
  const ret = a / b - 1, sig = ret > 0 ? 1 : ret < 0 ? -1 : 0;
  const lr = [];
  for (let j = L - P.volN + 1; j <= L; j++) lr.push(Math.log(s.c[j] / s.c[j - 1]));
  const mu = lr.reduce((x, y) => x + y, 0) / lr.length;
  const sd = Math.sqrt(lr.reduce((x, y) => x + (y - mu) ** 2, 0) / (lr.length - 1)) * Math.sqrt(252);
  return { sig, ret, vol: sd };
}

export function rateFn(dgs2) {
  const ts = dgs2.map(([d]) => Date.parse(d + 'T00:00:00Z') / 1000), v = dgs2.map(([, x]) => x);
  return (t) => {
    let lo = 0, hi = ts.length - 1, ans = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (ts[m] <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
    return Math.max(0, (ans < 0 ? FIRST_DGS2 : v[ans]) / 100);
  };
}

// the whole portfolio. data: { key: series }, rate: t -> annual rate. opts: spec, costMult, markupMult, fin (bool)
export function simulate(data, rate, opts = {}) {
  const spec = SPECS[opts.spec || 'P12-1'], cm = opts.costMult ?? 1, mm = opts.markupMult ?? 1, finOn = opts.fin !== false;
  const keys = Object.keys(data);
  const allDays = [...new Set(keys.flatMap((k) => data[k].t))].sort((a, b) => a - b);
  const rebs = []; let prevM = null;
  for (const d of allDays) { const s = ym(d); if (s !== prevM) { rebs.push({ D: d, ym: s, m: ymIdx(s) }); prevM = s; } }
  // unscaled weights per rebalance
  for (const r of rebs) {
    const got = {};
    for (const k of keys) { const x = marketAt(data[k], r.D, r.m, spec); if (x) got[k] = x; }
    const N = Object.keys(got).length; r.N = N; r.w = {};
    for (const [k, x] of Object.entries(got)) r.w[k] = x.sig * Math.min(P.volTarget / x.vol, P.capW) / N;
  }
  const rebOf = (t) => { // latest rebalance with D <= t
    let lo = 0, hi = rebs.length - 1, ans = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (rebs[m].D <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans;
  };
  // per market own-return events: [day, q, r, daysHeld]
  const ev = {};
  for (const k of keys) {
    const s = data[k], out = [];
    for (let j = 1; j < s.t.length; j++) { const q = rebOf(s.t[j - 1]); if (q < 0) continue; out.push([s.t[j], q, s.c[j] / s.c[j - 1] - 1, (s.t[j] - s.t[j - 1]) / DAY, s.t[j - 1]]); }
    ev[k] = out;
  }
  // unscaled daily portfolio gross returns by union day, then k per rebalance from the 252 union days before it
  const dayIdx = new Map(allDays.map((d, i) => [d, i])), U = new Float64Array(allDays.length);
  for (const k of keys) for (const [d, q, r] of ev[k]) U[dayIdx.get(d)] += (rebs[q].w[k] || 0) * r;
  for (const r of rebs) {
    const i = dayIdx.get(r.D), from = Math.max(0, i - P.kN), n = i - from;
    if (n < P.kMin) { r.k = 1; continue; }
    let mu = 0; for (let j = from; j < i; j++) mu += U[j]; mu /= n;
    let v = 0; for (let j = from; j < i; j++) v += (U[j] - mu) ** 2;
    const sp = Math.sqrt(v / (n - 1)) * Math.sqrt(252);
    r.k = sp > 0 ? Math.min(P.kHi, Math.max(P.kLo, P.kTarget / sp)) : 1;
  }
  // months
  const months = rebs.map((r) => ({ ym: r.ym, N: r.N, k: r.k, gross: 0, cost: 0, fin: 0, lev: 0, cls: {} }));
  const cls = (mo, c) => (mo.cls[c] ||= { gross: 0, cost: 0, fin: 0 });
  for (let q = 0; q < rebs.length; q++) {
    const mo = months[q];
    for (const k of keys) {
      const now = (rebs[q].w[k] || 0) * rebs[q].k, was = q ? (rebs[q - 1].w[k] || 0) * rebs[q - 1].k : 0;
      const c = Math.abs(now - was) * COST_RT[k] / 2 * cm;
      mo.cost += c; cls(mo, classOf(k)).cost += c; mo.lev += Math.abs(now);
    }
  }
  for (const k of keys) {
    const fx = classOf(k) === 'forex';
    for (const [, q, r, days, t0] of ev[k]) {
      const pos = (rebs[q].w[k] || 0) * rebs[q].k; if (!pos) continue;
      const mo = months[q], g = pos * r; mo.gross += g; cls(mo, classOf(k)).gross += g;
      if (!finOn) continue;
      const rr = rate(t0), ann = fx ? MARKUP_FX * mm : pos > 0 ? rr + MARKUP * mm : MARKUP * mm - rr;
      const f = Math.abs(pos) * ann * days / 365; mo.fin += f; cls(mo, classOf(k)).fin += f;
    }
  }
  for (const mo of months) { mo.net = mo.gross - mo.cost - mo.fin; for (const c of Object.values(mo.cls)) c.net = c.gross - c.cost - c.fin; }
  return { months, rebs };
}

// ── statistics ──
function lgamma(x) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export const pOneSided = (t, df) => { const x = df / (df + t * t), tail = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? tail : 1 - tail; };

const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : null;
  let cum = 0, peak = 0, dd = 0; for (const x of xs) { cum += x; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  // Newey-West, lag 3, Bartlett
  let lr = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  for (let L = 1; L <= 3; L++) { let g = 0; for (let i = L; i < n; i++) g += (xs[i] - mean) * (xs[i - L] - mean); lr += 2 * (1 - L / 4) * g / n; }
  const tNW = lr > 0 ? mean / Math.sqrt(lr / n) : null;
  return { n, meanPct: r4(mean * 100), sdPct: r4(sd * 100), t: r4(t), tNW: r4(tNW), sharpe: r4(sd > 0 ? mean / sd * Math.sqrt(12) : null), totalPct: r4(cum * 100), maxDDPct: r4(dd * 100), pctPositive: r4(xs.filter((x) => x > 0).length / n), p: t == null ? null : r4(pOneSided(t, n - 1)) };
}
const inW = (s, [a, b]) => s >= a && s <= b;
export function windowStats(months, field = 'net') {
  const o = {};
  for (const [w, r] of Object.entries(WINDOWS)) o[w] = stats(months.filter((m) => inW(m.ym, r)).map((m) => m[field]));
  return o;
}

// the verdict rule, exactly as pre-registered
export function verdictOf(base, x2) {
  const o = base.outOfSample, checks = {
    oosPositive: o.meanPct > 0, oosT2: o.t != null && o.t >= 2, isPositive: base.inSample.meanPct > 0,
    replicationPositive: base.replication.meanPct > 0, oosPositiveAt2xCosts: x2.outOfSample.meanPct > 0,
  };
  return { verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checks };
}

export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, adj = new Array(m); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); adj[i] = run; });
  return adj;
}

// ── IO ──
function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ref = execFileSync('git', ['rev-parse', 'origin/council-data'], { encoding: 'utf8' }).trim();
  for (const k of UNIVERSE) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  const cache = JSON.parse(execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28, encoding: 'utf8' }));
  fs.writeFileSync(path.join(dir, 'dgs2.json'), JSON.stringify(cache.score.fred.DGS2));
  fs.writeFileSync(path.join(dir, 'ref.txt'), ref);
  console.log('fetched', UNIVERSE.length, 'markets + DGS2 from council-data', ref);
}

export function load(dir) {
  const data = {}, raw = {};
  for (const k of UNIVERSE) { const j = JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8')); raw[k] = j; data[k] = series(j.rows); }
  return { data, raw, dgs2: JSON.parse(fs.readFileSync(path.join(dir, 'dgs2.json'), 'utf8')), ref: fs.existsSync(path.join(dir, 'ref.txt')) ? fs.readFileSync(path.join(dir, 'ref.txt'), 'utf8').trim() : null };
}

export function build(dir) {
  const { data, dgs2, ref } = load(dir), rate = rateFn(dgs2);
  const runs = {};
  for (const sp of Object.keys(SPECS)) runs[sp] = simulate(data, rate, { spec: sp });
  const prim = runs['P12-1'].months;
  const x2 = simulate(data, rate, { costMult: 2, markupMult: 2 }).months, nofin = simulate(data, rate, { fin: false }).months;
  const base = windowStats(prim), base2 = windowStats(x2);
  const v = verdictOf(base, base2);
  const specs = {};
  for (const [sp, r] of Object.entries(runs)) specs[sp] = { net: windowStats(r.months), gross: windowStats(r.months, 'gross') };
  const names = Object.keys(SPECS), adj = holm(names.map((s) => specs[s].net.outOfSample.p ?? 1));
  names.forEach((s, i) => { specs[s].holmOOS = r4(adj[i]); });
  const byClass = {};
  for (const c of Object.keys(CLASSES)) {
    byClass[c] = {};
    for (const [w, rg] of Object.entries(WINDOWS)) {
      const ms = prim.filter((m) => inW(m.ym, rg));
      byClass[c][w] = { net: stats(ms.map((m) => m.cls[c]?.net || 0)), grossPct: r4(ms.reduce((a, m) => a + (m.cls[c]?.gross || 0), 0) * 100), costPct: r4(ms.reduce((a, m) => a + (m.cls[c]?.cost || 0), 0) * 100), finPct: r4(ms.reduce((a, m) => a + (m.cls[c]?.fin || 0), 0) * 100) };
    }
  }
  const shares = {};
  for (const [w, rg] of Object.entries(WINDOWS)) {
    const ms = prim.filter((m) => inW(m.ym, rg)), sum = (f) => ms.reduce((a, m) => a + m[f], 0);
    shares[w] = { grossPct: r4(sum('gross') * 100), costPct: r4(sum('cost') * 100), finPct: r4(sum('fin') * 100), netPct: r4(sum('net') * 100),
      costShareOfGross: sum('gross') > 0 ? r4(sum('cost') / sum('gross')) : null, finShareOfGross: sum('gross') > 0 ? r4(sum('fin') / sum('gross')) : null,
      avgGrossLeverage: r4(sum('lev') / ms.length), avgN: r4(ms.reduce((a, m) => a + m.N, 0) / ms.length), avgK: r4(ms.reduce((a, m) => a + m.k, 0) / ms.length) };
  }
  const bigMoves = {};
  for (const k of UNIVERSE) {
    const s = data[k], m = [];
    for (let j = 1; j < s.t.length; j++) m.push([new Date(s.t[j] * 1000).toISOString().slice(0, 10), r4((s.c[j] / s.c[j - 1] - 1) * 100)]);
    bigMoves[k] = m.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 10);
  }
  const firstEligible = {};
  for (const k of UNIVERSE) { const q = runs['P12-1'].rebs.find((r) => r.w[k] != null); firstEligible[k] = q ? q.ym : null; }
  return {
    study: 'tsmom-portfolio', title: 'Diversified time-series momentum, a 38-market CFD portfolio', built: '2026-11-17', councilData: ref,
    verdict: v.verdict, checks: v.checks,
    system: 'A portfolio of 38 OANDA CFDs (metals, indices, energies, bonds, ags, forex majors), long or short each month on the sign of its own 12-month return skipping the last month, each at 10 % volatility, equal risk, scaled to 10 % portfolio volatility; net of spread and CFD overnight financing',
    headline: `${v.verdict}: out of sample (2024-01 to 2026-10) ${base.outOfSample.meanPct}% a month net, t ${base.outOfSample.t}, Sharpe ${base.outOfSample.sharpe}; in sample ${base.inSample.meanPct}% (t ${base.inSample.t}); replication 2005-19 ${base.replication.meanPct}% (t ${base.replication.t})`,
    primary: { spec: 'P12-1', net: base, gross: windowStats(prim, 'gross'), at2xCosts: base2, noFinancing: windowStats(nofin) },
    specs, byClass, shares, firstEligible,
    postHoc: { noMarkup: { note: 'Post hoc, not pre-registered: financing at the rate alone (longs pay r, shorts receive r, forex nothing), i.e. close to a futures excess return with no broker markup', net: windowStats(simulate(data, rate, { markupMult: 0 }).months) } },
    assumptions: {
      costRoundTrip: COST_RT, financing: { markup: MARKUP, markupForex: MARKUP_FX, rate: 'FRED DGS2 weekly (council-data macro/cache.json score.fred), as of, floored at 0; 4.36 % before 6 Jan 2006; same US rate for every currency', forex: 'markup only, interest differential not charged or credited' },
      params: P, windows: WINDOWS,
    },
    bigMoves,
    months: prim.map((m) => ({ ym: m.ym, N: m.N, k: r4(m.k), grossPct: r4(m.gross * 100), costPct: r4(m.cost * 100), finPct: r4(m.fin * 100), netPct: r4(m.net * 100) })),
  };
}

const [cmd, dir] = process.argv.slice(2);
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (cmd === 'fetch' && dir) fetchAll(dir);
  else if (cmd === 'run' && dir) {
    const res = build(dir);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    const row = (n, s) => console.log(n.padEnd(22), ['replication', 'inSample', 'outOfSample'].map((w) => `${w} n ${s[w].n} mean ${s[w].meanPct}% t ${s[w].t} SR ${s[w].sharpe} DD ${s[w].maxDDPct}%`).join(' | '));
    console.log('verdict', res.verdict, JSON.stringify(res.checks));
    row('net', res.primary.net); row('gross', res.primary.gross); row('2x costs', res.primary.at2xCosts); row('no financing', res.primary.noFinancing);
    for (const [s, v] of Object.entries(res.specs)) { row(s + ' net', v.net); console.log('   holm OOS', v.holmOOS); }
    for (const [c, v] of Object.entries(res.byClass)) console.log(c.padEnd(9), Object.entries(v).map(([w, x]) => `${w} ${x.net.meanPct}% t ${x.net.t} (g ${x.grossPct} c ${x.costPct} f ${x.finPct})`).join(' | '));
    console.log(JSON.stringify(res.shares));
    console.log(JSON.stringify(res.firstEligible));
  } else console.log('usage: run.mjs fetch <dir> | run <dir>');
}
