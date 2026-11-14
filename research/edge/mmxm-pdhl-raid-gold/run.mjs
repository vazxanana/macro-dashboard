// Edge research · mmxm-pdhl-raid-gold: previous New York day's high / low raided in a kill zone, an M15 structure shift back,
// a limit at the 50 % of the shift's leg, target the nearest unfilled opposite-direction H1 fair value gap beyond the previous
// day's middle (none = no trade), midnight-open filter. Spot gold (OANDA mid), 2018 to now. Rules: PREREGISTRATION.md.
//   node --use-env-proxy run.mjs fetch <dir>     (xau-15m / xau-1h / xag-15m .json.gz, rows [t,o,h,l,c]; keep out of git)
//   node run.mjs full <dir>                      (writes result.json + RESULT.md next to this file)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyParts, dayInfo } from '../../../ict/calendar.mjs';
import { spotClosed } from '../../../council/fills.mjs';

export const P = { buf: 0.30, cost: 0.30, minRR: 1.5, piv: 2, mssMin: 105, look: 240, lastMin: 15 * 60 + 45 };
export const KZ = { ny: [8 * 60, 11 * 60 + 45], london: [2 * 60, 4 * 60 + 45] };
export const START = Date.UTC(2018, 0, 1) / 1000, FIRST_DAY = '2018-01-22', OOS = '2021-01-01';
const T = (b) => b[0], O = (b) => b[1], H = (b) => b[2], L = (b) => b[3], C = (b) => b[4];

// New York day key (17:00 ET to 17:00 ET, named by the date it ends) and minute of a candle start
export const dayKey = (t) => nyParts(t + 7 * 3600).ymd;
export const nyMin = (t) => nyParts(t).min;

// candles (sorted) -> ordered days { key, i0, i1 (exclusive), hi, lo }
export function days(bars) {
  const out = []; let cur = null;
  for (let i = 0; i < bars.length; i++) {
    const k = dayKey(T(bars[i]));
    if (!cur || cur.key !== k) { if (cur) out.push(cur); cur = { key: k, i0: i, i1: i + 1, hi: H(bars[i]), lo: L(bars[i]) }; }
    else { cur.i1 = i + 1; cur.hi = Math.max(cur.hi, H(bars[i])); cur.lo = Math.min(cur.lo, L(bars[i])); }
  }
  if (cur) out.push(cur);
  return out;
}

// step 3: first raid inside the kill zone; s = +1 sell (PDH raided), -1 buy; null when none / both / level used before
export function findRaid(bars, d, prev, kz) {
  let preH = false, preL = false;
  for (let i = d.i0; i < d.i1; i++) {
    const m = nyMin(T(bars[i])), inK = m >= kz[0] && m <= kz[1];
    const up = H(bars[i]) > prev.hi, dn = L(bars[i]) < prev.lo;
    // the kill zone is in the morning: candles of the evening before (17:00-24:00) have minutes > kz too, so require NY morning
    const morning = m < 17 * 60 && nyParts(T(bars[i])).ymd === d.key;
    if (inK && morning) {
      const su = up && !preH, sd = dn && !preL;
      if (su && sd) return null;
      if (su) return { r: i, s: 1 };
      if (sd) return { r: i, s: -1 };
    }
    if (up) preH = true; if (dn) preL = true;
    if (morning && m > kz[1]) return null;
  }
  return null;
}

// step 4: M15 structure shift against the raid; sells look for a close below the latest confirmed swing low with index >= r
export function findMSS(bars, r, s, end) {
  const lim = T(bars[r]) + P.mssMin * 60, k = P.piv;
  const pv = (p) => { // swing low (s=1) / high (s=-1) at p, needs p-k..p+k
    if (p - k < 0 || p + k >= bars.length) return false;
    for (let q = 1; q <= k; q++) {
      if (s === 1 ? !(L(bars[p]) < L(bars[p - q]) && L(bars[p]) < L(bars[p + q])) : !(H(bars[p]) > H(bars[p - q]) && H(bars[p]) > H(bars[p + q]))) return false;
    }
    return true;
  };
  for (let j = r + 1; j < end && T(bars[j]) <= lim; j++) {
    let p = -1;
    for (let q = j - 1 - k; q >= r; q--) if (pv(q)) { p = q; break; }   // confirmed: q + k <= j - 1
    if (p < 0) continue;
    if (s === 1 ? C(bars[j]) < L(bars[p]) : C(bars[j]) > H(bars[p])) return { j, p };
  }
  return null;
}

