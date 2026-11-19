// Gold: the H4 market cycle as a stand-alone directional bias (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-h4-cycle-bias/run.mjs count <xau-h1.json>   event counts per window (made before pre-registering)
//   node research/edge/gold-h4-cycle-bias/run.mjs full  <xau-h1.json>   the study -> result.json
// Candles are kept out of git: OANDA mid H1 rows [t, o, h, l, c] (the site's candle proxy, as gold-h4-pullback-resume used).
// A stand-alone rule: never a gate, exit, entry or size of the live gold book. Pure pieces are exported for the test.
import fs from 'node:fs';
import { nights, FIN } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const H = 3600, H4 = 4 * H;
export const RT = 0.60;                 // $0.30 spread + $0.15 slippage each side
export const SW = 3, ATR_N = 14, ATR_K = 2;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const SEED = 20261117, SEEDS = 40;

// New York trading day (17:00 to 17:00) that holds an H1 candle opening at t: its end time (UTC)
export function dayEnd(t) {
  const off = nyOffsetH(t) * H, local = t - off;
  return Math.floor((local - 17 * H) / 86400) * 86400 + 17 * H + 86400 + off;
}
// H4 block start (17, 21, 01, 05, 09, 13 New York)
export function h4Start(t) {
  const off = nyOffsetH(t) * H, local = t - off;
  return Math.floor((local - H) / H4) * H4 + H + off;
}
export function toH4(h1) {
  const out = []; let cur = null;
  for (const [t, o, h, l, c] of h1) {
    const s = h4Start(t);
    if (!cur || cur.time !== s) { cur = { time: s, end: s + H4, o, h, l, c }; out.push(cur); }
    else { cur.h = Math.max(cur.h, h); cur.l = Math.min(cur.l, l); cur.c = c; }
  }
  return out;
}
// NY days from H1: { end, k0, k1, o, h, l, c } (k0..k1 = the H1 rows inside)
export function toDays(h1) {
  const out = []; let cur = null;
  h1.forEach(([t, o, h, l, c], k) => {
    const e = dayEnd(t);
    if (!cur || cur.end !== e) { cur = { end: e, k0: k, k1: k, o, h, l, c }; out.push(cur); }
    else { cur.h = Math.max(cur.h, h); cur.l = Math.min(cur.l, l); cur.c = c; cur.k1 = k; }
  });
  return out;
}

// Structure on candles {h, l, c}: a swing high at j = a high above the SW candles each side, known once candle j+SW closed.
// State +1 after a close above the last known swing high, -1 after a close below the last known swing low (each level
// broken once). Returns per candle i (after its close) { st, flip }: flip = the state changed on this close.
export function structure(bars) {
  const out = []; let st = 0, sh = null, sl = null;
  for (let i = 0; i < bars.length; i++) {
    const j = i - SW;   // the candle that becomes a known swing on this close
    if (j >= SW) {
      let isH = true, isL = true;
      for (let q = j - SW; q <= j + SW; q++) { if (q === j) continue; if (bars[q].h >= bars[j].h) isH = false; if (bars[q].l <= bars[j].l) isL = false; }
      if (isH) sh = bars[j].h;
      if (isL) sl = bars[j].l;
    }
    let flip = 0;
    if (sh != null && bars[i].c > sh) { if (st !== 1) flip = 1; st = 1; sh = null; }
    else if (sl != null && bars[i].c < sl) { if (st !== -1) flip = -1; st = -1; sl = null; }
    out.push({ st, flip });
  }
  return out;
}

// per H1 row k: the H4 state from H4 candles closed by the H1 close, and when the H4 state last flipped
export function h4StateAt(h1, h4, s4) {
  const res = new Array(h1.length); let j = 0, st = 0, since = null;
  for (let k = 0; k < h1.length; k++) {
    const T = h1[k][0] + H;
    for (; j < h4.length && h4[j].end <= T; j++) { if (s4[j].flip) since = h4[j].end; st = s4[j].st; }
    res[k] = { st, since };
  }
  return res;
}

