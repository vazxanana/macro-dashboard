// research/edge/sd-flip-wide/run.mjs - the flip of PREREGISTRATION.md (23 Nov 2026): a supply / demand or engulf zone on 1d / 4h
// that price closes through serves the other side; first return, entry on the timeframe two steps lower (a close inside, or a
// structure break), 1R / 2R; 56 cells, two controls (the same zones touched before any break; a random band at a matched
// distance), ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs. Research only.
//   EDGE_DATA=<cache> node --max-old-space-size=6000 research/edge/sd-flip-wide/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/sd-flip-wide/run.mjs cut <m> <outDir>
//   node research/edge/sd-flip-wide/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, egZones } from '../combo-grid-3/run.mjs';
import { sdZones } from '../grid5-sd-eg/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { exits, dailyCalls, mstat, p1, welch, monthOf, NM, DM, FROM, SPLIT, TO, MARKETS, ASSUMED } from '../grid7-wide-core/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export { MARKETS, ASSUMED };
export const LVLS = ['1d', '4h'], ENTRIES = ['close', 'break'], EXITS = ['1R', '2R'];
export const GROUPS = ['sd all', 'eg all', 'both near', 'both far', 'both small', 'both big', 'both msnr'];
export const TBELOW = { '1d': '1h', '4h': '15m' }, CAP = { '1d': 2 * 86400, '4h': 86400 };
export const WIN = 24, ATRK = 0.1, LIFE = 120, KSW = 2;
export const NCELL = GROUPS.length * 8; // 56
export const STREAMS = ['real', 'plac', 'unb', 'rnd'];
export const cellIndex = (g, l, en, x) => ((g * 2 + l) * 2 + en) * 2 + x;
export function cellName(i) { const x = i % 2; i = (i - x) / 2; const en = i % 2; i = (i - en) / 2; const l = i % 2; const g = (i - l) / 2;
  return { group: GROUPS[g], lvl: LVLS[l], entry: ENTRIES[en], exit: EXITS[x], g, l, en, x }; }

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// the end of a zone of side s over [bot, top] made at L index i: the first later L close through its far side, else 120 candles
function endOf(L, i, s, bot, top) {
  for (let j = i + 1; j < L.length && j <= i + LIFE; j++) if (s > 0 ? L[j].c < bot : L[j].c > top) return L[j].e;
  return i + LIFE < L.length ? L[i + LIFE].e : Infinity;
}

// the triggers of one visit: [close, break] = { j } or null. k0 = the touch candle; side s; zone [bot, top]; end time.
function triggers(T, evs, k0, s, bot, top, end) {
  const out = [null, null];
  for (let j = k0; j < k0 + WIN && j < T.length && T[j].e < end; j++) {
    if (!out[0] && T[j].c >= bot && T[j].c <= top) out[0] = j;
    if (!out[1]) { const e = evs.get(j); if (e && e.dir === s) out[1] = j; }
    if (out[0] != null && out[1] != null) break;
  }
  return out;
}

// ---- signals (closed candles only) ------------------------------------------------------------------------------------
// [{ st ('real' | 'unb' | 'rnd'), fam (0 sd, 1 eg), l, en, s, j, tt, ts, stop, dist, body, call }]
export function signals(F, market = '') {
  const out = [], calls = dailyCalls(F), D = F['1d'];
  const callAt = (t) => { const i = K.closedCount(D, t) - 1; return i >= 0 ? calls[i] : 0; };
  LVLS.forEach((lv, l) => {
    const L = F[lv], T = F[TBELOW[lv]], AL = atr14(L);
    const evs = new Map(); for (const e of K.structure(T, KSW).events) evs.set(e.i, e);
    const emit = (st, fam, s, k0, bot, top, end, stop, extra) => {
      const tr = triggers(T, evs, k0, s, bot, top, end);
      tr.forEach((j, en) => { if (j == null) return;
        out.push({ st, fam, l, en, s, j, tt: T[j].t, ts: T[j].e, stop, dist: extra.dist, body: extra.body, call: callAt(T[j].e) }); });
    };
    const fams = [
      sdZones(L).map((z) => ({ d: z.d, bot: z.lo, top: z.hi, at: z.at, end: z.end, fi: Number.isFinite(z.dead) ? K.closedCount(L, z.dead) - 1 : -1 })),
      egZones(L, 3).map((z) => ({ d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end, fi: z.fi })),
    ];
    fams.forEach((Z, fam) => { for (const z of Z) {
      if (!(z.top > z.bot)) continue;
      // the unbroken control: the ordinary first touch, the zone's own side
      { const ai = K.closedCount(L, z.at) - 1, a = ai >= 0 ? AL[ai] : 0;
        if (a > 0) { let k = startIdx(T, z.at);
          while (k < T.length && T[k].t < z.end && !(T[k].l <= z.top && T[k].h >= z.bot)) k++;
          if (k < T.length && T[k].t < z.end) emit('unb', fam, z.d, k, z.bot, z.top, z.end, z.d > 0 ? z.bot - ATRK * a : z.top + ATRK * a, { dist: 0, body: 0 }); } }
      // the flip
      if (z.fi < 0) continue; const fi = z.fi, B = L[fi], a = AL[fi]; if (!(a > 0)) continue;
      const s = -z.d, ft = B.e, body = Math.abs(B.c - B.o) / a;
      const D0 = s < 0 ? z.bot - B.c : B.c - z.top; if (!(D0 > 0)) continue;
      const zone = (bot, top, tag) => {
        const end = endOf(L, fi, s, bot, top); let k = startIdx(T, ft), ext = s < 0 ? B.l : B.h;
        while (k < T.length && T[k].t < end && !(s < 0 ? T[k].h >= bot : T[k].l <= top)) { ext = s < 0 ? Math.min(ext, T[k].l) : Math.max(ext, T[k].h); k++; }
        if (k >= T.length || T[k].t >= end) return null;
        return { k, end, dist: (s < 0 ? bot - ext : ext - top) / a, stop: s < 0 ? top + ATRK * a : bot - ATRK * a, bot, top, tag };
      };
      const r = zone(z.bot, z.top);
      if (r) emit('real', fam, s, r.k, r.bot, r.top, r.end, r.stop, { dist: r.dist, body });
      const u = 0.5 + 1.5 * K.rng(hash(`${market}|${fam}|${lv}|${fi}`))(), w = z.top - z.bot;
      const bb = s < 0 ? B.c + u * D0 : B.c - u * D0 - w, q = zone(bb, bb + w);
      if (q) emit('rnd', fam, s, q.k, q.bot, q.top, q.end, q.stop, { dist: r ? r.dist : q.dist, body });
    } });
  });
  return out;
}

