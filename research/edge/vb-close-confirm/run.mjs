// Edge research · vb-close-confirm: the gold and USD/JPY volatility breakouts (T1, k 0.5) entered on the touch of the trigger
// (the rule) against an entry at the first M15 (V1) or H1 (V2) close beyond the trigger, same stop at the open, same exits,
// R on each variant's own risk, after costs (PREREGISTRATION.md, pushed alone first). Paper research only.
//   node research/edge/vb-close-confirm/run.mjs      (candles: research/edge/_lib/edgekit.mjs load(<market>, '5m'), out of git)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from '../index-vol-breakout/original.mjs';
import { medRange } from '../gold-vol-breakout-hourcost/costs.mjs';
import { costPx } from '../fx-vol-breakout/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';
import { load } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHA = {
  'index-vol-breakout/original.mjs': 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f',
  'gold-vol-breakout-hourcost/result.json': 'fd5990419496374fd1d7c1791f778bd250d1b350064e7386d18de8a82b38325b',
};
export const K = 0.5, SLIP = 0.05, EXIT_HOUR = 20, SEEDS = 40, H = 3600, DAY = 86400, EXIT_S = 21 * H;
export const VARIANTS = ['V1', 'V2'], ALL = ['V0', ...VARIANTS], SEC = { V1: 900, V2: 3600 };
export const NAME = { V0: 'V0: touch fill (rule)', V1: 'V1: first M15 close beyond the trigger', V2: 'V2: first H1 close beyond the trigger' };
export const WIN = { xau: { early: ['2007-01-01', '2014-12-31'], late: ['2015-01-01', '2026-11-20'] }, usdjpy: { early: ['2005-01-04', '2014-12-31'], late: ['2015-01-01', '2026-11-20'] } };
export const GATE = {
  xau: { early: [WIN.xau.early, 1467, 0.205], late: [WIN.xau.late, 2250, 0.098], POOLED: [['2007-01-01', '2026-11-12'], 3713, 0.139] },
  usdjpy: { early: [WIN.usdjpy.early, 1894, 0.092], late: [WIN.usdjpy.late, 2275, 0.055] },
};
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// ─── the first candle of `sec` seconds (UTC-aligned, from the day's M5 candles), from the one holding bars[i] on, whose close is
// beyond `trig` on `side`; it must end before 21:00 UTC. Returns the entry (that close), the index of the last M5 candle in it,
// and its end time; null if none. Only candles that have ENDED are read (the close is the last M5 candle's close in the bucket).
export function confirmAt(bars, i, side, trig, sec, d0) {
  let g = Math.floor(bars[i].t / sec) * sec, j = i;
  while (j > 0 && bars[j - 1].t >= g) j--;                     // start of the bucket holding bars[i]
  while (j < bars.length) {
    const end = g + sec; if (end >= d0 + EXIT_S) return null;
    let last = -1; while (j < bars.length && bars[j].t < end) { last = j; j++; }
    if (last >= 0 && side * (bars[last].c - trig) > 0) return { entry: bars[last].c, last, t: end };
    if (j >= bars.length) return null;
    g = Math.floor(bars[j].t / sec) * sec;
  }
  return null;
}
// the rule's management from candle j (no fill candle: the entry is at a close): open beyond / touch / 20:55 close
export function walkFrom(bars, j, side, stop) {
  for (let k = j; k < bars.length; k++) {
    const b = bars[k];
    if (side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', t: b.t };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { exit: stop, how: 'stop', t: b.t };
  }
  const b = bars.at(-1); return { exit: b.c, how: 'time', t: b.t + 300 };
}

// ─── costs (in price; R = price / r of the variant) ───
export function costerOf(market, hc) {
  if (market === 'xau') {
    const prof = hc.profile, comm = hc.commission;
    return (x) => (0.5 * prof[Math.min(23, Math.floor(x.fillMin / 60))].frac + 0.5 * prof[EXIT_HOUR].frac + comm) * x.entry + SLIP * x.M;
  }
  return (x) => costPx('usdjpy', x.entry);
}
export function price(market, x, y, stop, cost) {
  const r = Math.abs(x.entry - stop), R = x.side * (y.exit - x.entry) / r;
  const fin = market === 'xau' && x.side > 0 ? nights(x.fillT, y.t) * FIN.xau.long * x.entry / r : 0;
  return { r, R, finR: fin, how: y.how, exit: y.exit, net: R - fin - cost / r, net2: R - 2 * fin - 2 * cost / r };
}
// one variant's trade given the entry moment (confirmation) on day d
function confirmed(market, d, side, trig, stop, sec, cost, i0) {
  const c = confirmAt(d.bars, i0, side, trig, sec, d.d0); if (!c) return null;
  const j = c.last + 1; if (j >= d.bars.length) return null;
  const x = { side, entry: c.entry, fillT: c.t, fillMin: (c.t - d.d0) / 60, M: medRange(d.bars, c.last) };
  const y = walkFrom(d.bars, j, side, stop);
  return { day: d.day, side, fillT: c.t, delayMin: null, ...price(market, x, y, stop, cost(x)) };
}

export function tradesOf(market, days, cost) {
  const out = [];
  for (const d of days) {
    if (O.daySkip(d)) continue;
    const x = O.vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (x.skip) continue;
    const i = d.bars.findIndex((b) => b.t === x.fillT), xx = { ...x, M: medRange(d.bars, i) }, c = cost(xx);
    // V0 priced with the same function as the variants (fill candle checked worst case, then the rule's walk)
    const yy = (() => { const b0 = d.bars[i]; if (x.side > 0 ? b0.l <= x.open : b0.h >= x.open) return { exit: x.open, how: 'stop', t: b0.t }; return walkFrom(d.bars, i + 1, x.side, x.open); })();
    const row = { day: d.day, side: x.side, vb: x, m: { V0: { day: d.day, side: x.side, ...price(market, x, yy, x.open, c) } } };
    const trig = x.side > 0 ? x.up : x.dn;
    for (const v of VARIANTS) {
      const t = confirmed(market, d, x.side, trig, x.open, SEC[v], cost, i);
      if (t) t.delayMin = (t.fillT - x.fillT) / 60;
      row.m[v] = t;
    }
    out.push(row);
  }
  return out;
}
// placebo: the parent random entry and side (same rand() order as vb-stop-place), P = that candle's open, stop 0.5 x range
export function placeboOf(market, days, cost, seed) {
  const P = days.filter((d) => !O.daySkip(d)), grid = (18 * H - H) / 300 + 1, rand = O.rng(seed), out = [];
  for (const d of P) {
    const startT = d.d0 + H + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
    const i = d.bars.findIndex((b) => b.t >= startT); if (i < 0) continue;
    const entry = d.bars[i].o, stop = entry - side * 0.5 * d.prevRange;
    const x = { side, entry, fillT: d.bars[i].t, fillMin: (d.bars[i].t - d.d0) / 60, M: medRange(d.bars, i) };
    const row = { day: d.day, m: { V0: { day: d.day, ...price(market, x, walkFrom(d.bars, i, side, stop), stop, cost(x)) } } };
    for (const v of VARIANTS) row.m[v] = confirmed(market, d, side, entry, stop, SEC[v], cost, i);
    out.push(row);
  }
  return out;
}

// ─── statistics ───
export function cell(tr) {
  const mt = O.monthT(tr);
  let eq = 0, pk = 0, dd = 0; for (const x of tr) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), grossR: r3(mean(tr.map((x) => x.R))), netR: r3(mean(tr.map((x) => x.net))),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.finR - x.net))), t: r2(mt.t), months: mt.months,
    stopped: r3(tr.filter((x) => x.how === 'stop').length / (tr.length || 1)), maxDD: r2(dd), total: r2(eq),
    delayMin: r2(mean(tr.filter((x) => x.delayMin != null).map((x) => x.delayMin))) };
}
export const diffs = (rows, v) => rows.map((x) => ({ day: x.day, d: (x.m[v] ? x.m[v].net : 0) - x.m.V0.net, dg: (x.m[v] ? x.m[v].R : 0) - x.m.V0.R }));
export function diffStats(rows, v) {
  const ds = diffs(rows, v), mt = O.monthT(ds, 'd'), gt = O.monthT(ds, 'dg');
  return { n: ds.length, filled: rows.filter((x) => x.m[v]).length, meanD: r3(mean(ds.map((x) => x.d))), meanDg: r3(mean(ds.map((x) => x.dg))), monthT: r2(mt.t), grossT: r2(gt.t), tRaw: mt.t };
}
export function decide(E, L, v) {
  const c1 = E.diff[v].meanD > 0 && L.diff[v].meanD > 0, c2 = L.diff[v].monthT >= 2, c3 = E.cell[v].netR > 0 && L.cell[v].netR > 0 && L.cell[v].t >= 2;
  const c4 = E.cell[v].n >= 200 && L.cell[v].n >= 200;
  return { c1, c2, c3, c4 };
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const L = ['# The volatility breakouts entered on a close beyond the trigger (vb-close-confirm, 24 Nov 2026)', '', `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Variants, costs, windows, tests and bar were fixed in `PREREGISTRATION.md` (pushed alone before any close-confirmed figure was computed; sha256 in `result.json`). The rule\'s functions come unchanged from `index-vol-breakout/original.mjs`; gold is charged `gold-vol-breakout-hourcost`\'s C1 (frozen from its result.json), USD/JPY `fx-vol-breakout`\'s cost (commission measured, the 0.5 pip assumed). Each variant\'s R is on its own risk (entry to the open) and its cost in R is cost / its own risk. A signal day with no confirming close counts 0R for the variant in the paired difference d. **Nothing is adopted and nothing live changed.**', '',
    `Gate: V0 reproduces vb-stop-place's O rows and hourcost's C1 pooled figure (${Object.entries(R.gate).filter(([k]) => k === 'xau' || k === 'usdjpy').map(([m, g]) => Object.entries(g).map(([w, x]) => `${m} ${w} n ${x.got[0]} ${sg(x.got[1])}`).join('; ')).join('; ')}): ${R.gate.ok ? 'yes' : 'no'}.`, ''];
  for (const mk of ['xau', 'usdjpy']) {
    const M = R.markets[mk], W = WIN[mk];
    L.push(`## ${mk === 'xau' ? 'Gold' : 'USD/JPY'}`, '', '| Entry | Window | Trades (of signal days) | Win | Gross R | Net R | Net 2x | Cost R | Month t | Stopped | Max DD R | Mean delay (min) | d vs V0 a signal day (gross) | Month t of d |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const v of ALL) for (const w of ['early', 'late']) {
      const c = M[w].cell[v], dd = M[w].diff[v];
      L.push(`| ${NAME[v]} | ${W[w].join(' → ')} | ${c.n} (of ${M[w].days}) | ${(c.win * 100).toFixed(1)} % | ${sg(c.grossR)} | ${sg(c.netR)} | ${sg(c.net2R)} | ${sg(c.costR)} | ${sg(c.t, 2)} | ${(c.stopped * 100).toFixed(0)} % | ${sg(c.maxDD, 1)} | ${v === 'V0' ? '0' : c.delayMin} | ${v === 'V0' ? '—' : `${sg(dd.meanD)} (${sg(dd.meanDg)})`} | ${v === 'V0' ? '—' : sg(dd.monthT, 2)} |`);
    }
    L.push('');
  }
  L.push('## Tests (Holm over four, one-sided p of the confirmation month t of d)', '', '| Test | Market | Variant | d discovery | d confirmation | Month t of d | p | Holm p | (1) d > 0 both | (2) t ≥ 2, Holm | (3) net > 0 both, t ≥ 2 | (4) n ≥ 200 | Reading |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  R.tests.forEach((t, k) => L.push(`| T${k + 1} | ${t.market} | ${t.v} | ${sg(t.dE)} | ${sg(t.dL)} | ${sg(t.tL, 2)} | ${t.p} | ${t.pHolm} | ${t.c1 ? 'yes' : 'no'} | ${t.c2 && t.pHolm < 0.05 ? 'yes' : 'no'} | ${t.c3 ? 'yes' : 'no'} | ${t.c4 ? 'yes' : 'no'} | **${t.label}** |`));
  L.push('', '## Control: the same wait on random entries (40 seeds, whole span, not in the verdict)', '', '| Market | Variant | T1 d (pooled) | Placebo d, median | 5-95 % over seeds | T1 inside the band |', '|---|---|---|---|---|---|');
  for (const mk of ['xau', 'usdjpy']) for (const v of VARIANTS) { const p = R.placebo[mk][v]; L.push(`| ${mk} | ${v} | ${sg(R.pooledD[mk][v])} | ${sg(p.median)} | ${sg(p.q05)} … ${sg(p.q95)} | ${p.inside ? 'yes' : 'no'} |`); }
  L.push('', '**What it says.** ' + R.text, '', `Data: ${R.data}. Cautions: today's demo cost on every past year; gold stop slippage modelled (0.05 x M), not measured; OANDA mid candles are not broker fills (an entry at a candle close is a market order a few seconds later in practice); both windows were read before for the rule itself.`, '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [f, h] of Object.entries(SHA)) if (crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', f))).digest('hex') !== h) throw new Error(f + ' changed');
  const hc = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'gold-vol-breakout-hourcost', 'result.json'), 'utf8'));
  const R = { study: 'vb-close-confirm', built: '2026-11-24', preregistration: 'research/edge/vb-close-confirm/PREREGISTRATION.md',
    planSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex'),
    windows: WIN, k: K, gate: { xau: {}, usdjpy: {} }, markets: {}, placebo: {}, pooledD: {} };
  const data = [];
  for (const mk of ['xau', 'usdjpy']) {
    const bars = load(mk, '5m', { from: mk === 'xau' ? '2006-03-01' : '2004-11-01', to: '2026-11-21' });
    const rows = bars.map((b) => [b.t, b.o, b.h, b.l, b.c]), days = O.buildDays(rows), cost = costerOf(mk, hc);
    data.push(`${mk} ${new Date(rows[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10)} (${rows.length} M5 candles)`);
    const all = tradesOf(mk, days, cost);
    for (const [w, [win, n, net]] of Object.entries(GATE[mk])) {
      const c = cell(all.filter((x) => inW(x.day, win)).map((x) => x.m.V0));
      R.gate[mk][w] = { got: [c.n, c.netR], want: [n, net], ok: c.n === n && c.netR === net };
    }
    const winOf = (w) => { const rs = all.filter((x) => inW(x.day, WIN[mk][w])); return { days: rs.length, cell: Object.fromEntries(ALL.map((v) => [v, cell(rs.map((x) => x.m[v]).filter(Boolean))])), diff: Object.fromEntries(VARIANTS.map((v) => [v, diffStats(rs, v)])) }; };
    R.markets[mk] = { early: winOf('early'), late: winOf('late') };
    const span = all.filter((x) => inW(x.day, [WIN[mk].early[0], WIN[mk].late[1]]));
    R.pooledD[mk] = Object.fromEntries(VARIANTS.map((v) => [v, r3(mean(diffs(span, v).map((x) => x.d)))]));
    const per = Object.fromEntries(VARIANTS.map((v) => [v, []])), pDays = days.filter((d) => inW(d.day, [WIN[mk].early[0], WIN[mk].late[1]]));
    for (let s = 1; s <= SEEDS; s++) { const P = placeboOf(mk, pDays, cost, s); for (const v of VARIANTS) per[v].push(mean(diffs(P, v).map((x) => x.d))); }
    R.placebo[mk] = Object.fromEntries(VARIANTS.map((v) => { const q05 = O.quantile(per[v], 0.05), q95 = O.quantile(per[v], 0.95); return [v, { median: r3(O.quantile(per[v], 0.5)), q05: r3(q05), q95: r3(q95), inside: R.pooledD[mk][v] >= q05 && R.pooledD[mk][v] <= q95 }]; }));
    console.log(mk, 'gate', JSON.stringify(R.gate[mk]));
  }
  R.gate.ok = [...Object.values(R.gate.xau), ...Object.values(R.gate.usdjpy)].every((g) => g.ok);
  if (!R.gate.ok) { console.log('GATE FAILED', JSON.stringify(R.gate)); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...R, verdict: 'STOPPED: a gate failed' }, null, 1) + '\n'); process.exit(2); }
  const tests = [];
  for (const mk of ['xau', 'usdjpy']) for (const v of VARIANTS) { const E = R.markets[mk].early, Lt = R.markets[mk].late; tests.push({ market: mk, v, dE: E.diff[v].meanD, dL: Lt.diff[v].meanD, tL: Lt.diff[v].monthT, p: O.normP(Lt.diff[v].tRaw), ...decide(E, Lt, v) }); }
  const adj = O.holm(tests.map((t) => t.p));
  tests.forEach((t, i) => { t.pHolm = r3(adj[i]); t.p = r3(t.p); t.improves = t.c1 && t.c2 && adj[i] < 0.05 && t.c3 && t.c4; t.label = t.improves ? 'IMPROVES' : t.tL <= -2 ? 'WORSE' : 'NO BETTER'; });
  R.tests = tests;
  const imp = tests.filter((t) => t.improves), mkName = { xau: 'gold', usdjpy: 'USD/JPY' };
  R.pass = imp.length > 0;
  R.verdict = `${R.pass ? 'PASS' : 'FAIL'}: ${imp.length} of 4 close-confirmed entries beat the touch fill after costs; d a signal day vs the touch (discovery / confirmation, month t of d in confirmation): `
    + tests.map((t) => `${mkName[t.market]} ${t.v === 'V1' ? 'M15 close' : 'H1 close'} ${sg(t.dE)} / ${sg(t.dL)} (t ${sg(t.tL, 2)}, ${t.label})`).join('; ')
    + `; touch fill ${['xau', 'usdjpy'].map((m) => `${mkName[m]} ${sg(R.markets[m].early.cell.V0.netR)} / ${sg(R.markets[m].late.cell.V0.netR)}R`).join(', ')}`;
  const line = (m) => ALL.map((v) => `${v} ${sg(R.markets[m].early.cell[v].netR)} / ${sg(R.markets[m].late.cell[v].netR)}R a trade (confirmation n ${R.markets[m].late.cell[v].n}, gross ${sg(R.markets[m].late.cell[v].grossR)}, cost ${sg(R.markets[m].late.cell[v].costR)}, t ${sg(R.markets[m].late.cell[v].t, 2)})`).join(', ');
  R.text = `Net R a trade, discovery / confirmation: gold ${line('xau')}; USD/JPY ${line('usdjpy')}. `
    + `Control, mean d on random entries (median over 40 seeds): ${['xau', 'usdjpy'].map((m) => VARIANTS.map((v) => `${mkName[m]} ${v} ${sg(R.placebo[m][v].median)} (T1 ${sg(R.pooledD[m][v])})`).join(', ')).join('; ')}. `
    + (R.pass ? `By the pre-registered bar ${imp.map((t) => mkName[t.market] + ' ' + t.v).join(', ')} beat the touch fill on years already read for the rule: a candidate for a forward record, not a change made here. ` : 'No close-confirmed entry meets the pre-registered bar: the rule keeps its stop-order entry on the touch. ')
    + 'Paper research; nothing live changes and no proposal is written.';
  R.data = 'OANDA mid M5 from the shared candle cache (edgekit): ' + data.join('; ');
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(R.verdict);
}
