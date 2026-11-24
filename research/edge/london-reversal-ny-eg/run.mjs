// research/edge/london-reversal-ny-eg/run.mjs - PREREGISTRATION.md (24 Nov 2026): London sweeps one side of the Asia range and
// closes its session beyond the Asia middle / other side (a reversal day so far); in New York (12:00-16:00 UTC) the first
// pullback into an H1 engulf zone of London's direction is taken with a limit at the zone's near edge, stop past the zone,
// targets 1R / 2R, out at 20:00 UTC. 8 cells, five markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged AFTER costs.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/london-reversal-ny-eg/run.mjs all <outDir>     (markets one at a time, then the cut check)
//   node research/edge/london-reversal-ny-eg/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { zones } from '../../../council/eg-methods.mjs';
import { exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const LEVELS = ['mid', 'other'], SETS = ['lon', 'any'], TGS = [1, 2];
export const NCELL = 8, NCTL = 4, ATRK = 0.1, H = 3600;
export const cell = (lv, st, tg) => (lv * 2 + st) * 2 + tg;
export const cellName = (c) => `${LEVELS[c >> 2]} ${SETS[(c >> 1) & 1]} ${TGS[c & 1]}R`;
export const FROM = Date.UTC(2005, 0, 1) / 1000, SPLIT = Date.UTC(2015, 0, 1) / 1000, TO = Date.UTC(2026, 10, 1) / 1000;
export const NM = 262, DM = 120;
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
const lb = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };

// ---- the day: Asia range, London, the reversal so far (known at 12:00 UTC) ---------------------------------------------------
// returns null (not enough candles) or { d0, ah, al, mid, lh, ll, lc, dir (+1 / -1 / 0), other (bool) }
export function classify(M5, d0) {
  const a = lb(M5, d0), b = lb(M5, d0 + 7 * H), c = lb(M5, d0 + 12 * H);
  if (b - a < 60 || c - b < 48) return null;
  let ah = -Infinity, al = Infinity, lh = -Infinity, ll = Infinity;
  for (let i = a; i < b; i++) { if (M5[i].h > ah) ah = M5[i].h; if (M5[i].l < al) al = M5[i].l; }
  for (let i = b; i < c; i++) { if (M5[i].h > lh) lh = M5[i].h; if (M5[i].l < ll) ll = M5[i].l; }
  const lc = M5[c - 1].c, mid = (ah + al) / 2;
  let dir = 0, other = false;
  if (lh > ah && lc < mid) { dir = -1; other = lc < al; }
  else if (ll < al && lc > mid) { dir = 1; other = lc > ah; }
  return { d0, ah, al, mid, lh, ll, lc, dir, other };
}

// ---- H1 engulf zones with the H1 ATR(14) at the completing candle -------------------------------------------------------------
export function h1Zones(M5) {
  const H1 = K.resample(M5, H);
  const C = H1.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
  const tr = H1.map((b, i) => (i ? Math.max(b.h - b.l, Math.abs(b.h - H1[i - 1].c), Math.abs(b.l - H1[i - 1].c)) : b.h - b.l));
  const atr = new Array(H1.length).fill(null); let s = 0;
  for (let i = 0; i < H1.length; i++) { s += tr[i]; if (i >= 14) s -= tr[i - 14]; if (i >= 13) atr[i] = s / 14; }
  return zones(C, '1h').map((z) => ({ dir: z.dir, top: z.top, bot: z.bot, at: z.at, a: atr[z.i] })).filter((z) => z.a > 0).sort((p, q) => p.at - q.at);
}

// ---- the day's order: the first near edge reached 12:00-15:55 UTC among the alive zones of direction D ------------------------
// Zd: the day's zones (any direction; at within the day). set 0 = lon (known by 12:00), 1 = any (known before 16:00).
// returns null or { t (the fill candle's start), side, entry, stop, at (the zone's) }
export function dayOrder(M5, Zd, d0, D, set) {
  const zs = Zd.filter((z) => z.dir === D && z.at >= d0 + 8 * H && (set === 0 ? z.at <= d0 + 12 * H : z.at < d0 + 16 * H));
  if (!zs.length) return null;
  const dead = new Array(zs.length).fill(false);
  for (let j = lb(M5, d0 + 8 * H); j < M5.length && M5[j].t < d0 + 16 * H; j++) { const b = M5[j]; let best = -1;
    for (let k = 0; k < zs.length; k++) { const z = zs[k]; if (dead[k] || z.at > b.t) continue;
      if (D > 0 ? b.l <= z.top : b.h >= z.bot) {
        if (b.t < d0 + 12 * H) dead[k] = true;
        else if (best < 0 || (D > 0 ? z.top > zs[best].top : z.bot < zs[best].bot)) best = k; } }
    if (best >= 0) { const z = zs[best]; const entry = D > 0 ? z.top : z.bot, stop = D > 0 ? z.bot - ATRK * z.a : z.top + ATRK * z.a;
      return { t: b.t, side: D, entry, stop, at: z.at }; } }
  return null;
}

