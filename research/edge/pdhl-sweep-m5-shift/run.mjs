// research/edge/pdhl-sweep-m5-shift/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): a sweep of the previous day's
// high or low (an M15 wick beyond it, an M15 close back inside within an hour), then a 5-minute close beyond the last
// 5-minute swing made before the sweep's extreme; market at that close, stop past the extreme, targets the day's opening
// price and 2R. Five markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged AFTER costs on month sums.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/pdhl-sweep-m5-shift/run.mjs run     (writes result.json and RESULT.md here)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const FROM = Date.UTC(2005, 0, 1) / 1000, SPLIT = Date.UTC(2015, 0, 1) / 1000, TO = Date.UTC(2026, 10, 1) / 1000;
export const NM = 262, DM = 120; // months 2005-01 .. 2026-10; the first 120 are discovery
export const EXITS = ['open', '2R'], SESS = ['all', 'london', 'ny'], NCELL = 6;
export const cellOf = (x, se) => x * 3 + se;
export const cellName = (c) => `${EXITS[Math.floor(c / 3)]} ${SESS[c % 3]}`;
export const P = { backM15: 3, waitM5: 24, swingK: 3, swingBack: 48, atrK: 0.1, cap: 86400, minDay: 200, maxGap: 4 * 86400, openMinR: 1 };
const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
const sessOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h >= 7 && h < 12 ? 1 : h >= 12 && h < 17 ? 2 : 0; };
export const lower = (bars, t) => { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].t < t) lo = m + 1; else hi = m; } return lo; };

export function atr14(T) { // simple mean of the true range of the 14 candles up to and including i
  const tr = T.map((b, i) => (i ? Math.max(b.h - b.l, Math.abs(b.h - T[i - 1].c), Math.abs(b.l - T[i - 1].c)) : b.h - b.l));
  const out = new Array(T.length).fill(NaN); let s = 0;
  for (let i = 0; i < T.length; i++) { s += tr[i]; if (i >= 14) s -= tr[i - 14]; if (i >= 13) out[i] = s / 14; }
  return out;
}

// ---- signals (closed candles only) -----------------------------------------------------------------------------------
// Each: { e (+1 a swept high, -1 a swept low), s (trade side = -e), day (trading-day start), open (the day's opening price),
//         pd (the swept level), X (sweep extreme), a (ATR14 of M15 at m), tm (close of M15 candle m = when the sweep is known),
//         conf (true when the M5 break came), te (entry moment, conf only), L (the broken M5 swing level), cancelled }.
export function signals(M5) {
  const T = K.resample(M5, 900), D = K.dailyNY(M5), atr = atr14(T), out = [];
  const sw = K.swings(M5, P.swingK), lows = sw.filter((x) => x.type === 'L'), highs = sw.filter((x) => x.type === 'H');
  const idxBefore = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].i < x) lo = m + 1; else hi = m; } return lo - 1; };
  let a = 0;
  for (let di = 1; di < D.length; di++) {
    const d = D[di], pv = D[di - 1];
    while (a < T.length && T[a].t < d.t) a++;
    let b = a; while (b < T.length && T[b].e <= d.e) b++; // M15 candles a..b-1 lie inside day d
    if (!(pv.n >= P.minDay) || d.t - pv.e > P.maxGap) continue;
    const PDH = pv.h, PDL = pv.l;
    for (const e of [1, -1]) {
      const lvl = e > 0 ? PDH : PDL;
      for (let j = a; j < b; j++) {
        const beyond = e > 0 ? T[j].h > lvl : T[j].l < lvl; if (!beyond) continue;
        if (j > a && (e > 0 ? T[j - 1].c > lvl : T[j - 1].c < lvl)) continue;
        let m = -1; for (let q = j; q <= j + P.backM15 && q < b; q++) if (T[q].c < PDH && T[q].c > PDL) { m = q; break; }
        if (m < 0) continue;
        let X = e > 0 ? -Infinity : Infinity; for (let q = j; q <= m; q++) X = e > 0 ? Math.max(X, T[q].h) : Math.min(X, T[q].l);
        const tm = T[m].e, g = { e, s: -e, day: d.t, open: d.o, pd: lvl, X, a: atr[m], tm, conf: false, te: null, L: null, cancelled: false };
        // the M5 candle that made X, then the break back
        const i0 = lower(M5, T[j].t); let i1 = i0, x = -1; while (i1 < M5.length && M5[i1].t < tm) { if (x < 0 && (e > 0 ? M5[i1].h : M5[i1].l) === X) x = i1; i1++; }
        const lastIn = i1 - 1; // last M5 candle inside candle m
        if (x >= 0) {
          const arr = e > 0 ? lows : highs, p0 = idxBefore(arr, x);
          for (let k = x + 1; k <= lastIn + P.waitM5 && k < M5.length; k++) {
            const c = M5[k];
            if (c.t >= tm && (e > 0 ? c.h > X : c.l < X)) { g.cancelled = true; break; }
            let L = null;
            for (let p = p0; p >= 0 && arr[p].i >= x - P.swingBack; p--) { const s0 = arr[p];
              if (!(s0.ci < k)) continue;
              let ok = true; for (let q = s0.i + 1; q < k; q++) if (e > 0 ? M5[q].c < s0.price : M5[q].c > s0.price) { ok = false; break; }
              if (ok) { L = s0.price; break; } }
            if (L != null && (e > 0 ? c.c < L : c.c > L)) { g.conf = true; g.L = L; g.te = Math.max(c.e, tm); break; }
          }
        }
        out.push(g); break; // one signal per edge per day
      }
    }
  }
  return out;
}

