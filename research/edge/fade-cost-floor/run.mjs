// research/edge/fade-cost-floor/run.mjs - the cost-floor test of PREREGISTRATION.md (24 Nov 2026): the five Equinox fade /
// gap rules, each from its study's own exported signal code (through council/edge-desks-2.mjs, unchanged), kept only where
// cost_R = COSTS[market] / risk at entry is at most 0.03 / 0.05 / 0.10, judged AFTER costs, discovery 2005-14, confirmation
// 2015-26, month-sum t, Holm over 15 tests, a seeded coin-side control.
// Research only: nothing live imports it, nothing is placed.
//   node research/edge/fade-cost-floor/run.mjs market <m> <outDir>     one market's trades -> <outDir>/<m>.json
//   node research/edge/fade-cost-floor/run.mjs report <outDir>          pool, gate, tests -> result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import * as FADE from '../grid7-wide-fade/run.mjs';
import * as BIG from '../big-candle-fade/run.mjs';
import * as RND from '../round-number-breaks/run.mjs';
import * as BOX from '../grid6-box-in-box/run.mjs';
import { CELLS as FB_CELLS } from '../fade-breaks-holdout/run.mjs';
import * as FVG from '../grid7-fvg-wide/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (yr, m = 0) => Date.UTC(yr, m, 1) / 1000;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);
export const NM = 262, DM = 120;                     // months 2005-01 .. 2026-10; discovery = the first 120
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const MARKETS = FADE.MARKETS;                 // the ten markets of the five studies
export const ASSUMED = FADE.ASSUMED;                 // costs not measured on the demo account
export const MEASURED = MARKETS.filter((m) => !ASSUMED.includes(m));
export const FLOORS = [0.03, 0.05, 0.10];
export const SEED = 20261124;
export const RULES = ['fade', 'bigfade', 'roundfade', 'boxfade', 'fvg'];
export const RULE_NAME = { fade: 'Break fade (m15 none atr 2R all)', bigfade: 'Big-candle fade (m15 k1.5 nobreak half)',
  roundfade: 'Round-number fade (fade other 2R)', boxfade: 'Box fade (F1)', fvg: 'FVG return (1h mkt large 1R)' };
export const CAPS = { fade: FADE.CAP[FADE.TFS[1]], bigfade: FADE.CAP[BIG.TFS[0]], roundfade: RND.CAP, boxfade: BOX.CAPS[FB_CELLS.F1.ch], fvg: FVG.CAP['1h'] };
// the studies' published before-cost figures (RESULT.md rows; box fade: holdout set A, 5 read markets, fills 2005-2009)
export const GATE = {
  fade: { d: { n: 171523, mean: 0.054 }, c: { n: 201769, mean: 0.042 } },
  bigfade: { d: { n: 47354, mean: 0.307 }, c: { n: 54443, mean: 0.193 } },
  roundfade: { d: { n: 94188, mean: 0.102 }, c: { n: 88734, mean: 0.051 } },
  fvg: { d: { n: 45278, mean: 0.042 }, c: { n: 52659, mean: 0.035 } },
  boxfade: { A: { n: 29000, mean: 0.0573 } },
};

// ---- the selection: known at the entry only (fill and stop as placed), never the outcome --------------------------------
export const costR = (market, entry, stop) => COSTS[market] / Math.abs(entry - stop);
export const keep = (tr, floor) => tr.cr <= floor;

