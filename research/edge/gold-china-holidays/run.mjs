// Spot gold around the Shanghai Gold Exchange's long Chinese holidays (research/edge/gold-china-holidays, PREREGISTRATION.md).
// Paper research; a standalone calendar study, not a gate, exit, entry or size of any gold-book system (owner item 44).
//   node run.mjs fetch <dir>   copies council-data research/daily/xau.json into <dir> (git show, no network)
//   node run.mjs full <dir>    runs the study and writes result.json + RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { financing, foldWeekend, FIN } from '../../../council/fills.mjs';
import { LNY, GOLDEN, DROPPED } from './dates.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
export const P = { PRE: 10, POST: 5, ATR_N: 20, STOP_ATR: 3, COST: 0.60, SEEDS: 40, SEEDS_NEED: 36, T_BAR: 2, ALPHA: 0.05,
  IS: [2008, 2016], OOS: [2017, 2026] };

// --- statistics ------------------------------------------------------------------------------------------------------------
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) : NaN; };
export const tOne = (a) => (a.length > 1 && sd(a) > 0 ? mean(a) / (sd(a) / Math.sqrt(a.length)) : NaN);
export function welch(a, b) {
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length;
  return { t: (mean(a) - mean(b)) / Math.sqrt(va + vb), df: (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1)) };
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
// two-sided p of a t with df degrees of freedom
export const pT = (t, df) => (Number.isFinite(t) && df > 0 ? ibeta(df / 2, 0.5, df / (df + t * t)) : NaN);
export function holm(ps) { // adjusted p, same order
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// --- the windows and the trade ---------------------------------------------------------------------------------------------
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// ATR(n): mean true range of the n candles ending at index i (candles up to the entry only)
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null; let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// index of the last bar with ymd < d
export function lastBefore(bars, d) { let lo = -1; for (let i = 0; i < bars.length; i++) { if (ymdOf(bars[i].time) < d) lo = i; else break; } return lo; }
// the three windows of one closure, as [entry index, exit index] on the folded candles (null if the data does not cover it)
export function windows(bars, ev, pre = P.PRE, post = P.POST) {
  const L = lastBefore(bars, ev.first), B = lastBefore(bars, ev.reopen);
  if (L < 0 || L - pre < P.ATR_N || B <= L) return null;
  const out = { pre: [L - pre, L], shut: [L, B] };
  if (B + post < bars.length && ymdOf(bars[B + 1].time) >= ev.reopen) out.post = [B, B + post];
  return out;
}
// one long trade from the close of bars[i0] to the close of bars[i1], stop 3 x ATR(20) below, cost in $ an ounce
export function trade(bars, i0, i1, costMult = 1) {
  const a = atr(bars, i0); if (!a) return null;
  const entry = bars[i0].close, r0 = P.STOP_ATR * a, stop = entry - r0;
  let exit = bars[i1].close, kind = 'close', k1 = i1, closed = bars[i1].time + DAY;
  for (let k = i0 + 1; k <= i1; k++) {
    const b = bars[k];
    if (b.open <= stop) { exit = b.open; kind = 'gap'; k1 = k; closed = b.time; break; }
    if (b.low <= stop) { exit = stop; kind = 'stop'; k1 = k; closed = b.time + DAY / 2; break; }
  }
  const cost = costMult * P.COST, f = financing({ market: 'xau', side: 'buy', entry, r0, filled: bars[i0].time + DAY, closed });
  const grossR = (exit - entry) / r0, netR = (exit - entry - cost) / r0 - f.finR;
  return { entryYmd: ymdOf(bars[i0].time), exitYmd: ymdOf(bars[k1].time), days: k1 - i0, entry, exit, r0, grossPct: (exit - entry) / entry * 100,
    grossR, costR: cost / r0, finR: f.finR, nights: f.nights, netR, kind };
}
const row = (bars, w) => { const v = {}; for (const c of [0, 1, 2]) { const x = trade(bars, w[0], w[1], c); if (!x) return null; v[`c${c}`] = x; } return v; };

// --- the study -------------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const inYears = (y, [a, b]) => y >= a && y <= b;
function block(rows) {
  if (!rows.length) return { n: 0 };
  const net = rows.map((r) => r.c1.netR), gross = rows.map((r) => r.c1.grossR), t = tOne(net);
  return { n: rows.length, grossPct: r4(mean(rows.map((r) => r.c1.grossPct))), grossR: r4(mean(gross)), tGross: r4(tOne(gross)),
    costR: r4(mean(rows.map((r) => r.c1.costR))), finR: r4(mean(rows.map((r) => r.c1.finR))),
    netR: r4(mean(net)), t: r4(t), p: r4(pT(t, rows.length - 1)), netR2: r4(mean(rows.map((r) => r.c2.netR))), t2: r4(tOne(rows.map((r) => r.c2.netR))),
    won: r4(net.filter((x) => x > 0).length / net.length), stops: rows.filter((r) => r.c1.kind !== 'close').length, totalR: r4(net.reduce((x, y) => x + y, 0)) };
}
export function study(bars) {
  const evs = [];
  for (const [kind, list] of [['lny', LNY], ['golden', GOLDEN]]) for (const ev of list) {
    const w = windows(bars, ev); evs.push({ kind, ev, w });
  }
  const missing = evs.filter((e) => !e.w || !e.w.post).map((e) => `${e.kind} ${e.ev.year}${e.w ? ' (post)' : ''}`);
  // every trading-day index used by any holiday window (entry excluded, held days included)
  const busy = new Set();
  for (const e of evs) if (e.w) for (const k of ['pre', 'shut', 'post']) if (e.w[k]) for (let i = e.w[k][0] + 1; i <= e.w[k][1]; i++) busy.add(i);
  const rowsOf = (kind, win) => evs.filter((e) => e.kind === kind && e.w && e.w[win]).map((e) => {
    const r = row(bars, e.w[win]); return r && { year: e.ev.year, kind, win, first: e.ev.first, reopen: e.ev.reopen, ...r };
  }).filter(Boolean);
  const S = { lnyPre: rowsOf('lny', 'pre'), lnyShut: rowsOf('lny', 'shut'), lnyPost: rowsOf('lny', 'post') };
  const gw = ['pre', 'shut', 'post'].flatMap((w) => rowsOf('golden', w));
  const split = (rows) => ({ is: block(rows.filter((r) => inYears(r.year, P.IS))), oos: block(rows.filter((r) => inYears(r.year, P.OOS))), all: block(rows) });
  const tests = { T1: { name: 'Lunar New Year, 10 days before the closure (claim a)', ...split(S.lnyPre) },
    T2: { name: 'Lunar New Year, while Shanghai is shut (claim b predicts <= 0)', ...split(S.lnyShut) },
    T3: { name: 'Lunar New Year, 5 days after the reopening (claim c)', ...split(S.lnyPost) },
    T4: { name: 'Golden Week, the three windows pooled (secondary)', ...split(gw),
      byWindow: Object.fromEntries(['pre', 'shut', 'post'].map((w) => [w, split(gw.filter((r) => r.win === w))])) } };
  const adj = holm(['T1', 'T2', 'T3', 'T4'].map((k) => tests[k].oos.p));
  ['T1', 'T2', 'T3', 'T4'].forEach((k, i) => { tests[k].oos.holmP = r4(adj[i]); });
  // ordinary 10-day windows: every 10-trading-day hold whose held days touch no holiday window, years 2008-2026
  const ord = [];
  for (let i0 = P.ATR_N; i0 + P.PRE < bars.length; i0++) {
    const y = +ymdOf(bars[i0 + P.PRE].time).slice(0, 4), y0 = +ymdOf(bars[i0 + 1].time).slice(0, 4); if (y < 2008 || y > 2026 || y0 !== y) continue;
    let ok = true; for (let i = i0 + 1; i <= i0 + P.PRE; i++) if (busy.has(i)) { ok = false; break; }
    if (!ok) continue; const r = trade(bars, i0, i0 + P.PRE, 1); if (r) ord.push({ year: y, netR: r.netR, grossR: r.grossR });
  }
  const welchOf = (yrs) => { const a = S.lnyPre.filter((r) => inYears(r.year, yrs)).map((r) => r.c1.netR), b = ord.filter((r) => inYears(r.year, yrs)).map((r) => r.netR);
    const w = welch(a, b); return { n: a.length, ordinary: b.length, ordinaryNetR: r4(mean(b)), t: r4(w.t) }; };
  const vsOrdinary = { is: welchOf(P.IS), oos: welchOf(P.OOS) };
  // placebo: per seed, one random ordinary window per out-of-sample event year
  const years = S.lnyPre.filter((r) => inYears(r.year, P.OOS)).map((r) => r.year), seeds = [];
  for (let s = 1; s <= P.SEEDS; s++) { const R = rng(s), xs = [];
    for (const y of years) { const pool = ord.filter((o) => o.year === y); if (pool.length) xs.push(pool[Math.floor(R() * pool.length)].netR); }
    seeds.push(mean(xs)); }
  const real = tests.T1.oos.netR, beaten = seeds.filter((x) => real > x).length;
  const T1 = tests.T1, bar = {
    tOos: T1.oos.t >= P.T_BAR && T1.oos.holmP < P.ALPHA, sameSign: T1.is.netR > 0 && T1.oos.netR > 0, cost2: T1.oos.netR2 > 0, placebo: beaten >= P.SEEDS_NEED };
  const verdict = Object.values(bar).every(Boolean) ? 'PASS' : 'FAIL';
  return {
    built: '2026-11-14', study: 'gold-china-holidays', title: 'Spot gold around the Shanghai Gold Exchange\'s long Chinese holidays',
    verdict, headline: null, system: 'Research only (long spot gold on calendar windows; not a gold-book system, owner item 44)',
    data: { src: 'OANDA mid daily candles (UTC days), council-data research/daily/xau.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend)',
      first: ymdOf(bars[0].time), last: ymdOf(bars.at(-1).time), candles: bars.length, missing, dropped: DROPPED },
    dates: { lny: LNY, golden: GOLDEN, checked: [...LNY, ...GOLDEN].filter((e) => e.src === 'checked').map((e) => e.first) },
    rule: { side: 'long XAU/USD', stopAtr: P.STOP_ATR, atrN: P.ATR_N, pre: P.PRE, post: P.POST, cost: `$${P.COST.toFixed(2)} an ounce round trip ($0.30 spread + half a spread of slippage on each order)`,
      financing: { rate: FIN.xau.long, src: FIN.xau.src } },
    windows: { is: P.IS, oos: P.OOS },
    tests, vsOrdinary,
    placebo: { seeds: P.SEEDS, need: P.SEEDS_NEED, years, ordinaryWindows: ord.length, realNetR: real, beaten, seedNetR: seeds.map(r4) },
    bar,
    trades: [...S.lnyPre, ...S.lnyShut, ...S.lnyPost, ...gw].map((r) => ({ kind: r.kind, win: r.win, year: r.year, entry: r.c1.entryYmd, exit: r.c1.exitYmd,
      grossPct: r4(r.c1.grossPct), grossR: r4(r.c1.grossR), netR: r4(r.c1.netR), exitKind: r.c1.kind })),
  };
}

// --- report ----------------------------------------------------------------------------------------------------------------
const f = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function headline(R) {
  const o = R.tests.T1.oos;
  return `${R.verdict === 'PASS' ? 'Passes' : 'Fails'}: long gold the 10 days before the Lunar New Year closure makes ${f(o.netR)}R a year net out of sample 2017-26 (n ${o.n}, t ${f(o.t, 2)}).`;
}
export function report(R) {
  const o = [], T = R.tests, B = R.bar, PL = R.placebo;
  const failed = Object.entries(B).filter(([, v]) => !v).map(([k]) => k);
  o.push(`# Result: spot gold around the Shanghai Gold Exchange's long Chinese holidays (${R.built})`, '');
  o.push(`**Verdict: ${R.verdict}${failed.length ? ` (${failed.join(', ')} not met)` : ''}: ${headline(R).replace(/^(Passes|Fails): /, '')}**`, '');
  o.push(`Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any candle was read). A standalone calendar study of one industry claim about Chinese physical demand, **not** a gate, exit, entry or size of any gold-book system (owner item 44). Nothing live changed${R.verdict === 'PASS' ? '; a pass is a hypothesis for the owner, never a rule' : ' and no proposal follows'}.`, '');
  o.push(`Data: ${R.data.src}, ${R.data.first} to ${R.data.last}. Shanghai Gold Exchange closures 2008-2026 in \`dates.mjs\` (official holiday schedule of each year; ${R.dates.checked.length} closures also checked against press reports of the SGE's own notice: ${R.dates.checked.join(', ')}). Years dropped for uncertain dates: ${R.data.dropped.length ? R.data.dropped.join(', ') : 'none'}. Windows the data does not cover: ${R.data.missing.length ? R.data.missing.join(', ') : 'none'}. ` +
    `Long at a window's entry close, out at its last close, stop ${R.rule.stopAtr} x ATR(${R.rule.atrN}) below (every trade has one); cost ${R.rule.cost}; financing \`FIN.xau.long\` ${R.rule.financing.rate} of price a rollover. In sample ${R.windows.is.join('-')}, out of sample ${R.windows.oos.join('-')}: **about 9-10 events a window, thin**: only a large effect could pass.`, '');
  const line = (lab, x) => `| ${lab} | ${x.n} | ${f(x.grossPct, 3)} | ${f(x.grossR)} | ${f(x.tGross, 2)} | ${f(x.costR)} | ${f(x.finR)} | ${f(x.netR)} | ${f(x.t, 2)} | ${x.holmP != null ? x.holmP.toFixed(3) : (x.p != null ? x.p.toFixed(3) : 'n/a')} | ${f(x.netR2)} | ${(x.won * 100).toFixed(0)} % | ${x.stops} |`;
  o.push('## The four tests', '', '| Test, window | n | gross % | gross R | gross t | cost R | financing R | net R | net t | p (OOS: Holm) | net R 2x | won | stops |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'T3', 'T4']) for (const [w, lab] of [['is', 'in sample'], ['oos', 'out of sample'], ['all', 'whole']]) o.push(line(`${k} ${T[k].name}, ${lab}`, T[k][w]));
  o.push('', 'Golden Week by window (reported only):', '', '| Window | n | gross R | net R IS | net R OOS | net t OOS |', '|---|---|---|---|---|---|');
  for (const w of ['pre', 'shut', 'post']) { const x = T.T4.byWindow[w]; o.push(`| ${w} | ${x.all.n} | ${f(x.all.grossR)} | ${f(x.is.netR)} | ${f(x.oos.netR)} | ${f(x.oos.t, 2)} |`); }
  o.push('', '## Pass bar (T1 only)', '', '| Condition | Holds |', '|---|---|',
    `| OOS net t >= 2 and Holm p < 0.05 | ${B.tOos ? 'yes' : 'no'} (t ${f(T.T1.oos.t, 2)}, Holm p ${T.T1.oos.holmP}) |`,
    `| In sample positive too | ${B.sameSign ? 'yes' : 'no'} (IS ${f(T.T1.is.netR)}R, OOS ${f(T.T1.oos.netR)}R) |`,
    `| OOS positive at 2x cost | ${B.cost2 ? 'yes' : 'no'} (${f(T.T1.oos.netR2)}R) |`,
    `| Above at least ${PL.need} of ${PL.seeds} placebo seeds | ${B.placebo ? 'yes' : 'no'} (${PL.beaten}) |`, '');
  o.push('## Against ordinary 10-day windows and the placebo', '',
    `Welch t of the pre-Lunar-New-Year windows against every 10-trading-day hold of the same years that touches no holiday window: in sample ${f(R.vsOrdinary.is.t, 2)} (ordinary ${f(R.vsOrdinary.is.ordinaryNetR)}R, ${R.vsOrdinary.is.ordinary} windows), out of sample ${f(R.vsOrdinary.oos.t, 2)} (ordinary ${f(R.vsOrdinary.oos.ordinaryNetR)}R, ${R.vsOrdinary.oos.ordinary} windows). ` +
    `Placebo: ${PL.seeds} seeds, one random ordinary window per out-of-sample year; the real ${f(PL.realNetR)}R is above ${PL.beaten} of them (seed means ${f(Math.min(...PL.seedNetR))}R to ${f(Math.max(...PL.seedNetR))}R).`, '');
  o.push('## Each Lunar New Year (net R)', '', '| Year | first shut | reopen | pre | shut | post |', '|---|---|---|---|---|---|');
  for (const ev of R.dates.lny) { const g = (w) => R.trades.find((t) => t.kind === 'lny' && t.win === w && t.year === ev.year); o.push(`| ${ev.year} | ${ev.first} | ${ev.reopen} | ${f(g('pre')?.netR, 2)} | ${f(g('shut')?.netR, 2)} | ${f(g('post')?.netR, 2)} |`); }
  o.push('', '## Reading', '');
  o.push(`- Claim (a), the pre-holiday buying: ${T.T1.oos.netR > 0 ? 'positive' : 'not positive'} out of sample (${f(T.T1.oos.netR)}R, t ${f(T.T1.oos.t, 2)}) and ${T.T1.is.netR > 0 ? 'positive' : 'not positive'} in sample (${f(T.T1.is.netR)}R, t ${f(T.T1.is.t, 2)}). Gold rose in most years from 2008 (its trend is in every long window); against ordinary 10-day windows the out-of-sample difference has a Welch t of ${f(R.vsOrdinary.oos.t, 2)}, and it is above only ${PL.beaten} of ${PL.seeds} placebo seeds: these ten days are not shown to differ from any other ten days of the same years.`);
  o.push(`- Claim (b), the lull while Shanghai is shut: the shut window made ${f(T.T2.oos.netR)}R out of sample (t ${f(T.T2.oos.t, 2)}) and ${f(T.T2.is.netR)}R in sample: ${T.T2.oos.netR <= 0 && T.T2.is.netR <= 0 ? 'weak in both, as the claim says, but not distinguishable from zero' : 'no sign of a lull'}. Only daily closes were read; an intraday Asian-hours test was not run.`);
  o.push(`- Claim (c), the return of Chinese buyers: ${f(T.T3.oos.netR)}R out of sample (t ${f(T.T3.oos.t, 2)}), ${f(T.T3.is.netR)}R in sample.`);
  o.push(`- Golden Week, three windows pooled: ${f(T.T4.oos.netR)}R a window out of sample (t ${f(T.T4.oos.t, 2)}).`);
  o.push('- One event a year per window: ten out-of-sample observations cannot show a modest effect; a FAIL here means "not shown", not "shown absent".');
  o.push('- Paper only. Not a gold-book test and never a gate on one. Never call this an edge without its n and t.');
  o.push('', 'To repeat: `node research/edge/gold-china-holidays/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/gold-china-holidays.test.mjs`.');
  return o.join('\n') + '\n';
}

// --- CLI -------------------------------------------------------------------------------------------------------------------
export const loadBars = (rows) => foldWeekend(rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c })));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir);
  } else if (cmd === 'full') {
    const R = study(loadBars(JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8')).rows));
    R.headline = headline(R);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict, JSON.stringify(Object.fromEntries(['T1', 'T2', 'T3', 'T4'].map((k) => [k, { is: R.tests[k].is, oos: R.tests[k].oos }]))), JSON.stringify({ vs: R.vsOrdinary, placebo: R.placebo.beaten, bar: R.bar, missing: R.data.missing }));
  } else console.log('usage: node run.mjs fetch <dir> | full <dir>');
}
