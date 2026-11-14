// Gold after a large Asian-session dollar move against the yen or the Australian dollar (PREREGISTRATION.md, pushed alone first).
// A new stand-alone intraday rule on gold, NOT a gate, exit, entry or size of the gold book (owner item 44). Paper research only.
//   node --use-env-proxy research/edge/gold-asia-fx-move/run.mjs fetch <dir>   OANDA mid H1 xau, usdjpy, audusd via the site proxy
//   node research/edge/gold-asia-fx-move/run.mjs count <dir>                  signal-day counts per window (no gold outcome read)
//   node research/edge/gold-asia-fx-move/run.mjs full <dir>                   the study -> result.json (+ prints the tables)
// Pure pieces are exported for tests/gold-asia-fx-move.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { nights, FIN } from '../../../council/fills.mjs';

export const H = 3600, D = 86400, COST = 0.60, LOOK = 60, ATR_N = 20, Z = 1.5, SEEDS = 40;
export const ASIA = { from: 0, to: 7 };      // hours UTC: the H1 candles 00:00 .. 06:00 (open of 00:00 -> close of 06:00)
export const TRADE = { from: 7, to: 20 };    // hours UTC: gold enters at the 07:00 open, out at the close of the 19:00 candle
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const TESTS = {
  T1: { name: 'USD/JPY falls in Asia (z <= -1.5): buy gold 07:00-20:00 UTC', fx: 'usdjpy', rule: (z) => (z <= -Z ? 1 : 0) },
  T2: { name: 'USD/JPY rises in Asia (z >= +1.5): sell gold 07:00-20:00 UTC', fx: 'usdjpy', rule: (z) => (z >= Z ? -1 : 0) },
  T3: { name: 'AUD/USD moves in Asia (|z| >= 1.5): gold the same way as AUD/USD, 07:00-20:00 UTC', fx: 'audusd', rule: (z) => (z >= Z ? 1 : z <= -Z ? -1 : 0) },
};
export const SYMS = ['xau', 'usdjpy', 'audusd'];

export const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
export const dayOf = (s) => Math.floor(Date.parse(s) / 1000 / D);
export const isWeekday = (d) => { const w = new Date(d * D * 1000).getUTCDay(); return w >= 1 && w <= 5; };
export function isTradeDay(d) { if (!isWeekday(d)) return false; const x = new Date(d * D * 1000), m = x.getUTCMonth(), dd = x.getUTCDate(); return !(m === 11 && dd === 25) && !(m === 0 && dd === 1); }
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
export const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };

