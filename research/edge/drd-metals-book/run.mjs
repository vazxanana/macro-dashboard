// The weekly-bull daily rejection long as ONE book on gold and silver, one position at a time, judged on calendar-month sums
// (PREREGISTRATION.md, pushed first).
//   node research/edge/drd-metals-book/run.mjs full <dir>   <dir> holds xau-h1.json (gold-drd-long `fetch`) and xag-h1.json
//                                                           (gold-drd-silver `fetch`)
// The rule, the trade and the statistics are gold-drd-long's (silver's price-scaled pair is gold-drd-silver's), the ER and the
// 20-day direction gold-drd-er's, the financing council/fills.mjs's: all imported, never edited. Pure pieces are exported.
import fs from 'node:fs';
import path from 'node:path';
import * as G from '../gold-drd-long/run.mjs';
import * as S from '../gold-drd-silver/run.mjs';
import { er, up } from '../gold-drd-er/run.mjs';
import { financing } from '../../../council/fills.mjs';

const H = 3600, D = 86400, HOLD = 10, RR = 3;
export const COSTS = { xau: 0.35, xag: S.COST };
export const STREAMS = { T1: () => true, T2: (x) => x.er >= 0.3, T3: (x) => x.er >= 0.2 && x.up };
export const WIN = { A: ['2006-01-01', '2022-10-31'], A1: ['2006-01-01', '2014-05-31'], A2: ['2014-06-01', '2022-10-31'], B: ['2022-11-01', '2099-12-31'] };
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// The candle a simulated trade leaves in: the same walk as the imported `simulate` (stop first, then target, else the last
// candle of the 10th day). Returns { k, exit } so the caller can check it found the same exit price.
export function exitOf(h1, k0, lastDay, stop, tgt) {
  let k = null, exit = null;
  for (let j = k0; j < h1.length; j++) { const b = h1[j], d = G.nyDay(b.time); if (d == null) continue; if (d > lastDay) break;
    k = j; if (b.low <= stop) { exit = Math.min(b.open, stop); break; } if (b.high >= tgt) { exit = tgt; break; } exit = b.close; }
  return { k, exit };
}

// every rule signal of one market as a closed trade with entry / close times, ER, direction and net R (cost and financing)
export function candidates(m, h1) {
  const ds = G.days(h1), wk = G.weeks(ds), wst = G.weekState(wk), start = new Map();
  h1.forEach((b, k) => { const d = G.nyDay(b.time); if (d != null && !start.has(d)) start.set(d, k); });
  const sigs = m === 'xau' ? G.signals(ds, wk, wst, 0.7, 1) : S.signals(ds, wk, wst);
  const out = [];
  for (const sg of sigs) {
    if (!sg.rule) continue;
    const e = er(ds, sg.i); if (e == null) continue;
    const tr = m === 'xau' ? G.simulate(h1, start, ds, sg, RR, 1) : S.simulate(h1, start, ds, sg, RR);
    if (!tr) continue;
    if (tr.how === 'time' && sg.i + HOLD >= ds.length - 1) continue;            // still open at the end of the file
    const k0 = start.get(ds[sg.i + 1].d), lastDay = ds[Math.min(ds.length - 1, sg.i + HOLD)].d;
    const x = exitOf(h1, k0, lastDay, sg.stop, tr.entry + RR * tr.risk);
    if (x.k == null || Math.abs((x.exit - tr.entry) / tr.risk - tr.R) > 1e-9) throw new Error(`exit walk differs ${m} ${sg.d}`);
    const closeT = h1[x.k].time + H, cost = COSTS[m] / tr.risk;
    const fin = financing({ market: m, side: 'buy', entry: tr.entry, stop: tr.stop, filled: tr.entryT, closed: closeT });
    out.push({ m, d: sg.d, entryT: tr.entryT, closeT, entry: tr.entry, stop: tr.stop, risk: tr.risk, R: tr.R, how: tr.how,
      cost, finR: fin.finR, nights: fin.nights, net: tr.R - cost - fin.finR, er: e, up: up(ds, sg.i) });
  }
  return out;
}

// one open position across the markets: by entry time, gold first on a tie; taken only at or after the last taken close
export function oneAtATime(C) {
  const ord = [...C].sort((a, b) => a.entryT - b.entryT || (a.m === 'xau' ? 0 : 1) - (b.m === 'xau' ? 0 : 1));
  const out = []; let free = -Infinity;
  for (const x of ord) { if (x.entryT < free) continue; out.push(x); free = x.closeT; }
  return out;
}

const monthKey = (t) => ymd(t).slice(0, 7);
export function monthsOf(from, to) { const out = []; let [y, m] = from.slice(0, 7).split('-').map(Number); const [y2, m2] = to.slice(0, 7).split('-').map(Number);
  while (y < y2 || (y === y2 && m <= m2)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } } return out; }