// Signals: the H1 close that flips H1 structure back to the H4 side, after an H1 flip against it that came after the H4
// state was set (the H1 pullback has just ended). side +1 buy, -1 sell. Reads only candles closed by row k's close.
export function signals(h1) {
  const b1 = h1.map(([, , h, l, c]) => ({ h, l, c }));
  const s1 = structure(b1), h4 = toH4(h1), s4 = structure(h4), st4 = h4StateAt(h1, h4, s4);
  const out = []; let againstAt = null;
  for (let k = 0; k < h1.length; k++) {
    const { st, since } = st4[k], f = s1[k].flip, T = h1[k][0] + H;
    if (!st) continue;
    if (f === -st) againstAt = T;
    if (f === st && againstAt != null && since != null && againstAt > since) { out.push({ k, t: T, side: st }); againstAt = null; }
  }
  return out;
}

// ATR(14) of the complete NY days before day index i (simple mean of true ranges)
export function atrBefore(days, i) {
  if (i < ATR_N + 1) return null;
  let s = 0;
  for (let d = i - ATR_N; d < i; d++) s += Math.max(days[d].h - days[d].l, Math.abs(days[d].h - days[d - 1].c), Math.abs(days[d].l - days[d - 1].c));
  return s / ATR_N;
}

// one trade entered at H1 row e's open, out at the close of the NEXT NY day (its last H1 candle), stop 2 x ATR on H1 candles
// (a candle opening through the stop fills at its open). k = cost multiple.
export function makeSim(h1, days) {
  const dayOf = new Int32Array(h1.length);
  days.forEach((d, i) => { for (let k = d.k0; k <= d.k1; k++) dayOf[k] = i; });
  const atr = days.map((_, i) => atrBefore(days, i));
  return function sim(e, side, k = 1) {
    if (e >= h1.length) return null;
    const i = dayOf[e];
    if (i + 1 >= days.length || atr[i] == null) return null;
    const last = days[i + 1].k1, entry = h1[e][1], risk = ATR_K * atr[i], stop = entry - side * risk;
    let exit = null, how = 'time', exitT = null;
    for (let q = e; q <= last; q++) {
      const [t, o, hi, lo, c] = h1[q];
      if (side > 0 ? lo <= stop : hi >= stop) { exit = side > 0 ? Math.min(o, stop) : Math.max(o, stop); how = 'stop'; exitT = t + H; break; }
      if (q === last) { exit = c; exitT = t + H; }
    }
    const entryT = h1[e][0], gross = side * (exit - entry) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
    const cost = RT / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
    return { e, side, entryT, exitT, entry, stop, risk, exit, how, nights: nn, gross, cost, fin, net: gross - k * (cost + fin) };
  };
}

export const ymOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const yOf = (t) => +new Date(t * 1000).toISOString().slice(0, 4);
export const inWin = (t, w) => { const d = new Date(t * 1000).toISOString().slice(0, 10); return d >= w[0] && d <= w[1]; };

