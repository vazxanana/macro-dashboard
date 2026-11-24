// research/edge/round-fade-net/run.mjs - PREREGISTRATION.md (24 Nov 2026): the fade of a close through a round level on M15,
// H1 and H4 with five complements (none, exhaust, quiet, dayext, exhaust+dayext) and 2R / 3R exits, judged AFTER costs.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/round-fade-net/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/round-fade-net/run.mjs cut <m> <outDir>
//   node research/edge/round-fade-net/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { exits, sessionOf } from '../grid7-wide-fade/run.mjs';
import { events, STEPS } from '../round-number-breaks/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['15m', '1h', '4h'], TFN = ['m15', 'h1', 'h4'], FILTERS = ['none', 'exhaust', 'quiet', 'dayext', 'exhaust+dayext'], EXITS = ['2R', '3R'];
export const MEASURED = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const CAP = { '15m': 86400, '1h': 2 * 86400, '4h': 5 * 86400 }, ATRK = 0.1, EXH = 1.5, DAYS = 20, EDGE = 0.2;
export const NCELL = 30;
export const cellIndex = (tf, f, x) => (tf * 5 + f) * 2 + x;
export function cellName(i) { const x = i % 2, r = (i - x) / 2, f = r % 5, tf = (r - f) / 5; return { tf: TFN[tf], filter: FILTERS[f], exit: EXITS[x], name: `${TFN[tf]} ${FILTERS[f]} ${EXITS[x]}` }; }

// which filters an event passes: [none, exhaust, quiet, dayext, both]
export function filtersOf(ev, T, fill, t, D) {
  const b = T[ev.j], ex = b.h - b.l >= EXH * ev.a, q = sessionOf(t) === 2;
  let de = false; const n = K.closedCount(D, t);
  if (n >= DAYS) { let hi = -Infinity, lo = Infinity; for (let i = n - DAYS; i < n; i++) { hi = Math.max(hi, D[i].h); lo = Math.min(lo, D[i].l); }
    if (hi > lo) { const pos = (fill - lo) / (hi - lo); de = ev.d > 0 ? pos >= 1 - EDGE : pos <= EDGE; } }
  return [true, ex, q, de, ex && de];
}

function newAcc() { const A = { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM) };
  for (const k of ['n', 'sum', 'net', 'cr']) A[k] = new Float64Array(NCELL * 2); return A; }
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5), D = F['1d'];
  const cost = COSTS[market], X = exclusions(market), [S, B] = STEPS[market], grid = { off: 0, S, ratio: Math.round(B / S) };
  const A = newAcc(); const cnt = { events: 0, trades: 0, dropped: 0, bad: 0, small: 0, open: 0 };
  TFS.forEach((tfk, tf) => {
    const T = F[tfk], atr = atr14(T);
    for (const ev of events(T, atr, grid)) { if (ev.type !== 'cross') continue; cnt.events++;
      const fi = startIdx(M5, ev.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
      if (X.length && inBad(X, t)) { cnt.dropped++; continue; }
      const fill = M5[fi].o, s = -ev.d, stop = ev.ext + ev.d * ATRK * ev.a, risk = s * (fill - stop);
      if (!(risk > 0)) { cnt.bad++; continue; } if (risk < cost) { cnt.small++; continue; }
      if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      const r = exits(M5, s, fi, stop, [fill + 2 * s * risk, fill + 3 * s * risk], CAP[tfk]); if (!r) { cnt.open++; continue; }
      cnt.trades++; const cr = cost / risk, w = t < SPLIT ? 0 : 1, m = monthOf(t), fl = filtersOf(ev, T, fill, t, D);
      for (let f = 0; f < 5; f++) if (fl[f]) for (let x = 0; x < 2; x++) { const c = cellIndex(tf, f, x), i = c * 2 + w;
        A.ms[c * NM + m] += r.R[x]; A.msNet[c * NM + m] += r.R[x] - cr; A.n[i]++; A.sum[i] += r.R[x]; A.net[i] += r.R[x] - cr; A.cr[i] += cr; }
    }
  });
  const J = (O) => Object.fromEntries(Object.entries(O).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, ...cnt, acc: J(A) };
}

// cut test: H1 and H4 events known by a date equal the full run's when the 5-minute candles are cut there
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const [S, B] = STEPS[market], grid = { off: 0, S, ratio: Math.round(B / S) };
  const run = (M) => { const F = frames(M); return ['1h', '4h'].flatMap((k) => events(F[k], atr14(F[k]), grid).map((e) => ({ k, ...e }))); };
  const key = (e) => [e.k, e.type, e.ts, e.d, e.L, e.ext, e.a.toFixed(10)].join('|');
  const full = run(M5); const out = [];
  for (const c of cuts) { const T0 = Date.parse(c + 'T00:00:00Z') / 1000;
    const A = new Set(run(M5.filter((b) => b.e <= T0)).filter((e) => e.ts <= T0).map(key)), Bs = new Set(full.filter((e) => e.ts <= T0).map(key));
    out.push({ market, cut: c, n: Bs.size, missing: [...Bs].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !Bs.has(k)).length }); }
  return out;
}

