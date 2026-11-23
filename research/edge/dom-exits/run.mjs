// research/edge/dom-exits/run.mjs - which exit suits the H1 dominant-zone limit on 2010-2019 (PREREGISTRATION.md, 23 Nov 2026).
// node --max-old-space-size=6000 research/edge/dom-exits/run.mjs market <m> <dir>   one market's trades to <dir>/<m>.json
// node research/edge/dom-exits/run.mjs report <dir>                                   the tests -> result.json
// Research only: imports the grid 3 engine and edgekit unchanged; writes only to <dir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, buildZones, egZones, multi, COSTS, exclusions, NONE } from '../combo-grid-3/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), MID = y(2015), TO = y(2020);
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const EXITS = ['1R', '2R', '3R', '4R', '6R', 'opp', 'trail', 'far', 'eftrail', '24h']; // the first nine = multi()'s slots
const CAP = 2 * 86400, W = 12;

export function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }

// the 24 h exit and the 2R exit's time, from the fill candle (index fi): the stop first, a gap through a level fills at the open,
// on the fill candle only the stop counts, out at the close of the candle that ends at or after the deadline.
export function walk(M5, fi, s, fill, stop, risk, { target = null, hold = CAP } = {}) {
  const deadline = M5[fi].t + hold;
  for (let j = fi; j < M5.length; j++) { const b = M5[j], first = j === fi;
    if (!first) { if (s * (b.o - stop) <= 0) return { R: (s * (b.o - fill)) / risk, t: b.t };
      if (target != null && s * (b.o - target) >= 0) return { R: (s * (b.o - fill)) / risk, t: b.t }; }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) return { R: (s * (stop - fill)) / risk, t: b.t };
    if (!first && target != null && s * ((s > 0 ? b.h : b.l) - target) >= 0) return { R: (s * (target - fill)) / risk, t: b.t };
    if (b.e >= deadline) return { R: (s * (b.c - fill)) / risk, t: b.e };
  }
  return null;
}

export function trades(market, from = FROM, to = TO, dataTo = to + 5 * 86400) { // dataTo: the last candle read (the cut test)
  const M5 = K.load(market, '5m', { from: from - 200 * 86400, to: dataTo }); if (!M5.length) return [];
  const F = frames(M5), H = F['1h'], T = F['5m'], A = atr14(H), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const Zc = {}, Z = (Zc['1hdom'] = buildZones('dom', H));
  const FAR = []; for (const tf of ['4h', '1d']) for (const k of ['eg', 'ef']) FAR.push(...buildZones(k, F[tf]));
  const efMap = new Map(); for (const z of egZones(M5, 3)) if (z.fi >= 0) { const a = efMap.get(z.fi) || []; a.push({ d: z.d, top: z.top, bot: z.bot }); efMap.set(z.fi, a); }
  const near = (list, s, ref) => { let best = null; for (const e of list) if (s * (e - ref) > 0 && (best == null || s * (best - e) > 0)) best = e; return best; };
  const idx = (t) => { let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < t) lo = m + 1; else hi = m; } return lo; };
  const out = []; let mism = 0;
  for (const sg of signalsFor(F, '1h', '5m', 'dom', Zc, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, s = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = s > 0 ? z.top : z.bot, stop = s > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li];
    const rk0 = s * (entry - stop); if (!(rk0 >= 2 * cost)) continue;
    const opp = []; for (const o of Z) if (o.at <= ts && o.end > ts && o.d === -s) opp.push(s > 0 ? o.bot : o.top);
    const fz = []; for (const o of FAR) if (o.at <= ts && o.end > ts && o.d === -s) fz.push(s > 0 ? o.bot : o.top);
    const on = near(opp, s, entry); let oppR = on == null ? 2 : (s * (on - entry)) / rk0; if (!(oppR >= 1)) oppR = 2;
    const fn = near(fz, s, entry); const farR = fn != null && (s * (fn - entry)) / rk0 >= 3 ? (s * (fn - entry)) / rk0 : null;
    const r = multi(M5, s, entry, stop, 'lim', ts, ts + W * 300, oppR, farR, CAP, efMap);
    if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
    const fi = idx(r.t), fill = stop + s * r.risk;
    const w2 = walk(M5, fi, s, fill, stop, r.risk, { target: fill + 2 * s * r.risk }), w24 = walk(M5, fi, s, fill, stop, r.risk, { hold: 86400 });
    if (!w2 || !w24) continue;
    if (Math.abs(w2.R - r.R[1]) > 1e-9) mism++;
    const row = { t: r.t, s, cr: +(cost / r.risk).toFixed(6), x2: w2.t, R: [...r.R.slice(0, 9), w24.R].map((v) => (Number.isFinite(v) ? +v.toFixed(5) : null)) };
    out.push(row);
  }
  if (mism) throw new Error(`${market}: 2R walk differs from multi() on ${mism} trades`);
  return out;
}