// which cells a signal belongs to (given its stream's dedupe), without the exit
export function groupsOf(g, isUnb) {
  const out = [g.fam]; // 0 'sd all' or 1 'eg all'
  const both = [];
  if (isUnb) { both.push(2, 3, 4, 5); if (g.call === g.s) both.push(6); }
  else { both.push(g.dist < 1 ? 2 : 3, g.body < 1 ? 4 : 5); if (g.call === g.s) both.push(6); }
  return { own: out, both };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F, market).sort((a, b) => a.fam - b.fam), cost = COSTS[market], X = exclusions(market);
  const acc = Object.fromEntries(STREAMS.map((k) => [k, newAcc()]));
  const seen = new Set(); const cnt = { signals: sigs.length, sims: 0, dropped: 0, bad: 0, small: 0 };
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { cnt.dropped++; continue; }
    const fill = M5[fi].o, risk = g.s * (fill - g.stop); if (!(risk > 0)) { cnt.bad++; continue; }
    if (risk < cost) { cnt.small++; continue; }
    const kOwn = `${g.st}|${g.fam}|${g.l}|${g.en}|${g.j}|${g.s}`, kBoth = `${g.st}|b|${g.l}|${g.en}|${g.j}|${g.s}`;
    const newOwn = !seen.has(kOwn), newBoth = !seen.has(kBoth); if (!newOwn && !newBoth) continue; seen.add(kOwn); seen.add(kBoth);
    const cap = CAP[LVLS[g.l]], r = exits(M5, g.s, fi, g.stop, cap); cnt.sims++;
    const p = g.st === 'real' ? exits(M5, -g.s, fi, fill + g.s * risk, cap) : null;
    if (!r || (g.st === 'real' && !p)) continue;
    if (!(g.s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk, G = groupsOf(g, g.st === 'unb');
    const cells = [...(newOwn ? G.own : []), ...(newBoth ? G.both : [])];
    for (const gi of cells) for (let x = 0; x < 2; x++) { const ci = cellIndex(gi, g.l, g.en, x);
      add(acc[g.st], ci, w, m, r.R[x], cr); if (p) add(acc.plac, ci, w, m, p.R[x], cr); }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    ...cnt, byStream: Object.fromEntries(STREAMS.map((k) => [k, sigs.filter((g) => g.st === k).length])), acc: Object.fromEntries(STREAMS.map((k) => [k, J(acc[k])])) };
}

