// research/edge/fvg-vb-side/run.mjs - PREREGISTRATION.md (24 Nov 2026): the FVG return (grid7-fvg-wide cell 1h mkt large 1R)
// split by the day's T1 volatility breakout (WITH / AGAINST its direction, after its fill), a no-fill-day control and a random-day
// matched placebo, on gold and the six forex majors, after costs. Research only: nothing live imports it, nothing is placed.
//   node research/edge/fvg-vb-side/run.mjs market <m> <outDir>   (one market, writes <outDir>/<m>.json)
//   node research/edge/fvg-vb-side/run.mjs cut <m> <outDir>
//   node research/edge/fvg-vb-side/run.mjs report <outDir>        (result.json + RESULT.md here)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { manage } from '../dom-trade-through/run.mjs';
import * as FVG from '../grid7-fvg-wide/run.mjs';
import * as GO from '../gold-vol-breakout-hourcost/original.mjs';
import { T1 as GOLD_T1 } from '../gold-vol-breakout-hourcost/costs.mjs';
import * as JO from '../index-vol-breakout/original.mjs';
import { K as FX_K } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf'];
export const ASSUMED = ['usdcad', 'usdchf'];
export const VB = (m) => (m === 'xau' ? { O: GO, k: GOLD_T1.k } : { O: JO, k: FX_K });
const ym = (y, m = 1) => Date.UTC(y, m - 1, 1) / 1000;
export const FROM = ym(2005), SPLIT = ym(2015), TO = ym(2026, 11);   // fills 2005-01 .. 2026-10
export const DM = 120, NM = 262;
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const SETS = ['with', 'against', 'control', 'other'];   // other = no set (pre-fill on a breakout day, after 21:00, skipped days)
const DAY = 86400, G1 = FVG.GTF.indexOf('1h'), SEEDS = 40;

export function medians() {
  const j = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'grid7-fvg-wide', 'result.json'), 'utf8'));
  return Object.fromEntries(j.meta.map((m) => [m.market, m.medians]));
}

// day labels from the breakout study's own code: d0 -> { kind: 'vb', D, fillT } | { kind: 'nofill' }
export function dayLabels(market, M5) {
  const { O, k } = VB(market), rows = M5.map((b) => [b.t, b.o, b.h, b.l, b.c]), lab = new Map();
  for (const d of O.buildDays(rows)) {
    if (O.daySkip(d)) continue;
    const x = O.vbTrade(d.bars, { k, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (x.skip === 'nofill') lab.set(d.d0, { kind: 'nofill' });
    else if (!x.skip) lab.set(d.d0, { kind: 'vb', D: x.side, fillT: x.fillT });
  }
  return lab;
}

// the set of one FVG signal (s = its side, et = decision time); 3 = other
export function classify(sg, lab) {
  const d0 = Math.floor(sg.et / DAY) * DAY; if (sg.et - d0 >= GO.EXIT_S) return 3;
  const L = lab.get(d0); if (!L) return 3;
  if (L.kind === 'nofill') return 2;
  if (sg.et < L.fillT + 300) return 3;
  return sg.s === L.D ? 0 : 1;
}

export const cellSignals = (M5, market, med) => FVG.signals(M5, market, med).sigs.filter((g) => !g.ctl && g.g === G1 && g.kind === 0 && g.large);

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const med = medians()[market], sigs = cellSignals(M5, market, med), lab = dayLabels(market, M5);
  const cost = COSTS[market], X = exclusions(market), cap = FVG.CAP['1h'];
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const trades = []; let bad = 0, small = 0, open = 0, dropped = 0;
  for (const sg of sigs) {
    const t = M5[sg.fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(t)) { dropped++; continue; }
    const risk = sg.s * (sg.fill - sg.stop); if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    const r = manage(M5, sg.s, sg.fi, sg.fill, sg.stop, cap, sg.firstFull); if (!r) { open++; continue; }
    trades.push([t, classify(sg, lab), +r.R[0].toFixed(6), +(cost / risk).toFixed(6), sg.s, Math.floor(sg.et / DAY)]);
  }
  let vb = 0, nf = 0; for (const L of lab.values()) L.kind === 'vb' ? vb++ : nf++;
  return { market, cost, assumed: ASSUMED.includes(market), first: M5[0]?.t, last: M5.at(-1)?.t, days: { breakout: vb, nofill: nf }, signals: sigs.length,
    bad, small, open, dropped, cols: ['fillT', 'set (0 with, 1 against, 2 control, 3 other)', 'R (1R exit)', 'costR', 'side', 'day index'], trades };
}

// cut test: day labels and set of every cell signal known at a cut equal the full run's
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }), med = medians()[market];
  const fl = dayLabels(market, M5), fs0 = cellSignals(M5, market, med);
  const key = (g, lab) => [g.bt, g.s, g.et, g.fill, g.stop.toFixed(8), classify(g, lab)].join('|'); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000, cut = M5.filter((b) => b.t + 300 <= T);
    const lab = dayLabels(market, cut), sig = cellSignals(cut, market, med).filter((g) => g.et <= T && g.ft < T);
    const A = new Set(sig.map((g) => key(g, lab))), B = new Set(fs0.filter((g) => g.et <= T && g.ft < T).map((g) => key(g, fl)));
    let labDiff = 0; for (const [d0, L] of fl) if (d0 + DAY <= T) { const M = lab.get(d0); if (JSON.stringify(M) !== JSON.stringify(L)) labDiff++; }
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length, labDiff }); }
  return out;
}