export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const i = c * 2 + w, n = A.n[i], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[i] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[i] / n : null, tNet: mstat(msn, a, b).t, costR: n ? A.cr[i] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (r) => r.d.n >= 200 && r.c.n >= 200 && r.d.meanNet > 0 && r.c.meanNet > 0 && r.d.tNet >= 2 && r.c.tNet >= 2 && r.holm < 0.05 && r.measuredNet > 0;

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const r6 = (x) => (x == null ? null : +x.toFixed(6));
const slim = (w) => ({ n: w.n, mean: r6(w.mean), t: +w.t.toFixed(4), meanNet: r6(w.meanNet), tNet: +w.tNet.toFixed(4), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const A = pool(data), AM = pool(data.filter((d) => MEASURED.includes(d.market)));
  const rows = []; for (let c = 0; c < NCELL; c++) { const s = cellStats(A, c), sm = cellStats(AM, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.tNet, s.c.months - 1), measuredNet: sm.c.meanNet, measuredTNet: sm.c.tNet, measuredN: sm.c.n }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 200 && r.c.n >= 200, disc: r.d.meanNet > 0 && r.d.tNet >= 2, conf: r.c.meanNet > 0 && r.c.tNet >= 2, holm: H[i] < 0.05, measured: r.measuredNet > 0 };
    r.pass = passOf(r); });
  const pass = rows.filter((r) => r.pass), verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...rows].filter((r) => r.c.n >= 200).sort((a, b) => b.c.tNet - a.c.tNet)[0], b = [...pass].sort((x, y) => y.c.tNet - x.c.tNet)[0] || best;
  const bestGross = [...rows].filter((r) => r.c.n >= 200).sort((x, y) => y.c.t - x.c.t)[0];
  const headline = verdict === 'PASS'
    ? `${pass.length} of 30 cells pass after costs; best ${b.name}, ${f3(b.c.meanNet)}R a trade after costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.tNet)}; discovery ${f3(b.d.meanNet)}R, t ${f2(b.d.tNet)})`
    : `0 of 30 cells pass after costs; the best, ${b.name}, made ${f3(b.c.meanNet)}R a trade after costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.tNet)}; ${f3(b.c.mean)}R before costs)`;
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d]), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const out = { study: 'round-fade-net', built: '2026-11-24', verdict, headline,
    basis: 'judged AFTER costs on calendar-month sums, Holm over 30, positive after costs on the five measured-cost markets (pre-registered); before costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' },
    markets: data.map((d) => d.market), measuredMarkets: MEASURED, assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), events: d.events, trades: d.trades, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    passed: pass.map((r) => r.name), bestNet: best.name, bestGross: bestGross.name, cut,
    cells: rows.map((r) => ({ cell: r.name, tf: r.tf, filter: r.filter, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
      measured: { n: r.measuredN, meanNet: r6(r.measuredNet), tNet: +r.measuredTNet.toFixed(2) }, checks: r.checks, pass: r.pass })), perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, bestGross));
  return out;
}

function resultMd(o, rows, bg) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Round-number fade after costs: higher timeframes and complements (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The fade of a close through a round level (`round-number-breaks`\' levels and events) on M15, H1 and H4, stop past the event',
    'candle\'s extreme + 0.1 ATR, market entry at the next 5-minute open, 2R or 3R, time limit 1 / 2 / 5 days. Complements: none;',
    'exhaust (event candle range >= 1.5 ATR); quiet (fill 17:00-06:59 UTC); dayext (fill in the outer 20 % of the last 20 New York',
    'days\' range, on the side of the close); exhaust+dayext. Ten markets pooled; judged AFTER costs on month sums in 2005-14 and',
    `2015-26, Holm over 30, and positive after costs on the five measured-cost markets alone. Costs ASSUMED for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 200 in both windows: ${cnt((r) => r.checks.n)} of 30.`,
    `- After costs mean > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}. Positive after costs on the measured markets: ${cnt((r) => r.checks.measured)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`, '',
    '## Every cell', '', 'R a trade after costs (month-sum t after costs), before costs beside; cost R = mean round trip / risk in 2015-26.', '',
    '| Cell | n 05-14 | net 05-14 (t) | gross 05-14 | n 15-26 | net 15-26 (t) | gross 15-26 (t) | cost R | measured net 15-26 (t) | Holm | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.meanNet)} (${f2(r.d.tNet)}) | ${f3(r.d.mean)} | ${N(r.c.n)} | ${f3(r.c.meanNet)} (${f2(r.c.tNet)}) | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${f3(r.measuredNet)} (${f2(r.measuredTNet)}) | ${r.holm.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'After costs (before costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | net (t) [gross] | n 15-26 | net (t) [gross] |', '|---|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.meanNet)} (${f2(x.d.tNet)}) [${f3(x.d.mean)}] | ${N(x.c.n)} | ${f3(x.c.meanNet)} (${f2(x.c.tNet)}) [${f3(x.c.mean)}] |`);
      L.push(''); } }
  L.push('## Checks', '', `- Cut test (H1 and H4 events): ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} events known by the cut dates, ${bad} missing or extra.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill past the stop or a risk under the round trip is no trade.', '',
    '| Market | from | events | trades | dropped | past the stop | risk under cost | unresolved |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.events)} | ${N(m.trades)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cell(s) make money after costs in both decades on mid candles with fixed costs. That is a candidate for a forward paper`,
    'record only (its own pre-registration; the costs of five markets are assumed and no broker tick was read). Not an edge until',
    'a forward record shows it; nothing live changes without the owner.');
  else L.push(`No cell is positive after costs in both decades. The best before costs in 2015-26 was ${bg.name} (${f3(bg.c.mean)}R, t ${f2(bg.c.t)}; ${f3(bg.c.meanNet)}R after costs):`,
    'moving to higher timeframes makes the cost a smaller share of 1R but the pull-back tilt shrinks with it, and none of the',
    'complements (exhaustion candle, quiet hours, daily-range extreme) adds enough to pay the spread. The round-number fade is',
    'closed: no further variants on these years. Nothing live changed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'events', r.events, 'trades', r.trades, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r.map((x) => x.missing + x.extra))); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
