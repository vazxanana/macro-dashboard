// Edge research · vol-spike-replicate2 (PREREGISTRATION.md, committed alone first).
// Second frozen replication of vol-spike-rebound (#860): the rule's own code is frozen.mjs (byte for byte, sha256 pinned in
// the test), #920's study code is gate920.mjs (byte for byte, pinned); both imported, never edited. 10-day hold only, on every
// (market, year) cell of the council's daily index cache that neither #860 nor #920 used.
//   node run.mjs fetch <dir>   copies the daily candles (17 indices) + macro/cache.json + #920's result.json (git show, no network)
//   node run.mjs full <dir>    gate on #920, then the primary test, secondary rows, placebo, Fisher; writes result.json
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { candles, simulate, net, summary, tstat, monthSums, signals, atr, hold, holm, rng, pct, P, MARKETS as US } from './frozen.mjs';
import { replicate, NEW as R920, twice } from './gate920.mjs';

export const H = 10;
export const END = '2026-11-06';
// N: new markets, every entry. E: earlier entries of the markets #860 / #920 used (before the cut).
export const N = { us2000: { cost: 0.5 }, ch20: { cost: 4.0 }, nl25: { cost: 0.3 }, es35: { cost: 8.0 }, cn50: { cost: 10.0 }, sg30: { cost: 0.4 }, in50: { cost: 6.0 } };
export const E = {
  ...Object.fromEntries(Object.entries(US).map(([k, m]) => [k, { cost: m.cost, before: '2008-01-01' }])),
  ...Object.fromEntries(Object.entries(R920).map(([k, m]) => [k, { cost: m.cost, before: '2005-01-01' }])),
};
export const SPLIT = '2016-01-01';
export const SEEDS = 40, SEED0 = 9000, MIN_TEST = 10;
export const ORIGINAL = { id: '#860 vol-spike-rebound: 10-day hold', cell: 'US indices x 2016-26', t: 2.53, p: 0.0057 };
export const R920T = { R1: 1.2, R2: -0.52 };
export const BONFERRONI = 0.05 / 333;
const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
const r6 = (v) => (Number.isFinite(v) ? +v.toPrecision(6) : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// ── normal and Fisher (the functions of multiple-testing-update's run.mjs, copied) ──
export function erfc(x) {
  const z = Math.abs(x); const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const Phi = (x) => 0.5 * erfc(-x / Math.SQRT2);
export const pOneSided = (t) => 1 - Phi(t);
export function chi2SfEven(x, df) { let term = 1, sum = 1; for (let k = 1; k < df / 2; k++) { term *= x / 2 / k; sum += term; } return Math.exp(-x / 2) * sum; }
export function fisher(ps) { const x = -2 * ps.reduce((a, p) => a + Math.log(p), 0); const df = 2 * ps.length; return { x: +x.toFixed(4), df, p: chi2SfEven(x, df) }; }
export function PhiInv(p) { let lo = -40, hi = 40; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
const zOf = (p) => +(-PhiInv(p)).toFixed(4);

// ── helpers ──
export const gross0 = (t) => ({ ...t, R: (t.exit - t.entry) / t.risk });
export function ddOf(tr) { let eq = 0, pk = 0, dd = 0; for (const x of [...tr].sort((a, b) => a.tOut - b.tOut).map((t) => t.R)) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); } return r2(dd); }
const monthFrom = (tr) => ymd(Math.min(...tr.map((t) => t.tIn))).slice(0, 7) + '-01';
// net = true: the stored net % fields are shown; for a re-costed copy (2x, zero) only R fields are meaningful
export function block(tr, netPct = true) {
  if (!tr.length) return { n: 0 };
  const from = monthFrom(tr), s = summary(tr, from, END), t = tstat(tr.map((x) => x.R));
  if (!netPct) { delete s.avgRet; delete s.avgGross; }
  return { from, to: END, ...s, tTrades: r2(t), p: t == null ? null : r6(pOneSided(r2(t))), tMonths: r2(tstat(monthSums(tr, from, END))) };
}
const inCell = (k, t) => (N[k] ? true : t.tIn < T(E[k].before)) && t.tIn <= T(END) + DAY - 1;

// placebo: per market the same count, uniform signal days of the cell that are NOT signal days, frozen hold + net
export function placeboTrades(D, count, cost, rates, cellOf, R) {
  const sig = signals(D), elig = [];
  for (let i = P.ATR_N; i < D.length - 1; i++) if (!sig[i] && cellOf(D[i + 1].time) && atr(D, i) > 0) elig.push(i);
  const out = [];
  for (let c = 0; c < count; c++) {
    const i = elig[Math.floor(R() * elig.length)], risk = P.STOP_ATR * atr(D, i), x = hold(D, i + 1, risk, H);
    out.push(net({ i: i + 1, j: x.j, entry: x.entry, exit: x.exit, why: x.why, stop: x.stop, risk, tIn: D[i + 1].time, tOut: D[x.j].time, hold: x.j - i }, cost, rates));
  }
  return out;
}

export function verdictOf(pool, x2) {
  if (pool.n < P.MIN_N) return `NOT MEASURABLE (inconclusive: ${pool.n} trades, under ${P.MIN_N})`;
  const checks = { positive: pool.avgR > 0, monthT: pool.tMonths >= 2, positive2x: x2.avgR > 0 };
  return Object.values(checks).every(Boolean) ? 'REPLICATES' : 'DOES NOT REPLICATE';
}

export function study2(data, rates) {
  const keys = [...Object.keys(N), ...Object.keys(E)];
  const Ds = Object.fromEntries(keys.map((k) => [k, candles(data[k].rows)]));
  const per = {}, pool = [];
  for (const k of keys) {
    const cost = (N[k] || E[k]).cost;
    const tr = simulate(Ds[k], H).map((t) => ({ ...net(t, cost, rates), mk: k, cost })).filter((t) => inCell(k, t));
    pool.push(...tr);
    const t0 = tr.map(gross0), t2 = tr.map((t) => twice(t, cost));
    per[k] = {
      set: N[k] ? 'N' : 'E', cell: N[k] ? 'all entries' : `entries before ${E[k].before}`, cost,
      data: { from: ymd(Ds[k][0].time), to: ymd(Ds[k].at(-1).time) },
      n: tr.length, avgR: r3(mean(tr.map((t) => t.R))), t: r2(tstat(tr.map((t) => t.R))), wr: tr.length ? r2(100 * tr.filter((t) => t.R > 0).length / tr.length) : null,
      stops: tr.filter((t) => t.why === 'stop').length,
      dd: { zero: ddOf(t0), base: ddOf(tr), x2: ddOf(t2) }, avgR0: r3(mean(t0.map((t) => t.R))), avgR2x: r3(mean(t2.map((t) => t.R))),
    };
    per[k].p = per[k].t == null ? null : r6(pOneSided(per[k].t));
  }
  const tested = keys.filter((k) => per[k].n >= MIN_TEST && per[k].p != null), hm = holm(tested.map((k) => per[k].p));
  tested.forEach((k, i) => { per[k].holm = { adj: r6(hm[i].adj), pass: hm[i].pass }; });
  const x2 = (tr) => tr.map((t) => twice(t, t.cost)), z0 = (tr) => tr.map(gross0);
  const primary = { base: block(pool), x2: block(x2(pool), false), zero: block(z0(pool), false) };
  const verdict = verdictOf(primary.base, primary.x2);
  const C1 = pool.filter((t) => N[t.mk] && t.tIn >= T(SPLIT)), C2 = pool.filter((t) => !(N[t.mk] && t.tIn >= T(SPLIT)));
  const cells = { C1: { what: 'N entries from 2016-01-01', base: block(C1), x2: block(x2(C1), false) }, C2: { what: 'N entries before 2016 + all of E', base: block(C2), x2: block(x2(C2), false) } };
  // #920 R2 rebuilt with the frozen code (gated): its markets, entries 2005-01-01 .. 2015-12-31
  const R2tr = [];
  for (const [k, m] of Object.entries(R920)) {
    const D = candles(data[k].rows);
    R2tr.push(...simulate(D, H).map((t) => ({ ...net(t, m.cost, rates), mk: k, cost: m.cost })).filter((t) => t.tIn >= T('2005-01-01') && t.tIn <= T('2015-12-31') + DAY - 1));
  }
  const Q = { what: 'C2 pooled with #920 R2 trades (other instruments before 2016)', r2rebuilt: { n: R2tr.length, avgR: r3(mean(R2tr.map((t) => t.R))) }, base: block([...C2, ...R2tr]), x2: block(x2([...C2, ...R2tr]), false) };
  // placebo
  const cellFn = (k) => (t) => (N[k] ? true : t < T(E[k].before)) && t <= T(END) + DAY - 1;
  const seeds = [...Array(SEEDS)].map((_, s) => {
    const R = rng(SEED0 + s + 1), tr = [];
    for (const k of keys) if (per[k].n) tr.push(...placeboTrades(Ds[k], per[k].n, (N[k] || E[k]).cost, rates, cellFn(k), R));
    return mean(tr.map((t) => t.R));
  });
  const placebo = { seeds: SEEDS, seedFrom: SEED0 + 1, mean: r3(mean(seeds)), p95: r3(pct(seeds, 0.95)), beats: seeds.filter((x) => mean(pool.map((t) => t.R)) > x).length, values: seeds.map(r3) };
  // Fisher
  const pQ = pOneSided(Q.base.tTrades), pC1 = pOneSided(cells.C1.base.tTrades), pC2 = pOneSided(cells.C2.base.tTrades);
  const pR1 = pOneSided(R920T.R1), pR2 = pOneSided(R920T.R2);
  const F = (ps, ids) => { const f = fisher(ps); return { ids, x: f.x, df: f.df, p: r6(f.p), z: zOf(f.p), belowBonferroni: f.p < BONFERRONI }; };
  const variants = [F([ORIGINAL.p, pR2], ['#860', '#920 R2']), F([ORIGINAL.p, pC2], ['#860', 'C2'])];
  const fisherOut = {
    inputs: { original: ORIGINAL, r920: { R1: { t: R920T.R1, p: r6(pR1) }, R2: { t: R920T.R2, p: r6(pR2) } }, C1: { t: cells.C1.base.tTrades, p: r6(pC1) }, C2: { t: cells.C2.base.tTrades, p: r6(pC2) }, Q: { t: Q.base.tTrades, p: r6(pQ) } },
    bonferroni: r6(BONFERRONI),
    preregistered: F([ORIGINAL.p, pQ], ['#860', 'Q = C2 + #920 R2 pooled']),
    pairedWeaker: { variants, weaker: variants.reduce((a, b) => (b.p > a.p ? b : a)) },
    allCellsUpperBound: F([ORIGINAL.p, pR1, pR2, pC1, pC2], ['#860', '#920 R1', '#920 R2', 'C1', 'C2']),
    before: { p: 0.02598237694305985, what: 'multiple-testing-update: #860 + #920 R2' },
  };
  const years = {};
  for (const t of pool) { const y = ymd(t.tIn).slice(0, 4); const o = (years[y] ||= { n: 0, sumR: 0 }); o.n++; o.sumR += t.R; }
  for (const o of Object.values(years)) o.sumR = r2(o.sumR);
  return { verdict, primary, cells, Q, placebo, fisher: fisherOut, markets: per, years };
}

// ── CLI ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: node run.mjs fetch|full <dir>'); process.exit(2); }
  const keys = [...new Set([...Object.keys(N), ...Object.keys(E)])];
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const show = (ref, p) => execFileSync('git', ['show', `${ref}:${p}`], { cwd: HERE, maxBuffer: 1 << 28 });
    for (const k of keys) fs.writeFileSync(path.join(dir, k + '.json'), show('origin/council-data', `research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, 'cache.json'), show('origin/council-data', 'macro/cache.json'));
    fs.writeFileSync(path.join(dir, 'published-920.json'), show('origin/vol-spike-replicate', 'research/edge/vol-spike-replicate/result.json'));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const data = Object.fromEntries(keys.map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json')))]));
    const rates = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'))).score.fred.DGS2;
    const pub = JSON.parse(fs.readFileSync(path.join(dir, 'published-920.json')));
    const FIELDS = ['reading', 'lastDay', 'R1', 'R2', 'R3', 'placebo', 'costs2x', 'markets'];
    const rep = JSON.parse(JSON.stringify(replicate(data, rates)));
    const diff = FIELDS.filter((f) => JSON.stringify(rep[f]) !== JSON.stringify(pub[f]));
    const gate = { what: "#920's own replicate() (gate920.mjs, byte for byte) on its markets and data, against its committed result.json", source: 'origin/vol-spike-replicate', fields: FIELDS, equal: !diff.length, differ: diff,
      published: { R1: { n: pub.R1.n, avgR: pub.R1.avgR, t: pub.R1.t }, R2: { n: pub.R2.n, avgR: pub.R2.avgR, t: pub.R2.t }, R3: { n: pub.R3.n, avgR: pub.R3.avgR, t: pub.R3.t } } };
    if (diff.length) { console.error('GATE FAILED', diff); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ built: '2026-11-14', gate, verdict: 'gate failed' }, null, 1) + '\n'); process.exit(1); }
    const r = study2(data, rates);
    const out = {
      built: '2026-11-14', title: 'Second frozen replication of the vol-spike rebound, on markets and years neither study used', verdict: r.verdict,
      system: "#860's rule frozen (frozen.mjs, byte for byte): long when 5-day realised vol > 2 x its prior 120-day median and close < SMA20, fill next open, hold 10 trading days, stop 3 x ATR(20)",
      costs: { spreadPoints: Object.fromEntries(keys.map((k) => [k, (N[k] || E[k]).cost])), financing: "DGS2 + 2.5 % a year per calendar night for every market (#860's method)" },
      src: 'OANDA mid daily candles, council-data research/daily/<key>.json; DGS2 from council-data macro/cache.json',
      set: { N: Object.keys(N), E: Object.fromEntries(Object.entries(E).map(([k, m]) => [k, 'before ' + m.before])), end: END },
      gate, ...r,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ gate: gate.equal, verdict: r.verdict, primary: r.primary, cells: r.cells, Q: r.Q, placebo: { ...r.placebo, values: undefined }, fisher: r.fisher }, null, 1));
    for (const [k, m] of Object.entries(r.markets)) console.log(k, m.set, m.n, m.avgR, m.t, m.p, m.holm?.adj, JSON.stringify(m.dd));
  }
}
