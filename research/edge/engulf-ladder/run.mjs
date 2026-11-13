// Engulf ladder on gold, Daily -> H4 -> H1 (PREREGISTRATION.md, committed first and alone).
//   node --use-env-proxy research/edge/engulf-ladder/run.mjs fetch <dir>   OANDA mid H1 gold from 1 Jul 2019 via the site's proxy
//   node research/edge/engulf-ladder/run.mjs full <dir>                   the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test. Nothing here reads or changes the live Gold daily engulf (geg).
import fs from 'node:fs';
import path from 'node:path';
import { nights, FIN } from '../../../council/fills.mjs';

export const H = 3600, D = 86400;
export const P = { buf: 0.3, cost: 0.3, rr: 2, holdDays: 5, look: 3, touchDays: 10, h1After: 24, valid: 24, minRisk: 1, erN: 12, erCut: 0.3,
  from: '2020-01-01', split: '2024-01-01', seeds: 40, placeboNeed: 38 };

// ---- the 17:00 New York trading day ----
const nyOff = (() => { const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' }); const c = new Map();
  return (t) => { const k = Math.floor(t / H); if (c.has(k)) return c.get(k); const p = Object.fromEntries(f.formatToParts(new Date(k * H * 1000)).map((x) => [x.type, x.value]));
    const loc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24) / 1000, o = (loc - k * H) / H; c.set(k, o); return o; }; })();
// seconds since 17:00 New York of the trading day (17:00 -> 0); the day number; weekend hours -> null (as gold-drd-long nyDay)
export function nyPlace(t) {
  const loc = t + nyOff(t) * H + 7 * H, d = Math.floor(loc / D), wd = new Date(d * D * 1000).getUTCDay();
  return wd === 0 || wd === 6 ? null : { d, sec: loc - d * D };
}

// ---- candles of a timeframe from H1: 'd' = the trading day, 'h4' = its 4-hour blocks from 17:00 New York ----
export function buildTF(h1, kind) {
  const out = []; let cur = null;
  for (let k = 0; k < h1.length; k++) {
    const b = h1[k], p = nyPlace(b.time); if (!p) continue;
    const key = kind === 'd' ? p.d : p.d * 6 + Math.floor(p.sec / (4 * H));
    if (!cur || cur.key !== key) { cur = { key, d: p.d, t: b.time, end: b.time + H, open: b.open, high: b.high, low: b.low, close: b.close, i0: k, i1: k }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; cur.end = b.time + H; cur.i1 = k; }
  }
  return out;
}

// ---- first index k >= from where vals[k] < x (dir -1) or > x (dir +1); block extremes keep it fast ----
export function seeker(vals) {
  const B = 64, nb = Math.ceil(vals.length / B), mn = new Float64Array(nb), mx = new Float64Array(nb);
  for (let b = 0; b < nb; b++) { let lo = Infinity, hi = -Infinity; for (let k = b * B; k < Math.min(vals.length, (b + 1) * B); k++) { lo = Math.min(lo, vals[k]); hi = Math.max(hi, vals[k]); } mn[b] = lo; mx[b] = hi; }
  return (from, x, dir, inclusive = false) => {
    const hit = (v) => dir < 0 ? (inclusive ? v <= x : v < x) : (inclusive ? v >= x : v > x);
    let k = Math.max(0, from);
    while (k < vals.length) {
      if (k % B === 0) { const b = k / B, v = dir < 0 ? mn[b] : mx[b]; if (!hit(v)) { k += B; continue; } }
      if (hit(vals[k])) return k; k++;
    }
    return -1;
  };
}

// ---- engulf zones of one side on a timeframe. side +1: red base, a close above its high within the next 1-3 candles (none
// closing below its low before); zone low..high, dead at the first later close below the low. side -1 mirrored. ----
export function engulfZones(c, side, look = P.look) {
  const closes = c.map((x) => x.close), seek = seeker(closes), out = [];
  for (let i = 0; i < c.length - 1; i++) {
    const b = c[i]; if (side > 0 ? !(b.close < b.open) : !(b.close > b.open)) continue;
    let j = -1;
    for (let m = i + 1; m <= Math.min(c.length - 1, i + look); m++) {
      const x = c[m].close;
      if (side > 0 ? x < b.low : x > b.high) break;           // closed through the far side first: no zone
      if (side > 0 ? x > b.high : x < b.low) { j = m; break; }
    }
    if (j < 0) continue;
    const k = seek(j + 1, side > 0 ? b.low : b.high, side > 0 ? -1 : 1);
    out.push({ side, base: i, born: j, baseT: b.t, bornEnd: c[j].end, low: b.low, high: b.high, dead: k, deadEnd: k < 0 ? Infinity : c[k].end });
  }
  return out;
}

