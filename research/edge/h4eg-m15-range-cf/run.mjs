// research/edge/h4eg-m15-range-cf/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): an H4 engulf zone as the key level,
// at it on M15 a break against the zone, a range at the extreme and a confirmation break back with the zone; a resting limit
// at the level the confirmation took, stop past the range's extreme, 1R / 2R. 8 cells, five markets pooled, discovery
// 2005-14, confirmation 2015 to Oct 2026, judged AFTER costs on calendar-month sums. Research only: nothing live imports it,
// nothing is placed.
//   EDGE_DATA=<cache> node research/edge/h4eg-m15-range-cf/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/h4eg-m15-range-cf/run.mjs cut <m> <outDir>
//   node research/edge/h4eg-m15-range-cf/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const RANGES = ['any', 'built'], FILLS = ['touch', 'through'], TARGETS = ['1R', '2R'];
export const KSW = 3, WIN = 64, VISITS = 2, LIFE = 24, ATRK = 0.1, CAP = 2 * 86400, NCELL = 8;
export const cellIndex = (r, f, x) => (r * 2 + f) * 2 + x;
export function cellName(i) { const x = i % 2, f = ((i - x) / 2) % 2, r = (i - x - 2 * f) / 4;
  return { range: RANGES[r], fill: FILLS[f], target: TARGETS[x], name: `${RANGES[r]} ${FILLS[f]} ${TARGETS[x]}` }; }

// ---- the sequence (closed candles only). F: { '15m', '4h' } bars { t, o, h, l, c, e }. ---------------------------------------
// Each: { d (+1 buy / -1 sell), jb (break candle), jc (confirmation candle), ts (its close = the order's time), level, ext,
//         stop, built, visit, zAt }
export function sequences(F) {
  const T = F['15m'], atr = atr14(T), ev = K.structure(T, KSW).events, zones = buildZones('eg', F['4h']);
  const out = [], seen = new Set(), meta = { zones: zones.length, visits: 0, breaks: 0, found: 0, extOut: 0, dup: 0 };
  const firstEv = (i) => { let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].i < i) lo = m + 1; else hi = m; } return lo; };
  for (const z of zones) {
    let k = startIdx(T, z.at), visit = 0;
    while (k < T.length && T[k].t < z.end && visit < VISITS) {
      while (k < T.length && T[k].t < z.end && !(T[k].l <= z.top && T[k].h >= z.bot)) k++;
      if (k >= T.length || T[k].t >= z.end) break;
      visit++; meta.visits++; const k0 = k, lim = k0 + WIN;
      let a = firstEv(k0); while (a < ev.length && ev[a].i < lim && ev[a].dir !== -z.d) a++;
      if (a < ev.length && ev[a].i < lim && T[ev[a].i].e < z.end) {
        meta.breaks++; const jb = ev[a].i; let b = a + 1; while (b < ev.length && ev[b].i < lim && ev[b].dir !== z.d) b++;
        if (b < ev.length && ev[b].i < lim && T[ev[b].i].e < z.end) {
          const E = ev[b], jc = E.i; let ext = z.d > 0 ? Infinity : -Infinity;
          for (let j = jb; j <= jc; j++) ext = z.d > 0 ? Math.min(ext, T[j].l) : Math.max(ext, T[j].h);
          if (z.d > 0 ? ext > z.top : ext < z.bot) meta.extOut++;
          else if (!(atr[jc] > 0)) { /* warm-up */ }
          else { const key = jc + '|' + z.d;
            if (seen.has(key)) meta.dup++;
            else { seen.add(key); meta.found++;
              out.push({ d: z.d, jb, jc, ts: T[jc].e, level: E.level, ext, stop: ext - z.d * ATRK * atr[jc], built: E.from >= jb, visit, zAt: z.at }); } }
        }
      }
      while (k < T.length && T[k].t < z.end && T[k].l <= z.top && T[k].h >= z.bot) k++;
      k++;
    }
  }
  out.sort((p, q) => p.ts - q.ts || p.d - q.d);
  return { list: out, meta };
}