// log move of an instrument from the open of the from-hour candle to the close of the (to-1)-hour candle of UTC day d; null on a hole at either end
export function windowMove(byTime, d, from, to) {
  const a = byTime.get(d * D + from * H), b = byTime.get(d * D + (to - 1) * H);
  return a && b && a.open > 0 && b.close > 0 ? Math.log(b.close / a.open) : null;
}
// z of each day's Asian move against the sd of the LOOK previous valid Asian moves (the day itself excluded): Map d -> z
export function asiaZ(h1, look = LOOK) {
  const byTime = new Map(h1.map((b) => [b.time, b])), d0 = Math.floor(h1[0].time / D), d1 = Math.floor(h1.at(-1).time / D), out = new Map(), hist = [];
  for (let d = d0; d <= d1; d++) {
    if (!isWeekday(d)) continue; const m = windowMove(byTime, d, ASIA.from, ASIA.to); if (m == null) continue;
    if (hist.length >= look) { const s = sd(hist.slice(-look)); if (s > 0) out.set(d, m / s); }
    hist.push(m);
  }
  return out;
}
// UTC daily candles of gold built from H1 (weekday days only): [{ d, high, low, close }]
export function dailyOf(h1) {
  const map = new Map();
  for (const b of h1) { const d = Math.floor(b.time / D); if (!isWeekday(d)) continue; let x = map.get(d); if (!x) { x = { d, high: -Infinity, low: Infinity, close: null, last: -1 }; map.set(d, x); } x.high = Math.max(x.high, b.high); x.low = Math.min(x.low, b.low); if (b.time > x.last) { x.last = b.time; x.close = b.close; } }
  return [...map.values()].sort((a, b) => a.d - b.d);
}
// ATR(n) of the daily candles of days strictly before d (null with fewer than n + 1)
export function atrBefore(days, d, n = ATR_N) {
  let lo = 0, hi = days.length - 1, j = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (days[m].d < d) { j = m; lo = m + 1; } else hi = m - 1; }
  if (j < n) return null; let s = 0;
  for (let k = j - n + 1; k <= j; k++) { const c0 = days[k - 1].close, x = days[k]; s += Math.max(x.high - x.low, Math.abs(x.high - c0), Math.abs(x.low - c0)); }
  return s / n;
}
// one trade on the gold H1 candles cs: entry at the first open, stop first, a gap through it fills at the open, out at the last close
export function simulate(cs, side, dist) {
  const entry = cs[0].open, stop = entry - side * dist; let exit = cs.at(-1).close, how = 'time', t1 = cs.at(-1).time + H;
  for (const b of cs) {
    if (side > 0 && b.low <= stop) { exit = Math.min(b.open, stop); how = 'stop'; t1 = b.time + H; break; }
    if (side < 0 && b.high >= stop) { exit = Math.max(b.open, stop); how = 'stop'; t1 = b.time + H; break; }
  }
  return { entry, stop, exit, how, t0: cs[0].time, t1, gross: side * (exit - entry) / dist };
}
// cost of one trade in R: the round trip, plus financing on a buy over each 22:00 UTC rollover held (none in a 07-20 UTC hold)
export function costR(tr, side, dist, mult = 1) {
  const fin = side > 0 ? nights(tr.t0, tr.t1) * FIN.xau.long * tr.entry : 0;
  return (mult * COST + mult * fin) / dist;
}
// every eligible gold day: the 07:00 and 19:00 candles present, an ATR stop, with its long and short trade
export function goldDays(h1) {
  const byTime = new Map(h1.map((b) => [b.time, b])), days = dailyOf(h1), d0 = Math.floor(h1[0].time / D), d1 = Math.floor(h1.at(-1).time / D), out = new Map();
  for (let d = d0; d <= d1; d++) {
    if (!isTradeDay(d)) continue;
    if (!byTime.get(d * D + TRADE.from * H) || !byTime.get(d * D + (TRADE.to - 1) * H)) continue;
    const dist = atrBefore(days, d); if (!(dist > 0)) continue;
    const cs = []; for (let h = TRADE.from; h < TRADE.to; h++) { const b = byTime.get(d * D + h * H); if (b) cs.push(b); }
    const row = { d, dist };
    for (const side of [1, -1]) { const tr = simulate(cs, side, dist), c = costR(tr, side, dist), c2 = costR(tr, side, dist, 2); row[side > 0 ? 'L' : 'S'] = { ...tr, net: tr.gross - c, net2: tr.gross - c2, cost: c }; }
    out.set(d, row);
  }
  return out;
}
export const inWin = (d, w) => d >= dayOf(w[0]) && d <= dayOf(w[1]);
export const monthOf = (d) => ymd(d).slice(0, 7);
export function monthsOf(w) { const out = []; let [y, m] = w[0].slice(0, 7).split('-').map(Number); const [y1, m1] = w[1].slice(0, 7).split('-').map(Number); while (y < y1 || (y === y1 && m <= m1)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; }
// t of calendar-month sums of v(trade), every month of the window counted (empty months = 0)
export function monthT(rows, w, v) {
  const sums = new Map(monthsOf(w).map((m) => [m, 0])); for (const r of rows) { const k = monthOf(r.d); if (sums.has(k)) sums.set(k, sums.get(k) + v(r)); }
  const a = [...sums.values()], s = sd(a); return s > 0 ? mean(a) / (s / Math.sqrt(a.length)) : 0;
}
// one-sided p for a t on n months (normal approximation)
export function pOne(t) { const z = t, b = 1 / (1 + 0.2316419 * Math.abs(z)), p = 0.3989423 * Math.exp(-z * z / 2) * b * (0.3193815 + b * (-0.3565638 + b * (1.781478 + b * (-1.821256 + b * 1.330274)))); return z >= 0 ? p : 1 - p; }
export function holm(ps) { const ix = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0; ix.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; }); return out; }
// seeded generator (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pick(arr, k, r) { const a = [...arr]; for (let i = 0; i < k && i < a.length; i++) { const j = i + Math.floor(r() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); }

// signal days of one test: [{ d, side, z }] for days with a z and a gold day
export function signals(test, zmap, gold) { const out = []; for (const [d, z] of zmap) { const side = test.rule(z); if (side && gold.has(d)) out.push({ d, side, z }); } return out.sort((a, b) => a.d - b.d); }
const trOf = (gold, s) => gold.get(s.d)[s.side > 0 ? 'L' : 'S'];

