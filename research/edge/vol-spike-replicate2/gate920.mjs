// Edge research · vol-spike-replicate (PREREGISTRATION.md, committed alone first).
// Frozen replication of vol-spike-rebound (#860): the rule's own code is frozen.mjs (byte for byte, sha256 pinned in the
// test), imported here and never edited. 10-day hold only, on seven index markets #860 did not use.
//   node run.mjs fetch <dir>   copies the daily candles (10 markets) + macro/cache.json + #860's result.json (git show, no network)
//   node run.mjs full <dir>    gate on #860's markets, then R1 / R2 / R3, placebo, 2x costs; writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { candles, simulate, net, summary, tstat, normP, holm, rng, randomTrades, pct, study, MARKETS as OLD } from './frozen.mjs';

export const H = 10;
export const NEW = { de40: { cost: 2.0 }, uk100: { cost: 2.0 }, eu50: { cost: 2.0 }, fr40: { cost: 2.0 }, au200: { cost: 3.0 }, jp225: { cost: 10.0 }, hk33: { cost: 15.0 } };
export const WIN = { R1: ['2016-01-01', '2099-12-31'], R2: ['2005-01-01', '2015-12-31'] };
export const SEEDS = 40, SEED0 = 7000;
const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// #860's week key (its post-hoc cluster diagnostic): entries grouped by floor((tIn - 4 days) / 7 days)
export const weekOf = (t) => Math.floor((t - 4 * DAY) / (7 * DAY));
// R3: one observation per week = the MEAN net R of the trades entered that week
export function weekly(trades, key = 'R') {
  const m = new Map();
  for (const t of trades) { const k = weekOf(t.tIn); (m.get(k) || m.set(k, []).get(k)).push(t[key]); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, xs]) => mean(xs));
}
// 2x costs: spread and financing doubled, R recomputed from the stored parts
export const twice = (t, cost) => ({ ...t, R: (t.exit - t.entry - 2 * cost - 2 * t.fin) / t.risk });
const inW = (t, [from, to]) => t.tIn >= T(from) && t.tIn <= T(to) + DAY - 1;
const stat = (xs) => { const t = tstat(xs); return { n: xs.length, avgR: r3(mean(xs)), t: r2(t), p: t == null ? null : +normP(t).toFixed(4) }; };

export function reading(R1, R2, R3) {
  const ok = (x) => x.avgR > 0 && x.t >= 2 && x.holm.pass;
  if (ok(R1) && ok(R3) && R2.avgR > 0) return 'REPLICATES';
  if (R1.avgR > 0 && R1.t >= 1) return 'PARTLY';
  return 'DOES NOT REPLICATE';
}

