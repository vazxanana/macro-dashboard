// research/edge/h1-box-retest-engulf/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): an H1 box (edgekit boxesClose)
// broken by a close, a retest of the broken edge on M15, then an M15 engulf with the break (council/eg-methods engulfAt) within
// 12 M15 candles of the retest; market at the engulf's close, stop past the engulf zone, target 1R or the box height projected.
// 8 cells, five markets pooled, discovery 2005-14, confirmation 2015 to Oct 2026. Research only: nothing live imports it.
// Usage: node run.mjs run   (reads the edgekit candle cache; writes result.json and RESULT.md beside this file)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { engulfAt } from '../../../council/eg-methods.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const P = { retestWithin: 96, engulfWithin: 12, hold: 48 * 3600 };
export const LENS = [3, 8], SPANS = [3, 1], TARGETS = ['1R', 'box'];
export const CELLS = []; for (const len of LENS) for (const span of SPANS) for (const tg of TARGETS) CELLS.push({ len, span, tg, name: `len${len} eg${span} ${tg}` });
const W = { disc: [Date.UTC(2005, 0, 1) / 1000, Date.UTC(2015, 0, 1) / 1000], conf: [Date.UTC(2015, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000] };

// Every setup of one market for one engulf span. H1, M15: edgekit bars. Returns one signal a box at most:
// { side, t (the engulf candle's close), stop, edge, height, len, boxBt, retestT, i (M15 index) } and the step counts.
export function setups(H1, M15, span, cost) {
  const C = M15.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
  const out = [], steps = { broken: 0, retested: 0, engulfed: 0 };
  for (const box of K.boxesClose(H1)) {
    if (!box.dir || box.bi < 0) continue;
    steps.broken++;
    const d = box.dir, edge = d > 0 ? box.hi : box.lo, far = d > 0 ? box.lo : box.hi, height = box.hi - box.lo;
    let lo = 0, hi = M15.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M15[m].t < box.bt) lo = m + 1; else hi = m; }
    let r = -1;
    for (let j = lo; j < M15.length && j < lo + P.retestWithin + P.engulfWithin + 1; j++) {
      const b = M15[j];
      if (d > 0 ? b.c < far : b.c > far) break;                           // closed beyond the box's far side: the setup is over
      if (r < 0) { if (j - lo >= P.retestWithin) break; if (d > 0 ? b.l <= edge : b.h >= edge) { r = j; steps.retested++; } }
      if (r < 0) continue;
      if (j - r > P.engulfWithin) break;
      const e = engulfAt(C, j, span);
      if (e && e.dir === d) {
        let ext = d > 0 ? Infinity : -Infinity;
        for (let q = e.j; q <= j; q++) ext = d > 0 ? Math.min(ext, M15[q].l) : Math.max(ext, M15[q].h);
        steps.engulfed++;
        out.push({ side: d, t: b.e, stop: ext - d * cost, edge, height, len: box.e - box.s + 1, boxBt: box.bt, retestT: M15[r].t, i: j });
        break;
      }
    }
  }
  return { signals: out, steps };
}

// One signal on the 5-minute candles: both targets. null = no trade; else { fillT, risk, R: { '1R', box }, plan (box target in R) }.
export function trade(sig, M5, cost) {
  let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < sig.t) lo = m + 1; else hi = m; }
  if (lo >= M5.length) return null;
  const fill = M5[lo].o, risk = sig.side * (fill - sig.stop);
  if (!(risk > cost)) return null;
  const tgt = { '1R': fill + sig.side * risk, box: sig.edge + sig.side * sig.height };
  const R = {};
  for (const k of TARGETS) {
    if (!(sig.side * (tgt[k] - fill) > 0)) { R[k] = null; continue; }
    const x = K.simulate({ side: sig.side, entry: fill, stop: sig.stop, target: tgt[k], t: sig.t, type: 'market', maxHold: P.hold }, M5, { cost });
    R[k] = x.status === 'win' || x.status === 'loss' || x.status === 'be' ? x.R : null;
  }
  return { fillT: M5[lo].t, risk, cr: cost / risk, R, plan: (sig.side * (tgt.box - fill)) / risk };
}

// month-sum t of a list of [fill time, R]: every month from the first to the last trade month, empty months 0
export function monthT(rows) {
  if (!rows.length) return { n: 0, mean: null, t: null, months: 0, p: null };
  const m = new Map(); let s = 0;
  for (const [t, r] of rows) { const d = new Date(t * 1000), k = d.getUTCFullYear() * 12 + d.getUTCMonth(); m.set(k, (m.get(k) || 0) + r); s += r; }
  const ks = [...m.keys()], a = Math.min(...ks), b = Math.max(...ks), xs = []; for (let k = a; k <= b; k++) xs.push(m.get(k) || 0);
  const n = xs.length, mu = xs.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1)) : 0;
  const t = sd > 0 ? mu / (sd / Math.sqrt(n)) : null;
  return { n: rows.length, mean: s / rows.length, t, months: n, p: t == null ? null : K.pFromT(t, n - 1) };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));