// ---- one trade, several targets in one pass (NaN = none). Stop first in a candle that holds both. -------------------------
export function exits(M5, s, fi, stop, tg, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const R = tg.map(() => NaN), dl = M5[fi].t + cap; let left = tg.filter((x) => Number.isFinite(x)).length; if (!left) return { fill, risk, R };
  const fin = (k, px) => { if (Number.isFinite(tg[k]) && Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) tg.forEach((_, k) => fin(k, b.o)); else tg.forEach((x, k) => { if (s * (b.o - x) >= 0) fin(k, b.o); }); }
    const adv = s > 0 ? b.l : b.h, fav = s > 0 ? b.h : b.l;
    if (s * (adv - stop) <= 0) tg.forEach((_, k) => fin(k, stop));
    tg.forEach((x, k) => { if (s * (fav - x) >= 0) fin(k, x); });
    if (b.e >= dl) tg.forEach((_, k) => fin(k, b.c)); }
  return left ? null : { fill, risk, R };
}

// the trade of one signal entered at moment t: null (no trade) or { t (fill time), fill, stop, risk, R: [open, 2R] }
export function trade(M5, g, t, cost) {
  const fi = lower(M5, t); if (fi >= M5.length || !(g.a > 0)) return null;
  const s = g.s, fill = M5[fi].o, stop = g.X + g.e * P.atrK * g.a, risk = s * (fill - stop);
  if (!(risk > 0) || risk < cost) return null;
  const openOk = s * (g.open - fill) >= P.openMinR * risk;
  const r = exits(M5, s, fi, stop, [openOk ? g.open : NaN, fill + s * 2 * risk], P.cap); if (!r) return null;
  return { t: M5[fi].t, fill, stop, risk, R: r.R, s };
}

