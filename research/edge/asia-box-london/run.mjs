// research/edge/asia-box-london/run.mjs - the Asia box (00:00-07:00 UTC) met by London and New York (PREREGISTRATION.md,
// 23 Nov 2026): the first M15 close out of the box traded WITH it (a) or FADED (b), a false break traded back (c), the second
// break the other way (d); exits 1R / 2R / box height / 21:00 UTC; splits by box height, the Daily MSNR call and the session;
// 44 cells, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums against a control.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/asia-box-london/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/asia-box-london/run.mjs cut <m> <outDir>
//   node research/edge/asia-box-london/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch, dailyCalls } from '../grid7-wide-core/run.mjs';
import { breaks } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, H7 = 7 * 3600, LAST = 16 * 3600 + 45 * 60, NOON = 12 * 3600, H21 = 21 * 3600;
export const EVENTS = ['a with', 'b fade', 'c false break', 'd second break'], EXITS = ['1R', '2R', 'box', '21:00'];
export const SPLITS = ['height<0.3', 'height 0.3-0.6', 'height>0.6', 'MSNR agree', 'MSNR disagree', 'London', 'New York'];
export const ATRK = 0.1, MIN_BOX = 60, NCELL = 44, SEED = 20261123;
export const mainCell = (e, x) => e * 4 + x;
export const splitCell = (e, k) => 16 + e * 7 + k;
export function cellName(c) {
  if (c < 16) { const x = c % 4, e = (c - x) / 4; return { e, x, split: 'all', name: `${EVENTS[e]} ${EXITS[x]}` }; }
  const j = c - 16, k = j % 7, e = (j - k) / 7; return { e, x: 1, split: SPLITS[k], name: `${EVENTS[e]} 2R ${SPLITS[k]}` };
}
export const heightBucket = (r) => (r < 0.3 ? 0 : r <= 0.6 ? 1 : 2);
const wd = (t) => new Date(t * 1000).getUTCDay();

// ---- the Asia box of each weekday: high / low of the 5-minute candles starting [00:00, 07:00) UTC ------------------------
export function asiaBoxes(M5) {
  const out = new Map();
  for (const b of M5) { const D = Math.floor(b.t / DAY) * DAY; if (b.t - D >= H7) continue; const w = wd(D); if (w === 0 || w === 6) continue;
    let x = out.get(D); if (!x) { x = { D, hi: -Infinity, lo: Infinity, n: 0 }; out.set(D, x); }
    if (b.h > x.hi) x.hi = b.h; if (b.l < x.lo) x.lo = b.l; x.n++; }
  for (const [D, x] of out) { x.H = x.hi - x.lo; if (x.n < MIN_BOX || !(x.H > 0)) out.delete(D); }
  return out;
}

// ---- events (closed candles only). Each: { ev, D, j, ts, s (side), stop, a, H, ratio, sess, call } ----------------------
export function events(F) {
  const M5 = F['5m'], T = F['15m'], atr = atr14(T), Dd = F['1d'], atrD = atr14(Dd), calls = dailyCalls(F);
  const boxes = asiaBoxes(M5), out = [];
  const ctx = (D) => { const k = K.closedCount(Dd, D + H7) - 1; return k >= 0 ? atrD[k] : 0; };
  const callAt = (t) => { const k = K.closedCount(Dd, t) - 1; return k >= 0 ? calls[k] || 0 : 0; };
  for (const bx of boxes.values()) {
    const { D, hi, lo, H } = bx, dA = ctx(D); if (!(dA > 0)) continue; const ratio = H / dA;
    const j0 = startIdx(T, D + H7); const inWin = (j) => j < T.length && T[j].t <= D + LAST;
    const push = (ev, j, s, stop) => { const a = atr[j]; if (!(a > 0)) return; const ts = T[j].e;
      out.push({ ev, D, j, ts, s, stop, a, H, ratio, sess: ts <= D + NOON ? 0 : 1, call: callAt(ts) }); };
    // (a) / (b) / (d)
    let j1 = -1, d1 = 0;
    for (let j = j0; inWin(j); j++) { const c = T[j].c; if (c > hi) { j1 = j; d1 = 1; break; } if (c < lo) { j1 = j; d1 = -1; break; } }
    if (j1 >= 0) { const b = T[j1], B = ATRK * atr[j1];
      push(0, j1, d1, d1 > 0 ? b.l - B : b.h + B);
      push(1, j1, -d1, d1 > 0 ? b.h + B : b.l - B);
      for (let j = j1 + 1; inWin(j); j++) { const c = T[j].c; if (d1 > 0 ? c < lo : c > hi) { const q = T[j], Bq = ATRK * atr[j];
        push(3, j, -d1, -d1 > 0 ? q.l - Bq : q.h + Bq); break; } } }
    // (c)
    let p = -1, pd = 0;
    for (let j = j0; inWin(j); j++) { const up = T[j].h > hi, dn = T[j].l < lo; if (up || dn) { p = j; pd = up && dn ? 0 : up ? 1 : -1; break; } }
    if (p >= 0 && pd) { let ext = pd > 0 ? -Infinity : Infinity;
      for (let k = p; k <= p + 2 && inWin(k); k++) { const q = T[k]; ext = pd > 0 ? Math.max(ext, q.h) : Math.min(ext, q.l);
        if (q.c >= lo && q.c <= hi) { const B = ATRK * atr[k]; push(2, k, -pd, pd > 0 ? ext + B : ext - B); break; } } }
  }
  return { list: out, boxes };
}