export function stats(sig, gold, w) {
  const rows = sig.filter((s) => inWin(s.d, w)).map((s) => ({ ...s, dist: gold.get(s.d).dist, ...trOf(gold, s) }));
  const all = [...gold.values()].filter((g) => inWin(g.d, w));
  // the same-side every-day baseline: each signal compared with the mean net R of its own side over every eligible day of the window
  const base = { 1: mean(all.map((g) => g.L.net)), [-1]: mean(all.map((g) => g.S.net)) }, baseG = { 1: mean(all.map((g) => g.L.gross)), [-1]: mean(all.map((g) => g.S.gross)) };
  const n = rows.length, net = mean(rows.map((r) => r.net)), bmean = mean(rows.map((r) => base[r.side])), t = monthT(rows, w, (r) => r.net), tEx = monthT(rows, w, (r) => r.net - base[r.side]);
  return { n, buys: rows.filter((r) => r.side > 0).length, sells: rows.filter((r) => r.side < 0).length, gross: +mean(rows.map((r) => r.gross)).toFixed(4), net: +net.toFixed(4), net2: +mean(rows.map((r) => r.net2)).toFixed(4),
    baseline: +bmean.toFixed(4), baselineGross: +mean(rows.map((r) => baseG[r.side])).toFixed(4), baseDays: all.length, excess: +(net - bmean).toFixed(4),
    tGross: +monthT(rows, w, (r) => r.gross).toFixed(2), t: +t.toFixed(2), tExcess: +tEx.toFixed(2), pExcess: +pOne(tEx).toFixed(4),
    total: +rows.reduce((s, r) => s + r.net, 0).toFixed(2), wr: +(100 * rows.filter((r) => r.net > 0).length / Math.max(1, n)).toFixed(1), stopped: rows.filter((r) => r.how === 'stop').length,
    medStop: +(rows.length ? [...rows.map((r) => r.dist)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] : 0).toFixed(2), months: monthsOf(w).length, _rows: rows, _all: all, _base: base };
}
// placebo: SEEDS draws of the same number of buys and sells on random eligible days of the window -> mean net R of each draw
export function placebo(st, seed0) {
  const days = st._all, nb = st.buys, ns = st.sells, out = [];
  for (let s = 0; s < SEEDS; s++) { const r = rng(seed0 + s), b = pick(days, nb, r).map((g) => g.L.net), q = pick(days, ns, r).map((g) => g.S.net); out.push(mean([...b, ...q])); }
  return out.sort((a, b) => a - b);
}
// control: SEEDS draws keeping each signal's calendar year and side: the same count of buys / sells a year on random days of that year
export function control(st, seed0) {
  const byYear = new Map(); for (const g of st._all) { const y = ymd(g.d).slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(g); }
  const need = new Map(); for (const r of st._rows) { const y = ymd(r.d).slice(0, 4), k = `${y}|${r.side}`; need.set(k, (need.get(k) || 0) + 1); }
  const out = [];
  for (let s = 0; s < SEEDS; s++) { const r = rng(seed0 + s), v = []; for (const [k, c] of need) { const [y, side] = k.split('|'); for (const g of pick(byYear.get(y), c, r)) v.push(+side > 0 ? g.L.net : g.S.net); } out.push(mean(v)); }
  return out.sort((a, b) => a - b);
}
const q = (a, p) => +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(4);
const summ = (a, x) => ({ p5: q(a, 0.05), p50: q(a, 0.5), p95: q(a, 0.95), max: +a.at(-1).toFixed(4), beaten: a.filter((v) => x > v).length, of: a.length });