export function replicate(data, rates) {
  const Ds = Object.fromEntries(Object.keys(NEW).map((k) => [k, candles(data[k].rows)]));
  const lastDay = ymd(Math.min(...Object.values(Ds).map((D) => D.at(-1).time)));
  const win = (w) => [WIN[w][0], WIN[w][1] > lastDay ? lastDay : WIN[w][1]];
  const pool = { R1: [], R2: [] }, per = {};
  for (const [k, m] of Object.entries(NEW)) {
    const all = simulate(Ds[k], H).map((t) => ({ ...net(t, m.cost, rates), mk: k, cost: m.cost }));
    per[k] = { from: ymd(Ds[k][0].time), to: ymd(Ds[k].at(-1).time), days: Ds[k].length };
    for (const w of ['R1', 'R2']) { const tr = all.filter((t) => inW(t, win(w))); pool[w].push(...tr); per[k][w] = summary(tr, ...win(w)); }
    per[k].years = {};
    for (const t of all) { const y = ymd(t.tIn).slice(0, 4); const o = (per[k].years[y] ||= { n: 0, sumR: 0 }); o.n++; o.sumR += t.R; }
    for (const o of Object.values(per[k].years)) o.sumR = r2(o.sumR);
  }
  const R1 = { from: win('R1')[0], to: win('R1')[1], ...summary(pool.R1, ...win('R1')), ...stat(pool.R1.map((t) => t.R)) };
  const R2 = { from: win('R2')[0], to: win('R2')[1], ...summary(pool.R2, ...win('R2')), ...stat(pool.R2.map((t) => t.R)) };
  const R3 = { by: 'entry week, mean net R of the week', ...stat(weekly(pool.R1)) };
  const h = holm([R1.p, R3.p]);
  R1.holm = { adj: +h[0].adj.toFixed(4), pass: h[0].pass }; R3.holm = { adj: +h[1].adj.toFixed(4), pass: h[1].pass };
  // placebo: same count per market in R1's window, uniform random signal days, frozen randomTrades
  const seeds = [...Array(SEEDS)].map((_, s) => {
    const R = rng(SEED0 + s + 1), tr = [];
    for (const [k, m] of Object.entries(NEW)) tr.push(...randomTrades(Ds[k], per[k].R1.n, H, m.cost, rates, ...win('R1'), R));
    return mean(tr.map((t) => t.R));
  });
  const placebo = { seeds: SEEDS, seedFrom: SEED0 + 1, mean: r3(mean(seeds)), p95: r3(pct(seeds, 0.95)), beats: seeds.filter((x) => mean(pool.R1.map((t) => t.R)) > x).length, values: seeds.map(r3) };
  const x2 = (tr) => tr.map((t) => twice(t, t.cost));
  const costs2x = { R1: stat(x2(pool.R1).map((t) => t.R)), R2: stat(x2(pool.R2).map((t) => t.R)), R3: stat(weekly(x2(pool.R1))) };
  return { reading: reading(R1, R2, R3), lastDay, R1, R2, R3, placebo, costs2x, markets: per };
}

// ── CLI ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: node run.mjs fetch|full <dir>'); process.exit(2); }
  const keys = [...Object.keys(OLD), ...Object.keys(NEW)];
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const show = (ref, p) => execFileSync('git', ['show', `${ref}:${p}`], { cwd: HERE, maxBuffer: 1 << 28 });
    for (const k of keys) fs.writeFileSync(path.join(dir, k + '.json'), show('origin/council-data', `research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, 'cache.json'), show('origin/council-data', 'macro/cache.json'));
    fs.writeFileSync(path.join(dir, 'published-860.json'), show('origin/vol-spike-rebound', 'research/edge/vol-spike-rebound/result.json'));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const data = Object.fromEntries(keys.map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json')))]));
    const rates = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'))).score.fred.DGS2;
    const published = JSON.parse(fs.readFileSync(path.join(dir, 'published-860.json'))).holds['10'];
    const reproduced = JSON.parse(JSON.stringify(study(data, rates).holds['10']));
    const equal = JSON.stringify(reproduced) === JSON.stringify(published);
    const gate = { what: "frozen study() on #860's markets, holds['10'] against #860's committed result.json", source: 'origin/vol-spike-rebound 8389fe6', equal, published };
    if (!equal) { console.error('GATE FAILED'); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ built: '2026-11-14', gate, reading: 'gate failed' }, null, 1) + '\n'); process.exit(1); }
    const r = replicate(data, rates);
    const out = {
      built: '2026-11-14', title: 'Frozen replication of the vol-spike rebound on seven other index markets', verdict: r.reading, reading: r.reading,
      system: "#860's rule frozen (frozen.mjs, byte for byte): long when 5-day realised vol > 2 x its prior 120-day median and close < SMA20, fill next open, hold 10 trading days, stop 3 x ATR(20)",
      costs: { spreadPoints: Object.fromEntries(Object.entries(NEW).map(([k, m]) => [k, m.cost])), financing: "DGS2 + 2.5 % a year per calendar night for every market (#860's method; no other currency's rate series on file)" },
      src: 'OANDA mid daily candles, council-data research/daily/<key>.json; DGS2 from council-data macro/cache.json',
      windows: WIN, gate, ...r,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ gate: equal, reading: r.reading, R1: r.R1, R2: r.R2, R3: r.R3, placebo: { ...r.placebo, values: undefined }, costs2x: r.costs2x }, null, 1));
  }
}