const toS = (x) => (typeof x === 'number' ? (x > 1e12 ? x / 1000 : x) : Math.floor(Date.parse(x) / 1000));
export function exclusions(market) { // research/edge/data-quality/quality.json, read as combo-grid-2 reads it
  const f = path.join(HERE, '..', 'data-quality', 'quality.json'); if (!fs.existsSync(f)) return [];
  const q = JSON.parse(fs.readFileSync(f, 'utf8')); const m = (q.markets || q)[market] || {};
  const list = m.exclude || m.exclusions || m.bad || m.badIntervals || [];
  return list.map((x) => (Array.isArray(x) ? [toS(x[0]), toS(x[1])] : [toS(x.from), toS(x.to)])).filter((x) => x[0] <= x[1]).sort((p, q2) => p[0] - q2[0]);
}
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }
function book(A, tr, cost) {
  if (tr.t < FROM || tr.t >= TO) return; const w = tr.t < SPLIT ? 0 : 1, m = monthOf(tr.t), se = sessOf(tr.t), cr = cost / tr.risk;
  for (let x = 0; x < 2; x++) { if (!Number.isFinite(tr.R[x])) continue; add(A, cellOf(x, 0), w, m, tr.R[x], cr); if (se) add(A, cellOf(x, se), w, m, tr.R[x], cr); }
}
function merge(A, B) { for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += B[k][i]; }

export function runMarket(M5, market) {
  const cost = K.COSTS[market], X = exclusions(market), sigs = signals(M5), main = newAcc(), ctrl = newAcc();
  const cnt = { sweeps: sigs.length, confirmed: 0, cancelled: 0, unconfirmed: 0, dropped: 0, noTrade: 0, traded: 0 };
  for (const g of sigs) {
    const c0 = trade(M5, g, g.tm, cost); if (c0 && !(X.length && inBad(X, c0.t))) book(ctrl, c0, cost);
    if (!g.conf) { if (g.cancelled) cnt.cancelled++; else cnt.unconfirmed++; continue; }
    cnt.confirmed++;
    const tr = trade(M5, g, g.te, cost); if (!tr) { cnt.noTrade++; continue; }
    if (!(tr.s * (tr.fill - tr.stop) > 0)) throw new Error('stop on the wrong side');
    if (X.length && inBad(X, tr.t)) { cnt.dropped++; continue; }
    if (tr.t >= FROM && tr.t < TO) cnt.traded++;
    book(main, tr, cost);
  }
  return { market, cost, first: M5[0].t, last: M5[M5.length - 1].t, cnt, main, ctrl };
}

// the signals known by a date, computed on candles cut there, equal the full run's
export function cutTest(M5, cuts) {
  const key = (g) => [g.e, g.day, g.X, g.tm, g.conf, g.te, g.L, Number.isFinite(g.a) ? g.a.toFixed(10) : 'n'].join('|');
  const known = (g) => (g.conf ? g.te : null), full = signals(M5), out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const A = signals(M5.filter((b) => b.e <= T)).filter((g) => g.conf && known(g) <= T).map(key);
    const B = full.filter((g) => g.conf && known(g) <= T).map(key);
    out.push({ cut: c, n: B.length, same: A.length === B.length && A.every((v, i) => v === B[i]) }); }
  return out;
}

// ---- statistics ---------------------------------------------------------------------------------------------------------
export function mstat(xs) { const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { months: n, mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null }; }
export const p1 = (t, df) => (t == null ? 1 : t > 0 ? K.pFromT(t, df) / 2 : 1 - K.pFromT(t, df) / 2);
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
function rows(A) {
  const out = [];
  for (let c = 0; c < NCELL; c++) { const row = { cell: cellName(c) };
    for (const [w, name, m0, m1] of [[0, 'discovery', 0, DM], [1, 'confirmation', DM, NM]]) {
      const n = A.n[c * 2 + w], g = mstat(Array.from(A.ms.slice(c * NM + m0, c * NM + m1))), nt = mstat(Array.from(A.msNet.slice(c * NM + m0, c * NM + m1)));
      row[name] = { n, win: n ? r3(A.win[c * 2 + w] / n) : null, grossR: n ? r3(A.sum[c * 2 + w] / n) : null, tGross: r3(g.t), netR: n ? r3(A.net[c * 2 + w] / n) : null, tNet: r3(nt.t),
        costR: n ? r3(A.cr[c * 2 + w] / n) : null, pNet: p1(nt.t, nt.months - 1) }; }
    out.push(row); }
  const hp = K.holm(out.map((r) => r.confirmation.pNet));
  out.forEach((r, i) => { r.holm = +hp[i].toFixed(4); r.confirmation.pNet = +r.confirmation.pNet.toFixed(4); r.discovery.pNet = +r.discovery.pNet.toFixed(4);
    const d = r.discovery, c = r.confirmation;
    r.enough = d.n >= 300 && c.n >= 300;
    r.pass = r.enough && d.netR > 0 && d.tNet >= 2 && c.netR > 0 && c.tNet >= 2 && r.holm < 0.05; });
  return out;
}