// ---- statistics -------------------------------------------------------------------------------------------------------
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function monthT(rows, w, key) {
  const a = w ? DM : 0, b = w ? NM : DM, ms = new Array(b - a).fill(0);
  for (const x of rows) ms[monthOf(x.t) - a] += x[key];
  const m = mean(ms), s = sd(ms), t = s > 0 ? m / (s / Math.sqrt(ms.length)) : 0; return { months: ms.length, t, p: p1(t, ms.length - 1) };
}
export function summ(rows, w) {
  if (!rows.length) return { n: 0, R: null, net: null, costR: null, win: null, tR: 0, t: 0, p: 1, months: 0 };
  const R = rows.map((x) => x.R), N = rows.map((x) => x.net);
  return { n: rows.length, R: +mean(R).toFixed(4), net: +mean(N).toFixed(4), costR: +mean(rows.map((x) => x.cr)).toFixed(4),
    win: +(rows.filter((x) => x.R > 0).length / rows.length).toFixed(3), tR: +monthT(rows, w, 'R').t.toFixed(2), ...(({ t, p, months }) => ({ t: +t.toFixed(2), p, months }))(monthT(rows, w, 'net')) };
}
export function welch(a, b) { const ma = mean(a), mb = mean(b), va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length, t = (ma - mb) / Math.sqrt(va + vb);
  return { diff: +(ma - mb).toFixed(4), t: +t.toFixed(2), p: p1(t, a.length + b.length - 2) }; }

// random-day matched placebo: per WITH trade one random trade of the same market, side and window from another day
export function placebo(rows, w, seed) {
  const rnd = FVG.rng(seed), pools = new Map();
  for (const x of rows) if ((x.t >= SPLIT) === !!w) { const k = x.market + '|' + x.side; if (!pools.has(k)) pools.set(k, []); pools.get(k).push(x); }
  let s = 0, n = 0;
  for (const x of rows) { if (x.set !== 0 || (x.t >= SPLIT) !== !!w) continue;
    const P = pools.get(x.market + '|' + x.side); let y, g = 0;
    do { y = P[Math.floor(rnd() * P.length)]; } while (y.day === x.day && ++g < 50);
    s += y.net; n++; }
  return n ? s / n : NaN;
}

