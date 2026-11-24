// research/edge/vb-pullback-fade/run.mjs - PREREGISTRATION.md (24 Nov 2026): the M15 Break fade (grid7-wide-fade cell
// m15 none atr 2R all) on gold and USD/JPY, split by the day's T1 breakout (WITH / AGAINST its direction, after its fill) and a
// control of the days with no breakout fill. Research only: nothing live imports it, nothing is placed.
//   node research/edge/vb-pullback-fade/run.mjs market <m> <outDir>   (one market, writes <outDir>/<m>.json)
//   node research/edge/vb-pullback-fade/run.mjs cut <m> <outDir>
//   node research/edge/vb-pullback-fade/run.mjs report <outDir>        (result.json + RESULT.md here)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import * as FADE from '../grid7-wide-fade/run.mjs';
import * as GO from '../gold-vol-breakout-hourcost/original.mjs';
import { T1 as GOLD_T1 } from '../gold-vol-breakout-hourcost/costs.mjs';
import * as JO from '../index-vol-breakout/original.mjs';
import { K as JPY_K } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'usdjpy'];
export const VB = { xau: { O: GO, k: GOLD_T1.k }, usdjpy: { O: JO, k: JPY_K } };
const ym = (y, m = 1) => Date.UTC(y, m - 1, 1) / 1000;
export const FROM = ym(2007), SPLIT = ym(2016), TO = ym(2026, 11);   // fills 2007-01 .. 2026-10
export const DM = 108, NM = 238;                                     // discovery months 0..107, confirmation 108..237
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2007) * 12 + d.getUTCMonth(); };
export const SETS = ['with', 'against', 'control'];
const TF_M15 = 1, CX_NONE = 0, ST_ATR = 1, X_2R = 1, DAY = 86400;

// ---- day labels from the breakout study's own code: d0 -> { kind: 'vb', D, fillT } | { kind: 'nofill' } ---------------------
export function dayLabels(market, M5) {
  const { O, k } = VB[market], rows = M5.map((b) => [b.t, b.o, b.h, b.l, b.c]), lab = new Map();
  for (const d of O.buildDays(rows)) {
    if (O.daySkip(d)) continue;
    const x = O.vbTrade(d.bars, { k, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (x.skip === 'nofill') lab.set(d.d0, { kind: 'nofill' });
    else if (!x.skip) lab.set(d.d0, { kind: 'vb', D: x.side, fillT: x.fillT });
  }
  return lab;
}

// which set a fade signal belongs to (null = none). g: grid7-wide-fade signal; fade side s = -g.d
export function classify(g, lab) {
  const d0 = Math.floor(g.ts / DAY) * DAY; if (g.ts - d0 >= GO.EXIT_S) return null;
  const L = lab.get(d0); if (!L) return null;
  if (L.kind === 'nofill') return 'control';
  if (g.ts < L.fillT + 300) return null;
  return -g.d === L.D ? 'with' : 'against';
}

export const m15Signals = (F) => FADE.signals(F).filter((g) => g.tf === TF_M15 && g.cx === CX_NONE);

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const lab = dayLabels(market, M5), sigs = m15Signals(F), cost = COSTS[market], X = exclusions(market), cap = FADE.CAP['15m'];
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const trades = []; const firstSeen = new Set(); let bad = 0, small = 0, open = 0, dropped = 0;
  sigs.sort((a, b) => a.ts - b.ts);
  for (const g of sigs) {
    const set = classify(g, lab); if (!set) continue;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(t)) { dropped++; continue; }
    const fill = M5[fi].o, s = -g.d, stop = fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    const r = FADE.exits(M5, s, fi, stop, [fill + s * 2 * risk], cap); if (!r) { open++; continue; }
    const d0 = Math.floor(g.ts / DAY) * DAY, first = set === 'with' && !firstSeen.has(d0); if (first) firstSeen.add(d0);
    trades.push([t, SETS.indexOf(set), +r.R[0].toFixed(6), +(cost / risk).toFixed(6), first ? 1 : 0]);
  }
  let vb = 0, nf = 0; for (const L of lab.values()) L.kind === 'vb' ? vb++ : nf++;
  return { market, cost, first: M5[0]?.t, last: M5.at(-1)?.t, days: { breakout: vb, nofill: nf }, m15signals: sigs.length, bad, small, open, dropped,
    cols: ['fillT', 'set (0 with, 1 against, 2 control)', 'R', 'costR', 'first with of the day'], trades };
}

