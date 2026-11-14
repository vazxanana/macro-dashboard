// Gold's daily three-candle gap, traded on its first retest (PREREGISTRATION.md, pushed alone first).
//   node --use-env-proxy research/edge/gold-daily-fvg/run.mjs fetch <dir>   OANDA mid H1 gold from 2006 via the site's proxy
//   node research/edge/gold-daily-fvg/run.mjs full <dir>                   the study -> result.json and RESULT.md
// Pure pieces are exported for the test. Paper research: nothing live reads this file.
import fs from 'node:fs';
import path from 'node:path';
import { days, nyDay } from '../gold-drd-long/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const H = 3600, D = 86400;
export const P = { minGap: 0.25, buf: 0.5, watch: 20, rr: 2, hold: 10, minRisk: 10, cost: 0.6, baseStop: 1.0, atrN: 14, seed: 20261114, draws: 40 };
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// ATR14 of the 14 days ending at day i (inclusive); null before enough days
export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null; let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high - ds[j].low, Math.abs(ds[j].high - ds[j - 1].close), Math.abs(ds[j].low - ds[j - 1].close));
  return s / n;
}
// the gap formed at the close of day i (reads days i-2..i and earlier only): { i, side, top, bottom, atr, gapAtr } or null
export function gapAt(ds, i) {
  if (i < P.atrN + 1) return null; const a = atrAt(ds, i); if (!(a > 0)) return null;
  if (ds[i].low > ds[i - 2].high) { const g = ds[i].low - ds[i - 2].high; if (g >= P.minGap * a) return { i, side: 1, top: ds[i].low, bottom: ds[i - 2].high, atr: a, gapAtr: g / a }; }
  if (ds[i].high < ds[i - 2].low) { const g = ds[i - 2].low - ds[i].high; if (g >= P.minGap * a) return { i, side: -1, top: ds[i - 2].low, bottom: ds[i].high, atr: a, gapAtr: g / a }; }
  return null;
}
export const gaps = (ds) => ds.map((_, i) => gapAt(ds, i)).filter(Boolean);
// index of each day's H1 candles: rng[j] = [first, last]
export function dayRanges(h1, ds) {
  const at = new Map(ds.map((x, j) => [x.d, j])), rng = ds.map(() => null);
  h1.forEach((b, k) => { const d = nyDay(b.time), j = d == null ? undefined : at.get(d); if (j == null) return; if (!rng[j]) rng[j] = [k, k]; else rng[j][1] = k; });
  return rng;
}
// walk an open trade from candle k0 (the entry candle) to candle k1. limitFill: only the stop counts on the fill candle (the
// order inside it is unknown); a market entry at the candle's open checks both.
export function manage(h1, k0, k1, side, entry, stop, target, limitFill) {
  for (let k = k0; k <= k1; k++) { const b = h1[k];
    if (k > k0 && (side > 0 ? b.open <= stop : b.open >= stop)) return { exit: b.open, exitT: b.time, how: 'stop' };
    if (side > 0 ? b.low <= stop : b.high >= stop) return { exit: stop, exitT: b.time + H, how: 'stop' };
    if (k === k0 && limitFill) continue;
    if (k > k0 && (side > 0 ? b.open >= target : b.open <= target)) return { exit: b.open, exitT: b.time, how: 'target' };
    if (side > 0 ? b.high >= target : b.low <= target) return { exit: target, exitT: b.time + H, how: 'target' }; }
  return { exit: h1[k1].close, exitT: h1[k1].time + H, how: 'time' };
}
function costOf(side, entry, risk, entryT, exitT) {
  const costR = P.cost / risk, finR = side > 0 ? nights(entryT, exitT) * FIN.xau.long * entry / risk : 0; return { costR, finR };
}
function finish(o) { const R = o.side * (o.exit - o.entry) / o.risk, { costR, finR } = costOf(o.side, o.entry, o.risk, o.entryT, o.exitT);
  return { ...o, R, costR, finR, net: R - costR - finR, net2: R - 2 * (costR + finR) }; }
