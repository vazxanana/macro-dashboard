// A limit at the midpoint of a wide gold day, traded with that day's direction (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-wide-day-half/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-wide-day-half/run.mjs full <dir>    runs the three tests, writes result.json and RESULT.md
// A new stand-alone daily rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 14, wide: 1.25, loc: 2 / 3, wait: 3, stopAtr: 1.5, hold: 5, cost: 0.60, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', half: '2022-01-01', seeds: 40, needBeat: 38 };
export const TESTS = [
  { id: 'T1', name: 'buy the midpoint after a wide up day, hold 5 days', sides: [1] },
  { id: 'T2', name: 'sell the midpoint after a wide down day, hold 5 days', sides: [-1] },
  { id: 'T3', name: 'both sides pooled, one position at a time, hold 5 days', sides: [1, -1] },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// ATR(n) at day i = mean true range of days i-n+1 .. i; null without enough history
export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

// +1 wide up day, -1 wide down day, 0 otherwise; uses day i and the 14 days before only
export function wideSide(ds, i) {
  const a = atrAt(ds, i - 1);
  if (a == null) return 0;
  const b = ds[i], rg = b.high - b.low;
  if (!(rg >= P.wide * a) || rg <= 0) return 0;
  const cl = (b.close - b.low) / rg;
  return cl >= P.loc ? 1 : cl <= 1 - P.loc ? -1 : 0;
}

export function signals(ds, sides) {
  const out = [];
  for (let i = 1; i < ds.length; i++) { const s = wideSide(ds, i); if (s && sides.includes(s)) out.push({ i, side: s }); }
  return out;
}

// the limit at the wide day's midpoint, days i+1 .. i+wait; { j, px } or null (not filled, or the data ends)
export function fillOf(ds, i, side) {
  const mid = (ds[i].high + ds[i].low) / 2;
  for (let j = i + 1; j <= i + P.wait && j < ds.length; j++) {
    const b = ds[j];
    if (side > 0 ? b.open <= mid : b.open >= mid) return { j, px: b.open };
    if (side > 0 ? b.low <= mid : b.high >= mid) return { j, px: mid };
  }
  return null;
}

// one trade entered at price px on day e (atr from day si), stop 1.5 x ATR, out at the close of day e+hold-1 or the stop
export function tradeAt(ds, si, e, px, side, costMult = 1, fillAtOpen = false) {
  const atr = atrAt(ds, si);
  if (!atr || e + P.hold - 1 >= ds.length) return null;
  const entry = px, risk = P.stopAtr * atr, stop = entry - side * risk;
  let exit = null, xi = null, why = 'time', xt = null;
  for (let j = e; j <= e + P.hold - 1; j++) {
    const b = ds[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; xi = j; why = 'gap'; xt = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; xi = j; why = 'stop'; xt = b.time + D / 2; break; }
  }
  if (exit == null) { xi = e + P.hold - 1; exit = ds[xi].close; xt = ds[xi].time + D; }
  const ft = fillAtOpen ? ds[e].time : ds[e].time + D / 2;
  const R = (exit - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(ft, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { d: ymd(ds[e].time), si, ei: e, xi, side, entry, stop, exit, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

// the rule: wide days in order, one limit or position at a time
export function run(ds, sigs, costMult = 1) {
  const T = []; let busy = -1, waitTo = -1, filled = 0, expired = 0;
  for (const { i, side } of sigs) {
    if (i <= busy || i <= waitTo) continue;
    const f = fillOf(ds, i, side);
    if (!f) { if (i + P.wait < ds.length) { expired++; waitTo = i + P.wait; } continue; }
    const tr = tradeAt(ds, i, f.j, f.px, side, costMult);
    if (!tr) continue;
    filled++; T.push(tr); busy = tr.xi; waitTo = f.j;
  }
  T.filled = filled; T.expired = expired;
  return T;
}

// market entry at the open of day i+1 (baseline and placebo)
export function runOpen(ds, days, sideOf, costMult = 1) {
  const T = []; let busy = -1;
  for (const i of days) {
    if (i + 1 <= busy) continue;
    const tr = tradeAt(ds, i, i + 1, ds[i + 1] ? ds[i + 1].open : NaN, sideOf(i, T.length), costMult, true);
    if (!tr) continue;
    T.push(tr); busy = tr.xi;
  }
  return T;
}

const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), y = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x >= 0 ? 1 - y : y; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
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

// net R a trade of a same-side every-day baseline, per calendar year
export function yearMeans(B) {
  const y = {};
  for (const x of B) { const k = x.d.slice(0, 4); (y[k] = y[k] || []).push(x.net); }
  return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, mean(v)]));
}
export const withExcess = (T, base) => T.map((x) => ({ ...x, ex: x.net - (base[x.side][x.d.slice(0, 4)] ?? 0) }));

export function analyse(rows) {
  const ds = toDays(rows), IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo);
  const H1 = inW(P.oosFrom, '2021-12-31'), H2 = inW(P.half, P.oosTo);
  const all = ds.map((_, i) => i).filter((i) => atrAt(ds, i) != null && i + 1 < ds.length);
  const oosDays = all.filter((i) => ymd(ds[i + 1].time) >= P.oosFrom && ymd(ds[i + 1].time) <= P.oosTo);
  const out = { data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length }, baseline: {}, tests: {} };
  const base = {};
  for (const side of [1, -1]) {
    const b = runOpen(ds, all, () => side), key = side > 0 ? 'buy' : 'sell';
    base[side] = yearMeans(b);
    out.baseline[key] = { is: stats(b.filter(IS), P.isFrom, P.isTo), oos: stats(b.filter(OOS), P.oosFrom, P.oosTo), oosGross: stats(b.filter(OOS), P.oosFrom, P.oosTo, 'R'), byYear: Object.fromEntries(Object.entries(base[side]).map(([k, v]) => [k, r3(v)])) };
  }
  for (const tst of TESTS) {
    const sigs = signals(ds, tst.sides), T0 = run(ds, sigs), T = withExcess(T0, base), T2 = run(ds, sigs, 2);
    const o = T.filter(OOS), years = {};
    for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    const buyShare = o.length ? o.filter((x) => x.side > 0).length / o.length : 0;
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s), pick = new Set();
      while (pick.size < Math.min(o.length, oosDays.length)) pick.add(oosDays[Math.floor(rnd() * oosDays.length)]);
      const sideRnd = mulberry32(1000 + s), sideOf = tst.sides.length === 1 ? () => tst.sides[0] : () => (sideRnd() < buyShare ? 1 : -1);
      const P_ = runOpen(ds, [...pick].sort((a, b) => a - b), sideOf);
      pl.push(r3(mean(P_.map((x) => x.net))));
    }
    out.tests[tst.id] = {
      name: tst.name, wideDays: sigs.length, wideIs: sigs.filter((x) => ymd(ds[x.i].time) >= P.isFrom && ymd(ds[x.i].time) <= P.isTo).length,
      wideOos: sigs.filter((x) => ymd(ds[x.i].time) >= P.oosFrom && ymd(ds[x.i].time) <= P.oosTo).length,
      filled: T0.filled, expired: T0.expired,
      is: stats(T.filter(IS), P.isFrom, P.isTo), isGross: stats(T.filter(IS), P.isFrom, P.isTo, 'R'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'),
      oos2x: stats(T2.filter(OOS), P.oosFrom, P.oosTo),
      half1: stats(T.filter(H1), P.oosFrom, '2021-12-31'), half2: stats(T.filter(H2), P.half, P.oosTo),
      excess: { oos: stats(o, P.oosFrom, P.oosTo, 'ex'), is: stats(T.filter(IS), P.isFrom, P.isTo, 'ex') },
      costs: { costR: r3(o.reduce((s, x) => s + x.costR, 0)), finR: r3(o.reduce((s, x) => s + x.finR, 0)) },
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      placebo: { draws: pl, beaten: pl.filter((v) => mean(o.map((x) => x.net)) > v).length, median: [...pl].sort((a, b) => a - b)[P.seeds / 2], max: Math.max(...pl) },
      years,
    };
  }
  const ids = TESTS.map((t) => t.id), adj = holm(ids.map((id) => out.tests[id].oos.p));
  out.checks = {};
  ids.forEach((id, k) => {
    const r = out.tests[id];
    const c = { oosPositive: r.oos.mean > 0, holmP: +adj[k].toFixed(4), tHolm: r.oos.monthT >= 2 && adj[k] <= 0.0228, isAndHalves: r.is.mean > 0 && r.half1.mean > 0 && r.half2.mean > 0, cost2x: r.oos2x.mean > 0, excess: r.excess.oos.mean > 0 && r.excess.oos.monthT >= 2, placebo: r.placebo.beaten >= P.needBeat };
    c.pass = c.oosPositive && c.tHolm && c.isAndHalves && c.cost2x && c.excess && c.placebo;
    out.checks[id] = c;
  });
  out.passed = ids.filter((id) => out.checks[id].pass);
  out.verdict = out.passed.length ? 'PASS' : 'FAIL';
  return out;
}

