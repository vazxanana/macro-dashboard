// research/edge/vb-next-day-eg/run.mjs - PREREGISTRATION.md (24 Nov 2026): the day after a volatility breakout T1 that filled
// and closed in profit, the first pullback into a fresh H1 engulf zone of the breakout's side: limit at the near edge, stop past
// the far edge, target 1R / 2R, out at 21:00 UTC. Gold, USD/JPY, EUR/USD, GBP/USD. Research only: nothing live imports it,
// nothing is placed.
//   node research/edge/vb-next-day-eg/run.mjs all <outDir>      (each market in turn: <outDir>/<m>.json with trades and cut test)
//   node research/edge/vb-next-day-eg/run.mjs report <outDir>   (result.json + RESULT.md here)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { exclusions } from '../combo-grid-2/run.mjs';
import { buildDays, daySkip, vbTrade, EXIT_S } from '../index-vol-breakout/original.mjs';
import { zones } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'usdjpy', 'eurusd', 'gbpusd'];
export const COSTS = { xau: K.COSTS.xau, usdjpy: K.COSTS.usdjpy, eurusd: K.COSTS.eurusd, gbpusd: K.COSTS.gbpusd };
export const VB_K = 0.5, BUF = 0.1, ATR_N = 14, MAX_GAP = 4 * 86400, DAY = 86400, TARGETS = [1, 2];
const ym = (y, m = 1) => Date.UTC(y, m - 1, 1) / 1000;
export const FROM = ym(2005), SPLIT = ym(2015), TO = ym(2026, 11);
export const DM = 120, NM = 262;      // months 2005-01 .. 2014-12 | 2015-01 .. 2026-10
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const CELLS = [...MARKETS, 'pooled'].flatMap((m) => TARGETS.map((x, k) => ({ market: m, k, name: `${m} ${x}R` })));

const startIdx = (M5, t0) => { let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < t0) lo = m + 1; else hi = m; } return lo; };

// H1 ATR(14): mean true range of the 14 H1 candles ending with candle i (NaN before there are 14)
export function atrH1(H) {
  const tr = H.map((b, i) => (i ? Math.max(b.h - b.l, Math.abs(b.h - H[i - 1].c), Math.abs(b.l - H[i - 1].c)) : NaN)), out = new Array(H.length).fill(NaN);
  let s = 0; for (let i = 1; i < H.length; i++) { s += tr[i]; if (i > ATR_N) s -= tr[i - ATR_N]; if (i >= ATR_N) out[i] = s / ATR_N; }
  return out;
}