// ---- statistics ------------------------------------------------------------------------------------------------------
const mkey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthT(vals) { // vals: [[t, x]] -> t on calendar-month sums
  const m = new Map(); for (const [t, x] of vals) m.set(mkey(t), (m.get(mkey(t)) || 0) + x);
  const v = [...m.values()], n = v.length; if (n < 3) return { months: n, t: null, sum: v.reduce((a, b) => a + b, 0) };
  const mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null, sum: mean * n };
}
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
export function summ(rows, k) {
  const ok = rows.filter((r) => r.R[k] != null); const n = ok.length; if (!n) return { n: 0 };
  const g = ok.reduce((a, r) => a + r.R[k], 0) / n, c = ok.reduce((a, r) => a + r.cr, 0) / n;
  const win = ok.filter((r) => r.R[k] > 0).length / n;
  return { n, before: r4(g), tBefore: r4(monthT(ok.map((r) => [r.t, r.R[k]])).t), after: r4(g - c), tAfter: r4(monthT(ok.map((r) => [r.t, r.R[k] - r.cr])).t), win: r4(win) };
}
export function diff(rows, k, base = 1) {
  const ok = rows.filter((r) => r.R[k] != null && r.R[base] != null); const n = ok.length; if (!n) return { n: 0 };
  const d = ok.map((r) => [r.t, r.R[k] - r.R[base]]); const m = monthT(d);
  return { n, mean: r4(d.reduce((a, x) => a + x[1], 0) / n), t: r4(m.t), months: m.months, p: m.t == null ? 1 : K.pFromT(m.t, m.months - 1) };
}
function perDay(rows) { // trades per weekday (UTC date of the fill) over 2010-2019, zero days included
  const c = new Map(); for (const r of rows) { const d = Math.floor(r.t / 86400); c.set(d, (c.get(d) || 0) + 1); }
  const v = []; for (let d = FROM / 86400; d < TO / 86400; d++) { const wd = new Date(d * 86400e3).getUTCDay(); if (wd === 0 || wd === 6) continue; v.push(c.get(d) || 0); }
  v.sort((a, b) => a - b); const sum = v.reduce((a, b) => a + b, 0);
  return { mean: +(sum / v.length).toFixed(2), p95: v[Math.floor(0.95 * (v.length - 1))], max: v[v.length - 1] };
}
export function openAtOnce(rows) { // positions open at once with the 2R exit: [fill, exit) intervals
  const ev = []; for (const r of rows) { ev.push([r.t, 1]); ev.push([r.x2, -1]); }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]); let cur = 0, max = 0; const at = [];
  for (const [, d] of ev) { cur += d; if (d > 0) at.push(cur); if (cur > max) max = cur; }
  at.sort((a, b) => a - b); return { max, p95AtEntry: at.length ? at[Math.floor(0.95 * (at.length - 1))] : 0, over3AtEntry: r4(at.filter((x) => x > 3).length / (at.length || 1)), over10AtEntry: r4(at.filter((x) => x > 10).length / (at.length || 1)) };
}