// ---- the resting limit: the first 5-minute candle starting in [t0, expire) that trades to the level (thr = 0: a touch) or
// through it by thr; filled at the level, at the open when the candle opens beyond it. Returns { fi, fill } or null. -----------
export function fillOf(M5, s, level, t0, expire, thr = 0) {
  for (let i = startIdx(M5, t0); i < M5.length && M5[i].t < expire; i++) { const b = M5[i];
    if (s > 0 ? b.l <= level - thr : b.h >= level + thr) return { fi: i, fill: s > 0 ? Math.min(b.o, level) : Math.max(b.o, level) }; }
  return null;
}
// ---- one filled limit, several R targets in one pass. On the fill candle only the stop can be hit; after it a candle that
// opens beyond the stop or a target exits at its open; stop first when one candle holds both; time limit at a candle's close. --
export function manage(M5, s, fi, fill, stop, ks, cap = CAP) {
  const risk = s * (fill - stop); if (!(risk > 0)) return null;
  const tg = ks.map((k) => fill + s * k * risk), R = ks.map(() => NaN), dl = M5[fi].t + cap; let left = ks.length;
  const fin = (k, px) => { if (Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) tg.forEach((_, k) => fin(k, b.o)); else tg.forEach((x, k) => { if (s * (b.o - x) >= 0) fin(k, b.o); }); }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) tg.forEach((_, k) => fin(k, stop));
    if (j > fi) tg.forEach((x, k) => { if (s * ((s > 0 ? b.h : b.l) - x) >= 0) fin(k, x); });
    if (b.e >= dl) tg.forEach((_, k) => fin(k, b.c)); }
  return left ? null : { fill, risk, R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const { list, meta } = sequences(F), cost = COSTS[market], X = exclusions(market), A = newAcc();
  const fun = { nofill: [0, 0], filled: [0, 0], outside: [0, 0], dropped: [0, 0], bad: [0, 0], small: [0, 0], open: [0, 0] };
  for (const g of list) {
    const s = g.d, expire = g.ts + LIFE * 900;
    for (let f = 0; f < 2; f++) {
      const q = fillOf(M5, s, g.level, g.ts, expire, f ? cost / 2 : 0);
      if (!q) { fun.nofill[f]++; continue; }
      const t = M5[q.fi].t; if (t < FROM || t >= TO) { fun.outside[f]++; continue; }
      if (X.length && inBad(X, t)) { fun.dropped[f]++; continue; }
      const risk = s * (q.fill - g.stop);
      if (!(risk > 0)) { fun.bad[f]++; continue; }
      if (risk < cost) { fun.small[f]++; continue; }
      if (!(s * (q.fill - g.stop) > 0)) throw new Error('stop on the wrong side');
      const r = manage(M5, s, q.fi, q.fill, g.stop, [1, 2]);
      if (!r) { fun.open[f]++; continue; }
      fun.filled[f]++; const cr = cost / risk, m = monthOf(t), w = t < SPLIT ? 0 : 1;
      for (let x = 0; x < 2; x++) { add(A, cellIndex(0, f, x), w, m, r.R[x], cr); if (g.built) add(A, cellIndex(1, f, x), w, m, r.R[x], cr); }
    }
  }
  return { market, cost, first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, meta, orders: list.length,
    built: list.filter((g) => g.built).length, funnel: fun, acc: Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))])) };
}

// ---- cut test: the orders known by a date, computed on candles cut there, equal the full run's ------------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.d, g.ts, g.level, g.stop.toFixed(10), g.built, g.jb].join('|');
  const full = sequences(frames(M5)).list; const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = sequences(frames(M5.filter((b) => b.e <= T))).list.filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const P = new Set(cut), Q = new Set(want);
    out.push({ market, cut: c, n: Q.size, missing: [...Q].filter((k) => !P.has(k)).length, extra: [...P].filter((k) => !Q.has(k)).length }); }
  return out;
}

