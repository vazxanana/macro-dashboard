// Edge research · index-vol-breakout-hourcost: index-vol-breakout (T1 on NAS100 / SPX500), unchanged, charged the demo broker's
// measured spread at each trade's fill hour and exit hour (PREREGISTRATION.md). Rule, days, placebo draws and the pass bar are
// imported from ../index-vol-breakout (unchanged); only the cost of each trade differs.
//   node research/edge/index-vol-breakout-hourcost/run.mjs <candleDir> <probeDir> [probeCommit]
//   (<candleDir>/nas100-5m.json.gz, spx500-5m.json.gz; <probeDir>/ticks-NAS100.json, ticks-US500.json)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildDays, vbTrade, placeboTrade, rng, summary, quantile } from '../index-vol-breakout/original.mjs';
import { MARKETS, T1, WINDOWS, SEEDS, PLACEBO, tradeDays, runMarket, placebo, decide, recost } from '../index-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BROKER = { nas100: 'NAS100', spx500: 'US500' };
export const MED_K = 12, EXIT_H = 20, MIN_WIN = 10;
export const CONDS = { C1: { key: 'frac', s: 0.05 }, C2: { key: 'frac90', s: 0.10 } };
const DAY = 86400, ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10), inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

// the gold costs study's slippage base: median high − low of the k M5 candles ending with candle i
export function medRange(bars, i, k = MED_K) { const rs = bars.slice(Math.max(0, i - k + 1), i + 1).map((b) => b.h - b.l); return rs.length ? quantile(rs, 0.5) : 0; }
// the round-trip cost of one trade in index points under a condition (hour profile hp, commission comm)
export function hourCost(hp, comm, cond, entry, hFill, M) {
  const f = (h) => hp[h] && hp[h][cond.key];
  return (0.5 * f(hFill) + 0.5 * f(EXIT_H) + comm) * entry + cond.s * M;
}
// the same R, charged a per-trade cost (cost2x = twice it); financing as the original (0 on every trade)
export function charge(x, cost) { const fin = x.finR || 0; return { ...x, cost, net: x.R - cost / x.r - fin, net2: x.R - 2 * cost / x.r - 2 * fin }; }
export function measurable(hp) { for (let h = 0; h <= EXIT_H; h++) if (!hp[h] || !(hp[h].frac >= 0) || !(hp[h].frac90 >= 0) || !((hp[h].n || 0) >= MIN_WIN)) return `hour ${h}: too few windows`; return null; }