export function study(h1s) {
  const gold = goldDays(h1s.xau), z = { usdjpy: asiaZ(h1s.usdjpy), audusd: asiaZ(h1s.audusd) }, out = { tests: {} };
  const ps = [];
  Object.entries(TESTS).forEach(([id, test], i) => {
    const sig = signals(test, z[test.fx], gold), row = { name: test.name, fx: test.fx };
    for (const k of ['is', 'oos']) {
      const st = stats(sig, gold, WIN[k]), pl = placebo(st, 1000 * (i + 1) + (k === 'oos' ? 100 : 0)), co = control(st, 5000 * (i + 1) + (k === 'oos' ? 100 : 0));
      const { _rows, _all, _base, ...clean } = st; row[k] = { ...clean, placebo: summ(pl, st.net), control: summ(co, st.net) };
    }
    ps.push(row.oos.pExcess); out.tests[id] = row;
  });
  const hp = holm(ps);
  Object.values(out.tests).forEach((row, i) => {
    const o = row.oos, s = row.is;
    row.holmP = +hp[i].toFixed(4);
    row.checks = { holm: hp[i] <= 0.05, netT: o.t >= 2, netPos: o.net > 0, sameSignIS: s.excess > 0, x2: o.net2 > 0, placebo: o.net > o.placebo.p95, control: o.net > o.control.p95, events: o.n >= 100 && s.n >= 100 };
    row.pass = Object.values(row.checks).every(Boolean);
  });
  const passed = Object.entries(out.tests).filter(([, r]) => r.pass).map(([k]) => k);
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = passed;
  out.data = { gold: { from: ymd(Math.floor(h1s.xau[0].time / D)), to: ymd(Math.floor(h1s.xau.at(-1).time / D)), h1: h1s.xau.length, days: gold.size },
    usdjpy: { h1: h1s.usdjpy.length, zDays: z.usdjpy.size }, audusd: { h1: h1s.audusd.length, zDays: z.audusd.size }, src: 'OANDA mid H1 via the site proxy (/md/bars)' };
  out.costs = { roundTrip: COST, financing: `nights(entry, exit) x FIN.xau.long (${FIN.xau.long}) x entry on buys; a 07:00-20:00 UTC hold crosses no 22:00 UTC rollover, so 0`, finSrc: FIN.xau.src };
  return out;
}

const load = (dir, s) => JSON.parse(fs.readFileSync(path.join(dir, `${s}-h1.json`), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const sym of SYMS) {
    let from = Math.floor(Date.parse('2006-06-01') / 1000); const end = Math.floor(Date.parse('2026-11-01') / 1000), all = [];
    while (from < end) { const to = Math.min(end, from + 4990 * H); let j, ok = false;
      for (let k = 0; k < 4 && !ok; k++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=1h&from=${from}&to=${to}`); j = await r.json(); ok = r.ok; } catch (e) { j = { error: String(e) }; } if (!ok) await new Promise((s) => setTimeout(s, 8000)); }
      if (!ok) throw new Error(`proxy ${j && j.error}`);
      for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
      process.stderr.write(`${sym} ${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
    const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(path.join(dir, `${sym}-h1.json`), JSON.stringify(rows));
  }
}

// counts signal days per window from the currency candles only and the gold days' presence (no gold price outcome is read)
function count(dir) {
  const gold = goldDays(load(dir, 'xau')), z = { usdjpy: asiaZ(load(dir, 'usdjpy')), audusd: asiaZ(load(dir, 'audusd')) };
  for (const [id, test] of Object.entries(TESTS)) { const sig = signals(test, z[test.fx], gold); console.log(id, Object.fromEntries(Object.entries(WIN).map(([k, w]) => [k, sig.filter((s) => inWin(s.d, w)).length]))); }
  console.log('gold days', Object.fromEntries(Object.entries(WIN).map(([k, w]) => [k, [...gold.keys()].filter((d) => inWin(d, w)).length])));
}

function full(dir) {
  const r = study(Object.fromEntries(SYMS.map((s) => [s, load(dir, s)])));
  r.built = new Date().toISOString().slice(0, 10);
  r.note = 'A new stand-alone intraday rule on gold, not a gate, exit, entry or size of the gold book (owner item 44). Paper research only.';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(r, null, 1) + '\n');
  for (const [id, row] of Object.entries(r.tests)) {
    console.log(`\n${id} ${row.name}  holm ${row.holmP} pass ${row.pass} ${JSON.stringify(row.checks)}`);
    for (const k of ['is', 'oos']) { const x = row[k]; console.log(`  ${k.padEnd(4)} n ${x.n} (${x.buys}/${x.sells}) gross ${x.gross} net ${x.net} x2 ${x.net2} base ${x.baseline} excess ${x.excess} tG ${x.tGross} t ${x.t} tEx ${x.tExcess} total ${x.total} wr ${x.wr} stop ${x.stopped} med$ ${x.medStop} | placebo ${x.placebo.p5}/${x.placebo.p50}/${x.placebo.p95} beat ${x.placebo.beaten} | control ${x.control.p5}/${x.control.p50}/${x.control.p95} beat ${x.control.beaten}`); }
  }
  console.log('\nverdict', r.verdict, JSON.stringify(r.data));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir); else if (cmd === 'count') count(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|count|full <dir>');
}
