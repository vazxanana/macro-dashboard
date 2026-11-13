// After an extreme gold day, does the next day revert or continue? (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-shock-revert/run.mjs fetch <dir>   copies xau.json / xag.json from origin/council-data (git show, no network)
//   node research/edge/gold-shock-revert/run.mjs full <dir>    runs the test, writes result.json
// A new stand-alone daily rule judged on 2020 -> now; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 20, k: 2.0, hold: 3, decisive: '2020-01-01', replicationEnd: '2019-12-31', seeds: 40 };
export const COST = { xau: 0.30, xag: 0.03 };
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// rows [t, o, h, l, c, v] -> trading days (weekend candles folded into the next weekday)
export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// ATR(i) = mean true range of days i-n .. i-1 (never day i); null with fewer than n + 1 prior days
export function atrAt(ds, i, n = P.atrN) {
  if (i < n + 1) return null;
  let s = 0;
  for (let j = i - n; j < i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

// events: |C(i) - C(i-1)| > k x ATR(i), with three days after it on file
export function events(ds, k = P.k, n = P.atrN) {
  const out = [];
  for (let i = 1; i + P.hold < ds.length; i++) {
    const a = atrAt(ds, i, n); if (!a) continue;
    const mv = ds[i].close - ds[i - 1].close;
    if (Math.abs(mv) > k * a) out.push({ i, dir: mv > 0 ? 1 : -1, atr: a, t: ds[i].time });
  }
  return out;
}

// one trade: entry at the open of day i+1, stop 1 x ATR, out at the close of day i+3 or the stop (gap = the open)
export function trade(ds, ev, side, market = 'xau', cost = COST.xau) {
  const e = ev.i + 1, entry = ds[e].open, risk = ev.atr, stop = entry - side * risk;
  let exit = null, xi = null, why = 'time', xt = null;
  for (let j = e; j <= ev.i + P.hold; j++) {
    const b = ds[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; xi = j; why = 'gap'; xt = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; xi = j; why = 'stop'; xt = b.time + D / 2; break; }
  }
  if (exit == null) { xi = ev.i + P.hold; exit = ds[xi].close; xt = ds[xi].time + D; }
  const R = (exit - entry) / risk * side, costR = cost / risk;
  const f = FIN[market], rate = f && side > 0 ? f.long : 0, nn = rate > 0 ? nights(ds[e].time, xt) : 0, finR = nn * rate * entry / risk;
  return { d: ymd(ds[e].time), ei: e, xi, side, dir: ev.dir, entry, stop, exit, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

// a rule over events, one position at a time
export function run(ds, evs, rule, market = 'xau', cost = COST[market]) {
  const T = []; let busy = -1;
  for (const ev of evs) {
    if (ev.i + 1 <= busy) continue;
    const tr = trade(ds, ev, rule === 'R' ? -ev.dir : ev.dir, market, cost);
    T.push(tr); busy = tr.xi;
  }
  return T;
}

const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), y = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x >= 0 ? 1 - y : y; };
const r3 = (v) => +v.toFixed(3);
export function stats(T, key = 'net') {
  const n = T.length; if (!n) return { n: 0 };
  const xs = T.map((x) => x[key]), m = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0, t = sd > 0 ? m / (sd / Math.sqrt(n)) : 0;
  const w = xs.filter((v) => v > 0).length;
  return { n, mean: r3(m), total: +xs.reduce((a, b) => a + b, 0).toFixed(1), t: +t.toFixed(2), p: +(1 - Phi(t)).toFixed(4), win: +(w / n).toFixed(3) };
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run_ = 0;
  o.forEach(([p, i], k) => { run_ = Math.max(run_, Math.min(1, p * (ps.length - k))); adj[i] = run_; });
  return adj;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// placebo: as many random days as the window has events, direction = the day's own move sign
export function placebo(ds, nEv, from, rule, seed, market = 'xau') {
  const pool = [];
  for (let i = 1; i + P.hold < ds.length; i++) { if (ymd(ds[i + 1].time) < from) continue; const a = atrAt(ds, i); if (a) pool.push({ i, dir: ds[i].close >= ds[i - 1].close ? 1 : -1, atr: a }); }
  const rnd = mulberry32(seed), pick = [...pool];
  for (let k = pick.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [pick[k], pick[j]] = [pick[j], pick[k]]; }
  const evs = pick.slice(0, nEv).sort((a, b) => a.i - b.i);
  return stats(run(ds, evs, rule, market)).mean;
}

function block(ds, evs, market) {
  const dec = (x) => x.d >= P.decisive, rep = (x) => x.d <= P.replicationEnd;
  const out = {};
  for (const rule of ['R', 'C']) {
    const T = run(ds, evs, rule, market), a = T.filter(dec), b = T.filter(rep);
    const years = {}; for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || []).push(x); }
    out[rule] = {
      decisive: stats(a), decisiveGross: stats(a, 'R'), replication: stats(b), replicationGross: stats(b, 'R'),
      byShock: { up: stats(a.filter((x) => x.dir > 0)), down: stats(a.filter((x) => x.dir < 0)) },
      byShockReplication: { up: stats(b.filter((x) => x.dir > 0)), down: stats(b.filter((x) => x.dir < 0)) },
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((w) => [w, a.filter((x) => x.why === w).length])),
      costs: { costR: r3(a.reduce((s, x) => s + x.costR, 0)), finR: r3(a.reduce((s, x) => s + x.finR, 0)) },
      years: Object.fromEntries(Object.entries(years).map(([y, xs]) => [y, { n: xs.length, total: +xs.reduce((s, x) => s + x.net, 0).toFixed(2) }])),
    };
  }
  return out;
}

