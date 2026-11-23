// research/edge/evening-methods/run.mjs - do the owner's methods work in the 20-23 UTC window where the plain fade sits?
// (PREREGISTRATION.md, 23 Nov 2026). Ten fixed method readings (R1-R10) and the plain fade (C), each from its source study's own
// code (imported, never edited), every exit a 2R target; split by the UTC hour the signal candle starts: evening 20-23, day 07-16,
// other. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node --max-old-space-size=7000 research/edge/evening-methods/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/evening-methods/run.mjs cut <m> <outDir>
//   node research/edge/evening-methods/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, TO, NM, DM, p1, signals as coreSignals, exits as coreExits } from '../grid7-wide-core/run.mjs';
import { signals as fadeSignals, exits, CAP } from '../grid7-wide-fade/run.mjs';
import { signals as efSignals } from '../grid7-ltf-ef/run.mjs';
import { boxEvents, ATRK as BOX_ATRK, CAP as BOX_CAP } from '../grid7-box-fade/run.mjs';
import { storyTrades } from '../grid7-mosha-fade/run.mjs';
import { frames as mFrames, storylines } from '../grid6-mosha-market/run.mjs';
import { signals as flipSignals, CAP as FLIP_CAP } from '../sd-flip-wide/run.mjs';
import { stats, welchDf } from '../fade-hour-check/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const READINGS = [
  { k: 'R1', name: 'Engulf zone first touch + M15 break, WITH' },
  { k: 'R2', name: 'Engulf zone first touch + M15 break, FADED' },
  { k: 'R3', name: 'Failed engulf on M15 (within 12 candles)' },
  { k: 'R4', name: 'M15 box close-out, WITH' },
  { k: 'R5', name: 'M15 box close-out, FADED' },
  { k: 'R6', name: 'Mosha CF M30>M5, WITH' },
  { k: 'R7', name: 'Mosha CF M30>M5, FADED' },
  { k: 'R8', name: 'Mosha CF H1>M15, WITH' },
  { k: 'R9', name: 'Mosha CF H1>M15, FADED' },
  { k: 'R10', name: 'Zone flip near, 4h, M15 close inside' },
  { k: 'C', name: 'Plain fade of the first M15 break (control)' },
];
export const NR = READINGS.length, CTRL = NR - 1;
export const BUCKETS = ['evening', 'day', 'other'];
export const HOUR = (t) => new Date(t * 1000).getUTCHours();
export const bucketOf = (h) => (h >= 20 ? 0 : h >= 7 && h <= 16 ? 1 : 2);