// one filled trade from the fill candle fi to the last candle that starts before endT: R at each target (stop first)
export function sim(M5, fi, s, fill, stop, endT) {
  const risk = s * (fill - stop); if (!(risk > 0)) return null;
  const tg = TARGETS.map((x) => fill + s * x * risk), R = tg.map(() => NaN); let left = R.length, last = fi;
  const fin = (k, px) => { if (Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && M5[j].t < endT && left; j++) { const b = M5[j]; last = j;
    if (j > fi) { if (s * (b.o - stop) <= 0) { tg.forEach((_, k) => fin(k, b.o)); break; } tg.forEach((x, k) => { if (s * (b.o - x) >= 0) fin(k, b.o); }); }
    if (s > 0 ? b.l <= stop : b.h >= stop) { tg.forEach((_, k) => fin(k, stop)); break; }
    if (j > fi) tg.forEach((x, k) => { if (s > 0 ? b.h >= x : b.l <= x) fin(k, x); }); }
  if (left) { let j = last; while (j + 1 < M5.length && M5[j + 1].t < endT) j++; tg.forEach((_, k) => fin(k, M5[j].c)); }
  return { risk, R };
}

// every trade of one market. M5: [{ t, o, h, l, c }] in time order. Uses only candles up to each trade's own exit.
// Returns { trades: [{ t, dN, set (0 after a winning breakout, 1 control: after a losing one), s, fill, stop, risk, R: [1R, 2R], cr, zAt }], funnel }
export function findTrades(M5, cost) {
  const rows = M5.map((b) => [b.t, b.o, b.h, b.l, b.c]), days = buildDays(rows).filter((d) => !daySkip(d));
  const H = K.resample(M5, 3600), atr = atrH1(H);
  const Z = zones(H.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })), '1h')
    .map((z) => ({ dir: z.dir, top: z.top, bot: z.bot, at: z.at, a: atr[z.i] })).filter((z) => z.a > 0).sort((a, b) => a.at - b.at);
  const zStart = (t) => { let lo = 0, hi = Z.length; while (lo < hi) { const m = (lo + hi) >> 1; if (Z[m].at <= t) lo = m + 1; else hi = m; } return lo; };   // first zone with at > t
  const trades = [], funnel = [0, 1].map(() => ({ days: 0, pairs: 0, withZone: 0, fills: 0, wrongSide: 0, small: 0 })); let filled = 0;
  for (let i = 0; i < days.length; i++) { const D = days[i];
    const x = vbTrade(D.bars, { k: VB_K, sides: 'both', prevRange: D.prevRange, cost: 0 }); if (x.skip) continue;
    filled++; const set = x.R > 0 ? 0 : 1, F = funnel[set]; F.days++;
    const N = days[i + 1]; if (!N || N.d0 - D.d0 > MAX_GAP) continue; F.pairs++;
    const S = x.side, known = x.fillT + 300, endT = N.d0 + EXIT_S; let q = zStart(known); const live = []; let any = false;
    for (let j = startIdx(M5, known); j < M5.length && M5[j].t < endT; j++) { const b = M5[j];
      while (q < Z.length && Z[q].at <= b.t) { const z = Z[q++]; if (z.dir === S && z.at < endT) { live.push(z); any = true; } }
      let best = null;
      for (let u = live.length - 1; u >= 0; u--) { const z = live[u];
        if (S > 0 ? b.l <= z.top : b.h >= z.bot) { live.splice(u, 1); if (b.t >= N.d0 && (!best || (S > 0 ? z.top > best.top : z.bot < best.bot))) best = z; } }
      if (!best) continue;
      const edge = S > 0 ? best.top : best.bot, fill = S > 0 ? Math.min(edge, b.o) : Math.max(edge, b.o);
      const stop = S > 0 ? best.bot - BUF * best.a : best.top + BUF * best.a, risk = S * (fill - stop);
      if (!(risk > 0)) { F.wrongSide++; break; }
      if (risk < cost) { F.small++; break; }
      const r = sim(M5, j, S, fill, stop, endT); F.fills++;
      trades.push({ t: b.t, dN: N.d0, set, s: S, fill, stop, risk, R: r.R, cr: cost / risk, zAt: best.at, vbFill: x.fillT });
      break; }
    if (any) F.withZone++;
  }
  return { trades, funnel: { tradable: days.length, breakoutDays: filled, win: funnel[0], control: funnel[1] } };
}

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-12-01', to: '2026-11-01' }).map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c }));
  const cost = COSTS[market], X = exclusions(market), inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const full = findTrades(M5, cost); let dropped = 0;
  const kept = full.trades.filter((x) => { if (x.t < FROM || x.t >= TO) return false; if (X.length && inBad(x.t)) { dropped++; return false; } return true; });
  for (const x of kept) if (!(x.s * (x.fill - x.stop) > 0)) throw new Error('stop on the wrong side');
  const key = (x) => [x.t, x.set, x.s, x.fill, x.stop, x.R.map((v) => v.toFixed(8)).join('/')].join('|'); const cuts = [];
  for (const c of ['2009-06-10', '2015-03-11', '2021-09-22']) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const A = new Set(findTrades(M5.filter((b) => b.t + 300 <= T), cost).trades.filter((x) => x.dN + EXIT_S <= T).map(key));
    const B = new Set(full.trades.filter((x) => x.dN + EXIT_S <= T).map(key));
    cuts.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return { market, cost, first: M5[0]?.t, last: M5.at(-1)?.t, funnel: full.funnel, dropped, cuts,
    cols: ['fillT', 'set (0 after a winning breakout, 1 control)', 'side', 'R at 1R', 'R at 2R', 'cost / risk'],
    trades: kept.map((x) => [x.t, x.set, x.s, +x.R[0].toFixed(6), +x.R[1].toFixed(6), +x.cr.toFixed(6)]) };
}