export function tradesC(days, end, hp, comm, cond) {
  const tr = [];
  for (const d of tradeDays(days, end).out) {
    const x = vbTrade(d.bars, { k: T1.k, sides: T1.sides, prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    const i = d.bars.findIndex((b) => b.t === x.fillT), h = Math.floor(x.fillMin / 60);
    tr.push({ day: d.day, ...charge(x, hourCost(hp, comm, cond, x.entry, h, medRange(d.bars, i))) });
  }
  return tr;
}
// placebo with the original's draws (same seed, same order of rand() calls), each trade charged its own cost
export function placeboC(days, end, hp, comm, cond, seeds = SEEDS) {
  const pool = tradeDays(days, end).out, grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
      const x = placeboTrade(d.bars, { startT, side, dist: T1.k * d.prevRange, cost: 0 }); if (!x) continue;
      const i = d.bars.findIndex((b) => b.t >= startT), h = Math.floor((d.bars[i].t - d.d0) / 3600);
      tr.push(charge(x, hourCost(hp, comm, cond, x.entry, h, medRange(d.bars, i))));
    }
    res.push(r3(mean(tr.map((x) => x.net))));
  }
  return res;
}
const wins = (tr) => ({ IS: summary(tr.filter((t) => inW(t.day, WINDOWS.IS))), OOS: summary(tr.filter((t) => inW(t.day, WINDOWS.OOS))), ALL: summary(tr) });

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cdir, pdir, commit] = process.argv.slice(2);
  const orig = JSON.parse(fs.readFileSync(path.join(HERE, '../index-vol-breakout/result.json'), 'utf8'));
  const sym = JSON.parse(fs.readFileSync(path.join(pdir, 'symbols.json'), 'utf8'));
  const D = {}, gate = {}, prof = {}, meas = {};
  for (const [k, m] of Object.entries(MARKETS)) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cdir, m.file)))); rows.sort((a, b) => a[0] - b[0]);
    const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, end = ymdOf(lastFull - DAY), days = buildDays(rows.filter((r) => r[0] < lastFull));
    D[k] = { days, end };
    // harness gate: constant costs reproduce index-vol-breakout exactly
    const g = runMarket(days, m.cost, end).tr, w = wins(g), pl = placebo(days, m.cost, end), o = orig.markets[k];
    const same = ['IS', 'OOS', 'ALL'].every((x) => ['n', 'netR', 'grossR', 't'].every((f) => w[x][f] === o[x][f])) && JSON.stringify(pl) === JSON.stringify(orig.placebo[k].means) && end === orig.dataEnd;
    gate[k] = { same, end };
    const P = JSON.parse(fs.readFileSync(path.join(pdir, `ticks-${BROKER[k]}.json`), 'utf8')), hp = P.hourProfile || [];
    prof[k] = { commit: commit || null, at: P.at, reachDays: P.reachDays, hourProfile: hp, commissionRT: (sym.symbols[BROKER[k]] || {}).commissionRT ?? null };
    meas[k] = P.error ? P.error : measurable(hp);
  }
  if (!Object.values(gate).every((g) => g.same)) { console.log('HARNESS GATE FAILED', JSON.stringify(gate)); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'index-vol-breakout-hourcost', verdict: 'STOPPED: the harness gate failed', gate }, null, 1)); process.exit(1); }
  if (Object.values(meas).some(Boolean)) { console.log('NOT MEASURABLE', JSON.stringify(meas)); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'index-vol-breakout-hourcost', verdict: 'NOT MEASURABLE', meas, gate }, null, 1)); process.exit(0); }
  const out = {};
  for (const [c, cond] of Object.entries(CONDS)) {
    const res = {}, pl = {};
    for (const k of Object.keys(MARKETS)) { const { days, end } = D[k], hp = prof[k].hourProfile, comm = prof[k].commissionRT || 0;
      res[k] = wins(tradesC(days, end, hp, comm, cond)); pl[k] = placeboC(days, end, hp, comm, cond); }
    const dec = decide(res, pl);
    out[c] = { markets: res, placebo: Object.fromEntries(Object.entries(pl).map(([k, v]) => [k, { means: v, p95: r3(quantile(v, 0.95)) }])), decision: dec };
  }
  const d = out.C1.decision, n = Object.values(d).filter((x) => x.pass).length;
  const one = (k, s) => { const a = out.C1.markets[k].ALL; return `${s} ${a.netR}R net (n ${a.n}, month t ${a.t}; cost ${a.costR}R a trade; ${d[k].placeboBeaten} of 40 placebos beaten; ${d[k].pass ? 'passes' : 'fails: ' + Object.entries(d[k].checks).filter(([, v]) => !v).map(([q]) => q).join(', ')})`; };
  const verdict = `${n === 2 ? 'PASS, 2 of 2' : n === 1 ? 'PARTIAL, 1 of 2' : 'FAIL, 0 of 2'} at the demo's measured hourly spreads (C1): ${one('nas100', 'NAS100')}; ${one('spx500', 'SPX500')}`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'index-vol-breakout-hourcost', built: new Date().toISOString().slice(0, 10), verdict, gate, profile: prof, conditions: CONDS, ...out }, null, 1) + '\n');
  console.log(verdict);
  for (const c of Object.keys(CONDS)) for (const k of Object.keys(MARKETS)) for (const w of ['IS', 'OOS', 'ALL']) { const x = out[c].markets[k][w]; console.log(c, k, w, x.n, 'net', x.netR, 't', x.t, 'gross', x.grossR, 'cost', x.costR, '2x', x.net2R); }
  console.log(JSON.stringify({ C1: out.C1.decision, C2: out.C2.decision }));
}
