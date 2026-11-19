// Edge research · gold-hour-periodicity (PREREGISTRATION.md, pushed first): spot gold's UTC day cut into five 4-hour blocks
// (00-04 … 16-20). Each block is traded on the sign of its OWN mean return over its last L complete occurrences on earlier
// days (same-block periodicity, after Heston, Korajczyk and Sadka 2010). T1 the block with the largest |z| each day (L 20,
// primary), T2 the same with L 60, T3 every block. Market at the block's open, stop 1.0 x the block's mean range, out at the
// block's close. $0.60 a round trip, financing on buys (0: a block never crosses the rollover). IS 2007-16, OOS 2017-Oct 2026,
// t on calendar-month sums, Holm over three, a placebo of 40 seeds that keeps each trade's day and side and moves it to
// another block. A stand-alone rule: not the gold book (item 44).
//   node --use-env-proxy research/edge/gold-hour-periodicity/run.mjs fetch <dir>   -> <dir>/xau-1h.json (kept out of git)
//   node research/edge/gold-hour-periodicity/run.mjs <file.json>                   -> result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null), r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

export const P = {
  BLOCKS: 5, BLOCK_H: 4, L: 20, L2: 60, STOP_K: 1.0, COST: 0.60, SEEDS: 40,
  IS: ['2007-01-01', '2017-01-01'], OOS: ['2017-01-01', '2026-11-01'],
};
export const TESTS = {
  T1: { mode: 'best', L: P.L, label: 'Strongest block of the day, L 20 (primary)' },
  T2: { mode: 'best', L: P.L2, label: 'Strongest block of the day, L 60' },
  T3: { mode: 'all', L: P.L, label: 'Every block, each on the sign of its own last 20 days' },
};

// ── H1 rows [t, o, h, l, c, …] → days[{ day, blocks[b] = { b, t, c, o, cl, r, range, bars } | null }] ──
export function toDays(rows, p = P) {
  const byDay = new Map();
  for (const [t, o, h, l, c] of rows) {
    const day = Math.floor(t / 86400) * 86400, wd = new Date(day * 1000).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const hr = (t - day) / 3600; if (hr !== Math.floor(hr)) continue;
    const b = Math.floor(hr / p.BLOCK_H); if (b >= p.BLOCKS) continue;   // 20-24 UTC never read
    if (!byDay.has(day)) byDay.set(day, Array.from({ length: p.BLOCKS }, () => []));
    byDay.get(day)[b].push({ time: t, open: o, high: h, low: l, close: c });
  }
  return [...byDay.entries()].sort((x, y) => x[0] - y[0]).map(([day, bl]) => ({
    day,
    blocks: bl.map((bars, b) => {
      bars.sort((x, y) => x.time - y.time);
      if (bars.length !== p.BLOCK_H || bars.some((x, k) => x.time !== day + (b * p.BLOCK_H + k) * 3600)) return null;   // complete only
      const o = bars[0].open, cl = bars.at(-1).close;
      return { b, t: bars[0].time, c: bars[0].time + p.BLOCK_H * 3600, o, cl, r: Math.log(cl / o),
        range: Math.max(...bars.map((x) => x.high)) - Math.min(...bars.map((x) => x.low)), bars };
    }),
  }));
}

// ── block statistic for block b on day index d: last L complete occurrences on days BEFORE d ──
export function blockStat(days, d, b, L) {
  const rs = [], rg = [];
  for (let k = d - 1; k >= 0 && rs.length < L; k--) { const x = days[k].blocks[b]; if (x) { rs.push(x.r); rg.push(x.range); } }
  if (rs.length < L) return null;
  const m = rs.reduce((a, v) => a + v, 0) / L, s = Math.sqrt(rs.reduce((a, v) => a + (v - m) ** 2, 0) / (L - 1));
  return { m, z: s > 0 ? m / (s / Math.sqrt(L)) : 0, A: rg.reduce((a, v) => a + v, 0) / L };
}

// ── one trade in block x on side, risk A ──
export function trade(x, side, A, p = P) {
  const fill = x.o, r0 = p.STOP_K * A, stop = fill - side * r0;
  let px = x.cl, why = 'time', c = x.c;
  for (const k of x.bars) {
    if (side > 0 ? k.low <= stop : k.high >= stop) {
      const gap = side > 0 ? k.open < stop : k.open > stop;
      px = gap ? k.open : stop; why = gap ? 'gap' : 'stop'; c = k.time + 3600; break;
    }
  }
  return { b: x.b, side, t: x.t, c, fill, stop, r0, exit: px, R: side * (px - fill) / r0, why };
}
export function withNet(tr, p = P) {
  const nn = nights(tr.t, tr.c), fin = (m) => (tr.side > 0 ? m * nn * FIN.xau.long * tr.fill / tr.r0 : 0);
  return { ...tr, nights: nn, fin: fin(1), net: tr.R - p.COST / tr.r0 - fin(1), net2: tr.R - 2 * p.COST / tr.r0 - fin(2) };
}