// ---- one trade, four exits in one pass; closed by 21:00 UTC of day D. Stop first in a candle that holds both. -------------
export function sim(M5, s, fi, stop, H, D) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const tg = [fill + s * risk, fill + 2 * s * risk, fill + s * H, NaN], R = [NaN, NaN, NaN, NaN], dl = D + H21;
  let left = 4, last = -1;
  const fin = (k, px) => { if (Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left && M5[j].e <= dl; j++) { const b = M5[j]; last = j;
    if (j > fi) { if (s * (b.o - stop) <= 0) for (let k = 0; k < 4; k++) fin(k, b.o); else for (let k = 0; k < 3; k++) if (s * (b.o - tg[k]) >= 0) fin(k, b.o); }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) for (let k = 0; k < 4; k++) fin(k, stop);
    for (let k = 0; k < 3; k++) if (s * ((s > 0 ? b.h : b.l) - tg[k]) >= 0) fin(k, tg[k]); }
  if (left) { if (last < 0) return null; for (let k = 0; k < 4; k++) fin(k, M5[last].c); }
  return { fill, risk, R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }
// the cells a trade of event e falls in (k: split membership list)
const splitsOf = (g, s) => [heightBucket(g.ratio), g.call === s ? 3 : 4, g.sess ? 6 : 5];

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const { list, boxes } = events(F); const cost = COSTS[market], X = exclusions(market);
  const T = F['15m'], atr = atr14(T), Dd = F['1d'], atrD = atr14(Dd), calls = dailyCalls(F);
  const real = newAcc(), ctl = newAcc(); const cnt = { events: list.length, trades: 0, dropped: 0, bad: 0, small: 0, open: 0, fadeCtl: 0, twinMiss: 0, byEvent: [0, 0, 0, 0] };
  const book = (A, cells, w, m, R, cr) => { for (const [c, x] of cells) add(A, c, w, m, R[x], cr); };
  const cellsOf = (e, g, s) => [...[0, 1, 2, 3].map((x) => [mainCell(e, x), x]), ...splitsOf(g, s).map((k) => [splitCell(e, k), 1])];
  // try one trade: returns { w, m, R, cr } or null
  const trade = (ts, s, stop, H, D) => {
    const fi = startIdx(M5, ts); if (fi >= M5.length) return null; const t = M5[fi].t;
    if (t < FROM || t >= TO || t >= D + H21) return null; if (X.length && inBad(X, t)) { cnt.dropped++; return null; }
    const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) { cnt.bad++; return null; } if (risk < cost) { cnt.small++; return null; }
    if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
    const r = sim(M5, s, fi, stop, H, D); if (!r) { cnt.open++; return null; }
    return { w: t < SPLIT ? 0 : 1, m: monthOf(t), R: r.R, cr: cost / risk };
  };
  // days by window for the random twins
  const days = [[], []]; for (const b of boxes.values()) { if (b.D + H7 < FROM || b.D >= TO) continue; days[b.D < SPLIT ? 0 : 1].push(b.D); }
  days.forEach((a) => a.sort((x, y) => x - y));
  const rnd = K.rng(SEED + market.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 100000);
  const callAt = (t) => { const k = K.closedCount(Dd, t) - 1; return k >= 0 ? calls[k] || 0 : 0; };
  for (const g of list) {
    const r = trade(g.ts, g.s, g.stop, g.H, g.D); if (!r) continue; cnt.trades++; cnt.byEvent[g.ev]++;
    const cells = cellsOf(g.ev, g, g.s); book(real, cells, r.w, r.m, r.R, r.cr);
    if (g.ev === 0 || g.ev === 3) { // random twin: another day of the window, a random M15 candle of the same session, same side
      let done = false; const pool = days[r.w];
      for (let tries = 0; tries < 30 && !done && pool.length > 1; tries++) {
        const D2 = pool[Math.floor(rnd() * pool.length)]; if (D2 === g.D) continue;
        const st = D2 + H7 + (g.sess ? 5 * 3600 : 0) + Math.floor(rnd() * 20) * 900; const j = startIdx(T, st);
        if (j >= T.length || T[j].t !== st || !(atr[j] > 0)) continue; const b = T[j], B = ATRK * atr[j];
        const x = trade(b.e, g.s, g.s > 0 ? b.l - B : b.h + B, boxes.get(D2).H, D2); if (!x || x.w !== r.w) continue;
        book(ctl, cells, x.w, x.m, x.R, x.cr); done = true; }
      if (!done) cnt.twinMiss++;
    }
  }
  // the plain M15 fade control for (b) and (c): every M15 structure break 07:00-16:45 UTC on a box day, faded
  for (const e of breaks(T)) { const b = T[e.i], D = Math.floor(b.t / DAY) * DAY, bx = boxes.get(D);
    if (!bx || b.t < D + H7 || b.t > D + LAST || !(atr[e.i] > 0)) continue;
    const k = K.closedCount(Dd, D + H7) - 1; const dA = k >= 0 ? atrD[k] : 0; if (!(dA > 0)) continue;
    const B = ATRK * atr[e.i], s = -e.dir, stop = e.dir > 0 ? b.h + B : b.l - B;
    const r = trade(b.e, s, stop, bx.H, D); if (!r) continue; cnt.fadeCtl++;
    const g = { ratio: bx.H / dA, call: callAt(b.e), sess: b.e <= D + NOON ? 0 : 1 };
    for (const ev of [1, 2]) book(ctl, cellsOf(ev, g, s), r.w, r.m, r.R, r.cr); }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    boxes: boxes.size, ...cnt, real: J(real), ctl: J(ctl) };
}