export function judge(all) {
  const rows = all.map(([t, set, R, cr, side, day, market]) => ({ t, set, R, cr, net: R - cr, side, day, market }));
  const W = (w) => rows.filter((x) => (w ? x.t >= SPLIT : x.t < SPLIT));
  const S = (w, f) => W(w).filter(f);
  const both = (f) => ({ disc: summ(S(0, f), 0), conf: summ(S(1, f), 1) });
  const sets = { with: both((x) => x.set === 0), against: both((x) => x.set === 1), control: both((x) => x.set === 2), all: both(() => true), rest: both((x) => x.set !== 0) };
  const per = {}; for (const m of MARKETS) per[m] = { with: both((x) => x.market === m && x.set === 0), against: both((x) => x.market === m && x.set === 1),
    control: both((x) => x.market === m && x.set === 2), all: both((x) => x.market === m) };
  const diff = (fa, fb) => ({ disc: welch(S(0, fa).map((x) => x.net), S(0, fb).map((x) => x.net)), conf: welch(S(1, fa).map((x) => x.net), S(1, fb).map((x) => x.net)) });
  const T2d = diff((x) => x.set === 0, (x) => x.set !== 0), T3d = diff((x) => x.set === 0, (x) => x.set === 1);
  const draws = { disc: [], conf: [] }; for (let i = 0; i < SEEDS; i++) { draws.disc.push(+placebo(rows, 0, 1000 + i).toFixed(4)); draws.conf.push(+placebo(rows, 1, 2000 + i).toFixed(4)); }
  const beaten = { disc: draws.disc.filter((v) => sets.with.disc.net > v).length, conf: draws.conf.filter((v) => sets.with.conf.net > v).length };
  const h = K.holm([sets.with.conf.p, T2d.conf.p, T3d.conf.p]);
  const w = sets.with;
  const tests = {
    T1: { name: 'WITH after costs (with the random-day placebo)', pass: w.disc.n >= 200 && w.conf.n >= 200 && w.disc.net > 0 && w.conf.net > 0 && w.conf.t >= 2 && h[0] < 0.05 && beaten.conf >= 38, holm: h[0] },
    T2: { name: 'WITH minus REST after costs', pass: T2d.disc.diff > 0 && T2d.conf.diff > 0 && T2d.conf.t >= 2 && h[1] < 0.05, holm: h[1] },
    T3: { name: 'WITH minus AGAINST after costs', pass: T3d.disc.diff > 0 && T3d.conf.diff > 0 && T3d.conf.t >= 2 && h[2] < 0.05, holm: h[2] },
  };
  return { verdict: tests.T1.pass ? 'PASS' : 'FAIL', tests, sets, T2: T2d, T3: T3d, placebo: { draws, beaten }, per };
}

