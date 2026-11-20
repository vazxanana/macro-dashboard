// Gold "interim bottom" in a bear regime: stretched below the 200-day and a strong 52-week dollar (research/edge/gold-interim-bottom;
// rules fixed in PREREGISTRATION.md). Paper research only: a stand-alone monthly rule, never a gate / entry / exit / size of the
// live gold book (decision 44). Public-proxy reconstruction with two of the brief's three conditions (no COT history on file).
//   node research/edge/gold-interim-bottom/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-interim-bottom/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';
import { dxyIndex, PAIRS } from '../gold-dxy-month-shock/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const BEAR_RUN = 20, PCT_LO = 0.30, PCT_HI = 0.70, MIN_PRIOR = 12, ATR_N = 20, STOP_ATR = 3, HOLD = 63, RT = 0.0001, STALE = 5 * DAY;
export const FROM = Date.UTC(2007, 0, 1) / 1000, SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const KEYS = ['xau', ...PAIRS];

export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

// rolling simple means
export function sma(closes, n) {
  const out = new Array(closes.length).fill(null); let s = 0;
  for (let i = 0; i < closes.length; i++) { s += closes[i]; if (i >= n) s -= closes[i - n]; if (i >= n - 1) out[i] = s / n; }
  return out;
}
export function atrAt(bars, i, n = ATR_N) {
  if (i - n < 0) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// percentile with linear interpolation (p in [0, 1])
export function pct(arr, p) {
  const a = [...arr].sort((x, y) => x - y); if (!a.length) return null;
  const h = (a.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
  return a[lo] + (a[hi] - a[lo]) * (h - lo);
}
// the latest series value with time <= t (series sorted), and its time
export function asOf(series, t) {
  let lo = 0, hi = series.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (series[m].time <= t) lo = m + 1; else hi = m; }
  return lo ? series[lo - 1] : null;
}
export function dollar52(dxy, t) {
  const a = asOf(dxy, t), b = asOf(dxy, t - 365 * DAY);
  if (!a || !b || t - a.time > STALE || t - 365 * DAY - b.time > STALE) return null;
  return a.close / b.close - 1;
}

// classify every month-end (indices into gold); thresholds from earlier bear month-ends only
export function monthEnds(gold, dxy) {
  const closes = gold.map((b) => b.close), s50 = sma(closes, 50), s200 = sma(closes, 200);
  const rows = [], prior = [];
  for (let i = 0; i < gold.length; i++) {
    const last = i === gold.length - 1 || ym(gold[i + 1].time) !== ym(gold[i].time);
    if (!last || i === gold.length - 1 || s200[i] == null) continue; // the last bar on file is not a known month-end
    let bear = i - BEAR_RUN + 1 >= 0;
    for (let k = i - BEAR_RUN + 1; bear && k <= i; k++) bear = s200[k] != null && s50[k] < s200[k];
    const x = gold[i].close / s200[i] - 1, D = dollar52(dxy, gold[i].time);
    const r = { i, t: gold[i].time, bear, x, D, priorN: prior.length, c1: false, c2: false, thrX: null, thrD: null };
    if (bear && prior.length >= MIN_PRIOR) {
      r.thrX = pct(prior.map((p) => p.x), PCT_LO);
      const ds = prior.map((p) => p.D).filter((v) => v != null);
      r.thrD = ds.length >= MIN_PRIOR ? pct(ds, PCT_HI) : null;
      r.c1 = x <= r.thrX; r.c2 = D != null && r.thrD != null && D >= r.thrD;
    }
    if (bear) prior.push({ x, D });
    rows.push(r);
  }
  return rows;
}

// the trade from month-end index i: long at the next open, 3 x ATR20 stop, out at the close of the 63rd day held
export function trade(gold, i) {
  const e = i + 1; if (e >= gold.length) return null;
  const atr = atrAt(gold, i); if (!atr) return null;
  const entry = gold[e].open, risk = STOP_ATR * atr, stop = entry - risk;
  const lastIdx = e + HOLD - 1; if (lastIdx >= gold.length) return null; // the hold does not complete on file
  let exit = null, exitIdx = null, how = 'time';
  for (let k = e; k <= lastIdx; k++) {
    const b = gold[k];
    if (k > e && b.open <= stop) { exit = b.open; exitIdx = k; how = 'gap'; break; }
    if (b.low <= stop) { exit = Math.min(stop, b.open); exitIdx = k; how = 'stop'; break; }
  }
  if (exit == null) { exitIdx = lastIdx; exit = gold[lastIdx].close; }
  const cost = RT * entry + nights(gold[e].time, gold[exitIdx].time + DAY - 1) * FIN.xau.long * entry;
  return { t: gold[i].time, entryT: gold[e].time, exitT: gold[exitIdx].time, exitIdx, entry, stop, exit, how, risk,
    gross: (exit - entry) / risk, net: (exit - entry - cost) / risk, cost: cost / risk, ret3m: gold[lastIdx].close / entry - 1 };
}

// one position at a time over a list of month-end rows
export function stream(gold, rows, oneAtATime = true) {
  const out = []; let busyTo = -1;
  for (const r of rows) {
    if (oneAtATime && r.i < busyTo) continue;
    const tr = trade(gold, r.i); if (!tr) continue;
    out.push(tr); if (oneAtATime) busyTo = tr.exitIdx;
  }
  return out;
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdv = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export const tStat = (a) => a.length > 1 && sdv(a) > 0 ? mean(a) / (sdv(a) / Math.sqrt(a.length)) : null;
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const va = sdv(a) ** 2 / a.length, vb = sdv(b) ** 2 / b.length;
  return (mean(a) - mean(b)) / Math.sqrt(va + vb);
}
// one-sided p from the normal approximation
export const pOne = (t) => t == null ? 1 : 0.5 * erfc(t / Math.SQRT2);
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
// exact two-sided 95 % binomial (Clopper-Pearson) by bisection on the beta tail sums
function binomCdf(k, n, p) { let s = 0, c = 1; for (let j = 0; j <= k; j++) { if (j) c = c * (n - j + 1) / j; s += c * p ** j * (1 - p) ** (n - j); } return s; }
export function clopper(k, n) {
  if (!n) return [null, null];
  const solve = (f) => { let lo = 0, hi = 1; for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if (f(m)) lo = m; else hi = m; } return (lo + hi) / 2; };
  const lower = k === 0 ? 0 : solve((p) => 1 - binomCdf(k - 1, n, p) < 0.025);
  const upper = k === n ? 1 : solve((p) => binomCdf(k, n, p) > 0.025);
  return [lower, upper];
}
const r4 = (v) => v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4;
const median = (a) => a.length ? pct(a, 0.5) : null;
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function summary(trs) {
  const net = trs.map((x) => x.net), rets = trs.map((x) => x.ret3m), up = rets.filter((v) => v > 0).length, ci = clopper(up, rets.length);
  return { n: trs.length, net: trs.length ? r4(mean(net)) : null, gross: trs.length ? r4(mean(trs.map((x) => x.gross))) : null,
    t: r4(tStat(net)), win: trs.length ? r4(net.filter((v) => v > 0).length / trs.length) : null, stops: trs.filter((x) => x.how !== 'time').length,
    up3m: up, hit3m: rets.length ? r4(up / rets.length) : null, hitCI: ci.map(r4), median3m: r4(median(rets)), mean3m: rets.length ? r4(mean(rets)) : null };
}