// the first retest of gap g: a limit trade, or { skip } / null (untouched, dead, or data missing)
export function retest(h1, rng, ds, g) {
  const side = g.side, edge = side > 0 ? g.top : g.bottom, stop = side > 0 ? g.bottom - P.buf * g.atr : g.top + P.buf * g.atr;
  for (let j = g.i + 1; j <= Math.min(ds.length - 1, g.i + P.watch); j++) { const r = rng[j]; if (!r) continue;
    for (let k = r[0]; k <= r[1]; k++) { const b = h1[k];
      if (!(side > 0 ? b.low <= edge : b.high >= edge)) continue;
      const entry = side > 0 ? Math.min(b.open, edge) : Math.max(b.open, edge);
      if (side > 0 ? entry <= stop : entry >= stop) return { dead: true, g };
      const risk = Math.abs(entry - stop); if (risk < P.minRisk) return { skip: true, g, risk };
      const jEnd = j + P.hold; if (jEnd >= ds.length || !rng[jEnd]) return null;
      const target = entry + side * P.rr * risk, m = manage(h1, k, rng[jEnd][1], side, entry, stop, target, true);
      return finish({ g: g.i, side, gapAtr: g.gapAtr, atr: g.atr, entryT: b.time, entry, stop, target, risk, day: j, ...m }); } }
  return null;
}
// a market entry at the first H1 open of day j with a given stop distance (baseline and placebo)
export function marketTrade(h1, rng, ds, j, side, dist) {
  const r = rng[j], jEnd = j + P.hold; if (!r || jEnd >= ds.length || !rng[jEnd] || !(dist > 0)) return null;
  const b = h1[r[0]], entry = b.open, stop = entry - side * dist, target = entry + side * P.rr * dist;
  return finish({ side, entryT: b.time, entry, stop, target, risk: dist, day: j, ...manage(h1, r[0], rng[jEnd][1], side, entry, stop, target, false) });
}
export function oneAtATime(T) { const out = []; let free = -Infinity;
  for (const x of [...T].sort((a, b) => a.entryT - b.entryT || (b.gapAtr || 0) - (a.gapAtr || 0))) { if (x.entryT < free) continue; out.push(x); free = x.exitT; } return out; }

export function monthT(T, [f, t], key = 'net') {
  const m = new Map(); for (const x of T) { const k = ymd(x.exitT).slice(0, 7); m.set(k, (m.get(k) || 0) + x[key]); }
  let [y, mo] = f.slice(0, 7).split('-').map(Number); const last = [t.slice(0, 7), ...m.keys()].sort().at(-1), v = [];
  for (;;) { const k = `${y}-${String(mo).padStart(2, '0')}`; v.push(m.get(k) || 0); if (k >= last) break; if (++mo > 12) { mo = 1; y++; } }
  const n = v.length, a = v.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? +(a / (sd / Math.sqrt(n))).toFixed(2) : 0 };
}
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
export function stats(T, win) {
  let eq = 0, pk = 0, dd = 0; for (const x of [...T].sort((a, b) => a.exitT - b.exitT)) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const r3 = (x) => +x.toFixed(3), gross = mean(T.map((x) => x.R)), cost = mean(T.map((x) => x.costR + x.finR));
  return { n: T.length, buys: T.filter((x) => x.side > 0).length, sells: T.filter((x) => x.side < 0).length,
    gross: r3(gross), net: r3(mean(T.map((x) => x.net))), net2x: r3(mean(T.map((x) => x.net2))),
    costR: r3(mean(T.map((x) => x.costR))), finR: r3(mean(T.map((x) => x.finR))), costShare: gross > 0 ? +(cost / gross).toFixed(2) : null,
    totalNet: +T.reduce((s, x) => s + x.net, 0).toFixed(1),
    win: T.length ? +(T.filter((x) => x.net > 0).length / T.length * 100).toFixed(1) : null,
    stops: T.filter((x) => x.how === 'stop').length, targets: T.filter((x) => x.how === 'target').length, times: T.filter((x) => x.how === 'time').length,
    medianStop: T.length ? +median(T.map((x) => x.risk)).toFixed(2) : null, medianHoldDays: T.length ? +(median(T.map((x) => (x.exitT - x.entryT) / D))).toFixed(1) : null,
    tNet: monthT(T, win, 'net').t, tGross: monthT(T, win, 'R').t, months: monthT(T, win).months, dd: +dd.toFixed(1) };
}
const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export const pOf = (t) => 2 * (1 - phi(Math.abs(t)));
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let mx = 0;
  o.forEach(([p, i], r) => { mx = Math.max(mx, Math.min(1, (ps.length - r) * p)); adj[i] = mx; }); return adj; }