// t of calendar-month sums (months of the window with no trade count as 0)
export function monthT(rows, key, w) {
  const m = new Map();
  for (const r of rows) m.set(ymOf(r.entryT), (m.get(ymOf(r.entryT)) || 0) + r[key]);
  const months = []; let [y, mo] = w[0].split('-').map(Number); const [y1, m1] = w[1].split('-').map(Number);
  while (y < y1 || (y === y1 && mo <= m1)) { months.push(m.get(`${y}-${String(mo).padStart(2, '0')}`) || 0); mo++; if (mo > 12) { mo = 1; y++; } }
  const n = months.length, mean = months.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(months.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
// one-sided p (the hypothesis is a positive excess) from the month t, normal approximation (118-120 months)
export function pOf(t) {
  const z = Math.abs(t), u = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2);
  const q = d * u * (0.3193815 + u * (-0.3565638 + u * (1.781478 + u * (-1.821256 + u * 1.330274))));
  return t >= 0 ? q : 1 - q;
}
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// baselines: every H1 open, each side, the same exit and stop; mean net R by side x year, and by side x year x H4 state
export function baselines(h1, sim, st4, k = 1) {
  const by = new Map(), bySt = new Map(), add = (m, key, v) => { const e = m.get(key) || [0, 0]; e[0] += v; e[1]++; m.set(key, e); };
  for (let e = 1; e < h1.length; e++) for (const side of [1, -1]) {
    const x = sim(e, side, k); if (!x) continue;
    const y = yOf(x.entryT); add(by, `${side}:${y}`, x.net); add(bySt, `${side}:${y}:${st4[e - 1].st}`, x.net);
  }
  const mean = (m) => new Map([...m].map(([kk, [s, n]]) => [kk, s / n]));
  return { by: mean(by), bySt: mean(bySt) };
}

// one position at a time; entry at the next H1 open after the signal
export function runEvents(h1, sim, sigs, sides, k = 1) {
  const out = []; let free = -Infinity;
  for (const s of sigs) {
    if (!sides.includes(s.side)) continue;
    const e = s.k + 1; if (e >= h1.length || h1[e][0] < free) continue;
    const x = sim(e, s.side, k); if (!x) continue;
    x.sig = s; out.push(x); free = x.exitT;
  }
  return out;
}

export const TESTS = {
  T1: { name: 'T1 pullback end, both sides, excess over every hour of the same side and year (primary)', sides: [1, -1], base: 'side' },
  T2: { name: 'T2 the H4 state alone: first H1 of each NY day on the H4 side, excess over every hour of the same side and year', sides: [1, -1], base: 'side', daily: true },
  T3: { name: 'T3 pullback end, both sides, excess over every hour of the same side, year and H4 state', sides: [1, -1], base: 'state' },
};

// T2 events: the first H1 candle of each NY day, side = the H4 state after the previous H1 close
export function dailySignals(h1, days, st4) {
  const out = [];
  for (const d of days) { const k = d.k0 - 1; if (k < 0) continue; const st = st4[k].st; if (st) out.push({ k, t: h1[k][0] + H, side: st }); }
  return out;
}

export function stats(rows, w, key) {
  const r = rows.filter((x) => inWin(x.entryT, w)), n = r.length, mean = (f) => (n ? r.reduce((a, x) => a + f(x), 0) / n : 0);
  return { n, buys: r.filter((x) => x.side > 0).length, gross: mean((x) => x.gross), net: mean((x) => x.net), excess: mean((x) => x[key]),
    tGross: monthT(r, 'gross', w), tNet: monthT(r, 'net', w), tExcess: monthT(r, key, w),
    stops: r.filter((x) => x.how === 'stop').length, medRisk: n ? r.map((x) => x.risk).sort((a, b) => a - b)[n >> 1] : null };
}

export function study(h1) {
  const days = toDays(h1), h4 = toH4(h1), s4 = structure(h4), st4 = h4StateAt(h1, h4, s4);
  const sim1 = makeSim(h1, days), sigs = signals(h1), dsig = dailySignals(h1, days, st4);
  const base1 = baselines(h1, sim1, st4, 1), base2 = baselines(h1, sim1, st4, 2);
  const exOf = (x, b, test) => {
    const y = yOf(x.entryT);
    return test.base === 'state' ? x.net - b.bySt.get(`${x.side}:${y}:${st4[x.e - 1].st}`) : x.net - b.by.get(`${x.side}:${y}`);
  };
  const res = {};
  for (const [id, test] of Object.entries(TESTS)) {
    const sg = test.daily ? dsig : sigs;
    const rows = runEvents(h1, sim1, sg, test.sides, 1); rows.forEach((x) => { x.ex = exOf(x, base1, test); });
    const rows2 = runEvents(h1, sim1, sg, test.sides, 2); rows2.forEach((x) => { x.ex = exOf(x, base2, test); });
    const s2 = stats(rows2, WIN.oos, 'ex');
    res[id] = { name: test.name, is: stats(rows, WIN.is, 'ex'), oos: stats(rows, WIN.oos, 'ex'), oos2: { net: s2.net, excess: s2.excess }, rows };
  }
  return { days, st4, sim1, sigs, base1, res };
}

// placebo: the T1 OOS event times kept, sides shuffled among them (buy count kept); control: each event moved to the same UTC
// hour of a random day of the same year, side kept (drift and volatility kept, the signal's timing removed). OOS mean excess.
export function nulls(h1, ctx) {
  const { sim1, base1, res } = ctx, rows = res.T1.rows.filter((x) => inWin(x.entryT, WIN.oos));
  const real = rows.reduce((a, x) => a + x.ex, 0) / rows.length;
  const ex = (x) => x.net - base1.by.get(`${x.side}:${yOf(x.entryT)}`);
  const pool = new Map();
  h1.forEach(([t], e) => { const key = `${yOf(t)}:${new Date(t * 1000).getUTCHours()}`; if (!pool.has(key)) pool.set(key, []); pool.get(key).push(e); });
  const plac = [], ctrl = [];
  for (let s = 0; s < SEEDS; s++) {
    const r = rng(SEED + s), sides = rows.map((x) => x.side);
    for (let i = sides.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [sides[i], sides[j]] = [sides[j], sides[i]]; }
    let a = 0, n = 0;
    rows.forEach((x, i) => { const y = sim1(x.e, sides[i]); if (y) { a += ex(y); n++; } });
    plac.push(a / n);
    const r2 = rng(SEED + 1000 + s); let b = 0, m = 0;
    for (const x of rows) {
      const p = pool.get(`${yOf(x.entryT)}:${new Date(x.entryT * 1000).getUTCHours()}`), e = p[Math.floor(r2() * p.length)], y = sim1(e, x.side);
      if (y) { b += ex(y); m++; }
    }
    ctrl.push(b / m);
  }
  const band = (v) => { const s = [...v].sort((a, b) => a - b); return { mean: v.reduce((a, b) => a + b, 0) / v.length, p5: s[2], p95: s[37], beaten: v.filter((z) => real > z).length }; };
  return { real, placebo: band(plac), control: band(ctrl) };
}

const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);
const slim = (st) => Object.fromEntries(Object.entries(st).map(([k, v]) => [k, typeof v === 'number' ? r4(v) : v]));