// ---- cut test: day labels and set of every M15 signal known at a cut equal the full run's --------------------------------
export function cutTest(market, cuts = ['2009-06-10', '2013-03-13', '2017-09-20', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const full = (() => { const lab = dayLabels(market, M5); return { lab, sig: m15Signals(frames(M5)) }; })();
  const key = (g, lab) => [g.ts, g.d, g.a.toFixed(10), classify(g, lab)].join('|'); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000, cut = M5.filter((b) => b.t + 300 <= T);
    const lab = dayLabels(market, cut), sig = m15Signals(frames(cut)).filter((g) => g.ts <= T);
    const A = new Set(sig.map((g) => key(g, lab))), B = new Set(full.sig.filter((g) => g.ts <= T).map((g) => key(g, full.lab)));
    let labDiff = 0; for (const [d0, L] of full.lab) if (d0 + DAY <= T) { const M = lab.get(d0); if (JSON.stringify(M) !== JSON.stringify(L)) labDiff++; }
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length, labDiff }); }
  return out;
}

// ---- statistics -------------------------------------------------------------------------------------------------------
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
export function monthT(rows, w, key) {
  const a = w ? DM : 0, b = w ? NM : DM, ms = new Array(b - a).fill(0);
  for (const x of rows) ms[monthOf(x.t) - a] += x[key];
  const m = mean(ms), s = sd(ms), t = s > 0 ? m / (s / Math.sqrt(ms.length)) : 0; return { months: ms.length, t, p: t > 0 ? K.pFromT(t, ms.length - 1) / 2 : 1 - (K.pFromT(Math.abs(t), ms.length - 1) || 0) / 2 };
}
export function summ(rows, w) {
  const R = rows.map((x) => x.R), N = rows.map((x) => x.net);
  return { n: rows.length, R: +mean(R).toFixed(4), net: +mean(N).toFixed(4), costR: +mean(rows.map((x) => x.cr)).toFixed(4),
    win: +(rows.filter((x) => x.R > 0).length / (rows.length || 1)).toFixed(3), tR: +monthT(rows, w, 'R').t.toFixed(2), ...(({ t, p, months }) => ({ t: +t.toFixed(2), p, months }))(monthT(rows, w, 'net')) };
}
const normP = (z) => 0.5 * erfc(z / Math.SQRT2);   // one-sided p for a positive difference
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export function welch(a, b) { const ma = mean(a), mb = mean(b), va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length, t = (ma - mb) / Math.sqrt(va + vb);
  return { diff: +(ma - mb).toFixed(4), t: +t.toFixed(2), p: normP(t) }; }

