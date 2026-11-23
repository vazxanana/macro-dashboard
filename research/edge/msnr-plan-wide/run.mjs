// research/edge/msnr-plan-wide/run.mjs - the MSNR plan with market entries on ten markets (PREREGISTRATION.md, 23 Nov 2026).
// 54 cells: market set (3 triggers x 2 stops x 3 exits x MSNR all / agree) and limit-through set (3 x 2 x 3, MSNR all), each
// against the same trigger taken anywhere at matched times; discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs.
// Research only: nothing live imports it, nothing is placed. The plan's own pieces are imported from council/eg-methods.mjs.
//   EDGE_DATA=<cache> node research/edge/msnr-plan-wide/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/msnr-plan-wide/run.mjs cut <m> <outDir>
//   node research/edge/msnr-plan-wide/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { dailyCalls, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { snrSides, zones, turnBack, qmSetups, PIP as DESK_PIP } from '../../../council/eg-methods.mjs';
import { foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
// a pip is ten points: the desk's PIP for gold and silver, the same rule for the pairs (the desk's pipOfMarket falls back to 0.1
// for nzdusd, usdchf and eurjpy, which are not desk markets: the rule is written out here instead)
export const PIP = { xau: DESK_PIP.xau, xag: DESK_PIP.xag, usdjpy: 0.01, eurjpy: 0.01, eurusd: 1e-4, gbpusd: 1e-4, audusd: 1e-4, nzdusd: 1e-4, usdcad: 1e-4, usdchf: 1e-4 };
export const TRIGS = ['EG', 'EF', 'QM'], STOPS = ['pips', 'zone'], EXITS = [1, 2, 3], CALLS = ['all', 'agree'];
export const STOP_PIPS = 30, ATRK = 0.1, LIMIT_WAIT = 24, CAP = 5 * 86400, ZONE_DAYS = 20 * 86400;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);
export const NM = 262, DM = 120, NCELL = 54;
// cells 0..35: market set ((call * 3 + trig) * 2 + stop) * 3 + exit; 36..53: limit set 36 + (trig * 2 + stop) * 3 + exit
export const cellIndex = (set, call, tr, st, x) => (set === 0 ? ((call * 3 + tr) * 2 + st) * 3 + x : 36 + (tr * 2 + st) * 3 + x);
export function cellName(i) { const set = i < 36 ? 0 : 1; let j = set ? i - 36 : i; const x = j % 3; j = (j - x) / 3; const st = j % 2; j = (j - st) / 2; const tr = j % 3; const call = set ? 0 : (j - tr) / 3;
  return { set: set ? 'limit' : 'market', call: CALLS[call], trig: TRIGS[tr], stop: STOPS[st], exit: EXITS[x] + 'R', s: set, c: call, tr, st, x }; }
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };

// desk-shaped candles
const desk = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
// the desk's 30-minute candles from 15-minute ones (council/eg-methods.mjs m30of, not exported: the same lines)
export const m30of = (M15) => { const out = []; for (let i = 1; i < M15.length; i++) { const a = M15[i - 1], b = M15[i]; if (a.time % 1800 === 0 && b.time === a.time + 900) out.push({ time: a.time, open: a.open, high: Math.max(a.high, b.high), low: Math.min(a.low, b.low), close: b.close }); } return out; };
const lowerAt = (Z, t) => { let lo = 0, hi = Z.length; while (lo < hi) { const m = (lo + hi) >> 1; if (Z[m].at < t) lo = m + 1; else hi = m; } return lo; };