// step 8: nearest unfilled opposite-direction H1 FVG beyond the previous day's middle, from H1 candles closed by tc
export function findTarget(h1, tc, s, entry, mid) {
  let n = 0; while (n < h1.length && T(h1[n]) + 3600 <= tc) n++;   // h1[0..n) closed by tc
  const a0 = Math.max(0, n - P.look);
  let best = null;
  // running extreme after each gap, for the "unfilled" test: min low (sells' bullish gaps) / max high (buys' bearish gaps)
  const ext = new Array(n + 1); ext[n] = s === 1 ? Infinity : -Infinity;
  for (let i = n - 1; i >= a0; i--) ext[i] = s === 1 ? Math.min(ext[i + 1], L(h1[i])) : Math.max(ext[i + 1], H(h1[i]));
  for (let i = a0; i + 2 < n; i++) {
    const a = h1[i], c = h1[i + 2];
    if (s === 1) {   // bullish gap below: c.low > a.high; top edge c.low <= mid and < entry; unfilled: no later low <= a.high
      if (!(L(c) > H(a))) continue;
      const top = L(c);
      if (top > mid || top >= entry || ext[i + 3] <= H(a)) continue;
      if (best == null || top > best) best = top;
    } else {          // bearish gap above: c.high < a.low; bottom edge c.high >= mid and > entry; unfilled: no later high >= a.low
      if (!(H(c) < L(a))) continue;
      const bot = H(c);
      if (bot < mid || bot <= entry || ext[i + 3] >= L(a)) continue;
      if (best == null || bot < best) best = bot;
    }
  }
  return best;
}

// step 10: manage a limit order from candle j0 (first candle after the order is placed) to the day's last candle (<= 15:45 ET)
export function manage(bars, j0, end, s, E, S, Tg, placed = true) {
  let fill = null, fi = -1, last = -1;
  for (let k = j0; k < end; k++) {
    const b = bars[k];
    if (nyMin(T(b)) > P.lastMin || nyMin(T(b)) < 2 * 60) break;   // past 15:45 ET (minutes wrap at the 17:00 day end)
    last = k;
    if (fill == null) {
      if (!placed) return null;
      if (s === 1 ? O(b) >= S : O(b) <= S) return { cancel: 'stop-side' };
      if (s === 1 ? H(b) >= E : L(b) <= E) {
        fill = s === 1 ? Math.max(E, O(b)) : Math.min(E, O(b)); fi = k;
        if (s === 1 ? H(b) >= S : L(b) <= S) return { fi, fill, exit: S, why: 'stop', xi: k };
        continue;
      }
      if (s === 1 ? L(b) <= Tg : H(b) >= Tg) return { cancel: 'target' };
      continue;
    }
    if (s === 1 ? O(b) >= S : O(b) <= S) return { fi, fill, exit: O(b), why: 'stop', xi: k };
    if (s === 1 ? H(b) >= S : L(b) <= S) return { fi, fill, exit: S, why: 'stop', xi: k };
    if (s === 1 ? L(b) <= Tg : H(b) >= Tg) return { fi, fill, exit: Tg, why: 'target', xi: k };
  }
  if (fill == null) return { cancel: 'expired' };
  return { fi, fill, exit: C(bars[last]), why: 'flat', xi: last };
}

// placebo management from a known fill (fill candle: stop only)
export function manageFrom(bars, fi, end, s, fill, S, Tg) {
  const b0 = bars[fi];
  if (s === 1 ? H(b0) >= S : L(b0) <= S) return { exit: S, why: 'stop' };
  let last = fi;
  for (let k = fi + 1; k < end; k++) {
    const b = bars[k]; if (nyMin(T(b)) > P.lastMin || nyMin(T(b)) < 2 * 60) break; last = k;
    if (s === 1 ? O(b) >= S : O(b) <= S) return { exit: O(b), why: 'stop' };
    if (s === 1 ? H(b) >= S : L(b) <= S) return { exit: S, why: 'stop' };
    if (s === 1 ? L(b) <= Tg : H(b) >= Tg) return { exit: Tg, why: 'target' };
  }
  return { exit: C(bars[last]), why: 'flat' };
}

