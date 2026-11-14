// Spot gold into and after the Indian gold-buying festivals (research/edge/gold-india-festivals, PREREGISTRATION.md).
// Paper research; a standalone calendar study, not a gate, exit, entry or size of any gold-book system (owner item 44).
//   node run.mjs fetch <dir>   daily candles from council-data (git show, no network) + OANDA mid H1 through the site's proxy
//   node run.mjs full <dir>    runs the study and writes result.json + RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { financing, foldWeekend, FIN } from '../../../council/fills.mjs';
import { DHANTERAS, AKSHAYA } from './dates.mjs';

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
// the run-up window [entry, exit] and the post window [entry, exit] of festival date d (null where the candles do not cover it)
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
const row = (bars, h1, w, side) => { const v = {}; for (const c of [0, 1, 2]) { const x = trade(bars, h1, w[0], w[1], side, c); if (!x) return null; v[`c${c}`] = x; } return v; };

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
const TESTS = {
  T1: { name: 'Dhanteras run-up, long 10 trading days into the day before', fests: ['dhanteras'], win: 'run', side: 'buy', hold: P.RUN },
  T2: { name: 'Akshaya Tritiya run-up, long 10 trading days into the day before', fests: ['akshaya'], win: 'run', side: 'buy', hold: P.RUN },
  T3: { name: 'Post-festival softening, short 5 trading days after the festival (both pooled)', fests: ['dhanteras', 'akshaya'], win: 'post', side: 'sell', hold: P.POST },
};
export function study(bars, h1) {
  const evs = [];
  for (const [fest, list] of [['dhanteras', DHANTERAS], ['akshaya', AKSHAYA]]) for (const ev of list) if (ev.ok) evs.push({ fest, ev, w: festWindows(bars, ev.date) });
  const excluded = [...DHANTERAS.map((e) => ({ fest: 'dhanteras', ...e })), ...AKSHAYA.map((e) => ({ fest: 'akshaya', ...e }))].filter((e) => !e.ok).map((e) => `${e.fest} ${e.year}: ${e.src}`);
  const missing = [];
  for (const e of evs) for (const w of ['run', 'post']) if (!e.w[w]) missing.push(`${e.fest} ${e.ev.year} ${w}`);
  const tests = {}, ordinary = {}, placebo = {}, rows = {};
  for (const [k, T] of Object.entries(TESTS)) {
    const mine = evs.filter((e) => T.fests.includes(e.fest) && e.w[T.win]);
    rows[k] = mine.map((e) => { const r = row(bars, h1, e.w[T.win], T.side); return r && { year: e.ev.year, fest: e.fest, date: e.ev.date, ...r }; }).filter(Boolean);
    const split = (rs) => ({ is: block(rs.filter((r) => inYears(r.year, P.IS))), oos: block(rs.filter((r) => inYears(r.year, P.OOS))), all: block(rs) });
    tests[k] = { name: T.name, side: T.side, hold: T.hold, ...split(rows[k]) };
    // days held by this test's festival windows (entry excluded)
    const busy = new Set(); for (const e of mine) { const w = e.w[T.win]; for (let i = w[0] + 1; i <= w[1]; i++) busy.add(i); }
    // ordinary holds of the same length, same years, both ends in one calendar year, touching no window of this test
    const ord = [];
    for (let i0 = P.ATR_N; i0 + T.hold < bars.length; i0++) {
      const y = yearOf(bars, i0 + T.hold); if (y < P.IS[0] || y > P.OOS[1] || yearOf(bars, i0) !== y) continue;
      let ok = true; for (let i = i0 + 1; i <= i0 + T.hold; i++) if (busy.has(i)) { ok = false; break; }
      if (!ok) continue;
      const a = trade(bars, h1, i0, i0 + T.hold, T.side, 1), b = T.side === 'sell' ? trade(bars, h1, i0, i0 + T.hold, 'buy', 1) : a;
      if (a) ord.push({ year: y, netR: a.netR, longNetR: b.netR });
    }
    const welchOf = (yrs) => { const a = rows[k].filter((r) => inYears(r.year, yrs)).map((r) => r.c1.netR), b = ord.filter((r) => inYears(r.year, yrs));
      return { n: a.length, ordinary: b.length, ordinaryNetR: r4(mean(b.map((x) => x.netR))), ordinaryLongNetR: r4(mean(b.map((x) => x.longNetR))),
        t: r4(welch(a, b.map((x) => x.netR)).t) }; };
    ordinary[k] = { is: welchOf(P.IS), oos: welchOf(P.OOS) };
    const years = rows[k].filter((r) => inYears(r.year, P.OOS)).map((r) => r.year), seeds = [];
    for (let s = 1; s <= P.SEEDS; s++) { const R = rng(1000 * (+k.slice(1)) + s), xs = [];
      for (const y of years) { const pool = ord.filter((o) => o.year === y); if (pool.length) xs.push(pool[Math.floor(R() * pool.length)].netR); }
      seeds.push(mean(xs)); }
    const real = tests[k].oos.netR;
    placebo[k] = { seeds: P.SEEDS, need: P.SEEDS_NEED, events: years.length, realNetR: real, beaten: seeds.filter((x) => real > x).length, seedNetR: seeds.map(r4) };
  }
  const keys = Object.keys(TESTS), adj = holm(keys.map((k) => tests[k].oos.p));
  keys.forEach((k, i) => { tests[k].oos.holmP = r4(adj[i]); });
  const bar = {};
  for (const k of keys) { const T = tests[k];
    bar[k] = { tOos: T.oos.t >= P.T_BAR && T.oos.holmP < P.ALPHA, sameSign: Math.sign(T.is.netR) === Math.sign(T.oos.netR) && T.is.netR !== 0,
      cost2: T.oos.netR2 > 0, placebo: placebo[k].beaten >= P.SEEDS_NEED };
    bar[k].pass = Object.values(bar[k]).every(Boolean); }
  const verdict = keys.some((k) => bar[k].pass) ? 'PASS' : 'FAIL';
  return {
    built: '2026-11-14', study: 'gold-india-festivals', title: 'Spot gold into and after the Indian gold-buying festivals (Dhanteras, Akshaya Tritiya)',
    verdict, headline: null, system: 'Research only (spot gold on calendar windows; not a gold-book system, owner item 44)',
    data: { src: 'OANDA mid daily candles (UTC days), council-data research/daily/xau.json (git show), weekend folded into Monday; stops on OANDA mid H1',
      first: ymdOf(bars[0].time), last: ymdOf(bars.at(-1).time), candles: bars.length, h1: h1.length, h1Last: ymdOf(h1.at(-1).time), missing, excluded },
    dates: { dhanteras: DHANTERAS, akshaya: AKSHAYA },
    rule: { stopAtr: P.STOP_ATR, atrN: P.ATR_N, run: P.RUN, post: P.POST, cost: `$${P.COST.toFixed(2)} an ounce round trip`, financing: { rate: FIN.xau.long, src: FIN.xau.src, on: 'buys only' } },
    windows: { is: P.IS, oos: P.OOS }, tests, ordinary, placebo, bar,
    trades: Object.entries(rows).flatMap(([k, rs]) => rs.map((r) => ({ test: k, fest: r.fest, year: r.year, date: r.date, entry: r.c1.entryYmd, exit: r.c1.exitYmd,
      grossPct: r4(r.c1.grossPct), grossR: r4(r.c1.grossR), netR: r4(r.c1.netR), netR2: r4(r.c2.netR), exitKind: r.c1.kind }))),
  };
}

