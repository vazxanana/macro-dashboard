// Edge research · vb-stop-place: the gold and USD/JPY volatility breakouts (T1) with the stop at the open (the rule) against three
// other stop places (half way to the trigger, 1 x ATR(14) of H1 from the fill, the opposite trigger), R on each variant's own
// opening risk, the rule's own exits, after costs that grow in R as the stop tightens (PREREGISTRATION.md, pushed alone first).
// Paper research only: nothing is adopted and nothing live changes.
//   node research/edge/vb-stop-place/run.mjs        (candles: research/edge/_lib/edgekit.mjs load(<market>, '5m'), out of git)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from '../index-vol-breakout/original.mjs';
import { medRange } from '../gold-vol-breakout-hourcost/costs.mjs';
import { costPx } from '../fx-vol-breakout/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';
import { load, resample } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHA = {
  'index-vol-breakout/original.mjs': 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f',
  'gold-vol-breakout-hourcost/result.json': 'fd5990419496374fd1d7c1791f778bd250d1b350064e7386d18de8a82b38325b',
};
export const K = 0.5, ATR_N = 14, SLIP = 0.05, EXIT_HOUR = 20, SEEDS = 40, H = 3600;
export const VARIANTS = ['A', 'B', 'C'], ALL = ['O', ...VARIANTS];
export const NAME = { O: 'O: stop at the open (rule)', A: 'A: half way open → trigger', B: 'B: 1 x ATR(14) H1 from the fill', C: 'C: the opposite trigger' };
export const WIN = { xau: { early: ['2007-01-01', '2014-12-31'], late: ['2015-01-01', '2026-11-20'] }, usdjpy: { early: ['2005-01-04', '2014-12-31'], late: ['2015-01-01', '2026-11-20'] } };
export const GATE = {
  xau: { W1: [['2007-01-01', '2011-12-31'], 929, 0.202, 4.93], W2: [['2012-01-01', '2015-12-31'], 728, 0.17, 2.93], W3: [['2016-01-01', '2020-12-31'], 935, 0.094, 2.41], W4: [['2021-01-01', '2026-11-12'], 1121, 0.105, 2.79], POOLED: [['2007-01-01', '2026-11-12'], 3713, 0.139, 6.47] },
  usdjpy: { early: [['2005-01-04', '2015-12-31'], 2089, 0.079, null], late: [['2016-01-01', '2026-11-19'], 2079, 0.063, null] },
};
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// ─── ATR(14) of H1 candles that ended by t ───
export function atrIndex(bars5) {
  const h1 = resample(bars5, H), ends = h1.map((b) => b.e), tr = [0];
  for (let i = 1; i < h1.length; i++) { const p = h1[i - 1].c, b = h1[i]; tr.push(Math.max(b.h - b.l, Math.abs(b.h - p), Math.abs(b.l - p))); }
  const pre = [0]; for (const v of tr) pre.push(pre.at(-1) + v);
  return (t) => {          // number of H1 candles with e <= t (binary search), then the mean TR of the last 14 (needs 15 candles)
    let lo = 0, hi = ends.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ends[m] <= t) lo = m + 1; else hi = m; }
    if (lo < ATR_N + 1) return null;
    return (pre[lo] - pre[lo - ATR_N]) / ATR_N;
  };
}