// ---- statistics ---------------------------------------------------------------------------------------------------------
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
export function monthT(rows, w, val) {
  const a = w ? DM : 0, b = w ? NM : DM, ms = new Array(b - a).fill(0); for (const x of rows) ms[monthOf(x.t) - a] += val(x);
  const m = mean(ms), sd = Math.sqrt(ms.reduce((s, v) => s + (v - m) ** 2, 0) / (ms.length - 1)), t = sd > 0 ? m / (sd / Math.sqrt(ms.length)) : 0;
  const p2 = K.pFromT(t, ms.length - 1) ?? 1; return { t, p: t > 0 ? p2 / 2 : 1 - p2 / 2, months: ms.length };
}
const r4 = (v) => (v == null ? null : +v.toFixed(4));
export function summ(rows, w, k) {
  const g = monthT(rows, w, (x) => x.R[k]), n = monthT(rows, w, (x) => x.R[k] - x.cr);
  return { n: rows.length, R: r4(mean(rows.map((x) => x.R[k]))), net: r4(mean(rows.map((x) => x.R[k] - x.cr))), costR: r4(mean(rows.map((x) => x.cr))),
    win: rows.length ? +(rows.filter((x) => x.R[k] > 0).length / rows.length).toFixed(3) : null, tR: +g.t.toFixed(2), t: +n.t.toFixed(2), p: n.p, months: n.months };
}
export const passOf = (c) => c.disc.n >= 300 && c.conf.n >= 300 && c.disc.net > 0 && c.conf.net > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05;
export function judge(data) {
  const rows = data.flatMap((d) => d.trades.map(([t, set, s, R1, R2, cr]) => ({ t, set, s, R: [R1, R2], cr, market: d.market })));
  const table = (set) => { const out = CELLS.map((c) => { const mine = rows.filter((x) => x.set === set && (c.market === 'pooled' || x.market === c.market));
    return { cell: c.name, market: c.market, target: TARGETS[c.k], disc: summ(mine.filter((x) => x.t < SPLIT), 0, c.k), conf: summ(mine.filter((x) => x.t >= SPLIT), 1, c.k) }; });
    const h = K.holm(out.map((c) => c.conf.p)); out.forEach((c, i) => { c.holm = h[i]; c.enough = c.disc.n >= 300 && c.conf.n >= 300; c.pass = passOf(c); }); return out; };
  const cells = table(0), control = table(1);
  const verdict = cells.some((c) => c.pass) ? 'PASS' : cells.some((c) => c.enough) ? 'FAIL' : 'INCONCLUSIVE';
  const pool = cells.filter((c) => c.enough), from = pool.length ? pool : cells, best = from.reduce((a, c) => (c.conf.net > a.conf.net ? c : a));
  return { verdict, cells, control, best: best.cell };
}