// ---- every trigger of the three types, with the plan's condition (side + H4 zone) marked; closed candles only --------------
// { tr, tf, d, T (known at), top, bot, lim (limit price), far (zone far side), plan, call, atr }
export function signals(M5, F) {
  const M15 = desk(F['15m']), H4 = desk(K.resample(M5, 14400)), D1 = foldWeekend(desk(K.resample(M5, 86400)));
  const M30 = m30of(M15), sides = snrSides(D1, H4), Z4 = turnBack(H4, zones(H4, '4h'), 14400).sort((a, b) => a.at - b.at);
  const sideAt = (t) => { let lo = 0, hi = sides.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sides[m].t <= t) lo = m + 1; else hi = m; } return lo ? sides[lo - 1] : null; };
  // an H4 zone of side d for a trigger candle c known at T (the desk's snrTrades test; Tz: latest formation time of a same-side zone)
  const inH4 = (d, c, T, S, Tz) => { for (let i = lowerAt(Z4, S.t - ZONE_DAYS); i < Z4.length && Z4[i].at <= T; i++) { const z = Z4[i];
      if (!(d > 0 ? c.low <= z.top && c.close >= z.bot : c.high >= z.bot && c.close <= z.top)) continue;
      if (z.dir === d && z.at <= Tz && z.end > T) return true;
      if (z.dir === -d && z.fail != null && z.fail <= T && T - z.fail < ZONE_DAYS && !(z.back != null && z.back <= T)) return true; }
    return false; };
  const calls = dailyCalls(F), DN = F['1d'], callAt = (t) => { const i = K.closedCount(DN, t) - 1; return i >= 0 ? calls[i] : 0; };
  const A15 = atr14(F['15m']), atrAt = (t) => { const i = K.closedCount(F['15m'], t) - 1; return i >= 0 ? A15[i] : 0; };
  const out = [];
  const push = (tr, tf, d, T, top, bot, lim, c, Tz) => { const S = sideAt(T); const plan = !!(S && S.dir === d && inH4(d, c, T, S, Tz));
    out.push({ tr, tf, d, T, top, bot, lim, far: d > 0 ? bot : top, plan, call: callAt(T), atr: atrAt(T) }); };
  for (const [tf, C] of [['15m', M15], ['30m', M30]]) { const Z = zones(C, tf);
    for (const z of Z) push(0, tf, z.dir, z.at, z.top, z.bot, z.dir > 0 ? z.top : z.bot, C[z.i], z.at);
    for (const z of Z) if (z.fail != null) { const d = -z.dir; push(1, tf, d, z.fail, z.top, z.bot, d > 0 ? z.top : z.bot, C[z.fi], z.fail); } }
  for (const q of qmSetups(M15)) push(2, q.tf, q.dir, q.at, q.top, q.bot, q.level, q.head, q.head.time + (q.tf === '30m' ? 1800 : 900));
  return out.sort((a, b) => a.T - b.T || a.tr - b.tr || (a.tf === '15m' ? -1 : 1));
}