// one day, one kill zone: the whole funnel. opt = { kz, filter, smt: { bars, map, dayHiLo } }
export function setupDay(bars, h1, d, prev, opt, fn) {
  const tick = (k) => { if (fn) fn[k] = (fn[k] || 0) + 1; };
  tick('days');
  let mo = null; for (let i = d.i0; i < d.i1; i++) if (nyParts(T(bars[i])).ymd === d.key && nyMin(T(bars[i])) === 0) { mo = O(bars[i]); break; }
  if (mo == null) return null;
  const rd = findRaid(bars, d, prev, opt.kz); if (!rd) return null; tick('raid');
  const ms = findMSS(bars, rd.r, rd.s, d.i1); if (!ms) return null; tick('mss');
  const s = rd.s, j = ms.j;
  let xi = rd.r; for (let i = rd.r; i <= j; i++) if (s === 1 ? H(bars[i]) > H(bars[xi]) : L(bars[i]) < L(bars[xi])) xi = i;
  const X = s === 1 ? H(bars[xi]) : L(bars[xi]);
  let Lg = s === 1 ? Infinity : -Infinity; for (let i = xi; i <= j; i++) Lg = s === 1 ? Math.min(Lg, L(bars[i])) : Math.max(Lg, H(bars[i]));
  const E = (X + Lg) / 2, S = X + s * P.buf, r = s * (S - E);
  if (!(r > 0)) return null;
  const tc = T(bars[j]) + 900, mid = (prev.hi + prev.lo) / 2;
  const Tg = findTarget(h1, tc, s, E, mid); if (Tg == null) return null; tick('target');
  if (s * (E - Tg) / r < P.minRR) return null; tick('rr');
  if (opt.filter && !(s === 1 ? E > mo : E < mo)) return null; tick('filter');
  if (opt.smt) {
    const { map, prevOf } = opt.smt, sp = prevOf(d.key); if (!sp) return null;
    for (let i = rd.r; i <= j; i++) { const sb = map.get(T(bars[i])); if (!sb) return null; if (s === 1 ? H(sb) > sp.hi : L(sb) < sp.lo) return null; }
    tick('smt');
  }
  const m = manage(bars, j + 1, d.i1, s, E, S, Tg);
  if (!m || m.cancel) { tick('cancel_' + (m ? m.cancel : 'none')); return null; }
  tick('fill');
  const R = s * (m.fill - m.exit) / r;
  return { day: d.key, s, t: T(bars[m.fi]), E, fill: m.fill, S, Tg, X, r, R, exit: m.exit, why: m.why, fi: m.fi, end: d.i1, tc, mid, mo };
}