// ── signals of one test: [{ d, b, side, A }] (the block's own statistics) ──
export function signals(days, test) {
  const out = [];
  for (let d = 0; d < days.length; d++) {
    const st = days[d].blocks.map((x, b) => (x ? blockStat(days, d, b, test.L) : null));
    if (test.mode === 'all') {
      st.forEach((s, b) => { if (s && s.m !== 0) out.push({ d, b, side: Math.sign(s.m), A: s.A, all: st }); });
    } else {
      let best = -1; st.forEach((s, b) => { if (s && s.m !== 0 && (best < 0 || Math.abs(s.z) > Math.abs(st[best].z))) best = b; });
      if (best >= 0) out.push({ d, b: best, side: Math.sign(st[best].m), A: st[best].A, all: st });
    }
  }
  return out;
}
export const tradesOf = (days, sigs) => sigs.map((s) => withNet(trade(days[s.d].blocks[s.b], s.side, s.A)));

// ── statistics ──
export function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export const pOne = (t) => (Number.isFinite(t) ? 0.5 * erfc(t / Math.SQRT2) : 1);
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthT(rows, from, to, key = 'net') {
  const a = ym(from), b = ym(to), s = new Array(b - a + 1).fill(0);
  for (const r of rows) s[Math.min(s.length - 1, Math.max(0, ym(r.c) - a))] += r[key];
  const n = s.length, mu = s.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(s.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mu / sd * Math.sqrt(n) : null };
}
export function maxDD(rows) { let eq = 0, hi = 0, dd = 0; for (const r of rows) { eq += r.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); } return dd; }
export function summary(rows, from, to) {
  const n = rows.length, mean = (k) => (n ? rows.reduce((a, r) => a + r[k], 0) / n : null);
  const m = n ? monthT(rows, from, to) : { months: 0, t: null }, g = n ? monthT(rows, from, to, 'R') : { t: null };
  const why = {}; for (const r of rows) why[r.why] = (why[r.why] || 0) + 1;
  return { n, buys: rows.filter((r) => r.side > 0).length, gross: r3(mean('R')), net: r3(mean('net')), net2: r3(mean('net2')), fin: r3(mean('fin')),
    costR: r3(n ? rows.reduce((a, r) => a + (r.R - r.net), 0) / n : null),
    totalNet: r2(rows.reduce((a, r) => a + r.net, 0)), win: n ? r3(rows.filter((r) => r.net > 0).length / n) : null, maxDD: r2(maxDD(rows)),
    months: m.months, t: r2(m.t), tGross: r2(g.t), p: +pOne(m.t).toFixed(4), why };
}
export function holm(ps, alpha = 0.05) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), adj = new Array(ps.length).fill(1); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; });
  return adj.map((a) => ({ adj: +a.toFixed(4), ok: a <= alpha }));
}
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// placebo: same day, same side, another block (its own A). 'best': one of the other complete blocks with a statistic;
// 'all': the day's sides shuffled across its traded blocks.
export function placeboSigs(sigs, test, seed) {
  const r = rng(seed), out = [];
  if (test.mode === 'best') {
    for (const s of sigs) {
      const others = s.all.map((x, b) => (x && b !== s.b ? b : -1)).filter((b) => b >= 0);
      if (!others.length) continue;
      const b = others[Math.floor(r() * others.length)];
      out.push({ d: s.d, b, side: s.side, A: s.all[b].A });
    }
  } else {
    const byDay = new Map(); for (const s of sigs) { if (!byDay.has(s.d)) byDay.set(s.d, []); byDay.get(s.d).push(s); }
    for (const list of byDay.values()) {
      const sides = list.map((s) => s.side);
      for (let i = sides.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [sides[i], sides[j]] = [sides[j], sides[i]]; }
      list.forEach((s, k) => out.push({ d: s.d, b: s.b, side: sides[k], A: s.A }));
    }
  }
  return out;
}
export function placebo(days, sigs, test, from, to, seeds = P.SEEDS) {
  const means = [], ts = [];
  for (let s = 1; s <= seeds; s++) {
    const rows = tradesOf(days, placeboSigs(sigs, test, s)).filter((x) => x.t >= from && x.t < to);
    means.push(rows.length ? rows.reduce((a, y) => a + y.net, 0) / rows.length : 0);
    ts.push(monthT(rows, from, to - 1).t ?? 0);
  }
  means.sort((a, b) => a - b); ts.sort((a, b) => a - b);
  const q = (arr, f) => arr[Math.min(arr.length - 1, Math.floor(f * arr.length))];
  return { seeds, median: r3(q(means, 0.5)), p95: r3(q(means, 0.95)), min: r3(means[0]), max: r3(means.at(-1)), tMedian: r2(q(ts, 0.5)), tP95: r2(q(ts, 0.95)) };
}