// ---- the ladder: Daily zone -> touch -> H4 engulf inside it -> H1 engulf inside that -> a signal ----
export function ladder(h1, ds, h4, side, opt = {}) {
  const p = { ...P, ...opt };
  for (const b of h1) { b.t = b.time; b.end = b.time + H; }   // an H1 candle is its own timeframe candle
  const Dz = engulfZones(ds, side), Fz = engulfZones(h4, side), Gz = engulfZones(h1, side);
  const lows = h1.map((b) => b.low), highs = h1.map((b) => b.high), seekL = seeker(lows), seekH = seeker(highs);
  const h4Of = new Int32Array(h1.length).fill(-1); h4.forEach((x, n) => { for (let k = x.i0; k <= x.i1; k++) h4Of[k] = n; });
  const dayIdx = new Map(ds.map((x, n) => [x.d, n]));
  const firstAt = (arr, key, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m][key] < v) lo = m + 1; else hi = m; } return lo; };
  const idxAtOrAfter = (t) => firstAt(h1, 'time', t);
  const inside = (v, z) => v >= z.low && v <= z.high;
  const sigs = [], funnel = { daily: Dz.length, touched: 0, h4: 0, h1: 0 };
  for (const Z of Dz) {
    const k0 = idxAtOrAfter(Z.bornEnd); if (k0 >= h1.length) continue;
    const k = side > 0 ? seekL(k0, Z.high, -1, true) : seekH(k0, Z.low, 1, true);
    if (k < 0 || h1[k].time >= Z.deadEnd) continue;
    funnel.touched++;
    const tp = nyPlace(h1[k].time), di = dayIdx.get(tp.d), wEnd = Math.min(Z.deadEnd, ds[Math.min(ds.length - 1, di + p.touchDays)].end);
    const hb = h4Of[k]; if (hb < 0) continue;
    let F = null;
    for (let n = firstAt(Fz, 'base', hb); n < Fz.length && Fz[n].baseT < wEnd; n++) {
      const f = Fz[n]; if (f.bornEnd > wEnd || f.bornEnd >= Z.deadEnd) continue;
      if (inside(side > 0 ? h4[f.base].low : h4[f.base].high, Z)) { F = f; break; }
    }
    if (!F) continue;
    funnel.h4++;
    const fBornK = h4[F.born].i1, gEnd = fBornK + p.h1After;
    let G = null;
    for (let n = firstAt(Gz, 'base', fBornK + 1); n < Gz.length && Gz[n].base <= gEnd; n++) {
      const g = Gz[n]; if (g.born > gEnd || g.bornEnd >= F.deadEnd) continue;
      if (inside(side > 0 ? h1[g.base].low : h1[g.base].high, F)) { G = g; break; }
    }
    if (!G) continue;
    funnel.h1++;
    const mid = (G.high + G.low) / 2, edge = side > 0 ? G.high : G.low, stop = side > 0 ? F.low - p.buf : F.high + p.buf;
    const a = Math.max(0, hb - p.erN - 1), cl = h4.slice(a, hb).map((x) => x.close);
    let path = 0; for (let m = 1; m < cl.length; m++) path += Math.abs(cl[m] - cl[m - 1]);
    const er = cl.length === p.erN + 1 && path > 0 ? Math.abs(cl.at(-1) - cl[0]) / path : null;
    sigs.push({ side, t: G.bornEnd, k: G.born, mid, edge, stop, fDead: F.deadEnd, touchT: h1[k].time, er,
      D: [Z.low, Z.high, Z.bornEnd], F: [F.low, F.high, F.bornEnd], G: [G.low, G.high, G.bornEnd] });
  }
  return { sigs, funnel };
}

