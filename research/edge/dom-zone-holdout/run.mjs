// research/edge/dom-zone-holdout/run.mjs - the one rule of PREREGISTRATION.md on years no grid read.
// node --max-old-space-size=6000 research/edge/dom-zone-holdout/run.mjs   -> result.json (and prints the tests)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, COSTS, exclusions, NONE } from '../combo-grid-3/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
const EX = { trail: 6, '1R': 0, '2R': 1, '3R': 2, '4R': 3 };
function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }

export function trades(market, from, to) {
  const M5 = K.load(market, '5m', { from: from - 200 * 86400, to }); if (!M5.length) return [];
  const F = frames(M5), H = F['1h'], T = F['5m'], A = atr14(H), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const out = [];
  for (const sg of signalsFor(F, '1h', '5m', 'dom', {}, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost)) continue;
    const r = multi(M5, d, entry, stop, 'lim', ts, ts + 12 * 300, 2, null, 2 * 86400, null);
    if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
    const row = { market, t: r.t, side: d, cr: cost / r.risk };
    for (const [k, i] of Object.entries(EX)) row[k] = r.R[i];
    out.push(row);
  }
  return out;
}
function monthT(rows, key, net) {
  const m = new Map(); for (const r of rows) { const k = new Date(r.t * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + r[key] - (net ? r.cr : 0)); }
  const v = [...m.values()], n = v.length; if (n < 3) return { months: n, t: null };
  const mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function summ(rows, key) {
  const n = rows.length; if (!n) return { n: 0 };
  const g = rows.reduce((a, r) => a + r[key], 0) / n, c = rows.reduce((a, r) => a + r.cr, 0) / n;
  return { n, before: +g.toFixed(4), tBefore: monthT(rows, key, false).t, after: +(g - c).toFixed(4), tAfter: monthT(rows, key, true).t };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const A = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'], B = ['nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag'];
  const setA = [], setB = [], perMarket = {};
  for (const m of A) { const a = trades(m, y(2010), y(2020)), b = trades(m, y(2005), y(2010)); setA.push(...a); setB.push(...b); perMarket[m] = { '2010-19': summ(a, 'trail'), '2005-09': summ(b, 'trail') }; console.error(m, a.length, b.length); }
  for (const m of B) { const b = trades(m, y(2005), y(2020)); setB.push(...b); perMarket[m] = { '2005-19': summ(b, 'trail') }; console.error(m, b.length); }
  const A1 = setA.filter((r) => r.t < y(2015)), A2 = setA.filter((r) => r.t >= y(2015));
  const gold = setA.filter((r) => r.market === 'xau');
  const T1 = { early: summ(A1, 'trail'), late: summ(A2, 'trail') }, T2 = summ(setB, 'trail'), T3 = summ(gold, '4R');
  const p1 = (t) => (t == null ? 1 : t > 0 ? K.pFromT(t, 100) / 2 : 1 - K.pFromT(t, 100) / 2);
  const pv = [Math.max(p1(T1.early.tBefore), p1(T1.late.tBefore)), p1(T2.tBefore), p1(T3.tBefore)], holm = K.holm(pv);
  const pass = [T1.early.before > 0 && T1.early.tBefore >= 2 && T1.late.before > 0 && T1.late.tBefore >= 2 && holm[0] < 0.05,
    T2.before > 0 && T2.tBefore >= 2 && holm[1] < 0.05, T3.before > 0 && T3.tBefore >= 2 && holm[2] < 0.05];
  const exits = {}; for (const k of Object.keys(EX)) exits[k] = { setA: summ(setA, k), setB: summ(setB, k) };
  const res = { study: 'dom-zone-holdout', built: '2026-11-23', basis: 'judged before costs (owner); after costs beside',
    verdict: pass.every(Boolean) ? 'PASS' : pass.some(Boolean) ? 'PARTIAL' : 'FAIL', passes: pass, holm: holm.map((x) => +x.toPrecision(3)),
    T1, T2, T3, exits, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ verdict: res.verdict, passes: pass, holm: res.holm, T1, T2, T3, exits }, null, 1));
}
