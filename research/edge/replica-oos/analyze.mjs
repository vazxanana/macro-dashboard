// Edge research · replica-oos: statistics of the replay (replay.mjs -> trades.json).
//   node analyze.mjs <trades.json>  -> result.json on stdout, tables on stderr
// One row per position (the first unit plus its add, sized as live). R is net of costs, per unit of size:
//   x1     = 0.30 a round trip per unit (the gold spread; what the council replay that showed +0.88R charged)
//   fills  = council/fills.mjs tradeCost: the spread plus half a spread of slippage on the market entry and on any exit that is not
//            the target (0.45-0.60 a unit)
//   x2     = 0.60 a round trip per unit (costs doubled)
// Max drawdown is on the closed-position equity curve (by close time). Bootstrap: 10,000 resamples of the positions (iid) and of
// calendar months (block), 95% percentile interval of R a trade.
import fs from 'node:fs';
import { tradeCost } from '../../../council/fills.mjs';

const J = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const GOLD = { spot: true, group: 'Metals' };
const COSTS = {
  x1: () => 0.30,
  fills: (l) => tradeCost({ entry: l.entry, r0: l.r0, entryMode: 'market', exitKind: l.exitKind, status: 'closed' }, GOLD).costR * l.r0,
  x2: () => 0.60,
  gross: () => 0,
};
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
const rows = (cost, flat = false) => J.positions.map((p) => ({ T: p.T, c: Math.max(...p.legs.map((l) => l.closed)),
  R: p.legs.reduce((a, l) => a + (l.R - COSTS[cost](l) / l.r0) * (flat ? l.size / p.size0 : l.size), 0) }));

