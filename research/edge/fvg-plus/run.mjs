// research/edge/fvg-plus/run.mjs - fair-value gap plus (PREREGISTRATION.md, 24 Nov 2026): the passing gap entry of
// grid7-fvg-wide on 1h / 4h / 1d gaps, with a wider stop and a structure side, judged AFTER costs on ten markets, then the
// passing cells (or the best one, reported only) once on eight markets no gap study has read. Research only.
//   EDGE_DATA=<cache> node research/edge/fvg-plus/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/fvg-plus/run.mjs cut <m> <outDir>
//   node research/edge/fvg-plus/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { gapZones } from '../grid6-smc-market/run.mjs';
import { weekly } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx, manage } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const STAGE1 = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const STAGE2 = ['nas100', 'spx500', 'de40', 'gbpjpy', 'audjpy', 'cadjpy', 'eurgbp', 'euraud'];
export const MEASURED = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const GTF = ['1h', '4h', '1d'], UP = { '1h': '4h', '4h': '1d', '1d': '1w' }, CAP = { '1h': 2 * 86400, '4h': 5 * 86400, '1d': 10 * 86400 };
export const STOPS = ['gap', 'wide'], STOPK = [0.1, 1.0], DIRS = ['none', 'tf', 'up'], EXITS = ['1R', '2R'];
export const LIFE = 120, KSW = 2;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10), NM = 262, DM = 120;
export const NCELL = 36;
export const cellIndex = (g, s, d, x) => ((g * 2 + s) * 3 + d) * 2 + x;
export function cellName(i) { const x = i % 2; i = (i - x) / 2; const d = i % 3; i = (i - d) / 3; const s = i % 2; const g = (i - s) / 2;
  return { tf: GTF[g], stop: STOPS[s], dir: DIRS[d], exit: EXITS[x], g, s, d, x }; }
export const cname = (r) => `${r.tf} ${r.stop} ${r.dir} ${r.exit}`;
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };

export function frames(M5) { const D = K.dailyNY(M5);
  return { '15m': K.resample(M5, 900), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400), '1d': D, '1w': weekly(D) }; }
const sideAt = (B, side, t) => { const i = K.closedCount(B, t) - 1; return i >= 0 ? side[i] : 0; };

// entries (closed candles only): [{ g, d, et, fi, fill, stops: [gap, wide], tf, up }]
export function entries(M5, F) {
  const out = [], M15 = F['15m'];
  GTF.forEach((tf, g) => { const G = F[tf], atr = atr14(G), sideG = K.structure(G, KSW).side, U = F[UP[tf]], sideU = K.structure(U, KSW).side;
    for (const z of gapZones(G)) { const i = z.i, a = atr[i]; if (!(a > 0)) continue; const d = z.d;
      const lifeEnd = i + LIFE < G.length ? G[i + LIFE].e : Infinity;
      for (let j = startIdx(M15, G[i].e); j < M15.length && M15[j].e <= lifeEnd; j++) { const c = M15[j].c;
        if (d > 0 ? c < z.bot : c > z.top) break;
        if (c >= z.bot && c <= z.top) { const et = M15[j].e, fi = startIdx(M5, et); if (fi >= M5.length) break;
          const far = d > 0 ? z.bot : z.top;
          out.push({ g, d, bt: G[i].e, et, fi, fill: M5[fi].o, stops: STOPK.map((k) => far - d * k * a), tf: sideAt(G, sideG, et) === d, up: sideAt(U, sideU, et) === d });
          break; } } } });
  return out;
}

function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2) }; }
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }), E = entries(M5, frames(M5)), cost = COSTS[market], X = exclusions(market);
  const A = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0;
  for (const e of E) { const t = M5[e.fi].t; if (t < FROM || t >= TO) continue; if (X.length && inBad(X, t)) { dropped++; continue; }
    const m = monthOf(t), w = t < SPLIT ? 0 : 1;
    for (let s = 0; s < 2; s++) { const stop = e.stops[s], risk = e.d * (e.fill - stop); if (!(risk > 0)) { bad++; continue; } if (risk < cost) { small++; continue; }
      const r = manage(M5, e.d, e.fi, e.fill, stop, CAP[GTF[e.g]], true); sims++; if (!r) continue;
      if (!(e.d * (e.fill - stop) > 0)) throw new Error('stop on the wrong side');
      const cr = cost / risk;
      for (let d = 0; d < 3; d++) { if ((d === 1 && !e.tf) || (d === 2 && !e.up)) continue;
        for (let x = 0; x < 2; x++) { const c = cellIndex(e.g, s, d, x), R = r.R[x];
          A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.net[c * 2 + w] += R - cr; } } } }
  const J = Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, measured: MEASURED.includes(market), first: M5.length ? M5[0].t : null, entries: E.length, sims, dropped, bad, small, acc: J };
}

