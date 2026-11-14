// Gold's first new 20-day closing extreme after a stall without one (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-stall-drought/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-stall-drought/run.mjs full <dir>    runs the two tests, writes result.json and RESULT.md
// A new stand-alone daily rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { look: 20, K: 7, atrN: 14, stopAtr: 3, hold: 10, cost: 0.60, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', seeds: 40, needBeat: 38, pBar: 0.0228 };
export const TESTS = [
  { id: 'T1', name: 'follow the first new 20-day closing extreme after 7+ days without one, 10 days', sign: 1 },
  { id: 'T2', name: 'fade the first new 20-day closing extreme after 7+ days without one, 10 days', sign: -1 },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// +1 a new 20-day closing high, -1 a new 20-day closing low, 0 otherwise (strict, closes i-look .. i-1 only)
export function extremes(ds, look = P.look) {
  const e = new Array(ds.length).fill(0);
  for (let i = look; i < ds.length; i++) {
    let mx = -Infinity, mn = Infinity;
    for (let k = i - look; k < i; k++) { mx = Math.max(mx, ds[k].close); mn = Math.min(mn, ds[k].close); }
    e[i] = ds[i].close > mx ? 1 : ds[i].close < mn ? -1 : 0;
  }
  return e;
}

// signal days: a new extreme with at least K trading days strictly between it and the previous new extreme
export function signals(ds, K = P.K, look = P.look) {
  const e = extremes(ds, look), out = [];
  let last = null;
  for (let i = 0; i < ds.length; i++) {
    if (!e[i]) continue;
    if (last != null && i - last - 1 >= K) out.push({ i, dir: e[i], stall: i - last - 1 });
    last = i;
  }
  return out;
}

export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

// one trade from signal day i: entry at the open of i+1, stop 3 x ATR(14), out at the close of day i+hold or the stop
export function trade(ds, i, side, costMult = 1, hold = P.hold) {
  const e = i + 1, atr = atrAt(ds, i);
  if (!atr || e + hold - 1 >= ds.length) return null;
  const entry = ds[e].open, risk = P.stopAtr * atr, stop = entry - side * risk;
  let exit = null, xi = null, why = 'time', xt = null;
  for (let j = e; j <= e + hold - 1; j++) {
    const b = ds[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; xi = j; why = 'gap'; xt = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; xi = j; why = 'stop'; xt = b.time + D / 2; break; }
  }
  if (exit == null) { xi = e + hold - 1; exit = ds[xi].close; xt = ds[xi].time + D; }
  const R = (exit - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(ds[e].time, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { d: ymd(ds[e].time), si: i, ei: e, xi, side, entry, stop, exit, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

// a rule over signal days, one position at a time
export function run(ds, days, sideOf, costMult = 1) {
  const T = []; let busy = -1;
  for (const i of days) {
    if (i + 1 <= busy) continue;
    const tr = trade(ds, i, sideOf(i), costMult);
    if (!tr) continue;
    T.push(tr); busy = tr.xi;
  }
  return T;
}

const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), y = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x >= 0 ? 1 - y : y; };
export const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const sdv = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : 0; };

export function monthSums(T, from, to, key = 'net') {
  const m = {};
  for (let y = +from.slice(0, 4), mo = +from.slice(5, 7); `${y}-${String(mo).padStart(2, '0')}` <= to.slice(0, 7); mo === 12 ? (y++, mo = 1) : mo++) m[`${y}-${String(mo).padStart(2, '0')}`] = 0;
  for (const x of T) { const k = x.d.slice(0, 7); if (k in m) m[k] += x[key]; }
  return Object.values(m);
}
export function monthT(T, from, to, key = 'net') {
  const xs = monthSums(T, from, to, key), s = sdv(xs);
  return s > 0 ? mean(xs) / (s / Math.sqrt(xs.length)) : 0;
}
export function stats(T, from, to, key = 'net') {
  const n = T.length, xs = T.map((x) => x[key]), t = monthT(T, from, to, key);
  return { n, mean: r3(mean(xs)), total: +xs.reduce((a, b) => a + b, 0).toFixed(2), monthT: +t.toFixed(2), p: +(1 - Phi(t)).toFixed(4), win: n ? +(xs.filter((v) => v > 0).length / n).toFixed(3) : 0 };
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let m = 0;
  o.forEach(([p, i], k) => { m = Math.max(m, Math.min(1, p * (ps.length - k))); adj[i] = m; });
  return adj;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const inW = (from, to) => (x) => x.d >= from && x.d <= to;

// control: per OOS year and side, the test's trade count on random trading days of that year, one position at a time
export function control(ds, T, seed) {
  const rnd = mulberry32(seed), need = {};
  for (const x of T) { const k = `${x.d.slice(0, 4)}|${x.side}`; need[k] = (need[k] || 0) + 1; }
  const out = [];
  for (const [k, n] of Object.entries(need).sort()) {
    const [y, s] = k.split('|'), side = +s, pool = [];
    for (let i = P.atrN; i < ds.length - 1; i++) { const d = ymd(ds[i + 1].time); if (d.slice(0, 4) === y && d <= P.oosTo) pool.push(i); }
    for (let q = pool.length - 1; q > 0; q--) { const j = Math.floor(rnd() * (q + 1)); [pool[q], pool[j]] = [pool[j], pool[q]]; }
    let got = 0, tries = 0;
    for (const i of pool) {
      if (got >= n || tries > 5000) break; tries++;
      const tr = trade(ds, i, side);
      if (!tr) continue;
      if (out.some((x) => !(tr.xi < x.ei || tr.ei > x.xi))) continue;
      out.push(tr); got++;
    }
  }
  return out;
}

export function analyse(rows) {
  const ds = toDays(rows), IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo);
  const all = [];
  for (let i = P.atrN; i < ds.length; i++) all.push(i);
  const pool = (side, cm = 1) => all.map((i) => trade(ds, i, side, cm)).filter(Boolean);
  const base = { 1: pool(1), [-1]: pool(-1) }, base2 = { 1: pool(1, 2), [-1]: pool(-1, 2) };
  const bm = (b, side, f) => mean(b[side].filter(f).map((x) => x.net));
  const bmean = { is: { 1: bm(base, 1, IS), [-1]: bm(base, -1, IS) }, oos: { 1: bm(base, 1, OOS), [-1]: bm(base, -1, OOS) } };
  const bmean2 = { oos: { 1: bm(base2, 1, OOS), [-1]: bm(base2, -1, OOS) } };
  const addEx = (T, w, b = bmean) => T.forEach((x) => { x.ex = x.net - b[w][x.side]; });
  const out = { data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length }, baseline: {}, tests: {} };
  for (const s of [1, -1]) {
    const f = (w) => base[s].filter(w);
    out.baseline[s > 0 ? 'buy' : 'sell'] = { is: { n: f(IS).length, mean: r3(mean(f(IS).map((x) => x.net))), gross: r3(mean(f(IS).map((x) => x.R))) }, oos: { n: f(OOS).length, mean: r3(mean(f(OOS).map((x) => x.net))), gross: r3(mean(f(OOS).map((x) => x.R))), mean2x: r3(bmean2.oos[s]) } };
  }
  const sig = signals(ds), dirOf = new Map(sig.map((x) => [x.i, x.dir])), days = sig.map((x) => x.i);
  const cnt = (f) => sig.filter((x) => f({ d: ymd(ds[x.i + 1]?.time ?? ds[x.i].time) })).length;
  for (const tst of TESTS) {
    const sideOf = (i) => tst.sign * dirOf.get(i);
    const T = run(ds, days, sideOf), T2 = run(ds, days, sideOf, 2);
    const o = T.filter(OOS), iw = T.filter(IS), o2 = T2.filter(OOS);
    addEx(o, 'oos'); addEx(iw, 'is'); addEx(o2, 'oos', bmean2);
    const oNet = mean(o.map((x) => x.net));
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s), sides = new Map();
      const P_ = run(ds, o.map((x) => x.si), (i) => { if (!sides.has(i)) sides.set(i, rnd() < 0.5 ? 1 : -1); return sides.get(i); });
      pl.push(r3(mean(P_.map((x) => x.net))));
    }
    const ct = [];
    for (let s = 101; s <= 100 + P.seeds; s++) ct.push(r3(mean(control(ds, o, s).map((x) => x.net))));
    const years = {};
    for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    const sorted = (a) => [...a].sort((p, q) => p - q);
    const bySide = (A) => Object.fromEntries([[1, 'buy'], [-1, 'sell']].map(([s, k]) => { const a = A.filter((x) => x.side === s); return [k, { n: a.length, net: r3(mean(a.map((x) => x.net))), ex: r3(mean(a.map((x) => x.ex))) }]; }));
    out.tests[tst.id] = {
      name: tst.name, signals: { is: cnt(IS), oos: cnt(OOS) },
      is: stats(iw, P.isFrom, P.isTo), isGross: stats(iw, P.isFrom, P.isTo, 'R'), isEx: stats(iw, P.isFrom, P.isTo, 'ex'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'), oosEx: stats(o, P.oosFrom, P.oosTo, 'ex'),
      oos2x: stats(o2, P.oosFrom, P.oosTo), oos2xEx: stats(o2, P.oosFrom, P.oosTo, 'ex'),
      sides: { is: bySide(iw), oos: bySide(o) },
      costs: { costR: r3(o.reduce((s, x) => s + x.costR, 0)), finR: r3(o.reduce((s, x) => s + x.finR, 0)) },
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      placebo: { draws: pl, beaten: pl.filter((v) => oNet > v).length, median: sorted(pl)[P.seeds / 2], max: Math.max(...pl) },
      control: { draws: ct, beaten: ct.filter((v) => oNet > v).length, median: sorted(ct)[P.seeds / 2], max: Math.max(...ct) },
      years,
    };
  }
  const ids = TESTS.map((t) => t.id), adj = holm(ids.map((id) => out.tests[id].oosEx.p));
  out.checks = {};
  ids.forEach((id, k) => {
    const r = out.tests[id];
    const c = { holmP: +adj[k].toFixed(4), tHolm: r.oosEx.monthT >= 2 && adj[k] <= P.pBar, isExcess: r.isEx.mean > 0, cost2x: r.oos2x.mean > 0 && r.oos2xEx.mean > 0, placebo: r.placebo.beaten >= P.needBeat, control: r.control.beaten >= P.needBeat };
    c.pass = c.tHolm && c.isExcess && c.cost2x && c.placebo && c.control;
    out.checks[id] = c;
  });
  out.passed = ids.filter((id) => out.checks[id].pass);
  out.verdict = out.checks.T1.pass ? 'PASS' : 'FAIL';
  return out;
}

