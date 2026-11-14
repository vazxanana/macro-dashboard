// Spot gold into and after the two Eids (research/edge/gold-eid-demand, PREREGISTRATION.md).
// Paper research; a standalone calendar study, not a gate, exit, entry or size of any gold-book system (owner item 44).
// Design, trade and helpers follow research/edge/gold-india-festivals; the primary measure is the excess over the same trade
// on every eligible day of the same year.
//   node run.mjs fetch <dir>   daily candles from council-data (git show, no network) + OANDA mid H1 through the site's proxy
//   node run.mjs full <dir>    runs the study and writes result.json + RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { financing, foldWeekend, FIN } from '../../../council/fills.mjs';
import { FITR, ADHA, SRC } from './dates.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, HOUR = 3600;
export const P = { RUN: 10, POST: 5, ATR_N: 20, STOP_ATR: 2, COST: 0.60, SEEDS: 40, SEEDS_NEED: 38, T_BAR: 2, ALPHA: 0.05,
  IS: [2007, 2016], OOS: [2017, 2026] };

// --- statistics ------------------------------------------------------------------------------------------------------------
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) : NaN; };
export const tOne = (a) => (a.length > 1 && sd(a) > 0 ? mean(a) / (sd(a) / Math.sqrt(a.length)) : NaN);
export function welch(a, b) {
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length;
  return { t: (mean(a) - mean(b)) / Math.sqrt(va + vb) };
}
function lgamma(x) { // Lanczos
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function ibeta(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export const pT = (t, df) => (Number.isFinite(t) && df > 0 ? ibeta(df / 2, 0.5, df / (df + t * t)) : NaN);
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// --- dates, windows, the trade ----------------------------------------------------------------------------------------------
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const yearOf = (bars, i) => +ymdOf(bars[i].time).slice(0, 4);
// ATR(n) of the n candles ending at index i (candles up to the entry day only)
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null; let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// index of the last bar with ymd < d (strict) or <= d
export function lastBefore(bars, d, orOn = false) { let lo = -1; for (let i = 0; i < bars.length; i++) { const y = ymdOf(bars[i].time); if (y < d || (orOn && y === d)) lo = i; else break; } return lo; }
// the run-up window [entry, exit] and the post window [entry, exit] of Eid date d (null where the candles do not cover it)
export function festWindows(bars, d, run = P.RUN, post = P.POST) {
  const Pi = lastBefore(bars, d), Fi = lastBefore(bars, d, true);
  const out = {};
  if (Pi >= 0 && Pi - run >= P.ATR_N && Pi < bars.length - 1) out.run = [Pi - run, Pi];
  if (Fi >= P.ATR_N && Fi + post < bars.length) out.post = [Fi, Fi + post];
  return out;
}
// first H1 index with time >= t
export function h1From(h1, t) { let lo = 0, hi = h1.length; while (lo < hi) { const m = (lo + hi) >> 1; if (h1[m].time < t) lo = m + 1; else hi = m; } return lo; }
// one trade from the close of bars[i0] to the close of bars[i1]; side 'buy' | 'sell'; stop 2 x ATR(20) checked on H1 candles
export function trade(bars, h1, i0, i1, side = 'buy', costMult = 1) {
  const a = atr(bars, i0); if (!a) return null;
  const s = side === 'buy' ? 1 : -1, entry = bars[i0].close, r0 = P.STOP_ATR * a, stop = entry - s * r0;
  const t0 = bars[i0].time + DAY, t1 = bars[i1].time + DAY;
  let exit = bars[i1].close, kind = 'close', closed = t1, exitT = bars[i1].time;
  for (let k = h1From(h1, t0); k < h1.length && h1[k].time + HOUR <= t1; k++) {
    const b = h1[k];
    if (s * (b.open - stop) <= 0) { exit = b.open; kind = 'gap'; closed = b.time; exitT = b.time; break; }
    if ((s > 0 && b.low <= stop) || (s < 0 && b.high >= stop)) { exit = stop; kind = 'stop'; closed = b.time + HOUR; exitT = b.time; break; }
  }
  const cost = costMult * P.COST, f = financing({ market: 'xau', side, entry, r0, filled: t0, closed });
  const move = s * (exit - entry), grossR = move / r0, netR = (move - cost) / r0 - f.finR;
  return { entryYmd: ymdOf(bars[i0].time), exitYmd: ymdOf(exitT), entry, exit, r0, grossPct: s * (exit - entry) / entry * 100,
    grossR, costR: cost / r0, finR: f.finR, nights: f.nights, netR, kind };
}
export const row = (bars, h1, w, side) => { const v = {}; for (const c of [0, 1, 2]) { const x = trade(bars, h1, w[0], w[1], side, c); if (!x) return null; v[`c${c}`] = x; } return v; };

// --- the study -------------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const inYears = (y, [a, b]) => y >= a && y <= b;
export function block(rows) {
  if (!rows.length) return { n: 0 };
  const net = rows.map((r) => r.c1.netR), gross = rows.map((r) => r.c1.grossR), ex = rows.map((r) => r.ex1), t = tOne(ex);
  return { n: rows.length, grossPct: r4(mean(rows.map((r) => r.c1.grossPct))), grossR: r4(mean(gross)), tGross: r4(tOne(gross)),
    costR: r4(mean(rows.map((r) => r.c1.costR))), finR: r4(mean(rows.map((r) => r.c1.finR))),
    netR: r4(mean(net)), tNet: r4(tOne(net)), netR2: r4(mean(rows.map((r) => r.c2.netR))),
    baseR: r4(mean(rows.map((r) => r.base1))), excessR: r4(mean(ex)), t: r4(t), p: r4(pT(t, rows.length - 1)),
    excessR2: r4(mean(rows.map((r) => r.ex2))), t2: r4(tOne(rows.map((r) => r.ex2))),
    won: r4(net.filter((x) => x > 0).length / net.length), beat: r4(ex.filter((x) => x > 0).length / ex.length),
    stops: rows.filter((r) => r.c1.kind !== 'close').length };
}
export const TESTS = {
  T1: { name: 'Eid al-Fitr run-up, long 10 trading days into the day before', eids: ['fitr'], win: 'run', side: 'buy', hold: P.RUN },
  T2: { name: 'Eid al-Adha run-up, long 10 trading days into the day before', eids: ['adha'], win: 'run', side: 'buy', hold: P.RUN },
  T3: { name: 'Post-Eid give-back, short 5 trading days after the Eid (both pooled)', eids: ['fitr', 'adha'], win: 'post', side: 'sell', hold: P.POST },
};
// ordinary holds of `hold` days, `side`, both ends in one calendar year, touching no day in `busy` (entry day excluded)
export function ordinary(bars, h1, hold, side, busy, years = [P.IS[0], P.OOS[1]]) {
  const ord = [];
  for (let i0 = P.ATR_N; i0 + hold < bars.length; i0++) {
    const y = yearOf(bars, i0 + hold); if (y < years[0] || y > years[1] || yearOf(bars, i0) !== y) continue;
    let ok = true; for (let i = i0 + 1; i <= i0 + hold; i++) if (busy.has(i)) { ok = false; break; }
    if (!ok) continue;
    const a = trade(bars, h1, i0, i0 + hold, side, 1); if (!a) continue;
    ord.push({ year: y, netR: a.netR, netR2: a.netR - P.COST / a.r0 });
  }
  return ord;
}
// the baseline of each year: mean net R (1x and 2x cost) of that year's ordinary holds
export function baselines(ord) {
  const by = {};
  for (const o of ord) (by[o.year] ||= []).push(o);
  return Object.fromEntries(Object.entries(by).map(([y, xs]) => [y, { n: xs.length, c1: mean(xs.map((x) => x.netR)), c2: mean(xs.map((x) => x.netR2)) }]));
}
export function study(bars, h1) {
  const evs = [];
  for (const [eid, list] of [['fitr', FITR], ['adha', ADHA]]) for (const d of list) evs.push({ eid, year: +d.slice(0, 4), date: d, w: festWindows(bars, d) });
  const missing = [];
  for (const e of evs) for (const w of ['run', 'post']) if (!e.w[w]) missing.push(`${e.eid} ${e.year} ${w}`);
  const tests = {}, placebo = {}, rows = {}, base = {};
  for (const [k, T] of Object.entries(TESTS)) {
    const mine = evs.filter((e) => T.eids.includes(e.eid) && e.w[T.win]);
    const busy = new Set(); for (const e of mine) { const w = e.w[T.win]; for (let i = w[0] + 1; i <= w[1]; i++) busy.add(i); }
    const ord = ordinary(bars, h1, T.hold, T.side, busy), B = baselines(ord);
    base[k] = Object.fromEntries(Object.entries(B).map(([y, b]) => [y, { n: b.n, netR: r4(b.c1), netR2: r4(b.c2) }]));
    rows[k] = mine.map((e) => {
      const r = row(bars, h1, e.w[T.win], T.side), b = B[e.year]; if (!r || !b) return null;
      return { year: e.year, eid: e.eid, date: e.date, ...r, base1: b.c1, ex1: r.c1.netR - b.c1, ex2: r.c2.netR - b.c2 };
    }).filter(Boolean);
    const split = (rs) => ({ is: block(rs.filter((r) => inYears(r.year, P.IS))), oos: block(rs.filter((r) => inYears(r.year, P.OOS))), all: block(rs) });
    tests[k] = { name: T.name, side: T.side, hold: T.hold, ordinary: ord.length, ...split(rows[k]) };
    const years = rows[k].filter((r) => inYears(r.year, P.OOS)).map((r) => r.year), seeds = [];
    for (let s = 1; s <= P.SEEDS; s++) { const R = rng(5400 + 100 * (+k.slice(1)) + s), xs = [];
      for (const y of years) { const pool = ord.filter((o) => o.year === y); if (pool.length) xs.push(pool[Math.floor(R() * pool.length)].netR - B[y].c1); }
      seeds.push(mean(xs)); }
    const real = tests[k].oos.excessR;
    placebo[k] = { seeds: P.SEEDS, need: P.SEEDS_NEED, events: years.length, realExcessR: real, beaten: seeds.filter((x) => real > x).length, seedExcessR: seeds.map(r4) };
  }
  const keys = Object.keys(TESTS), adj = holm(keys.map((k) => tests[k].oos.p));
  keys.forEach((k, i) => { tests[k].oos.holmP = r4(adj[i]); });
  const bar = {};
  for (const k of keys) { const T = tests[k];
    bar[k] = { tOos: T.oos.t >= P.T_BAR && T.oos.holmP < P.ALPHA, sameSign: Math.sign(T.is.excessR) === Math.sign(T.oos.excessR) && T.is.excessR !== 0,
      cost2: T.oos.netR2 > 0 && T.oos.excessR2 > 0, placebo: placebo[k].beaten >= P.SEEDS_NEED };
    bar[k].pass = Object.values(bar[k]).every(Boolean); }
  const verdict = keys.some((k) => bar[k].pass) ? 'PASS' : 'FAIL';
  return {
    built: '2026-11-14', study: 'gold-eid-demand', title: 'Spot gold into and after the two Eids (Eid al-Fitr, Eid al-Adha), against the same trade on every day of the year',
    verdict, headline: null, system: 'Research only (spot gold on calendar windows; not a gold-book system, owner item 44)',
    data: { src: 'OANDA mid daily candles (UTC days), council-data research/daily/xau.json (git show), weekend folded into Monday; stops on OANDA mid H1',
      first: ymdOf(bars[0].time), last: ymdOf(bars.at(-1).time), candles: bars.length, h1: h1.length, h1Last: ymdOf(h1.at(-1).time), missing },
    dates: { src: SRC, fitr: FITR, adha: ADHA },
    rule: { stopAtr: P.STOP_ATR, atrN: P.ATR_N, run: P.RUN, post: P.POST, cost: `$${P.COST.toFixed(2)} an ounce round trip`, financing: { rate: FIN.xau.long, src: FIN.xau.src, on: 'buys only' } },
    windows: { is: P.IS, oos: P.OOS }, tests, baselines: base, placebo, bar,
    trades: Object.entries(rows).flatMap(([k, rs]) => rs.map((r) => ({ test: k, eid: r.eid, year: r.year, date: r.date, entry: r.c1.entryYmd, exit: r.c1.exitYmd,
      grossPct: r4(r.c1.grossPct), grossR: r4(r.c1.grossR), netR: r4(r.c1.netR), baseR: r4(r.base1), excessR: r4(r.ex1), excessR2: r4(r.ex2), exitKind: r.c1.kind }))),
  };
}

// --- report ----------------------------------------------------------------------------------------------------------------
const f = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function headline(R) {
  const a = R.tests.T1.oos, b = R.tests.T2.oos, c = R.tests.T3.oos;
  return `${R.verdict === 'PASS' ? 'Passes' : 'Fails'}: out of sample 2017-26, over the same trade on every day of the year, the Eid al-Fitr run-up makes ${f(a.excessR)}R (n ${a.n}, t ${f(a.t, 2)}), Eid al-Adha ${f(b.excessR)}R (t ${f(b.t, 2)}), the post-Eid short ${f(c.excessR)}R (t ${f(c.t, 2)}).`;
}
export function verdictLine(R) {
  const a = R.tests.T1.oos, b = R.tests.T2.oos, c = R.tests.T3.oos, n = Object.values(R.bar).filter((x) => x.pass).length;
  const why = R.verdict === 'PASS' ? `${n} of 3 pass` : '0 of 3 pass';
  return `${R.verdict} (${why}): OOS excess over every-day trade: Fitr run-up ${f(a.excessR)}R (n ${a.n}, t ${f(a.t, 2)}), Adha ${f(b.excessR)}R (t ${f(b.t, 2)}), post-Eid short ${f(c.excessR)}R (t ${f(c.t, 2)}).`;
}
export function report(R) {
  const o = [], T = R.tests, B = R.bar, PL = R.placebo, K = ['T1', 'T2', 'T3'];
  o.push(`# Result: spot gold into and after the two Eids (${R.built})`, '');
  o.push(`**Verdict: ${verdictLine(R)}**`, '');
  o.push(`Judged on the pre-registered bar (PREREGISTRATION.md and \`dates.mjs\`, pushed alone before any candle was read). A standalone calendar study of one claim about physical demand around Eid al-Fitr and Eid al-Adha, **not** a gate, exit, entry or size of any gold-book system (owner item 44); the live book's positions were not read. Nothing live changed${R.verdict === 'PASS' ? '; a pass is a hypothesis for the owner, never a rule' : ' and no proposal follows'}.`, '');
  o.push(`Data: ${R.data.src}, ${R.data.first} to ${R.data.last} (H1 to ${R.data.h1Last}). Eid dates: \`dates.mjs\` (${R.dates.src}); all 40 kept. Windows the candles do not cover: ${R.data.missing.length ? R.data.missing.join(', ') : 'none'}. ` +
    `Stop ${R.rule.stopAtr} x ATR(${R.rule.atrN}) of the daily candles, checked on H1 (a gap fills at the open); cost ${R.rule.cost}; financing \`FIN.xau.long\` ${R.rule.financing.rate} of price a rollover on buys only. In sample ${R.windows.is.join('-')}, out of sample ${R.windows.oos.join('-')}. ` +
    `**Primary measure: excess R** = an event's net R minus the mean net R of every ordinary holding of the same length and side in the same calendar year (outside that test's windows), so gold's drift of the year is taken out. **10 events a window per Eid: low power**; a FAIL means "not shown", not "shown absent".`, '');
  o.push('## The three tests', '', '| Test, window | n | gross R | gross t | cost R | financing R | net R | net t | year baseline R | **excess R** | **excess t** | p (OOS: Holm) | excess R 2x | net R 2x | beat baseline | stops |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of K) for (const [w, lab] of [['is', 'in sample'], ['oos', 'out of sample'], ['all', 'whole']]) { const x = T[k][w];
    o.push(`| ${k} ${T[k].name}, ${lab} | ${x.n} | ${f(x.grossR)} | ${f(x.tGross, 2)} | ${f(x.costR)} | ${f(x.finR)} | ${f(x.netR)} | ${f(x.tNet, 2)} | ${f(x.baseR)} | ${f(x.excessR)} | ${f(x.t, 2)} | ${x.holmP != null ? x.holmP.toFixed(3) : x.p.toFixed(3)} | ${f(x.excessR2)} | ${f(x.netR2)} | ${(x.beat * 100).toFixed(0)} % | ${x.stops} |`); }
  o.push('', '## Pass bar (each test on its own)', '', '| Test | OOS excess t >= 2 and Holm p < 0.05 | IS excess same sign | OOS net R and excess R positive at 2x cost | above >= 38 of 40 placebo seeds | passes |', '|---|---|---|---|---|---|');
  const yn = (v) => (v ? 'yes' : 'no');
  for (const k of K) o.push(`| ${k} | ${yn(B[k].tOos)} (t ${f(T[k].oos.t, 2)}, Holm p ${T[k].oos.holmP}) | ${yn(B[k].sameSign)} (IS ${f(T[k].is.excessR)}R, OOS ${f(T[k].oos.excessR)}R) | ${yn(B[k].cost2)} (net ${f(T[k].oos.netR2)}R, excess ${f(T[k].oos.excessR2)}R) | ${yn(B[k].placebo)} (${PL[k].beaten}) | ${yn(B[k].pass)} |`);
  o.push('', '## Placebo', '', '| Test | OOS events | real OOS excess R | seeds beaten (of 40) | seed means |', '|---|---|---|---|---|');
  for (const k of K) o.push(`| ${k} | ${PL[k].events} | ${f(PL[k].realExcessR)} | ${PL[k].beaten} | ${f(Math.min(...PL[k].seedExcessR))} to ${f(Math.max(...PL[k].seedExcessR))} |`);
  o.push('', 'Per seed, one random ordinary holding (same length, side and year, outside that test\'s windows) per out-of-sample event, its excess over the year baseline by the same formula.', '');
  o.push('## Each event (R per trade)', '', '| Eid | year | date | test | entry → exit | gross R | net R | year baseline | excess R | exit |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const t of [...R.trades].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.test < b.test ? -1 : 1)))
    o.push(`| ${t.eid === 'fitr' ? 'Eid al-Fitr' : 'Eid al-Adha'} | ${t.year} | ${t.date} | ${t.test} | ${t.entry} → ${t.exit} | ${f(t.grossR, 2)} | ${f(t.netR, 2)} | ${f(t.baseR, 2)} | ${f(t.excessR, 2)} | ${t.exitKind} |`);
  o.push('', '## Reading', '');
  for (const k of K) { const x = T[k];
    o.push(`- ${k} ${x.name}: excess ${f(x.is.excessR)}R a trade in sample (n ${x.is.n}, t ${f(x.is.t, 2)}), ${f(x.oos.excessR)}R out of sample (n ${x.oos.n}, t ${f(x.oos.t, 2)}, Holm p ${x.oos.holmP}); raw net ${f(x.oos.netR)}R out of sample; above ${PL[k].beaten} of 40 placebo seeds.`); }
  if (T.T3.is.excessR < 0 && T.T3.oos.excessR < 0) o.push(`- The post-Eid short lost in both windows: gold did better than its usual 5-day hold after the Eids (whole-sample excess of the short ${f(T.T3.all.excessR)}R, t ${f(T.T3.all.t, 2)}, n ${T.T3.all.n}). That is the opposite of the claim, seen after the fact; a long after the Eids was not pre-registered here and is not a finding.`);
  o.push('- The raw net R of a long window carries the year\'s drift (gold rose in most years); the excess column is the measure this study is judged on.');
  o.push('- One event a year per Eid: ten out-of-sample observations cannot show a modest effect. Paper only; never call this an edge without its n and t.');
  o.push('', 'To repeat: `node --use-env-proxy research/edge/gold-eid-demand/run.mjs fetch <dir>` (daily candles by git show from `origin/council-data`, H1 through the candle proxy; keep `<dir>` out of git), then `… full <dir>`. Test: `tests/gold-eid-demand.test.mjs`.');
  return o.join('\n') + '\n';
}
// --- CLI -------------------------------------------------------------------------------------------------------------------
export const loadBars = (rows) => foldWeekend(rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c })));
export const loadH1 = (rows) => rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c })).sort((a, b) => a.time - b.time);
async function fetchH1(out) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sec = HOUR, m = new Map();
  const from = Date.parse('2006-03-01T00:00:00Z') / 1000, to = Math.floor(Date.now() / 1000 / DAY) * DAY;
  for (let a = from; a < to;) {
    const b = Math.min(to, a + 4999 * sec); let j = null;
    for (let k = 0; k < 5 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) }); const x = r.ok ? await r.json() : null; if (x && Array.isArray(x.bars)) j = x; } catch { /* retry */ }
      if (!j) await new Promise((r) => setTimeout(r, 1500 * (k + 1)));
    }
    if (!j) throw new Error(`H1 ${ymdOf(a)}: no answer`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b;
  }
  fs.writeFileSync(out, JSON.stringify([...m.values()].sort((p, q) => p[0] - q[0])));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 }));
    const h = path.join(dir, 'xau-h1.json'); if (!fs.existsSync(h)) await fetchH1(h);
    console.log('fetched into', dir);
  } else if (cmd === 'full') {
    const R = study(loadBars(JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8')).rows), loadH1(JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8'))));
    R.headline = headline(R);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict, R.headline, JSON.stringify(R.bar), JSON.stringify(Object.fromEntries(Object.entries(R.placebo).map(([k, v]) => [k, v.beaten]))), JSON.stringify(R.data.missing));
  } else console.log('usage: node run.mjs fetch <dir> | full <dir>');
}