export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (e) => [e.g, e.d, e.bt, e.et, e.fill, e.stops.map((s) => s.toFixed(8)).join(','), e.tf, e.up].join('|');
  const full = entries(M5, frames(M5)), out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000; const C5 = M5.filter((b) => b.e <= T);
    const ok = (e) => e.et <= T && M5[e.fi].t < T;
    const A = new Set(entries(C5, frames(C5)).filter((e) => e.et <= T && e.fi < C5.length).map(key)), B = new Set(full.filter(ok).map(key));
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- statistics -------------------------------------------------------------------------------------------------------
export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { months: n, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function cellStats(A, c, wins = [[0, DM, 0], [DM, NM, 1]]) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  return wins.map(([a, b, w]) => { const n = w == null ? A.n[c * 2] + A.n[c * 2 + 1] : A.n[c * 2 + w], sum = w == null ? A.sum[c * 2] + A.sum[c * 2 + 1] : A.sum[c * 2 + w],
    net = w == null ? A.net[c * 2] + A.net[c * 2 + 1] : A.net[c * 2 + w];
    return { n, mean: n ? sum / n : null, t: mstat(ms, a, b).t, meanNet: n ? net / n : null, tNet: mstat(msn, a, b).t, months: b - a }; });
}
export const passes1 = (d, c) => d.n >= 300 && c.n >= 300 && d.meanNet > 0 && c.meanNet > 0 && d.tNet >= 2 && c.tNet >= 2;

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(4), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(4) });
const read = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

export function report(dir) {
  const d1 = STAGE1.map((m) => read(dir, m + '.json')), d2 = STAGE2.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => read(dir, m + '.json'));
  const cut = STAGE1.flatMap((m) => (fs.existsSync(path.join(dir, 'cut-' + m + '.json')) ? read(dir, 'cut-' + m + '.json') : []));
  const A1 = pool(d1), rows = [];
  for (let c = 0; c < NCELL; c++) { const [d, cf] = cellStats(A1, c); rows.push({ cell: c, ...cellName(c), d, c: cf, p: p1(cf.tNet, cf.months - 1) }); }
  const H = K.holm(rows.map((r) => r.p)); rows.forEach((r, i) => { r.holm = H[i]; r.pass1 = passes1(r.d, r.c) && H[i] < 0.05; });
  const p1rows = rows.filter((r) => r.pass1);
  const best = [...rows].sort((a, b) => Math.min(b.d.tNet, b.c.tNet) - Math.min(a.d.tNet, a.c.tNet))[0];
  const run2 = p1rows.length ? p1rows : [best];
  const A2 = pool(d2), s2 = run2.map((r) => { const [w] = cellStats(A2, r.cell, [[0, NM, null]]); return { r, w, p: p1(w.tNet, w.months - 1) }; });
  const H2 = K.holm(s2.map((x) => x.p)); s2.forEach((x, i) => { x.holm = H2[i]; x.pass2 = p1rows.length > 0 && x.w.n >= 300 && x.w.meanNet > 0 && x.w.tNet >= 2 && H2[i] < 0.05; });
  const passed = s2.filter((x) => x.pass2), verdict = passed.length ? 'PASS' : 'FAIL';
  const perMarket = Object.fromEntries(run2.map((r) => [cname(r), d2.map((d) => { const [w] = cellStats(pool([d]), r.cell, [[0, NM, null]]); return { market: d.market, ...slim(w) }; })]));
  const b2 = s2[0];
  const headline = verdict === 'PASS'
    ? `${passed.length} cell(s) pass after costs on the ten markets and on eight unread markets; ${cname(passed[0].r)}: ${f3(passed[0].w.meanNet)}R a trade after costs on the new markets (n ${N(passed[0].w.n)}, month t ${f2(passed[0].w.tNet)})`
    : `${p1rows.length} of 36 cells pass after costs on the ten markets${p1rows.length ? `, none holds on eight unread markets (${cname(b2.r)}: ${f3(b2.w.meanNet)}R a trade after costs, n ${N(b2.w.n)}, month t ${f2(b2.w.tNet)})` : `; the best, ${cname(best)}, made ${f3(best.c.meanNet)}R a trade after costs in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)}) and ${f3(b2.w.meanNet)}R on eight unread markets (n ${N(b2.w.n)}, t ${f2(b2.w.tNet)})`}`;
  const out = { study: 'fvg-plus', built: '2026-11-24', verdict, headline, basis: 'judged after costs on calendar-month sums (pre-registered); before costs beside',
    stage1Markets: STAGE1, stage2Markets: STAGE2, stage2Read: d2.map((d) => d.market), measuredCosts: MEASURED, costs: Object.fromEntries([...d1, ...d2].map((d) => [d.market, d.cost])),
    meta: [...d1, ...d2].map((d) => ({ market: d.market, first: d.first ? new Date(d.first * 1000).toISOString().slice(0, 10) : null, entries: d.entries, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small })),
    stage1Passed: p1rows.map(cname), bestStage1: cname(best), stage2: s2.map((x) => ({ cell: cname(x.r), ...slim(x.w), holm: +x.holm.toFixed(4), pass: x.pass2 })), passed: passed.map((x) => cname(x.r)),
    cut, cells: rows.map((r) => ({ cell: cname(r), tf: r.tf, stop: r.stop, dir: r.dir, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4), pass1: r.pass1 })), perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, s2, best));
  return out;
}