// every weekday of the candles: { day, orders: [lon, any] for the reversal direction, ctl: { '1': [lon, any], '-1': [lon, any] } }
export function setups(M5, Z = h1Zones(M5)) {
  const out = []; if (!M5.length) return out; let zi = 0;
  for (let d0 = Math.floor(M5[0].t / 86400) * 86400; d0 <= M5[M5.length - 1].t; d0 += 86400) {
    const wd = new Date(d0 * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const day = classify(M5, d0); if (!day) continue;
    while (zi < Z.length && Z[zi].at < d0) zi++;
    const Zd = []; for (let k = zi; k < Z.length && Z[k].at < d0 + 16 * H; k++) Zd.push(Z[k]);
    const ctl = { 1: [0, 1].map((s) => dayOrder(M5, Zd, d0, 1, s)), '-1': [0, 1].map((s) => dayOrder(M5, Zd, d0, -1, s)) };
    out.push({ day, hasZone: day.dir ? Zd.some((z) => z.dir === day.dir && z.at >= d0 + 8 * H) : false, orders: day.dir ? ctl[day.dir] : [null, null], ctl });
  }
  return out;
}

// one order, one target: edgekit's limit engine; the target is fixed with the order (entry + k x the planned risk)
export function trade(M5, o, d0, k, cost) {
  const risk = o.side * (o.entry - o.stop); if (!(risk > 0)) throw new Error('stop on the wrong side');
  const r = K.simulate({ side: o.side, entry: o.entry, stop: o.stop, target: o.entry + o.side * k * risk, t: o.t, type: 'limit', expire: d0 + 16 * H,
    maxHold: d0 + 20 * H - o.t }, M5, { cost });
  return r;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc(n) { return { ms: new Float64Array(n * NM), msNet: new Float64Array(n * NM), n: new Float64Array(n * 2), sum: new Float64Array(n * 2),
  net: new Float64Array(n * 2), sqNet: new Float64Array(n * 2), win: new Float64Array(n * 2), cr: new Float64Array(n * 2) }; }
function add(A, c, w, m, R, cr) { const x = R - cr; A.ms[c * NM + m] += R; A.msNet[c * NM + m] += x; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R;
  A.net[c * 2 + w] += x; A.sqNet[c * 2 + w] += x * x; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market, M5 = K.load(market, '5m', { from: '2004-12-01', to: '2026-11-01' })) {
  const cost = K.COSTS[market], X = exclusions(market), S = setups(M5);
  const A = newAcc(NCELL), C = newAcc(NCTL);
  const cnt = { days: 0, excluded: 0, mid: 0, other: 0, withZone: 0, fills: [0, 0], small: 0, odd: 0 };
  const run = (o, d0, each) => { if (!o) return false; if (o.t < FROM || o.t >= TO) return false;
    const risk = o.side * (o.entry - o.stop); if (risk < cost) { cnt.small++; return false; }
    TGS.forEach((k, tg) => { const r = trade(M5, o, d0, k, cost);
      if (!['win', 'loss', 'be'].includes(r.status) || r.fillT !== o.t) { cnt.odd++; return; }
      if (!(o.side * (r.fill - o.stop) > 0) && r.reason !== 'stop') throw new Error('stop not on the losing side');
      each(tg, r.fillT < SPLIT ? 0 : 1, monthOf(r.fillT), r.R, cost / r.risk); });
    return true; };
  for (const s of S) { const d0 = s.day.d0; if (d0 + 12 * H < FROM || d0 >= TO) continue;
    if (X.length && inBad(X, d0 + 12 * H)) { cnt.excluded++; continue; }
    cnt.days++;
    if (s.day.dir) { cnt.mid++; if (s.day.other) cnt.other++; if (s.hasZone) cnt.withZone++;
      s.orders.forEach((o, st) => { const ok = run(o, d0, (tg, w, m, R, cr) => { add(A, cell(0, st, tg), w, m, R, cr); if (s.day.other) add(A, cell(1, st, tg), w, m, R, cr); }); if (ok) cnt.fills[st]++; }); }
    for (const D of [1, -1]) s.ctl[D].forEach((o, st) => run(o, d0, (tg, w, m, R, cr) => add(C, st * 2 + tg, w, m, R, cr)));
  }
  const J = (Q) => Object.fromEntries(Object.entries(Q).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, counts: cnt, cells: J(A), control: J(C) };
}

// ---- cut check: what is known by a date, computed on candles cut there, equals the full run's ----------------------------------
export function cutTest(market, M5, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const key = (s) => [s.day.d0, s.day.dir, s.day.other, ...[...s.orders, ...s.ctl[1], ...s.ctl[-1]].map((o) => (o ? [o.t, o.side, o.entry, o.stop].join(':') : '-'))].join('|');
  const full = setups(M5); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const got = new Set(setups(M5.filter((b) => b.e <= T)).filter((s) => s.day.d0 + 16 * H <= T).map(key));
    const want = new Set(full.filter((s) => s.day.d0 + 16 * H <= T).map(key));
    out.push({ market, cut: c, n: want.size, missing: [...want].filter((k) => !got.has(k)).length, extra: [...got].filter((k) => !want.has(k)).length }); }
  return out;
}

// ---- statistics ----------------------------------------------------------------------------------------------------------------
export function mstat(ms, a, b) { const n = b - a; let s = 0; for (let i = a; i < b; i++) s += ms[i]; const mean = s / n; let q = 0;
  for (let i = a; i < b; i++) q += (ms[i] - mean) ** 2; const sd = Math.sqrt(q / (n - 1)); return { n, mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return t > 0 ? p / 2 : 1 - p / 2; };
export function pool(list, kind, n) { const A = newAcc(n); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d[kind][k][i]; return A; }
export function cellStats(A, c) {
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM; const net = n ? A.net[c * 2 + w] / n : null;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, meanNet: net, t: mstat(A.ms.subarray(c * NM, (c + 1) * NM), a, b).t,
      tNet: mstat(A.msNet.subarray(c * NM, (c + 1) * NM), a, b).t, win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null,
      varNet: n > 1 ? (A.sqNet[c * 2 + w] - n * net * net) / (n - 1) : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (r) => r.d.n >= 300 && r.c.n >= 300 && r.d.meanNet > 0 && r.c.meanNet > 0 && r.d.tNet >= 2 && r.c.tNet >= 2 && r.holm < 0.05;
export const verdictOf = (rows) => (rows.some((r) => r.pass) ? 'PASS' : rows.some((r) => r.d.n >= 300 && r.c.n >= 300) ? 'FAIL' : 'INCONCLUSIVE');
const welch = (x, y) => (x.n > 1 && y.n > 1 && x.varNet != null && y.varNet != null ? (x.meanNet - y.meanNet) / Math.sqrt(x.varNet / x.n + y.varNet / y.n) : null);
export function judge(data) {
  const A = pool(data, 'cells', NCELL), C = pool(data, 'control', NCTL); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(A, c), k = cellStats(C, c & 3);
    rows.push({ cell: cellName(c), d: s.d, c: s.c, p: p1(s.c.tNet, s.c.months - 1), ctl: k, vs: { d: welch(s.d, k.d), c: welch(s.c, k.c) } }); }
  const Hm = K.holm(rows.map((r) => r.p)); rows.forEach((r, i) => { r.holm = Hm[i]; r.pass = passOf(r); });
  return rows;
}
// the best cell: the highest after-cost confirmation mean among cells with n >= 300 in both windows, else among all with trades
export function bestOf(rows) { const ok = rows.filter((r) => r.d.n >= 300 && r.c.n >= 300); const L = (ok.length ? ok : rows.filter((r) => r.c.n > 0));
  return L.slice().sort((a, b) => b.c.meanNet - a.c.meanNet)[0] || null; }

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), t: +w.t.toFixed(6),
  tNet: +w.tNet.toFixed(6), win: w.win == null ? null : +w.win.toFixed(4), costR: w.costR == null ? null : +w.costR.toFixed(4) });