// ---------- statistics ----------
function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const v of c) s += v / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; } return h; }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// one-sided p of t > tv with df degrees of freedom
export const pOne = (tv, df) => { if (!Number.isFinite(tv) || df < 1) return 1; const x = df / (df + tv * tv), tail = 0.5 * ibeta(df / 2, 0.5, x); return tv > 0 ? tail : 1 - tail; };
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; }); return out; }
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
export function months(from, to) { const out = []; let [y, m] = from.split('-').map(Number); const [y2, m2] = to.split('-').map(Number);
  while (y < y2 || (y === y2 && m <= m2)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; }
export function monthT(trades, mk, key = 'net') { const sum = new Map(mk.map((m) => [m, 0])); for (const x of trades) { const m = x.day.slice(0, 7); if (sum.has(m)) sum.set(m, sum.get(m) + x[key]); }
  const v = [...sum.values()], n = v.length, mu = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
  return { t: sd > 0 ? mu / (sd / Math.sqrt(n)) : 0, months: n }; }
export function stats(trades, mk, costMul = 1) {
  const tr = trades.map((x) => ({ ...x, net: x.R - costMul * P.cost / x.r }));
  const n = tr.length; if (!n) return { n: 0 };
  const net = tr.reduce((a, x) => a + x.net, 0), gross = tr.reduce((a, x) => a + x.R, 0);
  let cum = 0, pk = 0, dd = 0; for (const x of tr) { cum += x.net; pk = Math.max(pk, cum); dd = Math.min(dd, cum - pk); }
  const mt = monthT(tr, mk), risks = tr.map((x) => x.r).sort((a, b) => a - b);
  return { n, wr: r2(100 * tr.filter((x) => x.net > 0).length / n), gross: r3(gross / n), avg: r3(net / n), total: r2(net), dd: r2(dd),
    tMonth: r2(mt.t), pOne: +pOne(mt.t, mt.months - 1).toFixed(4), months: mt.months, stops: tr.filter((x) => x.why === 'stop').length,
    targets: tr.filter((x) => x.why === 'target').length, flat: tr.filter((x) => x.why === 'flat').length, medRisk: r2(risks[Math.floor(n / 2)]),
    sells: tr.filter((x) => x.s === 1).length };
}

// seeded RNG
export const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ---------- data ----------
const load = (dir, f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))));
export const clean = (bars) => bars.filter((b) => T(b) >= START && !spotClosed(T(b)));