// ---- one market ---------------------------------------------------------------------------------------------------------
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
export async function runMarket(market) {
  const D = await import('../../../council/edge-desks-2.mjs');
  const READ = { fade: D.fadeTrades, bigfade: D.bigTrades, roundfade: D.roundTrades, boxfade: D.boxTrades, fvg: D.fvgTrades };
  const raw = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const B = { '5m': raw.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })) };
  const M5 = D.toK(B['5m']), idx = new Map(M5.map((b, i) => [b.t, i])), X = exclusions(market), rows = [];
  const counts = {};
  for (const [ri, rule] of RULES.entries()) {
    const recs = READ[rule](B, { from: FROM, market }); let dropped = 0, open = 0, out = 0, n = 0;
    for (const r of recs) {
      if (r.t < FROM || r.t >= TO) { out++; continue; }
      if (X.length && inBad(X, r.t)) { dropped++; continue; }
      if (r.status === 'open' || !Number.isFinite(r.R)) { open++; continue; }
      const s = r.side, fill = r.entry, risk = s * (fill - r.stop);
      if (!(risk > 0)) throw new Error('stop on the wrong side ' + r.id);
      const fi = idx.get(r.t); if (fi == null || M5[fi].o !== fill) throw new Error('fill not found ' + r.id);
      const k = r.target == null ? null : (s * (r.target - fill)) / risk;
      const m = D.walk(M5, -s, fi, fill, fill + s * risk, k == null ? null : fill - s * k * risk, M5[fi].t + CAPS[rule], true);
      if (!m || m.status === 'open') { open++; continue; }
      n++;
      rows.push([ri, r.t, s, +costR(market, fill, r.stop).toFixed(6), +r.R.toFixed(6), +m.R.toFixed(6)]);
    }
    counts[rule] = { n, dropped, open, outside: out };
  }
  return { market, cost: COSTS[market], assumed: ASSUMED.includes(market), counts, rows };
}

// ---- statistics ---------------------------------------------------------------------------------------------------------
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function mt(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let i = a; i < b; i++) { s += ms[i]; q += ms[i] * ms[i]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : null;
  return { months: n, t, p: t == null ? 1 : p1(t, n - 1) }; }
// trades: [{ t, v }] -> per window n, mean, month t
export function win(trades, val) {
  const ms = new Float64Array(NM); const w = [{ n: 0, s: 0 }, { n: 0, s: 0 }];
  for (const x of trades) { const v = val(x), m = monthOf(x.t); ms[m] += v; const k = x.t < SPLIT ? 0 : 1; w[k].n++; w[k].s += v; }
  const one = (k, a, b) => ({ n: w[k].n, mean: w[k].n ? w[k].s / w[k].n : null, ...mt(ms, a, b) });
  return { d: one(0, 0, DM), c: one(1, DM, NM) };
}
export function coins(trades, seed = SEED) { const r = K.rng(seed); return trades.map(() => r() < 0.5); }
const r4 = (v) => (v == null ? null : +v.toFixed(4)), r2 = (v) => (v == null ? null : +v.toFixed(2));
const pack = (w) => ({ d: { n: w.d.n, mean: r4(w.d.mean), t: r2(w.d.t) }, c: { n: w.c.n, mean: r4(w.c.mean), t: r2(w.c.t), p: w.c.p } });

