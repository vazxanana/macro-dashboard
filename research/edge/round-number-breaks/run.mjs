// research/edge/round-number-breaks/run.mjs - round numbers as levels, PREREGISTRATION.md (23 Nov 2026): a 15-minute close
// beyond a round number traded WITH it or FADED, and a failed cross (a wick through, closed back) traded back; 48 cells, ten
// markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums against a control.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/round-number-breaks/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/round-number-breaks/run.mjs cut <m> <outDir>
//   node research/edge/round-number-breaks/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { exits, breaks, sessionOf } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
// small step, big step (a multiple of it) per market
export const STEPS = { eurusd: [0.005, 0.01], gbpusd: [0.005, 0.01], audusd: [0.005, 0.01], nzdusd: [0.005, 0.01], usdcad: [0.005, 0.01],
  usdchf: [0.005, 0.01], usdjpy: [0.5, 1], eurjpy: [0.5, 1], xau: [10, 50], xag: [0.5, 1] };
export const SHIFTS = [0.23, 0.41, 0.59, 0.77];
export const EVENTS = ['with', 'fade', 'failed'], GROUPS = ['all', 'big', 'small', 'first', 'later', 'london', 'ny', 'other'], EXITS = ['1R', '2R'];
export const NCELL = 48, PROBE = 0.2, ATRK = 0.1, CAP = 86400, MATCH = 86400;
export const cellIndex = (ev, g, x) => (ev * 8 + g) * 2 + x;
export function cellName(i) { const x = i % 2, r = (i - x) / 2, g = r % 8, ev = (r - g) / 8;
  return { ev: EVENTS[ev], group: GROUPS[g], exit: EXITS[x], name: `${EVENTS[ev]} ${GROUPS[g]} ${EXITS[x]}` }; }

// ---- events on M15 (closed candles only) -----------------------------------------------------------------------------------
// grid: { off (price), S, ratio (big step / small step) }. Level k = off + k S, big when k % ratio === 0.
// Returns [{ type 'cross' | 'failed', j (probe / cross candle), k (event candle), ts (its close), d (+1 up / -1 down), L, big,
//            first, ext (extreme of candles j..k), a (ATR at j) }]
export function events(T, atr, grid) {
  const { off, S, ratio } = grid; const out = []; const lastDay = new Map();
  const lev = (k) => off + k * S; const isBig = (k) => ((k % ratio) + ratio) % ratio === 0;
  const dayOf = (t) => Math.floor(t / 86400);
  for (let j = 1; j < T.length; j++) {
    const a = atr[j], c0 = T[j - 1].c, c1 = T[j].c, b = T[j], day = dayOf(b.t);
    if (a > 0) {
      // (c) failed cross: an up probe of the nearest level above the previous close, closed back by j or j+1
      const ku = Math.floor((c0 - off) / S) + 1, Lu = lev(ku);
      if (Lu > c0 && b.h >= Lu + PROBE * a && T[j - 1].h < Lu + PROBE * a) {
        const k = c1 < Lu ? j : j + 1 < T.length && T[j + 1].c < Lu ? j + 1 : -1;
        if (k >= 0) { let ext = -Infinity; for (let q = j; q <= k; q++) ext = Math.max(ext, T[q].h);
          out.push({ type: 'failed', j, k, ts: T[k].e, d: 1, L: Lu, big: isBig(ku), first: lastDay.get(ku) !== day, ext, a }); }
      }
      const kd = Math.ceil((c0 - off) / S) - 1, Ld = lev(kd);
      if (Ld < c0 && b.l <= Ld - PROBE * a && T[j - 1].l > Ld - PROBE * a) {
        const k = c1 > Ld ? j : j + 1 < T.length && T[j + 1].c > Ld ? j + 1 : -1;
        if (k >= 0) { let ext = Infinity; for (let q = j; q <= k; q++) ext = Math.min(ext, T[q].l);
          out.push({ type: 'failed', j, k, ts: T[k].e, d: -1, L: Ld, big: isBig(kd), first: lastDay.get(kd) !== day, ext, a }); }
      }
    }
    // (a) / (b) close beyond: every level strictly between the two closes; the farthest is the event
    if (c1 !== c0) {
      const up = c1 > c0; const lo = Math.min(c0, c1), hi = Math.max(c0, c1);
      const k0 = Math.floor((lo - off) / S) + 1, k1 = Math.ceil((hi - off) / S) - 1;
      const ks = []; for (let k = k0; k <= k1; k++) { const L = lev(k); if (L > lo && L < hi) ks.push(k); }
      if (ks.length) {
        const kf = up ? ks[ks.length - 1] : ks[0];
        if (a > 0) out.push({ type: 'cross', j, k: j, ts: b.e, d: up ? 1 : -1, L: lev(kf), big: isBig(kf), first: lastDay.get(kf) !== day, ext: up ? b.h : b.l, a });
        for (const k of ks) lastDay.set(k, day);
      }
    }
  }
  return out;
}