async function fetchAll(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const FROM = Date.UTC(2017, 11, 1) / 1000, END = Date.UTC(2026, 10, 14) / 1000;
  fs.mkdirSync(dir, { recursive: true });
  for (const [sym, tf, sec] of [['xau', '15m', 900], ['xau', '1h', 3600], ['xag', '15m', 900]]) {
    const f = path.join(dir, `${sym}-${tf}.json.gz`); if (fs.existsSync(f)) { console.log(f, 'exists'); continue; }
    const m = new Map();
    for (let a = FROM; a < END;) {
      const b = Math.min(END, a + 4999 * sec); let j = null, err = null;
      for (let k = 0; k < 6 && !j; k++) {
        try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
          if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
        catch (e) { err = String(e.message || e); }
        if (!j) await sleep(2000 * (k + 1));
      }
      if (!j) throw new Error(`${sym} ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
      a = b; await sleep(150);
    }
    const bars = [...m.values()].sort((p, q) => p[0] - q[0]);
    fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
    console.log(sym, tf, bars.length, new Date(bars[0][0] * 1000).toISOString(), new Date(bars.at(-1)[0] * 1000).toISOString());
  }
}

export function runAll(m15, h1, ag) {
  const D = days(m15), agD = days(ag), agMap = new Map(ag.map((b) => [T(b), b]));
  const agIdx = new Map(agD.map((d, i) => [d.key, i]));
  const prevOf = (k) => { const i = agIdx.get(k); return i > 0 ? agD[i - 1] : null; };
  const lastKey = D.at(-1).key;
  const TESTS = { T1: { kz: KZ.ny, filter: true }, T2: { kz: KZ.ny, filter: false }, T3: { kz: KZ.london, filter: true }, T4: { kz: KZ.ny, filter: true, smt: { map: agMap, prevOf } } };
  const out = {};
  for (const [name, opt] of Object.entries(TESTS)) {
    const fn = {}, trades = [];
    for (let i = 1; i < D.length; i++) {
      const d = D[i], prev = D[i - 1];
      if (d.key < FIRST_DAY || d.key === lastKey) continue;
      const wd = new Date(d.key + 'T12:00:00Z').getUTCDay(); if (wd === 0 || wd === 6) continue;
      if (dayInfo(d.key).kind !== 'open') continue;
      const x = setupDay(m15, h1, d, prev, opt, fn); if (x) trades.push(x);
    }
    out[name] = { trades, funnel: fn };
  }
  return { out, D, lastKey };
}

export function placebo(m15, h1, trades, seed) {
  const rnd = rng(seed), res = [];
  for (const x of trades) {
    const s = rnd() < 0.5 ? 1 : -1, S = x.fill + s * x.r;
    const Tg = findTarget(h1, x.tc, s, x.fill, x.mid); if (Tg == null || s * (x.fill - Tg) / x.r < P.minRR) continue;
    const m = manageFrom(m15, x.fi, x.end, s, x.fill, S, Tg);
    res.push({ day: x.day, s, r: x.r, R: s * (x.fill - m.exit) / x.r, why: m.why });
  }
  return res;
}

async function full(dir) {
  const m15 = clean(load(dir, 'xau-15m.json.gz')), h1 = clean(load(dir, 'xau-1h.json.gz')), ag = clean(load(dir, 'xag-15m.json.gz'));
  const { out, lastKey } = runAll(m15, h1, ag);
  const isM = months('2018-01', '2020-12'), oosM = months('2021-01', lastKey.slice(0, 7));
  const split = (tr) => ({ is: tr.filter((x) => x.day < OOS), oos: tr.filter((x) => x.day >= OOS) });
  const tests = {};
  for (const [k, v] of Object.entries(out)) {
    const { is, oos } = split(v.trades), years = {};
    for (const y of [...new Set(v.trades.map((x) => x.day.slice(0, 4)))]) { const yt = v.trades.filter((x) => x.day.startsWith(y)); const s = stats(yt, months(`${y}-01`, `${y}-12`)); years[y] = { n: s.n, avg: s.avg, total: s.total }; }
    tests[k] = { is: stats(is, isM), oos: stats(oos, oosM), oos2x: stats(oos, oosM, 2), is2x: stats(is, isM, 2), years, funnel: v.funnel };
  }
  const names = Object.keys(tests), hp = holm(names.map((k) => tests[k].oos.n ? tests[k].oos.pOne : 1));
  names.forEach((k, i) => { tests[k].oos.holm = +hp[i].toFixed(4); });
  const t1 = tests.T1, pass = t1.oos.n > 0 && t1.oos.tMonth >= 2 && t1.oos.holm < 0.05 && t1.is.avg > 0 && t1.oos2x.avg > 0;
  // placebo
  const oosT1 = out.T1.trades.filter((x) => x.day >= OOS), draws = [];
  for (let sd = 1; sd <= 40; sd++) { const pr = placebo(m15, h1, oosT1, sd).map((x) => ({ ...x, net: x.R - P.cost / x.r })); draws.push({ seed: sd, n: pr.length, avg: pr.length ? r3(pr.reduce((a, x) => a + x.net, 0) / pr.length) : null }); }
  const beaten = draws.filter((d) => d.avg != null && t1.oos.avg > d.avg).length;
  const reasons = [];
  if (!(t1.oos.tMonth >= 2)) reasons.push(`T1 out-of-sample month t ${t1.oos.tMonth} (bar 2)`);
  if (!(t1.oos.holm < 0.05)) reasons.push(`Holm p ${t1.oos.holm}`);
  if (!(t1.is.avg > 0)) reasons.push(`in sample ${t1.is.avg}R a trade`);
  if (!(t1.oos2x.avg > 0)) reasons.push(`${t1.oos2x.avg}R a trade at 2x costs`);
  const res = { built: '2026-11-14', verdict: pass ? 'PASS' : 'FAIL', reasons,
    data: { src: 'OANDA mid M15 + H1 XAU/USD, M15 XAG/USD via /md/bars', from: new Date(m15[0][0] * 1000).toISOString().slice(0, 10), to: lastKey, m15: m15.length, h1: h1.length, xag15: ag.length },
    windows: { is: '2018-01-01 to 2020-12-31', oos: `2021-01-01 to ${lastKey}` }, params: P, costs: { roundTrip: P.cost, financing: 'none (flat by 16:00 ET)' },
    tests, placebo: { draws, beaten, of: 40, real: t1.oos.avg } };
  const here = path.dirname(fileURLToPath(import.meta.url));
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, reasons, T: Object.fromEntries(names.map((k) => [k, { is: tests[k].is, oos: tests[k].oos, oos2x: tests[k].oos2x.avg }])), beaten }, null, 1));
  console.log(JSON.stringify(Object.fromEntries(names.map((k) => [k, tests[k].funnel]))));
  return res;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch') await fetchAll(dir); else if (mode === 'full') await full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
