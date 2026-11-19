// Edge research · gold-payroll-day: spot gold in the three trading days after the US payroll release (T1, primary) and over
// the release day (T2), long, each against the same long on every day of the same year. Pre-registered in PREREGISTRATION.md
// (pushed alone first). Paper research only: reads no gold-book record, changes nothing live.
//   node research/edge/gold-payroll-day/run.mjs fetch <dir>   (git show of council-data research/daily/xau.json, no network)
//   node research/edge/gold-payroll-day/run.mjs full <dir>    (writes result.json + RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HISTORY, EVENTS } from '../../../council/events.mjs';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, pad = (n) => String(n).padStart(2, '0');
export const ymd = (s) => { const d = new Date(s * 1000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const COST = 0.6, STOP_K = 2, ATR_N = 20, HOLD = { T1: 3, T2: 1 };
export const IS = ['2007-01-01', '2016-12-31'], OOS = ['2017-01-01', '2026-10-31'];
const SEED = 20261114, DRAWS = 40;

// ---------- payroll dates (rule copied from gold-pre-nfp-replicate/dates.mjs, unchanged) ----------
const ymdMs = (ms) => ymd(ms / 1000);
export function holidays(y) {
  const obs = (m, d) => { const t = Date.UTC(y, m, d), w = new Date(t).getUTCDay(); return ymdMs(w === 6 ? t - DAY * 1e3 : w === 0 ? t + DAY * 1e3 : t); };
  return new Set([obs(0, 1), obs(6, 4), obs(11, 25), ymdMs(Date.UTC(y + 1, 0, 1) - (new Date(Date.UTC(y + 1, 0, 1)).getUTCDay() === 6 ? DAY * 1e3 : 0))]);
}
export function derive(y, m) {
  const D = DAY * 1e3, t12 = Date.UTC(y, m, 12), sat = t12 + (6 - new Date(t12).getUTCDay()) * D;
  let fri = sat + 20 * D;
  const f = new Date(fri);
  if (f.getUTCMonth() === 0 && f.getUTCDate() <= 3) fri += 7 * D;
  const d = ymdMs(fri);
  return holidays(new Date(fri).getUTCFullYear()).has(d) ? ymdMs(fri - D) : d;
}
export const EXCEPTIONS = { '2013-09': '2013-10-22', '2013-10': '2013-11-08' };
export function releaseDates(from = IS[0], to = OOS[1]) {
  const out = [];
  for (let y = 2006; y <= 2022; y++) for (let m = 0; m < 12; m++) {
    const key = `${y}-${pad(m + 1)}`, d = EXCEPTIONS[key] || derive(y, m);
    if (d < '2022-01-01') out.push({ d, src: EXCEPTIONS[key] ? 'exception' : 'rule' });
  }
  for (const e of [...HISTORY, ...EVENTS]) if (e.type === 'NFP') out.push({ d: e.local.slice(0, 10), src: 'council/events.mjs' });
  const seen = new Set();
  return out.filter((x) => x.d >= from && x.d <= to && !seen.has(x.d) && seen.add(x.d)).sort((a, b) => (a.d < b.d ? -1 : 1));
}

// ---------- candles ----------
export function loadBars(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  return foldWeekend(j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
}
// ATR(20): mean true range of the 20 candles ending with candle i (needs i >= 20)
export function atr(bars, i, n = ATR_N) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// long from the close of candle e to the close of candle x; stop 2 x ATR checked on candles e+1..x
export function trade(bars, e, x, mult = 1) {
  const a = atr(bars, e);
  if (a == null || x >= bars.length || !(a > 0)) return null;
  const entry = bars[e].close, dist = STOP_K * a, stop = entry - dist;
  let exit = bars[x].close, how = 'time', xi = x;
  for (let k = e + 1; k <= x; k++) {
    const b = bars[k];
    if (b.open <= stop) { exit = b.open; how = 'gap'; xi = k; break; }
    if (b.low <= stop) { exit = stop; how = 'stop'; xi = k; break; }
  }
  const tIn = bars[e].time + DAY, tOut = bars[xi].time + DAY;
  const fin = nights(tIn, tOut) * FIN.xau.long * entry;
  const gross = (exit - entry) / dist;
  return { entry, stop, exit, how, dist, gross, net: gross - mult * (COST + fin) / dist, net2: gross - 2 * (COST + fin) / dist, fin };
}
const legOf = (test, i) => (test === 'T1' ? [i, i + HOLD.T1] : [i - 1, i]);   // entry, exit candle for release candle i

// baseline: the same long from every candle whose exit candle falls in year Y
export function baseline(bars, test) {
  const h = HOLD[test], acc = {};
  for (let j = ATR_N; j + h < bars.length; j++) {
    const t = trade(bars, j, j + h); if (!t) continue;
    const y = ymd(bars[j + h].time).slice(0, 4), a = (acc[y] ||= { n: 0, gross: 0, net: 0, net2: 0 });
    a.n++; a.gross += t.gross; a.net += t.net; a.net2 += t.net2;
  }
  const out = {};
  for (const [y, a] of Object.entries(acc)) out[y] = { n: a.n, gross: a.gross / a.n, net: a.net / a.n, net2: a.net2 / a.n };
  return out;
}
export const indexOf = (bars) => new Map(bars.map((b, i) => [ymd(b.time), i]));

export function events(bars, test, dates, base, idx = indexOf(bars)) {
  const rows = [], skipped = [];
  for (const { d, src } of dates) {
    const i = idx.get(d);
    if (i == null) { skipped.push({ d, why: 'no gold candle on the release date' }); continue; }
    const [e, x] = legOf(test, i), t = trade(bars, e, x);
    if (!t) { skipped.push({ d, why: 'exit candle or ATR not on file' }); continue; }
    const b = base[ymd(bars[x].time).slice(0, 4)];
    rows.push({ d, src, entryDay: ymd(bars[e].time), exitDay: ymd(bars[x].time), ...rnd(t),
      exG: t.gross - b.gross, exN: t.net - b.net, ex2: t.net2 - b.net2 });
  }
  return { rows, skipped };
}
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const rnd = (t) => ({ entry: r4(t.entry), stop: r4(t.stop), exit: r4(t.exit), how: t.how, gross: t.gross, net: t.net, net2: t.net2 });

// ---------- statistics ----------
export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
export function tOf(a) {
  if (a.length < 2) return NaN;
  const m = mean(a), sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
  return sd > 0 ? m / (sd / Math.sqrt(a.length)) : 0;
}
export function monthSums(rows, key = 'exN') {
  const m = new Map();
  for (const r of rows) { const k = r.d.slice(0, 7); m.set(k, (m.get(k) || 0) + r[key]); }
  return [...m.values()];
}
// Student t upper tail (one-sided p) via the regularized incomplete beta
function betacf(a, b, x) {
  let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d); let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d); c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d); c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}