const f3 = (x) => (x == null ? 'n/a' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3)), ft = (x) => (x == null ? 'n/a' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
const nf = (n) => n.toLocaleString('en-US');
function table(rs) {
  const L = ['| cell | 2005-14 n | before | after | month t (after) | 2015-26 n | before | after | month t (after) | cost / risk | Holm p |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rs) { const d = r.discovery, c = r.confirmation;
    L.push(`| ${r.cell} | ${nf(d.n)} | ${f3(d.grossR)}R | ${f3(d.netR)}R | ${ft(d.tNet)} | ${nf(c.n)} | ${f3(c.grossR)}R | ${f3(c.netR)}R | ${ft(c.tNet)} | ${c.costR == null ? 'n/a' : c.costR.toFixed(3)}R | ${r.holm.toFixed(3)} |`); }
  return L.join('\n');
}
export function headline(R) { const b = R.best, c = b.confirmation, d = b.discovery;
  const tail = `the best cell, ${b.cell}, made ${f3(c.netR)}R a trade after costs in 2015-26 (n ${nf(c.n)}, month t ${ft(c.tNet)}; ${f3(c.grossR)}R before costs; 2005-14 ${f3(d.netR)}R after costs, n ${nf(d.n)}, month t ${ft(d.tNet)})`;
  return R.verdict === 'PASS' ? `**Verdict: PASS. ${R.passed} of 6 cells pass; ${tail}.**` : R.verdict === 'INCONCLUSIVE' ? `**Verdict: INCONCLUSIVE. No cell has 300 trades in both windows; ${tail}.**`
    : `**Verdict: FAIL. 0 of 6 cells pass; ${tail}.**`; }

function main() {
  const tot = newAcc(), ctl = newAcc(), per = [], counts = {}; let cuts = null;
  for (const mk of MARKETS) {
    let M5 = K.load(mk, '5m', { from: '2004-06-01', to: '2026-11-01' });
    const r = runMarket(M5, mk);
    if (mk === 'eurusd') cuts = cutTest(M5, ['2008-06-11', '2016-09-21', '2025-05-07']);
    M5 = null;
    merge(tot, r.main); merge(ctl, r.ctrl); counts[mk] = { ...r.cnt, first: new Date(r.first * 1000).toISOString().slice(0, 10), cost: r.cost };
    const rs = rows(r.main); per.push({ market: mk, rows: [rs[cellOf(0, 0)], rs[cellOf(1, 0)]].map((x) => ({ cell: x.cell, discovery: x.discovery, confirmation: x.confirmation })) });
    console.error(mk, JSON.stringify(r.cnt));
    if (global.gc) global.gc();
  }
  const cells = rows(tot), control = rows(ctl).map(({ pass, enough, ...x }) => x);
  const passed = cells.filter((x) => x.pass).length, anyEnough = cells.some((x) => x.enough);
  const ranked = [...cells].sort((p, q) => (q.confirmation.netR ?? -9) - (p.confirmation.netR ?? -9));
  const R = { study: 'pdhl-sweep-m5-shift', built: '2026-11-24', verdict: passed ? 'PASS' : anyEnough ? 'FAIL' : 'INCONCLUSIVE', passed, markets: MARKETS,
    windows: { discovery: '2005-01-01..2014-12-31', confirmation: '2015-01-01..2026-10-31', months: [DM, NM - DM] }, params: P, basis: 'after costs, calendar-month sums of R',
    best: ranked[0], cells, control, perMarket: per, counts, cutTest: cuts };
  R.headline = headline(R);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  const sum = (k) => MARKETS.reduce((a, m) => a + counts[m][k], 0);
  const md = [`# Previous-day sweep, then an M5 structure-shift break back: five markets (result)`, '', R.headline, '',
    `Run 24 Nov 2026 as pre-registered (\`PREREGISTRATION.md\`, committed alone first). Research only: nothing live changed, no rule is`,
    `proposed. OANDA mid 5-minute candles, ${MARKETS.join(', ')}; R after the demo round-trip cost (\`edgekit\` \`COSTS\`); t on calendar-month`,
    `sums (120 and 142 months, empty months as 0), pooled over the markets.`, '',
    `## The rule in one paragraph`, '',
    `An M15 candle trades beyond the previous trading day's high (low) and, within an hour, an M15 candle closes back inside the`,
    `previous day's range. Then a 5-minute candle closes beyond the last 5-minute swing (3 candles a side) made before the sweep's`,
    `extreme, within two hours and before the extreme is taken out. Sell (buy) at the next 5-minute open, stop 0.1 x ATR(14) of M15`,
    `past the extreme, target the day's opening price (when 1R or more away) or 2R, out after 24 hours.`, '',
    `## The six cells (the bar is judged after costs)`, '', table(cells), '',
    `Bar: n >= 300 in each window, R after costs > 0 with month t >= 2 in both windows, Holm p < 0.05 over the six confirmation tests.`,
    `**${passed} of 6 pass.**`, '',
    `## Control: the same sweeps entered at the M15 close back inside, no M5 confirmation`, '', table(control), '',
    `## By market (all sessions)`, '',
    '| market | cell | 2005-14 n | before | after | 2015-26 n | before | after | month t (after) |', '|---|---|---|---|---|---|---|---|---|',
    ...per.flatMap((p) => p.rows.map((x) => `| ${p.market} | ${x.cell} | ${nf(x.discovery.n)} | ${f3(x.discovery.grossR)}R | ${f3(x.discovery.netR)}R | ${nf(x.confirmation.n)} | ${f3(x.confirmation.grossR)}R | ${f3(x.confirmation.netR)}R | ${ft(x.confirmation.tNet)} |`)), '',
    `## Counts`, '',
    `Sweeps found ${nf(sum('sweeps'))}; M5 break confirmed ${nf(sum('confirmed'))}; cancelled (extreme taken out first) ${nf(sum('cancelled'))}; no break in two hours`,
    `${nf(sum('unconfirmed'))}; confirmed but no trade (risk under the cost, fill past the stop, still open at the end) ${nf(sum('noTrade'))}; dropped for bad data ${nf(sum('dropped'))}.`,
    `Gold's candles start ${counts.xau.first}. Cut test (EUR/USD, the confirmed signals known by a date computed on candles cut there equal the full`,
    `run's): ${cuts.map((c) => `${c.cut} ${c.same ? 'same' : 'DIFFERENT'} (${nf(c.n)})`).join(', ')}.`, '',
    `## What it means`, '',
    R.verdict === 'PASS'
      ? `A tilt on mid candles at constant demo costs in both windows; not an edge, no live change, a forward record would be the next step and is the owner's call.`
      : `Waiting for the 5-minute chart to turn after a failed break of the previous day's extreme does not make a rule that survives costs on these five markets in both decades. Not an edge; this combination is closed on these markets and years. One run, no variants.`, '',
    `## Limits`, '',
    `- OANDA mid candles; a constant round-trip cost for every year and hour (today's demo figures), no slippage.`,
    `- Trades overlap (at most two a market a day) and the "all" cell contains the two session cells, so the six tests are not independent.`,
    `- The "open" cells need the day's open 1R or more away, so they are a subset of the sweeps with a large reward to risk.`, ''].join('\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md);
  console.log(R.headline);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'run') main();