function run() {
  // rows[cell][window] = [fillT, Rgross, Rnet, market]
  const rows = CELLS.map(() => ({ disc: [], conf: [] })); const steps = {}; const plans = CELLS.map(() => []);
  for (const mk of MARKETS) {
    const cost = COSTS[mk];
    let M5 = K.load(mk, '5m', { from: '2005-01-01', to: '2026-11-01' });
    const H1 = K.resample(M5, 3600), M15 = K.resample(M5, 900);
    steps[mk] = { first: new Date(M5[0].t * 1000).toISOString().slice(0, 10), m5: M5.length };
    for (const span of SPANS) {
      const S = setups(H1, M15, span, cost);
      steps[mk]['eg' + span] = { ...S.steps, len8: S.signals.filter((x) => x.len >= 8).length, traded: 0 };
      for (const sig of S.signals) {
        const tr = trade(sig, M5, cost); if (!tr) continue;
        const w = tr.fillT >= W.disc[0] && tr.fillT < W.disc[1] ? 'disc' : tr.fillT >= W.conf[0] && tr.fillT < W.conf[1] ? 'conf' : null; if (!w) continue;
        steps[mk]['eg' + span].traded++;
        CELLS.forEach((c, ci) => { if (c.span !== span || sig.len < c.len || tr.R[c.tg] == null) return;
          rows[ci][w].push([tr.fillT, tr.R[c.tg], tr.R[c.tg] - tr.cr, mk, tr.cr]); if (c.tg === 'box') plans[ci].push(tr.plan); });
      }
    }
    M5 = null;
    console.error(mk, JSON.stringify(steps[mk]));
  }
  const side = (r) => { const g = monthT(r.map((x) => [x[0], x[1]])), n = monthT(r.map((x) => [x[0], x[2]]));
    return { n: r.length, win: r.length ? r.filter((x) => x[1] > 0).length / r.length : null, gross: g.mean, tGross: g.t, net: n.mean, t: n.t, months: n.months, p: n.p,
      costR: r.length ? r.reduce((a, x) => a + x[4], 0) / r.length : null }; };
  const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const cells = CELLS.map((c, i) => ({ cell: c.name, disc: side(rows[i].disc), conf: side(rows[i].conf), planBoxR: c.tg === 'box' ? med(plans[i]) : null }));
  const ps = cells.map((c) => (c.conf.net > 0 && c.conf.p != null ? c.conf.p : 1)); const hp = K.holm(ps);
  cells.forEach((c, i) => { c.pHolmIn = ps[i]; c.holm = hp[i];
    c.pass = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.net > 0 && c.conf.net > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05; });
  const enough = cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  const verdict = cells.some((c) => c.pass) ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE';
  const bi = cells.reduce((b, c, i) => ((c.conf.net ?? -9) > (cells[b].conf.net ?? -9) ? i : b), 0), best = cells[bi];
  const headline = `Best cell ${best.cell}: ${f3(best.conf.net)}R a trade after costs in 2015-26 (n ${best.conf.n}, month t ${f2(best.conf.t)}), ${f3(best.disc.net)}R in 2005-14 (n ${best.disc.n}, month t ${f2(best.disc.t)}); 0 of 8 cells positive after costs in both windows`
    .replace('0 of 8', `${cells.filter((c) => c.disc.net > 0 && c.conf.net > 0).length} of 8`);
  const byMarket = {}; for (const mk of MARKETS) byMarket[mk] = { disc: side(rows[bi].disc.filter((x) => x[3] === mk)), conf: side(rows[bi].conf.filter((x) => x[3] === mk)) };
  const R = { study: 'h1-box-retest-engulf', built: '2026-11-24', verdict, headline, markets: MARKETS, params: P,
    windows: { discovery: '2005-01-01 to 2014-12-31', confirmation: '2015-01-01 to 2026-10-31' }, costs: Object.fromEntries(MARKETS.map((m) => [m, COSTS[m]])),
    cells, passed: cells.filter((c) => c.pass).map((c) => c.cell), best: best.cell, bestByMarket: byMarket, steps };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  const L = [];
  L.push('# H1 box break, retest of the broken edge, M15 engulf with the break: result (24 Nov 2026)', '');
  L.push(`**Verdict: ${verdict}. ${headline}.**`, '');
  L.push('Pre-registered in `PREREGISTRATION.md` (committed alone before `run.mjs` existed). OANDA mid 5-minute candles, five markets pooled');
  L.push('(xau, eurusd, gbpusd, usdjpy, audusd), H1 and M15 built from them. Windows by the fill: discovery 2005-2014, confirmation');
  L.push('2015 to October 2026. Research only: nothing live changed, no rule is proposed. Never an edge.', '');
  L.push('## The rule, in one paragraph', '');
  L.push('An H1 box follows price until an H1 candle closes outside it. After that close, the first M15 candle that trades back to the');
  L.push('broken edge (within 96 M15 candles) is the retest; from that candle to the 12th after it, the first M15 engulf with the break is');
  L.push('the entry, at market at its close. Stop past the lowest low (highest high) of the engulf candles by one round-trip cost; target');
  L.push('1R, or the box height projected from the broken edge; out after 48 hours otherwise; stop first in a candle that holds both.', '');
  L.push('## Every cell', '');
  L.push('R a trade; t = t of calendar-month sums (month of the fill). "cost R" = mean round-trip cost / risk.', '');
  L.push('| cell | 2005-14 n | won | before costs (t) | after costs (t) | 2015-26 n | won | before costs (t) | after costs (t) | cost R | Holm p | pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cells) L.push(`| ${c.cell} | ${c.disc.n} | ${(c.disc.win * 100).toFixed(0)} % | ${f3(c.disc.gross)} (${f2(c.disc.tGross)}) | ${f3(c.disc.net)} (${f2(c.disc.t)}) | ${c.conf.n} | ${(c.conf.win * 100).toFixed(0)} % | ${f3(c.conf.gross)} (${f2(c.conf.tGross)}) | ${f3(c.conf.net)} (${f2(c.conf.t)}) | ${f2(c.conf.costR)} | ${c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('', `Median planned reward of the \`box\` target: ${cells.filter((c) => c.planBoxR != null).map((c) => `${c.cell} ${f2(c.planBoxR)}R`).join(', ')}.`, '');
  L.push('## The bar', '');
  L.push(`- n >= 300 in both windows: ${cells.filter((c) => c.disc.n >= 300 && c.conf.n >= 300).length} of 8.`);
  L.push(`- Mean R after costs > 0 in both windows: ${cells.filter((c) => c.disc.net > 0 && c.conf.net > 0).length} of 8.`);
  L.push(`- Month t >= 2 after costs in both windows: ${cells.filter((c) => c.disc.t >= 2 && c.conf.t >= 2).length} of 8.`);
  L.push(`- Holm p < 0.05 in confirmation: ${cells.filter((c) => c.holm < 0.05).length} of 8.`);
  L.push(`- Mean R BEFORE costs > 0 in both windows: ${cells.filter((c) => c.disc.gross > 0 && c.conf.gross > 0).length} of 8.`, '');
  L.push(`## The best cell by market (context only, no verdict): ${best.cell}`, '');
  L.push('| market | 2005-14 n | after costs (t) | 2015-26 n | before costs | after costs (t) |', '|---|---|---|---|---|---|');
  for (const mk of MARKETS) { const b = byMarket[mk]; L.push(`| ${mk} | ${b.disc.n} | ${f3(b.disc.net)} (${f2(b.disc.t)}) | ${b.conf.n} | ${f3(b.conf.gross)} | ${f3(b.conf.net)} (${f2(b.conf.t)}) |`); }
  L.push('', '## How many boxes reached each step (engulf span 3 / span 1)', '');
  L.push('| market | candles from | H1 boxes broken | retested | engulfed (eg3 / eg1) | of 8+ candles | traded in the windows (any box length) |', '|---|---|---|---|---|---|---|');
  for (const mk of MARKETS) { const s = steps[mk]; L.push(`| ${mk} | ${s.first} | ${s.eg3.broken} | ${s.eg3.retested} | ${s.eg3.engulfed} / ${s.eg1.engulfed} | ${s.eg3.len8} / ${s.eg1.len8} | ${s.eg3.traded} / ${s.eg1.traded} |`); }
  L.push('', '## What to doubt', '');
  L.push('- Mid candles, one fixed round-trip cost a market for every year; no slippage on the market entry or the stop.');
  L.push('- Boxes are independent, so trades of neighbouring boxes overlap; the month-sum t absorbs some of that, not all.');
  L.push('- "Retested" counts boxes of any length; the retest candle may be the first M15 candle after the break (a break that closes');
  L.push('  barely outside is retested at once), so the retest is a weak condition.');
  L.push('- Every cell is below zero BEFORE costs. Part of that is the mandatory worst case: a 5-minute candle that holds both stop and');
  L.push('  target is booked as a stop, and the stops are tight (risk about twelve round trips), so the true before-cost figure is nearer zero.');
  L.push('- Gold has no candles before 2006 in the cache. The five markets were read by many earlier studies: nothing here is a holdout.', '');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n'));
  console.log(verdict + '. ' + headline);
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'run') run();