// monthly book series over every month of [from, to] (a month without a trade is 0) and its t
export function monthly(T, from, to, key = 'net') {
  const sum = new Map(); for (const x of T) sum.set(monthKey(x.entryT), (sum.get(monthKey(x.entryT)) || 0) + x[key]);
  const v = monthsOf(from, to).map((k) => sum.get(k) || 0), n = v.length, a = v.reduce((p, q) => p + q, 0) / n;
  const sd = Math.sqrt(v.reduce((p, q) => p + (q - a) ** 2, 0) / (n - 1));
  return { months: n, active: v.filter((x) => x !== 0).length, mean: +a.toFixed(3), t: sd ? +(a / (sd / Math.sqrt(n))).toFixed(2) : null };
}
export const pOf = (t) => 0.5 * erfc(t / Math.SQRT2);
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
// worst closed drawdown, trades in order of their close
export function ddClosed(T) { let eq = 0, pk = 0, m = 0; for (const x of [...T].sort((a, b) => a.closeT - b.closeT)) { eq += x.net; pk = Math.max(pk, eq); m = Math.min(m, eq - pk); } return +m.toFixed(1); }
const cut = (T, [f, t]) => T.filter((x) => ymd(x.entryT) >= f && ymd(x.entryT) <= t);
const sum = (T, f) => +T.reduce((a, x) => a + f(x), 0).toFixed(1);
function block(T) { const s = G.stats(T); delete s.sd; s.dd = ddClosed(T); return s; }

function full(dir) {
  const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const h = { xau: load('xau-h1.json'), xag: load('xag-h1.json') };
  const C = [...candidates('xau', h.xau), ...candidates('xag', h.xag)];
  const end = ymd(Math.min(h.xau.at(-1).time, h.xag.at(-1).time));
  const out = { built: new Date().toISOString().slice(0, 10), data: Object.fromEntries(Object.entries(h).map(([m, b]) => [m, { from: ymd(b[0].time), to: ymd(b.at(-1).time), h1: b.length }])),
    src: 'OANDA mid H1 XAU_USD and XAG_USD via the site proxy (the gold-drd-long / gold-drd-silver caches)', costs: COSTS, financing: 'council/fills.mjs financing, gold buys only', streams: {} };
  for (const [k, f] of Object.entries(STREAMS)) {
    const cand = C.filter(f), B = oneAtATime(cand), r = { candidates: cand.length, skipped: cand.length - B.length };
    for (const [w, p] of Object.entries(WIN)) r[w] = block(cut(B, p));
    r.monthlyA = monthly(cut(B, WIN.A), WIN.A[0], WIN.A[1]);
    r.monthlyB = monthly(cut(B, WIN.B), WIN.B[0], end);
    r.byMarket = Object.fromEntries(['xau', 'xag'].map((m) => [m, { A: block(cut(B, WIN.A).filter((x) => x.m === m)), B: block(cut(B, WIN.B).filter((x) => x.m === m)) }]));
    const a = cut(B, WIN.A);
    r.A.totalCostsX2 = sum(a, (x) => x.net - x.cost); r.A.totalNoFinancing = sum(a, (x) => x.net + x.finR); r.A.financing = sum(a, (x) => x.finR);
    r.years = {}; for (let y = 2006; y <= 2026; y++) { const t = cut(B, [`${y}-01-01`, `${y}-12-31`]); if (t.length) r.years[y] = { n: t.length, total: sum(t, (x) => x.net) }; }
    out.streams[k] = r;
  }
  const ks = Object.keys(STREAMS), ps = ks.map((k) => pOf(out.streams[k].monthlyA.t ?? 0)), o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), adj = Array(ps.length); let mx = 0;
  o.forEach(([p, i], rank) => { mx = Math.max(mx, Math.min(1, p * (ps.length - rank))); adj[i] = mx; });
  out.tests = Object.fromEntries(ks.map((k, i) => { const r = out.streams[k];
    const c = { monthlyT: r.monthlyA.t >= 2 && adj[i] < 0.05, halves: r.A1.pf > 1 && r.A2.pf > 1, laterWindow: r.B.total > 0 };
    return [k, { p: +ps[i].toFixed(4), pHolm: +adj[i].toFixed(4), ...c, pass: c.monthlyT && c.halves && c.laterWindow }]; }));
  out.verdict = ks.some((k) => out.tests[k].pass) ? 'PASS' : 'FAIL';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.data));
  for (const [k, r] of Object.entries(out.streams)) { console.log(`\n${k} candidates ${r.candidates} skipped ${r.skipped}`);
    for (const w of Object.keys(WIN)) console.log(`  ${w.padEnd(3)} ${JSON.stringify(r[w])}`);
    console.log('  monthly A', JSON.stringify(r.monthlyA), 'B', JSON.stringify(r.monthlyB)); console.log('  byMarket', JSON.stringify(r.byMarket)); console.log('  years', JSON.stringify(r.years)); }
  console.log('\ntests', JSON.stringify(out.tests), out.verdict);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'full') full(dir); else console.log('usage: run.mjs full <dir>');
}
