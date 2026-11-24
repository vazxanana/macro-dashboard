// research/edge/d1-dom-h1-ef/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): a Daily dominant zone as the key
// level; on price's FIRST return an H1 engulf of the other side that FAILS (a later H1 close through it) is the entry with
// the zone; market at the next 5-minute open, stop past the extreme made at the zone, targets 1R / 2R / 3R. 12 cells, five
// markets pooled, discovery 2005-14, confirmation 2015 to Oct 2026, judged AFTER costs on calendar-month sums.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/d1-dom-h1-ef/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/d1-dom-h1-ef/run.mjs cut <m> <outDir>
//   node research/edge/d1-dom-h1-ef/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { exits } from '../grid7-wide-fade/run.mjs';
import { zones as egZones } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const LOCS = ['visit', 'any'], WINS = [12, 24], RS = [1, 2, 3], ATRK = 0.1, CAP = 10 * 86400, WMAX = 24;
export const NCELL = 12;
export const cellIndex = (loc, w, x) => (loc * 2 + w) * 3 + x;
export function cellName(i) { const x = i % 3; i = (i - x) / 3; const w = i % 2, loc = (i - w) / 2;
  return { loc: LOCS[loc], win: WINS[w], exit: RS[x] + 'R', name: `${LOCS[loc]} W${WINS[w]} ${RS[x]}R` }; }

const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// ---- signals. F: { '1h': [...], '1d': [...] } (edgekit candles { t, o, h, l, c, e }). One row per Daily zone and engulf
// rule (loc 0 = visit, 1 = any): { loc, k (H1 candles after the touch candle; < 12 belongs to W12 too), ts (decision time =
// the failing H1 candle's close), d (the zone's side = the trade's), ext (the extreme made at the zone), a (H1 ATR14),
// zat (when the zone was known), touch (the touch candle's start) }. Only candles closed by ts are read.
export function signals(F) {
  const H = F['1h'], D = F['1d'], A = atr14(H), out = [];
  // failed H1 engulfs by the index of the failing candle: trade side = the other side of the engulf
  const efAt = new Map();
  for (const z of egZones(conv(H), '1h')) { if (z.fail == null) continue; let L = efAt.get(z.fi); if (!L) efAt.set(z.fi, (L = [])); L.push({ d: -z.dir, i: z.i }); }
  const stats = { zones: 0, touched: 0 };
  let p = 0;
  for (const z of buildZones('dom', D)) { stats.zones++;
    while (p < H.length && H[p].t < z.at) p++;
    let ti = -1;
    for (let j = p; j < H.length && H[j].t < z.end; j++) if (z.d > 0 ? H[j].l <= z.top : H[j].h >= z.bot) { ti = j; break; }
    if (ti < 0) continue; stats.touched++;
    const done = [false, false]; let ext = z.d > 0 ? Infinity : -Infinity;
    for (let j = ti; j < H.length && j < ti + WMAX && !(done[0] && done[1]); j++) { const b = H[j];
      if (b.e > z.end) break;
      ext = z.d > 0 ? Math.min(ext, b.l) : Math.max(ext, b.h);
      if (z.d > 0 ? b.c < z.bot : b.c > z.top) break;                        // a close beyond the far side ends the visit
      const L = efAt.get(j); if (!L) continue;
      for (let loc = 0; loc < 2; loc++) { if (done[loc]) continue;
        if (!L.some((e) => e.d === z.d && (loc === 1 || e.i >= ti))) continue;
        done[loc] = true; out.push({ loc, k: j - ti, ts: b.e, d: z.d, ext, a: A[j], zat: z.at, touch: H[ti].t, top: z.top, bot: z.bot }); } }
  }
  out.sort((x, y) => x.ts - y.ts || x.loc - y.loc); out.stats = stats;
  return out;
}
export const stopOf = (g, cost) => g.ext - g.d * (cost / 2 + ATRK * g.a);

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const trade = newAcc(), mirr = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0;
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, s = g.d, stop = stopOf(g, cost), risk = s * (fill - stop);
    if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(s > 0 ? stop < fill : stop > fill)) throw new Error('stop on the wrong side');
    const r = exits(M5, s, fi, stop, RS.map((k) => fill + s * k * risk), CAP);
    const q = exits(M5, -s, fi, fill + s * risk, RS.map((k) => fill - s * k * risk), CAP); sims++;
    if (!r || !q) { open++; continue; }
    const cr = cost / risk, m = monthOf(t), w = t < SPLIT ? 0 : 1;
    for (let wi = 0; wi < 2; wi++) { if (g.k >= WINS[wi]) continue;
      for (let x = 0; x < 3; x++) { const c = cellIndex(g.loc, wi, x); add(trade, c, w, m, r.R[x], cr); add(mirr, c, w, m, q.R[x], cr); } }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, zones: sigs.stats.zones, touched: sigs.stats.touched,
    signals: sigs.length, sims, dropped, bad, small, open, trade: J(trade), mirror: J(mirr) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ----------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.loc, g.k, g.ts, g.d, g.ext, g.a.toFixed(10), g.zat].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ------------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