// ---- trade specs of every reading (closed candles only): { r, h (hour the signal candle starts), s, fi, stop, cap } ----------
export function specs(M5, market) {
  const F = frames(M5), out = [];
  const add = (r, tStart, s, ts, stop, cap) => { const fi = startIdx(M5, ts); if (fi >= M5.length) return; out.push({ r, h: HOUR(tStart), s, fi, stop, cap }); };
  // R1 / R2: grid7-wide-core family eg, level 4h, trigger break (M15); R2 = the mirrored twin (stop at the same distance)
  { const seen = new Set();
    for (const g of coreSignals(F)) { if (g.f !== 0 || g.l !== 1 || g.tr !== 0) continue; const key = g.j + '|' + g.s; if (seen.has(key)) continue; seen.add(key);
      const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const fill = M5[fi].o, risk = g.s * (fill - g.stop);
      add(0, g.tt, g.s, g.ts, g.stop, 86400);
      if (risk > 0) add(1, g.tt, -g.s, g.ts, fill + g.s * risk, 86400); } }
  // R3: grid7-ltf-ef failed engulf, M15, failed within 12 candles, any context
  for (const g of efSignals(F)) { if (g.kind !== 'ef' || g.tf !== 1 || g.n > 12) continue; add(2, g.ts - 900, g.s, g.ts, g.stop, CAP['15m']); }
  // R4 / R5: grid7-box-fade M15 close-out, with (stop past the box's other side) and faded (stop past the close-out candle's extreme)
  for (const g of boxEvents(F['15m'], 0, F['1h'])) { if (g.kind !== 'co') continue; const other = g.d > 0 ? g.lo : g.hi;
    add(3, g.ts - 900, g.d, g.ts, other - g.d * BOX_ATRK * g.a, BOX_CAP['15m']);
    add(4, g.ts - 900, -g.d, g.ts, g.ext + g.d * BOX_ATRK * g.a, BOX_CAP['15m']); }
  // R6-R9: grid7-mosha-fade CF, with and faded, M30>M5 and H1>M15 (grid6-mosha-market frames and storylines 'any')
  { const FM = mFrames(M5), cache = {};
    [[['30m', '5m'], 5], [['1h', '15m'], 7]].forEach(([[h, v], r0]) => { const V = FM[v], atrV = atr14(V);
      for (const st of storylines(FM, h, v, 'any', [], cache)) for (const tr of storyTrades(M5, V, atrV, st))
        out.push({ r: r0 + tr.sd, h: HOUR(V[st.cfIdx].t), s: tr.s, fi: tr.fi, stop: tr.stop, cap: CAP[v] }); }); }
  // R10: sd-flip-wide stream real, 4h, entry on an M15 close inside, near (distance under 1 ATR), both families deduplicated
  { const seen = new Set();
    for (const g of flipSignals(F, market).sort((a, b) => a.fam - b.fam)) { if (g.st !== 'real' || g.l !== 1 || g.en !== 0) continue;
      const key = g.j + '|' + g.s; if (seen.has(key)) continue; seen.add(key); if (!(g.dist < 1)) continue;
      add(9, g.tt, g.s, g.ts, g.stop, FLIP_CAP['4h']); } }
  // C: the plain fade (fade-hour-check runSeries: grid7-wide-fade m15 none atr 2R all)
  { const T = F['15m'];
    for (const g of fadeSignals(F)) { if (g.cx !== 0 || g.tf !== 1) continue; const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue;
      const fill = M5[fi].o; add(CTRL, T[g.j].t, -g.d, g.ts, fill + g.d * g.a, CAP['15m']); } }
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// one market -> trades per reading: [fillT, hour, R (2R target, before costs), costR]
export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const cost = COSTS[market], X = exclusions(market), T = READINGS.map(() => []);
  const cnt = { specs: 0, dropped: 0, bad: 0, small: 0, open: 0 };
  for (const g of specs(M5, market)) {
    cnt.specs++; const t = M5[g.fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { cnt.dropped++; continue; }
    const fill = M5[g.fi].o, risk = g.s * (fill - g.stop);
    if (!(risk > 0)) { cnt.bad++; continue; }
    if (risk < cost) { cnt.small++; continue; }
    if (!(g.s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const r = exits(M5, g.s, g.fi, g.stop, [fill + g.s * 2 * risk], g.cap);
    if (!r) { cnt.open++; continue; }
    T[g.r].push([t, g.h, +r.R[0].toFixed(6), +(cost / risk).toPrecision(6)]);
  }
  return { market, cost, assumed: ASSUMED.includes(market), first: M5[0]?.t ?? null, last: M5.at(-1)?.t ?? null, candles: M5.length, ...cnt, trades: T };
}

// ---- cut test: specs whose fill candle is known by a date, computed on candles cut there, equal the full run's --------------
export function cutTest(market, cuts = ['2006-06-14', '2007-03-21', '2007-11-14', '2008-08-20', '2009-05-13']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2010-01-01' });
  const key = (g, B) => [g.r, g.h, g.s, B[g.fi].t, g.stop.toFixed(9)].join('|');
  const full = specs(M5, market); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000; const C5 = M5.filter((b) => b.e <= T);
    const A = new Set(specs(C5, market).filter((g) => C5[g.fi].e <= T).map((g) => key(g, C5)));
    const B = new Set(full.filter((g) => M5[g.fi].e <= T).map((g) => key(g, M5)));
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- report ---------------------------------------------------------------------------------------------------------------
const W = { A: [0, DM], B: [DM, NM] };
const r6 = (x) => (x == null ? null : +x.toFixed(6)), r3 = (x) => (x == null ? null : +x.toFixed(3));
const slim = (w) => ({ n: w.n, mean: r6(w.mean), t: r3(w.t), meanNet: r6(w.meanNet), tNet: r3(w.tNet), win: r3(w.win), costR: w.costR == null ? null : +w.costR.toFixed(4) });
const read = (dir, f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);
export const MIN_N = 300;

// the six t figures of one reading and its pass; e/d/c = { A, B } stats of evening, day, evening control
export function judgeOne(e, d, c) {
  const wd = { A: welchDf(e.A, d.A), B: welchDf(e.B, d.B) }, wc = { A: welchDf(e.A, c.A), B: welchDf(e.B, c.B) };
  const figs = [
    { what: 'evening minus day, A (Welch)', t: wd.A.t, p: wd.A.t == null ? 1 : p1(wd.A.t, wd.A.df) },
    { what: 'evening minus day, B (Welch)', t: wd.B.t, p: wd.B.t == null ? 1 : p1(wd.B.t, wd.B.df) },
    { what: 'evening cell, A (month sums)', t: e.A.t, p: e.A.t == null ? 1 : p1(e.A.t, e.A.months - 1) },
    { what: 'evening cell, B (month sums)', t: e.B.t, p: e.B.t == null ? 1 : p1(e.B.t, e.B.months - 1) },
    { what: 'evening minus plain fade evening, A (Welch)', t: wc.A.t, p: wc.A.t == null ? 1 : p1(wc.A.t, wc.A.df) },
    { what: 'evening minus plain fade evening, B (Welch)', t: wc.B.t, p: wc.B.t == null ? 1 : p1(wc.B.t, wc.B.df) },
  ];
  const tsOk = figs.every((f) => f.t != null && f.t >= 2);
  const nOk = e.A.n >= MIN_N && e.B.n >= MIN_N, meanOk = e.A.mean > 0 && e.B.mean > 0;
  const weakest = figs.reduce((a, b) => (b.p > a.p ? b : a));
  return { figs: figs.map((f) => ({ ...f, t: r3(f.t), p: f.p })), nOk, meanOk, tsOk, p: weakest.p, weakest: weakest.what };
}
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); const adj = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; }); return adj; }