// ---- one limit order on H1 candles after the signal candle; returns { status, ... } ----
export function simulateOrder(h1, ds, sg, limit, opt = {}) {
  const p = { ...P, ...opt }, side = sg.side, dayIdx = opt.dayIdx || new Map(ds.map((x, n) => [x.d, n]));
  const risk0 = side * (limit - sg.stop); if (!(risk0 >= p.minRisk)) return { status: 'small' };
  let k = sg.k + 1, fill = null, fk = -1;
  for (let n = 0; n < p.valid && k < h1.length; n++, k++) {
    const b = h1[k]; if (b.time >= sg.fDead) return { status: 'cancel', endT: b.time };
    if (side > 0 ? b.open <= sg.stop : b.open >= sg.stop) return { status: 'cancel', endT: b.time };   // opened past the stop
    if (side > 0 ? b.open <= limit : b.open >= limit) { fill = b.open; fk = k; break; }
    if (side > 0 ? b.low <= limit : b.high >= limit) { fill = limit; fk = k; break; }
  }
  if (fk < 0) return { status: 'expired', endT: k < h1.length ? h1[k].time : h1.at(-1).time + H };
  const entry = fill, risk = side * (entry - sg.stop), tgt = entry + side * p.rr * risk, atOpen = fill === h1[fk].open;
  const lastDay = ds[Math.min(ds.length - 1, dayIdx.get(nyPlace(h1[fk].time).d) + p.holdDays)].d;
  let exit = null, how = 'time', ek = fk;
  for (let m = fk; m < h1.length; m++) {
    const b = h1[m], pl = nyPlace(b.time); if (!pl) continue; if (pl.d > lastDay) break;
    const hitS = side > 0 ? b.low <= sg.stop : b.high >= sg.stop, hitT = side > 0 ? b.high >= tgt : b.low <= tgt;
    if (hitS) { exit = m === fk ? sg.stop : (side > 0 ? Math.min(b.open, sg.stop) : Math.max(b.open, sg.stop)); how = 'stop'; ek = m; break; }
    if (hitT && (m > fk || atOpen)) { exit = tgt; how = 'target'; ek = m; break; }   // a target in the fill candle only counts after an open fill
    exit = b.close; ek = m;
    if (m === h1.length - 1) how = 'open-end';
  }
  const R = side * (exit - entry) / risk, fillT = h1[fk].time, exitT = h1[ek].time + (how === 'time' || how === 'open-end' ? H : 0);
  const finR = side > 0 ? nights(fillT, exitT) * FIN.xau.long * entry / risk : 0;
  return { status: 'filled', side, sigT: sg.t, fillT, exitT, entry, stop: sg.stop, risk, R, finR, net: R - P.cost / risk - finR, how, er: sg.er };
}

// ---- one at a time over the signals (both sides share one slot) ----
export function oneAtATime(h1, ds, sigs, opt = {}) {
  const dayIdx = new Map(ds.map((x, n) => [x.d, n])), taken = [], trades = [], count = { signals: sigs.length, small: 0, busy: 0, cancel: 0, expired: 0, filled: 0 };
  let free = -Infinity;
  for (const sg of [...sigs].sort((a, b) => a.t - b.t || a.side - b.side)) {
    if (sg.t < free) { count.busy++; continue; }
    const r = simulateOrder(h1, ds, sg, sg.mid, { ...opt, dayIdx });
    count[r.status]++;
    if (r.status === 'small') continue;
    taken.push(sg);
    if (r.status === 'filled') { trades.push(r); free = r.exitT; } else free = r.endT;
  }
  return { taken, trades, count };
}