// the pre-registered bar, AFTER costs
export const passOf = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.meanNet > 0 && x.c.meanNet > 0 && x.d.tNet >= 2 && x.c.tNet >= 2 && h < 0.05;
export function judge(data) {
  const T = pool(data, 'trade'), M = pool(data, 'mirror'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(T, c), ms = cellStats(M, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.tNet, s.c.months - 1), mir: { d: ms.d, c: ms.c } }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.meanNet > 0 && r.d.tNet >= 2, conf: r.c.meanNet > 0 && r.c.tNet >= 2, holm: H[i] < 0.05 };
    r.pass = passOf(r, H[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(6), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass);
  const enough = rows.some((r) => r.checks.n);
  const verdict = data.length < MARKETS.length ? 'INCONCLUSIVE' : pass.length ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE';
  // the best cell: the highest after-cost month t in confirmation among cells with n >= 300 in both windows (else among all)
  const cand = rows.filter((r) => r.checks.n); const best = [...(cand.length ? cand : rows)].sort((a, b) => b.c.tNet - a.c.tNet)[0];
  const b = (pass.length ? [...pass].sort((x, y) => y.c.tNet - x.c.tNet)[0] : best);
  const headline = `${pass.length} of 12 cells pass after costs; the best cell, ${b.name}, made ${f3(b.c.meanNet)}R a trade after costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.tNet)}; ${f3(b.c.mean)}R before costs; 2005-14 ${f3(b.d.meanNet)}R after costs, n ${N(b.d.n)}, month t ${f2(b.d.tNet)})`;
  const perMarket = data.map((d) => { const s = cellStats(pool([d], 'trade'), b.cell); return { market: d.market, cost: d.cost, d: slim(s.d), c: slim(s.c) }; });
  const RW = rows.map((r) => ({ cell: r.name, loc: r.loc, win: r.win, exit: r.exit, disc: slim(r.d), conf: slim(r.c), p: +r.p.toFixed(6), holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass,
    mirror: { disc: slim(r.mir.d), conf: slim(r.mir.c) } }));
  const out = { study: 'd1-dom-h1-ef', built: '2026-11-24', verdict, headline, basis: 'judged after costs on calendar-month sums (pre-registered); before costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      zones: d.zones, touched: d.touched, signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    passed: pass.map((r) => r.name), best: b.name, cut, cells: RW, bestByMarket: perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => o.cells.filter(f).length; const L = [];
  L.push('# Daily dominant zone, first return, H1 failed engulf with the zone (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed,',
    'nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Key level: a Daily dominant zone (two Daily candles of one colour, the second closing beyond the first\'s extreme; the zone',
    'is the first candle\'s body; `combo-grid-3` `buildZones(\'dom\')`). On price\'s FIRST return (the first H1 candle trading into',
    'it), within 12 or 24 H1 candles and before an H1 close beyond the zone\'s far side: an H1 engulf of the OTHER side that',
    'fails (an H1 close through it; `council/eg-methods.mjs` `zones`). "visit" = the engulf was completed during the return,',
    '"any" = whenever. Market entry with the zone at the next 5-minute open; stop past the extreme made at the zone (half the',
    'round trip + 0.1 x H1 ATR beyond it); target 1R, 2R or 3R; 10-day limit; stop first when a candle holds both. Five markets',
    `pooled (${o.markets.join(', ')}), OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026.`,
    'Judged AFTER costs (the desk\'s demo round trips) on calendar-month sums; Holm over the 12 confirmation tests.', '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 12.`,
    `- After costs, mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- **All of it: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`, '',
    '## Every cell', '',
    'R a trade before costs and after costs, each with its calendar-month-sum t; "cost R" = mean round trip / risk in 2015-26;',
    'mirror = the same fills traded AGAINST the zone (same stop distance on the other side), after costs, a control.', '',
    '| Cell | n 05-14 | gross 05-14 (t) | net 05-14 (t) | n 15-26 | gross 15-26 (t) | net 15-26 (t) | win 15-26 | cost R | Holm | Mirror net 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of o.cells) L.push(`| ${r.cell} | ${N(r.disc.n)} | ${f3(r.disc.mean)} (${f2(r.disc.t)}) | ${f3(r.disc.meanNet)} (${f2(r.disc.tNet)}) | ${N(r.conf.n)} | ${f3(r.conf.mean)} (${f2(r.conf.t)}) | ${f3(r.conf.meanNet)} (${f2(r.conf.tNet)}) | ${r.conf.win == null ? 'n/a' : (r.conf.win * 100).toFixed(0) + '%'} | ${r.conf.costR == null ? 'n/a' : r.conf.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${f3(r.mirror.conf.meanNet)} (${f2(r.mirror.conf.tNet)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', `## The best cell by market (${o.best}; no verdict)`, '', '| Market | cost | n 05-14 | gross (t) | net (t) | n 15-26 | gross (t) | net (t) |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const x of o.bestByMarket) L.push(`| ${x.market} | ${x.cost} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${f3(x.d.meanNet)} (${f2(x.d.tNet)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) | ${f3(x.c.meanNet)} (${f2(x.c.tNet)}) |`);
  L.push('', '## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'no market'}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | Daily zones | first returns | signals (both engulf rules) | simulated | dropped (bad data) | past the stop | risk under cost | unresolved at data end |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.zones)} | ${N(m.touched)} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cell(s) clear the pre-registered bar after costs in both windows. That is one study on mid candles with the`,
    'month-sum t of overlapping trades: a hypothesis for a test on other data, not a rule. Nothing is adopted; no variant will be',
    'run on these years.', '');
  else if (o.verdict === 'FAIL') L.push('No cell clears the bar: a failed H1 engulf on the first return to a Daily dominant zone does not make money after costs in',
    'both windows on these five markets. The mirror column shows what the same fills did the other way. Do not re-test variants of',
    'these 12 cells on these years. Nothing live changed; no rule is proposed.', '');
  else L.push('Too few trades to judge (no cell has 300 trades in both windows, or a market is missing from the run). Nothing is concluded.', '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'zones', r.zones, 'touched', r.touched, 'signals', r.signals, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
