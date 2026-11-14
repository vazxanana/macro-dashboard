// Does a sharp M15 move in the US 10-year Treasury lead gold and USD/JPY over the next hour? (PREREGISTRATION.md, pushed first.)
//   node --use-env-proxy research/edge/bond-lead-intraday/run.mjs fetch <dir>   OANDA mid M15 usb10y / xau / usdjpy via the site proxy
//   node research/edge/bond-lead-intraday/run.mjs full <dir>                     writes result.json
// A stand-alone research rule (item 44): never a gate, exit, entry or size of the live gold book. Paper only.
import fs from 'node:fs';
import path from 'node:path';

export const M = 900, D = 86400;
export const P = { k: 2.5, volDays: 28, minRet: 1000, from: 12 * 3600, to: 19 * 3600 + 45 * 60, atrN: 96, hold: 3600 };
export const SPLIT = Date.UTC(2016, 0, 1) / 1000;
export const GOLD_COST = 0.30;
// USD/JPY, the raw-spread model (CLAUDE.md "Forex spreads"): quoted spread 0, commission 22.5 USD a million a side, half the
// default 1-pip spread of slippage on the entry and on the (market) exit.
export const JPY_COM_RT = 2 * 22.5 / 1e6, JPY_PIP = 0.01;
export const jpyCost = (entry) => JPY_COM_RT * entry + JPY_PIP;
export const goldCost = () => GOLD_COST;

// usb10y signals: [{ t (signal candle start), dir (+1 bond up), r, sd }]
export function bondSignals(bars, p = P) {
  const ret = [];   // [t, r] valid returns, time order
  for (let i = 1; i < bars.length; i++) if (bars[i].time - bars[i - 1].time === M && bars[i - 1].close > 0) ret.push([bars[i].time, bars[i].close / bars[i - 1].close - 1]);
  const out = []; let lo = 0, s = 0, s2 = 0, hi = 0;   // window [lo, hi) of returns with start in [t - volDays, t)
  for (let j = 0; j < ret.length; j++) {
    const [t, r] = ret[j];
    while (hi < j) { s += ret[hi][1]; s2 += ret[hi][1] ** 2; hi++; }
    while (lo < hi && ret[lo][0] < t - p.volDays * D) { s -= ret[lo][1]; s2 -= ret[lo][1] ** 2; lo++; }
    const n = hi - lo; if (n < p.minRet) continue;
    const tod = t % D; if (tod < p.from || tod > p.to) continue;
    const sd = Math.sqrt(Math.max(0, (s2 - s * s / n) / (n - 1)));
    if (sd > 0 && Math.abs(r) > p.k * sd) out.push({ t, dir: Math.sign(r), r, sd });
  }
  return out;
}

// ATR(n) of the traded market's candles ending with index i (simple mean of the true range); null without n earlier candles
export function atrAt(bars, i, n = P.atrN) {
  if (i < n) return null; let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// one trade: signal candle start t, side +1 buy / -1 sell, on market bars (index by time). null = no trade
export function trade(bars, idx, t, side, cost, p = P) {
  const i0 = idx.get(t), e0 = idx.get(t + M); if (i0 == null || e0 == null) return null;
  const atr = atrAt(bars, i0, p.atrN); if (!(atr > 0)) return null;
  const entry = bars[e0].open, stop = entry - side * atr;
  let exit = null, how = 'time', exitT = null;
  for (let k = e0; k < bars.length && bars[k].time < t + M + p.hold; k++) {
    const b = bars[k];
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = side > 0 ? Math.min(b.open, stop) : Math.max(b.open, stop); how = 'stop'; exitT = b.time; break; }
    exit = b.close; exitT = b.time + M;
  }
  if (exit == null) return null;
  const R = side * (exit - entry) / atr, c = cost(entry);
  return { t, entryT: bars[e0].time, exitT, side, entry, stop, risk: atr, exit, how, R, cost: c / atr, net: R - c / atr };
}

// New York clock: does candle start t sit at 08:30 or 10:00 New York?
const NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', weekday: 'short' });
export function releaseCandle(t) {
  const p = Object.fromEntries(NYF.formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value]));
  if (p.weekday === 'Sat' || p.weekday === 'Sun') return false;
  const hm = `${String(+p.hour).padStart(2, '0')}:${p.minute}`;
  return hm === '08:30' || hm === '10:00';
}

// run one stream: signals [{t, side}] in time order, one position at a time
export function stream(bars, idx, sigs, cost, mult = 1) {
  const out = []; let busyTo = -Infinity;
  for (const s of sigs) {
    if (s.t + M < busyTo) continue;   // entry would be inside an open trade
    const tr = trade(bars, idx, s.t, s.side, (e) => mult * cost(e)); if (!tr) continue;
    out.push(tr); busyTo = tr.exitT;
  }
  return out;
}