const f3 = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(3));
export function verdictLine(J) {
  const w = J.sets.with, a = J.sets.against, al = J.sets.all;
  return `**Verdict: ${J.verdict}. ${['T1', 'T2', 'T3'].filter((k) => J.tests[k].pass).length} of 3 tests pass; FVG returns WITH the day's breakout made ${f3(w.conf.net)}R a trade after costs in 2015-26 (n ${w.conf.n}, month t ${w.conf.t}; before costs ${f3(w.conf.R)}R), AGAINST ${f3(a.conf.net)}R (n ${a.conf.n}, t ${a.conf.t}), every FVG trade ${f3(al.conf.net)}R (n ${al.conf.n}, t ${al.conf.t}).**`;
}

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')));
  const cuts = MARKETS.flatMap((m) => { const f = path.join(dir, `${m}-cut.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const J = judge(data.flatMap((d) => d.trades.map((x) => [...x, d.market])));
  const res = { study: 'fvg-vb-side', at: new Date().toISOString().slice(0, 10), verdict: J.verdict, verdictLine: verdictLine(J).replace(/\*/g, ''),
    windows: { discovery: '2005-01..2014-12', confirmation: '2015-01..2026-10' }, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), assumed: ASSUMED,
    markets: data.map(({ trades, ...rest }) => rest), cut: cuts, ...J };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md(res));
  return res;
}

const HEAD = '| Set | n 05-14 | R before | R after | month t (after) | n 15-26 | R before (month t) | R after | month t (after) | cost R | won |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|';
const row = (nm, x) => `| ${nm} | ${x.disc.n} | ${f3(x.disc.R)} | ${f3(x.disc.net)} | ${x.disc.t} | ${x.conf.n} | ${f3(x.conf.R)} (t ${x.conf.tR}) | ${f3(x.conf.net)} | ${x.conf.t} | ${x.conf.costR == null ? 'n/a' : x.conf.costR.toFixed(3)} | ${x.conf.win == null ? 'n/a' : (x.conf.win * 100).toFixed(1) + ' %'} |`;
function md(r) {
  const T = r.tests, c = r.cut.length ? r.cut.map((x) => `${x.market} ${x.cut}: ${x.n} signals, missing ${x.missing}, extra ${x.extra}, day labels differing ${x.labDiff}`).join('; ') : 'not run';
  const pl = r.placebo, q = (a) => { const s = [...a].sort((x, y) => x - y); return `${f3(s[0])} to ${f3(s[s.length - 1])} (median ${f3(s[s.length >> 1])})`; };
  return `# FVG return taken only with the day's volatility breakout (result)

${verdictLine(r)}

Run ${r.at} as pre-registered (\`PREREGISTRATION.md\`, committed and pushed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants. A before-cost tilt is not an edge.

## What was run

The FVG return (\`grid7-fvg-wide\` cell \`1h mkt large 1R\`, its own \`signals\`, medians from its result.json, \`dom-trade-through\`
\`manage\`) on ${r.markets.map((m) => m.market).join(', ')}, OANDA mid 5-minute candles. Breakout days from the T1 studies' own
\`buildDays\` / \`daySkip\` / \`vbTrade\` (k 0.5, both sides; gold \`gold-vol-breakout-hourcost/original.mjs\`, forex
\`index-vol-breakout/original.mjs\`). An FVG trade whose decision (the M15 close inside the gap) came after the breakout's fill
candle closed and before 21:00 UTC is WITH when its side is the breakout's, AGAINST otherwise; CONTROL = FVG trades of no-fill days;
REST = every trade not WITH. Costs = \`combo-grid-2\` \`COSTS\` (${Object.entries(r.costs).map(([k, v]) => `${k} ${v}`).join(', ')}; USD/CAD and
USD/CHF ASSUMED, not measured). Discovery 2005-2014 (gold from March 2006), confirmation 2015 to October 2026, month sums with empty
months as 0.

## The tests (Holm over three)

| Test | Pass | Holm p |
|---|---|---:|
| T1 ${T.T1.name}: random-day matched placebo beaten ${pl.beaten.conf} of 40 in 2015-26 (${pl.beaten.disc} of 40 in 2005-14) | ${T.T1.pass ? 'yes' : 'no'} | ${T.T1.holm.toFixed(3)} |
| T2 ${T.T2.name}: ${f3(r.T2.disc.diff)}R (Welch t ${r.T2.disc.t}) in 2005-14, ${f3(r.T2.conf.diff)}R (t ${r.T2.conf.t}) in 2015-26 | ${T.T2.pass ? 'yes' : 'no'} | ${T.T2.holm.toFixed(3)} |
| T3 ${T.T3.name}: ${f3(r.T3.disc.diff)}R (Welch t ${r.T3.disc.t}) in 2005-14, ${f3(r.T3.conf.diff)}R (t ${r.T3.conf.t}) in 2015-26 | ${T.T3.pass ? 'yes' : 'no'} | ${T.T3.holm.toFixed(3)} |

Placebo draws (mean net R of the matched random-day sample): 2005-14 ${q(pl.draws.disc)}; 2015-26 ${q(pl.draws.conf)}.

## Pooled

${HEAD}
${['with', 'against', 'control', 'rest', 'all'].map((k) => row(k.toUpperCase(), r.sets[k])).join('\n')}

## Per market

${r.markets.map((m) => `### ${m.market}${m.assumed ? ' (cost ASSUMED)' : ''}\n\nBreakout days ${m.days.breakout}, no-fill days ${m.days.nofill}; cell signals ${m.signals}; risk under cost ${m.small}, stop on the wrong side ${m.bad}, still open ${m.open}, excluded ${m.dropped}.\n\n${HEAD}\n${['with', 'against', 'control', 'all'].map((k) => row(k.toUpperCase(), r.per[m.market][k])).join('\n')}`).join('\n\n')}

## No look-ahead

Cut test (signals, their set and the day labels known at a cut date, computed on candles cut there, against the full run): ${c}.

## Reading

Taking the FVG return only with the day's breakout does not make it pay: WITH loses after costs in both windows
(${f3(r.sets.with.disc.net)}R / ${f3(r.sets.with.conf.net)}R a trade). Its edge over the rest in 2005-14 (${f3(r.T2.disc.diff)}R, Welch t
${r.T2.disc.t}) did not repeat in 2015-26 (${f3(r.T2.conf.diff)}R, t ${r.T2.conf.t}), and WITH and AGAINST are equal in 2015-26. As in
\`vb-pullback-fade\`, the least bad set is the quiet no-fill days (CONTROL ${f3(r.sets.control.conf.R)}R before costs,
${f3(r.sets.control.conf.net)}R after, 2015-26): the breakout direction picks no better FVG trades. Reported, not a rule.

## Caveats

- WITH is a subset of the plain FVG desk rule; its trades overlap freely (as the parent), and trades of one day are not
  independent, so the Welch t on trades overstates; the month-sum t of T1 carries the overlap.
- The breakout is only a label here: its forex years were read by earlier studies; on forex outside USD/JPY it did not pass.
- Costs are today's demo figures charged on every year (USD/CAD, USD/CHF assumed); a 1R target leaves little room for them.
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const r = runMarket(a); fs.writeFileSync(path.join(b, `${a}.json`), JSON.stringify(r)); console.log(a, r.trades.length, r.days, r.small, r.open); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, `${a}-cut.json`), JSON.stringify(r)); console.log(r); }
  else if (cmd === 'report') { const r = report(a); console.log(r.verdictLine); }
  else console.error('usage: market <m> <dir> | cut <m> <dir> | report <dir>');
}
