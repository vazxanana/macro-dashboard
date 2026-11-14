// Spot gold after an emerging-market currency stress day (research/edge/gold-em-fx-stress, PREREGISTRATION.md).
// Paper research; a stand-alone rule on gold, not a gate, exit, entry or size of any gold-book system (owner item 44).
//   node run.mjs fetch <dir>   the four daily files from council-data (git show, no network); keep <dir> out of git
//   node run.mjs full <dir>    runs the study and writes result.json + RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { financing, foldWeekend, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
export const FX = ['usdzar', 'usdmxn', 'usdtry'];
export const P = { LOOK: 60, Z: 1.5, ATR_N: 20, STOP_ATR: 2, COST: 0.60, SEEDS: 40, SEEDS_NEED: 38, T_BAR: 2, ALPHA: 0.05,
  IS: [2007, 2016], OOS: [2017, 2026], LAST: '2026-10-31' };
export const TESTS = {
  T1: { name: 'buy at the next open, out after 5 candles (forced selling reverses)', side: 'buy', hold: 5 },
  T2: { name: 'sell at the next open, out after 1 candle (liquidation goes on)', side: 'sell', hold: 1 },
  T3: { name: 'buy at the next open, out after 20 candles (slower haven bid)', side: 'buy', hold: 20 },
};