// ---- accumulators ----------------------------------------------------------------------------------------------------
const ST = ['n', 'sum', 'sq', 'net', 'cr'];
function newAcc() { const A = { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM) };
  for (const k of ST) A[k] = new Float64Array(NCELL * 2);
  for (const p of ['cm', 'cs']) for (const k of ['n', 'sum', 'sq']) A[p + k] = new Float64Array(NCELL * 2); // cm = control of the bar, cs = shifted grids
  A.cms = new Float64Array(NCELL * NM); return A; }
function addReal(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; const i = c * 2 + w;
  A.n[i]++; A.sum[i] += R; A.sq[i] += R * R; A.net[i] += R - cr; A.cr[i] += cr; }
function addCtl(A, p, c, w, R, m) { const i = c * 2 + w; A[p + 'n'][i]++; A[p + 'sum'][i] += R; A[p + 'sq'][i] += R * R; if (p === 'cm' && m != null) A.cms[c * NM + m] += R; }

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// one trade from an event: { s, stop } (null when it is no trade); targets 1R, 2R
function tradeOf(ev, kind, fill) {
  if (kind === 0) { const s = ev.d; return { s, stop: fill - s * ev.a }; }
  const s = -ev.d; return { s, stop: ev.ext + ev.d * ATRK * ev.a };
}
export function simEvent(M5, ev, kind, cost, X) {
  const fi = startIdx(M5, ev.ts); if (fi >= M5.length) return null; const t = M5[fi].t; if (t < FROM || t >= TO) return null;
  if (X.length && inBad(X, t)) return { dropped: true };
  const fill = M5[fi].o, { s, stop } = tradeOf(ev, kind, fill), risk = s * (fill - stop);
  if (!(risk > 0)) return { bad: true }; if (risk < cost) return { small: true };
  if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
  const r = exits(M5, s, fi, stop, [fill + s * risk, fill + 2 * s * risk], CAP); if (!r) return { open: true };
  return { t, R: r.R, cr: cost / risk };
}
const groupsOf = (ev, t) => [0, ev.big ? 1 : 2, ev.first ? 3 : 4, 5 + sessionOf(t)];

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5); const T = F['15m'], atr = atr14(T);
  const cost = COSTS[market], X = exclusions(market), [S, B] = STEPS[market], ratio = Math.round(B / S);
  const A = newAcc(); const cnt = { events: 0, trades: 0, dropped: 0, bad: 0, small: 0, open: 0, ctl: 0, matched: 0, unmatched: 0 };
  // the plain grid7-wide-fade M15 rule: fade the first structure break, ext stop
  const ctl = [];
  for (const e of breaks(T)) { const a = atr[e.i]; if (!(a > 0)) continue; const b = T[e.i];
    const r = simEvent(M5, { ts: b.e, d: e.dir, ext: e.dir > 0 ? b.h : b.l, a }, 1, cost, X); if (r && r.R) ctl.push(r); }
  ctl.sort((p, q) => p.t - q.t); cnt.ctl = ctl.length;
  const nearest = (t) => { let lo = 0, hi = ctl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ctl[m].t < t) lo = m + 1; else hi = m; }
    let best = null; for (const q of [lo - 1, lo]) if (q >= 0 && q < ctl.length && Math.abs(ctl[q].t - t) <= MATCH && (!best || Math.abs(ctl[q].t - t) < Math.abs(best.t - t))) best = ctl[q]; return best; };
  const kinds = (ev) => (ev.type === 'cross' ? [0, 1] : [2]);
  // real round levels
  for (const ev of events(T, atr, { off: 0, S, ratio })) { cnt.events++;
    for (const kind of kinds(ev)) { const r = simEvent(M5, ev, kind, cost, X); if (!r) continue;
      if (!r.R) { for (const k of ['dropped', 'bad', 'small', 'open']) if (r[k]) cnt[k]++; continue; }
      cnt.trades++; const w = r.t < SPLIT ? 0 : 1, m = monthOf(r.t), ctr = kind > 0 ? nearest(r.t) : null;
      if (kind > 0) cnt[ctr ? 'matched' : 'unmatched']++;
      for (const g of groupsOf(ev, r.t)) for (let x = 0; x < 2; x++) { const c = cellIndex(kind, g, x); addReal(A, c, w, m, r.R[x], r.cr);
        if (ctr) addCtl(A, 'cm', c, w, ctr.R[x], m); } }
  }
  // the shifted (not round) grids: the bar's control for WITH, reported for the others
  for (const sh of SHIFTS) for (const ev of events(T, atr, { off: sh * S, S, ratio })) for (const kind of kinds(ev)) {
    const r = simEvent(M5, ev, kind, cost, X); if (!r || !r.R) continue; const w = r.t < SPLIT ? 0 : 1, m = monthOf(r.t);
    for (const g of groupsOf(ev, r.t)) for (let x = 0; x < 2; x++) { const c = cellIndex(kind, g, x); addCtl(A, 'cs', c, w, r.R[x]); if (kind === 0) A.cms[c * NM + m] += r.R[x]; } }
  const J = (O) => Object.fromEntries(Object.entries(O).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, steps: STEPS[market], assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, ...cnt, acc: J(A) };
}