export function load(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

export function run(rows) {
  const days = toDays(rows), res = {}, ps = [];
  const isF = T(P.IS[0]), isT = T(P.IS[1]), oF = T(P.OOS[0]), oT = T(P.OOS[1]);
  for (const [k, test] of Object.entries(TESTS)) {
    const sigs = signals(days, test), trades = tradesOf(days, sigs);
    const isR = trades.filter((r) => r.t >= isF && r.t < isT), oR = trades.filter((r) => r.t >= oF && r.t < oT);
    const is = summary(isR, isF, isT - 1), oos = summary(oR, oF, oT - 1);
    const years = {}; for (const r of trades) { if (r.t < isF || r.t >= oT) continue; const y = new Date(r.t * 1000).getUTCFullYear(); (years[y] ||= { n: 0, net: 0 }); years[y].n++; years[y].net += r.net; }
    for (const y in years) years[y].net = r2(years[y].net);
    const picks = Array(P.BLOCKS).fill(0); for (const r of oR) picks[r.b]++;
    res[k] = { ...test, is, oos, placebo: placebo(days, sigs, test, oF, oT), placeboIS: placebo(days, sigs, test, isF, isT), years,
      bySide: { buy: summary(oR.filter((r) => r.side > 0), oF, oT - 1), sell: summary(oR.filter((r) => r.side < 0), oF, oT - 1) },
      byBlock: Object.fromEntries([...Array(P.BLOCKS).keys()].map((b) => [`B${b}`, summary(oR.filter((r) => r.b === b), oF, oT - 1)])),
      oosPicks: picks };
    ps.push(oos.p);
  }
  const h = holm(ps);
  Object.keys(TESTS).forEach((k, j) => {
    const r = res[k];
    r.holm = h[j];
    r.checks = { tHolm: (r.oos.t ?? 0) >= 2 && h[j].ok, isSign: r.is.net > 0, x2: r.oos.net2 > 0, placebo: r.oos.net > r.placebo.p95 };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  const last = rows.at(-1)[0];
  return { study: 'gold-hour-periodicity', title: 'Gold time-of-day periodicity: each 4-hour block on the sign of its own last 20 days',
    built: new Date(last * 1000).toISOString().slice(0, 10), verdict: res.T1.pass ? 'PASS' : 'FAIL',
    data: { h1: { n: rows.length, from: rows[0][0], to: last }, days: days.length, completeBlocks: days.reduce((a, d) => a + d.blocks.filter(Boolean).length, 0) },
    params: P, costs: { roundTrip: P.COST, financingLong: FIN.xau.long, financingSrc: FIN.xau.src },
    tests: res };
}

async function fetchAll(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/bars', FROM = T('2006-01-01'), STEP = 3600;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = async (url) => {
    for (let k = 0; k < 4; k++) {
      try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) throw new Error(`${r.status} ${url}`); } catch (e) { if (k === 3) throw e; }
      await sleep(3000 * (k + 1));
    }
    throw new Error('failed ' + url);
  };
  fs.mkdirSync(dir, { recursive: true });
  const now = Math.floor(Date.now() / 1000), out = new Map();
  for (let a = FROM; a < now; a += 4999 * STEP) {
    const j = await get(`${BASE}?sym=xau&tf=1h&from=${a}&to=${Math.min(now, a + 4999 * STEP)}`);
    for (const x of j.bars || []) out.set(x.time, [x.time, x.open, x.high, x.low, x.close]);
    await sleep(2500);
  }
  const rows = [...out.values()].sort((x, y) => x[0] - y[0]).filter((r) => r[0] + STEP <= now);
  fs.writeFileSync(path.join(dir, 'xau-1h.json'), JSON.stringify(rows));
  console.log('1h', rows.length);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [a, b] = process.argv.slice(2);
  if (a === 'fetch') await fetchAll(b);
  else if (a) {
    const out = run(load(a));
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const [k, r] of Object.entries(out.tests)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, placeboIS: r.placeboIS, holm: r.holm, checks: r.checks, bySide: { buy: r.bySide.buy.net, bn: r.bySide.buy.n, sell: r.bySide.sell.net, sn: r.bySide.sell.n }, picks: r.oosPicks }));
    console.log('data', JSON.stringify(out.data), 'verdict', out.verdict);
  } else { console.error('usage: run.mjs fetch <dir> | run.mjs <xau-1h.json>'); process.exit(1); }
}