export function rng32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let from = Math.floor(Date.parse('2006-01-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * H);
    const r = await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=1h&from=${from}&to=${to}`); const j = await r.json();
    if (!r.ok) throw new Error(`proxy ${r.status} ${j.error || ''}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`${ymd(from)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
}

export function study(h1) {
  const ds = days(h1), rng = dayRanges(h1, ds);
  const inWin = (x, [f, t]) => ymd(x.entryT) >= f && ymd(x.entryT) <= t;
  const G = gaps(ds), all = G.map((g) => retest(h1, rng, ds, g)).filter(Boolean), cand = all.filter((x) => x.R != null);
  const T = { T1: oneAtATime(cand), T2: oneAtATime(cand.filter((x) => x.side > 0)), T3: oneAtATime(cand.filter((x) => x.side < 0)) };
  const out = { built: '2026-11-14', data: { from: ymd(h1[0].time), to: ymd(h1.at(-1).time), h1: h1.length, days: ds.length,
    gaps: { buy: G.filter((g) => g.side > 0).length, sell: G.filter((g) => g.side < 0).length },
    retested: cand.length, dead: all.filter((x) => x.dead).length, skippedRisk: all.filter((x) => x.skip).length,
    src: 'OANDA mid H1 XAU_USD via the site proxy' }, params: P, windows: WIN, tests: {} };
  for (const [k, tr] of Object.entries(T)) out.tests[k] = { is: stats(tr.filter((x) => inWin(x, WIN.is)), WIN.is), oos: stats(tr.filter((x) => inWin(x, WIN.oos)), WIN.oos) };
  const adj = holm(['T1', 'T2', 'T3'].map((k) => pOf(out.tests[k].oos.tNet)));
  ['T1', 'T2', 'T3'].forEach((k, i) => { out.tests[k].oos.p = +pOf(out.tests[k].oos.tNet).toFixed(4); out.tests[k].oos.holm = +adj[i].toFixed(4); });
  // baselines: same-side market entry every trading day, stop 1.0 x the previous day's ATR14
  out.baseline = {};
  for (const [k, side] of [['buy', 1], ['sell', -1]]) {
    const tr = oneAtATime(ds.map((_, j) => (j > P.atrN + 1 ? marketTrade(h1, rng, ds, j, side, P.baseStop * atrAt(ds, j - 1)) : null)).filter(Boolean));
    out.baseline[k] = { is: stats(tr.filter((x) => inWin(x, WIN.is)), WIN.is), oos: stats(tr.filter((x) => inWin(x, WIN.oos)), WIN.oos) };
  }
  out.yearsT1 = {}; for (let y = 2007; y <= 2026; y++) { const r = T.T1.filter((x) => ymd(x.entryT).startsWith(String(y))); if (r.length) out.yearsT1[y] = { n: r.length, net: +r.reduce((s, x) => s + x.net, 0).toFixed(2) }; }
  // placebo: T1's out-of-sample trades moved to random out-of-sample days, sides shuffled, the same risk in ATR units
  const R = rng32(P.seed), pl = [], real = T.T1.filter((x) => inWin(x, WIN.oos));
  const pool = ds.map((x, j) => j).filter((j) => j > P.atrN + 1 && rng[j] && ymd(h1[rng[j][0]].time) >= WIN.oos[0] && ymd(h1[rng[j][0]].time) <= WIN.oos[1]);
  for (let dr = 0; dr < P.draws; dr++) {
    const p = [...pool]; for (let j = p.length - 1; j > 0; j--) { const r = Math.floor(R() * (j + 1)); [p[j], p[r]] = [p[r], p[j]]; }
    const sides = real.map((x) => x.side); for (let j = sides.length - 1; j > 0; j--) { const r = Math.floor(R() * (j + 1)); [sides[j], sides[r]] = [sides[r], sides[j]]; }
    const tr = oneAtATime(real.map((x, n) => marketTrade(h1, rng, ds, p[n], sides[n], x.risk / x.atr * atrAt(ds, p[n] - 1))).filter(Boolean));
    pl.push(stats(tr, WIN.oos).tNet);
  }
  const ps = [...pl].sort((a, b) => a - b), q = (f) => ps[Math.min(ps.length - 1, Math.floor(f * ps.length))];
  out.placebo = { draws: P.draws, seed: P.seed, tOOS: pl, median: q(0.5), p95: q(0.95), atOrAbove: pl.filter((x) => x >= out.tests.T1.oos.tNet).length };
  const t1 = out.tests.T1;
  out.checks = { oosT: t1.oos.tNet >= 2 && t1.oos.holm < 0.05, isSign: t1.is.net > 0, cost2x: t1.oos.net2x > 0, placebo: t1.oos.tNet > out.placebo.p95 };
  out.verdict = Object.values(out.checks).every(Boolean) ? 'PASS' : 'FAIL';
  return out;
}

const sg = (x, d = 3) => (x == null ? 'n/a' : x > 0 ? `+${x.toFixed(d)}` : x.toFixed(d));
export function report(r) {
  const t1 = r.tests.T1, nOk = Object.values(r.checks).filter(Boolean).length;
  const head = `**Verdict: ${r.verdict}, ${nOk} of 4 checks: buying or selling gold's first retest of a daily three-candle gap made ${sg(t1.oos.net)}R a trade net in 2017-26 (n ${t1.oos.n}, month t ${t1.oos.tNet.toFixed(2)}); in sample ${sg(t1.is.net)}R (n ${t1.is.n}, t ${t1.is.tNet.toFixed(2)}).**`;
  const row = (name, s, win) => `| ${name} | ${win} | ${s.n} (${s.buys} / ${s.sells}) | ${sg(s.gross)} | ${sg(s.net)} | ${sg(s.net2x)} | ${s.costR.toFixed(3)} | ${s.finR.toFixed(3)} | ${s.costShare == null ? 'n/a' : s.costShare.toFixed(2)} | ${s.win} | ${s.stops} / ${s.targets} / ${s.times} | ${s.medianStop} | ${s.medianHoldDays} | ${s.tNet.toFixed(2)} | ${s.tGross.toFixed(2)} | ${s.dd.toFixed(1)} |`;
  const L = [];
  L.push('# Result: gold\'s daily three-candle gap, traded on its first retest (14 Nov 2026)', '', head, '',
    'Pre-registered in `PREREGISTRATION.md` (pushed alone, before `run.mjs` existed). Paper research only; a stand-alone daily rule,',
    'never a gate, exit, entry or size of the live gold book (Gold trend / Gold daily engulf), and none of that book\'s 2006-17',
    'positions was read (item 44). Nothing live changed and no proposal follows. Not the ICT desk\'s rule; ICT is untouched.', '',
    `Rule: OANDA mid H1 XAU_USD (${r.data.from} to ${r.data.to}, ${r.data.h1.toLocaleString('en-US')} candles) grouped into 17:00 New York days`,
    '(`gold-drd-long` `days()`). A day whose low is above the high of two days earlier by at least 0.25 x ATR14 leaves a bullish gap',
    '(a sell gap the mirror). The first H1 touch of the gap\'s near edge within 20 days fills a limit there (or the open beyond it);',
    'stop 0.5 x ATR14 past the gap\'s far edge, target 2R, out at the close of the 10th day after the fill; trades risking under $10',
    'are not taken. One position at a time. Net of $0.60 a round trip and, on buys, `nights` x `FIN.xau.long` (0.000148 of price a',
    'rollover). t on calendar-month sums of net R by exit month; Holm over three; placebo of 40 seeded draws (seed 20261114).', '',
    `Gaps found: ${r.data.gaps.buy} bullish, ${r.data.gaps.sell} bearish; ${r.data.retested} retested and traded as candidates, ${r.data.dead} opened past the stop on`,
    `the retest (no trade), ${r.data.skippedRisk} skipped for a risk under $10, the rest untouched within 20 days or at the data's end.`, '',
    '## Tests', '',
    '| Test | Window | n (buy / sell) | Gross R | Net R | Net R at 2x costs | Spread R | Financing R | Cost share | Win % | Stop / target / time | Median stop $ | Median hold days | Month t (net) | Month t (gross) | Worst drawdown R |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const names = { T1: 'T1 both sides (primary)', T2: 'T2 buys only', T3: 'T3 sells only' };
  for (const k of ['T1', 'T2', 'T3']) { L.push(row(names[k], r.tests[k].is, '2007-16'), row(names[k], r.tests[k].oos, '2017-26')); }
  for (const k of ['buy', 'sell']) { const nm = `Baseline: ${k} every day at market, stop 1 ATR`; L.push(row(nm, r.baseline[k].is, '2007-16'), row(nm, r.baseline[k].oos, '2017-26')); }
  L.push('', `Out-of-sample p (two-sided, normal) / Holm-adjusted: ${['T1', 'T2', 'T3'].map((k) => `${k} ${r.tests[k].oos.p.toFixed(2)} / ${r.tests[k].oos.holm.toFixed(2)}`).join(', ')}.`,
    'Cost share = (spread R + financing R) a trade / gross R a trade (n/a when gross is not positive).', '',
    '## Against the same-side baseline', '',
    '| Side | Window | Rule net R | Baseline net R | Difference |', '|---|---|---|---|---|');
  for (const [k, b] of [['T2', 'buy'], ['T3', 'sell']]) for (const w of ['is', 'oos'])
    L.push(`| ${b} | ${w === 'is' ? '2007-16' : '2017-26'} | ${sg(r.tests[k][w].net)} | ${sg(r.baseline[b][w].net)} | ${sg(r.tests[k][w].net - r.baseline[b][w].net)} |`);
  L.push('', '## Reading (written after the results)', '',
    `The gap adds nothing that holds in both windows. Before costs the both-sided stream was flat in 2007-16 (${sg(t1.is.gross)}R) and`,
    `${sg(t1.oos.gross)}R in 2017-26, the years gold rose most; its buys moved with buying gold on any day (difference to the buy`,
    `baseline ${sg(r.tests.T2.is.net - r.baseline.buy.is.net)}R in sample, ${sg(r.tests.T2.oos.net - r.baseline.buy.oos.net)}R out of sample) and its sells lost in both windows. The out-of-sample`,
    `month t ${t1.oos.tNet.toFixed(2)} sits below the placebo's 95th percentile. Not an edge; no proposal is written and nothing live changes.`, '',
    '## Placebo', '',
    `${r.placebo.draws} draws put T1's out-of-sample trades on random days with shuffled sides and the same risk in ATR units: month t median ${r.placebo.median.toFixed(2)}, 95th percentile (${r.placebo.p95.toFixed(2)}); ${r.placebo.atOrAbove} of ${r.placebo.draws} draws at or above the rule's ${t1.oos.tNet.toFixed(2)}.`, '',
    '## Checks', '',
    `1. Out-of-sample month t >= 2 and Holm p < 0.05: ${r.checks.oosT ? 'yes' : 'no'} (t ${t1.oos.tNet.toFixed(2)}, Holm p ${t1.oos.holm.toFixed(2)}).`,
    `2. In-sample net R a trade > 0: ${r.checks.isSign ? 'yes' : 'no'} (${sg(t1.is.net)}R).`,
    `3. Out-of-sample net at 2x costs > 0: ${r.checks.cost2x ? 'yes' : 'no'} (${sg(t1.oos.net2x)}R).`,
    `4. Above the placebo's 95th percentile: ${r.checks.placebo ? 'yes' : 'no'}.`, '',
    '## T1 by year (net R)', '', '| Year | n | Net R |', '|---|---|---|',
    ...Object.entries(r.yearsT1).map(([y, v]) => `| ${y} | ${v.n} | ${sg(v.net, 2)} |`), '');
  return L.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir);
  else if (cmd === 'full') {
    const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
    const r = study(h1);
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(r, null, 1) + '\n');
    fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(r));
    for (const [k, v] of Object.entries(r.tests)) for (const w of ['is', 'oos']) console.log(k, w, JSON.stringify(v[w]));
    console.log('base', JSON.stringify(r.baseline)); console.log('years', JSON.stringify(r.yearsT1));
    console.log('placebo', JSON.stringify({ ...r.placebo, tOOS: undefined }), 'checks', JSON.stringify(r.checks), r.verdict, JSON.stringify(r.data));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
