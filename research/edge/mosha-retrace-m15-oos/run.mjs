// Edge research · mosha-retrace-m15-oos: the M15-zone variant of the Mosha retracement chain (research/edge/mosha-retrace, reported
// there as a variant only) on untouched OANDA spot gold, June 2006 to 2017 (decisive) and 2018-19 (report). Rule, costs, tests and
// verdict: PREREGISTRATION.md (committed alone before this file produced a number). The rule is imported unchanged
// (mosha-retrace run(C, 'M15'), which imports mosha-level's simulation). Paper research only: nothing here trades.
//   node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>      -> <dir>/xau-5m.json.gz (kept out of git)
//   CANDLES=<dir> node research/edge/mosha-retrace-m15-oos/run.mjs run     -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { run as chain } from '../mosha-retrace/run.mjs';
import { simulate } from '../mosha-level/run.mjs';
import { aggregate } from '../gold-systems/data.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const U = (y, m, d = 1) => Date.UTC(y, m - 1, d) / 1000;
export const W = { DEC_FROM: U(2006, 7), DEC_TO: U(2018, 1), REP_FROM: U(2018, 1), REP_TO: U(2020, 1), READ_TO: U(2020, 1, 6) };
export const COST = { old: 0.30, std: 0.60 };
export const PLACEBOS = 40, NEED = 38;

// costs of one closed order, in R: financing on buys only (nights x FIN.xau.long x entry / r0)
export function costed(o, fin = FIN.xau.long) {
  const f = o.side > 0 ? nights(o.filled, o.closed) * fin * o.entry / o.r0 : 0;
  return { gross: o.R, net3: o.R - COST.old / o.r0 - f, net6: o.R - COST.std / o.r0 - f, net2x: o.R - 2 * COST.std / o.r0 - 2 * f, fin: f };
}
// calendar months [from, to): keys 'YYYY-MM'
export function monthsOf(from, to) { const out = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1; while (U(y, m) < to) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } } return out; }
const mk = (t) => new Date(t * 1000).toISOString().slice(0, 7);
// t of calendar-month sums (empty months count 0)
export function monthT(rows, key, from, to) {
  const M = monthsOf(from, to), s = new Map(M.map((k) => [k, 0]));
  for (const r of rows) { const k = mk(r.placed); if (s.has(k)) s.set(k, s.get(k) + r[key]); }
  const v = [...s.values()], n = v.length, mu = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mu / (sd / Math.sqrt(n)) : 0 };
}
const phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
export const pOne = (t) => 1 - phi(t);
export function holm(ps) { const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), out = new Array(ps.length); let top = 0; o.forEach((r, k) => { top = Math.max(top, Math.min(1, r.p * (ps.length - k))); out[r.i] = top; }); return out; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const r4 = (x) => +x.toFixed(4), mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export function stats(rows, from, to) {
  const out = { n: rows.length, win: rows.length ? +(100 * rows.filter((r) => r.gross > 0).length / rows.length).toFixed(1) : 0 };
  for (const k of ['gross', 'net3', 'net6', 'net2x']) { out[k] = r4(mean(rows.map((r) => r[k]))); out[`t_${k}`] = +monthT(rows, k, from, to).t.toFixed(2); }
  out.months = monthT(rows, 'net6', from, to).months; out.totalNet6 = +rows.reduce((a, r) => a + r.net6, 0).toFixed(2); out.fin = +rows.reduce((a, r) => a + r.fin, 0).toFixed(2);
  const q = rows.map((r) => r.r0).sort((a, b) => a - b); out.medR0 = q.length ? +q[q.length >> 1].toFixed(2) : null;
  return out;
}
// placebo trade: same side, r0 and target distance, market entry at the open of a random M5 candle of the same month
export function placeboRows(rows, F, monthIdx, rnd) {
  const out = [];
  for (const r of rows) {
    const [a, b] = monthIdx.get(mk(r.placed)), k = a + Math.floor(rnd() * (b - a)), c = F[k], s = r.side, entry = c.open;
    const o = { side: s, placed: c.time, entry, stop: entry - s * r.r0, target: entry + s * Math.abs(r.target - r.entry), r0: r.r0 };
    const x = simulate(F, o); if (x.status !== 'closed') continue;
    out.push({ placed: r.placed, side: s, ...costed({ ...o, ...x }) });
  }
  return out;
}