// ─── the stop of each variant for one T1 fill ───
export function stopOf(v, x, atr) {
  if (v === 'O') return x.open;
  if (v === 'A') return x.side > 0 ? (x.open + x.up) / 2 : (x.open + x.dn) / 2;
  if (v === 'B') return atr > 0 ? x.entry - x.side * atr : null;
  if (v === 'C') return x.side > 0 ? x.dn : x.up;
  throw new Error('variant ' + v);
}
// the rule's management for a given stop: fill candle i checked worst case, then open beyond / touch / 20:55 close
export function manage(bars, i, side, entry, stop, fillCandleChecked = true) {
  const b0 = bars[i];
  if (fillCandleChecked && (side > 0 ? b0.l <= stop : b0.h >= stop)) return { exit: stop, how: 'stop', t: b0.t };
  for (let j = fillCandleChecked ? i + 1 : i; j < bars.length; j++) {
    const b = bars[j];
    if (side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', t: b.t };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { exit: stop, how: 'stop', t: b.t };
  }
  const b = bars.at(-1); return { exit: b.c, how: 'time', t: b.t + 300 };
}

// ─── costs (in price; R = price / r of the variant) ───
export function costerOf(market, hc) {
  if (market === 'xau') {
    const prof = hc.profile, comm = hc.commission;
    return (x) => (0.5 * prof[Math.floor(x.fillMin / 60)].frac + 0.5 * prof[EXIT_HOUR].frac + comm) * x.entry + SLIP * x.M;
  }
  return (x) => costPx('usdjpy', x.entry);
}
export function price(market, x, y, stop, cost) {
  const r = Math.abs(x.entry - stop), R = x.side * (y.exit - x.entry) / r;
  const fin = market === 'xau' && x.side > 0 ? nights(x.fillT, y.t) * FIN.xau.long * x.entry / r : 0;
  return { r, R, finR: fin, how: y.how, exit: y.exit, net: R - fin - cost / r, net2: R - 2 * fin - 2 * cost / r };
}

// every T1 day with the four variants (a day without ATR history is skipped for all four)
export function tradesOf(market, days, atrAt, cost) {
  const out = [];
  for (const d of days) {
    if (O.daySkip(d)) continue;
    const x = O.vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (x.skip) continue;
    const i = d.bars.findIndex((b) => b.t === x.fillT), xx = { ...x, M: medRange(d.bars, i) }, c = cost(xx), atr = atrAt(x.fillT);
    const row = { day: d.day, side: x.side, vb: x, atrOk: atr != null, m: {} };
    for (const v of ALL) {
      const s = stopOf(v, x, atr); if (s == null) { row.m[v] = null; continue; }
      const y = manage(d.bars, i, x.side, x.entry, s);
      row.m[v] = { day: d.day, side: x.side, ...price(market, x, y, s, c), rO: Math.abs(x.entry - x.open) };
    }
    out.push(row);
  }
  return out;
}
// placebo: the parent studies' random entry and side (same rand() order), stops at fixed distances / ATR
export function placeboOf(market, days, atrAt, cost, seed) {
  const P = days.filter((d) => !O.daySkip(d)), grid = (18 * H - H) / 300 + 1, rand = O.rng(seed), out = [];
  for (const d of P) {
    const startT = d.d0 + H + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
    const i = d.bars.findIndex((b) => b.t >= startT); if (i < 0) continue;
    const entry = d.bars[i].o, atr = atrAt(d.bars[i].t); if (atr == null) continue;
    const dist = { O: 0.5 * d.prevRange, A: 0.25 * d.prevRange, B: atr, C: 1.0 * d.prevRange };
    const x = { side, entry, fillT: d.bars[i].t, fillMin: (d.bars[i].t - d.d0) / 60, M: medRange(d.bars, i) }, c = cost(x), row = { day: d.day, m: {} };
    for (const v of ALL) { const s = entry - side * dist[v]; row.m[v] = price(market, x, manage(d.bars, i, side, entry, s, false), s, c); }
    out.push(row);
  }
  return out;
}

// ─── statistics ───
export function cell(tr) {
  const mt = O.monthT(tr), gt = O.monthT(tr, 'R');
  let eq = 0, pk = 0, dd = 0; for (const x of tr) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), grossR: r3(mean(tr.map((x) => x.R))), netR: r3(mean(tr.map((x) => x.net))),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.finR - x.net))), t: r2(mt.t), grossT: r2(gt.t), months: mt.months,
    stopped: r3(tr.filter((x) => x.how === 'stop').length / (tr.length || 1)), maxDD: r2(dd), total: r2(eq),
    sameSize: r3(mean(tr.map((x) => x.net * x.r / x.rO))) };
}
export const diffs = (rows, v) => rows.map((x) => ({ day: x.day, d: x.m[v].net - x.m.O.net }));
export function diffStats(rows, v) { const ds = diffs(rows, v), mt = O.monthT(ds, 'd'); return { n: ds.length, meanD: r3(mean(ds.map((x) => x.d))), monthT: r2(mt.t), tRaw: mt.t }; }
export function decide(E, L, v) {
  const c1 = E.diff[v].meanD > 0 && L.diff[v].meanD > 0, c2 = L.diff[v].monthT >= 2, c3 = E.cell[v].netR > 0 && L.cell[v].netR > 0 && L.cell[v].t >= 2;
  const c4 = E.cell[v].n >= 200 && L.cell[v].n >= 200;
  return { c1, c2, c3, c4 };
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const L = ['# The volatility breakouts: where should the stop go? (vb-stop-place, 24 Nov 2026)', '', `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Variants, costs, windows, tests and bar were fixed in `PREREGISTRATION.md` (pushed alone before any moved-stop figure was computed; sha256 in `result.json`). The rule\'s functions come unchanged from `index-vol-breakout/original.mjs`; gold is charged `gold-vol-breakout-hourcost`\'s C1 (frozen from its result.json), USD/JPY `fx-vol-breakout`\'s cost. Each variant\'s R is on its own opening risk and its cost in R is cost / its own risk. **Nothing is adopted and nothing live changed.**', '',
    `Gates: gold O reproduces hourcost's C1 grid (${Object.entries(R.gate.xau).map(([w, g]) => `${w} n ${g.got[0]} ${sg(g.got[1])} t ${sg(g.got[2], 2)}`).join('; ')}): ${R.gate.okXau ? 'yes' : 'no'}; USD/JPY O reproduces usdjpy-vb-exit (${Object.entries(R.gate.usdjpy).map(([w, g]) => `${w} n ${g.got[0]} ${sg(g.got[1])}`).join('; ')}): ${R.gate.okJpy ? 'yes' : 'no'}; the walker with the open stop equals vbTrade on ${R.gate.same} of ${R.gate.of} trades. Days without 15 closed H1 candles before the fill: ${R.gate.noAtr} (dropped for all four).`, ''];
  for (const mk of ['xau', 'usdjpy']) {
    const M = R.markets[mk], W = WIN[mk];
    L.push(`## ${mk === 'xau' ? 'Gold' : 'USD/JPY'}`, '', '| Variant | Window | n | Win | Gross R | Net R | Net 2x | Cost R | Month t | Stopped | Max DD R | Same-size net (rule distances) | d vs O | Month t of d |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const v of ALL) for (const w of ['early', 'late']) {
      const c = M[w].cell[v], dd = M[w].diff[v];
      L.push(`| ${NAME[v]} | ${W[w].join(' → ')} | ${c.n} | ${(c.win * 100).toFixed(1)} % | ${sg(c.grossR)} | ${sg(c.netR)} | ${sg(c.net2R)} | ${sg(c.costR)} | ${sg(c.t, 2)} | ${(c.stopped * 100).toFixed(0)} % | ${sg(c.maxDD, 1)} | ${sg(c.sameSize)} | ${v === 'O' ? '—' : sg(dd.meanD)} | ${v === 'O' ? '—' : sg(dd.monthT, 2)} |`);
    }
    L.push('');
  }
  L.push('## Tests (Holm over six, one-sided p of the confirmation month t of d)', '', '| Market | Variant | d discovery | d confirmation | Month t of d | p | Holm p | (1) d > 0 both | (2) t ≥ 2, Holm | (3) net > 0 both, t ≥ 2 | (4) n ≥ 200 | Reading |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of R.tests) L.push(`| ${t.market} | ${t.v} | ${sg(t.dE)} | ${sg(t.dL)} | ${sg(t.tL, 2)} | ${t.p} | ${t.pHolm} | ${t.c1 ? 'yes' : 'no'} | ${t.c2 && t.pHolm < 0.05 ? 'yes' : 'no'} | ${t.c3 ? 'yes' : 'no'} | ${t.c4 ? 'yes' : 'no'} | **${t.label}** |`);
  L.push('', '## Control: the same stop places on random entries (40 seeds, whole span, not in the verdict)', '', '| Market | Variant | T1 d (pooled) | Placebo d, median | 5-95 % over seeds | T1 inside the band |', '|---|---|---|---|---|---|');
  for (const mk of ['xau', 'usdjpy']) for (const v of VARIANTS) { const p = R.placebo[mk][v]; L.push(`| ${mk} | ${v} | ${sg(R.pooledD[mk][v])} | ${sg(p.median)} | ${sg(p.q05)} … ${sg(p.q95)} | ${p.inside ? 'yes' : 'no'} |`); }
  L.push('', '**What it says.** ' + R.text, '', `Data: ${R.data}. "Same-size net" = the variant's net P&L per trade in units of the rule's own stop distance (equal position size, not equal risk); described, not tested. Cautions: today's demo cost on every past year; gold stop slippage modelled (0.05 x M), not measured; OANDA mid candles are not broker fills; a stop reached inside the fill candle is taken (worst case), which counts against the tighter stops; both windows were read before for the rule itself.`, '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [f, h] of Object.entries(SHA)) if (crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', f))).digest('hex') !== h) throw new Error(f + ' changed');
  const hc = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'gold-vol-breakout-hourcost', 'result.json'), 'utf8'));
  const R = { study: 'vb-stop-place', built: '2026-11-24', preregistration: 'research/edge/vb-stop-place/PREREGISTRATION.md',
    planSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex'),
    windows: WIN, k: K, gate: { xau: {}, usdjpy: {}, same: 0, of: 0, noAtr: 0 }, markets: {}, placebo: {}, pooledD: {} };
  const data = [];
  for (const mk of ['xau', 'usdjpy']) {
    const bars = load(mk, '5m', { from: mk === 'xau' ? '2006-03-01' : '2004-11-01', to: '2026-11-21' });
    const rows = bars.map((b) => [b.t, b.o, b.h, b.l, b.c]), days = O.buildDays(rows), atrAt = atrIndex(bars), cost = costerOf(mk, hc);
    data.push(`${mk} ${new Date(rows[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10)} (${rows.length} M5 candles)`);
    const all = tradesOf(mk, days, atrAt, cost);
    // gates: O on every T1 day (before the ATR drop)
    for (const [w, [win, n, net, t]] of Object.entries(GATE[mk])) {
      const c = cell(all.filter((x) => inW(x.day, win)).map((x) => x.m.O));
      const got = [c.n, c.netR, c.t], ok = c.n === n && c.netR === net && (t == null || c.t === t);
      R.gate[mk][w] = { got, want: [n, net, t], ok };
    }
    for (const x of all) { R.gate.of++; if (x.m.O.exit === x.vb.exit && x.m.O.how === x.vb.how && Math.abs(x.m.O.R - x.vb.R) < 1e-12) R.gate.same++; }
    const kept = all.filter((x) => x.atrOk); R.gate.noAtr += all.length - kept.length;
    const winOf = (w) => { const rs = kept.filter((x) => inW(x.day, WIN[mk][w])); return { cell: Object.fromEntries(ALL.map((v) => [v, cell(rs.map((x) => x.m[v]))])), diff: Object.fromEntries(VARIANTS.map((v) => [v, diffStats(rs, v)])) }; };
    R.markets[mk] = { early: winOf('early'), late: winOf('late') };
    const span = kept.filter((x) => inW(x.day, [WIN[mk].early[0], WIN[mk].late[1]]));
    R.pooledD[mk] = Object.fromEntries(VARIANTS.map((v) => [v, r3(mean(diffs(span, v).map((x) => x.d)))]));
    const per = Object.fromEntries(VARIANTS.map((v) => [v, []])), pDays = days.filter((d) => inW(d.day, [WIN[mk].early[0], WIN[mk].late[1]]));
    for (let s = 1; s <= SEEDS; s++) { const P = placeboOf(mk, pDays, atrAt, cost, s); for (const v of VARIANTS) per[v].push(mean(diffs(P, v).map((x) => x.d))); }
    R.placebo[mk] = Object.fromEntries(VARIANTS.map((v) => { const q05 = O.quantile(per[v], 0.05), q95 = O.quantile(per[v], 0.95); return [v, { median: r3(O.quantile(per[v], 0.5)), q05: r3(q05), q95: r3(q95), inside: R.pooledD[mk][v] >= q05 && R.pooledD[mk][v] <= q95 }]; }));
    console.log(mk, 'gate', JSON.stringify(R.gate[mk]));
  }
  R.gate.okXau = Object.values(R.gate.xau).every((g) => g.ok); R.gate.okJpy = Object.values(R.gate.usdjpy).every((g) => g.ok);
  const gateOk = R.gate.okXau && R.gate.okJpy && R.gate.same === R.gate.of;
  if (!gateOk) { console.log('GATE FAILED', JSON.stringify(R.gate)); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...R, verdict: 'STOPPED: a gate failed' }, null, 1) + '\n'); process.exit(2); }
  const tests = [];
  for (const mk of ['xau', 'usdjpy']) for (const v of VARIANTS) { const E = R.markets[mk].early, Lt = R.markets[mk].late; tests.push({ market: mk, v, dE: E.diff[v].meanD, dL: Lt.diff[v].meanD, tL: Lt.diff[v].monthT, p: O.normP(Lt.diff[v].tRaw), ...decide(E, Lt, v) }); }
  const adj = O.holm(tests.map((t) => t.p));
  tests.forEach((t, i) => { t.pHolm = r3(adj[i]); t.p = r3(t.p); t.improves = t.c1 && t.c2 && adj[i] < 0.05 && t.c3 && t.c4; t.label = t.improves ? 'IMPROVES' : t.tL <= -2 ? 'WORSE' : 'NO BETTER'; });
  R.tests = tests;
  const imp = tests.filter((t) => t.improves), mkName = { xau: 'gold', usdjpy: 'USD/JPY' };
  R.pass = imp.length > 0;
  R.verdict = `${R.pass ? 'PASS' : 'FAIL'}: ${imp.length} of 6 stop places beat the stop at the open after costs; d vs the open stop a trade (discovery / confirmation, month t of d in confirmation): `
    + tests.map((t) => `${mkName[t.market]} ${t.v} ${sg(t.dE)} / ${sg(t.dL)} (t ${sg(t.tL, 2)}, ${t.label})`).join('; ')
    + `; rule ${['xau', 'usdjpy'].map((m) => `${mkName[m]} ${sg(R.markets[m].early.cell.O.netR)} / ${sg(R.markets[m].late.cell.O.netR)}R`).join(', ')}`;
  const line = (m) => ALL.map((v) => `${v} ${sg(R.markets[m].early.cell[v].netR)} / ${sg(R.markets[m].late.cell[v].netR)}R (gross ${sg(R.markets[m].late.cell[v].grossR)}, cost ${sg(R.markets[m].late.cell[v].costR)}, t ${sg(R.markets[m].late.cell[v].t, 2)})`).join(', ');
  R.text = `Net R a trade, discovery / confirmation (confirmation gross, cost in R, month t): gold ${line('xau')}; USD/JPY ${line('usdjpy')}. `
    + `Control, mean d on random entries (median over 40 seeds): ${['xau', 'usdjpy'].map((m) => VARIANTS.map((v) => `${mkName[m]} ${v} ${sg(R.placebo[m][v].median)} (T1 ${sg(R.pooledD[m][v])})`).join(', ')).join('; ')}. `
    + (R.pass ? `By the pre-registered bar ${imp.map((t) => mkName[t.market] + ' ' + t.v).join(', ')} beat the open stop on years already read for the rule: a candidate for a forward record, not a change made here. ` : 'No stop place meets the pre-registered bar: the rule keeps its stop at the open. ')
    + `Described, not tested: at equal position size (not equal risk) the opposite-trigger stop C nets ${sg(R.markets.xau.late.cell.C.sameSize)} of the rule's distance a trade on gold in confirmation against ${sg(R.markets.xau.late.cell.O.sameSize)} (USD/JPY ${sg(R.markets.usdjpy.late.cell.C.sameSize)} against ${sg(R.markets.usdjpy.late.cell.O.sameSize)}), but it risks about twice the money a trade, so at equal risk it is worse; it does cut the drawdown in R (gold ${sg(R.markets.xau.late.cell.C.maxDD, 1)} against ${sg(R.markets.xau.late.cell.O.maxDD, 1)}R). The tighter stops (A, B) are stopped far more often and pay two to three times the cost in R. `
    + 'Paper research; nothing live changes and no proposal is written.';
  R.data = 'OANDA mid M5 from the shared candle cache (edgekit): ' + data.join('; ');
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(R.verdict);
}