// --- statistics ------------------------------------------------------------------------------------------------------------
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) : NaN; };
export const tOne = (a) => (a.length > 1 && sd(a) > 0 ? mean(a) / (sd(a) / Math.sqrt(a.length)) : NaN);
function lgamma(x) {
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
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// t of calendar-month sums (months with at least one trade)
export function monthT(rows, key) {
  const by = new Map(); for (const r of rows) { const m = r.entryYmd.slice(0, 7); by.set(m, (by.get(m) || 0) + r[key]); }
  const sums = [...by.values()]; return { months: sums.length, t: tOne(sums) };
}

// --- the trigger -----------------------------------------------------------------------------------------------------------
// basket move per day (time -> mean log change of the three currencies against their own previous candle; all three needed)
export function basketMoves(fxBars) {
  const maps = fxBars.map((b) => { const m = new Map(); for (let i = 1; i < b.length; i++) m.set(b[i].time, Math.log(b[i].close / b[i - 1].close)); return m; });
  const out = [];
  for (const t of [...maps[0].keys()].sort((a, b) => a - b)) { const v = maps.map((m) => m.get(t)); if (v.every((x) => x != null && Number.isFinite(x))) out.push({ time: t, move: mean(v) }); }
  return out;
}
// z of each day = its move / sd of the LOOK moves before it (nothing of that day or later)
export function zScores(moves, look = P.LOOK) {
  const z = new Map();
  for (let i = look; i < moves.length; i++) { const s = sd(moves.slice(i - look, i).map((x) => x.move)); if (s > 0) z.set(moves[i].time, moves[i].move / s); }
  return z;
}

// --- the trade -------------------------------------------------------------------------------------------------------------
// ATR(n) of the n candles ending at index i
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null; let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// signal on candle i (its close known); entry at the open of i+1; stop 2 x ATR(20) up to i, checked from i+1 on daily candles
// (an open beyond the stop fills at that open, else a touch fills at the stop); out at the close of candle i+hold
export function trade(bars, i, side, hold, costMult = 1) {
  if (i + hold >= bars.length) return null;
  const a = atr(bars, i); if (!a) return null;
  const s = side === 'buy' ? 1 : -1, entry = bars[i + 1].open, r0 = P.STOP_ATR * a, stop = entry - s * r0;
  let exit = bars[i + hold].close, kind = 'close', k1 = i + hold, closed = bars[i + hold].time + DAY;
  for (let k = i + 1; k <= i + hold; k++) {
    const b = bars[k];
    if (s * (b.open - stop) <= 0) { exit = b.open; kind = 'gap'; k1 = k; closed = b.time; break; }
    if ((s > 0 && b.low <= stop) || (s < 0 && b.high >= stop)) { exit = stop; kind = 'stop'; k1 = k; closed = b.time + DAY / 2; break; }
  }
  const f = financing({ market: 'xau', side, entry, r0, filled: bars[i + 1].time, closed });
  const move = s * (exit - entry), cost = costMult * P.COST;
  return { entryYmd: ymdOf(bars[i + 1].time), exitYmd: ymdOf(bars[k1].time), exitIdx: k1, entry, exit, r0, grossR: move / r0,
    costR: cost / r0, finR: costMult * f.finR, nights: f.nights, netR: (move - cost) / r0 - costMult * f.finR, kind };
}

// --- the study -------------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const yearOfYmd = (y) => +y.slice(0, 4);
const inYears = (y, [a, b]) => y >= a && y <= b;
export function signals(bars, z) {
  const stress = [], ordinary = [];
  for (let i = P.ATR_N; i < bars.length - 1; i++) { const v = z.get(bars[i].time); if (v == null) continue; (v >= P.Z ? stress : ordinary).push(i); }
  return { stress, ordinary };
}
// one position at a time: a stress day whose entry candle is not after the open trade's exit candle is skipped
export function taken(bars, stress, side, hold) {
  const out = []; let busyTo = -1, skipped = 0;
  for (const i of stress) {
    if (i + 1 <= busyTo) { skipped++; continue; }
    const c1 = trade(bars, i, side, hold, 1), c2 = trade(bars, i, side, hold, 2); if (!c1) continue;
    if (c1.entryYmd > P.LAST) continue;
    out.push({ i, signalYmd: ymdOf(bars[i].time), entryYmd: c1.entryYmd, year: yearOfYmd(c1.entryYmd), c1, c2 }); busyTo = c1.exitIdx;
  }
  return { rows: out, skipped };
}
export function baselines(bars, ordinary, side, hold) {
  const by = {}, pool = {};
  for (const i of ordinary) {
    const c1 = trade(bars, i, side, hold, 1); if (!c1 || c1.entryYmd > P.LAST) continue;
    const c2 = trade(bars, i, side, hold, 2), y = yearOfYmd(c1.entryYmd);
    (by[y] ||= []).push([c1.netR, c2.netR]); (pool[y] ||= []).push(i);
  }
  const B = Object.fromEntries(Object.entries(by).map(([y, xs]) => [y, { n: xs.length, c1: mean(xs.map((x) => x[0])), c2: mean(xs.map((x) => x[1])) }]));
  return { B, pool };
}
export function block(rows) {
  if (!rows.length) return { n: 0 };
  const net = rows.map((r) => r.c1.netR), gross = rows.map((r) => r.c1.grossR), ex = rows.map((r) => r.ex1);
  const mt = monthT(rows, 'ex1'), mn = monthT(rows, 'net1');
  return { n: rows.length, months: mt.months, grossR: r4(mean(gross)), tGross: r4(tOne(gross)), costR: r4(mean(rows.map((r) => r.c1.costR))),
    finR: r4(mean(rows.map((r) => r.c1.finR))), netR: r4(mean(net)), tNet: r4(mn.t), netR2: r4(mean(rows.map((r) => r.c2.netR))),
    baseR: r4(mean(rows.map((r) => r.base1))), excessR: r4(mean(ex)), t: r4(mt.t), p: r4(pT(mt.t, mt.months - 1)),
    excessR2: r4(mean(rows.map((r) => r.ex2))), won: r4(net.filter((x) => x > 0).length / net.length),
    stops: rows.filter((r) => r.c1.kind !== 'close').length };
}
export function study(bars, fxBars) {
  const moves = basketMoves(fxBars), z = zScores(moves), { stress, ordinary } = signals(bars, z);
  const tests = {}, placebo = {}, rows = {}, base = {};
  for (const [k, T] of Object.entries(TESTS)) {
    const { B, pool } = baselines(bars, ordinary, T.side, T.hold), tk = taken(bars, stress, T.side, T.hold);
    base[k] = Object.fromEntries(Object.entries(B).map(([y, b]) => [y, { n: b.n, netR: r4(b.c1), netR2: r4(b.c2) }]));
    rows[k] = tk.rows.filter((r) => B[r.year]).map((r) => ({ ...r, base1: B[r.year].c1, ex1: r.c1.netR - B[r.year].c1, ex2: r.c2.netR - B[r.year].c2,
      net1: r.c1.netR, gross1: r.c1.grossR }));
    const split = (rs) => ({ is: block(rs.filter((r) => inYears(r.year, P.IS))), oos: block(rs.filter((r) => inYears(r.year, P.OOS))), all: block(rs.filter((r) => inYears(r.year, [P.IS[0], P.OOS[1]]))) });
    tests[k] = { name: T.name, side: T.side, hold: T.hold, stressDays: stress.length, skipped: tk.skipped, ...split(rows[k]) };
    // placebo: per OOS year as many random ordinary entry days as trades taken that year
    const per = {}; for (const r of rows[k]) if (inYears(r.year, P.OOS)) per[r.year] = (per[r.year] || 0) + 1;
    const seeds = [];
    for (let s = 1; s <= P.SEEDS; s++) {
      const R = rng(6000 + 100 * (+k.slice(1)) + s), xs = [];
      for (const [y, n] of Object.entries(per)) { const pl = pool[y]; if (!pl) continue;
        for (let j = 0; j < n; j++) { const i = pl[Math.floor(R() * pl.length)], c = trade(bars, i, T.side, T.hold, 1); xs.push({ entryYmd: c.entryYmd, ex1: c.netR - B[y].c1 }); } }
      seeds.push(monthT(xs, 'ex1').t);
    }
    const real = tests[k].oos.t;
    placebo[k] = { seeds: P.SEEDS, need: P.SEEDS_NEED, events: tests[k].oos.n, realT: real, beaten: seeds.filter((x) => real > x).length, seedT: seeds.map(r4) };
  }
  const keys = Object.keys(TESTS), adj = holm(keys.map((k) => tests[k].oos.p));
  keys.forEach((k, i) => { tests[k].oos.holmP = r4(adj[i]); });
  const bar = {};
  for (const k of keys) { const T = tests[k];
    bar[k] = { tOos: T.oos.t >= P.T_BAR && T.oos.holmP < P.ALPHA, sameSign: T.is.excessR > 0 && T.oos.excessR > 0,
      cost2: T.oos.netR2 > 0 && T.oos.excessR2 > 0, placebo: placebo[k].beaten >= P.SEEDS_NEED };
    bar[k].pass = Object.values(bar[k]).every(Boolean); }
  const verdict = bar.T1.pass ? 'PASS' : 'FAIL';
  const zs = [...z.values()];
  return {
    built: '2026-11-14', study: 'gold-em-fx-stress', title: 'Spot gold after an emerging-market currency stress day (rand, peso, lira), against the same trade after every ordinary day',
    verdict, headline: null, system: 'Research only (spot gold after a currency stress day; not a gold-book system, owner item 44)',
    data: { src: 'OANDA mid daily candles (UTC days), council-data research/daily/{xau,usdzar,usdmxn,usdtry}.json (git show), weekend folded into Monday',
      first: ymdOf(bars[0].time), last: ymdOf(bars.at(-1).time), candles: bars.length, basketDays: moves.length, zDays: zs.length,
      stressDays: stress.length, stressShare: r4(stress.length / (stress.length + ordinary.length)) },
    rule: { look: P.LOOK, z: P.Z, stopAtr: P.STOP_ATR, atrN: P.ATR_N, cost: `$${P.COST.toFixed(2)} an ounce round trip`,
      financing: { rate: FIN.xau.long, src: FIN.xau.src, on: 'buys only' }, stopBar: 'daily candles; a stop day closes at mid-day for financing' },
    windows: { is: P.IS, oos: P.OOS, last: P.LAST }, tests, baselines: base, placebo, bar,
    trades: Object.entries(rows).flatMap(([k, rs]) => rs.map((r) => ({ test: k, signal: r.signalYmd, entry: r.c1.entryYmd, exit: r.c1.exitYmd,
      grossR: r4(r.c1.grossR), netR: r4(r.c1.netR), baseR: r4(r.base1), excessR: r4(r.ex1), exitKind: r.c1.kind }))),
  };
}

// --- report ----------------------------------------------------------------------------------------------------------------
const f = (x, d = 3) => (x == null || !Number.isFinite(x) ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function verdictLine(R) {
  const a = R.tests.T1.oos, n = Object.values(R.bar).filter((x) => x.pass).length;
  return `${R.verdict}, ${n} of 3: after a rand / peso / lira stress day the 5-day gold buy makes ${f(a.excessR)}R a trade over the same buy on ordinary days, out of sample 2017-26 (n ${a.n}, month t ${f(a.t, 2)})`;
}
export const headline = (R) => verdictLine(R) + '.';
export function report(R) {
  const o = [], T = R.tests, B = R.bar, PL = R.placebo, K = Object.keys(TESTS);
  o.push(`# Result: spot gold after an emerging-market currency stress day (${R.built})`, '');
  o.push(`**Verdict: ${verdictLine(R)}.**`, '');
  o.push(`Judged on the pre-registered bar ([PREREGISTRATION.md](PREREGISTRATION.md), pushed alone before any gold outcome was computed). Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed${R.verdict === 'PASS' ? '; a pass is a hypothesis for the owner, never a rule' : '; no proposal is written'}.`, '');
  o.push('## What was tested', '');
  o.push(`- Data: ${R.data.src}; gold ${R.data.first} to ${R.data.last} (${R.data.candles} candles).`);
  o.push(`- Trigger: the mean daily log change of USD/ZAR, USD/MXN and USD/TRY divided by the standard deviation of its previous ${R.rule.look} values; a **stress day** is z >= ${R.rule.z} (${R.data.stressDays} of ${R.data.zDays} scored days, ${(R.data.stressShare * 100).toFixed(1)} %).`);
  o.push(`- Trade: entry at the next gold open, stop ${R.rule.stopAtr} x ATR(${R.rule.atrN}) checked on ${R.rule.stopBar}, out at the close of the hold's last candle; one position at a time; cost ${R.rule.cost}; financing \`FIN.xau.long\` ${R.rule.financing.rate} of price a rollover on buys only.`);
  o.push(`- **Excess R** = a trade's net R minus the mean net R of the same trade after every ordinary (non-stress) day of the same calendar year; t on calendar-month sums; Holm over the three tests; in sample ${R.windows.is.join('-')}, out of sample ${R.windows.oos[0]} to ${R.windows.last}.`, '');
  o.push('## The three tests', '', '| Test, window | n | months | gross R | gross t | cost R | financing R | net R | net t | year baseline R | **excess R** | **excess t** | p (OOS: Holm) | net R 2x | excess R 2x | won | stops |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of K) for (const [w, lab] of [['is', 'in sample'], ['oos', 'out of sample'], ['all', 'whole']]) { const x = T[k][w];
    o.push(`| ${k} ${T[k].name}, ${lab} | ${x.n} | ${x.months} | ${f(x.grossR)} | ${f(x.tGross, 2)} | ${f(x.costR)} | ${f(x.finR)} | ${f(x.netR)} | ${f(x.tNet, 2)} | ${f(x.baseR)} | ${f(x.excessR)} | ${f(x.t, 2)} | ${x.holmP != null ? x.holmP.toFixed(3) : x.p.toFixed(3)} | ${f(x.netR2)} | ${f(x.excessR2)} | ${(x.won * 100).toFixed(0)} % | ${x.stops} |`); }
  o.push('', `Stress days skipped by the one-position rule: ${K.map((k) => `${k} ${T[k].skipped}`).join(', ')}. gross t is per trade; net t and excess t are on calendar-month sums.`, '');
  o.push('## Pass bar (T1 decides the verdict)', '', '| Test | OOS excess t >= 2 and Holm p < 0.05 | IS and OOS excess positive | OOS net R and excess R > 0 at 2x costs | beats >= 38 of 40 placebo seeds | passes |', '|---|---|---|---|---|---|');
  const yn = (v) => (v ? 'yes' : 'no');
  for (const k of K) o.push(`| ${k} | ${yn(B[k].tOos)} (t ${f(T[k].oos.t, 2)}, Holm p ${T[k].oos.holmP}) | ${yn(B[k].sameSign)} (IS ${f(T[k].is.excessR)}R, OOS ${f(T[k].oos.excessR)}R) | ${yn(B[k].cost2)} (net ${f(T[k].oos.netR2)}R, excess ${f(T[k].oos.excessR2)}R) | ${yn(B[k].placebo)} (${PL[k].beaten}) | ${yn(B[k].pass)} |`);
  o.push('', '## Placebo', '', '| Test | OOS trades | real OOS excess t | seeds beaten (of 40) | seed t range |', '|---|---|---|---|---|');
  for (const k of K) o.push(`| ${k} | ${PL[k].events} | ${f(PL[k].realT, 2)} | ${PL[k].beaten} | ${f(Math.min(...PL[k].seedT), 2)} to ${f(Math.max(...PL[k].seedT), 2)} |`);
  o.push('', 'Per seed, as many random ordinary entry days per out-of-sample year as the test took trades that year, the same trade and the same month-sum t of excess.', '');
  o.push('## Reading', '');
  for (const k of K) { const x = T[k];
    o.push(`- ${k} ${x.name}: excess ${f(x.is.excessR)}R a trade in sample (n ${x.is.n}, t ${f(x.is.t, 2)}), ${f(x.oos.excessR)}R out of sample (n ${x.oos.n}, t ${f(x.oos.t, 2)}, Holm p ${x.oos.holmP}); raw net ${f(x.oos.netR)}R out of sample (t ${f(x.oos.tNet, 2)}); beats ${PL[k].beaten} of 40 placebo seeds.`); }
  for (const k of K) { const x = T[k].oos;
    if (x.t >= P.T_BAR && !B[k].tOos) o.push(`- ${k} is a near miss: out-of-sample month t ${f(x.t, 2)} clears 2 before the correction for three tests but not after (Holm p ${x.holmP} >= 0.05), so it fails bar 1; its in-sample excess (${f(T[k].is.excessR)}R, t ${f(T[k].is.t, 2)}) is much smaller. A hypothesis at most, for a new pre-registration on other data.`);
    if (x.t <= -P.T_BAR) o.push(`- ${k} went the other way out of sample (month t ${f(x.t, 2)}): seen after the fact, not a pre-registered claim, and not a finding.`); }
  o.push('- The raw net R of a buy carries gold\'s drift of the year (it rose in most years of 2017-26); the excess column is what the study is judged on.');
  o.push('- Stops are checked on daily candles (stop first on a candle that touches it), coarser than an hourly check; the same rule is applied to the baseline trades, so the excess is like for like.');
  o.push('- Paper only; never call this an edge without its n and t.');
  o.push('', 'To repeat: `node research/edge/gold-em-fx-stress/run.mjs fetch <dir>` (the four daily files by git show from `origin/council-data`; keep `<dir>` out of git), then `… full <dir>`. Test: `tests/gold-em-fx-stress.test.mjs`.');
  return o.join('\n') + '\n';
}

// --- CLI -------------------------------------------------------------------------------------------------------------------
export const loadBars = (rows) => foldWeekend(rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c })));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of ['xau', ...FX]) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir);
  } else if (cmd === 'full') {
    const rd = (k) => loadBars(JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')).rows);
    const R = study(rd('xau'), FX.map(rd));
    R.headline = headline(R);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict, R.headline, JSON.stringify(R.bar), JSON.stringify(Object.fromEntries(Object.entries(R.placebo).map(([k, v]) => [k, v.beaten]))));
    for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ is: R.tests[k].is, oos: R.tests[k].oos }));
  } else console.log('usage: node run.mjs fetch <dir> | full <dir>');
}