function stats(a) {
  const n = a.length; if (!n) return { n: 0 };
  const v = a.map((x) => x.R), sum = v.reduce((p, x) => p + x, 0), mean = sum / n, sd = Math.sqrt(v.reduce((p, x) => p + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0; for (const x of a.slice().sort((p, q) => p.c - q.c)) { eq += x.R; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const r = (x, k = 3) => +x.toFixed(k);
  return { n, win: r(v.filter((x) => x > 0).length / n), exp: r(mean), R: r(sum, 1), t: r(sd > 0 ? mean / sd * Math.sqrt(n) : 0, 2), maxDD: r(dd, 1) };
}
// seeded PRNG so the intervals are reproducible
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function boot(a, B = 10000) {
  if (a.length < 5) return null;
  const v = a.map((x) => x.R), n = v.length, rnd = rng(486), m = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += v[Math.floor(rnd() * n)]; m.push(s / n); }
  // block bootstrap by calendar month (losses cluster in time)
  const byM = new Map(); for (const x of a) { const k = new Date(x.T * 1000).toISOString().slice(0, 7); (byM.get(k) || byM.set(k, []).get(k)).push(x.R); }
  const blocks = [...byM.values()], nb = blocks.length, mb = [];
  for (let b = 0; b < B; b++) { let s = 0, c = 0; for (let i = 0; i < nb; i++) { const bl = blocks[Math.floor(rnd() * nb)]; for (const x of bl) s += x; c += bl.length; } mb.push(s / c); }
  const q = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return +s[Math.floor(p * (s.length - 1))].toFixed(3); };
  return { iid: [q(m, 0.025), q(m, 0.975)], pLE0: +(m.filter((x) => x <= 0).length / B).toFixed(4), month: [q(mb, 0.025), q(mb, 0.975)], pLE0month: +(mb.filter((x) => x <= 0).length / B).toFixed(4), months: nb };
}
const span = (a, y0, y1) => a.filter((x) => yearOf(x.T) >= y0 && yearOf(x.T) <= y1);

const OOS = [2017, 2022], IS = [2023, 2026], out = { from: J.from, to: J.to, costs: Object.keys(COSTS), periods: {} };
for (const cost of Object.keys(COSTS)) {
  const a = rows(cost), P = (out.periods[cost] = {});
  P.oos = stats(span(a, ...OOS)); P.is = stats(span(a, ...IS)); P.all = stats(a);
  P.oosHalves = { '2017-2019': stats(span(a, 2017, 2019)), '2020-2022': stats(span(a, 2020, 2022)) };
  P.isHalves = { '2023-2024': stats(span(a, 2023, 2024)), '2025-2026': stats(span(a, 2025, 2026)) };
  P.years = Object.fromEntries([...Array(10)].map((_, i) => 2017 + i).map((y) => [y, stats(span(a, y, y))]));
  if (cost !== 'gross') { P.bootOos = boot(span(a, ...OOS)); P.bootIs = boot(span(a, ...IS)); }
}
// out-of-sample vs in-sample R a trade (Welch t, 0.30 cost)
{ const a = rows('x1'), o = span(a, ...OOS).map((x) => x.R), i = span(a, ...IS).map((x) => x.R);
  const mv = (v) => { const m = v.reduce((p, x) => p + x, 0) / v.length; return [m, v.reduce((p, x) => p + (x - m) ** 2, 0) / (v.length - 1)]; };
  const [mo, vo] = mv(o), [mi, vi] = mv(i); out.welchIsMinusOos = { diff: +(mi - mo).toFixed(3), t: +((mi - mo) / Math.sqrt(vo / o.length + vi / i.length)).toFixed(2) }; }
// without the size rules (every position at size 1, its add at 1.5): does the edge sit in the signals or in the sizing?
{ const a = rows('x1', true); out.flatSize = { oos: stats(span(a, ...OOS)), is: stats(span(a, ...IS)) }; }

// signal level: every v5 signal as one independent unit with the live exits, no gate and no risk rules (0.30 cost)
const solo = J.solo.map((s) => ({ T: s.T, c: Math.max(...s.legs.map((l) => l.closed)), R: s.legs.reduce((a, l) => a + (l.R - 0.30 / l.r0) * l.size, 0), d1w: s.d1w, volOk: s.volOk, news: s.news, msnr: s.msnr }));
const cell = (f) => ({ oos: stats(span(solo.filter(f), ...OOS)), is: stats(span(solo.filter(f), ...IS)) });
out.signals = {
  'v5, all': cell(() => true),
  'v5 + D1 with': cell((s) => s.d1w),
  'v5 + D1 with + gate open (the live filter, no risk rules)': cell((s) => s.d1w && s.volOk && !s.news),
  'v5 + D1 with + gate shut': cell((s) => s.d1w && !s.volOk),
  'v5 + D1 against + gate open': cell((s) => !s.d1w && s.volOk),
};
// how often the gate was open, by year (share of v5 signals that met it)
out.gateOpen = Object.fromEntries([...Array(10)].map((_, i) => 2017 + i).map((y) => { const s = J.signals.filter((x) => x.v5 && yearOf(x.T) === y); return [y, s.length ? +(s.filter((x) => x.volOk).length / s.length).toFixed(2) : null]; }));
// why v5 + D1-with signals inside the gate were not taken (OOS)
{ const s = J.signals.filter((x) => x.v5 && x.d1w && x.volOk && yearOf(x.T) <= OOS[1]);
  out.blockedOos = { candidates: s.length, news: s.filter((x) => x.news).length, stale: s.filter((x) => x.stale).length, capped: s.filter((x) => x.capped).length, dayStop: s.filter((x) => x.dayStop).length }; }
// exits of the positions' first units (OOS)
{ const L = J.positions.filter((p) => yearOf(p.T) <= OOS[1]).map((p) => p.legs.find((l) => !l.add)); out.exitsOos = {}; for (const l of L) out.exitsOos[l.exitKind] = (out.exitsOos[l.exitKind] || 0) + 1;
  out.addsOos = J.positions.filter((p) => yearOf(p.T) <= OOS[1] && p.legs.some((l) => l.add)).length; }
out.sizeOos = {}; for (const p of J.positions.filter((p) => yearOf(p.T) <= OOS[1])) out.sizeOos[p.size0] = (out.sizeOos[p.size0] || 0) + 1;
// sensitivity: a second replay (argv[3], e.g. D1_WEEKDAYS=1) at 0.30 cost
if (process.argv[3]) {
  const J2 = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const a = J2.positions.map((p) => ({ T: p.T, c: Math.max(...p.legs.map((l) => l.closed)), R: p.legs.reduce((s, l) => s + (l.R - 0.30 / l.r0) * l.size, 0) }));
  out.sensitivityD1Weekdays = { oos: stats(span(a, ...OOS)), is: stats(span(a, ...IS)), years: Object.fromEntries([...Array(10)].map((_, i) => 2017 + i).map((y) => [y, stats(span(a, y, y))])) };
}
// cross-check: the same live rule on HistData spot M1 (research/edge/gold-systems, full-history trends, weekday D1)
try { const g = JSON.parse(fs.readFileSync(new URL('../gold-systems/replica.json', import.meta.url), 'utf8')).variants.live;
  out.histdataLive = { s2019_22: g.s2019_22, years: Object.fromEntries(Object.entries(g.years).map(([y, s]) => [y, { n: s.n, exp: s.exp, R: s.R }])) }; } catch (e) {}
console.log(JSON.stringify(out, null, 1));

// ─── tables ───
const f = (s) => s.n ? `${String(s.n).padStart(4)} | ${(s.win * 100).toFixed(0).padStart(3)}% | ${(s.exp >= 0 ? '+' : '') + s.exp.toFixed(3)} | ${(s.R >= 0 ? '+' : '') + s.R.toFixed(1)} | ${s.t.toFixed(2)} | ${s.maxDD.toFixed(1)}` : '   0 |';
const P = out.periods;
console.error('period | n | win | R/trade | total R | t | maxDD   (x1 = 0.30 a unit)');
for (const y of Object.keys(P.x1.years)) console.error(`${y} | ${f(P.x1.years[y])} || fills ${P.fills.years[y].exp ?? '-'} | x2 ${P.x2.years[y].exp ?? '-'}`);
for (const [k, s] of [['OOS 2017-22', 'oos'], ['IS 2023-26', 'is']]) console.error(`${k} | ${f(P.x1[s])} || fills ${f(P.fills[s])} || x2 ${f(P.x2[s])} || gross ${P.gross[s].exp}`);
for (const [k, s] of Object.entries(P.x1.oosHalves)) console.error(`${k} | ${f(s)} || x2 ${P.x2.oosHalves[k].exp}`);
for (const [k, s] of Object.entries(P.x1.isHalves)) console.error(`${k} | ${f(s)}`);
console.error('boot OOS x1', JSON.stringify(P.x1.bootOos), 'x2', JSON.stringify(P.x2.bootOos));
console.error('boot IS x1', JSON.stringify(P.x1.bootIs));
console.error('flat size', JSON.stringify(out.flatSize));
for (const [k, v] of Object.entries(out.signals)) console.error(`${k}: OOS ${f(v.oos)} | IS ${f(v.is)}`);
console.error('gate open', JSON.stringify(out.gateOpen), 'blocked', JSON.stringify(out.blockedOos), 'exits', JSON.stringify(out.exitsOos), 'adds', out.addsOos, 'sizes', JSON.stringify(out.sizeOos));