export function study(dir) {
  const gold = load(dir, 'xau'), fx = Object.fromEntries(PAIRS.map((k) => [k, load(dir, k)])), dxy = dxyIndex(fx);
  const all = monthEnds(gold, dxy).filter((r) => r.t >= FROM);
  const bear = all.filter((r) => r.bear), judged = bear.filter((r) => r.priorN >= MIN_PRIOR);
  const pick = { S2: (r) => r.bear && r.c1 && r.c2, S1: (r) => r.bear && (r.c1 || r.c2), C1: (r) => r.bear && r.c1, C2: (r) => r.bear && r.c2 };
  const streams = Object.fromEntries(Object.entries(pick).map(([k, f]) => [k, stream(gold, all.filter(f))]));
  const B = stream(gold, bear, false), M = stream(gold, all, false);
  const s2 = streams.S2, halves = [s2.filter((x) => x.t < SPLIT), s2.filter((x) => x.t >= SPLIT)];
  const t1 = tStat(s2.map((x) => x.net)), t2 = welch(s2.map((x) => x.net), B.map((x) => x.net));
  const p = [pOne(t1), pOne(t2)], order = p[0] <= p[1] ? [0, 1] : [1, 0], holm = [null, null];
  holm[order[0]] = Math.min(1, p[order[0]] * 2); holm[order[1]] = Math.min(1, Math.max(holm[order[0]], p[order[1]]));
  const halvesOk = halves.every((h) => h.length < 3 || mean(h.map((x) => x.net)) > 0);
  const T1 = { id: 'T1', what: 'S2 long trades, net R > 0, t >= 2, both halves (3+ trades) > 0', ...summary(s2), halves: halves.map(summary), halvesOk,
    p: r4(p[0]), holm: r4(holm[0]), pass: s2.length > 1 && mean(s2.map((x) => x.net)) > 0 && t1 >= 2 && halvesOk && holm[0] < 0.05 };
  const T2 = { id: 'T2', what: 'S2 minus every bear month-end (baseline B), net R, Welch t >= 2', diff: s2.length && B.length ? r4(mean(s2.map((x) => x.net)) - mean(B.map((x) => x.net))) : null,
    t: r4(t2), p: r4(p[1]), holm: r4(holm[1]), pass: t2 != null && t2 >= 2 && holm[1] < 0.05 };
  const pass = T1.pass && T2.pass;
  const episodes = (() => { let n = 0, prev = null; for (const r of all) { if (r.bear && (prev == null || !prev)) n++; prev = r.bear; } return n; })();
  const verdict = pass ? `PASS: S2 +${T1.net}R a trade net (n ${T1.n}, t ${T1.t}); S2 minus bear baseline ${T2.diff}R (Welch t ${T2.t})`
    : `FAIL: S2 (bear regime, gold in the lowest 30 % of its 200-day stretch, dollar in the top 30 % of its 52-week change) ${T1.net == null ? 'no trade' : `${T1.net >= 0 ? '+' : ''}${T1.net}R a trade net (n ${T1.n}, t ${T1.t})`}; minus the bear baseline ${T2.diff}R (Welch t ${T2.t})`;
  return {
    data: { gold: [day(gold[0].time), day(gold.at(-1).time)], dxy: [day(dxy[0].time), day(dxy.at(-1).time)] },
    counts: { monthEnds: all.length, bear: bear.length, bearJudged: judged.length, bearTooEarly: bear.length - judged.length, bearEpisodes: episodes,
      c1: judged.filter((r) => r.c1).length, c2: judged.filter((r) => r.c2).length, both: judged.filter((r) => r.c1 && r.c2).length },
    signals: all.filter(pick.S2).map((r) => ({ month: day(r.t), x: r4(r.x), thrX: r4(r.thrX), D: r4(r.D), thrD: r4(r.thrD) })),
    tests: [T1, T2], pass,
    reported: { S1: summary(streams.S1), C1: summary(streams.C1), C2: summary(streams.C2), bearAll: summary(B), allMonths: summary(M) },
    trades: s2.map((x) => ({ month: day(x.t), entry: r4(x.entry), exit: r4(x.exit), how: x.how, exitDay: day(x.exitT), gross: r4(x.gross), net: r4(x.net), ret3m: r4(x.ret3m) })),
    verdict,
  };
}

const main = () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const sha = execFileSync('git', ['rev-parse', 'origin/council-data'], { encoding: 'utf8' }).trim();
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `${sha}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'SOURCE'), sha + '\n');
    console.log('council-data', sha, '->', dir);
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Gold "interim bottom" in a bear regime: 200-day stretch and a strong 52-week dollar (public proxy, two of three conditions)',
      built: '2026-11-20', prereg: 'PREREGISTRATION.md', councilData: src, system: 'gold, monthly, long only',
      rule: { bear: `SMA50 < SMA200 on each of the last ${BEAR_RUN} trading days`, c1: `close / SMA200 - 1 at or below the ${PCT_LO * 100}th percentile of earlier bear month-ends`,
        c2: `52-week DXY change at or above the ${PCT_HI * 100}th percentile of earlier bear month-ends`, minPrior: MIN_PRIOR,
        trade: `long at the next open, stop ${STOP_ATR} x ATR${ATR_N}, out after ${HOLD} trading days`, cost: `${RT} x entry + nights() x FIN.xau.long x entry` },
      fin: FIN.xau.long, ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ data: r.data, counts: r.counts, signals: r.signals, tests: r.tests, reported: r.reported }, null, 1));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