export function judge(all) {
  const rows = all.map(([t, set, R, cr, first, market]) => ({ t, set, R, cr, net: R - cr, first, market }));
  const W = (w) => rows.filter((x) => (w ? x.t >= SPLIT : x.t < SPLIT));
  const S = (w, i, f = () => true) => W(w).filter((x) => x.set === i && f(x));
  const sets = {}; for (const [i, nm] of SETS.entries()) sets[nm] = { disc: summ(S(0, i), 0), conf: summ(S(1, i), 1) };
  const firstWith = { disc: summ(S(0, 0, (x) => x.first), 0), conf: summ(S(1, 0, (x) => x.first), 1) };
  const per = {}; for (const m of MARKETS) { per[m] = {}; for (const [i, nm] of SETS.entries()) per[m][nm] = { disc: summ(S(0, i, (x) => x.market === m), 0), conf: summ(S(1, i, (x) => x.market === m), 1) }; }
  const diff = (a, b) => ({ disc: welch(S(0, a).map((x) => x.net), S(0, b).map((x) => x.net)), conf: welch(S(1, a).map((x) => x.net), S(1, b).map((x) => x.net)) });
  const T3 = diff(0, 2), withVsAgainst = diff(0, 1);
  const ps = [sets.with.conf.p, sets.against.conf.p, T3.conf.p], h = K.holm(ps);
  const level = (x, hp) => x.disc.n >= 200 && x.conf.n >= 200 && x.disc.net > 0 && x.conf.net > 0 && x.conf.t >= 2 && hp < 0.05;
  const tests = {
    T1: { name: 'WITH fades after costs', pass: level(sets.with, h[0]), holm: h[0] },
    T2: { name: 'AGAINST fades after costs', pass: level(sets.against, h[1]), holm: h[1] },
    T3: { name: 'WITH minus CONTROL after costs', pass: T3.disc.diff > 0 && T3.conf.diff > 0 && T3.conf.t >= 2 && h[2] < 0.05, holm: h[2] },
  };
  const verdict = (tests.T1.pass && tests.T3.pass) || tests.T2.pass ? 'PASS' : 'FAIL';
  return { verdict, tests, sets, firstWith, T3, withVsAgainst, per };
}

