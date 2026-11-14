// The stock-bond correlation regime as a timing filter for an index long (pre-registered: PREREGISTRATION.md, committed first).
// Paper research only: nothing live is read for a rule or changed, gold is never read.
//
//   node research/edge/stock-bond-corr/run.mjs          reads council-data with git show (no network), writes result.json
//   node research/edge/stock-bond-corr/run.mjs --dry    prints the summary without writing
//
// A position is a long / flat allocation from one month-end close to the next (a portfolio weight, not a stopped trade).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const MARKETS = ['spx500', 'nas100', 'us30'];
export const PRIMARY = 'spx500';
export const BOND = 'usb10y';
export const LOOK = 60;
export const SIDE_COST = 0.0002;     // 0.04 % round trip, half at each entry / exit
export const MARKUP = 0.025;         // financing markup over DGS2
export const FALLBACK_Y = 4;         // percent, before the cache's first DGS2 value
export const IS_END = '2016-12';
export const OOS = ['2017-01', '2026-10'];
export const BLOCK = 12, DRAWS = 10000, SEED = 20261114, PLACEBO = 40;

export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function weekdays(rows) {
  return rows.filter((r) => { const d = new Date(r[0] * 1000).getUTCDay(); return d !== 0 && d !== 6; }).map((r) => ({ d: iso(r[0]), c: r[4] }));
}

// dates both series have, in order: [{ d, a, b }]
export function join(a, b) {
  const m = new Map(b.map((x) => [x.d, x.c]));
  return a.filter((x) => m.has(x.d)).map((x) => ({ d: x.d, a: x.c, b: m.get(x.d) }));
}

export function corr(x, y) {
  const n = x.length; let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

// month ends of a joined series with the 60-day correlation known at that close (rows at or before index i only)
export function monthEnds(j) {
  const ends = [];
  for (let i = 0; i < j.length; i++) if (i === j.length - 1 || j[i + 1].d.slice(0, 7) !== j[i].d.slice(0, 7)) ends.push(i);
  return ends.map((i) => {
    let rho = null;
    if (i >= LOOK) {
      const x = [], y = [];
      for (let k = i - LOOK + 1; k <= i; k++) { x.push(j[k].a / j[k - 1].a - 1); y.push(j[k].b / j[k - 1].b - 1); }
      rho = corr(x, y);
    }
    return { i, d: j[i].d, c: j[i].a, rho };
  });
}

export function rateFn(dgs2) {
  const xs = (dgs2 || []).filter((x) => Number.isFinite(x[1])).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return (d) => {
    let lo = 0, hi = xs.length - 1, k = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (xs[m][0] < d) { k = m; lo = m + 1; } else hi = m - 1; }
    return k < 0 ? FALLBACK_Y : Math.max(0, xs[k][1]);
  };
}

const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;

// monthly rows: { m (month the return ends in), r (index return), fin (financing if held), on (rule holds), rho }
export function months(ends, rate) {
  const out = [];
  for (let k = 1; k < ends.length; k++) {
    const p = ends[k - 1], q = ends[k];
    if (p.rho == null) continue;
    out.push({ m: q.d.slice(0, 7), from: p.d, to: q.d, r: q.c / p.c - 1, fin: days(p.d, q.d) * ((rate(p.d) + MARKUP * 100) / 100) / 365, on: p.rho < 0, rho: p.rho });
  }
  return out;
}

// net monthly returns of a mask over rows (mask[k] true = long); costMul scales spread and financing; gross drops both
export function netReturns(rows, mask, { costMul = 1, gross = false } = {}) {
  const out = []; let prev = false, switches = 0;
  for (let k = 0; k < rows.length; k++) {
    const on = mask[k]; let r = 0;
    if (on) r = rows[k].r - (gross ? 0 : rows[k].fin * costMul);
    if (on !== prev && !gross) r -= SIDE_COST * costMul;
    if (k > 0 && on !== mask[k - 1]) switches++;
    // a switch at k (entry or exit) is paid in month k; an exit is paid on the flat month
    out.push(r); prev = on;
  }
  return { rets: out, switches };
}