const f3 = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
export function verdictLine(r) {
  const g = r.gold, t1 = g.tests.T1, best = Math.max(...Object.values(g.tests).map((x) => x.oos.monthT));
  return `**Verdict: ${r.verdict}: ${g.passed.length} of 3 tests pass; buying the midpoint of a wide up day made ${f3(t1.oos.mean)}R a trade net in 2017-26 (n ${t1.oos.n}, month t ${t1.oos.monthT.toFixed(2)}); best OOS t ${best.toFixed(2)}.**`;
}
export function row(id, g, c) {
  return `| ${id} | ${g.is.n} | ${f3(g.isGross.mean)} | ${f3(g.is.mean)} | ${g.is.monthT.toFixed(2)} | ${g.oos.n} | ${f3(g.oosGross.mean)} | ${f3(g.oos.mean)} | ${g.oos.monthT.toFixed(2)} | ${c.holmP} | ${f3(g.oos2x.mean)} | ${f3(g.excess.oos.mean)} | ${g.excess.oos.monthT.toFixed(2)} | ${g.placebo.beaten} of 40 | ${c.pass ? 'yes' : 'no'} |`;
}
export function report(r) {
  const g = r.gold, L = [];
  L.push('# Result: a limit at the midpoint of a wide gold day, traded with that day\'s direction (14 Nov 2026)', '', verdictLine(r), '');
  L.push('Pre-registered in PREREGISTRATION.md (pushed alone first). The test ran once; nothing was changed after the result. Paper research:',
    'nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on 2017-26; it is not a gate,',
    'exit, entry or size of the gold book (Gold trend / Gold daily engulf) and says nothing about it. This page is written by',
    '`run.mjs` from `result.json`.', '');
  L.push('## Data and rule', `OANDA mid daily XAU_USD, council-data \`research/daily/xau.json\` (git show, no network), ${g.data.from} to ${g.data.to}, weekend`,
    `candles folded into the next weekday (\`foldWeekend\`): ${g.data.days.toLocaleString('en-US')} trading days. A wide day: range >= 1.25 x ATR(14) of the 14 days`,
    'before, close in the outer third in its direction. A limit at the wide day\'s midpoint, live three days; filled at the open',
    'when the day opens through it. Stop 1.5 x ATR(14) from the fill, out at the close of the 5th day held. One position or',
    'waiting limit at a time. Costs $0.60 a round trip plus `FIN.xau.long` financing on buys (`nights` x 0.000148 of price).',
    't = calendar-month sums (every month counts), one-sided, Holm over three. Excess = each trade\'s net R minus the same-side',
    'every-day baseline\'s net R a trade in the same year (baseline: market at the open, same stop and hold).', '');
  L.push('## The three tests (R a trade)', '',
    '| Test | IS n | IS gross | IS net | IS t | OOS n | OOS gross | OOS net | OOS t | Holm p | OOS net 2x | Excess | Excess t | Placebo beaten | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const id of ['T1', 'T2', 'T3']) L.push(row(id, g.tests[id], g.checks[id]));
  L.push('');
  for (const id of ['T1', 'T2', 'T3']) {
    const t = g.tests[id];
    L.push(`- **${id}** (${t.name}): ${t.wideDays} wide days, ${t.filled} limits filled, ${t.expired} expired unfilled. OOS halves ${f3(t.half1.mean)} / ${f3(t.half2.mean)}R;`,
      `  exits stop ${t.exits.stop}, gap ${t.exits.gap}, time ${t.exits.time}; OOS costs ${t.costs.costR}R spread + ${t.costs.finR}R financing; placebo median ${f3(t.placebo.median)}, max ${f3(t.placebo.max)}.`);
  }
  L.push('', '## Baseline (same side, every day, market at the open)', '',
    `- Buy: IS ${f3(g.baseline.buy.is.mean)}R (n ${g.baseline.buy.is.n}), OOS ${f3(g.baseline.buy.oos.mean)}R (n ${g.baseline.buy.oos.n}, t ${g.baseline.buy.oos.monthT.toFixed(2)}).`,
    `- Sell: IS ${f3(g.baseline.sell.is.mean)}R (n ${g.baseline.sell.is.n}), OOS ${f3(g.baseline.sell.oos.mean)}R (n ${g.baseline.sell.oos.n}, t ${g.baseline.sell.oos.monthT.toFixed(2)}).`, '');
  L.push('## Reading', '', r.verdict === 'PASS'
    ? 'A test met every line of the pre-registered bar. This is a paper finding only; any use needs the owner (absolute rule 3).'
    : 'No test met the pre-registered bar. Not an edge; never use the wide-day midpoint as a gold entry on this evidence.',
  '', `Counts: the pre-registration counted fills before the one-at-a-time rule (143 / 144 up, 165 / 137 down); after it T1 has ${g.tests.T1.is.n} / ${g.tests.T1.oos.n}`,
  `trades and T2 ${g.tests.T2.is.n} / ${g.tests.T2.oos.n} (in / out of sample), so T1 sits just under 100 a window.`,
  r.gold.tests.T2.oos.monthT <= -2 ? `T2 lost clearly out of sample (t ${g.tests.T2.oos.monthT.toFixed(2)}); its mirror (buying after a wide down day) was not pre-registered and is not a finding.` : '', '');
  return L.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 }));
  } else if (cmd === 'full') {
    const xau = JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8'));
    const out = { built: '2026-11-14', params: P, tests: TESTS, costs: '$0.60 a round trip + FIN.xau.long financing on buys (council/fills.mjs); 2x = both doubled', src: `OANDA daily XAU_USD via council-data research/daily/xau.json (updated ${xau.updated})`, gold: analyse(xau.rows) };
    out.verdict = out.gold.verdict;
    out.headline = verdictLine(out).replace(/^\*\*Verdict: /, '').replace(/\*\*$/, '');
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(out));
    const g = out.gold, brief = {};
    for (const [id, r] of Object.entries(g.tests)) brief[id] = { wide: r.wideDays, filled: r.filled, is: r.is, isG: r.isGross, oos: r.oos, oosG: r.oosGross, x2: r.oos2x.mean, h1: r.half1.mean, h2: r.half2.mean, ex: r.excess.oos, pl: { beaten: r.placebo.beaten, median: r.placebo.median, max: r.placebo.max } };
    console.log(JSON.stringify({ data: g.data, brief, checks: g.checks, verdict: out.verdict, line: verdictLine(out) }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