export function analyse(rows, market = 'xau') {
  const ds = toDays(rows), evs = events(ds);
  const nEvDec = evs.filter((e) => ymd(ds[e.i + 1].time) >= P.decisive).length;
  const res = block(ds, evs, market);
  const out = { data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length, events: evs.length, eventsDecisive: nEvDec, up: evs.filter((e) => e.dir > 0).length, down: evs.filter((e) => e.dir < 0).length }, rules: res };
  if (market !== 'xau') return out;
  const adj = holm(['R', 'C'].map((r) => res[r].decisive.p));
  out.placebo = {}; out.checks = {};
  ['R', 'C'].forEach((r, k) => {
    const ms = Array.from({ length: P.seeds }, (_, s) => placebo(ds, nEvDec, P.decisive, r, s + 1, market)).sort((a, b) => a - b);
    const p95 = ms[Math.ceil(0.95 * P.seeds) - 1], d = res[r].decisive;
    out.placebo[r] = { p95, median: ms[P.seeds / 2], min: ms[0], max: ms.at(-1) };
    out.checks[r] = { holmP: +adj[k].toFixed(4), positiveT2: d.mean > 0 && d.t >= 2 && adj[k] < 0.05, n40: d.n >= 40, sameSign: res[r].replication.mean > 0, placebo: d.mean > p95 };
    out.checks[r].pass = Object.values(out.checks[r]).every((v) => v === true);
  });
  out.verdict = out.checks.R.pass || out.checks.C.pass ? 'PASS' : 'FAIL';
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of ['xau', 'xag']) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  } else if (cmd === 'full') {
    const read = (k) => JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'));
    const xau = read('xau'), out = { built: '2026-11-13', params: P, costs: { gold: '$0.30 a round trip + FIN.xau.long financing on buys (council/fills.mjs)', silver: '$0.03 a round trip, no financing (no rate measured)' }, src: `OANDA daily via council-data research/daily (updated ${xau.updated})`, gold: analyse(xau.rows, 'xau') };
    if (fs.existsSync(path.join(dir, 'xag.json'))) out.silver = analyse(read('xag').rows, 'xag');
    out.verdict = out.gold.verdict;
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ data: out.gold.data, R: out.gold.rules.R.decisive, Rrep: out.gold.rules.R.replication, C: out.gold.rules.C.decisive, Crep: out.gold.rules.C.replication, placebo: out.gold.placebo, checks: out.gold.checks, verdict: out.verdict }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