const f2 = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
const tt = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);

export function report(out) {
  const t1 = out.tests.T1, t2 = out.tests.T2, c1 = out.checks.T1;
  const head = out.verdict === 'PASS'
    ? `**Verdict: PASS: following the first new 20-day closing extreme after a 7-day stall beat the same-side every-day trade out of sample (excess ${f2(t1.oosEx.mean)}R, month t ${tt(t1.oosEx.monthT)}, n ${t1.oos.n}).**`
    : `**Verdict: FAIL, ${out.passed.length} of 2: following the first new 20-day closing extreme after a 7-day stall made ${f2(t1.oosEx.mean)}R a trade over the every-day trade 2017-26 (n ${t1.oos.n}, month t ${tt(t1.oosEx.monthT)}).**`;
  const L = [];
  L.push('# Result: gold\'s first new 20-day closing extreme after a stall without one (14 Nov 2026)', '', head, '');
  L.push('Pre-registered in `PREREGISTRATION.md` (pushed alone, before any trade was computed). The test ran once; nothing was changed');
  L.push('after the result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged');
  L.push('on 2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and reads none of its');
  L.push('positions. This page is written by `run.mjs` from `result.json`.', '');
  L.push('## Data and rule');
  L.push(`OANDA mid daily XAU_USD, council-data \`research/daily/xau.json\` (\`git show\`, no network), ${out.data.from} to ${out.data.to},`);
  L.push(`weekend candles folded into the next weekday (\`council/fills.mjs\` \`foldWeekend\`): ${out.data.days.toLocaleString('en-US')} trading days. Signal day = a close at a new`);
  L.push('20-day closing high or low with at least 7 trading days since the previous new 20-day closing extreme (the stall). Entry at the');
  L.push('next open; T1 follows the new extreme, T2 fades it. Stop 3 x ATR(14) (every trade has one), out at the close of the 10th day.');
  L.push('$0.60 a round trip, and on buys `nights` x `FIN.xau.long` (0.000148 a rollover) x entry; 2x doubles both. Excess = net R less the');
  L.push('same-side every-day trade\'s mean net R in the window. t on calendar-month sums of excess (every month counts), Holm over 2.', '');
  L.push('## Results', '');
  L.push('| Test | Window | n | Gross R | Net R | Every-day net (same side, mean) | Excess R | Excess t (months) | Net t (months) | Excess at 2x | Net at 2x |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [id, r] of [['T1', t1], ['T2', t2]]) {
    const nm = id === 'T1' ? 'T1 follow (primary)' : 'T2 fade';
    L.push(`| ${nm} | IS 2007-16 | ${r.is.n} | ${f2(r.isGross.mean)} | ${f2(r.is.mean)} | ${f2(r.is.mean - r.isEx.mean)} | ${f2(r.isEx.mean)} | ${tt(r.isEx.monthT)} | ${tt(r.is.monthT)} | — | — |`);
    L.push(`| | OOS 2017-26 | ${r.oos.n} | ${f2(r.oosGross.mean)} | ${f2(r.oos.mean)} | ${f2(r.oos.mean - r.oosEx.mean)} | ${f2(r.oosEx.mean)} | ${tt(r.oosEx.monthT)} | ${tt(r.oos.monthT)} | ${f2(r.oos2xEx.mean)} | ${f2(r.oos2x.mean)} |`);
  }
  L.push('', 'Every-day baselines (net R a trade): buy IS ' + f2(out.baseline.buy.is.mean) + ' (n ' + out.baseline.buy.is.n + '), OOS ' + f2(out.baseline.buy.oos.mean) + ' (n ' + out.baseline.buy.oos.n + '); sell IS ' + f2(out.baseline.sell.is.mean) + ' (n ' + out.baseline.sell.is.n + '), OOS ' + f2(out.baseline.sell.oos.mean) + ' (n ' + out.baseline.sell.oos.n + ').', '');
  L.push('| Test | OOS excess p | Holm p | Buys OOS (n, net, excess) | Sells OOS (n, net, excess) | Exits OOS (stop / gap / time) | Placebo beaten | Control beaten |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const id of ['T1', 'T2']) {
    const r = out.tests[id], c = out.checks[id], b = r.sides.oos.buy, s = r.sides.oos.sell;
    L.push(`| ${id} | ${r.oosEx.p} | ${c.holmP} | ${b.n}, ${f2(b.net)}, ${f2(b.ex)} | ${s.n}, ${f2(s.net)}, ${f2(s.ex)} | ${r.exits.stop} / ${r.exits.gap} / ${r.exits.time} | ${r.placebo.beaten} of 40 (median ${f2(r.placebo.median)}) | ${r.control.beaten} of 40 (median ${f2(r.control.median)}) |`);
  }
  L.push('', '## The pass bar, check by check (T1 decides the verdict)', '');
  for (const id of ['T1', 'T2']) {
    const c = out.checks[id], r = out.tests[id];
    L.push(`- **${id}**: excess month t >= 2 and Holm p <= 0.0228: ${c.tHolm ? 'yes' : 'no'} (t ${tt(r.oosEx.monthT)}, Holm p ${c.holmP}); IS excess > 0: ${c.isExcess ? 'yes' : 'no'} (${f2(r.isEx.mean)}); net and excess > 0 at 2x costs: ${c.cost2x ? 'yes' : 'no'}; placebo 38 of 40: ${c.placebo ? 'yes' : 'no'} (${r.placebo.beaten}); control 38 of 40: ${c.control ? 'yes' : 'no'} (${r.control.beaten}). ${c.pass ? 'PASS' : 'FAIL'}.`);
  }
  L.push('', '## By year (T1, net R)', '', '| Year | n | Net R |', '|---|---|---|');
  for (const [y, v] of Object.entries(t1.years)) L.push(`| ${y} | ${v.n} | ${v.net} |`);
  L.push('', '## Reading');
  L.push(out.verdict === 'PASS'
    ? 'The pre-registered bar is met on this one stretch of data. One window is not a proven edge: it would need its own replication on other data before any use.'
    : 'Not an edge. The count of days without a new 20-day closing extreme does not make the first new extreme after it a better trade than the same-side trade on any day, in either direction. Placebo = the same days with random sides; control = random days of the same year with the test\'s side mix (drift and volatility kept). Nothing live changed; no follow-up variant is proposed (any would need its own pre-registration on other data).');
  L.push('', '## Repeat', '`node research/edge/gold-stall-drought/run.mjs fetch <dir>` (git show, no network), then `… full <dir>`; delete `<dir>` afterwards.', '');
  return L.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  const f = path.join(dir, 'xau.json');
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(f, execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }));
    console.log('wrote', f);
  } else if (cmd === 'full') {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const out = { study: 'gold-stall-drought', built: '2026-11-14', params: P, tests: TESTS, ...analyse(j.rows) };
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(out));
    for (const id of Object.keys(out.tests)) { const r = out.tests[id]; console.log(id, JSON.stringify({ is: r.is, isEx: r.isEx, oos: r.oos, oosEx: r.oosEx, gross: r.oosGross.mean, x2: r.oos2x.mean, pl: r.placebo.beaten, ct: r.control.beaten, chk: out.checks[id] })); }
    console.log('baseline', JSON.stringify(out.baseline), 'verdict', out.verdict);
  }
}