// ---- statistics ----
export function stats(T) {
  const n = T.length, s = T.reduce((a, x) => a + x.net, 0), m = n ? s / n : 0, sd = n > 1 ? Math.sqrt(T.reduce((a, x) => a + (x.net - m) ** 2, 0) / (n - 1)) : 0;
  const win = T.filter((x) => x.net > 0).reduce((a, x) => a + x.net, 0), loss = -T.filter((x) => x.net < 0).reduce((a, x) => a + x.net, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of [...T].sort((a, b) => a.fillT - b.fillT)) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, avg: +m.toFixed(3), total: +s.toFixed(1), pf: loss ? +(win / loss).toFixed(2) : null, wr: n ? +(T.filter((x) => x.net > 0).length / n * 100).toFixed(1) : null,
    t: sd && n > 1 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, dd: +dd.toFixed(1), sd };
}
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthT(T, fromMonth, toMonth) {
  const sum = new Map(); for (const x of T) sum.set(ym(x.fillT), (sum.get(ym(x.fillT)) || 0) + x.net);
  const v = []; let [y, m] = fromMonth.split('-').map(Number);
  for (;;) { const k = `${y}-${String(m).padStart(2, '0')}`; v.push(sum.get(k) || 0); if (k >= toMonth) break; m++; if (m > 12) { m = 1; y++; } }
  const n = v.length, mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { months: n, perMonth: +mean.toFixed(3), t: sd ? +(mean / (sd / Math.sqrt(n))).toFixed(2) : null };
}
export function welch(a, b) {
  const A = stats(a), B = stats(b), se = Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n);
  return { diff: +(A.avg - B.avg).toFixed(3), t: se ? +((A.avg - B.avg) / se).toFixed(2) : null };
}
const erf = (x) => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
export const pTwo = (t) => t == null ? 1 : 2 * (1 - 0.5 * (1 + erf(Math.abs(t) / Math.SQRT2)));
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); adj[i] = run; });
  return adj;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- placebo: same month, side and stop distance; entry at a random H1 open ----