// ---- one trade, three targets in one pass. lim: a limit fill inside candle fi (only the stop counts on that candle) ---------
export function exits(M5, s, fi, fill, stop, lim = false) {
  const risk = s * (fill - stop); if (!(risk > 0)) return null;
  const tg = EXITS.map((k) => fill + s * k * risk), R = [NaN, NaN, NaN], dl = M5[fi].t + CAP; let left = 3;
  const fin = (k, px) => { if (Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) for (let k = 0; k < 3; k++) fin(k, b.o); else for (let k = 0; k < 3; k++) if (s * (b.o - tg[k]) >= 0) fin(k, b.o); }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) for (let k = 0; k < 3; k++) fin(k, stop);
    if (!(lim && j === fi)) for (let k = 0; k < 3; k++) if (s * ((s > 0 ? b.h : b.l) - tg[k]) >= 0) fin(k, tg[k]);
    if (b.e >= dl) for (let k = 0; k < 3; k++) fin(k, b.c); }
  return left ? null : { fill, risk, R };
}
// a resting limit filled only when traded through by half the round trip, within LIMIT_WAIT candles; a candle that opens through
// the limit fills at its open (the better price)
export function limitFill(M5, s, entry, T, half) {
  const i0 = startIdx(M5, T);
  for (let q = i0; q < M5.length && q < i0 + LIMIT_WAIT; q++) { const b = M5[q];
    if (s > 0 ? b.l <= entry - half : b.h >= entry + half) return { i: q, fill: s > 0 ? Math.min(entry, b.o) : Math.max(entry, b.o) }; }
  return null;
}
export function stopOf(g, st, fill, market) { return st === 0 ? fill - g.d * STOP_PIPS * PIP[market] : g.far - g.d * ATRK * g.atr; }

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(M5, F), cost = COSTS[market], X = exclusions(market);
  const cnt = { signals: sigs.length, plan: 0, dropped: 0, bad: 0, small: 0, nofill: 0 };
  // one per (trigger type, time, side): the first (15-minute before 30-minute)
  const seen = new Set(), G = sigs.filter((g) => { const k = g.tr + '|' + g.T + '|' + g.d; if (seen.has(k)) return false; seen.add(k); return true; });
  // simulate one trigger: { t, m, w, key, mk: [stop] -> {R, risk, flip}, lm: [stop] -> {R, risk} }
  const sim = (g) => {
    const o = { mk: [null, null], lm: [null, null] }, fi = startIdx(M5, g.T); if (fi >= M5.length) return null;
    const t = M5[fi].t; if (t < FROM || t >= TO) return null;
    o.t = t; o.m = monthOf(t); o.w = t < SPLIT ? 0 : 1; o.key = o.m * 24 + new Date(g.T * 1000).getUTCHours();
    if (X.length && inBad(X, t)) { o.bad = true; return o; }
    const fill = M5[fi].o;
    for (let st = 0; st < 2; st++) { const stop = stopOf(g, st, fill, market), risk = g.d * (fill - stop);
      if (!(risk > 0)) { o.mk[st] = 'bad'; continue; } if (risk < cost) { o.mk[st] = 'small'; continue; }
      const r = exits(M5, g.d, fi, fill, stop), p = exits(M5, -g.d, fi, fill, fill + g.d * risk);
      if (!(g.d * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      if (r && p) o.mk[st] = { R: r.R, flip: p.R, cr: cost / risk }; }
    const lf = limitFill(M5, g.d, g.lim, g.T, cost / 2);
    if (lf) { const lt = M5[lf.i].t; if (!(X.length && inBad(X, lt))) for (let st = 0; st < 2; st++) { const stop = st === 0 ? lf.fill - g.d * STOP_PIPS * PIP[market] : g.far - g.d * ATRK * g.atr, risk = g.d * (lf.fill - stop);
      if (!(risk > 0) || risk < cost) continue; const r = exits(M5, g.d, lf.i, lf.fill, stop, true);
      if (r) o.lm[st] = { R: r.R, cr: cost / risk, m: monthOf(lt), w: lt < SPLIT ? 0 : 1 }; } }
    else o.nofill = true;
    return o; };
  const real = newAcc(), ctl = newAcc(), plac = newAcc();
  const keys = Array.from({ length: NCELL }, () => new Set());
  const feed = (A, g, o, isCtl) => {
    for (let st = 0; st < 2; st++) { const x0 = o.mk[st]; if (x0 && typeof x0 === 'object') for (let c = 0; c < 2; c++) { if (c === 1 && g.call !== g.d) continue;
        for (let x = 0; x < 3; x++) { const ci = cellIndex(0, c, g.tr, st, x); if (isCtl) { if (!keys[ci].has(o.key)) continue; } else keys[ci].add(o.key);
          add(A, ci, o.w, o.m, x0.R[x], x0.cr); if (!isCtl) add(plac, ci, o.w, o.m, x0.flip[x], x0.cr); } }
      const l0 = o.lm[st]; if (l0) for (let x = 0; x < 3; x++) { const ci = cellIndex(1, 0, g.tr, st, x); if (isCtl) { if (!keys[ci].has(o.key)) continue; } else keys[ci].add(o.key);
        add(A, ci, l0.w, l0.m, l0.R[x], l0.cr); } } };
  const sims = new Map();
  for (const g of G) if (g.plan) { const o = sim(g); if (!o) continue; sims.set(g, o); cnt.plan++;
    if (o.bad) { cnt.dropped++; continue; } if (o.nofill) cnt.nofill++; for (const v of o.mk) { if (v === 'bad') cnt.bad++; if (v === 'small') cnt.small++; }
    feed(real, g, o, false); }
  const want = new Set(); for (const s of keys) for (const k of s) want.add(k);
  for (const g of G) { const fi = startIdx(M5, g.T); if (fi >= M5.length) continue; const t = M5[fi].t;
    if (!want.has(monthOf(t) * 24 + new Date(g.T * 1000).getUTCHours())) continue;
    const o = sims.get(g) || sim(g); if (!o || o.bad) continue; feed(ctl, g, o, true); }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), pip: PIP[market], first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    triggers: G.length, ...cnt, real: J(real), ctl: J(ctl), plac: J(plac) };
}