// ---- cut test --------------------------------------------------------------------------------------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.st, g.fam, g.l, g.en, g.tt, g.s, g.stop.toFixed(8), g.call, g.dist.toFixed(6), g.body.toFixed(6)].join('|');
  const full = signals(frames(M5), market); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T)), market).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d.acc[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export function judge(data) {
  const P = Object.fromEntries(STREAMS.map((k) => [k, pool(data, k)])); const rows = [];
  for (let c = 0; c < NCELL; c++) {
    const s = cellStats(P.real, c), ps = cellStats(P.plac, c), us = cellStats(P.unb, c), rs = cellStats(P.rnd, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1),
      unb: { d: us.d, c: us.c }, rnd: { d: rs.d, c: rs.c },
      vsUnb: { d: welch(s.d, us.d), c: welch(s.c, us.c) }, vsRnd: { d: welch(s.d, rs.d), c: welch(s.c, rs.c) },
      plac: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } });
  }
  const H = K.holm(rows.map((r) => r.p)), HP = K.holm(rows.map((r) => r.plac.p));
  const ok3 = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
  const ge2 = (v) => !!(v && v.d != null && v.c != null && v.d >= 2 && v.c >= 2);
  rows.forEach((r, i) => { r.holm = H[i]; r.plac.holm = HP[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      unbroken: ge2(r.vsUnb), random: ge2(r.vsRnd) };
    r.pass = Object.values(r.checks).every(Boolean); r.plac.pass = ok3(r.plac, HP[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
export const cname = (r) => `${r.group} ${r.lvl} ${r.entry} ${r.exit}`;
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });
const r2 = (v) => (v == null ? null : +v.toFixed(2));

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), plPass = rows.filter((r) => r.plac.pass);
  const anyN = rows.some((r) => r.checks.n);
  const verdict = pass.length ? 'PASS' : anyN ? 'FAIL' : 'INCONCLUSIVE';
  const bestC = [...rows].sort((a, b) => b.c.t - a.c.t)[0];
  const perMarket = {}; for (const r of pass) perMarket[r.cell] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 56 cells pass; best ${cname(pass[0])}, ${f3(pass[0].c.mean)}R a trade before costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)})`
    : `0 of 56 cells pass; the best confirmation cell, ${cname(bestC)}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; discovery ${f3(bestC.d.mean)}R, t ${f2(bestC.d.t)})`;
  const RW = rows.map((r) => ({ cell: cname(r), group: r.group, lvl: r.lvl, entry: r.entry, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
    unbroken: { disc: slim(r.unb.d), conf: slim(r.unb.c) }, random: { disc: slim(r.rnd.d), conf: slim(r.rnd.c) },
    vsUnbroken: { d: r2(r.vsUnb.d), c: r2(r.vsUnb.c) }, vsRandom: { d: r2(r.vsRnd.d), c: r2(r.vsRnd.c) }, checks: r.checks, pass: r.pass,
    placebo: { disc: slim(r.plac.d), conf: slim(r.plac.c), holm: +r.plac.holm.toFixed(4), pass: r.plac.pass } }));
  const out = { study: 'sd-flip-wide', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, byStream: d.byStream, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small })),
    passed: pass.map(cname), placeboPassed: plPass.map(cname), bestConfirmation: cname(bestC), cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# The flip: broken supply / demand and engulf zones traded the other way (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Fresh supply / demand zones (`grid5-sd-eg`) and engulf zones (3-candle span) on the Daily and H4 chart. A zone closed through',
    'on its own timeframe is traded the other way on its first return (from the side it was broken to), on the timeframe two steps',
    'lower (Daily -> H1, H4 -> M15): (a) at the first close inside the zone, or (b) at the first structure break of the flipped side,',
    'within 24 candles; market at the next 5-minute open, stop past the zone\'s far side + 0.1 ATR(14) of the zone timeframe, 1R or',
    '2R (time limit 2 days / 1 day). Ten markets pooled, OANDA mid 5-minute candles; discovery 2005-2014, confirmation 2015 to',
    `October 2026. Costs after the fact only; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    'Controls: (1) **unbroken**: the same zones\' ordinary first touch before any break, traded with their own side, same entries and',
    'exits; (2) **random band**: per flip, a band of the zone\'s width on the same side of price at 0.5-2.0 times the flipped zone\'s',
    'distance from the break candle\'s close, traded exactly as the flipped zone. The random band carries the flip\'s distance and',
    'body values; its MSNR condition is read at its own trigger (the same condition as the cell).', '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 56.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 over the 56 confirmation tests: ${cnt((r) => r.checks.holm)}.`,
    `- Beats the unbroken control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.unbroken)}; beats the random band: ${cnt((r) => r.checks.random)}.`,
    `- **All: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped placebo passing bars 1-3: ${o.placeboPassed.length}${o.placeboPassed.length ? ' (' + o.placeboPassed.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; Welch t of the cell against the unbroken control and the random band',
    '(discovery / confirmation); Holm on the confirmation test.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | unbroken R 15-26 | random R 15-26 | vs unbroken | vs random | Holm | Placebo R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.unb.c.mean)} (n ${N(r.unb.c.n)}) | ${f3(r.rnd.c.mean)} (n ${N(r.rnd.c.n)}) | ${f2(r.vsUnb.d)} / ${f2(r.vsUnb.c)} | ${f2(r.vsRnd.d)} / ${f2(r.vsRnd.c)} | ${r.holm.toFixed(3)} | ${f3(r.plac.c.mean)} (${f2(r.plac.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${cname(rows[c])}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) |', '|---|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals (real, unbroken and random) known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (every stream alike).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | flip / unbroken / random signals | simulated | dropped (bad data) | past the stop | risk under cost |', '|---|---|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.byStream.real)} / ${N(m.byStream.unb)} / ${N(m.byStream.rnd)} | ${N(m.sims)} | ${m.dropped} | ${m.bad} | ${N(m.small)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted, and never called an edge before a forward record.');
  else L.push('No flip cell clears the bar: trading a broken supply / demand or engulf zone the other way on its first return does not',
    'pick trades that beat the same zones touched before any break, or a random band at a matched distance, in both windows.',
    'Do not re-test variants of these 56 cells on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, JSON.stringify(r.byStream), 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