export function placeboTrade(h1, ds, dayIdx, k, side, risk) {
  const entry = h1[k].open, stop = entry - side * risk, tgt = entry + side * P.rr * risk;
  const lastDay = ds[Math.min(ds.length - 1, dayIdx.get(nyPlace(h1[k].time).d) + P.holdDays)].d;
  let exit = entry, ek = k, how = 'time';
  for (let m = k; m < h1.length; m++) { const b = h1[m], pl = nyPlace(b.time); if (!pl) continue; if (pl.d > lastDay) break;
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = m === k ? stop : (side > 0 ? Math.min(b.open, stop) : Math.max(b.open, stop)); how = 'stop'; ek = m; break; }
    if (side > 0 ? b.high >= tgt : b.low <= tgt) { exit = tgt; how = 'target'; ek = m; break; }
    exit = b.close; ek = m; }
  const R = side * (exit - entry) / risk, exitT = h1[ek].time + (how === 'time' ? H : 0);
  const finR = side > 0 ? nights(h1[k].time, exitT) * FIN.xau.long * entry / risk : 0;
  return { fillT: h1[k].time, net: R - P.cost / risk - finR };
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let from = Math.floor(Date.parse('2019-07-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * H);
    let j = null;
    for (let tr = 0; tr < 4 && !j; tr++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=1h&from=${from}&to=${to}`); const x = await r.json(); if (r.ok) j = x; else throw new Error(`proxy ${r.status} ${x.error || ''}`); } catch (e) { process.stderr.write(`retry ${e.message}\n`); await new Promise((s) => setTimeout(s, 5000)); } }
    if (!j) throw new Error('proxy failed');
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
}

const strip = (s) => { const { sd, ...r } = s; return r; };
export function study(h1) {
  const ds = buildTF(h1, 'd'), h4 = buildTF(h1, 'h4'), dayIdx = new Map(ds.map((x, n) => [x.d, n]));
  const from = Date.parse(P.from) / 1000, split = Date.parse(P.split) / 1000;
  const L = [1, -1].map((s) => ladder(h1, ds, h4, s));
  const sigs = L.flatMap((x) => x.sigs).filter((s) => s.t >= from);
  const funnel = { buy: L[0].funnel, sell: L[1].funnel };
  const { taken, trades, count } = oneAtATime(h1, ds, sigs);
  const first = (T) => T.filter((x) => x.fillT < split), second = (T) => T.filter((x) => x.fillT >= split);
  const lastMonth = ym(h1.at(-1).time);
  const S = (T) => strip(stats(T));
  // T1
  const mt = monthT(trades, P.from.slice(0, 7), lastMonth);
  const t1 = { all: S(trades), h1: S(first(trades)), h2: S(second(trades)), month: mt, buy: S(trades.filter((x) => x.side > 0)), sell: S(trades.filter((x) => x.side < 0)) };
  // placebo
  const byMonth = new Map(); h1.forEach((b, k) => { if (!nyPlace(b.time)) return; const m = ym(b.time); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(k); });
  const pmeans = [];
  for (let s = 1; s <= P.seeds; s++) { const r = rng(s), T = trades.map((x) => { const ks = byMonth.get(ym(x.fillT)); return placeboTrade(h1, ds, dayIdx, ks[Math.floor(r() * ks.length)], x.side, x.risk); });
    pmeans.push(+stats(T).avg.toFixed(3)); }
  const below = pmeans.filter((m) => m < t1.all.avg).length;
  t1.placebo = { means: pmeans, median: [...pmeans].sort((a, b) => a - b)[P.seeds / 2], below, need: P.placeboNeed };
  // T2
  const sw = trades.filter((x) => x.er != null && x.er < P.erCut), mo = trades.filter((x) => x.er != null && x.er >= P.erCut);
  const t2 = { sideways: S(sw), momentum: S(mo), ...welch(sw, mo), h1: welch(first(sw), first(mo)), h2: welch(second(sw), second(mo)), noEr: trades.filter((x) => x.er == null).length };
  // T3: the same taken signals, entry at the near edge
  const edge = [], perSig = { mid: [], edge: [] };
  const midBy = new Map(trades.map((x) => [x.sigT + ':' + x.side, x]));
  for (const sg of taken) { const r = simulateOrder(h1, ds, sg, sg.edge, { dayIdx }); if (r.status === 'filled') edge.push(r);
    perSig.edge.push(r.status === 'filled' ? r.net : 0); const m = midBy.get(sg.t + ':' + sg.side); perSig.mid.push(m ? m.net : 0); }
  const avg = (v) => +(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(3);
  const t3 = { mid: S(trades), edge: S(edge), ...welch(trades, edge), h1: welch(first(trades), first(edge)), h2: welch(second(trades), second(edge)),
    perSignal: { n: taken.length, mid: avg(perSig.mid), edge: avg(perSig.edge) } };
  // Holm
  const ps = [pTwo(mt.t), pTwo(t2.t), pTwo(t3.t)], adj = holm(ps);
  t1.p = +ps[0].toFixed(4); t1.holm = +adj[0].toFixed(4); t2.p = +ps[1].toFixed(4); t2.holm = +adj[1].toFixed(4); t3.p = +ps[2].toFixed(4); t3.holm = +adj[2].toFixed(4);
  t1.pass = t1.h1.avg > 0 && t1.h2.avg > 0 && mt.t >= 2 && t1.holm < 0.05 && below >= P.placeboNeed;
  t2.pass = t2.t >= 2 && t2.h1.diff > 0 && t2.h2.diff > 0 && t2.holm < 0.05;
  t3.pass = t3.t >= 2 && t3.h1.diff > 0 && t3.h2.diff > 0 && t3.holm < 0.05;
  const years = {}; for (const x of trades) { const y = ym(x.fillT).slice(0, 4); (years[y] ||= []).push(x); }
  for (const y of Object.keys(years)) { const s = stats(years[y]); years[y] = { n: s.n, avg: s.avg, total: s.total, pf: s.pf }; }
  const how = {}; for (const x of trades) how[x.how] = (how[x.how] || 0) + 1;
  const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  return { built: new Date().toISOString().slice(0, 10), rule: 'research/edge/engulf-ladder/PREREGISTRATION.md', params: P,
    data: { src: 'OANDA mid H1 XAU_USD via the site proxy', from: iso(h1[0].time), to: iso(h1.at(-1).time), h1: h1.length, h4: h4.length, days: ds.length },
    funnel, orders: count, exits: how, T1: t1, T2: t2, T3: t3, years, verdict: t1.pass ? 'PASS' : 'FAIL' };
}

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const out = study(h1);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ funnel: out.funnel, orders: out.orders, exits: out.exits }, null, 0));
  for (const k of ['T1', 'T2', 'T3']) console.log(k, JSON.stringify({ ...out[k], placebo: out[k].placebo && { ...out[k].placebo, means: undefined } }));
  console.log('years', JSON.stringify(out.years)); console.log('verdict', out.verdict);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