export const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length;
export const sd = (x) => { const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1)); };
export const sharpe = (x) => { const s = sd(x); return s > 0 ? (mean(x) / s) * Math.sqrt(12) : 0; };
export function maxDD(rets) { let eq = 1, pk = 1, dd = 0; for (const r of rets) { eq *= 1 + r; pk = Math.max(pk, eq); dd = Math.min(dd, eq / pk - 1); } return dd; }
export const annual = (rets) => rets.reduce((a, r) => a * (1 + r), 1) ** (12 / rets.length) - 1;

export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// paired circular block bootstrap of the Sharpe difference
export function bootSd(a, b, { block = BLOCK, draws = DRAWS, seed = SEED } = {}) {
  const n = a.length, R = rng(seed), d = [];
  for (let k = 0; k < draws; k++) {
    const xa = [], xb = [];
    while (xa.length < n) { const s = Math.floor(R() * n); for (let j = 0; j < block && xa.length < n; j++) { xa.push(a[(s + j) % n]); xb.push(b[(s + j) % n]); } }
    d.push(sharpe(xa) - sharpe(xb));
  }
  return sd(d);
}

export const normCdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const y = 0.3989423 * Math.exp(-z * z / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - y : y; };

export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]); const adj = new Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); adj[i] = run; });
  return adj;
}

// spells: separate runs of the same state
export const spells = (mask) => mask.reduce((a, v, k) => a + (k === 0 || v !== mask[k - 1] ? 1 : 0), 0);

function evalWindow(rows, opts = {}) {
  const mask = rows.map((x) => x.on), all = rows.map(() => true);
  const rule = netReturns(rows, mask, opts), bh = netReturns(rows, all, opts);
  const diffs = rule.rets.map((r, k) => r - bh.rets[k]);
  return {
    n: rows.length, invested: mask.filter(Boolean).length, switches: rule.switches, spells: spells(mask), inSpells: (() => { let c = 0; mask.forEach((v, k) => { if (v && (k === 0 || !mask[k - 1])) c++; }); return c; })(),
    rule: { sharpe: sharpe(rule.rets), annual: annual(rule.rets), maxDD: maxDD(rule.rets), vol: sd(rule.rets) * Math.sqrt(12) },
    long: { sharpe: sharpe(bh.rets), annual: annual(bh.rets), maxDD: maxDD(bh.rets), vol: sd(bh.rets) * Math.sqrt(12) },
    diff: sharpe(rule.rets) - sharpe(bh.rets),
    ddRatio: maxDD(rule.rets) / maxDD(bh.rets),
    pairedT: mean(diffs) / (sd(diffs) / Math.sqrt(diffs.length)),
    _rule: rule.rets, _bh: bh.rets,
  };
}