export function judgeOne(trades, seed = SEED) {
  const flip = coins(trades, seed);
  const net = win(trades, (x) => x.R - x.cr), gross = win(trades, (x) => x.R), mir = win(trades, (x) => x.Rm - x.cr);
  const coin = win(trades.map((x, i) => ({ ...x, i })), (x) => (flip[x.i] ? x.R : x.Rm) - x.cr);
  const diff = win(trades.map((x, i) => ({ ...x, i })), (x) => x.R - (flip[x.i] ? x.R : x.Rm));
  return { net: pack(net), gross: pack(gross), mirror: pack(mir), coin: pack(coin), diff: pack(diff) };
}

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const all = []; for (const d of data) for (const r of d.rows) all.push({ rule: RULES[r[0]], market: d.market, t: r[1], s: r[2], cr: r[3], R: r[4], Rm: r[5] });
  all.sort((a, b) => a.t - b.t || (a.market < b.market ? -1 : a.market > b.market ? 1 : 0));
  // gate
  const gate = {};
  for (const rule of RULES) {
    const T = all.filter((x) => x.rule === rule), g = GATE[rule];
    if (rule === 'boxfade') {
      const A = T.filter((x) => MEASURED.includes(x.market) && x.t < y(2010)); const mean = A.reduce((a, x) => a + x.R, 0) / A.length;
      const ok = Math.abs(A.length - g.A.n) / g.A.n <= 0.02 && Math.abs(mean - g.A.mean) <= 0.01;
      gate[rule] = { A: { n: A.length, mean: r4(mean), want: g.A }, ok };
    } else {
      const w = win(T, (x) => x.R); const ok = ['d', 'c'].every((k) => Math.abs(w[k].n - g[k].n) / g[k].n <= 0.02 && Math.abs(w[k].mean - g[k].mean) <= 0.01);
      gate[rule] = { d: { n: w.d.n, mean: r4(w.d.mean), want: g.d }, c: { n: w.c.n, mean: r4(w.c.mean), want: g.c }, ok };
    }
  }
  // the 15 tests
  const tests = [];
  for (const [ri, rule] of RULES.entries()) for (const [fi, floor] of FLOORS.entries()) {
    const T = all.filter((x) => x.rule === rule), Kp = T.filter((x) => keep(x, floor));
    const j = judgeOne(Kp, SEED + ri * 10 + fi);
    const meas = judgeOne(Kp.filter((x) => MEASURED.includes(x.market)), SEED + ri * 10 + fi);
    const byMarket = Object.fromEntries(MARKETS.map((m) => { const w = win(Kp.filter((x) => x.market === m), (x) => x.R - x.cr); return [m, { d: { n: w.d.n, mean: r4(w.d.mean) }, c: { n: w.c.n, mean: r4(w.c.mean), t: r2(w.c.t) } }]; }));
    const byYear = {}; for (const x of Kp) { const yr = new Date(x.t * 1000).getUTCFullYear(); const b = (byYear[yr] ||= { n: 0, net: 0 }); b.n++; b.net += x.R - x.cr; }
    for (const k of Object.keys(byYear)) byYear[k] = { n: byYear[k].n, mean: r4(byYear[k].net / byYear[k].n) };
    const share = { d: Kp.filter((x) => x.t < SPLIT).length / Math.max(1, T.filter((x) => x.t < SPLIT).length), c: Kp.filter((x) => x.t >= SPLIT).length / Math.max(1, T.filter((x) => x.t >= SPLIT).length) };
    const fullNet = pack(win(T, (x) => x.R - x.cr)), fullGross = pack(win(T, (x) => x.R));
    tests.push({ rule, name: RULE_NAME[rule], floor, valid: gate[rule].ok, ...j, measured: { net: meas.net, gross: meas.gross }, byMarket, byYear,
      share: { d: r4(share.d), c: r4(share.c) }, full: { net: fullNet, gross: fullGross } });
  }
  const holm = K.holm(tests.map((x) => x.net.c.p));
  for (const [i, x] of tests.entries()) {
    x.holm = holm[i];
    const c1 = x.net.d.mean > 0 && x.net.c.mean > 0, c2 = x.net.c.n >= 200, c3 = x.net.c.t >= 2 && x.holm < 0.05;
    const c4 = !(x.coin.c.mean > 0 && x.coin.c.t >= 2) && x.diff.c.t >= 2;
    x.checks = { bothPositive: c1, n200: c2, monthT: c3, control: c4 };
    x.pass = x.valid && c1 && c2 && c3 && c4;
    x.onlyN = x.valid && !c2 && c1 && x.net.c.mean > 0;
  }
  const passes = tests.filter((x) => x.pass), invalid = RULES.filter((r) => !gate[r].ok);
  const verdict = passes.length ? 'PASS' : tests.filter((x) => x.valid).every((x) => !x.pass && !x.checks.n200 && x.checks.bothPositive) ? 'INCONCLUSIVE' : 'FAIL';
  const counts = Object.fromEntries(data.map((d) => [d.market, d.counts]));
  const out = { study: 'fade-cost-floor', built: new Date().toISOString().slice(0, 10), verdict, passes: passes.length, tests: tests.length,
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' },
    markets: MARKETS, assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), floors: FLOORS, seed: SEED,
    gate, invalid, counts, tests };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  return out;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const r = await runMarket(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r));
    console.log(a, JSON.stringify(r.counts)); }
  else if (cmd === 'report') { const r = report(a); console.log(r.verdict, r.passes + ' / ' + r.tests.length, JSON.stringify(r.gate)); }
  else console.log('usage: run.mjs market <m> <outDir> | report <outDir>');
}