function lgamma(z) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export function pOne(t, df) {           // P(T > t)
  if (!Number.isFinite(t)) return 1;
  const p2 = ibeta(df / (df + t * t), df / 2, 0.5) / 2;
  return t > 0 ? p2 : 1 - p2;
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length);
  let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; });
  return adj;
}
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function summ(rows) {
  const ms = monthSums(rows), t = tOf(ms);
  return {
    n: rows.length, months: ms.length,
    gross: mean(rows.map((r) => r.gross)), net: mean(rows.map((r) => r.net)), net2: mean(rows.map((r) => r.net2)),
    exG: mean(rows.map((r) => r.exG)), exN: mean(rows.map((r) => r.exN)), ex2: mean(rows.map((r) => r.ex2)),
    tEvent: tOf(rows.map((r) => r.exN)), t, tGross: tOf(monthSums(rows, 'exG')), tNetRaw: tOf(monthSums(rows, 'net')),
    p: pOne(t, ms.length - 1), stops: rows.filter((r) => r.how !== 'time').length,
  };
}

// placebo: every OOS event moved to a random non-release candle of the same calendar month
export function placebo(bars, test, oosRows, base, releaseSet, seed) {
  const rnd = mulberry32(seed), byMonth = new Map(), h = HOLD[test];
  bars.forEach((b, i) => {
    const d = ymd(b.time); if (releaseSet.has(d)) return;
    const [e, x] = legOf(test, i); if (e < ATR_N || x >= bars.length) return;
    const k = d.slice(0, 7); (byMonth.get(k) || byMonth.set(k, []).get(k)).push(i);
  });
  const ex = [];
  for (const r of oosRows) {
    const pool = byMonth.get(r.d.slice(0, 7)); if (!pool?.length) continue;
    const i = pool[Math.floor(rnd() * pool.length)], [e, x] = legOf(test, i), t = trade(bars, e, x);
    if (!t) continue;
    ex.push(t.net - base[ymd(bars[x].time).slice(0, 4)].net);
  }
  void h;
  return mean(ex);
}

