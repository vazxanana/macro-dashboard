// research/edge/dom-timeframes/run.mjs - the dominant-zone limit of PREREGISTRATION.md on four key timeframes, 2010-2019.
// node --max-old-space-size=6000 research/edge/dom-timeframes/run.mjs market <market> <dir>   one market's trades -> <dir>/<market>.json
// node research/edge/dom-timeframes/run.mjs cut <market>                                      the cut test on real candles
// node research/edge/dom-timeframes/run.mjs report <dir>                                      pool, apply the bar, write result.json
// Research only: imports the combo-grid-3 engine and combo-grid-2's costs / exclusions; writes only <dir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, NONE } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), MID = y(2015), TO = y(2020);
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const CHAINS = { T1: ['1d', '1h'], T2: ['4h', '15m'], T3: ['1h', '5m'], T4: ['30m', '5m'] };
export const CAP = { '1d': 10 * 86400, '4h': 5 * 86400, '1h': 2 * 86400, '30m': 2 * 86400 };
const SEC = { '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
const W = 12;                                   // the order lives 12 touch-timeframe candles (combo-grid-3)
const EX = { trail: 6, '2R': 1 };

export function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }

// the planned orders of one chain: { ts, d, entry, stop } from closed candles only (used by the cut test)
export function orders(F, key, touch, cost, from, to) {
  const L = F[key], T = F[touch], A = atr14(L), out = [];
  for (const sg of signalsFor(F, key, touch, 'dom', {}, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(L, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, buf = cost / 2 + 0.25 * A[li];
    const stop = d > 0 ? z.bot - buf : z.top + buf;
    if (!(d * (entry - stop) >= 2 * cost)) continue;   // every order has its stop on the losing side
    out.push({ ts, d, entry, stop, zoneAt: z.at });
  }
  return out;
}

export function tradesFrom(M5, market, chain, from, to, { cost = COSTS[market], bad = () => false } = {}) {
  const [key, touch] = CHAINS[chain], F = frames(M5), out = [];
  for (const o of orders(F, key, touch, cost, from, to)) {
    const r = multi(M5, o.d, o.entry, o.stop, 'lim', o.ts, o.ts + W * SEC[touch], 2, null, CAP[key], null);
    if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
    const row = { chain, market, t: r.t, side: o.d, cr: cost / r.risk };
    for (const [k, i] of Object.entries(EX)) row[k] = r.R[i];
    out.push(row);
  }
  return out;
}

export function monthT(rows, key, net) {
  const m = new Map(); for (const r of rows) { const k = new Date(r.t * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + r[key] - (net ? r.cr : 0)); }
  const v = [...m.values()], n = v.length; if (n < 3) return { months: n, t: null };
  const mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? +(mean / (sd / Math.sqrt(n))).toFixed(2) : null };
}
export function summ(rows, key) {
  const n = rows.length; if (!n) return { n: 0 };
  const g = rows.reduce((a, r) => a + r[key], 0) / n, c = rows.reduce((a, r) => a + r.cr, 0) / n;
  return { n, before: +g.toFixed(4), tBefore: monthT(rows, key, false).t, after: +(g - c).toFixed(4), tAfter: monthT(rows, key, true).t };
}
const p1 = (t) => (t == null ? 1 : t > 0 ? K.pFromT(t, 59) / 2 : 1 - K.pFromT(t, 59) / 2);
export function judge(byChain) { // byChain: { T1: rows, ... } -> the pre-registered tests
  const ids = Object.keys(CHAINS), T = {};
  for (const id of ids) { const R = byChain[id] || [];
    T[id] = { chain: CHAINS[id].join('>'), early: summ(R.filter((r) => r.t < MID), 'trail'), late: summ(R.filter((r) => r.t >= MID), 'trail'), all: summ(R, 'trail'),
      twoR: { early: summ(R.filter((r) => r.t < MID), '2R'), late: summ(R.filter((r) => r.t >= MID), '2R'), all: summ(R, '2R') } };
    T[id].p = Math.max(p1(T[id].early.tBefore), p1(T[id].late.tBefore)); }
  const holm = K.holm(ids.map((id) => T[id].p));
  ids.forEach((id, i) => { const t = T[id]; t.holm = +holm[i].toPrecision(3);
    t.pass = t.early.before > 0 && t.early.tBefore >= 2 && t.late.before > 0 && t.late.tBefore >= 2 && holm[i] < 0.05; });
  const n = ids.filter((id) => T[id].pass).length;
  return { tests: T, passed: n, verdict: n === ids.length ? 'PASS' : n === 0 ? 'FAIL' : 'PARTIAL' };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const M5 = K.load(m, '5m', { from: FROM - 330 * 86400, to: TO }); const X = exclusions(m);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b), o = {};
  for (const c of Object.keys(CHAINS)) { o[c] = tradesFrom(M5, m, c, FROM, TO, { bad }); console.error(m, c, o[c].length); }
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify(o)); console.log(m, M5.length, 'candles');
}
if (isMain && process.argv[2] === 'cut') { // the planned orders known before a cut equal those of the series cut there
  const m = process.argv[3], M5 = K.load(m, '5m', { from: y(2014) - 330 * 86400, to: y(2015) }), F = frames(M5), cost = COSTS[m];
  let checked = 0, bad = 0;
  for (const c of Object.keys(CHAINS)) { const [key, touch] = CHAINS[c]; const full = orders(F, key, touch, cost, y(2014), y(2015));
    for (const cut of [y(2014) + 40 * 86400, y(2014) + 150 * 86400, y(2014) + 290 * 86400]) {
      const Fc = frames(M5.filter((b) => b.t < cut));
      const a = full.filter((o) => o.ts + SEC[touch] <= cut).map((o) => JSON.stringify(o));
      const b = new Set(orders(Fc, key, touch, cost, y(2014), y(2015)).filter((o) => o.ts + SEC[touch] <= cut).map((o) => JSON.stringify(o)));
      checked += a.length; bad += a.filter((s) => !b.has(s)).length; } }
  console.log(JSON.stringify({ market: m, checked, mismatches: bad }));
}
if (isMain && process.argv[2] === 'report') {
  const dir = process.argv[3], byChain = {}, perMarket = {};
  for (const c of Object.keys(CHAINS)) byChain[c] = [];
  for (const m of MARKETS) { const o = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')); perMarket[m] = {};
    for (const c of Object.keys(CHAINS)) { byChain[c].push(...o[c]); perMarket[m][c] = { trail: summ(o[c], 'trail'), '2R': summ(o[c], '2R') }; } }
  const J = judge(byChain);
  const cut = fs.existsSync(path.join(dir, 'cut.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'cut.json'), 'utf8')) : null;
  const res = { study: 'dom-timeframes', built: '2026-11-23', basis: 'judged before costs (owner); after costs beside', window: '2010-01-01 to 2019-12-31',
    markets: MARKETS, verdict: J.verdict, passed: J.passed, tests: J.tests, perMarket, cut };
  const f = (v) => (v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(3);
  res.headline = `Mixed: ${J.passed} of 4 chains clear the bar before costs. ` + Object.values(J.tests).map((t) => `${t.chain} ${f(t.all.before)}R a trade (n ${t.all.n}, halves t ${t.early.tBefore} / ${t.late.tBefore}; after costs ${f(t.all.after)}R)`).join(', ') + '.';
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ verdict: res.verdict, headline: res.headline, passed: J.passed }, null, 1));
}