export function report(dir) {
  const D = MARKETS.map((m) => read(dir, `M-${m}.json`)).filter(Boolean);
  if (D.length !== MARKETS.length) throw new Error(`markets missing: ${MARKETS.filter((m) => !D.find((d) => d.market === m)).join(', ')}`);
  const cuts = MARKETS.map((m) => read(dir, `cut-${m}.json`)).filter(Boolean).flat();
  const tr = (r, f = () => true) => D.flatMap((d) => d.trades[r].filter(f));
  const bk = (b) => (x) => bucketOf(x[1]) === b;
  const cell = (r, b) => ({ A: stats(tr(r, b == null ? undefined : bk(b)), ...W.A), B: stats(tr(r, b == null ? undefined : bk(b)), ...W.B) });
  // gate: the control reproduces fade-hour-check's whole-fade figures
  const fh = JSON.parse(fs.readFileSync(path.join(HERE, '../fade-hour-check/result.json'), 'utf8'));
  const gA = fh.gate.find((g) => g.what.includes('2005-14')), gB = fh.gate.find((g) => g.what.includes('2015-26'));
  const cAll = cell(CTRL, null);
  const gate = [{ what: 'plain fade, 2005-14', want: gA.want, got: { n: cAll.A.n, mean: r6(cAll.A.mean) } },
    { what: 'plain fade, 2015-26', want: gB.want, got: { n: cAll.B.n, mean: r6(cAll.B.mean) } }]
    .map((x) => ({ ...x, ok: x.want.n === x.got.n && Math.abs(x.want.mean - x.got.mean) < 0.0005 }));
  const ctrlE = cell(CTRL, 0);
  const rows = READINGS.map((R, r) => { const B = BUCKETS.map((_, b) => cell(r, b)); const all = cell(r, null);
    return { ...R, all: { A: slim(all.A), B: slim(all.B) }, buckets: BUCKETS.map((b, i) => ({ bucket: b, A: slim(B[i].A), B: slim(B[i].B) })), _B: B }; });
  const tests = rows.slice(0, CTRL).map((x) => ({ k: x.k, name: x.name, ...judgeOne(x._B[0], x._B[1], ctrlE) }));
  const adj = holm(tests.map((t) => t.p)); tests.forEach((t, i) => { t.holm = adj[i]; t.pass = t.nOk && t.meanOk && t.tsOk && t.holm < 0.05; });
  const anyN = tests.some((t) => t.nOk), passed = tests.filter((t) => t.pass);
  const verdict = passed.length ? 'PASS' : anyN ? 'FAIL' : 'INCONCLUSIVE';
  // per-market evening rows for any reading that passes
  const perMarket = passed.map((t) => { const r = READINGS.findIndex((x) => x.k === t.k);
    return { k: t.k, rows: D.map((d) => { const L = d.trades[r].filter(bk(0)); return { market: d.market, assumed: d.assumed, A: slim(stats(L, ...W.A)), B: slim(stats(L, ...W.B)) }; }) }; });
  // the evening cell with the strongest weakest-link, for the headline
  const best = [...tests].sort((a, b) => a.p - b.p)[0], bRow = rows.find((x) => x.k === best.k), be = bRow.buckets[0];
  const headline = passed.length
    ? `${passed.length} of ${tests.length} readings pass; ${best.k} (${best.name}) in the evening made ${fR(be.B.mean)}R a trade before costs in 2015-26 (n ${N(be.B.n)}, month t ${f2(be.B.t)}).`
    : `0 of ${tests.length} readings pass; the nearest, ${best.k} (${best.name}), made ${fR(be.B.mean)}R a trade before costs in the evening in 2015-26 (n ${N(be.B.n)}, month t ${f2(be.B.t)}; ${fR(be.B.meanNet)}R after costs), weakest test: ${best.weakest} (t ${f2(best.figs.find((f) => f.what === best.weakest).t)}).`;
  const res = { verdict, headline, built: new Date().toISOString().slice(0, 10), gate, gateOk: gate.every((g) => g.ok),
    cuts, cutsOk: cuts.length > 0 && cuts.every((c) => c.missing === 0 && c.extra === 0), stopsOnLosingSide: true,
    controlEvening: { A: slim(ctrlE.A), B: slim(ctrlE.B) }, tests, rows: rows.map(({ _B, ...x }) => x), perMarket,
    meta: D.map((d) => ({ market: d.market, assumed: d.assumed, candles: d.candles, specs: d.specs, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open,
      trades: d.trades.map((x) => x.length) })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md(res));
  return res;
}

const fR = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
const N = (x) => Math.round(x).toLocaleString('en-US');
const pf = (p) => (p < 0.001 ? '< 0.001' : p.toFixed(3));
export function md(r) {
  const L = ['# Evening methods: do the owner\'s methods work where the plain fade sits? (result)', '',
    `**Verdict: ${r.verdict}. ${r.headline}**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants. Not an edge: R is judged BEFORE costs (as the grid7 studies); the',
    'after-cost figure sits beside every one. Costs for xag, nzdusd, usdcad, usdchf, eurjpy are ASSUMED, not measured.', '',
    '## What was run', '',
    'Ten fixed readings of the owner\'s methods, each from its source study\'s own code (imported, never edited), and the plain',
    'fade of the first M15 break as the control; every exit a 2R target; OANDA mid on ten markets; A = 2005-14, B = 2015 to',
    'Oct 2026. Split by the UTC hour the signal candle starts: evening 20-23, day 07-16, other 00-06 and 17-19. A reading passes',
    'only if, in A and in B: evening beats day (Welch t >= 2), the evening cell is positive with month-sum t >= 2 (n >= 300), and',
    'it beats the plain fade in the evening (Welch t >= 2); Holm over the 10 tests on the weakest of the six. Per-trade Welch t',
    'counts overlapping trades as independent, so it can overstate.', '',
    '## Checks', '',
    ...r.gate.map((g) => `- Gate, ${g.what}: n ${N(g.got.n)} mean ${fR(g.got.mean)} (want n ${N(g.want.n)}, ${fR(g.want.mean)}): ${g.ok ? 'equal' : 'DIFFERENT'}.`),
    `- Cut test (${r.cuts.length} cuts): ${r.cutsOk ? 'every spec known by each date equal on cut candles' : 'MISMATCH'} (${r.cuts.map((c) => `${c.market} ${c.cut} n ${c.n}`).join('; ')}).`,
    '- Every trade has its stop on the losing side (the run throws otherwise).', '',
    '## Primary tests (before costs)', '',
    '| Test | Reading | eve-day A | eve-day B | eve A (month t) | eve B (month t) | vs fade A | vs fade B | Holm p | Pass |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ...r.tests.map((t) => { const row = r.rows.find((x) => x.k === t.k).buckets[0]; const F = t.figs.map((f) => f2(f.t));
      return `| ${t.k} | ${t.name} | ${F[0]} | ${F[1]} | ${fR(row.A.mean)} (${F[2]}) | ${fR(row.B.mean)} (${F[3]}) | ${F[4]} | ${F[5]} | ${pf(t.holm)} | ${t.pass ? 'yes' : 'no'} |`; }),
    '', `Plain fade, evening: A ${fR(r.controlEvening.A.mean)}R a trade (n ${N(r.controlEvening.A.n)}, month t ${f2(r.controlEvening.A.t)}; ${fR(r.controlEvening.A.meanNet)} after costs), B ${fR(r.controlEvening.B.mean)}R (n ${N(r.controlEvening.B.n)}, t ${f2(r.controlEvening.B.t)}; ${fR(r.controlEvening.B.meanNet)} after costs).`, '',
    '## Every cell', '',
    'R a trade before costs (month t) | after costs, n.', '',
    '| Reading | Hours | n A | A before (t) | A after | n B | B before (t) | B after |', '|---|---|---:|---:|---:|---:|---:|---:|',
    ...r.rows.flatMap((x) => [...x.buckets, { bucket: 'all', ...x.all }].map((b) =>
      `| ${x.k} ${x.name} | ${b.bucket} | ${N(b.A.n)} | ${fR(b.A.mean)} (${f2(b.A.t)}) | ${fR(b.A.meanNet)} | ${N(b.B.n)} | ${fR(b.B.mean)} (${f2(b.B.t)}) | ${fR(b.B.meanNet)} |`)), ''];
  if (r.perMarket.length) { L.push('## Per market, evening, readings that pass', '');
    for (const p of r.perMarket) { L.push(`### ${p.k}`, '', '| Market | n A | A before (t) | A after | n B | B before (t) | B after |', '|---|---:|---:|---:|---:|---:|---:|',
      ...p.rows.map((x) => `| ${x.market}${x.assumed ? ' (cost assumed)' : ''} | ${N(x.A.n)} | ${fR(x.A.mean)} (${f2(x.A.t)}) | ${fR(x.A.meanNet)} | ${N(x.B.n)} | ${fR(x.B.mean)} (${f2(x.B.t)}) | ${fR(x.B.meanNet)} |`), ''); } }
  L.push('## What it means', '', ...meaning(r), '');
  return L.join('\n');
}
function meaning(r) {
  const out = [];
  if (r.verdict === 'PASS') out.push('A reading passed on the pre-registered before-cost bar. It is not an edge: after costs it must be read beside the',
    'figures above, it rests on per-trade Welch t on overlapping trades, and it needs its own pre-registration on other data before',
    'anything is built on it.');
  else out.push('No method reading does better in the evening than the plain fade does there, on the pre-registered bar. The evening tilt',
    'belongs to the plain fade of the first break; the owner\'s methods do not add to it in that window.');
  out.push('', 'Nothing live changed and no rule is proposed. Never call any of these an edge; after costs every evening cell must be read',
    'from the table above. Do not try other hour windows, exits or readings on these years.');
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2); const t0 = Date.now();
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const r = runMarket(a); fs.writeFileSync(path.join(b, `M-${a}.json`), JSON.stringify(r));
    console.log(a, r.trades.map((x) => x.length).join(' '), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, `cut-${a}.json`), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