const f3 = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(3)), f2 = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(2);
export function headlineOf(J) { const b = J.cells.find((c) => c.cell === J.best);
  return `${J.cells.filter((c) => c.pass).length} of ${J.cells.length} cells pass; best ${b.cell}: ${f3(b.conf.net)}R a trade after costs in 2015-26 (n ${b.conf.n}, month t ${f2(b.conf.t)}; before costs ${f3(b.conf.R)}R), discovery ${f3(b.disc.net)}R (n ${b.disc.n}, t ${f2(b.disc.t)})`; }

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')));
  const J = judge(data), headline = headlineOf(J);
  const result = { study: 'vb-next-day-eg', run: '2026-11-24', verdict: J.verdict, headline, best: J.best,
    windows: { discovery: '2005-01-01..2014-12-31', confirmation: '2015-01-01..2026-10-31' }, costs: COSTS, cells: J.cells, control: J.control,
    markets: data.map((d) => ({ market: d.market, cost: d.cost, first: d.first, last: d.last, funnel: d.funnel, dropped: d.dropped, trades: d.trades.length })),
    cuts: data.flatMap((d) => d.cuts) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  const row = (c) => `| ${c.cell} | ${c.disc.n} | ${f3(c.disc.R)} | ${f3(c.disc.net)} | ${f2(c.disc.t)} | ${c.conf.n} | ${f3(c.conf.R)} (t ${f2(c.conf.tR)}) | ${f3(c.conf.net)} | ${f2(c.conf.t)} | ${c.conf.costR == null ? 'n/a' : c.conf.costR.toFixed(3)} | ${c.conf.win == null ? 'n/a' : (c.conf.win * 100).toFixed(1) + ' %'} | ${c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`;
  const head = '| Cell | n 05-14 | R before costs | R after | month t (after) | n 15-26 | R before costs (month t) | R after | month t (after) | cost R | won | Holm p | pass |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|';
  const fun = (d) => { const w = d.funnel.win, c = d.funnel.control;
    return `| ${d.market} | ${d.funnel.breakoutDays} | ${w.days} | ${w.pairs} | ${w.withZone} | ${w.fills} | ${w.wrongSide + w.small} | ${c.days} | ${c.fills} | ${d.dropped} |`; };
  const cutOk = result.cuts.every((c) => c.missing === 0 && c.extra === 0);
  const md = `# The day after a winning volatility breakout: the first pullback into a fresh H1 engulf zone (result)

**Verdict: ${J.verdict}. ${headline}.**

Run 2026-11-24 as pre-registered (\`PREREGISTRATION.md\`, committed alone first). Research only: nothing live changed, nothing
is proposed. One run, no variants. A before-cost tilt is not an edge.

## What was run

Gold, USD/JPY, EUR/USD and GBP/USD, OANDA mid 5-minute candles. Day D = the T1 breakout (k 0.5, both sides, the T1 studies' own
\`buildDays\` / \`daySkip\` / \`vbTrade\`) filled and ended above zero before costs. On the next tradable weekday, 00:00 to 21:00
UTC: the first 5-minute candle that trades into an H1 engulf zone of the breakout's side (\`council/eg-methods.mjs\` \`zones\`)
formed since the breakout's fill and not traded into before that day. Limit at the zone's near edge, stop past the far edge by
0.1 x the H1 ATR(14), target 1R or 2R, else out at 21:00 UTC; one trade a day. Costs a round trip: gold $0.30, USD/JPY 0.008
(the desk's demo figures), EUR/USD 0.00006, GBP/USD 0.00008 (the shared figures). Discovery = fills 2005-2014 (gold from 2006),
confirmation = 2015 to October 2026; t of calendar-month sums with empty months as 0; Holm over the ten confirmation tests.

## Every cell (after a WINNING breakout day: the judged set)

${head}
${J.cells.map(row).join('\n')}

Cells with n >= 300 in both windows: ${J.cells.filter((c) => c.enough).length} of ${J.cells.length}. Positive after costs in both windows: ${J.cells.filter((c) => c.disc.net > 0 && c.conf.net > 0).length}.

## Control (reported, not judged): the same rule the day after a breakout that did NOT end in profit

${head}
${J.control.map(row).join('\n')}

## The funnel

| Market | breakout days | winning | with a next day | with a candidate zone | fills | refused (stop side, risk under cost) | losing days (control) | control fills | dropped (bad data) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${data.map(fun).join('\n')}

Fills count every year on file; the cells count fills from 2005-01 to 2026-10 outside the bad-data intervals.

## Cut test

The trades known at three dates, computed on candles cut there, ${cutOk ? 'equal the full run\'s on every market' : 'DO NOT all equal the full run\'s'}: ${result.cuts.map((c) => `${c.market} ${c.cut} n ${c.n} (${c.missing} missing, ${c.extra} extra)`).join('; ')}.

## Reading

${J.verdict === 'PASS' ? 'At least one cell clears the pre-registered bar. It is one run on years the breakout itself was studied on: a candidate for its own holdout, not an edge.' : J.verdict === 'FAIL' ? 'No cell clears the bar. The day after a winning breakout does not continue from an H1 engulf zone in a way that survives costs and the month-sum test in both windows.' : 'No cell has 300 trades in both windows: too few to judge.'}
Limits: a limit order is assumed filled when a mid candle touches its price; the same cost is charged for every year; the control
shows whether "the breakout won" adds anything over "a breakout filled". Never call any cell an edge.
`;
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, a] = process.argv.slice(2);
  if (cmd === 'all') { fs.mkdirSync(a, { recursive: true });
    for (const m of MARKETS) { const t0 = Date.now(); const r = runMarket(m); fs.writeFileSync(path.join(a, `${m}.json`), JSON.stringify(r));
      console.log(m, 'trades', r.trades.length, 'cuts', JSON.stringify(r.cuts.map((c) => [c.n, c.missing, c.extra])), ((Date.now() - t0) / 1000).toFixed(0) + 's'); } }
  else if (cmd === 'report') { const r = report(a); console.log(r.verdict, r.headline); }
  else { console.error('usage: run.mjs all <outDir> | report <outDir>'); process.exit(1); }
}