// ---- cut test --------------------------------------------------------------------------------------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const [S, B] = STEPS[market], grid = { off: 0, S, ratio: Math.round(B / S) };
  const run = (M) => { const T = frames(M)['15m']; return events(T, atr14(T), grid); };
  const key = (e) => [e.type, e.ts, e.d, e.L, e.big, e.first, e.ext, e.a.toFixed(10)].join('|');
  const full = run(M5); const out = [];
  for (const c of cuts) { const T0 = Date.parse(c + 'T00:00:00Z') / 1000;
    const A = new Set(run(M5.filter((b) => b.e <= T0)).filter((e) => e.ts <= T0).map(key)), Bs = new Set(full.filter((e) => e.ts <= T0).map(key));
    out.push({ market, cut: c, n: Bs.size, missing: [...Bs].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !Bs.has(k)).length }); }
  return out;
}

// ---- pooled statistics -----------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM), cms = A.cms.subarray(c * NM, (c + 1) * NM);
  const ev = Math.floor(c / 16);
  const win = (w) => { const i = c * 2 + w, n = A.n[i], a = w ? DM : 0, b = w ? NM : DM;
    const real = { n, sum: A.sum[i], sq: A.sq[i] }, cm = { n: A.cmn[i], sum: A.cmsum[i], sq: A.cmsq[i] }, cs = { n: A.csn[i], sum: A.cssum[i], sq: A.cssq[i] };
    const ctl = ev === 0 ? cs : cm;
    return { n, mean: n ? A.sum[i] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[i] / n : null, tNet: mstat(msn, a, b).t, costR: n ? A.cr[i] / n : null, months: b - a,
      ctl: { n: ctl.n, mean: ctl.n ? ctl.sum / ctl.n : null, t: mstat(cms, a, b).t, welch: welch(real, ctl) },
      shifted: { n: cs.n, mean: cs.n ? cs.sum / cs.n : null, welch: welch(real, cs) } }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (r, h) => r.d.n >= 300 && r.c.n >= 300 && r.d.mean > 0 && r.c.mean > 0 && r.d.t >= 2 && r.c.t >= 2 && h < 0.05
  && r.d.ctl.welch != null && r.c.ctl.welch != null && r.d.ctl.welch >= 2 && r.c.ctl.welch >= 2;
export function judge(data) {
  const A = pool(data); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(A, c); rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1) }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: r.d.ctl.welch != null && r.c.ctl.welch != null && r.d.ctl.welch >= 2 && r.c.ctl.welch >= 2 };
    r.pass = passOf(r, H[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const r6 = (x) => (x == null ? null : +x.toFixed(6));
const slim = (w) => ({ n: w.n, mean: r6(w.mean), t: r6(w.t), meanNet: r6(w.meanNet), tNet: +w.tNet.toFixed(2), costR: w.costR == null ? null : +w.costR.toFixed(4),
  ctl: { n: w.ctl.n, mean: r6(w.ctl.mean), t: +w.ctl.t.toFixed(2), welch: w.ctl.welch == null ? null : r6(w.ctl.welch) },
  shifted: { n: w.shifted.n, mean: r6(w.shifted.mean), welch: w.shifted.welch == null ? null : +w.shifted.welch.toFixed(2) } });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestPass = [...pass].sort((a, b) => b.c.t - a.c.t)[0], b = bestPass || best;
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d]), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const allN = rows.filter((r) => r.group === 'all' && r.exit === '1R').reduce((a, r) => a + r.d.n + r.c.n, 0);
  const headline = verdict === 'PASS'
    ? `${pass.length} of 48 cells pass before costs and beat their control; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; control ${f3(b.c.ctl.mean)}R, Welch t ${f2(b.c.ctl.welch)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 48 cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}) against its control ${f3(b.c.ctl.mean)}R (Welch t ${f2(b.c.ctl.welch)})`;
  const RW = rows.map((r) => ({ cell: r.name, event: r.ev, group: r.group, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass }));
  const out = { study: 'round-number-breaks', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums, Holm over 48, and beating the control by Welch t >= 2 in both windows (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' },
    markets: data.map((d) => d.market), steps: STEPS, shifts: SHIFTS, assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      events: d.events, trades: d.trades, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, control: d.ctl, matched: d.matched, unmatched: d.unmatched })),
    tradesAll1R: allN, passed: pass.map((r) => r.name), bestConfirmation: best.name,
    passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name), cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Round-number breaks: with, fade and failed crosses of round numbers on ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Round levels: forex 0.0050 (small) / 0.0100 (big), yen pairs 0.50 / 1.00, gold $10 / $50, silver $0.50 / $1. On M15 (closed',
    'candles): (a) a close beyond a round level traded WITH it (stop 1 ATR); (b) the same close FADED (stop past the candle\'s',
    'extreme + 0.1 ATR); (c) a failed cross: a wick at least 0.2 ATR through the nearest level that closes back within 2 candles,',
    'traded back (stop past the probe\'s extreme + 0.1 ATR). Market entry at the next 5-minute open; exits 1R and 2R; 1-day limit.',
    'Groups: all, big / small level, first / later cross of that level that UTC day, London / New York / other session. Ten markets',
    'pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026; judged before costs on',
    'month sums, Holm over the 48 confirmation tests, and against a control: the plain `grid7-wide-fade` M15 fade at the nearest',
    'time (fade, failed) or the same trade on four shifted, not-round grids of the same spacing (with).',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 48.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t); after costs beside; "ctl" = the control\'s mean R and the Welch t of cell minus control;',
    '"shifted" = the same trade on the not-round grids (the control of "with", reported for the others); "cost R" = mean round-trip',
    'cost / risk in 2015-26.', '',
    '| Cell | n 05-14 | R 05-14 (t) | ctl 05-14 (Welch t) | net 05-14 | n 15-26 | R 15-26 (t) | ctl 15-26 (Welch t) | shifted 15-26 (Welch t) | net 15-26 | cost R | Holm | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.ctl.mean)} (${f2(r.d.ctl.welch)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.ctl.mean)} (${f2(r.c.ctl.welch)}) | ${f3(r.c.shifted.mean)} (${f2(r.c.shifted.welch)}) | ${f3(r.c.meanNet)} | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | ctl 15-26 (Welch t) |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${f3(x.c.ctl.mean)} (${f2(x.c.ctl.welch)}) |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} events known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (events and controls alike).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | events | trades | dropped (bad data) | past the stop | risk under cost | unresolved | control trades | matched | unmatched |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.events)} | ${N(m.trades)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} | ${N(m.control)} | ${N(m.matched)} | ${N(m.unmatched)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') {
    L.push(`${o.passed.length} cell(s) clear the pre-registered bar before costs in both decades and beat their control. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' of them stay positive after costs in both windows.' : 'None stays positive after costs in both windows: the bid / ask takes more than the tilt.'}`,
      'A before-cost tilt is not an edge; nothing is adopted and a forward record or a live change needs the owner. One run, no',
      'variants on these years.');
  } else {
    const disc = rows.filter((r) => r.checks.disc && r.checks.conf && r.checks.holm);
    L.push(`No cell clears the whole bar. ${disc.length ? disc.length + ' cell(s) are positive before costs in both decades (Holm), but none of them does better than its control in both windows: the round number adds nothing measurable over the plain fade at the same times or over a level that is not round.' : 'No cell is positive before costs in both decades with Holm.'}`,
      'Round numbers as levels, traded these three ways on M15, are not an edge on these markets and years. Do not re-test',
      'variants of these 48 cells on these years. Nothing live changed; no rule is proposed.');
  }
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'events', r.events, 'trades', r.trades, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
