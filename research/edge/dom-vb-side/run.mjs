// research/edge/dom-vb-side/run.mjs - PREREGISTRATION.md (24 Nov 2026): the H1 dominant-zone limit (dom-zone-holdout's rule)
// split by the day's T1 volatility breakout (WITH / AGAINST its side, armed after its fill), with a random-day control.
// Research only: nothing live imports it, nothing is placed.
//   node --max-old-space-size=6000 research/edge/dom-vb-side/run.mjs market <m> <outDir>
//   node research/edge/dom-vb-side/run.mjs cut <m> <outDir>
//   node research/edge/dom-vb-side/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, COSTS, exclusions, NONE } from '../combo-grid-3/run.mjs';
import { trades as holdoutTrades } from '../dom-zone-holdout/run.mjs';
import * as GO from '../gold-vol-breakout-hourcost/original.mjs';
import { T1 as GOLD_T1 } from '../gold-vol-breakout-hourcost/costs.mjs';
import * as JO from '../index-vol-breakout/original.mjs';
import { K as FX_K } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf'];
export const ASSUMED = ['usdcad', 'usdchf'];
const vbOf = (m) => (m === 'xau' ? { O: GO, k: GOLD_T1.k } : { O: JO, k: FX_K });
const ym = (y, m = 1) => Date.UTC(y, m - 1, 1) / 1000;
export const FROM = ym(2005), SPLIT = ym(2015), TO = ym(2026, 11);
export const DM = 120, NM = 263;                         // discovery months 2005-01..2014-12, confirmation 2015-01..2026-10
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
const DAY = 86400, EXIT_S = GO.EXIT_S;
export const SETS = ['with', 'against', 'other'];
export const DRAWS = 200, NEED = 190;

function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }

// dom-zone-holdout's trades() line for line, also keeping the touch time ts (checked against trades() by checkHoldout)
export function domTrades(market, from, to, M5) {
  M5 = M5 || K.load(market, '5m', { from: from - 200 * 86400, to }); if (!M5.length) return [];
  const F = frames(M5), H = F['1h'], T = F['5m'], A = atr14(H), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const out = [];
  for (const sg of signalsFor(F, '1h', '5m', 'dom', {}, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost)) continue;
    const r = multi(M5, d, entry, stop, 'lim', ts, ts + 12 * 300, 2, null, 2 * 86400, null);
    if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
    out.push({ ts, t: r.t, side: d, cr: cost / r.risk, trail: r.R[6], r4: r.R[3] });
  }
  return out;
}