function report(outDir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(outDir, m + '.json'), 'utf8')));
  const cut = JSON.parse(fs.readFileSync(path.join(outDir, 'cut.json'), 'utf8'));
  const rows = judge(data), verdict = verdictOf(rows), best = bestOf(rows);
  const cells = rows.map((r) => ({ cell: r.cell, disc: slim(r.d), conf: slim(r.c), p: +r.p.toPrecision(6), holm: +r.holm.toPrecision(6), pass: r.pass,
    control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) }, welchVsControl: { disc: r.vs.d == null ? null : +r.vs.d.toFixed(2), conf: r.vs.c == null ? null : +r.vs.c.toFixed(2) } }));
  const bi = rows.indexOf(best), bc = cells[bi];
  const headline = `${rows.filter((r) => r.pass).length} of 8 cells pass; the best cell, ${bc.cell}, made ${f3(bc.conf.meanNet)}R a trade after costs in 2015-26 (n ${N(bc.conf.n)}, month t ${f2(bc.conf.tNet)}; before costs ${f3(bc.conf.mean)}R; 2005-14 ${f3(bc.disc.meanNet)}R after costs, n ${N(bc.disc.n)}, month t ${f2(bc.disc.tNet)})`;
  const byMarket = data.map((d) => { const s = cellStats(pool([d], 'cells', NCELL), bi); return { market: d.market, disc: slim(s.d), conf: slim(s.c) }; });
  const counts = data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), ...d.counts }));
  const tot = (k) => counts.reduce((a, c) => a + (Array.isArray(c[k]) ? 0 : c[k]), 0);
  const res = { study: 'london-reversal-ny-eg', run: '2026-11-24', verdict, headline, best: bc.cell, passed: cells.filter((c) => c.pass).map((c) => c.cell), markets: MARKETS,
    windows: { discovery: '2005-01-01 to 2014-12-31', confirmation: '2015-01-01 to 2026-10-31' }, costs: Object.fromEntries(MARKETS.map((m) => [m, K.COSTS[m]])),
    cells, byMarket, counts, cut };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const L = [];
  L.push('# London reversal day, New York pullback into an H1 engulf zone (result)', '', `**Verdict: ${verdict}. ${headline}.**`, '');
  L.push('Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing is',
    'proposed. One run, no variants. Judged AFTER costs (the demo round trips of `edgekit` `COSTS`).', '');
  L.push('## What was run', '',
    'On a UTC weekday: the Asia range = high and low of the 5-minute candles starting 00:00-06:55; London = 07:00-11:55. A reversal day',
    'so far = London traded beyond one side of the Asia range and its last candle closed beyond the Asia middle (`mid`) or beyond the',
    'range\'s other side (`other`), known at 12:00. In New York (fills 12:00-15:55) a limit rests at the near edge of every H1 engulf',
    'zone of London\'s direction made that day from 08:00 on and not yet traded into (`lon`: zones known by 12:00; `any`: also zones',
    'completed in New York); the first edge reached is the day\'s one trade. Stop past the zone\'s far edge by 0.1 H1 ATR(14), targets',
    '1R and 2R, out at 20:00 UTC. Stop first in a candle holding both; on the fill candle only the stop counts. Five markets pooled',
    '(xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute candles; discovery 2005-2014, confirmation 2015 to October 2026.', '');
  L.push('## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${rows.filter((r) => r.d.n >= 300 && r.c.n >= 300).length} of 8.`,
    `- Mean R after costs > 0 and month t >= 2 in discovery: ${rows.filter((r) => r.d.meanNet > 0 && r.d.tNet >= 2).length}; in confirmation: ${rows.filter((r) => r.c.meanNet > 0 && r.c.tNet >= 2).length}.`,
    `- Holm-adjusted p < 0.05: ${rows.filter((r) => r.holm < 0.05).length}.`, `- **All: ${rows.filter((r) => r.pass).length}.**`, '');
  L.push('## Every cell', '', 'R a trade; "before" = before costs, "after" = after costs; t = t of calendar-month sums (empty months as 0).', '',
    '| cell | 2005-14 n | win | before | t | after | t | 2015-26 n | win | before | t | after | t | cost R | Holm p | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cells) L.push(`| ${c.cell} | ${N(c.disc.n)} | ${c.disc.win == null ? 'n/a' : (c.disc.win * 100).toFixed(0) + '%'} | ${f3(c.disc.mean)} | ${f2(c.disc.t)} | ${f3(c.disc.meanNet)} | ${f2(c.disc.tNet)} | ${N(c.conf.n)} | ${c.conf.win == null ? 'n/a' : (c.conf.win * 100).toFixed(0) + '%'} | ${f3(c.conf.mean)} | ${f2(c.conf.t)} | ${f3(c.conf.meanNet)} | ${f2(c.conf.tNet)} | ${f2(c.conf.costR)} | ${c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('', '## Beside: the same limit rule with no London condition', '',
    'Every weekday, both directions, same zone sets and targets. Not part of the bar. Welch t = reversal-day trades against these,',
    'after costs, per trade (it counts trades as independent, so it can overstate; the reversal-day trades are a subset of these).', '',
    '| cell | control 2005-14 n | after | control 2015-26 n | after | Welch t 2005-14 | Welch t 2015-26 |', '|---|---|---|---|---|---|---|');
  for (const c of cells) L.push(`| ${c.cell} | ${N(c.control.disc.n)} | ${f3(c.control.disc.meanNet)} | ${N(c.control.conf.n)} | ${f3(c.control.conf.meanNet)} | ${c.welchVsControl.disc ?? 'n/a'} | ${c.welchVsControl.conf ?? 'n/a'} |`);
  L.push('', `## By market, the best cell (${bc.cell}; context only)`, '', '| market | 2005-14 n | before | after | t after | 2015-26 n | before | after | t after |', '|---|---|---|---|---|---|---|---|---|');
  for (const m of byMarket) L.push(`| ${m.market} | ${N(m.disc.n)} | ${f3(m.disc.mean)} | ${f3(m.disc.meanNet)} | ${f2(m.disc.tNet)} | ${N(m.conf.n)} | ${f3(m.conf.mean)} | ${f3(m.conf.meanNet)} | ${f2(m.conf.tNet)} |`);
  L.push('', '## Counts', '', '| market | candles from | days read | excluded | reversal days (mid) | of them other | with a zone of the day | fills lon | fills any | risk under cost | odd |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of counts) L.push(`| ${c.market} | ${c.first} | ${N(c.days)} | ${N(c.excluded)} | ${N(c.mid)} | ${N(c.other)} | ${N(c.withZone)} | ${N(c.fills[0])} | ${N(c.fills[1])} | ${N(c.small)} | ${N(c.odd)} |`);
  L.push('', `In all ${N(tot('days'))} market-days, ${N(tot('mid'))} reversal days by the middle (${N(tot('other'))} by the other side). "risk under cost" and "odd"`,
    '(an order the engine did not fill on its candle) count orders of the rule and of the control together.', '');
  L.push('## Checks', '', `- Cut check (classification, zones and orders known by a date, on candles cut there, against the full run): ${cut.length} cuts, ${cut.reduce((a, x) => a + x.missing + x.extra, 0)} differences (${cut.map((x) => x.market + ' ' + x.cut + ' n ' + x.n).join('; ')}).`,
    '- Every trade has its stop on the losing side of its fill (the run throws otherwise).', '');
  L.push('## Reading', '',
    verdict === 'PASS' ? 'A cell cleared the pre-registered bar. That is one study on mid candles: a hypothesis for a holdout, not an edge.'
      : verdict === 'FAIL' ? 'No cell clears the bar after costs. Waiting for London to finish as a reversal day and buying or selling the New York pullback into an hourly engulf zone is not shown to make money here; nothing is proposed and no variant is to be run on these years.'
        : 'No cell reaches 300 trades in both windows, so nothing can be judged.',
    '', '## What a reviewer should doubt', '',
    '- Mid candles, not bid / ask: a limit at a zone edge is assumed filled at the touch; a real fill needs the price to trade through by the spread.',
    '- The same round-trip cost is charged in every year (today\'s demo figures), which flatters 2005-14.',
    '- `other` days are a subset of `mid` days and the 1R / 2R cells share entries, so the 8 cells are far from independent.',
    '- A target is fixed with the order (entry edge + k x the planned risk); a fill at an open beyond the edge keeps that target.',
    '- Gold\'s history starts later than 2005 (see Counts).', '');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n'));
  console.log(verdict, headline);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, outDir] = process.argv.slice(2);
  if (cmd === 'all') { fs.mkdirSync(outDir, { recursive: true }); const cut = [];
    for (const m of MARKETS) { let M5 = K.load(m, '5m', { from: '2004-12-01', to: '2026-11-01' });
      const r = runMarket(m, M5); fs.writeFileSync(path.join(outDir, m + '.json'), JSON.stringify(r));
      cut.push(...cutTest(m, M5, m === 'xau' || m === 'eurusd' ? undefined : ['2016-09-21'])); console.log(m, JSON.stringify(r.counts)); M5 = null; }
    fs.writeFileSync(path.join(outDir, 'cut.json'), JSON.stringify(cut)); }
  else if (cmd === 'report') report(outDir);
  else { console.error('usage: run.mjs all|report <outDir>'); process.exit(1); }
}