function resultMd(o, rows, s2, best) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const L = ['# Fair-value gap plus: wider room and a structure side, after costs (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    '`grid7-fvg-wide`\'s passing entry (market at the next 5-minute open after the first M15 close back inside a fair-value gap)',
    'on 1h, 4h and 1d gaps; stop past the gap\'s far side by 0.1 ATR ("gap") or 1 ATR ("wide") of the gap\'s timeframe; every',
    'gap, or only when the structure side of the gap\'s timeframe ("tf") or of the timeframe above ("up") agrees; 1R or 2R.',
    'Stage 1 on the ten markets `grid7-fvg-wide` read (so a pass there is selection), **judged after costs**; stage 2 once on',
    `eight markets no gap study had read (${o.stage2Read.join(', ')}), 2005 to October 2026.`,
    `Costs: the demo figures for ${o.measuredCosts.join(', ')}; **ASSUMED, not measured** for every other market, all of stage 2.`, '',
    '## Stage 1 (ten markets, after costs)', '',
    `- Passing all three checks: ${o.stage1Passed.length}${o.stage1Passed.length ? ' (' + o.stage1Passed.join('; ') + ')' : ''}.`,
    `- Best on the weaker window: ${o.bestStage1} (net ${f3(best.d.meanNet)}R, t ${f2(best.d.tNet)} in 2005-14; ${f3(best.c.meanNet)}R, t ${f2(best.c.tNet)} in 2015-26).`, '',
    '| Cell | n 05-14 | gross 05-14 | net 05-14 (t) | n 15-26 | gross 15-26 (t) | net 15-26 (t) | Holm | Pass |', '|---|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const r of rows) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} | ${f3(r.d.meanNet)} (${f2(r.d.tNet)}) | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} (${f2(r.c.tNet)}) | ${r.holm.toFixed(3)} | ${r.pass1 ? 'yes' : 'no'} |`);
  L.push('', '## Stage 2 (eight unread markets, 2005-2026, after costs)', '', o.stage1Passed.length ? 'Every stage-1 passing cell, run once:' : 'No cell passed stage 1; the best one is reported and cannot pass:', '',
    '| Cell | n | gross R (t) | net R (t) | Holm | Pass |', '|---|---:|---:|---:|---:|---|');
  for (const x of s2) L.push(`| ${cname(x.r)} | ${N(x.w.n)} | ${f3(x.w.mean)} (${f2(x.w.t)}) | ${f3(x.w.meanNet)} (${f2(x.w.tNet)}) | ${x.holm.toFixed(3)} | ${x.pass2 ? 'yes' : 'no'} |`);
  for (const [c, list] of Object.entries(o.perMarket)) { L.push('', `Per market, ${c}:`, '', '| Market | n | gross R (t) | net R (t) |', '|---|---:|---:|---:|');
    for (const m of list) L.push(`| ${m.market} | ${N(m.n)} | ${f3(m.mean)} (${f2(m.t)}) | ${f3(m.meanNet)} (${f2(m.tNet)}) |`); }
  L.push('', '## Checks', '', `- Cut test: ${o.cut.length} cuts: ${N(nCut)} entries known by the cut dates, ${badCut} missing or extra on cut candles.`,
    '- Every trade has its stop on the losing side of its fill (the run throws otherwise).', '',
    '| Market | candles from | entries | simulated | dropped | past the stop | risk under cost |', '|---|---|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.entries)} | ${N(m.sims)} | ${m.dropped} | ${m.bad} | ${N(m.small)} |`);
  L.push('', '## What it means', '', o.verdict === 'PASS'
    ? 'A passing cell is a candidate for a forward paper record and an owner decision, nothing more: stage 2 rests on ASSUMED costs, and nothing is called an edge before a forward record.'
    : 'Giving the gap entry more room and a structure side does not make it pay after costs in a way that holds on markets it was not chosen on. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.', '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'entries', r.entries, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