const f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
export function verdictLine(J) {
  const w = J.sets.with, a = J.sets.against, c = J.sets.control;
  return `**Verdict: ${J.verdict}. ${['T1', 'T2', 'T3'].filter((k) => J.tests[k].pass).length} of 3 tests pass; WITH-breakout fades made ${f3(w.conf.net)}R a trade after costs in 2016-26 (n ${w.conf.n}, month t ${w.conf.t}; before costs ${f3(w.conf.R)}R), AGAINST ${f3(a.conf.net)}R (n ${a.conf.n}, t ${a.conf.t}), the no-breakout-day control ${f3(c.conf.net)}R (n ${c.conf.n}, t ${c.conf.t}).**`;
}

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')));
  const cuts = MARKETS.flatMap((m) => { const f = path.join(dir, `${m}-cut.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const all = data.flatMap((d) => d.trades.map((x) => [...x, d.market]));
  const J = judge(all);
  const res = { study: 'vb-pullback-fade', at: new Date().toISOString().slice(0, 10), verdict: J.verdict, verdictLine: verdictLine(J).replace(/\*/g, ''),
    windows: { discovery: '2007-01..2015-12', confirmation: '2016-01..2026-10' }, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    markets: data.map(({ trades, ...rest }) => rest), cut: cuts, ...J };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md(res));
  return res;
}

function row(nm, x) { return `| ${nm} | ${x.disc.n} | ${f3(x.disc.R)} | ${f3(x.disc.net)} | ${x.disc.t} | ${x.conf.n} | ${f3(x.conf.R)} (t ${x.conf.tR}) | ${f3(x.conf.net)} | ${x.conf.t} | ${x.conf.costR.toFixed(3)} | ${(x.conf.win * 100).toFixed(1)} % |`; }
const HEAD = '| Set | n 07-15 | R before costs | R after | month t (after) | n 16-26 | R before costs (month t) | R after | month t (after) | cost R | won |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|';
function md(r) {
  const T = r.tests, c = r.cut.length ? r.cut.map((x) => `${x.market} ${x.cut}: ${x.n} signals, missing ${x.missing}, extra ${x.extra}, day labels differing ${x.labDiff}`).join('; ') : 'not run';
  return `# Breakout day, then fade the pullback: the M15 Break fade split by the day's T1 breakout (result)

${verdictLine(r)}

Run ${r.at} as pre-registered (\`PREREGISTRATION.md\`, committed and pushed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants. A before-cost tilt is not an edge.

## What was run

Gold and USD/JPY, OANDA mid 5-minute candles. Breakout days from the T1 studies' own \`buildDays\` / \`daySkip\` / \`vbTrade\` (k 0.5,
both sides); the M15 Break fade (\`grid7-wide-fade\` cell \`m15 none atr 2R all\`, its own \`signals\` and \`exits\`). A fade whose M15
break closed after the breakout's fill candle (and before 21:00 UTC) is WITH when it points the breakout's way (a pullback faded),
AGAINST otherwise; CONTROL = every fade of a day whose breakout did not fill. Costs = the fade's parent costs (\`combo-grid-2\`):
gold $${r.costs.xau}, USD/JPY ${r.costs.usdjpy} a round trip (demo figures, not assumed). Discovery 2007-2015, confirmation
2016 to October 2026, month sums with empty months as 0.

## The tests (Holm over three)

| Test | Pass | Holm p |
|---|---|---:|
| T1 ${T.T1.name} | ${T.T1.pass ? 'yes' : 'no'} | ${T.T1.holm.toFixed(3)} |
| T2 ${T.T2.name} | ${T.T2.pass ? 'yes' : 'no'} | ${T.T2.holm.toFixed(3)} |
| T3 ${T.T3.name}: diff ${f3(r.T3.disc.diff)}R (Welch t ${r.T3.disc.t}) in 2007-15, ${f3(r.T3.conf.diff)}R (t ${r.T3.conf.t}) in 2016-26 | ${T.T3.pass ? 'yes' : 'no'} | ${T.T3.holm.toFixed(3)} |

## Pooled

${HEAD}
${['with', 'against', 'control'].map((k) => row(k.toUpperCase(), r.sets[k])).join('\n')}
${row('first WITH fade of each day (reported)', r.firstWith)}

WITH minus AGAINST, after costs: ${f3(r.withVsAgainst.disc.diff)}R (Welch t ${r.withVsAgainst.disc.t}) in 2007-15, ${f3(r.withVsAgainst.conf.diff)}R (t ${r.withVsAgainst.conf.t}) in 2016-26 (reported).

## Per market

${r.markets.map((m) => `### ${m.market}\n\nBreakout days ${m.days.breakout}, no-fill days ${m.days.nofill}; risk under cost ${m.small}, stop on the wrong side ${m.bad}, still open ${m.open}, excluded ${m.dropped}.\n\n${HEAD}\n${['with', 'against', 'control'].map((k) => row(k.toUpperCase(), r.per[m.market][k])).join('\n')}`).join('\n\n')}

## No look-ahead

Cut test (signals, their set and day labels known at a cut date, computed on candles cut there, against the full run): ${c}.

## Caveats

- The breakout does not pick better fades: on breakout days both sets lose after costs, and the fades of the quiet no-fill days
  are the least bad (before costs +0.15R a trade in both windows against +0.04R / -0.02R). Fading WITH the breakout beats fading
  AGAINST it by about 0.05R (Welch t under 2 in each window), never enough to cover costs. Reported, not a rule.
- Fades overlap freely (as the parent); month sums carry that, but trades of one day are not independent.
- Costs are today's demo figures charged on every year; the fade's M15 stop is small, so cost takes a large share of R.
- The breakout itself is not traded here; this asks only whether the day's breakout picks better fades.
`;
}

// ---- command line ----------------------------------------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const r = runMarket(a); fs.writeFileSync(path.join(b, `${a}.json`), JSON.stringify(r)); console.log(a, r.trades.length, r.days); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, `${a}-cut.json`), JSON.stringify(r)); console.log(r); }
  else if (cmd === 'report') { const r = report(a); console.log(r.verdictLine); }
  else console.error('usage: market <m> <dir> | cut <m> <dir> | report <dir>');
}