export function report(all) { // all: { market: rows }
  const pooled = Object.values(all).flat();
  const A1 = pooled.filter((r) => r.t < MID), A2 = pooled.filter((r) => r.t >= MID);
  const T1 = { early: summ(A1, 1), late: summ(A2, 1) };
  const t1 = T1.early.before > 0 && T1.early.tBefore >= 2 && T1.late.before > 0 && T1.late.tBefore >= 2;
  const others = EXITS.map((_, k) => k).filter((k) => k !== 1);
  const T2 = {}; const ps = others.map((k) => diff(pooled, k).p); const h = K.holm(ps);
  others.forEach((k, i) => { const all_ = diff(pooled, k), e = diff(A1, k), l = diff(A2, k);
    const beats = all_.mean > 0 && h[i] < 0.05 && e.mean > 0 && l.mean > 0;
    T2[EXITS[k]] = { ...all_, p: r4(all_.p), holm: r4(h[i]), early: { n: e.n, mean: e.mean, t: e.t }, late: { n: l.n, mean: l.mean, t: l.t }, beats }; });
  const exits = {}; EXITS.forEach((x, k) => { exits[x] = { all: summ(pooled, k), early: summ(A1, k), late: summ(A2, k) }; });
  const perMarket = {}; for (const [m, rows] of Object.entries(all)) { perMarket[m] = { perDay: perDay(rows), open: openAtOnce(rows), exits: {} };
    EXITS.forEach((x, k) => { perMarket[m].exits[x] = summ(rows, k); }); }
  const best = Object.entries(T2).filter(([, v]) => v.beats).map(([k]) => k);
  return { verdict: t1 ? 'PASS' : 'FAIL', t1, T1, T2, beats2R: best, exits, perMarket, perDayAll: perDay(pooled), openAll: openAtOnce(pooled) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const rows = trades(a); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(rows)); console.log(a, rows.length); }
  // the cut test: candles cut at C give the same trades (every exit) as the whole series for fills before C - 3 days
  if (cmd === 'cut') { const C = y(2014) + 137 * 86400, full = trades(a, FROM, TO), cut = trades(a, FROM, C, C);
    const key = (r) => JSON.stringify(r), want = full.filter((r) => r.t < C - 3 * 86400).map(key).sort(), got = cut.filter((r) => r.t < C - 3 * 86400).map(key).sort();
    const same = want.length === got.length && want.every((k, i) => k === got[i]);
    fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify({ market: a, cutAt: C, trades: want.length, same })); console.log(a, 'cut', want.length, same); }
  if (cmd === 'report') {
    const all = {}; for (const m of MARKETS) all[m] = JSON.parse(fs.readFileSync(path.join(a, m + '.json'), 'utf8'));
    const cut = MARKETS.map((m) => path.join(a, 'cut-' + m + '.json')).filter((f) => fs.existsSync(f)).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
    const res = report(all), { early: e, late: l } = res.T1, n = (x) => x.toLocaleString('en-GB'), sg = (x) => (x > 0 ? '+' : '') + x.toFixed(3);
    const top = Object.entries(res.T2).sort((p, q) => p[1].holm - q[1].holm)[0];
    const headline = `Before costs the H1 dominant-zone limit with a 2R target made ${sg(e.before)}R a trade in 2010-14 (n ${n(e.n)}, month t ${e.tBefore.toFixed(2)}) and ${sg(l.before)}R in 2015-19 (n ${n(l.n)}, t ${l.tBefore.toFixed(2)}); `
      + (res.beats2R.length ? `${res.beats2R.join(', ')} beat 2R after Holm` : `no other exit beats 2R after Holm (${top[0]} ${sg(top[1].mean)}R a trade better, Holm p ${top[1].holm.toFixed(3)})`)
      + `; after costs every exit loses (2R ${sg(res.exits['2R'].all.after)}R).`;
    const out = { study: 'dom-exits', built: '2026-11-23', verdict: res.verdict, headline, basis: 'judged before costs (owner); after costs beside', ...res, cut };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ verdict: out.verdict, T1: out.T1, T2: out.T2, perDay: out.perDayAll, open: out.openAll }, null, 1));
  }
}