const [mode, file] = process.argv.slice(2);
if (mode && import.meta.url === `file://${process.argv[1]}`) {
  const h1 = JSON.parse(fs.readFileSync(file, 'utf8')).filter((r) => r.length >= 5 && r.every(Number.isFinite));
  if (mode === 'count') {
    const days = toDays(h1), h4 = toH4(h1), st4 = h4StateAt(h1, h4, structure(h4)), sigs = signals(h1), ds = dailySignals(h1, days, st4);
    for (const [w, r] of Object.entries(WIN)) console.log(w, 'pullback-end signals', sigs.filter((s) => inWin(s.t, r)).length,
      'buys', sigs.filter((s) => inWin(s.t, r) && s.side > 0).length, 'H4-state days', ds.filter((s) => inWin(s.t, r)).length);
  } else if (mode === 'full') {
    const ctx = study(h1), nl = nulls(h1, ctx), tests = {}, ids = Object.keys(TESTS);
    const ps = ids.map((id) => pOf(ctx.res[id].oos.tExcess)), hp = holm(ps);
    ids.forEach((id, i) => {
      const R = ctx.res[id], byYear = {};
      for (const x of R.rows) { const y = yOf(x.entryT); if (y < 2007) continue; const b = byYear[y] || (byYear[y] = { n: 0, ex: 0, net: 0 }); b.n++; b.ex += x.ex; b.net += x.net; }
      for (const b of Object.values(byYear)) { b.ex = r4(b.ex / b.n); b.net = r4(b.net / b.n); }
      const bySide = {};
      for (const [nm, sd] of [['buys', 1], ['sells', -1]]) for (const [w, r] of Object.entries(WIN)) bySide[`${nm}_${w}`] = slim(stats(R.rows.filter((x) => x.side === sd), r, 'ex'));
      tests[id] = { name: R.name, is: slim(R.is), oos: slim(R.oos), oos2x: slim(R.oos2), p: r4(ps[i]), holm: r4(hp[i]), byYear, bySide };
    });
    const T1 = tests.T1;
    const pass = T1.oos.tExcess >= 2 && T1.holm <= 0.05 && T1.is.excess > 0 && T1.oos2x.excess > 0 && T1.oos2x.net > 0
      && nl.placebo.beaten >= 38 && nl.control.beaten >= 38;
    const out = { study: 'gold-h4-cycle-bias', built: '2026-11-14',
      data: { rows: h1.length, from: new Date(h1[0][0] * 1000).toISOString(), to: new Date(h1.at(-1)[0] * 1000).toISOString(), src: 'OANDA mid H1 XAU/USD' },
      costs: { roundTrip: RT, financing: FIN.xau.long, stop: `${ATR_K} x ATR(${ATR_N}) of New York days` }, windows: WIN, tests,
      nulls: { real: r4(nl.real), placebo: slim(nl.placebo), control: slim(nl.control) }, verdict: pass ? 'PASS' : 'FAIL' };
    fs.writeFileSync(new URL('result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ verdict: out.verdict, tests: Object.fromEntries(Object.entries(tests).map(([k, v]) => [k, { is: v.is, oos: v.oos, oos2x: v.oos2x, holm: v.holm }])), nulls: out.nulls }, null, 1));
  }
}