// statistics: t on calendar-month sums
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const erfc = (x) => { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; };
export const pOne = (t) => 0.5 * erfc(t / Math.SQRT2);
export function monthT(T, key = 'net') {
  const m = new Map(); for (const x of T) m.set(ym(x.entryT), (m.get(ym(x.entryT)) || 0) + x[key]);
  const v = [...m.values()], n = v.length; if (n < 3) return { months: n, t: null };
  const a = v.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(v.reduce((p, q) => p + (q - a) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? +(a / (sd / Math.sqrt(n))).toFixed(2) : null };
}
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let m = 0;
  o.forEach(([p, i], r) => { m = Math.max(m, Math.min(1, p * (ps.length - r))); adj[i] = m; }); return adj; }
const r3 = (x) => +x.toFixed(3);
export function stats(T) {
  const n = T.length; if (!n) return { n: 0 };
  const g = T.reduce((p, x) => p + x.R, 0), s = T.reduce((p, x) => p + x.net, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const mt = monthT(T);
  return { n, gross: r3(g), grossAvg: r3(g / n), net: r3(s), avg: r3(s / n), win: +(T.filter((x) => x.net > 0).length / n).toFixed(3),
    stopped: T.filter((x) => x.how === 'stop').length, dd: r3(dd), months: mt.months, t: mt.t, tGross: monthT(T, 'R').t };
}

// seeded RNG (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// placebo: each signal replaced by a random weekday candle of the same year and the same UTC start time, same side
export function placeboSigs(sigs, bars, seed) {
  const R = rng(seed), pool = new Map();   // "year|tod" -> [t]
  for (const b of bars) { const d = new Date(b.time * 1000), wd = d.getUTCDay(); if (wd === 0 || wd === 6) continue;
    const k = `${d.getUTCFullYear()}|${b.time % D}`; let a = pool.get(k); if (!a) pool.set(k, a = []); a.push(b.time); }
  const out = [];
  for (const s of sigs) { const a = pool.get(`${new Date(s.t * 1000).getUTCFullYear()}|${s.t % D}`); if (!a || !a.length) continue; out.push({ t: a[Math.floor(R() * a.length)], side: s.side }); }
  return out.sort((x, y) => x.t - y.t);
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const now = Math.floor(Date.now() / 1000);
  for (const sym of ['usb10y', 'xau', 'usdjpy']) {
    let from = Date.UTC(2002, 0, 1) / 1000; const all = [];
    while (from < now) {
      const to = Math.min(now, from + 4990 * M); let j = null;
      for (let a = 0; a < 4 && !j; a++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=15m&from=${from}&to=${to}`); const x = await r.json(); if (r.ok) j = x; else throw new Error(`${r.status} ${x.error || ''}`); } catch (e) { process.stderr.write(`retry ${sym} ${from} ${e.message}\n`); await new Promise((s) => setTimeout(s, 5000)); } }
      if (!j) throw new Error(`proxy failed ${sym} ${from}`);
      for (const b of j.bars || []) if (!b.live && b.time + M <= now) all.push([b.time, b.open, b.high, b.low, b.close]);
      process.stderr.write(`${sym} ${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`);
      from = to; await new Promise((s) => setTimeout(s, 400));
    }
    const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(path.join(dir, `${sym}-m15.json`), JSON.stringify(rows));
  }
}

const load = (dir, sym) => JSON.parse(fs.readFileSync(path.join(dir, `${sym}-m15.json`), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');

export function analyse(B, G, J, { seeds = 40 } = {}) {
  const gi = new Map(G.map((b, i) => [b.time, i])), ji = new Map(J.map((b, i) => [b.time, i]));
  const sig = bondSignals(B);
  const TESTS = {
    T1: { bars: G, idx: gi, cost: goldCost, sigs: sig.map((s) => ({ t: s.t, side: s.dir })) },
    T2: { bars: J, idx: ji, cost: jpyCost, sigs: sig.map((s) => ({ t: s.t, side: -s.dir })) },
    T3: { bars: G, idx: gi, cost: goldCost, sigs: sig.filter((s) => !releaseCandle(s.t)).map((s) => ({ t: s.t, side: s.dir })) },
  };
  const win = { decisive: (x) => x.entryT >= SPLIT, replication: (x) => x.entryT < SPLIT };
  const out = { signals: { n: sig.length, up: sig.filter((s) => s.dir > 0).length, down: sig.filter((s) => s.dir < 0).length, releaseCandles: sig.filter((s) => releaseCandle(s.t)).length }, tests: {} };
  for (const [k, T] of Object.entries(TESTS)) {
    const tr = stream(T.bars, T.idx, T.sigs, T.cost), tr2 = stream(T.bars, T.idx, T.sigs, T.cost, 2);
    const o = { signals: T.sigs.length, windows: {}, cost2x: {}, years: {}, byBond: {} };
    for (const [w, f] of Object.entries(win)) { o.windows[w] = stats(tr.filter(f)); o.cost2x[w] = stats(tr2.filter(f)); }
    for (const x of tr) { const y = new Date(x.entryT * 1000).getUTCFullYear(); (o.years[y] = o.years[y] || []).push(x); }
    for (const y of Object.keys(o.years)) { const s = stats(o.years[y]); o.years[y] = { n: s.n, net: s.net, avg: s.avg }; }
    for (const d of [1, -1]) { const side = k === 'T2' ? -d : d, s = stats(tr.filter((x) => win.decisive(x) && x.side === side)); o.byBond[d > 0 ? 'bondUp' : 'bondDown'] = { n: s.n, avg: s.avg, t: s.t }; }
    const pl = [];
    for (let s = 1; s <= seeds; s++) { const ps = stream(T.bars, T.idx, placeboSigs(T.sigs, T.bars, s * 7919 + k.charCodeAt(1)), T.cost).filter(win.decisive), st = stats(ps); pl.push({ seed: s, n: st.n, avg: st.avg, t: st.t }); }
    const realT = o.windows.decisive.t ?? -Infinity, ts = pl.map((x) => x.t ?? -Infinity).sort((a, b) => a - b), avgs = pl.map((x) => x.avg).sort((a, b) => a - b);
    o.placebo = { seeds, atOrAboveRealT: pl.filter((x) => (x.t ?? -Infinity) >= realT).length, tMedian: ts[seeds >> 1], tMax: ts.at(-1), avgMedian: avgs[seeds >> 1], avgMin: avgs[0], avgMax: avgs.at(-1), runs: pl };
    o.medianRisk = +[...tr.map((x) => x.risk)].sort((a, b) => a - b)[tr.length >> 1].toFixed(4); o.medianCostR = +[...tr.map((x) => x.cost)].sort((a, b) => a - b)[tr.length >> 1].toFixed(3);
    out.tests[k] = o;
  }
  const keys = ['T1', 'T2', 'T3'], ps = keys.map((k) => { const t = out.tests[k].windows.decisive.t; return t == null ? 1 : pOne(t); }), adj = holm(ps);
  keys.forEach((k, i) => { const o = out.tests[k], d = o.windows.decisive, r = o.windows.replication;
    o.p = +ps[i].toFixed(4); o.pHolm = +adj[i].toFixed(4);
    o.checks = { netPositiveBoth: d.avg > 0 && r.avg > 0, holm: adj[i] < 0.05, n150: d.n >= 150 };
    o.pass = o.checks.netPositiveBoth && o.checks.holm && o.checks.n150; });
  out.verdict = keys.some((k) => out.tests[k].pass) ? 'PASS' : 'FAIL';
  out.passed = keys.filter((k) => out.tests[k].pass);
  return out;
}

function full(dir) {
  const B = load(dir, 'usb10y'), G = load(dir, 'xau'), J = load(dir, 'usdjpy');
  const span = (x) => ({ from: iso(x[0].time), to: iso(x.at(-1).time), candles: x.length });
  const res = analyse(B, G, J);
  const out = { built: new Date().toISOString().slice(0, 10), study: 'bond-lead-intraday', scope: 'Stand-alone research rule (item 44): not a gate, exit, entry or size of the live gold book. Paper only.',
    data: { src: 'OANDA mid M15 via the site candle proxy', usb10y: span(B), xau: span(G), usdjpy: span(J) }, params: P, split: '2016-01-01',
    costs: { gold: `$${GOLD_COST} a round trip`, usdjpy: '0.000045 x entry + 0.01 yen a round trip (commission 22.5 USD a million a side, half a 1-pip default spread of slippage on entry and exit, quoted spread 0)' },
    t3Rule: 'clock: signal candles starting at 08:30 or 10:00 New York on weekdays are excluded (council/events.mjs history starts only in 2022)', ...res };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.data)); console.log(JSON.stringify(out.signals));
  for (const [k, o] of Object.entries(out.tests)) { const { placebo, ...rest } = o; const { runs, ...pl } = placebo; console.log(k, JSON.stringify(rest), JSON.stringify(pl)); }
  console.log(out.verdict, out.passed);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