// ---- cut test: plan signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.tr, g.tf, g.T, g.d, g.far.toFixed(8), g.atr.toFixed(8), g.call].join('|');
  const full = signals(M5, frames(M5)).filter((g) => g.plan); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000, C5 = M5.filter((b) => b.e <= T);
    const cut = signals(C5, frames(C5)).filter((g) => g.plan && g.T <= T).map(key), want = full.filter((g) => g.T <= T).map(key);
    const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics and the bar -----------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: n ? mstat(ms, a, b).t : 0, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: n ? mstat(msn, a, b).t : 0,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export function judge(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctl'), P = pool(data, 'plac'), rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), cs = cellStats(C, c), nm = cellName(c), ps = nm.s === 0 ? cellStats(P, c) : null;
    rows.push({ cell: c, ...nm, d: s.d, c: s.c, p: s.c.n ? p1(s.c.t, s.c.months - 1) : 1, ctl: { d: cs.d, c: cs.c }, vs: { d: welch(s.d, cs.d), c: welch(s.c, cs.c) },
      plac: ps ? { d: ps.d, c: ps.c, p: ps.c.n ? p1(ps.c.t, ps.c.months - 1) : 1 } : null }); }
  const H = K.holm(rows.map((r) => r.p)); const pr = rows.filter((r) => r.plac), HP = K.holm(pr.map((r) => r.plac.p));
  pr.forEach((r, i) => { r.plac.holm = HP[i]; r.plac.pass = r.plac.d.n >= 300 && r.plac.c.n >= 300 && r.plac.d.mean > 0 && r.plac.c.mean > 0 && r.plac.d.t >= 2 && r.plac.c.t >= 2 && HP[i] < 0.05; });
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
export const cname = (r) => `${r.set} ${r.trig} ${r.stop}-stop ${r.exit}${r.call === 'agree' ? ' +MSNR' : ''}`;
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(4), t: +w.t.toFixed(2), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(4), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), plPass = rows.filter((r) => r.plac && r.plac.pass), enough = rows.filter((r) => r.checks.n);
  const verdict = pass.length ? 'PASS' : enough.length ? 'FAIL' : 'INCONCLUSIVE';
  const bestC = [...rows].filter((r) => r.c.n).sort((a, b) => b.c.t - a.c.t)[0];
  const head = pass.length ? pass[0] : bestC;
  const headline = verdict === 'PASS'
    ? `${pass.length} of 54 cells pass; best ${cname(head)}, ${f3(head.c.mean)}R a trade before costs in 2015-26 (n ${N(head.c.n)}, month t ${f2(head.c.t)})`
    : `0 of 54 cells pass; the best confirmation cell, ${cname(head)}, made ${f3(head.c.mean)}R a trade before costs in 2015-26 (n ${N(head.c.n)}, month t ${f2(head.c.t)}; its control ${f3(head.ctl.c.mean)}R)`;
  const G = data.find((d) => d.market === 'xau'), GA = pool([G], 'real'), GC = pool([G], 'ctl');
  const gold = rows.filter((r) => r.stop === 'pips' && r.call === 'all').map((r) => { const s = cellStats(GA, r.cell), c = cellStats(GC, r.cell); return { cell: cname(r), d: slim(s.d), c: slim(s.c), ctlD: slim(c.d), ctlC: slim(c.c) }; });
  const perMarket = {}; for (const r of pass) perMarket[r.cell] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const out = { study: 'msnr-plan-wide', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS, assumedCosts: ASSUMED,
    costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), pips: Object.fromEntries(data.map((d) => [d.market, d.pip])),
    meta: data.map((d) => ({ market: d.market, first: d.first ? new Date(d.first * 1000).toISOString().slice(0, 10) : null, last: d.last ? new Date(d.last * 1000).toISOString().slice(0, 10) : null,
      triggers: d.triggers, plan: d.plan, dropped: d.dropped, bad: d.bad, small: d.small, nofill: d.nofill })),
    passed: pass.map(cname), placeboPassed: plPass.map(cname), bestConfirmation: cname(bestC), cut,
    checksCount: { n: rows.filter((r) => r.checks.n).length, disc: rows.filter((r) => r.checks.disc).length, conf: rows.filter((r) => r.checks.conf).length,
      both: rows.filter((r) => r.checks.disc && r.checks.conf).length, holm: rows.filter((r) => r.checks.holm).length, control: rows.filter((r) => r.checks.control).length },
    gold, cells: rows.map((r) => ({ cell: cname(r), set: r.set, call: r.call, trig: r.trig, stop: r.stop, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
      control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) }, vsControl: { d: r.vs.d == null ? null : +r.vs.d.toFixed(2), c: r.vs.c == null ? null : +r.vs.c.toFixed(2) },
      checks: r.checks, pass: r.pass, placebo: r.plac ? { disc: slim(r.plac.d), conf: slim(r.plac.c), holm: +r.plac.holm.toFixed(4), pass: r.plac.pass } : null })), perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), cc = o.checksCount, L = [];
  L.push('# The MSNR plan with market entries on ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The MSNR desk\'s plan, its pieces imported from `council/eg-methods.mjs` (`snrSides`, `zones`, `turnBack`, `qmSetups`): a Daily',
    'rejection of a fresh Daily level confirmed by an H4 break within 3 trading days gives the side; inside an H4 zone of that side',
    '(an engulf zone, or an opposite zone that failed) a 15- / 30-minute engulf (EG), a failed opposite 15- / 30-minute engulf (EF)',
    'or a 15- / 30-minute QM is the trigger. Entry at market (the next 5-minute open) or, as a second set, a limit at the trigger',
    'zone filled only when traded through by half the round trip. Stop 30 pips in the market\'s own pip, or past the trigger zone',
    '+ 0.1 ATR(14) of M15; 1R / 2R / 3R targets, 5 days at most. Each cell against the same trigger taken anywhere at matched times',
    '(same calendar month and UTC hour). Ten markets pooled, OANDA mid 5-minute candles; discovery 2005-2014, confirmation 2015 to',
    `October 2026. Costs only beside the verdict: demo figures for gold and the four majors, **ASSUMED** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cc.n} of 54.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cc.disc}; in confirmation: ${cc.conf}; both: ${cc.both}.`,
    `- Holm-adjusted p < 0.05 over the 54 confirmation tests: ${cc.holm}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${cc.control}.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped check (market set) passing bars 1-3: ${o.placeboPassed.length}${o.placeboPassed.length ? ' (' + o.placeboPassed.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; control = the same trigger anywhere at matched times; "vs ctl" =',
    'Welch t of the cell against its control (discovery / confirmation); Holm on the confirmation test.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net | ctl R 05-14 | n 15-26 | R 15-26 (t) | net | ctl R 15-26 | vs ctl | Holm | Flipped R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${f3(r.ctl.d.mean)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.ctl.c.mean)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} | ${r.holm.toFixed(3)} | ${r.plac ? f3(r.plac.c.mean) + ' (' + f2(r.plac.c.t) + ')' : '-'} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${cname(rows[c])}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) |', '|---|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) |`); L.push(''); } }
  L.push('## Gold alone (reported, not judged)', '', 'The desk plan\'s own market with its own 30-pip stop, before costs; control = the same trigger on gold anywhere at matched times.', '',
    '| Cell | n 06-14 | R 06-14 (t) | ctl | n 15-26 | R 15-26 (t) | ctl |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const g of o.gold) L.push(`| ${g.cell} | ${N(g.d.n)} | ${f3(g.d.mean)} (${f2(g.d.t)}) | ${f3(g.ctlD.mean)} | ${N(g.c.n)} | ${f3(g.c.mean)} (${f2(g.c.t)}) | ${f3(g.ctlC.mean)} |`);
  L.push('');
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'none'}: ${N(nCut)} plan signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop, or a risk under the round trip, is no trade.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).',
    '- Gold\'s 30-pip stop is $3.00 in every year (about 0.6 % of price in 2005, 0.07 % in 2026): the rule as the desk writes it.', '',
    '| Market | candles from | triggers | plan triggers | dropped (bad data) | stop past the fill | risk under cost | limit not filled |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.triggers)} | ${N(m.plan)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${N(m.nofill)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted and is not called an edge before a forward record.');
  else L.push('With market entries the plan\'s conditions (a Daily rejection, an H4 break, an H4 zone) do not pick triggers that beat the',
    'same triggers taken anywhere, on ten markets over 22 years. The out-of-sample gold figure of `desk-rigor` rested on resting',
    'limits; read with an entry that a touch fill cannot flatter, the plan is not an edge. Do not re-test variants of these 54',
    'cells on these years. Nothing live changed; no rule is proposed.', '',
    `The ${o.checksCount.control} cells that "beat" their control (Welch t >= 2 in both windows) lose money themselves: the plan lost a little`,
    'less than the same trigger taken anywhere, with a stop past the trigger zone. Before costs every market-entry cell is within',
    'about 0.05R of zero; after costs every one of the 54 cells loses. The side-flipped trades that clear bars 1-3 are the mirror',
    'of small losses at a 1R / 2R exit and lose after costs: not a fade rule.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'triggers', r.triggers, 'plan', r.plan, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