// --- report ----------------------------------------------------------------------------------------------------------------
const f = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function headline(R) {
  const a = R.tests.T1.oos, b = R.tests.T2.oos, c = R.tests.T3.oos;
  return `${R.verdict === 'PASS' ? 'Passes' : 'Fails'}: out of sample 2017-26 the Dhanteras run-up makes ${f(a.netR)}R net (n ${a.n}, t ${f(a.t, 2)}), Akshaya Tritiya ${f(b.netR)}R (t ${f(b.t, 2)}), the post-festival short ${f(c.netR)}R (t ${f(c.t, 2)}).`;
}
// the reason inside the bold verdict line, short enough for the research ledger (<= 220 characters with the headline)
export function verdictLine(R) {
  const a = R.tests.T1.oos, b = R.tests.T2.oos, c = R.tests.T3.oos, n = Object.values(R.bar).filter((x) => x.pass).length;
  const why = R.verdict === 'PASS' ? `${n} of 3 tests pass` : `0 of 3 pass, no OOS t near 2, placebo not beaten`;
  return `${R.verdict} (${why}): Dhanteras run-up ${f(a.netR)}R net OOS (n ${a.n}, t ${f(a.t, 2)}), Akshaya Tritiya ${f(b.netR)}R (t ${f(b.t, 2)}), post-festival short ${f(c.netR)}R (t ${f(c.t, 2)}).`;
}
export function report(R) {
  const o = [], T = R.tests, B = R.bar, PL = R.placebo;
  o.push(`# Result: spot gold into and after the Indian gold-buying festivals (${R.built})`, '');
  o.push(`**Verdict: ${verdictLine(R)}**`, '');
  o.push(`Judged on the pre-registered bar (PREREGISTRATION.md and \`dates.mjs\`, pushed alone before any candle was read). A standalone calendar study of one industry claim about Indian physical demand, **not** a gate, exit, entry or size of any gold-book system (owner item 44). Nothing live changed${R.verdict === 'PASS' ? '; a pass is a hypothesis for the owner, never a rule' : ' and no proposal follows'}.`, '');
  o.push(`Data: ${R.data.src}, ${R.data.first} to ${R.data.last} (H1 to ${R.data.h1Last}). Festival dates: \`dates.mjs\` (Drik Panchang, New Delhi, cross-checked against press reports; a source on each row). Excluded before any price was read: ${R.data.excluded.join('; ')}. Windows the candles do not cover: ${R.data.missing.length ? R.data.missing.join(', ') : 'none'}. ` +
    `Stop ${R.rule.stopAtr} x ATR(${R.rule.atrN}) of the daily candles, checked on H1 (a gap fills at the open); cost ${R.rule.cost}; financing \`FIN.xau.long\` ${R.rule.financing.rate} of price a rollover on buys only. In sample ${R.windows.is.join('-')}, out of sample ${R.windows.oos.join('-')}. **About 10 events a window per festival: very low power**; only a large effect could pass, and a FAIL means "not shown", not "shown absent".`, '');
  const line = (lab, x) => `| ${lab} | ${x.n} | ${f(x.grossPct, 3)} | ${f(x.grossR)} | ${f(x.tGross, 2)} | ${f(x.costR)} | ${f(x.finR)} | ${f(x.netR)} | ${f(x.t, 2)} | ${x.holmP != null ? x.holmP.toFixed(3) : (x.p != null ? x.p.toFixed(3) : 'n/a')} | ${f(x.netR2)} | ${(x.won * 100).toFixed(0)} % | ${x.stops} |`;
  o.push('## The three tests', '', '| Test, window | n | gross % | gross R | gross t | cost R | financing R | net R | net t | p (OOS: Holm) | net R 2x | won | stops |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'T3']) for (const [w, lab] of [['is', 'in sample'], ['oos', 'out of sample'], ['all', 'whole']]) o.push(line(`${k} ${T[k].name}, ${lab}`, T[k][w]));
  o.push('', '## Pass bar (each test on its own)', '', '| Test | OOS t >= 2 and Holm p < 0.05 | IS same sign | OOS positive at 2x cost | above >= 38 of 40 placebo seeds | passes |', '|---|---|---|---|---|---|');
  const yn = (v) => (v ? 'yes' : 'no');
  for (const k of ['T1', 'T2', 'T3']) o.push(`| ${k} | ${yn(B[k].tOos)} (t ${f(T[k].oos.t, 2)}, Holm p ${T[k].oos.holmP}) | ${yn(B[k].sameSign)} (IS ${f(T[k].is.netR)}R, OOS ${f(T[k].oos.netR)}R) | ${yn(B[k].cost2)} (${f(T[k].oos.netR2)}R) | ${yn(B[k].placebo)} (${PL[k].beaten}) | ${yn(B[k].pass)} |`);
  o.push('', '## Against ordinary holdings of the same length and the placebo', '',
    '| Test | window | festival net R | ordinary holds (same side) | their net R | an average same-length LONG hold | Welch t | placebo: real above n of 40 | seed means |', '|---|---|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'T3']) for (const [w, lab] of [['is', 'in sample'], ['oos', 'out of sample']]) {
    const x = R.ordinary[k][w];
    o.push(`| ${k} | ${lab} | ${f(T[k][w].netR)} | ${x.ordinary} | ${f(x.ordinaryNetR)} | ${f(x.ordinaryLongNetR)} | ${f(x.t, 2)} | ${w === 'oos' ? PL[k].beaten : ''} | ${w === 'oos' ? `${f(Math.min(...PL[k].seedNetR))} to ${f(Math.max(...PL[k].seedNetR))}` : ''} |`);
  }
  o.push('', 'Placebo: per seed, one random holding of the same length and side in each out-of-sample event\'s calendar year, outside the festival windows of that test.', '');
  o.push('## Each event (R per trade)', '', '| Festival | year | date | run-up entry → exit | run-up gross R | net R | net R 2x | exit | post short gross R | net R | net R 2x | exit |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [fest, list] of [['dhanteras', R.dates.dhanteras], ['akshaya', R.dates.akshaya]]) for (const ev of list) {
    if (!ev.ok) { o.push(`| ${fest === 'dhanteras' ? 'Dhanteras' : 'Akshaya Tritiya'} | ${ev.year} | ${ev.date} | excluded | | | | | | | | |`); continue; }
    const a = R.trades.find((t) => t.test !== 'T3' && t.fest === fest && t.year === ev.year), b = R.trades.find((t) => t.test === 'T3' && t.fest === fest && t.year === ev.year);
    o.push(`| ${fest === 'dhanteras' ? 'Dhanteras' : 'Akshaya Tritiya'} | ${ev.year} | ${ev.date} | ${a ? `${a.entry} → ${a.exit}` : 'n/a'} | ${f(a?.grossR, 2)} | ${f(a?.netR, 2)} | ${f(a?.netR2, 2)} | ${a?.exitKind ?? ''} | ${f(b?.grossR, 2)} | ${f(b?.netR, 2)} | ${f(b?.netR2, 2)} | ${b?.exitKind ?? ''} |`);
  }
  o.push('', '## Reading', '');
  for (const k of ['T1', 'T2', 'T3']) { const x = T[k], y = R.ordinary[k];
    o.push(`- ${k} ${x.name}: ${f(x.is.netR)}R a trade in sample (n ${x.is.n}, t ${f(x.is.t, 2)}), ${f(x.oos.netR)}R out of sample (n ${x.oos.n}, t ${f(x.oos.t, 2)}, Holm p ${x.oos.holmP}); ordinary same-side holds of those years ${f(y.oos.ordinaryNetR)}R (Welch t ${f(y.oos.t, 2)}); above ${PL[k].beaten} of 40 placebo seeds.`); }
  o.push('- Gold rose in most years of the sample, so any long window carries its trend; the comparison with ordinary holdings of the same length is the fair one.');
  o.push('- One event a year per festival: ten out-of-sample observations cannot show a modest effect. Paper only; never call this an edge without its n and t.');
  o.push('', 'To repeat: `node --use-env-proxy research/edge/gold-india-festivals/run.mjs fetch <dir>` (daily candles by git show from `origin/council-data`, H1 through the candle proxy; keep `<dir>` out of git), then `… full <dir>`. Test: `tests/gold-india-festivals.test.mjs`.');
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