// ---- pooled statistics --------------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.meanNet > 0 && x.c.meanNet > 0 && x.d.tNet >= 2 && x.c.tNet >= 2 && h < 0.05;
export function judge(data) {
  const A = pool(data), rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(A, c); rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.tNet, s.c.months - 1) }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.meanNet > 0 && r.d.tNet >= 2, conf: r.c.meanNet > 0 && r.c.tNet >= 2, holm: H[i] < 0.05 };
    r.pass = passOf(r, H[i]); });
  return rows;
}
export const verdictOf = (rows) => (rows.some((r) => r.pass) ? 'PASS' : rows.some((r) => r.d.n >= 300 && r.c.n >= 300) ? 'FAIL' : 'INCONCLUSIVE');

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(6), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), verdict = verdictOf(rows), pass = rows.filter((r) => r.pass);
  const best = [...(pass.length ? pass : rows)].sort((a, b) => b.c.tNet - a.c.tNet)[0];
  const headline = `${pass.length} of 8 cells pass; the best cell, ${best.name}, made ${f3(best.c.meanNet)}R a trade after costs in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)}; `
    + `before costs ${f3(best.c.mean)}R, t ${f2(best.c.t)}) and ${f3(best.d.meanNet)}R after costs in 2005-14 (n ${N(best.d.n)}, month t ${f2(best.d.tNet)}; before costs ${f3(best.d.mean)}R, t ${f2(best.d.t)})`;
  const perMarket = data.map((d) => ({ market: d.market, cells: rows.map((r) => { const s = cellStats(pool([d]), r.cell); return { cell: r.name, d: slim(s.d), c: slim(s.c) }; }) }));
  const out = { study: 'h4eg-m15-range-cf', built: '2026-11-24', verdict, headline, basis: 'judged after costs on calendar-month sums (pre-registered); before costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      ...d.meta, orders: d.orders, built: d.built, funnel: d.funnel })),
    passed: pass.map((r) => r.name), best: best.name, cut,
    cells: rows.map((r) => ({ cell: r.name, range: r.range, fill: r.fill, target: r.target, disc: slim(r.d), conf: slim(r.c), p: +r.p.toFixed(6), holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass })),
    perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), cnt = (f) => o.cells.filter(f).length, L = [];
  const b = o.cells.find((c) => c.cell === o.best);
  L.push('# H4 engulf zone, then on M15 a break, a range at the extreme and a confirmation break back (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing',
    'is proposed. One run, no variants.', '',
    '## What was run', '',
    'Key level: an H4 engulf zone (`combo-grid-3` `buildZones(\'eg\')`, imported). At its first or second visit, within 64 M15',
    'candles: the first M15 structure break AGAINST the zone, then the first M15 structure break back WITH it (the confirmation);',
    'the range runs from the extreme made between the two to the level the confirmation closed beyond. A resting limit at that',
    'level for 6 hours, stop past the extreme by 0.1 ATR(14) of M15, target 1R or 2R, 2-day limit. Fill on a touch, or only when',
    'price trades through the level by half the round trip. "built" = the level is a swing made after the break (the range was',
    'built at the extreme); "any" = every sequence. Five markets pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute',
    'candles, discovery = fills 2005-2014, confirmation = 2015 to October 2026. Judged after costs on calendar-month sums; Holm',
    'over the 8 confirmation tests.', '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((c) => c.checks.n)} of 8.`,
    `- After-cost mean R > 0 and month t >= 2 in discovery: ${cnt((c) => c.checks.disc)}; in confirmation: ${cnt((c) => c.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((c) => c.checks.holm)}.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`, '',
    '## Every cell', '',
    'R a trade (month-sum t): before costs, then after costs; "cost R" = mean round-trip cost / risk; win = share of trades with R > 0 before costs.', '',
    '| Cell | n 05-14 | before 05-14 (t) | after 05-14 (t) | n 15-26 | before 15-26 (t) | after 15-26 (t) | win 15-26 | cost R 15-26 | Holm | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const c of o.cells) L.push(`| ${c.cell} | ${N(c.disc.n)} | ${f3(c.disc.mean)} (${f2(c.disc.t)}) | ${f3(c.disc.meanNet)} (${f2(c.disc.tNet)}) | ${N(c.conf.n)} | ${f3(c.conf.mean)} (${f2(c.conf.t)}) | ${f3(c.conf.meanNet)} (${f2(c.conf.tNet)}) | ${c.conf.win == null ? 'n/a' : (c.conf.win * 100).toFixed(0) + '%'} | ${c.conf.costR == null ? 'n/a' : c.conf.costR.toFixed(3)} | ${c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('', '## Per market', '', 'After-cost R a trade (n) in 2005-14 | 2015-26, per cell.', '',
    '| Cell | ' + o.perMarket.map((m) => m.market).join(' | ') + ' |', '|---|' + o.perMarket.map(() => '---:').join('|') + '|');
  o.cells.forEach((c, i) => L.push(`| ${c.cell} | ` + o.perMarket.map((m) => { const x = m.cells[i]; return `${f3(x.d.meanNet)} (${N(x.d.n)}) \\| ${f3(x.c.meanNet)} (${N(x.c.n)})`; }).join(' | ') + ' |'));
  L.push('', '## The funnel', '',
    'Orders = sequences found (one per confirmation candle and side). Counts for the touch fill / the trade-through fill.', '',
    '| Market | candles from | H4 zones | visits read | with a break against | orders | of them "built" | not filled | filled and resolved | past the stop | risk under cost | bad data | open at data end |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const two = (a) => `${N(a[0])} / ${N(a[1])}`;
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.zones)} | ${N(m.visits)} | ${N(m.breaks)} | ${N(m.orders)} | ${N(m.built)} | ${two(m.funnel.nofill)} | ${two(m.funnel.filled)} | ${two(m.funnel.bad)} | ${two(m.funnel.small)} | ${two(m.funnel.dropped)} | ${two(m.funnel.open)} |`);
  L.push('', '## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'no market'}: ${N(nCut)} orders known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of its fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- On the fill candle only the stop can be hit; a candle holding stop and target is a stop.',
    '- When two zones reach the same confirmation candle and side, the reading of the zone listed first (the earlier engulf) is kept.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cell(s) clear the pre-registered bar after costs in both windows. That is a hypothesis for a holdout on markets and`,
    'years this run did not read, nothing more: it is not adopted, not a rule, and no live change follows from it.');
  else if (o.verdict === 'INCONCLUSIVE') L.push('No cell has 300 trades in each window: too few trades to judge. Nothing is concluded and nothing live changed.');
  else L.push(`No cell clears the bar. The best cell (${b.cell}) made ${f3(b.conf.mean)}R a trade before costs and ${f3(b.conf.meanNet)}R after costs in`,
    `2015-26, and ${f3(b.disc.mean)}R / ${f3(b.disc.meanNet)}R in 2005-14. Waiting for the range and the confirmation break at an H4 engulf zone and`,
    'resting a limit at the confirmation level does not make money after costs on these five markets. This sequence at an H4',
    'engulf zone is closed on these years: no variant of these 8 cells is re-tested on them. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'orders', r.orders, JSON.stringify(r.funnel), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