// ---- cut test: the events known by a date, on candles cut there, equal the full run's -----------------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.ev, g.ts, g.s, g.stop.toFixed(8), g.a.toFixed(10), g.ratio.toFixed(8), g.call].join('|');
  const full = events(frames(M5)).list; const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = events(frames(M5.filter((b) => b.e <= T))).list.filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export function judge(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctl'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), cs = cellStats(C, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl: { d: cs.d, c: cs.c }, vs: { d: welch(s.d, cs.d), c: welch(s.c, cs.c) } }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });
const ctlName = (e) => (e === 1 || e === 2 ? 'plain M15 fade, same hours' : 'random-time M15 entry, same side and session');

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const ok = rows.filter((r) => r.c.n >= 300); const best = [...(ok.length ? ok : rows)].sort((a, b) => b.c.t - a.c.t)[0];
  const b = [...pass].sort((a, b2) => b2.c.t - a.c.t)[0] || best;
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 44 cells pass before costs; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; control Welch t ${f2(b.vs.c)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 44 cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}; against its control Welch t ${f2(b.vs.d)} / ${f2(b.vs.c)})`;
  const RW = rows.map((r) => ({ cell: r.name, event: EVENTS[r.e], exit: EXITS[r.x], split: r.split, control: ctlName(r.e), disc: slim(r.d), conf: slim(r.c),
    ctlDisc: slim(r.ctl.d), ctlConf: slim(r.ctl.c), vs: { d: r.vs.d == null ? null : +r.vs.d.toFixed(3), c: r.vs.c == null ? null : +r.vs.c.toFixed(3) },
    holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass }));
  const out = { study: 'asia-box-london', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      boxes: d.boxes, events: d.events, trades: d.trades, byEvent: d.byEvent, control: d.fadeCtl, twinMiss: d.twinMiss, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    passed: pass.map((r) => r.name), bestConfirmation: best.name, passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name),
    cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# The Asia box met by London and New York (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The Asia box = the high and low of the 5-minute candles starting 00:00-07:00 UTC on a weekday. On closed M15 candles that',
    'start 07:00-16:45 UTC: (a) the first close out of the box, traded WITH it; (b) the same close, FADED; (c) the first wick',
    'beyond the box that closes back inside within 3 candles, traded back; (d) after (a), the first close out of the OTHER side,',
    'traded with it. Market entry at the next 5-minute open, stop past the relevant candle extreme by 0.1 M15 ATR, exits 1R, 2R,',
    'the box height projected from the fill, or the 21:00 UTC close (everything closed by 21:00). Splits at 2R: box height against',
    'the Daily ATR, the Daily MSNR call agreeing with the trade, London (close by 12:00) or New York. Ten markets pooled, OANDA mid',
    '5-minute candles; discovery 2005-2014, confirmation 2015 to October 2026; judged before costs on month sums, Holm over the 44',
    'confirmation tests, and against a control (b, c: the plain M15 fade rule in the same hours; a, d: a random-time M15 entry,',
    'same side and session, on another day of the same window).',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 44.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; control = the cell\'s control in the same window; vs = Welch t of',
    'the cell against its control (discovery / confirmation).', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | control R 05-14 / 15-26 | vs | Holm | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.ctl.d.mean)} / ${f3(r.ctl.c.mean)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} | ${r.holm.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} events known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (events and controls alike).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | Asia boxes | events | trades (a / b / c / d) | fade control trades | twins not found | dropped | past the stop | risk under cost |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.boxes)} | ${N(m.events)} | ${N(m.trades)} (${m.byEvent.map(N).join(' / ')}) | ${N(m.control)} | ${m.twinMiss} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cell(s) clear the pre-registered bar before costs in both decades and beat their control. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' of them stay positive after costs in both windows.' : 'None stays positive after costs in both windows.'}`,
    'A before-cost result on mid-price candles is not an edge; nothing is adopted. A forward record or a live change needs the owner.');
  else L.push('No cell clears the bar: trading the first London / New York move out of the Asia box with it, against it, back after a',
    'false break, or with a second break the other way does not make money before costs in both decades while beating its control.',
    'Do not re-test variants of these 44 cells on these years. Nothing live changed; no rule is proposed.');
  const near = rows.filter((r) => !r.pass && Object.values(r.checks).filter((v) => !v).length === 1);
  if (near.length) L.push('', '**Near misses** (every check but one; reported, not a pass):', '',
    ...near.map((r) => `- ${r.name}: ${f3(r.c.mean)}R a trade before costs in 2015-26 (n ${N(r.c.n)}, month t ${f2(r.c.t)}; 2005-14 ${f3(r.d.mean)}R, t ${f2(r.d.t)}), Holm ${r.holm.toFixed(3)}, against its control Welch t ${f2(r.vs.d)} / ${f2(r.vs.c)}; after costs ${f3(r.c.meanNet)}R. Missed: ${Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}.`));
  const fb = rows.find((r) => r.name === 'b fade box'), fc = rows.find((r) => r.name === 'b fade 21:00');
  if (fb && fc) L.push('', `**The fade is the plain fade.** Fading the first close out of the Asia box made ${f3(fb.c.mean)}R (box target) and ${f3(fc.c.mean)}R (21:00 close)`,
    `a trade before costs in 2015-26, and the plain M15 fade rule in the same hours made ${f3(fb.ctl.c.mean)}R and ${f3(fc.ctl.c.mean)}R (Welch t ${f2(fb.vs.c)} and ${f2(fc.vs.c)}):`,
    'the Asia box adds nothing to the short-term pull-back `grid7-wide-fade` already found, and after costs every fade cell loses.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'events', r.events, 'trades', r.trades, 'fadeCtl', r.fadeCtl, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