// breakout day labels from the T1 studies' own code: d0 -> { D, fillT }
export function dayLabels(market, M5) {
  const { O, k } = vbOf(market), rows = M5.map((b) => [b.t, b.o, b.h, b.l, b.c]), lab = new Map();
  for (const d of O.buildDays(rows)) {
    if (O.daySkip(d)) continue;
    const x = O.vbTrade(d.bars, { k, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (!x.skip) lab.set(d.d0, { D: x.side, fillT: x.fillT });
  }
  return lab;
}
// set of one DOM trade: 0 with, 1 against, 2 other
export function classify(x, lab) {
  const d0 = Math.floor(x.ts / DAY) * DAY, L = lab.get(d0);
  if (!L || x.ts < L.fillT + 300 || x.ts - d0 >= EXIT_S) return 2;
  return x.side === L.D ? 0 : 1;
}

const SPANS = [[FROM, SPLIT], [SPLIT, TO]];
export function runMarket(market) {
  const trades = []; const labs = [];
  for (const [a, b] of SPANS) {
    const M5 = K.load(market, '5m', { from: a - 200 * 86400, to: b });
    const lab = dayLabels(market, M5); for (const [d0, L] of lab) if (d0 >= a - DAY && d0 < b) labs.push([d0, L.D, L.fillT]);
    for (const x of domTrades(market, a, b, M5)) trades.push([x.ts, x.t, x.side, +x.trail.toFixed(6), +x.r4.toFixed(6), +x.cr.toFixed(6), classify(x, lab)]);
  }
  return { market, cost: COSTS[market], assumed: ASSUMED.includes(market), cols: ['ts', 't', 'side', 'trail', 'r4', 'costR', 'set'], labels: labs, trades };
}

// equality with dom-zone-holdout's own trades() on one year (the 2015 span start)
export function checkHoldout(market, y = 2016) {
  const a = ym(y), b = ym(y + 1), M5 = K.load(market, '5m', { from: a - 200 * 86400, to: b });
  const mine = domTrades(market, a, b, M5), theirs = holdoutTrades(market, a, b);
  let diff = 0; for (let i = 0; i < Math.max(mine.length, theirs.length); i++) { const p = mine[i], q = theirs[i];
    if (!p || !q || p.t !== q.t || p.side !== q.side || Math.abs(p.trail - q.trail) > 1e-12 || Math.abs(p.cr - q.cr) > 1e-12) diff++; }
  return { market, year: y, n: theirs.length, diff };
}

export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2017-09-20', '2021-02-17', '2025-05-07']) {
  const out = [];
  for (const c of cuts) {
    const T = Date.parse(c + 'T00:00:00Z') / 1000, a = T - 120 * DAY;
    const full = K.load(market, '5m', { from: a - 200 * DAY, to: T + 30 * DAY }), cut = full.filter((b) => b.t + 300 <= T);
    const LF = dayLabels(market, full), LC = dayLabels(market, cut);
    let labDiff = 0; for (const [d0, L] of LF) if (d0 + DAY <= T && d0 >= a) { const M = LC.get(d0); if (!M || M.D !== L.D || M.fillT !== L.fillT) labDiff++; }
    // DOM trades armed and filled before T: same in both, and the same set
    const key = (x, lab) => [x.ts, x.t, x.side, classify(x, lab)].join('|');
    const A = new Set(domTrades(market, a, T, cut).filter((x) => x.t + 3 * DAY <= T).map((x) => key(x, LC)));
    const B = domTrades(market, a, T, full).filter((x) => x.t + 3 * DAY <= T);
    // a trade still open at T in the full run cannot be in the cut run; compare only the ones whose touch < T and whose label set is defined
    let missing = 0; for (const x of B) if (!A.has(key(x, LF))) missing++;
    out.push({ market, cut: c, labels: [...LF.keys()].filter((d) => d + DAY <= T && d >= a).length, labDiff, trades: B.length, missing });
  }
  return out;
}

// ---- statistics ---------------------------------------------------------------------------------------------------
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
export function monthT(rows, w, key) {
  const a = w ? DM : 0, b = w ? NM : DM, ms = new Array(b - a).fill(0);
  for (const x of rows) ms[monthOf(x.t) - a] += x[key];
  const m = mean(ms), s = sd(ms), t = s > 0 ? m / (s / Math.sqrt(ms.length)) : 0;
  return { months: ms.length, t, p: t > 0 ? K.pFromT(t, ms.length - 1) / 2 : 1 - (K.pFromT(Math.abs(t), ms.length - 1) || 0) / 2 };
}
export function summ(rows, w, k = 'trail') {
  const R = rows.map((x) => x[k]), N = rows.map((x) => x[k] - x.cr);
  const tn = monthT(rows.map((x) => ({ t: x.t, v: x[k] - x.cr })), w, 'v'), tb = monthT(rows.map((x) => ({ t: x.t, v: x[k] })), w, 'v');
  return { n: rows.length, R: +mean(R).toFixed(4), net: +mean(N).toFixed(4), costR: +mean(rows.map((x) => x.cr)).toFixed(4),
    win: +(rows.filter((x) => x[k] > 0).length / (rows.length || 1)).toFixed(3), tR: +tb.t.toFixed(2), t: +tn.t.toFixed(2), p: tn.p, months: tn.months };
}
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
const normP = (z) => 0.5 * erfc(z / Math.SQRT2);
export function welch(a, b) { const ma = mean(a), mb = mean(b), va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length, t = (ma - mb) / Math.sqrt(va + vb);
  return { diff: +(ma - mb).toFixed(4), t: +t.toFixed(2), p: normP(t) }; }

// random-day control: each breakout day of a market/window -> a random DOM-trade day of that market/window (no replacement)
export function placebo(data, draws = DRAWS) {
  const out = [];
  const prep = data.map((d) => {
    const byDay = new Map(); for (const x of d.rows) { const d0 = Math.floor(x.ts / DAY) * DAY; if (!byDay.has(d0)) byDay.set(d0, []); byDay.get(d0).push(x); }
    const W = [0, 1].map((w) => { const inW = (d0) => (w ? d0 >= SPLIT && d0 < TO : d0 >= FROM && d0 < SPLIT);
      return { days: [...byDay.keys()].filter(inW).sort((a, b) => a - b), labs: d.labels.filter(([d0]) => inW(d0)) }; });
    return { byDay, W };
  });
  for (let s = 1; s <= draws; s++) {
    const rnd = K.rng(1000 + s), conf = [];
    for (const P of prep) {
      const { days, labs } = P.W[1], pool = days.slice();
      for (const [d0, D, fillT] of labs) {
        if (!pool.length) break; const j = Math.floor(rnd() * pool.length), nd = pool[j]; pool[j] = pool[pool.length - 1]; pool.pop();
        const tod = fillT - d0;
        for (const x of P.byDay.get(nd)) if (x.ts >= nd + tod + 300 && x.ts - nd < EXIT_S && x.side === D && x.t >= SPLIT && x.t < TO) conf.push(x.trail - x.cr);
      }
    }
    out.push(mean(conf));
  }
  return out;
}

export function judge(data) {
  const rows = data.flatMap((d) => d.rows);
  const W = (w) => rows.filter((x) => (w ? x.t >= SPLIT && x.t < TO : x.t >= FROM && x.t < SPLIT));
  const S = (w, f) => W(w).filter(f);
  const isW = (x) => x.set === 0, isA = (x) => x.set === 1;
  const sets = {
    all: { disc: summ(W(0), 0), conf: summ(W(1), 1) },
    with: { disc: summ(S(0, isW), 0), conf: summ(S(1, isW), 1) },
    against: { disc: summ(S(0, isA), 0), conf: summ(S(1, isA), 1) },
  };
  const r4 = { with: { disc: summ(S(0, isW), 0, 'r4'), conf: summ(S(1, isW), 1, 'r4') }, all: { disc: summ(W(0), 0, 'r4'), conf: summ(W(1), 1, 'r4') } };
  const net = (x) => x.trail - x.cr;
  const dw = (w, fb) => welch(S(w, isW).map(net), S(w, fb).map(net));
  const T2 = { disc: { ...dw(0, (x) => !isW(x)), vsAll: +(sets.with.disc.net - sets.all.disc.net).toFixed(4) },
    conf: { ...dw(1, (x) => !isW(x)), vsAll: +(sets.with.conf.net - sets.all.conf.net).toFixed(4) } };
  const T3 = { disc: dw(0, isA), conf: dw(1, isA) };
  const h = K.holm([sets.with.conf.p, T2.conf.p, T3.conf.p]);
  const pl = placebo(data), beaten = pl.filter((v) => sets.with.conf.net > v).length;
  const plS = pl.slice().sort((a, b) => a - b);
  const tests = {
    T1: { name: 'WITH alone after costs', holm: h[0], pass: sets.with.disc.n >= 200 && sets.with.conf.n >= 200 && sets.with.disc.net > 0 && sets.with.conf.net > 0 && sets.with.conf.t >= 2 && h[0] < 0.05 },
    T2: { name: 'WITH against ALL after costs', holm: h[1], pass: T2.disc.vsAll > 0 && T2.conf.vsAll > 0 && T2.conf.t >= 2 && h[1] < 0.05 },
    T3: { name: 'WITH against AGAINST after costs', holm: h[2], pass: T3.disc.diff > 0 && T3.conf.diff > 0 && T3.conf.t >= 2 && h[2] < 0.05 },
  };
  const control = { draws: DRAWS, need: NEED, beaten, pass: beaten >= NEED, p5: +plS[Math.floor(0.05 * DRAWS)].toFixed(4), p50: +plS[DRAWS / 2].toFixed(4), p95: +plS[Math.floor(0.95 * DRAWS)].toFixed(4) };
  const verdict = tests.T1.pass && (tests.T2.pass || tests.T3.pass) && control.pass ? 'PASS' : 'FAIL';
  const per = {}; for (const d of data) { const m = d.market, Wm = (w) => W(w).filter((x) => x.market === m);
    per[m] = {}; for (const [nm, f] of [['all', () => true], ['with', isW], ['against', isA]]) per[m][nm] = { disc: summ(Wm(0).filter(f), 0), conf: summ(Wm(1).filter(f), 1) }; }
  return { verdict, tests, sets, r4, T2, T3, control, per };
}

const f3 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
export function verdictLine(J) {
  const w = J.sets.with, a = J.sets.against, al = J.sets.all;
  return `**Verdict: ${J.verdict}. ${['T1', 'T2', 'T3'].filter((k) => J.tests[k].pass).length} of 3 tests pass, control beaten in ${J.control.beaten} of ${J.control.draws} draws; in 2015-26 DOM limits WITH the day's breakout made ${f3(w.conf.net)}R a trade after costs (n ${w.conf.n}, month t ${w.conf.t}; before costs ${f3(w.conf.R)}R), AGAINST ${f3(a.conf.net)}R (n ${a.conf.n}, t ${a.conf.t}), all DOM trades ${f3(al.conf.net)}R (n ${al.conf.n}, t ${al.conf.t}).**`;
}

function row(nm, x) { return `| ${nm} | ${x.disc.n} | ${f3(x.disc.R)} | ${f3(x.disc.net)} | ${x.disc.t} | ${x.conf.n} | ${f3(x.conf.R)} (t ${x.conf.tR}) | ${f3(x.conf.net)} | ${x.conf.t} | ${x.conf.costR.toFixed(3)} |`; }
const HEAD = '| Set | n 2005-14 | R before costs | R after | month t (after) | n 2015-26 | R before costs (month t) | R after | month t (after) | cost R |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|';

export function report(dir) {
  const raw = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')));
  const data = raw.map((d) => ({ market: d.market, labels: d.labels, rows: d.trades.map(([ts, t, side, trail, r4, cr, set]) => ({ ts, t, side, trail, r4, cr, set, market: d.market })) }));
  const cuts = MARKETS.flatMap((m) => { const f = path.join(dir, `${m}-cut.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const checks = MARKETS.flatMap((m) => { const f = path.join(dir, `${m}-check.json`); return fs.existsSync(f) ? [JSON.parse(fs.readFileSync(f, 'utf8'))] : []; });
  const J = judge(data);
  const res = { study: 'dom-vb-side', at: new Date().toISOString().slice(0, 10), verdict: J.verdict, verdictLine: verdictLine(J).replace(/\*/g, ''),
    windows: { discovery: '2005-01..2014-12', confirmation: '2015-01..2026-10' },
    costs: Object.fromEntries(raw.map((d) => [d.market, d.cost])), assumedCosts: ASSUMED,
    counts: Object.fromEntries(raw.map((d) => [d.market, { breakoutDays: d.labels.length, trades: d.trades.length }])),
    holdoutCheck: checks, cut: cuts, ...J };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md(res));
  return res;
}

function md(r) {
  const T = r.tests, C = r.control;
  const cut = r.cut.length ? r.cut.map((x) => `${x.market} ${x.cut}: ${x.labels} days, labels differing ${x.labDiff}, ${x.trades} trades, missing ${x.missing}`).join('; ') : 'not run';
  const chk = r.holdoutCheck.map((x) => `${x.market} ${x.year}: ${x.n} trades, ${x.diff} differ`).join('; ');
  return `# The H1 dominant-zone limit on the side of the day's volatility breakout (result)

${verdictLine(r)}

Run ${r.at} as pre-registered (\`PREREGISTRATION.md\`, committed and pushed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants. A before-cost tilt is not an edge.

## What was run

Gold and the six forex majors of \`fx-vol-breakout\` (xau, eurusd, gbpusd, usdjpy, audusd, usdcad, usdchf), OANDA mid 5-minute
candles. DOM trades = \`dom-zone-holdout\`'s rule (trailing exit), checked trade for trade against its own \`trades()\` (${chk}).
Breakout days from the T1 studies' own \`buildDays\` / \`daySkip\` / \`vbTrade\` (k 0.5, both sides). A DOM limit armed after the
breakout's fill candle closed and before 21:00 UTC is WITH when on the breakout's side, AGAINST otherwise. Costs = \`combo-grid-3\`
\`COSTS\` as cost / risk (usdcad and usdchf ASSUMED). Discovery 2005-2014, confirmation 2015 to October 2026.

## The tests (Holm over three) and the control

| Test | Pass | Holm p |
|---|---|---:|
| T1 ${T.T1.name} | ${T.T1.pass ? 'yes' : 'no'} | ${T.T1.holm.toFixed(3)} |
| T2 ${T.T2.name}: WITH minus ALL ${f3(r.T2.disc.vsAll)}R in 2005-14, ${f3(r.T2.conf.vsAll)}R in 2015-26 (Welch t against the rest ${r.T2.disc.t} / ${r.T2.conf.t}) | ${T.T2.pass ? 'yes' : 'no'} | ${T.T2.holm.toFixed(3)} |
| T3 ${T.T3.name}: ${f3(r.T3.disc.diff)}R (Welch t ${r.T3.disc.t}) in 2005-14, ${f3(r.T3.conf.diff)}R (t ${r.T3.conf.t}) in 2015-26 | ${T.T3.pass ? 'yes' : 'no'} | ${T.T3.holm.toFixed(3)} |
| Control: WITH 2015-26 after costs beats ${C.beaten} of ${C.draws} random-day draws (needed ${C.need}; draws p5 ${f3(C.p5)}, median ${f3(C.p50)}, p95 ${f3(C.p95)}R) | ${C.pass ? 'yes' : 'no'} | |

## Pooled (trailing exit)

${HEAD}
${row('ALL DOM', r.sets.all)}
${row('WITH breakout', r.sets.with)}
${row('AGAINST breakout', r.sets.against)}

4R exit (reported): WITH ${f3(r.r4.with.disc.net)}R / ${f3(r.r4.with.conf.net)}R after costs (2005-14 / 2015-26), ALL ${f3(r.r4.all.disc.net)}R / ${f3(r.r4.all.conf.net)}R.

## Per market

${Object.entries(r.per).map(([m, p]) => `### ${m}${r.assumedCosts.includes(m) ? ' (cost ASSUMED)' : ''}\n\nBreakout days ${r.counts[m].breakoutDays}, DOM trades ${r.counts[m].trades}.\n\n${HEAD}\n${row('ALL', p.all)}\n${row('WITH', p.with)}\n${row('AGAINST', p.against)}`).join('\n\n')}

## No look-ahead

Cut test (breakout labels and the set of every DOM trade filled before a cut, recomputed on candles cut there, against the full
run): ${cut}.

## Caveats

- DOM trades overlap freely (as the parent rule); trades of one day are not independent, so Welch t overstates certainty.
- Costs are today's demo figures (two assumed) charged on every year.
- Only the DOM limits armed after the breakout filled are split; the breakout itself is not traded here.
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const r = runMarket(a); fs.writeFileSync(path.join(b, `${a}.json`), JSON.stringify(r)); console.log(a, r.trades.length, r.labels.length); }
  else if (cmd === 'check') { fs.mkdirSync(b, { recursive: true }); const r = checkHoldout(a); fs.writeFileSync(path.join(b, `${a}-check.json`), JSON.stringify(r)); console.log(r); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, `${a}-cut.json`), JSON.stringify(r)); console.log(r); }
  else if (cmd === 'report') { const r = report(a); console.log(r.verdictLine); }
  else console.error('usage: market|check|cut <m> <dir> | report <dir>');
}