export function runTest(bars, test, dates) {
  const base = baseline(bars, test), { rows, skipped } = events(bars, test, dates, base);
  const ins = rows.filter((r) => r.d >= IS[0] && r.d <= IS[1]), oos = rows.filter((r) => r.d >= OOS[0] && r.d <= OOS[1]);
  const set = new Set(dates.map((x) => x.d));
  const means = Array.from({ length: DRAWS }, (_, k) => placebo(bars, test, oos, base, set, SEED + k));
  const o = summ(oos);
  return { test, hold: HOLD[test], base, rows, skipped, is: summ(ins), oos: o,
    placebo: { means: means.map(r4), beats: means.filter((m) => o.exN > m).length, median: r4([...means].sort((a, b) => a - b)[20]) } };
}

// ---------- report ----------
const f3 = (v) => (Number.isFinite(v) ? (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3) : 'n/a');
const f2 = (v) => (Number.isFinite(v) ? (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) : 'n/a');
const WORD = { t2Holm: 't under 2', sameSignIS: 'in sample negative', costs2: '2x costs negative', netPositive: 'net negative', placebo: `placebo short of 38 of 40` };
const NAME = { T1: 'T1 (primary): long the three days after the release', T2: 'T2: long over the release day' };

export function build(bars, dates) {
  const T = ['T1', 'T2'].map((k) => runTest(bars, k, dates));
  const adj = holm(T.map((x) => x.oos.p));
  T.forEach((x, k) => {
    x.holmP = adj[k];
    x.checks = { t2Holm: x.oos.t >= 2 && adj[k] < 0.05, sameSignIS: x.is.exN > 0, costs2: x.oos.ex2 > 0, netPositive: x.oos.net > 0, placebo: x.placebo.beats >= 38 };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  const [t1, t2] = T, verdict = t1.pass ? 'PASS' : 'FAIL';
  const why = t1.pass ? 'every check met' : Object.entries(t1.checks).filter(([, v]) => !v).map(([k]) => WORD[k]).join(', ');
  const headline = `Verdict: ${verdict}: long gold the 3 days after US payrolls beats the year's every-day long by ${f3(t1.oos.exN)}R net 2017-26 (n ${t1.oos.n}, month t ${f2(t1.oos.t)}, ${t1.placebo.beats} of 40 placebos): ${why}; T2 ${t2.pass ? 'passes' : 'fails'}.`;
  return { T, verdict, headline };
}

function md(res, meta) {
  const { T, headline } = res, L = [];
  L.push('# Result: gold in the three days after US payrolls, and on the release day (14 Nov 2026)', '', `**${headline}**`, '');
  L.push('Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any gold return was computed). A stand-alone calendar study on spot gold: it reads no record or position of the live gold book and is not a gate, exit, entry or size of it (owner item 44). Paper only; nothing live changed; no proposal follows. Not an edge: every figure carries its n and t.', '');
  L.push(`Data: OANDA mid daily gold candles (council-data research/daily/xau.json, ${meta.from} to ${meta.to}, ${meta.candles} folded candles; weekend stubs folded into Monday with council/fills.mjs foldWeekend; close = 00:00 UTC). Payroll dates: the BLS rule copied from gold-pre-nfp-replicate (2007-21, with its two 2013 shutdown exceptions, its five "moves" not used) and council/events.mjs (2022 on). Costs: $0.60 a round trip plus nights x FIN.xau.long (${FIN.xau.long}, ${FIN.xau.asOf}) x entry. Stop 2 x ATR(20) daily, fixed. Baseline: the same long with the same hold, stop and costs from the close of every candle whose exit falls in the same year, payroll days included; excess = event net R − that year's baseline mean.`, '');
  L.push('## The two tests (Holm over both; the verdict is T1)', '');
  L.push('| Test | Window | n | months | gross R | net R | excess gross R | excess net R | excess 2x R | event t (excess) | month-sum t (excess net) | month t gross | one-sided p | Holm p | stops |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const x of T) for (const [w, s] of [['in sample 2007-16', x.is], ['out of sample 2017-26', x.oos]]) {
    L.push(`| ${x.test} | ${w} | ${s.n} | ${s.months} | ${f3(s.gross)} | ${f3(s.net)} | ${f3(s.exG)} | ${f3(s.exN)} | ${f3(s.ex2)} | ${f2(s.tEvent)} | ${f2(s.t)} | ${f2(s.tGross)} | ${s.p.toFixed(3)} | ${w.startsWith('out') ? x.holmP.toFixed(3) : '-'} | ${s.stops} |`);
  }
  L.push('', '## Pass bar', '', '| Check | T1 | T2 |', '|---|---|---|');
  const rows = [['OOS month-sum t >= 2 and Holm p < 0.05', 't2Holm'], ['in-sample excess net > 0', 'sameSignIS'], ['OOS excess at 2x costs > 0', 'costs2'], ['OOS net R > 0', 'netPositive'], ['beats >= 38 of 40 placebo draws', 'placebo']];
  for (const [label, k] of rows) L.push(`| ${label} | ${T[0].checks[k] ? 'yes' : 'no'} | ${T[1].checks[k] ? 'yes' : 'no'} |`);
  L.push(`| **pass** | **${T[0].pass ? 'yes' : 'no'}** | **${T[1].pass ? 'yes' : 'no'}** |`, '');
  L.push('## Placebo', '', '40 seeded draws (mulberry32, seed 20261114 + draw): every out-of-sample event moved to a random gold candle of the same calendar month that is not a payroll release day, same hold, stop and costs; the draw\'s mean excess net R.', '');
  for (const x of T) L.push(`- ${x.test}: the rule's ${f3(x.oos.exN)}R beats ${x.placebo.beats} of 40 draws (draw median ${f3(x.placebo.median)}R, range ${f3(Math.min(...x.placebo.means))} to ${f3(Math.max(...x.placebo.means))}R).`);
  L.push('', '## Baseline by year (net R of the every-day long)', '', '| Year | T1 n | T1 net R | T2 n | T2 net R |', '|---|---|---|---|---|');
  for (const y of Object.keys(T[0].base).filter((y) => y >= '2007' && y <= '2026')) L.push(`| ${y} | ${T[0].base[y].n} | ${f3(T[0].base[y].net)} | ${T[1].base[y].n} | ${f3(T[1].base[y].net)} |`);
  L.push('', '## Notes', '');
  for (const x of T) L.push(`- ${NAME[x.test]}: ${x.skipped.length} event(s) skipped${x.skipped.length ? ' (' + x.skipped.map((s) => `${s.d}: ${s.why}`).join('; ') + ')' : ''}.`);
  L.push(`- The pre-registration counted ${meta.releases.is} in-sample and ${meta.releases.oos} out-of-sample release dates; releases on Good Friday have no OANDA gold candle and are skipped as pre-registered, leaving ${T[0].is.n} and ${T[0].oos.n} (both still at least 100).`);
  L.push('- Payroll dates 2007-21 are derived by rule and not verified by a BLS page (bls.gov is refused by the sandbox proxy); gold-pre-nfp-replicate verified 165 of 189 derived dates 2006-21 on the release minute.', '- Financing at today\'s rate for every year; the daily close is 00:00 UTC, not the 17:00 New York rollover.', '- To repeat: `node research/edge/gold-payroll-day/run.mjs fetch <dir>`, then `node research/edge/gold-payroll-day/run.mjs full <dir>`; delete `<dir>` after.', '');
  return L.join('\n');
}

export function toJson(res, meta) {
  const { T, verdict, headline } = res, R = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' ? r4(v) : v]));
  return {
    study: 'gold-payroll-day', title: 'Gold in the three days after US payrolls, and on the release day', built: '2026-11-14',
    verdict, headline, system: 'stand-alone calendar rule, spot gold (not the live book)',
    data: meta, cost: { roundTrip: COST, fin: FIN.xau.long, finAsOf: FIN.xau.asOf, stopK: STOP_K, atrN: ATR_N },
    windows: { is: IS, oos: OOS },
    tests: T.map((x) => ({ test: x.test, hold: x.hold, is: R(x.is), oos: R(x.oos), holmP: r4(x.holmP), checks: x.checks, pass: x.pass, placebo: x.placebo, skipped: x.skipped,
      trades: x.rows.map((r) => ({ d: r.d, src: r.src, entryDay: r.entryDay, exitDay: r.exitDay, entry: r.entry, stop: r.stop, exit: r.exit, how: r.how, gross: r4(r.gross), net: r4(r.net), exN: r4(r.exN) })) })),
  };
}

async function main() {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 26 }));
    return console.log('wrote', path.join(dir, 'xau.json'));
  }
  if (cmd !== 'full') return console.log('usage: run.mjs fetch|full <dir>');
  const bars = loadBars(path.join(dir, 'xau.json')), dates = releaseDates();
  const meta = { src: 'OANDA mid daily, council-data research/daily/xau.json', candles: bars.length, from: ymd(bars[0].time), to: ymd(bars.at(-1).time),
    releases: { is: dates.filter((x) => x.d <= IS[1]).length, oos: dates.filter((x) => x.d >= OOS[0]).length } };
  const res = build(bars, dates);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(toJson(res, meta), null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md(res, meta));
  console.log(res.headline);
  for (const x of res.T) console.log(x.test, JSON.stringify({ is: x.is, oos: x.oos, holm: x.holmP, beats: x.placebo.beats }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