export function study(daily, dgs2, { draws = DRAWS, placebo = PLACEBO } = {}) {
  const rate = rateFn(dgs2), bond = weekdays(daily[BOND].rows), markets = {};
  for (const k of MARKETS) {
    const j = join(weekdays(daily[k].rows), bond), ends = monthEnds(j), rows = months(ends, rate);
    const IS = rows.filter((x) => x.m <= IS_END), OS = rows.filter((x) => x.m >= OOS[0] && x.m <= OOS[1]);
    const res = { joinedDays: j.length, firstMonth: IS[0]?.m, lastMonth: OS.at(-1)?.m, rhoNow: ends.at(-1).rho };
    for (const [w, set] of [['is', IS], ['oos', OS]]) {
      const net = evalWindow(set), x2 = evalWindow(set, { costMul: 2 }), gr = evalWindow(set, { gross: true });
      const bs = bootSd(net._rule, net._bh, { draws });
      const g = (o) => { const { _rule, _bh, ...rest } = o; return rest; };
      res[w] = { ...g(net), t: net.diff / bs, bootSd: bs, diff2x: x2.diff, gross: { diff: gr.diff, rule: gr.rule, long: gr.long, t: gr.diff / bootSd(gr._rule, gr._bh, { draws }) },
        outMonths: set.filter((x) => !x.on).map((x) => x.m) };
    }
    // placebo on the out-of-sample months: random masks with the rule's number of invested months
    const R = rng(SEED + 7), nOn = OS.filter((x) => x.on).length, pd = [];
    for (let s = 0; s < placebo; s++) {
      const idx = OS.map((_, k) => k); for (let k = idx.length - 1; k > 0; k--) { const r = Math.floor(R() * (k + 1)); [idx[k], idx[r]] = [idx[r], idx[k]]; }
      const on = new Set(idx.slice(0, nOn)), mask = OS.map((_, k) => on.has(k));
      const a = netReturns(OS, mask).rets, b = netReturns(OS, OS.map(() => true)).rets;
      pd.push(sharpe(a) - sharpe(b));
    }
    pd.sort((a, b) => a - b);
    res.placebo = { n: placebo, invested: nOn, mean: mean(pd), min: pd[0], max: pd.at(-1), atLeastReal: pd.filter((x) => x >= res.oos.diff).length };
    markets[k] = res;
  }
  const ps = MARKETS.map((k) => 1 - normCdf(markets[k].oos.t)), adj = holm(ps);
  const tests = MARKETS.map((k, i) => {
    const m = markets[k], pass = m.oos.t >= 2 && adj[i] < 0.05 && m.is.diff > 0 && m.oos.diff2x > 0;
    return { id: 'T' + (i + 1), market: k, diffOOS: m.oos.diff, tOOS: m.oos.t, p: ps[i], pHolm: adj[i], diffIS: m.is.diff, tIS: m.is.t, diffOOS2x: m.oos.diff2x, ddRatioOOS: m.oos.ddRatio, ddRatioIS: m.is.ddRatio, switchesOOS: m.oos.switches, pass };
  });
  const verdict = tests[0].pass ? 'PASS' : 'FAIL';
  return { study: 'stock-bond-corr', verdict, passed: tests.filter((t) => t.pass).length, tests, markets,
    params: { MARKETS, BOND, LOOK, SIDE_COST, MARKUP, FALLBACK_Y, IS_END, OOS, BLOCK, DRAWS: draws, SEED, PLACEBO: placebo } };
}

export function load() {
  const sh = (p) => JSON.parse(execFileSync('git', ['show', `origin/council-data:${p}`], { maxBuffer: 1 << 28 }));
  const daily = {}; for (const k of [...MARKETS, BOND]) daily[k] = sh(`research/daily/${k}.json`);
  const cache = sh('macro/cache.json');
  return { daily, dgs2: cache?.score?.fred?.DGS2 || [] };
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { daily, dgs2 } = load();
  const out = study(daily, dgs2);
  out.built = '2026-11-14';
  out.data = Object.fromEntries([...MARKETS, BOND].map((k) => [k, { inst: daily[k].inst, rows: daily[k].rows.length, first: iso(daily[k].rows[0][0]), last: iso(daily[k].rows.at(-1)[0]) }]));
  const f = (x, d = 3) => (x >= 0 ? '+' : '') + x.toFixed(d);
  console.log('verdict', out.verdict);
  for (const t of out.tests) console.log(t.id, t.market, 'OOS diff', f(t.diffOOS), 't', t.tOOS.toFixed(2), 'pHolm', t.pHolm.toFixed(3), '| IS diff', f(t.diffIS), 't', t.tIS.toFixed(2), '| 2x', f(t.diffOOS2x), '| DD ratio', t.ddRatioOOS.toFixed(2), 'sw', t.switchesOOS, t.pass ? 'PASS' : 'fail');
  for (const k of MARKETS) for (const w of ['is', 'oos']) { const o = out.markets[k][w]; console.log(k, w, 'n', o.n, 'inv', o.invested, 'sw', o.switches, 'spells', o.spells, 'rule SR', o.rule.sharpe.toFixed(2), 'ann', (o.rule.annual * 100).toFixed(1), 'DD', (o.rule.maxDD * 100).toFixed(1), '| long SR', o.long.sharpe.toFixed(2), 'ann', (o.long.annual * 100).toFixed(1), 'DD', (o.long.maxDD * 100).toFixed(1), '| gross diff', f(o.gross.diff), 't', o.gross.t.toFixed(2), '| pairedT', o.pairedT.toFixed(2), '| out', o.outMonths.join(' ')); }
  for (const k of MARKETS) console.log('placebo', k, JSON.stringify(out.markets[k].placebo), 'firstMonth', out.markets[k].firstMonth);
  if (!process.argv.includes('--dry')) fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
}