// ─── run ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
if (MODE === 'run') {
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-5m.json.gz')))).filter((r) => r[0] < W.READ_TO);
  const m = { n: rows.length, T: rows.map((r) => r[0]), O: rows.map((r) => r[1]), H: rows.map((r) => r[2]), L: rows.map((r) => r[3]), C: rows.map((r) => r[4]) };
  const M5 = rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const C = { M5, M15: aggregate(m, 900), H1: aggregate(m, 3600), H4: aggregate(m, 14400), F: M5 };
  const { orders, funnel } = chain(C, 'M15');
  const closed = orders.filter((o) => o.status === 'closed').map((o) => ({ ...o, ...costed(o) }));
  const monthIdx = new Map(); M5.forEach((b, i) => { const k = mk(b.time), e = monthIdx.get(k); if (!e) monthIdx.set(k, [i, i + 1]); else e[1] = i + 1; });
  const win = (a, b) => closed.filter((o) => o.placed >= a && o.placed < b);
  const sets = { T1: () => true, T2: (o) => o.side < 0, T3: (o) => o.side > 0 };
  const status = (a, b) => { const c = {}; for (const o of orders.filter((x) => x.placed >= a && x.placed < b)) c[o.status] = (c[o.status] || 0) + 1; return c; };
  const out = { topic: 'mosha-retrace-m15-oos', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Mosha retracement chain, M15 entry zone (mosha-retrace variant M15, unchanged), OANDA spot gold M5, fills on M5',
    window: { decisive: '2006-07-01 to 2017-12-31', report: '2018-01-01 to 2019-12-31' }, costs: { old: COST.old, std: COST.std, fin: FIN.xau.long, finSrc: FIN.src },
    candles: { m5: M5.length, from: new Date(M5[0].time * 1000).toISOString().slice(0, 16), to: new Date(M5.at(-1).time * 1000).toISOString().slice(0, 16) },
    funnel, orders: { decisive: status(W.DEC_FROM, W.DEC_TO), report: status(W.REP_FROM, W.REP_TO) }, tests: {} };
  for (const [k, f] of Object.entries(sets)) {
    const D = win(W.DEC_FROM, W.DEC_TO).filter(f), R = win(W.REP_FROM, W.REP_TO).filter(f);
    const years = {}; for (const o of D.concat(R)) { const y = new Date(o.placed * 1000).getUTCFullYear(); (years[y] ||= []).push(o); }
    const pl = [];
    for (let s = 1; s <= PLACEBOS; s++) pl.push(+monthT(placeboRows(D, M5, monthIdx, mulberry32(s)), 'net6', W.DEC_FROM, W.DEC_TO).t.toFixed(2));
    const d = stats(D, W.DEC_FROM, W.DEC_TO);
    out.tests[k] = { decisive: d, report: stats(R, W.REP_FROM, W.REP_TO), byYear: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { n: a.length, net6: r4(mean(a.map((o) => o.net6))), total6: +a.reduce((x, o) => x + o.net6, 0).toFixed(2) }])),
      placebo: { t: pl, median: [...pl].sort((a, b) => a - b)[PLACEBOS >> 1], beaten: pl.filter((x) => d.t_net6 > x).length, of: PLACEBOS }, p: +pOne(d.t_net6).toFixed(4) };
  }
  const ks = Object.keys(sets), ph = holm(ks.map((k) => out.tests[k].p));
  ks.forEach((k, i) => { const T = out.tests[k]; T.pHolm = +ph[i].toFixed(4); T.pass = T.decisive.t_net6 >= 2 && T.pHolm < 0.05 && T.decisive.net2x > 0 && T.placebo.beaten >= NEED; });
  const T1 = out.tests.T1.decisive, sg = (x) => `${x >= 0 ? '+' : ''}${x}`;
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.headline = `${out.verdict}: M15-zone chain on untouched gold 2006-17 made ${sg(T1.net6)}R a trade net of $0.60 + financing (n ${T1.n}, month-sum t ${T1.t_net6}); gross ${sg(T1.gross)}R`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ funnel, orders: out.orders, tests: Object.fromEntries(ks.map((k) => [k, { d: out.tests[k].decisive, r: out.tests[k].report, pl: out.tests[k].placebo.beaten, pHolm: out.tests[k].pHolm, pass: out.tests[k].pass }])) }, null, 1));
  console.log(out.headline);
}
